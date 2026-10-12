import {randomUUID} from 'node:crypto';
import {Temporal} from '@js-temporal/polyfill';
import {transaction} from './db';
import {planBatch,liveMeetingSchema,liveFlexibleSchema,BatchPlanError,type BatchPlan,type LiveMeeting} from '../domain/batch-contracts';
import {qualifies,stableId} from '../domain/rules';
import type {Offer} from '../domain/contracts';

const period=()=>new Date().toISOString().slice(0,7);
const keys=(owner:string,p:string)=>['spike-lifetime',`month:${p}`,`owner:${owner}:${p}`].sort();
export function validLockedA(offer:Offer,q:LiveMeeting,now=new Date()){
 const out=offer.segments.filter(s=>s.leg_index===0),arrival=out.at(-1),departure=out[0]?.departure_local.slice(0,10);
 if(!departure||!arrival?.arrival_utc||!arrival.arrival_zone||!offer.time_verified)return false;
 const allowed=q.departure_scope==='fixed_departures'?[q.a.departure]:[-2,-1,0].map(days=>Temporal.PlainDate.from(q.arrival_day).add({days}).toString());
 if(!allowed.includes(departure)||qualifies(offer,{...q.a,departure},now)!=='confirmed')return false;
 try{return Temporal.Instant.from(arrival.arrival_utc).toZonedDateTimeISO(arrival.arrival_zone).toPlainDate().toString()===q.arrival_day;}catch{return false;}
}

// Called only after HTTP Auth. Worker writes still bind every row to the verified owner.
export async function admitBatch(owner:string,kind:BatchPlan['kind'],input:unknown,idempotencyKey:string){return transaction('worker',null,async c=>{
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`batch:${owner}:${idempotencyKey}`]);
 const normalized=kind==='meeting'?liveMeetingSchema.parse(input):liveFlexibleSchema.parse(input),hash=stableId({kind,request:normalized});
 const existing=await c.query('select batch_id,request_hash,status from flight.batches where owner_id=$1 and idempotency_key=$2',[owner,idempotencyKey]);
 if(existing.rows[0]){if(existing.rows[0].request_hash!==hash)throw new BatchPlanError('IDEMPOTENCY_CONFLICT');return {...existing.rows[0],reused:true};}
 let locked=false;
 if(kind==='meeting'){
  const q=liveMeetingSchema.parse(input);if(q.lock_a){const {rows}=await c.query('select payload from flight.offers where owner_id=$1 and offer_id=$2',[owner,q.lock_a]);if(!rows[0]||!validLockedA(rows[0].payload,q))throw new BatchPlanError('LOCK_UNAVAILABLE');locked=true;}
 }
 const plan=planBatch(kind,normalized,locked);
 const p=period(),accountKeys=keys(owner,p);
 for(const key of accountKeys)if(key!=='spike-lifetime')await c.query('insert into flight.budget_accounts(account_key,cap_microusd,call_cap) values($1,4000000,1000) on conflict do nothing',[key]);
 const accounts=await c.query('select * from flight.budget_accounts where account_key=any($1::text[]) order by account_key for update',[accountKeys]);
 if(accounts.rows.length!==3)throw Error('BUDGET_NOT_CONFIGURED');
 const available=Math.min(...accounts.rows.map(a=>Number(BigInt(a.cap_microusd)-BigInt(a.reserved_microusd))));
 if(plan.ceiling_microusd>available)throw new BatchPlanError('QUOTA_EXCEEDED',plan.ceiling_microusd,available);
 if(accounts.rows.some(a=>a.calls_reserved+plan.call_count>a.call_cap))throw new BatchPlanError('BATCH_CALL_LIMIT');
 await c.query('update flight.budget_accounts set reserved_microusd=reserved_microusd+$2,calls_reserved=calls_reserved+$3 where account_key=any($1::text[])',[accountKeys,plan.ceiling_microusd,plan.call_count]);
 const batchId=randomUUID();await c.query('insert into flight.batches(owner_id,batch_id,kind,request,plan,idempotency_key,request_hash,accounting_period,ceiling_microusd,call_count) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[owner,batchId,kind,plan.request,plan,idempotencyKey,hash,p,plan.ceiling_microusd,plan.call_count]);
 for(const item of plan.queries){
  const searchId=randomUUID(),jobId=randomUUID();
  await c.query('insert into flight.searches(owner_id,search_id,query,fingerprint) values($1,$2,$3,$4)',[owner,searchId,item.query,item.fingerprint]);
  await c.query("insert into flight.jobs(owner_id,job_id,search_id,kind,idempotency_key,request_hash) values($1,$2,$3,'search',$4,$5)",[owner,jobId,searchId,randomUUID(),item.fingerprint]);
  await c.query('insert into flight.batch_items(owner_id,batch_id,ordinal,child_job_id,query,participants) values($1,$2,$3,$4,$5,$6)',[owner,batchId,item.ordinal,jobId,item.query,JSON.stringify(item.participants)]);
  for(const operation of item.operations)await c.query('insert into flight.batch_slots(owner_id,batch_id,ordinal,operation_key,ceiling_microusd) values($1,$2,$3,$4,30000)',[owner,batchId,item.ordinal,operation]);
 }
 return {batch_id:batchId,status:'queued',reused:false,plan};
});}

export async function getBatch(owner:string,id:string){return transaction('api',owner,async c=>{
 const {rows}=await c.query('select batch_id,kind,status,cancelled_at,created_at,expires_at,request,plan,ceiling_microusd,call_count from flight.batches where owner_id=$1 and batch_id=$2',[owner,id]);if(!rows[0])return null;
 const items=await c.query('select i.ordinal,i.child_job_id,i.query,i.participants,j.status,j.phase,j.safe_error from flight.batch_items i join flight.jobs j on j.owner_id=i.owner_id and j.job_id=i.child_job_id where i.owner_id=$1 and i.batch_id=$2 order by i.ordinal',[owner,id]);
 return {...rows[0],items:items.rows};
});}

export async function cancelBatch(owner:string,id:string){return transaction('worker',null,async c=>{
 // Same ordering as prepaid reserveCall: parent before child before budget accounts.
 const {rows}=await c.query('select accounting_period from flight.batches where owner_id=$1 and batch_id=$2 for update',[owner,id]);if(!rows[0])return false;
 await c.query("update flight.batches set cancelled_at=coalesce(cancelled_at,now()),status='cancelled' where owner_id=$1 and batch_id=$2",[owner,id]);
 await c.query('update flight.jobs j set cancelled_at=coalesce(j.cancelled_at,now()) from flight.batch_items i where i.owner_id=j.owner_id and i.child_job_id=j.job_id and i.owner_id=$1 and i.batch_id=$2',[owner,id]);
 const held=await c.query("update flight.batch_slots set state='released' where owner_id=$1 and batch_id=$2 and state='held' returning ceiling_microusd",[owner,id]);
 if(held.rows.length){const released=held.rows.reduce((n,r)=>n+Number(r.ceiling_microusd),0),accountKeys=keys(owner,rows[0].accounting_period);
  await c.query('select account_key from flight.budget_accounts where account_key=any($1::text[]) order by account_key for update',[accountKeys]);
  await c.query('update flight.budget_accounts set reserved_microusd=reserved_microusd-$2,calls_reserved=calls_reserved-$3 where account_key=any($1::text[])',[accountKeys,released,held.rows.length]);
 }
 return true;
});}
