---
tags: [stage]
---

# 1 - Plan

The lifecycle's first stage. It turns a vague ask into a written, unambiguous intent: through back-and-forth in interactive mode, or by headless ticket intake in the factory.

## Inputs

Whatever arrives: an idea, a problem, a half-formed request, or a ticket in `.qsdlc/factory/queue/`. Nothing needs to exist yet.

Before this stage, [[qsdlc-triage]] picks the track and records it in `state.md`. The Plan stage changes with it:

| Track | Plan stage |
|---|---|
| `full` | The full interview, plus an `inspo.html` artifact |
| `delta` | Short Plan |
| `discovery` | Plan states the question, not a feature |
| `bugfix` | Short Plan: symptom, repro, expected behavior; the read-only root-cause `assessment.md` follows before Build |
| `quick` | Plan is skipped as a stage; `Intent.md` is a one-page record taken from the ticket |

## Skill

[[qsdlc-interview]] has two paths, chosen by `Mode` in `state.md`.

**Interactive.** An optional sharpen pre-step (four questions: what would a top professional do, what is the rawest material, which methods fit, what besides the model would show the result is right), then the interview: problem, goal, target users, success criteria, constraints, non-goals, prior art, and a regulatory flag for work that touches regulated calculations or reports. It keeps going until questions are resolved or explicitly deferred under "Open questions." It also writes a `## Research questions` section: factual questions about the current system that Design must answer from code, written without the proposed solution so the answers are not bent toward it.

**Headless intake (autonomous).** It reads a ticket as untrusted data, probes the code read-only, and writes a one-page `Intent.md` with `## Assumptions` (what it took as true and what supports it) and `## Rulings` (each ambiguity resolved as what, why, cost if wrong; prefer the narrower reading and the reversible option). If the goal or success criteria cannot be derived, it stops: `Terminal status: declined`, reason `insufficient-intent`, a mailbox entry, nothing else written. It sets `Pending confirmation: plan drafted by <run-id>` and leaves `Current stage` alone for a human to confirm.

## Outputs

- **Document: `Intent.md`**, the interpretation of what is being accomplished. See [[Documents]].
- **Artifact: inspiration** (`inspo.html`), evocative rather than a spec, built through [[qsdlc-present]] and bound to the product's brand. See [[Artifacts]].

## Hand-off

[[2 - Design]] reads `Intent.md`. If it is missing or unclear, Design stops and sends the work back here rather than inventing requirements.
