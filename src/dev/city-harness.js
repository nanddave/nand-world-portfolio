// Dev harness: renders one city alone. URL: /city.html?c=seattle&yaw=-0.6&pitch=0.38&dist=62&spot=1
import '../styles/tokens.css';
import { THREE } from '../kit/kit.js';
import { buildCity } from '../cities/index.js';
import { STOPS } from '../content/stops.js';
const q = new URLSearchParams(location.search), id = q.get('c') || 'seattle';
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const cam = new THREE.PerspectiveCamera(40, 1, .3, 1500);
const C = await buildCity(id); const stop = STOPS.find(s => s.id === id);
const yaw = +(q.get('yaw') ?? C.yaw), pitch = +(q.get('pitch') ?? .38), dist = +(q.get('dist') ?? 62), spot = q.get('spot');
const labs = C.spots.map((s, i) => { const d = document.createElement('div'); d.className = 'lab'; d.textContent = (i + 1) + ' ' + (stop?.spots[i]?.t || '?'); document.body.appendChild(d); return d; });
document.getElementById('info').textContent = `${id}: ${C.spots.length} spots (content has ${stop?.spots.length}) · meshes ${countMeshes(C.scene)}`;
function countMeshes(o) { let n = 0; o.traverse(x => { if (x.isMesh) n++; }); return n; }
function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let t = 0, last = performance.now(), frames = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt; C.update(t, dt);
  if (spot != null && C.spots[+spot]) { const p = C.spots[+spot].p; cam.position.set(p.x + Math.sin(yaw) * 26, p.y * .6 + 12, p.z + Math.cos(yaw) * 26); cam.lookAt(p); }
  else { cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist + 2, Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(0, 2, 0); }
  C.spots.forEach((s, i) => { const v = s.p.clone(); v.y += 1.5; v.project(cam); labs[i].style.display = v.z > 1 ? 'none' : ''; labs[i].style.transform = `translate(${(v.x * .5 + .5) * innerWidth}px,${(-v.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`; });
  renderer.render(C.scene, cam); if (++frames === 30) window.__ready = true; requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
