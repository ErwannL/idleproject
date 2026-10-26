// Invocation : gemmes ou tickets gagnés en jouant, probabilités et garanties affichées.
import { BALANCE } from '../../data/balance.js';
import { summonOdds } from '../../core/gacha.js';
import { companionById } from '../../core/companions.js';
import { ALLY_GRADE } from '../../data/companions.js';
import { animCanvas } from '../animator.js';
import { escapeHtml, formatDecimal, formatNumber, gem, img, rarityLabel, stars } from '../common.js';

function unitPortrait(result) {
  if (result.kind === 'hero') return animCanvas(`hero:${result.id}`, 48, 52, 1);
  const c = companionById(result.id);
  return c.kind === 'ally' ? animCanvas(`foe:${c.sprite}`, 64, 56, 1) : animCanvas(`pet:${c.sprite}`, 24, 24, 2);
}

export default {
  id: 'summon',
  title: 'Invocation',
  icon: 'icon_summon',
  extra: (ui, state) => `${gem()}<b class="num">${formatNumber(state.gems)}</b> ${img('icon_ticket')}<b class="num">${state.tickets}</b>`,
  render(ui, state) {
    const s = BALANCE.summon;
    const pool = ui.view.summonPool === 'pet' ? 'pet' : 'ally';
    const tabs = Object.entries(s.pools).map(([id, p]) => `<button class="btn chip-btn${id === pool ? ' active' : ''}"
      data-action="summon-pool" data-value="${id}">${img(id === 'ally' ? 'icon_hero' : 'icon_paw')}<span>${p.label}</span></button>`).join('');
    // Probabilités avec la tête de chaque compagnon / familier (on repère tout de suite sa rareté).
    const odds = summonOdds(pool).filter((r) => r.units.length).reverse().map((r) => {
      const units = r.units.map((u) => {
        const owned = state.companions.owned[u.id];
        return `<div class="odds-unit${owned ? ' owned' : ''}" title="${escapeHtml(u.name)} · ${formatDecimal(u.chance * 100, 2)} %">
          ${unitPortrait(u)}${u.ally ? `<span class="grade g-${u.rarity}">${ALLY_GRADE[u.rarity]}</span>` : ''}
          <span class="odds-name">${escapeHtml(u.name)}</span><span class="muted">${formatDecimal(u.chance * 100, 2)} %</span>
          ${owned ? stars(owned.stars) : ''}</div>`;
      }).join('');
      return `<div class="odds-group r-${r.rarity}"><div class="row-between"><b class="rarity-text">${pool === 'ally' ? ALLY_GRADE[r.rarity] : rarityLabel(r.rarity)}</b>
        <b class="num">${formatDecimal(r.chance * 100)} %</b></div><div class="odds-units">${units}</div></div>`;
    }).join('');
    const results = (ui.view.lastSummon ?? []).map((r) => `<div class="summon-result r-${r.rarity}${r.isNew ? ' new' : ''}" title="${escapeHtml(r.name)}">
      ${unitPortrait(r)}<span>${escapeHtml(r.name)}</span>
      ${r.isNew ? '<b class="good">Nouveau !</b>' : r.refund ? `<span class="muted">+${r.refund} gemmes</span>` : stars(r.stars)}</div>`).join('');
    const btn = (count, currency, cost, label) => `<button class="btn btn-gold" data-action="summon" data-value="${count}" data-currency="${currency}" data-pool="${pool}"
      ${state[currency] < cost ? 'disabled' : ''}>${label}</button>`;
    return `<div class="chip-row summon-tabs">${tabs}</div>
      <div class="card summon-banner banner-${pool}">
        <div class="summon-title">${img(pool === 'ally' ? 'icon_summon' : 'icon_paw')} ${pool === 'ally' ? 'Appel des compagnons' : 'Appel des familiers'}</div>
        <div class="muted">${pool === 'ally'
          ? 'Compagnons humains R, SR et SSR : ils combattent aux côtés du chevalier (2 places dans l\'équipe).'
          : 'Familiers (animaux) : petits alliés aux bonus passifs (1 place dans l\'équipe).'}
          Gemmes et tickets se gagnent en jouant. Aucun achat réel.</div>
        <div class="summon-buttons">
          ${btn(1, 'tickets', 1, `×1 ${img('icon_ticket')} 1`)}
          ${btn(1, 'gems', s.gemCost, `×1 ${gem()} ${s.gemCost}`)}
          ${btn(10, 'gems', s.tenPullGemCost, `×10 ${gem()} ${s.tenPullGemCost}`)}
        </div>
        <div class="muted">Garanties : Épique ou mieux au plus tard dans <b>${s.pity.epicAfter - state.summon.sinceEpic}</b> invocation(s),
          Légendaire dans <b>${s.pity.legendaryAfter - state.summon.sinceLegendary}</b>. Doublon : +1 étoile (max ${s.maxStars}), puis +${s.duplicateRefundGems} gemmes.</div>
      </div>
      ${results ? `<div class="card"><div class="section-title">Dernière invocation</div><div class="summon-results">${results}</div></div>` : ''}
      <div class="card odds"><div class="section-title">Probabilités — ${s.pools[pool].label.toLowerCase()}</div>${odds}</div>`;
  },
};
