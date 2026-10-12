import { authenticate } from '@/server/auth';
import { error } from '@/server/http';
import { searchSchema } from '@/domain/contracts';
import { createJob,ensureWorkflow } from '@/server/jobs';
import { start } from 'workflow/api';
import { flightSearch } from '@/workflows/flight-search';
import {searchExecutionEnabled} from '@/server/execution-policy';
export const runtime='nodejs';
export async function POST(request:Request){
  const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);
  let body;try{body=await request.json();}catch{return error('INVALID_QUERY',422);}
  const parsed=searchSchema.safeParse(body);if(!parsed.success)return error('INVALID_QUERY',422,body?.locale,parsed.error.issues[0]?.path.join('.')??null);
  // Reference mode permits unknown candidate discovery; qualification remains separate.
  if(!searchExecutionEnabled()||!process.env.DATABASE_URL||!process.env.WORKER_DATABASE_URL||!process.env.APIFY_API_TOKEN)return error('PERSISTENCE_NOT_READY',503,body.locale);
  const key=request.headers.get('Idempotency-Key');if(!key||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(key))return error('IDEMPOTENCY_KEY_REQUIRED',422,body.locale);
  try{const job=await createJob(owner,parsed.data,key);await ensureWorkflow(owner,job.job_id,async id=>(await start(flightSearch,[id])).runId);return Response.json(job,{status:202,headers:{'Cache-Control':'no-store'}});}catch(e){return error(e instanceof Error&&e.message==='IDEMPOTENCY_CONFLICT'?'IDEMPOTENCY_CONFLICT':'PERSISTENCE_NOT_READY',409,body.locale);}
}
