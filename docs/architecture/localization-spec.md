# Flight cheaker — bilingual contract

Confirmed 2026-10-12: product display name **Flight cheaker** (user spelling). Support Simplified Chinese and English across frontend and future backend-facing user messages. Repository, module and database identifiers stay unchanged.

## Current prototype

`docs/design/i18n.js` owns the local bilingual catalog, text/accessible-label translation and chart-option localization. The visible 中文 / EN control switches the entire interface, including options, statuses, validation messages, tooltips and chart labels. Explicit language selection persists locally when storage is available; storage failure never blocks browsing. Initial default is Chinese. UI language is independent of currency and trip data. Switching language preserves submitted query, selected offer, price and baggage values.

The prototype's DOM text mapping is a design convenience, not the proposed production localization architecture. All prices and observations remain fictional. No backend exists in this phase; the following sections are the implementation contract rather than a claim of completed API support.

## Production frontend

- Catalog keys are stable semantic IDs (`search.title`, `fare.total`, `errors.providerUnavailable`), maintained in paired `zh-Hans` and `en` catalogs. Both locales are required for every user-facing key. Choose a compatible localization library after the frontend stack is selected.
- English and Chinese cover landing, query fields, fare cards, itinerary, baggage, history/date charts, meeting/flexible-date results, empty/loading/error/stale/insufficient states, confirmations, accessibility labels and notifications.
- Locale precedence: explicit user setting, saved account/local setting, supported browser locale, default `zh-Hans`. Normalize `zh`, `zh-CN`, `zh-Hans` to `zh-Hans`; normalize `en-*` to `en`. Other languages fall back to `zh-Hans`. Traditional Chinese is a separate future catalog; do not label Simplified Chinese as Traditional.
- Use message interpolation/plural rules, not concatenated translated fragments. Example: `arrival.gap` accepts `minutes`; `search.candidates` accepts `count`. Missing translations fail the catalog completeness check; an unexpected runtime miss falls back to the default catalog with a diagnostic.
- Set HTML `lang`, localize ARIA and document titles, support longer English labels, and preserve layout down to 390px. Language switching must not resubmit a paid flight search.
- Use `Intl.NumberFormat`/`Intl.DateTimeFormat` for display. Always provide the ISO currency and itinerary/airport time zone explicitly. Locale does not change the price currency, amount, airport time zone or underlying UTC timestamp. Ambiguous dates have a readable format (e.g. 1 Nov 2026 / 2026年11月1日).

## Future backend / connector contract

- The canonical API remains language-neutral: money in integer minor units plus ISO currency; airport codes, offer IDs, cabin/baggage enums, UTC timestamps and IANA zones never translated.
- Accept a normalized `locale` field on requests that produce user-facing text, or `Accept-Language` when the field is omitted. Explicit field takes precedence. Store requested locale on asynchronous jobs for localized notifications; return the resolved locale in response metadata. Keep flight-history comparison keys independent of display locale.
- Errors expose stable `code`, safe `params`, optional `field`, `retryable`, and `request_id`. Frontend maps the code to its catalog. Backend emails/notifications use the same error/message IDs with server-side catalogs; never surface raw provider exceptions or credentials.
- Example error (design contract):

```json
{
  "error": {
    "code": "SEARCH_PROVIDER_UNAVAILABLE",
    "params": {"retry_after_seconds": 30},
    "field": null,
    "retryable": true,
    "request_id": "demo-request-123"
  },
  "meta": {"locale": "en"}
}
```

- English message: “The flight source is temporarily unavailable. Try again in 30 seconds.” Chinese: “航班来源暂不可用，请在30秒后重试。”
- Airport/city labels use localized display names with IATA code retained. Carrier/provider brand names remain official names when no verified translation exists. Do not machine-translate fare conditions and imply they are authoritative; preserve source-language rights text and mark any translated assistance.
- Separate locale-specific display metadata caches from canonical fare results. Include locale in keys only for localized payloads. Locale switching does not create a new quote or change baggage verification status.

## Acceptance for future full-stack implementation

1. Catalog completeness, plural/interpolation and unknown-code fallback tests in both languages.
2. Same API request with `zh-Hans` versus `en` returns identical canonical price, rights and itinerary values.
3. Validation, unavailable-source, rate-limit, empty/partial and job-notification messages localize without exposing raw source exceptions.
4. Frontend locale changes preserve selections and incur no provider call; accessible labels, chart tooltips and mobile layout remain complete.
5. Document actual backend implementation and integration results when it exists. This phase verifies only the clickable prototype.
