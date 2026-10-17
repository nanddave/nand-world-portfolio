// Drive-mode smoke test: enter Bangalore directly, hold W 3 s then A 1 s, screenshot shots/drive-blr.png, print window.__drive.
// Usage: node tools/drive-test.mjs [cityIndex=1]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const ci = +(process.argv[2] ?? 1);
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('console: ' + m.text()); });
await p.goto(`http://127.0.0.1:${port}/`); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
await p.evaluate(i => window.__app.enterCity(i), ci); await p.waitForTimeout(2500);
console.log('in city:', await p.evaluate(() => window.__city), 'drive before:', JSON.stringify(await p.evaluate(() => window.__drive)));
// Headless software GL runs at a few fps and the sim clamps dt, so 3 s of wall time is only ~1 s of sim: hold W for 3 s, then until the car has travelled ~25 m (max 25 s).
await p.keyboard.down('w'); await p.waitForTimeout(3000);
for (let i = 0; i < 25 && (await p.evaluate(() => Math.hypot(window.__drive.x + 8, window.__drive.z - 4.6))) < 25; i++) await p.waitForTimeout(1000);
await p.keyboard.down('a'); await p.keyboard.up('w'); await p.waitForTimeout(1000); await p.keyboard.up('a');
await p.screenshot({ path: 'shots/drive-blr.png' });
console.log('drive after:', JSON.stringify(await p.evaluate(() => window.__drive)), 'speedo:', await p.textContent('#speedN'), 'prompt:', await p.evaluate(() => { const e = document.querySelector('#drivePrompt'); return e.hidden ? null : e.textContent; }));
await p.keyboard.press('Escape'); await p.waitForTimeout(800);
console.log('after Esc active:', await p.evaluate(() => window.__drive.active), 'button:', await p.textContent('#driveBtn'));
console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].slice(0, 10).join('\n') : 'no errors');
await b.close(); await server.close();
