/* html-motion engine: split. One stream divides into two branches (a decision, a triage, a fork in the work).
 * 2D, stateful (seeded). The share going to each branch is live: set({ ratio: .3 }).
 * Engines.split(canvas, { W, H, ...options })
 * Options:
 *   ratio .5       share of particles taking the upper branch (0..1, live)
 *   count 70       particles in flight
 *   speed 140      px per second (live: speedScale)
 *   colors ['--hi','--ok','--alt']   token names: trunk, upper branch, lower branch
 *   labels ['','']   short text at the end of each branch
 *   seed 9  bg false
 */
(function () {
  var core = Engines.core, SPLIT = .38;
  function pt(W, H, branch, u) { // point on the trunk (u < SPLIT) or the chosen branch
    var x0 = W * .08, xs = W * .46, y0 = H / 2;
    if (u < SPLIT) return [core.lerp(x0, xs, u / SPLIT), y0];
    var t = (u - SPLIT) / (1 - SPLIT), ye = branch === 0 ? H * .28 : H * .72, x1 = W * .62, x2 = W * .72, xe = W * .92, m = 1 - t;
    return [m * m * m * xs + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * xe, m * m * m * y0 + 3 * m * m * t * y0 + 3 * m * t * t * ye + t * t * t * ye];
  }
  Engines.split = function (canvas, o) {
    o = o || {};
    return core.make(canvas, o, {
      pure: false,
      init: function (g, e, s) {
        var r = core.rng(o.seed || 9); s.r = r; s.p = [];
        for (var i = 0; i < (o.count || 70); i++) s.p.push({ u: r(), b: r() < (o.ratio == null ? .5 : o.ratio) ? 0 : 1, v: .8 + r() * .5, z: 1.2 + r() * 1.3 });
      },
      draw: function (g, e, s) {
        var cols = o.colors || ['--hi', '--ok', '--alt'], sp = (o.speed || 140) * (o.speedScale == null ? 1 : o.speedScale), ratio = o.ratio == null ? .5 : o.ratio;
        var L = e.W * .9, i, u;
        g.lineCap = 'round'; g.lineJoin = 'round';
        [0, 1].forEach(function (b) { // channels
          g.beginPath(); for (u = 0; u <= 1.001; u += .02) { var p = pt(e.W, e.H, b, u); if (u === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
          g.strokeStyle = e.a('--line', .55); g.lineWidth = 14; g.stroke();
          g.strokeStyle = e.a('--surface', 1); g.lineWidth = 12; g.stroke();
        });
        g.globalCompositeOperation = e.glow();
        for (i = 0; i < s.p.length; i++) {
          var q = s.p[i]; q.u += sp * q.v * e.dt / L;
          if (q.u >= 1) { q.u = 0; q.b = s.r() < ratio ? 0 : 1; }
          var a = pt(e.W, e.H, q.b, q.u), col = q.u < SPLIT ? cols[0] : cols[1 + q.b], lat = (i % 5 - 2) * 1.6 * (q.u < SPLIT ? 1 : 1 - (q.u - SPLIT));
          g.fillStyle = e.a(col, .3); g.beginPath(); g.arc(a[0], a[1] + lat, q.z * 2.6, 0, 6.2832); g.fill();
          g.fillStyle = e.rgb(col); g.beginPath(); g.arc(a[0], a[1] + lat, q.z, 0, 6.2832); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
        var ls = o.labels || ['', ''];
        g.font = '12px ui-monospace,Consolas,monospace'; g.textAlign = 'right'; g.fillStyle = e.rgb('--muted');
        if (ls[0]) g.fillText(ls[0], e.W * .92, e.H * .28 - 14);
        if (ls[1]) g.fillText(ls[1], e.W * .92, e.H * .72 + 24);
      }
    });
  };
})();
