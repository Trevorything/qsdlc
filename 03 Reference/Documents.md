---
tags: [reference]
---

# Documents

The five markdown documents QSDLC produces, one per stage, plus the folder contract that holds them together. This is the authoritative version of the contract — the same content lives in `/skills/_shared/conventions.md` for the skills themselves to read.

## The `.qsdlc/<feature-slug>/` folder

Every feature gets one folder, created at the root of the **target project** (not this qsdlc repo):

```
.qsdlc/<feature-slug>/
├── state.md
├── Intent.md
├── spec.md
├── plan.md
├── eval.md
├── docmd.md
└── artifacts/
    ├── inspo.html
    ├── design-pitch-deck.html
    ├── implementation-process-map.html
    ├── performance-results.html
    └── release-notes.html
```

The feature slug is kebab-case, confirmed with the user during [[qsdlc-interview]] — never invented silently.

## The five documents

| File | Stage | Skill | Contains |
|---|---|---|---|
| `Intent.md` | [[1 - Plan]] | `qsdlc-interview` | Problem, goal, users, success criteria, constraints, non-goals, prior art, open questions |
| `spec.md` | [[2 - Design]] | `qsdlc-design` | Features + acceptance criteria, system requirements, architecture sketch, OSS references, risks |
| `plan.md` | [[3 - Build]] | `qsdlc-build` | Ordered phases with steps, files, developer skill, dependencies, verification, live status |
| `eval.md` | [[4 - Test]] | `qsdlc-qa` | Test cases with steps, expected results, status; summary; open failures |
| `docmd.md` | [[5 - Deploy]] | `qsdlc-pr` | What was built, how it was validated, known limitations, rollout notes |

Templates for each live at `/skills/_shared/templates/`.

## `state.md`

A short, append-only status block: current stage, last-updated timestamp, and a log line per stage transition. `qsdlc` (the kickoff skill) reads this to figure out whether it's resuming an in-progress feature.

## The stage-gate rule

No document is considered final without the user confirming it in that turn — see [[Why QSDLC]] for the reasoning. This applies with extra weight to `docmd.md`: writing it never implies permission for `qsdlc-pr` to commit, push, or open a PR.

## See also

[[Artifacts]], [[QSDLC]]
