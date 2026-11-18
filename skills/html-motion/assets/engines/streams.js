/* html-motion engine: streams. Things moving at different rates (speed = rate). 2D, stateful (seeded).
 * Engines.streams(canvas, { W, H, ...options })
 * Options:
 *   lanes 6          number of parallel lanes; lane i runs at a rate between speed[0] and speed[1]
 *   count 90         particles in total, spread across lanes
 *   speed [40,220]   px per second, slowest to fastest lane (live: speedScale multiplies it, set({speedScale:.3}))
 *   colors ['--hi','--alt','--ok']   token names, one per lane group
 *   dir 'x'|'y'      flow direction
 *   trail 14         trail length at 100 px/s, in px
 *   size 1           particle size multiplier (use 1.8 or more for wall displays)
 *   seed 7  bg false
 */
(function () {
  var core = Engines.core;
  Engines.streams = function (canvas, o) {
    o = o || {};
    return core.make(canvas, o, {
      pure: false,
      init: function (g, e, s) {
        var r = core.rng(o.seed || 7), n = o.count || 90, L = o.lanes || 6, sp = o.speed || [40, 220];
        s.p = [];
        for (var i = 0; i < n; i++) {
          var lane = i % L;
          s.p.push({ lane: lane, u: r(), v: core.lerp(sp[0], sp[1], L > 1 ? lane / (L - 1) : .5) * (.85 + r() * .3), z: 1 + r() * 1.6 });
        }
      },
      draw: function (g, e, s) {
        var L = o.lanes || 6, cols = o.colors || ['--hi', '--alt', '--ok'], y = o.dir === 'y', trail = o.trail || 14, sz = o.size || 1;
        var len = y ? e.H : e.W, span = y ? e.W : e.H, k = o.speedScale == null ? 1 : o.speedScale;
        var pos = function (lane) { return span * .12 + (span * .76) * (L > 1 ? lane / (L - 1) : .5); };
        g.lineWidth = 1; g.strokeStyle = e.a('--line', .7);
        for (var l = 0; l < L; l++) {
          var q = pos(l); g.beginPath();
          if (y) { g.moveTo(q, 0); g.lineTo(q, len); } else { g.moveTo(0, q); g.lineTo(len, q); }
          g.stroke();
        }
        g.globalCompositeOperation = e.glow(); g.lineCap = 'round';
        for (var i = 0; i < s.p.length; i++) {
          var p = s.p[i]; p.u = (p.u + p.v * k * e.dt / len) % 1;
          var a = p.u * len, b = pos(p.lane), tl = trail * (p.v * k / 100) + 2, col = cols[p.lane % cols.length];
          g.strokeStyle = e.a(col, .55); g.lineWidth = p.z * sz;
          g.beginPath();
          if (y) { g.moveTo(b, a - tl); g.lineTo(b, a); } else { g.moveTo(a - tl, b); g.lineTo(a, b); }
          g.stroke();
          g.fillStyle = e.rgb(col); g.beginPath(); g.arc(y ? b : a, y ? a : b, p.z * .9 * sz, 0, 6.2832); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
      }
    });
  };
})();
