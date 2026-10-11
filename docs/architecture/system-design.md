# System design v0.1

建议架构；应用尚未实现。目标是单用户本地可运行，同时不阻碍日后托管。

```mermaid
flowchart LR
  UI[Next.js Dashboard] --> API[FastAPI API]
  API --> DB[(SQLite jobs / offers / snapshots)]
  Worker[Single Python worker] --> DB
  Worker --> Adapter[Provider adapter]
  Adapter --> Source[Chosen HTTP API or Apify Actor]
  Worker --> Rules[Baggage / ranking / rendezvous / signal]
  Rules --> DB
  API --> UI
```

## Responsibility
- Frontend：输入与可访问状态、列表、详情、历史图、split view、flex grid；不持有外部 provider Key。
- API：输入校验、任务幂等、预算预留、查询/取消、读取标准化结果。
- Worker：从持久 jobs 表领取任务、限流调 provider、标准化、逐段判定、写快照、聚合结果。
- Adapter：能力表、search/calendar/resolve-return/booking/insights；不负责产品排序。
- Rules：纯业务逻辑、money/时区/费用范围处理、comparable key、确定性推荐。

不建议用 FastAPI in-process BackgroundTasks 作为唯一可靠长任务队列。初期 single worker + DB leases：每次 claim 原子事务；lease_expiry 后可重领；阶段结果落盘；取消在下次子请求前检查。重启从 checkpoint 恢复，不重复收费请求。任务表记录已 dispatched 的 request ledger，无法判断是否计费的超时记 uncertain，不盲目重发。

## Persistence
- searches：输入 JSON、fingerprint、provider、created_at、scope。
- jobs：status、phase、progress、budget、lease、cancel_requested、error_code。
- itineraries / segments：完整物理行程稳定标识、UTC/当地时区、operating/marketing carriers；不存报价专属舱位或行李。
- offers / offer_segments：snapshot ID、itinerary、provider/fare、旅客、逐段舱位及行李证据、minor-unit money、confidence、observed_at。不同报价不能覆盖同一物理航段的属性。
- observations：comparable key、day sample、费用完整性；历史查询不依赖临时 token。
- calendar_cells：date pair、coarse amount、verified offer、pending/failed/unsupported。
- provider_calls：redacted request fingerprint、cost units、status、attempt、checkpoint；不存秘密。
- provider_references：短期 token，服务端限制访问，日志隐藏；原始响应先脱敏再保存。

初期 cache 用 DB expiry 与 fingerprint，无 Redis。缓存 key 含完整输入、provider、schema_version、locale、币种、旅客和行李，避免跨条件串结果。历史快照记录真实 observed_at，缓存重复读取不创建伪新增观测。

## Execution flows
固定：validate → reserve quota → search candidates → complete roundtrip → baggage/booking enrichment → confirmed ranking → result. 只核验 10 个候选时结果声明核验范围，不能省略未知低价候选却称绝对 top ten。

会合：分别获取目标到达日可能的出发日候选 → filter local-arrival-day → complete offers → UTC gap constraints → pair recommendations。并发上限建议 provider=2，整个系统 shared budget；不要每个浏览器会话各自突破限流。

灵活：枚举两个区间 date-pair 笛卡尔积（不按跨时区本地日期直接比较）→ calendar batches ≤ provider cap → prioritize → detailed verify UTC顺序/目的地nights → partial results/coverage。provider若本身不支持跨日期变更线组合，标unsupported，不静默排除。取消已发出请求可能仍计费，UI 说明。

历史：detail 使用自己的 comparable snapshots；provider insight 独立 scope；calendar 是当前日期面，不将不同 scope 合并求均值。自动采样需要后续明确启用的监控任务，并先显示预估月查询量。

## Reliability and boundaries
Timeout 30 秒初始建议，job 180 秒可调整。HTTP 429 尊重 Retry-After；transient 5xx 最多 2 次受预算限制重试；401/403、参数错、schema 错不盲重试。未知收费结果不自动重试。日志 trace_id 不含 token/旅客姓名；本工具不收集购票身份资料。

本地 bind 127.0.0.1，单 origin。以后部署必须增加认证、授权、服务端配额、HTTPS 和受控 CORS；当前不把单用户无认证 API 对外发布。不需要 LLM、支付系统或航空出票 API。

## Structure (future code, not scaffolded)
```text
frontend/src/app/             routes
frontend/src/features/        search / details / rendezvous / flexible
backend/app/api/              transport
backend/app/domain/           money / baggage / ranking / history
backend/app/providers/        adapters
backend/app/jobs/             orchestration / worker
backend/app/storage/          repositories / migrations
backend/tests/                unit / integration / provider fixtures
docs/                         design, contracts, ADR, QA
```

Deployment choice deferred. Use health readiness that distinguishes app start from provider credentials/availability. Local SQLite files, .env and raw responses excluded from Git. Dependency compatibility verified in clean environments only during implementation.
