#!/usr/bin/env node
// relay-helper.mjs — zero-dependency Node ESM helper for QSDLC coordinators using Herdr (v0.9.5).
// Never shells out through a string: every herdr call is an argv array, so PowerShell/cmd quoting
// can never corrupt a brief. Long briefs go in a file; the pane receives one single-line prompt.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const EXIT = { OK: 0, FAIL: 1, USAGE: 2, GUARD: 3, HERDR: 4 };
const AGENT_NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;
const GREAT = ['Grounding', 'Role', 'Execution', 'Analysis', 'Takeaway'];

export const HELP = `relay-helper.mjs — QSDLC relay helper for Herdr v0.9.5 (zero-dep Node ESM)

Usage: node relay-helper.mjs <subcommand> [args] [flags]

Subcommands
  check-env                          Report whether this process is inside Herdr (HERDR_ENV=1).
  prompt-file <agent|pane> <file>    Submit ONE single-line prompt telling the worker to read <file>.
                                     Flags: --wait  --timeout <ms> (default 900000 with --wait)
  roster <workspace-id>              Summarize tabs / panes / agent statuses for ONE workspace.
                                     Flags: --json  --from-json <file> (offline fixture)
  dispatch-guard <manifest.json>     Validate disjoint file ownership before launching parallel writers.
  ownership-check <manifest> <lane>  Verify a lane touched only files it owns.
                                     Flags: --files a,b,c | --git-diff [base]  --strict
  takeaway <report-file>             Print ONLY the GREAT "Takeaway" section; check the five headings.

Global flags
  --dry-run   Print the exact herdr argv that WOULD run; mutate nothing.
  --json      Machine-readable output (stdout). Diagnostics always go to stderr.
  --help, -h  This text.

Scope guard
  Inside Herdr (HERDR_ENV=1) commands run against the current session. Outside Herdr every
  command that touches panes is refused (exit 3) unless the user explicitly authorized a
  dedicated QSDLC workspace AND you pass both:
      --dedicated-workspace <wN> --user-authorized
  In that mode only pane IDs inside <wN> are accepted (never agent names, never other
  workspaces). --dedicated-workspace also self-restricts when used inside Herdr.
  These flags are a speed bump, not proof of consent: only the user can authorize.

Manifest (dispatch-guard / ownership-check), JSON:
  { "lanes": [ { "name": "herdr-builder", "owns": ["skills/qsdlc-herdr/**"] } ],
    "shared_readonly": ["skills/_shared/**"] }

Exit codes: 0 ok | 1 check failed (conflict, violation, gap) | 2 usage | 3 guard refusal | 4 herdr error
`;

// ---------- argument parsing ----------
const VALUE_FLAGS = new Set(['timeout', 'dedicated-workspace', 'from-json', 'files']);
const OPTIONAL_VALUE_FLAGS = new Set(['git-diff']);

export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') { out.flags.help = true; continue; }
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    const key = (eq > 0 ? a.slice(2, eq) : a.slice(2));
    const inline = eq > 0 ? a.slice(eq + 1) : undefined;
    if (VALUE_FLAGS.has(key)) {
      const v = inline ?? argv[++i];
      if (v === undefined) throw usage(`--${key} needs a value`);
      out.flags[key] = v;
    } else if (OPTIONAL_VALUE_FLAGS.has(key)) {
      const next = argv[i + 1];
      out.flags[key] = inline ?? (next && !next.startsWith('--') ? (i++, next) : true);
    } else {
      out.flags[key] = true;
    }
  }
  return out;
}

function usage(msg) { const e = new Error(msg); e.code = EXIT.USAGE; return e; }
function guardErr(msg) { const e = new Error(msg); e.code = EXIT.GUARD; return e; }
function failErr(msg) { const e = new Error(msg); e.code = EXIT.FAIL; return e; }
function herdrErr(msg, detail) { const e = new Error(msg); e.code = EXIT.HERDR; e.detail = detail; return e; }

// ---------- environment & scope guard ----------
export function insideHerdr(env = process.env) { return env.HERDR_ENV === '1'; }

export function scopeGuard(flags, { workspace, target } = {}, env = process.env) {
  const inside = insideHerdr(env);
  const dedicated = flags['dedicated-workspace'];
  if (dedicated !== undefined && (dedicated === true || !/^[^\s:]+$/.test(dedicated))) {
    throw usage('--dedicated-workspace needs a workspace id such as w3');
  }
  if (!inside) {
    if (!dedicated || !flags['user-authorized']) {
      throw guardErr(
        'Not running inside Herdr (HERDR_ENV is not 1). Refusing to inspect or control any Herdr session. ' +
        'Only a user-authorized dedicated workspace may be driven from outside: pass ' +
        '--dedicated-workspace <wN> --user-authorized (IDs must come from your own `workspace create` JSON).');
    }
  }
  if (dedicated) {
    if (workspace && workspace !== dedicated) {
      throw guardErr(`Workspace ${workspace} is outside the dedicated scope ${dedicated}.`);
    }
    if (target && !target.startsWith(`${dedicated}:`)) {
      throw guardErr(`Target "${target}" must be a pane id inside ${dedicated} (agent names are not accepted in dedicated scope).`);
    }
  }
  return { inside, dedicated: dedicated || null };
}

// ---------- herdr runner (argv only, never a shell string) ----------
export function runHerdr(args, { dryRun = false, env = process.env } = {}) {
  const bin = env.HERDR_BIN || 'herdr';
  if (dryRun) return { dryRun: true, argv: [bin, ...args] };
  const r = spawnSync(bin, args, { encoding: 'utf8', windowsHide: true, env, maxBuffer: 32 * 1024 * 1024 });
  if (r.error) throw herdrErr(`could not run ${bin}: ${r.error.message}`);
  let json = null;
  try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { /* non-JSON output is allowed */ }
  if (r.status !== 0) {
    throw herdrErr(`herdr ${args.slice(0, 2).join(' ')} exited ${r.status}`, (r.stderr || r.stdout || '').trim());
  }
  return { argv: [bin, ...args], status: r.status, json, stdout: r.stdout };
}

// ---------- glob ownership logic ----------
export function normalizePattern(p) {
  let s = String(p).replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '');
  if (s.endsWith('/')) s += '**';
  return s;
}
const hasWild = (s) => /[*?]/.test(s);

export function globToRegex(pattern) {
  const p = normalizePattern(pattern);
  let re = '^';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') {
        i++;
        if (p[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(re + '$');
}

export function matchesAny(file, patterns) {
  const f = String(file).replace(/\\/g, '/').replace(/^\.\//, '');
  return patterns.find((p) => globToRegex(p).test(f)) ?? null;
}

const segs = (s) => s.split('/').filter(Boolean);
function baseSegs(p) { const out = []; for (const s of segs(p)) { if (hasWild(s)) break; out.push(s); } return out; }
const isPrefix = (a, b) => a.length <= b.length && a.every((s, i) => s === b[i]);

// Conservative: may report a false overlap, must not miss a real one.
export function patternsConflict(a, b) {
  const A = normalizePattern(a), B = normalizePattern(b);
  const wa = hasWild(A), wb = hasWild(B);
  if (!wa && !wb) { const sa = segs(A), sb = segs(B); return isPrefix(sa, sb) || isPrefix(sb, sa); }
  if (!wa || !wb) {
    const [lit, glob] = wa ? [B, A] : [A, B];
    const re = globToRegex(glob);
    return re.test(lit) || re.test(`${lit}/x`);
  }
  const ba = baseSegs(A), bb = baseSegs(B);
  if (!(isPrefix(ba, bb) || isPrefix(bb, ba))) return false;
  const lastTail = (s) => { const l = segs(s).pop() || ''; const m = l.match(/[^*?]*$/); return m ? m[0] : ''; };
  const ta = lastTail(A), tb = lastTail(B);
  if (ta && tb && !ta.endsWith(tb) && !tb.endsWith(ta)) return false;
  const maxDepth = (s) => (s.includes('**') ? Infinity : segs(s).length);
  const minDepth = (s) => segs(s).filter((x) => x !== '**').length + (s.endsWith('**') ? 1 : 0);
  if (maxDepth(A) < minDepth(B) || maxDepth(B) < minDepth(A)) return false;
  return true;
}

export function loadManifest(file) {
  if (!file) throw usage('manifest path required');
  if (!existsSync(file)) throw usage(`manifest not found: ${file}`);
  try { return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); }
  catch (e) { throw usage(`manifest is not valid JSON: ${e.message}`); }
}

export function analyzeManifest(m) {
  const errors = [], conflicts = [];
  const lanes = Array.isArray(m?.lanes) ? m.lanes : [];
  if (!lanes.length) errors.push('manifest.lanes must be a non-empty array');
  const seen = new Set();
  const ro = (m?.shared_readonly || []).map(String);
  const clean = [];
  for (const [i, l] of lanes.entries()) {
    const name = l?.name;
    if (typeof name !== 'string' || !AGENT_NAME_RE.test(name)) { errors.push(`lane[${i}] name must match [a-z][a-z0-9_-]{0,31}`); continue; }
    if (seen.has(name)) { errors.push(`duplicate lane name "${name}"`); continue; }
    seen.add(name);
    if (!Array.isArray(l.owns) || !l.owns.length || l.owns.some((x) => typeof x !== 'string' || !x.trim())) {
      errors.push(`lane "${name}" needs a non-empty owns[] of path globs`); continue;
    }
    const owns = l.owns.map(normalizePattern);
    for (const p of owns) {
      if (/^([a-zA-Z]:)?\//.test(p)) errors.push(`lane "${name}": absolute path "${p}" (use repo-relative)`);
      if (segs(p).includes('..')) errors.push(`lane "${name}": "${p}" escapes the repo`);
      if (['**', '*', '.', '**/*'].includes(p)) errors.push(`lane "${name}": "${p}" claims the whole repo (unbounded ownership)`);
    }
    clean.push({ name, owns });
  }
  for (let i = 0; i < clean.length; i++) {
    for (let j = i + 1; j < clean.length; j++) {
      for (const pa of clean[i].owns) for (const pb of clean[j].owns) {
        if (patternsConflict(pa, pb)) conflicts.push({ a: clean[i].name, b: clean[j].name, patternA: pa, patternB: pb, reason: 'overlapping ownership' });
      }
    }
    for (const pa of clean[i].owns) for (const r of ro) {
      if (patternsConflict(pa, r)) conflicts.push({ a: clean[i].name, b: 'shared_readonly', patternA: pa, patternB: normalizePattern(r), reason: 'lane owns a shared read-only path' });
    }
  }
  return { ok: !errors.length && !conflicts.length, lanes: clean, conflicts, errors };
}

// ---------- roster ----------
export function summarizeRoster(workspace, panesJson, tabsJson) {
  const panes = panesJson?.result?.panes ?? panesJson?.panes ?? [];
  const tabs = tabsJson?.result?.tabs ?? tabsJson?.tabs ?? [];
  const mine = panes.filter((p) => p.workspace_id === workspace);
  const byTab = new Map();
  for (const t of tabs.filter((x) => x.workspace_id === workspace)) {
    byTab.set(t.tab_id, { tab_id: t.tab_id, label: t.label ?? null, status: t.agent_status ?? null, panes: [] });
  }
  const counts = {};
  const attention = [], verify = [];
  for (const p of mine) {
    if (!byTab.has(p.tab_id)) byTab.set(p.tab_id, { tab_id: p.tab_id, label: null, status: null, panes: [] });
    const status = p.agent_status ?? 'no-agent';
    byTab.get(p.tab_id).panes.push({ pane_id: p.pane_id, label: p.label ?? null, agent: p.agent ?? null, status });
    counts[status] = (counts[status] || 0) + 1;
    if (status === 'blocked' || status === 'unknown') attention.push(p.pane_id);
    if (status === 'idle' || status === 'done') verify.push(p.pane_id);
  }
  return {
    workspace,
    tabs: [...byTab.values()],
    counts,
    attention,
    verify_before_pass: verify,
    notes: [
      'idle/done means settled, not correct: confirm with the lane report, git diff and deterministic checks before counting PASS.',
      'blocked in autonomous mode is a lane fault: inspect with `herdr agent read`, park or decline, never approve blindly.',
    ],
  };
}

function rosterText(r) {
  const lines = [`workspace ${r.workspace}`];
  for (const t of r.tabs) {
    lines.push(`  ${t.tab_id}  ${t.label ?? '-'}  [${t.status ?? '-'}]`);
    for (const p of t.panes) lines.push(`    ${p.pane_id}  ${(p.label ?? '-').padEnd(18)} ${(p.agent ?? '-').padEnd(8)} ${p.status}`);
  }
  lines.push(`counts: ${JSON.stringify(r.counts)}`);
  if (r.attention.length) lines.push(`ATTENTION (blocked/unknown): ${r.attention.join(', ')}`);
  if (r.verify_before_pass.length) lines.push(`settled, verify before PASS: ${r.verify_before_pass.join(', ')}`);
  return lines.join('\n');
}

// ---------- takeaway ----------
export function extractGreat(text) {
  const lines = text.split(/\r?\n/);
  const labelRe = new RegExp(
    `^\\s{0,3}(?:#{1,6}\\s*(?:\\d+[.)]\\s*)?|\\*\\*\\s*(?:\\d+[.)]\\s*)?|(?=(?:${GREAT.join('|')})\\s*:\\s*$))(${GREAT.join('|')})\\b[\\s*:]*(.*)$`, 'i');
  const marks = [];
  lines.forEach((ln, i) => {
    const m = ln.match(labelRe);
    if (m) marks.push({ name: GREAT.find((g) => g.toLowerCase() === m[1].toLowerCase()), line: i, rest: m[2].replace(/\*+/g, '').trim() });
  });
  const sections = {};
  marks.forEach((mk, k) => {
    const end = k + 1 < marks.length ? marks[k + 1].line : lines.length;
    const body = [mk.rest, ...lines.slice(mk.line + 1, end)].join('\n').trim();
    if (!(mk.name in sections)) sections[mk.name] = body;
  });
  const missing = GREAT.filter((g) => !(g in sections));
  const take = sections.Takeaway ?? null;
  const status = take ? (take.match(/\b(PASS|ISSUES|BLOCKED)\b/) || [])[1] ?? null : null;
  const evidence = take ? /(evidence|sha\b|exit code|git diff|test|lint|\.md\b|\.mjs\b|\.json\b)/i.test(take) : false;
  return { sections, missing, takeaway: take, status, evidence_mentioned: evidence, complete: missing.length === 0 };
}

// ---------- subcommands ----------
function emit(flags, obj, text) {
  if (flags.json) process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  else process.stdout.write((typeof text === 'function' ? text(obj) : text ?? JSON.stringify(obj, null, 2)) + '\n');
}

function cmdCheckEnv({ flags }) {
  const inside = insideHerdr();
  const ctx = { workspace: process.env.HERDR_WORKSPACE_ID || null, tab: process.env.HERDR_TAB_ID || null, pane: process.env.HERDR_PANE_ID || null };
  let mode = inside ? 'inside-herdr' : 'outside-herdr';
  let ok = inside;
  if (!inside && flags['dedicated-workspace'] && flags['user-authorized']) { mode = 'dedicated-scope'; ok = true; }
  const obj = {
    ok, mode, inside_herdr: inside, context: ctx,
    dedicated_workspace: flags['dedicated-workspace'] || null,
    guidance: ok ? (mode === 'dedicated-scope'
      ? 'Outside Herdr: act ONLY on IDs from your own workspace-create JSON inside the dedicated workspace.'
      : 'Inside Herdr: use --current / explicit IDs / unique agent names; --no-focus for background lanes.')
      : 'Not inside Herdr. Stop. Do not inspect or control the user\'s focused session.',
  };
  emit(flags, obj, (o) => `${o.mode}: ${o.guidance}` + (o.context.pane ? `\nworkspace=${o.context.workspace} tab=${o.context.tab} pane=${o.context.pane}` : ''));
  return ok ? EXIT.OK : EXIT.GUARD;
}

export function buildPromptLine(absFile) {
  if (/[\u0000-\u001f\u007f]/.test(absFile)) throw usage('prompt file path contains control characters or newlines');
  const shown = /\s/.test(absFile) ? `"${absFile}"` : absFile;
  return `Read ${shown} in full and execute every instruction inside it.`;
}

function cmdPromptFile({ _, flags }) {
  const [target, file] = _;
  if (!target || !file) throw usage('usage: prompt-file <agent|pane-id> <prompt-file> [--wait] [--timeout ms] [--dry-run]');
  const isPane = /^[^\s:]+:[^\s:]+$/.test(target);
  if (!isPane && !AGENT_NAME_RE.test(target)) throw usage(`"${target}" is neither a pane id (w1:p2) nor a valid agent name`);
  scopeGuard(flags, { target });
  const abs = path.resolve(file);
  if (!existsSync(abs) || !statSync(abs).isFile()) throw usage(`prompt file not found: ${abs}`);
  const buf = readFileSync(abs);
  if (!buf.length) throw usage(`prompt file is empty: ${abs}`);
  const text = buf.toString('utf8');
  if (!/takeaway/i.test(text)) process.stderr.write('warn: brief never mentions "Takeaway"; GREAT briefs should demand a Takeaway section.\n');
  const prompt = buildPromptLine(abs);
  const args = ['agent', 'prompt', target, prompt];
  if (flags.wait) args.push('--wait', '--timeout', String(flags.timeout ?? 900000));
  else if (flags.timeout) args.push('--timeout', String(flags.timeout));
  const res = runHerdr(args, { dryRun: !!flags['dry-run'] });
  const obj = {
    ok: true, dry_run: !!flags['dry-run'], target, brief_file: abs, brief_bytes: buf.length,
    brief_sha256: createHash('sha256').update(buf).digest('hex').slice(0, 16),
    prompt, argv: res.argv, herdr: res.json ?? null,
    next: 'Settled idle/done is not proof. Read the lane Takeaway and run deterministic checks before counting PASS.',
  };
  emit(flags, obj, (o) => `${o.dry_run ? 'DRY RUN ' : ''}prompt -> ${o.target}\n${o.prompt}\nargv: ${JSON.stringify(o.argv)}\nbrief sha256:${o.brief_sha256} (${o.brief_bytes} bytes)`);
  return EXIT.OK;
}

function cmdRoster({ _, flags }) {
  const [ws] = _;
  if (!ws) throw usage('usage: roster <workspace-id> [--json] [--from-json file]');
  let panesJson, tabsJson;
  if (flags['from-json']) {
    const f = loadManifest(flags['from-json']);
    panesJson = f.panes ?? f; tabsJson = f.tabs ?? f;
  } else {
    scopeGuard(flags, { workspace: ws });
    const dry = !!flags['dry-run'];
    const p = runHerdr(['pane', 'list', '--workspace', ws], { dryRun: dry });
    const t = runHerdr(['tab', 'list', '--workspace', ws], { dryRun: dry });
    if (dry) { emit(flags, { ok: true, dry_run: true, argv: [p.argv, t.argv] }, (o) => o.argv.map((a) => a.join(' ')).join('\n')); return EXIT.OK; }
    panesJson = p.json; tabsJson = t.json;
  }
  const summary = summarizeRoster(ws, panesJson, tabsJson);
  emit(flags, summary, rosterText);
  return EXIT.OK;
}

function cmdDispatchGuard({ _, flags }) {
  const report = analyzeManifest(loadManifest(_[0]));
  emit(flags, report, (r) => {
    const out = [`lanes: ${r.lanes.map((l) => `${l.name}(${l.owns.join(', ')})`).join('  ')}`];
    for (const e of r.errors) out.push(`ERROR: ${e}`);
    for (const c of r.conflicts) out.push(`CONFLICT: ${c.a} "${c.patternA}"  x  ${c.b} "${c.patternB}"  (${c.reason})`);
    out.push(r.ok ? 'OK: ownership is disjoint; safe to dispatch parallel writers.' : 'NOT SAFE: fix ownership before dispatching.');
    return out.join('\n');
  });
  return report.ok ? EXIT.OK : EXIT.FAIL;
}

function changedFromGit(base) {
  const run = (a) => spawnSync('git', a, { encoding: 'utf8', windowsHide: true });
  const d = run(['diff', '--name-only', typeof base === 'string' ? base : 'HEAD']);
  const u = run(['ls-files', '--others', '--exclude-standard']);
  if (d.status !== 0) throw failErr(`git diff failed: ${(d.stderr || '').trim()}`);
  return [...new Set(`${d.stdout}\n${u.stdout}`.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
}

function cmdOwnershipCheck({ _, flags }) {
  const [file, lane] = _;
  if (!file || !lane) throw usage('usage: ownership-check <manifest> <lane> (--files a,b | --git-diff [base]) [--strict]');
  const m = loadManifest(file);
  const rep = analyzeManifest(m);
  const me = rep.lanes.find((l) => l.name === lane);
  if (!me) throw usage(`lane "${lane}" not found in manifest`);
  let files;
  if (flags.files) files = String(flags.files).split(',').map((s) => s.trim()).filter(Boolean);
  else if (flags['git-diff']) files = changedFromGit(flags['git-diff']);
  else throw usage('give --files a,b,c or --git-diff [base]');
  const ro = (m.shared_readonly || []).map(String);
  const rows = files.map((f) => {
    if (matchesAny(f, ro)) return { file: f, verdict: 'violation', why: 'shared read-only path' };
    if (matchesAny(f, me.owns)) return { file: f, verdict: 'owned' };
    const other = rep.lanes.find((l) => l.name !== lane && matchesAny(f, l.owns));
    if (other) return flags.strict ? { file: f, verdict: 'violation', why: `owned by lane ${other.name}` } : { file: f, verdict: 'other-lane', why: other.name };
    return { file: f, verdict: 'violation', why: 'owned by no lane' };
  });
  const violations = rows.filter((r) => r.verdict === 'violation');
  const obj = { ok: violations.length === 0, lane, checked: rows.length, violations, rows };
  emit(flags, obj, (o) => [`lane ${o.lane}: ${o.checked} file(s) checked`, ...o.violations.map((v) => `VIOLATION: ${v.file} (${v.why})`), o.ok ? 'OK: no ownership violations.' : 'FAIL: lane edited files it does not own.'].join('\n'));
  return obj.ok ? EXIT.OK : EXIT.FAIL;
}

function cmdTakeaway({ _, flags }) {
  const [file] = _;
  if (!file) throw usage('usage: takeaway <report-file> [--json]');
  const abs = path.resolve(file);
  if (!existsSync(abs)) throw failErr(`report missing (a gap is not a pass): ${abs}`);
  const g = extractGreat(readFileSync(abs, 'utf8'));
  if (!g.takeaway) throw failErr(`no Takeaway section in ${abs} (a gap is not a pass)`);
  if (flags.json) {
    emit(flags, { ok: g.complete, file: abs, complete: g.complete, missing: g.missing, status: g.status, evidence_mentioned: g.evidence_mentioned, takeaway: g.takeaway, proof: 'unverified: run deterministic checks' });
  } else {
    process.stdout.write(g.takeaway + '\n');
    if (g.missing.length) process.stderr.write(`warn: GREAT headings missing: ${g.missing.join(', ')}\n`);
    if (!g.status) process.stderr.write('warn: Takeaway carries no PASS/ISSUES/BLOCKED status word.\n');
    if (!g.evidence_mentioned) process.stderr.write('warn: Takeaway cites no evidence (file, SHA, test, exit code).\n');
  }
  return g.complete ? EXIT.OK : EXIT.FAIL;
}

const COMMANDS = {
  'check-env': cmdCheckEnv, 'prompt-file': cmdPromptFile, roster: cmdRoster,
  'dispatch-guard': cmdDispatchGuard, 'ownership-check': cmdOwnershipCheck, takeaway: cmdTakeaway,
};

export function main(argv) {
  try {
    const args = parseArgs(argv);
    const sub = args._.shift();
    if (args.flags.help || !sub || sub === 'help') { process.stdout.write(HELP); return sub || args.flags.help ? EXIT.OK : EXIT.USAGE; }
    const fn = COMMANDS[sub];
    if (!fn) throw usage(`unknown subcommand "${sub}" (see --help)`);
    return fn(args);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    if (e.detail) process.stderr.write(`${e.detail}\n`);
    return e.code ?? EXIT.FAIL;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
