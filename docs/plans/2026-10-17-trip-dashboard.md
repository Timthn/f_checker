# Clarified Find flights dashboard

Latest direct user instruction supersedes separate outbound/return lists for round trips. One scoped implementation/check/independent-review continuation; earlier stopped cycles, ledgers and budgets preserved. No booking, source subscription, deployment, migration or new dependency; no live source request performed.

## Product and UI contract

1. No return date: cheapest compatible returned one-way quote, origin→destination, flight numbers, local departure/arrival dates and clocks; top10 source-price-ranked unique one-way choices below.
2. Return date: cheapest compatible complete paired source quote, origin↔destination; both flight groups show their flight numbers, dates, departure and arrival clocks. Below is one top10 list of complete pairs, ordered by the exact returned source total. Different outbound flights sharing the same return remain different combinations. Do not add separately quoted leg amounts.
3. Existing requested carry/checked/cabin/passengers/currency/date context is preserved and incompatible known context excluded. Requests are not returned baggage rights; missing passenger/segment/kg evidence stays unknown. Current provider still explores one selected outbound branch; claim lowest among returned complete pairs only, not global optimum.
4. Each route's travel-date chart uses selected leg departure±15days (31dates). A labeled button on the right switches outbound/return; shows that leg's flight numbers and dates. These are one-way route calendar references, not an asserted decomposition of the full trip fare or that exact flight's historical prices. No switching/locale/hover admission. Explicit existing Fetch prices action starts the chosen calendar query; absent dates remain null, dashed guide not invented quotes.
5. True historical observations are a separate labeled section. The initial search result now includes the latest saved owner/job/fingerprint-matching provider route-history snapshot, no detail click needed for access. It remains a route/round-trip context reference with capture-centered valid30day mean and matching plot, not a future travel-date matrix. Exact-flight history remains unavailable when evidence is insufficient.

## Implementation map

- `src/domain/search-presentation.ts`: safe/context-compatible results/combinations/hero, full-schedule dedup before top10.
- `src/components/search-flight-list.tsx`: leg=both renders complete FlightJourney in a single row and one source total.
- `src/components/search-price-trends.tsx`: independently scoped one-way leg calendar panels, no RT totals in individual-leg plots, safe owner/request storage handled by CalendarPanel. Historical section uses matching mean/plot validation.
- `src/components/flight-deck.tsx`: conditional list/hero/times; query/owner/offer keys; existing submitted-conditions banner preserved; price signal only comparable selected details.
- `src/server/analysis.ts#jobResults`: extra bounded owner-role SQL read for route history. Existing auth/RLS, no schema/privilege changes or provider IO.
- `src/i18n/catalog.ts`, `src/app/globals.css`: bilingual combination/leg/scope labels, keyboard button, warm/dark contextual hover.

## Verification and delivery

Agent domain tests10/10 and targeted history/detail5/5; root full257/257unit/mock/36files plus TypeScript passed. UI SSR regressions cover paired clocks/dates/flight numbers/single total; one-way no return switch; no fetch on mount. Independent review no actionableP1/P2, stale copy/ARIA labels corrected. Final build/registry/preview/secret/Git evidence in progress. Browser URL policy remains respected; current browser/manual/live supplier coverage is not established by mocked/SSR tests. Keep the user preview available after final build.
