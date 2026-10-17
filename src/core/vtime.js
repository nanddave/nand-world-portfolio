// Deterministic-time shim for trailer recording. Imported FIRST by main.js; does nothing unless the URL has
// ?trailer and &fixed=<fps>. Then performance.now / Date.now / setTimeout / setInterval / requestAnimationFrame run on a
// virtual clock that only moves when the recorder calls window.__vt.step(ms), so every frame is reproducible no matter
// how slowly software GL renders. Math.random is also seeded (any ?trailer run, so the weather/particles repeat).
const Q = new URLSearchParams(location.search);
const FIXED = Q.has('trailer') ? +(Q.get('fixed') || 0) : 0;

if (Q.has('trailer')) {
  let a = 0x4E414E44; // "NAND"
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

if (FIXED > 0) {
  let now = 1000, seq = 1;
  const timers = new Map(), raf = new Map(); // id -> { at, fn, every }
  const realNow = Date.now(), animT0 = new WeakMap(); window.__realTimeout = window.setTimeout.bind(window);
  performance.now = () => now;
  Date.now = () => realNow + now;
  window.setTimeout = (fn, ms = 0, ...args) => { const id = seq++; timers.set(id, { at: now + Math.max(0, +ms || 0), fn: () => fn(...args), every: 0 }); return id; };
  window.setInterval = (fn, ms = 0, ...args) => { const id = seq++; const e = Math.max(1, +ms || 1); timers.set(id, { at: now + e, fn: () => fn(...args), every: e }); return id; };
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  window.requestAnimationFrame = fn => { const id = seq++; raf.set(id, fn); return id; };
  window.cancelAnimationFrame = id => { raf.delete(id); };
  const runDue = to => {
    for (;;) {
      let best = null, bid = 0;
      timers.forEach((t, id) => { if (t.at <= to && (!best || t.at < best.at || (t.at === best.at && id < bid))) { best = t; bid = id; } });
      if (!best) return;
      now = Math.max(now, best.at);
      if (best.every) best.at += best.every; else timers.delete(bid);
      try { best.fn(); } catch (e) { console.error(e); }
    }
  };
  /** Advance virtual time by ms: fire due timers, seek CSS animations/transitions to the new time, run one rAF round. */
  window.__vt = {
    fps: FIXED,
    get now() { return now; },
    step(ms = 1000 / FIXED) {
      const to = now + ms; runDue(to); now = to;
      try { for (const an of document.getAnimations()) { let t0 = animT0.get(an); if (t0 == null) { t0 = now; animT0.set(an, t0); } an.pause(); an.currentTime = now - t0; } } catch { /* old browser */ }
      const cbs = [...raf.values()]; raf.clear(); cbs.forEach(f => { try { f(now); } catch (e) { console.error(e); } });
      return now;
    },
  };
}
export const FIXED_FPS = FIXED;
