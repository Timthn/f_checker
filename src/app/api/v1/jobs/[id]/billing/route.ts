import {authenticate} from '@/server/auth';
import {error} from '@/server/http';
import {publicJobBilling,reconcileJobBilling} from '@/server/billing-evidence';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))return error('NOT_FOUND',404);try{const result=await publicJobBilling(owner,id);return result?Response.json(result,{headers:{'Cache-Control':'no-store'}}):error('NOT_FOUND',404);}catch{return error('PERSISTENCE_NOT_READY',503);}}
export async function POST(request:Request,{params}:Context){const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))return error('NOT_FOUND',404);if(process.env.LIVE_PROVIDER_ENABLED!=='true')return error('LIVE_PROVIDER_DISABLED',503);try{const result=await reconcileJobBilling(owner,id);return result?Response.json(result,{headers:{'Cache-Control':'no-store'}}):error('NOT_FOUND',404);}catch{return error('BILLING_RECONCILE_REQUIRED',409);}}
