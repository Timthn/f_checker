export const runtime='nodejs';
export function GET(){return Response.json({healthy:true,provider_live_enabled:process.env.LIVE_PROVIDER_ENABLED==='true',reference_search_enabled:process.env.LIVE_REFERENCE_SEARCH_ENABLED==='true',database_configured:!!process.env.DATABASE_URL,contract_version:'1'},{headers:{'Cache-Control':'no-store'}});}
