// Street-level city view: lazily builds each city via buildCity(id), caches it, orbits the camera
// (drag, wheel zoom, idle auto-rotate), projects spot markers from C.spots and flies to a spot on focus.
import { THREE, V, lerp, clamp } from '../kit/kit.js';
import { buildCity } from '../cities/index.js';
import { STOPS } from '../content/stops.js';

export function createCityView({ reduce = false, spotsEl, onSpot }) {
  const cache = new Map(), pending = new Map();
  const cam = new THREE.PerspectiveCamera(40, 1, .3, 1500);
  const V_ = {
    cam, C: null, ci: -1, spot: -1, yaw: 0, pitch: .38, tpitch: .38, dist: 95, tdist: 62, look: V(), spotDir: null,
    dragging: false, lastInteract: 0, els: [], seen: {}, drive: null, otgt: null, near: -1,
    cine: null, fov: null, paused: reduce, // trailer: scripted camera { c: Vector3 centre, yaw, pitch, dist } (overrides orbit/spot logic); FOV override
    /** Build (or reuse) a city. Never throws: a broken city becomes a placeholder scene. */
    async load(ci) {
      const id = STOPS[ci].id; if (cache.has(id)) return cache.get(id);
      if (!pending.has(id)) pending.set(id, buildCity(id).catch(e => { console.error('city build failed', id, e); return fallbackCity(); }).then(C => { cache.set(id, C); return C; }));
      return pending.get(id);
    },
    /** Swap in a loaded city (call while the screen is faded). */
    show(ci, C, customSpots) {
      V_.drive?.exit(); V_.otgt = null; V_.cine = null; V_.near = -1; V_.C = C; V_.ci = ci; V_.spot = -1; V_.spotDir = null; V_.labelsReadyAt = performance.now() + 900; layoutAt = -1e9;
      V_.yaw = C.yaw ?? C.cfg?.yaw ?? -.6; V_.dist = 95; V_.pitch = .62; V_.tdist = C.dist || 62; V_.tpitch = C.pitch || .38;
      cam.position.set(Math.sin(V_.yaw) * 120, 90, Math.cos(V_.yaw) * 120); V_.look.set(0, 0, 0);
      V_.custom = null; V_.setCar(V_.carKind, C); V_.drive?.reset(C); buildSpots(ci, C, customSpots); try { C.onEnter?.(); } catch (e) { console.error(e); }
    },
    /** Show an ad-hoc city (not one of STOPS) with its own spot list: { name, spots: [{ t, m, b }] }. Same markers, drive and orbit as show(). */
    showCustom(C, cfg) {
      V_.show(-2, C, cfg.spots); V_.custom = cfg;
    },
    carKind: 'classic',
    /** Show the chosen hero car in city C (default: current). The trailer always films the classic yellow car. */
    setCar(kind, C = V_.C) {
      V_.carKind = kind; if (!C?.swapHero) return;
      const car = C.swapHero(document.body.classList.contains('trailer') ? 'classic' : kind);
      if (V_.drive?.C === C) V_.drive.car = car;
    },
    hide() { V_.custom = null; V_.drive?.exit(); V_.cine = null; V_.els.forEach(e => e.remove()); V_.els = []; V_.C = null; V_.ci = -1; V_.spot = -1; },
    focus(k) { V_.spot = k; V_.spotDir = null; (V_.seen[V_.ci] = V_.seen[V_.ci] || new Set()).add(k); V_.els[k]?.classList.add('seen'); },
    unfocus() { V_.spot = -1; V_.lastInteract = performance.now(); },
    /** Start driving the city's hero car (chase camera eases in from the current view). */
    enterDrive() { const D = V_.drive; if (!D || !V_.C || D.active || V_.spot >= 0) return false; D.enter(V_.C); return true; },
    /** Back to orbit around the car, from exactly where the camera is (no jump). */
    exitDrive() {
      const D = V_.drive; if (!D?.active) return; const p = V(D.x, 1.5, D.z); D.exit();
      const o = cam.position.clone().sub(p), d = Math.max(8, o.length());
      V_.otgt = p; V_.dist = d; V_.pitch = Math.asin(clamp(o.y / d, -1, 1)); V_.yaw = Math.atan2(o.x, o.z);
      V_.tdist = 40; V_.tpitch = .38; V_.lastInteract = performance.now();
    },
    drag(dx, dy) { if (V_.spot >= 0 || V_.drive?.active) return; V_.yaw -= dx * .005; V_.tpitch = clamp(V_.tpitch + dy * .003, .12, 1.1); V_.lastInteract = performance.now(); },
    wheel(dy) { if (V_.spot >= 0 || V_.drive?.active) return; V_.tdist = clamp(V_.tdist + dy * .05, 30, 110); V_.lastInteract = performance.now(); },
    resize(w, h) { cam.aspect = w / h; cam.fov = V_.fov ?? (w < 700 ? 55 : 40); cam.userData.baseFov = V_.fov; cam.updateProjectionMatrix(); },
  };

  function buildSpots(ci, C, customSpots) {
    V_.els.forEach(e => e.remove());
    const spots = customSpots || STOPS[ci].spots, seen = V_.seen[ci] || new Set(), label = customSpots ? 'your city' : STOPS[ci].id;
    V_.els = spots.map((sp, k) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'spot off' + (seen.has(k) ? ' seen' : '') + (sp.mission ? ' has-mission' : '');
      b.dataset.spot = k; b.setAttribute('aria-label', `Open spot ${k + 1}: ${sp.t}`);
      b.innerHTML = `<span class="ring">${k + 1}</span><span class="lab collapsed">${sp.t}${sp.mission ? '<i>try it</i>' : ''}</span>`;
      b.addEventListener('click', () => onSpot?.(k)); spotsEl.appendChild(b); return b;
    });
    if (C.spots.length !== spots.length) console.warn(`city ${label}:${C.spots.length} C.spot() calls vs ${spots.length} spots in content`);
  }

  const desired = V(), look = V(), side = V(), pr = V();
  let sheetH = 0, sheetAt = -1e9, layoutAt = -1e9, safe = [], sizes = [];
  V_.update = (dt, T, W, H, playingTrailer = false) => {
    const C = V_.C; if (!C) return;
    try { if (!V_.paused || playingTrailer) C.update(T, dt); } catch (e) { /* a city tick error must not freeze the app */ if (!C._warned) { console.error(e); C._warned = true; } }
    const k = reduce ? 1 : 1 - Math.exp(-dt * 1.5);
    const D = V_.drive, driving = !!D?.active;
    const cine = !driving ? V_.cine : null;
    const sp = !driving && !cine && V_.spot >= 0 ? (C.spots[V_.spot] || C.spots[C.spots.length - 1]) : null;
    if (driving) { V_.near = D.update(dt, V_.spot >= 0 || document.body.classList.contains('reading') || !!document.querySelector('.modal:not([hidden])')).nearSpot; V_.look.copy(D.look); }
    else if (cine) {
      const cp = Math.cos(cine.pitch); cam.position.set(cine.c.x + Math.sin(cine.yaw) * cp * cine.dist, cine.c.y + Math.sin(cine.pitch) * cine.dist, cine.c.z + Math.cos(cine.yaw) * cp * cine.dist);
      V_.look.copy(cine.c); cam.lookAt(V_.look);
    }
    else if (sp) {
      // Approach from the side the camera is already on, so we don't swing through the city.
      if (!V_.spotDir) { V_.spotDir = V(cam.position.x - sp.p.x, 0, cam.position.z - sp.p.z); if (V_.spotDir.lengthSq() < 1e-4) V_.spotDir.set(0, 0, 1); V_.spotDir.normalize(); }
      const dist = Math.max(22, sp.p.y * 1.4 + 14);
      desired.copy(sp.p).addScaledVector(V_.spotDir, dist); desired.y = sp.p.y * .6 + dist * .45; look.copy(sp.p); look.y = sp.p.y * .7;
      if (W > 860) { side.set(V_.spotDir.z, 0, -V_.spotDir.x); look.addScaledVector(side, dist * .28); } else {
        // Phone bottom sheet: put the spot ~45% down the strip of screen that stays visible above the sheet.
        const nowMs = performance.now();
        if (nowMs - sheetAt > 200) { sheetAt = nowMs; const c = document.getElementById('card'); sheetH = c ? c.offsetHeight : H * .5; }
        const visible = Math.max(80, H - sheetH), ndc = 1 - 2 * (visible * .45) / H;
        const dx = desired.x - look.x, dy = desired.y - look.y, dz = desired.z - look.z, dl = Math.hypot(dx, dy, dz) || 1;
        const cosP = Math.max(.35, Math.hypot(dx, dz) / dl);
        look.y -= ndc * dl * Math.tan(cam.fov * Math.PI / 360) / cosP;
      }
    } else {
      if (!V_.dragging && performance.now() - V_.lastInteract > 4000 && !reduce && !V_.paused) V_.yaw += dt * .04;
      V_.dist = lerp(V_.dist, V_.tdist, k); V_.pitch = lerp(V_.pitch, V_.tpitch, k);
      const tgt = V_.otgt || C.target || V(0, 2, 0);
      desired.set(Math.sin(V_.yaw) * Math.cos(V_.pitch), Math.sin(V_.pitch), Math.cos(V_.yaw) * Math.cos(V_.pitch)).multiplyScalar(V_.dist).add(tgt); look.copy(tgt);
    }
    const remain = driving || cine ? 0 : Math.hypot(desired.x - cam.position.x, desired.z - cam.position.z);
    if (!driving && !cine) cam.position.lerp(desired, k);
    // Stay high while far from the destination: an arc over the rooftops instead of a straight line through them.
    if (sp) cam.position.y = Math.max(cam.position.y, desired.y + Math.min(30, remain * .35));
    if (!driving && !cine) { V_.look.lerp(look, k); cam.lookAt(V_.look); } cam.updateMatrixWorld();
    if (!driving) V_.near = -1;
    const now = performance.now();
    if (now - layoutAt > 250 || sizes.length !== V_.els.length) {
      layoutAt = now;
      sizes = V_.els.map(el => { const label = el.querySelector('.lab'); return { w:label.offsetWidth, h:label.offsetHeight }; });
    }
    safe = ['#top', '#ctitle', '#bar', '#pilot', '#joy', '#hornBtn'].map(id => document.querySelector(id)).filter(el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0).map(el => { const r = el.getBoundingClientRect(); return { left:r.left-8, top:r.top-8, right:r.right+8, bottom:r.bottom+8 }; });
    const projected = V_.els.map((el, i) => {
      const s = C.spots[i]; const off = !s || V_.spot >= 0; if (s) { pr.copy(s.p); pr.y += 1.2; pr.project(cam); }
      const x=(pr.x * .5 + .5) * W, y=(-pr.y * .5 + .5) * H;
      const blocked = safe.some(r => x+20>r.left && x-20<r.right && y+20>r.top && y-20<r.bottom);
      const hide = off || pr.z > 1 || pr.z < -1 || Math.abs(pr.x) > 1 || Math.abs(pr.y) > 1 || blocked;
      return { el, i, hide, x, y };
    });
    const placed = [], priority = [...projected].sort((a,b) => Number(b.el === document.activeElement) - Number(a.el === document.activeElement) || Number(b.i === V_.near) - Number(a.i === V_.near) || a.i-b.i);
    let expanded = 0;
    for (const {el,i,hide,x,y} of priority) {
      el.classList.toggle('off', hide); el.classList.toggle('near', i === V_.near && V_.spot < 0);
      el.tabIndex = hide ? -1 : 0;
      if (hide && document.activeElement === el) document.getElementById('placesBtn')?.focus({ preventScroll:true });
      const label = el.querySelector('.lab'), size = sizes[i];
      if (!hide) el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      const candidates = [[x-size.w/2,y-28-size.h],[x+28,y-size.h/2],[x-28-size.w,y-size.h/2],[x-size.w/2,y+28]];
      const fits = ([left,top]) => { const r={left,top,right:left+size.w,bottom:top+size.h}; return left>=8 && top>=8 && r.right<=W-8 && r.bottom<=H-8 && [...safe,...placed].every(o => r.right+8<=o.left || r.left-8>=o.right || r.bottom+8<=o.top || r.top-8>=o.bottom); };
      const pos = !hide && now >= V_.labelsReadyAt && !(W < 768 && expanded) ? candidates.find(fits) : null;
      label.classList.toggle('collapsed', !pos);
      if (pos) { el.dataset.labelSide = String(candidates.indexOf(pos)); label.style.left = `${pos[0]-x+20}px`; label.style.top = `${pos[1]-y+20}px`; placed.push({left:pos[0],top:pos[1],right:pos[0]+size.w,bottom:pos[1]+size.h}); expanded++; }
    }
  };
  return V_;
}

// Minimal scene used only if a city module fails to build, so the journey can continue.
async function fallbackCity() {
  const { newCity } = await import('../kit/city.js');
  const C = newCity({ top: '#6CA6DE', hor: '#FFE0AE', bot: '#C9A26E', fog: '#EED9B8', sun: '#FFE4B8', si: 1.3, sunPos: [60, 38, 40], hs: '#D6E4F5', hg: '#8A6A44', hi: .7, ground: '#C6A46A' });
  for (let i = 0; i < 6; i++) C.spot(-20 + i * 8, 3, 0);
  return C;
}
