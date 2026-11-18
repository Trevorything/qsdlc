---
name: qsdlc-ritual
description: Scaffold and enable a scheduled QSDLC ritual (weekly-level-up, ticket-funnel, queue-drain, regression-sweep, scout, compound, debt-sweep, canary). Creates .qsdlc/rituals/<name>.md, installs a Windows Task Scheduler, cron, claude -p, or /schedule wrapper, and verifies a real trigger and run evidence before flipping enabled to true. Interactive setup only.
---

# qsdlc-ritual

A ritual is a definition file plus an **external scheduler**. The file alone never runs anything. Setup is interactive: a human is present for auth and installs. Never run this skill from a scheduled job. Read [conventions](../_shared/conventions.md) section 3.

## 1. Scaffold

Copy [ritual.template.md](../_shared/templates/ritual.template.md) to `.qsdlc/rituals/<name>.md`. Fields: `name`, `cadence`, `schedule`, `track`, `targetPattern`, `budget`, `enabled`, `manual`, `last_run_evidence`. Always start with `enabled: false`. `targetPattern` must name a real skill (`qsdlc-sweep ticket-funnel`, `qsdlc-audit then one fix`); check it resolves. Budget refers to `policy.md` `autonomous.*`; a ritual with no budget is not scaffolded.

**Start with `weekly-level-up`**: run `qsdlc-audit`, pick the single highest-priority open finding, make exactly one bounded fix on a draft PR, verify it, log the decision. A clean audit forces no fix. Add the others only after it has run once cleanly.

## 2. Install a scheduler (pick one)

| Platform | How |
|---|---|
| Windows | Fill [task.template.xml](templates/task.template.xml), save as UTF-16, `schtasks /Create /TN "QSDLC-<name>" /XML task.xml`. It calls [run-ritual.ps1](templates/run-ritual.ps1) |
| macOS, Linux, CI | cron line calling [run-ritual.sh](templates/run-ritual.sh) `<name> <project-root>` |
| In-session | the `/schedule` skill, with a prompt that mirrors the wrapper prompt |

The wrappers create a worktree on `qsdlc/auto/<name>-<date>-<NNN>`, export `QSDLC_MODE=autonomous`, `QSDLC_RUN_ID`, `QSDLC_WORKTREE`, `QSDLC_BASE_SHA`, write the TSV start row with `qsdlc-log.mjs`, run `claude -p` with the composed prompt, then read `run.json`. Exit is `0` for `done` and `needs-review`, otherwise `1`. Install the `qsdlc-guard` hook first; without it, stop.

One-time auth and installing missing tools are the only things that need a human, and only now, not mid-run.

## 3. Verify before enabling

1. Trigger once for real: `schtasks /Run /TN "QSDLC-<name>"` (or run the wrapper by hand, or wait for cron).
2. Confirm all of: the scheduler reports success (`schtasks /Query /TN "QSDLC-<name>" /V /FO LIST`, Last Result `0`); `.qsdlc/factory/runs/<run-id>.tsv` exists with a `start` row and a final row; `.qsdlc/factory/runs/<run-id>/run.json` has a terminal status; `qsdlc-lint.mjs --root .` passes.
3. Only then set `enabled: true` and `last_run_evidence: <run-id>`. If any check fails, leave `enabled: false` and say which one.

## 4. Manual rituals

If no scheduler is wanted, set `manual: true` and `enabled: false`. `qsdlc-audit` scores an enabled ritual with no scheduler entry and no run evidence as **manual claim, no evidence**, and a `manual: true` ritual as labeled manual.

## Rules

- Never enable a ritual because the file says it should run.
- One scheduler entry per ritual; remove entries for deleted rituals (`schtasks /Delete`).
- Disabling a ritual means `enabled: false` and deleting the scheduler entry, in that order.
- Report outcomes as observed: name the run id and the Last Result you saw.
