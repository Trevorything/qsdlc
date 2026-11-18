# Relay topologies for Herdr (v0.9.5)

Companion to [../SKILL.md](../SKILL.md). `SKILL.md` holds the rules; this file holds the recipes: ID parsing, lane bootstrapping, the GREAT brief and report contract, and all nine Agent Relay Patterns as concrete `herdr` sequences. Every command was checked against `herdr --help` and the `agent`, `workspace`, `tab`, `pane`, `worktree` and `notification` command groups of v0.9.5. Re-check flags with the installed binary before relying on anything here: the binary is the authority.

Where the rules are defined in this repo: `skills/_shared/conventions.md` (section 3 Modes, section 5 Terminal status, section 6 Claim to evidence) and `03 Reference/Continuous Factory.md` ("Autonomy tiers" and "Relay patterns, GREAT, and Herdr"). The nine relay patterns, the GREAT brief shape and the Autonomy and Escalation Policy are all stated there; this file expands them into Herdr sequences and does not redefine them.

## 1. Primitives and vocabulary

| Factory concept | Herdr primitive | Notes |
|---|---|---|
| A factory run | One workspace (only if the user authorized a new topology) or one tab in the current workspace | Default is a sibling pane/tab in the current workspace |
| A ticket or track | One tab | Label it with the feature slug |
| A lane (writer, reviewer, scout) | One pane hosting one **named** agent | Names match `[a-z][a-z0-9_-]{0,31}`, unique among live agents |
| Lane brief | A file on disk plus a single-line prompt | See §4 |
| Lane report | A file on disk ending in a GREAT `Takeaway` | See §5 |
| Barrier | `agent prompt --wait` or `agent wait`, then a deterministic check | Settled state is never the proof |
| Isolation | `herdr worktree create` per lane | Required for Comparative; recommended for any parallel writers sharing files |
| Notification | `herdr notification show` plus the file-based mailbox | The file is the record; the toast is a nudge |

Lifecycle states: `idle`, `working`, `blocked`, `done`, `unknown`. `idle` and `done` mean the agent is ready for input. They do not prove the work is correct, that background subagents have finished (Antigravity and Grok can be idle while subagents run), or that an unfamiliar approval dialog was recognized. `unknown` does not prove completion.

## 2. Parsing IDs from JSON

Never predict an ID. Creation responses carry them:

| Command | Where the IDs are |
|---|---|
| `workspace create` | `.result.workspace`, `.result.tab`, `.result.root_pane` (pane id at `.result.root_pane.pane_id`) |
| `tab create` | `.result.tab.tab_id`, `.result.root_pane.pane_id` |
| `pane split` | `.result.pane.pane_id` |
| `pane move` | `.result.move_result.pane.pane_id` (old id in `.previous_pane_id`) |

Verified on v0.9.5: `tab create` returns `{"result":{"root_pane":{"pane_id":"w3:p8",...},"tab":{"tab_id":"w3:t4",...}}}` and `pane split` returns `{"result":{"pane":{"pane_id":"w3:p9",...}}}`.

**bash / Git Bash (no jq assumed; Node is a QSDLC prerequisite):**

```bash
TAB_JSON=$(herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label "feat-x" --no-focus)
TAB_ID=$(node -e 'console.log(JSON.parse(process.argv[1]).result.tab.tab_id)' "$TAB_JSON")
ROOT_PANE=$(node -e 'console.log(JSON.parse(process.argv[1]).result.root_pane.pane_id)' "$TAB_JSON")
SPLIT=$(herdr pane split "$ROOT_PANE" --direction right --cwd "$PWD" --no-focus)
LANE_PANE=$(node -e 'console.log(JSON.parse(process.argv[1]).result.pane.pane_id)' "$SPLIT")
```

**Windows PowerShell 5.1:**

```powershell
$tab  = herdr tab create --workspace $env:HERDR_WORKSPACE_ID --cwd "$PWD" --label "feat-x" --no-focus | ConvertFrom-Json
$tabId = $tab.result.tab.tab_id
$root  = $tab.result.root_pane.pane_id
$split = herdr pane split $root --direction right --cwd "$PWD" --no-focus | ConvertFrom-Json
$lane  = $split.result.pane.pane_id
```

PowerShell 5.1 rules: do not append `2>&1` to a native `herdr` call (it wraps stderr lines as ErrorRecords and flips `$?`); `herdr` prints CLI server errors as JSON on stderr with exit status 1 and syntax errors with status 2, so check `$LASTEXITCODE`. Use `;` and `if ($?) { ... }` instead of `&&`.

## 3. Bootstrapping one lane

```bash
# 1. pane exists (see §2). The pane must be at an interactive shell prompt, nothing in the foreground.
# 2. start the agent, named, in that pane (pre-authorized autonomous work adds the skip-permissions flag)
herdr agent start impl-p2 --kind claude --pane "$LANE_PANE" -- --dangerously-skip-permissions
# 3. dispatch the file-backed brief (single-line prompt; see §4)
node skills/qsdlc-herdr/scripts/relay-helper.mjs prompt-file impl-p2 .qsdlc/feat-x/review/impl-p2.brief.md --wait --timeout 900000
# 4. read only the Takeaway, then verify deterministically
node skills/qsdlc-herdr/scripts/relay-helper.mjs takeaway .qsdlc/feat-x/review/impl-p2.report.md
```

`--dangerously-skip-permissions` goes after `--` and only when the user (or a durable `policy.md` grant) pre-authorized unattended work. Never add it to look faster.

`agent start` returns only after Herdr detects the expected agent and considers it ready (default 30 s timeout). If it returns `agent_not_ready`, the agent is blocked at startup (typically a folder-trust or login prompt) but the name stays available:

1. `herdr agent get impl-p2` and `herdr agent read impl-p2 --source recent-unwrapped --lines 60`.
2. Interactive mode: show the user the prompt and ask. Autonomous mode: the lane failed to start. Do not select "trust" yourself; park the lane, log it, and tell the mailbox.
3. Only when the user authorized a specific key (for example `esc` to dismiss), send it with `herdr agent send-keys impl-p2 esc`, then `herdr agent wait impl-p2 --until idle --timeout 60000` before prompting.

Prompt rejections to expect: `agent_blocked` (agent already waiting at an approval dialog; nothing was sent), `agent_prompt_stalled` (no `working` or `blocked` seen within five seconds), `timeout` (caller timeout, which includes submission time). A timeout or stall does not prove the prompt was never delivered: inspect with `agent read` before any resend.

## 4. The GREAT brief (file-backed dispatch)

Why a file: on Windows PowerShell a multi-line brief with quotes, backticks, `$` or `%` is rewritten or truncated between your shell and the pane. A file is byte-exact. The only text that crosses the shell is `Read <path> in full and execute every instruction inside it.` which `relay-helper.mjs prompt-file` builds and passes as an argv element (never through a shell string).

Brief skeleton (one file per lane, written by the coordinator, stored with the run's records):

```markdown
# Brief: <lane-name>  (pattern: <pattern>, track: <track>, mode: interactive|autonomous)

## Grounding
- Feature: .qsdlc/<slug>/ ; read Intent.md, spec.md, plan.md phase <N> only
- Governing developer skill: qsdlc-dev-<web|api|cli>
- Spec excerpt / requirement IDs this lane serves: <...>
- Base SHA: <sha> ; branch/worktree: <...>

## Role
- You are <lane-name>. You own exactly: <globs from the ownership manifest>
- You must not edit: everything else, including skills/_shared/, other lanes' paths, and any protected_paths
- You never merge, never push to a shared branch, never answer an approval prompt for yourself

## Execution
- Steps, in order, each with its verification command
- Write your report to: <report path>   (file-backed output; do not rely on the chat transcript)

## Analysis (what you must report)
- What you verified with fresh evidence this run, and how (command + exit code)
- What you did not verify (Unverified), what failed or was skipped, and what else changed outside your paths (Also changed)

## Takeaway (required last section of your report)
- First line: PASS | ISSUES | BLOCKED
- Then at most 8 lines: result, evidence pointers (files, SHAs, test output), open risks
```

Rules the coordinator follows:

- The brief carries only the phase, the governing skill, the pattern tag, the spec excerpt and the role boundary. No session history (fresh context per lane).
- The coordinator reads the report's `Takeaway` (`relay-helper.mjs takeaway`) plus deterministic evidence. It does not read the full transcript. This keeps the coordinator's context small.
- Roles whose output must be a fixed machine shape (extractors, JSON sweeps) are exempt from the five headings; their whole output is the takeaway.
- Record the brief's `brief_sha256` (printed by `prompt-file`) in the ledger so the run is auditable.

## 5. Report contract and the PASS gate

A lane counts as `PASS` only when all hold:

1. The report file exists and `takeaway` extracts a section whose first status word is `PASS`.
2. The Takeaway cites evidence that exists (file, SHA, command with exit code).
3. `ownership-check` shows no file edited outside the lane's globs.
4. Deterministic checks pass in the coordinator's own shell: the project's test command, `qsdlc-lint.mjs` where present, and `git diff --stat` against the base SHA.
5. For writers, an independent reviewer pane (different agent, fresh context, read-only on the checkout) returned `PASS` on the same head SHA.

A missing report, a missing check, or a settled `idle`/`done` alone is a **gap, and a gap is not a pass**. Respawn that lane once; after a second miss record the gap and park.

`blocked` handling by mode (Autonomy and Escalation Policy, `skills/_shared/conventions.md` section 3):

| State seen | Interactive mode | Autonomous mode |
|---|---|---|
| `blocked` | `agent read`, summarize to the user, ask | Lane fault. `agent read`, log the dialog text, park or decline the lane, post to the mailbox. Never approve blindly. |
| `unknown` | Inspect the pane; do not assume completion | Same; treat as a failed wait, not a pass |
| `agent_not_ready` | Show the startup prompt to the user | Park the lane; do not click through trust prompts |

## 6. Isolation: `herdr worktree`

```bash
herdr worktree create --workspace "$HERDR_WORKSPACE_ID" --branch qsdlc/auto/feat-x-cand-a --base "$BASE_SHA" --label cand-a --no-focus
herdr worktree list --workspace "$HERDR_WORKSPACE_ID"
herdr worktree open  --workspace "$HERDR_WORKSPACE_ID" --branch qsdlc/auto/feat-x-cand-a --no-focus
herdr worktree remove --workspace <worktree-workspace-id>     # only ones this run created
```

- Read the new workspace and root pane IDs from the JSON response; the lane's `agent start` then targets that root pane.
- A branch can live in only one worktree. Name branches `qsdlc/auto/<slug>-<lane>` and record the base SHA.
- `--trust-repository` is never a routine retry. Use it only after the user verified the repository.
- `workspace close --group` closes the primary workspace and its linked worktree workspaces. Do not use it to bypass `workspace_group_close_required`.
- Never close a worktree workspace you did not create. After a run, `worktree remove` only the ones your ledger lists.

## 7. Notifications

```bash
herdr notification show "QSDLC feat-x: READY for review" --body "Draft PR opened. Verdict: needs-review." --position top-right --sound done
herdr notification show "QSDLC feat-x: lane impl-p2 blocked" --body "Parked. See mailbox." --sound request
```

Use `--sound request` for something a human must see, `done` for completions, `none` otherwise. A notification is *telling, not asking*: the same facts go to the file-based mailbox (`.qsdlc/factory/mailbox.md` in the factory design), nothing waits on the toast, and an unseen toast blocks nothing. Quiet wakes: a run with nothing to report sends nothing.

## 8. The nine relay patterns as Herdr topologies

Pick the pattern per stage with two gauging questions: (1) branch, loop or swarm? (2) which pattern in that shape? Real runs stack patterns; gauge each stage separately. A request one role can answer in one dispatch needs no pattern. Tag each `plan.md` phase with `pattern:` next to its `qsdlc-dev-*` tag so the dispatcher knows how to sequence it.

Legend for diagrams: `[pane:name]` is a pane with a named agent, `==>` a file-backed brief, `-->` a report file, `|||` a barrier.

### 8.1 Branches

#### Multipart Phases — parallel tabs/panes from the start, strict disjoint ownership

When: genuinely different components (web half and API half; product spec vs system spec; sweep + drain + scout) that need separate treatment from the start, not because of anything upstream.

```
tab: feat-x
 +-- [pane:web-lane]  ==> brief  owns src/web/**      --> reports/web.md
 +-- [pane:api-lane]  ==> brief  owns src/api/**      --> reports/api.md
 +-- [pane:docs-lane] ==> brief  owns docs/**         --> reports/docs.md
                              |||  barrier: all three Takeaways + ownership-check
                                   --> integration check in coordinator's shell
```

Sequence:

1. Write `manifest.json` with every lane's `owns[]` and `shared_readonly[]`.
2. `node relay-helper.mjs dispatch-guard manifest.json`. Exit 1 means do not launch.
3. For each lane: `pane split ... --no-focus` (or `tab create`), `agent start <name> ...`, `prompt-file <name> <brief>` (no `--wait`).
4. Barrier: `herdr agent wait <name> --timeout <ms>` per lane (or `prompt-file ... --wait` per lane from parallel shells), then `takeaway` and `ownership-check <manifest> <lane> --git-diff` per lane.
5. Run the integration tests yourself. Lanes never merge each other's work.

Pitfall: shared-tree parallel writers racing on the same file. The manifest guard exists for this; if two lanes truly need one file, serialize them (Dependency) or give them separate worktrees (§6).

#### Dependency — sequential barrier with a verified gate

When: step B is strictly determined by what step A produced (Intent -> spec -> plan -> eval -> docmd; Bugfix assess -> fix -> test).

```
[pane:assess] ==> brief-A --> report-A.md
                      |   gate: takeaway PASS + deterministic check + file exists
                      v
[pane:fix]    ==> brief-B (cites report-A path, not its prose) --> report-B.md
```

Sequence: dispatch A with `--wait`; run the gate; only then write brief B, which points at A's report file and the evidence it cites. If A fails verification twice, escalate (Audit rules in §8.2) rather than retrying blindly. A fresh pane per step keeps context clean; reuse a pane only when the next step genuinely needs the previous step's working memory, and say so in the ledger.

#### Comparative — parallel candidate lanes in isolated worktrees plus a blind judge

When: several candidate approaches and the job is to pick the best (prototype forks in Design, risky-change strategies).

```
worktree-a [pane:cand-a] ==> brief (same task, rubric hidden) --> cand-a/report.md
worktree-b [pane:cand-b] ==> brief                            --> cand-b/report.md
worktree-c [pane:cand-c] ==> brief                            --> cand-c/report.md
                                   |||
                    [pane:judge] ==> blind brief: candidates labeled X/Y/Z, rubric of 3-6
                                     gradeable criteria, no author names --> verdict.md
```

Sequence:

1. Coordinator derives the rubric before launch and keeps it out of the candidate briefs.
2. One worktree per candidate (`herdr worktree create --branch qsdlc/auto/<slug>-cand-a --base <sha> --no-focus`), one pane and named agent each.
3. Barrier on all candidates. Drop a candidate whose report lacks the base SHA and method its brief names; respawn once; a second miss is a recorded gap, not a pass.
4. Judge pane starts fresh, receives candidates under neutral labels and the rubric; it must not see which model or lane wrote which. Where only one model vendor is available, say the cross-vendor check did not run.
5. Pick by "a future maintainer can extend this most easily", optionally graft one or two ideas from losers, then verify the winner with the full test suite. If candidates diverge wildly, the brief was under-specified: reframe, do not average.

### 8.2 Loops

#### Pagination — one queue item or chunk per clean worker turn

When: the same operation over a sequence of independent items (queue-drain tickets, files in a lint-baseline cleanup, staged chunks).

```
queue/ T-01 T-02 T-03 ...
   for item in queue:
      fresh turn: [pane:worker] ==> brief(item) --> report(item).md --> ledger.md row
```

Sequence: one item per brief. Prefer a fresh agent (or at minimum a cleared context) per item: stop the agent, `pane run` a new `agent start`, or start a new pane, so item N never inherits item N-1's assumptions. After each item write one ledger row (item, brief sha, report path, status). Resume from the ledger and `git log`, never from recollection; a controller that lost its place and re-dispatched completed items is the single most expensive failure observed in the research. Bound the loop with `max_items` and `max_runtime_minutes` from `policy.md`; exceeding a budget is *declined and logged*, never held pending.

#### Audit — actor pane, independent fresh critic pane, capped rounds

When: a specific piece of work needs a second pass to review and redo, not just repeat (two-stage review, regression red->green).

```
[pane:actor]  ==> brief --> change (head SHA S1)
                     |
[pane:critic] ==> review brief (read-only; "treat the actor's report as unverified claims";
                  two verdicts: spec compliance, then quality; scoped to the diff)
                     --> findings.md
        Critical/Important? --yes--> actor fix round (scoped re-review on fix diff only)
        round cap reached?  --yes--> escalate once, then park with a ruling
```

Rules:

- The writer never judges its own code. The critic is a different pane with fresh context and read-only intent on the checkout.
- Cap at 2 rounds in autonomous mode, 3 in interactive (the factory rule is one retry, then escalate). On the second failed round, escalate: a **fresh** implementer on a stronger model (`agent start <name2> --kind claude --pane <new> -- --model ...` if the installed agent supports it), then if that fails, park the work on a WIP branch, post to the mailbox, and stop. A silent discard is forbidden.
- Minor findings are ledgered, not looped.
- Every re-review is scoped to the fix diff and pinned to a head SHA. A verdict covers one patch.

#### Realignment — step back, reassess ledger and state, replan

When: the whole effort needs a standing reassessment, not a re-run of the last step (mid-Build replan, `weekly-level-up`, stale-spec refresh).

```
[pane:realign] ==> brief: read ledger.md + state.md + git log since base + eval.md
                   output: what is done / what drifted / what to replan / next phase list
              --> replan.md   --> coordinator updates plan.md (as today)
```

Sequence: run in a fresh pane that sees only the ledger, `state.md` and the repository, not the previous workers' transcripts, so it assesses facts instead of inheriting narrative. Its output is a replan file; the coordinator (not the realigner) updates `plan.md` and appends to `state.md`'s log. Clean assessment means no forced work (`done`/quiet wake).

### 8.3 Swarms

#### Scatter — fan out independent pieces to named panes, `--wait` barriers

When: one large task splits into independent pieces purely for throughput (independent `plan.md` phases, many sources, multi-page sweeps).

```
coordinator
  |==> [pane:s1] ==> brief --> r1.md
  |==> [pane:s2] ==> brief --> r2.md
  |==> [pane:s3] ==> brief --> r3.md
  +--- barrier ---> aggregate: drop-and-respawn-once on missing SHA/method; then a gap is not a pass
```

Sequence: same as Multipart Phases but all pieces are the *same kind* of work with disjoint inputs/outputs, so the guard checks output paths. Cap lane count (narrow columns become unusable: alternate `--direction right` and `down`, or use extra tabs, rather than repeating one direction). For a large fan-out, create one tab per ~4 lanes. Each lane report's `Takeaway` is `PASS`, `ISSUES` or `BLOCKED` with evidence; aggregate only Takeaways.

#### Consensus / Polling — independent perspectives converge through one reconciler

When: multiple independent contributors must agree on one answer (review persona panel; synthesis vs adversarial stress-test; two independent eval authors).

```
[pane:rev-correctness] ==> brief --> p1.md  \
[pane:rev-standards]   ==> brief --> p2.md   >-- ||| --> [pane:reconciler] ==> brief --> verdict.md
[pane:rev-security]    ==> brief --> p3.md  /     (surfaces every unresolved conflict explicitly)
[pane:rev-compliance]  ==> brief --> p4.md  /
```

Sequence: personas run in parallel, read-only, each blind to the others' output. The reconciler runs only after **all** required panels returned (a missing one is a gap). It never silently picks a side; an unresolved disagreement is reported as such and routes to the stronger-model escalation, then park. Select persona panes by what the diff touches: always correctness and project standards; add security for auth or PII, data-migration for schema, api-contract for interface changes, and a compliance-calculation persona when regulated, billing, or financial calculation logic is in the diff.

#### Batch Testing — concurrent suites and arm benchmarks

When: the same task runs multiple ways specifically to measure and compare (eval cases across viewports, strategies for a risky change, factory A/B arms).

```
tab: eval-batch
 +-- [pane:suite-a] pane run "<test command A>" --> output captured to evidence/a.log
 +-- [pane:suite-b] pane run "<test command B>" --> evidence/b.log
 +-- [pane:arm-ctrl] agent arm with no factory      \
 +-- [pane:arm-test] agent arm with factory          > same brief, preregistered metrics
                       |||  --> results.md (bars, arms and stop rules declared BEFORE running)
```

Ordinary commands use panes, not agents: `herdr pane run <pane> "<command>"`, then `herdr pane wait-output <pane> --regex "<done marker>" --timeout <ms>` and `pane read --source recent-unwrapped`. For agent arms use identical briefs (file-backed) and pre-declare metrics; compare from files, not from impressions. Do a zero-cost dry run (`--dry-run`) before a priced run.

## 9. Stacking patterns: a worked factory run

A `delta`-track feature with two halves and a risky calculation, interactive mode:

1. **Multipart Phases**: `web-lane` and `api-lane` write in disjoint paths (guard passes), `docs-lane` drafts `docmd.md` last.
2. **Audit** on each writer: a fresh `rev-<lane>` critic returns two verdicts; max three rounds.
3. **Consensus**: for the regulated, billing, or financial calculation function, a four-persona panel plus one reconciler.
4. **Dependency**: `qsdlc-qa` runs only after the reconcile gate says `PASS`.
5. **Realignment** at the end of Build if the ledger shows drift.
6. Output: a **draft PR / READY block**. Lanes never merge; the coordinator never merges.

Terminal statuses for any autonomous run (from the factory design): `done`, `needs-review` (PR open, protected paths touched), `blocked`, `declined`, `failed`, `partial`. A run ends with exactly one.

## 10. Cleanup and hygiene

- Close only panes, tabs and worktrees listed in this run's ledger as created by you, and only after the lane's report is verified. Users' and other agents' panes are never touched.
- Keep one `roster` snapshot in the ledger before and after a swarm: `node relay-helper.mjs roster <your-workspace-id> --json`.
- `roster` reads only workspace-scoped `pane list` and `tab list`. Do **not** use bare `herdr agent list` for discovery in a shared session: it is global and returns other workspaces' agents.
- Never run `herdr server stop`, never `workspace close --group`, never kill the main Herdr process. Experiments needing an isolated server use a named `--session`.
- Quiet wakes: a polling pass with nothing to decide ends the turn without messaging anyone.
