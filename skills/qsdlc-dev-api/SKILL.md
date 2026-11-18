---
name: qsdlc-dev-api
description: Developer-skill conventions for QSDLC build-stage work on backend and API code (validation, errors, idempotency, migrations, auth, testing), with an Enforced by table. Use when a plan.md phase is tagged qsdlc-dev-api, in interactive or factory mode.
---

# qsdlc-dev-api

Framework-agnostic. Defer to the project's existing framework, error shape, and auth middleware; this skill fills gaps.

## Conventions and enforcement

Rows enforced only by `prose` carry `promote-to-check: yes`: when corrected twice, `qsdlc-correct` converts the row into a lint rule, type, or test and records it in `rules.md`.

| Convention | Enforced by | promote-to-check |
|---|---|---|
| Validate and sanitize input at the boundary (handlers, queue consumers), trust internal calls past it | type (schema types at the boundary) and test (bad-input cases) | no |
| Fail with a clear, actionable error at the point of failure; match the project's error shape; never swallow errors | lint (no-empty-catch) and test | no |
| Make retryable handlers idempotent, or document why not | test (replay case) | no |
| Migrations are production-safe: additive first, backfill separately, no destructive change in the deploy step | hook (`qsdlc-guard` on migration paths) and `protected_paths` review | no |
| Every new endpoint has an explicit authorization check matching the plan | test (unauthorized and wrong-role cases) | no |
| Cover happy path and boundary and error cases | test | no |
| Money math (billing, payroll, tax): pure functions with invariant or property tests; no float arithmetic for currency | test (property tests) and `protected_paths` | no |
| No PII in logs or error bodies | prose | yes |
| No suppression comments without reason, expiry, approver | hook and `qsdlc-lint` V11 | no |

Changes under `protected_paths` end `needs-review` in autonomous mode.

## Verification for a phase

Run the project's type check, lint, and tests; save output under `evidence/`. For a bugfix, show the failing test first and the passing run after.

## When this skill does not fit

For a batch job or event handler with no HTTP interface, apply validation and idempotency and skip route auth.

## Extending

For a framework-specific skill (`qsdlc-dev-django`), copy this shape, replace generic rows with real ones, and fill Enforced by with real rule names.
