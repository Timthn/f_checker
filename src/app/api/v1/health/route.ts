export const runtime='nodejs';
export function GET(){return Response.json({healthy:true,provider_live_enabled:false,database_configured:!!process.env.DATABASE_URL,contract_version:'1'});}
