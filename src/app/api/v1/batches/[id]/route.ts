import {authenticate} from '@/server/auth';
import {error} from '@/server/http';
import {getBatch} from '@/server/batches';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);const {id}=await params;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return error('NOT_FOUND',404);
 try{const batch=await getBatch(owner,id);return batch?Response.json(batch,{headers:{'Cache-Control':'no-store'}}):error('NOT_FOUND',404);}catch{return error('PERSISTENCE_NOT_READY',503);}
}
