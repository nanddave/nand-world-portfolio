import { browserPath } from './browser.mjs';
// Record the trailer (src/core/trailer.js). Starts its own Vite dev server and drives headless Chromium.
//
//   node tools/record-trailer.mjs [--vertical] [--reel hero] [--from S] [--to S] [--fps 30] [--webm] [--keep] [--nomp4]
//   --reel hero: render the 35-s social reel (src/content/reel.js, ?trailer=1&reel=hero) instead of the 60-s trailer. Frames go to
//     shots/frames-reel[-v]/, output shots/reel-vertical.mp4 / reel-landscape.mp4 (H.264 yuv420p, CRF 18, +faststart, no audio).
//
// Default (frames mode, deterministic): the page runs on a virtual clock (&fixed=30, src/core/vtime.js). For every frame the
//   recorder advances the clock exactly 1/30 s, lets the page render, and saves a PNG to shots/frames/ (shots/frames-v/ with
//   --vertical). Then, if ffmpeg exists, encodes shots/trailer.mp4 (trailer-vertical.mp4) at 30 fps. No audio in this mode.
//   --at 13.5,16.5,... renders just those single frames (shots/frames/at_<t>.png) for quick looks.
//   --from/--to render only that time range (the part before --from is simulated without rendering, so it is quick).
//   Range output goes to trailer-<from>-<to>.mp4. Without ffmpeg the PNG frames are kept.
// --webm: real-time capture instead (Playwright recordVideo, wall-clock; needs a machine that renders >= 30 fps).
//   Opens /?trailer=1, waits for window.__trailerDone, saves shots/trailer.webm (trailer-vertical.webm).
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const val = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
import { REEL_LENGTH as HERO_LEN } from '../src/content/reel.js';
import { PLATES } from '../src/content/reel-launch.js';
const REEL_LENGTH = PLATES[val('reel', '')]?.len ?? HERO_LEN;
const VERT = flag('vertical'), FPS = +val('fps', 30), WEBM = flag('webm'), REEL = val('reel', '');
const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080, LEN = REEL ? REEL_LENGTH : 60;
const QREEL = REEL ? `&reel=${REEL}` : '';
const from = +val('from', 0), to = +val('to', LEN), ranged = from > 0 || to < LEN;
const suffix = VERT ? '-vertical' : '';
const outName = REEL ? `shots/reel-${REEL}-${VERT ? 'vertical' : 'landscape'}` : `shots/trailer${suffix}`;
fs.mkdirSync('shots', { recursive: true });

const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ executablePath: browserPath, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const hook = p => { p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|ERR_|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); }); };
let code = 0;
// Playwright's waitForFunction polls with the page's own timers, which the virtual clock freezes; poll from Node instead.
async function waitFlag(page, name, ms) { const end = Date.now() + ms; while (Date.now() < end) { if (await page.evaluate(n => !!window[n], name)) return; await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout waiting for window.' + name); }

try {
  if (WEBM) {
    const dir = path.resolve('shots/.webm-tmp'); fs.rmSync(dir, { recursive: true, force: true });
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } } });
    const page = await ctx.newPage(); hook(page);
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${port}/?trailer=1${QREEL}${VERT ? '&v=1' : ''}`);
    await waitFlag(page, '__trailerReady', 180000);
    const lead = (Date.now() - t0) / 1000; console.log(`trailer started ${lead.toFixed(1)} s into the recording (loading screen; trim with ffmpeg -ss)`);
    await waitFlag(page, '__trailerDone', 120000); await page.waitForTimeout(500);
    const video = page.video(); await ctx.close(); const out = `${outName}.webm`; await video.saveAs(out); fs.rmSync(dir, { recursive: true, force: true });
    console.log('saved', out);
  } else {
    const dir = `shots/frames${REEL ? '-reel-' + REEL : ''}${VERT ? '-v' : ''}`; if (!flag('keep')) fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: W, height: H } }); hook(page);
    await page.goto(`http://127.0.0.1:${port}/?trailer=1&fixed=${FPS}${QREEL}${VERT ? '&v=1' : ''}`);
    await waitFlag(page, '__trailerReady', 240000);
    if (val('at', '')) {
      let cur = 0; // frames simulated so far
      for (const t of val('at', '').split(',').map(Number).sort((a, b) => a - b)) {
        const target = Math.max(1, Math.round(t * FPS)); if (target - 1 > cur) await page.evaluate(n => window.__trailer.ff(n / window.__vt.fps), target - 1 - cur);
        await page.evaluate(() => window.__vt.step()); cur = target; const f = `${dir}/at_${t}.png`; await page.screenshot({ path: f, type: 'png' }); console.log('saved', f);
      }
      throw new Error('--at done');
    }
    const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
    let t0 = Date.now();
    if (f0 > 0) { await page.evaluate(s => window.__trailer.ff(s), f0 / FPS); console.log(`fast-forwarded to ${from} s in ${((Date.now() - t0) / 1000).toFixed(1)} s`); }
    t0 = Date.now();
    for (let n = f0; n < f1; n++) {
      await page.evaluate(() => window.__vt.step());
      for (let tr = 0; ; tr++) { // software GL occasionally stalls a screenshot; the virtual clock is paused, so just ask again
        try { await page.screenshot({ path: `${dir}/frame_${String(n).padStart(5, '0')}.png`, type: 'png', timeout: 120000 }); break; } catch (e) { if (tr >= 3) throw e; console.log(`screenshot retry ${tr + 1} at frame ${n}`); }
      }
      if ((n - f0 + 1) % 30 === 0) { const done = n - f0 + 1, el = (Date.now() - t0) / 1000; console.log(`${(n + 1) / FPS} s  (${done} frames, ${(done / el).toFixed(2)} fps, eta ${(((f1 - f0 - done) / (done / el)) / 60).toFixed(1)} min)`); }
    }
    const el = (Date.now() - t0) / 1000; console.log(`rendered ${f1 - f0} frames in ${el.toFixed(0)} s = ${((f1 - f0) / el).toFixed(2)} frames/s`);
    const has = spawnSync('which', ['ffmpeg']).status === 0;
    if (has && !flag('nomp4')) {
      const out = ranged ? `${outName}-${from}-${to}.mp4` : `${outName}.mp4`;
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-start_number', String(f0), '-i', `${dir}/frame_%05d.png`, '-frames:v', String(f1 - f0), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', REEL ? '18' : '16', '-preset', 'medium', '-movflags', '+faststart', '-an', out], { stdio: 'inherit' });
      console.log(r.status === 0 ? `saved ${out} (${FPS} fps, no audio)` : 'ffmpeg failed; PNG frames kept in ' + dir);
    } else console.log(has ? 'frames kept in ' + dir : 'no ffmpeg: PNG frames kept in ' + dir);
  }
} catch (e) { if (e.message !== '--at done') { console.error('record failed:', e.message); code = 1; } }
console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].slice(0, 10).join('\n') : '(no page errors)');
await browser.close(); await server.close(); process.exit(code);
