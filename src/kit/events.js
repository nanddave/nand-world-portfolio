// Tiny global event bus: missions emit, cities react (see C.on in city.js).
const H = new Map();
export const WORLD = {
  on(evt, fn) { let s = H.get(evt); if (!s) H.set(evt, s = new Set()); s.add(fn); return () => s.delete(fn); },
  emit(evt, data) { (H.get(evt) || []).forEach(fn => { try { fn(data); } catch (e) { console.warn('world handler', evt, e); } }); },
};
