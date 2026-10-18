// Mission: Slack -> Linear. A step-by-step agent pipeline with mock tools:
// classify intent (rules) -> extract entities (team, priority, due date) -> search_issues (token overlap) -> create_issue.
// Mock tools; the real Jarvis connects to Slack and Linear.
import './missions.css';
import { esc, lifetime, now, ms, pretty, json, tokens, STOP, jaccard } from './_util.js';
import { WORLD } from '../kit/events.js';

const DEFAULT = '@jarvis checkout is timing out for some users on mobile. Can someone from payments look before the weekend? It\'s blocking orders.';
const MOCK_ISSUES = [
  { id: 'PAY-204', title: 'Refund webhook retries twice', state: 'Done' },
  { id: 'PAY-212', title: 'Checkout payment step slow on mobile app', state: 'In Progress' },
  { id: 'MOB-88', title: 'Dark mode colours wrong on settings screen', state: 'Todo' },
  { id: 'PLT-141', title: 'Upgrade database connection pool', state: 'Backlog' },
  { id: 'PAY-215', title: 'Add UPI as a payment option at checkout', state: 'Todo' },
  { id: 'ID-57', title: 'Login link expires too quickly', state: 'In Progress' },
  { id: 'SRCH-30', title: 'Search results ignore out-of-stock filter', state: 'Todo' },
];
const INTENTS = {
  bug_report: ['timing', 'timeout', 'error', 'broken', 'crash', 'crashing', 'failing', 'fails', 'bug', 'blocking', 'down', 'slow', 'wrong', 'stuck', 'not'],
  feature_request: ['add', 'support', 'could', 'would', 'nice', 'feature', 'option', 'allow', 'new'],
  question: ['how', 'what', 'why', 'where', 'when', 'anyone', 'know'],
};
const TEAMS = [['Payments', 'PAY', /\b(payments?|checkout|refund|upi|card)\b/i], ['Mobile', 'MOB', /\b(ios|android|app)\b/i], ['Identity', 'ID', /\b(login|auth|password|sso)\b/i], ['Search', 'SRCH', /\bsearch\b/i], ['Platform', 'PLT', /\b(server|database|deploy|infra|latency)\b/i]];
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function dueFrom(text, today) {
  const t = text.toLowerCase(); const d = new Date(today); d.setHours(0, 0, 0, 0); const add = n => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const next = dow => add(((dow - d.getDay() + 7) % 7) || 7);
  let m;
  if (/\b(today|eod|end of day|tonight)\b/.test(t)) return [d, 'today'];
  if (/\btomorrow\b/.test(t)) return [add(1), 'tomorrow'];
  if (/before the weekend|by the weekend|end of (the )?week|this week/.test(t)) return [d.getDay() >= 5 || d.getDay() === 0 ? next(5) : add(5 - d.getDay()), 'before the weekend → Friday'];
  if (/next week/.test(t)) return [next(1), 'next week → Monday'];
  if ((m = t.match(/\bin (\d+) days?\b/))) return [add(+m[1]), `in ${m[1]} days`];
  if ((m = t.match(new RegExp(`\\b(?:by|on|before) (${DAYS.join('|')})\\b`)))) return [next(DAYS.indexOf(m[1])), `by ${m[1]}`];
  return [null, 'no date phrase'];
}

export function mount(el, ctx) {
  const L = lifetime(); let busy = false, runs = 0;
  el.innerHTML = `<div class="ms">
    <h4>Slack to Linear</h4>
    <p class="ms-lead">Someone asks for help in Slack. Watch the agent read it, check for duplicates and file a ticket. Edit the message to see it change.</p>
    <div class="ms-slack"><div class="ms-who">Priya <span>#product · made-up example</span></div><label class="sr" for="ms-jv-in">Slack message</label><textarea id="ms-jv-in" class="ms-textarea" style="min-height:80px;border:0;padding:4px 0;background:transparent"></textarea></div>
    <div class="ms-row"><button type="button" class="ms-btn ms-primary" data-send>Send to Jarvis</button><span class="ms-mono" data-r="st"></span></div>
    <div class="ms-trace" data-r="trace" aria-live="polite"></div>
    <div data-r="res"></div>
    <p class="ms-note">Mock tools with a made-up issue list; the steps are rules, not a model. The real Jarvis connects to Slack and Linear.</p></div>`;
  const ta = el.querySelector('textarea'), $ = r => el.querySelector(`[data-r="${r}"]`); ta.value = DEFAULT;
  const stepUI = (n, title, html, data) => $('trace').insertAdjacentHTML('beforeend', `<div class="ms-msg"><div class="ms-av" style="background:#1F2A5C">${n}</div><div class="ms-bubble"><b>${esc(title)}</b><div>${html}</div>${data ? `<details><summary class="ms-mono">JSON</summary><pre class="ms-json">${esc(pretty(data))}</pre></details>` : ''}</div></div>`);

  async function send() {
    if (busy) return; busy = true; runs++; const btn = el.querySelector('[data-send]'); btn.disabled = true; $('trace').innerHTML = ''; $('res').innerHTML = '';
    const wait = () => L.sleep(ctx.reduceMotion ? 50 : 800); const msg = ta.value.replace(/@jarvis\b/i, '').trim(); const T = now();
    // 1 classify
    let t0 = now(); const toks = tokens(msg); const sc = Object.fromEntries(Object.entries(INTENTS).map(([k, kw]) => [k, toks.filter(w => kw.includes(w)).length + (k === 'question' && msg.includes('?') ? 0.5 : 0)]));
    const intent = Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0]; const out1 = { intent, scores: sc };
    ctx.work.step('classify_intent (rules)', `input: "${msg}"\noutput: ${json(out1)}`, { ms: ms(t0) }); stepUI(1, 'Classify intent', `Looks like a <b>${intent.replace('_', ' ')}</b>.`, out1); if (!await wait()) return;
    // 2 entities
    t0 = now(); const team = TEAMS.find(([, , re]) => re.test(msg)) || ['Triage', 'TRI'];
    const platform = /\b(mobile|ios|android|app)\b/i.test(msg) ? 'mobile' : /\b(web|browser|desktop)\b/i.test(msg) ? 'web' : null;
    const pr = /\b(urgent|asap|blocking|blocker|down|outage|all users|everyone)\b/i.exec(msg); const pr2 = /\b(today|tomorrow|weekend|soon)\b/i.exec(msg);
    const priority = pr ? 'Urgent' : pr2 ? 'High' : 'Medium';
    const today = new Date(); const [due, duePhrase] = dueFrom(msg, today);
    const first = msg.split(/(?<=[.!?])\s+/)[0].replace(/[.!?]+$/, ''); const title = (first[0]?.toUpperCase() + first.slice(1)).slice(0, 70);
    const ents = { team: team[0], platform, priority, priority_cue: pr?.[0] || pr2?.[0] || null, due_date: due ? ymd(due) : null, due_phrase: duePhrase, today: ymd(today), title };
    ctx.work.step('extract_entities (rules)', `output: ${json(ents)}`, { ms: ms(t0) }); stepUI(2, 'Extract details', `Team <b>${esc(ents.team)}</b>, priority <b>${ents.priority}</b>${ents.priority_cue ? ` (because “${esc(ents.priority_cue)}”)` : ''}, due <b>${ents.due_date || 'not set'}</b> (${esc(duePhrase)}).`, ents); if (!await wait()) return;
    // 3 search
    t0 = now(); const q = [...new Set(tokens(title + ' ' + (platform || '')).filter(w => !STOP.has(w) && w.length > 2))];
    const hits = MOCK_ISSUES.map(i => ({ ...i, score: +jaccard(q, tokens(i.title).filter(w => !STOP.has(w) && w.length > 2)).toFixed(2) })).sort((a, b) => b.score - a.score).slice(0, 3);
    const dup = hits[0].score >= 0.2 ? hits[0] : null; const call3 = { tool: 'search_issues', args: { query: q.join(' ') }, result: hits.map(h => ({ id: h.id, title: h.title, state: h.state, overlap: h.score })) };
    ctx.work.step('tool: search_issues (mock)', `query tokens: [${q.join(', ')}]\nJaccard vs ${MOCK_ISSUES.length} mock issues -> top: ${hits.map(h => `${h.id} ${h.score}`).join(', ')}\npossible duplicate: ${dup ? dup.id : 'none (threshold 0.2)'}`, { ms: ms(t0) });
    stepUI(3, 'search_issues', dup ? `Possible duplicate: <b>${dup.id}</b> “${esc(dup.title)}” (${dup.state}, overlap ${dup.score}). Similar, not identical: I'll file a new ticket and link it so a human can merge if needed.` : 'No similar open issue found.', call3); if (!await wait()) return;
    // 4 create
    t0 = now(); const id = `${team[1]}-${219 + runs - 1}`;
    const payload = { title: (platform ? `[${platform[0].toUpperCase() + platform.slice(1)}] ` : '') + title, team: team[0], priority, dueDate: ents.due_date, labels: [intent.replace('_', '-'), ...(platform ? [platform] : [])], relatedTo: dup ? [dup.id] : [], description: `Reported in #product by Priya:\n> ${msg}` };
    const res = { tool: 'create_issue', args: payload, result: { id, url: `https://linear.example/${id}`, state: 'Triage' } };
    ctx.work.step('tool: create_issue (mock)', `args: ${json(payload)}\nresult: ${json(res.result)}`, { ms: ms(t0) }); stepUI(4, 'create_issue', `Created <b>${id}</b> and replied in the thread.`, res);
    $('res').innerHTML = `<div class="ms-ticket"><span class="ms-tid">${id} · ${esc(team[0])} · Triage</span><h5>${esc(payload.title)}</h5><div class="ms-meta"><span class="ms-tag" style="${priority === 'Urgent' ? 'background:#FDECEA;border-color:#F0473C' : ''}">${priority}</span>${payload.dueDate ? `<span class="ms-tag">Due ${payload.dueDate}</span>` : ''}${payload.labels.map(l => `<span class="ms-tag">${esc(l)}</span>`).join('')}${dup ? `<span class="ms-tag">Related ${dup.id}</span>` : ''}</div><p style="margin-top:8px;font-size:12px;color:var(--ink-soft)">Jarvis in thread: “Filed ${id} for ${esc(team[0])}${payload.dueDate ? `, due ${payload.dueDate}` : ''}.${dup ? ` Linked ${dup.id}, which looks related.` : ''}”</p></div>`;
    $('st').textContent = `4 steps in ${ms(T)} ms (pauses are for reading)`;
    ctx.work.step('Done', `Slack message -> ${id} (${priority}, ${team[0]})`, { kind: 'result' });
    WORLD.emit('jarvis:ticket', { id }); ctx.work.step('World updated', 'Brokai office windows flash in a ripple', { ms: 0 });
    busy = false; btn.disabled = false; btn.textContent = 'Send again'; if (runs === 1) ctx.complete();
  }
  el.querySelector('[data-send]').addEventListener('click', send);
  return { unmount() { L.kill(); el.innerHTML = ''; } };
}
