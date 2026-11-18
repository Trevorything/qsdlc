---
tags: [skill, factory]
---

# qsdlc-herdr

- **Stage**: [[3 - Build]] and the factory loops, when the work is parallel or needs independent review
- **Implementation**: `/skills/qsdlc-herdr/SKILL.md`, with `references/relay-topologies.md` and `scripts/relay-helper.mjs`
- **Triggers on**: the user explicitly mentions Herdr or asks for multi-pane or multi-agent QSDLC execution, and `HERDR_ENV=1`

## What it does

Extends the official `herdr` skill (v0.9.5); where the two disagree on CLI syntax or a safety rule, the official skill and `herdr --help` win. It adds what QSDLC needs: the nine Agent Relay Patterns as concrete Herdr topologies, GREAT briefs and handoffs, the Autonomy and Escalation Policy, and a PASS gate that needs deterministic evidence.

**Rule 0.** Before any `herdr` control command, check `HERDR_ENV=1`. Outside Herdr, say so and stop. The one exception is a dedicated QSDLC workspace the user explicitly authorized in that turn, acting only on the IDs returned when it was created. All IDs come from JSON responses; background lanes use `--no-focus`; nothing is closed that this run did not create.

**The nine patterns as topologies** (recipes in `references/relay-topologies.md`):

| Shape | Pattern | Herdr topology |
|---|---|---|
| Branch | Multipart Phases | parallel lanes with strict disjoint file ownership, checked by `dispatch-guard` before launch |
| Branch | Dependency | sequential; lane B's brief points at lane A's report, and A's gate must pass first |
| Branch | Comparative | candidate lanes, one `herdr worktree` each, then a blind judge pane with a hidden rubric |
| Loop | Pagination | one queue item per clean worker turn, progress ledger |
| Loop | Audit | actor pane, independent fresh critic pane, capped rounds (autonomous 2, interactive 3) |
| Loop | Realignment | a fresh pane reads `ledger.md`, `state.md`, and git history and writes a replan |
| Swarm | Scatter | fan out to named panes with `--wait` barriers, aggregate Takeaways only |
| Swarm | Consensus / Polling | blind persona panel, then one reconciler that reports unresolved conflicts |
| Swarm | Batch Testing | concurrent suites via `pane run` and `pane wait-output`, or A/B arms |

**GREAT briefs.** Every lane brief is a file with Grounding, Role, Execution, Analysis, and Takeaway sections; every report ends with a Takeaway whose first word is `PASS`, `ISSUES`, or `BLOCKED`. Briefs are sent with `relay-helper.mjs prompt-file`, which passes argv instead of a shell string so quoting on Windows cannot corrupt them.

**Autonomy.** A `blocked` lane is a lane fault in autonomous mode: read it, log it, park or decline, never answer it blindly. Lanes never merge, and neither does the coordinator. A lane counts as `PASS` only with a `PASS` report, a clean `ownership-check`, the coordinator's own test, lint, and `git diff --stat` agreeing with it, and (for writers) an independent reviewer passing the same head SHA. A gap is not a pass.

Helper commands: `check-env`, `dispatch-guard`, `prompt-file`, `roster`, `ownership-check`, `takeaway`.

## See also

[[Continuous Factory#Relay patterns, GREAT, and Herdr]], [[qsdlc-build]], [[qsdlc-review]], [[qsdlc-factory]]
