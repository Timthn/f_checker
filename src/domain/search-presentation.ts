import type {Offer,Search} from './contracts';
export const outboundScheduleKey=(o:Offer)=>JSON.stringify(o.segments.filter(s=>s.leg_index===0).map(s=>[s.flight,s.from,s.to,s.departure_local,s.arrival_local,s.cabin]));
export function searchConditionsChanged(draft:Search,submitted:Search){return (['origin','destination','departure','return_date','cabin','adults','currency','carry_on','checked'] as const).some(k=>draft[k]!==submitted[k])||JSON.stringify(draft.traveler_baggage??null)!==JSON.stringify(submitted.traveler_baggage??null);}
export function searchPresentation(offers:Offer[],query:Search){
 const digits=new Intl.NumberFormat('en',{style:'currency',currency:query.currency}).resolvedOptions().maximumFractionDigits??2;
 const validLeg=(o:Offer,leg:number)=>{
  const ss=o.segments.filter(s=>s.leg_index===leg),from=leg?query.destination:query.origin,to=leg?query.origin:query.destination,date=leg?query.return_date:query.departure;
  return !!ss.length&&ss[0].from===from&&ss.at(-1)!.to===to&&ss[0].departure_local.slice(0,10)===date&&ss.every((s,i)=>s.cabin===query.cabin&&(!i||ss[i-1].to===s.from));
 };
 const sorted=offers.filter(o=>o.money.currency===query.currency&&o.money.digits===digits&&Number.isSafeInteger(o.money.minor)&&o.money.minor>0&&(o.quoted_adults===null||o.quoted_adults===query.adults)&&!o.segments.some(s=>s.leg_index!==0&&s.leg_index!==1||s.cabin!==query.cabin)&&validLeg(o,0)&&(query.return_date?!o.segments.some(s=>s.leg_index===1)||validLeg(o,1):!o.segments.some(s=>s.leg_index===1))).slice().sort((a,b)=>a.money.minor-b.money.minor||a.offer_id.localeCompare(b.offer_id));
 const list=(leg:number)=>{const seen=new Set<string>();return sorted.filter(o=>{
  const ss=o.segments.filter(s=>s.leg_index===leg),from=leg?query.destination:query.origin,to=leg?query.origin:query.destination,date=leg?query.return_date:query.departure;
  if(!ss.length||ss[0].from!==from||ss.at(-1)!.to!==to||ss[0].departure_local.slice(0,10)!==date||leg===1&&(!o.complete||!o.segments.some(s=>s.leg_index===0)))return false;
  const key=JSON.stringify(ss.map(s=>[s.flight,s.from,s.to,s.departure_local,s.arrival_local,s.cabin]));if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,10);};
 const outbound=list(0),returns=query.return_date?list(1).filter(o=>o.complete&&o.segments.some(s=>s.leg_index===0)):[];
 const seen=new Set<string>(),allCombinations=query.return_date?sorted.filter(o=>{
  if(!o.complete||!validLeg(o,1))return false;
  const key=JSON.stringify(o.segments.map(s=>[s.leg_index,s.flight,s.from,s.to,s.departure_local,s.arrival_local,s.cabin]));
  if(seen.has(key))return false;seen.add(key);return true;
 }):[];
 // Reserve one cheapest representative for each of the first three outbound
 // schedules, then fill the remaining places by total price. Keep final order ascending.
 const representatives:Offer[]=[],outboundKeys=new Set<string>();
 for(const o of allCombinations){const key=outboundScheduleKey(o);if(outboundKeys.has(key))continue;outboundKeys.add(key);representatives.push(o);if(representatives.length===3)break;}
 const retained=new Set(representatives);
 const combinations=[...representatives,...allCombinations.filter(o=>!retained.has(o)).slice(0,10-representatives.length)].sort((a,b)=>a.money.minor-b.money.minor||a.offer_id.localeCompare(b.offer_id));
 const results=query.return_date?combinations:outbound;
 return {outbound,returns,combinations,results,hero:results[0]??null};
}
