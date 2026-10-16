import { transaction } from './db';
import { datePairs,rank,rendezvous,validStay,history,stableId } from '../domain/rules';
import type { Offer,Search,Observation,CalendarCell } from '../domain/contracts';
import type { MeetingQuery,FlexibleQuery } from '../domain/analysis-contracts';
import {savedDeparturePrices,type SavedDateQuote} from '../domain/price-context';
export async function cachedOffers(owner:string,query:Search):Promise<Offer[]>{return transaction('api',owner,async c=>{
 const {rows}=await c.query('select o.payload from flight.offers o join flight.jobs j using(owner_id,job_id) join flight.searches s using(owner_id,search_id) where o.owner_id=$1 and s.fingerprint=$2 order by o.observed_at desc limit 500',[owner,stableId(query)]);
 return rows.map(r=>r.payload);
});}
export async function jobResults(owner:string,id:string){return transaction('api',owner,async c=>{
 const {rows}=await c.query('select j.status,j.safe_error,s.query from flight.jobs j join flight.searches s using(owner_id,search_id) where j.owner_id=$1 and j.job_id=$2',[owner,id]);if(!rows[0])return null;
 const {rows:offers}=await c.query("select payload from flight.offers where owner_id=$1 and job_id=$2 order by observed_at desc, split_part(provider_result_key,':',1),case when split_part(provider_result_key,':',2) ~ '^[0-9]{1,9}$' then split_part(provider_result_key,':',2)::int end nulls last,offer_id limit 500",[owner,id]);
 const candidates:Offer[]=offers.map(r=>r.payload),ranked=rank(candidates,rows[0].query);
 const route=await c.query('select h.payload from flight.route_history_snapshots h join flight.searches s on s.owner_id=h.owner_id join flight.jobs j on j.owner_id=s.owner_id and j.search_id=s.search_id and j.job_id=h.job_id where h.owner_id=$1 and h.job_id=$2 and h.query_fingerprint=s.fingerprint order by h.observed_at desc limit 1',[owner,id]);
 const safeCodes=['QUOTA_EXCEEDED','ACCOUNT_PLAN_NOT_FREE','ACCOUNT_LIMITS_UNVERIFIED','DISPATCH_UNCERTAIN','READ_RECONCILE_REQUIRED','DATASET_RECONCILE_REQUIRED','PROVIDER_UNAVAILABLE','LIVE_PROVIDER_DISABLED','PROVIDER_REFERENCE_EXPIRED'];
 return {job_id:id,status:rows[0].status,safe_error:safeCodes.includes(rows[0].safe_error)?rows[0].safe_error:null,query:rows[0].query,...ranked,source_count:candidates.length,route_history:route.rows[0]?.payload??null,coverage:'returned_candidates_only'};
});}
export async function offerDetails(owner:string,id:string){return transaction('api',owner,async c=>{
 const {rows}=await c.query('select o.payload,o.job_id,s.query from flight.offers o join flight.jobs j using(owner_id,job_id) join flight.searches s using(owner_id,search_id) where o.owner_id=$1 and o.offer_id=$2',[owner,id]);if(!rows[0])return null;
 const offer:Offer=rows[0].payload;
 const {rows:obs}=offer.comparison_key?await c.query('select comparison_key,observed_at,amount_minor,currency,fresh from flight.observations where owner_id=$1 and comparison_key=$2 and observed_at >= $3::timestamptz-interval \'30 days\' and observed_at < $3::timestamptz',[owner,offer.comparison_key,offer.observed_at]):{rows:[]};
 const observations:Observation[]=obs.map(r=>({...r,observed_at:r.observed_at.toISOString(),minor:Number(r.amount_minor)}));
 // Calendar is a separate provider product. Missing rows are not synthesized as cheap dates.
 const departure=offer.segments.find(s=>s.leg_index===0)?.departure_local.slice(0,10);
 const {rows:dates}=departure?await c.query('select departure::text,return_key,state,amount_minor,currency,offer_id from flight.calendar_cells where owner_id=$1 and job_id=$2 and departure between $3::date-30 and $3::date+30 order by departure',[owner,rows[0].job_id,departure]):{rows:[]};
 const datePrices:CalendarCell[]=dates.map(r=>({departure:r.departure,return_date:r.return_key||null,state:r.state,offer_id:r.offer_id,money:r.amount_minor===null?null:{minor:Number(r.amount_minor),currency:r.currency,digits:new Intl.NumberFormat('en',{style:'currency',currency:r.currency}).resolvedOptions().maximumFractionDigits??2}}));
 const route=await c.query('select h.payload from flight.route_history_snapshots h join flight.searches s on s.owner_id=h.owner_id join flight.jobs j on j.owner_id=s.owner_id and j.search_id=s.search_id and j.job_id=h.job_id where h.owner_id=$1 and h.job_id=$2 and h.query_fingerprint=s.fingerprint order by h.observed_at desc limit 1',[owner,rows[0].job_id]);
 const q:Search=rows[0].query;
 // Detail-click only: one bounded owner-scoped saved-quote read, never a provider request.
 const neighbors=await c.query("select o.payload as offer,s.query from flight.offers o join flight.jobs j using(owner_id,job_id) join flight.searches s using(owner_id,search_id) where o.owner_id=$1 and s.query->>'origin'=$2 and s.query->>'destination'=$3 and s.query->>'departure'>=($4::date-30)::text and s.query->>'departure'<=($4::date+30)::text and (s.query-'departure')=($5::jsonb-'departure') order by o.observed_at desc limit 500",[owner,q.origin,q.destination,q.departure,JSON.stringify(q)]);
 return {offer,history:history(offer,observations),date_prices:datePrices,route_history:route.rows[0]?.payload??null,departure_prices:savedDeparturePrices(neighbors.rows as SavedDateQuote[],q),departure_prices_scope:'latest_saved_capture_returned_candidates',departure_prices_scanned:neighbors.rows.length,coverage:'stored_cells_only'};
});}
export async function analyzeMeeting(owner:string,q:MeetingQuery){const [a,b]=await Promise.all([cachedOffers(owner,q.a),cachedOffers(owner,q.b)]);return {pairs:rendezvous(a,b,q.arrival_day,q.max_minutes,q.lock_a,{a:q.a,b:q.b}),a:rank(a,q.a),b:rank(b,q.b),source:'private_cache',paid_requests:0};}
export async function analyzeFlexible(owner:string,q:FlexibleQuery){
 const planned=datePairs(q.departure_from,q.departure_to,q.return_from,q.return_to),cells:CalendarCell[]=[],verified:Offer[]=[];
 if(q.base.traveler_baggage){
  const [{flexibleSourceQueries},{batchResults}]=await Promise.all([import('../domain/flexible-baggage'),import('../domain/batch-results')]);
  type Saved={owner_id:string;query:Search;payload?:Offer;status:string};
  const rows=await transaction('api',owner,async c=>{
   const params=[owner,q.base.origin,q.base.destination,q.departure_from,q.departure_to,q.return_from,q.return_to];
   const bounds="s.query->>'origin'=$2 and s.query->>'destination'=$3 and s.query->>'departure'>=$4 and s.query->>'departure'<=$5 and s.query->>'return_date'>=$6 and s.query->>'return_date'<=$7";
   const quotes=await c.query(`select o.owner_id,s.query,o.payload,j.status from flight.offers o join flight.jobs j using(owner_id,job_id) join flight.searches s using(owner_id,search_id) where o.owner_id=$1 and ${bounds} order by o.observed_at desc limit 500`,params);
   const queries=await c.query(`select s.owner_id,s.query,j.status from flight.searches s join flight.jobs j using(owner_id,search_id) where s.owner_id=$1 and j.phase='candidate_search' and j.status in ('succeeded','partial') and ${bounds} order by j.created_at desc limit 500`,params);
   return [...quotes.rows,...queries.rows] as Saved[];
  });
  const expected=new Map<string,{query:Search;participants:('a'|'b')[]}>();
  for(const pair of planned)for(const input of flexibleSourceQueries({...q.base,...pair})){
   if(input.participant==='dates')continue;const fingerprint=stableId(input.query),prior=expected.get(fingerprint);
   if(prior){if(!prior.participants.includes(input.participant))prior.participants.push(input.participant);}else expected.set(fingerprint,{query:input.query,participants:[input.participant]});
  }
  const known=new Map<string,{query:Search;participants:('a'|'b')[];offers:Offer[];searched:boolean}>();
  for(const row of rows){if(row.owner_id!==owner||!row.query)continue;const fingerprint=stableId(row.query),match=expected.get(fingerprint);if(!match)continue;
   const member=known.get(fingerprint)??{...match,offers:[],searched:false};if(row.payload)member.offers.push(row.payload);if(['succeeded','partial'].includes(row.status))member.searched=true;known.set(fingerprint,member);
  }
  const members=[...known.entries()];
  const plan:import('../domain/batch-contracts').BatchPlan={version:1,kind:'flexible',request:{...q,max_budget_microusd:500000,strategy:'exhaustive',max_pairs:3},queries:members.map(([fingerprint,m],ordinal)=>({ordinal,fingerprint,query:m.query,participants:m.participants,operations:['search','return']})),call_count:0,ceiling_microusd:0,coverage:{scope:'private_cache',requested_queries:planned.length,unique_queries:members.length,verification_branches_per_query:1}};
  const result=batchResults(plan,members.map(([,m],ordinal)=>({ordinal,status:m.searched?'succeeded':'partial',phase:'return',offers:m.offers,searched:m.searched})));
  if(result.kind!=='flexible')throw Error('INVALID_RANGE');
  return {...result,cells:planned.map(pair=>({...pair,state:'unknown' as const,money:null})),recommendations:[],coverage:{...result.coverage,planned:planned.length,searched:result.separate_traveler_cells.filter(c=>c.searched_a&&c.searched_b).length,verified:0},source:'private_cache' as const,paid_requests:0};
 }
 // One scoped read; a Cartesian grid must not generate an unbudgeted series of provider runs.
 const {offers,searched}=await transaction('api',owner,async c=>{
 const {rows}=await c.query("select o.payload from flight.offers o join flight.jobs j using(owner_id,job_id) join flight.searches s using(owner_id,search_id) where o.owner_id=$1 and s.query->>'origin'=$2 and s.query->>'destination'=$3 and s.query->>'departure'>=$4 and s.query->>'departure'<=$5 and (s.query-'departure'-'return_date')=($6::jsonb-'departure'-'return_date') order by o.observed_at desc limit 500",[owner,q.base.origin,q.base.destination,q.departure_from,q.departure_to,JSON.stringify(q.base)]);
 const {rows:queries}=await c.query("select s.query from flight.searches s join flight.jobs j using(owner_id,search_id) where s.owner_id=$1 and j.phase='candidate_search' and s.query->>'origin'=$2 and s.query->>'destination'=$3 and s.query->>'departure'>=$4 and s.query->>'departure'<=$5 and (s.query-'departure'-'return_date')=($6::jsonb-'departure'-'return_date')",[owner,q.base.origin,q.base.destination,q.departure_from,q.departure_to,JSON.stringify(q.base)]);
 return {offers:rows.map(r=>r.payload) as Offer[],searched:new Set(queries.map(r=>stableId(r.query)))};
 });
 for(const pair of planned){const matches=offers.filter(o=>o.segments.filter(s=>s.leg_index===0)[0]?.departure_local.slice(0,10)===pair.departure&&o.segments.filter(s=>s.leg_index===1)[0]?.departure_local.slice(0,10)===pair.return_date);
  const ranked=rank(matches,{...q.base,departure:pair.departure,return_date:pair.return_date}).confirmed.filter(o=>validStay({...o,segments:o.segments.filter(s=>s.leg_index===0)},{...o,segments:o.segments.filter(s=>s.leg_index===1)},q.min_nights,q.max_nights));
  const best=ranked[0];if(best)verified.push(best);
  cells.push({departure:pair.departure,return_date:pair.return_date,state:best?'verified':'unknown',money:best?.money??null,...(best?{offer_id:best.offer_id}:{})});
 }
 return {cells,recommendations:verified.sort((a,b)=>a.money.minor-b.money.minor).slice(0,5),coverage:{planned:planned.length,searched:planned.filter(pair=>searched.has(stableId({...q.base,departure:pair.departure,return_date:pair.return_date}))).length,verified:verified.length},source:'private_cache',paid_requests:0};
}
