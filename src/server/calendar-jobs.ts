import {randomUUID} from 'node:crypto';
import {transaction} from './db';
import {stableId} from '../domain/rules';
import {calendarQuerySchema,calendarDays,type CalendarQuery} from './calendar-contract';
import type {CalendarCell} from '../domain/contracts';
import {projectReportedCost} from './reported-cost';
import {calendarTimestamps,calendarFreshness} from './calendar-time';

export async function createCalendarJob(owner:string,query:CalendarQuery,key:string){return transaction('api',owner,async c=>{
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${owner}:${key}`]);
 const hash=stableId({kind:'dates',query}),prior=(await c.query('select job_id,search_id,kind,request_hash from flight.jobs where owner_id=$1 and idempotency_key=$2',[owner,key])).rows[0];
 if(prior){if(prior.kind!=='dates'||prior.request_hash!==hash)throw Error('IDEMPOTENCY_CONFLICT');return {job_id:prior.job_id,search_id:prior.search_id,reused:true};}
 const job_id=randomUUID(),search_id=randomUUID();
 await c.query('insert into flight.searches(owner_id,search_id,query,fingerprint) values($1,$2,$3,$4)',[owner,search_id,query,hash]);
 await c.query("insert into flight.jobs(owner_id,job_id,search_id,kind,idempotency_key,request_hash) values($1,$2,$3,'dates',$4,$5)",[owner,job_id,search_id,key,hash]);
 return {job_id,search_id,reused:false};
});}
export async function readCalendarJob(owner:string,id:string){const result=await transaction('api',owner,async c=>{
 const j=(await c.query("select j.job_id,j.status,j.safe_error,j.cancelled_at,s.query from flight.jobs j join flight.searches s using(owner_id,search_id) where j.owner_id=$1 and j.job_id=$2 and j.kind='dates'",[owner,id])).rows[0];if(!j)return null;
 const q=calendarQuerySchema.parse({query:j.query,window_days:j.query.calendar_window_days});
 const rows=(await c.query('select departure::text,return_key,state,amount_minor,currency from flight.calendar_cells where owner_id=$1 and job_id=$2 order by departure limit 61',[owner,id])).rows;
 const byDay=new Map(rows.map(r=>[r.departure,r]));
 const cells=calendarDays(q).map(departure=>{const r=byDay.get(departure),minor=r?.amount_minor===null||r?.amount_minor===undefined?null:Number(r.amount_minor);const priced=r?.state==='coarse'&&r.return_key===(q.return_date??'')&&r.currency===q.currency&&minor!==null&&Number.isSafeInteger(minor)&&minor>=0;return {departure,return_date:q.return_date??null,state:priced?'coarse':'unknown',money:priced?{minor:minor!,currency:q.currency,digits:q.currency==='JPY'?0:2}:null};});
 // No private run/call/dataset IDs or provider error text cross this boundary.
 const safeErrors=['QUOTA_EXCEEDED','LIVE_PROVIDER_DISABLED','DISPATCH_UNCERTAIN','READ_RECONCILE_REQUIRED','DATASET_RECONCILE_REQUIRED','PROVIDER_UNAVAILABLE','ACCOUNT_PLAN_NOT_FREE','ACCOUNT_LIMITS_UNVERIFIED','POLL_LIMIT_RECONCILE','WORKER_CAPACITY','WORKFLOW_START_RETRY'];
 return {job_id:j.job_id,status:j.status,safe_error:safeErrors.includes(j.safe_error)?j.safe_error:null,query:q,scope:'travel_date_route_minimum',rights_verified:false,cells,coverage:{planned:cells.length,priced:cells.filter(x=>x.money!==null).length},source:'apify:build0.0.2'};
});if(!result)return null;
 // Checkpoints remain worker-private. Ownership was confirmed through API RLS
 // above; this lookup repeats owner/job/kind fencing and selects only timestamps.
 const evidence=await transaction('worker',null,async c=>(await c.query("select cp.safe_result->>'captured_at' as captured_at,cp.safe_result->>'observed_at' as observed_at from flight.checkpoints cp join flight.jobs j using(owner_id,job_id) join flight.provider_calls p on p.owner_id=cp.owner_id and p.job_id=cp.job_id and p.call_id::text=cp.step where cp.owner_id=$1 and cp.job_id=$2 and j.kind='dates' and p.operation_key='calendar' and cp.safe_result->>'scope'='travel_date_route_minimum' limit 1",[owner,id])).rows[0]??null);
 return {...result,...calendarFreshness(evidence)};}
export async function completeCalendar(job:{owner_id:string;job_id:string;lease_version:string},callId:string,cells:CalendarCell[],reported:number|null,times?:{observed_at:string|null;captured_at:string|null}){return transaction('worker',null,async c=>{
 const j=(await c.query('select lease_version,lease_until,cancelled_at,status from flight.jobs where owner_id=$1 and job_id=$2 for update',[job.owner_id,job.job_id])).rows[0];
 if(!j||j.lease_version!==job.lease_version)return;
 if(j.cancelled_at){await c.query("update flight.provider_calls set phase='succeeded' where owner_id=$1 and call_id=$2",[job.owner_id,callId]);await projectReportedCost(c,job.owner_id,callId,reported);return;}
 const until=j.lease_until?new Date(j.lease_until).getTime():NaN;
 if(j.status!=='running'||!Number.isFinite(until)||until<=Date.now())throw Error('LEASE_LOST');
 const prior=(await c.query('select step from flight.checkpoints where owner_id=$1 and job_id=$2 and step=$3',[job.owner_id,job.job_id,callId])).rows[0];if(prior)return;
 for(const cell of cells)await c.query('insert into flight.calendar_cells(owner_id,job_id,departure,return_key,state,amount_minor,currency) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing',[job.owner_id,job.job_id,cell.departure,cell.return_date??'',cell.state,cell.money?.minor??null,cell.money?.currency??null]);
 await c.query("update flight.provider_calls set phase='succeeded' where owner_id=$1 and call_id=$2",[job.owner_id,callId]);await projectReportedCost(c,job.owner_id,callId,reported);
 const safeTimes=calendarTimestamps({scraped_at:times?.observed_at},times?.captured_at??new Date().toISOString());
 await c.query('insert into flight.checkpoints(owner_id,job_id,step,safe_result) values($1,$2,$3,$4) on conflict do nothing',[job.owner_id,job.job_id,callId,{scope:'travel_date_route_minimum',rights_verified:false,...safeTimes,cells:cells.length,reasons:cells.filter(x=>x.evidence_reason).map(x=>({departure:x.departure,reason:x.evidence_reason}))}]);
 await c.query("update flight.jobs set status='partial',phase='calendar_complete',lease_until=null where owner_id=$1 and job_id=$2 and lease_version=$3",[job.owner_id,job.job_id,job.lease_version]);
});}
