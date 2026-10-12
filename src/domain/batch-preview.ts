// Browser-safe cost preview. Server admission remains authoritative for locks/budgets.
import {Temporal} from '@js-temporal/polyfill';
import {meetingSchema,flexibleSchema} from './analysis-contracts';
export function previewBatch(kind:'meeting'|'flexible',request:Record<string,unknown>){
 const q=(kind==='meeting'?meetingSchema:flexibleSchema).parse(request);
 const queries:Record<string,unknown>[]=[];
 if(kind==='meeting'){
  const m=q as ReturnType<typeof meetingSchema.parse>;
  const days=(request.departure_scope??'arrival_window')==='arrival_window'?[-2,-1,0].map(days=>Temporal.PlainDate.from(m.arrival_day).add({days}).toString()):null;
  for(const side of ['a','b'] as const){if(side==='a'&&m.lock_a)continue;for(const departure of days??[m[side].departure])queries.push({...m[side],departure});}
 }else{
  const f=q as ReturnType<typeof flexibleSchema.parse>;
  const first=Temporal.PlainDate.from(f.departure_from),last=Temporal.PlainDate.from(f.departure_to),back=Temporal.PlainDate.from(f.return_from),end=Temporal.PlainDate.from(f.return_to);
  if((first.until(last).days+1)*(back.until(end).days+1)>400)throw Error('QUOTA');
  for(let d=first;Temporal.PlainDate.compare(d,last)<=0;d=d.add({days:1}))for(let r=back;Temporal.PlainDate.compare(r,end)<=0;r=r.add({days:1}))queries.push({...f.base,departure:d.toString(),return_date:r.toString()});
 }
 const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
 const unique=[...new Map(queries.map(q=>[JSON.stringify(canonical(q)),q])).values()];
 const calls=unique.reduce((n,q)=>n+(q.return_date?2:1),0);
 return {queries:unique.length,calls,ceiling_microusd:calls*30000,over_call_limit:calls>40};
}
