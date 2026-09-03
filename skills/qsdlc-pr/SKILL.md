---
name: qsdlc-pr
description: Write docmd.md documenting a completed QSDLC feature, then (with explicit confirmation) commit, push, and open the pull request, and produce a release-notes artifact. Use for the Deploy stage of QSDLC, after eval.md shows results worth shipping.
---

# qsdlc-pr — Deploy stage

Read [../_shared/conventions.md](../_shared/conventions.md) first — in particular the stage-gate rule: this skill must never push or open a PR without a separate, explicit go-ahead in the same turn, regardless of how the rest of the lifecycle got here.

## Purpose

Close the loop: document what shipped, get it into review, and hand back a clean summary a non-engineer could read.

## Process

1. Read `Intent.md`, `spec.md`, `plan.md`, and `eval.md`. If `eval.md` shows open failures, surface them to the user now and confirm they actually want to proceed to Deploy rather than looping back to `qsdlc-build`.
2. Write `docmd.md` from [../_shared/templates/docmd.template.md](../_shared/templates/docmd.template.md): what was built and why, how it was validated (summarizing `eval.md`), known limitations (pulling from `Intent.md`'s non-goals plus any accepted eval failures), and rollout notes.
3. **Stop here and show the user `docmd.md`.** Ask explicitly whether to proceed with staging, committing, pushing, and opening the PR. Drafting the doc is not permission to act on the repo — treat this exactly like any other hard-to-reverse, externally-visible action.
4. Once confirmed:
   - Review what's actually staged (`git status` after adding) before committing — don't blindly `git add -A`.
   - Commit following the target repo's existing commit-message conventions.
   - Push the branch.
   - Open the PR with a description built from `docmd.md`'s summary and `eval.md`'s test-plan/results section.
5. Produce the **release notes artifact** at `.qsdlc/<feature-slug>/artifacts/release-notes.html`: written for a stakeholder audience — what's new and why it matters, not implementation detail. Keep its tone distinct from `docmd.md`, which is the engineering-facing record.

## Wrap-up

Confirm the PR is open (link it), then mark this feature `done` in `state.md`.
