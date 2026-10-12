# Personal dashboard: simple UI, truthful cost evidence

2026-10-12, cycle03 round3. User clarified personal use and asked to avoid
unnecessary complexity. Keep the four flight tasks and minimal existing Auth.
Do not add teams, subscriptions, shared workspaces, administration or accounting
screens. Cost evidence is a collapsed optional detail, using saved GET data only.
No expansion of budget, deployment or booking authority.

## Cost semantics

The per-operation USD0.01 overhead is a reserved allowance, not a measured cost
or an estimate derived from resource quantities. Public projection uses
`overhead_reserved_microusd`; `estimated_external_microusd` stays null without
quantity/rate evidence. Calls and remaining held slots share a read-only
repeatable-read transaction so an atomic slot transfer cannot understate either
reservation. Tiny historical ceilings bound their allowance; no retroactive
budget changes are made.

Run metadata retains fixed allowlisted usage quantities and included USD
components privately in existing append-only JSON evidence. Components already
included in `usageTotalUsd` are never added again. A changed component map cannot
be classified as a stable repeat. This adds no request or migration.

Official references checked2026-10-12:
[run schema](https://docs.apify.com/api/v2/actor-run-get) and
[monthly usage schema](https://docs.apify.com/api/v2/users-me-usage-monthly-get).
Monthly usage follows the supplier's billing cycle and contains account-wide
service costs; it is not a per-job invoice. Account-cycle attribution, post-run
storage/read measurement and final invoice evidence remain unverified. Do not
expose account-wide evidence to ordinary dashboard users or invent a query total.
Keep those limits in documentation rather than expanding the personal UI.

## Recovery validation

The prior verifier timed out before the installed SDK's default860s inline
ownership lease expired. The revised isolated verifier uses supported120s lease
and480s completion deadline, confirms its previous server exited, and checks four
unique search/return starts, original membership, stable fixture billing,
ID-only serialization and scoped cleanup. Production lease is unchanged.
Synthetic provider IO verifies orchestration only, never flight rights or live
costs. The previous failure remains in the error log. Final result must be read
before marking this gate passed.

Qualified result: new fixture-IO run8948852dbeb74b45b249e6a7c57f93c7 passed,
including three completed SDK executions, four unique starts/checkpoints and37
decoded safe steps. The120s isolated lease qualifies this result; no change to
production860s default. Original budget restored, real provider requests0.
