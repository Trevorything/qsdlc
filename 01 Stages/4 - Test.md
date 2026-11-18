---
tags: [stage]
---

# 4 - Test

Verifies that the built feature does what the spec said, with a written, re-runnable record and evidence from this run.

## Inputs

`spec.md` (or `assessment.md` on a bugfix) and `plan.md`.

## Skills

[[qsdlc-qa]] runs in three modes. [[qsdlc-verify]] builds and maintains the feature map that Mode 3 uses.

**Mode 1, draft `eval.md`.** One row per requirement id, plus edge cases, regressions in adjacent behavior, and performance or security rows. Columns: `ID | Req | Feature ID | Description | Steps | Expected result | Status | Evidence | Last run | Notes`. A change to existing behavior adds a **Blast radius** row.

**Mode 2, execute.** Every row is run for real and given a `Status` (`not run`, `pass`, `fail`, `blocked`), a `Last run` date, and an `Evidence` pointer. **No evidence pointer, no pass.** A gap is not a pass: a check that cannot run is `blocked` with `unreachable: <prerequisite>; route: <command>`, never reported verified through a different path.

**Mode 3, verify in the running app.** For user-facing features, using the feature map under `.qsdlc/factory/verify/`:

- Targets are local or staging only, on disposable seeded data. Production is never acted on.
- Each proof records the action, the resulting state, and side effects, with a read-only second view for mutations, in a `manifest.json` with `pii_scrubbed: true`.
- **Red to green.** For a bugfix or any fixed defect: write the regression test or repro first and show it fail for the right reason (`evidence/01-red.txt`), apply the minimal fix, show it pass (`02-green.txt`), plus the original probe and one adjacent happy path.
- **Blast radius.** Name the one fact the change is safe because of and prove it by running code.
- Each fix is classified `verified`, `best-effort`, or `reverted`.
- **Self-regulation.** Stop after two reverts or one edit to a file unrelated to the defect. Never weaken or delete an existing test or edit CI config.
- **Converge.** Compare the code to the spec and plan and append unbuilt requirements as new rows; the stage does not pass while any remain.

## Deterministic checks

`qsdlc-lint` runs V3 (eval table, evidence pointers, totals), V4 (feature map shape), and V5 (manifests, personal-data patterns in evidence). Prose in the documents is checked by V10 and comments in the diff by V11. See [[Continuous Factory#Deterministic enforcement]] for V1 to V12.

## Outputs

- **Document: `eval.md`**, current with the latest run. See [[Documents]].
- **Artifact: performance results** (`performance-results.html`): verdict sentence and counts first, each failure with its eval id, expected versus actual, and evidence; every number sourced. Built through [[qsdlc-present]]. See [[Artifacts]].

## Gate

**Interactive.** If everything passes, the user confirms. With failures, the user decides whether to return to [[3 - Build]] or knowingly accept them; accepted failures go into `docmd.md` known limitations.

**Autonomous.** Advance only when no row is `fail` and every `blocked` row is justified; otherwise the run ends `partial` or `failed` with a mailbox entry.

## Hand-off

[[5 - Deploy]] proceeds on a passing or knowingly accepted result. After the Test stage, [[qsdlc-correct]] is the place a repeated failure becomes a check.
