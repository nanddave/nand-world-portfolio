// Boston — a snowy winter night. State House gold dome, Zakim bridge, Charles River, Back Bay brownstones, Green Line on Huntington Ave.
import { newCity } from '../kit/city.js';
import { addOSM } from '../kit/osm.js';
import bostonOSM from '../data/osm/boston.json';
import { THREE, V, mat, glow, mesh, box, cyl, cone, ball, dome, extrude, tube, grp, building, car, person, SKIN, bareTree, trolley, rnd, reseed } from '../kit/kit.js';

const SNOW = '#EEF2F6';
const GOLD = mat('#E0AE3C', { metalness: .65, roughness: .28, emissive: '#A8741A', emissiveIntensity: .75, flatShading: false });
const WHITE = mat('#ECE8DF', { emissive: '#3A3630', emissiveIntensity: .5 });

function acornLamp() { return grp(cyl(.08, .13, 4, '#1C2620', 0, 0, 0, 6), cyl(.28, .18, .7, glow('#FFD9A0', 2.2), 0, 4, 0, 8), cone(.34, .45, '#1C2620', 0, 4.7, 0, 8)); }

function snowyTree(s) { const t = bareTree(s); for (let i = 0; i < 4; i++) t.add(ball(.32, SNOW, Math.cos(i * 1.6) * .7, 3.4 + (i % 2) * .5, Math.sin(i * 1.6) * .7, 0)); return t; }

function stateHouse() {
  const g = grp();
  g.add(box(46, 6, 26, '#7E7A74'), box(46.2, .2, 26.2, SNOW, 0, 6)); // terrace on the hill
  const hill = dome(40, SNOW, 0, -26, 0, 20); g.add(hill); hill.scale.y = .8;
  for (let i = 0; i < 10; i++) g.add(box(14, .6, 1.2, '#9A968E', 0, i * .6, 13.6 + (9 - i) * 1.1)); // steps
  const base = 6.2;
  const main = building(30, 11, 14, '#9B4A32', 'brick', true, '#5A2E22'); main.position.y += base; g.add(main);
  [-19.5, 19.5].forEach(x => { const w = building(9, 9, 12, '#E2DED4', 'office', true, '#8E8A84'); w.position.set(x, base + 4.5, -1); g.add(w); });
  // front: brick arcade, white colonnade, pediment
  g.add(box(18, 4.2, 3.2, '#9B4A32', 0, base, 8.4));
  for (let i = 0; i < 5; i++) g.add(box(2.2, 2.8, .1, glow('#FFCF88', .9), -6.4 + i * 3.2, base + .3, 10.05));
  g.add(box(18.4, .4, 3.6, WHITE, 0, base + 4.2, 8.4));
  for (let i = 0; i < 8; i++) g.add(cyl(.38, .42, 5.2, WHITE, -7.7 + i * 2.2, base + 4.6, 9.4, 10));
  g.add(box(18.4, 1, 3.6, WHITE, 0, base + 9.8, 8.4));
  const ped = extrude([[-9.4, 0], [9.4, 0], [0, 3]], 3.4, WHITE); ped.position.set(0, base + 10.8, 8.4); g.add(ped);
  g.add(box(30.4, .5, 14.4, SNOW, 0, base + 11));
  // drum, gold dome, white cupola + lantern
  g.add(cyl(6.2, 6.4, 2.6, WHITE, 0, base + 11.4, -1, 24));
  g.add(cyl(5.9, 5.9, .4, SNOW, 0, base + 14, -1, 24));
  const d = dome(5.9, GOLD, 0, base + 14, -1, 28); d.scale.y = .92; g.add(d);
  const cy = base + 14 + 5.4;
  g.add(cyl(1.5, 1.6, .5, WHITE, 0, cy, -1, 12));
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.add(cyl(.12, .12, 2, WHITE, Math.cos(a) * 1.25, cy + .5, -1 + Math.sin(a) * 1.25, 6)); }
  g.add(cyl(1.05, 1.05, 1.9, glow('#FFE2A8', 1.6), 0, cy + .5, -1, 10));
  g.add(cyl(1.6, 1.6, .35, WHITE, 0, cy + 2.5, -1, 12));
  const ld = dome(1.4, GOLD, 0, cy + 2.85, -1, 12); g.add(ld);
  g.add(cone(.35, 1.4, GOLD, 0, cy + 4.1, -1, 8));
  return g;
}

function brownstone(c, h, lit) {
  const g = grp(building(6.4, h, 12, c, 'brick', true, '#3B2A22'));
  const bay = building(3.4, h - 2.6, 1.8, c, 'brick', true, '#3B2A22'); bay.position.set(-1.1, 2.6 + (h - 2.6) / 2, 6.9); g.add(bay);
  g.add(box(3.6, .25, 2, '#D9D3C8', -1.1, h, 6.9), box(3.6, .3, 2, SNOW, -1.1, h + .25, 6.9));
  g.add(box(6.6, .5, 12.4, '#D9D3C8', 0, h)); // cornice
  const mans = extrude([[-6.2, 0], [6.2, 0], [5, 2.6], [-5, 2.6]], 6.4, '#3E3A3C'); mans.rotation.y = Math.PI / 2; mans.position.set(0, h + .5, 0); g.add(mans);
  g.add(box(6.4, .3, 10, SNOW, 0, h + 3.1)); // snow on roof
  g.add(box(1.4, 1.4, 1.2, '#3E3A3C', 1.6, h + 1, 6), box(.9, .8, .05, glow('#FFCC80', .8), 1.6, h + 1.3, 6.62));
  // stoop + door
  for (let i = 0; i < 5; i++) g.add(box(1.8, .5 + i * .5, .6, '#A89A88', 2, 0, 9.6 - i * .6));
  g.add(box(.08, .9, 3, '#1C1C1C', 1.1, 2.4, 8.4), box(.08, .9, 3, '#1C1C1C', 2.9, 2.4, 8.4));
  g.add(box(1.4, 2.4, .1, '#2B1A12', 2, 2.6, 6.04), box(1.5, .4, .12, glow('#FFD49A', 1.2), 2, 5.1, 6.06));
  g.add(box(4.2, .4, 1.4, SNOW, -1.1, 0, 8.8)); // drift in front garden
  if (lit) { g.add(box(2.2, 1.5, .08, glow('#FFC266', 1.5), -1.1, 6.5, 7.86)); g.add(box(1.1, 1.5, .08, glow('#FFC266', 1.5), 2, 6.5, 6.06)); }
  return g;
}

function sailboat(c) {
  const hull = extrude([[-2.2, 0], [2.4, 0], [3, .7], [-2.6, .7]], 1.4, c);
  const sail = extrude([[0, 0], [2.6, 0], [0, 5.4]], .06, mat('#F4F4F0', { side: THREE.DoubleSide }));
  sail.position.set(-.6, 1, 0);
  return grp(hull, cyl(.05, .05, 6.4, '#DDD', -.6, .6, 0, 4), sail);
}

function zakim() {
  const tw = mat('#DCE6F2', { fog: false, emissive: '#6E8CC8', emissiveIntensity: .7 });
  const cab = mat('#BFD4FF', { fog: false, emissive: '#7FA6FF', emissiveIntensity: 1.2 });
  const deck = mat('#58606E', { fog: false });
  const g = grp(box(300, 1.6, 12, deck, 0, 15), box(300, .4, .3, mat('#FFD9A0', { fog: false, emissive: '#FFB860', emissiveIntensity: 1.4 }), 0, 16.8, 5.8));
  [-48, 48].forEach(x => {
    // inverted Y: two legs rise from the river and meet above the deck, then one spire
    const leg = (s) => { const o = extrude([[s * 7.5, 0], [s * 6, 0], [s * .5, 46], [s * 1.6, 46]], 2, tw); o.rotation.y = Math.PI / 2; o.position.x = x; return o; };
    g.add(leg(1), leg(-1));
    const sp = extrude([[-1.6, 0], [1.6, 0], [.6, 40], [-.6, 40]], 2.4, tw); sp.position.set(x, 45, 0); g.add(sp);
    for (let k = 0; k < 9; k++) {
      const y = 56 + k * 3, dx = 10 + k * 7.5;
      [1, -1].forEach(sd => [-1.2, 1.2].forEach(z => g.add(tube([[x, y, z * .2], [x + sd * dx, 16, z * 3.4]], .09, cab, 1))));
    }
  });
  g.children.forEach(c => { c.castShadow = false; c.receiveShadow = false; });
  return g;
}

export function build() {
  reseed(23);
  const C = newCity({ top: '#0E1733', hor: '#4D5D86', bot: '#20283E', fog: '#3D4A6B', fn: 45, ff: 190, sun: '#B8C6FF', si: .45, sunPos: [40, 50, 30], sunGlow: '#7D8DC9', hs: '#7282B5', hg: '#2A2E3E', hi: .6, ground: '#DCE3EA', yaw: -.45, night: true, bloom: .6, sound: 'boston' });
  C.pitch = .16; C.dist = 72; C.target = V(0, 8, 0);

  // Huntington Ave: four lanes with a Green Line median
  C.road(0, 0, 240, 24, 0, { color: '#353943', dash: false, walk: 3, walkColor: '#C9D1D9', rough: .5 });
  const med = new THREE.Mesh(new THREE.PlaneGeometry(240, 8.4), mat('#B9C1C9', { flatShading: false })); med.rotation.x = -Math.PI / 2; med.position.y = .05; C.add(med);
  [-4.2, 4.2].forEach(z => C.add(box(240, .25, .3, '#9AA2AA', 0, 0, z)));
  [-2.2, 2.2].forEach(tz => {
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(240, 2.6), mat('#4A4A4E', { flatShading: false })); bed.rotation.x = -Math.PI / 2; bed.position.set(0, .07, tz); C.add(bed);
    [-.72, .72].forEach(o => C.add(box(240, .12, .12, mat('#A9B0B8', { metalness: .6, roughness: .3 }), 0, .07, tz + o)));
    C.add(tube([[-120, 6.2, tz], [120, 6.2, tz]], .03, '#222', 2));
  });
  for (let i = 0; i < 9; i++) { const x = -80 + i * 20; C.add(grp(cyl(.12, .14, 6.6, '#2E3A34', 0, 0, 0, 6), box(.15, .15, 5.2, '#2E3A34', 0, 6.4, 0)), x, 0); }

  // Green Line stop (spot 3): island platform with shelter
  const plat = grp(box(18, .55, .9, '#8E9298'), box(18, .06, .1, '#F2C230', 0, .55, .4), box(18, .06, .1, '#F2C230', 0, .55, -.4));
  plat.add(box(6, .12, 1.4, '#2E3A34', 0, 3.2), box(.12, 2.6, .12, '#2E3A34', -2.8, .55), box(.12, 2.6, .12, '#2E3A34', 2.8, .55), box(5.4, .3, .5, SNOW, 0, 3.32));
  plat.add(box(2.4, .5, .4, glow('#E8F6E8', 1.2), 0, 2.5), box(.5, .5, .5, glow('#3FA34D', 1.6), 4.2, 2.7));
  plat.add(cyl(.05, .05, 2.2, '#2E3A34', 4.2, .55, 0, 4));
  C.add(plat, 22, 0);

  // trolleys: one each way, pausing at the stop
  const tA = trolley(true), tB = trolley(true);
  [tA, tB].forEach(t => { t.add(box(1.6, .2, 1.2, '#222', 0, 3.7), box(.06, 2.2, .06, '#222', 0, 3.8)); t.children[t.children.length - 1].rotation.x = .5; C.add(t); });
  tA.position.z = 2.2; tB.position.z = -2.2; tB.rotation.y = Math.PI;
  const run = (t, dir, off) => { let x = off, wait = 0; C.tick.push((_, dt) => { if (wait > 0) { wait -= dt; return; } const nx = x + dir * 7 * dt; if ((x - 22) * dir < 0 && (nx - 22) * dir >= 0) wait = 4; x = nx > 120 ? -120 : nx < -120 ? 120 : nx; t.position.x = x; }); t.position.x = off; };
  run(tA, 1, 4); run(tB, -1, 60);

  // north side: Back Bay brownstones
  const cols = ['#8E4A35', '#7E3F2D', '#9A5440', '#83493A', '#6F3A2C'];
  for (let i = 0; i < 8; i++) { const h = 11 + (i % 3) * 1.1; C.add(brownstone(cols[i % 5], h, i === 5), -44 + i * 6.6, -23.5); }

  // Northeastern campus building (spot 1)
  const nu = grp(building(30, 16, 14, '#B5AC9C', 'office', true, '#7E776C'), box(30.6, .8, 14.6, '#CFC8B8', 0, 16), box(30.4, .3, 14.2, SNOW, 0, 16.8));
  nu.add(box(12, 1.2, 4, '#CFC8B8', 0, 0, 8.6));
  for (let i = 0; i < 6; i++) nu.add(cyl(.45, .5, 8, '#E4DED2', -5 + i * 2, 1.2, 9.4, 10));
  nu.add(box(12.6, 1.2, 4.4, '#CFC8B8', 0, 9.2, 8.6), box(12.6, .3, 4.4, SNOW, 0, 10.4, 8.6));
  nu.add(box(4, 3.4, .1, glow('#FFD49A', 1.1), 0, 1.2, 7.1));
  C.add(nu, 30, -30);
  C.add(grp(building(16, 12, 12, '#8A5040', 'brick', true, '#4A2E24'), box(16.2, .3, 12.2, SNOW, 0, 12)), 58, -32);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(36, 8), mat('#F2F5F8', { flatShading: false })); quad.rotation.x = -Math.PI / 2; quad.position.set(36, .06, -19.5); C.add(quad);
  [[17, -18], [21, -18], [41, -18], [47, -18]].forEach(([x, z]) => C.add(snowyTree(1), x, z));

  // Massachusetts State House on its terrace behind the brownstones
  C.add(stateHouse(), -18, -60);

  // distant skyline: Prudential-like tower, Hancock-like blue glass slab
  const pru = grp(building(14, 76, 14, '#8E95A0', 'office', true, '#5E6670'), box(10, 4, 10, '#6E7680', 0, 76), cyl(.3, .3, 14, '#AAA', 0, 80, 0, 6), ball(.4, glow('#FF3030', 2), 0, 94, 0, 0));
  C.add(pru, 58, -132);
  const han = building(24, 68, 8, '#4F79B8', 'glass', true, '#3E5A86'); C.add(han, 92, -124, -.5);
  C.add(building(12, 40, 12, '#A39C90', 'office', true), 30, -128); C.add(building(14, 30, 12, '#7F8792', 'office', true), 116, -136); C.add(building(10, 34, 10, '#9AA0A8', 'office', true), -64, -110); C.add(building(16, 24, 12, '#8A8F98', 'office', true), 8, -104);

  // Charles River with icy edges and a few sailboats
  const river = new THREE.Mesh(new THREE.PlaneGeometry(700, 110), mat('#1C2A44', { flatShading: false, roughness: .12, metalness: .4 })); river.rotation.x = -Math.PI / 2; river.position.set(0, .12, -212); C.add(river);
  const ice = new THREE.Mesh(new THREE.PlaneGeometry(700, 5), mat('#DDE6EE', { flatShading: false, roughness: .3 })); ice.rotation.x = -Math.PI / 2; ice.position.set(0, .16, -159); C.add(ice);
  const boats = [];
  [[-40, '#C0392B'], [-28, '#F4F4F0'], [-12, '#2E5FA8'], [6, '#F4F4F0'], [60, '#C0392B']].forEach(([x, c], i) => { const b = sailboat(c); C.add(b, x, -166 - (i % 2) * 4, .2 * i); boats.push(b); });
  C.tick.push(t => boats.forEach((b, i) => { b.rotation.z = Math.sin(t * .8 + i) * .04; b.position.y = .1 + Math.sin(t + i) * .06; }));
  for (let i = 0; i < 6; i++) C.add(box(1.4, .6, 6, '#6B5A4A', -46 + i * 10, 0, -159));

  // Zakim-style cable-stayed bridge across the river
  C.add(zakim(), 40, -236, .55);

  // south side: snowy park strip, trees, lamps, benches
  for (let i = 0; i < 12; i++) { C.add(acornLamp(), -66 + i * 12, -13.2); C.add(acornLamp(), -60 + i * 12, 13.2); }
  [[-50, 18], [-34, 22], [-18, 17], [4, 20], [24, 18], [40, 23], [58, 18], [-62, 26], [70, 24], [-8, 28], [16, 30]].forEach(([x, z]) => C.add(snowyTree(1 + rnd() * .3), x, z, rnd() * 6));
  [[-26, -14.2], [-6, -14.2], [12, -14.2]].forEach(([x, z]) => C.add(snowyTree(.9), x, z));
  for (let i = 0; i < 4; i++) C.add(grp(box(2.2, .1, .7, '#5A3E2A', 0, .5), box(2.2, .6, .1, '#5A3E2A', 0, .6, -.3), box(2.2, .1, .5, SNOW, 0, .62)), -40 + i * 22, 17, 0);
  // snowbanks along both curbs
  for (let i = 0; i < 30; i++) [1, -1].forEach(sd => { if (sd < 0 && i % 4 === 0) return; const b = ball(1.2 + rnd() * .5, SNOW, -116 + i * 8 + rnd() * 2, 0, sd * 12.2, 0); b.scale.set(1.8, .5, .7); b.castShadow = false; C.add(b); });

  // parked cars with snow on the roof, traffic both ways
  [[-30, -10.4], [-16, -10.4], [10, -10.4], [38, 10.4], [52, -10.4]].forEach(([x, z], i) => { const c = car(['#2C3E50', '#8E1B1B', '#5D6D7E', '#1B2631', '#ECF0F1'][i], true); c.add(box(2.3, .25, 1.6, SNOW, -.2, 2.08)); C.add(c, x, z, z > 0 ? 0 : Math.PI); });
  C.lane(() => car(['#2C3E50', '#ECF0F1', '#7F8C8D'][Math.floor(rnd() * 3)], true), 7, 1, 9, 3, 220);
  C.lane(() => car(['#8E1B1B', '#1B2631', '#D0D3D4'][Math.floor(rnd() * 3)], true), -7, -1, 9, 3, 220);

  // people in winter coats
  const coats = ['#1F2A44', '#7A2E2E', '#2E5E45', '#3A3A3A', '#B5651D', '#5B4A7A'];
  [[-36, -14.6], [-34.6, -14.8], [-10, -14], [6, 14.2], [8, 14.6], [30, -14.4], [-24, 14], [44, 14.4], [21, .1], [23.5, -.1]].forEach(([x, z], i) => { const p = person(coats[i % 6]); p.add(cyl(.3, .3, .12, '#C0392B', 0, 1.5, 0, 8)); C.add(p, x, z, rnd() * 6); if (Math.abs(z) < 1) p.position.y = .55; });

  C.particles('snow', 2800);
  C.hero(-4, 10.4, 0);

  C.spot(30, 18, -22.4); // 1 Northeastern University
  C.spot(-11, 8, -15.6); // 2 My first apartment
  C.spot(22, 4.2, 0); // 3 The Green Line
  addOSM(C, bostonOSM, {
    handRoads: [{ z: 0, half: 16, halfX: 125 }],
    greenColor: '#E4EAF0', roofColor: '#EEF2F6', treeColors: ['#C9D3DC', '#D6DEE6', '#E4EAF0'],
    clearBoxes: [{ minX: -48, maxX: 12, minZ: -104, maxZ: -38 }, // hand-made State House terrace + hill (real footprint is excluded in the bake)
      { minX: -400, maxX: 400, minZ: -600, maxZ: -152 }],        // Charles River + Zakim bridge
  });
  C.credit = 'Streets & buildings: © OpenStreetMap contributors';
  return C;
}
