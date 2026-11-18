---
tags: [installation]
---

# Install as a Plugin

The repo root doubles as a Claude Code plugin (`.claude-plugin/plugin.json`) and a plugin marketplace source (`.claude-plugin/marketplace.json`), so the whole skill set can be added and installed as one unit.

## Steps

From inside Claude Code:

```
/plugin marketplace add Trevorything/qsdlc
/plugin install qsdlc@qsdlc-marketplace
```

This makes every skill under `/skills/` available, namespaced under the `qsdlc` plugin:

- the kickoff and sizing skills: [[qsdlc]], [[qsdlc-triage]]
- the stage skills: [[qsdlc-interview]], [[qsdlc-design]], [[qsdlc-feature-research]], [[qsdlc-build]], [[qsdlc-qa]], [[qsdlc-pr]]
- build and test support: [[qsdlc-review]], [[qsdlc-verify]], [[qsdlc-herdr]], and the three starter [[Developer Skills]]
- the factory skills: [[qsdlc-factory]], [[qsdlc-sweep]], [[qsdlc-ritual]], [[qsdlc-audit]], [[qsdlc-correct]], [[qsdlc-guard]]
- the presentation and companion tools: [[qsdlc-present]], [[html-motion]], [[qsdlc-archify]], [[qsdlc-graphify]]

The plugin also carries `skills/_shared/` (conventions, templates, and the deterministic scripts), so the shared paths resolve without extra steps.

## What you need on the machine

- **Node 20 or newer** for the deterministic scripts: `qsdlc-lint`, `qsdlc-log`, the [[qsdlc-guard]] hook, `sweep-state`, the `qsdlc-present` pipeline, the `qsdlc-herdr` helper, and the `qsdlc-archify` / `qsdlc-graphify` bridges. None needs `npm install`.
- **Playwright** only if you want screenshots from `qsdlc-present`'s `shoot.mjs` or browser checks from `archify`. It is optional.
- **Herdr** only for [[qsdlc-herdr]], and only inside a Herdr pane.
- **Archify & Graphify** (optional companions installed globally, never vendored):
  - `npx skills add tt-a1i/archify --skill archify -g` for [[qsdlc-archify]]
  - `pipx install graphifyy && graphify install` for [[qsdlc-graphify]] (requires Python 3.10+)
- **`gh`** for autonomous draft PRs.

The interactive lifecycle needs none of the scheduled-loop setup. To run loops, follow [[Setting up Scheduled Rituals]].

## Updating

The marketplace source points at the GitHub repo, so pulling in changes means re-running the marketplace add or update flow for `Trevorything/qsdlc`. Check Claude Code's current plugin-update command, as it evolves. After an update, run `node <SKILLS>/_shared/test/run_tests.mjs` if you use the factory scripts.

## When to prefer this over individual install

Use this path when you want the full lifecycle available everywhere without thinking about it again. If you only want one or two skills in a specific project, see [[Install Individual Skills]].
