/* html-motion engine: transform. A familiar object becomes a larger version of itself, built from copies of itself
 * (a sheet of paper whose every line turns out to be a sheet). Showpiece. 2D, PURE function of time.
 * Engines.transform(canvas, { W, H, ...options })
 * Options:
 *   dur 5        seconds for the transformation (then holds .6 s and 'freeze'; loop:true repeats)
 *   rows 4       lines on the sheet; the large sheet is a rows x cols grid of small sheets
 *   cols 3
 *   scale 3.2    how much larger the final sheet is than the first (capped so it always fits the frame)
 *   label ''     short caption under the sheet (fades in at the end)
 *   color '--hi' token for the accent line
 */
(function () {
  var core = Engines.core;
  Engines.transform = function (canvas, o) {
    o = o || {};
    function sheet(g, e, x, y, w, h, rows, k, accent) { // k = 0 plain rule lines .. 1 fully drawn
      g.fillStyle = e.rgb('--panel'); g.fillRect(x, y, w, h);
      g.strokeStyle = e.rgb(accent ? o.color || '--hi' : '--line'); g.lineWidth = accent ? 2 : 1; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
      g.fillStyle = e.a(accent ? o.color || '--hi' : '--muted', .75); g.fillRect(x + w * .1, y + h * .09, w * .42, h * .05); // title bar
      for (var i = 0; i < rows; i++) { g.fillStyle = e.a('--muted', .35 * k + .1); g.fillRect(x + w * .1, y + h * (.24 + i * (.62 / rows)), w * (.8 - (i % 3) * .14), h * .035); }
    }
    return core.make(canvas, o, {
      pure: true, dur: function (op) { return op.dur || 5; },
      draw: function (g, e) {
        var R = o.rows || 4, C = o.cols || 3, S = o.scale || 3.2, k = core.ease(e.p);
        var h0 = e.H * .26, w0 = h0 * .78; S = Math.min(S, e.H * .84 / h0); var sc = core.lerp(1, S, k), w = w0 * sc, h = h0 * sc;
        var x = (e.W - w) / 2, y = (e.H - h) / 2 - (o.label ? 8 : 0);
        var inner = core.smooth(.25, .75, e.p);  // small sheets materialise inside the big one
        sheet(g, e, x, y, w, h, R, 1 - inner, true);
        if (inner > 0) {
          g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.globalAlpha = inner;
          var pad = w * .08, gx = w * .05, gy = h * .035, cw = (w - pad * 2 - gx * (C - 1)) / C, ch = (h - pad * 2 - gy * (R - 1)) / R;
          g.fillStyle = e.rgb('--bg'); g.fillRect(x + w * .02, y + h * .02, w * .96, h * .96);
          for (var j = 0; j < R; j++) for (var i = 0; i < C; i++) sheet(g, e, x + pad + i * (cw + gx), y + pad + j * (ch + gy), cw, ch, R, inner, false);
          g.restore();
          g.strokeStyle = e.rgb(o.color || '--hi'); g.lineWidth = 2; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
        }
        if (o.label) { g.fillStyle = e.a('--muted', core.smooth(.8, 1, e.p)); g.font = '13px ui-monospace,Consolas,monospace'; g.textAlign = 'center'; g.fillText(o.label, e.W / 2, y + h + 22); }
      }
    });
  };
})();
