// v9.8 (H6) : Rangs du héros — 20 rangs nommés, chacun gagné par un duel de 30 s contre un gardien (le boss du monde du
// rang). Chaque rang : +3 % de dégâts (remplace les anciens paliers de puissance sans nom), un titre et un cadre de
// portrait. Une partie existante garde ses paliers déjà acquis (convertis en rangs au chargement).
import { ZONES } from '../data/zones.js';
import { BALANCE } from '../data/balance.js';
import { enemyStats, lateHp, levelForStage, rebirthHeat } from './combat.js';
import { enemyScaleFactor } from './transcend.js';

export const RANK_BONUS = 0.03;
export const RANK_DUEL_SECONDS = 30;
export const RANKS = [
  'Recrue', 'Bronze', 'Argent', 'Or', 'Mithril', 'Rubis', 'Saphir', 'Émeraude', 'Diamant', 'Astral',
  'Lame des ruines', 'Gardien des plaines', 'Champion des marées', 'Fléau des ombres', 'Porte-lumière',
  'Seigneur des failles', 'Briseur de Titans', 'Légende d\'Ascendrya', 'Mythe vivant', 'Ascendant',
].map((name, i) => ({ n: i + 1, name, level: (i + 1) * 10, frame: ['bronze', 'silver', 'gold', 'mithril'][Math.min(3, Math.floor(i / 5))] }));

export function heroRank(state) { return Math.max(0, Math.min(RANKS.length, state.rank ?? 0)); }
export function rankMult(state) { return 1 + RANK_BONUS * heroRank(state); }
export function rankTitle(state) { return heroRank(state) ? RANKS[heroRank(state) - 1].name : 'Sans rang'; }
export function nextRank(state) { return RANKS[heroRank(state)] ?? null; }

// Gardien du rang : le boss du monde (rang 1 → monde 1…, puis le dernier monde), au niveau d'étape du rang.
// PV comme un vrai boss de campagne à cette étape (courbe tardive, Renaissance, Transcendance), ×0,25 (un duel de 30 s à la portée d'un héros du bon niveau).
export function rankGuardian(rank, state = null) {
  const z = ZONES[Math.min(ZONES.length - 1, rank.n - 1)];
  const stage = Math.max(5, Math.min(state?.maxStage ?? Infinity, Math.round(rank.level * 2)));
  const level = levelForStage(stage);
  const type = z.bosses?.[0] ?? z.tierBosses?.mini;
  let hp = enemyStats(level, type, true).hp * lateHp(Math.max(0, level - 1), BALANCE.enemyScaling) * 0.25;
  if (state) hp *= enemyScaleFactor(state, level).hp * rebirthHeat(state).boss;
  return { type, stage, hp, zone: z };
}
// Le duel est ouvert quand le héros a le niveau du rang ; il est gagné si ses dégâts sur 30 s couvrent les PV du gardien.
export function canDuel(state) { const r = nextRank(state); return Boolean(r) && (state.level ?? 1) >= r.level; }
export function duelOutcome(state, dps) {
  const r = nextRank(state);
  if (!r) return null;
  const g = rankGuardian(r, state);
  const dealt = dps * RANK_DUEL_SECONDS;
  return { rank: r, guardian: g, dealt, won: dealt >= g.hp, pct: Math.min(1, dealt / g.hp) };
}
export function winDuel(state) { state.rank = heroRank(state) + 1; return RANKS[state.rank - 1]; }
