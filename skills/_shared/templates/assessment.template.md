# Assessment: <feature name>

Bugfix track only. Read-only: this stage edits no source.

- Slug: `<feature-slug>`
- Source ticket: <id or link>
- Regulatory impact: <none | possible | confirmed>

## Symptom

What happens, exactly.

## Expected

What should happen, with the source of truth (spec, external rule, org policy section).

## Reproduction

Exact steps or command. Reproduced twice: <yes | no, why>.

## Root cause

Evidence first. Each claim cites `file:line` or a command output under `evidence/`.

## Blast radius

The one fact that makes the fix safe, and its proof rung (1 stated, 2 file:line, 3 traced, 4 ran against real code, 5 reproduced in the running app).

Domain probes: regulated output files and report fields, rounding, effective-dated rules, org-level policy config. Add project-specific probes from `.qsdlc/factory/policy.md`.

## Fix scope

Files the fix may touch. Anything else is a deviation and gets recorded.

-

## Verdict

<verified | partial | failed> after the Test stage.
