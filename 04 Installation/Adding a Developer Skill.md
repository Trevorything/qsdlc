---
tags: [installation]
---

# Adding a Developer Skill

[[Developer Skills]] are the pattern [[3 - Build|Build]] uses to give subagents stack-specific conventions. The three starter skills (`qsdlc-dev-web`, `qsdlc-dev-api`, `qsdlc-dev-cli`) are intentionally generic — here's how to make one specific to a real stack.

## Steps

1. **Copy the shape** of the closest starter skill — e.g. cloning `skills/qsdlc-dev-web/SKILL.md` into a new `skills/qsdlc-dev-react/SKILL.md`.
2. **Update the frontmatter** `name` and `description` to name the specific stack, so it's discoverable for the right kind of work.
3. **Replace the generic conventions** with real ones for that stack — actual patterns, actual libraries, actual file-layout conventions, not restated generalities. Keep the opening note that the target project's *existing* conventions win over anything stated here.
4. **Keep the "when this skill doesn't fit" section** — it's what stops Build from force-fitting unrelated work into the wrong developer skill.
5. **Add a row** to `qsdlc-build`'s developer-skill table (in `skills/qsdlc-build/SKILL.md`) and to [[Developer Skills]]'s starter-set table, so Build actually offers the new skill when tagging phases.
6. **Install it** alongside the rest — see [[Install Individual Skills]] or [[Install as a Plugin]].

## Naming

Follow the existing convention: `qsdlc-dev-<specific-thing>` — e.g. `qsdlc-dev-django`, `qsdlc-dev-nextjs`, `qsdlc-dev-cli-python`. Specific enough to be unambiguous, no more.
