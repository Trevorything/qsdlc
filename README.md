# QSDLC — Quintessence Software Development Lifecycle

A skill library for directing AI models and subagents through feature work the same structured way every time: **Plan → Design → Build → Test → Deploy.** Each stage produces one durable markdown document and one polished artifact for review before the next stage builds on top of it.

This repo is both:
- an **Obsidian vault** (open the repo root directly in Obsidian) documenting what QSDLC is and how it works, and
- a **Claude Code skill library** (`/skills/`) — installable as a plugin or copied skill-by-skill.

## Quick start

```
/plugin marketplace add Trevorything/qsdlc
/plugin install qsdlc@qsdlc-marketplace
```

Then run the `qsdlc` skill in a project to kick off or resume a feature.

See [`00 Overview/QSDLC.md`](<00 Overview/QSDLC.md>) for the full picture, or [`04 Installation/`](<04 Installation>) for other install paths.

## What's in here

| Stage | Document | Artifact | Skill |
|---|---|---|---|
| Plan | `Intent.md` | inspiration | `qsdlc-interview` |
| Design | `spec.md` | design pitch deck | `qsdlc-design` (+ `qsdlc-feature-research`) |
| Build | `plan.md` | implementation process map | `qsdlc-build` (+ developer skills) |
| Test | `eval.md` | performance results | `qsdlc-qa` |
| Deploy | `docmd.md` | release notes | `qsdlc-pr` |

Diagrams throughout use [Archify](https://github.com/tt-a1i/archify).
