// v10.3 (partie 10) : cartes de déblocage du Bastion — une par bâtiment qui arrive (la Forge du forgeron à l'étape 40,
// puis la Bibliothèque, la Mine de cristal, le Camp d'entraînement, le Comptoir), une seule à la fois, même modèle que
// les cartes « Nouveau » (ui/learn.js). Montrée une fois : gardé dans state.bastion.cards.
import { markBuildingCard, nextBuildingCard } from '../core/bastion.js';
import { escapeHtml } from './common.js';

const GAIN = {
  forge: 'De meilleures chances de fusion, des renforcements plus hauts, et des objets forgés sur commande.',
  library: 'Des bonus de dégâts, de vie et d\'or qui restent après les Renaissances.',
  mine: 'Des éclats qui s\'accumulent, même jeu fermé.',
  training: 'Des grimoires pour les compétences de tes compagnons.',
  trade: 'Des éclats contre des grimoires, des pierres ou des essences (et l\'inverse).',
};

export function maybeBastionCard(ui, st) {
  if (!st?.bastion || typeof document === 'undefined') return;
  if (document.querySelector('.learn-card, .howto-card, #prologue, #modal:not(.hidden), .tour, .cinematic, .res-bubble')) return;
  const def = nextBuildingCard(st);
  if (!def) return;
  markBuildingCard(st, def.id);
  if (ui.tab === 'camp') return; // le joueur est déjà au Bastion : le bâtiment apparaît sous ses yeux
  const host = ui.$('stage-area');
  if (!host) return;
  const first = def.id === 'forge';
  const el = document.createElement('div');
  el.className = 'learn-card bastion-card';
  el.innerHTML = `<img class="px" src="assets/ui/art104/bastion_${def.existing ? def.art : `${def.id}_lv1`}.png" alt=""><div class="howto-body"><small>Nouveau${first ? '' : ' au Bastion'}</small><b>${escapeHtml(first ? 'Le Bastion' : def.name)}</b>
    <p><b>À quoi ça sert :</b> ${escapeHtml(first ? 'Tes compagnons libres y travaillent. Premier bâtiment : la Forge du forgeron.' : def.role)}</p><p><b>Ce que ça rapporte :</b> ${escapeHtml(GAIN[def.id] ?? '')}</p>
    <div class="row-between"><button class="btn btn-gold" type="button" data-go>Essayer maintenant</button><button class="btn small" type="button" data-close>Plus tard</button></div></div>`;
  el.querySelector('[data-close]').addEventListener('click', () => el.remove());
  el.querySelector('[data-go]').addEventListener('click', () => { el.remove(); ui.view.bastionView = 'map'; ui.view.bastionSel = def.id; ui.openTab('camp'); if (ui.tab !== 'camp') ui.toast?.('Le Bastion s\'ouvre avec sa mini-quête'); });
  host.appendChild(el);
}
