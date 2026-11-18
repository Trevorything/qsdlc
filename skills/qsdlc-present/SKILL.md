---
name: qsdlc-present
description: Craft the HTML for QSDLC stage artifacts (inspo, design pitch deck, implementation process map, performance results, release notes) and factory BI dashboards, presentations, scorecards and triage reports, bound to the target product's own brand and checked by a linter and real screenshots. Use whenever a QSDLC stage skill needs to write or improve an artifact, or the user asks for a good-looking HTML report, dashboard, visualization, pitch or release page, or says "make this artifact better", "bind this to our brand", "BI view", "stage artifact", even if they never mention QSDLC.
---

# qsdlc-present

The craft layer for every HTML artifact QSDLC produces. Stage skills say *what* the artifact is for; this skill says *how* to make it good, on-brand, honest and verified.

One pipeline, six steps:

```
Inspect → Bind → Roll → Pitch → Build → Verify
(repo)    (tokens) (structure) (2-3 ideas) (kit+engines) (lint+shots)
```

Brand comes before any creative roll. The roll deals **structure** (layout, BI grammar, motion, finish, signature) and never sees colour or type. Deal, never choose by taste: a seeded roll with rhythm rules gives variety, while "what feels right" converges on one look.

## Use it

Paths are relative to this skill (`skills/qsdlc-present/`). Node 20 or newer; no npm install; Playwright only for screenshots.

```
S=skills/qsdlc-present/scripts
node $S/brand_probe.mjs --root <project> --slug <slug>                   # Inspect + Bind
node $S/roll.mjs --kind <kind> --slug <slug> --has <data> --prev <id>    # Roll
cp skills/qsdlc-present/assets/archetypes/<skeleton> <artifact>.html      # Build (fill content)
node $S/inline.mjs <artifact>.html kit diagram [engine...] --render
node $S/lint.mjs <artifact>.html --brand <brand-bind.json> --claims      # Verify
node $S/shoot.mjs <artifact>.html --out <shots dir>
```

`<kind>` is one of `inspo`, `design-pitch-deck`, `implementation-process-map`, `performance-results`, `release-notes`, `dashboard`. Working files go in `.qsdlc/<slug>/artifacts/.craft/`. Full step-by-step: `references/pipeline.md`.

## The six steps in brief

1. **Inspect** (`scripts/brand_probe.mjs`). Reads the target project, not the qsdlc repo: design docs, token files, CSS variables, brand assets, type, shape conventions. Writes `brand-bind.json` with palette, theme, type, radius scale, rules, a contrast report and recorded conflicts. Exit code 3 means no brand source was found: **ask one question** (use the neutral unbranded set, or point at a brand file). Never invent a palette.
2. **Bind**. Paste the probe's `rootBlock` as the token block. Product names win; engine tokens `--bg --surface --panel --line --ink --muted --hi --ok --alt --risk` alias to them. Use text-safe values. Add `<meta name="brand-source">`. See `references/brand-binding.md`.
3. **Roll** (`scripts/roll.mjs`). Deals one archetype, the BI cards, motion devices, two finish cards, one signature moment from `assets/matrix/*.json` (57 cards; table in `references/matrix.md`). Deterministic per `slug|kind|rollIndex`. `--pin` for recurring dashboards so the layout never reshuffles. Online, add one researched reference through the privacy-gated query plan (`references/inspiration-atlas.md`).
4. **Pitch**. Offer two or three directions, name the bet and its risk, make one reach past the obvious. Autonomous run: pick the first, state it in a line.
5. **Build**. Start from the rolled skeleton in `assets/archetypes/`. Inline `kit` (CSS and `Kit.*` motion and charts) and `diagram`; add `html-motion` engines only when the artifact needs canvas or GPU motion.
6. **Verify**. `lint.mjs` exits 0, `shoot.mjs` passes, then **open the frames and look at them**. Never describe a render you have not seen.

## What each artifact is for

| Artifact | Job | Archetype pool | Must contain | Kill list |
|---|---|---|---|---|
| `inspo.html` | confirm the vibe before design grounds it; evocative, not a spec | `moodfield`, `swiss-poster`, `broadsheet` | interview phrases as type, token chips from the bound palette, a "what this is not" line | wireframes, UI mock grids, gradient text |
| `design-pitch-deck.html` | pitch the execution vision | `scrolly-spine`, `slide-stage`, `orbit-hub`, `compare-split` | problem → proposal → key flows → why this approach; a `Diagram.layout` diagram | external Mermaid, decorative loops |
| `implementation-process-map.html` | phases, dependencies, hand-offs between skills and subagents | `subway-map`, `swimlane-timeline` | status by shape and label, not colour alone; skill tag per phase | hairball graphs, fake progress |
| `performance-results.html` | data first: pass/fail up front, failures below | `instrument-panel`, `ledger`, `case-file` | verdict sentence, counts, each failure with eval id, expected vs actual, evidence; every number sourced | pie charts, mean-only performance, green with no evidence |
| `release-notes.html` | stakeholder-facing: what shipped, why it matters | `broadsheet`, `anatomy`, `compare-split` | what changed / why it matters / what to do next; honest scope (now / next / not yet) | claims beyond `eval.md`, internal jargon |
| factory dashboards, scorecards, triage and run reports | state → delta → action, readable across a room | `instrument-panel`, `ledger`, `case-file`, `ranked-board` | last-updated stamp, stale state visibly desaturated, change-since-last-run strip, ranked backlog with ids, link to the source `.md` | reshuffled layout between runs (pin the roll), frozen "healthy" colour on stale data |

For dashboards the data comes from a JSON file (scores, ids like `COMP-001`, findings, a prior snapshot) embedded in the page. The look comes from the pinned roll, so a nightly run changes numbers, not layout. The `.md` stays the source of truth; the HTML renders it and links back.

## Tools

| Need | Use |
|---|---|
| everyday BI charts and editorial pieces | `kit`: `assets/kit/kit.css`, `assets/kit/kit.js` (`Kit.reveal`, `Kit.draw`, `Kit.grow`, `Kit.count`, `Kit.flow`, `Kit.scrub`, `Kit.chart.bar stacked strip slope spark bullet heatmap waterfall`) |
| flow, dependency, hand-off diagrams | `Diagram.layout(json)` in `assets/kit/diagram.js`: layered DAG to inline SVG with `role="img"`, `<title>`, a text fallback. It replaces Mermaid. For specialized `sequence`, `erd`, `class`, `dataflow`, `lifecycle`, `tree`, `timeline`, or `waterfall` visuals, invoke `../qsdlc-archify/SKILL.md` (`archify`, optional companion grounded with `../qsdlc-graphify/SKILL.md`), and lint any QSDLC stage HTML output |
| canvas or GPU motion (particle streams, network with travellers, shader field, 3D terrain) | `../html-motion/SKILL.md`; inline engines with `inline.mjs`. This is the exception, not the default |
| a product font file | `scripts/embed_font.mjs` (local file only) |

Freeze and QA parameters, shared by kit and engines: `?t=0..1` freezes every `drawAt` primitive at that fraction, `?freeze=1` stops loops, `?fps=1` shows frame rate.

## Non-negotiables

- **Self-contained.** One file, everything inline, opens from `file://`. No CDN, no fetch, no remote font. A published Artifact may be added afterwards; the local file stays the source of truth.
- **Honest data.** Every stat has `data-source`; invented examples say "illustrative"; no number the evidence does not support.
- **Accessible.** Every chart has a table fallback; status is never colour alone; `:focus-visible`; full `prefers-reduced-motion` final state; content readable with JavaScript off.
- **Motion maps to a fact.** Delete the animation in your head; if the page says the same, cut it. Banned: marquees, parallax for its own sake, spin, flash, count-ups on non-numeric data, loops over 8 s without a pause control.
- **Product copy and claims.** Follow any audience, tone and voice rules the probe finds in the target repo's docs (`rules` in `brand-bind.json`). Write for the reader's outcome. Never claim more than `eval.md` or `.qsdlc/factory/verify/` output proves; `lint.mjs --claims` flags the overclaim words.

## Files

| File | Use |
|---|---|
| `references/pipeline.md` | each step with commands, the live wildcard, the build and verify checklists |
| `references/inspiration-atlas.md` | sources, fetchability, privacy-safe query recipes |
| `references/bi-grammar.md` | relationship → form → kit call, a11y fallbacks |
| `references/brand-binding.md` | probe tiers, mapping table, confidence, drift rules |
| `references/matrix.md` | every card (generated from the json by `scripts/matrix_md.mjs`) |
| `assets/matrix/archetypes.json`, `bi.json`, `motion.json`, `finish.json`, `signature.json` | the cards the roll deals |
| `assets/kit/kit.css`, `kit.js`, `diagram.js` | inlinable browser kit |
| `assets/archetypes/broadsheet.html`, `instrument-panel.html`, `scrolly-spine.html`, `subway-map.html`, `case-file.html`, `moodfield.html` | token-only structural skeletons |
| `scripts/brand_probe.mjs`, `roll.mjs`, `inline.mjs`, `embed_font.mjs`, `lint.mjs`, `shoot.mjs`, `matrix_md.mjs` | the pipeline tools |
| `test/run_tests.mjs` | `node test/run_tests.mjs` verifies the whole skill |

## Lint codes

L01 external URLs · L02 reduced motion and no-JS visibility · L03 focus and clickable semantics · L04 painted body and token discipline · L05 palette drift · L06 radius scale and shadow · L07 gradient text, emoji, purple-to-blue gradient · L08 svg title and chart fallbacks · L09 WCAG contrast · L10 overflow wrappers (keyboard focusable, `tabindex="0"`) · L11 scroll-snap proximity · L12 document basics · L13 size budget · L14 data-source and illustrative labels · L15 overclaims (`--claims`) · L16 brand-source meta. `lint.mjs --ambient` is for always-on wall displays only (loopback `fetch` allowed, `<main>` required); stage artifacts never use it.

## Credits

The "deal, never choose by taste" idea and the banned-tell lists are adapted from the MIT-licensed taste-skill; chart-fallback and design-dial ideas from ui-ux-pro-max-skill. Both are optional accelerators that are detected, never vendored.
