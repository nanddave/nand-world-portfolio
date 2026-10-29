// Drive mode: arcade car physics, XZ collisions (src/kit/collide.js), chase camera and spot proximity.
// createDrive({cam, reduce}) → D. Cityview calls D.update() each frame while D.active and owns marker projection.
import { THREE, V, clamp } from '../kit/kit.js';
import { autoColliders, makeGrid, resolveCircle } from '../kit/collide.js';
import { Sound } from './sound.js';

const MAXF0 = 16, R = 1.6, NEAR = 12, ACC0 = 11;
let camRef = null;
const baseFov = () => camRef?.userData.baseFov ?? (innerWidth < 700 ? 55 : 40);

export function createDrive({ cam, reduce = false }) {
  camRef = cam;
  const D = {
    // trailer hooks: top-speed/accel multiplier and a chase-camera override { back, up, ahead }
    boost: 1, chase: null,
    active: false, C: null, car: null, x: 0, z: 0, h: 0, speed: 0, nearSpot: -1, hits: 0, shake: 0, _cool: 0,
    input: { throttle: 0, steer: 0, brake: false }, look: V(), pos: V(),
    /** Take over C.heroCar (spawning one if absent), build colliders once, start the chase camera. */
    enter(C) {
      const car = C.heroCar || C.hero(0, 4); car.userData.noCollide = true;
      if (!C._grid) C._grid = makeGrid(autoColliders(C), 8);
      D.C = C; D.car = car; D.x = car.position.x; D.z = car.position.z; D.h = car.rotation.y; D.speed = 0;
      if (!C._spawn) {
        for (let i = 0; i < 8; i++) { const r = resolveCircle(C._grid, D.x, D.z, R); if (!r.hit) break; D.x = r.x; D.z = r.z; }
        C._spawn = { x: D.x, z: D.z, h: D.h };
      }
      D.sync(); D.active = true; D.nearSpot = -1;
      D.pos.set(D.x, 0, D.z); D.look.copy(D.pos);
    },
    /** Put the car back at its spawn pose (called when the city is shown again). */
    reset(C) {
      D.active = false; const s = C._spawn, car = C.heroCar; if (!s || !car) return;
      car.position.x = s.x; car.position.z = s.z; car.rotation.y = s.h; D.speed = 0;
    },
    exit() {
      if (!D.active) return; D.active = false; D.speed = 0; D.nearSpot = -1; D.input.throttle = D.input.steer = 0; D.input.brake = false;
      cam.fov = baseFov(); cam.updateProjectionMatrix();
    },
    sync() { D.car.position.x = D.x; D.car.position.z = D.z; D.car.rotation.y = D.h; },
    /** dt seconds; paused stops movement immediately. Returns { speed, nearSpot }. */
    update(dt, paused = false) {
      if (paused) { D.speed = 0; return { speed: 0, nearSpot: D.nearSpot }; }
      const MAXF = MAXF0 * D.boost, MAXR = MAXF0 / 3, ACC = ACC0 * D.boost;
      const C = D.C, car = D.car, inp = paused ? { throttle: 0, steer: 0, brake: true } : D.input;
      let sp = D.speed;
      const th = clamp(inp.throttle, -1, 1);
      if (inp.brake) sp -= Math.sign(sp) * Math.min(Math.abs(sp), 26 * dt);
      else if (th > 0) sp += th * (sp < 0 ? ACC * 2.2 : ACC * (1 - Math.max(0, sp) / (MAXF * 1.15))) * dt;
      else if (th < 0) sp += th * (sp > 0 ? ACC * 2.2 : ACC * .7) * dt;
      else sp *= Math.exp(-dt * .85);
      sp = clamp(sp, -MAXR, MAXF); if (Math.abs(sp) < .05 && !th) sp = 0;
      const steerGain = Math.min(1, Math.abs(sp) / 4) * (1 - .35 * Math.abs(sp) / MAXF);
      D.h += clamp(inp.steer, -1, 1) * 1.9 * steerGain * Math.sign(sp) * dt;
      const fx = Math.cos(D.h), fz = -Math.sin(D.h);
      let x = D.x + fx * sp * dt, z = D.z + fz * sp * dt;
      // walls: push out of boxes, then drop the speed component that pointed into the wall
      const r = resolveCircle(C._grid, x, z, R); let impact = 0;
      if (r.hit) { x = r.x; z = r.z; const vn = sp * (fx * r.nx + fz * r.nz); if (vn < 0) { impact = -vn; sp -= vn * (fx * r.nx + fz * r.nz); } }
      // soft world edge
      const lim = C.driveRadius ?? 140, d = Math.hypot(x, z);
      if (d > lim) { const nx = -x / d, nz = -z / d, vn = sp * (fx * nx + fz * nz); x = -nx * lim; z = -nz * lim; if (vn < 0) { impact = Math.max(impact, -vn); sp -= vn * (fx * nx + fz * nz); } }
      D._cool -= dt;
      if (impact > 2.5 && D._cool <= 0) { D._cool = .35; D.hits++; D.shake = Math.min(.45, impact * .035); Sound.thud?.(Math.min(1, impact / 10)); }
      const yawRate = clamp(inp.steer, -1, 1) * 1.9 * steerGain * Math.sign(sp), accel = (sp - D.speed) / Math.max(dt, 1e-3);
      D.x = x; D.z = z; D.speed = sp; D.sync();
      feel(car, sp, yawRate, accel, clamp(inp.steer, -1, 1), dt, reduce);
      skids(C, car, Math.abs(sp) > 9 && Math.abs(inp.steer) > .6 || inp.brake && Math.abs(sp) > 6, x, z, fx, fz);
      bump(C, x, z, fx * sp, fz * sp);
      // spot proximity (XZ)
      let near = -1, best = NEAR * NEAR;
      // A spot on top of a big solid base (temple compound, hill) counts as near when the car is within 4 m of that base's edge.
      if (!C._spotBoxes) C._spotBoxes = C.spots.map(s => C._grid.boxes.filter(b => s.p.x > b.minX && s.p.x < b.maxX && s.p.z > b.minZ && s.p.z < b.maxZ));
      C.spots.forEach((s, k) => {
        let q = (s.p.x - x) ** 2 + (s.p.z - z) ** 2;
        for (const b of C._spotBoxes[k]) { const dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ); if (dx * dx + dz * dz < (R + 4) ** 2) q = Math.min(q, NEAR * NEAR * .99); }
        if (q < best) { best = q; near = k; }
      });
      D.nearSpot = near;
      // chase camera: 9 m behind, 4 m up, damped; look 6 m ahead; FOV kick with speed
      const k = 1 - Math.exp(-dt * (reduce ? 9 : 4)), f = Math.abs(sp) / MAXF;
      const ch = D.chase || { back: 9, up: 4.2, ahead: 6 };
      D.pos.set(x - fx * ch.back, ch.up, z - fz * ch.back); cam.position.lerp(D.pos, k);
      D.look.lerp(V(x + fx * ch.ahead, 1.2, z + fz * ch.ahead), k);
      if (D.shake > .002 && !reduce) { cam.position.x += (Math.random() - .5) * D.shake; cam.position.y += (Math.random() - .5) * D.shake; D.shake *= Math.exp(-dt * 9); } else D.shake = 0;
      cam.lookAt(D.look);
      const fov = baseFov() + (reduce ? 0 : 6 * f); if (Math.abs(cam.fov - fov) > .05) { cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 5)); cam.updateProjectionMatrix(); }
      return { speed: sp, nearSpot: near };
    },
  };
  return D;
}

// ---- driving feel: wheels spin and steer, the body leans into turns and dips under braking ----
function feel(car, sp, yawRate, accel, steer, dt, reduce) {
  const { wheels, body } = car.userData; if (!wheels) return;
  for (const w of wheels) { w.spin.rotation.z -= sp * dt / w.r; if (w.front) w.pivot.rotation.y = steer * .42; }
  if (!body || reduce) return;
  const k = 1 - Math.exp(-dt * 6);
  body.rotation.x += (clamp(sp * yawRate * .006, -.06, .06) - body.rotation.x) * k; // lean outward in a turn
  body.rotation.z += (clamp(accel * .004, -.045, .03) - body.rotation.z) * k;     // nose dips when braking, lifts when accelerating
}
// ---- skid marks: a recycled pool of dark strips dropped behind the rear wheels while sliding or braking hard ----
const _skidGeo = new THREE.PlaneGeometry(.5, .28), _skidMat = new THREE.MeshBasicMaterial({ color: '#141414', transparent: true, opacity: .45, depthWrite: false });
function skids(C, car, on, x, z, fx, fz) {
  if (!on) { C._skidLast = null; return; }
  const pool = C._skids || (C._skids = { list: [], i: 0 });
  if (C._skidLast && Math.hypot(x - C._skidLast.x, z - C._skidLast.z) < .3) return;
  C._skidLast = { x, z };
  const s = car.scale.x, back = -1.4 * s, side = .78 * s, sx = -fz, sz = fx;
  for (const sd of [1, -1]) {
    let m = pool.list[pool.i];
    if (!m) { m = new THREE.Mesh(_skidGeo, _skidMat); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; C.scene.add(m); pool.list[pool.i] = m; }
    m.position.set(x + fx * back + sx * sd * side, .07, z + fz * back + sz * sd * side); m.rotation.z = Math.atan2(fz, fx) * -1;
    pool.i = (pool.i + 1) % 240;
  }
}
// ---- props (C.props: [{ o, r }]) get knocked over and slide when the car hits them; the city ticks their motion ----
function bump(C, x, z, vx, vz) {
  if (!C.props) return;
  for (const p of C.props) {
    const dx = p.o.position.x - x, dz = p.o.position.z - z, d = Math.hypot(dx, dz);
    if (d > R + p.r || Math.hypot(vx, vz) < 1.5) continue;
    p.vx = vx * .7 + dx / (d || 1) * 2; p.vz = vz * .7 + dz / (d || 1) * 2; p.fall = 1; Sound.thud?.(.2);
  }
}
/** Advance knocked-over props: slide with friction and tip over. Call from the city's tick. */
export function tickProps(props, dt) {
  for (const p of props) {
    if (!p.fall) continue;
    p.o.position.x += p.vx * dt; p.o.position.z += p.vz * dt; const f = Math.exp(-dt * 2.5); p.vx *= f; p.vz *= f;
    p.o.rotation.y = Math.atan2(-p.vz, p.vx); p.o.rotation.z += (-(Math.PI / 2) - p.o.rotation.z) * Math.min(1, dt * 8);
  }
}
