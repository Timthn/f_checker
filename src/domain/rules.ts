import Decimal from 'decimal.js';
import { Temporal } from '@js-temporal/polyfill';
import { createHash } from 'node:crypto';
import type { Money, Offer, Search, Observation, CalendarCell } from './contracts';
export function money(value: number|string, currency: string): Money {
  const digits = new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits ?? 2;
  const n = new Decimal(value).mul(new Decimal(10).pow(digits));
  if (!n.isInteger() || n.isNegative() || !n.isFinite() || n.gt(Number.MAX_SAFE_INTEGER)) throw new Error('INVALID_MONEY');
  return {minor:n.toNumber(),currency,digits};
}
export function stableId(value: unknown): string {
 const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
 return createHash('sha256').update('canonical-json-v1:'+JSON.stringify(canonical(JSON.parse(JSON.stringify(value))))).digest('hex');
}
export function qualifies(offer: Offer, query: Search, now=new Date()): 'confirmed'|'unknown'|'excluded' {
  if(offer.money.currency !== query.currency || offer.segments.some(s => s.cabin !== query.cabin)) return 'excluded';
  const outbound=offer.segments.filter(s=>s.leg_index===0),back=offer.segments.filter(s=>s.leg_index===1);
  if(!outbound.length)return 'unknown';
  if(outbound[0].from!==query.origin || outbound.at(-1)!.to!==query.destination || outbound[0].departure_local.slice(0,10)!==query.departure || offer.quoted_adults!==null&&offer.quoted_adults!==query.adults)return 'excluded';
  if(query.return_date && back.length && (back[0].from!==query.destination||back.at(-1)!.to!==query.origin||back[0].departure_local.slice(0,10)!==query.return_date))return 'excluded';
  if(!query.return_date && back.length)return 'excluded';
  const observed=Date.parse(offer.observed_at),expires=Date.parse(offer.expires_at);
  if(!offer.complete || !offer.price_complete || offer.quoted_adults===null || query.return_date&&!back.length || !Number.isFinite(observed) || !Number.isFinite(expires) || !Number.isFinite(now.getTime()) || !Number.isSafeInteger(offer.money.minor) || offer.money.minor<=0 || expires<=now.getTime() || observed>now.getTime() || now.getTime()-observed>86400000) return 'unknown';
  for(let s=0;s<offer.segments.length;s++) for(let p=0;p<query.adults;p++) {
    const b=offer.baggage.find(x=>x.segment===s && x.passenger===p);
    if(!b || b.contradictory) return 'unknown';
    if(b.carry_on===null || b.checked===null || !Number.isSafeInteger(b.carry_on) || !Number.isSafeInteger(b.checked) || b.carry_on<0 || b.checked<0) return 'unknown';
    if(query.carry_on>0 && (b.carry_kg===null || !Number.isFinite(b.carry_kg) || b.carry_kg<=0) || query.checked>0 && (b.checked_kg===null || !Number.isFinite(b.checked_kg) || b.checked_kg<=0)) return 'unknown';
    if(b.carry_on<query.carry_on || b.checked<query.checked) return 'excluded';
  }
  return 'confirmed';
}
export function rank(offers: Offer[], query: Search, now=new Date()) {
  const valid=offers.filter(o=>qualifies(o,query,now)==='confirmed').sort((a,b)=>a.money.minor-b.money.minor || a.itinerary_id.localeCompare(b.itinerary_id));
  const seen=new Set<string>();
  return {confirmed:valid.filter(o=>!seen.has(o.itinerary_id) && !!seen.add(o.itinerary_id)).slice(0,10),unknown:offers.filter(o=>qualifies(o,query,now)==='unknown')};
}
export function localToUtc(local: string, zone: string, verifiedSemantics: boolean): string|null {
  if(!verifiedSemantics) return null;
  try {return Temporal.PlainDateTime.from(local).toZonedDateTime(zone,{disambiguation:'reject'}).toInstant().toString();} catch {return null;}
}
const median=(v:number[])=>{const a=[...v].sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
export function history(offer:Offer, observations:Observation[], now=new Date()) {
  const observed=Date.parse(offer.observed_at),cutoff=observed-30*86400000;
  const eligible=observations.filter(o=>!!offer.comparison_key && o.fresh && o.comparison_key===offer.comparison_key && o.currency===offer.money.currency && Number.isSafeInteger(o.minor) && o.minor>0 && Date.parse(o.observed_at)>=cutoff && Date.parse(o.observed_at)<observed);
  const groups=new Map<string,number[]>(); for(const o of eligible){const d=new Date(o.observed_at).toISOString().slice(0,10);groups.set(d,[...(groups.get(d)??[]),o.minor]);}
  const points=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([day,values])=>({day,minor:median(values)}));
  const values=points.map(p=>p.minor),baseline=values.length?median(values):null;
  const span=points.length>1?(Date.parse(points.at(-1)!.day)-Date.parse(points[0].day))/86400000:0;
  const latest=Math.max(...eligible.map(o=>Date.parse(o.observed_at)));
  const enough=offer.complete && offer.price_complete && offer.time_verified && offer.quoted_adults!==null && !!offer.fare_identity && !!offer.comparison_key && Number.isSafeInteger(offer.money.minor) && offer.money.minor>0 && points.length>=7 && span>=7 && now.getTime()-latest<=86400000 && observed<=now.getTime() && now.getTime()-observed<=86400000 && Date.parse(offer.expires_at)>now.getTime() && baseline!==null && baseline>0;
  const delta=enough?(offer.money.minor-baseline!)/baseline!:null;
  return {points,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,baseline,signal:delta===null?'insufficient':delta<=-.05?'low':delta>=.05?'high':'typical',delta,version:'daily-median-30d-v1'};
}
export type RendezvousPair={a:Offer;b:Offer;total:number;gap:number;duration:number};
export function rendezvousCandidates(a:Offer[],b:Offer[],day:string,locked:string|undefined,requirements:{a:Search;b:Search},now:Date) {
  const pairs:RendezvousPair[]=[];
  for(const x of a) for(const y of b){
    if(qualifies(x,requirements.a,now)!=='confirmed'||qualifies(y,requirements.b,now)!=='confirmed')continue;
    const sx=x.segments.filter(s=>s.leg_index===0).at(-1),sy=y.segments.filter(s=>s.leg_index===0).at(-1);
    if(locked && x.offer_id!==locked || !x.complete || !y.complete || !x.time_verified || !y.time_verified || !sx?.arrival_utc || !sy?.arrival_utc || !sx.arrival_zone || !sy.arrival_zone || sx.to!==sy.to || x.money.currency!==y.money.currency) continue;
    const localDay=(s:typeof sx)=>{try{return Temporal.Instant.from(s!.arrival_utc!).toZonedDateTimeISO(s!.arrival_zone!).toPlainDate().toString();}catch{return null;}};
    if(localDay(sx)!==day || localDay(sy)!==day) continue;
    const gap=Math.abs(Date.parse(sx.arrival_utc)-Date.parse(sy.arrival_utc))/60000;
    if(!Number.isFinite(gap) || x.duration_minutes===null||y.duration_minutes===null||!Number.isFinite(x.duration_minutes)||!Number.isFinite(y.duration_minutes)||x.duration_minutes<=0||y.duration_minutes<=0)continue;
    pairs.push({a:x,b:y,total:x.money.minor+y.money.minor,gap,duration:Math.max(x.duration_minutes,y.duration_minutes)});
  }
  return pairs;
}
const pairIdentity=(p:RendezvousPair,q:RendezvousPair)=>p.a.offer_id.localeCompare(q.a.offer_id)||p.b.offer_id.localeCompare(q.b.offer_id);
export function rendezvousFrontier(pairs:RendezvousPair[],limit=5){
 const sorted=[...pairs].sort((p,q)=>p.total-q.total||p.gap-q.gap||p.duration-q.duration||pairIdentity(p,q));
 const frontier:RendezvousPair[]=[];let cheaperGap=Infinity;
 for(let i=0;i<sorted.length;){
  let end=i+1;while(end<sorted.length&&sorted[end].total===sorted[i].total)end++;
  const gap=sorted[i].gap;
  if(gap<cheaperGap){
   // Equal price/gap pairs do not dominate each other. Only five can reach the
   // final top-five result; retain their best duration/identity ties per point.
   let ties=0;for(let j=i;j<end&&sorted[j].gap===gap&&ties<5;j++,ties++)frontier.push(sorted[j]);
   cheaperGap=gap;
  }
  i=end;
 }
 return frontier.slice(0,limit);
}
export function rendezvous(a:Offer[],b:Offer[],day:string,maxMinutes:number,locked:string|undefined,requirements:{a:Search;b:Search},now=new Date()) {
  const pairs=rendezvousCandidates(a,b,day,locked,requirements,now).filter(p=>p.gap<=maxMinutes);
  return rendezvousFrontier(pairs);
}
export function closestGapAlternatives(a:Offer[],b:Offer[],day:string,maxMinutes:number,locked:string|undefined,requirements:{a:Search;b:Search},now=new Date()) {
  if(!Number.isFinite(maxMinutes)||maxMinutes<0)return [];
  return rendezvousCandidates(a,b,day,locked,requirements,now).filter(p=>p.gap>maxMinutes).sort((p,q)=>p.gap-q.gap || p.total-q.total || p.duration-q.duration || pairIdentity(p,q)).slice(0,5).map(p=>({...p,reason:'arrival_gap_exceeds_limit' as const,required_max_minutes:p.gap}));
}
export function datePairs(from:string,to:string,returnFrom:string,returnTo:string,limit=400) {
  const expand=(a:string,b:string)=>{const ds=[];for(let d=Temporal.PlainDate.from(a);Temporal.PlainDate.compare(d,b)<=0;d=d.add({days:1})){ds.push(d.toString());if(ds.length>limit)throw Error('QUOTA');}return ds;};
  const a=expand(from,to),b=expand(returnFrom,returnTo);if(a.length*b.length>limit)throw Error('QUOTA');
  return a.flatMap(departure=>b.map(return_date=>({departure,return_date}))); // UTC/nights validation occurs after complete quote, not local-date prefilter.
}
export function validStay(out:Offer,back:Offer,min:number,max:number) {
  const a=out.segments.at(-1),r=back.segments[0];if(!a?.arrival_utc || !a.arrival_zone || !r?.departure_utc || !out.time_verified || !back.time_verified || Date.parse(r.departure_utc)<=Date.parse(a.arrival_utc))return false;
  const arrival=Temporal.Instant.from(a.arrival_utc).toZonedDateTimeISO(a.arrival_zone).toPlainDate();
  const departure=Temporal.Instant.from(r.departure_utc).toZonedDateTimeISO(a.arrival_zone).toPlainDate();
  const nights=arrival.until(departure).days;return nights>=min && nights<=max;
}
export function coverage(cells:CalendarCell[],total:number,currency:string,qualifyingOfferIds:Set<string>){const unique=[...new Map(cells.map(c=>[`${c.departure}/${c.return_date??''}`,c])).values()];const verified=unique.filter(c=>c.state==='verified'&&c.money?.currency===currency&&c.offer_id&&qualifyingOfferIds.has(c.offer_id));return {total,searched:unique.length,verified:verified.length,minimum:verified.length?verified.reduce((a,b)=>a.money!.minor<=b.money!.minor?a:b):null};}
