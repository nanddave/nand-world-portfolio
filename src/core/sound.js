// WebAudio ambience, synthesised live (no audio files). One soundscape per city id plus 'globe'.
// Off until the visitor presses Start; a toggle in the top bar switches it.
import { Music } from './music.js';
export const Sound = {
  ctx: null, master: null, on: false, nodes: [], timers: [], wnodes: [], wtimers: [], wx: null, noiseBuf: null, current: null, _last: null, onChange: null,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0; this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
    } catch (e) { this.ctx = null; }
  },
  set(on) {
    this.init(); this.on = on; this.onChange?.(on); if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? .55 : 0, this.ctx.currentTime, .3);
    if (on && this.current) this.play(this.current, true); else if (!on) { this.stop(); this._last = null; }
    this.applyWeather();
  },
  noise(type, f, q, g, bucket = this.nodes) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 1; const gn = c.createGain(); gn.gain.value = 0;
    s.connect(fl); fl.connect(gn); gn.connect(this.master); s.start(); gn.gain.setTargetAtTime(g, c.currentTime, 1); bucket.push({ s, gn }); return { s, fl, gn };
  },
  tone(type, f, dur, g, slide) {
    const c = this.ctx, o = c.createOscillator(), gn = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, c.currentTime); if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + dur * .8);
    gn.gain.setValueAtTime(0, c.currentTime); gn.gain.linearRampToValueAtTime(g, c.currentTime + .02); gn.gain.exponentialRampToValueAtTime(.0001, c.currentTime + dur); o.connect(gn); gn.connect(this.master); o.start(); o.stop(c.currentTime + dur + .05);
  },
  every(min, max, fn, bucket = this.timers) { const go = () => { fn(); bucket.push(setTimeout(go, (min + Math.random() * (max - min)) * 1000)); }; bucket.push(setTimeout(go, min * 500)); },
  /** Weather layer, independent of the city ambience: { rain, snow (0..1), thunder } or null. Designed scenes pass their own; live scenes pass the real weather. */
  weather(w) { this.wx = w; this.applyWeather(); },
  applyWeather() {
    const c = this.ctx; if (!c) return; const S = this, w = this.wx;
    this.wtimers.forEach(clearTimeout); this.wtimers = []; this.wnodes.forEach(n => { try { n.gn.gain.setTargetAtTime(0, c.currentTime, .5); n.s.stop(c.currentTime + 2); } catch (e) { /* already stopped */ } }); this.wnodes = [];
    if (!this.on || !w) return; const rain = w.rain || 0, snow = w.snow || 0;
    if (rain) { S.noise('highpass', 1400, .7, .04 + .14 * rain, S.wnodes); S.noise('bandpass', 700, .8, .015 + .05 * rain, S.wnodes); S.every(.15, .7, () => S.tone('sine', 1500 + Math.random() * 1500, .06, .01 + .02 * rain), S.wtimers); }
    if (snow) { S.noise('lowpass', 450, .7, .04 + .05 * snow, S.wnodes); S.noise('bandpass', 3000, .6, .006, S.wnodes); S.every(1.2, 3.5, () => S.tone('sine', 2600 + Math.random() * 900, .6, .006), S.wtimers); }
    if (w.thunder) S.every(7, 16, () => S.voice('sawtooth', 58, 0, 2.4, .13, ['lowpass', 220]), S.wtimers);
  },
  stop() { const c = this.ctx; if (!c) return; Music.stop(); this.timers.forEach(clearTimeout); this.timers = []; this.nodes.forEach(n => { try { n.gn.gain.setTargetAtTime(0, c.currentTime, .4); n.s.stop(c.currentTime + 1.5); } catch (e) { /* already stopped */ } }); this.nodes = []; },
  /** One-shot synth voice for horns: osc → optional filter → gain envelope → master. */
  voice(type, f, at, dur, g, flt) {
    const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), gn = c.createGain(); o.type = type; o.frequency.value = f;
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + .015); gn.gain.setValueAtTime(g, t + dur * .7); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let out = o; if (flt) { const fl = c.createBiquadFilter(); fl.type = flt[0]; fl.frequency.value = flt[1]; fl.Q.value = flt[2] || 1; o.connect(fl); out = fl; }
    out.connect(gn); gn.connect(this.master); o.start(t); o.stop(t + dur + .05);
  },
  /** City-specific horn. Returns false (and plays nothing) when sound is off. */
  horn(id) {
    if (!this.ctx || !this.on) return false; const v = (...a) => this.voice(...a);
    if (id === 'sf') [0, .28, .56].forEach((t, i) => [[1200, .09], [2470, .05], [3900, .03]].forEach(([f, g]) => { const c = this.ctx, o = c.createOscillator(), gn = c.createGain(), at = c.currentTime + t; o.frequency.value = f; gn.gain.setValueAtTime(g * (1 - i * .15), at); gn.gain.exponentialRampToValueAtTime(.0001, at + .6); o.connect(gn); gn.connect(this.master); o.start(at); o.stop(at + .65); }));
    else if (id === 'irving') { v('sawtooth', 300, 0, .6, .09, ['lowpass', 1500]); v('sawtooth', 370, 0, .6, .09, ['lowpass', 1500]); }
    else if (id === 'boston' || id === 'seattle' || id === 'bellevue') { v('sawtooth', 400, 0, .35, .09, ['lowpass', 1800]); v('sawtooth', 500, 0, .35, .09, ['lowpass', 1800]); }
    else [0, .2].forEach(t => { v('square', 520, t, .13, .07, ['bandpass', 1100, 1.4]); v('square', 780, t, .13, .06, ['bandpass', 1100, 1.4]); });
    return true;
  },
  /** Soft bump when the car hits a wall (0..1). Respects the sound toggle. */
  thud(k = .5) {
    if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), gn = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + .18);
    gn.gain.setValueAtTime(.12 + .25 * k, t); gn.gain.exponentialRampToValueAtTime(.0001, t + .22); o.connect(gn); gn.connect(this.master); o.start(t); o.stop(t + .25);
  },
  play(name, force) {
    this.current = name; if (!this.ctx || !this.on) return; if (!force && this._last === name) return; this._last = name; this.stop(); const S = this;
    const scapes = {
      globe() { S.noise('lowpass', 420, 1, .12); S.noise('bandpass', 900, 3, .02); },
      nadiad() { S.noise('lowpass', 900, 1, .05); S.every(.4, 2.2, () => { const f = 2400 + Math.random() * 1400; S.tone('sine', f, .18, .05, f * 1.35); setTimeout(() => S.on && S.tone('sine', f * 1.1, .12, .04, f * 1.5), 140); }); S.every(8, 13, () => { S.tone('sine', 523, 3.2, .06); S.tone('sine', 785, 2.6, .03); }); },
      blr() { S.noise('lowpass', 320, 1, .16); S.noise('bandpass', 1100, 1, .025); S.every(1.5, 4, () => { const f = [392, 440, 494][Math.floor(Math.random() * 3)]; S.tone('square', f, .22, .025); if (Math.random() < .4) setTimeout(() => S.on && S.tone('square', f, .18, .025), 280); }); },
      boston() { const w = S.noise('bandpass', 380, 2.5, .13); const l = S.ctx.createOscillator(), lg = S.ctx.createGain(); l.frequency.value = .13; lg.gain.value = 160; l.connect(lg); lg.connect(w.fl.frequency); l.start(); S.nodes.push({ s: l, gn: lg }); S.every(12, 20, () => { S.tone('sine', 1320, 1.4, .05); setTimeout(() => S.on && S.tone('sine', 1320, 1.2, .04), 260); }); },
      irving() {
        const o = S.ctx.createOscillator(), am = S.ctx.createOscillator(), g = S.ctx.createGain(), amg = S.ctx.createGain(); o.frequency.value = 4700; am.frequency.value = 38; amg.gain.value = .018; g.gain.value = 0; am.connect(amg); amg.connect(g.gain); o.connect(g); g.connect(S.master); o.start(); am.start(); S.nodes.push({ s: o, gn: g }, { s: am, gn: amg });
        const hw = S.noise('lowpass', 650, 1, .07); S.every(2.5, 5, () => { const t = S.ctx.currentTime; hw.gn.gain.cancelScheduledValues(t); hw.gn.gain.setTargetAtTime(.2, t, .6); hw.gn.gain.setTargetAtTime(.07, t + 1.6, .8); });
      },
      seattle() { S.noise('lowpass', 380, 1, .07); },
      sf() { S.noise('lowpass', 500, 1, .1); S.every(10, 16, () => { S.tone('sawtooth', 92, 2.4, .07); setTimeout(() => S.on && S.tone('sawtooth', 78, 2.6, .07), 2500); }); S.every(9, 15, () => { S.tone('triangle', 1600, .5, .03); setTimeout(() => S.on && S.tone('triangle', 1600, .5, .03), 220); }); },
      brokai() { S.noise('lowpass', 260, 1, .1); S.every(.6, 1.6, () => { for (let k = 0; k < 3; k++) setTimeout(() => S.on && S.tone('sine', 4300, .05, .015), k * 70); }); S.every(4, 9, () => S.tone('square', 440, .2, .018)); },
    };
    (scapes[name] || scapes[name === 'bellevue' ? 'seattle' : 'globe'])();
    Music.play(this, name); this.applyWeather();
  },
};
