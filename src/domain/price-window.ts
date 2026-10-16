import {Temporal} from '@js-temporal/polyfill';
import {searchSchema} from './contracts';
import type {Search} from './contracts';
import type {RouteHistorySnapshot} from './route-history';
export type PriceWindow={query:Search;currency:string;points:{day:string;minor:number|null}[];mode:'trip'|'outbound'|'return'};
function calendarDay(day:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 try {const date=Temporal.PlainDate.from(day,{overflow:'reject'});return date.toString()===day?date:null;}catch{return null;}
}
const divide=(sum:bigint,count:number)=>Number(sum/BigInt(count))+Number(sum%BigInt(count))/count;

/** Summarizes observed daily travel-date prices; missing days never become samples. */
export function summarizePriceWindow(window:PriceWindow|undefined|null):{count:number;mean:number|null;median:number|null}{
 const empty={count:0,mean:null,median:null};
 if(!window || !searchSchema.safeParse(window.query).success || window.currency!==window.query.currency || !Array.isArray(window.points))return empty;
 const selected=calendarDay(window.query.departure);if(!selected)return empty;
 const from=selected.subtract({days:15}).toString(),to=selected.add({days:15}).toString();
 const daily=new Map<string,number|null>();
 for(const point of window.points){
  if(!point || !calendarDay(point.day) || point.day<from || point.day>to || point.minor===null || !Number.isSafeInteger(point.minor) || point.minor<=0)continue;
  if(!daily.has(point.day))daily.set(point.day,point.minor);
  else if(daily.get(point.day)!==point.minor)daily.set(point.day,null);
 }
 const values=[...daily.values()].filter((minor):minor is number=>minor!==null).sort((a,b)=>a-b),count=values.length;
 if(!count)return empty;
 const total=values.reduce((sum,minor)=>sum+BigInt(minor),0n),middle=Math.floor(count/2);
 const median=count%2?values[middle]:divide(BigInt(values[middle-1])+BigInt(values[middle]),2);
 return {count,mean:divide(total,count),median};
}

/** A captured publisher tag, independent of our own same-fare sample requirements or quote freshness. */
export function providerPriceSignal(history?:RouteHistorySnapshot|null):'low'|'typical'|'high'|null{
 if(!history || !['low','typical','high'].includes(history.price_level??''))return null;
 try {
  if(Temporal.Instant.from(history.observed_at).epochMilliseconds>Date.now())return null;
 }catch{return null;}
 return history.price_level;
}
