# Frontend spec v0.1

Proposed: Next.js / TypeScript. Prototype is standalone HTML to review design; it does not use or certify Next.js.

## Pages and state
| Route | Purpose | Main state |
|---|---|---|
| `/` | aviation canvas landing | three entrances; theme; reduced motion |
| `/search` | fixed-date search | draft form vs submitted search; job status; results |
| `/itineraries/[id]` | itinerary and selected offer | fare selector; historical/date-price tabs; source/scope |
| `/meet` | rendezvous split screen | shared destination/day; independent A/B conditions; lock selection |
| `/flex` | departure/return ranges | ranges; nights; grid; verified coverage; top five |

URL shareable filters exclude provider token, secrets and returned quote data. Preserve old submitted results until new query starts; invalidate old data relevance visibly when form changes. Browser refresh reloads job by opaque job_id. Cached time shown separately from request time.

Components: AirportCombobox, DateRangeField, CabinSelect, BaggagePicker, SearchSummary, JobProgress, FareCard, SegmentTimeline, FareComparison, SignalBadge, HistoricalChart, CalendarPriceGrid, CoverageNotice, PairCard, Alternatives, ErrorPanel.

Input accessibility: semantic labels, field-level errors, keyboard airport option navigation; dates native picker plus readable text; baggage counts bounded by provider capability with unsupported explanations. Main form includes passenger count and currency. Mixed cabin/self-transfer are explicit advanced options.

## Presentation semantics
Price primary shows **party total**, currency and coverage. Per-person secondary only when calculable, not provider price divided blindly for unequal passengers. Rows show roundtrip versus single; confirmed / estimated / unknown textual chips. Fare card default cheapest qualifying offer per itinerary; expansion lists alternatives.

Signal labels 偏低 / 正常 / 偏高 / 数据不足；explain baseline and dated sample. Provider insights labeled source and route/search scope. Charts have table alternative and missing gaps. Neighboring-date grid highlights selected date and minimum candidate without green-buy-now language.

Split desktop ≥1100px uses two aligned panels with shared destination and recommendation band. 760–1099px narrower paired cards; <760px A/B tabs plus persistent selected pair summary, no unreadable squeezed half screens.

## API interaction
POST search/meet/flex returns 202 job_id; poll GET job every 2s initially, back off to 5–10s. Abort polling on navigation/unmount; cancellation is separate backend request. No automatic provider refresh on every keystroke. Clicking details retrieves result data; booking enrichment is explicit if extra cost or not yet in budget.

Error codes map to user messages: missing_credentials→“尚未连接数据源”；quota_exceeded→“查询额度不足”；unsupported_baggage→“该来源无法确认所需行李”；partial→“部分日期/航班尚未验证”；provider_schema_changed→“来源格式变化”；empty is only genuine valid empty response.

Avoid sending external booking URLs directly from browser input. Server validates provider allowlisted HTTPS URL; open new tab with noopener/noreferrer, no programmatic ticket purchase.

## QA handoff
Component tests cover labels/state/unknown prices. E2E fixtures cover A1–A11 and A13–A15. Visual viewport checks 1440/1024/390; no horizontal page overflow, keyboard focus, long airline names, translated errors, multi-day flight labels. Live provider checks separate, credentials never embedded in client bundle or public env prefix.

## Cockpit design update

2026-10-12: [visual and motion direction](../design/cockpit-direction.md), [current browser verification](../qa/cockpit-verification.md). ECharts 5.6.0 is vendored only for this prototype. Production framework remains a recommendation, not a final decision.
