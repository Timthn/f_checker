import {it,expect} from 'vitest';
import {referenceEligible,referenceMeeting,referenceNights,localClock} from '../src/domain/reference-recommendations';
import {batchResults} from '../src/domain/batch-results';
import {planBatch} from '../src/domain/batch-contracts';
import type {Offer,Search} from '../src/domain/contracts';
const now=new Date('2026-10-12T01:00:00Z');
const q:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:1,checked:1};
it('explains a requested arrival day outside the returned flight dates without changing that request',()=>{
 const m=planBatch('meeting',{a:q,b:{...q,origin:'SIN'},arrival_day:'2026-12-25',max_minutes:120,departure_scope:'fixed_departures'});
 const result=batchResults(m,m.queries.map(p=>({ordinal:p.ordinal,status:'partial',phase:'search',searched:true,offers:[offer(p.query,String(p.ordinal))]})),null,now);
 if(result.kind!=='meeting')throw Error();expect(result.arrival_day_mismatch).toBe(true);expect(result.arrival_days).toEqual({a:['2026-11-10'],b:['2026-11-10']});expect(result.reference_pairs).toEqual([]);expect(m.request).toMatchObject({arrival_day:'2026-12-25'});
});
function offer(query=q,id='a',clock='2026-11-10T14:00:00'):Offer{return {offer_id:id,itinerary_id:id,comparison_key:null,money:{minor:10000,currency:'HKD',digits:2},complete:true,price_complete:false,quoted_adults:null,time_verified:false,source:'synthetic_test',fare_identity:null,observed_at:'2026-10-12T00:59:00Z',expires_at:'2026-10-12T01:14:00Z',duration_minutes:240,baggage:[],quote_evidence:{state:'source_fields_matched',display_minor:10000,exact_minor:10000},segments:[{leg_index:0,from:query.origin,to:query.destination,departure_local:query.departure+'T09:00:00',arrival_local:clock,departure_utc:null,arrival_utc:null,arrival_zone:null,flight:id,cabin:'economy',duration:240},...(query.return_date?[{leg_index:1,from:query.destination,to:query.origin,departure_local:query.return_date+'T09:00:00',arrival_local:query.return_date+'T14:00:00',departure_utc:null,arrival_utc:null,arrival_zone:null,flight:id+'R',cabin:'economy' as const,duration:240}]:[])]};}
it('keeps unknown rights eligible only in fresh source references, excludes explicit incompatible evidence',()=>{
 const o=offer();expect(referenceEligible(o,q,now)).toBe(true);
 for(const bad of [{...o,expires_at:now.toISOString()},{...o,observed_at:'2026-10-13T00:00:00Z'},{...o,quote_evidence:undefined},{...o,complete:false},{...o,money:{...o.money,digits:0}},{...o,quoted_adults:2},{...o,baggage:[{segment:0,passenger:0,carry_on:0,checked:1,carry_kg:null,checked_kg:null,source:'test',contradictory:false}]}])expect(referenceEligible(bad,q,now)).toBe(false);
});
it('compares destination-local arrival days and approximate gaps, ranks cheap within gap and nearest outside',()=>{
 const a=offer(),b=offer({...q,origin:'SIN'},'b','2026-11-10T15:30:00'),c=offer({...q,origin:'SIN'},'c','2026-11-10T18:00:00');
 const r=referenceMeeting([a],[b,c],'2026-11-10',120);expect(r.reference_pairs[0]).toMatchObject({gap:90,total:20000,time_basis:'destination_local_assumption',zone:null});expect(r.reference_alternatives[0].gap).toBe(240);
 expect(referenceMeeting([a],[{...b,segments:[{...b.segments[0],arrival_local:'2026-11-11T00:00:00'}]}],'2026-11-10',360).reference_pairs).toEqual([]);
});
it('duplicate itinerary quotes retain the cheapest and large sides retain bounded top five',()=>{
 const cheap=offer(),expensive={...cheap,offer_id:'expensive',money:{...cheap.money,minor:20000}},b=offer({...q,origin:'SIN'},'b');
 expect(referenceMeeting([cheap,expensive],[b],'2026-11-10',120).reference_pairs[0].total).toBe(20000);
 const left=Array.from({length:500},(_,i)=>({...cheap,offer_id:`a${i}`,itinerary_id:`a${i}`,money:{...cheap.money,minor:10000+i}})),right=Array.from({length:500},(_,i)=>({...b,offer_id:`b${i}`,itinerary_id:`b${i}`,money:{...b.money,minor:10000+i}}));
 const result=referenceMeeting(left,right,'2026-11-10',120);expect(result.reference_pairs).toHaveLength(5);expect(result.reference_pairs[0].total).toBe(20000);expect(result.reference_alternatives).toHaveLength(0);
});
it('rejects malformed dates, offset clocks and leap seconds instead of guessing UTC/DST',()=>{
 for(const s of ['2026-02-30T12:00:00','2026-11-10T12:00:00Z','2026-11-10T12:00:00+09:00','2026-11-10T12:00:60','2026-11-10T24:00:00','12:00'])expect(localClock(s)).toBeNull();
 expect(localClock('2026-11-10T12:00:00')).not.toBeNull();
});
it('uses destination nights not origin date difference, rejects return before arrival',()=>{
 const o=offer({...q,return_date:'2026-11-17'},'r','2026-11-11T02:00:00');expect(referenceNights(o)).toBe(6);
 o.segments[1].departure_local='2026-11-10T23:00:00';expect(referenceNights(o)).toBeNull();
});
it('batch reference results never become strict meeting or flexible verification',()=>{
 const m=planBatch('meeting',{a:q,b:{...q,origin:'SIN'},arrival_day:'2026-11-10',max_minutes:120,departure_scope:'fixed_departures'});
 const result=batchResults(m,m.queries.map(p=>({ordinal:p.ordinal,status:'succeeded',phase:'search',searched:true,offers:[offer(p.query,String(p.ordinal))]})),null,now);
 if(result.kind!=='meeting')throw Error();expect(result.reference_pairs).toHaveLength(1);expect(result.pairs).toEqual([]);expect(result.coverage.query_constraints_verified).toBe(0);
 const f=planBatch('flexible',{base:q,departure_from:q.departure,departure_to:q.departure,return_from:'2026-11-17',return_to:'2026-11-17',min_nights:7,max_nights:7,strategy:'heuristic',max_pairs:1});
 const r=batchResults(f,[{ordinal:0,status:'succeeded',phase:'return',searched:true,offers:[offer(f.queries[0].query,'r')]}],null,now);
 if(r.kind!=='flexible')throw Error();expect(r.reference_recommendations).toHaveLength(1);expect(r.reference_cells[0].money?.minor).toBe(10000);expect(r.recommendations).toEqual([]);expect(r.cells[0].state).toBe('unknown');
});
