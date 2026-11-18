/* kit.js — zero-dependency motion + BI chart kit for QSDLC stage artifacts.
 * UMD: browser global `Kit`, or `require('./kit.js')` / `import Kit from './kit.js'` in Node (no DOM needed for Kit.chart.svg).
 * Colours are ONLY var(--token) / currentColor: --bg --surface --panel --line --ink --muted --hi --ok --alt --risk.
 *
 * PURE STRING CORE (testable in Node)
 *   Kit.chart.svg(type, spec) -> '<figure class="kit-chart" data-chart=TYPE data-source=...>'
 *       <figcaption class="kit-cap"> + [<span class="kit-illustrative">Illustrative data</span>]
 *       <div class="kit-plot"><svg role="img" aria-labelledby="ID-t ID-d"><title/><desc/>…</svg></div>
 *       <p class="kit-src">  +  <details class="kit-details"><summary>Data table</summary><div class="table-wrap" tabindex="0"><table>…
 *   Common spec: {title, desc, source, illustrative:bool, unit, width}. data-source = spec.source | 'illustrative' | 'unspecified'.
 *   bar       {data:[{label,value,tone?}], target?, max?, sort?:'asc'|'desc'}            horizontal bars, direct value labels
 *   stacked   {series:[{label,tone}], data:[{label, values:[n,…]}]}                       100% bars, legend with values under each bar
 *   strip     {data:[{label, values:[n,…]}], marks?:[50,95,99]}                           dot strip + percentile ticks (p50/p95/p99)
 *   slope     {data:[{label,from,to}], fromLabel, toLabel, better?:'higher'|'lower'}      before/after with delta labels
 *   spark     {series:[{label,data:[n,…]}]} | {data:[n,…]}, shared?:false (true = one scale for all rows)                  faceted sparklines, last value labelled
 *   bullet    {data:[{label,value,target,max?,bands?:[a,b]}]}                             value vs target on qualitative bands
 *   heatmap   {rows:[..], cols:[..], cells:[[status|number,…]]}  status: pass|fail|skip|warn (glyph + tone); number 0..1 (intensity)
 *   waterfall {data:[{label,value,total?:true}]}                                          running delta; totals use --hi
 * DOM WRAPPERS
 *   Kit.chart.bar(el, spec) … (one per type; sets el.innerHTML)    Kit.chart.mount(root)  renders every
 *   <script type="application/json" data-chart="TYPE" [data-target="#id"]> (figure inserted after the script, or into the target).
 *   Kit.chart.animate(root) grows bars (`<g data-grow>`) and draws sparklines (`path.kit-line`).
 * MOTION (each returns {start, stop, redraw, drawAt(t)}; all are pure functions of t in 0..1)
 *   Kit.reveal(root)  Kit.draw(path,{dur}) Kit.grow(g,{dur,axis}) Kit.count(el,{to,from,dur,decimals,format,prefix,suffix})
 *   Kit.flow(path,n,{dur,r}) Kit.scrub(el,fn,{pin}) Kit.init(root)  (init = mount + animate + reveal + [data-count] + ?fps)
 * QUERY STRING: ?t=0..1 freezes every drawAt primitive at that fraction (and shows all reveals); ?freeze=1 stops loops (final frame);
 *   ?fps=1 shows a frame-rate readout. prefers-reduced-motion paints the final frame. Primitives start when scrolled into view,
 *   so screenshot tools should use ?t=1 or ?freeze=1 rather than relying on scrolling.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Kit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  /* ids are a hash of the spec, so rendering is a pure function of its input (stable pre-render, idempotent inline) */
  function hid(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
  var TONES = { ink: 1, muted: 1, line: 1, hi: 1, ok: 1, alt: 1, risk: 1, surface: 1, panel: 1, bg: 1 };
  var CYCLE = ['hi', 'ok', 'alt', 'risk', 'muted'];

  /* ------------------------------------------------------------ helpers */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function tok(t) { return 'var(--' + (TONES[t] ? t : 'hi') + ')'; }
  function mix(t, p) { return 'color-mix(in srgb,' + tok(t) + ' ' + p + '%,transparent)'; }
  function num(n, d) {
    if (typeof n !== 'number' || !isFinite(n)) return String(n == null ? '' : n);
    d = d == null ? (n % 1 && Math.abs(n) < 100 ? 1 : 0) : d;
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
  }
  function withUnit(n, u) { u = u || ''; return u === '%' ? num(n) + '%' : u ? num(n) + ' ' + u : num(n); }
  function trunc(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function pct(sorted, p) {
    if (!sorted.length) return 0;
    var i = (sorted.length - 1) * p / 100, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }
  function T(x, y, s, o) {
    o = o || {};
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" text-anchor="' + (o.a || 'start') + '"' + (o.rot ? ' transform="rotate(' + o.rot + ' ' + r1(x) + ' ' + r1(y) + ')"' : '') +
      ' style="fill:' + (o.c || 'var(--ink)') + ';font:' + (o.w || 400) + ' ' + (o.s || 12) + 'px ' +
      (o.mono ? 'var(--font-mono,ui-monospace,monospace)' : 'var(--font-sans,ui-sans-serif,system-ui,sans-serif)') +
      ';font-variant-numeric:tabular-nums' + (o.up ? ';text-transform:uppercase;letter-spacing:.08em' : '') + '">' + esc(s) + '</text>';
  }
  function L(x1, y1, x2, y2, c, w, dash) {
    return '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '" style="stroke:' + (c || 'var(--line)') + ';stroke-width:' + (w || 1) + (dash ? ';stroke-dasharray:' + dash : '') + '"/>';
  }
  function R(x, y, w, h, fill, extra) {
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(Math.max(0, w)) + '" height="' + r1(Math.max(0, h)) + '" style="fill:' + fill + '"' + (extra || '') + '/>';
  }
  function table(head, rows, cap) {
    return '<table><caption class="sr">' + esc(cap) + '</caption><thead><tr>' + head.map(function (h, i) { return '<th scope="col"' + (i ? ' class="num"' : '') + '>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return i ? '<td class="num">' + esc(c) + '</td>' : '<th scope="row">' + esc(c) + '</th>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  /* Wraps body in the standard figure. */
  function frame(type, spec, W, H, body, tbl, auto, minW) {
    var id = 'kc' + (spec.id ? String(spec.id).replace(/[^\w-]/g, '') : hid(type + JSON.stringify(spec))), ill = spec.illustrative;
    var src = spec.source || (ill ? 'illustrative' : 'unspecified');
    var title = spec.title || (type + ' chart');
    return '<figure class="kit-chart" data-chart="' + type + '" data-source="' + esc(src) + '"' + (ill ? ' data-illustrative="true"' : '') + '>' +
      '<figcaption class="kit-cap"><span class="kit-title">' + esc(spec.title || '') + '</span>' + (ill ? '<span class="kit-illustrative">Illustrative data</span>' : '') + '</figcaption>' +
      '<div class="kit-plot"><svg viewBox="0 0 ' + r1(W) + ' ' + r1(H) + '" role="img" aria-labelledby="' + id + '-t ' + id + '-d" style="max-width:' + Math.round(W * 1.4) + 'px;min-width:min(100%,' + (minW || 400) + 'px)">' +
      '<title id="' + id + '-t">' + esc(title) + '</title><desc id="' + id + '-d">' + esc(spec.desc || auto) + '</desc>' + body + '</svg></div>' +
      (spec.source ? '<p class="kit-src">Source: ' + esc(spec.source) + '</p>' : '') +
      '<details class="kit-details"><summary>Data table</summary><div class="table-wrap" tabindex="0">' + tbl + '</div></details></figure>';
  }
  function axisTicks(x0, x1, y, max, unit, n) {
    var s = '';
    for (var i = 0; i <= n; i++) {
      var x = x0 + (x1 - x0) * i / n;
      s += L(x, 4, x, y, 'var(--line)', 1) + T(x, y + 14, withUnit(max * i / n, unit), { a: i === 0 ? 'start' : i === n ? 'end' : 'middle', c: 'var(--muted)', s: 11 });
    }
    return s;
  }

  /* ------------------------------------------------------------ charts */
  var charts = {};

  charts.bar = function (spec) {
    var d = (spec.data || []).slice();
    if (spec.sort) d.sort(function (a, b) { return spec.sort === 'asc' ? a.value - b.value : b.value - a.value; });
    var W = spec.width || 480, labW = clamp(d.reduce(function (m, x) { return Math.max(m, String(x.label).length); }, 0) * 6.4 + 8, 60, 168);
    var padR = 64, rowH = 30, top = 6, plotW = W - labW - padR;
    var max = spec.max || niceMax(Math.max.apply(null, d.map(function (x) { return x.value; }).concat(spec.target || 0)));
    var mant = max / Math.pow(10, Math.floor(Math.log10(max))), H = top + d.length * rowH + 26, s = axisTicks(labW, labW + plotW, top + d.length * rowH, max, spec.unit, mant === 2 || mant === 4 ? 4 : 5), bars = '';
    d.forEach(function (x, i) {
      var y = top + i * rowH, w = x.value / max * plotW, tn = x.tone || 'hi';
      s += T(labW - 8, y + 19, trunc(x.label, 26), { a: 'end' });
      bars += R(labW, y + 6, w, 18, tok(tn), ' data-i="' + i + '"');
      s += T(labW + w + 6, y + 19, withUnit(x.value, spec.unit), { w: 600, mono: 1, s: 11.5 });
    });
    s += '<g data-grow data-axis="x">' + bars + '</g>';
    if (spec.target != null) {
      var tx = labW + spec.target / max * plotW;
      s += L(tx, top - 2, tx, top + d.length * rowH, 'var(--ink)', 1.5, '4 3') + T(tx, H - 2, 'target ' + withUnit(spec.target, spec.unit), { a: 'middle', c: 'var(--muted)', s: 10.5 });
    }
    var hi = d.reduce(function (m, x) { return x.value > m.value ? x : m; }, d[0] || { label: '', value: 0 });
    return frame('bar', spec, W, H, s, table(['Item', 'Value'], d.map(function (x) { return [x.label, withUnit(x.value, spec.unit)]; }), spec.title || 'Bar chart'),
      'Bar chart of ' + d.length + ' items; largest is ' + hi.label + ' at ' + withUnit(hi.value, spec.unit) + '.');
  };

  charts.stacked = function (spec) {
    var ser = spec.series || [], d = spec.data || [], W = spec.width || 480, rowH = 62, barW = W - 20, s = '', bars = '';
    d.forEach(function (row, i) {
      var y = 4 + i * rowH, tot = row.values.reduce(function (a, b) { return a + b; }, 0) || 1, x = 10, lx = 10;
      s += T(10, y + 12, row.label, { w: 600 });
      row.values.forEach(function (v, k) {
        var w = v / tot * barW, sr = ser[k] || {}, tn = sr.tone || CYCLE[k % CYCLE.length];
        bars += R(x, y + 20, Math.max(0, w - 1.5), 16, tok(tn), ' data-i="' + (i * 10 + k) + '"');
        x += w;
        var lab = (sr.label || 'Series ' + (k + 1)) + ' ' + num(v) + ' (' + num(v / tot * 100) + '%)';
        s += R(lx, y + 45, 8, 8, tok(tn)) + T(lx + 12, y + 53, lab, { s: 11, c: 'var(--muted)' });
        lx += 12 + lab.length * 5.9 + 14;
      });
    });
    s += '<g data-grow data-axis="x">' + bars + '</g>';
    var head = ['Group'].concat(ser.map(function (x) { return x.label; })).concat(['Total']);
    var rows = d.map(function (r) { return [r.label].concat(r.values.map(num), [num(r.values.reduce(function (a, b) { return a + b; }, 0))]); });
    return frame('stacked', spec, W, 4 + d.length * rowH + 4, s, table(head, rows, spec.title || 'Stacked bar'),
      'Proportional stacked bars for ' + d.length + ' groups across ' + ser.length + ' categories.');
  };

  charts.strip = function (spec) {
    var d = spec.data || [], marks = spec.marks || [50, 95, 99], W = spec.width || 480, labW = 0, padR = 20, rowH = 66;
    var all = []; d.forEach(function (x) { all = all.concat(x.values); });
    var max = spec.max || niceMax(Math.max.apply(null, all.concat(0))), x0 = 12, x1 = W - padR, s = '', head = ['Series', 'n'].concat(marks.map(function (m) { return 'p' + m; })), rows = [];
    var mt = ['ink', 'hi', 'risk'];
    d.forEach(function (row, i) {
      var y = 4 + i * rowH, sv = row.values.slice().sort(function (a, b) { return a - b; }), cy = y + 34, line = '';
      s += T(x0, y + 12, row.label, { w: 600 }) + L(x0, cy, x1, cy, 'var(--line)', 1);
      sv.forEach(function (v, k) { line += '<circle cx="' + r1(x0 + v / max * (x1 - x0)) + '" cy="' + r1(cy + ((k * 37) % 9) - 4) + '" r="2.6" style="fill:' + mix('hi', 45) + '"/>'; });
      s += line;
      var lx = x0, vals = [];
      marks.forEach(function (m, k) {
        var v = pct(sv, m), x = x0 + v / max * (x1 - x0), c = tok(mt[k % 3]);
        vals.push(num(v, 1));
        s += L(x, cy - 12, x, cy + 12, c, 2);
        var lab = 'p' + m + ' ' + withUnit(v, spec.unit);
        s += L(lx, y + 58, lx + 8, y + 58, c, 2) + T(lx + 12, y + 61, lab, { s: 11, c: 'var(--muted)', mono: 1 });
        lx += 12 + lab.length * 6.8 + 14;
      });
      rows.push([row.label, sv.length].concat(vals.map(function (v) { return withUnit(+v.replace(/,/g, ''), spec.unit); })));
    });
    var H = 4 + d.length * rowH + 4 + 22;
    var ax = '';
    [0, 0.5, 1].forEach(function (f) { ax += T(x0 + f * (x1 - x0), H - 4, withUnit(max * f, spec.unit), { a: f === 0 ? 'start' : f === 1 ? 'end' : 'middle', s: 10.5, c: 'var(--muted)' }); });
    return frame('strip', spec, W, H, s + ax, table(head, rows, spec.title || 'Distribution'),
      'Dot strip of ' + d.length + ' distributions with ' + marks.map(function (m) { return 'p' + m; }).join(', ') + ' markers.');
  };

  charts.slope = function (spec) {
    var d = spec.data || [], W = spec.width || 480, xl = 168, xr = W - 168, top = 34, H = Math.max(180, d.length * 30 + 60), better = spec.better || 'higher';
    var vs = []; d.forEach(function (x) { vs.push(x.from, x.to); });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), span = hi - lo || 1, y = function (v) { return top + (hi - v) / span * (H - top - 24); };
    function spread(a) { // nudge label y's apart (min gap 15)
      var o = a.map(function (v, i) { return { i: i, y: v }; }).sort(function (p, q) { return p.y - q.y; });
      for (var k = 1; k < o.length; k++) if (o[k].y - o[k - 1].y < 15) o[k].y = o[k - 1].y + 15;
      var out = []; o.forEach(function (p) { out[p.i] = p.y; }); return out;
    }
    var ly = spread(d.map(function (x) { return y(x.from); })), ry = spread(d.map(function (x) { return y(x.to); }));
    var s = T(xl, 14, spec.fromLabel || 'Before', { a: 'end', w: 600, c: 'var(--muted)', mono: 1, s: 11, up: 1 }) + T(xr, 14, spec.toLabel || 'After', { w: 600, c: 'var(--muted)', mono: 1, s: 11, up: 1 }) + L(xl, top - 6, xl, H - 18) + L(xr, top - 6, xr, H - 18), rows = [];
    d.forEach(function (x, i) {
      var dl = x.to - x.from, good = better === 'higher' ? dl >= 0 : dl <= 0, tn = dl === 0 ? 'muted' : good ? 'ok' : 'risk';
      var dtxt = (dl > 0 ? '+' : dl < 0 ? '−' : '') + num(Math.abs(dl)) + (spec.unit === '%' ? ' pts' : spec.unit ? ' ' + spec.unit : '');
      s += '<line x1="' + xl + '" y1="' + r1(y(x.from)) + '" x2="' + xr + '" y2="' + r1(y(x.to)) + '" style="stroke:' + tok(tn) + ';stroke-width:2" class="kit-line"/>' +
        '<circle cx="' + xl + '" cy="' + r1(y(x.from)) + '" r="3.5" style="fill:' + tok(tn) + '"/><circle cx="' + xr + '" cy="' + r1(y(x.to)) + '" r="3.5" style="fill:' + tok(tn) + '"/>' +
        T(xl - 10, ly[i] + 4, trunc(x.label, 18) + '  ' + withUnit(x.from, spec.unit), { a: 'end', s: 11.5 }) +
        T(xr + 10, ry[i] + 4, withUnit(x.to, spec.unit) + '  ' + dtxt, { s: 11.5, w: 600, c: 'var(--ink)' });
      rows.push([x.label, withUnit(x.from, spec.unit), withUnit(x.to, spec.unit), dtxt]);
    });
    return frame('slope', spec, W, H, s, table(['Item', spec.fromLabel || 'Before', spec.toLabel || 'After', 'Change'], rows, spec.title || 'Slope'),
      'Slope chart of ' + d.length + ' items from ' + (spec.fromLabel || 'before') + ' to ' + (spec.toLabel || 'after') + '.');
  };

  charts.spark = function (spec) {
    var ser = spec.series || [{ label: spec.title || 'Series', data: spec.data || [] }], W = spec.width || 480, labW = 128, padR = 70, rowH = 34, s = '', rows = [];
    var shared = spec.shared === true, all = []; ser.forEach(function (x) { all = all.concat(x.data); });
    var gmin = Math.min.apply(null, all), gmax = Math.max.apply(null, all);
    ser.forEach(function (sr, i) {
      var d = sr.data, mn = shared ? gmin : Math.min.apply(null, d), mx = shared ? gmax : Math.max.apply(null, d), sp = mx - mn || 1, y0 = 6 + i * rowH, pw = W - labW - padR, pts = [];
      d.forEach(function (v, k) { pts.push([labW + (d.length > 1 ? k / (d.length - 1) : 1) * pw, y0 + 4 + (mx - v) / sp * (rowH - 14)]); });
      s += T(labW - 10, y0 + 18, trunc(sr.label, 18), { a: 'end' }) + L(labW, y0 + rowH - 4, labW + pw, y0 + rowH - 4, 'var(--line)', 1) +
        '<path class="kit-line" d="M' + pts.map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join('L') + '" style="fill:none;stroke:var(--hi);stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>';
      var e = pts[pts.length - 1] || [labW, y0];
      s += '<circle cx="' + r1(e[0]) + '" cy="' + r1(e[1]) + '" r="3.2" style="fill:var(--hi)"/>' + T(labW + pw + 10, y0 + 18, withUnit(d[d.length - 1], spec.unit), { w: 600, mono: 1, s: 11.5 });
      rows.push([sr.label, num(d[0]), num(Math.min.apply(null, d)), num(Math.max.apply(null, d)), num(d[d.length - 1])]);
    });
    return frame('spark', spec, W, ser.length * rowH + 12, s, table(['Series', 'First', 'Min', 'Max', 'Last'], rows, spec.title || 'Sparklines'),
      'Sparklines for ' + ser.length + ' series' + (shared ? ' on a shared scale' : '') + ', each labelled with its latest value.', 380);
  };

  charts.bullet = function (spec) {
    var d = spec.data || [], W = spec.width || 480, labW = 128, padR = 96, rowH = 36, s = '', rows = [], bars = '', pw = W - labW - padR;
    d.forEach(function (x, i) {
      var max = x.max || niceMax(Math.max(x.value, x.target || 0) * 1.1), y = 6 + i * rowH, b = x.bands || [x.target * 0.7, x.target], ok = x.target == null || x.value >= x.target;
      s += T(labW - 10, y + 20, trunc(x.label, 18), { a: 'end' });
      [[max, 14], [b[1], 24], [b[0], 36]].forEach(function (k) { s += R(labW, y + 6, k[0] / max * pw, 20, mix('ink', k[1] === 14 ? 5 : k[1] === 24 ? 9 : 14)); });
      bars += R(labW, y + 12, x.value / max * pw, 8, tok(x.tone || (ok ? 'ok' : 'risk')), ' data-i="' + i + '"');
      if (x.target != null) s += L(labW + x.target / max * pw, y + 6, labW + x.target / max * pw, y + 26, 'var(--ink)', 2.5);
      s += T(labW + pw + 10, y + 20, withUnit(x.value, spec.unit) + (x.target != null ? ' / ' + withUnit(x.target, spec.unit) : ''), { mono: 1, s: 11, w: 600 });
      rows.push([x.label, withUnit(x.value, spec.unit), x.target != null ? withUnit(x.target, spec.unit) : '', x.target == null ? '' : ok ? 'meets target' : 'below target']);
    });
    s += '<g data-grow data-axis="x">' + bars + '</g>';
    return frame('bullet', spec, W, d.length * rowH + 14, s, table(['Measure', 'Value', 'Target', 'Status'], rows, spec.title || 'Bullet'),
      'Bullet chart of ' + d.length + ' measures; thick tick marks the target.');
  };

  var GLYPH = {
    pass: function (x, y, c) { return '<path d="M' + (x - 5) + ' ' + y + 'l4 4 7-8" style="fill:none;stroke:' + c + ';stroke-width:2"/>'; },
    fail: function (x, y, c) { return '<path d="M' + (x - 4.5) + ' ' + (y - 4.5) + 'l9 9m0-9l-9 9" style="fill:none;stroke:' + c + ';stroke-width:2"/>'; },
    skip: function (x, y, c) { return '<path d="M' + (x - 5) + ' ' + y + 'h10" style="fill:none;stroke:' + c + ';stroke-width:2"/>'; },
    warn: function (x, y, c) { return '<path d="M' + x + ' ' + (y - 5) + 'v6" style="fill:none;stroke:' + c + ';stroke-width:2"/><circle cx="' + x + '" cy="' + (y + 5) + '" r="1.4" style="fill:' + c + '"/>'; }
  };
  var STAT = { pass: 'ok', fail: 'risk', skip: 'muted', warn: 'alt' };
  charts.heatmap = function (spec) {
    var rowsL = spec.rows || [], cols = spec.cols || [], cells = spec.cells || [], cw = 28, labW = clamp(rowsL.reduce(function (m, x) { return Math.max(m, String(x).length); }, 0) * 6.4 + 12, 60, 168);
    var hh = clamp(cols.reduce(function (m, x) { return Math.max(m, String(x).length); }, 0) * 4.6 + 16, 24, 76), W = Math.max(spec.width || 0, labW + cols.length * cw + 56), s = '', body = [];
    cols.forEach(function (c, j) { s += T(labW + j * cw + cw / 2, hh - 6, trunc(c, 14), { rot: -45, s: 10.5, c: 'var(--muted)' }); });
    rowsL.forEach(function (rl, i) {
      var y = hh + i * cw, line = [rl];
      s += T(labW - 8, y + cw / 2 + 4, trunc(rl, 26), { a: 'end', s: 11.5 });
      cols.forEach(function (c, j) {
        var v = (cells[i] || [])[j], x = labW + j * cw, cx = x + cw / 2, cy = y + cw / 2, st = typeof v === 'string' ? (STAT[v] ? v : 'skip') : null;
        if (st) s += R(x + 1, y + 1, cw - 2, cw - 2, mix(STAT[st], 22)) + GLYPH[st](cx, cy, tok(STAT[st]));
        else { var f = clamp(+v || 0, 0, 1); s += R(x + 1, y + 1, cw - 2, cw - 2, mix('hi', 8 + f * 47)) + T(cx, cy + 4, String(Math.round(f * 100)), { a: 'middle', s: 9.5, mono: 1 }); }
        line.push(typeof v === 'string' ? v : num(+v || 0, 2));
      });
      body.push(line);
    });
    return frame('heatmap', spec, W, hh + rowsL.length * cw + 8, s, table([spec.corner || 'Item'].concat(cols), body, spec.title || 'Heatmap'),
      'Heatmap of ' + rowsL.length + ' rows by ' + cols.length + ' columns; each cell shows a status glyph or a percentage.', 340);
  };

  charts.waterfall = function (spec) {
    var d = spec.data || [], W = spec.width || 480, left = 10, padB = 46, H = 230, top = 22, run = 0, steps = [], lo = 0, hi = 0;
    d.forEach(function (x) { var a = x.total ? 0 : run, b = x.total ? x.value : run + x.value; run = b; steps.push([a, b]); lo = Math.min(lo, a, b); hi = Math.max(hi, a, b); });
    var span = hi - lo || 1, ph = H - top - padB, y = function (v) { return top + (hi - v) / span * ph; }, cw = (W - left * 2) / Math.max(1, d.length), s = L(left, y(0), W - left, y(0), 'var(--muted)', 1), bars = '', rows = [];
    d.forEach(function (x, i) {
      var st = steps[i], x0 = left + i * cw + cw * 0.16, w = cw * 0.68, yt = y(Math.max(st[0], st[1])), hgt = Math.abs(y(st[0]) - y(st[1])), tn = x.total ? 'hi' : x.value >= 0 ? 'ok' : 'risk';
      bars += R(x0, yt, w, Math.max(1.5, hgt), tok(tn), ' data-i="' + i + '"');
      var lab = x.total ? num(x.value) : (x.value >= 0 ? '+' : '−') + num(Math.abs(x.value)), up = x.total || x.value >= 0;
      s += T(x0 + w / 2, up ? yt - 5 : yt + hgt + 12, lab, { a: 'middle', mono: 1, w: 600, s: 11 }) +
        T(x0 + w / 2, H - padB + 16, trunc(x.label, Math.max(5, Math.floor(cw / 6.4))), { a: 'middle', s: 10.5, c: 'var(--muted)' });
      if (i < d.length - 1) s += L(x0 + w, y(st[1]), x0 + cw, y(st[1]), 'var(--muted)', 1, '2 3');
      rows.push([x.label, x.total ? 'total ' + num(x.value) : (x.value >= 0 ? '+' : '−') + num(Math.abs(x.value)), num(st[1])]);
    });
    s += '<g data-grow data-axis="y">' + bars + '</g>';
    return frame('waterfall', spec, W, H, s, table(['Step', 'Change', 'Running total'], rows, spec.title || 'Waterfall'),
      'Waterfall of ' + d.length + ' steps ending at ' + num(run) + '; green steps add, red steps subtract.', 360);
  };

  function svg(type, spec) {
    if (!charts[type]) throw new Error('Kit.chart: unknown type "' + type + '" (' + Object.keys(charts).join(', ') + ')');
    return charts[type](spec || {});
  }
  var chart = { svg: svg, types: Object.keys(charts) };
  Object.keys(charts).forEach(function (t) { chart[t] = function (el, spec) { el.innerHTML = svg(t, spec); return el; }; });
  chart.mount = function (rootEl) {
    rootEl = rootEl || document;
    [].slice.call(rootEl.querySelectorAll('script[type="application/json"][data-chart]')).forEach(function (sc) {
      if (sc.getAttribute('data-mounted')) return;
      var html; try { html = svg(sc.getAttribute('data-chart'), JSON.parse(sc.textContent)); } catch (e) { if (typeof console !== 'undefined') console.error('Kit.chart.mount:', e.message); return; }
      var tg = sc.getAttribute('data-target'), el = tg && document.querySelector(tg);
      if (el) el.innerHTML = html; else sc.insertAdjacentHTML('afterend', html);
      sc.setAttribute('data-mounted', '1');
    });
  };
  chart.animate = function (rootEl) {
    rootEl = rootEl || document;
    [].slice.call(rootEl.querySelectorAll('.kit-chart g[data-grow]')).forEach(function (g) { if (!g.__kit) g.__kit = grow(g); });
    [].slice.call(rootEl.querySelectorAll('.kit-chart path.kit-line')).forEach(function (p) { if (!p.__kit) p.__kit = draw(p); });
  };

  /* ------------------------------------------------------------ motion core */
  var live = [], fpsEl = null;
  function env() {
    var q = null, reduce = false;
    try { q = new URLSearchParams(location.search); } catch (e) { /* no DOM */ }
    try { reduce = !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* ignore */ }
    var t = q && q.get('t'); t = t != null && t !== '' && isFinite(+t) ? clamp(+t, 0, 1) : null;
    return { t: t, freeze: !!q && q.get('freeze') === '1', fps: !!q && q.get('fps') === '1', reduce: reduce };
  }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function whenVisible(el, fn) {
    if (typeof IntersectionObserver !== 'function' || !el) return fn();
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); } }, { threshold: 0.15 });
    io.observe(el);
  }
  function fpsInit() {
    if (fpsEl || !env().fps || typeof document === 'undefined' || !document.body) return;
    fpsEl = document.createElement('div'); fpsEl.className = 'kit-fps'; fpsEl.textContent = 'fps …'; document.body.appendChild(fpsEl);
    var n = 0, t0 = performance.now();
    (function tick(now) { n++; if (now - t0 >= 500) { fpsEl.textContent = Math.round(n * 1000 / (now - t0)) + ' fps'; n = 0; t0 = now; } requestAnimationFrame(tick); })(t0);
  }
  /* A primitive: draw(t) is a pure function of t∈[0,1]; o = {dur, loop, still}. */
  function make(el, draw, o) {
    var raf = 0, running = false, cur = 0, e = env();
    var api = {
      drawAt: function (t) { cur = t; draw(t); },
      redraw: function () { draw(cur); },
      stop: function () { running = false; if (raf) cancelAnimationFrame(raf); },
      start: function () {
        var en = env();
        if (en.t != null) { api.drawAt(en.t); return api; }
        if (en.reduce || en.freeze) { api.drawAt(o.loop ? (o.still || 0) : 1); return api; }
        running = true; var t0 = 0;
        raf = requestAnimationFrame(function tick(now) {
          if (!running) return;
          if (!t0) t0 = now;
          var p = (now - t0) / o.dur;
          if (o.loop) p = p % 1; else p = Math.min(1, p);
          api.drawAt(o.loop ? p : ease(p));
          if (!o.loop && p >= 1) { running = false; return; }
          raf = requestAnimationFrame(tick);
        });
        return api;
      }
    };
    live.push(api);
    if (e.t != null || e.freeze || e.reduce) api.start();
    else { api.drawAt(0); whenVisible(el, api.start); }
    return api;
  }

  function draw(path, o) {
    o = o || {};
    var len = path.getTotalLength ? path.getTotalLength() : 0;
    return make(path, function (t) {
      if (t >= 1) { path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; return; }
      path.style.strokeDasharray = len; path.style.strokeDashoffset = len * (1 - t);
    }, { dur: o.dur || 900 });
  }

  function grow(g, o) {
    o = o || {};
    var axis = o.axis || g.getAttribute('data-axis') || 'x', kids = [].slice.call(g.children), stag = o.stagger == null ? 0.5 : o.stagger, n = kids.length || 1;
    kids.forEach(function (k) { k.style.transformBox = 'fill-box'; k.style.transformOrigin = axis === 'x' ? '0 50%' : '50% 100%'; });
    return make(g, function (t) {
      kids.forEach(function (k, i) {
        var p = clamp((t - i / n * stag) / (1 - stag), 0, 1);
        k.style.transform = p >= 1 ? '' : (axis === 'x' ? 'scaleX(' : 'scaleY(') + p + ')';
      });
    }, { dur: o.dur || 800 });
  }

  function count(el, o) {
    o = o || {};
    var raw = o.to != null ? o.to : parseFloat(el.getAttribute('data-count') != null ? el.getAttribute('data-count') : String(el.textContent).replace(/[^0-9.\-]/g, ''));
    if (!isFinite(raw)) return null;                       // never animate non-numeric text
    var from = o.from != null ? o.from : +(el.getAttribute('data-from') || 0), dec = o.decimals != null ? o.decimals : +(el.getAttribute('data-decimals') || 0);
    var pre = o.prefix != null ? o.prefix : el.getAttribute('data-prefix') || '', suf = o.suffix != null ? o.suffix : el.getAttribute('data-suffix') || '';
    var fmt = typeof o.format === 'function' ? o.format : function (v) { return pre + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; };
    el.classList.add('numeral'); el.style.fontVariantNumeric = 'tabular-nums';
    el.textContent = fmt(raw);                              // final value is the no-JS / reduced-motion fallback
    return make(el, function (t) { el.textContent = fmt(t >= 1 ? raw : from + (raw - from) * t); }, { dur: o.dur || 1100 });
  }

  function flow(path, n, o) {
    o = o || {}; n = n || 3;
    var len = path.getTotalLength(), host = path.parentNode, dots = [];
    for (var i = 0; i < n; i++) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', o.r || 3.5); c.setAttribute('class', 'kit-dot'); c.setAttribute('aria-hidden', 'true'); c.style.fill = 'var(--hi)';
      host.insertBefore(c, path.nextSibling); dots.push(c);
    }
    return make(path, function (t) {
      dots.forEach(function (c, k) { var p = path.getPointAtLength((((t + k / n) % 1) + 1) % 1 * len); c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); });
    }, { dur: o.dur || 4000, loop: true, still: 0 });
  }

  /* Scroll-linked progress. fn(p) with p∈[0,1]. {pin:true} measures a tall sticky container (0 at its top, 1 when its end hits the viewport bottom).
   * (CSS-only scroll-linked reveal for [data-scrub] lives in kit.css under @supports (animation-timeline: view()); this is the JS/fallback path.) */
  function scrub(el, fn, o) {
    o = o || {};
    function prog() {
      var r = el.getBoundingClientRect(), vh = innerHeight || 1;
      return clamp(o.pin ? -r.top / Math.max(1, r.height - vh) : (vh - r.top) / (vh + r.height), 0, 1);
    }
    var cur = 0, ticking = false, e = env();
    var api = { drawAt: function (t) { cur = t; fn(t); }, redraw: function () { fn(cur); }, stop: function () { removeEventListener('scroll', onS); }, start: function () { return api; } };
    function onS() { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; api.drawAt(prog()); }); }
    if (e.t != null) api.drawAt(e.t);
    else if (e.reduce || e.freeze) api.drawAt(1);
    else { addEventListener('scroll', onS, { passive: true }); addEventListener('resize', onS); api.drawAt(prog()); }
    live.push(api);
    return api;
  }

  /* Adds `js` to <html>; [data-reveal] elements fade in (stagger via --i) when scrolled into view. */
  function reveal(rootEl) {
    rootEl = rootEl || document;
    var els = [].slice.call(rootEl.querySelectorAll('[data-reveal]')), e = env();
    document.documentElement.classList.add('js');
    var seen = new Map();
    els.forEach(function (el) { var k = seen.get(el.parentNode) || 0; seen.set(el.parentNode, k + 1); if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', el.getAttribute('data-i') != null ? el.getAttribute('data-i') : k % 8); });
    function show(el) { el.classList.add('is-in'); }
    if (e.t != null || e.freeze || e.reduce || typeof IntersectionObserver !== 'function') { els.forEach(show); return els.length; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { show(x.target); io.unobserve(x.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
    return els.length;
  }

  function init(rootEl) {
    rootEl = rootEl || document;
    chart.mount(rootEl); chart.animate(rootEl);
    [].slice.call(rootEl.querySelectorAll('[data-count]')).forEach(function (el) { if (!el.__kit) el.__kit = count(el); });
    reveal(rootEl); fpsInit();
  }
  if (typeof addEventListener === 'function') addEventListener('beforeprint', function () { live.forEach(function (p) { p.drawAt(1); }); });

  return { chart: chart, reveal: reveal, draw: draw, grow: grow, count: count, flow: flow, scrub: scrub, init: init, env: env };
});
