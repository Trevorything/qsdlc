---
name: qsdlc-factory
description: Autonomous continuous runner for QSDLC. Takes a queued ticket or ritual trigger, triages it, runs the track's stages in check-gate mode inside an isolated worktree, and ends with a terminal status, run.json, mailbox entry, and at most a draft PR. Use for "run the factory", "drain the queue", scheduled or claude -p runs, and autonomous mode. Never merges.
---

# qsdlc-factory

Read [../_shared/conventions.md](../_shared/conventions.md), section 3 (autonomous mode) and 5 (terminal status). This skill never asks a human anything and never merges.

## 1. Preflight (fail closed)

- `.qsdlc/factory/policy.md` must exist and parse. Missing or unreadable: write the mailbox entry, end `declined`, stop.
- Pick one ticket (`.qsdlc/factory/queue/`, status `ready`) or take the ritual's target. One ticket per run.
- Count open autonomous PRs; at `max_open_auto_prs` end `declined: budget`.
- Run id: `<YYYY-MM-DD>-<loop>-<NNN>`. Start the log:

```
node <SKILLS>/_shared/scripts/qsdlc-log.mjs start --root . --run-id <id> --loop factory
```

## 2. Isolate

Record `git rev-parse HEAD` as the base SHA. Create a worktree (`EnterWorktree`, else `git worktree add`) on branch `qsdlc/auto/<name>-<date>`. Never work on the default branch. Export `QSDLC_MODE=autonomous`, `QSDLC_RUN_ID=<id>`, `QSDLC_WORKTREE=<path>`, `QSDLC_BASE_SHA=<sha>`; after triage also `QSDLC_RISK=<standard|protected>` (the guard denies protected-path edits unless it is `protected`). Hooks come from `qsdlc-guard`. If `HERDR_ENV=1`, run independent plan phases as parallel lanes through `qsdlc-herdr`; lanes never merge.

## 3. Run the track

1. Invoke `qsdlc-triage`. `Autonomy eligible: false` ends the run `declined`, with a draft `Intent.md` only when the track is `full`.
2. Headless intake through `qsdlc-interview` (Assumptions and Rulings, or `declined: insufficient-intent`).
3. Run the stage skills the track needs, in order (`qsdlc-design`, `qsdlc-build`, `qsdlc-qa`, `qsdlc-pr`). Each stage gate is a check:
   - spec analyze and eval evidence pass
   - `qsdlc-review` verdicts clean
   - `node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --slug <slug> --strict` exits 0
4. A failed check after `max_fix_rounds` parks the work: WIP branch, reason in the log, status `blocked` or `partial`.

Log each decision with `qsdlc-log.mjs row`. Set `Pending confirmation` in `state.md` for every stage a human has not confirmed.

## 4. Budgets

Check `max_files`, `max_changed_loc`, `max_runtime_minutes`, `max_tokens_per_run` between phases. Exceeding one **declines and logs**; it never pauses for approval. Raising a limit is a human edit to `policy.md`.

## 5. Finish

1. Push and open a **draft PR** through `qsdlc-pr` only if `autonomous.grants` has `push_branch` and `open_draft_pr`. Otherwise leave the local branch and say so in the mailbox.
2. Never merge, never push the default branch, never force-push, never mark ready.
3. Protected paths touched: status `needs-review`, never `done`.
4. Write `.qsdlc/factory/runs/<id>/run.json` with the conventions keys, and set `Terminal status` in `state.md`.
5. Mailbox and close the log:

```
node <SKILLS>/_shared/scripts/qsdlc-log.mjs mailbox --root . --run-id <id> --status <status> --summary "<one line>"
node <SKILLS>/_shared/scripts/qsdlc-log.mjs end --root . --run-id <id> --loop factory --outcome <status>
```

6. Remove the worktree only if clean and pushed; deletes go through the guard to `.qsdlc/archive/`.

## Exit and quiet wakes

Exit `0` for `done` and `needs-review`; `1` for `blocked`, `declined`, `failed`, `partial`. A run with nothing eligible to do ends with no message and no mailbox entry.

## Return

GREAT form. Takeaway: `run=<id> status=<status> pr=<url or none>`.
