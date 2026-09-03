---
name: qsdlc-feature-research
description: Research open-source examples and prior art for a requested feature, especially for creative or ambiguous asks, and summarize what's reusable. Use during the Design stage of QSDLC to ground spec.md in real-world implementations, or standalone whenever the user wants examples of how others have built something similar.
---

# qsdlc-feature-research

## Purpose

Ground a feature ask in reality before requirements get written. Good prior art turns "make it feel premium" into concrete, referenceable patterns.

## Process

1. Identify the core capability being asked for, stripped of project-specific framing (e.g. "checkout flow redesign" → search for checkout UX patterns, not the project's internal name for it).
2. Search for open-source repositories, articles, and design patterns implementing something comparable. Prefer sources that show *how* something works (real code, real screenshots, real writeups) over marketing pages.
3. For each finding worth keeping, capture:
   - What it does and why it's relevant to this ask
   - What's actually reusable (a pattern, an approach, specific code) vs. what's just inspiration
   - License, if code might genuinely be reused
4. Summarize findings as a short table (reference, what it does, reusable?, license) — this is the exact shape `spec.md`'s "Open-source references" section expects.

## Output

- **When invoked from `qsdlc-design`** during an active Design stage: append the findings table directly into the open `spec.md`'s "Open-source references" section rather than producing a separate file.
- **When invoked standalone**: just present the findings table and summary in the conversation — there's no `.qsdlc/` context to write into unless the user asks you to save it somewhere.

Keep it tight — 3-6 well-chosen references beat a long list of shallow ones.
