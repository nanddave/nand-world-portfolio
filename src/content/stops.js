// Single source of truth for the story. Facts here are user-confirmed or clearly marked placeholders.
// Rules: never invent metrics, titles, dates or stories. Placeholders use <p class="todo">…</p>.
// spot.mission = id of an interactive mission in src/missions/ (optional).
// tz = IANA zone for live local time; wlat/wlon = where live weather is read (src/core/live.js). lat/lon stay for the globe.
// spot order MUST match the C.spot(...) calls in the city's build().

export const HEADLINE = 'Applied AI Engineer | Voice Agents | Customer Delivery';
export const SUMMARY = 'Applied AI engineer and founder with 3 years across data and AI roles, delivering customer-facing voice agents, Python/FastAPI tool integrations and production data pipelines.';
export const BEST_FOR = 'applied AI / FDE / founding engineer roles, and voice-agent or automation builds for businesses';
export const PAPERS = [
  { title: 'LegalWiz', venue: 'NeurIPS 2025 GenProCC Workshop', url: 'https://arxiv.org/abs/2510.03418', method: 'A multi-agent framework that writes legal-style documents with six kinds of planted contradictions, to test whether AI systems can catch them.', contribution:'I am a co-author.', demo:'The demo here is a simplified lease example, not the full framework.' },
  { title: 'Scalable Multilingual PII Annotation for Responsible AI in LLMs', venue: 'IEEE ICDM Workshops 2025', url: 'https://arxiv.org/abs/2510.06250', method:'A human-in-the-loop framework for labelling personal data across 13 locales and about 336 PII types, producing high-quality data for fine-tuning LLMs.', contribution:'I am a co-author.', demo:'The detector here is a simple rule-based illustration.' },
];
export const EDU = [
  { school: 'Northeastern University, Boston', what: 'Master\'s in Engineering Management, specialisation in Data Science' },
  { school: 'PES University, Bangalore', what: 'Bachelor\'s in mechanical engineering, 2016–2020' },
];
/** Newest first. `where` = [city id, spot title] so the 30-second version can deep-link. */
export const ROLES = [
  { role: 'Founder & Lead AI Engineer', org: 'Brokai Labs', place: 'Bangalore', when: 'Nov 2025–Oct 2026', where: ['brokai', 'Brokai Labs'] },
  { role: 'Founding AI/ML Engineer', org: 'Oaklet', place: 'Berkeley, CA', when: 'Sep–Oct 2025', where: ['sf', 'Oaklet'] },
  { role: 'AI Engineer', org: 'Centific', place: 'Bellevue', when: 'May 2024–Aug 2025', where: ['seattle', 'Centific'] },
  { role: 'Data Scientist (Co-op)', org: '7-Eleven', place: 'Irving, TX', when: 'Jun–Dec 2022', where: ['irving', '7-Eleven'] },
  { role: 'Founder', org: 'ANA Packaging & Trading', place: 'Bengaluru', when: 'Jun 2020–Jul 2021', where: ['blr', 'ANA Packaging & Trading'] },
];
/** Projects that are not tied to a city. */
export const PROJECTS = [
  { id:'jarvis', name:'Jarvis', status:'Voice agent · Brokai Labs · a team project I started', where:['brokai','Brokai Labs'],
    text:'A voice assistant that remembers context and gets work done across Slack, Linear, Gmail, Calendar and Notion, so you can ask once instead of switching between five apps.',
    contribution:'I started Jarvis and wrote most of the first voice agent on LiveKit, then brought in collaborators and led the team as it grew. I evaluated it with 30–40 test cases per round, scoring task completion, tool routing and answer relevance.',
    flow:['You speak; LiveKit streams the voice session','Jarvis recalls what it knows about you and the task','It picks the right workplace tool','It takes the action or answers back by voice','Every run is traced and scored'],
    limitations:['The demo here is a small rule-based Slack-to-Linear example, so you can see the flow without connecting real accounts.','The full system was built with a team, and its code is private.'],
    evidenceNote:'Built on LiveKit with persistent memory, tool handlers for Slack, Linear, Gmail, Calendar and Notion, and tracing on every session. Each evaluation round used 30–40 cases.' },
  { id:'hapi', name:'Hapi', status:'Prototype · my own project', where:['brokai','Brokai Labs'],
    text:'One API that lets an AI agent take actions in Gmail, Sheets, Slack and PostgreSQL, instead of a separate integration for every app.',
    contribution:'I designed and built Hapi, with my team supporting the work. It puts four connector families and 28 actions behind a single execution endpoint.',
    flow:['The agent sends one authenticated request','Hapi finds the action in its registry','The right connector runs it with stored, encrypted credentials','The reply is trimmed to what the agent needs, and the run is logged'],
    limitations:['Hapi is a prototype, not a product in production.','This site does not connect to any real account.'],
    evidenceNote:'FastAPI backend with OAuth and API-key sign-in, encrypted credentials, database migrations, configurable response fields, execution logs and a React management screen.' },
  { id:'salon', name:'Salon voice receptionist', status:'Client work · Brokai Labs · first paying customer', where:['brokai','The salon (US client)'],
    text:'An AI voice receptionist for a US salon that answers calls, books appointments and handles rescheduling.',
    contribution:'I took it from the first customer conversation to launch: scoping the calls, building the agent on Retell and rolling it out.',
    flow:['A client calls the salon','The agent understands the request and collects the details','It checks availability and runs the booking tools','It confirms the booking or change on the call'],
    limitations:['The call on this site uses your browser\'s voice and a pretend calendar; no real booking is made.','Real call recordings stay private to the client.'],
    evidenceNote:'The salon handled about 300 calls and 240 confirmed bookings a month through it (client-reported figures).' },
];
/** Short "what you'll do" phrase per mission, used to tease the next stop. */
export const MISSION_TEASE = {
  machine: 'find a machine\'s root cause', train: 'train a model live', etl: 'sort 300 messy offers', pii: 'catch a PII leak', agents: 'watch agents argue',
  goal: 'turn a big goal into steps', jarvis: 'try the Jarvis demo', voice: 'call the salon', lot: 'sketch your own project',
};
const A = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;

export const STOPS = [
  {
    id: 'nadiad', tz: 'Asia/Kolkata', wlat: 22.69, wlon: 72.86, name: 'Nadiad', lat: 22.69, lon: 72.86, stamp: '#C2571A',
    region: 'Gujarat, India', coord: '22.69° N, 72.86° E', mood: 'A warm, dusty morning',
    spots: [
      { t: 'The lane I grew up on', m: 'Home', b: '<p class="city">Nadiad is a small city in Gujarat\'s Kheda district, the heart of India\'s dairy belt.</p><p>I grew up here.</p>' },
      { t: 'Santram Mandir', m: 'The town', b: '<p class="city">The white spires of the Santram Mandir are Nadiad\'s best-known landmark.</p><p>It is the town\'s most famous temple, and I have been going there since I was a child.</p>' },
      { t: 'The family farm', m: 'Family', b: '<p>My dad owns a dairy farm here with close to 100 cattle. It is where he is happily spending the next stage of his life.</p>' },
      { t: 'Uttarayan', m: 'Every January', b: '<p class="city">Every January 14, the sky over Gujarat fills with kites for Uttarayan, one of Gujarat\'s biggest festivals.</p>' },
    ],
  },
  {
    id: 'blr', tz: 'Asia/Kolkata', wlat: 12.93, wlon: 77.53, name: 'Bangalore', lat: 12.97, lon: 77.59, stamp: '#2E7D4F',
    region: 'Karnataka, India', coord: '12.97° N, 77.59° E', mood: 'Evening rush, the streetlights coming on',
    spots: [
      { t: 'PES University', m: 'Bachelor\'s degree, 2016–2020', b: '<p>I left Nadiad for Bangalore to do my bachelor\'s in mechanical engineering at PES University, 2016–2020.</p>' },
      { t: 'ANA Packaging & Trading', m: 'Founder, Jun 2020–Jul 2021 · paper-cup manufacturer', mission: 'machine', b: '<p>We sold paper cups for less than ₹1 each in a crowded commodity market. Manufacturing cost was lower, but margins were thin. Keeping the business going through COVID taught me persistence, the importance of volume, and how much small losses matter.</p><p>When the rims kept cracking, I first tried to fix the curling stage. After many iterations, we found that the paper was misaligned during folding, upstream from the visible damage. I learned to trace a fault through the whole system before changing the part where it appears.</p><p>I managed inventory and buyer-risk decisions using R/SQL analysis and A/B tests:</p><ul><li>Stockouts fell 17%</li><li>Payment defaults fell 70%</li><li>Order conversion rose 16.2%</li></ul>' },
    ],
  },
  {
    id: 'boston', tz: 'America/New_York', wlat: 42.358, wlon: -71.064, name: 'Boston', lat: 42.34, lon: -71.09, stamp: '#7A2E2E',
    region: 'Massachusetts, USA', coord: '42.34° N, 71.09° W', mood: 'A snowy winter night',
    spots: [
      { t: 'Northeastern University', m: 'Master\'s degree', mission: 'train', b: '<p>My master\'s at Northeastern: Engineering Management, with a specialisation in Data Science.</p>' },
      { t: 'My first apartment', m: 'On my own', b: '<p>Boston was the first time I lived away from my family, in another country. Alongside my master\'s at Northeastern, I learned to manage work, money and daily life, find a job, and decide what to save and what to spend.</p>' },
      { t: 'The Green Line', m: 'Getting around', b: '<p class="city">The Green Line\'s E branch runs right past campus, down Huntington Avenue.</p>' },
    ],
  },
  {
    id: 'irving', tz: 'America/Chicago', wlat: 32.869, wlon: -96.939, name: 'Irving', lat: 32.81, lon: -96.95, stamp: '#B5651D',
    region: 'Texas, USA', coord: '32.81° N, 96.95° W', mood: 'A hot, bright afternoon',
    spots: [
      { t: '7-Eleven', m: 'Data Scientist (Co-op), Jun–Dec 2022', mission: 'etl', b: '<p>Rebuilt ETL pipelines in PySpark across 10+ sources, improving data accuracy 18% and cutting KPI runtimes 23.7%; automated unsupervised clustering of 1,000+ promotional offers at 98.2% accuracy, saving 1,000+ manual hours a year.</p>' },
      { t: 'The Mustangs of Las Colinas', m: 'Irving\'s landmark', b: '<p class="city">Nine bronze mustangs gallop through a fountain in Williams Square, Irving\'s best-known sight.</p>' },
      { t: 'The store counter', m: 'Why it mattered', b: '<p>Every one of those promotions ends up as a sign on a counter like this. Grouping them automatically gave people back hours they used to spend sorting offers by hand.</p>' },
    ],
  },
  {
    id: 'seattle', tz: 'America/Los_Angeles', wlat: 47.61, wlon: -122.34, name: 'Seattle & Bellevue', short: 'Bellevue', lat: 47.61, lon: -122.20, stamp: '#2F5D6E',
    region: 'Washington, USA', coord: '47.61° N, 122.20° W', mood: 'Rain, and Mount Rainier somewhere behind the clouds',
    spots: [
      { t: 'Centific', m: 'AI Engineer, May 2024–Aug 2025', b: '<p>Bellevue was my first full-time job after my master\'s. I moved across three AI teams and learned how these systems are built, tested and shipped. It was a steep period of technical learning.</p><ul><li>Audio pipeline on Azure Blob Storage and Label Studio: 6,000+ hours a week across 6+ locales, processing time down 70%, failures down 85%, 99.5% uptime.</li><li>Human-in-the-loop speaker-label validation for noisy audio: 95%+ labeling accuracy.</li><li>Near-duplicate detection across 10+ languages, including right-to-left and character-based scripts: associated costs down 30%.</li></ul>' },
      { t: 'Catch the leak', m: 'Research: multilingual PII annotation', mission: 'pii', b: `<p><b>${PAPERS[1].title}</b>, ${PAPERS[1].venue}. ${PAPERS[1].contribution}</p><p>${PAPERS[1].method} ${PAPERS[1].demo}</p><p>${A(PAPERS[1].url, 'Read the paper on arXiv')}</p>` },
      { t: 'Agents that argue', m: 'Research: LegalWiz', mission: 'agents', b: `<p><b>${PAPERS[0].title}</b>, ${PAPERS[0].venue}. ${PAPERS[0].contribution}</p><p>${PAPERS[0].method} ${PAPERS[0].demo}</p><p>${A(PAPERS[0].url, 'Read the paper on arXiv')}</p>` },
      { t: 'The badminton court', m: 'Off hours', b: '<p>Badminton, whenever I get the chance.</p>' },
    ],
  },
  {
    id: 'sf', tz: 'America/Los_Angeles', wlat: 37.776, wlon: -122.433, name: 'San Francisco', lat: 37.77, lon: -122.42, stamp: '#C0392B',
    region: 'California, USA', coord: '37.77° N, 122.42° W', mood: 'Golden hour, the fog rolling in',
    spots: [
      { t: 'Oaklet', m: 'Founding AI/ML Engineer, Sep–Oct 2025', b: '<p>Oaklet\'s first AI engineer, in my last few months in the US.</p><ul><li>Built a healthcare appointment assistant that booked appointments, reserved calendar slots and sent emails.</li><li>Implemented a patient-intake workflow with seven question types in React, Express/TypeScript and DynamoDB, with encryption, audit logging and retry handling.</li></ul>' },
      { t: 'The view from the hill', m: 'Bigger ambitions', mission: 'goal', b: '<p>My last few months in the US were in the Bay Area, where I joined Oaklet. Conversations with founders and investors, and 48-hour hackathons, changed the scale of my ambitions. I learned to hold a long-term goal while breaking it into short steps I could actually execute.</p>' },
    ],
  },
  {
    id: 'brokai', tz: 'Asia/Kolkata', wlat: 12.986, wlon: 77.737, name: 'Bangalore, again', short: 'Bangalore', lat: 12.93, lon: 77.62, stamp: '#1F2A5C',
    region: 'Karnataka, India', coord: '12.93° N, 77.62° E', mood: 'Late night, the tech parks still lit',
    spots: [
      { t: 'Brokai Labs', m: 'Founder & Lead AI Engineer, Nov 2025–Oct 2026', mission: 'jarvis', b: `<p>I came back to India to build for Indian businesses, and founded Brokai Labs, an AI and automation agency.</p><ul><li><b>Jarvis</b>: ${PROJECTS[0].text}</li><li><b>Résumé ranking</b>: led delivery of a bulk résumé-ingestion and candidate-ranking workflow used to screen 300+ applicants.</li><li><b>Hapi</b>: ${PROJECTS[1].text}</li></ul><p><button type="button" class="go" data-founders>What I can build for you</button></p>` },
      { t: 'The salon (US client)', m: 'Voice AI for a salon in the US', mission: 'voice', b: `<p>Brokai's first paying customer was a US salon. ${PROJECTS[2].text}</p><p>${PROJECTS[2].evidenceNote}</p>` },
      { t: 'Your company here', m: 'The next stop', mission: 'lot', b: '<p>This empty lot is an invitation to imagine what we might build together.</p>' },
    ],
  },
];

// Travel legs: 'd' drive, 'f' fly.
export const LEGS = [[0, 1, 'd'], [1, 2, 'f'], [2, 3, 'd'], [3, 4, 'd'], [4, 5, 'd'], [5, 6, 'f']];

export const CONTACT = { email: 'nanddave99@gmail.com', site: 'https://nand-world-portfolio.vercel.app/', resume: './Nand_Dave_Resume.pdf', linkedin: 'https://www.linkedin.com/in/nanddave', github: 'https://github.com/nanddave' };
/** False for placeholders ('', '#', or '[...]'): such values must never render to a visitor. */
export const isReal = v => typeof v === 'string' && v.trim() !== '' && v.trim() !== '#' && !v.trim().startsWith('[');
