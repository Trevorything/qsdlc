#!/usr/bin/env node
// roll.mjs — deal the STRUCTURE of an artifact. Never colour, never type.
//
//   node roll.mjs --kind performance-results --slug checkout-flow [options]
//
// Options
//   --kind K          inspo | design-pitch-deck | implementation-process-map |
//                     performance-results | release-notes | dashboard   (required)
//   --slug S          feature slug (required; part of the seed)
//   --roll-index N    bump to deliberately "refresh the look" (default 0)
//   --seed N          override the derived seed
//   --history FILE    JSON array of earlier deals; recent cards are less likely
//   --record          append this deal to --history (off by default so reruns stay identical)
//   --prev ID         archetype of the previous artifact in this feature (rhythm)
//   --has LIST        data actually present, e.g. metrics=6,baseline,counts,steps=4
//                     Cards whose `needs` are unmet are dropped. Omit it and needs
//                     are assumed met (recorded as needsAssumed).
//   --budget B        low | med | high   max cost of any single card (default med)
//   --long            long page: allow two signature moments
//   --pin             recurring dashboard: ignore history, mark pinned (stable look)
//   --offline         skip live-wildcard query generation
//   --deny LIST       extra terms that must never appear in a live query
//   --deny-from FILES comma list of files (Intent.md, spec.md); their title line is denied
//   --queries         print only the privacy-safe inspiration queries and exit
//   --out FILE        also write the roll json to FILE
//
// Same slug|kind|rollIndex (and same inputs) always produce byte-identical output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MATRIX_DIR = path.join(HERE, '..', 'assets', 'matrix');
const COST = { low: 1, med: 2, high: 3 };
const DECORATIVE = new Set(['field', 'streams']);

export const KINDS = {
  'inspo': {
    narrative: 'scene → tension → resolution',
    counts: { bi: [0, 1], motion: [1, 2] },
    dials: { variance: 7, motion: 5, density: 3 },
    queries: ['editorial type poster', 'swiss grid typography', 'mood board texture layout', 'scrollytelling opener'],
    awwwards: '/websites/?tag=typography'
  },
  'design-pitch-deck': {
    narrative: 'problem → vision → proof',
    counts: { bi: [1, 1], motion: [2, 2] },
    dials: { variance: 6, motion: 5, density: 4 },
    queries: ['pitch deck editorial layout', 'product vision case study layout', 'before after comparison layout', 'architecture diagram aesthetic'],
    awwwards: '/websites/?tag=business'
  },
  'implementation-process-map': {
    narrative: 'inputs → hand-offs → outputs',
    counts: { bi: [1, 2], motion: [2, 2] },
    dials: { variance: 5, motion: 4, density: 6 },
    queries: ['subway map diagram design', 'technical blueprint diagram', 'swimlane process infographic', 'dependency graph ui'],
    awwwards: '/websites/data-visualization/'
  },
  'performance-results': {
    narrative: 'claim → evidence → caveat',
    counts: { bi: [3, 3], motion: [1, 2] },
    dials: { variance: 3, motion: 2, density: 8 },
    queries: ['bullet chart dashboard', 'small multiples dashboard', 'test results report design', 'distribution dot strip chart'],
    awwwards: '/websites/dashboard/'
  },
  'release-notes': {
    narrative: 'what changed → why it matters → what you do next',
    counts: { bi: [1, 1], motion: [1, 2] },
    dials: { variance: 5, motion: 3, density: 3 },
    queries: ['changelog page design', 'release notes editorial', 'annotated screenshot callouts', 'product update newsletter layout'],
    awwwards: '/websites/?tag=saas'
  },
  'dashboard': {
    narrative: 'state → delta → action',
    counts: { bi: [3, 3], motion: [1, 2] },
    dials: { variance: 3, motion: 3, density: 8 },
    queries: ['ops dashboard small multiples', 'audit scorecard ui', 'triage board design', 'executive kpi one page'],
    awwwards: '/websites/dashboard/'
  }
};

// ---------- deterministic primitives ----------
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- matrix ----------
export function loadMatrix(dir = MATRIX_DIR) {
  const read = (n) => JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8'));
  return {
    archetype: read('archetypes').cards,
    bi: read('bi').cards,
    motion: read('motion').cards,
    finish: read('finish').cards,
    signature: read('signature').cards
  };
}

export function parseHas(str) {
  const has = {};
  if (!str) return has;
  for (const part of String(str).split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = part.split('=');
    has[k] = v === undefined ? true : Number(v);
  }
  return has;
}

function needMet(need, has, assumed) {
  const m = /^([a-z-]+)>=(\d+)$/.exec(need);
  if (m) return assumed ? true : typeof has[m[1]] === 'number' && has[m[1]] >= Number(m[2]);
  if (need === 'explicit-user-request') return Boolean(has['explicit-user-request']);
  return assumed ? true : Boolean(has[need]);
}

function eligible(cards, kind, has, assumed, maxCost) {
  return cards.filter(
    (c) =>
      c.weight > 0 &&
      (c.fits || []).includes(kind) &&
      COST[c.cost] <= maxCost &&
      (c.needs || []).every((n) => needMet(n, has, assumed))
  );
}

function recencyFactor(id, history) {
  const recent = history.slice(-20);
  let seen = 0;
  for (const h of recent) {
    const ids = [h.archetype, ...(h.bi || []), ...(h.motion || []), ...(h.finish || []), h.signature];
    if (ids.includes(id)) seen++;
  }
  return Math.pow(0.35, seen);
}

// weighted order without replacement (Efraimidis–Spirakis): key = u^(1/w), descending
function weightedOrder(cards, rng, history) {
  return cards
    .map((c) => ({ c, key: Math.pow(rng(), 1 / Math.max(1e-6, c.weight * recencyFactor(c.id, history))) }))
    .sort((a, b) => b.key - a.key || (a.c.id < b.c.id ? -1 : 1))
    .map((x) => x.c);
}

function clampDial(n) { return Math.max(1, Math.min(10, n)); }

// ---------- the roll ----------
export function roll(opts) {
  const kind = opts.kind;
  if (!KINDS[kind]) throw new Error(`unknown --kind "${kind}". Use one of: ${Object.keys(KINDS).join(', ')}`);
  if (!opts.slug) throw new Error('--slug is required');
  const matrix = opts.matrix || loadMatrix();
  const spec = KINDS[kind];
  const rollIndex = Number(opts.rollIndex || 0);
  const seed = opts.seed !== undefined && opts.seed !== null ? Number(opts.seed) >>> 0 : fnv1a(`${opts.slug}|${kind}|${rollIndex}`);
  const rng = mulberry32(seed);
  const pinned = Boolean(opts.pin);
  const history = pinned ? [] : opts.history || [];
  const prev = pinned ? null : opts.prev || (history.length ? history[history.length - 1].archetype : null);
  const assumed = !opts.has || Object.keys(opts.has).length === 0;
  const has = opts.has || {};
  const maxCost = COST[opts.budget || 'med'];
  const notes = [];

  const dealt = new Set();
  const state = { high: 0, decorative: 0 };
  const blocked = new Set();
  const take = (card) => {
    dealt.add(card.id);
    (card.avoid || []).forEach((a) => blocked.add(a));
    if (card.cost === 'high') state.high++;
    if (DECORATIVE.has(card.id)) state.decorative++;
  };
  const allowed = (c) =>
    !dealt.has(c.id) &&
    !blocked.has(c.id) &&
    !(c.avoid || []).some((a) => dealt.has(a)) &&
    !(c.cost === 'high' && state.high >= 1) &&
    !(DECORATIVE.has(c.id) && state.decorative >= 1);

  // 1. archetype — never the same as the previous artifact in this feature
  let pool = eligible(matrix.archetype, kind, has, assumed, maxCost);
  let order = weightedOrder(pool, rng, history).filter((c) => c.id !== prev);
  if (!order.length) {
    // fall back to the kind's lowest-cost card, log why
    const fb = matrix.archetype.filter((c) => c.weight > 0 && (c.fits || []).includes(kind)).sort((a, b) => COST[a.cost] - COST[b.cost])[0];
    notes.push(`archetype pool empty after filters; fell back to ${fb ? fb.id : 'none'}`);
    order = fb ? [fb] : [];
  }
  const archetype = order[0];
  if (archetype) take(archetype);

  // 2. BI cards — must be compatible with data present
  const [biMin, biMax] = spec.counts.bi;
  const biN = biMin + Math.floor(rng() * (biMax - biMin + 1));
  const bi = [];
  for (const c of weightedOrder(eligible(matrix.bi, kind, has, assumed, maxCost), rng, history)) {
    if (bi.length >= biN) break;
    if (allowed(c)) { bi.push(c); take(c); }
  }
  if (bi.length < biMin) notes.push(`only ${bi.length} of ${biMin} BI cards fit the data present`);

  // 3. motion — at most one decorative layer, at most one high-cost card
  const [mMin, mMax] = spec.counts.motion;
  const mN = mMin + Math.floor(rng() * (mMax - mMin + 1));
  const motion = [];
  for (const c of weightedOrder(eligible(matrix.motion, kind, has, assumed, maxCost), rng, history)) {
    if (motion.length >= mN) break;
    if (allowed(c)) { motion.push(c); take(c); }
  }

  // 4. finish ×2
  const finish = [];
  for (const c of weightedOrder(eligible(matrix.finish, kind, has, assumed, maxCost), rng, history)) {
    if (finish.length >= 2) break;
    if (allowed(c)) { finish.push(c); take(c); }
  }

  // 5. signature ×1 (×2 when --long)
  const sigN = opts.long ? 2 : 1;
  const signatures = [];
  for (const c of weightedOrder(eligible(matrix.signature, kind, has, assumed, maxCost), rng, history)) {
    if (signatures.length >= sigN) break;
    if (allowed(c)) { signatures.push(c); take(c); }
  }

  const jitter = () => Math.round((rng() - 0.5) * 2);
  const dials = {
    variance: clampDial(spec.dials.variance + jitter()),
    motion: clampDial(spec.dials.motion + jitter()),
    density: clampDial(spec.dials.density + jitter())
  };

  const refs = [...new Set([archetype, ...bi, ...motion].filter(Boolean).flatMap((c) => c.refs || []))].sort();
  const result = {
    schema: 1,
    kind,
    slug: opts.slug,
    seed,
    rollIndex,
    pinned,
    needsAssumed: assumed,
    dials,
    narrative: spec.narrative,
    archetype: archetype ? archetype.id : null,
    skeleton: archetype && archetype.skeleton ? archetype.skeleton : null,
    bi: bi.map((c) => c.id),
    motion: motion.map((c) => c.id),
    finish: finish.map((c) => c.id),
    signature: signatures[0] ? signatures[0].id : null,
    signatureExtra: signatures[1] ? signatures[1].id : null,
    reduced: Object.fromEntries([archetype, ...bi, ...motion].filter(Boolean).map((c) => [c.id, c.reduced])),
    phone: Object.fromEntries([archetype, ...bi, ...motion].filter(Boolean).map((c) => [c.id, c.phone])),
    refs,
    notes
  };

  if (!opts.offline) result.live = buildLive(result, opts);
  return result;
}

// ---------- privacy-safe inspiration queries ----------
function words(s) { return String(s || '').toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || []; }

export function buildDenylist({ slug, deny = [], denyFrom = [] }) {
  const out = new Set(words(slug));
  deny.forEach((d) => words(d).forEach((w) => out.add(w)));
  for (const f of denyFrom) {
    try {
      const text = fs.readFileSync(f, 'utf8');
      const title = (text.match(/^#\s+(.+)$/m) || [])[1] || '';
      words(title).forEach((w) => out.add(w));
    } catch { /* unreadable file: nothing to deny from it */ }
  }
  // generic words are not secrets
  ['the', 'and', 'for', 'design', 'feature', 'intent', 'spec', 'plan', 'with', 'from'].forEach((g) => out.delete(g));
  return [...out].sort();
}

/**
 * Inspiration queries, one per source family, sampled with the roll's own rng so different seeds and slugs surface different creative
 * directions while one seed always gives the same queries. Pools are built ONLY from the kind's recipe and the dealt cards' names
 * and relationships (grammar keywords), never from feature text; the denylist gate still runs over whatever is picked.
 *   ctx = { rng, archetype: card, bi: [card], motion: [card] }
 * Returns [{ source: 'pinterest'|'dribbble'|'awwwards'|'grammar', query, domains? }]
 */
export function buildQueryPicks(kind, ctx = {}) {
  const spec = KINDS[kind];
  if (!spec) return [];
  const rng = ctx.rng || mulberry32(fnv1a(kind));
  const low = (s) => String(s || '').toLowerCase();
  const arch = ctx.archetype ? low(ctx.archetype.name) : '';
  const bis = ctx.bi || [], mos = ctx.motion || [];
  const pools = {
    pinterest: { domains: ['pinterest.com'], q: [...spec.queries, arch && `${arch} layout moodboard`, arch && `${arch} editorial composition`] },
    dribbble: { domains: ['dribbble.com', 'behance.net'], q: [...spec.queries, ...bis.map((c) => `${low(c.name)} dashboard ui`), arch && `${arch} ui design`] },
    awwwards: { domains: null, q: [`${arch || spec.queries[0]} awwwards site of the day`, `${mos[0] ? low(mos[0].name) : 'scroll'} interaction awwwards`, `${spec.queries[0]} awwwards`] },
    grammar: { domains: null, q: [...bis.map((c) => `chart-doctor visual vocabulary ${low(c.relationship)}`), ...mos.map((c) => `codrops ${low(c.name)} animation`), `evidence dev ${low(bis[0] ? bis[0].name : 'report')} component`] }
  };
  const picks = [];
  for (const [source, p] of Object.entries(pools)) {
    const q = [...new Set(p.q.filter(Boolean))];
    if (q.length) picks.push({ source, query: q[Math.floor(rng() * q.length)], domains: p.domains });
  }
  return picks;
}

export function buildQueries(kind, ctx = {}) { return buildQueryPicks(kind, ctx).map((p) => p.query); }

function buildLive(result, opts) {
  const matrix = opts.matrix || loadMatrix();
  const arch = matrix.archetype.find((c) => c.id === result.archetype);
  const byId = (deck, ids) => ids.map((id) => matrix[deck].find((c) => c.id === id)).filter(Boolean);
  const qrng = mulberry32((result.seed ^ 0x9e3779b9) >>> 0); // its own stream: sampling queries never disturbs the deal
  const picks = buildQueryPicks(result.kind, { rng: qrng, archetype: arch, bi: byId('bi', result.bi), motion: byId('motion', result.motion) });
  const queries = picks.map((p) => p.query);
  const deny = buildDenylist({ slug: result.slug, deny: opts.deny || [], denyFrom: opts.denyFrom || [] });
  const hit = queries.find((q) => words(q).some((w) => deny.includes(w)));
  if (hit) return { skipped: 'privacy-gate', reason: `query "${hit}" contains a denied term`, queries: [] };
  const spec = KINDS[result.kind];
  return {
    queries,
    picks,
    // at most 3 searches: pinterest, dribbble/behance, then awwwards or the grammar source (FT Visual Vocabulary / Codrops / Evidence), whichever the rng chose
    search: [picks[0], picks[1], qrng() < 0.5 ? picks[2] : picks[3]].filter(Boolean).map((p) => ({ tool: 'WebSearch', mode: 'standard', ...(p.domains ? { allowed_domains: p.domains } : {}), query: p.query, source: p.source })),
    awwwards: `https://www.awwwards.com${spec.awwwards}`,
    fetchable: ['awwwards.com', 'evidence.dev', 'pudding.cool', 'ft-interactive.github.io'],
    nameOnly: ['pinterest.com', 'dribbble.com', 'behance.net', 'recent.design', 'mobbin.com'],
    rules: ['at most 3 references', 'distil each to one sentence of grammar', 'never copy palette, type, imagery or copy', 'skip on any error or 429']
  };
}

// ---------- CLI ----------
function parseArgs(argv) {
  const o = {};
  const bool = new Set(['long', 'pin', 'offline', 'queries', 'record']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (bool.has(k)) o[k] = true;
    else o[k] = argv[++i];
  }
  return o;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || !a.kind || !a.slug) {
    console.error('usage: node roll.mjs --kind <kind> --slug <slug> [--roll-index N] [--seed N] [--history file] [--record] [--prev id] [--has list] [--budget low|med|high] [--long] [--pin] [--offline] [--deny list] [--deny-from files] [--queries] [--out file]');
    console.error('kinds: ' + Object.keys(KINDS).join(', '));
    process.exit(a.help ? 0 : 2);
  }
  try {
    let history = [];
    if (a.history && fs.existsSync(a.history)) history = JSON.parse(fs.readFileSync(a.history, 'utf8'));
    const result = roll({
      kind: a.kind, slug: a.slug, rollIndex: a.rollIndex, seed: a.seed, history, prev: a.prev,
      has: parseHas(a.has), budget: a.budget, long: a.long, pin: a.pin, offline: a.offline,
      deny: a.deny ? a.deny.split(',') : [], denyFrom: a.denyFrom ? a.denyFrom.split(',') : []
    });
    if (a.queries) {
      console.log(JSON.stringify(result.live || { skipped: 'offline' }, null, 2));
      return;
    }
    const json = JSON.stringify(result, null, 2) + '\n';
    if (a.out) { fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true }); fs.writeFileSync(a.out, json); }
    if (a.history && a.record && !a.pin) {
      const h = [...history, { archetype: result.archetype, bi: result.bi, motion: result.motion, finish: result.finish, signature: result.signature }].slice(-40);
      fs.writeFileSync(a.history, JSON.stringify(h, null, 2) + '\n');
    }
    process.stdout.write(json);
  } catch (e) {
    console.error('roll: ' + e.message);
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
