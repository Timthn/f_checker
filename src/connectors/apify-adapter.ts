import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { money, stableId } from '../domain/rules';
import type { Offer, Search, CalendarCell, Segment } from '../domain/contracts';
const segment=z.object({departure_airport:z.string(),arrival_airport:z.string(),departure_time:z.string(),arrival_time:z.string(),flight_number:z.string(),cabin_class:z.string(),duration_minutes:z.number()});
const leg=z.object({segments:z.array(segment).min(1),duration_minutes:z.unknown().optional()});
const candidate=z.object({legs:z.array(leg).min(1),price:z.number().nonnegative().nullable(),currency:z.string(),carry_on_bags_included:z.number().nullable().optional(),checked_bags_included:z.number().nullable().optional()});
const search=z.object({mode:z.enum(['search','return']),itineraries:z.array(candidate),scraped_at:z.iso.datetime(),trip_type:z.string().optional()});
const booking=z.object({mode:z.literal('booking'),legs:z.array(leg).min(1),trip_type:z.string(),scraped_at:z.iso.datetime(),booking_options:z.array(z.object({price:z.number().nonnegative(),currency:z.string(),baggage_prices:z.array(z.string()).optional()}))});
const calendar=z.object({mode:z.literal('calendar'),prices:z.array(z.object({departure_date:z.iso.date(),return_date:z.iso.date().nullable().optional(),price:z.number().nullable(),currency:z.enum(['HKD','USD','EUR','JPY']),display_price:z.string().nullable().optional(),is_priced:z.boolean()}))});
function elapsedDuration(legs:z.infer<typeof leg>[]):number|null{
 let total=0;
 for(const l of legs){const n=l.duration_minutes;if(typeof n!=='number'||!Number.isSafeInteger(n)||n<=0||l.segments.some(s=>!Number.isSafeInteger(s.duration_minutes)||s.duration_minutes<=0)||n<l.segments.reduce((sum,s)=>sum+s.duration_minutes,0))return null;total+=n;if(!Number.isSafeInteger(total))return null;}
 return total;
}
const segments=(legs:z.infer<typeof leg>[]):Segment[]=>legs.flatMap((l,leg_index)=>l.segments.map(s=>({leg_index,from:s.departure_airport,to:s.arrival_airport,departure_local:s.departure_time,arrival_local:s.arrival_time,departure_utc:null,arrival_utc:null,arrival_zone:null,flight:s.flight_number,cabin:s.cabin_class,duration:s.duration_minutes})));
export function parseSearch(raw:unknown,query:Search):Offer[] {
  const data=search.parse(raw);
  return data.itineraries.filter((c):c is typeof c & {price:number}=>c.price!==null).map(c=>{
    const ss=segments(c.legs),id=stableId(ss.map(s=>[s.from,s.to,s.departure_local,s.arrival_local,s.flight]));
    return {offer_id:randomUUID(),itinerary_id:id,comparison_key:null,money:money(c.price,c.currency),segments:ss,
      // Aggregate counts have no segment/passenger scope: retained as source evidence elsewhere, never promoted to included rights.
      baggage:[],price_complete:false,quoted_adults:null,duration_minutes:elapsedDuration(c.legs),complete:!query.return_date && data.mode==='search' && c.legs.length===1,fare_identity:null,source:'apify/build0.0.2',observed_at:data.scraped_at,expires_at:new Date(Date.parse(data.scraped_at)+900000).toISOString(),time_verified:false};
  });
}
export function parseBooking(raw:unknown,query:Search,selected:Segment[]):Offer[] {
  const data=booking.parse(raw),ss=segments(data.legs);
  const actual=stableId(ss.map(s=>[s.from,s.to,s.departure_local,s.arrival_local,s.flight]));
  const expected=stableId(selected.map(s=>[s.from,s.to,s.departure_local,s.arrival_local,s.flight]));
  if(actual!==expected || ss.some(s=>s.cabin!==query.cabin) || data.legs.length!==(query.return_date?2:1) || data.trip_type!==(query.return_date?'round_trip':'one_way'))throw Error('BOOKING_CONTEXT_MISMATCH');
  // Baggage free-text has no per-segment/per-passenger evidence. Never manufacture checked allowance or weights.
  return data.booking_options.filter(o=>o.currency===query.currency).map(o=>({offer_id:randomUUID(),itinerary_id:actual,comparison_key:null,money:money(o.price,o.currency),segments:ss,baggage:[],price_complete:false,quoted_adults:null,duration_minutes:elapsedDuration(data.legs),complete:true,fare_identity:null,source:'apify/build0.0.2/booking',observed_at:data.scraped_at,expires_at:new Date(Date.parse(data.scraped_at)+900000).toISOString(),time_verified:false}));
}
// Recognize only explicit, unambiguous currency formats. Never strip arbitrary text
// into a plausible number or choose one of two contradictory source prices.
function displayMinor(text:string,currency:string):number|null{
 const prefix={HKD:'HK\\$',USD:'(?:US\\$|\\$)',EUR:'€',JPY:'(?:JP¥|¥|￥)'}[currency];if(!prefix)return null;
 const match=new RegExp('^'+prefix+'\\s*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\\.[0-9]+)?)$').exec(text.trim());
 if(!match)return null;try{return money(match[1].replaceAll(',',''),currency).minor;}catch{return null;}
}
export function parseCalendar(raw:unknown):CalendarCell[]{return calendar.parse(raw).prices.map(p=>{
 const base={departure:p.departure_date,return_date:p.return_date??null};if(!p.is_priced||p.price===null)return {...base,money:null,state:'unknown'};
 const amount=money(p.price,p.currency);
 if(p.display_price!==undefined&&p.display_price!==null){const shown=displayMinor(p.display_price,p.currency);if(shown===null)return {...base,money:null,state:'unknown',evidence_reason:'unreadable_display_price'};if(shown!==amount.minor)return {...base,money:null,state:'unknown',evidence_reason:'price_display_conflict'};}
 return {...base,money:amount,state:'coarse'};
});}
