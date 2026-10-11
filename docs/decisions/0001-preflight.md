# ADR 0001 — Preflight recommendations and boundaries

2026-10-11；status proposed unless marked confirmed。

| Decision | Status | Reason / impact |
|---|---|---|
| Only Timthn/f_checker remote | user-confirmed | no writes/push to other repo |
| History and neighboring travel dates separate | user-confirmed | prevent mixing observation vs travel date |
| Local projects/f_checker directory | agent-proposed, disclosed | isolated empty repository checkout |
| Next.js + FastAPI | proposed | dashboard UX plus Python backend; dual runtime tradeoff |
| SQLite local, cloud undecided | proposed | no early cloud credentials; future migration needed |
| Direct SearchApi first spike | proposed, live pending | strongest documented baggage/calendar fit |
| Apify/SerpApi alternative adapters | proposed | fallback choice after evidence, not concurrent paid subscriptions |
| Own comparable snapshots | proposed | cannot depend on provider route history for flight-specific signal |
| No actual queries/deployment in preflight | confirmed goal scope | no provider tokens needed now |
| Hard query budgets, no automatic monitoring initially | proposed | avoid surprise spend |

Revisit after provider live spike and user design review. Implementation decisions must update this ADR (or add next ADR), corresponding specs and AGENTS index.
