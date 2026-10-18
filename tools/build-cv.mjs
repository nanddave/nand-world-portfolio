// Writes public/cv.html: a static, semantic, printable one-page resume built from src/content/stops.js.
// Usage: node tools/build-cv.mjs   (runs automatically before `npm run build` and in build:single)
import { writeFileSync, mkdirSync } from 'node:fs';
import { STOPS, CONTACT, isReal } from '../src/content/stops.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
/** Body HTML -> plain paragraphs. Drops .todo and .city (colour about the place, not Nand) paragraphs, strips every tag. */
function paras(html) {
  const out = [];
  for (const m of html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    if (/class="[^"]*\btodo\b/.test(m[1]) || /class="[^"]*\bcity\b/.test(m[1])) continue;
    const t = decode(m[2].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(); if (t) out.push(t);
  }
  return out;
}
const link = (h, label) => isReal(h) ? `<a href="${esc(h)}">${esc(label)}</a>` : '';

// Newest first, like a resume. A stop's role/dates come from its meta line when it has one; the passages are the content paragraphs.
const jobs = [], papers = [];
for (const s of [...STOPS].reverse()) {
  const items = [];
  for (const sp of s.spots) {
    if (sp.mission === 'lot') continue; // the interactive empty plot only makes sense in 3D
    const ps = paras(sp.b); if (!ps.length) continue;
    if (/^Research:/.test(sp.m)) { papers.push({ title: sp.t, meta: sp.m.replace(/^Research:\s*/, ''), ps }); continue; }
    items.push({ t: sp.t, m: sp.m, ps });
  }
  if (items.length) jobs.push({ place: s.name.replace(', again', ' (again)'), region: s.region, items });
}

const contact = [
  isReal(CONTACT.email) ? `<a href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a>` : '',
  link(CONTACT.linkedin, 'LinkedIn'), link(CONTACT.github, 'GitHub'), link(CONTACT.resume, 'PDF résumé'), link(CONTACT.site, 'Website'),
].filter(Boolean).join(' · ');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nand Dave: résumé</title>
<meta name="description" content="Nand Dave: applied AI engineer and founder of Brokai Labs. Plain, fast résumé view.">
<style>
:root{color-scheme:light}
body{margin:0;background:#fff;color:#1a1c2c;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 20px 48px}
h1{font-size:34px;line-height:1.1;margin:0}
.role{margin:4px 0 8px;font-size:18px;color:#444a66}
.contact{margin:0 0 6px;font-size:15px}
a{color:#1d4ed8}
.trip{display:inline-block;margin:10px 0 4px;padding:8px 14px;border-radius:6px;background:#1a1c2c;color:#fff;text-decoration:none;font-weight:600}
h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#555b78;border-bottom:1px solid #d8dae6;padding-bottom:4px;margin:28px 0 10px}
section.stop{margin:0 0 14px}
h3{font-size:17px;margin:0}
h3 small{font-weight:400;color:#555b78;font-size:14px}
article{margin:10px 0 0}
article h4{margin:0;font-size:16px}
article .m{margin:0;color:#444a66;font-size:14px}
p{margin:4px 0}
footer{margin-top:28px;font-size:13px;color:#555b78}
@media print{.trip,.noprint{display:none}main{padding:0;max-width:none}body{font-size:11.5pt}a{color:inherit;text-decoration:none}h2{margin-top:16px}section.stop,article{break-inside:avoid}}
</style></head>
<body><main>
<header>
<h1>Nand Dave</h1>
<p class="role">Applied AI engineer and founder, Brokai Labs (Bangalore)</p>
${contact ? `<p class="contact">${contact}</p>` : ''}
<a class="trip noprint" href="./">Take the 3D trip</a>
</header>
<h2>Experience and education</h2>
${jobs.map(j => `<section class="stop"><h3>${esc(j.place)} <small>${esc(j.region)}</small></h3>
${j.items.map(i => `<article><h4>${esc(i.t)}</h4><p class="m">${esc(i.m)}</p>${i.ps.map(p => `<p>${esc(p)}</p>`).join('')}</article>`).join('\n')}
</section>`).join('\n')}
${papers.length ? `<h2>Papers</h2>
${papers.map(p => `<article><h4>${esc(p.title)}</h4><p class="m">${esc(p.meta)}</p>${p.ps.map(x => `<p>${esc(x)}</p>`).join('')}</article>`).join('\n')}` : ''}
<footer>Generated from the same content as the 3D site. Figures and dates are as stated there.</footer>
</main></body></html>
`;
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/cv.html', import.meta.url), html);
console.log('wrote public/cv.html', html.length, 'bytes');
