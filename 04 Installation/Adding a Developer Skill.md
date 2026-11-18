---
tags: [installation]
---

# Adding a Developer Skill

[[Developer Skills]] are the pattern [[3 - Build|Build]] uses to give subagents stack-specific conventions. The three starter skills (`qsdlc-dev-web`, `qsdlc-dev-api`, `qsdlc-dev-cli`) are deliberately generic. Here is how to make one specific to a real stack.

## Steps

1. **Copy the shape** of the closest starter skill, for example `skills/qsdlc-dev-web/SKILL.md` into a new `skills/qsdlc-dev-react/SKILL.md`.
2. **Update the frontmatter** `name` and `description` to name the stack, so it is discoverable for the right work. State when a plan phase should use it (the `plan.md` phase is tagged with its name).
3. **Keep the opening note** that the target project's existing conventions win over anything stated here.
4. **Replace the generic rows with real ones** in the conventions table, and fill in the **Enforced by** column with real rule names.
5. **Keep the "When this skill does not fit" section.** It stops Build from forcing unrelated work into the wrong skill.
6. **Add the skill** to [[qsdlc-build]]'s developer-skill selection and to the starter table in [[Developer Skills]], so Build offers it when tagging phases.
7. **Install it** alongside the rest: [[Install Individual Skills]] or [[Install as a Plugin]].

## The Enforced by table and `promote-to-check`

Prose is the weakest layer, so every convention row names what holds it.

| Convention | Enforced by | promote-to-check |
|---|---|---|
| (the rule, in one line) | a type, lint rule, test, hook, or `prose` | `yes` only when enforced by prose alone |

- **Enforced by** can be `type`, `lint` (with the rule name where configured), `test` (the case that exercises it), `hook` ([[qsdlc-guard]] or `qsdlc-lint`), or `prose`.
- A row enforced only by `prose` gets `promote-to-check: yes`. When [[qsdlc-correct]] sees that row corrected twice, it converts it into a lint rule, type, or test and records the enforcer and a proof commit in `rules.md`.
- If a row says "where configured" and nothing is configured, the first correction should add the rule.
- Comment and suppression rules point at `qsdlc-lint` V11, which requires a `qsdlc-exception(reason; expires; approver)` record on any suppression.

Also state how a phase is verified (commands whose output is saved under `evidence/`) and how destructive operations behave in autonomous mode (soft delete through the guard).

## Naming

Follow the existing convention: `qsdlc-dev-<specific-thing>`, such as `qsdlc-dev-django`, `qsdlc-dev-nextjs`, or `qsdlc-dev-cli-python`. Specific enough to be unambiguous, no more.
