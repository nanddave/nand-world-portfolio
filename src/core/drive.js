// Drive mode: arcade car physics, XZ collisions (src/kit/collide.js), chase camera and spot proximity.
// createDrive({cam, reduce}) → D. Cityview calls D.update() each frame while D.active and owns marker projection.
import { THREE, V, clamp } from '../kit/kit.js';
import { autoColliders, makeGrid, resolveCircle } from '../kit/collide.js';
import { Sound } from './sound.js';

const MAXF = 16, MAXR = MAXF / 3, R = 1.6, NEAR = 12, ACC = 11;
const baseFov = () => innerWidth < 700 ? 55 : 40;

export function createDrive({ cam, reduce = false }) {
  const D = {
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
    /** dt seconds; paused = a card is open (input ignored, car coasts to a stop). Returns { speed, nearSpot }. */
    update(dt, paused = false) {
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
      D.x = x; D.z = z; D.speed = sp; D.sync();
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
      D.pos.set(x - fx * 9, 4.2, z - fz * 9); cam.position.lerp(D.pos, k);
      D.look.lerp(V(x + fx * 6, 1.2, z + fz * 6), k);
      if (D.shake > .002 && !reduce) { cam.position.x += (Math.random() - .5) * D.shake; cam.position.y += (Math.random() - .5) * D.shake; D.shake *= Math.exp(-dt * 9); } else D.shake = 0;
      cam.lookAt(D.look);
      const fov = baseFov() + (reduce ? 0 : 6 * f); if (Math.abs(cam.fov - fov) > .05) { cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 5)); cam.updateProjectionMatrix(); }
      return { speed: sp, nearSpot: near };
    },
  };
  return D;
}
