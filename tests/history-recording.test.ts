import {describe,it,expect} from 'vitest';
import type {Offer,Search} from '../src/domain/contracts';
import {eligibleObservation} from '../src/domain/history-recording';
const query:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',adults:1,cabin:'economy',currency:'HKD',carry_on:1,checked:1};
const now=new Date('2026-10-12T01:00:00Z');
const quote=():Offer=>({offer_id:'quote-1',itinerary_id:'trip-1',comparison_key:'verified-comparison-key',money:{minor:10000,currency:'HKD',digits:2},segments:[{leg_index:0,from:'HKG',to:'NRT',departure_local:'2026-11-10T09:00:00',arrival_local:'2026-11-10T14:00:00',departure_utc:'2026-11-10T01:00:00Z',arrival_utc:'2026-11-10T05:00:00Z',arrival_zone:'Asia/Tokyo',flight:'CX500',cabin:'economy',duration:240}],baggage:[{segment:0,passenger:0,carry_on:1,checked:1,carry_kg:7,checked_kg:20,source:'apify/build0.0.2/booking',contradictory:false}],complete:true,price_complete:true,quoted_adults:1,duration_minutes:240,fare_identity:'fare-and-rights',source:'apify/build0.0.2/booking',observed_at:'2026-10-12T00:00:00+00:00',expires_at:'2026-10-13T00:00:00Z',time_verified:true});
describe('comparable quote recording eligibility',()=>{
 it('returns normalized provenance without private provider payload or mutation',()=>{
  const o=Object.assign(quote(),{booking_token:'private-token',booking_payload:{private:true},owner_id:'private-owner'}),before=JSON.stringify(o);
  expect(eligibleObservation(o,query,now)).toEqual({offer_id:'quote-1',itinerary_id:'trip-1',comparison_key:'verified-comparison-key',observed_at:'2026-10-12T00:00:00.000Z',minor:10000,currency:'HKD',fresh:true,source:'apify/build0.0.2/booking',fare_identity:'fare-and-rights'});
  expect(JSON.stringify(o)).toBe(before);
 });
 it.each(['synthetic_qa','synthetic_test_only','fixture','apify/fixture','demo','unknown',''])('rejects non-provider source %s',source=>{expect(eligibleObservation({...quote(),source},query,now)).toBeNull();});
 it.each([{comparison_key:null},{comparison_key:''},{fare_identity:null},{price_complete:false},{complete:false},{quoted_adults:null},{time_verified:false},{observed_at:'invalid'},{expires_at:'invalid'},{observed_at:'2026-10-12T02:00:00Z'},{observed_at:'2026-10-10T00:00:00Z'},{expires_at:'2026-10-12T00:30:00Z'}])('rejects missing, unverified or stale quote evidence %j',patch=>{expect(eligibleObservation({...quote(),...patch},query,now)).toBeNull();});
 it('requires every segment and passenger baggage, matching query and usable UTC',()=>{
  const o=quote();o.baggage[0].checked=null;expect(eligibleObservation(o,query,now)).toBeNull();
  expect(eligibleObservation(quote(),{...query,adults:2},now)).toBeNull();expect(eligibleObservation(quote(),{...query,return_date:'2026-11-17'},now)).toBeNull();
  const bad=quote();bad.segments[0].arrival_utc=null;expect(eligibleObservation(bad,query,now)).toBeNull();
  const reverse=quote();reverse.segments[0].arrival_utc='2026-11-10T00:00:00Z';expect(eligibleObservation(reverse,query,now)).toBeNull();
  const fake=quote();fake.baggage[0].source='synthetic_qa';expect(eligibleObservation(fake,query,now)).toBeNull();
  expect(eligibleObservation({...quote(),money:{minor:NaN,currency:'HKD',digits:2}},query,now)).toBeNull();
 });
 it('allows explicit zero baggage without weights but rejects unknown counts at zero filters',()=>{
  const zeroQuery={...query,carry_on:0,checked:0},o=quote();
  o.baggage[0]={...o.baggage[0],carry_on:0,checked:0,carry_kg:null,checked_kg:null};
  expect(eligibleObservation(o,zeroQuery,now)).not.toBeNull();
  expect(eligibleObservation({...o,baggage:[{...o.baggage[0],carry_on:null}]},zeroQuery,now)).toBeNull();
  expect(eligibleObservation({...o,baggage:[{...o.baggage[0],checked:null}]},zeroQuery,now)).toBeNull();
 });
 it.each([
  {carry_on:-1},{carry_on:0.5},{carry_on:NaN},{checked:Infinity},{checked:Number.MAX_SAFE_INTEGER+1},
  {carry_on:1,carry_kg:null},{carry_on:1,carry_kg:0},{carry_on:1,carry_kg:NaN},
  {checked:1,checked_kg:null},{checked:1,checked_kg:-1},{checked:1,checked_kg:Infinity},
 ])('requires known integer counts and positive finite weights for included bags %j',patch=>{
  const o=quote();o.baggage[0]={...o.baggage[0],carry_on:0,checked:0,carry_kg:null,checked_kg:null,...patch};
  expect(eligibleObservation(o,{...query,carry_on:0,checked:0},now)).toBeNull();
 });
});
