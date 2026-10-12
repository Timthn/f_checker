import type {PoolClient} from 'pg';
import type {Offer,Search} from '../domain/contracts';
import {eligibleObservation} from '../domain/history-recording';

// Caller owns the job/lease lock. Offer and eligible observation commit together.
export async function recordOffer(c:PoolClient,owner:string,jobId:string,resultKey:string,offer:Offer,query:Search){
 // Persist only the internal contract, even if a future adapter attaches raw fields.
 offer={offer_id:offer.offer_id,itinerary_id:offer.itinerary_id,comparison_key:offer.comparison_key,money:{minor:offer.money.minor,currency:offer.money.currency,digits:offer.money.digits},segments:offer.segments.map(s=>({leg_index:s.leg_index,from:s.from,to:s.to,departure_local:s.departure_local,arrival_local:s.arrival_local,departure_utc:s.departure_utc,arrival_utc:s.arrival_utc,arrival_zone:s.arrival_zone,flight:s.flight,cabin:s.cabin,duration:s.duration})),baggage:offer.baggage.map(b=>({segment:b.segment,passenger:b.passenger,carry_on:b.carry_on,checked:b.checked,carry_kg:b.carry_kg,checked_kg:b.checked_kg,source:b.source,contradictory:b.contradictory})),complete:offer.complete,price_complete:offer.price_complete,quoted_adults:offer.quoted_adults,duration_minutes:offer.duration_minutes,fare_identity:offer.fare_identity,source:offer.source,observed_at:offer.observed_at,expires_at:offer.expires_at,time_verified:offer.time_verified};
 const inserted=await c.query('insert into flight.offers(owner_id,offer_id,job_id,itinerary_id,comparison_key,provider_result_key,observed_at,expires_at,payload) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(owner_id,job_id,provider_result_key) do nothing returning offer_id',[owner,offer.offer_id,jobId,offer.itinerary_id,offer.comparison_key,resultKey,offer.observed_at,offer.expires_at,offer]);
 if(!inserted.rows.length)return {inserted:false,sampled:false};
 const observation=eligibleObservation(offer,query);
 if(observation)await c.query('insert into flight.observations(owner_id,offer_id,comparison_key,observed_at,amount_minor,currency,fresh) values($1,$2,$3,$4,$5,$6,true) on conflict(owner_id,offer_id) do nothing',[owner,observation.offer_id,observation.comparison_key,observation.observed_at,observation.minor,observation.currency]);
 return {inserted:true,sampled:!!observation};
}
