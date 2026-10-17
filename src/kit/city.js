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
  const sky = skyDome(cfg.top, cfg.hor, cfg.bot, cfg.sunPos, cfg.sunGlow || cfg.sun); sc.add(sky);
  const hemi = new THREE.HemisphereLight(cfg.hs, cfg.hg, cfg.hi); sc.add(hemi);
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
    sc.add(obj); obj.userData.ptype = type; obj.userData.max = count;
    const vy = { rain: 40, snow: 2.2, dust: .25, fireflies: 0 }[type];
    const tk = (t, dt) => {
      const a = g.attributes.position.array;
      for (let i = 0; i < a.length; i += per) {
        a[i + 1] -= vy * dt; if (type === 'rain') a[i + 4] -= vy * dt;
        if (type === 'snow') a[i] += Math.sin(t + i) * .01;
        if (type === 'dust' || type === 'fireflies') { a[i] += Math.sin(t * .5 + i) * .01; a[i + 1] += Math.sin(t + i) * .02; }
        if (a[i + 1] < 0) { a[i + 1] += 50; if (type === 'rain') a[i + 4] += 50; }
      }
      g.attributes.position.needsUpdate = true;
    };
    obj.userData.tick = tk; C.tick.push(tk);
    return obj;
  };
  /** Remove a particle system made by C.particles (used by setMood). */
  C.removeParticles = obj => { const i = C.tick.indexOf(obj.userData.tick); if (i >= 0) C.tick.splice(i, 1); sc.remove(obj); obj.geometry.dispose(); obj.material.dispose(); };
  C.steam = (x, y, z) => {
    const puffs = []; for (let i = 0; i < 10; i++) { const b = ball(.25, mat('#FFFFFF', { transparent: true, opacity: .5 }), x, y, z, 0); b.castShadow = false; b.userData.o = i / 10; sc.add(b); puffs.push(b); }
    C.tick.push(t => puffs.forEach(b => { const k = (t * .35 + b.userData.o) % 1; b.position.set(x + Math.sin(k * 6) * .2, y + k * 2.5, z); b.scale.setScalar(.6 + k * 1.6); }));
  };
  /* ---- Live mood: the designed cfg is the default look; setMood blends from it, resetMood restores it exactly. ---- */
  const D = { top: sky.material.uniforms.top.value.clone(), hor: sky.material.uniforms.hor.value.clone(), bot: sky.material.uniforms.bot.value.clone(), sc: sky.material.uniforms.sc.value.clone(), fog: sc.fog.color.clone(), fn: sc.fog.near, ff: sc.fog.far, hs: hemi.color.clone(), hg: hemi.groundColor.clone(), hi: hemi.intensity, sun: sun.color.clone(), si: sun.intensity, bloom: cfg.bloom };
  const NIGHT = { top: '#070B1C', hor: '#1B2440', bot: '#0A0D18', fog: '#2A3556', hs: '#6272B8', hg: '#1C2030', sun: '#9DB0EA', hi: 1.15, si: .7 };
  const DAY = { top: '#4F86CC', hor: '#BCD3E8', bot: '#6B7A86', fog: '#A9BCCB', hs: '#BBD0E8', hg: '#5A5A50', sun: '#FFF1D6', hi: .95, si: 1.1 };
  const tmp2 = new THREE.Color(), hsl = {};
  let mooded = false; const wx = { rain: null, snow: null };
  const mix = (out, from, toHex, w) => out.copy(from).lerp(tmp2.set(toHex), w);
  const grey = (c, k) => { c.getHSL(hsl); return c.setHSL(hsl.h, hsl.s * (1 - k), hsl.l); };
  C.setMood = m => {
    const hour = m.hour ?? 12, isDay = m.isDay !== false, cloud = m.cloud || 0, rain = m.rain || 0, snow = m.snow || 0, fog = m.fog || 0;
    const night = !isDay || hour < 6 || hour >= 19, twi = !night && ((hour >= 18 && hour < 19) || (hour >= 6 && hour < 7));
    const designedNight = !!cfg.night; mooded = true;
    // w: 0 keeps the designed palette, else blend toward the night or day palette
    const w = night === designedNight ? 0 : (twi ? .5 : 1), P = night ? NIGHT : DAY;
    const u = sky.material.uniforms, g = Math.min(.6, cloud * .5 + rain * .2 + snow * .15 + fog * .3);
    mix(u.top.value, D.top, P.top, w); mix(u.hor.value, D.hor, P.hor, w); mix(u.bot.value, D.bot, P.bot, w);
    grey(u.top.value, g); grey(u.hor.value, g * .6); u.sc.value.copy(D.sc).multiplyScalar(1 - Math.min(1, cloud * .8 + rain + snow) * .85 - (night && !designedNight ? .1 : 0));
    mix(sc.fog.color, D.fog, P.fog, w); grey(sc.fog.color, g);
    mix(hemi.color, D.hs, P.hs, w); mix(hemi.groundColor, D.hg, P.hg, w);
    hemi.intensity = D.hi + (P.hi - D.hi) * w;
    mix(sun.color, D.sun, P.sun, w); sun.intensity = (D.si + (P.si - D.si) * w) * (1 - Math.min(.7, cloud * .5 + rain * .3 + snow * .3 + fog * .3));
    const fm = Math.max(.4, 1 - fog * .6 - cloud * .1 - rain * .15 - snow * .15);
    sc.fog.near = D.fn * Math.max(.5, fm); sc.fog.far = D.ff * fm;
    cfg.bloom = night && !designedNight ? Math.max(D.bloom || 0, .45) : !night && designedNight ? Math.min(D.bloom || 0, .12) : D.bloom;
    // weather particles: hide the designed rain/snow, show our own (built once, intensity via drawRange)
    C._pcs ??= sc.children.filter(o => o.userData?.ptype === 'rain' || o.userData?.ptype === 'snow');
    C._pcs.forEach(o => { o.visible = false; });
    ['rain', 'snow'].forEach(t => {
      const k = t === 'rain' ? rain : snow;
      if (k > .05 && !wx[t]) wx[t] = C.particles(t, 2200);
      if (wx[t]) { wx[t].visible = k > .05; const n = Math.round(300 + 1900 * Math.min(1, k)); wx[t].geometry.setDrawRange(0, t === 'rain' ? n * 2 : n); }
    });
  };
  C.resetMood = () => {
    if (!mooded) return; mooded = false;
    const u = sky.material.uniforms; u.top.value.copy(D.top); u.hor.value.copy(D.hor); u.bot.value.copy(D.bot); u.sc.value.copy(D.sc);
    sc.fog.color.copy(D.fog); sc.fog.near = D.fn; sc.fog.far = D.ff; hemi.color.copy(D.hs); hemi.groundColor.copy(D.hg); hemi.intensity = D.hi;
    sun.color.copy(D.sun); sun.intensity = D.si; cfg.bloom = D.bloom;
    (C._pcs || []).forEach(o => { o.visible = true; });
    ['rain', 'snow'].forEach(t => { if (wx[t]) { C.removeParticles(wx[t]); wx[t] = null; } });
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
