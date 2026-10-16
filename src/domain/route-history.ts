import { z } from 'zod';
import { money,stableId } from './rules';
import { searchSchema,type Search } from './contracts';

export type RouteHistorySnapshot={query_fingerprint:string;currency:string;digits:number;observed_at:string;fetched_at:string;source:'apify/build0.0.2';scope:'provider_route_reference';price_scope:'provider_search_quote_unverified_party';date_semantics:'provider_epoch_utc_unverified';points:{day:string;epoch_seconds:number;minor:number}[];provider_lowest_minor:number|null;typical_range:[number,number]|null;price_level:'low'|'typical'|'high'|null};
const response=z.object({mode:z.literal('search'),scraped_at:z.iso.datetime({offset:true}),departure_airport:z.string(),arrival_airport:z.string(),departure_date:z.string(),return_date:z.string().nullable().optional(),currency:z.string(),adults:z.number(),trip_type:z.enum(['one_way','round_trip']),input:z.object({departure:z.string(),arrival:z.string(),departure_date:z.string(),return_date:z.string().optional(),currency:z.string(),adults:z.number(),children:z.literal(0),infants_in_seat:z.literal(0),infants_on_lap:z.literal(0),cabin_class:z.string(),carry_on_bags:z.number(),checked_bags:z.number()}),price_insights:z.object({price_history:z.array(z.tuple([z.number().int().nonnegative(),z.number().positive()])).max(400).default([]),lowest_price:z.number().positive().optional(),typical_price_range:z.tuple([z.number().positive(),z.number().positive()]).optional(),price_level:z.enum(['low','typical','high']).optional()})});
/** Epochs are plotted in UTC solely as a display convention: provider observation-zone and party-price semantics remain unverified. */
export function parseRouteHistory(raw:unknown,query:Search,observedAt:string):RouteHistorySnapshot|null{
 const q=searchSchema.safeParse(query),r=response.safeParse(raw),observed=z.iso.datetime({offset:true}).safeParse(observedAt);
 if(!q.success||!r.success||!observed.success)return null;
 const d=r.data,i=d.input,until=Date.parse(d.scraped_at),expectedReturn=q.data.return_date;
 if(!d.price_insights.price_history.length && !d.price_insights.price_level)return null;
 if(until>Date.parse(observedAt))return null;
 if(d.departure_airport!==query.origin||d.arrival_airport!==query.destination||d.departure_date!==query.departure||d.currency!==query.currency||d.adults!==query.adults||(d.return_date??undefined)!==expectedReturn||d.trip_type!==(expectedReturn?'round_trip':'one_way')||i.departure!==query.origin||i.arrival!==query.destination||i.departure_date!==query.departure||i.return_date!==expectedReturn||i.currency!==query.currency||i.adults!==query.adults||i.cabin_class!==query.cabin||i.carry_on_bags!==query.carry_on||i.checked_bags!==query.checked)return null;
 try{
  const points=d.price_insights.price_history.map(([epoch_seconds,value])=>{
   const ms=epoch_seconds*1000;
   if(!Number.isSafeInteger(ms)||ms>until)throw Error('INVALID_HISTORY_EPOCH');
   return {day:new Date(ms).toISOString().slice(0,10),epoch_seconds,minor:money(value,query.currency).minor};
  }).sort((a,b)=>a.epoch_seconds-b.epoch_seconds);
  // Ambiguous duplicates must not be averaged into invented historical observations.
  if(new Set(points.map(p=>p.day)).size!==points.length)return null;
  const range=d.price_insights.typical_price_range?.map(v=>money(v,query.currency).minor) as [number,number]|undefined;
  if(range&&range[0]>range[1])return null;
  return {query_fingerprint:stableId(q.data),currency:query.currency,digits:money(1,query.currency).digits,observed_at:new Date(until).toISOString(),fetched_at:new Date(observedAt).toISOString(),source:'apify/build0.0.2',scope:'provider_route_reference',price_scope:'provider_search_quote_unverified_party',date_semantics:'provider_epoch_utc_unverified',points,provider_lowest_minor:d.price_insights.lowest_price===undefined?null:money(d.price_insights.lowest_price,query.currency).minor,typical_range:range??null,price_level:d.price_insights.price_level??null};
 }catch{return null;}
}
