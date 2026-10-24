// Améliorations achetées avec l'or, rangées par catégorie (Combat, Survie, Ressources).
import { BALANCE } from '../../data/balance.js';
import { upgradeCost } from '../../core/economy.js';
import { computeHeroStats } from '../../core/stats.js';
import { coin, costButton, escapeHtml, formatDecimal, formatNumber, img } from '../common.js';

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
    const cat = BALANCE.upgradeCategories.find((c) => c.id === ui.view.upgradeCat) ?? BALANCE.upgradeCategories[0];
    const current = computeHeroStats(state);
    const cats = BALANCE.upgradeCategories.map((c) => `<button class="btn chip-btn${c.id === cat.id ? ' active' : ''}"
      data-action="upgrade-cat" data-value="${c.id}">${img(c.icon)}<span>${c.label}</span></button>`).join('');
    const cards = cat.keys.map((key) => {
      const up = BALANCE.upgrades[key];
      const level = state.upgrades[key];
      const max = up.maxLevel !== undefined && level >= up.maxLevel;
      const cost = upgradeCost(key, level);
      const next = computeHeroStats({ ...state, upgrades: { ...state.upgrades, [key]: level + 1 } });
      const [from, to, unit] = effect(key, current, next);
      const milestone = key === 'damage' && (level + 1) % up.milestoneEvery === 0
        ? `<span class="tag">×${formatDecimal(up.milestoneMultiplier)}</span>` : '';
      return `<div class="card upg-card" title="${escapeHtml(up.description)}">
        <div class="upg-icon">${img(ICONS[key])}</div>
        <div><div class="upg-name">${escapeHtml(up.label)}</div><div class="upg-level">Niv. ${level}${up.maxLevel ? `/${up.maxLevel}` : ''}</div></div>
        <div class="upg-effect num">${max ? `<span class="to">${from}</span> ${unit}`
          : `<span class="from">${from}</span> → <span class="to">${to}</span> ${unit}${milestone}`}</div>
        ${costButton({ action: 'buy', cost, have: state.gold, attrs: `data-key="${key}"`, max })}
      </div>`;
    });
    return `<div class="split-nav"><div class="side-nav">${cats}</div><div class="upg-list">${cards.join('')}</div></div>`;
  },
};
