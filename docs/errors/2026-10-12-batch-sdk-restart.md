# Batch SDK restart evidence — cycle03 round2

Actual Next.js / Workflow5.2 / Supabase Auth and SQL harness:
`tools/batch-workflow-recovery.cjs`. Supplier HTTP was replaced in an isolated
project-local clone with synthetic IO. No real Apify requests were made.

Preserved result:
`data/batch-workflow-recovery-result-4d0a95674dd14c93af4a3a63147c1e51.json`.
Build, real authentication, child checkpoint, parent durable wait and abrupt
restart were observed. Completion did not follow: `SDK_BATCH_COMPLETION_TIMEOUT`.
One child completed; another collect step remained running after restart.
Readonly database inspection found idle worker connections, no blocking PID;
this does not identify or exclude an SDK executor recovery defect.

The harness stopped its own server and performed scoped synthetic-record cleanup.
Result reports `reservations_restored:true`; subsequent authoritative database
query confirmed spike-lifetime cap500000, reserved270000, calls_reserved0.
Never reset the original budget or replay an ambiguous provider dispatch.

This is a failed recovery acceptance check, not a passing batch workflow test.
It used the pre-amendment isolated search/return/booking fixture flow. The current
application amendment removes booking dispatch, but does not establish crash
recovery. Preserve this failure and inspect supported SDK recovery behavior before
another run. A local durable executor or independent worker remains an allowed
alternative if SDK compatibility cannot be established. No deployment authorized.

Readonly follow-up of the installed SDK located a relevant timeout mismatch:
`@workflow/core/dist/runtime/constants.js` defaults inline ownership lease to
860 seconds. The preserved running child step started02:52:04.781 and the
harness stopped03:01:26, before that lease expired. Startup re-enqueues running
workflows with a new message identity; pending-step dispatch preserves existing
ownership until the lease expires. This explains why the current timeout is not
proof of permanent recovery failure. A revised bounded verifier must wait beyond
the ownership lease or use a supported, explicitly isolated QA lease configuration,
then prove completed checkpoints and no repeated POST. Neither has passed yet.
