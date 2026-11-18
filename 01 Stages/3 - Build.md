---
tags: [stage]
---

# 3 - Build

Turns agreed requirements into an execution plan, then into working code, with a progress ledger, a review after every phase, and an isolated worktree.

## Inputs

`Intent.md` and `spec.md`. On the `quick` and `bugfix` tracks, [[qsdlc-build]] writes a one-phase plan from `Intent.md` (bugfix: from `assessment.md`, with the failing repro first).

## Skills

[[qsdlc-build]] drafts `plan.md` as ordered phases. Each phase states Goal, Steps, Files touched, Verification, Depends on, and three tags:

- `Developer skill:` `qsdlc-dev-web`, `qsdlc-dev-api`, `qsdlc-dev-cli`, or `none`. See [[Developer Skills]].
- `Pattern:` one of Trevor's nine Agent Relay Patterns, chosen by asking whether the work is a branch, a loop, or a swarm.
- `Requirements:` the `F`/`R` ids from `spec.md` that the phase satisfies.

In interactive mode the user confirms the plan before any code is written. In autonomous mode the plan must instead pass the analyze cross-check (Intent, spec, and plan consistent, constitution clean).

## Executing

- **Isolation.** Work happens in a worktree: an existing one is detected first, otherwise `EnterWorktree` or `git worktree add` on a feature branch (interactive) or `qsdlc/auto/<slug>-<date>` (autonomous). `Base SHA`, `Branch`, and `Worktree` are recorded in `state.md`.
- **Ledger.** `ledger.md` gets an entry before and after each phase. After context loss, work resumes from the ledger and `git log`, never from memory. Autonomous mode records `Ruling:` lines instead of asking questions.
- **Fresh subagent per phase**, briefed in GREAT form (Grounding, Role, Execution, Analysis, Takeaway) and nothing else. The orchestrator reads only the Takeaway and checks `git diff --stat` against it.
- **Parallel phases** (Scatter) go to [[qsdlc-herdr]] lanes inside Herdr, one worktree and one named agent each, or to concurrent subagents otherwise. Lanes never merge.
- **Two-stage review per phase.** [[qsdlc-review]] checks spec compliance, then code quality, using a persona roster chosen by what the diff touches. `Minor` findings go to the ledger. `Critical` and `Important` findings loop with a cap (3 rounds interactive, `max_fix_rounds` in autonomous, default 2), re-review scoped to the fix diff, then one round from a fresh implementer on a stronger model, then the phase is parked with a ruling. Nothing is discarded silently, and the orchestrator never fixes findings itself.
- **Evidence before claims.** A phase is not `done` on a subagent's report: it needs verification output under `evidence/`, a diff check, and a clean review verdict.

Autonomous limits (`max_files`, `max_changed_loc`, `max_runtime_minutes`) decline and log. Touching `protected_paths` is allowed only with `Risk: protected` and ends `needs-review`; [[qsdlc-guard]] enforces the worktree fence and path rules.

## Outputs

- **Document: `plan.md`**, kept true as work happens, plus `ledger.md` and `review/<phase>.md` reports. See [[Documents]].
- **Artifact: implementation process map** (`implementation-process-map.html`): phases, dependencies, Pattern tags, hand-offs, review rounds, and parked items, drawn with `Diagram.layout` through [[qsdlc-present]]. See [[Artifacts]].

## Gate

**Interactive.** The user confirms the build matches the plan. **Autonomous.** The stage advances only if every phase is `done` or explicitly `parked` and review verdicts are clean; `Pending confirmation: build drafted by <run-id>` is set.

## Hand-off

[[4 - Test]] reads `spec.md` and `plan.md`; every requirement should map to at least one test case.
