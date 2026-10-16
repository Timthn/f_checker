# Flight rights and price signal feedback

This is the user's scoped continuation, including form persistence, removing the two requested explanatory paragraphs, renaming the baggage placeholder and improving the price signal. Prior Goal counters and real reservations remain unchanged.

- Persist only allowlisted editable search conditions per owner/guest; hydrate before writes or submission. Restoration does not submit a query. Legacy recovery requests remain immutable.
- Show source-provided aircraft, legroom and amenities under 航班权益. Baggage requests are not included rights. Missing passenger/segment allowances and weights remain unavailable; existing saved records may lack previously discarded optional metadata.
- Prefer the provider's low/typical/high label, with capture date. A valid tag can exist without a historical series. A missing label falls back to loaded date-price statistics, not an invented price category.
- Calculate mean and median from distinct valid positive-price dates within selected departure ±15 days. Exclude missing/conflicting dates, preserve gaps and show count. The original fixed-return route calendar supplies trip statistics; independently fetched one-way legs remain explicitly one-way. No sum of calendar legs creates a round-trip price.
- Chart switches, language and statistics callbacks do not create Actor runs. Calendar fetching remains an explicit action.
- Build a project-contained inactive preview directory while the current server remains running. Match FC_NEXT_DIST_DIR at build/start; local Workflow data lives separately. One local executor instance only.

Verification: 296 unit/mock tests in 41 files and TypeScript passed; staged production build and Workflow registration guard passed. Independent source review found no actionable P1/P2. Homepage/health returned 200 and unauthenticated search returned 401 after handoff. Browser automation was denied earlier; no alternate-browser workaround or new browser acceptance is claimed. No new Actor run was created; the interrupted known calendar was collected from its existing run, yielding 31 saved cells. Its original Windows rename EPERM cause is not proven resolved.
