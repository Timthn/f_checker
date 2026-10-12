# Source capability audit — build0.0.2

This audit uses the nine existing sanitized live-derived samples and current production source; it makes no new supplier request. Independent review: data_arch_review, cycle03 round2. Earlier spike reservationUSD0.27/capUSD0.50 remains unchanged.

## Why confirmed live recommendations remain unavailable

The adapter preserves `price_complete=false`, `quoted_adults=null`, `time_verified=false` and empty scoped baggage. The amended search/return flow reconstructs a selected journey but does not prove party-inclusive fare rights. Historical booking samples remain evidence only; production does not call booking. The meeting/flexible reducers correctly require those missing rights. Actor success, a token chain, or additional orchestration cannot establish them.

| Requirement | Existing evidence | Missing confirmation |
|---|---|---|
| Complete party price | Search/return echo adults; booking has seller price | Matched one/multiple-adult whole-journey total and mandatory charge scope |
| Airport civil timestamps | Naive segment times; HKG/NRT sample durations corroborate local-time inference | Publisher semantic contract, versioned airport IANA zones, DST/date-line consistency |
| Baggage | Aggregate counts, null checked counts, unscoped free text | Passenger/segment piece and weight entitlement/fee scope; contradictory requested/returned counts |
| Alternatives | Many search/return candidates and distinct tokens | Multiple bounded outbound/return branches with preserved context and declared coverage |
| Flexible matrix | Three departure cells at one return date | General double-date coverage and full price/rights verification |
| Final cost | Actor reported metadata and durable reservation/read ledger | Measured external operations/storage, account-period attribution and invoice evidence |

## Correctable application gaps

Supplier leg `duration_minutes` includes elapsed flight and connection time. Preserve valid positive safe-integer leg totals only when they are at least the sum of valid flying-segment durations; sum elapsed leg totals for a complete journey. Do not infer elapsed duration from naive clock subtraction. Missing/contradictory duration stays null. A reconstructed outbound+return candidate cannot inherit return-only duration; the private search continuation preserves validated outbound elapsed duration and combines it with validated return elapsed duration, otherwise null.

The calendar sample November11 contains `price:2289` and `display_price:HK$2,489`. Choosing either as a trusted price hides a source conflict. The adapter now produces unknown/null with `price_display_conflict`; the chart leaves a gap and displays the bilingual reason. Explicit recognized currency formats are compared in exact minor units; unrecognized display text produces unknown with `unreadable_display_price`, never arbitrary number extraction. Calendar prices still never become verified solely by parsing.

## Branch admission remains a design/implementation gap

One-way search now retains all compatible returned candidates. Round-trip search selects one usable cheapest preliminary outbound branch and retains all compatible returns for that selected branch. Other outbound alternatives cannot survive the single next-stage reference. A faithful expansion needs a private branch queue, stable branch operation keys, per-branch selected context, total reserved calls and explicit returned/selected/verified coverage. After the no-booking amendment, default arrival-window meeting reserves six search callsUSD0.18, within the currently remainingUSD0.23. Each round-trip query reserves search+returnUSD0.06. These are conservative ceilings, not a measured invoice. Multi-branch lookup must not evade the account/job ceilings by batching tokens or silently omitting dates. Current one-branch label remains accurate; no global minimum is claimed.

Product text describes optional requested weight while the direct development Goal insists on retaining scoped count/weight evidence. The runtime currently applies the stricter evidence gate. This audit does not authorize weakening that gate or inventing weights. A future product-contract amendment must reconcile requested-weight fields explicitly.

Publisher page reviewed2026-10-12: [Actor README](https://apify.com/scrapercompany/google-flights-scraper). It advertises total fares, bag filters and token chains, but does not resolve the sampled contradictory baggage, party scope, or naive-time semantic contract. Those claims remain weaker than the required live acceptance evidence.
