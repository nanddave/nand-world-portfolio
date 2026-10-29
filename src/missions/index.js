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
const SCOPE = {
  machine: 'Interactive reconstruction inspired by a real incident. Machine values and outcomes here are illustrative.',
  train: 'A small model trains in your browser. Accuracy shown is on these toy training points.',
  etl: 'Browser demonstration of data-cleaning/grouping ideas; not the original PySpark pipeline or verification of historical employer results.',
  pii: 'Rule-based illustration of PII detection; not the paper’s full multilingual annotation framework.',
  agents: 'Deterministic illustration of contradictions; not a live multi-LLM reproduction of the paper.',
  goal: 'Illustrative breakdown of a goal into steps; not a measured business outcome.',
  jarvis: 'This browser example uses rules and mock Slack/Linear tools. The broader Jarvis project uses voice, memory and workplace integrations.',
  voice: 'Scripted browser speech and a fictional calendar; no real calls or appointments are made.',
  lot: 'Illustrative starting point based on what you enter; not a company assessment or an existing engagement.',
};
export async function mountMission(id, el, ctx) {
  const m = await MISSIONS[id](), handle = await m.mount(el, ctx);
  el.querySelector('.ms-note')?.remove();
  const note = document.createElement('p'); note.className = 'ms-note mission-scope'; note.textContent = SCOPE[id]; el.prepend(note);
  return handle;
}
