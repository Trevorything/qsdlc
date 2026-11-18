---
tags: [skill]
---

# qsdlc-design

- **Stage**: [[2 - Design]]
- **Implementation**: `/skills/qsdlc-design/SKILL.md`
- **Triggers on**: the Design stage of QSDLC, in interactive or factory mode, after `Intent.md` exists

## What it does

Reads `Intent.md` (stopping and sending the user back to [[qsdlc-interview]] if it is missing), then `policy.md` and the living specs for the capabilities the change touches.

- **Answers the research questions from code** under `## Current behavior`, each with `file:line`, before drafting any requirement.
- **Writes requirements as deltas**: `## ADDED Requirements`, `## MODIFIED Requirements` (with `(Previously: ...)`), `## REMOVED Requirements`. Each has a stable id (`F1`, `R1`) and GIVEN/WHEN/THEN scenarios that `eval.md` rows cite. Retiring the last requirement of a capability needs `retire_capabilities: true`.
- **Grounds creative asks** by invoking [[qsdlc-feature-research]].
- **Prototype fork**: a decision a run can settle gets a throwaway under `artifacts/.craft/prototype-<n>/` and a three-line record (Options, Result, Choice).
- **Runs three checks before showing anything**: a read-only *analyze* across Intent, spec, and plan (a `policy.md` constitution violation is CRITICAL), a requirement-quality checklist that the author never ticks, and `qsdlc-lint`.

In interactive mode it walks the user through the deck and spec and records pushback under "Decisions made during design review." In autonomous mode the stage passes only with zero CRITICAL analyze findings, a checklist ticked by a fresh reviewer subagent, and clean lint; otherwise the run ends `blocked`.

On a `delta` run it states the deltas precisely enough for [[qsdlc-pr]] to merge them mechanically into `.qsdlc/specs/<capability>/spec.md`.

## Produces

- `spec.md` from the spec template
- The design pitch deck `design-pitch-deck.html`, built through [[qsdlc-present]] with `Diagram.layout` for the architecture

## See also

[[2 - Design]], [[qsdlc-feature-research]], [[Documents]], [[Artifacts]]
