# Route history and billing evidence

Status: implemented with fixture, mock and restricted-role database verification; live source acceptance and final invoice reconciliation remain incomplete.

## Price evidence

Provider `price_insights.price_history` belongs to the matching route/search, not the selected fare or a verified party total. The parser validates echoed route, cabin, passenger and baggage request, dates, currency, integer minor-unit precision, bounded epoch series and unique display dates. Supplier epoch timezone semantics remain unverified; UTC dates are display labels only. Provider `scraped_at` is the source observation time, while `fetched_at` records retrieval separately. Missing, invalid or future source timestamps reject the snapshot. Delayed retrieval cannot renew the fifteen-minute provider-level freshness gate.

History snapshots are written in the same fenced, uncancelled completion transaction as offers, once per provider call. Composite owner/job/call foreign keys and owner RLS prevent association with another job. Worker allowlists exclude booking references and unknown attachments. API clients can read their route snapshots but cannot write them or access raw billing evidence.

The details screen presents three distinct views: provider route reference, comparable itinerary observations, and current travel-date prices. A fresh provider level with sufficient samples is displayed as the provider's reference signal; it does not compare the selected fare against a party-verified historical baseline. Genuine comparable observations retain their strict existing evidence requirements; cache reads never add samples. No background sampling is enabled.

## Cost evidence

Known-run metadata reads are durably reserved before IO and captured in private append-only evidence. Latest observation determines reported cost, including explicit unknown values. Completion/cancellation/reconciliation updates acquire the provider row lock and separately project latest evidence, preventing an older callback from overwriting newer cost. A capped or failed earlier call cannot starve later bounded return/booking reconciliation.

The child Workflow uses a durable ten-second delay followed by a no-retry billing step after completion or polling exhaustion. Only safe job IDs cross durable arguments/results; supplier IDs and metadata remain inside server steps. This captures failed and cancelled runs too when known. Unknown run creation still requires conservative manual reconciliation, not another POST.

Authenticated GET `/api/v1/jobs/[id]/billing` reads saved, sanitized evidence only. POST requests an explicit metadata reread and remains live-gated. The UI only uses GET and manual saved-evidence refresh; language/chart/focus interaction cannot reconcile or start a provider run.

Reserved ceilings, reported Actor usage, measured external cost, estimated overhead and exact total are separate. Stable API observations are not invoice confirmation. Platform read/transfer/storage costs remain unmeasured, account-period attribution and invoice evidence remain missing, and exact total stays null. The existing USD0.01 per-call overhead allowance is an unverified estimate, not proof that live mode is affordable. No budget reset or live enablement accompanies this change.

## Files and evidence

- Migration: `supabase/migrations/20261012103000_history_billing_evidence.sql`, applied through the sole CLI history; seven local/remote versions match.
- Parser/persistence: `src/domain/route-history.ts`, `src/server/route-history-recording.ts`.
- Billing: `src/server/billing-evidence.ts`, `src/server/reported-cost.ts`, `src/server/provider-reads.ts`.
- UI: `src/components/flight-deck.tsx`, `src/components/billing-panel.tsx`, bilingual catalog.
- Tests: `tests/route-history.test.ts`, `tests/workflow.test.ts`, `tests/history-billing.integration.ts`, `tests/e2e/dashboard.spec.ts`.
- DB suite uses temporary QA owners and simulated provider metadata; no live supplier HTTP or monetary reservations. This does not establish source baggage, price, timezone or actual invoice capability.
