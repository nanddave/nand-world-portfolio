// Solve an OSM anchor (env Z = scene z of the road, default 0): node tools/osm-fit.mjs <raw.json> <roadNameRegex> <gLat,gLon[:X]> <sideLat,sideLon> [highwayRegex] [fitRadius=300]
// Fits the centre line of the named road(s) within fitRadius of G, rotates so it runs along +x with the `side` point on the north side (z<0),
// and puts the foot of G on the line at scene x = X (default 0), z = 0. Prints rotDeg and the anchor lat/lon for tools/osm-cities.json.
import fs from 'fs';
const [, , file, nameRe, g, sideS, hwRe = '.', FR = '300'] = process.argv;
const Z = +(process.env.Z || 0); // desired scene z of the road centre line (default 0)
let t = fs.readFileSync(file, 'utf8'), raw; try { raw = JSON.parse(t); } catch (e) { raw = JSON.parse(t.slice(0, t.lastIndexOf('\n},\n') + 2) + ']}'); }
const [gp, gx = '0'] = g.split(':'); const [glat, glon] = gp.split(',').map(Number); const X = +gx;
const [slat, slon] = sideS.split(',').map(Number);
const kx = Math.cos(glat * Math.PI / 180) * 111320, kz = 110540;
const E = (lat, lon) => [(lon - glon) * kx, -(lat - glat) * kz]; // x east, z south, origin = G
const pts = [];
for (const e of raw.elements) { const tg = e.tags || {}; if (e.type !== 'way' || !e.geometry || !tg.highway || !new RegExp(nameRe, 'i').test(tg.name || '') || !new RegExp(hwRe).test(tg.highway)) continue;
  const p = e.geometry.map(q => E(q.lat, q.lon)); for (let i = 0; i + 1 < p.length; i++) { const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); for (let s = 0; s <= l; s += 5) { const f = l ? s / l : 0, q = [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f]; if (Math.hypot(q[0], q[1]) < +FR) pts.push(q); } } }
if (pts.length < 5) throw new Error('road not found near G');
const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length, mz = pts.reduce((s, q) => s + q[1], 0) / pts.length;
let sxx = 0, szz = 0, sxz = 0; pts.forEach(q => { sxx += (q[0] - mx) ** 2; szz += (q[1] - mz) ** 2; sxz += (q[0] - mx) * (q[1] - mz); });
let th = .5 * Math.atan2(2 * sxz, sxx - szz); let d = [Math.cos(th), Math.sin(th)]; // direction in (east, south)
const s = E(slat, slon); const n = [-d[1], d[0]]; // 'left' normal in the final frame is -z side; test the side point
// after rotation to +x, a point's z' = cross(d, p) = d.x*p.z - d.z*p.x (relative to the line)
const cross = (p) => d[0] * (p[1] - mz) - d[1] * (p[0] - mx);
if (cross(s) > 0) d = [-d[0], -d[1]];
const ph = -Math.atan2(d[1], d[0]); // rotDeg
// foot of G (origin) on line; along-coordinate of foot
const along = (-mx) * d[0] + (-mz) * d[1], foot = [mx + d[0] * along, mz + d[1] * along];
// new origin O = foot - X*d  (so that foot has along=X)
const O = [foot[0] - X * d[0] + Z * d[1], foot[1] - X * d[1] - Z * d[0]];
const lat = glat - (O[1] / kz) * -1 * -1; // z is south => lat = glat - z/kz
const latO = glat - O[1] / kz, lonO = glon + O[0] / kx;
// rms residual
let rms = 0; pts.forEach(q => { rms += cross(q) ** 2; }); rms = Math.sqrt(rms / pts.length);
console.log(JSON.stringify({ lat: +latO.toFixed(6), lon: +lonO.toFixed(6), rotDeg: +(ph * 180 / Math.PI).toFixed(2) }), `// line-fit rms ${rms.toFixed(1)} m over ${pts.length} samples; side point z'=${(cross(E(slat, slon)) ).toFixed(0)}`);
