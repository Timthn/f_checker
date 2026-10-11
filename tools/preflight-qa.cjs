// Design-artifact verification only. Not an application unit/integration suite.
const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');
const {chromium} = require('playwright');
const repo = path.resolve(__dirname, '..');
const checks = [];
function check(name, ok) { checks.push({name, passed: !!ok}); if (!ok) throw new Error(name); }
function collect(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? collect(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
(async()=>{
  const files = collect(path.join(repo,'docs')).concat([path.join(repo,'AGENTS.md'),path.join(repo,'README.md')]);
  function checkLinks() { for(const file of files.filter(f=>f.endsWith('.md'))) {
    const src=fs.readFileSync(file,'utf8');
    for(const match of src.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:\/\//.test(match[1]) || match[1].startsWith('#')) continue;
      check('link '+path.relative(repo,file)+' -> '+match[1], fs.existsSync(path.resolve(path.dirname(file),match[1].split('#')[0])));
    }
  } }
  const offer=JSON.parse(fs.readFileSync(path.join(repo,'docs/connectors/example-offer.json'),'utf8'));
  check('JSON explicitly fictional',offer.data_kind==='fictional_demo');
  check('example segment UTC chronology',offer.segments.every(s=>Date.parse(s.arrival_at_utc)>Date.parse(s.departure_at_utc)));
  check('example baggage not double counted',offer.requested_total.amount_minor===offer.base_price.amount_minor+offer.required_baggage_fee.amount_minor);
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];const network=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
    await page.goto(pathToFileURL(path.join(repo,'docs/design/prototype.html')).href);
    check('persistent demo notice',await page.getByText('模拟数据 · 未连接航班 API · 不可用于购票',{exact:true}).isVisible());
    check('top ten demo results',await page.locator('.fare').count()===10);
    const before=await page.locator('.fare .money').first().innerText();
    await page.selectOption('#bags','carry');await page.click('#search-btn');
    check('baggage input changes illustrative price',before!==await page.locator('.fare .money').first().innerText());
    await page.selectOption('#cabin','business');await page.click('#search-btn');
    check('business cabin updates result',await page.locator('.fare').first().innerText().then(s=>s.includes('Business')));
    await page.selectOption('#cabin','economy');await page.selectOption('#bags','checked');await page.click('#search-btn');
    fs.mkdirSync(path.join(repo,'docs/qa/screenshots'),{recursive:true});
    await page.screenshot({path:path.join(repo,'docs/qa/screenshots/search-desktop.png'),fullPage:true});
    await page.locator('[data-detail]').first().click();
    check('details navigation',await page.locator('#details').isVisible());
    await page.click('[data-chart="dates"]');
    check('calendar scope separate',await page.locator('#chart-title').innerText()==='同航线条件下的日期最低候选');
    await page.click('[data-chart="history"]');await page.click('#history-state');
    check('insufficient signal state',await page.locator('#signal').innerText()==='数据不足');
    await page.click('#history-state');
    await page.screenshot({path:path.join(repo,'docs/qa/screenshots/details-desktop.png'),fullPage:true});
    await page.click('[data-view="meet"]');await page.selectOption('#gap','30');
    check('meeting gap filters pairs',await page.locator('#pairs > .panel').count()===2);
    await page.screenshot({path:path.join(repo,'docs/qa/screenshots/meet-desktop.png'),fullPage:true});
    await page.click('[data-view="flex"]');await page.click('[data-cell="1,1"]');
    check('flex verified selection',await page.locator('#flex-selection').innerText().then(s=>s.includes('已核验')));
    await page.click('[data-cell="0,0"]');
    check('flex unverified selection',await page.locator('#flex-selection').innerText().then(s=>s.includes('待核验')));
    await page.screenshot({path:path.join(repo,'docs/qa/screenshots/flex-desktop.png'),fullPage:true});
    await page.click('[data-view="search"]');
    for(const state of ['loading','empty','error','partial','unknown']){
      await page.selectOption('#state',state);
      check('preview state '+state,await page.locator('#state-content').innerText().then(s=>s.length>0));
    }
    await page.selectOption('#state','success');
    await page.setViewportSize({width:390,height:844});
    for(const view of ['search','meet','flex']){
      await page.click('[data-view="'+view+'"]');
      check('390px no page overflow '+view,await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    }
    await page.click('[data-view="meet"]');await page.click('[data-person="b"]');
    check('mobile B tab',await page.locator('#person-b').isVisible()&&!await page.locator('#person-a').isVisible());
    await page.screenshot({path:path.join(repo,'docs/qa/screenshots/meet-mobile.png'),fullPage:true});
    check('no browser JS errors',errors.length===0);
    check('prototype sends no HTTP requests',network.length===0);
    const result={kind:'design_artifact_checks_only',generated_at:new Date().toISOString(),checks,errors,external_requests:network};
    fs.writeFileSync(path.join(repo,'docs/qa/preflight-results.json'),JSON.stringify(result,null,2));
    checkLinks();
    fs.writeFileSync(path.join(repo,'docs/qa/preflight-results.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({passed:checks.length,failed:0,application_tests:'not_implemented',live_provider:'not_executed'},null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
