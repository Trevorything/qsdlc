---
tags: [skill]
---

# Developer Skills

Not one skill but a pattern. [[3 - Build|Build]]-stage work is tagged in `plan.md` with a *developer skill* that states the conventions a phase, and the subagent executing it, should follow. They are category-level, not framework-specific: they defer to whatever conventions already exist in the target project and only fill gaps.

## Starter set

| Skill | Covers |
|---|---|
| `qsdlc-dev-web` | Frontend and web UI: components, state, accessibility, viewports, styling, browser verification |
| `qsdlc-dev-api` | Backend and API: input validation at the boundary, errors, idempotency, migration safety, auth, money math |
| `qsdlc-dev-cli` | CLI and tooling: arguments, exit codes, stdout versus stderr, non-interactive use, Windows-safe paths |

Implementations: `/skills/qsdlc-dev-web/SKILL.md`, `/skills/qsdlc-dev-api/SKILL.md`, `/skills/qsdlc-dev-cli/SKILL.md`.

## The Enforced by table

Each skill states its conventions as a table with three columns: the convention, **Enforced by**, and `promote-to-check`. "Enforced by" names the layer that actually holds the rule: a type, a lint rule, a test, a hook such as [[qsdlc-guard]], or `qsdlc-lint`. Prose is the weakest layer, so a row enforced only by `prose` carries `promote-to-check: yes`. When [[qsdlc-correct]] sees a prose row corrected twice, it converts the row into a lint rule, type, or test and records it in `rules.md`. A row that says "where configured" with nothing configured means the first correction should add the rule.

A few examples from the starter set: `qsdlc-dev-api` enforces boundary validation with schema types and bad-input tests, and marks "no personal data in logs" as prose to promote; `qsdlc-dev-web` enforces accessibility with lint rules and role queries; `qsdlc-dev-cli` enforces exit codes and stream separation by invoking the real binary in tests.

Each skill also says how a phase is verified (type check, lint, tests, output saved under `evidence/`; for visible web changes, [[qsdlc-qa]] Mode 3), and when it does not apply, so a phase is not forced into the wrong skill. Changes under `protected_paths` end `needs-review` in autonomous mode.

## Adding your own

Clone the shape of the closest starter into `qsdlc-dev-<name>/SKILL.md`, fill the Enforced by column with real rule names, and add the skill to [[qsdlc-build]]'s selection. See [[Adding a Developer Skill]] for the steps.

## See also

[[qsdlc-build]], [[qsdlc-correct]], [[3 - Build]], [[Continuous Factory#The correction ratchet]]
