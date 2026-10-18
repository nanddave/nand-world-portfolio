// Pre-bake "your city" stops: data/cities-raw/<slug>.json (raw Overpass, fetched on Nand's Mac) -> src/data/cities/<slug>.json + index.json.
// Usage: node tools/bake-cities.mjs
import fs from 'fs';
import { bakeOSM, fitRoad } from '../src/kit/osmbake.js';
const CITIES = {
  bangalore: { name: 'Bengaluru', aliases: ['bangalore', 'bengaluru', 'blr', 'bangalore, india', 'bengaluru, india'], lat: 12.9752, lon: 77.6063 },
  mumbai: { name: 'Mumbai', aliases: ['mumbai', 'bombay', 'mumbai, india'], lat: 18.9322, lon: 72.8347 },
  delhi: { name: 'New Delhi', aliases: ['delhi', 'new delhi', 'ncr', 'delhi, india', 'new delhi, india'], lat: 28.6315, lon: 77.2167 },
  hyderabad: { name: 'Hyderabad', aliases: ['hyderabad', 'hyd', 'hyderabad, india'], lat: 17.4435, lon: 78.3772 },
  pune: { name: 'Pune', aliases: ['pune', 'poona', 'pune, india'], lat: 18.5362, lon: 73.8940 },
  chennai: { name: 'Chennai', aliases: ['chennai', 'madras', 'chennai, india'], lat: 13.0418, lon: 80.2341 },
};
fs.mkdirSync('src/data/cities', { recursive: true });
const index = [];
for (const [slug, c] of Object.entries(CITIES)) {
  const f = `data/cities-raw/${slug}.json`; if (!fs.existsSync(f)) { console.log('skip', slug); continue; }
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  const fit = fitRoad(raw, { lat: c.lat, lon: c.lon, near: 150 }) || fitRoad(raw, { lat: c.lat, lon: c.lon, near: 300 });
  const data = bakeOSM(raw, { id: slug, lat: fit ? fit.lat : c.lat, lon: fit ? fit.lon : c.lon, rotDeg: fit ? fit.rotDeg : 0, radius: 300, clearRadius: 0, minArea: 20, simp: .8 });
  const out = JSON.stringify(data); fs.writeFileSync(`src/data/cities/${slug}.json`, out);
  index.push({ slug, name: c.name, aliases: c.aliases, lat: c.lat, lon: c.lon });
  console.log(slug, 'buildings', data.b.length, 'roads', data.r.length, out.length, 'bytes');
}
fs.writeFileSync('src/data/cities/index.json', JSON.stringify(index, null, 1) + '\n');
