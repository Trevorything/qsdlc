---
name: qsdlc
description: Kick off or resume the QSDLC lifecycle (Plan, Design, Build, Test, Deploy) for a feature or build. Use when the user wants to start a new feature the structured way, says things like "let's start a new feature", "kick off qsdlc", "run the SDLC process", or asks to resume/check status on an in-progress QSDLC feature.
---

# qsdlc — kickoff / orchestrator

You are running the top-level QSDLC orchestrator. Read [../_shared/conventions.md](../_shared/conventions.md) first — it defines the `.qsdlc/<feature-slug>/` contract, the stage-gate rule, and the artifact convention that every stage below depends on.

## 1. Figure out where we are

Look for a `.qsdlc/` folder at the root of the current project.

- **No `.qsdlc/` folder, or user clearly wants something new**: this is a new feature. Ask for a short feature name, derive a kebab-case slug, confirm it with the user, then create `.qsdlc/<slug>/` and a `state.md` (see conventions doc) with stage `plan`.
- **`.qsdlc/` exists with one or more feature folders**: read each `state.md`. If there's exactly one in-progress feature (stage isn't `done`), confirm with the user whether to resume it. If there are several, list them (slug + current stage) and ask which one, or whether to start a new one.

Never guess the slug or silently create the folder without the user having confirmed the feature name — this is the one piece of state every later stage depends on.

## 2. Scope the run

Briefly confirm with the user: run the full lifecycle end-to-end (Plan → Design → Build → Test → Deploy), or just resume/run specific stage(s)? Someone might only want "just re-run the QA pass" — don't assume full end-to-end every time.

## 3. Chain the stages

For each stage in scope, in order, use the **`Skill` tool** to invoke the corresponding skill by name:

| Stage | Skill to invoke |
|---|---|
| Plan | `qsdlc-interview` |
| Design | `qsdlc-design` |
| Build | `qsdlc-build` |
| Test | `qsdlc-qa` |
| Deploy | `qsdlc-pr` |

Pass along the feature slug and project context so the invoked skill doesn't have to re-derive it.

**After each stage skill finishes:**
1. Confirm its `state.md` entry shows the stage as confirmed/complete (per the stage-gate rule in the conventions doc — the stage skill itself is responsible for getting that confirmation, not you).
2. Summarize in one or two sentences what was produced (the doc + the artifact, with paths).
3. Ask the user whether to continue to the next stage now, or pause here.

**Never** skip a stage-gate confirmation to save turns, and never invoke `qsdlc-pr` expecting it to push/open a PR without its own explicit confirmation step — that's `qsdlc-pr`'s responsibility, but as the orchestrator you should not imply blanket authorization by chaining straight into it.

## 4. Wrapping up

When Deploy completes (or the user stops earlier), update `state.md`'s stage to `done` (or leave it at whichever stage the user chose to stop on) and give a short summary of the whole run: slug, stages completed, where every doc and artifact ended up.
