// Nadiad — a warm, dusty Gujarat morning.
// Layout: old-town lane along x. North side (z<0): pastel 2–3 storey houses with jharokhas; Santram Mandir behind them.
// South side: a few houses to the east; the family dairy farm to the south-west. Uttarayan kites over the rooftops.
import { newCity } from '../kit/city.js';
import { addOSM } from '../kit/osm.js';
import nadiadOSM from '../data/osm/nadiad.json';
import {
  THREE, mat, mesh, box, cyl, cone, ball, lathe, extrude, tube, grp, building, sign,
  treeRound, bike, person, SKIN, wheel, rnd, reseed,
} from '../kit/kit.js';

const FONT = '800 60px "Big Shoulders Display", "Arial Narrow", sans-serif';
const WOOD = '#6E4426', WOOD2 = '#8A5A32';

export function build() {
  reseed(23);
  const C = newCity({
    top: '#78AEDC', hor: '#FFE2B0', bot: '#C9A26E', fog: '#EFD9B4', fn: 80, ff: 280,
    sun: '#FFE0B0', si: 1.4, sunPos: [70, 30, 30], sunGlow: '#FFD49A', hs: '#D6E4F5', hg: '#9A7448', hi: .72,
    ground: '#C9A468', yaw: -.6,
  });
  C.pitch = .3;

  // ---------- lane + a loop up to the temple and around past the farm ----------
  C.road(0, 0, 220, 7, 0, { color: '#AE9670', dash: false, walk: 1.6, walkColor: '#C2AB86' });
  // drain / plinth edges
  [-5.3, 5.3].forEach(z => C.add(box(220, .25, .4, '#9C8A6C', 0, 0, z)));
  // the loop: a temple road, a back road behind the houses, and a farm road — a drivable circuit east of the chowk
  const RO = { color: '#A6906A', dash: false, walk: 1.3, walkColor: '#B8A181' };
  [C.road(34, -26, 52, 5.5, Math.PI / 2, RO), C.road(50, -52, 34, 5.5, 0, RO), C.road(66, -26, 52, 5.5, Math.PI / 2, RO)].forEach(r => { r.position.y = .04; });

  const roofs = lane(C);
  temple(C);
  farm(C);
  const flyers = kites(C, roofs);

  // trees (neem) and a pipal near the chowk
  [[-64, 16], [-4, 13], [50, 12], [-80, 30], [-40, 44], [-12, 40], [62, 16], [20, 56], [44, -10]].forEach(([x, z], i) => C.add(treeRound(i % 2 ? '#5C8C3E' : '#6E9A44', 1 + rnd() * .3), x, z));

  // overhead wires across the lane
  for (let i = 0; i < 4; i++) { const x = -40 + i * 24; C.add(cyl(.09, .12, 8, '#7B7468', x, 0, 6.2, 6)); C.add(cyl(.09, .12, 8, '#7B7468', x + 6, 0, -6.2, 6)); }
  for (let i = 0; i < 3; i++) { const x = -40 + i * 24; [7.6, 7.3].forEach((y, k) => C.add(tube([[x, y, 6.2], [x + 12, y - 1.2, 6.2 - k * .2], [x + 24, y, 6.2]], .025, '#2A2622', 12))); }

  // people, bikes, cows in the lane
  C.crowd([[-14, 4.2], [-8, -4.4], [3, 4.5], [11, -4.3], [20, 4.4], [27, -4.6], [-30, -4.4], [-36, 4.6], [36, 4.3]]);
  C.lane(() => bike(['#C0392B', '#2C3E50', '#7F8C8D', '#16A085'][Math.floor(rnd() * 4)]), 1.4, 1, 8, 4, 200);
  C.lane(() => bike('#8E44AD'), -1.6, -1, 7, 3, 200);
  C.add(cow('#ECE7DC'), -2, -2.3, .4);
  C.add(cow('#D9D2C4'), 16, 2.6, 2.9);
  C.add(cow('#4A3F3A'), 30, -3.3, 1.2);
  C.hero(-22, 1.8, 0);
  // local life: cattle ambling across the lane while a couple of scooters wait for them to pass
  const amble = [];
  [[-16, '#EAE3D6'], [10, '#CFC6B6']].forEach(([x, col], i) => { const c = cow(col); c.userData.noCollide = true; C.add(c, x, 0); amble.push({ c, ph: i * 3.1 }); });
  C.tick.push(t => amble.forEach((o, i) => { const z = Math.sin(t * .22 + o.ph) * 5; o.c.position.z = z; o.c.rotation.y = Math.cos(t * .22 + o.ph) >= 0 ? Math.PI / 2 : -Math.PI / 2; }));
  [['#2C3E50', -22, 2.3, 0], ['#C0392B', -24, -2.4, 0], ['#16A085', 4, 2.4, 0]].forEach(([c, x, z, r]) => { const b = bike(c); b.userData.noCollide = true; C.add(b, x, z, r); });

  C.particles('dust', 500);

  // ---------- spots (order = stops.js) ----------
  C.spot(-10, 10, -9.5);                      // 1 The lane I grew up on
  C.spot(34, 20, -58);                        // 2 Santram Mandir
  C.spot(66, 7, -27);                         // 3 The family farm
  C.spot(flyers.x, flyers.y + 5, flyers.z);   // 4 Uttarayan (rooftops)
  addOSM(C, nadiadOSM, { handRoads: [{ z: 0, half: 6, halfX: 112 }], clearBoxes: [
    { minX: 31, maxX: 37, minZ: -55, maxZ: 2 },    // temple road
    { minX: 32, maxX: 68, minZ: -56, maxZ: -48 },  // back road
    { minX: 63, maxX: 69, minZ: -55, maxZ: 2 },    // farm road
  ] });
  // invisible walls around the town so the car stays on the lanes and fields
  (C.colliders ||= []).push(
    { minX: -120, maxX: 104, minZ: -78, maxZ: -70 },  // north
    { minX: -120, maxX: 104, minZ: 60, maxZ: 68 },    // south
    { minX: -120, maxX: -112, minZ: -78, maxZ: 68 },  // west
    { minX: 96, maxX: 104, minZ: -78, maxZ: 68 },     // east
  );
  C.driveRadius = 160;
  C.credit = 'Streets & buildings: © OpenStreetMap contributors';
  return C;
}

// ===== old-town lane =====
function lane(C) {
  const PAST = ['#7CC4C0', '#F0B45A', '#EE9C98', '#F4EEDF', '#9CC2E6', '#EFD072', '#D68B6E', '#B7D59A', '#E8B4D0', '#F4EEDF'];
  const roofs = [];
  const house = (x, z, w, floors, col, face, shopName) => {
    const h = floors * 3.2, g = grp(building(w, h, 8, col, 'res', false, '#C9B48E'));
    const fz = face * 4; // front face z (local)
    // parapet with little merlons
    g.add(box(w + .3, .7, 8.3, '#EDE2CC', 0, h));
    for (let i = -w / 2 + .6; i < w / 2; i += 1.2) g.add(box(.5, .4, .3, '#EDE2CC', i, h + .7, fz));
    // chajja (overhang) over each floor
    for (let f = 1; f < floors; f++) g.add(box(w + .2, .22, 1.2, '#E3D5B8', 0, f * 3.2, fz + face * .6));
    // jharokha balconies on upper floors
    for (let f = 1; f < floors; f++) {
      const n = w > 7 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const bx = n === 1 ? 0 : (k ? 1.8 : -1.8), y = f * 3.2 + .25, J = grp();
        J.add(box(2.6, .25, 1.3, WOOD, 0, 0, 0));
        J.add(box(2.6, .8, .12, WOOD2, 0, .25, .6));
        for (let p = -1.1; p <= 1.11; p += .55) J.add(box(.08, .7, .08, WOOD, p, .3, .62));
        [-1.15, 1.15].forEach(p => J.add(cyl(.07, .07, 1.7, WOOD, p, 1.05, .55, 6)));
        J.add(extrude([[-1.25, 0], [-1.25, .45], [-.8, .7], [0, .85], [.8, .7], [1.25, .45], [1.25, 0], [1, 0], [.9, .4], [0, .6], [-.9, .4], [-1, 0]], .14, WOOD2));
        J.children[J.children.length - 1].position.set(0, 2.05, .56);
        const cp = box(3, .14, 1.6, '#A8452E', 0, 2.75, .2); cp.rotation.x = .3; J.add(cp);
        J.position.set(bx, y, fz + face * .65); if (face < 0) J.rotation.y = Math.PI; g.add(J);
      }
    }
    // ground floor: rolling shutter / doorway + small board
    if (shopName) {
      g.add(box(w * .7, 2.4, .1, ['#5E7C8C', '#8A8F96', '#3F6E9E'][Math.floor(rnd() * 3)], 0, 0, fz + face * .06));
      for (let y = .3; y < 2.4; y += .3) g.add(box(w * .7, .04, .12, '#4B5560', 0, y, fz + face * .08));
      const s = sign(shopName, w * .75, .7, { bg: ['#B8322A', '#2B6E4F', '#D9A520', '#2B4FA8'][Math.floor(rnd() * 4)], fg: '#FFF6E0', font: FONT });
      s.position.set(0, 2.85, fz + face * .07); if (face < 0) s.rotation.y = Math.PI; g.add(s);
    } else {
      g.add(box(1.4, 2.3, .12, WOOD, 0, 0, fz + face * .06));
      g.add(box(1.8, .2, .2, '#EDE2CC', 0, 2.3, fz + face * .1));
    }
    C.add(g, x, z);
    roofs.push({ x, y: h + .7, z });
  };
  const SHOPS = ['KIRANA', 'TAILOR', 'SWEETS', 'FARSAN', 'CYCLE', 'STEEL', 'TEA', 'MOBILE'];
  // north row (faces +z, toward the lane) — full length
  let x = -66;
  for (let i = 0; x < 34; i++) {
    const w = 6 + (i % 3) * 1.2, fl = 2 + ((i * 7) % 3 === 0 ? 1 : (i % 2));
    house(x + w / 2, -9.6, w, Math.min(3, fl), PAST[i % PAST.length], 1, i % 2 === 0 ? SHOPS[i % SHOPS.length] : null);
    x += w + .15;
  }
  // south row only east of the hero (keeps the lane open to the default camera)
  x = 6;
  for (let i = 0; x < 14; i++) {
    const w = 6 + (i % 2) * 1.4;
    house(x + w / 2, 9.6, w, 2 + (i % 2), PAST[(i + 4) % PAST.length], -1, i % 2 ? SHOPS[(i + 3) % SHOPS.length] : null);
    x += w + .15;
  }
  // south-west: low compound walls + a small chowk with a chabutro (bird-feeder tower)
  for (let x2 = -60; x2 < 2; x2 += 4) if (x2 < -26 || x2 > -18) C.add(box(4, 1.6, .4, '#E2C9A0', x2 + 2, 0, 7.6));
  const ch = grp(cyl(1.6, 1.8, .8, '#EDE2CC'), cyl(.35, .35, 4.5, '#EDE2CC', 0, .8, 0, 8), cyl(1.2, .3, .9, '#EDE2CC', 0, 5.2, 0, 8), cone(1.3, 1.2, '#C2571A', 0, 6.1, 0, 8));
  C.add(ch, -22, 12);
  // vegetable handcart + vendor near the chowk
  const hc = grp(box(2.4, .2, 1.3, WOOD2, 0, .8), wheel(.6, .7, .45), wheel(.6, -.7, .45), box(.9, .3, .9, '#E63946', -.6, 1, 0), box(.9, .3, .9, '#6AB04C', .4, 1, 0), box(.5, .3, .9, '#F4A261', 1.0, 1, 0)); C.add(hc, -16, 9, .3);
  C.add(person('#F2C14E'), -14.6, 10.2, 2.6);
  // low tiled-roof houses (south-west, kept low so the lane stays visible)
  [[-64, 24], [-50, 27], [-36, 22], [-74, 34], [-58, 38], [-12, 22], [4, 25]].forEach(([hx, hz], i) => {
    const g = grp(box(8, 3, 6, ['#F0DDBA', '#E9C9A0', '#DCE6D4'][i % 3]), box(1.2, 2.1, .1, WOOD, 0, 0, 3.02), box(1, .9, .1, '#4A6A7A', 2.4, 1.2, 3.02), box(1, .9, .1, '#4A6A7A', -2.4, 1.2, 3.02));
    g.add(extrude([[-3.5, 0], [3.5, 0], [0, 1.7]], 8.8, '#B5532E')); g.children[g.children.length - 1].rotation.y = Math.PI / 2; g.children[g.children.length - 1].position.y = 3;
    C.add(g, hx, hz, (i % 2) * .2);
  });
  return roofs;
}

// ===== Santram Mandir =====
function temple(C) {
  const W = mat('#FFFDF6', { emissive: '#3A342A' }), W2 = mat('#F2ECDF', { emissive: '#2E2A22' }), GOLD = mat('#D9A730', { metalness: .4, roughness: .45 });
  const T = grp();
  // plinth and steps
  T.add(box(34, 2.2, 30, W2, 0, 0, 0));
  for (let s = 0; s < 4; s++) T.add(box(12, .55, 1.4, W2, 0, s * .55, 15.7 + (3 - s) * 1.4));
  // shikhara: curvilinear spire with horizontal tiers + amalaka + kalash
  const spire = (s, x, y, z) => {
    const g = grp();
    const prof = [[0, 0], [4.6, 0], [4.6, 1.6], [4.5, 4], [4.1, 7], [3.5, 9.6], [2.7, 12], [1.8, 13.8], [1.1, 14.8], [0, 15]];
    g.add(lathe(prof, W, 8));
    // horizontal tier bands (stacked look)
    [1.6, 4, 6.2, 8.3, 10.2, 12].forEach((h, i) => { const r = [4.62, 4.52, 4.2, 3.75, 3.2, 2.7][i]; const b = mesh(new THREE.CylinderGeometry(r + .15, r + .2, .35, 8), W2, 0, h, 0); g.add(b); });
    // vertical ribs
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; const rib = tube([[Math.cos(a) * 4.7, .2, Math.sin(a) * 4.7], [Math.cos(a) * 4.3, 7, Math.sin(a) * 4.3], [Math.cos(a) * 2.9, 12, Math.sin(a) * 2.9], [Math.cos(a) * 1.2, 14.7, Math.sin(a) * 1.2]], .2, W2, 10); g.add(rib); }
    const am = lathe([[0, 0], [1.4, .1], [1.7, .4], [1.4, .75], [0, .85]], W2, 16); am.position.y = 14.7; g.add(am);
    const ka = lathe([[0, 0], [.55, 0], [.7, .4], [.4, .8], [.18, 1.1], [.3, 1.3], [0, 1.9]], GOLD, 10); ka.position.y = 15.5; g.add(ka);
    g.scale.setScalar(s); g.position.set(x, y, z); T.add(g); return g;
  };
  // sanctum (back) with the main shikhara and sub-spires (urushringas)
  T.add(box(14, 8, 14, W, 0, 2.2, -6));
  T.add(box(14.8, .5, 14.8, W2, 0, 10.2, -6));
  spire(1.15, 0, 10.7, -6);
  [[-5, -1], [5, -1], [-5, -11], [5, -11]].forEach(([x, z]) => spire(.55, x, 10.7, z));
  [[0, -.2], [-6.2, -6], [6.2, -6], [0, -12]].forEach(([x, z]) => spire(.42, x, 10.7, z));
  // mandapa (front hall) with pillars and a ribbed dome, plus side domes
  T.add(box(18, .6, 14, W2, 0, 2.2, 8));
  for (let i = 0; i < 6; i++) [-1, 1].forEach(sd => T.add(cyl(.42, .48, 5.6, W, -7.5 + i * 3, 2.8, 8 + sd * 6.2, 8)));
  for (let i = 0; i < 4; i++) T.add(cyl(.42, .48, 5.6, W, -4.5 + i * 3, 2.8, 14.6, 8));
  T.add(box(18.6, 1, 14.6, W2, 0, 8.4, 8));
  T.add(box(13, 1.2, 10, W, 0, 9.4, 8));
  const dm = lathe([[0, 0], [5.2, 0], [5.4, 1.2], [5, 2.8], [4, 4.3], [2.4, 5.4], [.7, 6], [0, 6.1]], W, 16); dm.position.set(0, 10.6, 8); T.add(dm);
  const dk = lathe([[0, 0], [.5, 0], [.6, .4], [.3, .8], [0, 1.6]], GOLD, 10); dk.position.set(0, 16.6, 8); T.add(dk);
  [[-7.5, 2.5], [7.5, 2.5], [-7.5, 13.5], [7.5, 13.5]].forEach(([x, z]) => {
    T.add(box(3, 1, 3, W2, x, 9.4, z));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) T.add(cyl(.12, .12, 1.6, W, x + dx * 1.2, 10.4, z + dz * 1.2, 6));
    const cd = lathe([[0, 0], [1.7, 0], [1.6, .9], [1, 1.8], [0, 2.4]], W, 12); cd.position.set(x, 12, z); T.add(cd);
  });
  // side wings / compound
  [-1, 1].forEach(sd => { T.add(box(8, 5, 22, W2, sd * 13, 2.2, 0)); const r = lathe([[0, 0], [2.6, 0], [2.4, 1.2], [1.4, 2.6], [0, 3.2]], W, 12); r.position.set(sd * 13, 7.2, 0); T.add(r); });
  // saffron flag on the main spire
  const pole = cyl(.08, .08, 6, '#6B4A2B', 0, 29.5, -6, 6); T.add(pole);
  const fg = new THREE.PlaneGeometry(3.6, 2, 8, 1); fg.translate(1.8, 0, 0);
  const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: '#F2892B', emissive: '#7A3A08', side: THREE.DoubleSide, roughness: .7 }));
  flag.position.set(0, 34.3, -6); T.add(flag);
  const base = fg.attributes.position.array.slice();
  C.tick.push(t => {
    const a = fg.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { const x = base[i]; a[i + 2] = Math.sin(t * 4 - x * 1.6) * .25 * (x / 3.6); a[i + 1] = base[i + 1] - x * .05 * (1 + Math.sin(t * 2)); }
    fg.attributes.position.needsUpdate = true; flag.rotation.y = Math.sin(t * .7) * .25;
  });
  // temple compound wall + gate facing the lane side
  T.add(box(44, 2.4, .6, '#EFE2C8', 0, 0, 22));
  T.add(box(6, 6, 1.6, '#EFE2C8', 0, 0, 22));
  T.scale.setScalar(.92);
  C.add(T, 34, -58, -.55);
}

// ===== family dairy farm =====
function cow(col) {
  const leg = '#3B3433', g = grp(
    box(2.4, 1.15, 1.0, col, 0, .95), box(.75, .7, .62, col, 1.5, 1.45), box(.3, .3, .5, '#C9A48A', 1.95, 1.4),
    box(.5, .45, .5, col, .55, 2.05), // hump
    cyl(.1, .12, .95, leg, .85, 0, .32, 5), cyl(.1, .12, .95, leg, -.85, 0, .32, 5), cyl(.1, .12, .95, leg, .85, 0, -.32, 5), cyl(.1, .12, .95, leg, -.85, 0, -.32, 5),
    cyl(.04, .05, .9, leg, -1.25, .9, 0, 4));
  [-1, 1].forEach(s => { const h = cone(.07, .6, '#E8DCC2', 1.45, 1.75, s * .25, 5); h.rotation.x = s * .5; g.add(h); });
  return g;
}
function farm(C0) {
  // built in local coords around the shed, then placed at the east edge of town, just past the end of the lane rows
  const G = new THREE.Group(), C = { add: (o, x, z, r) => { if (x !== undefined) { o.position.x = x; o.position.z = z; if (r) o.rotation.y = r; } G.add(o); return o; } };
  const F = grp();
  // cow shed: posts + corrugated tin roof
  for (let i = 0; i < 5; i++) [-4.5, 4.5].forEach(z => F.add(cyl(.15, .15, 4, '#7A6A55', -10 + i * 5, 0, z, 6)));
  const roof = grp(); for (let i = 0; i < 28; i++) roof.add(box(.75, .12, 10.6, i % 2 ? '#A7B1B6' : '#8E989E', -10.5 + i * .78, 0, 0));
  roof.position.y = 4.1; roof.rotation.x = .1; F.add(roof);
  F.add(box(21, 1.2, .2, '#B9A27E', 0, 0, -4.6)); // back half-wall
  F.add(box(18, .5, 1, '#6E7A80', 0, 0, -3.6)); // feed trough
  F.add(box(21, .1, 10, '#9A8566', 0, 0, 0));
  C.add(F, 0, 0, .15);
  [[-6, -1, .2], [-1, -1.4, .1], [4, -.7, .3], [9, 0, .15], [-8, 8, 2.5], [12, 8, 4.2], [16, 3, 1.2]].forEach(([x, z, r], i) =>
    C.add(cow(['#F4F1EA', '#3B3433', '#D9D2C4', '#8A6A4A'][i % 4]), x, z, r));
  // hay stacks (domed)
  [[-18, -4, 1.2], [-20, 3, 1], [-15, 10, 1.1]].forEach(([x, z, s]) => { const h = lathe([[0, 0], [2.4, 0], [2.6, 1.2], [2.3, 2.4], [1.4, 3.3], [0, 3.6]], '#E2C26A', 12); h.scale.setScalar(s); h.position.set(x, 0, z); G.add(h); });
  // milk-can cart (two big wheels, steel cans)
  const cart = grp(box(3, .25, 1.6, WOOD2, 0, .9), box(3, .4, .1, WOOD, 0, 1.15, .8), box(3, .4, .1, WOOD, 0, 1.15, -.8), box(2.6, .1, .12, WOOD, 2.6, .8, .5), box(2.6, .1, .12, WOOD, 2.6, .8, -.5));
  [-.9, .9].forEach(z => { const w = wheel(0, z, .85); w.material = mat('#5A3A22'); cart.add(w); });
  const steel = mat('#C8CDD3', { metalness: .7, roughness: .3 });
  [[-.9, -.4], [-.9, .4], [0, -.4], [0, .4], [.9, 0]].forEach(([x, z]) => { const c = lathe([[0, 0], [.3, 0], [.32, .55], [.18, .75], [.18, .85], [0, .85]], steel, 10); c.position.set(x, 1.15, z); cart.add(c); });
  C.add(cart, 4, 10.5, -.3);
  C.add(person('#F4F1EA'), 6.5, 11.2, 0);
  // fodder field rows east of the shed
  for (let i = 0; i < 9; i++) C.add(box(24, .5, .9, '#6E9A44', 36, 0, -14 + i * 2));
  // fence toward the lane with a gap + sign
  for (let i = 0; i < 12; i++) if (i !== 6 && i !== 7) C.add(box(.18, 1.3, .18, '#7A6A55', -24 + i * 4, 0, 14));
  C.add(box(22, .1, .08, '#7A6A55', -13, 1.1, 14)); C.add(box(14, .1, .08, '#7A6A55', 13, 1.1, 14));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(80, 36), mat('#B79A5E', { flatShading: false })); fg.rotation.x = -Math.PI / 2; fg.position.set(10, .02, -1); G.add(fg);
  const sg = sign('DAIRY FARM', 4, .8, { bg: '#F4EEDF', fg: '#2B6E4F', font: FONT }); sg.position.set(-14, 1.6, 14.15); G.add(sg);
  C.add(cyl(.08, .08, 2, '#7A6A55', -15.8, 0, 14.1, 5)); C.add(cyl(.08, .08, 2, '#7A6A55', -12.2, 0, 14.1, 5));
  C.add(treeRound('#5C8C3E', 1.2), -24, -10);
  G.position.set(66, 0, -27); C0.add(G);
}

// ===== Uttarayan kites =====
function kites(C, roofs) {
  const COLS = ['#E63946', '#F4A261', '#2A9D8F', '#8338EC', '#FFBE0B', '#3A86FF', '#FF006E', '#06D6A0', '#FB5607', '#F72585'];
  const kgeo = (() => { const s = new THREE.Shape([[0, 1.25], [.9, .15], [0, -1], [-.9, .15]].map(([x, y]) => new THREE.Vector2(x, y))); return new THREE.ShapeGeometry(s); })();
  // two rooftop flyers on north-row houses near the centre
  const pick = [roofs.find(r => r.x > -14 && r.z < 0), roofs.find(r => r.x > 14 && r.z < 0)].filter(Boolean);
  const anchors = pick.map((r, i) => {
    const p = person(['#E76F51', '#3A86FF'][i]); C.add(p, r.x + (i ? -1 : 1), r.z + 1.5, .6 + i * 2.2); p.position.y = r.y;
    const arm = box(.12, .8, .12, '#8D5A3B', 0, 1.4, .3); arm.rotation.x = -.9; p.add(arm);
    // a helper holding the spool (firki)
    const q = person('#F2C14E'); C.add(q, r.x + (i ? -2.4 : 2.4), r.z - 1, 2); q.position.y = r.y;
    return new THREE.Vector3(r.x + (i ? -1 : 1), r.y + 2.2, r.z + 1.9);
  });
  const ks = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.MeshStandardMaterial({ color: COLS[i % COLS.length], emissive: COLS[i % COLS.length], emissiveIntensity: .35, side: THREE.DoubleSide, roughness: .6 });
    const k = new THREE.Mesh(kgeo, m); k.scale.setScalar(1.2 + rnd() * .5);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(.35, .6, 3), m); tail.position.y = -1.2; tail.rotation.z = Math.PI; k.add(tail);
    const home = new THREE.Vector3(-50 + rnd() * 100, 12 + rnd() * 10, -34 + rnd() * 50);
    if (i < anchors.length) home.set(anchors[i].x + (i ? 8 : -6), 19, anchors[i].z + 10);
    k.position.copy(home); C.add(k);
    // string: from a roof (or flyer's hand) to the kite
    const from = i < anchors.length ? anchors[i] : (() => { const r = roofs[Math.floor(rnd() * roofs.length)]; return new THREE.Vector3(r.x, r.y + 1.6, r.z); })();
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 9), 3));
    const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x3A3330, transparent: true, opacity: .4 })); C.add(line);
    ks.push({ k, home, from, lg, ph: rnd() * 6 });
  }
  C.tick.push(t => ks.forEach(o => {
    const { k, home, from, lg, ph } = o;
    k.position.set(home.x + Math.sin(t * .6 + ph) * 1.4, home.y + Math.sin(t * 1.3 + ph) * .9, home.z + Math.cos(t * .5 + ph) * .8);
    k.lookAt(k.position.x - 30, k.position.y - 12, k.position.z + 52); k.rotation.z += Math.sin(t * 1.7 + ph) * .35;
    const a = lg.attributes.position.array;
    for (let j = 0; j < 9; j++) { const u = j / 8, sag = Math.sin(u * Math.PI) * 2.2; a[j * 3] = from.x + (k.position.x - from.x) * u; a[j * 3 + 1] = from.y + (k.position.y - from.y) * u - sag; a[j * 3 + 2] = from.z + (k.position.z - from.z) * u; }
    lg.attributes.position.needsUpdate = true;
  }));
  const r0 = pick[0] || roofs[0];
  return { x: r0.x, y: r0.y, z: r0.z };
}
