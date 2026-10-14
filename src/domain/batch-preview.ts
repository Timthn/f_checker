// Browser-safe cost preview. Server admission remains authoritative for locks/budgets.
import {Temporal} from '@js-temporal/polyfill';
import {meetingSchema,flexibleSchema} from './analysis-contracts';
import {selectFlexiblePairs} from './flexible-exploration';
import {flexibleSourceQueries} from './flexible-baggage';
export function previewBatch(kind:'meeting'|'flexible',request:Record<string,unknown>){
 const q=(kind==='meeting'?meetingSchema:flexibleSchema).parse(request);
 const queries:Record<string,unknown>[]=[];
 let possible_queries:number|undefined,selected_pairs:number|undefined,selection_basis:'uniform'|'saved_quote_neighbors'|'exhaustive'|undefined;
 if(kind==='meeting'){
  const m=q as ReturnType<typeof meetingSchema.parse>;
  const days=(request.departure_scope??'arrival_window')==='arrival_window'?[-2,-1,0].map(days=>Temporal.PlainDate.from(m.arrival_day).add({days}).toString()):null;
  for(const side of ['a','b'] as const){if(side==='a'&&m.lock_a)continue;for(const departure of days??[m[side].departure])queries.push({...m[side],departure});}
 }else{
  const f=q as ReturnType<typeof flexibleSchema.parse>;
  if(request.strategy!==undefined&&!['exhaustive','heuristic'].includes(String(request.strategy)))throw Error('INVALID_RANGE');
  if(request.max_pairs!==undefined&&(!Number.isInteger(request.max_pairs)||Number(request.max_pairs)<1||Number(request.max_pairs)>8))throw Error('INVALID_RANGE');
  const selected=selectFlexiblePairs({...f,strategy:request.strategy as 'exhaustive'|'heuristic'|undefined,max_pairs:request.max_pairs as number|undefined});
  possible_queries=selected.possible_queries;selected_pairs=selected.pairs.length;selection_basis=selected.selection_basis;
  for(const pair of selected.pairs)queries.push(...flexibleSourceQueries({...f.base,...pair}).map(x=>x.query));
 }
 const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
 const unique=[...new Map(queries.map(q=>[JSON.stringify(canonical(q)),q])).values()];
 const calls=unique.reduce((n,q)=>n+(q.return_date?2:1),0);
 return {queries:unique.length,calls,ceiling_microusd:calls*30000,over_call_limit:calls>40,...(possible_queries===undefined?{}:{possible_queries,selected_pairs,selection_basis})};
}
