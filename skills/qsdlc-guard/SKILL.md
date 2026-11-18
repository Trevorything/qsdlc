---
name: qsdlc-guard
description: Install and use the QSDLC safety hook (guard-check.mjs) that blocks destructive commands, rewrites deletes into .qsdlc/archive/, fences edits to the run worktree, protects policy.md protected_paths, and enforces open-PR, file, and LOC budgets. Use when setting up autonomous or scheduled QSDLC runs, adding a PreToolUse hook, or debugging a denied tool call.
---

# qsdlc-guard

Deterministic enforcement for [conventions](../_shared/conventions.md) section 3. One script, no dependencies: `scripts/guard-check.mjs` (Node 20+).

## Install the hook

Add to the target project's `.claude/settings.json`. Use an absolute path with forward slashes.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell|Edit|Write|NotebookEdit",
        "hooks": [
          { "type": "command", "command": "node <SKILLS>/qsdlc-guard/scripts/guard-check.mjs" }
        ]
      }
    ]
  }
}
```

The factory and ritual wrappers export `QSDLC_MODE=autonomous`, `QSDLC_RUN_ID`, `QSDLC_WORKTREE`, `QSDLC_BASE_SHA`, and (after triage) `QSDLC_RISK=protected`. With no `QSDLC_MODE` the hook runs interactive.

## Interactive vs autonomous

| Case | Interactive | Autonomous |
|---|---|---|
| `rm -r`, `Remove-Item -Recurse`, `rd /s`, `git reset --hard`, `git clean -f`, `git branch -D`, `DROP TABLE`, `kubectl delete` | ask | deny with the safe alternative |
| Simple `rm <paths>` | plain rm allowed, `rm -r` asks | rewritten to a move into `.qsdlc/archive/<run-id>/` |
| `rm -rf node_modules dist build .next __pycache__ .cache coverage` | allow | allow, no archive |
| `git push --force`, push to main, master, or default | ask or allow | deny |
| `gh pr merge`, `gh pr ready`, `gh pr create` without `--draft` | allow | deny |
| `git push` | allow | needs `push_branch` grant, branch under `qsdlc/auto/`, budgets in range |
| `npm publish`, `terraform apply`, `kubectl apply`, `gh release create` | allow | deny |
| Edit outside `QSDLC_WORKTREE`, any write into `.git/` | deny | deny |
| Edit under `protected_paths` | allow | deny unless `QSDLC_RISK=protected` and `protected_path_outcome: needs-review` |
| Edit `corrections.tsv`, `rules.md`, `runs/*.tsv` | deny, use `qsdlc-log.mjs` | same |
| Edit `policy.md` | allow | deny (human-owned) |
| Missing or unreadable `policy.md` | allow | deny, fail closed |

Budgets come from `policy.md` `autonomous.max_files`, `max_changed_loc`, `max_open_auto_prs`. Files under `.qsdlc/` do not count. Open PRs are counted with `gh pr list --label qsdlc-auto`; if `gh` fails, `gh pr create` is denied. A breach reads `decline and log: <limit> exceeded (observed N)`: the run records it and mailboxes, it never waits for approval.

## Commands

```
node scripts/guard-check.mjs --self-test
node scripts/guard-check.mjs --tool Bash --command "git push --force" --mode autonomous --root <project>
node scripts/guard-check.mjs --tool Write --file-path src/a.js --worktree <path>
node scripts/guard-check.mjs --budget-check --mode autonomous --root <project> --base-sha <sha>
```

CLI exit codes: 0 allow, 2 deny, 3 ask. In hook mode the decision is JSON on stdout and exit is 0; a plain allow prints nothing so your normal permission rules still apply. Autonomous denials append to `.qsdlc/factory/state/guard-<run-id>.log`.

## When a call is denied

Do not retry with a variant. Pick the stated alternative, or end the run `declined` or `blocked`, log it with `qsdlc-log.mjs`, and write the mailbox entry. Raising a limit or grant is a human edit to `policy.md`.

The hook sees tool calls, not intent. Pair it with `qsdlc-lint` V8 and V11 after the run.
