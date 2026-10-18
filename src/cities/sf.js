// San Francisco — golden hour, the fog rolling in.
// Layout (camera looks north, -z): main road along x. North side: Painted Ladies row (west), the startup garage (east),
// a cable-car street climbing to Russian Hill (x≈45) with Lombard's switchbacks on its west face.
// Behind: downtown with the Transamerica Pyramid, Coit Tower on Telegraph Hill, then the bay and the Golden Gate Bridge.
// South side: Alamo-Square-style park slope with the hilltop lookout bench.
import { newCity } from '../kit/city.js';
import { addOSM } from '../kit/osm.js';
import sfOSM from '../data/osm/sf.json';
import { THREE, mat, glow, mesh, box, cyl, cone, ball, lathe, extrude, tube, grp, building, person, SKIN, treeRound, streetLight, car, cablecar, rnd, reseed } from '../kit/kit.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ORANGE = '#C0362C';
/** Triangular prism rising along +x from y=0 (x=0) to y=rise (x=len); width along z (centred). */
const wedge = (len, rise, w, m) => extrude([[0, 0], [len, 0], [len, rise]], w, m);
/** Tilted slab (box rotated about z), centred at x,y,z. */
function slab(len, th, d, m, x, y, z, rz = 0) { const o = mesh(new THREE.BoxGeometry(len, th, d), m, x, y, z); o.rotation.z = rz; return o; }

// ---------- Golden Gate Bridge (bridge-local: axis along x, deck at y=18, water at y=0) ----------
function goldenGate() {
  const red = mat(ORANGE, { fog: false, roughness: .7, emissive: '#7A2414' }), dark = mat('#8E2A22', { fog: false, emissive: '#3A0E08' });
  const S = 150, SIDE = 55, H = 66, DECK = 18, g = grp();
  const ob = y => 8 - 1.8 * y / H, ib = y => 5 - 1.4 * y / H; // outer / inner half-width of the legs
  function towerGeo() {
    const sh = new THREE.Shape();
    const o0 = ob(0), oT = ob(H);
    const pts = [[-o0, 0], [o0, 0], [oT, H - 5], [oT - .5, H - 5], [oT - .5, H - 2], [oT - 1.1, H - 2], [oT - 1.1, H],
      [-oT + 1.1, H], [-oT + 1.1, H - 2], [-oT + .5, H - 2], [-oT + .5, H - 5], [-oT, H - 5]];
    sh.moveTo(...pts[0]); pts.slice(1).forEach(p => sh.lineTo(...p));
    // portal openings with stepped Art-Deco tops
    [[3, 15], [21, 36], [39.5, 50], [53, 60.5]].forEach(([y0, y1]) => {
      const a = ib(y1), p = new THREE.Path(), s = Math.min(1.1, (y1 - y0) * .12);
      const q = [[-a, y0], [a, y0], [a, y1 - 2 * s], [a - s, y1 - 2 * s], [a - s, y1 - s], [a - 2 * s, y1 - s], [a - 2 * s, y1],
        [-a + 2 * s, y1], [-a + 2 * s, y1 - s], [-a + s, y1 - s], [-a + s, y1 - 2 * s], [-a, y1 - 2 * s]];
      p.moveTo(...q[0]); q.slice(1).forEach(v => p.lineTo(...v)); sh.holes.push(p);
    });
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 3.2, bevelEnabled: false }); geo.translate(0, 0, -1.6); return geo;
  }
  const tg = towerGeo();
  [-S / 2, S / 2].forEach(x => {
    const t = mesh(tg, red, x, 0, 0); t.rotation.y = Math.PI / 2; g.add(t);
    g.add(box(6, 4, 19, '#9A8E80', x, -1, 0)); // pier
    [-1, 1].forEach(s => g.add(box(3.6, 1.2, 3.6, dark, x, H - 7, s * 6.6))); // leg collars
  });
  const L = S + 2 * SIDE;
  g.add(box(L, 1.4, 8.6, red, 0, DECK - .2, 0)); // road deck
  g.add(box(L, 2.4, 7.6, dark, 0, DECK - 2.6, 0)); // stiffening truss
  g.add(box(L, .9, .25, red, 0, DECK + 1.2, 4.2)); g.add(box(L, .9, .25, red, 0, DECK + 1.2, -4.2)); // rails
  // approach viaducts + anchorages
  [-1, 1].forEach(s => {
    const ex = s * (L / 2);
    g.add(box(10, DECK + 2, 12, '#B9AE9E', ex + s * 3, 0, 0));
    for (let k = 1; k < 4; k++) g.add(box(2, DECK - 2.2, 2, dark, ex - s * k * 13, 0, 0));
  });
  // main cables: parabolic catenaries over the tower tops
  const cy = x => {
    const ax = Math.abs(x);
    if (ax <= S / 2) return DECK + 2.5 + (H - 1 - DECK - 2.5) * (x / (S / 2)) ** 2;
    const u = (ax - S / 2) / SIDE; return (H - 1) + (DECK + 2 - (H - 1)) * (1 - (1 - u) ** 2) * .98;
  };
  const suspGeos = [];
  [-4.3, 4.3].forEach(z => {
    const pts = []; for (let i = 0; i <= 60; i++) { const x = -L / 2 + 1 + (L - 2) * i / 60; pts.push([x, cy(x), z]); }
    g.add(tube(pts, .5, red, 160));
    for (let x = -L / 2 + 6; x < L / 2 - 4; x += 4.5) {
      if (Math.abs(Math.abs(x) - S / 2) < 2.5) continue;
      const h = cy(x) - DECK - .5; if (h < .6) continue;
      const b = new THREE.BoxGeometry(.14, h, .14); b.translate(x, DECK + .5 + h / 2, z); suspGeos.push(b);
    }
  });
  g.add(mesh(mergeGeometries(suspGeos), red));
  // fog bank hugging the base, drifting along the bridge
  const fogM = new THREE.MeshBasicMaterial({ color: '#F8E6D8', transparent: true, opacity: .42, fog: false, depthWrite: false });
  const fogs = [];
  for (let i = 0; i < 16; i++) {
    const f = ball(9 + rnd() * 7, fogM, -L / 2 - 30 + i * 22, 6 + rnd() * 9, (rnd() - .5) * 40, 1);
    f.scale.set(2.1, .45, 1.1); f.castShadow = f.receiveShadow = false; f.userData.v = 1.2 + rnd() * 1.4; g.add(f); fogs.push(f);
  }
  g.userData.tick = (t, dt) => fogs.forEach((f, i) => { f.position.x += f.userData.v * dt; f.position.y += Math.sin(t * .3 + i) * .004; if (f.position.x > L / 2 + 50) f.position.x = -L / 2 - 50; });
  return g;
}

// ---------- Painted Lady (Victorian, facade faces +z, base at y=0) ----------
function lady(col, accent, roof = '#6E5A5A') {
  const g = grp(), W = 6, H = 8.4, G = 4.6, D = 11, F = 1.6; // F = garden-level foundation
  const trim = mat('#FFFFFF'), glass = mat('#3E4E62', { roughness: .3 }), zf = D / 2;
  g.add(box(W, F, D, '#E9E1D2'));
  const body = extrude([[-W / 2, 0], [W / 2, 0], [W / 2, H], [0, H + G], [-W / 2, H]], D, col); body.position.y = F; g.add(body);
  const ang = Math.atan2(G, W / 2), sl = Math.hypot(W / 2, G) + .5;
  [-1, 1].forEach(s => {
    g.add(slab(sl, .3, D + .5, roof, s * W / 4, F + H + G / 2 + .12, 0, -s * ang));
    g.add(slab(sl - .3, .32, .2, trim, s * W / 4, F + H + G / 2 - .1, zf + .3, -s * ang)); // gable trim
  });
  g.add(box(W + .5, .45, .7, trim, 0, F + H - .2, zf - .1)); // cornice
  g.add(box(W + .3, .25, .5, accent, 0, F + H * .52, zf)); // belt course
  g.add(box(1.1, 1.3, .2, glass, 0, F + H + 1.2, zf + .05)); g.add(box(1.4, .2, .3, trim, 0, F + H + 2.6, zf + .1)); // gable window
  // bay window: centre + angled sides, two storeys
  const bx = -1.1, bw = 2.4, bh = H * .82;
  g.add(box(bw, bh, 1.1, col, bx, F + .2, zf + .55));
  [-1, 1].forEach(s => { const sd = box(1.05, bh, .2, col, bx + s * (bw / 2 + .3), F + .2, zf + .5); sd.rotation.y = -s * .75; g.add(sd); });
  [.9, H * .52 + .5].forEach(y => { g.add(box(bw - .5, 2.2, .1, glass, bx, F + y, zf + 1.12)); g.add(box(bw + .1, .2, .25, trim, bx, F + y + 2.3, zf + 1.12)); g.add(box(bw + .1, .2, .25, trim, bx, F + y - .2, zf + 1.12)); });
  g.add(box(bw + .4, .3, 1.5, trim, bx, F + .2 + bh, zf + .6));
  // door + upper window + stoop
  g.add(box(1.1, 2.3, .15, accent, 1.9, F, zf + .05)); g.add(box(1.5, .25, .3, trim, 1.9, F + 2.3, zf + .1));
  g.add(box(1, 1.9, .1, glass, 1.9, F + H * .52 + .7, zf + .05)); g.add(box(1.3, .22, .25, trim, 1.9, F + H * .52 + 2.65, zf + .1));
  for (let k = 0; k < 4; k++) g.add(box(1.4, F - k * .4, .45, '#E4DBCB', 1.9, 0, zf + .3 + (3 - k) * .45));
  return g;
}

// ---------- Coit Tower ----------
function coitTower() {
  const c = mat('#EFE4CF', { fog: false }), sh = mat('#D9CBB2', { fog: false }), g = grp();
  const R = 3.1, H = 21;
  g.add(cyl(R, R + .15, H, c, 0, 0, 0, 16));
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.add(box(.55, H, .55, sh, Math.cos(a) * R, 0, Math.sin(a) * R)); }
  g.add(cyl(R + .45, R + .45, 1.2, c, 0, H, 0, 16));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const w = box(.7, 1.6, .3, mat('#5E5248', { fog: false }), Math.cos(a) * (R + .3), H + 1.3, Math.sin(a) * (R + .3)); w.rotation.y = -a + Math.PI / 2; g.add(w); }
  g.add(cyl(R + .1, R + .3, 2.6, c, 0, H + 1.2, 0, 16)); g.add(cyl(R - .6, R + .1, .9, sh, 0, H + 3.8, 0, 16));
  g.add(box(9, 1.6, 9, c, 0, 0, 0)); // base terrace
  return g;
}

// ---------- Transamerica Pyramid ----------
function transamerica() {
  const w = mat('#F1ECE2', { fog: false }), g = grp(), R = 7.2, H = 78;
  const p = cone(R, H, w, 0, 0, 0, 4); p.rotation.y = Math.PI / 4; g.add(p);
  const half = y => R / Math.SQRT2 * (1 - y / H);
  [-1, 1].forEach(s => { const y0 = 36, y1 = 58; const wing = box(1.6, y1 - y0, 3.6, w, s * (half(y1) + .6), y0, 0); g.add(wing); g.add(cone(.8, 3, w, s * (half(y1) + .6), y1, 0, 4)); });
  g.add(cyl(.12, .35, 14, w, 0, H - 4)); g.add(box(R * 1.6, 3, R * 1.6, mat('#D6CFC2', { fog: false })));
  return g;
}

export function build() {
  reseed(415);
  const C = newCity({ top: '#5877B4', hor: '#F9B57E', bot: '#9C7A6A', fog: '#EFCDB2', fn: 70, ff: 330, sun: '#FFC08A', si: 1.35, sunPos: [-70, 18, 14], sunGlow: '#D9773F', hs: '#BFCBE8', hg: '#7A5A44', hi: .62, ground: '#BDB088', yaw: .05 });
  C.pitch = .2; C.dist = 76;

  // ---- the bay + Marin headlands ----
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(900, 260), mat('#4F86A6', { flatShading: false, roughness: .18, metalness: .25 }));
  bay.rotation.x = -Math.PI / 2; bay.position.set(0, .06, -300); bay.receiveShadow = true; C.add(bay);
  const bay2 = new THREE.Mesh(new THREE.PlaneGeometry(130, 120), bay.material); bay2.rotation.x = -Math.PI / 2; bay2.position.set(-150, .06, -110); C.add(bay2);
  [[-250, -330, 70, 30, '#8E8C6C'], [-150, -320, 60, 26, '#9A936F'], [-60, -345, 70, 34, '#8E8C6C'], [40, -360, 90, 28, '#A29A78'], [160, -380, 80, 22, '#A8A07E']].forEach(([x, z, r, h, c]) => {
    const m = mesh(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c, { fog: false })); m.scale.y = h / r; m.position.set(x, 0, z); C.add(m);
  });
  // Alcatraz
  C.add(grp(box(16, 4, 9, mat('#9A8F7E', { fog: false })), box(9, 3, 5, mat('#E6DED0', { fog: false }), 1, 4), cyl(.5, .7, 7, mat('#F2EDE4', { fog: false }), -5, 4)), 75, -230);

  // ---- Golden Gate Bridge ----
  const gg = goldenGate(); C.add(gg, -55, -215, .2); C.tick.push(gg.userData.tick);

  // sailboats
  const boats = [];
  for (let i = 0; i < 5; i++) {
    const b = grp(box(5, .8, 1.6, '#F4F1EA'), extrude([[0, 0], [3.4, 0], [0, 7]], .1, mat('#FFFFFF', { side: THREE.DoubleSide })));
    b.children[1].position.set(-1.5, .8, 0); b.position.set(-200 + i * 85, 0, -175 - rnd() * 60); b.rotation.y = rnd() * .4; C.add(b); boats.push(b);
  }
  C.tick.push((t, dt) => boats.forEach((b, i) => { b.position.x += (2 + i * .3) * dt; if (b.position.x > 220) b.position.x = -220; b.rotation.z = Math.sin(t + i) * .05; }));

  // ---- downtown + Transamerica + Coit Tower ----
  [[6, -132, 11, 11, 28, '#D8D2C6'], [20, -152, 12, 12, 38, '#C9C4BC'], [58, -140, 13, 12, 44, '#B9C3CC'], [72, -158, 14, 14, 34, '#D2CABD'],
    [46, -170, 12, 12, 52, '#AEB8C2'], [-6, -150, 10, 10, 22, '#E0D6C6'], [88, -136, 10, 10, 26, '#C8BFB0'], [32, -178, 10, 10, 30, '#BFC6CC']].forEach(([x, z, w, d, h, c], i) =>
    C.add(building(w, h, d, c, i % 3 === 1 ? 'glass' : 'office', false, '#8A8278'), x, z));
  C.add(transamerica(), 36, -138);
  const tele = lathe([[30, 0], [26, 6], [18, 14], [9, 19], [0, 20]], mat('#7E8A56', { fog: false }), 20); tele.position.set(100, 0, -112); C.add(tele);
  C.add(coitTower(), 100, -112).position.y = 19.6;
  for (let i = 0; i < 9; i++) { const a = i * .7; C.add(treeRound('#5E7A45', 1.4), 100 + Math.cos(a) * 15, -112 + Math.sin(a) * 15).position.y = 13; }

  // ---- Russian Hill: cable-car street + plateau + Lombard switchbacks ----
  const HL = 56, HR = 18, ang = Math.atan2(HR, HL), SL = Math.hypot(HL, HR);
  const st = grp(); st.rotation.y = Math.PI / 2; st.position.set(45, 0, -8); C.add(st); // local +x -> world -z, local z -> world +x
  st.add(wedge(HL, HR, 10, '#5A5A60'));
  [-1, 1].forEach(s => { const f = wedge(HL, HR, 15, '#BCA77C'); f.position.z = s * 12.5; st.add(f); });
  st.add(box(44, HR, 50, '#B6A47C', HL + 22, 0, 0)); // hilltop plateau
  const surf = grp(); surf.rotation.z = ang; st.add(surf);
  [-.75, .75].forEach(z => surf.add(box(SL, .08, .1, '#9A9AA0', SL / 2, .02, z)));
  surf.add(box(SL, .05, .12, '#2B2B2E', SL / 2, .02, 0));
  for (let u = 4; u < SL; u += 10) surf.add(box(.2, .06, 9.6, '#EDEDED', u, .02, 0));
  // houses stepping up both sides
  const hc = ['#F2E4C8', '#D9E6EE', '#F3D3C2', '#E6E0F0', '#E9F0D8', '#F6E7B8', '#DCD3C4', '#F0CFCF'];
  for (let k = 0; k < 7; k++) [-1, 1].forEach(s => {
    const u = 4 + k * 7.6, y0 = Math.max(0, (u - 3.6) * HR / HL), h = 8 + 7.2 * HR / HL + (k + (s > 0 ? 1 : 0)) % 3 * 2.2;
    const b = building(7.2, h, 9, hc[(k * 2 + (s > 0 ? 1 : 0)) % hc.length], 'res', false, '#7A6A5A'); b.position.set(u, y0 + h / 2, s * 9.6); st.add(b);
    st.add(box(7.4, .5, 9.4, '#FFFFFF', u, y0 + h, s * 9.6));
  });
  // cable car (ping-pongs up and down the hill)
  const cc = grp(cablecar());
  cc.add(box(8.4, .2, 3.3, '#5A3A2A', 0, .9)); cc.add(box(.2, 3.6, 3.3, '#3A2A20', -3.8, 1.2)); cc.add(box(8, .08, .08, '#D9B24C', 0, 2.1, 1.32));
  [[-2.4, 1.6], [1.2, 1.6], [2.8, -1.6]].forEach(([x, z]) => { const p = person(SKIN[Math.floor(rnd() * SKIN.length)]); p.position.set(x, 1, z); p.scale.setScalar(.85); cc.add(p); });
  [-2.5, 2.5].forEach(x => cc.add(box(1.4, .5, 2, '#222', x, 0)));
  surf.add(cc);
  C.tick.push(t => { cc.position.x = 6 + (SL - 12) * (.5 - .5 * Math.cos(t * .11)); });
  // plateau rooftops (east side so the bridge stays visible)
  [[64, 8, 10], [72, -12, 8], [80, 8, 12], [88, -8, 9], [94, 14, 7]].forEach(([u, z, h], i) => { const b = building(8, h, 9, hc[i + 1], 'res', false, '#7A6A5A'); b.position.set(u, HR + h / 2, z); st.add(b); });
  for (let i = 0; i < 6; i++) { const t = treeRound('#6B8A4A', 1.1); t.position.set(HL + 6 + i * 7, HR, -18 + (i % 2) * 4); st.add(t); }
  // Lombard Street on the plateau's west face
  const LL = 28, LS = Math.hypot(LL, HR), la = Math.atan2(HR, LL);
  C.add(wedge(LL, HR, 32, '#7F9A55'), -6, -82); // garden slope (local +x = world +x)
  const lg = grp(); lg.rotation.z = la; lg.position.set(-6, 0, -82); C.add(lg);
  const zz = []; for (let i = 0; i <= 8; i++) zz.push([1.5 + i * (LS - 3) / 8, i % 2 ? 9 : -9]);
  zz.forEach((p, i) => {
    if (i < zz.length - 1) { const q = zz[i + 1], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz); const r = box(len + 2.4, .12, 3, '#8A4A3A', (p[0] + q[0]) / 2, .04, (p[1] + q[1]) / 2); r.rotation.y = -Math.atan2(dz, dx); lg.add(r); }
    lg.add(cyl(1.5, 1.5, .13, '#8A4A3A', p[0], .04, p[1], 10));
    if (i > 0 && i < zz.length - 1) { const hz = -p[1] * .45; lg.add(box(1.4, .9, 7, '#3E6B35', p[0], 0, hz)); for (let f = -2; f <= 2; f++) lg.add(ball(.45, f % 2 ? '#E35D8A' : '#F2A1C0', p[0] + .6, .9, hz + f * 1.4, 0)); }
  });
  [-1, 1].forEach(s => lg.add(box(LS, .5, 1, '#C9C1B2', LS / 2, 0, s * 15)));
  C.add(box(10, .1, 32, '#5A5A60', -11, 0, -82)); // street at the foot

  // ---- main street ----
  C.road(0, 0, 220, 10, 0, { color: '#4A4A50', walk: 2.6, walkColor: '#C4BAA8' });
  for (let x = -90; x <= 90; x += 22) { C.add(streetLight(), x, 8.3); C.add(streetLight(), x + 11, -8.3, Math.PI); }
  C.lane(() => car(['#ECF0F1', '#B03A2E', '#34495E', '#7FA8C9', '#2F4F3E'][Math.floor(rnd() * 5)]), 2.1, 1, 9, 4, 210);
  C.lane(() => car(['#D5D8DC', '#1B2631', '#C9A86A'][Math.floor(rnd() * 3)]), -2.1, -1, 9, 3, 210);

  // ---- Painted Ladies (north side, stepping up the hill to the west) ----
  const lad = [['#F2B5C4', '#7A4A9A'], ['#A9D9C8', '#C0563A'], ['#F5D98A', '#3E6E8E'], ['#B9C4F0', '#C7843A'], ['#F7C29A', '#4A7A4A'], ['#CFE5A9', '#8A3A5A'], ['#D9BCE8', '#2E6A6A']];
  lad.forEach(([c, a], i) => { const h = lady(c, a); h.position.set(-47 + i * 6.3, (6 - i) * .55, -15); C.add(h); C.add(box(6.3, (6 - i) * .55, 12, '#D9D0C0', -47 + i * 6.3, 0, -15)); });
  C.add(box(46, .25, 2.4, '#CFC6B6', -28, 0, -7.6));
  // generic row houses beyond the ladies
  [[-62, '#E8D9C4'], [-70, '#D6E2E8'], [-78, '#F0D4C0']].forEach(([x, c]) => C.add(grp(building(7.5, 12, 11, c, 'res', false, '#6E5A50'), box(7.8, .5, 11.4, '#FFFFFF', 0, 12)), x, -15));

  // back blocks filling the slope between the ladies and Russian Hill (kept low so the bridge stays visible)
  for (let x = -66; x <= 22; x += 8.5) [-34, -47].forEach((z, j) => {
    if (x > 8 && j === 0) return; const h = 6 + ((x * 3 + j * 5) % 4 + 4) % 4 * 1.2, c = hc[Math.abs(Math.round(x + j * 3)) % hc.length];
    C.add(grp(building(7.8, h, 10, c, 'res', false, '#6E5A50'), box(8.1, .4, 10.3, '#FFFFFF', 0, h)), x, z);
  });
  // ---- the startup garage (Oaklet) ----
  const gar = grp(), GW = 9, GH = 5, GD = 9, wall = '#F1ECE2';
  gar.add(box(GW, .12, GD, '#8C857A'));
  gar.add(box(GW, GH, .3, wall, 0, 0, -GD / 2)); [-1, 1].forEach(s => gar.add(box(.3, GH, GD, wall, s * GW / 2, 0, 0)));
  gar.add(box(GW, 1.1, .3, wall, 0, GH - 1.1, GD / 2)); [-1, 1].forEach(s => gar.add(box(1.1, GH - 1.1, .3, wall, s * (GW / 2 - .55), 0, GD / 2)));
  gar.add(box(6.8, .45, .5, '#B8B2A6', 0, GH - 1.45, GD / 2 - .3)); // rolled-up door
  const groof = extrude([[-GW / 2 - .5, 0], [GW / 2 + .5, 0], [0, 2.6]], GD + 1, '#6E5A50'); groof.position.y = GH; gar.add(groof);
  gar.add(box(4.5, .08, .4, glow('#FFE2A8', 1.6), 0, GH - .25, 0));
  const lamp = new THREE.PointLight('#FFB868', 30, 16, 1.6); lamp.position.set(0, 3.8, .5); gar.add(lamp);
  gar.add(box(3.2, .12, 1.3, '#9A6A44', -.6, .9, -2.6)); [[-2, -3], [.8, -3], [-2, -2.1], [.8, -2.1]].forEach(([x, z]) => gar.add(box(.1, .9, .1, '#3A3A40', x, 0, z)));
  gar.add(box(.8, .04, .55, '#C8CCD2', -1.2, 1.02, -2.5)); const scr = box(.8, .52, .04, glow('#8FD0FF', 1.8), -1.2, 1.04, -2.78); scr.rotation.x = -.2; gar.add(scr);
  gar.add(box(.7, .04, .5, '#C8CCD2', .4, 1.02, -2.5)); const scr2 = box(.7, .48, .04, glow('#B6F0C8', 1.5), .4, 1.04, -2.76); scr2.rotation.x = -.2; gar.add(scr2);
  const coder = person('#3A86FF'); coder.position.set(-1.2, 0, -1.4); coder.rotation.y = Math.PI; gar.add(coder); gar.add(box(.8, .6, .8, '#2E2E36', -1.2, 0, -1.3));
  gar.add(box(3.4, 1.8, .06, '#FAFAF7', 1.6, 1.6, -4.3));
  [['#FFD95A', .5], ['#FF8FA3', .9], ['#8FD3FF', 1.3], ['#B6F0A0', 1.9], ['#FFD95A', 2.4]].forEach(([c, x], i) => gar.add(box(.35, .35, .04, c, x, 2.5 - (i % 2) * .6, -4.25)));
  gar.add(box(.6, 2.6, 2, '#7A5A3A', 4, 0, 1)); gar.add(box(1, .8, 1, '#C9A06A', 3.6, 0, 3)); gar.add(box(.8, .6, .8, '#B88A50', 3.7, .8, 3.1));
  C.add(gar, 18, -13);
  C.add(grp(building(10, 9, 10, '#E6D3B8', 'res', false, '#6E5A50'), box(10.4, .5, 10.4, '#FFFFFF', 0, 9)), 29, -14);
  C.add(box(9, .1, 4, '#9A948A', 18, 0, -6.6)); // driveway
  C.hero(9, -4, 0);

  // ---- Alamo-Square-style park (south side) with the lookout ----
  const PL = 30, PR = 8;
  const park = extrude([[0, 0], [PL + 9, 0], [PL + 1, PR], [PL - 3, PR]], 46, '#78A04A'); park.rotation.y = -Math.PI / 2; park.position.set(-29, 0, 8); C.add(park);
  const ph = z => z < 8 ? 0 : z < 8 + PL - 3 ? (z - 8) / (PL - 3) * PR : PR;
  const pathAng = Math.atan2(PR, PL - 3);
  const path = slab(Math.hypot(PL - 3, PR) + .5, .1, 2, '#D8CDB6', -24, PR / 2 + .06, 8 + (PL - 3) / 2, 0); path.rotation.set(0, Math.PI / 2, pathAng, 'YXZ'); C.add(path);
  [[-46, 14], [-40, 22], [-48, 28], [-12, 13], [-8, 24], [-16, 30], [-36, 31], [-44, 17], [-14, 19]].forEach(([x, z], i) => C.add(treeRound(i % 2 ? '#5E8C3E' : '#6E9A48', 1 + rnd() * .3), x, z).position.y = ph(z) - .2);
  const bench = grp(box(3, .12, .8, '#7A5434', 0, .55), box(3, .7, .12, '#7A5434', 0, .7, -.35), box(.12, .55, .7, '#2B2B30', -1.3), box(.12, .55, .7, '#2B2B30', 1.3));
  C.add(bench, -30, 33).position.y = PR; bench.rotation.y = Math.PI;
  C.add(grp(cyl(.06, .08, 3.6, '#2B2B30'), ball(.3, '#F6E6C0', 0, 3.7, 0, 1)), -27, 33).position.y = PR;
  [[-31, 32.4, Math.PI], [-25, 31, 2.6], [-20, 20, .6], [-38, 15, 2], [-34, 25, -1]].forEach(([x, z, r]) => C.add(person(SKIN[Math.floor(rnd() * SKIN.length)]), x, z, r).position.y = ph(z));
  // near-side row (east of the park)
  [[50, '#E7D7C2'], [58, '#C9DCE6'], [66, '#F2D6BE'], [74, '#E0E6CF']].forEach(([x, c]) =>
    C.add(grp(building(7.6, 8, 10, c, 'res', false, '#6E5A50'), box(7.9, .45, 10.4, '#FFFFFF', 0, 8)), x, 15));
  [[4, 27, '#EADBC6'], [12, 27, '#D3E0E8'], [20, 27, '#F1D9C4'], [28, 27, '#E4E8D2'], [36, 27, '#EED8DE']].forEach(([x, z, c]) => C.add(grp(building(7.6, 7, 9, c, 'res', false, '#6E5A50'), box(7.9, .4, 9.4, '#FFFFFF', 0, 7)), x, z, Math.PI));
  [[6, 16], [14, 20], [24, 15], [34, 19]].forEach(([x, z]) => C.add(treeRound('#5E7F45', 1.1), x, z));

  hillFlare(C, -30, PR, 33);

  C.crowd([[14, -8.4, 0], [22, -7.8, 2.2], [-20, -7.2, 1.2], [-10, -7.4, 3], [40, 8, 4], [5, 7.6, 1], [50, -7.5, 2]]);
  C.particles('dust', 220);

  C.spot(18, 5.5, -11);
  C.spot(-30, PR + 2.5, 33);
  addOSM(C, sfOSM, {
    handRoads: [{ z: 0, half: 8, halfX: 115 }],
    clearBoxes: [{ minX: -54, maxX: -2, minZ: -24, maxZ: -6 },       // Painted Ladies row (the real 710-722 Steiner footprints land here)
      { minX: -400, maxX: 400, minZ: -600, maxZ: -170 },              // the bay
      { minX: -218, maxX: -82, minZ: -172, maxZ: -48 }],              // hand-made inlet
  });
  C.credit = 'Streets & buildings: © OpenStreetMap contributors';
  return C;
}

// ===== World reaction: 'goal:planned' — a flare of light rises from the hill viewpoint (rings + beam + sparks) =====
function hillFlare(C, x, y, z) {
  const m = glow('#FFD27A', 3.2); m.transparent = true;
  const g = grp(); g.position.set(x, y, z); g.visible = false; C.add(g);
  const core = ball(1, m, 0, 3, 0, 2); core.castShadow = false; g.add(core);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, 1.6, 40, 16, 1, true), m); beam.position.y = 20; beam.castShadow = false; g.add(beam);
  const rings = [0, 1].map(() => { const r = new THREE.Mesh(new THREE.TorusGeometry(1, .08, 6, 40), m); r.rotation.x = Math.PI / 2; r.castShadow = false; g.add(r); return r; });
  const sparks = []; for (let i = 0; i < 18; i++) { const b = ball(.18, m, 0, 0, 0, 0); b.castShadow = false; b.userData.a = i * 2.4; b.userData.v = 3 + (i % 5); g.add(b); sparks.push(b); }
  let cancel = null;
  C.on('goal:planned', () => {
    if (cancel) cancel();
    g.visible = true;
    cancel = C.anim(3.6, (p, el) => {
      const fade = p < .15 ? p / .15 : Math.max(0, 1 - (p - .15) / .85);
      m.opacity = fade; core.scale.setScalar(.8 + Math.sin(el * 9) * .2 + p * 2.5); core.position.y = 3 + p * 6;
      beam.scale.set(1 + p * 1.5, 1, 1 + p * 1.5);
      rings.forEach((r, i) => { const q = Math.max(0, (el - i * .8) / 2.2); r.visible = q > 0 && q < 1; r.scale.setScalar(1 + q * 14); r.position.y = 1 + q * 5; });
      sparks.forEach(b => { const k = Math.min(1, el / 3); b.position.set(Math.cos(b.userData.a + el) * (1 + k * 6), 2 + b.userData.v * el * .9, Math.sin(b.userData.a + el) * (1 + k * 6)); });
    }, () => { g.visible = false; cancel = null; });
  });
}
