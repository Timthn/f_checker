import {it,expect} from 'vitest';
import {batchResults,type BatchResultItem} from '../src/domain/batch-results';
import {planBatch} from '../src/domain/batch-contracts';
import type {Offer,Search} from '../src/domain/contracts';
import {rendezvousFrontier} from '../src/domain/rules';
const now=new Date('2026-10-12T01:00:00Z');
const base:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
function offer(q:Search,id:string,arrival='2026-11-10T05:00:00Z'):Offer{
 const segments=[{leg_index:0,from:q.origin,to:q.destination,departure_local:q.departure+'T09:00:00',arrival_local:'2026-11-10T14:00:00',departure_utc:q.departure+'T01:00:00Z',arrival_utc:arrival,arrival_zone:'Asia/Tokyo',flight:id,cabin:'economy',duration:240}];
 if(q.return_date)segments.push({leg_index:1,from:q.destination,to:q.origin,departure_local:q.return_date+'T09:00:00',arrival_local:q.return_date+'T14:00:00',departure_utc:q.return_date+'T00:00:00Z',arrival_utc:q.return_date+'T06:00:00Z',arrival_zone:'Asia/Hong_Kong',flight:id+'R',cabin:'economy',duration:360});
 return {offer_id:id,itinerary_id:id,comparison_key:null,money:{minor:10000,currency:'HKD',digits:2},segments,baggage:segments.map((_,segment)=>({segment,passenger:0,carry_on:0,checked:0,carry_kg:null,checked_kg:null,source:'synthetic_test',contradictory:false})),complete:true,price_complete:true,quoted_adults:1,duration_minutes:600,fare_identity:null,source:'synthetic_test',observed_at:'2026-10-12T00:00:00Z',expires_at:'2026-10-12T02:00:00Z',time_verified:true};
}
const meeting={a:base,b:{...base,origin:'SIN'},arrival_day:'2026-11-10',max_minutes:15 as const,max_budget_microusd:400000};
it('matches admission dates instead of form placeholders; ignores unrelated ordinals',()=>{
 const p=planBatch('meeting',meeting),items:BatchResultItem[]=[{ordinal:0,status:'partial',phase:'candidate_search',searched:true,offers:[offer(p.queries[0].query,'a')]},{ordinal:4,status:'partial',phase:'booking',searched:true,offers:[offer(p.queries[4].query,'b')]},{ordinal:99,status:'partial',phase:'booking',searched:true,offers:[offer(base,'extra')]}];
 const r=batchResults(p,items,null,now);expect(r.kind).toBe('meeting');if(r.kind!=='meeting')return;
 expect(r.pairs.map(x=>[x.a.offer_id,x.b.offer_id])).toEqual([['a','b']]);expect(r.coverage.searched).toBe(2);expect(r.coverage.admitted).toBe(6);expect(r.coverage.verification_branches_per_query).toBe(1);
});
it('keeps over-gap alternatives separate and unknown time out of recommendations',()=>{
 const p=planBatch('meeting',{...meeting,departure_scope:'fixed_departures'}),a=offer(base,'a'),b=offer(p.queries[1].query,'b','2026-11-10T05:25:00Z');
 const run=(o:Offer)=>batchResults(p,[{ordinal:0,status:'partial',phase:'booking',searched:true,offers:[a]},{ordinal:1,status:'partial',phase:'booking',searched:true,offers:[o]}],null,now);
 const r=run(b);if(r.kind!=='meeting')throw Error();expect(r.pairs).toEqual([]);expect(r.alternatives[0].required_max_minutes).toBe(25);
 const bad=run({...b,time_verified:false});if(bad.kind!=='meeting')throw Error();expect(bad.alternatives).toEqual([]);
});
it('revalidates locked A expiry while B is running, with no A child',()=>{
 const id='00000000-0000-4000-8000-000000000001',p=planBatch('meeting',{...meeting,departure_scope:'fixed_departures',lock_a:id},true),b=offer(p.queries[0].query,'b');
 const items=[{ordinal:0,status:'partial',phase:'booking',searched:true,offers:[b]}],a=offer(base,id);
 const run=(locked:Offer|null)=>batchResults(p,items,locked,now);
 expect(run(a).kind==='meeting'&&(run(a) as any).pairs.length).toBe(1);
 for(const locked of [null,{...a,expires_at:now.toISOString()},{...a,segments:[{...a.segments[0],departure_local:'2026-11-09T09:00:00'}]}]){const r=run(locked);if(r.kind!=='meeting')throw Error();expect(r.pairs).toEqual([]);}
});
it('reports failed and unknown grid cells independently of full quote/night verification',()=>{
 const p=planBatch('flexible',{base,departure_from:'2026-11-10',departure_to:'2026-11-11',return_from:'2026-11-17',return_to:'2026-11-17',min_nights:7,max_nights:7,max_budget_microusd:200000});
 const r=batchResults(p,[{ordinal:0,status:'partial',phase:'booking',searched:true,offers:[offer(p.queries[0].query,'valid')]},{ordinal:1,status:'failed',phase:'queued',offers:[]}],null,now);
 if(r.kind!=='flexible')throw Error();expect(r.cells.map(c=>c.state)).toEqual(['verified','failed']);expect(r.coverage.verified_cells).toBe(1);expect(r.recommendations[0].nights).toBe(7);
 const bad=batchResults(p,[{ordinal:0,status:'partial',phase:'candidate_search',searched:true,offers:[{...offer(p.queries[0].query,'partial'),price_complete:false}]}],null,now);if(bad.kind!=='flexible')throw Error();expect(bad.recommendations).toEqual([]);expect(bad.coverage.searched).toBe(1);
});
it('rejects invalid timezone evidence without crashing a complete batch',()=>{
 const p=planBatch('flexible',{base,departure_from:base.departure,departure_to:base.departure,return_from:'2026-11-17',return_to:'2026-11-17',min_nights:0,max_nights:10});const o=offer(p.queries[0].query,'bad');o.segments[0].arrival_zone='invalid';
 const r=batchResults(p,[{ordinal:0,status:'partial',phase:'booking',searched:true,offers:[o]}],null,now);if(r.kind!=='flexible')throw Error();expect(r.cells[0].state).toBe('unknown');expect(r.recommendations).toEqual([]);
});
it('keeps the sixth local frontier point until global dominance is evaluated',()=>{
 const a=offer(base,'a'),b=offer(base,'b');
 const local=Array.from({length:6},(_,i)=>({a,b:{...b,offer_id:String(i)},total:100+i,gap:60-i*10,duration:600}));
 const retained=rendezvousFrontier(local,Infinity);expect(retained).toHaveLength(6);
 const global=rendezvousFrontier([...retained,{a,b:{...b,offer_id:'other'},total:99,gap:20,duration:600}]);
 expect(global.map(p=>p.b.offer_id)).toEqual(['other','5']);
});
it('keeps searched evidence after suspension and names quote-only constraints separately',()=>{
 const p=planBatch('flexible',{base,departure_from:base.departure,departure_to:base.departure,return_from:'2026-11-17',return_to:'2026-11-17',min_nights:0,max_nights:10});
 const o={...offer(p.queries[0].query,'unverified-time'),time_verified:false};
 const r=batchResults(p,[{ordinal:0,status:'partial',phase:'needs_attention',searched:true,offers:[o]}],null,now);
 if(r.kind!=='flexible')throw Error();expect(r.coverage).toMatchObject({searched:1,query_constraints_verified:1,verified_cells:0});expect(r.cells[0].state).toBe('unknown');
});
it('retains unverified member candidates independently of confirmed meeting recommendations',()=>{
 const p=planBatch('meeting',{...meeting,departure_scope:'fixed_departures'});
 const unknown={...offer(p.queries[0].query,'unknown'),price_complete:false,time_verified:false,quoted_adults:null,baggage:[]};
 const r=batchResults(p,[{ordinal:0,status:'partial',phase:'search',offers:[unknown]},{ordinal:99,status:'partial',phase:'search',offers:[offer(base,'unrelated')]}],null,now);
 if(r.kind!=='meeting')throw Error();expect(r.pairs).toEqual([]);expect(r.source_candidates[0].offers.map(o=>o.offer_id)).toEqual(['unknown']);expect(r.source_candidates.flatMap(g=>g.offers).some(o=>o.offer_id==='unrelated')).toBe(false);
});
it('source candidates validate route/currency/money/outbound context without promoting unknown flexible cells',()=>{
 const p=planBatch('flexible',{base,departure_from:base.departure,departure_to:base.departure,return_from:'2026-11-17',return_to:'2026-11-17',min_nights:0,max_nights:10});
 const good={...offer(p.queries[0].query,'unknown'),price_complete:false,time_verified:false};
 const bad=[{...good,offer_id:'foreign',money:{...good.money,currency:'USD'}},{...good,offer_id:'zero',money:{...good.money,minor:0}},{...good,offer_id:'empty',segments:[]},{...good,offer_id:'route',segments:good.segments.map(s=>({...s,from:'SIN'}))},{...good,offer_id:'digits',money:{...good.money,digits:0}}];
 const r=batchResults(p,[{ordinal:0,status:'partial',phase:'return',offers:[good,...bad]}],null,now);if(r.kind!=='flexible')throw Error();expect(r.recommendations).toEqual([]);expect(r.cells[0].state).toBe('unknown');expect(r.source_candidates[0].offers.map(o=>o.offer_id)).toEqual(['unknown']);
});
it('limits source candidates to ten, deduplicates itinerary and preserves source order over price',()=>{
 const p=planBatch('meeting',{...meeting,departure_scope:'fixed_departures'});
 const offers=Array.from({length:12},(_,i)=>({...offer(base,String(i)),money:{minor:12000-i*100,currency:'HKD',digits:2},price_complete:false}));
 const partial={...offers[0],offer_id:'partial',complete:false},replacement={...offers[0],offer_id:'structural',complete:true};
 const r=batchResults(p,[{ordinal:0,status:'partial',phase:'search',offers:[partial,...offers.slice(1),replacement]}],null,now);
 expect(r.source_candidates[0]).toMatchObject({returned_count:12,omitted_count:2});expect(r.source_candidates[0].offers.map(o=>o.offer_id)).toEqual(['structural','1','2','3','4','5','6','7','8','9']);
});
