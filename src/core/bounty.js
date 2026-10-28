// Prime du jour (v8.9) : chaque jour, un monstre d'un monde déjà atteint est mis à prix. En vaincre le nombre
// demandé (n'importe où) rapporte une pièce d'ensemble Épique ou mieux de ce monde, et des gemmes.
import { BALANCE } from '../data/balance.js';
import { ENEMIES } from '../data/enemies.js';
import { ZONES } from '../data/zones.js';
import { zoneIndexForStage } from './combat.js';
import { generateItem } from './loot.js';
import { collectItem } from './inventory.js';

export const BOUNTY = { target: 150, gems: 60 };

const dayKey = (now) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// La prime du jour (créée au premier appel de la journée).
export function dailyBounty(state, now = Date.now()) {
  const day = dayKey(now);
  if (state.bounty?.day === day) return state.bounty;
  const reached = Math.min(ZONES.filter((z) => !z.gauntlet).length - 1, zoneIndexForStage(Math.max(1, state.maxStage)));
  const h = hash(`${day}:${state.rngSeed}`);
  const zone = h % (reached + 1);
  const enemies = ZONES[zone].enemies.filter((id) => ENEMIES[id]);
  const type = enemies[(h >>> 8) % enemies.length];
  state.bounty = { day, zone, type, target: BOUNTY.target, start: state.codex.kills[type] ?? 0, claimed: false };
  return state.bounty;
}

export function bountyProgress(state, now = Date.now()) {
  const b = dailyBounty(state, now);
  return Math.min(b.target, (state.codex.kills[b.type] ?? 0) - b.start);
}

export function bountyReady(state, now = Date.now()) {
  const b = dailyBounty(state, now);
  return !b.claimed && bountyProgress(state, now) >= b.target;
}

export function claimBounty(state, rng, now = Date.now(), balance = BALANCE) {
  if (!bountyReady(state, now)) return null;
  const b = state.bounty;
  b.claimed = true;
  // Pièce d'ensemble garantie : on retire jusqu'à obtenir une pièce de l'ensemble du monde (Épique ou mieux).
  let item = null;
  for (let i = 0; i < 40 && !item?.set; i++) item = generateItem(state, rng, { level: Math.max(1, state.maxStage), minRarity: 'epic', setZone: b.zone }, balance);
  if (!item.set) item.set = ZONES[b.zone].id;
  collectItem(state, item, balance);
  state.gems += BOUNTY.gems;
  return { item, gems: BOUNTY.gems };
}

export function sanitizeBounty(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.day !== 'string' || !ENEMIES[raw.type] || !ZONES[raw.zone]) return null;
  const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  return { day: raw.day.slice(0, 12), zone: raw.zone, type: raw.type, target: int(raw.target) || BOUNTY.target, start: int(raw.start), claimed: raw.claimed === true };
}
