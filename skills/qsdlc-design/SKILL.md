---
name: qsdlc-design
description: Turn Intent.md into grounded requirements (spec.md) using ADDED/MODIFIED/REMOVED deltas against living specs, cross-check Intent, spec, and plan, and produce a design pitch deck. Use for the Design stage of QSDLC, in interactive or factory mode, after Intent.md exists.
---

# qsdlc-design: Design stage

Read [../_shared/conventions.md](../_shared/conventions.md) first. Template: [spec.template.md](../_shared/templates/spec.template.md).

## 1. Inputs

1. Read `Intent.md`. Missing: stop and send the user to `qsdlc-interview`. Do not improvise an intent.
2. Read `.qsdlc/factory/policy.md` if it exists (the constitution). Read `.qsdlc/specs/<capability>/spec.md` for each capability the change touches.
3. Answer `Intent.md`'s `## Research questions` from the code **before drafting requirements**. If `graphify-out/graph.json` exists, use `qsdlc-graphify` (`query`, `path`, `affected`) to map call paths cleanly, then verify exact `file:line` in live source. Record answers in `spec.md` under `## Current behavior`, each with `file:line`. Live code beats any document or graph edge about current behavior.
4. Creative, novel, or "like X" asks: invoke `qsdlc-feature-research` to fill Open-source references. Skip for mechanical work.

## 2. Draft `spec.md`

- **Requirements as deltas.** Use `## ADDED Requirements`, `## MODIFIED Requirements` (include `(Previously: ...)`), `## REMOVED Requirements` (remove the last requirement of a capability only with `retire_capabilities: true`). Greenfield work uses ADDED only.
- Each requirement has a stable ID (`F1` functional, `R1` non-functional) and GIVEN/WHEN/THEN scenarios. `eval.md` rows cite these IDs.
- Sections still required: System requirements, Architecture sketch, Open-source references, Risks/unknowns, Decisions made during design review.
- Regulatory flag set: add a requirement for invariant or property tests on the calculation, and note the regulated output files or report fields that could change.

## 3. Prototype fork

For a decision you can settle by running something (library choice, layout feasibility, query cost): build a throwaway under `artifacts/.craft/prototype-<n>/`, run it, and record a three-line decision in `spec.md` (`Options`, `Result`, `Choice`). The prototype feeds the spec; it does not replace it. For a fork a prototype cannot settle, record the options and the criterion for choosing.

## 4. Checks

Run all three before showing anything:

1. **Analyze (read-only).** Compare `Intent.md`, `spec.md`, and `plan.md` if present: every success criterion maps to a requirement; no requirement lacks a scenario; no requirement contradicts a non-goal. Any violation of the `policy.md` constitution is **CRITICAL** and is never reinterpreted away. Write findings as a table under `## Analyze` in `spec.md`.
2. **Requirement-quality checklist.** Append `## Quality checklist`: one box per question (complete, clear, consistent, testable, edge cases covered). A box means the reviewer judged the requirement good. **The author never ticks it.** Interactive: the user ticks. Autonomous: a fresh reviewer subagent ticks and records its name.
3. `node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --slug <slug>`; fix errors.

## 5. Artifact

Invoke `qsdlc-present` to build `.qsdlc/<slug>/artifacts/design-pitch-deck.html`: problem recap, proposed solution, key flows, why this approach over the alternatives, architecture via `Diagram.layout`. When a specialized `architecture`, `sequence`, `erd`, `dataflow`, or `lifecycle` diagram clarifies the pitch and `archify` is installed, invoke `qsdlc-archify` (placing companions under `artifacts/.craft/archify/` or upgrading the deck). Sources in `artifacts/.craft/`.

## 6. Review and gate

**Interactive:** walk the user through deck and spec; record pushback in "Decisions made during design review"; advance `state.md` only after explicit confirmation.

**Autonomous:** the stage passes only if analyze has zero CRITICAL, the checklist is fully ticked by the reviewer, and lint is clean. Otherwise set `Terminal status: blocked`, mailbox the reason, stop. Set `Pending confirmation: design drafted by <run-id>`.

## 7. Living specs

Delta track on `done`: merge ADDED, MODIFIED, and REMOVED into `.qsdlc/specs/<capability>/spec.md` (Purpose, Requirements, Scenarios). `qsdlc-pr` performs the merge; this skill only states the deltas precisely enough to apply mechanically. Specs grow only where deltas land; never document the whole codebase.
