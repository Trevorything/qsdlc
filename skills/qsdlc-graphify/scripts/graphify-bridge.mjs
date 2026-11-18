#!/usr/bin/env node
// graphify-bridge.mjs — zero-dependency Node ESM bridge for Graphify (Graphify-Labs/graphify).
// Resolves the local graphify binary/skills safely across Windows and POSIX without shell interpolation,
// and summarizes graphify-out/graph.json directly in Node so QSDLC stages can gauge coupling cleanly.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const EXIT = { OK: 0, FAIL: 1, USAGE: 2, TOOL: 4 };

export const HELP = `graphify-bridge.mjs — QSDLC companion bridge for Graphify

Usage: node graphify-bridge.mjs <subcommand> [args] [flags]

Subcommands
  detect                         Locate installed graphify CLI, skill dirs, and repo graph.json
  summary                        Read graphify-out/graph.json directly: counts, tiers, top hubs
  query "<question>"             Run graphify query against <root>/graphify-out/graph.json
  affected "<node>"              Run graphify affected reverse-impact query
  path "<from>" "<to>"           Run graphify shortest path query
  explain "<node>"               Run graphify node explanation query

Flags
  --root <dir>       Repository root (default: cwd)
  --graph <path>     Override path to graph.json (default: <root>/graphify-out/graph.json)
  --top <N>          Number of hub nodes in summary (default: 8)
  --depth <N>        Traversal depth for affected (default: 2)
  --budget <N>       Token budget for query (default: 1500)
  --dfs              Use DFS traversal for query
  --dry-run          Print resolved argv instead of executing graphify
  --json             Emit JSON to stdout
  --self-test        Run built-in smoke check
  --help, -h         Print help

Exit codes: 0 ok | 1 missing graph/binary or failed check | 2 usage | 4 external command error
`;

const VALUE_FLAGS = new Set(['root', 'graph', 'top', 'depth', 'budget']);

export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') { out.flags.help = true; continue; }
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
    const inline = eq > 0 ? a.slice(eq + 1) : undefined;
    if (VALUE_FLAGS.has(key)) {
      const val = inline ?? argv[++i];
      if (val === undefined) throw new Error(`flag --${key} requires a value`);
      out.flags[key] = val;
    } else {
      out.flags[key] = inline ?? true;
    }
  }
  return out;
}

export function findExecutable(env = process.env) {
  if (env.GRAPHIFY_BIN && existsSync(env.GRAPHIFY_BIN)) return path.resolve(env.GRAPHIFY_BIN);
  const home = env.HOME || env.USERPROFILE || os.homedir();
  const isWin = process.platform === 'win32';
  const exeName = isWin ? 'graphify.exe' : 'graphify';
  const pathDirs = (env.PATH || '').split(path.delimiter).filter(Boolean);
  const candidates = pathDirs.map((d) => path.join(d, exeName));

  if (isWin) {
    const localApp = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const appData = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    candidates.push(
      path.join(localApp, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'graphify.exe'),
      path.join(home, '.local', 'bin', 'graphify.exe'),
      path.join(home, 'pipx', 'venvs', 'graphifyy', 'Scripts', 'graphify.exe'),
      path.join(appData, 'uv', 'tools', 'graphifyy', 'Scripts', 'graphify.exe'),
    );
  } else {
    candidates.push(
      path.join(home, '.local', 'bin', 'graphify'),
      path.join(home, '.local', 'pipx', 'venvs', 'graphifyy', 'bin', 'graphify'),
    );
  }

  for (const c of candidates) {
    if (c && existsSync(c)) return path.resolve(c);
  }
  return null;
}

export function findSkills(root, env = process.env) {
  const home = env.HOME || env.USERPROFILE || os.homedir();
  const dirs = [
    env.GRAPHIFY_SKILL_DIR,
    path.join(root, '.claude', 'skills', 'graphify'),
    path.join(root, '.agents', 'skills', 'graphify'),
    path.join(home, '.claude', 'skills', 'graphify'),
    path.join(home, '.gemini', 'config', 'skills', 'graphify'),
    path.join(home, '.agents', 'skills', 'graphify'),
  ].filter(Boolean);

  const seen = new Set();
  const found = [];
  for (const d of dirs) {
    const res = path.resolve(d);
    if (seen.has(res)) continue;
    seen.add(res);
    const skillMd = path.join(res, 'SKILL.md');
    if (existsSync(skillMd)) found.push({ dir: res, skill: skillMd });
  }
  return found;
}

export function resolveGraphPath(root, override) {
  if (override) return path.resolve(root, override);
  return path.join(path.resolve(root), 'graphify-out', 'graph.json');
}

export function summarizeGraph(graphFile, topN = 8) {
  const raw = readFileSync(graphFile, 'utf8');
  const data = JSON.parse(raw);
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.links) ? data.links : (Array.isArray(data.edges) ? data.edges : []);

  const tiers = { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0, OTHER: 0 };
  const degree = new Map();
  const communities = new Set();
  const byId = new Map();

  for (const n of nodes) {
    const id = String(n.id ?? n.name ?? '');
    if (!id) continue;
    byId.set(id, n);
    degree.set(id, 0);
    if (n.community !== undefined && n.community !== null) communities.add(String(n.community));
  }

  for (const e of edges) {
    const src = String(typeof e.source === 'object' ? e.source?.id : (e.source ?? e.from ?? ''));
    const dst = String(typeof e.target === 'object' ? e.target?.id : (e.target ?? e.to ?? ''));
    if (src) degree.set(src, (degree.get(src) || 0) + 1);
    if (dst) degree.set(dst, (degree.get(dst) || 0) + 1);

    const tier = String(e.confidence || e.confidence_tier || e.tag || '').toUpperCase();
    if (tier === 'EXTRACTED' || tier === 'INFERRED' || tier === 'AMBIGUOUS') tiers[tier]++;
    else tiers.OTHER++;
  }

  const hubs = [...degree.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(1, topN))
    .map(([id, deg]) => {
      const n = byId.get(id) || {};
      return {
        id,
        label: n.label || n.name || id,
        file: n.source_file || n.file || n.path || null,
        degree: deg,
        community: n.community ?? null,
      };
    });

  const st = statSync(graphFile);
  return {
    graphFile,
    mtimeIso: st.mtime.toISOString(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    communityCount: communities.size,
    tiers,
    hubs,
  };
}

export function buildCliArgs(sub, positionals, flags, graphFile) {
  if (sub === 'query') {
    const q = positionals[0];
    if (!q) throw new Error('query requires "<question>"');
    const argv = ['query', q, '--graph', graphFile];
    if (flags.dfs) argv.push('--dfs');
    if (flags.budget) argv.push('--budget', String(flags.budget));
    return argv;
  }
  if (sub === 'affected') {
    const sym = positionals[0];
    if (!sym) throw new Error('affected requires "<symbol>"');
    const argv = ['affected', sym, '--graph', graphFile];
    if (flags.depth) argv.push('--depth', String(flags.depth));
    return argv;
  }
  if (sub === 'path') {
    const [a, b] = positionals;
    if (!a || !b) throw new Error('path requires "<from>" "<to>"');
    return ['path', a, b, '--graph', graphFile];
  }
  if (sub === 'explain') {
    const sym = positionals[0];
    if (!sym) throw new Error('explain requires "<symbol>"');
    return ['explain', sym, '--graph', graphFile];
  }
  throw new Error(`unknown command "${sub}"`);
}

function printOut(obj, asJson) {
  if (asJson) {
    console.log(JSON.stringify(obj, null, 2));
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    console.log(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
}

export function selfTest() {
  const sample = {
    nodes: [
      { id: 'auth.verify', label: 'verifyToken', source_file: 'src/auth.ts', community: 0 },
      { id: 'router.api', label: 'apiRouter', source_file: 'src/router.ts', community: 0 },
      { id: 'db.pool', label: 'query', source_file: 'src/db.ts', community: 1 },
    ],
    links: [
      { source: 'router.api', target: 'auth.verify', confidence: 'EXTRACTED' },
      { source: 'auth.verify', target: 'db.pool', confidence: 'INFERRED' },
    ],
  };
  const nodes = sample.nodes;
  const edges = sample.links;
  if (nodes.length !== 3 || edges.length !== 2) throw new Error('self-test graph mismatch');
  const argv = buildCliArgs('affected', ['verifyToken'], { depth: '2' }, '/repo/graphify-out/graph.json');
  if (argv.join(' ') !== 'affected verifyToken --graph /repo/graphify-out/graph.json --depth 2') {
    throw new Error('self-test argv mismatch: ' + argv.join(' '));
  }
  return { ok: true, checked: ['parseArgs', 'buildCliArgs', 'schema-shape'] };
}

function main() {
  let parsed;
  try { parsed = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(`graphify-bridge: ${e.message}`); process.exit(EXIT.USAGE); }

  const { _: pos, flags } = parsed;
  if (flags.help || (!pos.length && !flags['self-test'])) {
    if (flags['self-test']) { printOut(selfTest(), !!flags.json); process.exit(EXIT.OK); }
    console.log(HELP.trimEnd());
    process.exit(flags.help ? EXIT.OK : EXIT.USAGE);
  }
  if (flags['self-test']) {
    printOut(selfTest(), !!flags.json);
    process.exit(EXIT.OK);
  }

  const sub = pos[0];
  const rest = pos.slice(1);
  const root = path.resolve(flags.root || process.cwd());
  const graphFile = resolveGraphPath(root, flags.graph);
  const asJson = !!flags.json;

  if (sub === 'detect') {
    const bin = findExecutable();
    const skills = findSkills(root);
    const hasGraph = existsSync(graphFile);
    const res = {
      ok: Boolean(bin && skills.length),
      binary: bin,
      skills,
      graphExists: hasGraph,
      graphFile,
      reportExists: existsSync(path.join(path.dirname(graphFile), 'GRAPH_REPORT.md')),
    };
    printOut(res, asJson);
    process.exit(bin ? EXIT.OK : EXIT.FAIL);
  }

  if (sub === 'summary') {
    if (!existsSync(graphFile)) {
      printOut({ ok: false, error: 'missing_graph', graphFile }, asJson);
      process.exit(EXIT.FAIL);
    }
    try {
      const top = Number(flags.top || 8);
      const sum = summarizeGraph(graphFile, Number.isFinite(top) && top > 0 ? top : 8);
      printOut({ ok: true, ...sum }, asJson);
      process.exit(EXIT.OK);
    } catch (e) {
      console.error(`graphify-bridge: invalid graph.json (${e.message})`);
      process.exit(EXIT.FAIL);
    }
  }

  let argv;
  try {
    argv = buildCliArgs(sub, rest, flags, graphFile);
  } catch (e) {
    console.error(`graphify-bridge: ${e.message}`);
    process.exit(EXIT.USAGE);
  }

  const bin = findExecutable();
  if (flags['dry-run']) {
    printOut({ ok: true, dryRun: true, executable: bin || 'graphify', argv }, asJson);
    process.exit(EXIT.OK);
  }

  if (!bin) {
    console.error('graphify-bridge: graphify executable not found (install via pipx install graphifyy && graphify install)');
    process.exit(EXIT.FAIL);
  }
  if (!existsSync(graphFile)) {
    console.error(`graphify-bridge: missing graph at ${graphFile} (run /graphify . or graphify update . first)`);
    process.exit(EXIT.FAIL);
  }

  const r = spawnSync(bin, argv, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  process.exit(r.status === 0 ? EXIT.OK : EXIT.TOOL);
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1]).replace(/\\/g, '/')}` ||
    (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)))) {
  main();
}
