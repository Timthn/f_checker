# Architecture review — 2026-10-12

Scope: review of design documents and the runnable UI prototype. No backend, schema migration, live flight call or deployment was executed. Recommendation is ready for the user to adopt in the next development goal; provider selection remains conditional on a real capability spike.

## Recommended architecture

Next.js + TypeScript + ECharts, FastAPI/Pydantic + HTTP provider adapter, separate Python worker, Supabase PostgreSQL + Auth. Prefer a small persistent API/worker deployment when hosting is selected; local development is sufficient initially. Supabase is the database/auth layer, not the flight provider or the Python process host. No Redis/Celery, vector database, LLM, billing subsystem or Realtime subscription required in the first implementation.

Poll persisted job status with backoff (e.g.1s→5s while active); use the response version/ETag to avoid needless transfers. Progress counts represent real checkpoints. Add SSE/Realtime only if polling becomes a measured constraint.

## Findings resolved in the design

| Finding | Consequence | Resolution |
|---|---|---|
| Previous SQLite-first proposal despite now-authorized Supabase | Two storage implementations and later auth/concurrency migration | PostgreSQL first; local tests use real disposable Postgres/Supabase, not SQLite as a behavioral substitute |
| Backend v0.1 error shape conflicted with bilingual contract | English-only or inconsistent error handling | Stable error code + safe params + resolved locale; display messages come from catalogs |
| Earlier cache fingerprint included UI locale | Language change could duplicate billable search/history | Exclude display locale; explicitly retain supplier market/language if it affects results |
| Secret API key confused with SQL password | Overprivileged runtime or unusable connection | Publishable key for Auth; separate restricted DB URLs for API/worker; migration URL only for setup |
| “Recovery does not repeat paid calls” sounded absolute | Timeout/crash could still incur duplicate charges | Ledger states, lease fencing and uncertain billing; no exact-once claim for upstream requests |
| No initial history collection boundary | Risk of displaying calendar prices as past quotes | Separate scoped observations; blank history until real sampling; daily weighting and freshness gates |
| API owns user data but authorization boundary was deferred | User could guess another search/job UUID after hosting | Auth verification + ownership/RLS included in first full-stack design |
| Two possible migration owners (Alembic/Supabase) | Schema histories drift | One Supabase CLI SQL migration history; SQLAlchemy only models/repositories; CLI creates migration filenames when implementation begins |
| Static prototype could be mistaken for completed frontend | Unverified framework/build/accessibility assumptions | Port visuals into typed components, semantic i18n catalogs and actual API states during development |

## Connection and runtime decisions

Persistent FastAPI/worker: small SQLAlchemy pools; direct Postgres when IPv6 reachable, otherwise shared session pooler on5432. Copy host/user/port from Project Connect, never infer them from a region name. Start API pool2 and worker pool2, max_overflow0; size against measured plan connections. TLS with provider CA verification where available. Migrations use an appropriate direct/session administrative endpoint. Transaction pooler is reserved for future serverless deployment and requires driver/prepared-statement compatibility work.

Proposed runtime baseline: Node24 and Python3.12, versions/dependency pins confirmed in a clean project environment at implementation. Supabase has dropped Node20 support; do not reuse old minimum-version advice. No global dependency changes. One frontend lockfile, one backend lockfile, project-local environments.

The current Supabase changelog also changes default Data API grants. This design does not rely on automatic table exposure; browser flight data access remains through FastAPI. Any later exposed table must opt in with both grants and RLS. [API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [Node20 deprecation](https://supabase.com/changelog/45715-deprecation-notice-dropping-support-for-node-js-20).

## Alternatives and tradeoffs

| Option | Strength | Cost/limitation | Recommendation |
|---|---|---|---|
| Next.js + FastAPI + Supabase | Polished UI, Python connectors, explicit worker boundary, managed auth/data | Two runtimes plus3 processes (UI/API/worker) | Preferred for current brief |
| Next.js full stack + Supabase + TS worker | One language, less API type duplication | Python scrapers need another service; still needs durable long-running work | Good simplification if all connectors remain HTTP and Python is unnecessary |
| Streamlit + Python + Postgres | Fast data experiments | Reproducing current precise interaction/layout is more costly | Connector spike only, not primary UI |
| Supabase Edge Functions for everything | Managed small functions | Python tooling mismatch; durable multi-request orchestration still needed | Do not select as primary flight worker |

## Remaining gates

1. User selects/creates the dedicated Supabase development project or grants connector visibility. MCP currently returned `projects: []`; this says nothing about unrelated accounts/projects.
2. One provider key, preferably SearchApi for the initial bounded spike. Detailed weights, per-direction baggage and full fare totals remain pending runtime proof. Calendar coarse results do not pass that proof.
3. Exact dependencies, DB roles/policies, migration reset, two-user isolation and restore need implementation tests; prototype tests certify none of them.
4. Hosting, SMTP and automatic monitoring remain deferred. No extra provider, paid upgrade or automatic spending fallback.

Detailed model: [data-design](../architecture/data-design.md). Keys/start checklist: [development-readiness](../development-readiness.md).

## Independent review closure and free profile

Independent sub-agent review identified a medium-risk crash window between network dispatch and ledger persistence. The design now requires durable dispatching before I/O, lease/cancel/reservation checks, uncertain-state recovery without automatic resend and boundary crash tests. Retention additionally preserves FK-referenced lightweight offer/call/job headers while longer-lived history depends on them. These are design corrections, not executed application tests.

The separate persistent worker is the normal target. For free personal demos only, one supervised worker shares the Render web process lifecycle; durable recovery survives restart but progress pauses with service sleep. Continuous monitoring remains disabled. See [free-deployment.md](../architecture/free-deployment.md).
