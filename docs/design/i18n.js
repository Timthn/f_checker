/* Local prototype localization. API locale/error contract is specified in docs. */
(()=>{
 'use strict';
 let locale='zh-Hans';
 try { if(localStorage.getItem('flight-cheaker.locale')==='en')locale='en'; } catch {}
 const pairs=[
 ['模拟数据 · 未连接航班 API · 不可用于购票','Demo data · No flight API connected · Not for booking'],
 ['设计原型 · 所有价格及航班均为虚构','Design prototype · All flights and prices are fictional'],
 ['每一次出发，都更有把握','A clearer view before every departure'],['找到合适的价格，','Find the fare that fits.'],['也找到一起抵达的好时刻。','Find a time to arrive together.'],
 ['十个好选择，一眼看懂价格走势。','Ten options. A clear view of price history.'],['不同城市出发，同一天会合。','Different origins. The same arrival day.'],['给日期一点空间，给预算更多选择。','Flexible dates. More room in your budget.'],
 ['比较航班与行李','Compare flights and baggage'],['找到双方都合适的方案','Find a match for both travelers'],['探索出发 × 返回组合','Explore departure × return dates'],['为价格敏感，也为相聚而飞。','For a better fare, and a shared destination.'],
 ['航线动效示意 / 非实时雷达','Illustrative routes / Not live radar'],['暂停航线动效','Pause animation'],['播放航线动效','Play animation'],['已减少动态效果','Reduced motion enabled'],
 ['以下均为可交互的虚构样本','Interactive fictional examples'],['出发机场 IATA','Departure airport IATA code'],['到达机场 IATA','Arrival airport IATA code'],['出发机场','From'],['到达机场','To'],['出发日期','Departure date'],['返回日期','Return date'],
 ['随身＋手提＋托运 23kg','Personal item + cabin + checked 23kg'],['随身＋手提 7kg','Personal item + cabin 7kg'],['条件已修改，需重新查询','Filters changed — search to update'],['已更新模拟结果 / 未发起真实查询','Demo updated / No live request made'],['已载入示例','Demo loaded'],
 ['推荐班次 · 演示','Recommended flight · Demo'],['所有航段满足所选条件（模拟）','All segments meet selected criteria (demo)'],['仅解释模拟样本，不构成购票建议','Demo sample comparison only; not booking advice'],
 ['同一行程的历史报价','Price history for the same itinerary'],['同航线条件下的日期最低候选','Lowest candidate by departure date'],['1 成人含所选行李往返总价','Round-trip total with selected bags / 1 adult'],['1 成人含所选行李单程总价','One-way total with selected bags / 1 adult'],
 ['30 次模拟观测 / 09.13—10.12','30 demo observations / Sep 13–Oct 12'],['查看航班详情','View flight details'],['含所选行李总价 / 1 成人','Total with selected bags / 1 adult'],['完整行程与价格记录','Full itinerary and price observations'],['返回候选航班','Back to flight options'],
 ['现在的价格','Current price'],['行李额度','Baggage allowance'],['随身小包','Personal item'],['手提行李','Cabin baggage'],['托运行李','Checked baggage'],['未选择 / 不计入价格','Not selected / Not in total'],['已包含','Included'],
 ['空中时间 / 去程','Flight time / Outbound'],['直飞 · 无需中转','Nonstop · No connections'],['查看前后一个月的日期价格','Explore prices ±30 days'],['出发日前后 30 天','30 days before and after departure'],['本次候选','Candidates found'],['行李口径一致的模拟报价','Demo fares with matching baggage'],
 ['已获取候选中的低价方案','Lowest fares among retrieved options'],['按总价排序，包含所选行李。选择任意班次可更新主图。','Sorted by total including selected bags. Pick a flight to update the chart.'],['10 个模拟候选','10 demo candidates'],['看走势','Price trend'],['View details','View details'],
 ['查看页面状态示例','Preview page states'],['没有匹配结果','No matching results'],['来源错误','Source error'],['部分完成','Partially complete'],['行李未知','Unknown baggage'],['报价过期','Expired quote'],['查询中','Searching'],['成功','Success'],['状态','State'],
 ['航班概览 / 模拟行程','Flight overview / Demo itinerary'],['去程时间（当地）','Outbound time (local)'],['航段与行李','Segments and baggage'],['价格趋势','Price trend'],['历史报价','Price history'],['日期价格','Date prices'],
 ['横轴：观测日期 / 纵轴：总价 HKD / 相同行程、舱位、行李口径','X: observation date / Y: total HKD / Same itinerary, cabin and bags'],['横轴：出发日期 / 纵轴：总价 HKD / 出发日前后各 30 天 / ','X: departure date / Y: total HKD / ±30 days / '],
 ['当前价格信号 / 模拟','Current price signal / Demo'],['日期候选最低价 / 模拟','Lowest date candidate / Demo'],['显示范围','Display window'],['30 天观测','30 days'],['最近 7 天观测','Last 7 days'],['演示数据不足','Preview insufficient data'],['恢复模拟数据','Restore demo data'],
 ['可比观测不足，暂不判断价格高低。接入数据源后从采样日起积累历史。','Too few comparable observations to judge the price. History starts when sampling begins after a source is connected.'],
 ['每个点代表相同行程的一次虚构观测；虚线为当前显示范围均价。信号基于完整 30 日模拟样本中位数。拖动底部滑块可缩放。','Each point is a fictional observation of the same itinerary. The dashed line is the displayed average. The signal uses the full 30-day demo median. Drag the bottom handles to zoom.'],
 ['每个点代表该出发日的航线最低候选，不是上方具体班次的历史价格。报价和覆盖范围均为模拟。','Each point is the lowest route candidate for that departure day, not the selected flight’s history. Prices and coverage are simulated.'],
 ['查看图表数据表','View chart data table'],['没有足够的可比观测。','Not enough comparable observations.'],['行程详情','Itinerary details'],['价格里有什么','Price breakdown'],['出发前再确认','Before booking'],
 ['退改规则与实时库存待接入来源确认。这里展示交互设计，不提供预订。','Change rules and live availability need source verification. This prototype does not offer booking.'],
 ['所有金额为虚构往返含税总价；随身及手提行李已包含。','All amounts are fictional round-trip totals including tax, personal item and cabin baggage.'],['所有金额为虚构单程含税总价；随身及手提行李已包含。','All amounts are fictional one-way totals including tax, personal item and cabin baggage.'],
 ['基础票价','Base fare'],['所选托运附加费','Selected checked-bag fee'],['全部包含（模拟）','Included on all segments (demo)'],['出发 / 当地时间','Departure / Local time'],['到达 / 当地时间','Arrival / Local time'],
 ['两地出发，一个目的地','Two origins, one destination'],['会合目的地','Shared destination'],['目的地当地日期','Local date at destination'],['最大到达时间差','Maximum arrival gap'],['匹配双方航班','Match both travelers'],['推荐会合组合','Recommended arrival matches'],
 ['同一到达机场；按双方合计价格排序。固定条件的模拟组合。','Same arrival airport, sorted by combined total. Demo combinations with fixed filters.'],['到达时间：日本时间','Arrival times: Japan local time'],['最低总价','Lowest combined fare'],['到达更同步','Closer arrivals'],['最短等待','Shortest wait'],['双方含行李合计','Combined total including baggage'],['价格优先','Lowest price first'],
 ['出发窗口','Departure window'],['返回窗口','Return window'],['11 月 1 日 — 11 月 3 日','Nov 1 — Nov 3'],['11 月 7 日 — 11 月 9 日','Nov 7 — Nov 9'],['探索日期组合','Explore date combinations'],['日期 × 价格','Dates × prices'],
 ['点击格子查看组合；“待核验”价格不能当成满足行李条件。','Select a cell to inspect the pair. Unverified fares may not meet your baggage needs.'],['固定模拟日期','Fixed demo dates'],['使用表格选择日期（支持键盘）','Choose dates in a table (keyboard accessible)'],['2026 年 11 月 / 价格单位 HKD','November 2026 / Prices in HKD'],['出发 / 返回','Departure / Return'],
 ['已核验候选最低 · 模拟','Lowest verified candidate · Demo'],['往返总价，包含所选行李','Round-trip total including selected bags'],['查询覆盖范围','Search coverage'],['3 个已核验、6 个待核验（均为模拟）。当前结果仅覆盖部分日期组合。','3 verified and 6 unverified demo pairs. Results cover only part of the date window.'],['所选日期组合','Selected date pair'],['模拟已核验：完整往返及行李符合','Demo verified: complete round trip and required bags'],['粗报价：行李与完整往返待核验','Estimate: baggage and full round trip unverified'],['待核验粗报价','Unverified estimate'],
 ['出发与到达机场不能相同。','Origin and destination must be different.'],['这个演示仅支持返回日不早于出发日。跨日期变更线行程将在正式数据接入后按 UTC 校验。','This demo requires the return date to be on or after departure. Date-line crossings will use UTC validation after live integration.'],
 ['正在解析行程与行李 / 模拟进度 55%','Checking itinerary and baggage / Demo progress 55%'],['没有符合条件的候选。请调整日期或行李条件后重新查询。','No matching options. Adjust dates or baggage and search again.'],['来源暂不可用，请稍后重试。输入已保留；这不代表没有航班。','The source is temporarily unavailable. Try again later. Your inputs are saved; this does not mean there are no flights.'],
 ['部分结果待核验。下面只展示已完成的模拟候选。','Some results need verification. Only completed demo candidates are shown below.'],['另有 2 个模拟候选的行李额度未知，未进入下方主榜。未知附加费不能视为免费。','Two additional demo candidates have unknown baggage and are excluded below. Unknown fees must not be treated as free.'],['模拟报价已过期。请重新查询；价格信号已暂停。','The demo quote has expired. Search again; the price signal is paused.'],['过期数据不输出价格判断','Expired data cannot support a price signal'],['等待刷新','Awaiting refresh'],['取消查询','Cancel search'],
 ['Flight cheaker 首页','Flight cheaker home'],['F Checker 首页','Flight cheaker home'],['主导航','Main navigation'],['切换深色主题','Switch to dark theme'],['切换浅色主题','Switch to light theme'],['切换主题','Change theme'],
 ['模拟历史报价，横轴观测日期，纵轴港币总价','Demo history: observation date on X axis, total HKD on Y axis'],['模拟往返日期价格热力图，横轴返回日，纵轴出发日','Demo round-trip price heatmap: return date on X axis, departure date on Y axis'],
 ['航班查询','Flight search'],['查询机票','Search flights'],['会合方案','Arrival matches'],['一起抵达','Meet up'],['找机票','Flights'],['灵活日期','Flexible dates'],['启程','Home'],['演示空间','Demo workspace'],
 ['所选行李已计入','Selected bags included'],['未发起真实查询','No live request made'],['虚构演示数据','Fictional demo data'],['虚构班次','Fictional flight'],['虚构时刻','Fictional schedule'],['演示航空','Demo Air'],['演示行程','Demo itinerary'],['模拟已核验','Demo verified'],['模拟数据','Demo data'],['模拟总价','Demo total'],['可比样本中位数','comparable sample median'],
 ['含所选行李总价','Total including selected bags'],['手提 7kg＋托运 23kg','Cabin 7kg + checked 23kg'],['手提 7kg','Cabin 7kg'],['经济舱','Economy'],['商务舱','Business'],['数据不足','Insufficient data'],['待核验','Unverified'],['已核验','Verified'],['未选择','Not selected'],['当前价格信号','Current price signal'],
 ['起 / 单程模拟报价','from / Demo one-way fare'],['香港出发','From Hong Kong'],['新加坡出发','From Singapore'],['东京到达','Arrive Tokyo'],['一起抵达东京','Meet in Tokyo'],['香港','Hong Kong'],['新加坡','Singapore'],['东京','Tokyo'],['伦敦','London'],['台北','Taipei'],['首尔','Seoul'],
 ['当地时间','Local time'],['30 日均价','30-day average'],['观测日期','Observation date'],['旅行日期','Travel date'],['总价 HKD（模拟）','Total HKD (demo)'],['总价 / HKD','Total / HKD'],['偏低','Low'],['偏高','High'],['适中','Typical'],['较低','Lower'],['较高','Higher'],['直飞','Nonstop'],['往返','Round trip'],['单程','One way'],['去程','Outbound'],['回程','Return'],['舱位','Cabin'],['行李','Baggage'],['行程','Trip'],['航班','Flight'],['旅伴 A','Traveler A'],['旅伴 B','Traveler B'],['出发日','Departure'],['返回日','Return'],['模拟','Demo'],['总价','Total'],['进入','Open']
 ];
 pairs.sort((a,b)=>b[0].length-a[0].length);
 function translate(value){if(locale!=='en'||typeof value!=='string')return value;const exact=pairs.find(([zh])=>zh===value.trim());if(exact)return value.replace(value.trim(),exact[1]);let s=value;
  s=s.replace(/(低于|高于)可比样本中位数 ([\d.]+)%/g,(_,dir,n)=>`${n}% ${dir==='低于'?'below':'above'} comparable median`)
    .replace(/(\d+) 个组合/g,'$1 combinations').replace(/(\d+) 成人/g,'$1 adult').replace(/(\d+) 分钟/g,'$1 min')
    .replace(/(\d+) 日平均报价/g,'$1-day average fare').replace(/(\d+) 个出发日期平均报价/g,'Average across $1 departure dates')
    .replace(/比最低总价多 (HK\$ [\d,]+)，少等 (\d+) 分钟/g,'$1 above lowest total, $2 min less waiting')
    .replace(/比最低总价多 (HK\$ [\d,]+)，少等 (\d+) min/g,'$1 above lowest total, $2 min less waiting')
    .replace(/到达相差 (\d+) min/g,'Arrive $1 min apart').replace(/固定 (\d+) 晚/g,'Fixed $1-night stay').replace(/(\d+) 晚/g,'$1 nights')
    .replace(/(\d{2}:\d{2}) 出发/g,'$1 departure').replace(/(\d{2}:\d{2}) 到达/g,'$1 arrival').replace(/ 观测 /g,' observed ');
  for(const [zh,en]of pairs)s=s.split(zh).join(en);
  return s.replace(/（/g,' (').replace(/）/g,')').replace(/，/g,', ').replace(/；/g,'; ').replace(/：/g,': ').replace(/。/g,'.').replace(/＋/g,' + ').replace(/＝/g,' = ');
 }
 const sources=new WeakMap(),attributes=new WeakMap();let observer;
 function apply(){observer?.disconnect();const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){if(['SCRIPT','STYLE','CANVAS'].includes(node.parentElement?.tagName)||node.parentElement?.closest('#language-toggle'))continue;let entry=sources.get(node);if(!entry||node.textContent!==entry.last)entry={source:node.textContent,last:node.textContent};entry.last=translate(entry.source);if(node.textContent!==entry.last)node.textContent=entry.last;sources.set(node,entry);}
  document.querySelectorAll('[aria-label],[title],[aria-valuetext]').forEach(el=>{if(el.id==='language-toggle')return;let map=attributes.get(el)||{};for(const key of ['aria-label','title','aria-valuetext']){const current=el.getAttribute(key);if(current===null)continue;let entry=map[key];if(!entry||current!==entry.last)entry={source:current,last:current};entry.last=translate(entry.source);if(current!==entry.last)el.setAttribute(key,entry.last);map[key]=entry;}attributes.set(el,map);});
  document.documentElement.lang=locale;observer?.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','aria-valuetext']});
 }
 function option(value,key){if(typeof value==='string')return translate(value);if(typeof value==='function'&&key==='formatter')return(...args)=>translate(value(...args));if(Array.isArray(value))return value.map(v=>option(v));if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,option(v,k)]));return value;}
 window.flightLocale={apply,translate,option,get language(){return locale;}};
 observer=new MutationObserver(apply);
 const toggle=document.getElementById('language-toggle');
 function syncToggle(){toggle.textContent=locale==='en'?'中文':'EN';toggle.lang=locale==='en'?'zh-Hans':'en';toggle.setAttribute('aria-label',locale==='en'?'切换为中文':'Switch to English');}
 toggle.onclick=()=>{locale=locale==='en'?'zh-Hans':'en';try{localStorage.setItem('flight-cheaker.locale',locale);}catch{}syncToggle();apply();window.dispatchEvent(new Event('flight-language-change'));};
 syncToggle();
 apply();
})();
