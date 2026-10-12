// Explicit human request: USD5 personal-use budget. No reservation/call reset or provider IO.
const fs=require('node:fs'),path=require('node:path'),{Client}=require('pg');
if(fs.realpathSync(process.cwd()).toLowerCase()!==path.resolve('C:/Users/Tim Ngan/Desktop/projects/f_checker').toLowerCase())throw Error('WORKSPACE_BOUNDARY');
process.loadEnvFile('.env.migration');
async function main(){
 const url=new URL(process.env.MIGRATION_DATABASE_URL);
 if(url.hostname!=='aws-0-ap-southeast-1.pooler.supabase.com'||decodeURIComponent(url.username)!=='postgres.fpxnoiwaytkplrfsymyp')throw Error('PROJECT_BOUNDARY');
 const db=new Client({connectionString:url.toString(),ssl:{rejectUnauthorized:true,ca:fs.readFileSync('config/supabase-ca.crt','utf8')},connectionTimeoutMillis:10000});
 try{await db.connect();await db.query('begin');
 const period=new Date().toISOString().slice(0,7);
 const before=(await db.query("select * from flight.budget_accounts where account_key='spike-lifetime' or account_key=$1 or account_key like $2 order by account_key for update",[`month:${period}`,`owner:%:${period}`])).rows;
 if(!before.some(r=>r.account_key==='spike-lifetime'))throw Error('LEDGER_MISSING');
 for(const row of before){
  if(BigInt(row.reserved_microusd)>5000000n||BigInt(row.cap_microusd)>5000000n)throw Error('BUDGET_CONFLICT');
  await db.query('update flight.budget_accounts set cap_microusd=5000000 where account_key=$1',[row.account_key]);
 }
 const after=(await db.query("select * from flight.budget_accounts where account_key='spike-lifetime' or account_key=$1 or account_key like $2 order by account_key",[`month:${period}`,`owner:%:${period}`])).rows;
 if(after.length!==before.length||after.some((r,i)=>r.account_key!==before[i].account_key||r.reserved_microusd!==before[i].reserved_microusd||r.calls_reserved!==before[i].calls_reserved||r.call_cap!==before[i].call_cap||String(r.cap_microusd)!=='5000000'))throw Error('LEDGER_CHANGED');
 await db.query('commit');
 const life=after.find(r=>r.account_key==='spike-lifetime');
 const safe={configured_at:new Date().toISOString(),cap_microusd:life.cap_microusd,reserved_microusd:life.reserved_microusd,calls_reserved:life.calls_reserved,call_cap:life.call_cap,accounts_updated:after.length,counters_preserved:true,provider_calls_sent:0};
 fs.writeFileSync('data/personal-budget-configuration.json',JSON.stringify(safe,null,2));console.log(JSON.stringify(safe));
 }catch(e){try{await db.query('rollback');}catch{}throw e;}finally{await db.end();}
}
main().catch(e=>{console.error(e.code??e.message??'BUDGET_CONFIGURATION_FAILED');process.exitCode=1;});
