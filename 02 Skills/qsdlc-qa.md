---
tags: [skill]
---

# qsdlc-qa

- **Stage**: [[4 - Test]]
- **Implementation**: `/skills/qsdlc-qa/SKILL.md`
- **Triggers on**: the Test stage of QSDLC, or whenever the user says to run the QSDLC evals. It is meant to be re-run, not a one-time step

## What it does

Three modes over `eval.md` (columns `ID | Req | Feature ID | Description | Steps | Expected result | Status | Evidence | Last run | Notes`; statuses `not run`, `pass`, `fail`, `blocked`).

1. **Draft.** When `eval.md` is absent: one row per requirement id, plus edge cases, adjacent regressions, performance and security rows, a `Feature ID` linking to the feature map (or `n/a: <reason>`), and a Blast radius row for any change to existing behavior.
2. **Execute.** Runs each row for real and sets `Status`, `Last run`, and an `Evidence` pointer. No evidence pointer, no pass. A gap is not a pass: an unrunnable check is `blocked` with `unreachable: <prerequisite>; route: <command>`. Independent rows may run in parallel (Batch Testing or Scatter), each recording its commit SHA and method.
3. **Verify in the running app.** Uses the map built by [[qsdlc-verify]]: local or staging targets only, action plus resulting state plus side effects captured in a `manifest.json`, a **red-to-green** proof for every fixed defect (`01-red.txt` then `02-green.txt`), a **blast radius** fact proved by running code, a classification of each fix as `verified`, `best-effort`, or `reverted`, self-regulation (stop after two reverts or one unrelated edit; never weaken a test or edit CI config), and a converge step that appends unbuilt requirements as new rows.

`qsdlc-lint` V3 and V5 must pass before it reports. In interactive mode the user confirms the result; failures are either sent back to [[qsdlc-build]] or knowingly accepted into `docmd.md`. In autonomous mode the stage advances only with no `fail` row and every `blocked` row justified, otherwise the run ends `partial` or `failed`.

## Produces

- `eval.md`, current with the latest run
- The performance results artifact `performance-results.html`: counts first, failure detail, fix classifications, evidence links; built through [[qsdlc-present]]

## See also

[[4 - Test]], [[qsdlc-verify]], [[qsdlc-correct]], [[Documents]], [[Artifacts]]
