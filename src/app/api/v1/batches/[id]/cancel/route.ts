import {authenticate} from '@/server/auth';
import {error} from '@/server/http';
import {cancelBatch} from '@/server/batches';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const owner=await authenticate(request);if(!owner)return error('AUTH_REQUIRED',401);const {id}=await params;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return error('NOT_FOUND',404);
 try{return await cancelBatch(owner,id)?Response.json({batch_id:id,cancel_requested:true},{status:202,headers:{'Cache-Control':'no-store'}}):error('NOT_FOUND',404);}catch{return error('PERSISTENCE_NOT_READY',503);}
}
