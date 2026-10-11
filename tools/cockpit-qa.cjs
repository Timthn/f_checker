// Browser verification of the local design artifact, not application unit/integration tests.
const fs=require('fs'),path=require('path');const{pathToFileURL}=require('url');const{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa'),shots=path.join(out,'screenshots'),checks=[];
function check(name,ok){checks.push({name,passed:!!ok});if(!ok)throw Error(name);}
(async()=>{const browser=await chromium.launch({headless:true});let error;try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
 await page.goto(pathToFileURL(path.join(root,'docs/design/prototype.html')).href);await page.waitForFunction(()=>document.querySelectorAll('.fare').length===10);
 check('Explicit demo notice on every page shell',(await page.locator('.demo-notice').innerText()).includes('未连接航班 API'));
 check('Landing has three module entrances',await page.locator('.entry').count()===3);
 await page.screenshot({path:path.join(shots,'cockpit-landing-desktop.png'),fullPage:true});
 await page.locator('.entry-search').click();await page.waitForTimeout(500);
 check('Ten ranked candidates',await page.locator('.fare').count()===10);
 check('Desktop 8-column two-row main card',await page.locator('.hero-card').evaluate(e=>{const c=getComputedStyle(e),parent=e.parentElement;return c.gridColumnStart==='span 8'&&c.gridRowStart==='span 2'&&e.getBoundingClientRect().height>=parent.getBoundingClientRect().height-1;}));
 const initial=await page.locator('#hero-price').innerText();await page.locator('#bags').selectOption('checked');
 check('Editing form preserves current result until search',await page.locator('#hero-price').innerText()===initial&&(await page.locator('#query-status').innerText()).includes('需重新查询'));
 await page.locator('#search-btn').click();check('Baggage fee included once',(await page.locator('#hero-price').innerText())==='HK$ 2,420');
 await page.locator('#cabin').selectOption('business');await page.locator('#search-btn').click();check('Cabin affects same selected quote',(await page.locator('#hero-price').innerText())==='HK$ 7,040');
 await page.locator('#cabin').selectOption('economy');await page.locator('#bags').selectOption('carry');await page.locator('#search-btn').click();
 await page.screenshot({path:path.join(shots,'cockpit-search-desktop.png')});
 const chart=page.locator('#hero-chart'),rect=await chart.boundingBox();await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.5);await page.waitForTimeout(100);
 check('Chart hover updates readable observation',/HK\$/.test(await page.locator('#hero-history-summary').innerText()));
 await page.locator('[data-detail="2"]').click();check('Selected offer reaches detail accurately',(await page.locator('#detail-price').innerText())==='HK$ 2,350'&&(await page.locator('#detail-flight').innerText())==='FC 205');
 check('Three detail bands with 48px separation',await page.locator('.detail-surface').evaluate(e=>e.children.length===3&&getComputedStyle(e).rowGap==='48px'));
 check('Thirty actual fictional history points',await page.evaluate(()=>echarts.getInstanceByDom(document.getElementById('detail-chart')).getOption().series[0].data.length===30));
 await page.locator('#chart-range').selectOption('7');check('Seven-day display changes actual series',await page.evaluate(()=>echarts.getInstanceByDom(document.getElementById('detail-chart')).getOption().series[0].data.length===7));
 await page.locator('#chart-range').selectOption('30');await page.locator('#history-state').click();check('Insufficient history hides chart and signal',await page.locator('#detail-chart').isHidden()&&(await page.locator('#detail-signal').innerText())==='数据不足');
 await page.locator('[data-chart="dates"]').click();check('Calendar view has separate 61-day data and label',(await page.locator('#chart-title').innerText()).includes('日期最低候选')&&await page.evaluate(()=>echarts.getInstanceByDom(document.getElementById('detail-chart')).getOption().series[0].data.length===61));
 check('Calendar view does not apply flight history signal',(await page.locator('#detail-signal-label').innerText()).includes('日期候选最低价'));
 await page.locator('[data-chart="history"]').click();await page.locator('#history-state').click();await page.waitForTimeout(500);await page.screenshot({path:path.join(shots,'cockpit-details-desktop.png'),fullPage:true});
 await page.locator('nav [data-view="meet"]').click();check('All three meeting alternatives initially',await page.locator('.pair').count()===3);
 await page.locator('#gap').focus();await page.keyboard.press('Home');check('Keyboard slider filters to nearest arrival',await page.locator('.pair').count()===1&&(await page.locator('#gap-value').innerText())==='15 分钟');
 await page.keyboard.press('End');await page.screenshot({path:path.join(shots,'cockpit-meet-desktop.png'),fullPage:true});
 await page.locator('nav [data-view="flex"]').click();await page.locator('#flex .chart-table summary').click();await page.locator('[data-cell="0,0"]').click();check('Unverified price clearly remains unverified',(await page.locator('#flex-selection').innerText()).includes('待核验'));
 await page.locator('[data-cell="1,1"]').click();check('Verified cell identifies complete itinerary and baggage',(await page.locator('#flex-selection').innerText()).includes('完整往返及行李符合'));
 await page.locator('#flex .chart-table summary').click();await page.waitForTimeout(500);await page.screenshot({path:path.join(shots,'cockpit-flex-desktop.png'),fullPage:true});
 const defaultLight=await page.locator('body').evaluate(e=>e.classList.contains('light'));await page.locator('#theme-toggle').click();await page.waitForTimeout(650);check('Default light theme can switch to dark',defaultLight&&await page.locator('body').evaluate(e=>!e.classList.contains('light')));await page.locator('#theme-toggle').click();await page.waitForTimeout(650);await page.screenshot({path:path.join(shots,'cockpit-flex-light.png'),fullPage:true});
 await page.locator('nav [data-view="search"]').click();await page.locator('.state-preview summary').click();for(const state of ['loading','empty','error','partial','unknown','stale']){await page.locator('#state').selectOption(state);check('State '+state+' visible',(await page.locator('#state-content').innerText()).trim().length>0);}check('Stale suspends signal',(await page.locator('#search-signal').innerText())==='等待刷新');await page.locator('#state').selectOption('success');
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 for(const view of ['landing','search','meet','flex']){await page.locator(`nav [data-view="${view}"]`).click();await page.waitForTimeout(80);check('390px '+view+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(shots,`cockpit-${view}-mobile.png`),fullPage:true});}
 await page.locator('nav [data-view="meet"]').click();await page.locator('[data-person="b"]').click();check('Mobile traveler tabs preserve access to B',await page.locator('#person-b').isVisible()&&await page.locator('#person-a').isHidden());
 await page.locator('nav [data-view="search"]').click();await page.locator('#hero-details').click();check('390px details no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(shots,'cockpit-details-mobile.png'),fullPage:true});
 check('Reduced motion disables custom cursor',await page.locator('#context-cursor').evaluate(e=>getComputedStyle(e).display==='none'));
 check('No JavaScript runtime errors',errors.length===0);check('Offline prototype makes no HTTP requests',external.length===0);
}catch(e){error=e.message;console.error(e.stack);}finally{await browser.close();const result={date:'2026-10-12',artifact:'cockpit prototype',checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,error,application_tests:'not_implemented',live_provider:'not_executed'};fs.writeFileSync(path.join(out,'cockpit-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,failed:result.failed,error}));if(error)process.exitCode=1;}})();
