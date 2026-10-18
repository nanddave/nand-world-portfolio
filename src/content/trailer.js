// 60-second trailer shot list (Phase 3). Data only: src/core/trailer.js plays it.
// Retime freely: `at` is seconds from start, `dur` seconds. Captions use only facts from stops.js (truth rule).
// City ids and spot indexes refer to src/content/stops.js. Positions are spot-relative so city edits don't break shots.
//
// Action vocabulary (implemented by src/core/trailer.js):
//   globe   { view:'intro'|'travel', spin }           globe camera; spin = extra rotation speed
//   travel  { city }                                   globe flight to the city, compressed to fit before the next 'enter'
//   enter   { city }                                   cut (fast fade) into the city scene
//   orbit   { yaw, pitch, dist, spot?, dur }           eased camera move around the origin, or around spot k if given
//   spot    { k, dur }                                 fly to spot k (no story card)
//   drive   { from:'spawn'|{spot}, to:{spot}, dur }    autopilot drive with chase camera, waypoints routed along the main road (x axis) then in to the spot
//   mission { id, dur, scale }                         mission panel floats in (right third), auto-plays its demo, slides out
//   caption { text, sub?, dur }                        lower-left title card (Big Shoulders), letterboxed
//   horn    {}                                         city horn
//   lot     { name }                                   Brokai lot rises with the given name
//   end     { dur }                                    end card (name, role line, link) — values from TRAILER_END
export const TRAILER_END = {
  name: 'Nand Dave',
  line: 'Applied AI engineer and founder',
  cta: 'Drive through it yourself',
  link: '[your link]', // placeholder until Nand confirms the public URL
};

export const SHOTS = [
  // 0–5 s: hook. The real Earth at night, one line.
  { at: 0, do: 'globe', view: 'intro', spin: 2.5 },
  { at: 0.4, do: 'caption', text: 'Seven stops.', sub: 'One career, built as a world you can drive.', dur: 3.6 },
  { at: 3.2, do: 'travel', city: 'nadiad' },

  // 5–11 s: Nadiad. Kites over the rooftops.
  { at: 5.0, do: 'enter', city: 'nadiad' },
  { at: 5.0, do: 'spot', k: 3, dur: 2.8 },
  { at: 5.6, do: 'caption', text: 'Nadiad', sub: 'Where it started', dur: 2.6 },
  { at: 8.0, do: 'orbit', yaw: 0.9, pitch: 0.32, dist: 70, dur: 2.6 },
  { at: 9.6, do: 'travel', city: 'blr' },

  // 11–20 s: Bangalore. Drive past PES University to the paper-cup factory; the machine demo plays.
  { at: 11.0, do: 'enter', city: 'blr' },
  { at: 11.0, do: 'drive', from: 'spawn', to: { spot: 1 }, dur: 4.2 },
  { at: 11.4, do: 'horn' },
  { at: 11.8, do: 'caption', text: 'Bangalore', sub: 'Mechanical engineering at PES University', dur: 2.6 },
  { at: 15.0, do: 'mission', id: 'machine', dur: 3.6 },
  { at: 15.2, do: 'caption', text: 'A year on a paper-cup line', sub: 'Learned machines by fixing them', dur: 3.2 },
  { at: 18.6, do: 'travel', city: 'boston' },

  // 20–26 s: Boston in snow; a model trains live.
  { at: 20.0, do: 'enter', city: 'boston' },
  { at: 20.0, do: 'orbit', yaw: -0.4, pitch: 0.28, dist: 58, dur: 5.6 },
  { at: 20.4, do: 'caption', text: 'Boston', sub: "Master's at Northeastern", dur: 2.4 },
  { at: 22.4, do: 'mission', id: 'train', dur: 3.0 },
  { at: 25.0, do: 'travel', city: 'irving' },

  // 26–31 s: Irving. The Mustangs; data pipeline runs.
  { at: 26.0, do: 'enter', city: 'irving' },
  { at: 26.0, do: 'spot', k: 1, dur: 2.4 },
  { at: 26.3, do: 'caption', text: 'Irving, Texas', sub: 'Data Scientist co-op, 7-Eleven', dur: 2.6 },
  { at: 28.0, do: 'mission', id: 'etl', dur: 2.8 },
  { at: 30.2, do: 'travel', city: 'seattle' },

  // 31–39 s: Seattle rain. Research demos flash.
  { at: 31.0, do: 'enter', city: 'seattle' },
  { at: 31.0, do: 'orbit', yaw: 0.5, pitch: 0.3, dist: 64, dur: 7.6 },
  { at: 31.3, do: 'caption', text: 'Seattle & Bellevue', sub: 'AI at Centific, 2024–25', dur: 2.8 },
  { at: 33.4, do: 'mission', id: 'pii', dur: 2.4 },
  { at: 35.8, do: 'mission', id: 'agents', dur: 2.4 },
  { at: 38.0, do: 'travel', city: 'sf' },

  // 39–44 s: San Francisco fog.
  { at: 39.0, do: 'enter', city: 'sf' },
  { at: 39.0, do: 'spot', k: 1, dur: 4.6 },
  { at: 39.3, do: 'caption', text: 'San Francisco', sub: 'Bigger ambitions', dur: 3.2 },
  { at: 42.4, do: 'horn' },
  { at: 43.0, do: 'travel', city: 'brokai' },

  // 44–54 s: Bangalore again, at night. Brokai Labs, the salon voice agent, the empty lot.
  { at: 44.0, do: 'enter', city: 'brokai' },
  { at: 44.0, do: 'drive', from: 'spawn', to: { spot: 0 }, dur: 3.4 },
  { at: 44.4, do: 'caption', text: 'Bangalore, again', sub: 'Founder, Brokai Labs', dur: 2.8 },
  { at: 47.4, do: 'spot', k: 1, dur: 3.2 },
  { at: 47.4, do: 'mission', id: 'voice', dur: 3.2 },
  { at: 47.6, do: 'caption', text: 'Voice AI for a real salon', sub: 'Scripted demo of the call flow', dur: 3.0 },
  { at: 50.8, do: 'spot', k: 2, dur: 3.2 },
  { at: 51.2, do: 'lot', name: 'Your company' },
  { at: 51.4, do: 'caption', text: 'Next stop', sub: 'Your company here', dur: 2.6 },

  // 54–60 s: end card.
  { at: 54.2, do: 'end', dur: 5.8 },
];

export const TRAILER_LENGTH = 60;
