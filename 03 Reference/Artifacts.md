---
tags: [reference]
---

# Artifacts

Where the five [[Documents|documents]] are precise and inspectable, artifacts are the fast, visual counterpart: one self-contained HTML file per stage, written to `.qsdlc/<feature-slug>/artifacts/`. Every artifact is produced by the [[qsdlc-present]] skill; stage skills decide what the artifact is for, and `qsdlc-present` decides how it is made.

## The five artifacts, plus dashboards

| File | Stage | Job | Archetype pool |
|---|---|---|---|
| `inspo.html` | [[1 - Plan]] | Confirm the vibe before design grounds it; evocative, not a spec | `moodfield`, `swiss-poster`, `broadsheet` |
| `design-pitch-deck.html` | [[2 - Design]] | Pitch the execution vision: problem, proposal, key flows, why this approach | `scrolly-spine`, `slide-stage`, `orbit-hub`, `compare-split` |
| `implementation-process-map.html` | [[3 - Build]] | Phases, dependencies, and hand-offs between skills and subagents | `subway-map`, `swimlane-timeline` |
| `performance-results.html` | [[4 - Test]] | Data first: pass and fail up front, failures below with evidence | `instrument-panel`, `ledger`, `case-file` |
| `release-notes.html` | [[5 - Deploy]] | Stakeholder-facing: what shipped, why it matters, honest scope | `broadsheet`, `anatomy`, `compare-split` |
| Factory dashboards, scorecards, triage and run reports | [[Continuous Factory]] | State, change since last run, action; readable across a room | `instrument-panel`, `ledger`, `case-file`, `ranked-board` |

For dashboards the data comes from a JSON file embedded in the page, and the layout comes from a pinned roll, so a nightly run changes numbers, not layout. The `.md` stays the source of truth and the HTML links back to it.

## Format convention

Every artifact is a **single self-contained HTML file**: no CDN scripts, no remote fonts, no network at view time. It must open from `file://`. Sources and build notes go in `artifacts/.craft/`. If the session has a live Artifact-publishing tool, a skill may additionally publish a copy for a shareable link, but the local file is written first and is the source of truth.

Non-negotiables: every statistic carries a `data-source`, invented examples are labeled illustrative, every chart has a table fallback, status is never conveyed by colour alone, the page keeps `:focus-visible` and honors `prefers-reduced-motion`, and it reads with JavaScript off. A claim goes no further than `eval.md` or the verified feature map proves.

## The six-step pipeline

`Inspect, Bind, Roll, Pitch, Build, Verify`. All commands run from the qsdlc repo against the target project; working files land in `artifacts/.craft/`.

| Step | Tool | What happens |
|---|---|---|
| Inspect | `scripts/brand_probe.mjs --root <project> --slug <slug>` | Reads the target project for design docs, token files, CSS variables, brand assets, type, and shape conventions (tiers A to F) and writes `brand-bind.json` with palette, theme, type, radius scale, rules, a contrast report, and recorded conflicts. Exit code 3 means no brand source was found: ask one question (neutral set, or a brand file). It never invents a palette |
| Bind | the probe's `rootBlock` | Product token names win; engine tokens (`--bg --surface --panel --line --ink --muted --hi --ok --alt --risk`) alias to them. Text-safe values are used where a document's own colour fails contrast. A `<meta name="brand-source">` records the source |
| Roll | `scripts/roll.mjs --kind <kind> --slug <slug>` | Deals structure only: one layout archetype, BI chart cards, motion devices, two finish cards, and one signature moment, from 57 cards in `assets/matrix/*.json`. Deterministic per `slug|kind|rollIndex`; `--pin` freezes the layout for recurring dashboards. The roll never sees colour or type |
| Pitch | `pitch.md` | Offers two or three directions, names the bet and its risk; an autonomous run picks the first and says so |
| Build | a skeleton from `assets/archetypes/` plus `scripts/inline.mjs` | Fills content into a token-only skeleton, then inlines the kit and diagram helper, and any [[html-motion]] engines |
| Verify | `scripts/lint.mjs` and `scripts/shoot.mjs` | Lint then screenshots, then the frames are opened and looked at |

Deal, never choose by taste: a seeded roll with rhythm rules gives variety, where "what feels right" converges on one look. Rhythm rules: at most one high-cost card, at most one decorative layer, one signature moment, and no card whose `avoid` list names one already dealt.

## Diagrams: `Diagram.layout`

Diagrams use `Diagram.layout(json)` from `assets/kit/diagram.js`: a layered DAG rendered to inline SVG with `role="img"`, a `<title>`, and a text fallback. It replaces the external Mermaid CDN that earlier versions fell back on. No external diagram library is needed. For specialized `sequence`, `erd`, `class`, `dataflow`, `lifecycle`, `tree`, `timeline`, or `waterfall` visuals, [[qsdlc-archify]] integrates [tt-a1i/archify](https://github.com/tt-a1i/archify) cleanly under `.qsdlc/<slug>/artifacts/.craft/archify/` (grounded via [[qsdlc-graphify]] when available), and its output must also pass lint. If `qsdlc-present` itself is unavailable, a stage skill writes plain static HTML with inline SVG and logs `presented-by: fallback`.

The everyday chart and motion kit is `assets/kit/kit.css` and `kit.js`: `Kit.reveal`, `Kit.draw`, `Kit.grow`, `Kit.count`, `Kit.flow`, `Kit.scrub`, and `Kit.chart.bar`, `stacked`, `strip`, `slope`, `spark`, `bullet`, `heatmap`, `waterfall`. Chart choice follows a relationship-to-form table (`references/bi-grammar.md`) based on the FT Visual Vocabulary categories.

## Creative inspiration atlas

`references/inspiration-atlas.md` lists where to look for *grammar* (how something is structured, what moves and why), never looks. Palette, fonts, imagery, and copy are never borrowed. At most three distilled references per artifact are kept in `refs.json`.

| Source | Good for |
|---|---|
| Awwwards | interaction and motion choreography, ambitious type |
| Godly (now recent.design) | experimental, type-forward layouts |
| Siteinspire | calm editorial and Swiss layouts |
| Mobbin | real product UI patterns: dashboards, changelogs, empty states |
| Dribbble | dashboard composition, KPI rows, chart styling |
| Behance | long case-study layouts, annual-report data pages |
| Pinterest | mood and composition; the fastest way to scan many looks |
| FT Visual Vocabulary, Observable Plot | which chart for which relationship; layered-marks mindset |
| Evidence.dev | report-page grammar: big values, sparklines, tables with inline bars |
| The Pudding, NYT Upshot, Bloomberg Graphics | scrollytelling, annotation on the chart |
| Codrops, CodePen | motion choreography recipes |

A search result gives titles and URLs, not pixels. Fetchability was measured on 2026-11-18: the Awwwards category pages are server-rendered and machine-readable; Pinterest and Dribbble are not fetchable and need a web search restricted to their domains; several others return 403 or 429 and need a browser tool. Query recipes are built only from archetype and grammar keywords plus the artifact kind. They never contain the feature name, a customer, or any text from `Intent.md` or `spec.md`; `roll.mjs` enforces this with a denylist and fails closed.

## Motion: `html-motion`

When a canvas or GPU move shows a fact the kit cannot, [[html-motion]] supplies nine self-contained engines (`streams`, `graph`, `expand`, `pullback`, `split`, `transform`, `morph`, `shader`, `terrain`), inlined into the page with `scripts/inline.mjs` or `inline_engines.mjs`. Motion has to map to a fact; at most one heavy animation runs at a time, reduced motion paints a complete still, and GPU engines fall back to a still gradient without WebGL. Freeze parameters shared by kit and engines: `?t=0..1` freezes every `drawAt` primitive, `?freeze=1` stops loops, `?fps=1` shows frame rate.

## Verification: `lint.mjs` and `shoot.mjs`

- `node scripts/lint.mjs <artifact>.html --brand <brand-bind.json> --claims` checks 16 codes: L01 external URLs, L02 reduced motion and no-JS visibility, L03 focus and clickable semantics, L04 painted body and token discipline, L05 palette drift, L06 radius scale and shadow, L07 gradient text, emoji, and purple-to-blue gradients, L08 SVG titles and chart fallbacks, L09 WCAG contrast, L10 overflow wrappers, L11 scroll-snap proximity, L12 document basics, L13 size budget, L14 data-source and illustrative labels, L15 overclaims (with `--claims`), L16 brand-source meta.
- `node scripts/shoot.mjs <artifact>.html --out <shots dir>` captures frames with Playwright (the only part of the pipeline that needs it), including mobile size, reduced motion, no-JS, and offline runs. The skill then requires the frames to be opened and looked at; a render that was not seen is not described.

Node 20 or newer; no `npm install` for the pipeline itself.

## See also

[[qsdlc-present]], [[html-motion]], [[Documents]], [[QSDLC]]
