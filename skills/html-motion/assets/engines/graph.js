/* html-motion engine: graph. A network with travelers along its links (a traveler = one unit of work or data
 * moving between nodes; a node pulses when one arrives). 2D, stateful (seeded).
 * Engines.graph(canvas, { W, H, ...options })
 * Options:
 *   nodes 14 | [{x,y,r?,c?}]   count (auto-laid out, deterministic) or explicit nodes in drawing space (c = token)
 *   links 1.5 | [[a,b],...]    average links per node, or explicit index pairs
 *   travelers 18               travelers in flight (live)
 *   speed 90                   px per second (live: speedScale)
 *   hubs 2                     the first N auto nodes are drawn larger
 *   colors ['--hi','--alt','--ok']   token names for travelers
 *   seed 11  bg false
 */
(function () {
  var core = Engines.core;
  Engines.graph = function (canvas, o) {
    o = o || {};
    return core.make(canvas, o, {
      pure: false,
      init: function (g, e, s) {
        var r = core.rng(o.seed || 11), W = e.W, H = e.H, N, i, j;
        if (Array.isArray(o.nodes)) {
          s.n = o.nodes.map(function (n) { return { x: n.x, y: n.y, r: n.r || 5, c: n.c, pulse: 0 }; });
        } else {
          N = o.nodes || 14; s.n = [];
          var hubs = o.hubs == null ? 2 : o.hubs;
          for (i = 0; i < N; i++) s.n.push({ x: W * (.1 + .8 * r()), y: H * (.12 + .76 * r()), r: i < hubs ? 8 : 4.5, pulse: 0 });
          for (var it = 0; it < 60; it++) // relax: push overlapping nodes apart
            for (i = 0; i < N; i++) for (j = i + 1; j < N; j++) {
              var dx = s.n[j].x - s.n[i].x, dy = s.n[j].y - s.n[i].y, d = Math.hypot(dx, dy) || 1, m = Math.min(W, H) * .2;
              if (d < m) { var f = (m - d) / d * .25; s.n[i].x -= dx * f; s.n[i].y -= dy * f; s.n[j].x += dx * f; s.n[j].y += dy * f; }
              s.n[i].x = core.clamp(s.n[i].x, W * .06, W * .94); s.n[i].y = core.clamp(s.n[i].y, H * .08, H * .92);
            }
        }
        N = s.n.length; s.l = [];
        if (Array.isArray(o.links)) {
          s.l = o.links.map(function (p) { return [p[0], p[1]]; });
        } else { // each node links to its nearest neighbours, up to the requested density
          var want = Math.round(N * (o.links || 1.5)), seen = {};
          for (var k = 0; k < 3 && s.l.length < want; k++) for (i = 0; i < N && s.l.length < want; i++) {
            var ds = s.n.map(function (n, q) { return [q, Math.hypot(n.x - s.n[i].x, n.y - s.n[i].y)]; })
              .filter(function (z) { return z[0] !== i; }).sort(function (a, b) { return a[1] - b[1]; });
            if (!ds[k]) continue;
            var q = ds[k][0], key = Math.min(i, q) + '-' + Math.max(i, q);
            if (!seen[key]) { seen[key] = 1; s.l.push([i, q]); }
          }
        }
        s.t = []; s.r = r;
      },
      draw: function (g, e, s) {
        var cols = o.colors || ['--hi', '--alt', '--ok'], want = o.travelers == null ? 18 : o.travelers;
        var sp = (o.speed || 90) * (o.speedScale == null ? 1 : o.speedScale);
        g.lineWidth = 1; g.strokeStyle = e.a('--line', .9);
        s.l.forEach(function (l) { var a = s.n[l[0]], b = s.n[l[1]]; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); });
        while (s.t.length < want && s.l.length) {
          s.t.push({ l: Math.floor(s.r() * s.l.length), u: 0, fw: s.r() < .5, c: Math.floor(s.r() * cols.length), v: .8 + s.r() * .5 });
        }
        s.t.length = Math.min(s.t.length, want);
        g.globalCompositeOperation = e.glow();
        for (var i = 0; i < s.t.length; i++) {
          var t = s.t[i], l = s.l[t.l], from = t.fw ? l[0] : l[1], to = t.fw ? l[1] : l[0];
          var a = s.n[from], b = s.n[to], d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          t.u += sp * t.v * e.dt / d;
          if (t.u >= 1) { // arrived: pulse the node, continue along a random link from it
            b.pulse = 1;
            var nl = [];
            for (var q = 0; q < s.l.length; q++) if (s.l[q][0] === to || s.l[q][1] === to) nl.push(q);
            t.l = nl[Math.floor(s.r() * nl.length)]; t.fw = s.l[t.l][0] === to; t.u = 0;
            t.c = Math.floor(s.r() * cols.length);
            continue;
          }
          var x = a.x + (b.x - a.x) * t.u, y = a.y + (b.y - a.y) * t.u, col = cols[t.c % cols.length];
          g.fillStyle = e.a(col, .25); g.beginPath(); g.arc(x, y, 6, 0, 6.2832); g.fill();
          g.fillStyle = e.rgb(col); g.beginPath(); g.arc(x, y, 2.2, 0, 6.2832); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
        s.n.forEach(function (n) {
          n.pulse = Math.max(0, n.pulse - e.dt * 2.2);
          g.fillStyle = e.rgb('--panel'); g.strokeStyle = e.mix('--line', n.c || '--hi', .35 + n.pulse * .65); g.lineWidth = 1.5;
          g.beginPath(); g.arc(n.x, n.y, n.r + n.pulse * 3, 0, 6.2832); g.fill(); g.stroke();
        });
      }
    });
  };
})();
