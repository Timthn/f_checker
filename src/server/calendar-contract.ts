import {z} from 'zod';
import {Temporal} from '@js-temporal/polyfill';
import {searchSchema,type CalendarCell} from '../domain/contracts';
import {parseCalendar} from '../connectors/apify-adapter';

// The calendar query is separate from flight search: one fixed return date,
// source route prices, no itinerary or passenger-rights verification.
export const calendarQuerySchema=z.object({query:searchSchema,window_days:z.number().int().min(1).max(30).default(30)}).refine(v=>!v.query.traveler_baggage,{message:'CALENDAR_REQUIRES_SINGLE_QUERY_CONTEXT'}).transform(v=>({...v.query,calendar_window_days:v.window_days}));
export type CalendarQuery=z.infer<typeof calendarQuerySchema>;
export function calendarDays(q:CalendarQuery){const center=Temporal.PlainDate.from(q.departure);return Array.from({length:q.calendar_window_days*2+1},(_,i)=>center.add({days:i-q.calendar_window_days}).toString());}
export function calendarInput(q:CalendarQuery){return {mode:'calendar',routes:[`${q.origin}-${q.destination}`],departure_date:q.departure,...(q.return_date?{return_date:q.return_date}:{}),adults:q.adults,cabin_class:q.cabin,currency:q.currency,carry_on_bags:q.carry_on,checked_bags:q.checked,date_window_days:q.calendar_window_days,maxConcurrency:1,maxRetries:0};}
export function calendarResult(raw:unknown,q:CalendarQuery):CalendarCell[]{
 const d=z.object({mode:z.literal('calendar'),endpoint:z.literal('/v1/serp/google_flights_calendar'),input:z.object({departure:z.string(),arrival:z.string(),departure_date:z.string(),return_date:z.string().nullable().optional(),adults:z.number(),currency:z.string(),date_window_days:z.number()}),departure_airport:z.string(),arrival_airport:z.string(),currency:z.string(),adults:z.number(),prices:z.array(z.object({currency:z.string()})).max(61)}).parse(raw);
 if(d.departure_airport!==q.origin||d.arrival_airport!==q.destination||d.currency!==q.currency||d.adults!==q.adults||d.input.departure!==q.origin||d.input.arrival!==q.destination||d.input.departure_date!==q.departure||(d.input.return_date??null)!==(q.return_date??null)||d.input.adults!==q.adults||d.input.currency!==q.currency||d.input.date_window_days!==q.calendar_window_days)throw Error('PROVIDER_SCHEMA_CHANGED');
 if(d.prices.some(p=>p.currency!==q.currency))throw Error('PROVIDER_SCHEMA_CHANGED');
 const days=calendarDays(q),allowed=new Set(days),cells=parseCalendar(raw),byDay=new Map<string,CalendarCell>();
 if(cells.length>61)throw Error('PROVIDER_SCHEMA_CHANGED');
 for(const cell of cells){if(!allowed.has(cell.departure)||cell.return_date!==(q.return_date??null)||cell.money&&cell.money.currency!==q.currency||byDay.has(cell.departure))throw Error('PROVIDER_SCHEMA_CHANGED');byDay.set(cell.departure,cell);}
 return days.map(departure=>byDay.get(departure)??{departure,return_date:q.return_date??null,money:null,state:'unknown'});
}
