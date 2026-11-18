#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CORR_HEADER, CORR_LEVELS, CORR_SOURCES, CORR_STATUS, EVAL_STATUS, HEX_SHA, ISO_DATE, ISO_TS, KEBAB, MODES,
  RESERVED_DIRS, RISKS, RUN_HEADER, RUN_OUTCOMES, STAGES, STAGE_DOC, TERMINAL, TRACKS,
  exists, findPii, generateRules, git, globToRegExp, hasHead, isDir, isGitRepo, latestPerClass, listDir,
  matchesAny, parseArgs, parseCorrections, parsePolicy, parseTsv, parseYamlLite, readText, rel,
  splitFrontmatter, todayIso, toPosix, walk,
} from './qsdlc-lib.mjs';

const FEATURE_FILES = new Set([
  'state.md', 'Intent.md', 'spec.md', 'plan.md', 'eval.md', 'docmd.md', 'ledger.md', 'assessment.md', 'findings.md',
]);
const FEATURE_DIRS = new Set(['artifacts', 'review', 'evidence']);
const ARTIFACT_FILES = new Set([
  'inspo.html', 'design-pitch-deck.html', 'implementation-process-map.html', 'performance-results.html',
  'release-notes.html',
]);
const PROSE_FILES = ['Intent.md', 'spec.md', 'plan.md', 'eval.md', 'docmd.md', 'assessment.md', 'findings.md'];
const RUN_JSON_KEYS = [
  'run_id', 'loop', 'ticket', 'track', 'mode', 'status', 'base_sha', 'head_sha', 'branch', 'pr_url', 'budgets_used',
  'assumptions', 'rulings', 'parked', 'unverified', 'failed_or_skipped', 'also_changed',
];
const MANIFEST_KEYS = ['schema', 'run_id', 'feature_id', 'entry_point', 'build_rev', 'result', 'pii_scrubbed'];
const BANNED = [
  'ratchet', 'harness', 'scaffolding', 'surface', 'leverage', 'delve', 'robust', 'seamless', 'seamlessly',
  'holistic', 'synergy', 'paradigm', 'tapestry', 'testament', 'pivotal', 'crucial', 'elevate', 'streamline',
  'game-changing', 'cutting-edge',
];
const FILLER = [/\bit(?:'s| is) worth noting\b/i, /\bit(?:'s| is) important to note\b/i, /\bin today's\b/i];
const CODE_EXT = {
  '.js': '//', '.mjs': '//', '.cjs': '//', '.ts': '//', '.tsx': '//', '.jsx': '//', '.cs': '//', '.java': '//',
  '.go': '//', '.rs': '//', '.php': '//', '.py': '#', '.rb': '#', '.sh': '#', '.ps1': '#', '.sql': '--',
};
const SUPPRESSION =
  /@ts-ignore|@ts-expect-error|eslint-disable|noqa\b|type:\s*ignore|nolint|pylint:\s*disable|@SuppressWarnings|NOSONAR|istanbul ignore|c8 ignore/;

export function lint(opts) {
  const root = path.resolve(opts.root || '.');
  const out = [];
  const add = (id, severity, file, message, fix = '') => out.push({ id, severity, file, message, fix });
  const qdir = path.join(root, '.qsdlc');
  const inGit = isGitRepo(root);
  const policy = parsePolicy(root);
  const info = { root, fixedRules: false };

  if (!isDir(qdir)) {
    add('V1', opts.slug ? 'error' : 'warn', '.qsdlc', 'no .qsdlc directory at the project root', 'run qsdlc to create it');
    return finish(out, info);
  }

  const features = [];
  for (const e of listDir(qdir)) {
    if (!e.isDirectory()) {
      if (!['.gitkeep', '.gitignore'].includes(e.name) && !e.name.endsWith('.md')) {
        add('V1', 'error', `.qsdlc/${e.name}`, 'unexpected file at the .qsdlc root', 'move it into a feature folder or delete it');
      }
      continue;
    }
    if (RESERVED_DIRS.includes(e.name)) continue;
    if (opts.slug && e.name !== opts.slug) continue;
    features.push(e.name);
  }
  if (opts.slug && !features.length) {
    add('V1', 'error', `.qsdlc/${opts.slug}`, 'feature folder not found', 'check the slug');
  }

  const mapIds = collectMapIds(qdir);
  const featureState = new Map();

  for (const slug of features) {
    const dir = path.join(qdir, slug);
    const stateFile = path.join(dir, 'state.md');
    const relDir = `.qsdlc/${slug}`;
    if (!KEBAB.test(slug)) add('V1', 'error', relDir, 'slug is not kebab-case', 'rename to lowercase words joined by hyphens');
    if (!exists(stateFile)) {
      add('V1', 'error', relDir, 'folder has no state.md, so it is not a feature', 'add state.md from state.template.md');
      continue;
    }
    checkShape(slug, dir, add);
    const st = checkState(slug, dir, root, inGit, add);
    featureState.set(slug, st);
    checkStageDocs(slug, dir, st, add);
    checkEval(slug, dir, root, mapIds, add);
    checkProse(slug, dir, add);
  }

  checkFeatureMap(qdir, add);
  checkEvidence(root, qdir, features, add);
  checkRuns(qdir, add);
  checkCorrections(root, qdir, inGit, !!opts.fixRules, info, add);
  checkProtected(root, features, featureState, policy, inGit, opts, add);
  checkMarkdown(root, qdir, policy, inGit, add);
  if (!opts.noCode) checkCode(root, policy, inGit, opts, add);
  checkFormal(root, qdir, inGit, add);
  return finish(out, info);
}

function finish(violations, info) {
  const errors = violations.filter((v) => v.severity === 'error').length;
  const warnings = violations.filter((v) => v.severity === 'warn').length;
  return { violations, errors, warnings, fixedRules: info.fixedRules };
}

function checkShape(slug, dir, add) {
  const relDir = `.qsdlc/${slug}`;
  for (const e of listDir(dir)) {
    if (e.isDirectory()) {
      if (!FEATURE_DIRS.has(e.name)) add('V1', 'error', `${relDir}/${e.name}`, 'directory is not part of the feature contract', 'allowed: artifacts, review, evidence');
    } else if (!FEATURE_FILES.has(e.name)) {
      add('V1', 'error', `${relDir}/${e.name}`, 'file is not part of the feature contract', 'allowed: state, Intent, spec, plan, eval, docmd, ledger, assessment, findings');
    }
  }
  for (const e of listDir(path.join(dir, 'artifacts'))) {
    if (e.isDirectory()) {
      if (e.name !== '.craft') add('V1', 'error', `${relDir}/artifacts/${e.name}`, 'unknown artifacts subdirectory', 'only .craft is allowed');
    } else if (!ARTIFACT_FILES.has(e.name)) {
      add('V1', 'error', `${relDir}/artifacts/${e.name}`, 'unknown artifact file', 'allowed: inspo, design-pitch-deck, implementation-process-map, performance-results, release-notes (.html)');
    }
  }
}

function fieldMap(text) {
  const head = text.split(/^## Log\s*$/m)[0];
  const map = {};
  for (const line of head.split(/\r?\n/)) {
    const m = line.match(/^- ([A-Za-z][A-Za-z ]*?): (.*)$/);
    if (m) map[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return map;
}

function logLines(text) {
  const parts = text.split(/^## Log\s*$/m);
  if (parts.length < 2) return null;
  return parts[1].split(/\r?\n/).filter((l) => l.startsWith('- '));
}

function checkState(slug, dir, root, inGit, add) {
  const file = `.qsdlc/${slug}/state.md`;
  const text = readText(path.join(dir, 'state.md')) ?? '';
  const f = fieldMap(text);
  const st = { stage: f['current stage'], mode: f['mode'], track: f['track'], risk: f['risk'], terminal: f['terminal status'], base: f['base sha'], skipped: [] };
  if (!STAGES.includes(st.stage) && st.stage !== 'done') add('V2', 'error', file, `Current stage "${st.stage ?? ''}" is not plan|design|build|test|deploy|done`, 'set a valid stage');
  if (!f['last updated'] || !ISO_DATE.test(f['last updated'].slice(0, 10))) add('V2', 'error', file, 'Last updated is missing or not an ISO date', 'use YYYY-MM-DD');
  if (st.mode !== undefined && !MODES.includes(st.mode)) add('V2', 'error', file, `Mode "${st.mode}" is not interactive|autonomous`, 'fix the Mode line');
  if (st.track !== undefined && !TRACKS.includes(st.track)) add('V2', 'error', file, `Track "${st.track}" is not quick|bugfix|delta|full|discovery`, 'fix the Track line');
  if (st.risk !== undefined && !RISKS.includes(st.risk)) add('V2', 'error', file, `Risk "${st.risk}" is not standard|protected`, 'fix the Risk line');
  if (f['autonomy eligible'] !== undefined && !['true', 'false'].includes(f['autonomy eligible'])) add('V2', 'error', file, 'Autonomy eligible must be true or false', 'fix the line');
  if (st.terminal !== undefined && st.terminal !== 'none' && !TERMINAL.includes(st.terminal)) add('V2', 'error', file, `Terminal status "${st.terminal}" is not in the enum`, `use one of: ${TERMINAL.join(', ')}`);
  const pc = f['pending confirmation'];
  if (pc !== undefined && pc !== 'none' && !/^(plan|design|build|test|deploy) drafted by \S+/.test(pc)) add('V2', 'error', file, 'Pending confirmation must be "none" or "<stage> drafted by <run-id>"', 'fix the line');
  if (st.risk === 'protected' && st.terminal === 'done') add('V2', 'error', file, 'a protected-risk run cannot end done', 'use needs-review');
  if (st.mode === 'autonomous' && st.stage === 'done' && (st.terminal === undefined || st.terminal === 'none')) add('V2', 'error', file, 'an autonomous run at stage done must record a Terminal status', 'set Terminal status');
  if (f['skipped'] && f['skipped'] !== 'none') {
    st.skipped = f['skipped'].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const s of st.skipped) if (!STAGES.includes(s)) add('V2', 'error', file, `Skipped names unknown stage "${s}"`, 'use plan, design, build, test, deploy');
  }
  const lines = logLines(text);
  if (lines === null) add('V2', 'error', file, 'missing "## Log" section', 'add a Log section');
  else {
    lines.forEach((l, i) => {
      if (!/^- \d{4}-\d{2}-\d{2}/.test(l)) add('V2', 'error', file, `log line ${i + 1} does not start with an ISO date`, 'format: "- 2026-11-18 text"');
    });
    if (inGit && hasHead(root)) {
      const prev = git(root, ['show', `HEAD:.qsdlc/${slug}/state.md`]);
      if (prev !== null) {
        const old = logLines(prev) ?? [];
        for (let i = 0; i < old.length; i++) {
          if (lines[i] !== old[i]) {
            add('V2', 'error', file, `log is append-only: line ${i + 1} was changed or removed`, 'restore the original line and append a new one');
            break;
          }
        }
      }
    }
  }
  return st;
}

function checkStageDocs(slug, dir, st, add) {
  const idx = st.stage === 'done' ? STAGES.length : STAGES.indexOf(st.stage);
  if (idx < 0) return;
  for (let i = 0; i < idx; i++) {
    const stage = STAGES[i];
    if (!exists(path.join(dir, STAGE_DOC[stage])) && !st.skipped.includes(stage)) {
      add('V1', 'error', `.qsdlc/${slug}/${STAGE_DOC[stage]}`, `missing, and stage "${stage}" is not listed in Skipped`, `write it or add "${stage}" to Skipped with a reason in the log`);
    }
  }
}

function parseTables(text) {
  const tables = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\|/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());
      if (!cur) cur = { header: cells, rows: [] };
      else if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      else cur.rows.push(cells);
    } else if (cur) {
      tables.push(cur);
      cur = null;
    }
  }
  if (cur) tables.push(cur);
  return tables;
}

function collectMapIds(qdir) {
  const ids = new Set();
  const fdir = path.join(qdir, 'factory', 'verify', 'features');
  for (const e of listDir(fdir)) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    ids.add(e.name.slice(0, -3));
    for (const id of subFeatureIds(readText(path.join(fdir, e.name)) ?? '')) ids.add(id);
  }
  return ids;
}

function sections(text) {
  const out = [];
  let inFence = false;
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^```/.test(line)) inFence = !inFence;
    const m = !inFence && line.match(/^## (.+?)\s*$/);
    if (m) {
      cur = { title: m[1], lines: [] };
      out.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  return out;
}

function subFeatureIds(text) {
  const sec = sections(text).find((s) => s.title === 'Sub-features');
  if (!sec) return [];
  const ids = [];
  for (const l of sec.lines) {
    const m = l.match(/^- `([^`]+)`/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

function checkEval(slug, dir, root, mapIds, add) {
  const fileAbs = path.join(dir, 'eval.md');
  const text = readText(fileAbs);
  if (text === null) return;
  const file = `.qsdlc/${slug}/eval.md`;
  const table = parseTables(text).find((t) => t.header.some((h) => h.toLowerCase() === 'id') && t.header.some((h) => h.toLowerCase() === 'status'));
  if (!table) {
    add('V3', 'error', file, 'no test-case table with ID and Status columns', 'use eval.template.md');
    return;
  }
  const col = {};
  table.header.forEach((h, i) => { col[h.toLowerCase()] = i; });
  const need = ['id', 'status', 'evidence', 'last run'].filter((c) => col[c] === undefined);
  if (need.length) {
    add('V3', 'error', file, `table is missing column(s): ${need.join(', ')}`, 'use the eval.template.md header');
    return;
  }
  const seen = new Set();
  const counts = { pass: 0, fail: 0, blocked: 0, 'not run': 0 };
  const get = (r, c) => (col[c] === undefined ? '' : (r[col[c]] ?? ''));
  for (const r of table.rows) {
    const id = get(r, 'id');
    const status = get(r, 'status');
    if (!id) add('V3', 'error', file, 'a row has an empty ID', 'give every case an ID');
    else if (seen.has(id)) add('V3', 'error', file, `duplicate ID ${id}`, 'IDs must be unique');
    seen.add(id);
    if (!EVAL_STATUS.includes(status)) {
      add('V3', 'error', file, `${id}: status "${status}" is not one of ${EVAL_STATUS.join(', ')}`, 'fix the status');
      continue;
    }
    counts[status]++;
    const ev = get(r, 'evidence').replace(/`/g, '').trim();
    if (status === 'pass') {
      if (!ev || ev === '-') add('V3', 'error', file, `${id}: pass without an Evidence pointer (a gap is not a pass)`, 'run the case and record evidence, or set blocked');
      else {
        for (const p of ev.split(';').map((s) => s.trim()).filter(Boolean)) {
          if (!exists(path.join(dir, p)) && !exists(path.join(root, p))) add('V3', 'error', file, `${id}: evidence "${p}" does not resolve`, 'point at a file relative to the feature folder or project root');
        }
      }
      if (!ISO_DATE.test(get(r, 'last run').slice(0, 10))) add('V3', 'error', file, `${id}: pass without a Last run date`, 'record the run date');
    }
    if (status === 'blocked' && /^unreachable/i.test(get(r, 'notes')) && !/^unreachable: .+; route: .+/i.test(get(r, 'notes'))) {
      add('V3', 'error', file, `${id}: blocked note must read "unreachable: <prerequisite>; route: <command>"`, 'fix the Notes cell');
    }
    const fid = get(r, 'feature id');
    if (col['feature id'] !== undefined) {
      if (!fid) add('V3', 'error', file, `${id}: empty Feature ID`, 'cite a map ID or "n/a: <reason>"');
      else if (!/^n\/a:\s*\S+/i.test(fid) && mapIds.size && !mapIds.has(fid)) add('V3', 'error', file, `${id}: Feature ID "${fid}" is not in .qsdlc/factory/verify/`, 'use a mapped ID or "n/a: <reason>"');
    }
  }
  const sum = {};
  for (const key of ['Total', 'Passed', 'Failed', 'Blocked', 'Not run']) {
    const m = text.match(new RegExp(`^- ${key}: (.+)$`, 'm'));
    if (m) sum[key] = m[1].trim();
  }
  for (const key of ['Total', 'Passed', 'Failed', 'Blocked']) {
    if (sum[key] === undefined) add('V3', 'error', file, `Summary is missing "- ${key}:"`, 'fill the Summary block');
  }
  const num = (k) => (sum[k] !== undefined && /^\d+$/.test(sum[k]) ? Number(sum[k]) : null);
  const expect = { Total: table.rows.length, Passed: counts.pass, Failed: counts.fail, Blocked: counts.blocked, 'Not run': counts['not run'] };
  for (const [k, v] of Object.entries(expect)) {
    if (sum[k] === undefined) continue;
    if (num(k) === null) add('V3', 'error', file, `Summary ${k} "${sum[k]}" is not an integer`, 'use a number');
    else if (num(k) !== v) add('V3', 'error', file, `Summary ${k} is ${num(k)} but the table has ${v}`, 'recount the table and fix the Summary');
  }
  const lr = text.match(/^- Last run: (.+)$/m);
  if (lr && counts.pass + counts.fail + counts.blocked > 0 && !ISO_DATE.test(lr[1].trim().slice(0, 10))) add('V3', 'warn', file, 'Summary Last run is not a date though cases have run', 'record the run date');
  const vd = text.match(/^- Verdict: (.+)$/m);
  if (vd && !vd[1].startsWith('<') && !['verified', 'best-effort', 'reverted', 'not run'].includes(vd[1].trim())) add('V3', 'error', file, `Verdict "${vd[1].trim()}" is not verified|best-effort|reverted|not run`, 'fix the Verdict');
}

function checkProse(slug, dir, add) {
  for (const name of PROSE_FILES) {
    const text = readText(path.join(dir, name));
    if (text === null) continue;
    const file = `.qsdlc/${slug}/${name}`;
    proseIssues(text).forEach((i) => add('V10', 'warn', file, `line ${i.line}: ${i.msg}`, i.fix));
  }
}

export function proseIssues(text) {
  const issues = [];
  let inFence = false;
  text.split(/\r?\n/).forEach((raw, idx) => {
    if (/^```/.test(raw)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const line = raw.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']');
    if (/[\u2013\u2014]/.test(line)) issues.push({ line: idx + 1, msg: 'dash character (unslop rule 13)', fix: 'use a comma, colon, or two sentences' });
    for (const w of BANNED) {
      if (new RegExp(`\\b${w}\\b`, 'i').test(line)) issues.push({ line: idx + 1, msg: `banned word "${w}" (unslop rule 26)`, fix: 'name the concrete thing instead' });
    }
    for (const re of FILLER) {
      if (re.test(line)) issues.push({ line: idx + 1, msg: 'filler phrase (unslop)', fix: 'cut it' });
    }
  });
  return issues;
}

function checkFeatureMap(qdir, add) {
  const vdir = path.join(qdir, 'factory', 'verify');
  const fdir = path.join(vdir, 'features');
  if (!isDir(fdir)) return;
  const files = listDir(fdir).filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name);
  const allIds = new Map();
  for (const name of files) {
    const file = `.qsdlc/factory/verify/features/${name}`;
    const text = readText(path.join(fdir, name)) ?? '';
    const secs = sections(text);
    const titles = secs.map((s) => s.title);
    const okShape = titles.length === 4 && titles[0] === 'Sub-features' && titles[1] === 'How to get to it (user POV)' && titles[2].startsWith('Driving it with ') && titles[3] === 'Gotchas';
    if (!okShape) {
      add('V4', 'error', file, `H2 headings must be exactly: Sub-features, How to get to it (user POV), Driving it with <harness>, Gotchas (found: ${titles.join(' | ') || 'none'})`, 'use feature-map-entry.template.md');
      continue;
    }
    const driving = secs[2].lines.filter((l) => l.trim() !== '');
    if (!driving.length || !driving[0].startsWith('Preconditions:')) add('V4', 'error', file, 'the Driving section must start with "Preconditions:"', 'add a Preconditions line first');
    for (const l of driving.slice(1)) {
      if (l.startsWith('- ') && !/`[^`]+`/.test(l.replace(/^- `[^`]*`/, ''))) add('V4', 'error', file, `driving bullet has no exact command in backticks: "${l.slice(0, 60)}"`, 'show the literal command and the observable result');
    }
    const ids = subFeatureIds(text);
    if (!ids.length) add('V4', 'error', file, 'Sub-features lists no `id` bullets', 'add at least one sub-feature ID');
    for (const id of ids) {
      if (!KEBAB.test(id)) add('V4', 'error', file, `sub-feature ID "${id}" is not kebab-case`, 'rename it');
      if (allIds.has(id)) add('V4', 'error', file, `sub-feature ID "${id}" duplicates one in ${allIds.get(id)}`, 'IDs must be unique across the map');
      allIds.set(id, name);
    }
  }
  const readme = path.join(vdir, 'README.md');
  const rtext = readText(readme);
  if (rtext === null) {
    if (files.length) add('V4', 'error', '.qsdlc/factory/verify/README.md', 'missing: the index must list every feature file', 'create README.md with links');
    return;
  }
  const links = [...rtext.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)].map((m) => m[1]).filter((l) => !/^[a-z]+:/i.test(l));
  for (const l of links) {
    if (!exists(path.join(vdir, l))) add('V4', 'error', '.qsdlc/factory/verify/README.md', `link "${l}" does not resolve`, 'fix or remove the link');
  }
  const linked = new Set(links.map((l) => toPosix(l).replace(/^\.\//, '')));
  for (const name of files) {
    if (!linked.has(`features/${name}`)) add('V4', 'error', '.qsdlc/factory/verify/README.md', `does not list features/${name}`, 'add it to the index');
  }
}

const TEXT_EXT = new Set(['.txt', '.md', '.json', '.log', '.tsv', '.csv', '.yml', '.yaml', '.html', '.xml']);

function checkEvidence(root, qdir, features, add) {
  const dirs = [path.join(qdir, 'factory', 'evidence'), ...features.map((s) => path.join(qdir, s, 'evidence'))];
  const scan = [];
  for (const d of dirs) if (isDir(d)) scan.push(...walk(d));
  for (const extra of [path.join(qdir, 'factory', 'mailbox.md')]) if (exists(extra)) scan.push(extra);
  for (const d of [path.join(qdir, 'factory', 'queue'), path.join(qdir, 'factory', 'runs')]) if (isDir(d)) scan.push(...walk(d));
  for (const f of scan) {
    const ext = path.extname(f).toLowerCase();
    if (TEXT_EXT.has(ext)) {
      let size = 0;
      try { size = fs.statSync(f).size; } catch { size = 0; }
      if (size <= 2 * 1024 * 1024) {
        const hits = findPii(readText(f) ?? '');
        for (const h of hits.slice(0, 5)) add('V5', 'error', rel(root, f), `possible ${h.kind} (PII) at line ${h.line}`, 'scrub the artifact; evidence must come from seeded fixtures');
      }
    }
    if (path.basename(f) === 'manifest.json') checkManifest(root, f, add);
  }
}

function checkManifest(root, f, add) {
  const file = rel(root, f);
  let m;
  try { m = JSON.parse(readText(f) ?? ''); } catch (e) {
    add('V5', 'error', file, `manifest is not valid JSON: ${e.message}`, 'fix the JSON');
    return;
  }
  for (const k of MANIFEST_KEYS) if (m[k] === undefined || m[k] === '') add('V5', 'error', file, `manifest is missing "${k}"`, 'see qsdlc-verify for the schema');
  if (m.schema !== undefined && m.schema !== 1) add('V5', 'error', file, 'manifest schema must be 1', 'set schema to 1');
  if (m.result !== undefined && !['pass', 'fail', 'blocked'].includes(m.result)) add('V5', 'error', file, `manifest result "${m.result}" is not pass|fail|blocked`, 'fix result');
  if (m.pii_scrubbed !== undefined && m.pii_scrubbed !== true) add('V5', 'error', file, 'pii_scrubbed must be true', 'scrub and set true, or do not keep the evidence');
  if (m.result === 'pass' && m.env && m.env.doctor_ok !== true) add('V5', 'error', file, 'a pass proof needs env.doctor_ok true', 'run the doctor check before driving');
  const base = path.dirname(f);
  for (const [k, v] of Object.entries(m.observations || {})) {
    if (typeof v === 'string' && !exists(path.join(base, v))) add('V5', 'error', file, `observation "${k}" points at missing file "${v}"`, 'keep evidence files next to the manifest');
  }
}

function checkRuns(qdir, add) {
  const rdir = path.join(qdir, 'factory', 'runs');
  if (!isDir(rdir)) return;
  for (const e of listDir(rdir)) {
    const full = path.join(rdir, e.name);
    if (e.isFile() && e.name.endsWith('.tsv')) checkRunTsv(e.name, full, add);
    else if (e.isDirectory()) {
      const rj = path.join(full, 'run.json');
      if (exists(rj)) checkRunJson(e.name, rj, add);
    }
  }
}

function checkRunTsv(name, full, add) {
  const file = `.qsdlc/factory/runs/${name}`;
  const rows = parseTsv(readText(full) ?? '');
  if (!rows.length || rows[0].join('\t') !== RUN_HEADER.join('\t')) {
    add('V6', 'error', file, `header must be: ${RUN_HEADER.join(' | ')}`, 'recreate with qsdlc-log.mjs');
    return;
  }
  const started = new Set();
  const base = name.replace(/\.tsv$/, '');
  rows.slice(1).forEach((c, i) => {
    const n = i + 2;
    if (c.length !== RUN_HEADER.length) {
      add('V6', 'error', file, `row ${n} has ${c.length} cells, expected ${RUN_HEADER.length}`, 'cells must be single-line and tab-free; use qsdlc-log.mjs');
      return;
    }
    if (!ISO_TS.test(c[0])) add('V6', 'error', file, `row ${n}: ts "${c[0]}" is not an ISO UTC timestamp`, 'use qsdlc-log.mjs');
    c.forEach((cell, j) => {
      if (/^[=+\-@]/.test(cell)) add('V6', 'error', file, `row ${n}: column ${RUN_HEADER[j]} starts with a formula character`, 'sanitize with qsdlc-log.mjs');
    });
    if (c[1] !== base) add('V6', 'error', file, `row ${n}: run_id "${c[1]}" does not match the file name`, 'one file per run id');
    if (!started.has(c[1]) && c[3] !== 'start') add('V6', 'error', file, `row ${n}: the first row of a run must have phase "start"`, 'call qsdlc-log.mjs start first');
    started.add(c[1]);
    if (c[8] !== '' && !RUN_OUTCOMES.includes(c[8])) add('V6', 'error', file, `row ${n}: outcome "${c[8]}" is not in the enum`, `use one of: ${RUN_OUTCOMES.join(', ')}`);
  });
}

function checkRunJson(dirName, full, add) {
  const file = `.qsdlc/factory/runs/${dirName}/run.json`;
  let j;
  try { j = JSON.parse(readText(full) ?? ''); } catch (e) {
    add('V6', 'error', file, `run.json is not valid JSON: ${e.message}`, 'fix the JSON');
    return;
  }
  for (const k of RUN_JSON_KEYS) if (!(k in j)) add('V6', 'error', file, `run.json is missing "${k}"`, 'see conventions section 5');
  if (j.status !== undefined && !TERMINAL.includes(j.status)) add('V6', 'error', file, `status "${j.status}" is not in the terminal enum`, `use one of: ${TERMINAL.join(', ')}`);
  if (j.run_id !== undefined && j.run_id !== dirName) add('V6', 'error', file, `run_id "${j.run_id}" does not match the folder name`, 'fix run_id');
  for (const k of ['assumptions', 'rulings', 'parked', 'unverified', 'failed_or_skipped', 'also_changed']) {
    if (k in j && !Array.isArray(j[k])) add('V6', 'error', file, `"${k}" must be an array`, 'use []');
  }
}

function checkCorrections(root, qdir, inGit, fix, info, add) {
  const cfile = path.join(qdir, 'factory', 'corrections.tsv');
  const rfile = path.join(qdir, 'factory', 'rules.md');
  const ctext = readText(cfile);
  const rtext = readText(rfile);
  if (ctext === null && rtext === null) return;
  let rows = [];
  if (ctext !== null) {
    const raw = parseTsv(ctext);
    if (!raw.length || raw[0].join('\t') !== CORR_HEADER.join('\t')) {
      add('V7', 'error', '.qsdlc/factory/corrections.tsv', `header must be: ${CORR_HEADER.join(' | ')}`, 'recreate with qsdlc-log.mjs');
    } else {
      rows = parseCorrections(ctext);
      const ids = new Set();
      rows.forEach((r, i) => {
        const n = i + 2;
        const f = '.qsdlc/factory/corrections.tsv';
        if (r._cells !== CORR_HEADER.length) add('V7', 'error', f, `row ${n} has ${r._cells} cells, expected ${CORR_HEADER.length}`, 'use qsdlc-log.mjs');
        if (!r.id || ids.has(r.id)) add('V7', 'error', f, `row ${n}: id "${r.id}" is empty or duplicated`, 'ids are unique per row');
        ids.add(r.id);
        if (!KEBAB.test(r.class)) add('V7', 'error', f, `row ${n}: class "${r.class}" is not kebab-case`, 'rename the class');
        if (!CORR_SOURCES.includes(r.source)) add('V7', 'error', f, `row ${n}: source "${r.source}" is not ${CORR_SOURCES.join('|')}`, 'fix source');
        if (!CORR_LEVELS.includes(r.level)) add('V7', 'error', f, `row ${n}: level "${r.level}" is not ${CORR_LEVELS.join('|')}`, 'fix level');
        if (!CORR_STATUS.includes(r.status)) add('V7', 'error', f, `row ${n}: status "${r.status}" is not ${CORR_STATUS.join('|')}`, 'fix status');
        if (!r.evidence) add('V7', 'error', f, `row ${n}: evidence pointer is empty`, 'add a pointer, not prose');
        for (const h of CORR_HEADER) if (/^[=+\-@]/.test(r[h] ?? '')) add('V7', 'error', f, `row ${n}: ${h} starts with a formula character`, 'sanitize with qsdlc-log.mjs');
        if (r.expires && !ISO_DATE.test(r.expires)) add('V7', 'error', f, `row ${n}: expires "${r.expires}" is not YYYY-MM-DD`, 'fix expires');
        if (r.expires && !r.approver) add('V7', 'error', f, `row ${n}: an exception with an expiry needs an approver`, 'record the human who approved');
      });
      const latest = latestPerClass(rows);
      for (const [cls, r] of latest) {
        if (r.status === 'enforced') {
          const f = '.qsdlc/factory/corrections.tsv';
          if (!r.enforcer) add('V7', 'error', f, `class ${cls}: enforced without an enforcer`, 'name the check, or set status open');
          else if (!/^[a-z0-9_-]+:/i.test(r.enforcer) && !exists(path.join(root, r.enforcer))) add('V7', 'error', f, `class ${cls}: enforcer path "${r.enforcer}" does not exist`, 'point at a real file, or use "tool:rule-id"');
          if (!HEX_SHA.test(r.proof)) add('V7', 'error', f, `class ${cls}: proof must be a commit SHA where the enforcer fails on the original mistake`, 'record the proof commit');
          else if (inGit && hasHead(root)) {
            if (git(root, ['cat-file', '-e', `${r.proof}^{commit}`]) === null) add('V7', 'error', f, `class ${cls}: proof ${r.proof} is not a known commit`, 'record a real SHA');
            else if (git(root, ['merge-base', '--is-ancestor', r.proof, 'HEAD']) === null) add('V7', 'error', f, `class ${cls}: proof ${r.proof} is not an ancestor of HEAD`, 'the proof commit must be in this history');
          }
          if (r.expires && r.expires < todayIso()) add('V7', 'error', f, `class ${cls}: exception expired on ${r.expires}`, 'fix the code, renew with approval, or retire the class');
        }
        if (r.status === 'repeat') {
          const prior = rows.filter((x) => x.class === cls && x.status === 'enforced').pop();
          if (prior && prior.level === 'doc') add('V7', 'warn', '.qsdlc/factory/corrections.tsv', `class ${cls}: a doc-level rule repeated`, 'fix at a higher level');
        }
      }
    }
  }
  const expected = generateRules(rows);
  if (rtext !== expected) {
    if (fix) {
      fs.mkdirSync(path.dirname(rfile), { recursive: true });
      fs.writeFileSync(rfile, expected);
      info.fixedRules = true;
    } else {
      add('V7', 'error', '.qsdlc/factory/rules.md', 'rules.md is out of sync with corrections.tsv (it is generated, never hand-edited)', 'run: node qsdlc-log.mjs rules --write  (or lint --fix-rules)');
    }
  }
}

function changedFilesFrom(root, base, opts) {
  if (opts.changedFiles) return opts.changedFiles.map(toPosix);
  if (!isGitRepo(root)) return null;
  const set = new Set();
  const tracked = git(root, ['diff', '--name-only', ...(base ? [base] : hasHead(root) ? ['HEAD'] : [])]);
  (tracked ?? '').split('\n').filter(Boolean).forEach((f) => set.add(f));
  (git(root, ['ls-files', '--others', '--exclude-standard']) ?? '').split('\n').filter(Boolean).forEach((f) => set.add(f));
  return [...set];
}

function checkProtected(root, features, states, policy, inGit, opts, add) {
  for (const slug of features) {
    const st = states.get(slug);
    if (!st || st.mode !== 'autonomous') continue;
    const file = `.qsdlc/${slug}/state.md`;
    if (policy === null) {
      add('V8', 'error', file, 'autonomous feature but .qsdlc/factory/policy.md is missing', 'create policy.md from policy.template.md');
      continue;
    }
    const protectedGlobs = Array.isArray(policy.protected_paths) ? policy.protected_paths : [];
    const base = /^[0-9a-f]{7,40}$/.test(st.base ?? '') ? st.base : null;
    if (!base && !opts.changedFiles) {
      add('V8', 'warn', file, 'autonomous feature has no Base SHA, so the protected-path diff cannot run', 'record Base SHA at run start');
      continue;
    }
    const changed = changedFilesFrom(root, base, opts);
    if (changed === null) continue;
    const hits = changed.filter((f) => matchesAny(protectedGlobs, f));
    if (hits.length) {
      if (st.risk !== 'protected') add('V8', 'error', file, `diff touches protected paths (${hits.slice(0, 3).join(', ')}) but Risk is not protected`, 'set Risk: protected and end needs-review');
      if (st.terminal === 'done') add('V8', 'error', file, 'diff touches protected paths, so the run cannot end done', 'set Terminal status: needs-review');
    }
  }
}

const MD_FEATURE = /^[a-z0-9-]+\/(state|Intent|spec|plan|eval|docmd|ledger|assessment|findings)\.md$/;
const MD_ALLOWED = [
  MD_FEATURE,
  /^[a-z0-9-]+\/(review|evidence)\/.+\.md$/,
  /^[a-z0-9-]+\/artifacts\/\.craft\/.+\.md$/,
  /^specs\/.+\/spec\.md$/,
  /^factory\/(policy|rules|mailbox)\.md$/,
  /^factory\/verify\/(README\.md|features\/.+\.md|formal\/.+\.md)$/,
  /^factory\/(queue|runs|audits|research|evidence)\/.+\.md$/,
  /^rituals\/.+\.md$/,
  /^archive\/.+/,
];

function checkMarkdown(root, qdir, policy, inGit, add) {
  for (const f of walk(qdir)) {
    if (!f.endsWith('.md')) continue;
    const r = toPosix(path.relative(qdir, f));
    if (!MD_ALLOWED.some((re) => re.test(r))) add('V9', 'error', `.qsdlc/${r}`, 'unsolicited markdown file outside the QSDLC record', 'delete it, or put the content in one of the five documents');
  }
  if (!inGit) return;
  const allow = [...(Array.isArray(policy?.md_allowlist) ? policy.md_allowlist : []), 'README.md', 'CHANGELOG.md', 'CLAUDE.md', 'AGENTS.md', '**/SKILL.md', '**/references/**', '.claude/**', '.qsdlc/**', 'graphify-out/**', '.archify/**'];
  const added = new Set((git(root, ['ls-files', '--others', '--exclude-standard']) ?? '').split('\n').filter(Boolean));
  if (hasHead(root)) (git(root, ['diff', '--name-only', '--diff-filter=A', 'HEAD']) ?? '').split('\n').filter(Boolean).forEach((x) => added.add(x));
  for (const f of added) {
    if (f.endsWith('.md') && !matchesAny(allow, f)) add('V9', 'error', f, 'new markdown file is not on the allowlist', 'delete it or add a md_allowlist glob to policy.md');
  }
}

export function addedLines(root, file, inGit, tracked) {
  const abs = path.join(root, file);
  const text = readText(abs);
  if (text === null) return [];
  if (!inGit || !tracked || !hasHead(root)) return text.split(/\r?\n/).map((t, i) => ({ n: i + 1, t }));
  const diff = git(root, ['diff', '-U0', '--no-color', 'HEAD', '--', file]) ?? '';
  const out = [];
  let n = 0;
  for (const l of diff.split('\n')) {
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) { n = Number(h[1]); continue; }
    if (l.startsWith('+') && !l.startsWith('+++')) out.push({ n: n++, t: l.slice(1) });
  }
  return out;
}

function checkCode(root, policy, inGit, opts, add) {
  const changed = changedFilesFrom(root, null, opts);
  if (!changed) return;
  const tracked = new Set((inGit ? git(root, ['ls-files']) ?? '' : '').split('\n').filter(Boolean));
  const maxRatio = typeof policy?.max_comment_ratio === 'number' ? policy.max_comment_ratio : 0.25;
  for (const f of changed) {
    const ext = path.extname(f).toLowerCase();
    const tok = CODE_EXT[ext];
    if (!tok || /^(\.qsdlc|node_modules|dist|build)\//.test(f)) continue;
    const lines = addedLines(root, f, inGit, tracked.has(f) && !opts.changedFiles);
    let nonBlank = 0;
    let comments = 0;
    for (const { n, t } of lines) {
      if (!t.trim()) continue;
      nonBlank++;
      const isComment = tok === '//' ? /^\s*(\/\/|\/\*|\*\s|\*\/|\*$)/.test(t) : tok === '#' ? /^\s*#(?!!)/.test(t) : /^\s*--/.test(t);
      if (isComment) comments++;
      const exc = t.match(/qsdlc-exception\(([^)]*)\)/);
      if (SUPPRESSION.test(t) && !(isStringLiteralLine(t))) {
        if (!exc) add('V11', 'error', f, `line ${n}: suppression directive without a qsdlc-exception record`, 'fix the code, or add qsdlc-exception(reason; expires: YYYY-MM-DD; approver: name)');
        else checkException(f, n, exc[1], add);
      }
      if (isComment && !exc && (/\bIMPORTANT\b/.test(t) || /do(?:\s|n't\s|\s?not\s)remove/i.test(t) || /fine for now/i.test(t))) {
        add('V11', 'error', f, `line ${n}: comment marker (IMPORTANT / do not remove / fine for now) that code should encode as a type, check, or test`, 'delete the comment and fix the cause');
      }
      const sc = t.match(/qsdlc-shortcut\(([^)]*)\)/);
      if (sc && !/upgrade:\s*\S+/.test(sc[1])) add('V11', 'warn', f, `line ${n}: shortcut marker has no upgrade trigger (no-trigger)`, 'add "; upgrade: <trigger>"');
    }
    if (nonBlank >= 8 && comments / nonBlank > maxRatio) add('V11', 'warn', f, `comment ratio ${(comments / nonBlank).toFixed(2)} exceeds ${maxRatio} on ${nonBlank} added lines`, 'delete comments that restate code');
  }
}

function isStringLiteralLine(t) {
  return /(['"`])[^'"`]*(?:@ts-ignore|eslint-disable|noqa|nolint)[^'"`]*\1/.test(t) && !/^\s*(\/\/|#|\/\*|\*)/.test(t);
}

function checkException(f, n, body, add) {
  const parts = body.split(';').map((s) => s.trim());
  const reason = parts[0];
  const exp = (parts.find((p) => /^expires:/i.test(p)) ?? '').replace(/^expires:\s*/i, '');
  const appr = (parts.find((p) => /^approver:/i.test(p)) ?? '').replace(/^approver:\s*/i, '');
  if (!reason || /^expires:|^approver:/i.test(reason)) add('V11', 'error', f, `line ${n}: qsdlc-exception has no reason`, 'state why');
  if (!ISO_DATE.test(exp)) add('V11', 'error', f, `line ${n}: qsdlc-exception has no valid expires: YYYY-MM-DD`, 'add an expiry date');
  else if (exp < todayIso()) add('V11', 'error', f, `line ${n}: qsdlc-exception expired on ${exp}`, 'fix the code or renew with approval');
  if (!appr) add('V11', 'error', f, `line ${n}: qsdlc-exception has no approver`, 'record the approving human');
}

function checkFormal(root, qdir, inGit, add) {
  const fdir = path.join(qdir, 'factory', 'verify', 'formal');
  if (!isDir(fdir)) return;
  for (const e of listDir(fdir)) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const file = `.qsdlc/factory/verify/formal/${e.name}`;
    const { front } = splitFrontmatter(readText(path.join(fdir, e.name)) ?? '');
    const y = front === null ? {} : parseYamlLite(front);
    const covers = Array.isArray(y.covers) ? y.covers : [];
    const sync = String(y.sync_commit ?? '');
    if (!covers.length) add('V12', 'error', file, 'frontmatter needs a covers: list of globs', 'list the code the check covers');
    if (!HEX_SHA.test(sync)) {
      add('V12', 'error', file, 'frontmatter needs sync_commit: <sha> (the last commit where the model matched the code)', 'record the sync commit');
      continue;
    }
    if (!inGit || !hasHead(root)) {
      add('V12', 'warn', file, 'not a git repo, so sync freshness cannot be checked', '');
      continue;
    }
    if (git(root, ['merge-base', '--is-ancestor', sync, 'HEAD']) === null) {
      add('V12', 'error', file, `sync_commit ${sync} is not an ancestor of HEAD`, 'record a commit in this history');
      continue;
    }
    const since = new Set((git(root, ['log', '--name-only', '--pretty=format:', `${sync}..HEAD`]) ?? '').split('\n').filter(Boolean));
    (git(root, ['diff', '--name-only', 'HEAD']) ?? '').split('\n').filter(Boolean).forEach((x) => since.add(x));
    (git(root, ['ls-files', '--others', '--exclude-standard']) ?? '').split('\n').filter(Boolean).forEach((x) => since.add(x));
    const stale = [...since].filter((x) => matchesAny(covers, x));
    if (stale.length) add('V12', 'error', file, `covered code changed after sync ${sync}: ${stale.slice(0, 3).join(', ')}`, 'update the model from the code, then move sync_commit');
  }
}

const HELP = `qsdlc-lint: deterministic QSDLC validator (V1-V12)

usage: node qsdlc-lint.mjs --root <project> [--slug <slug>] [--fix-rules] [--json] [--strict]
                           [--changed-files a,b,c] [--no-code]

  --root           project root containing .qsdlc/ (default: cwd)
  --slug           validate one feature folder only
  --fix-rules      regenerate .qsdlc/factory/rules.md from corrections.tsv
  --json           machine-readable output
  --strict         treat warnings as errors
  --changed-files  override the git diff for V8 and V11 (comma-separated, project-relative)
  --no-code        skip V11 on source files

exit: 0 clean, 1 violations, 2 usage error`;

function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  if (flags.help || flags.h) {
    console.log(HELP);
    return 0;
  }
  const root = path.resolve(typeof flags.root === 'string' ? flags.root : '.');
  if (!isDir(root)) {
    console.error(`qsdlc-lint: root "${root}" is not a directory`);
    return 2;
  }
  const res = lint({
    root,
    slug: typeof flags.slug === 'string' ? flags.slug : undefined,
    fixRules: !!flags['fix-rules'],
    changedFiles: typeof flags['changed-files'] === 'string' ? flags['changed-files'].split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    noCode: !!flags['no-code'],
  });
  const strict = !!flags.strict;
  const failed = res.errors > 0 || (strict && res.warnings > 0);
  if (flags.json) {
    console.log(JSON.stringify({ ok: !failed, errors: res.errors, warnings: res.warnings, fixed_rules: res.fixedRules, violations: res.violations }, null, 2));
  } else {
    for (const v of res.violations) console.log(`${v.id} ${v.severity} ${v.file}: ${v.message}${v.fix ? ` (fix: ${v.fix})` : ''}`);
    if (res.fixedRules) console.log('rules.md regenerated from corrections.tsv');
    console.log(`qsdlc-lint: ${res.errors} error(s), ${res.warnings} warning(s)${strict ? ' [strict]' : ''}`);
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
