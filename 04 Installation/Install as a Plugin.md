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

This makes every skill under `/skills/` available — `qsdlc`, all five stage skills, `qsdlc-feature-research`, and the three starter developer skills — namespaced under the `qsdlc` plugin.

## Updating

Since the marketplace source points at the GitHub repo, pulling in changes is a matter of re-running the marketplace add/update flow for `Trevorything/qsdlc` — check Claude Code's current plugin-update command, as this evolves.

## When to prefer this over individual install

Use this path when you want the full lifecycle available everywhere without thinking about it again. If you only want one or two skills in a specific project, see [[Install Individual Skills]] instead.
