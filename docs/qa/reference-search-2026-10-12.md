# User-triggered reference search verification

Scope: one explicitly authorized continuation after the historical cycle03 5/5 stop, plus a simple signup entrance. No budget/counter reset, automatic further round, deployment, booking or sampling. Full original application acceptance remains incomplete.

## Implementation and evidence

Individual authenticated searches use LIVE_REFERENCE_SEARCH_ENABLED; full live/batch gate remains false. The same durable job, lease, account allowance, idempotency and budget controls remain. UI shows up to ten returned priced candidates, freshness and unknown fare/baggage/time evidence. Samples are distinct. Ambiguous repeated clicks restore the frozen original request/job; definitive terminal states permit a deliberate fresh key. Signup uses existing email/password Auth, with localized confirmation instructions.

- 151 unit/mock tests passed across15 files, including explicit null-price exclusion, all-null results, invalid-price rejection and private continuation-token alignment.
- 13 mock browser E2E tests passed, including signup, duplicate-click protection, ambiguous frozen requests and definitive-state fresh requests. These are mock supplier/signup responses.
- Four actual Supabase Auth/API/browser tests passed with synthetic flight records and no paid provider runs; cleanup retained original real ledgers. Real settings show email signup enabled and email confirmation required. Real signup email delivery/confirmation was not exercised.
- Final production build passed on Node24.19.0, with23 steps/two workflows and TypeScript checking. Clean-copy install/build/start evidence is recorded in latest progress; no credentials copied.
- Independent review found no residual P1/P2; source rights and the full Goal gates were not relaxed.

## Single actual supplier run and located failure

Actual browser login and click submitted one HKG→NRT economy, one adult, HKD, 2026-11-10 one-way query through the local API/Workflow. API returned202. The Actor run succeeded, but automatic collection entered uncertain / DATASET_RECONCILE_REQUIRED. A bounded, durably reserved read of that same dataset identified19 candidates, four with explicit price:null. The previous whole-array number schema rejected the entire response. Original failure is preserved in ignored data/live-reference-first-attempt.json; no uncertain POST was repeated.

The adapter now validates the entire payload strictly, permits only explicit null prices to be excluded, and preserves the same filtering/index pairing for private continuation tokens. Missing/string/negative prices or malformed structures remain errors. Redacted first-five sample: docs/connectors/fixtures/apify-build-0.0.2/live-null-price.json; four priced records in this reduced sample, not the complete supplier response.

After the fix, an ignored QA-only manual recovery fenced the original QA job and saved the same dataset through completeStage. It used no supplier IO or new reservation. Fifteen priced compatible candidates persisted, zero confirmed and fifteen unknown. A subsequent actual browser/Auth/results check restored only that same job, displayed ten of fifteen candidates, and switched both languages without another provider run. Screenshot: ignored data/live-reference-browser.png. This proves saved actual quote rendering after manual recovery; it is **not** an uninterrupted automatic live E2E or automatic uncertain-job recovery pass. No second fresh supplier run was launched to prove the patched uninterrupted path.

One search POST total. Original job0571b35a-831f-46db-8f21-a726061c97cd retained; no real reservation refund. Actor-reported cost5050microUSD (USD0.00505); per-run reservation30000microUSD (USD0.03). Read counter6 includes existing/final billing reads and the single diagnostic dataset read. Lifetime ledger cap500000/reserved300000/calls_reserved1; conservative remaining reservation roomUSD0.20. Reserved overhead is not a measured charge; full external/account/invoice cost remains unknown. Real QA owner/data retained for audit; password/state/raw tokens stay in ignored data only.

## Located test/environment failures

Browser locator initially omitted the actual back-button arrow; fixed exact label, all13 passed. Actual Auth browser test initially asserted same-trip history while the UI defaults to route history; explicitly selecting the intended tab retained the original assertion, all4 passed. Initial clean build deadline240s expired while two builds ran concurrently; bounded480s diagnostics and isolated rebuild retain all original assertions. A later unit run lacked the project TEMP/TMP setup and failed sandbox transform cache ENOENT; restored project-contained TEMP/TMP and all151 passed. The null-price regression was first observed red and then passed after the narrow fix. These failures were located; no three consecutive unidentified failure and no counter reset.

Remaining gates: actual uninterrupted patched live path, real signup email delivery, party-inclusive/final fares, scoped baggage/weights, verified UTC semantics, live meeting/flexible batch coverage and exact total fees. Reference discovery may be tried locally; full-feature success is not claimed.
