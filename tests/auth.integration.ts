import { beforeAll,afterAll,it,expect } from 'vitest';
import { Client } from 'pg';
import { randomUUID,randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableId } from '../src/domain/rules';
import type { Search,Offer,Segment } from '../src/domain/contracts';

process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
const ref='fpxnoiwaytkplrfsymyp',base='http://127.0.0.1:3000';
if(process.env.SUPABASE_URL!==`https://${ref}.supabase.co`)throw Error('PROJECT_BOUNDARY');
const admin=new Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:readFileSync('config/supabase-ca.crt','utf8')},connectionTimeoutMillis:10000});
const owners=[randomUUID(),randomUUID()],password=randomBytes(32).toString('hex'),tokens:string[]=[],jobs:string[]=[],offerIds:string[]=[];
const query:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',return_date:'2026-11-17',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
let baseline:string;
const connection=new URL(process.env.MIGRATION_DATABASE_URL!);
if(connection.hostname!=='aws-0-ap-southeast-1.pooler.supabase.com'||decodeURIComponent(connection.username)!==`postgres.${ref}`)throw Error('PROJECT_BOUNDARY');

async function call(path:string,owner=0,body?:unknown){return fetch(`${base}${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${tokens[owner]}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});}
function offer(origin:string,index:number,minor=90000):Offer{
 const offset=index?30:0;
 const outbound:Segment={leg_index:0,from:origin,to:'NRT',departure_local:'2026-11-10T14:00:00',arrival_local:`2026-11-10T19:${String(5+offset).padStart(2,'0')}:00`,departure_utc:'2026-11-10T06:00:00Z',arrival_utc:`2026-11-10T10:${String(5+offset).padStart(2,'0')}:00Z`,arrival_zone:'Asia/Tokyo',flight:`QA SYNTHETIC ${index}`,cabin:'economy',duration:245+offset};
 const back:Segment={...outbound,leg_index:1,from:'NRT',to:origin,departure_local:'2026-11-17T08:15:00',arrival_local:'2026-11-17T12:40:00',departure_utc:'2026-11-16T23:15:00Z',arrival_utc:'2026-11-17T04:40:00Z',arrival_zone:origin==='HKG'?'Asia/Hong_Kong':'Asia/Singapore',flight:`QA SYNTHETIC RETURN ${index}`,duration:325};
 const id=randomUUID();return {offer_id:id,itinerary_id:stableId([outbound,back]),comparison_key:`qa:${owners[0]}:${origin}`,money:{minor,currency:'HKD',digits:2},segments:[outbound,back],baggage:[0,1].map(segment=>({segment,passenger:0,carry_on:0,checked:0,carry_kg:null,checked_kg:null,source:'synthetic_qa_only',contradictory:false})),complete:true,price_complete:true,quoted_adults:1,duration_minutes:570+offset,fare_identity:'synthetic_qa_only',source:'synthetic_qa_only',observed_at:new Date().toISOString(),expires_at:new Date(Date.now()+900000).toISOString(),time_verified:true};
}
async function save(job:string,o:Offer,key:string){await admin.query('insert into flight.offers(owner_id,offer_id,job_id,itinerary_id,comparison_key,provider_result_key,observed_at,expires_at,payload) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[owners[0],o.offer_id,job,o.itinerary_id,o.comparison_key,key,o.observed_at,o.expires_at,o]);}
beforeAll(async()=>{
 await admin.connect();baseline=(await admin.query("select reserved_microusd from flight.budget_accounts where account_key='spike-lifetime'")).rows[0].reserved_microusd;
 for(const owner of owners){
  // Test-only password seed, no signup email or service-role key. Never log password/token.
  await admin.query("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token) values('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{\"provider\":\"email\",\"providers\":[\"email\"]}','{}',now(),now(),'','','','','','','','')",[owner,`qa-${owner}@example.invalid`,password]);
  const response=await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,'Content-Type':'application/json'},body:JSON.stringify({email:`qa-${owner}@example.invalid`,password}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`QA_AUTH_SIGNIN_HTTP_${response.status}`);const data=await response.json();if(typeof data.access_token!=='string'||data.user?.id!==owner)throw Error('QA_AUTH_RESPONSE');tokens.push(data.access_token);
 }
 for(let i=0;i<2;i++){
  const q={...query,origin:i?'SIN':'HKG'},search=randomUUID(),job=randomUUID();jobs.push(job);
  await admin.query('insert into flight.searches(owner_id,search_id,query,fingerprint) values($1,$2,$3,$4)',[owners[0],search,q,stableId(q)]);
  await admin.query("insert into flight.jobs(owner_id,job_id,search_id,kind,idempotency_key,request_hash,status,phase) values($1,$2,$3,'search',$4,$5,'partial','candidate_search')",[owners[0],job,search,randomUUID(),stableId(q)]);
  const current=offer(q.origin,i);offerIds.push(current.offer_id);await save(job,current,'qa-current');
  if(i===0){for(let d=0;d<8;d++){const old={...current,offer_id:randomUUID(),observed_at:new Date(Date.now()-(d===7?3600000:(8-d)*86400000)).toISOString(),expires_at:new Date(Date.now()-1000).toISOString(),money:{...current.money,minor:100000}};await save(job,old,`qa-history:${d}`);await admin.query('insert into flight.observations(owner_id,offer_id,comparison_key,observed_at,amount_minor,currency,fresh) values($1,$2,$3,$4,$5,$6,true)',[owners[0],old.offer_id,old.comparison_key,old.observed_at,100000,'HKD']);}
   await admin.query("insert into flight.calendar_cells(owner_id,job_id,departure,return_key,state,amount_minor,currency,offer_id) values($1,$2,'2026-11-10','2026-11-17','verified',90000,'HKD',$3)",[owners[0],job,current.offer_id]);
  }
 }
});
afterAll(async()=>{
 try{
  await admin.query('begin');
  for(const table of ['observations','calendar_cells','offers','checkpoints','provider_references','provider_calls','jobs','searches'])await admin.query(`delete from flight.${table} where owner_id=any($1::uuid[])`,[owners]);
  await admin.query('delete from auth.sessions where user_id=any($1::uuid[])',[owners]);await admin.query('delete from auth.identities where user_id=any($1::uuid[])',[owners]);await admin.query('delete from auth.users where id=any($1::uuid[])',[owners]);await admin.query('commit');
  if(baseline!==undefined)expect((await admin.query("select reserved_microusd from flight.budget_accounts where account_key='spike-lifetime'")).rows[0].reserved_microusd).toBe(baseline);
 }finally{tokens.length=0;await admin.end();}
});

it('real signed Auth reaches validation/live gate and forged identity is rejected',async()=>{
 expect((await call('/api/v1/searches',0,null)).status).toBe(422);
 const gate=await call('/api/v1/searches',0,query);expect(gate.status).toBe(503);expect((await gate.json()).error.code).toBe('PERSISTENCE_NOT_READY');
 const forged=await fetch(`${base}/api/v1/jobs/${jobs[0]}/results`,{headers:{Authorization:'Bearer invalid.synthetic.jwt'},signal:AbortSignal.timeout(30000)});expect(forged.status).toBe(401);
});
it('owner sees real API results/history; other authenticated owner cannot see them',async()=>{
 const own=await call(`/api/v1/jobs/${jobs[0]}/results`);expect(own.status).toBe(200);expect(own.headers.get('cache-control')).toBe('no-store');const data=await own.json();expect(data.confirmed).toHaveLength(1);expect(data.confirmed[0].offer_id).toBe(offerIds[0]);
 expect((await call(`/api/v1/jobs/${jobs[0]}/results`,1)).status).toBe(404);expect((await call(`/api/v1/offers/${offerIds[0]}`,1)).status).toBe(404);
 const detail=await call(`/api/v1/offers/${offerIds[0]}`);expect(detail.status).toBe(200);const result=await detail.json();expect(result.history.points).toHaveLength(8);expect(result.history.signal).toBe('low');expect(result.date_prices[0].state).toBe('verified');
});
it('real authenticated cached meeting/flexible APIs preserve UTC pairing and verified coverage',async()=>{
 const meeting=await call('/api/v1/analysis/meeting',0,{a:query,b:{...query,origin:'SIN'},arrival_day:'2026-11-10',max_minutes:60});expect(meeting.status).toBe(200);const pairs=await meeting.json();expect(pairs.paid_requests).toBe(0);expect(pairs.pairs).toHaveLength(1);expect(pairs.pairs[0].gap).toBe(30);
 const flex=await call('/api/v1/analysis/flexible',0,{base:query,departure_from:'2026-11-10',departure_to:'2026-11-11',return_from:'2026-11-17',return_to:'2026-11-18',min_nights:7,max_nights:8});expect(flex.status).toBe(200);const result=await flex.json();expect(result.paid_requests).toBe(0);expect(result.coverage).toEqual({planned:4,searched:1,verified:1});expect(result.recommendations[0].offer_id).toBe(offerIds[0]);
});

it('browser password login restores private quotes/details and logout removes private data',async()=>{
 const {chromium,expect:browserExpect}=await import('@playwright/test');
 const browser=await chromium.launch({headless:true,executablePath:process.env.FC_CHROMIUM_PATH});
 try{
  const page=await browser.newPage();
  const paid:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/v1/searches'))paid.push('search');});
  // Only the opaque saved job pointer is preloaded. Auth comes from the actual UI login.
  await page.addInitScript(({owner,job})=>{localStorage.setItem('fc-locale','en');localStorage.setItem(`fc-job:${owner}`,JSON.stringify({job_id:job}));},{owner:owners[0],job:jobs[0]});
  await page.goto(base);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill(`qa-${owners[0]}@example.invalid`);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.locator('form.auth').getByRole('button',{name:'Sign in',exact:true}).click();
  await browserExpect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible({timeout:15000});
  await page.getByRole('button',{name:'Find flights',exact:true}).click();
  const quote=page.locator('.fare-row').filter({hasText:'QA SYNTHETIC 0'});
  // The fixture includes eight expired observations in the same job. They remain
  // unknown candidates; choose the single currently confirmed offer for details.
  await browserExpect(quote).toHaveCount(9,{timeout:15000});
  const current=quote.filter({hasText:'Confirmed'});
  await browserExpect(current).toHaveCount(1);await current.click();
  await browserExpect(page.getByRole('heading',{name:'Flight details',exact:true})).toBeVisible({timeout:15000});
  await browserExpect(page.locator('.notice')).toContainText('Private saved quotes');
  await browserExpect(page.locator('.detail-bands')).toContainText('Below baseline');
  await page.getByRole('button',{name:'切换中文',exact:true}).click();
  await browserExpect(page.getByRole('heading',{name:'航班详情',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Switch to English',exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await browserExpect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible({timeout:15000});
  await browserExpect(page.locator('.notice')).not.toContainText('Private saved quotes');
  await browserExpect(quote).toHaveCount(0);
  expect(paid).toHaveLength(0);
 }finally{await browser.close();}
});
