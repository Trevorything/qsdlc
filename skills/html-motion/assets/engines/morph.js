/* html-motion engine: morph. One passage of text becomes another: shared words travel to their new place, words
 * that are lost drift off and fade, new words arrive. 2D, PURE function of time. Final frame = the "to" text.
 * Engines.morph(canvas, { W, H, ...options })
 * Options:
 *   from 'text'  to 'text'   the two passages (required)
 *   font '600 44px ui-sans-serif, system-ui, sans-serif'   canvas font shorthand (size in px sets line height)
 *   width .8     wrap width as a fraction of W
 *   align 'left' | 'center'
 *   dur 3.2      seconds (then holds .6 s and 'freeze'; loop:true repeats)
 * Text positions are measured after document.fonts.ready and re-measured when fonts arrive.
 */
(function () {
  var core = Engines.core;
  function norm(w) { return w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); }
  /* Keep a clean gap between words that share a line while they travel. items: [{x, y, m}] (m = measured width).
   * Words are grouped into line bands by y, sorted by x, and pushed right just enough that each starts at least `pad`
   * after the previous one ends. The final layout already has a full space between words, so at rest nothing moves. */
  function spread(items, pad, lh) {
    var order = items.slice().sort(function (a, b) { return a.y - b.y; }), i, j, band;
    for (i = 0; i < order.length; i = j) {
      band = [order[i]];
      for (j = i + 1; j < order.length && order[j].y - order[i].y < lh * .6; j++) band.push(order[j]);
      band.sort(function (a, b) { return a.x - b.x; });
      for (var k = 1; k < band.length; k++) { var min = band[k - 1].x + band[k - 1].m + pad; if (band[k].x < min) band[k].x = min; }
    }
    return items;
  }
  Engines.morph = function (canvas, o) {
    o = o || {};
    var S = null, eng;
    function layout(g, e, text) {
      var size = +((o.font || '').match(/(\d+(?:\.\d+)?)px/) || [0, 44])[1], lh = size * 1.28, maxW = e.W * (o.width || .8), words = [], line = 0, x = 0, sp;
      g.font = o.font || '600 44px ui-sans-serif, system-ui, sans-serif'; sp = g.measureText(' ').width;
      String(text || '').split(/\s+/).filter(Boolean).forEach(function (w) {
        var m = g.measureText(w).width;
        if (x > 0 && x + m > maxW) { line++; x = 0; }
        words.push({ w: w, n: norm(w), x: x, line: line, m: m }); x += m + sp;
      });
      words.sp = sp; words.lh = lh;
      var lines = line + 1, y0 = (e.H - lines * lh) / 2 + lh * .78, widths = [];
      words.forEach(function (q) { widths[q.line] = q.x + q.m; });
      words.forEach(function (q) {
        var off = (o.align === 'center') ? (maxW - widths[q.line]) / 2 : 0;
        q.px = (e.W - maxW) / 2 + off + q.x; q.py = y0 + q.line * lh;
      });
      return words;
    }
    function build(g, e) {
      var A = layout(g, e, o.from), B = layout(g, e, o.to), used = {};
      B.forEach(function (b) { b.src = null; for (var i = 0; i < A.length; i++) if (!used[i] && A[i].n && A[i].n === b.n) { used[i] = 1; b.src = A[i]; A[i].kept = true; break; } });
      var r = core.rng(o.seed || 4);
      A.forEach(function (a) { a.dx = (r() - .5) * 90; a.dy = -(30 + r() * 70); a.rot = (r() - .5) * .5; });
      S = { A: A, B: B, W: e.W, H: e.H, font: o.font, from: o.from, to: o.to, pad: Math.max(B.sp, A.sp) * .9, lh: B.lh };
    }
    eng = core.make(canvas, o, {
      pure: true, dur: function (op) { return op.dur || 3.2; },
      draw: function (g, e) {
        if (!S || S.W !== e.W || S.H !== e.H || S.from !== o.from || S.to !== o.to || S.font !== o.font) build(g, e);
        g.font = o.font || '600 44px ui-sans-serif, system-ui, sans-serif'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        // order of events: lost words leave (0 to .45), shared words travel (.3 to .85), new words arrive only once travel is nearly done (.75 to 1)
        var p = e.p, out = core.smooth(0, .45, p), mv = core.ease(core.smooth(.3, .85, p)), inn = core.smooth(.75, 1, p), fin = core.smooth(.9, 1, p);
        S.A.forEach(function (a) {
          if (a.kept) return;
          g.save(); g.globalAlpha = 1 - out; g.translate(a.px + a.dx * out, a.py + a.dy * out); g.rotate(a.rot * out);
          g.fillStyle = e.mix('--ink', '--muted', out); g.fillText(a.w, 0, 0); g.restore();
        });
        var cur = S.B.map(function (b) {
          var x = b.px, y = b.py, a = 1;
          if (b.src) { x = core.lerp(b.src.px, b.px, mv); y = core.lerp(b.src.py, b.py, mv); }
          else { a = inn; y += (1 - inn) * 14; }
          return { b: b, x: x, y: y, m: b.m, a: a };
        });
        spread(cur.filter(function (c) { return c.a > .02; }), S.pad, S.lh);
        cur.forEach(function (c) {
          g.globalAlpha = c.a; g.fillStyle = c.b.src ? e.rgb('--ink') : e.mix('--hi', '--ink', fin); g.fillText(c.b.w, c.x, c.y);
        });
        g.globalAlpha = 1;
      }
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { S = null; eng.redraw(); });
    return eng;
  };
  Engines.morph.spread = spread; // pure helper, exposed so tests can check word spacing without a canvas
})();
