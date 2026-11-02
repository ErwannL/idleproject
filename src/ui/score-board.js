// v9.1.3 (doc4 lot 7) : score en ligne d'un perso (mode monde). Lu à l'ouverture du repli, gardé 60 s en mémoire.
// Les scores arrivent avec la sauvegarde cloud (le serveur les valide) ; sans compte listé, le joueur n'y figure pas.
import { escapeHtml, fold, formatNumber, stars } from './common.js';

const cache = new Map(); // unit -> { at, rows, error, loading }

function load(ui, unit) {
  const c = cache.get(unit);
  if (!ui.fetchScores || (c && (c.loading || Date.now() - c.at < 60000))) return;
  cache.set(unit, { at: Date.now(), rows: c?.rows ?? null, loading: true });
  ui.fetchScores(unit)
    .then((r) => cache.set(unit, { at: Date.now(), rows: r.players ?? [], loading: false }))
    .catch(() => cache.set(unit, { at: Date.now(), rows: null, error: true, loading: false }))
    .finally(() => ui.invalidate());
}

export function scoreBoard(ui, unit) {
  if (!ui.fetchScores) return '<div class="muted">Score en ligne : version publique seulement (record personnel ici).</div>';
  return fold(ui, `score-${unit}`, 'Score en ligne', () => {
    load(ui, unit);
    const c = cache.get(unit);
    if (!c || (c.loading && !c.rows)) return '<div class="muted">Chargement…</div>';
    if (c.error) return '<div class="muted">Serveur indisponible.</div>';
    if (!c.rows.length) return '<div class="muted">Aucun score pour l\'instant.</div>';
    return c.rows.map((r) => `<div class="world-row"><span>${r.rank}. ${escapeHtml(r.pseudo)}</span><span class="num">${formatNumber(r.damage)}</span><span>${stars(r.stars)} niv. ${r.level}</span></div>`).join('');
  });
}
