// Recherche rapide (v9.1.0, touche F) : un champ, et chaque écran ou section s'atteint en tapant quelques lettres.
// Index construit depuis MENUS et SUB_LABELS, plus les entrées internes (segments, blocs repliés).
import { MENUS, SUB_LABELS, navPath } from './nav.js';
import { escapeHtml } from './common.js';

const EXTRA = [
  ['Coffre', 'inventory', { invTab: 'stash', invView: null }],
  ['Mannequins', 'inventory', { invView: 'mannequins' }],
  ['Forge', 'inventory', { invView: 'forge' }],
  ['Builds', 'inventory', { invTab: 'bag', invView: null }],
  ['Réglages du sac', 'inventory', { invTab: 'bag', invView: null }, 'bag-settings'],
  ['Musée', 'encyclopedia', { encSec: 'museum' }],
  ['Classe', 'hero', { heroTab: 'class' }],
  ['Apparence', 'hero', { heroTab: 'look' }],
  ['Records', 'hero', { heroTab: 'records' }],
  ['Fiche du héros', 'hero', { heroTab: 'hero' }],
  ['Renaissance', 'tree', { treeSeg: 'rebirth' }],
  ['Transcendance', 'tree', { treeSeg: 'rebirth' }],
  ['Bonus éternels', 'tree', { treeSeg: 'rebirth' }],
  ['Arbre de talents', 'tree', { treeSeg: 'tree' }],
  ['Défi de la semaine', 'dungeons', {}, 'challenge'],
  ['Hauts faits', 'contracts', { missionTab: 'achievements' }],
  ['Piste du mois', 'contracts', { missionTab: 'week' }],
  ['Contrats', 'contracts', { missionTab: 'today' }],
  ['Prime du jour', 'contracts', { missionTab: 'today' }],
  ['Connexion', 'contracts', { missionTab: 'today' }, 'login'],
  ['Synergies', 'companions', {}, 'synergies'],
  ['Apparences (invocation)', 'summon', { summonPool: 'hero' }],
  ['Familiers (invocation)', 'summon', { summonPool: 'pet' }],
  ['Paramètres', 'options', { optTab: 'general' }],
  ['Exporter / importer la sauvegarde', 'options', { optTab: 'general' }],
  ['Raccourcis clavier', 'options', { optTab: 'interface' }, 'keys'],
  ['Mode compact', 'options', { optTab: 'interface' }],
  ['Thème', 'options', { optTab: 'interface' }],
];

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchIndex() {
  const tabs = MENUS.flatMap((m) => m.tabs.map((t) => ({ label: SUB_LABELS[t], tab: t, view: null, path: navPath(t) })));
  const extra = EXTRA.map(([label, tab, view, open]) => ({ label, tab, view, open, path: navPath(tab, label === SUB_LABELS[tab] ? undefined : label) }));
  return [...tabs, ...extra];
}

export function searchMatches(query, index = searchIndex()) {
  const q = norm(query).trim();
  if (!q) return index.slice(0, 8);
  return index.filter((e) => norm(`${e.label} ${e.path}`).includes(q))
    .sort((a, b) => norm(a.label).indexOf(q) - norm(b.label).indexOf(q)).slice(0, 10);
}

// Fenêtre de recherche : la liste suit la saisie, Entrée ouvre le premier résultat.
export function openSearch(ui) {
  const index = searchIndex();
  const list = (q) => searchMatches(q, index).map((e, i) => `<button class="btn search-hit${i === 0 ? ' first' : ''}" data-search="${i}">
    <b>${escapeHtml(e.label)}</b><span class="muted">${escapeHtml(e.path)}</span></button>`).join('') || '<div class="muted">Aucun écran trouvé.</div>';
  ui.openModal(`<h2 id="modal-title">Aller à…</h2>
    <input id="search-input" class="confirm-input search-input" type="search" autocomplete="off" placeholder="Coffre, Renaissance, Hauts faits…" aria-label="Rechercher un écran">
    <div class="search-list">${list('')}</div>
    <div class="detail-actions"><button class="btn" data-action="close-modal">Fermer</button></div>`);
  const card = ui.$('modal-card');
  const input = card.querySelector('#search-input');
  let current = searchMatches('', index);
  const go = (entry) => {
    if (!entry) return;
    ui.closeModal();
    if (entry.open) { ui.view.open ??= new Set(); ui.view.open.add(entry.open); ui.view.closed.delete(entry.open); }
    ui.openTab(entry.tab, entry.view && Object.keys(entry.view).length ? entry.view : null);
  };
  input.addEventListener('input', () => {
    current = searchMatches(input.value, index);
    card.querySelector('.search-list').innerHTML = list(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); go(current[0]); }
  });
  card.querySelector('.search-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-search]');
    if (b) go(current[Number(b.dataset.search)]);
  });
  setTimeout(() => input.focus(), 30);
}
