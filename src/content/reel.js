// Hero social reel (≈35 s). Played by src/core/trailer.js with `?trailer=1&reel=hero` (add `&v=1` for 1080×1920).
// Goal: stop the scroll in 1.5 s, show three "wait, what?" moments, then the viral loop (type your city),
// then ONE clear action. Deliberately hides the stories, passport, most cities and the full mission list,
// so the only way to see the rest is to visit. Captions use only facts from stops.js and the résumé.
//
// New actions (on top of src/content/trailer.js vocabulary):
//   title   { text, sub?, style:'hook'|'big'|'stat', dur }  kinetic full-frame type; scene stays visible behind a dim
//   chip    { text, dur }                                 small label pill, top-centre (what the viewer is looking at)
//   route   { dur }                                       globe: draw the 7-stop route line progressively
//   whip    { dur }                                       fast motion-blur/whip transition between shots
//   yours   { text, dur }                                 open "Where are you reading this from?", type text, submit,
//                                                         load the (pre-baked, offline) city, open the lot, raise the building
//   urlbar  { text, company, dur }                        mock address bar types `?for=<company>`, intro shows "Made for <company>"
//   stats   { items:[[n, label],...], dur }               counters roll up, staggered
//   end     { dur }                                       end card from REEL_END (+ CONTACT.site when real)
export const REEL_END = {
  name: 'Nand Dave',
  line: 'Applied AI engineer · voice agents · customer delivery',
  ask: 'Comment your city. I\'ll show you what it looks like.',
};

export const REEL = [
  // 0–3.2 s  HOOK — motion first, words second. A car swings past at street level.
  { at: 0.0, do: 'enter', city: 'blr' },
  { at: 0.0, do: 'drive', from: 'spawn', to: { spot: 1 }, dur: 3.4 },
  { at: 0.15, do: 'title', style: 'hook', text: 'I turned my résumé', dur: 1.5 },
  { at: 1.55, do: 'title', style: 'hook', text: 'into a world you can drive.', dur: 1.6 },
  { at: 0.6, do: 'horn' },

  // 3.2–5.6 s  SCALE — the real Earth, seven stops, one route.
  { at: 3.2, do: 'whip', dur: 0.35 },
  { at: 3.3, do: 'globe', view: 'intro', spin: 1.2 },
  { at: 3.4, do: 'route', dur: 2.0 },
  { at: 3.6, do: 'chip', text: '7 stops · a real Earth', dur: 1.9 },

  // 5.6–9.2 s  WOW 1 — real streets.
  { at: 5.6, do: 'whip', dur: 0.35 },
  { at: 5.7, do: 'enter', city: 'boston' },
  { at: 5.7, do: 'orbit', yaw: -0.4, pitch: 0.42, dist: 120, dur: 3.5 },
  { at: 5.9, do: 'chip', text: 'Real streets · OpenStreetMap', dur: 3.1 },

  // 9.2–12.6 s  WOW 2 — weather that matches the city.
  { at: 9.2, do: 'whip', dur: 0.35 },
  { at: 9.3, do: 'enter', city: 'seattle' },
  { at: 9.3, do: 'orbit', yaw: 0.5, pitch: 0.3, dist: 64, dur: 3.3 },
  { at: 9.5, do: 'chip', text: 'Local time and weather, live', dur: 2.9 },

  // 12.6–18.6 s  WOW 3 — the work is real code, and it changes the world.
  { at: 12.6, do: 'whip', dur: 0.35 },
  { at: 12.7, do: 'enter', city: 'blr' },
  { at: 12.7, do: 'spot', k: 1, dur: 4.0 },
  { at: 12.9, do: 'mission', id: 'machine', dur: 3.6 },
  { at: 13.0, do: 'chip', text: 'Fix the machine. The factory comes back online.', dur: 3.4 },
  { at: 16.6, do: 'whip', dur: 0.3 },
  { at: 16.7, do: 'enter', city: 'seattle' },
  { at: 16.7, do: 'spot', k: 1, dur: 2.0 },
  { at: 16.75, do: 'mission', id: 'pii', dur: 1.9 },
  { at: 16.8, do: 'chip', text: '9 working AI demos, running in your browser', dur: 1.8 },

  // 18.6–25.4 s  THE LOOP — your city, your company.
  { at: 18.6, do: 'whip', dur: 0.35 },
  { at: 18.7, do: 'yours', text: 'Mumbai', dur: 6.6 },
  { at: 18.8, do: 'chip', text: 'Type your city…', dur: 2.2 },
  { at: 21.2, do: 'chip', text: '…it builds your real street.', dur: 2.0 },
  { at: 23.3, do: 'chip', text: 'And a building for your company.', dur: 2.0 },

  // 25.4–28.6 s  RECRUITER HOOK — personalised link.
  { at: 25.4, do: 'whip', dur: 0.3 },
  { at: 25.5, do: 'urlbar', text: '?for=YourCompany', company: 'YourCompany', dur: 3.0 },
  { at: 25.6, do: 'chip', text: 'Recruiters: put your company in the link.', dur: 2.9 },

  // 28.6–31.6 s  PROOF — numbers people repeat.
  { at: 28.6, do: 'stats', items: [[0, 'paid tools'], [7, 'cities'], [9, 'live AI demos']], dur: 3.0 },

  // 31.6–35 s  ONE ACTION.
  { at: 31.6, do: 'end', dur: 3.4 },
];

export const REEL_LENGTH = 35;
