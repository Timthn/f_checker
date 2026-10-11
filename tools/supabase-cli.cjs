// Project-local CLI state; all database URLs are read from ignored .env, never echoed.
const {spawnSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
const args=process.argv.slice(2),url=new URL(process.env.MIGRATION_DATABASE_URL);
if(url.hostname!=='aws-0-ap-southeast-1.pooler.supabase.com'||url.username!=='postgres.fpxnoiwaytkplrfsymyp')throw Error('PROJECT_BOUNDARY');
if(args[0]==='db'||args[0]==='migration'&&args[1]==='list'){
 url.searchParams.set('sslmode','verify-full');url.searchParams.set('sslrootcert',path.resolve('config/supabase-ca.crt'));
 args.push('--db-url',url.toString());
}
const env={...process.env,SUPABASE_HOME:path.resolve('data/supabase-cli'),SUPABASE_TELEMETRY_DISABLED:'1',NODE_EXTRA_CA_CERTS:path.resolve('config/supabase-ca.crt')};
const r=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js',...args],{env,encoding:'utf8',timeout:120000});
let out=(r.stdout??'')+(r.stderr??'');for(const s of [process.env.SUPABASE_DB_PASSWORD,encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)])out=out.replaceAll(s,'[REDACTED]');out=out.replace(/postgres(?:ql)?:\/\/\S+/g,'[DATABASE_URL]');fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/supabase-cli-last.log',out);console.log(out.slice(-6000));process.exitCode=r.status??1;
