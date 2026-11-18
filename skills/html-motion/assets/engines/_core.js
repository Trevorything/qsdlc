/* html-motion core: shared runtime for every engine. Zero dependencies. Always inlined first.
 *
 * Contract (every engine):  const e = Engines.name(canvas, { W, H, ...options })
 *                           -> { start, stop, redraw, drawAt, set, resize, destroy }
 *   W, H     drawing space in CSS pixels (default: the canvas's client size). The backing store is W*res x H*res,
 *            res = min(devicePixelRatio, 2) (governor may lower it). Inline size is set to W x H px unless css:false.
 *   start()  runs the loop. Under prefers-reduced-motion it paints one COMPLETE final frame and does not loop.
 *   stop()   cancels the loop (the last frame stays on the canvas).
 *   redraw() repaints the current frame; call after a theme or token change.
 *   drawAt(t) paints the frame for t seconds. Exact for "pure" engines; stateful engines replay a seeded
 *            simulation from 0 in 1/30 s steps, so the same t gives the same frame.
 *   set(obj) changes options live (engines read options every frame where noted in their header).
 *   A draw function may return 'freeze' to end its own loop; the last frame stays.
 *
 * Common options: loop (pure engines restart after dur+hold), dur, hold (s, default .6), bg (true or token: paint
 *   a background), dpr (cap, <= 2), quality (GPU resolution multiplier), css (false: page sizes the canvas), seed.
 *
 * Tokens. Engines read colours BY NAME from :root on every draw, so a CSS transition on a registered @property
 * glides through the canvas with no restart. A page MUST define all ten (below). If one is missing the engine
 * falls back to the neutral defaults in Engines.core.defaults so it still renders, but the colours will not be yours.
 *   --bg --surface --panel --line --ink --muted --hi --ok --alt --risk
 * <html data-deck="dark|light"> selects the theme engines blend for (glow add vs. normal). Absent: system theme.
 *
 * Globals:  Engines.maxFps (default 60)  cap for pages that run for hours, e.g. 30.
 *           Engines.noGovernor (false)   set true if the page paces a GPU engine itself with drawAt(t).
 * URL:      ?fps=1 frame-rate readout   ?gov=off disable the governor (for testing).
 * Governor (GPU engines only): if ~45 consecutive frames average slower than 20 fps, halve resolution; if still
 *   slow, freeze on the last frame. Without WebGL (or on compile/context loss) the canvas gets a still gradient
 *   built from the tokens (data-fallback="still").
 */
(function () {
  'use strict';
  var G = window, E = G.Engines = G.Engines || {};
  var Q = new URLSearchParams(location.search);
  if (E.maxFps == null) E.maxFps = 60;
  if (E.noGovernor == null) E.noGovernor = false;

  var TOKENS = ['--bg', '--surface', '--panel', '--line', '--ink', '--muted', '--hi', '--ok', '--alt', '--risk'];
  // Neutral, unbranded fallbacks only. Real pages define their own tokens (see qsdlc-present brand binding).
  var DEFAULTS = {
    dark:  { '--bg': '#101214', '--surface': '#171a1d', '--panel': '#1f2327', '--line': '#2c3238', '--ink': '#e8eaec',
             '--muted': '#9aa3ab', '--hi': '#3fb8af', '--ok': '#5bbf7a', '--alt': '#e0a458', '--risk': '#e5645a' },
    light: { '--bg': '#f6f5f2', '--surface': '#ffffff', '--panel': '#ecebe7', '--line': '#d5d3cd', '--ink': '#1c1f22',
             '--muted': '#5c646b', '--hi': '#0f7d76', '--ok': '#2b7a47', '--alt': '#9a6a12', '--risk': '#b3372e' }
  };
  var core = E.core = { tokens: TOKENS, defaults: DEFAULTS, frames: 0 };

  // ---- small math helpers -------------------------------------------------------------------------------
  core.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  core.lerp = function (a, b, k) { return a + (b - a) * k; };
  core.smooth = function (a, b, x) { var k = core.clamp((x - a) / (b - a || 1), 0, 1); return k * k * (3 - 2 * k); };
  core.ease = function (k) { k = core.clamp(k, 0, 1); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  core.rng = function (s) { // mulberry32: deterministic, so drawAt(t) is repeatable
    s = (s >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0; var t = s;
      t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  core.theme = function () {
    var d = document.documentElement.getAttribute('data-deck');
    if (d === 'light' || d === 'dark') return d;
    return G.matchMedia && G.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  };
  core.reduced = function () { return !!(G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches); };

  // ---- colour parsing (any CSS colour the canvas understands -> [r,g,b]) --------------------------------
  var cc = document.createElement('canvas').getContext('2d'), memo = {};
  function parse(v, fb) {
    v = (v || '').trim();
    if (!v) return fb;
    if (memo[v]) return memo[v];
    cc.fillStyle = '#010203'; cc.fillStyle = v;
    var s = cc.fillStyle, out;
    if (s === '#010203' && v.replace(/\s/g, '').toLowerCase() !== '#010203') return fb; // not a colour
    if (s.charAt(0) === '#') out = [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)];
    else { var m = s.match(/[\d.]+/g); out = [+m[0], +m[1], +m[2]]; }
    return (memo[v] = out);
  }
  function Env(W, H) {
    var cs = getComputedStyle(document.documentElement), th = core.theme(), d = DEFAULTS[th];
    this.W = W; this.H = H; this.dark = th === 'dark'; this.c = {};
    for (var i = 0; i < TOKENS.length; i++) this.c[TOKENS[i]] = parse(cs.getPropertyValue(TOKENS[i]), parse(d[TOKENS[i]]));
  }
  var P = Env.prototype;
  P.arr = function (t) { // token name ('--hi' or 'hi') or any CSS colour -> [r,g,b] 0..255
    if (this.c[t]) return this.c[t];
    var n = t.charAt(0) === '-' ? t : '--' + t;
    return this.c[n] || parse(t, this.c['--ink']);
  };
  P.f = function (t) { var c = this.arr(t); return [c[0] / 255, c[1] / 255, c[2] / 255]; }; // 0..1 for GL uniforms
  P.rgb = function (t) { var c = this.arr(t); return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; };
  P.a = function (t, al) { var c = this.arr(t); return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + core.clamp(al, 0, 1) + ')'; };
  P.mix = function (t1, t2, k, al) {
    var a = this.arr(t1), b = this.arr(t2);
    return 'rgba(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' + Math.round(a[1] + (b[1] - a[1]) * k) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * k) + ',' + (al == null ? 1 : core.clamp(al, 0, 1)) + ')';
  };
  P.glow = function () { return this.dark ? 'lighter' : 'source-over'; }; // additive glow on dark, plain on light
  core.env = function (W, H) { return new Env(W, H); };

  // ---- still fallback (no WebGL, shader compile error, lost context) -------------------------------------
  core.still = function (canvas, e) {
    canvas.style.background = 'radial-gradient(120% 90% at 30% 20%,' + e.a('--hi', .35) + ',transparent 60%),' +
      'linear-gradient(' + e.rgb('--surface') + ',' + e.rgb('--bg') + ')';
    canvas.setAttribute('data-fallback', 'still');
  };

  // ---- WebGL helpers --------------------------------------------------------------------------------------
  core.gl = {
    program: function (gl, vs, fs, attrs) { // attrs: attribute names, bound to locations 0,1,2...
      function sh(type, src) {
        var h = gl.createShader(type); gl.shaderSource(h, src); gl.compileShader(h);
        if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(h));
        return h;
      }
      var p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      (attrs || []).forEach(function (n, i) { gl.bindAttribLocation(p, i, n); });
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    }
  };

  // ---- ?fps=1 readout (one shared element, counts paints across all engines) ------------------------------
  var fpsEl = null;
  function fpsInit() {
    if (fpsEl || Q.get('fps') !== '1' || !document.body) return;
    fpsEl = document.createElement('div'); fpsEl.setAttribute('data-hm-fps', '');
    fpsEl.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99999;font:11px/1.2 ui-monospace,Consolas,monospace;' +
      'padding:3px 6px;background:rgba(0,0,0,.7);color:#fff;pointer-events:none';
    document.body.appendChild(fpsEl);
    var n0 = 0, t0 = performance.now();
    setInterval(function () {
      var now = performance.now();
      fpsEl.textContent = Math.round((core.frames - n0) * 1000 / (now - t0)) + ' fps';
      n0 = core.frames; t0 = now;
    }, 500);
  }

  // ---- the engine factory ----------------------------------------------------------------------------------
  // spec: { pure, gpu, gl, dur, init(g,e,st), draw(g,e,st) -> 'freeze'|undefined, destroy() }
  // `e` is the per-frame env: W H t dt p(progress, pure engines with dur) dark o(options) + colour helpers.
  core.make = function (canvas, o, spec) {
    o = o || {};
    var self = { canvas: canvas, opts: o }, g = null, ok = false, inited = false, st = {};
    var W = o.W || canvas.clientWidth || canvas.width || 300, H = o.H || canvas.clientHeight || canvas.height || 150;
    var dprCap = Math.min(o.dpr || G.devicePixelRatio || 1, 2), scale = 1, res = 1, slow = 0, win = [];
    var raf = 0, running = false, tNow = 0, lastTs = 0, lastPaint = 0, vis = true, io = null;

    function dur() { return typeof spec.dur === 'function' ? spec.dur(o) : spec.dur; }
    function hold() { return o.hold != null ? o.hold : .6; }
    function size() {
      res = core.clamp(dprCap * scale * (spec.gl ? (o.quality || 1) : 1), .25, 2);
      canvas.width = Math.max(1, Math.round(W * res)); canvas.height = Math.max(1, Math.round(H * res));
      if (o.css !== false) { canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
    }
    function mk(t, dt) {
      var e = new Env(W, H); e.t = t; e.dt = dt; e.res = res; e.o = o; e.canvas = canvas;
      if (spec.dur) { var d = dur(); e.p = o.loop ? Math.min(1, (t % (d + hold())) / d) : Math.min(1, t / d); }
      return e;
    }
    function ensure() {
      if (inited) return; inited = true; fpsInit();
      if (spec.gl) {
        try { g = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl'); }
        catch (x) { g = null; }
        ok = !!g;
        if (g) canvas.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); ok = false; stop(); core.still(canvas, mk(0, 0)); });
      } else { g = canvas.getContext('2d'); ok = !!g; }
      size();
      if (ok) { try { if (spec.init) spec.init(g, mk(0, 0), st); } catch (x) { console.warn('html-motion: init failed, using still fallback.', x.message); ok = false; } }
      if (!ok) core.still(canvas, mk(0, 0));
    }
    function paint(t, dt) {
      ensure();
      if (!ok) { core.still(canvas, mk(t, dt)); return 'still'; }
      var e = mk(t, dt);
      if (!spec.gl) {
        g.setTransform(res, 0, 0, res, 0, 0); g.clearRect(0, 0, W, H);
        if (o.bg) { g.fillStyle = e.rgb(o.bg === true ? '--bg' : o.bg); g.fillRect(0, 0, W, H); }
      }
      var r = spec.draw(g, e, st);
      core.frames++;
      if (spec.pure && spec.dur && !o.loop && t >= dur() + hold()) r = 'freeze';
      return r;
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    function tick(ts) {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (document.hidden || !vis) { lastTs = 0; lastPaint = 0; return; }
      var raw = lastTs ? ts - lastTs : 0; lastTs = ts;
      if (spec.gpu && !E.noGovernor && Q.get('gov') !== 'off' && raw > 0 && raw < 250) {
        win.push(raw);
        if (win.length >= 45) {
          var avg = win.reduce(function (a, b) { return a + b; }, 0) / win.length; win = [];
          if (avg > 45) {
            if (++slow === 1) { scale = .5; size(); console.info('html-motion governor: resolution halved'); }
            else { console.info('html-motion governor: froze on last frame'); stop(); return; }
          }
        }
      }
      var min = 1000 / Math.max(1, E.maxFps);
      if (lastPaint && ts - lastPaint < min - 1.5) return;
      var dt = lastPaint ? Math.min((ts - lastPaint) / 1000, .1) : 0;
      lastPaint = ts; tNow += dt;
      if (paint(tNow, dt) === 'freeze') stop();
    }
    function settle() { // one complete final frame (reduced motion, or a still render)
      if (spec.pure) self.drawAt(spec.dur ? dur() : (o.still != null ? o.still : 6));
      else self.drawAt(o.warm != null ? o.warm : (spec.dur ? dur() + 2 : 4));
    }

    self.start = function () {
      ensure();
      if (running) return self;
      if (core.reduced()) { settle(); return self; }
      running = true; lastTs = 0; lastPaint = 0;
      if (!io && 'IntersectionObserver' in G) { io = new IntersectionObserver(function (en) { vis = en[en.length - 1].isIntersecting; }); io.observe(canvas); }
      raf = requestAnimationFrame(tick);
      return self;
    };
    self.stop = function () { stop(); return self; };
    self.redraw = function () { paint(tNow, 0); return self; };
    self.drawAt = function (t) {
      ensure(); tNow = t;
      if (spec.pure || spec.gl || !ok) { paint(t, 0); return self; }
      st = {}; if (spec.init) spec.init(g, mk(0, 0), st);
      var n = Math.min(900, Math.ceil(t * 30));
      if (n < 1) { paint(0, 0); return self; }
      for (var i = 1; i <= n; i++) paint(i / 30, 1 / 30);
      return self;
    };
    self.set = function (patch) { for (var k in patch) o[k] = patch[k]; return self; };
    self.resize = function (w, h) { W = w; H = h; if (inited) { size(); self.redraw(); } return self; };
    self.destroy = function () { stop(); if (io) io.disconnect(); if (spec.destroy) spec.destroy(st); };

    var mq = G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (mq.matches && running) { stop(); settle(); } });
    return self;
  };
})();
