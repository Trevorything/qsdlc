/* html-motion engine: terrain. A camera gliding over a 3D landscape (WebGL) with contour lines, data columns and
 * pinned labels. GPU, PURE function of time (the camera path is a function of t). Columns are the data: height =
 * value. Labels are small DOM elements pinned to the column tops (the canvas's parent becomes position:relative if
 * it was static) and are removed by destroy().
 * Without WebGL, on a shader error or a lost context the canvas gets a still gradient (data-fallback="still");
 * labels are then not drawn. The governor halves resolution, then freezes, on a slow machine.
 * Engines.terrain(canvas, { W, H, ...options })
 * Options:
 *   columns [{x,z,h,label?,c?}]   x,z in -1.4..1.4 ground coordinates, h = height 0..1 (live), c = token (default '--alt').
 *                                 Default: five seeded columns, unlabelled.
 *   amp 1.8        terrain relief
 *   lines 14       contour levels
 *   speed 1        camera speed (live)
 *   fog 4          fog distance
 *   quality 1      resolution multiplier (use .6 or less for always-on pages)
 *   still 6        the time (s) painted under reduced motion
 *   seed 2         for the default columns
 * Colours: --bg --surface --line --hi --alt (read every frame); label text uses --ink on --surface via CSS variables.
 */
(function () {
  var core = Engines.core;
  var HF = 'float th(vec2 p){return(.16*sin(p.x*2.1+.7)*cos(p.y*1.7)+.09*sin(p.x*4.3-p.y*3.1+1.2)+.045*cos(p.x*8.1+p.y*7.3))*amp;}';
  var VS1 = 'attribute vec2 a;uniform mat4 m;uniform float amp;varying float vh,vd;' + HF +
    'void main(){float h=th(a);vh=h;vec4 c=m*vec4(a.x,h,a.y,1.);vd=c.w;gl_Position=c;}';
  var FS1 = 'precision mediump float;varying float vh,vd;uniform vec3 cb,cs,cl,ch;uniform float lv,fg;' +
    'void main(){float k=clamp(vh*.5+.5,0.,1.);vec3 c=mix(cs,cl,k*.9);float l=smoothstep(.42,.5,abs(fract(vh*lv)-.5));' +
    'c=mix(c,ch,l*.8);c=mix(c,cb,clamp((vd-1.2)/fg,0.,1.));gl_FragColor=vec4(c,1.);}';
  var VS2 = 'attribute vec3 a;attribute float sh;uniform mat4 m;varying float vs,vd;' +
    'void main(){vec4 c=m*vec4(a,1.);vd=c.w;vs=sh;gl_Position=c;}';
  var FS2 = 'precision mediump float;varying float vs,vd;uniform vec3 cc,cb;uniform float fg;' +
    'void main(){vec3 c=cc*vs;c=mix(c,cb,clamp((vd-1.2)/fg,0.,1.));gl_FragColor=vec4(c,1.);}';

  function th(x, z, amp) { return (.16 * Math.sin(x * 2.1 + .7) * Math.cos(z * 1.7) + .09 * Math.sin(x * 4.3 - z * 3.1 + 1.2) + .045 * Math.cos(x * 8.1 + z * 7.3)) * amp; }
  function persp(fov, asp, n, f) { var k = 1 / Math.tan(fov / 2); return [k / asp, 0, 0, 0, 0, k, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; }
  function look(e, t, u) {
    var z = norm([e[0] - t[0], e[1] - t[1], e[2] - t[2]]), x = norm(cross(u, z)), y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mul(a, b) { var o = new Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }

  Engines.terrain = function (canvas, o) {
    o = o || {};
    function cols() {
      if (o.columns) return o.columns;
      var r = core.rng(o.seed || 2), out = [];
      for (var i = 0; i < 5; i++) out.push({ x: (r() - .5) * 2.4, z: (r() - .3) * 2.2, h: .25 + r() * .6, c: i % 2 ? '--hi' : '--alt' });
      return out;
    }
    return core.make(canvas, o, {
      pure: true, gpu: true, gl: true,
      init: function (gl, e, s) {
        s.p1 = core.gl.program(gl, VS1, FS1, ['a']); s.p2 = core.gl.program(gl, VS2, FS2, ['a', 'sh']);
        var N = 72, v = [], ix = [], i, j;
        for (j = 0; j <= N; j++) for (i = 0; i <= N; i++) v.push(-1.6 + 3.2 * i / N, -1.6 + 3.2 * j / N);
        for (j = 0; j < N; j++) for (i = 0; i < N; i++) { var q = j * (N + 1) + i; ix.push(q, q + 1, q + N + 1, q + 1, q + N + 2, q + N + 1); }
        s.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, s.vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
        s.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, s.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ix), gl.STATIC_DRAW);
        s.n = ix.length; s.cb = gl.createBuffer(); s.labels = [];
        var U = function (p, ks) { var u = {}; ks.forEach(function (k) { u[k] = gl.getUniformLocation(p, k); }); return u; };
        s.u1 = U(s.p1, ['m', 'amp', 'cb', 'cs', 'cl', 'ch', 'lv', 'fg']); s.u2 = U(s.p2, ['m', 'cc', 'cb', 'fg']);
        gl.enable(gl.DEPTH_TEST);
        var par = canvas.parentElement;
        if (par && getComputedStyle(par).position === 'static') par.style.position = 'relative';
        cols().forEach(function (c) {
          if (!c.label || !par) { s.labels.push(null); return; }
          var d = document.createElement('div'); d.textContent = c.label; d.setAttribute('data-hm-label', '');
          d.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-130%);pointer-events:none;white-space:nowrap;' +
            'font:11px/1.2 ui-monospace,Consolas,monospace;padding:2px 6px;color:var(--ink);background:var(--surface);border:1px solid var(--line);display:none';
          par.appendChild(d); s.labels.push(d);
        });
      },
      draw: function (gl, e, s) {
        var amp = o.amp || 1.8, sp = (o.speed == null ? 1 : o.speed) * e.t, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
        var eye = [.9 * Math.sin(.11 * sp), .78 + .12 * Math.sin(.17 * sp), -2.1 + .5 * Math.sin(.07 * sp)];
        var tgt = [.4 * Math.sin(.09 * sp + 1), .05, .6];
        var m = mul(persp(.96, W / H, .1, 14), look(eye, tgt, [0, 1, 0])), bg = e.f('--bg'), fg = o.fog || 4;
        gl.viewport(0, 0, W, H); gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // terrain
        gl.useProgram(s.p1); var u = s.u1;
        gl.uniformMatrix4fv(u.m, false, m); gl.uniform1f(u.amp, amp); gl.uniform1f(u.lv, o.lines || 14); gl.uniform1f(u.fg, fg);
        gl.uniform3fv(u.cb, bg); gl.uniform3fv(u.cs, e.f('--surface')); gl.uniform3fv(u.cl, e.f('--line')); gl.uniform3fv(u.ch, e.f('--hi'));
        gl.bindBuffer(gl.ARRAY_BUFFER, s.vb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, s.ib); gl.drawElements(gl.TRIANGLES, s.n, gl.UNSIGNED_SHORT, 0);
        // columns (one box each), then pin labels to their tops
        gl.useProgram(s.p2); u = s.u2; gl.uniformMatrix4fv(u.m, false, m); gl.uniform3fv(u.cb, bg); gl.uniform1f(u.fg, fg);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.cb); gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
        var list = cols(), cw = canvas.clientWidth, ch = canvas.clientHeight;
        list.forEach(function (c, i) {
          var hw = .06, y0 = th(c.x, c.z, amp) - .03, y1 = y0 + .03 + (c.h == null ? .5 : c.h) * .7;
          var x0 = c.x - hw, x1 = c.x + hw, z0 = c.z - hw, z1 = c.z + hw, f = [];
          function quad(a, b, c2, d, sh) { [a, b, c2, a, c2, d].forEach(function (p) { f.push(p[0], p[1], p[2], sh); }); }
          quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], 1);
          quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], .7); quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], .85);
          quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], .6); quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], .75);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(f), gl.DYNAMIC_DRAW);
          gl.uniform3fv(u.cc, e.f(c.c || '--alt')); gl.drawArrays(gl.TRIANGLES, 0, 30);
          var d = s.labels[i];
          if (d) {
            var cl = [m[0] * c.x + m[4] * y1 + m[8] * c.z + m[12], m[1] * c.x + m[5] * y1 + m[9] * c.z + m[13], m[3] * c.x + m[7] * y1 + m[11] * c.z + m[15]];
            if (cl[2] <= 0) { d.style.display = 'none'; return; }
            d.style.display = 'block';
            d.style.left = (canvas.offsetLeft + (cl[0] / cl[2] * .5 + .5) * cw) + 'px';
            d.style.top = (canvas.offsetTop + (1 - (cl[1] / cl[2] * .5 + .5)) * ch) + 'px';
          }
        });
        gl.disableVertexAttribArray(1);
      },
      destroy: function (s) { (s.labels || []).forEach(function (d) { if (d && d.parentNode) d.parentNode.removeChild(d); }); }
    });
  };
})();
