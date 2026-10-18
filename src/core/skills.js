// Skills index: which skill each mission demonstrates. Locations are derived from src/content/stops.js,
// so moving a mission between spots updates the index automatically. Labels describe the demo, not new facts.
import { STOPS } from '../content/stops.js';

export const MISSION_SKILLS = {
  machine: ['Root-cause debugging', 'Inventory and buyer-risk analysis (R/SQL, A/B tests)'],
  train: ['Machine learning fundamentals'],
  etl: ['Data pipelines (PySpark ETL)', 'Clustering'],
  pii: ['Responsible AI: PII annotation'],
  agents: ['LLM systems with several models working together'],
  goal: ['Breaking big goals into shippable steps'],
  jarvis: ['Voice agents (LiveKit)', 'Connecting AI to tools (Slack, Linear, Gmail, Calendar, Notion)', 'Testing AI answers: task completion, tool choice, relevance'],
  voice: ['Voice AI receptionists (Retell)', 'Customer discovery to rollout'],
  lot: ['Scoping AI for a business'],
};
// Skills shown by spots without a mission (taken straight from the spot's own text).
const SPOT_SKILLS = {
  'blr:0': ['Mechanical engineering'],
  'boston:0': ['Data science (master\'s specialisation)'],
  'seattle:0': ['Audio data pipelines (Azure Blob Storage, Label Studio)', 'Human-in-the-loop labeling', 'Near-duplicate detection in 10+ languages'],
  'sf:0': ['Healthcare appointment assistant', 'Patient-intake workflows (React, Express/TypeScript, DynamoDB)'],
  'brokai:0': ['Founding and running an agency', 'Résumé screening and ranking workflow', 'Python/FastAPI tool integrations (Hapi)'],
};

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
