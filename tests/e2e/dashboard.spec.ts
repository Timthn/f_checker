import {test,expect} from '@playwright/test';
test('bilingual production cockpit preserves data without paid queries',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const paid:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/v1/searches'))paid.push(r.url());});
 await page.goto('/');await expect(page.locator('.brand')).toContainText('Flight cheaker');await expect(page.locator('.entry')).toHaveCount(3);
 await page.getByRole('button',{name:'暂停飞机动效',exact:true}).click();await expect(page.locator('.landing')).toHaveClass(/paused/);
 await page.getByRole('button',{name:'Switch to English',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.getByRole('button',{name:'Find flights',exact:true}).click();await page.getByRole('button',{name:'Preview recorded samples',exact:true}).click();await expect(page.locator('.fare-row')).toHaveCount(3);
 const prices=await page.locator('.fare-row strong').allTextContents();await page.getByRole('button',{name:'切换中文',exact:true}).click();await expect(page.locator('.fare-row')).toHaveCount(3);expect(await page.locator('.fare-row strong').allTextContents()).toHaveLength(prices.length);
 await page.locator('.fare-row').first().click();await expect(page.getByRole('heading',{name:'航班详情',exact:true})).toBeVisible();await page.getByRole('button',{name:'同一行程的历史观测',exact:true}).click();await expect(page.getByText('尚无可比的历史观测，缺失日期保持空缺。',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'出发日前后30天的日期价格',exact:true}).click();await page.getByText('查看数据表',{exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(3);await expect(page.locator('tbody tr').nth(1)).toContainText('—');
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
 let billingReads=0,billingWrites=0;await page.route(`**/api/v1/jobs/${jobId}/billing`,r=>{if(r.request().method()!=='GET')billingWrites++;billingReads++;return r.fulfill({json:{reserved_microusd:90000,reported_actor_microusd:null,measured_external_microusd:null,estimated_external_microusd:30000,account_total_microusd:null,invoice_confirmed:false,exact_job_total_microusd:null,state:'pending_evidence',read_requests_reserved:7,read_request_cap:30,pending:['external_cost'],calls:[]}})});
 await page.route(`**/api/v1/jobs/${jobId}/results`,r=>r.fulfill({json:{status:'partial',source_count:1,confirmed:[offer],unknown:[],query:{origin:'SIN',destination:'LHR',currency:'JPY'}}}));
 await page.route(`**/api/v1/offers/${offerId}`,r=>r.fulfill({json:{offer,route_history:{currency:'JPY',digits:0,source:'synthetic_ui_test_only',observed_at:new Date(Date.now()-86400000).toISOString(),fetched_at:new Date().toISOString(),points:Array.from({length:7},(_,i)=>({day:'2026-10-'+String(i+1).padStart(2,'0'),minor:21000})),typical_range:[20000,30000],price_level:'low'},history:{signal:'low',mean:25000,points:Array.from({length:7},(_,i)=>({day:`2026-10-${String(i+1).padStart(2,'0')}`,minor:25000}))},date_prices:[{departure:'2026-11-10',return_date:'2026-11-17',state:'coarse',money:{minor:30000,currency:'JPY',digits:0}}]}}));
 await page.route('**/api/v1/analysis/meeting',r=>r.fulfill({json:{pairs:[{a:offer,b:{...offer,offer_id:'qa-b'},total:40000,gap:20}],a:{confirmed:[offer]},b:{confirmed:[offer]}}}));
 await page.goto('/');await page.getByRole('button',{name:'Switch to English',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('synthetic-not-a-real-password');await page.locator('form.auth').getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Find flights',exact:true}).click();const fees=page.getByRole('region',{name:'Query cost evidence',exact:true});await expect(fees.getByText('Unknown',{exact:true})).toHaveCount(3);await fees.getByRole('button',{name:'Refresh saved cost evidence',exact:true}).click();await expect.poll(()=>billingReads).toBe(2);expect(billingWrites).toBe(0);await page.locator('.fare-row').first().click();await expect(page.locator('.detail-bands .fare-hero h2')).toHaveText('SIN → LHR');await expect(page.getByText('Provider reference signal unavailable or stale. It does not verify your selected fare.',{exact:true})).toBeVisible();await expect(page.getByText(/Source observed ·/)).toBeVisible();await page.getByRole('button',{name:'Same-trip observed history',exact:true}).click();await expect(page.getByText(/Observed days · 7 · Below baseline/)).toBeVisible();
 await page.getByRole('button',{name:'Travel-date prices · ±30 days',exact:true}).click();await expect(page.getByText(/Verified \/ searched \/ planned · 0 \/ 1 \/ 61/)).toBeVisible();
 await page.getByRole('button',{name:'Meet together',exact:true}).click();await page.getByRole('combobox',{name:'Currency',exact:true}).selectOption('JPY');await page.getByRole('button',{name:'Analyze saved quotes',exact:true}).click();await expect(page.locator('.meeting .fare-row')).toHaveCount(1);
 const amount=await page.locator('.meeting .fare-row strong').textContent();await page.getByRole('combobox',{name:'Currency',exact:true}).selectOption('HKD');await expect(page.locator('.meeting .fare-row strong')).toHaveText(amount!);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByText('QA PRIVATE A',{exact:true})).toHaveCount(0);await expect(page.locator('.meeting .fare-row')).toHaveCount(0);
});
