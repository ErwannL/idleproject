// v9.1.3 : conversions de sauvegarde des refontes (lots E et F), une fonction par refonte, indépendantes et testées
// séparément (tests/v913-migrations.test.js). Toutes passent dans la même montée de SAVE_VERSION (7 → 8).
// Chacune est idempotente : rejouée sur une sauvegarde déjà convertie, elle ne change rien.
// Critères d'abandon et retour arrière : docs/refontes-v913.md.
import { ESSENCE_SHARDS, TICKET_GEMS } from '../data/balance.js';

const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

// Lot E — Tickets → gemmes. 1 ticket = 100 gemmes (prix d'une invocation ×1 ; aucune invocation perdue).
// Abandon : si les joueurs signalent des gemmes « disparues » ou si la dépense d'invocations ×1 chute (les tickets
// n'étaient utilisables qu'en ×1). Retour arrière : la copie d'avant migration (save.js keepPreMigrationCopy).
export function migrateTickets(state, raw) {
  const tickets = count(raw?.tickets);
  if (tickets) state.gems += tickets * TICKET_GEMS;
  delete state.tickets;
  return tickets;
}

// Lot E — Codex fondu dans l'encyclopédie. Les paliers de section reprennent seuils et récompenses du Codex, donc un
// palier réclamé reste le même palier : on garde le compte (borné au nombre de paliers), sans rien reverser.
// Une sauvegarde déjà au-delà du dernier palier ne peut rien réclamer deux fois (sectionStatus renvoie next = null).
// Abandon : si le nombre de paliers de section réclamés par joueur baisse nettement (paliers moins visibles qu'avant)
// ou si des joueurs ne trouvent plus les paliers. Retour arrière : remettre le bloc Codex (champ `claimed` inchangé).
export function migrateCodex(state, sections) {
  const claimed = state.codex?.claimed;
  if (!claimed) return;
  for (const id of Object.keys(claimed)) {
    const ms = sections.find((s) => s.id === id)?.milestones;
    if (!ms) delete claimed[id];
    else claimed[id] = Math.min(claimed[id], ms.length);
  }
}

// Lot F — Essences → éclats. 1 essence = 10 éclats : prix implicite des deux recettes qui en demandaient (fabrication
// Épique 60 + 6, relance des effets 10 + 1). Le stock garde exactement son pouvoir d'achat dans la forge.
// Abandon : si la fabrication Épique dépasse ~10 % des objets Épiques obtenus par heure en fin de partie (mesure), ou
// si les joueurs regrettent l'essence de boss. Retour arrière : réintroduire `materials.essence` (le stock converti
// reste en éclats ; ne rien reprendre).
export function migrateEssence(state, rawMaterials) {
  const essence = count(rawMaterials?.essence);
  if (essence) state.materials.shards += essence * ESSENCE_SHARDS;
  delete state.materials.essence;
  return essence;
}

// Lot F — Missions : hebdomadaires et mensuelles fondues dans la piste du mois. Compteurs convertis :
// - une mission hebdomadaire ou mensuelle remplie mais pas récupérée, ou un coffre bonus prêt, est versé tout de suite
//   (rien de perdu) ;
// - la piste reprend les compteurs du mois en cours (mensuels ; ceux qui n'existaient qu'en hebdomadaire — objets Rares,
//   améliorations — reprennent la semaine en cours) ;
// - les paliers déjà atteints par ces compteurs sont marqués récupérés : l'ancien système les a payés ce mois-ci
//   (pas de double récompense). Le reste du mois paie les paliers restants.
// Abandon et retour arrière : docs/refontes-v913.md (missions).
export function migrateMissionTrack(state, rawMissions, monthKey, track, grant) {
  const old = rawMissions && typeof rawMissions === 'object' ? rawMissions : null;
  if (!old || (!old.weekly && !old.monthly)) return null;
  const given = {};
  const add = (r) => { for (const [k, v] of Object.entries(r ?? {})) given[k] = (given[k] ?? 0) + v; };
  for (const [id, period] of Object.entries(LEGACY_PERIODS)) {
    const run = old[id];
    if (!run || typeof run !== 'object') continue;
    const claimed = new Set(Array.isArray(run.claimed) ? run.claimed : []);
    const done = period.missions.filter((m) => count(run.progress?.[m.id]) >= m.target);
    for (const m of done) if (!claimed.has(m.id)) { add(grant(m.reward)); claimed.add(m.id); }
    if (run.bonus !== true && period.missions.every((m) => claimed.has(m.id))) add(grant(period.bonus));
  }
  const month = old.monthly?.key === monthKey ? old.monthly : null;
  const week = old.weekly;
  const t = state.missions.track;
  t.key = monthKey;
  for (const g of track.goals) {
    const v = Math.max(count(month?.progress?.[g.id]), g.id === 'rareLoot' || g.id === 'upgrades' ? count(week?.progress?.[g.id]) : 0);
    t.progress[g.id] = Math.min(g.target, Math.max(t.progress[g.id] ?? 0, v));
  }
  const pct = (track.goals.reduce((s, g) => s + Math.min(1, (t.progress[g.id] ?? 0) / g.target), 0) / track.goals.length) * 100;
  t.claimed = Math.max(t.claimed ?? 0, track.tiers.filter((x) => pct >= x.pct - 1e-9).length);
  return given;
}

// Anciennes missions hebdomadaires et mensuelles (v9.1.2, tickets déjà en gemmes), pour la conversion seulement.
const LEGACY_PERIODS = {
  weekly: {
    missions: [
      { id: 'kills', target: 3000, reward: { gems: 150 } },
      { id: 'bosses', target: 20, reward: { gems: 120, keys: 3 } },
      { id: 'dungeons', target: 4, reward: { gems: 300 } },
      { id: 'rareLoot', target: 30, reward: { shards: 110 } },
      { id: 'upgrades', target: 10, reward: { gems: 100 } },
    ],
    bonus: { gems: 600 },
  },
  monthly: {
    missions: [
      { id: 'logins', target: 15, reward: { gems: 700 } },
      { id: 'kills', target: 15000, reward: { gems: 400 } },
      { id: 'bosses', target: 80, reward: { gems: 600 } },
      { id: 'dungeons', target: 15, reward: { gems: 300, keys: 5 } },
      { id: 'summons', target: 50, reward: { gems: 500 } },
    ],
    bonus: { gems: 2000 },
  },
};

// Lot F — Mannequins fondus dans le coffre. Chaque pièce posée sur un mannequin part au coffre ; au-delà de 300, elle
// va au sac s'il a de la place, sinon le coffre déborde (jusqu'à STASH_OVERFLOW de plus : rien n'est perdu, plus rien
// n'y entre tant qu'il n'est pas redescendu sous 300). Les builds retrouvent ces objets au coffre (même id).
// Abandon : joueurs qui perdent leurs ensembles de vue (retours), ou coffre plein chez plus de 20 % des parties de fin.
// Retour arrière : recréer les mannequins depuis les meilleures pièces d'ensemble du coffre (bestSetPiece).
export function migrateMannequins(state, rawMannequins, { stashSize, bagSize, isValid, clean }) {
  let moved = 0;
  if (!rawMannequins || typeof rawMannequins !== 'object') return 0;
  for (const m of Object.values(rawMannequins)) {
    for (const item of Object.values(m && typeof m === 'object' ? m : {})) {
      if (!isValid(item) || !item.set) continue;
      const it = clean(item);
      if (state.stash.length < stashSize) state.stash.push(it);
      else if (state.inventory.length < bagSize) state.inventory.push(it);
      else state.stash.push(it); // dépassement géré (au plus 77 objets)
      moved += 1;
    }
  }
  return moved;
}

// v9.1.3 (doc3 lot 1) — Sac au-delà de sa taille (un ancien changement de classe poussait l'arme ancestrale sans
// contrôle de place ; le chargement rognait ensuite le sac à 100 objets). Le surplus va au coffre, rien n'est perdu.
// Idempotente : un sac déjà à la bonne taille ne déplace rien. Pas de montée de SAVE_VERSION.
export function migrateBagOverflow(state, extra) {
  for (const it of extra ?? []) state.stash.push(it);
  return (extra ?? []).length;
}

// v9.1.3 (doc4 lot 1) — Étoiles des compagnons et familiers : 1 exemplaire = 0★, maximum 6 exemplaires (5 doublons).
// Une unité déjà au maximum (5 exemplaires) reçoit gratuitement le 6e : elle reste au maximum, aura comprise. Les autres
// gardent leur nombre d'exemplaires (puissance identique ou plus haute, affichage −1★). Appliquée seulement aux
// sauvegardes d'avant le format 8 : un second chargement (déjà en v8) ne rajoute rien. Copie d'avant migration :
// save.js keepPreMigrationCopy. Abandon : retours de joueurs perdus par le nouveau compte d'étoiles.
export function migrateCopies(state, rawVersion) {
  if (rawVersion >= 8) return 0;
  let given = 0;
  for (const owned of Object.values(state.companions.owned)) {
    if (owned.stars === 5) { owned.stars = 6; given += 1; }
  }
  return given;
}
