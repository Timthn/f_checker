import { authenticate } from '@/server/auth';
import { error } from '@/server/http';
import { flexibleSchema } from '@/domain/analysis-contracts';
import { analyzeFlexible } from '@/server/analysis';
export const runtime='nodejs';
export async function POST(request:Request){const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);let body;try{body=await request.json();}catch{return error('INVALID_QUERY',422);}const q=flexibleSchema.safeParse(body);if(!q.success)return error('INVALID_QUERY',422,body?.locale);try{return Response.json(await analyzeFlexible(owner,q.data),{headers:{'Cache-Control':'no-store'}});}catch(e){return error(e instanceof Error&&e.message==='QUOTA'?'QUOTA_EXCEEDED':'PERSISTENCE_NOT_READY',e instanceof Error&&e.message==='QUOTA'?429:503,body?.locale);}}
