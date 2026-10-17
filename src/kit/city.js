// City scene builder. Each city module (src/cities/<id>.js) exports `build()` returning newCity(...) filled with content.
import { THREE, V, mat, box, ball, place, rnd, person, SKIN, heroCar } from './kit.js';

/**
 * cfg: {
 *   top, hor, bot: sky colours; fog, fn, ff: fog colour/near/far
 *   sun, si, sunPos:[x,y,z], sunGlow; hs, hg, hi: hemisphere sky/ground/intensity
 *   ground, groundRough; yaw: starting camera yaw; night: bool; bloom: 0..1 (night glow strength)
 *   sound: id of ambience in core/sound.js (defaults to city id)
 * }
 */
export function newCity(cfg) {
  const sc = new THREE.Scene();
  sc.fog = new THREE.Fog(cfg.fog, cfg.fn || 60, cfg.ff || 210);
  sc.add(skyDome(cfg.top, cfg.hor, cfg.bot, cfg.sunPos, cfg.sunGlow || cfg.sun));
  sc.add(new THREE.HemisphereLight(cfg.hs, cfg.hg, cfg.hi));
  const sun = new THREE.DirectionalLight(cfg.sun, cfg.si);
  sun.position.fromArray(cfg.sunPos).setLength(90); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 240 });
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .03; sc.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 64), mat(cfg.ground, { flatShading: false, roughness: cfg.groundRough || .95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);

  const C = { cfg, scene: sc, movers: [], tick: [], spots: [], yaw: cfg.yaw ?? -.6, pitch: .38, dist: 62, target: V(0, 2, 0), heroCar: null };
  /** Add object; optional x,z,rotY placement. */
  C.add = (o, x, z, ry) => { if (x !== undefined) place(o, x, z, ry); sc.add(o); return o; };
  /** Road strip centred at (x,z) along local x. o: {color, dash:false, dashZ, dashColor, curb:[c1,c2], walk:width, walkColor, rough} */
  C.road = (x, z, len, w, ry = 0, o = {}) => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.PlaneGeometry(len, w), mat(o.color || '#45474F', { flatShading: false, roughness: o.rough || .9 }));
    r.rotation.x = -Math.PI / 2; r.position.y = .03; r.receiveShadow = true; g.add(r);
    if (o.dash !== false) for (let i = -len / 2 + 2; i < len / 2; i += 6) { const d = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .18), mat(o.dashColor || '#F2F2F2', { flatShading: false })); d.rotation.x = -Math.PI / 2; d.position.set(i, .05, o.dashZ || 0); g.add(d); }
    if (o.curb) { const n = Math.floor(len / 2); for (let i = 0; i < n; i++) [1, -1].forEach(sd => g.add(box(2, .3, .35, i % 2 ? o.curb[0] : o.curb[1], -len / 2 + i * 2 + 1, 0, sd * (w / 2 + .18)))); }
    if (o.walk) [1, -1].forEach(sd => { const s = new THREE.Mesh(new THREE.PlaneGeometry(len, o.walk), mat(o.walkColor || '#B9B3A8', { flatShading: false })); s.rotation.x = -Math.PI / 2; s.position.set(0, .06, sd * (w / 2 + o.walk / 2 + .35)); s.receiveShadow = true; g.add(s); });
    place(g, x, z, ry); sc.add(g); return g;
  };
  /** Looping traffic along x at lane z. make() returns a vehicle facing +x. */
  C.lane = (make, z, dir, speed, count, len, y = 0) => { for (let i = 0; i < count; i++) { const v = make(); v.position.set(-len / 2 + (i + rnd() * .5) * len / count, y, z); v.rotation.y = dir > 0 ? 0 : Math.PI; sc.add(v); C.movers.push({ v, dir, speed: speed * (.85 + rnd() * .3), len }); } };
  /** Hotspot marker position. ORDER MUST MATCH the city's spots in src/content/stops.js. */
  C.spot = (x, y, z) => { C.spots.push({ p: V(x, y, z) }); };
  /** Weather particles: 'rain' | 'snow' | 'dust' | 'fireflies' */
  C.particles = (type, count) => {
    const g = new THREE.BufferGeometry(), per = type === 'rain' ? 6 : 3, p = new Float32Array(count * per);
    for (let i = 0; i < count; i++) { const x = (rnd() - .5) * 140, y = rnd() * 50, z = (rnd() - .5) * 140; if (type === 'rain') p.set([x, y, z, x + .15, y - 1.4, z], i * 6); else p.set([x, y, z], i * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const obj = type === 'rain'
      ? new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xC9D6E2, transparent: true, opacity: .55 }))
      : new THREE.Points(g, new THREE.PointsMaterial({ color: type === 'snow' ? 0xFFFFFF : type === 'fireflies' ? 0xFFE58A : 0xFFE9B0, size: type === 'snow' ? .45 : .25, transparent: true, opacity: type === 'snow' ? .95 : .6, depthWrite: false }));
    sc.add(obj);
    const vy = { rain: 40, snow: 2.2, dust: .25, fireflies: 0 }[type];
    C.tick.push((t, dt) => {
      const a = g.attributes.position.array;
      for (let i = 0; i < a.length; i += per) {
        a[i + 1] -= vy * dt; if (type === 'rain') a[i + 4] -= vy * dt;
        if (type === 'snow') a[i] += Math.sin(t + i) * .01;
        if (type === 'dust' || type === 'fireflies') { a[i] += Math.sin(t * .5 + i) * .01; a[i + 1] += Math.sin(t + i) * .02; }
        if (a[i + 1] < 0) { a[i + 1] += 50; if (type === 'rain') a[i + 4] += 50; }
      }
      g.attributes.position.needsUpdate = true;
    });
    return obj;
  };
  C.steam = (x, y, z) => {
    const puffs = []; for (let i = 0; i < 10; i++) { const b = ball(.25, mat('#FFFFFF', { transparent: true, opacity: .5 }), x, y, z, 0); b.castShadow = false; b.userData.o = i / 10; sc.add(b); puffs.push(b); }
    C.tick.push(t => puffs.forEach(b => { const k = (t * .35 + b.userData.o) % 1; b.position.set(x + Math.sin(k * 6) * .2, y + k * 2.5, z); b.scale.setScalar(.6 + k * 1.6); }));
  };
  C.hero = (x, z, ry = 0) => { const c = heroCar(!!cfg.night); C.add(c, x, z, ry); C.heroCar = c; return c; };
  C.crowd = pts => pts.forEach(([x, z, ry]) => C.add(person(SKIN[Math.floor(rnd() * SKIN.length)]), x, z, ry ?? rnd() * 6));
  /** Called every frame by the app/harness. */
  C.update = (t, dt) => {
    C.movers.forEach(m => { m.v.position.x += m.dir * m.speed * dt; if (m.v.position.x > m.len / 2) m.v.position.x = -m.len / 2; if (m.v.position.x < -m.len / 2) m.v.position.x = m.len / 2; });
    C.tick.forEach(f => f(t, dt));
  };
  return C;
}

export function skyDome(top, hor, bot, sunDir, sunCol) {
  return new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(hor) }, bot: { value: new THREE.Color(bot) }, sd: { value: new THREE.Vector3().fromArray(sunDir).normalize() }, sc: { value: new THREE.Color(sunCol) } },
    vertexShader: 'varying vec3 w;void main(){w=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,hor,bot,sc;uniform vec3 sd;varying vec3 w;void main(){vec3 d=normalize(w);float h=d.y;vec3 c=h>0.?mix(hor,top,pow(h,.55)):mix(hor,bot,pow(-h,.45));float s=max(dot(d,sd),0.);c+=sc*(pow(s,90.)*1.4+pow(s,8.)*.22);gl_FragColor=vec4(c,1.);}',
  }));
}
