import {describe,it,expect} from 'vitest';
import round from '../docs/connectors/fixtures/apify-build-0.0.2/round-trip-search.json';
import one from '../docs/connectors/fixtures/apify-build-0.0.2/economy-one-way.json';
import back from '../docs/connectors/fixtures/apify-build-0.0.2/return-options.json';
import booking from '../docs/connectors/fixtures/apify-build-0.0.2/round-trip-booking.json';
import {planSearch,planReturn} from '../src/connectors/apify-chain';
import {parseBooking} from '../src/connectors/apify-adapter';
import type {Search} from '../src/domain/contracts';
const q:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',return_date:'2026-11-17',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
function search(){const r=structuredClone(round.provider_response);return {...r,itineraries:r.itineraries.map((c,i)=>({...c,departure_token:`synthetic-departure-${i}`}))};}
function returns(){const r=structuredClone(back.provider_response);return {...r,itineraries:r.itineraries.map((c,i)=>({...c,booking_token:`synthetic-booking-${i}`}))};}
describe('bounded private Apify chain planning',()=>{
 it('preserves outbound context through return and obtains whole booking price without summing',()=>{
  const a=planSearch(search(),q);expect(a.next?.mode).toBe('return');expect(a.coverage).toEqual({returned:3,selected:1});
  const b=planReturn(returns(),q,a.next!.selected);expect(b.next?.selected.map(s=>s.leg_index)).toEqual([0,1]);
  const offers=parseBooking(booking.provider_response,q,b.next!.selected);expect(offers[0].money.minor).toBe(228900);expect(offers[0].complete).toBe(true);
  expect(offers[0].price_complete).toBe(false);expect(offers[0].baggage).toEqual([]);expect(offers[0].quoted_adults).toBeNull();expect(offers[0].time_verified).toBe(false);
  expect(b.offers.every(o=>!o.complete&&!o.price_complete)).toBe(true);
 });
 it('uses booking token directly for one-way and keeps tokens out of public offers',()=>{
  const r={...structuredClone(one.provider_response),itineraries:one.provider_response.itineraries.map(c=>({...c,booking_token:'synthetic-oneway-secret'}))};
  const p=planSearch(r,{...q,return_date:undefined});expect(p.next?.mode).toBe('booking');expect(JSON.stringify(p.offers)).not.toContain('synthetic-oneway-secret');expect(JSON.stringify(p.offers)).not.toContain('token');
 });
 it('chooses cheapest compatible usable candidate, never cheaper wrong-currency or wrong-route',()=>{
  const r=search();r.itineraries[0].currency='USD';r.itineraries[1].price=2000;r.itineraries[2].price=3000;expect(planSearch(r,q).next?.token).toBe('synthetic-departure-1');
  r.itineraries[1].legs[0].segments[0].departure_airport='SIN';expect(planSearch(r,q).next?.token).toBe('synthetic-departure-2');
 });
 it('rejects redacted/missing tokens rather than reporting successful chain',()=>{
  expect(()=>planSearch(round.provider_response,q)).toThrow('CHAIN_REFERENCE_UNAVAILABLE');const r=search();r.itineraries.forEach(c=>c.departure_token='[REDACTED]');expect(()=>planSearch(r,q)).toThrow('CHAIN_REFERENCE_UNAVAILABLE');
  expect(()=>planReturn(back.provider_response,q,planSearch(search(),q).next!.selected)).toThrow('CHAIN_REFERENCE_UNAVAILABLE');
 });
 it('allows genuine empty response with explicit zero selected coverage',()=>{const r={...search(),itineraries:[]};expect(planSearch(r,q)).toEqual({offers:[],next:null,coverage:{returned:0,selected:0}});});
 it('rejects mismatched top mode/trip/currency/date/passenger and search echo',()=>{
  for(const mutation of [{mode:'return'},{trip_type:'one_way'},{currency:'USD'},{departure_date:'2026-11-11'},{adults:2},{input:{...search().input,checked_bags:1}}])expect(()=>planSearch({...search(),...mutation},q)).toThrow('CHAIN_CONTEXT_MISMATCH');
 });
 it('rejects spoofed candidate route/date/cabin and return context',()=>{
  for(const key of ['departure_airport','departure_time','cabin_class'] as const){const r=search();r.itineraries.forEach(c=>{c.legs[0].segments[0][key]=key==='departure_airport'?'SIN':key==='departure_time'?'2026-11-11T14:00:00':'business';});expect(()=>planSearch(r,q)).toThrow('CHAIN_CONTEXT_MISMATCH');}
  const selected=planSearch(search(),q).next!.selected;
  expect(()=>planReturn(returns(),q,selected.map(s=>({...s,from:'SIN'})))).toThrow('CHAIN_CONTEXT_MISMATCH');
  expect(()=>planReturn({...returns(),return_date:'2026-11-18'},q,selected)).toThrow('CHAIN_CONTEXT_MISMATCH');
  const r=returns();r.itineraries.forEach(c=>c.legs[0].segments[0].departure_time='2026-11-18T08:15:00');expect(()=>planReturn(r,q,selected)).toThrow('CHAIN_CONTEXT_MISMATCH');
 });
 it('rejects malformed private schema with safe non-payload error',()=>{expect(()=>planSearch({mode:'secret-token'},q)).toThrow('CHAIN_SCHEMA_CHANGED');});
});
