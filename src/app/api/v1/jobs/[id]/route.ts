import { authenticate } from '@/server/auth';
import { readJob } from '@/server/jobs';
import { error } from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))return error('NOT_FOUND',404);try{const job=await readJob(owner,id);return job?Response.json(job,{headers:{'Cache-Control':'no-store'}}):error('NOT_FOUND',404);}catch{return error('PERSISTENCE_NOT_READY',503);}}
