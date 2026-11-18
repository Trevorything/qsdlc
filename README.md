# QSDLC: Quintessence Software Development Lifecycle

A skill library that directs AI models and subagents through software work the same structured way every time. Version 2 keeps the original five-stage feature lifecycle and adds a **Continuous Software Factory**: work sized to a track, runs that can start from a schedule, review and verification that do not depend on the agent grading its own work, and mistakes that get turned into enforced checks.

This repo is both:
- an **Obsidian vault** (open the repo root in Obsidian) documenting what QSDLC is and how it works, and
- a **Claude Code skill library** (`/skills/`), installable as a plugin or copied skill-by-skill.

## Quick start

```
/plugin marketplace add Trevorything/qsdlc
/plugin install qsdlc@qsdlc-marketplace
```

Run the `qsdlc` skill in a project to kick off or resume a feature. It sizes the work with `qsdlc-triage`, then either walks the stages with you or hands off to `qsdlc-factory`.

See [`00 Overview/QSDLC.md`](<00 Overview/QSDLC.md>) for the full picture, or [`04 Installation/`](<04 Installation>) for other install paths.

## Two ways to run it

| | Interactive | Autonomous / scheduled |
|---|---|---|
| Who gates | You confirm each stage | Checks gate each stage (spec analyze, eval evidence, two-stage review, lint) |
| Questions | Allowed for missing input | Never; assumptions and rulings are recorded, or the run ends `declined` |
| Push and PR | A separate go-ahead each time | Only under a standing grant in `policy.md`: branch push and **draft PR only** |
| Never | n/a | Auto-merge, push to the default branch, force-push, deploy |
| Limits | Your judgment | Budgets in `policy.md`; exceeding one declines and logs, it never pauses |

Every autonomous run ends with one terminal status (`done`, `needs-review`, `blocked`, `declined`, `failed`, `partial`), a `run.json`, a TSV log, and a mailbox entry.

## The feature lifecycle

Each stage writes one durable document and one HTML artifact into `.qsdlc/<feature-slug>/`.

| Stage | Document | Artifact | Skill |
|---|---|---|---|
| Plan | `Intent.md` | `inspo.html` | `qsdlc-interview` |
| Design | `spec.md` (ADDED/MODIFIED/REMOVED deltas) | `design-pitch-deck.html` | `qsdlc-design` (+ `qsdlc-feature-research`) |
| Build | `plan.md` (+ `ledger.md`) | `implementation-process-map.html` | `qsdlc-build` (+ `qsdlc-review`, developer skills) |
| Test | `eval.md` | `performance-results.html` | `qsdlc-qa` (+ `qsdlc-verify`) |
| Deploy | `docmd.md` | `release-notes.html` | `qsdlc-pr` |

`qsdlc-triage` picks a track so small work does not pay for the full process:

| Track | Use when | Stages |
|---|---|---|
| `quick` | clear intent, about one session | Build, Test, Deploy |
| `bugfix` | existing behavior is broken | Assess (read-only), Fix, Test (red then green), Deploy |
| `delta` | change to existing behavior | short Plan, Design delta, Build, Test, Deploy |
| `full` | novel or unclear, large scope | all five |
| `discovery` | the output is knowledge, not code | Plan, Research, Decide (`go`, `needs-clarification`, `kill`) |

Risk can only raise a track. Paths a project lists as protected in `policy.md` force a human-reviewed PR.

## The software factory

| Skill | What it does |
|---|---|
| `qsdlc-triage` | Track classifier, risk floor, `autonomy_eligible`, skipped-stage declaration |
| `qsdlc-factory` | Autonomous runner: worktree, check-gated track run, budgets, `run.json`, mailbox; never merges |
| `qsdlc-sweep` | Scheduled sweeps: ticket funnel, queue drain, regression sweep, UX and performance sweep, canary, competitive scout, shortcut-debt sweep |
| `qsdlc-ritual` | Scaffolds `.qsdlc/rituals/*.md` and external scheduler wrappers; enables a ritual only after a real trigger and run evidence exist |
| `qsdlc-verify` | Feature maps and a project verify skill that drives the real app and captures evidence |
| `qsdlc-review` | Two-stage review (spec compliance, then code quality) with a persona roster and a capped fix loop |
| `qsdlc-correct` | Correction-to-check ratchet: a mistake seen twice becomes an enforced check with a recorded proof |
| `qsdlc-audit` | 100-point operational reliability audit across Grounding, Verification, Compounding, Cadence |
| `qsdlc-guard` | PreToolUse safety hook: soft-delete, worktree fence, protected paths, never-merge, budget guard |

Rituals ship `enabled: false`. Product-specific rules (which modules are regulated, what counts as sensitive) belong in each project's `.qsdlc/factory/policy.md`, not in these skills.

## Presentation, orchestration, and companion tools

| Skill | What it does |
|---|---|
| `qsdlc-present` | Crafts every stage artifact, plus factory BI dashboards, scorecards, and triage reports, as self-contained HTML bound to the target product's own brand and checked by a linter and screenshots |
| `html-motion` | HTML where motion carries meaning (dashboards, status displays, animated explainers), from a library of working animation engines |
| `qsdlc-archify` | Integrates [tt-a1i/archify](https://github.com/tt-a1i/archify) for validated 10-mode interactive diagrams (architecture, sequence, ERD, dataflow, lifecycle, class, tree, timeline, waterfall) and explainers cleanly under `.qsdlc/` |
| `qsdlc-graphify` | Integrates [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) for local AST knowledge-graph queries (`query`, `affected`, `path`, `explain`, incremental `update`) across Triage, Design, Build, Verify, and Debt Sweeps |
| `qsdlc-herdr` | Runs plan phases as parallel or independently reviewed lanes inside Herdr, using the nine relay patterns |

## Deterministic enforcement

Prose is the weakest layer, so scripts check what scripts can.

- `skills/_shared/scripts/qsdlc-lint.mjs` validates folder shape, append-only `state.md`, `eval.md` evidence and summary math, feature maps, evidence manifests and PII patterns, run logs, the correction ledger and generated `rules.md`, protected paths, stray markdown, prose and comment markers, and formal-check freshness (V1 to V12).
- `skills/_shared/scripts/qsdlc-log.mjs` is the append-only logger and ratchet-metrics calculator.
- `skills/qsdlc-guard/scripts/guard-check.mjs`, `skills/qsdlc-sweep/scripts/sweep-state.mjs`, `skills/qsdlc-archify/scripts/archify-bridge.mjs`, and `skills/qsdlc-graphify/scripts/graphify-bridge.mjs` back the guard, sweep, and companion tool bridges.
- Run tests across suites with `node skills/_shared/test/run_tests.mjs`, `node skills/qsdlc-present/test/run_tests.mjs`, `node skills/qsdlc-herdr/test/run_tests.mjs`, `node skills/qsdlc-archify/test/run_tests.mjs`, and `node skills/qsdlc-graphify/test/run_tests.mjs` (Node 20 or newer, no dependencies).

## Status

The scripts and their tests pass. The skills are written and size-checked, but the factory, rituals, and scheduler wrappers have not yet run unattended in a real project, so treat autonomous mode as supervised-first: start with `quick` and `bugfix` tickets outside protected paths, and review every draft PR.

The shared on-disk contract lives in [`skills/_shared/conventions.md`](skills/_shared/conventions.md).
