import {test,expect,type Page} from '@playwright/test';
const owner='00000000-0000-4000-8000-000000000701',batchId='00000000-0000-4000-8000-000000000702';
async function signIn(page:Page){
 const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.QAFakeSignature`;
 const user={id:owner,aud:'authenticated',role:'authenticated',email:'batch-qa@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
 await page.route('**/auth/v1/token**',r=>r.fulfill({json:{access_token:jwt,refresh_token:'QA_SYNTHETIC_REFRESH',expires_in:3600,token_type:'bearer',user}}));
 await page.route('**/auth/v1/user**',r=>r.fulfill({json:user}));await page.route('**/auth/v1/logout**',r=>r.fulfill({status:204}));
 await page.goto('/');await page.getByRole('button',{name:'Switch to English',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('batch-qa@example.invalid');await page.getByLabel('Password',{exact:true}).fill('synthetic-not-a-real-password');await page.locator('form.auth').getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
}
test('meeting explicit admission preserves ambiguous request, resumes original task and clears owner data',async({page})=>{
 const posts:{key:string|undefined;body:unknown}[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let cancelled=false,reads=0,cancels=0;
 await page.route('**/api/v1/batches**',async r=>{
  const request=r.request(),path=new URL(request.url()).pathname;
  if(path==='/api/v1/batches'&&request.method()==='POST'){
   posts.push({key:request.headers()['idempotency-key'],body:request.postDataJSON()});
   if(posts.length===1)return r.fulfill({status:503,json:{error:{code:'PERSISTENCE_NOT_READY'}}});
   return r.fulfill({json:{batch_id:batchId,status:'running'}});
  }
  if(path.endsWith('/cancel')){cancels++;cancelled=true;return r.fulfill({json:{cancelled:true}});}
  reads++;
  if(path.endsWith('/results'))return r.fulfill({json:{kind:'meeting',pairs:[],alternatives:[],source_candidates:[{ordinal:0,participants:['a'],query:{origin:'HKG',destination:'NRT',departure:'2026-11-10'},returned_count:1,omitted_count:0,offers:[{offer_id:'qa-unverified',observed_at:'2026-10-01T00:00:00Z',expires_at:'2026-10-01T00:15:00Z',complete:true,money:{minor:98900,currency:'HKD',digits:2},segments:[{flight:'QA UNVERIFIED CANDIDATE',departure_local:'2026-11-10T09:00:00'}]}]}],coverage:{query_constraints_verified:0,searched:1,admitted:2}}});
  return r.fulfill({json:{batch_id:batchId,status:cancelled?'cancelled':'running',ceiling_microusd:120000,items:[{ordinal:0,status:cancelled?'cancelled':'running',phase:'search',query:{origin:'HKG',destination:'NRT',departure:'2026-11-10'}}]}});
 });
 await signIn(page);await page.getByRole('button',{name:'Meet together',exact:true}).click();
 const live=page.getByRole('region',{name:'Live batch · explicit request'});
 await live.getByLabel('Whole-batch ceiling (USD)',{exact:true}).fill('0.12');await live.getByRole('combobox',{name:'Departure coverage',exact:true}).selectOption('fixed_departures');
 await live.hover();await page.getByRole('button',{name:'切换中文',exact:true}).click();await page.getByRole('button',{name:'Switch to English',exact:true}).click();expect(posts).toHaveLength(0);
 await live.getByRole('button',{name:'Request live batch · may incur charges',exact:true}).click();await expect(live.getByRole('alert')).toHaveText('No confirmed response. The original request is saved for recovery.');
 await expect(live.getByRole('button',{name:'Revise rejected request',exact:true})).toHaveCount(0);
 await page.getByRole('heading',{name:'Traveler A',exact:true}).locator('..').getByLabel('From',{exact:true}).fill('LHR');
 await live.getByRole('button',{name:'Recover identical request',exact:true}).click();await expect(live.getByText('Query running',{exact:true}).first()).toBeVisible();
 expect(posts).toHaveLength(2);expect(posts[1]).toEqual(posts[0]);expect((posts[1].body as {request:{a:{origin:string};max_budget_microusd:number;departure_scope:string}}).request).toMatchObject({a:{origin:'HKG'},max_budget_microusd:120000,departure_scope:'fixed_departures'});
 const candidates=live.locator('details').filter({has:page.getByText('View returned quotes · unverified',{exact:true})});await expect(candidates).not.toHaveAttribute('open');await candidates.locator('summary').click();await expect(candidates.locator('.fare-row').filter({hasText:'QA UNVERIFIED CANDIDATE'})).toBeVisible();await expect(candidates.getByText(/these are not confirmed recommendations/)).toBeVisible();await expect(candidates.getByText(/Saved quote expired/)).toBeVisible();await candidates.locator('summary').click();await candidates.locator('summary').click();await expect(candidates.getByText(/Saved quote expired/)).toBeVisible();expect(posts).toHaveLength(2);
 const readBefore=reads;await live.getByRole('button',{name:'Refresh progress · no new query',exact:true}).click();await expect.poll(()=>reads).toBeGreaterThan(readBefore);expect(posts).toHaveLength(2);
 await live.getByRole('button',{name:'Resume original task',exact:true}).click();await expect.poll(()=>posts.length).toBe(3);expect(posts[2]).toEqual(posts[0]);
 await live.getByRole('button',{name:'Cancel',exact:true}).click();await expect.poll(()=>cancels).toBe(1);await expect(live.getByRole('status')).toHaveText('Cancelled');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(live.locator('.fare-row')).toHaveCount(0);await expect(live.getByRole('button',{name:'Request live batch · may incur charges',exact:true})).toBeDisabled();expect(errors).toEqual([]);
});
test('flexible live request uses explicit ranges while edits and language changes only render',async({page})=>{
 const posts:unknown[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/v1/batches**',r=>{
  if(r.request().method()==='POST'){posts.push(r.request().postDataJSON());return r.fulfill({json:{batch_id:batchId,status:'partial'}});}
  if(new URL(r.request().url()).pathname.endsWith('/results'))return r.fulfill({json:{kind:'flexible',recommendations:[],cells:[{departure:'2026-11-09',return_date:'2026-11-17',state:'unknown',money:null,query_status:'partial',searched:true}],coverage:{query_constraints_verified:0,searched:1,admitted:1,verified_cells:0}}});
  return r.fulfill({json:{batch_id:batchId,status:'partial',ceiling_microusd:90000,items:[]}});
 });
 await signIn(page);await page.getByRole('button',{name:'Flexible dates',exact:true}).click();await page.getByLabel('Departure window · to',{exact:true}).fill('2026-11-09');await page.getByLabel('Return window · to',{exact:true}).fill('2026-11-17');
 const live=page.getByRole('region',{name:'Live batch · explicit request'});await live.hover();await page.getByRole('button',{name:'切换中文',exact:true}).click();await page.getByRole('button',{name:'Switch to English',exact:true}).click();expect(posts).toHaveLength(0);
 await live.getByRole('button',{name:'Request live batch · may incur charges',exact:true}).click();await expect(live.getByRole('button',{name:'Prepare a new query',exact:true})).toBeVisible();expect(posts).toHaveLength(1);expect(posts[0]).toMatchObject({kind:'flexible',request:{departure_from:'2026-11-09',departure_to:'2026-11-09',return_from:'2026-11-17',return_to:'2026-11-17',max_budget_microusd:100000}});
 await expect(live.getByText('No fully verified date combination.',{exact:true})).toBeVisible();await expect(live.getByText('Verified / searched / planned · 0 / 1 / 1',{exact:true})).toBeVisible();expect(errors).toEqual([]);
});
test('a definitive rejection followed by an ambiguous retry cannot unlock a new admission key',async({page})=>{
 const keys:(string|undefined)[]=[];
 await page.route('**/api/v1/batches',r=>{
  keys.push(r.request().headers()['idempotency-key']);
  return keys.length===1?r.fulfill({status:409,json:{error:{code:'BATCH_BUDGET_EXCEEDED',params:{required_microusd:360000,available_microusd:100000}}}}):r.fulfill({status:503,json:{error:{code:'PERSISTENCE_NOT_READY'}}});
 });
 await signIn(page);await page.getByRole('button',{name:'Meet together',exact:true}).click();const live=page.getByRole('region',{name:'Live batch · explicit request'});
 await live.getByRole('button',{name:'Request live batch · may incur charges',exact:true}).click();await expect(live.getByRole('button',{name:'Revise rejected request',exact:true})).toBeVisible();await expect(live.getByText('Required ceiling · USD 0.36 / Available budget · USD 0.10',{exact:true})).toBeVisible();
 await live.getByRole('button',{name:'Recover identical request',exact:true}).click();await expect(live.getByRole('alert')).toHaveText('No confirmed response. The original request is saved for recovery.');await expect(live.getByRole('button',{name:'Revise rejected request',exact:true})).toHaveCount(0);await expect(live.getByText(/Required ceiling ·/)).toHaveCount(0);expect(keys).toHaveLength(2);expect(keys[1]).toBe(keys[0]);
});
test('storage-denied recovery warning survives successful batch admission',async({page})=>{
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('fc-batch:'))throw new DOMException('Blocked storage','SecurityError');return original.call(this,key,value);};});
 await page.route('**/api/v1/batches**',r=>{
  if(r.request().method()==='POST')return r.fulfill({status:202,json:{batch_id:batchId,status:'running'}});
  if(new URL(r.request().url()).pathname.endsWith('/results'))return r.fulfill({json:{kind:'meeting',pairs:[],alternatives:[],coverage:{query_constraints_verified:0,searched:0,admitted:2}}});
  return r.fulfill({json:{batch_id:batchId,status:'running',ceiling_microusd:120000,items:[]}});
 });
 await signIn(page);await page.getByRole('button',{name:'Meet together',exact:true}).click();const live=page.getByRole('region',{name:'Live batch · explicit request'});
 await live.getByRole('button',{name:'Request live batch · may incur charges',exact:true}).click();await expect(live.getByRole('status')).toHaveText('Query running');await expect(live.getByRole('alert')).toHaveText('Browser storage is unavailable. Keep this page open to retain the recovery request.');
 await live.getByRole('button',{name:'Refresh progress · no new query',exact:true}).click();await expect(live.getByRole('alert')).toHaveText('Browser storage is unavailable. Keep this page open to retain the recovery request.');
});
