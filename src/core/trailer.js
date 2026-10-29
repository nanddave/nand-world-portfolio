// Trailer director (Phase 3.1). Plays src/content/trailer.js on one clock, driving the real app systems:
// globe flight, city view (scripted camera), drive mode autopilot, missions in a floating panel, captions, end card.
//
// Everything visual that changes over time (fades, captions, panel slide, end card) is computed from the trailer
// clock and written as inline styles each frame, never CSS transitions, so a fixed-timestep recording (&fixed=30)
// is frame-exact. See tools/record-trailer.mjs.
import { THREE, V, clamp, lerp } from '../kit/kit.js';
import { STOPS, CONTACT, isReal } from '../content/stops.js';
import { SHOTS, TRAILER_END, TRAILER_LENGTH } from '../content/trailer.js';
import { REEL, REEL_END, REEL_LENGTH } from '../content/reel.js';
import { VISITOR } from './visitor.js';
import '../styles/reel.css';
import { MISSIONS, mountMission } from '../missions/index.js';
import { WorkLog } from '../ui/worklog.js';
import { Sound } from './sound.js';
import { FIXED_FPS } from './vtime.js';

const CITY_IDX = Object.fromEntries(STOPS.map((s, i) => [s.id, i]));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const smoother = x => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
const ramp = (t, t0, d) => clamp((t - t0) / d, 0, 1);
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
  const REELM = params.get('reel') === 'hero'; // social reel (src/content/reel.js); without it the 60-s trailer plays unchanged
  const shots = (REELM ? REEL : SHOTS).map((s, i) => ({ ...s, _i: i })).sort((a, b) => a.at - b.at || a._i - b._i);
  const LEN = REELM ? REEL_LENGTH : TRAILER_LENGTH;

  const T = {
    active: false, done: false, t: 0, vertical: VERT, reel: REELM, length: LEN, fixed: FIXED_FPS, onStop: null,
    ready: false,
  };
  let els = null, idx = 0, stall = null, scene = 'globe', cityId = null, C = null;
  const loaded = new Map(); // city index -> scene
  const caps = [], panels = [], fades = [], clicks = [];
  let cine = null, move = null, drift = 0; // scripted city camera
  let ap = null; // drive autopilot
  let endShot = null;
  let keyHandler = null, generation = 0;

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
    if (REELM) reelBuild(d);
  }

  /* ---------- plan: captions, panels, fades are derived from the shot list ---------- */
  function plan() {
    caps.length = panels.length = fades.length = clicks.length = 0;
    let sc = 'globe'; const kf = [[0, 1], [.7, 0]];
    for (const s of shots) {
      if (s.do === 'caption') caps.push({ t0: s.at, dur: s.dur ?? 3, text: s.text, sub: s.sub || '' });
      else if (s.do === 'mission') panels.push({ t0: s.at, dur: s.dur ?? 3, id: s.id, scale: s.scale, mounted: false, h: null, fired: false });
      else if (REELM) continue; // the reel cuts on whips, never through black
      else if (s.do === 'travel' && sc === 'city') { kf.push([s.at - .22, 0], [s.at, 1], [s.at + .35, 0]); sc = 'globe'; }
      else if (s.do === 'enter' && sc === 'globe') { kf.push([s.at - .22, 0], [s.at, 1], [s.at + .4, 0]); sc = 'city'; }
      else if (s.do === 'travel' || s.do === 'enter') sc = s.do === 'enter' ? 'city' : 'globe';
    }
    if (REELM) kf.length = 0, kf.push([0, 0], [LEN, 0]); else kf.push([LEN - .6, 0], [LEN, 1]);
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
    cine = { c: center0(), yaw: c.yaw ?? c.cfg?.yaw ?? -.6, pitch: .5, dist: VERT ? (REELM ? 150 : 190) : 150 }; move = null; drift = .03; city.cine = cine;
    Sound.play(c.cfg?.sound || cityId);
  }

  /* ---------- shot dispatcher ---------- */
  function fire(s) {
    switch (s.do) {
      case 'globe': globe.view = s.view === 'intro' ? 'intro' : 'travel'; globe.spin = s.spin || 1; if (state.mode === 'city') toGlobe(); state.mode = 'globe'; if (REELM) { globe.faceIndia(); snapGlobeCam(); } break;
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
        moveTo({ c, yaw: s.yaw ?? cine?.yaw ?? 0, pitch: s.pitch ?? .35, dist: (s.dist ?? 60) * (VERT ? (REELM ? .8 : 1.35) : 1) }, s.dur ?? 3, smoother, .035); break;
      }
      case 'spot': if (C) { stopDrive(); moveTo(spotPose(s.k ?? 0), s.dur ?? 3, smoother, .03); } break;
      case 'drive': if (C) startDrive(s); break;
      case 'horn': Sound.horn(cityId); break;
      case 'lot': try { C?.raiseLot?.(s.name); } catch (e) { console.error(e); } break;
      case 'route': R.route = { t0: s.at, dur: s.dur ?? 2 }; break;
      case 'yours': yoursStart(s); break;
      case 'urlbar': R.bar.s = s; R.route = null; globe.setRoute(null); globeIntro(.8); break;
      case 'end': {
        if (REELM) { reelEnd(s); break; }
        endShot = { t0: s.at, dur: s.dur ?? 5.8 };
        if (C) { // settle on a wide, readable view of the street first (the lot building is too close to sit behind a title), then a slow push-in
          stopDrive(); const p = cine ? clonePose(cine) : poseFromCam(center0()), c = center0(), d = (VERT ? 150 : 110);
          moveTo({ c, yaw: p.yaw + .1, pitch: .34, dist: d }, 1.4, smooth, 0);
          move.next = { to: { c: c.clone(), yaw: p.yaw + .3, pitch: .3, dist: d * .8 }, dur: endShot.dur + .5, ease: smooth, drift: .02 };
        }
        break;
      }
      default: break; // 'caption', 'mission' and (reel) 'title' 'chip' 'whip' 'stats' are driven from the plan
    }
    return true;
  }

  /* ---------- HUD (captions, panel, end card) ---------- */
  function hud() {
    const W = innerWidth, H = innerHeight, t = T.t;
    els.fade.style.opacity = String(fadeAt(t));
    let panelShift = 0;
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
      if (REELM) { // reel: vertical = bottom half panel (inside the platform safe zone), landscape = right third
        if (VERT) { const aw = W * .84, ay0 = H * .44, ay1 = H * .79; sc = Math.min(aw / BW, (ay1 - ay0) / ih, 1.9); x = (W - BW * sc) / 2 - W * .02; y = ay0 + ((ay1 - ay0) - ih * sc) / 2; slide = (1 - inn) * 80 + out * 80; }
        else { const aw = W * .31, ah = H * .76; sc = Math.min(aw / BW, ah / ih, 2.2); x = W * .965 - BW * sc; y = H * .12 + (ah - ih * sc) / 2; slide = (1 - inn) * (BW * sc + W * .05) + out * (BW * sc * .35); }
        panelShift = Math.max(panelShift, a);
      } else
      if (VERT) { const aw = W * .92, ah = H * .91 - gap - (H * .5); sc = Math.min(aw / BW, ah / ih, 1.9); x = (W - BW * sc) / 2; y = H * .5 + (ah - ih * sc) / 2; slide = (1 - inn) * 60 + out * 60; }
      else { const aw = W * .38, ah = H - 2 * (bar + gap); sc = Math.min(aw / BW, ah / ih, 2.2) * (p.scale || 1); x = W - W * .03 - BW * sc; y = bar + gap + (ah - ih * sc) / 2; slide = (1 - inn) * (BW * sc + W * .05) + out * (BW * sc * .35); }
      els.panel.style.opacity = String(a);
      els.panel.style.transform = VERT ? `translate(${x}px,${y + slide}px) scale(${sc})` : `translate(${x + slide}px,${y}px) scale(${sc})`;
    }
    els.panel.style.visibility = shown ? 'visible' : 'hidden';
    if (REELM) hudReel(W, H, t, panelShift);
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

  /* ====================================================================================================================
     REEL (?trailer=1&reel=hero): social cut driven by the same clock. Everything below is written as inline styles from T.t,
     never CSS transitions, so &fixed=30 renders are frame-exact. Look: src/styles/reel.css.
     ==================================================================================================================== */
  const easeOutBack = x => { x = clamp(x, 0, 1); const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const easeOutCubic = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const easeIO = x => { x = clamp(x, 0, 1); return x < .5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x); };
  const R = { titles: [], chips: [], whips: [], stats: null, bar: null, yours: null, end: null, route: null, Y: null, dim: null, flash: null, blur: null, intro: null, introOn: false, shifted: false, wasWhip: false, shown: new WeakMap() };
  const BAR_HOST = "nand's world/", WORD_STAG = .085;
  const show = (el, on) => { if (R.shown.get(el) !== on) { R.shown.set(el, on); el.style.display = on ? '' : 'none'; } };
  const setTxt = (el, v) => { if (el.textContent !== v) el.textContent = v; };
  const cleanCompany = v => String(v || '').replace(/[^\p{L}\p{N} &.\-]/gu, '').trim().slice(0, 28) || null; // same rule as src/core/visitor.js

  function reelBuild(root) {
    Object.assign(R, { titles: [], chips: [], whips: [], stats: null, bar: null, yours: null, end: null, route: null, Y: null, introOn: false, shifted: false });
    const mk = (cls, html, parent = root) => { const e = document.createElement('div'); e.className = cls; if (html != null) e.innerHTML = html; parent.appendChild(e); show(e, false); return e; };
    R.dim = mk('rDim'); show(R.dim, true); R.flash = mk('rFlash'); show(R.flash, true);
    root.insertAdjacentHTML('beforeend', '<svg class="rSvg" width="0" height="0" aria-hidden="true"><filter id="rWhip" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feGaussianBlur id="rWhipB" stdDeviation="0 0"/></filter></svg>');
    R.blur = root.querySelector('#rWhipB'); R.intro = document.querySelector('#intro');
    for (const s of shots) {
      if (s.do === 'title') {
        const st = s.style || 'hook', words = String(s.text).split(/\s+/);
        const el = mk(`rt rt-${st}`, `<div class="rt-in">${words.map(w => `<span class="rw"><span class="rwi">${esc(w)}</span></span>`).join(' ')}</div>${s.sub ? `<div class="rt-sub">${esc(s.sub)}</div>` : ''}${st === 'hook' && /\.$/.test(s.text) ? '<i class="rt-bar"></i>' : ''}`);
        R.titles.push({ s, el, ws: [...el.querySelectorAll('.rwi')], bar: el.querySelector('.rt-bar'), sub: el.querySelector('.rt-sub') });
      } else if (s.do === 'chip') {
        const w = mk('rc-w', '<div class="rc"><i></i><span></span></div>'); w.querySelector('span').textContent = s.text;
        R.chips.push({ s, w, c: w.firstChild });
      } else if (s.do === 'whip') R.whips.push({ t0: s.at, dur: s.dur ?? .3, dir: R.whips.length % 2 ? -1 : 1 });
      else if (s.do === 'stats') {
        const el = mk('rst', s.items.map(([n, l]) => `<div class="rs-r"><b class="rs-n">${n === 0 ? '0' : '0'}</b><span class="rs-l">${esc(l)}</span></div>`).join(''));
        R.stats = { s, el, rows: [...el.querySelectorAll('.rs-r')].map((r, i) => ({ r, n: r.querySelector('.rs-n'), to: s.items[i][0], v: -1 })) };
      } else if (s.do === 'urlbar') {
        const el = mk('rub-w', '<div class="rub"><i class="lock"></i><span class="ub-t"><span class="ub-h"></span><span class="ub-q"></span><i class="caret"></i></span><i class="ub-p"></i></div>');
        R.bar = { s, el, bar: el.firstChild, h: el.querySelector('.ub-h'), q: el.querySelector('.ub-q'), caret: el.querySelector('.caret'), prog: el.querySelector('.ub-p'), entered: false };
      } else if (s.do === 'yours') {
        const q = sel => document.querySelector(sel);
        const el = mk('ry', `<div class="ry-c"><h2></h2><div class="ry-form"><p></p><div class="ry-in"><span class="ry-t"></span><i class="caret"></i><span class="ry-ph"></span></div><div class="ry-btn"></div></div><p class="ry-load"></p></div></div>`);
        setTxt(el.querySelector('h2'), q('#yT')?.textContent || 'Where are you reading this from?');
        setTxt(el.querySelector('.ry-form p'), q('#yoursForm p')?.textContent || 'Type your city and I\'ll fetch its real streets from OpenStreetMap and leave an empty lot for you.');
        setTxt(el.querySelector('.ry-ph'), q('#yoursIn')?.placeholder || 'e.g. Pune, Berlin, Austin');
        setTxt(el.querySelector('.ry-btn'), q('#yoursForm .btn.primary')?.textContent || 'Take me there');
        R.yours = { s, el, c: el.firstChild, t: el.querySelector('.ry-t'), caret: el.querySelector('.caret'), ph: el.querySelector('.ry-ph'), form: el.querySelector('.ry-form'), btn: el.querySelector('.ry-btn'), load: el.querySelector('.ry-load') };
      } else if (s.do === 'end') {
        const nm = REEL_END.name.split(' ').map(w => `<span class="rw"><span class="rwi">${esc(w)}</span></span>`).join(' ');
        const el = mk('re', `<div class="re-n">${nm}</div><div class="re-l"></div><div class="re-a"></div><div class="re-u"></div>`);
        setTxt(el.querySelector('.re-l'), REEL_END.line); setTxt(el.querySelector('.re-a'), REEL_END.ask);
        const u = el.querySelector('.re-u'); if (isReal(CONTACT.site)) setTxt(u, CONTACT.site); else u.remove();
        R.end = { s, el, ws: [...el.querySelectorAll('.rwi')], l: el.querySelector('.re-l'), a: el.querySelector('.re-a'), u: el.querySelector('.re-u'), t0: s.at, dur: s.dur ?? 3.4 };
        if (!shots.some(w => w.do === 'whip' && Math.abs(w.at - s.at) < .5)) R.whips.push({ t0: s.at - .1, dur: .3, dir: R.whips.length % 2 ? -1 : 1 }); // implicit cut into the end scene
      }
    }
    for (const c of R.chips) if (R.bar && c.s.at >= R.bar.s.at - .05 && c.s.at < R.bar.s.at + R.bar.s.dur) c.w.classList.add('below'); // sit under the address bar
    R.whips.sort((a, b) => a.t0 - b.t0);
  }
  function reelReset(stopping) {
    globe.setRoute?.(REELM && !stopping ? 0 : null); R.route = null; R.Y = null; R.introOn = false;
    if (!stopping) R.co0 = VISITOR.company;
    else { applyShift(0, 0); const cv = renderer.domElement; cv.style.filter = ''; cv.style.transform = ''; VISITOR.company = R.co0 ?? null; }
  }
  async function reelWarm() { // make the your-city flow instant: modules + the pre-baked city chunk are fetched before the clock starts
    try { const m = await import('./yourcity.js'); await import('../cities/yours.js'); const y = shots.find(s => s.do === 'yours'); if (y) await m.loadYourCity(y.text || 'Mumbai').catch(() => null); } catch (e) { console.info('reel: warm-up skipped', e && e.message); }
  }
  function applyShift(fx, fy) { // slide the 3D picture off-centre (projection offset) so the subject stays visible beside the mission panel
    const W = innerWidth, H = innerHeight, on = fx > .0005 || fy > .0005;
    for (const cam of [city.cam, globe.cam]) { if (!cam) continue; if (on) cam.setViewOffset(W, H, fx * W, fy * H, W, H); else if (cam.view && cam.view.enabled) cam.clearViewOffset(); }
    R.shifted = on;
  }
  function snapGlobeCam() { // the globe is not updated while a city is shown, so its camera would otherwise ease in from a stale position
    const d = innerWidth < 700 ? 92 : 76, A = globe.orbitA, E = globe.orbitE;
    globe.camPos.set(Math.sin(A) * Math.cos(E), Math.sin(E), Math.cos(A) * Math.cos(E)).multiplyScalar(d); globe.look.set(0, 0, 0); globe.up.set(0, 1, 0);
  }
  function globeIntro(spin) {
    if (state.mode === 'city') toGlobe();
    state.mode = 'globe'; globe.view = 'intro'; globe.spin = spin; globe.faceIndia(); snapGlobeCam();
  }
  function wideBackdrop(id) { // the street at night behind a card
    const i = CITY_IDX[id]; stopDrive(); if (state.mode === 'city') toGlobe(); toCity(i, loaded.get(i));
    const p = clonePose(cine); moveTo({ c: center0(), yaw: p.yaw + .4, pitch: .3, dist: VERT ? 150 : 105 }, 8, smooth, .02);
  }

  /* --- your-city: the real flow (prompt -> submit -> pre-baked Mumbai -> lot -> raiseLot), see src/main.js goYours/showYours --- */
  function yoursStart(s) {
    const text = s.text || 'Mumbai';
    wideBackdrop('brokai');
    R.Y = { t0: s.at, text, submitAt: .55 + text.length / 14 + .6, submitted: false, swapped: false, prevC: city.C, swapAt: 0, spot: false, raised: false, opened: false };
  }
  function yoursSwapped() { return state.cityIdx === -2 && city.C && city.C !== R.Y.prevC; }
  function stepYours() {
    const Y = R.Y; if (!Y) return; const e = T.t - Y.t0, $ = s => document.querySelector(s);
    if (!Y.opened) { Y.opened = true; try { window.__app?.openModal?.('#yours'); } catch { /* the overlay below is what the camera sees */ } }
    if (!Y.submitted && e >= Y.submitAt) {
      Y.submitted = true; const inp = $('#yoursIn'), f = $('#yoursForm');
      if (inp && f) { inp.value = Y.text; f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); } else console.error('reel: your-city form not found');
    }
    if (Y.submitted && !Y.swapped && yoursSwapped()) {
      Y.swapped = true; Y.swapAt = T.t; C = city.C; cityId = 'yours'; scene = 'city'; ap = null; globe.view = 'hidden';
      if (C?.scene?.fog && !C._reelFog) { C._reelFog = true; C.scene.fog.near *= 2.6; C.scene.fog.far *= 2.2; } // reel: let the real streets read
      cine = { c: center0(), yaw: C.yaw ?? C.cfg?.yaw ?? -.6, pitch: .6, dist: VERT ? 150 : 120 }; move = null; drift = .03; city.cine = cine;
      moveTo({ c: center0(), yaw: cine.yaw + .55, pitch: .5, dist: (VERT ? 1.25 : 1) * 85 }, 2.2, smoother, .03);
    }
    if (Y.swapped) {
      const k = T.t - Y.swapAt;
      if (!Y.spot && k >= 1.3) { Y.spot = true; moveTo(spotPose(0), 1.7, smoother, .03); }
      if (!Y.raised && k >= 1.8) { Y.raised = true; try { C?.raiseLot?.('Your company'); } catch (err) { console.error(err); } }
    } else if (Y.submitted && e > Y.submitAt + 2 && !stall) { // never cut to a half-built street: hold the clock until it is there
      stall = new Promise(res => { const poll = () => (!R.Y || yoursSwapped()) ? res() : setTimeout(poll, 40); poll(); }).then(() => { stall = null; });
    }
  }
  function reelEnd(s) {
    const bi = CITY_IDX.brokai; stopDrive();
    if (cityId !== 'brokai' || state.mode !== 'city') { if (state.mode === 'city') toGlobe(); toCity(bi, loaded.get(bi)); }
    const p = cine ? clonePose(cine) : poseFromCam(center0()), c = center0(), d = VERT ? 150 : 110, dur = R.end.dur;
    moveTo({ c, yaw: p.yaw + .1, pitch: .34, dist: d }, 1.2, smooth, 0);
    move.next = { to: { c: c.clone(), yaw: p.yaw + .32, pitch: .3, dist: d * .74 }, dur: dur + .5, ease: smooth, drift: .015 };
  }

  function stepReel(dt) {
    // route: progressive draw, camera follows the glowing head
    const rt = R.route;
    if (rt) {
      const e = T.t - rt.t0, p = easeIO(e / rt.dur); globe.setRoute(p); if (e > rt.dur + .4) R.route = null;
      if (e >= 0 && e < rt.dur + .35 && state.mode === 'globe') {
        const h = globe.routeHead, r = h.length() || 1, A = Math.atan2(h.x, h.z), E = Math.asin(clamp(h.y / r, -1, 1)) * .7 + .12, k = 1 - Math.exp(-dt * 5);
        globe.orbitA += wrap(A - globe.orbitA) * k; globe.orbitE += (E - globe.orbitE) * k; snapGlobeCam(); // set the camera directly: easing between far-apart points would cut through the planet
      }
    }
    stepYours();
    const B = R.bar;
    if (B && !B.entered && T.t - B.s.at >= barTimes(B).enterAt) { // Enter pressed: the visitor company is set at runtime, exactly like ?for= does at load
      B.entered = true; VISITOR.company = cleanCompany(B.s.company);
      const f = document.querySelector('#introFor'); if (f && VISITOR.company) { f.hidden = false; f.textContent = `Made for ${VISITOR.company}`; }
    }
  }
  const barTimes = B => { const N = (BAR_HOST + B.s.text).length; return { N, doneAt: .3 + N / 25, enterAt: .3 + N / 25 + .2 }; };

  function hudReel(W, H, t, panelShift) {
    let dim = 0;
    // --- titles
    for (const k of R.titles) {
      const { s } = k, e = t - s.at, dur = s.dur ?? 1.5, on = e > -.001 && e < dur + .02; show(k.el, on); if (!on) continue;
      const out = clamp((e - (dur - .2)) / .2, 0, 1), inn = clamp(e / .18, 0, 1), st = s.style || 'hook';
      k.el.style.opacity = String(1 - out); k.el.style.transform = `translate3d(0,${-out * .05}em,0)`;
      k.ws.forEach((w, i) => {
        const x = (e - i * WORD_STAG) / .42, p = easeOutBack(x), o = clamp(x * 3.2, 0, 1);
        w.style.opacity = String(o);
        w.style.transform = st === 'stat' ? `scale(${.55 + .45 * p})` : `translate3d(0,${(1 - p) * .42}em,0) scale(${1.32 - .32 * p})`;
      });
      if (k.bar) k.bar.style.transform = `scaleX(${easeOutCubic((e - k.ws.length * WORD_STAG - .15) / .5)})`;
      if (k.sub) { const x = (e - k.ws.length * WORD_STAG) / .4; k.sub.style.opacity = String(clamp(x, 0, 1)); k.sub.style.transform = `translate3d(0,${(1 - easeOutCubic(x)) * .6}em,0)`; }
      dim = Math.max(dim, Math.min(inn, 1 - out) * (st === 'hook' ? .35 : st === 'big' ? .3 : .42));
    }
    // --- chips
    for (const c of R.chips) {
      const e = t - c.s.at, dur = c.s.dur ?? 2, on = e > -.001 && e < dur + .02; show(c.w, on); if (!on) continue;
      const p = easeOutBack(e / .3), o = clamp(e / .12, 0, 1) * (1 - clamp((e - (dur - .2)) / .2, 0, 1)), q = clamp((e - (dur - .2)) / .2, 0, 1);
      c.c.style.opacity = String(o); c.c.style.transform = `translate3d(0,${(1 - p) * -.8}em,0) scale(${(.78 + .22 * p) * (1 - .08 * q)})`;
    }
    // --- stats
    if (R.stats) {
      const S = R.stats, e = t - S.s.at, dur = S.s.dur ?? 3, on = e > -.001 && e < dur + .02; show(S.el, on);
      if (on) {
        const out = clamp((e - (dur - .25)) / .25, 0, 1); S.el.style.opacity = String(1 - out);
        S.rows.forEach((r, i) => {
          const x = (e - .1 - i * .25) / .9, ex = easeOutCubic(x), v = Math.round(r.to === 0 ? 12 * (1 - ex) : r.to * ex), p = easeOutBack((e - .1 - i * .25) / .45);
          if (v !== r.v) { r.v = v; r.n.textContent = String(v); } r.n.classList.toggle('zero', r.to === 0 && x >= 1);
          r.r.style.opacity = String(clamp((e - .1 - i * .25) / .15, 0, 1)); r.r.style.transform = `translate3d(${(1 - p) * -.15}em,0,0)`;
        });
        dim = Math.max(dim, (1 - out) * clamp(e / .25, 0, 1) * .6);
      }
    }
    // --- address bar + intro
    if (R.bar) {
      const B = R.bar, s = B.s, e = t - s.at, dur = s.dur ?? 3, on = e > -.001 && e < dur + .02; show(B.el, on);
      const { N, doneAt, enterAt } = barTimes(B), full = BAR_HOST + s.text;
      if (on) {
        const inn = easeOutBack(e / .3), out = clamp((e - (dur - .25)) / .25, 0, 1), n = clamp(Math.floor((e - .3) * 25), 0, N), h = Math.min(n, BAR_HOST.length);
        setTxt(B.h, full.slice(0, h)); setTxt(B.q, full.slice(h, n));
        B.el.style.opacity = String(clamp(e / .15, 0, 1) * (1 - out)); B.bar.style.transform = `translate3d(0,${(1 - inn) * -1.2}em,0) scale(${1 - .03 * clamp((e - enterAt) / .08, 0, 1) * (1 - clamp((e - enterAt - .08) / .15, 0, 1))})`;
        B.caret.style.opacity = (e < doneAt + .1 || Math.floor(e * 2.5) % 2 === 0) ? '1' : '0';
        B.prog.style.transform = `scaleX(${easeOutCubic((e - enterAt) / .5)})`; B.prog.style.opacity = String(e > enterAt ? 1 - clamp((e - enterAt - .5) / .3, 0, 1) : 0);
      }
      // the app's own intro text (hero), shown behind the bar once Enter is pressed
      const q = e - enterAt - .1, fade = 1 - clamp((t - (s.at + dur + .1)) / .25, 0, 1), iOn = q > -.001 && fade > 0;
      if (iOn !== R.introOn) { R.introOn = iOn; document.body.classList.toggle('reel-intro', iOn); }
      if (iOn && R.intro) {
        const h1 = R.intro.querySelector('h1'), fr = R.intro.querySelector('p.for'), pp = R.intro.querySelector('p.hook'), ps = R.intro.querySelector('p.pos');
        const a = easeOutBack(q / .5), b = easeOutBack((q - .25) / .4), c = clamp((q - .5) / .3, 0, 1);
        R.intro.style.opacity = String(fade); R.intro.style.transform = 'none';
        if (h1) { h1.style.opacity = String(clamp(q / .2, 0, 1)); h1.style.transform = `translate3d(${(1 - a) * -.12}em,0,0)`; }
        if (fr) { fr.style.opacity = String(clamp((q - .25) / .15, 0, 1)); fr.style.transform = `scale(${.8 + .2 * b})`; }
        if (ps) { ps.style.opacity = String(clamp((q - .12) / .25, 0, 1)); ps.style.transform = `translate3d(0,${(1 - easeOutCubic((q - .12) / .4)) * .6}em,0)`; }
        if (pp) { pp.style.opacity = String(c * .92); }
        dim = Math.max(dim, fade * clamp(q / .4, 0, 1) * .3);
      }
    }
    // --- your-city prompt (a clock-driven replica of the app's modal; the real modal is hidden in trailer mode, the real form is submitted)
    if (R.yours && R.Y) {
      const Y = R.Y, y = R.yours, e = t - Y.t0, on = e > -.001 && !(Y.swapped); show(y.el, on);
      if (on) {
        const p = easeOutBack(e / .42), n = clamp(Math.floor((e - .55) * 14), 0, Y.text.length), typing = e >= .55 && n < Y.text.length;
        y.c.style.opacity = String(clamp(e / .2, 0, 1)); y.c.style.transform = `translate3d(0,${(1 - p) * 5}vh,0) scale(${.93 + .07 * p})`;
        setTxt(y.t, Y.text.slice(0, n)); y.ph.style.display = n === 0 ? '' : 'none';
        y.caret.style.opacity = (Y.submitted ? 0 : (typing || Math.floor(e * 2.5) % 2 === 0) ? 1 : 0);
        const press = e > Y.submitAt - .14 ? 1 : 0; y.btn.classList.toggle('press', !!press);
        y.form.style.display = e >= Y.submitAt ? 'none' : ''; y.load.style.display = e >= Y.submitAt ? '' : 'none';
        setTxt(y.load, `Fetching real streets for ${Y.text} from OpenStreetMap…`);
        dim = Math.max(dim, clamp(e / .3, 0, 1) * .5);
      }
    }
    // --- end card
    if (R.end) {
      const E = R.end, e = t - E.t0, on = e > -.001; show(E.el, on);
      if (on) {
        E.ws.forEach((w, i) => { const x = (e - .35 - i * .12) / .5, p = easeOutBack(x); w.style.opacity = String(clamp(x * 3, 0, 1)); w.style.transform = `translate3d(0,${(1 - p) * .35}em,0) scale(${1.25 - .25 * p})`; });
        const fi = (el, at) => { const x = easeOutCubic((e - at) / .6); el.style.opacity = String(x); el.style.transform = `translate3d(0,${(1 - x) * .7}em,0)`; };
        fi(E.l, 1.0); const x = easeOutBack((e - 1.5) / .5); E.a.style.opacity = String(clamp((e - 1.5) / .2, 0, 1)); E.a.style.transform = `scale(${.85 + .15 * x})`; if (E.u) fi(E.u, 2.1);
        dim = Math.max(dim, easeOutCubic(e / .9) * .55);
      }
    }
    R.dim.style.opacity = String(dim);
    // --- whip: directional blur + slight push, plus a faint white flash
    let env = 0, off = 0;
    for (const w of R.whips) {
      const x = (t - w.t0) / w.dur; if (x < 0 || x > 1) continue;
      const en = x < .3 ? smooth(x / .3) : 1 - smooth((x - .3) / .7), o = x < .3 ? w.dir * Math.pow(smooth(x / .3), 2) : -w.dir * Math.pow(1 - smooth((x - .3) / .7), 2);
      if (en > env) { env = en; off = o; }
    }
    const cv = renderer.domElement;
    if (env > .005) { R.wasWhip = true; R.blur.setAttribute('stdDeviation', `${(env * W * .03).toFixed(2)} 0`); cv.style.filter = 'url(#rWhip)'; cv.style.transform = `translate3d(${(off * W * .06).toFixed(1)}px,0,0) scale(${(1 + .07 * env).toFixed(4)})`; }
    else if (R.wasWhip) { R.wasWhip = false; cv.style.filter = ''; cv.style.transform = ''; }
    R.flash.style.opacity = String((.08 * env).toFixed(4));
    // --- keep the 3D subject beside the mission panel
    const sh = smooth(panelShift); applyShift(VERT ? 0 : .15 * sh, VERT ? .2 * sh : 0);
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
    stepCine(dt); stepDrive(); stepMissions(dt); if (REELM) stepReel(dt); hud();
    window.__trailerT = T.t;
    if (T.t >= LEN - 1e-6 && !T.done) { T.done = true; window.__trailerDone = true; }
  };

  /* ---------- lifecycle ---------- */
  T.start = async (opts = {}) => {
    if (T.active) return;
    const run = ++generation;
    T.active = true; T.done = false; T.ready = false; T.t = 0; idx = 0; stall = null; endShot = null; cine = null; move = null; ap = null; C = null; loaded.clear();
    window.__trailerDone = false; window.__trailerReady = false;
    document.body.classList.add('trailer'); document.body.classList.toggle('trailer-v', VERT); document.body.classList.add('on');
    buildDom(); plan();
    els.load.textContent = REC ? '' : 'Loading the trailer…';
    if (VERT) { city.fov = 62; globe.fov = REELM ? 56 : 58; } else { city.fov = null; globe.fov = REELM ? 34 : null; }
    globe.trailer = true; app.resize();
    state.mode = 'globe'; state.transit = false; globe.u = 0; globe.tw = null; globe.view = 'intro'; globe.spin = 1; globe.faceIndia(); globe.hidePins();
    drive.boost = 1; drive.chase = null; if (REC || opts.sound !== undefined) Sound.set(!REC && opts.sound);
    if (REELM) { document.body.classList.add('reel'); reelReset(); }
    keyHandler = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); T.stop(); } };
    addEventListener('keydown', keyHandler, true);
    try { await Promise.race([document.fonts.load('900 60px "Big Shoulders Display"'), new Promise(r => (window.__realTimeout || setTimeout)(r, 2500))]); } catch { /* fallback font is fine */ }
    if (!T.active || run !== generation) return;
    // Preload every city and mission up front so nothing builds while the clock runs.
    const ids = [...new Set(shots.filter(s => s.do === 'enter').map(s => CITY_IDX[s.city]))];
    if (REELM) { ids.push(CITY_IDX.brokai); await reelWarm(); } // brokai = backdrop for the your-city prompt and the end card
    for (const i of ids) { if (!T.active || run !== generation) return; await loadCity(i); if (!T.active || run !== generation) return; els.load.textContent = REC ? '' : `Loading the trailer… ${loaded.size}/${ids.length}`; }
    await Promise.all([...new Set(shots.filter(s => s.do === 'mission').map(s => s.id))].map(id => MISSIONS[id]().catch(() => null)));
    if (!T.active || run !== generation) return;
    els.load.textContent = ''; T.ready = true; window.__trailerReady = true; window.__trailerStart = performance.now();
    Sound.play('globe');
  };
  T.stop = () => {
    if (!T.active) return; generation++; T.active = false; T.ready = false;
    panels.forEach(p => { try { p.handle?.unmount?.(); } catch { /* ignore */ } });
    removeEventListener('keydown', keyHandler, true);
    stopDrive(); drive.boost = 1; drive.chase = null; city.cine = null; city.fov = null; globe.fov = null; globe.trailer = false; globe.spin = 1; globe.tw = null;
    if (state.mode === 'city') city.hide();
    els?.root.remove(); els = null;
    if (REELM) reelReset(true);
    document.body.classList.remove('trailer', 'trailer-v', 'reel', 'reel-intro', 'incity', 'focus'); app.resize();
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
