---
tags: [overview]
---

# Why QSDLC

## The problem it solves

Left unstructured, AI-assisted development tends toward one of two failure modes: either every request gets re-litigated from scratch with no memory of prior decisions, or the AI moves fast toward *a* solution without ever confirming it's the *right* one. Both produce inconsistent output — quality depends entirely on how carefully any one conversation happened to go.

QSDLC exists to make good practice the default path, not something you have to remember to ask for each time.

## What structure buys you

- **A written record survives the conversation.** `Intent.md`, `spec.md`, `plan.md`, `eval.md`, and `docmd.md` are durable — a teammate, a future session, or you in three months can reconstruct *why* a decision was made without archaeology through chat history.
- **Confirmation points catch drift early.** Each stage produces something reviewable — a document and a visual artifact — before the next stage builds on top of it. Catching a misunderstood requirement at [[1 - Plan]] costs a conversation; catching it after [[3 - Build]] costs a rewrite.
- **Consistency across features.** Every feature gets the same shape of scrutiny — the same categories of question in the interview, the same structure of spec, the same rigor in eval — regardless of who's driving or how much time pressure there is.
- **Subagents work from grounded context, not vibes.** By the time [[3 - Build]] dispatches work to subagents, they're handed a concrete `plan.md` phase and a developer skill's conventions — not a paraphrase of a paraphrase of what the user originally asked for.

## Why explicit stage-gates

Every stage skill stops and asks for confirmation before considering itself done (see the shared conventions in `/skills/_shared/conventions.md`). This is deliberate, not conservative box-checking: a stage boundary is the cheapest place to say "actually, that's not quite it" — before more work has been built on top of the misunderstanding. `qsdlc-pr` in particular never pushes or opens a PR without a separate, explicit go-ahead, because that's the one action in the whole lifecycle that's externally visible and hard to walk back.

## Why two outputs per stage, not one

A markdown document and a polished artifact serve different readers. The document is precise and inspectable — good for anyone who needs to verify a claim later. The artifact is the fast, visual version — good for a quick "yes, that's right" in the moment. Producing both means neither audience is stuck reading the wrong format.
