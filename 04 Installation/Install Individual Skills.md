---
tags: [installation]
---

# Install Individual Skills

Every skill under `/skills/` in this repo is a standard, self-contained `SKILL.md` folder — nothing about it depends on the plugin wrapper. You can copy just the ones you want directly into a project.

## Project-level (one project only)

Copy a skill's folder into that project's `.claude/skills/`:

```
qsdlc-<skill>/  →  <your-project>/.claude/skills/qsdlc-<skill>/
```

For example, to use just the QA skill in one project:

```
cp -r skills/qsdlc-qa <your-project>/.claude/skills/qsdlc-qa
```

## Global (every project)

Copy the same folder into `~/.claude/skills/` instead of a project's `.claude/skills/`.

## Dependencies between skills

Some skills reference `/skills/_shared/conventions.md` and `/skills/_shared/templates/` by relative path (`../_shared/...`). If you copy a stage skill on its own, **also copy `skills/_shared/`** alongside it (as a sibling of the skill folders, same relative position as in this repo) so those links resolve. The kickoff skill (`qsdlc`) and the stage skills that chain to others (`qsdlc-design` → `qsdlc-feature-research`, `qsdlc-build` → the `qsdlc-dev-*` skills) also expect those referenced skills to be installed alongside them — copy the whole set unless you specifically only need standalone skills like `qsdlc-feature-research`.

## When to prefer this over the plugin

Use this path for a one-off skill in one project, or when you want to hand-pick which parts of QSDLC you're using without bringing in the whole lifecycle. For everything at once, see [[Install as a Plugin]].
