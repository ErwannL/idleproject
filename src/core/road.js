// v9.9 (K8) : Rencontres de route — toutes les 3 à 5 minutes de jeu actif, une rencontre s'arrête au bord de la scène :
// une bulle de 2 lignes et 2 boutons qui disent ce qu'on gagne et ce qu'on paie. Sans réponse en 30 s, le jeu prend
// l'option sans coût. Elles utilisent l'univers d'Ascendrya (compagnons de l'équipe, élément de la zone).
import { ELEMENTS, zoneElement } from './elements.js';
import { companionById } from './companions.js';
import { currentEncounter, referenceKillGold, levelForStage } from './combat.js';
import { grantReward } from './rewards.js';

const MIN = 60;
export const ROAD = { every: [180, 300], answer: 30 };

function buff(state, eff, seconds) {
  (state.roadBuffs ??= []).push({ eff, until: (state.playSeconds ?? 0) + seconds });
  state.roadBuffs = state.roadBuffs.filter((b) => b.until > (state.playSeconds ?? 0)).slice(-6);
}
const killGold = (s) => referenceKillGold(levelForStage(Math.max(1, s.maxStage ?? 1)));

// Chaque rencontre : 2 choix ; options[i] = { label, gain, cost, safe, do: id } (données seules : sauvegardables).
export const ENCOUNTERS = [
  { id: 'shrine', icon: 'icon_star', title: 'Sanctuaire de route', text: 'Un autel ancien brille au bord du chemin.',
    options: [{ label: 'Prier', gain: '+20 % dégâts · 10 min', safe: true, do: 'pray' }, { label: 'Offrir 40 gemmes', gain: '+60 % or · 15 min', cost: '−40 gemmes', do: 'offer', need: { gems: 40 } }] },
  { id: 'dwarf', icon: 'icon_anvil', title: 'Marchand nain', text: 'Un nain pressé vend une clé de donjon.',
    options: [{ label: 'Saluer', gain: '+5 éclats', safe: true, do: 'greet' }, { label: 'Acheter la clé', gain: '+1 clé', cost: 'or', do: 'key', needGold: 300 }] },
  { id: 'hurt', icon: 'tab_companions', title: 'Compagnon blessé', text: '{name} s\'est blessé pendant le combat.',
    options: [{ label: 'Continuer', gain: 'Rien', safe: true, do: 'pass' }, { label: 'Le soigner', gain: '+15 % dégâts des compagnons · 20 min', cost: '−10 % PV max · 5 min', do: 'heal' }] },
  { id: 'chest', icon: 'icon_chest', title: 'Coffre piégé', text: 'Un coffre luit sous les ronces… un piège ?',
    options: [{ label: 'Laisser', gain: 'Rien', safe: true, do: 'pass' }, { label: 'Ouvrir', gain: '60 % : 40 gemmes', cost: '40 % : −15 % PV · 3 min', do: 'chest' }] },
  { id: 'spirit', icon: 'icon_bolt', title: 'Esprit de la zone', text: 'L\'esprit de {element} t\'observe.',
    options: [{ label: 'S\'incliner', gain: '+25 % dégâts aux monstres · 10 min', safe: true, do: 'spirit' }, { label: 'Le défier', gain: '+15 éclats', cost: '−20 % PV · 2 min', do: 'defy' }] },
];

export function roadDue(state) {
  const now = state.playSeconds ?? 0;
  state.road ??= { next: now + ROAD.every[0] };
  return !state.road.open && now >= state.road.next && !state.dungeon && !state.tower && !state.challenge && !state.worldRun;
}
export function rollEncounter(state, rng) {
  const team = (state.companions?.equipped ?? []).map(companionById).filter((c) => c?.kind === 'ally');
  const pool = ENCOUNTERS.filter((e) => e.id !== 'hurt' || team.length);
  const e = pool[Math.floor(rng.next() * pool.length)];
  const who = team[Math.floor(rng.next() * Math.max(1, team.length))];
  const el = zoneElement(currentEncounter(state).zoneIndex);
  state.road.open = { id: e.id, name: who?.name ?? '', element: ELEMENTS[el]?.name ?? '', at: state.playSeconds ?? 0 };
  return encounterView(state);
}
export function encounterView(state) {
  const o = state.road?.open;
  const e = o && ENCOUNTERS.find((x) => x.id === o.id);
  if (!e) return null;
  const fill = (t) => t.replace('{name}', o.name).replace('{element}', o.element);
  return { ...e, text: fill(e.text), options: e.options.map((op) => ({ ...op, cost: op.do === 'key' ? `−${Math.round(killGold(state) * op.needGold)} or` : op.cost })) };
}
// Résout le choix (index, ou l'option sans coût) ; renvoie un court texte de résultat.
export function resolveEncounter(state, index, rng) {
  const e = encounterView(state);
  if (!e) return null;
  const op = Number.isInteger(index) ? e.options[index] : e.options.find((x) => x.safe);
  const now = state.playSeconds ?? 0;
  state.road = { next: now + ROAD.every[0] + rng.next() * (ROAD.every[1] - ROAD.every[0]) };
  switch (op.do) {
    case 'pray': buff(state, { damagePct: 20 }, 10 * MIN); return 'Bénédiction : +20 % dégâts';
    case 'offer': if ((state.gems ?? 0) < 40) return 'Pas assez de gemmes'; state.gems -= 40; buff(state, { goldPct: 60 }, 15 * MIN); return '+60 % or pendant 15 min';
    case 'greet': grantReward(state, { shards: 5 }); return '+5 éclats';
    case 'key': { const g = Math.round(killGold(state) * 300); if (state.gold < g) return 'Pas assez d\'or'; state.gold -= g; grantReward(state, { keys: 1 }); return '+1 clé de donjon'; }
    case 'heal': buff(state, { maxHpPct: -10 }, 5 * MIN); buff(state, { damagePct: 15 }, 20 * MIN); return 'Soigné : +15 % dégâts pendant 20 min';
    case 'chest': if (rng.next() < 0.6) { grantReward(state, { gems: 40 }); return '+40 gemmes'; } buff(state, { maxHpPct: -15 }, 3 * MIN); return 'Piège ! −15 % PV pendant 3 min';
    case 'spirit': buff(state, { damageVsNormalPct: 25 }, 10 * MIN); return '+25 % dégâts aux monstres';
    case 'defy': grantReward(state, { shards: 15 }); buff(state, { maxHpPct: -20 }, 2 * MIN); return '+15 éclats';
    default: return 'Tu passes ton chemin';
  }
}
