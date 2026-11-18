---
name: qsdlc-triage
description: Classify a request or ticket into a QSDLC track (quick, bugfix, delta, full, discovery), compute the risk floor and autonomy_eligible, and declare skipped stages in state.md. Use when starting any QSDLC work, when a ticket arrives from the queue, when scope grows mid-run (re-triage), or when the user asks "how big is this" or "which track".
---

# qsdlc-triage

Read [../_shared/conventions.md](../_shared/conventions.md). Triage never prompts. Unknowns become recorded Assumptions.

## 1. Gather signals

Probe the code (read-only), then answer each:

| Signal | Source |
|---|---|
| Intent already defined? | ticket, request, existing `Intent.md` |
| Existing behavior broken, repro exists? | ticket, quick repro attempt |
| Approx changed LOC (target 500 or fewer, tests excluded) | grep and file reads |
| Blast radius and coupled callers | `qsdlc-graphify` (`summary`, `affected`) when `graphify-out/graph.json` exists, else grep |
| Files touched (a handful, about 12 or fewer) | same |
| Fits one session? | the three above |
| Output is knowledge, not code? | the ask |
| Protected paths hit | globs in `.qsdlc/factory/policy.md` |
| Regulatory impact (billing, payroll, tax, regulated exports; the project lists its own in `policy.md`) | the ask plus touched modules |

## 2. Pick the track

1. Output is knowledge or a decision: `discovery`.
2. Behavior is broken: `bugfix`.
3. Intent defined, one session, no protected paths: `quick`.
4. Established system, behavior change: `delta`.
5. Novel, unclear intent, or well over 500 LOC: `full`.

**Risk floor.** Risk can only raise the track, never lower it. Any protected path hit or regulatory impact `possible` or `confirmed` sets `Risk: protected` and a floor of `bugfix` or `delta`. A quick fix to billing or tax math is not `quick`. Protected runs always end in a human-reviewed PR (`needs-review`).

## 3. Autonomy

`Autonomy eligible: true` only if the track is `quick`, `bugfix`, or `delta`, the estimate is inside `policy.md` limits (`max_files`, `max_changed_loc`), `discovery` is read-only so also eligible, and the run is in a mode with a standing grant. `full` is never eligible: autonomous mode may draft `Intent.md` and `spec.md` to a PR for review only. Protected risk stays eligible to produce a PR, never to advance past it.

## 4. Write the decision

Update `.qsdlc/<slug>/state.md` (create from `state.template.md` if missing):

- `Track`, `Risk`, `Autonomy eligible`, `Mode`
- `Skipped:` stages not run for this track (quick skips plan and design; bugfix skips design; discovery skips build, test, deploy), each with a log line giving the reason
- Append a log line: `<ISO> triage: track=<t> risk=<r> eligible=<bool>`
- Add `## Assumptions` to `Intent.md` for every guessed signal (what, why, cost if wrong)

A skipped stage is explicit in state, never implied by a missing file.

## 5. Re-triage upward

Re-run when a run exceeds its LOC or file estimate, touches a protected path, or needs a spec it lacks. Move to a heavier track only. Keep existing documents, produce the missing ones, and append the change to the `state.md` log. Never drop to a lighter track mid-run.

## 6. Verify

```
node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --slug <slug>
```

Pass means V1 and V2 are clean: fields in enum, `Skipped` consistent with the files present.

## Return

Reply in GREAT form. Takeaway line: `track=<t> risk=<r> eligible=<bool> skipped=<list>`.
