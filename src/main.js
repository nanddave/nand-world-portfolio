// App shell: globe travel, city scenes, story cards with live missions, passport, co-pilot, sound.
import { FIXED_FPS } from './core/vtime.js'; // first: installs the virtual clock when recording (&fixed=30)
import './styles/tokens.css';
import './styles/app.css';
import { THREE } from './kit/kit.js';
import { STOPS } from './content/stops.js';
import { VISITOR } from './core/visitor.js';
import { createGlobe } from './core/globe.js';
import { createCityView } from './core/cityview.js';
import { createDrive } from './core/drive.js';
import { liveFor } from './core/live.js';
import { createPost } from './core/post.js';
import { Sound } from './core/sound.js';
import { createTrailer } from './core/trailer.js';
import { ask, search, SUGGESTIONS } from './core/copilot.js';
import { createCard } from './ui/card.js';
import { setupModals, openModal, closeModals, renderPassport } from './ui/modals.js';

// Missions' stylesheet, if the missions agent has added one.
import.meta.glob('./missions/*.css', { eager: true });

const $ = s => document.querySelector(s);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SMALL = Math.min(innerWidth, innerHeight) < 800 && innerWidth < 800;
const LAST = STOPS.length - 1;
const short = s => (s.short && /again/i.test(s.name) ? s.short : s.name).replace(', again', '');

/* renderer */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, SMALL ? 1.5 : 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setClearColor(0x0B1026);
const post = createPost(renderer, !SMALL);

/* state */
const state = { mode: 'intro', cityIdx: -1, spot: -1, stamped: new Set(), missions: new Set(), pending: null, transit: false };
const globe = createGlobe({ small: SMALL, reduce: REDUCE, pinsEl: $('#pins'), onPin: i => travelTo(i) });
const city = createCityView({ reduce: REDUCE, spotsEl: $('#pins'), onSpot: k => focusSpot(k) });
city.drive = createDrive({ cam: city.cam, reduce: REDUCE });
const drive = city.drive;
const app = { state, globe, city, drive, renderer, skipRender: false, resize: () => resize() };
const trailer = createTrailer(app); // Phase 3.1: scripted demo video (?trailer=1, or the intro button)
const card = createCard({
  reduce: REDUCE,
  onNext: (ci, k) => { const n = STOPS[ci].spots.length; if (k < n - 1) focusSpot(k + 1); else if (ci < LAST) travelTo(ci + 1); else finish(); },
  onClose: () => unfocus(),
  onComplete: (ci, k) => { state.missions.add(ci + ':' + k); stamp(ci); updateChips(); pilotSay(`Mission done: ${STOPS[ci].spots[k].t}. That's a star on your ${short(STOPS[ci])} stamp.`); },
});

/* intro personalisation */
if (VISITOR.company) { const f = $('#introFor'); f.hidden = false; f.textContent = `Made for ${VISITOR.company}`; }

/* chips along the bottom */
const chips = STOPS.map((s, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'stopb'; b.innerHTML = `<b>${i + 1}</b>${s.name}`; b.setAttribute('aria-label', `Stop ${i + 1}: ${s.name}`); b.addEventListener('click', () => travelTo(i)); $('#stops').appendChild(b); return b; });
function updateChips() {
  chips.forEach((c, i) => { const on = state.mode === 'city' ? i === state.cityIdx : i === globe.target && state.mode !== 'intro'; c.classList.toggle('on', on); c.classList.toggle('stamped', state.stamped.has(i)); if (on) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current'); });
  globe.setPinsDone(state.stamped); $('#passN').textContent = `${state.stamped.size}/${STOPS.length}`;
}

/* live time + weather (optional; the designed look is the fallback) */
const QS = new URLSearchParams(location.search), FORCE_DESIGNED = QS.get('mood') === 'designed';
const moodPref = { get() { try { return localStorage.getItem('nw.mood'); } catch { return null; } }, set(v) { try { localStorage.setItem('nw.mood', v); } catch { /* ignore */ } } };
let liveMood = null; // { C, w, hour, live }
const wxText = w => { const k = w.rain || w.snow; return w.label === 'rain' || w.label === 'snow' ? (k <= .5 ? 'light ' : k >= 1 ? 'heavy ' : '') + w.label : w.label; };
function applyMood(live) {
  const m = liveMood; if (!m) return; m.live = live;
  if (live && m.w) m.C.setMood({ hour: m.hour, isDay: m.w.isDay, cloud: m.w.cloud, rain: m.w.rain, snow: m.w.snow, fog: m.w.fog, temp: m.w.temp }); else m.C.resetMood?.();
  const b = $('#moodBtn'); b.textContent = live ? 'Live' : 'Designed'; b.setAttribute('aria-pressed', String(live)); b.title = live ? 'Showing live weather. Switch to the designed look.' : 'Showing the designed look. Switch to live weather.';
}
async function setupLive(i, C) {
  liveMood = null; $('#cLive').hidden = true; $('#moodBtn').hidden = true; $('#cWxCredit').hidden = true;
  const s = STOPS[i]; let r; try { r = await liveFor(s); } catch { return; }
  if (state.cityIdx !== i || state.mode !== 'city') return;
  const place = s.name.split(/ &|,/)[0].trim(), w = r.weather;
  $('#cLiveT').textContent = w ? `It's ${r.timeText} · ${w.temp}°C · ${wxText(w)} in ${place} right now` : `It's ${r.timeText} in ${place} right now`;
  $('#cLive').hidden = false; $('#cWxCredit').hidden = !w;
  liveMood = { C, w, hour: r.hour, live: false };
  if (!w) return;
  $('#moodBtn').hidden = false;
  applyMood(!FORCE_DESIGNED && moodPref.get() !== 'designed');
}
$('#moodBtn').addEventListener('click', () => { if (!liveMood) return; applyMood(!liveMood.live); moodPref.set(liveMood.live ? 'live' : 'designed'); });

/* flow */
const fade = on => $('#fade').classList.toggle('on', on);
const wait = ms => new Promise(r => setTimeout(r, REDUCE ? 0 : ms));
function begin() { if (state.mode !== 'intro') return; state.mode = 'globe'; document.body.classList.add('on'); globe.view = 'travel'; Sound.play('globe'); }
$('#startBtn').addEventListener('click', () => { Sound.set(true); begin(); globe.u = 0; travelTo(0); });
$('#soundBtn').addEventListener('click', () => Sound.set(!Sound.on));
Sound.onChange = on => { const b = $('#soundBtn'); b.textContent = on ? 'Sound on' : 'Sound off'; b.setAttribute('aria-pressed', String(on)); };
async function toIntro() { if (state.mode === 'city') await exitCity(); state.mode = 'intro'; globe.view = 'intro'; globe.faceIndia(); document.body.classList.remove('on'); $('#travel').classList.remove('show'); updateChips(); }
$('#home').addEventListener('click', e => { e.preventDefault(); toIntro(); });
/* trailer entry points: the intro button, or ?trailer=1 (autoplay). Esc stops it and returns to the intro. */
trailer.onStop = () => { state.mode = 'intro'; state.cityIdx = -1; state.transit = false; globe.view = 'intro'; globe.u = 0; globe.faceIndia(); document.body.classList.remove('on', 'incity'); $('#travel').classList.remove('show'); Sound.set(false); Sound.play('globe'); updateChips(); };
$('#trailerBtn').addEventListener('click', () => { if (state.mode === 'intro') trailer.start(); });
if (QS.has('trailer')) trailer.start({ sound: true });

/** Go to stop i (and optionally open spot k there). Works from intro, globe or another city. */
async function travelTo(i, k) {
  state.pending = k === undefined ? null : k;
  if (state.mode === 'intro') begin();
  if (state.mode === 'city') {
    if (state.cityIdx === i) { if (k !== undefined) { state.pending = null; focusSpot(k); } return; }
    await exitCity();
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

async function enterCity(i) {
  if (state.mode === 'city' || state.transit) return; state.transit = true; fade(true);
  const [C] = await Promise.all([city.load(i), wait(600)]);
  const s = STOPS[i]; state.mode = 'city'; state.cityIdx = i; state.spot = -1;
  globe.view = 'hidden'; globe.hidePins(); city.show(i, C);
  document.body.classList.add('incity');
  $('#cStop').textContent = `Stop ${i + 1} of ${STOPS.length}`; $('#cName').textContent = s.name; $('#cMeta').innerHTML = `${s.region}<br>${s.coord}<br>${s.mood}`; $('#cCredit').textContent = C.credit || ''; setDriveUI(); $('#ctitle').classList.add('show'); setupLive(i, C);
  $('#next').textContent = i < LAST ? `Continue to ${short(STOPS[i + 1])}` : (VISITOR.company ? `Finish: next stop, ${VISITOR.company}` : 'Finish the trip');
  Sound.play(C.cfg?.sound || s.id); updateChips(); fade(false); state.transit = false;
  if (state.pending !== null) { const p = state.pending; state.pending = null; setTimeout(() => state.cityIdx === i && focusSpot(p), REDUCE ? 0 : 1300); }
  else pilotSay(`Welcome to ${s.name}. Tap a yellow marker to explore, or ask me something.`);
  window.__city = s.id;
}
async function exitCity() {
  if (state.transit || state.mode !== 'city') return; state.transit = true; card.close(); fade(true); await wait(600);
  setDrive(false); state.mode = 'globe'; city.hide(); globe.view = 'travel'; document.body.classList.remove('incity', 'focus'); $('#ctitle').classList.remove('show'); liveMood?.C.resetMood?.(); liveMood = null;
  Sound.play('globe'); fade(false); state.transit = false; state.cityIdx = -1; updateChips();
}
/** Last stop's continue: with a company, take them to the empty lot first; then back to the globe to roam. */
async function finish() {
  const lot = STOPS[LAST].spots.findIndex(sp => sp.mission === 'lot');
  const seen = city.seen[LAST] || new Set();
  if (state.cityIdx === LAST && lot >= 0 && !seen.has(lot)) { focusSpot(lot); return; }
  await exitCity(); globe.view = 'orbit'; pilotSay(VISITOR.company ? `That's the whole trip. Over to you, ${VISITOR.company}: open the passport for Nand's contact.` : 'That\'s the whole trip. Spin the earth, or open the passport for Nand\'s contact.');
}
$('#next').addEventListener('click', () => { const i = state.cityIdx; if (i < LAST) travelTo(i + 1); else finish(); });
$('#shareBtn').addEventListener('click', async () => { closeModals(); const { openPostcardDialog } = await import('./ui/postcard.js'); openPostcardDialog({ stamped: state.stamped, missions: state.missions, company: VISITOR.company }); });

function nextLabel(ci, k) {
  if (k < STOPS[ci].spots.length - 1) return 'Next spot';
  if (ci < LAST) return `Continue to ${short(STOPS[ci + 1])}`;
  return VISITOR.company ? `Finish: over to ${VISITOR.company}` : 'Finish the trip';
}
function focusSpot(k) {
  if (state.mode !== 'city') return; const ci = state.cityIdx; k = Math.max(0, Math.min(k, STOPS[ci].spots.length - 1));
  state.spot = k; city.focus(k); document.body.classList.add('focus');
  card.open(ci, k, { scene: city.C, nextLabel: nextLabel(ci, k) }); stamp(ci);
}
function unfocus() { state.spot = -1; city.unfocus(); document.body.classList.remove('focus'); }
function stamp(i) {
  const fresh = !state.stamped.has(i); state.stamped.add(i); updateChips(); renderPassport(state.stamped, state.missions);
  if (fresh && state.stamped.size === STOPS.length) pilotSay('Your passport is full. Open it to send Nand a note.');
}

/* modals */
setupModals({ onGo: (ci, k) => travelTo(ci, k) });
$('#quickBtn').addEventListener('click', () => openModal('#quick'));
$('#quickBtn2').addEventListener('click', () => openModal('#quick'));
$('#howBtn').addEventListener('click', () => openModal('#how'));
$('#skillsBtn').addEventListener('click', () => openModal('#skills'));
$('#passBtn').addEventListener('click', () => { renderPassport(state.stamped, state.missions); openModal('#pass'); });

/* co-pilot */
const pilotEl = $('#pilot');
function pilotSay(t, match = '') { $('#pilotText').textContent = t; $('#pilotMatch').textContent = match || 'Searches the stories on this trip, right here in your browser.'; }
$('#sugg').innerHTML = SUGGESTIONS.map(q => `<button type="button" data-q="${q}">${q}</button>`).join('');
async function runAsk(q) {
  pilotSay('Searching…');
  const r = await ask(q);
  if (r.match) {
    const s = STOPS[r.match.ci], sp = s.spots[r.match.k];
    pilotSay(r.text, `Matched: ${s.name} · ${sp.t}` + (r.match.score != null ? ` (score ${r.match.score.toFixed(2)})` : ' (remote answer)'));
    travelTo(r.match.ci, r.match.k);
  } else pilotSay(r.text, r.best ? `Closest: ${STOPS[r.best.ci].spots[r.best.k].t} (score ${r.best.score.toFixed(2)}, below the 1.60 cut-off)` : 'No words matched any story.');
}
$('#ask').addEventListener('submit', e => { e.preventDefault(); const i = $('#askIn'); const q = i.value.trim(); if (q) { runAsk(q); i.value = ''; } });
$('#sugg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) runAsk(b.dataset.q); });
function setPilotMin(min) { pilotEl.classList.toggle('min', min); const b = $('#pilotMin'); b.textContent = min ? '+' : '–'; b.setAttribute('aria-expanded', String(!min)); b.setAttribute('aria-label', min ? 'Expand co-pilot' : 'Minimise co-pilot'); }
$('#pilotMin').addEventListener('click', () => setPilotMin(!pilotEl.classList.contains('min')));
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
/* drive mode: keyboard, joystick, HUD */
const keys = new Set(), hint = $('#driveHint'), prompt = $('#drivePrompt'), hornBtn = $('#hornBtn');
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
  } else { city.exitDrive(); keys.clear(); }
  setDriveUI();
}
$('#driveBtn').addEventListener('click', () => setDrive(!drive.active));
function honk() {
  if (Sound.horn(STOPS[state.cityIdx]?.id)) return;
  hornBtn.textContent = 'sound off'; setTimeout(() => { hornBtn.textContent = 'Horn'; }, 1200);
  if (!Sound.on) { prompt.textContent = 'Sound is off'; prompt.hidden = false; promptK = -3; setTimeout(() => { if (promptK === -3) { prompt.hidden = true; promptK = -2; } }, 1200); }
}
hornBtn.addEventListener('click', honk);
const openNear = () => { if (drive.active && drive.nearSpot >= 0 && !card.isOpen()) focusSpot(drive.nearSpot); };
prompt.addEventListener('click', openNear);
function readKeys() {
  const i = drive.input, d = k => keys.has(k);
  if (!joy.on) { i.throttle = (d('w') || d('arrowup') ? 1 : 0) - (d('s') || d('arrowdown') ? 1 : 0); i.steer = (d('a') || d('arrowleft') ? 1 : 0) - (d('d') || d('arrowright') ? 1 : 0); }
  i.brake = d(' ');
}
const DRIVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', ' '];
addEventListener('keydown', e => {
  if (trailer.active) return;
  if (e.key === 'Escape') { if (!closeModals() && card.isOpen()) { card.close(); unfocus(); } else if (drive.active) setDrive(false); return; }
  const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
  const modal = !!document.querySelector('.modal:not([hidden])'), k = e.key.toLowerCase();
  if (state.mode === 'city' && !modal && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (k === 'h' && !e.repeat) { honk(); return; }
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
addEventListener('blur', () => { keys.clear(); readKeys(); });

/* touch joystick (shown only with a coarse pointer, via CSS) */
const joy = { on: false, id: null, el: $('#joy') }, knob = joy.el.querySelector('i');
function joyMove(e) {
  const r = joy.el.getBoundingClientRect(), R = r.width / 2; let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const m = Math.hypot(dx, dy); if (m > R * .8) { dx *= R * .8 / m; dy *= R * .8 / m; }
  knob.style.transform = `translate(${dx}px,${dy}px)`; const dz = v => Math.abs(v) < .12 ? 0 : v;
  drive.input.steer = dz(-dx / (R * .8)); drive.input.throttle = dz(-dy / (R * .8));
}
joy.el.addEventListener('pointerdown', e => { joy.on = true; joy.id = e.pointerId; joy.el.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
joy.el.addEventListener('pointermove', e => { if (joy.on && e.pointerId === joy.id) joyMove(e); });
const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.on = false; knob.style.transform = ''; drive.input.steer = drive.input.throttle = 0; };
joy.el.addEventListener('pointerup', joyEnd); joy.el.addEventListener('pointercancel', joyEnd);

function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); globe.resize(w, h); city.resize(w, h); post.resize(w, h); }
addEventListener('resize', resize); resize();

function driveHud() {
  $('#speedN').textContent = String(Math.round(Math.abs(drive.speed) * 3.6));
  const k = card.isOpen() ? -1 : drive.nearSpot; if (k === promptK || promptK === -3) return; promptK = k;
  if (k < 0) { prompt.hidden = true; return; }
  prompt.textContent = `${matchMedia('(pointer: coarse)').matches ? 'Tap to open' : 'Press E to open'} — ${STOPS[state.cityIdx].spots[k].t}`; prompt.hidden = false;
}

/* loop */
let last = performance.now(), T = 0, frames = 0;
function frame(now) {
  const raw = (now - last) / 1000, dt = FIXED_FPS ? 1 / FIXED_FPS : Math.min(.05, raw); last = now; T += dt;
  if (trailer.active) trailer.update(raw); const W = innerWidth, H = innerHeight;
  if (state.mode === 'city' && city.C) {
    city.update(dt, T, W, H);
    if (drive.active) driveHud();
    if (!app.skipRender) post.render(city.C.scene, city.cam, { bloom: city.C.cfg?.bloom > 0 ? city.C.cfg.bloom : 0, tilt: !SMALL });
  } else { globe.update(dt, T, W, H); if (!app.skipRender) renderer.render(globe.scene, globe.cam); }
  if (++frames === 30) window.__ready = true;
  requestAnimationFrame(frame);
}
updateChips(); renderPassport(state.stamped, state.missions);
requestAnimationFrame(frame);

// Test hooks for the lead / screenshot tool.
window.__trailer = trailer;
window.__app = { state, drive, exitCity, travelTo, focusSpot, search, ask: runAsk, openModal, enterCity: async i => { begin(); await enterCity(i); } };
window.__drive = { get active() { return drive.active; }, get x() { return drive.x; }, get z() { return drive.z; }, get speed() { return drive.speed; }, get nearSpot() { return drive.nearSpot; }, get hits() { return drive.hits; } };
