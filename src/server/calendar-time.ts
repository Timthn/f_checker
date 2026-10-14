import {z} from 'zod';
const timestamp=z.iso.datetime({offset:true});
function safeTime(value:unknown,upper:number):string|null{
 if(typeof value!=='string'||!timestamp.safeParse(value).success)return null;
 const ms=Date.parse(value);return Number.isFinite(ms)&&ms<=upper?new Date(ms).toISOString():null;
}
export function calendarTimestamps(raw:unknown,capturedAt=new Date().toISOString()){
 const captured_at=safeTime(capturedAt,Date.now());
 const source=raw!==null&&typeof raw==='object'&&!Array.isArray(raw)?(raw as {scraped_at?:unknown}).scraped_at:null;
 return {captured_at,observed_at:captured_at?safeTime(source,Date.parse(captured_at)):null};
}
export function calendarFreshness(evidence:{captured_at?:unknown;observed_at?:unknown}|null,now=Date.now()){
 const captured_at=safeTime(evidence?.captured_at,now),observed_at=captured_at?safeTime(evidence?.observed_at,Date.parse(captured_at)):null;
 const anchor=observed_at??captured_at,stale=anchor===null?null:now-Date.parse(anchor)>=15*60*1000;
 return {captured_at,observed_at,time_basis:observed_at?'source':captured_at?'capture':null,age_unknown:anchor===null,stale,freshness:stale===null?'unknown':stale?'stale':'fresh'};
}
