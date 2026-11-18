---
name: qsdlc-herdr
description: Run QSDLC work as parallel or independently reviewed lanes inside Herdr (v0.9.5): Multipart Phases, Dependency, Comparative, Pagination, Audit, Realignment, Scatter, Consensus and Batch Testing topologies, with file-backed briefs, GREAT handoffs and a verified PASS gate. Use only when the user explicitly mentions Herdr or asks for multi-pane/multi-agent QSDLC execution, and only when HERDR_ENV=1.
---

# qsdlc-herdr — the QSDLC Continuous Software Factory on Herdr

Read [../_shared/conventions.md](../_shared/conventions.md) first (the `.qsdlc/` contract, stage gates, artifacts).

## What this is

This skill **extends the official `herdr` skill** (`herdrdev/herdr`, v0.9.5, installed at `~/.claude/skills/herdr/SKILL.md`). It does not replace it. Everything in the official skill still applies; this skill adds what QSDLC needs on top:

- The **nine Agent Relay Patterns** (the QSDLC sequencing vocabulary, summarized in `03 Reference/Continuous Factory.md`, section "Relay patterns, GREAT, and Herdr") as concrete Herdr topologies (recipes in [references/relay-topologies.md](references/relay-topologies.md)).
- **GREAT** briefs and handoffs (Grounding, Role, Execution, Analysis, Takeaway), so the coordinator reads a Takeaway plus evidence instead of transcripts.
- The **Autonomy and Escalation Policy** (interactive vs autonomous, `blocked` is a lane fault, lanes never merge), as defined in `skills/_shared/conventions.md` section 3 (Modes) and `03 Reference/Continuous Factory.md` ("Autonomy tiers").
- **High-trust factory discipline**: fresh context per task, the writer never judges its own code, and nothing is `PASS` without deterministic evidence.
- A zero-dependency helper, [scripts/relay-helper.mjs](scripts/relay-helper.mjs), that makes the Windows-hostile parts safe.

If the official `herdr` skill and this file ever disagree on CLI syntax or a safety rule, the official skill and `herdr --help` win. Learn flags from the binary: `herdr --help`, then `herdr agent`, `herdr workspace`, `herdr tab`, `herdr pane`, `herdr worktree`, `herdr notification`.

## Rule 0: the inside-Herdr guard

Before **any** `herdr` control command:

```bash
test "${HERDR_ENV:-}" = 1        # or: node <SKILLS>/qsdlc-herdr/scripts/relay-helper.mjs check-env
```

Two situations, and they are not the same thing:

| Situation | What you may do |
|---|---|
| **Inside Herdr** (`HERDR_ENV=1`; Herdr injected `HERDR_WORKSPACE_ID`, `HERDR_TAB_ID`, `HERDR_PANE_ID`) | Use the CLI against the current session. Default to a sibling pane or a new tab in your own workspace, `--no-focus`, with `--cwd "$PWD"`. |
| **Outside Herdr** (check fails) | Say you are not inside Herdr and **stop**. Do not inspect or control the user's focused session. |
| **Outside Herdr, but the user explicitly authorized a dedicated QSDLC workspace in this turn** | Create it with `herdr workspace create --cwd "$PWD" --label qsdlc-<slug> --no-focus`, parse its IDs from the creation JSON, and act **only** on those IDs. Never list, read, focus or message any other workspace, tab, pane or agent. Never rely on the focused pane or an omitted target. Use the helper with `--dedicated-workspace <wN> --user-authorized`. |

The third row is a narrow, explicit exception, not a loophole: a general "run this in parallel" request is **not** authorization to create workspaces or touch the user's panes. Do not create a workspace, tab, worktree or different cwd unless the user asked for that topology (a Comparative lane's worktree counts as asked only when the user chose Comparative). Inside Herdr, prefer your own workspace's tabs over a new workspace.

## Core CLI rules (preserved from the official skill)

- **Never run bare `herdr`**: it launches or attaches the TUI. Do not probe a mutating command by omitting arguments (`herdr workspace create` with defaults will execute).
- **Parse every ID from JSON**, never from sidebar order or examples: `workspace create` -> `.result.workspace/.tab/.root_pane`; `tab create` -> `.result.tab.tab_id`, `.result.root_pane.pane_id`; `pane split` -> `.result.pane.pane_id`. Parsing recipes for bash and PowerShell: references §2.
- **`--no-focus` on every background lane.** Target with `--current`, an explicit pane ID, or a unique agent name, never another client's focused pane.
- **Never close a workspace, tab, pane or session you did not create** (this run's ledger lists what you created). Never `workspace close --group` to dodge `workspace_group_close_required`. Never `herdr server stop`. Never kill the main Herdr process.
- **`agent start` needs a pane at an interactive shell prompt** (nothing in the foreground) and a unique name matching `[a-z][a-z0-9_-]{0,31}`. It does not create or move panes. Add `-- --dangerously-skip-permissions` **only** when unattended work was pre-authorized by the user or a durable `policy.md` grant. If it returns `agent_not_ready`, the agent is blocked at startup (a trust or login prompt): inspect with `agent get` / `agent read`, never answer it blindly (references §3).
- Submit work with `agent prompt <name> "<text>" [--wait --timeout <ms>]`. A timeout or `agent_prompt_stalled` does not prove the prompt was not delivered; inspect before resending. `agent_blocked` means nothing was sent.
- `--trust-repository` only after the user verified the repo; it is not a retry flag.
- **Windows PowerShell quoting safety: file-backed prompt dispatch.** Never pass a multi-line or quote-heavy brief through `agent prompt`. Write the brief to a file and send one single-line prompt telling the worker to read it:

  ```bash
  node <SKILLS>/qsdlc-herdr/scripts/relay-helper.mjs prompt-file impl-p2 .qsdlc/<slug>/review/impl-p2.brief.md --wait --timeout 900000
  ```

  The helper resolves the absolute path, hashes the brief for the ledger, and passes argv (no shell string) so quotes, `$`, backticks and newlines can never corrupt it. Use `--dry-run` to see the exact `herdr` argv first. In raw PowerShell 5.1, do not add `2>&1` to native `herdr` calls and check `$LASTEXITCODE`.

## The nine relay patterns

Gauge each stage with two questions: (1) branch, loop or swarm? (2) which pattern within it? A request one agent can answer needs no pattern. Tag each `plan.md` phase `pattern: <name>` beside its `qsdlc-dev-*` tag.

| Shape | Pattern | Herdr topology (full recipe in references §8) |
|---|---|---|
| Branch | **Multipart Phases** | Parallel tabs/panes from the start, one named lane each, **strict disjoint file ownership** checked by `dispatch-guard` before launch |
| Branch | **Dependency** | Sequential: lane B's brief points at lane A's *report file*; A's gate (Takeaway PASS + deterministic check) must pass first |
| Branch | **Comparative** | Parallel candidate lanes, one `herdr worktree` each, then a **blind judge pane** with a hidden rubric |
| Loop | **Pagination** | One queue item or chunk per **clean** worker turn; progress ledger; resume from ledger + `git log` |
| Loop | **Audit** | Actor pane -> **independent fresh critic pane**; capped rounds (autonomous 2, interactive 3); escalate once to a fresh stronger-model implementer, then park |
| Loop | **Realignment** | Fresh pane reads `ledger.md` + `state.md` + git history, writes a replan; the coordinator updates `plan.md` |
| Swarm | **Scatter** | Fan independent pieces to named panes; `--wait` barriers; aggregate only Takeaways |
| Swarm | **Consensus / Polling** | Blind persona panel (or synthesis vs stress-test) -> **one reconciler** that reports unresolved conflicts |
| Swarm | **Batch Testing** | Concurrent eval suites in panes (`pane run` + `pane wait-output`), or A/B arms with preregistered metrics |

Stack patterns when a stage needs more than one (a worked stack is in references §9).

## Brief and handoff discipline (GREAT)

Every lane brief is a file with five headed sections, and every lane report ends with a `Takeaway`:

1. **Grounding**: the phase, governing dev skill, spec excerpt, base SHA. No session history.
2. **Role**: what the lane owns (exact globs) and must not touch; never merge, never self-approve.
3. **Execution**: ordered steps, each with its verification command; where to write the report.
4. **Analysis**: what it verified with fresh evidence, what it did **not** verify, what failed or was skipped, what else changed.
5. **Takeaway**: first word `PASS`, `ISSUES` or `BLOCKED`, then at most eight lines with evidence pointers.

The coordinator reads only `node <SKILLS>/qsdlc-herdr/scripts/relay-helper.mjs takeaway <report>` plus deterministic evidence. Fixed-shape roles (extractors, JSON sweeps) are exempt from the five headings. Your own final reply follows GREAT too. Template and rules: references §4.

## Autonomy and escalation

| | Interactive mode | Autonomous mode |
|---|---|---|
| Stage gates | Unchanged: the user confirms each stage (`_shared/conventions.md`) | Gates become **checks** (verify, review verdicts, lint) that must pass to advance; the human gate is the draft PR |
| `blocked` lane | `agent read`, summarize, ask the user | **Lane fault.** `agent read`, log, **park or decline**, post to the mailbox. **Never blindly approve.** |
| Limits | Ask when a budget is hit | Pre-set budgets in `policy.md` **decline and log**; they never pause for a yes |
| Missing input | Ask a clarifying question (input, not permission) | Record an assumption or ruling; if input is truly absent end `declined` |
| Push / PR | Per-turn go-ahead (`qsdlc-pr`) | Only what `policy.md` grants (branch + draft PR); never merge or publish |

**Lanes never merge.** Neither does the coordinator. The output is a draft PR or a READY block (head SHA pinned, with `Unverified`, `Failed or skipped` and `Also changed` fields). Telling is not asking: report outcomes to the mailbox and `herdr notification show`; nothing waits on a reply. Deletions are soft (archive), logged with how to reverse.

## High-trust factory discipline

1. **Fresh context per task.** A lane gets a constructed brief, not your conversation. Do not reuse a pane's agent across unrelated items.
2. **The writer never judges its own code.** Review is a different pane, fresh context, read-only on the checkout, treating the writer's report as unverified claims. Verdicts are scoped to one patch and one head SHA.
3. **File-backed output plus deterministic checks before `PASS`.** Count a lane as `PASS` only when: its report exists with a `PASS` Takeaway and cited evidence; `ownership-check` shows no foreign edits; the coordinator's own run of tests, `qsdlc-lint.mjs` (where present) and `git diff --stat` against the base SHA agree; and, for writers, an independent reviewer passed the same head SHA.
4. **A gap is not a pass.** A missing report, missing SHA/method, or a settled `idle`/`done` alone is a gap. Respawn once; after a second miss record the gap and park. `idle`/`done` mean ready for input, not correct, and not that background subagents finished.
5. **Verify claims, not narrations.** "Agent reported success" requires a VCS diff check; "tests pass" requires the command output from this run.

## Helper quick reference

```bash
node <SKILLS>/qsdlc-herdr/scripts/relay-helper.mjs check-env
node <SKILLS>/qsdlc-herdr/scripts/relay-helper.mjs dispatch-guard manifest.json            # exit 1 on overlap: do not launch
node <SKILLS>/qsdlc-herdr/scripts/relay-helper.mjs prompt-file <agent|pane> <brief> --dry-run
node <SKILLS>/qsdlc-herdr/scripts/relay-helper.mjs roster "$HERDR_WORKSPACE_ID"            # workspace-scoped only
node <SKILLS>/qsdlc-herdr/scripts/relay-helper.mjs ownership-check manifest.json <lane> --git-diff
node <SKILLS>/qsdlc-herdr/scripts/relay-helper.mjs takeaway <report>
```

Exit codes: 0 ok, 1 check failed, 2 usage, 3 guard refusal, 4 herdr error. Tests: `node skills/qsdlc-herdr/test/run_tests.mjs`.

## What this skill does not do

- It does not start parallel work on its own: the user must have asked for Herdr or multi-lane execution.
- It does not change the `.qsdlc/` contract. It uses the optional paths `_shared/conventions.md` now defines: `ledger.md`, `review/` (briefs and lane reports), `evidence/`, and `factory/mailbox.md`, `factory/policy.md`, `factory/runs/`. If your checkout predates them, keep lane files in the scratchpad and log only pointer lines in `state.md`.
- It does not claim a lane is correct because it stopped working.
