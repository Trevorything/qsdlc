---
name: qsdlc-archify
description: Use Archify (tt-a1i/archify) inside QSDLC to generate validated interactive HTML diagrams (architecture, workflow, sequence, dataflow, lifecycle, erd, class, tree, timeline, waterfall) and focused explainers for Design, Build, Audit, and Discovery artifacts. Extends qsdlc-present without replacing it.
---

# qsdlc-archify: Validated Architecture Diagram & Explainer Upgrade

Read [../_shared/conventions.md](../_shared/conventions.md) and [../qsdlc-present/SKILL.md](../qsdlc-present/SKILL.md) first.

This skill **extends the official `archify` skill** (`tt-a1i/archify`). It does not vendor `archify`. When installed globally or in the target project (`npx skills add tt-a1i/archify --skill archify -g`), QSDLC invokes `archify` for specialized technical diagrams that go beyond `Diagram.layout`'s DAG layout.

If `archify` is absent, stay cleanly on `qsdlc-present`'s `Diagram.layout(json)` or fail closed and report that `archify` is not installed.

## When to use `Diagram.layout` vs `qsdlc-archify`

| Need | Use | Why |
|---|---|---|
| Embedded flow DAG inside `design-pitch-deck.html` or `implementation-process-map.html` | `Diagram.layout(json)` (`qsdlc-present`) | Zero external dependencies, shares the page's bound tokens automatically |
| Dedicated `sequence`, `erd`, `class`, `dataflow`, `lifecycle`, `tree`, `timeline`, `waterfall`, showcase `architecture`, or Mermaid conversion | `qsdlc-archify` (`archify`) | Schema-validated IR across all 10 diagram types plus interactive trace controls and SVG/PNG/WebM export |
| One-page post-audit explainer or trade-off walkthrough | `qsdlc-archify` (`explainer`) or `qsdlc-present` | Structured panels with validated diagram embeds |

## Repository-backed discipline (Graphify -> Archify -> Lint)

1. **Ground nodes and edges in real code.** When `graphify-out/graph.json` exists (`qsdlc-graphify`), inspect `summary`, `GRAPH_REPORT.md`, or `query`/`path` outputs first, then confirm `file:line` in source before authoring candidate JSON. Never invent modules, databases, queues, or RPC calls.
2. **Keep outputs inside `.qsdlc/`.** Direct Archify candidates to `.qsdlc/<slug>/artifacts/.craft/archify/<type>-<name>/` and rendered HTML to `.qsdlc/<slug>/artifacts/<name>.html` (or `.archify/` for ad-hoc exploration). Never leave stray Markdown outside QSDLC-allowed folders; V9 allows `.archify/**` and `.qsdlc/<slug>/artifacts/.craft/**`.
3. **Run both verification gates.** Archify's `finalize` runs schema + browser checks. Afterward run `qsdlc-present/scripts/lint.mjs` on every QSDLC stage HTML artifact so external URL (`L01`), reduced motion (`L02`), contrast (`L09`), source attribution (`L14`), and claims (`L15`) match QSDLC rules.
4. **Honesty in reporting.** Distinguish Archify's automated `finalize` pass from manual visual inspection (`--out-dir` captures opened and inspected). Never claim perceptual review without inspecting frames.

## Safe bridge helper

Use [scripts/archify-bridge.mjs](scripts/archify-bridge.mjs) to locate the installed `archify` binary across agent folders, resolve safe `.qsdlc/` paths, sanity-check candidate JSON, and invoke `doctor` or `finalize` cleanly without shell quoting issues:

```bash
node <SKILLS>/qsdlc-archify/scripts/archify-bridge.mjs detect --root . --json
node <SKILLS>/qsdlc-archify/scripts/archify-bridge.mjs paths --root . --slug auth-refactor --type sequence --name token-flow --json
node <SKILLS>/qsdlc-archify/scripts/archify-bridge.mjs paths --root . --slug auth-refactor --type architecture --stage design --json
node <SKILLS>/qsdlc-archify/scripts/archify-bridge.mjs check-candidate .qsdlc/auth-refactor/artifacts/.craft/archify/sequence-token-flow/candidate.json --root . --json
node <SKILLS>/qsdlc-archify/scripts/archify-bridge.mjs doctor --root .
node <SKILLS>/qsdlc-archify/scripts/archify-bridge.mjs finalize sequence candidate.json .qsdlc/auth-refactor/artifacts/.craft/archify/sequence-token-flow/token-flow.html --repo-root . --quality showcase
```

Self-check without external dependencies:

```bash
node <SKILLS>/qsdlc-archify/scripts/archify-bridge.mjs --self-test
node <SKILLS>/qsdlc-archify/test/run_tests.mjs
```
