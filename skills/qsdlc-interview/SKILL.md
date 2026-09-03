---
name: qsdlc-interview
description: Interview the user through back-and-forth discussion to pin down what a feature or build is actually trying to accomplish, then write Intent.md and an inspiration artifact. Use for the Plan stage of QSDLC, or whenever the user wants help nailing down the goal of something before jumping into implementation.
---

# qsdlc-interview — Plan stage

Read [../_shared/conventions.md](../_shared/conventions.md) for the `.qsdlc/<feature-slug>/` contract and the stage-gate rule before starting.

## Purpose

Turn a vague ask into an unambiguous, written intent — through genuine back-and-forth, not a one-shot questionnaire. Most first answers are incomplete; your job is to keep asking until the goal, the user, and the boundaries of the work are all concrete.

## Interview protocol

Work through these areas conversationally, in whatever order fits the discussion — don't dump all questions at once:

1. **Problem** — what's broken, missing, or worth building? Who feels this today, and how do you know?
2. **Goal** — what does success look like, as an outcome, not a solution? (If the user jumps straight to a solution, ask what problem that solution solves, and capture the goal underneath it.)
3. **Target users** — who is this for? If there are multiple audiences, get the primary one named explicitly.
4. **Success criteria** — press for concrete, checkable statements. "Better UX" is not a success criterion; "a returning user can complete checkout in under 3 clicks" is.
5. **Constraints** — technical, timeline, budget, organizational. Ask directly; these rarely surface unprompted.
6. **Explicit non-goals** — what should Design/Build *not* do, even if it seems related? This is the scope fence that prevents creep later.
7. **Prior art** — existing features, competitors, internal precedents that shaped this ask.

**Keep going until open questions are actually resolved or explicitly deferred** — don't write Intent.md around vague answers just to move forward. If the user is unsure about something, it's fine to record it under "Open questions" rather than force a premature decision, but say so out loud rather than silently guessing.

## Output

1. Confirm (or create) the feature slug and `.qsdlc/<feature-slug>/` folder per the conventions doc.
2. Write `Intent.md` from [../_shared/templates/Intent.template.md](../_shared/templates/Intent.template.md), fully resolved — no leftover placeholder brackets.
3. Produce the **inspo artifact** at `.qsdlc/<feature-slug>/artifacts/inspo.html`: a visual, evocative representation of the vision — mood, tone, reference imagery/descriptions, key phrases from the interview that capture the feeling of the thing. This is deliberately *not* a spec or a wireframe — it's inspiration, meant to confirm "yes, this is the right vibe" before Design grounds it into requirements. Follow the artifact convention in the shared conventions doc (self-contained HTML).
4. Show the user both, and ask them to confirm Intent.md and the inspo artifact actually capture what they mean before marking this stage complete in `state.md`. If they push back, keep iterating — don't treat one round as sufficient.
