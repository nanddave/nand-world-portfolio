// Irving — a hot, bright Texas afternoon.
// Layout: Las Colinas Blvd along x (z≈12). North: Williams Square — granite plaza with the Mustangs of Las Colinas
// galloping through a long fountain — ringed by glass towers, the generic "7-Eleven" office west of it, an elevated DART
// line and the canal behind. South: convenience store + fuel canopy on the frontage road, then a 6-lane highway with a
// flyover interchange. Far east: Reunion Tower on the Dallas skyline. Water tower "IRVING" to the east.
import { newCity } from '../kit/city.js';
import { THREE, mat, glow, mesh, box, cyl, cone, ball, lathe, extrude, grp, building, sign, person, SKIN, car, pickup, semi, streetLight, rnd, reseed } from '../kit/kit.js';

const BRONZE = mat('#7B5531', { metalness: .6, roughness: .4 });
const BRONZE_D = mat('#5A3C22', { metalness: .6, roughness: .45 });

// ---------- a stylised galloping mustang (faces +x, hooves near y=0) ----------
function leg(x, y, z, a1, a2) {
  const top = grp(); top.position.set(x, y, z); top.rotation.z = a1;
  top.add(cyl(.12, .16, .78, BRONZE, 0, -.78, 0, 6));
  const knee = grp(); knee.position.y = -.74; knee.rotation.z = a2; top.add(knee);
  knee.add(cyl(.065, .09, .72, BRONZE, 0, -.72, 0, 6)); knee.add(cyl(.1, .12, .16, BRONZE_D, 0, -.86, 0, 6));
  return top;
}
const POSES = [
  { fl: [1.0, -.25], fr: [.65, -.1], hl: [-.95, .35], hr: [-.6, .25], pitch: 0, neck: -.75, head: -1.5, tail: 1.25 },   // full stretch
  { fl: [.35, -1.7], fr: [-.15, -.9], hl: [.45, .45], hr: [.7, .3], pitch: .08, neck: -.6, head: -1.65, tail: 1.5 },    // gathered
  { fl: [.9, -1.9], fr: [.55, -1.5], hl: [.25, .2], hr: [-.05, .3], pitch: .38, neck: -.35, head: -1.9, tail: 1.9 },    // rearing
  { fl: [-.3, -.45], fr: [.25, -1.3], hl: [-1.05, .3], hr: [-.5, .1], pitch: -.05, neck: -.85, head: -1.4, tail: 1.1 },  // pushing off
];
function mustang(pose) {
  const P = POSES[pose % POSES.length], h = grp(), body = grp(); h.add(body);
  body.position.y = 1.55; body.rotation.z = P.pitch;
  const torso = mesh(new THREE.CylinderGeometry(.46, .5, 1.5, 10), BRONZE); torso.rotation.z = Math.PI / 2; body.add(torso);
  body.add(ball(.52, BRONZE, .72, .02, 0, 1)); body.add(ball(.54, BRONZE, -.74, .06, 0, 1));
  body.children[1].scale.set(1, 1, .9); body.children[2].scale.set(1, 1, .92);
  const neck = grp(); neck.position.set(.9, .2, 0); neck.rotation.z = P.neck; body.add(neck);
  neck.add(cyl(.2, .34, 1.15, BRONZE, 0, 0, 0, 8));
  const mane = box(.12, 1.05, .1, BRONZE_D, -.22, .1, 0); mane.rotation.z = .12; neck.add(mane);
  const head = grp(); head.position.y = 1.08; head.rotation.z = P.head; neck.add(head);
  head.add(cyl(.11, .2, .82, BRONZE, 0, 0, 0, 7)); head.add(ball(.13, BRONZE_D, 0, .82, 0, 0));
  [-.09, .09].forEach(z => { const e = cone(.06, .22, BRONZE_D, -.12, -.02, z, 4); e.rotation.z = 2.4; head.add(e); });
  const tail = grp(); tail.position.set(-1.18, .25, 0); tail.rotation.z = P.tail; body.add(tail);
  tail.add(cyl(.05, .17, 1.15, BRONZE_D, 0, 0, 0, 6));
  body.add(leg(.68, -.2, .2, ...P.fl)); body.add(leg(.68, -.2, -.2, ...P.fr));
  body.add(leg(-.72, -.15, .22, ...P.hl)); body.add(leg(-.72, -.15, -.22, ...P.hr));
  // settle the lowest hoof just into the water
  h.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(h); body.position.y += .18 - bb.min.y;
  h.scale.setScalar(1.7); return h;
}

// ---------- Texas live oak: short trunk, wide low canopy ----------
function liveOak(s = 1) {
  const g = grp(cyl(.35, .55, 2.2, '#5A4632', 0, 0, 0, 7)), c = ['#55703A', '#617D40', '#4D6634'];
  [[0, 3.3, 0, 2.6], [1.9, 2.9, .6, 1.9], [-1.8, 3, -.5, 2], [.4, 3, -1.8, 1.7], [-.5, 2.9, 1.8, 1.8]].forEach(([x, y, z, r], i) => { const b = ball(r, c[i % 3], x, y, z, 1); b.scale.y = .55; g.add(b); });
  [[.9, .5], [-.8, -.6]].forEach(([dx, rz]) => { const br = cyl(.12, .2, 2, '#5A4632', dx * .3, 1.6, 0, 5); br.rotation.z = rz; g.add(br); });
  g.scale.setScalar(s); return g;
}

// ---------- DART light-rail car set (faces +x) ----------
function dartTrain() {
  const g = grp(), Lc = 13;
  for (let i = 0; i < 3; i++) {
    const x = -i * (Lc + .6);
    g.add(box(Lc, 2.9, 2.7, '#F4F2EC', x, .7)); g.add(box(Lc + .02, .5, 2.72, '#F2C230', x, .95));
    g.add(box(Lc - 1.2, .9, 2.74, '#26323C', x, 2)); g.add(box(Lc - 2, .25, 2.2, '#9AA0A6', x, 3.6));
    [-4, 4].forEach(o => g.add(box(2.2, .6, 2, '#2A2A2E', x + o, .1)));
  }
  const nose = extrude([[0, 0], [1.6, .3], [1.6, 2.2], [0, 2.9]], 2.6, '#F2C230'); nose.position.set(Lc / 2, .7, 0); g.add(nose);
  g.add(box(.08, .7, 2.2, '#26323C', Lc / 2 + 1.56, 2.1)); // windscreen
  const pan = box(1.6, .08, .08, '#333', -2, 4.7); g.add(pan); g.add(box(.08, 1, .08, '#333', -2, 3.8));
  return g;
}

// ---------- Reunion Tower (Dallas): three outer shafts around a core, geodesic lit ball ----------
function reunionTower() {
  const c = mat('#D9D4CA', { fog: false }), g = grp(), H = 50;
  g.add(cyl(1.6, 1.8, H, c, 0, 0, 0, 10));
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; g.add(cyl(.9, 1, H - 2, c, Math.cos(a) * 2.3, 0, Math.sin(a) * 2.3, 8)); }
  g.add(cyl(4, 2.6, 2, c, 0, H - 2.5, 0, 12));
  const R = 7.2, by = H + R - 1.5;
  g.add(ball(R, mat('#5C6470', { fog: false, metalness: .3, roughness: .5 }), 0, by, 0, 2));
  const grid = new THREE.Mesh(new THREE.IcosahedronGeometry(R + .08, 2), new THREE.MeshBasicMaterial({ color: '#FFF1C8', wireframe: true, fog: false, transparent: true, opacity: .85 }));
  grid.position.y = by; g.add(grid);
  const pts = new THREE.Points(new THREE.IcosahedronGeometry(R + .15, 2), new THREE.PointsMaterial({ color: '#FFF6DA', size: .9, fog: false }));
  pts.position.y = by; g.add(pts);
  g.add(cyl(.2, .4, 6, c, 0, by + R - .5, 0, 6));
  return g;
}

export function build() {
  reseed(214);
  const C = newCity({ top: '#5E9FDC', hor: '#EAF0EE', bot: '#B8A06E', fog: '#E6E2D2', fn: 90, ff: 300, sun: '#FFF4DC', si: 1.7, sunPos: [25, 85, 30], hs: '#CFE3F6', hg: '#9C8A5E', hi: .75, ground: '#C9B57E', yaw: -.32 });
  C.pitch = .24; C.dist = 80;

  // ---------- roads ----------
  C.road(0, 12, 240, 12, 0, { color: '#5A5C62', walk: 3, walkColor: '#D9D2C2' });
  C.road(0, 52, 240, 7, 0, { color: '#606268', dash: false });
  const HZ = 70; // highway centre
  [-1, 1].forEach(s => C.road(0, HZ + s * 7, 240, 12, 0, { color: '#55575E', dashZ: 2 }).children.forEach((c, i) => { if (i > 0 && i % 2) c.position.z = -2; }));
  C.add(box(240, .9, .6, '#CFCAC0', 0, 0, HZ)); // median barrier
  [-1, 1].forEach(s => C.add(box(240, .1, .25, '#F2F2F2', 0, .04, HZ + s * 12.6)));
  // flyover interchange: straight bridge across the highway + a curved connector ramp
  const fly = grp(), FY = 9;
  fly.add(box(11, 1.2, 70, '#B9B4AA', 0, FY - 1.2, 0)); fly.add(box(.4, 1, 70, '#D6D1C6', 5.3, FY, 0)); fly.add(box(.4, 1, 70, '#D6D1C6', -5.3, FY, 0));
  for (let z = -30; z <= 30; z += 15) { fly.add(cyl(.9, 1.1, FY - 1.2, '#C9C4BA', 0, 0, z, 10)); fly.add(box(9, 1, 2, '#C9C4BA', 0, FY - 2.2, z)); }
  C.add(fly, 78, HZ);
  const RC = [78 + 34, HZ + 35], RR = 34;
  for (let i = 0; i < 16; i++) {
    const th = Math.PI + (i + .5) / 16 * Math.PI / 2, x = RC[0] + Math.cos(th) * RR, z = RC[1] + Math.sin(th) * RR;
    const y = Math.max(.7, FY * (1 - (i + .5) / 16) ** 1.1);
    const seg = box(4.2, 1, 8, '#BDB8AE', x, y - 1, z); seg.rotation.y = -Math.atan2(Math.cos(th), -Math.sin(th)); C.add(seg);
    if (y > 2 && i % 2 === 0) C.add(cyl(.6, .7, y - 1, '#C9C4BA', x, 0, z, 8));
  }
  C.lane(() => pickup(['#B03A2E', '#2E4053', '#F4F6F6', '#1C1C1C', '#7D6608'][Math.floor(rnd() * 5)]), HZ + 9.8, 1, 26, 3, 230);
  C.lane(semi, HZ + 5.8, 1, 20, 2, 230);
  C.lane(() => car(['#D5D8DC', '#34495E', '#C0392B'][Math.floor(rnd() * 3)]), HZ + 2, 1, 28, 3, 230);
  C.lane(() => pickup(['#F4F6F6', '#1C1C1C', '#8E8E8E'][Math.floor(rnd() * 3)]), HZ - 2, -1, 27, 3, 230);
  C.lane(semi, HZ - 5.8, -1, 19, 2, 230);
  C.lane(() => car(['#ECF0F1', '#1B2631', '#2E86C1'][Math.floor(rnd() * 3)]), HZ - 9.8, -1, 25, 3, 230);
  C.lane(() => car(['#ECF0F1', '#7F8C8D', '#B03A2E'][Math.floor(rnd() * 3)]), 9.5, 1, 12, 3, 230);
  C.lane(() => pickup('#2E4053'), 14.5, -1, 11, 2, 230);
  for (let x = -100; x <= 100; x += 25) { C.add(streetLight(), x, 4.8, Math.PI); C.add(streetLight(), x + 12, 19.2); }

  // ---------- Williams Square: granite plaza + fountain + mustangs ----------
  const PX = 8, PZ = -14;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(78, 40), mat('#C9BBAA', { flatShading: false, roughness: .7 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(PX, .05, PZ); plaza.receiveShadow = true; C.add(plaza);
  for (let i = -38; i <= 38; i += 6.5) C.add(box(.15, .02, 40, '#B3A594', PX + i, .05, PZ)); // paving joints
  const fa = .28, FL = 58, FW = 11, fnt = grp();
  fnt.add(box(FL + 1.6, .55, FW + 1.6, '#9E8E7C')); // granite curb
  const water = new THREE.Mesh(new THREE.PlaneGeometry(FL, FW), mat('#4FA3C0', { flatShading: false, roughness: .08, metalness: .3, transparent: true, opacity: .92 }));
  water.rotation.x = -Math.PI / 2; water.position.y = .58; fnt.add(water);
  fnt.add(box(FL, .05, FW, '#2F6E86', 0, .3)); // pool floor tint
  // nine mustangs crossing the stream
  const horses = [[-22, -1.5, 0, .05], [-15, 2.5, 1, -.1], [-9, -2.2, 3, .1], [-3, 1.8, 2, -.05], [3, -1, 0, .12], [9.5, 2.6, 3, -.12], [15, -2.4, 1, .06], [21, 1.4, 0, -.04], [26.5, -.6, 2, .1]];
  const hooves = [];
  horses.forEach(([x, z, p, r]) => { const m = mustang(p); m.position.set(x, .35, z); m.rotation.y = r; fnt.add(m); hooves.push([x, z]); });
  // splashes: points arcing up around the hooves
  const N = 360, sp = new Float32Array(N * 3), meta = [];
  for (let i = 0; i < N; i++) { const [hx, hz] = hooves[i % hooves.length]; meta.push({ hx: hx + (rnd() - .5) * 3.2, hz: hz + (rnd() - .5) * 1.8, vx: (rnd() - .5) * 2, vz: (rnd() - .5) * 2, vy: 2.5 + rnd() * 3, o: rnd() }); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  fnt.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#F4FBFF', size: .28, transparent: true, opacity: .85, depthWrite: false })));
  // low jets along the stream edge
  for (let i = -FL / 2 + 3; i < FL / 2; i += 4) [-1, 1].forEach(s => { const j = cone(.18, 1.1, mat('#E8F6FC', { transparent: true, opacity: .55 }), i, .55, s * (FW / 2 - .6), 5); j.castShadow = false; fnt.add(j); });
  C.add(fnt, PX, PZ, fa);
  C.tick.push(t => {
    for (let i = 0; i < N; i++) { const m = meta[i], k = (t * .9 + m.o) % 1, tt = k * 1.1; sp[i * 3] = m.hx + m.vx * tt; sp[i * 3 + 1] = .6 + m.vy * tt - 4.9 * tt * tt; sp[i * 3 + 2] = m.hz + m.vz * tt; if (sp[i * 3 + 1] < .55) sp[i * 3 + 1] = .55; }
    sg.attributes.position.needsUpdate = true;
  });
  // plaza furniture
  [[-28, -28], [-16, -30], [36, -28], [42, -2], [-26, 2], [26, 2]].forEach(([x, z]) => { C.add(box(4, .6, 4, '#9E8E7C', x, 0, z)); C.add(liveOak(.75), x, z).position.y = .6; });
  [[-12, 3], [30, -4]].forEach(([x, z]) => C.add(grp(box(3, .5, .9, '#9E8E7C')), x, z, fa));
  C.crowd([[-14, 0, 1], [-11, 2, 4], [20, -3, 3], [24, 0, 2.6], [4, 4, .6], [34, -10, 2], [-4, -30, 1.4], [-20, -24, 5]]);

  // ---------- Las Colinas towers ----------
  const tw = [[-30, -48, 20, 16, 58, '#C4DCEC'], [10, -52, 26, 14, 66, '#B8D2E6'], [50, -46, 20, 18, 52, '#CFE2EE'], [-62, -56, 18, 18, 44, '#D8E6EE'], [80, -60, 18, 16, 40, '#C2D8E8']];
  tw.forEach(([x, z, w, d, h, c], i) => {
    const b = C.add(building(w, h, d, c, 'glass', false, '#6C7884'), x, z);
    b.material.forEach(m => { if (m.map) { m.emissive = new THREE.Color('#5F7F98'); m.emissiveIntensity = .55; } });
    C.add(box(w + 1.5, 4, d + 1.5, '#BFB2A2', x, 0, z)); // granite podium
    if (i < 3) C.add(box(w * .7, 3, d * .7, '#6C7884', x, h, z));
  });
  // the "7-Eleven" office: generic stone-and-glass mid-rise west of the plaza (no logo)
  const off = grp(building(22, 30, 16, '#D9D0C2', 'office', false, '#8A8278'), box(23, 1.2, 17, '#B9AE9E', 0, 30), box(24, 4.5, 18, '#A89B8A'), box(8, 3.4, .2, '#2E3A44', 0, .2, 9.05));
  C.add(off, -48, -16);
  C.add(grp(box(.3, 6, .3, '#8A8A8A'), box(4, 2.4, .2, '#F2F2F2', 1.8, 3.6)), -36, -4); // blank directory sign

  // ---------- DART elevated line ----------
  const DZ = -32, DY = 8;
  C.add(box(260, 1.1, 4, '#C4BFB5', 0, DY - 1.1, DZ)); C.add(box(260, .35, .3, '#8E8E92', 0, DY, DZ + 1.6)); C.add(box(260, .35, .3, '#8E8E92', 0, DY, DZ - 1.6));
  for (let x = -120; x <= 120; x += 18) { C.add(cyl(.7, .85, DY - 1.1, '#C9C4BA', x, 0, DZ, 8)); C.add(cyl(.08, .08, 5, '#6A6A6E', x, DY, DZ + 1.9, 5)); }
  C.add(box(260, .06, .06, '#3A3A3E', 0, DY + 4.9, DZ));
  const tr = dartTrain(); tr.position.set(0, DY, DZ); C.add(tr); C.movers.push({ v: tr, dir: 1, speed: 13, len: 260 });

  // ---------- canal + water taxi ----------
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(260, 10), mat('#4C8FA8', { flatShading: false, roughness: .1, metalness: .25 }));
  canal.rotation.x = -Math.PI / 2; canal.position.set(0, .07, -76); C.add(canal);
  [-1, 1].forEach(s => C.add(box(260, .5, 1, '#B9AE9E', 0, 0, -76 + s * 5.5)));
  const taxi = grp(box(7, .9, 2.4, '#F2EEE6', 0, 0), box(4, 1.4, 2.2, '#2E6FA8', -.4, .9), box(4.4, .15, 2.6, '#F2EEE6', -.4, 2.3));
  taxi.position.set(-40, 0, -76); C.add(taxi); C.movers.push({ v: taxi, dir: -1, speed: 4, len: 240 });

  // ---------- water tower ----------
  const wt = grp(), WY = 22;
  wt.add(lathe([[0, 0], [3.2, .6], [5.6, 3.2], [6, 5.2], [5.4, 7.6], [2.8, 9.2], [.5, 9.8], [0, 10]], mat('#EEF1F2'), 20)).children[0].position.y = WY;
  wt.add(cyl(.9, .9, WY, '#D6D9DB', 0, 0, 0, 8));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const l = cyl(.22, .26, WY + 2.5, '#C9CCCE', Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6, 6); wt.add(l); }
  wt.add(cyl(4.9, 4.9, .4, '#C9CCCE', 0, WY * .55, 0, 12)); wt.add(cyl(6.3, 6.3, .3, '#B9BCBE', 0, WY + 4.6, 0, 20));
  [0, Math.PI].forEach(r => { const s = sign('IRVING', 10, 2.6, { bg: '#EEF1F2', fg: '#2B5FA8', font: '900 92px "Big Shoulders Display", "Arial Narrow", sans-serif' }); s.position.set(Math.sin(r) * 6.1, WY + 5.2, Math.cos(r) * 6.05); s.rotation.y = r; wt.add(s); });
  C.add(wt, 74, -12, -.5);

  // ---------- convenience store + fuel canopy (generic, no brand) ----------
  const SX = -38, SZ = 28, store = grp();
  const sw = '#ECE5D6';
  store.add(box(22, .1, 12, '#D8D2C6')); store.add(box(22, 6, .3, sw, 0, 0, -5.85)); [-1, 1].forEach(k => store.add(box(.3, 6, 12, sw, k * 10.85, 0, 0)));
  store.add(box(22, 1.6, .3, sw, 0, 4.4, 5.85)); store.add(box(2, 4.4, .3, sw, -10, 0, 5.85)); store.add(box(4, 4.4, .3, sw, 9, 0, 5.85)); store.add(box(22, .4, 12, sw, 0, 5.6, 0));
  store.add(box(10, .06, .5, glow('#FFF6E0', 1.2), -1, 5.5, 1));
  store.add(box(23, 1.1, 13, '#F4F1EA', 0, 6)); store.add(box(23.04, .5, 13.04, '#3A6FB0', 0, 6.3));
  const glassM = new THREE.MeshStandardMaterial({ color: '#9EC4D8', transparent: true, opacity: .32, roughness: .1, metalness: .3 });
  store.add(box(16, 3.6, .1, glassM, -1, .4, 6.05)); for (let x = -9; x <= 7; x += 4) store.add(box(.2, 3.8, .2, '#5A5E66', x, .3, 6.08));
  store.add(box(16.4, .3, .3, '#5A5E66', -1, 4, 6.1));
  store.add(box(4, 1.1, 1.2, '#7A6656', -4, 0, 3.6)); store.add(box(4.2, .1, 1.4, '#E8E2D6', -4, 1.1, 3.6)); // counter
  store.add(box(.6, .5, .5, '#2B2B30', -5, 1.2, 3.5)); store.add(box(.5, .35, .05, glow('#8FE0B0', 1.2), -5, 1.5, 3.25));
  [['#E74C3C', -3.6], ['#F2C230', -2.8], ['#3A86FF', -2.1]].forEach(([c, x]) => { const t = extrude([[-.3, 0], [.3, 0], [0, .55]], .35, c); t.position.set(x, 1.2, 3.9); store.add(t); }); // promo tent-cards
  for (let i = 0; i < 3; i++) store.add(box(6, 1.8, .8, ['#C9B07A', '#9CC0D9', '#D98C7A'][i], 2 + (i % 2) * 1, 0, -1 - i * 2.2));
  const clerk = person('#2A9D8F'); clerk.position.set(-4, 0, 2.4); store.add(clerk);
  
  C.add(store, SX, SZ);
  const can = grp(box(26, 1.2, 12, '#2D6CB5', 0, 5.6), box(26.2, .3, 12.2, '#F2F2F2', 0, 5.4));
  [[-8, -3], [8, -3], [-8, 3], [8, 3]].forEach(([x, z]) => can.add(cyl(.35, .35, 5.6, '#EDEDED', x, 0, z, 8)));
  [-8, 0, 8].forEach(x => { can.add(box(4, .3, 1.6, '#D6D1C6', x, 0, 0)); can.add(box(1, 1.8, .8, '#E6E8EA', x - .9, .3, 0)); can.add(box(1, 1.8, .8, '#E6E8EA', x + .9, .3, 0)); can.add(box(1.02, .4, .82, '#2D6CB5', x - .9, 1.6, 0)); can.add(box(1.02, .4, .82, '#2D6CB5', x + .9, 1.6, 0)); });
  C.add(can, SX + 31, 40);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(34, 26), mat('#BDB8AE', { flatShading: false })); apron.rotation.x = -Math.PI / 2; apron.position.set(SX + 16, .04, 38); apron.scale.x = 2; C.add(apron);
  C.add(grp(cyl(.3, .3, 9, '#8A8A8A'), box(3.6, 4.6, .6, '#F2F2F2', 0, 9), box(3.2, 1, .65, '#2D6CB5', 0, 12.6)), -62, 50);
  C.add(pickup('#C0392B'), SX + 23, 38.5, 0); C.add(car('#ECF0F1'), SX + 39, 41.5, Math.PI);
  C.hero(SX + 1, 46.5, 0);
  C.crowd([[SX - 5, 36], [SX + 3, 35.5], [SX + 10, 40]]);

  // ---------- Reunion Tower + Dallas skyline on the horizon ----------
  C.add(reunionTower(), 178, -100);
  [[196, -118, 12, 46], [206, -96, 10, 34], [214, -136, 14, 56], [190, -146, 10, 40], [222, -112, 10, 30]].forEach(([x, z, w, h], i) => C.add(box(w, h, w, mat(['#9DB3C6', '#B5C4D0', '#8FA7BB'][i % 3], { fog: false })), x, z));

  // ---------- live oaks, dry grass, scrub ----------
  [[-80, 30], [-62, 36], [10, 34], [26, 30], [44, 36], [-90, -20], [100, 20], [-100, 44], [62, 26], [-14, 30]].forEach(([x, z]) => C.add(liveOak(.9 + rnd() * .4), x, z));
  for (let i = 0; i < 26; i++) { const x = (rnd() - .5) * 260, z = 90 + rnd() * 60; C.add(liveOak(.7 + rnd() * .5), x, z); }
  for (let i = 0; i < 40; i++) { const x = (rnd() - .5) * 240, z = rnd() < .5 ? 26 + rnd() * 20 : 88 + rnd() * 30; if (Math.abs(x - SX) < 20 && z < 50) continue; C.add(ball(.6 + rnd() * .5, '#A89A5E', x, .2, z, 0)); }
  C.particles('dust', 500);

  C.spot(-48, 24, -16);
  C.spot(PX, 6, PZ);
  C.spot(SX - 4, 3.5, SZ + 4);
  return C;
}
