# Technology recommendation

状态：建议而非用户最终批准；未安装版本/依赖。日期 2026-10-11。

| Option | UI / split view | Connector/analysis | Complexity / cost | Conclusion |
|---|---|---|---|---|
| Next.js + FastAPI | 易构建精细 Dashboard、独立双侧状态、可访问组件 | Python 适合 adapter/分析；类型 API 边界明确 | 两套运行时、API契约与构建；本地软件费用 0，托管未选 | 推荐：符合 UX 优先及 Python 偏好 |
| Streamlit + Python service | 很快出数据工具；可用 columns；复杂状态/交互需配合 rerun 模型 | 单语言，快速分析 | 初期低，精细 UI 与取消/双侧状态控制后续较费功夫 | 快速个人 spike 的替代，不默认长期主 UI |
| Next.js full-stack | 单 TypeScript 运行时；UI 同样灵活 | TS adapter 可实现； Python 爬虫要另起进程/服务 | 比双栈少边界，但长任务托管有运行限制 | 若选纯 HTTP provider 且不要 Python，可减少维护 |

建议 stack：Next.js App Router + TypeScript + 可访问组件与 CSS tokens；FastAPI + Pydantic；数据库访问 SQLAlchemy/Alembic；初期 SQLite 单机单 worker；HTTP provider adapter。不选择 Redis/Celery、Supabase、Figma账号或特定部署平台作为必需项。

SQLite 适合当前个人工具低写并发，持久 job 表配单独 Python worker。以后多实例/多用户或并发写受限时迁 PostgreSQL；此前不需要 DB 云账户/Key。该选择是架构判断，不是性能实测结论。

隔离：backend/.venv，frontend 项目本地 node_modules；独立 lockfiles，固定受支持 runtime，实施时核对 Node/Python与库兼容矩阵再锁版本。不使用 global pip/npm；不复用其他 repo 的 env。当前不把机器现有 Python/Node 当已完成项目环境验证。

Testing recommendation：pytest 业务/adapter integration；Vitest/Testing Library 组件；Playwright 关键端到端。必须有 provider fixture 与 live smoke 明确区分。

主要成本来自 provider 查询，而不是选 Python 或 JS。不要用需要 LLM 的架构来实现可确定计算的排序、行李、会合与 signal。

Primary docs：[Next.js](https://nextjs.org/docs/app/getting-started/installation)、[FastAPI](https://fastapi.tiangolo.com/features/)、[Streamlit execution model](https://docs.streamlit.io/develop/concepts/architecture)。以上文档用于确认框架模型；方案优劣是本项目的设计判断。
