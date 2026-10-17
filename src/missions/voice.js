// Mission: the salon call. A scripted call voiced by your browser's speechSynthesis (timed text fallback),
// with a per-turn pipeline timeline (ASR -> LLM -> calendar tool -> TTS; durations illustrative)
// and a real slot-search function against a mini Saturday calendar.
import './missions.css';
import { esc, lifetime, now, ms, json } from './_util.js';

const SLOTS = ['3:00', '3:30', '4:00', '4:30', '5:00', '5:30', '6:00', '6:30'];
const SCRIPT = [
  { who: 'agent', text: 'Hi, thanks for calling the salon. How can I help you today?' },
  { who: 'caller', text: 'Hi! Can I book a haircut for Saturday at four?' },
  { who: 'agent', tool: { name: 'check_availability', args: { day: 'Saturday', time: '4:00', service: 'haircut' } }, text: r => `Saturday at four is taken, but I have ${r.alt} free. Would that work?` },
  { who: 'caller', text: 'Yes, four thirty works. The name is Ananya.' },
  { who: 'agent', tool: { name: 'book_slot', args: { day: 'Saturday', time: '4:30', service: 'haircut', name: 'Ananya' } }, text: r => `Done. Ananya, you're booked for a haircut on Saturday at ${r.time}. We'll text you a confirmation.` },
  { who: 'caller', text: 'Perfect, thank you!' },
  { who: 'agent', text: 'See you on Saturday. Bye!' },
];
// Illustrative stage durations (ms) for each agent turn: [asr, llm, tool, tts-first-audio]
const STAGE = [[0, 380, 0, 240], [310, 520, 160, 250], [300, 610, 190, 260], [290, 430, 0, 230]];
const LANES = [['ASR', '#2F5D6E'], ['LLM', '#7A2E2E'], ['Calendar', '#2E7D4F'], ['TTS', '#B5651D']];

export function mount(el, ctx) {
  const L = lifetime(); const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  let playing = false, speaking = 0, cal = SLOTS.map(t => ({ t, state: t === '4:00' ? 'taken' : 'free' }));
  el.innerHTML = `<div class="ms">
    <h4>Call the salon</h4>
    <p class="ms-lead">A caller wants Saturday at 4:00, which is taken. Listen to how the receptionist handles it, and watch each step of the pipeline.</p>
    <canvas class="ms-wave" width="440" height="54" aria-hidden="true"></canvas>
    <div class="ms-row"><button type="button" class="ms-btn ms-primary" data-play>▶ Play the call</button><label class="ms-row" style="gap:4px;font-size:13px"><input type="checkbox" data-mute ${synth ? '' : 'checked disabled'}> Text only</label><span class="ms-mono" data-r="st"></span></div>
    <div class="ms-transcript" data-r="tr" aria-live="polite"></div>
    <div class="ms-panel"><span class="ms-label">Saturday</span><div class="ms-cal" data-r="cal"></div></div>
    <div class="ms-panel"><span class="ms-label">Pipeline per agent turn (durations illustrative)</span><svg class="ms-svg" viewBox="0 0 320 112" data-r="tl" role="img" aria-label="Pipeline timeline"></svg></div>
    <p class="ms-note">A scripted call in your browser's own voice${synth ? '' : ' (speech isn\'t available here, so it plays as timed text)'}. On the real site this will be a recording of the actual agent.</p></div>`;
  const $ = r => el.querySelector(`[data-r="${r}"]`); const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  const drawCal = (checking) => { $('cal').innerHTML = cal.map(s => `<div class="ms-slot ms-${s.t === checking ? 'checking' : s.state}">${s.t}</div>`).join(''); };
  drawCal();
  const turns = []; // timeline rows
  function drawTL() {
    const rows = turns.length; const svg = $('tl'); let h = '';
    LANES.forEach(([n, c], i) => { h += `<rect x="${8 + i * 78}" y="2" width="9" height="9" fill="${c}"/><text x="${21 + i * 78}" y="10" font-size="9">${n}</text>`; });
    turns.forEach((t, r) => { let x = 46; const y = 20 + r * 22; h += `<text x="0" y="${y + 10}" font-size="9" font-family="monospace">turn ${r + 1}</text>`; t.forEach((d, i) => { if (!d) return; const w = d / 1800 * 240; h += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="14" rx="2" fill="${LANES[i][1]}"/>${w > 22 ? `<text x="${(x + 3).toFixed(1)}" y="${y + 10}" font-size="8" fill="#fff">${d}</text>` : ''}`; x += w; }); h += `<text x="${(x + 4).toFixed(1)}" y="${y + 10}" font-size="9" font-family="monospace">${t.reduce((a, b) => a + b, 0)} ms</text>`; });
    if (!rows) h += '<text x="160" y="60" text-anchor="middle" font-size="10" fill="#4B4F69">Play the call to fill this in</text>';
    svg.innerHTML = h;
  }
  drawTL();
  // waveform: animated bars while someone is speaking (decorative, not the audio signal)
  const bars = 48; let phase = 0;
  L.raf(() => { phase += 0.12; g.fillStyle = '#0B1026'; g.fillRect(0, 0, 440, 54); for (let i = 0; i < bars; i++) { const a = speaking ? (0.25 + 0.75 * Math.abs(Math.sin(phase * (1 + (i % 5) * 0.21) + i * 0.7)) * Math.abs(Math.sin(i * 0.37 + phase * 0.5))) : 0.06; const h = a * 44; g.fillStyle = speaking === 1 ? '#FFC93C' : '#9FD8B5'; g.fillRect(6 + i * 9, 27 - h / 2, 5, Math.max(2, h)); } });

  // Real tools over the mini calendar.
  const tools = {
    check_availability: ({ time }) => { const i = SLOTS.indexOf(time); const s = cal[i]; if (s && s.state === 'free') return { available: true, time }; const alt = cal.slice(i + 1).find(x => x.state === 'free') || cal.find(x => x.state === 'free'); return { available: false, requested: time, alt: alt?.t || null }; },
    book_slot: ({ time, name }) => { const s = cal.find(x => x.t === time); if (!s || s.state !== 'free') return { ok: false }; s.state = 'booked'; s.name = name; return { ok: true, time, name, confirmation: 'SAT-' + time.replace(':', '') }; },
  };
  function say(text, who) {
    const mute = el.querySelector('[data-mute]').checked; const est = 350 + text.split(/\s+/).length * 330; const t0 = now();
    return new Promise(res => {
      let done = false; const fin = engine => { if (done) return; done = true; res({ engine, ms: Math.round(now() - t0) }); };
      if (synth && !mute) {
        try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; u.pitch = who === 'agent' ? 1.05 : 0.85; const vs = synth.getVoices().filter(v => /^en/i.test(v.lang)); if (vs.length) u.voice = who === 'agent' ? vs[0] : (vs[1] || vs[0]); u.onend = () => fin('speechSynthesis'); u.onerror = () => fin('speechSynthesis (error, timed fallback)'); synth.speak(u); } catch { /* fall through to timer */ }
        L.sleep(est * 1.8 + 1500).then(() => fin('timed text (speech did not finish)'));
      } else L.sleep(est).then(() => fin('timed text'));
    });
  }

  async function play() {
    if (playing) return; playing = true; const btn = el.querySelector('[data-play]'); btn.disabled = true; $('tr').innerHTML = ''; turns.length = 0; drawTL();
    cal = SLOTS.map(t => ({ t, state: t === '4:00' ? 'taken' : 'free' })); drawCal(); const T = now(); let agentTurn = 0;
    ctx.work.step('Call started', `speech engine: ${synth && !el.querySelector('[data-mute]').checked ? 'browser speechSynthesis' : 'timed text'}\ncalendar Saturday: ${cal.map(s => s.t + (s.state === 'taken' ? '(taken)' : '')).join(' ')}`);
    for (const line of SCRIPT) {
      if (!L.alive) return; let result = null; let tt = now();
      if (line.who === 'agent') {
        const st = STAGE[agentTurn] || STAGE[0];
        if (line.tool) { drawCal(line.tool.args.time); $('st').textContent = `calling ${line.tool.name}…`; if (!await L.sleep(ctx.reduceMotion ? 50 : 500)) return; tt = now(); result = tools[line.tool.name](line.tool.args); drawCal(); ctx.work.step(`tool: ${line.tool.name}`, `args: ${json(line.tool.args)}\nresult: ${json(result)}`, { ms: ms(tt) }); }
        turns.push([...st.slice(0, 2), line.tool ? st[2] : 0, st[3]]); drawTL(); agentTurn++;
      }
      const text = typeof line.text === 'function' ? line.text(result) : line.text;
      $('tr').insertAdjacentHTML('beforeend', `<div class="ms-line-t ms-${line.who}"><small>${line.who === 'agent' ? 'Receptionist (AI)' : 'Caller'}</small>${esc(text)}</div>`); $('tr').scrollTop = 1e6;
      $('st').textContent = line.who === 'agent' ? 'speaking…' : 'listening…';
      speaking = line.who === 'agent' ? 1 : 2; const r = await say(text, line.who); speaking = 0;
      ctx.work.step(`${line.who === 'agent' ? 'Agent' : 'Caller'} turn`, `"${text}"\nvoiced by ${r.engine} in ${r.ms} ms`, { ms: r.ms });
      if (!await L.sleep(ctx.reduceMotion ? 50 : 350)) return;
    }
    const b = cal.find(s => s.state === 'booked');
    $('st').textContent = `call ended · ${Math.round((now() - T) / 1000)} s`;
    ctx.work.step('Call ended', `booked: ${b ? `Saturday ${b.t} for ${b.name}` : 'none'}\nwall time ${Math.round(now() - T)} ms\npipeline durations shown are illustrative`, { kind: 'result', ms: ms(T) });
    playing = false; btn.disabled = false; btn.textContent = '▶ Play again'; ctx.complete();
  }
  el.querySelector('[data-play]').addEventListener('click', play);
  return { unmount() { L.kill(); try { synth?.cancel(); } catch { /* ignore */ } el.innerHTML = ''; } };
}
