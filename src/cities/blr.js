// Bangalore — evening rush, the streetlights coming on.
// Layout: main road along x. North (z<0): engineering college + cricket ground, darshini, shop row, Vidhana Soudha far behind.
// South (z>0): ANA paper-cup factory, Cubbon-style lawn. Namma Metro (Purple Line) viaduct runs parallel to the road at z = -23.
import { newCity } from '../kit/city.js';
import {
  THREE, mat, glow, mesh, box, cyl, cone, ball, lathe, extrude, grp, building, sign,
  treeRain, streetLight, auto, bus, car, bike, person, SKIN, wheel, rnd, reseed,
} from '../kit/kit.js';

const FONT = '800 64px "Big Shoulders Display", "Arial Narrow", sans-serif';

export function build() {
  reseed(11);
  const C = newCity({
    top: '#1E2A58', hor: '#F2955A', bot: '#4A3A55', fog: '#C68B78', fn: 70, ff: 300,
    sun: '#FFB27A', si: 1.0, sunPos: [-80, 14, -30], sunGlow: '#FF9A55',
    hs: '#8E9FD6', hg: '#5A4030', hi: .62, ground: '#66724A', yaw: -.55, night: true, bloom: .5,
  });

  C.pitch = .3; // a touch lower than default so the Vidhana Soudha dome sits inside the frame

  // ---------- road  ----------
  C.road(0, 0, 260, 13, 0, { curb: ['#151515', '#F2C230'], walk: 3, walkColor: '#9E9A90' });
  for (let i = 0; i < 13; i++) { C.add(streetLight(true), -66 + i * 11, 10.6, Math.PI); C.add(streetLight(true), -60 + i * 11, -10.6, 0); }
  // side street to the factory yard
  C.road(28, 20, 22, 6, Math.PI / 2, { dash: false, color: '#4C4D52' });

  vidhanaSoudha(C);
  metro(C);
  college(C);
  factory(C);
  darshini(C);
  shops(C);
  skyline(C);

  // ---------- trees: rain trees (green, wide) and gulmohar (red-orange) ----------
  const GUL = mat('#F25A28', { emissive: '#6A1A00', emissiveIntensity: .6 }), RAIN = '#4A7F3A';
  const gul = s => { const t = treeRain('#F25A28', s); t.children.slice(1).forEach((b, k) => { b.material = k === 2 ? mat('#5E8C3E') : GUL; }); return t; };
  [[-50, -12], [-36, 12], [-4, -12], [6, 12], [24, 12], [72, 12], [58, -12], [90, 12], [-80, 12], [92, -12], [-64, -12], [-14, 12]].forEach(([x, z], i) =>
    C.add(i % 3 === 1 ? gul(1) : treeRain(RAIN, 1.15), x, z, rnd() * 6));
  // Cubbon-park-style lawn with big rain trees (south west)
  [[-60, 34], [-74, 44], [-88, 30], [-52, 52], [-96, 54], [-70, 66], [-40, 40], [-20, 48]].forEach(([x, z], i) => C.add(i % 3 === 0 ? gul(1.25) : treeRain(i % 2 ? RAIN : '#3F7034', 1.3 + rnd() * .4), x, z, rnd() * 6));
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), mat('#5C7F3E', { flatShading: false })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(-60, .03, 45); C.add(lawn);
  C.crowd([[-56, 40], [-55, 41.2], [-30, 44], [-78, 50]]);

  // ---------- traffic ----------
  C.lane(auto, 1.6, 1, 9, 6, 240);
  C.lane(auto, -1.6, -1, 8, 5, 240);
  C.lane(() => bus('#1F5FAD', '#E8E8E8', true), -4.3, -1, 6.5, 2, 240);
  C.lane(() => car(['#B0B7BF', '#8B1E2B', '#F2F2F2'][Math.floor(rnd() * 3)], true), 4.2, 1, 10, 3, 240);
  C.lane(() => bike(['#2C3E50', '#C0392B', '#111'][Math.floor(rnd() * 3)]), 5.7, 1, 11, 4, 240);
  C.lane(() => bike('#1A1A1A'), -5.8, -1, 10, 3, 240);
  C.hero(-8, 4.6, 0);

  // ---------- spots (order = stops.js) ----------
  C.spot(-20, 11, -11);   // 1 Engineering college (gate)
  C.spot(0, 16, 29); // 2 ANA Packaging & Trading
  C.spot(16, 6, -16);     // 3 The darshini
  return C;
}

// ===== Vidhana Soudha (distant hero landmark) =====
function vidhanaSoudha(C) {
  const G = '#D3C9B4', GL = mat('#D8CEB9', { emissive: '#6A4E2E', emissiveIntensity: .35 }), DOME = mat('#E2D9C6', { emissive: '#7A5A34', emissiveIntensity: .45 });
  const V = grp();
  // plinth + steps
  V.add(box(88, 2, 30, GL, 0, 0, 0));
  for (let s = 0; s < 4; s++) V.add(box(22 - s * 1.5, .6, 4, GL, 0, 2 - (3 - s) * .5 - .5, 17 + (3 - s) * 1.2));
  // main block with lit windows
  const main = building(84, 12, 22, G, 'brick', true, '#A99E89'); main.position.y += 2; V.add(main);
  V.add(box(86, .9, 23.4, GL, 0, 14));
  // parapet ribs
  for (let i = -40; i <= 40; i += 4) V.add(box(1, .9, .6, GL, i, 14.9, 11.4));
  // corner pavilions + domes
  [[-36, 7], [36, 7], [-36, -7], [36, -7]].forEach(([x, z]) => {
    V.add(box(9, 4, 9, GL, x, 14.9, z));
    V.add(box(10, .5, 10, GL, x, 18.9, z));
    const d = lathe([[0, 0], [3.4, 0], [3.7, 1], [3.3, 2.4], [2.2, 3.6], [.9, 4.3], [0, 4.5]], DOME, 16); d.position.set(x, 19.4, z); V.add(d);
    V.add(cone(.3, 1.6, DOME, x, 23.8, z, 6));
  });
  // central raised block
  V.add(box(32, 8, 18, GL, 0, 14.9, 0));
  V.add(box(33, .8, 19, GL, 0, 22.9, 0));
  // portico: 12 columns, entablature, raised parapet
  for (let i = 0; i < 12; i++) V.add(cyl(.75, .85, 12.4, GL, -13.2 + i * 2.4, 2, 20, 10));
  V.add(box(31, 2.4, 11, GL, 0, 14.4, 16));
  V.add(box(16, 2.2, 1.2, GL, 0, 16.8, 21));
  const ped = extrude([[-8, 0], [8, 0], [0, 2.4]], 1.2, GL); ped.position.set(0, 19, 21); V.add(ped);
  // drum, dome, lantern
  V.add(cyl(8, 8.4, 4.5, GL, 0, 23.7, 0, 24));
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; V.add(cyl(.35, .35, 4, GL, Math.cos(a) * 8.6, 23.7, Math.sin(a) * 8.6, 6)); }
  V.add(cyl(9, 9, .7, GL, 0, 28.2, 0, 24));
  const dm = lathe([[0, 0], [8.2, 0], [8.7, 1.6], [8.4, 3.8], [7.4, 6], [5.6, 8], [3.2, 9.4], [1.2, 10], [0, 10.2]], DOME, 28); dm.position.y = 28.9; V.add(dm);
  V.add(cyl(1.5, 1.7, 2.4, GL, 0, 38.8, 0, 10));
  const lt = lathe([[0, 0], [1.9, 0], [1.8, .9], [1.1, 1.8], [0, 2.2]], DOME, 12); lt.position.y = 41.2; V.add(lt);
  V.add(cone(.25, 2.4, DOME, 0, 43.2, 0, 6));
  V.scale.setScalar(.78);
  C.add(V, 48, -100, -.4);
  // flood glow on the lawn in front
  const lw = new THREE.Mesh(new THREE.PlaneGeometry(130, 40), mat('#4F6F3A', { flatShading: false })); lw.rotation.x = -Math.PI / 2; lw.position.set(40, .04, -80); lw.rotation.z = -.4; lw.scale.setScalar(.8); C.add(lw);
}

// ===== Namma Metro Purple Line: elevated viaduct running parallel to the road, just north of it =====
const MZ = -23;
function metro(C) {
  const Y = 9.5, CON = '#ABA79E', L = 280;
  C.add(box(L, 1.4, 5, CON, 0, Y - 1.4, MZ));
  C.add(box(L, .5, 3.6, '#8E8A82', 0, Y - 1.9, MZ));
  [-2.4, 2.4].forEach(dz => C.add(box(L, .9, .3, '#C4C0B6', 0, Y, MZ + dz)));
  for (let x = -131; x < 140; x += 22) { C.add(cyl(.8, .95, Y - 2.6, CON, x, 0, MZ, 10)); C.add(box(2.2, 1.3, 4.8, CON, x, Y - 2.7, MZ)); }
  // station: wider deck with a purple-trimmed canopy and a stair tower behind
  const st = grp(box(34, 1.2, 12, '#B7B2A8', 0, Y - 1.2, 0), box(36, .5, 13, '#7B2D8E', 0, Y + 5, 0), box(34, .3, 12.5, '#D8D4CC', 0, Y + 4.7, 0),
    box(30, .6, .2, glow('#FFE3B0', 1.4), 0, Y + 4.4, 5.9), box(30, .6, .2, glow('#FFE3B0', 1.4), 0, Y + 4.4, -5.9));
  [[-15, 5.8], [15, 5.8], [-15, -5.8], [15, -5.8]].forEach(([x, z]) => st.add(box(.5, 5, .5, '#9A968E', x, Y, z)));
  st.add(box(6, Y + 5, 4, '#BDB8AE', 8, 0, -9)); st.add(box(6.1, .8, 4.1, '#7B2D8E', 8, Y + 4.2, -9));
  [-12, 12].forEach(x => st.add(box(3, Y - 1.2, 3, CON, x, 0, 0)));
  C.add(st, 56, MZ);
  // trains: 3 cars, purple band, lit window strip (face +x); one each way
  const train = grp();
  for (let i = 0; i < 3; i++) {
    const x = -i * 20.5;
    train.add(box(19.8, 3.1, 2.9, '#D7DAE0', x, .5, 0));
    train.add(box(19.8, .55, 2.94, '#7B2D8E', x, .9, 0));
    train.add(box(18, .9, 2.96, glow('#FFF0C8', 1.1), x, 2, 0));
    train.add(box(19.6, .2, 2.6, '#9AA0A8', x, 3.6, 0));
  }
  train.add(box(.1, 1.2, 2.2, glow('#FFF6D8', 2.4), 9.95, 1.6, 0));
  train.position.set(0, Y, MZ + 1.1); C.add(train);
  const train2 = train.clone(); train2.rotation.y = Math.PI; train2.position.z = MZ - 1.1; C.add(train2);
  C.tick.push(t => { const P = 320; train.position.x = -160 + ((t * 13) % P); train2.position.x = 160 - ((t * 11 + 150) % P); });
}

// ===== Engineering college =====
function college(C) {
  const STONE = '#D8CBB0', WALL = '#C9B89A', TRIM = '#B44A2C';
  const gx = -20, gz = -11.5;
  // compound wall (front, sides, back) with a gap for the gate
  for (let x = -50; x < 6; x += 4) { if (x > gx - 8 && x < gx + 6) continue; C.add(box(4, 2.4, .5, WALL, x + 2, 0, gz)); C.add(box(4.1, .25, .7, TRIM, x + 2, 2.4, gz)); }
  for (let z = gz - 2; z > -88; z -= 4) { C.add(box(.5, 2.4, 4, WALL, -50, 0, z)); C.add(box(.5, 2.4, 4, WALL, 6, 0, z)); }
  for (let x = -50; x < 6; x += 4) C.add(box(4, 2.4, .5, WALL, x + 2, 0, -88));
  // gate arch
  const arch = extrude([[-6.5, 0], [-6.5, 9], [6.5, 9], [6.5, 0], [4.6, 0], [4.6, 5.4], [3.6, 6.7], [2, 7.4], [0, 7.6], [-2, 7.4], [-3.6, 6.7], [-4.6, 5.4], [-4.6, 0]], 1.6, STONE);
  arch.position.set(gx, 0, gz); C.add(arch);
  C.add(box(14, .6, 2, TRIM, gx, 9, gz));
  [-6.2, 6.2].forEach(dx => { C.add(box(2, 1.4, 2, STONE, gx + dx, 9.6, gz)); C.add(cone(1, 1.2, STONE, gx + dx, 11, gz, 4)); });
  const cs = sign('ENGINEERING COLLEGE', 10, 1.4, { bg: '#7A2E1E', fg: '#FFE7B8', font: FONT, glow: true }); cs.position.set(gx, 8.2, gz + .82); C.add(cs);
  [-8, 8].forEach(dx => C.add(ball(.3, glow('#FFD8A0', 2.4), gx + dx * .82, 9.9, gz + 1, 1)));
  // driveway
  C.road(gx, -22, 21, 6, Math.PI / 2, { dash: false, color: '#8E8577' });
  // academic block with colonnade + central portico
  const ab = grp(building(40, 12, 12, '#E2D3B4', 'office', true, '#9C8E74'));
  for (let i = 0; i < 13; i++) ab.add(cyl(.38, .38, 9.5, '#F2EADB', -18 + i * 3, 0, 6.6, 8));
  ab.add(box(41, .8, 2, '#F2EADB', 0, 9.5, 6.6));
  ab.add(box(12, 3.5, 4, '#E8DCC2', 0, 12, 7)); ab.add(extrude([[-6.5, 0], [6.5, 0], [0, 2.6]], 4.4, TRIM)); ab.children[ab.children.length - 1].position.set(0, 15.5, 7);
  ab.add(box(42, .8, 13, '#C9B48E', 0, 12));
  C.add(ab, gx, -40);
  // cricket ground (inside compound, west of block)
  const field = new THREE.Mesh(new THREE.CircleGeometry(15, 40), mat('#5E9A45', { flatShading: false })); field.rotation.x = -Math.PI / 2; field.scale.set(1.25, 1, 1); field.position.set(-28, .05, -70); C.add(field);
  const rope = new THREE.Mesh(new THREE.RingGeometry(14.6, 15, 40), mat('#F4F1E8', { flatShading: false })); rope.rotation.x = -Math.PI / 2; rope.scale.set(1.25, 1, 1); rope.position.set(-28, .07, -70); C.add(rope);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 11), mat('#C9B07A', { flatShading: false })); pitch.rotation.x = -Math.PI / 2; pitch.position.set(-28, .08, -70); C.add(pitch);
  [-5.2, 5.2].forEach(dz => [-.2, 0, .2].forEach(dx => C.add(cyl(.04, .04, .75, '#F4EEDC', -28 + dx, 0, -70 + dz, 4))));
  C.add(box(8, 3.5, .4, '#F4F1E8', -28, 0, -86.5)); // sight screen
  C.crowd([[-27, -64], [-28.6, -75.5], [-36, -66], [-20, -72], [-33, -79], [-22, -63], [-38, -73]]);
  C.crowd([[-23, -10.4], [-17, -10], [-25.5, -9.6]]); // students at the gate
}

// ===== ANA Packaging — paper-cup factory =====
function factory(C) {
  const F = grp(), W = 30, D = 16, H = 7, x0 = 8, z0 = 29;
  F.add(building(W, H, D, '#E6E0D2', 'shop', true, '#B0A898'));
  F.add(box(W + .4, .4, D + .4, '#BDB4A2', 0, H));
  // sawtooth roof: 3 teeth (vertical glazed face + slope), last bay flat for the cup
  for (let i = 0; i < 3; i++) {
    const tx = -W / 2 + 9 + i * 7;
    const t = extrude([[0, 0], [7, 0], [0, 3.4]], D, '#8E98A0'); t.position.set(tx, H + .4, 0); F.add(t);
    const gl = box(.12, 3, D - .6, glow('#FFE2A8', .9), tx + .08, H + .4, 0); F.add(gl);
  }
  // giant paper cup on the flat bay
  const cup = grp();
  cup.add(lathe([[0, 0], [2.4, 0], [3.3, 7], [3.55, 7.05], [3.6, 7.4], [3.2, 7.45], [3.1, 7.2], [0, 7.2]], '#FBFAF6', 28));
  const band = mesh(new THREE.CylinderGeometry(3.07, 2.86, 1.6, 28, 1, true), '#2B4FA8', 0, 4, 0); cup.add(band);
  cup.add(box(.6, .6, .6, glow('#FFF4D8', 2), 0, -.3, 3.4));
  cup.position.set(-W / 2 + 4.5, H + .4, 0); F.add(cup);
  // signs: one facing the street, one facing the yard (and the default camera)
  const s1 = sign('ANA PACKAGING', 12, 1.8, { bg: '#2B4FA8', fg: '#FFFFFF', font: FONT, glow: true }); s1.position.set(4, 5, D / 2 + .06); F.add(s1);
  const s2 = sign('ANA PACKAGING', 12, 1.8, { bg: '#2B4FA8', fg: '#FFFFFF', font: FONT, glow: true }); s2.position.set(-3, 5, -D / 2 - .06); s2.rotation.y = Math.PI; F.add(s2);
  // loading dock + rolling shutter on the yard side
  F.add(box(10, 1.2, 3, '#9A9488', 6, 0, D / 2 + 1.5));
  F.add(box(6, 4.2, .1, glow('#FFDCA0', .7), 6, 1.2, D / 2 + .06));
  C.add(F, x0, z0);
  // carton stacks + a worker
  for (let i = 0; i < 6; i++) C.add(box(1.2, 1, 1.2, '#C79A5C', x0 - 6 + (i % 3) * 1.3, Math.floor(i / 3), z0 + D / 2 + 3.6));
  C.crowd([[x0 + 2, z0 + D / 2 + 4], [x0 + 10, z0 + D / 2 + 1.6]]);
  // loading truck backed up to the dock
  const tr = grp(
    box(2.4, 2.3, 2.4, '#E8B33A', 3.8, .7), box(.06, .9, 2, '#9FC3D8', 5.02, 1.8), box(.06, .3, 2.2, glow('#FFF4D0', 1.6), 5.02, .9),
    box(6.4, 2.8, 2.5, '#2F6FA8', -.8, .9), box(6.5, .3, 2.6, '#1C4E7E', -.8, 3.7),
    wheel(3.8, 1.1, .5), wheel(3.8, -1.1, .5), wheel(-2.4, 1.1, .5), wheel(-2.4, -1.1, .5), wheel(-1.2, 1.1, .5), wheel(-1.2, -1.1, .5));
  C.add(tr, x0 + 6, z0 + D / 2 + 7.5, -Math.PI / 2);
  // boundary wall
  for (let x = x0 - 17; x < x0 + 17; x += 4) C.add(box(4, 1.8, .4, '#B8AC96', x + 2, 0, z0 + 19));
}

// ===== Darshini — standing filter-coffee place =====
function darshini(C) {
  const x0 = 16, z0 = -16.5, D = grp();
  const WALL = '#E9DDBF';
  D.add(box(9, .3, 7, '#8C8578', 0, 0, 0));
  D.add(box(9, 4.2, .3, WALL, 0, 0, -3.4));
  D.add(box(.3, 4.2, 7, WALL, -4.4, 0, 0)); D.add(box(.3, 4.2, 7, WALL, 4.4, 0, 0));
  D.add(box(9.6, .35, 8, '#3D7A4A', 0, 4.2, .3));
  const sg = sign('TIFFIN · COFFEE', 8, 1.3, { bg: '#F2C230', fg: '#7A1E1E', font: FONT, glow: true }); sg.position.set(0, 5.05, 4.32); D.add(sg);
  D.add(box(8.6, 1.3, .3, mat('#E8E8E8'), 0, 4.55, 3.95));
  // steel counter + urns + interior light
  D.add(box(7, 1.1, 1, mat('#C9CED6', { metalness: .7, roughness: .3 }), 0, .3, -1.2));
  D.add(cyl(.45, .5, 1.1, mat('#D8DCE2', { metalness: .8, roughness: .25 }), -2, 1.4, -1.2, 12));
  D.add(cyl(.4, .45, .9, mat('#D8DCE2', { metalness: .8, roughness: .25 }), -.8, 1.4, -1.2, 12));
  D.add(box(8, .15, 5, glow('#FFE7B8', 1.4), 0, 4.0, 0));
  D.add(box(8.4, 3.6, .1, glow('#FFD9A0', .45), 0, .3, -3.2)); D.add(box(6, 1.2, .12, '#5A3A22', 0, 2.4, -3.15)); // lit back wall + menu board
  // standing tables (steel) outside, with tumblers
  const steel = mat('#C9CED6', { metalness: .7, roughness: .3 });
  [[-2.6, 2.4], [2.6, 2.4], [0, 5]].forEach(([x, z]) => { D.add(cyl(.08, .1, 1.05, steel, x, .3, z, 6)); D.add(cyl(.55, .55, .08, steel, x, 1.35, z, 12)); D.add(cyl(.07, .06, .18, steel, x + .2, 1.43, z, 6)); });
  C.add(D, x0, z0);
  [[-2.6 + .9, 2.4], [-2.6 - .9, 2.5], [2.6 + .9, 2.4], [2.6 - .8, 2.2], [.9, 5.1], [-.8, 4.8], [-.6, -.4], [1.4, -.2]].forEach(([x, z], i) => {
    const p = person(SKIN[(i * 3) % SKIN.length]); C.add(p, x0 + x, z0 + z, Math.atan2(-x, -z) + (i > 5 ? Math.PI : 0));
  });
  C.add(person('#F4F1EA'), x0 + .8, z0 - 2.2, 0); // cook behind the counter
  C.steam(x0 - 2, 2.6, z0 - 1.2); // urn steam
  C.steam(x0 + 2.8, 1.6, z0 + 2.4);
}

// ===== shop row north-east, flats south =====
function shops(C) {
  const cols = ['#E07A5F', '#81B29A', '#F2CC8F', '#3D405B', '#E9C46A', '#B5838D', '#6D9DC5'];
  const boards = ['#F94144', '#277DA1', '#F9C74F', '#43AA8B', '#F3722C', '#90BE6D', '#577590'];
  for (let i = 0; i < 7; i++) {
    const h = 6 + (i % 2) * 1.2, s = grp(building(8, h, 8, cols[i], 'shop', true, '#8E8270'));
    s.add(box(8.2, 1.1, .25, glow(boards[i], .9), 0, 3.4, 4.1));
    s.add(box(7, 2.6, .1, glow('#FFE2B0', .6), 0, .2, 4.06));
    C.add(s, 36 + i * 9, -14.6);
  }
  for (let i = 0; i < 5; i++) { const h = 9 + (i % 3) * 4; C.add(building(10, h, 10, ['#D9C7A8', '#C7D3C9', '#E3B9A0'][i % 3], 'res', true, '#8E8270'), 72 + i * 12, 22 + (i % 2) * 4); }
  for (let i = 0; i < 4; i++) { const h = 8 + (i % 2) * 4; C.add(building(10, h, 10, ['#E3B9A0', '#C7D3C9'][i % 2], 'res', true, '#8E8270'), 8 + i * 12, -34 - (i % 2) * 2); }
  C.crowd([[40, -11], [47, -11.4], [60, -11.2], [-4, 9.4], [10, 9.8], [70, -11], [-40, 9.6], [28, 10]]);
}

function skyline(C) {
  [[-110, -70, 18, 18], [-80, -100, 14, 16], [110, -70, 16, 20], [130, -40, 18, 16], [-10, -105, 14, 12], [-40, -110, 12, 14], [120, -120, 20, 22], [-140, -40, 16, 18], [96, -100, 14, 14]].forEach(([x, z, w, h]) =>
    C.add(building(w, h, w, '#8C8C96', 'office', true, '#5A5A64'), x, z));
}
