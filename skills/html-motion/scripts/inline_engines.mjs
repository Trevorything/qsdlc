#!/usr/bin/env node
// Inline html-motion engines into an HTML page. Zero dependencies, Node >= 18, cross-platform.
//   node inline_engines.mjs --list
//   node inline_engines.mjs page.html shader streams [--out other.html]
//   node inline_engines.mjs --update-index          (refresh byte sizes in assets/engines/index.json)
// Writes one <script> block (core + the named engines, in index.json order) between
//   <!-- html-motion:start ... -->  and  <!-- html-motion:end -->
// First run inserts it before the page's last <script> (else before </body>, else at the end). Re-running with a
// new list replaces the block, so the command is idempotent. Exit codes: 0 ok, 2 usage / unknown engine / IO error.
// Same behaviour as inline_engines.py.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'engines');
const indexPath = join(dir, 'index.json');
const START = '<!-- html-motion:start', END = '<!-- html-motion:end -->';
const die = (m) => { console.error('inline_engines: ' + m); process.exit(2); };
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const names = index.engines.map((e) => e.name);

function list() {
  console.log('core\t' + index.core.file + '\talways included');
  for (const e of index.engines) console.log(`${e.name}\t${e.cost}\t${e.pure ? 'pure' : 'stateful'}\t${e.shows}`);
}

function updateIndex() {
  index.core.bytes = readFileSync(join(dir, index.core.file)).length;
  for (const e of index.engines) e.bytes = readFileSync(join(dir, e.file)).length;
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
  console.log('index.json updated: core ' + index.core.bytes + ' B, ' + index.engines.map((e) => e.name + ' ' + e.bytes).join(', '));
}

function block(chosen) {
  const parts = [index.core.file, ...index.engines.filter((e) => chosen.includes(e.name)).map((e) => e.file)];
  const code = parts.map((f) => `/* ---- ${f} ---- */\n` + readFileSync(join(dir, f), 'utf8').trimEnd()).join('\n');
  if (/<\/script/i.test(code)) die('engine source contains </script');
  return `${START} engines=${chosen.join(',') || 'none'} -->\n<script>\n${code}\n</script>\n${END}`;
}

function inject(html, blk) {
  const a = html.indexOf(START);
  if (a !== -1) {
    const b = html.indexOf(END, a);
    if (b === -1) die('found start marker without end marker');
    return html.slice(0, a) + blk + html.slice(b + END.length);
  }
  const last = html.toLowerCase().lastIndexOf('<script');
  if (last !== -1) return html.slice(0, last) + blk + '\n' + html.slice(last);
  const body = html.toLowerCase().lastIndexOf('</body>');
  if (body !== -1) return html.slice(0, body) + blk + '\n' + html.slice(body);
  return html + '\n' + blk + '\n';
}

const argv = process.argv.slice(2);
if (argv.includes('--list')) { list(); process.exit(0); }
if (argv.includes('--update-index')) { updateIndex(); process.exit(0); }
if (!argv.length || argv.includes('-h') || argv.includes('--help')) {
  console.error('usage: inline_engines.mjs --list | --update-index | page.html engine [engine ...] [--out file]');
  process.exit(argv.length ? 0 : 2);
}
let out = null; const pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--out') out = argv[++i]; else pos.push(argv[i]); }
const [page, ...want] = pos;
if (!page || !existsSync(page)) die('page not found: ' + page);
const bad = want.filter((n) => !names.includes(n));
if (bad.length) die(`unknown engine${bad.length > 1 ? 's' : ''}: ${bad.join(', ')} (known: ${names.join(', ')})`);
const chosen = names.filter((n) => want.includes(n));
const html = readFileSync(page, 'utf8');
const next = inject(html, block(chosen));
writeFileSync(out || page, next);
console.log(`inlined core + ${chosen.join(', ') || '(no engines)'} into ${out || page} (${next.length - html.length >= 0 ? '+' : ''}${next.length - html.length} chars)`);
