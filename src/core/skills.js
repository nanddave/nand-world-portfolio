// Skills index: which skill each mission demonstrates. Locations are derived from src/content/stops.js,
// so moving a mission between spots updates the index automatically. Labels describe the demo, not new facts.
import { STOPS } from '../content/stops.js';

export const MISSION_SKILLS = {
  machine: ['Root-cause debugging', 'Manufacturing operations'],
  train: ['Machine learning fundamentals'],
  etl: ['Data pipelines (PySpark ETL)', 'Clustering'],
  pii: ['Responsible AI: PII annotation'],
  agents: ['Multi-agent LLM systems'],
  goal: ['Breaking big goals into shippable steps'],
  jarvis: ['AI agents and workflow automation'],
  voice: ['Voice AI'],
  lot: ['Scoping AI for a business'],
};
// Skills shown by spots without a mission (taken straight from the spot's own text).
const SPOT_SKILLS = { 'blr:0': ['Mechanical engineering'], 'seattle:0': ['Building and shipping AI systems'], 'brokai:0': ['Founding and running an agency'] };

export const cityName = s => s.name;
/** [{ skill, ci, k, where: "Bangalore, again · The salon", mission }] sorted by journey order. */
export function skillIndex() {
  const out = [];
  STOPS.forEach((s, ci) => s.spots.forEach((sp, k) => {
    const list = [...(sp.mission ? MISSION_SKILLS[sp.mission] || [] : []), ...(SPOT_SKILLS[`${s.id}:${k}`] || [])];
    list.forEach(skill => out.push({ skill, ci, k, where: `${s.name} · ${sp.t}`, mission: sp.mission || null }));
  }));
  return out;
}
