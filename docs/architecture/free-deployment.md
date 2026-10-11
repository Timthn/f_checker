# Free deployment recommendation

Reviewed 2026-10-12. Design only: no accounts created, resources deployed or subscriptions purchased. Prices/eligibility must be checked again before deployment.

## Updated TypeScript option

User asked about frontend/backend sharing Vercel. The prepared goal now proposes Next.js/TypeScript full-stack on one Vercel project, with Supabase and Apify remaining external. See [vercel-fullstack-option.md](vercel-fullstack-option.md) for Function/Workflow/Cron limits and no-duplicate-charge semantics. No Render account required for that option. It is a recommendation pending user invocation, not a deployment.

## Earlier Python personal demo alternative

| Component | Suggested free service | Important boundary |
|---|---|---|
| Next.js frontend | Vercel Hobby | Personal, non-commercial use only; usage limits apply. |
| FastAPI and job processor | One Render Free web service | Demo profile only; supervised worker alongside API, not an independently provisioned worker. |
| PostgreSQL and Auth | Supabase Free | 500MB database, inactivity pause after one week, no automatic backups. |
| Flight data | SearchApi signup trial initially | 100 trial requests advertised; account eligibility and actual consumed units require verification. |

Vercel Hobby generally pauses exhausted features rather than providing unrestricted usage. Its function runtime is not our durable Python worker host. [Official Hobby plan](https://vercel.com/docs/plans/hobby).

Render Free sleeps after 15 minutes without inbound traffic; waking can take about a minute. Its filesystem is ephemeral and the workspace shares 750 free instance hours per month. Free services may restart or be suspended for heavy outbound traffic. Bandwidth/build overages can bill a payment method or suspend service without one. Dedicated background workers are outside this free profile. Do not use Render's temporary free Postgres for permanent history. [Official free-service limits](https://render.com/docs/free).

Supabase stores durable jobs and observations despite API sleep; its own inactivity pause and capacity limits still apply. Keep encrypted exports and rehearse restore; do not equate a free database with guaranteed availability. [Official pricing](https://supabase.com/pricing).

## Required architecture adjustment

Two explicit deployment profiles share the same business logic and database schema:

- `local` / future persistent hosting: API and separate Python worker. Reliable scheduled sampling requires a continuously available worker and database; select and price that separately when needed.
- `free_demo`: a single API instance starts one supervised worker loop. PostgreSQL leases, durable dispatch ledger and checkpoints remain mandatory. Shutdown stops claiming jobs, attempts a bounded graceful drain, and leaves uncertain calls for reconciliation. A process restart must not resend an uncertain paid request. This is not FastAPI fire-and-forget BackgroundTasks.

While awake, real job polling can report progress. Sleep/restart suspends work; the next genuine visit wakes the service and recovery resumes eligible checkpoints. No fake keep-alive traffic. UI states in both languages: “服务唤醒中 / Waking service”, “等待服务恢复 / Waiting for service”, partial results and last observation time. Client timeout must not imply provider failure or trigger a new paid search. Keep the original idempotency key/job ID.

Autonomous price monitoring is OFF in the free demo. No promise of daily observations or 24/7 monitoring; missing history stays missing. A later paid persistent worker can reuse the schema. Browser queries remain authenticated with owner quotas, even for a personal deployment.

## Alternatives and tradeoffs

| Alternative | Suitable use | Tradeoff |
|---|---|---|
| Cloudflare Pages Free | Current static prototype; future Next.js static export if explicitly designed that way | 500 builds/month. Static export cannot provide Next.js server features; Functions have separate Workers limits. Full Next.js hosting needs a separate compatibility evaluation. |
| Local API/worker + Supabase Free | Development and controlled provider validation | No API hosting bill; remote friends cannot reliably use a laptop service, and sampling stops when it is off. |
| Next.js full-stack instead of Python | Potentially fewer deployed services with a pure HTTP provider | Requires changing backend/worker design; serverless timeouts and durable orchestration still need resolution. Free hosting alone is not a reason to discard the Python preference. |

[Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/). The current prototype can be hosted statically without flight credentials, but its mock data must remain labeled.

## Accounts, keys and cost gate

For later deployment: Vercel + Render + Supabase accounts and GitHub repository authorization scoped to `Timthn/f_checker`. Use provider dashboards/Git integration initially; no deployment API token is needed for this design phase. Use supplied subdomains to avoid buying a domain. Signup verification or card requirements can depend on the account; do not promise no-card eligibility.

Check that each selected plan is Free/Hobby, inspect existing account-wide usage and billing settings, avoid paid add-ons/automatic upgrades, and set supported spending controls. The application call cap does not cap platform billing. Keep secrets only in backend/worker environment settings; frontend gets only the public Supabase URL/publishable key and API URL. Configure exact CORS origins and Auth redirect allowlist after URLs exist.

Hosting can start at USD0 within free allowances; flight data is a separate budget. SearchApi advertises 100 signup requests and USD40/month for its 10,000-request Developer plan after trial. This is not unlimited free flight search or USD4 pay-as-you-go. [SearchApi pricing](https://www.searchapi.io/pricing).

Deployment acceptance, when authorized: cold wake and restart recovery, two-user isolation, HTTPS/CORS/Auth redirects, no secrets in frontend bundles, uncertain-call recovery without duplicate dispatch, quota exhaustion UX, database export/restore, and mobile bilingual critical flows. None of these cloud checks have been executed in this document phase.
