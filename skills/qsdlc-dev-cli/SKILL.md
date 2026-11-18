---
name: qsdlc-dev-cli
description: Developer-skill conventions for QSDLC build-stage work on CLI tools and scripts (arguments, exit codes, stdout and stderr discipline, non-interactive use), with an Enforced by table. Use when a plan.md phase is tagged qsdlc-dev-cli, in interactive or factory mode.
---

# qsdlc-dev-cli

Defer to the project's CLI library and the style of its existing commands; this skill fills gaps.

## Conventions and enforcement

Rows enforced only by `prose` carry `promote-to-check: yes`: when corrected twice, `qsdlc-correct` converts the row into a lint rule, type, or test and records it in `rules.md`.

| Convention | Enforced by | promote-to-check |
|---|---|---|
| `--help` on every command; clear usage message on bad input, no stack trace | test (invoke the real binary with bad args) | no |
| Exit `0` on success, non-zero on failure; distinct codes for not-found, invalid input, internal error | test (assert exit codes) | no |
| Primary output to stdout; logs, progress, diagnostics to stderr | test (capture streams separately) | no |
| Never require an interactive prompt unless run in an explicit interactive mode | test (run with stdin closed) | no |
| Re-running with the same arguments is safe or documented as unsafe | test (double-run case) | no |
| Test actual invocation, not only the underlying function | test | no |
| Windows-safe paths and quoting (no hardcoded `/` assumptions, no POSIX-only tools) | test on Windows CI where available, else prose | yes |
| Destructive file operations go through soft delete to `.qsdlc/archive/` in autonomous runs | hook (`qsdlc-guard`) | no |

## Verification for a phase

Run the command with good input, bad input, and closed stdin; record exit codes and both streams under `evidence/`.

## When this skill does not fit

For a long-running daemon with no real command-line interface, apply exit codes and stderr discipline and skip the rest.

## Extending

For a tool-specific skill (`qsdlc-dev-cli-node`), copy this shape, replace generic rows with real ones, and fill Enforced by with real rule names.
