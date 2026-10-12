# Reference batch verification

Scope: one directly authorized continuation for live meeting/flexible batches, retaining historical round counters and original budget. Full bill verification explicitly waived by user; spending controls unchanged. No new credentials, migration, dependency, booking endpoint or deployment.

## Automated/actual evidence

- 157 unit/mock tests passed across16 files, including gate separation, parent safe cleanup, source price contradictions, preview/server parity for dedup/default/date-line, frozen request and source rights rules.
- 13 actual Supabase batch tests passed against the sole authorized project,394s; no provider IO. Temporary QA state cleaned and original real ledger retained. Budget concurrency, held/prepaid transfer, RLS, cancellation, expiry, original membership recovery and observation rules covered.
- Mock browser scenarios15 verified: full run14/15, then corrected meeting combobox locator rerun1/1. No assertion removed; first failure was a label locator containing select options. Earlier sandbox Chromium/localhost failure corrected by authorized execution; no application failure inferred. Tests use mocked supplier responses, not real flight UI E2E.
- Production build/TypeScript passed; final post-review build/clean evidence is recorded in progress. Independent review found gate-cleanup P2 and preview default mismatch; fixed with tests. No residual P1/P2 in follow-up review.

## Actual reference batch runs

tools/live-batch-smoke.cjs is explicit only. State persists idempotency key/frozen request before POST; a retry observes the same uniquely bound batch, never recreates a paid request. Tests reuse an isolated QA account; real rows/charges are retained and not refunded.

Meeting49361e89-fc2e-42ac-b7c4-8a29063ff5a9: HKG and SIN to NRT, economy/adults1/HKD/zero requested bags, fixed departures2026-11-10, arrival target2026-11-10/max gap60. Two admitted/searched queries, two search calls succeeded,139compatible priced source candidates,20shown maximum,0confirmed pairs. Flexible5b3c5c7b-15b9-4f0d-81ed-61a6ea64b30c: HKG→NRT, departure2026-11-10/return2026-11-17, nights6–8. One admitted/searched date combination, search and return succeeded,64compatible priced candidates,10shown maximum,0verified cells/recommendations. Partial parent status denotes incomplete source qualification, not a failed supplier call. Only one selected outbound branch covered.

Both batches completed automatically through actual Auth/localAPI/Workflow/Apify; no manual recovery/new POST. Real fresh browser click was not used in this harness; UI dispatch independently tested with mocks. Source price evidence read from actual persisted payloads: meeting139/139 and flexible64/64 source_fields_matched,0insufficient. These are price/display/exact comparisons from the same supplier, not an independent airfare lookup. Query envelope, currency/route/date/cabin checks retained; full-party fees, bags and UTC remain unverified. Old records without evidence remain insufficient, not retroactively qualified.

Four new calls, each Actor-reported5050microUSD; indicative sumUSD0.02020, not an invoice requirement. Conservative new reservationUSD0.12 retained. Lifetime cap500000/reserved420000/calls_reserved5, remaining roomUSD0.08; original40validation-subrequest cap retained. State/raw credentials/IDs beyond safe audit stay in ignored data. No background sampling.

## Limitations

Real smoke covers fixed two-side meeting and one flexible combination; multiple-date batches are fixture/plan/UI tested but not separately live-probed. No confirmed same-day UTC/gap plan, baggage-filtered offer or verified minimum can be promised from current source evidence. Arrival-window covers the chosen three departure days, not all globally possible departure dates. One outbound return branch does not cover all flight combinations. Complete invoice work is intentionally outside the current product scope. Final clean-copy/Git evidence and continuation stop recorded in progress.
