---
name: qsdlc-dev-api
description: Developer-skill conventions for QSDLC build-stage work on backend/API code — validation, error handling, and migration-safety conventions to follow when a plan.md phase is tagged qsdlc-dev-api.
---

# qsdlc-dev-api

A starter developer skill for QSDLC's Build stage, covering backend/API work. Framework-agnostic by design — defer to the target project's existing patterns (its framework, its error-handling conventions, its auth middleware) wherever they already exist; this skill fills gaps.

## Conventions

- **Validate at the boundary**: check and sanitize input where it enters the system (request handlers, queue consumers), not deep inside business logic. Trust internal calls once past that boundary.
- **Error handling**: fail with a clear, actionable error at the point something goes wrong — don't swallow errors or let a generic 500 hide what actually broke. Match the project's existing error-response shape.
- **Idempotency**: for anything that could be retried (webhooks, queue jobs, at-least-once delivery), make handling idempotent or explicitly document why it doesn't need to be.
- **Migrations**: any schema change needs a migration that's safe to run against production data — additive first, backfill separately, never a blind destructive change in the same step as a deploy.
- **Auth**: every new endpoint gets an explicit authorization check reviewed against the plan's intent — don't assume a route is safe because it's "internal."
- **Testing**: cover the endpoint's happy path and its boundary/error cases, using the project's existing test conventions.

## When this skill doesn't fit

If the "API" work is really something else (a batch job, an event handler with no HTTP surface) — apply what's relevant here (validation, idempotency) and skip what isn't (auth checks on a route that doesn't exist).

## Extending

To make this stack-specific (e.g. `qsdlc-dev-django`, `qsdlc-dev-express`), copy this file's shape and replace the generic conventions above with real ones for that framework. See the vault's `02 Skills/Developer Skills.md` for the pattern.
