import {Temporal} from '@js-temporal/polyfill';
import type {RouteHistorySnapshot} from './route-history';
export function routeHistoryAverage(snapshot:RouteHistorySnapshot|null|undefined){
 const empty={mean:null as number|null,count:0,from:null as string|null,to:null as string|null};if(!snapshot)return empty;
 const end=Date.parse(snapshot.observed_at);if(!Number.isFinite(end)||end>Date.now())return empty;
 const until=new Date(end).toISOString().slice(0,10),from=Temporal.PlainDate.from(until).subtract({days:29}).toString();
 const rows=snapshot.points.filter(p=>{try{return /^\d{4}-\d{2}-\d{2}$/.test(p.day)&&Temporal.PlainDate.from(p.day,{overflow:'reject'}).toString()===p.day&&p.day>=from&&p.day<=until&&Number.isSafeInteger(p.minor)&&p.minor>0;}catch{return false;}});
 if(!rows.length||new Set(rows.map(p=>p.day)).size!==rows.length)return empty;
 const total=rows.reduce((sum,p)=>sum+BigInt(p.minor),0n),n=BigInt(rows.length),days=rows.map(p=>p.day).sort();
 return {mean:Number(total/n)+Number(total%n)/rows.length,count:rows.length,from:days[0],to:days.at(-1)!};
}
