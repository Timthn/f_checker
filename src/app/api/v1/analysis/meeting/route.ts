import { authenticate } from '@/server/auth';
import { error } from '@/server/http';
import { meetingSchema } from '@/domain/analysis-contracts';
import { analyzeMeeting } from '@/server/analysis';
export const runtime='nodejs';
export async function POST(request:Request){const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);let body;try{body=await request.json();}catch{return error('INVALID_QUERY',422);}const q=meetingSchema.safeParse(body);if(!q.success)return error('INVALID_QUERY',422,body?.locale);try{return Response.json(await analyzeMeeting(owner,q.data),{headers:{'Cache-Control':'no-store'}});}catch{return error('PERSISTENCE_NOT_READY',503,body?.locale);}}
