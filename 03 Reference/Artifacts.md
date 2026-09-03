---
tags: [reference]
---

# Artifacts

Where the five [[Documents|documents]] are precise and inspectable, artifacts are the fast, visual counterpart — one self-contained HTML file per stage, written to `.qsdlc/<feature-slug>/artifacts/`.

## The five artifacts

| File | Stage | Tone |
|---|---|---|
| `inspo.html` | [[1 - Plan]] | Evocative, visual — mood and vision, deliberately not a spec |
| `design-pitch-deck.html` | [[2 - Design]] | Pitched — problem recap, proposed solution, why this approach |
| `implementation-process-map.html` | [[3 - Build]] | A diagram of phases, dependencies, and hand-offs |
| `performance-results.html` | [[4 - Test]] | Data-first — pass/fail counts up front, failure detail below |
| `release-notes.html` | [[5 - Deploy]] | Stakeholder-facing — what shipped and why it matters, not implementation detail |

## Format convention

Every artifact is a single **self-contained HTML file** — no external script/stylesheet dependencies beyond what it inlines — so it opens correctly as a plain local file regardless of which Claude Code client produced it. If the running session happens to have a live Artifact-publishing tool available, a stage skill may additionally publish it for a shareable link, but the local file is always written first and is the source of truth.

## Diagrams — Archify

Where an artifact needs a real diagram (the pitch deck's architecture sketch, the process map, anything showing structure or flow), stage skills use **[Archify](https://github.com/tt-a1i/archify)** — installed as its own agent skill (`npx skills add tt-a1i/archify -g`). It turns a described system into a self-contained, verifiable HTML diagram (architecture, workflow, sequence, data-flow, lifecycle), exportable as PNG/SVG/WebM.

If Archify isn't installed in the current environment, skills fall back to an inline Mermaid diagram (a ` ```mermaid ` block) — it renders natively in most Artifact-capable viewers, and degrades to a readable code block otherwise.

## See also

[[Documents]], [[QSDLC]]
