#!/usr/bin/env node
/**
 * Drive /batch-test headlessly over a folder of photos and print the
 * self-check: each photo's blur verdict and preview time, then every print
 * file's size and real dpi, flagged when the long edge is under 3000px.
 *
 *   npm run batch-test -- <photo-dir> [--out <dir>]
 *
 * Writes <out>/contact-sheet.png and <out>/results.json (out defaults to
 * <photo-dir>/batch-out). Exits 1 if any output is short or errored.
 *
 * The page works without this script: `npm run dev`, open /batch-test, pick
 * the photos, press Run. This exists so the same run is repeatable and its
 * numbers can be pasted, not paraphrased.
 *
 * It starts its OWN vite server on a free port and refuses a port that
 * already answers, so it can never be reading an older server's code. The
 * image path makes no network calls; the network column proves it.
 *
 * Needs Playwright with Chromium (not a project dependency):
 *   npm i --no-save playwright && npx playwright install chromium
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const photoDir = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
if (!photoDir) {
  console.error('usage: npm run batch-test -- <photo-dir> [--out <dir>]');
  process.exit(2);
}
const outDir = resolve(outIdx >= 0 ? args[outIdx + 1] : join(photoDir, 'batch-out'));
const photos = readdirSync(photoDir)
  .filter((f) => /\.(jpe?g|png|heic|webp)$/i.test(f))
  .sort()
  .map((f) => resolve(photoDir, f));
if (!photos.length) {
  console.error(`no photos in ${photoDir}`);
  process.exit(2);
}

// import() ignores NODE_PATH, require() honours it, and a machine-wide
// Playwright is often only reachable that way.
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    console.error('Playwright is not installed. Run: npm i --no-save playwright && npx playwright install chromium');
    process.exit(2);
  }
}

const freePort = () =>
  new Promise((res, rej) => {
    const s = createServer();
    s.once('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });

const answers = async (url) => {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
};

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
if (await answers(base)) {
  console.error(`port ${port} already answers; refusing to drive a server this script did not start`);
  process.exit(2);
}

// supabaseClient.ts throws at import without Supabase settings, which takes
// the whole page down with it. The pipeline never calls Supabase, so on a
// keyless machine hand vite a stub that cannot reach anything. A real .env
// always wins: nothing is stubbed when one defines the URL.
const envFiles = ['.env', '.env.local', '.env.development', '.env.development.local'];
const hasSupabase =
  !!process.env.VITE_SUPABASE_URL ||
  envFiles.some((f) => existsSync(join(ROOT, f)) && /^\s*VITE_SUPABASE_URL\s*=\s*\S/m.test(readFileSync(join(ROOT, f), 'utf8')));
const env = { ...process.env };
if (!hasSupabase) {
  env.VITE_SUPABASE_URL = 'http://127.0.0.1:9';
  env.VITE_SUPABASE_ANON_KEY = 'batch-test-stub';
  console.log('No Supabase settings found: stubbing them (the pipeline does not use Supabase).');
}

// vite directly, not through npx, so killing it kills the server itself.
const vite = spawn(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: ROOT,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let viteLog = '';
vite.stdout.on('data', (d) => (viteLog += d));
vite.stderr.on('data', (d) => (viteLog += d));

let browser;
let code = 0;
try {
  const deadline = Date.now() + 30_000;
  while (!(await answers(base))) {
    if (vite.exitCode !== null || Date.now() > deadline) throw new Error(`vite did not start:\n${viteLog}`);
    await new Promise((r) => setTimeout(r, 250));
  }

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  await page.goto(`${base}/batch-test`);
  await page.setInputFiles('[data-testid=batch-files]', photos);
  await page.click('[data-testid=batch-run]');

  // Bounded: about four minutes a photo is far beyond what a laptop needs,
  // and a wait with no bound is a hang that looks like a slow run.
  const budget = photos.length * 4 * 60_000;
  const started = Date.now();
  let last = '';
  for (;;) {
    const state = await page.evaluate(() => ({
      done: !!window.__batch?.done,
      progress: document.querySelector('[data-testid=batch-progress]')?.textContent || '',
    }));
    if (state.progress !== last) {
      console.log(`  ${((Date.now() - started) / 1000).toFixed(0).padStart(4)}s  ${state.progress}`);
      last = state.progress;
    }
    if (state.done) break;
    if (Date.now() - started > budget) throw new Error(`batch did not finish within ${budget / 60000} minutes`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  const rows = await page.evaluate(() => window.__batch.rows);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'results.json'), JSON.stringify(rows, null, 2) + '\n');
  await page.screenshot({ path: join(outDir, 'contact-sheet.png'), fullPage: true });

  console.log('\nPER PHOTO (blur check on the raw photo; preview = the wait a parent sees)');
  console.log('photo                      source       blur     score  preview  print   page                          inks                     network');
  for (const r of rows) {
    const s = r.sharpness || {};
    const net = r.network.length ? r.network.map((n) => `${n.host} ${n.status}`).join(', ') : 'none';
    console.log(
      `${r.name.padEnd(26)} ${`${r.nativeWidth}x${r.nativeHeight}`.padEnd(12)} ${String(s.verdict).padEnd(8)} ${s.score == null ? '  n/a' : s.score.toFixed(2)}  ${(r.previewMs / 1000).toFixed(1).padStart(5)}s  ${(r.printMs / 1000).toFixed(1).padStart(5)}s  ${String(r.paper).padEnd(29)} ${r.inks.join('+').padEnd(24)} ${net}`,
    );
  }

  console.log('\nPRINT FILES (brief: long edge >= 3000px)');
  console.log('photo                      look             size         long   >=3000  dpi@A4  dpi@A3');
  let n = 0;
  let short = 0;
  for (const r of rows) {
    if (r.error) {
      console.log(`${r.name.padEnd(26)} ERROR ${r.error}`);
      code = 1;
    }
    for (const o of r.outputs) {
      n++;
      if (!o.meetsBrief) short++;
      if (o.error) code = 1;
      console.log(
        `${r.name.padEnd(26)} ${o.style.padEnd(16)} ${(o.error ? 'ERROR' : `${o.width}x${o.height}`).padEnd(12)} ${String(o.longEdge).padStart(5)}   ${o.meetsBrief ? 'yes  ' : 'SHORT'}   ${String(o.dpiA4).padStart(5)}   ${String(o.dpiA3).padStart(5)}${o.error ? `  ${o.error}` : ''}`,
      );
    }
  }
  console.log(`\n${n} outputs, ${short} under 3000px on the long edge.`);
  if (short) code = 1;
  if (consoleErrors.length) console.log(`\n${consoleErrors.length} console errors in the page (first: ${consoleErrors[0].slice(0, 200)})`);
  console.log(`\ncontact sheet: ${join(outDir, 'contact-sheet.png')}\nresults:       ${join(outDir, 'results.json')}`);
} catch (e) {
  console.error(e.message || e);
  code = 1;
} finally {
  await browser?.close();
  // Wait for vite to actually exit (bounded), so no survivor holds a port.
  if (vite.exitCode === null) {
    const exited = new Promise((r) => vite.once('exit', r));
    vite.kill('SIGTERM');
    const t = setTimeout(() => vite.kill('SIGKILL'), 3000);
    await exited;
    clearTimeout(t);
  }
}
process.exit(code);
