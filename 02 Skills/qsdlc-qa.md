---
tags: [skill]
---

# qsdlc-qa

- **Stage**: [[4 - Test]]
- **Implementation**: `/skills/qsdlc-qa/SKILL.md`
- **Triggers on**: the Test stage of QSDLC, or whenever the user says to run the QSDLC evals — this is meant to be re-run, not a one-time step

## What it does

Two modes. **Draft**: if `eval.md` doesn't exist, writes it from `spec.md`/`plan.md` — one test case per feature, plus edge cases and regressions. **Execute**: runs every case in an existing `eval.md`, actually verifying each one (not assuming a pass), and updates status/notes in place.

## Produces

- `eval.md`, kept current with the latest run's results
- The performance results artifact — pass/fail counts up front, failure detail below

## See also

[[4 - Test]], [[Documents]], [[Artifacts]]
