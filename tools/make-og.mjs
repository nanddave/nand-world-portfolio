// Link-preview card (public/og.png, 1200×630): a real SF scene from the city harness with name, headline, route and education on top.
// Usage: node tools/make-og.mjs [yaw] [pitch] [dist]
import { browserPath } from './browser.mjs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'fs';
const [yaw = '0.35', pitch = '0.16', dist = '70'] = process.argv.slice(2);
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
const port = server.httpServer.address().port;
const b = await chromium.launch({ executablePath: browserPath, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(`http://127.0.0.1:${port}/city.html?c=sf&yaw=${yaw}&pitch=${pitch}&dist=${dist}`);
await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }); await p.waitForTimeout(1500);
await p.addStyleTag({ content: '.lab,#info{display:none!important}' });
const scene = (await p.screenshot()).toString('base64');
const html = `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Schibsted+Grotesk:wght@500;700&display=swap">
<style>body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:'Schibsted Grotesk',sans-serif;color:#FFF8EA;background:#0B1026 url(data:image/png;base64,${scene}) center/cover}
.sh{position:absolute;inset:0;background:linear-gradient(90deg,rgba(11,16,38,.92) 0%,rgba(11,16,38,.78) 42%,rgba(11,16,38,0) 75%)}
.t{position:absolute;left:64px;top:70px;width:780px}
h1{font:900 118px/0.86 'Big Shoulders Display',sans-serif;margin:0;letter-spacing:-.01em}
.h{font-weight:700;font-size:33px;line-height:1.18;margin:18px 0 0}.h b{color:#FFC93C}
.r{margin-top:34px;font-size:19px;font-weight:500;opacity:.92;line-height:1.5}.r i{font-style:normal;color:#FFC93C}
.e{margin-top:10px;font-size:17px;opacity:.8}
.cta{position:absolute;left:64px;bottom:54px;display:flex;gap:16px;align-items:center;font-weight:700;font-size:20px}
.cta span{background:#FFC93C;color:#16192E;border-radius:99px;padding:11px 22px}</style></head><body><div class="sh"></div>
<div class="t"><h1>Nand Dave</h1><p class="h">Applied AI engineer.<br>I build <b>voice agents</b> and <b>data systems</b>.</p>
<p class="r">Nadiad <i>→</i> Bangalore <i>→</i> Boston <i>→</i> Irving <i>→</i> Bellevue <i>→</i> San Francisco <i>→</i> Bangalore</p>
<p class="e">Mechanical engineering, PES University · Master's, Northeastern University</p></div>
<div class="cta"><span>Drive through my career</span>An interactive 3D portfolio</div></body></html>`;
const c = await b.newPage({ viewport: { width: 1200, height: 630 } }); await c.setContent(html); await c.evaluate(() => document.fonts.ready); await c.waitForTimeout(800);
await c.screenshot({ path: 'public/og.png' }); console.log('wrote public/og.png');
await b.close(); await server.close();
