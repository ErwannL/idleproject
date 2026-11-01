// Objectifs > Classement (v9.1.5) : le classement public du serveur, dans le jeu. Chargé à l'ouverture de l'onglet
// et au changement de tri ; `ui.ranking` = { sort, loading, error, players, at }.
import { escapeHtml, formatNumber } from '../common.js';

const SORTS = { stage: 'Étape', level: 'Niveau', bosses: 'Boss' };

export default {
  id: 'ranking',
  title: 'Classement',
  icon: 'icon_trophy',
  render(ui) {
    const r = ui.ranking ?? {};
    const me = ui.cloud?.loggedIn ? ui.cloud.pseudo : null;
    const tabs = Object.entries(SORTS).map(([k, label]) => `<button class="btn${(r.sort ?? 'stage') === k ? ' btn-gold' : ''}" data-action="ranking-sort" data-value="${k}">${label}</button>`).join('');
    let body;
    if (r.error) body = `<div class="card bad">${escapeHtml(r.error)} <button class="btn" data-action="ranking-sort" data-value="${r.sort ?? 'stage'}">Réessayer</button></div>`;
    else if (!r.players) body = '<div class="card muted">Chargement du classement…</div>';
    else if (!r.players.length) body = '<div class="card muted">Personne au classement pour l\'instant.</div>';
    else {
      body = `<div class="card"><table class="ranking-table"><thead><tr><th>#</th><th>Joueur</th><th>Étape</th><th>Niv.</th><th>Boss</th></tr></thead><tbody>${r.players.map((p) =>
        `<tr${p.pseudo === me ? ' class="me"' : ''}><td>${p.rank}</td><td>${escapeHtml(p.pseudo)}</td><td>${escapeHtml(p.stageLabel ?? String(p.maxStage))}</td><td>${formatNumber(p.level)}</td><td>${formatNumber(p.bossesDefeated)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    const note = ui.cloud?.loggedIn ? '' : '<div class="muted">Connectez-vous dans Paramètres pour y apparaître.</div>';
    return `<div class="row ranking-sorts">${tabs}</div>${body}${note}`;
  },
};
