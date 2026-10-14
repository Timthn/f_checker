# ADR0013: Individual source quotes and bulk travel-date reference prices

Supersedes ADR0012's new two-person uniform-max source search; old saved requests/plans remain unchanged. A/B preferences are retained, but actual child source requests are each adults1 and their own bag counts. Same per-person requests deduplicate without changing A/B total semantics. Only identical complete flight schedules/cabins/currency can be summed into two-person flexible recommendations. This reference sum does not guarantee two seats, a single booking price or included rights.

Inputs default to carry-on1 / checked0; these are editable requested pieces, not returned fare entitlements or assumed kg. Show requested and included separately. Missing or contradictory returned evidence remains unavailable.

Calendar mode is already supported by pinned build0.0.2 and small live-derived fixture. One calendar run can request ±30 departure dates with a fixed return. It is route-level coarse current pricing, not the chosen flight's daily prices, price-observation history or a full departure×return matrix. Save only coarse/unknown cells; missing values remain gaps. Return actual coverage and context, never claim all61 points exist. Production calendar endpoints need manual real-source acceptance after fixture checks.

Use existing jobs.kind=dates and calendar_cells, separate calendar workflow/API, same durable lease/dispatch/read/cancel/usage guards. No new database schema, dependency or deployment. User says to focus on features rather than quota; no specific higher amount was authorized, so existing server hard ceilings remain. No automatic paid source call on locale, hover, details opening, chart zoom, GET polling or authentication changes.

Browser URL security policy denied automatic preview access Oct15. Preview service was restored and health200; user must refresh manually. Do not use another browser/CDP/automation as a workaround. New UI is verified with source/SSR tests and build until allowed browser/manual feedback is available.
