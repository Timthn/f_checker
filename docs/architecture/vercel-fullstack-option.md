# Vercel-oriented full-stack recommendation

2026-10-12. User asked whether one language can host frontend/backend on Vercel. This updates the recommendation for free-first, low-frequency usage; no final stack acceptance or deployment is inferred from the question. The copyable goal proposes this option for user invocation. The earlier Python/FastAPI recommendation remains an alternative, not a required stack.

## Language and hosting

Java and JavaScript are different languages. The recommended route is **TypeScript on Node.js**, using Next.js for both frontend and server API routes in one Vercel project. Do not introduce a Java/Spring application for this purpose. Vercel also officially supports Python/FastAPI functions, so Python is not the reason two hosts were previously suggested: a conventional always-running worker was the reason. Neither ordinary Node nor Python Functions is a permanent worker process. [Official runtimes](https://vercel.com/docs/functions/runtimes).

Supabase still hosts PostgreSQL/Auth and Apify still executes scraping. “One Vercel app” means frontend/API/orchestration together, not moving those external data services into Vercel or making all supplier usage unlimited/free.

## Proposed stack

| Part | Recommendation |
|---|---|
| UI and API | Next.js App Router, TypeScript, Node runtime Route Handlers at /api/v1; shared Zod contracts |
| Charts and language | ECharts, semantic zh-Hans/en catalogs with compatible next-intl, existing CSS theme; TanStack Query for status/cache |
| Provider adapter | Server-only TypeScript fetch/Apify REST, distinct mode parsers and Decimal-based money conversion |
| Database/Auth | Supabase PostgreSQL/Auth; node-postgres with restricted SQL roles and explicit transaction-local verified owner context; Supabase CLI migrations |
| Durable orchestration | Evaluate Workflow SDK locally for multi-step run/poll/return/booking pipelines; verify account availability/quotas before deployment |
| QA | Vitest for domain/API/adapter integration, PostgreSQL/RLS integration and Playwright E2E; real calls opt-in and capped |

Avoid a separate FastAPI server and Python worker in this option. The existing Python probe remains a preflight tool, not an application runtime dependency. Do not add NestJS, Express, Prisma migrations, Redis, Celery or an LLM solely to process the Actor's JSON. Zod validates boundary data; JSON source shape itself does not require a particular language.

Recommended future code map: src/app for pages/API routes, src/features for search/details/meet/flex, src/server/providers/apify for server-only IO, src/domain for pure rules, src/server/storage for scoped SQL, src/workflows for orchestration, src/i18n for catalogs, supabase/migrations for sole migration history, tests for acceptance. Record actual commands/versions only when installed and verified.

## Long tasks and retry safety

Ordinary functions have a bounded execution duration; waiting for an entire flex search inside one request or continuing an unawaited task after returning is unreliable. Vercel Workflows provides managed durable pause/resume, but each execution step still uses Functions and consumes platform resources. Keep start-run, status-read, dataset-read, normalization and each next selected request as bounded steps with durable sleep between polls. [Workflows](https://vercel.com/docs/workflows), [pricing/limits](https://vercel.com/docs/workflows/pricing).

Workflow is not required to display an already-stored result, and no agent/LLM is needed. Prototype first with the local workflow runner; if compatibility/account limits fail, keep the same processor behind a documented local executor or return to the Python/separate-host alternative. Report reduced background behavior instead of quietly changing providers or paid plans. Cloud Workflow behavior remains pending deployment verification.

The SDK retries steps by default. For non-idempotent Apify run creation, explicitly disable application step retries (`maxRetries=0` or appropriate fatal failure) and still enforce the Postgres dispatching ledger, fencing and cancellation checks. Platform replay/redelivery may happen, so checking a persisted ledger precedes every side effect regardless of SDK settings. Persist a run ID immediately after a known launch. Unknown launch outcome stays uncertain and is not resent. Safe reads may retry within quotas. [SDK retry semantics](https://workflow-sdk.dev/docs/foundations/errors-and-retries).

Workflow arguments/results and logs must never contain keys, database URLs, booking/departure tokens or booking payloads. Pass opaque job IDs; read/write transient references in the restricted database within steps. Postgres is the domain/budget truth; managed Workflow state tracks execution, not a second conflicting quote/history database. Test duplicate step delivery and the crash after POST but before run-ID persistence.

## Serverless PostgreSQL and Auth

Use the project-provided transaction-pooler connection for serverless clients where appropriate; direct/session modes remain alternatives according to network constraints. Limit each instance's driver pool; do not assume a small per-instance pool bounds total concurrent function connections. Disable incompatible prepared-statement naming for transaction pooling and use transactions for SET LOCAL owner context. Release clients in finally; no network call while holding an SQL transaction. API, trusted processor and migration roles retain the private-schema/RLS separation from data-design.md. [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

The browser gets only public Auth configuration. Every user-facing API authorizes access before returning/starting/cancelling jobs. Internal workflow execution has an authenticated boundary; a public callback cannot process arbitrary owner/job IDs. Two-user and pooled-owner-context tests remain required.

## Free plan boundary

Vercel Hobby is personal/non-commercial with quotas; Workflow included usage is also limited; underlying Functions and Queues have their own usage, and Hobby completion-state retention is only1 day. Persist long-lived domain history/audit in PostgreSQL, not Workflow logs. Hitting limits may pause features. A Hobby Cron can run once daily and lacks exact-minute guarantees, so it is not a frequent background polling loop. Automatic history sampling remains off; optional daily sampling needs explicit opt-in and a displayed Apify budget. [Hobby](https://vercel.com/docs/plans/hobby), [Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Frontend/API on Vercel + Supabase Free + Apify monthly credits is a plausible USD0 starting scenario within all allowances, not a guarantee of continuous availability or unlimited flights. No Render account is required for this TypeScript option. No deployment/purchase/monitoring is authorized until the user requests it.

## Meaning for the current data

Keep all baggage/time/calendar/history caveats from [apify-stack-fit.md](apify-stack-fit.md) and [live probe](../connectors/apify-live-spike-2026-10-12.md). Shared types and fewer deployment services simplify maintenance; they do not repair missing provider evidence. The original four-feature acceptance remains intact.
