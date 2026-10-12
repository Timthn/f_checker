import {test,expect,type Page} from '@playwright/test';
test('bilingual production cockpit preserves data without paid queries',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const paid:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/v1/searches'))paid.push(r.url());});
 await page.goto('/');await expect(page.locator('.brand')).toContainText('Flight cheaker');await expect(page.locator('.entry')).toHaveCount(3);
 await page.getByRole('button',{name:'暂停飞机动效',exact:true}).click();await expect(page.locator('.landing')).toHaveClass(/paused/);
 await page.getByRole('button',{name:'Switch to English',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.getByRole('button',{name:'Find flights',exact:true}).click();await page.getByRole('button',{name:'Preview recorded samples',exact:true}).click();await expect(page.locator('.fare-row')).toHaveCount(3);
 const prices=await page.locator('.fare-row strong').allTextContents();await page.getByRole('button',{name:'切换中文',exact:true}).click();await expect(page.locator('.fare-row')).toHaveCount(3);expect(await page.locator('.fare-row strong').allTextContents()).toHaveLength(prices.length);
 await page.locator('.fare-row').first().click();await expect(page.getByRole('heading',{name:'航班详情',exact:true})).toBeVisible();await page.getByRole('button',{name:'同一行程的历史观测',exact:true}).click();await expect(page.getByText('尚无可比的历史观测，缺失日期保持空缺。',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'出发日前后30天的日期价格',exact:true}).click();await page.getByText('查看数据表',{exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').nth(1)).toContainText('—');
 await expect(page.locator('tbody tr').nth(2)).toContainText('—');await expect(page.getByText('2026-11-11 · 来源数字价与显示价矛盾，此日期暂无可靠价格。',{exact:true})).toBeVisible();
 expect(paid).toHaveLength(0);expect(errors).toEqual([]);await page.screenshot({path:'docs/qa/screenshots/application-detail.png',fullPage:true});
});
test('mobile controls and reduced motion remain usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'一起抵达',exact:true}).click();await expect(page.getByRole('heading',{name:'旅客 A'})).toBeVisible();await expect(page.getByRole('heading',{name:'旅客 B'})).toBeVisible();
 const slider=page.getByRole('slider');await slider.focus();await slider.press('ArrowRight');await expect(slider).toHaveAttribute('aria-valuetext','120 分钟');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'docs/qa/screenshots/application-mobile.png',fullPage:true});
});
test('live API fails closed and health does not disclose keys',async({request})=>{
 const response=await request.post('/api/v1/searches',{data:null});expect(response.status()).toBe(401);expect((await response.json()).error.code).toBe('AUTH_REQUIRED');
 const health=await request.get('/api/v1/health');expect((await health.json()).provider_live_enabled).toBe(false);expect(await health.text()).not.toMatch(/apify_api_|sb_publishable|postgresql/);
});
test('flexible date windows preserve values across language changes and private analysis requires auth',async({page,request})=>{
 await page.goto('/');await page.getByRole('button',{name:'灵活日期',exact:true}).click();
 await expect(page.getByLabel('出发区间 · 起始',{exact:true})).toHaveValue('2026-11-09');await expect(page.getByLabel('返回区间 · 结束',{exact:true})).toHaveValue('2026-11-19');
 await page.getByLabel('出发区间 · 起始',{exact:true}).fill('2026-11-08');await page.getByRole('button',{name:'Switch to English',exact:true}).click();await expect(page.getByLabel('Departure window · from',{exact:true})).toHaveValue('2026-11-08');
 await page.getByRole('button',{name:'Analyze saved quotes',exact:true}).click();await expect(page.locator('main').getByRole('alert')).toHaveText('Sign in to query or view private flight data.');
 for(const path of ['meeting','flexible']){const r=await request.post(`/api/v1/analysis/${path}`,{data:{}});expect(r.status()).toBe(401);}
});
test('synthetic authenticated cache uses captured evidence and clears private content on signout',async({page})=>{
 const owner='00000000-0000-4000-8000-000000000101',jobId='00000000-0000-4000-8000-000000000201',offerId='00000000-0000-4000-8000-000000000301';
 // Browser-only Auth and API fixtures: no credentials, real users, email or provider calls.
 const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.QAFakeSignature`;
 const user={id:owner,aud:'authenticated',role:'authenticated',email:'qa@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
 await page.route('**/auth/v1/token**',r=>r.fulfill({status:200,json:{access_token:jwt,refresh_token:'QA_SYNTHETIC_REFRESH',expires_in:3600,token_type:'bearer',user}}));
 await page.route('**/auth/v1/user**',r=>r.fulfill({status:200,json:user}));await page.route('**/auth/v1/logout**',r=>r.fulfill({status:204}));
 await page.addInitScript(({owner,jobId})=>localStorage.setItem(`fc-job:${owner}`,JSON.stringify({job_id:jobId})),{owner,jobId});
 const segment={leg_index:0,from:'SIN',to:'LHR',departure_local:'2026-11-10T09:00:00',arrival_local:'2026-11-10T15:00:00',departure_utc:'2026-11-10T01:00:00Z',arrival_utc:'2026-11-10T15:00:00Z',arrival_zone:'Europe/London',flight:'QA PRIVATE A',cabin:'economy',duration:840};
 const offer={offer_id:offerId,itinerary_id:'synthetic_ui_test_only',comparison_key:'synthetic',money:{minor:20000,currency:'JPY',digits:0},segments:[segment,{...segment,leg_index:1,from:'LHR',to:'SIN',flight:'QA RETURN'}],baggage:[],complete:true,price_complete:true,quoted_adults:1,duration_minutes:1680,fare_identity:'synthetic',source:'synthetic_ui_test_only',observed_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),time_verified:true};
 let billingReads=0,billingWrites=0;await page.route(`**/api/v1/jobs/${jobId}/billing`,r=>{if(r.request().method()!=='GET')billingWrites++;billingReads++;return r.fulfill({json:{reserved_microusd:90000,reported_actor_microusd:null,measured_external_microusd:null,estimated_external_microusd:null,overhead_reserved_microusd:30000,account_total_microusd:null,invoice_confirmed:false,exact_job_total_microusd:null,state:'pending_evidence',read_requests_reserved:7,read_request_cap:30,pending:['external_cost'],calls:[]}})});
 await page.route(`**/api/v1/jobs/${jobId}/results`,r=>r.fulfill({json:{status:'partial',source_count:1,confirmed:[offer],unknown:[],query:{origin:'SIN',destination:'LHR',currency:'JPY'}}}));
 await page.route(`**/api/v1/offers/${offerId}`,r=>r.fulfill({json:{offer,route_history:{currency:'JPY',digits:0,source:'synthetic_ui_test_only',observed_at:new Date(Date.now()-86400000).toISOString(),fetched_at:new Date().toISOString(),points:Array.from({length:7},(_,i)=>({day:'2026-10-'+String(i+1).padStart(2,'0'),minor:21000})),typical_range:[20000,30000],price_level:'low'},history:{signal:'low',mean:25000,points:Array.from({length:7},(_,i)=>({day:`2026-10-${String(i+1).padStart(2,'0')}`,minor:25000}))},date_prices:[{departure:'2026-11-10',return_date:'2026-11-17',state:'coarse',money:{minor:30000,currency:'JPY',digits:0}}]}}));
 await page.route('**/api/v1/analysis/meeting',r=>r.fulfill({json:{pairs:[{a:offer,b:{...offer,offer_id:'qa-b'},total:40000,gap:20}],a:{confirmed:[offer]},b:{confirmed:[offer]}}}));
 await page.goto('/');await page.getByRole('button',{name:'Switch to English',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('synthetic-not-a-real-password');await page.locator('form.auth').getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Find flights',exact:true}).click();const fees=page.getByRole('region',{name:'Query cost evidence',exact:true});await expect(fees.locator('details')).not.toHaveAttribute('open');await fees.getByText('View cost details',{exact:true}).click();await expect(fees.getByText('Unknown',{exact:true})).toHaveCount(4);await fees.getByRole('button',{name:'Refresh saved cost evidence',exact:true}).click();await expect.poll(()=>billingReads).toBe(2);expect(billingWrites).toBe(0);await page.locator('.fare-row').first().click();await expect(page.locator('.detail-bands .fare-hero h2')).toHaveText('SIN → LHR');await expect(page.getByText('Provider reference signal unavailable or stale. It does not verify your selected fare.',{exact:true})).toBeVisible();await expect(page.getByText(/Source observed ·/)).toBeVisible();await page.getByRole('button',{name:'Same-trip observed history',exact:true}).click();await expect(page.getByText(/Observed days · 7 · Below baseline/)).toBeVisible();
 await page.getByRole('button',{name:'Travel-date prices · ±30 days',exact:true}).click();await expect(page.getByText(/Verified \/ searched \/ planned · 0 \/ 1 \/ 61/)).toBeVisible();
 await page.getByRole('button',{name:'Meet together',exact:true}).click();await page.getByRole('combobox',{name:'Currency',exact:true}).selectOption('JPY');await page.getByRole('button',{name:'Analyze saved quotes',exact:true}).click();await expect(page.locator('.meeting .fare-row')).toHaveCount(1);
 const amount=await page.locator('.meeting .fare-row strong').textContent();await page.getByRole('combobox',{name:'Currency',exact:true}).selectOption('HKD');await expect(page.locator('.meeting .fare-row strong')).toHaveText(amount!);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByText('QA PRIVATE A',{exact:true})).toHaveCount(0);await expect(page.locator('.meeting .fare-row')).toHaveCount(0);
});

async function fixedSearchAuth(page:Page){
 const owner='00000000-0000-4000-8000-000000000801';
 const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.QAFakeSignature`;
 const user={id:owner,aud:'authenticated',role:'authenticated',email:'fixed-qa@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
 await page.route('**/auth/v1/token**',r=>r.fulfill({json:{access_token:jwt,refresh_token:'QA_SYNTHETIC_REFRESH',expires_in:3600,token_type:'bearer',user}}));
 await page.route('**/auth/v1/user**',r=>r.fulfill({json:user}));await page.route('**/auth/v1/logout**',r=>r.fulfill({status:204}));
 await page.goto('/');await page.getByRole('button',{name:'Switch to English',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('fixed-qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('synthetic-not-a-real-password');await page.locator('form.auth').getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();await page.getByRole('button',{name:'Find flights',exact:true}).click();
}
function fixedReferenceOffer(index=0){return {offer_id:`00000000-0000-4000-8000-${String(900+index).padStart(12,'0')}`,itinerary_id:`synthetic-ref-${index}`,comparison_key:null,money:{minor:10000+index*100,currency:'HKD',digits:2},segments:[{leg_index:0,from:'HKG',to:'NRT',departure_local:'2026-11-10T09:00:00',arrival_local:'2026-11-10T14:00:00',departure_utc:null,arrival_utc:null,arrival_zone:null,flight:`QA LIVE REF ${index}`,cabin:'economy',duration:240}],baggage:[],complete:true,price_complete:false,quoted_adults:null,duration_minutes:240,fare_identity:null,source:'synthetic_ui_test_only',observed_at:new Date().toISOString(),expires_at:new Date(Date.now()+900000).toISOString(),time_verified:false};}
test('fixed-date live candidates replace sample dashboard, cap at ten and explicit repeat creates a new key',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const posts:{key:string|undefined;body:unknown}[]=[],job='00000000-0000-4000-8000-000000000811',job2='00000000-0000-4000-8000-000000000812';
 const offers=Array.from({length:12},(_,i)=>fixedReferenceOffer(i));
 await page.route('**/api/v1/searches',async r=>{posts.push({key:r.request().headers()['idempotency-key'],body:r.request().postDataJSON()});await new Promise(resolve=>setTimeout(resolve,150));return r.fulfill({status:202,json:{job_id:posts.length===1?job:job2,status:'queued'}});});
 await page.route('**/api/v1/jobs/*/results',r=>r.fulfill({json:{status:'partial',source_count:19,confirmed:[],unknown:offers,query:{origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0}}}));
 await page.route(`**/api/v1/offers/${offers[0].offer_id}`,r=>r.fulfill({json:{offer:offers[0],route_history:null,history:{points:[],mean:null,signal:'insufficient'},date_prices:[]}}));
 await fixedSearchAuth(page);await page.getByRole('button',{name:'Preview recorded samples',exact:true}).click();await expect(page.locator('.fare-row')).toHaveCount(3);
 await page.getByRole('button',{name:'Search candidates',exact:false}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});await expect(page.locator('.fare-list .fare-row')).toHaveCount(10);expect(posts).toHaveLength(1);await expect(page.locator('.dominant .fare-hero strong')).toHaveText(/100/);await expect(page.locator('.dominant .badge')).toHaveText('Unknown');await expect(page.locator('.dashboard .metric').first()).toContainText('10 / 19');await expect(page.getByText(/Recorded HKG → NRT, 10 Nov/)).toHaveCount(0);
 await page.getByRole('button',{name:'切换中文',exact:true}).click();await page.locator('.dominant').hover();await page.getByRole('button',{name:'Switch to English',exact:true}).click();expect(posts).toHaveLength(1);
 await page.locator('.fare-list .fare-row').first().click();await expect(page.locator('.detail-bands .fare-hero strong')).toHaveText(/100/);await expect(page.getByText(/Quote scope unverified · synthetic_ui_test_only/)).toBeVisible();
 await page.getByRole('button',{name:'← Back to results',exact:true}).click();await page.getByRole('button',{name:'New live search · may incur charges',exact:false}).click();await expect.poll(()=>posts.length).toBe(2);expect(posts[1].key).not.toBe(posts[0].key);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('.fare-row').filter({hasText:'QA LIVE REF'})).toHaveCount(0);expect(errors).toEqual([]);
});
test('ambiguous fixed-date admission retains frozen payload and key even after fields change',async({page})=>{
 const posts:{key:string|undefined;body:unknown}[]=[],job='00000000-0000-4000-8000-000000000821';
 await page.route('**/api/v1/searches',r=>{posts.push({key:r.request().headers()['idempotency-key'],body:r.request().postDataJSON()});return posts.length===1?r.fulfill({status:503,json:{error:{code:'PERSISTENCE_NOT_READY'}}}):r.fulfill({status:202,json:{job_id:job}});});
 await page.route(`**/api/v1/jobs/${job}/results`,r=>r.fulfill({json:{status:'running',source_count:0,confirmed:[],unknown:[],query:{origin:'HKG',destination:'NRT'}}}));
 await fixedSearchAuth(page);await page.getByRole('button',{name:'Search candidates',exact:false}).click();await expect(page.locator('main').getByRole('alert')).toHaveText('Response not confirmed. Recover the original request; do not create a duplicate query.');await page.locator('input[name="origin"]').fill('SIN');await page.getByRole('button',{name:'Recover original request',exact:false}).click();await expect.poll(()=>posts.length).toBe(2);expect(posts[1]).toEqual(posts[0]);await expect(page.getByRole('button',{name:'Restore current job',exact:false})).toHaveCount(2);await page.locator('form.query').getByRole('button',{name:'Restore current job',exact:false}).click();expect(posts).toHaveLength(2);
});
test('account creation is explicit and explains email confirmation without a paid flight query',async({page})=>{
 let signups=0,paid=0;
 await page.route('**/auth/v1/signup**',r=>{signups++;return r.fulfill({json:{user:{id:'00000000-0000-4000-8000-000000000831',aud:'authenticated',email:'new-qa@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()},session:null}});});
 page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/v1/searches'))paid++;});
 await page.goto('/');await page.getByRole('button',{name:'Switch to English',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'No account? Create one',exact:true}).click();expect(signups).toBe(0);
 await page.getByLabel('Email',{exact:true}).fill('new-qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('synthetic-not-a-real-password');await page.locator('form.auth').getByRole('button',{name:'Create account',exact:true}).click();await expect(page.locator('form.auth').getByRole('status')).toHaveText('If confirmation is required, check your email to activate your account before signing in.');expect(signups).toBe(1);expect(paid).toBe(0);
 await page.getByRole('button',{name:'切换中文',exact:true}).click();await expect(page.locator('form.auth').getByRole('status')).toHaveText('若需要邮箱确认，请查收邮件，激活账户后再登录。');await page.getByRole('button',{name:'已有账户？登录',exact:true}).click();await expect(page.locator('form.auth').getByRole('heading',{name:'登录',exact:true})).toBeVisible();
});
test('known failed and cancelled jobs allow explicit new keys while uncertain jobs only restore',async({page})=>{
 const keys:string[]=[],ids=['00000000-0000-4000-8000-000000000841','00000000-0000-4000-8000-000000000842','00000000-0000-4000-8000-000000000843'];
 await page.route('**/api/v1/searches',r=>{keys.push(r.request().headers()['idempotency-key']);return r.fulfill({status:202,json:{job_id:ids[keys.length-1]}});});
 await page.route('**/api/v1/jobs/*/results',r=>{const index=ids.findIndex(id=>r.request().url().includes(id));return r.fulfill({json:{status:['failed','cancelled','uncertain'][index],safe_error:index===0?'ACCOUNT_LIMITS_UNVERIFIED':null,source_count:0,confirmed:[],unknown:[],query:{origin:'HKG',destination:'NRT'}}});});
 await fixedSearchAuth(page);await page.getByRole('button',{name:'Search candidates',exact:false}).click();await expect(page.getByText('The source is unavailable under the verified free-account limits. No automatic paid fallback is used.',{exact:true})).toBeVisible();await expect(page.locator('footer')).not.toContainText('No provider request was sent.');
 await page.locator('form.query').getByRole('button',{name:'New live search · may incur charges',exact:false}).click();await expect(page.getByText('Cancelled',{exact:true})).toBeVisible();await page.locator('form.query').getByRole('button',{name:'New live search · may incur charges',exact:false}).click();await expect(page.getByText('Needs reconciliation; no automatic retry',{exact:true})).toBeVisible();expect(new Set(keys).size).toBe(3);
 await page.locator('form.query').getByRole('button',{name:'Restore current job',exact:false}).click();await expect(page.getByText('Refreshing the existing job. No new provider query was created.',{exact:true})).toBeVisible();expect(keys).toHaveLength(3);
});


test('meeting live batch previews two fixed queries, guards double clicks and freezes uncertain recovery',async({page})=>{
 const posts:{key:string|undefined;body:unknown}[]=[],batch='00000000-0000-4000-8000-000000000861';let reads=0,phase='running';
 await page.route('**/api/v1/batches**',async r=>{
  const path=new URL(r.request().url()).pathname;
  if(path==='/api/v1/batches'&&r.request().method()==='POST'){
   posts.push({key:r.request().headers()['idempotency-key'],body:r.request().postDataJSON()});await new Promise(resolve=>setTimeout(resolve,100));
   return posts.length===1?r.fulfill({status:503,json:{error:{code:'PERSISTENCE_NOT_READY'}}}):r.fulfill({status:202,json:{batch_id:batch,status:'running'}});
  }
  if(path.endsWith('/cancel')){phase='uncertain';return r.fulfill({json:{cancelled:true}});}
  reads++;
  if(path.endsWith('/results'))return r.fulfill({json:{kind:'meeting',pairs:[],alternatives:[],source_candidates:[],coverage:{query_constraints_verified:0,searched:0,admitted:2}}});
  return r.fulfill({json:{batch_id:batch,status:phase,ceiling_microusd:60000,items:[]}});
 });
 await fixedSearchAuth(page);await page.getByRole('button',{name:'Meet together',exact:true}).click();const live=page.getByRole('region',{name:'Live batch · explicit request',exact:true});
 await expect(live.getByRole('combobox',{name:'Departure coverage',exact:true})).toHaveValue('fixed_departures');await expect(live.getByRole('region',{name:'Local plan preview · no provider request',exact:true})).toContainText('Unique queries · 2 / Maximum source calls · 2');
 await live.getByRole('combobox',{name:'Departure coverage',exact:true}).selectOption('arrival_window');await expect(live.getByRole('button',{name:'Request live batch · may incur charges',exact:true})).toBeDisabled();await expect(live.getByText(/This complete plan exceeds/)).toBeVisible();await live.getByRole('combobox',{name:'Departure coverage',exact:true}).selectOption('fixed_departures');
 await live.hover();await page.getByRole('button',{name:'切换中文',exact:true}).click();await page.getByRole('button',{name:'Switch to English',exact:true}).click();expect(posts).toHaveLength(0);
 await live.getByRole('button',{name:'Request live batch · may incur charges',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});await expect(live.getByRole('alert')).toHaveText('No confirmed response. The original request is saved for recovery.');expect(posts).toHaveLength(1);await expect(live.getByRole('button',{name:'Revise rejected request',exact:true})).toHaveCount(0);
 await page.getByRole('heading',{name:'Traveler A',exact:true}).locator('..').getByLabel('From',{exact:true}).fill('LHR');await live.getByRole('button',{name:'Recover identical request',exact:true}).click();await expect(live.getByRole('status')).toHaveText('Query running');expect(posts[1]).toEqual(posts[0]);
 const before=reads;await live.getByRole('button',{name:'Refresh progress · no new query',exact:true}).click();await expect.poll(()=>reads).toBeGreaterThan(before);expect(posts).toHaveLength(2);
 await live.getByRole('button',{name:'Resume original task',exact:true}).click();await expect.poll(()=>posts.length).toBe(3);expect(posts[2]).toEqual(posts[0]);await live.getByRole('button',{name:'Cancel',exact:true}).click();await expect(live.getByRole('status')).toHaveText('Needs reconciliation; no automatic retry');await expect(live.getByRole('button',{name:'Prepare a new query',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(live.getByText('Saved request used for safe recovery',{exact:false})).toHaveCount(0);await expect(live.getByRole('button',{name:'Request live batch · may incur charges',exact:true})).toBeDisabled();
});

test('flexible live batch retains every date pair in preview and only dispatches an explicit affordable plan',async({page})=>{
 const posts:unknown[]=[],batch='00000000-0000-4000-8000-000000000862';
 await page.route('**/api/v1/batches**',r=>{
  if(r.request().method()==='POST'){posts.push(r.request().postDataJSON());return r.fulfill({status:202,json:{batch_id:batch,status:'partial'}});}
  if(new URL(r.request().url()).pathname.endsWith('/results'))return r.fulfill({json:{kind:'flexible',recommendations:[],source_candidates:[],cells:[],coverage:{query_constraints_verified:0,searched:1,admitted:1,verified_cells:0}}});
  return r.fulfill({json:{batch_id:batch,status:'partial',ceiling_microusd:60000,items:[]}});
 });
 await fixedSearchAuth(page);await page.getByRole('button',{name:'Flexible dates',exact:true}).click();const live=page.getByRole('region',{name:'Live batch · explicit request',exact:true}),preview=live.getByRole('region',{name:'Local plan preview · no provider request',exact:true});
 await expect(preview).toContainText('Unique queries · 9 / Maximum source calls · 18');await expect(preview).toContainText('USD 0.54');await expect(live.getByRole('button',{name:'Request live batch · may incur charges',exact:true})).toBeDisabled();
 await live.getByLabel('Whole-batch ceiling (USD)',{exact:true}).fill('0.50');await expect(preview).toContainText('Unique queries · 9');await expect(live.getByText(/no date pair is dropped/)).toBeVisible();expect(posts).toHaveLength(0);
 await page.getByLabel('Departure window · to',{exact:true}).fill('2026-11-09');await page.getByLabel('Return window · to',{exact:true}).fill('2026-11-17');await expect(preview).toContainText('Unique queries · 1 / Maximum source calls · 2');await live.getByLabel('Whole-batch ceiling (USD)',{exact:true}).fill('0.10');
 await live.hover();await page.getByRole('button',{name:'切换中文',exact:true}).click();await page.getByRole('button',{name:'Switch to English',exact:true}).click();expect(posts).toHaveLength(0);
 await live.getByRole('button',{name:'Request live batch · may incur charges',exact:true}).click();await expect(live.getByRole('button',{name:'Prepare a new query',exact:true})).toBeVisible();expect(posts).toHaveLength(1);expect(posts[0]).toMatchObject({kind:'flexible',request:{departure_from:'2026-11-09',departure_to:'2026-11-09',return_from:'2026-11-17',return_to:'2026-11-17',max_budget_microusd:100000}});await expect(live.getByText('No fully verified date combination.',{exact:true})).toBeVisible();
});
