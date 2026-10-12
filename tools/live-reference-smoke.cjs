// Explicit bounded live check, never included in automatic test suites.
// Real run reservations/data are retained, not refunded as synthetic QA.
const fs=require('node:fs'),path=require('node:path'),{randomUUID,randomBytes}=require('node:crypto'),{Client}=require('pg');
const root=fs.realpathSync(process.cwd()),ref='fpxnoiwaytkplrfsymyp',base='http://127.0.0.1:3000';
if(path.basename(root)!=='f_checker'||!process.version.startsWith('v24.')||process.env.FC_EXPLICIT_LIVE_CHECK!=='1')throw Error('EXPLICIT_PROJECT_NODE_AUTHORIZATION_REQUIRED');
process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
const dburl=new URL(process.env.MIGRATION_DATABASE_URL);
if(process.env.SUPABASE_URL!==`https://${ref}.supabase.co`||dburl.hostname!=='aws-0-ap-southeast-1.pooler.supabase.com'||decodeURIComponent(dburl.username)!==`postgres.${ref}`)throw Error('PROJECT_BOUNDARY');
const admin=new Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:fs.readFileSync('config/supabase-ca.crt','utf8')},connectionTimeoutMillis:10000});
const statePath=path.join(root,'data/live-reference-smoke-state.json'),resultPath=path.join(root,'data/live-reference-smoke-result.json');
const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{owner:randomUUID(),password:randomBytes(32).toString('hex'),dispatch_attempted:false};
const save=()=>fs.writeFileSync(statePath,JSON.stringify(state));save();
let browser,token;const result={passed:false,scope:'actual browser/Auth/API/SDK/Apify one-way discovery',restored_existing_job:state.dispatch_attempted,provider_build:'0.0.2',real_reservations_refunded:false};
const assert=(ok,code)=>{if(!ok)throw Error(code);},pause=ms=>new Promise(r=>setTimeout(r,ms));
async function request(route){const r=await fetch(base+route,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});assert(r.ok,`LOCAL_READ_HTTP_${r.status}`);return r.json();}
(async()=>{try{
 await admin.connect();
 const ledger=(await admin.query("select cap_microusd,reserved_microusd,calls_reserved from flight.budget_accounts where account_key='spike-lifetime'")).rows[0];
 result.ledger_before=ledger;assert(ledger&&Number(ledger.reserved_microusd)+30000<=Number(ledger.cap_microusd)||state.dispatch_attempted,'BUDGET_NOT_AVAILABLE');
 const health=await fetch(base+'/api/v1/health').then(r=>r.json());assert(health.reference_search_enabled===true&&health.provider_live_enabled===false,'REFERENCE_MODE_REQUIRED');
 if(!(await admin.query('select id from auth.users where id=$1',[state.owner])).rows.length){
  assert(!state.dispatch_attempted,'OWNER_MISSING_NO_REDISPATCH');
  await admin.query("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token) values('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{\"provider\":\"email\",\"providers\":[\"email\"]}','{}',now(),now(),'','','','','','','','')",[state.owner,`qa-live-${state.owner}@example.invalid`,state.password]);
 }
 const signin=await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:`qa-live-${state.owner}@example.invalid`,password:state.password}),signal:AbortSignal.timeout(30000)});
 assert(signin.ok,'QA_AUTH_FAILED');token=(await signin.json()).access_token;assert(typeof token==='string','QA_AUTH_SHAPE');
 const {chromium,expect}=require('@playwright/test');browser=await chromium.launch({headless:true,executablePath:process.env.FC_CHROMIUM_PATH});const page=await browser.newPage();
 await page.addInitScript(()=>localStorage.setItem('fc-locale','en'));await page.goto(base);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill(`qa-live-${state.owner}@example.invalid`);await page.getByLabel('Password',{exact:true}).fill(state.password);await page.locator('form.auth').getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible({timeout:20000});await page.getByRole('button',{name:'Find flights',exact:true}).click();
 if(!state.dispatch_attempted){
  await page.getByLabel('From',{exact:true}).fill('HKG');await page.getByLabel('To',{exact:true}).fill('NRT');await page.locator('input[name=departure]').fill('2026-11-10');await page.locator('input[name=return_date]').fill('');
  state.dispatch_attempted=true;save();
  const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/searches')&&r.request().method()==='POST',{timeout:35000});
  await page.locator('form.query button.primary').click();
  try{const r=await response;result.submit_http=r.status();const p=await r.json();if(r.ok){state.job_id=p.job_id;save();}}catch{result.submit_observation='timeout_recover_same_owner_job_only';}
 }
 if(!state.job_id){const rows=(await admin.query('select job_id from flight.jobs where owner_id=$1 order by created_at',[state.owner])).rows;assert(rows.length===1,'NO_UNIQUE_JOB_NO_REDISPATCH');state.job_id=rows[0].job_id;save();}
 result.job_id=state.job_id;
 // Restore only the existing pointer, never submit another paid request.
 await page.evaluate(({owner,job})=>localStorage.setItem(`fc-job:${owner}`,JSON.stringify({job_id:job})),{owner:state.owner,job:state.job_id});await page.reload();
 let data;
 for(let i=0;i<72;i++){data=await request(`/api/v1/jobs/${state.job_id}/results`);if(!['queued','running'].includes(data.status))break;await pause(5000);}
 result.status=data.status;result.safe_error=data.safe_error;result.returned_candidates=data.source_count;result.confirmed_count=data.confirmed.length;result.unknown_count=data.unknown.length;
 const calls=(await admin.query('select operation_key,phase,ceiling_microusd,reported_microusd,reads_reserved from flight.provider_calls where owner_id=$1 and job_id=$2',[state.owner,state.job_id])).rows;result.calls=calls;
 assert(calls.length===1&&calls[0].operation_key==='search','ONE_SEARCH_ONLY');assert(['partial','succeeded'].includes(data.status)&&data.source_count>0,'LIVE_CANDIDATES_NOT_OBSERVED');
 assert(data.confirmed.length===0&&data.unknown.length>0&&data.unknown.every(o=>o.time_verified===false&&o.price_complete===false),'UNKNOWN_RIGHTS_PRESERVED');
 await expect(page.locator('.fare-row')).not.toHaveCount(0,{timeout:20000});result.browser_candidates_visible=true;
 await page.getByRole('button',{name:'切换中文',exact:true}).click();await page.getByRole('button',{name:'Switch to English',exact:true}).click();
 assert((await admin.query('select count(*)::int n from flight.provider_calls where owner_id=$1 and job_id=$2',[state.owner,state.job_id])).rows[0].n===1,'LOCALE_STARTED_RUN');
 await page.screenshot({path:path.join(root,'data/live-reference-browser.png'),fullPage:true});result.passed=true;
 }catch(e){result.error=e instanceof Error&&/^[A-Z0-9_]+$/.test(e.message)?e.message:'LIVE_CHECK_FAILED_SAFE';}
 finally{if(browser)await browser.close();if(token)try{await fetch(`${process.env.SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});}catch{}try{result.ledger_after=(await admin.query("select cap_microusd,reserved_microusd,calls_reserved from flight.budget_accounts where account_key='spike-lifetime'")).rows[0];}catch{}await admin.end();fs.appendFileSync(path.join(root,'data/live-reference-attempts.jsonl'),JSON.stringify(result)+'\n');fs.writeFileSync(resultPath,JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;}
})();
