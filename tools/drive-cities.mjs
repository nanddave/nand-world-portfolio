// Drive check across all cities: spawn clear of colliders, every spot reachable within 12 m, proximity + E opens card, Esc resumes.
// Usage: node tools/drive-cities.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/`); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
for (let ci = 0; ci < 7; ci++) {
  await p.evaluate(i => window.__app.enterCity(i), ci); await p.waitForTimeout(1500);
  await p.keyboard.down('w'); await p.waitForTimeout(300); await p.keyboard.up('w'); await p.keyboard.press('Space'); await p.waitForTimeout(300);
  const r = await p.evaluate(async () => {
    const { resolveCircle } = await import('/src/kit/collide.js'); const D = window.__app.drive, C = D.C, g = C._grid;
    const spawnHit = resolveCircle(g, C._spawn?.x ?? D.x, C._spawn?.z ?? D.z, 1.6).hit;
    const spots = C.spots.map((s, k) => { // find a free point within 11 m of the spot
      const base = g.boxes.filter(b => s.p.x > b.minX && s.p.x < b.maxX && s.p.z > b.minZ && s.p.z < b.maxZ);
      for (const b of base) for (const [x, z] of [[b.minX - 3, s.p.z], [b.maxX + 3, s.p.z], [s.p.x, b.minZ - 3], [s.p.x, b.maxZ + 3]]) if (!resolveCircle(g, x, z, 1.6).hit) return [x, z];
      for (let rr = 0; rr <= 11; rr += 1) for (let a = 0; a < 16; a++) { const x = s.p.x + Math.cos(a / 16 * 6.283) * rr, z = s.p.z + Math.sin(a / 16 * 6.283) * rr; if (!resolveCircle(g, x, z, 1.6).hit && Math.hypot(x, z) < (C.driveRadius ?? 140)) return [x, z]; }
      return null; });
    return { id: window.__city, boxes: g.boxes.length, spawnHit, spots };
  });
  const bad = r.spots.map((s, k) => s ? null : k).filter(k => k !== null);
  // proximity + open for spot 0
  let near = null, opened = null, resumed = null;
  if (r.spots[0]) {
    await p.evaluate(([x, z]) => { const D = window.__app.drive; D.x = x; D.z = z; D.speed = 0; D.sync(); }, r.spots[0]); await p.waitForTimeout(600);
    near = await p.evaluate(() => window.__drive.nearSpot);
    await p.keyboard.press('e'); await p.waitForTimeout(800); opened = await p.evaluate(() => window.__app.state.spot);
    await p.keyboard.press('Escape'); await p.waitForTimeout(500); resumed = await p.evaluate(() => window.__drive.active);
  }
  console.log(`${r.id}: boxes ${r.boxes}, spawnInside ${r.spawnHit}, unreachable spots [${bad}], near0 ${near}, opened ${opened}, driveAfterClose ${resumed}`);
  await p.keyboard.press('Escape'); await p.evaluate(() => window.__app.exitCity()); await p.waitForTimeout(900);
}
console.log(errs.length ? 'ERRORS: ' + [...new Set(errs)].slice(0, 5).join(' | ') : 'no errors');
await b.close(); await server.close();
