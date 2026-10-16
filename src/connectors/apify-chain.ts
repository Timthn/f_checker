// Server-only connector planning. `next` contains private references and must never
// cross a Workflow serialization boundary, public API, checkpoint or log.
import { z } from 'zod';
import { parseSearch } from './apify-adapter';
import { stableId } from '../domain/rules';
import type { Offer, Search, Segment } from '../domain/contracts';

type ReturnOperation='return'|'return:1'|'return:2';
type Branch={token:string;selected:Segment[];outbound_duration_minutes:number|null;operation_key:ReturnOperation};
export type ChainNext = {mode:'return'|'booking';token:string;selected:Segment[];outbound_duration_minutes?:number|null;operation_key?:ReturnOperation;remaining?:Branch[]};
export type ChainPlan = {offers:Offer[];next:ChainNext|null;coverage:{returned:number;selected:number}};
const envelope=z.object({mode:z.enum(['search','return']),trip_type:z.string(),itineraries:z.array(z.object({
  trip_type:z.string(),departure_token:z.unknown().optional(),booking_token:z.unknown().optional(),
}).passthrough()),input:z.record(z.string(),z.unknown()).optional(),
  departure_airport:z.string().optional(),arrival_airport:z.string().optional(),departure_date:z.string().optional(),
  return_date:z.string().optional(),currency:z.string().optional(),adults:z.number().optional(),
});
function read(raw:unknown,mode:'search'|'return',q:Search){
 const parsed=envelope.safeParse(raw);if(!parsed.success)throw Error('CHAIN_SCHEMA_CHANGED');
 const d=parsed.data,trip=q.return_date?'round_trip':'one_way';
 if(d.mode!==mode||d.trip_type!==trip||d.itineraries.some(i=>i.trip_type!==trip))throw Error('CHAIN_CONTEXT_MISMATCH');
 const origin=mode==='return'?q.destination:q.origin,destination=mode==='return'?q.origin:q.destination,date=mode==='return'?q.return_date:q.departure;
 const checks:[unknown,unknown][]=[[d.departure_airport,origin],[d.arrival_airport,destination],[d.departure_date,date],[d.return_date,q.return_date],[d.currency,q.currency],[d.adults,q.adults]];
 if(mode==='search')for(const [key,expected] of Object.entries({departure:origin,arrival:destination,departure_date:date,return_date:q.return_date,currency:q.currency,adults:q.adults,cabin_class:q.cabin,carry_on_bags:q.carry_on,checked_bags:q.checked}))checks.push([d.input?.[key],expected]);
 if(checks.some(([actual,expected])=>actual!==undefined&&actual!==expected))throw Error('CHAIN_CONTEXT_MISMATCH');
 let offers:Offer[];try{offers=parseSearch(raw,q);}catch{throw Error('CHAIN_SCHEMA_CHANGED');}
 // parseSearch validates the full payload, then excludes explicit null prices.
 // Apply the same exclusion here so private tokens retain their original pairing.
 return {d:{...d,itineraries:d.itineraries.filter(i=>i.price!==null)},offers};
}
function compatible(ss:Segment[],q:Search,back=false){
 const from=back?q.destination:q.origin,to=back?q.origin:q.destination,day=back?q.return_date:q.departure;
 return ss.length>0&&ss.every(s=>s.leg_index===0&&s.cabin===q.cabin)&&ss[0].from===from&&ss.at(-1)!.to===to&&ss[0].departure_local.slice(0,10)===day&&ss.every((s,i)=>i===0||ss[i-1].to===s.from);
}
function opaque(value:unknown):value is string{return typeof value==='string'&&value.trim().length>0&&value.length<=100000&&!value.includes('[REDACTED]')&&!/[\r\n]/.test(value);}
function candidatesFor(offers:Offer[],q:Search,back=false){
 const candidates=offers.map((offer,index)=>({offer,index})).filter(({offer})=>offer.money.currency===q.currency&&compatible(offer.segments,q,back));
 if(!candidates.length&&offers.length)throw Error('CHAIN_CONTEXT_MISMATCH');
 return candidates;
}
const schedule=(segments:Segment[])=>JSON.stringify(segments.map(s=>[s.flight,s.from,s.to,s.departure_local,s.arrival_local,s.cabin]));
function choose(offers:Offer[],d:z.infer<typeof envelope>,q:Search,maxBranches:number){
 const candidates=candidatesFor(offers,q);
 if(!offers.length)return [];
 const usable=candidates.filter(({index})=>opaque(d.itineraries[index].departure_token)).sort((a,b)=>a.offer.money.minor-b.offer.money.minor||a.index-b.index);
 if(!usable.length)throw Error('CHAIN_REFERENCE_UNAVAILABLE');
 const seen=new Set<string>();return usable.filter(({offer})=>{const key=schedule(offer.segments);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,maxBranches).map(chosen=>({...chosen,token:d.itineraries[chosen.index].departure_token as string}));
}
export function planSearch(raw:unknown,query:Search,maxBranches=1):ChainPlan{
 if(!Number.isInteger(maxBranches)||maxBranches<1||maxBranches>3)throw Error('CHAIN_SCHEMA_CHANGED');
 const {d,offers}=read(raw,'search',query);
 const compatibleOffers=candidatesFor(offers,query).map(c=>c.offer);
 if(!query.return_date)return {offers:compatibleOffers,next:null,coverage:{returned:offers.length,selected:compatibleOffers.length}};
 const picked=choose(offers,d,query,maxBranches),first=picked[0];
 const branches:Branch[]=picked.map((p,i)=>({token:p.token,selected:p.offer.segments,outbound_duration_minutes:p.offer.duration_minutes,operation_key:i===0?'return':i===1?'return:1':'return:2'}));
 return {offers:compatibleOffers,next:first?{mode:'return',token:first.token,selected:first.offer.segments,outbound_duration_minutes:first.offer.duration_minutes,...(maxBranches>1?{operation_key:branches[0].operation_key,remaining:branches.slice(1)}:{})}:null,coverage:{returned:offers.length,selected:picked.length}};
}
const privateSegment=z.object({leg_index:z.literal(0),from:z.string().min(1),to:z.string().min(1),departure_local:z.string().min(10),arrival_local:z.string().min(10),departure_utc:z.string().nullable(),arrival_utc:z.string().nullable(),arrival_zone:z.string().nullable(),flight:z.string().min(1),cabin:z.string().min(1),duration:z.number()}).passthrough();
const privateBranch=z.object({token:z.string().refine(opaque),selected:z.array(privateSegment).min(1).max(32),outbound_duration_minutes:z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),operation_key:z.enum(['return','return:1','return:2'])}).strict();
// This queue is private connector state. Validate before advancing so corrupted
// state cannot add an operation, reorder tokens, or change outbound context.
export function advanceReturnPlan(result:ChainPlan,currentNext:ChainNext):ChainPlan{
 const fail=()=>{throw Error('CHAIN_SCHEMA_CHANGED');};
 if(!currentNext||currentNext.mode!=='return'||result.next!==null) return fail();
 const selected=z.array(privateSegment).min(1).max(32).safeParse(currentNext.selected);
 if(!opaque(currentNext.token)||!selected.success||selected.data.some((s,i)=>s.cabin!==selected.data[0].cabin||(i>0&&selected.data[i-1].to!==s.from)))return fail();
 if(currentNext.operation_key===undefined&&currentNext.remaining===undefined)return {...result,next:null};
 const current=privateBranch.safeParse({token:currentNext.token,selected:currentNext.selected,outbound_duration_minutes:currentNext.outbound_duration_minutes,operation_key:currentNext.operation_key});
 const rest=z.array(privateBranch).max(2).safeParse(currentNext.remaining);
 if(!current.success||!rest.success)return fail();
 const operations:ReturnOperation[]=['return','return:1','return:2'],start=operations.indexOf(current.data.operation_key);
 const base=current.data.selected,seen=new Set([schedule(base)]);
 for(const [i,branch] of rest.data.entries()){
  const ss=branch.selected,key=schedule(ss);
  if(branch.operation_key!==operations[start+i+1]||seen.has(key)||ss[0].from!==base[0].from||ss.at(-1)!.to!==base.at(-1)!.to||ss[0].departure_local.slice(0,10)!==base[0].departure_local.slice(0,10)||ss.some((s,j)=>s.cabin!==base[0].cabin||(j>0&&ss[j-1].to!==s.from)))return fail();
  seen.add(key);
 }
 const [next,...remaining]=currentNext.remaining!;
 return {...result,next:next?{mode:'return',...next,remaining}:null};
}
export function planReturn(raw:unknown,query:Search,selected:Segment[],outboundDuration:number|null=null):ChainPlan{
 if(!query.return_date||!compatible(selected,query))throw Error('CHAIN_CONTEXT_MISMATCH');
 const {offers}=read(raw,'return',query);
 const combined=(back:Segment[])=>[...selected.map(s=>({...s,leg_index:0})),...back.map(s=>({...s,leg_index:1}))];
 // Complete describes the two-leg structure only. Return prices are neither added
 // to outbound prices nor promoted to verified party totals or baggage rights.
 const outboundElapsed=typeof outboundDuration==='number'&&Number.isSafeInteger(outboundDuration)&&outboundDuration>0?outboundDuration:null;
 const paired=candidatesFor(offers,query,true).map(({offer:o})=>{const segments=combined(o.segments),backElapsed=typeof o.duration_minutes==='number'&&Number.isSafeInteger(o.duration_minutes)&&o.duration_minutes>0?o.duration_minutes:null;return {...o,segments,duration_minutes:outboundElapsed!==null&&backElapsed!==null&&Number.isSafeInteger(outboundElapsed+backElapsed)?outboundElapsed+backElapsed:null,complete:true,price_complete:false,quoted_adults:null,baggage:[],itinerary_id:stableId(segments.map(s=>[s.from,s.to,s.departure_local,s.arrival_local,s.flight]))};});
 return {offers:paired,next:null,coverage:{returned:offers.length,selected:paired.length}};
}
