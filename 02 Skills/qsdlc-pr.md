---
tags: [skill]
---

# qsdlc-pr

- **Stage**: [[5 - Deploy]]
- **Implementation**: `/skills/qsdlc-pr/SKILL.md`
- **Triggers on**: the Deploy stage of QSDLC, once `eval.md` shows results worth shipping

## What it does

Writes `docmd.md` from the lifecycle record (`Intent.md`, `spec.md`, `plan.md`, `eval.md`, and `ledger.md` if present), including a **Features touched** list and the **READY honesty fields** (`Unverified`, `Failed or skipped`, `Also changed`), which are repeated in the PR body. Before anything leaves the machine, `qsdlc-lint --strict` must report zero errors (V10 prose and V11 comments apply to `docmd.md` and the PR body). Protected paths set `Risk: protected`, so the run can only end `needs-review`. On a `delta` run it applies the spec's ADDED, MODIFIED, and REMOVED requirements to `.qsdlc/specs/<capability>/spec.md` in the same change.

**Interactive.** Shows `docmd.md` and **stops for a go-ahead in that turn**. Drafting is not permission. Once confirmed: reviews the staged files (no blind `git add -A`), commits following the repo's conventions, pushes, and opens the PR from `docmd.md` and `eval.md`. Ready-for-review and merging are the user's decisions.

**Autonomous.** Only under a standing grant: `policy.md` must list `push_branch` and `open_draft_pr`, the open auto-PR count must be below `max_open_auto_prs`, and the diff within `max_files` and `max_changed_loc`. With the grant it commits on `qsdlc/auto/<name>-<date>`, pushes that branch, and opens a **draft** PR (`gh pr create --draft`). It never merges, never pushes the default or a shared branch, never force-pushes; [[qsdlc-guard]] denies those. The head is frozen after the PR opens. Protected paths label the PR `needs-human-review`. Without the grant or over a limit it declines, logs, writes the mailbox entry, and leaves a local branch. It then writes `run.json`, sets `Terminal status` and `Pending confirmation: deploy drafted by <run-id>`, and does not mark the feature `done`.

## Produces

- `docmd.md`, the engineering-facing record
- The release notes artifact `release-notes.html`, built through [[qsdlc-present]] for stakeholders; each product claim cites a `verified` feature id and run date
- A pull request: on confirmation (interactive) or a draft under a grant (autonomous)

## See also

[[5 - Deploy]], [[Why QSDLC]] (why the gate sits here), [[Continuous Factory]], [[Documents]], [[Artifacts]]
