#!/usr/bin/env node
// PreToolUse hook and CLI safety enforcer for QSDLC. Zero dependencies, Node >= 20.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE_TOOLS = new Set(['edit', 'write', 'notebookedit', 'multiedit']);
const CMD_TOOLS = new Set(['bash', 'powershell']);
const REGENERABLE = new Set(['node_modules', 'dist', 'build', '.next', '__pycache__', '.cache', 'coverage']);
const SHARED_BRANCHES = new Set(['main', 'master']);
const AUTO_PREFIX = 'qsdlc/auto/';

// ---------- yaml-lite ----------

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

function splitInline(s) {
  const parts = [];
  let cur = '';
  let quote = null;
  for (const c of s) {
    if (quote) { cur += c; if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === ',') { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim());
}

function scalar(v) {
  v = v.trim();
  if (v === '') return null;
  if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) return v.slice(1, -1);
  if (v.startsWith('[') && v.endsWith(']')) return splitInline(v.slice(1, -1)).map(scalar);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

const KEY_RE = /^((?:"[^"]*"|'[^']*'|[^\s:#'"][^:]*?))\s*:(?:\s+(.*))?$/;

export function parseYamlLite(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const content = stripComment(raw);
    if (!content.trim()) continue;
    lines.push({ indent: content.match(/^ */)[0].length, content: content.trim() });
  }
  let i = 0;
  const parseBlock = (indent) => {
    if (i >= lines.length) return null;
    if (lines[i].content.startsWith('- ') || lines[i].content === '-') return parseList(indent);
    return parseMap(indent);
  };
  const parseList = (indent) => {
    const list = [];
    while (i < lines.length && lines[i].indent === indent && (lines[i].content.startsWith('- ') || lines[i].content === '-')) {
      const rest = lines[i].content === '-' ? '' : lines[i].content.slice(2).trim();
      if (rest && KEY_RE.test(rest) && !/^["']/.test(rest)) {
        lines[i] = { indent: indent + 2, content: rest };
        list.push(parseMap(indent + 2));
      } else {
        list.push(scalar(rest));
        i++;
      }
    }
    return list;
  };
  const parseMap = (indent) => {
    const map = {};
    while (i < lines.length && lines[i].indent === indent && !lines[i].content.startsWith('- ')) {
      const m = lines[i].content.match(KEY_RE);
      if (!m) { i++; continue; }
      const key = m[1].replace(/^["']|["']$/g, '');
      const val = m[2];
      i++;
      if (val !== undefined && val.trim() !== '') map[key] = scalar(val);
      else if (i < lines.length && lines[i].indent > indent) map[key] = parseBlock(lines[i].indent);
      else if (i < lines.length && lines[i].indent === indent && lines[i].content.startsWith('- ')) map[key] = parseList(indent);
      else map[key] = null;
    }
    return map;
  };
  const out = parseBlock(lines.length ? lines[0].indent : 0);
  return out ?? {};
}

export function parseFrontmatter(text) {
  const t = text.replace(/^\uFEFF/, '');
  if (!/^---\r?\n/.test(t)) return {};
  const end = t.indexOf('\n---', 3);
  if (end < 0) return {};
  return parseYamlLite(t.slice(t.indexOf('\n') + 1, end));
}

// ---------- globs and paths ----------

export function globToRegExp(glob) {
  let re = '';
  const g = glob.replace(/\\/g, '/');
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

export function normPath(p, cwd = '/') {
  let s = String(p).replace(/\\/g, '/');
  if (!/^([a-zA-Z]:)?\//.test(s)) s = `${String(cwd).replace(/\\/g, '/').replace(/\/+$/, '')}/${s}`;
  const m = s.match(/^([a-zA-Z]:)?(\/.*)$/);
  const drive = m && m[1] ? m[1] : '';
  let rest = path.posix.normalize(m ? m[2] : s);
  if (rest.length > 1) rest = rest.replace(/\/+$/, '');
  return drive + rest;
}

function ci(...paths) {
  return process.platform === 'win32' || paths.some((p) => /^[a-zA-Z]:/.test(p));
}

export function isInside(child, parent) {
  const lower = ci(child, parent);
  const c = lower ? child.toLowerCase() : child;
  const p = lower ? parent.toLowerCase() : parent;
  if (c === p) return true;
  return c.startsWith(p.endsWith('/') ? p : `${p}/`);
}

function relTo(abs, base) {
  if (!base || !isInside(abs, base)) return null;
  return abs.length === base.length ? '' : abs.slice(base.length + (base.endsWith('/') ? 0 : 1));
}

// ---------- command parsing ----------

export function splitSegments(cmd) {
  const segs = [];
  let cur = '';
  let q = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '\n' || c === ';' || c === '|' || c === '&') {
      segs.push(cur);
      cur = '';
      if ((c === '|' || c === '&') && cmd[i + 1] === c) i++;
      continue;
    }
    cur += c;
  }
  segs.push(cur);
  return segs.map((s) => s.trim()).filter(Boolean);
}

export function tokenize(seg) {
  const tokens = [];
  let cur = '';
  let q = null;
  let has = false;
  for (const c of seg) {
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; has = true; continue; }
    if (/\s/.test(c)) { if (has || cur) tokens.push(cur); cur = ''; has = false; continue; }
    cur += c; has = true;
  }
  if (has || cur) tokens.push(cur);
  return tokens;
}

const WRAPPERS = new Set(['sudo', 'command', 'env', 'time', 'nohup', 'exec', 'builtin']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'pwsh', 'powershell', 'cmd']);
const INNER_FLAGS = new Set(['-c', '-lc', '-command', '-c:', '/c', '/k', '-encodedcommand']);

export function analyze(cmd, depth = 0) {
  const out = [];
  for (const seg of splitSegments(cmd)) {
    let tokens = tokenize(seg);
    while (tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]) || WRAPPERS.has(tokens[0].toLowerCase()))) tokens.shift();
    if (!tokens.length) continue;
    const name = path.posix.basename(tokens[0].replace(/\\/g, '/')).toLowerCase().replace(/\.(exe|cmd|bat)$/, '');
    const args = tokens.slice(1);
    out.push({ name, args, tokens });
    if (SHELLS.has(name) && depth < 3) {
      const idx = args.findIndex((a) => INNER_FLAGS.has(a.toLowerCase()));
      if (idx >= 0 && args[idx + 1]) out.push(...analyze(args[idx + 1], depth + 1));
    }
  }
  return out;
}

function gitParts(seg) {
  let i = 0;
  const a = seg.args;
  while (i < a.length && a[i].startsWith('-')) i += ['-C', '-c', '--git-dir', '--work-tree', '--namespace'].includes(a[i]) ? 2 : 1;
  return { sub: a[i], rest: a.slice(i + 1) };
}

function forceFlag(args) {
  return args.some((a) => a === '-f' || a === '--force' || a === '--force-if-includes' || a.startsWith('--force-with-lease') || /^-[a-z]*f[a-z]*$/.test(a)) || args.some((a) => a.startsWith('+') && !a.startsWith('+-'));
}

function psRecurse(low) {
  return low.some((a) => /^-r(ec\w*)?$/.test(a));
}

function destructiveOf(seg, isPS) {
  const { name, args } = seg;
  const low = args.map((a) => a.toLowerCase());
  const nonFlags = args.filter((a) => !a.startsWith('-') && !/^\/[a-z]$/i.test(a));
  if (['rd', 'rmdir', 'del', 'erase'].includes(name) && low.includes('/s')) {
    return { label: `${name} /s`, alt: 'move the target into .qsdlc/archive/<run-id>/ instead of deleting it' };
  }
  const psDelete = ['remove-item', 'ri'].includes(name) || (isPS && ['rm', 'del', 'erase', 'rd', 'rmdir'].includes(name));
  if (psDelete) {
    return psRecurse(low)
      ? { label: 'Remove-Item -Recurse', alt: 'use Move-Item into .qsdlc/archive/<run-id>/ instead of deleting' }
      : null;
  }
  if (name === 'rm') {
    const flags = args.filter((a) => a.startsWith('-') && a !== '--');
    const recursive = flags.some((f) => f === '--recursive' || (/^-[a-zA-Z]+$/.test(f) && /[rR]/.test(f)));
    const dd = args.indexOf('--');
    const paths = args.filter((a, i) => (dd >= 0 ? i > dd : !a.startsWith('-')));
    return { label: recursive ? 'rm -r' : 'rm', alt: 'soft-delete into .qsdlc/archive/<run-id>/', rm: { recursive, paths } };
  }
  if (name === 'git') {
    const { sub, rest } = gitParts(seg);
    if (sub === 'clean' && rest.some((a) => a === '--force' || /^-[a-zA-Z]*f/.test(a))) return { label: 'git clean -f', alt: 'list candidates with git clean -n and archive them by hand' };
    if (sub === 'reset' && rest.includes('--hard')) return { label: 'git reset --hard', alt: 'git stash or commit a WIP branch first' };
    if (sub === 'checkout') {
      const dd = rest.indexOf('--');
      if ((dd >= 0 && ['.', '*'].includes(rest[dd + 1])) || (rest.length === 1 && rest[0] === '.')) return { label: 'git checkout -- .', alt: 'git stash instead of discarding changes' };
    }
    if (sub === 'branch' && rest.some((a) => a === '-D' || /^-[a-zA-Z]*D/.test(a))) return { label: 'git branch -D', alt: 'git branch -d, which refuses unmerged branches' };
    if (sub === 'push' && forceFlag(rest)) return { label: 'git push --force', alt: 'push a new commit to your own branch without force' };
  }
  if (name === 'kubectl' && args[0] === 'delete') return { label: 'kubectl delete', alt: 'kubectl get -o yaml > archive first, then ask a human' };
  if (name === 'docker' && args[0] === 'system' && args[1] === 'prune') return { label: 'docker system prune', alt: 'remove specific containers you started' };
  return null;
}

function sqlDestructive(command, segs) {
  const skip = new Set(['git', 'echo', 'printf', 'grep', 'rg', 'cat']);
  if (segs.length && segs.every((s) => skip.has(s.name))) return null;
  if (/\bdrop\s+(table|database|schema)\b/i.test(command)) return { label: 'DROP statement', alt: 'rename the table or take a backup, then ask a human' };
  if (/\btruncate\s+(table\s+)?["`\[\w.]/i.test(command)) return { label: 'TRUNCATE', alt: 'delete with a WHERE clause on a seeded test database' };
  return null;
}

const DEPLOYS = [
  (s) => ['npm', 'pnpm', 'yarn', 'bun'].includes(s.name) && s.args.slice(0, 2).includes('publish') && 'npm publish',
  (s) => s.name === 'cargo' && s.args[0] === 'publish' && 'cargo publish',
  (s) => s.name === 'twine' && s.args[0] === 'upload' && 'twine upload',
  (s) => s.name === 'docker' && s.args[0] === 'push' && 'docker push',
  (s) => s.name === 'helm' && ['install', 'upgrade'].includes(s.args[0]) && `helm ${s.args[0]}`,
  (s) => s.name === 'kubectl' && s.args[0] === 'apply' && 'kubectl apply',
  (s) => ['terraform', 'tofu'].includes(s.name) && s.args[0] === 'apply' && 'terraform apply',
  (s) => s.name === 'vercel' && s.args.some((a) => a === '--prod' || a === '--production') && 'vercel --prod',
  (s) => s.name === 'netlify' && s.args[0] === 'deploy' && s.args.includes('--prod') && 'netlify deploy --prod',
  (s) => ['wrangler', 'firebase'].includes(s.name) && ['deploy', 'publish'].includes(s.args[0]) && `${s.name} ${s.args[0]}`,
  (s) => s.name === 'gh' && s.args[0] === 'release' && s.args[1] === 'create' && 'gh release create',
];

// ---------- budget ----------

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function checkBudget(policy, gitInfo = {}, { pr = false } = {}) {
  const lim = (policy && policy.autonomous) || {};
  const reasons = [];
  if (isNum(lim.max_files) || isNum(lim.max_changed_loc)) {
    const b = gitInfo.budget;
    if (!b) reasons.push('budget unknown: base SHA missing or git diff failed (fail closed)');
    else {
      if (isNum(lim.max_files) && b.files > lim.max_files) reasons.push(`decline and log: max_files ${lim.max_files} exceeded (observed ${b.files})`);
      if (isNum(lim.max_changed_loc) && b.loc > lim.max_changed_loc) reasons.push(`decline and log: max_changed_loc ${lim.max_changed_loc} exceeded (observed ${b.loc})`);
    }
  }
  if (pr && isNum(lim.max_open_auto_prs)) {
    if (!isNum(gitInfo.openAutoPrs)) reasons.push('open auto PR count unknown: gh unavailable or failed (fail closed)');
    else if (gitInfo.openAutoPrs >= lim.max_open_auto_prs) reasons.push(`decline and log: max_open_auto_prs ${lim.max_open_auto_prs} reached (observed ${gitInfo.openAutoPrs})`);
  }
  return { ok: reasons.length === 0, reasons };
}

// ---------- evaluation ----------

const res = (decision, reason = '', updatedInput) => (updatedInput ? { decision, reason, updatedInput } : { decision, reason });

function evalFile({ toolInput, cwd, mode, policy, env, root }) {
  const target = toolInput.file_path ?? toolInput.notebook_path ?? toolInput.path;
  if (!target) return res('allow');
  const auto = mode === 'autonomous';
  const abs = normPath(target, cwd);
  if (/(^|\/)\.git(\/|$)/i.test(abs)) return res('deny', `Writes into .git are never allowed (${abs}).`);
  const wt = env.QSDLC_WORKTREE ? normPath(env.QSDLC_WORKTREE, cwd) : null;
  if (wt && !isInside(abs, wt)) return res('deny', `Path ${abs} is outside the run worktree ${wt}. Edit only inside the worktree.`);
  if (/\/\.qsdlc\/factory\/(corrections\.tsv|rules\.md|runs\/[^/]+\.tsv)$/i.test(abs)) {
    return res('deny', 'This file is append-only or generated. Use skills/_shared/scripts/qsdlc-log.mjs instead of editing it directly.');
  }
  if (auto && /\/\.qsdlc\/factory\/policy\.md$/i.test(abs)) {
    return res('deny', 'policy.md is human-owned. Autonomous runs never edit it; a human raises limits and grants.');
  }
  if (auto) {
    const globs = Array.isArray(policy.protected_paths) ? policy.protected_paths : [];
    const base = wt || (root ? normPath(root, cwd) : normPath(cwd, '/'));
    const rel = relTo(abs, base);
    const hit = globs.find((g) => (rel !== null ? globToRegExp(g).test(rel) : globToRegExp(`**/${g}`).test(abs.replace(/^[a-zA-Z]:/, '').replace(/^\//, ''))));
    if (hit) {
      const ok = env.QSDLC_RISK === 'protected' && policy.autonomous && policy.autonomous.protected_path_outcome === 'needs-review';
      if (!ok) return res('deny', `Protected path (${hit}). Autonomous edits need QSDLC_RISK=protected from triage and policy autonomous.protected_path_outcome: needs-review. Decline and log, then mailbox the run.`);
    }
  }
  return res('allow');
}

function softDelete({ rm, cwd, env, root }) {
  const paths = rm.paths;
  const wt = env.QSDLC_WORKTREE ? normPath(env.QSDLC_WORKTREE, cwd) : null;
  const rootAbs = normPath(root || wt || cwd, '/');
  for (const p of paths) {
    if (/["$`\\]/.test(p) || ['/', '~', '.', '..', '*'].includes(p) || p.startsWith('~')) return { error: `refusing to soft-delete unsafe target "${p}"` };
    const abs = normPath(p, cwd);
    if (/^([a-zA-Z]:)?\/?$/.test(abs) || abs === rootAbs || (wt && abs === wt)) return { error: `refusing to delete the project or worktree root (${p})` };
    if (/(^|\/)\.git(\/|$)/i.test(abs)) return { error: 'refusing to delete .git' };
    if (/\/\.qsdlc\/archive(\/|$)/i.test(abs)) return { error: 'refusing to delete the archive itself' };
    if (wt && !isInside(abs, wt)) return { error: `target ${abs} is outside the run worktree` };
  }
  const run = String(env.QSDLC_RUN_ID || 'adhoc').replace(/[^A-Za-z0-9._-]/g, '_');
  const archive = `${rootAbs}/.qsdlc/archive/${run}`;
  const parts = paths.map((p, i) => `mkdir -p "${archive}/${i}" && mv -- "${p}" "${archive}/${i}/"`);
  return { command: parts.join(' && ') };
}

function evalCommand({ toolName, toolInput, cwd, mode, policy, env, gitInfo, root }) {
  const command = String(toolInput.command ?? toolInput.script ?? '');
  if (!command.trim()) return res('allow');
  const auto = mode === 'autonomous';
  const isPS = toolName.toLowerCase() === 'powershell';
  const segs = analyze(command);
  const branch = gitInfo.branch || null;
  const defaultBranch = gitInfo.defaultBranch || null;
  const sharedBranch = (b) => !b || SHARED_BRANCHES.has(b) || (defaultBranch && b === defaultBranch);
  const grants = (policy && policy.autonomous && Array.isArray(policy.autonomous.grants)) ? policy.autonomous.grants : [];

  if (auto) {
    for (const s of segs) {
      const a = s.args;
      if (s.name === 'gh') {
        const [g1, g2] = a;
        if (g1 === 'pr' && g2 === 'merge') return res('deny', 'Autonomous runs never merge. Open a draft PR and leave the merge to a human.');
        if (g1 === 'pr' && g2 === 'ready') return res('deny', 'Autonomous runs never mark a PR ready. A human flips draft to ready.');
        if (g1 === 'pr' && g2 === 'create') {
          if (!a.includes('--draft') && !a.includes('-d')) return res('deny', 'Autonomous runs open draft PRs only. Add --draft.');
          if (!grants.includes('open_draft_pr')) return res('deny', 'policy autonomous.grants lacks open_draft_pr. Decline, log, and mailbox the run.');
          const b = checkBudget(policy, gitInfo, { pr: true });
          if (!b.ok) return res('deny', b.reasons.join('; '));
        }
      }
      if (s.name === 'git') {
        const { sub, rest } = gitParts(s);
        if (sub === 'merge' && sharedBranch(branch)) return res('deny', `Autonomous runs never merge into ${branch || 'an unknown branch'} (main, master, or default). Work on ${AUTO_PREFIX}<name>-<date>.`);
        if (sub === 'commit' && branch && sharedBranch(branch)) return res('deny', `Autonomous runs never commit on ${branch}. Use a worktree branch under ${AUTO_PREFIX}.`);
        if (sub === 'push') {
          if (forceFlag(rest)) return res('deny', 'Autonomous runs never force-push. Push a new commit to the run branch.');
          if (rest.some((x) => x === '--delete' || x === '-d' || x === '--all' || x === '--mirror')) return res('deny', 'Autonomous runs never delete refs or push all branches.');
          if (!grants.includes('push_branch')) return res('deny', 'policy autonomous.grants lacks push_branch. Decline, log, mailbox, and leave a local branch.');
          if (!branch || !branch.startsWith(AUTO_PREFIX)) return res('deny', `Current branch ${branch || '(unknown)'} is not under ${AUTO_PREFIX}. Push only the run branch.`);
          const pos = rest.filter((x) => !x.startsWith('-'));
          for (const spec of pos.slice(1)) {
            if (spec.startsWith(':')) return res('deny', 'Autonomous runs never delete remote refs.');
            const dst = (spec.includes(':') ? spec.split(':')[1] : spec).replace(/^refs\/heads\//, '');
            const resolved = dst === 'HEAD' ? branch : dst;
            if (sharedBranch(resolved) && resolved) return res('deny', `Autonomous runs never push to ${resolved} (main, master, or default). Push ${AUTO_PREFIX}<name>-<date> and open a draft PR.`);
            if (!resolved.startsWith(AUTO_PREFIX)) return res('deny', `Push target ${resolved} is not under ${AUTO_PREFIX}.`);
          }
          const b = checkBudget(policy, gitInfo, { pr: false });
          if (!b.ok) return res('deny', b.reasons.join('; '));
        }
      }
      for (const d of DEPLOYS) {
        const hit = d(s);
        if (hit) return res('deny', `Autonomous runs never publish or deploy (${hit}). A human ships.`);
      }
    }
  }

  const findings = [];
  for (const s of segs) {
    const f = destructiveOf(s, isPS);
    if (!f) continue;
    if (f.rm) {
      const regen = f.rm.paths.length > 0 && f.rm.paths.every((p) => REGEN.has(path.posix.basename(p.replace(/\\/g, '/').replace(/\/+$/, ''))));
      if (regen) { findings.push({ ...f, regenerable: true }); continue; }
      if (!f.rm.recursive && !auto) continue;
    }
    findings.push(f);
  }
  const sql = sqlDestructive(command, segs);
  if (sql) findings.push(sql);

  const wt = env.QSDLC_WORKTREE ? normPath(env.QSDLC_WORKTREE, cwd) : null;
  for (const f of findings) {
    if (f.regenerable && wt) {
      for (const p of f.rm.paths) if (!isInside(normPath(p, cwd), wt)) return res('deny', `Target ${p} is outside the run worktree.`);
    }
  }
  const real = findings.filter((f) => !f.regenerable);
  if (!real.length) return res('allow');

  if (!auto) return res('ask', `Destructive command (${real[0].label}). Alternative: ${real[0].alt}.`);

  const simple = segs.length === 1 && real.length === 1 && real[0].rm && real[0].rm.paths.length > 0 && !isPS && !/[|;&`$<>*?[\]{}()\n]/.test(command);
  if (simple) {
    const out = softDelete({ rm: real[0].rm, cwd, env, root });
    if (out.error) return res('deny', out.error);
    return res('allow', 'Rewritten to a soft-delete into .qsdlc/archive/.', { ...toolInput, command: out.command });
  }
  if (real[0].rm) return res('deny', `Cannot soft-delete this rm safely (globs, pipes, chaining, or no explicit paths). Give explicit paths so guard can move them to .qsdlc/archive/.`);
  return res('deny', `Destructive command blocked in autonomous mode (${real[0].label}). Alternative: ${real[0].alt}. Log it and mailbox the run.`);
}

const REGEN = REGENERABLE;

export function evaluate(input) {
  const { toolName = '', mode = 'interactive', policy = null } = input;
  const env = input.env || {};
  const ctx = { toolName, toolInput: input.toolInput || {}, cwd: input.cwd || '/', mode, policy, env, gitInfo: input.gitInfo || {}, root: input.root };
  if (mode === 'autonomous' && !policy) {
    return res('deny', 'Autonomous mode needs .qsdlc/factory/policy.md and it is missing or unreadable. Failing closed.');
  }
  const t = toolName.toLowerCase();
  if (FILE_TOOLS.has(t)) return evalFile(ctx);
  if (CMD_TOOLS.has(t)) return evalCommand(ctx);
  return res('allow');
}

// ---------- impure helpers ----------

export function findPolicyFile(start) {
  let dir = path.resolve(start);
  for (;;) {
    const f = path.join(dir, '.qsdlc', 'factory', 'policy.md');
    if (fs.existsSync(f)) return { file: f, root: dir };
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

export function loadPolicy(start, rootOverride) {
  const found = rootOverride
    ? (fs.existsSync(path.join(rootOverride, '.qsdlc', 'factory', 'policy.md')) ? { file: path.join(rootOverride, '.qsdlc', 'factory', 'policy.md'), root: path.resolve(rootOverride) } : null)
    : findPolicyFile(start);
  if (!found) return { policy: null, root: path.resolve(rootOverride || start) };
  try {
    return { policy: parseFrontmatter(fs.readFileSync(found.file, 'utf8')), root: found.root };
  } catch {
    return { policy: null, root: found.root };
  }
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return r.status === 0 ? r.stdout : null;
}

export function collectGitInfo(cwd, { baseSha, budget = false, prs = false } = {}) {
  const info = {};
  const b = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (b) info.branch = b.trim();
  const d = git(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (d) info.defaultBranch = d.trim().replace(/^origin\//, '');
  if (budget && baseSha) {
    const num = git(cwd, ['diff', '--numstat', baseSha]);
    const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard']);
    if (num !== null && untracked !== null) {
      let files = 0;
      let loc = 0;
      for (const line of num.split('\n').filter(Boolean)) {
        const [a, d2, ...p] = line.split('\t');
        if (p.join('\t').startsWith('.qsdlc/')) continue;
        files++;
        loc += (Number(a) || 0) + (Number(d2) || 0);
      }
      for (const f of untracked.split('\n').filter(Boolean)) {
        if (f.startsWith('.qsdlc/')) continue;
        files++;
        try {
          const st = fs.statSync(path.join(cwd, f));
          if (st.size < 1048576) loc += fs.readFileSync(path.join(cwd, f), 'utf8').split('\n').length;
        } catch { /* unreadable file counts as one file, zero lines */ }
      }
      info.budget = { files, loc };
    }
  }
  if (prs) {
    const r = spawnSync('gh', ['pr', 'list', '--label', 'qsdlc-auto', '--state', 'open', '--json', 'number'], { cwd, encoding: 'utf8', windowsHide: true });
    if (r.status === 0) {
      try { const arr = JSON.parse(r.stdout); if (Array.isArray(arr)) info.openAutoPrs = arr.length; } catch { /* leave unknown */ }
    }
  }
  return info;
}

export function hookJson(r) {
  const out = { hookEventName: 'PreToolUse', permissionDecision: r.decision, permissionDecisionReason: r.reason };
  if (r.updatedInput) out.updatedInput = r.updatedInput;
  return { hookSpecificOutput: out };
}

function logDecision(root, runId, mode, toolName, r) {
  if (mode !== 'autonomous' || r.decision === 'allow') return;
  try {
    const dir = path.join(root, '.qsdlc', 'factory', 'state');
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), run_id: runId || 'adhoc', tool: toolName, decision: r.decision, reason: r.reason });
    fs.appendFileSync(path.join(dir, `guard-${String(runId || 'adhoc').replace(/[^A-Za-z0-9._-]/g, '_')}.log`), `${line}\n`);
  } catch { /* logging is best effort */ }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true;
    else { out[k] = n; i++; }
  }
  return out;
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

export function main(argv, stdinText) {
  const a = parseArgs(argv);
  const env = { ...process.env };
  if (a.worktree) env.QSDLC_WORKTREE = String(a.worktree);
  if (a['base-sha']) env.QSDLC_BASE_SHA = String(a['base-sha']);
  if (a['run-id']) env.QSDLC_RUN_ID = String(a['run-id']);
  const cliMode = Boolean(a.tool || a['budget-check']);
  let toolName = a.tool || '';
  let toolInput = {};
  let cwd = a.cwd ? path.resolve(String(a.cwd)) : process.cwd();
  let mode = String(a.mode || env.QSDLC_MODE || 'interactive').toLowerCase();
  if (mode !== 'autonomous') mode = 'interactive';

  if (!cliMode) {
    let payload;
    try { payload = JSON.parse(stdinText ?? readStdin()); } catch {
      const r = mode === 'autonomous' ? res('deny', 'Hook payload was not valid JSON. Failing closed.') : null;
      if (r) process.stdout.write(`${JSON.stringify(hookJson(r))}\n`);
      return 0;
    }
    toolName = payload.tool_name || '';
    toolInput = payload.tool_input || {};
    if (payload.cwd) cwd = payload.cwd;
  } else {
    if (a.command) toolInput.command = String(a.command);
    if (a['file-path']) toolInput.file_path = String(a['file-path']);
  }

  const { policy, root } = loadPolicy(cwd, a.root ? path.resolve(String(a.root)) : undefined);
  const command = String(toolInput.command ?? '');
  const wantsBudget = a['budget-check'] || (mode === 'autonomous' && /\bgit\b[^|;&]*\bpush\b|\bgh\s+pr\s+create\b/.test(command));
  const wantsPrs = a['budget-check'] || /\bgh\s+pr\s+create\b/.test(command);
  const gitInfo = collectGitInfo(cwd, { baseSha: env.QSDLC_BASE_SHA, budget: Boolean(wantsBudget), prs: Boolean(wantsPrs) });

  if (a['budget-check']) {
    if (!policy) { process.stdout.write(`${JSON.stringify({ ok: false, reasons: ['policy.md missing or unreadable (fail closed)'] })}\n`); return 2; }
    const r = checkBudget(policy, gitInfo, { pr: true });
    process.stdout.write(`${JSON.stringify({ ...r, observed: { budget: gitInfo.budget ?? null, openAutoPrs: gitInfo.openAutoPrs ?? null } })}\n`);
    return r.ok ? 0 : 2;
  }

  const r = evaluate({ toolName, toolInput, cwd, mode, policy, env, gitInfo, root });
  logDecision(root, env.QSDLC_RUN_ID, mode, toolName, r);
  if (cliMode) {
    process.stdout.write(`${JSON.stringify(hookJson(r))}\n`);
    return r.decision === 'allow' ? 0 : r.decision === 'deny' ? 2 : 3;
  }
  // Hook mode: a plain allow prints nothing so the user's normal permission rules still apply.
  if (r.decision !== 'allow' || r.updatedInput) process.stdout.write(`${JSON.stringify(hookJson(r))}\n`);
  return 0;
}

// ---------- self test ----------

function selfTest() {
  let passed = 0;
  let failed = 0;
  const check = (name, cond, detail = '') => {
    if (cond) { passed++; console.log(`PASS ${name}`); } else { failed++; console.log(`FAIL ${name} ${detail}`); }
  };
  const policy = {
    protected_paths: ['src/**/billing/**', '**/migrations/**', 'src/auth/**'],
    autonomous: { grants: ['commit_branch', 'push_branch', 'open_draft_pr'], max_files: 12, max_changed_loc: 500, max_open_auto_prs: 3, protected_path_outcome: 'needs-review' },
  };
  const wt = '/work/wt';
  const aEnv = { QSDLC_WORKTREE: wt, QSDLC_RUN_ID: '2026-11-18-queue-drain-001' };
  const goodGit = { branch: 'qsdlc/auto/t-1-2026-11-18', defaultBranch: 'main', budget: { files: 3, loc: 40 }, openAutoPrs: 1 };
  const base = { cwd: wt, root: wt, policy, env: aEnv, gitInfo: goodGit };
  const bash = (command, extra = {}) => evaluate({ ...base, toolName: 'Bash', toolInput: { command }, mode: 'autonomous', ...extra });
  const file = (tool, p, extra = {}) => evaluate({ ...base, toolName: tool, toolInput: { file_path: p }, mode: 'autonomous', ...extra });
  const is = (name, r, decision, needle) => check(name, r.decision === decision && (!needle || r.reason.includes(needle) || JSON.stringify(r.updatedInput || {}).includes(needle)), `got ${r.decision}: ${r.reason}`);

  is('autonomous ls allowed', bash('ls -la'), 'allow');
  is('autonomous npm test allowed', bash('npm test'), 'allow');
  is('interactive ls allowed', bash('ls', { mode: 'interactive' }), 'allow');
  is('git commit message containing rm -rf is allowed', bash('git commit -m "rm -rf later"'), 'allow');
  const sd = bash('rm -rf build/old');
  is('rm -rf rewritten to soft-delete', sd, 'allow', '.qsdlc/archive/2026-11-18-queue-drain-001');
  check('soft-delete uses mv and mkdir -p', sd.updatedInput && /mkdir -p/.test(sd.updatedInput.command) && /mv -- "build\/old"/.test(sd.updatedInput.command), JSON.stringify(sd.updatedInput));
  const plain = bash('rm notes.txt');
  check('plain rm in autonomous also soft-deleted', plain.decision === 'allow' && plain.updatedInput && /mv --/.test(plain.updatedInput.command));
  const nm = bash('rm -rf node_modules');
  check('rm -rf node_modules allowed without rewrite', nm.decision === 'allow' && !nm.updatedInput);
  is('rm -rf node_modules allowed in interactive', bash('rm -rf node_modules', { mode: 'interactive' }), 'allow');
  is('rm -rf src asks in interactive', bash('rm -rf src', { mode: 'interactive' }), 'ask');
  is('rm -rf glob denied in autonomous', bash('rm -rf src/*'), 'deny', 'explicit paths');
  is('rm -rf / denied in autonomous', bash('rm -rf /'), 'deny');
  is('rm outside worktree denied', bash('rm -rf /etc/hosts.d'), 'deny', 'outside the run worktree');
  is('git push --force denied in autonomous', bash('git push --force origin qsdlc/auto/x'), 'deny', 'force');
  is('git push --force asks in interactive', bash('git push --force origin feature', { mode: 'interactive' }), 'ask');
  is('git reset --hard denied in autonomous', bash('git reset --hard HEAD~1'), 'deny', 'git stash');
  is('git reset --hard asks in interactive', bash('git reset --hard', { mode: 'interactive' }), 'ask');
  is('gh pr create without --draft denied', bash('gh pr create --title x --body y'), 'deny', '--draft');
  is('gh pr create --draft allowed', bash('gh pr create --draft --title x'), 'allow');
  is('gh pr create denied at PR cap', bash('gh pr create --draft', { gitInfo: { ...goodGit, openAutoPrs: 3 } }), 'deny', 'max_open_auto_prs');
  is('gh pr create fails closed when gh count unknown', bash('gh pr create --draft', { gitInfo: { ...goodGit, openAutoPrs: undefined } }), 'deny', 'fail closed');
  is('gh pr create denied without open_draft_pr grant', bash('gh pr create --draft', { policy: { ...policy, autonomous: { ...policy.autonomous, grants: ['push_branch'] } } }), 'deny', 'open_draft_pr');
  is('gh pr merge denied', bash('gh pr merge 12 --squash'), 'deny', 'never merge');
  is('gh pr ready denied', bash('gh pr ready 12'), 'deny');
  is('gh pr merge allowed in interactive', bash('gh pr merge 12', { mode: 'interactive' }), 'allow');
  is('git push to main denied', bash('git push origin main'), 'deny', 'main');
  is('git push HEAD:main denied', bash('git push origin HEAD:main'), 'deny', 'main');
  is('git push run branch allowed', bash('git push -u origin qsdlc/auto/t-1-2026-11-18'), 'allow');
  is('git push bare on run branch allowed', bash('git push'), 'allow');
  is('git push from non-auto branch denied', bash('git push', { gitInfo: { ...goodGit, branch: 'feature/x' } }), 'deny', 'not under qsdlc/auto/');
  is('git push without push_branch grant denied', bash('git push', { policy: { ...policy, autonomous: { ...policy.autonomous, grants: [] } } }), 'deny', 'push_branch');
  is('git push over max_files denied', bash('git push', { gitInfo: { ...goodGit, budget: { files: 15, loc: 40 } } }), 'deny', 'max_files 12 exceeded (observed 15)');
  is('git push over max_changed_loc denied', bash('git push', { gitInfo: { ...goodGit, budget: { files: 3, loc: 900 } } }), 'deny', 'max_changed_loc');
  is('git push with unknown budget fails closed', bash('git push', { gitInfo: { ...goodGit, budget: undefined } }), 'deny', 'fail closed');
  is('git merge on main denied', bash('git merge feature', { gitInfo: { ...goodGit, branch: 'main' } }), 'deny');
  is('git merge on run branch allowed', bash('git merge main'), 'allow');
  is('git commit on main denied', bash('git commit -m x', { gitInfo: { ...goodGit, branch: 'main' } }), 'deny');
  is('npm publish denied in autonomous', bash('npm publish'), 'deny', 'publish');
  is('terraform apply denied in autonomous', bash('terraform apply -auto-approve'), 'deny');
  is('npm publish allowed in interactive', bash('npm publish', { mode: 'interactive' }), 'allow');
  is('wrapped bash -c force push denied', bash('bash -c "git push --force"'), 'deny');
  is('DROP TABLE denied in autonomous', bash('psql -c "DROP TABLE users"'), 'deny');
  is('DROP TABLE asks in interactive', bash('psql -c "DROP TABLE users"', { mode: 'interactive' }), 'ask');
  is('PowerShell Remove-Item -Recurse denied', evaluate({ ...base, toolName: 'PowerShell', toolInput: { command: 'Remove-Item -Recurse -Force src\\old' }, mode: 'autonomous' }), 'deny', 'Move-Item');
  is('PowerShell Get-ChildItem allowed', evaluate({ ...base, toolName: 'PowerShell', toolInput: { command: 'Get-ChildItem src' }, mode: 'autonomous' }), 'allow');
  is('write inside worktree allowed', file('Write', '/work/wt/src/a.js'), 'allow');
  is('relative write inside worktree allowed', file('Edit', 'src/a.js'), 'allow');
  is('write outside worktree denied', file('Write', '/work/other/a.js'), 'deny', 'outside the run worktree');
  is('worktree fence also applies in interactive', file('Write', '/work/other/a.js', { mode: 'interactive' }), 'deny');
  is('dot-dot escape denied', file('Edit', '/work/wt/../other/a.js'), 'deny');
  is('NotebookEdit outside worktree denied', evaluate({ ...base, toolName: 'NotebookEdit', toolInput: { notebook_path: '/elsewhere/n.ipynb' }, mode: 'autonomous' }), 'deny');
  const winEnv = { QSDLC_WORKTREE: 'C:\\proj\\wt', QSDLC_RUN_ID: 'r' };
  const winBase = { ...base, cwd: 'C:\\proj\\wt', root: 'C:\\proj\\wt', env: winEnv };
  is('Windows backslash path inside worktree allowed', evaluate({ ...winBase, toolName: 'Write', toolInput: { file_path: 'C:\\proj\\wt\\src\\a.js' }, mode: 'autonomous' }), 'allow');
  is('Windows backslash dot-dot escape denied', evaluate({ ...winBase, toolName: 'Write', toolInput: { file_path: 'C:\\proj\\wt\\..\\other\\a.js' }, mode: 'autonomous' }), 'deny');
  is('Windows drive letter case-insensitive', evaluate({ ...winBase, toolName: 'Write', toolInput: { file_path: 'c:\\PROJ\\wt\\src\\a.js' }, mode: 'autonomous' }), 'allow');
  is('writes into .git denied', file('Write', '/work/wt/.git/config'), 'deny', '.git');
  is('protected path denied in autonomous', file('Write', '/work/wt/src/billing/calc.js'), 'deny', 'Protected path');
  is('protected path allowed with QSDLC_RISK=protected', file('Write', '/work/wt/src/billing/calc.js', { env: { ...aEnv, QSDLC_RISK: 'protected' } }), 'allow');
  is('protected path denied when outcome is not needs-review', file('Write', '/work/wt/src/auth/login.js', { env: { ...aEnv, QSDLC_RISK: 'protected' }, policy: { ...policy, autonomous: { ...policy.autonomous, protected_path_outcome: 'done' } } }), 'deny');
  is('migrations glob protected', file('Write', '/work/wt/db/migrations/001.sql'), 'deny');
  is('protected path not enforced in interactive', file('Write', '/work/wt/src/billing/calc.js', { mode: 'interactive' }), 'allow');
  is('policy.md edit denied in autonomous', file('Edit', '/work/wt/.qsdlc/factory/policy.md'), 'deny', 'human-owned');
  is('corrections.tsv edit denied in interactive', file('Write', '/work/wt/.qsdlc/factory/corrections.tsv', { mode: 'interactive' }), 'deny', 'qsdlc-log.mjs');
  is('rules.md edit denied', file('Write', '/work/wt/.qsdlc/factory/rules.md'), 'deny', 'qsdlc-log.mjs');
  is('runs tsv edit denied', file('Edit', '/work/wt/.qsdlc/factory/runs/2026-11-18-x-001.tsv'), 'deny', 'qsdlc-log.mjs');
  is('missing policy fails closed in autonomous', bash('ls', { policy: null }), 'deny', 'Failing closed');
  is('missing policy fine in interactive', bash('ls', { policy: null, mode: 'interactive' }), 'allow');
  is('unrelated tool allowed', evaluate({ ...base, toolName: 'Read', toolInput: { file_path: '/anywhere' }, mode: 'autonomous' }), 'allow');
  check('budget-check passes within limits', checkBudget(policy, goodGit, { pr: true }).ok);
  check('budget-check reports every breach', checkBudget(policy, { budget: { files: 99, loc: 9999 }, openAutoPrs: 5 }, { pr: true }).reasons.length === 3);
  check('globToRegExp ** crosses directories', globToRegExp('src/**/billing/**').test('src/a/b/billing/x.js') && globToRegExp('src/**/billing/**').test('src/billing/x.js'));
  check('globToRegExp * stays in one segment', !globToRegExp('src/*.js').test('src/a/b.js') && globToRegExp('src/*.js').test('src/b.js'));
  const y = parseYamlLite('schema: 1\nprotected_paths:\n  - "src/**/billing/**"   # money\n  - migrations/**\nautonomous:\n  grants: [push_branch, open_draft_pr]\n  max_files: 12\n  delete: soft\nconstitution:\n- "No PII: ever"\n');
  check('yaml-lite parses nested maps and lists', y.schema === 1 && y.protected_paths[0] === 'src/**/billing/**' && y.protected_paths.length === 2 && y.autonomous.grants[1] === 'open_draft_pr' && y.autonomous.max_files === 12 && y.constitution[0] === 'No PII: ever', JSON.stringify(y));
  const fm = parseFrontmatter('---\nautonomous:\n  max_files: 5\n---\n# body\n');
  check('frontmatter extraction', fm.autonomous.max_files === 5);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-check-'));
  try {
    fs.mkdirSync(path.join(tmp, '.qsdlc', 'factory'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.qsdlc', 'factory', 'policy.md'), '---\nautonomous:\n  max_files: 5\n  grants: [push_branch]\n---\n');
    check('loadPolicy reads policy.md', loadPolicy(tmp).policy.autonomous.max_files === 5);
    check('loadPolicy walks up from a subdirectory', (() => { fs.mkdirSync(path.join(tmp, 'a', 'b'), { recursive: true }); return loadPolicy(path.join(tmp, 'a', 'b')).policy !== null; })());
    check('loadPolicy returns null when absent', loadPolicy(os.tmpdir(), path.join(tmp, 'nope')).policy === null);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${passed} passed, ${failed} failed`);
  return failed === 0 ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--self-test')) process.exit(selfTest());
  else process.exit(main(process.argv.slice(2)));
}
