# Brand binding

The creative roll never sees colour or type. Palette, type, radius and borders come from the product being worked on, through `scripts/brand_probe.mjs`. That separation is the anti-drift mechanism: a house look that changes every run is not an identity, and a defaulted purple is slop while a brand-supplied purple is correct.

## Source precedence

The first hit wins per field. Conflicts are recorded, not hidden.

| Tier | Source | What is read |
|---|---|---|
| A | Design docs | `CLAUDE.md`, `AGENTS.md`, `DESIGN.md`, `docs/**/*design*`, `docs/**/*brand*`, any `HTML Design Standard*.md`, plus extra roots and files from `~/.qsdlc/brand-sources.json` (needed when a standard lives in a vault outside the repo) |
| B | Token files | `tailwind.config.{js,ts,cjs,mjs}` (`colors`, `fontFamily`, `borderRadius`), Tailwind v4 `@theme {}` in CSS, `tokens.json` (DTCG or style-dictionary), `theme.{ts,js}`, shadcn `components.json` with its `--radius` and HSL or OKLCH triplets |
| C | CSS variables | `:root{}`, `[data-theme]`, `.dark`, `prefers-color-scheme` blocks across `**/*.css` and `<style>` blocks, ranked by usage |
| D | Brand assets | `manifest.json` `theme_color`, `<meta name="theme-color">`, `favicon*.svg`, `logo*.svg` dominant fills |
| E | Type | `@fontsource/*`, `next/font`, `font-family` frequency, local `*.woff2` files |
| F | Conventions | `border-radius` frequency, border widths, shadow use, icon family |

`brand-sources.json` shape:

```json
{ "roots": ["<abs dir with brand notes>"], "files": ["<abs file>"],
  "byProject": { "<abs project root>": { "roots": [], "files": [] } } }
```

The probe never reads `.env*`, anything named like a secret, `node_modules`, or build output, and writes nothing outside `.craft/`.

## Confidence

| Value | Meaning | Action |
|---|---|---|
| `A` | background and text and at least two more roles come from a design doc | proceed |
| `B` | background and text from token files | proceed, read conflicts |
| `C` | background and text from CSS variables | proceed, read conflicts, say so in the summary |
| `D` | partial: text or a brand or accent colour found, but not both a ground and text | exit code 3, `ask: true`. The tokens that were found are kept. A missing ground is replaced by a neutral one that suits the text (dark ground for light text), recorded in `gaps` and as a `conflicts` entry with `kind: "missing"`. Confirm with the user before building |
| `none` | nothing found | exit code 3: ask one question; the output holds the labelled unbranded fallback |

## The unbranded fallback

A neutral set, flagged everywhere: warm-neutral greys, one blue-green accent, system font stacks, 2px radius, both light and dark defined. It is not any product's brand. Artifacts built on it carry `<meta name="brand-source" content="unbranded">`, and lint warns (L16) until the user confirms or supplies a source.

## Mapping onto the engine tokens

| Engine token | Mapped from |
|---|---|
| `--bg` `--surface` `--panel` `--line` | ground, raised surface, hover or selected surface, hairline |
| `--ink` `--muted` | body text, secondary text (always a text-safe value) |
| `--hi` | the product's single brand or accent colour used for emphasis, as a text-safe value |
| `--ok` `--alt` `--risk` | product semantic colours; else derived from the brand and checked for 4.5:1 on the ground |

Radius precedence: a documented value, then the product's own `--radius` or `--radius-md` (also `--radius-base`, `--radius-default`, any `--radius-*` in CSS or a Tailwind v4 `@theme`), then the most frequent `border-radius`, then `2px`. Every `--radius-*` value joins `shape.radiusScale`, sorted. Falling back to `2px` is recorded in `gaps` and `conflicts`.

Also bound: `--radius`, `--border`, `--shadow`, `--font-display`, `--font-sans`, `--font-mono`. If the product names a token differently, keep its name and alias.

## Contrast

`contrastReport` covers every pair the artifact uses at small size (ink and muted on bg and surface, hi, ok, warn, risk, alt on bg). Status colour is always paired with a glyph or a label, never colour alone.

When a doc value fails 4.5:1 (for example a 4.15:1 caption colour), the probe lists it under `conflicts` with `kind: "contrast"` and uses a lightened variant of the same hue. The doc owner should hear about it; the artifact must not copy the failing value.

## Drift check

`lint.mjs --brand brand-bind.json` extracts every colour literal in the page and fails (L05) on any colour that is not in `boundColors`, naming the nearest bound token. L06 fails any `border-radius` outside `shape.radiusScale` and any `box-shadow` when the product is shadowless. L07 allows a purple-to-blue gradient only if `gradientAllowed` is set in the bind file (because the product's own mark uses it).

## Fonts

Use the product's stack. System stacks by default. If the product ships a `woff2`, `scripts/embed_font.mjs` base64s that local file (warns above 150 KB). It refuses remote URLs. There is no download step.
