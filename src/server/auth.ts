import { createClient } from '@supabase/supabase-js';
export async function authenticate(request:Request):Promise<string|null>{
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const url=process.env.SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!token||!url||!key)return null;
  // Auth server verification also handles legacy HS256 safely; no JWT decode-only authorization.
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser(token);
  return !error&&data.user?data.user.id:null;
}
