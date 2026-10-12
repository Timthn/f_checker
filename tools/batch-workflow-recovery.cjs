// Actual production flightBatch and child flightSearch, real SDK/SQL/Auth, with ONLY supplier IO replaced in an isolated clone.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process'),{randomUUID,randomBytes,createHash}=require('node:crypto'),{Client}=require('pg');
const root=fs.realpathSync(process.cwd());if(path.basename(root)!=='f_checker'||!process.version.startsWith('v24.'))throw Error('PROJECT_OR_NODE_BOUNDARY');
const owner=randomUUID(),nonce=randomUUID().replaceAll('-',''),password=randomBytes(32).toString('hex'),marker=randomBytes(32).toString('hex');
const target=path.join(root,'data',`batch-workflow-recovery-${nonce}`),worldDir=path.join(target,'world'),syntheticDir=path.join(target,'supplier');
const result={node:process.version,workflow:'src/workflows/flight-batch.ts',standalone_workflow:false,provider_io:'isolated synthetic fixture module',real_provider_calls:0,passed:false};
let admin,child,token,baseline,batchId,runId,members=[],childLog='',cleaned=false;
const assert=(condition,code)=>{if(!condition)throw Error(code);};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const contained=p=>{const resolved=path.resolve(p);assert(resolved.startsWith(root+path.sep),'PATH_BOUNDARY');return resolved;};
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function jsons(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?jsons(path.join(dir,e.name)):e.name.endsWith('.json')?[path.join(dir,e.name)]:[]);}
function readEntity(file){return JSON.parse(fs.readFileSync(file,'utf8'),(_k,v)=>v?.__type==='Uint8Array'?new Uint8Array(Buffer.from(v.data,'base64')):v);}
async function run(args,env,timeout){const proc=spawn(process.execPath,args,{cwd:target,env,stdio:['ignore','pipe','pipe']});let output='';proc.stdout.on('data',d=>output+=d);proc.stderr.on('data',d=>output+=d);const timer=setTimeout(()=>proc.kill('SIGKILL'),timeout);const status=await new Promise((resolve,reject)=>{proc.on('error',reject);proc.on('exit',resolve);});clearTimeout(timer);if(status!==0){let safe=output.slice(-2200);for(const secret of [password,marker,...Object.values(env).filter(v=>typeof v==='string'&&(v.includes('postgres')||v.length>100))])safe=safe.replaceAll(secret,'[REDACTED]');result.build_diagnostic=safe;}assert(status===0,'QA_BUILD_FAILED');}
async function stop(){if(!child)return;const owned=child;child=null;if(owned.exitCode===null){owned.kill('SIGKILL');await Promise.race([new Promise(r=>owned.once('exit',r)),pause(5000)]);assert(owned.exitCode!==null||owned.signalCode!==null,'OWNED_SERVER_TEARDOWN_FAILED');}}
async function boot(env,port){child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:target,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>childLog+=d);child.stderr.on('data',d=>childLog+=d);for(let i=0;i<60;i++){assert(child.exitCode===null,'QA_SERVER_EXITED');try{const r=await fetch(env.BASE_URL+'/api/v1/health',{signal:AbortSignal.timeout(1000)});if(r.ok)return;}catch{}await pause(500);}throw Error('QA_SERVER_NOT_READY');}

async function cleanup(){
 if(!admin||cleaned)return;
 await admin.query('begin');try{
  const batches=(await admin.query('select batch_id,accounting_period from flight.batches where owner_id=$1 for update',[owner])).rows;
  assert(batches.length<=1&&batches.every(b=>!batchId||b.batch_id===batchId),'QA_BATCH_SCOPE');
  if(batches.length&&!batchId)batchId=batches[0].batch_id;
  if(batches.length&&!members.length)members=(await admin.query('select ordinal,child_job_id from flight.batch_items where owner_id=$1 and batch_id=$2 order by ordinal',[owner,batchId])).rows;
  const calls=(await admin.query('select * from flight.provider_calls where owner_id=$1',[owner])).rows;
  for(const call of calls){
   if(call.phase==='reserved'&&!call.run_id)continue;
   const member=members.find(m=>m.child_job_id===call.job_id);
   const file=jsons(syntheticDir).map(readEntity).find(r=>call.run_id?r.runId===call.run_id:member&&r.child===String(member.ordinal)&&r.mode===call.operation_key);
   assert(file&&file.runId.startsWith('QAR'+nonce)&&['search','return'].includes(file.mode)&&members.some(m=>m.child_job_id===call.job_id),'SYNTHETIC_PROVENANCE_REQUIRED');
  }
  if(batches.length){
   const period=batches[0].accounting_period;
   const slots=(await admin.query("select state,call_id,ceiling_microusd from flight.batch_slots where owner_id=$1 and batch_id=$2 for update",[owner,batchId])).rows;
   assert(slots.length===4&&slots.every(s=>s.state!=='transferred'||calls.some(c=>c.call_id===s.call_id)),'QA_PREPAID_PROVENANCE');
   // Released held slots were already refunded by production. Refund the remaining
   // held/transferred synthetic slots exactly once, using admission's original month.
   const charged=slots.filter(s=>s.state!=='released'),amount=charged.reduce((n,s)=>n+BigInt(s.ceiling_microusd),0n);
   const keys=['spike-lifetime',`month:${period}`,`owner:${owner}:${period}`].sort();
   await admin.query('select account_key from flight.budget_accounts where account_key=any($1::text[]) order by account_key for update',[keys]);
   if(charged.length)await admin.query('update flight.budget_accounts set reserved_microusd=reserved_microusd-$2,calls_reserved=calls_reserved-$3 where account_key=any($1::text[])',[keys,amount.toString(),charged.length]);
  }
  for(const table of ['batch_slots','batch_items','batches','billing_evidence','route_history_snapshots','observations','calendar_cells','offers','checkpoints','provider_references','provider_calls','jobs','searches'])await admin.query(`delete from flight.${table} where owner_id=$1`,[owner]);
  await admin.query('delete from flight.budget_accounts where account_key like $1',[`owner:${owner}:%`]);
  for(const table of ['sessions','identities'])await admin.query(`delete from auth.${table} where user_id=$1`,[owner]);await admin.query('delete from auth.users where id=$1',[owner]);
  await admin.query('commit');cleaned=true;
  if(baseline)for(const before of baseline){const after=(await admin.query('select reserved_microusd,calls_reserved,cap_microusd from flight.budget_accounts where account_key=$1',[before.account_key])).rows[0];assert(after&&after.reserved_microusd===before.reserved_microusd&&after.calls_reserved===before.calls_reserved&&after.cap_microusd===before.cap_microusd,'BUDGET_BASELINE_CHANGED');}
  result.reservations_restored=true;
 }catch(e){await admin.query('rollback');throw e;}
}

async function main(){
 fs.mkdirSync(contained(target),{recursive:true});fs.mkdirSync(syntheticDir);fs.mkdirSync(path.join(target,'tmp'));
 for(const file of ['package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json'])fs.copyFileSync(path.join(root,file),path.join(target,file));
 for(const dir of ['src','config','docs/connectors/fixtures'])fs.cpSync(path.join(root,dir),path.join(target,dir),{recursive:true,filter:p=>!p.split(path.sep).includes('.well-known')});
 fs.symlinkSync(contained(path.join(root,'node_modules')),contained(path.join(target,'node_modules')),'junction');
 assert(fs.realpathSync(path.join(target,'node_modules'))===fs.realpathSync(path.join(root,'node_modules')),'DEPENDENCY_BOUNDARY');
 result.source_sha256={};for(const file of ['src/workflows/flight-batch.ts','src/workflows/flight-search.ts','src/server/batch-execution.ts','src/server/jobs.ts','src/server/provider-chain.ts','src/server/billing-evidence.ts','src/connectors/apify-chain.ts','src/domain/batch-contracts.ts']){result.source_sha256[file]=hash(path.join(root,file));assert(result.source_sha256[file]===hash(path.join(target,file)),'PRODUCTION_SOURCE_CHANGED');}
 // Only supplier I/O is replaced. All workflow, parsing, SQL and authentication are production.
 const source=`import {readFileSync,writeFileSync} from 'node:fs';
 import path from 'node:path';
 const dir=process.env.QA_SYNTHETIC_DIR!,nonce=process.env.QA_NONCE!,marker=process.env.QA_PRIVATE_MARKER!;
 function row(id:string){if(!id.startsWith('QAR'+nonce)&&!id.startsWith('QAD'+nonce))throw Error('QA_INVALID_ID');const suffix=id.slice(3+nonce.length);if(!/^[01](search|return)$/.test(suffix))throw Error('QA_INVALID_ID');return JSON.parse(readFileSync(path.join(dir,suffix+'.json'),'utf8'));}
 export async function startRun(input:any,_ceiling:number){
  const mode=input.mode;if(!['search','return'].includes(mode))throw Error('QA_INVALID_MODE');
  let child:string;if(mode==='search'){if(input.departure_date!=='2026-11-10'||!['2026-11-17','2026-11-18'].includes(input.return_date))throw Error('QA_QUERY_SCOPE');child=input.return_date==='2026-11-17'?'0':'1';}
  else{const match=typeof input.tokens?.[0]==='string'?input.tokens[0].match(new RegExp('^'+marker+'-([01])-')):null;if(!match)throw Error('QA_PRIVATE_REFERENCE_MISSING');child=match[1];}
  const suffix=child+mode,runId='QAR'+nonce+suffix,datasetId='QAD'+nonce+suffix,returnDate=child==='0'?'2026-11-17':'2026-11-18';
  writeFileSync(path.join(dir,suffix+'.json'),JSON.stringify({mode,child,runId,datasetId,returnDate,started:Date.now()}),{flag:'wx'});return {runId,datasetId};
 }
 export async function runStatus(id:string){const r=row(id),finished=r.started+5500,terminal=Date.now()>=finished;return {runId:r.runId,status:terminal?'SUCCEEDED':'RUNNING',usage:0,usageMicrousd:0,finishedAt:terminal?new Date(finished).toISOString():null,pricingInfo:{pricingModel:'FREE'},chargedEventCounts:{},platformUsageBillingModel:'DEVELOPER'};}
 export async function dataset(id:string){
  const r=row(id),name=r.mode==='search'?'round-trip-search':'return-options';
  const raw=readFileSync(path.join(process.cwd(),'docs/connectors/fixtures/apify-build-0.0.2',name+'.json'),'utf8');
  const data=JSON.parse(raw.replaceAll('2026-11-17',r.returnDate)).provider_response;data.scraped_at=new Date().toISOString();
  if(data.itineraries)for(let i=0;i<data.itineraries.length;i++){data.itineraries[i].departure_token=marker+'-'+r.child+'-departure-'+i;}
  return [data];
 }
 export async function accountData(kind:'user'|'limits'){return kind==='user'?{data:{plan:{id:'FREE',monthlyBasePriceUsd:0,monthlyUsageCreditsUsd:5}}}:{data:{monthlyUsageCycle:{startAt:new Date(Date.now()-86400000).toISOString(),endAt:new Date(Date.now()+86400000).toISOString()},limits:{maxMonthlyUsageUsd:5},current:{monthlyUsageUsd:0}}};}
 `;
 assert(!source.includes('api.apify')&&!source.includes('fetch('),'QA_PROVIDER_NETWORK_FORBIDDEN');fs.writeFileSync(path.join(target,'src/connectors/apify-rest.ts'),source);
 process.loadEnvFile(path.join(root,'.env'));process.loadEnvFile(path.join(root,'.env.migration'));
 assert(process.env.SUPABASE_URL==='https://fpxnoiwaytkplrfsymyp.supabase.co','PROJECT_BOUNDARY');const url=new URL(process.env.MIGRATION_DATABASE_URL);assert(url.hostname==='aws-0-ap-southeast-1.pooler.supabase.com'&&decodeURIComponent(url.username)==='postgres.fpxnoiwaytkplrfsymyp','MIGRATION_BOUNDARY');
 const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const env={PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH,SystemRoot:process.env.SystemRoot,ComSpec:process.env.ComSpec,TEMP:path.join(target,'tmp'),TMP:path.join(target,'tmp'),NEXT_TELEMETRY_DISABLED:'1',WORKFLOW_TARGET_WORLD:'local',WORKFLOW_LOCAL_DATA_DIR:worldDir,WORKFLOW_LOCAL_BASE_URL:`http://127.0.0.1:${port}`,WORKFLOW_LOCAL_RECOVER_ACTIVE_RUNS:'true',WORKFLOW_INLINE_OWNERSHIP_LEASE_SECONDS:'120',BASE_URL:`http://127.0.0.1:${port}`,LIVE_PROVIDER_ENABLED:'true',QA_SYNTHETIC_DIR:syntheticDir,QA_NONCE:nonce,QA_PRIVATE_MARKER:marker};
 for(const key of ['DATABASE_URL','WORKER_DATABASE_URL','SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])if(process.env[key])env[key]=process.env[key];
 assert(!env.APIFY_API_TOKEN&&!env.MIGRATION_DATABASE_URL,'RUNTIME_SECRET_BOUNDARY');
 result.qa_inline_ownership_lease_seconds=120;result.qa_completion_deadline_seconds=480;result.qa_lease_qualification='Supported SDK override only for this isolated, single owned local server; production default is unchanged.';
 console.log('BATCH_WORKFLOW_QA_BUILD_START');await run([path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],env,240000);result.build=true;
 admin=new Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(path.join(root,'config/supabase-ca.crt'),'utf8')},connectionTimeoutMillis:10000});await admin.connect();
 const period=new Date().toISOString().slice(0,7);baseline=(await admin.query('select account_key,reserved_microusd,calls_reserved,cap_microusd from flight.budget_accounts where account_key=any($1::text[])',[['spike-lifetime',`month:${period}`]])).rows;
 const life=baseline.find(b=>b.account_key==='spike-lifetime');assert(life&&BigInt(life.cap_microusd)-BigInt(life.reserved_microusd)>=120000n,'EXISTING_BUDGET_INSUFFICIENT');
 await admin.query("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token) values('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{\"provider\":\"email\",\"providers\":[\"email\"]}','{}',now(),now(),'','','','','','','','')",[owner,`qa-${owner}@example.invalid`,password]);
 const login=await fetch(process.env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:`qa-${owner}@example.invalid`,password}),signal:AbortSignal.timeout(30000)});assert(login.ok,'AUTH_LOGIN_FAILED');const auth=await login.json();assert(auth.user?.id===owner&&typeof auth.access_token==='string','AUTH_RESPONSE_INVALID');token=auth.access_token;result.real_auth=true;
 await boot(env,port);
 const response=await fetch(env.BASE_URL+'/api/v1/batches',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({kind:'flexible',request:{base:{origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0},departure_from:'2026-11-10',departure_to:'2026-11-10',return_from:'2026-11-17',return_to:'2026-11-18',min_nights:6,max_nights:10,max_budget_microusd:120000}}),signal:AbortSignal.timeout(30000)});assert(response.status===202,'BATCH_API_START_FAILED');batchId=(await response.json()).batch_id;assert(typeof batchId==='string','BATCH_ID_MISSING');
 members=(await admin.query('select ordinal,child_job_id from flight.batch_items where owner_id=$1 and batch_id=$2 order by ordinal',[owner,batchId])).rows;assert(members.length===2,'MEMBERSHIP_COUNT');
 const admitted=(await admin.query("select reserved_microusd,calls_reserved from flight.budget_accounts where account_key='spike-lifetime'")).rows[0];assert(BigInt(admitted.reserved_microusd)-BigInt(life.reserved_microusd)===120000n&&admitted.calls_reserved-life.calls_reserved===4,'WHOLE_BATCH_DEBIT_INVALID');
 let observed=false;
 for(let i=0;i<400;i++){
  const b=(await admin.query('select status,workflow_id from flight.batches where owner_id=$1 and batch_id=$2',[owner,batchId])).rows[0];assert(b&&!['failed','uncertain','cancelled'].includes(b.status),'BATCH_FAILED_BEFORE_RESTART');runId=b.workflow_id;
  const checkpoints=(await admin.query('select count(*)::int as n from flight.checkpoints where owner_id=$1',[owner])).rows[0].n;
  if(runId&&checkpoints>=1&&jsons(path.join(worldDir,'waits')).map(readEntity).some(w=>w.runId===runId&&w.status==='waiting')){observed=true;break;}await pause(150);
 }
 assert(observed&&runId,'PARENT_PENDING_SLEEP_NOT_OBSERVED');result.pending_parent_sleep_after_child_checkpoint=true;
 await stop();result.abrupt_restart=true;await boot(env,port);
 process.env.WORKFLOW_TARGET_WORLD='local';process.env.WORKFLOW_LOCAL_DATA_DIR=worldDir;process.env.WORKFLOW_LOCAL_BASE_URL=env.BASE_URL;process.env.WORKFLOW_LOCAL_RECOVER_ACTIVE_RUNS='false';
 const {getRun}=await import('workflow/api'),serde=await import('@workflow/core/serialization');
 let terminal,completedMembers,sdkCompleted=false;
 const completionDeadline=Date.now()+480000;
 while(Date.now()<completionDeadline){
  terminal=(await admin.query('select status,workflow_id from flight.batches where owner_id=$1 and batch_id=$2',[owner,batchId])).rows[0];
  completedMembers=(await admin.query('select i.ordinal,i.child_job_id,j.status,j.workflow_id from flight.batch_items i join flight.jobs j on j.owner_id=i.owner_id and j.job_id=i.child_job_id where i.owner_id=$1 and i.batch_id=$2 order by i.ordinal',[owner,batchId])).rows;
  if(terminal?.status==='partial'&&completedMembers.length===2&&completedMembers.every(m=>m.status==='partial'&&m.workflow_id)){
   const statuses=await Promise.all([runId,...completedMembers.map(m=>m.workflow_id)].map(id=>getRun(id).status));if(statuses.every(s=>s==='completed')){sdkCompleted=true;break;}
  }
  await pause(200);
 }
 assert(sdkCompleted,'SDK_BATCH_COMPLETION_TIMEOUT');
 assert(terminal.status==='partial'&&terminal.workflow_id===runId,'PARENT_EXECUTION_CHANGED');assert(JSON.stringify(completedMembers.map(m=>({ordinal:m.ordinal,child_job_id:m.child_job_id})))===JSON.stringify(members),'MEMBERSHIP_CHANGED');result.same_parent_execution_and_membership=true;
 const calls=(await admin.query('select job_id,operation_key,phase,run_id,reported_microusd from flight.provider_calls where owner_id=$1',[owner])).rows;
 assert(calls.length===4&&calls.every(c=>c.phase==='succeeded'&&Number(c.reported_microusd)===0),'SYNTHETIC_CALL_LEDGER_INVALID');assert(new Set(calls.map(c=>c.run_id)).size===4&&jsons(syntheticDir).length===4,'DUPLICATE_SYNTHETIC_START');
 for(const member of members)assert(JSON.stringify(calls.filter(c=>c.job_id===member.child_job_id).map(c=>c.operation_key).sort())===JSON.stringify(['return','search']),'EACH_CHILD_OPERATION_EXACTLY_ONCE');
 const endBudget=(await admin.query("select reserved_microusd,calls_reserved from flight.budget_accounts where account_key='spike-lifetime'")).rows[0];assert(endBudget.reserved_microusd===admitted.reserved_microusd&&endBudget.calls_reserved===admitted.calls_reserved,'PREPAID_DOUBLE_DEBIT');
 assert((await admin.query('select count(*)::int as n from flight.provider_references where owner_id=$1',[owner])).rows[0].n===0,'PRIVATE_REFERENCES_NOT_PURGED');
 for(const member of completedMembers){
  const quotes=(await admin.query("select payload from flight.offers where owner_id=$1 and job_id=$2 and payload->>'complete'='true'",[owner,member.child_job_id])).rows;
  assert(quotes.length>=1&&quotes.every(q=>q.payload.complete&&!q.payload.price_complete&&q.payload.quoted_adults===null&&!q.payload.time_verified),'UNKNOWN_FARE_CANDIDATES_REQUIRED');
  assert(quotes.every(q=>q.payload.segments.some(s=>s.leg_index===1&&s.departure_local.startsWith(member.ordinal===0?'2026-11-17':'2026-11-18'))),'FIXTURE_DATE_ECHO_INVALID');
 }

 const stable=(await admin.query("select count(distinct call_id)::int as n from flight.billing_evidence where owner_id=$1 and payload->>'classification'='settled_observation'",[owner])).rows[0].n;assert(stable===4,'DELAYED_BILLING_EVIDENCE_MISSING');
 const checkpointCount=(await admin.query('select count(*)::int as n from flight.checkpoints where owner_id=$1',[owner])).rows[0].n;assert(checkpointCount===4,'CHILD_CHECKPOINT_COUNT');
 // Awaited all three SDK completions including children's delayed final fees before teardown.
 await stop();let steps=0;
 for(const execution of [{id:runId,arg:batchId,parent:true},...completedMembers.map(m=>({id:m.workflow_id,arg:m.child_job_id,parent:false}))]){
  assert(await getRun(execution.id).returnValue===execution.arg,'SDK_RETURN_INVALID');
  const entity=readEntity(path.join(worldDir,'runs',execution.id+'.json'));assert(JSON.stringify(await serde.hydrateWorkflowArguments(entity.input,execution.id,undefined))===JSON.stringify([execution.arg]),'SDK_WORKFLOW_INPUT_INVALID');
  for(const file of jsons(path.join(worldDir,'steps',execution.id))){const step=readEntity(file);assert(step.status==='completed','SDK_STEP_INCOMPLETE');assert(JSON.stringify(await serde.hydrateStepArguments(step.input,execution.id,undefined))===JSON.stringify({args:[execution.arg]}),'SDK_STEP_INPUT_INVALID');const output=await serde.hydrateStepReturnValue(step.output,execution.id,undefined);assert(execution.parent?typeof output==='boolean':output===null||output===execution.arg,'SDK_STEP_OUTPUT_INVALID');steps++;}
 }
 assert(steps>0,'SDK_STEPS_MISSING');for(const file of jsons(worldDir)){const raw=fs.readFileSync(file,'utf8');for(const secret of [marker,token,password,process.env.APIFY_API_TOKEN,process.env.MIGRATION_DATABASE_URL,process.env.DATABASE_URL,process.env.WORKER_DATABASE_URL].filter(Boolean))assert(!raw.includes(secret),'SECRET_IN_SDK_WORLD');}
 Object.assign(result,{passed:true,synthetic_starts:4,provider_calls:4,child_checkpoints:4,decoded_steps:steps,terminal_status:'partial',both_unknown_fare_candidates:true,stable_synthetic_billing_calls:stable,private_references_purged:true,prepaid_no_double_debit:true,parent_execution_id:runId,batch_id:batchId,serialized_parameters_verified:true,world_directory:path.relative(root,worldDir),qualification:'Synthetic supplier I/O validates orchestration and persistence only; no live supplier capabilities, full platform costs or confirmed fares are proved.'});console.log('ACTUAL_FLIGHTBATCH_SDK_RESTART_PASSED');
}
main().catch(e=>{result.failure_code=/^[A-Z][A-Z0-9_:]+$/.test(e.message)?e.message:(e.code||'QA_UNCLASSIFIED_FAILURE');let detail=String(e.message),diagnostic=childLog.slice(-3000);for(const secret of [password,marker,token,process.env.DATABASE_URL,process.env.WORKER_DATABASE_URL,process.env.MIGRATION_DATABASE_URL,process.env.APIFY_API_TOKEN].filter(Boolean)){detail=detail.replaceAll(secret,'[REDACTED]');diagnostic=diagnostic.replaceAll(secret,'[REDACTED]');}result.failure_detail=detail;if(diagnostic)result.server_diagnostic=diagnostic;console.error(result.failure_code);process.exitCode=1;}).finally(async()=>{try{await stop();await cleanup();}catch(e){result.cleanup_failure=e.code||(/^[A-Z_]+$/.test(e.message)?e.message:'CLEANUP_FAILED');result.passed=false;process.exitCode=1;}finally{token=undefined;if(admin)await admin.end().catch(()=>{});fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.writeFileSync(path.join(root,'data',`batch-workflow-recovery-result-${nonce}.json`),JSON.stringify(result,null,2));}});
