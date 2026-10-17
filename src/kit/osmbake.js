// Pure OSM bake logic, shared by tools/osm-bake.mjs (Node) and the browser ("your city", src/core/yourcity.js). No Node APIs.
// bakeOSM(overpassJson, cfg) -> data in the format src/kit/osm.js addOSM() consumes. data.stats (non-enumerable) carries counters.
// fitRoad(overpassJson, { lat, lon, ... }) -> { lat, lon, rotDeg, rms, name } puts the longest main road near (lat,lon) along +x (same maths as tools/osm-fit.mjs).

export function makeProj(cfg) {
  const kx = Math.cos(cfg.lat * Math.PI / 180) * 111320, kz = 110540;
  const ph = cfg.rotDeg * Math.PI / 180, co = Math.cos(ph), si = Math.sin(ph);
  return (lat, lon) => { const x = (lon - cfg.lon) * kx, z = -(lat - cfg.lat) * kz; return [x * co - z * si, x * si + z * co]; };
}

export function bakeOSM(raw, cfg) {
  const id = cfg.id;
  const proj = makeProj(cfg);
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

  const MINA = cfg.minArea ?? 12, SIMP = cfg.simp ?? .5, RR = cfg.roadSimp ?? .5, MINH = cfg.roadClasses ?? 0;
  const DROP = new Set(cfg.dropHighway || []), XR = cfg.excludeRects || []; // excludeRects: scene-space [minX,maxX,minZ,maxZ] boxes whose buildings are dropped
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
    if (Math.abs(area(p)) < MINA) { st.bTiny++; return; }
    const c = centroid(p);
    if (Math.hypot(c[0], c[1]) > R) { st.bFar++; return; }
    if (Math.hypot(c[0], c[1]) < CR) { st.bExcl++; return; }
    if (ex.has(t.name) || exBounds.some(b => geom.every(g => g.lat >= b.minlat && g.lat <= b.maxlat && g.lon >= b.minlon && g.lon <= b.maxlon) || (() => { const lat = geom.reduce((s, g) => s + g.lat, 0) / geom.length, lon = geom.reduce((s, g) => s + g.lon, 0) / geom.length; return lat >= b.minlat && lat <= b.maxlat && lon >= b.minlon && lon <= b.maxlon; })())) { st.bExcl++; return; }
    if (XR.some(r => c[0] > r[0] && c[0] < r[1] && c[1] > r[2] && c[1] < r[3])) { st.bExcl++; return; }
    p = dpRing(p, SIMP);
    if (p.length < 3 || Math.abs(area(p)) < MINA) { st.bTiny++; return; }
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
        else if (t.highway && t.highway in HW && !DROP.has(t.highway)) {
          const p = pg(e.geometry), cl = []; let cur = [];
          p.forEach(q => { if (Math.hypot(q[0], q[1]) <= R + 20) cur.push(q); else { if (cur.length > 1) cl.push(cur); cur = []; } });
          if (cur.length > 1) cl.push(cur);
          cl.forEach(l => { l = dp(l, RR); if (l.length > 1) out.r.push([HW[t.highway], ...dm(l)]); });
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

  Object.defineProperty(out, 'stats', { value: st, enumerable: false });
  Object.defineProperty(out, 'proj', { value: proj, enumerable: false });
  return out;
}

/** Find the main road near the centre and return an anchor that rotates it onto +x at z=0.
 *  opts: { lat, lon, near=150 (m, road must pass within), fit=250 (m, samples used), nameRe, hwRe='^(primary|secondary|tertiary)$' }
 *  Returns null when no such road exists (caller keeps rotDeg 0). The side with more buildings is put on the north (z<0). */
export function fitRoad(raw, opts) {
  const { lat: glat, lon: glon, near = 150, fit = 250 } = opts, hwRe = new RegExp(opts.hwRe || '^(primary|secondary|tertiary)(_link)?$');
  const kx = Math.cos(glat * Math.PI / 180) * 111320, kz = 110540, E = (la, lo) => [(lo - glon) * kx, -(la - glat) * kz];
  const ways = new Map(); // road name (or id) -> { len, pts }
  for (const e of raw.elements || []) {
    const t = e.tags || {}; if (e.type !== 'way' || !e.geometry || !t.highway || !hwRe.test(t.highway)) continue;
    if (opts.nameRe && !new RegExp(opts.nameRe, 'i').test(t.name || '')) continue;
    const p = e.geometry.map(q => E(q.lat, q.lon)); let close = false, len = 0;
    for (let i = 0; i + 1 < p.length; i++) { len += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); if (Math.hypot(p[i][0], p[i][1]) < near) close = true; }
    if (!close) continue;
    const key = t.name || t.ref || 'way' + e.id, w = ways.get(key) || { len: 0, pts: [], name: t.name || t.ref || '' };
    w.len += len; w.pts.push(p); ways.set(key, w);
  }
  let best = null; for (const w of ways.values()) if (!best || w.len > best.len) best = w;
  if (!best) return null;
  const pts = [];
  for (const p of best.pts) for (let i = 0; i + 1 < p.length; i++) {
    const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
    for (let s = 0; s <= l; s += 5) { const f = l ? s / l : 0, q = [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f]; if (Math.hypot(q[0], q[1]) < fit) pts.push(q); }
  }
  if (pts.length < 5) return null;
  const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length, mz = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  let sxx = 0, szz = 0, sxz = 0; pts.forEach(q => { sxx += (q[0] - mx) ** 2; szz += (q[1] - mz) ** 2; sxz += (q[0] - mx) * (q[1] - mz); });
  const th = .5 * Math.atan2(2 * sxz, sxx - szz); let d = [Math.cos(th), Math.sin(th)];
  const cross = p => d[0] * (p[1] - mz) - d[1] * (p[0] - mx); // z' of a point relative to the line after rotation
  // side test: vote with building centroids (more buildings on z'<0)
  let vote = 0; for (const e of raw.elements || []) if (e.type === 'way' && e.tags?.building && e.geometry?.length) {
    const g = e.geometry, c = E(g.reduce((s, q) => s + q.lat, 0) / g.length, g.reduce((s, q) => s + q.lon, 0) / g.length); if (Math.hypot(c[0], c[1]) < 300) vote += cross(c) < 0 ? 1 : -1;
  }
  if (vote < 0) d = [-d[0], -d[1]];
  const ph = -Math.atan2(d[1], d[0]), along = -mx * d[0] - mz * d[1], foot = [mx + d[0] * along, mz + d[1] * along]; // foot of the centre on the line = new origin
  let rms = 0; pts.forEach(q => { rms += cross(q) ** 2; }); rms = Math.sqrt(rms / pts.length);
  return { lat: glat - foot[1] / kz, lon: glon + foot[0] / kx, rotDeg: ph * 180 / Math.PI, rms, name: best.name };
}
