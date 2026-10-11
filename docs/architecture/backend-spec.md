# Backend spec v0.1

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

Never return provider replayable token to UI. Error envelope `{error:{code,message,trace_id,retryable},details:[...]}`; no raw provider body. 409 if estimate exceeds allowed budget/unsupported requirement, 422 if invalid date/input. Include contract_version and server_time. Idempotency-Key optional stable UUID; same key with different input rejected.

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
