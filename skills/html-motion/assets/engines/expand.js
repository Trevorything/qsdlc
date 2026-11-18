/* html-motion engine: expand. Reach growing around a fixed core (a front sweeps outward and lights up the points
 * it passes). 2D, PURE function of time: drawAt(t) is exact, so it suits recordings and identical-every-load pages.
 * Engines.expand(canvas, { W, H, ...options })
 * Options:
 *   dur 4        seconds to reach full extent (then holds .6 s and 'freeze'; loop:true repeats)
 *   rings 4      concentric tiers
 *   points 160   points that light up as the front passes (seeded scatter)
 *   maxR .46     final radius as a fraction of min(W,H)
 *   cx, cy       centre in drawing space (default middle)
 *   label ''     optional short text under the core
 *   colors ['--hi','--alt','--ok']   token names by tier
 *   seed 5
 */
(function () {
  var core = Engines.core;
  Engines.expand = function (canvas, o) {
    o = o || {};
    return core.make(canvas, o, {
      pure: true, dur: function (op) { return op.dur || 4; },
      init: function (g, e, s) {
        var r = core.rng(o.seed || 5), n = o.points || 160; s.p = [];
        for (var i = 0; i < n; i++) s.p.push({ a: r() * 6.2832, d: Math.sqrt(.04 + r() * .96), z: .8 + r() * 1.8 });
      },
      draw: function (g, e, s) {
        var cx = o.cx == null ? e.W / 2 : o.cx, cy = o.cy == null ? e.H / 2 : o.cy, R = (o.maxR || .46) * Math.min(e.W, e.H);
        var cols = o.colors || ['--hi', '--alt', '--ok'], rings = o.rings || 4, k = core.ease(e.p), front = k * R, i;
        g.globalCompositeOperation = e.glow();
        g.lineWidth = 1;
        for (i = 1; i <= rings; i++) { // guide rings; each brightens once the front has passed it
          var rr = R * i / rings, on = core.smooth(rr - R / rings, rr, front);
          g.setLineDash([2, 6]); g.strokeStyle = e.a(on > 0 ? cols[(i - 1) % cols.length] : '--line', .25 + .55 * on);
          g.beginPath(); g.arc(cx, cy, rr, 0, 6.2832); g.stroke();
        }
        g.setLineDash([]);
        g.strokeStyle = e.a('--hi', .7 * (1 - k) + .2); g.lineWidth = 2;
        g.beginPath(); g.arc(cx, cy, Math.max(front, 2), 0, 6.2832); g.stroke();
        for (i = 0; i < s.p.length; i++) {
          var p = s.p[i], d = p.d * R, lit = core.smooth(d - 18, d + 4, front);
          if (lit <= 0) continue;
          var tier = Math.min(rings - 1, Math.floor(p.d * rings));
          g.fillStyle = e.a(cols[tier % cols.length], .25 + .75 * lit);
          g.beginPath(); g.arc(cx + Math.cos(p.a) * d, cy + Math.sin(p.a) * d, p.z * (.6 + .4 * lit), 0, 6.2832); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = e.rgb('--panel'); g.strokeStyle = e.rgb('--hi'); g.lineWidth = 2;
        g.beginPath(); g.arc(cx, cy, 9, 0, 6.2832); g.fill(); g.stroke();
        if (o.label) { g.fillStyle = e.rgb('--muted'); g.font = '12px ui-monospace,Consolas,monospace'; g.textAlign = 'center'; g.fillText(o.label, cx, cy + 28); }
      }
    });
  };
})();
