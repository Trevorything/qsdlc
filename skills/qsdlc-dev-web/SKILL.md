---
name: qsdlc-dev-web
description: Developer-skill conventions for QSDLC build-stage work on frontend/web UI — component structure, state, accessibility, and testing conventions to follow when a plan.md phase is tagged qsdlc-dev-web.
---

# qsdlc-dev-web

A starter developer skill for QSDLC's Build stage. This is deliberately framework-agnostic — it states conventions to follow, not a specific stack. If the target project already has established frontend conventions (existing component patterns, a state management approach, a design system), **those win** — this skill fills gaps, it doesn't override what the codebase already does.

## Conventions

- **Components**: match the project's existing component granularity and naming. Don't introduce a new pattern (e.g. a new state-management library, a new styling approach) when an existing one already covers the need.
- **State**: keep state as local as it can be; lift it only when more than one component genuinely needs it. Avoid global state for anything that isn't actually global.
- **Accessibility**: semantic HTML first; every interactive element keyboard-reachable and labeled; don't rely on color alone to convey state.
- **Responsive design**: verify at more than one viewport width before calling a phase done — see the `run` skill or the project's own dev-server workflow for how to preview it live.
- **Styling**: follow the project's existing approach (CSS modules, utility classes, styled components, whatever is already there) rather than mixing in a new one.
- **Testing**: use the project's existing test runner and conventions; a UI phase isn't verified by type-checking alone — actually exercise the feature in a browser per this plan phase's verification step.

## When this skill doesn't fit

If the "web" work is really something else (e.g. a build tool, a static site generator config) — say so in `plan.md` rather than forcing these conventions where they don't apply.

## Extending

To make this stack-specific (e.g. `qsdlc-dev-react`, `qsdlc-dev-svelte`), copy this file's shape and replace the generic conventions above with real ones for that stack. See the vault's `02 Skills/Developer Skills.md` for the pattern.
