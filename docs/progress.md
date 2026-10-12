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

### User-authorized resumption — round7 in progress

2026-10-12 user explicitly replied “10轮吧”. Cumulative limit extended to10, completed count6 preserved. No budget reset, no change to credentials/security/provider/deployment boundaries. Start with serial nonempty-candidate cancellation verification, then production return/booking chain and private reference lifecycle. Prior stop log remains historical evidence, not current prohibition. Independent source-contract review assigned read-only; no additional live calls authorized beyond original remaining budget.

Round7 evidence so far: previously invalid nonempty cancellation regression now passed serially1/1 (9skipped),28.28s. Bounded source-compatible chain planner, worker-private expiring references, atomic stage pointer/coverage and single-token return/booking orchestration implemented. Deterministic/mock suite31/31 passed before the latest added DB checks. Full DB suite and production build are running; independent review pending. No new Actor requests. ADR0002 records one-branch coverage, unchanged .10per-job reservation and remaining source/billing gates.

### Goal-wide round7 — partial implementation, located failures and independent review

Completed count7. Deterministic/mock31/31 passed. Serial actual DB suite9passed/3failed: worker lacks DELETE privilege on provider_references; cleanup failure left synthetic never-dispatched records occupying capacity, producing the third failure and protective afterAll stop. Cause located; not three unidentified failures and no provider calls. Build initially failed sandbox junction permission; escalated build then failed Turbopack Workflow loader child startup (exit0 before connection), requiring supported bundler validation. Independent review found expiry deletion rollback and non-atomic terminal reference cleanup. Round8 corrects targeted worker privilege via CLI migration, committed expiry/atomic terminal cleanup and adds physical deletion assertions; retained synthetic QA records must be inspected and cleaned without altering live reservations. No budget reset, no live mode enablement.

### Goal-wide round8 — bounded chain and reference cleanup verified; full Goal pending

Completed count8. CLI migration20261012035000 applied only to designated project. Safely inspected and removed exactly2 never-dispatched synthetic rows and their dedicated QA owner; no lifetime ledger changed. Full serial DB suite12/12 passed179.13s, including nonempty cancelled completion, private chain replay/API denial, physical expiry deletion and cancelled-stage no-publication. Deterministic/mock31/31 passed. Webpack production build and TypeScript passed21steps/1workflow; switched dev/build scripts to supported Webpack after located Turbopack loader process failure. Latest complete browser suite5/5 passed37.4s; synthetic Auth/cache case remains distinct from real Auth critical-flow verification. Independent round8 review resolves prior P2 and finds no new P1/P2 in bounded changes; explicitly notes activity-driven physical retention, with expired references unreadable.

Clean isolated installer now verifies actual startup, health, page and public preview after ci/build. This run is still active; install476/audit0 passed, build/start result pending, not yet claimed. Full Goal remains incomplete: live source semantics/party fares/baggage, actual durable SDK restart, unattended retention, calendar verification, comparable history writes and billing/free-credit gates. Bounded single-branch return/booking production code exists and is fixture/mock/DB verified; no new live provider call or source acceptance claimed. Original count6 stop remains historical; current completed count8/extended10 limit, original budget preserved.

Round8 final evidence: enhanced isolated check completed successfully: fresh project-contained npm ci476/audit0, Webpack production build/typecheck, actual start on an allocated loopback port, health/live-disabled, branded HTML and public recorded preview all passed; no credentials copied, owned test server stopped. Latest main production server is local127.0.0.1:3000. Five CLI local/remote migrations match. Post-test read-only lifetime reservation270000 microUSD, calls_reserved0. Secret scan18 changed/new files found0 leaks; git diff check passed. Next bounded round: real Auth critical-flow and actual Workflow recovery/cost gates. Do not claim remaining source requirements or full Goal complete.

### Round9 in progress — actual Auth and Workflow runtime verification

Real Supabase password login and signed-token local HTTP integration3/3 passed39.07s: validation/live-disabled gate, forged token rejection, private result/history ownership, cross-owner404, meeting UTC gap and flexible verified coverage. Data are explicitly synthetic QA fares; this is real Auth/API proof, not source capability proof. Temporary accounts/history/cache cleaned, no email sent, tokens/passwords never logged; no provider calls or budget change. Installed Workflow source review found local world.start() is not invoked by Next integration, so restart recovery was missing. Added Node-only instrumentation startup; isolated actual SDK/production-orchestrator test with fixture-only provider I/O is being prepared. Do not claim recovery until that test passes.

### Goal-wide round9 — real Auth and local recovery; final build correction pending

Completed count9. Deterministic/mock33/33 passed. Actual production flightSearch in isolated clone with synthetic supplier IO persisted its search checkpoint, survived abrupt server restart, resumed the same run, and reached partial with exactly3 unique synthetic starts/3 succeeded calls/3 checkpoints, whole booking metadata, references purged and original lifetime reservation restored. Initial harness failed only its final serializer-wrapper assertion; installed SDK hydrates step input as {args:[jobId]}. Preserved run files were verified offline after correcting that verifier:6 steps, job ID or null returns, no private data. Initial failure retained, no DB/provider rerun; combined result explicitly qualifies this sequence in data/workflow-recovery-result.json. This proves local development recovery, not live source capability or distributed hosting.

FREE-account fail-closed guard added and independently reviewed with no new P1/P2; account observation and remaining billing gates documented in ADR0003. Main build located a broad TypeScript include scanning ignored QA clone files; exclude data, preserving src/tests checks. Corrected build pending. No new Actor request, no budget reset. Round10 starts real browser password-login/private quote/details/logout proof and final verification; full Goal remains pending source baggage/time/party-price and live matrix requirements.

### Goal-wide round10 — verified local critical flow; acceptance checkpoint

Completed count10, no automatic round11. Corrected main production build/typecheck passed21steps/1workflow; separate final tsc passed. Deterministic/mock33/33 passed2.38s. Latest complete real Auth/API/browser suite4/4 passed61.15s, temporary users cleaned and lifetime baseline asserted unchanged. Full browser5/5 passed34.6s. Source fare fixtures remain synthetic; real Auth does not establish live source acceptance. Browser failures were located fixture count and compound DOM text selectors, corrected with current-confirmed selection and all-nine-private-rows logout assertion. Independent reviewer verified the correction without weakening acceptance. Clean isolation with latest startup hook is running (ci476/audit0 passed); completion result pending. Final source and implementation blockers: docs/errors/2026-10-12-round10-acceptance-gates.md. Live off, new Actor calls0, original lifetimeUSD0.27 preserved. Goal incomplete.

Round10 final isolation evidence: fresh credential-free npm ci476/audit0, Webpack build/typecheck, actual local start, health/live-disabled, branded page and public recorded preview all passed with latest startup hook. No credentials copied. Owned isolation server stopped. Independent final report review identified and corrected only historical/current evidence labels and separation of lifecycle12/12 from RLS11/11. All provider/data acceptance gaps retained. Commit/push verification follows; no further implementation round starts automatically.

Round10 delivery:18 changed/new files scanned against local token/DB credentials,0 leaks; diff check passed. Post-QA read-only lifetime ledger270000microUSD, calls_reserved0. Application commit53efd1f0070fc7fec051debc1f7c6c6099273e9c pushed to sole authorized origin/main and ls-remote matches local HEAD; working tree clean at verification. Initial commit lacked configured author; reused the existing repository commit identity with per-command git -c only, without global/system configuration changes. This subsequent progress-only commit records that verified delivery. Local latest production server127.0.0.1:3000 remains available. Cumulative count10 retained; no full Goal completion, no round11, no live enablement or deployment.

## User-requested continuation preparation — 2026-10-12

User accepts supplier route/search price history for the first-release reference chart, then explicitly requests continuation prioritizing live meeting/flexible batch execution, real comparable quote recording and full cost reconciliation. Spec and AGENTS index updated; plan docs/plans/2026-10-12-live-batch-continuation.md. Completed count10 and lifetime270000/500000microUSD retained. Round-cap extension question pending; no new application implementation round, DB mutation or provider request started.

Independent read-only spec review found and resolved: default common-arrival-day target−2…target coverage costs six branchesUSD0.36 beyond remainingUSD0.23; one-cheapest-branch selection cannot supply useful alternatives; parent holds must atomically transfer to child calls without double debit; self/future observations must be excluded from baseline; meeting/flexible ordering must match product spec. Final targeted plan review no remaining P1/P2 at planning stage, not application verification. Independent billing research confirms delayed terminal reread and external dataset/storage costs are distinct from Actor event ceiling; exact invoice costs remain pending. Aggregate logical-query ceiling decision explicitly pending, no silent child-job bypass. Prior round10 checkpoint remains historical; no budget reset or live enablement.

## Explicit user counter reset — cycle2026-10-12-live-batch-02

2026-10-12 human instruction authorizes resumption with new cycle counter0/5. Historical10 completed rounds, reviewed checkpoints and failures remain; only active round count resets. Original lifetimeUSD0.50 cap/USD0.27 reservation, validation40-child-request cap, monthlyUSD4, credentials, scope and no-deployment boundaries unchanged. Earlier pending15/20 question is superseded. Priorities: live meeting/flexible queries; comparable quote recording and full cost reconciliation. At five completed implementation→verification→independent-review cycles without full success, stop and log remaining items; no automatic sixth cycle/reset.
