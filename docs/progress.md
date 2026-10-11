# Progress book

日期：2026-10-11，Asia/Hong_Kong。

## Goal
开发前需求、数据源研究、技术建议、UIUX与系统/前后端规格、凭证预算；非完整应用实施。

## Completed artifacts
- Product spec 四核心功能、双价格视角和 A1–A15 验收标准。
- 独立 sub-agent 评审及第二次复核，必修修订写回规格。
- 第三次独立确认：无剩余 P1/P2；未将文档通过误记为真实接口或应用测试通过。
- Primary-source provider 能力表与 live spike gate。
- 技术比较：建议 Next.js + FastAPI + SQLite，尚未用户最终选定。
- 系统、前端、后端、内部数据契约及 fictional JSON。
- UIUX spec 与离线四页可点击设计原型。
- AGENTS 索引、权限/隔离说明、ADR、凭证/预算、.env.example。

## Verification / Git
Artifact/browser QA：实际运行 45 checks passed、0 failed；无 JS error、无外部HTTP请求；查看了search/details/flex desktop与meet mobile截图，未见布局裁切或页面溢出。详见qa结果。
Applications unit/integration：not implemented，不属于本阶段。
Live provider：pending credentials and approval of a bounded spike。
Git：开发前交付已commit并push至唯一仓库 Timthn/f_checker/main。交付commit `50174a95335649905ce528a3919cc81e388b771b` 已与 `ls-remote` 比对一致，工作区当时干净。本日志更新另行commit，最终状态以git log/status及remote为准。

Goal文档阶段完成：规格/评审、数据源文档研究、选型、UIUX/可点击设计、架构/前后端/contract、账号预算齐全。真实接口验证pending符合本阶段要求，不意味着完整应用完成。

## Next decisions
1. 审阅 UI、筛选规则与建议架构。
2. 决定一个provider，配置其后端Key及≤40次spike额度；不需要全部账号。
3. 根据实测确定connector与功能降级，再制定应用实施计划。
4. 常用航线和月度预算待确认；不影响文档阶段完成。

## Retry counters
Same-test unexplained failure streak: 0。
Repair-validation rounds: 2。第一轮修正生成结果文件前的链接核验顺序；第二轮定位sandbox browser路径映射，使用已存在的Playwright浏览器路径（仅进程环境变量），未安装浏览器或改全局设置。当前连续失败0。
发现问题后有依据修复并记录；stop rules见AGENTS。没有发生删除、跨仓库写入、购票、订阅或部署。

## 2026-10-12 — Cockpit design revision

依据用户三张截图及交互教程重做：航空画布三入口、8/4两行主次查询、48px通栏详情、双人会合及日期热力图。项目内Anthropic frontend-design参考与ECharts 5.6.0保留许可证。用户要求不用Superpowers后直接完成设计与检查。

新增分层景深、导航跟随、卡片翻色、轻磁吸、分档滑杆、图表交互、主题扩散及触屏/减少动效降级。仍为虚构数据，无真实接口或最终技术栈决定。旧原型保留prototype-v1.html。

浏览器36项通过，桌面/手机截图及限制见 [cockpit verification](qa/cockpit-verification.md)。本轮一次断言修正（CSS span序列化），随后优化热力图文字对比、主题图表动画和过期信号；没有未知原因重复失败。仅修改本项目。提交/推送状态以本次git核验为准。

## 2026-10-12 — Lighter default palette

用户要求浅色系，默认改为雾灰/近白/柔和青绿/暖杏。同步调整首页浮动面板、航线、图表周边、对比标记与选中控件的可读性；保留深色切换。更新现有浏览器核验的主题预期并重新截图；验证结果见 cockpit-results.json。

## 2026-10-12 — Responsive landing, motion, brand

用户要求首页按屏幕适配、中间飞机动态化，并指定名字 Flight cheaker。已按原拼写更新页面标题、品牌与页脚；仓库名称不变。桌面画布填充剩余视口，短屏有可读性下限，平板/手机自然流式排布。飞机轻微浮动、航线流动及雷达扫描均有暂停和减少动态效果支持。

## 2026-10-12 — Bilingual UI and full-stack language specification

新增中文/EN全局切换与本地记忆，覆盖原型导航、字段、结果、状态、图表和辅助标签；保留当前筛选/报价，不触发请求。内页减少slogan，改为功能标题。前后端语言规范已索引到AGENTS：稳定错误码、locale优先级、金额/时间/ID不随语言变化。后端尚未实现，不以规格冒充真实双语API。

核验：locale-layout新增39项通过，原cockpit36项回归通过；零运行时错误。已检查桌面英文查询/详情与手机日期热力图截图。所有修改限制在授权项目；Git提交及推送以本次最终核对结果为准。

## 2026-10-12 — data architecture and free hosting review

Completed reviewable Supabase/Postgres data model, RLS/role boundaries, immutable history, budget/worker recovery, key checklist and personal free-hosting comparison. Reconciled canonical architecture and bilingual error envelope. Independent review found dispatch crash ambiguity; durable pre-I/O dispatching and uncertain recovery now specified. Supabase connector returned zero visible projects; no cloud mutation or provider call performed. Frontend remains the previously verified 75-check prototype, not a complete application. No application dependencies installed or deployment performed. Next gate: choose/authorize a dedicated Supabase project and locally configure the chosen provider trial key for a bounded spike.

## 2026-10-12 — authorized Apify probe and development goal handoff

User selected Apify and explicitly authorized using the supplied local credential. .env is Git-ignored and no credential value was emitted. Verified FREE account and Actor build0.0.2; nine small runs all ended SUCCEEDED with summed reported usageUSD0.04345 under reserved ceilingsUSD0.27 and total capUSD0.50. Returned economy/business search, calendar and full selected round-trip booking; checked baggage/filter correctness/time semantics/general flexible matrix remain unconfirmed. Exported nine redacted, explicitly sampled fixtures and input schema projection. Rechecked Supabase: zero visible projects, no database changes. Prepared updated stack fit and copyable development goal; no application dependencies, development goal or deployment started. Reconciled Signal/retention defaults and provider indices.

## 2026-10-12 — Vercel-language question and original harness restored

Clarified Java versus JavaScript/TypeScript. Verified official Node/Python runtime support, managed durable Workflow and default retries, Hobby daily Cron and personal-use/quotas. Prepared goal recommendation now uses Next.js/TypeScript full-stack and a bounded Workflow evaluation; Supabase/Apify remain external. No user stack acceptance, Workflow runtime validation or deployment claimed. Added explicit original role, independent review, structural AGENTS/ADR memory, exact repo/delete/system/cloud/budget boundaries, acceptance/test mapping, clean environment, progress/push and cumulative failure stop rules in harness-contract.md and the copyable goal.

Handoff verification: document links, nine sampled fixture envelopes/redaction, selected round-trip two-leg shape, valid empty bag-filter response, usage sum, Python probe syntax, blank example credentials and Git ignored local secrets checked. Offline tool rejects a run whose reserved cap would exceed the cumulativeUSD0.50 budget. Independent goal/harness review found the >5-round rule had been narrowed to failed repairs; corrected to count goal-wide implementation→verification→review rounds, including partial success, without phase resets. No other high/medium findings. Prepared development round counter has not started.

## 2026-10-12 — Actual application development authorized

Goal active. Selected Next.js/TypeScript full stack; bundled Node24.19.0 available. Repository root/main/origin verified clean before implementation. Development round count:0 (planning/setup underway). Supabase project/configuration requested; no cloud mutation. Conservative spike remaining reservation allowance USD0.23; no new live calls. Fixed stale acceptance A6 from ±10% to the documented ±5% signal threshold.


### Goal-wide round1 — implementation / verification / independent review

Completed round count:1 (partial success). Initial production UI/contracts/adapter implemented; 14 deterministic tests and initial build/typecheck passed. Independent code review found query-binding/freshness, outbound-leg rendezvous, currency, input/null and localization defects; fixes and further targeted verification moved into round2. No live provider dispatch. Supabase designated project fpxnoiwaytkplrfsymyp is confirmed; console-derived pooler and CA allowed CLI migration20261011175659, with matching local/remote history. Real fc_api/fc_worker RLS11/11 passed. Workflow5.2.0 same-major dependency overrides devalue5.9.4/nanoid5.1.16 remove all14 initial audit findings (audit0). Next config agentRules disabled to preserve project instructions. Round2 in progress: Workflow build passes, desktop E2E interaction timeout under investigation; mobile/API E2E pass; job/concurrency/budget tests pending. Sandbox browser/network failures are identified environment constraints, not unidentified test retry loops.


### Goal-wide round2 — completed partial verification
Completed count:2. Actual restricted-role RLS11/11, job integration3/3, deterministic17/17, TypeScript and Workflow production build passed. Production E2E3/3 passed in18.0s. Dev cold compilation caused initial timeout; testing the same assertions against production resolved it. No extra provider calls. Reviewer identified startup recovery, capacity/exhaustion/cancellation, upstream concurrency and budget evidence gaps. Migration secret moved into ignored .env.migration, outside Next runtime .env.

### Goal-wide round3 — completed partial verification and review
Completed count:3. CLI migration20261011183046 applied to designated Supabase project only. Lifecycle integration7/7 passed104.91s with60s per-test transport timeout; first run had2 timed-out tests at20s,5 passed. No assertion changed, no provider IO. Added private-cache meeting/flexible, job results and offer/history APIs, real four-window UI. Independent review found private results surviving account switching, canonical hash ordering, result currency, IO inside startup transaction, execution fencing, collection failures and cancelled-run reconciliation. These are moved into round4; not claimed fixed until targeted verification. Billing/free-account evidence, return/booking chain, scoped baggage, timezone semantics and live flexible matrix still pending. Budget remains nine original probes, reservedUSD0.27 / USD0.50; new live requests0.

### Goal-wide round4 — completed partial verification and review
Completed count:4. Deterministic/mock Workflow21/21; actual DB integration8/8 including persistent read cap passed114.61s. Latest application production build passed21steps/1workflow. Clean credential-free npm ci/audit0/build passed, then explicit Turbopack root added. E2E3 passed; new fourth assertion matched both app alert and Next announcer, located and scoped to main (no product assertion weakened). Independent review found finite/null lease validation, active reconciliation race, lost launch acknowledgement after cancellation, and hardcoded sample labels in private details. Round5 addresses these and adds targeted QA; no live provider calls, budget unchanged.

### Goal-wide round5 — completed partial verification and review
Completed count:5. Build/typecheck and deterministic21/21 passed; actual DB integration9/9 passed133.89s, including null-lease/active reconciliation/known launch after cancel. E2E4 passed; synthetic private-history test reached correct SIN→LHR/JPY/history/coverage, then exact getByLabel on a select timed out because label text includes options; accessible combobox name verified in snapshot, test now targets that role. Independent review found cancellation immediately before completion left known-finished provider metadata unresolved. Round6 is the final bounded repair/verification/review; if full Goal conditions remain unmet after it, >5-round user stop applies. No original budget reset, no live provider requests.

### Goal-wide round6 — incomplete Goal; automatic development stopped

Completed count:6, including independent bounded review. Final build/typecheck passed21steps/1workflow. Full DB integration10/10 passed143.56s using the earlier empty-candidate cancellation test. Strengthened nonempty-candidate target failed before lease acquisition because I accidentally ran two real DB suites concurrently: shared capacity occupied, temporary reservation30000 microUSD. Cause located; strengthened behavior remains unverified, no retry after stop. RLS11/11 and deterministic/mock21/21 previously passed. Browser4/5 then corrected fifth synthetic Auth/cache case passed separately; no final single5/5 or real Auth E2E claimed. Clean ci/audit0/build passed, isolated startup pending.

User's >5 cumulative rounds rule triggered: stop automatic implementation, preserve checkpoint and await user decision. Full return/booking, source semantics/baggage, live calendar, history writes, durable SDK execution/restart and full billing gates remain incomplete. Supabase is connected; no current missing Key prevents the remaining engineering. Read-only post-cleanup budget remains reservedUSD0.27/capUSD0.50,new calls0. Details and resumption constraints: [stop log](errors/2026-10-12-goal-round-limit.md). Live mode disabled; no deployment or new provider calls.
