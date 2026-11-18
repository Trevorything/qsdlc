---
tags: [skill, artifact]
---

# qsdlc-present

- **Stage**: every stage (called by each stage skill to build its artifact)
- **Implementation**: `/skills/qsdlc-present/SKILL.md`, with `scripts/`, `assets/`, and `references/`
- **Triggers on**: a stage skill needing to write or improve an artifact, or a request for an HTML report, dashboard, pitch, or release page bound to a product's brand

## What it does

The craft layer for every HTML artifact. Stage skills say what the artifact is for; this skill makes it good, on-brand, honest, and checked. One pipeline, six steps: **Inspect, Bind, Roll, Pitch, Build, Verify**. Node 20 or newer, no `npm install`, Playwright only for screenshots.

1. **Inspect and Bind.** `brand_probe.mjs` reads the target project (not the qsdlc repo): design docs, token files, CSS variables, brand assets, type, shape conventions, and writes `brand-bind.json`. Exit code 3 means no brand source was found: ask one question (neutral set, or point at a brand file). It never invents a palette.
2. **Roll.** `roll.mjs` deals structure only (layout archetype, BI chart cards, motion devices, finish cards, one signature moment) from 57 cards, deterministically per `slug|kind|rollIndex`. The roll never sees colour or type. `--pin` keeps recurring dashboards from reshuffling.
3. **Pitch.** Offer two or three directions, name the bet and its risk. An autonomous run picks the first and states it in a line.
4. **Build.** Copy a rolled skeleton from `assets/archetypes/`, inline the `kit` (CSS plus `Kit.*` motion and charts) and `diagram` with `inline.mjs`, and add [[html-motion]] engines only when canvas or GPU motion shows a fact the kit cannot.
5. **Verify.** `lint.mjs` (codes L01 to L16) must exit 0, `shoot.mjs` captures frames, then the frames are opened and looked at. A render that was not seen is not described.

Artifact kinds it handles: `inspo`, `design-pitch-deck`, `implementation-process-map`, `performance-results`, `release-notes`, and `dashboard` (factory scorecards, triage and run reports).

Diagrams use `Diagram.layout(json)` from `assets/kit/diagram.js`: a layered DAG rendered to inline SVG with a text fallback. It replaces the external Mermaid CDN. Non-negotiables: one self-contained file that opens from `file://`, every stat carries `data-source`, every chart has a table fallback, status is never colour alone, full `prefers-reduced-motion` support, and no claim beyond what `eval.md` or the verify map proves (`lint.mjs --claims`).

Full detail: [[Artifacts]].

## See also

[[html-motion]], [[Artifacts]], [[qsdlc-audit]] (scorecard), [[qsdlc-pr]] (release notes)
