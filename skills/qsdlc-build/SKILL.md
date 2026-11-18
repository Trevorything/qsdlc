---
name: qsdlc-build
description: Turn spec.md into a phased plan.md, then execute it with a fresh subagent per phase, two-stage review, a progress ledger, and worktree isolation. Works in interactive mode (user signs off the plan) and factory mode (check-gates). Use for the Build stage of QSDLC, after spec.md exists.
---

# qsdlc-build: Build stage

Read [../_shared/conventions.md](../_shared/conventions.md) first. Templates: [plan](../_shared/templates/plan.template.md), [ledger](../_shared/templates/ledger.template.md).

Tracks: `quick` and `bugfix` write a one-phase plan from `Intent.md` (bugfix: from `assessment.md`, failing repro first). Others need `spec.md`; if missing, stop and send the user to Design.

## Part A: draft `plan.md`

1. Break the work into ordered phases. Each phase states: Goal, Steps, Files touched, Verification, Depends on, and three tags:
   - `Developer skill:` `qsdlc-dev-web`, `qsdlc-dev-api`, `qsdlc-dev-cli`, or `none` (say so; do not force-fit).
   - `Pattern:` one of the nine Relay Patterns: Multipart Phases, Dependency, Comparative, Pagination, Audit, Realignment, Scatter, Consensus, Batch Testing. Pick by asking "branch, loop, or swarm?" (independent phases are Scatter; sequential are Dependency; a review fix loop is Audit; many same-shape items are Pagination).
   - `Requirements:` the `F`/`R` IDs from `spec.md` the phase satisfies.
2. Run `node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --slug <slug>`.
3. **Interactive:** show `plan.md`; execute only after the user confirms. **Autonomous:** the plan must pass the analyze cross-check from `qsdlc-design` (Intent, spec, plan consistent, constitution clean) instead.

## Part B: execute

**Isolation.** Work in a worktree: detect existing isolation first (resolved git dir differs from the common git dir), else use `EnterWorktree` or plain `git worktree add` on branch `qsdlc/auto/<slug>-<date>` (autonomous) or a feature branch (interactive). Record `Base SHA`, `Branch`, `Worktree` in `state.md`. Confirm the worktree path is git-ignored.

**Ledger.** Create `ledger.md` (first line names the plan). Write an entry **before** a phase starts (`started`, base SHA) and **after** (`done|parked`, head SHA, evidence pointer). After context loss, recover from `ledger.md` and `git log`, never from memory. Record `Ruling:` lines (what, why, cost if wrong) instead of asking questions in autonomous mode.

**Dispatch.** One fresh subagent per phase, in dependency order. Brief in GREAT shape and nothing else (no session history):
- Grounding: phase text, spec excerpt with requirement IDs, files, the governing dev skill.
- Role: implementer for this phase only; stay inside Files touched.
- Execution: steps, verification command, evidence to write under `evidence/`.
- Analysis: report what was verified and what was not.
- Takeaway: three lines the orchestrator reads. **The orchestrator reads only the Takeaway**, then checks `git diff --stat` against it.

Parallel phases (`Scatter`): check shared module edges with `qsdlc-graphify` (`affected`) when `graphify-out/graph.json` exists so parallel lanes keep strict disjoint file ownership. Inside Herdr (`HERDR_ENV=1`) hand lanes to `qsdlc-herdr`, one worktree and one named agent per lane; otherwise dispatch concurrent subagents with `isolation: worktree`. Lanes never merge; the controller does not either.

**Review per phase.** After each phase invoke `qsdlc-review` (spec compliance, then code quality). Minor findings go in the ledger. Critical or Important findings enter the fix loop:
- Interactive cap: 3 rounds. Autonomous cap: `autonomous.max_fix_rounds` from `policy.md` (default 2).
- Re-review is scoped to the fix diff.
- After the cap: a fresh implementer on a stronger model gets one round; if still failing, **park the phase**, log it in `ledger.md` and the mailbox, mark it `parked` in `plan.md`. Never discard silently.
- The orchestrator never fixes findings itself.

**Updating the plan.** If a phase shows the plan was wrong, edit `plan.md` to match reality and log why. Keep the Status table true.

## Evidence before claims

A phase is not `done` on a subagent's report. Required: verification command output in `evidence/`, a diff check, and the review verdict. See the claim table in conventions. Passing tests are a claim until the output file exists.

## Limits (autonomous)

Stop and decline when a `policy.md` limit is hit (`max_files`, `max_changed_loc`, `max_runtime_minutes`). Touching `protected_paths` is allowed only with `Risk: protected`, and ends `needs-review`. `qsdlc-guard` enforces the worktree fence and path rules.

## Output

1. `plan.md` with final phase statuses, `ledger.md` complete.
2. Invoke `qsdlc-present` to build `.qsdlc/<slug>/artifacts/implementation-process-map.html`: phases, dependencies, Pattern tags, hand-offs, review rounds, parked items. Use `Diagram.layout`; optionally upgrade standalone sequence/workflow diagrams with `qsdlc-archify` under `artifacts/.craft/archify/`. Sources in `artifacts/.craft/`.
3. Run `node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --slug <slug>`.
4. **Interactive:** confirm the build matches the plan before advancing `state.md`. **Autonomous:** advance only if every phase is `done` or explicitly `parked` and review verdicts are clean; set `Pending confirmation: build drafted by <run-id>`.
