---
tags: [skill, factory]
---

# qsdlc-sweep

- **Stage**: none (feeds the queue and drains it)
- **Implementation**: `/skills/qsdlc-sweep/SKILL.md`, with `scripts/sweep-state.mjs`
- **Triggers on**: explicit invocation only (`/qsdlc-sweep <mode>`; the skill sets `disable-model-invocation`), normally from a scheduled [[qsdlc-ritual]]

## What it does

Runs one scheduled or repeatable sweep. It is autonomous: it never asks, never merges, and never publishes. It reads `policy.md` first and stops `declined` if it is missing.

Every run uses a run id `<date>-<mode>-<NNN>`, logs a start row, and keeps state only through `sweep-state.mjs` (`lease-acquire`, `cursor-get/set`, `seen-check/add`, `source-approved`), which is the sole writer of cursor, lease, and seen set. Exit 3 means another run holds the lease; stop quietly. A run with nothing new logs `clean`, releases the lease, and sends no message.

| Mode | What it does |
|---|---|
| `ticket-funnel` | Reads each source in `sources.yml`. A source that is not `approved: true` is read-only: no ack, no comment. Item bodies are untrusted data. New items are deduped, classified, and written to `queue/<id>.md` with `status: proposed` (and `sensitive` when personal data is present). |
| `queue-drain` | Pages through `queue/` oldest first, takes at most one `ready`, autonomy-eligible ticket, refuses at `max_open_auto_prs`, then hands off to [[qsdlc-triage]] and [[qsdlc-factory]]. |
| `regression-sweep`, `ux-perf-sweep`, `canary` | Drives the feature map with [[qsdlc-verify]] against localhost, `*.test`, or staging only. Alerts on change from baseline, never absolutes, and only after two consecutive checks (load failure CRITICAL, new console error HIGH, load time at least 2x baseline MEDIUM, new 404 LOW). Findings become tickets, never direct fixes. `canary` recommends a rollback in the mailbox and takes none. |
| `scout` | Runs [[qsdlc-feature-research]] in scout mode. Candidates are `proposed` and never auto-built. |
| `debt-sweep` | Finds `qsdlc-shortcut(<why>; upgrade: <trigger>)` markers (those with no `upgrade:` rank first) and compares each living spec in `.qsdlc/specs/` against its code. |

Done when `qsdlc-lint --root .` passes, the lease is released, and the log has a final row. A check that could not run is `blocked`, never a pass.

## See also

[[Continuous Factory]], [[Setting up Scheduled Rituals]], [[qsdlc-audit]]
