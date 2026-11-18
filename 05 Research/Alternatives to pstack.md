---
tags: [research]
---

# Alternatives to pstack

A survey of well-regarded alternatives to pstack, the skills plugin covered in [[Poteto - All Code Is Slop and pstack]]. Each option is assessed against poteto's pyramid and against what QSDLC already provides. Research date: 2026-11-18.

## Summary

The alternatives fall into three groups that solve different problems. Only Superpowers, gstack, and Compound Engineering are direct alternatives to pstack. The spec-driven frameworks compete with QSDLC, not with pstack. Measured against poteto's pyramid, most options work mainly at the prose layer, which she ranks weakest.

All eight main repos were cloned on 2026-11-18. Each had commits within the previous three weeks, so none is abandoned.

## The three groups

| Group | Options | Problem it solves | Relation to QSDLC and pstack |
|---|---|---|---|
| Workflow skill packs | Superpowers, gstack, Compound Engineering | Make the agent follow an engineering process | Direct alternatives to pstack |
| Context-engineering workflows | HumanLayer CRISPY, GSD Core | Give each phase a clean context window and keep humans reading the code | Partial overlap with pstack |
| Spec-driven frameworks | Spec Kit, OpenSpec, BMAD, Kiro | Have the agent write reviewable specs before code | Compete with QSDLC |

## The main options

| Option | How it works | Verification | Signal of regard | Caveat |
|---|---|---|---|---|
| Superpowers (Jesse Vincent) | A 7-phase pipeline: brainstorm, git worktrees, plan, execute, TDD, review, finish. A "1% Rule" requires invoking a skill if it has even a 1% chance of applying. Code written before tests is deleted. | The `verification-before-completion` skill states an "Iron Law": no claim that work is done without fresh evidence. Nothing enforces it except the prose itself. | Thoughtworks Radar: Assess (April 2026). About 316K GitHub stars on 2026-11-11. | Token cost is high. Subagent-heavy runs can use 50,000+ tokens per task. Independent benchmarks are lacking, and critics question its persuasion-based design. |
| gstack (Garry Tan) | Role-based specialists (CEO reviewer, staff engineer, QA lead, security officer) that the developer invokes as needed | Real-browser QA with screenshots and clicks, plus OWASP and STRIDE security scans. The repo has real code behind it: a browser daemon and safety hooks such as `/careful` and `/freeze`. | About 141K stars on 2026-11-11 | Testing is not enforced, and the "600,000 lines in 60 days" claim is hard to verify. Its stated ethos, "Boil the Ocean," is the opposite of pstack's "write less code." It requires Bun. |
| Compound Engineering (Every) | A 38-skill loop: brainstorm, plan, build, review, then capture what was learned. It runs on 14 agent hosts. | The `ce-compound` skill saves each lesson in the cheapest durable form: a test or lint rule, a coding standard, or a written note. | Maintained by Every's engineering team. The README gives install steps for Grok Bot. | Large. It is the closest match to poteto's "turn corrections into checks," but a written note remains an allowed outcome. |
| HumanLayer CRISPY (Dex Horthy) | Seven stages: Context (questions), Research, Iterate (design discussion), Structure (outline), Plan, sYnthesize (work tree), Implement | Mainly human review. It adds an explicit questions phase and requires humans to read the code, not the plan file. | Dex Horthy wrote the "12 Factor Agents" essay and speaks often at AI Engineer conferences. | The commands reference HumanLayer-specific tooling, such as thoughts sync and a Linear integration. |
| GSD Core | A phase loop built to prevent context rot | Atomic commits plus a verify phase | The original repo reached 64,700 stars. | The original repo was archived on 2026-06-26, and the `get-shit-done-cc` package is marked unsupported. The community now maintains it as GSD Core in `open-gsd/gsd-core`. |
| Spec Kit (GitHub) | One numbered feature folder under `specs/` | A read-only analyze step, plus a converge step that adds unmet work as tasks | About 148K stars on 2026-11-06 | Heavy for small changes |
| OpenSpec (Fission AI) | One change folder with delta specs (ADDED, MODIFIED, REMOVED) | `openspec validate` checks only structure. `/opsx:verify` is advisory. | Thoughtworks Radar: Trial (November 2026). Top merge count in the one benchmark found. | Nothing blocks unmet criteria, because the verify step is advisory. |
| BMAD Method | Sized to the work, from one SPEC.md up to a PRD with epics | The build step checks criteria. A QA skill generates and runs tests. | About 55K stars | Highest cost per merged ticket in the benchmark below |
| Kiro (AWS) | A spec folder under `.kiro/specs/` | Property-based tests generated from requirements (IDE only), plus hooks | Backed by AWS | Proprietary. It uses Kiro's own agents only. |

Cursor also publishes smaller plugins in the same repo as pstack: `cursor-team-kit`, `thermos` (deep branch review), `continual-learning` (updates AGENTS.md from chat transcripts), and `ralph-loop`. These are add-ons, not alternatives. Another plugin there, `dyl-stack`, is built on top of pstack.

## The options against poteto's pyramid

| Layer (strongest to weakest) | Who works at this layer |
|---|---|
| Codebase and architecture | No pack does this for you. HumanLayer's repo is moving this way, with skills such as `no-use-effect` and `improve-codebase-architecture`. |
| Static analysis (lint, types, CI) | Compound Engineering's `ce-compound` and pstack's `/correct`. Both turn lessons into lint rules or tests. |
| Verification | gstack (real browser, security scans), pstack (verification skills, TLA+), Kiro (property tests), Superpowers (TDD) |
| Prose | All of them. Superpowers and the spec frameworks sit mostly here. |

## How strong the evidence is

Star counts are not a reliable signal of quality. Superpowers went from about 106K stars in late March 2026 to about 316K by 2026-11-11.

The only controlled comparison found is one benchmark of the spec frameworks. It used 50 production Python tickets on existing codebases, all run with claude-sonnet-5.

| Finding | Detail |
|---|---|
| Specs helped on features | BMAD reached a 90% merge rate on feature tickets, versus 60% for the no-spec control. |
| Specs did not help on bug fixes | The control merged 90% of bug fixes, matching the best spec arms. |
| Fewer review defects | 0.46 defects per merged ticket with a spec, versus 0.86 for the control |
| The frameworks are not clearly separated | The gaps among spec arms are often within the ±10-point noise band. |
| Conflict of interest | The publisher, Uvik Software, sells Python and AI staff augmentation, and its own engineers ran the benchmark. |

## Implications for QSDLC

This section is analysis for QSDLC. It is not a claim from any of the sources.

QSDLC is already a spec-driven lifecycle. Do not install a second spec framework beside it. One comparison advises never running two frameworks on the same change, because the agent then has two sources of truth. Borrow specific pieces instead:

| Gap | Recommendation | Reason |
|---|---|---|
| Turning repeated corrections into checks | Compound Engineering's `ce-compound` or pstack's `/correct` | These are the only two options that push lessons up to lint rules and tests. |
| Verification in [[4 - Test]] | gstack's `/qa` or pstack's `/create-verification-skill` | They make the agent prove behavior in the running app. |
| Changes to existing code | Adopt OpenSpec's delta-spec format (ADDED, MODIFIED, REMOVED) inside `spec.md` in [[2 - Design]] | It fits brownfield work and costs nothing to borrow. |
| Discipline during implementation | Superpowers, but only if missing TDD is the real problem | The token cost is high, and its rules are prose. |

## Sources

Repositories (cloned 2026-11-18):

- [obra/superpowers](https://github.com/obra/superpowers)
- [garrytan/gstack](https://github.com/garrytan/gstack)
- [EveryInc/compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin)
- [humanlayer/humanlayer](https://github.com/humanlayer/humanlayer)
- [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core)
- [github/spec-kit](https://github.com/github/spec-kit)
- [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- [cursor/plugins](https://github.com/cursor/plugins)

Articles and assessments:

- [Particula: Superpowers vs gstack](https://particula.tech/blog/superpowers-vs-gstack-ai-coding-skill-packs)
- [TestMu AI: Spec-driven development tools compared](https://www.testmuai.com/blog/spec-driven-development-tools/)
- [Uvik: Spec-Driven Development Benchmark 2026](https://uvik.net/spec-driven-development-benchmark/)
- [Thoughtworks Radar: Superpowers](https://www.thoughtworks.com/radar/languages-and-frameworks/superpowers)
- [Thoughtworks Radar: OpenSpec](https://www.thoughtworks.com/en-au/radar/tools/openspec)
- [ZenML: HumanLayer, from RPI to CRISPY](https://www.zenml.io/llmops-database/evolving-ai-coding-agent-workflows-from-research-plan-implement-to-crispy)
- [Hora de Codar: get-shit-done history](https://horadecodar.com.br/?p=44064)
- [Developer Toolkit: Spec-driven frameworks compared](https://developertoolkit.ai/en/ecosystem/frameworks/spec-driven-frameworks/)
