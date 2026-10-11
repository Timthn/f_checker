# F Checker — project instructions

## Scope and authority
Only work in `C:/Users/Tim Ngan/Desktop/projects/f_checker` and only commit/push to `https://github.com/Timthn/f_checker` (SSH equivalent permitted). Before any Git write, verify root, branch and origin. Never change other repositories. Deletes must resolve inside this project; preserve user work. No core OS/global dependency changes, purchases, ticket issuance or deployment.

Current goal: development-preflight documents and design only. Do not implement the application or install its dependencies yet. Unknown provider capabilities stay `pending_live_validation`.

Roles: product/UIUX designer, solution architect, full-stack developer, QA. Independent sub-agent spec review is authorized; assign non-overlapping files for future parallel work.

## Confirmed product decisions
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
- Frontend: [docs/architecture/frontend-spec.md](docs/architecture/frontend-spec.md)
- Backend: [docs/architecture/backend-spec.md](docs/architecture/backend-spec.md)
- Provider evidence: [docs/connectors/provider-evaluation.md](docs/connectors/provider-evaluation.md)
- Internal contract: [docs/connectors/data-contract.md](docs/connectors/data-contract.md)
- Accounts/budgets: [docs/connectors/credentials-budget.md](docs/connectors/credentials-budget.md)
- Review: [docs/reviews/product-review.md](docs/reviews/product-review.md)
- Decisions: [docs/decisions/0001-preflight.md](docs/decisions/0001-preflight.md)
- Progress: [docs/progress.md](docs/progress.md)
- Verification: [docs/qa/preflight-verification.md](docs/qa/preflight-verification.md)

## Proposed engineering conventions
Recommendation, not installed stack: Next.js/TypeScript frontend, FastAPI/Python backend, SQLite locally. Hosted database and deploy undecided. Provider choice conditional on capability spike; favor direct SearchApi evaluation, Apify alternative, not both paid by default.
Paths kebab-case; Python identifiers snake_case; TS variables camelCase; JSON internal fields snake_case; API `/api/v1/*`; money integer minor units and ISO currency; timestamps RFC3339 UTC plus IANA zone. Offer IDs never rely on expiring booking tokens.

Current runnable artifact is standalone HTML with local CSS/JS and vendored ECharts, not application code. For this UI task follow the user’s direct design guidance without a Superpowers workflow. Public frontend-design guidance is project-scoped under `.agents/skills/frontend-design`; do not install globally. Project install/start/unit/integration commands will be recorded only when implemented and verified; do not present proposed commands as tested commands.

## Harness and stop rules
Record material decisions and index them here. Update progress on each stage, record evidence and next steps. Secrets in backend environment only; `.env.example` contains placeholders; never commit `.env`, credentials or replayable provider tokens. Snapshot and browser QA allowed.
Future application completion requires unit/integration/critical-flow checks, clean isolated install, progress update and verified push to this repo. This preflight goal instead requires reviewable documents, independent review, design, researched provider limits and credential/budget plan.
Stop affected retries if the same test fails three consecutive times without identified cause, or more than five evidence-based repair/validation rounds fail. Write `docs/errors/YYYY-MM-DD-topic.md`, preserve work, update progress. Never weaken tests or reset counters by renaming them.

## Instruction isolation
This file applies within this repository only. No existing AGENTS.md/CLAUDE.md was replaced. Checked ancestor paths contained no such files at creation. System/developer and user instructions still apply; this file does not override them. Newly discovered ancestor instructions must be reported, not silently ignored.
