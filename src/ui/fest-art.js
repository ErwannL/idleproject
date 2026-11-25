// v10.14.1 : images de l'écran des Fêtes (assets/ui/art1014/) avec REPLI : on teste l'existence d'un fichier au chargement
// (Image() : onload / onerror) et, tant qu'on ne sait pas, ou s'il manque, c'est l'image actuelle qui s'affiche. Jamais
// d'image cassée. L'écran de la fête se redessine chaque seconde : le résultat est pris à la visite suivante.
import { festBossStatus, festMissions, festPath, festReady, festSummonSteps, riftStatus } from '../core/fest.js';

export const A1014 = 'assets/ui/art1014/';
const known = new Map(); // url → true (existe) | false (absent) | 'wait'

// Renvoie `url` si le fichier existe (déjà testé), sinon `fallback`. Lance le test au premier appel.
export function pickArt(url, fallback) {
  if (!url) return fallback;
  const k = known.get(url);
  if (k === true) return url;
  if (k === undefined) {
    known.set(url, 'wait');
    if (typeof Image === 'undefined') { known.set(url, false); return fallback; }
    const im = new Image();
    im.onload = () => known.set(url, true);
    im.onerror = () => known.set(url, false);
    im.src = url;
  }
  return fallback;
}
export const artKnown = (url) => known.get(url) === true;
// Teste d'avance toutes les images d'une fête (appelé par l'icône « Fête » et l'écran, pour éviter un clignotement).
export function preloadFestArt(f) {
  if (!f) return;
  const a = f.art ?? {};
  [a.key, ...(a.regions ?? []), a.arena, a.currency, a.path, a.node, a.nodeDone, `${A1014}fest_rift_bg.png`, `${A1014}hud_event_fest.png`,
    ...['adventure', 'boss', 'rift', 'missions', 'shop', 'path'].map((t) => `${A1014}fest_tab_${t}.png`),
    ...['strength', 'fury', 'time', 'loot', 'heart', 'focus'].map((b) => `${A1014}rift_bless_${b}.png`)].forEach((u) => pickArt(u, null));
}

// Pastilles « il y a quelque chose à faire » par partie de la fête (écran de la fête et onglet Événement).
export function festBadges(state, f) {
  const m = festMissions(state);
  const missions = m ? [...m.daily, ...m.event].filter((x) => x.ready).length : 0;
  const rift = riftStatus(state);
  const steps = [...festSummonSteps(state), ...festPath(state)].filter((s) => s.reached && !s.claimed).length;
  const wb = festBossStatus(state);
  return { missions, rift: rift?.open && rift.stock > 0 && !rift.run ? rift.stock : 0, adventure: steps, path: steps, boss: wb?.open ? wb.left : 0, shop: 0, all: f ? festReady(state) : 0 };
}
