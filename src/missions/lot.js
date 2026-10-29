// An illustrative invitation to build together; no company analysis is generated.
import './missions.css';
import { esc } from './_util.js';
import { VISITOR } from '../core/visitor.js';
import { isReal } from '../content/stops.js';

export function mount(el, ctx) {
  const email = ctx.contact?.email || '';
  const heading = VISITOR.company ? `What could we build at ${VISITOR.company}?` : 'What should we build next?';
  el.innerHTML = `<div class="ms"><h4>${esc(heading)}</h4>
    <p class="ms-lead">Tell me what you are working on, and let's explore where AI could help.</p>
    ${VISITOR.company ? '' : '<label class="ms-label" for="ms-lot-name">Company name (optional)</label><input id="ms-lot-name" class="ms-input" maxlength="28" placeholder="Your company">'}
    <div class="ms-row"><button type="button" class="ms-btn ms-primary" data-raise>Raise the building</button>
    ${isReal(email) ? `<a class="ms-btn" href="mailto:${esc(email)}?subject=${encodeURIComponent('What should we build next?')}">Email Nand</a>` : ''}</div>
    <p data-r="st" role="status"></p><p class="ms-note">Illustrative invitation.</p></div>`;
  let raised = false;
  el.querySelector('[data-raise]').addEventListener('click', () => {
    const typed = el.querySelector('#ms-lot-name')?.value || '';
    const name = (VISITOR.company || typed).replace(/[^\p{L}\p{N} &.\-]/gu, '').trim().slice(0,28) || 'Your company';
    try { ctx.scene?.raiseLot?.(name, { immediate: ctx.reduceMotion || document.body.classList.contains('motion-paused') }); } catch (error) { ctx.work.step('Building could not be raised', String(error)); }
    el.querySelector('[data-r="st"]').textContent = 'An illustrative building for the next idea.';
    ctx.work.step('Raise the illustration', `Scene label: ${name}`);
    if (!raised) { raised = true; ctx.complete(); }
  });
  return { unmount() { el.innerHTML = ''; } };
}
