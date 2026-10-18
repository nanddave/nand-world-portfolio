// World-reaction test: enter a city, focus the mission spot, emit the mission's event, wait, screenshot to shots/world-<name>.png.
// Usage: node tools/world-test.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const CASES = [
  { name: 'blr-machine', city: 1, spot: 1, evt: 'machine:fixed', data: {} },
  { name: 'irving-etl', city: 3, spot: 0, evt: 'etl:done', data: { clusters: 5 } },
  { name: 'seattle-pii', city: 4, spot: 1, evt: 'pii:redacted', data: { count: 7 } },
  { name: 'brokai-voice', city: 6, spot: 1, evt: 'voice:booked', data: {} },
  { name: 'boston-train', city: 2, spot: 0, evt: 'train:converged', data: {} },
  { name: 'sf-goal', city: 5, spot: 1, evt: 'goal:planned', data: {} },
].filter(c => !process.env.ONLY || process.env.ONLY.split(',').includes(c.name));
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errs = [];
for (const c of CASES) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => errs.push(c.name + ' pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(c.name + ' console: ' + m.text()); });
  await p.goto(`http://127.0.0.1:${port}/`, { timeout: 150000 }); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await p.evaluate(i => window.__app.enterCity(i), c.city); await p.waitForTimeout(2500);
  await p.evaluate(k => window.__app.focusSpot(k), c.spot); await p.waitForTimeout(2500);
  await p.evaluate(async ([e, d]) => { const { WORLD } = await import('/src/kit/events.js'); WORLD.emit(e, d); }, [c.evt, c.data]);
  await p.waitForTimeout(1500);
  if (process.env.HIDECARD) await p.addStyleTag({ content: '#card,#pilot{visibility:hidden!important}' });
  await p.screenshot({ path: `shots/world-${c.name}.png` }); console.log('shot', c.name);
  await p.close();
}
console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].slice(0, 10).join('\n') : 'no errors');
await b.close(); await server.close();
