// Launch-film plates (engine footage only, no titles or panels; type and fakes are composited in post).
// Played with `?trailer=1&reel=<name>&v=1`; directed in launch-film-2026-10-30/ (concepts A and B).
export const REEL_END = { name: 'Nand Dave', line: 'Applied AI engineer · voice agents · customer delivery', ask: 'Link in the first comment.' };
export const PLATES = {
  // A1: tight on the cup above the ANA factory, pull back, then a slow hold on the building.
  launchA1: { len: 6.4, shots: [
    { at: 0, do: 'enter', city: 'blr' },
    { at: 0, do: 'orbit', spot: 1, yaw: 0.35, pitch: 0.22, dist: 14, dur: 0.1 },
    { at: 0.2, do: 'orbit', spot: 1, yaw: 0.2, pitch: 0.3, dist: 70, dur: 3.0 },
    { at: 3.3, do: 'orbit', spot: 1, yaw: -0.05, pitch: 0.34, dist: 58, dur: 3.1 },
  ] },
  // A2: the drive to the factory; played in reverse in post as the "travel upstream".
  launchA2: { len: 3.6, shots: [
    { at: 0, do: 'enter', city: 'blr' },
    { at: 0, do: 'drive', from: 'spawn', to: { spot: 1 }, dur: 3.5 },
  ] },
  // B1: San Francisco street drive (2.6 s), then the factory (2.6 s) as the tour's two stops.
  launchB1: { len: 2.7, shots: [{ at: 0, do: 'enter', city: 'sf' }, { at: 0, do: 'drive', from: 'spawn', to: { spot: 1 }, dur: 2.6 }] },
  launchB2: { len: 2.7, shots: [{ at: 0, do: 'enter', city: 'blr' }, { at: 0, do: 'orbit', spot: 1, yaw: 0.6, pitch: 0.3, dist: 60, dur: 0.1 }, { at: 0.2, do: 'orbit', spot: 1, yaw: 0.2, pitch: 0.32, dist: 50, dur: 2.4 }] },
  // B3: globe with the seven-stop route drawing.
  launchB3: { len: 3.0, shots: [{ at: 0, do: 'globe', view: 'intro', spin: 1.2 }, { at: 0.2, do: 'route', dur: 2.4 }] },
  // cut30: the 60-s trailer's own shots re-edited into a 30-s story with a rising tempo (hard cuts, no engine captions; type is added in post).
  cut30: { len: 30, shots: [
    { at: 0, do: 'enter', city: 'boston' }, { at: 0, do: 'orbit', yaw: -0.4, pitch: 0.28, dist: 58, dur: 2.0 },
    { at: 2.0, do: 'enter', city: 'irving' }, { at: 2.0, do: 'spot', k: 1, dur: 2.0 },
    { at: 4.0, do: 'enter', city: 'nadiad' }, { at: 4.0, do: 'spot', k: 3, dur: 1.5 }, { at: 5.5, do: 'orbit', yaw: 0.9, pitch: 0.32, dist: 70, dur: 1.7 },
    { at: 7.2, do: 'enter', city: 'blr' }, { at: 7.2, do: 'drive', from: 'spawn', to: { spot: 1 }, dur: 2.8 }, { at: 7.5, do: 'horn' },
    { at: 10.0, do: 'enter', city: 'boston' }, { at: 10.0, do: 'orbit', yaw: -0.4, pitch: 0.28, dist: 58, dur: 2.5 }, { at: 10.8, do: 'mission', id: 'train', dur: 1.5 },
    { at: 12.5, do: 'enter', city: 'irving' }, { at: 12.5, do: 'spot', k: 1, dur: 2.2 }, { at: 13.1, do: 'mission', id: 'etl', dur: 1.3 },
    { at: 14.7, do: 'enter', city: 'seattle' }, { at: 14.7, do: 'orbit', yaw: 0.5, pitch: 0.3, dist: 64, dur: 1.9 }, { at: 15.1, do: 'mission', id: 'pii', dur: 1.3 },
    { at: 16.6, do: 'enter', city: 'sf' }, { at: 16.6, do: 'orbit', yaw: 0.3, pitch: 0.3, dist: 70, dur: 1.7 },
    { at: 18.3, do: 'enter', city: 'brokai' }, { at: 18.3, do: 'drive', from: 'spawn', to: { spot: 0 }, dur: 1.5 },
    { at: 19.8, do: 'spot', k: 2, dur: 3.0 }, { at: 20.2, do: 'lot', name: 'Your company' },
    { at: 22.8, do: 'orbit', spot: 2, yaw: 0.2, pitch: 0.32, dist: 60, dur: 7.2 },
  ] },
};
