import {transaction} from './db';
import {runBillingEvidence,billingSummary,type RunBillingEvidence} from '../domain/billing';
import {runStatus} from '../connectors/apify-rest';
import {reserveRead} from './provider-reads';

// Supplier IDs and metadata stay worker-only. Public projection below excludes them.
export async function captureRunBilling(owner:string,callId:string,metadata:unknown,observedAt=new Date().toISOString()){
 return transaction('worker',null,async c=>{
  const call=(await c.query('select run_id from flight.provider_calls where owner_id=$1 and call_id=$2 for update',[owner,callId])).rows[0];if(!call?.run_id)throw Error('BILLING_RUN_UNKNOWN');
  const previous=(await c.query('select payload from flight.billing_evidence where owner_id=$1 and call_id=$2 order by observed_at desc limit 1',[owner,callId])).rows[0]?.payload as RunBillingEvidence|undefined;
  const evidence=runBillingEvidence(metadata,observedAt,previous);if(evidence.run_id!==call.run_id)throw Error('BILLING_RUN_MISMATCH');
  await c.query('insert into flight.billing_evidence(owner_id,call_id,observed_at,payload) values($1,$2,$3,$4) on conflict do nothing',[owner,callId,evidence.observed_at,evidence]);
  // Do not allow stale deliveries to overwrite newer cost evidence.
  const latest=(await c.query('select payload from flight.billing_evidence where owner_id=$1 and call_id=$2 order by observed_at desc limit 1',[owner,callId])).rows[0].payload as RunBillingEvidence;
  await c.query('update flight.provider_calls set reported_microusd=$3 where owner_id=$1 and call_id=$2',[owner,callId,latest.reported_microusd]);
 });
}

// Explicit reconciliation includes succeeded/failed calls, not just uncertain jobs.
// One bounded, reserved metadata read per known run; no provider POST or dataset access.
export async function reconcileJobBilling(owner:string,id:string){
 const calls=await transaction('worker',null,async c=>(await c.query('select p.call_id,p.run_id from flight.provider_calls p join flight.jobs j using(owner_id,job_id) where j.owner_id=$1 and j.job_id=$2 and p.run_id is not null order by p.created_at limit 3',[owner,id])).rows);
 let captured=0;
 for(const call of calls){try{await reserveRead(owner,call.call_id);const metadata=await runStatus(call.run_id);await captureRunBilling(owner,call.call_id,metadata);captured++;}catch{/* A capped/failed earlier call must not prevent remaining bounded captures. */}}
 const summary=await publicJobBilling(owner,id);return summary?{...summary,reconciliation:{attempted:calls.length,captured,pending:calls.length-captured}}:null;
}
export async function publicJobBilling(owner:string,id:string){return transaction('worker',null,async c=>{
 if(!(await c.query('select job_id from flight.jobs where owner_id=$1 and job_id=$2',[owner,id])).rows.length)return null;
 const calls=(await c.query(`select p.ceiling_microusd,p.reads_reserved,p.read_cap,p.reported_microusd,
 (select e.payload-'run_id' from flight.billing_evidence e where e.owner_id=p.owner_id and e.call_id=p.call_id order by observed_at desc limit 1) as evidence
 from flight.provider_calls p where p.owner_id=$1 and p.job_id=$2 order by p.created_at`,[owner,id])).rows;
 const held=Number((await c.query("select coalesce(sum(s.ceiling_microusd),0) as amount from flight.batch_items i join flight.batch_slots s using(owner_id,batch_id,ordinal) where i.owner_id=$1 and i.child_job_id=$2 and s.state='held'",[owner,id])).rows[0].amount);
 const reserved=held+calls.reduce((n,p)=>n+Number(p.ceiling_microusd),0),known=calls.length>0&&calls.every(p=>p.evidence?.reported_microusd!==null&&p.evidence?.reported_microusd!==undefined);
 const reported=known?calls.reduce((n,p)=>n+Number(p.evidence.reported_microusd),0):null;
 return {job_id:id,...billingSummary({reserved_microusd:reserved,reported_actor_microusd:reported,measured_external_microusd:null,estimated_external_microusd:calls.length*10000}),
  state:calls.length&&calls.every(p=>p.evidence?.classification==='settled_observation')?'stable_api_observation':'pending_evidence',
  read_requests_reserved:calls.reduce((n,p)=>n+p.reads_reserved,0),read_request_cap:calls.reduce((n,p)=>n+p.read_cap,0),
  calls:calls.map(p=>({status:p.evidence?.status??'unknown',classification:p.evidence?.classification??'unknown',observed_at:p.evidence?.observed_at??null,reported_microusd:p.evidence?.reported_microusd??null,pricing_info:p.evidence?.pricing_info??null,charged_event_counts:p.evidence?.charged_event_counts??null,platform_usage_billing_model:p.evidence?.platform_usage_billing_model??null})),
  pending:['platform_read_transfer_storage_measurement','period_scoped_account_reconciliation','invoice_confirmation']};
});}
