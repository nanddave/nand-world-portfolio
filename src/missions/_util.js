// Small shared helpers for missions (no dependencies).
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Seeded PRNG (mulberry32): same seed -> same sequence, so every run is reproducible. */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const now = () => performance.now();
export const ms = t0 => Math.round((performance.now() - t0) * 10) / 10;
/** Cancellable sleep tied to a mission's lifetime. */
export function lifetime() {
  const timers = new Set(); let alive = true;
  return {
    get alive() { return alive; },
    sleep(t) { return new Promise(res => { const id = setTimeout(() => { timers.delete(id); res(alive); }, t); timers.add(id); }); },
    raf(f) { let id; const loop = ts => { if (!alive) return; if (f(ts) !== false) id = requestAnimationFrame(loop); }; id = requestAnimationFrame(loop); return () => cancelAnimationFrame(id); },
    kill() { alive = false; timers.forEach(clearTimeout); timers.clear(); },
  };
}
export const json = o => JSON.stringify(o, null, 1).replace(/\n\s*/g, ' ').replace(/\[ /g, '[').replace(/ \]/g, ']');
export const pretty = o => JSON.stringify(o, null, 2);
export const tokens = s => (String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
export const STOP = new Set('a an the and or of to for in on at by with is are be this that it any all your our you i we can some someone before after from as get got off up out per one'.split(' '));
export function jaccard(a, b) { const A = new Set(a), B = new Set(b); let i = 0; A.forEach(x => { if (B.has(x)) i++; }); const u = A.size + B.size - i; return u ? i / u : 0; }
