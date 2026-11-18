---
tags: [skill, factory]
---

# qsdlc-correct

- **Stage**: after [[4 - Test]] and [[5 - Deploy]] (also runs as the `compound` ritual)
- **Implementation**: `/skills/qsdlc-correct/SKILL.md`
- **Triggers on**: the same correction happening twice, repeated review comments, a stage finishing, or a `promote-to-check` flag in a developer skill

## What it does

Turns a repeated mistake into an enforced check. One lesson per run.

1. **Find classes.** Sources are `eval.md` failures, `review/*.md`, PR comments, reverts, workaround comments, user corrections, and `promote-to-check` flags. Each occurrence is logged with `qsdlc-log.mjs correction`. A class counts at its second occurrence. `qsdlc-log.mjs metrics --json` picks the class with status `repeat` first, then the most frequent `uncovered_classes` entry.
2. **Counterfactual.** If a future engineer working from the current tree would not repeat the mistake, write nothing and end with `Correction skipped: <reason>`.
3. **Fix at the highest level that works**, in this order: architecture (one owner, one way), types (make the bad state unrepresentable), a lint or CI check whose error names what to use instead, tests, and docs or agent rules last. Record why each higher level failed before settling for a lower one. Comment and prose classes are enforced by `qsdlc-lint` V10 or V11, not by a paragraph in a skill.
4. **Prove.** Commit the failing proof first (the enforcer run against the original mistake), then the fix, one commit per class. Exceptions sit on the offending line as `qsdlc-exception(reason; expires: YYYY-MM-DD; approver: name)` and fail once expired.
5. **Record.** `qsdlc-log.mjs correction ... --status enforced --proof <sha>`, then `qsdlc-log.mjs rules --write`. `enforced` needs an enforcer that exists and a proof SHA that is an ancestor of `HEAD` (V7). `corrections.tsv` and `rules.md` are never edited by hand; an enforced class that recurs gets status `repeat` and a fix at a higher level.

Draft PR per class when a grant allows; never merge; never edit skills unattended. The last line of a non-interactive run is exactly `Correction complete` or `Correction skipped: <reason>`.

## Produces

Rows in `.qsdlc/factory/corrections.tsv`, a regenerated `rules.md`, the enforcer, and the metrics `doc_level_share`, `repeat_rate`, and `uncovered_classes`.

## See also

[[Continuous Factory#The correction ratchet]], [[Developer Skills]], [[Adding a Developer Skill]], [[qsdlc-audit]]
