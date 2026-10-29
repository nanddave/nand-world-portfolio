// Shared 3D toolkit. Everything is procedural (no external models), so the site costs nothing to build or host.
// Conventions: 1 unit ≈ 1 metre. Meshes sit on y=0. Vehicles face +x. Use mat()/glow() for materials (cached).
import * as THREE from 'three';
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
// Selectable hero cars: unbranded silhouettes (side outline extruded across the width), footprint close to the classic car so drive tuning holds.
function shapedCar({ body, glass, w, c, wheels, r, lampY, front, back, extra }, night) {
  const paint = mat(c, { roughness: .32, metalness: .55 }), lamp = (col, n) => n ? glow(col, 2) : col;
  const g = grp(extrude(body, w, paint), extrude(glass, w - .14, mat('#22303C', { roughness: .15, metalness: .6 })));
  wheels.forEach(x => [1, -1].forEach(s => { g.add(wheel(x, s * (w / 2 - .12), r)); const rim = cyl(r * .55, r * .55, .32, mat('#C9CDD2', { metalness: .8, roughness: .3 })); rim.rotation.x = Math.PI / 2; rim.position.set(x, r, s * (w / 2 - .1)); g.add(rim); }));
  [1, -1].forEach(s => { g.add(box(.08, .16, .42, lamp('#FFF6D0', night), front, lampY, s * (w / 2 - .32))); g.add(box(.08, .14, .5, lamp(night ? '#FF3030' : '#B02020', night), back, lampY, s * (w / 2 - .32))); });
  extra?.(g, paint); return g;
}
export const CARS = [
  { id: 'classic', label: 'Classic', build: n => car('#FFC93C', n) },
  { id: 'sedan', label: 'Luxury sedan', build: n => shapedCar({ c: '#1C1F26', w: 1.9, r: .38, lampY: .72, front: 2.6, back: -2.6, wheels: [1.65, -1.6],
    body: [[-2.62, .3], [2.62, .3], [2.66, .62], [2.45, .86], [1.05, .98], [-1.75, .98], [-2.5, .92], [-2.66, .64]],
    glass: [[1.05, .97], [.25, 1.48], [-1.05, 1.5], [-1.78, .97]],
    extra: (g, p) => g.add(box(5.3, .05, 1.94, mat('#B8BEC6', { metalness: .9, roughness: .25 }), 0, .62)) }, n) },
  { id: 'hyper', label: 'Hypercar', build: n => shapedCar({ c: '#FF6A13', w: 2, r: .36, lampY: .58, front: 2.3, back: -2.32, wheels: [1.45, -1.4],
    body: [[-2.32, .22], [2.3, .22], [2.36, .42], [1.3, .7], [.35, 1.02], [-.95, 1.08], [-2.15, .86], [-2.34, .5]],
    glass: [[1.05, .78], [.32, 1.06], [-.7, 1.1], [-.35, .8]],
    extra: (g, p) => { g.add(box(.5, .06, 2.1, p, -2.1, 1.3)); [.7, -.7].forEach(z => g.add(box(.08, .32, .08, '#1E1E24', -2.05, .98, z))); [1, -1].forEach(s => g.add(box(1, .3, .05, '#14161A', -.6, .45, s * 1.01))); } }, n) },
  { id: 'suv', label: 'Off-roader', build: n => shapedCar({ c: '#3E5A46', w: 2, r: .48, lampY: .98, front: 2.42, back: -2.42, wheels: [1.55, -1.5],
    body: [[-2.4, .42], [2.4, .42], [2.45, 1.05], [1.75, 1.22], [-2.4, 1.25]],
    glass: [[1.65, 1.21], [1.05, 1.9], [-2.32, 1.9], [-2.36, 1.24]],
    extra: (g, p) => { g.add(box(3.6, .08, 2.04, p, -.65, 1.9)); g.add(box(3.2, .06, 1.7, '#2A2D33', -.7, 2.02)); const sp = cyl(.42, .42, .2, '#1E1E24', -2.5, .55); sp.rotation.z = Math.PI / 2; g.add(sp); } }, n) },
];
let heroKind = 'classic';
export const setHeroKind = id => { heroKind = CARS.some(c => c.id === id) ? id : 'classic'; return heroKind; };
export function heroCar(night = false, kind = heroKind) { const g = (CARS.find(c => c.id === kind) || CARS[0]).build(night); g.scale.setScalar(1.05); g.userData.hero = true; g.userData.kind = kind; return g; }
export function auto() { return grp(box(2.4, .8, 1.3, '#2E8B3E', 0, .3), box(1.8, .08, 1.36, '#F2C230', -.1, 1.9), box(.1, 1.0, 1.3, '#F2C230', .9, 1.1), cyl(.05, .05, .8, '#222', -.95, 1.1, .6), cyl(.05, .05, .8, '#222', -.95, 1.1, -.6), wheel(.9, 0, .3), wheel(-.8, .55, .3), wheel(-.8, -.55, .3)); }
export function bus(c1, c2, night = false) { return grp(box(11, 2.6, 2.5, c1, 0, .5), box(11.02, .9, 2.52, c2, 0, 1.6), wheel(3.6, 1.1, .55), wheel(-3.6, 1.1, .55), wheel(3.6, -1.1, .55), wheel(-3.6, -1.1, .55), box(10.2, .8, 2.54, night ? glow('#FFE6B0', .9) : '#2D3E50', 0, 1.65)); }
export function pickup(c) { return grp(box(5.4, 1.0, 2.1, c, 0, .5), box(2.2, .9, 2, c, .5, 1.5), box(2.25, .7, 1.9, '#AFC6D6', .5, 1.55), wheel(1.8, 1, .48), wheel(-1.8, 1, .48), wheel(1.8, -1, .48), wheel(-1.8, -1, .48)); }
export function semi() { const g = grp(box(3, 2.6, 2.4, '#C0392B', 4.6, .6), box(10, 3.2, 2.5, '#ECECEC', -2.2, .8)); [5, 3.6, -5, -6.2].forEach(x => { g.add(wheel(x, 1.1, .55)); g.add(wheel(x, -1.1, .55)); }); return g; }
export function bike(c) { const p = person(SKIN[Math.floor(rnd() * SKIN.length)]); p.position.set(-.1, .6, 0); p.scale.setScalar(.8); return grp(box(1.8, .5, .4, c, 0, .5), p, wheel(.7, 0, .32), wheel(-.7, 0, .32)); }
export function trolley(night = false, c = '#2E7D32') { return grp(box(14, 2.9, 2.7, c, 0, .5), box(14.02, 1.0, 2.72, night ? glow('#FFF0C8', .8) : '#1F2A30', 0, 1.7), box(13, .3, 2.2, '#BDBDBD', 0, 3.4)); }
export function cablecar() { return grp(box(8, 2.6, 2.6, '#B83A2E', 0, .5), box(8.02, 1, 2.62, '#F2E6C8', 0, 1.6), box(8.6, .3, 2.9, '#7A2A20', 0, 3.1)); }
