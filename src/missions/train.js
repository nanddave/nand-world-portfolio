// Mission: place two classes of points, then train a model in the browser.
// Real gradient descent, written by hand: logistic regression or a 1-hidden-layer MLP (tanh), binary cross-entropy.
import './missions.css';
import { rng, lifetime, now, ms } from './_util.js';
import { WORLD } from '../kit/events.js';

const COL = ['#2F5D9E', '#F0473C'];
const W = 300; // canvas internal resolution

export function mount(el, ctx) {
  const L = lifetime(); let pts = []; let cls = 0; let model = null; let useMLP = false; let training = false; let losses = []; let runs = 0;
  el.innerHTML = `<div class="ms">
    <h4>Teach a model to draw a line</h4>
    <p class="ms-lead">Click to place points. Pick the class first, or load an example. Then train a model right here in your browser.</p>
    <div class="ms-row" role="group" aria-label="Point class">
      <button type="button" class="ms-btn ms-small" data-c="0" aria-pressed="true"><span style="color:${COL[0]}">●</span> Class A</button>
      <button type="button" class="ms-btn ms-small" data-c="1" aria-pressed="false"><span style="color:${COL[1]}">●</span> Class B</button>
      <button type="button" class="ms-btn ms-small" data-ex="blobs">Load blobs</button>
      <button type="button" class="ms-btn ms-small" data-ex="moons">Load moons</button>
      <button type="button" class="ms-btn ms-small" data-clear>Clear</button>
    </div>
    <canvas class="ms-canvas" width="${W}" height="${W}" aria-label="Training points and decision boundary. Click to add a point."></canvas>
    <div class="ms-row">
      <label class="ms-row" style="gap:6px;font-size:13px"><input type="checkbox" data-mlp> Hidden layer (MLP, 10 tanh units)</label>
    </div>
    <div class="ms-row"><button type="button" class="ms-btn ms-primary" data-train>Train</button><span class="ms-mono" data-st></span></div>
    <div class="ms-panel"><span class="ms-label">Loss (binary cross-entropy) per epoch</span><svg class="ms-svg" viewBox="0 0 300 80" data-loss role="img" aria-label="Loss curve"></svg></div>
    <p class="ms-note">Real training, hand-written in plain JavaScript (no libraries): full-batch gradient descent with momentum. Tiny on purpose, so it finishes in a few seconds.</p></div>`;
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  const st = el.querySelector('[data-st]'), lossSvg = el.querySelector('[data-loss]');

  function example(kind) {
    const R = rng(kind === 'moons' ? 7 : 3); const n = (s = 1) => (R() + R() + R() - 1.5) * s; pts = [];
    if (kind === 'blobs') for (let i = 0; i < 40; i++) { pts.push({ x: -0.4 + n(0.35), y: 0.3 + n(0.35), c: 0 }); pts.push({ x: 0.4 + n(0.35), y: -0.3 + n(0.35), c: 1 }); }
    else for (let i = 0; i < 45; i++) { const a = Math.PI * R(); pts.push({ x: Math.cos(a) * 0.6 - 0.25 + n(0.08), y: Math.sin(a) * 0.6 - 0.15 + n(0.08), c: 0 }); pts.push({ x: 0.25 - Math.cos(a) * 0.6 + n(0.08) + 0.0, y: 0.15 - Math.sin(a) * 0.6 + n(0.08) + 0.0, c: 1 }); }
    model = null; losses = []; draw();
    ctx.work.step(`Loaded example: ${kind}`, `${pts.length} points (seeded), ${pts.filter(p => p.c === 0).length} class A / ${pts.filter(p => p.c === 1).length} class B`);
  }

  // ---- models ----
  const sig = z => 1 / (1 + Math.exp(-z));
  function makeModel() {
    const R = rng(42 + runs); const r = s => (R() * 2 - 1) * s;
    if (!useMLP) return { kind: 'logistic regression', w: [0, 0], b: 0, lr: 0.8, epochs: 600 };
    const H = 10; return { kind: 'MLP 2-10-1 (tanh, sigmoid)', H, W1: Array.from({ length: H }, () => [r(1.2), r(1.2)]), b1: Array.from({ length: H }, () => r(0.5)), W2: Array.from({ length: H }, () => r(0.8)), b2: 0, lr: 0.5, epochs: 1500 };
  }
  const nParams = m => m.H ? m.H * 2 + m.H + m.H + 1 : 3;
  function forward(m, x, y) {
    if (!m.H) return { p: sig(m.w[0] * x + m.w[1] * y + m.b) };
    const h = new Array(m.H); let z = m.b2;
    for (let j = 0; j < m.H; j++) { h[j] = Math.tanh(m.W1[j][0] * x + m.W1[j][1] * y + m.b1[j]); z += m.W2[j] * h[j]; }
    return { p: sig(z), h };
  }
  // One full-batch gradient step with momentum; returns { loss, acc }.
  function step(m, v) {
    const N = pts.length; let loss = 0, ok = 0;
    if (!m.H) {
      let gw0 = 0, gw1 = 0, gb = 0;
      for (const q of pts) { const { p } = forward(m, q.x, q.y); const e = p - q.c; gw0 += e * q.x; gw1 += e * q.y; gb += e; loss -= q.c ? Math.log(p + 1e-9) : Math.log(1 - p + 1e-9); if ((p > 0.5) === !!q.c) ok++; }
      const gr = [gw0 / N, gw1 / N, gb / N]; v.forEach((_, i) => v[i] = 0.9 * v[i] + gr[i]);
      m.w[0] -= m.lr * v[0]; m.w[1] -= m.lr * v[1]; m.b -= m.lr * v[2];
    } else {
      const H = m.H; const gW1 = Array.from({ length: H }, () => [0, 0]), gb1 = new Array(H).fill(0), gW2 = new Array(H).fill(0); let gb2 = 0;
      for (const q of pts) {
        const { p, h } = forward(m, q.x, q.y); const e = p - q.c; // dL/dz for sigmoid + BCE
        loss -= q.c ? Math.log(p + 1e-9) : Math.log(1 - p + 1e-9); if ((p > 0.5) === !!q.c) ok++;
        gb2 += e; for (let j = 0; j < H; j++) { gW2[j] += e * h[j]; const d = e * m.W2[j] * (1 - h[j] * h[j]); gW1[j][0] += d * q.x; gW1[j][1] += d * q.y; gb1[j] += d; }
      }
      let k = 0; const upd = (val, gr) => { v[k] = 0.9 * (v[k] || 0) + gr / N; const nv = val - m.lr * v[k]; k++; return nv; };
      for (let j = 0; j < H; j++) { m.W1[j][0] = upd(m.W1[j][0], gW1[j][0]); m.W1[j][1] = upd(m.W1[j][1], gW1[j][1]); m.b1[j] = upd(m.b1[j], gb1[j]); m.W2[j] = upd(m.W2[j], gW2[j]); }
      m.b2 = upd(m.b2, gb2);
    }
    return { loss: loss / N, acc: ok / N };
  }

  // ---- drawing ----
  const toPx = v => (v + 1) / 2 * W, toU = px => px / W * 2 - 1;
  const img = g.createImageData(W, W);
  function draw() {
    if (model) {
      const S = 60, cell = W / S, grid = [];
      for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) grid.push(forward(model, toU((j + 0.5) * cell), toU((i + 0.5) * cell)).p);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const p = grid[Math.min(S - 1, (y / cell) | 0) * S + Math.min(S - 1, (x / cell) | 0)];
        const a = Math.abs(p - 0.5) * 2, c = p > 0.5 ? [240, 71, 60] : [47, 93, 158], k = (y * W + x) * 4, t = 0.08 + 0.32 * a;
        img.data[k] = 255 + (c[0] - 255) * t; img.data[k + 1] = 255 + (c[1] - 255) * t; img.data[k + 2] = 255 + (c[2] - 255) * t; img.data[k + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    } else { g.fillStyle = '#fff'; g.fillRect(0, 0, W, W); g.strokeStyle = '#E3D9C5'; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, W); g.moveTo(0, W / 2); g.lineTo(W, W / 2); g.stroke(); }
    for (const q of pts) { g.beginPath(); g.arc(toPx(q.x), toPx(q.y), 4.5, 0, 7); g.fillStyle = COL[q.c]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke(); }
    if (!pts.length) { g.fillStyle = '#4B4F69'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('Click to add points, or load an example', W / 2, W / 2 - 10); }
    const maxL = Math.max(0.01, ...losses.slice(0, 3)), n = losses.length;
    lossSvg.innerHTML = n ? `<polyline fill="none" stroke="#16192E" stroke-width="2" points="${losses.map((l, i) => `${(i / Math.max(1, n - 1) * 290 + 5).toFixed(1)},${(75 - Math.min(1, l / maxL) * 68).toFixed(1)}`).join(' ')}"/><text x="295" y="12" text-anchor="end" font-size="10" font-family="monospace">${losses[n - 1].toFixed(4)}</text>` : '<text x="150" y="44" text-anchor="middle" font-size="11" fill="#4B4F69">Train to see the loss fall</text>';
  }

  async function train() {
    if (training) return;
    if (pts.length < 4 || pts.every(p => p.c === pts[0].c)) { st.textContent = 'Add at least a few points of each class.'; return; }
    training = true; trainBtn.disabled = true; runs++; model = makeModel(); losses = []; const v = []; if (!model.H) v.push(0, 0, 0);
    ctx.work.step('Training started', `model: ${model.kind}\nparameters: ${nParams(model)} · learning rate ${model.lr} · momentum 0.9\ndata: ${pts.length} points · epochs: ${model.epochs} (full batch)\ninit seed ${42 + runs - 1}`);
    const t0 = now(); let e = 0, last = null; const per = model.H ? 15 : 8;
    await new Promise(res => L.raf(() => {
      for (let k = 0; k < per && e < model.epochs; k++, e++) { last = step(model, v); losses.push(last.loss); if ((e + 1) % (model.H ? 300 : 150) === 0) ctx.work.step(`Epoch ${e + 1}`, `loss ${last.loss.toFixed(4)} · train accuracy ${(last.acc * 100).toFixed(1)}%`, { ms: ms(t0) }); }
      draw(); st.textContent = `epoch ${e} · loss ${last.loss.toFixed(3)} · acc ${(last.acc * 100).toFixed(0)}%`;
      if (e >= model.epochs || !L.alive) { res(); return false; }
    }));
    if (!L.alive) return;
    const wall = ms(t0);
    const params = model.H ? `W1 ${model.H}x2, W2 ${model.H}x1 (weights hidden for brevity)` : `w = [${model.w.map(x => x.toFixed(3)).join(', ')}], b = ${model.b.toFixed(3)}\nboundary: ${model.w[0].toFixed(2)}·x + ${model.w[1].toFixed(2)}·y + ${model.b.toFixed(2)} = 0`;
    ctx.work.step('Training finished', `${model.epochs} epochs in ${wall} ms (wall clock, includes drawing)\nfinal loss ${last.loss.toFixed(4)} · train accuracy ${(last.acc * 100).toFixed(1)}%\n${params}`, { ms: wall, kind: 'result' });
    st.textContent = `done: ${(last.acc * 100).toFixed(1)}% train accuracy in ${Math.round(wall)} ms` + (!model.H && last.acc < 0.9 ? ' (a straight line can\'t do better; try the hidden layer)' : '');
    training = false; trainBtn.disabled = false; WORLD.emit('train:converged', { acc: last.acc }); ctx.work.step('World updated', 'Boston bridge cable lights sweep in a colour wave', { ms: 0 }); ctx.complete();
  }

  const trainBtn = el.querySelector('[data-train]');
  trainBtn.addEventListener('click', train);
  el.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { cls = +b.dataset.c; el.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
  el.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => !training && example(b.dataset.ex)));
  el.querySelector('[data-clear]').addEventListener('click', () => { if (training) return; pts = []; model = null; losses = []; draw(); ctx.work.step('Cleared points', ''); });
  el.querySelector('[data-mlp]').addEventListener('change', e => { useMLP = e.target.checked; });
  cv.addEventListener('pointerdown', e => {
    if (training) return; const r = cv.getBoundingClientRect(); const x = toU((e.clientX - r.left) / r.width * W), y = toU((e.clientY - r.top) / r.height * W);
    const c = e.shiftKey ? 1 - cls : cls; pts.push({ x, y, c }); model = null; draw();
    ctx.work.step('Point added', `(${x.toFixed(2)}, ${y.toFixed(2)}) class ${'AB'[c]} · total ${pts.length}`);
  });
  example('blobs');
  return { unmount() { L.kill(); el.innerHTML = ''; } };
}
