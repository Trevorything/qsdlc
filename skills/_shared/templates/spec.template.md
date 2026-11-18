# Spec: <feature name>

- Slug: `<feature-slug>`
- Stage: Design
- Track: <delta | full | quick>
- Source: [Intent.md](../Intent.md)
- Living spec: `.qsdlc/specs/<capability>/spec.md` (delta tracks only)

## Current behavior

Answers to the Research questions in Intent.md, taken from the code. One line each: question, answer, `file:line`. Live code beats any document.

-

## Requirements (delta)

Delta tracks use the three sections below against the living spec. Full and quick tracks list every requirement under ADDED.

### ADDED Requirements

#### F1: <requirement name>

- Description:
- Acceptance criteria:
- Scenario: GIVEN <state> WHEN <action> THEN <result>

### MODIFIED Requirements

#### F2: <requirement name>

- Previously: <the old behavior, verbatim from the living spec>
- Now:
- Scenario: GIVEN <state> WHEN <action> THEN <result>

### REMOVED Requirements

#### F3: <requirement name>

- Reason:

## System requirements

Performance, security, accessibility, integration points, data handling, regulatory (rules named in `.qsdlc/factory/policy.md`, where relevant).

- R1:

## Architecture sketch

New and touched components, data flow. Diagram goes in the design-pitch-deck artifact.

## Open-source references

| Reference | What it does | Reusable? | License | Confidence |
|---|---|---|---|---|
| | | | | |

## Quality checklist

Ticked by a reviewer other than the author. A tick means the requirement is complete, clear, consistent, and testable. It never means the code works.

- [ ] Complete: every requirement has an ID, an acceptance criterion, and a scenario
- [ ] Clear: no unmeasurable word (fast, easy, better)
- [ ] Consistent: every MODIFIED requirement quotes the previous behavior; no conflict with the policy.md constitution
- [ ] Testable: each criterion can be checked by a command or an observation
- [ ] Edge cases and error states are stated

## Analyze

Read-only pass across Intent, spec, and plan. Findings are CRITICAL, WARNING, or SUGGESTION. A constitution conflict is always CRITICAL.

-

## Prototype decisions

Throwaway prototypes live in `artifacts/`. Three lines each: question, what ran, decision.

-

## Risks / unknowns

-

## Decisions made during design review

- <ISO date> <decision>
