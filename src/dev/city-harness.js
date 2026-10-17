// Dev harness: renders one city alone. URL: /city.html?c=seattle&yaw=-0.6&pitch=0.38&dist=62&spot=1
import '../styles/tokens.css';
import { THREE } from '../kit/kit.js';
import { buildCity } from '../cities/index.js';
import { STOPS } from '../content/stops.js';
import { loadYourCity, bakeYourCity } from '../core/yourcity.js';
import { buildYours } from '../cities/yours.js';
const q = new URLSearchParams(location.search), id = q.get('c') || 'seattle';
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const cam = new THREE.PerspectiveCamera(40, 1, .3, 1500);
// ?c=yours&q=<city>[&offline=1][&raw=brokai][&for=Company]: the visitor's own city (live APIs; offline=1 = designed fallback; raw=<file in data/osm-raw> = bake a local dump, dev only)
async function yours() {
  const name = q.get('q') || 'Your city', company = new URLSearchParams(location.search).get('for') || null; let data = null, note = '';
  try {
    if (q.get('offline')) note = 'offline fallback';
    else if (q.get('raw') && import.meta.env.DEV) {
      const raw = await (await fetch('/data/osm-raw/' + q.get('raw').replace(/[^\w-]/g, '') + '.json')).json();
      const g = { lat: +(q.get('lat') || { brokai: 12.9857 }[q.get('raw')] || raw.elements.find(e => e.geometry?.length).geometry[0].lat), lon: +(q.get('lon') || { brokai: 77.7365 }[q.get('raw')] || raw.elements.find(e => e.geometry?.length).geometry[0].lon) }; const t0 = performance.now();
      data = bakeYourCity(raw, g.lat, g.lon).data; note = `raw=${q.get('raw')} baked in ${(performance.now() - t0) | 0} ms: ${data.b.length} buildings, ${data.r.length} roads`;
    } else { const r = await loadYourCity(name); data = r.data; note = `live: ${r.name} (${r.lat.toFixed(3)}, ${r.lon.toFixed(3)}) ${data.b.length} buildings`; }
  } catch (e) { note = 'fallback (' + (e.message || e) + ')'; }
  const C = buildYours({ name, data, company }); C.raiseLot && q.get('built') && C.raiseLot(company || 'Acme'); window.__note = note; return C;
}
const C = id === 'yours' ? await yours() : await buildCity(id); const stop = STOPS.find(s => s.id === id);
const yaw = +(q.get('yaw') ?? C.yaw), pitch = +(q.get('pitch') ?? C.pitch ?? .38), dist = +(q.get('dist') ?? C.dist ?? 62), spot = q.get('spot');
const tgt = C.target || { x: 0, y: 2, z: 0 };
const labs = C.spots.map((s, i) => { const d = document.createElement('div'); d.className = 'lab'; d.textContent = (i + 1) + ' ' + (stop?.spots[i]?.t || '?'); document.body.appendChild(d); return d; });
document.getElementById('info').textContent = `${id}: ${C.spots.length} spots (content has ${stop?.spots.length ?? 1}) · meshes ${countMeshes(C.scene)}${window.__note ? ' · ' + window.__note : ''}`;
function countMeshes(o) { let n = 0; o.traverse(x => { if (x.isMesh) n++; }); return n; }
function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let t = 0, last = performance.now(), frames = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt; C.update(t, dt);
  if (spot != null && C.spots[+spot]) { const p = C.spots[+spot].p; cam.position.set(p.x + Math.sin(yaw) * 26, p.y * .6 + 12, p.z + Math.cos(yaw) * 26); cam.lookAt(p); }
  else { cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(tgt.x, tgt.y, tgt.z); }
  C.spots.forEach((s, i) => { const v = s.p.clone(); v.y += 1.5; v.project(cam); labs[i].style.display = v.z > 1 ? 'none' : ''; labs[i].style.transform = `translate(${(v.x * .5 + .5) * innerWidth}px,${(-v.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`; });
  renderer.render(C.scene, cam); if (++frames === 30) window.__ready = true; requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
