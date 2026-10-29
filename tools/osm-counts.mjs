import { browserPath } from './browser.mjs';
// Prints C.osmCounts and mesh/collider counts for every city. Usage: node tools/osm-counts.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const b = await chromium.launch({ executablePath: browserPath, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto(`http://127.0.0.1:${port}/`); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
for (let ci = 0; ci < 7; ci++) {
  await p.evaluate(i => window.__app.enterCity(i), ci); await p.waitForTimeout(1500); await p.keyboard.down('w'); await p.waitForTimeout(300); await p.keyboard.up('w'); await p.keyboard.press('Space'); await p.waitForTimeout(300);
  console.log(JSON.stringify(await p.evaluate(() => { const C = window.__app.drive?.C; let meshes = 0; C?.scene.traverse(o => { if (o.isMesh || o.isInstancedMesh) meshes++; }); return { id: window.__city, osm: C?.osmCounts, colliders: C?.colliders?.length, meshes }; })));
  await p.keyboard.press('Escape'); await p.evaluate(() => window.__app.exitCity()); await p.waitForTimeout(900);
}
await b.close(); await server.close();
