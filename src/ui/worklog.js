// "Show your work" log. Missions call work.step(...) for every real step they perform.
// The UI (panel) subscribes via onChange. Keep entries factual: what ran, on what input, how long it took.
export class WorkLog {
  constructor() { this.entries = []; this.listeners = new Set(); }
  step(title, detail = '', opts = {}) { const e = { title, detail, ms: opts.ms ?? null, kind: opts.kind || 'step', t: performance.now() }; this.entries.push(e); this.listeners.forEach(f => f(this.entries, e)); return e; }
  clear() { this.entries = []; this.listeners.forEach(f => f(this.entries, null)); }
  onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  /** Time a function and log it. */
  async time(title, fn, detailFn) { const t0 = performance.now(); const r = await fn(); this.step(title, detailFn ? detailFn(r) : '', { ms: Math.round((performance.now() - t0) * 10) / 10 }); return r; }
}
/** Minimal renderer for a WorkLog into an element (the app may restyle via CSS class names). */
export function renderWorkLog(log, el) {
  const draw = entries => { el.innerHTML = entries.length ? entries.map((e, i) => `<li class="wl-${e.kind}"><span class="wl-n">${i + 1}</span><div><b>${esc(e.title)}</b>${e.ms != null ? ` <em>${e.ms} ms</em>` : ''}${e.detail ? `<pre>${esc(e.detail)}</pre>` : ''}</div></li>`).join('') : '<li class="wl-empty">Nothing has run yet.</li>'; };
  draw(log.entries); return log.onChange(draw);
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
