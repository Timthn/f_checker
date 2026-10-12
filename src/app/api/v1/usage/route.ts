import { authenticate } from '@/server/auth';
import { error } from '@/server/http';
import { ownerUsage } from '@/server/usage';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const owner = await authenticate(request);
  if (!owner) return error('AUTH_REQUIRED', 401);
  try { return Response.json(await ownerUsage(owner), { headers: { 'Cache-Control': 'no-store', 'Vary': 'Authorization' } }); }
  catch { return error('PERSISTENCE_NOT_READY', 503); }
}
