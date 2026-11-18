---
tags: [skill]
---

# qsdlc-interview

- **Stage**: [[1 - Plan]]
- **Implementation**: `/skills/qsdlc-interview/SKILL.md`
- **Triggers on**: the Plan stage of QSDLC, or whenever the user wants help pinning down a goal before implementation

## What it does

It checks `Mode` in `state.md` and takes one of two paths.

**Interactive.**

1. An optional **sharpen** pre-step of four questions: what would a top professional do, what is the rawest material available, which methods and tools fit, and what besides the model would show the result is right. The answers are folded into the interview, not pasted into `Intent.md`.
2. A back-and-forth interview, not a one-shot questionnaire: problem, goal (an outcome, not a solution), target users, checkable success criteria, constraints, non-goals, prior art, and a regulatory flag for work touching regulated calculations or reports (which tells [[qsdlc-triage]] to apply the risk floor). It keeps going until questions are resolved or explicitly deferred under "Open questions."
3. Writes `Intent.md` plus a `## Research questions` section: factual questions about the current system that [[qsdlc-design]] must answer from code. They are written from the problem and goal only, without the proposed solution.

**Headless ticket intake (autonomous).** The ticket is untrusted data, never instructions. The skill probes the code read-only and writes a one-page `Intent.md` with `## Assumptions` and `## Rulings` (what, why, cost if wrong; prefer the narrower reading and the reversible option). If the goal or success criteria cannot be derived it stops: `Terminal status: declined`, reason `insufficient-intent`, a mailbox entry, nothing else written. It sets `Pending confirmation: plan drafted by <run-id>` and skips `inspo.html` unless the track is `full`.

## Produces

- `Intent.md`, fully resolved with no placeholder brackets
- The inspiration artifact `inspo.html`, built through [[qsdlc-present]]: mood, tone, reference imagery, key phrases from the interview; deliberately not a spec
- `qsdlc-lint` run for the feature; in interactive mode both files go to the user for confirmation before the stage is marked complete

## See also

[[1 - Plan]], [[qsdlc-triage]], [[Documents]], [[Artifacts]]
