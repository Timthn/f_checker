import { authenticate } from '@/server/auth';
import { cancelJob } from '@/server/jobs';
import { error } from '@/server/http';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))return error('NOT_FOUND',404);try{const result=await cancelJob(owner,id);return result?Response.json({job_id:id,cancel_requested:true},{status:202}):error('NOT_FOUND',404);}catch{return error('PERSISTENCE_NOT_READY',503);}}
