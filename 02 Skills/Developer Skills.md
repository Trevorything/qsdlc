---
tags: [skill]
---

# Developer Skills

Not one skill — a pattern. [[3 - Build|Build]]-stage work gets tagged in `plan.md` with a *developer skill* that states the conventions a phase (and the subagent executing it) should follow. They're deliberately category-level, not framework-specific — they defer to whatever conventions already exist in the target project, and only fill gaps.

## Starter set

| Skill | Covers |
|---|---|
| `qsdlc-dev-web` | Frontend/web UI — components, state, accessibility, responsive design, styling, testing |
| `qsdlc-dev-api` | Backend/API — input validation at the boundary, error handling, idempotency, migration safety, auth checks |
| `qsdlc-dev-cli` | CLI/tooling — argument parsing, exit codes, stdout/stderr discipline, non-interactive friendliness |

Implementations: `/skills/qsdlc-dev-web/SKILL.md`, `/skills/qsdlc-dev-api/SKILL.md`, `/skills/qsdlc-dev-cli/SKILL.md`.

## Adding your own

These three are starting points, not a fixed set. As real stack-specific needs come up, clone the shape of one of these into a new `qsdlc-dev-<name>/SKILL.md`:

1. State up front that it defers to the target project's existing conventions where they exist.
2. List concrete conventions for that stack (e.g. `qsdlc-dev-react` would cover hooks conventions, component file layout, the project's actual state library).
3. Note when the skill doesn't apply, so a build phase doesn't get force-fit into the wrong developer skill.
4. Add a row to [[qsdlc-build]]'s developer-skill table so Build knows to offer it.

See [[Adding a Developer Skill]] for the step-by-step.

## See also

[[qsdlc-build]], [[3 - Build]]
