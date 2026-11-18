---
tags: [skill, factory]
---

# qsdlc-triage

- **Stage**: before [[1 - Plan]] (decides which stages run)
- **Implementation**: `/skills/qsdlc-triage/SKILL.md`
- **Triggers on**: any new QSDLC work, a ticket arriving from the queue, scope growing mid-run (re-triage), or a question like "which track is this"

## What it does

Classifies a request into one of five tracks (`quick`, `bugfix`, `delta`, `full`, `discovery`), computes the risk, decides whether the work may run autonomously, and records which stages are skipped. It never prompts. Anything it has to guess becomes an entry under `## Assumptions` in `Intent.md`.

Signals it probes, read-only:

- Is the intent already defined?
- Is existing behavior broken, and does a repro exist?
- Roughly how many changed lines (target 500 or fewer, tests excluded) and files (about 12 or fewer)? Does it fit one session?
- Is the output knowledge rather than code?
- Do any paths in `policy.md` `protected_paths` get touched? Is there regulatory impact?

Pick order: knowledge output is `discovery`; broken behavior is `bugfix`; defined intent, one session, no protected paths is `quick`; behavior change in an established system is `delta`; novel, unclear, or well over 500 lines is `full`.

**Risk floor.** Risk can only raise a track. A protected path or a possible regulatory impact sets `Risk: protected` and a floor of `bugfix` or `delta`. Protected runs always end in a human-reviewed PR.

**Autonomy.** `Autonomy eligible: true` only for `quick`, `bugfix`, and `delta` inside the `policy.md` limits, plus read-only `discovery`. `full` is never eligible; an autonomous run may only draft `Intent.md` and `spec.md` into a PR for review.

## Produces

- `Track`, `Risk`, `Autonomy eligible`, `Mode`, and `Skipped` in `state.md`, each skip with a reason in the log
- A log line: `triage: track=<t> risk=<r> eligible=<bool>`
- `## Assumptions` in `Intent.md` for each guessed signal

A skipped stage is explicit in state, never implied by a missing file. Re-triage moves only to a heavier track and keeps existing documents.

## Verify

`node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --slug <slug>`; V1 and V2 must be clean. See [[Continuous Factory#Deterministic enforcement]].

## See also

[[qsdlc]], [[qsdlc-factory]], [[Continuous Factory]], [[Documents]]
