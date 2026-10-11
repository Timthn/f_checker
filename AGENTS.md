# F Checker — project instructions

## Scope and authority
Only work in `C:/Users/Tim Ngan/Desktop/projects/f_checker` and only commit/push to `https://github.com/Timthn/f_checker` (SSH equivalent permitted). Before any Git write, verify root, branch and origin. Never change other repositories. Deletes must resolve inside this project; preserve user work. No core OS/global dependency changes, purchases, ticket issuance or deployment.

Current goal: development-preflight documents and design only. Do not implement the application or install its dependencies yet. Unknown provider capabilities stay `pending_live_validation`.

Roles: product/UIUX designer, solution architect, full-stack developer, QA. Independent sub-agent spec review is authorized; assign non-overlapping files for future parallel work.

## Confirmed product decisions
- User-facing brand is `Flight cheaker` (user-provided spelling, 2026-10-12). Repository/path remain f_checker.
- Four features: top-ten filtered offers, two price views with signal, split-screen rendezvous, flexible departure/return ranges.
- Economy and business; baggage includes carry-on versus checked, not a single ambiguous yes/no flag.
- User confirmed both same-trip observed price history and neighboring travel-date prices as separate views.
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
Recommendation, not installed/accepted stack: after the user asked about one Vercel host, propose Next.js/TypeScript frontend + Node server API + durable Workflow steps, Supabase PostgreSQL/Auth. Earlier FastAPI/Python remains an alternative; see vercel-fullstack-option.md. Prepared goal adopts TypeScript only upon user invocation. Supabase CLI owns one migration history. Free personal-demo hosting is proposed, not deployed; sleeping services do not guarantee continuous sampling. Provider choice conditional on capability spike; user selected Apify scrapercompany/google-flights-scraper on2026-10-12, initial build0.0.2. Nine bounded probes recordedUSD0.04345 run usage; detailed baggage/time/flexible-grid semantics remain pending. No paid fallback or subscription by default.
Paths kebab-case; Python identifiers snake_case; TS variables camelCase; JSON internal fields snake_case; API `/api/v1/*`; money integer minor units and ISO currency; timestamps RFC3339 UTC plus IANA zone. Offer IDs never rely on expiring booking tokens.

Current runnable artifact is standalone HTML with local CSS/JS and vendored ECharts, not application code. For this UI task follow the user’s direct design guidance without a Superpowers workflow. Public frontend-design guidance is project-scoped under `.agents/skills/frontend-design`; do not install globally. Project install/start/unit/integration commands will be recorded only when implemented and verified; do not present proposed commands as tested commands.

## Harness and stop rules
Record material decisions and index them here. Update progress on each stage, record evidence and next steps. Secrets in backend environment only; `.env.example` contains placeholders; never commit `.env`, credentials or replayable provider tokens. Snapshot and browser QA allowed.
Future application completion requires unit/integration/critical-flow checks, clean isolated install, progress update and verified push to this repo. This preflight goal instead requires reviewable documents, independent review, design, researched provider limits and credential/budget plan.
Stop affected retries if the same test fails three consecutive times without identified cause, or more than five goal-wide implementation/verification/independent-review rounds occur without meeting success conditions (including partially successful rounds; record the count in progress). Write `docs/errors/YYYY-MM-DD-topic.md`, preserve work, update progress. Never weaken tests or reset counters by renaming them.

## Instruction isolation
This file applies within this repository only. No existing AGENTS.md/CLAUDE.md was replaced. Checked ancestor paths contained no such files at creation. System/developer and user instructions still apply; this file does not override them. Newly discovered ancestor instructions must be reported, not silently ignored.
