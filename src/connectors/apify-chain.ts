// Server-only connector planning. `next` contains private references and must never
// cross a Workflow serialization boundary, public API, checkpoint or log.
import { z } from 'zod';
import { parseSearch } from './apify-adapter';
import { stableId } from '../domain/rules';
import type { Offer, Search, Segment } from '../domain/contracts';

export type ChainNext = {mode:'return'|'booking';token:string;selected:Segment[]};
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
 return {d,offers};
}
function compatible(ss:Segment[],q:Search,back=false){
 const from=back?q.destination:q.origin,to=back?q.origin:q.destination,day=back?q.return_date:q.departure;
 return ss.length>0&&ss.every(s=>s.leg_index===0&&s.cabin===q.cabin)&&ss[0].from===from&&ss.at(-1)!.to===to&&ss[0].departure_local.slice(0,10)===day&&ss.every((s,i)=>i===0||ss[i-1].to===s.from);
}
function opaque(value:unknown):value is string{return typeof value==='string'&&value.trim().length>0&&value.length<=100000&&!value.includes('[REDACTED]')&&!/[\r\n]/.test(value);}
function choose(offers:Offer[],d:z.infer<typeof envelope>,q:Search,mode:'return'|'booking',back=false){
 const candidates=offers.map((offer,index)=>({offer,index})).filter(({offer})=>offer.money.currency===q.currency&&compatible(offer.segments,q,back));
 if(!candidates.length&&offers.length)throw Error('CHAIN_CONTEXT_MISMATCH');
 if(!offers.length)return null;
 const tokenKey=mode==='return'?'departure_token':'booking_token';
 const usable=candidates.filter(({index})=>opaque(d.itineraries[index][tokenKey])).sort((a,b)=>a.offer.money.minor-b.offer.money.minor||a.index-b.index);
 if(!usable.length)throw Error('CHAIN_REFERENCE_UNAVAILABLE');
 const chosen=usable[0];return {...chosen,token:d.itineraries[chosen.index][tokenKey] as string};
}
export function planSearch(raw:unknown,query:Search):ChainPlan{
 const {d,offers}=read(raw,'search',query),mode=query.return_date?'return':'booking';
 const picked=choose(offers,d,query,mode);
 return {offers,next:picked?{mode,token:picked.token,selected:picked.offer.segments}:null,coverage:{returned:offers.length,selected:picked?1:0}};
}
export function planReturn(raw:unknown,query:Search,selected:Segment[]):ChainPlan{
 if(!query.return_date||!compatible(selected,query))throw Error('CHAIN_CONTEXT_MISMATCH');
 const {d,offers}=read(raw,'return',query),picked=choose(offers,d,query,'booking',true);
 const combined=(back:Segment[])=>[...selected.map(s=>({...s,leg_index:0})),...back.map(s=>({...s,leg_index:1}))];
 // A return-mode number is not a complete booking quote and is never added to
 // outbound prices. The selected context is validated by parseBooking next.
 const paired=offers.map(o=>{const segments=combined(o.segments);return {...o,segments,complete:false,itinerary_id:stableId(segments.map(s=>[s.from,s.to,s.departure_local,s.arrival_local,s.flight]))};});
 return {offers:paired,next:picked?{mode:'booking',token:picked.token,selected:combined(picked.offer.segments)}:null,coverage:{returned:offers.length,selected:picked?1:0}};
}
