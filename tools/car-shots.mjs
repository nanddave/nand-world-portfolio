// Screenshots of each selectable hero car (day + night city) and the SF skydiver. Usage: node tools/car-shots.mjs
import { browserPath } from './browser.mjs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const b = await chromium.launch({ executablePath: browserPath, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = [];
p.on('pageerror', e => errs.push(e.message));
const close = () => p.evaluate(() => { const c = __app.city, car = c.C.heroCar; c.otgt = car.position.clone(); c.otgt.y = 1; c.tdist = 30; c.dist = 9; c.tpitch = c.pitch = .25; c.yaw = car.rotation.y + 2.1; c.paused = true; c.tdist = 9; });
for (const stop of ['sf']) {
  await p.goto(`http://127.0.0.1:${port}/?stop=${stop}`); await p.waitForTimeout(7000);
  for (let i = 0; i < 4; i++) {
    await close(); await p.waitForTimeout(1500);
    const label = await p.textContent('#carBtn'); await p.screenshot({ path: `shots/car-${stop}-${i}.png` }); console.log(stop, i, label);
    await p.click('#carBtn');
  }
  if (stop === 'sf') { // skydiver: look at it mid-descent
    await p.evaluate(() => { const c = __app.city; c.paused = false; c.C.update(20, 0); });
    const pos = await p.evaluate(() => { const c = __app.city, s = c.C.scene.children.find(o => o.children?.some(k => k.geometry?.type === 'BoxGeometry') && o.userData.noCollide && o.position.y > 20); c.otgt = s.position.clone(); c.otgt.y += 7; c.dist = c.tdist = 45; c.yaw = .4; c.pitch = c.tpitch = .1; c.paused = true; return s.position.toArray(); });
    console.log('skydiver at', pos); await p.waitForTimeout(1500); await p.screenshot({ path: 'shots/sf-skydiver.png' });
  }
}
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : '(no errors)');
await b.close(); await server.close();
