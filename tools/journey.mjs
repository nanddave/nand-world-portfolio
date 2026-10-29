import { browserPath } from './browser.mjs';
// Full-journey smoke test: intro → start → a few cities and missions. Saves shots/j-*.png and prints errors.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const b = await chromium.launch({ executablePath: browserPath, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('console: ' + m.text()); });
const shot = async n => { await p.screenshot({ path: `shots/j-${n}.png` }); console.log('shot', n); };
await p.goto(`http://127.0.0.1:${port}/?for=ValueScale`); await p.waitForTimeout(9000); await shot('1-intro');
await p.click('#startBtn'); await p.waitForTimeout(9000); await shot('2-nadiad');
for (const [ci, k, n] of (process.argv[2] ? JSON.parse(process.argv[2]) : [[4, 1, '3-seattle-pii'], [3, 0, '4-irving-etl'], [6, 1, '5-brokai-voice']])) {
  await p.evaluate(([ci, k]) => window.__app.travelTo(ci, k), [ci, k]); await p.waitForTimeout(+(process.env.WAIT || 14000)); await shot(n);
}
console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].slice(0, 10).join('\n') : 'no errors');
await b.close(); await server.close();
