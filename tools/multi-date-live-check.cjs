// Explicit paid validation. Persistent state prevents a second batch after timeout.
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{Client}=require('pg');
const root=fs.realpathSync(process.cwd()),ref='fpxnoiwaytkplrfsymyp',base='http://127.0.0.1:3000';
if(path.basename(root)!=='f_checker'||!process.version.startsWith('v24.')||process.env.FC_EXPLICIT_MULTI_DATE_CHECK!=='1')throw Error('EXPLICIT_AUTHORIZATION_REQUIRED');
process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
const u=new URL(process.env.MIGRATION_DATABASE_URL);
if(process.env.SUPABASE_URL!==`https://${ref}.supabase.co`||u.hostname!=='aws-0-ap-southeast-1.pooler.supabase.com'||decodeURIComponent(u.username)!==`postgres.${ref}`)throw Error('PROJECT_BOUNDARY');
const ownerState=JSON.parse(fs.readFileSync('data/live-reference-smoke-state.json','utf8'));
const q={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
const request={base:q,departure_from:'2026-11-10',departure_to:'2026-11-11',return_from:'2026-11-17',return_to:'2026-11-17',min_nights:6,max_nights:8,strategy:'exhaustive',max_pairs:2,max_budget_microusd:120000};
const statePath='data/multi-date-live-state.json';
const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{owner:ownerState.owner,key:randomUUID(),request,dispatched:false};
if(state.owner!==ownerState.owner||JSON.stringify(state.request)!==JSON.stringify(request))throw Error('FROZEN_STATE_BOUNDARY');
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state));save();
const db=new Client({connectionString:u.toString(),ssl:{rejectUnauthorized:true,ca:fs.readFileSync('config/supabase-ca.crt','utf8')},connectionTimeoutMillis:10000});
const result={passed:false,scope:'actual two-date Auth/API/Workflow/Apify search-return; no booking/browser claim',reservations_refunded:false};
const assert=(ok,code)=>{if(!ok)throw Error(code);};const pause=ms=>new Promise(r=>setTimeout(r,ms));let token;
async function read(route){const r=await fetch(base+route,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});assert(r.ok,`READ_HTTP_${r.status}`);return r.json();}
async function calls(){return (await db.query('select p.call_id,i.ordinal,p.operation_key,p.phase,p.reported_microusd,p.reads_reserved from flight.batch_items i join flight.provider_calls p on p.owner_id=i.owner_id and p.job_id=i.child_job_id where i.owner_id=$1 and i.batch_id=$2 order by i.ordinal,p.created_at',[state.owner,state.id])).rows;}
const safeCalls=rows=>rows.map(({call_id,...safe})=>safe);
const callIdentity=rows=>JSON.stringify(rows.map(r=>[r.call_id,r.ordinal,r.operation_key]));
(async()=>{try{
 await db.connect();
 result.ledger_before=(await db.query("select cap_microusd,reserved_microusd,calls_reserved from flight.budget_accounts where account_key='spike-lifetime'")).rows[0];
 const cap=Number(result.ledger_before?.cap_microusd);assert([500000,540000].includes(cap),'UNEXPECTED_BUDGET_CAP');
 // Human approved USD0.50 -> USD0.54 for this exact two-pair validation.
 if(cap===500000){const changed=await db.query("update flight.budget_accounts set cap_microusd=540000 where account_key='spike-lifetime' and cap_microusd=500000 returning reserved_microusd,calls_reserved");assert(changed.rows.length===1,'BUDGET_APPROVAL_RACE');result.approved_cap_increase_microusd=40000;}
 const ledger=(await db.query("select cap_microusd,reserved_microusd from flight.budget_accounts where account_key='spike-lifetime'")).rows[0];
 assert(state.dispatched||Number(ledger.reserved_microusd)+120000<=Number(ledger.cap_microusd),'BUDGET_UNAVAILABLE');
 const health=await fetch(base+'/api/v1/health',{signal:AbortSignal.timeout(10000)}).then(r=>r.json());assert(health.reference_batch_enabled===true&&health.provider_live_enabled===false,'REFERENCE_BATCH_MODE_REQUIRED');
 const login=await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:`qa-live-${ownerState.owner}@example.invalid`,password:ownerState.password}),signal:AbortSignal.timeout(30000)});assert(login.ok,'QA_AUTH_FAILED');token=(await login.json()).access_token;
 if(!state.dispatched){state.dispatched=true;save();try{const r=await fetch(base+'/api/v1/batches',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':state.key},body:JSON.stringify({kind:'flexible',request:state.request}),signal:AbortSignal.timeout(35000)});const data=await r.json();assert(r.status===202,`ADMISSION_HTTP_${r.status}`);state.id=data.batch_id;save();}catch{result.submit_observation='restore original key only';}}
 if(!state.id){const found=(await db.query('select batch_id from flight.batches where owner_id=$1 and idempotency_key=$2',[state.owner,state.key])).rows;assert(found.length===1,'NO_UNIQUE_BATCH_NO_REDISPATCH');state.id=found[0].batch_id;save();}
 result.batch_id=state.id;
 let status,last='';for(let n=0;n<96;n++){status=await read(`/api/v1/batches/${state.id}`);const progress=JSON.stringify({status:status.status,items:status.items.map(i=>({ordinal:i.ordinal,status:i.status,phase:i.phase}))});if(progress!==last){console.log(progress);last=progress;}if(!['queued','running'].includes(status.status))break;await pause(5000);}
 const data=await read(`/api/v1/batches/${state.id}/results`);result.status=status.status;const before=await calls();result.calls=safeCalls(before);result.coverage=data.coverage;result.reference_cells=data.reference_cells;
 result.recommendations=data.reference_recommendations.map(r=>({offer_id:r.offer.offer_id,departure:r.offer.segments.find(s=>s.leg_index===0).departure_local.slice(0,10),return_date:r.offer.segments.find(s=>s.leg_index===1).departure_local.slice(0,10),money:r.offer.money,nights:r.nights,observed_at:r.offer.observed_at,expires_at:r.offer.expires_at,time_verified:r.offer.time_verified,price_complete:r.offer.price_complete}));
 result.candidates=data.source_candidates.map(g=>({ordinal:g.ordinal,departure:g.query.departure,return_date:g.query.return_date,returned_count:g.returned_count,shown:g.offers.length}));
 result.stored_price_evidence=(await db.query("select i.ordinal,count(*)::int as stored,count(*) filter(where o.payload->'quote_evidence'->>'state'='source_fields_matched')::int as fields_matched from flight.batch_items i join flight.offers o on o.owner_id=i.owner_id and o.job_id=i.child_job_id where i.owner_id=$1 and i.batch_id=$2 group by i.ordinal order by i.ordinal",[state.owner,state.id])).rows;
 assert(result.calls.length===4&&result.calls.every(c=>c.phase==='succeeded'),'FOUR_FINISHED_CALLS_REQUIRED');
 assert(['partial','succeeded'].includes(status.status)&&data.coverage.searched===2&&data.coverage.admitted===2,'TWO_DATES_NOT_SEARCHED');
 assert(result.reference_cells.length===2&&result.reference_cells.every(c=>c.money!==null),'TWO_FRESH_RETURN_QUOTES_REQUIRED');
 assert(data.recommendations.length===0&&result.recommendations.every(r=>!r.time_verified&&!r.price_complete),'UNKNOWN_RIGHTS_NOT_PRESERVED');
 assert(result.stored_price_evidence.every(e=>e.stored===e.fields_matched),'SOURCE_PRICE_FIELDS_NOT_MATCHED');
 assert(result.recommendations.every((r,i,a)=>i===0||r.money.minor>=a[i-1].money.minor),'REFERENCE_RANK_NOT_SORTED');
 // Only GET refresh: no new paid batch or run, compare durable call records.
 await read(`/api/v1/batches/${state.id}/results`);const refreshed=await calls();assert(callIdentity(refreshed)===callIdentity(before),'READ_REFRESH_CHANGED_CALLS');
 // Late billing metadata updates are legitimate and do not imply new dispatch.
 await pause(12000);const finalCalls=await calls();assert(callIdentity(finalCalls)===callIdentity(before),'CALL_MEMBERSHIP_CHANGED');result.calls=safeCalls(finalCalls);
 result.reported_microusd=result.calls.every(c=>c.reported_microusd!==null)?result.calls.reduce((sum,c)=>sum+Number(c.reported_microusd),0):null;result.passed=true;
 }catch(e){result.error=e instanceof Error&&/^[A-Z0-9_]+$/.test(e.message)?e.message:'MULTI_DATE_SAFE_FAILURE';}
 finally{if(token)try{await fetch(`${process.env.SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});}catch{}try{result.ledger_after=(await db.query("select cap_microusd,reserved_microusd,calls_reserved from flight.budget_accounts where account_key='spike-lifetime'")).rows[0];}catch{}await db.end();fs.appendFileSync('data/multi-date-live-attempts.jsonl',JSON.stringify(result)+'\n');fs.writeFileSync('data/multi-date-live-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;}
})();
