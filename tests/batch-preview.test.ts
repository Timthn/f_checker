import {it,expect} from 'vitest';
import {previewBatch} from '../src/domain/batch-preview';
import {planBatch} from '../src/domain/batch-contracts';
const base={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
it('browser preview matches admitted complete plans, deduplication and date-line pairs',()=>{
 for(const [kind,q] of [
 ['meeting',{a:base,b:{...base,origin:'SIN'},arrival_day:'2026-11-10',max_minutes:60,departure_scope:'fixed_departures'}],
 ['meeting',{a:base,b:base,arrival_day:'2026-11-10',max_minutes:60,departure_scope:'arrival_window'}],
 ['meeting',{a:base,b:base,arrival_day:'2026-11-10',max_minutes:60}],
 ['flexible',{base,departure_from:'2026-11-10',departure_to:'2026-11-11',return_from:'2026-11-17',return_to:'2026-11-18',min_nights:6,max_nights:10}],
 ['flexible',{base:{...base,origin:'AKL',destination:'HNL'},departure_from:'2026-11-11',departure_to:'2026-11-11',return_from:'2026-11-10',return_to:'2026-11-10',min_nights:0,max_nights:10}],
 ] as const){const p=planBatch(kind,{...q,max_budget_microusd:500000});expect(previewBatch(kind,q)).toMatchObject({queries:p.queries.length,calls:p.call_count,ceiling_microusd:p.ceiling_microusd});}
});
