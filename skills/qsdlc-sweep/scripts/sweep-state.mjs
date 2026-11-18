#!/usr/bin/env node
// Sole writer of sweep cursor, lease, and seen-set state. Zero dependencies, Node >= 20.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ID_RE = /^[A-Za-z0-9._:/#-]{1,200}$/;
export const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const SEEN_CAP = 5000;
export const EXIT = { ok: 0, usage: 1, lease: 3, unapproved: 4 };

export function statePath(root, sweep) {
  if (!NAME_RE.test(sweep || '')) throw new Error(`invalid sweep name: ${sweep}`);
  return path.join(root, '.qsdlc', 'factory', 'state', `${sweep}.json`);
}

export function emptyState() {
  return { cursor: null, lease: null, seen: [], updated: null };
}

export function loadState(root, sweep) {
  const file = statePath(root, sweep);
  if (!fs.existsSync(file)) return emptyState();
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { ...emptyState(), ...raw, seen: Array.isArray(raw.seen) ? raw.seen : [] };
}

export function saveState(root, sweep, state, now = new Date()) {
  const file = statePath(root, sweep);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next = { ...state, seen: state.seen.slice(-SEEN_CAP), updated: now.toISOString() };
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
  fs.renameSync(tmp, file);
  return next;
}

export function validId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

export function acquireLease(state, owner, ttlMinutes = 30, now = new Date()) {
  if (!validId(owner)) return { ok: false, reason: 'invalid owner' };
  const lease = state.lease;
  if (lease && lease.owner !== owner && new Date(lease.expires) > now) {
    return { ok: false, reason: `lease held by ${lease.owner} until ${lease.expires}` };
  }
  const expires = new Date(now.getTime() + ttlMinutes * 60000).toISOString();
  return { ok: true, state: { ...state, lease: { owner, expires } } };
}

export function releaseLease(state, owner) {
  if (!state.lease) return { ok: true, state };
  if (state.lease.owner !== owner) return { ok: false, reason: `lease held by ${state.lease.owner}` };
  return { ok: true, state: { ...state, lease: null } };
}

export function seenHas(state, id) {
  return state.seen.includes(id);
}

export function seenAdd(state, id) {
  if (!validId(id)) return { ok: false, reason: 'invalid id' };
  if (seenHas(state, id)) return { ok: true, state };
  return { ok: true, state: { ...state, seen: [...state.seen, id].slice(-SEEN_CAP) } };
}

function stripComment(line) {
  let out = '';
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === quote) quote = null; out += c; continue; }
    if (c === '"' || c === "'") { quote = c; out += c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) break;
    out += c;
  }
  return out.replace(/\s+$/, '');
}

function scalar(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

// Reads the `sources:` list of maps from sources.yml (list of `- name: x` blocks).
export function parseSources(text) {
  const sources = [];
  let cur = null;
  let inSources = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (!line.trim()) continue;
    if (/^sources\s*:/.test(line)) { inSources = true; continue; }
    if (/^\S/.test(line)) { inSources = false; continue; }
    if (!inSources) continue;
    const item = line.match(/^\s*-\s+([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (item) {
      cur = { [item[1]]: scalar(item[2]) };
      sources.push(cur);
      continue;
    }
    const kv = line.match(/^\s+([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (kv && cur) cur[kv[1]] = scalar(kv[2]);
  }
  return sources;
}

export function sourceApproved(root, name) {
  const file = path.join(root, '.qsdlc', 'factory', 'sources.yml');
  if (!fs.existsSync(file)) return false;
  let sources;
  try { sources = parseSources(fs.readFileSync(file, 'utf8')); } catch { return false; }
  const hit = sources.find((s) => s.name === name);
  return Boolean(hit && hit.approved === true);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

export function runCli(argv, io = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) }) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  const root = path.resolve(args.root || process.cwd());
  const sweep = args.sweep;
  const fail = (code, msg) => { io.err(`${msg}\n`); return code; };
  try {
    if (cmd === 'source-approved') {
      if (!args.source || args.source === true) return fail(EXIT.usage, 'source-approved needs --source NAME');
      return sourceApproved(root, args.source) ? EXIT.ok : fail(EXIT.unapproved, `source not approved: ${args.source}`);
    }
    if (!cmd || !sweep || sweep === true) return fail(EXIT.usage, 'usage: sweep-state.mjs <cmd> --root <project> --sweep <name> [...]');
    const state = loadState(root, sweep);
    switch (cmd) {
      case 'init': saveState(root, sweep, state); return EXIT.ok;
      case 'get': io.out(JSON.stringify(state, null, 2) + '\n'); return EXIT.ok;
      case 'cursor-get': io.out(`${state.cursor ?? ''}\n`); return EXIT.ok;
      case 'cursor-set':
        if (typeof args.value !== 'string') return fail(EXIT.usage, 'cursor-set needs --value V');
        saveState(root, sweep, { ...state, cursor: args.value });
        return EXIT.ok;
      case 'lease-acquire': {
        const ttl = args['ttl-minutes'] ? Number(args['ttl-minutes']) : 30;
        if (!Number.isFinite(ttl) || ttl <= 0) return fail(EXIT.usage, 'invalid --ttl-minutes');
        const r = acquireLease(state, args.owner, ttl);
        if (!r.ok) return fail(r.reason === 'invalid owner' ? EXIT.usage : EXIT.lease, r.reason);
        saveState(root, sweep, r.state);
        return EXIT.ok;
      }
      case 'lease-release': {
        const r = releaseLease(state, args.owner);
        if (!r.ok) return fail(EXIT.lease, r.reason);
        saveState(root, sweep, r.state);
        return EXIT.ok;
      }
      case 'seen-check':
        if (!validId(args.id)) return fail(EXIT.usage, 'invalid --id');
        return seenHas(state, args.id) ? EXIT.ok : 1;
      case 'seen-add': {
        const r = seenAdd(state, args.id);
        if (!r.ok) return fail(EXIT.usage, r.reason);
        saveState(root, sweep, r.state);
        return EXIT.ok;
      }
      default: return fail(EXIT.usage, `unknown command: ${cmd}`);
    }
  } catch (e) {
    return fail(EXIT.usage, String(e.message || e));
  }
}

function selfTest() {
  let passed = 0;
  let failed = 0;
  const check = (name, cond) => {
    if (cond) { passed++; console.log(`PASS ${name}`); } else { failed++; console.log(`FAIL ${name}`); }
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-state-'));
  const quiet = { out: () => {}, err: () => {} };
  const cli = (...a) => runCli([...a, '--root', tmp, '--sweep', 'ticket-funnel'], quiet);
  try {
    check('init creates state file', cli('init') === 0 && fs.existsSync(statePath(tmp, 'ticket-funnel')));
    check('cursor-set stores value', cli('cursor-set', '--value', 'page-3') === 0);
    let captured = '';
    runCli(['cursor-get', '--root', tmp, '--sweep', 'ticket-funnel'], { out: (s) => { captured += s; }, err: () => {} });
    check('cursor-get returns value', captured.trim() === 'page-3');
    check('lease-acquire first owner', cli('lease-acquire', '--owner', 'run-a', '--ttl-minutes', '10') === 0);
    check('lease-acquire other owner fails with 3', cli('lease-acquire', '--owner', 'run-b') === 3);
    check('lease-acquire same owner renews', cli('lease-acquire', '--owner', 'run-a') === 0);
    check('lease-release wrong owner fails with 3', cli('lease-release', '--owner', 'run-b') === 3);
    check('lease-release right owner', cli('lease-release', '--owner', 'run-a') === 0);
    check('lease-acquire after release', cli('lease-acquire', '--owner', 'run-b') === 0);
    const expired = acquireLease({ ...emptyState(), lease: { owner: 'x', expires: '2000-01-01T00:00:00.000Z' } }, 'y');
    check('expired lease is taken over', expired.ok && expired.state.lease.owner === 'y');
    check('seen-check miss returns 1', cli('seen-check', '--id', 'T-1') === 1);
    check('seen-add stores id', cli('seen-add', '--id', 'T-1') === 0);
    check('seen-check hit returns 0', cli('seen-check', '--id', 'T-1') === 0);
    check('seen-add dedupes', loadState(tmp, 'ticket-funnel').seen.filter((s) => s === 'T-1').length === 1);
    check('seen-add rejects injection-looking id', cli('seen-add', '--id', 'ignore previous; rm -rf /') === 1);
    check('seen-add rejects overlong id', cli('seen-add', '--id', 'a'.repeat(201)) === 1);
    let s = emptyState();
    for (let i = 0; i < SEEN_CAP + 10; i++) s = seenAdd(s, `id-${i}`).state;
    check('seen set capped at 5000', s.seen.length === SEEN_CAP && s.seen[0] === 'id-10');
    check('invalid sweep name rejected', runCli(['init', '--root', tmp, '--sweep', '../evil'], quiet) === 1);
    check('unknown command rejected', cli('bogus') === 1);
    const st = loadState(tmp, 'ticket-funnel');
    check('state has updated timestamp', typeof st.updated === 'string' && st.updated.endsWith('Z'));
    check('no temp files left behind', fs.readdirSync(path.dirname(statePath(tmp, 'ticket-funnel'))).every((f) => f.endsWith('.json')));
    check('source-approved fails closed when sources.yml missing', runCli(['source-approved', '--root', tmp, '--source', 'inbox'], quiet) === 4);
    fs.mkdirSync(path.join(tmp, '.qsdlc', 'factory'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.qsdlc', 'factory', 'sources.yml'), [
      'sources:',
      '  - name: inbox   # support inbox',
      '    kind: email',
      '    approved: true',
      '  - name: tracker',
      '    kind: issues',
      '    approved: false',
      '',
    ].join('\n'));
    check('source-approved true source exits 0', runCli(['source-approved', '--root', tmp, '--source', 'inbox'], quiet) === 0);
    check('source-approved false source exits 4', runCli(['source-approved', '--root', tmp, '--source', 'tracker'], quiet) === 4);
    check('source-approved unknown source exits 4', runCli(['source-approved', '--root', tmp, '--source', 'nope'], quiet) === 4);
    fs.writeFileSync(statePath(tmp, 'ticket-funnel'), '{ not json');
    check('corrupt state file fails closed', cli('get') === 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${passed} passed, ${failed} failed`);
  return failed === 0 ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--self-test')) process.exit(selfTest());
  else process.exit(runCli(process.argv.slice(2)));
}
