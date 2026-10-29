// Seattle & Bellevue — rain, overcast. Space Needle, Mount Rainier, Pike Place Market, monorail, Bellevue towers, ferry.
import { newCity } from '../kit/city.js';
import { addOSM } from '../kit/osm.js';
import seattleOSM from '../data/osm/seattle.json';
import { THREE, V, mat, glow, mesh, box, cyl, cone, ball, lathe, tube, grp, building, sign, fir, car, realCar, person, SKIN, streetLight, rnd, reseed } from '../kit/kit.js';
import { Sound } from '../core/sound.js';

const WHITE = '#ECEBE6';

function spaceNeedle() {
  const g = grp();
  const leg = mat(WHITE, { roughness: .6 });
  g.add(cyl(9, 9.6, .6, '#9AA0A3', 0, 0, 0, 24)); // plinth
  // three leg pairs: pinch at the waist, flare to the top house
  for (let i = 0; i < 3; i++) for (const off of [-.16, .16]) {
    const a = i * Math.PI * 2 / 3 + off;
    const pts = [[7.2, .4], [4.4, 9], [1.7, 21], [2, 30], [3.4, 40], [4.4, 45.4]].map(([r, y]) => [Math.cos(a) * r, y, Math.sin(a) * r]);
    g.add(tube(pts, .42, leg, 24));
  }
  g.add(cyl(1.05, 1.25, 46, '#D9D7D0', 0, 0, 0, 10)); // elevator core
  const ring = mesh(new THREE.TorusGeometry(2.4, .28, 6, 20), leg, 0, 14.5, 0); ring.rotation.x = Math.PI / 2; g.add(ring); // waist ring
  // flying-saucer top house
  g.add(lathe([[0, 44.6], [4.4, 45.2], [8.6, 47.4], [9.6, 48.2], [9.6, 48.6], [8.4, 48.8], [8.4, 50.6], [9.2, 50.8], [7, 52.2], [3.2, 53.4], [1.2, 54], [0, 54]], mat(WHITE, { roughness: .5 }), 32));
  g.add(cyl(8.45, 8.45, 1.6, mat('#3B4A55', { roughness: .2, metalness: .4 }), 0, 48.9, 0, 32)); // restaurant glass band
  const halo = mesh(new THREE.TorusGeometry(10.6, .32, 6, 40), leg, 0, 47.6, 0); halo.rotation.x = Math.PI / 2; g.add(halo); // halo ring
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const s = box(2.2, .25, .3, leg, Math.cos(a) * 9.6, 47.4, Math.sin(a) * 9.6); s.rotation.y = -a; g.add(s); }
  g.add(cyl(.55, .9, 5, '#D9D7D0', 0, 54, 0, 8)); // spire
  g.add(cyl(.12, .45, 9, '#C8C6BE', 0, 59, 0, 6));
  g.add(ball(.35, glow('#FF5040', 2), 0, 68.2, 0, 0));
  return g;
}

function rainier() {
  const far = mat('#8A98A4', { fog: false, roughness: 1 });
  const snow = mat('#E8EDF1', { fog: false, roughness: 1 });
  const g = grp(cone(210, 105, far, 0, 0, 0, 11), cone(95.4, 49, snow, 0, 57.4, 0, 11), cone(140, 62, far, -150, 0, 30, 9), cone(130, 48, far, 170, 0, 40, 9));
  g.add(cone(30, 15, snow, -150, 47.2, 30, 9));
  g.children.forEach(c => { c.castShadow = false; c.receiveShadow = false; });
  return g;
}

function market() {
  const g = grp(building(20, 7, 10, '#C8B597', 'shop', false, '#6E5E4E'));
  g.add(box(20.6, .5, 10.6, '#7A2E24', 0, 7)); // roof trim
  g.add(box(20, .25, 2.4, '#8C2A22', 0, 3.4, 6.1)); // awning
  [-9, -3, 3, 9].forEach(x => g.add(cyl(.12, .12, 3.4, '#3A2E26', x, 0, 7.1, 6)));
  const prod = ['#D8432E', '#F2A93B', '#7BB342', '#E8D24A', '#9C3D8F'];
  for (let i = 0; i < 8; i++) g.add(box(1.8, .6, 1.2, prod[i % 5], -8.4 + i * 2.4, .7, 6.3));
  for (let i = 0; i < 8; i++) g.add(box(1.9, .7, 1.3, '#6B4A2B', -8.4 + i * 2.4, 0, 6.3));
  // the red rooftop sign on posts + clock
  const sg = sign('PUBLIC MARKET CENTER', 15, 2.2, { bg: '#20181A', fg: '#FF3B2F', glow: true, font: '800 66px "Big Shoulders Display", "Arial Narrow", sans-serif', w: 1024, h: 150 });
  sg.position.set(1.5, 9.6, 2.2); g.add(sg);
  g.add(box(15.4, 2.5, .2, '#2A2224', 1.5, 8.35, 2.05));
  [-5.5, 8.5].forEach(x => g.add(box(.25, 2.2, .25, '#2A2224', x, 7.3, 2)));
  const face = cyl(1.5, 1.5, .25, glow('#F4EEDC', .9), -7.4, 0, 0, 24); face.rotation.x = Math.PI / 2; face.position.set(-7.4, 10.4, 2.2); g.add(face);
  const rim = mesh(new THREE.TorusGeometry(1.55, .14, 6, 24), glow('#FF3B2F', 1.6), -7.4, 10.4, 2.36); g.add(rim);
  const h1 = box(.12, 1, .06, '#111', -7.4, 10.4, 2.4), h2 = box(.12, .75, .06, '#111', -7.4, 10.4, 2.4); h1.geometry.translate(0, .5 - .5, 0);
  h1.rotation.z = -.9; h2.rotation.z = 1.6; g.add(h1, h2);
  g.add(box(.25, 2.4, .25, '#2A2224', -7.4, 7.3, 2));
  return g;
}

function monorailCar() {
  const body = mat('#C9CED3', { roughness: .4, metalness: .3 });
  const g = grp(box(9, 2.4, 2.8, body, 0, -.7), box(9.02, .7, 2.82, '#2E5FA8', 0, -.7), box(9.02, .25, 2.82, '#C0392B', 0, 0), box(8.4, .7, 2.84, '#2A3440', 0, .55));
  const nose = mesh(new THREE.SphereGeometry(1.4, 12, 8, 0, Math.PI), body, 4.5, .5, 0); nose.rotation.y = Math.PI / 2; nose.scale.set(1, 1, .9); g.add(nose);
  return g;
}

function ferry() {
  const g = grp(box(30, 2.2, 7, '#F2F2EE', 0, 0), box(30.1, .7, 7.1, '#1E6B45', 0, 1.2), box(24, 2.4, 6.2, '#F4F4F0', 0, 2.2), box(24.1, .6, 6.3, '#1E6B45', 0, 3.6), box(14, 1.8, 5.4, '#F4F4F0', 0, 4.6), box(4, 1.2, 4.6, '#2B3B44', 0, 6.4));
  g.add(cyl(.6, .7, 3, '#1E6B45', 3, 6.4, 0, 8), cyl(.62, .62, .5, '#111', 3, 9.2, 0, 8));
  const hull = mesh(new THREE.CylinderGeometry(3.5, 3.5, 1, 3), mat('#F2F2EE')); hull.scale.set(1.2, 2.2, 1); hull.rotation.set(0, 0, Math.PI / 2); hull.position.set(16, 1.1, 0); g.add(hull);
  return g;
}

function umbrellaPerson(c) {
  const p = person(SKIN[Math.floor(rnd() * SKIN.length)]);
  p.add(cyl(.03, .03, 1.1, '#222', .25, 1.5, 0, 4), cone(1, .5, c, .25, 2.55, 0, 8));
  return p;
}

export function build() {
  reseed(47);
  const C = newCity({ top: '#5F6C7A', hor: '#A9B5BE', bot: '#4B5560', fog: '#98A4AE', fn: 40, ff: 215, sun: '#DDE6EE', si: .6, sunPos: [20, 60, 30], hs: '#C2CCD6', hg: '#3E4A44', hi: .95, ground: '#3E5C45', yaw: -.35, night: false, bloom: .15, sound: 'seattle' });
  // the hero landmarks are tall: a lower, slightly raised orbit shows the Needle and Rainier
  C.pitch = .14; C.dist = 76; C.target = V(0, 10, 0);

  // street — wet, dark and reflective in the rain
  C.road(0, 0, 240, 12, 0, { color: '#23272D', rough: .12, walk: 3, walkColor: '#7C8389' });
  for (let i = 0; i < 9; i++) { C.add(streetLight(false), -56 + i * 14, -9.6, 0); C.add(streetLight(false), -49 + i * 14, 9.6, Math.PI); }
  // loop around the Bellevue towers: a tower-front road joined to the main street at both ends
  const RO = { color: '#23272D', rough: .12, dash: false, walk: 2, walkColor: '#7C8389' };
  [C.road(0, -40, 150, 8, 0, RO), C.road(8, -20, 40, 8, Math.PI / 2, RO), C.road(112, -20, 40, 8, Math.PI / 2, RO)].forEach(r => { r.position.y = .045; });
  // puddles: glossy sheets that catch the streetlights
  const puddleM = mat('#1A2026', { flatShading: false, roughness: .05, metalness: .6 });
  for (let i = 0; i < 10; i++) { const p = new THREE.Mesh(new THREE.CircleGeometry(1.2 + rnd() * 1.6, 16), puddleM); p.rotation.x = -Math.PI / 2; p.scale.x = 1.8; p.position.set(-100 + rnd() * 200, .08, (rnd() - .5) * 9); C.add(p); }

  // water: Elliott Bay / the lake beyond the towers, with a ferry
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 220), mat('#5E7686', { flatShading: false, roughness: .15, metalness: .25 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, .14, -214); water.receiveShadow = true; C.add(water);
  C.add(box(700, .5, 3, '#7E878C', 0, 0, -104)); // seawall
  const fr = ferry(); C.add(fr, -60, -116); C.movers.push({ v: fr, dir: 1, speed: 2.2, len: 360 });
  // the floating bridge across the lake (SR-520 style): a low deck resting on pontoons
  const fb = grp(), FBL = 150;
  fb.add(box(9, 1.1, FBL, '#54606A', 0, .55, 0), box(9.2, .28, FBL, '#CFCFCF', 0, 1.1, 0), box(.2, .06, FBL, '#F2F2F2', 0, 1.26, 0));
  for (let z = -FBL / 2 + 6; z < FBL / 2; z += 12) fb.add(box(12, 1.5, 7, '#6A7680', 0, -.35, z));
  [-4.5, 4.5].forEach(x => fb.add(box(.2, .7, FBL, '#8A949C', x, 1.1, 0)));
  fb.userData.noCollide = true; C.add(fb, 92, -156);

  C.add(rainier(), 30, -450);
  // ferry horn: a deep foghorn sounds now and then, with a puff of steam from the funnel
  const puff = ball(1, mat('#F2F2F2', { transparent: true, opacity: 0, flatShading: false }), 3, 8.6, 0, 1); puff.castShadow = false; fr.add(puff);
  let fh = 7, pk;
  C.tick.push((t, dt) => {
    fh -= dt;
    if (fh <= 0) { fh = 16 + rnd() * 8; pk = 0; if (Sound.on && Sound.ctx) { Sound.voice('sawtooth', 92, 0, 2.2, .08, ['lowpass', 520]); Sound.voice('sawtooth', 70, .06, 2.4, .06, ['lowpass', 520]); } }
    if (pk !== undefined) { pk += dt / 2.6; puff.material.opacity = Math.max(0, .5 * (1 - pk)); puff.scale.setScalar(1 + pk * 2.4); puff.position.y = 8.6 + pk * 3.4; if (pk >= 1) pk = undefined; }
  });

  // Space Needle (Seattle Center) with lawn
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(16, 24), mat('#4F7A4C', { flatShading: false })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(-22, .05, -80); C.add(lawn);
  C.add(spaceNeedle(), -22, -80);

  // Pike Place Market
  C.add(market(), -6, -21);

  // monorail: beam on pylons from downtown, curving up to the Needle
  const path = [[110, 8, -12], [40, 8, -12], [-6, 8, -12], [-18, 8, -14.5], [-23.5, 8, -22], [-25, 8, -36], [-22, 8, -50], [-20, 8, -62]];
  const curve = new THREE.CatmullRomCurve3(path.map(p => V(...p)));
  C.add(tube(path, .6, mat('#BDBAB2'), 120));
  for (let u = 0; u <= 1.0001; u += 1 / 14) { const p = curve.getPointAt(u); C.add(grp(cyl(.45, .6, 7.4, '#AFACA4', 0, 0, 0, 8), box(1.6, .5, 1.4, '#AFACA4', 0, 7))).position.set(p.x, 0, p.z); }
  const cars = [monorailCar(), monorailCar(), monorailCar()];
  cars.forEach(c => C.add(c));
  cars[2].children[cars[2].children.length - 1].rotation.y = -Math.PI / 2; cars[2].children[cars[2].children.length - 1].position.x = -4.5;
  const L = curve.getLength();
  C.tick.push(t => {
    const ph = (t * 7 / (L - 30) + .6) % 2, s = ph < 1 ? ph : 2 - ph; // ping-pong
    const e = s * s * (3 - 2 * s), u0 = .02 + e * (1 - 30 / L);
    cars.forEach((c, i) => {
      const u = Math.min(1, u0 + (9.4 * (2 - i)) / L), p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      c.position.set(p.x, p.y, p.z); c.rotation.y = Math.atan2(-tg.z, tg.x);
    });
  });

  // Bellevue downtown glass towers
  const T = [[30, -46, 14, 14, 60, '#6E98B2'], [50, -60, 16, 14, 72, '#86AAC0'], [66, -44, 12, 12, 46, '#5F8AA6'], [84, -64, 18, 14, 58, '#94B4C8'], [16, -66, 12, 12, 36, '#A3BED0'], [100, -46, 14, 12, 36, '#7A9EB6'], [-66, -56, 12, 12, 28, '#8FA6B4']];
  const bands = [], bandMat = glow('#7FE0D2', 3); bandMat.transparent = true;
  T.forEach(([x, z, w, d, h, c], i) => {
    const b = grp(building(w, h, d, c, 'glass', false, '#5E6870'));
    if (i === 0) { b.add(building(w * .7, 8, d * .7, '#5E8FAE', 'glass', false, '#4A5560')); b.children[1].position.y = h + 4; b.add(box(w * .72, .5, d * .72, glow('#7FE0D2', 1.2), 0, h + 8)); }
    else if (i === 1) { const cr = mesh(new THREE.CylinderGeometry(0, w * .62, 10, 4), mat('#7C98A8', { roughness: .3, metalness: .3 }), 0, h + 5, 0); cr.rotation.y = Math.PI / 4; b.add(cr); }
    else b.add(box(w * .5, 3, d * .5, '#5E6870', 0, h));
    const band = box(w + .5, 1.4, d + .5, bandMat, 0, 0); band.castShadow = false; band.visible = false; b.add(band); bands.push({ band, h, i });
    C.add(b, x, z);
  });
  towerPulse(C, bands, bandMat);
  redactBoard(C);
  // plaza in front of the towers
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(64, 12), mat('#8C9296', { flatShading: false, roughness: .4 })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(50, .05, -30); C.add(plaza);

  // 2: research desk pavilion (open-front glass office with a lit desk)
  const pav = grp(box(12, .3, 8, '#5C6268'), box(12, .4, 8.4, '#4A5056', 0, 4.8), box(.3, 4.5, 8, '#3A4048', -5.85, .3), box(.3, 4.5, 8, '#3A4048', 5.85, .3), box(12, 4.5, .2, '#3A4048', 0, .3, -3.9));
  pav.add(mesh(new THREE.BoxGeometry(11.4, 4.4, .08), mat('#A8C4D4', { transparent: true, opacity: .35, roughness: .1 }), 0, 2.5, 3.9));
  pav.add(box(5, .12, 1.6, '#D9D2C4', 0, 1.3, -1), box(.15, 1.3, 1.4, '#555', -2.3, .3, -1), box(.15, 1.3, 1.4, '#555', 2.3, .3, -1));
  [-1.5, 0, 1.5].forEach(x => pav.add(box(1.1, .7, .06, glow('#9FD3FF', 1.1), x, 1.75, -1.5)));
  const r1 = person('#3A86FF'); r1.position.set(-.8, 0, .2); r1.rotation.y = Math.PI; pav.add(r1);
  C.add(pav, 34, -20);

  // 3: terrace building (two agents arguing at a rooftop table)
  const ter = grp(building(14, 12, 9, '#8DA9B8', 'glass', false, '#6A747C'), box(14.2, .3, 9.2, '#9A8B76', 0, 12));
  for (let i = 0; i < 8; i++) ter.add(box(.08, 1, .08, '#2B2B2B', -7 + i * 2, 12.3, 4.5));
  ter.add(box(14, .08, .08, '#2B2B2B', 0, 13.3, 4.5), box(1.2, .9, .9, '#6B4A2B', -5.6, 12.3, -3.6), box(1.2, .9, .9, '#6B4A2B', 5.6, 12.3, -3.6));
  ter.add(fir(.45), cyl(.7, .7, .1, '#E9E2D2', 0, 13.2, 0), cyl(.08, .08, .9, '#333', 0, 12.3, 0, 6), cyl(.04, .04, 2.8, '#333', 0, 13.3, 0, 4), cone(2.2, .8, '#C0392B', 0, 15.6, 0, 8));
  ter.children[ter.children.length - 5].position.set(-5.6, 13.2, -3.6);
  const a1 = person('#E76F51'), a2 = person('#2A9D8F'); a1.position.set(-1.3, 12.3, 0); a1.rotation.y = Math.PI / 2; a2.position.set(1.3, 12.3, 0); a2.rotation.y = -Math.PI / 2; ter.add(a1, a2);
  C.tick.push(t => { a1.rotation.z = Math.sin(t * 3) * .06; a2.rotation.z = Math.sin(t * 3 + 1.5) * .06; });
  C.add(ter, 58, -19);

  // coffee shop (south side), with outdoor seating and steam
  const cof = grp(building(12, 6, 9, '#5B4A3F', 'shop', false, '#3E332B'), box(12.4, .5, 9.4, '#2E5E45', 0, 6), box(12, .2, 2.2, '#2E5E45', 0, 3.2, -5.4));
  const cs1 = sign('COFFEE', 6, 1.3, { bg: '#2E5E45', fg: '#F4EEDC' }); cs1.position.set(0, 4.4, -4.62); cs1.rotation.y = Math.PI; cof.add(cs1);
  const cs2 = sign('COFFEE', 6, 1.3, { bg: '#2E5E45', fg: '#F4EEDC' }); cs2.position.set(0, 4.4, 4.62); cof.add(cs2);
  [[7.8, -2], [7.8, 2]].forEach(([x, z]) => cof.add(cyl(.6, .6, .08, '#E9E2D2', x, .9, z), cyl(.06, .06, .9, '#333', x, 0, z, 6), cyl(.04, .04, 2.6, '#333', x, .9, z, 4), cone(1.6, .6, '#2E5E45', x, 3.3, z, 8)));
  cof.add(cyl(.5, .4, .9, '#E9E2D2', -4, 6.5, 2, 10));
  C.add(cof, -34, 22);
  C.steam(-38, 7.4, 24);

  // 4: badminton court
  const court = grp(box(14.4, .1, 7.2, '#3F7F55'));
  [[0, 3.5, 14.4, .1], [0, -3.5, 14.4, .1], [0, 3.0, 14.4, .06], [0, -3.0, 14.4, .06], [0, 0, .06, 7.2]].forEach(([x, z, w, d]) => court.add(box(w, .02, d, '#F4F4F4', x, .1, z)));
  [7.15, -7.15, 2.1, -2.1, 6.4, -6.4].forEach(x => court.add(box(.08, .02, 7.2, '#F4F4F4', x, .1, 0)));
  court.add(cyl(.05, .05, 1.55, '#DDD', 0, 0, 3.7, 6), cyl(.05, .05, 1.55, '#DDD', 0, 0, -3.7, 6), mesh(new THREE.BoxGeometry(.02, .76, 7.4), mat('#F4F4F4', { transparent: true, opacity: .6 }), 0, 1.17, 0));
  court.children[court.children.length - 1].rotation.y = Math.PI / 2; court.children[court.children.length - 1].rotation.y = 0;
  // net is along z, players face each other along x
  const p1 = person('#F2C14E'), p2 = person('#3A86FF'); p1.position.set(-4.2, .1, .8); p1.rotation.y = 0; p2.position.set(4.2, .1, -.8); p2.rotation.y = Math.PI;
  [p1, p2].forEach(p => p.add(cyl(.03, .03, .9, '#222', .3, 1.4, 0, 4)));
  const sh = ball(.12, '#FFFFFF', 0, 2, 0, 0); court.add(p1, p2, sh);
  C.tick.push(t => { const k = (t * .55) % 2, s = k < 1 ? k : 2 - k; sh.position.set(-3.8 + s * 7.6, 2.2 + Math.sin(s * Math.PI) * 3, .8 - s * 1.6); });
  for (let i = 0; i < 9; i++) [5, -5].forEach(z => court.add(cyl(.05, .05, 3, '#4A5056', -8 + i * 2, 0, z, 4)));
  [5, -5].forEach(z => court.add(mesh(new THREE.BoxGeometry(16, 2.9, .03), mat('#6F7A80', { transparent: true, opacity: .25 }), 0, 1.5, z)));
  C.add(court, 16, 19);

  // fir trees
  const avoid = [[-22, -80, 18], [-66, -56, 10], [-6, -21, 13], [-34, 22, 10], [16, 19, 11], [34, -20, 9]];
  let n = 0;
  for (let i = 0; i < 160 && n < 44; i++) {
    const x = -100 + rnd() * 200, z = rnd() < .45 ? 13 + rnd() * 22 : -26 - rnd() * 64;
    if (z < -36 && x > 8 && x < 110) continue; // tower cluster
    if (z > -30 && z < -10 && x > -28 && x < 70) continue;
    if (avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue;
    C.add(fir(1 + rnd() * .7), x, z); n++;
  }
  [-60, -40, -24, 30, 46, 70].forEach(x => C.add(fir(.9), x, 11.6));

  // traffic both ways
  C.lane(() => realCar('sedan', ['#2C3E50', '#ECF0F1', '#7F8C8D', '#145A32', '#8E1B1B'][Math.floor(rnd() * 5)]), 2.2, 1, 9, 5, 220);
  C.lane(() => realCar('suv', ['#1B2631', '#D0D3D4', '#5D6D7E'][Math.floor(rnd() * 3)]), -2.2, -1, 9, 5, 220);
  const bs = grp(box(12, 2.8, 2.6, '#1F5F8B', 0, .5), box(12.02, .9, 2.62, '#2A3440', 0, 1.7)); [4, -4].forEach(x => [1.15, -1.15].forEach(z => { const w = cyl(.5, .5, .3, '#1E1E24'); w.rotation.x = Math.PI / 2; w.position.set(x, .5, z); bs.add(w); }));
  C.add(bs); bs.position.set(30, 0, -2.6); bs.rotation.y = Math.PI; C.movers.push({ v: bs, dir: -1, speed: 7, len: 220 });

  // people, many with umbrellas
  const uc = ['#1F2A44', '#C0392B', '#F2C14E', '#2A9D8F', '#222'];
  [[-24, -8.4], [-16, -8], [-2, -8.6], [8, -8.2], [22, -8.6], [40, -8.4], [-30, 8.4], [-6, 8.2], [4, 8.6], [28, 8.4], [36, 8], [-10, 11.2], [-9, 12.4]].forEach(([x, z], i) => C.add(i % 3 === 2 ? person(SKIN[i % SKIN.length]) : umbrellaPerson(uc[i % 5]), x, z, rnd() * 6));
  C.crowd([[30, -14], [36, -15], [-12, -14], [0, -14.4], [-21, 21], [-20, 22.6]]);

  C.particles('rain', 2600);
  C.hero(-22, 4.6, 0);

  C.spot(30, 32, -38.6); // 1 Centific
  C.spot(34, 6.5, -16); // 2 Catch the leak
  C.spot(58, 17, -16); // 3 Agents that argue
  C.spot(16, 4, 19); // 4 badminton court
  addOSM(C, seattleOSM, {
    handRoads: [{ z: 0, half: 10, halfX: 125 }],
    clearBoxes: [{ minX: -400, maxX: 400, minZ: -600, maxZ: -98 },  // Elliott Bay (hand-made water + seawall)
      { minX: -42, maxX: -2, minZ: -98, maxZ: -60 },                // Space Needle lawn
      { minX: 16, maxX: 84, minZ: -38, maxZ: -22 },                 // plaza in front of the Bellevue towers
      { minX: -78, maxX: 78, minZ: -45, maxZ: -35 },                // tower-front loop road
      { minX: 2, maxX: 14, minZ: -44, maxZ: 4 },                     // west cross
      { minX: 106, maxX: 118, minZ: -44, maxZ: 4 }],                 // east cross
  });
  // invisible walls: keep the car on the streets, off the lawn and out of Elliott Bay
  (C.colliders ||= []).push(
    { minX: -122, maxX: 122, minZ: -54, maxZ: -46 },  // north (waterfront side)
    { minX: -122, maxX: 122, minZ: 42, maxZ: 50 },    // south
    { minX: -122, maxX: -112, minZ: -54, maxZ: 50 },  // west
    { minX: 112, maxX: 122, minZ: -54, maxZ: 50 },    // east
  );
  C.driveRadius = 155;
  C.credit = 'Streets & buildings: © OpenStreetMap contributors';
  return C;
}

// ===== World reaction: 'agents:verdict' — a ring of light climbs the Bellevue towers, twice =====
function towerPulse(C, bands, m) {
  let cancel = null;
  C.on('agents:verdict', () => {
    if (cancel) cancel();
    cancel = C.anim(3.6, (p, el) => {
      bands.forEach(({ band, h, i }) => {
        const q = ((el - i * .12) / 1.5) % 1, on = el > i * .12 && p < 1;
        band.visible = on; band.position.y = q * h; m.opacity = 1;
        band.scale.y = 1 + (1 - Math.abs(q - .5) * 2) * 2;
      });
    }, () => { bands.forEach(b => { b.band.visible = false; }); cancel = null; });
  });
}

// ===== World reaction: 'pii:redacted' — a roadside screen shows a SYNTHETIC record; black bars slide over the personal details =====
function redactBoard(C) {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 340; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const rows = [['Name', 'Priya Raman'], ['Phone', '+1 425 555 0142'], ['Email', 'p.raman@example.com'], ['Card', '4111 1111 1111 1111'], ['Address', '12 Pine St, Bellevue']];
  const F = '700 30px "Courier New", monospace';
  const draw = (prog, count) => {
    g.fillStyle = '#0D1B24'; g.fillRect(0, 0, 640, 340);
    g.fillStyle = '#9FD3FF'; g.font = '800 28px "Big Shoulders Display", "Arial Narrow", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('SAMPLE RECORD (SYNTHETIC, NOT REAL DATA)', 24, 34);
    g.font = F;
    rows.forEach(([k, v], i) => {
      const y = 92 + i * 46; g.fillStyle = '#7F95A6'; g.fillText(k + ':', 24, y); const x0 = 180; g.fillStyle = '#F1F5F8'; g.fillText(v, x0, y);
      const w = g.measureText(v).width + 14, q = Math.min(1, Math.max(0, prog * (rows.length + 1.2) - i * 1));
      if (q > 0) { g.fillStyle = '#000'; g.fillRect(x0 - 7, y - 20, w * q, 40); g.fillStyle = '#FF3B2F'; g.fillRect(x0 - 7 + w * q - 3, y - 20, 3, 40); }
    });
    if (prog >= 1) { g.fillStyle = '#FF3B2F'; g.font = '800 30px "Big Shoulders Display", "Arial Narrow", sans-serif'; g.fillText(`${count ?? rows.length} SPANS REDACTED`, 24, 322); }
    tex.needsUpdate = true;
  };
  draw(0);
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1, roughness: .5 });
  const B = grp(cyl(.18, .22, 6, '#3A3D45', -4.4, 0, 0, 8), cyl(.18, .22, 6, '#3A3D45', 4.4, 0, 0, 8), box(10.2, 5.6, .5, '#1B2127', 0, 3.6));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 5.1), m); scr.position.set(0, 6.4, .27); B.add(scr);
  B.add(box(10.2, .25, .7, glow('#7FE0D2', 1.6), 0, 9.3, 0));
  C.add(B, 46, -12);
  let cancel = null;
  C.on('pii:redacted', d => {
    if (cancel) cancel();
    cancel = C.anim(2.6, p => draw(p, d && d.count), () => { cancel = null; });
  });
}
