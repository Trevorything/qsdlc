# <Feature name>

## Sub-features

- `<feature-id>-open` : what the user can do first
- `<feature-id>-<action>` : the next distinct capability
- `<feature-id>-cli` : the command-line entry point, if any

## How to get to it (user POV)

Every entry point a real user has, in order of likelihood. A proof that drives one convenient entry point is incomplete when this list names others.

1. From the main navigation: <click path>
2. From a deep link: <url pattern>

## Driving it with <harness>

Preconditions: disposable data directory set by `<ENV_VAR>=<run-id path>`, seeded records `<seed command>`, doctor reports expected URL, data dir, and build revision. Never drive an instance this run did not start.

- `<feature-id>-open`: `<exact command>`. Observe: <what must be visible or returned>. Evidence: ARIA snapshot and screenshot with app identity visible.
- `<feature-id>-<action>`: `<exact command>`. Observe: <result>. Read-only cross-check: `<exact command>`.

## Gotchas

- Seeded data only. Never production data, never real customer PII.
- Restore seed data after any mutation.
- Report an unreachable path with the attempted command and the unmet precondition. Do not report a skipped entry point as verified through another path.
