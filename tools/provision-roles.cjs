const fs=require('node:fs'),crypto=require('node:crypto'),{Client}=require('pg');
process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
async function main(){const migration=new URL(process.env.MIGRATION_DATABASE_URL);if(migration.username!=='postgres.fpxnoiwaytkplrfsymyp')throw Error('PROJECT_BOUNDARY');const ca=fs.readFileSync('config/supabase-ca.crt','utf8');const c=new Client({connectionString:migration.toString(),ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:10000});
 try{await c.connect();const {rows}=await c.query("select count(*)::int as n from pg_roles where rolname in ('fc_api','fc_worker')");if(rows[0].n!==2)throw Error('MIGRATION_REQUIRED');
 for(const [role,key] of [['fc_api','DATABASE_URL'],['fc_worker','WORKER_DATABASE_URL']]){
   if(process.env[key])continue;const password=crypto.randomBytes(32).toString('hex');
   await c.query(`alter role ${role} password '${password}'`);
   const url=new URL(migration);url.username=`${role}.fpxnoiwaytkplrfsymyp`;url.password=password;url.port='6543';
   fs.appendFileSync('.env',`\n${key}=${url.toString()}\n`);
 }
 console.log('Restricted runtime roles provisioned; passwords saved only in ignored .env.');
 }catch(e){console.log(JSON.stringify({ok:false,code:e.code||e.message}));process.exitCode=1;}finally{await c.end().catch(()=>{});}}
main();
