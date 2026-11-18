---
name: <ritual-name>
cadence: <hourly | daily | weekly | post-deploy | manual>
schedule: <cron expression or "Mondays 09:00 local">
track: <quick | bugfix | delta | discovery>
targetPattern: <skill and arguments, for example "qsdlc-audit then one fix">
budget_minutes: 60
budget_ref: policy.autonomous
enabled: false
manual: false
scheduler: <task-scheduler | cron | schedule-skill | none>
scheduler_ref: <task name or trigger id, or none>
last_run_evidence: none
---

# Ritual: <ritual-name>

Ships `enabled: false`. Flip to `true` only after the scheduler entry exists, a real trigger has fired, and `last_run_evidence` points at a `runs/<run-id>.tsv` and `runs/<run-id>/run.json`. A ritual with no scheduler entry and no run evidence audits as "manual claim, no evidence"; set `manual: true` to label a manual cadence honestly.

## What it does

One paragraph.

## Prompt

The exact text passed to `claude -p`:

```
/<skill> <arguments>
```

## Stop conditions

- Nothing to decide: end quietly, message nobody.
- Budget exceeded: end `declined: budget`, log, mailbox.
