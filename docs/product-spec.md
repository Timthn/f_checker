# F Checker — Product Spec v0.1

Latest user amendment (2026-10-12): this is a personal-use flight dashboard. Prioritize the four core tasks and straightforward interaction; no team permissions, shared workspaces, memberships or complex accounting UI. Existing authentication remains minimal private-data protection. Query cost details are collapsed by default; necessary secret/budget/replay safeguards remain server-side. Unknown source rights remain labeled honestly. This amendment does not authorize booking, deployment, subscriptions or larger budgets.

Batch results keep a collapsed source-candidate list even when verified recommendations are empty. Each admitted query displays at most ten compatible unique itineraries in source order, with visible shown/compatible counts and observation freshness. Unknown fares are never combined or ranked as confirmed cheapest; missing baggage, party scope, arrival matching and stay-length evidence retain their original gates. Source candidates complement, rather than satisfy, the four-feature confirmed-recommendation acceptance.

2026-10-12 reconciliation: user selected Apify, bounded live probe is documented in docs/connectors/apify-live-spike-2026-10-12.md. The original no-call preflight boundary below was superseded only for that authorized spike; application implementation/deployment has not started. Updated stack and migration conventions: docs/architecture/apify-stack-fit.md.

日期：2026-10-11（Asia/Hong_Kong）。状态：可评审草案；开发前阶段，不代表用户已批准所有默认值。

## 1. 目标与范围

为个人旅行提供机票比较 Dashboard：按条件寻找前十个低价方案、查看价格依据、帮助两个不同出发地的朋友会合，以及寻找灵活往返日期组合。经济舱优先，支持商务舱。只搜索与跳转预订，不购票、出票、收款。数据库、部署平台和 provider 未最终确定。

本阶段产出规格、设计和选型建议；不构建生产应用，不调用收费接口，不部署。用户已确认唯一仓库 https://github.com/Timthn/f_checker；本地工作目录采用 C:/Users/Tim Ngan/Desktop/projects/f_checker（agent 建议，已告知用户）。Git 操作仅限该目录和该 remote。

## 2. 已确认需求与建议默认值

已确认：四个核心功能、Dashboard、美观与易用性、独立规格评审、项目级 AGENTS.md 索引、固定仓库边界、停止与错误记录。

建议默认值（可调整，未视为用户确认）：简体中文 UI；HKD 为报价请求币种；每个出发方一名成人；所有机场时间显示当地时间及 UTC offset；结果默认低价排序；会合默认同一到达机场、到达差不超过 120 分钟；未知行李报价独立分组；灵活日期默认每个区间不超过 7 天，停留 1–30 天；展示五个日期组合。

已追加确认：唯一仓库 Timthn/f_checker；历史观测和旅行日期价格两种视角都要，分别展示。待确认：常用航线；月度预算；是否接受自转机与异地机场。上述待确认项不阻止文档交付，不授权生产开发。

## 3. 输入模型

共用输入：机场/城市选择（保存 airport IDs，城市展开后的机场列表可见）、单程/往返、日期、人数、舱位（Economy / Business）、币种、最大转机次数、是否允许自转机。

行李不是一个含糊布尔值：个人物品、手提件数、托运件数；重量可选。快捷选项：仅个人物品、1 件手提、1 件手提 + 1 件托运、自定义。快捷选项不暗示所有航空公司重量一致。不指定重量时显示 provider 的额度，未知重量不能被标成满足指定 kg。

每个日期由出发机场当地日历解释；返回日期按返回出发机场当地日历解释。不能直接比较两个不同时区的当地日期来判定行程合法性。目的地不允许与出发机场完全相同。往返允许同日返回，但需 UTC 返回起飞晚于去程到达；默认停留规则只用于灵活日期。禁止各机场当地过去的旅行日期。

## 4. F1 固定日期搜索

用户填写条件 → 查询 → 显示进度 → 前十个可比低价行程 → View details。

排序规则：仅把行李条件已确认且完整行程已解析的报价纳入主要排行榜；按 requested_total、总飞行/转机时长、转机次数、稳定行程标识排序。相同行程优先显示满足条件的最低价方案，其他 fare families 在详情中比较。不足十个展示实际数量。默认抓取候选池建议 50 条或 provider 返回上限，返回覆盖范围；“最低价”指所获取候选内，不宣称全市场最低。

每张卡片：完整往返/单程摘要，航空公司、航班号、机场、当地日期与起降时间、时长、转机、自转机、舱位、票价方案、每方人数、行李额度、费用明细、报价币种与时间、来源、有效预订入口（若来源提供）。往返必须显示回程；只含去程的往返估计价不能冒充完整往返。

费用规则：requested_total = 满足本次人数与行李需求的供应商报价。若供应商已包含行李，不再次相加。只有附加费币种、单程/往返、每人/每件/每段范围已明确，才能加入基础价。未知税费或强制费用使价格标记为 estimated；只有费用口径已确认的价格标为 confirmed。无托运需求仍允许含免费托运的票价，避免错误排除更便宜方案。

unknown 单独展示“行李/费用待确认”，可跳转确认，但不混入 confirmed 排行。不得把 null 当 false/0。不同币种优先要求 provider 同币种重查；没有真实 FX 来源时不自动换算，不混排。

跨航段判定：默认所有航段均满足选择的舱位及行李需求。Business 查询遇到混合经济/商务舱、任一航段额度不足或未知时不进入主要排行榜。混合舱位必须由用户显式允许，详情逐段显示。去回程行李可能不同，需逐段/逐程证据，不用去程额度推断回程。

## 5. F2 详情、历史与 Signal

2026-10-12 用户确认：首版接受供应商 `price_insights.price_history` 作为“航线价格历史 / Route price history”，与当前旅行日期价格分开展示。Provider low/typical/high 可作为注明来源和范围的参考 Signal；下文七天同条件门槛仅适用于自行计算的具体可比行程 Signal。API 历史缺失时显示不足，不补造。用户随后要求继续开发真实可比报价的持续记录和完整费用核对；两种历史来源保持独立。此确认优先于较早把自建同航班历史作为首版参考图前提的表述，不改变行李、时间、票价、预算和权限要求。实施计划：docs/plans/2026-10-12-live-batch-continuation.md。

详情按 itinerary_id 打开，用户可选择具体 offer。显示航段、fare families、行李和费用原文、来源、采集时间。

两种独立图表：
- 历史报价：同一行程和可比票价条件在不同 observed_at 的快照。默认最近 30 天。不存在的过去样本不补造。provider 返回的 route/search-level price_history 独立标成“路线搜索价格参考”，不得归入具体航班历史。
- 日期价格：当前观测时，所选出发日 ±30 天的报价；往返默认固定停留长度，返回日期随之移动，明确标注。过去日期排除。缺失格点保持缺失，不填零，不声称来自过去报价观测。

历史统计先将同一UTC观测日的可比报价折叠为该日中位数，算术平均值和中位数以此样本为基础；窗口只含当前观测之前的数据。详情显示平均价、当前价、覆盖日期、样本数和偏差。

Signal 建议算法：有 ≥7 个不同观测日、跨度 ≥7 天的同条件历史时，以之前 30 天日样本中位数 M 为基准，d=(当前价−M)/M。d≤−5% 为偏低，d≥5% 为偏高，否则正常。阈值可配置；M≤0、过期或不可比则 insufficient。平均价用于展示，中位数用于稳健判断，并解释差异。

provider 的 low/typical/high 只作为来源给出的路线参考，不能代替我们针对具体航班、舱位、行李的 signal。日期价格均值不直接用于判定“现在该不该买”。不预测未来，不承诺最低价或最佳购买时机。

可比历史键包含排序后的完整航段序列及旅行时间、逐段舱位、人数类型/数量、币种、行李要求、费用完整性、票价方案/改签退款权益、provider。权益无法识别的样本不跨方案合并；跨 provider 默认不合并。临时 token 不进入历史键。当前 quote 超过缓存 TTL 标 stale，不生成购买 Signal；最近有效报价超过24小时，或当前报价已过期，则标数据不足；历史比较须符合 data-design.md 的30天窗口与可比条件。

日期价格默认标成“同航线、同舱位、同行李条件的每日最低候选”，不是此具体航班的历史。若支持匹配同航班另设系列标签，不能静默切换。往返固定长度的日期网格仅用于探索，最终停留以完整 itinerary 核验。

## 6. F3 双出发地会合

A/B 分别有出发地、舱位、人数、行李需求和往返返回日期，共同目的地与目标到达日期。分别展示结果，锁定 A 或 B 后重新推荐另一侧；一键重置。

日期定义：目标会合日按目的地当地日历。为了覆盖跨日航程，查询各出发地的候选出发日（默认目标日−2 至目标日；provider 有 arrival-date filter 时优先使用）。按实际到达当地日筛选；长途跨越窗口标 partial coverage，用户可扩大窗口，不保证覆盖全部到达方案。

只比较同币种、同一会合日、符合各自行李要求、完整行程的报价。默认同一到达机场，允许不同机场必须由用户开启，并提示机场间转移未计价；不伪造地面转移时间。

推荐算法：从每侧已获取候选池建立组合；UTC 到达差 ≤ 用户阈值。先显示在 combined_total 和 arrival_gap_minutes 两个维度的 Pareto 前沿，再以总价、时间差、双方最长行程时长作为确定性排序，前五对。结果包括 A/B 总价、合计、各自到达时间、差值、推荐理由。双人“平衡”首先解释为总价与会合时间的取舍，不能用两地绝对票价接近来惩罚自然较贵的航线。

Alternatives 提供至少两种存在时的取舍：更便宜但需更久等待、更同步但稍贵。没有满足阈值的组合时明确空状态，再展示按时间差最小的放宽条件备选，用户主动选择；不静默改变条件。返回日期可以不同，不强求回程同步。

## 7. F4 灵活往返日期

输入出发区间、返回区间、停留天数范围、行李、舱位、转机条件。日期范围含端点；先枚举两个区间的笛卡尔积，不通过跨时区的当地日期直接比较排除可行组合。最终有效组合按目的地 nights 和 UTC 时间核验；可以确定不排除可行解的预筛才允许使用。

先获取带相同筛选条件的 calendar 粗报价，再解析最佳日期的完整行程与行李。日历不具备同等行李过滤时不把其低价当成最终总价。

“已验证最低价”仅用于全部合法日期组合完成同口径查询且覆盖足够候选的范围内；否则称“已验证候选中最便宜”，并展示 verified/total cells、失败/未查 cells 和 provider 范围。两阶段仅核验前几个日期时不得宣称整个范围最佳。按 requested_total、停留天数、行程时长排序；同价并列规则透明。

对外统一称“已查询日期范围内、供应商返回候选中的最低已验证价”；日期覆盖和供应商候选覆盖分别报告。停留天数定义为目的地当地到达日到回程起飞日的日历差（nights）；日期区间枚举只是预筛。最终必须 UTC 回程起飞 > 去程到达。跨日期变更线、同日返回及跨日到达均需完整时间核验。

允许取消，保留部分结果。估计请求数超出单任务预算则给出缩小范围/仅探索候选选择，不偷偷执行大量请求。

## 8. 状态、预算与非功能要求

job 状态 queued/running/partial/succeeded/failed/cancelled；UI 区分 loading、无结果、unsupported、missing_credentials、provider_error、rate_limited、quota_exceeded 和历史 insufficient。

建议查询缓存 TTL 15 分钟、详情 10 分钟；缓存命中显示实际 observed_at。刷新为明确动作。保留细节90天、紧凑观测180天、日聚合365天、可选脱敏诊断7天；保存被保留历史引用的轻量headers，避免FK/cascade丢失历史。具体规则以 data-design.md 为准，供应商条款待核对；不允许时缩短/停存。

建议交互目标：点击后 1 秒内进度反馈；异步任务不承诺 provider 真实完成时间；单请求超时 30 秒、整任务 180 秒初始配置，长任务允许延长但受预算约束。限流按 provider plan 与本地全局并发控制。自动历史监控默认关闭，用户显式开启才新增计划请求。

所有秘密仅后端；日志去除 Authorization、query token、booking payload 和可重放 token。数据源错误不作为空结果。移动端 Split Screen 改 A/B 标签切换，保留共同条件与推荐对；关键状态不只靠颜色。图表可访问数据表，键盘导航与屏幕阅读器标签。

## 9. 验收映射

| ID | 可验证验收 |
|---|---|
| A1 | 单程/往返、经济/商务输入有效；返回日期错误有解释；机场城市展开可见 |
| A2 | 固定日期结果去重且最多十条、按 confirmed 含所需行李总价排序；少于十条不造数 |
| A3 | null 行李/附加费进未知组；provider 已含费用不会双算；多币种不混排 |
| A4 | 往返每个主榜结果显示真实去回程；只有 outbound estimate 的结果独立标注 |
| A5 | 详情区分具体行程历史、provider 路线参考、日期价格；缺失不填零；均值/中位数可复算 |
| A6 | Signal 7 日/7 样本、±5% 边界、M=0、可比条件变化与稀疏数据通过单元测试 |
| A7 | 会合按目的地日历与 UTC 时间差判断；跨日和时区测试；无合格组合不改条件 |
| A8 | 会合提供双侧信息、合计、差值、Pareto 推荐与 alternatives；候选覆盖说明可见 |
| A9 | 灵活范围含端点、返回日期合法、停留限制、分批/取消/partial coverage 和总价核验正确 |
| A10 | credential missing、unsupported、rate limit、timeout、empty 不互相混淆 |
| A11 | 桌面/窄屏、键盘操作、图表表格替代和 loading/empty/error/partial/unknown 原型可审阅 |
| A12 | 后续实施 unit、integration、关键 E2E 通过，干净独立环境运行，并在唯一仓库 push（本阶段不执行） |
| A13 | 多段混合舱位、去回程不同行李及未知段额度不进入 confirmed 主榜 |
| A14 | 人数/币种/行李/fare 权益/provider 变化隔离历史；临时 token 变化不改变行程永久身份 |
| A15 | 灵活日期以目的地 nights 及 UTC 时间核验，跨日期变更线与同日返回有测试 |

## 10. 文档阶段完成标准

规格、独立评审和修订记录、primary-source 数据源评估、技术方案比较、UIUX 设计与可审阅原型、系统与前后端规格、内部数据契约、凭证/预算表、AGENTS.md 模板及 progress book 齐全。所有实际请求未做的能力显式待验证。无需应用测试、Git push 或部署作为本阶段成功条件。

## Direct user amendment — no booking connector in the application

2026-10-12 user explicitly states that the booking API is not needed. Production query scope is amended to flight discovery and analysis: one-way search only; round-trip search followed by return lookup. Do not invoke the provider booking endpoint or build ticket purchase/issuance flows. Existing booking samples/observations remain historical evidence; removing the live endpoint is not permission to fabricate party-inclusive fare, baggage or fare-family proof. Keep unverified returned amounts clearly marked; complete selected journey reconstruction is separate from price/rights confirmation.

Update chain contracts, operation keys/admission reservation math, workflows, tests, UI coverage and documentation together. Preserve existing reservations and never refund actual ambiguous/dispatched calls based on this scope change. The currently running pre-amendment SDK QA clone uses synthetic supplier IO only; its recovery result, if obtained, is historical orchestration evidence and must not substitute for the amended search/return workflow acceptance. Complete its scoped cleanup before starting another DB mutation suite.
