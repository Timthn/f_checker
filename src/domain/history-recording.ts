import {Temporal} from '@js-temporal/polyfill';
import type {Observation, Offer, Search} from './contracts';
import {qualifies} from './rules';

export type RecordedObservation=Observation & {offer_id:string;itinerary_id:string;source:string;fare_identity:string};
const providerEvidence=(source:string)=>!!source.trim() && !/(synthetic|fixture|demo|test|unknown)/i.test(source);

// The caller supplies authenticated owner scope and performs the idempotent write.
// This reducer copies only compact quote provenance, never booking payloads/tokens.
export function eligibleObservation(offer:Offer, query:Search, now=new Date()):RecordedObservation|null {
  if(!providerEvidence(offer.source) || !offer.comparison_key?.trim() || !offer.fare_identity?.trim() || !offer.offer_id.trim() || !offer.itinerary_id.trim() || !offer.time_verified || qualifies(offer,query,now)!=='confirmed')return null;
  if(offer.duration_minutes===null || !Number.isFinite(offer.duration_minutes) || offer.duration_minutes<=0)return null;
  try {
    let previousArrival=-Infinity;
    for(const segment of offer.segments) {
      if(segment.leg_index!==0 && segment.leg_index!==1 || !segment.flight.trim() || !segment.departure_utc || !segment.arrival_utc || !segment.arrival_zone)return null;
      const departure=Temporal.Instant.from(segment.departure_utc).epochMilliseconds,arrival=Temporal.Instant.from(segment.arrival_utc).epochMilliseconds;
      if(arrival<=departure || departure<previousArrival)return null;
      Temporal.Instant.from(segment.arrival_utc).toZonedDateTimeISO(segment.arrival_zone);
      previousArrival=arrival;
    }
  } catch {return null;}
  const knownAllowance=(count:number|null,weight:number|null)=>count!==null && Number.isSafeInteger(count) && count>=0 && (count===0 || weight!==null && Number.isFinite(weight) && weight>0);
  for(let segment=0;segment<offer.segments.length;segment++) for(let passenger=0;passenger<query.adults;passenger++) {
    const evidence=offer.baggage.find(b=>b.segment===segment && b.passenger===passenger);
    if(!evidence || !knownAllowance(evidence.carry_on,evidence.carry_kg) || !knownAllowance(evidence.checked,evidence.checked_kg))return null;
  }
  if(offer.baggage.some(b=>!providerEvidence(b.source)))return null;
  return {offer_id:offer.offer_id,itinerary_id:offer.itinerary_id,comparison_key:offer.comparison_key,observed_at:new Date(offer.observed_at).toISOString(),minor:offer.money.minor,currency:offer.money.currency,fresh:true,source:offer.source,fare_identity:offer.fare_identity};
}
