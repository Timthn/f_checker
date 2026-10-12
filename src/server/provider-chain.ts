import { transaction } from './db';
import { completeCall } from './jobs';
import {recordOffer} from './offer-recording';
import type { Search,Offer,Segment } from '../domain/contracts';

type Job={owner_id:string;job_id:string;search_id:string;status:string;lease_version:string;cancelled_at:string|null;query:Search};
export type PrivateNext={mode:'return'|'booking';token:string;selected:Segment[]};
export type ChainCoverage={returned:number;selected:number};
const key='next-stage';

// This function is called inside a step, never returned across Workflow serialization.
export async function privateContinuation(job:Job,mode:'return'|'booking'):Promise<PrivateNext>{
 const next=await transaction('worker',null,async c=>{
  await c.query('delete from flight.provider_references r using flight.provider_calls p where r.owner_id=p.owner_id and r.call_id=p.call_id and p.owner_id=$1 and p.job_id=$2 and r.expires_at<=now()',[job.owner_id,job.job_id]);
  const {rows}=await c.query("select r.payload from flight.provider_references r join flight.provider_calls p using(owner_id,call_id) where p.owner_id=$1 and p.job_id=$2 and p.operation_key=$3 and r.reference_key=$4 and r.expires_at>now()",[job.owner_id,job.job_id,mode==='return'?'search':job.query.return_date?'return':'search',key]);
  const next=rows[0]?.payload as PrivateNext|undefined;
  return next??null;
 });
 // Throw only after the expiry deletion has committed.
 if(!next||next.mode!==mode||typeof next.token!=='string'||!next.token||!Array.isArray(next.selected))throw Error('PROVIDER_REFERENCE_EXPIRED');
 return next;
}

// Atomic stage checkpoint, token storage and pointer advancement. No secret in safe_result.
export async function completeStage(job:Job,callId:string,offers:Offer[],reported:number|null,next:PrivateNext|null,coverage:ChainCoverage){
 if(!next){await completeCall(job,callId,offers,reported);await purgeReferences(job.owner_id,job.job_id);return;}
 await transaction('worker',null,async c=>{
  const {rows}=await c.query('select lease_version,lease_until,cancelled_at from flight.jobs where owner_id=$1 and job_id=$2 for update',[job.owner_id,job.job_id]);
  const state=rows[0],until=state?.lease_until instanceof Date?state.lease_until.getTime():NaN;
  if(!state||state.lease_version!==job.lease_version)throw Error('LEASE_LOST');
  if(state.cancelled_at){
   await c.query("update flight.provider_calls set phase='succeeded',reported_microusd=$3 where owner_id=$1 and call_id=$2 and job_id=$4",[job.owner_id,callId,reported,job.job_id]);
   await c.query('insert into flight.checkpoints(owner_id,job_id,step,safe_result) values($1,$2,$3,$4) on conflict do nothing',[job.owner_id,job.job_id,callId,{count:0,cancelled:true}]);
   await c.query("update flight.jobs set status='cancelled',lease_until=null where owner_id=$1 and job_id=$2",[job.owner_id,job.job_id]);
   await c.query('delete from flight.provider_references r using flight.provider_calls p where r.owner_id=p.owner_id and r.call_id=p.call_id and p.owner_id=$1 and p.job_id=$2',[job.owner_id,job.job_id]);return;
  }
  if(!Number.isFinite(until)||until<=Date.now())throw Error('LEASE_LOST');
  const prior=await c.query('select step from flight.checkpoints where owner_id=$1 and job_id=$2 and step=$3',[job.owner_id,job.job_id,callId]);
  if(prior.rows.length)return;
  const ack=await c.query("update flight.provider_calls set phase='succeeded',reported_microusd=$3 where owner_id=$1 and call_id=$2 and job_id=$4 and lease_version=$5 and phase='running' returning call_id",[job.owner_id,callId,reported,job.job_id,job.lease_version]);
  if(ack.rows.length!==1)throw Error('RUN_ACK_CONFLICT');
  for(let i=0;i<offers.length;i++)await recordOffer(c,job.owner_id,job.job_id,`${callId}:${i}`,offers[i],job.query);
  // Keep the original chain expiry; advancing stages must not extend token lifetime.
  const earlier=await c.query('select min(r.expires_at) as until from flight.provider_references r join flight.provider_calls p using(owner_id,call_id) where p.owner_id=$1 and p.job_id=$2',[job.owner_id,job.job_id]);
  const bounds=[Date.now()+900000,...offers.map(o=>Date.parse(o.expires_at)),...(earlier.rows[0]?.until?[new Date(earlier.rows[0].until).getTime()]:[])];
  const expiry=Math.min(...bounds);if(!Number.isFinite(expiry)||expiry<=Date.now())throw Error('PROVIDER_REFERENCE_EXPIRED');
  // Remove earlier stage references immediately; only the next stage's token survives.
  await c.query('delete from flight.provider_references r using flight.provider_calls p where r.owner_id=p.owner_id and r.call_id=p.call_id and p.owner_id=$1 and p.job_id=$2',[job.owner_id,job.job_id]);
  await c.query('insert into flight.provider_references(owner_id,call_id,reference_key,payload,expires_at) values($1,$2,$3,$4,$5)',[job.owner_id,callId,key,next,new Date(expiry)]);
  await c.query('insert into flight.checkpoints(owner_id,job_id,step,safe_result) values($1,$2,$3,$4)',[job.owner_id,job.job_id,callId,{count:offers.length,coverage,next_mode:next.mode}]);
  await c.query("update flight.jobs set phase=$3,lease_until=now()+interval '120 seconds' where owner_id=$1 and job_id=$2",[job.owner_id,job.job_id,next.mode]);
 });
}

export async function purgeReferences(owner:string,jobId:string){await transaction('worker',null,async c=>{await c.query('delete from flight.provider_references r using flight.provider_calls p where r.owner_id=p.owner_id and r.call_id=p.call_id and p.owner_id=$1 and p.job_id=$2',[owner,jobId]);});}

export async function purgeExpiredReferences(){await transaction('worker',null,async c=>{await c.query("delete from flight.provider_references r using flight.provider_calls p,flight.jobs j where r.owner_id=p.owner_id and r.call_id=p.call_id and p.owner_id=j.owner_id and p.job_id=j.job_id and (r.expires_at<=now() or j.cancelled_at is not null or j.status in ('partial','succeeded','failed','cancelled'))");});}
