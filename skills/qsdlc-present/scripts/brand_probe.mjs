#!/usr/bin/env node
// brand_probe.mjs — INSPECT + BIND. Reads a target project and writes brand-bind.json.
//
//   node brand_probe.mjs --root <project> [--slug <feature>] [--out file] [--css] [--sources file] [--mode dark|light]
//
// Sources, strongest first (the first hit wins per field; conflicts are recorded, not hidden):
//   A  design docs: CLAUDE.md, AGENTS.md, DESIGN.md, docs/**/*design*|*brand*, "HTML Design Standard*.md",
//      plus extra roots from ~/.qsdlc/brand-sources.json  { "roots":[...], "files":[...], "byProject":{ "<abs>":{roots,files} } }
//   B  token files: tailwind.config.*, Tailwind v4 @theme, tokens.json (DTCG / style-dictionary), theme.ts|js, shadcn components.json
//   C  CSS custom properties in **/*.css and <style> blocks (:root, [data-theme], .dark, prefers-color-scheme)
//   D  brand assets: manifest theme_color, <meta name="theme-color">, favicon.svg / logo*.svg fills
//   E  type: @fontsource/*, next/font, font-family frequency, local woff2/ttf files
//   F  conventions: border-radius frequency, border widths, shadow use, icon family
//
// Output goes to stdout, or to --out, or (with --slug) to <root>/.qsdlc/<slug>/artifacts/.craft/brand-bind.json.
// Nothing else is ever written. .env*, node_modules and build output are never read.
// Exit codes: 0 bound · 2 usage/error · 3 no brand source found (output holds the labelled UNBRANDED fallback; ask the user).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ───────────────────────── colour maths ─────────────────────────
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
export const toHex = ({ r, g, b }) => ('#' + hex2(r) + hex2(g) + hex2(b)).toUpperCase();

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}
export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0; const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) {
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}
function oklchToRgb(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  const g = (x) => 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055);
  return { r: g(lin[0]), g: g(lin[1]), b: g(lin[2]) };
}
const num = (s) => (String(s).trim().endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));

/** parse hex, rgb(), hsl(), oklch() or a bare shadcn "H S% L%" triplet. Returns {r,g,b} or null. */
export function parseColor(input, allowTriplet = false) {
  if (typeof input !== 'string') return null;
  const s = input.trim().replace(/\s*!important$/, '');
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/i.exec(s);
  if (m) { const c = (v) => (v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v)); return { r: c(m[1]), g: c(m[2]), b: c(m[3]) }; }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(s);
  if (m) return hslToRgb(parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100);
  m = /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)/i.exec(s);
  if (m) { const L = num(m[1]); const C = m[2].endsWith('%') ? (parseFloat(m[2]) / 100) * 0.4 : parseFloat(m[2]); return oklchToRgb(L, C, parseFloat(m[3])); }
  if (allowTriplet) {
    m = /^([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%$/.exec(s);
    if (m) return hslToRgb(parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100);
  }
  return null;
}

export function luminance({ r, g, b }) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** shift lightness (keeping hue and saturation) away from the background until `min` contrast is met. */
export function ensureContrast(fg, bg, min = 4.5) {
  if (contrast(fg, bg) >= min) return fg;
  const { h, s, l } = rgbToHsl(fg);
  const lighten = luminance(bg) < 0.4;
  for (let i = 1; i <= 100; i++) {
    const cand = hslToRgb(h, s, clamp(l + (lighten ? i : -i) * 0.01, 0, 1));
    if (contrast(cand, bg) >= min) return cand;
  }
  return lighten ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
}
const ratio = (a, b) => Math.round(contrast(a, b) * 100) / 100;

// ───────────────────────── file system (bounded, safe) ─────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', 'vendor', '.venv', 'venv', '__pycache__', '.turbo', '.cache', 'out', 'target', '.svelte-kit', '.parcel-cache']);
const MAX_FILES = 4000, MAX_BYTES = 600 * 1024;
function walk(root, { includeQsdlc = false } = {}) {
  const out = [];
  const rec = (dir, depth) => {
    if (out.length >= MAX_FILES || depth > 9) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        if (e.name === '.qsdlc' && !includeQsdlc) continue;
        rec(full, depth + 1);
      } else if (e.isFile()) {
        if (/^\.env/i.test(e.name) || /secret|credential|\.pem$|\.key$/i.test(e.name)) continue;
        out.push(full);
      }
    }
  };
  rec(root, 0);
  return out;
}
function readSafe(file) {
  try { const st = fs.statSync(file); if (st.size > MAX_BYTES) return ''; return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}
const rel = (root, f) => path.relative(root, f).split(path.sep).join('/');

// ───────────────────────── CSS declaration scanner ─────────────────────────
/** Walks CSS text and returns custom-property declarations with context, section heading and trailing comment. */
export function scanCssVars(text, origin) {
  const decls = [];
  const stack = [];
  let buf = '', i = 0, line = 1, section = '', lastDecl = null, lastDeclLine = -1, lineStart = true;
  const ctxMode = () => {
    const s = stack.join(' ');
    if (/prefers-color-scheme\s*:\s*dark|\.dark\b|data-theme\s*=\s*["']?dark/i.test(s)) return 'dark';
    if (/prefers-color-scheme\s*:\s*light|data-theme\s*=\s*["']?light/i.test(s)) return 'light';
    return 'base';
  };
  const finish = () => {
    const t = buf.trim(); buf = '';
    const m = /^(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(t);
    if (m) { lastDecl = { name: m[1], value: m[2].trim(), line, mode: ctxMode(), selector: stack[stack.length - 1] || '', section, comment: '', origin }; decls.push(lastDecl); lastDeclLine = line; }
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2); const stop = end < 0 ? text.length : end;
      const body = text.slice(i + 2, stop).replace(/\s+/g, ' ').trim();
      if (lastDecl && lastDeclLine === line && buf.trim() === '') lastDecl.comment = body;
      else if (buf.trim() === '' && lineStart) section = body;
      line += (text.slice(i, stop).match(/\n/g) || []).length; i = stop + 2; continue;
    }
    if (ch === '"' || ch === "'") { const q = ch; let j = i + 1; while (j < text.length && text[j] !== q) { if (text[j] === '\\') j++; j++; } buf += text.slice(i, j + 1); i = j + 1; continue; }
    if (ch === '{') { stack.push(buf.trim().replace(/\s+/g, ' ')); buf = ''; }
    else if (ch === '}') { finish(); stack.pop(); }
    else if (ch === ';') finish();
    else buf += ch;
    if (ch === '\n') { line++; lineStart = true; } else if (!/\s/.test(ch)) lineStart = false;
    i++;
  }
  return decls;
}

function fencedBlocks(md) {
  const out = []; const re = /```[\w-]*\n([\s\S]*?)```/g; let m;
  while ((m = re.exec(md))) out.push({ text: m[1], offset: md.slice(0, m.index).split('\n').length });
  return out;
}
function styleBlocks(html) {
  const out = []; const re = /<style[^>]*>([\s\S]*?)<\/style>/gi; let m;
  while ((m = re.exec(html))) out.push({ text: m[1], offset: html.slice(0, m.index).split('\n').length });
  return out;
}

// ───────────────────────── tolerant JS object-literal parser (tailwind / theme files) ─────────────────────────
function braceMatch(s, open) {
  let depth = 0, q = null;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
function parseLiteral(s, i = 0) {
  const ws = () => { while (i < s.length) { if (/\s/.test(s[i])) i++; else if (s[i] === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; } else if (s[i] === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 2; } else break; } };
  const skipExpr = () => { let depth = 0; while (i < s.length) { const c = s[i]; if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) { if (depth === 0) return null; depth--; } else if (c === ',' && depth === 0) return null; else if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; } } i++; } return null; };
  const value = () => {
    ws();
    const c = s[i];
    if (c === '{') {
      i++; const o = {};
      for (;;) {
        ws(); if (s[i] === '}') { i++; return o; } if (i >= s.length) return o;
        let key;
        if (s[i] === '"' || s[i] === "'") { const q = s[i++]; const st = i; while (i < s.length && s[i] !== q) i++; key = s.slice(st, i); i++; }
        else { const m = /^[\w$-]+/.exec(s.slice(i)); if (!m) { i++; continue; } key = m[0]; i += key.length; }
        ws();
        if (s[i] === ':') { i++; o[key] = value(); } else if (s[i] === ',' || s[i] === '}') o[key] = null; else { skipExpr(); }
        ws(); if (s[i] === ',') i++;
      }
    }
    if (c === '[') { i++; const a = []; for (;;) { ws(); if (s[i] === ']') { i++; return a; } if (i >= s.length) return a; a.push(value()); ws(); if (s[i] === ',') i++; } }
    if (c === '"' || c === "'" || c === '`') { const q = c; i++; const st = i; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; } const v = s.slice(st, i); i++; ws(); if (s[i] && !',}]'.includes(s[i])) skipExpr(); return v; }
    const m = /^-?[\d.]+/.exec(s.slice(i));
    if (m && !/^[\w$]/.test(s[i + m[0].length] || '')) { i += m[0].length; return Number(m[0]); }
    skipExpr(); return null;
  };
  return value();
}
function flatten(obj, prefix = '', out = {}) {
  if (obj == null) return out;
  if (typeof obj === 'string' || typeof obj === 'number') { out[prefix] = obj; return out; }
  if (Array.isArray(obj)) { out[prefix] = obj.filter((x) => typeof x === 'string').join(', '); return out; }
  for (const [k, v] of Object.entries(obj)) flatten(v, k === 'DEFAULT' ? prefix : prefix ? `${prefix}-${k}` : k, out);
  return out;
}
function extractObjectKey(src, key) {
  const re = new RegExp(`\\b${key}\\s*:\\s*\\{`, 'g'); const m = re.exec(src);
  if (!m) return null;
  const open = m.index + m[0].length - 1; const close = braceMatch(src, open);
  if (close < 0) return null;
  return { value: parseLiteral(src.slice(open, close + 1)), line: src.slice(0, m.index).split('\n').length };
}

// ───────────────────────── candidate collection ─────────────────────────
const ROLE_WORDS = {
  bg: [/^(bg|background|canvas|ground|page|base|body|surface-0)(-(color|default|base))?$/, /page background|background of the page|\bground\b|main background/],
  surface: [/^(surface|card|panel|raised|elevated|bg-2|ink-2|surface-1|popover|card-bg)$/, /raised|\bcard\b|elevated|\bpanel\b/],
  panel: [/^(ink-3|surface-2|bg-3|hover|selected|muted-bg|secondary)$/, /hover|selected|pressed/],
  line: [/(line|border|rule|divider|hairline|stroke|outline)/, /hairline|\bborder\b|\brule\b|divider/],
  ink: [/^(ink|ink-text|text|foreground|fg|body|paper|on-surface|text-primary|text-default|content)$/, /body text|primary text|off-white|main text/],
  muted: [/(muted|dim|secondary-text|subtle|far|caption|label|text-2|text-muted|text-secondary|dimmed)/, /secondary|labels?|captions?|quiet/],
  brand: [/(brand|primary|logo)/, /\bbrand\b|from the mark|\bmark\b/],
  accent: [/^(accent|highlight|secondary|brass|gold)$|accent/, /\baccent\b/],
  ok: [/(^|-)(ok|success|good|positive|green|pass)($|-)/, /success|\bgood\b|positive/],
  warn: [/(^|-)(warn|warning|caution|amber|yellow)($|-)/, /warning|caution/],
  risk: [/(^|-)(risk|danger|error|critical|destructive|bad|negative|red|fail)($|-)/, /danger|error|critical|destructive/]
};
const baseName = (n) => n.replace(/^--/, '').replace(/^(color|colors|clr)-/, '').toLowerCase();
function roleScore(role, c) {
  const [nameRe, textRe] = ROLE_WORDS[role];
  const n = baseName(c.name);
  let s = 0;
  if (nameRe.test(n)) s += 10;
  if (textRe.test(`${c.comment || ''}`.toLowerCase())) s += 8;
  if (textRe.test(`${c.section || ''}`.toLowerCase())) s += 5;
  if (role === 'line' && /(-2|strong|emph|focus)/.test(n)) s -= 4;
  if (role === 'ink' && /(dim|far|muted|subtle)/.test(n)) s -= 8;
  if (role === 'accent' && /brand|primary/.test(n)) s -= 6;
  return s;
}

function docFiles(root, extra) {
  const files = new Set();
  const addIf = (f) => { if (fs.existsSync(f) && fs.statSync(f).isFile()) files.add(path.resolve(f)); };
  ['CLAUDE.md', 'AGENTS.md', 'DESIGN.md', 'design.md', 'BRAND.md', 'brand.md', '.claude/CLAUDE.md'].forEach((n) => addIf(path.join(root, n)));
  for (const f of walk(root)) {
    const r = rel(root, f);
    if (/\.(md|mdx)$/i.test(f) && (/(^|\/)docs?\/.*(design|brand|style)/i.test(r) || /HTML Design Standard/i.test(path.basename(f)) || /(^|\/)(design|brand)[^/]*\.md$/i.test(r))) files.add(f);
  }
  for (const r of extra.roots || []) {
    try { for (const f of walk(r)) if (/\.(md|mdx)$/i.test(f) && /(design|brand|style|standard)/i.test(path.basename(f))) files.add(f); } catch { /* unreadable root */ }
  }
  for (const f of extra.files || []) addIf(f);
  return [...files];
}

function loadExtraSources(root, sourcesPath) {
  const p = sourcesPath || path.join(os.homedir(), '.qsdlc', 'brand-sources.json');
  const empty = { roots: [], files: [], path: null };
  try {
    if (!fs.existsSync(p)) return empty;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const by = (j.byProject && (j.byProject[root] || j.byProject[root.replace(/\\/g, '/')])) || {};
    return { roots: [...(j.roots || []), ...(by.roots || [])], files: [...(j.files || []), ...(by.files || [])], path: p };
  } catch { return empty; }
}

// ───────────────────────── the probe ─────────────────────────
export function probe(rootArg, opts = {}) {
  const root = path.resolve(rootArg);
  const extra = loadExtraSources(root, opts.sources);
  const files = walk(root);
  const cands = [];           // colour candidates {name,value,rgb,tier,source,comment,section,mode,usage}
  const usage = new Map();
  const typeVars = {};        // --display/--sans/--mono etc
  const rules = [], antiPatterns = [], conflicts = [], gaps = [], sourcesRead = [];
  const radiusCount = new Map(); let shadowCount = 0, borderWidths = new Map();
  const radiusVars = {}; // every --radius / --radius-sm|md|lg... custom property, any tier
  let darkOnlyHint = null, tailwind = null, shadcn = false, radiusDoc = null, shadowNoneDoc = false;
  const fontFamilies = new Map(); const embeddedFiles = []; const fontPkgs = [];
  let icons = 'inline-svg', manifestTheme = null;

  const addDecls = (decls, tier, originFile) => {
    for (const d of decls) {
      d.value = d.value.replace(/\s+/g, ' ');
      const source = `${originFile}:${d.line}`;
      if (/^--(font|display|sans|mono|serif)/.test(d.name) || /font-family/.test(d.name)) { typeVars[baseName(d.name)] = { value: d.value, source, tier }; }
      if (/^--radius(-[\w]+)?$/.test(d.name) && d.mode !== 'dark' && /^[\d.]+(px|rem|em)$|^0$/.test(d.value) && !radiusVars[d.name]) radiusVars[d.name] = { value: d.value, source, tier };
      if (!radiusDoc && (d.name === '--radius' || (/^--radius/.test(d.name) && tier !== 'C')) && /^[\d.]+(px|rem|em)$|^0$/.test(d.value)) radiusDoc = { value: d.value, source };
      const triplet = shadcn || /^--(background|foreground|card|primary|secondary|muted|accent|destructive|border|input|ring|popover)(-foreground)?$/.test(d.name);
      const rgb = parseColor(d.value, triplet);
      if (rgb) cands.push({ name: d.name, value: toHex(rgb), rgb, tier, source, comment: d.comment, section: d.section, mode: d.mode });
    }
  };

  // Tier A — docs
  for (const f of docFiles(root, extra)) {
    const text = readSafe(f); if (!text) continue;
    const r = path.isAbsolute(rel(root, f)) || rel(root, f).startsWith('..') ? f.split(path.sep).join('/') : rel(root, f);
    sourcesRead.push({ tier: 'A', file: r });
    for (const b of fencedBlocks(text)) addDecls(scanCssVars(b.text, r).map((d) => ({ ...d, line: d.line + b.offset })), 'A', r);
    const lines = text.split('\n'); let inAnti = false;
    lines.forEach((ln, idx) => {
      if (/^#{1,4}\s/.test(ln)) inAnti = /anti-?pattern|banned|never do/i.test(ln);
      const bullet = /^\s*(?:[*-]|\d+\.)\s+(.*\S)/.exec(ln);
      if (bullet) {
        const t = bullet[1].replace(/\*\*/g, '').replace(/`/g, '').trim();
        if (inAnti && antiPatterns.length < 14) antiPatterns.push(t.replace(/\.$/, ''));
        else if (/\b(never|always|must|don'?t|do not|avoid|only|no\s+\w+|dominates)\b/i.test(t) && rules.length < 16 && t.length < 220) rules.push(t);
      }
      if (/(commit to dark|dark only|never.{0,40}light variant|build one world)/i.test(ln) && !darkOnlyHint) darkOnlyHint = `${r}:${idx + 1}`;
      const rd = /border-radius[^.\n]*?\b(\d+(?:\.\d+)?px|0)\b/i.exec(ln); if (rd && !radiusDoc) radiusDoc = { value: rd[1], source: `${r}:${idx + 1}` };
      if (/(no soft shadows|hairlines?,? not shadows|no shadows)/i.test(ln)) shadowNoneDoc = true;
    });
  }

  // Tier B — token files
  for (const f of files) {
    const base = path.basename(f), r = rel(root, f);
    if (/^tailwind\.config\.(js|ts|cjs|mjs)$/.test(base)) {
      tailwind = tailwind || 'v3'; sourcesRead.push({ tier: 'B', file: r });
      const src = readSafe(f);
      const colors = extractObjectKey(src, 'colors');
      if (colors) for (const [k, v] of Object.entries(flatten(colors.value))) { const rgb = parseColor(String(v)); if (rgb) cands.push({ name: k, value: toHex(rgb), rgb, tier: 'B', source: `${r}:${colors.line}`, comment: '', section: '', mode: 'base' }); }
      const ff = extractObjectKey(src, 'fontFamily');
      if (ff) for (const [k, v] of Object.entries(flatten(ff.value))) typeVars[k] = typeVars[k] || { value: String(v), source: `${r}:${ff.line}`, tier: 'B' };
      const br = extractObjectKey(src, 'borderRadius');
      if (br && !radiusDoc) { const fl = flatten(br.value); const v = fl.md || fl.DEFAULT || fl.sm || Object.values(fl)[0]; if (v) radiusDoc = { value: String(v), source: `${r}:${br.line}` }; }
    } else if (/^(tokens|design-tokens)\.json$/.test(base) || /\.tokens\.json$/.test(base)) {
      sourcesRead.push({ tier: 'B', file: r });
      try {
        const j = JSON.parse(readSafe(f));
        const walkTok = (o, p) => { if (o && typeof o === 'object') { const v = o.$value ?? o.value; if (typeof v === 'string' && !(o.$type && o.$type !== 'color' && o.$type !== undefined && o.$type !== 'fontFamily')) { const rgb = parseColor(v); if (rgb) cands.push({ name: p.join('-'), value: toHex(rgb), rgb, tier: 'B', source: r, comment: '', section: p.slice(0, -1).join(' '), mode: 'base' }); } else for (const [k, x] of Object.entries(o)) if (!k.startsWith('$')) walkTok(x, [...p, k]); } };
        walkTok(j, []);
      } catch { gaps.push(`${r} is not valid JSON`); }
    } else if (base === 'components.json') {
      try { const j = JSON.parse(readSafe(f)); if (j.tailwind || j.style) { shadcn = true; sourcesRead.push({ tier: 'B', file: r }); } } catch { /* ignore */ }
    } else if (/^theme\.(ts|js|tsx|mjs)$/.test(base)) {
      sourcesRead.push({ tier: 'B', file: r });
      const src = readSafe(f); const re = /['"]?([\w-]+)['"]?\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/g; let m;
      while ((m = re.exec(src))) { const rgb = parseColor(m[2]); if (rgb) cands.push({ name: m[1], value: toHex(rgb), rgb, tier: 'B', source: `${r}:${src.slice(0, m.index).split('\n').length}`, comment: '', section: '', mode: 'base' }); }
    } else if (base === 'package.json') {
      try {
        const j = JSON.parse(readSafe(f)); const deps = { ...(j.dependencies || {}), ...(j.devDependencies || {}) };
        for (const d of Object.keys(deps)) { if (d.startsWith('@fontsource')) fontPkgs.push(d); if (/lucide|phosphor|heroicons|tabler|fontawesome|react-icons|feather/.test(d)) icons = d.replace(/^@/, '').split('/')[0].replace(/-react$/, ''); }
        if (deps.tailwindcss && !tailwind) tailwind = /^[\^~]?4/.test(deps.tailwindcss) ? 'v4' : 'v3';
        if (deps['next'] && /next\/font/.test(readSafe(f))) fontPkgs.push('next/font');
      } catch { /* ignore */ }
    }
  }

  // Tier C — CSS custom properties (+ html style blocks), also Tailwind v4 @theme, usage counts, conventions
  const styleSources = [];
  for (const f of files) { if (/\.(css|scss|pcss)$/i.test(f)) styleSources.push({ f, kind: 'css' }); else if (/\.html?$/i.test(f)) styleSources.push({ f, kind: 'html' }); }
  for (const { f, kind } of styleSources) {
    const text = readSafe(f); if (!text) continue; const r = rel(root, f);
    const blocks = kind === 'css' ? [{ text, offset: 0 }] : styleBlocks(text);
    if (!blocks.length) continue;
    sourcesRead.push({ tier: 'C', file: r });
    if (/@import\s+["']tailwindcss["']|@theme\b/.test(text)) tailwind = 'v4';
    else if (/@tailwind\s+base/.test(text) && !tailwind) tailwind = 'v3';
    for (const b of blocks) {
      const decls = scanCssVars(b.text, r).map((d) => ({ ...d, line: d.line + b.offset }));
      const tw = /@theme\b/.test(b.text);
      decls.forEach((d) => { if (tw && /^--color-/.test(d.name)) d.name = d.name; });
      addDecls(decls, 'C', r);
    }
    for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) usage.set(m[1], (usage.get(m[1]) || 0) + 1);
    for (const m of text.matchAll(/border-radius\s*:\s*([^;}\n]+)/gi)) { const v = m[1].trim().split(/\s+/)[0]; radiusCount.set(v, (radiusCount.get(v) || 0) + 1); }
    for (const m of text.matchAll(/box-shadow\s*:\s*([^;}\n]+)/gi)) if (!/^none\b/i.test(m[1].trim())) shadowCount++;
    for (const m of text.matchAll(/border(?:-\w+)?\s*:\s*(\d+(?:\.\d+)?px)/gi)) borderWidths.set(m[1], (borderWidths.get(m[1]) || 0) + 1);
    for (const m of text.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)) { const fam = m[1].trim(); if (!/^var\(/.test(fam)) fontFamilies.set(fam, (fontFamilies.get(fam) || 0) + 1); }
  }

  // Tier D — brand assets
  const manifest = files.find((f) => /(^|[\\/])manifest\.(web)?json$/i.test(f));
  if (manifest) { try { const j = JSON.parse(readSafe(manifest)); manifestTheme = { theme: j.theme_color, background: j.background_color, source: rel(root, manifest) }; sourcesRead.push({ tier: 'D', file: rel(root, manifest) }); for (const [k, v] of [['theme-color', j.theme_color], ['background-color', j.background_color]]) { const rgb = parseColor(v || ''); if (rgb) cands.push({ name: `manifest-${k}`, value: toHex(rgb), rgb, tier: 'D', source: rel(root, manifest), comment: '', section: 'brand', mode: 'base' }); } } catch { /* ignore */ } }
  for (const { f, kind } of styleSources) { if (kind !== 'html') continue; const t = readSafe(f); const m = /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i.exec(t); if (m) { const rgb = parseColor(m[1]); if (rgb) cands.push({ name: 'meta-theme-color', value: toHex(rgb), rgb, tier: 'D', source: rel(root, f), comment: '', section: 'brand', mode: 'base' }); } }
  for (const f of files) {
    if (!/(favicon|logo|mark)[^/\\]*\.svg$/i.test(f)) continue; const t = readSafe(f); const fills = new Map();
    for (const m of t.matchAll(/(?:fill|stroke)\s*[=:]\s*["']?(#[0-9a-fA-F]{3,8})/g)) { const rgb = parseColor(m[1]); if (rgb) fills.set(toHex(rgb), (fills.get(toHex(rgb)) || 0) + 1); }
    const top = [...fills.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) { cands.push({ name: `logo-${path.basename(f, '.svg')}`, value: top[0], rgb: parseColor(top[0]), tier: 'D', source: rel(root, f), comment: '', section: 'brand', mode: 'base' }); sourcesRead.push({ tier: 'D', file: rel(root, f) }); }
  }
  // Tier E — local fonts
  for (const f of files) if (/\.(woff2?|ttf|otf)$/i.test(f) && embeddedFiles.length < 12) embeddedFiles.push(rel(root, f));

  // ───── resolve conflicts and roles ─────
  const TIER_RANK = { A: 0, B: 1, C: 2, D: 3 };
  const byName = new Map();
  for (const c of cands.filter((c) => c.mode !== 'dark')) {
    const key = baseName(c.name); const prev = byName.get(key);
    if (!prev) byName.set(key, c);
    else if (prev.value !== c.value) {
      const better = TIER_RANK[c.tier] < TIER_RANK[prev.tier] ? c : prev; const other = better === c ? prev : c;
      if (!conflicts.find((x) => x.field === key)) conflicts.push({ field: key, values: [`${better.value} (${better.source}, tier ${better.tier}, used)`, `${other.value} (${other.source}, tier ${other.tier})`] });
      byName.set(key, better);
    }
  }
  const pool = [...byName.values()].map((c) => ({ ...c, uses: usage.get(c.name) || 0 }));
  const darkPool = cands.filter((c) => c.mode === 'dark');

  const pick = (role, filter = () => true, min = 8) => {
    const scored = pool.filter(filter).map((c) => ({ c, s: roleScore(role, c) })).filter((x) => x.s >= min);
    scored.sort((a, b) => b.s - a.s || TIER_RANK[a.c.tier] - TIER_RANK[b.c.tier] || b.c.uses - a.c.uses);
    return scored.length ? scored[0].c : null;
  };

  let bg = pick('bg') || pick('bg', () => true, 5);
  // a doc may call its page background "ink": the comment/section decides, handled by roleScore
  // Partial brand (text or brand colour found, but no ground): never crash. Use the neutral ground that suits the text, and record it.
  let syntheticBg = false;
  if (!bg) {
    const inkPre = pick('ink'), anyBrand = pool.some((c) => roleScore('brand', c) >= 5) || pick('accent');
    if (inkPre || anyBrand) {
      const lightText = inkPre && luminance(inkPre.rgb) > 0.4;
      const hex = (lightText ? UNBRANDED.dark : UNBRANDED.light).bg;
      bg = { name: 'bg', value: hex, rgb: parseColor(hex), tier: '-', source: 'neutral default', comment: '', section: '', mode: 'base' };
      syntheticBg = true;
      gaps.push(`no background token found: neutral ${lightText ? 'dark' : 'light'} ground ${hex} used${inkPre ? ' (chosen to suit the text colour ' + inkPre.value + ')' : ''}; confirm with the user`);
      conflicts.push({ field: 'bg', kind: 'missing', values: ['no background token in any source', `${hex} neutral default used`] });
    }
  }
  const bgRgb = bg ? bg.rgb : null;
  const withContrast = (min) => (c) => !bgRgb || contrast(c.rgb, bgRgb) >= min;
  const surface = pick('surface', (c) => c !== bg);
  const panel = pick('panel', (c) => c !== bg && c !== surface);
  const line = pick('line', (c) => c !== bg && c !== surface);
  const ink = pick('ink', (c) => c !== bg && withContrast(4.5)(c));
  const mutedAll = pool.filter((c) => c !== bg && c !== ink && withContrast(2)(c) && roleScore('muted', c) >= 8).sort((a, b) => roleScore('muted', b) - roleScore('muted', a));
  // prefer a candidate that already passes 4.5:1; every failing candidate is reported as a conflict
  const mutedRaw = mutedAll.filter((c) => !bgRgb || contrast(c.rgb, bgRgb) >= 4.5).sort((a, b) => contrast(a.rgb, bgRgb) - contrast(b.rgb, bgRgb))[0] || mutedAll[0] || null;
  const brandCands = pool.filter((c) => c !== bg && roleScore('brand', c) >= 5).sort((a, b) => luminance(a.rgb) - luminance(b.rgb));
  const brand = brandCands.length ? brandCands[Math.floor((brandCands.length - 1) / 2)] : null;
  const accentC = pick('accent', (c) => c !== brand && !brandCands.includes(c));
  const sem = { ok: pick('ok', (c) => c !== bg), warn: pick('warn', (c) => c !== bg), risk: pick('risk', (c) => c !== bg) };

  // confidence
  const roleHits = [bg, ink].filter(Boolean).length + [surface, line, brand || accentC].filter(Boolean).length;
  const tierOf = (c) => (c ? c.tier : null);
  let confidence = 'none';
  if (bg && ink && !syntheticBg) confidence = [bg, ink].every((c) => c.tier === 'A') && roleHits >= 4 ? 'A' : [bg, ink].every((c) => c.tier <= 'B') ? 'B' : 'C';
  else if (brand || accentC || ink) confidence = 'D';
  if (!(bg && ink) && (brand || accentC) && cands.some((c) => c.tier === 'A')) confidence = 'D';

  const mode = opts.mode || (bgRgb ? (luminance(bgRgb) < 0.25 ? 'dark' : 'light') : 'light');
  const hasBothThemes = darkPool.length > 0 && !darkOnlyHint;
  const result = {
    schema: 1, projectRoot: root.split(path.sep).join('/'), confidence,
    unbranded: false, tailwind: tailwind || null, shadcn,
    sourcesRead: sourcesRead.slice(0, 40), extraSources: extra.path,
    palette: {}, themes: null, theme: { mode: darkOnlyHint ? 'dark' : hasBothThemes ? 'both' : mode, lockedBy: darkOnlyHint || null },
    type: {}, shape: {}, icons: { family: icons, emojiAllowed: false },
    rules, antiPatterns, contrastReport: [], conflicts, gaps, ask: false
  };

  if (confidence === 'none' || !bg) {
    // fall back to the labelled neutral set and ask
    result.confidence = 'none'; result.unbranded = true; result.ask = true;
    result.gaps.push('no brand source found: the unbranded neutral set is a labelled fallback, ask the user before using it');
    fillUnbranded(result);
  } else {
    const P = result.palette; const put = (k, c, extraProps = {}) => { if (c) P[k] = { value: c.value, source: c.source, tier: c.tier, name: c.name, ...extraProps }; };
    put('bg', bg, syntheticBg ? { derived: true, why: 'no background token found: neutral default' } : {});
    // partial binding (confidence D): use what was found, but the user must confirm before the artifact is built
    if (confidence === 'D') { result.ask = true; result.gaps.push('partial brand: only some tokens were found (confidence D); ask the user to confirm or point at a fuller brand source'); }
    // derive anything the product did not define, from its own ground and brand hue
    const dark = luminance(bg.rgb) < 0.25;
    const shift = (rgb, dl) => { const h = rgbToHsl(rgb); return hslToRgb(h.h, h.s, clamp(h.l + dl, 0, 1)); };
    const derived = (k, rgb, why) => { P[k] = { value: toHex(rgb), source: 'derived', tier: '-', derived: true, why }; };
    if (surface) put('surface', surface); else derived('surface', shift(bg.rgb, dark ? 0.04 : -0.03), 'no surface token found: stepped from bg');
    if (panel) put('panel', panel); else derived('panel', shift(parseColor(P.surface.value), dark ? 0.04 : -0.03), 'no hover/selected token found: stepped from surface');
    if (line) put('line', line); else derived('line', shift(parseColor(P.surface.value), dark ? 0.12 : -0.12), 'no hairline token found: stepped from surface');
    if (ink) put('ink', ink); else derived('ink', ensureContrast(dark ? { r: 240, g: 240, b: 240 } : { r: 20, g: 20, b: 20 }, bg.rgb, 7), 'no text token found');
    const inkRgb = parseColor(P.ink.value);
    // muted: never use a doc value that fails 4.5:1 for small text; emit a text-safe variant with provenance
    for (const c of mutedAll) {
      const r0 = ratio(c.rgb, bg.rgb);
      if (r0 < 4.5) result.conflicts.push({ field: baseName(c.name), values: [`${c.value} (${c.source}) = ${r0}:1 on bg, fails 4.5:1 for small text`, `${toHex(ensureContrast(c.rgb, bg.rgb, 4.5))} text-safe variant to use instead`], kind: 'contrast' });
    }
    if (mutedRaw) {
      const safe = ensureContrast(mutedRaw.rgb, bg.rgb, 4.5);
      const r0 = ratio(mutedRaw.rgb, bg.rgb);
      put('muted', { ...mutedRaw, value: toHex(safe) }, { docValue: mutedRaw.value, docContrast: r0, textSafe: r0 < 4.5 });
    } else derived('muted', ensureContrast(shift(inkRgb, dark ? -0.25 : 0.25), bg.rgb, 4.5), 'no secondary text token found: stepped from ink');
    // brand and hi
    if (brand) {
      put('brand', brand, { role: 'rules and lines; text uses textSafe' });
      const safe = ensureContrast(brand.rgb, bg.rgb, 4.5);
      const alt = brandCands.filter((c) => contrast(c.rgb, bg.rgb) >= 4.5).sort((a, b) => contrast(a.rgb, bg.rgb) - contrast(b.rgb, bg.rgb))[0];
      const hiRgb = alt ? alt.rgb : safe;
      P.brand.textSafe = toHex(hiRgb);
      P.hi = { value: toHex(hiRgb), source: alt ? alt.source : 'derived from brand', tier: alt ? alt.tier : '-', derived: !alt, name: alt ? alt.name : brand.name };
    } else if (accentC) { put('hi', accentC); const s = ensureContrast(accentC.rgb, bg.rgb, 4.5); P.hi.value = toHex(s); }
    else { const base = rgbToHsl(inkRgb); derived('hi', ensureContrast(hslToRgb(190, 0.6, dark ? 0.6 : 0.35), bg.rgb, 4.5), 'no brand or accent colour found: neutral accent, ask the user'); result.gaps.push('no brand/accent colour defined'); void base; }
    if (accentC && brand) put('accent', accentC);
    // semantic colours
    const hue = rgbToHsl(parseColor(P.hi.value)); const sat = clamp(hue.s || 0.6, 0.45, 0.8);
    const semSet = (k, c, h) => {
      if (c) { const safe = ensureContrast(c.rgb, bg.rgb, 4.5); P[k] = { value: toHex(safe), source: c.source, tier: c.tier, name: c.name, ...(toHex(safe) !== c.value ? { docValue: c.value, textSafe: true } : {}) }; }
      else P[k] = { value: toHex(ensureContrast(hslToRgb(h, sat, dark ? 0.62 : 0.34), bg.rgb, 4.5)), source: 'derived', tier: '-', derived: true, why: 'no semantic token found: computed and checked for 4.5:1' };
    };
    semSet('ok', sem.ok, 145); semSet('warn', sem.warn, 40); semSet('risk', sem.risk, 5);
    // alt: the engine's second accent. Accent colour if the product has one, else the warn tone, else derived.
    if (accentC && accentC !== sem.warn) { const s = ensureContrast(accentC.rgb, bg.rgb, 4.5); P.alt = { value: toHex(s), source: accentC.source, tier: accentC.tier, name: accentC.name }; }
    else P.alt = { ...P.warn, derived: true, why: 'engine --alt taken from the warn tone' };
    // dark-block overrides (themes)
    if (hasBothThemes) {
      const dm = {}; for (const c of darkPool) dm[baseName(c.name)] = c.value;
      result.themes = { darkOverrides: dm };
    }
    // type
    const T = result.type;
    const pickT = (...keys) => { for (const k of keys) if (typeVars[k]) return typeVars[k]; return null; };
    const disp = pickT('display', 'font-display', 'serif', 'heading', 'font-heading'); const sans = pickT('sans', 'font-sans', 'body', 'font-body', 'font'); const mono = pickT('mono', 'font-mono', 'code');
    const SYS_SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    const SYS_MONO = 'ui-monospace, "Cascadia Code", "SF Mono", Consolas, "Liberation Mono", monospace';
    const topFam = [...fontFamilies.entries()].sort((a, b) => b[1] - a[1])[0];
    T.display = disp ? disp.value : sans ? sans.value : topFam ? topFam[0] : SYS_SANS;
    T.sans = sans ? sans.value : topFam ? topFam[0] : SYS_SANS;
    T.mono = mono ? mono.value : SYS_MONO;
    T.embeddedFiles = embeddedFiles; T.fontPackages = [...new Set(fontPkgs)];
    T.source = (disp || sans || mono || {}).source || (topFam ? 'css font-family frequency' : 'system stacks (no product type found)');
    if (!disp && !sans && !topFam) result.gaps.push('no product type found: system stacks used');
  }

  // shape (common to both paths)
  const rc = [...radiusCount.entries()].sort((a, b) => b[1] - a[1]);
  // radius precedence: a documented value, then the product's own --radius / --radius-md custom properties, then border-radius frequency, then the 2px default (recorded as a gap)
  const px = (v) => (/rem|em/.test(v) ? parseFloat(v) * 16 : parseFloat(v));
  const rvEntries = Object.entries(radiusVars).sort((a, b) => px(a[1].value) - px(b[1].value));
  const rvPick = radiusVars['--radius'] || radiusVars['--radius-md'] || radiusVars['--radius-base'] || radiusVars['--radius-default'] || (rvEntries.length ? rvEntries[Math.floor((rvEntries.length - 1) / 2)][1] : null);
  const radiusSel = radiusDoc || rvPick;
  const radiusVal = radiusSel ? radiusSel.value : rc.length ? rc[0][0] : '2px';
  if (!radiusSel && !rc.length && !result.unbranded) {
    result.gaps.push('no border-radius found in any source (no --radius token, no border-radius rules): 2px default used');
    result.conflicts.push({ field: 'radius', kind: 'missing', values: ['no radius defined by the product', '2px default used'] });
  }
  const scale = [...new Set([radiusVal, ...rvEntries.map((e) => e[1].value), ...(radiusSel ? [] : rc.map((x) => x[0]))].filter(Boolean))].map(String);
  if (!scale.includes('0')) scale.unshift('0');
  const bw = [...borderWidths.entries()].sort((a, b) => b[1] - a[1]);
  result.shape = {
    radius: radiusVal, radiusSource: radiusSel ? radiusSel.source : rc.length ? 'css border-radius frequency' : 'default',
    radiusScale: [...new Set(scale)].filter((v) => !Number.isNaN(px(v))).sort((a, b) => px(a) - px(b)),
    border: bw.length ? bw[0][0] : '1px',
    shadow: shadowNoneDoc || shadowCount === 0 ? 'none' : 'some'
  };
  if (result.unbranded) { result.shape.radius = '2px'; result.shape.radiusScale = ['0', '2px']; result.shape.border = '1px'; result.shape.shadow = 'none'; }

  // contrast report on every pair used at small size
  const P = result.palette; const rgbOf = (k) => (P[k] ? parseColor(P[k].value) : null);
  // text-safe pass: every text colour must hold 4.5:1 on the ground AND on the raised surface, or it is lifted (same hue) and recorded
  if (!result.unbranded) {
    for (const k of ['ink', 'muted', 'hi', 'ok', 'warn', 'risk', 'alt']) {
      const e = P[k]; if (!e) continue;
      let rgb = parseColor(e.value), changed = false;
      for (let pass = 0; pass < 2; pass++) for (const g of ['bg', 'surface']) { const gr = rgbOf(g); if (gr && contrast(rgb, gr) < 4.5) { rgb = ensureContrast(rgb, gr, 4.5); changed = true; } }
      if (changed) { e.docValue = e.docValue || e.value; e.value = toHex(rgb); e.textSafe = true; }
    }
  }
  const pairs =[['ink', 'bg', '14-16px body'], ['ink', 'surface', '14-16px body on cards'], ['muted', 'bg', '11-12px labels'], ['muted', 'surface', '11-12px labels on cards'], ['hi', 'bg', 'accent text'], ['hi', 'surface', 'accent text on cards'], ['ok', 'bg', 'status text'], ['warn', 'bg', 'status text'], ['risk', 'bg', 'status text'], ['alt', 'bg', 'accent text']];
  for (const [fg, bgk, usageStr] of pairs) {
    const a = rgbOf(fg), b = rgbOf(bgk); if (!a || !b) continue;
    const r = ratio(a, b); result.contrastReport.push({ fg, bg: bgk, ratio: r, usage: usageStr, pass: r >= 4.5 });
  }
  if (P.brand && P.bg) { const r = ratio(parseColor(P.brand.value), parseColor(P.bg.value)); result.contrastReport.push({ fg: 'brand', bg: 'bg', ratio: r, usage: 'lines and rules only (text uses hi)', pass: r >= 3 }); }

  // the document's own failing pairs: a doc value that fails 4.5 is flagged in conflicts above.
  result.boundColors = [...new Set(Object.values(P).flatMap((v) => [v.value, v.textSafe, v.docValue].filter((x) => typeof x === 'string' && x.startsWith('#'))).map((s) => s.toUpperCase()))].sort();
  result.rootBlock = buildRootBlock(result);
  return result;
}

// ───────────────────────── unbranded fallback ─────────────────────────
const UNBRANDED = {
  light: { bg: '#F7F5F2', surface: '#FFFFFF', panel: '#EFEBE6', line: '#D8D2CA', ink: '#1D1B18', muted: '#5C564E', hi: '#0F6E75', ok: '#1F7A4A', alt: '#7A5A12', risk: '#B3261E', warn: '#8A5A00' },
  dark: { bg: '#14130F', surface: '#1C1B17', panel: '#25231E', line: '#38352E', ink: '#EEEAE3', muted: '#A8A196', hi: '#4CC3C9', ok: '#5BC48A', alt: '#D2B26A', risk: '#FF7A70', warn: '#E0A83A' }
};
function fillUnbranded(result) {
  const set = (mode) => Object.fromEntries(Object.entries(UNBRANDED[mode]).map(([k, v]) => [k, { value: v, source: 'unbranded fallback', tier: '-', derived: true }]));
  result.palette = set('light');
  result.themes = { darkOverrides: Object.fromEntries(Object.entries(UNBRANDED.dark).map(([k, v]) => [k, v])) };
  result.theme = { mode: 'both', lockedBy: null };
  result.type = { display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', mono: 'ui-monospace, "Cascadia Code", "SF Mono", Consolas, "Liberation Mono", monospace', embeddedFiles: [], fontPackages: [], source: 'unbranded fallback (system stacks)' };
  result.rules = ['UNBRANDED neutral fallback: every artifact carries <meta name="brand-source" content="unbranded">'];
}

// ───────────────────────── :root block writer ─────────────────────────
export function buildRootBlock(res) {
  const P = res.palette; const L = [];
  const prov = (k) => { const v = P[k]; if (!v) return ''; const note = v.derived ? `derived${v.why ? ': ' + v.why : ''}` : `${v.source}${v.textSafe && v.docValue ? `; doc value ${v.docValue} fails 4.5:1, text-safe variant` : ''}`; return `/* ${note} */`; };
  const colorKeys = ['bg', 'surface', 'panel', 'line', 'ink', 'muted', 'hi', 'ok', 'alt', 'risk'];
  L.push(':root{');
  if (res.unbranded) L.push('  /* UNBRANDED neutral fallback. Replace by pointing brand_probe at the real product. */');
  for (const k of colorKeys) if (P[k]) L.push(`  --${k}: ${P[k].value}; ${prov(k)}`);
  if (P.brand) L.push(`  --brand: ${P.brand.value}; ${prov('brand')} `);
  if (P.warn) L.push(`  --warn: ${P.warn.value}; ${prov('warn')}`);
  if (P.accent) L.push(`  --accent: ${P.accent.value}; ${prov('accent')}`);
  L.push(`  --radius: ${res.shape.radius};`);
  L.push(`  --border: ${res.shape.border};`);
  L.push(`  --shadow: ${res.shape.shadow === 'none' ? 'none' : '0 1px 2px rgba(0,0,0,.18)'};`);
  L.push(`  --font-display: ${res.type.display};`);
  L.push(`  --font-sans: ${res.type.sans};`);
  L.push(`  --font-mono: ${res.type.mono};`);
  L.push('}');
  const dark = res.themes && res.themes.darkOverrides;
  if (dark && res.theme.mode === 'both') {
    // only tokens the product redefined for dark, mapped back onto engine token names where they match
    const inv = {}; for (const k of [...colorKeys, 'brand', 'accent', 'warn']) if (P[k] && P[k].name) inv[baseName(P[k].name)] = k; else if (res.unbranded) inv[k] = k;
    const lines = Object.entries(dark).filter(([n]) => inv[n]).map(([n, v]) => `  --${inv[n]}: ${typeof v === 'string' ? v : v.value};`);
    if (lines.length) {
      L.push(':root:not([data-theme="light"]){} /* guard: see media block */');
      L.push('@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){');
      L.push(...lines); L.push('} }'); L.push(':root[data-theme="dark"]{'); L.push(...lines); L.push('}');
    }
  }
  return L.join('\n');
}

// ───────────────────────── CLI ─────────────────────────
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    if (['css', 'help', 'quiet'].includes(k)) o[k] = true; else o[k] = argv[++i];
  }
  return o;
}
function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) { console.error('usage: node brand_probe.mjs --root <project> [--slug s] [--out file] [--css] [--sources file] [--mode dark|light]'); process.exit(0); }
  const root = a.root || process.cwd();
  if (!fs.existsSync(root)) { console.error(`brand_probe: root not found: ${root}`); process.exit(2); }
  const res = probe(root, { sources: a.sources, mode: a.mode });
  let out = a.out;
  if (!out && a.slug) out = path.join(root, '.qsdlc', a.slug, 'artifacts', '.craft', 'brand-bind.json');
  const json = JSON.stringify(res, null, 2) + '\n';
  if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, json); if (!a.quiet) console.error(`brand_probe: wrote ${out}`); }
  if (a.css) process.stdout.write(res.rootBlock + '\n'); else if (!out) process.stdout.write(json);
  if (!a.quiet) {
    console.error(`brand_probe: confidence=${res.confidence}${res.unbranded ? ' (UNBRANDED fallback)' : ''} · conflicts=${res.conflicts.length} · contrast fails=${res.contrastReport.filter((c) => !c.pass).length}`);
    if (res.ask) console.error('brand_probe: no brand source found. Ask the user: use the neutral unbranded set, or point me at a brand file (add it to ~/.qsdlc/brand-sources.json).');
  }
  process.exit(res.ask ? 3 : 0);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
