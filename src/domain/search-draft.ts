import {z} from 'zod';
import type {Search} from './contracts';
// Form drafts may contain temporarily empty fields; API admission still uses searchSchema.
const draftSchema=z.object({origin:z.string().max(80),destination:z.string().max(80),departure:z.string().max(20),return_date:z.string().max(20).optional(),cabin:z.enum(['economy','business']),adults:z.number().finite().min(0).max(6),currency:z.enum(['HKD','USD','EUR','JPY']),carry_on:z.number().finite().min(0).max(1),checked:z.number().finite().min(0).max(2),traveler_baggage:z.array(z.object({carry_on:z.number().int().min(0).max(1),checked:z.number().int().min(0).max(2)})).length(2).optional()});
export const searchDraftKey=(owner?:string)=>owner?`fc-search-form:v1:user:${owner}`:'fc-search-form:v1:guest';
type Reader={getItem:(key:string)=>string|null};
function json(raw:string|null){if(!raw||raw.length>16000)return null;try{return JSON.parse(raw);}catch{return null;}}
export function readSearchDraft(storage:Reader,owner?:string):Search|null{
 const saved=json(storage.getItem(searchDraftKey(owner)));
 const own=saved?.version===1?draftSchema.safeParse(saved.query):null;if(own?.success)return own.data;
 if(!owner)return null;
 // Upgrade the existing owner-scoped request snapshot without altering its recovery key/body.
 const legacy=json(storage.getItem(`fc-request:${owner}`));const parsed=draftSchema.safeParse(legacy?.payload??json(legacy?.query??null));return parsed.success?parsed.data:null;
}
export function serializeSearchDraft(query:Search){return JSON.stringify({version:1,query:draftSchema.parse(query)});}
