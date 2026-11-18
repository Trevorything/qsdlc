# Eval: <feature name>

- Slug: `<feature-slug>`
- Stage: Test
- Source: [spec.md](../spec.md), [plan.md](../plan.md)

## Test cases

Cover every requirement in spec.md, edge cases, adjacent regressions, a blast-radius case for fix lanes, and performance or security checks where spec.md asks for them.

`Req` cites a spec ID (F1, R1) or `n/a: <reason>`. `Feature ID` cites a feature-map ID from `.qsdlc/factory/verify/` or `n/a: <reason>`. `Evidence` is a path relative to this folder or the project root. A `pass` needs Evidence and a Last run date. A blocked row that could not be reached says `unreachable: <prerequisite>; route: <command>` in Notes.

| ID | Req | Feature ID | Description | Steps | Expected result | Status | Evidence | Last run | Notes |
|---|---|---|---|---|---|---|---|---|---|
| T1 | F1 | n/a: no map yet | | | | not run | | | |
| T2 | R1 | n/a: no map yet | | | | not run | | | |

Status values: `not run`, `pass`, `fail`, `blocked`.

## Summary

Filled in after every `qsdlc-qa` execution pass. Numbers must equal the table.

- Total: 2
- Passed: 0
- Failed: 0
- Blocked: 0
- Not run: 2
- Last run: none
- Verdict: <verified | best-effort | reverted | not run>

## Coverage

- Completeness: every task done and every requirement implemented
- Correctness: behavior matches intent, edge cases hold
- Coherence: design decisions are reflected in the code

## Open failures

-
