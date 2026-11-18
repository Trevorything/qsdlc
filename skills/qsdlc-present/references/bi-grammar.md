# BI grammar

Choose the **relationship** first, then the form. The relationships come from the FT Visual Vocabulary; the forms are what `Kit.chart.*` and `Diagram.layout` can draw. Every chart ships its own data table inside a `<details>` (the accessibility fallback), carries `data-source`, and takes its colours from tokens.

## Relationship → form → kit call

| Relationship (FT) | You want to show | Form | Kit call | Never |
|---|---|---|---|---|
| Part-to-whole | pass / fail / skip counts | proportional stacked bar, direct labels | `Kit.chart.stacked` | 3D or exploded pies |
| Magnitude | one headline count | oversized numeral, context delta, sparkline | `.numeral` + `Kit.chart.spark` | a count-up that hides the final value |
| Magnitude vs target | audit domain score against a bar | bullet chart | `Kit.chart.bullet` | gauge arcs (except one hero number) |
| Ranking | backlog by severity or score | ordered bars or lollipops, value at the end | `Kit.chart.bar` | radar for ranking |
| Deviation | before against after | slope chart with delta labels | `Kit.chart.slope` | dual axes |
| Change over time | per-metric trend across runs | small multiples, shared scale, last value labelled | `Kit.chart.spark` per series | more than six series on one plot |
| Change over time + magnitude | tests by runs | heatmap grid, glyph plus tone in each cell | `Kit.chart.heatmap` | colour-only status |
| Distribution | latency per request or run | dot strip with p50, p95, p99 ticks | `Kit.chart.strip` | mean-only bars |
| Part-to-whole / flow | score or scope delta | waterfall, each step labelled with its signed amount | `Kit.chart.waterfall` | cumulative-only lines |
| Flow / network | phase dependencies, hand-offs | layered directed graph | `Diagram.layout` | force-directed hairballs |

Spatial charts (maps) are out of scope for stage artifacts.

## Pipeline for a chart

1. Name the relationship in one phrase ("pass rate across the last five runs").
2. Pick the form from the table. If two fit, take the one that needs fewer words of explanation.
3. Put the data in `<script type="application/json" id="…">` and a `data-chart` block, or call `Kit.chart.svg(type, spec)` at build time. `inline.mjs --render` pre-renders `data-chart` blocks so they show with JavaScript off.
4. Label directly on the chart. A legend is a last resort.
5. Annotate the finding. The headline is the finding, not "Test results".
6. Write the `source` field: where each number comes from (`eval.md`, a command, a file). Illustrative data is labelled illustrative on the page.

## Rules that lint checks

- Every `<svg>` has `role="img"` and a `<title>` (or is `aria-hidden`) — L08.
- Every chart has a `<details>` table — L08.
- Status never relies on colour alone: a glyph or a word accompanies it — review by eye.
- Text on a chart passes 4.5:1 against the surface it sits on — L09.
- Numbers carry `data-source`; every `data-source` resolves to a key in the embedded JSON — L14.

## Report-page shape (Evidence-style)

A good data artifact reads as a short narrative: a headline sentence, a row of KPI values, then one chart per claim with its caveat beneath, then the failing items as a table with id, expected, actual and evidence. Pass/fail up front; detail below.
