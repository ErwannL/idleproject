// v10.16 (B6) : Classement et Guilde sans compte — un écran d'explication tout de suite (ce qu'on y gagne, en 3 lignes),
// puis « Créer mon compte ». Et jamais de « se charge… » sans fin : au bout de 5 s, « Impossible de charger. » + Réessayer.
import { escapeHtml, img } from './common.js';
import { mBtn, mBtnGold } from './mobile-kit.js';

export const LOAD_TIMEOUT_MS = 5000;

export const GATE = {
  ranking: { icon: 'icon_trophy', title: 'Le classement des joueurs', lines: ['Compare ton record à celui de tous les joueurs.', 'Vois ton rang, monde par monde.', 'Ajoute des amis et suis leurs progrès.'] },
  guild: { icon: 'icon_crown', title: 'Rejoins une guilde', lines: ['Des bonus pour toute la guilde.', 'Un boss commun à battre ensemble.', 'Une bannière et une salle commune.'] },
};

// Membre = compte créé (un invité n'a pas de compte).
export const isMember = (cloud) => Boolean(cloud?.loggedIn && !cloud?.guest);

export function accountGate(kind, cloud = {}) {
  const g = GATE[kind];
  const who = cloud?.loggedIn && cloud?.guest ? `<small class="ag-who">Tu joues en invité (${escapeHtml(cloud.pseudo ?? '')}).</small>` : '';
  return `<div class="m-card ag-card" data-gate="${kind}"><div class="ag-head">${img(g.icon)}<b>${escapeHtml(g.title)}</b></div>
    <ul class="ag-lines">${g.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>${who}
    ${mBtnGold('Créer mon compte', { action: 'open-account' })}</div>`;
}

// État d'un chargement : 'ok' (données là), 'error', 'loading' (moins de 5 s) ou 'failed' (5 s sans réponse).
export function loadState({ since = 0, now = Date.now(), hasData = false, error = null } = {}) {
  if (hasData) return 'ok';
  if (error) return 'error';
  return since && now - since >= LOAD_TIMEOUT_MS ? 'failed' : 'loading';
}

export function loadFailed(tab) {
  return `<div class="m-card ag-failed" role="status"><b>Impossible de charger.</b>${mBtn('Réessayer', { action: 'load-retry', value: tab })}</div>`;
}
