---
tags: [stage]
---

# 2 - Design

Moves the intent from [[1 - Plan]] into grounded features and system requirements. Skipped on the `quick` and `bugfix` tracks, where Build works from the ticket or from `assessment.md`.

## Inputs

`Intent.md`, the project's `.qsdlc/factory/policy.md` if it exists (its `constitution` is the non-negotiable rule set), and the living spec for each capability the change touches (`.qsdlc/specs/<capability>/spec.md`).

## Skills

[[qsdlc-design]] is the primary skill. For creative or "like X" asks it calls [[qsdlc-feature-research]] to fill the open-source references from real prior art.

1. **Answer the research questions from code.** Before drafting requirements, the questions in `Intent.md` are answered under `## Current behavior` in `spec.md`, each with `file:line`. Live code beats any document about current behavior.
2. **Requirements as deltas.** `spec.md` uses `## ADDED Requirements`, `## MODIFIED Requirements` (with `(Previously: ...)`), and `## REMOVED Requirements`, the delta format borrowed from OpenSpec (see [[Alternatives to pstack]]). Each requirement has a stable id (`F1` functional, `R1` non-functional) and GIVEN/WHEN/THEN scenarios, and `eval.md` rows cite those ids. Greenfield work uses ADDED only. If the regulatory flag is set, a requirement for invariant or property tests on the calculation is added.
3. **Prototype fork.** For a decision a run can settle (library choice, layout feasibility, query cost), a throwaway under `artifacts/.craft/prototype-<n>/` is built and run, and a three-line decision (Options, Result, Choice) goes into the spec.
4. **Checks before anything is shown.**
   - **Analyze** (read-only): every success criterion maps to a requirement, no requirement lacks a scenario, none contradicts a non-goal. A violation of the `policy.md` constitution is CRITICAL and is never reinterpreted away. Findings go in a table under `## Analyze`.
   - **Requirement-quality checklist**: one box per question (complete, clear, consistent, testable, edge cases). The author never ticks it. In interactive mode the user does; in autonomous mode a fresh reviewer subagent does and records its name.
   - `qsdlc-lint` for the feature.

## Outputs

- **Document: `spec.md`**: features and acceptance, system requirements, architecture sketch, open-source references, risks, and a decision log. See [[Documents]].
- **Artifact: design pitch deck** (`design-pitch-deck.html`): problem recap, proposed solution, key flows, why this approach, with the architecture drawn by `Diagram.layout`. Built through [[qsdlc-present]]. See [[Artifacts]].

## Gate

**Interactive.** The user walks through the deck and the spec; pushback is recorded in "Decisions made during design review," and the stage advances only on explicit confirmation.

**Autonomous.** The stage passes only if analyze has zero CRITICAL findings, the checklist is fully ticked by the reviewer, and lint is clean. Otherwise the run ends `blocked` with a mailbox entry. `Pending confirmation: design drafted by <run-id>` is set either way.

## Living specs

On a `delta` run, [[qsdlc-pr]] merges the ADDED, MODIFIED, and REMOVED requirements into `.qsdlc/specs/<capability>/spec.md` when the work is done. Specs grow only where deltas land; nobody documents the whole codebase up front.

## Hand-off

[[3 - Build]] reads `Intent.md` and `spec.md`. Build should not have to guess what was agreed.
