# Flight cheaker — copyable development goal

2026-10-12. Prepared for user invocation; this file does not start development or authorize deployment on its own.

```text
/goal
为 Flight cheaker 开始实际开发，完成本地可运行、前后端连接的中英文机票辅助 Dashboard。

唯一项目目录：C:\Users\Tim Ngan\Desktop\projects\f_checker
唯一允许 commit/push 的仓库：https://github.com/Timthn/f_checker
遵循项目 AGENTS.md；按我的直接指引工作，不用 Superpowers 工作流。

本Goal授权由开发前阶段进入实际应用开发；更新项目AGENTS.md的当前阶段，不覆盖其他项目的agent/claude指令。角色同时涵盖产品/UIUX、solution architect、full-stack developer与软件QA。

读取 docs/harness-contract.md、docs/architecture/vercel-fullstack-option.md、docs/product-spec.md、docs/design/cockpit-direction.md、docs/architecture/apify-stack-fit.md、docs/architecture/data-design.md、docs/architecture/localization-spec.md，以及 docs/connectors/apify-live-spike-2026-10-12.md。已有设计原型 docs/design/prototype.html 是视觉与交互基准；当前不存在完整生产前后端。

技术方案（本次Goal选用）：Next.js App Router + TypeScript全栈，Node runtime Route Handlers为后端；ECharts、语义双语catalog、TanStack Query、Zod共享合同；Supabase PostgreSQL/Auth、node-postgres受限SQL角色、Supabase CLI唯一migration history。普通数据IO用服务端fetch/Apify REST；长任务先本地评估Workflow SDK并做持久步骤、Postgres lease/checkpoint/预算ledger。无需FastAPI/常驻Python worker/Java后端；现有Python probe仅验证工具。先核对Node24与实际依赖兼容性，再项目内安装锁版本，不使用全局pip/npm或改电脑系统。若Vercel Workflow兼容性/额度不适合，报告证据与本地executor或独立worker替代，不自动部署/付费。较早Python stack说明由vercel-fullstack-option替代，数据模型与产品验收保留。

数据源优先使用 scrapercompany/google-flights-scraper，初始固定已验证 Actor build0.0.2。APIFY_API_TOKEN 从项目本地 .env 读取，不打印、不放前端、不提交。不要订阅 SearchApi 或自动切到其他收费服务。

产品保留四功能：
1. 固定日期：显示获得的候选中最多10个符合舱位、人数、行李要求的低价完整行程，显示覆盖和来源。
2. 详情：分开展示同一可比行程的真实历史观测、出发日前后30天的当前日期价格；平均价、趋势和带解释的 Signal。历史不足显示不足，不虚构样本。
3. 会合：两侧不同出发地、共同目的地/到达日，按真实 UTC 到达差与总价推荐并列备选，支持锁定一侧。
4. 灵活往返：两个日期区间、停留天数、行李筛选，显示已查/已验证覆盖和最低已验证组合。

保留 Flight cheaker 的原始拼写、浅色飞机驾驶舱主题、自适应首页、可暂停飞机动效、三模块入口、主图8列跨两行与4列次模块、详情三层通栏约48px间距。中英文覆盖表单、错误、图表、ARIA和动态状态；内页少 slogan。键盘/触屏/reduced-motion 可用，手机不挤压双屏。切语言、悬停、图表操作不能触发付费查询。

必须按真实数据限制实现：
- search/return/booking/calendar 分别建模；初始往返报价只有去程，完成 return 和 booking 链后才标完整往返。价格不盲目相加。
- 供应商时间没有偏移；验证源时间语义、机场IANA时区及DST后才转换 UTC，未知不能参与已确认会合。
- 行李请求值不是返回权益；null/空数组不能当免费，矛盾数据标未知。件数和重量必须有对应航段/旅客证据，不降低原始验收要求。
- 日历不等于已验证双日期矩阵；日期粗价须完整报价核验，清楚显示覆盖。
- Provider route history 不冒充具体航班历史。当前报价、历史采样、旅行日期价格分别存储与展示。
- Token/booking payload仅服务端短期保存。内部 search_id、itinerary_id、offer_id、comparison_key 按已定合同生成。

依次实施，每阶段更新 docs/progress.md 和 AGENTS.md 文件索引：
A. 核对仓库、现有文件和权限；建立计划、隔离依赖和可运行命令。将已通过设计验证的原型迁为生产组件，先完成纯逻辑和 fixture 驱动部分。
B. 实现类型合同、币种/行李/时间/历史/会合/灵活日期规则；以脱敏 live-derived fixtures 测试适配器，区分样本成功与真实能力通过。
C. 实现 Next.js服务端API和持久Workflow步骤，包括 Apify 异步 run 启动/轮询/dataset解析、持久 checkpoint、取消和费用核对。发送前 durable dispatching 并核对 lease/取消/预算；run创建步骤禁用SDK默认重试，仍用数据库ledger挡住重放/重复delivery；workflow参数/返回/日志只传安全job ID，不能保存Token或booking payload。不确定收费请求不自动重发。客户端超时只恢复原 job，不新建付费 run。
D. 使用我指定的唯一 Supabase 开发项目建立迁移、Auth、受限API/worker SQL角色和RLS；认证从首版开始。需要 project ref/URL/publishable key/连接信息时说明具体缺项及本地配置方式，继续无凭证部分，不猜测或修改其他项目。
E. 前后端联调，维护验收ID→实现→测试映射，覆盖 loading、empty、partial、unknown、unsupported、stale、error、quota、服务唤醒和历史不足状态。使用独立sub-agent评审新增/变更的spec、架构或代码；已完成的独立product review不重复从零做。修复后验证，区分fixture通过、live观察与验收确认。

预算与边界：
真实调用串行或全局并发最多2，不后台自动采样。既有本地 spike ledger 的 USD0.50 总上限是累计预算，不从本 Goal 重置；新增真实能力验证最多40个子请求，并受剩余累计预算和账户免费额度约束。每次 run 设置 maxTotalChargeUsd；任何扩大预算须先说明具体金额和理由。月度 app 费用上限建议USD4并计入 start/read/storage等成本；计划超预算则停止该查询，不订阅、不自动续费、不买代理或域名。
免费部署只保留兼容配置和文档，本 Goal 不部署。目标是前端/API/任务编排同一个Vercel项目，数据库/Auth仍Supabase，爬虫仍Apify；无需默认Render。Vercel Hobby限个人非商业和额度；普通Function有时限，不能后台fire-and-forget。Workflow也有资源额度、Functions/Queues消耗和完成日志留存限制。Hobby Cron仅每天一次且不准点，不用作频繁轮询。自动采样仍关闭，不能承诺无限免费或全天采样。
材料决策写回AGENTS.md并索引config、开发语言/runtime、product spec、frontend/backend spec、架构、connector、命名、已验证命令与测试。保存ADR及progress book；中断后从这些文件/checkpoint恢复，不重做完成工作或清零调用预算。
仅在项目目录修改/删除文件，删除前验证绝对路径仍在项目内；不触碰其他仓库或数据库，不购票、出票、收款。允许GitHub、Chrome dev tools、浏览器快照/截图和项目内设计工具，Figma如可用且必要。没有凭证时先完成不依赖它的工作；必须真实验证的事项明确待验证。

完成条件：本地关键四功能端到端可审阅；生产组件中英文完整；适用单元、集成、E2E测试通过；干净隔离环境安装/启动通过；关键RLS、预算、取消、重启恢复与脱敏通过；文档和进度更新；敏感信息排除后 commit/push 并核对远端。已有原型75项检查不替代应用测试。功能因行李或数据源限制未满足时，不宣称完整成功。

停止规则：同一测试连续失败3次仍无法定位，或本Goal累计超过5轮“实现→验证→独立评审”仍未达到成功条件（每轮包含部分成功也计数，记录在progress，不按阶段清零），停止自动开发，写 docs/errors/YYYY-MM-DD-topic.md，记录命令、脱敏错误、原因、已尝试方案与剩余缺项；失败停止后由用户决定下一步，不通过改阶段/改名清零。关键凭证缺失或供应商能力不足时报告具体阻塞，不伪造通过、不通过重命名重试清零。
```
