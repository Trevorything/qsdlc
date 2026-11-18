# QSDLC shared conventions

Every `qsdlc-*` skill reads this file. It defines the on-disk contract so stages, factory loops, and scripts hand off reliably. The contract is additive: the per-feature folder and its five documents are unchanged from earlier QSDLC versions.

## 1. Layout

Everything lives at the **root of the target project** (the repo being worked on, not this qsdlc repo). Create `.qsdlc/` when missing; never ask where.

```
.qsdlc/
├── <feature-slug>/                  one folder per feature (kebab-case slug)
│   ├── state.md                     resume marker, track, mode, terminal status
│   ├── Intent.md  spec.md  plan.md  eval.md  docmd.md      the five durable documents
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
│   ├── sources.yml                  intake sources, each with `approved: true|false`
│   ├── verify/                      feature map: README.md, features/<id>.md, formal/<name>.md
│   ├── queue/                       one ticket file per item
│   ├── corrections.tsv              append-only correction ledger
│   ├── rules.md                     GENERATED from corrections.tsv, never hand-edited
│   ├── mailbox.md                   append-only notices, newest first
│   ├── runs/                        <run-id>.tsv log and <run-id>/run.json
│   ├── audits/  research/  evidence/  state/
├── rituals/<name>.md                scheduled loop definitions
└── archive/                         soft-delete target (guard rewrites deletes here)
```

- **A feature is a folder containing `state.md`.** `specs/`, `factory/`, `rituals/`, `archive/` are reserved. The kickoff skill lists only folders with `state.md`.
- **Never rename or restructure** a feature folder. Stages assume these exact names. Files outside this list fail `qsdlc-lint` (V1, V9).
- Slug: kebab-case from the feature name, confirmed with the user in interactive mode. Headless runs derive it from the ticket id (`t-0042-fix-rent-rounding`).
- Suggested `.gitignore`: `.qsdlc/factory/evidence/`, `.qsdlc/factory/state/`, `.qsdlc/factory/audits/`, `.qsdlc/archive/`.
- Run ids: `<YYYY-MM-DD>-<loop>-<NNN>` (e.g. `2026-11-18-queue-drain-001`).

## 2. `state.md`

Bullet fields (one per line, `Key: value`), then an append-only log. Templates: [state.template.md](templates/state.template.md).

| Field | Values |
|---|---|
| Current stage | `plan` `design` `build` `test` `deploy` `done` |
| Last updated | ISO date |
| Mode | `interactive` or `autonomous` |
| Track | `quick` `bugfix` `delta` `full` `discovery` |
| Risk | `standard` or `protected` (risk can only raise a track, never lower it) |
| Autonomy eligible | `true` or `false` |
| Skipped | `none` or comma list of stages (`design, test`), each with a reason in the log |
| Pending confirmation | `none` or `<stage> drafted by <run-id>`; autonomous runs set it, a human turn clears it |
| Terminal status | `none` until a run ends, then the enum in section 5 |
| Base SHA / Branch / Worktree | `none` or the value for the run |

Log lines start `- <ISO date or timestamp> `. **Append only**; `qsdlc-lint` V2 compares against `git show HEAD:` and fails on edits or deletions. A stage document may be absent only if its stage is listed in `Skipped`; otherwise V1 fails once `Current stage` has moved past it.

## 3. Modes

The two modes share artifacts. They differ in who gates and what a blocker does.

**Interactive** (default; a human is in the loop)
- Stage gates stay: after each stage doc and artifact, summarize and ask for explicit confirmation in that turn before advancing `Current stage`.
- `qsdlc-pr` needs a separate go-ahead in that turn before staging, committing, pushing, or opening a PR.
- Questions are allowed for missing input.

**Autonomous / scheduled** (`qsdlc-factory`, rituals, `claude -p`)
- Stage gates become **check-gates**: spec analyze, eval evidence, two-stage review, and lint verdicts must pass to advance. No human wait mid-run, ever.
- **Never pause mid-run for a yes/no.** Missing input ends the run `declined: insufficient-intent` with a mailbox entry. Ambiguity gets a recorded **Ruling** (`what, why, cost if wrong`).
- Pushing is authorized only by a standing grant in `factory/policy.md` (`autonomous.grants`). With the grant: push the run branch `qsdlc/auto/<name>-<date>` and open a **draft PR only**. Without it: decline, log, mailbox, leave a local branch.
- **NEVER auto-merge. NEVER push to the default branch or any shared branch. NEVER force-push. NEVER publish or deploy.** Readiness is a human decision.
- Limits (`max_files`, `max_changed_loc`, `max_fix_rounds`, `max_open_auto_prs`, `max_runtime_minutes`, `max_tokens_per_run`) **decline and log**; raising a limit is a human edit to `policy.md`, never a live approval prompt.
- Touching `protected_paths` is allowed only on the `needs-review` outcome; a run with `Risk: protected` never ends `done`.
- Each run: dedicated worktree, base SHA recorded, `run.json`, TSV log, mailbox entry. Enforced by `qsdlc-guard` and `qsdlc-lint` V8.

## 4. Tracks

`qsdlc-triage` picks the track; `Skipped` records stages left out.

| Track | Use when | Stages that run | Extra files |
|---|---|---|---|
| `quick` | intent already clear, about one session, no protected paths | Build (single phase), Test, Deploy | none |
| `bugfix` | existing behavior is broken, repro exists or can be made | Assess (read-only root cause), Fix, Test (red then green), Deploy | `assessment.md` |
| `delta` | change to existing behavior in an established system | Plan (short), Design (ADDED/MODIFIED/REMOVED delta), Build, Test, Deploy | `.qsdlc/specs/` updated on `done` |
| `full` | novel capability, unclear intent, large scope | all five stages | review/, evidence/ |
| `discovery` | output is knowledge or a decision, no code | Plan (question), Research, Decide | `findings.md`; verdict `go`, `needs-clarification`, or `kill` |

A run that outgrows its track is re-triaged upward; existing documents are kept. Protected paths force `bugfix` or `delta` at minimum, with a human-reviewed PR.

## 5. Terminal status

Every autonomous run ends with exactly one of: `done`, `needs-review`, `blocked`, `declined`, `failed`, `partial`. Written to `run.json` and `state.md` (`Terminal status`). Process exit code: `0` for `done` and `needs-review`, `1` otherwise.

`run.json` keys: `run_id, loop, ticket, track, mode, status, base_sha, head_sha, branch, pr_url, budgets_used, assumptions[], rulings[], parked[], unverified[], failed_or_skipped[], also_changed[]`.

## 6. Claim to evidence

A stage cannot mark work done on a claim without evidence from **this run**.

| Claim | Required evidence |
|---|---|
| Tests pass | command, exit code, output file under `evidence/` |
| Bug fixed | red-before and green-after proof pair |
| Requirement met | `eval.md` row citing the requirement, with an Evidence pointer |
| Subagent reported success | VCS diff check (`git diff --stat`) that matches the report |
| UI works | Mode 3 `manifest.json` (action, resulting state, side effects) |
| No regression | blast-radius row plus regression rows |
| Prose clean | `qsdlc-lint` V10 and V11 pass |
| Ready for review | READY fields: `Unverified`, `Failed or skipped`, `Also changed` |

A gap is not a pass: a check that could not run is `blocked`, never `pass`.

## 7. Artifacts

Every artifact is one **self-contained HTML file** in `artifacts/`, produced by invoking the `qsdlc-present` skill (it owns layout, motion, and the `Diagram.layout` helper). No Mermaid, no CDN scripts, no network at view time; it must open from disk. Source data and build notes go in `artifacts/.craft/`.

- Diagrams use `Diagram.layout` from `qsdlc-present`. If `qsdlc-present` is unavailable, write plain static HTML with inline SVG and log `presented-by: fallback`.
- If the `Artifact` tool exists you may also publish; the local file is the source of truth and is written first.
- Tone: `inspo.html` evocative, `design-pitch-deck.html` a pitch, `implementation-process-map.html` a process diagram, `performance-results.html` data-first, `release-notes.html` for stakeholders (not engineers, and no overstated capabilities).

## 8. Deterministic enforcement

Prose is the weakest layer. Anything a script can check, a script checks.

`<SKILLS>` below means the skills directory: the parent of the `_shared/` folder that holds this file. Resolve it from the path you read this file at, and use the absolute path in commands. Scripts take `--root <project>`; the project root is where `.qsdlc/` lives.

- `node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root <project> [--slug s] [--fix-rules] [--json] [--strict]` runs V1-V12. Run it before every stage confirmation and every draft PR. Errors exit 1; warnings (V10 prose, some V11) exit 1 only with `--strict`, which autonomous runs use.
- `node <SKILLS>/_shared/scripts/qsdlc-log.mjs <start|row|end|correction|rules|metrics|mailbox|sanitize>` appends to run logs, corrections, and the mailbox, regenerates `rules.md`, and prints correction metrics (`doc_level_share`, `repeat_rate`, `uncovered_classes`).
- `node <SKILLS>/_shared/test/run_tests.mjs` runs the suite for these scripts, the guard, and the sweep-state writer.
- Skills state commands and pass criteria and point at the scripts; they do not restate the rules.
- A correction that happens twice goes up the ladder (architecture, types, lint or test, docs last) through `qsdlc-correct`.

## 9. Templates

[Intent](templates/Intent.template.md), [spec](templates/spec.template.md), [plan](templates/plan.template.md), [eval](templates/eval.template.md), [docmd](templates/docmd.template.md), [state](templates/state.template.md), [policy](templates/policy.template.md), [ledger](templates/ledger.template.md), [assessment](templates/assessment.template.md), [findings](templates/findings.template.md), [ticket](templates/ticket.template.md), [ritual](templates/ritual.template.md), [feature-map-entry](templates/feature-map-entry.template.md), [sources](templates/sources.template.yml).

Copy the structure into the real file; leave no unresolved placeholders.
