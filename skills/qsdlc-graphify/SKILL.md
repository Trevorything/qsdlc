---
name: qsdlc-graphify
description: Use Graphify (Graphify-Labs/graphify) inside QSDLC for AST-backed codebase queries, reverse blast-radius analysis (affected), path tracing, and incremental knowledge-graph updates across Interview, Triage, Design, Build, Verify, and Factory sweeps.
---

# qsdlc-graphify: Codebase Knowledge Graph Companion

Read [../_shared/conventions.md](../_shared/conventions.md) first.

This skill **extends the official `graphify` skill** (`Graphify-Labs/graphify`, CLI command `graphify`). It does not vendor `graphify`; when installed globally or in the project, QSDLC uses it to cut token cost and surface structural coupling before editing code.

If `graphify` is missing on the machine, fall back cleanly to normal file reads and grep, or install via `pipx install graphifyy && graphify install`.

## Core rules

1. **AST narrows scope; live source and checks prove truth.** Use `graphify query`, `path`, `explain`, and `affected` to find relevant modules and callers quickly, then verify exact behavior in live source (`file:line`) before writing `spec.md`, `assessment.md`, or `eval.md`. Never cite an `INFERRED` or `AMBIGUOUS` edge as verified behavior.
2. **Never dump full `graph.json` into prompts.** Read `graphify-bridge.mjs summary --json`, `graphify-out/GRAPH_REPORT.md` (god nodes and communities), or bounded queries (`--budget 1500`).
3. **Zero-LLM incremental refreshes.** During factory loops or after merges, refresh code AST structure with `graphify update <path> --no-cluster` (or `graphify update <path>`) cleanly rather than rebuilding from scratch.
4. **Stay clean in git and `.qsdlc/`.** QSDLC lint (`V9`) allows `graphify-out/**`, and projects should ignore `graphify-out/` unless intentionally versioning a project knowledge vault. Keep read-only queries inside the active worktree.

## Where Graphify plugs into QSDLC

| QSDLC Skill | What Graphify supplies | Commands / workflow |
|---|---|---|
| `qsdlc-triage` | Blast radius, coupled modules, regulated/protected touch risk | `node <SKILLS>/qsdlc-graphify/scripts/graphify-bridge.mjs summary --root .` and `affected "<symbol>"` |
| `qsdlc-interview` (autonomous) & `qsdlc-design` (§1) | Answers to `Intent.md` research questions and architectural touchpoints before drafting deltas | `query "<question>" --budget 1500`, `path "<A>" "<B>"`, followed by live `file:line` reads |
| `qsdlc-build` & `qsdlc-herdr` | Check module dependencies before splitting Scatter lanes or authoring `dispatch-guard` file ownership | `affected "<target>"` to catch shared callers across parallel phases |
| `qsdlc-verify` & `qsdlc-qa` | Prioritize feature-map journeys around high-degree hub nodes and affected call paths | `summary --json` top hub nodes + `affected "<changed_symbol>"` |
| `qsdlc-sweep` (`debt-sweep`) & `qsdlc-audit` | Detect structural drift and confirm Grounding freshness | `graphify check-update .` / `graphify update .` and `graphify-bridge.mjs summary` |
| `qsdlc-archify` & `qsdlc-present` | Grounded node/edge evidence for repository architecture diagrams | Extract verified hubs and edges before authoring Archify candidate JSON |

## Safe Windows/POSIX bridge

Use [scripts/graphify-bridge.mjs](scripts/graphify-bridge.mjs) so Windows venv paths (`uv`, `pipx`, Hermes venv) resolve consistently and arguments never go through shell string interpolation:

```bash
node <SKILLS>/qsdlc-graphify/scripts/graphify-bridge.mjs detect --root . --json
node <SKILLS>/qsdlc-graphify/scripts/graphify-bridge.mjs summary --root . --top 10 --json
node <SKILLS>/qsdlc-graphify/scripts/graphify-bridge.mjs query "how does auth middleware reach sessions?" --root . --budget 1500
node <SKILLS>/qsdlc-graphify/scripts/graphify-bridge.mjs affected "verifyToken" --root . --depth 2
node <SKILLS>/qsdlc-graphify/scripts/graphify-bridge.mjs path "Router" "SessionStore" --root .
```

Self-check without external dependencies:

```bash
node <SKILLS>/qsdlc-graphify/scripts/graphify-bridge.mjs --self-test
node <SKILLS>/qsdlc-graphify/test/run_tests.mjs
```
