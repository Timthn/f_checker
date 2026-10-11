import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'node:fs';
let api:Pool|undefined,worker:Pool|undefined;
export function pool(kind:'api'|'worker'){
  const connectionString=kind==='api'?process.env.DATABASE_URL:process.env.WORKER_DATABASE_URL;
  if(!connectionString)throw Error('PERSISTENCE_NOT_READY');
  const existing=kind==='api'?api:worker;if(existing)return existing;
  const created=new Pool({connectionString,max:2,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,ssl:{rejectUnauthorized:true,ca:readFileSync('config/supabase-ca.crt','utf8')}});
  if(kind==='api')api=created;else worker=created;return created;
}
export async function transaction<T>(kind:'api'|'worker',owner:string|null,fn:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await pool(kind).connect();try{await c.query('begin');if(kind==='api'){if(!owner)throw Error('AUTH_REQUIRED');await c.query("select set_config('app.user_id',$1,true)",[owner]);}const result=await fn(c);await c.query('commit');return result;}catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
