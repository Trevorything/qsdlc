#!/usr/bin/env node
// lint.mjs — deterministic static checks for a QSDLC HTML artifact. Zero dependencies.
//
//   node lint.mjs <artifact.html> [--brand brand-bind.json] [--claims] [--ambient] [--max-kb 400] [--json] [--strict]
//
//   --ambient  for always-on wall displays / desktop backgrounds only: allows fetch() to a loopback server (live data),
//              requires a <main> landmark. Never use it for QSDLC stage artifacts, which must work from file:// with zero network.
//
//   L01 external URLs           L02 reduced motion + visible-without-JS   L03 :focus-visible, no div onclick
//   L04 painted body + tokens   L05 palette drift vs brand-bind.json      L06 radius scale + shadow
//   L07 gradient text, emoji, purple→blue gradient                         L08 svg title/role + chart <details>
//   L09 WCAG contrast of token pairs for text   L10 overflow-x wrappers   L11 scroll-snap proximity
//   L12 lang/title/viewport/h1/headings         L13 size budget           L14 data-source + illustrative labels
//   L15 (--claims) overclaim words              L16 brand-source meta
//
// Exit 0 = no errors (warnings allowed unless --strict), 1 = errors, 2 = usage.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanCssVars, parseColor, contrast, toHex, rgbToHsl } from './brand_probe.mjs';

const blank = (s) => s.replace(/[^\n]/g, ' ');
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'line', 'ellipse', 'polygon', 'polyline', 'stop', 'use']);

export function lint(html, opts = {}) {
  const findings = [];
  const maxKb = Number(opts.maxKb || 400);
  const brand = opts.brand || null;
  const bytes = Buffer.byteLength(html, 'utf8');
  const lineOf = (idx) => html.slice(0, Math.max(0, idx)).split('\n').length;
  const add = (code, level, msg, idx) => findings.push({ code, level, msg, line: idx == null ? null : lineOf(idx) });

  // masked views that keep character offsets
  let noComments = html.replace(/<!--[\s\S]*?-->/g, blank);
  noComments = noComments.replace(/data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]+/gi, blank).replace(/url\(\s*["']?data:[^)]*\)/gi, blank);
  const styles = []; const scripts = []; const jsonScripts = [];
  noComments.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, body, off) => { styles.push({ css: body.replace(/\/\*[\s\S]*?\*\//g, blank), off: off + m.indexOf('>') + 1 }); return m; });
  noComments.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body, off) => {
    const rec = { attrs, body, off: off + m.indexOf('>') + 1 };
    if (/type\s*=\s*["']application\/(ld\+)?json["']/i.test(attrs)) jsonScripts.push(rec); else scripts.push(rec);
    return m;
  });
  const htmlNoCode = noComments.replace(/<(style|script)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (m, t, a, b) => `<${t}${a}>${blank(b)}</${t}>`);
  const allCss = styles.map((s) => s.css).join('\n');
  const bodyText = htmlNoCode.replace(/<[^>]+>/g, ' ');

  // ── L01 external URLs ──
  const isExternal = (u) => /^(https?:)?\/\//i.test(u.trim()) && !/^(https?:)?\/\/www\.w3\.org\//i.test(u.trim());
  for (const m of htmlNoCode.matchAll(/<(link|script|img|iframe|source|video|audio|embed|object|use|image|track)\b[^>]*?\s(?:src|href|xlink:href|data|poster|srcset)\s*=\s*["']([^"']+)["']/gi)) {
    if (isExternal(m[2].split(/\s+/)[0])) add('L01', 'error', `external resource <${m[1].toLowerCase()}> loads ${m[2].slice(0, 80)}; inline it or remove it`, m.index);
  }
  for (const s of styles) {
    for (const m of s.css.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/gi)) if (isExternal(m[1]) || !m[1].startsWith('data:')) add('L01', 'error', `CSS @import ${m[1].slice(0, 80)}`, s.off + m.index);
    for (const m of s.css.matchAll(/url\(\s*["']?([^"')]+)/gi)) if (isExternal(m[1])) add('L01', 'error', `CSS url() loads ${m[1].slice(0, 80)}`, s.off + m.index);
  }
  // --ambient (always-on wall displays and desktop backgrounds only): polling a LOCAL server is the documented way to get live data,
  // because fetch() from a file:// page is blocked. It is allowed only when every URL string in the scripts is a loopback address.
  const isLoopback = (u) => /^https?:\/\/(localhost|127(\.\d+){3}|\[::1\])(:\d+)?(\/|$)/i.test(u);
  const scriptUrls = scripts.flatMap((s) => [...s.body.matchAll(/["'](https?:\/\/(?!www\.w3\.org)[^"']+)["']/g)].map((m) => m[1]));
  const ambientNet = Boolean(opts.ambient) && scriptUrls.every(isLoopback);
  for (const s of scripts) {
    for (const m of s.body.matchAll(/\b(fetch\s*\(|XMLHttpRequest|new\s+WebSocket|navigator\.sendBeacon|importScripts\s*\()/g)) {
      if (ambientNet && /^(fetch|XMLHttpRequest)/.test(m[1])) add('L01', 'info', `ambient mode: ${m[1].trim()} is allowed because every URL in the scripts is a loopback address; serve the page and its data from a local server`, s.off + m.index);
      else add('L01', 'error', `script performs a network call (${m[1].trim()}); ${opts.ambient ? 'in --ambient mode only fetch() to a localhost, 127.x or [::1] address is allowed' : 'an artifact must work from file://'}`, s.off + m.index);
    }
    for (const m of s.body.matchAll(/\bimport\s*\(\s*["'](https?:[^"']+)/g)) add('L01', 'error', `dynamic import from ${m[1].slice(0, 60)}`, s.off + m.index);
    for (const m of s.body.matchAll(/\bimport\s+(?:[^;"']*?\sfrom\s*)?["'](https?:[^"']+)/g)) add('L01', 'error', `static import from ${m[1].slice(0, 60)}`, s.off + m.index);
    for (const m of s.body.matchAll(/["'](https?:\/\/(?!www\.w3\.org)[^"']+)["']/g)) if (!(ambientNet && isLoopback(m[1]))) add('L01', 'warn', `URL string in script: ${m[1].slice(0, 60)} (fine in a comment or link text, an error if loaded)`, s.off + m.index);
  }

  // ── token and rule parsing ──
  const decls = styles.flatMap((s) => scanCssVars(s.css, 'page').map((d) => ({ ...d, abs: s.off })));
  const baseTokens = {}, darkTokens = {}, lightTokens = {};
  for (const d of decls) { const t = d.mode === 'dark' ? darkTokens : d.mode === 'light' ? lightTokens : baseTokens; if (!(d.name in t) || /:root/.test(d.selector)) t[d.name] = d.value; }
  const hasDark = Object.keys(darkTokens).length > 0, hasLight = Object.keys(lightTokens).length > 0;
  const resolveVar = (val, map, depth = 0) => {
    if (depth > 6 || typeof val !== 'string') return null;
    const v = val.trim(); const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v);
    if (m) return resolveVar(map[m[1]] ?? m[2], map, depth + 1);
    return parseColor(v);
  };
  // colour of a declaration value, compositing any alpha over `under`
  const colorWithAlpha = (val, map, under) => {
    const base = resolveVar(val, map); if (!base) return null;
    const v = String(val).trim();
    let a = 1, m;
    if ((m = /^(?:rgba?|hsla?)\(([^)]*)\)$/i.exec(v))) { const p = m[1].split(/[\s,/]+/).filter(Boolean); if (p[3] !== undefined) a = p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3]); }
    else if ((m = /^#([0-9a-f]{8})$/i.exec(v))) a = parseInt(m[1].slice(6), 16) / 255;
    if (a >= 0.999 || !under) return base;
    return { r: base.r * a + under.r * (1 - a), g: base.g * a + under.g * (1 - a), b: base.b * a + under.b * (1 - a) };
  };
  const rules = [];
  const parseRules = (css, ctx, base) => {
    let i = 0;
    while (i < css.length) {
      const open = css.indexOf('{', i); if (open < 0) break;
      let depth = 0, close = -1;
      for (let j = open; j < css.length; j++) { if (css[j] === '{') depth++; else if (css[j] === '}') { depth--; if (depth === 0) { close = j; break; } } }
      if (close < 0) break;
      const header = css.slice(i, open).trim(); const inner = css.slice(open + 1, close);
      if (/^@(media|supports|layer|container)/i.test(header)) parseRules(inner, [...ctx, header], base + open + 1);
      else if (!header.startsWith('@')) rules.push({ selector: header, body: inner, ctx, index: base + i + (css.slice(i, open).length - css.slice(i, open).trimStart().length) });
      i = close + 1;
    }
  };
  for (const s of styles) parseRules(s.css, [], s.off);
  const declsOf = (body) => { const out = []; let depth = 0, cur = ''; for (const ch of body) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ';' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => { const k = x.indexOf(':'); return k < 0 ? null : [x.slice(0, k).trim().toLowerCase(), x.slice(k + 1).trim()]; }).filter(Boolean); };

  // ── L02 reduced motion and no-JS visibility ──
  const usesMotion = /\banimation\s*:|\banimation-name\s*:|\btransition\s*:|@keyframes|\[data-reveal\]|requestAnimationFrame|animate\(/i.test(allCss + scripts.map((s) => s.body).join('\n') + htmlNoCode);
  const hasReduced = /prefers-reduced-motion/i.test(allCss) || scripts.some((s) => /prefers-reduced-motion/i.test(s.body));
  if (usesMotion && !hasReduced) add('L02', 'error', 'page animates but has no prefers-reduced-motion handling');
  if (!usesMotion && !hasReduced) add('L02', 'info', 'no motion used; a prefers-reduced-motion block is still advised');
  for (const r of rules) {
    if (!/\[data-reveal/.test(r.selector)) continue;
    const hides = /opacity\s*:\s*0\b|visibility\s*:\s*hidden/.test(r.body);
    const gated = /(^|[\s,])(html)?\.js\b|\.js\s/.test(r.selector) || r.ctx.some((c) => /no-preference/.test(c)) || r.ctx.some((c) => /reduced-motion\s*:\s*reduce/.test(c));
    if (hides && !gated) add('L02', 'error', `rule "${r.selector.slice(0, 60)}" hides [data-reveal] content without a .js gate; no-JS readers would see nothing`, r.index);
  }

  // ── L03 focus + clickable semantics ──
  if (!/:focus-visible/.test(allCss)) add('L03', 'error', 'no :focus-visible rule; keyboard focus must be visible');
  for (const m of htmlNoCode.matchAll(/<(div|span|li|p|section|article|td)\b[^>]*\sonclick\s*=/gi)) add('L03', 'error', `<${m[1]} onclick> is not keyboard operable; use <button> or <a>`, m.index);
  for (const m of htmlNoCode.matchAll(/<(div|span)\b[^>]*\srole\s*=\s*["']button["'][^>]*>/gi)) if (!/tabindex/i.test(m[0])) add('L03', 'warn', `<${m[1]} role="button"> without tabindex`, m.index);

  // ── L04 painted background and theme-block discipline ──
  const bodyRule = rules.filter((r) => /(^|,)\s*(body|html)\s*($|,|\s)/.test(r.selector)).find((r) => /(^|;)\s*background(-color)?\s*:/.test(';' + r.body));
  if (!bodyRule) add('L04', 'error', 'body/html has no explicit background; a transparent body borrows the host theme');
  else {
    const bgDecl = declsOf(bodyRule.body).find(([k]) => k === 'background' || k === 'background-color');
    if (bgDecl && !/var\(\s*--/.test(bgDecl[1])) add('L04', 'error', `body background "${bgDecl[1]}" is a literal; paint it from a token (var(--bg))`, bodyRule.index);
  }
  const usedVars = new Set(); for (const m of (allCss + htmlNoCode).matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) usedVars.add(m[1]);
  for (const v of usedVars) if (!(v in baseTokens) && (v in darkTokens || v in lightTokens)) add('L04', 'error', `token ${v} is defined only inside a theme block; define it on bare :root first`);
  for (const r of rules) if (r.ctx.some((c) => /prefers-color-scheme/.test(c)) || /\[data-theme/.test(r.selector)) for (const [k] of declsOf(r.body)) if (k && !k.startsWith('--')) { add('L04', 'warn', `theme block "${r.selector.slice(0, 40)}" sets ${k}; theme blocks should only redefine tokens`, r.index); break; }

  // ── L05 palette drift ──
  const inlinedRanges = [...html.matchAll(/<!--\s*(?:qsdlc-present|html-motion):start[\s\S]*?<!--\s*(?:qsdlc-present|html-motion):end\s*-->/g)].map((m) => [m.index, m.index + m[0].length]);
  const inInlined = (idx) => inlinedRanges.some(([a, b]) => idx >= a && idx <= b);
  const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
  const colorSpots = [];
  for (const s of styles) for (const m of s.css.matchAll(hexRe)) if (!inInlined(s.off + m.index)) colorSpots.push({ v: m[0], idx: s.off + m.index });
  for (const m of htmlNoCode.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) for (const h of m[1].matchAll(hexRe)) if (!inInlined(m.index)) colorSpots.push({ v: h[0], idx: m.index });
  for (const m of htmlNoCode.matchAll(/\s(?:fill|stroke|stop-color|flood-color|color)\s*=\s*["'](#[0-9a-fA-F]{3,8})["']/gi)) if (!inInlined(m.index)) colorSpots.push({ v: m[1], idx: m.index });
  for (const s of scripts) for (const m of s.body.matchAll(/["'](#[0-9a-fA-F]{6})["']/g)) if (!inInlined(s.off + m.index)) colorSpots.push({ v: m[1], idx: s.off + m.index });
  const norm = (h) => { const c = parseColor(h); return c ? toHex(c) : null; };
  if (brand && brand.boundColors) {
    const bound = new Set(brand.boundColors.map((x) => x.toUpperCase()));
    const boundRgb = [...bound].map((h) => ({ h, c: parseColor(h) }));
    const seen = new Set();
    for (const s of colorSpots) {
      const n = norm(s.v); if (!n || bound.has(n) || seen.has(n)) continue; seen.add(n);
      const near = boundRgb.map((b) => ({ h: b.h, d: Math.hypot(b.c.r - parseColor(n).r, b.c.g - parseColor(n).g, b.c.b - parseColor(n).b) })).sort((a, b) => a.d - b.d)[0];
      add('L05', 'error', `colour ${s.v} is not in the bound palette${near ? ` (nearest bound: ${near.h})` : ''}`, s.idx);
    }
  } else {
    const baseDefs = new Set(decls.filter((d) => d.name.startsWith('--')).map((d) => d.value.toLowerCase()));
    const stray = colorSpots.filter((s) => !baseDefs.has(s.v.toLowerCase()));
    if (stray.length > 3) add('L05', 'warn', `${stray.length} colour literals outside token definitions (first: ${stray[0].v}); use var(--token). Pass --brand to run the full drift check`, stray[0].idx);
  }

  // ── L06 radius scale + shadow ──
  const scale = new Set((brand && brand.shape && brand.shape.radiusScale ? brand.shape.radiusScale : opts.radiusScale || ['0', '2px']).map(String));
  for (const r of rules) for (const [k, v] of declsOf(r.body)) {
    if (/^border(-\w+)*-radius$/.test(k)) {
      for (const tok of v.replace(/var\([^)]*\)/g, 'var()').replace(/\/.*$/, '').split(/\s+/).filter(Boolean)) {
        if (/^var\(/.test(tok) || tok === 'inherit' || tok === '0' || tok === '50%' || /^calc\(/.test(tok)) continue;
        if (!scale.has(tok)) add('L06', 'error', `border-radius ${tok} is outside the radius scale [${[...scale].join(', ')}]; use var(--radius)`, r.index);
      }
    }
    if (k === 'box-shadow' && !/^none\b/i.test(v)) {
      const lvl = brand && brand.shape && brand.shape.shadow === 'none' ? 'error' : 'warn';
      add('L06', lvl, `box-shadow "${v.slice(0, 40)}" ${lvl === 'error' ? 'but the product is shadowless (hairlines, not shadows)' : '(check the product allows shadows)'}`, r.index);
    }
  }
  for (const m of htmlNoCode.matchAll(/\sstyle\s*=\s*"[^"]*border-radius\s*:\s*([^;"]+)/gi)) { const tok = m[1].trim().split(/\s+/)[0]; if (!/^var\(/.test(tok) && !scale.has(tok) && tok !== '0') add('L06', 'error', `inline border-radius ${tok} is outside the radius scale`, m.index); }

  // ── L07 slop tells ──
  for (const m of allCss.matchAll(/(?:-webkit-)?background-clip\s*:\s*text/gi)) add('L07', 'error', 'background-clip:text (gradient text) is banned', m.index);
  const emojiRe = /\p{Extended_Pictographic}/u;
  for (const m of htmlNoCode.matchAll(/<(h[1-6]|li|button|summary|th|td|p|span|a|div|strong|em|label)\b[^>]*>([^<]*)</gi)) if (emojiRe.test(m[2]) && /[\p{Extended_Pictographic}]/u.test(m[2])) { add('L07', 'error', `emoji used as a marker or icon in <${m[1]}>: "${m[2].trim().slice(0, 30)}"; use inline svg or a text glyph`, m.index); break; }
  const tokenFor = (name) => resolveVar(`var(${name})`, baseTokens);
  for (const m of allCss.matchAll(/(?:linear|radial|conic)-gradient\(([^;{}]*)\)/gi)) {
    const hues = []; for (const c of m[1].matchAll(/#[0-9a-fA-F]{3,8}\b|var\(\s*(--[\w-]+)[^)]*\)|rgba?\([^)]*\)|hsla?\([^)]*\)/g)) { const col = c[1] ? tokenFor(c[1]) : parseColor(c[0]); if (col) { const h = rgbToHsl(col); if (h.s > 0.2) hues.push(h.h); } }
    const purple = hues.some((h) => h >= 255 && h <= 300), blue = hues.some((h) => h >= 195 && h < 255);
    if (purple && blue && !(brand && brand.gradientAllowed)) add('L07', 'error', 'purple-to-blue gradient; allowed only where the product mark itself uses it (brand-bind gradientAllowed)', m.index);
  }

  // ── L08 svg + chart fallbacks ──
  for (const m of htmlNoCode.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi)) {
    if (/aria-hidden\s*=\s*["']true["']/i.test(m[1])) continue;
    const okRole = /role\s*=\s*["'](img|graphics-document)["']/i.test(m[1]);
    const okTitle = /<title\b[^>]*>[\s\S]*?\S[\s\S]*?<\/title>/i.test(m[2]);
    if (!okRole || !okTitle) add('L08', 'error', `<svg> needs aria-hidden="true" or role="img" with a <title>${!okRole ? ' (missing role)' : ''}${!okTitle ? ' (missing title)' : ''}`, m.index);
  }
  for (const m of htmlNoCode.matchAll(/<(figure|div|section)\b[^>]*class\s*=\s*["'][^"']*\bkit-chart\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)) if (!/<details\b/i.test(m[2])) add('L08', 'error', 'chart has no <details> table fallback', m.index);
  for (const s of jsonScripts) { const dc = /data-chart\s*=\s*["'](\w+)["']/i.exec(s.attrs); if (dc) { const after = noComments.slice(s.off + s.body.length, s.off + s.body.length + 6000); if (!/class\s*=\s*["'][^"']*\bkit-chart\b/.test(after) && !/data-chart-target/i.test(s.attrs)) add('L08', 'warn', `data-chart="${dc[1]}" is rendered only by JS; run inline.mjs --render to pre-render it so it shows without JS`, s.off); } }

  // ── tag walker for L10 / L12 ──
  const stack = []; const tags = []; const tagRe = /<(\/)?([a-zA-Z][\w:-]*)([^>]*?)(\/)?>/g; let tm;
  while ((tm = tagRe.exec(htmlNoCode))) {
    const [, closing, nameRaw, attrs, self] = tm; const name = nameRaw.toLowerCase();
    if (closing) { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].name === name) { stack.length = i; break; } continue; }
    const rec = { name, attrs, idx: tm.index, ancestors: stack.map((a) => a) }; tags.push(rec);
    if (!self && !VOID.has(name)) stack.push({ name, attrs });
  }
  const scrollClasses = new Set();
  for (const r of rules) if (/overflow(-x)?\s*:\s*(auto|scroll)/.test(r.body)) for (const c of r.selector.matchAll(/\.([\w-]+)/g)) scrollClasses.add(c[1]);
  const scrolls = (a) => /overflow(-x)?\s*:\s*(auto|scroll)/i.test(a.attrs) || [...(/class\s*=\s*["']([^"']+)["']/i.exec(a.attrs) || [, ''])[1].split(/\s+/)].some((c) => scrollClasses.has(c));
  for (const t of tags) if (t.name === 'table' || t.name === 'pre') {
    const scroller = [t, ...t.ancestors.slice().reverse()].find(scrolls);
    if (!scroller) add('L10', 'error', `<${t.name}> is not inside an overflow-x:auto wrapper (e.g. .table-wrap); the page must never scroll sideways`, t.idx);
    else if (!/\btabindex\s*=\s*["']?0/i.test(scroller.attrs)) add('L10', 'error', `the scrolling wrapper of this <${t.name}> needs tabindex="0" so keyboard users can scroll it (e.g. <div class="table-wrap" tabindex="0">)`, t.idx);
  }
  for (const r of rules) for (const [k, v] of declsOf(r.body)) if (k === 'width' && /^(\d+)px$/.test(v) && Number(v.slice(0, -2)) >= 760 && !r.ctx.some((c) => /print/.test(c))) add('L10', 'warn', `fixed width ${v} on "${r.selector.slice(0, 40)}" can overflow a phone viewport; use max-width`, r.index);

  // ── L11 scroll-snap ──
  for (const m of allCss.matchAll(/scroll-snap-type\s*:\s*([^;}]+)/gi)) if (/mandatory/i.test(m[1])) add('L11', 'error', 'scroll-snap-type: mandatory traps readers; use proximity', m.index);

  // ── L12 document basics ──
  if (!/<html\b[^>]*\slang\s*=\s*["'][\w-]+["']/i.test(htmlNoCode)) add('L12', 'error', '<html> has no lang attribute');
  const headM = /<head\b[\s\S]*?<\/head>/i.exec(htmlNoCode); // an <svg><title> must not satisfy the document title
  const titleM = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(headM ? headM[0] : htmlNoCode.replace(/<svg\b[\s\S]*?<\/svg>/gi, '')); if (!titleM || !titleM[1].trim()) add('L12', 'error', 'missing or empty <title>');
  if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(htmlNoCode)) add('L12', 'error', 'missing viewport meta');
  const hs = tags.filter((t) => /^h[1-6]$/.test(t.name)); const h1s = hs.filter((t) => t.name === 'h1');
  if (h1s.length !== 1) add('L12', 'error', `expected exactly one <h1>, found ${h1s.length}`);
  let prevLevel = 0; for (const h of hs) { const lv = Number(h.name[1]); if (prevLevel && lv > prevLevel + 1) { add('L12', 'warn', `heading level jumps from h${prevLevel} to h${lv}`, h.idx); break; } prevLevel = lv; }

  if (opts.ambient) {
    if (!/<main\b|role\s*=\s*["']main["']/i.test(htmlNoCode)) add('L12', 'error', 'ambient page needs a <main> landmark around its status text');
    if (/<(a|button|input|select|textarea)\b/i.test(htmlNoCode)) add('L03', 'warn', 'ambient pages should have nothing interactive (pointer-events: none); a control here needs a focus style and a reason');
  }

  // ── L13 size ──
  if (bytes > 16 * 1024 * 1024) add('L13', 'error', `file is ${(bytes / 1048576).toFixed(1)} MB, over the 16 MB hard limit for a published Artifact`);
  else if (bytes > maxKb * 1024) add('L13', 'error', `file is ${(bytes / 1024).toFixed(0)} KB, over the ${maxKb} KB budget`);

  // ── L14 data-source + illustrative ──
  const keys = new Set(), ids = new Set();
  const collect = (o, p) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { keys.add(k); keys.add(p ? `${p}.${k}` : k); collect(v, p ? `${p}.${k}` : k); } };
  let illustrative = /data-illustrative/i.test(htmlNoCode);
  for (const s of jsonScripts) {
    const idm = /\sid\s*=\s*["']([^"']+)["']/i.exec(s.attrs); if (idm) { ids.add(idm[1]); keys.add(idm[1]); }
    try { const j = JSON.parse(s.body); collect(j, idm ? idm[1] : ''); if (/"illustrative"\s*:\s*true/.test(s.body)) illustrative = true; } catch { add('L14', 'error', `embedded JSON${idm ? ' #' + idm[1] : ''} does not parse`, s.off); }
  }
  for (const m of htmlNoCode.matchAll(/\sdata-source\s*=\s*["']([^"']+)["']/gi)) for (const ref of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
    const last = ref.split(/[.#/]/).pop();
    if (ref === 'illustrative') { illustrative = true; continue; } // the visible label is enforced below
    if (ref === 'placeholder') { add('L14', 'warn', 'data-source="placeholder" is still in the page; replace it with the real source of this number', m.index); continue; }
    if (ref === 'unspecified') { add('L14', 'warn', 'data-source="unspecified": give the chart a source (a file name or a key in the embedded JSON)', m.index); continue; }
    if (!keys.has(ref) && !keys.has(last) && !ids.has(ref) && !/^[\w.-]+\.(md|json|csv)(#.*)?$/.test(ref)) add('L14', 'error', `data-source="${ref}" does not resolve to a key in the embedded JSON (or a source file name)`, m.index);
  }
  for (const m of htmlNoCode.matchAll(/<(\w+)\b([^>]*class\s*=\s*["'][^"']*\b(?:numeral|kpi)\b[^"']*["'][^>]*)>([^<]*\d[^<]*)</gi)) if (!/data-source/.test(m[2]) && !/data-illustrative/.test(m[2])) add('L14', 'warn', `number "${m[3].trim().slice(0, 24)}" has no data-source; every stat must cite where it comes from`, m.index);
  if (illustrative && !/illustrative/i.test(bodyText)) add('L14', 'error', 'data is marked illustrative but no visible "illustrative" label is on the page');

  // ── L09 contrast of token pairs used for text ──
  const modes = [['base', baseTokens]]; if (hasDark) modes.push(['dark', { ...baseTokens, ...darkTokens }]); if (hasLight) modes.push(['light', { ...baseTokens, ...lightTokens }]);
  const bodyBgVal = bodyRule ? (declsOf(bodyRule.body).find(([k]) => k === 'background' || k === 'background-color') || [])[1] : null;
  const seenPairs = new Set();
  for (const [modeName, map] of modes) {
    const pageBg = bodyBgVal ? resolveVar(bodyBgVal, map) : null;
    for (const r of rules) {
      if (r.ctx.some((c) => /print/.test(c))) continue;
      const ds = declsOf(r.body); const colorD = ds.find(([k]) => k === 'color'); if (!colorD) continue;
      const bgD = ds.find(([k]) => k === 'background' || k === 'background-color'); const bgc = (bgD && colorWithAlpha(bgD[1], map, pageBg)) || pageBg; if (!bgc) continue;
      const fg = colorWithAlpha(colorD[1], map, bgc); if (!fg) continue;
      const fs_ = ds.find(([k]) => k === 'font-size'); const px = fs_ ? (/([\d.]+)px/.exec(fs_[1]) ? Number(/([\d.]+)px/.exec(fs_[1])[1]) : /([\d.]+)rem/.exec(fs_[1]) ? Number(/([\d.]+)rem/.exec(fs_[1])[1]) * 16 : null) : null;
      const bold = ds.find(([k]) => k === 'font-weight'); const isBold = bold && /^(bold|[6-9]00)$/.test(bold[1]);
      const large = px != null && (px >= 24 || (px >= 18.66 && isBold));
      const need = large ? 3 : 4.5; const cr = contrast(fg, bgc);
      const key = `${modeName}|${r.selector}|${colorD[1]}`; if (seenPairs.has(key)) continue; seenPairs.add(key);
      if (cr < need) add('L09', 'error', `${modeName === 'base' ? '' : modeName + ' theme: '}"${r.selector.slice(0, 40)}" text ${toHex(fg)} on ${toHex(bgc)} is ${cr.toFixed(2)}:1, needs ${need}:1${px ? ` at ${px}px` : ''}`, r.index);
    }
  }

  // ── L15 claims (opt-in) ──
  if (opts.claims) {
    const words = /\b(seamless(ly)?|instant(ly)?|100\s?%|fully[- ]automated|effortless(ly)?|revolutionary|best[- ]in[- ]class|zero[- ]effort|guaranteed?|never fails?|magic(al)?|game[- ]changing|blazing(ly)?|lightning[- ]fast|world[- ]class|cutting[- ]edge|eliminates? all)\b/gi;
    const seen = new Set();
    for (const m of bodyText.matchAll(words)) { const k = m[0].toLowerCase(); if (seen.has(k)) continue; seen.add(k); const idx = htmlNoCode.indexOf(m[0]); add('L15', 'warn', `claim word "${m[0]}" needs evidence in eval.md or softer copy (now / available / in progress)`, idx); }
  }

  // ── L16 brand-source ──
  const bs = /<meta\b[^>]*name\s*=\s*["']brand-source["'][^>]*content\s*=\s*["']([^"']*)["']/i.exec(htmlNoCode);
  if (!bs) add('L16', 'warn', 'no <meta name="brand-source">; add the probe result (a path, or "unbranded")');
  else if (/unbranded/i.test(bs[1])) add('L16', 'warn', 'artifact uses the UNBRANDED neutral fallback; confirm with the user or point the probe at a brand source');

  const errors = findings.filter((f) => f.level === 'error').length, warnings = findings.filter((f) => f.level === 'warn').length;
  return { file: opts.file || null, bytes, errors, warnings, findings };
}

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase()); if (['claims', 'json', 'strict', 'help', 'ambient'].includes(k)) o[k] = true; else o[k] = argv[++i]; } else o._.push(a); }
  return o;
}
function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || !a._.length) { console.error('usage: node lint.mjs <artifact.html> [--brand brand-bind.json] [--claims] [--ambient] [--max-kb 400] [--json] [--strict]'); process.exit(a.help ? 0 : 2); }
  let exit = 0; const reports = [];
  for (const file of a._) {
    let html; try { html = fs.readFileSync(file, 'utf8'); } catch (e) { console.error(`lint: cannot read ${file}: ${e.message}`); process.exit(2); }
    let brand = null; if (a.brand) { try { brand = JSON.parse(fs.readFileSync(a.brand, 'utf8')); } catch (e) { console.error(`lint: cannot read --brand ${a.brand}: ${e.message}`); process.exit(2); } }
    const rep = lint(html, { file, brand, claims: a.claims, maxKb: a.maxKb, ambient: a.ambient }); reports.push(rep);
    if (rep.errors || (a.strict && rep.warnings)) exit = 1;
  }
  if (a.json) console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
  else for (const r of reports) {
    for (const f of r.findings) console.log(`${path.basename(r.file)}: ${f.code} ${f.level}${f.line ? ' line ' + f.line : ''}: ${f.msg}`);
    console.log(`${path.basename(r.file)}: ${r.errors} error(s), ${r.warnings} warning(s), ${(r.bytes / 1024).toFixed(1)} KB`);
  }
  process.exit(exit);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
