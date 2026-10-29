// Améliorations achetées avec l'or, rangées par catégorie (Combat, Survie, Ressources).
import { BALANCE } from '../../data/balance.js';
import { bulkPlan, upgradeCost } from '../../core/economy.js';
import { computeHeroStats } from '../../core/stats.js';
import { bossForecast, coin, costButton, escapeHtml, forecastHtml, formatDecimal, formatNumber, img } from '../common.js';

const ICONS = {
  damage: 'weapon_sword', attackSpeed: 'icon_bolt', crit: 'skill_quick', vitality: 'icon_heart',
  armor: 'icon_shield', regen: 'pet_fairy', goldFind: 'coin',
};

// Valeur affichée « actuel → suivant » pour chaque amélioration.
function effect(key, cur, next) {
  switch (key) {
    case 'damage': return [formatNumber(cur.damage), formatNumber(next.damage), 'dégâts'];
    case 'attackSpeed': return [formatDecimal(cur.attacksPerSecond, 2), formatDecimal(next.attacksPerSecond, 2), 'att./s'];
    case 'crit': return [`${formatDecimal(cur.critChance)} %`, `${formatDecimal(next.critChance)} %`, 'critique'];
    case 'vitality': return [formatNumber(cur.maxHp), formatNumber(next.maxHp), 'PV'];
    case 'armor': return [`${formatDecimal(cur.armor)} %`, `${formatDecimal(next.armor)} %`, 'armure'];
    case 'regen': return [formatDecimal(cur.regenPerSecond), formatDecimal(next.regenPerSecond), 'PV/s'];
    case 'goldFind': return [`+${formatDecimal(cur.goldPct)} %`, `+${formatDecimal(next.goldPct)} %`, 'or'];
    default: return ['', '', ''];
  }
}

export default {
  id: 'upgrades',
  title: 'Améliorations',
  icon: 'icon_upgrade',
  extra: (ui, state) => `${coin()}<b class="gold-text num">${formatNumber(state.gold)}</b>`,
  render(ui, state) {
    // v9.0.6 : les boosts sont passés dans Compétences (avec les sorts) ; ici, seulement les améliorations d'or.
    const cats0 = BALANCE.upgradeCategories.filter((c) => c.id !== 'rushes');
    const cat = cats0.find((c) => c.id === ui.view.upgradeCat) ?? cats0[0];
    const current = computeHeroStats(state);
    const cats = cats0.map((c) => `<button class="btn chip-btn${c.id === cat.id ? ' active' : ''}"
      data-action="upgrade-cat" data-value="${c.id}">${img(c.icon)}<span>${c.label}</span></button>`).join('');
    // v8.4 : que faire maintenant ? (conseils cliquables) + prévision du prochain boss.
    // v9.0.6 : « Que faire ? » est passé dans l'écran Aventure ; ici, seulement la prévision du prochain boss.
    const guide = `<div class="card guide-card">${forecastHtml(state.dungeon || state.tower || state.challenge ? null : bossForecast(state, () => ui.invalidate()))}</div>`;
    // Quantité achetée par clic : ×1, ×10, ×100 ou le maximum abordable.
    const amount = ui.view.buyAmount ?? '1';
    const amounts = ['1', '10', '100', 'max'].map((a) => `<button class="btn chip-btn${a === amount ? ' active' : ''}" data-action="buy-amount" data-value="${a}">${a === 'max' ? 'Max' : `×${a}`}</button>`).join('');
    const cards = cat.keys.map((key) => {
      const up = BALANCE.upgrades[key];
      const level = state.upgrades[key];
      const max = up.maxLevel !== undefined && level >= up.maxLevel;
      const plan = bulkPlan(state, key, amount);
      const count = Math.max(1, plan.count);
      const cost = plan.count ? plan.cost : upgradeCost(key, level);
      const next = computeHeroStats({ ...state, upgrades: { ...state.upgrades, [key]: level + count } });
      const [from, to, unit] = effect(key, current, next);
      const milestone = key === 'damage' && (level + 1) % up.milestoneEvery === 0
        ? `<span class="tag">×${formatDecimal(up.milestoneMultiplier)}</span>` : '';
      return `<div class="card upg-card" title="${escapeHtml(up.description)}">
        <div class="upg-icon">${img(ICONS[key])}</div>
        <div><div class="upg-name">${escapeHtml(up.label)}</div><div class="upg-level">Niv. ${level}${up.maxLevel ? `/${up.maxLevel}` : ''}</div></div>
        <div class="upg-effect num">${max ? `<span class="to">${from}</span> ${unit}`
          : `<span class="from">${from}</span> → <span class="to">${to}</span> ${unit}${milestone}`}</div>
        ${costButton({ action: 'buy', cost, have: state.gold, attrs: `data-key="${key}" data-amount="${amount}"`, max, label: count > 1 ? `+${count} ` : '' })}
      </div>`;
    });
    return `${guide}<div class="split-nav"><div class="side-nav">${cats}</div><div class="upg-list"><div class="chip-row buy-amounts">${amounts}</div>${cards.join('')}</div></div>`;
  },
};
