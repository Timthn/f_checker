import { describe,it,expect } from 'vitest';
import {money,localToUtc,rank,history,rendezvous,closestGapAlternatives,datePairs,coverage,validStay,stableId} from '../src/domain/rules';
import {searchSchema, type Offer, type Search} from '../src/domain/contracts';
const query:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',adults:1,cabin:'economy',currency:'HKD',carry_on:1,checked:1};
const offer=(id='a',price=10000):Offer=>({offer_id:id,itinerary_id:id,comparison_key:'comparable',money:money(price/100,'HKD'),segments:[{leg_index:0,from:'HKG',to:'NRT',departure_local:'2026-11-10T09:00:00',arrival_local:'2026-11-10T14:00:00',departure_utc:'2026-11-10T01:00:00Z',arrival_utc:'2026-11-10T05:00:00Z',arrival_zone:'Asia/Tokyo',flight:id,cabin:'economy',duration:240}],baggage:[{segment:0,passenger:0,carry_on:1,checked:1,carry_kg:7,checked_kg:20,source:'synthetic_scoped_test_evidence',contradictory:false}],complete:true,price_complete:true,quoted_adults:1,duration_minutes:240,fare_identity:'test',source:'synthetic_test_only',observed_at:'2026-10-12T00:00:00Z',expires_at:'2026-10-13T00:00:00Z',time_verified:true});
describe('canonical business rules',()=>{
 it('canonical hashes survive JSONB key reordering and optional property insertion',()=>{expect(stableId({...query,return_date:'2026-11-17'})).toBe(stableId({return_date:'2026-11-17',...Object.fromEntries(Object.entries(query).reverse())}));expect(stableId({x:[{a:1,b:2}],z:undefined})).toBe(stableId({x:[{b:2,a:1}]}));});
 it('defers international date-line chronology to complete verified UTC',()=>{expect(searchSchema.safeParse({...query,origin:'AKL',destination:'HNL',departure:'2026-11-11',return_date:'2026-11-10'}).success).toBe(true);});
 it('rejects invalid dates and same airports',()=>{expect(searchSchema.safeParse({...query,departure:'2026-02-30'}).success).toBe(false);expect(searchSchema.safeParse({...query,destination:'HKG'}).success).toBe(false);});
 it('preserves exact decimal minor units and zero-digit currencies',()=>{expect(money('10.01','HKD').minor).toBe(1001);expect(money(101,'JPY').minor).toBe(101);expect(()=>money('1.001','HKD')).toThrow();});
 it('does not interpret naive times without verified semantics; rejects DST ambiguity',()=>{expect(localToUtc('2026-11-10T14:00:00','Asia/Tokyo',false)).toBeNull();expect(localToUtc('2026-11-01T01:30:00','America/New_York',true)).toBeNull();expect(localToUtc('2026-03-08T02:30:00','America/New_York',true)).toBeNull();expect(localToUtc('2026-11-10T14:00:00','Asia/Tokyo',true)).toBe('2026-11-10T05:00:00Z');});
 it('ranks at most ten unique complete same-currency offers and keeps unknown baggage separate',()=>{const os=Array.from({length:15},(_,i)=>offer(String(i),10000+i));const unknown=offer('unknown');unknown.baggage[0].checked=null;const partial=offer('partial');partial.complete=false;const foreign=offer('foreign');foreign.money=money(1,'USD');const r=rank([...os,os[0],unknown,partial,foreign],query,new Date("2026-10-12T01:00:00Z"));expect(r.confirmed).toHaveLength(10);expect(r.unknown.map(x=>x.offer_id)).toEqual(['unknown','partial']);});
 it('unknown segment or passenger allowances never qualify',()=>{const o=offer();expect(rank([o],{...query,adults:2},new Date("2026-10-12T01:00:00Z")).confirmed).toHaveLength(0);o.baggage[0].contradictory=true;expect(rank([o],query,new Date("2026-10-12T01:00:00Z")).unknown).toHaveLength(1);});
 it('keeps unknown or invalid bag counts unknown even when zero bags are requested',()=>{
  const zeroQuery={...query,carry_on:0,checked:0},now=new Date('2026-10-12T01:00:00Z'),o=offer();
  o.baggage[0]={...o.baggage[0],carry_on:0,checked:0,carry_kg:null,checked_kg:null};
  expect(rank([o],zeroQuery,now).confirmed).toHaveLength(1);
  for(const patch of [{carry_on:null},{checked:null},{carry_on:0.5},{checked:-1},{carry_on:NaN},{checked:Infinity}]) {
    const bad={...o,baggage:[{...o.baggage[0],...patch}]};
    expect(rank([bad],zeroQuery,now).unknown).toHaveLength(1);expect(rank([bad],zeroQuery,now).confirmed).toHaveLength(0);
    expect(rendezvous([bad],[o],'2026-11-10',30,undefined,{a:zeroQuery,b:zeroQuery},now)).toEqual([]);
  }
 });
 it('does not confirm requested bags with invalid weight evidence',()=>{
  for(const patch of [{carry_kg:NaN},{carry_kg:0},{carry_kg:-1},{checked_kg:Infinity},{checked_kg:0},{checked_kg:-1}]) {
    const o=offer();o.baggage[0]={...o.baggage[0],...patch};expect(rank([o],query,new Date('2026-10-12T01:00:00Z')).unknown).toHaveLength(1);
  }
 });
 it('uses daily medians, seven-day span and exact ±5% thresholds',()=>{const now=new Date('2026-10-12T01:00:00Z');const obs=[2,3,4,5,6,7,8,11].map(d=>({comparison_key:'comparable',observed_at:`2026-10-${String(d).padStart(2,'0')}T12:00:00Z`,minor:10000,currency:'HKD',fresh:true}));expect(history(offer('a',9500),obs,now).signal).toBe('low');expect(history(offer('a',10500),obs,now).signal).toBe('high');expect(history(offer(),obs.slice(0,3),now).signal).toBe('insufficient');expect(history({...offer(),comparison_key:null},obs,now).signal).toBe('insufficient');expect(history(offer(),obs.map(o=>({...o,fresh:false})),now).points).toEqual([]);});
 it('anchors history to the quote, excludes itself and future samples, and groups by UTC day',()=>{
  const o=offer(),sample=(observed_at:string,minor:number)=>({comparison_key:'comparable',observed_at,minor,currency:'HKD',fresh:true});
  const result=history(o,[sample('2026-09-12T00:00:00Z',8000),sample('2026-09-11T23:59:59Z',1),sample('2026-10-10T23:30:00-02:00',9000),sample('2026-10-11T14:00:00Z',11000),sample(o.observed_at,1),sample('2026-10-12T00:30:00Z',1)],new Date('2026-10-12T01:00:00Z'));
  expect(result.points).toEqual([{day:'2026-09-12',minor:8000},{day:'2026-10-11',minor:10000}]);expect(result.baseline).toBe(9000);
  expect(history(o,[sample('2026-09-12T00:00:00Z',8000)],new Date('2026-10-20T00:00:00Z')).points).toEqual([{day:'2026-09-12',minor:8000}]);
 });
 it('uses only price and gap for Pareto dominance and uses longest duration and IDs for ties',()=>{
  const a=offer('a'),cheap=offer('cheap',9000),fast=offer('fast',11000),dominated=offer('dominated',10000);
  cheap.segments[0].arrival_utc='2026-11-10T05:20:00Z';cheap.duration_minutes=500;
  fast.duration_minutes=50;dominated.segments[0].arrival_utc='2026-11-10T05:25:00Z';dominated.duration_minutes=40;
  const run=(bs:Offer[])=>rendezvous([a],bs,'2026-11-10',30,undefined,{a:query,b:query},new Date('2026-10-12T01:00:00Z'));
  expect(run([dominated,fast,cheap]).map(p=>p.b.offer_id)).toEqual(['cheap','fast']);
  const z={...offer('z'),duration_minutes:300},b={...offer('b'),duration_minutes:200},c={...offer('c'),duration_minutes:200};
  expect(run([z,c,b]).map(p=>p.b.offer_id)).toEqual(['b','c','z']);expect(run([b,z,c]).map(p=>p.b.offer_id)).toEqual(['b','c','z']);expect(run([b])[0].duration).toBe(240);
 });
 it('labels closest over-gap alternatives without relaxing day, lock, or verified qualification',()=>{
  const a=offer('a'),b=offer('b');b.segments[0].arrival_utc='2026-11-10T05:25:00Z';const now=new Date('2026-10-12T01:00:00Z');
  expect(rendezvous([a],[b],'2026-11-10',15,undefined,{a:query,b:query},now)).toEqual([]);
  expect(closestGapAlternatives([a],[b],'2026-11-10',15,undefined,{a:query,b:query},now)[0]).toMatchObject({gap:25,reason:'arrival_gap_exceeds_limit',required_max_minutes:25});
  expect(closestGapAlternatives([a],[b],'2026-11-10',30,undefined,{a:query,b:query},now)).toEqual([]);
  expect(closestGapAlternatives([a],[b],'2026-11-11',15,undefined,{a:query,b:query},now)).toEqual([]);
  expect(closestGapAlternatives([a],[b],'2026-11-10',15,'other',{a:query,b:query},now)).toEqual([]);
  expect(closestGapAlternatives([a],[{...b,time_verified:false}],'2026-11-10',15,undefined,{a:query,b:query},now)).toEqual([]);
 });
 it('matches by verified UTC, destination local day, currency and lock',()=>{const a=offer('a'),b=offer('b');b.segments[0].arrival_utc='2026-11-10T05:25:00Z';expect(rendezvous([a],[b],'2026-11-10',30,undefined,{a:query,b:query},new Date("2026-10-12T01:00:00Z"))).toHaveLength(1);expect(rendezvous([a],[b],'2026-11-10',15,undefined,{a:query,b:query},new Date("2026-10-12T01:00:00Z"))).toHaveLength(0);expect(rendezvous([a],[{...b,time_verified:false}],'2026-11-10',30,undefined,{a:query,b:query},new Date("2026-10-12T01:00:00Z"))).toHaveLength(0);expect(rendezvous([a],[b],'2026-11-10',30,'other',{a:query,b:query},new Date("2026-10-12T01:00:00Z"))).toHaveLength(0);});
 it('enumerates inclusive Cartesian dates and never promotes calendar coarse price',()=>{expect(datePairs('2026-11-09','2026-11-11','2026-11-17','2026-11-19')).toHaveLength(9);expect(()=>datePairs('2026-01-01','2026-12-31','2026-01-01','2026-12-31')).toThrow('QUOTA');expect(coverage([{departure:'2026-11-10',return_date:null,money:money(1,'HKD'),state:'coarse'}],9,'HKD',new Set()).minimum).toBeNull();});
 it('validates nights in destination timezone and UTC order',()=>{const a=offer(),b=offer();b.segments[0].departure_utc='2026-11-17T01:00:00Z';expect(validStay(a,b,7,7)).toBe(true);b.segments[0].departure_utc='2026-11-10T04:00:00Z';expect(validStay(a,b,0,0)).toBe(false);});
});
