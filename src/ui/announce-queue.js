// v10.16 (compléments) : une seule annonce à la fois sur la scène. L'arrivée d'un boss (portail ou sortie du sol),
// l'alerte « DANGER » (boss-warning.js) et les « Moments forts » (Premier Légendaire !, Nouveau monde !…) passent l'un
// après l'autre, dans une file. Logique pure (sans DOM), testée sous Node (tests/v1016-complements.test.js).
//   - urgentes (portail, DANGER) : passent devant les moments forts ; un moment fort en cours s'arrête pour elles ;
//     le portail passe toujours avant l'alerte de son boss ;
//   - moments forts : jamais par-dessus une fenêtre (onglet, modale) ouverte : ils attendent sa fermeture.
export const URGENT = ['portal', 'danger'];
export const PORTAL_MS = 1300; // durée de l'arrivée d'un boss (ARRIVE_SECONDS_BY_MODE, src/render/arrival.js)
export const MOMENT_MS = 3000; // v10.20 (7.1) : « Moment fort » en bandeau fin, 3 s au plus (avant 4,2 s)
export const MOMENT_MAX_MS = 3000;
const isUrgent = (item) => URGENT.includes(item.kind);

export class AnnounceQueue {
  constructor() { this.items = []; this.current = null; }

  // Ajoute une annonce { kind: 'portal' | 'danger' | 'moment', ms, ...données }.
  push(item) {
    if (isUrgent(item)) {
      // Une nouvelle arrivée de boss remplace l'annonce urgente en attente du même type.
      this.items = this.items.filter((x) => x.kind !== item.kind);
      const rank = URGENT.indexOf(item.kind);
      let i = 0;
      while (i < this.items.length && isUrgent(this.items[i]) && URGENT.indexOf(this.items[i].kind) <= rank) i++;
      this.items.splice(i, 0, item);
    } else this.items.push(item);
  }

  get busy() { return Boolean(this.current); }
  get size() { return this.items.length; }

  // À appeler régulièrement. `panelOpen` : une fenêtre est ouverte. Renvoie { stop, start } : l'annonce à arrêter
  // (moment fort interrompu par une annonce urgente) et celle à lancer (au plus une), ou null.
  // v10.20 (7.1) : `bossFight` : un combat de boss est en cours : les moments forts attendent sa fin (en file).
  tick(now, { panelOpen = false, bossFight = false } = {}) {
    let stop = null;
    if (this.current && now >= this.current.until) this.current = null;
    if (this.current?.kind === 'moment' && (this.items.some(isUrgent) || panelOpen || bossFight)) { stop = this.current; this.current = null; }
    let start = null;
    if (!this.current) {
      const i = this.items.findIndex((x) => isUrgent(x) || (!panelOpen && !bossFight));
      if (i >= 0) {
        start = this.items.splice(i, 1)[0];
        const ms = start.kind === 'moment' ? Math.min(MOMENT_MAX_MS, start.ms ?? MOMENT_MS) : (start.ms ?? (start.kind === 'portal' ? PORTAL_MS : MOMENT_MS));
        start = { ...start, ms };
        this.current = { ...start, until: now + ms };
      }
    }
    return { stop, start };
  }
}

// v10.18 (4.5) : mondes terminés d'un coup (partie existante qui a déjà fini plusieurs mondes) : un seul « Moment fort »,
// celui du dernier monde ; les autres sont marqués vus sans annonce (leur récompense reste donnée).
export function worldMoments(worlds) {
  const list = [...new Set(worlds)].sort((a, b) => a - b);
  return { show: list.length ? list[list.length - 1] : null, quiet: list.slice(0, -1) };
}
