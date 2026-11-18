---
tags: [skill, factory]
---

# qsdlc-factory

- **Stage**: all five, in autonomous mode
- **Implementation**: `/skills/qsdlc-factory/SKILL.md`
- **Triggers on**: "run the factory", "drain the queue", scheduled or `claude -p` runs, autonomous mode

## What it does

The autonomous runner. It takes one queued ticket or one ritual trigger, triages it, runs the track's stages in check-gate mode inside an isolated worktree, and ends with a terminal status, a `run.json`, a mailbox entry, and at most a draft PR. It never asks a human anything and never merges.

1. **Preflight, fail closed.** `.qsdlc/factory/policy.md` must exist and parse, or the run ends `declined`. One ticket per run (`queue/`, status `ready`). If the open autonomous PR count is at `max_open_auto_prs`, the run ends `declined: budget`. The run id is `<YYYY-MM-DD>-<loop>-<NNN>` and the log starts with `qsdlc-log.mjs start`.
2. **Isolate.** Record the base SHA, create a worktree on `qsdlc/auto/<name>-<date>`, never touch the default branch. Export `QSDLC_MODE`, `QSDLC_RUN_ID`, `QSDLC_WORKTREE`, `QSDLC_BASE_SHA`, and after triage `QSDLC_RISK`. [[qsdlc-guard]] enforces the fence. Inside Herdr, independent plan phases can run as lanes through [[qsdlc-herdr]].
3. **Run the track.** [[qsdlc-triage]], headless intake through [[qsdlc-interview]], then the stage skills the track needs. A stage passes only if spec analyze and eval evidence pass, [[qsdlc-review]] verdicts are clean, and `qsdlc-lint --strict` exits 0. A failure after `max_fix_rounds` parks the work on a WIP branch.
4. **Budgets.** `max_files`, `max_changed_loc`, `max_runtime_minutes`, and `max_tokens_per_run` are checked between phases. Exceeding one declines and logs; it never pauses for approval.
5. **Finish.** With the `push_branch` and `open_draft_pr` grants, [[qsdlc-pr]] pushes the run branch and opens a draft PR. Without them the local branch stays and the mailbox says so. Protected paths end `needs-review`, never `done`.

Exit code is `0` for `done` and `needs-review`, `1` for `blocked`, `declined`, `failed`, and `partial`. A run with nothing eligible ends quietly with no message.

## Produces

- `.qsdlc/factory/runs/<id>.tsv` and `runs/<id>/run.json`
- A mailbox entry (`factory/mailbox.md`) and `Terminal status` in `state.md`
- A draft PR when granted

## See also

[[Continuous Factory]], [[qsdlc-sweep]], [[qsdlc-ritual]], [[Setting up Scheduled Rituals]]
