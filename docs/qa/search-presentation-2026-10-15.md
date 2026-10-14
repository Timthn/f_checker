# Find-flights correction

Direct feedback continuation after3a8c9a1. No booking/source request, deployment, budget reset or migration.

- Search lists up to10 unique outbound schedules sorted by safe positive source price; filled return date additionally shows up to10 returned paired return schedules. Submitted job query governs saved results, not edited draft.
- With return date, hero selects cheapest returned complete paired source quote; waiting if only outbound data exists. No outbound/return amount addition. Return-row money is labeled round-trip source reference, not separate return fare. Supplier party/fee/baggage scope remains unconfirmed. Return coverage is limited to source-selected outbound branch.
- Main nearby-date graphs display selected departure ±15days/31days. New explicit calendar queries window15; stored old30 requests retain frozen recovery body/key. Unavailable dates stay null. Route observed-history and its30day mean remain separately collapsed, never shifted into travel dates.
- Dashed guides connect observed nearby/calendar quote points with explicit bilingual missing-date explanation, no filled area/interpolated values. Default observed-history chart still disconnects gaps. Tooltip/table missing values stay unavailable.
- Baggage missing label means source did not supply inclusion allowance, not zero/free baggage. Terminal partial means returned quotes with unconfirmed details, not active automatic verification.

Initial review identified malformed price values could win sorting; positive safe integer/currency scale validation and regression added. A local edit helper failed a CRLF marker before saving; normalized line endings and replayed once. Builds were deliberately interrupted when fresh user feedback arrived; not failed source acceptance. Existing counters remain preserved.

Final tests/build/registry/review/health/secret/Git evidence in docs/progress.md. Automatic browser navigation remains policy-blocked; no alternate/headless workaround. User manual UI and live supplier acceptance remain pending.
