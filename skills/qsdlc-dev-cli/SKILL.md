---
name: qsdlc-dev-cli
description: Developer-skill conventions for QSDLC build-stage work on CLI tools and scripts — argument parsing, exit codes, and output-discipline conventions to follow when a plan.md phase is tagged qsdlc-dev-cli.
---

# qsdlc-dev-cli

A starter developer skill for QSDLC's Build stage, covering CLI/tooling work. Defer to the target project's existing CLI conventions (its argument-parsing library, its existing commands' style) wherever they exist; this skill fills gaps.

## Conventions

- **Argument parsing**: support `--help` on every command; fail with a clear usage message on bad input rather than a stack trace.
- **Exit codes**: `0` on success, non-zero on failure, and distinguish failure kinds where it's useful to script against (e.g. "not found" vs "invalid input" vs "internal error").
- **stdout vs stderr**: primary output (what a script piping this tool would want) goes to stdout; logs, progress, and diagnostics go to stderr. Don't mix them.
- **Non-interactive friendliness**: never require an interactive prompt unless explicitly invoked in an interactive mode — a CI pipeline or another script needs to be able to run this unattended.
- **Idempotency where it matters**: re-running the same command with the same arguments should either be safe or clearly documented as not being safe.
- **Testing**: cover the command's argument parsing and its core behavior; test actual invocation (not just the underlying function) so regressions in flag handling get caught.

## When this skill doesn't fit

If the "CLI" work is really a long-running daemon or service with no real command-line surface, apply what's relevant (exit codes, stderr discipline) and skip the rest.

## Extending

To make this more specific (e.g. `qsdlc-dev-cli-python-click`, `qsdlc-dev-cli-node`), copy this file's shape and replace the generic conventions above with real ones for that tool/library. See the vault's `02 Skills/Developer Skills.md` for the pattern.
