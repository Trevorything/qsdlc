---
name: qsdlc-pr
description: Write docmd.md for a completed QSDLC feature and ship it. Interactive mode asks for a go-ahead before committing, pushing, and opening the PR. Autonomous mode, under a standing grant in policy.md, pushes the run branch and opens a draft PR only, never merges. Produces release notes. Use for the Deploy stage of QSDLC.
---

# qsdlc-pr: Deploy stage

Read [../_shared/conventions.md](../_shared/conventions.md) first. Template: [docmd.template.md](../_shared/templates/docmd.template.md).

## 1. Common preparation

1. Read `Intent.md`, `spec.md`, `plan.md`, `eval.md`, and `ledger.md` if present. Open failures in `eval.md`: interactive, confirm the user wants to proceed; autonomous, end `partial` and stop.
2. Write `docmd.md`: what was built and why, how it was validated (summarize `eval.md`), Known limitations (non-goals plus accepted failures), Rollout notes, and a **Features touched** list of verify-map feature IDs.
3. Add the READY honesty fields to `docmd.md` and the PR body:
   - `Unverified`: claims no check covered.
   - `Failed or skipped`: failed rows, blocked rows, parked phases, skipped stages.
   - `Also changed`: config, CI, or files outside the stated scope.
4. **Preflight** (both modes, before anything leaves the machine):
   - `node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --slug <slug> --strict` with zero errors. V10 is the unslop prose check on `docmd.md` and the PR body; V11 is the no-comments check (suppressions need reason, expiry, approver; no `IMPORTANT` or `do not remove` markers).
   - If lint reports `protected_paths` touched, set `Risk: protected`; the run can only end `needs-review`.
5. Delta track: apply the spec's ADDED, MODIFIED, and REMOVED requirements to `.qsdlc/specs/<capability>/spec.md` in the same change.

## 2. Interactive mode

1. Show `docmd.md`. Ask explicitly whether to stage, commit, push, and open the PR. Drafting is not permission.
2. Once confirmed **in that turn**: review what is staged (`git status`; no blind `git add -A`), commit following the repo's conventions, push, open the PR from `docmd.md` and `eval.md`. Ready-for-review is the user's call.
3. Merging is never done by this skill.

## 3. Autonomous mode (standing grant)

Allowed only if `factory/policy.md` lists `push_branch` and `open_draft_pr` under `autonomous.grants`. Check also that the open auto-PR count is below `max_open_auto_prs`, and that the diff is within `max_files` and `max_changed_loc`.

- Grant missing or a limit exceeded: **decline, log, mailbox**, leave the local branch. Terminal status `declined`.
- Otherwise: commit on `qsdlc/auto/<name>-<date>`, push that branch, then `gh pr create --draft` with a body built from `docmd.md` including the READY fields. **Draft only.** Never `gh pr merge`, never push the default or any shared branch, never force-push. `qsdlc-guard` denies these.
- Freeze the head after the PR opens: any later push needs a fresh READY block.
- Protected paths touched: label the PR `needs-human-review`; status `needs-review`.
- Append a mailbox entry: `node <SKILLS>/_shared/scripts/qsdlc-log.mjs mailbox --run-id <id> --status <status> --pr <url> --note "..."` with run id, track, status, PR link, assumptions, rulings, and how to reverse (close PR, delete branch).
- Write `run.json`, set `Terminal status`, and set `Pending confirmation: deploy drafted by <run-id>`. Do not set `Current stage: done`; a human confirms.

## 4. Release notes artifact

Invoke `qsdlc-present` to build `.qsdlc/<slug>/artifacts/release-notes.html` for a stakeholder audience: what is new and why it matters, in plain words, distinct from `docmd.md`. It must not overstate capabilities: every product claim cites a `verified` feature ID and run date from `.qsdlc/factory/verify/`, and anything unverified is omitted or labeled as such. Sources in `artifacts/.craft/`.

## 5. Wrap up

Interactive: link the open PR, then mark the feature `done` after confirmation. Autonomous: report status, PR link, and the mailbox entry path.
