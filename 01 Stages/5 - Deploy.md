---
tags: [stage]
---

# 5 - Deploy

Documents the completed work and gets it into review. On the `discovery` track this stage is skipped.

## Inputs

`Intent.md`, `spec.md`, `plan.md`, `eval.md`, and `ledger.md` if present. Open failures in `eval.md` are surfaced first: interactive mode confirms the user wants to proceed; autonomous mode ends `partial`.

## Skill

[[qsdlc-pr]] writes `docmd.md`, then ships it according to the mode.

**Common preparation.** `docmd.md` covers what was built and why, how it was validated, Known limitations (non-goals plus accepted failures), Rollout notes, and a **Features touched** list of feature map ids. It carries the three **READY honesty fields**, which also go in the PR body:

- `Unverified`: claims no check covered.
- `Failed or skipped`: failed or blocked rows, parked phases, skipped stages.
- `Also changed`: config, CI, or files outside the stated scope.

Before anything leaves the machine, `qsdlc-lint --strict` must report zero errors; V10 is the prose check on `docmd.md` and the PR body, V11 the comment check. If protected paths were touched, `Risk` becomes `protected` and the run can only end `needs-review`. On a `delta` run the spec's ADDED, MODIFIED, and REMOVED requirements are applied to `.qsdlc/specs/<capability>/spec.md` in the same change.

**Interactive.** The user sees `docmd.md` and gives a go-ahead **in that turn** before staging, committing, pushing, or opening the PR. Drafting is not permission. Staged files are reviewed (no blind `git add -A`), the commit follows the repo's conventions, and the PR is built from `docmd.md` and `eval.md`. Marking it ready, and merging, are the user's calls.

**Autonomous.** Allowed only with the `push_branch` and `open_draft_pr` grants in `policy.md`, with the open-PR count and the file and line budgets in range. Otherwise the run declines, logs, writes the mailbox entry, and leaves the local branch. With the grant, the run commits on `qsdlc/auto/<name>-<date>`, pushes that branch, and opens a **draft** PR. It never merges, never pushes the default or any shared branch, and never force-pushes. The head is frozen after the PR opens; a later push needs a fresh READY block. A PR on protected paths is labeled `needs-human-review`. The mailbox entry records run id, track, status, PR link, assumptions, rulings, and how to reverse (close the PR, delete the branch). `Current stage` is not set to `done`; a human confirms.

## Outputs

- **Document: `docmd.md`**, the engineering-facing record. See [[Documents]].
- **Artifact: release notes** (`release-notes.html`), written for stakeholders. Every product claim cites a `verified` feature id and run date from the feature map; anything unverified is omitted or labeled. Built through [[qsdlc-present]]. See [[Artifacts]].
- **A pull request**: on confirmation (interactive) or a draft under a standing grant (autonomous).

## Hand-off

This is the last stage. Interactive: the feature is marked `done` after the PR is open and the user confirms. Autonomous: the run reports its status, PR link, and mailbox entry. Afterward, the `compound` loop ([[qsdlc-correct]]) and [[qsdlc-audit]] look for corrections to turn into checks. See [[Continuous Factory]].
