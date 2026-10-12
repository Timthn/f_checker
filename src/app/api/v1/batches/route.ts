import {authenticate} from '@/server/auth';
import {error} from '@/server/http';
import {admitBatch} from '@/server/batches';
import {ensureBatchWorkflow} from '@/server/batch-execution';
import {BatchPlanError,liveMeetingSchema,liveFlexibleSchema} from '@/domain/batch-contracts';
import {flightBatch} from '@/workflows/flight-batch';
import {start,getRun} from 'workflow/api';
import {batchExecutionEnabled} from '@/server/execution-policy';
export const runtime='nodejs';
export async function POST(request:Request){
 const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);
 let body;try{body=await request.json();}catch{return error('INVALID_QUERY',422);}
 if(!body||!['meeting','flexible'].includes(body.kind))return error('INVALID_QUERY',422);
 const parsed=(body.kind==='meeting'?liveMeetingSchema:liveFlexibleSchema).safeParse(body.request);if(!parsed.success)return error('INVALID_QUERY',422);
 const key=request.headers.get('Idempotency-Key');if(!key||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key))return error('IDEMPOTENCY_KEY_REQUIRED',422);
 if(!batchExecutionEnabled())return error('LIVE_PROVIDER_DISABLED',503);
 if(!process.env.DATABASE_URL)return error('PERSISTENCE_NOT_READY',503);
 try{
  const batch=await admitBatch(owner,body.kind,parsed.data,key);
  try{await ensureBatchWorkflow(owner,batch.batch_id,async id=>(await start(flightBatch,[id])).runId,async execution=>['failed','cancelled'].includes(await getRun(execution).status));}catch{return Response.json({batch_id:batch.batch_id,status:batch.status,reused:batch.reused,orchestration:'start_retry_required'},{status:202,headers:{'Cache-Control':'no-store'}});}
  return Response.json({batch_id:batch.batch_id,status:batch.status,reused:batch.reused},{status:202,headers:{'Cache-Control':'no-store'}});
 }catch(e){
  if(e instanceof BatchPlanError)return Response.json({error:{code:e.code,params:{required_microusd:e.required_microusd,available_microusd:e.available_microusd},retryable:false,field:null}},{status:409,headers:{'Cache-Control':'no-store'}});
  return error('PERSISTENCE_NOT_READY',503);
 }
}
