import {transaction} from './db';
import {batchResults,type BatchResultItem} from '../domain/batch-results';
import type {BatchPlan} from '../domain/batch-contracts';
import type {Offer} from '../domain/contracts';

export async function readBatchResults(owner:string,id:string){return transaction('api',owner,async c=>{
 const parent=await c.query('select kind,plan,status,cancelled_at from flight.batches where owner_id=$1 and batch_id=$2',[owner,id]);
 if(!parent.rows[0])return null;
 const plan=parent.rows[0].plan as BatchPlan;
 // Private provider records stay worker-only. Project only the durable completion
 // bit, explicitly scoped to this owner and batch; never expose provider IDs.
 const evidence=await transaction('worker',null,async worker=>(await worker.query(`select i.ordinal,exists(select 1 from flight.provider_calls p join flight.checkpoints cp on cp.owner_id=p.owner_id and cp.job_id=p.job_id and cp.step=p.call_id::text where p.owner_id=i.owner_id and p.job_id=i.child_job_id and p.operation_key='search' and p.phase='succeeded') as searched from flight.batch_items i where i.owner_id=$1 and i.batch_id=$2`,[owner,id])).rows);
 // Bound each member independently; unrelated job rows cannot fill or alter this result set.
 const members=await c.query(`select i.ordinal,j.status,j.phase,
  (select count(*)::int from flight.offers o where o.owner_id=i.owner_id and o.job_id=i.child_job_id) as stored_count,
  coalesce((select jsonb_agg(selected.payload) from (select o.payload from flight.offers o where o.owner_id=i.owner_id and o.job_id=i.child_job_id order by o.observed_at desc,split_part(o.provider_result_key,':',1),case when split_part(o.provider_result_key,':',2) ~ '^[0-9]{1,9}$' then split_part(o.provider_result_key,':',2)::int end nulls last,o.offer_id limit 500) selected),'[]'::jsonb) as offers
  from flight.batch_items i join flight.jobs j on j.owner_id=i.owner_id and j.job_id=i.child_job_id
  where i.owner_id=$1 and i.batch_id=$2 order by i.ordinal`,[owner,id]);
 let lockedA:Offer|null=null;
 if(plan.kind==='meeting'&&'lock_a' in plan.request&&plan.request.lock_a){
  const lock=await c.query('select payload from flight.offers where owner_id=$1 and offer_id=$2',[owner,plan.request.lock_a]);lockedA=lock.rows[0]?.payload??null;
 }
 const items:BatchResultItem[]=members.rows.map(r=>({ordinal:r.ordinal,status:r.status,phase:r.phase,offers:r.offers,searched:evidence.find(e=>e.ordinal===r.ordinal)?.searched===true}));
 return {batch_id:id,status:parent.rows[0].status,cancelled:!!parent.rows[0].cancelled_at,...batchResults(plan,items,lockedA),result_coverage:{limit_per_query:500,omitted_offers:members.rows.reduce((n,r)=>n+Math.max(0,r.stored_count-r.offers.length),0)},paid_requests:0};
});}
