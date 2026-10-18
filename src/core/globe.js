// Real-Earth globe: Natural Earth land mask -> displaced, biome-coloured icosphere, clouds, halo, stop markers,
// the travel route (roads hug the ground, flights arc) and the little car / plane that drive it.
// Ported from source/v2-src.html.
import { THREE, V, lerp, clamp, glow, box, cyl, ball, grp, makeRng } from '../kit/kit.js';
import { LAND_MASK_B64 } from './landmask.js';
import { STOPS, LEGS } from '../content/stops.js';

const D = Math.PI / 180, RG = 20;
const mask = (() => { const s = atob(LAND_MASK_B64); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; })();
const bit = (x, y) => { x = ((x % 720) + 720) % 720; y = clamp(y, 0, 359); const i = y * 720 + x; return (mask[i >> 3] >> (i & 7)) & 1; };
function landBi(lat, lon) { const fx = (lon + 180) / .5 - .5, fy = (90 - lat) / .5 - .5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; return lerp(lerp(bit(x0, y0), bit(x0 + 1, y0), tx), lerp(bit(x0, y0 + 1), bit(x0 + 1, y0 + 1), tx), ty); }
function landFrac(lat, lon) { let s = 0, n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const w = (a === 0 && b === 0) ? 2 : 1; s += landBi(lat + a * .35, lon + b * .35) * w; n += w; } return s / n; }
export function ll(lat, lon, r = 1) { const p = (90 - lat) * D, t = (lon + 180) * D; return V(-Math.sin(p) * Math.cos(t), Math.cos(p), Math.sin(p) * Math.sin(t)).multiplyScalar(r); }
function toLL(v) { const n = v.clone().normalize(); const lat = 90 - Math.acos(clamp(n.y, -1, 1)) / D; let lon = Math.atan2(n.z, -n.x) / D - 180; if (lon < -180) lon += 360; return [lat, lon]; }
function h3(x, y, z) { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
function vn(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); let fx = x - X, fy = y - Y, fz = z - Z; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz); const l = lerp;
  return l(l(l(h3(X, Y, Z), h3(X + 1, Y, Z), fx), l(h3(X, Y + 1, Z), h3(X + 1, Y + 1, Z), fx), fy), l(l(h3(X, Y, Z + 1), h3(X + 1, Y, Z + 1), fx), l(h3(X, Y + 1, Z + 1), h3(X + 1, Y + 1, Z + 1), fx), fy), fz);
}
function fbm(x, y, z) { let a = .5, f = 1, t = 0; for (let i = 0; i < 4; i++) { t += a * vn(x * f, y * f, z * f); f *= 2.03; a *= .5; } return t; }
// Big mountain ranges (lat, lon, spread°, amplitude): Himalaya, Rockies, Andes, Alps, Caucasus, Rainier…
const MOUNT = [[34, 76, 5, .55], [30, 83, 5, .6], [28, 90, 4, .5], [36, 70, 4, .35], [50, -118, 6, .35], [43, -110, 6, .38], [37, -106, 5, .32], [60, -140, 6, .3], [5, -75, 4, .35], [-15, -72, 5, .45], [-30, -70, 4, .42], [-45, -72, 4, .3], [46, 9, 3, .3], [43, 44, 3, .25], [-3, 37, 3, .2], [47, -121.7, 1.6, .35], [38, -119, 3, .25]];
function elev(lat, lon, v) {
  const f = landFrac(lat, lon); let h = (f - .5) * .2;
  if (f > .5) { h += fbm(v.x * 2.2, v.y * 2.2, v.z * 2.2) * .08; for (const [a, b, s, amp] of MOUNT) { let dl = lon - b; if (dl > 180) dl -= 360; if (dl < -180) dl += 360; const d2 = ((lat - a) ** 2 + (dl * Math.cos(lat * D)) ** 2) / (s * s); if (d2 < 9) h += amp * .6 * Math.exp(-d2) * (f - .4); } }
  else h -= fbm(v.x * 1.5 + 5, v.y * 1.5, v.z * 1.5) * .25 * (1 - f);
  return { h, f };
}
function biome(lat, lon, h, f, v) {
  if (f < .5) return null; const al = Math.abs(lat);
  if (lat < -60 || (lat > 59 && lon > -75 && lon < -12) || al > 72) return '#EEF2F4'; if (h > .4) return '#F4F4F0'; if (h > .27) return '#9C8F78';
  const n = fbm(v.x * 3 + 9, v.y * 3, v.z * 3);
  const desert = (lat > 14 && lat < 33 && lon > -17 && lon < 62) || (lat > 24 && lat < 38 && lon > 58 && lon < 75 && n > .4) || (lat > -31 && lat < -19 && lon > 117 && lon < 142) || (lat > 30 && lat < 41 && lon > -118 && lon < -103 && n > .45) || (lat > 38 && lat < 48 && lon > 55 && lon < 108 && n > .5) || (lat > -27 && lat < -18 && lon > 14 && lon < 25) || (lat > -30 && lat < -15 && lon > -72 && lon < -68);
  if (desert) return n > .5 ? '#D9BF85' : '#CDAE74'; if (al > 55) return n > .5 ? '#6E8C65' : '#7E9A70'; if (al < 14) return n > .5 ? '#3F8A46' : '#4C9850'; if (al < 30) return n > .5 ? '#7FA454' : '#6E9C4C'; return n > .5 ? '#79A85A' : '#6A9C52';
}
const hAtLL = (lat, lon) => elev(lat, lon, ll(lat, lon)).h;
function slerpDir(a, b, t) { const ang = a.angleTo(b); if (ang < 1e-6) return a.clone(); const s = Math.sin(ang); return a.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(b.clone().multiplyScalar(Math.sin(t * ang) / s)).normalize(); }

/** Great-circle km between two stops, rounded to 10 km. */
export function km(a, b) { const R = 6371, la1 = a.lat * D, la2 = b.lat * D, dl = (b.lon - a.lon) * D; const x = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }

/** Camera orbit angles (a, e) that look straight at lat/lon from outside. */
function facing(lat, lon) { const d = ll(lat, lon); return { a: Math.atan2(d.x, d.z), e: Math.asin(d.y) }; }

/** Subsolar point (lat, lon in degrees) for a Date: simple declination + hour-angle formula, good to about a degree. */
export function subsolar(d = new Date()) {
  const doy = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
  const lat = -23.44 * Math.cos(2 * Math.PI / 365 * (doy + 10));
  const h = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return { lat, lon: ((12 - h) * 15 + 540) % 360 - 180 };
}
/** Time in Nadiad (Asia/Kolkata) as text, e.g. "9:14 pm". */
export function nadiadTime(d = new Date()) { try { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(d).replace(/\s?([AP])M/, (_, a) => ' ' + a.toLowerCase() + 'm'); } catch { return ''; } }

export function createGlobe({ small = false, reduce = false, pinsEl, onPin }) {
  const rnd = makeRng(11);
  const scene = new THREE.Scene();
  // Day/night: one shared uniform set patched into the earth, ocean and cloud materials (a soft terminator, cool night tint).
  const DN = { uSun: { value: V(1, 0, 0) }, uAmt: { value: 0 } };
  const dayNight = m => {
    m.onBeforeCompile = sh => {
      sh.uniforms.uSun = DN.uSun; sh.uniforms.uAmt = DN.uAmt;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSN = normalize((modelMatrix * vec4(position, 1.)).xyz);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSN;uniform vec3 uSun;uniform float uAmt;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nfloat dn=dot(normalize(vSN),uSun);float dk=1.-smoothstep(-.1,.16,dn);gl_FragColor.rgb*=mix(vec3(1.),vec3(.26,.33,.56),dk*uAmt);gl_FragColor.rgb+=vec3(.34,.13,.02)*exp(-pow(dn/.09,2.))*uAmt*.45;');
    };
    return m;
  };
  scene.add(new THREE.HemisphereLight(0xD8E6FF, 0x2A2F48, 2.0));
  const sun = new THREE.DirectionalLight(0xFFF1DC, 3.1); scene.add(sun); scene.add(sun.target);
  // stars
  { const g = new THREE.BufferGeometry(), p = []; for (let i = 0; i < 1600; i++) { const v = V(rnd() - .5, rnd() - .5, rnd() - .5).normalize().multiplyScalar(260 + rnd() * 80); p.push(v.x, v.y, v.z); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xC9D2FF, size: 1.1, transparent: true, opacity: .75 }))); }
  // earth
  let clouds;
  {
    let g = new THREE.IcosahedronGeometry(RG, small ? 52 : 72); if (g.index) g = g.toNonIndexed();
    const pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3), v = V(), cache = new Map(), H = new Float32Array(n), F = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i).normalize(); const k = (v.x * 1e4 | 0) + ',' + (v.y * 1e4 | 0) + ',' + (v.z * 1e4 | 0); let e = cache.get(k);
      if (!e) { const [la, lo] = toLL(v); e = elev(la, lo, v); cache.set(k, e); } H[i] = e.h; F[i] = e.f; const r = RG + Math.max(e.h, -.4); pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    }
    const c = new THREE.Color(), cen = V();
    for (let i = 0; i < n; i += 3) {
      cen.set(pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2), pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2), pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)).normalize();
      const [la, lo] = toLL(cen); const h = (H[i] + H[i + 1] + H[i + 2]) / 3, f = (F[i] + F[i + 1] + F[i + 2]) / 3; const b = biome(la, lo, h, f, cen);
      if (b) c.set(b); else c.set(f > .12 ? '#3A9DBD' : (Math.abs(la) > 60 ? '#2C6A93' : '#1E5A92'));
      c.offsetHSL(0, 0, (h3(cen.x * 90, cen.y * 90, cen.z * 90) - .5) * .035);
      for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, dayNight(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95 }))));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(RG + .02, 96, 64), dayNight(new THREE.MeshStandardMaterial({ color: 0x2B7FB8, transparent: true, opacity: .55, roughness: .18, metalness: .1 }))));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(RG * 1.1, 64, 48), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 n;varying vec3 vp;void main(){n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vp=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying vec3 n;varying vec3 vp;void main(){float f=pow(1.-abs(dot(n,vp)),2.6);gl_FragColor=vec4(.45,.7,1.,1.)*f*.9;}',
    })));
    const cw = small ? 256 : 512, ch = cw / 2, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const cg = cv.getContext('2d'), img = cg.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const p = ll(90 - y / ch * 180, x / cw * 360 - 180); let d = fbm(p.x * 3.2 + 20, p.y * 3.2, p.z * 3.2); d = clamp((d - .5) * 3.2, 0, 1); const i = (y * cw + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = d * 230; }
    cg.putImageData(img, 0, 0); const ct = new THREE.CanvasTexture(cv); ct.colorSpace = THREE.SRGBColorSpace;
    clouds = new THREE.Mesh(new THREE.SphereGeometry(RG + .7, 96, 64), dayNight(new THREE.MeshStandardMaterial({ map: ct, transparent: true, depthWrite: false, roughness: 1 })));
    clouds.rotation.y = Math.PI; scene.add(clouds);
  }

  // stops on the globe. A stop that sits on top of an earlier one (Bangalore, again) shares that marker and pin.
  const S = STOPS.map((s, i) => {
    const dir = ll(s.lat, s.lon), h = Math.max(.02, hAtLL(s.lat, s.lon));
    const dupOf = STOPS.findIndex((o, j) => j < i && Math.hypot(o.lat - s.lat, o.lon - s.lon) < 1);
    return { stop: s, i, dir, h, dupOf };
  });
  S.forEach(s => {
    if (s.dupOf >= 0) return;
    const m = grp(cyl(.05, .05, 1.6, glow('#FFC93C', 1.6), 0, 0, 0, 8), ball(.16, glow('#FFC93C', 2), 0, 1.7, 0, 1));
    const ring = new THREE.Mesh(new THREE.RingGeometry(.25, .36, 32), new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, opacity: .9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .03; m.add(ring); s.ring = ring;
    m.position.copy(s.dir).multiplyScalar(RG + s.h); m.quaternion.setFromUnitVectors(V(0, 1, 0), s.dir); scene.add(m);
  });

  // warm city lights on the night side: a small cluster of dots round each stop (fades with the day/night amount and the sun)
  {
    const pts = []; S.forEach(s => { if (s.dupOf >= 0) return; const t1 = V(0, 1, 0).cross(s.dir).normalize(), t2 = s.dir.clone().cross(t1).normalize(); for (let n = 0; n < 16; n++) { const a = rnd() * 6.283, d = (n === 0 ? 0 : .004 + rnd() * .03) * (n < 6 ? .5 : 1), q = s.dir.clone().addScaledVector(t1, Math.cos(a) * d).addScaledVector(t2, Math.sin(a) * d).normalize().multiplyScalar(RG + s.h + .07); pts.push(q.x, q.y, q.z); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: DN, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'uniform vec3 uSun;uniform float uAmt;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vA=(1.-smoothstep(-.06,.2,dot(normalize(position),uSun)))*uAmt;gl_PointSize=380./-mv.z;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,0.,d);gl_FragColor=vec4(1.,.72,.34,1.)*a*a*vA;}',
    })));
  }

  // route
  const RP = [], RU = [], RT = [], CUM = [0], stopU = new Array(STOPS.length).fill(0);
  LEGS.forEach(([a, b, ty], li) => {
    const A = S[a].dir, B = S[b].dir, ang = A.angleTo(B), n = Math.max(20, Math.ceil(ang / D * (ty === 'd' ? 3 : 1.5))), peak = ty === 'f' ? Math.min(5.5, 1.5 + ang * 3.2) : 0;
    for (let i = 0; i <= n; i++) {
      if (li > 0 && i === 0) continue; const t = i / n, d = slerpDir(A, B, t), [la, lo] = toLL(d);
      const r = ty === 'd' ? RG + Math.max(.02, hAtLL(la, lo)) + .06 : RG + lerp(S[a].h, S[b].h, t) + .06 + Math.sin(t * Math.PI) * peak;
      const p = d.clone().multiplyScalar(r); if (RP.length) CUM.push(CUM[CUM.length - 1] + p.distanceTo(RP[RP.length - 1])); RP.push(p); RU.push(d); RT.push(ty);
    }
    stopU[b] = CUM[CUM.length - 1];
  });
  const LTOT = CUM[CUM.length - 1];
  const idxAt = u => { let lo = 0, hi = CUM.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (CUM[m] <= u) lo = m; else hi = m; } return lo; };
  function routeAt(u, out, up) { u = clamp(u, 0, LTOT); const i = idxAt(u), j = Math.min(i + 1, RP.length - 1), seg = (CUM[j] - CUM[i]) || 1, t = (u - CUM[i]) / seg; out.copy(RP[i]).lerp(RP[j], t); if (up) up.copy(RU[i]).lerp(RU[j], t).normalize(); return RT[Math.min(i, RT.length - 1)]; }
  const legPts = [], legObjs = [];
  LEGS.forEach(([a, b, ty]) => {
    const pts = [], tmp = V(), u0 = stopU[a], u1 = stopU[b];
    for (let i = 0; i <= 160; i++) { routeAt(u0 + (u1 - u0) * i / 160, tmp); pts.push(tmp.clone().multiplyScalar(ty === 'd' ? 1.0005 : 1)); }
    legPts.push({ pts, u0, u1, ty });
    if (ty === 'd') { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, .045, 5, false), glow('#FFC93C', .9)); scene.add(m); legObjs.push(m); }
    else { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xFFFFFF, dashSize: .35, gapSize: .25, transparent: true, opacity: .9 })); l.computeLineDistances(); scene.add(l); legObjs.push(l); }
  });
  // Reel hook (G.setRoute): a bolder glowing copy of the route that can be drawn progressively, with a bright head. Built on first use.
  let reelRoute = null;
  const buildReelRoute = () => {
    const g = new THREE.Group(), tubes = legPts.map(({ pts, ty }) => {
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, ty === 'd' ? .075 : .06, 6, false), glow('#FFC93C', 1.9)); m.geometry.setDrawRange(0, 0); g.add(m); return m;
    });
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,244,200,1)'); gr.addColorStop(.25, 'rgba(255,201,60,.55)'); gr.addColorStop(1, 'rgba(255,201,60,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); halo.scale.setScalar(2.6);
    const core = ball(.2, glow('#FFFFFF', 3), 0, 0, 0, 1);
    const head = new THREE.Group(); head.add(halo, core); head.visible = false; g.add(head); scene.add(g);
    return { g, tubes, head };
  };

  // travellers
  const gCar = grp(box(.5, .14, .24, '#FFC93C', 0, .03), box(.28, .12, .21, '#BFD6E6', -.03, .17));
  const gPlane = grp(cyl(.07, .05, .9, '#F4F4F4', 0, 0, 0, 8), box(.9, .03, .22, '#F4F4F4'), box(.05, .22, .16, '#FFC93C'));
  gPlane.children[0].rotation.z = Math.PI / 2; gPlane.children[0].position.set(0, 0, 0); gPlane.children[1].position.set(0, 0, 0); gPlane.children[1].rotation.y = Math.PI / 2; gPlane.children[2].position.set(-.4, .12, 0);
  [gCar, gPlane].forEach(o => o.traverse(c => { c.castShadow = false; })); scene.add(gCar, gPlane); gPlane.visible = false;

  const cam = new THREE.PerspectiveCamera(42, 1, .05, 900);
  const india = facing(21, 76);

  // DOM pins
  const pins = S.map(s => {
    if (s.dupOf >= 0) return null; const b = document.createElement('button'); b.type = 'button'; b.className = 'pin';
    b.innerHTML = `<b>${s.i + 1}</b>${s.stop.name}`; b.setAttribute('aria-label', `Travel to ${s.stop.name}`);
    b.addEventListener('click', () => onPin?.(s.i)); pinsEl.appendChild(b); return b;
  });

  const G = {
    scene, cam, stopU, LTOT,
    u: 0, target: 0, tripLen: 0, arrivedAt: -1, view: 'intro', // 'intro' | 'travel' | 'orbit' | 'hidden'
    orbitA: india.a, orbitE: .3, dragging: false, onArrive: null,
    tw: null, sw: null, spin: 1, trailer: false, fov: null, // trailer hooks: timed travel, spin multiplier, centred intro framing, FOV override
    camPos: V(0, 10, 70), look: V(0, 0, 0), up: V(0, 1, 0), lastF: null, lastFT: null,
    /** Index of the stop nearest the traveller. */
    curStop() { let best = 0, bd = 1e9; stopU.forEach((u, i) => { const d = Math.abs(u - G.u); if (d < bd) { bd = d; best = i; } }); return best; },
    /** Start travelling to stop i. If already there, no arrival event fires (the caller handles it). */
    setTarget(i, dur) {
      G.target = i; G.view = 'travel'; G.tripLen = Math.abs(stopU[i] - G.u); G.arrivedAt = Math.abs(stopU[i] - G.u) < .01 ? i : -1;
      // Trailer: fly the whole leg in exactly `dur` seconds on an ease-in-out profile instead of the usual constant speed.
      G.tw = dur > 0 && G.arrivedAt < 0 ? { u0: G.u, u1: stopU[i], t: 0, dur } : null;
    },
    /** Info for the travel caption: total km along the legs and whether any leg flies. */
    legInfo(from, to) { const a = Math.min(from, to), b = Math.max(from, to); let fly = false, dist = 0; for (let q = a; q < b; q++) { const [x, y, t] = LEGS[q]; if (t === 'f') fly = true; dist += km(STOPS[x], STOPS[y]); } return { fly, km: Math.round(dist / 10) * 10 }; },
    /** Stylised 3 s sweep of the sun through one full day, ending at the real current position. Resolves when done (at once for reduced motion / trailer). */
    sweep(dur = 3) { if (reduce || G.trailer) return Promise.resolve(); return new Promise(res => { G.sw = { t: 0, dur, res }; }); },
    faceIndia() { G.orbitA = india.a; G.orbitE = .3; },
    drag(dx, dy) { G.orbitA -= dx * .005; G.orbitE = clamp(G.orbitE + dy * .004, -1.2, 1.2); },
    setPinsDone(set) { pins.forEach((p, i) => p && p.classList.toggle('done', set.has(i) || S.some(s => s.dupOf === i && set.has(s.i)))); },
    hidePins() { pins.forEach(p => p && p.classList.add('off')); },
    /** Reel hook: p in 0..1 draws the route progressively with a glowing head (G.routeHead = its position); p = null restores the normal route. */
    routeHead: V(),
    setRoute(p) {
      if (p == null) { if (reelRoute) reelRoute.g.visible = false; legObjs.forEach(o => { o.visible = true; }); return; }
      if (!reelRoute) reelRoute = buildReelRoute();
      reelRoute.g.visible = true; legObjs.forEach(o => { o.visible = false; });
      const u = clamp(p, 0, 1) * LTOT;
      legPts.forEach((L, i) => {
        const f = clamp((u - L.u0) / (L.u1 - L.u0), 0, 1), m = reelRoute.tubes[i]; m.visible = f > 0; m.geometry.setDrawRange(0, Math.floor(f * 200) * 36);
      });
      routeAt(u, G.routeHead); const h = reelRoute.head; h.position.copy(G.routeHead); h.visible = p > 0 && p < .999;
    },
  };

  const P = V(), U = V(), A = V(), B = V(), Fw = V(), Sx = V(), desired = V(), look = V(), pr = V(), tmp = V();
  let ssT = -99, ss = subsolar();
  G.update = (dt, T, W, H) => {
    clouds.rotation.y += dt * .006;
    if (T - ssT > 5) { ss = subsolar(); ssT = T; }
    let off = 0; if (G.sw) { const w = G.sw; w.t += dt; const x = clamp(w.t / w.dur, 0, 1); off = 360 * (1 - x) ** 3; if (x >= 1) { G.sw = null; w.res(); } }
    DN.uSun.value.copy(ll(ss.lat, ss.lon + off).normalize());
    const want = !G.trailer && (G.view === 'intro' || G.sw) ? 1 : 0; DN.uAmt.value += (want - DN.uAmt.value) * Math.min(1, dt * (want ? 4 : 1.6));
    if (G.view === 'travel' && G.arrivedAt !== G.target) {
      const tu = stopU[G.target], dd = tu - G.u, ty = routeAt(G.u, P, U);
      if (G.tw) {
        const w = G.tw; w.t += dt; const x = clamp(w.t / w.dur, 0, 1), e = x * x * x * (x * (x * 6 - 15) + 10); G.u = w.u0 + (w.u1 - w.u0) * e;
        if (x >= 1) { G.u = tu; G.tw = null; }
      } else {
        const sp = Math.max(ty === 'f' ? 18 : 7, G.tripLen / 7) * (Math.abs(dd) < 2 ? Math.max(.3, Math.abs(dd) / 2) : 1);
        G.u += reduce ? dd : Math.sign(dd) * Math.min(Math.abs(dd), sp * dt);
      }
      if (Math.abs(tu - G.u) < .01) { G.u = tu; G.arrivedAt = G.target; G.onArrive?.(G.target); }
    }
    const ty = routeAt(G.u, P, U); routeAt(G.u - .1, A); routeAt(G.u + .1, B); Fw.copy(B).sub(A);
    if (Fw.lengthSq() < 1e-8) Fw.copy(G.lastF || V(1, 0, 0)); Fw.normalize();
    if (G.arrivedAt >= 0 && Math.abs(G.u - stopU[G.target]) < .01 && G.lastF) Fw.copy(G.lastF); G.lastF = Fw.clone();
    const FT = Fw.clone().sub(U.clone().multiplyScalar(Fw.dot(U))); if (FT.lengthSq() < 1e-6) FT.copy(G.lastFT || V(1, 0, 0)); FT.normalize(); G.lastFT = FT.clone();
    const flying = ty === 'f'; gCar.visible = !flying; gPlane.visible = flying; const tv = flying ? gPlane : gCar;
    tv.position.copy(P); tv.up.copy(U); tv.lookAt(tmp.copy(P).add(Fw)); tv.rotateY(-Math.PI / 2);
    S.forEach((s, i) => { if (s.ring) s.ring.scale.setScalar(1 + Math.sin(T * 3 + i) * .08); });
    const k = reduce ? 1 : 1 - Math.exp(-dt * 1.8);
    const free = G.view === 'intro' || G.view === 'orbit';
    if (free) {
      if (!G.dragging && G.view === 'intro' && !reduce) G.orbitA += dt * .02 * G.spin;
      const dist = W < 700 ? 92 : 76;
      desired.set(Math.sin(G.orbitA) * Math.cos(G.orbitE), Math.sin(G.orbitE), Math.cos(G.orbitA) * Math.cos(G.orbitE)).multiplyScalar(dist); look.set(0, 0, 0);
      if (G.view === 'intro' && W > 860 && !G.trailer) { Sx.set(Math.cos(G.orbitA), 0, -Math.sin(G.orbitA)); look.addScaledVector(Sx, -17); }
      if (G.view === 'intro' && W <= 860 && !G.trailer) look.y -= 10;
      G.up.lerp(V(0, 1, 0), k);
    } else {
      const near = Math.abs(stopU[G.target] - G.u) < 1.5 && G.arrivedAt === G.target, alt = near ? 3.2 : (flying ? 13 : 8.5), back = near ? 2.6 : (flying ? 9 : 6.5);
      desired.copy(P).addScaledVector(U, alt).addScaledVector(FT, -back); look.copy(P).addScaledVector(FT, 1.2); G.up.lerp(U, k);
    }
    G.camPos.lerp(desired, k); if (G.camPos.length() < RG + 1.2) G.camPos.setLength(RG + 1.2); G.look.lerp(look, k);
    cam.position.copy(G.camPos); cam.up.copy(G.up); cam.lookAt(G.look);
    sun.position.copy(cam.position).applyAxisAngle(V(0, 1, 0), .6).add(V(0, 30, 0)); sun.target.position.set(0, 0, 0);
    cam.updateMatrixWorld();
    S.forEach(s => {
      const p = pins[s.i]; if (!p) return; pr.copy(s.dir).multiplyScalar(RG + s.h + 2.1);
      const fac = s.dir.dot(tmp.copy(cam.position).sub(pr).normalize()); pr.project(cam);
      const off = G.view === 'hidden' || fac < .1 || pr.z > 1 || (G.view === 'travel' && cam.position.distanceTo(tmp.copy(s.dir).multiplyScalar(RG)) > 40);
      p.classList.toggle('off', off);
      if (!off) p.style.transform = `translate(${(pr.x * .5 + .5) * W}px,${(-pr.y * .5 + .5) * H}px) translate(-50%,-100%)`;
    });
  };
  G.resize = (w, h) => { cam.aspect = w / h; cam.fov = G.fov ?? (w < 700 ? 55 : 42); cam.updateProjectionMatrix(); };
  return G;
}
