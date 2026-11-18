---
name: qsdlc-verify
description: Create and maintain the feature map in .qsdlc/factory/verify/ and the project's verify-<app> skill that launches the real app, drives it, captures evidence and cleans up. Use to set up app verification, for qsdlc-qa Mode 3, when the map drifts from the app, or for a scheduled daily map-maintenance pass.
---

# qsdlc-verify

Read [../_shared/conventions.md](../_shared/conventions.md). Scope fence: write only under `.qsdlc/factory/verify/` and `.claude/skills/verify-<app>/`. Never edit product code. Never touch production data.

## Create

1. **Interview the repo:** how it runs (Run), what a user touches (Entry points), how to drive it (Drive), what to observe (Observe), how to isolate it (Isolate). Fix a non-building checkout first.
2. **Generate `.claude/skills/verify-<app>/SKILL.md`** with six sections:
   - **Launch:** reach a usable state from an empty disposable data dir (env var keyed by run id, seeded fixtures). Ready means usable, not that a process answers.
   - **Doctor:** one read-only check that prints URL, data dir, and build revision.
   - **Drive:** real selectors, ARIA roles and names over CSS, literal commands. Windows-safe (PowerShell or Node, no tmux).
   - **Evidence:** write to `.qsdlc/factory/evidence/<run-id>/<feature-id>/` with a `manifest.json`.
   - **Cleanup:** stop only processes this run started (never kill by process name), remove instances and scratch state, never the evidence.
   - **Helpers:** executable scripts with invocation shown.
3. **Seed the map:** `features/README.md` index plus one `features/<id>.md` for the top 3 to 5 features, from `feature-map-entry.template.md`. Four H2s, in order: `Sub-features` (stable kebab ids), `How to get to it (user POV)`, `Driving it with <harness>` (first line `Preconditions:`, every bullet an exact command and observable result), `Gotchas`.
4. **Prove it once:** launch, doctor, drive one feature, capture evidence, clean up, confirm the evidence survived. A generated skill never executed is a draft, not a deliverable. List any setup the stand-in did that the target will not.

## Evidence standard

Exercise the real user path. Capture the action and the resulting state, plus side effects (rows, files, messages). UI proof is an ARIA snapshot and a screenshot with app identity visible; CLI proof is command, stdout, stderr, exit code; a mutation needs a read-only second view. Seeded fixtures only; `pii_scrubbed` must be true. `manifest.json` keys: `schema, run_id, feature_id, sub_feature_id, entry_point, build_rev, env, action, observations, readonly_crosscheck, side_effects_checked, result, blocked_reason, pii_scrubbed`. `result` is `pass`, `fail`, or `blocked`.

Never weaken a journey to make it pass. A skipped entry point is never reported verified through a different one. Unreachable features are `blocked` with `unreachable: <prerequisite>; route: <command>`.

## Maintain (daily, scheduled)

1. Source wave: one read-only subagent per feature file, returning summary, entry points, likely drift or none, one recipe.
2. Reconcile; call a feature missing only with a concrete source path.
3. Live pass, required even when source looks clean: Doctor before the first drive and after any failure; evidence survives cleanup; nothing started outlives the drive.
4. Triage: doc drift (fix), tooling gap (fix and re-drive), product gap (write a ticket from `ticket.template.md` into `.qsdlc/factory/queue/`, keep it out of the change).
5. Outcome, stated plainly: `clean` (no branch), `changed` (one draft PR of proven corrections, verify dirs only), or `blocked` (say exactly what).

## Validate

```
node <SKILLS>/_shared/scripts/qsdlc-lint.mjs --root . --json
```

V4 (map shape, ids, links) and V5 (manifests, PII regex) must pass.

## Return

GREAT form. Takeaway: outcome, features proved, features blocked with prerequisite.
