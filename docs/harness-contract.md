# Flight cheaker — development harness and authority contract

2026-10-12. Restates the user's original development boundaries; implementation starts only on invocation of the development goal. This is project-local and does not replace unrelated AGENTS.md/CLAUDE.md files.

## Role and evidence

Act as product/UIUX designer, solution architect, full-stack developer and software QA. Use the approved product/UI specs, examine actual provider evidence, then implement and verify. Product spec already received independent review; review material changes independently and resolve findings before claiming completion. Sub-agent spec/code/QA review is authorized; give non-overlapping ownership if delegating edits. Do not restart completed preflight/UI work or use Superpowers against the user's instruction.

Use a recorded plan with acceptance IDs and a requirements-to-tests map. Each claim distinguishes proposed, implemented, fixture-verified, live-observed and acceptance-confirmed. Marketing examples, HTTP200, Actor SUCCEEDED, screenshots or prototype tests do not certify baggage, full-stack integration or a working production deployment.

## Scope

- Only modify/delete inside C:/Users/Tim Ngan/Desktop/projects/f_checker. Before deletion resolve the absolute path and prove it remains inside the project; preserve user work. Temporary approved scratch files do not expand repository authority.
- Only commit/push Timthn/f_checker; verify root, branch and origin before Git writes. No other repository, force push, destructive reset or unrelated history rewrite.
- No core OS changes, global packages or shared dependency environment changes. Use project-local dependencies, pinned supported runtimes and lockfiles; verify clean isolated installation and startup.
- Allowed: GitHub, browser/Chrome developer inspection, screenshots, project-local design tools; use Figma only if available/needed. Existing visual and motion design is the baseline. Deployment tools can be configured later.
- No deployment, resource purchase, paid subscription, paid proxy/domain, ticket issuance or payment. Apify calls stay within explicit budget/free allowance. Supabase schema changes only in the user's named dedicated development project; no project guesses or unrelated DB changes.
- Secrets stay ignored local/server environment; public Auth config is distinct from SQL/admin secrets. Logs, screenshots, fixtures, git diffs and client bundles must exclude credential values, booking payloads and replayable references.

## Structural memory

AGENTS.md is the project entry point, indexing configuration, runtime/language decisions, product spec, UIUX, frontend/backend spec, architecture, database/Auth, connectors, contracts, naming conventions, commands, tests and errors. Record important decisions in docs/decisions with alternatives/reasons/status. Never write only a chat conclusion for a material decision.

Maintain docs/progress.md (the progress book) with current phase, completed acceptance, evidence, unresolved risks, remaining tasks and the next action. Record actual install/start/typecheck/test commands after verifying them; proposed commands must be labeled. Keep bilingual contract catalogs and schema versions synchronized, not two drifting copies of types/errors.

Resume from progress/decisions after interruptions, validate recent Git state and reuse known run IDs/checkpoints. Never reset cost/retry counters to start over. Existing local Apify spike ledger reservesUSD0.27 of the originalUSD0.50 ceiling; reported usageUSD0.04345 is not proof of final billing. Use the remaining original authorization conservatively, not a freshUSD0.50 for each turn.

## Development and QA loop

1. Read relevant specs/evidence, verify boundaries, write/update a concrete plan and acceptance map.
2. Implement a bounded slice and necessary contracts; preserve unknown/partial states. Decide with evidence; update indexed docs when design changes.
3. Verify meaningful domain, adapter, DB/Auth and UI behavior with fixtures/local integration first. Live checks are separate opt-in/capped evidence.
4. Use an independent reviewer for material spec/architecture/implementation changes, resolve actionable findings, rerun affected checks and record results. Do not dilute acceptance because a provider lacks evidence.
5. Check clean environment, secrets, progress and Git diff; commit/push the authorized repo and verify remote HEAD and clean status. Document failures rather than claiming success.

Required edge evidence: minor-unit currencies/fees; unknown/mixed cabin and segment baggage; full return chain; naive times/timezones/DST/date-line/local-day constraints; calendar missing coverage; cache reads not new history; insufficient/stale signals; deterministic Pareto ranking; pooled tenant context/RLS; cancellation, budgets, duplicate deliveries and crashes before/after dispatch; language switches not paid refreshes; responsive keyboard/touch/reduced-motion UX. Workflow completion logs do not replace these tests.

## Success and stop rules

Success means the scoped application meets the original four-feature acceptance, applicable unit/integration/critical E2E checks pass, dependency/environment compatibility is verified in clean isolation, progress/structural docs are updated, and all relevant non-sensitive changes are committed/pushed and verified. Prototype75 checks are earlier evidence only. If supplier capability or a missing credential prevents required acceptance, report partial completion and the exact missing condition; do not mark the full goal achieved.

Failure stop: the same test fails three consecutive times with no identified cause, or more than ten goal-wide implementation → verification → independent-review rounds occur without meeting success conditions. Record each complete round in progress, including partially successful rounds; do not reset by changing phases, branches or test names. Stop automatic development and write docs/errors/YYYY-MM-DD-topic.md with safe command/output evidence, counters, cause/unknowns, attempted fixes, preserved work and the specific next decision/input. A round has this concrete recorded cycle; individual tool calls are not separate rounds. Preparing this prompt has not started the next development goal or its round counter. Never remove/relax tests merely to pass.

Missing credentials pause dependent integration, not already-authorized independent work; keep required questions pending and avoid pretending completion. Only the human can authorize budget expansion/deployment or resume after the stated failure stop.

2026-10-12 amendment: user explicitly authorized cumulative limit10 ("10轮吧") after round6. Preserve count6 and original USD0.50 budget; all other boundaries remain unchanged.
