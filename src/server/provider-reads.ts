import { transaction } from './db';
import { runStatus } from '../connectors/apify-rest';
// Reserve before IO, including failed reads. This counter survives worker restarts.
export async function reserveRead(owner:string,callId:string){return transaction('worker',null,async c=>{
 const {rows}=await c.query('update flight.provider_calls set reads_reserved=reads_reserved+1 where owner_id=$1 and call_id=$2 and reads_reserved<read_cap returning call_id',[owner,callId]);if(!rows.length)throw Error('READ_BUDGET_EXCEEDED');
});}
export async function reconcileKnownRun(owner:string,jobId:string){
 const row=await transaction('worker',null,async c=>(await c.query("select j.status,j.cancelled_at,j.lease_version,p.call_id,p.run_id,p.phase from flight.jobs j join flight.provider_calls p using(owner_id,job_id) where j.owner_id=$1 and j.job_id=$2 and p.operation_key='search' and (j.cancelled_at is not null or j.status='uncertain' and (j.lease_until is null or j.lease_until<now()))",[owner,jobId])).rows[0]);
 if(!row?.run_id)return null;if(['succeeded','failed'].includes(row.phase))return {status:row.status,provider_finished:true};
 await reserveRead(owner,row.call_id);const run=await runStatus(row.run_id),terminal=['SUCCEEDED','FAILED','TIMED-OUT','ABORTED'].includes(run.status);
 if(terminal)await transaction('worker',null,async c=>{
  const {rows}=await c.query("update flight.provider_calls p set phase=$3,reported_microusd=$4 from flight.jobs j where p.owner_id=j.owner_id and p.job_id=j.job_id and p.owner_id=$1 and p.call_id=$2 and p.run_id=$5 and j.lease_version=$6 and (j.cancelled_at is not null or j.status='uncertain' and (j.lease_until is null or j.lease_until<now())) returning p.call_id",[owner,row.call_id,run.status==='SUCCEEDED'?'succeeded':'failed',typeof run.usage==='number'?Math.ceil(run.usage*1000000):null,row.run_id,row.lease_version]);
  // Reconciliation is read-only at the supplier: never POST, never publish cancelled offers.
  if(rows.length)await c.query("update flight.jobs set lease_until=null,phase='needs_attention',safe_error=case when cancelled_at is null then 'UPSTREAM_FINISHED_VERIFY_DATASET' else null end where owner_id=$1 and job_id=$2 and lease_version=$3 and (cancelled_at is not null or status='uncertain' and (lease_until is null or lease_until<now()))",[owner,jobId,row.lease_version]);
 });
 return {status:row.status,provider_finished:terminal};
}
