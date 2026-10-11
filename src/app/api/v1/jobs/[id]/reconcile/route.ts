import { authenticate } from '@/server/auth';
import { error } from '@/server/http';
import { reconcileKnownRun } from '@/server/provider-reads';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))return error('NOT_FOUND',404);if(process.env.LIVE_PROVIDER_ENABLED!=='true')return error('PERSISTENCE_NOT_READY',503);try{const state=await reconcileKnownRun(owner,id);return state?Response.json(state,{headers:{'Cache-Control':'no-store'}}):error('NOT_FOUND',404);}catch(e){return error(e instanceof Error&&e.message==='READ_BUDGET_EXCEEDED'?'QUOTA_EXCEEDED':'PROVIDER_UNAVAILABLE',429);}}
