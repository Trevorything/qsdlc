---
tags: [skill]
---

# qsdlc-pr

- **Stage**: [[5 - Deploy]]
- **Implementation**: `/skills/qsdlc-pr/SKILL.md`
- **Triggers on**: the Deploy stage of QSDLC, once `eval.md` shows results worth shipping

## What it does

Writes `docmd.md` from the full lifecycle record (`Intent.md`, `spec.md`, `plan.md`, `eval.md`). **Stops and requires explicit confirmation** before taking any repo action — drafting the doc never implies permission to push. Once confirmed: reviews what's staged, commits following the target repo's conventions, pushes, and opens the PR with a description drawn from `docmd.md` and `eval.md`.

## Produces

- `docmd.md` — the engineering-facing completion record
- The release notes artifact — a stakeholder-facing summary, deliberately different in tone from `docmd.md`
- A pull request, opened on confirmation

## See also

[[5 - Deploy]], [[Why QSDLC]] (on why the confirmation gate matters most here), [[Documents]], [[Artifacts]]
