# HTML capabilities

What a browser page can do for motion, by cost, and what to budget. Read this when deciding how far to go.

## Technique tiers

| Tier | Techniques | Cost | Use when |
|---|---|---|---|
| 0. Static | Semantic HTML, CSS layout, inline SVG, `<details>` | none | Always the base. The page must say everything here first. |
| 1. CSS | Transitions, `@keyframes`, `clip-path`, `mask`, `scroll-snap`, `animation-timeline`, `@property` registered tokens, variable fonts | very low | State changes, reveals, wipes, weight changes |
| 2. SVG | `stroke-dashoffset` draws, `getPointAtLength` travelers, `<animate>` avoided in favor of JS/CSS, filters kept small | low | Diagrams, connections, charts |
| 3. Web Animations API | `element.animate`, `finish()`, `commitStyles()` | low | Sequenced entrances that need to be cancelled or driven by `currentTime` |
| 4. Canvas 2D | The 2D engines (`streams`, `graph`, `expand`, `pullback`, `split`, `transform`, `morph`) | medium | Many moving elements, particles, text-to-particles |
| 5. WebGL | `shader`, `terrain` | high | One atmospheric field or landscape per page, with a still fallback |

Choose the lowest tier that shows the fact. Moving up a tier needs a reason you could say out loud.

## Performance budgets

- **One heavy animation at a time.** Two canvases running at once is the usual cause of a hot laptop.
- **Frame rate.** Interactive pages: 60 fps. Pages that run for hours (wall displays, backgrounds): `Engines.maxFps = 30`.
- **Resolution.** Device pixel ratio is capped at 2 by the engines. GPU engines accept `quality` (0.6 or less for
  always-on pages). The governor halves resolution, then freezes, if frames average slower than 20 fps.
  Set `Engines.noGovernor = true` only if your page paces `drawAt(t)` itself; `?gov=off` disables it for testing.
- **Off screen costs nothing.** Engines pause when the tab is hidden and when the canvas leaves the viewport.
- **Shadows and blur.** No large `shadowBlur`, no animated CSS `filter: blur()` on big areas, no full-screen
  `backdrop-filter` under motion.
- **Particles.** Under about 4000 per canvas. Under about 200 for always-on pages.
- **Layout thrash.** Animate `transform` and `opacity`. Do not animate `width`, `height`, `top` or `left` of
  large areas (the small `max-width` text collapse in motion-devices.md is the exception, on short text).
- **Measure frame rate** with `?fps=1`. Headless renders cannot measure real speed.

## Fallbacks

| Situation | What must still be true |
|---|---|
| `prefers-reduced-motion: reduce` | Engines paint one complete final frame and stop. CSS animation is off and `[data-reveal]` content is visible. |
| No JavaScript | All text and data are in the markup. Reveals are hidden only after `html.js` is set. |
| No WebGL, shader error, lost context | The canvas gets a still gradient from the tokens (`data-fallback="still"`). Nothing throws. |
| Offline / `file://` | Everything inline. No fetches, no CDN, no remote fonts. |
| Print | Animations off, final states shown, backgrounds painted explicitly. |
| Small screens | Canvases size to their container; rebuild on resize. Nothing depends on hover. |

## Tokens and theming

Engines read ten CSS custom properties from `:root` by name on every frame: `--bg --surface --panel --line --ink
--muted --hi --ok --alt --risk`. A page must define all ten. `<html data-deck="dark|light">` selects the theme the
engines blend for.

- To glide through a theme or state change, register the tokens with `@property` (`syntax: '<color>'`, `inherits:
  true`, an `initial-value`) and put a `transition` on `:root`. Engines read the live computed value, so the canvas
  follows with no restart. Engines that have frozen on their last frame need `redraw()` after the transition.
- **Where the values come from.** Do not invent a palette. The brand-token mapping (which of the product's variables
  feed `--hi`, `--ok`, and so on), contrast checks, and creative visual rolls belong to the `qsdlc-present` skill.
  Without it, the neutral unbranded defaults in `assets/engines/_core.js` keep an engine rendering, and a page using
  them should say it is unbranded.
- Pair status colors with a label or shape. Color alone is not a state.

## Published Artifacts

QSDLC artifacts are local self-contained files first. If the session also has the Artifact publish tool, the same
file may be published for a link; that adds rules the local file does not need: load `artifact-design` before
writing, keep the page under 16 MB (data URIs count), and put live data or Claude calls behind
`artifact-capabilities`. A published page may load scripts only from the hosts that tool allows, but the QSDLC
convention is stricter: inline everything, so the published copy and the local file are identical.

## Other browser capabilities worth knowing

- `IntersectionObserver` to start and stop work; `ResizeObserver` to rebuild canvases.
- `document.fonts.ready` before measuring text.
- `matchMedia('(prefers-color-scheme: light)')` and `(prefers-reduced-motion: reduce)`, both with change events.
- `OffscreenCanvas` and workers for heavy particle work (not needed by the shipped engines).
- `view-transition` API for page-to-page or state-to-state morphs where supported; guard with a feature check.
- `canvas.captureStream()` plus `MediaRecorder` to record a pure-function engine frame by frame.
