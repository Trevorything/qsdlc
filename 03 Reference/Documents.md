---
tags: [reference]
---

# Documents

The five markdown documents QSDLC produces, one per stage, and the folder contract that holds them and the factory files together. This is the authoritative vault version of the contract; the same content lives in `/skills/_shared/conventions.md` for the skills to read. The contract is additive: the per-feature folder and its five documents are unchanged from earlier versions.

## The `.qsdlc/` layout

Everything lives at the root of the **target project** (the repo being worked on, not this qsdlc repo). The skills create `.qsdlc/` when it is missing.

```
.qsdlc/
├── <feature-slug>/                  one folder per feature (kebab-case slug)
│   ├── state.md                     resume marker: stage, mode, track, terminal status
│   ├── Intent.md  spec.md  plan.md  eval.md  docmd.md     the five durable documents
│   ├── ledger.md                    optional: build progress ledger, Rulings, parked findings
│   ├── assessment.md                optional: bugfix root cause (read-only stage)
│   ├── findings.md                  optional: discovery track output
│   ├── review/                      optional: per-phase review reports
│   ├── evidence/                    optional: numbered proofs (01-red.txt, 02-green.txt)
│   └── artifacts/
│       ├── inspo.html  design-pitch-deck.html  implementation-process-map.html
│       ├── performance-results.html  release-notes.html
│       └── .craft/                  optional: sources and data behind each artifact
├── specs/<capability>/spec.md       living specs, grown only where deltas land
├── factory/
│   ├── policy.md                    human-owned: constitution, budgets, protected paths, grants
│   ├── sources.yml                  intake sources, each with approved: true|false
│   ├── verify/                      feature map: README.md, features/<id>.md, formal/<name>.md
│   ├── queue/                       one ticket file per item
│   ├── corrections.tsv              append-only correction ledger
│   ├── rules.md                     GENERATED from corrections.tsv, never hand-edited
│   ├── mailbox.md                   append-only notices, newest first
│   ├── runs/                        <run-id>.tsv log and <run-id>/run.json
│   └── audits/  research/  evidence/  state/
├── rituals/<name>.md                scheduled loop definitions
└── archive/                         soft-delete target (the guard rewrites deletes here)
```

- **A feature is a folder containing `state.md`.** `specs/`, `factory/`, `rituals/`, and `archive/` are reserved, and the kickoff skill lists only folders with `state.md`.
- **Never rename or restructure a feature folder.** Stages assume these exact names; files outside the list fail `qsdlc-lint` (V1, V9).
- The slug is kebab-case, confirmed with the user in interactive mode. Headless runs derive it from the ticket id (for example `t-0042-fix-rent-rounding`).
- Run ids are `<YYYY-MM-DD>-<loop>-<NNN>`, for example `2026-11-18-queue-drain-001`.
- Suggested `.gitignore`: `.qsdlc/factory/evidence/`, `.qsdlc/factory/state/`, `.qsdlc/factory/audits/`, `.qsdlc/archive/`.

## The five documents

| File | Stage | Skill | Contains |
|---|---|---|---|
| `Intent.md` | [[1 - Plan]] | [[qsdlc-interview]] | Problem, goal, users, success criteria, constraints, non-goals, prior art, research questions, open questions; Assumptions and Rulings for headless intake |
| `spec.md` | [[2 - Design]] | [[qsdlc-design]] | Current behavior with `file:line`, ADDED/MODIFIED/REMOVED requirements with ids and scenarios, system requirements, architecture sketch, OSS references, risks, Analyze table, quality checklist, decision log |
| `plan.md` | [[3 - Build]] | [[qsdlc-build]] | Ordered phases with steps, files, developer skill, relay Pattern, requirement ids, dependencies, verification, live status |
| `eval.md` | [[4 - Test]] | [[qsdlc-qa]] | Test rows with steps, expected results, status, evidence pointers; summary; open failures; verdict |
| `docmd.md` | [[5 - Deploy]] | [[qsdlc-pr]] | What was built, how it was validated, known limitations, rollout notes, features touched, READY honesty fields |

The optional files: `ledger.md` ([[qsdlc-build]]), `assessment.md` (bugfix root cause), `findings.md` ([[qsdlc-feature-research]] on the `discovery` track), `review/` ([[qsdlc-review]]), and `evidence/` ([[qsdlc-qa]]). Templates for all of these, plus `state`, `policy`, `ticket`, `ritual`, `feature-map-entry`, and `sources`, are in `/skills/_shared/templates/`.

## `state.md`

Bullet fields, one per line as `Key: value`, then an append-only `## Log`.

| Field | Values |
|---|---|
| Current stage | `plan`, `design`, `build`, `test`, `deploy`, `done` |
| Last updated | ISO date |
| Mode | `interactive` or `autonomous` |
| Track | `quick`, `bugfix`, `delta`, `full`, `discovery` |
| Risk | `standard` or `protected` (risk can only raise a track) |
| Autonomy eligible | `true` or `false` |
| Skipped | `none` or a comma list of stages, each with a reason in the log |
| Pending confirmation | `none` or `<stage> drafted by <run-id>`; autonomous runs set it, a human turn clears it |
| Terminal status | `none` until a run ends, then `done`, `needs-review`, `blocked`, `declined`, `failed`, or `partial` |
| Base SHA, Branch, Worktree | `none` or the value for the run |

Log lines start `- <ISO date or timestamp> `. The log is append-only: `qsdlc-lint` V2 compares against `git show HEAD:` and fails on edits or deletions. A stage document may be absent only if its stage is listed in `Skipped`.

## Stage gates and modes

Interactive: no stage is final without the user confirming in that turn, and [[qsdlc-pr]] needs its own go-ahead before touching the repo. Autonomous: the gates become checks and the human gate is the draft PR. See [[Why QSDLC]] and [[Continuous Factory]].

## Claim to evidence

A stage cannot mark work done on a claim without evidence from this run.

| Claim | Required evidence |
|---|---|
| Tests pass | command, exit code, output file under `evidence/` |
| Bug fixed | red-before and green-after proof pair |
| Requirement met | `eval.md` row citing the requirement, with an Evidence pointer |
| Subagent reported success | `git diff --stat` that matches the report |
| UI works | Mode 3 `manifest.json` (action, resulting state, side effects) |
| No regression | blast-radius row plus regression rows |
| Prose clean | `qsdlc-lint` V10 and V11 pass |
| Ready for review | READY fields: `Unverified`, `Failed or skipped`, `Also changed` |

A check that could not run is `blocked`, never `pass`.

## See also

[[Artifacts]], [[Continuous Factory]], [[QSDLC]]
