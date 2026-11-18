---
tags: [skill, factory]
---

# qsdlc-verify

- **Stage**: [[4 - Test]] (Mode 3 of [[qsdlc-qa]] consumes what this builds)
- **Implementation**: `/skills/qsdlc-verify/SKILL.md`
- **Triggers on**: setting up app verification, `qsdlc-qa` Mode 3, a feature map that drifted from the app, or the scheduled daily map-maintenance pass

## What it does

Creates and maintains the **feature map** in `.qsdlc/factory/verify/` and the project's own `verify-<app>` skill, which launches the real app, drives it, captures evidence, and cleans up. Scope fence: it writes only under `.qsdlc/factory/verify/` and `.claude/skills/verify-<app>/`, never edits product code, and never touches production data.

**Create.**

1. Interview the repo: Run, Entry points, Drive, Observe, Isolate.
2. Generate `.claude/skills/verify-<app>/SKILL.md` with six sections: Launch (from an empty disposable data dir with seeded fixtures; ready means usable), Doctor (one read-only check printing URL, data dir, and build revision), Drive (real selectors and ARIA roles, literal commands, Windows-safe), Evidence, Cleanup (stop only processes this run started), Helpers.
3. Seed the map: `features/README.md` plus one `features/<id>.md` for the top 3 to 5 features. Each has four H2s in order: Sub-features, How to get to it (user POV), Driving it with `<harness>` (first line `Preconditions:`, every bullet an exact command and observable result), Gotchas.
4. Prove it once: launch, doctor, drive one feature, capture evidence, clean up, confirm the evidence survived. A generated skill never executed is a draft, not a deliverable.

**Evidence standard.** Exercise the real user path; capture the action, the resulting state, and side effects. UI proof is an ARIA snapshot and a screenshot with the app identity visible; CLI proof is command, stdout, stderr, and exit code; a mutation needs a read-only second view. Seeded fixtures only, `pii_scrubbed: true`. Each proof is a `manifest.json` under `.qsdlc/factory/evidence/<run-id>/<feature-id>/` whose `result` is `pass`, `fail`, or `blocked`. A skipped entry point is never reported verified through a different one.

**Maintain (daily, scheduled).** One read-only subagent per feature file, reconcile, a live pass (Doctor first), then triage into doc drift (fix), tooling gap (fix and re-drive), or product gap (a ticket in `queue/`). The outcome is `clean`, `changed` (one draft PR, verify dirs only), or `blocked`.

**Validate.** `qsdlc-lint --json`; V4 (map shape, ids, links) and V5 (manifests, PII) must pass.

## See also

[[qsdlc-qa]], [[4 - Test]], [[Continuous Factory]], [[Documents]]
