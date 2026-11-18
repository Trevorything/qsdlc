---
tags: [skill, factory]
---

# qsdlc-audit

- **Stage**: none (scores the whole factory)
- **Implementation**: `/skills/qsdlc-audit/SKILL.md`
- **Triggers on**: explicit invocation (`disable-model-invocation` is set), the weekly audit, "how healthy is our factory", or before enabling autonomous runs

## What it does

Scores a project's factory on **verified operational reliability** out of 100: four dimensions, five criteria each, five points per criterion. A criterion scores 5 if verified this run, 3 if documented but unverified, 0 if missing, stale, or conflicting. It scores only what it checked in this run; a ritual doc or an old report is not evidence. Bands: early 0 to 39, developing 40 to 64, solid 65 to 84, mature 85 to 100.

| Dimension | What is checked by running it |
|---|---|
| Grounding | `policy.md` has a constitution and protected paths; a feature map exists per product area and its Doctor check runs; living specs exist where deltas landed; recent `Intent.md` files state non-goals; every source in `sources.yml` is marked approved or not |
| Verification | recent finished runs have `eval.md` with Evidence that resolves; one real red-then-green proof exists; user-facing changes have a `manifest.json`; protected-path PRs carry invariant or property tests; no `pass` without evidence |
| Compounding | every class with two or more occurrences has an enforcer with a proof commit; `rules.md` matches `corrections.tsv`; no stale `no-trigger` shortcut markers; `doc_level_share` flat or falling; `repeat_rate` near zero |
| Cadence | every `enabled: true` ritual has a real scheduler entry and a run inside its window; no run stuck `running`; each `targetPattern` resolves; manual rituals are labeled manual; no old unread `failed` mailbox entries |

Procedure: run `qsdlc-lint --json` and `qsdlc-log.mjs metrics --json`, query the scheduler directly (`schtasks /Query /TN <name>`, `crontab -l`, or the `/schedule` listing), score each criterion with a one-line evidence pointer, and keep finding ids stable (`F-001`, `F-002`) with status `new`, `still open`, `resolved`, `reopened`, or `not rechecked`. A ritual with no scheduler entry and no run evidence scores 0 as "manual claim, no evidence".

It fixes nothing. Fixes belong to the `weekly-level-up` ritual (one finding per run) or [[qsdlc-correct]].

## Produces

`.qsdlc/factory/audits/<YYYY-MM-DD>.md` (score table, band, findings, the single highest-priority finding) and a scorecard artifact `<date>-scorecard.html` built through [[qsdlc-present]]. No personal data or ticket bodies go in the report.

## See also

[[Continuous Factory]], [[qsdlc-ritual]], [[Why QSDLC]]
