---
tags: [skill]
---

# qsdlc

The kickoff and orchestrator skill. It is the only one named without the `qsdlc-` prefix, since it is the entry point to the whole system.

- **Stage**: none (spans all five)
- **Implementation**: `/skills/qsdlc/SKILL.md`
- **Triggers on**: "let's start a new feature", "kick off qsdlc", "run the SDLC process", or resuming or checking status on an in-progress QSDLC feature

## What it does

1. **Finds where things stand.** It lists `.qsdlc/*/` and keeps only folders that contain `state.md`; `specs/`, `factory/`, `rituals/`, and `archive/` are reserved and never offered as features. With one unfinished feature it confirms resuming; with several it lists slug, track, current stage, `Pending confirmation`, and `Terminal status`. If an autonomous run left work waiting on a human turn (`Pending confirmation` other than `none`), it says so first.
2. **Triages a new feature.** It gets a short name, derives a kebab-case slug and confirms it, creates `state.md` from the template, then invokes [[qsdlc-triage]] to write `Track`, `Risk`, `Autonomy eligible`, and `Skipped`. The user can override the track; a track below the risk floor is refused.
3. **Picks the mode.** Interactive is the default. Autonomous is offered only when `Autonomy eligible: true` and `factory/policy.md` exists; the kickoff then hands the slug to [[qsdlc-factory]] and stops.
4. **Scopes the run** once: the full track end to end, or specific stages ("just re-run QA" is valid).
5. **Chains the stage skills** in interactive mode with the `Skill` tool: [[qsdlc-interview]], [[qsdlc-design]], [[qsdlc-build]], [[qsdlc-qa]], [[qsdlc-pr]], minus any stage in `Skipped`. After each it checks the stage is confirmed, runs `qsdlc-lint --slug <slug>`, summarizes with file paths, and asks whether to continue. It never skips a confirmation and never implies blanket authorization when chaining into `qsdlc-pr`.
6. **Resumes** from `state.md`: `Current stage`, `Pending confirmation`, and the last log lines. Unconfirmed artifacts are reviewed with the user, not regenerated.

Track shortcuts: `quick` starts at Build with an `Intent.md` from the ticket; `bugfix` runs assess, then Build, then Test with red-to-green proof; `discovery` stops after [[qsdlc-feature-research]] writes `findings.md`.

## See also

[[QSDLC]], [[Continuous Factory]], [[Documents]], [[Artifacts]]
