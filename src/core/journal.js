// Journal de session (v8.5) : ce qui s'est passé depuis le lancement du jeu, ou pendant une absence
// (fenêtre réduite / masquée). Les compteurs de la partie (records) donnent l'essentiel ; le recyclage
// et la fusion automatiques, qui ne sont pas des records, sont notés au fil de l'eau.

export function journalSnapshot(state, now = Date.now()) {
  return {
    at: now,
    maxStage: state.maxStage,
    level: state.level,
    gold: state.records.goldEarned,
    kills: state.records.kills,
    bosses: state.records.bossesDefeated,
    items: state.records.itemsFound,
    towerBest: state.towerBest ?? 0,
    nextItemId: state.nextItemId,
  };
}

export function createJournal(state, now = Date.now()) {
  return { start: journalSnapshot(state, now), recycled: 0, recycledGold: 0, fused: 0 };
}

// Objet ramassé : recyclé tout de suite (règle de recyclage, sac plein) ou rangé dans le sac.
export function noteDrop(journal, event) {
  if (!journal) return;
  // v9.1.0 : objets recyclés pour faire de la place dans le sac (sac plein) : comptés avec leur or.
  if (event.freed?.count) {
    journal.recycled += event.freed.count;
    journal.recycledGold += event.freed.gold ?? 0;
  }
  if (!event.autoRecycled) return;
  journal.recycled += 1;
  journal.recycledGold += event.recycledGold ?? 0;
}

export function noteRecycled(journal, count, gold) {
  if (!journal || !count) return;
  journal.recycled += count;
  journal.recycledGold += gold ?? 0;
}

export function noteFused(journal, count) {
  if (journal && count) journal.fused += count;
}

const itemNumber = (item) => Number.parseInt(String(item.id).slice(2), 10) || 0;

// Objets arrivés dans le sac depuis `sinceId` et toujours présents (ni recyclés, ni fusionnés).
export function newItemsInBag(state, sinceId) {
  return state.inventory.filter((i) => itemNumber(i) >= sinceId).length;
}

// Résumé chiffré (seules les lignes non nulles sont gardées par l'interface).
export function journalSummary(journal, state, now = Date.now()) {
  const s = journal.start;
  return {
    seconds: Math.max(0, Math.round((now - s.at) / 1000)),
    stages: Math.max(0, state.maxStage - s.maxStage),
    maxStage: state.maxStage,
    levels: Math.max(0, state.level - s.level),
    gold: Math.max(0, state.records.goldEarned - s.gold),
    kills: Math.max(0, state.records.kills - s.kills),
    bosses: Math.max(0, state.records.bossesDefeated - s.bosses),
    items: Math.max(0, state.records.itemsFound - s.items),
    inBag: newItemsInBag(state, s.nextItemId),
    recycled: journal.recycled,
    recycledGold: journal.recycledGold,
    fused: journal.fused,
    tower: Math.max(0, (state.towerBest ?? 0) - s.towerBest),
  };
}
