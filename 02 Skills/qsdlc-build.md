---
tags: [skill]
---

# qsdlc-build

- **Stage**: [[3 - Build]]
- **Implementation**: `/skills/qsdlc-build/SKILL.md`
- **Triggers on**: the Build stage of QSDLC, in interactive or factory mode, after `spec.md` exists (`quick` and `bugfix` build from `Intent.md` or `assessment.md`)

## What it does

**Part A, draft `plan.md`.** Ordered phases, each with Goal, Steps, Files touched, Verification, Depends on, and three tags: `Developer skill` (see [[Developer Skills]]), `Pattern` (one of the nine Agent Relay Patterns, chosen by asking branch, loop, or swarm), and `Requirements` (the `F`/`R` ids from the spec). Interactive: executes only after the user confirms. Autonomous: the plan must pass the analyze cross-check instead.

**Part B, execute.**

- Works in a worktree, recording `Base SHA`, `Branch`, and `Worktree` in `state.md`.
- Keeps `ledger.md`, written before and after each phase; after context loss it resumes from the ledger and `git log`. In autonomous mode it records `Ruling:` lines instead of asking.
- Dispatches **one fresh subagent per phase**, briefed in GREAT form only. The orchestrator reads only the Takeaway and checks `git diff --stat`.
- Hands parallel phases to [[qsdlc-herdr]] lanes inside Herdr, otherwise to concurrent subagents with `isolation: worktree`. Lanes never merge.
- Runs [[qsdlc-review]] after each phase, with the capped fix loop (3 rounds interactive, `max_fix_rounds` autonomous), one stronger-model round, then parking. The orchestrator never fixes findings itself.
- Requires evidence before claims: verification output under `evidence/`, a diff check, and a clean review verdict.

Autonomous limits (`max_files`, `max_changed_loc`, `max_runtime_minutes`) decline and log; protected paths are allowed only with `Risk: protected` and end `needs-review`.

## Produces

- `plan.md` with true statuses, `ledger.md`, and `review/<phase>.md`
- The implementation process map `implementation-process-map.html`, built through [[qsdlc-present]]

## See also

[[3 - Build]], [[qsdlc-review]], [[qsdlc-herdr]], [[Developer Skills]], [[Documents]], [[Artifacts]]
