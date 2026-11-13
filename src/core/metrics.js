// v9.6.5 (10.11) : mesures anonymes, seulement si le joueur l'a accepté (Options › Mesures anonymes, désactivé par
// défaut). Aucun identifiant ni pseudo : version, monde atteint, niveau, minutes de jeu. Une fois par heure au plus.
import { GAME_VERSION as VERSION } from '../version.js';
import { zoneIndexForStage } from './combat.js';

export const METRICS_EVERY_MS = 3600e3;
export function metricsPayload(state) {
  return {
    version: VERSION,
    world: zoneIndexForStage(Math.max(1, state.maxStage ?? 1)) + 1,
    level: state.level ?? 1,
    minutes: Math.floor((state.playSeconds ?? 0) / 60),
  };
}
let lastSent = 0;
export async function sendMetrics(state, { base = '', fetchFn = globalThis.fetch, now = Date.now() } = {}) {
  if (state?.ui?.metricsOptIn !== true || typeof fetchFn !== 'function') return false;
  if (now - lastSent < METRICS_EVERY_MS) return false;
  lastSent = now;
  try {
    await fetchFn(`${base}/api/metrics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metricsPayload(state)) });
    return true;
  } catch { return false; }
}
