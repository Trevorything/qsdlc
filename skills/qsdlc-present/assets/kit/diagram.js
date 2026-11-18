/* diagram.js — layered DAG -> inline SVG. Replaces external Mermaid. Zero dependencies; UMD (browser global `Diagram`, or require() in Node, no DOM needed).
 * Colours are ONLY var(--token) (--bg --surface --panel --line --ink --muted --hi --ok --alt --risk).
 *
 *   Diagram.svg(json, opts?)     -> '<figure class="kit-diagram" data-diagram …>' string
 *   Diagram.layout(json, el?, opts?) -> same string; also sets el.innerHTML when el is given
 *   Diagram.mount(root?)         renders every <script type="application/json" data-diagram> (inserted after it, or into data-target)
 *   Diagram.animate(root?)       draws edges in once visible (final frame under reduced motion, ?freeze=1, or ?t=0..1)
 *
 * opts: { edges:'curved' } (or json.routing:'curved') switches orthogonal edges to curves. json.edges is always the edge ARRAY.
 * json: { title, desc, direction:'LR'|'TB', routing?:'orthogonal'|'curved', source?, illustrative?,
 *         nodes:[{id,label,sub?,shape:'rect'|'round'|'pill'|'diamond'|'hex', status:'done'|'running'|'blocked'|'todo'|'risk', group?, tag?}],
 *         edges:[{from,to,label?,kind?:'dep'|'handoff'|'optional'}], groups:[{id,label}] }
 * Status is shown by glyph + status word in the node (and stroke weight/dash), colour is secondary. Cycles: back-edges are reversed for
 * layout, drawn dashed (class dg-back). Long edges are routed through dummy nodes so they never cross unrelated nodes' ranks.
 * Markup hooks: figure.kit-diagram[data-diagram], svg role=img (+title/desc), g.dg-group, path.dg-edge[data-from][data-to], g.dg-node[data-id][data-status],
 * g.dg-label, details.kit-details (adjacency list fallback).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Diagram = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function hid(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
  var STAT = { done: { tone: 'ok', word: 'done' }, running: { tone: 'hi', word: 'running' }, blocked: { tone: 'risk', word: 'blocked' }, todo: { tone: 'muted', word: 'to do' }, risk: { tone: 'alt', word: 'at risk' } };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function wrap(s, max) { // up to 2 lines on word boundaries
    s = String(s == null ? '' : s); if (s.length <= max) return [s];
    var words = s.split(/\s+/), a = '', i = 0;
    while (i < words.length && (a + ' ' + words[i]).trim().length <= max) a = (a + ' ' + words[i++]).trim();
    if (!a) { a = s.slice(0, max); i = 0; words = [s.slice(max)]; }
    var b = words.slice(i).join(' '); if (b.length > max) b = b.slice(0, max - 1) + '…';
    return b ? [a, b] : [a];
  }
  function font(sz, w, mono) { return 'font:' + (w || 400) + ' ' + sz + 'px ' + (mono ? 'var(--font-mono,ui-monospace,monospace)' : 'var(--font-sans,ui-sans-serif,system-ui,sans-serif)'); }

  /* ------------------------------------------------------------------ layout */
  function layout(spec, opts) {
    opts = opts || {};
    var dir = spec.direction === 'TB' ? 'TB' : 'LR', curved = opts.edges === 'curved' || spec.routing === 'curved' || spec.curved === true;
    var nodes = [], byId = {}, parts = [], partIdx = {};
    (spec.groups || []).forEach(function (g) { if (partIdx[g.id] == null) { partIdx[g.id] = parts.length; parts.push({ id: g.id, label: g.label || g.id }); } });
    (spec.nodes || []).forEach(function (n, i) {
      var st = STAT[n.status] ? n.status : null, lines = wrap(n.label, 24);
      var meta = [st ? STAT[st].word : '', n.tag || '', n.sub || ''].filter(Boolean).join(' · ');
      var w = clamp(Math.max.apply(null, lines.map(function (l) { return l.length * 7.4; }).concat(meta.length * 6.3)) + 30 + (st ? 22 : 0), 96, 280), h = 16 + lines.length * 16 + (meta ? 15 : 0);
      var shape = ['rect', 'round', 'pill', 'diamond', 'hex'].indexOf(n.shape) >= 0 ? n.shape : 'rect';
      if (shape === 'diamond') { w *= 1.3; h = h * 1.5 + 6; } else if (shape === 'hex') w += 22; else if (shape === 'pill') w += 14;
      var o = { id: String(n.id), label: n.label == null ? n.id : n.label, lines: lines, meta: meta, status: st, shape: shape, group: n.group, w: w, h: h, ord: i, tag: n.tag, sub: n.sub };
      if (o.group != null && partIdx[o.group] == null) { partIdx[o.group] = parts.length; parts.push({ id: o.group, label: o.group }); }
      byId[o.id] = o; nodes.push(o);
    });
    var hasGroups = parts.length > 0; parts.push({ id: '', label: '' }); partIdx[''] = parts.length - 1;
    nodes.forEach(function (n) { n.pi = partIdx[n.group != null ? n.group : '']; n.ms = dir === 'LR' ? n.w : n.h; n.cs = dir === 'LR' ? n.h : n.w; });

    var edges = [];
    (spec.edges || []).forEach(function (e, i) { var a = byId[e.from], b = byId[e.to]; if (a && b && a !== b) edges.push({ a: a, b: b, label: e.label, kind: e.kind || 'dep', ord: i }); });

    /* cycle breaking: DFS from roots, mark back-edges */
    var out = {}, hasIn = {}; nodes.forEach(function (n) { out[n.id] = []; });
    edges.forEach(function (e) { out[e.a.id].push(e); hasIn[e.b.id] = 1; });
    var state = {};
    function dfs(u) { state[u.id] = 1; out[u.id].forEach(function (e) { var s = state[e.b.id]; if (s === 1) e.back = true; else if (!s) dfs(e.b); }); state[u.id] = 2; }
    nodes.filter(function (n) { return !hasIn[n.id]; }).concat(nodes).forEach(function (n) { if (!state[n.id]) dfs(n); });
    edges.forEach(function (e) { e.s = e.back ? e.b : e.a; e.t = e.back ? e.a : e.b; });

    /* longest-path ranking on the layout DAG */
    var preds = {}; nodes.forEach(function (n) { preds[n.id] = []; });
    edges.forEach(function (e) { preds[e.t.id].push(e.s); });
    var memo = {};
    function rank(n) { if (memo[n.id] != null) return memo[n.id]; memo[n.id] = 0; var r = 0; preds[n.id].forEach(function (p) { r = Math.max(r, rank(p) + 1); }); return (memo[n.id] = r); }
    nodes.forEach(function (n) { n.r = rank(n); });
    var R = nodes.reduce(function (m, n) { return Math.max(m, n.r); }, 0), layers = []; for (var i = 0; i <= R; i++) layers.push([]);
    nodes.forEach(function (n) { layers[n.r].push(n); });

    /* dummy chains for edges spanning >1 rank */
    var dn = 0;
    edges.forEach(function (e) {
      e.chain = [e.s];
      for (var r = e.s.r + 1; r < e.t.r; r++) { var d = { id: '~' + (dn++), dummy: true, r: r, pi: partIdx[''], ms: 0, cs: 0, ord: 1e6 + dn }; layers[r].push(d); e.chain.push(d); }
      e.chain.push(e.t);
      for (var k = 0; k < e.chain.length - 1; k++) { var p = e.chain[k], q = e.chain[k + 1]; (p.downs = p.downs || []).push(q); (q.ups = q.ups || []).push(p); }
    });

    /* lanes (stable, non-overlapping group boxes) + barycentre sweeps */
    var lanes = parts.map(function (p, pi) { return layers.reduce(function (m, L) { return Math.max(m, L.filter(function (n) { return n.pi === pi; }).length); }, 0); });
    var start = [], acc = 0; parts.forEach(function (p, pi) { start[pi] = acc; if (lanes[pi]) acc += lanes[pi] + (hasGroups ? 0.6 : 0); });
    var totalSlots = Math.max(1, acc - (hasGroups ? 0.6 : 0));
    function assign() {
      layers.forEach(function (L) {
        var cnt = {}; L.forEach(function (n) { cnt[n.pi] = (cnt[n.pi] || 0) + 1; });
        var seen = {}; L.forEach(function (n) { var k = seen[n.pi] = (seen[n.pi] || 0) + 1; n.slot = start[n.pi] + (lanes[n.pi] - cnt[n.pi]) / 2 + (k - 1); });
      });
    }
    function sortLayer(L, key) {
      L.forEach(function (n) { var ns = n[key]; n.bc = ns && ns.length ? ns.reduce(function (a, x) { return a + x.slot; }, 0) / ns.length : n.slot; });
      L.sort(function (a, b) { return a.pi - b.pi || a.bc - b.bc || a.ord - b.ord; });
    }
    layers.forEach(function (L) { L.sort(function (a, b) { return a.pi - b.pi || a.ord - b.ord; }); });
    assign();
    for (var it = 0; it < 8; it++) {
      for (var r = 1; r <= R; r++) { sortLayer(layers[r], 'ups'); assign(); }
      for (r = R - 1; r >= 0; r--) { sortLayer(layers[r], 'downs'); assign(); }
    }

    /* straighten: pull each node toward the mean slot of its neighbours, keeping order and a 1-slot gap inside its lane band */
    function refine(L, key) {
      parts.forEach(function (p, pi) {
        var ns = L.filter(function (n) { return n.pi === pi; }); if (!ns.length) return;
        var lo = start[pi], hi = start[pi] + lanes[pi] - 1, d = ns.map(function (n) { var q = n[key]; return q && q.length ? q.reduce(function (a, x) { return a + x.slot; }, 0) / q.length : n.slot; }), k;
        for (k = 0; k < ns.length; k++) d[k] = clamp(d[k], lo + k, hi - (ns.length - 1 - k));
        for (k = 1; k < ns.length; k++) d[k] = Math.max(d[k], d[k - 1] + 1);
        for (k = ns.length - 2; k >= 0; k--) d[k] = Math.min(d[k], d[k + 1] - 1);
        ns.forEach(function (n, i) { n.slot = d[i]; });
      });
    }
    for (it = 0; it < 4; it++) {
      for (r = 1; r <= R; r++) refine(layers[r], 'ups');
      for (r = R - 1; r >= 0; r--) refine(layers[r], 'downs');
    }

    /* coordinates (abstract: m = along rank axis, c = across) */
    var hasLabels = edges.some(function (e) { return e.label; });
    var gapM = (dir === 'LR' ? (hasLabels ? 118 : 84) : (hasLabels ? 74 : 56)) + (hasGroups ? 18 : 0);
    var maxCs = nodes.reduce(function (m, n) { return Math.max(m, n.cs); }, 40), pitch = maxCs + (hasGroups ? 42 : (dir === 'TB' ? 34 : 26)), cur = 0;
    layers.forEach(function (L) {
      var ml = L.reduce(function (m, n) { return Math.max(m, n.ms); }, 0) || 8;
      L.forEach(function (n) { n.m = cur + ml / 2; n.c = (n.slot + 0.5) * pitch; });
      cur += ml + gapM;
    });
    function P(m, c) { return dir === 'LR' ? { x: m, y: c } : { x: c, y: m }; }
    nodes.forEach(function (n) { var p = P(n.m, n.c); n.x = p.x; n.y = p.y; });

    /* edge polylines */
    /* edges between the same two nodes (a→b with b→a, or duplicates) get parallel lanes instead of drawing on top of each other */
    var lanes = {};
    edges.forEach(function (e) { var key = e.a.id < e.b.id ? e.a.id + '\u0001' + e.b.id : e.b.id + '\u0001' + e.a.id; (lanes[key] = lanes[key] || []).push(e); e.laneKey = key; });
    edges.forEach(function (e) {
      var ch = e.chain, pts = [], k, grp = lanes[e.laneKey], off = grp.length > 1 ? (grp.indexOf(e) - (grp.length - 1) / 2) * 22 : 0;
      var A = { m: ch[0].m + ch[0].ms / 2, c: ch[0].c + off }, B = { m: ch[ch.length - 1].m - ch[ch.length - 1].ms / 2, c: ch[ch.length - 1].c + off }, seq = [A];
      for (k = 1; k < ch.length - 1; k++) seq.push({ m: ch[k].m, c: ch[k].c + off });
      seq.push(B);
      pts.push(seq[0]);
      for (k = 1; k < seq.length; k++) {
        var p = seq[k - 1], q = seq[k], mid = (p.m + q.m) / 2;
        // a labelled edge bends early so its last segment (unique to this edge) is long enough to carry the label beside the arrowhead
        if (e.label && !curved && k === seq.length - 1) { var need = String(e.label).length * 6.1 + 34; if (q.m - p.m > need + 14) mid = q.m - need; }
        if (curved) pts.push({ m: mid, c: p.c, cp: 1 }, { m: mid, c: q.c, cp: 1 }, q);
        else pts.push({ m: mid, c: p.c }, { m: mid, c: q.c }, q);
      }
      if (e.back) pts.reverse();
      var sp = pts.map(function (q) { var s = P(q.m, q.c); s.cp = q.cp; return s; });
      var clean = curved ? sp : sp.filter(function (q, i) { // drop zero-length and collinear points
        var a = sp[i - 1], b = sp[i + 1];
        if (a && a.x === q.x && a.y === q.y) return false;
        return !(a && b && ((a.x === q.x && q.x === b.x) || (a.y === q.y && q.y === b.y)));
      });
      e.pts = clean;
    });
    return { dir: dir, curved: curved, nodes: nodes, edges: edges, parts: parts, hasGroups: hasGroups };
  }

  /* ------------------------------------------------------------------ drawing */
  function edgePath(e, curved) {
    var p = e.pts, d = 'M' + r1(p[0].x) + ' ' + r1(p[0].y), i;
    if (curved) { for (i = 1; i + 2 < p.length; i += 3) d += 'C' + r1(p[i].x) + ' ' + r1(p[i].y) + ' ' + r1(p[i + 1].x) + ' ' + r1(p[i + 1].y) + ' ' + r1(p[i + 2].x) + ' ' + r1(p[i + 2].y); return d; }
    for (i = 1; i < p.length - 1; i++) {
      var a = p[i - 1], b = p[i], c = p[i + 1], l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y), rr = Math.min(7, l1 / 2, l2 / 2);
      d += 'L' + r1(b.x - (b.x - a.x) / l1 * rr) + ' ' + r1(b.y - (b.y - a.y) / l1 * rr) + 'Q' + r1(b.x) + ' ' + r1(b.y) + ' ' + r1(b.x + (c.x - b.x) / l2 * rr) + ' ' + r1(b.y + (c.y - b.y) / l2 * rr);
    }
    return d + 'L' + r1(p[p.length - 1].x) + ' ' + r1(p[p.length - 1].y);
  }
  function glyph(st, x, y) {
    var c = 'var(--' + STAT[st].tone + ')', s = 'fill:none;stroke:' + c + ';stroke-width:2;stroke-linecap:round;stroke-linejoin:round';
    if (st === 'done') return '<path d="M' + (x - 5) + ' ' + y + 'l3.5 3.5 6.5-7" style="' + s + '"/>';
    if (st === 'running') return '<path d="M' + (x - 4) + ' ' + (y - 6) + 'l10 6-10 6z" style="fill:' + c + ';stroke:none"/>';
    if (st === 'blocked') return '<circle cx="' + x + '" cy="' + y + '" r="6" style="' + s + '"/><path d="M' + (x - 3.5) + ' ' + y + 'h7" style="' + s + '"/>';
    if (st === 'risk') return '<path d="M' + x + ' ' + (y - 6.5) + 'l7 12.5h-14z" style="' + s + ';stroke-width:1.6"/><path d="M' + x + ' ' + (y - 2) + 'v4" style="' + s + ';stroke-width:1.6"/>';
    return '<circle cx="' + x + '" cy="' + y + '" r="5" style="' + s + ';stroke-width:1.5"/>';
  }
  function render(spec, opts) {
    var m = layout(spec, opts), id = 'dg' + (spec.id ? String(spec.id).replace(/[^\w-]/g, '') : hid(JSON.stringify(spec) + JSON.stringify(opts || {}))), parts = [], bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    function grow(x0, y0, x1, y1) { bx0 = Math.min(bx0, x0); by0 = Math.min(by0, y0); bx1 = Math.max(bx1, x1); by1 = Math.max(by1, y1); }
    var body = '';
    /* groups */
    m.parts.forEach(function (g) {
      if (!g.id) return;
      var ns = m.nodes.filter(function (n) { return String(n.group) === String(g.id); });
      if (!ns.length) return;
      var x0 = Math.min.apply(null, ns.map(function (n) { return n.x - n.w / 2; })) - 16, x1 = Math.max.apply(null, ns.map(function (n) { return n.x + n.w / 2; })) + 16,
        y0 = Math.min.apply(null, ns.map(function (n) { return n.y - n.h / 2; })) - 30, y1 = Math.max.apply(null, ns.map(function (n) { return n.y + n.h / 2; })) + 16;
      grow(x0, y0, x1, y1);
      body += '<g class="dg-group" data-group="' + esc(g.id) + '"><rect x="' + r1(x0) + '" y="' + r1(y0) + '" width="' + r1(x1 - x0) + '" height="' + r1(y1 - y0) + '" style="fill:color-mix(in srgb,var(--ink) 4%,transparent);stroke:var(--line);stroke-width:1;stroke-dasharray:5 4"/>' +
        '<text x="' + r1(x0 + 10) + '" y="' + r1(y0 + 17) + '" style="fill:var(--muted);' + font(11, 600, 1) + ';letter-spacing:.1em;text-transform:uppercase">' + esc(g.label) + '</text></g>';
    });
    /* edges */
    var labels = '', placed = [];
    function segLen(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
    // two segments run along the same line and overlap: they are a shared trunk
    function sharesTrunk(a0, a1, b0, b1) {
      if (Math.abs(a0.y - a1.y) < 1 && Math.abs(b0.y - b1.y) < 1 && Math.abs(a0.y - b0.y) < 2) return Math.min(Math.max(a0.x, a1.x), Math.max(b0.x, b1.x)) - Math.max(Math.min(a0.x, a1.x), Math.min(b0.x, b1.x)) > 4;
      if (Math.abs(a0.x - a1.x) < 1 && Math.abs(b0.x - b1.x) < 1 && Math.abs(a0.x - b0.x) < 2) return Math.min(Math.max(a0.y, a1.y), Math.max(b0.y, b1.y)) - Math.max(Math.min(a0.y, a1.y), Math.min(b0.y, b1.y)) > 4;
      return false;
    }
    /* Choose the segment that carries an edge's label: prefer one no other edge runs along (so the label belongs to exactly one edge),
       then one long enough for the label, then the last segment (beside the arrowhead), and never on top of a label already placed. */
    function pickLabelSegment(e, lw) {
      var p = e.pts, cands = [], i;
      for (i = 0; i + 1 < p.length; i++) {
        var len = segLen(p[i], p[i + 1]);
        if (!m.curved && len < Math.min(lw + 10, 36)) continue;
        var share = 0;
        if (!m.curved) m.edges.forEach(function (f) { if (f === e) return; for (var j = 0; j + 1 < f.pts.length; j++) if (sharesTrunk(p[i], p[i + 1], f.pts[j], f.pts[j + 1])) { share++; break; } });
        cands.push({ i: i, len: len, share: share, fits: len >= lw + 16 ? 0 : 1, last: i === p.length - 2 ? 0 : 1 });
      }
      if (!cands.length) { var b = 0, bi = 0; for (i = 0; i + 1 < p.length; i++) { var l = segLen(p[i], p[i + 1]); if (l > b) { b = l; bi = i; } } return bi; }
      cands.sort(function (a, b) { return a.share - b.share || a.fits - b.fits || a.last - b.last || b.len - a.len; });
      for (var c = 0; c < cands.length; c++) {
        var s = cands[c], lx = (p[s.i].x + p[s.i + 1].x) / 2, ly = (p[s.i].y + p[s.i + 1].y) / 2, hit = false;
        for (var k = 0; k < placed.length; k++) { var r = placed[k]; if (lx - lw / 2 < r.x1 + 3 && lx + lw / 2 > r.x0 - 3 && ly - 9 < r.y1 + 3 && ly + 9 > r.y0 - 3) { hit = true; break; } }
        if (!hit) return s.i;
      }
      return cands[0].i;
    }
    m.edges.forEach(function (e) {
      var dash = e.back || e.kind === 'optional' ? '6 4' : '', w = e.kind === 'handoff' ? 2.25 : 1.5, d = edgePath(e, m.curved);
      body += '<path class="dg-edge' + (e.back ? ' dg-back' : '') + '" data-from="' + esc(e.a.id) + '" data-to="' + esc(e.b.id) + '" data-dash="' + dash + '" d="' + d + '" marker-end="url(#' + id + '-a)" style="fill:none;stroke:var(--' + (e.kind === 'handoff' ? 'ink' : 'muted') + ');stroke-width:' + w + (dash ? ';stroke-dasharray:' + dash : '') + ';stroke-linejoin:round"/>';
      e.pts.forEach(function (p) { grow(p.x, p.y, p.x, p.y); });
      if (e.label) {
        var p = e.pts, lw = String(e.label).length * 6.1 + 12, bi = pickLabelSegment(e, lw);
        var lx = (p[bi].x + p[bi + 1].x) / 2, ly = (p[bi].y + p[bi + 1].y) / 2;
        placed.push({ x0: lx - lw / 2, x1: lx + lw / 2, y0: ly - 9, y1: ly + 9 });
        labels += '<g class="dg-label"><rect x="' + r1(lx - lw / 2) + '" y="' + r1(ly - 9) + '" width="' + r1(lw) + '" height="18" style="fill:var(--bg);opacity:.92"/><text x="' + r1(lx) + '" y="' + r1(ly + 4) + '" text-anchor="middle" style="fill:var(--muted);' + font(11, 400, 1) + '">' + esc(e.label) + '</text></g>';
        grow(lx - lw / 2, ly - 9, lx + lw / 2, ly + 9);
      }
    });
    /* nodes */
    m.nodes.forEach(function (n) {
      var tone = n.status ? STAT[n.status].tone : 'muted', sw = n.status === 'running' || n.status === 'blocked' ? 2.25 : 1.25, dash = n.status === 'todo' ? '4 3' : '';
      grow(n.x - n.w / 2, n.y - n.h / 2, n.x + n.w / 2, n.y + n.h / 2);
      var gl = n.status && n.shape !== 'diamond', tx = n.x + (gl ? 11 : 0), ty = n.y - (n.lines.length * 16 + (n.meta ? 15 : 0)) / 2, g = '';
      var xx = n.x - n.w / 2, yy = n.y - n.h / 2, st = 'fill:var(--surface);stroke:var(--' + tone + ');stroke-width:' + sw + (dash ? ';stroke-dasharray:' + dash : '');
      if (n.shape === 'diamond') g += '<polygon points="' + [[n.x, yy], [xx + n.w, n.y], [n.x, yy + n.h], [xx, n.y]].map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ') + '" style="' + st + '"/>';
      else if (n.shape === 'hex') g += '<polygon points="' + [[xx + 14, yy], [xx + n.w - 14, yy], [xx + n.w, n.y], [xx + n.w - 14, yy + n.h], [xx + 14, yy + n.h], [xx, n.y]].map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ') + '" style="' + st + '"/>';
      else g += '<rect x="' + r1(xx) + '" y="' + r1(yy) + '" width="' + r1(n.w) + '" height="' + r1(n.h) + '" ' + (n.shape === 'pill' ? 'rx="' + r1(n.h / 2) + '" ' : n.shape === 'round' ? 'rx="10" ' : '') + 'style="' + st + (n.shape === 'rect' ? ';rx:var(--radius,2px)' : '') + '"/>';
      if (n.status) g += glyph(n.status, n.shape === 'diamond' ? n.x : xx + 20, n.shape === 'diamond' ? yy + 15 : n.y);
      n.lines.forEach(function (l, i) { g += '<text x="' + r1(tx) + '" y="' + r1(ty + 13 + i * 16) + '" text-anchor="middle" style="fill:var(--ink);' + font(13, 600) + '">' + esc(l) + '</text>'; });
      if (n.meta) g += '<text x="' + r1(tx) + '" y="' + r1(ty + n.lines.length * 16 + 11) + '" text-anchor="middle" style="fill:var(--muted);' + font(10.5, 500, 1) + '">' + esc(n.meta) + '</text>';
      body += '<g class="dg-node" data-id="' + esc(n.id) + '"' + (n.status ? ' data-status="' + n.status + '"' : '') + '><title>' + esc(n.label + (n.status ? ' (' + STAT[n.status].word + ')' : '')) + '</title>' + g + '</g>';
    });
    body += labels;
    var pad = 14, vx = bx0 - pad, vy = by0 - pad, W = bx1 - bx0 + pad * 2, H = by1 - by0 + pad * 2, title = spec.title || 'Diagram';
    var auto = 'Directed graph with ' + m.nodes.length + ' nodes and ' + m.edges.length + ' edges, flowing ' + (m.dir === 'LR' ? 'left to right' : 'top to bottom') + '.';
    var adj = m.nodes.map(function (n) {
      var outs = m.edges.filter(function (e) { return e.a === n; }).map(function (e) { return esc(e.b.label) + (e.label ? ' (' + esc(e.label) + ')' : ''); });
      return '<li><strong>' + esc(n.label) + '</strong>' + (n.status ? ' — ' + STAT[n.status].word : '') + (n.tag ? ' [' + esc(n.tag) + ']' : '') + (n.sub ? ', ' + esc(n.sub) : '') + (outs.length ? ' → ' + outs.join(', ') : ' (end)') + '</li>';
    }).join('');
    return '<figure class="kit-diagram" data-diagram data-source="' + esc(spec.source || (spec.illustrative ? 'illustrative' : 'unspecified')) + '"' + (spec.illustrative ? ' data-illustrative="true"' : '') + '>' +
      (spec.illustrative ? '<figcaption class="kit-cap"><span class="kit-illustrative">Illustrative data</span></figcaption>' : '') + '<div class="kit-plot" tabindex="0">' +
      '<svg viewBox="' + r1(vx) + ' ' + r1(vy) + ' ' + r1(W) + ' ' + r1(H) + '" role="img" aria-labelledby="' + id + '-t ' + id + '-d" style="max-width:' + Math.round(W * 1.3) + 'px;min-width:' + Math.min(Math.round(W), 760) + 'px">' +
      '<title id="' + id + '-t">' + esc(title) + '</title><desc id="' + id + '-d">' + esc(spec.desc || auto) + '</desc>' +
      '<defs><marker id="' + id + '-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--muted)"/></marker></defs>' +
      body + '</svg></div><details class="kit-details"><summary>Node and edge list</summary><ul>' + adj + '</ul></details></figure>';
  }

  /* ------------------------------------------------------------------ DOM helpers */
  function layoutFn(spec, el, opts) { var s = render(spec || {}, opts); if (el) el.innerHTML = s; return s; }
  function mount(rootEl) {
    rootEl = rootEl || document;
    [].slice.call(rootEl.querySelectorAll('script[type="application/json"][data-diagram]')).forEach(function (sc) {
      if (sc.getAttribute('data-mounted')) return;
      var html; try { html = render(JSON.parse(sc.textContent)); } catch (e) { if (typeof console !== 'undefined') console.error('Diagram.mount:', e.message); return; }
      var tg = sc.getAttribute('data-target'), el = tg && document.querySelector(tg);
      if (el) el.innerHTML = html; else sc.insertAdjacentHTML('afterend', html);
      sc.setAttribute('data-mounted', '1');
    });
  }
  function animate(rootEl) {
    rootEl = rootEl || document;
    var q = null, reduce = false; try { q = new URLSearchParams(location.search); reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* no DOM */ }
    var tq = q && q.get('t'), fixed = tq != null && tq !== '' && isFinite(+tq) ? clamp(+tq, 0, 1) : null;
    if (reduce || (q && q.get('freeze') === '1' && fixed == null)) return;
    [].slice.call(rootEl.querySelectorAll('figure.kit-diagram')).forEach(function (fig) {
      var ps = [].slice.call(fig.querySelectorAll('path.dg-edge')); if (!ps.length || fig.__dgAnim) return; fig.__dgAnim = 1;
      function set(t) {
        ps.forEach(function (p, i) {
          var len = p.__len || (p.__len = p.getTotalLength()), n = ps.length, lt = clamp((t - i / n * 0.6) / 0.4, 0, 1);
          if (lt >= 1) { p.style.strokeDasharray = p.getAttribute('data-dash') || ''; p.style.strokeDashoffset = ''; p.style.markerEnd = ''; }
          else { p.style.strokeDasharray = len; p.style.strokeDashoffset = len * (1 - lt); p.style.markerEnd = 'none'; }
        });
      }
      if (fixed != null) return set(fixed);
      set(0);
      function run() { var t0 = 0; requestAnimationFrame(function tick(now) { if (!t0) t0 = now; var t = Math.min(1, (now - t0) / 1400); set(t); if (t < 1) requestAnimationFrame(tick); }); }
      if (typeof IntersectionObserver !== 'function') return run();
      var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); run(); } }, { threshold: 0.15 }); io.observe(fig);
    });
  }
  return { svg: render, layout: layoutFn, mount: mount, animate: animate, model: layout };
});
