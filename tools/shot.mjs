import { browserPath } from './browser.mjs';
// Screenshot helper for agents. Starts its own Vite dev server on a free port.
// Usage: node tools/shot.mjs "<path?query>" out.png [waitMs=6000] [width=1440] [height=900] [--click "css"] [--eval "js"]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const [path = '/', out = 'shot.png', wait = '6000', w = '1440', h = '900', ...rest] = process.argv.slice(2);
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const b = await chromium.launch({ executablePath: browserPath, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } }); const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('console: ' + m.text()); });
await p.goto(`http://127.0.0.1:${port}${path}`); await p.waitForTimeout(+wait);
if (opt.click) { await p.click(opt.click); await p.waitForTimeout(2000); }
if (opt.eval) { console.log('eval:', JSON.stringify(await p.evaluate(opt.eval))); await p.waitForTimeout(2000); }
await p.screenshot({ path: out }); console.log('saved', out, errs.length ? '\nERRORS:\n' + errs.slice(0, 8).join('\n') : '(no errors)');
await b.close(); await server.close();
