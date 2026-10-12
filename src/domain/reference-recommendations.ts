import {Temporal} from '@js-temporal/polyfill';
import type {Offer,Search} from './contracts';
import {qualifies} from './rules';

// Reference prices retain unknown rights. This is not an eligibility promotion.
export function referenceEligible(o:Offer,q:Search,now=new Date()){
 const observed=Date.parse(o.observed_at),expires=Date.parse(o.expires_at);
 const digits=new Intl.NumberFormat('en',{style:'currency',currency:q.currency}).resolvedOptions().maximumFractionDigits??2;
 if(!o.complete||qualifies(o,q,now)==='excluded'||!o.itinerary_id||!Number.isSafeInteger(o.money.minor)||o.money.minor<=0||o.money.digits!==digits||!Number.isFinite(now.getTime())||!Number.isFinite(observed)||!Number.isFinite(expires)||observed>now.getTime()||now.getTime()-observed>86400000||expires<=now.getTime())return false;
 if(o.quote_evidence?.state!=='source_fields_matched'||o.quote_evidence.display_minor!==o.money.minor||o.quote_evidence.exact_minor!==o.money.minor)return false;
 const out=o.segments.filter(s=>s.leg_index===0),back=o.segments.filter(s=>s.leg_index===1);
 if(!out.length||!!q.return_date!==!!back.length||o.segments.some(s=>s.leg_index!==0&&s.leg_index!==1||!localClock(s.departure_local)||!localClock(s.arrival_local))||[out,back].some(ss=>ss.some((s,i)=>i>0&&ss[i-1].to!==s.from)))return false;
 // qualifies returns unknown early for incomplete price scopes; check explicit bag contradictions separately.
 if(o.baggage.some(b=>b.contradictory||b.carry_on!==null&&(!Number.isSafeInteger(b.carry_on)||b.carry_on<q.carry_on)||b.checked!==null&&(!Number.isSafeInteger(b.checked)||b.checked<q.checked)))return false;
 return true;
}
export function localClock(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?$/.test(value))return null;
 try{return Temporal.PlainDateTime.from(value,{overflow:'reject'});}catch{return null;}
}
export function referenceNights(o:Offer){
 const out=o.segments.filter(s=>s.leg_index===0).at(-1),back=o.segments.find(s=>s.leg_index===1);
 if(!out||!back||out.to!==back.from)return null;
 const arrival=localClock(out.arrival_local),departure=localClock(back.departure_local);
 if(!arrival||!departure||Temporal.PlainDateTime.compare(arrival,departure)>=0)return null;
 return arrival.toPlainDate().until(departure.toPlainDate()).days;
}
export type ReferencePair={a:Offer;b:Offer;total:number;gap:number;arrival_a:string;arrival_b:string;time_basis:'destination_local_assumption';zone:null;constraints:'unknown'};
export function referenceMeeting(left:Offer[],right:Offer[],day:string,maxMinutes:number){
 const prepared=(offers:Offer[])=>{
  const unique=new Map<string,{offer:Offer;arrival:string;airport:string;minutes:number}>();
  for(const offer of offers){const arrival=offer.segments.filter(s=>s.leg_index===0).at(-1),clock=arrival&&localClock(arrival.arrival_local);if(!arrival||!clock||clock.toPlainDate().toString()!==day)continue;
   const key=`${offer.itinerary_id}/${offer.money.currency}/${offer.money.digits}`,prior=unique.get(key);
   if(!prior||offer.money.minor<prior.offer.money.minor||offer.money.minor===prior.offer.money.minor&&offer.offer_id.localeCompare(prior.offer.offer_id)<0)unique.set(key,{offer,arrival:arrival.arrival_local,airport:arrival.to,minutes:clock.hour*60+clock.minute+clock.second/60+clock.millisecond/60000+clock.microsecond/60000000+clock.nanosecond/60000000000});
  }return [...unique.values()];
 };
 const matched:ReferencePair[]=[],alternatives:ReferencePair[]=[];
 const identity=(a:ReferencePair,b:ReferencePair)=>a.a.offer_id.localeCompare(b.a.offer_id)||a.b.offer_id.localeCompare(b.b.offer_id);
 const byPrice=(a:ReferencePair,b:ReferencePair)=>a.total-b.total||a.gap-b.gap||identity(a,b),byGap=(a:ReferencePair,b:ReferencePair)=>a.gap-b.gap||a.total-b.total||identity(a,b);
 const retain=(list:ReferencePair[],p:ReferencePair,order:typeof byPrice)=>{if(list.length===5&&order(p,list[4])>=0)return;list.push(p);list.sort(order);if(list.length>5)list.pop();};
 // O(left + right) retained memory, rather than storing the Cartesian product.
 const aSide=prepared(left),bSide=prepared(right);
 for(const x of aSide)for(const y of bSide){const a=x.offer,b=y.offer;
  if(x.airport!==y.airport||a.money.currency!==b.money.currency||a.money.digits!==b.money.digits)continue;
  const total=a.money.minor+b.money.minor;if(!Number.isSafeInteger(total))continue;
  const gap=Math.abs(x.minutes-y.minutes),p:ReferencePair={a,b,total,gap,arrival_a:x.arrival,arrival_b:y.arrival,time_basis:'destination_local_assumption',zone:null,constraints:'unknown'};
  if(gap<=maxMinutes)retain(matched,p,byPrice);else retain(alternatives,p,byGap);
 }
 return {reference_pairs:matched,reference_alternatives:alternatives};
}
