#!/usr/bin/env node
// run_tests.mjs — automated verification of the qsdlc-present skill (and the html-motion files it depends on).
//   node skills/qsdlc-present/test/run_tests.mjs [--verbose]
// Zero dependencies. Everything written goes to a temp dir that is removed at the end.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(HERE, '..');
const SKILLS = path.join(SKILL, '..');
const MOTION = path.join(SKILLS, 'html-motion');
const S = path.join(SKILL, 'scripts');
const require = createRequire(import.meta.url);
const verbose = process.argv.includes('--verbose');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'qsdlc-present-test-'));

const results = [];
let currentGroup = '';
function group(name) { currentGroup = name; if (verbose) console.log(`\n# ${name}`); }
async function test(name, fn) {
  try { await fn(); results.push({ group: currentGroup, name, ok: true }); if (verbose) console.log(`  ok   ${name}`); }
  catch (e) { results.push({ group: currentGroup, name, ok: false, err: e }); console.log(`  FAIL ${currentGroup} :: ${name}\n       ${String(e && e.message || e).split('\n').join('\n       ')}`); }
}
const run = (script, args = [], opts = {}) => { const r = spawnSync(process.execPath, [path.join(S, script), ...args], { encoding: 'utf8', cwd: opts.cwd, env: { ...process.env, ...(opts.env || {}) } }); return { status: r.status, out: r.stdout, err: r.stderr }; };
const write = (rel, text) => { const f = path.join(TMP, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const roll = await import(pathToFileURL(path.join(S, 'roll.mjs')).href);
const lintMod = await import(pathToFileURL(path.join(S, 'lint.mjs')).href);
const probeMod = await import(pathToFileURL(path.join(S, 'brand_probe.mjs')).href);
const matrix = roll.loadMatrix();

// ───────────────────────── 1. link check ─────────────────────────
group('SKILL.md paths exist');
function backtickPaths(file) {
  const text = fs.readFileSync(file, 'utf8'); const out = new Set();
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    for (const part of m[1].split(/[\s,]+/)) {
      const p = part.replace(/^\$S\//, 'scripts/').replace(/[.;:)]+$/, '');
      if (/[<>*{}$|=]|:\/\/|^~|^\.qsdlc|^--/.test(p)) continue;
      if (/^[\w./-]+\.(md|mjs|js|json|css|html|py)$/.test(p) && (p.includes('/') || /^(SKILL|index)\./.test(p))) out.add(p);
    }
  }
  return [...out];
}
function resolveFrom(base, p) {
  const cands = [path.join(base, p), path.join(base, '..', p), path.join(SKILLS, '..', p), path.join(SKILL, p), path.join(MOTION, p), path.join(SKILL, 'assets', 'kit', p), path.join(SKILL, 'assets', 'matrix', p), path.join(SKILL, 'assets', 'archetypes', p), path.join(SKILL, 'scripts', p), path.join(MOTION, 'assets', 'engines', p)];
  return cands.some((c) => fs.existsSync(c));
}
for (const [label, dir] of [['qsdlc-present', SKILL], ['html-motion', MOTION]]) {
  const files = [path.join(dir, 'SKILL.md'), ...(fs.existsSync(path.join(dir, 'references')) ? fs.readdirSync(path.join(dir, 'references')).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, 'references', f)) : [])];
  for (const f of files) await test(`${label}: every path in ${path.relative(SKILLS, f).replace(/\\/g, '/')} exists`, () => {
    const missing = backtickPaths(f).filter((p) => !resolveFrom(dir, p));
    assert.deepEqual(missing, [], `missing: ${missing.join(', ')}`);
  });
}
await test('html-motion SKILL.md lists exactly the files that exist', () => {
  const t = fs.readFileSync(path.join(MOTION, 'SKILL.md'), 'utf8');
  const idx = readJson(path.join(MOTION, 'assets', 'engines', 'index.json')); const engines = idx.engines || idx;
  for (const e of engines) { assert.ok(t.includes('`' + e.name + '`'), `engine ${e.name} not in SKILL.md table`); assert.ok(fs.existsSync(path.join(MOTION, 'assets', 'engines', e.file || e.name + '.js')), `${e.name} file missing`); }
  assert.equal(engines.length, 9);
});
await test('html-motion has no foreign leaks and no python3', () => {
  // built from fragments so this file itself contains none of the leaked names
  const bad = new RegExp(['Do' + 'ug', 'narrative-motion-' + 'presentation', 'a' + 'fp-deck-builder', 'executive-' + 'storytelling', 'a' + 'fp-brand-guidelines', 'st-' + 'branding', 'A' + 'FP digital palette', 'python' + '3'].join('|'));
  const hits = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(md|js|mjs|py|json|html)$/.test(e.name)) { const m = bad.exec(fs.readFileSync(f, 'utf8')); if (m) hits.push(`${path.relative(MOTION, f)}: ${m[0]}`); } } };
  walk(MOTION); assert.deepEqual(hits, []);
});
await test('every engine file compiles and declares the Engines contract', () => {
  const idx = readJson(path.join(MOTION, 'assets', 'engines', 'index.json')); const engines = idx.engines || idx;
  for (const f of ['_core.js', ...engines.map((e) => e.file || e.name + '.js')]) { const code = fs.readFileSync(path.join(MOTION, 'assets', 'engines', f), 'utf8'); new vm.Script(code, { filename: f }); }
  const core = fs.readFileSync(path.join(MOTION, 'assets', 'engines', '_core.js'), 'utf8');
  for (const k of ['maxFps', 'noGovernor', 'fps=1'.slice(0, 3), 'gov']) assert.ok(core.includes(k), `_core.js should mention ${k}`);
  for (const t of ['--bg', '--surface', '--panel', '--line', '--ink', '--muted', '--hi', '--ok', '--alt', '--risk']) assert.ok(core.includes(t), `_core.js missing token ${t}`);
});

// ───────────────────────── 2. matrix ─────────────────────────
group('matrix');
await test('at least 50 cards and every deck is present', () => {
  const n = Object.values(matrix).reduce((a, d) => a + d.length, 0); assert.ok(n >= 50, `only ${n} cards`);
  for (const k of ['archetype', 'bi', 'motion', 'finish', 'signature']) assert.ok(matrix[k].length >= 8, `deck ${k} too small`);
});
await test('every card has id, fits, reduced, phone, neverBorrow; ids unique', () => {
  const seen = new Set();
  for (const [deck, cards] of Object.entries(matrix)) for (const c of cards) {
    assert.ok(c.id && !seen.has(c.id), `duplicate or missing id in ${deck}: ${c.id}`); seen.add(c.id);
    assert.ok(Array.isArray(c.fits), `${c.id}: fits`); assert.ok(typeof c.reduced === 'string' && c.reduced, `${c.id}: reduced`);
    assert.ok(typeof c.phone === 'string' && c.phone, `${c.id}: phone`); assert.ok(Array.isArray(c.neverBorrow), `${c.id}: neverBorrow`);
    assert.ok(['low', 'med', 'high'].includes(c.cost), `${c.id}: cost`);
  }
});
await test('matrix json has zero hex colours and zero hard-coded font names', () => {
  const fonts = /\b(Inter|Helvetica|Arial|Georgia|Palatino|Roboto|Segoe|Consolas|SF Mono|Cascadia|Space Grotesk|Geist|Iowan|Times New Roman|Courier|Verdana|Futura|Garamond|Calibri)\b/i;
  for (const f of fs.readdirSync(path.join(SKILL, 'assets', 'matrix'))) {
    const t = fs.readFileSync(path.join(SKILL, 'assets', 'matrix', f), 'utf8');
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(t), `${f} contains a hex colour`); assert.ok(!fonts.test(t), `${f} names a font: ${fonts.exec(t) && fonts.exec(t)[0]}`);
  }
});
await test('every skeleton named by a card exists; every fits value is a known kind', () => {
  for (const c of matrix.archetype) if (c.skeleton) assert.ok(fs.existsSync(path.join(SKILL, 'assets', 'archetypes', c.skeleton)), `${c.id}: ${c.skeleton} missing`);
  for (const cards of Object.values(matrix)) for (const c of cards) for (const k of c.fits) assert.ok(roll.KINDS[k], `${c.id}: unknown kind ${k}`);
  for (const k of Object.keys(roll.KINDS)) assert.ok(matrix.archetype.some((c) => c.fits.includes(k) && c.weight > 0), `no archetype for ${k}`);
});
await test('references/matrix.md is in sync with the json', () => { const r = run('matrix_md.mjs', ['--check']); assert.equal(r.status, 0, r.err || r.out); });

// ───────────────────────── 3. roll ─────────────────────────
group('roll');
await test('same slug|kind|rollIndex gives byte-identical output (CLI)', () => {
  const a = run('roll.mjs', ['--kind', 'performance-results', '--slug', 'alpha', '--offline']); const b = run('roll.mjs', ['--kind', 'performance-results', '--slug', 'alpha', '--offline']);
  assert.equal(a.status, 0); assert.equal(a.out, b.out);
  const c = run('roll.mjs', ['--kind', 'performance-results', '--slug', 'alpha', '--offline', '--roll-index', '1']); assert.notEqual(a.out, c.out, 'bumping rollIndex should change the deal');
});
await test('different slugs produce more than one distinct deal', () => {
  const set = new Set(); for (let i = 0; i < 12; i++) set.add(roll.roll({ kind: 'release-notes', slug: 'feat-' + i, offline: true }).archetype + '|' + roll.roll({ kind: 'release-notes', slug: 'feat-' + i, offline: true }).signature);
  assert.ok(set.size > 2, `only ${set.size} distinct deals over 12 slugs`);
});
await test('20 consecutive rolls across kinds never repeat the neighbouring archetype', () => {
  const kinds = Object.keys(roll.KINDS); let prev = null; const cost = Object.fromEntries(Object.values(matrix).flat().map((c) => [c.id, c.cost]));
  for (let i = 0; i < 20; i++) {
    const kind = kinds[i % kinds.length]; const r = roll.roll({ kind, slug: 'run-feature', rollIndex: i, prev, offline: true });
    assert.ok(r.archetype, `no archetype at ${i}`); assert.notEqual(r.archetype, prev, `roll ${i} (${kind}) repeated ${prev}`); prev = r.archetype;
    const all = [r.archetype, ...r.bi, ...r.motion, ...r.finish, r.signature].filter(Boolean);
    assert.ok(all.filter((id) => cost[id] === 'high').length <= 1, 'more than one high-cost card');
    assert.ok(r.motion.filter((id) => ['field', 'streams'].includes(id)).length <= 1, 'more than one decorative layer');
    assert.equal(new Set(all).size, all.length, 'a card was dealt twice');
    assert.ok(r.signature, 'no signature moment');
  }
});
await test('cards respect kind (fits) and needs (--has)', () => {
  const r = roll.roll({ kind: 'performance-results', slug: 'needs', has: roll.parseHas('counts'), offline: true });
  for (const id of r.bi) { const c = matrix.bi.find((x) => x.id === id); assert.ok(c.fits.includes('performance-results')); assert.ok(c.needs.every((n) => /^counts$/.test(n) || false), `${id} needs ${c.needs}`); }
  assert.ok(!r.bi.includes('flow-sankey'));
});
await test('--pin ignores history so recurring dashboards keep their layout', () => {
  const hist = Array.from({ length: 10 }, () => ({ archetype: 'instrument-panel', bi: ['pf-bar'], motion: [], finish: [], signature: null }));
  const pinned = roll.roll({ kind: 'dashboard', slug: 'wall', pin: true, history: hist, offline: true }); const bare = roll.roll({ kind: 'dashboard', slug: 'wall', pin: true, offline: true });
  assert.equal(JSON.stringify(pinned), JSON.stringify(bare)); assert.equal(pinned.pinned, true);
});
await test('--long allows two signature moments, default allows one', () => {
  const a = roll.roll({ kind: 'release-notes', slug: 'sig', offline: true }); const b = roll.roll({ kind: 'release-notes', slug: 'sig', long: true, offline: true });
  assert.equal(a.signatureExtra, null); assert.ok(b.signatureExtra, 'long page should get a second signature');
});
await test('live query plan is privacy-gated: denied terms fail closed', () => {
  const fine = roll.roll({ kind: 'performance-results', slug: 'checkout-flow' });
  // queries are sampled now, so deny a word from a query this very seed actually picked: the same roll must then fail closed
  const word = fine.live.queries.join(' ').toLowerCase().match(/[a-z]{5,}/)[0];
  const ok = roll.roll({ kind: 'performance-results', slug: 'checkout-flow', deny: [word] });
  assert.equal(ok.live.skipped, 'privacy-gate', `a denied term ("${word}") in a picked query must skip the live step`); assert.deepEqual(ok.live.queries, []);
  assert.ok(fine.live.queries.length >= 2 && !fine.live.skipped);
  assert.ok(!fine.live.queries.join(' ').toLowerCase().includes('checkout'));
  const off = roll.roll({ kind: 'performance-results', slug: 'checkout-flow', offline: true }); assert.equal(off.live, undefined);
  const intent = write('privacy/Intent.md', '# Hazelwood Voucher Portal\n\nbody'); const w2 = roll.roll({ kind: 'dashboard', slug: 'x' }).live.queries.join(' ').toLowerCase().match(/[a-z]{5,}/)[0]; const r = roll.roll({ kind: 'dashboard', slug: 'x', denyFrom: [intent], deny: [w2] }); assert.equal(r.live.skipped, 'privacy-gate');
  assert.ok(roll.buildDenylist({ slug: 's', denyFrom: [intent] }).includes('hazelwood'));
});
await test('unknown kind or missing slug is a usage error (exit 2)', () => { assert.equal(run('roll.mjs', ['--kind', 'nope', '--slug', 'x']).status, 2); assert.equal(run('roll.mjs', ['--kind', 'inspo']).status, 2); });

// ───────────────────────── 4. brand probe ─────────────────────────
group('brand_probe');
const probe = (dir, extra = []) => { const r = run('brand_probe.mjs', ['--root', dir, '--quiet', '--sources', path.join(TMP, 'no-sources.json'), ...extra]); return { status: r.status, json: r.out ? JSON.parse(r.out) : null, err: r.err }; };
const lum = (hex) => probeMod.luminance(probeMod.parseColor(hex));
await test('colour maths: contrast, ensureContrast and parsers', () => {
  assert.equal(Math.round(probeMod.contrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })), 21);
  const bg = probeMod.parseColor('#0C0714'); assert.ok(Math.abs(probeMod.contrast(probeMod.parseColor('#7A6C92'), bg) - 4.15) < 0.05, 'the 4.15:1 case');
  assert.ok(probeMod.contrast(probeMod.ensureContrast(probeMod.parseColor('#7A6C92'), bg, 4.5), bg) >= 4.5);
  assert.equal(probeMod.toHex(probeMod.parseColor('hsl(0 0% 100%)')), '#FFFFFF'); assert.equal(probeMod.toHex(probeMod.parseColor('0 0% 100%', true)), '#FFFFFF');
  assert.equal(probeMod.toHex(probeMod.parseColor('rgb(255, 0, 0)')), '#FF0000'); assert.equal(probeMod.toHex(probeMod.parseColor('#abc')), '#AABBCC');
  const ok = probeMod.parseColor('oklch(0.7 0.15 150)'); assert.ok(ok && ok.g > ok.r, 'oklch green');
});
await test('empty repo: exit 3, asks, labelled unbranded neutral fallback that passes contrast', () => {
  const dir = path.join(TMP, 'fx-empty'); fs.mkdirSync(dir, { recursive: true }); const r = probe(dir);
  assert.equal(r.status, 3); assert.equal(r.json.confidence, 'none'); assert.equal(r.json.ask, true); assert.equal(r.json.unbranded, true);
  assert.ok(r.json.rootBlock.includes('UNBRANDED')); assert.deepEqual(r.json.shape.radiusScale, ['0', '2px']);
  assert.ok(r.json.contrastReport.length >= 6 && r.json.contrastReport.every((c) => c.pass), 'unbranded fallback must pass its own contrast report');
  assert.ok(r.json.themes.darkOverrides.bg, 'both themes defined');
});
await test('tailwind v3 config (tier B): bg/ink/brand/radius/font found', () => {
  const dir = path.join(TMP, 'fx-tw3'); write('fx-tw3/package.json', '{"dependencies":{"tailwindcss":"^3.4.0","lucide-react":"1"}}');
  write('fx-tw3/tailwind.config.js', `module.exports = { content: ['./src/**/*.tsx'], theme: { extend: {\n  colors: { background: '#0B0F14', surface: '#121821', ink: '#E6EDF3', muted: '#9AA7B4', brand: { DEFAULT: '#3B82F6', 600: '#2563EB' }, border: '#1F2933', danger: '#F87171' },\n  fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },\n  borderRadius: { DEFAULT: '4px' } } } }`);
  const r = probe(dir); assert.equal(r.status, 0, r.err); const p = r.json.palette;
  assert.equal(r.json.tailwind, 'v3'); assert.equal(p.bg.value, '#0B0F14'); assert.equal(p.ink.value, '#E6EDF3'); assert.equal(r.json.confidence, 'B');
  assert.equal(r.json.shape.radius, '4px'); assert.ok(r.json.type.sans.includes('Inter')); assert.equal(r.json.theme.mode, 'dark'); assert.equal(r.json.icons.family, 'lucide');
  assert.ok(p.brand && p.risk.value === probeMod.toHex(probeMod.ensureContrast(probeMod.parseColor('#F87171'), probeMod.parseColor('#0B0F14'), 4.5)));
});
await test('tailwind v4 @theme block', () => {
  const dir = path.join(TMP, 'fx-tw4'); write('fx-tw4/package.json', '{"dependencies":{"tailwindcss":"^4.0.0"}}');
  write('fx-tw4/src/app.css', `@import "tailwindcss";\n@theme {\n  --color-bg: #FFFFFF;\n  --color-surface: #F9FAFB;\n  --color-ink: #111827;\n  --color-line: #E5E7EB;\n  --color-brand: #0F766E;\n  --font-sans: "Source Sans 3", system-ui, sans-serif;\n  --radius-md: 6px;\n}\n`);
  const r = probe(dir); assert.equal(r.status, 0, r.err); assert.equal(r.json.tailwind, 'v4'); assert.equal(r.json.palette.bg.value, '#FFFFFF'); assert.equal(r.json.palette.ink.value, '#111827'); assert.equal(r.json.theme.mode, 'light');
  assert.ok(r.json.type.sans.includes('Source Sans 3'));
});
await test('plain CSS variables with a dark block: both themes detected, drift-safe muted', () => {
  const dir = path.join(TMP, 'fx-css'); write('fx-css/styles.css', `:root{ --bg:#ffffff; --surface:#f6f7f9; --text:#1a1d21; --muted:#6b7280; --border:#dde1e6; --accent:#c026d3; }\n@media (prefers-color-scheme: dark){ :root{ --bg:#101214; --text:#eceff3; } }\nbody{ border-radius: 6px; } .a{ border-radius: 6px; } .b{ border-radius: 2px; }\n`);
  const r = probe(dir); assert.equal(r.status, 0, r.err); const p = r.json.palette;
  assert.equal(p.bg.value, '#FFFFFF'); assert.equal(p.ink.value, '#1A1D21'); assert.equal(r.json.theme.mode, 'both'); assert.equal(r.json.themes.darkOverrides.bg, '#101214');
  assert.equal(r.json.shape.radius, '6px'); assert.ok(r.json.contrastReport.find((c) => c.fg === 'ink' && c.bg === 'bg').pass);
  assert.ok(r.json.rootBlock.includes('@media (prefers-color-scheme: dark)') && r.json.rootBlock.includes('[data-theme="dark"]'));
});
await test('shadcn project: components.json + HSL triplets resolve to real colours', () => {
  const dir = path.join(TMP, 'fx-shadcn'); write('fx-shadcn/components.json', '{"style":"default","tailwind":{"css":"app/globals.css"}}');
  write('fx-shadcn/app/globals.css', `@layer base { :root {\n --background: 0 0% 100%; --foreground: 222.2 84% 4.9%; --card: 210 40% 98%; --primary: 221.2 83.2% 53.3%; --muted: 210 40% 96.1%; --muted-foreground: 215.4 16.3% 46.9%; --border: 214.3 31.8% 91.4%; --destructive: 0 84.2% 60.2%; --radius: 0.5rem; } }\n`);
  const r = probe(dir); assert.equal(r.status, 0, r.err); assert.equal(r.json.shadcn, true); assert.equal(r.json.palette.bg.value, '#FFFFFF');
  assert.ok(lum(r.json.palette.ink.value) < 0.05, 'foreground is near black'); assert.equal(r.json.shape.radius, '0.5rem'); assert.ok(r.json.palette.brand);
});
await test('docs-only repo (tier A): confidence A, text-safe muted, the 4.15:1 doc value recorded as a conflict', () => {
  const dir = path.join(TMP, 'fx-docs'); write('fx-docs/CLAUDE.md', '# Project\n\nSee docs/design.md\n');
  write('fx-docs/docs/design.md', '# Design\n\nCommit to dark, deliberately.\n\n```css\n:root{\n  /* Ground */\n  --ink:      #0C0714;   /* page background */\n  --ink-2:    #140C21;   /* raised panel, card */\n  --ink-3:    #1B1030;   /* hover, selected */\n  --line:     #2E2044;   /* hairline rule, border */\n  /* Brand */\n  --q-deep:   #571896;\n  --q-bright: #852CDD;\n  --q-lift:   #A768F0;   /* accent TEXT on dark */\n  /* Paper */\n  --paper:     #EDE7F5;\n  --paper-far: #7A6C92;  /* labels, captions */\n  --accent: #D9A441;\n}\n```\n\n* Never a pure grey.\n* Borders are `1px solid var(--line)`; border-radius is `2px` or `0`.\n\n## Anti-patterns\n\n* Emoji as section markers.\n* Gradient hero.\n');
  const r = probe(dir); assert.equal(r.status, 0, r.err); const j = r.json;
  assert.equal(j.confidence, 'A'); assert.equal(j.palette.bg.value, '#0C0714'); assert.equal(j.palette.ink.value, '#EDE7F5'); assert.equal(j.theme.mode, 'dark'); assert.ok(j.theme.lockedBy);
  const c = j.conflicts.find((x) => x.field === 'paper-far'); assert.ok(c && c.kind === 'contrast', 'paper-far 4.15:1 must be reported'); assert.ok(/4\.15/.test(c.values[0]));
  assert.ok(j.contrastReport.filter((x) => x.fg === 'muted').every((x) => x.pass), 'bound muted must pass 4.5:1');
  assert.equal(j.palette.brand.value, '#852CDD'); assert.equal(j.palette.hi.value, '#A768F0', 'hi is the text-safe brand'); assert.equal(j.palette.alt.value, '#D9A441');
  assert.equal(j.shape.radius, '2px'); assert.ok(j.antiPatterns.length >= 2 && j.rules.length >= 1); assert.ok(j.boundColors.includes('#852CDD'));
  for (const k of ['ok', 'risk', 'warn']) assert.ok(j.palette[k].derived && probeMod.contrast(probeMod.parseColor(j.palette[k].value), probeMod.parseColor(j.palette.bg.value)) >= 4.5, `${k} derived and readable`);
});
await test('--sources lets a doc outside the repo bind (the vault case)', () => {
  const dir = path.join(TMP, 'fx-src'); fs.mkdirSync(dir, { recursive: true });
  const doc = write('vault/Standard.md', '```css\n:root{ --bg:#101820; --surface:#16212b; --ink:#f2f5f7; --line:#2a3945; --brand:#e0a030; }\n```\n');
  const srcs = write('vault/sources.json', JSON.stringify({ files: [doc] }));
  const r = run('brand_probe.mjs', ['--root', dir, '--quiet', '--sources', srcs]); assert.equal(r.status, 0, r.err); const j = JSON.parse(r.out); assert.equal(j.palette.bg.value, '#101820'); assert.equal(j.confidence, 'A'); assert.equal(j.extraSources, srcs);
});
await test('never reads .env, node_modules or writes outside .craft/', () => {
  const dir = path.join(TMP, 'fx-safe'); write('fx-safe/.env', '--bg: #123456;'); write('fx-safe/node_modules/x/x.css', ':root{--bg:#654321;--ink:#fff}');
  const r = probe(dir); assert.equal(r.status, 3, 'secrets and vendored css must not count as a brand source');
  const out = run('brand_probe.mjs', ['--root', dir, '--quiet', '--slug', 'demo']); assert.equal(out.status, 3);
  assert.ok(fs.existsSync(path.join(dir, '.qsdlc', 'demo', 'artifacts', '.craft', 'brand-bind.json'))); const stray = fs.readdirSync(dir).filter((f) => !['.env', 'node_modules', '.qsdlc'].includes(f)); assert.deepEqual(stray, []);
});

// ───────────────────────── 5. kit + diagram ─────────────────────────
group('kit and diagram render');
const Kit = require(path.join(SKILL, 'assets', 'kit', 'kit.js'));
const Diagram = require(path.join(SKILL, 'assets', 'kit', 'diagram.js'));
const CHARTS = {
  bar: { title: 'Open findings by severity', desc: 'Four severities', unit: '', source: 'eval.md', data: [{ label: 'Critical', value: 2, tone: 'risk' }, { label: 'High', value: 5 }, { label: 'Medium', value: 9 }, { label: 'Low', value: 14 }], sort: 'desc' },
  stacked: { title: 'Pass, fail, skip', desc: 'Counts', source: 'eval.md', series: [{ label: 'Pass', tone: 'ok' }, { label: 'Fail', tone: 'risk' }, { label: 'Skip', tone: 'muted' }], data: [{ label: 'Run 1', values: [38, 3, 1] }, { label: 'Run 2', values: [40, 1, 1] }] },
  strip: { title: 'Latency', desc: 'ms per request', unit: 'ms', source: 'eval.md', data: [{ label: 'GET /a', values: [12, 14, 15, 16, 18, 21, 22, 30, 41, 95] }, { label: 'POST /b', values: [30, 33, 35, 36, 40, 44, 51, 60, 88, 140] }], marks: [50, 95, 99] },
  slope: { title: 'Before and after', desc: 'seconds', source: 'eval.md', fromLabel: 'Before', toLabel: 'After', better: 'lower', data: [{ label: 'Load', from: 4.2, to: 1.8 }, { label: 'Save', from: 2.1, to: 2.4 }] },
  spark: { title: 'Pass rate by run', desc: 'five runs', source: 'eval.md', series: [{ label: 'Unit', data: [90, 92, 95, 94, 98] }, { label: 'E2E', data: [70, 75, 72, 80, 85] }, { label: 'Perf', data: [60, 58, 66, 70, 71] }] },
  bullet: { title: 'Audit score vs target', desc: 'points', source: 'eval.md', data: [{ label: 'Compliance', value: 72, target: 85, max: 100 }, { label: 'Portals', value: 55, target: 70, max: 100 }] },
  heatmap: { title: 'Tests by run', desc: 'status grid', source: 'eval.md', rows: ['login', 'search', 'export'], cols: ['r1', 'r2', 'r3'], cells: [['pass', 'pass', 'fail'], ['pass', 'skip', 'pass'], ['fail', 'warn', 'pass']] },
  waterfall: { title: 'Score delta', desc: 'points', source: 'eval.md', data: [{ label: 'Start', value: 60, total: true }, { label: 'Rules', value: 12 }, { label: 'Bugs', value: -4 }, { label: 'End', value: 68, total: true }] }
};
for (const [type, spec] of Object.entries(CHARTS)) await test(`Kit.chart.svg('${type}') is accessible, token-only and self-contained`, () => {
  const out = Kit.chart.svg(type, spec); assert.equal(typeof out, 'string');
  assert.ok(/<svg\b/.test(out), 'svg'); assert.ok(/role="img"/.test(out), 'role=img'); assert.ok(/<title\b[^>]*>[^<]+<\/title>/.test(out), 'title'); assert.ok(/<desc\b/.test(out), 'desc');
  assert.ok(/<details\b[^>]*class="[^"]*kit-details/.test(out) && /<table\b/.test(out), 'details table fallback'); assert.ok(/kit-chart/.test(out), 'kit-chart class');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b(?![\w-])/.test(out.replace(/&#\d+;/g, '')), 'no hex colours'); assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(out), 'no external URLs');
  assert.ok(/var\(--/.test(out), 'colours via tokens'); assert.ok(!/NaN|undefined|Infinity/.test(out), 'no NaN/undefined in output');
  assert.equal(out, Kit.chart.svg(type, spec), 'deterministic');
  const l = lintMod.lint(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>t</title><style>:root{--bg:#000;--ink:#fff}body{background:var(--bg);color:var(--ink)}:focus-visible{outline:2px solid}.table-wrap{overflow-x:auto}@media (prefers-reduced-motion: reduce){*{transition:none}}</style></head><body><h1>x</h1>${out}</body></html>`);
  assert.deepEqual(l.findings.filter((f) => f.level === 'error' && ['L08', 'L10', 'L14'].includes(f.code)), [], 'chart markup must satisfy its own lint rules');
});
await test('illustrative charts show a visible label', () => { const out = Kit.chart.svg('bar', { ...CHARTS.bar, illustrative: true }); assert.ok(/illustrative/i.test(out.replace(/data-source="[^"]*"/g, ''))); });
await test('Kit.chart.svg escapes hostile labels', () => { const out = Kit.chart.svg('bar', { title: 'x', data: [{ label: '<img src=x onerror=alert(1)>', value: 3 }] }); assert.ok(!/<img\b/.test(out)); });
await test('Kit exposes the documented motion API', () => { for (const k of ['reveal', 'draw', 'grow', 'count', 'flow', 'scrub']) assert.equal(typeof Kit[k], 'function', `Kit.${k}`); for (const k of ['bar', 'stacked', 'strip', 'slope', 'spark', 'bullet', 'heatmap', 'waterfall']) assert.equal(typeof Kit.chart[k], 'function', `Kit.chart.${k}`); });
const DAG = { title: 'Build phases', desc: 'Ten steps with one cycle and two groups', direction: 'LR',
  nodes: [{ id: 'a', label: 'Spec', status: 'done', shape: 'round', group: 'g1' }, { id: 'b', label: 'Plan', status: 'done', group: 'g1' }, { id: 'c', label: 'API phase', status: 'running', tag: 'qsdlc-dev-api', group: 'g2' }, { id: 'd', label: 'Web phase', status: 'todo', tag: 'qsdlc-dev-web', group: 'g2' }, { id: 'e', label: 'CLI phase', status: 'blocked', shape: 'hex' }, { id: 'f', label: 'Gate?', shape: 'diamond', status: 'todo' }, { id: 'g', label: 'Eval', status: 'todo', shape: 'pill' }, { id: 'h', label: 'Fix', status: 'risk' }, { id: 'i', label: 'Ship', status: 'todo' }, { id: 'j', label: 'Notes', status: 'todo' }],
  edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c', label: 'handoff' }, { from: 'b', to: 'd' }, { from: 'b', to: 'e' }, { from: 'c', to: 'f' }, { from: 'd', to: 'f' }, { from: 'e', to: 'f' }, { from: 'f', to: 'g' }, { from: 'g', to: 'h', label: 'fail' }, { from: 'h', to: 'g' }, { from: 'g', to: 'i' }, { from: 'i', to: 'j' }], groups: [{ id: 'g1', label: 'Design' }, { id: 'g2', label: 'Build' }] };
await test('Diagram.svg lays out a 10-node DAG with a cycle, groups and labels', () => {
  const out = Diagram.svg(DAG); assert.ok(/<svg\b/.test(out) && /role="img"/.test(out) && /<title\b/.test(out) && /<desc\b/.test(out), 'svg a11y');
  for (const n of DAG.nodes) assert.ok(out.includes(n.label.replace('?', '?')), `node label ${n.label}`); assert.ok(out.includes('handoff'), 'edge label'); assert.ok(out.includes('Design') && out.includes('Build'), 'group labels');
  assert.ok(/<marker\b/.test(out), 'arrowheads'); assert.ok(/<details\b/.test(out), 'text fallback'); assert.ok(!/#[0-9a-fA-F]{3,8}\b(?![\w-])/.test(out), 'no hex'); assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(out), 'no external urls');
  assert.ok(!/NaN|undefined|Infinity/.test(out), 'clean numbers'); assert.equal(out, Diagram.svg(DAG), 'deterministic');
  for (const word of ['done', 'running', 'blocked']) assert.ok(new RegExp(word, 'i').test(out), `status "${word}" is spelled out, not colour only`);
});
await test('Diagram handles curved edges, TB direction, a single node and an empty graph', () => {
  assert.ok(/<svg/.test(Diagram.svg({ ...DAG, direction: 'TB', routing: 'curved' })));
  assert.ok(/<svg/.test(Diagram.svg({ title: 'One', nodes: [{ id: 'x', label: 'Only' }], edges: [] }))); assert.doesNotThrow(() => Diagram.svg({ title: 'Empty', nodes: [], edges: [] }));
  assert.doesNotThrow(() => Diagram.svg({ title: 'Self loop', nodes: [{ id: 'x', label: 'X' }], edges: [{ from: 'x', to: 'x' }, { from: 'x', to: 'missing' }] }));
});
await test('Diagram edge labels: no two labels overlap, twin edges get separate lanes, fan-out labels sit apart', () => {
  const spec = { title: 'Labels', nodes: [{ id: 'p', label: 'Plan' }, { id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'e', label: 'Eval' }, { id: 'f', label: 'Fix' }],
    edges: [{ from: 'p', to: 'a', label: 'phase 1' }, { from: 'p', to: 'b', label: 'phase 2' }, { from: 'p', to: 'c', label: 'phase 3' }, { from: 'e', to: 'f', label: 'fail' }, { from: 'f', to: 'e', label: 'retest' }] };
  const svg = Diagram.svg(spec);
  const rects = [...svg.matchAll(/<g class="dg-label"><rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g)].map((m) => ({ x0: +m[1], y0: +m[2], x1: +m[1] + +m[3], y1: +m[2] + +m[4] }));
  assert.equal(rects.length, 5, 'one label per labelled edge');
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `labels ${i} and ${j} overlap`); }
  const paths = [...svg.matchAll(/<path class="dg-edge[^"]*" data-from="(\w+)" data-to="(\w+)"[^>]* d="([^"]+)"/g)].map((m) => ({ k: m[1] + '>' + m[2], d: m[3] }));
  const fail = paths.find((p) => p.k === 'e>f'), retest = paths.find((p) => p.k === 'f>e'); assert.ok(fail && retest && fail.d !== retest.d, 'twin edges must not share one path');
  const yOf = (d) => new Set([...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((m) => m[2])); const shared = [...yOf(fail.d)].filter((y) => yOf(retest.d).has(y)); assert.deepEqual(shared, [], 'twin edges must run on different lanes');
  const fan = rects.slice(0, 3).map((r) => Math.round((r.y0 + r.y1) / 2)); assert.equal(new Set(fan).size, 3, 'each labelled fan-out edge carries its label at its own height, not stacked on one shared trunk');
});
await test('Diagram output passes the svg lint rules', () => {
  const l = lintMod.lint(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>t</title><style>:root{--bg:#000}body{background:var(--bg)}:focus-visible{outline:2px solid}.table-wrap{overflow-x:auto}</style></head><body><h1>x</h1>${Diagram.svg(DAG)}</body></html>`);
  assert.deepEqual(l.findings.filter((f) => f.level === 'error' && ['L08', 'L10'].includes(f.code)), []);
});

// ───────────────────────── 6. lint ─────────────────────────
group('lint');
const GOOD = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="brand-source" content="tests/fixture">
<title>Sample artifact</title>
<style>
:root{ --bg:#0C0714; --surface:#140C21; --ink:#EDE7F5; --muted:#A99BC0; --hi:#A768F0; --line:#2E2044; --radius:2px; }
*{ box-sizing:border-box; }
body{ margin:0; background:var(--bg); color:var(--ink); font-family:ui-sans-serif, system-ui, sans-serif; }
.card{ background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:16px; }
.eyebrow{ color:var(--muted); font-size:12px; letter-spacing:.2em; text-transform:uppercase; }
.table-wrap{ overflow-x:auto; }
:focus-visible{ outline:2px solid var(--hi); outline-offset:2px; }
html.js [data-reveal]{ opacity:0; transition:opacity .4s; } html.js [data-reveal].is-in{ opacity:1; }
.snap{ scroll-snap-type:y proximity; }
@media (prefers-reduced-motion: reduce){ *,*::before,*::after{ animation:none !important; transition:none !important; } html.js [data-reveal]{ opacity:1; } }
</style>
</head>
<body>
<main>
<p class="eyebrow">Sample</p>
<h1>One verdict sentence</h1>
<h2>Evidence</h2>
<div class="card" data-reveal><p class="numeral" data-source="stats.pass">38</p><div class="table-wrap" tabindex="0"><table><tr><th>Test</th><th>Result</th></tr><tr><td>login</td><td>pass</td></tr></table></div></div>
<svg width="40" height="20" viewBox="0 0 40 20" role="img" aria-labelledby="t1"><title id="t1">A bar</title><rect width="30" height="20" fill="var(--hi)"/></svg>
<button type="button">Open</button>
</main>
<script type="application/json" id="stats">{"stats":{"pass":38,"fail":3}}</script>
</body>
</html>`;
const L = (html, o) => lintMod.lint(html, o);
const codes = (r, level = 'error') => [...new Set(r.findings.filter((f) => f.level === level).map((f) => f.code))].sort();
await test('a valid sample artifact passes with zero errors', () => { const r = L(GOOD); assert.deepEqual(r.findings.filter((f) => f.level === 'error'), []); assert.equal(r.errors, 0); });
await test('the valid sample passes the CLI (exit 0) and --brand drift check against its own bind', () => {
  const f = write('lint/good.html', GOOD); assert.equal(run('lint.mjs', [f]).status, 0);
  const bind = write('lint/bind.json', JSON.stringify({ boundColors: ['#0C0714', '#140C21', '#EDE7F5', '#A99BC0', '#A768F0', '#2E2044'], shape: { radiusScale: ['0', '2px'], shadow: 'none' } }));
  const r = run('lint.mjs', [f, '--brand', bind]); assert.equal(r.status, 0, r.out);
});
const VIOLATIONS = [
  ['L01', 'CDN script', (h) => h.replace('</body>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"></script></body>')],
  ['L01', 'CSS @import', (h) => h.replace('<style>', '<style>@import url("https://fonts.example/x.css");')],
  ['L01', 'fetch call', (h) => h.replace('</body>', '<script>fetch("/data.json")</script></body>')],
  ['L01', 'remote image', (h) => h.replace('<button', '<img src="https://example.com/a.png" alt=""><button')],
  ['L02', 'reveal hidden without .js gate', (h) => h.replace('html.js [data-reveal]{ opacity:0;', '[data-reveal]{ opacity:0;')],
  ['L02', 'animation without reduced-motion', (h) => h.replace(/@media \(prefers-reduced-motion: reduce\)\{[^\n]*\n/, '').replace('</style>', '.x{animation:spin 2s infinite}</style>')],
  ['L03', 'no focus-visible', (h) => h.replace(/:focus-visible\{[^}]*\}/, '')],
  ['L03', 'div onclick', (h) => h.replace('<button', '<div onclick="go()">x</div><button')],
  ['L04', 'unpainted body', (h) => h.replace('background:var(--bg); ', '')],
  ['L04', 'literal body background', (h) => h.replace('background:var(--bg)', 'background:#0C0714')],
  ['L04', 'token only inside a theme block', (h) => h.replace('</style>', '@media (prefers-color-scheme: dark){:root{--only-dark:#fff}} .z{color:var(--only-dark)}</style>')],
  ['L05', 'colour outside bound palette', (h) => h.replace('</style>', '.q{background:#FF00AA}</style>'), { brand: { boundColors: ['#0C0714', '#140C21', '#EDE7F5', '#A99BC0', '#A768F0', '#2E2044'], shape: { radiusScale: ['0', '2px'] } } }],
  ['L06', 'radius off scale', (h) => h.replace('border-radius:var(--radius)', 'border-radius:6px')],
  ['L06', 'shadow on a shadowless product', (h) => h.replace('</style>', '.s{box-shadow:0 8px 24px var(--line)}</style>'), { brand: { boundColors: [], shape: { radiusScale: ['0', '2px'], shadow: 'none' } } }],
  ['L07', 'gradient text', (h) => h.replace('</style>', 'h1{background:linear-gradient(var(--hi),var(--ink));-webkit-background-clip:text;color:transparent}</style>')],
  ['L07', 'emoji marker', (h) => h.replace('<h2>Evidence</h2>', '<h2>🚀 Evidence</h2>')],
  ['L07', 'purple to blue gradient', (h) => h.replace('</style>', '.hero{background:linear-gradient(135deg,#7c3aed,#2563eb)}</style>')],
  ['L08', 'svg without title/role', (h) => h.replace('<button', '<svg width="10" height="10"><rect width="10" height="10"/></svg><button')],
  ['L08', 'chart without details', (h) => h.replace('<button', '<figure class="kit-chart"><svg role="img"><title>c</title></svg></figure><button')],
  ['L09', 'low-contrast text', (h) => h.replace('.eyebrow{ color:var(--muted);', '.eyebrow{ color:var(--line);')],
  ['L10', 'table without wrapper', (h) => h.replace('<div class="table-wrap" tabindex="0"><table>', '<table>').replace('</table></div>', '</table>')],
  ['L11', 'mandatory snap', (h) => h.replace('proximity', 'mandatory')],
  ['L12', 'missing lang', (h) => h.replace('<html lang="en">', '<html>')],
  ['L12', 'missing title', (h) => h.replace('<title>Sample artifact</title>', '')],
  ['L12', 'two h1', (h) => h.replace('<h2>Evidence</h2>', '<h1>Again</h1>')],
  ['L12', 'no viewport', (h) => h.replace(/<meta name="viewport"[^>]*>/, '')],
  ['L13', 'over size budget', (h) => h.replace('</body>', `<!-- ${'x'.repeat(420 * 1024)} --></body>`).replace(/<!--[\s\S]*?-->/, (m) => m), { maxKb: 1 }],
  ['L14', 'data-source with no key', (h) => h.replace('data-source="stats.pass"', 'data-source="stats.nope"')],
  ['L14', 'illustrative data without label', (h) => h.replace('{"stats"', '{"illustrative":true,"stats"')]
];
for (const [code, name, mutate, o] of VIOLATIONS) await test(`${code} catches: ${name}`, () => {
  const html = mutate(GOOD); assert.notEqual(html, GOOD, 'mutation did not change the sample');
  const r = L(html, o && o.maxKb ? { maxKb: o.maxKb } : o || {}); assert.ok(codes(r).includes(code), `expected ${code}, got ${codes(r).join(',') || 'nothing'}\n${r.findings.map((f) => f.code + ' ' + f.msg).join('\n')}`);
});
await test('L15 (--claims) flags overclaims only when asked', () => {
  const html = GOOD.replace('<h1>One verdict sentence</h1>', '<h1>Seamless, fully automated, 100% instant</h1>');
  assert.ok(!L(html).findings.some((f) => f.code === 'L15')); const r = L(html, { claims: true }); assert.ok(r.findings.filter((f) => f.code === 'L15').length >= 3);
});
await test('L16 warns on unbranded or missing brand-source', () => {
  assert.ok(L(GOOD.replace('tests/fixture', 'unbranded')).findings.some((f) => f.code === 'L16' && /UNBRANDED/.test(f.msg))); assert.ok(L(GOOD.replace(/<meta name="brand-source"[^>]*>/, '')).findings.some((f) => f.code === 'L16'));
});
await test('lint --strict turns warnings into a failing exit; errors always fail', () => {
  const warnOnly = write('lint/warn.html', GOOD.replace('tests/fixture', 'unbranded')); assert.equal(run('lint.mjs', [warnOnly]).status, 0); assert.equal(run('lint.mjs', [warnOnly, '--strict']).status, 1);
  assert.equal(run('lint.mjs', [write('lint/bad.html', GOOD.replace('<html lang="en">', '<html>'))]).status, 1); assert.equal(run('lint.mjs', [path.join(TMP, 'nope.html')]).status, 2);
});
await test('lint --json is machine readable', () => { const r = run('lint.mjs', [write('lint/j.html', GOOD), '--json']); const j = JSON.parse(r.out); assert.equal(j.errors, 0); assert.ok(Array.isArray(j.findings)); });
await test('lint reproduces the audited defects on a Mermaid-CDN, 6px-radius, no-focus page', () => {
  const old = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>old</title><style>:root{--ink:#0C0714;--paper-far:#6f6284}body{background:var(--ink);color:#fff}.card{border-radius:6px}.eyebrow{color:var(--paper-far);font-size:11px}</style></head><body><h1>x</h1><div class="eyebrow">e</div><table><tr><td>1</td></tr></table><script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"></script></body></html>`;
  const c = codes(L(old)); for (const need of ['L01', 'L03', 'L06', 'L09', 'L10', 'L12']) assert.ok(c.includes(need), `missing ${need} in ${c}`);
});

// ───────────────────────── 7. inline + embed_font ─────────────────────────
group('inline and embed_font');
await test('inline.mjs --list names kit, diagram and the engines', () => { const r = run('inline.mjs', ['--list']); assert.equal(r.status, 0); for (const n of ['kit', 'diagram', 'streams', 'graph', 'shader']) assert.ok(r.out.includes(n), `list missing ${n}`); });
await test('inline.mjs is idempotent, replaces the block, and rejects unknown modules', () => {
  const f = write('inline/page.html', GOOD.replace('</body>', '<!-- qsdlc-present:start -->\n<!-- qsdlc-present:end -->\n</body>'));
  assert.equal(run('inline.mjs', [f, 'kit', 'diagram']).status, 0); const once = fs.readFileSync(f, 'utf8'); assert.ok(once.includes('Kit') && once.includes('Diagram'));
  assert.equal(run('inline.mjs', [f, 'kit', 'diagram']).status, 0); assert.equal(fs.readFileSync(f, 'utf8'), once, 'second run must not change the file');
  assert.equal(run('inline.mjs', [f, 'kit', 'graph']).status, 0); const swapped = fs.readFileSync(f, 'utf8'); assert.ok(swapped.includes('Engines') && !swapped.includes('Diagram.layout = ') || swapped.includes('Engines'), 'block replaced');
  assert.equal((swapped.match(/qsdlc-present:start/g) || []).length, 1, 'exactly one block');
  assert.equal(run('inline.mjs', [f, 'nonsense']).status, 2); assert.equal(run('inline.mjs', [f, 'kit', '--budget', '1']).status, 1, 'over budget fails');
});
await test('inline.mjs without markers inserts before </body>; --render pre-renders data-chart blocks idempotently', () => {
  const page = GOOD.replace('</main>', `<script type="application/json" data-chart="bar">${JSON.stringify(CHARTS.bar)}</script></main>`);
  const f = write('inline/render.html', page); assert.equal(run('inline.mjs', [f, 'kit', 'diagram', '--render']).status, 0); const a = fs.readFileSync(f, 'utf8');
  assert.ok(a.indexOf('qsdlc-present:start') < a.indexOf('</body>')); assert.ok(/<figure class="kit-chart"/.test(a), 'figure rendered statically'); assert.ok(/<details/.test(a));
  assert.equal(run('inline.mjs', [f, 'kit', 'diagram', '--render']).status, 0); assert.equal(fs.readFileSync(f, 'utf8'), a, 'render is idempotent'); assert.equal((a.replace(/<!-- qsdlc-present:start -->[\s\S]*?<!-- qsdlc-present:end -->/, '').match(/<figure class="kit-chart"/g) || []).length, 1, 'exactly one pre-rendered figure outside the inlined kit source');
  const l = L(a); assert.deepEqual(l.findings.filter((x) => x.level === 'error'), [], l.findings.map((x) => x.code + ' ' + x.msg).join('; '));
});
await test('every archetype skeleton, once the kit is inlined, lints with zero errors', () => {
  for (const f of fs.readdirSync(path.join(SKILL, 'assets', 'archetypes')).filter((x) => x.endsWith('.html'))) {
    const dest = write(`arch/${f}`, fs.readFileSync(path.join(SKILL, 'assets', 'archetypes', f), 'utf8')); const r = run('inline.mjs', [dest, 'kit', 'diagram', '--render']); assert.equal(r.status, 0, `${f}: ${r.err}`);
    const l = L(fs.readFileSync(dest, 'utf8')); assert.deepEqual(l.findings.filter((x) => x.level === 'error').map((x) => `${f} ${x.code} ${x.msg}`), []);
  }
});
await test('embed_font refuses remote URLs, embeds a local file idempotently, warns when large', () => {
  const font = path.join(TMP, 'fonts', 'Brand.woff2'); fs.mkdirSync(path.dirname(font), { recursive: true }); fs.writeFileSync(font, Buffer.alloc(2048, 7));
  const page = write('font/page.html', GOOD);
  assert.equal(run('embed_font.mjs', [page, '--file', 'https://fonts.example.com/x.woff2', '--family', 'X']).status, 2); assert.equal(run('embed_font.mjs', [page, '--file', '//cdn.example.com/x.woff2', '--family', 'X']).status, 2);
  assert.equal(run('embed_font.mjs', [page, '--file', font, '--family', 'Brand Sans', '--weight', '400']).status, 0); const once = fs.readFileSync(page, 'utf8');
  assert.ok(once.includes('@font-face') && once.includes('data:font/woff2;base64,') && !/url\(https?:/.test(once));
  run('embed_font.mjs', [page, '--file', font, '--family', 'Brand Sans', '--weight', '400']); assert.equal(fs.readFileSync(page, 'utf8'), once, 'idempotent');
  run('embed_font.mjs', [page, '--file', font, '--family', 'Brand Sans', '--weight', '700']); assert.equal((fs.readFileSync(page, 'utf8').match(/@font-face/g) || []).length, 2, 'second weight adds a face');
  const big = path.join(TMP, 'fonts', 'Big.woff2'); fs.writeFileSync(big, Buffer.alloc(200 * 1024, 1)); const r = run('embed_font.mjs', [page, '--file', big, '--family', 'Big']); assert.equal(r.status, 0); assert.ok(/150 KB/.test(r.err), 'warns above 150 KB');
  assert.equal(run('embed_font.mjs', [page, '--file', path.join(TMP, 'fonts', 'missing.woff2'), '--family', 'M']).status, 2);
  assert.equal(L(fs.readFileSync(page, 'utf8')).findings.filter((f) => f.code === 'L01').length, 0, 'embedded font must not trip the external-URL rule');
});
await test('shoot.mjs without Playwright exits 4 with manual steps, never claims a render', () => {
  const r = run('shoot.mjs', [write('shoot/x.html', GOOD)], { env: { PLAYWRIGHT_PATH: path.join(TMP, 'none'), LOCALAPPDATA: path.join(TMP, 'none'), HOME: path.join(TMP, 'none'), USERPROFILE: path.join(TMP, 'none'), PATH: path.dirname(process.execPath) } });
  if (r.status === 4) { assert.ok(/Playwright was not found|would not launch/.test(r.err)); assert.ok(!/PASS/.test(r.out)); } else assert.ok([0, 1].includes(r.status), `unexpected exit ${r.status}: ${r.err}`);
});

// ───────────────────────── 8. regressions from the independent QA round ─────────────────────────
group('regressions: QA round');
const noCrash = (r, label) => { assert.ok(!/TypeError|ReferenceError|at probe/.test(r.err), `${label} crashed: ${r.err.split('\n').slice(0, 3).join(' | ')}`); assert.ok(r.json, `${label} produced no JSON`); };
await test('I1: text + brand colour with no background does not crash; neutral ground used and recorded', () => {
  const dir = path.join(TMP, 'fx-i1a'); write('fx-i1a/a.css', ':root{--color-text:#111;--color-primary:#0b5fff}');
  const r = probe(dir); noCrash(r, 'I1 css'); const j = r.json;
  assert.equal(r.status, 3, 'partial brand asks the user (exit 3)'); assert.equal(j.ask, true); assert.equal(j.confidence, 'D'); assert.equal(j.unbranded, false, 'real tokens are kept, not thrown away');
  assert.equal(j.palette.ink.value, '#111111'); assert.equal(j.palette.brand.value, '#0B5FFF'); assert.equal(j.palette.bg.derived, true);
  assert.ok(j.gaps.some((g) => /background/.test(g)), 'gap recorded'); assert.ok(j.conflicts.some((c) => c.field === 'bg' && c.kind === 'missing'), 'conflict recorded');
  assert.ok(j.contrastReport.filter((c) => c.fg === 'ink' || c.fg === 'hi').every((c) => c.pass), 'bound text still passes 4.5:1 on the neutral ground');
});
await test('I1: Tailwind {ink, paper} with no background token does not crash', () => {
  const dir = path.join(TMP, 'fx-i1b'); write('fx-i1b/tailwind.config.js', "module.exports = { theme: { extend: { colors: { ink: '#111', paper: '#eee' } } } }");
  const r = probe(dir); noCrash(r, 'I1 tailwind'); assert.ok([0, 3].includes(r.status)); assert.ok(r.json.palette.bg && r.json.palette.ink, 'both a ground and a text colour are bound'); assert.equal(r.json.palette.ink.value, '#111111'); assert.ok(r.json.gaps.length >= 1);
});
await test('I1: light text without a ground gets a dark neutral ground; brand colour alone also survives', () => {
  const a = probe(path.join(TMP, 'fx-i1c')); void a;
  write('fx-i1c/a.css', ':root{--text:#eeeeee;--accent:#ff6600}'); const r = probe(path.join(TMP, 'fx-i1c')); noCrash(r, 'I1 light text');
  assert.equal(r.json.palette.bg.value, '#14130F'); assert.equal(r.json.theme.mode, 'dark'); assert.ok(r.json.contrastReport.find((c) => c.fg === 'ink' && c.bg === 'bg').pass);
  write('fx-i1d/a.css', ':root{--color-primary:#0b5fff}'); const r2 = probe(path.join(TMP, 'fx-i1d')); noCrash(r2, 'I1 brand only'); assert.ok([0, 3].includes(r2.status));
  write('fx-i1e/a.css', ':root{--bg:#ffffff}'); const r3 = probe(path.join(TMP, 'fx-i1e')); noCrash(r3, 'I1 bg only'); assert.ok([0, 3].includes(r3.status));
});
await test('I2: --radius-md: 8px (and sm/lg) is captured into shape.radius and shape.radiusScale', () => {
  write('fx-i2a/a.css', ':root{--bg:#ffffff;--text:#111111;--radius-sm:2px;--radius-xs:3px;--radius-md:8px;--radius-lg:12px}'); const r = probe(path.join(TMP, 'fx-i2a')); noCrash(r, 'I2'); const s = r.json.shape;
  assert.equal(s.radius, '8px'); assert.deepEqual(s.radiusScale, ['0', '2px', '3px', '8px', '12px']); // md is deliberately not the median of the set, so only reading --radius-md itself gives 8px assert.ok(/a\.css/.test(s.radiusSource)); assert.ok(!r.json.gaps.some((g) => /radius/.test(g)), 'no radius gap when tokens exist');
  assert.ok(/--radius: 8px/.test(r.json.rootBlock), 'the bound :root block carries it');
});
await test('I2: --radius wins over --radius-md; rem values sort numerically; Tailwind v4 @theme radius is read', () => {
  write('fx-i2b/a.css', ':root{--bg:#fff;--text:#111;--radius:6px;--radius-md:8px}'); const a = probe(path.join(TMP, 'fx-i2b')).json.shape; assert.equal(a.radius, '6px'); assert.ok(a.radiusScale.includes('8px') && a.radiusScale.includes('6px'));
  write('fx-i2c/a.css', ':root{--bg:#fff;--text:#111;--radius:0.5rem;--radius-lg:1rem;--radius-sm:2px}'); const b = probe(path.join(TMP, 'fx-i2c')).json.shape; assert.equal(b.radius, '0.5rem'); assert.deepEqual(b.radiusScale, ['0', '2px', '0.5rem', '1rem']);
  write('fx-i2d/app.css', '@import "tailwindcss";\n@theme { --color-bg:#fff; --color-ink:#111; --radius-md: 6px; }'); const c = probe(path.join(TMP, 'fx-i2d')).json.shape; assert.equal(c.radius, '6px');
});
await test('I2: falling back to 2px is recorded as a gap and a conflict; a bound radius scale then satisfies lint L06', () => {
  write('fx-i2e/a.css', ':root{--bg:#fff;--text:#111}'); const j = probe(path.join(TMP, 'fx-i2e')).json; assert.equal(j.shape.radius, '2px');
  assert.ok(j.gaps.some((g) => /border-radius/.test(g) && /2px/.test(g)), 'gap'); assert.ok(j.conflicts.some((c) => c.field === 'radius' && c.kind === 'missing'), 'conflict');
  const withScale = L(GOOD.replace('border-radius:var(--radius)', 'border-radius:8px'), { brand: { boundColors: ['#0C0714', '#140C21', '#EDE7F5', '#A99BC0', '#A768F0', '#2E2044'], shape: { radiusScale: ['0', '4px', '8px', '12px'] } } });
  assert.ok(!codes(withScale).includes('L06'), 'a radius that is in the bound scale passes'); assert.ok(codes(L(GOOD.replace('border-radius:var(--radius)', 'border-radius:8px'))).includes('L06'), 'but not against the default scale');
});
await test('M1: matrix_md --help / -h print usage, exit 0 and never touch matrix.md; unknown flags exit 2 untouched', () => {
  const f = path.join(SKILL, 'references', 'matrix.md'); const before = fs.readFileSync(f, 'utf8'); const m0 = fs.statSync(f).mtimeMs;
  for (const flag of ['--help', '-h']) { const r = run('matrix_md.mjs', [flag]); assert.equal(r.status, 0, flag); assert.ok(/usage: node matrix_md\.mjs/.test(r.out), `${flag} prints usage`); assert.ok(!/wrote /.test(r.out), 'nothing written'); }
  for (const args of [['--bogus'], ['--check', '--nope'], ['extra']]) { const r = run('matrix_md.mjs', args); assert.equal(r.status, 2, args.join(' ')); assert.ok(/unknown argument/.test(r.err)); }
  assert.equal(fs.readFileSync(f, 'utf8'), before, 'matrix.md content unchanged'); assert.equal(fs.statSync(f).mtimeMs, m0, 'matrix.md was not rewritten'); assert.equal(run('matrix_md.mjs', ['--check']).status, 0);
});
await test('M8: live queries vary across seeds, stay deterministic per seed, span source families and keep the privacy gate', () => {
  const live = (slug, kind = 'performance-results') => roll.roll({ kind, slug }).live; const sets = new Set(); const sources = new Set(); let grammar = 0, awwwards = 0;
  for (let i = 0; i < 30; i++) { const l = live('creative-' + i); sets.add(l.queries.join('|')); l.picks.forEach((p) => sources.add(p.source)); grammar += l.picks.filter((p) => p.source === 'grammar' && /chart-doctor|codrops|evidence/.test(p.query)).length; awwwards += l.picks.filter((p) => p.source === 'awwwards' && /awwwards/.test(p.query)).length;
    assert.ok(l.search.length <= 3, 'at most 3 searches'); assert.equal(l.search[0].source, 'pinterest'); assert.deepEqual(l.search[0].allowed_domains, ['pinterest.com']); assert.deepEqual(l.search[1].allowed_domains, ['dribbble.com', 'behance.net']); }
  assert.ok(sets.size >= 10, `only ${sets.size} distinct query sets over 30 seeds (the old behaviour returned one)`); assert.deepEqual([...sources].sort(), ['awwwards', 'dribbble', 'grammar', 'pinterest']); assert.ok(grammar > 0 && awwwards > 0);
  assert.equal(JSON.stringify(live('same-seed')), JSON.stringify(live('same-seed')), 'deterministic per seed');
  for (const kind of Object.keys(roll.KINDS)) assert.ok(new Set(Array.from({ length: 12 }, (_, i) => live('v' + i, kind).queries[0])).size >= 2, `${kind}: first query rotates`);
  const priv = roll.roll({ kind: 'dashboard', slug: 'hazelwood-portal-x' }); assert.ok(!priv.live.queries.join(' ').toLowerCase().includes('hazelwood'), 'slug words never reach a query');
  const a = roll.roll({ kind: 'dashboard', slug: 'same' }), b = roll.roll({ kind: 'dashboard', slug: 'same', offline: true }); delete a.live; assert.equal(JSON.stringify(a), JSON.stringify(b), 'sampling queries must not change the deal');
  const hit = live('gate-check').queries.join(' ').toLowerCase().match(/[a-z]{5,}/)[0]; assert.equal(roll.roll({ kind: 'performance-results', slug: 'gate-check', deny: [hit] }).live.skipped, 'privacy-gate');
});
await test('M2: scrolling wrappers are keyboard focusable (kit, diagram, archetypes, css) and lint enforces it', () => {
  assert.ok(/class="table-wrap" tabindex="0"/.test(Kit.chart.svg('bar', CHARTS.bar)), 'chart data table wrapper'); assert.ok(/class="kit-plot" tabindex="0"/.test(Diagram.svg(DAG)), 'diagram scroll region');
  assert.ok(/\.table-wrap:focus-visible/.test(fs.readFileSync(path.join(SKILL, 'assets', 'kit', 'kit.css'), 'utf8')), 'focus style in kit.css');
  for (const f of fs.readdirSync(path.join(SKILL, 'assets', 'archetypes'))) { const t = fs.readFileSync(path.join(SKILL, 'assets', 'archetypes', f), 'utf8'); for (const m of t.matchAll(/<div class="table-wrap"[^>]*>/g)) assert.ok(/tabindex="0"/.test(m[0]), `${f}: ${m[0]}`); }
  const r = L(GOOD.replace('class="table-wrap" tabindex="0"', 'class="table-wrap"')); assert.ok(r.findings.some((x) => x.code === 'L10' && /tabindex/.test(x.msg)), 'lint flags a scroll wrapper without tabindex');
});
await test('M3: ambient-skeleton passes lint --ambient, fails stage-artifact lint, and --ambient only allows loopback fetch', () => {
  const amb = fs.readFileSync(path.join(MOTION, 'assets', 'ambient-skeleton.html'), 'utf8');
  const a = L(amb, { ambient: true }); assert.deepEqual(a.findings.filter((f) => f.level === 'error').map((f) => f.code + ' ' + f.msg), [], 'ambient skeleton'); assert.ok(a.findings.some((f) => f.code === 'L01' && f.level === 'info'), 'the allowed fetch is reported, not hidden');
  assert.ok(codes(L(amb)).includes('L01'), 'a stage artifact may never fetch'); assert.equal(run('lint.mjs', [path.join(MOTION, 'assets', 'ambient-skeleton.html'), '--ambient']).status, 0); assert.equal(run('lint.mjs', [path.join(MOTION, 'assets', 'ambient-skeleton.html')]).status, 1);
  assert.ok(/<main\b/.test(amb) && /<h1\b/.test(amb) && /:focus-visible/.test(amb), 'landmark, heading and focus rule are in the page itself');
  const page = (url) => GOOD.replace('</body>', `<script>var E='${url}';fetch(E)</script></body>`);
  assert.ok(!codes(L(page('http://localhost:8765/s.json'), { ambient: true })).includes('L01'), 'localhost ok'); assert.ok(!codes(L(page('http://127.0.0.1:9/s.json'), { ambient: true })).includes('L01'), '127.0.0.1 ok');
  assert.ok(codes(L(page('https://example.com/s.json'), { ambient: true })).includes('L01'), 'a remote fetch fails even in ambient mode'); assert.ok(codes(L(page('http://localhost:8765/s.json'))).includes('L01'), 'and loopback fails outside ambient mode');
  assert.ok(codes(L(amb.replace(/<main[^>]*>/, '<div>').replace('</main>', '</div>'), { ambient: true })).includes('L12'), 'ambient needs a main landmark');
  const doc = fs.readFileSync(path.join(MOTION, 'SKILL.md'), 'utf8'); assert.ok(/--ambient/.test(doc) && /loopback/.test(doc) && /zero network/.test(doc), 'html-motion SKILL.md documents the split');
});
await test('M4: morph keeps a clean gap between words that share a line (Staff / re-key)', () => {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 10 }) : k === Symbol.toPrimitive ? () => 0 : any()), apply: () => any(), set: () => true });
  const win = { URLSearchParams, Math, JSON, Object, Array, Date, matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, removeEventListener() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, devicePixelRatio: 1, location: { search: '' }, innerWidth: 1000, innerHeight: 800, console, setTimeout, clearTimeout, performance: { now: () => 0 } };
  win.window = win; win.self = win; const ctx = vm.createContext(Object.assign(win, { document: { fonts: null, addEventListener() {}, hidden: false, documentElement: any(), createElement: () => ({ getContext: () => any(), style: {} }) }, navigator: {}, getComputedStyle: () => any() }));
  for (const f of ['_core.js', 'morph.js']) vm.runInContext(fs.readFileSync(path.join(MOTION, 'assets', 'engines', f), 'utf8'), ctx, { filename: f });
  const spread = ctx.Engines.morph.spread; assert.equal(typeof spread, 'function');
  const pad = 9, lh = 56; const gaps = (a) => { const s = a.slice().sort((p, q) => p.x - q.x); return s.slice(1).map((w, i) => w.x - (s[i].x + s[i].m)); };
  const mid = [{ w: 'Staff', x: 100, y: 300, m: 140 }, { w: 're-key', x: 190, y: 304, m: 150 }, { w: 'income', x: 250, y: 298, m: 160 }, { w: 'below', x: 120, y: 420, m: 100 }];
  const out = spread(mid.map((w) => ({ ...w })), pad, lh); assert.ok(gaps(out.filter((w) => w.y < 400)).every((g) => g >= pad - 1e-9), `same-line gaps ${gaps(out.filter((w) => w.y < 400))}`);
  assert.equal(out.find((w) => w.w === 'below').x, 120, 'a word on another line is untouched'); assert.deepEqual(out.filter((w) => w.y < 400).sort((a, b) => a.x - b.x).map((w) => w.w), ['Staff', 're-key', 'income'], 'order preserved');
  const rest = [{ x: 100, y: 300, m: 140 }, { x: 249, y: 300, m: 150 }, { x: 408, y: 300, m: 160 }]; assert.deepEqual(spread(rest.map((w) => ({ ...w })), pad, lh).map((w) => w.x), rest.map((w) => w.x), 'a settled line (one full space between words) does not move');
  const src = fs.readFileSync(path.join(MOTION, 'assets', 'engines', 'morph.js'), 'utf8'); const mv = /smooth\(\.3, \.85, p\)/.test(src), inn = /inn = core\.smooth\(\.75, 1, p\)/.test(src); assert.ok(mv && inn, 'new words arrive (from .75) only after shared words have nearly finished travelling (to .85)');
  const gallery = fs.readFileSync(path.join(MOTION, 'assets', 'engine-gallery.html'), 'utf8'); assert.ok(gallery.includes('Engines.morph.spread'), 'the gallery carries the fixed morph engine (regenerate it with inline_engines after editing an engine)');
});
await test('M5: L05 ignores fallback hexes inside inlined runtime markers while still rejecting page palette drift', () => {
  const f = write('lint/inlined-motion.html', GOOD);
  assert.equal(run('inline.mjs', [f, 'kit', 'graph']).status, 0);
  const inlined = fs.readFileSync(f, 'utf8');
  const brand = { boundColors: ['#0C0714', '#140C21', '#EDE7F5', '#A99BC0', '#A768F0', '#2E2044'] };
  const clean = lintMod.lint(inlined, { brand });
  assert.deepEqual(clean.findings.filter((x) => x.code === 'L05'), [], 'inlined _core.js fallback defaults should not trip L05');
  const drifted = lintMod.lint(inlined.replace('</body>', '<p style="color:#123456">bad</p></body>'), { brand });
  assert.ok(drifted.findings.some((x) => x.code === 'L05' && /#123456/.test(x.msg)), 'stray page hex outside inlined markers still fails L05');
});

// ───────────────────────── summary ─────────────────────────
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
const failed = results.filter((r) => !r.ok); const groups = [...new Set(results.map((r) => r.group))];
console.log('');
for (const g of groups) { const rs = results.filter((r) => r.group === g); console.log(`${rs.every((r) => r.ok) ? 'PASS' : 'FAIL'}  ${g.padEnd(34)} ${rs.filter((r) => r.ok).length}/${rs.length}`); }
console.log(`\n${results.length - failed.length}/${results.length} tests passed${failed.length ? `, ${failed.length} failed` : ''}`);
process.exit(failed.length ? 1 : 0);
