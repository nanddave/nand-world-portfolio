// Mission: fault diagnosis on a paper-cup line (feed -> fold -> curl -> stack).
// A seeded stochastic model; the hidden root cause is paper misalignment at the fold,
// which shows up as cracked rims at the curl. Simulation inspired by a real incident; numbers illustrative.
import './missions.css';
import { esc, rng, lifetime, now, ms } from './_util.js';
import { WORLD } from '../kit/events.js';

const STATIONS = ['feed', 'fold', 'curl', 'stack'];
const NAMES = { feed: 'Feed', fold: 'Fold', curl: 'Curl', stack: 'Stack' };
const SPEED = 90; // cups per minute
const ACTIONS = [
  { id: 'cups', label: 'Look at cracked cups', cost: 3 },
  { id: 'heater', label: 'Check curl heater', cost: 6 },
  { id: 'adjust', label: 'Adjust the curl (+6 °C, reset die)', cost: 15 },
  { id: 'feed', label: 'Check paper feed', cost: 6 },
  { id: 'fold', label: 'Measure fold alignment', cost: 10 },
  { id: 'realign', label: 'Re-align the fold guide', cost: 20, needs: 'fold' },
];

export function mount(el, ctx) {
  const L = lifetime(), R = rng(20201);
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += R(); return (u - 3) / 1.22; };
  // Hidden plant state.
  const S = { foldOffset: 1.8, curlTemp: 182, tension: 41, moisture: 6.1, cups: 0, downtime: 0, done: new Set(), solved: false, adjustedCurl: false };
  const win = []; // rolling window of { station: defects } per tick
  const pCrack = () => 0.004 + 0.09 * Math.pow(Math.max(0, Math.abs(S.foldOffset) - 0.4), 1.3) + 0.0015 * Math.abs(S.curlTemp - 182) / 5;
  const pOther = { feed: 0.004, fold: 0.006, stack: 0.003 };

  el.innerHTML = `<div class="ms">
    <h4>The cracking rim</h4>
    <p class="ms-lead">The line is running, but rims keep cracking at the curl. Every inspection stops the line. Find the cause with the least downtime.</p>
    <div class="ms-line" data-r="line"></div>
    <div class="ms-flow"><span>paper in</span><span>→</span><span>→</span><span>cups out</span></div>
    <div class="ms-panel"><span class="ms-label">Defects seen per station, last 300 cups</span><svg class="ms-svg" viewBox="0 0 320 120" data-r="chart" role="img" aria-label="Defect rate by station"></svg></div>
    <div class="ms-stats" data-r="stats"></div>
    <div><span class="ms-label">Inspect or act</span><div class="ms-row" data-r="acts"></div></div>
    <div class="ms-panel" data-r="find" aria-live="polite"><span class="ms-lead">Findings will appear here.</span></div>
    <div data-r="res"></div>
    <p class="ms-note">Simulation inspired by a real incident at the factory; numbers are illustrative.</p></div>`;
  const $ = r => el.querySelector(`[data-r="${r}"]`);
  $('acts').innerHTML = ACTIONS.map(a => `<button type="button" class="ms-btn ms-small" data-act="${a.id}">${esc(a.label)} <span class="ms-tag">${a.cost} min</span></button>`).join('');
  ctx.work.step('Line model initialised', `seed 20201 · ${SPEED} cups/min · stations ${STATIONS.join(' → ')}\nP(crack at curl) = 0.004 + 0.09·max(0,|fold offset|−0.4)^1.3 + 0.0015·|curl temp−182|/5\nhidden state is not shown until inspected`);

  // Simulate n cups through the line; returns defects per station.
  function runCups(n) {
    const d = { feed: 0, fold: 0, curl: 0, stack: 0 }; const pc = pCrack();
    for (let i = 0; i < n; i++) {
      if (R() < pOther.feed) { d.feed++; continue; }
      if (R() < pOther.fold) { d.fold++; continue; }
      if (R() < pc) { d.curl++; continue; }
      if (R() < pOther.stack) d.stack++;
    }
    S.cups += n; return d;
  }
  const rates = () => { const t = { feed: 0, fold: 0, curl: 0, stack: 0 }; let n = 0; win.forEach(w => { n += w.n; STATIONS.forEach(s => t[s] += w.d[s]); }); STATIONS.forEach(s => t[s] = n ? t[s] / n : 0); return { r: t, n }; };
  function tick() {
    if (!L.alive) return;
    // jitter sensors around their (hidden) means
    S.liveTemp = S.curlTemp + gauss() * 0.8; S.liveOff = S.foldOffset + gauss() * 0.08; S.liveTen = S.tension + gauss() * 0.6;
    const n = 15; win.push({ n, d: runCups(n) }); while (win.length > 1 && win.reduce((a, w) => a + w.n, 0) - win[0].n >= 300) win.shift();
    draw();
  }
  function draw() {
    const { r } = rates(); const k = S.done;
    const reads = {
      feed: `<b>${SPEED}</b> cups/min<br>tension ${k.has('feed') ? `<b>${S.liveTen.toFixed(1)} N</b>` : '—'}`,
      fold: `${k.has('cups') ? '<b>seam?</b>' : 'running'}<br>offset${k.has('fold') ? `<b>${S.liveOff.toFixed(2)} mm</b>` : '—'}`,
      curl: `temp ${k.has('heater') || k.has('adjust') ? `<b>${S.liveTemp.toFixed(1)} °C</b>` : '—'}<br>cracks <b>${(r.curl * 100).toFixed(1)}%</b>`,
      stack: `rejects<br><b>${((r.feed + r.fold + r.curl + r.stack) * 100).toFixed(1)}%</b>`,
    };
    $('line').innerHTML = STATIONS.map(s => {
      const cls = S.solved && s === 'fold' ? ' ms-cause' : (!S.solved && s === 'curl' && r.curl > 0.05 ? ' ms-hot' : '');
      const chk = (s === 'fold' && k.has('fold')) || (s === 'curl' && (k.has('heater') || k.has('adjust'))) || (s === 'feed' && k.has('feed')) ? ' ms-checked' : '';
      return `<div class="ms-station${cls}${chk}"><h5>${NAMES[s]}</h5><div class="ms-read">${reads[s]}</div></div>`;
    }).join('');
    const max = Math.max(0.05, ...STATIONS.map(s => r[s]));
    $('chart').innerHTML = STATIONS.map((s, i) => {
      const h = (r[s] / max) * 78, x = 20 + i * 76;
      return `<rect x="${x}" y="${96 - h}" width="48" height="${h}" rx="3" fill="${s === 'curl' && !S.solved ? '#F0473C' : '#16192E'}"/><text x="${x + 24}" y="${90 - h}" text-anchor="middle" font-size="11" font-family="monospace">${(r[s] * 100).toFixed(1)}%</text><text x="${x + 24}" y="112" text-anchor="middle" font-size="11">${NAMES[s]}</text>`;
    }).join('') + '<line x1="10" y1="96" x2="310" y2="96" stroke="#16192E"/>';
    $('stats').innerHTML = `<div class="ms-stat"><b>${S.cups}</b><span>cups simulated</span></div><div class="ms-stat ${S.downtime > 40 ? 'ms-bad' : ''}"><b>${S.downtime} min</b><span>downtime</span></div><div class="ms-stat"><b>${k.size}</b><span>actions taken</span></div>`;
    el.querySelectorAll('[data-act]').forEach(b => { const a = ACTIONS.find(x => x.id === b.dataset.act); b.disabled = S.solved || (a.needs && !k.has(a.needs)) || (k.has(a.id) && a.id !== 'adjust'); });
  }
  const finding = (html) => { const f = $('find'); if (f.querySelector('.ms-lead')) f.innerHTML = ''; f.insertAdjacentHTML('afterbegin', `<p style="margin:0 0 6px">${html}</p>`); };

  async function act(id) {
    const a = ACTIONS.find(x => x.id === id); const t0 = now();
    S.downtime += a.cost; S.done.add(id);
    const before = rates().r.curl;
    if (id === 'cups') {
      const sample = runCups(400); const seamStart = Math.round(sample.curl * 0.86);
      finding(`<b>Cracked cups:</b> pulled ${sample.curl} cracked rims from 400 cups. ${seamStart} of them start where the side seam meets the rim, not at random points.`);
      ctx.work.step('Inspection: cracked cups', `sampled 400 cups -> ${sample.curl} cracked rims\ncrack origin at side seam: ${seamStart}/${sample.curl} (${Math.round(seamStart / Math.max(1, sample.curl) * 100)}%)\ndowntime +${a.cost} min (total ${S.downtime})`, { ms: ms(t0) });
    } else if (id === 'heater') {
      finding(`<b>Curl heater:</b> ${S.curlTemp.toFixed(1)} °C, inside spec (175–190 °C). Thermocouple reads stable.`);
      ctx.work.step('Inspection: curl heater', `curl temp mean ${S.curlTemp} °C, spec 175–190 -> within spec\ndowntime +${a.cost} min (total ${S.downtime})`, { ms: ms(t0) });
    } else if (id === 'adjust') {
      S.curlTemp += 6; S.adjustedCurl = true;
      win.length = 0; const test = runCups(300); win.push({ n: 300, d: test });
      finding(`<b>Adjusted the curl</b> to ${S.curlTemp} °C and reset the die. Test run of 300 cups: ${test.curl} cracked (${(test.curl / 3).toFixed(1)}%) vs ${(before * 100).toFixed(1)}% before. No real change.`);
      ctx.work.step('Action: adjust curl', `curl temp 182 -> ${S.curlTemp} °C, die reset\ntest run 300 cups -> ${test.curl} cracked (${(test.curl / 3).toFixed(1)}%), before ${(before * 100).toFixed(1)}%\nconclusion: symptom station is not the cause\ndowntime +${a.cost} min (total ${S.downtime})`, { ms: ms(t0) });
    } else if (id === 'feed') {
      finding(`<b>Paper feed:</b> web tension ${S.tension} N (spec 38–45), moisture ${S.moisture}% (spec 5–8%). Paper is fine coming in.`);
      ctx.work.step('Inspection: paper feed', `tension ${S.tension} N (38–45 ok), moisture ${S.moisture}% (5–8 ok)\ndowntime +${a.cost} min (total ${S.downtime})`, { ms: ms(t0) });
    } else if (id === 'fold') {
      const reads = Array.from({ length: 5 }, () => +(S.foldOffset + gauss() * 0.08).toFixed(2));
      finding(`<b>Fold alignment:</b> blank sits ${S.foldOffset} mm off the guide (spec ±0.5 mm). Readings: ${reads.join(', ')} mm. The seam overlap is uneven, which leaves a weak point exactly where the rim is curled.`);
      ctx.work.step('Inspection: fold alignment', `5 readings: ${reads.join(', ')} mm\nmean ${(reads.reduce((a, b) => a + b) / 5).toFixed(2)} mm vs spec ±0.5 -> OUT OF SPEC\nmodel P(crack) at this offset = ${(pCrack() * 100).toFixed(1)}%\ndowntime +${a.cost} min (total ${S.downtime})`, { ms: ms(t0) });
    } else if (id === 'realign') {
      const off0 = S.foldOffset; S.foldOffset = 0.1; if (S.adjustedCurl) S.curlTemp = 182;
      win.length = 0; const test = runCups(300); win.push({ n: 300, d: test }); S.solved = true;
      finding(`<b>Re-aligned the fold guide:</b> offset ${off0} → ${S.foldOffset} mm. Test run of 300 cups: ${test.curl} cracked rims (${(test.curl / 3).toFixed(1)}%).`);
      ctx.work.step('Action: re-align fold guide', `fold offset ${off0} -> ${S.foldOffset} mm${S.adjustedCurl ? ', curl reverted to 182 °C' : ''}\nP(crack) now ${(pCrack() * 100).toFixed(2)}%\ntest run 300 cups -> ${test.curl} cracked (${(test.curl / 3).toFixed(1)}%), before ${(before * 100).toFixed(1)}%\ndowntime +${a.cost} min (total ${S.downtime})`, { ms: ms(t0) });
      const order = [...S.done].join(' → ');
      $('res').innerHTML = `<div class="ms-result">Fixed in ${S.downtime} minutes of downtime. The rim cracked at the curl, but the cause was upstream: the paper was misaligned at the fold. ${S.adjustedCurl ? 'Adjusting the curl first changed nothing, which is exactly what we did too.' : 'You skipped the curl adjustment we wasted rounds on.'} I still debug that way: look upstream of the symptom.</div>`;
      ctx.work.step('Diagnosis complete', `path: ${order}\ntotal downtime ${S.downtime} min · ${S.cups} cups simulated\nroot cause: fold misalignment (symptom at curl)`, { kind: 'result' });
      WORLD.emit('machine:fixed'); ctx.work.step('World updated', 'ANA factory: warning beacon off, line lights green, cups rolling out (visible in Bangalore)', { ms: 0 });
      ctx.complete();
    }
    draw();
  }
  el.querySelector('[data-r="acts"]').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) act(b.dataset.act); });
  tick(); const iv = setInterval(tick, 700);
  return { unmount() { L.kill(); clearInterval(iv); el.innerHTML = ''; } };
}
