# Readable quotes and personal usage — scoped QA

This user-directed continuation implements the consolidated feedback in ADR 0012. It does not reset earlier development rounds, provider reservations or calls, and does not complete the original broad Goal. No new paid Apify calls, deployment or booking were performed.

## Implemented acceptance mapping

| Feedback | Implementation | Evidence |
| --- | --- | --- |
| Airline names and readable clocks | flight-presentation / FlightJourney / adapter safe allowlist | price-context, readable-persistence, browser detail and meeting checks |
| Selected quote wording, not global cheapest | FlightDeck quote headings | dashboard browser checks |
| Departure-centered graph | owner-scoped bounded savedDeparturePrices, 61 days with null gaps | detail-read, price-context, real read-only integration |
| Route-history arithmetic mean | route-history-average with actual dated samples | price-context and browser private detail |
| Baggage allowance or explicit unavailable | QuoteBaggage with scoped evidence and official links | private detail browser check |
| A/B meeting inputs and readable recommendations | analysis-panels / MeetingPair | meeting-readable desktop/mobile checks |
| Concise flexible strategies without fee forms | LiveBatchPanel default 3/max 8 pairs, hidden internal guards | live-batch-ui and browser batch checks |
| Monthly calls and USD5 reference | authenticated GET usage / UsagePanel | usage unit tests, real read-only integration, browser logout isolation |
| Re-query after terminal batch | explicit Search again, fresh key with current conditions; uncertain requests retain old key | live-batch browser double-click/re-query assertions |

## Evidence recorded before final verification

- Original full unit run: 185/185; subsequently added three airline-directory cases, focused price-context 8/8.
- Actual Supabase read-only integration: 2/2, owner-scoped API detail and worker usage aggregate, foreign owner denied/zero. No database writes or provider calls.
- Production build succeeded, but subsequent chart fallback and usage banner changes require the final build recorded below.
- First browser pass identified incomplete mocked query currency/date causing chart exceptions and stale fee-control assertions. Source fallback corrected; assertions now reflect removed controls without relaxing safety assertions. Public sample rows wait for their observable API response. No unidentified test failed three consecutive times.
- Prior isolated dependency environment was freshly installed against the unchanged lockfile. Final-source revalidation is recorded separately; no second fresh install is implied.
- Explicit USD5 cap configuration preserved reservations 630000 microUSD and calls 12, call cap 40; no actual-account free balance or complete invoice is claimed. UTC budget month and HK usage month remain distinct.

## Final source verification

- `npm run build`: passed, including TypeScript, 23 durable steps / two workflows and 12 static pages. No production source changed after this final build.
- `npm test`: **195/195**, 24 files, single final full run. Project-local TEMP/TMP and pinned Node24 used.
- `npm run test:e2e`: **20/20**, single final full run, one Chromium worker, 1.6 minutes. Covers terminal re-query with edited conditions and fresh key, new-request 503 followed by identical recovery, double-click guards, separate A/B bags and normalized request values, language-only reads, private logout clearing, desktop/mobile no-overlap, source-local clocks and Usage.
- Previous browser attempt was 18/20: two known failures sought the removed “New live search · may incur charges” text. Updated only those locators to the current semantic catalog; repeated complete run passed. No assertion, timeout, uncertain-recovery or budget guard weakened.
- `node node_modules/vitest/vitest.mjs run --config vitest.readability.config.ts`: **2/2 actual read-only database checks**, repeated on final source. No test users, writes or provider IO.
- Independent review closed final schema, conservative bag mapping, single-person compatibility, re-query state/idempotency, chart fallbacks and Usage notices with no remaining actionable P1/P2. One speculative duplicate-key finding was withdrawn after checking the existing state reset; the added browser ambiguous-new-request test verifies it independently.
- Secret scan: 53 changed/untracked files and 42 client bundle files, **zero credential matches**. Sole-project ledger unchanged: cap5000000, reserved630000 microUSD, calls12. Git root/main/origin and diff whitespace checks passed.

Screenshots visually checked: `screenshots/meeting-readable-desktop.png`, `meeting-readable-mobile.png`, `flexible-baggage-readable.png`, `usage-readable.png`. They use synthetic/mock data, not live fare confirmation. Final preview is the production app on127.0.0.1:3000; old open pages need refreshing to load the new bundle.

## Isolated environment

Final sources/config were copied into the project's previously fresh-installed, unchanged-lockfile environment `data/clean-install-7a1ac377-40a0-4bfd-a398-dda770fe2c09`. Its final-source incremental build, TypeScript, start on a temporary local port, health, homepage and public preview all passed; 70 source hashes plus package/config hashes match the final tree. No `.env` or credentials were copied, live-provider mode was false, and the temporary server was stopped. This is final-source revalidation on an existing isolated clean installation, not a new full final-source `npm ci`. Safe ignored result: `data/clean-install-result.json`.

All scoped application checks are complete; final Git delivery follows. Supplier baggage/time/party pricing, global candidate coverage and account invoice/balance remain unconfirmed. No paid validation was substituted for mock checks.
