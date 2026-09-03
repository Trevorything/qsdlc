# QSDLC shared conventions

Every `qsdlc-*` skill reads this file. It defines the on-disk contract so stages can hand off to each other reliably, regardless of which stage skill is running or which Claude Code client invoked it.

## The `.qsdlc/<feature-slug>/` folder

Each feature or build gets one folder at the **root of the target project** (the repo the skills are actually working in — not this qsdlc repo):

```
.qsdlc/<feature-slug>/
├── state.md              current stage, timestamps, links — the resume marker
├── Intent.md             Plan stage output
├── spec.md               Design stage output
├── plan.md                Build stage output
├── eval.md                Test stage output
├── docmd.md               Deploy stage output
└── artifacts/
    ├── inspo.html                       Plan artifact
    ├── design-pitch-deck.html           Design artifact
    ├── implementation-process-map.html  Build artifact
    ├── performance-results.html         Test artifact
    └── release-notes.html               Deploy artifact
```

**Feature slug**: kebab-case, derived from the feature name and confirmed with the user during `qsdlc-interview` (e.g. "Checkout Flow Redesign" → `checkout-flow-redesign`). Never invent a slug silently if one can be confirmed with the user first.

**Never rename or restructure this folder.** Every stage skill assumes these exact filenames exist (or don't yet) at these exact paths. If `.qsdlc/` doesn't exist yet in the target project, create it — don't ask where to put it.

## `state.md`

A short status block any stage skill can read and update:

```markdown
# State — <feature-slug>

- Current stage: plan | design | build | test | deploy | done
- Last updated: <ISO date>

## Log
- <ISO date> — plan stage completed, Intent.md + inspo.html written
- <ISO date> — design stage started
```

Read it first when resuming a feature. Append a line to the log every time a stage starts or completes — don't rewrite history.

## Stage-gate rule

**No stage skill marks itself "done" without the user explicitly confirming the output in that turn.** Concretely:

- After writing a stage's markdown doc and artifact, stop, summarize what you produced, and ask the user to confirm before updating `state.md` to advance the stage.
- The `qsdlc` kickoff skill never auto-chains to the next stage skill without that confirmation having happened.
- `qsdlc-pr` additionally never stages, commits, pushes, or opens a pull request without a separate, explicit go-ahead in that turn — drafting `docmd.md` and the release-notes artifact does not imply permission to push.

This mirrors how the underlying agent treats hard-to-reverse or externally-visible actions — treat each stage boundary the same way.

## Artifact convention

Every artifact is a **single self-contained HTML file** written to `.qsdlc/<feature-slug>/artifacts/`. Self-contained means no external script/stylesheet dependencies beyond what the file inlines — it must open correctly as a local file in a plain browser, since not every Claude Code client can publish a live Artifact.

- If the current session has the `Artifact` publish tool available, you may *additionally* publish it for a shareable link — but the local HTML file is the source of truth and must always be written first.
- If a diagram is needed (architecture, flow, sequence, lifecycle), check whether the **Archify** skill is installed (`npx skills add tt-a1i/archify -g`, or check for an `archify` entry in the available skills list) and use it to render the diagram into the artifact. If Archify isn't available, fall back to an inline Mermaid diagram (`​```mermaid` code block) inside the HTML — Mermaid renders natively in most Artifact-capable viewers, and degrades to a visible code block otherwise, which is acceptable as a fallback.
- Match tone to the artifact: `inspo.html` is evocative/visual, not a spec. `design-pitch-deck.html` reads like a pitch. `performance-results.html` is a data-first status report. `release-notes.html` is written for a stakeholder audience, not engineers — contrast this with `docmd.md`, which is the engineering-facing record.

## Templates

Stage skills fill in the templates under `_shared/templates/`:

- [Intent.template.md](templates/Intent.template.md)
- [spec.template.md](templates/spec.template.md)
- [plan.template.md](templates/plan.template.md)
- [eval.template.md](templates/eval.template.md)
- [docmd.template.md](templates/docmd.template.md)

Copy the template's structure into the real file; don't leave placeholder bracketed text unresolved in the final doc.
