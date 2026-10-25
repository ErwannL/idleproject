// Invocation : gemmes ou tickets gagnés en jouant, probabilités et garanties affichées.
import { BALANCE } from '../../data/balance.js';
import { summonOdds } from '../../core/gacha.js';
import { companionById } from '../../core/companions.js';
import { animCanvas } from '../animator.js';
import { escapeHtml, formatDecimal, formatNumber, gem, img, rarityLabel, stars } from '../common.js';

function unitPortrait(result) {
  if (result.kind === 'hero') return animCanvas(`hero:${result.id}`, 48, 52, 1);
  return animCanvas(`pet:${companionById(result.id).sprite}`, 24, 24, 2);
}

export default {
  id: 'summon',
  title: 'Invocation',
  icon: 'icon_summon',
  extra: (ui, state) => `${gem()}<b class="num">${formatNumber(state.gems)}</b> ${img('icon_ticket')}<b class="num">${state.tickets}</b>`,
  render(ui, state) {
    const s = BALANCE.summon;
    const odds = summonOdds().map((r) => `<div class="odds-row r-${r.rarity}"><b class="rarity-text">${rarityLabel(r.rarity)}</b>
      <span class="muted">${r.units.map((u) => u.name).join(', ')}</span><b class="num">${formatDecimal(r.chance * 100)} %</b></div>`).join('');
    const results = (ui.view.lastSummon ?? []).map((r) => `<div class="summon-result r-${r.rarity}${r.isNew ? ' new' : ''}" title="${escapeHtml(r.name)}">
      ${unitPortrait(r)}<span>${escapeHtml(r.name)}</span>
      ${r.isNew ? '<b class="good">Nouveau !</b>' : r.refund ? `<span class="muted">+${r.refund} gemmes</span>` : stars(r.stars)}</div>`).join('');
    return `<div class="card summon-banner">
        <div class="summon-title">${img('icon_summon')} Appel des chevaliers et compagnons</div>
        <div class="muted">Héros et compagnons s'obtiennent ici. Gemmes et tickets se gagnent en jouant (premières victoires de boss,
          contrats, maîtrise, événements, donjon). Aucun achat réel.</div>
        <div class="summon-buttons">
          <button class="btn btn-gold" data-action="summon" data-value="1" data-currency="tickets" ${state.tickets < 1 ? 'disabled' : ''}>×1 ${img('icon_ticket')} 1</button>
          <button class="btn btn-gold" data-action="summon" data-value="1" data-currency="gems" ${state.gems < s.gemCost ? 'disabled' : ''}>×1 ${gem()} ${s.gemCost}</button>
          <button class="btn btn-gold" data-action="summon" data-value="10" data-currency="gems" ${state.gems < s.tenPullGemCost ? 'disabled' : ''}>×10 ${gem()} ${s.tenPullGemCost}</button>
        </div>
        <div class="muted">Garanties : Épique ou mieux au plus tard dans <b>${s.pity.epicAfter - state.summon.sinceEpic}</b> invocation(s),
          Légendaire dans <b>${s.pity.legendaryAfter - state.summon.sinceLegendary}</b>. Doublon : +1 étoile (max ${s.maxStars}), puis +${s.duplicateRefundGems} gemmes.</div>
      </div>
      ${results ? `<div class="card"><div class="section-title">Dernière invocation</div><div class="summon-results">${results}</div></div>` : ''}
      <div class="card odds"><div class="section-title">Probabilités</div>${odds}</div>`;
  },
};
