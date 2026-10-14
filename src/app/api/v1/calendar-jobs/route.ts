import {authenticate} from '@/server/auth';
import {error} from '@/server/http';
import {calendarQuerySchema} from '@/server/calendar-contract';
import {createCalendarJob} from '@/server/calendar-jobs';
import {ensureWorkflow} from '@/server/jobs';
import {searchExecutionEnabled} from '@/server/execution-policy';
import {start} from 'workflow/api';
import {flightCalendar} from '@/workflows/flight-calendar';
export const runtime='nodejs';
export async function POST(request:Request){
 const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);
 let body;try{body=await request.json();}catch{return error('INVALID_QUERY',422);}
 const parsed=calendarQuerySchema.safeParse(body);if(!parsed.success)return error('INVALID_QUERY',422,body?.locale);
 const key=request.headers.get('Idempotency-Key');if(!key||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key))return error('IDEMPOTENCY_KEY_REQUIRED',422,body?.locale);
 if(!searchExecutionEnabled()||!process.env.DATABASE_URL||!process.env.WORKER_DATABASE_URL||!process.env.APIFY_API_TOKEN)return error('PERSISTENCE_NOT_READY',503,body?.locale);
 try{const job=await createCalendarJob(owner,parsed.data,key);await ensureWorkflow(owner,job.job_id,async id=>(await start(flightCalendar,[id])).runId);return Response.json(job,{status:202,headers:{'Cache-Control':'no-store'}});}catch(e){return error(e instanceof Error&&e.message==='IDEMPOTENCY_CONFLICT'?'IDEMPOTENCY_CONFLICT':'PERSISTENCE_NOT_READY',e instanceof Error&&e.message==='IDEMPOTENCY_CONFLICT'?409:503,body?.locale);}
}
