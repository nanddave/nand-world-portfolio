// "Your city": geocode a place name (Photon, then Nominatim), fetch ~300 m of OpenStreetMap around it (Overpass) and bake it in the browser
// with the same code as tools/osm-bake.mjs. loadYourCity(query) -> { name, lat, lon, data } or throws (caller falls back to the designed block).
// Usage policy: one geocode (+ one fallback) and at most one Overpass request per mirror per call; repeat calls for the same query share the in-flight promise;
// geocodes are cached in sessionStorage; total budget 6 s. Callers should add attribution (C.credit) when data is used.
import { bakeOSM, fitRoad } from '../kit/osmbake.js';

const PHOTON = 'https://photon.komoot.io/api/?limit=1&q=';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=';
// Tried in order inside the shared time budget; a failing or slow mirror falls through to the next.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
// Pre-baked cities (optional): src/data/cities/index.json = [{ slug, name, aliases:[...], lat?, lon? }] and one raw Overpass JSON per slug.
// import.meta.glob keeps each city its own lazy chunk; with only an empty index.json nothing else is bundled.
const CITY_FILES = import.meta.glob('../data/cities/*.json');
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

const fileFor = slug => CITY_FILES[`../data/cities/${slug}.json`];
const key2 = v => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const mod = async f => { const m = await f(); return m.default ?? m; };

/** Centre of a raw Overpass reply when the index entry gives no lat/lon: mean of element bounds, else of the first geometry points. */
function centreOf(raw) {
  let n = 0, la = 0, lo = 0;
  for (const e of raw.elements || []) {
    const b = e.bounds; if (b) { la += (b.minlat + b.maxlat) / 2; lo += (b.minlon + b.maxlon) / 2; n++; continue; }
    const g = e.geometry && e.geometry[0]; if (g) { la += g.lat; lo += g.lon; n++; }
  }
  return n ? { lat: la / n, lon: lo / n } : null;
}

async function fromPrebaked(key) {
  const idxLoader = CITY_FILES['../data/cities/index.json']; if (!idxLoader) return null;
  const idx = await mod(idxLoader); if (!Array.isArray(idx)) return null;
  const hit = idx.find(c => c && c.slug && c.slug !== 'index' && [c.name, ...(c.aliases || [])].some(v => key2(v) === key)); if (!hit) return null;
  const f = fileFor(hit.slug); if (!f) return null;
  const raw = await mod(f);
  if (raw && raw.v && Array.isArray(raw.b)) return { name: hit.name, lat: +hit.lat, lon: +hit.lon, data: raw }; // already baked by tools/bake-cities.mjs
  const c = (isFinite(hit.lat) && isFinite(hit.lon)) ? { lat: +hit.lat, lon: +hit.lon } : centreOf(raw); if (!c) return null;
  const { data } = bakeYourCity(raw, c.lat, c.lon, hit.slug);
  if (data.b.length + data.r.length < 3) return null;
  return { name: hit.name, lat: c.lat, lon: c.lon, data };
}

async function geocode(q, ac) {
  try { // primary: Photon
    const r = await fetch(PHOTON + encodeURIComponent(q), { signal: ac.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('photon ' + r.status);
    const f = (await r.json())?.features?.[0], [lon, lat] = f?.geometry?.coordinates || [];
    if (!f || !isFinite(lat) || !isFinite(lon)) throw new Error('photon: not found');
    return { name: String(f.properties?.name || q).trim(), lat: +lat, lon: +lon };
  } catch (e) {
    if (ac.signal.aborted) throw e;
  }
  // fallback: Nominatim (polite spacing: 1 request/s)
  const wait = lastStart + 1000 - Date.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait)); lastStart = Date.now();
  const r = await fetch(NOMINATIM + encodeURIComponent(q), { signal: ac.signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('geocode ' + r.status);
  const h = (await r.json())?.[0]; if (!h) throw new Error('place not found');
  const g = { name: (h.name || String(h.display_name || q).split(',')[0]).trim(), lat: +h.lat, lon: +h.lon };
  if (!isFinite(g.lat) || !isFinite(g.lon)) throw new Error('bad coordinates');
  return g;
}

async function overpass(g, ac, deadline) {
  let err = new Error('overpass: no mirror');
  for (let i = 0; i < OVERPASS.length; i++) {
    const left = deadline - Date.now(); if (left < 400 || ac.signal.aborted) break;
    const sub = new AbortController(), onA = () => sub.abort(), t = setTimeout(() => sub.abort(), i === OVERPASS.length - 1 ? left : Math.min(left, Math.max(2500, left / 2)));
    ac.signal.addEventListener('abort', onA, { once: true });
    try {
      const r = await fetch(OVERPASS[i], { method: 'POST', signal: sub.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(overpassQuery(g.lat, g.lon)) });
      if (!r.ok) throw new Error('overpass ' + r.status);
      const raw = await r.json(); if (!raw || !Array.isArray(raw.elements)) throw new Error('bad overpass reply');
      return raw;
    } catch (e) { err = e; } finally { clearTimeout(t); ac.signal.removeEventListener('abort', onA); }
  }
  throw err;
}

async function run(q, key, outer, timeoutMs) {
  const pre = await fromPrebaked(key).catch(e => { console.info('prebaked city failed', e && e.message); return null; });
  if (pre) return pre; // no network call at all
  const deadline = Date.now() + timeoutMs, ac = new AbortController(), timer = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => ac.abort(outer.reason); if (outer) { if (outer.aborted) onAbort(); else outer.addEventListener('abort', onAbort, { once: true }); }
  try {
    let g = cacheGet(key);
    if (!g) { g = await geocode(q, ac); cacheSet(key, g); }
    const raw = await overpass(g, ac, deadline);
    const { data } = bakeYourCity(raw, g.lat, g.lon);
    if (data.b.length + data.r.length < 3) throw new Error('no map data here'); // empty area: use the designed block
    return { name: g.name, lat: g.lat, lon: g.lon, data };
  } finally { clearTimeout(timer); outer?.removeEventListener('abort', onAbort); }
}
