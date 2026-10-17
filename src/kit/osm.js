// Renders baked OSM JSON (see tools/osm-bake.mjs, docs/PLAN.md 1.3 D) into a city: merged buildings, roads, green, water, a few trees.
// addOSM(C, data, opts) -> { counts }. opts:
//   clearRadius, clearBoxes:[{minX,maxX,minZ,maxZ}]  area kept free of OSM buildings, roads, green, water and trees (big hand-made landmarks, hand-made water/hills)
//   handRoads:[{z, half, halfX}]  hand-made roads (centre z, half-width incl. verges, half-length) that OSM must not overlap; default one road at z=0, half 8, halfX 130
//   roadStrip:{halfZ, halfX}  legacy shorthand for handRoads[0]
//   greenColor, treeColors:[3 hex], roofColor, roadColor  palette overrides (e.g. snow)
//   maxTrees:300
// Anything whose footprint/midpoint falls on a hand-made object (auto-derived colliders: height > 1.2 m, i.e. also raised hand-made hills and pedestals) is dropped instead of floating or sinking.
import { THREE, mat } from './kit.js';
import { autoColliders, overlaps } from './collide.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ROAD_W = [4, 6, 9, 12];
const WALLS = ['#D9C7A8', '#C7D3C9', '#E3B9A0', '#CFC3B0', '#B8B9B2', '#D8B48F', '#A9B4C2', '#E0CDB4'];

// ----- window tile: 4x4 cells, each cell ~3 m wide x 3.2 m tall; lit windows in the emissive map at night -----
function tiles(kind, night) {
  const W = 256, H = 256, N = 4, cw = W / N, ch = H / N;
  const a = document.createElement('canvas'); a.width = W; a.height = H; const g = a.getContext('2d');
  const e = document.createElement('canvas'); e.width = W; e.height = H; const ge = e.getContext('2d');
  g.fillStyle = 'rgb(232,232,232)'; g.fillRect(0, 0, W, H); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  let s = kind === 'office' ? 91 : 37; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const ww = kind === 'office' ? .62 : .42, wh = kind === 'office' ? .55 : .5;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const w = cw * ww, h = ch * wh, x = i * cw + (cw - w) / 2, y = j * ch + (ch - h) / 2, v = 78 + Math.floor(r() * 30);
    g.fillStyle = `rgb(${v},${v + 8},${v + 20})`; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(i * cw, (j + 1) * ch - 5, cw, 5); // floor slab line
    if (night && r() < .5) { ge.fillStyle = r() < .8 ? `rgb(255,${200 + Math.floor(r() * 40)},130)` : 'rgb(190,220,255)'; ge.fillRect(x, y, w, h); }
  }
  const t1 = new THREE.CanvasTexture(a), t2 = new THREE.CanvasTexture(e);
  [t1, t2].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; });
  t1.colorSpace = THREE.SRGBColorSpace; t2.colorSpace = THREE.SRGBColorSpace;
  return { map: t1, emi: t2 };
}
const TILE_U = 12, TILE_V = 12.8; // metres covered by one texture tile (4 cells)

const rng = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const decode = a => { const p = []; for (let i = 0; i + 1 < a.length; i += 2) p.push([a[i] / 10, a[i + 1] / 10]); return p; };
const sarea = p => { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; } return s / 2; };
const bboxOf = p => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; p.forEach(([x, z]) => { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); }); return { minX: a, maxX: b, minZ: c, maxZ: d }; };

/** Flat polygon at height y, facing up. */
function flatPoly(pts, y) {
  let p = pts.slice(); if (sarea(p) < 0) p.reverse();
  const v2 = p.map(q => new THREE.Vector2(q[0], q[1])), tri = THREE.ShapeUtils.triangulateShape(v2, []);
  if (!tri.length) return null;
  const pos = new Float32Array(p.length * 3), nor = new Float32Array(p.length * 3), idx = [];
  p.forEach((q, i) => { pos.set([q[0], y, q[1]], i * 3); nor.set([0, 1, 0], i * 3); });
  tri.forEach(([a, b, c]) => { // choose winding so the face normal points +y
    const ux = p[b][0] - p[a][0], uz = p[b][1] - p[a][1], vx = p[c][0] - p[a][0], vz = p[c][1] - p[a][1];
    const ny = uz * vx - ux * vz; // y component of (v x u) ... sign test below
    if (ny >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx); return g;
}

/** Extruded building: walls with world-space UVs (u along the perimeter, v with height) and a separate roof geometry. */
function buildingGeo(p, h, color) {
  if (sarea(p) < 0) p = p.slice().reverse();
  const n = p.length, pos = [], nor = [], uv = [], col = [], idx = [];
  let u = 0;
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L < .05) continue;
    const nx = dz / L, nz = -dx / L; // outward normal for this winding (verified by sign choice below)
    const k = pos.length / 3, u0 = u / TILE_U, u1 = (u + L) / TILE_U, v1 = h / TILE_V;
    pos.push(a[0], 0, a[1], b[0], 0, b[1], b[0], h, b[1], a[0], h, a[1]);
    for (let j = 0; j < 4; j++) { nor.push(nx, 0, nz); col.push(color.r, color.g, color.b); }
    uv.push(u0, 0, u1, 0, u1, v1, u0, v1);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    u += L;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  // make winding face outward: compare the first triangle's geometric normal with the stored one
  const P = g.attributes.position, N = g.attributes.normal; if (idx.length) {
    const ax = P.getX(1) - P.getX(0), ay = P.getY(1) - P.getY(0), az = P.getZ(1) - P.getZ(0), bx = P.getX(2) - P.getX(0), by = P.getY(2) - P.getY(0), bz = P.getZ(2) - P.getZ(0);
    const cx = ay * bz - az * by, cz = ax * by - ay * bx;
    if (cx * N.getX(0) + cz * N.getZ(0) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
  }
  return g;
}
function roofGeo(p, h) {
  const g = flatPoly(p, h); return g;
}

export function addOSM(C, data, opts = {}) {
  const night = !!C.cfg?.night, scene = C.scene;
  const strip0 = Object.assign({ halfZ: 8, halfX: 130 }, opts.roadStrip || {});
  const handRoads = opts.handRoads || [{ z: 0, half: strip0.halfZ, halfX: strip0.halfX }];
  const onRoad = (x, z, pad = 0) => handRoads.some(r => Math.abs(z - r.z) < r.half + pad && Math.abs(x) < r.halfX);
  const hand = autoColliders(C, { explicit: false });
  const clearBoxes = (opts.clearBoxes || []);
  const clearR = opts.clearRadius || 0;
  if (!C.colliders) C.colliders = [];
  const blocked = (bb, m = 2) => {
    for (const r of handRoads) if (bb.maxZ > r.z - r.half - 1 && bb.minZ < r.z + r.half + 1 && bb.maxX > -r.halfX && bb.minX < r.halfX) return true; // hand-made roads + verges
    for (const c of hand) if (overlaps(bb, c, m)) return true;
    for (const c of clearBoxes) if (overlaps(bb, c, 0)) return true;
    return false;
  };
  const inClear = (x, z) => { for (const c of clearBoxes) if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true; return clearR > 0 && Math.hypot(x, z) < clearR; };
  const inHandAt = (x, z, m = 0) => { for (const c of hand) if (x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m) return true; return false; };
  const polyBlocked = a => { const p = decode(a); let cx = 0, cz = 0; p.forEach(q => { cx += q[0]; cz += q[1]; }); cx /= p.length; cz /= p.length; return inClear(cx, cz) || inHandAt(cx, cz) || onRoad(cx, cz, -2); };
  const counts = { buildings: 0, skippedB: 0, roads: 0, green: 0, water: 0, trees: 0, meshes: 0 };
  const add = (m, shadow = false) => { m.userData.noCollide = true; m.castShadow = shadow; m.receiveShadow = true; scene.add(m); counts.meshes++; return m; };

  // ---- buildings: 3 wall meshes by height band + 1 roof mesh ----
  const bands = [[], [], []], roofs = [];
  const rb = rng(5);
  (data.b || []).forEach((rec, i) => {
    try {
      const h = rec[0], p = decode(rec.slice(1)); if (p.length < 3) return;
      const bb = bboxOf(p), cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2;
      if (clearR && Math.hypot(cx, cz) < clearR) { counts.skippedB++; return; }
      if (blocked(bb)) { counts.skippedB++; return; }
      const tint = new THREE.Color(WALLS[Math.floor(rb() * WALLS.length)]);
      const band = h < 9 ? 0 : h < 18 ? 1 : 2;
      bands[band].push(buildingGeo(p, h, tint));
      const rg = roofGeo(p, h); if (rg) roofs.push(rg);
      C.colliders.push(bb); counts.buildings++;
    } catch (e) { counts.skippedB++; }
  });
  const kinds = ['res', 'res', 'office'];
  bands.forEach((list, bi) => {
    if (!list.length) return;
    const t = tiles(kinds[bi], night);
    const o = { map: t.map, vertexColors: true, roughness: .85, metalness: 0 };
    if (night) { o.emissive = new THREE.Color(0xffffff); o.emissiveMap = t.emi; o.emissiveIntensity = 1; }
    add(new THREE.Mesh(mergeGeometries(list, false), new THREE.MeshStandardMaterial(o)), true);
  });
  if (roofs.length) add(new THREE.Mesh(mergeGeometries(roofs, false), mat(opts.roofColor || '#7C7770', { flatShading: false })), true);

  // ---- roads: flat ribbons, one segment quad each ----
  const rp = [], ri = [];
  const inHand = (x, z) => { for (const c of hand) if (x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1) return true; return false; };
  (data.r || []).forEach(rec => {
    try {
      const w = ROAD_W[rec[0]] ?? 6, pts = decode(rec.slice(1));
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], mx = (ax + bx) / 2, mz = (az + bz) / 2;
        if (onRoad(mx, mz, w / 2)) continue; // hand-made roads
        if (inHand(mx, mz) || inClear(mx, mz)) continue;
        const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < .1) continue;
        const nx = -dz / L * w / 2, nz = dx / L * w / 2, ex = dx / L * w * .25, ez = dz / L * w * .25; // slight overlap closes joints
        const k = rp.length / 3, y = .02;
        rp.push(ax - ex + nx, y, az - ez + nz, bx + ex + nx, y, bz + ez + nz, bx + ex - nx, y, bz + ez - nz, ax - ex - nx, y, az - ez - nz);
        // winding for +y normal
        const u = [bx - ax, bz - az], v = [nx, nz]; const cy = u[1] * v[0] - u[0] * v[1];
        if (cy >= 0) ri.push(k, k + 1, k + 2, k, k + 2, k + 3); else ri.push(k, k + 2, k + 1, k, k + 3, k + 2);
      }
      counts.roads++;
    } catch (e) { /* skip */ }
  });
  if (rp.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(rp.map((_, i) => i % 3 === 1 ? 1 : 0), 3)); g.setIndex(ri);
    const m = new THREE.MeshStandardMaterial({ color: opts.roadColor || '#4A4B53', roughness: .9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    add(new THREE.Mesh(g, m));
  }

  // ---- green + water ----
  const poly = (list, y) => { const gs = []; list.forEach(a => { try { const g = flatPoly(decode(a), y); if (g) gs.push(g); } catch (e) { /* skip */ } }); return gs; };
  const greens = poly((data.g || []).filter(a => !polyBlocked(a)), .015); counts.green = greens.length;
  if (greens.length) add(new THREE.Mesh(mergeGeometries(greens, false), new THREE.MeshStandardMaterial({ color: opts.greenColor || '#5E7A44', roughness: .95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
  const waters = poly((data.w || []).filter(a => !polyBlocked(a)), .012); counts.water = waters.length;
  if (waters.length) add(new THREE.Mesh(mergeGeometries(waters, false), new THREE.MeshStandardMaterial({ color: '#3C5A7A', roughness: .25, metalness: .1 })));

  // ---- trees inside parks (instanced, seeded) ----
  const maxTrees = Math.min(opts.maxTrees ?? 300, 300), rt = rng(23), spots = [];
  const tcol = opts.treeColors || ['#4A7F3A', '#5E8C3E', '#6F9A3F'];
  const parks = (data.g || []).filter(a => !polyBlocked(a)).map(decode).filter(p => p.length > 3 && Math.abs(sarea(p)) > 250).sort((a, b) => Math.abs(sarea(b)) - Math.abs(sarea(a)));
  const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
  const obstacles = hand.concat(C.colliders);
  outer: for (let pass = 0; pass < 6 && spots.length < maxTrees; pass++) {
    for (const p of parks) {
      if (spots.length >= maxTrees) break outer;
      const bb = bboxOf(p), want = Math.min(8, Math.ceil(Math.abs(sarea(p)) / 1800));
      for (let k = 0; k < want; k++) {
        for (let tr = 0; tr < 6; tr++) {
          const x = bb.minX + rt() * (bb.maxX - bb.minX), z = bb.minZ + rt() * (bb.maxZ - bb.minZ);
          if (Math.hypot(x, z) > 300 || !inPoly(p, x, z) || onRoad(x, z, 3) || inClear(x, z)) continue;
          const b = { minX: x - 1.5, maxX: x + 1.5, minZ: z - 1.5, maxZ: z + 1.5 };
          if (obstacles.some(c => overlaps(b, c, 0)) || clearBoxes.some(c => overlaps(b, c, 0))) continue;
          spots.push([x, z, .8 + rt() * .7, rt()]); break;
        }
      }
    }
  }
  if (spots.length) {
    const n = spots.length, d = new THREE.Object3D(), c = new THREE.Color();
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.1, 0), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: .9, flatShading: true }), n);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .32, 2.6, 6), mat('#5E4128'), n);
    spots.forEach(([x, z, s, t], i) => {
      d.position.set(x, 1.3 * s, z); d.scale.setScalar(s); d.rotation.set(0, t * 6, 0); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix);
      d.position.set(x, 3.7 * s, z); d.scale.set(s * 1.15, s * .8, s * 1.15); d.updateMatrix(); crown.setMatrixAt(i, d.matrix);
      crown.setColorAt(i, c.set(t < .7 ? tcol[0] : t < .9 ? tcol[1] : tcol[2]));
    });
    crown.instanceColor.needsUpdate = true;
    add(crown, true); add(trunk, true); counts.trees = n;
  }
  C.osmCounts = counts;
  return counts;
}
