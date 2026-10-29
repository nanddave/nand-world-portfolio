import { STOPS, CONTACT, isReal, HEADLINE, SUMMARY, PAPERS, EDU, ROLES, PROJECTS } from './stops.js';

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
export function renderProject(p, { anchor = true, title = true } = {}) { return `<article${anchor ? ` id="project-${esc(p.id)}"` : ''}>${title ? `<h4>${esc(p.name)}</h4>` : ''}<p>${esc(p.status)}</p><p>${esc(p.text)}</p><h4>What I did</h4><p>${esc(p.contribution)}</p><h4>How it works</h4><ol>${p.flow.map(step => `<li>${esc(step)}</li>`).join('')}</ol><h4>Proof</h4><p>${esc(p.evidenceNote)}</p><h4>About the demo</h4><ul>${p.limitations.map(item => `<li>${esc(item)}</li>`).join('')}</ul></article>`; }

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

function contacts(single) { return [
  isReal(CONTACT.email) ? `<a href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a>` : '',
  link(CONTACT.linkedin, 'LinkedIn'), link(CONTACT.github, 'GitHub'), link(single ? new URL(CONTACT.resume, CONTACT.site).href : CONTACT.resume, single ? 'PDF résumé (online)' : 'PDF résumé'), link(CONTACT.site, 'Website'),
].filter(Boolean).join(' · '); }

export function renderReadable({ single = false, embedded = false } = {}) { const contact = contacts(single); return `<header>
<h1>Nand Dave</h1>
<p class="role">${esc(HEADLINE)}</p>
<p class="sum">${esc(SUMMARY)}</p>
${contact ? `<p class="contact">${contact}</p>` : ''}
${embedded ? '' : '<a class="trip noprint" href="./">Take the 3D trip</a>'}
</header>
<h2>Experience</h2>
${jobs.map(j => `<article><h4>${esc(j.role)}, ${esc(j.org)} <small>${esc(j.place)}</small></h4><p class="m">${esc(j.when)}</p>${j.ps.map(p => `<p>${esc(p)}</p>`).join('')}${j.li.length ? `<ul>${j.li.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</article>`).join('\n')}
<h2>Projects</h2>
${PROJECTS.map(p => renderProject(p)).join('\n')}
<h2>Papers</h2>
${PAPERS.map(p => `<article><h4><a href="${esc(p.url)}">${esc(p.title)}</a></h4><p class="m">${esc(p.venue)}. ${esc(p.contribution)}</p><p>${esc(p.method)} ${esc(p.demo)}</p></article>`).join('\n')}
<h2>Education</h2>
${EDU.map(e => `<article><h4>${esc(e.school)}</h4><p class="m">${esc(e.what)}</p></article>`).join('\n')}
${background.length ? `<h2>Background</h2>
${background.map(b => `<article><h4>${esc(b.t)} <small>${esc(b.place)}</small></h4><p class="m">${esc(b.m)}</p>${b.ps.map(x => `<p>${esc(x)}</p>`).join('')}${b.li.length ? `<ul>${b.li.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</article>`).join('\n')}` : ''}
<footer>Generated from the same content as the 3D site. Figures and dates are as stated there.</footer>`; }
