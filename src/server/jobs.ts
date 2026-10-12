import { randomUUID } from 'node:crypto';
import { transaction } from './db';
import { stableId } from '../domain/rules';
import type { Search,Offer } from '../domain/contracts';
import {recordOffer} from './offer-recording';
import {recordRouteHistory} from './route-history-recording';
import type {RouteHistorySnapshot} from '../domain/route-history';
import {projectReportedCost} from './reported-cost';
type Job={owner_id:string;job_id:string;search_id:string;status:string;lease_version:string;cancelled_at:string|null;query:Search};
function validLease(value:unknown){const ms=value instanceof Date?value.getTime():typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(ms)&&ms>Date.now();}
export async function createJob(owner:string,query:Search,key:string){return transaction('api',owner,async c=>{
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${owner}:${key}`]);
  const fingerprint=stableId(query),existing=await c.query('select job_id,search_id,request_hash from flight.jobs where owner_id=$1 and idempotency_key=$2',[owner,key]);
  if(existing.rows[0]){if(existing.rows[0].request_hash!==fingerprint)throw Error('IDEMPOTENCY_CONFLICT');return {...existing.rows[0],reused:true};}
  const search_id=randomUUID(),job_id=randomUUID();
  await c.query('insert into flight.searches(owner_id,search_id,query,fingerprint) values($1,$2,$3,$4)',[owner,search_id,query,fingerprint]);
  await c.query("insert into flight.jobs(owner_id,job_id,search_id,kind,idempotency_key,request_hash) values($1,$2,$3,'search',$4,$5)",[owner,job_id,search_id,key,fingerprint]);
  return {search_id,job_id,reused:false};
});}
export async function readJob(owner:string,id:string){return transaction('api',owner,async c=>{const {rows}=await c.query('select job_id,search_id,status,phase,cancelled_at,safe_error from flight.jobs where owner_id=$1 and job_id=$2',[owner,id]);return rows[0]??null;});}
export async function cancelJob(owner:string,id:string){return transaction('api',owner,async c=>{const {rows}=await c.query("update flight.jobs set cancelled_at=coalesce(cancelled_at,now()),status=case when status in ('queued','running','uncertain') then 'cancelled' else status end where owner_id=$1 and job_id=$2 returning job_id,status",[owner,id]);return rows[0]??null;});}
// Start can be redelivered after a crash between SDK acknowledgement and DB commit.
// Provider dispatch is protected independently by the lease and pre-I/O ledger.
export async function ensureWorkflow(owner:string,id:string,launcher:(id:string)=>Promise<string>){
 const state=await transaction('worker',null,async c=>{
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`workflow:${id}`]);
 const {rows}=await c.query('select workflow_id,status,cancelled_at,workflow_start_until from flight.jobs where owner_id=$1 and job_id=$2 for update',[owner,id]);const job=rows[0];
 if(!job)throw Error('JOB_NOT_FOUND');if(job.workflow_id||job.cancelled_at||!['queued','running'].includes(job.status)||Date.parse(job.workflow_start_until)>Date.now())return {workflowId:job.workflow_id??null,token:null};
 const token=randomUUID();await c.query("update flight.jobs set workflow_start_token=$3,workflow_start_until=now()+interval '90 seconds' where owner_id=$1 and job_id=$2",[owner,id,token]);return {workflowId:null,token};
 });
 if(!state.token)return state.workflowId;
 // The startup reservation is committed before external IO. No DB locks cross SDK IO.
 let workflowId:string;try{workflowId=await launcher(id);}catch{
  await transaction('worker',null,async c=>{await c.query("update flight.jobs set workflow_start_until=null,safe_error='WORKFLOW_START_RETRY' where owner_id=$1 and job_id=$2 and workflow_start_token=$3 and workflow_id is null",[owner,id,state.token]);});throw Error('WORKFLOW_START_RETRY');
 }
 return transaction('worker',null,async c=>{const {rows}=await c.query('update flight.jobs set workflow_id=coalesce(workflow_id,$4),workflow_start_until=null where owner_id=$1 and job_id=$2 and workflow_start_token=$3 returning workflow_id',[owner,id,state.token,workflowId]);return rows[0]?.workflow_id??null;});
}
export async function claimJob(id:string,workflowId?:string):Promise<Job|null>{return transaction('worker',null,async c=>{
  await c.query('select pg_advisory_xact_lock(728401)');
  if(workflowId){const state=await c.query('select workflow_id from flight.jobs where job_id=$1 for update',[id]);if(!state.rows[0]||state.rows[0].workflow_id&&state.rows[0].workflow_id!==workflowId)return null;}
  // An expired local lease does not mean an upstream run or ambiguous POST stopped.
  const active=await c.query("select count(distinct job_id)::int as n from (select job_id from flight.jobs where lease_until>now() and status='running' union select job_id from flight.provider_calls where phase in ('dispatching','running','uncertain')) a where job_id<>$1",[id]);
  if(active.rows[0].n>=2)return null;
  const {rows}=await c.query("update flight.jobs j set lease_version=lease_version+1,lease_until=now()+interval '120 seconds',workflow_id=coalesce(workflow_id,$2),status='running' where job_id=$1 and cancelled_at is null and status in ('queued','running') and (lease_until is null or lease_until<now()) returning j.*",[id,workflowId??null]);
  if(!rows[0]||rows[0].cancelled_at)return null;
  const {rows:search}=await c.query('select query from flight.searches where owner_id=$1 and search_id=$2',[rows[0].owner_id,rows[0].search_id]);
  return {...rows[0],query:search[0].query};
});}
export async function reserveCall(job:Job,operation:string,ceiling=30000){return transaction('worker',null,async c=>{
  const member=(await c.query('select batch_id,ordinal from flight.batch_items where owner_id=$1 and child_job_id=$2',[job.owner_id,job.job_id])).rows[0];
  if(member){const batch=(await c.query('select status,cancelled_at,expires_at,accounting_period from flight.batches where owner_id=$1 and batch_id=$2 for update',[job.owner_id,member.batch_id])).rows[0];
   if(!batch||batch.cancelled_at||!['queued','running'].includes(batch.status))throw Error('LEASE_OR_CANCELLED');
   if(!validLease(batch.expires_at)||batch.accounting_period!==new Date().toISOString().slice(0,7))throw Error('BATCH_BUDGET_PERIOD_EXPIRED');
  }
  const locked=await c.query('select * from flight.jobs where owner_id=$1 and job_id=$2 for update',[job.owner_id,job.job_id]);const j=locked.rows[0];
  if(!j||j.cancelled_at||j.lease_version!==job.lease_version||!validLease(j.lease_until))throw Error('LEASE_OR_CANCELLED');
  const previous=await c.query('select * from flight.provider_calls where owner_id=$1 and job_id=$2 and operation_key=$3',[job.owner_id,job.job_id,operation]);
  if(previous.rows[0]){
   // A new fenced lease may adopt only an undispatched reservation. Preserve the
   // immutable call/slot and budget; never reset a dispatching or known run.
   if(previous.rows[0].phase==='reserved'&&previous.rows[0].run_id===null){
    const adopted=await c.query("update flight.provider_calls set lease_version=$4 where owner_id=$1 and job_id=$2 and call_id=$3 and phase='reserved' and run_id is null returning *",[job.owner_id,job.job_id,previous.rows[0].call_id,job.lease_version]);return {...adopted.rows[0],reused:true};
   }
   return {...previous.rows[0],reused:true};
  }
  if(member){
   const slot=(await c.query('select * from flight.batch_slots where owner_id=$1 and batch_id=$2 and ordinal=$3 and operation_key=$4 for update',[job.owner_id,member.batch_id,member.ordinal,operation])).rows[0];
   if(!slot||slot.state!=='held'||Number(slot.ceiling_microusd)!==ceiling)throw Error('BATCH_OPERATION_NOT_ADMITTED');
   const spent=(await c.query('select coalesce(sum(ceiling_microusd),0) as n from flight.provider_calls where owner_id=$1 and job_id=$2',[job.owner_id,job.job_id])).rows[0].n;
   if(BigInt(spent)+BigInt(ceiling)>100000n)throw Error('QUOTA_EXCEEDED');
   const callId=randomUUID(),call=(await c.query("insert into flight.provider_calls(owner_id,job_id,call_id,operation_key,phase,ceiling_microusd,lease_version) values($1,$2,$3,$4,'reserved',$5,$6) returning *",[job.owner_id,job.job_id,callId,operation,ceiling,job.lease_version])).rows[0];
   await c.query("update flight.batch_slots set state='transferred',call_id=$5 where owner_id=$1 and batch_id=$2 and ordinal=$3 and operation_key=$4 and state='held'",[job.owner_id,member.batch_id,member.ordinal,operation,callId]);
   return {...call,reused:false,batch_prepaid:true};
  }
  const period=new Date().toISOString().slice(0,7),keys=['spike-lifetime',`month:${period}`,`owner:${job.owner_id}:${period}`].sort();
  for(const key of keys){if(key!=='spike-lifetime')await c.query('insert into flight.budget_accounts(account_key,cap_microusd,call_cap) values($1,4000000,1000) on conflict do nothing',[key]);}
  const accounts=await c.query('select * from flight.budget_accounts where account_key=any($1::text[]) order by account_key for update',[keys]);
  if(accounts.rows.length!==3||accounts.rows.some(a=>BigInt(a.reserved_microusd)+BigInt(ceiling)>BigInt(a.cap_microusd)||a.calls_reserved+1>a.call_cap))throw Error('QUOTA_EXCEEDED');
  const cost=await c.query('select coalesce(sum(ceiling_microusd),0) as n from flight.provider_calls where owner_id=$1 and job_id=$2',[job.owner_id,job.job_id]);if(BigInt(cost.rows[0].n)+BigInt(ceiling)>100000n)throw Error('QUOTA_EXCEEDED');
  await c.query('update flight.budget_accounts set reserved_microusd=reserved_microusd+$2,calls_reserved=calls_reserved+1 where account_key=any($1::text[])',[keys,ceiling]);
  const call_id=randomUUID();const {rows}=await c.query("insert into flight.provider_calls(owner_id,job_id,call_id,operation_key,phase,ceiling_microusd,lease_version) values($1,$2,$3,$4,'reserved',$5,$6) returning *",[job.owner_id,job.job_id,call_id,operation,ceiling,job.lease_version]);return {...rows[0],reused:false};
});}
export async function beginDispatch(job:Job,callId:string){return transaction('worker',null,async c=>{
  const member=(await c.query('select batch_id from flight.batch_items where owner_id=$1 and child_job_id=$2',[job.owner_id,job.job_id])).rows[0];
  if(member){const batch=(await c.query('select status,cancelled_at,expires_at,accounting_period from flight.batches where owner_id=$1 and batch_id=$2 for update',[job.owner_id,member.batch_id])).rows[0];
   if(!batch||batch.cancelled_at||!['queued','running'].includes(batch.status))return false;
   if(!validLease(batch.expires_at)||batch.accounting_period!==new Date().toISOString().slice(0,7))throw Error('BATCH_BUDGET_PERIOD_EXPIRED');
  }
  const child=(await c.query('select lease_version,lease_until,cancelled_at from flight.jobs where owner_id=$1 and job_id=$2 for update',[job.owner_id,job.job_id])).rows[0];
  if(!child||child.cancelled_at||child.lease_version!==job.lease_version||!validLease(child.lease_until))return false;
  // Commit before network IO. Replay after this transition may read/reconcile, never POST again.
  const {rows}=await c.query("update flight.provider_calls p set phase='dispatching' from flight.jobs j where p.owner_id=j.owner_id and p.job_id=j.job_id and p.call_id=$1 and p.phase='reserved' and j.cancelled_at is null and j.lease_version=$2 and j.lease_until>now() and p.owner_id=$3 and p.job_id=$4 returning p.call_id",[callId,job.lease_version,job.owner_id,job.job_id]);return rows.length===1;
});}
export async function saveRun(job:Job,callId:string,runId:string,datasetId:string){return transaction('worker',null,async c=>{
 // A known upstream acknowledgement must survive cancellation/lease loss. This is
 // reconciliation metadata, not permission to publish or dispatch another run.
 const {rows}=await c.query("update flight.provider_calls set run_id=$1,dataset_id=$2,phase='running' where owner_id=$3 and job_id=$4 and call_id=$5 and lease_version=$6 and phase in ('dispatching','uncertain','running') and (run_id is null or run_id=$1 and dataset_id=$2) returning call_id",[runId,datasetId,job.owner_id,job.job_id,callId,job.lease_version]);
 if(rows.length!==1)throw Error('RUN_ACK_CONFLICT');
});}
export async function completeCall(job:Job,callId:string,offers:Offer[],reportedMicrousd:number|null,routeHistory:RouteHistorySnapshot|null=null){return transaction('worker',null,async c=>{
 const lock=await c.query('select lease_version,lease_until,cancelled_at,status from flight.jobs where owner_id=$1 and job_id=$2 for update',[job.owner_id,job.job_id]);if(lock.rows[0]?.lease_version!==job.lease_version)throw Error('LEASE_LOST');
 if(lock.rows[0].cancelled_at){
  await c.query('delete from flight.provider_references r using flight.provider_calls p where r.owner_id=p.owner_id and r.call_id=p.call_id and p.owner_id=$1 and p.job_id=$2',[job.owner_id,job.job_id]);
  await c.query("update flight.provider_calls set phase='succeeded' where owner_id=$1 and call_id=$2 and job_id=$3",[job.owner_id,callId,job.job_id]);await projectReportedCost(c,job.owner_id,callId,reportedMicrousd);
  await c.query('insert into flight.checkpoints(owner_id,job_id,step,safe_result) values($1,$2,$3,$4) on conflict do nothing',[job.owner_id,job.job_id,callId,{count:0,cancelled:true}]);
  await c.query("update flight.jobs set status='cancelled',lease_until=null where owner_id=$1 and job_id=$2 and status not in ('partial','succeeded')",[job.owner_id,job.job_id]);return;
 }
 if(!validLease(lock.rows[0].lease_until))throw Error('LEASE_LOST');
 await recordRouteHistory(c,job.owner_id,job.job_id,callId,job.query,routeHistory);
 await c.query('delete from flight.provider_references r using flight.provider_calls p where r.owner_id=p.owner_id and r.call_id=p.call_id and p.owner_id=$1 and p.job_id=$2',[job.owner_id,job.job_id]);
 for(let i=0;i<offers.length;i++)await recordOffer(c,job.owner_id,job.job_id,`${callId}:${i}`,offers[i],job.query);
 await c.query("update flight.provider_calls set phase='succeeded' where owner_id=$1 and call_id=$2",[job.owner_id,callId]);await projectReportedCost(c,job.owner_id,callId,reportedMicrousd);
 await c.query("insert into flight.checkpoints(owner_id,job_id,step,safe_result) values($1,$2,$3,$4) on conflict do nothing",[job.owner_id,job.job_id,callId,{count:offers.length}]);
 await c.query("update flight.jobs set status='partial',phase='candidate_search',lease_until=null where owner_id=$1 and job_id=$2 and lease_version=$3",[job.owner_id,job.job_id,job.lease_version]);
});}
export async function failJob(job:Job,code:string,uncertain:boolean){return transaction('worker',null,async c=>{
 const {rows}=await c.query("update flight.jobs set status=case when cancelled_at is not null then 'cancelled' else $1 end,safe_error=$2,lease_until=null where owner_id=$3 and job_id=$4 and lease_version=$5 returning job_id",[uncertain?'uncertain':'failed',code,job.owner_id,job.job_id,job.lease_version]);
 if(rows.length){await c.query("update flight.provider_calls set phase=$3 where owner_id=$1 and job_id=$2 and phase in ('dispatching','running')",[job.owner_id,job.job_id,uncertain?'uncertain':'failed']);await c.query('delete from flight.provider_references r using flight.provider_calls p where r.owner_id=p.owner_id and r.call_id=p.call_id and p.owner_id=$1 and p.job_id=$2',[job.owner_id,job.job_id]);}
});}
export async function suspendJob(id:string,capacity:boolean,workflowId?:string){return transaction('worker',null,async c=>{
 await c.query("update flight.jobs set status=case when cancelled_at is not null then 'cancelled' when $2 then 'queued' else 'uncertain' end,phase='needs_attention',safe_error=case when $2 then 'WORKER_CAPACITY' else 'POLL_LIMIT_RECONCILE' end,lease_until=null,workflow_id=case when $2 then null else workflow_id end where job_id=$1 and status in ('queued','running') and ($3::text is null or workflow_id=$3) and (not $2 or status='queued' and (lease_until is null or lease_until<now()))",[id,capacity,workflowId??null]);
});}
export async function finalizeCancellation(id:string){return transaction('worker',null,async c=>{await c.query("update flight.jobs set status='cancelled',lease_until=null where job_id=$1 and cancelled_at is not null and status not in ('partial','succeeded','failed')",[id]);});}
