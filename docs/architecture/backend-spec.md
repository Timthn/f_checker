# Backend spec v0.1

2026-10-12 Vercel-oriented update: proposed Next.js/TypeScript full-stack alternative is now the prepared goal recommendation; see [vercel-fullstack-option.md](vercel-fullstack-option.md). Earlier Python details below remain an alternative; storage/contracts/acceptance stay applicable. No implementation or final stack acceptance inferred.
Proposed Python/FastAPI; this is a planned API, not provider API and not implemented endpoints.

## REST contracts
| Method/path | Input/output | Status |
|---|---|---|
| GET `/api/v1/capabilities` | provider-supported fields, evidence status, credential configured boolean (never key), quotas | 200 |
| GET `/api/v1/locations?q=` | normalized airport IDs + city members; cached catalogue | 200 |
| POST `/api/v1/searches` | SearchRequest → search_id, job_id, estimate, cache status | 202 / 422 / 409 |
| POST `/api/v1/rendezvous` | A/B inputs + target arrival day + gap → job_id | 202 |
| POST `/api/v1/flexible-searches` | date ranges + nights + SearchRequest → job_id, legal pairs | 202 |
| GET `/api/v1/jobs/{id}` | status, phase, counts, coverage, results reference, errors | 200 / 404 |
| POST `/api/v1/jobs/{id}/cancel` | cancellation request; running request may still bill | 202 |
| GET `/api/v1/searches/{id}/results` | confirmed ranked itineraries, unknown group, coverage | 200 |
| GET `/api/v1/itineraries/{id}` | segments + qualified offers + freshness + source | 200 |
| GET `/api/v1/itineraries/{id}/history?comparison_key=` | own samples + stats + signal; provider insight separate | 200 |
| POST `/api/v1/date-prices` | neighboring-date exploration request → job_id | 202 |
| GET `/api/v1/health` | local app readiness; credentials not required for process healthy | 200 |

Never return provider replayable token to UI. Error envelope `{error:{code,params,field,retryable,request_id},meta:{locale,contract_version,server_time}}` following localization-spec.md; no raw provider body. 409 if estimate exceeds allowed budget/unsupported requirement, 422 if invalid date/input. Include contract_version and server_time. Idempotency-Key optional stable UUID; same key with different input rejected.

## Storage and authentication

Supabase Auth verified JWT, private flight schema and restricted PostgreSQL roles; owner isolation applies from the first application version. See data-design.md for RLS, immutable snapshots, budget reservations and durable dispatching recovery. Supabase CLI owns the only migration history. Free hosting changes availability, not these guarantees; see free-deployment.md.

## Adapter interface
Capabilities: one_way/round_trip/business, carry_on_filter/checked_filter/baggage_details/segment_baggage/weights, calendar_pairs, insights_scope, booking_links. Each value has documented / live_verified / unsupported / unknown evidence. Query execution only on configured provider; no silent paid fallback.

Methods: search_candidates, resolve_return, resolve_booking, calendar, insights. Unsupported raises typed error, not empty list. Separate parse from IO, schema versioned, retain redacted provenance. Provider failure partial stages persisted.

## Business invariants
- Monetary Decimal/integers, explicit currency fraction digits; JPY not two decimals by assumption. Money sums same currency/scope only.
- All segments have UTC times with valid chronological order plus IANA zone when known; unknown timezone cannot enter rendezvous confirmed set.
- Every segment's cabin/baggage requirement checked. Ambiguous fee basis downgrades estimated.
- Fare identity has provider and normalized change/refund rights; unidentified fare does not mix histories.
- Dedupe exact segment sequence per search; multiple fare offers separate. Immutable offers/observations, mutable token refs separate.
- Global request budget reserves before IO; reconcile after return; never subtract failed fee unless provider policy confirms no charge.
- Rank over current acquired/verified candidates only. Calendar coarse price is not a selected itinerary total.

## Testing required at implementation
Unit: minor currencies, inclusion fee double-count, per-person/per-segment scope; mixed cabin/unknown bags; ordering/id stability; signal daily weighting/threshold/stale; UTC/local-day meet; Pareto deterministic ordering; flexible nights/date line; cancellation/budget ledger.
Integration: DB lease/idempotency/restart, HTTP adapter fixtures, true empty vs schema failure, error redaction, expired token, search→return→booking contract and server/client schema. Recorded fixtures from later live spike only marked live-derived if actually captured.
Live smoke: approved provider/date route, ≤40 calls, no PII; verify response, matching provider interface and billed units. No claim unit fixtures certify live baggage correctness.

Environment planned `.venv`, project lock, migration and startup smoke on clean machine environment. Actual commands and pinned versions to be documented when implemented; currently no unit/integration test suite exists.

## Bilingual product requirement

Confirmed 2026-10-12: Chinese and English across the full stack. Follow [localization-spec.md](localization-spec.md) for locale resolution, language-neutral canonical data, error codes and translated user messages. Backend behavior is specified for future implementation; only prototype UI localization currently runs.

## Batch APIs and parent execution (continuation round3)

POST /api/v1/batches takes {kind,request} and UUID Idempotency-Key, authenticates and checks live enable gate, atomically admits full plan before durable SDK start. Returns safe opaque batch ID/status/reused; orchestration=start_retry_required retains admitted batch after SDK-start uncertainty. Budget rejection returns integer required/available microusd without supplier IO. GET /api/v1/batches/[id] and /results are owner-scoped read-only. POST /cancel cancels all children and refunds only untransferred holds. API roles retain no provider-call/reference/checkpoint access; bounded safe worker projections supply durable completion evidence.

Parent SDK arguments contain only batch ID; durable step results only boolean. Child executions carry only job ID. Failed/cancelled parent SDK status can authorize guarded same-batch restart on explicit same-key POST; observation errors cannot. Failed/cancelled child SDK status permits same-child restart only if all provider calls remain reserved without run IDs. Recovery immediately increments job lease version to fence stale callbacks; reserveCall adopts only undispatched reservation lease, preserving call/slot/budget. Possibly dispatched children stay uncertain with reconciliation required. Detail: docs/decisions/0006-batch-orchestration.md. Real SDK crash/restart proof for new parent and provider alternative-branch selection remain pending.
