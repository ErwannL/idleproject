// Améliorations achetées avec l'or.
import { BALANCE } from '../../data/balance.js';
import { bulkPlan, upgradeCost, upgradeMilestones } from '../../core/economy.js';
import { computeHeroStats } from '../../core/stats.js';
import { bossForecast, coin, costButton, escapeHtml, fold, forecastHtml, formatDecimal, formatNumber, img } from '../common.js';
import { upgradeProfits } from '../../core/profit.js';
import { pref } from '../prefs.js';

const ICONS = {
  // v9.1.3 (doc2 §4) : icônes 20×20 dédiées (Critique ≠ Frappe rapide, Régénération ≠ fée, Dégâts et Or carrés).
  damage: 'icon_damage', attackSpeed: 'icon_bolt', crit: 'icon_crit', vitality: 'icon_heart',
  armor: 'icon_shield', regen: 'icon_regen', goldFind: 'icon_gold',
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

// v9.1.0 : une seule liste (catégorie en filtre replié), quantité mémorisée, « Acheter le plus rentable » (dégâts/s
// gagnés par or, core/profit.js). Au début, 3 lignes seulement (Dégâts, Vitesse, PV) ; ×10, ×100 et Max quand l'or
// atteint 10 fois le moins cher. Mode compact : une ligne par amélioration, sans description.
const BEGINNER_KEYS = ['damage', 'attackSpeed', 'vitality'];
const ORDER = ['damage', 'attackSpeed', 'crit', 'vitality', 'armor', 'regen', 'goldFind'];

export default {
  id: 'upgrades',
  title: 'Améliorations',
  icon: 'icon_upgrade',
  extra: (ui, state) => `${coin()}<b class="gold-text num">${formatNumber(state.gold)}</b>`,
  render(ui, state) {
    const beginner = (state.records.bossesDefeated ?? 0) === 0;
    const cats = BALANCE.upgradeCategories.filter((c) => c.id !== 'rushes');
    const cat = cats.find((c) => c.id === ui.view.upgradeCat) ?? null; // null = toutes
    const current = computeHeroStats(state);
    const profits = upgradeProfits(state);
    let keys = ORDER.filter((k) => !beginner || BEGINNER_KEYS.includes(k)).filter((k) => !cat || cat.keys.includes(k));
    if (ui.view.upgradeSort === 'profit') keys = [...keys].sort((x, y) => (profits[y]?.score ?? -1) - (profits[x]?.score ?? -1));
    else if (ui.view.upgradeSort === 'cost') keys = [...keys].sort((x, y) => upgradeCost(x, state.upgrades[x]) - upgradeCost(y, state.upgrades[y]));
    const cheapest = Math.min(...keys.map((k) => upgradeCost(k, state.upgrades[k])));
    const bulkOpen = !beginner || state.gold >= cheapest * 10;
    const amount = bulkOpen ? ui.view.buyAmount ?? '1' : '1';
    const amountLabel = (a) => (a === 'max' ? 'Max' : `×${a}`);
    const chips = (list) => list.map((a) => `<button class="btn chip-btn${a === amount ? ' active' : ''}" data-action="buy-amount" data-value="${a}" aria-pressed="${a === amount}">${amountLabel(a)}</button>`).join('');
    // v9.1.3 (A22, essai derrière Paramètres › Interface) : un seul bouton de quantité, qui déplie Max, ×100, ×10, ×1
    // (choix mémorisé) et se replie après le choix ; il prend place à côté de Dégâts/s au lieu d'une rangée entière.
    const qtyMenu = bulkOpen && pref('qtyMenu') === true;
    const amounts = !bulkOpen ? '' : qtyMenu
      ? `<span class="qty-menu"><button class="btn chip-btn active qty-toggle" data-action="qty-toggle" aria-expanded="${Boolean(ui.view.qtyOpen)}" aria-label="Quantité : ${amountLabel(amount)}">${amountLabel(amount)} ▾</button>
        ${ui.view.qtyOpen ? `<span class="chip-row buy-amounts qty-pop" role="group" aria-label="Quantité">${chips(['max', '100', '10', '1'])}</span>` : ''}</span>`
      : `<div class="chip-row buy-amounts" role="group" aria-label="Quantité">${chips(['1', '10', '100', 'max'])}</div>`;
    const compact = ui.compact;
    const cards = keys.map((key) => {
      const up = BALANCE.upgrades[key];
      const level = state.upgrades[key];
      const max = up.maxLevel !== undefined && level >= up.maxLevel;
      const plan = bulkPlan(state, key, amount);
      const count = Math.max(1, plan.count);
      const cost = plan.count ? plan.cost : upgradeCost(key, level);
      const next = computeHeroStats({ ...state, upgrades: { ...state.upgrades, [key]: level + count } });
      const [from, to] = effect(key, current, next);
      // v9.1.3 (A5) : palier visible à l'avance, selon la quantité choisie (Dégâts et PV) : multiplicateur atteint par
      // cet achat, sinon le prochain palier et son niveau (cumul ×1,35 × ×1,75 aux niveaux communs).
      const ms = max ? null : upgradeMilestones(key, level, level + count);
      const mult = (x) => (x >= 1000 ? formatNumber(x) : String(Math.round(x * 100) / 100).replace('.', ','));
      const milestone = !ms ? ''
        : ms.reached > 1 ? `<span class="tag ms-hit">×${mult(ms.reached)}</span>`
          : `<span class="tag ms-next">×${mult(ms.nextMult)} niv. ${ms.nextLevel}</span>`;
      const p = profits[key];
      // v9.1.3 : gain en dégâts/s affiché neutre (aucune « meilleure » amélioration désignée) ; la description ne
      // s'affiche qu'au début (avant le premier mini-boss), ensuite au survol / appui long sur le nom.
      const gain = p ? ` <span class="muted upg-profit">+${formatDecimal(p.pct)} % dégâts/s</span>` : '';
      // v9.1.3 (ligne type doc2 §3) : icône, nom + niveau (+ palier), un seul chiffre qui bouge (avant → après, l'unité
      // est dans le nom), +x % dégâts/s neutre sur la même ligne, bouton avec prix : 2 lignes au lieu de 3.
      return `<div class="card upg-card${compact ? ' compact' : ''}">
        <div class="upg-icon">${img(ICONS[key])}</div>
        <div class="upg-main"><div class="upg-name" title="${escapeHtml(up.description)}">${escapeHtml(up.label)} <span class="upg-level">niv. ${level}${up.maxLevel ? `/${up.maxLevel}` : ''}</span>${milestone}</div>
        ${compact || !beginner ? '' : `<div class="muted upg-desc">${escapeHtml(up.description)}</div>`}
        <div class="upg-effect num">${max ? `<span class="to">${from}</span>`
          : `<span class="from">${from}</span> → <span class="to">${to}</span>`}${gain}</div></div>
        ${costButton({ action: 'buy', cost, have: state.gold, attrs: `data-key="${key}" data-amount="${amount}"`, max, label: count > 1 ? `+${count} ` : '' })}
      </div>`;
    });
    const filters = `<div class="row upg-filters"><select data-action="upgrade-cat-select" aria-label="Catégorie"><option value="all">Toutes les catégories</option>${cats.map((c) => `<option value="${c.id}" ${cat?.id === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
      <select data-action="upgrade-sort" aria-label="Trier"><option value="">Tri : par défaut</option><option value="profit" ${ui.view.upgradeSort === 'profit' ? 'selected' : ''}>Tri : rentabilité</option><option value="cost" ${ui.view.upgradeSort === 'cost' ? 'selected' : ''}>Tri : coût</option></select></div>`;
    const forecast = state.dungeon || state.tower || state.challenge ? '' : forecastHtml(bossForecast(state, () => ui.invalidate()));
    // v9.1.3 (A6) : Dégâts/s en en-tête (même calcul que la Fiche, déjà fait pour les lignes : aucun coût en plus) ;
    // le panneau est redessiné à chaque achat, le chiffre bouge donc avec lui.
    const dpsHead = `<div class="upg-dps"><span class="muted">Dégâts/s</span> <b class="num">${formatDecimal(current.dps)}</b></div>`;
    const top = qtyMenu ? `<div class="row-between upg-dps-row">${dpsHead}${amounts}</div>${forecast}` : `${dpsHead}${forecast}${amounts ? `<div class="row-between">${amounts}</div>` : ''}`;
    return `<div class="card upg-top">${top}</div>
      ${beginner ? '' : fold(ui, 'upg-filters', 'Filtrer et trier', filters, { extra: cat ? cat.label : '' })}
      <div class="upg-list">${cards.join('')}</div>
      ${beginner ? '<div class="muted">D\'autres améliorations (critique, armure, régénération, or) s\'ouvrent après le premier mini-boss.</div>' : ''}`;
  },
};
