---
tags: [skill]
---

# qsdlc-feature-research

- **Stage**: [[2 - Design]] (helper — also usable standalone)
- **Implementation**: `/skills/qsdlc-feature-research/SKILL.md`
- **Triggers on**: called from `qsdlc-design` for creative/ambiguous asks, or directly whenever the user wants examples of how others have built something similar

## What it does

Searches for open-source repositories, articles, and design patterns implementing something comparable to the requested feature. For each finding, captures what it does, what's actually reusable vs. just inspiration, and license.

## Produces

- When called from within an active Design stage: appends findings directly into the open `spec.md`'s open-source references table
- When called standalone: presents the findings in conversation

## See also

[[qsdlc-design]], [[2 - Design]]
