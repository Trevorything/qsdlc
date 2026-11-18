---
tags: [skill, artifact]
---

# html-motion

- **Stage**: used by [[qsdlc-present]] when an artifact needs canvas or GPU motion; also standalone
- **Implementation**: `/skills/html-motion/SKILL.md`, with `assets/engines/`, `scripts/`, and `references/`
- **Triggers on**: any request for an HTML page, dashboard, wall display, or hero section that moves, feels alive, or uses motion effects

## What it does

A toolkit for HTML where motion carries meaning. The rule: delete the animation in your head; if the page still says the same thing, cut it or give it a job (speed shows a rate, colour shows a state, density shows volume, convergence shows agreement).

Before choosing an effect it runs five gates on the content: one glance, outcome not activity, change test, stranger test, and one analogy from the viewer's world. Then a mapping table of fact to channel to range; a row with no fact is decoration.

**Engines.** Nine working engines in `assets/engines/`, all self-contained with no CDN:

| Engine | Shows | Cost |
|---|---|---|
| `streams` | things moving at different rates | 2D |
| `graph` | a network with travelers along its links | 2D |
| `expand` | reach growing around a fixed core | 2D |
| `pullback` | one unit, then the whole grid | 2D |
| `split` | one stream dividing into two branches | 2D |
| `transform` | a familiar object becoming a larger version of itself | 2D |
| `morph` | one passage of text becoming another | 2D |
| `shader` | a full-surface flowing field | GPU |
| `terrain` | a camera flying over a 3D landscape with data columns | GPU |

Contract: `Engines.name(canvas, { W, H, ...options })` returns `{ start, stop, redraw, drawAt }`. Engines take token names such as `'--hi'`, not colours, and read them from `:root` each frame; a page must define `--bg --surface --panel --line --ink --muted --hi --ok --alt --risk`. Inline them with `node scripts/inline_engines.mjs page.html shader streams` (or the `.py` twin); `--list` shows names. Reduced motion paints a complete final frame, and GPU engines fall back to a still gradient without WebGL.

**Surfaces.** A QSDLC artifact (one local file, engines inlined), a page section, or an always-on page such as a wall display, using `assets/ambient-skeleton.html` (cap the frame rate, stop when hidden, desaturate stale data, nothing interactive).

**Verify.** Capture early, mid, and late frames in both themes, every state the page can show, reduced motion, and no-WebGL; read the console; open the frames. Node 18 or newer (or Python 3.8) for the scripts.

## See also

[[qsdlc-present]], [[Artifacts]]
