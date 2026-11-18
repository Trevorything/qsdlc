#!/usr/bin/env node
// Zero-dependency tests for skills/qsdlc-herdr. Never mutates live Herdr panes:
// every pane-touching case uses --dry-run, --from-json fixtures, or guard refusals.
// Run: node skills/qsdlc-herdr/test/run_tests.mjs

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(HERE, '..');
const HELPER = path.join(SKILL_DIR, 'scripts', 'relay-helper.mjs');
const mod = await import(pathToFileURL(HELPER).href);
const TMP = mkdtempSync(path.join(tmpdir(), 'qsdlc-herdr-test-'));

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; failures.push(name); console.log(`  FAIL ${name}\n       ${e.message.split('\n').join('\n       ')}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'not equal'}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); }

function envInside() { return { ...process.env, HERDR_ENV: '1' }; }
function envOutside() { const e = { ...process.env }; delete e.HERDR_ENV; return e; }
function run(args, env = envInside()) {
  const r = spawnSync(process.execPath, [HELPER, ...args], { encoding: 'utf8', env, windowsHide: true });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
function write(name, content) { const p = path.join(TMP, name); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, content); return p; }
const json = (o) => JSON.stringify(o, null, 2);

console.log('relay-helper: CLI surface');
test('--help exits 0 and lists every subcommand', () => {
  const r = run(['--help']);
  eq(r.code, 0);
  for (const s of ['check-env', 'prompt-file', 'roster', 'dispatch-guard', 'ownership-check', 'takeaway', '--dry-run', '--help']) {
    assert(r.out.includes(s), `help missing ${s}`);
  }
});
test('no subcommand exits 2; unknown subcommand exits 2', () => {
  eq(run([]).code, 2);
  const r = run(['frobnicate']);
  eq(r.code, 2);
  assert(r.err.includes('unknown subcommand'), r.err);
});

console.log('relay-helper: check-env and scope guard');
test('check-env inside Herdr exits 0', () => {
  const r = run(['check-env', '--json'], envInside());
  eq(r.code, 0);
  const o = JSON.parse(r.out);
  eq(o.mode, 'inside-herdr');
  eq(o.ok, true);
});
test('check-env outside Herdr exits 3 (stop, do not snoop)', () => {
  const r = run(['check-env', '--json'], envOutside());
  eq(r.code, 3);
  const o = JSON.parse(r.out);
  eq(o.ok, false);
  assert(/Stop/.test(o.guidance), o.guidance);
});
test('check-env outside + dedicated scope + user-authorized reports dedicated-scope', () => {
  const r = run(['check-env', '--json', '--dedicated-workspace', 'w9', '--user-authorized'], envOutside());
  eq(r.code, 0);
  eq(JSON.parse(r.out).mode, 'dedicated-scope');
});
test('check-env outside + dedicated scope WITHOUT --user-authorized is still refused', () => {
  eq(run(['check-env', '--json', '--dedicated-workspace', 'w9'], envOutside()).code, 3);
});
test('prompt-file outside Herdr with no scope is refused before touching anything (exit 3)', () => {
  const f = write('brief-out.md', '## Takeaway\nx\n');
  const r = run(['prompt-file', 'lane-a', f, '--dry-run'], envOutside());
  eq(r.code, 3);
  assert(/Not running inside Herdr/.test(r.err), r.err);
});
test('dedicated scope rejects agent names (only pane ids inside the workspace)', () => {
  const f = write('brief-scope.md', '## Takeaway\nx\n');
  const r = run(['prompt-file', 'lane-a', f, '--dry-run', '--dedicated-workspace', 'w9', '--user-authorized'], envOutside());
  eq(r.code, 3);
});
test('dedicated scope rejects a pane in another workspace', () => {
  const f = write('brief-scope2.md', '## Takeaway\nx\n');
  const r = run(['prompt-file', 'w2:p1', f, '--dry-run', '--dedicated-workspace', 'w9', '--user-authorized'], envOutside());
  eq(r.code, 3);
});
test('dedicated scope accepts a pane inside it (dry run)', () => {
  const f = write('brief-scope3.md', '## Takeaway\nx\n');
  const r = run(['prompt-file', 'w9:p3', f, '--dry-run', '--json', '--dedicated-workspace', 'w9', '--user-authorized'], envOutside());
  eq(r.code, 0);
  eq(JSON.parse(r.out).target, 'w9:p3');
});
test('roster outside scope: foreign workspace refused', () => {
  const r = run(['roster', 'w2', '--dry-run', '--dedicated-workspace', 'w9', '--user-authorized'], envOutside());
  eq(r.code, 3);
});

console.log('relay-helper: dry-run prompt dispatch (single-line, file-backed)');
test('prompt-file --dry-run builds one single-line prompt and runs nothing', () => {
  const brief = [
    '# Brief: demo', '## Takeaway', 'He said "quote" and \'single\', $HOME, `backtick`, %PATH%, a|b, c&d, ;;',
    'line 3 with ünïcödé', '',
  ].join('\n');
  const f = write('brief with spaces.md', brief);
  const r = run(['prompt-file', 'impl-p2', f, '--dry-run', '--json', '--wait']);
  eq(r.code, 0, r.err);
  const o = JSON.parse(r.out);
  eq(o.dry_run, true);
  assert(!/[\r\n]/.test(o.prompt), 'prompt must be single line');
  assert(o.prompt.startsWith('Read "'), `path with spaces must be quoted: ${o.prompt}`);
  assert(o.prompt.endsWith('in full and execute every instruction inside it.'), o.prompt);
  eq(o.argv.slice(1, 4), ['agent', 'prompt', 'impl-p2']);
  assert(o.argv.includes('--wait') && o.argv.includes('--timeout') && o.argv.includes('900000'), 'default timeout with --wait');
  assert(!o.prompt.includes('$HOME') && !o.prompt.includes('%PATH%'), 'brief content must never be in the prompt');
  eq(o.brief_bytes, Buffer.byteLength(brief));
  assert(/^[0-9a-f]{16}$/.test(o.brief_sha256), 'sha256 prefix');
  eq(o.herdr, null);
});
test('buildPromptLine rejects newlines and control characters in the path', () => {
  let threw = false;
  try { mod.buildPromptLine('C:\\x\\bad\nname.md'); } catch { threw = true; }
  assert(threw, 'should throw');
  eq(mod.buildPromptLine('C:\\x\\ok.md'), 'Read C:\\x\\ok.md in full and execute every instruction inside it.');
});
test('prompt-file rejects missing file, empty file, and a bad target name', () => {
  eq(run(['prompt-file', 'impl-p2', path.join(TMP, 'nope.md'), '--dry-run']).code, 2);
  eq(run(['prompt-file', 'impl-p2', write('empty.md', ''), '--dry-run']).code, 2);
  eq(run(['prompt-file', 'Bad Name', write('b.md', 'x'), '--dry-run']).code, 2);
  eq(run(['prompt-file', 'impl-p2']).code, 2);
});
test('prompt-file warns when a brief never mentions Takeaway', () => {
  const r = run(['prompt-file', 'impl-p2', write('no-take.md', 'just do it'), '--dry-run']);
  eq(r.code, 0);
  assert(/Takeaway/.test(r.err), r.err);
});

console.log('relay-helper: dispatch-guard (disjoint ownership)');
const manifest = (lanes, extra = {}) => write(`m-${Math.random().toString(36).slice(2)}.json`, json({ lanes, ...extra }));
test('disjoint manifest passes (exit 0)', () => {
  const m = manifest([
    { name: 'herdr-builder', owns: ['skills/qsdlc-herdr/**'] },
    { name: 'html-architect', owns: ['skills/html-motion/**'] },
    { name: 'present-builder', owns: ['skills/qsdlc-present/'] },
  ], { shared_readonly: ['skills/_shared/**'] });
  const r = run(['dispatch-guard', m, '--json']);
  eq(r.code, 0, r.out);
  eq(JSON.parse(r.out).ok, true);
});
test('overlapping globs are detected (exit 1)', () => {
  const m = manifest([
    { name: 'lane-a', owns: ['skills/**'] },
    { name: 'lane-b', owns: ['skills/qsdlc-herdr/**'] },
  ]);
  const r = run(['dispatch-guard', m, '--json']);
  eq(r.code, 1);
  const o = JSON.parse(r.out);
  eq(o.conflicts.length, 1);
  eq([o.conflicts[0].a, o.conflicts[0].b], ['lane-a', 'lane-b']);
});
test('a literal file inside another lane\'s glob is a conflict; text mode names both lanes', () => {
  const m = manifest([
    { name: 'lane-a', owns: ['src/api/**'] },
    { name: 'lane-b', owns: ['src/api/routes.ts'] },
  ]);
  const r = run(['dispatch-guard', m]);
  eq(r.code, 1);
  assert(/CONFLICT: lane-a .* lane-b/.test(r.out), r.out);
  assert(/NOT SAFE/.test(r.out), r.out);
});
test('lane owning a shared_readonly path is a conflict', () => {
  const m = manifest([{ name: 'lane-a', owns: ['skills/_shared/templates/**'] }], { shared_readonly: ['skills/_shared/**'] });
  const r = run(['dispatch-guard', m, '--json']);
  eq(r.code, 1);
  eq(JSON.parse(r.out).conflicts[0].b, 'shared_readonly');
});
test('duplicate lane names, bad names, missing owns, absolute paths and whole-repo claims are errors', () => {
  const m = manifest([
    { name: 'dup', owns: ['a/**'] }, { name: 'dup', owns: ['b/**'] },
    { name: 'Bad Name', owns: ['c/**'] }, { name: 'no-owns' },
    { name: 'abs', owns: ['C:/repo/x/**'] }, { name: 'greedy', owns: ['**'] }, { name: 'escape', owns: ['../x/**'] },
  ]);
  const o = JSON.parse(run(['dispatch-guard', m, '--json']).out);
  eq(o.ok, false);
  const joined = o.errors.join('\n');
  for (const needle of ['duplicate lane name "dup"', 'name must match', 'non-empty owns', 'absolute path', 'whole repo', 'escapes the repo']) {
    assert(joined.includes(needle), `missing error: ${needle}\n${joined}`);
  }
});
test('invalid or missing manifest is a usage error (exit 2)', () => {
  eq(run(['dispatch-guard', path.join(TMP, 'absent.json')]).code, 2);
  eq(run(['dispatch-guard', write('bad.json', '{nope')]).code, 2);
});
test('patternsConflict truth table (conservative, never misses a real overlap)', () => {
  const T = mod.patternsConflict;
  const cases = [
    ['skills/a/**', 'skills/b/**', false],
    ['skills/a/**', 'skills/a/x.md', true],
    ['skills/a/**', 'skills/**', true],
    ['src/**/*.ts', 'src/**/*.md', false],
    ['src/**/*.ts', 'src/app/**', true],
    ['src/*.ts', 'src/sub/**', false],
    ['docs/', 'docs/readme.md', true],
    ['a/b.md', 'a/c.md', false],
    ['a/b', 'a/b/c.md', true],
    ['skills\\a\\**', 'skills/a/x', true],
  ];
  for (const [a, b, want] of cases) eq(T(a, b), want, `${a} vs ${b}`);
});

console.log('relay-helper: ownership-check');
test('lane edits are classified owned / other-lane / violation; --strict flags other lanes', () => {
  const m = manifest([
    { name: 'lane-a', owns: ['skills/qsdlc-herdr/**'] },
    { name: 'lane-b', owns: ['skills/html-motion/**'] },
  ], { shared_readonly: ['skills/_shared/**'] });
  const files = 'skills/qsdlc-herdr/SKILL.md,skills/html-motion/SKILL.md,skills/_shared/conventions.md,README.md';
  const r = run(['ownership-check', m, 'lane-a', '--files', files, '--json']);
  eq(r.code, 1);
  const o = JSON.parse(r.out);
  eq(o.rows.map((x) => x.verdict), ['owned', 'other-lane', 'violation', 'violation']);
  const s = JSON.parse(run(['ownership-check', m, 'lane-a', '--files', files, '--json', '--strict']).out);
  eq(s.violations.length, 3);
  const ok = run(['ownership-check', m, 'lane-a', '--files', 'skills/qsdlc-herdr/test/run_tests.mjs']);
  eq(ok.code, 0);
  eq(run(['ownership-check', m, 'ghost', '--files', 'x']).code, 2);
});

console.log('relay-helper: roster (offline fixture, workspace-scoped)');
test('roster summarizes only the requested workspace and flags blocked/unknown', () => {
  const fixture = write('roster.json', json({
    panes: { result: { panes: [
      { pane_id: 'w3:p1', workspace_id: 'w3', tab_id: 'w3:t1', label: 'writer', agent: 'claude', agent_status: 'working', cwd: 'C:\\secret' },
      { pane_id: 'w3:p2', workspace_id: 'w3', tab_id: 'w3:t1', label: 'critic', agent: 'claude', agent_status: 'blocked' },
      { pane_id: 'w3:p3', workspace_id: 'w3', tab_id: 'w3:t2', label: 'done-lane', agent: 'codex', agent_status: 'done' },
      { pane_id: 'w3:p4', workspace_id: 'w3', tab_id: 'w3:t2', label: 'mystery', agent: 'claude', agent_status: 'unknown' },
      { pane_id: 'w2:p9', workspace_id: 'w2', tab_id: 'w2:t1', label: 'someone-elses', agent: 'claude', agent_status: 'idle' },
    ] } },
    tabs: { result: { tabs: [
      { tab_id: 'w3:t1', workspace_id: 'w3', label: 'build', agent_status: 'blocked' },
      { tab_id: 'w3:t2', workspace_id: 'w3', label: 'qa', agent_status: 'done' },
      { tab_id: 'w2:t1', workspace_id: 'w2', label: 'foreign', agent_status: 'idle' },
    ] } },
  }));
  const r = run(['roster', 'w3', '--from-json', fixture, '--json']);
  eq(r.code, 0, r.err);
  const o = JSON.parse(r.out);
  eq(o.tabs.map((t) => t.tab_id), ['w3:t1', 'w3:t2']);
  eq(o.counts, { working: 1, blocked: 1, done: 1, unknown: 1 });
  eq(o.attention, ['w3:p2', 'w3:p4']);
  eq(o.verify_before_pass, ['w3:p3']);
  assert(!r.out.includes('w2:'), 'foreign workspace must not leak');
  assert(!r.out.includes('secret'), 'cwd must not be echoed');
  const text = run(['roster', 'w3', '--from-json', fixture]).out;
  assert(/ATTENTION \(blocked\/unknown\): w3:p2, w3:p4/.test(text), text);
});
test('roster --dry-run prints only workspace-scoped list calls (never agent list)', () => {
  const r = run(['roster', 'w3', '--dry-run', '--json']);
  eq(r.code, 0, r.err);
  const o = JSON.parse(r.out);
  eq(o.argv.map((a) => a.slice(1).join(' ')), ['pane list --workspace w3', 'tab list --workspace w3']);
});

console.log('relay-helper: takeaway extraction');
test('takeaway prints only the Takeaway section from a complete GREAT report', () => {
  const rep = write('report.md', [
    '## Grounding', 'read spec', '## Role', 'builder', '## Execution', 'did things', '## Analysis', 'checked', '## Takeaway',
    'PASS', 'Evidence: test output in evidence/01.txt, exit code 0.', '',
  ].join('\n'));
  const r = run(['takeaway', rep]);
  eq(r.code, 0, r.err);
  assert(r.out.startsWith('PASS'), r.out);
  assert(!r.out.includes('read spec') && !r.out.includes('did things'), 'must not leak other sections');
  const j = JSON.parse(run(['takeaway', rep, '--json']).out);
  eq(j.complete, true); eq(j.status, 'PASS'); eq(j.evidence_mentioned, true);
});
test('bold-label reports parse, and an incomplete report fails (a gap is not a pass)', () => {
  const rep = write('report2.md', '**Execution**\nran\n**Takeaway**: ISSUES - 2 failing tests, see test.log\n');
  const r = run(['takeaway', rep, '--json']);
  eq(r.code, 1);
  const j = JSON.parse(r.out);
  eq(j.status, 'ISSUES');
  eq(j.missing, ['Grounding', 'Role', 'Analysis']);
});
test('missing report or missing Takeaway is a failure, not a pass', () => {
  eq(run(['takeaway', path.join(TMP, 'ghost.md')]).code, 1);
  eq(run(['takeaway', write('nt.md', '## Execution\nran\n')]).code, 1);
});

console.log('SKILL.md and references integrity');
const skillMd = readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const refMd = readFileSync(path.join(SKILL_DIR, 'references', 'relay-topologies.md'), 'utf8');
test('SKILL.md has valid frontmatter (name + description) and the expected name', () => {
  const m = skillMd.match(/^---\r?\nname: (.+)\r?\ndescription: (.+)\r?\n---/);
  assert(m, 'frontmatter');
  eq(m[1].trim(), 'qsdlc-herdr');
  assert(m[2].length > 80, 'description should be substantive');
  assert(/HERDR_ENV=1/.test(m[2]), 'description must state the HERDR_ENV=1 requirement');
});
function relLinks(md) {
  return [...md.matchAll(/\]\(([^)\s]+)\)/g)].map((x) => x[1]).filter((l) => !/^(https?:|mailto:|#)/.test(l)).map((l) => l.split('#')[0]);
}
test('every relative link in SKILL.md resolves to a file', () => {
  const links = relLinks(skillMd);
  for (const must of ['../_shared/conventions.md', 'references/relay-topologies.md', 'scripts/relay-helper.mjs']) {
    assert(links.includes(must), `SKILL.md must link ${must}`);
  }
  for (const l of links) assert(existsSync(path.resolve(SKILL_DIR, l)), `broken link in SKILL.md: ${l}`);
});
test('every relative link in relay-topologies.md resolves to a file', () => {
  for (const l of relLinks(refMd)) assert(existsSync(path.resolve(SKILL_DIR, 'references', l)), `broken link in references: ${l}`);
});
test('shared conventions file referenced by SKILL.md exists', () => {
  assert(existsSync(path.resolve(SKILL_DIR, '..', '_shared', 'conventions.md')), 'skills/_shared/conventions.md');
});
test('all nine relay patterns appear in SKILL.md and in the topology reference', () => {
  const names = ['Multipart Phases', 'Dependency', 'Comparative', 'Pagination', 'Audit', 'Realignment', 'Scatter', 'Consensus / Polling', 'Batch Testing'];
  for (const n of names) {
    assert(skillMd.includes(n), `SKILL.md missing ${n}`);
    assert(refMd.includes(n.replace(' / ', ' / ')), `references missing ${n}`);
  }
});
test('SKILL.md preserves the core official-herdr safety rules', () => {
  for (const needle of ['HERDR_ENV', 'bare `herdr`', '--no-focus', 'did not create', 'agent_not_ready', '--dangerously-skip-permissions', 'file-backed', 'Never blindly approve', 'never merge', 'a gap is not a pass', 'writer never judges its own code']) {
    assert(skillMd.toLowerCase().includes(needle.toLowerCase()), `SKILL.md missing rule text: ${needle}`);
  }
});
test('every relay-helper subcommand mentioned in SKILL.md is real', () => {
  const real = new Set(['check-env', 'prompt-file', 'roster', 'dispatch-guard', 'ownership-check', 'takeaway']);
  const used = [...skillMd.matchAll(/relay-helper\.mjs\s+([a-z-]+)/g)].map((m) => m[1]);
  assert(used.length >= 5, 'expected several helper examples');
  for (const u of used) assert(real.has(u), `SKILL.md references unknown subcommand ${u}`);
  for (const s of real) assert(used.includes(s), `SKILL.md quick reference missing ${s}`);
});
test('SKILL.md stays crisp (under 200 lines); deep recipes live in references', () => {
  const lines = skillMd.split(/\r?\n/).length;
  assert(lines <= 200, `SKILL.md is ${lines} lines`);
  assert(refMd.split(/\r?\n/).length > 150, 'reference should hold the deep content');
});
test('helper has no third-party imports (zero-dep)', () => {
  const src = readFileSync(HELPER, 'utf8');
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  for (const i of imports) assert(i.startsWith('node:'), `non-builtin import: ${i}`);
});

rmSync(TMP, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log(`Failed: ${failures.join('; ')}`); process.exit(1); }
