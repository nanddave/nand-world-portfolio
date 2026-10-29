// Co-pilot: real client-side retrieval, no paid API.
// BM25 over every spot's title / meta / body text (placeholder "todo" paragraphs excluded), the skill labels from
// skills.js, and the non-spot content (projects, papers, offers, roles, education, summary, contact), with a small synonym table for query expansion. The answer is the top-ranked spot.
// Optional hook: if VITE_COPILOT_URL is set at build time, POST {q} there and use its {answer, stop, spot}.
import { STOPS, PROJECTS, PAPERS, EDU, ROLES, OFFERS, HEADLINE, SUMMARY, BEST_FOR } from '../content/stops.js';
import { MISSION_SKILLS } from './skills.js';

const STOP = new Set('a an the is are was were be been do does did done has have had he his him nand nand\'s i me my you your of to in on at for and or what which who whom where when how why did can could would should tell show about any some there this that it its with from by as into me please'.split(' '));
const SYN = {
  voice: ['salon', 'receptionist', 'call', 'calls'], us: ['salon', 'client'], client: ['salon', 'voice', 'receptionist'], call: ['voice', 'receptionist'], phone: ['voice', 'receptionist', 'call'], receptionist: ['voice', 'salon'],
  study: ['bachelor', 'master', 'college', 'university', 'degree'], studi: ['bachelor', 'master', 'college', 'university', 'degree'], education: ['bachelor', 'master', 'college', 'university', 'degree'], school: ['college', 'university'], degree: ['bachelor', 'master'], university: ['northeastern', 'college'],
  data: ['etl', 'pyspark', '7eleven', 'clustering', 'pipelines'], pipeline: ['etl', 'pyspark'], spark: ['pyspark', 'etl'], analytic: ['etl', 'kpi', 'data'], scientist: ['data', '7eleven'],
  research: ['paper', 'icdm', 'neurips', 'workshop', 'pii', 'legalwiz'], paper: ['research', 'icdm', 'neurips', 'workshop'], publication: ['paper', 'icdm', 'neurips', 'workshop'], publish: ['paper', 'icdm', 'neurips'],
  privacy: ['pii', 'responsible'], legal: ['legalwiz', 'contradiction', 'documents'], llm: ['llms', 'agents', 'pii', 'multi-agent'],
  agent: ['jarvis', 'agents', 'multi-agent'], automation: ['jarvis', 'agency', 'automation'], automate: ['jarvis', 'automation', 'clustering'], slack: ['jarvis', 'linear'], ticket: ['jarvis', 'linear'],
  founder: ['brokai', 'founded', 'agency', 'ana'], startup: ['brokai', 'founded', 'agency', 'founders'], company: ['brokai', 'agency'], business: ['brokai', 'businesses', 'agency'], now: ['brokai', 'founder'], current: ['brokai', 'founder'],
  factory: ['ana', 'paper', 'cups', 'machines'], manufactur: ['ana', 'factory', 'cups', 'machines'], machine: ['machines', 'ana', 'repairing'], mechanical: ['engineering', 'machines'], 'first': ['ana'], job: ['ana', 'centific', '7eleven', 'oaklet'],
  hire: ['company', 'plot', 'team'], hiring: ['company', 'plot', 'team'], contact: ['company', 'plot'], work: ['job', 'role', 'experience'],
  home: ['nadiad', 'lane', 'grew'], grow: ['nadiad', 'lane', 'grew'], grew: ['nadiad', 'lane'], family: ['farm', 'dairy'], farm: ['dairy', 'family'], dairy: ['farm'], kite: ['uttarayan', 'kites'], temple: ['mandir', 'santram'],
  hobby: ['badminton', 'off', 'hours'], hobbi: ['badminton'], sport: ['badminton'], fun: ['badminton', 'uttarayan'],
  ambition: ['ambitions', 'goal', 'founders'], goal: ['ambitions', 'steps'], plan: ['steps', 'ambitions'],
  retell: ['voice', 'salon', 'receptionist'], livekit: ['jarvis', 'voice', 'agent'], fastapi: ['hapi', 'jarvis', 'tool'], hapi: ['fastapi', 'brokai', 'tool'], tool: ['jarvis', 'hapi', 'integrations'], integration: ['jarvis', 'hapi', 'slack', 'gmail'],
  azure: ['pipeline', 'audio', 'centific'], pipeline: ['etl', 'pyspark', 'audio', 'azure'], audio: ['centific', 'speaker', 'pipeline'], label: ['centific', 'speaker', 'labeling'], annotation: ['pii', 'labeling'], multilingual: ['languages', 'pii', 'centific'], language: ['multilingual', 'centific', 'near-duplicate'], duplicate: ['near-duplicate', 'centific'],
  healthcare: ['oaklet', 'appointment', 'patient'], patient: ['oaklet', 'healthcare'], appointment: ['oaklet', 'salon', 'bookings'], booking: ['salon', 'appointment', 'voice'], oaklet: ['healthcare', 'appointment'],
  pyspark: ['spark', 'etl', '7eleven'], evaluation: ['jarvis', 'cases', 'relevance', 'routing'], evaluat: ['jarvis', 'cases', 'relevance', 'routing'], eval: ['jarvis', 'evaluated', 'cases'], test: ['jarvis', 'evaluated'],
  resume: ['ranking', 'screen', 'applicants', 'brokai'], screening: ['resume', 'ranking', 'applicants'], ranking: ['resume', 'applicants'], recruit: ['resume', 'applicants', 'ranking'], applicant: ['resume', 'ranking', 'screen'],
  engineering: ['mechanical', 'engineering', 'management'], management: ['northeastern', 'engineering'], customer: ['salon', 'discovery', 'rollout', 'brokai'], deliver: ['customer', 'rollout', 'brokai'], fde: ['customer', 'rollout', 'voice'],
  stockout: ['ana', 'inventory', 'founder'], inventory: ['ana', 'stockouts', 'founder'], default: ['ana', 'payment', 'buyer'], conversion: ['ana', 'order'], cup: ['ana', 'paper', 'cups'],
  ml: ['machine', 'learning', 'clustering', 'ai'], ai: ['ai'], usa: ['boston', 'irving', 'bellevue', 'francisco', 'salon'], america: ['boston', 'irving', 'bellevue', 'francisco', 'salon'], seattle: ['bellevue', 'centific'], bay: ['francisco', 'oaklet'], sf: ['francisco', 'oaklet'], texas: ['irving', '7eleven'],
};
const norm = s => s.toLowerCase().replace(/7[\s-]?eleven/g, '7eleven').replace(/’/g, "'").replace(/'s\b/g, '').replace(/₹/g, ' ');
const stem = w => w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w;
const tokens = s => norm(s).split(/[^a-z0-9-]+/).flatMap(w => w.includes('-') ? [w, ...w.split('-')] : [w]).filter(w => w && !STOP.has(w));
const stripHtml = html => html.replace(/<p class="todo">[\s\S]*?<\/p>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');

// Build the index once. A doc is { label, ci, k } (jump to a spot), { project } (open that project) or { modal } (open that sheet).
const DOCS = [], spotAt = (id, t) => { const ci = STOPS.findIndex(s => s.id === id); return { ci, k: Math.max(0, STOPS[ci].spots.findIndex(sp => sp.t === t)) }; };
const addDoc = (fields, target) => {
  const tf = new Map(); let len = 0;
  fields.forEach(([text, w]) => tokens(text).forEach(t => { const st = stem(t); tf.set(st, (tf.get(st) || 0) + w); len += w; }));
  DOCS.push({ ...target, tf, len });
};
STOPS.forEach((s, ci) => s.spots.forEach((sp, k) => addDoc(
  [[sp.t, 3], [sp.m, 2], [stripHtml(sp.b), 1], [(sp.mission ? MISSION_SKILLS[sp.mission] || [] : []).join(' '), 2], [`${s.name} ${s.short || ''} ${s.region}`, 1]], { ci, k, label: `${s.name} · ${sp.t}` })));
PROJECTS.forEach(p => addDoc([[p.name, 4], [p.status, 2], [`${p.text} ${p.contribution} ${p.evidenceNote}`, 1], [`${p.flow.join(' ')} ${p.limitations.join(' ')}`, 1]], { project: p.id, label: `Project · ${p.name}` }));
PAPERS.forEach((p, i) => addDoc([[p.title, 3], [p.venue, 2], [`${p.method} ${p.contribution} research paper publication`, 1]], { ...spotAt('seattle', i ? 'Agents that argue' : 'Catch the leak'), label: `Paper · ${p.title}` }));
OFFERS.forEach(([t, d, id, st]) => addDoc([[`${t} hire build offer`, 3], [d, 1]], { ...spotAt(id, st), label: `What I can build · ${t}` }));
ROLES.forEach(r => addDoc([[`${r.role} ${r.org}`, 3], [`${r.place} ${r.when} experience job role`, 1]], { ...spotAt(...r.where), label: `Role · ${r.org}` }));
addDoc([['Education degree university studied', 3], [EDU.map(e => `${e.school} ${e.what}`).join(' '), 1]], { ...spotAt('boston', 'Northeastern University'), label: 'Education' });
addDoc([['Summary resume cv overview who is Nand 30-second version recruiter', 3], [`${HEADLINE} ${SUMMARY} ${BEST_FOR}`, 1]], { modal: '#quick', label: 'The 30-second version' });
addDoc([['Founders clients what can you build for me services hire Brokai', 3], [OFFERS.map(o => o[0]).join(' '), 1]], { modal: '#build', label: 'What I can build for you' });
addDoc([['Contact email linkedin github resume pdf book call availability reach', 3]], { modal: '#talk', label: 'Contact' });
addDoc([['Skills list tools technologies stack languages python', 3], [Object.values(MISSION_SKILLS).flat().join(' '), 1]], { modal: '#skills', label: 'Skills' });
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
    return { ...d, tf: undefined, score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, n);
}

/** Ask a question. Resolves { text, match: {ci,k,score} | null, source: 'retrieval'|'remote' }. */
export async function ask(q) {
  const url = import.meta.env?.VITE_COPILOT_URL;
  if (!__SINGLE__ && url) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q }) });
      const j = await r.json(); const ci = typeof j.stop === 'number' ? j.stop : STOPS.findIndex(s => s.id === j.stop);
      if (j.answer) return { text: j.answer, match: ci >= 0 ? { ci, k: +j.spot || 0, score: null } : null, source: 'remote' };
    } catch (e) { /* fall back to local retrieval */ }
  }
  const top = search(q, 1)[0];
  if (!top || top.score < THRESHOLD) return { text: 'I only know what\'s on this trip: his study, work, research, Brokai Labs and the cities. Try "voice AI", "what did he study?", "Jarvis" or "can he build me an agent?".', match: null, source: 'retrieval', best: top || null };
  return { text: `Best match: ${top.label}. Taking you there.`, match: top, source: 'retrieval' };
}
export const SUGGESTIONS = ['Has he built voice AI?', 'What did he study?', 'His research', 'Data pipelines?'];
/** Starter questions per tour persona (the chooser in main.js sets one when a tour starts). */
export const PERSONA_SUGGESTIONS = {
  recruiter: ['30-second summary', 'Where has he worked?', 'Customer-facing delivery', 'How do I contact him?'],
  founder: ['Can he build me a voice agent?', 'The salon project', 'What is Jarvis?', 'Book a call'],
  engineer: ['Tell me about Hapi', 'How was Jarvis evaluated?', 'His research papers', 'Data pipelines?'],
  curious: ['Where did he grow up?', 'What did he study?', 'Y Combinator', 'Hobbies?'],
};
