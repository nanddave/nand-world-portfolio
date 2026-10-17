// Dev harness: mounts one mission. URL: /mission.html?m=pii
import '../styles/tokens.css';
import { mountMission } from '../missions/index.js';
import { WorkLog, renderWorkLog } from '../ui/worklog.js';
import { STOPS, CONTACT } from '../content/stops.js';
const id = new URLSearchParams(location.search).get('m') || 'pii';
document.getElementById('t').textContent = 'Mission: ' + id;
const work = new WorkLog(); renderWorkLog(work, document.getElementById('w'));
const city = STOPS.find(s => s.spots.some(p => p.mission === id));
await mountMission(id, document.getElementById('m'), { work, complete: () => { document.title = 'complete'; window.__complete = true; }, contact: CONTACT, city, reduceMotion: false, scene: { raiseLot: n => console.log('raiseLot', n) } });
window.__ready = true;
