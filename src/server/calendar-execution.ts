import {transaction} from './db';
import {claimJob,reserveCall,beginDispatch,saveRun,failJob,finalizeCancellation,suspendJob} from './jobs';
import {calendarInput,calendarQuerySchema,calendarResult} from './calendar-contract';
import {completeCalendar} from './calendar-jobs';
import {startRun,runStatus,dataset} from '../connectors/apify-rest';
import {searchExecutionEnabled} from './execution-policy';
import {checkFreeAllowance} from './provider-allowance';
import {reserveRead} from './provider-reads';
import {captureRunBilling,reconcileJobBilling} from './billing-evidence';
import {calendarTimestamps} from './calendar-time';
const terminal=['cancelled','failed','uncertain','partial','succeeded'];
export async function launchCalendar(id:string,execution:string):Promise<boolean>{
 const state=await transaction('worker',null,async c=>(await c.query("select status,cancelled_at,workflow_id from flight.jobs where job_id=$1 and kind='dates'",[id])).rows[0]);
 if(!state||state.cancelled_at||terminal.includes(state.status)){await finalizeCancellation(id);return true;}
 if(state.workflow_id&&state.workflow_id!==execution)return true;
 const job=await claimJob(id,execution);if(!job)return false;
 if(!searchExecutionEnabled()){await failJob(job,'LIVE_PROVIDER_DISABLED',false);return true;}
 let dispatched=false;
 try{
  const query=calendarQuerySchema.parse({query:job.query,window_days:(job.query as unknown as {calendar_window_days:number}).calendar_window_days});
  const call=await reserveCall(job,'calendar');
  if(call.phase!=='reserved'){if(call.run_id)return true;await failJob(job,'DISPATCH_UNCERTAIN',true);return true;}
  await checkFreeAllowance(job.owner_id,call.call_id);
  if(!await beginDispatch(job,call.call_id))return true;
  dispatched=true;
  const run=await startRun(calendarInput(query),Number(call.ceiling_microusd)-10000);
  await saveRun(job,call.call_id,run.runId,run.datasetId);return true;
 }catch(e){const code=!dispatched&&e instanceof Error&&['QUOTA_EXCEEDED','LEASE_OR_CANCELLED','MISSING_CREDENTIALS','ACCOUNT_PLAN_NOT_FREE','ACCOUNT_LIMITS_UNVERIFIED'].includes(e.message)?e.message:dispatched?'DISPATCH_UNCERTAIN':'ACCOUNT_LIMITS_UNVERIFIED';await failJob(job,code,dispatched);return true;}
}
export async function collectCalendar(id:string,execution:string):Promise<boolean>{
 const row=await transaction('worker',null,async c=>(await c.query("select j.*,s.query,p.call_id,p.run_id,p.dataset_id,p.phase as provider_phase,p.reads_reserved from flight.jobs j join flight.searches s using(owner_id,search_id) left join flight.provider_calls p on p.owner_id=j.owner_id and p.job_id=j.job_id and p.operation_key='calendar' where j.job_id=$1 and j.workflow_id=$2 and j.kind='dates'",[id,execution])).rows[0]);
 if(!row)return true;
 if(row.cancelled_at){await finalizeCancellation(id);if(!row.run_id||['succeeded','failed'].includes(row.provider_phase))return true;try{await reserveRead(row.owner_id,row.call_id);const run=await runStatus(row.run_id);await captureRunBilling(row.owner_id,row.call_id,{...run,runId:row.run_id});if(['SUCCEEDED','FAILED','TIMED-OUT','ABORTED'].includes(run.status)){await transaction('worker',null,async c=>{await c.query('update flight.provider_calls set phase=$3 where owner_id=$1 and call_id=$2 and run_id=$4',[row.owner_id,row.call_id,run.status==='SUCCEEDED'?'succeeded':'failed',row.run_id]);});return true;}}catch{await failJob(row,'READ_RECONCILE_REQUIRED',true);return true;}return false;}
 if(terminal.includes(row.status))return true;
 const renewed=await transaction('worker',null,async c=>(await c.query("update flight.jobs set lease_until=now()+interval '120 seconds' where owner_id=$1 and job_id=$2 and lease_version=$3 and workflow_id=$4 and cancelled_at is null and status='running' returning job_id",[row.owner_id,id,row.lease_version,execution])).rows.length===1);if(!renewed)return true;
 if(!row.run_id){await failJob(row,'DISPATCH_UNCERTAIN',true);return true;}
 if(row.reads_reserved>=24){await suspendJob(id,false,execution);return true;}
 let run;try{await reserveRead(row.owner_id,row.call_id);run=await runStatus(row.run_id);await captureRunBilling(row.owner_id,row.call_id,{...run,runId:row.run_id});}catch{await failJob(row,'READ_RECONCILE_REQUIRED',true);return true;}
 if(['FAILED','TIMED-OUT','ABORTED'].includes(run.status)){await failJob(row,'PROVIDER_UNAVAILABLE',false);return true;}
 if(run.status!=='SUCCEEDED')return false;
 try{await reserveRead(row.owner_id,row.call_id);const items=await dataset(row.dataset_id);const times=calendarTimestamps(items[0]);if(items.length!==1)throw Error('PROVIDER_SCHEMA_CHANGED');const q=calendarQuerySchema.parse({query:row.query,window_days:row.query.calendar_window_days});await completeCalendar(row,row.call_id,calendarResult(items[0],q),typeof run.usage==='number'?Math.ceil(run.usage*1000000):null,times);return true;}catch{await failJob(row,'DATASET_RECONCILE_REQUIRED',true);return true;}
}
export async function finishCalendar(id:string,execution:string,capacity:boolean){await suspendJob(id,capacity,execution);return true;}
export async function calendarBilling(id:string){const owner=await transaction('worker',null,async c=>(await c.query("select owner_id from flight.jobs where job_id=$1 and kind='dates'",[id])).rows[0]?.owner_id);if(owner)try{await reconcileJobBilling(owner,id);}catch{}return true;}
