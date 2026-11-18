---
tags: [skill, tools, presentation]
---

# qsdlc-archify

- **Stage**: [[2 - Design]], [[3 - Build]], discovery/audits, and specialized standalone visuals extending [[qsdlc-present]]
- **Implementation**: `/skills/qsdlc-archify/SKILL.md`, with `scripts/archify-bridge.mjs` and `test/run_tests.mjs`
- **Extends**: [tt-a1i/archify](https://github.com/tt-a1i/archify) (`archify` skill and `bin/archify.mjs`; never vendored)

## What it does

Bridges Archify's 10 schema-validated diagram renderers (`architecture`, `workflow`, `sequence`, `dataflow`, `lifecycle`, `erd`, `class`, `tree`, `timeline`, `waterfall`) plus standalone `explainer` visuals into QSDLC safely.

- **Clear boundary with `Diagram.layout`**: lightweight LR/TB DAGs inside pitch decks and implementation maps keep using `qsdlc-present`'s inline `Diagram.layout(json)`. Escalate to `qsdlc-archify` when a stage needs sequence traces, ERDs, class/tree breakdowns, timelines/waterfalls, Mermaid conversion, or interactive showcase architecture diagrams.
- **Graphify -> Archify grounding**: pairs with [[qsdlc-graphify]] when `graphify-out/graph.json` exists, extracting real AST dependencies and confirming `file:line` before generating candidate JSON.
- **QSDLC path & lint hygiene**: `archify-bridge.mjs paths` directs primary deliverables via `--stage design|build` or companion visuals under `.qsdlc/<slug>/artifacts/.craft/archify/` so `qsdlc-lint.mjs` V1/V9 stay clean, followed by `qsdlc-present/scripts/lint.mjs`.

## See also

[[qsdlc-present]], [[qsdlc-graphify]], [[Artifacts]], [[qsdlc-design]], [[qsdlc-build]]
