// "Your city": geocode a place name (Nominatim), fetch ~300 m of OpenStreetMap around it (Overpass) and bake it in the browser
// with the same code as tools/osm-bake.mjs. loadYourCity(query) -> { name, lat, lon, data } or throws (caller falls back to the designed block).
// Usage policy: at most ONE geocode and ONE Overpass request per call; repeat calls for the same query share the in-flight promise;
// geocodes are cached in sessionStorage; total budget 6 s. Callers should add attribution (C.credit) when data is used.
import { bakeOSM, fitRoad } from '../kit/osmbake.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const RADIUS = 300;
const inflight = new Map();
let lastStart = 0;

const norm = q => String(q ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
const cacheGet = k => { try { return JSON.parse(sessionStorage.getItem('nw:geo:' + k) || 'null'); } catch (e) { return null; } };
const cacheSet = (k, v) => { try { sessionStorage.setItem('nw:geo:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } };

export function overpassQuery(lat, lon, r = RADIUS) {
  const a = `(around:${r},${lat},${lon})`;
  return `[out:json][timeout:6];(`
    + `way["building"]${a};relation["building"]${a};`
    + `way["highway"]${a};`
    + `way["natural"="water"]${a};relation["natural"="water"]${a};`
    + `way["leisure"~"^(park|garden|pitch|dog_park)$"]${a};relation["leisure"~"^(park|garden|pitch|dog_park)$"]${a};`
    + `way["landuse"="grass"]${a};way["natural"="wood"]${a};`
    + `);out geom;`;
}

export function bakeYourCity(raw, lat, lon, id = 'yours') {
  const fit = fitRoad(raw, { lat, lon, near: 150 }) || fitRoad(raw, { lat, lon, near: 300 });
  const cfg = { id, lat: fit ? fit.lat : lat, lon: fit ? fit.lon : lon, rotDeg: fit ? fit.rotDeg : 0, radius: RADIUS, clearRadius: 0, minArea: 20, simp: .8 };
  const data = bakeOSM(raw, cfg);
  return { data, fit };
}

export function loadYourCity(query, { signal, timeoutMs = 6000 } = {}) {
  const q = norm(query);
  if (q.length < 2) return Promise.reject(new Error('empty place'));
  const key = q.toLowerCase();
  if (inflight.has(key)) return inflight.get(key);
  const p = run(q, key, signal, timeoutMs).finally(() => setTimeout(() => inflight.delete(key), 1500));
  inflight.set(key, p); return p;
}

async function run(q, key, outer, timeoutMs) {
  // Polite spacing: Nominatim allows 1 request/s.
  const wait = lastStart + 1000 - Date.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastStart = Date.now();
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => ac.abort(outer.reason); if (outer) { if (outer.aborted) onAbort(); else outer.addEventListener('abort', onAbort, { once: true }); }
  try {
    let g = cacheGet(key);
    if (!g) {
      const r = await fetch(NOMINATIM + encodeURIComponent(q), { signal: ac.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('geocode ' + r.status);
      const j = await r.json(); const h = j && j[0]; if (!h) throw new Error('place not found');
      const name = (h.name || String(h.display_name || q).split(',')[0]).trim();
      g = { name, lat: +h.lat, lon: +h.lon }; if (!isFinite(g.lat) || !isFinite(g.lon)) throw new Error('bad coordinates');
      cacheSet(key, g);
    }
    const r2 = await fetch(OVERPASS, { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(overpassQuery(g.lat, g.lon)) });
    if (!r2.ok) throw new Error('overpass ' + r2.status);
    const raw = await r2.json(); if (!raw || !Array.isArray(raw.elements)) throw new Error('bad overpass reply');
    const { data } = bakeYourCity(raw, g.lat, g.lon);
    if (data.b.length + data.r.length < 3) throw new Error('no map data here'); // empty area: use the designed block
    return { name: g.name, lat: g.lat, lon: g.lon, data };
  } finally { clearTimeout(timer); outer?.removeEventListener('abort', onAbort); }
}
