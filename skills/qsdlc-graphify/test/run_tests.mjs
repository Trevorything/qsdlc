#!/usr/bin/env node
// Zero-dependency tests for skills/qsdlc-graphify.
// Run: node skills/qsdlc-graphify/test/run_tests.mjs

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(HERE, '..');
const BRIDGE = path.join(SKILL_DIR, 'scripts', 'graphify-bridge.mjs');
const mod = await import(pathToFileURL(BRIDGE).href);
const TMP = mkdtempSync(path.join(tmpdir(), 'qsdlc-graphify-test-'));

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

console.log('qsdlc-graphify: bridge tests');

test('--help and --self-test exit 0', () => {
  eq(run(['--help']).code, 0);
  const st = run(['--self-test', '--json']);
  eq(st.code, 0);
  eq(JSON.parse(st.out).ok, true);
});

test('missing args / unknown command exits 2', () => {
  eq(run([]).code, 2);
  eq(run(['frobnicate']).code, 2);
  eq(run(['query']).code, 2);
  eq(run(['path', 'A']).code, 2);
});

test('summary reads NetworkX node-link graph.json and ranks hub nodes cleanly', () => {
  const proj = path.join(TMP, 'proj');
  mkdirSync(path.join(proj, 'graphify-out'), { recursive: true });
  writeFileSync(path.join(proj, 'graphify-out', 'graph.json'), JSON.stringify({
    nodes: [
      { id: 'auth', label: 'verifyToken', source_file: 'src/auth.js', community: 0 },
      { id: 'api', label: 'routes', source_file: 'src/api.js', community: 0 },
      { id: 'billing', label: 'charge', source_file: 'src/billing.js', community: 1 },
      { id: 'audit', label: 'logEvent', source_file: 'src/audit.js', community: 1 },
    ],
    links: [
      { source: 'api', target: 'auth', confidence: 'EXTRACTED' },
      { source: 'billing', target: 'auth', confidence: 'EXTRACTED' },
      { source: 'billing', target: 'audit', confidence: 'INFERRED' },
    ],
  }));

  const r = run(['summary', '--root', proj, '--top', '2', '--json']);
  eq(r.code, 0, r.err);
  const j = JSON.parse(r.out);
  eq(j.nodeCount, 4);
  eq(j.edgeCount, 3);
  eq(j.communityCount, 2);
  eq(j.tiers.EXTRACTED, 2);
  eq(j.tiers.INFERRED, 1);
  eq(j.hubs.length, 2);
  eq(j.hubs[0].id, 'auth');
  eq(j.hubs[0].degree, 2);
});

test('summary on missing graph exits 1 without crashing', () => {
  const emptyProj = path.join(TMP, 'empty');
  mkdirSync(emptyProj, { recursive: true });
  const r = run(['summary', '--root', emptyProj, '--json']);
  eq(r.code, 1);
  eq(JSON.parse(r.out).error, 'missing_graph');
});

test('detect checks custom env skill dir & missing binary handling', () => {
  const proj = path.join(TMP, 'proj2');
  const sk = path.join(TMP, 'custom-skill');
  mkdirSync(proj, { recursive: true });
  mkdirSync(sk, { recursive: true });
  writeFileSync(path.join(sk, 'SKILL.md'), '# graphify');

  const noPathEnv = { ...process.env, PATH: '', GRAPHIFY_SKILL_DIR: sk, GRAPHIFY_BIN: '', LOCALAPPDATA: TMP, APPDATA: TMP, HOME: TMP, USERPROFILE: TMP };
  const missing = run(['detect', '--root', proj, '--json'], noPathEnv);
  // Check skill detected even when binary missing or present on host fallbacks
  const j = JSON.parse(missing.out);
  assert(j.skills.some((s) => path.resolve(s.dir) === path.resolve(sk)), 'custom skill dir detected');
  eq(typeof mod.findExecutable, 'function');
});

test('--dry-run builds exact safe argv for query, affected, path, and explain', () => {
  const proj = path.join(TMP, 'proj3');
  mkdirSync(proj, { recursive: true });
  const expectedGraph = path.join(proj, 'graphify-out', 'graph.json');

  const q = JSON.parse(run(['query', 'how do "tokens" work?', '--root', proj, '--dfs', '--budget', '1200', '--dry-run', '--json']).out);
  eq(q.argv, ['query', 'how do "tokens" work?', '--graph', expectedGraph, '--dfs', '--budget', '1200']);

  const a = JSON.parse(run(['affected', 'SessionStore', '--root', proj, '--depth', '3', '--dry-run', '--json']).out);
  eq(a.argv, ['affected', 'SessionStore', '--graph', expectedGraph, '--depth', '3']);

  const p = JSON.parse(run(['path', 'Router', 'DB', '--root', proj, '--dry-run', '--json']).out);
  eq(p.argv, ['path', 'Router', 'DB', '--graph', expectedGraph]);

  const e = JSON.parse(run(['explain', 'AuthMiddleware', '--root', proj, '--dry-run', '--json']).out);
  eq(e.argv, ['explain', 'AuthMiddleware', '--graph', expectedGraph]);
});

try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
console.log(`\n${passed}/${passed + failed} tests passed`);
process.exit(failed ? 1 : 0);
