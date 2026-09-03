---
tags: [stage]
---

# 5 — Deploy

Documents the work's completion and gets it into review.

## Inputs

`Intent.md`, `spec.md`, `plan.md`, `eval.md` — the full record of the lifecycle so far.

## Skill

[[qsdlc-pr]] writes `docmd.md` from everything that came before, then — **only after explicit confirmation in that turn** — stages, commits, pushes, and opens the pull request with a description built from `docmd.md` and `eval.md`. Drafting the documentation never implies permission to act on the repository; see [[Why QSDLC]] on why stage-gates matter most here.

## Outputs

- **Document — `docmd.md`**: what was built, how it was validated, known limitations, rollout notes — the engineering-facing record. See [[Documents]].
- **Artifact — release notes**: a clean, stakeholder-facing summary of what shipped and why it matters — deliberately different in tone from `docmd.md`. See [[Artifacts]].
- **A pull request**, opened on confirmation.

## Hand-off

This is the last stage. `state.md` for the feature is marked `done` once the PR is open.
