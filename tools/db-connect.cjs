const {Client}=require('pg');
process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
async function main(){const client=new Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:require('node:fs').readFileSync('config/supabase-ca.crt','utf8')},connectionTimeoutMillis:10000});try{await client.connect();const r=await client.query('select current_database() as db, current_user as role');console.log(JSON.stringify({connected:true,...r.rows[0]}));}catch(e){console.log(JSON.stringify({connected:false,code:e.code||'CONNECTION_FAILED'}));process.exitCode=1;}finally{await client.end().catch(()=>{});}}
main();
