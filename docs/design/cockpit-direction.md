# F Checker cockpit design direction

2026-10-12. User-approved brief; reviewable prototype, not a production frontend.

## References and interpretation

The three user-supplied screenshots show (1) an 8/4 dashboard with one warm dominant card and quiet dark supporting cards, (2) full-width analytical bands, and (3) a photographic canvas with floating panels. The linked video could not be read; no motion or visual details are claimed from it. Reference screenshots are user-provided design inspiration, not copied product assets.

Public design guidance: [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design), installed in [.agents/skills/frontend-design](../../.agents/skills/frontend-design/SKILL.md). Preserve its license. Chart runtime: Apache ECharts 5.6.0, vendored with license under `vendor/` for offline inspection. This choice applies only to the prototype; production framework remains undecided.

## Tokens

| Name | Value | Role |
|---|---|---|
| Airspace | #08191d | Main canvas and navigation |
| Instrument | #132a2e | Secondary cards |
| Mist | #e5efec | Primary text and light detail surface |
| Ice | #b6dedd | Graphs, route markers, selected controls |
| Apricot | #efb580 | Recommended flight emphasis |
| Butter | #f6e5ab | Warm main card endpoint |

Bahnschrift for large airport codes, prices and headings; Segoe UI / Microsoft YaHei for body text. Tabular numbers for price comparison. One dominant color field, with subordinate surfaces using thin separation and lower contrast. Text below 80 characters per line where practical. Visible keyboard focus, readable data labels, reduced-motion support.

## Layout

Landing: aircraft route diagram as the canvas; left-aligned slogan; three asymmetrically placed floating panels are actual module entry buttons. Radar rings represent navigation decoration, never a fabricated metric.

```text
brand             pill navigation                demo
┌────────────────── route canvas ─────────────────────┐
│ Find your fare.                    [meet entrance]   │
│ Meet your people.          aircraft / route rings    │
│ [fixed-date entrance]             [flex entrance]    │
└─────────────────────────────────────────────────────┘
```

Search: a 12-column grid with a warm recommended flight and large labeled trend spanning eight columns and two rows. Four-column quiet cards on the right show signal and baggage. Below: date context, sampling and selected comparison controls, followed by the ten candidate rows. Left align labels and routes; right align prices.

```text
query controls across 12 columns
┌────────── 8 columns ──────────┬──── 4 columns ────┐
│ recommended flight           │ price context     │
│ price + large history chart  ├───────────────────┤
│                              │ baggage & fare    │
├──────────┬───────────────────┴────────┬──────────┤
│ duration │ travel date context        │ samples  │
└──────────┴────────────────────────────┴──────────┘
ten comparable offers
```

Details: three full-width bands: overview, trend, itinerary/fare details. Exactly 48px vertical grid gap on desktop. Light analytical content within a dark aviation shell, drawing from screenshot 2. The chart dominates the middle band. Historical observations and neighboring departure dates have distinct titles, axes, summaries and signal handling.

Meet: two equally weighted travelers above jointly ranked combinations. Flexible dates: a large interactive price heatmap with an equivalent keyboard-accessible table, plus coverage and selected-pair details.

## Brief review before build

Revised the initial all-dark cockpit proposal after seeing the references: the main search card is warm apricot/butter, detail bands are pale, and the landing uses route geometry rather than a generic metrics hero. No unrelated radar score, decorative gauges, or automatic looping sweeps. The aviation identity comes from airport typography, a plane plan view, route arcs and local-time labeling. ECharts interaction includes tooltips, zoom, history/date switching and selected-flight updates. All numbers are explicitly fictional; runtime interaction does not imply live data.

## Verification targets

- Landing has three functional entrances; selected navigation and browser hash agree.
- Desktop main card spans 8 of 12 columns and two rows; detail band gaps are 48px.
- Ten demo fares change with cabin/baggage and selected fare drives details and history.
- History and date-price series remain separate; inadequate history hides the signal.
- Meeting threshold filters combinations; flexible cells keep unknown status explicit.
- Desktop/mobile screenshots, no horizontal page overflow, no JS errors, no external runtime requests, keyboard-visible controls.

## Interaction refinement and execution

用户教程补充：只在需要时反馈。导航底色跟随指针/焦点；入口从箭头扩散换色；磁吸位移不超过4px；会合滑杆吸附15/30/60/120分钟；图表暴露日期/币种/系列口径、指针读数、缩放及数据表。主题切换从按钮圆形扩散，不支持时即时切换。

滚动背景速度0.18，飞机反向补偿，前景更慢；背景模糊上限2.5px。只模糊装饰，不模糊价格/文字/控件。窄屏和减少动态效果模式移除非必要动效。不把产品介绍的长篇钉住叙事或图片跟随预览强加到密集比价流程。

用户随后要求不用Superpowers、直接创意执行。以可审阅原型为交付，未继续调用Superpowers工作流。
