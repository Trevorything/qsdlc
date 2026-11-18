#!/usr/bin/env node
// inline.mjs — inline the kit, the diagram engine and optional html-motion engines into one artifact.
//
//   node inline.mjs page.html [kit] [diagram] [engine ...] [--render] [--budget 400] [--list]
//
//   kit       assets/kit/kit.css (as <style>) + assets/kit/kit.js
//   diagram   assets/kit/diagram.js  (Diagram.layout / Diagram.svg, replaces external Mermaid)
//   <engine>  any html-motion engine by name (streams, graph, expand, pullback, split, transform,
//             morph, shader, terrain); ../html-motion/assets/engines/_core.js is added automatically
//   --render  pre-render <script type="application/json" data-chart="bar|stacked|strip|slope|spark|bullet|heatmap|waterfall">
//             and <script type="application/json" data-diagram> into static markup, so charts and diagrams show
//             with JavaScript off and offline. The data script stays in place; the render sits right after it.
//   --list    print what can be inlined and exit
//   --budget  size budget in KB for the resulting file (default 400); exit 1 when exceeded
//
// The block lives between <!-- qsdlc-present:start --> and <!-- qsdlc-present:end -->. Re-running replaces it
// (idempotent). With no markers the block is inserted before </body>.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT_DIR = path.join(HERE, '..', 'assets', 'kit');
const ENGINE_DIR = path.join(HERE, '..', '..', 'html-motion', 'assets', 'engines');
export const START = '<!-- qsdlc-present:start -->';
export const END = '<!-- qsdlc-present:end -->';
const require = createRequire(import.meta.url);

export function listEngines() {
  try { const j = JSON.parse(fs.readFileSync(path.join(ENGINE_DIR, 'index.json'), 'utf8')); return (j.engines || j).map((e) => ({ name: e.name, file: e.file || e.name + '.js', shows: e.shows })); }
  catch { return fs.existsSync(ENGINE_DIR) ? fs.readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.js') && f !== '_core.js').map((f) => ({ name: f.replace(/\.js$/, ''), file: f })) : []; }
}
const safeScript = (s) => s.replace(/<\/script/gi, '<\\/script');
const safeStyle = (s) => s.replace(/<\/style/gi, '<\\/style');
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n\/\/# sourceMappingURL=.*$/m, '').trimEnd();

export function buildBlock(names) {
  const engines = listEngines(); const known = new Set(engines.map((e) => e.name));
  const parts = []; const css = []; const js = [];
  const want = new Set(names);
  for (const n of want) if (!['kit', 'diagram'].includes(n) && !known.has(n)) throw new Error(`unknown module "${n}". Known: kit, diagram, ${[...known].join(', ')}`);
  if (want.has('kit')) { css.push(`/* qsdlc-present: kit.css */\n${read(path.join(KIT_DIR, 'kit.css'))}`); js.push(`/* qsdlc-present: kit.js */\n${read(path.join(KIT_DIR, 'kit.js'))}`); }
  if (want.has('diagram')) js.push(`/* qsdlc-present: diagram.js */\n${read(path.join(KIT_DIR, 'diagram.js'))}`);
  const chosen = engines.filter((e) => want.has(e.name));
  if (chosen.length) {
    js.push(`/* html-motion: _core.js */\n${read(path.join(ENGINE_DIR, '_core.js'))}`);
    for (const e of chosen) js.push(`/* html-motion: ${e.file} */\n${read(path.join(ENGINE_DIR, e.file))}`);
  }
  if (css.length) parts.push(`<style>\n${safeStyle(css.join('\n'))}\n</style>`);
  if (js.length) parts.push(`<script>\n${safeScript(js.join('\n'))}\n</script>`);
  return `${START}\n${parts.join('\n')}\n${END}`;
}

export function applyBlock(html, block) {
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (re.test(html)) return html.replace(re, () => block);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, () => `${block}\n</body>`);
  return html + '\n' + block + '\n';
}

const RENDER_RE = /\n?<!-- qsdlc-present:render -->[\s\S]*?<!-- \/qsdlc-present:render -->\n?/g;
export function renderStatic(html) {
  const Kit = require(path.join(KIT_DIR, 'kit.js')); const Diagram = require(path.join(KIT_DIR, 'diagram.js'));
  let n = 0;
  html = html.replace(RENDER_RE, '');
  // one pass over comments and script elements, so text that merely *mentions* a data-chart script (in a comment, or in the inlined kit source) is never touched
  html = html.replace(/<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
    if (m.startsWith('<!--') || !/\btype\s*=\s*["']application\/json["']/i.test(attrs)) return m;
    const chart = /data-chart\s*=\s*["'](\w+)["']/i.exec(attrs); const diag = /\bdata-diagram\b/i.test(attrs);
    if (!chart && !diag) return m;
    let spec; try { spec = JSON.parse(body); } catch (e) { throw new Error(`embedded JSON for ${chart ? 'data-chart="' + chart[1] + '"' : 'data-diagram'} does not parse: ${e.message}`); }
    const svg = chart ? Kit.chart.svg(chart[1], spec) : Diagram.svg(spec);
    n++;
    // data-mounted is the attribute Kit.chart.mount / Diagram.mount already honour, so the runtime never renders twice
    const tagged = /data-mounted/.test(attrs) ? m : m.replace('<script', '<script data-mounted="1"');
    return `${tagged}\n<!-- qsdlc-present:render -->\n${svg}\n<!-- /qsdlc-present:render -->\n`;
  });
  return { html, rendered: n };
}

function parseArgs(argv) { const o = { _: [] }; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (['render', 'list', 'help'].includes(k)) o[k] = true; else o[k] = argv[++i]; } else o._.push(a); } return o; }
function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.list) {
    console.log('kit       kit.css + kit.js (reveal, draw, grow, count, flow, scrub, chart.*)');
    console.log('diagram   diagram.js (Diagram.layout / Diagram.svg)');
    for (const e of listEngines()) console.log(`${e.name.padEnd(9)} html-motion engine${e.shows ? ': ' + e.shows : ''}`);
    return;
  }
  if (a.help || !a._.length) { console.error('usage: node inline.mjs page.html [kit] [diagram] [engine ...] [--render] [--budget 400] [--list]'); process.exit(a.help ? 0 : 2); }
  const [page, ...names] = a._;
  try {
    let html = fs.readFileSync(page, 'utf8');
    if (names.length) html = applyBlock(html, buildBlock(names));
    let rendered = 0; if (a.render) { const r = renderStatic(html); html = r.html; rendered = r.rendered; }
    const kb = Buffer.byteLength(html) / 1024; const budget = Number(a.budget || 400);
    fs.writeFileSync(page, html);
    console.error(`inline: ${page} · ${names.length ? 'inlined ' + names.join(', ') : 'no modules'}${a.render ? ` · pre-rendered ${rendered}` : ''} · ${kb.toFixed(1)} KB`);
    if (kb > budget) { console.error(`inline: OVER BUDGET ${kb.toFixed(1)} KB > ${budget} KB`); process.exit(1); }
  } catch (e) { console.error('inline: ' + e.message); process.exit(2); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
