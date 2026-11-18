---
tags: [research]
---

# Poteto: All Code Is Slop and pstack

Research notes on Lauren Tan (poteto) and her approach to shipping agent-written code at volume. The notes cover her talks, her pstack plugin, and what both mean for QSDLC. Research date: 2026-11-18.

## Summary

The public pstack repo does not contain Dune. "Dune" appears nowhere in `cursor/plugins`, and neither does Control Glass. The specific guardrails are internal to Grok Bot. The public repo holds the process that builds guardrails like them, not the guardrails.

## Context

| Item | Detail |
|---|---|
| Speaker | Lauren Tan (poteto). Joined Cursor in April 2026. Cursor later merged into SpaceXAI. She now works on Grok Bot at SpaceXAI. |
| Main talk | "All Code Is Slop (Except Mine)", AI Engineer Code Summit, 2026-11-14, about 17 minutes |
| Earlier talks | A September 2026 livestream (first planned for Cursor Compile London), and an earlier workshop recorded as "SpaceX AI Engineer Lauren Tan: Part 1" |
| Framing | She does not fully accept the "software factory" label. She prefers a Michelin kitchen, where a person stays responsible for what leaves the kitchen. She crosses out "software factory" in the September talk. |
| Slide coverage | The comment-count chart and the Cindy Sridharan chart match the AI Engineer talk. No written summary covers the slides on directory structure, tibo.dog, or unsolicited markdown. No transcript was available. Those three slides are described from screenshots only. |

## Major takeaways

| Takeaway | What she claims | Assessment |
|---|---|---|
| Trust before parallelism | "If your inner coding loop produces slop, then automating that loop just produces more slop." | This is the central argument and the easiest one to skip. Everything else depends on it. |
| The inverse pyramid | Engineering time goes, from widest layer to thinnest: codebase, static analysis, verification, then prose (rules, skills, agents.md). One version adds human review as the most expensive layer. | Sound. The layer order differs between her September and November talks. Treat it as a direction, not a fixed taxonomy. |
| Every correction becomes a check | Turn each correction into a deterministic check, not another line in rules or agents.md. | The most portable idea. It also argues against much of pstack itself, which is mostly prose. |
| The codebase is the biggest prompt | Agents copy existing patterns, including workarounds, deprecated code, and tech debt. Her review load went from about 3 PRs a day in 2024 to about 300. | Correct, and old knowledge. Large companies built strict frameworks for the same reason long before agents. |
| Ban what needs nuance | `useEffect` is banned in product code and allowed only inside framework APIs. | Strong. A ban removes a whole class of review comments at once. |
| Directory structure is context | Renderer and main-process code sit in separate top-level directories that cannot import each other. A dependency graph analyzer and lint rules enforce this. The slide adds "not even types" and file-name suffixes such as `.hot.ts` that carry constraints. | Underrated. A suffix that triggers a lint (for example, "no allocations in `.hot.ts`") turns a file name into an enforced rule. |
| Comments are liabilities | The comment count fell from 65,824 on July 31 to 1,227, a reduction of more than 98%. | The reasoning comes from a real failure. A zero-delay `setTimeout` with a justifying comment, added Sept 9, was copied into a shared module by Oct 3. By Oct 17 there were 183 timers. |
| Tokens go to verification | Cindy Sridharan spends about 70% of her daily tokens verifying patches and 20 to 30% creating them. Tan says her ratio is similar. | The testing-taxonomy slide is standard engineering practice. Her point is that agents make all of it cheap enough to use. |

## How much weight the numbers can bear

| Figure | Source | Caveat |
|---|---|---|
| Her personal PRs per month | About 1,000 in an earlier talk, about 2,000 in September (the post said 2,500), 3,000 in November, and about 4,000 per a colleague on Lightcone | All self-reported. The count changes with each telling. |
| Team: 11,000 PRs, 0.5% reverted | 227 people contributed at least one PR in October. Reverts held at about 0.5%. | The revert rate undercounts defects. After each release, an agent fuzzes the build, opens a fix PR for each bug, and auto-merges it. Bugs fixed forward show up as more PRs, not as reverts. |
| Regressions | She showed regressions openly: idle CPU from 0.40% to 0.80%, and startup JS/CSS from 2 MB to 7.7 MB. | Showing these adds credibility. They also show that verifying correctness did not prevent size and resource regressions. |
| Cost | She acknowledges Cursor has effectively unlimited tokens internally, so her exact approach may not suit others. | pstack defaults reflect that budget. Code runs on Opus 5.5 at xhigh, and review panels span three model vendors. |

## Where the fine-grain detail sits

Paths are relative to `cursor/plugins/pstack/` unless stated. Checked at commit `93b916d` (2026-11-17), plugin version 0.15.43.

| Topic | Location | Public? |
|---|---|---|
| Dune lint rules, import analyzer, and folder layout | Talk slides only. A feature lives in one directory, and entry points are conventional nouns with a fixed way to create each. | No. Zero matches in the repo. |
| Control Glass and the Grok Bot feature map | A reproducible CLI in the skill directory plus a feature map maintained by automations | No. The public equivalent is `skills/create-verification-skill/SKILL.md` and `references/feature-map-example/`, which has four required H2s and real selector commands. |
| Turning corrections into checks | `skills/correct/SKILL.md`. It fixes each mistake at the highest level that works: architecture, then types and lint, then tests, then docs. Each check must be shown failing on a real past mistake. A table records what enforces each rule. | Yes. The most valuable 2.5 KB in the repo. |
| Comment policy | `agents/comment-sicko.md` (five keep exceptions, everything else deleted) and `skills/no-comments/SKILL.md` (six-step accept and reject protocol) | Yes |
| Slop removal before commit | `cursor-team-kit/skills/deslop/SKILL.md`, a separate plugin | Yes, but thin |
| Evidence standards | `create-verification-skill` section 2 "Evidence", `docs/guide/06-verify-and-ship.md`, and the seven questions in `benchmark-checklist` | Yes |
| Formal verification | `create-formal-verification-skill` and `statechart` (TLA+ to Mermaid). Statechart has a 377-file test corpus. | Yes. The most code-heavy part of the repo. |
| Merge autonomy | `playbooks/autopilot-full.md`, `shipping.md`, `babysit.md`, plus the TypeScript in `scripts/watch-pr/policy.ts` and `references/bugbot-triage.md` | Yes. The one place where the policy is actual code. |
| Eval blinding | `playbooks/eval.md`. It bans words such as "eval" and "judge" from every name and prompt the candidate sees. | Yes |
| Routing and model selection | `skills/poteto-mode/SKILL.md` (11 KB): non-negotiables, autonomy rules, model defaults | Yes |
| Unsolicited markdown | No dedicated skill. The closest material is the talk's point that agents use markdown to justify shortcuts. The README also says "i don't believe in planning." | Partly |

## Assessment

The talk and the repo sit at different layers. pstack is about 70,000 words of skills, which is the bottom layer of her own pyramid. Its lasting value is the procedures that produce checks (`/correct`, `/no-comments`, `/create-verification-skill`) and the few real scripts. Installing it gives the method, not her guardrails.

Two further caveats apply. Grok Bot is a young codebase, and an older monolith will take much longer. Her formal-methods practice is also new. In September she described formal methods as an open problem she had not used. By November the team used TLA+ and Lean.

## Implications for QSDLC

This section is analysis for QSDLC. It is not a claim from the talk.

| Tension or opportunity | QSDLC today | What her approach suggests |
|---|---|---|
| Human gates versus earned autonomy | [[Why QSDLC]] requires user confirmation at every stage boundary. | Her model removes gates only after verification earns trust. Keep the gates. Invest in [[4 - Test]] first, because that is where trust gets earned. |
| Prose conventions | [[Developer Skills]] state conventions as prose in `qsdlc-dev-*` skills. | Prose is the weakest layer. When a convention is corrected twice, convert it to a lint, type, or test in the target project, and record the rule-to-enforcer pair. |
| Verification in the Test stage | [[qsdlc-qa]] Mode 2 executes `eval.md` cases and forbids marking `pass` without a check. | Adopt the evidence standards from `create-verification-skill` section 2. Exercise the real user path, capture the action and the resulting state, and verify side effects. A per-project feature map would make Mode 2 repeatable. |
| Spec-first versus prototype-first | Plan and Design produce `Intent.md` and `spec.md` before Build. | Her README rejects planning ("the best spec is code") and settles design forks with prototypes. This conflicts directly with QSDLC's spec-first order. Consider a prototype step inside [[2 - Design]] for forks that a run can settle. |
| Unsolicited markdown | QSDLC markdown is solicited. Five documents per feature form the record. | No conflict on the documents. The risk is agents adding notes, comments, or extra markdown that justify shortcuts. Ban that outside the five documents. |

## What transfers to a three-person team

| Step | Cost | Why do it first |
|---|---|---|
| Log every correction given to an agent for two weeks, then run `/correct` | Low | Tests the core claim against a real repo before any tooling spend |
| Run `/no-comments` on one recent diff | Low | Shows quickly whether comments in the code are justifying workarounds |
| Generate one verification skill for the staff-facing app | Medium | Removes the human from the verify step, which she treats as required before parallel agents |
| Add property tests or a formal check to rent and HAP calculation code | Medium | Pure functions with HUD-defined invariants fit formal checks best, and a wrong answer there costs the most |

Install pstack in Claude Code:

```bash
# add cursor's marketplace, then install pstack. claude code prefixes the mode as /pstack:poteto-mode
/plugin marketplace add cursor/plugins
/plugin install pstack@cursor-plugins
```

## Sources

- [cursor/plugins: pstack](https://github.com/cursor/plugins/tree/main/pstack), cloned at commit 93b916d
- [cursor/plugins: cursor-team-kit](https://github.com/cursor/plugins/tree/main/cursor-team-kit)
- [All Code Is Slop (Except Mine), video](https://www.youtube.com/embed/O_zcc6Xl12g)
- [Teamday: Lauren Tan, 11,000 Agent PRs a Month, 0.5% Reverted](https://www.teamday.ai/ai/lauren-tan-spacexsi-grok-bot-11000-agent-prs-lint-rules)
- [Web Reactiva: All Code Is Slop, la pirámide de poteto](https://www.webreactiva.com/blog/all-code-is-slop-poteto)
- [Redreamality: Trust First, Then Parallel](https://redreamality.com/blog/lauren-tan-poteto-trust-before-parallel/)
- [SozAI: SpaceX AI Engineer Lauren Tan, Part 1](https://sozai.app/transcript/spacex-ai-engineer-lauren-tan-part-1/)
- [AI Engineer Guide: All Code Is Slop (Except Mine)](https://aiengineerguide.com/til/all-code-is-slop-except-mine-by-lauren-tan/)
- [Teamday: Lauren Tan profile](https://www.teamday.ai/ai/people/lauren-tan)
