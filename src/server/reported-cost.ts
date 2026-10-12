import type {PoolClient} from 'pg';
// Caller has already locked/updated provider call. A later statement snapshot sees
// any newer evidence committed while that lock was being acquired.
export async function projectReportedCost(c:PoolClient,owner:string,callId:string,fallback:number|null){
 await c.query(`update flight.provider_calls p set reported_microusd=case
 when exists(select 1 from flight.billing_evidence e where e.owner_id=p.owner_id and e.call_id=p.call_id)
 then (select (e.payload->>'reported_microusd')::bigint from flight.billing_evidence e where e.owner_id=p.owner_id and e.call_id=p.call_id order by e.observed_at desc limit 1)
 else $3 end where p.owner_id=$1 and p.call_id=$2`,[owner,callId,fallback]);
}
