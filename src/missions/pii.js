// Mission: catch the leak. Rule-based multilingual PII detection (EN / HI / ES / FR).
// Regex + checksum detectors (Luhn, IBAN mod-97) + a small name gazetteer with honorific cues.
// A rule-based demo of the annotation task; the paper is about annotating PII at scale across languages.
import './missions.css';
import { esc, now, ms } from './_util.js';

const EX = {
  English: 'Hi, this is Dr. Sarah Miller. Call me at +1 (206) 555-0143 or email sarah.miller@example.com.\nMy card 4111 1111 1111 1111 was charged twice (order ref 4111 1111 1111 1112). SSN 123-45-6789 is on file, DOB: 1988-03-02.\nLast login from 192.168.10.24. Please cc Rahul.',
  'हिन्दी': 'नमस्ते, मेरा नाम श्रीमती प्रिया शर्मा है। मेरा फ़ोन +91 98765 43210 है और ईमेल priya.sharma@example.in है।\nआधार: 2345 6789 0123, पैन: ABCDE1234F। जन्म तिथि: 14/08/1991।\nमेरे भाई श्री राहुल शर्मा का नंबर 98201 55678 है।',
  'Español': 'Hola, soy la Sra. María López. Mi teléfono es +34 612 345 678 y mi correo maria.lopez@ejemplo.es.\nIBAN: ES91 2100 0418 4502 0005 1332. Fecha de nacimiento: 12 de marzo de 1990.\nMi compañero José García usa la IP 10.20.30.40.',
  'Français': 'Bonjour, je suis M. Jean Dupont. Appelez-moi au +33 6 12 34 56 78 ou écrivez à jean.dupont@exemple.fr.\nIBAN FR14 2004 1010 0505 0001 3M02 606. Né le 05/11/1985.\nMme Camille Martin a la carte 5500 0000 0000 0004.',
};
const TYPES = {
  EMAIL: '#FFD36B', PHONE: '#9FD8B5', CARD: '#F7A7A0', AADHAAR: '#C9B6F2', PAN: '#A9CBF5', SSN: '#F5B97F',
  IBAN: '#E6A8D7', IP: '#B9E3E8', DOB: '#D9E59A', NAME: '#FFB3C7',
};
const L_ = '(?<![\\p{L}\\p{M}\\p{N}])', R_ = '(?![\\p{L}\\p{M}\\p{N}])';
const digits = s => s.replace(/\D/g, '');
function luhn(s) { const d = digits(s); let sum = 0; for (let i = 0; i < d.length; i++) { let x = +d[d.length - 1 - i]; if (i % 2) { x *= 2; if (x > 9) x -= 9; } sum += x; } return sum % 10 === 0; }
function ibanOk(s) { const t = s.replace(/\s/g, '').toUpperCase(); const r = (t.slice(4) + t.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55)); let m = 0; for (const ch of r) m = (m * 10 + +ch) % 97; return m === 1; }
const NAMES = ['sarah', 'john', 'emily', 'michael', 'rahul', 'priya', 'ananya', 'arjun', 'vikram', 'neha', 'maría', 'maria', 'josé', 'jose', 'lucía', 'carlos', 'jean', 'marie', 'camille', 'pierre', 'sophie', 'राहुल', 'प्रिया', 'अनन्या', 'अर्जुन', 'नेहा'];
const HONOR = ['Mr\\.?', 'Mrs\\.?', 'Ms\\.?', 'Dr\\.?', 'डॉ\\.?', 'श्रीमती', 'सुश्री', 'श्री', 'Sra\\.', 'Srta\\.', 'Sr\\.', 'Mme', 'Mlle', 'M\\.'];
const WORD = '(?:\\p{Lu}[\\p{Ll}\\p{M}]+|[\\u0900-\\u0963\\u0966-\\u097F]+)';
const DATE = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{1,2}\\s+(?:de\\s+)?\\p{L}+\\s+(?:de\\s+)?\\d{4})';
const DOB_CUE = '(?:DOB|D\\.O\\.B\\.|date of birth|born on|n[ée]e? le|fecha de nacimiento|nacid[oa] el|जन्म ?तिथि)';

// Detectors in priority order (earlier wins on overlap). Each returns [{ s, e, type, text, why }].
const DETECTORS = [
  ['EMAIL', text => rx(text, /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu, 'EMAIL', () => 'pattern')],
  ['IBAN', text => rx(text, /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g, 'IBAN', m => ibanOk(m) ? 'mod-97 ok' : null, m => `rejected "${m}": mod-97 fails`)],
  ['CARD', text => rx(text, /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, 'CARD', m => { const n = digits(m).length; return n >= 13 && n <= 19 && luhn(m) ? `Luhn ok, ${n} digits` : null; }, m => digits(m).length >= 13 ? `rejected "${m}": Luhn checksum fails` : null)],
  ['AADHAAR', text => rx(text, /(?<!\d[ -]?)[2-9]\d{3}[ -]\d{4}[ -]\d{4}(?![ -]?\d)/g, 'AADHAAR', () => '12 digits, 4-4-4 grouping')],
  ['PAN', text => rx(text, /\b[A-Z]{5}\d{4}[A-Z]\b/g, 'PAN', () => 'AAAAA9999A')],
  ['SSN', text => rx(text, /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g, 'SSN', () => 'AAA-GG-SSSS, valid ranges')],
  ['IP', text => rx(text, /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, 'IP', m => m.split('.').every(o => +o <= 255) ? 'octets ≤ 255' : null)],
  ['DOB', text => { const out = []; const re = new RegExp(DOB_CUE + '\\s*[:：]?\\s*(' + DATE + ')', 'giu'); let m; while ((m = re.exec(text))) { const s = m.index + m[0].lastIndexOf(m[1]); out.push({ s, e: s + m[1].length, type: 'DOB', text: m[1], why: `cue "${m[0].slice(0, m[0].length - m[1].length).trim()}"` }); } return { hits: out, rej: [] }; }],
  ['PHONE', text => rx(text, /(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?)?\d{1,5}(?:[ .-]\d{2,5}){1,4}|(?<!\d)\d{10}(?!\d)/g, 'PHONE', m => { const n = digits(m).length; return (m.startsWith('+') ? n >= 9 && n <= 13 : n === 10) ? `${n} digits${m.startsWith('+') ? ', country code ' + m.match(/^\+\d{1,3}/)[0] : ''}` : null; })],
  ['NAME', text => {
    const out = []; const hre = new RegExp(L_ + '(' + HONOR.join('|') + ')\\s+(' + WORD + '(?:\\s+' + WORD + ')?)', 'gu'); let m;
    while ((m = hre.exec(text))) { const s = m.index + m[0].length - m[2].length; out.push({ s, e: s + m[2].length, type: 'NAME', text: m[2], why: `honorific "${m[1]}"` }); }
    const gre = new RegExp(L_ + '(' + NAMES.join('|') + ')' + R_ + '(?:\\s+(' + WORD + '))?', 'giu');
    while ((m = gre.exec(text))) { const first = m[1]; if (!/[ऀ-ॿ]/.test(first) && first[0] !== first[0].toUpperCase()) continue; out.push({ s: m.index, e: m.index + m[0].length, type: 'NAME', text: m[0], why: 'gazetteer' }); }
    return { hits: out, rej: [] };
  }],
];
function rx(text, re, type, ok, rejMsg) { const hits = [], rej = []; let m; while ((m = re.exec(text))) { const why = ok(m[0]); if (why) hits.push({ s: m.index, e: m.index + m[0].length, type, text: m[0], why }); else if (rejMsg) { const r = rejMsg(m[0]); if (r) rej.push(r); } } return { hits, rej }; }

export function mount(el, ctx) {
  let redact = false, last = null, scans = 0;
  el.innerHTML = `<div class="ms">
    <h4>Catch the leak</h4>
    <p class="ms-lead">Paste text in any of four languages, or load an example. The detectors find personal data and mark what kind it is.</p>
    <div class="ms-row" role="group" aria-label="Load example">${Object.keys(EX).map(k => `<button type="button" class="ms-btn ms-small" data-ex="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <div><label class="ms-label" for="ms-pii-in">Text to scan</label><textarea id="ms-pii-in" class="ms-textarea"></textarea></div>
    <div class="ms-row"><button type="button" class="ms-btn ms-primary" data-scan>Scan for PII</button><button type="button" class="ms-btn ms-small" data-redact aria-pressed="false">Redact</button><span class="ms-mono" data-r="st"></span></div>
    <div class="ms-hl" data-r="hl" aria-live="polite"></div>
    <div class="ms-row" data-r="legend"></div>
    <p class="ms-note">A rule-based demo of the annotation task (regex, checksums and a small name list). The paper is about annotating PII at scale across languages.</p></div>`;
  const ta = el.querySelector('textarea'), $ = r => el.querySelector(`[data-r="${r}"]`);
  ta.value = EX.English;

  function scan() {
    const text = ta.value; const T = now(); let taken = []; const report = []; scans++;
    for (const [name, f] of DETECTORS) {
      const t0 = now(); const { hits, rej } = f(text); const kept = []; for (const h of hits) if (![...taken, ...kept].some(o => h.s < o.e && o.s < h.e)) kept.push(h);
      taken = taken.concat(kept); const dt = ms(t0);
      report.push(`${name}: ${kept.length}`);
      if (hits.length || rej.length) ctx.work.step(`Detector ${name}`, [...kept.map(h => `hit "${h.text}" @${h.s}-${h.e} (${h.why})`), ...hits.filter(h => !kept.includes(h)).map(h => `dropped "${h.text}" (overlaps a higher-priority match)`), ...rej].join('\n') || 'no hits', { ms: dt });
    }
    taken.sort((a, b) => a.s - b.s); last = { text, spans: taken };
    const counts = {}; taken.forEach(h => counts[h.type] = (counts[h.type] || 0) + 1);
    ctx.work.step('Scan complete', `${text.length} chars, ${DETECTORS.length} detectors, ${taken.length} spans\n${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ') || 'nothing found'}`, { ms: ms(T), kind: 'result' });
    $('st').textContent = `${taken.length} spans in ${ms(T)} ms`;
    render(); if (scans === 1) ctx.complete();
  }
  function render() {
    if (!last) return; const { text, spans } = last; let html = '', i = 0;
    for (const h of spans) { html += esc(text.slice(i, h.s)); html += redact ? `<mark style="background:${TYPES[h.type]}">[${h.type}]</mark>` : `<mark style="background:${TYPES[h.type]}" title="${h.type}: ${esc(h.why)}">${esc(h.text)}<sup>${h.type}</sup></mark>`; i = h.e; }
    $('hl').innerHTML = html + esc(text.slice(i));
    const counts = {}; spans.forEach(h => counts[h.type] = (counts[h.type] || 0) + 1);
    $('legend').innerHTML = Object.keys(TYPES).map(k => `<span class="ms-swatch" style="opacity:${counts[k] ? 1 : 0.45}"><i style="background:${TYPES[k]}"></i>${k} ${counts[k] || 0}</span>`).join('');
  }
  el.querySelector('[data-scan]').addEventListener('click', scan);
  el.querySelector('[data-redact]').addEventListener('click', e => { redact = !redact; e.currentTarget.setAttribute('aria-pressed', String(redact)); e.currentTarget.textContent = redact ? 'Show originals' : 'Redact'; render(); if (last) ctx.work.step(redact ? 'Redacted view' : 'Original view', `${last.spans.length} spans ${redact ? 'replaced with [TYPE] tokens' : 'shown'}`); });
  el.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { ta.value = EX[b.dataset.ex]; ctx.work.step(`Loaded example: ${b.dataset.ex}`, `${ta.value.length} chars`); scan(); }));
  $('hl').innerHTML = '<span class="ms-lead">Press “Scan for PII” to highlight what the detectors find.</span>';
  $('legend').innerHTML = Object.keys(TYPES).map(k => `<span class="ms-swatch"><i style="background:${TYPES[k]}"></i>${k}</span>`).join('');
  return { unmount() { el.innerHTML = ''; } };
}
