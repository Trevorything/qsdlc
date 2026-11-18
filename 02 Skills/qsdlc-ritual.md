---
tags: [skill, factory]
---

# qsdlc-ritual

- **Stage**: none (schedules the other skills)
- **Implementation**: `/skills/qsdlc-ritual/SKILL.md`, with `templates/run-ritual.ps1`, `run-ritual.sh`, and `task.template.xml`
- **Triggers on**: setting up, enabling, or checking a scheduled loop

## What it does

A ritual is a definition file plus an **external scheduler**. The file alone never runs anything. This skill is interactive setup only, because a human is present for authentication and installs; it must never run from a scheduled job.

1. **Scaffold.** Copy `ritual.template.md` to `.qsdlc/rituals/<name>.md`. Fields: `name`, `cadence`, `schedule`, `track`, `targetPattern`, `budget`, `enabled`, `manual`, `last_run_evidence`. It always starts `enabled: false`, `targetPattern` must name a real skill, and a ritual with no budget (a reference to `policy.md` `autonomous.*`) is not scaffolded. The named rituals are `weekly-level-up`, `ticket-funnel`, `queue-drain`, `regression-sweep`, `scout`, `compound`, `debt-sweep`, and `canary`. Start with `weekly-level-up`: run [[qsdlc-audit]], close the single highest-priority finding with one bounded fix on a draft PR, verify, log. A clean audit forces no fix.
2. **Install a scheduler**: Windows Task Scheduler from `task.template.xml` calling `run-ritual.ps1`; cron or CI calling `run-ritual.sh <name> <project-root>`; or the `/schedule` skill. The wrappers create a worktree on `qsdlc/auto/<name>-<date>-<NNN>`, export the `QSDLC_*` variables, write the start row, run `claude -p` with the composed prompt, then read `run.json`. Exit is `0` for `done` and `needs-review`, otherwise `1`. Install the [[qsdlc-guard]] hook first; without it, stop.
3. **Verify before enabling.** Trigger once for real, then confirm the scheduler reports success (Last Result `0`), `runs/<run-id>.tsv` has a start row and a final row, `runs/<run-id>/run.json` has a terminal status, and `qsdlc-lint --root .` passes. Only then set `enabled: true` and `last_run_evidence`. If a check fails, leave it `false` and say which.
4. **Manual rituals.** `manual: true` with `enabled: false` is the honest label when no scheduler is wanted.

Never enable a ritual because the file says it should run. One scheduler entry per ritual. Disabling means `enabled: false` first, then deleting the scheduler entry.

## See also

[[Setting up Scheduled Rituals]], [[Continuous Factory]], [[qsdlc-sweep]], [[qsdlc-factory]]
