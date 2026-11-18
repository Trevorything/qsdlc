# Inspiration atlas

Where to look, what each source is good for, and whether an agent can actually read it. **A search result gives titles and URLs, not pixels.** An agent can only see a Pinterest or Dribbble image through a browser tool.

Use sources for *grammar* (how something is structured, what moves and why), never for looks. Distil each reference to one sentence. Never borrow palette, fonts, imagery or copy.

## What each source is for

| Source | Best for | Feeds |
|---|---|---|
| Awwwards (`/websites/<category>/`, `/sites/<slug>`) | interaction and motion choreography, ambitious type | inspo, pitch, release notes |
| Godly, now `recent.design` | experimental and type-forward layouts | inspo, pitch |
| Siteinspire | calm editorial and Swiss layouts, filter by style, type, subject | release notes, report pages |
| Mobbin | real product UI patterns: dashboards, onboarding, changelogs, empty states | dashboards, results, release notes |
| Dribbble (`/tags/data-visualization`, `/tags/data-dashboard`) | dashboard composition, KPI rows, chart styling | results, dashboards |
| Behance | long case-study layouts, annual-report data pages | pitch, release notes |
| Pinterest | mood and composition; the fastest way to scan many looks | inspo |
| FT Visual Vocabulary | which chart for which relationship (nine categories) | every data artifact |
| Observable Plot | grammar-of-graphics mindset: scales plus layered marks, small multiples by faceting | all data artifacts |
| Evidence.dev ("Business Intelligence as Code") | report-page grammar: big values, sparklines, tables with inline bars, small multiples inside a narrative | results, scorecards, triage reports |
| The Pudding, NYT Upshot, Bloomberg Graphics | scrollytelling, annotation on the chart, "the headline is the finding" | pitch, process map, release notes |
| Codrops, CodePen | motion choreography recipes: scroll-driven, SVG path draw, stagger, FLIP | any motion device |

FT Visual Vocabulary categories: Deviation, Correlation, Ranking, Distribution, Change over time, Part-to-whole, Magnitude, Spatial, Flow. See `bi-grammar.md` for how they map onto the kit.

## Fetchability

Measured 2026-11-18 with plain `curl -L` and a generic user agent. Sites change; re-verify when a recipe starts failing. A verified status code and page shape is not the same as verified content richness.

| Site | Result | Programmatic use |
|---|---|---|
| `awwwards.com/websites/data-visualization/`, `/websites/dashboard/` | 200, server-rendered, `/sites/<slug>` links and `og:title` / `og:image` present | **Yes.** Best machine-readable gallery. |
| `godly.website` | redirects to `recent.design`; single-page app, no static listing | Name only. Use a browser tool. |
| `evidence.dev`, `pudding.cool`, `ft-interactive.github.io/visual-vocabulary` | 200 | **Yes** for text and structure. Pudding links are built by script, so find stories with `WebSearch`. |
| `mobbin.com` | 200 on the landing page only; screens are login-gated | Landing only. Its screen taxonomy is unverified; check the site's own filters. |
| `pinterest.com/search/pins/` | 200 but a script shell with no pin data | **No** by fetch. `WebSearch` with `allowed_domains: ["pinterest.com"]` returns board titles and URLs. |
| `dribbble.com/search/…` | 202 (challenge) | No by fetch. `WebSearch` with `allowed_domains: ["dribbble.com","behance.net"]` returns tag and shot URLs. |
| `behance.net`, `tympanus.net`, `codepen.io`, `nytimes.com`, `bloomberg.com`, `reddit.com` | 403 | No by fetch. A human or browser tool can open them; `WebSearch` can surface titles. |
| `siteinspire.com`, `observablehq.com` | 429 (rate-limited) | Retry later or use a browser tool. |

`roll.mjs --queries` lists `fetchable` and `nameOnly` hosts so the live step respects this table.

## Privacy-safe query recipes

Rule: queries are built **only** from archetype and grammar keywords plus the artifact kind. They never contain the feature name, a customer or org, or any text from `Intent.md` or `spec.md`. `roll.mjs` enforces this with a denylist and fails closed.

| Kind | Pinterest / Dribbble / Behance queries | Awwwards category | Grammar sources |
|---|---|---|---|
| `inspo` | editorial type poster · swiss grid typography · mood board texture layout · scrollytelling opener | typography, scroll, storytelling | Pudding openers, recent.design |
| `design-pitch-deck` | pitch deck editorial layout · product vision case study layout · before after comparison layout · architecture diagram aesthetic | business, portfolio | NYT and Pudding scrolly spines |
| `implementation-process-map` | subway map diagram design · technical blueprint diagram · swimlane process infographic · dependency graph ui | `/websites/data-visualization/` | FT flow and network |
| `performance-results` | bullet chart dashboard · small multiples dashboard · test results report design · distribution dot strip chart | `/websites/dashboard/` | Evidence.dev components, FT distribution and deviation |
| `release-notes` | changelog page design · release notes editorial · annotated screenshot callouts · product update newsletter layout | business, SaaS | Siteinspire, Behance case studies |
| `dashboard` | ops dashboard small multiples · audit scorecard ui · triage board design · executive kpi one page | `/websites/dashboard/` | Evidence.dev, Mobbin dashboards |

Site-restricted variants for `WebSearch`: `"<keyword> site:pudding.cool"`, `"<keyword> awwwards site of the day"`, `"chart-doctor visual vocabulary <relationship>"`.

## What to write down

For each reference you actually used, one entry in `refs.json`:

```json
{ "url": "…", "title": "…", "host": "…", "retrieved": "YYYY-MM-DD",
  "borrowed": "annotation sits on the chart; the headline is the finding",
  "neverBorrowed": ["palette", "type", "imagery"] }
```

At most three per artifact. List them in the artifact's HTML comment header.
