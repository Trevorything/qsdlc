---
tags: [overview]
---

# Why QSDLC

## The problem it solves

Left unstructured, AI-assisted development tends toward one of two failure modes: every request gets re-litigated from scratch with no memory of prior decisions, or the AI moves fast toward *a* solution without confirming it is the *right* one. Both produce inconsistent output, because quality depends on how carefully one conversation happened to go.

QSDLC makes good practice the default path instead of something you have to remember to ask for.

## What structure buys you

- **A written record survives the conversation.** `Intent.md`, `spec.md`, `plan.md`, `eval.md`, and `docmd.md` are durable. A teammate, a future session, or you in three months can reconstruct why a decision was made without digging through chat history.
- **Checkpoints catch drift early.** Each stage produces something reviewable before the next stage builds on it. Catching a misunderstood requirement at [[1 - Plan]] costs a conversation; catching it after [[3 - Build]] costs a rewrite.
- **Consistency across features.** Every feature gets the same shape of scrutiny: the same interview areas, the same spec structure, the same rigor in eval.
- **Subagents work from grounded context.** [[3 - Build]] hands each subagent a concrete `plan.md` phase, a developer skill's conventions, and a brief in GREAT form, not a paraphrase of what the user first asked for.

## Where to spend effort: the inverse pyramid

The research in [[Poteto - All Code Is Slop and pstack]] argues that if the inner coding loop produces slop, automating that loop only produces more slop. The talk's pyramid ranks where engineering time should go, widest layer first:

1. **The codebase.** Agents copy the patterns they find, workarounds and deprecated code included. The code is the biggest prompt.
2. **Static checks.** Types, lint rules, and CI that fail with an error naming the right alternative.
3. **Runtime and end-to-end verification.** Driving the real app and capturing evidence, so a person is not the verification step.
4. **Prose.** Rules files, skills, and agent instructions: the weakest layer, kept minimal.

QSDLC v2 follows that order. Conventions in the developer skills list what *enforces* each one and flag prose-only rows `promote-to-check`. [[qsdlc-correct]] moves a mistake that happens twice up the ladder (architecture, types, a lint or test, docs last) and records a proof that the check fails on the original mistake. `qsdlc-lint`, the `qsdlc-log` logger, and the [[qsdlc-guard]] hook check what a script can check. [[qsdlc-qa]] Mode 3 and [[qsdlc-verify]] drive the running app and write evidence. See [[Continuous Factory#Deterministic enforcement]].

What QSDLC took from the broader field, and what it left out, is in [[Alternatives to pstack]]: delta specs for existing code, two-stage review, a cheapest-durable-form ladder for lessons, and real-browser verification, without installing a second framework.

## Stage gates in interactive mode

In interactive mode every stage skill stops and asks for confirmation before it counts as done (see `/skills/_shared/conventions.md`). A stage boundary is the cheapest place to say "that's not quite it," before more work is built on the misunderstanding. [[qsdlc-pr]] never stages, commits, pushes, or opens a PR without a separate go-ahead in that turn, because that is the one action in the lifecycle that is visible outside the machine and hard to walk back.

## Check-gates in autonomous mode

A scheduled run has no person to ask, so the gate changes shape. This follows Trevor's Autonomy and Escalation Policy: an agent with enough information acts, logs what it did with enough detail to reverse it, and tells the user afterward. It does not stop mid-task to ask.

| | Interactive | Autonomous |
|---|---|---|
| Between stages | A person confirms | Checks must pass: spec analyze, eval evidence, two-stage review, `qsdlc-lint --strict` |
| Missing input | Ask a clarifying question | End `declined: insufficient-intent`, tell the mailbox |
| Ambiguity | Ask | Record a Ruling: what, why, cost if wrong |
| A limit is hit | Ask | Decline and log; raising a limit is a human edit to `policy.md` |
| Leaving the machine | Per-turn go-ahead for a PR | Only what `policy.md` grants: a run branch and a **draft** PR |
| Deleting | Warn and ask | Soft delete into `.qsdlc/archive/`, logged with how to reverse |
| Reporting | In the conversation | `mailbox.md`, a notice that nothing waits on |

The human gate moves from "pause mid-run" to "the draft PR": the output is reviewable and reversible, and merging stays a person's decision. Autonomous runs never merge, never push to the default branch, never force-push, and never publish. Work that touches a protected path can only end `needs-review`.

## Why two outputs per stage

A markdown document and an HTML artifact serve different readers. The document is precise and inspectable, good for verifying a claim later. The artifact is the fast, visual version, good for a quick "yes, that's right." [[qsdlc-present]] builds each artifact bound to the target product's own design tokens, and its linter and screenshots check the result, so the artifact is something a reviewer can trust, not decoration. See [[Artifacts]].

## See also

[[QSDLC]], [[Continuous Factory]], [[Alternatives to pstack]], [[Poteto - All Code Is Slop and pstack]]
