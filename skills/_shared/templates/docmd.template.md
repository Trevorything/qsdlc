# docmd: <feature name>

- Slug: `<feature-slug>`
- Stage: Deploy
- Track: <quick | bugfix | delta | full | discovery>
- Sources: [Intent.md](../Intent.md), [spec.md](../spec.md), [plan.md](../plan.md), [eval.md](../eval.md)

## What was built

Plain narrative: what changed and why, for a reader months later with no other context.

## How it was validated

Summarize eval.md: what was tested, what passed, what ships with a known gap and why that is acceptable.

## Features touched

Feature-map IDs from `.qsdlc/factory/verify/features/` that this change affects. The verify loop confirms each ID still exists.

-

## READY

Honesty fields. Write `none` only when it is true.

- Unverified: claims this run did not check
- Failed or skipped: checks that failed or did not run, and why
- Also changed: config, CI, or out-of-scope files in the diff

## Known limitations

From Intent.md non-goals and any accepted eval failures.

-

## Rollout notes

Migrations, config flags, follow-up work.

-

## Living spec

Delta track only: which `.qsdlc/specs/<capability>/spec.md` requirements were applied.

-
