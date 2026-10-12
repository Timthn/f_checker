import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
import { meetingSchema,flexibleSchema,type MeetingQuery,type FlexibleQuery } from './analysis-contracts';
import { datePairs,stableId } from './rules';
import type { Search } from './contracts';
import {selectFlexiblePairs,type ExplorationSeed} from './flexible-exploration';

// The explicit logical-batch ceiling does not enlarge account/month/lifetime caps.
const ceiling=z.number().int().min(30000).max(500000).default(100000);
export const liveMeetingSchema=meetingSchema.safeExtend({departure_scope:z.enum(['arrival_window','fixed_departures']).default('arrival_window'),max_budget_microusd:ceiling});
export const liveFlexibleSchema=flexibleSchema.safeExtend({max_budget_microusd:ceiling,strategy:z.enum(['exhaustive','heuristic']).default('exhaustive'),max_pairs:z.number().int().min(1).max(8).default(3)});
export type LiveMeeting=z.infer<typeof liveMeetingSchema>;
export type LiveFlexible=z.infer<typeof liveFlexibleSchema>;
export type BatchQuery={ordinal:number;query:Search;fingerprint:string;participants:('a'|'b'|'dates')[];operations:('search'|'return')[]};
export type BatchPlan={version:1;kind:'meeting'|'flexible';request:LiveMeeting|LiveFlexible;queries:BatchQuery[];ceiling_microusd:number;call_count:number;coverage:{scope:string;requested_queries:number;unique_queries:number;verification_branches_per_query:1;possible_queries?:number;selection_basis?:'uniform'|'saved_quote_neighbors'|'exhaustive'}};
export class BatchPlanError extends Error{constructor(public code:string,public required_microusd=0,public available_microusd=0){super(code);}}
export function planBatch(kind:BatchPlan['kind'],request:unknown,lockedAValidated=false,seeds:ExplorationSeed[]=[]):BatchPlan{
 const parsed=kind==='meeting'?liveMeetingSchema.parse(request):liveFlexibleSchema.parse(request);
 const inputs:{query:Search;participant:'a'|'b'|'dates'}[]=[];
 let scope:string,possible:number|undefined,basis:BatchPlan['coverage']['selection_basis'];
 if(kind==='meeting'){
  const q=parsed as LiveMeeting;scope=q.departure_scope;
  if(q.lock_a&&!lockedAValidated)throw new BatchPlanError('LOCK_REQUIRES_VALIDATION');
  const days=q.departure_scope==='arrival_window'?[-2,-1,0].map(n=>Temporal.PlainDate.from(q.arrival_day).add({days:n}).toString()):null;
  for(const participant of ['a','b'] as const){if(participant==='a'&&q.lock_a)continue;for(const departure of days??[q[participant].departure])inputs.push({query:{...q[participant],departure},participant});}
 }else{
  const q=parsed as LiveFlexible;scope=q.strategy==='heuristic'?'heuristic_dates':'cartesian_dates';
  const selected=selectFlexiblePairs(q,seeds),pairs=selected.pairs;possible=selected.possible_queries;basis=selected.selection_basis;
  // Local date arithmetic cannot establish destination-local nights across the date line.
  for(const p of pairs)inputs.push({query:{...q.base,...p},participant:'dates'});
 }
 const unique=new Map<string,BatchQuery>();
 for(const item of inputs){const fingerprint=stableId(item.query),previous=unique.get(fingerprint);if(previous){if(!previous.participants.includes(item.participant))previous.participants.push(item.participant);continue;}
  const operations:BatchQuery['operations']=item.query.return_date?['search','return']:['search'];
  unique.set(fingerprint,{ordinal:unique.size,query:item.query,fingerprint,participants:[item.participant],operations});
 }
 const queries=[...unique.values()],calls=queries.reduce((n,q)=>n+q.operations.length,0),cost=calls*30000;
 if(calls>40)throw new BatchPlanError('BATCH_CALL_LIMIT',cost);
 if(cost>parsed.max_budget_microusd)throw new BatchPlanError('BATCH_BUDGET_EXCEEDED',cost,parsed.max_budget_microusd);
 return {version:1,kind,request:parsed,queries,ceiling_microusd:cost,call_count:calls,coverage:{scope,requested_queries:possible??inputs.length,unique_queries:queries.length,verification_branches_per_query:1,...(possible===undefined?{}:{possible_queries:possible,selection_basis:basis})}};
}
export type BatchRequest=MeetingQuery|FlexibleQuery;
