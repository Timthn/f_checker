# Actual two-date search-return validation — 2026-10-12

Result: PASS for actual multiple-date reference querying. No fixtures replaced supplier responses; no booking endpoint or purchase. This is Auth/API/Workflow/Apify execution, not a new browser fresh-click E2E or confirmed all-inclusive fare acceptance.

Authorization: user explicitly approved the proposed cumulative capUSD0.50→USD0.54 (+USD0.04). Existing reservationsUSD0.42/calls5 preserved. Two complete search-return date pairs reservedUSD0.12 under the existing atomic budget, free-account, max-run-charge, global-concurrency and lease/checkpoint guards. No automatic resampling, different-key replay or refund. A new private ignored state froze the exact request/key before dispatch; old smoke states untouched.

## Actual result

HKG→NRT, economy, one adult, HKD, request carry_on0/checked0. Minimum/maximum destination-local assumed nights6..8. Batch a7914ec0-97dd-48df-ba0c-b5b29cf616ae, strategy exhaustive over the two requested pairs, one selected outbound branch per pair.

| Departure / return | Lowest eligible returned reference amount | Assumed destination nights | Compatible source candidates | Source price-field agreement | Captured UTC |
| --- | --- | --- | --- | --- | --- |
| 2026-11-10 / 2026-11-17 | HKD2,289.00 | 7 | 21 (10 shown) | 21/21 stored | 2026-10-12T11:29:03.031Z |
| 2026-11-11 / 2026-11-17 | HKD2,289.00 | 6 | 56 (10 shown) | 56/56 stored | 2026-10-12T11:29:19.003Z |

Every one of the four provider calls (search+return per pair) reached succeeded automatically; no manual run recovery. The batch is partial because rights/time acceptance is intentionally unknown, not because one date failed. Requested/admitted/searched/reference cells2/2/2/2; verified cells0 and confirmed recommendations0. Both selected-branch complete structural return chains yielded fresh references. Source candidate totals include compatible search/return candidates and are not all fully confirmed complete itineraries. Both source field groups matched numeric/display/exact amounts for all77 stored records; this is same-source agreement, not an independent Google/airline availability check. Returned reference amounts were not added to outbound prices or promoted to party totals.

Equal monetary minima are ordered by existing tie rules (six assumed nights before seven); no claim November11 is cheaper. This validates the two requested date combinations, not the full surrounding date window, multiple outbound branches or a global optimum. Source local-time semantics/IANA/DST and scoped baggage/party rights remain unknown. Prices expire15minutes after capture and must not be shown as indefinitely current.

## Costs and request safety

Each provider call reported5050microUSD; aggregate20200microUSD (USD0.0202) is indicative run-reported usage, not a final account invoice or a proof of all external costs. Reported values would staynull if missing. Metadata read counters were5 per call when captured. GET result refresh and a subsequent12-second observation kept the exact same immutable four-call membership; legitimate late reported-cost/read-counter updates are allowed and are not treated as another query. No paid POST replay was required.

Final lifetime cap540000/reserved540000/calls_reserved9. The conservative approved budget remainder is0; actual reservations are not asserted to equal cash charges and are not refunded. Future paid queries require another explicit amount authorization. No subscription, global package install, deployment, original-budget reset or changes outside the named repo/database.

Executed: bundled Node24.19; node --check tools/multi-date-live-check.cjs passed; explicit FC_EXPLICIT_MULTI_DATE_CHECK=1 node tools/multi-date-live-check.cjs completed exit0. State/result/attempt history live under ignored data/multi-date-live-*.json/jsonl; never delete/alter them to force a new paid batch. Independent pre-dispatch review found and fixed the fee/read-metadata comparison P2; final script/evidence review passed with no remaining P1/P2, with historical/current progress order corrected before delivery. Existing app build/unit/browser verification from the prior delivery remains historical, not rerun or claimed as new in this provider-only scope.
