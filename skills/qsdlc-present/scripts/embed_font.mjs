#!/usr/bin/env node
// embed_font.mjs — base64-embed a LOCAL font file as @font-face. No network, no npm, no CDN.
//
//   node embed_font.mjs page.html --file ./Brand.woff2 --family "Brand Sans" [--weight 400] [--style normal]
//                       [--variable "100 900"] [--display swap] [--print]
//
// - Refuses http(s):// and protocol-relative paths: fonts must already be in the product repo.
// - Warns above 150 KB (an artifact should stay light); refuses above --max-kb (default 600).
// - Idempotent: faces live between <!-- qsdlc-present:fonts:start --> and <!-- qsdlc-present:fonts:end -->,
//   one face per family|weight|style key. Re-running replaces that face.
// - Reminds you to give the family a fallback stack in your tokens, e.g. --font-sans: "Brand Sans", <system stack>.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const START = '<!-- qsdlc-present:fonts:start -->';
const END = '<!-- qsdlc-present:fonts:end -->';
const MIME = { '.woff2': ['font/woff2', 'woff2'], '.woff': ['font/woff', 'woff'], '.ttf': ['font/ttf', 'truetype'], '.otf': ['font/otf', 'opentype'] };

export function buildFace({ file, family, weight = '400', style = 'normal', variable, display = 'swap', maxKb = 600 }) {
  if (/^(https?:)?\/\//i.test(file) || /^[a-z][a-z0-9+.-]*:\/\//i.test(file)) throw new Error(`refusing remote font "${file}": download it into the product repo first, then pass the local path`);
  const ext = path.extname(file).toLowerCase();
  if (!MIME[ext]) throw new Error(`unsupported font type "${ext}" (use .woff2, .woff, .ttf, .otf)`);
  if (!fs.existsSync(file)) throw new Error(`font file not found: ${file}`);
  const buf = fs.readFileSync(file); const kb = buf.length / 1024;
  if (kb > maxKb) throw new Error(`font is ${kb.toFixed(0)} KB, over --max-kb ${maxKb}; subset it first`);
  const [mime, fmt] = MIME[ext];
  const key = `${family}|${variable || weight}|${style}`;
  const css = `/* font:${key} (${kb.toFixed(0)} KB, ${path.basename(file)}) */\n@font-face{font-family:"${family.replace(/"/g, '')}";font-style:${style};font-weight:${variable || weight};font-display:${display};src:url(data:${mime};base64,${buf.toString('base64')}) format("${fmt}");}`;
  return { key, css, kb, warn: kb > 150 ? `font is ${kb.toFixed(0)} KB (over 150 KB); consider subsetting` : null };
}

export function applyFace(html, face) {
  const re = new RegExp(`${START}\\s*<style>([\\s\\S]*?)</style>\\s*${END}`);
  const m = re.exec(html);
  let faces = m ? m[1].split(/\n(?=\/\* font:)/).map((s) => s.trim()).filter(Boolean) : [];
  faces = faces.filter((f) => !f.startsWith(`/* font:${face.key} `));
  faces.push(face.css);
  const block = `${START}\n<style>\n${faces.join('\n')}\n</style>\n${END}`;
  if (m) return html.replace(re, () => block);
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, () => `${block}\n</head>`);
  return block + '\n' + html;
}

function parseArgs(argv) { const o = { _: [] }; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase()); if (['print', 'help'].includes(k)) o[k] = true; else o[k] = argv[++i]; } else o._.push(a); } return o; }
function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || !a.file || !a.family || (!a._.length && !a.print)) { console.error('usage: node embed_font.mjs page.html --file <local font> --family "Name" [--weight 400] [--style normal] [--variable "100 900"] [--display swap] [--max-kb 600] [--print]'); process.exit(a.help ? 0 : 2); }
  try {
    const face = buildFace({ file: a.file, family: a.family, weight: a.weight, style: a.style, variable: a.variable, display: a.display, maxKb: a.maxKb ? Number(a.maxKb) : 600 });
    if (face.warn) console.error('embed_font: WARN ' + face.warn);
    if (a.print) { process.stdout.write(face.css + '\n'); return; }
    const page = a._[0]; const html = fs.readFileSync(page, 'utf8'); const out = applyFace(html, face);
    fs.writeFileSync(page, out);
    console.error(`embed_font: embedded ${face.key} (${face.kb.toFixed(0)} KB) into ${page}. Give "${a.family}" a fallback stack in your tokens and check numerals at display size.`);
  } catch (e) { console.error('embed_font: ' + e.message); process.exit(2); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
