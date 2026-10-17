// Bangalore, again — late night, the tech parks still lit (Whitefield-ish).
// Layout: main road along x. North (z<0): Brokai Labs office, the salon storefront, tech-park towers behind.
// South (z>0): street-food cart, low shops, and the empty lot ("your company here") that C.raiseLot() builds on.
import { newCity } from '../kit/city.js';
import {
  THREE, mat, glow, box, cyl, ball, grp, building, sign, textTex,
  treeRain, streetLight, auto, car, bike, person, SKIN, wheel, rnd, reseed, clamp,
} from '../kit/kit.js';
import { VISITOR } from '../core/visitor.js';

const FONT = '800 64px "Big Shoulders Display", "Arial Narrow", sans-serif';
const NEON = ['#5EEAD4', '#FFC93C', '#F472B6', '#60A5FA', '#A3E635', '#C084FC'];

export function build() {
  reseed(31);
  const C = newCity({
    top: '#070B22', hor: '#35295A', bot: '#151230', fog: '#262044', fn: 70, ff: 260,
    sun: '#9AA8FF', si: .35, sunPos: [-30, 50, 40], sunGlow: '#5A4AA0', hs: '#5E66A8', hg: '#1E1A2A', hi: .5,
    ground: '#343D30', yaw: -.55, night: true, bloom: .85,
  });
  C.pitch = .28;

  // ---------- road ----------
  C.road(0, 0, 260, 13, 0, { curb: ['#151515', '#F2C230'], walk: 3, walkColor: '#6E6A66' });
  for (let i = 0; i < 13; i++) { C.add(streetLight(true, '#FFE6B0'), -66 + i * 11, 10.6, Math.PI); C.add(streetLight(true, '#FFE6B0'), -60 + i * 11, -10.6, 0); }

  techPark(C);
  office(C);
  salon(C);
  foodCart(C);
  lot(C);
  southShops(C);

  [[-50, 12], [-36, -12.5], [-6, 12], [30, 12], [44, -12.5], [62, 12], [-64, -12.5], [80, -12.5], [-80, 12]].forEach(([x, z]) => C.add(treeRain('#2F5A36', 1 + rnd() * .2), x, z, rnd() * 6));

  // ---------- traffic ----------
  C.lane(auto, 1.6, 1, 10, 5, 240);
  C.lane(auto, -1.6, -1, 9, 4, 240);
  C.lane(() => car(['#E5E7E9', '#2C3E50', '#8B1E2B'][Math.floor(rnd() * 3)], true), 3.6, 1, 12, 3, 240);
  C.lane(() => car('#E5E7E9', true), -3.4, -1, 11, 2, 240);
  C.lane(() => bike(['#E74C3C', '#111', '#2C3E50'][Math.floor(rnd() * 3)]), 5.4, 1, 12, 4, 240);
  C.hero(-30, -4.8, Math.PI);
  C.crowd([[-18, -10.2], [-14, -10.6], [6, -10.4], [16, -10.2], [-40, 9.6], [40, 9.8]]);

  // ---------- spots (order = stops.js) ----------
  C.spot(-24, 16, -19);   // 1 Brokai Labs
  C.spot(12, 8, -16);     // 2 The salon
  C.spot(-6, 7, 25);      // 3 Your company here
  return C;
}

// ===== tech park towers =====
function techPark(C) {
  const T = [[-70, -70, 18, 30, '#7FA7C2'], [-44, -62, 20, 24, '#A6C3D6'], [-14, -78, 22, 30, '#6C94B0'], [14, -64, 18, 22, '#8DB1C8'],
    [40, -76, 24, 28, '#B4CDDC'], [70, -64, 18, 34, '#7FA7C2'], [-100, -40, 18, 42, '#8DB1C8'], [104, -44, 20, 46, '#6C94B0'], [0, -110, 26, 36, '#A6C3D6'], [-40, -105, 20, 38, '#7FA7C2']];
  T.forEach(([x, z, w, h, c], i) => {
    const g = grp(building(w, h, 16, c, 'glass', true, '#3E4854'));
    const col = NEON[i % NEON.length], gm = glow(col, 1.8);
    // rooftop light strips on all four edges + a crown box
    g.add(box(w + .2, .5, .3, gm, 0, h - .2, 8.1)); g.add(box(w + .2, .5, .3, gm, 0, h - .2, -8.1));
    g.add(box(.3, .5, 16.2, gm, w / 2 + .05, h - .2, 0)); g.add(box(.3, .5, 16.2, gm, -w / 2 - .05, h - .2, 0));
    g.add(box(w * .4, 3, 6, '#2E3640', 0, h, 0)); g.add(box(w * .4 + .1, .35, 6.1, gm, 0, h + 2.6, 0));
    if (i % 3 === 0) for (let k = -1; k <= 1; k += 2) g.add(box(.3, h * .8, .3, glow(NEON[(i + 2) % NEON.length], 1.4), k * w * .3, h * .1, 8.15)); // vertical LED fins
    C.add(g, x, z);
  });
  // tech park gate with a lit sign and boom barrier
  const gx = 30, gz = -14;
  const gate = grp(box(1.4, 6, 1.4, '#3A4250', -7, 0, 0), box(1.4, 6, 1.4, '#3A4250', 7, 0, 0), box(15.4, 1.6, 1.6, '#2A303C', 0, 6, 0));
  const gs = sign('TECH PARK', 8, 1.2, { bg: '#10142A', fg: '#5EEAD4', font: FONT, glow: true }); gs.position.set(0, 6.8, .82); gate.add(gs);
  gate.add(box(6, .2, .2, '#E8E8E8', -3, 1, 1)); gate.add(box(.8, 1.4, .8, '#F2C230', -6.5, 0, 1.2));
  gate.add(box(1.6, 2.6, 1.6, '#C9D2DC', 9, 0, 1)); gate.add(box(1.2, .7, .1, glow('#FFE6B0', 1), 9, 1.4, 1.82));
  C.add(gate, gx, gz);
  C.road(gx, -30, 30, 9, Math.PI / 2, { dash: false, color: '#3A3C44' });
}

// ===== Brokai Labs office =====
function office(C) {
  const x0 = -24, z0 = -19;
  const O = grp(building(20, 13, 12, '#E9E6E0', 'office', true, '#8C8880'));
  O.add(box(20.4, .6, 12.4, '#2A2E3A', 0, 13));
  O.add(box(8, 3.2, .1, glow('#FFE7C2', .9), 0, 0, 6.06)); // lobby glass
  O.add(box(9, .3, 2.4, '#2A2E3A', 0, 3.4, 7));             // canopy
  const s = sign('BROKAI LABS', 13, 2, { bg: '#16192E', fg: '#FFC93C', glow: true, font: '900 76px "Big Shoulders Display", "Arial Narrow", sans-serif' });
  s.position.set(0, 9.8, 6.08); O.add(s);
  // a planter and a bench at the entrance
  O.add(box(3, .6, 1, '#4A4F5C', -7, 0, 7)); O.add(ball(.7, '#3E7A46', -7.6, 1, 7, 1)); O.add(ball(.6, '#3E7A46', -6.4, .95, 7, 1));
  C.add(O, x0, z0);
}

// ===== the salon (fictional) =====
function salon(C) {
  const x0 = 12, z0 = -16.5, S = grp();
  const D = 9, W = 14, H = 6;
  // shell: back, sides, roof, upper facade (open glass front)
  S.add(box(W, H, .3, '#2B2440', 0, 0, -D / 2));
  S.add(box(.3, H, D, '#2B2440', -W / 2, 0, 0)); S.add(box(.3, H, D, '#2B2440', W / 2, 0, 0));
  S.add(box(W + .4, .4, D + .4, '#1E1A2A', 0, H, 0));
  S.add(box(W, 2, .3, '#2B2440', 0, 4, D / 2));
  S.add(box(W, .12, D, '#C9B9A6', 0, 0, 0));
  // warm interior: lit back wall, ceiling panel, mirrors with frames, chairs, counter
  S.add(box(W - .8, H - .6, .1, glow('#FFD9A8', .55), 0, .3, -D / 2 + .2));
  S.add(box(W - 1, .1, D - 1, glow('#FFE7C2', 1.2), 0, H - .2, 0));
  for (let i = 0; i < 3; i++) {
    const mx = -4 + i * 4;
    S.add(box(2.2, 2.8, .12, glow('#FFF4E0', 1.6), mx, 1.4, -D / 2 + .32));
    S.add(box(2, 2.6, .1, mat('#A9C6D8', { metalness: .9, roughness: .1 }), mx, 1.5, -D / 2 + .4));
    S.add(box(2.6, .15, .7, '#EDE6DC', mx, 1.1, -D / 2 + .7));
    const ch = grp(cyl(.12, .35, .7, '#222'), box(1, .25, 1, '#151515', 0, .7), box(1, 1.1, .2, '#151515', 0, .9, .45), box(.12, .3, .9, '#151515', .5, 1, 0), box(.12, .3, .9, '#151515', -.5, 1, 0));
    ch.position.set(mx, 0, -D / 2 + 2.2); S.add(ch);
  }
  S.add(box(3, 1.1, 1, '#F5E6D3', W / 2 - 2.4, 0, 2.6));
  S.add(person('#F472B6')); S.children[S.children.length - 1].position.set(-4, .3, -D / 2 + 2.2);
  S.add(person('#2A9D8F')); S.children[S.children.length - 1].position.set(-3, 0, -D / 2 + 3.2);
  S.add(person('#FFFFFF')); S.children[S.children.length - 1].position.set(4.6, 0, 3.4);
  // glass front (tinted, transparent)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W - .4, 4), new THREE.MeshStandardMaterial({ color: '#9FB8D0', transparent: true, opacity: .18, roughness: .1, metalness: .3 }));
  glass.position.set(0, 2, D / 2 + .02); S.add(glass);
  // neon SALON sign
  const ns = sign('SALON', 7, 1.6, { bg: '#1A1428', fg: '#FF6FB5', glow: true, font: '800 96px "Big Shoulders Display", "Arial Narrow", sans-serif' });
  ns.position.set(0, 5, D / 2 + .17); S.add(ns);
  S.add(box(7.4, .1, .1, glow('#FF6FB5', 2.4), 0, 4.15, D / 2 + .2)); S.add(box(7.4, .1, .1, glow('#FF6FB5', 2.4), 0, 5.85, D / 2 + .2));
  C.add(S, x0, z0);
}

// ===== street-food cart =====
function foodCart(C) {
  const x0 = 18, z0 = 10.4, F = grp();
  F.add(box(3.2, .9, 1.6, '#C0392B', 0, .6)); F.add(box(3.3, .1, 1.7, '#B8BEC6', 0, 1.5));
  F.add(wheel(.9, .85, .45)); F.add(wheel(-.9, .85, .45)); F.add(wheel(.9, -.85, .45)); F.add(wheel(-.9, -.85, .45));
  [[-1.5, .75], [1.5, .75], [-1.5, -.75], [1.5, -.75]].forEach(([x, z]) => F.add(cyl(.04, .04, 1.6, '#888', x, 1.6, z, 4)));
  F.add(box(3.6, .1, 2, '#F2C230', 0, 3.2));
  F.add(ball(.25, glow('#FFF0B0', 3), 0, 2.85, 0, 1));
  F.add(cyl(.5, .45, .25, '#3A3A3A', -.7, 1.6, 0, 12)); // tawa
  F.add(cyl(.25, .25, .5, '#C8CDD3', .9, 1.6, .2, 8));
  C.add(F, x0, z0);
  C.steam(x0 - .7, 2, z0);
  C.crowd([[x0 - 2.4, z0 - 1.2, 1.6], [x0 + 2.6, z0 - .8, -1.6], [x0 + .2, z0 - 1.8, 0], [x0 - 1, z0 + 1.4, 3.1]]);
}

// ===== the empty lot + C.raiseLot =====
function lot(C) {
  const X = -6, Z = 25, W = 22, D = 16;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat('#2C352A', { flatShading: false })); ground.rotation.x = -Math.PI / 2; ground.position.set(X, .05, Z); C.add(ground);
  // fence: posts + two wires, gap at the front centre
  const posts = [];
  for (let x = -W / 2; x <= W / 2; x += 2.2) { posts.push([x, -D / 2], [x, D / 2]); }
  for (let z = -D / 2 + 2.2; z < D / 2; z += 2.2) { posts.push([-W / 2, z], [W / 2, z]); }
  posts.forEach(([x, z]) => { if (z === -D / 2 && Math.abs(x) < 3) return; C.add(box(.15, 1.5, .15, '#8E8E8E', X + x, 0, Z + z)); });
  [.6, 1.25].forEach(y => {
    C.add(box(W / 2 - 3, .04, .04, '#9A9A9A', X - W / 4 - 1.5, y, Z - D / 2)); C.add(box(W / 2 - 3, .04, .04, '#9A9A9A', X + W / 4 + 1.5, y, Z - D / 2));
    C.add(box(W, .04, .04, '#9A9A9A', X, y, Z + D / 2)); C.add(box(.04, .04, D, '#9A9A9A', X - W / 2, y, Z)); C.add(box(.04, .04, D, '#9A9A9A', X + W / 2, y, Z));
  });
  // pulsing ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.1, 56), new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(X, .12, Z); C.add(ring);
  const inner = new THREE.Mesh(new THREE.RingGeometry(5.6, 5.75, 56), new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
  inner.rotation.x = -Math.PI / 2; inner.position.set(X, .11, Z); C.add(inner);
  C.tick.push(t => { const k = (t * .5) % 1; ring.scale.setScalar(1 + k * .35); ring.material.opacity = .95 * (1 - k); });

  // two-sided sign board on posts at the road edge (one face to the street, one to the lot)
  const so = { bg: '#FFFFFF', fg: '#16192E', w: 1024, h: 256, font: '800 120px "Big Shoulders Display", "Arial Narrow", sans-serif', glow: true };
  const first = VISITOR.company ? 'RESERVED FOR ' + VISITOR.company.toUpperCase().trim().slice(0, 24) : 'YOUR COMPANY HERE';
  const sA = sign(first, 8, 2, so), sB = sign(first, 8, 2, so);
  [sA, sB].forEach(m => { m.material.emissiveIntensity = .55; });
  sA.position.set(X + 5, 3.4, Z - D / 2 - .5); sA.rotation.y = Math.PI;
  sB.position.set(X + 5, 3.4, Z - D / 2 - .44);
  C.add(sA); C.add(sB);
  C.add(box(8.3, 2.3, .05, '#2A2A2A', X + 5, 2.25, Z - D / 2 - .47));
  C.add(cyl(.1, .1, 3.4, '#777', X + 1.4, 0, Z - D / 2 - .47, 6)); C.add(cyl(.1, .1, 3.4, '#777', X + 8.6, 0, Z - D / 2 - .47, 6));
  C.add(ball(.2, glow('#FFE6B0', 2.5), X + 5, 4.75, Z - D / 2 - .9, 1));
  C.lotSign = sA;
  const paint = text => [sA, sB].forEach(m => {
    const old = m.material.map; const tx = textTex(text, so);
    m.material.map = tx; m.material.emissiveMap = tx; m.material.needsUpdate = true; if (old) old.dispose();
  });

  // three blocks that rise when the visitor "builds" here (hidden until raiseLot)
  const blocks = [[-5.5, -1.5, 6, 10, '#7FA7C2'], [1, 2.5, 6, 16, '#FFC93C'], [6.5, -2.5, 5, 7, '#7DB65E']].map(([dx, dz, w, h, c], i) => {
    const g = grp(building(w, h, w, c, 'glass', true, '#3E4854'), box(w + .2, .4, w + .2, glow(NEON[i * 2 % NEON.length], 1.6), 0, h));
    g.position.set(X + dx, 0, Z + dz); g.scale.y = .001; g.visible = false; C.add(g); return g;
  });
  C.lotBlocks = blocks;
  let start = null, armed = false, now = 0;
  C.tick.push(t => {
    now = t;
    if (!armed) return;
    if (start === null) start = t;
    blocks.forEach((b, i) => { const k = clamp((t - start - i * .45) / 2.2, 0, 1); const e = 1 - Math.pow(1 - k, 3); b.visible = k > 0; b.scale.y = Math.max(.001, e); });
    ring.visible = inner.visible = (t - start) < 3;
  });
  C.raiseLot = name => {
    const n = String(name ?? '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 24) || 'YOU';
    paint('BUILT FOR ' + n);
    start = null; armed = true;
    blocks.forEach(b => { b.scale.y = .001; b.visible = false; });
    return now;
  };
}

// ===== low shops along the south side =====
function southShops(C) {
  const cols = ['#3D405B', '#5B3D52', '#2F4858', '#4A4E69', '#3B3B58'];
  const boards = ['#F94144', '#43AA8B', '#F9C74F', '#577590', '#F3722C'];
  for (let i = 0; i < 5; i++) {
    const s = grp(building(9, 5 + (i % 2) * 3, 8, cols[i], 'shop', true, '#1E1A2A'));
    s.add(box(9.2, 1, .25, glow(boards[i], 1.2), 0, 3.2, -4.1));
    s.add(box(7.6, 2.4, .1, glow('#FFE2B0', .7), 0, .2, -4.06));
    C.add(s, 30 + i * 10, 16);
  }
  for (let i = 0; i < 3; i++) {
    const s = grp(building(9, 6 + (i % 2) * 3, 9, cols[(i + 2) % 5], 'res', true, '#1E1A2A'));
    s.add(box(9.2, 1, .25, glow(boards[(i + 3) % 5], 1.2), 0, 3.2, 4.6));
    C.add(s, -70 + i * 11, -17);
  }
  C.add(auto(), 26, 7.6, .1); C.add(auto(), 29.5, 7.8, -.05);
}
