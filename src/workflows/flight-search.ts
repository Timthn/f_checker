import { sleep, FatalError,getWorkflowMetadata } from 'workflow';
import { claimJob,reserveCall,beginDispatch,saveRun,completeCall,failJob,suspendJob,finalizeCancellation } from '@/server/jobs';
import { startRun,runStatus,dataset } from '@/connectors/apify-rest';
import { parseSearch } from '@/connectors/apify-adapter';
import { reserveRead } from '@/server/provider-reads';
// Only opaque job IDs cross durable serialization boundaries. Tokens and booking payloads remain in private DB references.
export async function flightSearch(jobId:string){
 'use workflow';
 let started:string|null=null;
 for(let i=0;i<24;i++){started=await launch(jobId);if(started)break;await sleep('5s');}
 if(!started){await exhaustedCapacity(jobId);return jobId;}
 for(let i=0;i<24;i++){await sleep('5s');if(await collect(jobId))return jobId;}
 await exhaustedPolling(jobId);
 return jobId;
}
async function launch(jobId:string){
 'use step';
 if(process.env.LIVE_PROVIDER_ENABLED!=='true')throw new FatalError('LIVE_PROVIDER_DISABLED');
 const {transaction}=await import('@/server/db');
 const state=await transaction('worker',null,async c=>(await c.query('select status,cancelled_at,workflow_id from flight.jobs where job_id=$1',[jobId])).rows[0]);
 if(!state||state.cancelled_at||['cancelled','failed','uncertain','partial','succeeded'].includes(state.status)){await finalizeCancellation(jobId);return jobId;}
 const execution=getWorkflowMetadata().workflowRunId;
 if(state.workflow_id&&state.workflow_id!==execution)return jobId;
 const job=await claimJob(jobId,execution);if(!job)return null;
 try{
   const call=await reserveCall(job,'search');
   if(call.phase!=='reserved'){if(call.run_id)return jobId;await failJob(job,'DISPATCH_UNCERTAIN',true);throw new FatalError('DISPATCH_UNCERTAIN');}
   if(!await beginDispatch(job,call.call_id))return jobId;
   const q=job.query;
   // Keep USD0.01 of the USD0.03 reservation for bounded read/storage overhead.
   // The adequacy of this allowance remains a live-mode gate, not a verified tariff.
   const {runId,datasetId}=await startRun({mode:'search',routes:[`${q.origin}-${q.destination}`],departure_date:q.departure,return_date:q.return_date,adults:q.adults,cabin_class:q.cabin,currency:q.currency,carry_on_bags:q.carry_on,checked_bags:q.checked,maxConcurrency:1,maxRetries:0},Number(call.ceiling_microusd)-10000);
   await saveRun(job,call.call_id,runId,datasetId);
   return jobId;
 }catch(e){const code=e instanceof Error&&['QUOTA_EXCEEDED','LEASE_OR_CANCELLED','MISSING_CREDENTIALS'].includes(e.message)?e.message:'DISPATCH_UNCERTAIN';await failJob(job,code,code==='DISPATCH_UNCERTAIN');throw new FatalError(code);}
}
launch.maxRetries=0;
async function collect(jobId:string){
 'use step';
 const {transaction}=await import('@/server/db');
 const execution=getWorkflowMetadata().workflowRunId;
 const row=await transaction('worker',null,async c=>{const {rows}=await c.query("select j.*,s.query,p.call_id,p.run_id,p.dataset_id,p.phase as provider_phase from flight.jobs j join flight.searches s using(owner_id,search_id) join flight.provider_calls p using(owner_id,job_id) where j.job_id=$1 and j.workflow_id=$2 and p.operation_key='search'",[jobId,execution]);return rows[0];});
 if(!row)return null;
 if(row.cancelled_at){await finalizeCancellation(jobId);if(!row.run_id||['succeeded','failed'].includes(row.provider_phase))return jobId;
  try{await reserveRead(row.owner_id,row.call_id);const run=await runStatus(row.run_id);if(['SUCCEEDED','FAILED','TIMED-OUT','ABORTED'].includes(run.status)){await transaction('worker',null,async c=>{await c.query("update flight.provider_calls set phase=$3,reported_microusd=$4 where owner_id=$1 and call_id=$2 and run_id=$5",[row.owner_id,row.call_id,run.status==='SUCCEEDED'?'succeeded':'failed',typeof run.usage==='number'?Math.ceil(run.usage*1000000):null,row.run_id]);});return jobId;}}catch{await failJob(row,'CANCEL_RECONCILE_REQUIRED',true);return jobId;}return null;
 }
 if(['cancelled','failed','uncertain','partial','succeeded'].includes(row.status))return jobId;
 if(!row.run_id){await failJob(row,'DISPATCH_UNCERTAIN',true);return jobId;}
 // Renew only the still-current lease; collection never creates another paid run.
 const renewed=await transaction('worker',null,async c=>{const {rows}=await c.query("update flight.jobs set lease_until=now()+interval '120 seconds' where job_id=$1 and lease_version=$2 and cancelled_at is null and status='running' returning job_id",[jobId,row.lease_version]);return rows.length===1;});
 if(!renewed)return jobId;
 let run;try{await reserveRead(row.owner_id,row.call_id);run=await runStatus(row.run_id);}catch{await failJob(row,'READ_RECONCILE_REQUIRED',true);return jobId;}
 if(run.status==='SUCCEEDED'){
   try{await reserveRead(row.owner_id,row.call_id);const items=await dataset(row.dataset_id);if(items.length!==1)throw Error('PROVIDER_SCHEMA_CHANGED');
   const offers=parseSearch(items[0],row.query);await completeCall(row,row.call_id,offers,typeof run.usage==='number'?Math.ceil(run.usage*1000000):null);return jobId;
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
