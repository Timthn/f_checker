# Meeting batch stuck after child completion

The local parent Workflow advance step exhausted its configured retries with `timeout exceeded when trying to connect` from pg-pool. Both admitted child searches had already persisted partial results (86 and 85 offers) and successful source checkpoints; the durable parent still said running. A refresh previously read that stale parent without closing it. The exact transient connection-timeout cause is not proven resolved.

The original request also combined November 11 fixed departures with a December 25 arrival day. Returned local arrivals were November 11–13. Restoring the orchestration state cannot create a matching-date pair.

Fix: authenticated status GET calls exact-owner terminal-member reconciliation. It locks the parent and closes it only when every child is terminal; it never starts a Workflow, calls Apify or alters child evidence. Only held undispatched batch slots are released through existing ledger locking. Normal parent advancement also checks completed members before expiry. The result projection exposes observed arrival dates and an explicit mismatch notice.

Recovery used the production reconciliation function on the original request. Before: running; after: partial. Provider call/run/dataset records stayed byte-for-byte equal; new Actor runs: zero. No admission, budget reset, token replay or user date change. Ignored local helper: data/reconcile-original-meeting.cjs.

Verification: 300 unit/mock tests and TypeScript passed; three targeted real-database tests cover wrong-owner/no-op, repeated completion, expired completed parent and pending-member budget preservation. Temporary synthetic owners/rows were cleaned up by the existing suite. Final build/preview/review/delivery evidence is in docs/progress.md. The no-match notice is expected for this original request; a deliberately corrected new query is required for December 25 flights.
