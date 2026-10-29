// Shared 3D toolkit. Everything is procedural (no external models), so the site costs nothing to build or host.
// Conventions: 1 unit ≈ 1 metre. Meshes sit on y=0. Vehicles face +x. Use mat()/glow() for materials (cached).
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export { THREE };

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Seeded random so scenes look the same on every visit.
export function makeRng(seed = 7) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
export let rnd = makeRng(7);
export function reseed(seed) { rnd = makeRng(seed); }

const MC = new Map();
/** Cached flat-shaded standard material. o = extra MeshStandardMaterial params. */
export function mat(color, o) {
  const k = color + '|' + JSON.stringify(o || {});
  if (!MC.has(k)) MC.set(k, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0, flatShading: true }, o || {})));
  return MC.get(k);
}
/** Emissive material (picked up by bloom at night). */
export function glow(color, intensity = 1.4) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 }); }

export function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
}
// Primitives: positioned by their base (y = bottom).
export const box = (w, h, d, m, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z);
export const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, seg = 12) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z);
export const cone = (r, h, m, x = 0, y = 0, z = 0, seg = 8) => mesh(new THREE.ConeGeometry(r, h, seg), m, x, y + h / 2, z);
export const ball = (r, m, x = 0, y = 0, z = 0, det = 1) => mesh(new THREE.IcosahedronGeometry(r, det), m, x, y, z);
export const dome = (r, m, x = 0, y = 0, z = 0, seg = 16) => mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2), 0, Math.PI * 2, 0, Math.PI / 2), m, x, y, z);
/** Lathe: profile = [[radius, height], ...] bottom to top. Great for towers, domes, cups, water towers. */
export function lathe(profile, m, seg = 24) { return mesh(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), m); }
/** Extrude a 2D outline [[x,y],...] by depth (along z, centred). Great for gables, arches, signs, bridge towers. */
export function extrude(outline, depth, m, bevel = false) {
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2); return mesh(g, m);
}
/** Tube along points [[x,y,z],...] (cables, rails, monorail beams). */
export function tube(points, r, m, seg = 40) { const c = new THREE.CatmullRomCurve3(points.map(p => V(...p))); return mesh(new THREE.TubeGeometry(c, seg, r, 6, false), m); }
export function grp(...children) { const g = new THREE.Group(); children.forEach(c => c && g.add(c)); return g; }
export function place(o, x, z, ry) { o.position.x = x; o.position.z = z; if (ry) o.rotation.y = ry; return o; }
export function at(o, x = 0, y = 0, z = 0) { o.position.x += x; o.position.y += y; o.position.z += z; return o; }

// ---------- window textures (canvas, cached) ----------
const WT = {};
export const WCFG = {
  office: { c: 4, r: 4, ww: .6, wh: .5, wall: 205, glass: 92, cw: 2.6, ch: 3.6 },
  res: { c: 2, r: 2, ww: .38, wh: .45, wall: 228, glass: 80, cw: 3.4, ch: 3.4 },
  glass: { c: 6, r: 4, ww: .9, wh: .78, wall: 150, glass: 120, cw: 1.8, ch: 3.6 },
  brick: { c: 3, r: 2, ww: .36, wh: .55, wall: 235, glass: 70, cw: 2.2, ch: 3.4 },
  shop: { c: 2, r: 1, ww: .8, wh: .55, wall: 230, glass: 90, cw: 4, ch: 3.4 },
};
function winTex(kind, night) {
  const key = kind + night; if (WT[key]) return WT[key];
  const cfg = WCFG[kind], W = 256, H = 256, r = makeRng(kind.length * 31 + (night ? 7 : 3));
  const a = document.createElement('canvas'); a.width = W; a.height = H; const g = a.getContext('2d');
  const e = document.createElement('canvas'); e.width = W; e.height = H; const ge = e.getContext('2d');
  g.fillStyle = `rgb(${cfg.wall},${cfg.wall},${cfg.wall})`; g.fillRect(0, 0, W, H); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const cw = W / cfg.c, ch = H / cfg.r;
  for (let i = 0; i < cfg.c; i++) for (let j = 0; j < cfg.r; j++) {
    const x = i * cw + cw * (1 - cfg.ww) / 2, y = j * ch + ch * (1 - cfg.wh) / 2, w = cw * cfg.ww, h = ch * cfg.wh;
    const v = cfg.glass + ((i * 7 + j * 13) % 5) * 6; g.fillStyle = `rgb(${v},${v + 8},${v + 18})`; g.fillRect(x, y, w, h);
    if (kind === 'brick') { g.fillStyle = 'rgb(250,250,245)'; g.fillRect(x - 3, y - 4, w + 6, 4); g.fillRect(x - 3, y + h, w + 6, 5); }
    if (night && r() < (kind === 'glass' ? .55 : .5)) { ge.fillStyle = r() < .8 ? `rgb(255,${200 + Math.floor(r() * 40)},130)` : 'rgb(190,220,255)'; ge.fillRect(x, y, w, h); }
  }
  const t1 = new THREE.CanvasTexture(a), t2 = new THREE.CanvasTexture(e);
  [t1, t2].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  return (WT[key] = { map: t1, emi: t2 });
}
/** Box building with real-scale window grid. kind: office|res|glass|brick|shop. night=true lights windows. */
export function building(w, h, d, color, kind = 'office', night = false, roof = '#8A8A8A') {
  const tx = winTex(kind, night), wc = WCFG[kind];
  const side = len => {
    const m = tx.map.clone(); m.needsUpdate = true;
    m.repeat.set(Math.max(.5, len / (wc.c * wc.cw)), Math.max(.5, h / (wc.r * wc.ch)));
    const o = { color, map: m, roughness: kind === 'glass' ? .35 : .85, metalness: kind === 'glass' ? .2 : 0 };
    if (night) { const em = tx.emi.clone(); em.needsUpdate = true; em.repeat.copy(m.repeat); o.emissive = new THREE.Color(0xffffff); o.emissiveMap = em; o.emissiveIntensity = 1; }
    return new THREE.MeshStandardMaterial(o);
  };
  const sx = side(d), sz = side(w), top = mat(roof);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sx, sx, top, top, sz, sz]);
  m.position.y = h / 2; m.castShadow = m.receiveShadow = true; return m;
}

// ---------- text ----------
export function textTex(text, o = {}) {
  const c = document.createElement('canvas'); c.width = o.w || 512; c.height = o.h || 128; const g = c.getContext('2d');
  g.fillStyle = o.bg || '#FFFFFF'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = o.fg || '#16192E';
  g.font = o.font || '800 64px "Big Shoulders Display", "Arial Narrow", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 20);
  return new THREE.CanvasTexture(c);
}
/** Flat sign plane facing +z. o: {bg, fg, font, glow} */
export function sign(text, w, h, o = {}) {
  const t = textTex(text, o);
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: .6, emissive: new THREE.Color(o.glow ? 0xffffff : 0), emissiveMap: o.glow ? t : null, emissiveIntensity: o.glow ? 1 : 0 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}

// ---------- people, trees, street furniture ----------
export const SKIN = ['#F2C14E', '#E76F51', '#2A9D8F', '#264653', '#F4A261', '#E9C46A', '#6D597A', '#B56576', '#FFFFFF', '#3A86FF'];
export function person(c) { const g = grp(cyl(.28, .32, 1.0, c, 0, .55), ball(.24, '#8D5A3B', 0, 1.82, 0, 1), cyl(.12, .12, .55, '#2B2B35', -.12, 0), cyl(.12, .12, .55, '#2B2B35', .12, 0)); g.scale.setScalar(.95); return g; }
export function treeRound(c = '#5C8C3E', s = 1) { const g = grp(cyl(.25, .35, 2.2, '#6B4A2B'), ball(2, c, 0, 3.6, 0, 1)); g.children[1].scale.set(1.2, .8, 1.2); g.scale.setScalar(s); return g; }
export function treeRain(c = '#4E8B3E', s = 1) { const g = grp(cyl(.3, .45, 2.8, '#5E4128'), ball(2.6, c, 0, 4.2, 0, 1), ball(1.8, c, 1.6, 3.8, .4, 1), ball(1.6, c, -1.5, 3.9, -.3, 1)); g.children.slice(1).forEach(b => b.scale.y = .6); g.scale.setScalar(s); return g; }
export function fir(s = 1, snow = false) { const g = grp(cyl(.18, .22, 1, '#5B4128'), cone(1.5, 2.6, '#2E5E45', 0, .8), cone(1.15, 2.2, '#356B4F', 0, 2.2), cone(.8, 1.8, '#3C7656', 0, 3.4)); if (snow) { g.add(cone(.55, .8, '#F4F7FA', 0, 4.6)); } g.scale.setScalar(s); return g; }
export function palm(s = 1) { const g = grp(cyl(.14, .22, 5, '#8A6A44', 0, 0, 0, 6)); for (let i = 0; i < 6; i++) { const f = box(2.4, .08, .6, '#4E9A47'); f.position.set(Math.cos(i) * 1.1, 5, Math.sin(i) * 1.1); f.rotation.y = -i; f.rotation.z = -.35; g.add(f); } g.scale.setScalar(s); return g; }
export function bareTree(s = 1) { const g = grp(cyl(.15, .25, 3, '#4A3A2E')); for (let i = 0; i < 5; i++) { const b = cyl(.05, .09, 1.8, '#4A3A2E'); b.position.set(Math.cos(i * 1.3) * .4, 2.8, Math.sin(i * 1.3) * .4); b.rotation.z = Math.cos(i * 1.3) * .6; b.rotation.x = Math.sin(i * 1.3) * .6; g.add(b); } g.scale.setScalar(s); return g; }
export function streetLight(night = false, c = '#FFD28A') { return grp(cyl(.07, .1, 5, '#3A3D45'), box(1.4, .08, .12, '#3A3D45', .6, 5), ball(.22, night ? glow(c, 2.2) : mat('#DDDDDD'), 1.2, 4.85, 0, 1)); }

// ---------- vehicles (face +x) ----------
export function wheel(x, z, r = .38) { const w = cyl(r, r, .3, '#1E1E24'); w.rotation.x = Math.PI / 2; w.position.set(x, r, z); return w; }
export function car(c, night = false) {
  const lamp = (col, n) => n ? glow(col, 2) : col;
  return grp(box(4.2, .9, 1.8, c, 0, .35), box(2.3, .75, 1.62, '#BFD6E6', -.2, 1.25), box(2.35, .08, 1.66, c, -.2, 2),
    wheel(1.35, .85), wheel(-1.35, .85), wheel(1.35, -.85), wheel(-1.35, -.85),
    box(.08, .22, .4, lamp('#FFF6D0', night), 2.12, .75, .55), box(.08, .22, .4, lamp('#FFF6D0', night), 2.12, .75, -.55),
    box(.08, .2, .4, lamp(night ? '#FF3030' : '#B02020', night), -2.12, .75, .55), box(.08, .2, .4, lamp(night ? '#FF3030' : '#B02020', night), -2.12, .75, -.55));
}
// ---------- realistic cars: smooth extruded bodies, clearcoat paint with a reflection map, tinted glass, chrome rims ----------
// Each car: group (faces +x) holding userData.body (sprung part, can lean) and userData.wheels [{ pivot, spin, front, r }].
let envTex = null;
function carEnv() { // small painted "sky + horizon + studio lights" panorama, so paint and glass have something to reflect
  if (envTex) return envTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#8FB0D9'); g.addColorStop(.46, '#F6E9D6'); g.addColorStop(.5, '#7A726A'); g.addColorStop(1, '#24211F');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256); x.fillStyle = 'rgba(255,255,255,.9)';
  [[40, 36, 140, 16], [250, 26, 110, 12], [410, 60, 70, 10], [150, 84, 60, 6]].forEach(r => x.fillRect(...r));
  envTex = new THREE.CanvasTexture(c); envTex.mapping = THREE.EquirectangularReflectionMapping; envTex.colorSpace = THREE.SRGBColorSpace; return envTex;
}
const PAINT = new Map();
const paint = c => { if (!PAINT.has(c)) PAINT.set(c, new THREE.MeshPhysicalMaterial({ color: c, metalness: .5, roughness: .3, clearcoat: 1, clearcoatRoughness: .06, envMap: carEnv(), envMapIntensity: 1.15 })); return PAINT.get(c); };
let CM = null;
const carMats = () => CM || (CM = {
  glass: new THREE.MeshPhysicalMaterial({ color: '#0E1620', metalness: .2, roughness: .04, clearcoat: 1, envMap: carEnv(), envMapIntensity: 1.6 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#D8DCE0', metalness: 1, roughness: .18, envMap: carEnv() }),
  tire: new THREE.MeshStandardMaterial({ color: '#17171A', roughness: .92 }),
  trim: new THREE.MeshStandardMaterial({ color: '#141518', roughness: .55, metalness: .2 }),
});

/** Side outline → smooth body: straight floor with wheel arches, spline over the top, extruded across the width with rounded edges,
 *  then narrowed towards nose/tail and leaned in above the beltline. */
function shellGeo({ top, y0, wheels, r, w, nose = .86, tail = .9, tumble = .84, bevel = .12, arches = true }) {
  const xs = top.map(p => p[0]), xr = Math.min(...xs), xf = Math.max(...xs), s = new THREE.Shape(), R = r + .1;
  s.moveTo(xr + .05, y0);
  if (arches) [...wheels].sort((a, b) => a - b).forEach(wx => { s.lineTo(wx - R, y0); s.absarc(wx, y0, R, Math.PI, 0, true); });
  s.lineTo(xf - .05, y0); s.splineThru(top.map(([x, y]) => new THREE.Vector2(x, y))); s.lineTo(xr + .05, y0);
  const d = Math.max(.2, w - 2 * bevel), g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -d / 2); g.computeBoundingBox();
  const { min, max } = g.boundingBox, p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) - min.x) / (max.x - min.x), v = (p.getY(i) - min.y) / (max.y - min.y);
    const plan = 1 - (1 - nose) * Math.max(0, (u - .72) / .28) ** 2 - (1 - tail) * Math.max(0, (.28 - u) / .28) ** 2;
    p.setZ(i, p.getZ(i) * plan * (1 - (1 - tumble) * Math.max(0, (v - .5) / .5)));
  }
  g.deleteAttribute('uv'); return toCreasedNormals(g.toNonIndexed(), Math.PI / 4); // panels stay flat, edges round
}
function carWheel(x, z, r, front, detail) {
  const M = carMats(), pivot = new THREE.Group(), spin = new THREE.Group(), side = Math.sign(z);
  pivot.position.set(x, r, z); pivot.add(spin);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .27, 24), M.tire); tire.rotation.x = Math.PI / 2; spin.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * .66, r * .66, .28, 20), detail ? M.trim : M.chrome); rim.rotation.x = Math.PI / 2; spin.add(rim);
  if (detail) for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.24, .09, .05), M.chrome); sp.position.z = side * .145; sp.rotation.z = k * Math.PI * 2 / 5; spin.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * .16, r * .16, .3, 10), M.chrome); hub.rotation.x = Math.PI / 2; spin.add(hub);
  tire.castShadow = true; return { pivot, spin, front, r };
}
/** spec: { c, w, r, y0, wheels:[front x, rear x], top:[[x,y]...] front→rear, cabin:[[x,y]...] front→rear, lamp:{y, h}, ...shell tweaks, extra(body, paintMat, M) } */
function makeCar(spec, night = false, detail = true) {
  const M = carMats(), P = paint(spec.c), g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const shell = new THREE.Mesh(shellGeo({ ...spec, top: spec.top }), P); shell.castShadow = shell.receiveShadow = true; body.add(shell);
  const cab = new THREE.Mesh(shellGeo({ top: spec.cabin, y0: spec.cabin[spec.cabin.length - 1][1] - .02, wheels: [], r: 0, w: spec.w * .86, nose: .8, tail: .86, tumble: .72, bevel: .08, arches: false }), M.glass);
  cab.castShadow = true; body.add(cab);
  const hw = spec.w / 2, L = spec.lamp;
  // x of the body outline at height y, on the nose (front) or tail end, so lamps sit on the surface
  const edgeAt = (y, front) => { const t = front ? spec.top : [...spec.top].reverse(); for (let i = 0; i < t.length - 1; i++) { const [x1, y1] = t[i], [x2, y2] = t[i + 1]; if ((y - y1) * (y - y2) <= 0 && y1 !== y2) return x1 + (x2 - x1) * (y - y1) / (y2 - y1); } return t[0][0]; };
  const xf = edgeAt(L.y, true), xr = edgeAt(L.y, false), xg = edgeAt(Math.max(spec.y0 + .08, L.y - L.h * 1.2), true);
  const head = night ? glow('#FFF4D6', 2.4) : new THREE.MeshStandardMaterial({ color: '#F4F2EA', roughness: .1, metalness: .3, emissive: '#FFF6E0', emissiveIntensity: .25 });
  const tailM = night ? glow('#FF2A2A', 2.2) : new THREE.MeshStandardMaterial({ color: '#B0161C', roughness: .2, emissive: '#7A0A0A', emissiveIntensity: .4 });
  [1, -1].forEach(sd => { const h = new THREE.Mesh(new THREE.BoxGeometry(.14, L.h, hw * .36), head); h.position.set(xf - .05, L.y, sd * hw * .5); body.add(h); });
  const tl = new THREE.Mesh(new THREE.BoxGeometry(.1, L.h * .8, spec.w * .74), tailM); tl.position.set(xr + .04, L.y, 0); body.add(tl);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(.1, L.h * 1.3, hw * .56), M.trim); grille.position.set(xg - .04, Math.max(spec.y0 + .08, L.y - L.h * 1.2), 0); body.add(grille);
  if (detail) [1, -1].forEach(sd => { const mr = new THREE.Mesh(new THREE.BoxGeometry(.16, .1, .16), P); mr.position.set(spec.cabin[0][0] - .1, spec.cabin[0][1] + .06, sd * (hw * .8 + .06)); body.add(mr); });
  spec.extra?.(body, P, M, spec);
  const wheels = []; spec.wheels.forEach((x, i) => [1, -1].forEach(sd => { const wl = carWheel(x, sd * (hw - .16), spec.r, i === 0, detail); g.add(wl.pivot); wheels.push(wl); }));
  g.userData.body = body; g.userData.wheels = wheels; return g;
}
const SPECS = {
  classic: { c: '#FFC93C', w: 1.86, r: .34, y0: .3, wheels: [1.38, -1.4], lamp: { y: .72, h: .09 },
    top: [[2.3, .4], [2.27, .62], [1.9, .74], [1.0, .84], [.55, .89], [-1.3, .92], [-2.0, .9], [-2.27, .72], [-2.27, .42]],
    cabin: [[.62, .87], [.2, 1.12], [-.25, 1.28], [-.85, 1.3], [-1.45, 1.16], [-2.0, .9], [-1.85, .87]] },
  sedan: { c: '#16181D', w: 1.92, r: .37, y0: .3, wheels: [1.62, -1.6], lamp: { y: .76, h: .08 }, nose: .9, tail: .94,
    top: [[2.65, .42], [2.62, .66], [2.3, .79], [1.1, .89], [.8, .93], [-1.6, .96], [-2.45, .93], [-2.66, .72], [-2.64, .42]],
    cabin: [[.86, .91], [.36, 1.2], [-.1, 1.42], [-1.0, 1.44], [-1.6, 1.3], [-2.05, .98], [-1.9, .92]],
    extra: (b, P, M) => [1, -1].forEach(sd => { const s = new THREE.Mesh(new THREE.BoxGeometry(3.0, .035, .03), M.chrome); s.position.set(-.6, .93, sd * .83); b.add(s); }) },
  hyper: { c: '#FF6A13', w: 2.0, r: .35, y0: .22, wheels: [1.42, -1.36], lamp: { y: .55, h: .06 }, nose: .78, tumble: .78,
    top: [[2.35, .32], [2.2, .5], [1.4, .66], [.6, .78], [-1.0, .86], [-2.1, .82], [-2.34, .6], [-2.33, .32]],
    cabin: [[.75, .76], [.3, .98], [-.2, 1.1], [-.8, 1.1], [-1.5, .92], [-2.0, .84], [-1.8, .8]],
    extra: (b, P, M) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(.45, .05, 1.9), P); wing.position.set(-2.05, 1.18, 0); wing.rotation.z = .12; b.add(wing);
      [.6, -.6].forEach(z => { const st = new THREE.Mesh(new THREE.BoxGeometry(.06, .34, .05), M.trim); st.position.set(-2.0, 1.0, z); b.add(st); });
      [1, -1].forEach(sd => { const ia = new THREE.Mesh(new THREE.BoxGeometry(.9, .22, .05), M.trim); ia.position.set(-.55, .5, sd * 1.0); b.add(ia); });
      const dif = new THREE.Mesh(new THREE.BoxGeometry(.3, .12, 1.6), M.trim); dif.position.set(-2.2, .24, 0); b.add(dif);
    } },
  suv: { c: '#3E5A46', w: 2.0, r: .45, y0: .45, wheels: [1.5, -1.45], lamp: { y: 1.0, h: .1 }, nose: .94, tail: .97, tumble: .9,
    top: [[2.45, .6], [2.43, 1.0], [2.1, 1.12], [1.3, 1.18], [-2.38, 1.22], [-2.45, 1.0], [-2.44, .6]],
    cabin: [[1.26, 1.16], [.95, 1.6], [.6, 1.84], [-1.0, 1.87], [-2.2, 1.83], [-2.36, 1.4], [-2.33, 1.2]],
    extra: (b, P, M) => {
      [.7, -.7].forEach(z => { const rr = new THREE.Mesh(new THREE.BoxGeometry(2.8, .05, .05), M.trim); rr.position.set(-.7, 1.93, z); b.add(rr); });
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .24, 20), M.tire); sp.rotation.z = Math.PI / 2; sp.position.set(-2.58, .95, 0); b.add(sp);
      [1, -1].forEach(sd => { const cl = new THREE.Mesh(new THREE.BoxGeometry(3.6, .22, .05), M.trim); cl.position.set(0, .56, sd * 1.0); b.add(cl); });
    } },
};
/** A realistic car of a given body style and colour (traffic uses detail=false: no spokes or mirrors). */
export function realCar(kind = 'sedan', color, night = false, detail = false) { return makeCar(color ? { ...SPECS[kind], c: color } : SPECS[kind], night, detail); }
export const CARS = [
  { id: 'classic', label: 'Classic', build: n => makeCar(SPECS.classic, n) },
  { id: 'sedan', label: 'Luxury sedan', build: n => makeCar(SPECS.sedan, n) },
  { id: 'hyper', label: 'Hypercar', build: n => makeCar(SPECS.hyper, n) },
  { id: 'suv', label: 'Off-roader', build: n => makeCar(SPECS.suv, n) },
];
let heroKind = 'classic';
export const setHeroKind = id => { heroKind = CARS.some(c => c.id === id) ? id : 'classic'; return heroKind; };
export function heroCar(night = false, kind = heroKind) { const g = (CARS.find(c => c.id === kind) || CARS[0]).build(night); g.scale.setScalar(1.05); g.userData.hero = true; g.userData.kind = kind; return g; }
// ---------- upgraded traffic vehicles: shared clearcoat paint + chrome-rim wheels, to match the hero cars ----------
/** Static detailed wheel (tyre + chrome rim + hub), facing across z. Traffic doesn't spin wheels. */
function vwheel(x, z, r = .34) {
  const M = carMats(), g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .26, 20), M.tire); t.rotation.x = Math.PI / 2; t.castShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * .6, r * .6, .28, 14), M.chrome); rim.rotation.x = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * .14, r * .14, .3, 8), M.trim); hub.rotation.x = Math.PI / 2;
  g.add(t, rim, hub); g.position.set(x, r, z); return g;
}
/** Indian auto-rickshaw: black shell, yellow canopy, single front wheel. Faces +x. */
export function auto() {
  const b = paint('#17181C'), y = paint('#F4C20D'), M = carMats(), g = grp();
  g.add(mesh(new THREE.BoxGeometry(1.95, .74, 1.4), b, -.12, .62, 0));                       // cabin tub
  const cowl = lathe([[0, 0], [.34, .18], [.46, .5], [.32, .82], [0, .96]], b, 14);
  cowl.rotation.z = -Math.PI / 2; cowl.position.set(.95, .5, 0); g.add(cowl);                 // rounded front
  g.add(mesh(new THREE.BoxGeometry(.9, .62, 1.18), M.glass, .5, 1.02, 0));                    // windscreen
  g.add(mesh(new THREE.BoxGeometry(.5, 1.0, 1.4), b, -1.02, .92, 0));                         // seat back
  g.add(box(2.1, .12, 1.58, y, -.1, 1.68, 0));                                                // canopy roof
  g.add(box(2.12, .1, 1.6, '#D8A400', -.1, 1.52, 0));                                         // roof edge band
  [[.82, .66], [.82, -.66], [-.96, .66], [-.96, -.66]].forEach(([x, z]) => g.add(cyl(.045, .045, .96, M.chrome, x, 1.0, z)));
  const drv = person('#D8C7A0'); drv.position.set(.08, .12, 0); drv.scale.setScalar(.78); g.add(drv);
  g.add(vwheel(.92, 0, .32)); g.add(vwheel(-.86, .6, .32)); g.add(vwheel(-.86, -.6, .32));
  return g;
}
/** City bus (BMTC-style, no logos): painted body, window strip, destination board. Faces +x. */
export function bus(c1, c2, night = false) {
  const body = paint(c1), M = carMats(), g = grp();
  g.add(mesh(new THREE.BoxGeometry(11, 2.5, 2.52), body, 0, 1.75, 0));                         // main body
  g.add(box(11.04, .1, 2.56, c2, 0, 2.5, 0));                                                  // roof cap
  g.add(box(10.4, .92, 2.56, night ? glow('#FFE6B0', .9) : M.glass, 0, 1.9, 0));               // window strip
  g.add(box(11.02, .26, 2.58, c2, 0, 1.2, 0));                                                 // livery belt
  for (let x = -4.4; x <= 4.4; x += 1.6) g.add(box(.08, .9, 2.6, M.trim, x, 1.9, 0));          // window mullions
  g.add(box(.12, 1.0, 2.0, M.glass, 5.5, 1.9, 0));                                             // windscreen
  g.add(box(1.5, .5, .18, night ? glow('#FFD27A', 1.4) : '#2A2A2E', 5.0, 2.3, 0));             // route board
  g.add(vwheel(3.6, 1.14, .55)); g.add(vwheel(3.6, -1.14, .55)); g.add(vwheel(-3.6, 1.14, .55)); g.add(vwheel(-3.6, -1.14, .55));
  return g;
}
/** US pickup truck: cab + glass + open bed. Faces +x. */
export function pickup(c) {
  const body = paint(c), M = carMats(), g = grp();
  g.add(mesh(new THREE.BoxGeometry(5.3, .9, 2.1), body, 0, .85, 0));                            // chassis/hood line
  g.add(mesh(new THREE.BoxGeometry(2.0, .95, 1.98), body, .55, 1.55, 0));                       // cab
  g.add(mesh(new THREE.BoxGeometry(2.05, .62, 1.84), M.glass, .55, 1.62, 0));                   // cab glass
  [[-1.7, .9], [-1.7, -.9], [.6, .9], [.6, -.9]].forEach(([x, z]) => g.add(box(.08, .72, .12, body, x, 1.1, z))); // bed walls (short)
  g.add(box(2.6, .62, 1.98, body, -1.55, .9, 0));                                               // bed sides
  g.add(box(2.4, .06, 1.7, '#3A3A40', -1.55, 1.2, 0));                                          // bed floor
  g.add(box(.12, .34, 1.8, M.trim, 2.62, 1.0, 0));                                              // front grille
  g.add(vwheel(1.7, 1.0, .46)); g.add(vwheel(-1.7, 1.0, .46)); g.add(vwheel(1.7, -1.0, .46)); g.add(vwheel(-1.7, -1.0, .46));
  return g;
}
/** Semi truck: cab + box trailer, chrome tanks. Faces +x. */
export function semi(c = '#B9281F') {
  const cab = paint(c), M = carMats(), g = grp();
  g.add(mesh(new THREE.BoxGeometry(2.6, 2.4, 2.4), cab, 4.5, 1.8, 0));                           // cab
  g.add(mesh(new THREE.BoxGeometry(2.0, 1.0, 2.3), cab, 5.5, 1.3, 0));                           // hood
  g.add(box(1.4, .9, 2.2, M.glass, 4.9, 2.1, 0));                                                // windscreen
  g.add(cyl(.42, .42, 1.6, M.chrome, 3.1, .3, .95)); g.add(cyl(.42, .42, 1.6, M.chrome, 3.1, .3, -.95)); // fuel tanks
  g.add(mesh(new THREE.BoxGeometry(10, 3.0, 2.5), mat('#ECECEC', { metalness: .2, roughness: .5 }), -2.2, 2.2, 0)); // trailer
  g.add(box(10.04, .1, 2.54, '#C8C8C8', -2.2, 3.7, 0));
  [5.0, 3.6, -4.8, -6.2].forEach(x => { g.add(vwheel(x, 1.1, .52)); g.add(vwheel(x, -1.1, .52)); });
  return g;
}
/** Scooter/moped with rider. Faces +x. */
export function bike(c) {
  const body = paint(c), M = carMats(), g = grp();
  g.add(mesh(new THREE.BoxGeometry(1.5, .4, .34), body, 0, .72, 0));                             // step-through frame
  g.add(mesh(new THREE.BoxGeometry(.5, .5, .36), body, .62, .85, 0));                            // front apron
  g.add(box(.5, .2, .36, '#1A1A1E', -.5, .95, 0));                                               // seat
  const stem = cyl(.03, .03, .5, M.chrome, .72, 1.0, 0); stem.rotation.z = -.5; g.add(stem);     // handlebar stem
  g.add(box(.5, .05, .05, M.trim, .9, 1.3, 0));                                                  // handlebar
  const p = person(SKIN[Math.floor(rnd() * SKIN.length)]); p.position.set(-.25, .55, 0); p.scale.setScalar(.8); g.add(p);
  g.add(vwheel(.72, 0, .3)); g.add(vwheel(-.7, 0, .3));
  return g;
}
/** Streetcar / trolley (Boston Green Line-style). Faces +x. */
export function trolley(night = false, c = '#2E7D32') {
  const body = paint(c), M = carMats(), g = grp();
  g.add(mesh(new THREE.BoxGeometry(14, 2.7, 2.6), body, 0, 1.55, 0));                            // car body
  g.add(box(14.04, .14, 2.64, '#D8D2C4', 0, 2.62, 0));                                           // roof
  g.add(box(13.2, .95, 2.64, night ? glow('#FFF0C8', .8) : M.glass, 0, 1.9, 0));                 // windows
  for (let x = -5.6; x <= 5.6; x += 1.4) g.add(box(.08, .95, 2.66, M.trim, x, 1.9, 0));
  g.add(box(.5, .4, .5, M.trim, 0, 2.9, 0));                                                     // pantograph base
  g.add(vwheel(5.4, 1.0, .5)); g.add(vwheel(5.4, -1.0, .5)); g.add(vwheel(-5.4, 1.0, .5)); g.add(vwheel(-5.4, -1.0, .5));
  return g;
}
export function cablecar() { return grp(box(8, 2.6, 2.6, '#B83A2E', 0, .5), box(8.02, 1, 2.62, '#F2E6C8', 0, 1.6), box(8.6, .3, 2.9, '#7A2A20', 0, 3.1)); }
