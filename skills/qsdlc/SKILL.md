---
name: qsdlc
description: Kick off or resume QSDLC (Plan, Design, Build, Test, Deploy) for a feature, in interactive mode with stage gates or handed to the autonomous factory. Use when the user wants to start a feature the structured way, says "kick off qsdlc", "run the SDLC process", or asks to resume or check status on an in-progress QSDLC feature.
---

# qsdlc: kickoff and orchestrator

Read [../_shared/conventions.md](../_shared/conventions.md) first. It defines the `.qsdlc/` layout, modes, tracks, terminal statuses, and the stage-gate rule.

## 1. Find where we are

List `.qsdlc/*/` and keep **only folders that contain `state.md`**. `specs/`, `factory/`, `rituals/`, and `archive/` are reserved and never offered as features.

- No feature folders, or the user wants something new: new feature.
- One unfinished feature (`Current stage` is not `done`): confirm resuming it.
- Several: list slug, track, current stage, `Pending confirmation`, and `Terminal status`; ask which, or whether to start new.

If any feature shows `Pending confirmation` other than `none`, say so first: an autonomous run drafted work that waits for a human turn.

## 2. New feature: triage

1. Get a short feature name; derive a kebab-case slug; confirm it with the user. Create `.qsdlc/<slug>/state.md` from [../_shared/templates/state.template.md](../_shared/templates/state.template.md).
2. Invoke `qsdlc-triage` with the request. It writes `Track`, `Risk`, `Autonomy eligible`, and `Skipped` into `state.md`. Show the result and let the user override the track (a lower track than the risk floor is refused).
3. Pick the mode:
   - **Interactive** (default): a human gates each stage.
   - **Autonomous**: only when `Autonomy eligible: true` and `factory/policy.md` exists. Hand off to `qsdlc-factory` with the slug and stop; the factory runs the track under check-gates and ends at a draft PR or a mailbox entry.

## 3. Scope the run

Ask once: full track end to end, or specific stage(s)? "Just re-run QA" is valid. Stage list comes from the track table in conventions, minus `Skipped`.

## 4. Chain the stages (interactive)

Invoke each stage skill with the `Skill` tool, passing slug and context:

| Stage | Skill |
|---|---|
| Plan | `qsdlc-interview` |
| Design | `qsdlc-design` (calls `qsdlc-feature-research` when prior art helps) |
| Build | `qsdlc-build` (calls `qsdlc-review` per phase) |
| Test | `qsdlc-qa` (calls `qsdlc-verify` for the feature map) |
| Deploy | `qsdlc-pr` |

Track shortcuts: `quick` starts at Build with an `Intent.md` from the ticket; `bugfix` runs assess then `qsdlc-build` then `qsdlc-qa` with red-to-green proof; `discovery` stops after `qsdlc-feature-research` writes `findings.md`.

After each stage:
1. Check `state.md` shows the stage confirmed (the stage skill owns that confirmation).
2. Run `node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --slug <slug>`; report any error before continuing.
3. Summarize in one or two sentences with file paths, then ask whether to continue or pause.

Never skip a confirmation to save turns. Never imply blanket authorization when chaining into `qsdlc-pr`; it asks on its own.

## 5. Resume

`state.md` is the resume marker. Read `Current stage`, `Pending confirmation`, and the last log lines, then continue at the stage that is not confirmed. If a stage's artifacts exist but are unconfirmed, review them with the user instead of regenerating.

## 6. Wrap up

On Deploy completion set `Current stage: done` (interactive mode only, after confirmation). Report slug, track, stages run and skipped, and where each document and artifact lives.
