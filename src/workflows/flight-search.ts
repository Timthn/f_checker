import { sleep, FatalError,getWorkflowMetadata } from 'workflow';
import { claimJob,reserveCall,beginDispatch,saveRun,failJob,suspendJob,finalizeCancellation } from '@/server/jobs';
import { startRun,runStatus,dataset } from '@/connectors/apify-rest';
import { planSearch,planReturn } from '@/connectors/apify-chain';
import { completeStage,privateContinuation,purgeReferences,purgeExpiredReferences } from '@/server/provider-chain';
import { reserveRead } from '@/server/provider-reads';
import { checkFreeAllowance } from '@/server/provider-allowance';
import {captureRunBilling,reconcileJobBilling} from '@/server/billing-evidence';
import {parseRouteHistory} from '@/domain/route-history';
import {jobExecutionEnabled} from '@/server/execution-policy';
// Only opaque job IDs cross durable serialization boundaries. Tokens and booking payloads remain in private DB references.
export async function flightSearch(jobId:string){
 'use workflow';
 let started:string|null=null;
 for(let i=0;i<24;i++){started=await launch(jobId);if(started)break;await sleep('5s');}
 if(!started){await exhaustedCapacity(jobId);return jobId;}
 for(let i=0;i<72;i++){await sleep('5s');if(await collect(jobId)){await sleep('10s');await finalBilling(jobId);return jobId;}}
 await exhaustedPolling(jobId);
 await sleep('10s');await finalBilling(jobId);
 return jobId;
}
async function launch(jobId:string){
 'use step';
 await purgeExpiredReferences();
 const {transaction}=await import('@/server/db');
 const state=await transaction('worker',null,async c=>(await c.query('select status,cancelled_at,workflow_id,phase,exists(select 1 from flight.batch_items b where b.child_job_id=j.job_id) as batch_member from flight.jobs j where job_id=$1',[jobId])).rows[0]);
 if(!state||state.cancelled_at||['cancelled','failed','uncertain','partial','succeeded'].includes(state.status)){await finalizeCancellation(jobId);return jobId;}
 if(!jobExecutionEnabled(state.batch_member===true))throw new FatalError('LIVE_PROVIDER_DISABLED');
 const execution=getWorkflowMetadata().workflowRunId;
 if(state.workflow_id&&state.workflow_id!==execution)return jobId;
 const job=await claimJob(jobId,execution);if(!job)return null;
 if(state.phase==='booking'){await failJob(job,'BOOKING_ENDPOINT_UNSUPPORTED',true);await purgeReferences(job.owner_id,jobId);return jobId;}
 let dispatched=false;
 try{
   const call=await reserveCall(job,'search');
   if(call.phase!=='reserved'){if(call.run_id)return jobId;await failJob(job,'DISPATCH_UNCERTAIN',true);throw new FatalError('DISPATCH_UNCERTAIN');}
   await checkFreeAllowance(job.owner_id,call.call_id);
   if(!await beginDispatch(job,call.call_id))return jobId;
   dispatched=true;
   const q=job.query;
   // Keep USD0.01 of the USD0.03 reservation for bounded read/storage overhead.
   // The adequacy of this allowance remains a live-mode gate, not a verified tariff.
   const {runId,datasetId}=await startRun({mode:'search',routes:[`${q.origin}-${q.destination}`],departure_date:q.departure,return_date:q.return_date,adults:q.adults,cabin_class:q.cabin,currency:q.currency,carry_on_bags:q.carry_on,checked_bags:q.checked,maxConcurrency:1,maxRetries:0},Number(call.ceiling_microusd)-10000);
   await saveRun(job,call.call_id,runId,datasetId);
   return jobId;
 }catch(e){const code=e instanceof Error&&['QUOTA_EXCEEDED','LEASE_OR_CANCELLED','BATCH_BUDGET_PERIOD_EXPIRED','BATCH_OPERATION_NOT_ADMITTED','MISSING_CREDENTIALS','ACCOUNT_PLAN_NOT_FREE','ACCOUNT_LIMITS_UNVERIFIED','DISPATCH_UNCERTAIN'].includes(e.message)?e.message:dispatched?'DISPATCH_UNCERTAIN':'ACCOUNT_LIMITS_UNVERIFIED';await failJob(job,code,dispatched||code==='DISPATCH_UNCERTAIN');throw new FatalError(code);}
}
launch.maxRetries=0;
async function collect(jobId:string){
 'use step';
 await purgeExpiredReferences();
 const {transaction}=await import('@/server/db');
 const execution=getWorkflowMetadata().workflowRunId;
 const row=await transaction('worker',null,async c=>{const {rows}=await c.query("select j.*,s.query,p.call_id,p.run_id,p.dataset_id,p.phase as provider_phase,p.reads_reserved from flight.jobs j join flight.searches s using(owner_id,search_id) left join flight.provider_calls p on p.owner_id=j.owner_id and p.job_id=j.job_id and p.operation_key=case when j.phase in ('return','booking') then j.phase else 'search' end where j.job_id=$1 and j.workflow_id=$2",[jobId,execution]);return rows[0];});
 if(!row)return null;
 // Booking endpoints are outside the application scope. Legacy checkpoints are
 // stopped explicitly before any booking run, metadata or dataset request.
 if(row.phase==='booking'){await failJob(row,'BOOKING_ENDPOINT_UNSUPPORTED',true);await purgeReferences(row.owner_id,jobId);return jobId;}
 if(row.cancelled_at){await finalizeCancellation(jobId);await purgeReferences(row.owner_id,jobId);if(!row.run_id||['succeeded','failed'].includes(row.provider_phase))return jobId;
  try{await reserveRead(row.owner_id,row.call_id);const run=await runStatus(row.run_id);await captureRunBilling(row.owner_id,row.call_id,{...run,runId:row.run_id});if(['SUCCEEDED','FAILED','TIMED-OUT','ABORTED'].includes(run.status)){await transaction('worker',null,async c=>{await c.query("update flight.provider_calls set phase=$3 where owner_id=$1 and call_id=$2 and run_id=$4",[row.owner_id,row.call_id,run.status==='SUCCEEDED'?'succeeded':'failed',row.run_id]);});return jobId;}}catch{await failJob(row,'CANCEL_RECONCILE_REQUIRED',true);return jobId;}return null;
 }
 if(['cancelled','failed','uncertain','partial','succeeded'].includes(row.status))return jobId;
 // Renew only the still-current lease; collection never creates another paid run.
 const renewed=await transaction('worker',null,async c=>{const {rows}=await c.query("update flight.jobs set lease_until=now()+interval '120 seconds' where job_id=$1 and lease_version=$2 and cancelled_at is null and status='running' returning job_id",[jobId,row.lease_version]);return rows.length===1;});
 if(!renewed)return jobId;
 const mode=row.phase==='return'?'return':'search';
 if(!row.call_id&&mode!=='search'){
  let dispatched=false;
  try{
   const membership=await transaction('worker',null,async c=>(await c.query('select exists(select 1 from flight.batch_items where child_job_id=$1) as batch_member',[jobId])).rows[0]);
   if(!jobExecutionEnabled(membership?.batch_member===true))throw Error('LIVE_PROVIDER_DISABLED');
   const next=await privateContinuation(row,mode),call=await reserveCall(row,mode);
   if(call.phase!=='reserved'){await failJob(row,'DISPATCH_UNCERTAIN',true);return jobId;}
   await checkFreeAllowance(row.owner_id,call.call_id);
   if(!await beginDispatch(row,call.call_id))return jobId;
   dispatched=true;
   const result=await startRun({mode,tokens:[next.token],maxConcurrency:1,maxRetries:0,includeErrors:true},Number(call.ceiling_microusd)-10000);
   await saveRun(row,call.call_id,result.runId,result.datasetId);return null;
  }catch(e){const code=!dispatched&&e instanceof Error&&['LIVE_PROVIDER_DISABLED','QUOTA_EXCEEDED','BATCH_BUDGET_PERIOD_EXPIRED','BATCH_OPERATION_NOT_ADMITTED','PROVIDER_REFERENCE_EXPIRED','LEASE_OR_CANCELLED','ACCOUNT_PLAN_NOT_FREE','ACCOUNT_LIMITS_UNVERIFIED'].includes(e.message)?e.message:dispatched?'DISPATCH_UNCERTAIN':'ACCOUNT_LIMITS_UNVERIFIED';await failJob(row,code,dispatched);await purgeReferences(row.owner_id,jobId);return jobId;}
 }
 if(!row.run_id){await failJob(row,'DISPATCH_UNCERTAIN',true);return jobId;}
 if(row.reads_reserved>=24){await suspendJob(jobId,false,execution);return jobId;}
 let run;try{await reserveRead(row.owner_id,row.call_id);run=await runStatus(row.run_id);await captureRunBilling(row.owner_id,row.call_id,{...run,runId:row.run_id});}catch{await failJob(row,'READ_RECONCILE_REQUIRED',true);return jobId;}
 if(run.status==='SUCCEEDED'){
   try{await reserveRead(row.owner_id,row.call_id);const items=await dataset(row.dataset_id);if(items.length!==1)throw Error('PROVIDER_SCHEMA_CHANGED');
   const reported=typeof run.usage==='number'?Math.ceil(run.usage*1000000):null;
   const continuation=mode==='return'?await privateContinuation(row,'return'):null;
   const plan=mode==='search'?planSearch(items[0],row.query):planReturn(items[0],row.query,continuation!.selected,continuation!.outbound_duration_minutes??null);
   await completeStage(row,row.call_id,plan.offers,reported,plan.next,plan.coverage,mode==='search'?parseRouteHistory(items[0],row.query,new Date().toISOString()):null);
   return plan.next?null:jobId;
   }catch{await failJob(row,'DATASET_RECONCILE_REQUIRED',true);return jobId;}
 }
 if(['FAILED','TIMED-OUT','ABORTED'].includes(run.status)){await failJob(row,'PROVIDER_UNAVAILABLE',false);return jobId;}
 return null;
}
collect.maxRetries=0;
async function exhaustedCapacity(jobId:string){'use step';await suspendJob(jobId,true,getWorkflowMetadata().workflowRunId);return jobId;}
exhaustedCapacity.maxRetries=0;
async function exhaustedPolling(jobId:string){'use step';await suspendJob(jobId,false,getWorkflowMetadata().workflowRunId);return jobId;}
exhaustedPolling.maxRetries=0;
async function finalBilling(jobId:string){
 'use step';
 const {transaction}=await import('@/server/db');
 const owner=await transaction('worker',null,async c=>(await c.query('select owner_id from flight.jobs where job_id=$1',[jobId])).rows[0]?.owner_id);
 if(owner)try{await reconcileJobBilling(owner,jobId);}catch{/* Read budget or missing evidence stays explicitly pending in the safe summary. */}
 return jobId;
}
finalBilling.maxRetries=0;
