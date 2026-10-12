// Explicit actual-provider check. Real rows/reservations remain; no synthetic refund.
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{Client}=require('pg');
const root=fs.realpathSync(process.cwd()),ref='fpxnoiwaytkplrfsymyp',base='http://127.0.0.1:3000';
if(path.basename(root)!=='f_checker'||!process.version.startsWith('v24.')||process.env.FC_EXPLICIT_BATCH_CHECK!=='1')throw Error('EXPLICIT_AUTHORIZATION_REQUIRED');
process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
const u=new URL(process.env.MIGRATION_DATABASE_URL);if(process.env.SUPABASE_URL!==`https://${ref}.supabase.co`||u.hostname!=='aws-0-ap-southeast-1.pooler.supabase.com'||decodeURIComponent(u.username)!==`postgres.${ref}`)throw Error('PROJECT_BOUNDARY');
const ownerState=JSON.parse(fs.readFileSync('data/live-reference-smoke-state.json','utf8'));
const statePath='data/live-batch-smoke-state.json',state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{owner:ownerState.owner,batches:{}};
if(state.owner!==ownerState.owner)throw Error('QA_OWNER_BOUNDARY');const save=()=>fs.writeFileSync(statePath,JSON.stringify(state));
const db=new Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:fs.readFileSync('config/supabase-ca.crt','utf8')},connectionTimeoutMillis:10000});
const result={passed:false,scope:'actual Auth/API/Workflow/Apify reference batches; not browser fresh-click E2E',batches:[],reservations_refunded:false};let token;
const assert=(ok,code)=>{if(!ok)throw Error(code);};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function read(route){const r=await fetch(base+route,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});assert(r.ok,`READ_HTTP_${r.status}`);return r.json();}
(async()=>{try{
await db.connect();result.ledger_before=(await db.query("select cap_microusd,reserved_microusd,calls_reserved from flight.budget_accounts where account_key='spike-lifetime'")).rows[0];
assert(result.ledger_before&&Number(result.ledger_before.reserved_microusd)+120000<=Number(result.ledger_before.cap_microusd)||Object.values(state.batches).some(b=>b.dispatched),'BUDGET_UNAVAILABLE');
const h=await fetch(base+'/api/v1/health').then(r=>r.json());assert(h.reference_batch_enabled===true&&h.provider_live_enabled===false,'REFERENCE_BATCH_MODE_REQUIRED');
const login=await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:`qa-live-${ownerState.owner}@example.invalid`,password:ownerState.password}),signal:AbortSignal.timeout(30000)});assert(login.ok,'QA_AUTH_FAILED');token=(await login.json()).access_token;
const q={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
const requests={meeting:{a:q,b:{...q,origin:'SIN'},arrival_day:'2026-11-10',max_minutes:60,departure_scope:'fixed_departures',max_budget_microusd:60000},flexible:{base:q,departure_from:'2026-11-10',departure_to:'2026-11-10',return_from:'2026-11-17',return_to:'2026-11-17',min_nights:6,max_nights:8,max_budget_microusd:60000}};
for(const kind of ['meeting','flexible']){
const b=state.batches[kind]??{key:randomUUID(),request:requests[kind],dispatched:false};state.batches[kind]=b;save();
if(!b.dispatched){b.dispatched=true;save();try{const r=await fetch(base+'/api/v1/batches',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':b.key},body:JSON.stringify({kind,request:b.request}),signal:AbortSignal.timeout(35000)});const p=await r.json();assert(r.status===202,`ADMISSION_HTTP_${r.status}`);b.id=p.batch_id;save();}catch(e){result.submit_observation='original-key job recovery only';}}
if(!b.id){const rows=(await db.query('select batch_id from flight.batches where owner_id=$1 and idempotency_key=$2',[state.owner,b.key])).rows;assert(rows.length===1,'NO_UNIQUE_BATCH_NO_REDISPATCH');b.id=rows[0].batch_id;save();}
let status;for(let n=0;n<96;n++){status=await read(`/api/v1/batches/${b.id}`);if(!['queued','running'].includes(status.status))break;await pause(5000);}
const data=await read(`/api/v1/batches/${b.id}/results`);
const calls=(await db.query('select p.operation_key,p.phase,p.reported_microusd,p.reads_reserved from flight.batch_items i join flight.provider_calls p on p.owner_id=i.owner_id and p.job_id=i.child_job_id where i.owner_id=$1 and i.batch_id=$2 order by i.ordinal,p.created_at',[state.owner,b.id])).rows;
const evidence={kind,batch_id:b.id,status:status.status,calls,coverage:data.coverage,priced_candidates:data.source_candidates.reduce((n,g)=>n+g.returned_count,0),shown_candidates:data.source_candidates.reduce((n,g)=>n+g.offers.length,0),confirmed_recommendations:kind==='meeting'?data.pairs.length:data.recommendations.length};result.batches.push(evidence);
assert(calls.length===2&&calls.every(c=>c.phase==='succeeded'),'EXPECTED_TWO_FINISHED_CALLS');assert(['partial','succeeded'].includes(status.status)&&evidence.priced_candidates>0,'LIVE_BATCH_RESULTS_MISSING');assert(evidence.confirmed_recommendations===0,'UNKNOWN_RIGHTS_NOT_PRESERVED');
}
result.passed=true;
}catch(e){result.error=e instanceof Error&&/^[A-Z0-9_]+$/.test(e.message)?e.message:'LIVE_BATCH_SAFE_FAILURE';}
finally{if(token)try{await fetch(`${process.env.SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});}catch{}try{result.ledger_after=(await db.query("select cap_microusd,reserved_microusd,calls_reserved from flight.budget_accounts where account_key='spike-lifetime'")).rows[0];}catch{}await db.end();fs.appendFileSync('data/live-batch-attempts.jsonl',JSON.stringify(result)+'\n');fs.writeFileSync('data/live-batch-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;}
})();
