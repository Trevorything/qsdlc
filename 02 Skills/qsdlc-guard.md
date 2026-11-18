---
tags: [skill, factory]
---

# qsdlc-guard

- **Stage**: none (wraps every autonomous run)
- **Implementation**: `/skills/qsdlc-guard/SKILL.md`, with `scripts/guard-check.mjs` (Node 20+, no dependencies)
- **Triggers on**: setting up autonomous or scheduled runs, adding a PreToolUse hook, or debugging a denied tool call

## What it does

A PreToolUse hook that is also a CLI. It blocks destructive commands, rewrites deletes into `.qsdlc/archive/`, fences edits to the run worktree, protects `policy.md` `protected_paths`, and enforces the open-PR, file, and changed-line budgets. The point is deterministic enforcement: the rule lives in a script, not in a paragraph the model may skip.

Install: add a `PreToolUse` entry to the target project's `.claude/settings.json` with matcher `Bash|PowerShell|Edit|Write|NotebookEdit` and command `node <SKILLS>/qsdlc-guard/scripts/guard-check.mjs`, using an absolute path with forward slashes. The factory and ritual wrappers export `QSDLC_MODE`, `QSDLC_RUN_ID`, `QSDLC_WORKTREE`, `QSDLC_BASE_SHA`, and after triage `QSDLC_RISK`. With no `QSDLC_MODE` the hook runs interactive.

| Case | Interactive | Autonomous |
|---|---|---|
| `rm -r`, `git reset --hard`, `git clean -f`, `git branch -D`, `DROP TABLE`, `kubectl delete`, and similar | ask | deny with the safe alternative |
| Simple `rm <paths>` | allowed | rewritten to a move into `.qsdlc/archive/<run-id>/` |
| `rm -rf node_modules dist build ...` (regenerable) | allow | allow, no archive |
| `git push --force`, push to the default branch | ask or allow | deny |
| `gh pr merge`, `gh pr ready`, `gh pr create` without `--draft` | allow | deny |
| `git push` | allow | needs the `push_branch` grant, a branch under `qsdlc/auto/`, budgets in range |
| `npm publish`, `terraform apply`, `kubectl apply`, `gh release create` | allow | deny |
| Edit outside `QSDLC_WORKTREE`, any write into `.git/` | deny | deny |
| Edit under `protected_paths` | allow | deny unless `QSDLC_RISK=protected` and the outcome is `needs-review` |
| Edit `corrections.tsv`, `rules.md`, `runs/*.tsv` | deny, use `qsdlc-log.mjs` | same |
| Edit `policy.md` | allow | deny (human-owned) |
| Missing or unreadable `policy.md` | allow | deny, fail closed |

A budget breach reads `decline and log: <limit> exceeded (observed N)`. The run records it and writes the mailbox entry; it never waits for approval. When a call is denied, do not retry with a variant: take the stated alternative or end the run `declined` or `blocked`.

CLI checks: `node scripts/guard-check.mjs --self-test`, `--tool Bash --command "..." --mode autonomous --root <project>`, and `--budget-check`. Exit codes: 0 allow, 2 deny, 3 ask. The hook sees tool calls, not intent, so pair it with `qsdlc-lint` V8 and V11 after the run.

## See also

[[Continuous Factory#Autonomy tiers]], [[qsdlc-factory]], [[qsdlc-ritual]], [[Setting up Scheduled Rituals]]
