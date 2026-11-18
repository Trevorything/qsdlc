/* html-motion engine: pullback. One unit fills the frame, the camera pulls back to reveal the whole grid it belongs
 * to, then work passes between the units. 2D, stateful: the pullback is a function of time, the travelers after it
 * are a seeded simulation (drawAt(t) replays it).
 * Engines.pullback(canvas, { W, H, ...options })
 * Options:
 *   dur 5        seconds for the pullback (travelers keep running afterwards; no freeze)
 *   cols 9 rows 5   grid size (odd numbers keep the first unit centred)
 *   travelers 12 travelers passing between neighbouring units after the reveal (live)
 *   label ''     short text inside the first unit
 *   colors ['--alt','--ok']   token names for travelers
 *   seed 3
 */
(function () {
  var core = Engines.core;
  Engines.pullback = function (canvas, o) {
    o = o || {};
    return core.make(canvas, o, {
      pure: false, dur: function (op) { return op.dur || 5; },
      init: function (g, e, s) { s.r = core.rng(o.seed || 3); s.t = []; },
      draw: function (g, e, s) {
        var C = o.cols || 9, R = o.rows || 5, cs = Math.min(e.W / (C + 1), e.H / (R + 1)) * .92, gap = cs * .22, pitch = cs + gap;
        var gw = C * pitch - gap, gh = R * pitch - gap, mc = Math.floor(C / 2), mr = Math.floor(R / 2);
        var k = core.ease(e.p), z0 = (e.H * .62) / cs, z = core.lerp(z0, 1, k);
        var cx0 = mc * pitch + cs / 2, cy0 = mr * pitch + cs / 2, gcx = gw / 2, gcy = gh / 2;
        var camX = core.lerp(cx0, gcx, k), camY = core.lerp(cy0, gcy, k);
        var cols = o.colors || ['--alt', '--ok'], i, j;
        g.save(); g.translate(e.W / 2, e.H / 2); g.scale(z, z); g.translate(-camX, -camY);
        for (j = 0; j < R; j++) for (i = 0; i < C; i++) {
          var x = i * pitch, y = j * pitch, centre = i === mc && j === mr;
          var dn = Math.hypot(i - mc, j - mr) / Math.hypot(mc, mr || 1);
          var vis = centre ? 1 : core.smooth(.05 + .65 * dn, .3 + .65 * dn, k);
          if (vis <= 0) continue;
          g.globalAlpha = vis;
          g.fillStyle = e.rgb(centre ? '--panel' : '--surface'); g.fillRect(x, y, cs, cs);
          g.strokeStyle = e.rgb(centre ? '--hi' : '--line'); g.lineWidth = (centre ? 2 : 1) / z; g.strokeRect(x + .5 / z, y + .5 / z, cs - 1 / z, cs - 1 / z);
          g.fillStyle = e.a(centre ? '--hi' : '--muted', centre ? .6 : .3); // a few "content" bars inside each unit
          for (var b = 0; b < 3; b++) g.fillRect(x + cs * .14, y + cs * (.2 + b * .17), cs * (.72 - b * .17), cs * .06);
          g.globalAlpha = 1;
        }
        if (o.label && e.p < .98) {
          g.fillStyle = e.a('--ink', 1 - core.smooth(.4, .8, e.p)); g.font = '600 ' + (cs * .12) + 'px ui-sans-serif,system-ui,sans-serif';
          g.textAlign = 'center'; g.fillText(o.label, mc * pitch + cs / 2, mr * pitch + cs * .92);
        }
        var want = k > .85 ? (o.travelers == null ? 12 : o.travelers) : 0;
        while (s.t.length < want) {
          var ax = Math.floor(s.r() * C), ay = Math.floor(s.r() * R), horiz = s.r() < .6;
          var bx = core.clamp(ax + (horiz ? (s.r() < .5 ? -1 : 1) : 0), 0, C - 1), by = core.clamp(ay + (horiz ? 0 : (s.r() < .5 ? -1 : 1)), 0, R - 1);
          if (ax === bx && ay === by) continue;
          s.t.push({ ax: ax, ay: ay, bx: bx, by: by, u: 0, v: .5 + s.r() * .6, c: Math.floor(s.r() * cols.length) });
        }
        s.t.length = Math.min(s.t.length, want);
        g.globalCompositeOperation = e.glow();
        for (var q = 0; q < s.t.length; q++) {
          var t = s.t[q]; t.u += t.v * e.dt;
          if (t.u >= 1) { s.t.splice(q, 1); q--; continue; }
          var px = core.lerp(t.ax, t.bx, t.u) * pitch + cs / 2, py = core.lerp(t.ay, t.by, t.u) * pitch + cs / 2;
          g.fillStyle = e.a(cols[t.c % cols.length], .3); g.beginPath(); g.arc(px, py, cs * .09, 0, 6.2832); g.fill();
          g.fillStyle = e.rgb(cols[t.c % cols.length]); g.beginPath(); g.arc(px, py, cs * .035, 0, 6.2832); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
        g.restore();
      }
    });
  };
})();
