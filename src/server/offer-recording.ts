import type {PoolClient} from 'pg';
import type {Offer,Search} from '../domain/contracts';
import {eligibleObservation} from '../domain/history-recording';

const safeFacilityText=(v:unknown,max:number):string|undefined=>{
 if(typeof v!=='string')return;const text=v.trim();
 if(!text||text.length>max||!(/^[\p{L}\p{N} .,()'’+%&–—-]+$/u).test(text)||/(?:https?|www|token|secret|password|bearer|api.?key)|[A-Za-z0-9_-]{32,}/i.test(text))return;
 return text;
};
const facilityMetadata=(s:Offer['segments'][number])=>{
 const aircraft=safeFacilityText(s.aircraft,80),legroom=safeFacilityText(s.legroom,40);
 const amenities=Array.isArray(s.amenities)?[...new Set(s.amenities.slice(0,40).map(v=>safeFacilityText(v,160)).filter((v):v is string=>!!v&&/wi[ -]?fi|wireless|power|usb|meal|food|entertainment|seat|legroom|腿部|座椅|餐食|娱乐|電源|电源|无线/i.test(v)))].slice(0,8):[];
 return {...(aircraft?{aircraft}:{}),...(legroom?{legroom}:{}),...(amenities.length?{amenities}:{})};
};
// Caller owns the job/lease lock. Offer and eligible observation commit together.
export async function recordOffer(c:PoolClient,owner:string,jobId:string,resultKey:string,offer:Offer,query:Search){
 const originalEvidence=offer.quote_evidence;
 // Persist only the internal contract, even if a future adapter attaches raw fields.
 offer={offer_id:offer.offer_id,itinerary_id:offer.itinerary_id,comparison_key:offer.comparison_key,money:{minor:offer.money.minor,currency:offer.money.currency,digits:offer.money.digits},segments:offer.segments.map(s=>({...facilityMetadata(s),leg_index:s.leg_index,from:s.from,to:s.to,departure_local:s.departure_local,arrival_local:s.arrival_local,departure_utc:s.departure_utc,arrival_utc:s.arrival_utc,arrival_zone:s.arrival_zone,flight:s.flight,cabin:s.cabin,duration:s.duration,...(typeof s.airline==='string'&&s.airline.trim().length>0&&s.airline.length<=120?{airline:s.airline.trim()}:{}),...(typeof s.airline_code==='string'&&/^[A-Z0-9]{2}$/.test(s.airline_code)?{airline_code:s.airline_code}:{})})),baggage:offer.baggage.map(b=>({segment:b.segment,passenger:b.passenger,carry_on:b.carry_on,checked:b.checked,carry_kg:b.carry_kg,checked_kg:b.checked_kg,source:b.source,contradictory:b.contradictory})),complete:offer.complete,price_complete:offer.price_complete,quoted_adults:offer.quoted_adults,duration_minutes:offer.duration_minutes,fare_identity:offer.fare_identity,source:offer.source,observed_at:offer.observed_at,expires_at:offer.expires_at,time_verified:offer.time_verified};
 if(originalEvidence)offer.quote_evidence={state:originalEvidence.state,display_minor:originalEvidence.display_minor,exact_minor:originalEvidence.exact_minor};
 const inserted=await c.query('insert into flight.offers(owner_id,offer_id,job_id,itinerary_id,comparison_key,provider_result_key,observed_at,expires_at,payload) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(owner_id,job_id,provider_result_key) do nothing returning offer_id',[owner,offer.offer_id,jobId,offer.itinerary_id,offer.comparison_key,resultKey,offer.observed_at,offer.expires_at,offer]);
 if(!inserted.rows.length)return {inserted:false,sampled:false};
 const observation=eligibleObservation(offer,query);
 if(observation)await c.query('insert into flight.observations(owner_id,offer_id,comparison_key,observed_at,amount_minor,currency,fresh) values($1,$2,$3,$4,$5,$6,true) on conflict(owner_id,offer_id) do nothing',[owner,observation.offer_id,observation.comparison_key,observation.observed_at,observation.minor,observation.currency]);
 return {inserted:true,sampled:!!observation};
}
