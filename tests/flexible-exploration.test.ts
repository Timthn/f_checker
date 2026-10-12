import {it,expect} from 'vitest';
import {selectFlexiblePairs} from '../src/domain/flexible-exploration';
import {planBatch} from '../src/domain/batch-contracts';
import {previewBatch} from '../src/domain/batch-preview';
const range={departure_from:'2026-11-10',departure_to:'2026-11-14',return_from:'2026-11-17',return_to:'2026-11-21',strategy:'heuristic' as const,max_pairs:3};
const base={origin:'HKG',destination:'NRT',departure:range.departure_from,cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
it('bounded uniform samples span both axes, deterministic and never claim all pairs',()=>{
 const r=selectFlexiblePairs(range);expect(r.pairs).toHaveLength(3);expect(r.possible_queries).toBe(25);expect(r.selection_basis).toBe('uniform');expect(new Set(r.pairs.map(p=>p.departure)).size).toBeGreaterThan(1);expect(new Set(r.pairs.map(p=>p.return_date)).size).toBeGreaterThan(1);expect(selectFlexiblePairs(range)).toEqual(r);
});
it('cheapest saved seeds prioritize in-range neighbors, ignore foreign/invalid seeds',()=>{
 const r=selectFlexiblePairs(range,[{departure:'2026-11-12',return_date:'2026-11-19',minor:100},{departure:'2026-12-12',return_date:'2026-12-19',minor:1}]);
 expect(r.selection_basis).toBe('saved_quote_neighbors');expect(r.pairs).toEqual([{departure:'2026-11-11',return_date:'2026-11-19'},{departure:'2026-11-13',return_date:'2026-11-19'},{departure:'2026-11-12',return_date:'2026-11-18'}]);
 expect(selectFlexiblePairs({...range,max_pairs:8},[{departure:range.departure_from,return_date:range.return_from,minor:1}]).pairs).toHaveLength(8);
});
it('single pair, date-line pairs and exhaustive legacy preserve honest bounds',()=>{
 expect(selectFlexiblePairs({...range,departure_to:range.departure_from,return_to:range.return_from,max_pairs:8}).pairs).toHaveLength(1);
 expect(selectFlexiblePairs({...range,strategy:'exhaustive'}).pairs).toHaveLength(25);
 expect(selectFlexiblePairs({...range,return_from:'2026-11-09',return_to:'2026-11-09',max_pairs:1}).pairs[0].return_date).toBe('2026-11-09');
 expect(()=>selectFlexiblePairs({...range,departure_to:'2027-12-10'})).toThrow('QUOTA');
});
it('preview matches selected admission cost, budget never silently truncates',()=>{
 const input={...range,base,min_nights:0,max_nights:30,max_budget_microusd:200000};
 const p=planBatch('flexible',input,false,[{departure:'2026-11-12',return_date:'2026-11-19',minor:100}]);
 expect(p.coverage).toMatchObject({scope:'heuristic_dates',requested_queries:25,unique_queries:3,selection_basis:'saved_quote_neighbors'});
 expect(previewBatch('flexible',input)).toMatchObject({queries:3,calls:6,ceiling_microusd:180000,possible_queries:25});
 expect(()=>planBatch('flexible',{...input,max_budget_microusd:100000})).toThrow('BATCH_BUDGET_EXCEEDED');
 expect(()=>planBatch('flexible',{...input,max_pairs:0})).toThrow();
});
