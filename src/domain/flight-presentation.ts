import {Temporal} from '@js-temporal/polyfill';
import type {Segment} from './contracts';
function localClock(value:string){if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?$/.test(value))return null;try{return Temporal.PlainDateTime.from(value,{overflow:'reject'});}catch{return null;}}
const directory:Record<string,{en:string;zh:string}>={GK:{en:'Jetstar Japan',zh:'捷星日本'},UO:{en:'HK Express',zh:'香港快运'},HB:{en:'Greater Bay Airlines',zh:'大湾区航空'},MM:{en:'Peach Aviation',zh:'乐桃航空'},SL:{en:'Thai Lion Air',zh:'泰国狮航'},BR:{en:'EVA Air',zh:'长荣航空'}};
export function airlineLabel(s:Segment,locale:string){
 const code=s.airline_code?.trim().toUpperCase()||/^([A-Z0-9]{2})\s*\d/.exec(s.flight)?.[1];
 const known=code&&directory[code];
 if(s.airline?.trim())return {name:s.airline.trim(),basis:'source' as const};
 return known?{name:locale==='en'?known.en:known.zh,basis:'flight_code' as const}:{name:locale==='en'?'Airline unavailable':'航空公司未知',basis:'unknown' as const};
}
export function presentLocalTime(value:string,locale:string){
 const clock=localClock(value);if(!clock)return {clock:'—',date:'—',day:null};
 const day=clock.toPlainDate().toString();
 return {clock:`${String(clock.hour).padStart(2,'0')}:${String(clock.minute).padStart(2,'0')}`,date:new Intl.DateTimeFormat(locale,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${day}T00:00:00Z`)),day};
}
export function localDayChange(from:string,to:string){const a=localClock(from),b=localClock(to);return a&&b?a.toPlainDate().until(b.toPlainDate()).days:null;}
export function departureWindow(day:string,radius=30){if(!Number.isInteger(radius)||radius<1||radius>30)throw Error('INVALID_WINDOW');const d=Temporal.PlainDate.from(day);return Array.from({length:radius*2+1},(_,i)=>d.add({days:i-radius}).toString());}
