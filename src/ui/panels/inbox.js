// À récupérer (v9.1.0 ; v9.1.3 : fenêtre ouverte par la touche N ou le bouton de Missions, plus un onglet) : une seule liste de tout ce qui est réclamable (missions, contrats, hauts faits,
// prime, trouvailles, expéditions, collections, maîtrises) et un seul bouton — la touche G fait la même chose.
// Dessous, les marchands (un achat reste une décision). Rien n'apparaît deux fois.
import { BALANCE } from '../../data/balance.js';
import { rewardText } from '../../core/rewards.js';
import { coin, escapeHtml, formatNumber, img, itemFrame, rarityLabel, rewardIcons } from '../common.js';

const KIND_ICONS = {
  login: 'icon_star', mission: 'icon_trophy', missionBonus: 'icon_chest', contract: 'icon_trophy', achievement: 'icon_star',
  bounty: 'icon_skull', event: 'icon_chest', expedition: 'icon_paw', encyclopedia: 'icon_book', collection: 'icon_book', mastery: 'icon_boss',
};

// v9.1.3 : marchands, affichés dans Missions › Aujourd'hui (et dans la fenêtre À récupérer).
export function merchantsHtml(state) {
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  return state.inbox.filter((e) => e.type === 'merchant').map((e) => `<div class="card inbox-item"><div class="row">${itemFrame(e.item, { tag: 'div' })}
      <div class="grow"><b class="r-${e.item.rarity} rarity-text">${escapeHtml(e.item.name)}</b><div class="muted">${rarityLabel(e.item.rarity)} · niv. ${e.item.level}</div></div></div>
      <div class="detail-actions"><button class="btn btn-gold" data-action="buy-merchant" data-value="${e.id}" data-cost="${e.price}" ${state.gold < e.price || full ? 'disabled' : ''}>
        Acheter ${coin()} ${formatNumber(e.price)}</button>
        <button class="btn" data-action="dismiss-event" data-value="${e.id}">Ignorer</button></div>
      ${full ? '<div class="bad">Sac plein : recyclez un objet pour acheter.</div>' : ''}</div>`).join('');
}

export default {
  id: 'inbox',
  title: 'À récupérer',
  icon: 'icon_mail',
  extra: (ui) => {
    const n = ui.claims.filter((c) => !c.blocked).length;
    return n ? `${n} prêt${n > 1 ? 's' : ''}` : '';
  },
  render(ui, state) {
    const list = ui.claims;
    const ready = list.filter((c) => !c.blocked);
    const rows = list.map((c) => `<div class="claim-row${c.blocked ? ' blocked' : ''}">${img(KIND_ICONS[c.kind] ?? 'icon_chest')}
        <div class="grow"><b>${escapeHtml(c.label)}</b><div class="gold-text">${rewardIcons(c.reward) || (c.item ? 'Un objet' : '')}${c.item && rewardText(c.reward, formatNumber) ? ' · un objet' : ''}</div></div>
        ${c.itemRef ? itemFrame(c.itemRef, { tag: 'div' }) : ''}${c.blocked ? `<span class="bad">${c.blocked}</span>` : ''}</div>`).join('');
    const merchants = merchantsHtml(state);
    const head = list.length
      ? `<div class="card claim-card"><button class="btn btn-gold primary-action claim-all" data-action="claim-everything" ${ready.length ? '' : 'disabled'}>Tout récupérer${ready.length ? ` (${ready.length})` : ''}</button>
          ${list.length > ready.length ? '<div class="bad">Sac plein : les récompenses avec un objet attendent ici. Recyclez ou rangez des objets.</div>' : ''}
          <div class="claim-list">${rows}</div></div>`
      : `<div class="card muted">Rien à récupérer pour l'instant. Missions remplies, coffres trouvés au combat, expéditions terminées et
          paliers de collection arrivent ici.</div>`;
    return head + (merchants ? `<div class="section-title">Marchands</div>${merchants}` : '');
  },
};
