# Apify live capability probe — 2026-10-12

User authorized using the locally configured credential and a first-spike maximum USD0.50. Authentication succeeded; account plan returned FREE. Actor: scrapercompany/google-flights-scraper, pinned build0.0.2. Nine sequential small runs used 256MB, timeout120s, maxConcurrency1, maxRetries0 and maxTotalChargeUsd0.03 each. No subscription, schedule, ticket purchase or application deployment was created.

Route HKG→NRT, one adult, HKD, departure2026-11-10 and return2026-11-17 where applicable. These are technical test queries, not a user travel recommendation. Source timestamps are2026-10-11 around17:20–17:24 UTC, which is2026-10-12 in Hong Kong.

## Evidence and limitations

| Probe | Observed response | Platform-reported run usage USD |
|---|---|---|
| Economy one-way, zero requested bags |126 itineraries |0.00505|
| Round-trip,1 carry-on and1 checked requested |Valid envelope but0 itineraries |0.00005|
| Business one-way |100 itineraries; sampled segments show business |0.00505|
| Calendar ±1 departure day, fixed return date, requested bags |3 cells, coverage2/3 |0.00805|
| Round-trip, zero requested bags |19 outbound candidates, departure tokens |0.00505|
| Carry-on one-way requested1 |19 candidates, but sampled first included count0 |0.00505|
| Return lookup of selected outbound |6 return candidates; each carries next leg and booking token |0.00505|
| One-way booking lookup |1 seller option,1 selected leg; empty baggage_prices |0.00505|
| Complete selected round-trip booking lookup |1 seller option,2 selected legs; baggage text “1 free carry-on” |0.00505|

**Sum of reported run usage: USD0.04345.** Start event0.00005/run, successful flights-request0.005, calendar-request0.008. Total reserved run ceilings0.27, below authorized0.50. Read/storage/account adjustments may post separately; this sum is evidence of reported run usage, not a final invoice or proof of remaining free credits. No full monthly account usage/billing information was retrieved.

All nine platform runs ended SUCCEEDED; that does not mean all product acceptance passed. The empty bag-filter result was not repeated blindly. Control queries returned flights, but they do not establish why the bag-filter query was empty or prove no qualifying flight exists.

Confirmed at sample level: account authentication, Actor invocation and charge ceiling, distinct search/return/booking/calendar response shapes, economy/business results, complete selected round-trip reconstruction via token chain, and a small current date-price surface. No promise of other routes/passengers/markets or sustained reliability.

Still pending: reliable per-segment checked baggage counts/weight/fees, filter accuracy, comparable complete baggage-inclusive prices, time-zone semantics/DST, general flexible departure×return grid, cross-source/fare identity, freshness/cache semantics, supplier retention/display rights and monitoring. A contradictory included carry-on count must remain unknown/unsatisfied; requested filters cannot override returned evidence. Round-trip booking baggage text is not sufficient proof of every segment's allowance or a checked bag.

## Actual response shape

- `search` and `return`: dataset row with mode, endpoint, input, itineraries, count, optional price_insights, warnings, billed and scraped_at. Each itinerary contains legs; each leg contains segments. An initial round-trip candidate showed only the outbound, return mode only the next leg. Preserve selected context when assembling the full journey.
- `booking`: selected top-level legs plus booking_options, seller prices, extensions and baggage_prices. The round-trip probe returned both selected legs; do not add outbound and return quoted totals blindly.
- `calendar`: prices entries with departure_date, return_date, numeric price, currency and is_priced. This probe retained one fixed return date across the departure range, not a9-cell matrix.
- Segment times were naive ISO strings with no offset. Time semantics remain unconfirmed; never reinterpret them as UTC solely because they parse as ISO.
- checked_bags_included was null in sampled search results. The booking baggage arrays varied from empty to a single carry-on text. Missing values are not zero/free.
- price_insights contains price_history and typical range; keep as route/search-level source reference. One live probe cannot certify itinerary-specific history or future forecasts.

The [live-derived fixture folder](fixtures/apify-build-0.0.2/) includes nine sanitized samples, [usage summary](fixtures/apify-build-0.0.2/probe-summary.json) and a projection of the publisher's actual input schema. Arrays are sampled to3 rows; history to7 points. Original counts are explicitly recorded. Tokens, token-bearing URLs, booking requests and phones are removed. These are sampled live responses, not a complete export or an official output JSON Schema. Use separately labeled synthetic opaque token fixtures for orchestration tests; do not reinsert replayable live tokens into Git. Private raw/reference material remains under Git-ignored data/apify-spike for temporary diagnosis only; do not publish it and expire it within7 days unless the user requests earlier removal.

Publisher input bags limits are carry_on_bags0–1 and checked_bags0–2 per passenger; no kg field. date_window_days1–30. The published date regex appears overescaped; valid dates were accepted in our run. Do not copy that regex as the application's validator; use typed calendar-date validation and preserve the published projection as evidence.

## Development decision

Proceed with Apify as the user's selected connector behind a strict adapter, with feature evidence gates. Keep checked-baggage filtered top-ten/meeting/flex results unconfirmed until adequate evidence exists; UI can expose unknown candidates honestly. No paid fallback or subscription. Continue fixture-based frontend/domain work while remaining provider and Supabase gates are resolved.

Stack: [apify-stack-fit.md](../architecture/apify-stack-fit.md). Copyable implementation goal: [development-goal-prompt.md](../development-goal-prompt.md).

## Reproducible probe tool

tools/apify-spike.py uses stdlib and reads the ignored .env. `inspect` verifies account/Actor build; `status`/`items` read existing runs. `run` reserves the cumulative private ledger before POST, enforces at mostUSD0.50 in reserved ceilings, pins the inspected build and sets maxTotalChargeUsd. It is a preflight utility, not the production shared worker or an account-wide billing cap. Do not reset/delete its ledger to replenish budget. Unknown launch outcomes stay reserved and require reconciliation, never automatic retry. The tool does not install dependencies or alter global config.

Sources: [Actor listing](https://apify.com/scrapercompany/google-flights-scraper), [Apify run API charge ceiling](https://docs.apify.com/api/v2/actors-runs-post), [platform Free pricing](https://apify.com/pricing). Numerical probe evidence comes from authenticated Actor API responses, not the listing's marketing examples.
