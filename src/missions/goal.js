// Mission: big goal, short steps. A heuristic planner: keyword scoring picks a template,
// the horizon sets how many milestones, any number in the goal is split into progressive targets.
import './missions.css';
import { esc, now, ms, tokens } from './_util.js';
import { WORLD } from '../kit/events.js';

const TEMPLATES = {
  build: { kw: ['build', 'launch', 'ship', 'startup', 'app', 'product', 'company', 'business', 'customers', 'saas', 'mvp', 'agency', 'clients', 'users'],
    phases: ['Talk to {n} people who have the problem; write down their exact words', 'Ship the smallest version that solves one painful case', 'Put it in front of real users and charge for it', 'Fix what breaks, keep what they use, cut the rest', 'Turn what worked into a repeatable way to find the next customer', 'Hire or automate the step that eats most of your week'],
    week: ['List 20 people who have this problem and message 5 of them', 'Write a one-paragraph description of the first version, and what it will not do', 'Block two 2-hour build sessions in your calendar'] },
  learn: { kw: ['learn', 'study', 'course', 'language', 'exam', 'certification', 'degree', 'master', 'skill', 'understand', 'read', 'books', 'spanish', 'python', 'math'],
    phases: ['Pick one resource and one way to test yourself', 'Finish the fundamentals; practise every day, even 20 minutes', 'Build or do one real thing with it, end to end', 'Take a practice test or teach it to someone; find the gaps', 'Close the gaps, then go for the real exam, project or conversation', 'Keep a weekly habit so it sticks'],
    week: ['Choose one course or book and delete the other options', 'Schedule five 30-minute sessions this week', 'Write down what "good enough" looks like at the end'] },
  fitness: { kw: ['run', 'marathon', '5k', '10k', 'gym', 'fit', 'fitness', 'weight', 'lose', 'strength', 'swim', 'cycle', 'yoga', 'health', 'badminton', 'kg', 'km'],
    phases: ['Get a baseline: measure where you are today', 'Build a habit of 3 sessions a week, easy effort', 'Increase load by about 10% a week; keep one rest day', 'Test yourself at a smaller target', 'Taper, recover, then do the real thing', 'Pick the next target so the habit survives'],
    week: ['Do one easy session and record the numbers', 'Put three sessions in your calendar for next week', 'Sort out sleep: same bedtime five nights'] },
  career: { kw: ['job', 'career', 'promotion', 'hired', 'interview', 'role', 'switch', 'offer', 'salary', 'resume', 'portfolio', 'manager'],
    phases: ['Name 10 target companies or roles and what they need', 'Rewrite your story: resume, profile, two proof-of-work pieces', 'Reach out to people inside, not just job boards', 'Practise interviews out loud; record and review', 'Negotiate and decide; then plan your first 90 days', 'Review: what would make the next move easier?'],
    week: ['Write the one sentence you want people to say about you', 'Send 5 messages to people doing the job you want', 'Update one proof-of-work piece'] },
  write: { kw: ['write', 'book', 'blog', 'publish', 'newsletter', 'posts', 'post', 'content', 'linkedin', 'youtube', 'podcast', 'articles', 'audience', 'followers'],
    phases: ['Pick one topic and one reader; write 3 titles you would click', 'Publish on a fixed schedule; quantity first', 'Look at what got replies; do more of that', 'Collect the best pieces into something bigger', 'Ask readers what they want next; plan the next season', 'Make the schedule automatic'],
    week: ['Publish one short piece, even if it is rough', 'Pick a fixed day and time for publishing', 'Write down 10 ideas in a single list'] },
  money: { kw: ['save', 'invest', 'money', 'revenue', 'income', 'debt', 'profit', 'budget', 'earn', 'lakh', 'crore', 'rupees', 'dollars'],
    phases: ['Write down every number: income, spend, what you owe', 'Automate the first transfer on payday', 'Cut or renegotiate the biggest two costs', 'Add one new source of income or margin', 'Review the numbers and raise the automatic amount', 'Decide what the money is for next'],
    week: ['Export last month\'s transactions and total them by category', 'Set up one automatic transfer, however small', 'Pick one cost to cancel'] },
  generic: { kw: [], phases: ['Define what done looks like, in one sentence with a number', 'Find someone who has done it; copy their first steps', 'Do the smallest real version', 'Measure what happened and adjust', 'Do the full version', 'Look back and pick the next goal'],
    week: ['Write the goal as one sentence with a date and a number', 'Ask one person who has done it for 15 minutes', 'Do one thing today that takes under an hour'] },
};
const COUNT = { 30: 3, 90: 4, 365: 6 };

export function mount(el, ctx) {
  let plans = 0;
  el.innerHTML = `<div class="ms">
    <h4>Big goal, short steps</h4>
    <p class="ms-lead">Type a goal and a time frame. The planner breaks it into milestones and a few things to do this week.</p>
    <div><label class="ms-label" for="ms-goal-in">Your goal</label><input id="ms-goal-in" class="ms-input" maxlength="140" value="Launch an AI product and get 10 paying customers"></div>
    <fieldset style="border:0;padding:0;margin:0"><legend class="ms-label">Time frame</legend><div class="ms-row">${[30, 90, 365].map(d => `<label class="ms-row" style="gap:4px;font-size:13px"><input type="radio" name="ms-hz" value="${d}" ${d === 90 ? 'checked' : ''}> ${d} days</label>`).join('')}</div></fieldset>
    <div class="ms-row"><button type="button" class="ms-btn ms-primary" data-plan>Break it down</button></div>
    <div data-r="out" aria-live="polite"></div>
    <p class="ms-note">A heuristic planner: keyword templates and simple date maths, no AI model. Treat it as a starting sketch.</p></div>`;
  const out = el.querySelector('[data-r="out"]'), inp = el.querySelector('input');
  function plan() {
    const goal = inp.value.trim() || 'my goal'; const H = +el.querySelector('input[name="ms-hz"]:checked').value; const T = now();
    const toks = tokens(goal); let t0 = now();
    const scores = Object.entries(TEMPLATES).filter(([k]) => k !== 'generic').map(([k, t]) => [k, toks.filter(w => t.kw.some(kw => w === kw || (kw.length > 3 && w.startsWith(kw)))).length]);
    scores.sort((a, b) => b[1] - a[1]); const key = scores[0][1] ? scores[0][0] : 'generic'; const tpl = TEMPLATES[key];
    ctx.work.step('Classify goal', `tokens: [${toks.join(', ')}]\nkeyword scores: ${scores.map(([k, v]) => `${k} ${v}`).join(' · ')}\ntemplate: ${key}`, { ms: ms(t0) });
    t0 = now(); const nm = goal.match(/(\d[\d,.]*)\s*(k\b|km|kg|lakh|crore|%|[\p{L}]+(?:\s+[\p{L}]+)?)?/u); const target = nm ? parseFloat(nm[1].replace(/,/g, '')) : null; const unit = (nm?.[2] || '').replace(/\s+(in|by|before|and|for|of|a|the)$/i, '');
    const n = COUNT[H]; const phases = ({ 3: [0, 2], 4: [0, 1, 2], 6: [0, 1, 2, 3, 4] })[n].map(i => tpl.phases[i]).concat(['']);
    const today = new Date(); const fmt = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const fractions = Array.from({ length: n }, (_, i) => (i + 1) / n);
    const ms_ = phases.map((p, i) => { const day = Math.round(H * Math.pow(fractions[i], 0.85)); const d = new Date(today.getTime() + day * 864e5); const pct = [0.1, 0.3, 0.6, 1][Math.min(3, Math.floor(i * 4 / n))]; const tgt = target && i >= n - 3 ? ` (target: ${Math.max(1, Math.round(target * (i === n - 1 ? 1 : pct)))}${unit ? ' ' + unit : ''})` : ''; return { day, date: fmt(d), text: p.replace('{n}', key === 'build' ? '15' : '5') + tgt }; });
    ms_[n - 1].text = `Done: ${goal}`;
    ctx.work.step('Split horizon', `horizon ${H} days -> ${n} milestones, spacing day = H·(i/n)^0.85 (front-loaded)\ndays: ${ms_.map(m => m.day).join(', ')}\nnumber in goal: ${target ?? 'none'}${unit ? ' ' + unit : ''}${target ? ' -> progressive targets on the last milestones' : ''}`, { ms: ms(t0) });
    out.innerHTML = `<div class="ms-panel"><span class="ms-label">${n} milestones over ${H} days</span><ol class="ms-timeline">${ms_.map(m => `<li><small>day ${m.day} · ${esc(m.date)}</small><b>${esc(m.text)}</b></li>`).join('')}</ol></div>
      <div class="ms-panel"><span class="ms-label">This week</span><ol class="ms-week">${tpl.week.map(w => `<li>${esc(w)}</li>`).join('')}</ol></div>`;
    ctx.work.step('Plan ready', `${n} milestones + ${tpl.week.length} actions for this week (template "${key}")`, { ms: ms(T), kind: 'result' });
    WORLD.emit('goal:planned', { milestones: n }); ctx.work.step('World updated', 'a flare of light at the San Francisco viewpoint', { ms: 0 });
    if (++plans === 1) ctx.complete();
  }
  el.querySelector('[data-plan]').addEventListener('click', plan);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') plan(); });
  return { unmount() { el.innerHTML = ''; } };
}
