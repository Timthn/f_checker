/* Fictional, local-only design interactions. No provider calls or booking actions. */
'use strict';
const $ = id => document.getElementById(id);
const all = selector => [...document.querySelectorAll(selector)];
const money = n => 'HK$ ' + Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const charts = {};
let view = 'landing', selected = 0, chartMode = 'history', insufficient = false;
let query = {origin:'HKG',dest:'NRT',outdate:'2026-11-01',retdate:'2026-11-08',trip:'roundtrip',cabin:'economy',bags:'carry'};
let fares = [];
const cityNames = {HKG:'香港',NRT:'东京',SIN:'新加坡',LHR:'伦敦',TPE:'台北',ICN:'首尔'};
const city = code => cityNames[code] || code;
const cabin = () => query.cabin === 'business' ? '商务舱' : '经济舱';
const checked = () => query.bags === 'checked';
const trip = () => query.trip === 'roundtrip' ? '往返' : '单程';
const bagText = () => checked() ? '手提 7kg＋托运 23kg' : '手提 7kg';
const selectedFare = () => fares[selected];
const datePlus = (date, days) => new Date(Date.parse(date+'T12:00:00Z') + days * 86400000).toISOString().slice(0,10);
function set(id, text) { $(id).textContent = text; }
function median(values) { const a = [...values].sort((a,b)=>a-b); return (a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2; }
function historyData() {
  const price = selectedFare().price;
  return Array.from({length:30},(_,i)=>({date:datePlus('2026-09-13',i),value:i===29?price:Math.round((price*(1.20-i*.0045)+Math.sin(i*1.7+selected)*105)/10)*10}));
}
function calendarData() {
  const price = selectedFare().price;
  return Array.from({length:61},(_,i)=>({date:datePlus(query.outdate,i-30),value:Math.round((price*.87+(Math.sin(i*.72)+1)*145+(i%7===5?240:0))/10)*10}));
}
function priceSignal() { const m=median(historyData().map(d=>d.value)),delta=(selectedFare().price/m-1)*100;return {label:delta<=-5?'偏低 ↘':delta>=5?'偏高 ↗':'适中 →',delta}; }
function getChart(id) {
  if (!charts[id]) charts[id] = echarts.init($(id),null,{renderer:'canvas'});
  return charts[id];
}
function lineOption(data, compact=false) {
  const values=data.map(d=>d.value),avg=Math.round(values.reduce((a,b)=>a+b,0)/values.length);
  return {animation:!reduceMotion.matches,animationDuration:450,animationDurationUpdate:300,aria:{enabled:true},textStyle:{fontFamily:'Segoe UI, Microsoft YaHei, sans-serif'},grid:{left:58,right:22,top:36,bottom:compact?27:62},tooltip:{trigger:'axis',confine:true,backgroundColor:'#14292a',borderWidth:0,textStyle:{color:'#e5efec',fontSize:12},axisPointer:{type:'line',lineStyle:{color:'#627b69',type:'dashed'}},formatter:p=>p.length?`${p[0].axisValue}<br/>${chartMode==='dates'&&!compact?'日期最低候选':'含所选行李总价'} <b>${money(p[0].value)}</b><br/><span style="opacity:.7">虚构演示数据</span>`:''},xAxis:{type:'category',data:data.map(d=>d.date),boundaryGap:false,axisLine:{lineStyle:{color:'#82978566'}},axisTick:{show:false},axisLabel:{fontSize:10,color:'#526758',formatter:v=>v.slice(5).replace('-','/'),hideOverlap:true}},yAxis:{type:'value',name:'总价 / HKD',nameTextStyle:{fontSize:10,color:'#526758',align:'left'},nameGap:18,min:v=>Math.floor(v.min/500)*500,max:v=>Math.ceil(v.max/500)*500,splitNumber:3,axisLabel:{fontSize:10,color:'#526758',formatter:v=>v.toLocaleString('en-US')},splitLine:{lineStyle:{color:'#73877125'}}},dataZoom:compact?[]:[{type:'inside',zoomOnMouseWheel:false,moveOnMouseWheel:false},{type:'slider',height:16,bottom:8,borderColor:'transparent',backgroundColor:'#ccddd5',fillerColor:'#7ba79e33',handleStyle:{color:'#56837a'},textStyle:{color:'#526758'},showDetail:false}],series:[{name:'模拟总价',type:'line',data:values,smooth:.18,showSymbol:false,symbolSize:7,lineStyle:{color:'#24443b',width:2},itemStyle:{color:'#24443b',borderColor:'#f6e5ab',borderWidth:2},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#58755e26'},{offset:1,color:'#58755e00'}])},emphasis:{focus:'series'},markLine:{silent:true,symbol:'none',label:{show:false},lineStyle:{color:'#667b5d',type:'dashed',width:1},data:[{yAxis:avg}]}}]};
}
function renderHero() {
  const f=selectedFare(),signal=priceSignal();
  set('hero-carrier','演示航空 / '+f.flight);
  $('hero-route').innerHTML=esc(query.origin)+' <span>—</span> '+esc(query.dest);
  set('hero-schedule',`${f.depart} 出发 · ${f.arrive} 到达 / 当地时间 · 虚构时刻`);
  set('hero-price',money(f.price));set('hero-price-note',`1 成人含所选行李${trip()}总价`);
  set('hero-history-summary','30 次模拟观测 / 09.13—10.12');
  set('search-signal',signal.label);set('signal-copy',`${signal.delta<0?'低于':'高于'}可比样本中位数 ${Math.abs(signal.delta).toFixed(1)}%`);
  document.querySelector('.range-meter i').style.left=signal.delta<=-5?'18%':signal.delta>=5?'82%':'50%';
  set('checked-label',checked()?'1 × 23 kg':'未选择 / 不计入价格');
  if(view==='search') {
    const chart=getChart('hero-chart');chart.setOption(lineOption(historyData(),true),true);chart.resize();
    chart.off('updateAxisPointer');chart.on('updateAxisPointer',e=>{const v=e.axesInfo?.[0]?.value;const d=historyData()[v];if(d)set('hero-history-summary',`${d.date} 观测 / ${money(d.value)} / 模拟`);});
    chart.getZr().off('globalout');chart.getZr().on('globalout',()=>set('hero-history-summary','30 次模拟观测 / 09.13—10.12'));
  }
}
function buildFares() {
  const multiplier=query.cabin==='business'?3.2:1,one=query.trip==='oneway',bagFee=checked()?(one?160:320):0;
  fares=Array.from({length:10},(_,i)=>{const base=Math.round((2100+i*125)*(one?.58:1)*multiplier);const hour=9+Math.floor(i/2),min=i%2?'40':'10';return {id:'demo-offer-'+i,flight:'FC '+(201+i*2),returnFlight:'FC '+(202+i*2),price:base+bagFee,base,bagFee,depart:`${String(hour).padStart(2,'0')}:${min}`,arrive:`${String(hour+5).padStart(2,'0')}:${min}`};});
  selected=0;renderFares();renderHero();
}
function renderFares() {
  $('fares').innerHTML=fares.map((f,i)=>`<article class="fare ${i===selected?'selected':''}"><div class="fare-rank">${String(i+1).padStart(2,'0')}</div><div><h3>演示航空 / ${f.flight}</h3><small>${cabin()} · 直飞 · 虚构班次</small></div><div class="schedule"><div class="flighttime">${f.depart}<span>—</span>${f.arrive}</div><small>${esc(query.origin)} → ${esc(query.dest)} / 当地时间</small><small>${query.outdate}${query.trip==='roundtrip'?' — '+query.retdate:''}</small></div><div class="bags">${bagText()}<small>${trip()}所选行李已计入 · 模拟</small></div><div class="price"><div class="money">${money(f.price)}</div><small>1 成人 / ${trip()}总价</small><div class="fare-actions"><button class="text-button" data-select="${i}" aria-pressed="${i===selected}">看走势</button><button class="btn" data-detail="${i}">View details ↗</button></div></div></article>`).join('');
  all('[data-select]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.select);renderFares();renderHero();document.querySelector('.hero-card').scrollIntoView({behavior:reduceMotion.matches?'instant':'smooth',block:'start'});});
  all('[data-detail]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.detail);chartMode='history';insufficient=false;renderFares();showView('details');});
}
function renderDetails() {
  const f=selectedFare(),hist=chartMode==='history',nights=Math.max(0,Math.round((Date.parse(query.retdate)-Date.parse(query.outdate))/86400000));
  set('detail-title',`${city(query.origin)} ${query.origin} — ${city(query.dest)} ${query.dest}`);
  set('detail-context',`${query.outdate}${query.trip==='roundtrip'?' — '+query.retdate:''} / ${trip()} / 1 成人 / HKD / 演示航空`);
  set('detail-price',money(f.price));set('detail-flight',f.flight);set('detail-time',`${f.depart} — ${f.arrive}`);set('detail-cabin',cabin());set('detail-bags',bagText());
  all('[data-chart]').forEach(b=>{b.classList.toggle('selected',b.dataset.chart===chartMode);b.setAttribute('aria-pressed',b.dataset.chart===chartMode);});
  set('chart-title',hist?'同一行程的历史报价':'同航线条件下的日期最低候选');
  set('chart-sub',hist?'横轴：观测日期 / 纵轴：总价 HKD / 相同行程、舱位、行李口径':`横轴：出发日期 / 纵轴：总价 HKD / 出发日前后各 30 天 / ${query.trip==='roundtrip'?'固定 '+nights+' 晚':'单程'}`);
  $('chart-range').disabled=!hist; $('history-state').hidden=!hist;
  set('history-state',insufficient?'恢复模拟数据':'演示数据不足');
  const empty=hist&&insufficient;
  $('history-notice').hidden=!empty; $('detail-chart').hidden=empty;
  const data=hist?historyData().slice(-Number($('chart-range').value)):calendarData();
  const avg=Math.round(data.reduce((s,d)=>s+d.value,0)/data.length);
  set('average-label',hist?`${data.length} 日平均报价`:'61 个出发日期平均报价');set('average-price',empty?'—':money(avg));
  set('detail-signal-label',hist?'当前价格信号 / 模拟':'日期候选最低价 / 模拟');
  set('detail-signal',empty?'数据不足':hist?priceSignal().label:money(Math.min(...data.map(d=>d.value))));
  set('chart-caption',hist?'每个点代表相同行程的一次虚构观测；虚线为当前显示范围均价。信号基于完整 30 日模拟样本中位数。拖动底部滑块可缩放。':'每个点代表该出发日的航线最低候选，不是上方具体班次的历史价格。报价和覆盖范围均为模拟。');
  $('detail-chart').setAttribute('aria-label',$('chart-title').textContent+'；'+$('chart-sub').textContent+'；模拟数据');
  $('chart-data-table').innerHTML=empty?'<p>没有足够的可比观测。</p>':`<table><thead><tr><th>${hist?'观测日期':'出发日期'}</th><th>总价 HKD（模拟）</th></tr></thead><tbody>${data.map(d=>`<tr><td>${d.date}</td><td>${d.value.toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table>`;
  if(!empty&&view==='details'){getChart('detail-chart').setOption(lineOption(data),true);charts['detail-chart'].resize();}
  const segment=(label,flight,date,from,to,departure,arrival)=>`<div class="segment"><span>${label}<br>${date}</span><div><strong>${departure} ${esc(from)}</strong><small>出发 / 当地时间</small></div><div><strong>${arrival} ${esc(to)}</strong><small>到达 / 当地时间</small></div><div><b>${flight} / ${cabin()}</b><small>${bagText()} · 全部包含（模拟）</small></div></div>`;
  $('segments').innerHTML=segment('去程',f.flight,query.outdate,query.origin,query.dest,f.depart,f.arrive)+(query.trip==='roundtrip'?segment('回程',f.returnFlight,query.retdate,query.dest,query.origin,'16:30','20:30'):'');
  set('fare-breakdown',`基础票价 ${money(f.base)} ＋ 所选托运附加费 ${money(f.bagFee)} ＝ ${money(f.price)}。所有金额为虚构${trip()}含税总价；随身及手提行李已包含。`);
}
function showView(next,writeHash=true) {
  if(!['landing','search','details','meet','flex'].includes(next))next='landing';view=next;
  all('.view').forEach(el=>el.hidden=el.id!==view);
  all('nav [data-view]').forEach(b=>{const active=b.dataset.view===(view==='details'?'search':view);b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
  if(writeHash&&location.hash!=='#'+view)history.pushState(null,'','#'+view);
  window.scrollTo({top:0,behavior:'instant'});$('context-cursor').classList.remove('visible');
  if(view==='search')renderState();if(view==='details')renderDetails();if(view==='flex')renderFlex();
  requestAnimationFrame(()=>{Object.values(charts).forEach(c=>{if(c.getDom().getClientRects().length)c.resize();});moveNavPill();});
}
all('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
window.addEventListener('hashchange',()=>showView(location.hash.slice(1)||'landing',false));
window.addEventListener('popstate',()=>showView(location.hash.slice(1)||'landing',false));
$('search-form').addEventListener('input',()=>{set('query-status','条件已修改，需重新查询');$('return-field').hidden=$('trip').value==='oneway';$('retdate').required=$('trip').value==='roundtrip';});
$('search-form').onsubmit=e=>{e.preventDefault();const next=Object.fromEntries(Object.keys(query).map(k=>[k,$(k).value]));next.origin=next.origin.toUpperCase();next.dest=next.dest.toUpperCase();if(next.origin===next.dest){$('state-content').innerHTML='<div class="notice">出发与到达机场不能相同。</div>';return;}if(next.trip==='roundtrip'&&next.retdate<next.outdate){$('state-content').innerHTML='<div class="notice">这个演示仅支持返回日不早于出发日。跨日期变更线行程将在正式数据接入后按 UTC 校验。</div>';return;}query=next;set('search-title',`下一站，${city(query.dest)}。`);buildFares();$('state').value='success';renderState();set('query-status','已更新模拟结果 / 未发起真实查询');};
$('hero-details').onclick=()=>{chartMode='history';showView('details');};$('explore-dates').onclick=()=>{chartMode='dates';showView('details');};
all('[data-chart]').forEach(b=>b.onclick=()=>{chartMode=b.dataset.chart;renderDetails();});
$('chart-range').onchange=renderDetails;$('history-state').onclick=()=>{insufficient=!insufficient;renderDetails();};
function renderState(){const state=$('state').value;const text={success:'',loading:'正在解析行程与行李 / 模拟进度 55%',empty:'没有符合条件的候选。请调整日期或行李条件后重新查询。',error:'来源暂不可用，请稍后重试。输入已保留；这不代表没有航班。',partial:'部分结果待核验。下面只展示已完成的模拟候选。',unknown:'另有 2 个模拟候选的行李额度未知，未进入下方主榜。未知附加费不能视为免费。',stale:'模拟报价已过期。请重新查询；价格信号已暂停。'};$('search-results').hidden=['loading','empty','error'].includes(state);$('state-content').innerHTML=text[state]?`<div class="notice">${text[state]}${state==='loading'?'<button id="cancel-demo" class="btn">取消查询</button>':''}</div>`:'';if($('cancel-demo'))$('cancel-demo').onclick=()=>{$('state').value='partial';renderState();};if(state==='stale'){set('search-signal','等待刷新');set('signal-copy','过期数据不输出价格判断');}else if(view==='search')renderHero();}
$('state').onchange=renderState;
const pairs=[{a:2100,b:2550,at:'14:10',bt:'15:50',gap:100,label:'最低总价'},{a:2180,b:2680,at:'14:10',bt:'14:30',gap:20,label:'到达更同步'},{a:2350,b:2760,at:'14:20',bt:'14:30',gap:10,label:'最短等待'}];
function renderPairs(){const gap=[15,30,60,120][Number($('gap').value)];set('gap-value',gap+' 分钟');$('gap').setAttribute('aria-valuetext',gap+' 分钟');const shown=pairs.filter(p=>p.gap<=gap);$('pairs').innerHTML=shown.map(p=>`<article class="panel pair"><div><span class="tag">${p.label} / 模拟</span><h3>到达相差 ${p.gap} 分钟</h3><small>${p.gap===100?'价格优先':`比最低总价多 ${money(p.a+p.b-4650)}，少等 ${100-p.gap} 分钟`}</small></div><div><span class="arrival">${p.at}</span><small>A · 香港出发 / 东京到达</small><small>${money(p.a)} / 单程</small></div><div><span class="arrival">${p.bt}</span><small>B · 新加坡出发 / 东京到达</small><small>${money(p.b)} / 单程</small></div><div class="pair-total">${money(p.a+p.b)}<small>双方含行李合计</small></div></article>`).join('');}
$('gap').oninput=renderPairs;$('meet-btn').onclick=renderPairs;
all('[data-person]').forEach(b=>b.onclick=()=>{['a','b'].forEach(p=>$('person-'+p).classList.toggle('mobile-hidden',p!==b.dataset.person));all('[data-person]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b);});});
const matrix=[[2300,2100,2200],[2150,1980,2050],[2250,2090,2140]];
const verified=(i,j)=>(i===0&&j===1)||(i===1&&j===1)||(i===2&&j===2);
function pickCell(i,j){set('flex-selection',`11/0${i+1} → 11/0${j+7} · ${money(matrix[i][j])} · ${verified(i,j)?'模拟已核验：完整往返及行李符合':'粗报价：行李与完整往返待核验'}`);all('[data-cell]').forEach(b=>b.classList.toggle('picked',b.dataset.cell===`${i},${j}`));}
function renderFlex(){const light=document.body.classList.contains('light'),fg=light?'#173431':'#c2d9d5';const data=matrix.flatMap((row,i)=>row.map((v,j)=>[j,i,v]));getChart('flex-chart').setOption({animation:!reduceMotion.matches,animationDuration:250,animationDurationUpdate:200,aria:{enabled:true},grid:{left:62,right:12,top:40,bottom:85},tooltip:{confine:true,formatter:p=>`11/0${p.value[1]+1} → 11/0${p.value[0]+7}<br/>${money(p.value[2])}<br/>${verified(p.value[1],p.value[0])?'模拟已核验':'待核验粗报价'}`},xAxis:{type:'category',name:'返回日',nameLocation:'middle',nameGap:28,data:['11/07','11/08','11/09'],axisLine:{show:false},axisTick:{show:false},axisLabel:{color:fg,fontSize:11},nameTextStyle:{color:fg,fontSize:10},splitArea:{show:false}},yAxis:{type:'category',name:'出发日',data:['11/01','11/02','11/03'],inverse:true,axisLine:{show:false},axisTick:{show:false},axisLabel:{color:fg,fontSize:11},nameTextStyle:{color:fg,fontSize:10}},visualMap:{min:1980,max:2300,orient:'horizontal',left:'center',bottom:0,itemWidth:10,itemHeight:120,text:['较高','较低'],textStyle:{color:fg,fontSize:10},inRange:{color:['#d9eee0','#a3c9be','#759b9d']}},series:[{type:'heatmap',data,label:{show:true,color:'#071c20',fontSize:12,formatter:p=>`${p.value[2].toLocaleString('en-US')}\n${verified(p.value[1],p.value[0])?'✓ 已核验':'待核验'}`},itemStyle:{borderWidth:5,borderColor:light?'#f5f8f5':'#132a2e',borderRadius:7},emphasis:{itemStyle:{borderColor:'#efb580',borderWidth:3}}}]},true);charts['flex-chart'].off('click');charts['flex-chart'].on('click',p=>pickCell(p.value[1],p.value[0]));charts['flex-chart'].resize();}
$('matrix').innerHTML=matrix.map((row,i)=>`<tr><th>11/0${i+1}</th>${row.map((v,j)=>`<td><button data-cell="${i},${j}" data-verified="${verified(i,j)}">${v.toLocaleString('en-US')}<small>${verified(i,j)?'✓ 已核验':'待核验'}</small></button></td>`).join('')}</tr>`).join('');all('[data-cell]').forEach(b=>b.onclick=()=>pickCell(...b.dataset.cell.split(',').map(Number)));$('flex-btn').onclick=()=>{renderFlex();pickCell(1,1);};
function moveNavPill(target=document.querySelector('nav .active')){if(!target)return;const pill=$('nav-pill');pill.style.width=target.offsetWidth+'px';pill.style.transform=`translateX(${target.offsetLeft}px)`;}
all('nav button').forEach(b=>{b.onpointerenter=()=>{if(!finePointer.matches)return;all('nav button').forEach(x=>x.classList.toggle('hovered',x===b));document.querySelector('nav .active')?.classList.add('hover-away');moveNavPill(b);};b.onfocus=()=>moveNavPill(b);});document.querySelector('nav').onpointerleave=()=>{all('nav button').forEach(b=>b.classList.remove('hovered'));moveNavPill();};document.querySelector('nav').addEventListener('focusout',()=>requestAnimationFrame(()=>{if(!document.querySelector('nav').contains(document.activeElement))moveNavPill();}));
let scrollPending=false;window.addEventListener('scroll',()=>{if(scrollPending)return;scrollPending=true;requestAnimationFrame(()=>{scrollPending=false;const depth=!reduceMotion.matches&&innerWidth>600&&view==='landing'?Math.min(90,scrollY*.18):0;document.documentElement.style.setProperty('--depth',depth+'px');document.documentElement.style.setProperty('--blur',Math.min(2.5,depth/32)+'px');});},{passive:true});
document.addEventListener('pointermove',e=>{if(!finePointer.matches||reduceMotion.matches)return;all('.magnetic').filter(b=>b.getClientRects().length).forEach(b=>{const r=b.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,near=Math.abs(x)<r.width/2+22&&Math.abs(y)<r.height/2+22;b.style.setProperty('--mag-x',near?Math.max(-4,Math.min(4,x*.05))+'px':'0px');b.style.setProperty('--mag-y',near?Math.max(-3,Math.min(3,y*.06))+'px':'0px');});const cursor=$('context-cursor'),entry=e.target.closest('.entry');cursor.classList.toggle('visible',!!entry);cursor.style.transform=`translate(${e.clientX+14}px,${e.clientY+14}px)`;});document.addEventListener('pointerleave',()=>$('context-cursor').classList.remove('visible'));
let changingTheme=false;$('theme-toggle').onclick=async e=>{if(changingTheme)return;changingTheme=true;const apply=()=>{document.body.classList.toggle('light');const light=document.body.classList.contains('light');$('theme-toggle').textContent=light?'☾':'☼';$('theme-toggle').setAttribute('aria-label',light?'切换深色主题':'切换浅色主题');if(view==='flex')renderFlex();};try{if(document.startViewTransition&&!reduceMotion.matches){const rect=$('theme-toggle').getBoundingClientRect(),x=e.clientX||rect.left+rect.width/2,y=e.clientY||rect.top+rect.height/2,r=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));const transition=document.startViewTransition(apply);await transition.ready;await document.documentElement.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${r}px at ${x}px ${y}px)`]},{duration:520,easing:'cubic-bezier(.2,.7,.2,1)',pseudoElement:'::view-transition-new(root)'}).finished;}else apply();}finally{changingTheme=false;}};
const resize=new ResizeObserver(()=>{Object.values(charts).forEach(c=>{if(c.getDom().getClientRects().length)c.resize();});moveNavPill();});resize.observe(document.querySelector('main'));
buildFares();renderPairs();pickCell(1,1);showView(location.hash.slice(1)||'landing',false);
