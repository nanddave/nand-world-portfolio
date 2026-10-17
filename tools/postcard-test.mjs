// Render makePostcard() in headless Chromium and save the PNG. Usage: node tools/postcard-test.mjs out.png [name] [stamps=0,1,2,3,4] [missions=1:1,2:0] [company]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'fs';
const [out = 'shots/postcard.png', name = 'Priya Venkataraghavan-Subramaniam Jr', stamps = '0,1,2,3,4', missions = '1:1,2:0,3:0', company = 'Acme'] = process.argv.slice(2);
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|ERR_/.test(m.text())) errs.push(m.text()); });
await p.goto(`http://127.0.0.1:${port}/mission.html`); await p.waitForTimeout(500);
const b64 = await p.evaluate(async ([name, stamps, missions, company]) => {
  const { makePostcard } = await import('/src/ui/postcard.js');
  const blob = await makePostcard({ name, stamped: new Set(stamps.split(',').filter(Boolean).map(Number)), missions: new Set(missions.split(',').filter(Boolean)), company });
  const bm = await createImageBitmap(blob);
  return { size: [bm.width, bm.height], bytes: blob.size, data: await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); }) };
}, [name, stamps, missions, company]);
fs.writeFileSync(out, Buffer.from(b64.data, 'base64')); console.log('saved', out, b64.size.join('x'), b64.bytes, 'bytes', errs.length ? '\nERRORS: ' + errs.join('\n') : '(no errors)');
await b.close(); await server.close();
