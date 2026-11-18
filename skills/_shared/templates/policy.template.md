---
schema: 1
constitution:
  - No change to billing, payroll, or tax calculation without invariant or property tests
  - No PII in logs, reports, evidence, or the mailbox
  - Product claims in customer-facing material cite a verified feature ID
protected_paths:
  - "src/**/billing/**"
  - "src/**/payroll/**"
  - "src/**/tax/**"
  - "src/**/exports/**"
  - "src/**/auth/**"
  - "**/migrations/**"
md_allowlist:
  - "docs/**"
  - "README.md"
  - "CHANGELOG.md"
max_comment_ratio: 0.25
retention_hours: 24
autonomous:
  grants: [commit_branch, push_branch, open_draft_pr]
  max_files: 12
  max_changed_loc: 500
  max_fix_rounds: 2
  max_open_auto_prs: 3
  max_runtime_minutes: 90
  max_tokens_per_run: 1500000
  protected_path_outcome: needs-review
  delete: soft
  archive_retention_days: 30
  mutation_targets: [localhost, "*.test", staging]
---

# Factory policy

Human-owned. A run never edits this file. Product-specific rules (which modules are regulated, which numbers are sensitive) belong here, in each project's own policy, not in the skills. Raising a limit is a human edit, never a live approval prompt.

## Constitution

The `constitution` list above is the non-negotiable rule set. `qsdlc-design` analyze treats any conflict as CRITICAL.

## Grants

- `commit_branch`: commit to the run branch
- `push_branch`: push `qsdlc/auto/*` branches only
- `open_draft_pr`: open a draft PR only

Never grantable: merge, push to the default branch, force-push, publish, deploy.

## Numbers are placeholders

Calibrate budgets from the first 20 runs recorded in `runs/<run-id>/run.json`.
