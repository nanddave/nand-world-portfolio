// Mission: a messy-offer pipeline. ~300 synthetic promo offers (seeded) go through
// extract -> validate -> clean -> dedupe (token Jaccard) -> TF-IDF -> k-means (k by silhouette) -> label.
// Illustration of the approach on synthetic data; the real pipelines ran in PySpark across 10+ sources.
import './missions.css';
import { esc, rng, lifetime, now, ms, tokens, jaccard } from './_util.js';

const CATS = {
  drinks: ['cola', 'lemonade', 'iced tea', 'sparkling water', 'energy drink', 'fruit punch'],
  coffee: ['coffee', 'latte', 'cappuccino', 'cold brew', 'espresso', 'mocha'],
  snacks: ['potato chips', 'candy bar', 'cookies', 'beef jerky', 'pretzels', 'gummy bears'],
  food: ['pizza slice', 'hot dog', 'taquitos', 'burrito', 'chicken sandwich', 'breakfast taco'],
  car: ['car wash', 'motor oil', 'wiper fluid', 'tire gauge', 'air freshener', 'antifreeze'],
};
const DESC = {
  drinks: ['chilled bottle', 'big bottle', 'cold can', 'bottle cooler pick'],
  coffee: ['hot cup', 'fresh brewed cup', 'morning hot cup', 'barista cup'],
  snacks: ['snack bag', 'share size bag', 'party bag', 'snack aisle'],
  food: ['from the grill', 'hot meal', 'roller grill', 'grill meal combo'],
  car: ['auto care', 'vehicle care', 'auto aisle', 'for your vehicle'],
};
const DEDUPE_STOP = new Set('with any for and the a limited time deal only'.split(' '));
const SOURCES = ['pos_feed', 'vendor_csv', 'mobile_app', 'regional_xls', 'loyalty_api'];
const STAGES = ['extract', 'validate', 'clean', 'dedupe', 'tfidf', 'kmeans', 'label'];
const STOPW = new Set('for and with any the a of off on get buy free save deal only now new each pack bogo'.split(' '));

function generate(R) {
  const pick = a => a[(R() * a.length) | 0]; const rows = []; const catNames = Object.keys(CATS);
  const money = v => { const r = R(); if (r < 0.55) return '$' + v.toFixed(2); if (r < 0.7) return v.toFixed(2).replace('.', ',') + ' USD'; if (r < 0.8) return 'USD ' + v; if (r < 0.88) return '$ ' + v.toFixed(2).replace(/0/g, 'o'); if (r < 0.93) return 'two-ish dollars'; return ''; };
  const noisy = s => { const r = R(); if (r < 0.2) return s.toUpperCase(); if (r < 0.35) return s.replace(/\b\w/g, c => c.toUpperCase()); if (r < 0.45) return '  ' + s.replace(/ /g, '  ') + ' '; return s; };
  for (let i = 0; rows.length < 250; i++) {
    const cat = pick(catNames), it = pick(CATS[cat]), it2 = pick(CATS[cat]), p = Math.round((0.79 + R() * 6) * 4) / 4 - 0.01;
    const t = R(); let title, priced = true; const d = R() < 0.75 ? ' ' + pick(DESC[cat]) : '';
    if (t < 0.3) title = `${2 + ((R() * 3) | 0)} ${it}${d} for`; else if (t < 0.5) { title = `buy one get one free ${it}`; priced = false; } else if (t < 0.7) title = `${it} only`; else if (t < 0.85) { title = `free ${it2} with any ${it}`; priced = false; } else title = `$1 off ${it}`, priced = false;
    if (t >= 0.3) title += d;
    const day = 1 + ((R() * 25) | 0), len = 7 + ((R() * 21) | 0); const iso = d => new Date(Date.UTC(2022, 6, d)).toISOString().slice(0, 10);
    rows.push({ id: 'OF' + String(1000 + i), source: pick(SOURCES), title: noisy(title), price_raw: priced ? money(p) : '', start: iso(day), end: R() < 0.04 ? iso(day - 9) : iso(day + len), _cat: cat, _priced: priced });
  }
  const n0 = rows.length;
  for (let i = 0; i < 26; i++) { const r = rows[(R() * n0) | 0]; rows.push({ ...r, id: 'OF' + (2000 + i), source: pick(SOURCES) }); } // exact duplicates from another feed
  for (let i = 0; i < 24; i++) { const r = rows[(R() * n0) | 0]; const v = R(); const title = v < 0.4 ? r.title.trim() + '!!' : v < 0.7 ? 'Limited time: ' + r.title.trim() : r.title.trim().toLowerCase() + ' deal'; rows.push({ ...r, id: 'OF' + (3000 + i), title }); } // near-duplicate wording
  for (let i = 0; i < 6; i++) rows.push({ id: 'OF' + (4000 + i), source: pick(SOURCES), title: R() < 0.5 ? '' : '   ', price_raw: '$1.00', start: '2022-07-01', end: '2022-07-08', _cat: null });
  // shuffle
  for (let i = rows.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [rows[i], rows[j]] = [rows[j], rows[i]]; }
  return rows;
}
const parsePrice = s => { if (!s) return null; const m = String(s).replace(/o/gi, '0').replace(/usd|\$/gi, '').trim().replace(',', '.'); return /^\d+(\.\d{1,2})?$/.test(m) ? Math.round(parseFloat(m) * 100) : NaN; };
const isPromo = t => /buy one get one|bogo|free|\$\d+\s+off/i.test(t);

export function mount(el, ctx) {
  const L = lifetime(); let ran = false;
  el.innerHTML = `<div class="ms">
    <h4>Sort 300 messy offers</h4>
    <p class="ms-lead">Five feeds, one mess: duplicates, shouty casing, broken prices, the same offer worded three ways. Run the pipeline and watch each stage do its job.</p>
    <div class="ms-dag" data-r="dag" aria-label="Pipeline stages"></div>
    <div class="ms-row"><button type="button" class="ms-btn ms-primary" data-run>Run the pipeline</button><span class="ms-mono" data-r="st"></span></div>
    <div data-r="out"></div>
    <p class="ms-note">An illustration of the approach on synthetic data generated in your browser. The real pipelines ran in PySpark across 10+ sources.</p></div>`;
  const $ = r => el.querySelector(`[data-r="${r}"]`); const counts = {};
  const dag = (on = -1) => { $('dag').innerHTML = STAGES.map((s, i) => `${i ? '<span class="ms-arrow">→</span>' : ''}<span class="ms-node ${i < on ? 'ms-done' : i === on ? 'ms-on' : ''}">${s}<small>${counts[s] ?? '·'}</small></span>`).join(''); };
  dag();

  async function run() {
    if (ran) return; ran = true; const btn = el.querySelector('[data-run]'); btn.disabled = true; const st = $('st'); const out = $('out'); const T = now();
    const pause = () => L.sleep(ctx.reduceMotion ? 50 : 650);
    // 1 extract
    dag(0); let t0 = now(); const raw = generate(rng(711)); counts.extract = raw.length;
    const bySrc = SOURCES.map(s => `${s}: ${raw.filter(r => r.source === s).length}`).join(', ');
    ctx.work.step('Extract', `generated ${raw.length} synthetic offers (seed 711) from 5 mock feeds\n${bySrc}\nsample: ${JSON.stringify({ id: raw[0].id, title: raw[0].title, price_raw: raw[0].price_raw })}`, { ms: ms(t0) }); st.textContent = `${raw.length} rows extracted`; if (!await pause()) return;
    // 2 validate
    dag(1); t0 = now(); const rules = [
      ['R1 title not blank', r => r.title.trim().length > 0],
      ['R2 price parseable when the offer needs one', r => isPromo(r.title) || (r.price_raw !== '' && !Number.isNaN(parsePrice(r.price_raw)))],
      ['R3 end date after start date', r => r.end >= r.start],
    ];
    const rej = {}; const valid = raw.filter(r => { for (const [name, f] of rules) if (!f(r)) { (rej[name] = rej[name] || []).push(r); return false; } return true; });
    counts.validate = valid.length;
    const rejTxt = Object.entries(rej).map(([k, v]) => `${k}: ${v.length} rejected, e.g. ${JSON.stringify(v[0].title.trim() || '(blank)')} price=${JSON.stringify(v[0].price_raw)}`).join('\n');
    ctx.work.step('Validate', `${raw.length} in -> ${valid.length} pass, ${raw.length - valid.length} rejected\n${rejTxt}`, { ms: ms(t0) }); st.textContent = `${raw.length - valid.length} rows rejected with reasons`; if (!await pause()) return;
    // 3 clean
    dag(2); t0 = now(); let changed = 0;
    const clean = valid.map(r => { const title = r.title.toLowerCase().replace(/\s+/g, ' ').trim().replace(/buy one get one free/g, 'bogo').replace(/[!]+$/g, ''); const price = parsePrice(r.price_raw); const o = { ...r, title, price_cents: Number.isNaN(price) ? null : price }; if (title !== r.title || (r.price_raw && ('$' + (price / 100).toFixed(2)) !== r.price_raw)) changed++; return o; });
    counts.clean = clean.length;
    ctx.work.step('Clean / normalise', `lower-case, collapse whitespace, strip "!!", "buy one get one free" -> "bogo"\nprices: "$ 2.oo" / "1,99 USD" / "USD 3" -> integer cents\n${changed} of ${clean.length} rows changed`, { ms: ms(t0) }); st.textContent = `${changed} rows normalised`; if (!await pause()) return;
    // 4 dedupe
    dag(3); t0 = now(); const seen = new Map(); const exact = []; const kept1 = [];
    for (const r of clean) { const k = r.title + '|' + r.price_cents; if (seen.has(k)) exact.push(r); else { seen.set(k, r); kept1.push(r); } }
    const toks = kept1.map(r => tokens(r.title).filter(w => !DEDUPE_STOP.has(w)));
    const drop = new Set(); const near = []; let pairs = 0;
    for (let i = 0; i < kept1.length; i++) { if (drop.has(i)) continue; for (let j = i + 1; j < kept1.length; j++) { if (drop.has(j)) continue; pairs++; const s = jaccard(toks[i], toks[j]); if (s >= 0.9 && kept1[i].price_cents === kept1[j].price_cents) { drop.add(j); near.push([kept1[i].title, kept1[j].title, s]); } } }
    const deduped = kept1.filter((_, i) => !drop.has(i)); counts.dedupe = deduped.length;
    ctx.work.step('Dedupe', `exact (title+price): ${exact.length} removed\nnear-duplicate (token Jaccard ≥ 0.9, same price): ${pairs} pairs compared, ${near.length} removed\n${near.slice(0, 3).map(([a, b, s]) => `"${b}" ≈ "${a}" (J=${s.toFixed(2)})`).join('\n')}\n${clean.length} -> ${deduped.length} rows`, { ms: ms(t0) }); st.textContent = `${exact.length + near.length} duplicates removed`; if (!await pause()) return;
    // 5 tf-idf
    dag(4); t0 = now(); const docs = deduped.map(r => tokens(r.title).filter(w => !STOPW.has(w) && !/^\d/.test(w) && w !== 'limited' && w !== 'time'));
    const df = new Map(); docs.forEach(d => new Set(d).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
    const vocab = [...df.keys()].sort(); const vi = new Map(vocab.map((w, i) => [w, i])); const N = docs.length;
    const idf = vocab.map(w => Math.log((1 + N) / (1 + df.get(w))) + 1);
    const X = docs.map(d => { const v = new Float64Array(vocab.length); d.forEach(w => v[vi.get(w)] += 1); let n = 0; for (let i = 0; i < v.length; i++) { v[i] *= idf[i]; n += v[i] * v[i]; } n = Math.sqrt(n) || 1; for (let i = 0; i < v.length; i++) v[i] /= n; return v; });
    counts.tfidf = `${N}×${vocab.length}`;
    const topIdf = vocab.map((w, i) => [w, idf[i]]).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([w, v]) => `${w}:${v.toFixed(2)}`).join(', ');
    ctx.work.step('TF-IDF', `${N} docs × ${vocab.length} terms, idf = ln((1+N)/(1+df))+1, rows L2-normalised\nmost common (lowest idf): ${topIdf}`, { ms: ms(t0) }); st.textContent = `matrix ${N}×${vocab.length}`; if (!await pause()) return;
    // 6 k-means with silhouette
    dag(5); t0 = now(); const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
    const D = X.map(a => X.map(b => 1 - dot(a, b))); // cosine distance matrix
    function kmeans(k, seed) {
      const R = rng(seed); const C = [X[(R() * N) | 0].slice()];
      while (C.length < k) { const d2 = X.map(x => Math.min(...C.map(c => 1 - dot(x, c))) ** 2); let s = d2.reduce((a, b) => a + b, 0) * R(); let i = 0; while ((s -= d2[i]) > 0 && i < N - 1) i++; C.push(X[i].slice()); }
      let a = new Array(N).fill(-1), it = 0;
      for (; it < 50; it++) { let moved = 0; X.forEach((x, i) => { let b = 0, bs = -2; C.forEach((c, j) => { const s = dot(x, c); if (s > bs) { bs = s; b = j; } }); if (a[i] !== b) { a[i] = b; moved++; } });
        C.forEach((c, j) => { c.fill(0); let n = 0; X.forEach((x, i) => { if (a[i] === j) { n++; for (let q = 0; q < c.length; q++) c[q] += x[q]; } }); let nn = Math.sqrt(dot(c, c)) || 1; for (let q = 0; q < c.length; q++) c[q] /= nn; });
        if (!moved) break; }
      return { a, C, it };
    }
    const sil = a => { let tot = 0; for (let i = 0; i < N; i++) { const by = {}; for (let j = 0; j < N; j++) if (j !== i) (by[a[j]] = by[a[j]] || []).push(D[i][j]); const own = by[a[i]]; if (!own) continue; const ai = own.reduce((x, y) => x + y, 0) / own.length; let bi = Infinity; for (const k in by) if (+k !== a[i]) bi = Math.min(bi, by[k].reduce((x, y) => x + y, 0) / by[k].length); tot += (bi - ai) / Math.max(ai, bi); } return tot / N; };
    const trials = []; for (let k = 3; k <= 6; k++) { let best = null; for (let s = 0; s < 3; s++) { const r = kmeans(k, 100 * k + s); r.s = sil(r.a); if (!best || r.s > best.s) best = r; } trials.push({ k, ...best }); }
    const best = trials.reduce((a, b) => b.s > a.s ? b : a); counts.kmeans = `k=${best.k}`;
    ctx.work.step('k-means (spherical, cosine)', `k-means++ init, 3 restarts per k, best silhouette kept\n${trials.map(t => `k=${t.k}: silhouette ${t.s.toFixed(3)} (${t.it} iters)`).join('\n')}\nchosen k = ${best.k}`, { ms: ms(t0) }); st.textContent = `best k = ${best.k} by silhouette`; if (!await pause()) return;
    // 7 label
    dag(6); t0 = now(); const clusters = best.C.map((c, j) => { const members = deduped.filter((_, i) => best.a[i] === j); const top = [...c].map((v, i) => [vocab[i], v]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]); const cats = {}; members.forEach(m => cats[m._cat] = (cats[m._cat] || 0) + 1); const maj = Object.entries(cats).sort((a, b) => b[1] - a[1])[0] || ['-', 0]; return { j, top, members, maj, label: top.slice(0, 2).join(' / ') }; }).filter(c => c.members.length).sort((a, b) => b.members.length - a.members.length);
    const purity = clusters.reduce((s, c) => s + c.maj[1], 0) / N; counts.label = clusters.length;
    ctx.work.step('Label clusters by top terms', clusters.map(c => `"${c.label}" (${c.members.length} offers) top terms: ${c.top.join(', ')}`).join('\n') + `\npurity vs the generator's hidden category: ${(purity * 100).toFixed(1)}% (synthetic check, not the production metric)`, { ms: ms(t0) });
    dag(7); st.textContent = `done in ${Math.round(now() - T)} ms`;
    ctx.work.step('Pipeline finished', `${raw.length} raw -> ${valid.length} valid -> ${deduped.length} unique -> ${clusters.length} clusters\npurity ${(purity * 100).toFixed(1)}% on synthetic data`, { kind: 'result', ms: ms(T) });
    // render
    const sample = [...new Map([...exact.slice(0, 1), ...raw.filter(r => r.price_raw && /USD|o/.test(r.price_raw) && valid.includes(r)).slice(0, 2), ...raw.filter(r => r.title !== r.title.toLowerCase().trim()).slice(0, 3)].map(r => [r.title.toLowerCase().trim(), r])).values()].slice(0, 5);
    const cleanOf = r => clean.find(c => c.id === r.id);
    out.innerHTML = `<div class="ms-panel"><span class="ms-label">Before → after (sample)</span><div class="ms-scroll"><table class="ms-table"><tr><th>raw title</th><th>raw price</th><th>clean</th><th>cents</th></tr>${sample.map(r => { const c = cleanOf(r); return `<tr><td class="ms-bad-cell">${esc(JSON.stringify(r.title))}</td><td class="ms-bad-cell">${esc(r.price_raw || '—')}</td><td>${esc(c?.title ?? '')}</td><td class="ms-mono">${c?.price_cents ?? '—'}</td></tr>`; }).join('')}</table></div></div>
      <div><span class="ms-label">${clusters.length} groups found (k chosen by silhouette)</span><div class="ms-clusters">${clusters.map(c => `<div class="ms-cluster"><b>${esc(c.label)}</b><span class="ms-mono">${c.members.length} offers</span><ul>${c.members.slice(0, 3).map(m => `<li>${esc(m.title)}</li>`).join('')}</ul></div>`).join('')}</div></div>
      <div class="ms-result">${raw.length} raw rows → ${deduped.length} unique offers in ${clusters.length} groups. Purity against the generator's hidden categories: ${(purity * 100).toFixed(1)}% (a check on this synthetic data only).</div>`;
    ctx.complete();
  }
  el.querySelector('[data-run]').addEventListener('click', run);
  return { unmount() { L.kill(); el.innerHTML = ''; } };
}
