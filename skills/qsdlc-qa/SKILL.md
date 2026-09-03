---
name: qsdlc-qa
description: Draft or execute the QA/eval pass for a QSDLC feature. Drafts eval.md from spec.md and plan.md if it doesn't exist yet, or runs every test in an existing eval.md and produces a performance-results artifact. Use for the Test stage of QSDLC, or whenever the user says to run the QSDLC evals/tests.
---

# qsdlc-qa — Test stage

Read [../_shared/conventions.md](../_shared/conventions.md) first.

## Purpose

Verify the built feature actually does what `spec.md` said it would, with a written, re-runnable record — not a one-off "looks good to me."

## Mode 1 — draft `eval.md`

If `.qsdlc/<feature-slug>/eval.md` doesn't exist yet:

1. Read `spec.md` and `plan.md`.
2. Write `eval.md` from [../_shared/templates/eval.template.md](../_shared/templates/eval.template.md) with one test case per feature in `spec.md` (functional coverage), plus edge cases, regression checks on adjacent behavior the change could affect, and performance/security checks where `spec.md`'s system requirements call for them.
3. Each test case needs concrete steps and an expected result specific enough that running it doesn't require re-interpreting what "correct" means.
4. Show the drafted `eval.md` to the user before running anything — they may want to add or cut cases.

## Mode 2 — execute `eval.md`

This is what runs when the user says "run the evals" / invokes `qsdlc-qa` on an existing feature:

1. Read `eval.md`. For each test case, actually execute it — run the relevant test suite, exercise the feature directly (browser, CLI, API call — whatever the feature is), or otherwise verify against the expected result. Don't mark something `pass` without having actually checked it this run.
2. Update each row's `Status` (`pass` / `fail` / `blocked`) and `Notes` directly in `eval.md`.
3. Fill in the Summary section (totals) and list any current failures under "Open failures" with enough detail to act on.

## Output

The **performance results artifact** at `.qsdlc/<feature-slug>/artifacts/performance-results.html`: a data-first status report — pass/fail counts up front, failure detail below, any performance numbers gathered during the run.

## Wrap-up

If everything passes, confirm with the user before marking the Test stage complete in `state.md`. If there are failures, present them clearly and ask how to proceed — back to `qsdlc-build` to fix, or knowingly accept and document them (which then belongs in `docmd.md`'s known-limitations section during Deploy). Don't silently advance past failing tests.
