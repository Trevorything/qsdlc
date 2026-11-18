#!/usr/bin/env node
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globToRegExp, parseYamlLite, sanitizeCell, generateRules, computeMetrics, parseCorrections, findPii } from '../scripts/qsdlc-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILLS = path.resolve(here, '..', '..');
const LINT = path.join(SKILLS, '_shared', 'scripts', 'qsdlc-lint.mjs');
const LOG = path.join(SKILLS, '_shared', 'scripts', 'qsdlc-log.mjs');
const GUARD = path.join(SKILLS, 'qsdlc-guard', 'scripts', 'guard-check.mjs');
const SWEEP = path.join(SKILLS, 'qsdlc-sweep', 'scripts', 'sweep-state.mjs');

const tempDirs = [];
const results = [];

function test(name, fn) {
  results.push({ name, fn });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `qsdlc-test-${prefix}-`));
  tempDirs.push(d);
  return d;
}

function sh(cwd, cmd, args) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function write(root, rel, text) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runNode(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function lint(root, ...args) {
  const r = runNode(LINT, ['--root', root, '--json', ...args], root);
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { json = null; }
  return { ...r, json };
}

function ids(res, severity) {
  return (res.json?.violations ?? []).filter((v) => !severity || v.severity === severity).map((v) => v.id);
}

function log(root, ...args) {
  return runNode(LOG, [...args, '--root', root], root);
}

const STATE = `# State: demo-feature

- Current stage: test
- Last updated: 2026-11-18
- Mode: interactive
- Track: delta
- Risk: standard
- Autonomy eligible: false
- Skipped: none
- Pending confirmation: none
- Terminal status: none
- Base SHA: none
- Branch: none
- Worktree: none

## Log
- 2026-11-18 plan stage started
- 2026-11-18 design stage completed
`;

const EVAL = `# Eval: demo

## Test cases

| ID | Req | Feature ID | Description | Steps | Expected result | Status | Evidence | Last run | Notes |
|---|---|---|---|---|---|---|---|---|---|
| T1 | F1 | search | Search works | run it | results | pass | evidence/01.txt | 2026-11-18 | |
| T2 | R1 | n/a: no map yet | Perf check | run it | fast | not run | | | |

## Summary

- Total: 2
- Passed: 1
- Failed: 0
- Blocked: 0
- Not run: 1
- Last run: 2026-11-18
- Verdict: not run
`;

const FEATURE = `# Search

## Sub-features

- \`search-open\` : open the search box
- \`search-match\` : match results

## How to get to it (user POV)

1. From the main navigation.

## Driving it with playwright

Preconditions: disposable data dir set by DATA_DIR, seeded records loaded.

- \`search-open\`: \`npm run drive -- open\`. Observe: the box is focused.

## Gotchas

- Seeded data only.
`;

const POLICY = `---
schema: 1
protected_paths:
  - "src/**/billing/**"
  - "**/migrations/**"
md_allowlist:
  - "docs/**"
max_comment_ratio: 0.25
autonomous:
  grants: [commit_branch, push_branch, open_draft_pr]
  max_files: 12
  protected_path_outcome: needs-review
---

# Factory policy
`;

function makeGood() {
  const root = tmp('good');
  sh(root, 'git', ['init', '-q']);
  sh(root, 'git', ['config', 'user.email', 't@example.test']);
  sh(root, 'git', ['config', 'user.name', 'tester']);
  sh(root, 'git', ['config', 'commit.gpgsign', 'false']);
  sh(root, 'git', ['config', 'core.autocrlf', 'false']);
  write(root, 'eslint/no-local-date.js', 'export default {};\n');
  write(root, 'README.md', '# demo\n');
  sh(root, 'git', ['add', '-A']);
  sh(root, 'git', ['commit', '-q', '-m', 'enforcer']);
  const proof = sh(root, 'git', ['rev-parse', '--short', 'HEAD']);
  write(root, '.qsdlc/demo-feature/state.md', STATE);
  for (const f of ['Intent.md', 'spec.md', 'plan.md']) write(root, `.qsdlc/demo-feature/${f}`, `# ${f}\n\nPlain text.\n`);
  write(root, '.qsdlc/demo-feature/eval.md', EVAL);
  write(root, '.qsdlc/demo-feature/evidence/01.txt', 'exit 0\n');
  write(root, '.qsdlc/demo-feature/artifacts/inspo.html', '<html></html>\n');
  write(root, '.qsdlc/factory/policy.md', POLICY);
  write(root, '.qsdlc/factory/verify/README.md', '# Verify map\n\n- [search](features/search.md)\n');
  write(root, '.qsdlc/factory/verify/features/search.md', FEATURE);
  write(root, '.qsdlc/factory/evidence/2026-11-18-verify-001/search/stdout.txt', 'ok\n');
  write(root, '.qsdlc/factory/evidence/2026-11-18-verify-001/search/manifest.json', JSON.stringify({
    schema: 1, run_id: '2026-11-18-verify-001', feature_id: 'search', sub_feature_id: 'search-open', entry_point: 'toolbar',
    build_rev: 'abc1234', env: { data_dir: 'x', doctor_ok: true }, observations: { exit_code: 0, stdout: 'stdout.txt' },
    result: 'pass', pii_scrubbed: true,
  }));
  const rid = '2026-11-18-factory-001';
  let r = log(root, 'start', '--run-id', rid, '--loop', 'factory', '--ts', '2026-11-18T10:00:00Z');
  assert(r.code === 0, `log start failed: ${r.stderr}`);
  r = log(root, 'row', '--run-id', rid, '--loop', 'factory', '--phase', 'build', '--decision', 'phase 1', '--why', 'plan order', '--ts', '2026-11-18T10:01:00Z');
  assert(r.code === 0, `log row failed: ${r.stderr}`);
  r = log(root, 'end', '--run-id', rid, '--loop', 'factory', '--outcome', 'done', '--ts', '2026-11-18T10:02:00Z');
  assert(r.code === 0, `log end failed: ${r.stderr}`);
  write(root, `.qsdlc/factory/runs/${rid}/run.json`, JSON.stringify({
    run_id: rid, loop: 'factory', ticket: 'T-0001', track: 'delta', mode: 'autonomous', status: 'done', base_sha: 'abc1234',
    head_sha: 'def5678', branch: 'qsdlc/auto/demo-2026-11-18', pr_url: '', budgets_used: {}, assumptions: [], rulings: [],
    parked: [], unverified: [], failed_or_skipped: [], also_changed: [],
  }));
  r = log(root, 'correction', '--class', 'date-math-uses-local-tz', '--source', 'review', '--evidence', 'pr#212', '--area', 'rent-calc', '--level', 'lint',
    '--enforcer', 'eslint/no-local-date.js', '--proof', proof, '--status', 'enforced', '--ts', '2026-11-18T10:03:00Z');
  assert(r.code === 0, `log correction failed: ${r.stderr}`);
  r = log(root, 'rules', '--write');
  assert(r.code === 0, `rules --write failed: ${r.stderr}`);
  sh(root, 'git', ['add', '-A']);
  sh(root, 'git', ['commit', '-q', '-m', 'fixture']);
  return { root, proof };
}

function clone(src) {
  const dst = tmp('case');
  fs.cpSync(src, dst, { recursive: true });
  return dst;
}

let GOOD = null;
const good = () => (GOOD ??= makeGood());

function expectError(res, id, msg) {
  assert(res.json, `lint produced no JSON (${res.stderr || res.stdout})`);
  assert(ids(res, 'error').includes(id), `${msg}: expected ${id} error, got ${JSON.stringify(res.json.violations.map((v) => `${v.id}:${v.severity}:${v.message}`))}`);
  assert(res.code === 1, `${msg}: expected exit 1, got ${res.code}`);
}

// library units
test('lib: yaml-lite parses maps, lists, inline lists, lists of maps', () => {
  const y = parseYamlLite(`schema: 1
protected_paths:
  - "src/**/billing/**"
  - other/**
autonomous:
  grants: [a, b]
  max_files: 12
  delete: soft # comment
sources:
  - name: gh
    approved: true
    ref: owner/repo
  - name: inbox
    approved: false
`);
  eq(y.schema, 1, 'schema');
  eq(y.protected_paths, ['src/**/billing/**', 'other/**'], 'block list');
  eq(y.autonomous.grants, ['a', 'b'], 'inline list');
  eq(y.autonomous.delete, 'soft', 'comment stripped');
  eq(y.sources.length, 2, 'list of maps');
  eq(y.sources[0].approved, true, 'bool');
  eq(y.sources[1].name, 'inbox', 'second map');
});

test('lib: glob matching handles ** and *', () => {
  assert(globToRegExp('src/**/billing/**').test('src/billing/x.js'), 'src/billing/x.js');
  assert(globToRegExp('src/**/billing/**').test('src/a/b/billing/x.js'), 'nested');
  assert(!globToRegExp('src/*.js').test('src/a/b.js'), 'single star stays in segment');
  assert(globToRegExp('**/migrations/**').test('db/migrations/001.sql'), 'migrations');
});

test('lib: sanitizeCell strips tabs and prefixes formula characters', () => {
  eq(sanitizeCell('a\tb\nc'), 'a b c', 'whitespace');
  for (const c of ['=1+1', '+1', '-1', '@x']) assert(sanitizeCell(c).startsWith("'"), `prefix for ${c}`);
  eq(sanitizeCell('plain'), 'plain', 'plain');
});

test('lib: findPii catches SSN, DOB, and street address', () => {
  assert(findPii('ssn 123-45-6789').length === 1, 'ssn');
  assert(findPii('DOB: 04/05/1980').length === 1, 'dob');
  assert(findPii('lives at 123 Main Street').length === 1, 'address');
  assert(findPii('run 2026-11-18 build 1234').length === 0, 'no false positive on dates');
});

test('lib: rules and metrics derive from the latest row per class', () => {
  const rows = parseCorrections([
    'ts\tid\tclass\tsource\tevidence\tarea\tlevel\tenforcer\tproof\tstatus\texpires\tapprover',
    '2026-10-01T00:00:00Z\tC-0001\ta-class\treview\tpr#1\tx\tdoc\t\t\topen\t\t',
    '2026-10-05T00:00:00Z\tC-0002\ta-class\treview\tpr#2\tx\tdoc\t\t\topen\t\t',
    '2026-10-07T00:00:00Z\tC-0003\ta-class\tci\tci#9\tx\tlint\tlint:rule\tabcdef1\tenforced\t\t',
    '2026-11-17T00:00:00Z\tC-0004\ta-class\treview\tpr#3\tx\tlint\t\t\trepeat\t\t',
    '2026-10-01T00:00:00Z\tC-0005\tb-class\treview\tpr#4\tx\tdoc\t\t\topen\t\t',
    '2026-10-02T00:00:00Z\tC-0006\tb-class\treview\tpr#5\tx\tdoc\t\t\topen\t\t',
    '2026-10-03T00:00:00Z\tC-0007\tc-class\treview\tpr#6\tx\tdoc\tdoc:rule\tabcdef2\tenforced\t\t',
  ].join('\n'));
  assert(generateRules(rows).includes('| c-class |'), 'enforced c-class listed');
  assert(!generateRules(rows).includes('| a-class |'), 'repeat a-class not listed');
  const m = computeMetrics(rows, { days: 30, now: new Date('2026-11-18T00:00:00Z') });
  eq(m.uncovered_classes, ['a-class', 'b-class'], 'uncovered');
  eq(m.doc_level_share, 1, 'only c-class is enforced now and it is doc level');
  assert(m.repeat_rate > 0, 'repeat rate positive');
});

// valid fixture
test('lint: valid fixture passes strict with zero violations', () => {
  const r = lint(good().root, '--strict');
  assert(r.json, `no JSON: ${r.stderr}${r.stdout}`);
  assert(r.code === 0, `expected exit 0, got ${r.code}: ${JSON.stringify(r.json.violations)}`);
  eq(r.json.violations.length, 0, 'no violations');
});

test('lint: --help exits 0 and documents flags', () => {
  const r = runNode(LINT, ['--help'], SKILLS);
  assert(r.code === 0 && /--fix-rules/.test(r.stdout) && /--json/.test(r.stdout), 'help text');
});

// V1
test('V1: stray file in a feature folder fails', () => {
  const d = clone(good().root);
  write(d, '.qsdlc/demo-feature/notes.txt', 'x');
  expectError(lint(d), 'V1', 'stray file');
});

test('V1: missing stage document without Skipped fails; Skipped makes it pass', () => {
  const d = clone(good().root);
  fs.rmSync(path.join(d, '.qsdlc/demo-feature/spec.md'));
  expectError(lint(d), 'V1', 'missing spec');
  write(d, '.qsdlc/demo-feature/state.md', read(d, '.qsdlc/demo-feature/state.md').replace('Skipped: none', 'Skipped: design'));
  const r = lint(d);
  assert(!ids(r, 'error').includes('V1'), `skipped design should pass V1: ${JSON.stringify(r.json.violations)}`);
});

test('V1: non-kebab slug and folder without state.md fail', () => {
  const d = clone(good().root);
  write(d, '.qsdlc/Bad_Slug/state.md', STATE);
  expectError(lint(d), 'V1', 'non-kebab slug');
  const e = clone(good().root);
  write(e, '.qsdlc/orphan/Intent.md', 'x');
  expectError(lint(e), 'V1', 'no state.md');
});

test('V1: unknown artifact file fails, .craft is allowed', () => {
  const d = clone(good().root);
  write(d, '.qsdlc/demo-feature/artifacts/.craft/data.json', '{}');
  assert(!ids(lint(d), 'error').includes('V1'), '.craft allowed');
  write(d, '.qsdlc/demo-feature/artifacts/extra.html', '<p/>');
  expectError(lint(d), 'V1', 'unknown artifact');
});

// V2
test('V2: invalid stage fails', () => {
  const d = clone(good().root);
  write(d, '.qsdlc/demo-feature/state.md', read(d, '.qsdlc/demo-feature/state.md').replace('Current stage: test', 'Current stage: shipping'));
  expectError(lint(d), 'V2', 'bad stage');
});

test('V2: editing an old log line fails (append-only), appending passes', () => {
  const d = clone(good().root);
  const p = '.qsdlc/demo-feature/state.md';
  write(d, p, read(d, p).replace('plan stage started', 'plan stage began'));
  expectError(lint(d), 'V2', 'edited log');
  const e = clone(good().root);
  write(e, p, read(e, p) + '- 2026-11-19 build started\n');
  assert(!ids(lint(e), 'error').includes('V2'), 'append ok');
});

test('V2: autonomous run at done needs a terminal status; protected cannot be done', () => {
  const d = clone(good().root);
  const p = '.qsdlc/demo-feature/state.md';
  write(d, p, read(d, p).replace('Current stage: test', 'Current stage: done').replace('Mode: interactive', 'Mode: autonomous').replace('Skipped: none', 'Skipped: deploy'));
  expectError(lint(d), 'V2', 'autonomous done without terminal');
  write(d, p, read(d, p).replace('Terminal status: none', 'Terminal status: done').replace('Risk: standard', 'Risk: protected'));
  expectError(lint(d), 'V2', 'protected done');
});

// V3
test('V3: pass without evidence fails; unresolved evidence fails', () => {
  const d = clone(good().root);
  const p = '.qsdlc/demo-feature/eval.md';
  write(d, p, read(d, p).replace('evidence/01.txt', ''));
  expectError(lint(d), 'V3', 'pass without evidence');
  const e = clone(good().root);
  write(e, p, read(e, p).replace('evidence/01.txt', 'evidence/missing.txt'));
  expectError(lint(e), 'V3', 'unresolved evidence');
});

test('V3: summary math mismatch fails', () => {
  const d = clone(good().root);
  const p = '.qsdlc/demo-feature/eval.md';
  write(d, p, read(d, p).replace('- Passed: 1', '- Passed: 2'));
  expectError(lint(d), 'V3', 'summary mismatch');
});

test('V3: duplicate ID, bad status, unknown Feature ID, bad blocked note all fail', () => {
  const p = '.qsdlc/demo-feature/eval.md';
  let d = clone(good().root);
  write(d, p, read(d, p).replace('| T2 |', '| T1 |'));
  expectError(lint(d), 'V3', 'duplicate id');
  d = clone(good().root);
  write(d, p, read(d, p).replace('not run | | | |', 'maybe | | | |'));
  expectError(lint(d), 'V3', 'bad status');
  d = clone(good().root);
  write(d, p, read(d, p).replace('| F1 | search |', '| F1 | ghost-feature |'));
  expectError(lint(d), 'V3', 'unknown feature id');
  d = clone(good().root);
  write(d, p, read(d, p).replace('| not run | | | |', '| blocked | | | unreachable: no staging |').replace('- Blocked: 0', '- Blocked: 1').replace('- Not run: 1', '- Not run: 0'));
  expectError(lint(d), 'V3', 'blocked note format');
});

// V4
test('V4: wrong H2 set fails; missing Preconditions fails; bullet without command fails', () => {
  const f = '.qsdlc/factory/verify/features/search.md';
  let d = clone(good().root);
  write(d, f, read(d, f).replace('## Gotchas', '## Extras'));
  expectError(lint(d), 'V4', 'wrong h2');
  d = clone(good().root);
  write(d, f, read(d, f).replace('Preconditions:', 'Setup:'));
  expectError(lint(d), 'V4', 'no preconditions');
  d = clone(good().root);
  write(d, f, read(d, f).replace('`npm run drive -- open`', 'click around'));
  expectError(lint(d), 'V4', 'no command');
});

test('V4: README must index every feature file and links must resolve', () => {
  const d = clone(good().root);
  write(d, '.qsdlc/factory/verify/README.md', '# Verify map\n\n- [gone](features/gone.md)\n');
  expectError(lint(d), 'V4', 'readme links');
});

// V5
test('V5: manifest with pii_scrubbed false or missing observation file fails', () => {
  const m = '.qsdlc/factory/evidence/2026-11-18-verify-001/search/manifest.json';
  let d = clone(good().root);
  write(d, m, read(d, m).replace('"pii_scrubbed":true', '"pii_scrubbed":false'));
  expectError(lint(d), 'V5', 'pii_scrubbed false');
  d = clone(good().root);
  write(d, m, read(d, m).replace('stdout.txt', 'nothing.txt'));
  expectError(lint(d), 'V5', 'missing observation');
});

test('V5: SSN in evidence text fails', () => {
  const d = clone(good().root);
  write(d, '.qsdlc/factory/evidence/2026-11-18-verify-001/search/stdout.txt', 'customer ssn 123-45-6789\n');
  expectError(lint(d), 'V5', 'ssn');
});

// V6
test('V6: formula cell, missing start row, bad run.json status fail', () => {
  const rid = '2026-11-18-factory-001';
  let d = clone(good().root);
  const f = `.qsdlc/factory/runs/${rid}.tsv`;
  write(d, f, read(d, f) + `2026-11-18T10:05:00Z\t${rid}\tfactory\tbuild\t=SUM(A1)\twhy\t\t\t\n`);
  expectError(lint(d), 'V6', 'formula cell');
  d = clone(good().root);
  write(d, '.qsdlc/factory/runs/2026-11-18-sweep-001.tsv', 'ts\trun_id\tloop\tphase\tdecision\twhy\tevidence\tresult\toutcome\n2026-11-18T10:00:00Z\t2026-11-18-sweep-001\tsweep\tbuild\td\tw\t\t\t\n');
  expectError(lint(d), 'V6', 'no start row');
  d = clone(good().root);
  const j = `.qsdlc/factory/runs/${rid}/run.json`;
  write(d, j, read(d, j).replace('"status":"done"', '"status":"great"'));
  expectError(lint(d), 'V6', 'bad run.json status');
});

// V7
test('V7: hand-edited rules.md fails; --fix-rules repairs it', () => {
  const d = clone(good().root);
  write(d, '.qsdlc/factory/rules.md', read(d, '.qsdlc/factory/rules.md') + '| hand-added | x | doc | abc1234 | |\n');
  expectError(lint(d), 'V7', 'rules drift');
  const fixed = lint(d, '--fix-rules');
  assert(fixed.code === 0, `fix-rules should leave a clean lint: ${JSON.stringify(fixed.json?.violations)}`);
  assert(!read(d, '.qsdlc/factory/rules.md').includes('hand-added'), 'rules regenerated');
  assert(lint(d).code === 0, 'clean after fix');
});

test('V7: enforced without proof or with unknown proof commit fails', () => {
  const c = '.qsdlc/factory/corrections.tsv';
  let d = clone(good().root);
  write(d, c, read(d, c).replace(/\tenforced/, '\tenforced').replace(good().proof, ''));
  expectError(lint(d), 'V7', 'no proof');
  d = clone(good().root);
  write(d, c, read(d, c).replace(good().proof, 'deadbee'));
  expectError(lint(d), 'V7', 'unknown proof');
});

test('V7: enforcer path that does not exist fails', () => {
  const c = '.qsdlc/factory/corrections.tsv';
  const d = clone(good().root);
  write(d, c, read(d, c).replace('eslint/no-local-date.js', 'eslint/missing.js'));
  expectError(lint(d), 'V7', 'missing enforcer');
});

// V8
test('V8: autonomous run touching protected paths must be Risk protected and not done', () => {
  const d = clone(good().root);
  const sha = sh(d, 'git', ['rev-parse', 'HEAD']);
  const p = '.qsdlc/demo-feature/state.md';
  write(d, p, read(d, p).replace('Mode: interactive', 'Mode: autonomous').replace('Base SHA: none', `Base SHA: ${sha}`));
  write(d, 'src/billing/calc.js', 'export const x = 1;\n');
  expectError(lint(d), 'V8', 'protected with standard risk');
  write(d, p, read(d, p).replace('Risk: standard', 'Risk: protected'));
  assert(!ids(lint(d), 'error').includes('V8'), 'protected risk accepted');
});

test('V8: autonomous feature without policy.md fails', () => {
  const d = clone(good().root);
  const p = '.qsdlc/demo-feature/state.md';
  write(d, p, read(d, p).replace('Mode: interactive', 'Mode: autonomous'));
  fs.rmSync(path.join(d, '.qsdlc/factory/policy.md'));
  expectError(lint(d), 'V8', 'no policy');
});

// V9
test('V9: unsolicited markdown inside .qsdlc and new md outside the allowlist fail', () => {
  let d = clone(good().root);
  write(d, '.qsdlc/factory/notes.md', '# notes\n');
  expectError(lint(d), 'V9', 'stray md in .qsdlc');
  d = clone(good().root);
  write(d, 'ANALYSIS.md', '# my analysis\n');
  expectError(lint(d), 'V9', 'new md outside allowlist');
  d = clone(good().root);
  write(d, 'docs/guide.md', '# guide\n');
  assert(!ids(lint(d), 'error').includes('V9'), 'docs/** allowlisted by policy');
  d = clone(good().root);
  write(d, 'graphify-out/GRAPH_REPORT.md', '# report\n');
  write(d, '.archify/demo/candidate.archify.md', '# explainer\n');
  assert(!ids(lint(d), 'error').includes('V9'), 'graphify-out/** and .archify/** are allowed by default');
});

// V10
test('V10: dash and banned word warn; strict turns them into failures', () => {
  const d = clone(good().root);
  write(d, '.qsdlc/demo-feature/Intent.md', '# Intent\n\nThis is a robust plan — really.\n');
  const r = lint(d);
  assert(ids(r, 'warn').includes('V10'), 'warns');
  assert(r.code === 0, 'warnings alone pass');
  const s = lint(d, '--strict');
  assert(s.code === 1, 'strict fails on warnings');
});

test('V10: code fences and inline code are exempt', () => {
  const d = clone(good().root);
  write(d, '.qsdlc/demo-feature/Intent.md', '# Intent\n\nUse `robust` here.\n\n```\nrobust — dash\n```\n');
  eq(ids(lint(d), 'warn').filter((i) => i === 'V10').length, 0, 'no V10');
});

// V11
test('V11: suppression needs a valid qsdlc-exception; markers fail; shortcut without trigger warns', () => {
  let d = clone(good().root);
  write(d, 'src/a.ts', 'export const a = 1; // @ts-ignore\n');
  expectError(lint(d), 'V11', 'bare suppression');
  d = clone(good().root);
  write(d, 'src/a.ts', 'export const a = 1; // @ts-ignore qsdlc-exception(legacy typing; expires: 2999-01-01; approver: colin)\n');
  assert(!ids(lint(d), 'error').includes('V11'), 'valid exception');
  d = clone(good().root);
  write(d, 'src/a.ts', 'export const a = 1; // @ts-ignore qsdlc-exception(legacy typing; expires: 2000-01-01; approver: colin)\n');
  expectError(lint(d), 'V11', 'expired exception');
  d = clone(good().root);
  write(d, 'src/a.ts', '// IMPORTANT: do not remove this\nexport const a = 1;\n');
  expectError(lint(d), 'V11', 'marker comment');
  d = clone(good().root);
  write(d, 'src/a.ts', 'export const a = 1; // qsdlc-shortcut(quick hack)\n');
  assert(ids(lint(d), 'warn').includes('V11'), 'no-trigger warns');
});

test('V11: only added lines in a tracked file are judged', () => {
  const d = clone(good().root);
  write(d, 'src/old.ts', 'export const a = 1; // @ts-ignore\n');
  sh(d, 'git', ['add', '-A']);
  sh(d, 'git', ['commit', '-q', '-m', 'legacy']);
  assert(!ids(lint(d), 'error').includes('V11'), 'committed legacy line is not re-judged');
  write(d, 'src/old.ts', 'export const a = 1; // @ts-ignore\nexport const b = 2;\n');
  assert(!ids(lint(d), 'error').includes('V11'), 'unchanged suppression line is not re-judged');
});

// V12
test('V12: formal check goes stale when covered code changes after the sync commit', () => {
  const d = clone(good().root);
  write(d, 'src/calc/rent.js', 'export const r = 1;\n');
  sh(d, 'git', ['add', '-A']);
  sh(d, 'git', ['commit', '-q', '-m', 'calc']);
  const sync = sh(d, 'git', ['rev-parse', '--short', 'HEAD']);
  write(d, '.qsdlc/factory/verify/formal/rent.md', `---\ncovers:\n  - "src/calc/**"\nsync_commit: ${sync}\n---\n\n# Rent model\n`);
  sh(d, 'git', ['add', '-A']);
  sh(d, 'git', ['commit', '-q', '-m', 'formal']);
  assert(!ids(lint(d), 'error').includes('V12'), 'fresh sync passes');
  write(d, 'src/calc/rent.js', 'export const r = 2;\n');
  sh(d, 'git', ['add', '-A']);
  sh(d, 'git', ['commit', '-q', '-m', 'change calc']);
  expectError(lint(d), 'V12', 'stale sync');
});

// log CLI
test('log: start/row/end build a lint-clean TSV; row before start is refused', () => {
  const d = tmp('log');
  let r = log(d, 'row', '--run-id', 'r-001', '--loop', 'x', '--phase', 'build', '--decision', 'd', '--why', 'w');
  assert(r.code === 2, 'row before start refused');
  r = log(d, 'start', '--run-id', 'r-001', '--loop', 'x');
  assert(r.code === 0, `start: ${r.stderr}`);
  r = log(d, 'start', '--run-id', 'r-001', '--loop', 'x');
  assert(r.code === 2, 'second start refused');
  r = log(d, 'row', '--run-id', 'r-001', '--loop', 'x', '--phase', 'build', '--decision', '=EVIL()', '--why', 'tab\there\nnewline');
  assert(r.code === 0, `row: ${r.stderr}`);
  const text = read(d, '.qsdlc/factory/runs/r-001.tsv');
  assert(text.split('\n').filter(Boolean).every((l) => l.split('\t').length === 9), 'nine cells per line');
  assert(text.includes("\t'=EVIL()\t"), 'formula prefixed');
  r = log(d, 'end', '--run-id', 'r-001', '--loop', 'x', '--outcome', 'nonsense');
  assert(r.code === 2, 'bad outcome refused');
  r = log(d, 'end', '--run-id', 'r-001', '--loop', 'x', '--outcome', 'blocked');
  assert(r.code === 0, `end: ${r.stderr}`);
  write(d, '.qsdlc/x/state.md', STATE.replace('demo-feature', 'x'));
  assert(!ids(lint(d), 'error').includes('V6'), 'log output passes V6');
});

test('log: correction needs proof when enforced; reopened enforced class becomes repeat; metrics report it', () => {
  const d = tmp('corr');
  let r = log(d, 'correction', '--class', 'bad-thing', '--source', 'review', '--evidence', 'pr#1', '--area', 'a', '--level', 'doc');
  assert(r.code === 0 && /C-0001/.test(r.stdout), `first row: ${r.stdout}${r.stderr}`);
  r = log(d, 'correction', '--class', 'bad-thing', '--source', 'review', '--evidence', 'pr#2', '--area', 'a', '--level', 'lint', '--status', 'enforced', '--enforcer', 'lint:rule');
  assert(r.code === 2, 'enforced without proof refused');
  r = log(d, 'correction', '--class', 'bad-thing', '--source', 'ci', '--evidence', 'ci#2', '--area', 'a', '--level', 'lint', '--status', 'enforced', '--enforcer', 'lint:rule', '--proof', 'abcdef1');
  assert(r.code === 0 && /C-0002/.test(r.stdout), `enforced: ${r.stdout}${r.stderr}`);
  r = log(d, 'correction', '--class', 'bad-thing', '--source', 'review', '--evidence', 'pr#9', '--area', 'a', '--level', 'doc');
  assert(/repeat/.test(r.stdout), `becomes repeat: ${r.stdout}`);
  r = log(d, 'correction', '--class', 'Bad Class', '--source', 'review', '--evidence', 'x', '--area', 'a', '--level', 'doc');
  assert(r.code === 2, 'non-kebab class refused');
  r = log(d, 'metrics', '--json');
  const m = JSON.parse(r.stdout);
  assert(m.repeat_rate > 0 && 'doc_level_share' in m && Array.isArray(m.uncovered_classes), `metrics shape: ${r.stdout}`);
  eq(log(d, 'rules', '--check').code, 1, 'rules out of sync before write');
  eq(log(d, 'rules', '--write').code, 0, 'rules write');
  eq(log(d, 'rules', '--check').code, 0, 'rules in sync after write');
});

test('log: mailbox is newest first and refuses PII', () => {
  const d = tmp('mail');
  let r = log(d, 'mailbox', '--run-id', 'r-1', '--status', 'done', '--summary', 'first', '--ts', '2026-11-18T10:00:00Z');
  assert(r.code === 0, r.stderr);
  r = log(d, 'mailbox', '--run-id', 'r-2', '--status', 'needs-review', '--note', 'second', '--pr', 'https://example.test/pr/2', '--reverse', 'close PR', '--ts', '2026-11-18T11:00:00Z');
  assert(r.code === 0, r.stderr);
  const t = read(d, '.qsdlc/factory/mailbox.md');
  assert(t.indexOf('r-2') < t.indexOf('r-1'), 'newest first');
  r = log(d, 'mailbox', '--run-id', 'r-3', '--status', 'done', '--summary', 'customer ssn 123-45-6789');
  assert(r.code === 2, 'PII refused');
});

test('log: --help and -h print usage and exit 0; no args and unknown subcommands exit 2', () => {
  for (const args of [['--help'], ['-h'], ['help'], ['start', '--help'], ['row', '-h']]) {
    const r = runNode(LOG, args, SKILLS);
    assert(r.code === 0, `${args.join(' ')} should exit 0, got ${r.code}`);
    assert(/usage: node qsdlc-log\.mjs/.test(r.stdout), `${args.join(' ')} should print usage`);
  }
  assert(runNode(LOG, [], SKILLS).code === 2, 'no args exits 2');
  assert(runNode(LOG, ['bogus'], SKILLS).code === 2, 'unknown subcommand exits 2');
  assert(runNode(LOG, ['-x'], SKILLS).code === 2, 'unknown short flag exits 2');
});

test('log: sanitize command neutralizes formulas', () => {
  const r = runNode(LOG, ['sanitize', '=HYPERLINK("x")'], SKILLS);
  assert(r.stdout.trim().startsWith("'="), `got ${r.stdout}`);
});

// sibling script self-tests
test('guard-check.mjs --self-test passes', () => {
  assert(fs.existsSync(GUARD), 'guard-check.mjs missing');
  const r = runNode(GUARD, ['--self-test'], SKILLS);
  assert(r.code === 0, `exit ${r.code}\n${r.stdout.slice(-800)}${r.stderr.slice(-400)}`);
  assert(/\b0 failed\b/.test(r.stdout), `summary line missing:\n${r.stdout.slice(-300)}`);
  const m = r.stdout.match(/(\d+) passed/);
  assert(m && Number(m[1]) >= 25, `expected at least 25 guard cases, got ${m && m[1]}`);
});

test('sweep-state.mjs --self-test passes', () => {
  assert(fs.existsSync(SWEEP), 'sweep-state.mjs missing');
  const r = runNode(SWEEP, ['--self-test'], SKILLS);
  assert(r.code === 0, `exit ${r.code}\n${r.stdout.slice(-800)}${r.stderr.slice(-400)}`);
  assert(/\b0 failed\b/.test(r.stdout), `summary line missing:\n${r.stdout.slice(-300)}`);
});

test('sweep-state: lease conflict exits 3, unapproved source exits 4, approved exits 0', () => {
  const d = tmp('sweep');
  write(d, '.qsdlc/factory/sources.yml', 'schema: 1\nsources:\n  - name: ok\n    approved: true\n  - name: nope\n    approved: false\n');
  const run = (...a) => runNode(SWEEP, [...a, '--root', d, '--sweep', 'ticket-funnel'], d);
  assert(run('lease-acquire', '--owner', 'a').code === 0, 'first lease');
  assert(run('lease-acquire', '--owner', 'b').code === 3, 'second owner blocked');
  assert(run('lease-release', '--owner', 'a').code === 0, 'release');
  assert(run('lease-acquire', '--owner', 'b').code === 0, 'now b');
  assert(run('source-approved', '--source', 'ok').code === 0, 'approved');
  assert(run('source-approved', '--source', 'nope').code === 4, 'unapproved');
  assert(run('source-approved', '--source', 'absent').code === 4, 'unknown source fails closed');
  run('seen-add', '--id', 'T-1');
  assert(run('seen-check', '--id', 'T-1').code === 0, 'seen');
  assert(run('seen-check', '--id', 'T-2').code !== 0, 'not seen');
  const e = tmp('sweep-nofile');
  assert(runNode(SWEEP, ['source-approved', '--source', 'ok', '--root', e, '--sweep', 's'], e).code === 4, 'missing sources.yml fails closed');
});

// repo checks: sizes and broken links
const OWNED_NEW = ['qsdlc-triage', 'qsdlc-factory', 'qsdlc-review', 'qsdlc-correct', 'qsdlc-verify', 'qsdlc-sweep', 'qsdlc-audit', 'qsdlc-ritual', 'qsdlc-guard'];
const OWNED_UPGRADED = ['qsdlc', 'qsdlc-interview', 'qsdlc-design', 'qsdlc-feature-research', 'qsdlc-build', 'qsdlc-qa', 'qsdlc-pr', 'qsdlc-dev-web', 'qsdlc-dev-api', 'qsdlc-dev-cli'];
const SCHEDULED_ONLY = new Set(['qsdlc-sweep', 'qsdlc-audit']);

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

test('skills: every owned SKILL.md has name matching its folder and a description', () => {
  for (const name of [...OWNED_NEW, ...OWNED_UPGRADED]) {
    const f = path.join(SKILLS, name, 'SKILL.md');
    assert(fs.existsSync(f), `${name}/SKILL.md missing`);
    const fm = frontmatter(fs.readFileSync(f, 'utf8'));
    assert(fm, `${name}: no frontmatter`);
    assert(new RegExp(`^name:\\s*${name}\\s*$`, 'm').test(fm), `${name}: name does not match folder`);
    assert(/^description:\s*\S/m.test(fm), `${name}: no description`);
  }
});

test('skills: sizes (new factory skills <= 4096 B, upgraded <= 8192 B)', () => {
  const over = [];
  for (const name of OWNED_NEW) {
    const n = fs.statSync(path.join(SKILLS, name, 'SKILL.md')).size;
    if (n > 4096) over.push(`${name}=${n}`);
  }
  for (const name of OWNED_UPGRADED) {
    const n = fs.statSync(path.join(SKILLS, name, 'SKILL.md')).size;
    if (n > 8192) over.push(`${name}=${n}`);
  }
  assert(!over.length, `over budget: ${over.join(', ')}`);
});

test('skills: disable-model-invocation only on scheduled-only skills', () => {
  for (const name of [...OWNED_NEW, ...OWNED_UPGRADED]) {
    const fm = frontmatter(fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8')) ?? '';
    const flagged = /^disable-model-invocation:\s*true\s*$/m.test(fm);
    assert(flagged === SCHEDULED_ONLY.has(name), `${name}: disable-model-invocation=${flagged}, expected ${SCHEDULED_ONLY.has(name)}`);
  }
});

test('skills: no em or en dashes in owned skill prose', () => {
  const bad = [];
  for (const name of [...OWNED_NEW, ...OWNED_UPGRADED]) {
    if (/[–—]/.test(fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8'))) bad.push(name);
  }
  assert(!bad.length, `dashes in: ${bad.join(', ')}`);
});

function mdFiles() {
  const out = [];
  for (const name of [...OWNED_NEW, ...OWNED_UPGRADED]) out.push(path.join(SKILLS, name, 'SKILL.md'));
  const walkDir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'test' && e.name !== 'templates') walkDir(p); } else if (p.endsWith('.md')) out.push(p);
    }
  };
  walkDir(path.join(SKILLS, '_shared'));
  return out;
}

test('skills: no broken relative markdown links', () => {
  const broken = [];
  for (const f of mdFiles()) {
    let inFence = false;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      if (/^```/.test(line)) inFence = !inFence;
      if (inFence) continue;
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1].split('#')[0];
        if (!target || /^[a-z]+:/i.test(target) || target.startsWith('<')) continue;
        if (!fs.existsSync(path.resolve(path.dirname(f), target))) broken.push(`${path.relative(SKILLS, f)} -> ${m[1]}`);
      }
    }
  }
  assert(!broken.length, `broken links:\n${broken.join('\n')}`);
});

test('skills: every referenced _shared/scripts and skill script path exists', () => {
  const missing = new Set();
  for (const f of mdFiles()) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/_shared\/scripts\/([A-Za-z0-9_.-]+\.mjs)/g)) {
      if (!fs.existsSync(path.join(SKILLS, '_shared', 'scripts', m[1]))) missing.add(`${path.relative(SKILLS, f)} -> _shared/scripts/${m[1]}`);
    }
    for (const m of text.matchAll(/(qsdlc-[a-z-]+)\/scripts\/([A-Za-z0-9_.-]+\.mjs)/g)) {
      if (!fs.existsSync(path.join(SKILLS, m[1], 'scripts', m[2]))) missing.add(`${path.relative(SKILLS, f)} -> ${m[1]}/scripts/${m[2]}`);
    }
  }
  assert(!missing.size, `missing scripts:\n${[...missing].join('\n')}`);
});

test('skills: every template named in conventions exists', () => {
  const conv = fs.readFileSync(path.join(SKILLS, '_shared', 'conventions.md'), 'utf8');
  const missing = [];
  for (const m of conv.matchAll(/templates\/([A-Za-z0-9_.-]+)/g)) {
    if (!fs.existsSync(path.join(SKILLS, '_shared', 'templates', m[1]))) missing.push(m[1]);
  }
  assert(!missing.length, `missing templates: ${missing.join(', ')}`);
});

test('templates: state template passes lint as a feature', () => {
  const d = tmp('tmpl');
  const state = fs.readFileSync(path.join(SKILLS, '_shared', 'templates', 'state.template.md'), 'utf8')
    .replace('<feature-slug>', 'tmpl-demo').replace(/<ISO date>/g, '2026-11-18');
  write(d, '.qsdlc/tmpl-demo/state.md', state);
  const r = lint(d);
  assert(r.code === 0, `state template should lint clean: ${JSON.stringify(r.json?.violations)}`);
});

async function main() {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of results) {
    try {
      await fn();
      passed++;
      console.log(`PASS ${name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${name}\n     ${String(e.message).split('\n').join('\n     ')}`);
    }
  }
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed (${results.length} tests; temp dirs cleaned)`);
  process.exitCode = failed ? 1 : 0;
}

main();
