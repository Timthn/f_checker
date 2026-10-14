# Separate traveler quotes and departure-centered calendar

## Scope

Direct user feedback authorizes this scoped continuation. Preserve historical rounds and reservations; no deployment, booking, new dependency, schema migration or paid provider test. Cost controls remain server-side and usage stays in the dedicated usage page. The latest instruction prioritizes functionality, not a budget reset or unlimited dispatch.

Flexible two-person queries use independent adults1 A/B preferences; identical requests deduplicate. Only complete identical schedules/cabins/currencies combine. The total sums independent A/B quotes once and does not guarantee group availability. Default carry-on1/checked0 are requested filters; each person's returned inclusion evidence is shown separately, with missing/contradictory evidence unknown.

Details now offer an explicit calendar request centered on selected departure, up to30 days each side. Return date stays fixed. It uses one calendar-mode Actor run, not61 full fare verifications, a full round-trip matrix or the selected flight's historical price. Missing days remain gaps; source/capture time and stale/unknown labels are distinct. Existing source price history and its mean remain separate.

## Verification

- Node24.19, unchanged locked dependencies. Full unit/API/adapter/SSR/mock suite238/238 across33 files; TypeScript passes.
- Production Webpack build passes with28 registered steps/3 workflows. `node tools/check-calendar-build.cjs` verifies all five calendar step IDs, workflow ID and runtime import.
- `node tools/calendar-connection-check.cjs` passes using actual restricted fc_api/fc_worker connections in the sole authorized database: owner-scoped dates insert/read, foreign-job RLS denial, worker calendar write, safe timestamps, denied private checkpoint access. All synthetic rows rolled back; provider requests0.
- Independent read-only review closed queued-resume and stale-calendar P2s, then reviewed final registry/input/display/count changes: no remaining actionable P1/P2.
- Current UI browser/E2E and real A/B/calendar supplier acceptance are pending. Browser policy denied automatic local-page navigation/refresh; no alternate browser, headless or UI workaround was used. Oct13 browser results are historical.

## Located failures and fixes

Initial cached test expected the superseded uniform-max query. Legacy no-array compatibility test updated; independent separated-context tests exercise the new behavior.

Two migrator SET ROLE attempts failed42501. Located permission issue; no privileges widened. Actual restricted-role connections tested instead.

First production compile omitted calendar steps despite accepting its workflow. Installed Workflow builder's fast discovery missed inline use-step directives. Standalone directives now discover five steps; the guard rejects the old artifact and accepts the final build. A mock guard suite prevents this false-positive build acceptance. No source run was initiated during investigation.

Display fallback currency initially had an overly narrow query-currency union; it now accepts source Money currency strings. Paid query validity still uses the shared search schema, and combined A/B calendar contexts are rejected rather than guessing a source filter.

## Remaining limits

Source baggage inclusion, party price semantics, source timezone/DST semantics, actual61-day calendar coverage and broader multi-branch fares remain supplier-dependent. Stored price/display agreement is not independent airline confirmation. Failed SDK executions with ambiguous dispatched calls must retain their ledger; never blindly restart a paid run. No new calendar failure was observed through live execution in this scope.

Final-source incremental build in the prior fresh-installed isolated environment passes build/start/health/calendar unauth401 and registry guard;80 source files plus config/lock hashes agree, no credentials copied. This is not a new final-source npmci. No UI fetched from that server. Root preview health200. Secret scan45 changed files/45 client files reports zero matches; ledger cap5000000/reserved630000/calls12 unchanged. Git delivery evidence is indexed in progress after completion.
