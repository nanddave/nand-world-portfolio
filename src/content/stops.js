// Single source of truth for the story. Facts here are user-confirmed or clearly marked placeholders.
// Rules: never invent metrics, titles, dates or stories. Placeholders use <p class="todo">…</p>.
// spot.mission = id of an interactive mission in src/missions/ (optional).
// tz = IANA zone for live local time; wlat/wlon = where live weather is read (src/core/live.js). lat/lon stay for the globe.
// spot order MUST match the C.spot(...) calls in the city's build().

export const STOPS = [
  {
    id: 'nadiad', tz: 'Asia/Kolkata', wlat: 22.69, wlon: 72.86, name: 'Nadiad', lat: 22.69, lon: 72.86, stamp: '#C2571A',
    region: 'Gujarat, India', coord: '22.69° N, 72.86° E', mood: 'A warm, dusty morning',
    spots: [
      { t: 'The lane I grew up on', m: 'Home', b: '<p class="city">Nadiad is a small city in Gujarat\'s Kheda district, the heart of India\'s dairy belt.</p><p class="todo">Your story: growing up here, your family, what you did as a kid.</p>' },
      { t: 'Santram Mandir', m: 'The town', b: '<p class="city">The white spires of the Santram Mandir are Nadiad\'s best-known landmark.</p><p class="todo">Your memory of the temple, or of the town around it.</p>' },
      { t: 'The family farm', m: 'Family', b: '<p>My family runs a dairy farm in Nadiad.</p><p class="todo">Your story: what the farm taught you about running something real.</p>' },
      { t: 'Uttarayan', m: 'Every January', b: '<p class="city">Every January 14, the sky over Gujarat fills with kites for Uttarayan.</p><p class="todo">Your Uttarayan story: the rooftops, the cut kites, the people.</p>' },
    ],
  },
  {
    id: 'blr', tz: 'Asia/Kolkata', wlat: 12.93, wlon: 77.53, name: 'Bangalore', lat: 12.97, lon: 77.59, stamp: '#2E7D4F',
    region: 'Karnataka, India', coord: '12.97° N, 77.59° E', mood: 'Evening rush, the streetlights coming on',
    spots: [
      { t: 'PES University', m: 'Bachelor\'s degree', b: '<p>I left Nadiad for Bangalore to do my bachelor\'s in mechanical engineering at PES University.</p><p class="todo">Add: years, and one story from campus.</p>' },
      { t: 'ANA Packaging & Trading', m: 'A year at a paper-cup factory, 2020–21', mission: 'machine', b: '<p>Right after my bachelor\'s I spent a year at ANA, making paper cups. We sold them for under ₹1 each in a commodity market with thin margins, so volume and waste decided everything.</p><p>I learned the machines by repairing them. The year ran straight through COVID, and we kept the factory going.</p>' },
      { t: 'The darshini', m: 'Life in Bangalore', b: '<p class="city">Bangalore runs on filter coffee from standing-room darshinis, and on traffic you learn to plan your day around.</p><p class="todo">Your story: friends, where you lived, your weekends.</p>' },
    ],
  },
  {
    id: 'boston', tz: 'America/New_York', wlat: 42.358, wlon: -71.064, name: 'Boston', lat: 42.34, lon: -71.09, stamp: '#7A2E2E',
    region: 'Massachusetts, USA', coord: '42.34° N, 71.09° W', mood: 'A snowy winter night',
    spots: [
      { t: 'Northeastern University', m: 'Master\'s degree', mission: 'train', b: '<p>My master\'s, at Northeastern.</p><p class="todo">Add: your program, and what you built or studied here.</p>' },
      { t: 'My first apartment', m: 'On my own', b: '<p>The first time I lived on my own, in another country: managing money, work and life at the same time.</p><p class="todo">One small story from that apartment.</p>' },
      { t: 'The Green Line', m: 'Getting around', b: '<p class="city">The Green Line\'s E branch runs right past campus, down Huntington Avenue.</p><p class="todo">Your story: your first Boston winter.</p>' },
    ],
  },
  {
    id: 'irving', tz: 'America/Chicago', wlat: 32.869, wlon: -96.939, name: 'Irving', lat: 32.81, lon: -96.95, stamp: '#B5651D',
    region: 'Texas, USA', coord: '32.81° N, 96.95° W', mood: 'A hot, bright afternoon',
    spots: [
      { t: '7-Eleven', m: 'Data Scientist (Co-op), Jun–Dec 2022', mission: 'etl', b: '<p>Rebuilt ETL pipelines in PySpark across 10+ sources, improving data accuracy 18% and cutting KPI runtimes 23.7%; automated unsupervised clustering of 1,000+ promotional offers at 98.2% accuracy, saving 1,000+ manual hours a year.</p>' },
      { t: 'The Mustangs of Las Colinas', m: 'Irving\'s landmark', b: '<p class="city">Nine bronze mustangs gallop through a fountain in Williams Square, Irving\'s best-known sight.</p><p class="todo">Your story: a Texas summer and fall.</p>' },
      { t: 'The store counter', m: 'Why it mattered', b: '<p>Every one of those promotions ends up as a sign on a counter like this. Grouping them automatically gave people back hours they used to spend sorting offers by hand.</p>' },
    ],
  },
  {
    id: 'seattle', tz: 'America/Los_Angeles', wlat: 47.61, wlon: -122.34, name: 'Seattle & Bellevue', short: 'Bellevue', lat: 47.61, lon: -122.20, stamp: '#2F5D6E',
    region: 'Washington, USA', coord: '47.61° N, 122.20° W', mood: 'Rain, and Mount Rainier somewhere behind the clouds',
    spots: [
      { t: 'Centific', m: 'AI, May 2024–Aug 2025', b: '<p>My first full-time role after my master\'s, in Bellevue. I worked across three AI teams and learned how AI systems are actually built, tested and shipped.</p>' },
      { t: 'Catch the leak', m: 'Research: multilingual PII annotation', mission: 'pii', b: '<p><b>Scalable Multilingual PII Annotation for Responsible AI in LLMs</b>, IEEE ICDM Workshops 2025. Published while at Centific.</p>' },
      { t: 'Agents that argue', m: 'Research: LegalWiz', mission: 'agents', b: '<p><b>LegalWiz</b>: a multi-agent framework for contradiction detection in legal documents, NeurIPS 2025 GenProCC workshop (co-author). Published while at Centific.</p>' },
      { t: 'The badminton court', m: 'Off hours', b: '<p>Badminton, whenever I get the chance.</p><p class="todo">Your story: the people you played with.</p>' },
    ],
  },
  {
    id: 'sf', tz: 'America/Los_Angeles', wlat: 37.776, wlon: -122.433, name: 'San Francisco', lat: 37.77, lon: -122.42, stamp: '#C0392B',
    region: 'California, USA', coord: '37.77° N, 122.42° W', mood: 'Golden hour, the fog rolling in',
    spots: [
      { t: 'Oaklet', m: 'Sep–Oct 2025', b: '<p>Delivered work at Oaklet in my last few months in the US.</p><p class="todo">Add: what you built here.</p>' },
      { t: 'The view from the hill', m: 'Bigger ambitions', mission: 'goal', b: '<p>Being around founders and investors here made my ambitions much bigger. It also taught me to break them into short steps I could actually ship.</p>' },
    ],
  },
  {
    id: 'brokai', tz: 'Asia/Kolkata', wlat: 12.986, wlon: 77.737, name: 'Bangalore, again', short: 'Bangalore', lat: 12.93, lon: 77.62, stamp: '#1F2A5C',
    region: 'Karnataka, India', coord: '12.93° N, 77.62° E', mood: 'Late night, the tech parks still lit',
    spots: [
      { t: 'Brokai Labs', m: 'Founder, Nov 2025–now', mission: 'jarvis', b: '<p>I came back to India to build for Indian businesses, and founded Brokai Labs, an AI and automation agency.</p><p>One of our builds is <b>Jarvis</b>, an agent that turns a request in Slack into a ticket in Linear.</p>' },
      { t: 'The salon (US client)', m: 'Voice AI for a salon in the US', mission: 'voice', b: '<p>Brokai built a voice receptionist for a salon client in the US. In a typical month it handles about 300 calls and 240 confirmed bookings.</p>' },
      { t: 'Your company here', m: 'The next stop', mission: 'lot', b: '<p>This plot is empty on purpose. Tell me what your team builds and I\'ll put up a first sketch of where I\'d start.</p>' },
    ],
  },
];

// Travel legs: 'd' drive, 'f' fly.
export const LEGS = [[0, 1, 'd'], [1, 2, 'f'], [2, 3, 'd'], [3, 4, 'd'], [4, 5, 'd'], [5, 6, 'f']];

export const CONTACT = { email: '[your email]', site: '[your link]', resume: '#', linkedin: '#', github: 'https://github.com/nanddave' };
/** False for placeholders ('', '#', or '[...]'): such values must never render to a visitor. */
export const isReal = v => typeof v === 'string' && v.trim() !== '' && v.trim() !== '#' && !v.trim().startsWith('[');
