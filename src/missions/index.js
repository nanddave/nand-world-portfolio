// Mission registry. Each module exports:
//   mount(el: HTMLElement, ctx) -> { unmount(): void }
// ctx = {
//   work: WorkLog  (see src/ui/worklog.js) — record what really happens: ctx.work.step(title, detail, {ms, kind})
//   complete(): void — call when the visitor finishes the mission (earns the passport stamp bonus)
//   contact: { email, ... }   city: stop object   reduceMotion: bool
//   scene?: optional hook object from the app, e.g. scene.raiseLot(name) for the 'lot' mission
// }
// Missions must run fully in the browser with zero paid services. Label anything scripted honestly.
export const MISSIONS = {
  machine: () => import('./machine.js'),
  train: () => import('./train.js'),
  etl: () => import('./etl.js'),
  pii: () => import('./pii.js'),
  agents: () => import('./agents.js'),
  goal: () => import('./goal.js'),
  jarvis: () => import('./jarvis.js'),
  voice: () => import('./voice.js'),
  lot: () => import('./lot.js'),
};
export async function mountMission(id, el, ctx) { const m = await MISSIONS[id](); return m.mount(el, ctx); }
