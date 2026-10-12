import { transaction } from './db';
import { datePairs,rank,rendezvous,validStay,history,stableId } from '../domain/rules';
import type { Offer,Search,Observation,CalendarCell } from '../domain/contracts';
import type { MeetingQuery,FlexibleQuery } from '../domain/analysis-contracts';
export async function cachedOffers(owner:string,query:Search):Promise<Offer[]>{return transaction('api',owner,async c=>{
 const {rows}=await c.query('select o.payload from flight.offers o join flight.jobs j using(owner_id,job_id) join flight.searches s using(owner_id,search_id) where o.owner_id=$1 and s.fingerprint=$2 order by o.observed_at desc limit 500',[owner,stableId(query)]);
 return rows.map(r=>r.payload);
});}
export async function jobResults(owner:string,id:string){return transaction('api',owner,async c=>{
 const {rows}=await c.query('select j.status,s.query from flight.jobs j join flight.searches s using(owner_id,search_id) where j.owner_id=$1 and j.job_id=$2',[owner,id]);if(!rows[0])return null;
 const {rows:offers}=await c.query('select payload from flight.offers where owner_id=$1 and job_id=$2 order by observed_at desc limit 500',[owner,id]);
 const candidates:Offer[]=offers.map(r=>r.payload),ranked=rank(candidates,rows[0].query);
 return {job_id:id,status:rows[0].status,query:rows[0].query,...ranked,source_count:candidates.length,coverage:'returned_candidates_only'};
});}
export async function offerDetails(owner:string,id:string){return transaction('api',owner,async c=>{
 const {rows}=await c.query('select payload,job_id from flight.offers where owner_id=$1 and offer_id=$2',[owner,id]);if(!rows[0])return null;
 const offer:Offer=rows[0].payload;
 const {rows:obs}=offer.comparison_key?await c.query('select comparison_key,observed_at,amount_minor,currency,fresh from flight.observations where owner_id=$1 and comparison_key=$2 and observed_at >= $3::timestamptz-interval \'30 days\' and observed_at < $3::timestamptz',[owner,offer.comparison_key,offer.observed_at]):{rows:[]};
 const observations:Observation[]=obs.map(r=>({...r,observed_at:r.observed_at.toISOString(),minor:Number(r.amount_minor)}));
 // Calendar is a separate provider product. Missing rows are not synthesized as cheap dates.
 const departure=offer.segments.find(s=>s.leg_index===0)?.departure_local.slice(0,10);
 const {rows:dates}=departure?await c.query('select departure::text,return_key,state,amount_minor,currency,offer_id from flight.calendar_cells where owner_id=$1 and job_id=$2 and departure between $3::date-30 and $3::date+30 order by departure',[owner,rows[0].job_id,departure]):{rows:[]};
 const datePrices:CalendarCell[]=dates.map(r=>({departure:r.departure,return_date:r.return_key||null,state:r.state,offer_id:r.offer_id,money:r.amount_minor===null?null:{minor:Number(r.amount_minor),currency:r.currency,digits:new Intl.NumberFormat('en',{style:'currency',currency:r.currency}).resolvedOptions().maximumFractionDigits??2}}));
 return {offer,history:history(offer,observations),date_prices:datePrices,coverage:'stored_cells_only'};
});}
export async function analyzeMeeting(owner:string,q:MeetingQuery){const [a,b]=await Promise.all([cachedOffers(owner,q.a),cachedOffers(owner,q.b)]);return {pairs:rendezvous(a,b,q.arrival_day,q.max_minutes,q.lock_a,{a:q.a,b:q.b}),a:rank(a,q.a),b:rank(b,q.b),source:'private_cache',paid_requests:0};}
export async function analyzeFlexible(owner:string,q:FlexibleQuery){
 const planned=datePairs(q.departure_from,q.departure_to,q.return_from,q.return_to),cells:CalendarCell[]=[],verified:Offer[]=[];
 // One scoped read; a Cartesian grid must not generate an unbudgeted series of provider runs.
 const {offers,searched}=await transaction('api',owner,async c=>{
 const {rows}=await c.query('select o.payload from flight.offers o join flight.jobs j using(owner_id,job_id) join flight.searches s using(owner_id,search_id) where o.owner_id=$1 and s.query->>\'origin\'=$2 and s.query->>\'destination\'=$3 and s.query->>\'departure\'>=$4 and s.query->>\'departure\'<=$5 order by o.observed_at desc limit 500',[owner,q.base.origin,q.base.destination,q.departure_from,q.departure_to]);
 const {rows:queries}=await c.query("select s.query from flight.searches s join flight.jobs j using(owner_id,search_id) where s.owner_id=$1 and j.phase='candidate_search' and s.query->>'origin'=$2 and s.query->>'destination'=$3 and s.query->>'departure'>=$4 and s.query->>'departure'<=$5",[owner,q.base.origin,q.base.destination,q.departure_from,q.departure_to]);
 return {offers:rows.map(r=>r.payload) as Offer[],searched:new Set(queries.map(r=>stableId(r.query)))};
 });
 for(const pair of planned){const matches=offers.filter(o=>o.segments.filter(s=>s.leg_index===0)[0]?.departure_local.slice(0,10)===pair.departure&&o.segments.filter(s=>s.leg_index===1)[0]?.departure_local.slice(0,10)===pair.return_date);
  const ranked=rank(matches,{...q.base,departure:pair.departure,return_date:pair.return_date}).confirmed.filter(o=>validStay({...o,segments:o.segments.filter(s=>s.leg_index===0)},{...o,segments:o.segments.filter(s=>s.leg_index===1)},q.min_nights,q.max_nights));
  const best=ranked[0];if(best)verified.push(best);
  cells.push({departure:pair.departure,return_date:pair.return_date,state:best?'verified':'unknown',money:best?.money??null,...(best?{offer_id:best.offer_id}:{})});
 }
 return {cells,recommendations:verified.sort((a,b)=>a.money.minor-b.money.minor).slice(0,5),coverage:{planned:planned.length,searched:planned.filter(pair=>searched.has(stableId({...q.base,departure:pair.departure,return_date:pair.return_date}))).length,verified:verified.length},source:'private_cache',paid_requests:0};
}
