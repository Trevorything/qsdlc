---
name: qsdlc-review
description: Two-stage review of one QSDLC build phase or branch. Stage 1 checks spec compliance, stage 2 checks code quality, using a persona roster picked by touched paths. Includes the capped fix loop, scoped re-review, unslop and comment checks. Use after any plan.md phase completes, before a draft PR, or when the user says "review this phase".
---

# qsdlc-review

Read [../_shared/conventions.md](../_shared/conventions.md). The reviewer is **read-only** and spawns nothing. It never fixes.

## 1. One diff read, two verdicts

Read the phase from `plan.md`, the spec excerpt, and `git diff <base>..HEAD`. The implementer's report is **unverified claims**; check each against the diff. A stated rationale ("left per YAGNI") never lowers severity.

- **Stage 1, spec compliance:** every requirement in the phase is implemented, nothing extra, nothing in Intent non-goals touched.
- **Stage 2, code quality:** only after stage 1 is clean enough to judge.

Severity: `Critical` (wrong or unsafe), `Important` (likely defect or contract break), `Minor` (style, nit).

## 2. Persona roster

Always: `correctness`, `project-standards`. Add by what the diff touches:

| Persona | When |
|---|---|
| testing | test files or behavior change |
| maintainability | 200 or more changed lines |
| security | auth, input, PII, secrets |
| performance | queries, loops over data, hot paths |
| api-contract | routes, schemas, exported types |
| data-migration | migrations, schema |
| reliability | retries, jobs, IO |
| adversarial | protected paths or money logic |
| compliance-calc | billing, payroll, tax, regulated exports (check rounding, effective dates, org-level policy config, output file fields; product rules come from `policy.md`) |

Reconcile persona output into one verdict per stage.

## 3. Mechanical checks

```
node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --slug <slug> --json
```

V10 (prose) and V11 (comments) must pass on the diff. Comments die unless one of five keeps applies: legal header, constraint forced by an external dependency, `prettier-ignore` or lint suppression carrying a `qsdlc-exception(reason; expires; approver)` record, public API doc, issue or RFC link. When unsure, the comment dies and the symbol is flagged `MUST KILL` for rename, extract, or type.

## 4. Findings loop

- `Minor`: append to `ledger.md` under Parked, never loop.
- `Critical` and `Important`: loop with a cap of **3 rounds interactive, 2 autonomous**.
  - Rounds resume the original implementer. Re-review is **scoped to the fix diff** only.
  - After the cap: a fresh implementer on a stronger model gets one round.
  - Still failing: park (WIP branch, ruling in `ledger.md`, log line, mailbox in autonomous mode).
- A silent discard of a finding is forbidden. The controller never fixes findings itself.

## 5. Report

Write `.qsdlc/<slug>/review/<phase>.md`: verdicts, findings table (severity, file:line, claim, evidence, status), rounds used, parked items, personas run. No claim without a file:line.

## Return

GREAT form. Takeaway: `stage1=<pass|fail> stage2=<pass|fail> open=<n critical, n important> parked=<n>`.
