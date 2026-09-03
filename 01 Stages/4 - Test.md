---
tags: [stage]
---

# 4 — Test

Verifies the built feature actually does what the spec said it would, with a written, re-runnable record.

## Inputs

`spec.md` and `plan.md`.

## Skill

[[qsdlc-qa]] runs in two modes: drafting `eval.md` (one test case per feature in `spec.md`, plus edge cases and regressions) when it doesn't exist yet, and executing every case in it — updating pass/fail status in place — whenever the user asks to "run the evals." Re-running is a first-class use case, not a one-time step.

## Outputs

- **Document — `eval.md`**: test cases, their steps, expected results, and current status. See [[Documents]].
- **Artifact — performance results**: a data-first status report — pass/fail counts, failure detail, any performance numbers gathered. See [[Artifacts]].

## Hand-off

If everything passes, [[5 - Deploy]] proceeds. If there are failures, the user decides whether to loop back to [[3 - Build]] to fix them or knowingly accept and document them — accepted failures flow into `docmd.md`'s known-limitations section, they don't just disappear.
