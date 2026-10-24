// Boîte de récompenses : coffres, marchands et gemmes trouvés pendant le farm (jamais perdus).
import { BALANCE } from '../../data/balance.js';
import { eventLabel } from '../../core/events.js';
import { rewardText } from '../../core/rewards.js';
import { stageLabel } from '../../core/combat.js';
import { coin, escapeHtml, formatNumber, img, itemFrame, rarityLabel } from '../common.js';

const ICONS = { chest: 'icon_chest', merchant: 'icon_bag', gems: 'icon_gem' };

export default {
  id: 'inbox',
  title: 'Récompenses',
  icon: 'icon_mail',
  extra: (ui, state) => `${state.inbox.length}/${BALANCE.events.inboxSize}`,
  render(ui, state) {
    if (!state.inbox.length) {
      return `<div class="card muted">Rien pour l'instant. Pendant le farm, le chevalier trouve parfois un coffre, croise un marchand
        ou ramasse des gemmes : tout arrive ici et attend votre retour.</div>`;
    }
    const full = state.inventory.length >= BALANCE.loot.inventorySize;
    return state.inbox.map((e) => {
      let body;
      if (e.type === 'merchant') {
        body = `<div class="row">${itemFrame(e.item, { tag: 'div' })}<div class="grow"><b class="r-${e.item.rarity} rarity-text">${escapeHtml(e.item.name)}</b>
            <div class="muted">${rarityLabel(e.item.rarity)} · niv. ${e.item.level}</div></div></div>
          <div class="detail-actions"><button class="btn btn-gold" data-action="buy-merchant" data-value="${e.id}" ${state.gold < e.price || full ? 'disabled' : ''}>
            Acheter ${coin()} ${formatNumber(e.price)}</button>
            <button class="btn" data-action="dismiss-event" data-value="${e.id}">Ignorer</button></div>`;
      } else {
        body = `<div class="row">${e.item ? itemFrame(e.item, { tag: 'div' }) : ''}<div class="grow gold-text">${rewardText(e.reward, formatNumber)}</div></div>
          <div class="detail-actions"><button class="btn btn-gold" data-action="claim-event" data-value="${e.id}" ${e.item && full ? 'disabled title="Sac plein"' : ''}>Récupérer</button></div>`;
      }
      return `<div class="card inbox-item"><div class="row-between"><b>${img(ICONS[e.type])} ${eventLabel(e.type)}</b><span class="muted">étape ${stageLabel(e.stage)}</span></div>${body}</div>`;
    }).join('');
  },
};
