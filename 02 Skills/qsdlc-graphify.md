---
tags: [skill, tools]
---

# qsdlc-graphify

- **Stage**: [[qsdlc-triage]], [[qsdlc-interview]], [[2 - Design|qsdlc-design]], [[3 - Build|qsdlc-build]], [[qsdlc-verify]], and [[Continuous Factory]] sweeps
- **Implementation**: `/skills/qsdlc-graphify/SKILL.md`, with `scripts/graphify-bridge.mjs` and `test/run_tests.mjs`
- **Extends**: [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) (`graphify` CLI and `/graphify` skill; never vendored)

## What it does

Connects Graphify's deterministic local AST + multimodal knowledge graph (`graphify-out/graph.json`, `GRAPH_REPORT.md`) into QSDLC's investigation and triage phases without losing code-level grounding.

- **Graph-first probing**: queries `summary`, `query`, `path`, `explain`, and reverse-impact `affected` before wide grepping in `qsdlc-triage`, `qsdlc-design`, `qsdlc-verify`, and `qsdlc-herdr` disjoint-ownership checks.
- **Truth hierarchy**: Graphify `EXTRACTED` edges locate symbols and call paths, while live `file:line` reads and executed checks still prove facts in `spec.md`, `assessment.md`, and `eval.md`.
- **Incremental refreshes**: `debt-sweep` and living-spec maintenance use `graphify update` so AST updates stay current with zero LLM extraction tokens on source code.
- **V9 lint compatibility**: `qsdlc-lint.mjs` allows `graphify-out/**` so generated `GRAPH_REPORT.md` and wiki markdown never trip stray-markdown checks.

## See also

[[qsdlc-archify]], [[qsdlc-triage]], [[qsdlc-design]], [[qsdlc-sweep]], [[qsdlc-audit]]
