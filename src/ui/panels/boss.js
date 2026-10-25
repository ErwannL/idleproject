// Boss : Codex des pouvoirs ancestraux, relance (après avoir réaffronté le boss), maîtrise, synergies.
import { BALANCE } from '../../data/balance.js';
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { POWER_FAMILIES, POWER_RULES } from '../../data/powers.js';
import { stageLabel } from '../../core/combat.js';
import { itemBase, signatureItemFor } from '../../core/loot.js';
import {
  bossDungeon, bossFirstStage, bossesInOrder, nextMasteryTier, pityRemaining, powerById, powerProbabilities, powerSlots,
  rerollCost, synergyFamilies,
} from '../../core/powers.js';
import { rewardText } from '../../core/rewards.js';
import { heroPortraitUrl } from '../../render/pixel.js';
import { coin, effectText, escapeHtml, formatDecimal, formatNumber, icon, img, rarityLabel } from '../common.js';

function powerBox(power, label) {
  const family = POWER_FAMILIES[power.family];
  return `<div class="power-box r-${power.rarity}">
    <div class="section-title">${label}</div>
    <div class="power-name rarity-text">${escapeHtml(power.name)}</div>
    <div class="power-rarity"><span class="rarity-text">${rarityLabel(power.rarity)}</span> · <span style="color:${family.color}">${family.label}</span></div>
    <div class="power-effect">${effectText(power.effects)}</div>
  </div>`;
}

function portrait(bossId, known) {
  const boss = BOSSES[bossId];
  if (boss.heroLike) return heroPortraitUrl({ weapon: { baseId: 'fallen_blade', rarity: 'epic' } }, 1, boss.palette, known ? null : '#4a5a78');
  const sprite = boss.sprite ?? ENEMIES[boss.base].sprite;
  return icon(sprite, 1, known ? (boss.palette ? { colors: boss.palette } : {}) : { tint: { color: '#4a5a78', alpha: 1 } });
}

export default {
  id: 'boss',
  title: 'Codex des boss',
  icon: 'icon_boss',
  extra: (ui, state) => `Pouvoirs actifs ${state.equippedPowers.length}/${powerSlots(state)}`,
  render(ui, state) {
    const weights = POWER_RULES.rarityWeights;
    const total = Object.values(weights).reduce((s, w) => s + w, 0);
    const odds = Object.entries(weights).map(([r, w]) => `<span class="r-${r}"><b class="rarity-text">${rarityLabel(r)}</b> ${formatDecimal((w / total) * 100)} %</span>`).join(' · ');
    const synergies = synergyFamilies(state).map((f) => POWER_FAMILIES[f].label);
    const cards = bossesInOrder().map((bossId) => {
      const boss = BOSSES[bossId];
      const entry = state.powers[bossId];
      const dungeon = bossDungeon(bossId);
      const where = dungeon ? `Donjon « ${dungeon.name} »` : `Étape ${stageLabel(bossFirstStage(bossId))}`;
      const signature = signatureItemFor(bossId);
      if (!entry) {
        return `<div class="card power-card locked"><div class="power-head">
          <div class="boss-portrait"><img class="px" src="${portrait(bossId, false)}" alt=""></div>
          <div><div class="boss-name">???</div><div class="muted">${where} · vainquez-le pour découvrir son pouvoir.</div></div></div></div>`;
      }
      const current = powerById(entry.current);
      const active = state.equippedPowers.includes(bossId);
      const pity = pityRemaining(state, bossId);
      const tier = nextMasteryTier(state, bossId);
      let body;
      if (entry.pending) {
        body = `<div class="power-offer">
          <div class="offer-cols">${powerBox(current, 'Actuel')}<div class="offer-arrow">⇄</div>${powerBox(powerById(entry.pending), 'Proposé')}</div>
          <div class="detail-actions">
            <button class="btn" data-action="keep-power" data-boss="${bossId}">Garder l'actuel</button>
            <button class="btn btn-primary" data-action="take-power" data-boss="${bossId}">Prendre le nouveau</button>
          </div></div>`;
      } else {
        const cost = rerollCost(state, bossId);
        const charges = entry.charges;
        body = `${powerBox(current, 'Pouvoir actuel')}
          <div class="reroll-row">
            <button class="btn btn-gold num" data-action="reroll" data-boss="${bossId}" data-cost="${cost}" data-needs-charge="${charges}"
              ${state.gold < cost || charges < 1 ? 'disabled' : ''}
              title="${charges < 1 ? 'Réaffrontez ce boss pour gagner une charge de relance' : 'Propose un autre pouvoir ; vous choisirez ensuite'}">Relancer ${coin()} ${formatNumber(cost)}</button>
            <button class="btn small" data-action="rechallenge" data-boss="${bossId}" title="Aller affronter ce boss">Réaffronter</button>
            <button class="btn small" data-action="show-odds" data-boss="${bossId}">${ui.view.oddsOpen.has(bossId) ? 'Masquer' : '%'}</button>
          </div>
          <div class="muted pity">Charges de relance : <b class="${charges ? 'good' : 'bad'}">${charges}/${POWER_RULES.maxCharges}</b> (1 par nouvelle victoire)
            · ${pity === 0 ? 'prochaine relance Épique+ garantie' : `Épique+ garanti dans ${pity} relance${pity > 1 ? 's' : ''}`}</div>`;
      }
      let table = '';
      if (ui.view.oddsOpen.has(bossId)) {
        const rows = powerProbabilities(bossId, { excludeId: entry.current, minRarity: pity === 0 ? POWER_RULES.pity.minRarity : 'common' })
          .map(({ power, chance }) => `<div class="odds-row r-${power.rarity}"><span class="rarity-text">${escapeHtml(power.name)}</span>
            <span class="muted">${effectText(power.effects)}</span><b class="num">${formatDecimal(chance * 100)} %</b></div>`).join('');
        table = `<div class="odds"><div class="section-title">Prochaine relance (pouvoir actuel exclu)</div>${rows}</div>`;
      }
      const mastery = tier
        ? `<div class="mastery row-between"><span>${img('icon_star')} Maîtrise : ${entry.victories}/${tier.victories} victoires → <span class="gold-text">${rewardText((({ victories, ...r }) => r)(tier), formatNumber)}</span></span>
            <button class="btn btn-gold small" data-action="claim-mastery" data-boss="${bossId}" ${entry.victories < tier.victories ? 'disabled' : ''}>Récupérer</button></div>`
        : `<div class="mastery muted">${img('icon_star')} Maîtrise complète (${entry.victories} victoires)</div>`;
      return `<div class="card power-card">
        <div class="power-head">
          <div class="boss-portrait"><img class="px" src="${portrait(bossId, true)}" alt=""></div>
          <div style="flex:1"><div class="boss-name">${escapeHtml(boss.name)}</div>
            <div class="muted">${where} · ${entry.victories} victoire${entry.victories > 1 ? 's' : ''}${signature ? ` · butin : ${escapeHtml(itemBase(signature.id).name)}` : ''}</div></div>
          <button class="btn small${active ? ' btn-primary' : ''}" data-action="toggle-power" data-boss="${bossId}">${active ? 'Actif ✓' : 'Activer'}</button>
        </div>
        ${body}${table}${mastery}
      </div>`;
    });
    return `<div class="card">
        <div class="muted">1<sup>re</sup> victoire contre un boss : un pouvoir et ${BALANCE.summon.firstBossGems} gemmes. Pour relancer, il faut
          <b>réaffronter le boss</b> (une charge par victoire) et payer de l'or ; vous choisissez ensuite entre l'ancien et le nouveau.
          ${powerSlots(state)} emplacements actifs. Synergie : 2 pouvoirs de la même famille = effets +${POWER_RULES.synergy.bonusPct} %.</div>
        <div class="odds-summary">${odds}</div>
        ${synergies.length ? `<div class="good">Synergie active : ${synergies.join(', ')}</div>` : ''}
      </div>${cards.join('')}`;
  },
};
