// Story card: title / meta / body from content, an optional live mission, and the "Show your work" drawer.
import { STOPS, CONTACT } from '../content/stops.js';
import { mountMission } from '../missions/index.js';
import { WorkLog, renderWorkLog } from './worklog.js';

const $ = s => document.querySelector(s);

export function createCard({ reduce, onNext, onClose, onComplete }) {
  const el = $('#card'), body = $('#kBody'), slot = $('#kMission'), workBtn = $('#workBtn'), workPanel = $('#workPanel'), workList = $('#workList'), workN = $('#workN');
  let handle = null, unsub = null, token = 0, cur = null;

  function unmount() {
    token++;
    try { handle?.unmount?.(); } catch (e) { console.error(e); }
    handle = null; unsub?.(); unsub = null; slot.innerHTML = ''; slot.hidden = true; workBtn.hidden = true; setWork(false);
  }
  function setWork(open) { workPanel.hidden = !open; workBtn.setAttribute('aria-expanded', String(open)); workBtn.querySelector('.lbl').textContent = open ? 'Hide the work' : 'Show your work'; }
  workBtn.addEventListener('click', () => setWork(workPanel.hidden));

  async function open(ci, k, { scene, nextLabel }) {
    unmount(); const s = STOPS[ci], sp = s.spots[k]; cur = { ci, k };
    $('#kKick').textContent = `${s.name}, spot ${k + 1} of ${s.spots.length}`;
    $('#kTitle').textContent = sp.t; $('#kMeta').textContent = sp.m; body.innerHTML = sp.b;
    $('#kNext').textContent = nextLabel;
    el.scrollTop = 0; el.classList.add('open'); document.body.classList.add('cardopen');
    if (sp.mission) {
      const my = token, work = new WorkLog(); slot.hidden = false; slot.innerHTML = '<p class="mission-loading">Loading the demo…</p>';
      workBtn.hidden = false; workN.textContent = '0';
      unsub = renderWorkLog(work, workList); const offN = work.onChange(e => { workN.textContent = String(e.length); });
      const prevUnsub = unsub; unsub = () => { prevUnsub(); offN(); };
      const host = document.createElement('div'); host.className = 'mission';
      try {
        const h = await mountMission(sp.mission, host, { work, complete: () => onComplete?.(ci, k, sp.mission), contact: CONTACT, city: s, reduceMotion: reduce, scene });
        if (my !== token) { h?.unmount?.(); return; }
        slot.innerHTML = ''; slot.appendChild(host); handle = h;
      } catch (e) {
        console.error('mission failed', sp.mission, e);
        if (my === token) slot.innerHTML = '<p class="mission-loading">This demo didn\'t load. The story above still stands.</p>';
      }
    }
  }
  function close() { unmount(); cur = null; el.classList.remove('open'); document.body.classList.remove('cardopen'); }
  $('#cardX').addEventListener('click', () => { close(); onClose?.(); });
  $('#kBack').addEventListener('click', () => { close(); onClose?.(); });
  $('#kNext').addEventListener('click', () => cur && onNext?.(cur.ci, cur.k));
  return { open, close, get current() { return cur; }, isOpen: () => el.classList.contains('open') };
}
