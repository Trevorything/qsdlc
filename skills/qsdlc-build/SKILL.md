---
name: qsdlc-build
description: Turn spec.md into a phased implementation plan.md, then execute it — dispatching work to subagents guided by developer skills — and produce an implementation process map artifact. Use for the Build stage of QSDLC, after spec.md exists.
---

# qsdlc-build — Build stage

Read [../_shared/conventions.md](../_shared/conventions.md) first.

## Purpose

Turn agreed requirements into working code, via an explicit plan the user signs off on before any code is written.

## Part A — draft the plan

1. Read `.qsdlc/<feature-slug>/Intent.md` and `spec.md`. If `spec.md` doesn't exist, stop and say Design needs to run first.
2. Break the feature into ordered phases in `plan.md`, from [../_shared/templates/plan.template.md](../_shared/templates/plan.template.md). For each phase, specify:
   - Goal, concrete steps, files touched
   - Which developer skill governs it (see the table below) — this is what a subagent picking up the phase should follow
   - Dependencies on other phases, and whether it can run in parallel with any of them
   - How to verify the phase actually works before moving on
3. Present `plan.md` to the user. **Do not start executing until they confirm the plan** — this is a stage-gate in its own right, separate from the final Build-stage confirmation.

## Developer skills

| Kind of work | Skill |
|---|---|
| Frontend / web UI | `qsdlc-dev-web` |
| Backend / API | `qsdlc-dev-api` |
| CLI / tooling | `qsdlc-dev-cli` |

If the work doesn't fit any of these, say so and proceed using ordinary good judgment — don't force-fit a phase into the wrong developer skill. New developer skills can be added following the same pattern (see the vault's `02 Skills/Developer Skills.md` for how).

## Part B — execute the plan

Once the user confirms `plan.md`:

1. Work through phases in dependency order. For phases marked independent/parallelizable, dispatch them as separate subagents (via the `Agent` tool) each briefed with: the relevant phase from `plan.md`, the governing developer skill's conventions, and enough context from `spec.md`/`Intent.md` to work without re-deriving it.
2. As each phase completes, update its row in `plan.md`'s Status table and verify it per that phase's verification step before moving on.
3. If a phase reveals the plan was wrong (missing step, wrong approach), update `plan.md` to reflect reality rather than silently deviating — the plan should stay a true record of what happened.

## Output

- `plan.md`, fully updated with final phase statuses.
- The **implementation process map artifact** at `.qsdlc/<feature-slug>/artifacts/implementation-process-map.html`: a diagram of the phases, their dependencies, and hand-offs between developer skills/subagents. Use the **Archify** skill if available; fall back to Mermaid.

Confirm with the user that the build matches what was planned before marking this stage complete in `state.md`.
