// Writes public/cv.html: a static, semantic, printable one-page resume built from src/content/stops.js.
// Usage: node tools/build-cv.mjs   (runs automatically before `npm run build` and in build:single)
import { writeFileSync, mkdirSync } from 'node:fs';
import { STOPS, CONTACT, isReal, HEADLINE, SUMMARY, PAPERS, EDU, ROLES, PROJECTS } from '../src/content/stops.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
/** Body HTML -> { ps, li }. Drops .todo and .city (colour about the place, not Nand) paragraphs, link-only and button paragraphs; strips every tag. */
function parts(html) {
  const clean = h => decode(h.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
  const ps = [], li = [];
  for (const m of html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    if (/class="[^"]*\b(todo|city)\b/.test(m[1]) || /<(button|a)\b/.test(m[2])) continue;
    const t = clean(m[2]); if (t) ps.push(t);
  }
  for (const m of html.matchAll(/<li>([\s\S]*?)<\/li>/g)) { const t = clean(m[1]); if (t) li.push(t); }
  return { ps, li };
}
const spotOf = (id, t) => STOPS.find(s => s.id === id)?.spots.find(sp => sp.t === t);
const link = (h, label) => isReal(h) ? `<a href="${esc(h)}">${esc(label)}</a>` : '';

// Experience: ROLES (newest first), each pulling its story and result bullets from the matching spot(s).
const EXTRA = { 'Brokai Labs': ['The salon (US client)'], '7-Eleven': ['The store counter'] };
const used = new Set();
const jobs = ROLES.map(r => {
  const titles = [r.where[1], ...(EXTRA[r.org] || [])], ps = [], li = [];
  titles.forEach(t => { const sp = spotOf(r.where[0], t); if (!sp) return; used.add(sp); const x = parts(sp.b); ps.push(...x.ps); li.push(...x.li); });
  return { ...r, ps, li };
});
const roleSpots = new Set(jobs.length ? used : []);
// Background: remaining spots that carry real (non-placeholder) text about Nand, skipping research (listed under Papers) and the empty plot.
const background = [];
for (const s of STOPS) for (const sp of s.spots) {
  if (roleSpots.has(sp) || /^(PES|Northeastern) University$/.test(sp.t) || sp.mission === 'lot' || /^Research:/.test(sp.m)) continue;
  const x = parts(sp.b); if (x.ps.length || x.li.length) background.push({ t: sp.t, m: sp.m, place: s.name.replace(', again', ' (again)'), ...x });
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
.sum{margin:0 0 10px;max-width:60ch}
ul{margin:4px 0;padding-left:20px}li{margin:2px 0}
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
<p class="role">${esc(HEADLINE)}</p>
<p class="sum">${esc(SUMMARY)}</p>
${contact ? `<p class="contact">${contact}</p>` : ''}
<a class="trip noprint" href="./">Take the 3D trip</a>
</header>
<h2>Experience</h2>
${jobs.map(j => `<article><h4>${esc(j.role)}, ${esc(j.org)} <small>${esc(j.place)}</small></h4><p class="m">${esc(j.when)}</p>${j.ps.map(p => `<p>${esc(p)}</p>`).join('')}${j.li.length ? `<ul>${j.li.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</article>`).join('\n')}
<h2>Projects</h2>
${PROJECTS.map(p => `<article><h4>${esc(p.name)}</h4><p>${esc(p.text)}</p></article>`).join('\n')}
<h2>Papers</h2>
${PAPERS.map(p => `<article><h4><a href="${esc(p.url)}">${esc(p.title)}</a></h4><p class="m">${esc(p.venue)}. Published while at Centific.</p></article>`).join('\n')}
<h2>Education</h2>
${EDU.map(e => `<article><h4>${esc(e.school)}</h4><p class="m">${esc(e.what)}</p></article>`).join('\n')}
${background.length ? `<h2>Background</h2>
${background.map(b => `<article><h4>${esc(b.t)} <small>${esc(b.place)}</small></h4><p class="m">${esc(b.m)}</p>${b.ps.map(x => `<p>${esc(x)}</p>`).join('')}${b.li.length ? `<ul>${b.li.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</article>`).join('\n')}` : ''}
<footer>Generated from the same content as the 3D site. Figures and dates are as stated there.</footer>
</main></body></html>
`;
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/cv.html', import.meta.url), html);
console.log('wrote public/cv.html', html.length, 'bytes');
