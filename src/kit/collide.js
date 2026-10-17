// 2D (XZ-plane) collision boxes for drive mode and for keeping OSM geometry out of hand-made areas.
// Box shape: { minX, maxX, minZ, maxZ }. 1 unit ≈ 1 m.
import { THREE } from './kit.js';

const _b = new THREE.Box3();

/**
 * Derive solid boxes from a city's meshes. Skips ground/road/sky/particles, traffic (C.movers),
 * anything flagged userData.noCollide (or under a parent flagged so), tiny or huge things.
 * Adds C.colliders (explicit boxes, e.g. OSM buildings) unless opts.explicit === false.
 */
export function autoColliders(C, opts = {}) {
  const minH = opts.minH ?? 1.2, maxSide = opts.maxSide ?? 70;
  const movers = new Set((C.movers || []).map(m => m.v));
  const out = [];
  C.scene.updateMatrixWorld(true);
  const walk = (o, skip) => {
    if (skip || o.userData?.noCollide || movers.has(o) || o.isPoints || o.isLineSegments || o.isLine || o.isSprite) skip = true;
    if (!skip && o.isMesh && o.geometry) {
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      _b.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
      const w = _b.max.x - _b.min.x, d = _b.max.z - _b.min.z, h = _b.max.y - _b.min.y;
      // ground discs, roads, sky dome and flat decals have tiny height or huge footprint
      if (h > minH && _b.max.y > 1 && w < maxSide && d < maxSide && w > .15 && d > .15 && _b.min.y < 4)
        out.push({ minX: _b.min.x, maxX: _b.max.x, minZ: _b.min.z, maxZ: _b.max.z });
    }
    o.children.forEach(c => walk(c, skip));
  };
  walk(C.scene, false);
  if (opts.explicit !== false && C.colliders) out.push(...C.colliders);
  return out;
}

/** Uniform grid hash over boxes. query(x, z, r) → boxes whose cell range touches the circle's bounds. */
export function makeGrid(boxes, cell = 8) {
  const m = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
  boxes.forEach(b => {
    for (let i = Math.floor(b.minX / cell); i <= Math.floor(b.maxX / cell); i++)
      for (let j = Math.floor(b.minZ / cell); j <= Math.floor(b.maxZ / cell); j++) {
        const k = key(i, j); if (!m.has(k)) m.set(k, []); m.get(k).push(b);
      }
  });
  return {
    boxes,
    query(x, z, r = 0) {
      const res = new Set();
      for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++)
        for (let j = Math.floor((z - r) / cell); j <= Math.floor((z + r) / cell); j++) m.get(key(i, j))?.forEach(b => res.add(b));
      return res;
    },
  };
}

/** True if box a overlaps box b grown by margin. */
export const overlaps = (a, b, margin = 0) => a.minX < b.maxX + margin && a.maxX > b.minX - margin && a.minZ < b.maxZ + margin && a.maxZ > b.minZ - margin;

/**
 * Push a circle (x, z, r) out of any boxes it overlaps. Returns { x, z, hit, nx, nz } where (nx, nz) is the
 * last push normal, so the caller can remove velocity into the wall.
 */
export function resolveCircle(grid, x, z, r) {
  let hit = false, nx = 0, nz = 0;
  for (const b of grid.query(x, z, r)) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    let dx = x - cx, dz = z - cz; const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), p = r - d; dx /= d; dz /= d; x += dx * p; z += dz * p; nx = dx; nz = dz; }
    else { // centre inside the box: leave by the nearest side
      const o = [[x - b.minX + r, -1, 0], [b.maxX - x + r, 1, 0], [z - b.minZ + r, 0, -1], [b.maxZ - z + r, 0, 1]].sort((p, q) => p[0] - q[0])[0];
      x += o[1] * o[0]; z += o[2] * o[0]; nx = o[1]; nz = o[2];
    }
  }
  return { x, z, hit, nx, nz };
}
