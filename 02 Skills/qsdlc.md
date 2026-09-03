---
tags: [skill]
---

# qsdlc

The kickoff/orchestrator skill — the only one named without the `qsdlc-` prefix, since it's the top-level entry point to the whole system.

- **Stage**: none (spans all five)
- **Implementation**: `/skills/qsdlc/SKILL.md`
- **Triggers on**: "let's start a new feature", "kick off qsdlc", "run the SDLC process", or resuming/checking status on an in-progress QSDLC feature

## What it does

1. Detects whether `.qsdlc/` already has an in-progress feature to resume, or a new one needs to start (asking for and confirming a feature name → slug).
2. Confirms scope with the user — the full lifecycle, or just specific stage(s).
3. Chains the stage skills in order using the `Skill` tool: [[qsdlc-interview]] → [[qsdlc-design]] → [[qsdlc-build]] → [[qsdlc-qa]] → [[qsdlc-pr]], pausing for confirmation after each one per the stage-gate rule.
4. Updates `state.md` throughout, and gives a final summary of everything produced.

## See also

[[QSDLC]] for the overall lifecycle, [[Documents]] and [[Artifacts]] for the file contract every stage skill depends on.
