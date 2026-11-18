// v9.11 (7) : de quoi suivre après la 10ᵉ heure.
//   Tâches du Héraut : 12 petites tâches qui se relancent dès qu'on les récupère (renforcer un objet, monter la Tour,
//   envoyer une expédition…), chacune avec son icône et sa récompense ; la cible suit l'étape du joueur.
//   Chroniques d'Ascendrya : une chaîne de quêtes racontées (le réveil, le mentor, le Colosse, les mondes), une
//   illustration par étape, et tous les 5 paliers une récompense nommée (apparence, tickets de compagnon ou de familier).
import { grantReward } from './rewards.js';
import { revengeLevel } from './revenge.js';
import { missionTier } from './missions.js';

export const HERALD_TASKS = [
  { id: 'kills', type: 'kills', target: 1000, label: 'Vaincre {n} monstres', icon: 'weapon_sword', reward: { gems: 4, shards: 10 } },
  { id: 'bosses', type: 'bosses', target: 5, label: 'Vaincre {n} boss', icon: 'icon_boss', reward: { gems: 5 } },
  { id: 'upgrades', type: 'upgrades', target: 3, label: 'Renforcer ou fusionner {n} fois', icon: 'icon_anvil', reward: { shards: 25 } },
  { id: 'skills', type: 'skills', target: 2, label: 'Améliorer {n} compétences', icon: 'icon_book', reward: { gems: 4 } },
  { id: 'recycle', type: 'recycle', target: 20, label: 'Recycler {n} objets', icon: 'icon_anvil', reward: { shards: 20 } },
  { id: 'summons', type: 'summons', target: 5, label: 'Faire {n} invocations', icon: 'icon_summon', reward: { gems: 6 } },
  { id: 'dungeons', type: 'dungeons', target: 1, label: 'Terminer {n} donjon', icon: 'icon_dungeon', reward: { gems: 5, shards: 10 } },
  { id: 'tower', type: 'tower', target: 1, label: 'Monter {n} étage de la Tour', icon: 'icon_tower', reward: { gems: 5 } },
  { id: 'arena', type: 'arena', target: 1, label: 'Gagner {n} combat d\'Arène', icon: 'icon_trophy', reward: { gems: 5 } },
  { id: 'expeditions', type: 'expeditions', target: 2, label: 'Envoyer {n} expéditions', icon: 'icon_map', reward: { gems: 4 } },
  { id: 'rareLoot', type: 'rareLoot', target: 10, label: 'Trouver {n} objets Rares ou mieux', icon: 'icon_bag', reward: { shards: 15 } },
  { id: 'stages', type: 'stages', target: 5, label: 'Franchir {n} étapes', icon: 'icon_map', reward: { gems: 4 } },
];
const HERALD_SCALE = { kills: [1, 5, 15], bosses: [1, 2, 4], recycle: [1, 2, 3], rareLoot: [1, 2, 4] };
const frNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function heraldState(state) {
  state.herald ??= { progress: {}, done: 0 };
  return state.herald;
}
export function heraldTask(state, t) {
  const k = HERALD_SCALE[t.type]?.[missionTier(state)] ?? 1;
  const target = Math.round(t.target * k);
  return { ...t, target, text: t.label.replace('{n}', frNum(target)) };
}
export function heraldTrack(state, type, amount = 1) {
  if (!(amount > 0) || !state) return;
  const h = heraldState(state);
  for (const t of HERALD_TASKS) if (t.type === type) h.progress[t.id] = Math.min(1e12, (h.progress[t.id] ?? 0) + amount);
}
export const heraldReady = (state, t) => (heraldState(state).progress[t.id] ?? 0) >= heraldTask(state, t).target;
export function claimHerald(state, id) {
  const t = HERALD_TASKS.find((x) => x.id === id);
  if (!t || !heraldReady(state, t)) return null;
  const h = heraldState(state);
  // La tâche repart aussitôt (le surplus est gardé, plafonné à une tâche de plus).
  const target = heraldTask(state, t).target;
  h.progress[t.id] = Math.min(target, (h.progress[t.id] ?? 0) - target);
  h.done += 1;
  return grantReward(state, t.reward);
}
export const heraldClaimable = (state) => HERALD_TASKS.filter((t) => heraldReady(state, t)).length;

// ---- Chroniques ----------------------------------------------------------------------------------------------
const best = (s) => s.records?.bestStage ?? s.maxStage ?? 1;
export const CHRONICLES = [
  { id: 'wake', title: 'Le réveil', text: 'Le héros se relève près du feu. Le chemin des Plaines l\'attend.', art: 'camp_night', need: 'Atteins l\'étape 1-5', test: (s) => best(s) >= 5, reward: { gems: 20 } },
  { id: 'forest', title: 'La lisière', text: 'Au-delà des Plaines, la forêt murmure le nom du Colosse.', art: 'expedition_map', need: 'Termine le monde 1', test: (s) => best(s) >= 21, reward: { gems: 30, shards: 30 } },
  { id: 'crypt', title: 'Les portes closes', text: 'Des cryptes scellées gardent les trésors des anciens.', art: 'door_crypt', need: 'Vaincs 20 boss', test: (s) => (s.records?.bossesDefeated ?? 0) >= 20, reward: { gems: 30, keys: 1 } },
  { id: 'mentor', title: 'La leçon du mentor', text: '« Tomber n\'est rien. Se relever plus fort, voilà la voie. »', art: 'phoenix_rebirth', need: 'Renais une fois', test: (s) => (s.records?.rebirths ?? 0) >= 1, reward: { gems: 40 } },
  { id: 'seal1', title: 'Le premier sceau', text: 'Un sceau d\'Ascendrya s\'illumine : la cité se souvient de toi.', art: 'door_sanctuary', need: 'Atteins l\'étape 3-20', test: (s) => best(s) >= 60, reward: { gems: 60 }, prize: { skin: 'paladin', label: 'Apparence : Paladin' } },
  { id: 'forge', title: 'Le feu de la forge', text: 'Le maître forgeron accepte de travailler pour toi.', art: 'forge_hall', need: 'Recycle 100 objets', test: (s) => (s.records?.recycled ?? 0) >= 100, reward: { shards: 80 } },
  { id: 'tower', title: 'La Tour de l\'Éternité', text: 'Ses étages montent plus haut que les nuages.', art: 'tower', need: 'Atteins l\'étage 10 de la Tour', test: (s) => (s.towerBest ?? 0) >= 10, reward: { gems: 50 } },
  { id: 'arena', title: 'Le sable de l\'Arène', text: 'Tes compagnons se battent seuls : le public scande leurs noms.', art: 'arena', need: 'Franchis 5 étages d\'Arène', test: (s) => (s.arena?.floors?.best ?? 0) >= 5, reward: { gems: 50 } },
  { id: 'market', title: 'Le marché des mondes', text: 'Marchands et voyageurs parlent d\'un Titan endormi.', art: 'event_market', need: 'Termine 20 contrats', test: (s) => (s.records?.contractsDone ?? 0) >= 20, reward: { gems: 50, keys: 1 } },
  { id: 'revenge1', title: 'Le Colosse', text: 'Face à face avec celui qui t\'avait vaincu. Cette fois, il recule.', art: 'entity', need: 'Gagne une Revanche contre le Colosse', test: (s) => revengeLevel(s) >= 1, reward: { gems: 80 }, prize: { wallet: { ticketLimited: 5 }, label: '5 tickets de compagnon' } },
  { id: 'glacier', title: 'Les neiges éternelles', text: 'Les montagnes gardent la trace d\'un ancien royaume.', art: 'door_glacier', need: 'Atteins l\'étape 8-10', test: (s) => best(s) >= 150, reward: { gems: 60 } },
  { id: 'phoenix', title: 'Le cycle du phénix', text: 'Chaque renaissance laisse une plume d\'or dans ta main.', art: 'phoenix_rebirth', need: 'Renais 5 fois', test: (s) => (s.records?.rebirths ?? 0) >= 5, reward: { gems: 70 } },
  { id: 'furnace', title: 'Le cœur du volcan', text: 'La lave chante le nom des Titans.', art: 'door_furnace', need: 'Atteins l\'étape 10-20', test: (s) => best(s) >= 200, reward: { gems: 70, shards: 60 } },
  { id: 'guild', title: 'La Guilde', text: 'D\'autres héros se joignent à toi sous la même bannière.', art: 'guild_hall', need: 'Vaincs 100 000 monstres', test: (s) => (s.records?.kills ?? 0) >= 100000, reward: { gems: 70 } },
  { id: 'revenge3', title: 'La revanche accomplie', text: 'Le Colosse s\'incline trois fois. Ascendrya respire.', art: 'entity', need: 'Gagne 3 Revanches', test: (s) => revengeLevel(s) >= 3, reward: { gems: 100 }, prize: { skin: 'berserker', label: 'Apparence : Berserker' } },
  { id: 'sanctuary', title: 'Le sanctuaire perdu', text: 'Les prêtres d\'antan y gardaient la lumière du monde.', art: 'door_sanctuary', need: 'Atteins l\'étape 15-20', test: (s) => best(s) >= 300, reward: { gems: 80 } },
  { id: 'talents', title: 'L\'arbre des anciens', text: 'Chaque branche porte le savoir d\'un héros tombé.', art: 'talent_tree', need: 'Renais 10 fois', test: (s) => (s.records?.rebirths ?? 0) >= 10, reward: { gems: 80 } },
  { id: 'citadel', title: 'La citadelle', text: 'Ses murailles noires tiennent le Néant à distance.', art: 'door_citadel', need: 'Atteins l\'étape 20-20', test: (s) => best(s) >= 400, reward: { gems: 90 } },
  { id: 'circle', title: 'Le cercle des alliés', text: 'Quinze compagnons répondent à ton appel.', art: 'summon_circle', need: 'Possède 15 compagnons', test: (s) => Object.keys(s.companions?.owned ?? {}).length >= 15, reward: { gems: 90 } },
  { id: 'legend', title: 'La légende d\'Ascendrya', text: 'Les bardes chantent ton nom dans tous les mondes.', art: 'class_knight', need: 'Atteins l\'étape 26-1', test: (s) => best(s) >= 501, reward: { gems: 150 }, prize: { skin: 'dragon_knight', wallet: { ticketPet: 10 }, label: 'Apparence : Chevalier dragon + 10 tickets de familier' } },
];
export function chroniclesState(state) {
  state.chronicles ??= { claimed: 0 };
  return state.chronicles;
}
export function chronicleNow(state) {
  const i = chroniclesState(state).claimed;
  const c = CHRONICLES[i];
  return c ? { ...c, index: i, ready: Boolean(c.test(state)) } : null;
}
export function claimChronicle(state) {
  const c = chronicleNow(state);
  if (!c?.ready) return null;
  chroniclesState(state).claimed += 1;
  const given = grantReward(state, { ...c.reward, ...(c.prize?.wallet ?? {}) });
  if (c.prize?.skin && state.heroes?.owned && !state.heroes.owned[c.prize.skin]) state.heroes.owned[c.prize.skin] = { stars: 1 };
  return { given, prize: c.prize?.label ?? null, title: c.title };
}
export function sanitizeChronicles(state, raw) {
  const c = raw?.chronicles;
  state.chronicles = { claimed: Number.isInteger(c?.claimed) ? Math.max(0, Math.min(CHRONICLES.length, c.claimed)) : 0 };
  const h = raw?.herald;
  state.herald = { progress: {}, done: Number.isInteger(h?.done) && h.done > 0 ? h.done : 0 };
  for (const t of HERALD_TASKS) { const v = h?.progress?.[t.id]; if (Number.isFinite(v) && v > 0) state.herald.progress[t.id] = Math.floor(v); }
}
