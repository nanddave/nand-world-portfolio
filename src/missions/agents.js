// Mission: agents that argue. Three deterministic "agents" find contradictions in a short lease:
// Extractor (clause -> party/modality/action/condition/numbers), Comparer (pairs same party+action), Judge (scores + verdict).
// A deterministic stand-in for the LLM agents in LegalWiz.
import './missions.css';
import { esc, lifetime, now, ms, pretty, json } from './_util.js';
import { WORLD } from '../kit/events.js';

const DEFAULT = `1. This lease begins on 1 January 2026 and runs for a fixed term of 12 months.
2. The Tenant must pay rent of ₹25,000 on or before the 1st day of each month.
3. The Tenant may terminate this lease at any time by giving 30 days' written notice.
4. Neither party may terminate this lease before the end of the fixed term.
5. Rent is due on the 5th day of each month.
6. The Landlord must return the security deposit within 30 days of the lease ending.
7. Either party may terminate this lease at the end of the fixed term with 30 days' notice.
8. The Tenant must not sublet the premises without the Landlord's written consent.`;

const ACTIONS = [
  ['terminate', /\b(terminat\w*|end (?:this|the) lease|cancel\w*)\b/i],
  ['pay_rent', /\b(pay\w* rent|rent (?:is|shall be) due|rent of)\b/i],
  ['return_deposit', /\b(return\w* the (?:security )?deposit)\b/i],
  ['sublet', /\b(sublet\w*|assign\w*)\b/i],
  ['enter', /\b(enter\w* the premises|access the premises)\b/i],
  ['term', /\b(fixed term of|lease begins)\b/i],
];

function extract(text) {
  const raw = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  return raw.map((line, i) => {
    const m = line.match(/^(\d+(?:\.\d+)*)[.)]?\s+(.*)$/); const id = m ? m[1] : String(i + 1); const s = m ? m[2] : line;
    const party = /\b(neither|either|both) part(y|ies)\b|\bthe parties\b/i.test(s) ? 'both' : /\btenant\b/i.test(s.split(/\b(?:must|may|shall|is|will)\b/i)[0]) ? 'tenant' : /\blandlord\b/i.test(s.split(/\b(?:must|may|shall|is|will)\b/i)[0]) ? 'landlord' : /\brent\b/i.test(s) ? 'tenant (implied)' : null;
    const modality = /\b(must not|shall not|may not|cannot|is not permitted)\b/i.test(s) || /\bneither\b.*\bmay\b/i.test(s) ? 'must-not' : /\b(must|shall|is due|are due|is required)\b/i.test(s) ? 'must' : /\b(may|can|is entitled)\b/i.test(s) ? 'may' : 'states';
    const action = (ACTIONS.find(([, re]) => re.test(s)) || [null])[0];
    const dayOfMonth = (s.match(/\b(\d{1,2})(?:st|nd|rd|th) day\b/i) || [])[1];
    const durations = [...s.matchAll(/\b(\d+)\s+(day|month|hour|week)s?'?\b/gi)].map(x => `${x[1]} ${x[2].toLowerCase()}s`);
    const amount = (s.match(/[₹$€]\s?[\d,]+/) || [])[0];
    const cond = (s.match(/\b(at any time|before the end of [^,.]+|at the end of [^,.]+|by giving [^,.]+|with [^,.]*notice|within [^,.]+|without [^,.]+|on or before [^,.]+)/gi) || []);
    const scope = /at any time/i.test(s) ? 'anytime' : /before the end|during the (fixed )?term/i.test(s) ? 'before_end' : /at the end|after the (fixed )?term|on expiry/i.test(s) ? 'at_end' : null;
    return { id, text: s, party, modality, action, condition: cond, scope, numbers: { ...(dayOfMonth ? { day_of_month: +dayOfMonth } : {}), ...(durations.length ? { durations } : {}), ...(amount ? { amount } : {}) } };
  });
}
const partyOverlap = (a, b) => { const n = p => (p || '').replace(' (implied)', ''); a = n(a); b = n(b); return a && b && (a === b || a === 'both' || b === 'both'); };
const scopeOverlap = (a, b) => !a || !b || a === 'anytime' || b === 'anytime' || a === b;
function compare(cl) {
  const out = [];
  for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) {
    const A = cl[i], B = cl[j]; if (!A.action || A.action !== B.action || A.action === 'term' || !partyOverlap(A.party, B.party)) continue;
    const flags = [];
    const mods = [A.modality, B.modality].sort().join('/');
    if (mods === 'may/must-not' || mods === 'must/must-not') flags.push({ kind: 'opposite_modality', detail: `${A.modality} vs ${B.modality}` });
    if (A.numbers.day_of_month && B.numbers.day_of_month && A.numbers.day_of_month !== B.numbers.day_of_month) flags.push({ kind: 'conflicting_date', detail: `day ${A.numbers.day_of_month} vs day ${B.numbers.day_of_month}` });
    out.push({ pair: [A.id, B.id], action: A.action, parties: [A.party, B.party], scopes: [A.scope, B.scope], flags });
  }
  return out;
}
function judge(pairs) {
  return pairs.map(p => {
    let conf = 0; const why = [];
    for (const f of p.flags) {
      if (f.kind === 'opposite_modality') { conf = Math.max(conf, 0.55); why.push(`opposite obligations (${f.detail}) on "${p.action}"`); if (scopeOverlap(...p.scopes)) { conf += 0.3; why.push(`timing overlaps (${p.scopes.map(s => s || 'unspecified').join(' vs ')})`); } else { conf -= 0.4; why.push(`but timing is disjoint (${p.scopes.join(' vs ')}), so both can hold`); } }
      if (f.kind === 'conflicting_date') { conf = Math.max(conf, 0.6) + 0.25; why.push(`same obligation, different dates (${f.detail})`); }
    }
    if (p.parties[0] === p.parties[1]) conf += 0.05;
    if (!p.flags.length) why.push('same modality and no conflicting numbers');
    conf = Math.max(0, Math.min(0.99, conf));
    return { pair: p.pair, confidence: +conf.toFixed(2), verdict: conf >= 0.6 ? 'CONTRADICTION' : 'compatible', reasoning: why.join('; ') };
  });
}

export function mount(el, ctx) {
  const L = lifetime(); let busy = false, runs = 0;
  el.innerHTML = `<div class="ms">
    <h4>Agents that argue</h4>
    <p class="ms-lead">A short lease with problems planted in it. Three agents read it in turn: one extracts, one compares, one judges. Edit the clauses and run them again.</p>
    <div><label class="ms-label" for="ms-ag-in">Lease clauses</label><textarea id="ms-ag-in" class="ms-textarea" style="min-height:170px"></textarea></div>
    <div class="ms-row"><button type="button" class="ms-btn ms-primary" data-run>Run the agents</button><span class="ms-mono" data-r="st"></span></div>
    <div class="ms-trace" data-r="trace" aria-live="polite"></div>
    <div data-r="res"></div>
    <p class="ms-note">A deterministic stand-in for the LLM agents (patterns and rules, no model). LegalWiz is a multi-agent framework for contradiction detection in legal documents (NeurIPS 2025 GenProCC workshop; Nand is a co-author).</p></div>`;
  const ta = el.querySelector('textarea'), $ = r => el.querySelector(`[data-r="${r}"]`); ta.value = DEFAULT;
  const msg = (who, color, html, data) => { $('trace').insertAdjacentHTML('beforeend', `<div class="ms-msg"><div class="ms-av" style="background:${color}">${who[0]}</div><div class="ms-bubble"><b>${who}</b><div>${html}</div>${data ? `<details><summary class="ms-mono">output JSON</summary><pre class="ms-json">${esc(pretty(data))}</pre></details>` : ''}</div></div>`); };

  async function run() {
    if (busy) return; busy = true; runs++; const btn = el.querySelector('[data-run]'); btn.disabled = true; $('trace').innerHTML = ''; $('res').innerHTML = '';
    const wait = () => L.sleep(ctx.reduceMotion ? 50 : 900);
    let t0 = now(); const clauses = extract(ta.value); const t1 = ms(t0);
    ctx.work.step('Extractor agent', `input: ${ta.value.length} chars -> ${clauses.length} clauses\n${clauses.map(c => `${c.id}: ${json({ party: c.party, modality: c.modality, action: c.action, scope: c.scope, ...c.numbers })}`).join('\n')}`, { ms: t1 });
    msg('Extractor', '#2F5D6E', `Split the lease into <b>${clauses.length}</b> clauses and pulled out who must, may or must not do what.<div class="ms-mono" style="margin-top:4px">${clauses.filter(c => c.action).map(c => `§${esc(c.id)} ${esc(c.party || '?')} · ${esc(c.modality)} · ${esc(c.action)}`).join('<br>')}</div>`, clauses);
    if (!await wait()) return;
    t0 = now(); const pairs = compare(clauses); const t2 = ms(t0); const flagged = pairs.filter(p => p.flags.length);
    ctx.work.step('Comparer agent', `${clauses.length} clauses -> ${clauses.length * (clauses.length - 1) / 2} possible pairs -> ${pairs.length} share party+action -> ${flagged.length} flagged\n${pairs.map(p => `§${p.pair.join(' vs §')} [${p.action}] ${p.flags.map(f => f.kind + ': ' + f.detail).join(', ') || 'no flag'}`).join('\n')}`, { ms: t2 });
    msg('Comparer', '#B5651D', pairs.length ? `Paired clauses about the same party and action: <b>${pairs.length}</b> pairs, <b>${flagged.length}</b> flagged.<div class="ms-mono" style="margin-top:4px">${pairs.map(p => `§${p.pair.join(' ↔ §')}: ${p.flags.map(f => esc(f.detail)).join(', ') || 'no flag'}`).join('<br>')}</div>` : 'No two clauses talk about the same party and action.', pairs);
    if (!await wait()) return;
    t0 = now(); const verdicts = judge(flagged); const t3 = ms(t0); const bad = verdicts.filter(v => v.verdict === 'CONTRADICTION');
    ctx.work.step('Judge agent', `${flagged.length} flagged pairs scored (threshold 0.60)\n${verdicts.map(v => `§${v.pair.join(' vs §')}: ${v.verdict} (${v.confidence}) — ${v.reasoning}`).join('\n') || 'nothing to judge'}`, { ms: t3 });
    msg('Judge', '#7A2E2E', verdicts.length ? verdicts.map(v => `<div style="margin-bottom:4px"><span class="ms-tag" style="${v.verdict === 'CONTRADICTION' ? 'background:#FDECEA;border-color:#F0473C' : ''}">${v.verdict} ${v.confidence.toFixed(2)}</span> §${v.pair.join(' ↔ §')}: ${esc(v.reasoning)}.</div>`).join('') : 'Nothing flagged, so nothing to rule on.', verdicts);
    const hot = new Set(bad.flatMap(v => v.pair));
    $('res').innerHTML = `<div><span class="ms-label">Clauses</span>${clauses.map(c => `<div class="ms-clause ${hot.has(c.id) ? 'ms-conflict' : ''}"><b>§${esc(c.id)}</b>${esc(c.text)}</div>`).join('')}</div><div class="ms-result ${bad.length ? 'ms-warn' : ''}">${bad.length ? `${bad.length} contradiction${bad.length > 1 ? 's' : ''} found: ${bad.map(v => '§' + v.pair.join(' vs §')).join(', ')}.` : 'No contradictions found.'}${verdicts.length > bad.length ? ` ${verdicts.length - bad.length} flagged pair${verdicts.length - bad.length > 1 ? 's were' : ' was'} judged compatible.` : ''}</div>`;
    $('st').textContent = `3 agents, ${Math.round((t1 + t2 + t3) * 10) / 10} ms of compute`;
    ctx.work.step('Verdict', `${bad.length} contradiction(s): ${bad.map(v => '§' + v.pair.join('/§')).join(', ') || 'none'}`, { kind: 'result' });
    WORLD.emit('agents:verdict', { contradictions: bad.length }); ctx.work.step('World updated', 'Bellevue towers pulse with light', { ms: 0 });
    busy = false; btn.disabled = false; btn.textContent = 'Run again'; if (runs === 1) ctx.complete();
  }
  el.querySelector('[data-run]').addEventListener('click', run);
  return { unmount() { L.kill(); el.innerHTML = ''; } };
}
