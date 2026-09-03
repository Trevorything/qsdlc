---
tags: [stage]
---

# 3 — Build

Turns agreed requirements into an execution plan, then into working code.

## Inputs

`Intent.md` and `spec.md`.

## Skill

[[qsdlc-build]] drafts `plan.md` as an ordered set of phases — each with steps, files touched, a governing developer skill, dependencies, and a verification step — and gets the user's sign-off on the plan *before* writing any code. Once confirmed, it executes the phases, dispatching independent ones to subagents briefed with the relevant [[Developer Skills|developer skill]]'s conventions.

## Developer skills

Phases are tagged with which developer skill governs them — `qsdlc-dev-web`, `qsdlc-dev-api`, `qsdlc-dev-cli`, or a stack-specific one you've added. See [[Developer Skills]] for the pattern and how to extend it.

## Outputs

- **Document — `plan.md`**: the full implementation plan, kept updated with real phase statuses as work happens (not left as a stale pre-build draft). See [[Documents]].
- **Artifact — implementation process map**: a diagram of the phases, dependencies, and hand-offs, built with Archify where available. See [[Artifacts]].

## Hand-off

[[4 - Test]] reads `spec.md` and `plan.md` to build its test coverage — every feature in the spec should map to at least one test case.
