---
name: qsdlc-design
description: Turn a completed Intent.md into grounded feature and system requirements (spec.md), and produce a design pitch deck artifact presenting the execution vision for review. Use for the Design stage of QSDLC, after Intent.md exists.
---

# qsdlc-design — Design stage

Read [../_shared/conventions.md](../_shared/conventions.md) first.

## Purpose

Move from vision (`Intent.md`) to grounded, buildable requirements (`spec.md`). Where Plan captured *what and why*, Design captures *what, precisely, and how it fits the system*.

## Process

1. Read `.qsdlc/<feature-slug>/Intent.md`. If it doesn't exist, stop and say the Plan stage needs to run first (via `qsdlc-interview`) — don't improvise an intent from scratch.
2. If the ask is creative, novel, or references "something like X" — use the **`Skill` tool** to invoke `qsdlc-feature-research` before writing the spec, so requirements are grounded in real prior art rather than invented from nothing. Skip this for purely mechanical/internal work where prior art doesn't apply.
3. Draft `spec.md` from [../_shared/templates/spec.template.md](../_shared/templates/spec.template.md):
   - **Features**: functional requirements with acceptance criteria — specific enough that Build can act on them without re-asking the user what was meant.
   - **System requirements**: non-functional — performance, security, accessibility, integration points, data handling.
   - **Architecture sketch**: how this fits what already exists — new vs. touched components, data flow.
   - **Open-source references**: pull in whatever `qsdlc-feature-research` found.
   - **Risks/unknowns**: name anything likely to change once Build starts.
4. Produce the **design pitch deck artifact** at `.qsdlc/<feature-slug>/artifacts/design-pitch-deck.html`: presented like a pitch — problem recap, proposed solution, key flows/screens, why this approach over alternatives. If it needs an architecture or flow diagram, check for the **Archify** skill (see the artifact convention in the shared conventions doc) and use it; fall back to Mermaid otherwise.

## Review

Walk the user through the pitch deck and spec together. Capture any pushback or changes directly back into `spec.md`'s "Decisions made during design review" section before marking the stage complete in `state.md` — per the stage-gate rule, don't advance without that confirmation.
