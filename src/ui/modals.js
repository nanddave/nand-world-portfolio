// Modals: contact sheet, 30-second version (recruiter page), founders sheet, passport, skills index, how this was built.
import { STOPS, CONTACT, isReal, HEADLINE, SUMMARY, BEST_FOR, PAPERS, EDU, ROLES, PROJECTS, OFFERS } from '../content/stops.js';
import { renderProject } from '../content/readable.js';
import { skillIndex } from '../core/skills.js';
import { VISITOR } from '../core/visitor.js';
import { esc } from './worklog.js';

const $ = s => document.querySelector(s);
const REPO = 'https://github.com/nanddave/nand-world-portfolio';
const resumeUrl = __SINGLE__ ? new URL(CONTACT.resume, CONTACT.site).href : CONTACT.resume;
const resumeLabel = __SINGLE__ ? 'Résumé (PDF, online)' : 'Résumé (PDF)';
let lastFocus = null;
let onOpen = null, onProjectClose = null;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
const openOne = () => [...document.querySelectorAll('.modal')].find(m => !m.hidden) || null;
export function openModal(id) {
  const m = $(id); if (!m) return;
  onOpen?.();
  // keep the original opener when hopping from one sheet to another, so Esc returns focus to the real trigger
  if (!openOne()) lastFocus = document.activeElement;
  document.querySelectorAll('.modal').forEach(x => { x.hidden = true; });
  m.hidden = false; m.querySelector('.sheet')?.scrollTo?.(0, 0); (m.querySelector('[data-autofocus]') || m.querySelector(FOCUSABLE))?.focus({ preventScroll: true });
}
export function closeModals(notify = true) { let any = false; const projectOpen = !$('#project').hidden; document.querySelectorAll('.modal').forEach(m => { if (!m.hidden) any = true; m.hidden = true; }); if (any) { const target = lastFocus?.isConnected && lastFocus.getClientRects().length && getComputedStyle(lastFocus).visibility === 'visible' ? lastFocus : document.querySelector('#card.open #cardX, .stopb.on, #menuBtn'); target?.focus?.(); } if (projectOpen && notify) onProjectClose?.(); return any; }
const spotIdx = (id, t) => { const ci = STOPS.findIndex(s => s.id === id); return [ci, Math.max(0, STOPS[ci].spots.findIndex(sp => sp.t === t))]; };

/** mailto with a subject; "Hello from <Company>" when ?for=Company is set. */
export const mailHref = (subject) => isReal(CONTACT.email) ? `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject || (VISITOR.company ? `Hello from ${VISITOR.company}` : 'Hello from Nand\'s World'))}` : '#';
export function openProject(id) { const p = PROJECTS.find(item => item.id === id); if (!p) return false; $('#projectT').textContent = p.name; $('#projectBody').innerHTML = renderProject(p, { anchor:false, title:false }); $('#projectVisit').dataset.projectVisit = p.id; $('#projectContact').href = mailHref(); openModal('#project'); return true; }

function contactHtml() {
  const a = (h, label, ext) => isReal(h) ? `<a class="btn small" href="${esc(h)}"${ext ? ' rel="noopener" target="_blank"' : ''}>${label}</a>` : '';
  const mail = isReal(CONTACT.email) ? `<code>${esc(CONTACT.email)}</code><button class="btn small" type="button" data-copy>Copy email</button>` : '';
  const html = mail + a(resumeUrl, resumeLabel, 1) + a(CONTACT.linkedin, 'LinkedIn', 1) + a(CONTACT.github, 'GitHub', 1) + a(CONTACT.site, 'Website', 1);
  return html ? `<div class="contact">${html}</div>` : '';
}

export function setupModals({ onGo, onTrip, onBlockingOpen, onProject, onCloseProject }) {
  onOpen = onBlockingOpen;
  onProjectClose = onCloseProject;
  // 30-second version: every line comes from src/content/stops.js (numbers match the story cards).
  $('#quickHead').textContent = HEADLINE; $('#quickSum').textContent = SUMMARY;
  const facts = [
    ['seattle', 'Centific', 'Centific: audio pipeline on Azure Blob Storage and Label Studio, 6,000+ hours a week across 6+ locales. Processing time down 70%, failures down 85%, 99.5% uptime.'],
    ['brokai', 'The salon (US client)', 'Brokai Labs: AI voice receptionist (Retell) for a US salon, Brokai\'s first paying customer, from discovery to rollout. About 300 calls and about 240 confirmed bookings a month.'],
    ['brokai', 'Brokai Labs', 'Led a résumé-ingestion and candidate-ranking workflow used to screen 300+ applicants. Built Jarvis, a LiveKit voice agent evaluated on 30–40 cases per round.'],
    ['blr', 'ANA Packaging & Trading', 'Founder, ANA (paper cups): stockouts down 17%, payment defaults down 70%, order conversion up 16.2%.'],
    ['irving', '7-Eleven', '7-Eleven: PySpark ETL across 10+ sources (data accuracy up 18%, KPI runtimes down 23.7%); clustering of 1,000+ promotional offers at 98.2% accuracy.'],
  ];
  const seeIt = ([ci, k]) => `<button class="go" type="button" data-go="${ci}:${k}">See it</button>`;
  $('#quickList').innerHTML = facts.map(([id, t, txt]) => `<li>${esc(txt)} ${seeIt(spotIdx(id, t))}</li>`).join('');
  $('#quickRoles').innerHTML = ROLES.map(r => `<li><span><b>${esc(r.role)}</b>, ${esc(r.org)} <small>${esc(r.place)}</small></span><span class="when">${esc(r.when)} ${seeIt(spotIdx(...r.where))}</span></li>`).join('');
  $('#quickPapers').innerHTML = PAPERS.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a><small>${esc(p.venue)}.</small></li>`).join('');
  $('#quickEdu').innerHTML = EDU.map(e => `<li><b>${esc(e.school)}</b><small>${esc(e.what)}</small></li>`).join('');
  const link = (h, label, cls = 'btn small', ext = 1) => isReal(h) ? `<a class="${cls}" href="${esc(h)}"${ext ? ' rel="noopener" target="_blank"' : ''}>${label}</a>` : '';
  $('#quickContact').innerHTML = link(resumeUrl, resumeLabel) + link(mailHref(), 'Email Nand', 'btn small', 0) + link(CONTACT.linkedin, 'LinkedIn');

  // Contact sheet
  $('#talkBest').textContent = BEST_FOR;
  const tm = $('#talkMail'); tm.href = mailHref(); tm.textContent = `Email ${CONTACT.email}`;
  const tl = $('#talkLi'); isReal(CONTACT.linkedin) ? tl.href = CONTACT.linkedin : tl.hidden = true;
  const tc = $('#talkCv'); isReal(CONTACT.resume) ? (tc.href = resumeUrl, tc.textContent = resumeLabel) : tc.hidden = true;
  const tg = $('#talkGh'); isReal(CONTACT.github) ? tg.href = CONTACT.github : tg.hidden = true;

  // Founders sheet: three offers, each grounded in delivered work
  $('#offerList').innerHTML = OFFERS.map(([t, d, id, st]) => `<li><div><b>${esc(t)}</b><span>${esc(d)}</span></div>${seeIt(spotIdx(id, st)).replace('class="go"', 'class="btn small"')}</li>`).join('');
  // A real booking link (CONTACT.booking) replaces the email fallback once one exists.
  if (isReal(CONTACT.booking)) { $('#callBtn').textContent = 'Book a 30-minute call'; $('#callBtn').target = '_blank'; }
  $('#callBtn').href = isReal(CONTACT.booking) ? CONTACT.booking : mailHref(VISITOR.company ? `20-min call: ${VISITOR.company}` : '20-min call');
  $('#buildLinkedin').href = CONTACT.linkedin; $('#buildLinkedin').hidden = !isReal(CONTACT.linkedin);
  $('#buildResume').href = resumeUrl; $('#buildResume').textContent = resumeLabel; $('#buildResume').hidden = !isReal(CONTACT.resume);

  // Skills index
  const sk = skillIndex();
  $('#skillProjects').innerHTML = PROJECTS.map(p => `<button type="button" data-project="${esc(p.id)}">Inspect ${esc(p.name)}</button>`).join('');
  $('#skillPapers').innerHTML = PAPERS.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">Read ${esc(p.title)}</a></li>`).join('');
  $('#skillList').innerHTML = sk.map(r => `<li><button type="button" data-go="${r.ci}:${r.k}"><b>${esc(r.skill)}</b><span>${esc(r.where)}</span>${r.mission ? `<em>${r.mission === 'train' ? 'Try browser training' : 'Try an illustration'}</em>` : ''}</button></li>`).join('');
  $('#projectsList').innerHTML = PROJECTS.map(p => `<div><h3>${esc(p.name)}</h3><p>${esc(p.status)}</p><p>${esc(p.text)}</p><button type="button" class="btn small" data-project="${esc(p.id)}">Open ${esc(p.name)}</button></div>`).join('');

  if (isReal(REPO)) $('#howRepo').href = REPO; else $('#howRepo').hidden = true;

  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-close]')) { closeModals(); return; }
    const project = e.target.closest('[data-project]'); if (project) { (onProject || openProject)(project.dataset.project); return; }
    const visit = e.target.closest('[data-project-visit]'); if (visit) { const p = PROJECTS.find(item => item.id === visit.dataset.projectVisit); if (p) { closeModals(false); onGo(...spotIdx(...p.where)); } return; }
    const go = e.target.closest('[data-go]'); if (go) { const [ci, k] = go.dataset.go.split(':').map(Number); closeModals(); onGo(ci, k); return; }
    if (e.target.closest('#quickTrip,#buildTrip')) { closeModals(); onTrip?.(); return; }
    if (e.target.closest('[data-founders]')) { openModal('#build'); return; }
    if (e.target.closest('[data-quick]')) { openModal('#quick'); return; }
    if (e.target.closest('[data-skills]')) { openModal('#skills'); return; }
    const cp = e.target.closest('[data-copy]'); if (cp) copyMail(cp);
  }));
  // focus trap: Tab and Shift+Tab stay inside the open sheet
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return; const m = openOne(); if (!m) return;
    const f = [...m.querySelectorAll(FOCUSABLE)].filter(x => !x.hidden && x.offsetParent !== null); if (!f.length) return;
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!m.contains(a)) { first.focus(); e.preventDefault(); }
    else if (e.shiftKey && a === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && a === last) { first.focus(); e.preventDefault(); }
  });
}

export function copyMail(b) {
  const t = CONTACT.email; if (!isReal(t)) return; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { b.textContent = 'Copied'; }).catch(() => { b.textContent = 'Select it to copy'; });
}

const MISSION_TOTAL = STOPS.reduce((n, s) => n + s.spots.filter(sp => sp.mission).length, 0);
/** Passport chip: "Missions 2/9 · Stamps 3/7" on desktop, "3/7" badge on small screens. */
export function setProgress(stamped, missions) {
  const line = `Missions ${missions.size}/${MISSION_TOTAL} · Stamps ${stamped.size}/${STOPS.length}`;
  $('#passProg').textContent = line; $('#passN').textContent = `${stamped.size}/${STOPS.length}`; $('#passBtn').setAttribute('aria-label', `Passport. ${line}`);
}

/** stamped: Set<ci>; missions: Set<"ci:k"> of completed missions. */
export function renderPassport(stamped, missions) {
  const total = STOPS.length;
  $('#stampGrid').innerHTML = STOPS.map((s, i) => {
    const got = stamped.has(i), star = [...missions].some(m => m.startsWith(i + ':'));
    const sub = STOPS.findIndex((o, j) => j < i && o.name === s.short) >= 0 || /again/i.test(s.name) ? 'AGAIN' : s.coord.split(',')[0];
    return `<div class="stamp${got ? ' got' : ''}" style="--c:${s.stamp};--r:${(i * 37) % 17 - 8}deg" aria-label="${esc(s.name)}: ${got ? 'stamped' : 'not yet'}${star ? ', mission done' : ''}">${esc((s.short || s.name).replace(', again', ''))}<small>${esc(sub)}</small>${star ? '<span class="star">★ mission</span>' : ''}</div>`;
  }).join('');
  setProgress(stamped, missions);
  $('#passLine').textContent = stamped.size ? `${stamped.size} of ${total} stamps · ${missions.size} of ${MISSION_TOTAL} missions done.` : 'Visit a city and open one of its spots to get its stamp. Finish a demo to add a mission mark.';
  const done = stamped.size === total; $('#passDone').hidden = !done; const ch = contactHtml(); if (done) $('#passDone .c').innerHTML = ch; $('#passDone').hidden = !done || !ch;
}
