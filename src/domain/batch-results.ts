import {Temporal} from '@js-temporal/polyfill';
import type {BatchPlan,LiveMeeting,LiveFlexible} from './batch-contracts';
import type {Offer,CalendarCell} from './contracts';
import {qualifies,rendezvous,rendezvousCandidates,rendezvousFrontier,closestGapAlternatives} from './rules';

export type BatchResultItem={ordinal:number;status:string;phase:string;offers:Offer[];searched?:boolean};
const searched=(i:BatchResultItem|undefined)=>i?.searched??false;
// Inputs come exclusively from owner-scoped members of this batch. Cached rows are never merged.
export function batchResults(plan:BatchPlan,items:BatchResultItem[],lockedA:Offer|null=null,now=new Date()){
 const members=plan.queries.map(q=>({planned:q,item:items.find(i=>i.ordinal===q.ordinal)}));
 const coverage={...plan.coverage,admitted:members.length,searched:members.filter(m=>searched(m.item)).length,complete_quotes:members.filter(m=>m.item?.offers.some(o=>o.complete&&o.price_complete)).length,query_constraints_verified:members.filter(m=>m.item?.offers.some(o=>qualifies(o,m.planned.query,now)==='confirmed')).length};
 if(plan.kind==='meeting'){
  const q=plan.request as LiveMeeting;
  const sides={a:[] as Offer[],b:[] as Offer[]};
  for(const m of members)for(const side of ['a','b'] as const)if(m.planned.participants.includes(side))sides[side].push(...(m.item?.offers??[]).filter(o=>qualifies(o,m.planned.query,now)==='confirmed'));
  if(q.lock_a){
   const departure=lockedA?.segments.find(s=>s.leg_index===0)?.departure_local.slice(0,10);
   const allowed=q.departure_scope==='fixed_departures'?[q.a.departure]:[-2,-1,0].map(n=>Temporal.PlainDate.from(q.arrival_day).add({days:n}).toString());
   sides.a=lockedA?.offer_id===q.lock_a&&departure&&allowed.includes(departure)&&qualifies(lockedA,{...q.a,departure},now)==='confirmed'?[lockedA]:[];
  }
  // The existing meeting reducer checks exact departure dates. Group actual admitted dates
  // instead of reusing the form's placeholder departure for an arrival-window search.
  const groups=(side:'a'|'b')=>[...new Set(sides[side].map(o=>o.segments.find(s=>s.leg_index===0)?.departure_local.slice(0,10)).filter((d):d is string=>!!d))];
  const pairs:ReturnType<typeof rendezvous>=[],alternatives:ReturnType<typeof closestGapAlternatives>=[];
  for(const a of groups('a'))for(const b of groups('b')){
   const requirements={a:{...q.a,departure:a},b:{...q.b,departure:b}};
   const left=sides.a.filter(o=>o.segments.find(s=>s.leg_index===0)?.departure_local.slice(0,10)===a),right=sides.b.filter(o=>o.segments.find(s=>s.leg_index===0)?.departure_local.slice(0,10)===b);
   for(const candidate of rendezvousFrontier(rendezvousCandidates(left,right,q.arrival_day,q.lock_a,requirements,now).filter(p=>p.gap<=q.max_minutes),Infinity))pairs.push(candidate);
   alternatives.push(...closestGapAlternatives(left,right,q.arrival_day,q.max_minutes,q.lock_a,requirements,now));
  }
  const distinct=<T extends {a:Offer;b:Offer}>(ps:T[])=>[...new Map(ps.map(p=>[`${p.a.offer_id}/${p.b.offer_id}`,p])).values()];
  const candidates=distinct(pairs),identity=(p:typeof candidates[number],r:typeof candidates[number])=>p.a.offer_id.localeCompare(r.a.offer_id)||p.b.offer_id.localeCompare(r.b.offer_id);
  const best=rendezvousFrontier(candidates);
  return {kind:'meeting' as const,pairs:best,alternatives:distinct(alternatives).sort((p,r)=>p.gap-r.gap||p.total-r.total||p.duration-r.duration||identity(p,r)).slice(0,5),coverage,source:'batch_members_only' as const};
 }
 const q=plan.request as LiveFlexible,cells:(CalendarCell&{query_status:string;searched:boolean})[]=[],verified:{offer:Offer;nights:number}[]=[];
 for(const m of members){
  const valid=(m.item?.offers??[]).flatMap(offer=>{
   if(qualifies(offer,m.planned.query,now)!=='confirmed'||!offer.time_verified)return [];
   const out=offer.segments.filter(s=>s.leg_index===0).at(-1),back=offer.segments.find(s=>s.leg_index===1);
   try{
    if(!out?.arrival_utc||!out.arrival_zone||!back?.departure_utc||Temporal.Instant.compare(out.arrival_utc,back.departure_utc)>=0)return [];
    const nights=Temporal.Instant.from(out.arrival_utc).toZonedDateTimeISO(out.arrival_zone).toPlainDate().until(Temporal.Instant.from(back.departure_utc).toZonedDateTimeISO(out.arrival_zone).toPlainDate()).days;
    return nights>=q.min_nights&&nights<=q.max_nights?[{offer,nights}]:[];
   }catch{return [];}
  });
  const order=(a:typeof valid[number],b:typeof valid[number])=>a.offer.money.minor-b.offer.money.minor||a.nights-b.nights||(a.offer.duration_minutes??Infinity)-(b.offer.duration_minutes??Infinity)||a.offer.itinerary_id.localeCompare(b.offer.itinerary_id)||a.offer.offer_id.localeCompare(b.offer.offer_id);
  valid.sort(order);const best=valid[0];if(best)verified.push(best);
  cells.push({departure:m.planned.query.departure,return_date:m.planned.query.return_date??null,state:best?'verified':m.item?.status==='failed'?'failed':'unknown',money:best?.offer.money??null,...(best?{offer_id:best.offer.offer_id}:{}),query_status:m.item?.status??'queued',searched:searched(m.item)});
 }
 verified.sort((a,b)=>a.offer.money.minor-b.offer.money.minor||a.nights-b.nights||(a.offer.duration_minutes??Infinity)-(b.offer.duration_minutes??Infinity)||a.offer.itinerary_id.localeCompare(b.offer.itinerary_id)||a.offer.offer_id.localeCompare(b.offer.offer_id));
 return {kind:'flexible' as const,cells,recommendations:verified.slice(0,5).map(v=>({...v.offer,nights:v.nights})),coverage:{...coverage,verified_cells:verified.length},source:'batch_members_only' as const};
}
