// App shell: globe travel, city scenes, story cards with live missions, passport, co-pilot, sound.
import { FIXED_FPS } from './core/vtime.js'; // first: installs the virtual clock when recording (&fixed=30)
import './styles/tokens.css';
import './styles/app.css';
import { THREE, CARS, setHeroKind } from './kit/kit.js';
import { STOPS, MISSION_TEASE, PROJECTS, CONTACT } from './content/stops.js';
import { VISITOR } from './core/visitor.js';
import { createGlobe, km, nadiadTime } from './core/globe.js';
import { createCityView } from './core/cityview.js';
import { createDrive } from './core/drive.js';
import { liveFor, localTime } from './core/live.js';
import { createPost } from './core/post.js';
import { Sound } from './core/sound.js';
import { createTrailer } from './core/trailer.js';
import { ask, search, SUGGESTIONS, PERSONA_SUGGESTIONS, CATEGORIES } from './core/copilot.js';
import { createCard } from './ui/card.js';
import { setupModals, openModal, closeModals, openProject, renderPassport, setProgress } from './ui/modals.js';

// Missions' stylesheet, if the missions agent has added one.
import.meta.glob('./missions/*.css', { eager: true });

const $ = s => document.querySelector(s);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SMALL = Math.min(innerWidth, innerHeight) < 800 && innerWidth < 800;
const LAST = STOPS.length - 1;
const short = s => (s.short && /again/i.test(s.name) ? s.short : s.name).replace(', again', '');

// Let the browser paint the static hero before WebGL setup and the first globe frame block the main thread (skipped while recording on the virtual clock).
if (!FIXED_FPS) await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

/* renderer */
const canvas = $('#scene');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch (e) { console.error('WebGL unavailable', e); }
if (!renderer) {
  $('#readableNotice').textContent = 'The 3D journey could not start. You can read the same career and contact details here.';
  const project = PROJECTS.find(p => p.id === new URLSearchParams(location.search).get('project'));
  if (project) document.getElementById(`project-${project.id}`)?.scrollIntoView();
  throw new Error('WebGL unavailable: showing the readable résumé');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, SMALL ? 1.5 : 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setClearColor(0x0B1026);
const post = createPost(renderer, !SMALL);

if (new URLSearchParams(location.search).get('draft') === '1') document.body.classList.add('draft'); // shows the unfinished .todo paragraphs

/* state */
const state = { mode: 'intro', cityIdx: -1, spot: -1, stamped: new Set(), missions: new Set(), pending: null, transit: false };
const globe = createGlobe({ small: SMALL, reduce: REDUCE, pinsEl: $('#pins'), onPin: i => jumpTo(i) });
const city = createCityView({ reduce: REDUCE, spotsEl: $('#pins'), onSpot: k => selectSpot(k) });
city.drive = createDrive({ cam: city.cam, reduce: REDUCE });
const drive = city.drive;
let motionPaused = REDUCE;
function setMotionPaused(paused) { motionPaused = paused; city.paused = globe.paused = paused; document.body.classList.toggle('motion-paused', paused); const b = $('#motionBtn'); b.textContent = paused ? 'Resume scene motion' : 'Pause scene motion'; b.setAttribute('aria-pressed', String(paused)); }
setMotionPaused(motionPaused);
const keys = new Set(), joy = { on: false, id: null, el: $('#joy') }, knob = joy.el.querySelector('i');
function resetInput() { keys.clear(); joy.on = false; joy.id = null; knob.style.transform = ''; drive.input.throttle = drive.input.steer = 0; drive.input.brake = false; drive.speed = 0; }
const app = { state, globe, city, drive, renderer, skipRender: false, resize: () => resize() };
const trailer = createTrailer(app); // Phase 3.1: scripted demo video (?trailer=1, or the intro button)
const card = createCard({
  reduce: REDUCE,
  onNext: (ci, k) => { if (ci < 0) { card.close(); unfocus(); finish(); return; } const n = STOPS[ci].spots.length; if (k < n - 1) selectSpot(k + 1); else if (ci < LAST) { pushRoute({ci:ci+1}); travelTo(ci + 1); } else finish(); },
  onClose: () => { unfocus(); if (state.cityIdx >= 0) history.replaceState(null,'',routeURL({ci:state.cityIdx})); chips[state.cityIdx]?.focus(); },
  onComplete: (ci, k) => { state.missions.add(ci + ':' + k); stamp(ci); updateChips(); pilotSay(`Mission done: ${STOPS[ci].spots[k].t}. That's a star on your ${short(STOPS[ci])} stamp.`); maybeToast(); },
});

/* intro personalisation */
if (VISITOR.company) { const f = $('#introFor'); f.hidden = false; f.textContent = `Made for ${VISITOR.company}`; }

/* chips along the bottom */
const chips = STOPS.map((s, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'stopb'; b.innerHTML = `<b>${i + 1}</b>${s.name}`; b.setAttribute('aria-label', `Stop ${i + 1}: ${s.name}`); b.addEventListener('click', () => jumpTo(i)); $('#stops').appendChild(b); return b; });
function updateChips() {
  chips.forEach((c, i) => { const on = state.mode === 'city' ? i === state.cityIdx : i === globe.target && state.mode !== 'intro'; c.classList.toggle('on', on); c.classList.toggle('stamped', state.stamped.has(i)); if (on) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current'); });
  globe.setPinsDone(state.stamped); setProgress(state.stamped, state.missions);
}

/* live time + weather (optional; the designed look is the fallback) */
const QS = new URLSearchParams(location.search), FORCE_DESIGNED = QS.get('mood') === 'designed';
const initialProject = PROJECTS.find(p => p.id === QS.get('project'));
const moodPref = { get() { try { return localStorage.getItem('nw.mood'); } catch { return null; } }, set(v) { try { localStorage.setItem('nw.mood', v); } catch { /* ignore */ } } };
let liveMood = null; // { C, w, hour, live }
const wxText = w => { const k = w.rain || w.snow; return w.label === 'rain' || w.label === 'snow' ? (k <= .5 ? 'light ' : k >= 1 ? 'heavy ' : '') + w.label : w.label; };
// Rain and snow are heard in the designed scenes that show them; live mode follows the real weather instead.
const DESIGNED_WX = { boston: { snow: 1 }, seattle: { rain: .8 } };
const soundFor = (id, live, w) => Sound.weather(live && w ? { rain: w.rain, snow: w.snow, thunder: w.label === 'thunderstorm' } : DESIGNED_WX[id] || null);
function applyMood(live) {
  const m = liveMood; if (!m) return; m.live = live; soundFor(STOPS[state.cityIdx]?.id, live, m.w);
  document.body.classList.toggle('live-mood', !!live);
  $('#cScene').textContent = live ? 'Live weather scene' : 'Designed scene';
  if (live && m.w) m.C.setMood({ hour: m.hour, isDay: m.w.isDay, cloud: m.w.cloud, rain: m.w.rain, snow: m.w.snow, fog: m.w.fog, temp: m.w.temp }); else m.C.resetMood?.();
  const b = $('#moodBtn'); b.textContent = live ? 'Live' : 'Designed'; b.setAttribute('aria-pressed', String(live)); b.title = live ? 'Showing live weather. Switch to the designed look.' : 'Showing the designed look. Switch to live weather.';
}
async function setupLive(i, C) {
  liveMood = null; $('#cScene').textContent = 'Designed scene'; $('#cLive').hidden = true; $('#moodBtn').hidden = true; $('#cWxCredit').hidden = true;
  const s = STOPS[i]; let r; try { if (__SINGLE__) { const t = localTime(s.tz); r = { timeText:t.text, hour:t.hour, weather:null }; } else r = await liveFor(s); } catch { return; }
  if (state.cityIdx !== i || state.mode !== 'city') return;
  const place = s.name.split(/ &|,/)[0].trim(), w = r.weather;
  $('#cLiveT').textContent = w ? `Local time: ${r.timeText} · Live weather: ${w.temp}°C, ${wxText(w)} in ${place}` : `Local time: ${r.timeText} in ${place}`;
  $('#cLive').hidden = false; $('#cWxCredit').hidden = !w;
  liveMood = { C, w, hour: r.hour, live: false };
  if (!w) return;
  $('#moodBtn').hidden = false;
  applyMood(!FORCE_DESIGNED && moodPref.get() === 'live');
}
$('#moodBtn').addEventListener('click', () => { if (!liveMood) return; applyMood(!liveMood.live); moodPref.set(liveMood.live ? 'live' : 'designed'); });

/* flow */
const fade = on => $('#fade').classList.toggle('on', on);
const wait = ms => new Promise(r => setTimeout(r, REDUCE ? 0 : ms));
function begin() { if (state.mode !== 'intro') return; state.mode = 'globe'; document.body.classList.add('on'); globe.view = 'travel'; Sound.play('globe'); }
/* day/night intro: the sun sweeps one stylised day in 3 s and lands on the real current position, then the trip starts */
async function daySweep() {
  if (REDUCE || motionPaused || trailer.active || QS.has('trailer')) return;
  const cap = $('#daycap'), t = nadiadTime(); globe.view = 'orbit'; globe.faceIndia();
  if (t) { cap.textContent = `Right now in Nadiad: ${t}`; cap.classList.add('show'); }
  await globe.sweep(3); cap.classList.remove('show');
}
$('#startBtn').addEventListener('click', async () => { begin(); globe.u = 0; await daySweep(); if (state.mode === 'globe') travelTo(0); });
$('#soundBtn').addEventListener('click', () => Sound.set(!Sound.on));
Sound.onChange = on => { const b = $('#soundBtn'); b.querySelector('.sound-label').textContent = on ? 'Sound on' : 'Sound off'; b.setAttribute('aria-label', on ? 'World sound on' : 'World sound off'); b.setAttribute('aria-pressed', String(on)); };
async function toIntro() { const request = ++jumpVersion; globe.cancelSweep(); $('#daycap').classList.remove('show'); if (state.mode === 'city') await exitCity(); if (request !== jumpVersion) return; state.mode = 'intro'; state.transit = false; globe.view = 'intro'; globe.faceIndia(); document.body.classList.remove('on'); $('#travel').classList.remove('show'); updateChips(); }
$('#home').addEventListener('click', e => { e.preventDefault(); pushRoute(); restoreRoute(); });
/* trailer entry points: the intro button, or ?trailer=1 (autoplay). Esc stops it and returns to the intro. */
trailer.onStop = () => { state.mode = 'intro'; state.cityIdx = -1; state.transit = false; globe.view = 'intro'; globe.u = 0; globe.faceIndia(); document.body.classList.remove('on', 'incity'); $('#travel').classList.remove('show'); Sound.play('globe'); updateChips(); };
$('#trailerBtn').addEventListener('click', () => { closeModals(); if (state.mode === 'intro') trailer.start(); else toIntro().then(() => trailer.start()); });
if (QS.has('trailer')) trailer.start();

/** Go to stop i (and optionally open spot k there). Works from intro, globe or another city. */
let jumpVersion = 0, titleTimer = 0, titleDue = false;
function routeURL({ project, ci, k } = {}) {
  const url = new URL(location.href); for (const key of ['project','stop','spot','drive','yours']) url.searchParams.delete(key);
  if (project) url.searchParams.set('project', project);
  else if (ci != null && STOPS[ci]) { url.searchParams.set('stop', STOPS[ci].id); if (Number.isInteger(k) && k >= 0 && k < STOPS[ci].spots.length) url.searchParams.set('spot', String(k)); }
  return url;
}
function pushRoute(route, extra = {}) { const url = routeURL(route); if (url.href !== location.href) history.pushState(extra, '', url); }
function selectProject(id) { if (!PROJECTS.some(p => p.id === id)) return; const previous = location.href; pushRoute({project:id}, {projectReturn:previous}); openProject(id); }
function selectSpot(k) { if (state.cityIdx >= 0 && STOPS[state.cityIdx]?.spots[k]) pushRoute({ci:state.cityIdx,k}); focusSpot(k); }
function closeProjectRoute() { const previous = history.state?.projectReturn; const url = previous ? new URL(previous) : routeURL(); history.replaceState(null,'',url); restoreRoute(); }
async function restoreRoute() {
  const q = new URLSearchParams(location.search), project = PROJECTS.find(p => p.id === q.get('project'));
  closeModals(false);
  if (project) { openProject(project.id); return; }
  const ci = STOPS.findIndex(s => s.id === q.get('stop'));
  if (ci >= 0) { const raw = q.get('spot'), k = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null; await jumpTo(ci, k !== null && k < STOPS[ci].spots.length ? k : undefined, false); return; }
  ++jumpVersion; resetInput(); globe.cancelSweep(); $('#daycap').classList.remove('show'); card.close(); city.hide(); clearTimeout(titleTimer); state.mode = 'intro'; state.cityIdx = -1; state.custom = null; state.transit = false; globe.view = 'intro'; globe.faceIndia(); document.body.classList.remove('on','incity','focus'); $('#ctitle').classList.remove('show','compact'); $('#travel').classList.remove('show'); fade(false); updateChips();
  const role = q.get('role'); if (role === 'recruiter') openModal('#quick'); else if (role === 'founder') openModal('#build');
}
addEventListener('popstate', () => { restoreRoute(); });
function compactTitle() { titleDue = true; if ($('#ctitle').contains(document.activeElement)) return; $('#ctitle').classList.add('compact'); }
$('#ctitle').addEventListener('focusout', e => { if (!$('#ctitle').contains(e.relatedTarget) && titleDue) compactTitle(); });
async function jumpTo(i, k, writeHistory = true) {
  if (!STOPS[i] || (k !== undefined && (!Number.isInteger(k) || !STOPS[i].spots[k]))) return;
  if (writeHistory) pushRoute({ci:i,k});
  const request = ++jumpVersion;
  if (state.mode === 'intro') begin();
  if (state.mode === 'city' && state.cityIdx === i && !state.transit) { if (k !== undefined) focusSpot(k); else if (card.isOpen()) { card.close(); unfocus(); } return; }
  state.mode = 'loading'; state.transit = true; state.pending = k ?? null; resetInput(); globe.cancelSweep(); $('#daycap').classList.remove('show');
  $('#travelK').textContent = 'Loading'; $('#travelT').textContent = STOPS[i].name; $('#travel').classList.add('show');
  const C = await city.load(i); if (request !== jumpVersion) return;
  card.close(); city.hide(); document.body.classList.remove('incity','focus'); $('#ctitle').classList.remove('show'); clearTimeout(titleTimer);
  liveMood?.C.resetMood?.(); liveMood = null; document.body.classList.remove('live-mood');
  globe.u = globe.stopU[i]; globe.setTarget(i); state.mode = 'globe'; state.transit = false; updateChips();
  await enterCity(i, request, C);
  if (request === jumpVersion) $('#travel').classList.remove('show');
}
async function travelTo(i, k) {
  const request = jumpVersion;
  state.pending = k === undefined ? null : k;
  if (state.mode === 'intro') begin();
  if (state.mode === 'city') {
    if (state.cityIdx === i) { if (k !== undefined) { state.pending = null; focusSpot(k); } return; }
    await exitCity();
    if (request !== jumpVersion) return;
  }
  if (state.transit) return;
  city.load(i); // start building the destination while we travel
  const from = globe.curStop(); globe.setTarget(i); updateChips();
  if (from === i) { onArrive(i); return; }
  const { fly, km } = globe.legInfo(from, i);
  $('#travelK').textContent = `${fly ? 'Flying' : 'Driving'}, ${km.toLocaleString('en-US')} km`;
  $('#travelT').textContent = `${STOPS[from].name} → ${STOPS[i].name}`; $('#travel').classList.add('show');
}
globe.onArrive = i => { if (!trailer.active) onArrive(i); };
async function onArrive(i) { $('#travel').classList.remove('show'); await wait(900); if (globe.target === i && state.mode === 'globe') enterCity(i); }

async function enterCity(i, request = jumpVersion, ready = null) {
  if (state.mode === 'city' || state.transit) return; state.transit = true; fade(true);
  const [C] = await Promise.all([ready || city.load(i), wait(ready ? 200 : 600)]);
  if (request !== jumpVersion) return;
  const s = STOPS[i]; state.mode = 'city'; state.cityIdx = i; state.spot = -1;
  globe.view = 'hidden'; globe.hidePins(); city.show(i, C);
  document.body.classList.add('incity');
  $('#cStop').textContent = `Stop ${i + 1} of ${STOPS.length}`; $('#cName').textContent = s.name; $('#cMeta').innerHTML = `${s.region}<br>${s.coord}<br><span class="designed-mood">Designed scene: ${s.mood}</span>`; $('#cCredit').textContent = C.credit || ''; setDriveUI(); $('#ctitle').classList.add('show'); $('#ctitle').classList.toggle('compact', REDUCE); clearTimeout(titleTimer); titleDue = REDUCE; if (!REDUCE) titleTimer = setTimeout(compactTitle, 2400); setupLive(i, C);
  refreshNext();
  soundFor(s.id, false); Sound.play(C.cfg?.sound || s.id); updateChips(); fade(false); state.transit = false;
  if (state.pending !== null) { const p = state.pending; state.pending = null; setTimeout(() => { if (request === jumpVersion && state.cityIdx === i && state.spot === -1) focusSpot(p); }, REDUCE ? 0 : 1300); }
  else pilotSay(`Welcome to ${s.name}. Tap a yellow marker to explore, or ask me something.`);
  if (!pilotWelcomed && innerWidth >= 800) { pilotWelcomed = true; schedulePilot(); }
  window.__city = s.id;
}
async function exitCity() {
  if (state.transit || state.mode !== 'city') return; const request = jumpVersion; state.transit = true; card.close(); fade(true); await wait(600); if (request !== jumpVersion) return;
  setDrive(false); state.mode = 'globe'; city.hide(); globe.view = 'travel'; document.body.classList.remove('incity', 'focus'); $('#ctitle').classList.remove('show','compact'); clearTimeout(titleTimer); liveMood?.C.resetMood?.(); liveMood = null; document.body.classList.remove('live-mood');
  Sound.weather(null); Sound.play('globe'); fade(false); state.transit = false; state.cityIdx = -1; state.custom = null; updateChips();
}
/** Last stop's continue: with a company, take them to the empty lot first; then back to the globe to roam. */
async function finish() {
  if (state.custom) { endTrip(); return; }
  const lot = STOPS[LAST].spots.findIndex(sp => sp.mission === 'lot');
  const seen = city.seen[LAST] || new Set();
  if (state.cityIdx === LAST && lot >= 0 && !seen.has(lot)) { focusSpot(lot); return; }
  if (state.cityIdx === LAST && !yours.offered && !trailer.active) { yours.offered = true; offerYours(); return; }
  endTrip();
}
async function endTrip() {
  const info = state.custom; await exitCity(); globe.view = 'orbit';
  if (info && info.lat != null) showDistance(info);
  pilotSay(VISITOR.company ? `That's the whole trip. Over to you, ${VISITOR.company}: open the passport for Nand's contact.` : 'That\'s the whole trip. Spin the earth, or open the passport for Nand\'s contact.');
}
$('#next').addEventListener('click', () => { const i = state.cityIdx; if (state.custom) finish(); else if (i < LAST) { pushRoute({ci:i+1}); travelTo(i + 1); } else finish(); });

/* The visitor's own city: a bonus stop after Brokai. It is not in STOPS, so passport and postcard counts stay at 7. */
const yours = { offered: false, busy: false };
const BLR = STOPS[LAST];
function offerYours() {
  $('#yoursForm').hidden = false; $('#yoursLoad').hidden = true; yours.busy = false; openModal('#yours');
}
$('#yoursForm').addEventListener('submit', e => { e.preventDefault(); const q = $('#yoursIn').value.trim(); if (q.length >= 2) goYours(q); });
$('#yoursSkip').addEventListener('click', () => { closeModals(); endTrip(); });
async function goYours(typed) {
  if (yours.busy) return; yours.busy = true;
  $('#yoursForm').hidden = true; const L = $('#yoursLoad'); L.hidden = false; L.textContent = __SINGLE__ ? 'Preparing the designed street…' : `Fetching real streets for ${typed} from OpenStreetMap…`;
  let res = null;
  try { if (!__SINGLE__) {
    const { loadYourCity } = await import('./core/yourcity.js'), ac = new AbortController();
    res = await Promise.race([loadYourCity(typed, { signal: ac.signal, timeoutMs: 6000 }), new Promise((_, rej) => setTimeout(() => { ac.abort(); rej(new Error('timeout')); }, 6500))]);
  } } catch (e) { console.info('your city: using the designed street', e && e.message); }
  const { buildYours } = await import('./cities/yours.js');
  const name = (res && res.name) || typed;
  const C = buildYours({ name, data: res ? res.data : null, company: VISITOR.company });
  yours.busy = false; closeModals();
  await showYours({ name, C, real: !!res, lat: res ? res.lat : null, lon: res ? res.lon : null });
}
async function showYours({ name, C, real, lat, lon }) {
  if (state.transit) return; state.transit = true; fade(true); await wait(600);
  if (state.mode === 'intro') begin();
  card.close(); setDrive(false); liveMood?.C.resetMood?.(); liveMood = null; document.body.classList.remove('live-mood'); $('#cLive').hidden = true; $('#moodBtn').hidden = true; $('#travel').classList.remove('show');
  const spots = [{ t: 'Your company here', m: 'The next stop', b: `<p>This lot is yours. If you're hiring for applied AI, this is where Nand would like to build next. The passport has his contact.</p><p><small>The building that rises is a stand-in, the same for every visitor.</small></p>` }];
  state.custom = { name, spots, lat, lon }; state.mode = 'city'; state.cityIdx = -2; state.spot = -1;
  globe.view = 'hidden'; globe.hidePins(); city.showCustom(C, { name, spots }); document.body.classList.remove('focus'); document.body.classList.add('incity');
  $('#cStop').textContent = 'Bonus stop'; $('#cName').textContent = name; $('#cMeta').innerHTML = real ? 'Your city<br>real streets from OpenStreetMap' : 'Your city<br>a designed street (live map data was not reachable)';
  $('#cCredit').textContent = C.credit || ''; setDriveUI(); $('#ctitle').classList.add('show');
  $('#next').textContent = 'Finish the trip'; Sound.weather(null); Sound.play(C.cfg?.sound || 'blr'); updateChips(); window.__city = 'yours';
  fade(false); state.transit = false;
  pilotSay(`Welcome to ${name}. The yellow marker is the empty lot.`);
}
function showDistance({ name, lat, lon }) {
  const d = Math.round(km(BLR, { lat, lon }) / 10) * 10; if (!isFinite(d)) return;
  $('#travelK').textContent = `${d.toLocaleString('en-US')} km as the crow flies`; $('#travelT').textContent = `${short(BLR)} → ${name}`;
  $('#travel').classList.add('show'); setTimeout(() => { if (state.mode !== 'city') $('#travel').classList.remove('show'); }, 5000);
}
$('#shareBtn').addEventListener('click', async () => { closeModals(); const { openPostcardDialog } = await import('./ui/postcard.js'); openPostcardDialog({ stamped: state.stamped, missions: state.missions, company: VISITOR.company }); });

/** Curiosity loop: once a city is finished, the Continue button teases the next stop's mission. */
const cityDone = ci => (city.seen[ci]?.size || 0) >= STOPS[ci].spots.length;
function continueLabel(ci) {
  const n = STOPS[ci + 1], sp = n.spots.find(x => x.mission), tz = sp && MISSION_TEASE[sp.mission];
  return cityDone(ci) && tz ? `Next: ${short(n)} — ${tz}` : `Continue to ${short(n)}`;
}
function refreshNext() {
  const i = state.cityIdx; if (state.custom || i < 0) return;
  $('#next').textContent = i < LAST ? continueLabel(i) : (VISITOR.company ? `Finish: next stop, ${VISITOR.company}` : 'Finish the trip');
}
function nextLabel(ci, k) {
  if (k < STOPS[ci].spots.length - 1) return 'Next spot';
  if (ci < LAST) return continueLabel(ci);
  return VISITOR.company ? `Finish: over to ${VISITOR.company}` : 'Finish the trip';
}
function focusSpot(k) {
  if (state.mode !== 'city') return;
  resetInput();
  if (state.custom) {
    const cu = state.custom, sp = cu.spots[0]; state.spot = 0; city.focus(0); document.body.classList.add('focus');
    card.openCustom({ kick: `${cu.name}, bonus stop`, title: sp.t, meta: sp.m, body: sp.b, nextLabel: 'Finish the trip', onOpen: () => city.C?.raiseLot?.(VISITOR.company || cu.name || 'You', { immediate: REDUCE }) });
    return;
  }
  const ci = state.cityIdx; k =Math.max(0, Math.min(k, STOPS[ci].spots.length - 1));
  state.spot = k; city.focus(k); document.body.classList.add('focus');
  card.open(ci, k, { scene: city.C, nextLabel: nextLabel(ci, k) }); stamp(ci); refreshNext();
}
function unfocus() { state.spot = -1; city.unfocus(); document.body.classList.remove('focus'); }
function stamp(i) {
  const fresh = !state.stamped.has(i); state.stamped.add(i); updateChips(); renderPassport(state.stamped, state.missions);
  if (fresh && state.stamped.size === STOPS.length) pilotSay('Your passport is full. Open it to send Nand a note.');
}

/* modals */
setupModals({ onGo: (ci, k) => jumpTo(ci, k), onTrip: () => { if (state.mode === 'intro') $('#startBtn').click(); }, onBlockingOpen: resetInput, onProject: selectProject, onCloseProject: closeProjectRoute });
if (__SINGLE__) { $('#resumeBtn').href = new URL(CONTACT.resume, CONTACT.site).href; $('#resumeBtn').textContent = 'Résumé (online)'; }
$('#cvLink').addEventListener('click', () => { closeModals(); resetInput(); document.body.classList.add('reading'); $('#returnWorld').focus(); });
$('#returnWorld').addEventListener('click', () => { document.body.classList.remove('reading'); $('#menuBtn').focus(); });
$('#menuBtn').addEventListener('click', () => openModal('#menu'));
$('#motionBtn').addEventListener('click', () => setMotionPaused(!motionPaused));
$('#copilotBtn').addEventListener('click', () => { closeModals(); if (state.mode === 'intro') begin(); pilotManual = true; setPilotMin(false); $('#askIn').focus(); });
$('#projectsBtn').addEventListener('click', () => openModal('#projects'));
$('#placesBtn').addEventListener('click', () => {
  const spots = state.custom?.spots || STOPS[state.cityIdx]?.spots || [];
  const list = $('#placesList'); list.replaceChildren();
  spots.forEach((spot, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = `${i + 1}. ${spot.t}${spot.mission ? ' — interactive demo' : ''}`; b.addEventListener('click', () => { closeModals(); selectSpot(i); }); list.appendChild(b); });
  // On phones the city header shows only name, stop and controls, so the scene details and credits live here.
  const info = [$('#cMeta').innerText.replace(/\n/g, ' · '), $('#cLive').hidden ? '' : $('#cLive').innerText, $('#cCredit').textContent].filter(Boolean);
  $('#placesInfo').textContent = info.join(' · ');
  openModal('#places');
});
$('#quickBtn').addEventListener('click', () => openModal('#quick'));
$('#quickBtn2').addEventListener('click', () => openModal('#quick'));
$('#talkBtn').addEventListener('click', () => openModal('#talk'));
$('#foundersLink').addEventListener('click', () => openModal('#build'));
$('#kBody').addEventListener('click', e => { if (e.target.closest('[data-founders]')) openModal('#build'); }); // "What I can build for you" inside the Brokai card

/* soft nudge after a mission: once per session, non-blocking */
const toastEl = $('#toast'); let toastDone = false, toastTimer = 0;
try { toastDone = sessionStorage.getItem('nw.toast') === '1'; } catch { /* ignore */ }
function hideToast() { toastEl.hidden = true; clearTimeout(toastTimer); }
function maybeToast() {
  if (toastDone || trailer.active) return; toastDone = true; try { sessionStorage.setItem('nw.toast', '1'); } catch { /* ignore */ }
  setTimeout(() => { toastEl.hidden = false; toastTimer = setTimeout(hideToast, 14000); }, 1200);
}
$('#toastX').addEventListener('click', hideToast);
$('#toastTalk').addEventListener('click', () => { hideToast(); openModal('#talk'); });

/* fast paths: ?role=recruiter opens the 30-second version, ?role=founder the founders sheet. The trip stays one click away. */
{ const role = (QS.get('role') || '').toLowerCase(), validStop = STOPS.some(s => s.id === QS.get('stop')); if (!QS.has('trailer')) { if (initialProject) openProject(initialProject.id); else if (!QS.get('yours') && !validStop) { if (role === 'recruiter') openModal('#quick'); else if (role === 'founder') openModal('#build'); } } }
$('#howBtn').addEventListener('click', () => openModal('#how'));
$('#skillsBtn').addEventListener('click', () => openModal('#skills'));
$('#passBtn').addEventListener('click', () => { renderPassport(state.stamped, state.missions); openModal('#pass'); });

/* co-pilot */
const pilotEl = $('#pilot'); let pilotTimer = 0, pilotManual = false, pilotWelcomed = false;
function schedulePilot() { clearTimeout(pilotTimer); if (!pilotManual && innerWidth >= 800) pilotTimer = setTimeout(() => { const selection = window.getSelection(); if (pilotEl.contains(document.activeElement) || (selection && !selection.isCollapsed && pilotEl.contains(selection.anchorNode)) || ('speechSynthesis' in window && speechSynthesis.speaking)) schedulePilot(); else setPilotMin(true); }, 8000); }
function pilotSay(t, match = '') { $('#pilotText').textContent = t; $('#pilotMatch').textContent = match || 'Searches the stories on this trip, right here in your browser.'; }
const qBtns = qs => qs.map(q => `<button type="button" data-q="${q}">${q}</button>`).join('');
/** Co-pilot chips: starter questions + "More topics" -> categories -> that category's questions. */
function showSugg(view = 'home', base = SUGGESTIONS) {
  const cat = CATEGORIES.find(([n]) => n === view);
  $('#sugg').innerHTML = view === 'home' ? qBtns(base) + '<button type="button" class="more" data-cat="topics">More topics</button>'
    : cat ? qBtns(cat[1]) + '<button type="button" class="more" data-cat="topics">‹ Topics</button>'
    : CATEGORIES.map(([n]) => `<button type="button" data-cat="${n}">${n}</button>`).join('') + '<button type="button" class="more" data-cat="home">‹ Back</button>';
}
showSugg();
/* voice: push-to-talk in (SpeechRecognition), spoken answer out (speechSynthesis). Both are the browser's own; nothing is recorded here. */
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
function stopSpeaking() { try { synth?.cancel(); } catch { /* ignore */ } }
function pickVoice() {
  const vs = (synth?.getVoices?.() || []).filter(v => /^en([-_]|$)/i.test(v.lang)); if (!vs.length) return null;
  const sc = v => (/natural|neural|enhanced|premium/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) + (/samantha|daniel|karen|moira|serena/i.test(v.name) ? 2 : 0) + (/^en[-_](US|GB|IN)/i.test(v.lang) ? 1 : 0);
  return vs.slice().sort((a, b) => sc(b) - sc(a))[0];
}
function speak(text) {
  if (!synth || !Sound.on || !text) return; stopSpeaking();
  try { const u = new SpeechSynthesisUtterance(text), v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US'; u.rate = 1; synth.speak(u); } catch { /* ignore */ }
}
const prevSoundChange = Sound.onChange; Sound.onChange = on => { prevSoundChange?.(on); if (!on) stopSpeaking(); };
async function runAsk(q, { voice = false } = {}) {
  if (/\bhapi\b/i.test(q)) { stopSpeaking(); selectProject('hapi'); return; }
  stopSpeaking(); pilotSay('Searching…');
  const r = await ask(q); if (voice) speak(r.text);
  if (r.match) {
    const m = r.match, label = m.label || `${STOPS[m.ci].name} · ${STOPS[m.ci].spots[m.k].t}`;
    pilotSay(r.text, r.source === 'faq' ? `Opening: ${label}` : `Matched: ${label}` + (m.score != null ? ` (score ${m.score.toFixed(2)})` : ' (remote answer)'));
    if (m.project) selectProject(m.project); else if (m.modal) { if (state.mode === 'intro') begin(); openModal(m.modal); } else jumpTo(m.ci, m.k);
  } else if (r.source === 'faq') pilotSay(r.text);
  else pilotSay(r.text, r.best ? `Closest: ${r.best.label} (score ${r.best.score.toFixed(2)}, below the 1.60 cut-off)` : 'No words matched any story.');
}
{
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const mic = document.createElement('button'); mic.type = 'button'; mic.id = 'micBtn'; mic.setAttribute('aria-pressed', 'false'); mic.setAttribute('aria-label', 'Ask by voice: click to start and stop listening'); mic.title = 'Ask by voice';
    mic.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    $('#ask').insertBefore(mic, $('#ask button[type=submit]'));
    let rec = null, heard = '';
    const setL = on => { mic.setAttribute('aria-pressed', String(on)); if (!on) $('#askIn').placeholder = 'Ask the co-pilot…'; };
    mic.addEventListener('click', () => {
      if (rec) { try { rec.stop(); } catch { /* ignore */ } return; }
      stopSpeaking(); heard = '';
      try {
        rec = new SR(); rec.lang = /^en/i.test(navigator.language || '') ? navigator.language : 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
        rec.onresult = e => { heard = Array.from(e.results).map(r => r[0].transcript).join(' ').trim(); $('#askIn').value = heard; };
        rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') pilotSay('The mic is blocked in this browser. You can type your question instead.'); else if (e.error === 'no-speech') pilotSay('I did not hear anything. Click the mic and try again.'); };
        rec.onend = () => { rec = null; setL(false); const q = heard.trim(); if (q) { $('#askIn').value = ''; runAsk(q, { voice: true }); } };
        rec.start(); setL(true); $('#askIn').placeholder = 'Listening…'; pilotSay('Listening… click the mic again when you are done.');
      } catch { rec = null; setL(false); }
    });
  }
}
$('#ask').addEventListener('submit', e => { e.preventDefault(); const i = $('#askIn'); const q = i.value.trim(); if (q) { runAsk(q); i.value = ''; } });
$('#sugg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.cat) showSugg(b.dataset.cat); else runAsk(b.dataset.q); });
function setPilotMin(min) { pilotEl.classList.toggle('min', min); const b = $('#pilotMin'); b.textContent = min ? '+' : '–'; b.setAttribute('aria-expanded', String(!min)); b.setAttribute('aria-label', min ? 'Expand co-pilot' : 'Minimise co-pilot'); }
$('#pilotMin').addEventListener('click', () => { const expand = pilotEl.classList.contains('min'); if (expand) pilotManual = true; setPilotMin(!expand); });
for (const event of ['pointerdown','keydown','focusin']) pilotEl.addEventListener(event, schedulePilot);
if (innerWidth < 800) setPilotMin(true);

/* input */
let drag = null;
canvas.addEventListener('pointerdown', e => { if (trailer.active) return; drag = { x: e.clientX, y: e.clientY }; globe.dragging = city.dragging = true; city.lastInteract = performance.now(); });
addEventListener('pointerup', () => { drag = null; globe.dragging = city.dragging = false; });
addEventListener('pointercancel', () => { drag = null; globe.dragging = city.dragging = false; });
addEventListener('pointermove', e => {
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
  if (state.mode === 'city') city.drag(dx, dy); else if (globe.view === 'intro' || globe.view === 'orbit') globe.drag(dx, dy);
});
canvas.addEventListener('wheel', e => { e.preventDefault(); if (trailer.active) return; if (state.mode === 'city') city.wheel(e.deltaY); }, { passive: false });
/* autopilot tour: asks who is watching, then drives a short route of the stories that matter most to them and ends on the
   matching sheet. Spots are [city id, spot title]. Any tap or key stops it. */
const PERSONAS = {
  recruiter: { chip: 'Hiring', end: '#quick', route: [['brokai', 'Brokai Labs'], ['brokai', 'The salon (US client)'], ['seattle', 'Centific'], ['irving', '7-Eleven'], ['seattle', 'Catch the leak'], ['boston', 'Northeastern University']] },
  founder: { chip: 'Founder', end: '#build', route: [['brokai', 'The salon (US client)'], ['brokai', 'Brokai Labs'], ['blr', 'ANA Packaging & Trading'], ['sf', 'Oaklet'], ['brokai', 'Your company here']] },
  engineer: { chip: 'Engineer', end: '#projects', route: [['brokai', 'Brokai Labs'], ['seattle', 'Catch the leak'], ['seattle', 'Agents that argue'], ['seattle', 'Centific'], ['irving', '7-Eleven'], ['boston', 'Northeastern University']] },
  curious: { chip: 'Explorer', end: null, route: [['nadiad', 'The lane I grew up on'], ['nadiad', 'The family farm'], ['blr', 'ANA Packaging & Trading'], ['boston', 'My first apartment'], ['sf', '24 hours at Y Combinator'], ['seattle', 'The badminton court']] },
};
const tour = { on: false, v: 0 }, pause = ms => new Promise(r => setTimeout(r, ms)); // reading time, even with reduced motion
function stopTour() { if (!tour.on) return; tour.on = false; tour.v++; document.body.classList.remove('touring'); $('#tourChip').hidden = true; }
async function runTour(key) {
  const P = PERSONAS[key]; if (tour.on || trailer.active || !P) return;
  closeModals(); tour.on = true; const v = ++tour.v; document.body.classList.add('touring'); $('#tourChip').textContent = `Autopilot tour · ${P.chip} · tap to stop`; $('#tourChip').hidden = false;
  showSugg('home', PERSONA_SUGGESTIONS[key]);
  const alive = () => tour.on && tour.v === v;
  const until = async fn => { const t0 = performance.now(); while (alive() && !fn() && performance.now() - t0 < 60000) await pause(200); return alive() && fn(); };
  try {
    for (const [id, title] of P.route) {
      if (!alive()) break;
      const i = STOPS.findIndex(s => s.id === id), k = STOPS[i].spots.findIndex(sp => sp.t === title);
      if (state.mode !== 'city' || state.cityIdx !== i) { card.close(); travelTo(i); if (!await until(() => state.mode === 'city' && state.cityIdx === i && !state.transit)) break; await pause(1500); }
      if (!alive()) break;
      focusSpot(k); await pause(5200);
    }
    if (alive()) { card.close(); unfocus(); if (P.end) { stopTour(); openModal(P.end); } }
  } finally { if (tour.v === v) stopTour(); }
}
const askPersona = () => { if (!tour.on && !trailer.active) openModal('#persona'); };
$('#persona').addEventListener('click', e => { const b = e.target.closest('[data-persona]'); if (b) runTour(b.dataset.persona); });
$('#tourBtn').addEventListener('click', askPersona);
$('#tourMenuBtn').addEventListener('click', askPersona);
$('#tourChip').addEventListener('click', stopTour);
for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, e => { if (tour.on && !e.target.closest?.('#tourChip, #tourBtn, #tourMenuBtn')) stopTour(); }, true);

/* drive mode: keyboard, joystick, HUD */
const hint = $('#driveHint'), prompt = $('#drivePrompt'), hornBtn = $('#hornBtn');
let hintShown = false, promptK = -2;
function setDriveUI() {
  const on = drive.active; document.body.classList.toggle('driving', on);
  const b = $('#driveBtn'); b.textContent = on ? 'Orbit' : 'Drive'; b.setAttribute('aria-pressed', String(on));
  if (!on) { prompt.hidden = true; promptK = -2; hint.classList.remove('show'); }
}
function setDrive(on) {
  if (on === drive.active) return;
  if (on) {
    if (state.mode !== 'city' || state.transit || card.isOpen() || !city.enterDrive()) return;
    if (!hintShown) { hintShown = true; hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), 6000); }
  } else { resetInput(); city.exitDrive(); }
  setDriveUI();
}
$('#driveBtn').addEventListener('click', () => setDrive(!drive.active));
const carPref = { get() { try { return localStorage.getItem('nw.car'); } catch { return null; } }, set(v) { try { localStorage.setItem('nw.car', v); } catch { /* ignore */ } } };
function setCar(id) {
  const kind = setHeroKind(id); city.setCar(kind); carPref.set(kind);
  $('#carBtn').textContent = `Car: ${CARS.find(c => c.id === kind).label}`;
}
const nextCar = () => setCar(CARS[(CARS.findIndex(c => c.id === city.carKind) + 1) % CARS.length].id);
$('#carBtn').addEventListener('click', nextCar);
setCar(carPref.get() || 'classic');
function honk() {
  if (Sound.horn(STOPS[state.cityIdx]?.id)) return;
  hornBtn.textContent = 'sound off'; setTimeout(() => { hornBtn.textContent = 'Horn'; }, 1200);
  if (!Sound.on) { prompt.textContent = 'Sound is off'; prompt.hidden = false; promptK = -3; setTimeout(() => { if (promptK === -3) { prompt.hidden = true; promptK = -2; } }, 1200); }
}
hornBtn.addEventListener('click', honk);
const openNear = () => { if (drive.active && drive.nearSpot >= 0 && !card.isOpen()) selectSpot(drive.nearSpot); };
prompt.addEventListener('click', openNear);
function readKeys() {
  const i = drive.input, d = k => keys.has(k);
  if (!joy.on) { i.throttle = (d('w') || d('arrowup') ? 1 : 0) - (d('s') || d('arrowdown') ? 1 : 0); i.steer = (d('a') || d('arrowleft') ? 1 : 0) - (d('d') || d('arrowright') ? 1 : 0); }
  i.brake = d(' ');
}
const DRIVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', ' '];
addEventListener('keydown', e => {
  if (trailer.active) return;
  if (document.body.classList.contains('reading')) { if (e.key === 'Escape') $('#returnWorld').click(); return; }
  if (e.key === 'Escape') { if (closeModals()) return; if (card.isOpen()) { card.close(); unfocus(); if (state.cityIdx >= 0) history.replaceState(null,'',routeURL({ci:state.cityIdx})); chips[state.cityIdx]?.focus(); return; } if (drive.active) setDrive(false); return; }
  const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
  const modal = !!document.querySelector('.modal:not([hidden])'), k = e.key.toLowerCase();
  if (state.mode === 'city' && !modal && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (k === 'h' && !e.repeat) { honk(); return; }
    if (k === 'c' && !e.repeat) { nextCar(); return; }
    if (drive.active && !card.isOpen()) {
      if ((k === 'e' || (k === 'enter' && (!a || a === document.body))) && !e.repeat) { openNear(); e.preventDefault(); return; }
      if (DRIVE_KEYS.includes(k) || k === 'arrowright') { keys.add(k); readKeys(); e.preventDefault(); return; }
    } else if (!drive.active && !card.isOpen() && DRIVE_KEYS.includes(k) && k !== ' ') {
      setDrive(true); if (drive.active) { keys.add(k); readKeys(); e.preventDefault(); } return;
    }
  }
  if (state.mode === 'city' && !drive.active && e.key === 'ArrowRight' && !modal) $('#next').click();
});
addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); readKeys(); });
addEventListener('blur', resetInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });

/* touch joystick (shown only with a coarse pointer, via CSS) */
function joyMove(e) {
  const r = joy.el.getBoundingClientRect(), R = r.width / 2; let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const m = Math.hypot(dx, dy); if (m > R * .8) { dx *= R * .8 / m; dy *= R * .8 / m; }
  knob.style.transform = `translate(${dx}px,${dy}px)`; const dz = v => Math.abs(v) < .12 ? 0 : v;
  drive.input.steer = dz(-dx / (R * .8)); drive.input.throttle = dz(-dy / (R * .8));
}
joy.el.addEventListener('pointerdown', e => { joy.on = true; joy.id = e.pointerId; joy.el.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
joy.el.addEventListener('pointermove', e => { if (joy.on && e.pointerId === joy.id) joyMove(e); });
const joyEnd = e => { if (e.pointerId !== joy.id) return; resetInput(); };
joy.el.addEventListener('pointerup', joyEnd); joy.el.addEventListener('pointercancel', joyEnd);

function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); globe.resize(w, h); city.resize(w, h); post.resize(w, h); }
addEventListener('resize', resize); resize();

function driveHud() {
  $('#speedN').textContent = String(Math.round(Math.abs(drive.speed) * 3.6));
  const k = card.isOpen() ? -1 : drive.nearSpot; if (k === promptK || promptK === -3) return; promptK = k;
  if (k < 0) { prompt.hidden = true; return; }
  prompt.textContent = `${matchMedia('(pointer: coarse)').matches ? 'Tap to open' : 'Press E to open'} — ${(state.custom ? state.custom.spots : STOPS[state.cityIdx].spots)[k].t}`; prompt.hidden = false;
}

/* adaptive quality: after ~3 s in a city, if frames average > 28 ms drop to pixel ratio 1; if the next 3 s are still slow, drop shadows and bloom. Never in the trailer or fixed-fps recording. ?noadapt=1 turns it off. */
const Q = { stage: 0, t: 0, n: 0, sum: 0, done: QS.has('trailer') || QS.has('noadapt') || !!FIXED_FPS, noBloom: false };
function adaptQuality(raw) {
  if (Q.done || state.mode !== 'city' || state.transit || trailer.active || !(raw > 0) || raw > .5) return;
  Q.t += raw; Q.n++; Q.sum += raw; if (Q.t < 3) return;
  const avg = Q.sum / Q.n * 1000; Q.t = Q.n = Q.sum = 0;
  if (avg <= 28) { Q.done = true; return; }
  if (Q.stage === 0) { Q.stage = 1; renderer.setPixelRatio(1); post.setPixelRatio(1); resize(); console.info('quality: pixel ratio 1 (avg ' + avg.toFixed(1) + ' ms)'); }
  else {
    Q.done = true; Q.noBloom = true; renderer.shadowMap.enabled = false;
    city.C?.scene.traverse(o => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.needsUpdate = true; }); });
    console.info('quality: shadows and bloom off (avg ' + avg.toFixed(1) + ' ms)');
  }
}

/* loop */
let last = performance.now(), T = 0, frames = 0;
function frame(now) {
  const raw = (now - last) / 1000, dt = FIXED_FPS ? 1 / FIXED_FPS : Math.min(.05, raw); last = now; if (!motionPaused || trailer.active) T += dt;
  if (trailer.active) trailer.update(raw); adaptQuality(raw); const W = innerWidth, H = innerHeight;
  if (state.mode === 'city' && city.C) {
    city.update(dt, T, W, H, trailer.active);
    if (drive.active) driveHud();
    if (!app.skipRender) post.render(city.C.scene, city.cam, { bloom: !Q.noBloom && city.C.cfg?.bloom > 0 ? city.C.cfg.bloom : 0, tilt: !SMALL });
  } else { globe.update(dt, T, W, H); if (!app.skipRender) renderer.render(globe.scene, globe.cam); }
  if (++frames === 30) window.__ready = true;
  requestAnimationFrame(frame);
}
updateChips(); renderPassport(state.stamped, state.missions);
requestAnimationFrame(frame);

/* ?yours=<city> jumps straight to the visitor-city stop (for testing) */
if (QS.get('yours') && !initialProject && !QS.has('trailer')) { yours.offered = true; setTimeout(() => goYours(QS.get('yours').slice(0, 60)), 300); }

/* deep links for posts: ?stop=<id>[&spot=<k>][&drive=1] goes straight into that city (a short fade, no globe flight). */
{
  const ci = QS.get('stop') ? STOPS.findIndex(s => s.id === QS.get('stop')) : -1;
  if (ci >= 0 && !QS.has('trailer') && !QS.get('yours') && !initialProject) (async () => {
    const raw = QS.get('spot'), n = raw !== null && /^\d+$/.test(raw) ? Number(raw) : -1, k = n >= 0 && n < STOPS[ci].spots.length ? n : null;
    begin(); globe.u = globe.stopU[ci]; globe.setTarget(ci); updateChips();
    state.pending = k; await enterCity(ci);
    if (QS.get('drive') === '1' && k === null) setDrive(true);
  })();
}

// Test hooks for the lead / screenshot tool.
window.__trailer = trailer;
window.__app = { state, city, drive, exitCity, travelTo, focusSpot, search, ask: runAsk, openModal, enterCity: async i => { begin(); await enterCity(i); } };
window.__drive = { get active() { return drive.active; }, get x() { return drive.x; }, get z() { return drive.z; }, get speed() { return drive.speed; }, get nearSpot() { return drive.nearSpot; }, get hits() { return drive.hits; } };
document.body.classList.add('world-ready');
// Visit counts: Vercel Web Analytics (cookieless). Only on the deployed site; the script 404s harmlessly until it is enabled in the Vercel project.
if (!__SINGLE__ && location.protocol === 'https:' && !QS.has('trailer')) { window.va = window.va || ((...a) => (window.vaq = window.vaq || []).push(a)); const s = document.createElement('script'); s.defer = true; s.src = '/_vercel/insights/script.js'; document.head.appendChild(s); }
