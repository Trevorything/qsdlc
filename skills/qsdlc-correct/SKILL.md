---
name: qsdlc-correct
description: Turn a repeated mistake into an enforced check. Counts correction classes, fixes each at the highest level that works, proves the enforcer fails on the real past mistake, records it in corrections.tsv and regenerates rules.md. Use when the same correction happens twice, after a Test or Deploy stage, for review comments that repeat, or when a qsdlc-dev skill flags promote-to-check.
---

# qsdlc-correct

Read [../_shared/conventions.md](../_shared/conventions.md). One lesson per run.

## 1. Find classes

Sources: `eval.md` failures, `review/*.md`, PR comments, reverts, comments that explain workarounds, user corrections, and `promote-to-check` flags in `qsdlc-dev-*` skills. Log each occurrence:

```
node <SKILLS>/_shared/scripts/qsdlc-log.mjs correction --root . --class <kebab-class> --source <review|ci|eval|revert|session|user> --evidence <pointer> --area <area> --level doc --status open
```

A **class counts at its second occurrence**. Check the current state:

```
node <SKILLS>/_shared/scripts/qsdlc-log.mjs metrics --root . --json
```

Pick the class with `repeat` status first (it outranks everything), then the most frequent `uncovered_classes` entry.

## 2. Counterfactual

Would a future engineer working from the current tree repeat this? If not, write nothing and end with `Correction skipped: <reason>`.

## 3. Fix at the highest level that works

1. **Architecture:** one owner, one way; hide the wrong path so it fails to import or compile.
2. **Types:** make the bad state unrepresentable.
3. **Lint or CI check** whose error names the file, type, or function to use instead. If the pattern is already common, fail only when a change adds more.
4. **Tests:** fix or delete tests that pass when behavior breaks.
5. **Docs or agent rules:** last, only for judgment calls nothing can check.

For comment and prose classes (`no-comments`, `unslop`) the enforcer is `qsdlc-lint` V10 or V11, not a skill paragraph. Record why each higher level failed before settling for a lower one.

## 4. Prove

Commit the failing proof first: the enforcer run against the original mistake, shown failing. Then the fix, one commit per class. Run the same command locally and in CI. Exceptions sit on the offending line as `qsdlc-exception(reason; expires: YYYY-MM-DD; approver: name)`; V11 fails them once expired. A lint with no recorded proof is `open`.

## 5. Record and regenerate

```
node <SKILLS>/_shared/scripts/qsdlc-log.mjs correction --root . --class <class> --source <s> --evidence <ptr> --area <area> --level <architecture|type|lint|test|formal|doc> --enforcer <path or rule id> --proof <sha> --status enforced
node <SKILLS>/_shared/scripts/qsdlc-log.mjs rules --root . --write
node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --json
```

`enforced` needs both an enforcer that exists and a proof SHA that is an ancestor of HEAD (V7). Never edit `rules.md` or `corrections.tsv` by hand. If an enforced class recurs, append status `repeat` and fix at a higher level in the same change. Drop a rule once its mistake cannot happen (`retired`).

## 6. Draft only

Open a draft PR per class when a grant allows; never merge. Never edit skills unattended.

## Terminal signals (non-interactive)

Last line is exactly `Correction complete` or `Correction skipped: <reason>`.

## Return

GREAT form. Takeaway: class, level chosen, why a higher level failed, proof SHA, and the metrics `doc_level_share`, `repeat_rate`, `uncovered_classes`.
