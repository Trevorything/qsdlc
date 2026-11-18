---
name: qsdlc-qa
description: Draft or run the QA pass for a QSDLC feature. Mode 1 drafts eval.md linked to requirements and feature IDs, Mode 2 executes every row with evidence, Mode 3 verifies in the running app through the feature map with red-to-green proof and blast-radius checks. Use for the Test stage of QSDLC, in interactive or factory mode.
---

# qsdlc-qa: Test stage

Read [../_shared/conventions.md](../_shared/conventions.md) first. Template: [eval.template.md](../_shared/templates/eval.template.md).

`eval.md` columns: `ID | Req | Feature ID | Description | Steps | Expected result | Status | Evidence | Last run | Notes`. Statuses: `not run`, `pass`, `fail`, `blocked`. Summary lines: Total, Passed, Failed, Blocked, Not run, Last run. Totals must equal the table; `qsdlc-lint` V3 checks this.

## Mode 1: draft `eval.md`

When `eval.md` is absent:

1. Read `spec.md` (or `assessment.md` on bugfix) and `plan.md`.
2. One row per requirement (`F`/`R` ID in `Req`), plus edge cases, regressions in adjacent behavior, and performance or security rows the system requirements call for.
3. `Feature ID` links to `.qsdlc/factory/verify/features/` (sub-feature IDs such as `search-match`), or `n/a: <reason>`.
4. Add a **Blast radius** row for any change to existing behavior (see Mode 3, step 5).
5. Steps and expected results must be concrete enough that running them needs no interpretation.
6. Interactive: show the draft before running. Autonomous: proceed; lint must pass.

## Mode 2: execute `eval.md`

For each row: run it for real (test suite, browser, CLI, API call). Then:

1. Set `Status`, `Last run` (ISO date), and `Evidence`: a path to a file under `evidence/` or the factory evidence manifest that holds the output. **No evidence pointer, no `pass`.**
2. **A gap is not a pass.** If a check cannot run (missing precondition, unreachable route), mark `blocked` with Notes `unreachable: <prerequisite>; route: <command>`. Never report a skipped entry point as verified through a different path.
3. Fill Summary and "Open failures".
4. Run `node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --slug <slug>`. Fix any V3 or V5 error before reporting.

Independent rows may run as parallel subagents (`Batch Testing` or `Scatter`); each result must record the commit SHA and method, or it counts as a gap.

## Mode 3: verify in the running app

For user-facing features. Delegate map creation and upkeep to `qsdlc-verify`; this skill consumes the map.

1. Read `.qsdlc/factory/verify/README.md` and the feature file for each touched feature. No map entry: invoke `qsdlc-verify` to create one; if that is impossible, mark rows `blocked` and say so.
2. **Targets: local or staging only**, on disposable seeded data. Look elsewhere if needed; never act on production. Run the map's Doctor check before the first drive and after any failure.
3. Drive each recipe from its baseline. Capture action, resulting state, and side effects (rows, files, messages), plus a read-only second view for mutations. Write `manifest.json` per proof under `.qsdlc/factory/evidence/<run-id>/<feature-id>/` with `pii_scrubbed: true`. Seeded fixtures only in screenshots.
4. **Red to green.** For bugfix and for every fixed defect: write the regression test or repro first and show it **fail for the right reason** (`evidence/01-red.txt`), apply the minimal fix, then show it pass (`02-green.txt`), plus the original probe and one adjacent happy path.
5. **Blast radius.** Name the one fact the change is safe because of, and prove it by running code (confidence rung: ran a script or test against real code, or reproduced in the app). Standard probes: do any regulated output files or report fields change? Does rounding change? Are rules effective-dated? Does behavior depend on per-tenant or org-level policy config? Add domain probes from `policy.md`. Wire formats and "another reader of the same bytes" count.
6. **Classify each fix:** `verified` (red to green plus probes pass), `best-effort` (fix applied, one proof missing, stated), `reverted` (made things worse; revert it and log).
7. **Self-regulation.** Stop the pass after two reverts, or after one edit to a file unrelated to the defect. Never weaken or delete an existing test, never edit CI config.
8. **Converge.** Compare the code against `spec.md` and `plan.md`; append unbuilt requirements as new `not run` rows or a `ledger.md` item. Do not mark the stage passing while unbuilt requirements remain.

## Output

Invoke `qsdlc-present` to build `.qsdlc/<slug>/artifacts/performance-results.html`: pass and fail counts first, failure detail, fix classifications, performance numbers, evidence links. Sources in `artifacts/.craft/`.

## Gate

**Interactive:** all pass, then confirm with the user before advancing. With failures: present them and ask whether to return to `qsdlc-build` or knowingly accept them (accepted failures are listed in `docmd.md` known limitations). Never advance silently past a failing row.

**Autonomous:** advance only when no row is `fail` and every `blocked` row is justified in Notes; otherwise end `partial` or `failed` and mailbox. Set `Pending confirmation: test drafted by <run-id>`.
