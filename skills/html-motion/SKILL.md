---
name: html-motion
description: Build HTML where motion carries meaning, using a library of working animation engines (particle streams, networks with travelers, expanding fields, pullback grids, forks, morphing text, GPU shader fields, 3D terrain flyovers) and the full range of browser motion techniques (CSS, SVG, Canvas 2D, WebGL, Web Animations, variable fonts, masks). Use whenever the user wants a page, artifact, dashboard, status display, desktop wallpaper or web-view background, kiosk or wall screen, hero section, animated explainer, or any HTML to move, feel alive, animate, or "use motion effects", even if they only say "make it animated", "living background", or "add some motion". For QSDLC stage artifacts, brand binding, and everyday charts and diagrams, start from qsdlc-present; it calls this skill when canvas or WebGL motion is worth its cost.
---

# HTML Motion

A toolkit for HTML that moves on purpose: working canvas and WebGL engines, a map of browser motion techniques, and the build rules that keep moving pages honest. It works for any surface: a QSDLC artifact, a page section, an always-on wall display or desktop background.

Everything here is self-contained: no CDN, no network at view time, no npm install. Scripts run with `node` (18 or newer) or `python` (3.8 or newer).

## The one rule

Motion earns its place by showing something. Delete the animation in your head. If the page still says the same thing, cut the animation or give it a job: speed shows a rate, color shows a state, density shows volume, convergence shows agreement, a line drawing itself shows a connection.

## 1. Decide what the motion says

Before choosing an effect, run these gates on the content:

- **One glance.** The single most important thing reads in one look, from across the room or in peripheral vision. Lead with it; everything else is secondary.
- **Outcome, not activity.** Show what is true now (healthy, behind, blocked, growing), not a log of what happened.
- **Change test.** Every moving element changes what the viewer knows or does. If nothing would change when it stops, cut it.
- **Stranger test.** Someone who never saw the build understands what each color and motion means, from the motion itself or a short legend.
- **One analogy from the viewer's world.** Draw the image from things the audience already knows (their documents, their map, their tools), not generic tech imagery.

Then write the mapping, one row per thing that can change:

| Fact or state | Channel (speed, color, density, position, shape, text) | Range |
|---|---|---|

If a row has no fact, it is decoration. Keep at most one decorative layer, and keep it calm.

## 2. Pitch, then build

When the direction is open, pitch two or three visual ideas in one or two sentences each: the image, how it moves, why it fits. Say which you would bet on. Make at least one reach past the obvious (a shader field, a document that edits itself, type whose weight argues the point) and name its risk. When the user hands over the direction or says to run autonomously, pick one, state it in a line, and build.

For QSDLC artifacts the creative roll (layout archetype, motion device, signature moment) is dealt by `qsdlc-present` so the choice is not made by taste; use this skill to build the motion it picks.

Vocabulary for the pitch and the build:
- `references/motion-devices.md`: moves grouped by what each shows, with recipes (inline text collapse, fly a phrase, dissolve text to particles, damped spring, measured threads). Read "slide" as "scene" or "state".
- `references/html-capabilities.md`: what browsers can do by cost tier, performance budgets, fallbacks, and published-Artifact rules.
- `assets/engine-gallery.html`: nine engines running, dark and light. Offer it when the user wants to see the options (`?engine=shader` shows one large; `?deck=light`; `?t=3` freezes a frame).

## 3. Engines

Working code in `assets/engines/`. Read the header comment of an engine before using it: it lists every option. `assets/engines/index.json` is the machine-readable table (name, file, what it shows, cost, pure or stateful, options, byte size).

| Engine | Shows | Cost | Pure function of time |
|---|---|---|---|
| `streams` | Things moving at different rates | 2D | no |
| `graph` | A network with travelers along its links | 2D | no |
| `expand` | Reach growing around a fixed core | 2D | yes |
| `pullback` | One unit, then the whole grid, then work passing between | 2D | no |
| `split` | One stream dividing into two branches | 2D | no |
| `transform` | A familiar object becoming a larger version of itself (showpiece) | 2D | yes |
| `morph` | One passage of text becoming another, with lost words drifting off | 2D | yes |
| `shader` | A full-surface flowing field or contour map | GPU | yes |
| `terrain` | A camera flying over a 3D landscape, with data columns and pinned labels | GPU | yes |

"Pure function of time" engines can be rendered frame by frame (`drawAt(t)`), so they suit recordings and anything that must look identical on every load. Stateful engines run a seeded simulation, so `drawAt(t)` replays it from zero and still returns the same frame.

- **Inline**: `node scripts/inline_engines.mjs page.html shader streams` (or `python scripts/inline_engines.py page.html shader streams`) copies the core plus the named engines into the page as one `<script>` between `<!-- html-motion:start -->` and `<!-- html-motion:end -->`. The first run inserts it before the page's last script; rerun with a new list to replace the block. `--list` shows names. An unknown engine name exits non-zero.
- **Contract**: `const e = Engines.name(canvas, { W, H, ...options })` returns `{ start, stop, redraw, drawAt }` (plus `set`, `resize`, `destroy`). `W` and `H` are the drawing space in CSS pixels: 1600 by 900 for a scaled stage, the element's size for an inline canvas, `innerWidth`/`innerHeight` for a full-viewport canvas (rebuild on resize). Pass `css: false` when your stylesheet sizes the canvas; otherwise the engine sets it to W by H.
- **Colors**: engines take token names (`'--hi'`), not colors, and read them from `:root` on every frame. A page must define all ten: `--bg --surface --panel --line --ink --muted --hi --ok --alt --risk`. If one is missing the engine falls back to a neutral unbranded default so it still renders, but the colors will not be yours. `<html data-deck="dark|light">` selects the theme engines blend for. Which of a product's own variables feed these ten, and the contrast checks on them, come from the brand binding in `qsdlc-present`; do not invent a palette here. Register a token with `@property` and give `:root` a `transition` on it, and a state change glides through the canvas with no engine restart (an engine that already froze needs `redraw()`).
- **Built in**: reduced motion paints a complete final frame; GPU engines fall back to a still gradient without WebGL and govern themselves on a slow machine (halve resolution, then freeze); `?fps=1` shows a frame-rate readout; `?gov=off` disables the governor for testing; `Engines.maxFps = 30` caps the frame rate for pages that run for hours. A page that paces a GPU engine itself (calling `drawAt(t)` on its own timer, e.g. a slow field at 8 fps) sets `Engines.noGovernor = true` so the governor doesn't read the low rate as a slow machine.
- **New engine**: when the idea needs a move the library lacks, write it to the same contract with `Engines.core.make(canvas, opts, spec)`: read tokens at draw time from the env (`e.rgb('--hi')`, `e.a('--line', .5)`), cap device pixel ratio at 2 (the core does), paint a full final frame under reduced motion (the core does), return `'freeze'` from draw to end itself. Add the entry to `assets/engines/index.json` and run `node scripts/inline_engines.mjs --update-index`.

## 4. Surfaces

| Surface | Start from | Notes |
|---|---|---|
| QSDLC stage artifact (local file) | the artifact's own page, built with `qsdlc-present` | One HTML file in `.qsdlc/<slug>/artifacts/`. Inline the engines with `inline_engines`; no external script, stylesheet, font or fetch; it must open from `file://`. Prefer SVG and CSS motion from the `qsdlc-present` kit for everyday charts and diagrams; reach for an engine only when a canvas or GPU move shows a fact the kit cannot. |
| Page section or dashboard | the existing page | Size W/H to the element. Stop the engine when the section scrolls out of view (the core already does this with `IntersectionObserver`). |
| Always-on page: wall display, kiosk, desktop background (web-view wallpaper) | `assets/ambient-skeleton.html` | See the rules below. |

Published Artifact: if the session also has the `Artifact` publish tool, the local file may additionally be published for a link; the local file stays the source of truth and is written first. Load `artifact-design` before writing the published page, keep it under 16 MB, route live data or Claude calls through `artifact-capabilities`, and keep the QSDLC rule of inlining every script so the published copy matches the local one.

Always-on rules (the skeleton implements each):
- Budget for hours, not minutes: `Engines.maxFps = 30`, GPU engines at `quality` .6 or less, one heavy engine, no large `shadowBlur`.
- Stop engines when the page is hidden; rebuild them on resize, since the page may move between displays.
- Live data comes from a local server; `fetch()` from a `file://` page is blocked. Poll on an interval, and change state through tokens, text, and engine options, never by reloading. This is the **one** place a network call is allowed: the skeleton ships with `ENDPOINT = null` and polls only a loopback address (`localhost`, `127.x`, `[::1]`). A QSDLC stage artifact never does this: it has zero network and opens from `file://`.
- Lint the two kinds differently. Stage artifacts: `node ../qsdlc-present/scripts/lint.mjs <file>` (any `fetch` is an error). Always-on pages: add `--ambient`, which allows `fetch` only when every URL in the scripts is a loopback address and requires a `<main>` landmark. `assets/ambient-skeleton.html` passes `lint.mjs --ambient` with 0 errors.
- Stale data must look stale: desaturate the motion and say when the last update arrived. A frozen healthy color is a lie.
- Keep text few, large, and low contrast, clear of the menu bar, the taskbar or Dock, and desktop icons. Nothing interactive (`pointer-events: none`).
- Follow the system light or dark appearance.
- Preview every state from the query string (`?level=warn`, `&stale=1`) so it can be checked without a server.

## 5. Build rules that apply everywhere

- The visual establishes first and text arrives after it. Stagger entrances 0.15 to 0.4 seconds apart. Calm motion: no fast spin, no flashes.
- Run one heavy animation at a time. Stop engines that are off screen.
- Never put readable text over other text, including a faded ghost layer, unless that layer is masked out behind the text.
- Never position with `transform` an element that also has an entrance animation. Use `left` and `top`.
- An animated or transformed wrapper creates a stacking context. Give it an explicit `z-index` when positioned siblings sit near it.
- A mask clips everything outside its box, including descenders. Give masked text bottom padding, and keep glows and gradients inside their container.
- Measure text positions only after `document.fonts.ready`.
- Read colors at draw time and implement `redraw()`, so theme changes repaint.
- Embed a font only from a local file: `python scripts/embed_fonts.py page.html --file Brand.woff2 --family "Brand" --weight 400` (a range such as `--weight "100 900"` for a variable font, needed to animate weight). It refuses URLs and warns above 150 KB. Give every font a fallback stack and check its numerals at display size. System stacks need no embedding.
- Label invented examples and illustrative data as illustrative. Verify any number, date, or name the motion asserts against the source.

## 6. Verify with your eyes

A page that moves hides bugs in states nobody looks at. Before reporting done:
- Capture frames early, mid, and late in the animation, at the real screen size, in both themes. If the page can freeze a frame from the query string (the gallery does: `?t=0.5&deck=light`), use that; otherwise wait different times. With Playwright installed (`npm i -D playwright` once, then `npx playwright install chromium`), this works on Windows, macOS and Linux:
  `npx playwright screenshot --viewport-size "1440,900" --wait-for-timeout 4000 --color-scheme light "file:///C:/path/to/page.html?deck=light" frame.png`
  Repeat with other wait times and `--color-scheme dark`. The `qsdlc-present` shoot script does this plus mobile size, reduced motion, no-JS and offline runs.
- Capture every state the page can show: each level, stale, empty, error.
- Read the console for errors and warnings; there should be none.
- Check reduced motion: in a Playwright script use `browser.newContext({ reducedMotion: 'reduce' })`; by hand, turn off Animation effects (Windows: Settings, Accessibility, Visual effects; macOS: Accessibility, Display, Reduce motion). The page must show a complete still.
- Check without WebGL (launch Chromium with `--disable-gpu --disable-3d-apis`): GPU engines must show their still gradient and the console must stay clean.
- For an always-on page, watch CPU in Task Manager or Activity Monitor for a few minutes. Headless renders cannot measure speed; `?fps=1` on the real machine can.
- Open the frames and look at them. Never describe a render you have not seen in a screenshot.

## Files

| File | Use |
|---|---|
| `assets/engines/_core.js` | Shared runtime (tokens, loop, governor, reduced motion); always included |
| `assets/engines/streams.js` | Engine: things moving at different rates |
| `assets/engines/graph.js` | Engine: network with travelers |
| `assets/engines/expand.js` | Engine: reach growing around a core |
| `assets/engines/pullback.js` | Engine: one unit, then the whole grid |
| `assets/engines/split.js` | Engine: one stream into two branches |
| `assets/engines/transform.js` | Engine: object becoming a larger version of itself |
| `assets/engines/morph.js` | Engine: text becoming other text |
| `assets/engines/shader.js` | Engine: WebGL flowing field |
| `assets/engines/terrain.js` | Engine: WebGL terrain flyover |
| `assets/engines/index.json` | Engine table: names, files, options, sizes |
| `assets/engine-gallery.html` | Live demo of all nine engines (theme toggle, `?engine=`) |
| `assets/ambient-skeleton.html` | Starting file for an always-on page |
| `scripts/inline_engines.mjs` | Inline chosen engines into a page (Node); `--list`, `--update-index` |
| `scripts/inline_engines.py` | Same as the Node script, for `python` |
| `scripts/embed_fonts.py` | Embed a local font file as base64 `@font-face` |
| `references/motion-devices.md` | Moves, what each shows, recipes |
| `references/html-capabilities.md` | Technique tiers, performance, fallbacks, tokens, published Artifacts |
