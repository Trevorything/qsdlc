---
tags: [skill]
---

# qsdlc-build

- **Stage**: [[3 - Build]]
- **Implementation**: `/skills/qsdlc-build/SKILL.md`
- **Triggers on**: the Build stage of QSDLC, after `spec.md` exists

## What it does

Two parts. **Part A**: reads `Intent.md` and `spec.md`, drafts `plan.md` as ordered phases (each tagged with a governing [[Developer Skills|developer skill]]), and gets explicit sign-off before writing any code. **Part B**: executes the confirmed plan, dispatching independent phases to subagents briefed with the relevant developer skill's conventions, updating `plan.md`'s status table as it goes.

## Produces

- `plan.md`, kept as a true record of what actually happened (not left stale)
- The implementation process map artifact — a diagram of phases, dependencies, and hand-offs, built with Archify where available

## See also

[[3 - Build]], [[Developer Skills]], [[Documents]], [[Artifacts]]
