// v9.2.2 : animation d'arrivée des ennemis (fonctions pures, testées dans tests/v922-arrivee.test.js).
// Le mode vient de src/data/arrivals.js. L'avancement `k` (0 → 1) est le plus avancé de deux horloges :
//   - le temps depuis l'apparition à l'écran (ARRIVE_SECONDS) ;
//   - la position : l'ennemi a toujours fini d'arriver quand il atteint le contact (même s'il se rue, v9.2.2).
// Ainsi un volant est toujours à hauteur de combat quand il frappe ou se fait frapper au contact.

export const ARRIVE_SECONDS = 1.1;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const smooth = (k) => k * k * (3 - 2 * k);

// Avancement de l'arrivée : `age` = secondes depuis l'apparition, `ex` = x à l'écran, `startX` = bord d'apparition,
// `contactX` = x du contact.
export function arrivalProgress(age, ex, startX, contactX) {
  const byTime = clamp01(age / ARRIVE_SECONDS);
  const byPos = startX > contactX ? clamp01((startX - ex) / (startX - contactX)) : 1;
  return Math.max(byTime, byPos);
}

// Pose d'arrivée pour un avancement k : décalages en pixels d'écran (dy > 0 = plus haut), opacité, part du corps
// encore sous le sol (burrow), force du portail.
//   height : hauteur de départ du vol ; time/phase : battements ; focus : « réduire les animations ».
export function arrivalPose(arrival, k, { height = 70, time = 0, phase = 0, focus = false } = {}) {
  const pose = { dy: 0, dx: 0, alpha: 1, buried: 0, portal: 0, flap: 0, landed: k >= 1 };
  const mode = arrival?.mode ?? 'walk';
  if (mode === 'walk' || k >= 1) return pose;
  if (mode === 'fly' || mode === 'swim') {
    const e = easeOut(k); // rapide au début, ralentit en arrivant à hauteur de combat
    pose.dy = Math.round((1 - e) * height);
    pose.dx = Math.round((1 - e) * 24); // vient d'un peu plus loin à droite : trajectoire en courbe
    if (!focus) {
      if (mode === 'fly' && arrival.style === 'wings') {
        // Battements d'ailes : coups rapides vers le haut, plus amples au début de la descente.
        pose.flap = Math.round(Math.abs(Math.sin(time * 14 + phase)) * 3 * (1 - 0.6 * k));
      } else {
        // Ondulation (fantômes, nage) : lente et ample.
        pose.flap = Math.round(Math.sin(time * 4 + phase) * 4 * (1 - k));
        pose.dx += Math.round(Math.cos(time * 2 + phase) * 3 * (1 - k));
      }
    }
    return pose;
  }
  if (mode === 'burrow') {
    // Sous terre au début (seul un monticule avance), puis sort du sol.
    pose.buried = 1 - smooth(clamp01((k - 0.15) / 0.55));
    return pose;
  }
  if (mode === 'portal') {
    // Le portail s'ouvre, l'ennemi en sort en apparaissant, puis le portail se referme.
    pose.portal = k < 0.6 ? smooth(clamp01(k / 0.25)) : 1 - clamp01((k - 0.6) / 0.4);
    pose.alpha = smooth(clamp01((k - 0.2) / 0.3));
    return pose;
  }
  return pose;
}
