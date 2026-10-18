// Trailer director (Phase 3.1). Plays src/content/trailer.js on one clock, driving the real app systems:
// globe flight, city view (scripted camera), drive mode autopilot, missions in a floating panel, captions, end card.
//
// Everything visual that changes over time (fades, captions, panel slide, end card) is computed from the trailer
// clock and written as inline styles each frame, never CSS transitions, so a fixed-timestep recording (&fixed=30)
// is frame-exact. See tools/record-trailer.mjs.
import { THREE, V, clamp, lerp } from '../kit/kit.js';
import { STOPS, isReal } from '../content/stops.js';
import { SHOTS, TRAILER_END, TRAILER_LENGTH } from '../content/trailer.js';
import { MISSIONS, mountMission } from '../missions/index.js';
import { WorkLog } from '../ui/worklog.js';
import { Sound } from './sound.js';
import { FIXED_FPS } from './vtime.js';

const CITY_IDX = Object.fromEntries(STOPS.map((s, i) => [s.id, i]));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const smoother = x => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
const ramp = (t, t0, d) => clamp((t - t0) / d, 0, 1);

// How each mission demo is "played" by the director: [seconds after the panel starts, CSS selector to click].
// The missions are untouched; the director just presses their own buttons.
const AUTO = {
  machine: { clicks: [[.7, '[data-act="cups"]'], [1.5, '[data-act="fold"]'], [2.3, '[data-act="realign"]']] },
  train: { clicks: [[.5, '[data-ex="blobs"]'], [1.1, '[data-train]']] },
  etl: { clicks: [[.6, '[data-run]']] },
  pii: { clicks: [[.5, '[data-scan]'], [1.5, '[data-redact]']] },
  agents: { clicks: [[.6, '[data-run]']] },
  voice: { pre: el => { const m = el.querySelector('[data-mute]'); if (m && !m.disabled) m.checked = true; }, clicks: [[.7, '[data-play]']] },
};

export function createTrailer(app) {
  const { state, globe, city, drive, renderer } = app;
  const params = new URLSearchParams(location.search);
  const VERT = params.get('v') === '1';
  const REC = FIXED_FPS > 0;
  const shots = SHOTS.map((s, i) => ({ ...s, _i: i })).sort((a, b) => a.at - b.at || a._i - b._i);
  const LEN = TRAILER_LENGTH;

  const T = {
    active: false, done: false, t: 0, vertical: VERT, fixed: FIXED_FPS, onStop: null,
    ready: false,
  };
  let els = null, idx = 0, stall = null, scene = 'globe', cityId = null, C = null;
  const loaded = new Map(); // city index -> scene
  const caps = [], panels = [], fades = [], clicks = [];
  let cine = null, move = null, drift = 0; // scripted city camera
  let ap = null; // drive autopilot
  let endShot = null;
  let keyHandler = null;

  /* ---------- DOM ---------- */
  function buildDom() {
    const d = document.createElement('div'); d.id = 'trailerUI';
    d.innerHTML = `<div id="tLb"><i class="tbar t"></i><i class="tbar b"></i></div>
      <div id="tFade"></div>
      <div id="tCap"><b></b><span></span></div>
      <div id="tPanel"><div class="tp-in"><div class="tp-host"></div></div></div>
      <div id="tEnd"><div class="tv"></div><div class="tb"><div class="n"></div><div class="l"></div><div class="c"></div><div class="u"></div></div></div>
      <div id="tLoad"></div>`;
    document.body.appendChild(d);
    const q = s => d.querySelector(s);
    els = { root: d, fade: q('#tFade'), cap: q('#tCap'), capB: q('#tCap b'), capS: q('#tCap span'), panel: q('#tPanel'), pin: q('.tp-in'), host: q('.tp-host'), end: q('#tEnd'), endV: q('#tEnd .tv'), endN: q('#tEnd .n'), endL: q('#tEnd .l'), endC: q('#tEnd .c'), endU: q('#tEnd .u'), load: q('#tLoad') };
    els.endN.textContent = TRAILER_END.name; els.endL.textContent = TRAILER_END.line; els.endC.textContent = TRAILER_END.cta; els.endU.textContent = TRAILER_END.link; if (!isReal(TRAILER_END.link)) els.endU.hidden = true;
    els.fade.style.opacity = '1';
  }

  /* ---------- plan: captions, panels, fades are derived from the shot list ---------- */
  function plan() {
    caps.length = panels.length = fades.length = clicks.length = 0;
    let sc = 'globe'; const kf = [[0, 1], [.7, 0]];
    for (const s of shots) {
      if (s.do === 'caption') caps.push({ t0: s.at, dur: s.dur ?? 3, text: s.text, sub: s.sub || '' });
      else if (s.do === 'mission') panels.push({ t0: s.at, dur: s.dur ?? 3, id: s.id, scale: s.scale, mounted: false, h: null, fired: false });
      else if (s.do === 'travel' && sc === 'city') { kf.push([s.at - .22, 0], [s.at, 1], [s.at + .35, 0]); sc = 'globe'; }
      else if (s.do === 'enter' && sc === 'globe') { kf.push([s.at - .22, 0], [s.at, 1], [s.at + .4, 0]); sc = 'city'; }
      else if (s.do === 'travel' || s.do === 'enter') sc = s.do === 'enter' ? 'city' : 'globe';
    }
    kf.push([LEN - .6, 0], [LEN, 1]);
    kf.sort((a, b) => a[0] - b[0]);
    // keep the sequence monotonic in time (equal times keep their order)
    fades.push(...kf);
  }
  const fadeAt = t => {
    if (t <= fades[0][0]) return fades[0][1];
    for (let i = 1; i < fades.length; i++) if (t <= fades[i][0]) { const [a, va] = fades[i - 1], [b, vb] = fades[i]; return b === a ? vb : lerp(va, vb, (t - a) / (b - a)); }
    return fades[fades.length - 1][1];
  };

  /* ---------- camera moves in the city ---------- */
  const poseFromCam = center => { const o = city.cam.position.clone().sub(center), d = Math.max(1, o.length()); return { c: center.clone(), yaw: Math.atan2(o.x, o.z), pitch: Math.asin(clamp(o.y / d, -1, 1)), dist: d }; };
  const clonePose = p => ({ c: p.c.clone(), yaw: p.yaw, pitch: p.pitch, dist: p.dist });
  function moveTo(to, dur, ease = smoother, driftRate = .03) {
    if (!cine) cine = poseFromCam(to.c);
    move = { from: clonePose(cine), to, t0: T.t, dur: Math.max(.05, dur), ease }; drift = driftRate; city.cine = cine;
  }
  function stepCine(dt) {
    if (!cine) return;
    if (move) {
      const x = ease01(move), f = move.from, g = move.to;
      cine.c.lerpVectors(f.c, g.c, x); cine.yaw = f.yaw + wrap(g.yaw - f.yaw) * x; cine.pitch = lerp(f.pitch, g.pitch, x); cine.dist = lerp(f.dist, g.dist, x);
      if (T.t - move.t0 >= move.dur) { const nx = move.next; move = null; if (nx) moveTo(nx.to, nx.dur, nx.ease, nx.drift); }
    } else cine.yaw += drift * dt;
  }
  const ease01 = m => m.ease(ramp(T.t, m.t0, m.dur));
  const center0 = () => (C?.target ? C.target.clone() : V(0, 2, 0));
  function spotPose(k) {
    const sp = C.spots[Math.min(k, C.spots.length - 1)], p = sp.p;
    const dir = V(city.cam.position.x - p.x, 0, city.cam.position.z - p.z); if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1); dir.normalize();
    const dist = Math.max(22, p.y * 1.4 + 14), c = V(p.x, p.y * .7, p.z), top = p.y * .6 + dist * .45 - c.y, d3 = Math.hypot(dist, top);
    return { c, yaw: Math.atan2(dir.x, dir.z), pitch: Math.asin(top / d3), dist: d3 * (VERT ? 1.25 : 1) };
  }

  /* ---------- drive autopilot ---------- */
  function startDrive(s) {
    const D = drive;
    if (!D.active) { cine = null; move = null; city.cine = null; D.enter(C); }
    const spot = typeof s.to === 'object' ? s.to.spot : 0, tgt = C.spots[Math.min(spot, C.spots.length - 1)].p;
    const g = C._grid, lane = C._spawn?.z ?? D.z, hit = (x, z) => g && g.boxes && clearAt(g, x, z);
    // Main road runs along x. Drive toward the spot's x from the side the car spawns on, with at least ~55 m of run-up
    // so the street scrolls past (a short spawn-to-spot hop makes a dead shot). The run-up start is moved back along the lane.
    const RUN = 55, sx = C._spawn?.x ?? D.x, dir = sx <= tgt.x ? 1 : -1, lim = (C.driveRadius ?? 140) - 6;
    let x0 = sx; if ((tgt.x - sx) * dir < RUN) x0 = clamp(tgt.x - dir * RUN, -lim, lim);
    while ((tgt.x - x0) * dir > 8 && !hit(x0, lane)) x0 += dir * 4; // nudge off anything on the lane
    D.x = x0; D.z = lane; D.h = dir > 0 ? 0 : Math.PI; D.speed = 0; D.sync(); D.pos.set(D.x, 0, D.z); D.look.copy(D.pos);
    const pts = [{ x: tgt.x, z: lane }];
    // turn in toward the spot while the way is clear (stop ~2.5 m short of whatever blocks it)
    let reach = 0;
    for (let d = 3; d < Math.abs(tgt.z - lane) - 3; d += 1.5) { if (!hit(tgt.x, lane + Math.sign(tgt.z - lane) * d)) break; reach = d; }
    if (reach >= 6) pts.push({ x: tgt.x, z: lane + Math.sign(tgt.z - lane) * reach, final: true }); else pts[0].final = true;
    const len = Math.abs(pts[0].x - x0) + (pts.length > 1 ? reach : 0);
    D.boost = clamp(len / ((s.dur ?? 4) * .78) / 12.5, 1, 2.8);
    D.chase = VERT ? { back: 11, up: 5.2, ahead: 8 } : { back: 10, up: 3.8, ahead: 9 };
    ap = { pts, i: 0, still: 0, done: false, t0: T.t };
  }
  function clearAt(g, x, z) { for (const b of g.boxes) if (x > b.minX - 1.8 && x < b.maxX + 1.8 && z > b.minZ - 1.8 && z < b.maxZ + 1.8) return false; return true; }
  function stepDrive() {
    const D = drive; if (!ap || !D.active) return; const inp = D.input;
    if (ap.done) { inp.throttle = 0; inp.steer = 0; inp.brake = true; return; }
    const w = ap.pts[ap.i], dx = w.x - D.x, dz = w.z - D.z, r = Math.hypot(dx, dz);
    if (!w.final && r < 5) { ap.i++; return stepDrive(); }
    if (w.final && r < 2.5) { ap.done = true; return; }
    const err = wrap(Math.atan2(-dz, dx) - D.h), sp = D.speed, vmax = 16 * D.boost;
    inp.steer = clamp(err * 2.4, -1, 1);
    // brake into the corner (a waypoint with a successor) and into the stop
    const want = (w.final ? Math.min(vmax, r * 1.1 + 1.5) : Math.min(vmax, 6 + r * 1.1)) * (Math.abs(err) > .7 ? .4 : 1);
    if (sp < want) { inp.throttle = 1; inp.brake = false; } else { inp.throttle = 0; inp.brake = sp > want + 2; }
    ap.still = sp < .6 && T.t - ap.t0 > 1.2 ? ap.still + 1 : 0; if (ap.still > 40) ap.done = true;
  }
  function stopDrive() {
    if (!drive.active) return; const p = V(drive.x, 1.5, drive.z); drive.exit(); drive.boost = 1; drive.chase = null; ap = null;
    cine = poseFromCam(p); move = null; city.cine = cine;
  }

  /* ---------- scene changes ---------- */
  async function loadCity(i) {
    if (loaded.has(i)) return loaded.get(i);
    const c = await city.load(i); loaded.set(i, c);
    try { renderer.compile(c.scene, city.cam); } catch { /* compile is only a warm-up */ }
    return c;
  }
  function toGlobe() {
    if (state.mode === 'city') { stopDrive(); city.hide(); drive.boost = 1; drive.chase = null; }
    state.mode = 'globe'; state.cityIdx = -1; C = null; scene = 'globe'; cine = null; move = null; ap = null; Sound.play('globe');
  }
  function toCity(i, c) {
    state.mode = 'city'; state.cityIdx = i; C = c; cityId = STOPS[i].id; scene = 'city';
    globe.view = 'hidden'; globe.hidePins(); city.show(i, c); ap = null;
    cine = { c: center0(), yaw: c.yaw ?? c.cfg?.yaw ?? -.6, pitch: .5, dist: VERT ? 190 : 150 }; move = null; drift = .03; city.cine = cine;
    Sound.play(c.cfg?.sound || cityId);
  }

  /* ---------- shot dispatcher ---------- */
  function fire(s) {
    switch (s.do) {
      case 'globe': globe.view = s.view === 'intro' ? 'intro' : 'travel'; globe.spin = s.spin || 1; if (state.mode === 'city') toGlobe(); state.mode = 'globe'; break;
      case 'travel': {
        if (state.mode === 'city') toGlobe();
        globe.spin = 1; const i = CITY_IDX[s.city]; city.load(i);
        const en = shots.find(x => x.do === 'enter' && x.at > s.at - .001 && x.city === s.city);
        const dur = en ? Math.max(.5, en.at - s.at) : 3;
        globe.setTarget(i, dur); state.mode = 'globe'; Sound.play('globe'); break;
      }
      case 'enter': {
        const i = CITY_IDX[s.city]; if (!loaded.has(i)) { stall = loadCity(i).then(() => { stall = null; }); return false; }
        if (state.mode === 'city') toGlobe();
        toCity(i, loaded.get(i)); break;
      }
      case 'orbit': {
        if (!C) break; stopDrive();
        const c = s.spot != null ? (() => { const p = C.spots[Math.min(s.spot, C.spots.length - 1)].p; return V(p.x, p.y * .6, p.z); })() : center0();
        moveTo({ c, yaw: s.yaw ?? cine?.yaw ?? 0, pitch: s.pitch ?? .35, dist: (s.dist ?? 60) * (VERT ? 1.35 : 1) }, s.dur ?? 3, smoother, .035); break;
      }
      case 'spot': if (C) { stopDrive(); moveTo(spotPose(s.k ?? 0), s.dur ?? 3, smoother, .03); } break;
      case 'drive': if (C) startDrive(s); break;
      case 'horn': Sound.horn(cityId); break;
      case 'lot': try { C?.raiseLot?.(s.name); } catch (e) { console.error(e); } break;
      case 'end': {
        endShot = { t0: s.at, dur: s.dur ?? 5.8 };
        if (C) { // settle on a wide, readable view of the street first (the lot building is too close to sit behind a title), then a slow push-in
          stopDrive(); const p = cine ? clonePose(cine) : poseFromCam(center0()), c = center0(), d = (VERT ? 150 : 110);
          moveTo({ c, yaw: p.yaw + .1, pitch: .34, dist: d }, 1.4, smooth, 0);
          move.next = { to: { c: c.clone(), yaw: p.yaw + .3, pitch: .3, dist: d * .8 }, dur: endShot.dur + .5, ease: smooth, drift: .02 };
        }
        break;
      }
      default: break; // 'caption' and 'mission' are driven from the plan
    }
    return true;
  }

  /* ---------- HUD (captions, panel, end card) ---------- */
  function hud() {
    const W = innerWidth, H = innerHeight, t = T.t;
    els.fade.style.opacity = String(fadeAt(t));
    // caption
    const c = caps.find(k => t >= k.t0 && t < k.t0 + k.dur);
    let panelOn = 0; for (const p of panels) panelOn = Math.max(panelOn, smooth(ramp(t, p.t0, .45)) * (1 - smooth(ramp(t, p.t0 + p.dur, .4))));
    if (c) {
      const a = smooth(ramp(t, c.t0, .35)) * (1 - smooth(ramp(t, c.t0 + c.dur - .35, .35)));
      if (els.capB.textContent !== c.text) els.capB.textContent = c.text; if (els.capS.textContent !== c.sub) els.capS.textContent = c.sub;
      els.cap.style.opacity = String(a); const rise = (1 - smooth(ramp(t, c.t0, .5))) * 22; els.cap.style.transform = `translateY(${rise}px)`;
    } else els.cap.style.opacity = '0';
    els.cap.style.bottom = VERT ? `${lerp(.15 * H, .53 * H, panelOn)}px` : '';
    // mission panel
    let shown = false;
    for (const p of panels) {
      const inn = smooth(ramp(t, p.t0, .45)), out = smooth(ramp(t, p.t0 + p.dur, .4));
      if (t < p.t0 || t > p.t0 + p.dur + .4) continue;
      shown = true; const a = inn * (1 - out), BW = VERT ? 520 : 440;
      els.pin.style.width = BW + 'px';
      const ih = els.pin.offsetHeight || 600, bar = H * .09, gap = H * .035;
      let sc, x, y, slide;
      if (VERT) { const aw = W * .92, ah = H * .91 - gap - (H * .5); sc = Math.min(aw / BW, ah / ih, 1.9); x = (W - BW * sc) / 2; y = H * .5 + (ah - ih * sc) / 2; slide = (1 - inn) * 60 + out * 60; }
      else { const aw = W * .38, ah = H - 2 * (bar + gap); sc = Math.min(aw / BW, ah / ih, 2.2) * (p.scale || 1); x = W - W * .03 - BW * sc; y = bar + gap + (ah - ih * sc) / 2; slide = (1 - inn) * (BW * sc + W * .05) + out * (BW * sc * .35); }
      els.panel.style.opacity = String(a);
      els.panel.style.transform = VERT ? `translate(${x}px,${y + slide}px) scale(${sc})` : `translate(${x + slide}px,${y}px) scale(${sc})`;
    }
    els.panel.style.visibility = shown ? 'visible' : 'hidden';
    // end card
    if (endShot) {
      const e = t - endShot.t0, a = smooth(ramp(e, 0, .9));
      els.endV.style.opacity = String(a * .72);
      const item = (el, at) => { const p = smooth(ramp(e, at, .7)); el.style.opacity = String(p); el.style.transform = `translateY(${(1 - p) * 18}px)`; };
      item(els.endN, .5); item(els.endL, 1.1); item(els.endC, 1.9); item(els.endU, 2.4);
      els.end.style.display = 'block';
    } else els.end.style.display = 'none';
  }

  /* ---------- missions ---------- */
  function stepMissions(dt) {
    for (const p of panels) {
      const live = T.t >= p.t0 && T.t < p.t0 + p.dur + .4;
      if (live && !p.mounted && !p.busy) {
        p.busy = true; const host = document.createElement('div'); els.host.replaceChildren(host); p.host = host;
        const c = C; const stop = STOPS[state.cityIdx] || STOPS[0];
        mountMission(p.id, host, { work: new WorkLog(), complete() {}, contact: {}, city: stop, reduceMotion: false, scene: c })
          .then(h => { p.handle = h; p.mounted = true; p.busy = false; p.m0 = T.t; AUTO[p.id]?.pre?.(host); })
          .catch(e => { console.error('trailer: mission failed', p.id, e); p.mounted = true; p.busy = false; p.m0 = T.t; });
      }
      if (p.mounted && p.m0 != null && !p.fired) {
        const a = AUTO[p.id]; p.sent = p.sent || new Set();
        (a?.clicks || []).forEach(([at, sel], k) => { if (!p.sent.has(k) && T.t - p.m0 >= at) { p.sent.add(k); try { p.host.querySelector(sel)?.click(); } catch (e) { console.error(e); } } });
      }
      if (p.mounted && !live && !p.fired) { p.fired = true; try { p.handle?.unmount?.(); } catch (e) { console.error(e); } if (els.host.contains(p.host)) p.host.remove(); }
    }
  }

  /* ---------- clock ---------- */
  T.update = rawDt => {
    if (!T.active || stall || !T.ready) return;
    const dt = FIXED_FPS ? 1 / FIXED_FPS : Math.min(rawDt, .1);
    if (!T.started) T.started = true;
    T.t += dt;
    while (idx < shots.length && shots[idx].at <= T.t) { if (fire(shots[idx]) === false) break; idx++; }
    // look-ahead: build the next city a few seconds before its 'enter'
    for (const s of shots) if (s.do === 'enter' && s.at > T.t && s.at - T.t < 4 && !loaded.has(CITY_IDX[s.city])) loadCity(CITY_IDX[s.city]);
    stepCine(dt); stepDrive(); stepMissions(dt); hud();
    window.__trailerT = T.t;
    if (T.t >= LEN - 1e-6 && !T.done) { T.done = true; window.__trailerDone = true; }
  };

  /* ---------- lifecycle ---------- */
  T.start = async (opts = {}) => {
    if (T.active) return;
    T.active = true; T.done = false; T.ready = false; T.t = 0; idx = 0; stall = null; endShot = null; cine = null; move = null; ap = null; C = null; loaded.clear();
    window.__trailerDone = false; window.__trailerReady = false;
    document.body.classList.add('trailer'); document.body.classList.toggle('trailer-v', VERT); document.body.classList.add('on');
    buildDom(); plan();
    els.load.textContent = REC ? '' : 'Loading the trailer…';
    if (VERT) { city.fov = 62; globe.fov = 58; } else { city.fov = globe.fov = null; }
    globe.trailer = true; app.resize();
    state.mode = 'globe'; state.transit = false; globe.u = 0; globe.tw = null; globe.view = 'intro'; globe.spin = 1; globe.faceIndia(); globe.hidePins();
    drive.boost = 1; drive.chase = null; Sound.set(!REC && opts.sound !== false);
    keyHandler = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); T.stop(); } };
    addEventListener('keydown', keyHandler, true);
    try { await Promise.race([document.fonts.load('900 60px "Big Shoulders Display"'), new Promise(r => (window.__realTimeout || setTimeout)(r, 2500))]); } catch { /* fallback font is fine */ }
    // Preload every city and mission up front so nothing builds while the clock runs.
    const ids = [...new Set(shots.filter(s => s.do === 'enter').map(s => CITY_IDX[s.city]))];
    for (const i of ids) { if (!T.active) return; await loadCity(i); els.load.textContent = REC ? '' : `Loading the trailer… ${loaded.size}/${ids.length}`; }
    await Promise.all([...new Set(shots.filter(s => s.do === 'mission').map(s => s.id))].map(id => MISSIONS[id]().catch(() => null)));
    if (!T.active) return;
    els.load.textContent = ''; T.ready = true; window.__trailerReady = true; window.__trailerStart = performance.now();
    Sound.play('globe');
  };
  T.stop = () => {
    if (!T.active) return; T.active = false; T.ready = false;
    panels.forEach(p => { try { p.handle?.unmount?.(); } catch { /* ignore */ } });
    removeEventListener('keydown', keyHandler, true);
    stopDrive(); drive.boost = 1; drive.chase = null; city.cine = null; city.fov = null; globe.fov = null; globe.trailer = false; globe.spin = 1; globe.tw = null;
    if (state.mode === 'city') city.hide();
    els?.root.remove(); els = null;
    document.body.classList.remove('trailer', 'trailer-v', 'incity', 'focus'); app.resize();
    T.onStop?.();
  };
  // Test/recorder helper: simulate `seconds` without rendering. Yields a task between steps so async work (mission mounts) resolves.
  const yieldTask = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  T.ff = async (seconds, fps = FIXED_FPS || 30) => {
    app.skipRender = true; const n = Math.round(seconds * fps);
    for (let i = 0; i < n; i++) { if (window.__vt) window.__vt.step(1000 / fps); else T.update(1 / fps); await yieldTask(); }
    app.skipRender = false;
  };
  return T;
}
