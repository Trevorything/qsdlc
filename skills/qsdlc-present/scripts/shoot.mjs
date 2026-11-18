#!/usr/bin/env node
// shoot.mjs — render an artifact and gate it. Needs Playwright (imported dynamically; never a hard dependency).
//
//   node shoot.mjs <artifact.html> [--out dir] [--themes auto|both|dark|light] [--times 0.05,0.5,1.0]
//                  [--sizes 1440x900,390x844] [--json]
//
// What it does (and only reports what it actually rendered):
//   1. frames at ?t=<each time>&freeze=1, every size, every colour scheme  -> PNGs in --out
//   2. console errors/warnings and uncaught page errors                     -> fail
//   3. horizontal overflow (scrollWidth > innerWidth) at every size         -> fail
//   4. prefers-reduced-motion: every [data-reveal] fully visible, canvases not blank -> fail
//   5. JavaScript disabled: content and every [data-reveal] still visible    -> fail
//   6. network blocked: any request that is not file:/data:/about: is a leak -> fail
//   7. section heights vs viewport (flags a section 1-24 px shy of the viewport) -> warn
// Exit: 0 pass · 1 failures · 2 usage · 4 Playwright/browser not found (prints the manual Browser-pane steps).
// Then a human step remains: open the PNGs and look at them. Never describe a render you have not seen.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

async function findPlaywright() {
  const tried = [];
  const attempt = async (spec, label) => { try { const m = await import(spec); const pw = m.chromium ? m : m.default; if (pw && pw.chromium) return pw; } catch { tried.push(label); } return null; };
  let pw = await attempt('playwright', 'import playwright');
  if (pw) return { pw, tried };
  const dirs = [];
  if (process.env.PLAYWRIGHT_PATH) dirs.push(process.env.PLAYWRIGHT_PATH);
  try { dirs.push(path.join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright')); } catch { /* npm absent */ }
  const npxRoots = [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'), path.join(os.homedir(), '.npm', '_npx')].filter(Boolean);
  for (const r of npxRoots) { try { for (const d of fs.readdirSync(r)) dirs.push(path.join(r, d, 'node_modules', 'playwright')); } catch { /* no cache */ } }
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    try { const pkg = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')); const entry = path.join(d, typeof pkg.main === 'string' ? pkg.main : 'index.js'); const m = await import(pathToFileURL(entry).href); const p = m.chromium ? m : m.default; if (p && p.chromium) return { pw: p, tried }; } catch { tried.push(d); }
  }
  return { pw: null, tried };
}

/** Chromium executables Playwright has already downloaded, newest revision first. */
function installedChromiums() {
  const bases = [process.env.PLAYWRIGHT_BROWSERS_PATH, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'), path.join(os.homedir(), '.cache', 'ms-playwright'), path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')].filter(Boolean);
  const names = ['chrome-headless-shell.exe', 'chrome.exe', 'chrome-headless-shell', 'chrome', 'Chromium'];
  const found = [];
  const scan = (dir, depth) => { let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; } for (const e of es) { const f = path.join(dir, e.name); if (e.isDirectory() && depth < 4) scan(f, depth + 1); else if (e.isFile() && names.includes(e.name)) found.push(f); } };
  for (const b of bases) { let ds = []; try { ds = fs.readdirSync(b).filter((d) => /^chromium/.test(d)).sort().reverse(); } catch { continue; } for (const d of ds) scan(path.join(b, d), 0); }
  return found.sort((a, b) => (/headless/.test(b) ? 1 : 0) - (/headless/.test(a) ? 1 : 0));
}

const MANUAL = `Playwright was not found, so nothing was rendered. Do this by hand in the Browser pane (or any browser):
  1. open the file at file:///<path>?t=0.05&freeze=1 , then ?t=0.5 and ?t=1.0 at 1440x900 and again at 390x844
  2. repeat with the system in dark and in light mode (if the artifact supports both)
  3. turn on "reduce motion" (Windows: Settings > Accessibility > Visual effects > Animation effects off) and confirm a complete still page
  4. open DevTools: Console must be empty; Network must show no request that is not the file itself
  5. disable JavaScript: all content must still be readable
  6. check there is no horizontal scrollbar at 390 px
To install the runner: npx playwright install chromium   (then re-run this script)`;

function parseArgs(argv) { const o = { _: [] }; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (['json', 'help'].includes(k)) o[k] = true; else o[k] = argv[++i]; } else o._.push(a); } return o; }

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || !a._.length) { console.error('usage: node shoot.mjs <artifact.html> [--out dir] [--themes auto|both|dark|light] [--times 0.05,0.5,1.0] [--sizes 1440x900,390x844] [--json]'); process.exit(a.help ? 0 : 2); }
  const file = path.resolve(a._[0]);
  if (!fs.existsSync(file)) { console.error(`shoot: no such file ${file}`); process.exit(2); }
  const html = fs.readFileSync(file, 'utf8');
  const out = path.resolve(a.out || path.join(path.dirname(file), '.craft', 'shots'));
  const times = (a.times || '0.05,0.5,1.0').split(',').map((s) => s.trim()).filter(Boolean);
  const sizes = (a.sizes || '1440x900,390x844').split(',').map((s) => { const [w, h] = s.trim().split('x').map(Number); return { w, h }; });
  const themeMode = a.themes || 'auto';
  const themed = /prefers-color-scheme|data-theme/i.test(html);
  const schemes = themeMode === 'both' || (themeMode === 'auto' && themed) ? ['dark', 'light'] : themeMode === 'dark' ? ['dark'] : themeMode === 'light' ? ['light'] : ['light'];

  const { pw, tried } = await findPlaywright();
  if (!pw) { console.error(MANUAL); console.error(`(searched: ${tried.join(', ') || 'nothing resolvable'})`); process.exit(4); }
  let browser, launchNote = '';
  // software GL: WebGL pages render the same on every machine and headless Chromium does not drop the context at start-up
  const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  try { browser = await pw.chromium.launch({ headless: true, args: GL_ARGS }); }
  catch (e) {
    // the package may want a Chromium revision that is not installed; try any Playwright Chromium already on disk
    const firstErr = String(e.message).split('\n')[0];
    for (const exe of installedChromiums()) {
      try { browser = await pw.chromium.launch({ headless: true, executablePath: exe, args: GL_ARGS }); launchNote = `launched ${path.relative(os.homedir(), exe).replace(/\\/g, '/')} because the pinned revision is missing`; break; } catch { /* try the next one */ }
    }
    if (!browser) { console.error(`shoot: Playwright package found, but no Chromium would launch: ${firstErr}\n${MANUAL.replace('Playwright was not found, so nothing was rendered.', 'Nothing was rendered.')}`); process.exit(4); }
  }

  fs.mkdirSync(out, { recursive: true });
  const base = path.basename(file, path.extname(file));
  const url = pathToFileURL(file).href;
  const failures = [], warnings = [], frames = [], notes = [];
  const fail = (m) => failures.push(m), warn = (m) => warnings.push(m);

  const attachLogs = (page, label) => {
    page.on('console', (m) => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      const text = m.text();
      // Chromium prints GL driver performance hints (for example "GPU stall due to ReadPixels") when a screenshot reads a WebGL canvas back.
      // That comes from the harness, not the page: record it once as a note instead of failing the page.
      if (/GL Driver Message \(OpenGL, Performance/.test(text)) { if (!driverNoise) { driverNoise = true; notes.push('GL driver performance hint seen while capturing WebGL canvases (harness readback, not a page error)'); } return; }
      fail(`console ${m.type()} [${label}]: ${text.slice(0, 200)}`);
    });
    page.on('pageerror', (e) => fail(`uncaught error [${label}]: ${String(e.message).slice(0, 200)}`));
  };
  let driverNoise = false;
  const requiresJs = /<meta[^>]+name=["']requires-js["']/i.test(html);
  const leaks = new Set();
  const gate = async (ctx) => ctx.route('**/*', (route) => { const u = route.request().url(); if (/^(file|data|about|blob):/i.test(u)) return route.continue(); leaks.add(u); return route.abort(); });

  let withJsTextLen = 0;
  try {
    // 1-3, 7: frames, console, overflow, sections (JS on, network gated)
    for (const sz of sizes) for (const scheme of schemes) {
      const ctx = await browser.newContext({ viewport: { width: sz.w, height: sz.h }, colorScheme: scheme, deviceScaleFactor: 1 });
      await gate(ctx);
      const label = `${sz.w}x${sz.h} ${themed ? scheme : "default"}`;
      for (const t of times) {
        // a fresh page per frame: navigating one page away from live WebGL canvases makes Chromium log "context lost" for the old document
        const page = await ctx.newPage(); attachLogs(page, label);
        await page.goto(`${url}${url.includes('?') ? '&' : '?'}t=${t}&freeze=1`, { waitUntil: 'load' });
        await page.evaluate(() => (document.fonts && document.fonts.ready) || null).catch(() => {});
        await page.waitForTimeout(350);
        const name = `${base}-${sz.w}x${sz.h}-${themed || schemes.length > 1 ? scheme : "default"}-t${String(t).replace('.', '_')}.png`;
        await page.screenshot({ path: path.join(out, name), fullPage: true });
        frames.push(name);
        if (t === times[times.length - 1]) {
          const m = await page.evaluate((vh) => {
            const de = document.documentElement;
            const secs = [...document.querySelectorAll('section, main > *, article')].map((el) => ({ tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''), h: Math.round(el.getBoundingClientRect().height) })).filter((s) => s.h > 0);
            return { sw: de.scrollWidth, iw: window.innerWidth, text: (document.body.innerText || '').length, secs, vh };
          }, sz.h);
          if (m.sw > m.iw + 1) fail(`horizontal overflow at ${label}: scrollWidth ${m.sw} > innerWidth ${m.iw}`);
          for (const s of m.secs) if (s.h < sz.h && s.h >= sz.h - 24) warn(`section ${s.tag} is ${s.h}px in a ${sz.h}px viewport (tight; may clip its own heading)`);
          if (sz.w === sizes[0].w && scheme === schemes[0]) withJsTextLen = m.text;
        }
        await page.close();
      }
      await ctx.close();
    }

    // 4: reduced motion
    {
      const ctx = await browser.newContext({ viewport: { width: sizes[0].w, height: sizes[0].h }, reducedMotion: 'reduce', colorScheme: schemes[0] });
      await gate(ctx);
      const page = await ctx.newPage(); attachLogs(page, 'reduced-motion');
      await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const bad = []; document.querySelectorAll('[data-reveal]').forEach((el) => { const cs = getComputedStyle(el); if (parseFloat(cs.opacity) < 0.99 || cs.visibility === 'hidden') bad.push((el.id || el.className || el.tagName).toString().slice(0, 40)); });
        const blank = []; let unchecked = 0;
        document.querySelectorAll('canvas').forEach((c) => { const ctx2 = c.getContext('2d'); if (!ctx2) { unchecked++; return; } try { const d = ctx2.getImageData(0, 0, c.width, c.height).data; let any = false; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) { any = true; break; } if (!any) blank.push((c.id || 'canvas').slice(0, 30)); } catch { unchecked++; } });
        return { bad, blank, unchecked, canvases: document.querySelectorAll('canvas').length, reveal: document.querySelectorAll('[data-reveal]').length };
      });
      if (r.bad.length) fail(`reduced motion: ${r.bad.length} [data-reveal] element(s) not fully visible (${r.bad.slice(0, 3).join(', ')})`);
      if (r.blank.length) fail(`reduced motion: blank canvas final frame (${r.blank.join(', ')})`);
      notes.push(`reduced-motion: ${r.reveal} [data-reveal], ${r.canvases} canvas (${r.unchecked} WebGL/unreadable, unchecked)`);
      await ctx.close();
    }

    // 5: JavaScript disabled
    {
      const ctx = await browser.newContext({ viewport: { width: sizes[0].w, height: sizes[0].h }, javaScriptEnabled: false, colorScheme: schemes[0] });
      await gate(ctx);
      const page = await ctx.newPage(); await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(250);
      const textLen = await page.evaluate(() => (document.body.innerText || '').length);
      const hiddenReveal = await page.$$eval('[data-reveal]', (els) => els.filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99).length).catch(() => 0);
      await page.screenshot({ path: path.join(out, `${base}-nojs.png`), fullPage: true }); frames.push(`${base}-nojs.png`);
      if (hiddenReveal) fail(`JS disabled: ${hiddenReveal} [data-reveal] element(s) invisible`);
      if (requiresJs) { if (textLen < 120) fail(`JS disabled: page declares requires-js but its <noscript> fallback shows only ${textLen} characters; list what the page shows`); }
      else if (withJsTextLen && textLen < withJsTextLen * 0.6) fail(`JS disabled: only ${textLen} of ${withJsTextLen} characters of text visible (content depends on JS)`);
      notes.push(`no-js: ${textLen} characters visible (${withJsTextLen} with JS)`);
      await ctx.close();
    }
  } finally { await browser.close(); }

  for (const u of leaks) fail(`network leak: page requested ${u.slice(0, 120)} (artifact is not self-contained)`);
  const uniq = (arr) => [...new Set(arr)];
  const report = { file, out, frames, failures: uniq(failures), warnings: uniq(warnings), notes, schemes, sizes, times, pass: failures.length === 0 };
  fs.writeFileSync(path.join(out, `${base}-report.json`), JSON.stringify(report, null, 2));
  if (a.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`shoot: ${frames.length} frame(s) in ${out}`); if (launchNote) console.log('  note: ' + launchNote);
    notes.forEach((n) => console.log(`  note: ${n}`)); report.warnings.forEach((w) => console.log(`  WARN: ${w}`)); report.failures.forEach((f) => console.log(`  FAIL: ${f}`));
    console.log(report.pass ? 'shoot: PASS (now open the frames and look at them)' : `shoot: FAIL (${report.failures.length})`);
  }
  process.exit(report.pass ? 0 : 1);
}
main().catch((e) => { console.error('shoot: ' + (e && e.stack ? e.stack : e)); process.exit(2); });
