import {describe,it,expect} from 'vitest';
import round from '../docs/connectors/fixtures/apify-build-0.0.2/round-trip-search.json';
import one from '../docs/connectors/fixtures/apify-build-0.0.2/economy-one-way.json';
import back from '../docs/connectors/fixtures/apify-build-0.0.2/return-options.json';
import {planSearch,planReturn} from '../src/connectors/apify-chain';
import type {Search} from '../src/domain/contracts';
const q:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',return_date:'2026-11-17',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
function search(){const r=structuredClone(round.provider_response);return {...r,itineraries:r.itineraries.map((c,i)=>({...c,departure_token:`synthetic-departure-${i}`}))};}
function returns(){const r=structuredClone(back.provider_response);return {...r,itineraries:r.itineraries.map((c,i)=>({...c,booking_token:`synthetic-booking-${i}`}))};}
describe('bounded private Apify chain planning',()=>{
 it('excludes explicitly unpriced candidates without shifting private continuation tokens',()=>{
  const raw=search();const unpriced=structuredClone(raw.itineraries[0]);Object.assign(unpriced,{price:null,departure_token:'unpriced-token'});raw.itineraries.unshift(unpriced);
  const expected=planSearch(search(),q);const actual=planSearch(raw,q);
  expect(actual.offers.map(o=>o.money)).toEqual(expected.offers.map(o=>o.money));
  expect(actual.next?.token).toBe(expected.next?.token);expect(actual.next?.token).not.toBe('unpriced-token');
  const broken=search();Object.assign(broken.itineraries[0],{price:'123'});expect(()=>planSearch(broken,q)).toThrow('CHAIN_SCHEMA_CHANGED');
 });
 it('reconstructs all compatible return itineraries without booking or summed prices',()=>{
  const a=planSearch(search(),q);expect(a.next?.mode).toBe('return');expect(a.coverage).toEqual({returned:3,selected:1});
  const b=planReturn(back.provider_response,q,a.next!.selected,a.next!.outbound_duration_minutes);expect(b.next).toBeNull();expect(b.offers).toHaveLength(3);expect(b.offers[0].segments.map(s=>s.leg_index)).toEqual([0,1]);
  expect(b.offers.every(o=>o.complete&&!o.price_complete&&o.quoted_adults===null&&o.baggage.length===0)).toBe(true);
  expect(b.offers[0].duration_minutes).toBe(a.next!.outbound_duration_minutes!+back.provider_response.itineraries[0].legs[0].duration_minutes);
  expect(planReturn(back.provider_response,q,a.next!.selected).offers.every(o=>o.duration_minutes===null)).toBe(true);
  const invalid=structuredClone(back.provider_response);invalid.itineraries[0].legs[0].duration_minutes=1;expect(planReturn(invalid,q,a.next!.selected,a.next!.outbound_duration_minutes).offers[0].duration_minutes).toBeNull();
  expect(b.offers.map(o=>o.money.minor)).toEqual(back.provider_response.itineraries.map(o=>o.price*100));
 });
 it('one-way returns all compatible candidates without needing private tokens',()=>{
  const p=planSearch(one.provider_response,{...q,return_date:undefined});expect(p.next).toBeNull();expect(p.offers).toHaveLength(3);expect(p.coverage.selected).toBe(3);expect(JSON.stringify(p.offers)).not.toContain('token');
  const r=structuredClone(one.provider_response);r.itineraries[0].currency='USD';expect(planSearch(r,{...q,return_date:undefined}).offers).toHaveLength(2);
 });
 it('chooses cheapest compatible usable candidate, never cheaper wrong-currency or wrong-route',()=>{
  const r=search();r.itineraries[0].currency='USD';r.itineraries[1].price=2000;r.itineraries[2].price=3000;expect(planSearch(r,q).next?.token).toBe('synthetic-departure-1');
  r.itineraries[1].legs[0].segments[0].departure_airport='SIN';expect(planSearch(r,q).next?.token).toBe('synthetic-departure-2');
 });
 it('rejects redacted/missing tokens rather than reporting successful chain',()=>{
  expect(()=>planSearch(round.provider_response,q)).toThrow('CHAIN_REFERENCE_UNAVAILABLE');const r=search();r.itineraries.forEach(c=>c.departure_token='[REDACTED]');expect(()=>planSearch(r,q)).toThrow('CHAIN_REFERENCE_UNAVAILABLE');
  expect(planReturn(back.provider_response,q,planSearch(search(),q).next!.selected).next).toBeNull();
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
