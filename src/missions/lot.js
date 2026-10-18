// Mission: the empty lot. The visitor says what their team builds; a building with their name goes up
// (scene.raiseLot) and a generic three-part first sketch is filled from keywords in their sentence.
import './missions.css';
import { esc, now, ms, tokens } from './_util.js';
import { VISITOR } from '../core/visitor.js';
import { isReal } from '../content/stops.js';

const INDUSTRIES = [
  ['health', /clinic|hospital|dental|dentist|doctor|patient|health|pharma|care/i, 'patient calls, WhatsApp messages and appointment requests', 'answer routine questions, book and reschedule appointments, send reminders', 'diagnosis, anything clinical, and unhappy patients'],
  ['logistics', /logistic|deliver|shipping|freight|fleet|warehouse|supply/i, 'orders, driver updates and customer "where is it?" messages', 'read order changes, update tracking, answer status questions, flag delays', 'routing trade-offs, claims and key accounts'],
  ['finance', /financ|fintech|lend|loan|bank|insur|payment|account|invoice|tax/i, 'documents, invoices and customer emails', 'extract fields from documents, match invoices, draft replies, chase missing papers', 'credit and risk calls, exceptions and anything regulatory'],
  ['software', /saas|software|platform|api|developer|devtool|app|product/i, 'support tickets, Slack requests and bug reports', 'triage and route tickets, find duplicates, draft first answers, file issues', 'roadmap priorities and customer commitments'],
  ['commerce', /retail|e-?commerce|shop|store|brand|d2c|restaurant|food|salon/i, 'orders, customer messages and returns', 'answer order questions, process simple returns, tag and route complaints', 'refund exceptions, pricing and promotions'],
  ['services', /agency|consult|legal|law|recruit|hiring|staffing|marketing|education|school/i, 'client briefs, emails and documents', 'summarise briefs, draft first versions, keep the CRM up to date, prepare follow-ups', 'the advice itself, pricing and client relationships'],
];
const CHANNELS = [['WhatsApp', /whatsapp/i], ['phone calls', /\bcalls?\b|phone/i], ['email', /e-?mail/i], ['Slack', /slack/i], ['forms', /\bforms?\b/i], ['documents', /document|pdf|contract/i], ['tickets', /ticket/i], ['orders', /\borders?\b/i]];

export function mount(el, ctx) {
  let raised = false; const email = ctx.contact?.email || '';
  el.innerHTML = `<div class="ms">
    <h4>Your company here</h4>
    <p class="ms-lead">Tell me what your team builds and a building goes up on this lot, with a first sketch of where I'd start.</p>
    <div><label class="ms-label" for="ms-lot-in">What does your team build?</label><input id="ms-lot-in" class="ms-input" maxlength="160" placeholder="e.g. We run a chain of dental clinics in tier-2 cities"></div>
    ${VISITOR.company ? '' : '<div><label class="ms-label" for="ms-lot-name">Company name (optional)</label><input id="ms-lot-name" class="ms-input" maxlength="28" placeholder="Your company"></div>'}
    <div class="ms-row"><button type="button" class="ms-btn ms-primary" data-raise>Build it</button><span class="ms-mono" data-r="st"></span></div>
    <div data-r="out" aria-live="polite"></div>
    <p class="ms-note">A generic sketch from keywords in your sentence, not advice about your company. The real version starts with a conversation.</p></div>`;
  const $ = r => el.querySelector(`[data-r="${r}"]`), inp = el.querySelector('#ms-lot-in');
  function raise() {
    const text = inp.value.trim() || 'We build software for small businesses'; const T = now();
    const typed = el.querySelector('#ms-lot-name')?.value.trim();
    const words = tokens(text).filter(w => !['we', 'our', 'a', 'an', 'the', 'build', 'make', 'run', 'team', 'company', 'for', 'in', 'of', 'and', 'that', 'is', 'are', 'i', 'my', 'to', 'chain'].includes(w));
    const shortName = (VISITOR.company || typed || words.slice(0, 2).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || 'Your Co').replace(/[^\p{L}\p{N} &.\-]/gu, '').slice(0, 18);
    const ind = INDUSTRIES.find(([, re]) => re.test(text)); const chans = CHANNELS.filter(([, re]) => re.test(text)).map(c => c[0]);
    const [key, , arrives, ai, decides] = ind || ['general', null, 'emails, calls and requests from customers and colleagues', 'sort and route incoming work, extract the details, draft first replies', 'anything with money, risk or a relationship on the line'];
    const arrivesTxt = chans.length ? `${chans.join(', ').replace(/, ([^,]*)$/, ' and $1')}, as you mentioned, plus whatever lands in someone's inbox today` : arrives;
    ctx.work.step('Read your sentence', `input: "${text}"\nkeywords: [${words.slice(0, 10).join(', ')}]\nmatched sector: ${key}\nchannels mentioned: ${chans.join(', ') || 'none'}`, { ms: ms(T) });
    let ok = false; try { ctx.scene?.raiseLot?.(shortName); ok = !!ctx.scene?.raiseLot; } catch (e) { ctx.work.step('raiseLot failed', String(e)); }
    ctx.work.step('scene.raiseLot', `name: "${shortName}"${VISITOR.company ? ' (from your link)' : typed ? ' (typed)' : ' (from your sentence)'}\n${ok ? 'building raised in the city' : 'no scene attached here (harness), skipped'}`);
    $('st').textContent = ok ? `“${shortName}” is going up` : '';
    $('out').innerHTML = `<div class="ms-sketch"><span class="ms-label">First sketch for ${esc(shortName)}</span>
      <div class="ms-sk"><b>1. Where work arrives</b>${esc(arrivesTxt[0].toUpperCase() + arrivesTxt.slice(1))}.</div>
      <div class="ms-sk"><b>2. What AI handles</b>${esc(ai[0].toUpperCase() + ai.slice(1))}. Every step logged so your team can check it.</div>
      <div class="ms-sk"><b>3. What your team decides</b>${esc(decides[0].toUpperCase() + decides.slice(1))}. The AI hands these over with the context ready.</div></div>
      ${isReal(email) ? `<div class="ms-panel"><span class="ms-label">Want the real version? Write to me</span><div class="ms-email"><span data-r="em">${esc(email)}</span><button type="button" class="ms-btn ms-small" data-copy>Copy</button><span data-r="cp" class="ms-mono"></span></div></div>` : ''}`;
    el.querySelector('[data-copy]')?.addEventListener('click', async () => {
      let done = false; try { await navigator.clipboard.writeText(email); done = true; } catch { /* clipboard blocked */ }
      if (!done) { try { const r = document.createRange(); r.selectNodeContents($('em')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch { /* ignore */ } }
      $('cp').textContent = done ? 'Copied' : 'Selected: press Ctrl/Cmd+C'; ctx.work.step('Copy email', done ? 'copied to clipboard' : 'clipboard unavailable, text selected instead');
    });
    ctx.work.step('Sketch ready', `sector template "${key}" filled with your sentence`, { kind: 'result', ms: ms(T) });
    if (!raised) { raised = true; ctx.complete(); }
  }
  el.querySelector('[data-raise]').addEventListener('click', raise);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') raise(); });
  return { unmount() { el.innerHTML = ''; } };
}
