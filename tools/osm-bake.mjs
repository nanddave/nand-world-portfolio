// Bake raw Overpass JSON (data/osm-raw/<id>.json) into compact src/data/osm/<id>.json. Usage: node tools/osm-bake.mjs <id>
// No dependencies. See docs/PLAN.md 1.3 D.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2] || 'blr';
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'tools/osm-cities.json'), 'utf8'))[id];
if (!cfg) throw new Error('no config for ' + id);
const raw = JSON.parse(fs.readFileSync(path.join(root, `data/osm-raw/${id}.json`), 'utf8'));

// ---- projection: equirectangular about the anchor, north = -z, then rotate by rotDeg ----
const kx = Math.cos(cfg.lat * Math.PI / 180) * 111320, kz = 110540;
const ph = cfg.rotDeg * Math.PI / 180, co = Math.cos(ph), si = Math.sin(ph);
const proj = (lat, lon) => { const x = (lon - cfg.lon) * kx, z = -(lat - cfg.lat) * kz; return [x * co - z * si, x * si + z * co]; };
const pg = g => g.map(p => proj(p.lat, p.lon));

// ---- geometry helpers ----
const area = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
const centroid = p => { let x = 0, z = 0; p.forEach(q => { x += q[0]; z += q[1]; }); return [x / p.length, z / p.length]; };
function dp(pts, eps) { // Douglas-Peucker
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, az] = pts[a], [bx, bz] = pts[b], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// simplify a closed ring (no repeated end point): split at the vertex farthest from p[0]
function dpRing(p, eps) {
  if (p.length < 4) return p;
  let fi = 1, fd = 0; p.forEach((q, i) => { const d = Math.hypot(q[0] - p[0][0], q[1] - p[0][1]); if (d > fd) { fd = d; fi = i; } });
  const a = dp(p.slice(0, fi + 1), eps), b = dp(p.slice(fi).concat([p[0]]), eps);
  return a.concat(b.slice(1, -1));
}
const dm = p => p.flatMap(q => [Math.round(q[0] * 10), Math.round(q[1] * 10)]);
const hash = n => { let h = (Number(n) * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

// stitch relation outer member geometries into closed rings (relations from `out geom` carry member geometry)
function rings(rel) {
  const segs = (rel.members || []).filter(m => m.role === 'outer' && m.geometry && m.geometry.length > 1).map(m => m.geometry.map(g => [g.lat, g.lon]));
  const out = [], eq = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  while (segs.length) {
    let cur = segs.pop();
    for (let guard = 0; guard < 50 && !eq(cur[0], cur[cur.length - 1]); guard++) {
      const e = cur[cur.length - 1]; let found = false;
      for (let i = 0; i < segs.length; i++) {
        if (eq(segs[i][0], e)) { cur = cur.concat(segs.splice(i, 1)[0].slice(1)); found = true; break; }
        if (eq(segs[i][segs[i].length - 1], e)) { cur = cur.concat(segs.splice(i, 1)[0].reverse().slice(1)); found = true; break; }
      }
      if (!found) break;
    }
    if (cur.length >= 4 && eq(cur[0], cur[cur.length - 1])) out.push(cur.map(([lat, lon]) => ({ lat, lon })));
  }
  return out;
}

const R = cfg.radius, CR = cfg.clearRadius || 0, ex = new Set(cfg.exclude || []);
const out = { v: 1, id, attribution: '© OpenStreetMap contributors', anchor: { lat: cfg.lat, lon: cfg.lon, rotDeg: cfg.rotDeg }, b: [], r: [], g: [], w: [] };
const st = { bIn: 0, bExcl: 0, bTiny: 0, bFar: 0, relNoGeom: 0 };
const exBounds = []; // lat/lon boxes of excluded elements (used when a relation has no member geometry)

const GREEN = t => t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'pitch' || t.leisure === 'dog_park' || t.landuse === 'grass' || t.natural === 'wood';
const HW = { motorway: 3, trunk: 3, primary: 3, motorway_link: 3, trunk_link: 3, primary_link: 3, secondary: 2, secondary_link: 2, tertiary: 2, tertiary_link: 2, residential: 1, unclassified: 1, living_street: 1, service: 0 };

function height(t, eid) {
  const h = parseFloat(String(t.height || '').replace(',', '.'));
  if (h > 0) return Math.min(h, 120);
  const lv = parseFloat(t['building:levels']);
  if (lv > 0) return Math.min(lv * 3.2, 120);
  if (t.name && /government|public|civic|college|university/.test(t.building || '') ) return 14;
  if (t.name && (t.building === 'government' || t.building === 'public')) return 14;
  return Math.round((6 + hash(eid) * 12) * 2) / 2;
}

function addBuilding(geom, t, eid) {
  let p = pg(geom); if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  if (p.length < 3) return;
  if (Math.abs(area(p)) < 12) { if (st.bTiny < 3) console.log("tiny", area(p), p.length, JSON.stringify(geom).slice(0,200)); st.bTiny++; return; }
  const c = centroid(p);
  if (Math.hypot(c[0], c[1]) > R) { if (st.bFar < 3) console.log("far", c, p.length); st.bFar++; return; }
  if (Math.hypot(c[0], c[1]) < CR) { st.bExcl++; return; }
  if (ex.has(t.name) || exBounds.some(b => geom.every(g => g.lat >= b.minlat && g.lat <= b.maxlat && g.lon >= b.minlon && g.lon <= b.maxlon) || (() => { const lat = geom.reduce((s, g) => s + g.lat, 0) / geom.length, lon = geom.reduce((s, g) => s + g.lon, 0) / geom.length; return lat >= b.minlat && lat <= b.maxlat && lon >= b.minlon && lon <= b.maxlon; })())) { st.bExcl++; return; }
  p = dpRing(p, 0.5);
  if (p.length < 3 || Math.abs(area(p)) < 12) { st.bTiny++; return; }
  if (area(p) < 0) p.reverse(); // positive signed area in (x,z) = CCW as drawn here
  out.b.push([Math.round(height(t, eid) * 10) / 10, ...dm(p)]); st.bIn++;
}

// pass 1: excluded relations without geometry -> remember their bounds
for (const e of raw.elements) if (e.type === 'relation' && e.tags && ex.has(e.tags.name) && e.bounds && !e.members) exBounds.push(e.bounds);

for (const e of raw.elements) {
  const t = e.tags || {};
  try {
    if (e.type === 'way' && e.geometry) {
      const closed = e.geometry.length > 3 && e.geometry[0].lat === e.geometry.at(-1).lat && e.geometry[0].lon === e.geometry.at(-1).lon;
      if (t.building && closed) addBuilding(e.geometry, t, e.id);
      else if (t.highway && t.highway in HW) {
        const p = pg(e.geometry), cl = []; let cur = [];
        p.forEach(q => { if (Math.hypot(q[0], q[1]) <= R + 20) cur.push(q); else { if (cur.length > 1) cl.push(cur); cur = []; } });
        if (cur.length > 1) cl.push(cur);
        cl.forEach(l => { l = dp(l, 0.5); if (l.length > 1) out.r.push([HW[t.highway], ...dm(l)]); });
      } else if (closed && t.natural === 'water') {
        const p = pg(e.geometry); p.pop(); const c = centroid(p);
        if (Math.hypot(c[0], c[1]) <= R && Math.abs(area(p)) > 20) out.w.push(dm(dpRing(p, 0.8)));
      } else if (closed && GREEN(t)) {
        const p = pg(e.geometry); p.pop(); const c = centroid(p);
        if (Math.hypot(c[0], c[1]) <= R + 30 && Math.abs(area(p)) > 40) out.g.push(dm(dpRing(p, 0.8)));
      }
    } else if (e.type === 'relation' && (t.building || GREEN(t) || t.natural === 'water')) {
      const rs = rings(e);
      if (!rs.length) { st.relNoGeom++; continue; }
      if (t.building) rs.forEach(r => addBuilding(r, t, e.id));
      else rs.forEach(r => { const p = pg(r); p.pop(); (t.natural === 'water' ? out.w : out.g).push(dm(dpRing(p, 0.8))); });
    }
  } catch (err) { console.warn('skip', e.type, e.id, err.message); }
}

// landmark check: where does the excluded real landmark land?
if (cfg.landmarkAt) {
  const lm = raw.elements.find(e => e.tags && e.tags.name === cfg.landmarkAt.name && e.bounds);
  if (lm) { const b = lm.bounds, c = proj((b.minlat + b.maxlat) / 2, (b.minlon + b.maxlon) / 2); console.log(`landmark "${cfg.landmarkAt.name}" real bbox centre -> (${c[0].toFixed(1)}, ${c[1].toFixed(1)}); hand-made at (${cfg.landmarkAt.x}, ${cfg.landmarkAt.z})`); }
}

const json = JSON.stringify(out);
fs.mkdirSync(path.join(root, 'src/data/osm'), { recursive: true });
fs.writeFileSync(path.join(root, `src/data/osm/${id}.json`), json);
console.log(`${id}: buildings ${out.b.length} (tiny ${st.bTiny}, far ${st.bFar}, excluded ${st.bExcl}), roads ${out.r.length}, green ${out.g.length}, water ${out.w.length}, relations without geometry skipped ${st.relNoGeom}; ${json.length} bytes${json.length > 120000 ? '  OVER 120 KB BUDGET' : ''}`);
