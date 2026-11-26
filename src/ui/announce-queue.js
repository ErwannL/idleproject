// v10.16 (compléments) : une seule annonce à la fois sur la scène. L'arrivée d'un boss (portail ou sortie du sol),
// l'alerte « DANGER » (boss-warning.js) et les « Moments forts » (Premier Légendaire !, Nouveau monde !…) passent l'un
// après l'autre, dans une file. Logique pure (sans DOM), testée sous Node (tests/v1016-complements.test.js).
//   - urgentes (portail, DANGER) : passent devant les moments forts ; un moment fort en cours s'arrête pour elles ;
//     le portail passe toujours avant l'alerte de son boss ;
//   - moments forts : jamais par-dessus une fenêtre (onglet, modale) ouverte : ils attendent sa fermeture.
export const URGENT = ['portal', 'danger'];
export const PORTAL_MS = 1300; // durée de l'arrivée d'un boss (ARRIVE_SECONDS_BY_MODE, src/render/arrival.js)
export const MOMENT_MS = 4200; // cinématique « Moment fort » (cinematic.js)
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
  tick(now, { panelOpen = false } = {}) {
    let stop = null;
    if (this.current && now >= this.current.until) this.current = null;
    if (this.current?.kind === 'moment' && (this.items.some(isUrgent) || panelOpen)) { stop = this.current; this.current = null; }
    let start = null;
    if (!this.current) {
      const i = this.items.findIndex((x) => isUrgent(x) || !panelOpen);
      if (i >= 0) {
        start = this.items.splice(i, 1)[0];
        this.current = { ...start, until: now + (start.ms ?? (start.kind === 'portal' ? PORTAL_MS : MOMENT_MS)) };
      }
    }
    return { stop, start };
  }
}
