# F Checker — project instructions

## Scope and authority
Only work in `C:/Users/Tim Ngan/Desktop/projects/f_checker` and only commit/push to `https://github.com/Timthn/f_checker` (SSH equivalent permitted). Before any Git write, verify root, branch and origin. Never change other repositories. Deletes must resolve inside this project; preserve user work. No core OS/global dependency changes, purchases, ticket issuance or deployment.

Current goal: actual application development (2026-10-12). User explicitly requested round-counter reset with limit5 on2026-10-12: start continuation cycle2026-10-12-live-batch-02, now completed2/5. Previous10 completed rounds remain historical and are not deleted. Original budget and all other boundaries remain unchanged. Unknown provider capabilities stay `pending_live_validation`; no deployment authorized. Prior stop remains documented in docs/errors/2026-10-12-goal-round-limit.md.

Roles: product/UIUX designer, solution architect, full-stack developer, QA. Independent sub-agent spec review is authorized; assign non-overlapping files for future parallel work.

## Confirmed product decisions
- User-facing brand is `Flight cheaker` (user-provided spelling, 2026-10-12). Repository/path remain f_checker.
- Four features: top-ten filtered offers, two price views with signal, split-screen rendezvous, flexible departure/return ranges.
- Economy and business; baggage includes carry-on versus checked, not a single ambiguous yes/no flag.
- User confirmed both same-trip observed price history and neighboring travel-date prices as separate views.
- 2026-10-12 user accepts provider route/search history for first-release reference charts/signals, separately labeled 航线价格历史 / Route price history. User then requests continuation prioritizing live meeting/flexible batch queries, comparable quote recording and full cost reconciliation. Plan: docs/plans/2026-10-12-live-batch-continuation.md. New user-authorized cycle, currently2/5; historical10 and budget retained.
- Unknown baggage is not zero/free. Provider search-level history is not flight-specific history.
- Never claim global cheapest, fabricated history or real validation based on demo data.

## Document map
- Product and acceptance: [docs/product-spec.md](docs/product-spec.md)
- UIUX and design states: [docs/design/uiux-spec.md](docs/design/uiux-spec.md)
- Cockpit visual/motion rules: [docs/design/cockpit-direction.md](docs/design/cockpit-direction.md)
- Current browser checks: [docs/qa/cockpit-verification.md](docs/qa/cockpit-verification.md)
- Inspectable demo: [docs/design/prototype.html](docs/design/prototype.html)
- Tech comparison: [docs/architecture/tech-selection.md](docs/architecture/tech-selection.md)
- System: [docs/architecture/system-design.md](docs/architecture/system-design.md)
- Bilingual UI/API contract: [docs/architecture/localization-spec.md](docs/architecture/localization-spec.md)
- Frontend: [docs/architecture/frontend-spec.md](docs/architecture/frontend-spec.md)
- Backend: [docs/architecture/backend-spec.md](docs/architecture/backend-spec.md)
- Provider evidence: [docs/connectors/provider-evaluation.md](docs/connectors/provider-evaluation.md)
- Internal contract: [docs/connectors/data-contract.md](docs/connectors/data-contract.md)
- Accounts/budgets: [docs/connectors/credentials-budget.md](docs/connectors/credentials-budget.md)
- Review: [docs/reviews/product-review.md](docs/reviews/product-review.md)
- Decisions: [docs/decisions/0001-preflight.md](docs/decisions/0001-preflight.md)
- Data model and RLS: [docs/architecture/data-design.md](docs/architecture/data-design.md)
- Architecture review: [docs/reviews/architecture-review-2026-10-12.md](docs/reviews/architecture-review-2026-10-12.md)
- Development keys/readiness: [docs/development-readiness.md](docs/development-readiness.md)
- Free deployment: [docs/architecture/free-deployment.md](docs/architecture/free-deployment.md)
- Observed Apify schema and limits: [docs/connectors/apify-live-spike-2026-10-12.md](docs/connectors/apify-live-spike-2026-10-12.md)
- Stack fit: [docs/architecture/apify-stack-fit.md](docs/architecture/apify-stack-fit.md)
- Copyable development goal: [docs/development-goal-prompt.md](docs/development-goal-prompt.md)
- Vercel full-stack option: [docs/architecture/vercel-fullstack-option.md](docs/architecture/vercel-fullstack-option.md)
- Original harness/boundaries: [docs/harness-contract.md](docs/harness-contract.md)
- Progress: [docs/progress.md](docs/progress.md)
- Verification: [docs/qa/preflight-verification.md](docs/qa/preflight-verification.md)

## Proposed engineering conventions
Accepted by user Goal on 2026-10-12: after the user asked about one Vercel host, propose Next.js/TypeScript frontend + Node server API + durable Workflow steps, Supabase PostgreSQL/Auth. Earlier FastAPI/Python remains an alternative; see vercel-fullstack-option.md. User invoked the prepared goal; Next.js/TypeScript is selected. Supabase CLI owns one migration history. Free personal-demo hosting is proposed, not deployed; sleeping services do not guarantee continuous sampling. Provider choice conditional on capability spike; user selected Apify scrapercompany/google-flights-scraper on2026-10-12, initial build0.0.2. Nine bounded probes recordedUSD0.04345 run usage; detailed baggage/time/flexible-grid semantics remain pending. No paid fallback or subscription by default.
Paths kebab-case; Python identifiers snake_case; TS variables camelCase; JSON internal fields snake_case; API `/api/v1/*`; money integer minor units and ISO currency; timestamps RFC3339 UTC plus IANA zone. Offer IDs never rely on expiring booking tokens.

Current runnable application is Next.js/TypeScript in src; docs/design/prototype.html remains the visual reference. For this UI task follow the user’s direct design guidance without a Superpowers workflow. Public frontend-design guidance is project-scoped under `.agents/skills/frontend-design`; do not install globally. Project install/start/unit/integration commands will be recorded only when implemented and verified; do not present proposed commands as tested commands.

## Harness and stop rules
Record material decisions and index them here. Update progress on each stage, record evidence and next steps. Secrets in backend environment only; `.env.example` contains placeholders; never commit `.env`, credentials or replayable provider tokens. Snapshot and browser QA allowed.
Current application completion requires unit/integration/critical-flow checks, clean isolated install/start, progress update and verified push to this repo. Earlier preflight completion does not satisfy this application Goal.
Stop affected retries if the same test fails three consecutive times without identified cause, or the current user-authorized development cycle reaches five implementation/verification/independent-review rounds without meeting success conditions (including partially successful rounds; record the count in progress). User explicitly reset the active counter on2026-10-12; earlier5/10 limits and completed10 remain historical, original budget retained. Write `docs/errors/YYYY-MM-DD-topic.md`, preserve work, update progress. Never weaken tests or reset counters by renaming them; no automatic sixth round or reset.

## Instruction isolation
This file applies within this repository only. No existing AGENTS.md/CLAUDE.md was replaced. Checked ancestor paths contained no such files at creation. System/developer and user instructions still apply; this file does not override them. Newly discovered ancestor instructions must be reported, not silently ignored.


## Actual development index
- Plan: docs/plans/2026-10-12-development.md
- Runtime: bundled Node24.19.0; dependencies installed only locally with lockfile after engine verification.
- Current continuation cycle2026-10-12-live-batch-02: completed2/5. Historical completed rounds10 retained. User explicitly authorized this counter reset; Goal not complete.
- Batch foundation: src/domain/batch-contracts.ts, src/server/batches.ts, migration20261012100000_batch_admission.sql; tests/batch.integration.ts/vitest.batch.config.ts; ADR docs/decisions/0005-atomic-batch-admission.md. Read-only results API: src/server/batch-results.ts, src/domain/batch-results.ts, src/app/api/v1/batches/[id]/results/route.ts; tests/batch-results.test.ts. Paid creation/parent Workflow/UI wiring remains next.
- Comparable recording: src/domain/history-recording.ts, src/server/offer-recording.ts; safe fee primitives src/domain/billing.ts. Current source still lacks full comparison evidence; durable billing reconciliation/route-history wiring pending.
- Previous round10 local critical-flow checks passed; its stop is historical after explicit user reset. Current priorities: live meeting/flexible batch execution, comparable history and full billing reconciliation. Acceptance checkpoint: docs/errors/2026-10-12-round10-acceptance-gates.md. No new live provider calls.
- Local recovery/account guard: src/instrumentation.ts, src/connectors/apify-account.ts, src/server/provider-allowance.ts; docs/decisions/0003-local-workflow-and-free-account.md
- Real Auth/API tests: tests/auth.integration.ts, vitest.auth.config.ts; actual SDK fixture-IO restart harness: tools/workflow-recovery.cjs. Qualify original verifier failure and preserved-record offline correction separately.
- Current architecture and pending gates: docs/architecture/application-status.md
- Stop checkpoint and remaining acceptance: docs/errors/2026-10-12-goal-round-limit.md
- Local commands/configuration: README.md, package.json, package-lock.json, next.config.ts, .env.example, .env.migration.example
- Runtime contracts/catalog: src/domain/contracts.ts, src/domain/rules.ts, src/i18n/catalog.ts
- Connector/workflow: src/connectors/apify-rest.ts, src/connectors/apify-adapter.ts, src/server/jobs.ts, src/server/provider-reads.ts, src/workflows/
- Private bounded return/booking chain: src/connectors/apify-chain.ts, src/server/provider-chain.ts; decision docs/decisions/0002-bounded-provider-chain.md
- Migration authority and tests: supabase/migrations/, tests/, tools/rls-check.cjs
