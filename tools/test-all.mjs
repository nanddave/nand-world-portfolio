// One command for every check: `npm test` runs all categories, `npm test -- launch demos` runs only those.
// Older scripts always exit 0 and print "no errors" when clean, so a step passes on exit 0 plus a pass line.
import { spawnSync } from 'node:child_process';

const v4 = t => ['node', 'tools/v4-test.mjs', t];
const CATEGORIES = {
  build: [['npm', 'run', 'build'], ['npm', 'run', 'build:single']],
  content: [v4('B01'), v4('B02'), v4('B05')],
  layout: [v4('A02'), v4('A04'), v4('A05'), v4('audit-access')],
  driving: [v4('A03'), ['node', 'tools/drive-test.mjs'], ['node', 'tools/drive-cities.mjs']],
  navigation: [['node', 'tools/persona-test.mjs'], v4('A06'), v4('B03'), v4('B04'), v4('audit-navigation'), v4('audit-motion')],
  demos: [v4('A08'), v4('B06'), v4('B07'), v4('audit-completion')],
  world: [['node', 'tools/world-test.mjs'], ['node', 'tools/shell-test.mjs'], ['node', 'tools/postcard-test.mjs']],
  fallback: [['node', 'tools/v4-fallback-test.mjs']],
  launch: [['node', 'tools/launch-test.mjs']],
};
const PASS = /assertions passed|no errors|built in/;

const wanted = process.argv.slice(2);
const unknown = wanted.filter(c => !CATEGORIES[c]);
if (unknown.length) { console.error(`Unknown category: ${unknown.join(', ')}. Choose from: ${Object.keys(CATEGORIES).join(', ')}`); process.exit(2); }
// launch and fallback test the built files, so build first whenever they run
const run = wanted.length ? [...new Set([...(wanted.some(c => c === 'launch' || c === 'fallback') ? ['build'] : []), ...wanted])] : Object.keys(CATEGORIES);

const results = [];
for (const cat of run) for (const cmd of CATEGORIES[cat]) {
  const t0 = Date.now();
  // one retry: some checks time transitions on software WebGL and can miss under load; a retried pass is labelled
  let out = '', ok = false, tries = 0;
  while (!ok && tries < 2) { tries++; const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8', maxBuffer: 64e6 }); out = (r.stdout || '') + (r.stderr || ''); ok = r.status === 0 && PASS.test(out) && !/ERRORS:|LAUNCH FAILURES/.test(out); }
  results.push({ category: cat, step: cmd.slice(1).join(' '), result: ok ? (tries > 1 ? 'pass (retry)' : 'pass') : 'FAIL', seconds: Math.round((Date.now() - t0) / 1000) });
  console.log(`${ok ? '✓' : '✗'} ${cat}: ${cmd.slice(1).join(' ')}`);
  if (!ok) console.log(out.split('\n').slice(-15).join('\n'));
}
console.table(results);
const failed = results.filter(r => r.result === 'FAIL');
if (failed.length) { console.log(`${failed.length} step(s) failed`); process.exit(1); }
console.log('all checks passed');
