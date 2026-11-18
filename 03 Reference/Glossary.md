---
tags: [reference]
---

# Glossary

**Analyze** - the read-only cross-check in [[qsdlc-design]] across `Intent.md`, `spec.md`, and `plan.md`. A violation of the `policy.md` constitution is CRITICAL.

**Archive** - `.qsdlc/archive/`, the soft-delete target. In autonomous runs [[qsdlc-guard]] rewrites a delete into a move here. See [[Continuous Factory]].

**Artifact** - the HTML output of a stage; one self-contained file built by [[qsdlc-present]]. See [[Artifacts]].

**Assumptions and Rulings** - sections in `Intent.md` and `ledger.md` where an autonomous run records what it took as true and each ambiguity it resolved (what, why, cost if wrong), instead of asking a question.

**Blast radius** - a row in `eval.md` naming the one fact that makes a change safe, proved by running code. See [[qsdlc-qa]].

**Check-gate** - the autonomous replacement for a stage confirmation: analyze, eval evidence, review verdicts, and `qsdlc-lint --strict` must pass to advance.

**Constitution** - the non-negotiable rule list in `policy.md`. See [[Continuous Factory]].

**Correction ledger** - `.qsdlc/factory/corrections.tsv`, an append-only log of corrections by class. A class counts at its second occurrence. See [[qsdlc-correct]].

**Delta spec** - requirements written as ADDED, MODIFIED, and REMOVED against a living spec. See [[2 - Design]].

**Developer skill** - a `qsdlc-dev-*` skill stating conventions for a category of build work, with an Enforced by table. See [[Developer Skills]].

**Document** - the durable markdown record a stage produces (`Intent.md`, `spec.md`, `plan.md`, `eval.md`, `docmd.md`). See [[Documents]].

**Draft PR** - the only thing an autonomous run may open, and only under a standing grant. It is the human gate.

**Enforced by** - the column in a developer skill naming what holds a convention: a type, lint rule, test, hook, or prose. Prose rows carry `promote-to-check`.

**Feature** - a folder under `.qsdlc/` that contains `state.md`.

**Feature map** - `.qsdlc/factory/verify/`: the per-feature recipes for launching, driving, and capturing evidence from the real app. See [[qsdlc-verify]].

**Feature slug** - the kebab-case identifier for a feature, used as its folder name.

**GREAT** - Grounding, Role, Execution, Analysis, Takeaway: the five-part shape of a subagent brief and return. The orchestrator reads only the Takeaway. See [[Continuous Factory#Relay patterns, GREAT, and Herdr]].

**Grant** - a standing permission in `policy.md` `autonomous.grants` (`commit_branch`, `push_branch`, `open_draft_pr`). Merge, default-branch push, force-push, publish, and deploy are never grantable.

**Herdr** - the terminal multiplexer for coding agents that [[qsdlc-herdr]] drives for parallel lanes.

**Kickoff skill** - [[qsdlc]], the entry point that finds, triages, and chains.

**Ledger** - `ledger.md`, the build progress log, written before and after each phase. Not the correction ledger.

**Living spec** - `.qsdlc/specs/<capability>/spec.md`, grown only where deltas land.

**Mailbox** - `.qsdlc/factory/mailbox.md`, an append-only notice list. Telling, not asking: nothing waits on it.

**Mode** - `interactive` (a person confirms stages) or `autonomous` (check-gates and a draft PR).

**Pattern** - one of the nine Agent Relay Patterns (Multipart Phases, Dependency, Comparative, Pagination, Audit, Realignment, Scatter, Consensus, Batch Testing), tagged on each `plan.md` phase.

**Pending confirmation** - the `state.md` field an autonomous run sets so a human turn can confirm drafted work.

**Policy** - `.qsdlc/factory/policy.md`, human-owned: constitution, budgets, protected paths, grants.

**Protected paths** - globs in `policy.md` whose edits force `Risk: protected` and the `needs-review` outcome.

**Queue** - `.qsdlc/factory/queue/`, one ticket file per item, with status `proposed`, `ready`, `in-progress`, `pr-open`, `done`, `declined`, or `parked`.

**READY fields** - `Unverified`, `Failed or skipped`, and `Also changed`, carried in `docmd.md` and the PR body.

**Red to green** - proof that a regression test fails for the right reason before the fix and passes after. See [[4 - Test]].

**Ritual** - a scheduled loop: a definition in `.qsdlc/rituals/` plus an external scheduler entry. See [[qsdlc-ritual]].

**Stage** - one of the five lifecycle phases: [[1 - Plan]], [[2 - Design]], [[3 - Build]], [[4 - Test]], [[5 - Deploy]].

**Stage gate** - in interactive mode, the rule that no stage is complete without the user's explicit confirmation in that turn. See [[Why QSDLC]].

**Terminal status** - how an autonomous run ends: `done`, `needs-review`, `blocked`, `declined`, `failed`, or `partial`.

**Track** - the size class of work: `quick`, `bugfix`, `delta`, `full`, or `discovery`. See [[qsdlc-triage]].

**V1 to V12** - the checks in `qsdlc-lint`. See [[Continuous Factory#Deterministic enforcement]].

**`.qsdlc/<feature-slug>/`** - the per-feature working folder at the root of the project the skills run against. See [[Documents]].
