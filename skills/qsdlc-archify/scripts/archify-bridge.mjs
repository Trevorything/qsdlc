#!/usr/bin/env node
// archify-bridge.mjs — zero-dependency Node ESM companion bridge for Archify (tt-a1i/archify).
// Discovers installed archify skill/bin cleanly, checks QSDLC output-path hygiene, validates candidate
// JSON shape before finalize, and invokes archify via argv arrays with zero shell interpolation.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const EXIT = { OK: 0, FAIL: 1, USAGE: 2, TOOL: 4 };

export const ARCHIFY_MODES = Object.freeze([
  'architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle',
  'erd', 'class', 'tree', 'timeline', 'waterfall', 'explainer',
]);

export const STAGE_ARTIFACT = Object.freeze({
  plan: 'inspo.html',
  design: 'design-pitch-deck.html',
  build: 'implementation-process-map.html',
  test: 'performance-results.html',
  deploy: 'release-notes.html',
});

export const HELP = `archify-bridge.mjs — QSDLC companion bridge for tt-a1i/archify

Usage: node archify-bridge.mjs <subcommand> [args] [flags]

Subcommands
  detect                                Locate installed archify skill + bin/archify.mjs
  paths --slug <s...> --type <mode>     Compute V1-clean .qsdlc/<slug>/artifacts/ or .craft/ paths
  check-candidate <candidate.json>      Check JSON syntax, diagram type, title, and output path containment
  doctor                                Run archify doctor
  finalize <type> <candidate> <out.html>  Run archify finalize <type> <candidate> <out.html>

Flags
  --root <dir>          Repository root (default: cwd)
  --slug <slug>         QSDLC feature slug (kebab-case)
  --type <mode>         One of: ${ARCHIFY_MODES.join(', ')}
  --stage <stage>       Optional canonical stage artifact (plan|design|build|test|deploy)
  --name <stem>         Companion diagram stem under .craft/archify/ (default: diagram-<type>)
  --quality <profile>   showcase | standard (default: showcase)
  --repo-root <dir>     Optional repo root passed to archify finalize
  --dry-run             Print exact argv without spawning archify
  --json                Emit JSON to stdout
  --self-test           Run built-in smoke check
  --help, -h            Print help

Exit codes: 0 ok | 1 missing install or failed check | 2 usage | 4 archify failed
`;

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALUE_FLAGS = new Set(['root', 'slug', 'type', 'stage', 'name', 'quality', 'repo-root']);

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

export function findInstall(root = process.cwd(), env = process.env) {
  const home = env.HOME || env.USERPROFILE || os.homedir();
  const candidates = [
    env.ARCHIFY_HOME,
    path.join(root, '.claude', 'skills', 'archify'),
    path.join(root, '.agents', 'skills', 'archify'),
    path.join(root, '.gemini', 'config', 'skills', 'archify'),
    path.join(home, '.claude', 'skills', 'archify'),
    path.join(home, '.agents', 'skills', 'archify'),
    path.join(home, '.gemini', 'config', 'skills', 'archify'),
  ].filter(Boolean);

  const seen = new Set();
  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const bin = path.join(resolved, 'bin', 'archify.mjs');
    const skill = path.join(resolved, 'SKILL.md');
    if (existsSync(bin)) {
      let version = null;
      if (existsSync(skill)) {
        const md = readFileSync(skill, 'utf8');
        const m = md.match(/^\s*version:\s*["']?([^"'\r\n]+)["']?/m);
        if (m) version = m[1].trim();
      }
      return { found: true, home: resolved, bin, skill: existsSync(skill) ? skill : null, version };
    }
  }
  return { found: false, home: null, bin: null, skill: null, version: null };
}

function isWithin(parentDir, childPath) {
  const rel = path.relative(path.resolve(parentDir), path.resolve(childPath));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function resolveSafePaths(root, slug, type, name, stage) {
  if (!slug || !KEBAB.test(slug)) throw new Error(`invalid --slug "${slug || ''}" (expected kebab-case)`);
  if (!type || !ARCHIFY_MODES.includes(type)) throw new Error(`invalid --type "${type || ''}"`);
  if (stage && !STAGE_ARTIFACT[stage]) throw new Error(`invalid --stage "${stage}" (expected plan|design|build|test|deploy)`);
  const stem = name || `diagram-${type}`;
  if (!KEBAB.test(stem)) throw new Error(`invalid --name "${stem}" (expected kebab-case)`);

  const absRoot = path.resolve(root);
  const craftDir = path.join(absRoot, '.qsdlc', slug, 'artifacts', '.craft', 'archify', `${type}-${stem}`);
  const candidate = path.join(craftDir, type === 'explainer' ? 'candidate.archify.md' : 'candidate.json');
  const output = stage
    ? path.join(absRoot, '.qsdlc', slug, 'artifacts', STAGE_ARTIFACT[stage])
    : path.join(craftDir, `${stem}.html`);
  return {
    root: absRoot,
    slug,
    type,
    stage: stage || null,
    name: stem,
    craftDir,
    candidate,
    output,
    relativeOutput: path.relative(absRoot, output).replace(/\\/g, '/'),
  };
}

export function checkCandidate(candidatePath, root = process.cwd()) {
  const errors = [];
  const warnings = [];
  const absRoot = path.resolve(root);
  const absCand = path.resolve(absRoot, candidatePath);
  if (!existsSync(absCand)) {
    return { ok: false, errors: [`candidate not found: ${absCand}`], warnings };
  }

  let data;
  try {
    data = JSON.parse(readFileSync(absCand, 'utf8'));
  } catch (e) {
    return { ok: false, errors: [`invalid JSON: ${e.message}`], warnings };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('candidate root must be a JSON object');
  } else {
    const meta = data.meta || {};
    if (!meta.title || typeof meta.title !== 'string') warnings.push('meta.title is missing');
    if (meta.output) {
      const targetOut = path.resolve(absRoot, String(meta.output));
      const relPosix = path.relative(absRoot, targetOut).replace(/\\/g, '/');
      const inQsdlc = isWithin(path.join(absRoot, '.qsdlc'), targetOut);
      const inArchify = isWithin(path.join(absRoot, '.archify'), targetOut);
      if (!isWithin(absRoot, targetOut)) errors.push(`meta.output escapes repo root: ${meta.output}`);
      else if (!inQsdlc && !inArchify) warnings.push(`meta.output (${meta.output}) sits outside .qsdlc/ or .archify/`);
      else if (/^\.qsdlc\/[^/]+\/artifacts\/(?!\.craft\/)/.test(relPosix)) {
        const base = path.basename(relPosix);
        if (!Object.values(STAGE_ARTIFACT).includes(base)) {
          errors.push(`meta.output (${relPosix}) would fail V1 in qsdlc-lint: place companion HTML under .craft/archify/ or name it after a stage artifact`);
        }
      }
    }
    const contentKeys = ['nodes', 'entities', 'participants', 'lanes', 'events', 'spans', 'blocks', 'stages', 'steps', 'root'];
    if (!contentKeys.some((k) => data[k] !== undefined)) {
      warnings.push('candidate contains none of the common diagram body keys (nodes, entities, participants, lanes, events, spans, root)');
    }
  }
  return { ok: errors.length === 0, candidate: absCand, errors, warnings };
}

export function buildFinalizeArgv(type, candidate, outHtml, flags) {
  if (!ARCHIFY_MODES.includes(type)) throw new Error(`unknown archify type "${type}"`);
  if (!candidate || !outHtml) throw new Error('finalize requires <type> <candidate> <out.html>');
  const argv = ['finalize', type, candidate, outHtml];
  const quality = flags.quality || 'showcase';
  if (type !== 'explainer') argv.push('--quality', quality);
  if (flags['repo-root']) argv.push('--repo-root', String(flags['repo-root']));
  argv.push('--json');
  return argv;
}

function printOut(obj, asJson) {
  if (asJson) { console.log(JSON.stringify(obj, null, 2)); return; }
  for (const [k, v] of Object.entries(obj)) {
    console.log(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
}

export function selfTest() {
  const p = resolveSafePaths('/tmp/demo', 'auth-v2', 'sequence', 'token-flow');
  if (p.relativeOutput !== '.qsdlc/auth-v2/artifacts/.craft/archify/sequence-token-flow/token-flow.html') {
    throw new Error('self-test relativeOutput mismatch: ' + p.relativeOutput);
  }
  const s = resolveSafePaths('/tmp/demo', 'auth-v2', 'architecture', 'overview', 'design');
  if (s.relativeOutput !== '.qsdlc/auth-v2/artifacts/design-pitch-deck.html') {
    throw new Error('self-test stage output mismatch: ' + s.relativeOutput);
  }
  const argv = buildFinalizeArgv('sequence', 'cand.json', 'out.html', { quality: 'showcase', 'repo-root': '.' });
  if (!argv.includes('finalize') || !argv.includes('--repo-root')) {
    throw new Error('self-test finalize argv mismatch');
  }
  return { ok: true, modes: ARCHIFY_MODES.length, checked: ['resolveSafePaths', 'buildFinalizeArgv'] };
}

function main() {
  let parsed;
  try { parsed = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(`archify-bridge: ${e.message}`); process.exit(EXIT.USAGE); }

  const { _: pos, flags } = parsed;
  const asJson = !!flags.json;
  if (flags.help || (!pos.length && !flags['self-test'])) {
    if (flags['self-test']) { printOut(selfTest(), asJson); process.exit(EXIT.OK); }
    console.log(HELP.trimEnd());
    process.exit(flags.help ? EXIT.OK : EXIT.USAGE);
  }
  if (flags['self-test']) {
    printOut(selfTest(), asJson);
    process.exit(EXIT.OK);
  }

  const sub = pos[0];
  const rest = pos.slice(1);
  const root = path.resolve(flags.root || process.cwd());

  if (sub === 'detect') {
    const info = findInstall(root);
    printOut({ ...info, installCmd: info.found ? null : 'npx skills add tt-a1i/archify --skill archify -g' }, asJson);
    process.exit(info.found ? EXIT.OK : EXIT.FAIL);
  }

  if (sub === 'paths') {
    try {
      const p = resolveSafePaths(root, flags.slug, flags.type, flags.name, flags.stage);
      printOut({ ok: true, ...p }, asJson);
      process.exit(EXIT.OK);
    } catch (e) {
      console.error(`archify-bridge: ${e.message}`);
      process.exit(EXIT.USAGE);
    }
  }

  if (sub === 'check-candidate') {
    if (!rest[0]) { console.error('archify-bridge: check-candidate requires <candidate.json>'); process.exit(EXIT.USAGE); }
    const rep = checkCandidate(rest[0], root);
    printOut(rep, asJson);
    process.exit(rep.ok ? EXIT.OK : EXIT.FAIL);
  }

  let argv;
  if (sub === 'doctor') {
    argv = ['doctor'];
  } else if (sub === 'finalize') {
    try { argv = buildFinalizeArgv(rest[0], rest[1], rest[2], flags); }
    catch (e) { console.error(`archify-bridge: ${e.message}`); process.exit(EXIT.USAGE); }
  } else {
    console.error(`archify-bridge: unknown subcommand "${sub}"`);
    process.exit(EXIT.USAGE);
  }

  const info = findInstall(root);
  if (flags['dry-run']) {
    printOut({ ok: true, dryRun: true, node: process.execPath, bin: info.bin || 'archify/bin/archify.mjs', argv }, asJson);
    process.exit(EXIT.OK);
  }
  if (!info.found) {
    console.error('archify-bridge: archify is not installed (run: npx skills add tt-a1i/archify --skill archify -g)');
    process.exit(EXIT.FAIL);
  }

  const r = spawnSync(process.execPath, [info.bin, ...argv], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  process.exit(r.status === 0 ? EXIT.OK : EXIT.TOOL);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
