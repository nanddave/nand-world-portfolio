// "Your city": the visitor's own place as the last stop. Late afternoon, neutral palette. Main road along x; one empty lot on the south
// side where a building rises with the visitor's company name (C.raiseLot(name), same idea as src/cities/brokai.js).
// buildYours({ name, data, company }): with baked OSM `data` (src/kit/osmbake.js) it renders the real streets and buildings around the
// place; without data it falls back to a small designed block with the city name on a street sign.
import { newCity } from '../kit/city.js';
import { addOSM } from '../kit/osm.js';
import { THREE, mat, glow, box, cyl, ball, grp, building, sign, textTex, treeRound, streetLight, car, auto, person, SKIN, rnd, reseed, clamp } from '../kit/kit.js';

const FONT = '800 120px "Big Shoulders Display", "Arial Narrow", sans-serif';
const BLADE = '800 84px "Big Shoulders Display", "Arial Narrow", sans-serif';
const ACC = ['#E07A5F', '#3D85C6', '#F2CC8F', '#81B29A', '#9B72AA', '#F4A261'];
const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function buildYours({ name, data, company } = {}) {
  reseed(77);
  const city = clean(name, 28) || 'Your city', hasData = !!(data && ((data.b && data.b.length) || (data.r && data.r.length)));
  const C = newCity({
    top: '#5E8FCB', hor: '#F6DDB8', bot: '#A9B0B5', fog: '#E6D9C6', fn: 80, ff: 280,
    sun: '#FFD9A3', si: 1.05, sunPos: [-40, 58, 36], sunGlow: '#FFB57A', hs: '#D6E2F2', hg: '#9A8F80', hi: 1.15,
    ground: hasData ? '#A4A58C' : '#A3AD88', yaw: -.55, night: false, bloom: 0, sound: 'blr',
  });
  C.pitch = .32;

  // ---- main road along x ----
  C.road(0, 0, 260, 13, 0, { curb: ['#8A8A86', '#B8B5AD'], walk: 3, walkColor: '#C9C2B4', color: '#4B4D54' });
  for (let i = 0; i < 10; i++) { C.add(streetLight(false), -60 + i * 14, 10.6, Math.PI); C.add(streetLight(false), -53 + i * 14, -10.6, 0); }
  streetSign(C, city);
  lot(C, company);

  if (hasData) {
    addOSM(C, data, {
      handRoads: [{ z: 0, half: 10, halfX: 135 }],
      clearBoxes: [{ minX: -19, maxX: 9, minZ: 12, maxZ: 38 }], // the lot
      roofColor: '#8A8178', roadColor: '#55565C', greenColor: '#7E9A5A', maxTrees: 160,
    });
    C.credit = 'Streets & buildings: © OpenStreetMap contributors';
  } else designedBlock(C);

  // ---- traffic, hero car, people ----
  C.lane(() => car(['#E5E7E9', '#2C3E50', '#8B1E2B', '#3D85C6'][Math.floor(rnd() * 4)]), 1.7, 1, 9, 4, 240);
  C.lane(() => car(['#E5E7E9', '#B08A3E', '#2F4858'][Math.floor(rnd() * 3)]), -1.7, -1, 9, 3, 240);
  C.hero(-30, -4.6, Math.PI);
  C.crowd([[-16, -10.4], [8, -10.4], [22, 10.4], [-36, 10.6]]);

  // ---- the one spot: the empty lot ----
  C.spot(-6, 7, 25);
  return C;
}

// green street-name blade on a pole + a big welcome board, so the city name reads from the orbit camera
function streetSign(C, city) {
  const up = city.toUpperCase();
  const pole = grp(cyl(.07, .07, 3.6, '#5A5F66', 0, 0, 0, 6));
  const blade = sign(up, 5.2, 1.0, { bg: '#1F6B4A', fg: '#FFFFFF', font: BLADE, w: 1024, h: 200 }); blade.position.set(0, 3.9, .08);
  const back = sign(up, 5.2, 1.0, { bg: '#1F6B4A', fg: '#FFFFFF', font: BLADE, w: 1024, h: 200 }); back.position.set(0, 3.9, -.08); back.rotation.y = Math.PI;
  pole.add(blade, back, box(5.4, 1.2, .1, '#E9E9E4', 0, 3.3, 0));
  C.add(pole, 12, 11.6, 0);
  const board = sign(up, 11, 2, { bg: '#F4EBDA', fg: '#2B3A55', font: FONT, w: 1024, h: 186 });
  const bb = grp(box(11.4, 2.4, .2, '#2B3A55', 0, 3, 0), board, box(.25, 3, .25, '#555', -4.6, 0, 0), box(.25, 3, .25, '#555', 4.6, 0, 0));
  board.position.set(0, 4.2, .12);
  const back2 = sign(up, 11, 2, { bg: '#F4EBDA', fg: '#2B3A55', font: FONT, w: 1024, h: 186 }); back2.position.set(0, 4.2, -.12); back2.rotation.y = Math.PI; bb.add(back2);
  C.add(bb, -46, -12.6, 0);
}

// the generic designed block (no map data): buildings both sides, trees, a corner shop with an awning
function designedBlock(C) {
  const kinds = ['res', 'shop', 'office', 'res', 'office'], wall = ['#D8C3A5', '#CDB4A0', '#B9C4CC', '#E1CBB0', '#A8B5BF', '#D9B8A0'];
  let x = -118;
  for (let i = 0; x < 120; i++) { // north side, z<0
    const w = 12 + Math.floor(rnd() * 8), h = 9 + Math.floor(rnd() * 5) * 4, k = kinds[i % 5], d = 14;
    const b = grp(building(w, h, d, wall[i % wall.length], k, false, '#7A736B'));
    if (k === 'shop') b.add(box(w + .3, .9, 1.4, ACC[i % ACC.length], 0, 3, d / 2 + .3));
    C.add(b, x + w / 2, -18 - d / 2 + 2, 0); x += w + 2.5;
  }
  x = -118;
  for (let i = 0; x < 120; i++) { // south side, z>0, keeping the lot (x -17..9) free
    const w = 11 + Math.floor(rnd() * 7), h = 6 + Math.floor(rnd() * 4) * 3, k = kinds[(i + 2) % 5], d = 12;
    const cx = x + w / 2;
    if (cx + w / 2 > -19 && cx - w / 2 < 11) { x = 11; continue; }
    const b = grp(building(w, h, d, wall[(i + 3) % wall.length], k, false, '#7A736B'));
    if (k === 'shop') b.add(box(w + .3, .9, 1.4, ACC[(i + 2) % ACC.length], 0, 3, -d / 2 - .3));
    C.add(b, cx, 17 + d / 2 - 2, Math.PI); x += w + 2.5;
  }
  for (let i = 0; i < 14; i++) { const tx = -100 + i * 15 + rnd() * 4; C.add(treeRound(['#5E8C3E', '#6F9A3F', '#4E7F3A'][i % 3], .9 + rnd() * .3), tx, i % 2 ? 11.8 : -11.8, rnd() * 6); }
  C.add(auto(), 30, 7.8, .05); C.add(car('#F2CC8F'), 52, 7.4, 0);
  // back ring of taller blocks so the horizon is not empty
  for (let i = 0; i < 9; i++) { const a = -2.5 + i * .62, r = 120 + (i % 3) * 18; C.add(grp(building(18, 24 + (i % 4) * 8, 16, wall[i % wall.length], 'office', false, '#7A736B')), Math.sin(a) * r * 1.2, -Math.abs(Math.cos(a)) * r - 40, 0); }
}

// the empty lot + C.raiseLot (idea from src/cities/brokai.js, own code)
function lot(C, company) {
  const X = -6, Z = 25, W = 22, D = 16;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat('#9A9B80', { flatShading: false })); ground.rotation.x = -Math.PI / 2; ground.position.set(X, .05, Z); C.add(ground);
  const posts = [];
  for (let x = -W / 2; x <= W / 2; x += 2.2) posts.push([x, -D / 2], [x, D / 2]);
  for (let z = -D / 2 + 2.2; z < D / 2; z += 2.2) posts.push([-W / 2, z], [W / 2, z]);
  posts.forEach(([x, z]) => { if (z === -D / 2 && Math.abs(x) < 3) return; C.add(box(.15, 1.5, .15, '#8E8E8E', X + x, 0, Z + z)); });
  [.6, 1.25].forEach(y => {
    C.add(box(W / 2 - 3, .04, .04, '#9A9A9A', X - W / 4 - 1.5, y, Z - D / 2)); C.add(box(W / 2 - 3, .04, .04, '#9A9A9A', X + W / 4 + 1.5, y, Z - D / 2));
    C.add(box(W, .04, .04, '#9A9A9A', X, y, Z + D / 2)); C.add(box(.04, .04, D, '#9A9A9A', X - W / 2, y, Z)); C.add(box(.04, .04, D, '#9A9A9A', X + W / 2, y, Z));
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.1, 56), new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(X, .12, Z); C.add(ring);
  C.tick.push(t => { const k = (t * .5) % 1; ring.scale.setScalar(1 + k * .35); ring.material.opacity = .95 * (1 - k); });

  const so = { bg: '#FFFFFF', fg: '#16192E', w: 1024, h: 256, font: FONT };
  const first = company ? 'RESERVED FOR ' + clean(company, 24).toUpperCase() : 'YOUR COMPANY HERE';
  const sA = sign(first, 8, 2, so), sB = sign(first, 8, 2, so);
  sA.position.set(X + 5, 3.4, Z - D / 2 - .5); sA.rotation.y = Math.PI; sB.position.set(X + 5, 3.4, Z - D / 2 - .44);
  C.add(sA); C.add(sB);
  C.add(box(8.3, 2.3, .05, '#2A2A2A', X + 5, 2.25, Z - D / 2 - .47));
  C.add(cyl(.1, .1, 3.4, '#777', X + 1.4, 0, Z - D / 2 - .47, 6)); C.add(cyl(.1, .1, 3.4, '#777', X + 8.6, 0, Z - D / 2 - .47, 6));
  C.lotSign = sA;
  const paint = text => [sA, sB].forEach(m => { const old = m.material.map, tx = textTex(text, so); m.material.map = tx; m.material.needsUpdate = true; if (old) old.dispose(); });

  const blocks = [[-5.5, -1.5, 6, 10, '#7FA7C2'], [1, 2.5, 6, 16, '#E9B44C'], [6.5, -2.5, 5, 7, '#7DB65E']].map(([dx, dz, w, h, c], i) => {
    const g = grp(building(w, h, w, c, 'glass', false, '#3E4854'), box(w + .2, .4, w + .2, glow(ACC[i * 2 % ACC.length], .8), 0, h));
    g.position.set(X + dx, 0, Z + dz); g.scale.y = .001; g.visible = false; C.add(g); return g;
  });
  C.lotBlocks = blocks;
  let start = null, armed = false, now = 0;
  C.tick.push(t => {
    now = t; if (!armed) return;
    if (start === null) start = t;
    blocks.forEach((b, i) => { const k = clamp((t - start - i * .45) / 2.2, 0, 1), e = 1 - Math.pow(1 - k, 3); b.visible = k > 0; b.scale.y = Math.max(.001, e); });
    ring.visible = (t - start) < 3;
  });
  C.raiseLot = n => {
    const nm = clean(n, 24).toUpperCase() || 'YOU';
    paint('BUILT FOR ' + nm); start = null; armed = true;
    blocks.forEach(b => { b.scale.y = .001; b.visible = false; });
    return now;
  };
}
