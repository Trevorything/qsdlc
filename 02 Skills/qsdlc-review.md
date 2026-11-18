---
tags: [skill, factory]
---

# qsdlc-review

- **Stage**: [[3 - Build]] (runs after every plan phase)
- **Implementation**: `/skills/qsdlc-review/SKILL.md`
- **Triggers on**: a `plan.md` phase completing, a draft PR about to open, or "review this phase"

## What it does

Reviews one build phase or branch in two stages from a single diff read. The reviewer is read-only, spawns nothing, and never fixes.

- **Stage 1, spec compliance.** Every requirement in the phase is implemented, nothing extra, no Intent non-goal touched.
- **Stage 2, code quality.** Judged only once stage 1 is clean enough.

The implementer's report is treated as unverified claims, each checked against `git diff <base>..HEAD`. A stated rationale never lowers severity. Severities are `Critical`, `Important`, and `Minor`.

**Persona roster.** `correctness` and `project-standards` always run. Others join by what the diff touches: testing, maintainability (200 or more changed lines), security, performance, api-contract, data-migration, reliability, adversarial (protected paths or money logic), and compliance-calc (billing, payroll, tax, regulated exports). Output is reconciled into one verdict per stage.

**Mechanical checks.** `qsdlc-lint --json` must pass V10 (prose) and V11 (comments) on the diff. A comment survives only for a legal header, an external-dependency constraint, a suppression with a `qsdlc-exception(reason; expires; approver)` record, a public API doc, or an issue or RFC link.

**Findings loop.** `Minor` findings go to `ledger.md` under Parked and never loop. `Critical` and `Important` loop with a cap of 3 rounds interactive, 2 autonomous. Each re-review is scoped to the fix diff. After the cap a fresh implementer on a stronger model gets one round; if that fails, the phase is parked with a ruling, a log line, and (autonomous) a mailbox entry. A silent discard is forbidden, and the controller never fixes findings itself.

## Produces

`.qsdlc/<slug>/review/<phase>.md`: verdicts, a findings table (severity, `file:line`, claim, evidence, status), rounds used, parked items, personas run. Its Takeaway line reads `stage1=<pass|fail> stage2=<pass|fail> open=<n critical, n important> parked=<n>`.

## See also

[[qsdlc-build]], [[qsdlc-herdr]] (Audit topology), [[qsdlc-correct]], [[3 - Build]]
