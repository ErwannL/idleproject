// v10.4 (partie 6) : écran « Pendant ton absence » du Bastion — les bâtiments terminés (à leur nouveau palier), les
// objets commandés livrés, les recherches finies et les stocks pleins ; un seul bouton, « Tout récupérer ».
// Un seul écran à la fois : il attend que la fenêtre de retour hors ligne (et toute autre fenêtre, carte « Nouveau »,
// prologue, visite guidée) soit fermée. Montré une fois : le rapport est effacé quand il s'affiche.
import { buildingDef, researchDef } from '../core/bastion.js';
import { awayReport } from '../core/bastion-start.js';
import { slotIconName } from '../render/pixel.js';
import { buildingArt, researchArt } from './panels/camp.js';
import { escapeHtml, formatNumber, img } from './common.js';

const BUSY = '.learn-card, .howto-card, #prologue, .tour, .cinematic, .res-bubble, .skin-reveal';

export function bastionAwayHtml(state) {
  const r = awayReport(state);
  if (!r) return '';
  const tiles = [
    ...r.builds.map((x) => { const def = buildingDef(x.ref); return `<div class="ba-tile build"><img class="px" src="${buildingArt(state, def, x.level)}" alt=""><b>${escapeHtml(def.name)}</b><small>Niv. ${x.level}</small></div>`; }),
    ...r.items.map((x) => `<div class="ba-tile item r-${escapeHtml(x.rarity ?? 'rare')}">${img(slotIconName(x.slot ?? 'weapon'))}<b class="r-${escapeHtml(x.rarity ?? 'rare')} rarity-text">${escapeHtml(x.name ?? '')}</b><small>Dans le coffre de butin</small></div>`),
    ...r.orders.map((x) => `<div class="ba-tile item">${img('icon_chest')}<b>${escapeHtml(x.text ?? '')}</b><small>Prête</small></div>`),
    ...r.research.map((x) => { const def = researchDef(x.ref); return `<div class="ba-tile research"><img class="px" src="${researchArt(x.ref)}" alt=""><b>${escapeHtml(def.name)}</b><small>Niv. ${x.level}</small></div>`; }),
    ...r.stock.map((s) => `<div class="ba-tile">${img(s.resource === 'shards' ? 'icon_shard' : 'icon_grimoire')}<b class="num">+${formatNumber(s.amount)}</b><small>${escapeHtml(buildingDef(s.id).name)}</small></div>`),
  ].join('');
  return `<div class="ba-card" id="bastion-away"><div class="ba-banner"><img class="px" src="assets/ui/art104/bastion_away.png" alt=""><h2 id="modal-title">Pendant ton absence</h2></div>
      <div class="ba-tiles">${tiles}</div>
      <button class="btn btn-gold ba-claim" data-action="bastion-away-claim">Tout récupérer</button></div>`;
}

// Montre l'écran s'il y a un rapport et que rien d'autre n'est à l'écran. Renvoie vrai s'il est montré.
export function maybeBastionAway(ui, state) {
  if (typeof document === 'undefined' || !state?.bastion?.away?.list?.length) return false;
  if (!document.getElementById('modal')?.classList.contains('hidden') || document.querySelector(BUSY)) return false;
  const html = bastionAwayHtml(state);
  if (!html) { state.bastion.away = null; return false; }
  ui.openModal(html);
  state.bastion.away = null; // montré une fois : « Tout récupérer » ramasse le reste (stocks, commandes, nouvelles)
  return true;
}
