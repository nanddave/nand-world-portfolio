// Co-pilot coverage of non-spot content (projects, papers, offers, contact) and the persona chooser for the autopilot tour.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserPath } from './browser.mjs';
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }); await server.listen();
const browser = await chromium.launch({ executablePath: browserPath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`, errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
page.on('pageerror', e => errors.push(e.message)); await page.route('https://**/*', r => r.abort());
await page.goto(origin + '/'); await page.waitForFunction(() => window.__app); await page.evaluate(async () => window.__app.enterCity(0));
const ask = async q => { await page.locator('#copilotBtn').evaluate(el => el.click()); await page.locator('#askIn').fill(q); await page.locator('#ask').evaluate(el => el.requestSubmit()); await page.waitForFunction(() => !/Searching/.test(document.querySelector('#pilotText').textContent)); return page.locator('#pilotMatch').innerText(); };
for (const [q, want] of [['What is Jarvis?', /Project · Jarvis/], ['Tell me about the salon receptionist project', /salon/i], ['Which research papers did he publish?', /Paper|Catch the leak|Agents that argue/], ['How do I contact him?', /Contact/], ['Can he build me a voice agent?', /What I can build|salon/i], ['Where did he work?', /Role|Brokai|Centific|7-Eleven|Oaklet/], ['Give me a quick summary', /30-second/]]) {
  const m = await ask(q); assert.match(m, want, `"${q}" → ${m}`);
}
await page.keyboard.press('Escape');
await page.locator('#tourMenuBtn').evaluate(el => el.click()); await page.locator('#persona').waitFor({ state: 'visible' });
assert.equal(await page.locator('#persona [data-persona]').count(), 4);
await page.locator('[data-persona="founder"]').click();
await page.waitForFunction(() => /Founder/.test(document.querySelector('#tourChip').textContent) && !document.querySelector('#tourChip').hidden);
await page.waitForFunction(() => window.__app.state.mode === 'city' && window.__app.state.cityIdx === 6, null, { timeout: 60000 }); // founder route starts at Brokai
await page.locator('#tourChip').click(); await page.waitForFunction(() => document.querySelector('#tourChip').hidden);
assert.deepEqual(errors, []); await browser.close(); await server.close(); console.log('persona assertions passed');
