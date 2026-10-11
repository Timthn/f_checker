# Cockpit prototype verification

2026-10-12. Scope: local HTML/CSS/JS design, not production frontend, application unit/integration tests or provider validation.

Executed `tools/cockpit-qa.cjs` with existing bundled Node/Playwright and installed Chromium. No application packages or browsers installed. Results: [cockpit-results.json](cockpit-results.json).

36 browser checks passed: three entrances; explicit demo status; ten ranked fares; 8-column/two-row layout; submitted versus draft filters; baggage and cabin price changes; selected-offer detail consistency; 48px detail band spacing; actual 30/7/61-point chart data; insufficient-history and date-series separation; hover readout; keyboard meeting slider; unknown/verified date selection; theme switching; loading/empty/error/partial/unknown/stale states; mobile overflow and traveler switch; reduced motion; zero runtime errors; no HTTP requests.

Desktop 1440×1080 and mobile 390×844 screenshots are under `screenshots/cockpit-*`. Visually reviewed landing, search, details, flexible dates and light theme. The heatmap palette was lightened after review so dark labels remain legible. Detail data table and flexible-date table support non-pointer inspection. This is targeted browser verification, not a claim of complete accessibility certification.

One test assertion repair: CSS `grid-column: span 8` is reported as `gridColumnStart`, not `gridColumnEnd`. The assertion was corrected and strengthened with actual row-height geometry; layout code was unchanged. No unexplained repeated failure. A subsequent visual repair adjusted heatmap animation duration and contrast and retained stale-signal state on page return.

Historical preflight checks target `prototype-v1.html`; their original results are retained separately. Current results are generated only by `tools/cockpit-qa.cjs`.

Limitations: all offers/history are fictional, Meet/Flex query windows are fixed examples, no API or booking flow, no persistence, theme transition falls back when unsupported. Public skill and ECharts retain their supplied licenses.
