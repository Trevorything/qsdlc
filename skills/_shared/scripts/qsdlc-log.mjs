#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CORR_HEADER, CORR_LEVELS, CORR_SOURCES, CORR_STATUS, HEX_SHA, KEBAB, RUN_HEADER, RUN_OUTCOMES, ISO_DATE,
  computeMetrics, findPii, generateRules, latestPerClass, nowIso, parseArgs, parseCorrections, readText, sanitizeCell,
  tsvLine,
} from './qsdlc-lib.mjs';

const HELP = `qsdlc-log: append-only logger for QSDLC factory runs, corrections, and the mailbox

usage: node qsdlc-log.mjs <command> [--root <project>] [options]

commands
  start       --run-id R --loop L [--why W]
  row         --run-id R --loop L --phase P --decision D --why W [--evidence E] [--result X] [--outcome O]
  end         --run-id R --loop L --outcome O [--why W]
  correction  --class C --source S --evidence E --area A --level LVL
              [--enforcer X --proof SHA --status open|enforced|repeat|retired --expires YYYY-MM-DD --approver N]
  rules       [--write | --check]
  metrics     [--days 30] [--json]
  mailbox     --run-id R --status S (--summary T | --note T) [--pr URL] [--reverse T]
  sanitize    <text>

Run log:     <root>/.qsdlc/factory/runs/<run-id>.tsv (columns: ${RUN_HEADER.join(', ')})
Corrections: <root>/.qsdlc/factory/corrections.tsv
Every cell is flattened to one line and formula-prefixed cells get a leading quote.
--ts overrides the timestamp (tests only).`;

class UsageError extends Error {}

function need(flags, names) {
  for (const n of names) {
    if (typeof flags[n] !== 'string' || flags[n] === '') throw new UsageError(`missing --${n}`);
  }
}

function factoryDir(root) {
  return path.join(root, '.qsdlc', 'factory');
}

function runFile(root, runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,80}$/.test(runId)) throw new UsageError(`invalid --run-id "${runId}"`);
  return path.join(factoryDir(root), 'runs', `${runId}.tsv`);
}

function appendRow(root, f, phase) {
  const file = runFile(root, f['run-id']);
  const exists = fs.existsSync(file);
  if (!exists && phase !== 'start') throw new UsageError('this run has no start row; call "start" first');
  if (exists && phase === 'start') throw new UsageError('this run already has a start row');
  if (f.outcome !== undefined && f.outcome !== '' && !RUN_OUTCOMES.includes(f.outcome)) {
    throw new UsageError(`--outcome must be one of ${RUN_OUTCOMES.join(', ')}`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!exists) fs.writeFileSync(file, RUN_HEADER.join('\t') + '\n');
  const cells = [
    typeof f.ts === 'string' ? f.ts : nowIso(), f['run-id'], f.loop, phase, f.decision ?? '', f.why ?? '',
    f.evidence ?? '', f.result ?? '', f.outcome ?? '',
  ];
  fs.appendFileSync(file, tsvLine(cells));
  return file;
}

function cmdStart(root, f) {
  need(f, ['run-id', 'loop']);
  return appendRow(root, { ...f, decision: 'start', why: f.why ?? 'run started' }, 'start');
}

function cmdRow(root, f) {
  need(f, ['run-id', 'loop', 'phase', 'decision', 'why']);
  if (f.phase === 'start') throw new UsageError('use the start command for the start row');
  return appendRow(root, f, f.phase);
}

function cmdEnd(root, f) {
  need(f, ['run-id', 'loop', 'outcome']);
  return appendRow(root, { ...f, decision: 'end', why: f.why ?? 'run ended' }, 'end');
}

function loadCorrections(root) {
  const file = path.join(factoryDir(root), 'corrections.tsv');
  const text = readText(file);
  return { file, rows: text === null ? null : parseCorrections(text) };
}

function cmdCorrection(root, f) {
  need(f, ['class', 'source', 'evidence', 'area', 'level']);
  if (!KEBAB.test(f.class)) throw new UsageError('--class must be kebab-case');
  if (!CORR_SOURCES.includes(f.source)) throw new UsageError(`--source must be one of ${CORR_SOURCES.join(', ')}`);
  if (!CORR_LEVELS.includes(f.level)) throw new UsageError(`--level must be one of ${CORR_LEVELS.join(', ')}`);
  let status = typeof f.status === 'string' ? f.status : 'open';
  if (!CORR_STATUS.includes(status)) throw new UsageError(`--status must be one of ${CORR_STATUS.join(', ')}`);
  if (status === 'enforced') {
    if (!f.enforcer || f.enforcer === true) throw new UsageError('status enforced needs --enforcer');
    if (typeof f.proof !== 'string' || !HEX_SHA.test(f.proof)) throw new UsageError('status enforced needs --proof <commit sha> (the enforcer failing on the original mistake)');
  }
  if (f.expires && !ISO_DATE.test(String(f.expires))) throw new UsageError('--expires must be YYYY-MM-DD');
  if (f.expires && !f.approver) throw new UsageError('--expires needs --approver');
  const { file, rows } = loadCorrections(root);
  const existing = rows ?? [];
  const latest = latestPerClass(existing).get(f.class);
  let note = '';
  if (status === 'open' && latest && latest.status === 'enforced') {
    status = 'repeat';
    note = ` (class ${f.class} was enforced, so this is a repeat: the enforcer is wrong or missing coverage)`;
  }
  const max = existing.reduce((m, r) => Math.max(m, Number((r.id.match(/^C-(\d+)$/) ?? [])[1] ?? 0)), 0);
  const id = `C-${String(max + 1).padStart(4, '0')}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (rows === null) fs.writeFileSync(file, CORR_HEADER.join('\t') + '\n');
  const str = (v) => (typeof v === 'string' ? v : '');
  fs.appendFileSync(file, tsvLine([
    typeof f.ts === 'string' ? f.ts : nowIso(), id, f.class, f.source, f.evidence, f.area, f.level,
    str(f.enforcer), str(f.proof), status, str(f.expires), str(f.approver),
  ]));
  return `${id} ${f.class} ${status}${note}`;
}

function cmdRules(root, f) {
  const { rows } = loadCorrections(root);
  const text = generateRules(rows ?? []);
  const file = path.join(factoryDir(root), 'rules.md');
  if (f.check) {
    const cur = readText(file);
    if (cur === text) return { code: 0, msg: 'rules.md is in sync' };
    return { code: 1, msg: 'rules.md is out of sync with corrections.tsv; run: rules --write' };
  }
  if (f.write) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return { code: 0, msg: `wrote ${path.relative(root, file).replace(/\\/g, '/')}` };
  }
  return { code: 0, msg: text };
}

function cmdMetrics(root, f) {
  const { rows } = loadCorrections(root);
  const days = typeof f.days === 'string' ? Number(f.days) : 30;
  if (!Number.isFinite(days) || days <= 0) throw new UsageError('--days must be a positive number');
  const m = computeMetrics(rows ?? [], { days });
  if (f.json) return JSON.stringify(m, null, 2);
  return [
    `window_days: ${m.window_days}`,
    `classes: ${m.classes}`,
    `enforced_classes: ${m.enforced_classes}`,
    `doc_level_share: ${m.doc_level_share}`,
    `repeat_rate: ${m.repeat_rate}`,
    `time_to_enforce_days: ${m.time_to_enforce_days ?? 'n/a'}`,
    `uncovered_classes: ${m.uncovered_classes.join(', ') || 'none'}`,
  ].join('\n');
}

function cmdMailbox(root, f) {
  need(f, ['run-id', 'status']);
  const summary = typeof f.summary === 'string' ? f.summary : typeof f.note === 'string' ? f.note : '';
  if (!summary) throw new UsageError('missing --summary (or --note)');
  const body = [summary, f.pr, f.reverse].filter((x) => typeof x === 'string').join('\n');
  const pii = findPii(body);
  if (pii.length) throw new UsageError(`refusing to write: possible ${pii[0].kind} (PII) in the entry; the mailbox must stay PII-free`);
  const file = path.join(factoryDir(root), 'mailbox.md');
  const header = '# Mailbox\n\nNewest first. Add entries at the top; never edit older ones.\n\n';
  const clean = (s) => sanitizeCell(s).replace(/^'/, '');
  const entry = [
    `## ${typeof f.ts === 'string' ? f.ts : nowIso()} | ${clean(f['run-id'])} | ${clean(f.status)}`,
    '',
    `- Summary: ${clean(summary)}`,
    ...(typeof f.pr === 'string' ? [`- PR: ${clean(f.pr)}`] : []),
    ...(typeof f.reverse === 'string' ? [`- Reverse: ${clean(f.reverse)}`] : []),
    '',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const cur = readText(file);
  if (cur === null) fs.writeFileSync(file, header + entry);
  else {
    const i = cur.search(/^## /m);
    fs.writeFileSync(file, i === -1 ? cur.replace(/\s*$/, '\n\n') + entry : cur.slice(0, i) + entry + cur.slice(i));
  }
  return `mailbox entry added for ${f['run-id']}`;
}

export function run(argv) {
  const { flags, positional } = parseArgs(argv);
  const cmd = positional[0];
  const wantsHelp = flags.help !== undefined || argv.includes('-h') || cmd === 'help';
  if (wantsHelp) return { code: 0, stdout: HELP };
  if (!cmd) return { code: 2, stdout: HELP };
  const root = path.resolve(typeof flags.root === 'string' ? flags.root : '.');
  try {
    switch (cmd) {
      case 'start': return { code: 0, stdout: `logged start: ${path.relative(root, cmdStart(root, flags)).replace(/\\/g, '/')}` };
      case 'row': return { code: 0, stdout: `logged row: ${path.relative(root, cmdRow(root, flags)).replace(/\\/g, '/')}` };
      case 'end': return { code: 0, stdout: `logged end: ${path.relative(root, cmdEnd(root, flags)).replace(/\\/g, '/')}` };
      case 'correction': return { code: 0, stdout: cmdCorrection(root, flags) };
      case 'rules': { const r = cmdRules(root, flags); return { code: r.code, stdout: r.msg }; }
      case 'metrics': return { code: 0, stdout: cmdMetrics(root, flags) };
      case 'mailbox': return { code: 0, stdout: cmdMailbox(root, flags) };
      case 'sanitize': return { code: 0, stdout: sanitizeCell(positional.slice(1).join(' ')) };
      default: return { code: 2, stdout: `unknown command "${cmd}"\n\n${HELP}` };
    }
  } catch (e) {
    if (e instanceof UsageError) return { code: 2, stderr: `qsdlc-log: ${e.message}` };
    throw e;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = run(process.argv.slice(2));
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.error(r.stderr);
  process.exitCode = r.code;
}
