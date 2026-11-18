---
name: qsdlc-dev-web
description: Developer-skill conventions for QSDLC build-stage work on frontend and web UI (component structure, state, accessibility, testing), with an Enforced by table. Use when a plan.md phase is tagged qsdlc-dev-web, in interactive or factory mode.
---

# qsdlc-dev-web

Framework-agnostic. If the target project already has frontend conventions (component patterns, state approach, design system), **those win**; this skill fills gaps.

## Conventions and enforcement

Prose is the weakest layer. Each row names what enforces it. Rows enforced only by `prose` carry `promote-to-check: yes`: when a prose row is corrected twice, `qsdlc-correct` converts it to a lint rule, type, or test and records it in `rules.md`.

| Convention | Enforced by | promote-to-check |
|---|---|---|
| Match the project's component granularity and naming; add no new state or styling library when one exists | lint (import restrictions) where configured, else prose | yes |
| Keep state local; lift only when more than one component needs it | prose | yes |
| Semantic HTML first; interactive elements keyboard-reachable and labeled | lint (a11y rules such as jsx-a11y) and test (role queries) | no |
| Do not rely on color alone for state | prose | yes |
| Verify at more than one viewport width before a phase is done | test (viewport matrix in `eval.md`) | no |
| Follow the project's existing styling approach | lint (stylelint or class rules) where configured, else prose | yes |
| A UI phase is not verified by type-checking alone; exercise it in a browser | `qsdlc-qa` Mode 3 evidence manifest | no |
| No suppression comments without reason, expiry, approver | hook and `qsdlc-lint` V11 | no |

If a row says "where configured" and nothing is configured, the first correction should add the rule.

## Verification for a phase

Run the project's type check, lint, and test commands; save output under `evidence/`. For a visible change, drive the feature in a browser against local or staging data per `qsdlc-qa` Mode 3.

## When this skill does not fit

If the "web" work is really a build tool or static-site config, say so in `plan.md` and skip UI conventions.

## Extending

To make this stack-specific (`qsdlc-dev-react`), copy this shape, replace the generic rows with real ones, and fill the Enforced by column with real rule names.
