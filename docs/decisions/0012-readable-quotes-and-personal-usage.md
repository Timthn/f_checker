# Readable quotes and personal usage

User-directed feedback scope, 2026-10-13. Flight checker is a private personal dashboard. This continuation does not reset previous development rounds or usage records, deploy the app, or authorize automatic sampling.

## Flight information

Keep source airline name and code in a bounded optional segment contract and persistence allowlist. Old records can identify GK/UO/HB/MM/SL/BR by a small documented directory, with an identification tooltip; this is not confirmation of the operating carrier. Unknown codes remain unknown. Dates and HH:mm are formatted from valid source-local clocks, with outbound/return labels and local calendar day differences. No guessed UTC conversion.

The selected price is the selected itinerary's captured source quote. Agreement of two source price fields does not prove market-wide cheapest, live availability, baggage inclusion, or a per-party total. Technical source notes are expandable. Baggage shows actual segment/passenger evidence or “not provided”; null/empty is not zero. Official airline fare/baggage links are an alternative reference, never automatically applied to an unidentified fare. A future precise allowance requires evidence tying fare brand, passenger and segment to this particular quote; a generic airline policy cannot supply it.

## Price charts

Remove the two history/date switch buttons. Main chart centers the selected departure date, with 30 dates on either side. Detail click reads at most 500 matching owned saved quote records, requiring identical route, return date, cabin, passengers, currency and requested baggage apart from departure. It selects the newest valid saved capture per date and the lowest inspected candidate within that capture. Dates without evidence stay null, and saved captures can be expired. This is neither the selected flight's history nor a global daily minimum. No hidden calendar scan or provider request.

The separate source route history keeps its original quotation-observation dates. Mean is the arithmetic mean of available valid daily reference prices within the inclusive 30-day observation window ending at source capture; disclose actual sample count and date range. Missing dates are excluded, not zero filled. Do not substitute a typical-range midpoint or label route history as itinerary history.

Search's Actor dataset already contains source history; initial search is not issuing one historical Actor run per candidate. Detail click lazily reads the saved DB payload and neighboring saved quotes. Therefore this change reduces initial UI/detail work, not the Actor's own execution time. Preserve async loading, recovery and idempotent dispatch.

## Meeting and flexible searches

A and B have separate carry-on and checked requirements in both saved analysis and live requests. Recommendation layout has distinct A journey, B journey, combined source price, and arrival-gap areas; mobile stacks them. Destination-local approximate references remain clearly separate from confirmed UTC/time/right matches.

Flexible dates default to bounded exploration of 3 date pairs, maximum 8. Each round-trip pair admits up to two source operations, so the normal default is at most 6 provider runs, maximum bounded mode 16. Return candidates are still limited to one selected outbound branch per pair. The old 40-operation per-batch guard remains. Exhaustive mode is available only for an admissible small range; an over-limit complete plan is rejected, never silently truncated. These are sampled recommendations, not a global or proven local optimum. A 50-quote display request does not imply 50 paid date searches.

Internal whole-batch ceiling defaults to USD0.50; no API cost inputs or amount previews on flight pages. Previously saved pending requests retain their original ceiling and body on recovery. Changing language, hovering, chart interaction and progress refresh do not create paid runs.

## Usage and budget

One authenticated bilingual Usage page reports saved provider-run starts, uncertain dispatches separately, known reported run fees, missing cost records, and a USD5 monthly reference. It groups by call-record creation within the Hong Kong calendar month; existing records do not have an immutable actual-dispatch timestamp. Metadata reads are not counted as run starts. Read/transfer/storage costs and other activity can be missing, so no final invoice or verified account balance claim. Endpoint is GET-only, no-store, owner-scoped worker aggregation; run IDs and credentials stay private. Usage cache is removed on session/owner changes.

User explicitly requested USD5 total budget. New monthly account defaults are USD5. `tools/configure-personal-budget.cjs` raised the designated project's current monthly/owner/lifetime caps to USD5 in one transaction, checking that reserved amounts, call counters and call caps are unchanged. Applied result: reserved USD0.63, 12 calls, lifetime call cap40; no Apify request. Legacy lifetime guard remains cumulative across months, and budget-admission month remains UTC while usage reporting uses Hong Kong time. Neither counter nor free allowance resets automatically. Each actual dispatch still checks verified free-account allowance and maxTotalChargeUsd, and ambiguous paid POSTs are never automatically repeated. This is a budget ceiling, not permission to upgrade plans.

[Apify pricing](https://apify.com/pricing) currently lists USD5 monthly free credit; account-specific allowance and other costs still matter. No subscription, proxy purchase or deployment.

## Directory and baggage references

- GK: [Jetstar](https://www.jetstar.com/us/en/travel-alerts); [baggage](https://www.jetstar.com/jp/en/flights/baggage/checked-baggage).
- UO: [IATA](https://www.iata.org/en/about/members/airline-list/hong-kong-express-airways-/439/); [fare categories](https://www.hkexpress.com/en-HK/Plan/Fare/Fare-Categories).
- HB: [Hong Kong Education Bureau airline table](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/pshe/references-and-resources/tourism/reference_materials/20211203_THS_CDI020211826_Sharing.pdf); [official baggage](https://www.greaterbay-airlines.com/hk/en/manage/our-services/baggage.html).
- MM: [Peach flight status](https://www.flypeach.com/en).
- SL: [Thai Lion Air check-in](https://dx.checkin.lionairthai.com/dx/SLCI/).
- BR: [IATA EVA Air](https://www.iata.org/en/about/members/airline-list/eva-air/357/).

All references checked 2026-10-13. Logos are not imported. Original supplier baggage/time/party/complete coverage limitations remain pending; this feedback delivery does not declare the broad original Goal complete.

## Later feedback: flexible travelers and re-query

Flexible dates offers one-person or two-person search. In two-person mode A/B carry-on and checked preferences are separate and retained as an ordered `base.traveler_baggage` array in saved request identities. The server requires exactly two entries and two adults, then recomputes the higher requirement for the source's uniform per-person bag filters; it never sums A/B counts or trusts client totals. The bilingual form explicitly explains this conservative limitation. A provider cannot therefore establish distinct per-person included rights merely from these input values. One-person requests retain the legacy no-array format. No additional source operations are created by separate inputs.

Terminal batches have a direct “Search again” button using current conditions and a new admission key. It synchronously clears the old request reference before admission and persists no old batch ID with the new pending key. Double-click protection remains. Uncertain admissions/tasks retain identical-request recovery and cannot be silently replaced by a new paid query. Editing a form alone never starts a query.
