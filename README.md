# Flight cheaker

Local bilingual flight dashboard using Next.js/TypeScript, Supabase and a gated Apify connector. Current limits and acceptance gaps: [application status](docs/architecture/application-status.md). Visual reference: [prototype](docs/design/prototype.html).

Requires Node24. Dependencies are project-local, pinned and locked. With Node24 on the current shell's PATH:

Build/dev use Next's supported Webpack mode: the local Turbopack Workflow loader failed to start its child process during round7. Webpack production compilation/typechecking passed; this does not prove actual durable Workflow recovery.

```text
npm ci
npm run build
npm start
```

Open http://127.0.0.1:3000. The recorded-sample preview works without provider calls. Authenticated cached analysis uses the designated Supabase project. Live provider execution remains disabled while cost/source/workflow gates are incomplete.

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
