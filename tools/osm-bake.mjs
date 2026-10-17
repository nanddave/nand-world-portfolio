// Bake raw Overpass JSON (data/osm-raw/<id>.json) into compact src/data/osm/<id>.json. Usage: node tools/osm-bake.mjs <id>
// Logic lives in src/kit/osmbake.js (shared with the browser). See docs/PLAN.md 1.3 D.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { bakeOSM, makeProj } from '../src/kit/osmbake.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2] || 'blr';
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'tools/osm-cities.json'), 'utf8'))[id];
if (!cfg) throw new Error('no config for ' + id);
// cfg.raw = raw file stem (default: id). Truncated Overpass dumps (cut off mid-array) are repaired by dropping the last partial element.
const rawText = fs.readFileSync(path.join(root, `data/osm-raw/${cfg.raw || id}.json`), 'utf8');
let raw; try { raw = JSON.parse(rawText); } catch (e) { raw = JSON.parse(rawText.slice(0, rawText.lastIndexOf('\n},\n') + 2) + ']}'); console.log('note: raw file was truncated; repaired, kept', raw.elements.length, 'elements'); }

const out = bakeOSM(raw, { ...cfg, id }), st = out.stats, proj = makeProj(cfg);

// landmark check: where does the excluded real landmark land?
if (cfg.landmarkAt) {
  const lm = raw.elements.find(e => e.tags && e.tags.name === cfg.landmarkAt.name && e.bounds);
  if (lm) { const b = lm.bounds, c = proj((b.minlat + b.maxlat) / 2, (b.minlon + b.maxlon) / 2); console.log(`landmark "${cfg.landmarkAt.name}" real bbox centre -> (${c[0].toFixed(1)}, ${c[1].toFixed(1)}); hand-made at (${cfg.landmarkAt.x}, ${cfg.landmarkAt.z})`); }
}

const json = JSON.stringify(out);
fs.mkdirSync(path.join(root, 'src/data/osm'), { recursive: true });
fs.writeFileSync(path.join(root, `src/data/osm/${id}.json`), json);
console.log(`${id}: buildings ${out.b.length} (tiny ${st.bTiny}, far ${st.bFar}, excluded ${st.bExcl}), roads ${out.r.length}, green ${out.g.length}, water ${out.w.length}, relations without geometry skipped ${st.relNoGeom}; ${json.length} bytes${json.length > 120000 ? '  OVER 120 KB BUDGET' : ''}`);
