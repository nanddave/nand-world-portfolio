// Passport postcard: a 1080x1350 PNG drawn on a 2D canvas (no server), plus a small share/download dialog.
//   makePostcard({ name, stamped:Set<stopIdx>, missions:Set<'ci:k'>, company }) -> Promise<Blob>
//   openPostcardDialog(state) -> { close() }   state: same shape as above (name optional)
// Truth: shows only what the visitor did (stamps, missions) and the visitor-typed name/company. Nothing about Nand except "Nand" in the title.
import './postcard.css';
import { STOPS, LEGS, CONTACT, isReal } from '../content/stops.js';
import { LAND_MASK_B64 } from '../core/landmask.js';

const W = 1080, H = 1350;
const DISPLAY = '"Big Shoulders Display","Arial Narrow",Impact,sans-serif';
const BODY = '"Schibsted Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif';
const INK = '#16192E', PAPER = '#F6EEDC', SOFT = '#6B6A78';
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const set = x => (x instanceof Set ? x : new Set(x || []));

// land mask: 720x360 bits, 0.5 deg cells, row 0 = 90N, col 0 = 180W, LSB first (same as src/core/globe.js)
let mask = null;
function land(lat, lon) {
  if (!mask) { const s = atob(LAND_MASK_B64); mask = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) mask[i] = s.charCodeAt(i); }
  const x = Math.min(719, Math.max(0, Math.floor((lon + 180) / .5))), y = Math.min(359, Math.max(0, Math.floor((90 - lat) / .5))), i = y * 720 + x;
  return (mask[i >> 3] >> (i & 7)) & 1;
}
const rng = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

async function fonts() {
  try {
    await Promise.race([Promise.all([document.fonts.load('900 60px "Big Shoulders Display"'), document.fonts.load('800 40px "Big Shoulders Display"'), document.fonts.load('600 30px "Schibsted Grotesk"'), document.fonts.load('400 30px "Schibsted Grotesk"')]).then(() => document.fonts.ready), new Promise(r => setTimeout(r, 2500))]);
  } catch (e) { /* fallback fonts */ }
}

function fit(g, text, font, maxW, size, min = 18) { // font like (s)=>`900 ${s}px ...`; shrink until it fits
  let s = size; g.font = font(s); while (s > min && g.measureText(text).width > maxW) { s -= 2; g.font = font(s); } return s;
}
export async function makePostcard({ name, stamped, missions, company } = {}) {
  await fonts();
  const st = set(stamped), ms = set(missions), nm = clean(name, 30), co = clean(company, 28);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.textBaseline = 'alphabetic';

  // ---- paper + grain (seeded: identical every time) ----
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  const grad = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 900); grad.addColorStop(0, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(160,130,80,.16)'); g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const r = rng(11); for (let i = 0; i < 14000; i++) { g.fillStyle = r() < .5 ? 'rgba(90,70,40,.05)' : 'rgba(255,255,255,.10)'; g.fillRect(r() * W, r() * H, 1 + r() * 1.6, 1 + r() * 1.6); }
  g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(36, 36, W - 72, H - 72); g.lineWidth = 1.2; g.strokeRect(50, 50, W - 100, H - 100);

  // ---- header ----
  g.fillStyle = INK; g.textAlign = 'left';
  g.font = `600 24px ${BODY}`; g.fillText('T R A V E L   P A S S P O R T', 84, 112);
  g.textAlign = 'right'; g.fillText('No. ' + String(st.size).padStart(2, '0') + ' / ' + String(STOPS.length).padStart(2, '0'), W - 84, 112);
  g.textAlign = 'left'; g.font = `900 150px ${DISPLAY}`; g.fillText("NAND'S WORLD", 80, 250);
  g.fillStyle = '#E0A30C'; g.fillRect(84, 276, 140, 8);

  // ---- visitor ----
  g.fillStyle = SOFT; g.font = `600 22px ${BODY}`; g.fillText('ISSUED TO', 84, 336);
  g.fillStyle = INK; const label = nm || 'A curious traveller', sz = fit(g, label, s => `900 ${s}px ${DISPLAY}`, W - 168, 88, 30);
  g.fillText(label, 84, 336 + sz * .95 + 6);
  if (co) { g.fillStyle = SOFT; g.font = `400 24px ${BODY}`; fit(g, 'visiting from ' + co, s => `400 ${s}px ${BODY}`, W - 168, 24, 14); g.fillText('visiting from ' + co, 84, 336 + sz * .95 + 44); }

  // ---- route map (equirectangular, land from the globe's mask) ----
  const mx = 84, my = 478, mw = W - 168, LON0 = -135, LON1 = 100, LAT1 = 55, LAT0 = 6, k = mw / (LON1 - LON0), mh = Math.round((LAT1 - LAT0) * k);
  const px = lon => mx + (lon - LON0) * k, py = lat => my + (LAT1 - lat) * k;
  g.fillStyle = 'rgba(22,25,46,.04)'; g.fillRect(mx, my, mw, mh); g.strokeStyle = 'rgba(22,25,46,.35)'; g.lineWidth = 1.5; g.strokeRect(mx, my, mw, mh);
  g.save(); g.beginPath(); g.rect(mx, my, mw, mh); g.clip();
  g.fillStyle = 'rgba(22,25,46,.30)'; const step = 6;
  for (let y = my + step / 2; y < my + mh; y += step) for (let x = mx + step / 2; x < mx + mw; x += step) { if (land(LAT1 - (y - my) / k, LON0 + (x - mx) / k)) { g.beginPath(); g.arc(x, y, 1.9, 0, 6.3); g.fill(); } }
  const P = STOPS.map(s => [px(s.lon), py(s.lat)]);
  LEGS.forEach(([a, b, kind]) => {
    const A = P[a], B = P[b], on = st.has(a) && st.has(b), mxp = (A[0] + B[0]) / 2, myp = (A[1] + B[1]) / 2 - (kind === 'f' ? 26 : 8);
    g.save(); g.lineWidth = on ? 4 : 2.5; g.strokeStyle = on ? '#C0392B' : 'rgba(22,25,46,.35)'; g.setLineDash(kind === 'f' ? [2, 9] : [14, 8]); g.lineCap = 'round';
    g.beginPath(); g.moveTo(A[0], A[1]); g.quadraticCurveTo(mxp, myp, B[0], B[1]); g.stroke(); g.restore();
  });
  g.restore();
  STOPS.forEach((s, i) => {
    const [x, y] = P[i], on = st.has(i); g.beginPath(); g.arc(x, y, on ? 9 : 7, 0, 6.3);
    if (on) { g.fillStyle = s.stamp; g.fill(); g.lineWidth = 3; g.strokeStyle = PAPER; g.stroke(); } else { g.fillStyle = PAPER; g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(22,25,46,.5)'; g.stroke(); }
  });
  g.fillStyle = SOFT; g.font = `400 20px ${BODY}`; g.textAlign = 'right'; g.fillText('Route: places you have stamped are filled. Land from Natural Earth.', mx + mw, my + mh + 30);
  g.textAlign = 'left';

  // ---- stamps ----
  const stampTop = my + mh + 52, R = 92, rows = [[0, 1, 2, 3], [4, 5, 6]], sp = 232, rowH = 200;
  rows.forEach((row, ri) => row.forEach((si, ci) => {
    const s = STOPS[si]; if (!s) return;
    const cx = W / 2 + (ci - (row.length - 1) / 2) * sp, cy = stampTop + R + ri * rowH, on = st.has(si), lab = clean(STOPS.filter(o => (o.short || o.name) === (s.short || s.name)).length > 1 ? s.name : (s.short || s.name), 24).toUpperCase();
    g.save(); g.translate(cx, cy); g.rotate(((si * 37) % 11 - 5) * .018);
    if (on) {
      g.strokeStyle = g.fillStyle = s.stamp; g.globalAlpha = .92;
      g.lineWidth = 7; g.beginPath(); g.arc(0, 0, R, 0, 6.3); g.stroke();
      g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, R - 14, 0, 6.3); g.stroke();
      g.textAlign = 'center'; g.font = `600 16px ${BODY}`; g.fillText('No. ' + String(si + 1).padStart(2, '0'), 0, -34);
      const fs = fit(g, lab, z => `900 ${z}px ${DISPLAY}`, 2 * R - 48, 44, 16); g.fillText(lab, 0, fs * .32 + 2);
      g.font = `600 16px ${BODY}`; g.fillText('STAMPED', 0, fs * .32 + 32);
      // worn-ink speckle: knock a few dots out of the stamp
      g.globalCompositeOperation = 'destination-out'; const rr = rng(si * 97 + 3); for (let i = 0; i < 90; i++) { const a = rr() * 6.28, d = Math.sqrt(rr()) * R; g.globalAlpha = .35 + rr() * .4; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, .8 + rr() * 2, 0, 6.3); g.fill(); }
    } else {
      g.globalAlpha = .5; g.strokeStyle = 'rgba(22,25,46,.45)'; g.lineWidth = 3; g.setLineDash([9, 9]); g.beginPath(); g.arc(0, 0, R, 0, 6.3); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(22,25,46,.55)'; g.textAlign = 'center'; const fs = fit(g, lab, z => `800 ${z}px ${DISPLAY}`, 2 * R - 52, 36, 16); g.fillText(lab, 0, fs * .32);
      g.font = `400 16px ${BODY}`; g.fillText('not yet visited', 0, fs * .32 + 28);
    }
    g.restore();
  }));
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

  // ---- missions ----
  const all = []; STOPS.forEach((s, ci) => s.spots.forEach((sp, k) => { if (sp.mission) all.push(ci + ':' + k); }));
  const done = all.filter(x => ms.has(x)).length, y0 = stampTop + 2 * rowH - 4;
  g.fillStyle = INK; g.textAlign = 'left'; g.font = `900 70px ${DISPLAY}`; g.fillText(`${done} of ${all.length}`, 84, y0 + 56);
  const nw = g.measureText(`${done} of ${all.length}`).width;
  g.font = `600 28px ${BODY}`; g.fillText('missions completed', 84 + nw + 18, y0 + 54);
  g.fillStyle = SOFT; g.font = `400 20px ${BODY}`; g.fillText('Real demos that ran in the browser. Only what you actually did is counted.', 84, y0 + 90);

  // ---- footer ----
  g.strokeStyle = 'rgba(22,25,46,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(84, H - 128); g.lineTo(W - 84, H - 128); g.stroke();
  g.fillStyle = SOFT; g.font = `400 21px ${BODY}`; g.textAlign = 'left'; g.fillText('Made with three.js and free data · zero paid tools', 84, H - 88);
  g.fillStyle = INK; g.font = `600 24px ${BODY}`; g.textAlign = 'right'; { const foot = isReal(CONTACT.site) ? CONTACT.site : isReal(CONTACT.email) ? CONTACT.email : ''; if (foot) g.fillText(foot, W - 84, H - 88); }

  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'));
}

// ---------------------------------------------------------------- dialog
export function openPostcardDialog(state = {}) {
  const prevFocus = document.activeElement;
  const ov = document.createElement('div'); ov.className = 'pc-overlay';
  ov.innerHTML = `<div class="pc-sheet" role="dialog" aria-modal="true" aria-labelledby="pc-h" aria-describedby="pc-d">
    <h2 id="pc-h">Your passport postcard</h2>
    <p id="pc-d">A picture of the stamps and missions you earned. It is drawn on your device; nothing is uploaded.</p>
    <label for="pc-name">Your name (optional, up to 30 characters)</label>
    <input id="pc-name" type="text" maxlength="30" autocomplete="name" placeholder="e.g. Priya">
    <div class="pc-prev" aria-live="polite"><span>Drawing your postcard…</span></div>
    <div class="pc-row"><button type="button" class="btn primary" id="pc-go" disabled>Download</button><button type="button" class="btn" id="pc-close">Close</button></div>
    <p class="pc-status" id="pc-st" role="status"></p>
  </div>`;
  const q = s => ov.querySelector(s), input = q('#pc-name'), prev = q('.pc-prev'), go = q('#pc-go'), stat = q('#pc-st');
  input.value = clean(state.name, 30);
  let blob = null, url = null, seq = 0, timer = null, closed = false;
  const file = () => { try { return new File([blob], 'nands-world-passport.png', { type: 'image/png' }); } catch (e) { return null; } };
  const canShare = () => { try { const f = blob && file(); return !!(f && navigator.canShare && navigator.canShare({ files: [f] }) && navigator.share); } catch (e) { return false; } };
  async function render() {
    const my = ++seq; go.disabled = true;
    try {
      const b = await makePostcard({ ...state, name: input.value }); if (closed || my !== seq) return;
      blob = b; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(b);
      const img = new Image(); img.alt = 'Preview of your passport postcard'; img.src = url; prev.replaceChildren(img);
      go.textContent = canShare() ? 'Share' : 'Download'; go.disabled = false;
    } catch (e) { prev.innerHTML = '<span>Could not draw the postcard in this browser.</span>'; }
  }
  const close = () => { if (closed) return; closed = true; clearTimeout(timer); if (url) URL.revokeObjectURL(url); document.removeEventListener('keydown', onKey, true); ov.remove(); try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) { /* gone */ } };
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...ov.querySelectorAll('input,button:not([disabled]),a[href]')]; if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (!ov.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
    else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
  go.addEventListener('click', async () => {
    if (!blob) return; stat.textContent = '';
    if (canShare()) { try { await navigator.share({ files: [file()], title: "My passport in Nand's World", text: "My stamps and missions in Nand's World" }); } catch (e) { if (e && e.name !== 'AbortError') stat.textContent = 'Sharing did not work here. Try again or close and re-open.'; } return; }
    const a = document.createElement('a'); a.href = url; a.download = 'nands-world-passport.png'; document.body.appendChild(a); a.click(); a.remove(); stat.textContent = 'Saved to your downloads.';
  });
  q('#pc-close').addEventListener('click', close);
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 350); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(ov); input.focus(); render();
  return { close };
}
