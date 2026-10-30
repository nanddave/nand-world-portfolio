// Original generative music, one piece per city, synthesised live with WebAudio (no audio files, no licences).
// Each piece = tempo, key, scale, chord shape, progression and a few voices. A lookahead scheduler plays it under the ambience.
// Driven by Sound (sound.js): Sound.play(city) starts the matching piece, Sound.stop() fades it out.
const SEMI = n => 2 ** (n / 12), MAJ = [0, 4, 7], MIN = [0, 3, 7];
const PIECES = {
  globe:   { bpm: 56, root: 146.83, scale: [0, 2, 7, 9, 12], chord: [0, 7, 12, 16], prog: [0, 5, 0, 7], pad: ['sine', .035], mel: { p: .22, type: 'sine', lp: 2400, vol: .035, dur: 2.6 } },
  nadiad:  { bpm: 76, root: 146.83, scale: [0, 1, 4, 5, 7, 8, 11], chord: [0, 7, 12], prog: [0, 0, 0, 0], drone: .035, mel: { p: .6, type: 'sawtooth', lp: 2200, vol: .05, dur: 1.1 }, dhol: .06 },
  blr:     { bpm: 108, root: 220, scale: [0, 3, 5, 7, 10], chord: MIN, prog: [0, 5, 7, 0], arp: [0, 2, 1, 2, 0, 2, 1, 2], arpT: 'triangle', arpV: .045, bass: 4, bassT: 'sine', kick: .1, hat: .012, mel: { p: .45, type: 'square', lp: 1800, vol: .022, dur: .35 } },
  boston:  { bpm: 66, root: 220, scale: [0, 2, 3, 5, 7, 8, 10], chord: MIN, prog: [0, 5, 7, 0], arp: [0, 1, 2, 1, 0, 1, 2, 1], arpT: 'triangle', arpV: .05, arpD: 1.6, pad: ['sine', .025], mel: { p: .28, type: 'triangle', lp: 3000, vol: .05, dur: 1.8 } },
  irving:  { bpm: 100, root: 196, scale: [0, 2, 4, 7, 9], chord: MAJ, prog: [0, 5, 0, 7], swing: .22, bass: 4, bassT: 'triangle', bassV: .08, arp: [0, -1, 1, -1, 2, -1, 1, -1], arpT: 'sawtooth', arpLp: 1800, arpV: .035, arpD: .5, hat: .01, mel: { p: .5, type: 'sawtooth', lp: 2400, vol: .04, dur: .6 } },
  seattle: { bpm: 72, root: 220, scale: [0, 3, 5, 7, 10], chord: [0, 3, 7, 10], prog: [0, 5, 0, 7], pad: ['triangle', .03], bass: 8, bassT: 'sine', bassV: .09, hat: .008, kick: .07, mel: { p: .35, type: 'triangle', lp: 2200, vol: .04, dur: 1.4 } },
  sf:      { bpm: 104, root: 261.63, scale: [0, 2, 4, 7, 9], chord: [0, 4, 7, 11], prog: [0, 5, 0, 5], swing: .12, arp: [0, 1, 2, 3, 2, 1, 2, 3], arpT: 'triangle', arpV: .04, arpD: .7, bass: 4, bassT: 'sine', hat: .01, mel: { p: .4, type: 'sine', lp: 3200, vol: .045, dur: 1 } },
  brokai:  { bpm: 100, root: 110, scale: [0, 3, 5, 7, 10], chord: MIN, prog: [0, 5, 7, 0], arp: [0, 1, 2, 1, 0, 1, 2, 1], arpT: 'sawtooth', arpLp: 1500, arpV: .03, arpD: .22, bass: 2, bassT: 'sawtooth', bassLp: 500, bassV: .06, kick: .12, hat: .014, pad: ['sawtooth', .012], mel: { p: .3, type: 'square', lp: 1600, vol: .02, dur: .5 } },
};
PIECES.bellevue = PIECES.seattle;

export const Music = {
  S: null, p: null, gain: null, timer: null, step: 0, nextT: 0, deg: 3, seed: 1,
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; },
  play(S, id) {
    this.stop(); if (!S.ctx || !S.on) return; const c = S.ctx;
    this.S = S; this.p = PIECES[id] || PIECES.globe; this.step = 0; this.deg = 3; this.seed = 7;
    this.gain = c.createGain(); this.gain.gain.value = 0; this.gain.connect(S.master); this.gain.gain.setTargetAtTime(1, c.currentTime, 1.5);
    this.nextT = c.currentTime + .3; this.timer = setInterval(() => this.tick(), 120); this.tick();
  },
  stop() {
    clearInterval(this.timer); this.timer = null; const g = this.gain, c = this.S?.ctx; this.gain = null; if (!g || !c) return;
    g.gain.setTargetAtTime(0, c.currentTime, .3); setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 1800);
  },
  tick() {
    const c = this.S?.ctx; if (!c || !this.gain || !this.S.on) return;
    while (this.nextT < c.currentTime + .6) {
      const d = 30 / this.p.bpm, odd = this.step % 2, t = this.nextT + (odd ? (this.p.swing || 0) * d : 0);
      this.beat(this.step, t, d); this.step++; this.nextT += d;
    }
  },
  note(f, t, dur, vol, type, lp, attack = .012) {
    const c = this.S.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; let out = o;
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); out = fl; }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    out.connect(g); g.connect(this.gain); o.start(t); o.stop(t + dur + .05);
  },
  burst(t, type, vol) { // kick (sine drop) or hat (filtered noise tick)
    const c = this.S.ctx;
    if (type === 'kick') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + .14); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .2); o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + .22); return; }
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.S.noiseBuf; fl.type = 'highpass'; fl.frequency.value = type === 'dhol' ? 200 : 7000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + (type === 'dhol' ? .12 : .04)); s.connect(fl); fl.connect(g); g.connect(this.gain); s.start(t); s.stop(t + .15);
  },
  beat(step, t, d) {
    const P = this.p, s = step % 8, bar = Math.floor(step / 8), cr = P.prog[bar % P.prog.length], hz = n => P.root * SEMI(n), barLen = d * 8;
    if (s === 0) {
      if (P.pad) P.chord.forEach(n => this.note(hz(cr + n), t, barLen * 1.05, P.pad[1], P.pad[0], 1800, barLen * .4));
      if (P.drone) [0, 7, 12].forEach(n => this.note(hz(n - 12), t, barLen * 1.05, P.drone, 'sine', 900, .6));
    }
    if (P.bass && s % P.bass === 0) this.note(hz(cr - 12), t, d * P.bass * .9, P.bassV || .07, P.bassT || 'sine', P.bassLp || 600);
    if (P.arp && P.arp[s] >= 0) this.note(hz(cr + P.chord[P.arp[s] % P.chord.length] + 12), t, d * (P.arpD || 1), P.arpV, P.arpT, P.arpLp || 3500);
    if (P.mel && s % 2 === 0 && this.rnd() < P.mel.p) {
      this.deg = Math.max(0, Math.min(P.scale.length * 2 - 1, this.deg + [-2, -1, -1, 0, 1, 1, 2][Math.floor(this.rnd() * 7)]));
      const n = P.scale[this.deg % P.scale.length] + 12 * Math.floor(this.deg / P.scale.length) + 12;
      this.note(hz(n), t, P.mel.dur, P.mel.vol, P.mel.type, P.mel.lp);
    }
    if (P.kick && (s === 0 || s === 4)) this.burst(t, 'kick', P.kick);
    if (P.dhol && (s === 0 || s === 3 || s === 6)) this.burst(t, 'dhol', P.dhol * (s === 0 ? 1 : .6));
    if (P.hat && s % 2 === 1) this.burst(t, 'hat', P.hat);
  },
};
