// v9.1.3 : sauvegardes de référence pour les tests de migration (lots E et F).
// Format v7 (SAVE_VERSION avant la v9.1.3), passé par JSON comme une vraie sauvegarde.
// - oldSave : partie de milieu en v7, avec des tickets, des paliers du Codex réclamés, quelques objets.
// - endSave : partie de fin (étape 370, 13 Renaissances), sac, coffre, mannequins, Musée, boîte remplis, objets
//   verrouillés et renforcés (payés) dans chaque conteneur.
import { createNewState } from '../../src/core/state.js';
import { makeItem } from '../../src/core/loot.js';
import { ITEM_BASES, SIGNATURE_ITEMS } from '../../src/data/items.js';
import { ITEM_SETS } from '../../src/data/sets.js';
import { periodKey } from '../../src/core/missions.js';

const NOW = new Date(2026, 9, 21, 12).getTime();
const v7 = (s) => {
  const raw = JSON.parse(JSON.stringify(s));
  raw.version = 7;
  delete raw.missions.track; // format 7 : hebdomadaires et mensuelles, pas de piste
  return raw;
};
// Missions au format 7 (périodes de la semaine et du mois de NOW).
const period = (id, progress, claimed = [], bonus = false) => ({ key: periodKey(id, NOW), progress, claimed, bonus });

export function oldSave() {
  const s = createNewState(NOW - 86400e3, 11);
  s.maxStage = 75; s.stage = 74; s.records.bestStage = 75; s.level = 60; s.gold = 5e7; s.gems = 3000; s.keys = 3;
  s.tickets = 12;
  s.codex.claimed = { monsters: 2, bosses: 3, items: 1, companions: 1 };
  for (const id of ['slime', 'goblin', 'boar', 'mandrake', 'wolf', 'bat', 'spider', 'skeleton', 'ghost', 'orc', 'troll']) s.codex.kills[id] = 3;
  for (let i = 0; i < 30; i++) s.inventory.push(makeItem(s, 'iron_helm', ['common', 'rare', 'epic'][i % 3], 50 + i));
  s.inventory[0].locked = true;
  s.inventory[1].upgrades = 3; s.inventory[1].boosts = { atk: 3 };
  s.companions.owned.cat = { level: 10, stars: 2 };
  s.missions.daily.progress = { kills: 120, bosses: 2 };
  s.missions.weekly = period('weekly', { kills: 2000, bosses: 12, dungeons: 3 });
  s.missions.monthly = period('monthly', { logins: 9, kills: 9000, bosses: 40 });
  return v7(s);
}

export function endSave() {
  const s = createNewState(NOW - 30 * 86400e3, 12);
  s.maxStage = 370; s.stage = 370; s.records.bestStage = 370; s.level = 120; s.records.bestLevel = 120;
  s.records.rebirths = 13; s.gold = 1e30; s.gems = 25000; s.keys = 9; s.fragments = 4000; s.tickets = 47;
  s.materials = { shards: 52000, essence: 3100 };
  s.codex.claimed = { monsters: 5, bosses: 5, items: 4, companions: 3 };
  s.codex.encClaimed = 3;
  const bases = ITEM_BASES;
  for (let i = 0; i < 100; i++) s.inventory.push(makeItem(s, bases[i % bases.length].id, ['rare', 'epic', 'legendary'][i % 3], 300 + i));
  for (let i = 0; i < 250; i++) s.stash.push(makeItem(s, bases[(i * 7) % bases.length].id, ['epic', 'legendary'][i % 2], 250 + i));
  for (const set of ITEM_SETS.slice(0, 6)) {
    for (const slot of ['weapon', 'helmet', 'armor', 'ring']) {
      const base = bases.find((b) => b.slot === slot);
      if (base) s.mannequins[set.id][slot] = makeItem(s, base.id, 'legendary', 350, undefined, null, set.id);
    }
  }
  for (const sig of SIGNATURE_ITEMS.slice(0, 12)) s.museum[sig.id] = makeItem(s, sig.id, 'legendary', 360);
  for (const list of [s.inventory, s.stash]) {
    list[0].locked = true;
    list[1].upgrades = 12; list[1].boosts = { atk: 12 };
  }
  const firstMannequin = Object.values(s.mannequins).find((m) => Object.keys(m).length);
  Object.values(firstMannequin)[0].locked = true;
  s.inbox.push({ id: 1, type: 'chest', reward: { gems: 50, tickets: 2 }, item: makeItem(s, 'iron_helm', 'epic', 300) });
  s.rushes.levels = { gold: 8, xp: 6, loot: 5 };
  s.skills = { quick: 1 };
  s.powers.slime_king = { current: 'p1', pending: null, victories: 40, rerolls: 6, sinceHigh: 4, charges: 3, masteryClaimed: 4 };
  // Semaine : 3 missions remplies mais pas récupérées (donjons, objets Rares, améliorations).
  s.missions.weekly = period('weekly', { kills: 3000, bosses: 20, dungeons: 4, rareLoot: 30, upgrades: 10 }, ['kills', 'bosses']);
  s.missions.monthly = period('monthly', { logins: 14, kills: 15000, bosses: 80, dungeons: 10, summons: 30 }, ['kills', 'bosses']);
  return v7(s);
}

// Tous les objets d'une partie (6 conteneurs + boîte), par id.
export function allItems(s) {
  const out = [...s.inventory, ...(s.stash ?? []), ...Object.values(s.equipment ?? {}),
    ...Object.values(s.mannequins ?? {}).flatMap((m) => Object.values(m ?? {})), ...Object.values(s.museum ?? {}),
    ...(s.inbox ?? []).map((e) => e.item)].filter(Boolean);
  return new Map(out.map((x) => [x.id, x]));
}

export { NOW };
