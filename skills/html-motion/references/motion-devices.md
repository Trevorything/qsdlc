# Motion devices

A device is a move that shows one kind of fact. Pick the fact first (SKILL.md section 1), then the device. Every
device below has a **final state** that is complete without motion: that state is what reduced-motion users, screenshots
and print see. Write it first, then animate toward it.

"Scene" means one state of the page: a section, a panel, a step of a walkthrough.

## Moves grouped by what they show

| What it shows | Device | Typical build | Final state when still |
|---|---|---|---|
| A rate | Things moving at different speeds | `streams` engine, or CSS `translate` loops at different durations | Particles frozen mid-lane, lanes still labelled |
| Volume or density | More or fewer elements | Particle count, bar stagger, dot grid fill | The full count |
| Agreement or convergence | Paths bending to one point | SVG `stroke-dashoffset` draws, `graph` engine | All paths drawn |
| A connection | A line drawing itself | `stroke-dashoffset` from length to 0 | Line fully drawn |
| Hand-off between parts | A traveler along a link | `graph` travelers, `offset-path` dot, or an SVG dot on `getPointAtLength` | Arrowheads on the links |
| Reach or growth | A front expanding from a core | `expand` engine, scaling rings | Rings at full radius |
| Zoom out to context | One unit, then the whole system | `pullback` engine, camera scale on an SVG group | The whole grid |
| A decision or fork | One stream becoming two | `split` engine with a live `ratio` | Both branches drawn with their share |
| A statement changing | Text becoming other text | `morph` engine, or the recipes below | The new text |
| A familiar thing is bigger than it looks | Object built from copies of itself | `transform` engine | The large version |
| Atmosphere (decorative, one at most) | A slow field or landscape | `shader`, `terrain` | Still gradient or one painted frame |
| Before and after | A wipe or a toggle | `clip-path` inset reveal, or two states side by side | Both states visible side by side |
| Sequence or dependency order | Staggered reveal | 0.15 to 0.4 s between items, visual first, text after | Everything visible |
| A live or working state | One slow pulse | Opacity 1 to .6 on a single marker, 2 to 3 s | Static marker |
| A number arriving | Count to the final value | Tween text with `tabular-nums`; the final value is in the markup | The final value |
| Progress through a story | Scroll-linked progress | `animation-timeline: view()` with an IntersectionObserver fallback | Everything shown |

Banned: marquees, parallax for its own sake, spin, flash, bounce, count-ups on non-numeric data, loops longer than
8 s with no pause control (except always-on ambient pages, which follow the always-on rules in SKILL.md).

## Recipes

### Inline text collapse (a long phrase folds to its core)
Wrap the removable words in `<span class="drop">`. Animate `max-width` from the measured width to 0 and `opacity` to 0
over 600 ms, staggered right to left, so the sentence closes up and the remaining words slide together. Measure widths
after `document.fonts.ready`; set `white-space: nowrap; overflow: hidden` on `.drop` so descenders are not clipped
(give it `padding-bottom: .15em`). Still state: the short sentence.

### Fly a phrase to a place
Position the phrase with `left` and `top` (not `transform`, so the entrance animation can use `transform`). Compute the
target from `getBoundingClientRect()` of the destination element, then animate with the Web Animations API:
`el.animate([{translate:'0 0'},{translate:`${dx}px ${dy}px`}], {duration:700, easing:'cubic-bezier(.2,.8,.2,1)', fill:'forwards'})`.
Keep one flying phrase at a time. Still state: the phrase already at the destination.

### Dissolve text to particles
Draw the text to an offscreen canvas, sample its pixels on a grid (every 3 to 4 px where alpha > 128), and turn each
sample into a particle with a home position. Run particles from the text outward (random velocity, damped) and fade.
Reverse it to assemble text from particles. Keep the particle count under about 4000. Still state: the text, drawn
normally. The `morph` engine is the lighter way to change between two passages.

### Damped spring
For anything that should settle rather than ease: `v += (target - x) * k * dt; v *= Math.pow(d, dt * 60); x += v * dt;`
with `k` about 90 and `d` about 0.82 for a calm settle. Cap `dt` at 0.05 so a stalled frame cannot explode the spring.
Use it for pointer-free elements only (a marker finding its value), not for text that must stay readable while moving.

### Measured threads (lines that connect real positions)
Measure the two elements with `getBoundingClientRect()` after layout and fonts, convert to the SVG's coordinate
space, build a cubic path whose control points sit horizontally off each end, and draw it with `stroke-dashoffset`.
Recompute on resize. A thread must connect things that are actually related; if you cannot say what the line means,
cut it.

### Staggered entrance that is safe without JavaScript
Mark items `data-reveal` and set a CSS custom property `--i` per item. Hide them only after JavaScript has added a
class to `<html>` (so no-JS readers see everything). Inside `@media (prefers-reduced-motion: reduce)` make every
`[data-reveal]` visible with no transition.

### Scrubbing a drawing with scroll
Prefer CSS `animation-timeline: view()` where supported; otherwise an IntersectionObserver with thresholds 0 to 1 in
steps of .05 that sets a `--p` custom property, and CSS or `drawAt` reads it. Never listen to raw `scroll` events to
animate layout.

## Choosing a device quickly

1. Write the fact: "approvals are three times faster this quarter".
2. Pick the channel the eye reads without effort: speed for a rate, length for a magnitude, position for a ranking,
   color for a state.
3. Pick the smallest device that uses that channel. A bar growing beats a particle field for a magnitude.
4. Write the still state. If the still state alone says it, the motion is polish; keep it only if it adds reach.
