---
tags: [reference]
---

# Glossary

**Artifact** — the polished, visual output of a stage; a self-contained HTML file. See [[Artifacts]].

**Developer skill** — a `qsdlc-dev-*` skill stating conventions for a category of build work (web, api, cli, ...), tagged onto phases in `plan.md`. See [[Developer Skills]].

**Document** — the durable markdown record a stage produces (`Intent.md`, `spec.md`, `plan.md`, `eval.md`, `docmd.md`). See [[Documents]].

**Feature slug** — the kebab-case identifier for a feature, confirmed with the user during [[qsdlc-interview]], used as the folder name under `.qsdlc/`.

**Kickoff skill** — `qsdlc`, the orchestrator that chains the five stage skills in order. See [[qsdlc]].

**Stage** — one of the five lifecycle phases: [[1 - Plan]], [[2 - Design]], [[3 - Build]], [[4 - Test]], [[5 - Deploy]].

**Stage-gate** — the rule that no stage is marked complete without the user's explicit confirmation of its outputs in that turn. See [[Why QSDLC]].

**`.qsdlc/<feature-slug>/`** — the per-feature working folder created at the root of whatever project the skills are run against. See [[Documents]].
