import {randomUUID} from 'node:crypto';
import {transaction} from './db';
import type {PoolClient} from 'pg';

async function releaseHeld(c:PoolClient,owner:string,id:string,period:string){
 const held=await c.query("update flight.batch_slots set state='released' where owner_id=$1 and batch_id=$2 and state='held' returning ceiling_microusd",[owner,id]);
 if(!held.rows.length)return;
 const keys=['spike-lifetime',`month:${period}`,`owner:${owner}:${period}`].sort(),amount=held.rows.reduce((n,r)=>n+Number(r.ceiling_microusd),0);
 await c.query('select account_key from flight.budget_accounts where account_key=any($1::text[]) order by account_key for update',[keys]);
 await c.query('update flight.budget_accounts set reserved_microusd=reserved_microusd-$2,calls_reserved=calls_reserved-$3 where account_key=any($1::text[])',[keys,amount,held.rows.length]);
}

export async function ensureBatchWorkflow(owner:string,id:string,launcher:(id:string)=>Promise<string>,stopped?:(execution:string)=>Promise<boolean>):Promise<string|null>{
 const claim=await transaction('worker',null,async c=>{
  const b=(await c.query('select * from flight.batches where owner_id=$1 and batch_id=$2 for update',[owner,id])).rows[0];if(!b)throw Error('NOT_FOUND');
  if(b.workflow_id||b.cancelled_at||!['queued','running'].includes(b.status)||b.workflow_start_until&&new Date(b.workflow_start_until).getTime()>Date.now())return {token:null,workflow:b.workflow_id??null};
  const token=randomUUID();await c.query("update flight.batches set workflow_start_token=$3,workflow_start_until=now()+interval '90 seconds' where owner_id=$1 and batch_id=$2",[owner,id,token]);return {token,workflow:null};
 });
 if(!claim.token){
  // A timeout or missing status is never proof that an execution stopped.
  // Only authoritative SDK terminal evidence permits replacing a failed parent;
  // its immutable child membership and dispatch ledger remain unchanged.
  if(claim.workflow&&stopped&&await stopped(claim.workflow)){
   const cleared=await transaction('worker',null,async c=>(await c.query("update flight.batches set workflow_id=null,workflow_start_until=null where owner_id=$1 and batch_id=$2 and workflow_id=$3 and status in ('queued','running') and cancelled_at is null returning batch_id",[owner,id,claim.workflow])).rows.length===1);
   if(cleared)return ensureBatchWorkflow(owner,id,launcher);
  }
  return claim.workflow;
 }
 let execution:string;try{execution=await launcher(id);}catch{
  await transaction('worker',null,c=>c.query('update flight.batches set workflow_start_until=null where owner_id=$1 and batch_id=$2 and workflow_start_token=$3 and workflow_id is null',[owner,id,claim.token]));throw Error('WORKFLOW_START_RETRY');
 }
 return transaction('worker',null,async c=>(await c.query('update flight.batches set workflow_id=coalesce(workflow_id,$4),workflow_start_until=null where owner_id=$1 and batch_id=$2 and workflow_start_token=$3 returning workflow_id',[owner,id,claim.token,execution])).rows[0]?.workflow_id??null);
}

// This result stays inside a server step. The Workflow step returns only a boolean.
export async function prepareBatch(id:string,execution:string){return transaction('worker',null,async c=>{
 const b=(await c.query('select * from flight.batches where batch_id=$1 for update',[id])).rows[0];
 if(!b||b.workflow_id&&b.workflow_id!==execution)return {done:true,owner:null,children:[] as string[]};
 const members=(await c.query('select j.job_id,j.status,j.workflow_id from flight.batch_items i join flight.jobs j on j.owner_id=i.owner_id and j.job_id=i.child_job_id where i.owner_id=$1 and i.batch_id=$2 order by i.ordinal',[b.owner_id,id])).rows;
 if(b.cancelled_at||!['queued','running'].includes(b.status)){await releaseHeld(c,b.owner_id,id,b.accounting_period);return {done:true,owner:b.owner_id,children:[] as string[]};}
 const expired=new Date(b.expires_at).getTime()<=Date.now()||b.accounting_period!==new Date().toISOString().slice(0,7);
 if(expired){
  await c.query("update flight.jobs j set cancelled_at=coalesce(j.cancelled_at,now()),status=case when j.status in ('queued','running') then 'cancelled' else j.status end from flight.batch_items i where i.owner_id=j.owner_id and i.child_job_id=j.job_id and i.owner_id=$1 and i.batch_id=$2",[b.owner_id,id]);
  await c.query("update flight.batches set status='uncertain',workflow_id=coalesce(workflow_id,$3) where owner_id=$1 and batch_id=$2",[b.owner_id,id,execution]);await releaseHeld(c,b.owner_id,id,b.accounting_period);return {done:true,owner:b.owner_id,children:[] as string[]};
 }
 const active=members.filter(j=>['queued','running'].includes(j.status));
 if(!active.length){
  const status=members.some(j=>j.status==='uncertain')?'uncertain':members.every(j=>j.status==='succeeded')?'succeeded':members.some(j=>['partial','succeeded'].includes(j.status))?'partial':'failed';
  await c.query('update flight.batches set status=$3,workflow_id=coalesce(workflow_id,$4) where owner_id=$1 and batch_id=$2',[b.owner_id,id,status,execution]);await releaseHeld(c,b.owner_id,id,b.accounting_period);return {done:true,owner:b.owner_id,children:[] as string[]};
 }
 await c.query("update flight.batches set status='running',workflow_id=coalesce(workflow_id,$3) where owner_id=$1 and batch_id=$2",[b.owner_id,id,execution]);
 const launched=active.filter(j=>j.workflow_id).length;
 return {done:false,owner:b.owner_id as string,children:active.filter(j=>!j.workflow_id).slice(0,Math.max(0,2-launched)).map(j=>j.job_id as string),inspect:active.filter(j=>j.workflow_id).map(j=>({job:j.job_id as string,execution:j.workflow_id as string}))};
});}

// Caller must have authoritative SDK failed/cancelled evidence. No provider call
// may be replayed merely because its local executor stopped.
export async function recoverStoppedChild(owner:string,id:string,execution:string){return transaction('worker',null,async c=>{
 const job=(await c.query('select status,workflow_id,cancelled_at from flight.jobs where owner_id=$1 and job_id=$2 for update',[owner,id])).rows[0];
 if(!job||job.workflow_id!==execution||job.cancelled_at||!['queued','running'].includes(job.status))return false;
 const calls=(await c.query('select phase,run_id from flight.provider_calls where owner_id=$1 and job_id=$2',[owner,id])).rows;
 const ambiguous=calls.some(p=>p.phase!=='reserved'||p.run_id!==null);
 if(ambiguous){await c.query("update flight.jobs set status='uncertain',safe_error='CHILD_RUNTIME_RECONCILE',lease_until=null,lease_version=lease_version+1 where owner_id=$1 and job_id=$2",[owner,id]);return false;}
 await c.query("update flight.jobs set workflow_id=null,workflow_start_until=null,lease_until=null,lease_version=lease_version+1,status='queued',safe_error='CHILD_RUNTIME_RESTART' where owner_id=$1 and job_id=$2",[owner,id]);return true;
});}
