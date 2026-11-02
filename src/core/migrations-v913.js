// v9.1.3 : conversions de sauvegarde des refontes (lots E et F), une fonction par refonte, indépendantes et testées
// séparément (tests/v913-migrations.test.js). Toutes passent dans la même montée de SAVE_VERSION (7 → 8).
// Chacune est idempotente : rejouée sur une sauvegarde déjà convertie, elle ne change rien.
// Critères d'abandon et retour arrière : docs/refontes-v913.md.
import { TICKET_GEMS } from '../data/balance.js';

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
