#!/usr/bin/env node
// Zero-dependency tests for skills/qsdlc-archify.
// Run: node skills/qsdlc-archify/test/run_tests.mjs

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(HERE, '..');
const BRIDGE = path.join(SKILL_DIR, 'scripts', 'archify-bridge.mjs');
const mod = await import(pathToFileURL(BRIDGE).href);
const TMP = mkdtempSync(path.join(tmpdir(), 'qsdlc-archify-test-'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg || 'mismatch'}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
  }
}
function run(args, env = process.env) {
  const r = spawnSync(process.execPath, [BRIDGE, ...args], { encoding: 'utf8', env, windowsHide: true });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

console.log('qsdlc-archify: bridge tests');

test('--help and --self-test exit 0', () => {
  eq(run(['--help']).code, 0);
  const st = run(['--self-test', '--json']);
  eq(st.code, 0);
  const j = JSON.parse(st.out);
  eq(j.ok, true);
  eq(j.modes, 11);
});

test('unknown command or bad usage exits 2', () => {
  eq(run([]).code, 2);
  eq(run(['bogus']).code, 2);
  eq(run(['paths', '--slug', '../escape', '--type', 'sequence']).code, 2);
  eq(run(['paths', '--slug', 'ok-slug', '--type', 'unknown-mode']).code, 2);
});

test('paths builds V1-clean .craft/archify and --stage canonical artifact locations', () => {
  const proj = path.join(TMP, 'proj');
  mkdirSync(proj, { recursive: true });
  const r = run(['paths', '--root', proj, '--slug', 'auth-v2', '--type', 'erd', '--name', 'schema-erd', '--json']);
  eq(r.code, 0, r.err);
  const j = JSON.parse(r.out);
  eq(j.relativeOutput, '.qsdlc/auth-v2/artifacts/.craft/archify/erd-schema-erd/schema-erd.html');
  assert(j.candidate.endsWith(path.join('.craft', 'archify', 'erd-schema-erd', 'candidate.json')), j.candidate);

  const st = JSON.parse(run(['paths', '--root', proj, '--slug', 'auth-v2', '--type', 'architecture', '--stage', 'design', '--json']).out);
  eq(st.relativeOutput, '.qsdlc/auth-v2/artifacts/design-pitch-deck.html');

  const ex = JSON.parse(run(['paths', '--root', proj, '--slug', 'auth-v2', '--type', 'explainer', '--name', 'summary', '--json']).out);
  assert(ex.candidate.endsWith('candidate.archify.md'), ex.candidate);
});

test('detect resolves ARCHIFY_HOME cleanly and fails closed when absent', () => {
  const proj = path.join(TMP, 'proj2');
  const fakeArchify = path.join(TMP, 'mock-archify');
  mkdirSync(path.join(fakeArchify, 'bin'), { recursive: true });
  writeFileSync(path.join(fakeArchify, 'bin', 'archify.mjs'), '// stub');
  writeFileSync(path.join(fakeArchify, 'SKILL.md'), '---\nname: archify\nmetadata:\n  version: "3.2"\n---\n');

  const okEnv = { ...process.env, ARCHIFY_HOME: fakeArchify };
  const found = run(['detect', '--root', proj, '--json'], okEnv);
  eq(found.code, 0, found.err);
  const j = JSON.parse(found.out);
  eq(j.found, true);
  eq(j.version, '3.2');

  const emptyEnv = { ...process.env, ARCHIFY_HOME: '', HOME: TMP, USERPROFILE: TMP };
  const miss = run(['detect', '--root', proj, '--json'], emptyEnv);
  eq(miss.code, 1);
  eq(JSON.parse(miss.out).found, false);
});

test('check-candidate catches missing file, escaping meta.output, and passes valid candidate', () => {
  const proj = path.join(TMP, 'proj3');
  mkdirSync(proj, { recursive: true });
  eq(run(['check-candidate', 'missing.json', '--root', proj]).code, 1);

  const badCand = path.join(proj, 'bad.json');
  writeFileSync(badCand, JSON.stringify({ meta: { title: 'Escape', output: '../outside.html' }, nodes: [{ id: 'a' }] }));
  const badRes = run(['check-candidate', badCand, '--root', proj, '--json']);
  eq(badRes.code, 1);
  assert(JSON.parse(badRes.out).errors[0].includes('escapes repo root'));

  const nonCanonCand = path.join(proj, 'noncanon.json');
  writeFileSync(nonCanonCand, JSON.stringify({
    meta: { title: 'Stray HTML', output: '.qsdlc/auth-v2/artifacts/stray-diagram.html' },
    participants: [{ id: 'client' }, { id: 'api' }],
  }));
  const ncRes = run(['check-candidate', nonCanonCand, '--root', proj, '--json']);
  eq(ncRes.code, 1);
  assert(JSON.parse(ncRes.out).errors[0].includes('would fail V1'));

  const goodCand = path.join(proj, 'good.json');
  writeFileSync(goodCand, JSON.stringify({
    meta: { title: 'Auth Sequence', output: '.qsdlc/auth-v2/artifacts/.craft/archify/sequence-token-flow/token-flow.html' },
    participants: [{ id: 'client' }, { id: 'api' }],
  }));
  const goodRes = run(['check-candidate', goodCand, '--root', proj, '--json']);
  eq(goodRes.code, 0, goodRes.err);
  eq(JSON.parse(goodRes.out).errors, []);
  eq(JSON.parse(goodRes.out).warnings, []);
});

test('--dry-run constructs exact argv without shell quoting', () => {
  const proj = path.join(TMP, 'proj4');
  mkdirSync(proj, { recursive: true });
  const r = run(['finalize', 'sequence', 'cand.json', '.qsdlc/a/artifacts/flow.html', '--root', proj, '--repo-root', proj, '--quality', 'standard', '--dry-run', '--json']);
  eq(r.code, 0, r.err);
  const j = JSON.parse(r.out);
  eq(j.argv, ['finalize', 'sequence', 'cand.json', '.qsdlc/a/artifacts/flow.html', '--quality', 'standard', '--repo-root', proj, '--json']);
  eq(typeof mod.findInstall, 'function');
});

try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
console.log(`\n${passed}/${passed + failed} tests passed`);
process.exit(failed ? 1 : 0);
