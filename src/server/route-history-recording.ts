import type {PoolClient} from 'pg';
import type {Search} from '../domain/contracts';
import type {RouteHistorySnapshot} from '../domain/route-history';
import {stableId} from '../domain/rules';
export async function recordRouteHistory(c:PoolClient,owner:string,jobId:string,callId:string,query:Search,snapshot:RouteHistorySnapshot|null){
 if(!snapshot)return;if(snapshot.query_fingerprint!==stableId(query)||snapshot.currency!==query.currency)throw Error('HISTORY_SCOPE_MISMATCH');
 const safe:RouteHistorySnapshot={query_fingerprint:snapshot.query_fingerprint,currency:snapshot.currency,digits:snapshot.digits,observed_at:snapshot.observed_at,fetched_at:snapshot.fetched_at,source:snapshot.source,scope:snapshot.scope,price_scope:snapshot.price_scope,date_semantics:snapshot.date_semantics,points:snapshot.points.map(p=>({day:p.day,epoch_seconds:p.epoch_seconds,minor:p.minor})),provider_lowest_minor:snapshot.provider_lowest_minor,typical_range:snapshot.typical_range,price_level:snapshot.price_level};
 await c.query('insert into flight.route_history_snapshots(owner_id,job_id,call_id,observed_at,query_fingerprint,payload) values($1,$2,$3,$4,$5,$6) on conflict do nothing',[owner,jobId,callId,safe.observed_at,safe.query_fingerprint,safe]);
}
