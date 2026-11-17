// v9.2.1 : malus d'environnement des mondes 2 à 12 (data/environment.js), contrés par une amélioration existante.
// Fonctions pures : le moteur (core/combat.js `step`) les applique aux statistiques du pas, donc le malus vaut aussi
// hors ligne (core/offline.js) et dans la prévision de boss (ui/common.js), qui passent par `step`.
import { ZONES } from '../data/zones.js';
import { BALANCE } from '../data/balance.js';
import { ENV_BY_ZONE, ENV_CYCLE_MAX, ENV_CYCLE_STEP, ENV_REDUCE_CAP } from '../data/environment.js';

// Malus en vigueur pour un monde (index dans ZONES) et un cycle de difficulté (1, 2, 3…), ou null (monde 1, Tour).
// pct : valeur finale ; full : valeur sans contre ; level : niveau de l'amélioration qui contre (`counter`) ;
// countered : part retirée (niveau / fullAt, de 0 à 100 %).
export function environmentFor(state, zoneIndex, difficulty = 1, balance = BALANCE) {
  const env = ENV_BY_ZONE[ZONES[zoneIndex]?.id];
  if (!env) return null;
  const scale = Math.min(ENV_CYCLE_MAX, 1 + ENV_CYCLE_STEP * Math.max(0, (difficulty || 1) - 1));
  const full = env.base * scale;
  const cap = balance.upgrades[env.counter]?.maxLevel ?? Infinity;
  const level = Math.min(cap, Math.max(0, Math.floor(state.upgrades?.[env.counter] ?? 0)));
  const countered = Math.min(100, (level / env.fullAt) * 100);
  const pct = full * (1 - countered / 100);
  return { ...env, zoneIndex, scale, full, level, countered, pct, counterLabel: balance.upgrades[env.counter]?.label ?? env.counter };
}

const capShown = (env, pct) => (env.kind === 'hurt' || env.kind === 'burn' ? pct : Math.min(ENV_REDUCE_CAP, pct));
const cut = (pct) => 1 - Math.min(ENV_REDUCE_CAP, pct) / 100;

// Statistiques du héros sous un malus (copie ; `stats` n'est pas modifié). Champs ajoutés : missPct, hurtMult,
// burnPerSecond, bossMult, companionMult, environment.
export function applyEnvironment(stats, env) {
  if (!env || env.pct <= 0) return env ? { ...stats, environment: env } : stats;
  const s = { ...stats, environment: env };
  const p = env.pct;
  switch (env.kind) {
    case 'miss': s.missPct = Math.min(ENV_REDUCE_CAP, p); break;
    case 'hurt': s.hurtMult = 1 + p / 100; break;
    case 'regen': s.regenPerSecond = stats.regenPerSecond * cut(p); break;
    case 'maxHp': s.maxHp = stats.maxHp * cut(p); s.regenPerSecond = stats.regenPerSecond * cut(p); break;
    case 'damage': s.damage = stats.damage * cut(p); break;
    case 'speed': s.attackInterval = stats.attackInterval / cut(p); s.attacksPerSecond = 1 / s.attackInterval; break;
    case 'crit': s.critChance = stats.critChance * cut(p); break;
    case 'burn': s.burnPerSecond = (stats.maxHp * p) / 100; break;
    case 'boss': s.bossMult = cut(p); break;
    case 'armor': s.armor = stats.armor * cut(p); break;
    case 'companion': s.companionMult = cut(p); break;
    default: break;
  }
  // Dégâts/s moyens recalculés (coups manqués compris) pour l'affichage en combat.
  const crit = s.critMultiplier ?? 2;
  s.dps = (s.damage / s.attackInterval) * (1 + (s.critChance / 100) * (crit - 1)) * (1 - (s.missPct ?? 0) / 100);
  return s;
}

const fmt = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

// Effet en clair, avec sa valeur (« 10 % de tes coups manquent »). Textes traduits par motifs (i18n/en-921.js).
export function envEffectText(env, pct = env.pct) {
  // v9.2.7 : valeur affichée = valeur appliquée (les « en moins » plafonnent à ENV_REDUCE_CAP, jamais « −113 % »).
  const v = fmt(capShown(env, pct));
  switch (env.kind) {
    case 'miss': return `${v} % de tes coups manquent`;
    case 'hurt': return `+${v} % de dégâts reçus`;
    case 'regen': return `−${v} % de régénération`;
    case 'maxHp': return `−${v} % de PV max`;
    case 'damage': return `−${v} % de dégâts`;
    case 'speed': return `−${v} % de vitesse d'attaque`;
    case 'crit': return `−${v} % de chance de critique`;
    case 'burn': return `tu perds ${v} % de tes PV max par seconde`;
    case 'boss': return `−${v} % de dégâts contre les boss`;
    case 'armor': return `−${v} % d'armure`;
    case 'companion': return `−${v} % de puissance des compagnons`;
    default: return '';
  }
}

// v9.2.1 : version courte pour la pastille du combat (« Boue : −23 % vitesse », « Boue : annulé »).
export function envChipText(env) {
  if (env.countered >= 100 || env.pct <= 0) return `${env.name} : annulé`;
  const v = Math.max(1, Math.round(capShown(env, env.pct)));
  const t = {
    miss: `${v} % de ratés`, hurt: `+${v} % dégâts reçus`, regen: `−${v} % régénération`, maxHp: `−${v} % PV max`,
    damage: `−${v} % dégâts`, speed: `−${v} % vitesse`, crit: `−${v} % critique`, burn: `−${v} % PV/s`,
    boss: `−${v} % contre boss`, armor: `−${v} % armure`, companion: `−${v} % compagnons`,
  }[env.kind] ?? '';
  return `${env.name} : ${t}`;
}

// Ligne complète (bannière d'entrée, infobulle du HUD, fiche du monde) : valeur en vigueur et part contrée.
export function envLine(env) {
  return `Environnement : ${env.name} — ${envEffectText(env)} · contré par ${env.counterLabel} (${Math.round(env.countered)} %)`;
}
