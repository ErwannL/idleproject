// v9.2.2 : animation d'arrivée des ennemis (fonctions pures, testées dans tests/v922-arrivee.test.js).
// Le mode vient de src/data/arrivals.js. L'avancement `k` (0 → 1) est le plus avancé de deux horloges :
//   - le temps depuis l'apparition à l'écran (ARRIVE_SECONDS) ;
//   - la position : l'ennemi a toujours fini d'arriver quand il atteint le contact (même s'il se rue, v9.2.2).
// Ainsi un volant est toujours à hauteur de combat quand il frappe ou se fait frapper au contact.

export const ARRIVE_SECONDS = 1.1;
// v9.2.2 : la sortie du sol et le portail sont de vraies séquences, un peu plus longues.
export const ARRIVE_SECONDS_BY_MODE = { burrow: 1.3, portal: 1.3 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const smooth = (k) => k * k * (3 - 2 * k);

// Avancement de l'arrivée : `age` = secondes depuis l'apparition, `ex` = x à l'écran, `startX` = bord d'apparition,
// `contactX` = x du contact.
export function arrivalProgress(age, ex, startX, contactX, seconds = ARRIVE_SECONDS) {
  const byTime = clamp01(age / seconds);
  const byPos = startX > contactX ? clamp01((startX - ex) / (startX - contactX)) : 1;
  return Math.max(byTime, byPos);
}

// Pose d'arrivée pour un avancement k : décalages en pixels d'écran (dy > 0 = plus haut), opacité, part du corps
// encore sous le sol (buried), étapes de la sortie du sol et du portail.
//   height : hauteur de départ du vol ; time : horloge de la scène (secousse) ; focus : « réduire les animations ».
// v9.2.2 : les battements d'ailes et l'ondulation ne sont plus des montées/descentes du sprite entier
// (voir wings.js) ; `flap` reste à 0 et `wave` (0 → 1) dit l'ampleur de l'ondulation d'arrivée.
// Sortie du sol (≈ 1,1 s) : fissures et sol qui tremble (k < 0,22), émergence par la ligne du sol avec secousse
// (0,18 → 0,68), petit saut hors du trou puis poussière qui retombe (0,68 → 0,85), mise en position (→ 1).
// Portail : s'ouvre (fente → ovale, k < 0,25), tourbillonne pendant la sortie (0,2 → 0,62), se referme (→ 1).
export function arrivalPose(arrival, k, { height = 70, time = 0, focus = false } = {}) {
  const pose = { dy: 0, dx: 0, alpha: 1, buried: 0, portal: 0, flap: 0, wave: 0, crack: 0, emerge: 1, settle: 1, landed: k >= 1 };
  const mode = arrival?.mode ?? 'walk';
  if (mode === 'walk' || k >= 1) return pose;
  if (mode === 'fly' || mode === 'swim') {
    const e = easeOut(k); // rapide au début, ralentit en arrivant à hauteur de combat
    pose.dy = Math.round((1 - e) * height);
    pose.dx = Math.round((1 - e) * 24); // vient d'un peu plus loin à droite : trajectoire en courbe
    pose.wave = focus ? 0 : 1 - k;
    return pose;
  }
  if (mode === 'burrow') {
    pose.crack = k < 0.85 ? smooth(clamp01(k / 0.22)) : 1 - clamp01((k - 0.85) / 0.15);
    const out = clamp01((k - 0.18) / 0.52);
    pose.buried = 1 - (out < 0.5 ? out * 1.1 : 0.55 + (out - 0.5) * 0.9); // progressif, sans à-coup
    pose.emerge = out;
    if (!focus && out > 0 && out < 1) pose.dx = Math.sin(time * 70) > 0 ? 1 : -1; // secousse en sortant
    if (!focus && k >= 0.7 && k < 0.86) pose.dy = Math.round(Math.sin(Math.PI * (k - 0.7) / 0.16) * 4); // saut hors du trou
    pose.settle = smooth(clamp01((k - 0.7) / 0.3)); // rejoint sa vraie position
    return pose;
  }
  if (mode === 'portal') {
    pose.portal = k < 0.62 ? smooth(clamp01(k / 0.25)) : 1 - smooth(clamp01((k - 0.62) / 0.38));
    pose.emerge = smooth(clamp01((k - 0.18) / 0.44));
    pose.alpha = smooth(clamp01((k - 0.12) / (focus ? 0.4 : 0.25)));
    pose.settle = smooth(clamp01((k - 0.2) / 0.5));
    return pose;
  }
  return pose;
}
