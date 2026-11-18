---
tags: [installation]
---

# Install Individual Skills

Every skill under `/skills/` is a standard, self-contained `SKILL.md` folder. Nothing about it depends on the plugin wrapper, so you can copy just the ones you want into a project.

## Requirements

- **Node 20 or newer** for the deterministic scripts (`qsdlc-lint`, `qsdlc-log`, `qsdlc-guard`, `sweep-state`, the `qsdlc-present` tools, and the `qsdlc-herdr` helper). They have no dependencies and need no `npm install`. The `html-motion` scripts run on Node 18 or newer, or Python 3.8 or newer.
- **Playwright is optional**, used only for screenshots (`shoot.mjs`). Without it, everything else in the pipeline still runs.

## Project-level (one project only)

Copy a skill's folder into that project's `.claude/skills/`:

```
qsdlc-<skill>/  ->  <your-project>/.claude/skills/qsdlc-<skill>/
```

For example, to use just the QA skill in one project:

```
cp -r skills/qsdlc-qa <your-project>/.claude/skills/qsdlc-qa
```

## Global (every project)

Copy the same folder into `~/.claude/skills/` instead.

## Dependencies between skills

Most skills read `../_shared/conventions.md` and use `../_shared/templates/` and `../_shared/scripts/` by relative path. If you copy a skill on its own, **also copy `skills/_shared/`** alongside it, as a sibling of the skill folders, so those paths resolve.

Skills call other skills, so copy the set a flow needs:

| If you copy | Also copy |
|---|---|
| `qsdlc` | `qsdlc-triage` and the stage skills it chains |
| `qsdlc-design` | `qsdlc-feature-research` |
| `qsdlc-build` | `qsdlc-review`, the `qsdlc-dev-*` skills you use, and `qsdlc-herdr` if you want parallel lanes |
| `qsdlc-qa` | `qsdlc-verify` |
| any stage skill | `qsdlc-present` (it builds every artifact; without it the skills fall back to plain static HTML) |
| `qsdlc-present` | `html-motion`, for canvas or GPU motion; `qsdlc-archify`, for specialized architecture/ERD/sequence/timeline diagrams |
| `qsdlc-triage`, `qsdlc-design`, `qsdlc-sweep`, `qsdlc-audit` | `qsdlc-graphify` (plus global `graphify`), when using a codebase knowledge graph |
| `qsdlc-factory` | `qsdlc-guard`, `qsdlc-triage`, and the stage skills |
| `qsdlc-ritual` | `qsdlc-guard`, `qsdlc-audit`, `qsdlc-sweep` |

`qsdlc-feature-research`, `html-motion`, and `qsdlc-present` can also be used standalone.

The autonomous skills need a project policy and a guard hook; see [[Setting up Scheduled Rituals]].

## When to prefer this over the plugin

Use this path for a one-off skill in one project, or to hand-pick which parts of QSDLC you use. For everything at once, see [[Install as a Plugin]].
