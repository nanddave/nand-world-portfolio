// Shell smoke test: your-city fallback (?yours=), lot card + raiseLot, intro terminator, mic button presence.
import { createServer } from 'vite'; import { chromium } from 'playwright-core';
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errs = []; const pg = async () => { const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', e => errs.push(e.message)); return p; };
let p = await pg(); await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForFunction(() => window.__ready, null, { timeout: 150000 }); await p.waitForTimeout(1500);
await p.screenshot({ path: 'shots/intro.png' }); console.log('mic button:', await p.evaluate(() => !!document.querySelector('[aria-label*="ic" i][aria-pressed]')));
p = await pg(); await p.goto(`http://127.0.0.1:${port}/?yours=Dubai`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForFunction(() => window.__ready, null, { timeout: 150000 });
await p.waitForTimeout(12000);
console.log('city title:', await p.evaluate(() => document.querySelector('#cName')?.textContent), '| meta:', await p.evaluate(() => document.querySelector('#cMeta')?.textContent));
const n = await p.evaluate(() => { const s = document.querySelectorAll('.spot'); s[0]?.click(); return s.length; }); console.log('spots:', n); {  await p.waitForTimeout(4000); }
await p.screenshot({ path: 'shots/yours.png' });
console.log(errs.length ? 'ERRORS: ' + [...new Set(errs)].slice(0, 6).join(' | ') : 'no errors');
await b.close(); await server.close();
