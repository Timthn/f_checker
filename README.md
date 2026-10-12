# Flight cheaker

Local bilingual flight dashboard using Next.js/TypeScript, Supabase and a gated Apify connector. Current limits and acceptance gaps: [application status](docs/architecture/application-status.md). Visual reference: [prototype](docs/design/prototype.html).

Requires Node24. Dependencies are project-local, pinned and locked. With Node24 on the current shell's PATH:

Build/dev use Next's supported Webpack mode: the local Turbopack Workflow loader failed to start its child process during round7. Webpack production compilation/typechecking passed; qualified actual SDK recovery later passed with synthetic IO and a120s isolated test lease; production860s lease and live recovery remain unproven.

```text
npm ci
npm run build
npm start
```

Open http://127.0.0.1:3000. Recorded samples work without provider calls. Private analysis uses the designated Supabase project. The separate reference-search switch permits explicit individual queries with unknown rights; full confirmed-feature mode stays disabled; LIVE_REFERENCE_BATCH_ENABLED separately permits explicit meeting/flexible reference batches.

Copy .env.example to ignored .env and configure public Supabase URL/publishable key plus restricted API/worker PostgreSQL URLs. Setup credentials belong only in ignored .env.migration, copied from .env.migration.example. Never put admin DB credentials or Apify token in browser variables. TLS uses config/supabase-ca.crt; do not disable certificate validation. No deployment is authorized.

```text
npm test
npm run typecheck
npx vitest run --config vitest.integration.config.ts tests/jobs.integration.ts
npx vitest run --config vitest.batch.config.ts
npx vitest run --config vitest.auth.config.ts
npm run test:e2e
```

Integration tests use temporary QA rows in the sole named development database, require local migration credentials and never invoke Apify. E2E requires the running production server and FC_CHROMIUM_PATH pointing at existing Chromium. On this Windows environment, use project-contained TEMP/TMP for tests and the bundled Node24.19.0 runtime; commands/evidence are indexed in AGENTS.md and docs/progress.md.

Run database suites serially. The dedicated Auth suite uses real temporary Supabase users, real API requests and browser password login, with synthetic fare fixtures and cleanup. Local Workflow recovery evidence is in [ADR0003](docs/decisions/0003-local-workflow-and-free-account.md); its fixture-IO harness is `node tools/workflow-recovery.cjs`. It reserves and safely refunds only proven synthetic runs in the designated development database. Keep local world files across a restart. This executor is for one local development instance; no distributed hosting or live supplier capability is established by the harness.

Migration history is owned only by the local Supabase CLI; tools/supabase-cli.cjs enforces the authorized project pooler. Do not substitute MCP DDL, reset budgets or run against another database. Boundaries and stop rules: [harness contract](docs/harness-contract.md).

## Personal preview

For Meet together / Flexible dates, fill both travelers or both date ranges, inspect the planned query/call/ceiling preview, then press Request live batch. Fixed-departure meeting normally uses two queries; arrival-window explicitly expands coverage. Flexible offers bounded heuristic or exhaustive dates: first query samples uniformly, later explicit queries can explore fresh owned quote neighbors. Every selected date pair is preserved; an oversized selected plan is rejected, never silently narrowed. Refresh only reads the original batch. Separate reference recommendations use source amounts and assumed destination-local clocks; confirmed rights remain separately unknown. Expand returned quotes to inspect source amounts, capture times and price-field agreement. One outbound branch per round-trip pair, not global coverage. Full invoice verification is outside the latest user scope; source-field agreement is not an independent Google/airline quote or booking guarantee. Current lifetime validation reservationUSD0.54/USD0.54 after the explicitly approved two-date real test; larger new plans are blocked unless the user authorizes a budget change. The conservative budget remainder is now USD0.00; further paid queries require explicit additional budget approval. Two real November10/11→November17 date pairs returned source references of HKD2,289 each; details in docs/qa/multi-date-live-2026-10-12.md.

Open http://127.0.0.1:3000 while the server is running. Public recorded samples need no login and make no paid queries. Try the three entries and 中文/English controls; sample amounts are not current market prices. Source candidate disclosure is available for private saved batch results, not public sample batches.

Use Sign in → No account? Create one to register your own email/password. The designated project requires email confirmation before password login. Credentials are entered directly in the browser, never sent to the coding agent. Login protects private jobs/results and query permissions. Then select Find flights, fill airport/date/cabin/adults/bags and press Search candidates. LIVE_REFERENCE_SEARCH_ENABLED=true in the ignored local environment enables individual discovery; LIVE_REFERENCE_BATCH_ENABLED=true enables explicit meeting/flexible reference batches; LIVE_PROVIDER_ENABLED=false does not promote their unknown rights. No booking or deployment.

Returned quotes appear as a bounded snapshot of up to10 candidates, not confirmed cheapest fares. Party total, baggage and UTC evidence remain unverified. Read-only progress polling, details, language and chart interactions do not create paid runs. Duplicate pending clicks restore the same job; ambiguous admission retains its frozen request/key. A deliberate new query after a definitive terminal state uses a new key and may incur costs. Cancellation prevents new dispatch, but cannot undo an already billed upstream run.

Full original acceptance remains incomplete; historical cycle03 stopped5/5. User explicitly authorized this one scoped live-reference/signup continuation without resetting previous counters or budgets. See docs/decisions/0009-user-triggered-reference-search.md. The old8765/8766 prototype is a design reference; use the3000 application for actual queries.

History/billing DB tests use `npx vitest run --config vitest.evidence.config.ts`. Batch restart harness: `node tools/batch-workflow-recovery.cjs`, actual SDK with synthetic supplier IO and temporary QA rows. Run DB suites serially. Its recorded isolated120s lease pass is not proof of production860s or live supplier recovery.

Explicit live smoke: `FC_EXPLICIT_LIVE_CHECK=1 node tools/live-reference-smoke.cjs` (set the environment flag in the shell first on Windows). This is a paid, bounded one-way verification, not an automatic test. It preserves an ignored secret QA state, recovers only its existing job after interruption and retains real reservations/evidence. Never delete its state to force another run or refund it as synthetic. Normal tests do not invoke Apify.
