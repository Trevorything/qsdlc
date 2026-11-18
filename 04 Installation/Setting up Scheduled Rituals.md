---
tags: [installation, factory]
---

# Setting up Scheduled Rituals

How to take a project from "QSDLC installed" to a first scheduled loop. Order matters: the policy and the guard come before any scheduler, and a ritual is only enabled after a real run proves it. Background: [[Continuous Factory]].

`<SKILLS>` below is the skills directory of your QSDLC install; `<project>` is the repo the loops will work on.

## Prerequisites

- Node 20 or newer (the lint, log, guard, and sweep-state scripts have no dependencies)
- `git`, the `claude` CLI, and `gh` for opening draft PRs
- QSDLC installed as a plugin or as individual skills with `_shared/`; see [[Install as a Plugin]] and [[Install Individual Skills]]
- Playwright only if you want screenshots from [[qsdlc-present]]

## 1. Write policy.md

Copy `<SKILLS>/_shared/templates/policy.template.md` to `<project>/.qsdlc/factory/policy.md` and edit it. This file is human-owned: runs never edit it, and the guard denies the edit.

- `constitution`: the rules analyze treats as non-negotiable.
- `protected_paths`: the globs that must end in a human-reviewed PR (calculation code, exports, auth, migrations).
- `autonomous.grants`: keep only what you want. Without `push_branch` and `open_draft_pr` a run leaves a local branch and a mailbox entry. Merge, default-branch push, force-push, publish, and deploy cannot be granted.
- The budgets (`max_files`, `max_changed_loc`, `max_fix_rounds`, `max_open_auto_prs`, `max_runtime_minutes`, `max_tokens_per_run`) are placeholders. Start strict and loosen them from real run data.

Without a `policy.md`, the factory, the sweeps, and the guard all fail closed.

## 2. Write sources.yml

Copy `sources.template.yml` to `.qsdlc/factory/sources.yml`. Each source has `approved: true|false`. A source that is not approved is read-only: no comments, labels, or acknowledgements. Set `sensitive: true` for anything that may hold personal data. Leave everything `false` until you have watched a read-only run.

## 3. Install the guard hook

Add this to `<project>/.claude/settings.json`, with an absolute path and forward slashes, and commit it (each run works in a fresh worktree of tracked files):

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

Check it with `node <SKILLS>/qsdlc-guard/scripts/guard-check.mjs --self-test`. See [[qsdlc-guard]] for what it denies.

## 4. Build the feature map

Run [[qsdlc-verify]] in the project. It writes `.claude/skills/verify-<app>/SKILL.md` and a first feature map under `.qsdlc/factory/verify/`, and proves it once: launch, doctor, drive one feature, capture evidence, clean up. Regression sweeps and Mode 3 of [[qsdlc-qa]] depend on it. Targets are local or staging only, on seeded data.

## 5. Check the install

```
node <SKILLS>/_shared/test/run_tests.mjs
node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root <project>
```

Both should pass before a scheduler exists.

## 6. Scaffold the first ritual

Run [[qsdlc-ritual]] interactively and scaffold `weekly-level-up`. It writes `.qsdlc/rituals/weekly-level-up.md` with `enabled: false`. Add the other loops only after this one has run cleanly once.

## 7. Install a scheduler

Pick one. Each wrapper creates a worktree on `qsdlc/auto/<name>-<date>-<NNN>`, exports `QSDLC_MODE=autonomous`, `QSDLC_RUN_ID`, `QSDLC_WORKTREE`, and `QSDLC_BASE_SHA`, starts the run log, runs `claude -p` with the composed prompt, and reads `run.json`. Exit code is `0` for `done` and `needs-review`, otherwise `1`. They find the scripts through the `QSDLC_HOME` environment variable or their own location.

**Windows Task Scheduler.** Fill the placeholders in `<SKILLS>/qsdlc-ritual/templates/task.template.xml` (`{{NAME}}`, `{{START_BOUNDARY}}`, `{{DAY}}`, `{{MAX_MINUTES}}`, `{{RUN_RITUAL_PS1}}`, `{{PROJECT_ROOT}}`), save it as UTF-16, and register it:

```
schtasks /Create /TN "QSDLC-weekly-level-up" /XML task.xml
```

The task runs `run-ritual.ps1 -Ritual <name> -Root <project>`.

**cron, launchd, or CI.** Call the shell wrapper with the ritual name and project root:

```
<SKILLS>/qsdlc-ritual/templates/run-ritual.sh <ritual-name> <project-root>
```

**In-session.** The `/schedule` skill with a prompt that mirrors the wrapper prompt.

## 8. Prove it, then enable it

1. Trigger once for real: `schtasks /Run /TN "QSDLC-weekly-level-up"`, or run the wrapper by hand.
2. Check the scheduler: `schtasks /Query /TN "QSDLC-weekly-level-up" /V /FO LIST` should show Last Result `0`.
3. Check the evidence: `.qsdlc/factory/runs/<run-id>.tsv` has a start row and a final row, `.qsdlc/factory/runs/<run-id>/run.json` has a terminal status, and `qsdlc-lint --root <project>` passes.
4. Only then set `enabled: true` and `last_run_evidence: <run-id>` in the ritual file.

If any check fails, leave `enabled: false` and note which one. A ritual that claims to run but has no scheduler entry and no run evidence is scored 0 by [[qsdlc-audit]] as "manual claim, no evidence". If you do not want a scheduler, set `manual: true` and keep `enabled: false`.

## Ongoing

- Review the mailbox (`.qsdlc/factory/mailbox.md`) and the draft PRs. Nothing waits on you, but nothing merges without you.
- Run [[qsdlc-audit]] weekly; its top finding is the input to `weekly-level-up`.
- To retire a ritual: set `enabled: false`, then delete its scheduler entry (`schtasks /Delete /TN "QSDLC-<name>"`), in that order.
- Suggested `.gitignore` entries: `.qsdlc/factory/evidence/`, `.qsdlc/factory/state/`, `.qsdlc/factory/audits/`, `.qsdlc/archive/`.

## See also

[[Continuous Factory]], [[qsdlc-ritual]], [[qsdlc-sweep]], [[qsdlc-factory]]
