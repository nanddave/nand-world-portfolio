// Modals: passport, 30-second version, skills index, how this was built.
import { STOPS, CONTACT } from '../content/stops.js';
import { skillIndex } from '../core/skills.js';
import { esc } from './worklog.js';

const $ = s => document.querySelector(s);
const REPO = 'https://github.com/nanddave/nand-world-portfolio';
let lastFocus = null;

export function openModal(id) {
  const m = $(id); if (!m) return; lastFocus = document.activeElement; document.querySelectorAll('.modal').forEach(x => { x.hidden = true; });
  m.hidden = false; (m.querySelector('[data-autofocus]') || m.querySelector('button,a,input'))?.focus();
}
export function closeModals() { let any = false; document.querySelectorAll('.modal').forEach(m => { if (!m.hidden) any = true; m.hidden = true; }); if (any) lastFocus?.focus?.(); return any; }
const spotIdx = (id, t) => { const ci = STOPS.findIndex(s => s.id === id); return [ci, Math.max(0, STOPS[ci].spots.findIndex(sp => sp.t === t))]; };

function contactHtml() {
  const isLink = h => h && h !== '#';
  return `<div class="contact"><code>${esc(CONTACT.email)}</code><button class="btn small" type="button" data-copy>Copy email</button>`
    + (isLink(CONTACT.resume) ? `<a class="btn small" href="${esc(CONTACT.resume)}">Résumé</a>` : '<span class="btn small ph" aria-disabled="true">Résumé [link]</span>')
    + (isLink(CONTACT.linkedin) ? `<a class="btn small" href="${esc(CONTACT.linkedin)}" rel="noopener" target="_blank">LinkedIn</a>` : '<span class="btn small ph" aria-disabled="true">LinkedIn [link]</span>')
    + (isLink(CONTACT.github) ? `<a class="btn small" href="${esc(CONTACT.github)}" rel="noopener" target="_blank">GitHub</a>` : '') + '</div>';
}

export function setupModals({ onGo }) {
  // 30-second version: every line is taken from src/content/stops.js.
  const facts = [
    ['brokai', 'Brokai Labs', 'Founder, Brokai Labs (Nov 2025–now), an AI and automation agency in Bangalore. Builds include a voice receptionist for a salon (about 300 calls and 240 confirmed bookings in a typical month) and Jarvis, an agent that turns a Slack request into a Linear ticket.'],
    ['sf', 'Oaklet', 'Oaklet, San Francisco (Sep–Oct 2025).'],
    ['seattle', 'Centific', 'Centific, Bellevue (May 2024–Aug 2025): first full-time role after the master\'s, across three AI teams.'],
    ['seattle', 'Catch the leak', 'Two 2025 workshop papers: Scalable Multilingual PII Annotation for Responsible AI in LLMs (IEEE ICDM Workshops) and LegalWiz, multi-agent contradiction detection in legal documents (NeurIPS GenProCC, co-author).'],
    ['irving', '7-Eleven', '7-Eleven, Data Scientist co-op (Jun–Dec 2022): PySpark ETL across 10+ sources (data accuracy up 18%, KPI runtimes down 23.7%); clustering of 1,000+ promotional offers at 98.2% accuracy.'],
    ['boston', 'Northeastern University', 'Master\'s, Northeastern University, Boston.'],
    ['blr', 'ANA Packaging & Trading', 'A year at ANA Packaging & Trading, a paper-cup factory (2020–21), straight through COVID.'],
    ['blr', 'PES University', 'Bachelor\'s in mechanical engineering at PES University, Bangalore. Grew up in Nadiad, Gujarat, where the family runs a dairy farm.'],
  ];
  $('#quickList').innerHTML = facts.map(([id, t, txt]) => { const [ci, k] = spotIdx(id, t); return `<li>${esc(txt)} <button class="go" type="button" data-go="${ci}:${k}">See it</button></li>`; }).join('');
  $('#quickContact').innerHTML = contactHtml();

  // Skills index
  const sk = skillIndex();
  $('#skillList').innerHTML = sk.map(r => `<li><button type="button" data-go="${r.ci}:${r.k}"><b>${esc(r.skill)}</b><span>${esc(r.where)}</span>${r.mission ? '<em>try it</em>' : ''}</button></li>`).join('');

  $('#howRepo').href = REPO;

  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-close]')) { closeModals(); return; }
    const go = e.target.closest('[data-go]'); if (go) { const [ci, k] = go.dataset.go.split(':').map(Number); closeModals(); onGo(ci, k); return; }
    const cp = e.target.closest('[data-copy]'); if (cp) copyMail(cp);
  }));
}

export function copyMail(b) {
  const t = CONTACT.email; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { b.textContent = 'Copied'; }).catch(() => { b.textContent = 'Select it to copy'; });
}

/** stamped: Set<ci>; missions: Set<"ci:k"> of completed missions. */
export function renderPassport(stamped, missions) {
  const total = STOPS.length;
  $('#stampGrid').innerHTML = STOPS.map((s, i) => {
    const got = stamped.has(i), star = [...missions].some(m => m.startsWith(i + ':'));
    const sub = STOPS.findIndex((o, j) => j < i && o.name === s.short) >= 0 || /again/i.test(s.name) ? 'AGAIN' : s.coord.split(',')[0];
    return `<div class="stamp${got ? ' got' : ''}" style="--c:${s.stamp};--r:${(i * 37) % 17 - 8}deg" aria-label="${esc(s.name)}: ${got ? 'stamped' : 'not yet'}${star ? ', mission done' : ''}">${esc((s.short || s.name).replace(', again', ''))}<small>${esc(sub)}</small>${star ? '<span class="star">★ mission</span>' : ''}</div>`;
  }).join('');
  $('#passLine').textContent = stamped.size ? `${stamped.size} of ${total} stamps · ${missions.size} mission${missions.size === 1 ? '' : 's'} done.` : 'Visit a city and open one of its spots to get its stamp. Finish a demo to add a mission mark.';
  const done = stamped.size === total; $('#passDone').hidden = !done; if (done) $('#passDone .c').innerHTML = contactHtml();
}
