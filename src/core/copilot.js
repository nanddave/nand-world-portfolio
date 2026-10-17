// Co-pilot: real client-side retrieval, no paid API.
// BM25 over every spot's title / meta / body text (placeholder "todo" paragraphs excluded) plus the skill
// labels from skills.js, with a small synonym table for query expansion. The answer is the top-ranked spot.
// Optional hook: if VITE_COPILOT_URL is set at build time, POST {q} there and use its {answer, stop, spot}.
import { STOPS } from '../content/stops.js';
import { MISSION_SKILLS } from './skills.js';

const STOP = new Set('a an the is are was were be been do does did done has have had he his him nand nand\'s i me my you your of to in on at for and or what which who whom where when how why did can could would should tell show about any some there this that it its with from by as into me please'.split(' '));
const SYN = {
  voice: ['salon', 'receptionist', 'call', 'calls'], call: ['voice', 'receptionist'], phone: ['voice', 'receptionist', 'call'], receptionist: ['voice', 'salon'],
  study: ['bachelor', 'master', 'college', 'university', 'degree'], studi: ['bachelor', 'master', 'college', 'university', 'degree'], education: ['bachelor', 'master', 'college', 'university', 'degree'], school: ['college', 'university'], degree: ['bachelor', 'master'], university: ['northeastern', 'college'],
  data: ['etl', 'pyspark', '7eleven', 'clustering', 'pipelines'], pipeline: ['etl', 'pyspark'], spark: ['pyspark', 'etl'], analytic: ['etl', 'kpi', 'data'], scientist: ['data', '7eleven'],
  research: ['paper', 'icdm', 'neurips', 'workshop', 'pii', 'legalwiz'], paper: ['research', 'icdm', 'neurips', 'workshop'], publication: ['paper', 'icdm', 'neurips', 'workshop'], publish: ['paper', 'icdm', 'neurips'],
  privacy: ['pii', 'responsible'], legal: ['legalwiz', 'contradiction', 'documents'], llm: ['llms', 'agents', 'pii', 'multi-agent'],
  agent: ['jarvis', 'agents', 'multi-agent'], automation: ['jarvis', 'agency', 'automation'], automate: ['jarvis', 'automation', 'clustering'], slack: ['jarvis', 'linear'], ticket: ['jarvis', 'linear'],
  founder: ['brokai', 'founded', 'agency'], startup: ['brokai', 'founded', 'agency', 'founders'], company: ['brokai', 'agency'], business: ['brokai', 'businesses', 'agency'], now: ['brokai', 'founder'], current: ['brokai', 'founder'],
  factory: ['ana', 'paper', 'cups', 'machines'], manufactur: ['ana', 'factory', 'cups', 'machines'], machine: ['machines', 'ana', 'repairing'], mechanical: ['engineering', 'machines'], 'first': ['ana'], job: ['ana', 'centific', '7eleven', 'oaklet'],
  hire: ['company', 'plot', 'team'], hiring: ['company', 'plot', 'team'], contact: ['company', 'plot'], work: ['company', 'plot', 'team'],
  home: ['nadiad', 'lane', 'grew'], grow: ['nadiad', 'lane', 'grew'], grew: ['nadiad', 'lane'], family: ['farm', 'dairy'], farm: ['dairy', 'family'], dairy: ['farm'], kite: ['uttarayan', 'kites'], temple: ['mandir', 'santram'],
  hobby: ['badminton', 'off', 'hours'], hobbi: ['badminton'], sport: ['badminton'], fun: ['badminton', 'uttarayan'],
  ambition: ['ambitions', 'goal', 'founders'], goal: ['ambitions', 'steps'], plan: ['steps', 'ambitions'],
  ml: ['machine', 'learning', 'clustering', 'ai'], ai: ['ai'], usa: ['boston', 'irving', 'bellevue', 'francisco'], america: ['boston', 'irving', 'bellevue', 'francisco'], seattle: ['bellevue', 'centific'], bay: ['francisco', 'oaklet'], sf: ['francisco', 'oaklet'], texas: ['irving', '7eleven'],
};
const norm = s => s.toLowerCase().replace(/7[\s-]?eleven/g, '7eleven').replace(/’/g, "'").replace(/'s\b/g, '').replace(/₹/g, ' ');
const stem = w => w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w;
const tokens = s => norm(s).split(/[^a-z0-9-]+/).flatMap(w => w.includes('-') ? [w, ...w.split('-')] : [w]).filter(w => w && !STOP.has(w));
const stripHtml = html => html.replace(/<p class="todo">[\s\S]*?<\/p>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');

// Build the index once.
const DOCS = [];
STOPS.forEach((s, ci) => s.spots.forEach((sp, k) => {
  const fields = [[sp.t, 3], [sp.m, 2], [stripHtml(sp.b), 1], [(sp.mission ? MISSION_SKILLS[sp.mission] || [] : []).join(' '), 2], [`${s.name} ${s.short || ''} ${s.region}`, 1]];
  const tf = new Map(); let len = 0;
  fields.forEach(([text, w]) => tokens(text).forEach(t => { const st = stem(t); tf.set(st, (tf.get(st) || 0) + w); len += w; }));
  DOCS.push({ ci, k, tf, len });
}));
const N = DOCS.length, AVG = DOCS.reduce((a, d) => a + d.len, 0) / N, DF = new Map();
DOCS.forEach(d => d.tf.forEach((_, t) => DF.set(t, (DF.get(t) || 0) + 1)));
const idf = t => { const n = DF.get(t) || 0; return Math.log(1 + (N - n + .5) / (n + .5)); };
const K1 = 1.2, B = .75, THRESHOLD = 1.6;

/** Expand query tokens with synonyms. Returns Map(stem -> weight). */
function expand(q) {
  const out = new Map(), add = (t, w) => { const st = stem(t); out.set(st, Math.max(out.get(st) || 0, w)); };
  tokens(q).forEach(t => { add(t, 1); (SYN[t] || SYN[stem(t)] || []).forEach(s => tokens(s).forEach(x => add(x, .6))); });
  return out;
}
export function search(q, n = 3) {
  const terms = expand(q);
  return DOCS.map(d => {
    let score = 0; terms.forEach((w, t) => { const f = d.tf.get(t); if (f) score += w * idf(t) * (f * (K1 + 1)) / (f + K1 * (1 - B + B * d.len / AVG)); });
    return { ci: d.ci, k: d.k, score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, n);
}

/** Ask a question. Resolves { text, match: {ci,k,score} | null, source: 'retrieval'|'remote' }. */
export async function ask(q) {
  const url = import.meta.env?.VITE_COPILOT_URL;
  if (url) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q }) });
      const j = await r.json(); const ci = typeof j.stop === 'number' ? j.stop : STOPS.findIndex(s => s.id === j.stop);
      if (j.answer) return { text: j.answer, match: ci >= 0 ? { ci, k: +j.spot || 0, score: null } : null, source: 'remote' };
    } catch (e) { /* fall back to local retrieval */ }
  }
  const top = search(q, 1)[0];
  if (!top || top.score < THRESHOLD) return { text: 'I only know what\'s on this trip: his study, work, research, Brokai Labs and the cities. Try "voice AI", "what did he study?" or "data pipelines".', match: null, source: 'retrieval', best: top || null };
  const s = STOPS[top.ci], sp = s.spots[top.k];
  return { text: `Best match: ${sp.t} (${sp.m}), in ${s.name}. Taking you there.`, match: top, source: 'retrieval' };
}
export const SUGGESTIONS = ['Has he built voice AI?', 'What did he study?', 'His research', 'Data pipelines?'];
