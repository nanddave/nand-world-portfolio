// Co-pilot: real client-side retrieval, no paid API.
// BM25 over every spot's title / meta / body text (placeholder "todo" paragraphs excluded), the skill labels from
// skills.js, and the non-spot content (projects, papers, offers, roles, education, summary, contact), with a small synonym table for query expansion. The answer is the top-ranked spot.
// Optional hook: if VITE_COPILOT_URL is set at build time, POST {q} there and use its {answer, stop, spot}.
import { STOPS, PROJECTS, PAPERS, EDU, ROLES, OFFERS, HEADLINE, SUMMARY, BEST_FOR, CONTACT } from '../content/stops.js';
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
  gmail: ['hapi', 'jarvis', 'integrations'], sheets: ['hapi', 'integrations'], postgres: ['hapi', 'integrations'], api: ['hapi', 'fastapi', 'integrations'], connector: ['hapi', 'integrations'],
  hr: ['resume', 'ranking', 'applicants'], candidate: ['resume', 'ranking', 'applicants'], intake: ['oaklet', 'patient', 'healthcare'], clinic: ['oaklet', 'healthcare', 'appointment'], dashboard: ['kpi', 'etl', 'reporting'], reporting: ['kpi', 'etl', 'pipelines'], kpi: ['etl', '7eleven'],
  quality: ['labeling', 'centific', 'near-duplicate'], clean: ['etl', 'near-duplicate', 'pipelines'], analytics: ['ana', 'etl', 'kpi'], risk: ['ana', 'payment', 'buyer'], scheduling: ['salon', 'appointment', 'oaklet'], ops: ['jarvis', 'slack', 'linear'], operation: ['jarvis', 'ana', 'ops'],
  price: ['contact', 'call'], pricing: ['contact', 'call'], cost: ['contact', 'call'], quote: ['contact', 'call'], rate: ['contact', 'call'], service: ['founders', 'build', 'brokai'], offer: ['founders', 'build', 'brokai'], build: ['founders', 'brokai', 'offer'],
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
OFFERS.forEach(([t, d, id, st]) => addDoc([[`${t} hire build offer`, 3], [d, 1]], { ...spotAt(id, st), label: `What I build · ${t}` }));
ROLES.forEach(r => addDoc([[`${r.role} ${r.org}`, 3], [`${r.place} ${r.when} experience job role`, 1]], { ...spotAt(...r.where), label: `Role · ${r.org}` }));
addDoc([['Education degree university studied', 3], [EDU.map(e => `${e.school} ${e.what}`).join(' '), 1]], { ...spotAt('boston', 'Northeastern University'), label: 'Education' });
addDoc([['Summary resume cv overview who is Nand 30-second version recruiter', 3], [`${HEADLINE} ${SUMMARY} ${BEST_FOR}`, 1]], { modal: '#quick', label: 'The 30-second version' });
addDoc([['Founders clients what can you build for me services hire Brokai', 3], [OFFERS.map(o => o[0]).join(' '), 1]], { modal: '#build', label: 'What I build' });
addDoc([['Contact email linkedin github resume pdf book call availability reach pricing price cost quote', 3]], { modal: '#talk', label: 'Contact' });
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
// Plain-intent questions that keyword scoring gets wrong ("book a call" is not the salon's calls).

// Common questions with a written answer (and, where useful, a place to open). Checked before retrieval so people get
// a direct reply, not just a jump. Anything not published on this site (availability, pay, visa, pricing) is routed to Nand himself.
const spot = (id, t, label) => ({ ...spotAt(id, t), label, score: null });
const proj = id => ({ project: id, label: `Project · ${PROJECTS.find(p => p.id === id).name}`, score: null });
const modal = (m, label) => ({ modal: m, label, score: null });
const ask1 = 'That is best answered by Nand directly, since I only know what is published here. Email him or book a 30-minute call.';
const FAQ = [
  [/^\s*(hi|hello|hey|hola|namaste|yo|good (morning|evening|afternoon))\b/i, 'Hi! I am the co-pilot for this world. Ask me about his work, projects, research or how to work with him, or pick a topic below.'],
  [/^\s*(thanks|thank you|thx|cool|nice|great|awesome|perfect)\b/i, 'Anytime. If you want to see something working, try "Jarvis" or "the salon project".'],
  [/^\s*(bye|goodbye|see you)\b/i, 'Thanks for visiting. If you would like to talk, the contact sheet has his email and a booking link.', modal('#talk', 'Contact')],
  [/\bare you (an? )?(ai|bot|human|real|chatgpt|gpt|robot)|who (made|built|are) you|your name|what are you/i, 'I am a small guide, not a live AI model. I search the stories, projects and papers on this site and take you to the best match, so I only know what is published here.'],
  [/what can you (do|answer)|how (do|does) (you|this co-?pilot|the co-?pilot) work|^\s*help\b/i, 'Ask me anything about Nand: his work, projects, research, skills, how to work with him, or how this site works. I will answer and, where it helps, take you to the place that shows it.'],
  [/voice (agent|ai|bot|receptionist|assistant)|(answer|handle).*(calls|phone)|receptionist|phone agent/i, 'Yes. He built a voice receptionist for a US salon that answers calls, books and reschedules appointments: about 300 calls and 240 confirmed bookings a month (client-reported). The demo here is a scripted call.', proj('salon')],
  [/screen|ranking|applicants?|shortlist/i, 'Yes. He led delivery of a bulk résumé-ingestion and candidate-ranking workflow at Brokai Labs, used to screen 300+ applicants.', spot('brokai', 'Brokai Labs', 'Bangalore, again · Brokai Labs')],
  [/speak|languages? (does|do|can)|hindi|gujarati|fluent/i, ask1, modal('#talk', 'Contact')],
  [/\bjarvis\b/i, `${PROJECTS[0].text} It was scored on 30–40 test cases per round, and the demo here is a small Slack-to-Linear example.`, proj('jarvis')],
  [/where (has|did|have) (he|nand|you) work|work (history|experience)|employers?|which companies|companies (has|did)/i, `Newest first: ${ROLES.map(r => `${r.org} (${r.role}, ${r.when})`).join('; ')}.`, modal('#quick', 'Roles · The 30-second version')],
  [/how (many|much) .*(year|experience)|years of experience|experienced/i, 'About 3 years across data and AI roles (7-Eleven, Centific, Oaklet, Brokai Labs), plus a paper-cup business he founded before that.', modal('#quick', 'The 30-second version')],
  [/(biggest|best|key|top) (achievement|result|win|project)|achievement|proud|accomplish|impact|results?\b|metrics|numbers/i, 'A few he can stand behind: a voice receptionist taking about 300 calls and 240 confirmed bookings a month for a US salon (client-reported); PySpark pipelines at 7-Eleven that cut KPI runtimes 23.7%; and a Centific audio pipeline handling 6,000+ hours a week with processing time down 70%.', spot('brokai', 'The salon (US client)', 'Bangalore, again · The salon')],
  [/why (should|would|do) .*hire|why hire|strengths?|what makes (him|you)|stand out|different from/i, 'He has taken AI systems from the first customer conversation to launch, and he tests them: Jarvis was scored on 30–40 cases per round. He has also run a business with thin margins, so he builds with the customer\'s outcome in mind.', modal('#quick', 'The 30-second version')],
  [/who (is|\'s) (nand|he)|about (nand|him|yourself)|tell me about (nand|him)|introduc|overview|summary|tl;?dr/i, SUMMARY, modal('#quick', 'The 30-second version')],
  [/what (does|is) (he|nand) (do|doing)|currently|right now|his job|occupation|what do you do/i, 'Right now he runs Brokai Labs in Bangalore, an AI and automation agency he founded in Nov 2025. He builds voice agents and workplace-tool automations for businesses and leads the delivery.', spot('brokai', 'Brokai Labs', 'Bangalore, again · Brokai Labs')],
  [/brokai/i, 'Brokai Labs is the AI and automation agency Nand founded in Bangalore in Nov 2025. Its first paying customer was a US salon (a voice receptionist); he also built Jarvis and Hapi there.', spot('brokai', 'Brokai Labs', 'Bangalore, again · Brokai Labs')],
  [/where (is|does|do) (he|nand|you) (live|based|stay)|\bbased\b|located|\blocation\b|which city/i, 'Bangalore, India. He moved back in late 2025 after several years in the US.'],
  [/available|availability|open to (work|roles|opportunit)|looking for (a )?(job|role)|notice period|salary|ctc|compensation|expected pay|relocat|visa|sponsor|work authori|remote|hybrid|on-?site|full-?time|freelance|contract role/i, ask1, modal('#talk', 'Contact')],
  [/pric|how much|budget|charge|quote|\bfees?\b/i, 'I do not have pricing; it depends on the scope. Describe what you need to Nand, or book a 30-minute call.', modal('#talk', 'Contact')],
  [/book|schedule|arrange|set up .*(call|meeting)|contact|e-?mail|reach (him|out)|get in touch|talk to (him|nand)/i, `You can email ${CONTACT.email}${/^https?:/.test(CONTACT.booking || '') ? ' or book a 30-minute call' : ''}. Opening the contact sheet.`, modal('#talk', 'Contact')],
  [/r[ée]sum[ée]|\bcv\b|download/i, 'The résumé is a PDF, linked on the contact sheet and in the 30-second version.', modal('#talk', 'Contact')],
  [/what (can|do) (he|you) build|build (me|for)|services?|hire (him|nand|you)|work with (him|nand|you)|automate|custom (tool|software)|can he (help|make)/i, 'Voice receptionists, ops agents across Slack, Linear and Gmail, résumé screening, booking and intake workflows, data pipelines, labeling and analytics. The sheet lists each with the result it delivered.', modal('#build', 'What I build')],
  [/clients?\b|customers?\b|who has he (built|worked)|case stud/i, 'Brokai\'s first paying customer was a US salon (the voice receptionist). The rest of his client and team work is private, so names are not listed here.', proj('salon')],
  [/tech stack|skills?\b|technolog|programming|what (does|can) (he|nand) code|python|tools (does|he)|frameworks?/i, 'Python and FastAPI for backends; LiveKit and Retell for voice agents; PySpark and Azure for data pipelines; React, Express/TypeScript and DynamoDB for apps; R and SQL for analysis. The skills index links each one to where he used it.', modal('#skills', 'Skills')],
  [/papers?\b|publications?|published|research/i, `Two papers in 2025, both as co-author: ${PAPERS.map(p => `${p.title} (${p.venue})`).join('; ')}.`, spot('seattle', 'Catch the leak', 'Seattle · Catch the leak')],
  [/study|studied|degree|education|university|college|school|qualification/i, `${EDU.map(e => `${e.school}: ${e.what}`).join('. ')}.`, spot('boston', 'Northeastern University', 'Boston · Northeastern University')],
  [/skydiv|parachut/i, 'The parachutist drifting over San Francisco is a nod to a skydive Nand did in LA, not in SF.'],
  [/hobb|free time|for fun|outside (of )?work|badminton|interests?|passion/i, 'Badminton, cars and speed, and anything thrilling. There is a badminton court in the Bellevue scene.', spot('seattle', 'The badminton court', 'Seattle · The badminton court')],
  [/how (do|can) i (drive|move|play|control|steer)|controls?\b|keyboard|wasd|horn/i, 'Drive with WASD or the arrow keys (or the on-screen joystick), H for the horn, C to change car and E to open a nearby spot.'],
  [/music|songs?|soundtrack|how.*sound|sound.*(off|on)|\bmute\b/i, 'Each city has its own original tune, generated in your browser, plus street ambience. The Sound button in the top bar switches it. Rain and snow play in the designed scenes that show them; in Live mode they follow the real weather there right now.'],
  [/how (was|is) (this|the site|it|the website) (built|made)|built with|three\.?js|source code|github|tech.*(site|website)/i, 'Plain JavaScript and three.js on Vite: every city, car and demo is generated in code, with no paid assets. The globe uses Natural Earth land and Bangalore\'s streets are OpenStreetMap data.', modal('#how', 'How this was built')],
  [/(are|is) (the|these) (demos?|missions?).*(real|fake|live)|real or fake|simulat|actually work/i, 'They are real code running in your browser on illustrative data, each with a "Show your work" log. Client systems and recordings stay private, and anything scripted is labelled as such.'],
];
const CATEGORIES = [
  ['About', ['Who is Nand?', 'What does he do now?', 'Where is he based?', 'Why should I hire him?']],
  ['Experience', ['Where has he worked?', 'How many years of experience?', 'His biggest results', 'What did he study?']],
  ['Projects', ['Has he built voice AI?', 'What is Jarvis?', 'Tell me about Hapi', 'Data pipelines?']],
  ['Research', ['His research papers', 'What is LegalWiz?', 'PII annotation paper']],
  ['Work with him', ['What can he build for me?', 'Screen résumés', 'Is he available?', 'Pricing?', 'Book a call']],
  ['Skills', ['Tech stack', 'Healthcare appointments', 'Customer-facing delivery']],
  ['Personal', ['Where did he grow up?', 'Hobbies?', 'Y Combinator', 'Skydiving?', 'The family farm']],
  ['This site', ['How do I drive?', 'How was this built?', 'Are the demos real?', 'Music and weather?']],
];
const faqFor = q => FAQ.find(([re]) => re.test(q));
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
  const f = faqFor(q); if (f) return { text: f[1], match: f[2] || null, source: 'faq' };
  const top = search(q, 1)[0];
  if (!top || top.score < THRESHOLD) return { text: 'I only know what\'s on this trip: his study, work, research, Brokai Labs and the cities. Try "voice AI", "what did he study?", "Jarvis" or "can he build me an agent?".', match: null, source: 'retrieval', best: top || null };
  return { text: `Best match: ${top.label}. Taking you there.`, match: top, source: 'retrieval' };
}
export { CATEGORIES };
export const SUGGESTIONS = ['Has he built voice AI?', 'What did he study?', 'His research', 'Data pipelines?'];
/** Starter questions per tour persona (the chooser in main.js sets one when a tour starts). */
export const PERSONA_SUGGESTIONS = {
  recruiter: ['30-second summary', 'Where has he worked?', 'Customer-facing delivery', 'How do I contact him?'],
  founder: ['Can he build me a voice agent?', 'Automate my team\'s tools', 'Screen résumés', 'Book a call'],
  engineer: ['Tell me about Hapi', 'How was Jarvis evaluated?', 'His research papers', 'Data pipelines?'],
  curious: ['Where did he grow up?', 'What did he study?', 'Y Combinator', 'Hobbies?'],
};
