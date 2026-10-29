// Pre-launch checks against the production build (dist/), on desktop and on a throttled phone.
// Page load (FCP, LCP, CLS, bytes, ready time), main flows, horizontal overflow, tap-target size,
// accessible names, share tags and internal links. Add --online to also check outbound links.
// Usage: npm run build && node tools/launch-test.mjs [--online]
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { browserPath } from './browser.mjs';

const online = process.argv.includes('--online');
const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ executablePath: browserPath, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const failures = [], report = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const PROFILES = [
  // shortcut: lab budgets on software WebGL; real-device numbers still need a phone check.
  { name: 'desktop', viewport: { width: 1440, height: 900 }, cpu: 1, net: null, budget: { fcp: 2500, lcp: 3000, ready: 6000 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, cpu: 4,
    net: { latency: 150, downloadThroughput: 1.6e6 / 8 * 5, uploadThroughput: 750e3 / 8 * 5 }, // ~"fast 4G"
    budget: { fcp: 3000, lcp: 4500, ready: 12000 } },
];

for (const P of PROFILES) {
  const ctx = await browser.newContext({ viewport: P.viewport, isMobile: !!P.isMobile, hasTouch: !!P.hasTouch, deviceScaleFactor: P.isMobile ? 2 : 1 });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  if (P.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...P.net });
  if (P.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
  let bytes = 0, requests = 0;
  cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; requests++; });
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(origin + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('world-ready'), null, { timeout: 60000 });
  const ready = Date.now() - t0;
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1, lcp: window.__lcp, cls: window.__cls }));
  const row = { profile: P.name, readyMs: ready, fcpMs: Math.round(m.fcp), lcpMs: Math.round(m.lcp), cls: +m.cls.toFixed(3), kB: Math.round(bytes / 1024), requests };
  report.push(row);
  check(m.fcp > 0 && m.fcp < P.budget.fcp, `${P.name}: FCP ${row.fcpMs} ms over ${P.budget.fcp}`);
  check(m.lcp < P.budget.lcp, `${P.name}: LCP ${row.lcpMs} ms over ${P.budget.lcp}`);
  check(m.cls < 0.1, `${P.name}: CLS ${row.cls} ≥ 0.1`);
  check(ready < P.budget.ready, `${P.name}: app ready ${ready} ms over ${P.budget.ready}`);
  if (P.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  if (P.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // layout: nothing wider than the screen; visible controls are big enough to tap and have a name
  const layout = await page.evaluate(min => {
    const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && +s.opacity > 0 && r.bottom > 0 && r.top < innerHeight; };
    const ctrls = [...document.querySelectorAll('button, a[href], input, [role=button]')].filter(vis);
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      small: ctrls.filter(el => { const r = el.getBoundingClientRect(); return r.width < min || r.height < min; }).filter(el => !el.closest('p, li')).map(el => (el.id || el.textContent.trim()).slice(0, 30)),
      unnamed: ctrls.filter(el => !(el.getAttribute('aria-label') || el.textContent.trim() || el.title || el.getAttribute('alt'))).map(el => el.outerHTML.slice(0, 60)),
      dupIds: [...document.querySelectorAll('[id]')].map(e => e.id).filter((id, i, a) => a.indexOf(id) !== i),
    };
  }, 24);
  check(layout.overflow <= 0, `${P.name}: page is ${layout.overflow}px wider than the screen`);
  check(!layout.small.length, `${P.name}: tap targets under 24px: ${layout.small.join(', ')}`);
  check(!layout.unnamed.length, `${P.name}: controls without a name: ${layout.unnamed.join(' | ')}`);
  check(!layout.dupIds.length, `${P.name}: duplicate ids: ${layout.dupIds.join(', ')}`);

  // flows: recruiter summary, start → city → spot card → close, menu
  await page.click('#quickBtn2'); await page.locator('#quick').waitFor({ state: 'visible' });
  check((await page.locator('#quick').innerText()).includes('Résumé'), `${P.name}: 30-second view has no résumé link`);
  await page.keyboard.press('Escape'); await page.locator('#quick').waitFor({ state: 'hidden' });
  await page.click('#startBtn'); await page.waitForTimeout(800);
  await page.evaluate(() => window.__app.enterCity(5));
  await page.waitForFunction(() => window.__app.state.mode === 'city', null, { timeout: 30000 });
  await page.evaluate(() => window.__app.focusSpot(0)); await page.locator('#card.open').waitFor({ timeout: 15000 });
  check((await page.locator('#kBody').innerText()).length > 40, `${P.name}: spot card is empty`);
  const cardFits = await page.evaluate(() => { const r = document.getElementById('card').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; });
  check(cardFits, `${P.name}: spot card is cut off`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.click('#menuBtn'); await page.locator('#menu').waitFor({ state: 'visible' }).catch(() => failures.push(`${P.name}: menu did not open`));
  await page.keyboard.press('Escape');
  check(!errors.length, `${P.name}: page errors: ${errors.slice(0, 3).join(' | ')}`);
  await page.screenshot({ path: `shots/launch-${P.name}.png` });
  await ctx.close();
}

// share tags and links
const page = await browser.newPage();
await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
const meta = await page.evaluate(() => Object.fromEntries(['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'description'].map(k => [k, document.querySelector(`meta[property="${k}"],meta[name="${k}"]`)?.content || ''])));
for (const [k, v] of Object.entries(meta)) check(v, `missing <meta ${k}>`);
check(await page.evaluate(() => document.documentElement.lang === 'en' && !!document.querySelector('meta[name=viewport]')), 'missing lang or viewport');
const links = new Set();
for (const path of ['/', '/cv.html']) {
  await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  (await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.href))).forEach(h => links.add(h));
}
// the hidden source button gets its href from script, so add it explicitly
links.add(await page.goto(origin + '/').then(() => page.evaluate(() => document.getElementById('howRepo')?.href)));
for (const href of [...links].filter(h => h && /^https?:/.test(h))) {
  const internal = href.startsWith(origin);
  if (!internal && !online) continue;
  const url = internal ? href : href.replace(/^https:\/\/nanddave\.life/, origin);
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 launch-test' } });
    check(r.ok || (r.status === 999 && /linkedin/.test(url)), `link ${href} → ${r.status}`);
  } catch (e) { check(false, `link ${href} → ${e.message}`); }
}
const og = await fetch(origin + '/og.png'); check(og.ok && +og.headers.get('content-length') < 5e6, 'og.png missing or over 5 MB');

console.table(report);
await browser.close(); await server.close();
if (failures.length) { console.log('LAUNCH FAILURES:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('launch assertions passed');
