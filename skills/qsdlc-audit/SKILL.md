---
name: qsdlc-audit
description: Score a project's QSDLC factory on verified operational reliability, 100 points across Grounding, Verification, Compounding, and Cadence, with persistent finding IDs and a dated report in .qsdlc/factory/audits/. Use for the weekly audit, "how healthy is our factory", or before enabling autonomous runs.
disable-model-invocation: true
---

# qsdlc-audit

Read-only except its own report. Autonomous-safe: no questions. Score only what you checked **this run**; never trust a ritual doc or a past report as evidence.

## Scoring

4 dimensions, 5 criteria each, 5 points each. Per criterion: **5** verified this run, **3** documented but unverified, **0** missing, stale, or conflicting. Total 100.

| Band | Score |
|---|---|
| early | 0 to 39 |
| developing | 40 to 64 |
| solid | 65 to 84 |
| mature | 85 to 100 |

Label the total **verified operational reliability**, not quality.

| Dimension | Criteria (verify by running) |
|---|---|
| Grounding | `policy.md` has constitution and protected paths; feature map exists per product area and its commands run (`qsdlc-verify` Doctor); living specs exist for areas with recent deltas; recent `Intent.md` files state non-goals; `sources.yml` marks every source approved or not |
| Verification | last N finished runs have `eval.md` with Evidence that resolves; one real red then green proof exists; user-facing changes have a `manifest.json`; protected-path PRs carry invariant or property tests; no `pass` without evidence |
| Compounding | every class with 2 or more occurrences has an enforcer with a proof commit; `rules.md` matches `corrections.tsv`; no `no-trigger` shortcut markers past the staleness window; `doc_level_share` is flat or falling; `repeat_rate` is near zero |
| Cadence | every `enabled: true` ritual has a real scheduler entry and a run inside its window; no run stuck `running`; each `targetPattern` resolves to a skill; manual rituals are labeled manual; mailbox has no unread `failed` entries older than a week |

## Procedure

1. `node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --json` and `node <SKILLS>/_shared/scripts/qsdlc-log.mjs metrics --root . --json`. Quote the output as evidence. If `graphify-out/graph.json` exists, also check `node <SKILLS>/qsdlc-graphify/scripts/graphify-bridge.mjs summary --root . --json` under Grounding.
2. Check schedulers directly: `schtasks /Query /TN <name>` on Windows, `crontab -l` elsewhere, or the `/schedule` listing. A ritual with no entry and no run evidence is scored 0 as **manual claim, no evidence**.
3. Score each criterion with a one-line evidence pointer (file path, command, run id).
4. Findings: load the previous `audits/*.md`. Keep IDs stable (`F-001`, `F-002`...). Status per finding: `new`, `still open`, `resolved`, `reopened`, or `not rechecked`. New findings take the next free number.
5. Write `.qsdlc/factory/audits/<YYYY-MM-DD>.md`: score table, band, findings table (ID, status, dimension, evidence, suggested fix), and the single highest-priority finding for `weekly-level-up`.
6. Invoke `qsdlc-present` for a scorecard artifact at `.qsdlc/factory/audits/<date>-scorecard.html`.
7. Log with `qsdlc-log.mjs`, finish `done`. Quiet wake: if nothing changed since the last report, log `clean` and write no new report.

## Rules

- Do not fix anything here. Fixes belong to `weekly-level-up` (one finding per run) or `qsdlc-correct`.
- A criterion you could not check is `not rechecked` and scores 0 for the run, with the reason.
- Never put PII or ticket bodies in the report.
