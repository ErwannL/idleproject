import { animCanvas } from '../animator.js'; // v10.2 (P3)
// Améliorations achetées avec l'or.
import { PRESTIGE } from '../../data/prestige.js';
import { REBIRTH } from '../../data/rebirth.js';
import { canRebirth, rebirthBlocked, rebirthGain, rebirthWorth } from '../../core/rebirth.js';
import { stageLabel } from '../../core/combat.js';
import { BALANCE } from '../../data/balance.js';
import { bulkPlan, upgradeCost, upgradeMilestones } from '../../core/economy.js';
import { computeHeroStats } from '../../core/stats.js';
import { bossForecast, coin, costButton, escapeHtml, fold, distinctTo, forecastHtml, formatDecimal, formatNumber, icon, img } from '../common.js';
import { mBtn, mBtnGold, mChip, mModes, mTile, mTitle } from '../mobile-kit.js'; // v10.12 (lot 4) : vue téléphone
import { upgradeProfits } from '../../core/profit.js';
import { pref } from '../prefs.js';
import { pageActive, pageNarrow } from '../page.js'; // v10.6 (5)
import { BASE_UPGRADES, nextUpgradeUnlock, openUpgrades } from '../../core/unlocks.js';
import { POWERLESS_UPGRADES, WEAK_UPGRADE_PCT, UPGRADE_NAMES } from '../../core/guide.js'; // v10.6 (5)
import { currentEnvironment, hitsToFall } from '../../core/combat.js'; // v9.2.1 · v9.2.8 : coups encaissés

const ICONS = {
  // v9.4.0 : icônes PixelLab 48×48, une idée par icône (plus de doublons avec les compétences ni les ressources).
  damage: 'icon_damage', attackSpeed: 'icon_bolt', crit: 'icon_crit', critDamage: 'icon_critdmg', doubleAttack: 'icon_double',
  bossDamage: 'icon_boss', companionPower: 'icon_bond', vitality: 'icon_heart', defense: 'icon_defense', armor: 'icon_defense',
  regen: 'icon_regen', lifesteal: 'icon_lifesteal', dodge: 'icon_dodge', goldFind: 'icon_gold', xpGain: 'icon_xp',
};
// v9.2.8 : lignes de survie — gain neutre affiché en « PV effectifs » (PV ÷ part des dégâts qui passe), comme
// « dégâts/s » pour les lignes d'attaque.
// v10.8 (partie 2) : au-delà de +1 000 %, « ×30 de puissance » au lieu de « +2,9 K % ».
export const powerGainText = (pct) => (pct >= 1000 ? `×${formatNumber(Math.round(1 + pct / 100))} de puissance` : `+${formatDecimal(pct)} % de puissance`);
const SURVIVAL = new Set(['vitality', 'defense', 'armor']);
// v10.6 (partie 5) : 3 groupes dessinés (bandeaux PixelLab), comme les tuiles du Carnet.
const GROUPS = [
  { id: 'strike', title: 'Frapper fort', art: 'group_strike', keys: ['damage', 'attackSpeed', 'crit', 'critDamage', 'doubleAttack', 'bossDamage', 'companionPower'] },
  { id: 'endure', title: 'Tenir', art: 'group_endure', keys: ['vitality', 'defense', 'armor', 'regen', 'lifesteal', 'dodge'] },
  { id: 'earn', title: 'Gagner plus', art: 'group_earn', keys: ['goldFind', 'xpGain'] },
];

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
    // v9.2.0
    case 'critDamage': return [`×${formatDecimal(cur.critMultiplier, 2)}`, `×${formatDecimal(next.critMultiplier, 2)}`, 'critique'];
    case 'bossDamage': return [`+${formatDecimal(cur.bossDamagePct)} %`, `+${formatDecimal(next.bossDamagePct)} %`, 'boss'];
    case 'companionPower': return [`+${formatDecimal(cur.companionPowerPct)} %`, `+${formatDecimal(next.companionPowerPct)} %`, 'compagnons'];
    case 'lifesteal': return [`${formatDecimal(cur.lifesteal)} %`, `${formatDecimal(next.lifesteal)} %`, 'vol de vie'];
    case 'dodge': return [`${formatDecimal(cur.dodgePct)} %`, `${formatDecimal(next.dodgePct)} %`, 'esquive'];
    case 'xpGain': return [`+${formatDecimal(cur.xpPct)} %`, `+${formatDecimal(next.xpPct)} %`, 'XP'];
    // v9.2.8
    case 'defense': return [`Dégâts reçus −${formatDecimal(cur.defenseReductionPct)} %`, `−${formatDecimal(next.defenseReductionPct)} %`, 'défense']; // v9.11 (6) : lisible pour un débutant
    case 'doubleAttack': return [`${formatDecimal(cur.doubleAttackPct)} %`, `${formatDecimal(next.doubleAttackPct)} %`, 'double attaque'];
    default: return ['', '', ''];
  }
}

// v9.1.0 : une seule liste (catégorie en filtre replié), quantité mémorisée, « Acheter le plus rentable » (dégâts/s
// gagnés par or, core/profit.js). Au début, 3 lignes seulement (Dégâts, Vitesse, PV) ; ×10, ×100 et Max quand l'or
// atteint 10 fois le moins cher. Mode compact : une ligne par amélioration, sans description.
// v9.2.0 : ordre et déblocage progressif dans core/unlocks.js (13 améliorations).

// v9.9 (K14) : Renaissance toujours en vue, dernière ligne des Améliorations, avec son gain sur le bouton ; grisée avec la
// raison tant qu'elle n'est pas rentable.
function rebirthRow(state, gold = true) {
  const gainPct = Math.round((PRESTIGE.rebirthMultiplier ** rebirthGain(state) - 1) * 100);
  const ok = canRebirth(state) && !rebirthBlocked(state) && rebirthWorth(state);
  const why = !canRebirth(state) ? (state.maxStage < REBIRTH.minStage ? `Rentable à l'étape ${stageLabel(REBIRTH.minStage)}` : 'Termine la mini-quête « Renaissance »')
    : rebirthBlocked(state) ?? (rebirthWorth(state) ? '' : 'Rentable un peu plus loin : avance encore');
  // v9.11 (6) : le texte sur toute la largeur, le bouton dessous (plus de colonne de 2 mots).
  return `<div class="card upg-rebirth upg-rebirth-v">
    <div class="upg-rb-head">${img('icon_star')}<div><div class="upg-name">Renaissance</div><div class="muted">Recommence plus fort : +${gainPct} % de dégâts, PV et or pour toujours</div></div></div>
    ${ok ? `<button class="btn ${gold ? 'btn-gold' : 'btn-rebirth'}" data-action="rebirth">Renaître · +${gainPct} %</button>` : `<button class="btn" disabled>${escapeHtml(why)}</button>`}</div>`;
}

export default {
  id: 'upgrades',
  title: 'Améliorations',
  icon: 'icon_upgrade',
  extra: (ui, state) => `${coin()}<b class="gold-text num">${formatNumber(state.gold)}</b>`,
  render(ui, state) {
    const beginner = (state.records.bossesDefeated ?? 0) === 0;
    const phone = Boolean(ui.root?.classList.contains('m-phone')); // v10.12 : vue téléphone (kit mobile)
    const pcFrame = !phone && !pageNarrow(ui); // v10.13 : page PC dans le cadre du kit (un seul bouton doré : « Tout acheter »)
    const buyCls = pcFrame ? 'btn-buy' : 'btn-gold';
    const mrows = {};
    const cats = BALANCE.upgradeCategories.filter((c) => c.id !== 'rushes');
    const cat = phone ? null : cats.find((c) => c.id === ui.view.upgradeCat) ?? null; // null = toutes
    const current = computeHeroStats(state);
    // v10.2 (P3) : portrait du héros qui évolue tous les 25 niveaux de Dégâts (aura de plus en plus forte).
    const tier = Math.min(6, Math.floor((state.upgrades.damage ?? 0) / 25));
    const nextAt = (tier + 1) * 25;
    // v10.4 (partie 7) : un décor PixelLab derrière le héros, qui change tous les 2 paliers (upgrades_hero_tier1 à 4).
    const heroCard = `<div class="upg-hero tier-${tier}" style="background-image:url(assets/ui/art104/upgrades_hero_tier${Math.min(4, Math.floor(tier / 2) + 1)}.png)"><div class="upg-hero-pic">${animCanvas('hero', 64, 58, 3)}</div><div><b>Puissance du héros : palier ${tier + 1}</b>
      <div class="muted small">${tier < 6 ? `Dégâts niveau ${nextAt} : l'aura grandit (encore ${Math.max(0, nextAt - (state.upgrades.damage ?? 0))} niveaux).` : 'Aura maximale.'}</div></div></div>`;
    const profits = upgradeProfits(state);
    let keys = (beginner ? BASE_UPGRADES : openUpgrades(state, BALANCE)).filter((k) => !cat || cat.keys.includes(k));
    const env = currentEnvironment(state); // v9.2.1 : malus du monde actuel (mention neutre sur la ligne qui le contre)
    const nextUp = beginner ? null : nextUpgradeUnlock(state, BALANCE);
    if (ui.view.upgradeSort === 'profit') keys = [...keys].sort((x, y) => (profits[y]?.score ?? -1) - (profits[x]?.score ?? -1));
    else if (ui.view.upgradeSort === 'cost') keys = [...keys].sort((x, y) => upgradeCost(x, state.upgrades[x], undefined, state) - upgradeCost(y, state.upgrades[y], undefined, state));
    const cheapest = Math.min(Infinity, ...keys.map((k) => upgradeCost(k, state.upgrades[k], undefined, state)));
    const bulkOpen = !beginner || state.gold >= cheapest * 10;
    const amount = bulkOpen ? ui.view.buyAmount ?? ((state.records.bossesDefeated ?? 0) > 30 ? 'max' : '1') : '1'; // v10.7 (4) : « Max » par défaut dans une partie avancée
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
    // v9.3.8 (3e) : un seul gain comparable par ligne — « Puissance +N » (la Puissance mêle dégâts et survie) ; flèche
    // verte sur la meilleure affaire (Puissance gagnée par pièce d'or). Or et Savoir gardent leur effet propre.
    const powerGain = (key) => {
      const lv = state.upgrades[key], up = BALANCE.upgrades[key];
      if (up.maxLevel !== undefined && lv >= up.maxLevel) return null;
      const plan = bulkPlan(state, key, amount);
      const n = Math.max(1, plan.count);
      const c = plan.count ? plan.cost : upgradeCost(key, lv, undefined, state);
      const g = computeHeroStats({ ...state, upgrades: { ...state.upgrades, [key]: lv + n } }).combatPower - current.combatPower;
      return { gain: g, cost: c };
    };
    const gains = Object.fromEntries(keys.map((k) => [k, powerGain(k)]));
    const weakOf = (k) => !POWERLESS_UPGRADES.has(k) && !(gains[k] && current.combatPower > 0 && (gains[k].gain / current.combatPower) * 100 >= WEAK_UPGRADE_PCT); // v10.7 (4)
    const bestKey = keys.filter((k) => gains[k]?.gain > 0).sort((a, b) => gains[b].gain / gains[b].cost - gains[a].gain / gains[a].cost)[0];
    const done = [];
    const weakCards = []; // v10.9 (6) // v9.8 (C2) : lignes au maximum, repliées dans « Terminées (N) »
    const cards = keys.map((key) => {
      const up = BALANCE.upgrades[key];
      const level = state.upgrades[key];
      const max = up.maxLevel !== undefined && level >= up.maxLevel;
      const plan = bulkPlan(state, key, amount);
      const count = Math.max(1, plan.count);
      const cost = plan.count ? plan.cost : upgradeCost(key, level, undefined, state);
      const next = computeHeroStats({ ...state, upgrades: { ...state.upgrades, [key]: level + count } });
      const [from, to0] = effect(key, current, next);
      const to = distinctTo(from, to0, current.combatPower > 0 ? (next.combatPower / current.combatPower - 1) * 100 : 0);
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
      const ehp = SURVIVAL.has(key) && !max && current.effectiveHp > 0 ? ((next.effectiveHp - current.effectiveHp) / current.effectiveHp) * 100 : 0;
      const pg = gains[key];
      // v9.8 (I1) : avec ×10 / ×100 / Max, le gain total de l'achat (« +12 niv. · +4,1 % de puissance »).
      const totalPct = count > 1 && current.combatPower > 0 ? ((next.combatPower / current.combatPower) - 1) * 100 : 0;
      const gain = totalPct > 0.05 ? ` <span class="muted upg-profit">${key === bestKey ? '<b class="upg-best" title="Meilleure affaire">▲</b> ' : ''}+${count} niv. · ${powerGainText(totalPct)}</span>`
        : pg && pg.gain > 0 ? ` <span class="muted upg-profit">${key === bestKey ? '<b class="upg-best" title="Meilleure affaire">▲</b> ' : ''}Puissance +${formatNumber(Math.round(pg.gain))}</span>` : '';
      // v9.1.3 (ligne type doc2 §3) : icône, nom + niveau (+ palier), un seul chiffre qui bouge (avant → après, l'unité
      // est dans le nom), +x % dégâts/s neutre sur la même ligne, bouton avec prix : 2 lignes au lieu de 3.
      // v10.11 (1) : « peu utile » jugé sur le gain d'UN niveau (manquer d'or n'est pas « peu utile »).
      const one = max || POWERLESS_UPGRADES.has(key) ? null : computeHeroStats({ ...state, upgrades: { ...state.upgrades, [key]: level + 1 } });
      const pctOne = one && current.combatPower > 0 ? ((one.combatPower / current.combatPower) - 1) * 100 : Infinity;
      const weak = !max && !POWERLESS_UPGRADES.has(key) && pctOne < WEAK_UPGRADE_PCT; // grisé, mais reste dans sa colonne
      const html = `<div class="card upg-card${compact ? ' compact' : ''}${weak ? ' weak' : ''}${key === bestKey && !weak ? ' advised' : ''}" data-key="${key}" ${weak ? 'title="Presque sans effet (moins de 0,5 % de puissance) : pas dans « Tout acheter »"' : ''}>
        <div class="upg-icon">${img(ICONS[key])}</div>
        <div class="upg-main"><div class="upg-name" title="${escapeHtml(up.description)}">${escapeHtml(up.label)} <span class="upg-level">niv. ${level}${up.maxLevel ? `/${up.maxLevel}` : ''}</span>${milestone}${weak ? '<span class="tag upg-weak-tag" title="Moins de 0,5 % de puissance : pas dans « Tout acheter »">peu utile</span>' : ''}${env?.counter === key ? `<span class="tag env-counter" title="${escapeHtml(`Contré : ${Math.round(env.countered)} % (complet au niveau ${env.fullAt})`)}">contre ${escapeHtml(env.name)}</span>` : ''}</div>
        ${compact || !beginner ? '' : `<div class="muted upg-desc">${escapeHtml(up.description)}</div>`}
<div class="upg-effect num">${max ? `<span class="to">${from}</span>` : `<span class="from">${from}</span> → <b class="to good">${to}</b>`}</div></div>
        <div class="upg-buy">${costButton({ action: 'buy', cost, have: state.gold, attrs: `data-key="${key}" data-amount="${amount}"`, max, label: count > 1 ? `+${count} ` : '', cls: buyCls })}
          ${max ? '' : `<small class="upg-gain">${key === bestKey ? '<b class="upg-best" title="Meilleure affaire">★</b> ' : ''}${totalPct > 0.05 ? `+${count} niv. · ${powerGainText(totalPct)}` : p?.pct > 0.05 ? `+${formatDecimal(p.pct)} % DPS` : gain ? gain.replace(/<[^>]+>/g, '').replace('▲', '').trim() : ''}</small>`}</div>
      </div>`; // v9.9 (K3/K15) : avant → après, gain sous le prix, étoile sur la meilleure affaire
      if (phone) {
        const gainTxt = max ? '' : totalPct > 0.05 ? `+${count} niv. · ${powerGainText(totalPct).replace(' de puissance', ' puiss.')}` : p?.pct > 0.05 ? `+${formatDecimal(p.pct)} % DPS` : pg && pg.gain > 0 ? `Puissance +${formatNumber(Math.round(pg.gain))}` : '';
        const tags = `${weak ? '<span class="m-tag weak" title="Moins de 0,5 % de puissance : pas dans « Tout acheter »">peu utile</span>' : ''}${env?.counter === key ? `<span class="m-tag env">contre ${escapeHtml(env.name)}</span>` : ''}${ms && !weak ? (ms.reached > 1 ? `<span class="m-tag ms">×${mult(ms.reached)}</span>` : `<span class="m-tag ms">×${mult(ms.nextMult)} niv. ${ms.nextLevel}</span>`) : ''}`;
        const buy = max ? '<span class="m-buy max">Max</span>'
          : `<button type="button" class="m-buy${state.gold >= cost ? ' ok' : ' ko'}" data-action="buy" data-cost="${cost}" data-currency="gold" data-key="${key}" data-amount="${amount}" aria-label="${escapeHtml(`Acheter ${count > 1 ? `+${count} ` : ''}${up.label} : ${formatNumber(cost)} or`)}" ${state.gold >= cost ? '' : 'disabled'}>${count > 1 ? `<small>+${count}</small>` : ''}<span class="m-cost ${state.gold >= cost ? 'ok' : 'ko'}"><span class="m-cost-ico">${coin()}</span><span class="m-cost-n">${formatNumber(cost)}</span></span></button>`;
        mrows[key] = { done: max, html: `<div class="m-card m-uprow${weak ? ' weak' : ''}${max ? ' done' : ''}${key === bestKey && !weak ? ' advised' : ''}" data-key="${key}">
          ${mTile({ name: up.label, rarity: 'common' }, { size: 48, src: icon(ICONS[key]), pips: false })}
          <div class="m-upmain"><div class="m-upname"><b title="${escapeHtml(up.description)}">${escapeHtml(up.label)}</b></div>
            <div class="m-uptags"><span class="m-uplv">niv. ${level}${up.maxLevel ? `/${up.maxLevel}` : ''}</span>${tags}</div>
            <div class="m-upfx num">${max ? `<span class="to">${from}</span>` : `${from} <i>›</i> <b class="to good">${to}</b>`}</div>
            <div class="m-upgain">${gainTxt ? `<span class="m-gtx">${key === bestKey ? '<b class="upg-best" title="Meilleure affaire">▲</b> ' : ''}${gainTxt}</span>` : ''}</div></div>${buy}</div>` };
      }
      if (max) { done.push(html); return ''; }
      return html;
    });
    const byKey = Object.fromEntries(keys.map((k, i) => [k, cards[i]]));
    // v10.6 (partie 5) : sans catégorie choisie, la liste est rangée en 3 groupes dessinés.
    const grouped = cat || beginner ? `<div class="upg-list">${cards.join('')}</div>` : GROUPS.map((g) => {
      const body = g.keys.filter((k) => byKey[k]).map((k) => byKey[k]).join('');
      return body ? `<section class="upg-group g-${g.id}"><h4 class="upg-group-head" style="background-image:url(assets/ui/art106/${g.art}.png)"><span>${g.title}</span></h4><div class="upg-list">${body}</div></section>` : '';
    }).join('') + (() => { const rest = keys.filter((k) => !GROUPS.some((g) => g.keys.includes(k)) && byKey[k]).map((k) => byKey[k]).join(''); return rest ? `<div class="upg-list">${rest}</div>` : ''; })();
    // v10.6 (partie 5) : « ★ Meilleur achat » en tête, avec sa raison en image.
    const bk = bestKey && gains[bestKey];
    const bkPct = bk && current.combatPower > 0 ? (bk.gain / current.combatPower) * 100 : 0;
    // v10.7 (4) : la carte est toujours là ; si rien ne rapporte 0,5 %, elle envoie vers l'équipement (Forge). Le
    // portrait du héros y devient un médaillon de 120 px.
    const tier0 = Math.min(4, Math.floor(Math.min(6, Math.floor((state.upgrades.damage ?? 0) / 25)) / 2) + 1);
    const medal = `<span class="upg-bb-medal" style="background-image:url(assets/ui/art104/upgrades_hero_tier${tier0}.png)">${animCanvas('hero', 64, 58, 2)}<img class="px upg-bb-badge" src="assets/ui/art106/badge_best_buy.png" alt=""></span>`;
    const bestCard = beginner ? '' : bk && bkPct >= WEAK_UPGRADE_PCT ? `<div class="card upg-bestbuy">${medal}
      <div class="upg-bb-main"><small>★ Meilleur achat</small><b>${img(ICONS[bestKey])} ${escapeHtml(UPGRADE_NAMES[bestKey] ?? bestKey)}</b>
      <span class="upg-bb-why"><b class="good num">${powerGainText(bkPct)}</b> pour ${coin()}<b class="num">${formatNumber(bk.cost)}</b> : le meilleur rapport</span></div>
      ${costButton({ action: 'buy', cost: bk.cost, have: state.gold, attrs: `data-key="${bestKey}" data-amount="${amount}"`, label: '', cls: buyCls })}</div>`
      : `<div class="card upg-bestbuy upg-bb-none">${medal}<div class="upg-bb-main"><small>★ Meilleur achat</small><b>${img('icon_anvil')} Ton or ira plus loin dans ton équipement</b>
      <span class="upg-bb-why">Ici, chaque achat rapporte moins de 0,5 % de puissance.</span></div><button class="btn ${buyCls}" data-action="open-tab" data-value="forge">Aller à la Forge ›</button></div>`;
    const advised = bk && bkPct >= WEAK_UPGRADE_PCT ? bestKey : null;
    // v9.2.8 : catégories en onglets toujours visibles (« Défense » ne se cache plus dans un menu replié) ; le tri
    // reste dans « Trier ».
    const catTabs = beginner ? '' : `<div class="chip-row upg-cats" role="group" aria-label="Catégorie">${[{ id: 'all', label: 'Toutes', icon: 'icon_upgrade' }, ...cats]
      .map((c) => { const on = (cat?.id ?? 'all') === c.id; return `<button class="btn chip-btn${on ? ' active' : ''}" data-action="upgrade-cat" data-value="${c.id}" aria-pressed="${on}">${img(c.icon)} ${escapeHtml(c.label)}</button>`; }).join('')}</div>`;
    const filters = `<div class="row upg-filters">
      <select data-action="upgrade-sort" aria-label="Trier"><option value="">Tri : par défaut</option><option value="profit" ${ui.view.upgradeSort === 'profit' ? 'selected' : ''}>Tri : rentabilité</option><option value="cost" ${ui.view.upgradeSort === 'cost' ? 'selected' : ''}>Tri : coût</option></select></div>`;
    let forecast = state.dungeon || state.tower || state.challenge ? '' : forecastHtml(bossForecast(state, () => ui.invalidate()));
    // v10.7 (4) : le bandeau ne conseille jamais une ligne grisée.
    if (weakOf('damage')) forecast = forecast.replace('Améliore tes Dégâts.', advised ? `Achète d'abord : ${escapeHtml(UPGRADE_NAMES[advised] ?? advised)}.` : 'Renforce ton arme à la Forge.');
    // v9.1.3 (A6) : Dégâts/s en en-tête (même calcul que la Fiche, déjà fait pour les lignes : aucun coût en plus) ;
    // le panneau est redessiné à chaque achat, le chiffre bouge donc avec lui.
    // v9.2.8 : à côté des dégâts/s, les coups encaissés (ennemi ordinaire de l'étape, boss suivant) : on voit tout de
    // suite qu'un héros sans PV ni Défense tombe en un coup.
    const hits = hitsToFall(state);
    const fmtHits = (h) => (h >= 100 ? '99+' : h < 1 ? '< 1' : formatDecimal(Math.floor(h * 10) / 10));
    // v9.3.4 : en clair au lieu de « Encaisse < 1 coups · boss < 1 » (le détail reste dans l'infobulle).
    const fragile = hits.normal < 3 || hits.boss < 1;
    const surv = `<span class="upg-surv${fragile ? ' bad' : ''}" title="${escapeHtml(`Tient ${fmtHits(hits.normal)} coups d'un ennemi, ${fmtHits(hits.boss)} du boss`)}">${img('icon_heart')} ${fragile ? (gains.vitality && !weakOf('vitality') ? 'Trop fragile : améliore ta Vie' : 'Trop fragile : renforce ton armure à la Forge') : `Tu survis ${fmtHits(hits.boss)} coups du boss`}</span>`;
    const dpsHead = `<div class="upg-dps"><span class="muted">Dégâts/s</span> <b class="num">${formatDecimal(current.dps)}</b>${beginner ? '' : surv}</div>`;
    const top = qtyMenu ? `<div class="row-between upg-dps-row">${dpsHead}${amounts}</div>${forecast}` : `${dpsHead}${forecast}${amounts ? `<div class="row-between">${amounts}</div>` : ''}`;
    // v9.9 (K15) : « Tout acheter » en haut de l'onglet (meilleur rapport d'abord, confirmation la première fois).
    // v10.11 (1) : rien d'achetable → bouton grisé et ce qui manque.
    const cheapestLeft = Math.min(Infinity, ...keys.filter((k) => !(BALANCE.upgrades[k].maxLevel !== undefined && state.upgrades[k] >= BALANCE.upgrades[k].maxLevel)).map((k) => upgradeCost(k, state.upgrades[k], undefined, state)));
    const buyAll = state.gold > 0 && state.gold < cheapestLeft && Number.isFinite(cheapestLeft)
      ? `<button class="btn buy-all" disabled>Tout acheter</button><small class="muted upg-missing">Il manque ${coin()} <b class="num">${formatNumber(cheapestLeft - state.gold)}</b> or</small>`
      : state.gold > 0 ? `<button class="btn btn-gold buy-all${ui.view.buyAllArmed ? ' armed' : ''}" data-action="${state.ui.buyAllOk || ui.view.buyAllArmed ? 'buy-best' : 'buy-all-arm'}">${ui.view.buyAllArmed && !state.ui.buyAllOk ? 'Confirmer : tout acheter ?' : 'Tout acheter'}</button>` : '';
    // v10.6 (partie 5) : en page plein écran, gabarit .pg : héros et achats à gauche, les 3 groupes en colonnes à droite.
    // v10.7 (4) : en page — « Meilleur achat » et « Tout acheter » sur toute la largeur, puis 3 colonnes égales.
    // v10.9 (6) : « Presque sans effet » dit une seule fois ; les lignes concernées sont repliées ensemble.
    const weakFold = ''; // v10.11 (1) : plus de pli « Peu utiles » : chaque ligne reste dans sa colonne
    if (phone) {
      // v10.12 (lot 4, § 4) : cadre, cartouche, bloc du haut à hauteur fixe, 3 familles en 3 modes, lignes de 84 px.
      const fams = GROUPS.map((g) => ({ ...g, rows: g.keys.filter((k) => mrows[k]) })).filter((g) => g.rows.length);
      const fam = fams.find((g) => g.id === ui.view.mUpFam) ?? fams[0];
      const sortNow = ui.view.upgradeSort === 'profit' ? 'profit' : ui.view.upgradeSort === 'cost' ? 'cost' : '';
      const sortNext = { '': 'profit', profit: 'cost', cost: '' }[sortNow];
      const sortWord = { '': 'Défaut', profit: 'Rentab.', cost: 'Coût' }[sortNow];
      const missing = state.gold > 0 && state.gold < cheapestLeft && Number.isFinite(cheapestLeft);
      const goldBtn = !state.gold ? '' : missing ? mBtnGold('Tout acheter', { disabled: true })
        : mBtnGold(ui.view.buyAllArmed && !state.ui.buyAllOk ? 'Confirmer : tout acheter ?' : 'Tout acheter', { action: state.ui.buyAllOk || ui.view.buyAllArmed ? 'buy-best' : 'buy-all-arm' });
      const fc = !forecast ? '' : forecast.replace(/<small[^>]*>.*?<\/small>/g, '');
      const survTxt = surv.replace(/<img[^>]*>/, '').replace(/<[^>]+>/g, '').trim();
      // v10.14.2 (B3) : partie neuve (ni pronostic, ni quantité, ni tri) : le héros à gauche, Dégâts/s en grand et 2 stats (Vie, Vitesse) à droite.
      const begHead = `<div class="m-card m-uphead beg">
        <div class="m-uph-hero">${animCanvas('hero', 64, 58, 1)}</div>
        <div class="m-uph-stats"><span class="m-uph-dps"><small>Dégâts/s</small><b class="num">${formatDecimal(current.dps)}</b></span>
          <div class="m-uph-mini"><span>${img('icon_heart')}<small>Vie</small><b class="num">${formatNumber(Math.round(current.maxHp))}</b></span><span>${img('icon_bolt')}<small>Vitesse</small><b class="num">${formatDecimal(current.attacksPerSecond, 2)}/s</b></span></div></div>
        <div class="m-uph-d">${goldBtn}${missing ? `<small class="m-missing">Il manque ${coin()} <b class="num">${formatNumber(cheapestLeft - state.gold)}</b></small>` : ''}</div></div>`;
      const head = beginner ? begHead : `<div class="m-card m-uphead">
        <div class="m-uph-a"><span class="m-uph-dps"><small>Dégâts/s</small><b class="num">${formatDecimal(current.dps)}</b></span>${beginner ? '' : `<span class="m-uph-surv${fragile ? ' bad' : ''}" title="${escapeHtml(survTxt)}">${img('icon_heart')}<span>${escapeHtml(survTxt)}</span></span>`}</div>
        <div class="m-uph-b">${fc}</div>
        <div class="m-uph-c">${bulkOpen ? `<div class="m-chips m-uph-chips" role="group" aria-label="Quantité">${['1', '10', '100', 'max'].map((a) => mChip(amountLabel(a), { action: 'buy-amount', value: a, on: a === amount })).join('')}</div>` : '<div class="m-chips m-uph-chips"></div>'}
          ${beginner ? '' : `<button type="button" class="m-sortbtn" data-action="m-set" data-key="upgradeSort" data-value="${sortNext}" aria-label="Trier : ${sortWord} (toucher pour changer)"><i aria-hidden="true">⇅</i><small>${sortWord}</small></button>`}</div>
        <div class="m-uph-d">${goldBtn}${missing ? `<small class="m-missing">Il manque ${coin()} <b class="num">${formatNumber(cheapestLeft - state.gold)}</b></small>` : '<small class="m-missing"></small>'}</div></div>`;
      const modes = fams.length > 1 ? mModes(fams.map((g) => ({ id: g.id, label: g.title, icon: `file:assets/ui/art106/${g.art}.png`, action: 'm-set', value: g.id, attrs: 'data-key="mUpFam"' })), fam?.id, { size: 64 }) : '';
      const famRows = fam ? fam.rows.map((k) => mrows[k]) : [];
      const list = [...famRows.filter((r) => !r.done), ...famRows.filter((r) => r.done)].map((r) => r.html).join('');
      const rbGain = Math.round((PRESTIGE.rebirthMultiplier ** rebirthGain(state) - 1) * 100);
      const rbOk = canRebirth(state) && !rebirthBlocked(state) && rebirthWorth(state);
      const rbWhy = !canRebirth(state) ? (state.maxStage < REBIRTH.minStage ? `Rentable à l'étape ${stageLabel(REBIRTH.minStage)}` : 'Termine la mini-quête « Renaissance »') : rebirthBlocked(state) ?? (rebirthWorth(state) ? '' : 'Rentable un peu plus loin');
      const rebirth = fam?.id === 'earn' || fams.length === 1 ? `<div class="m-card m-uprebirth"><div class="m-rb-t">${img('icon_star')}<b>Renaissance</b><small>+${rbGain} % dégâts, PV et or, pour toujours</small></div>${mBtn(rbOk ? `Renaître · +${rbGain} %` : rbWhy, { action: 'rebirth', disabled: !rbOk })}</div>` : '';
      return `<div class="m-frame m-hero m-up">${mTitle('icon_upgrade', 'Améliorations', true)}${head}${modes}
        <div class="m-uplist">${list || '<p class="m-note">Tout est au maximum ✓</p>'}</div>${rebirth}
        ${beginner ? '<p class="m-note">D\'autres améliorations s\'ouvrent au fil des boss.</p>' : nextUp ? `<p class="m-note">Prochaine ligne : ${escapeHtml(nextUp.label)}, dans 2 boss</p>` : ''}</div>`;
    }
    if (pcFrame) {
      // v10.18 (partie 5.2, corrigé à la fusion) : « ×1 ×10 ×100 Max » restent dans le flux, en haut ; « Tout acheter » part dans le
      // pied doré épinglé en bas du cadre (gold-dock.js, règle v10.17.1 du bouton doré en bas). Sans le ruban illustré en double et avec
      // la fenêtre élargie (5.4, 5.5), ces boutons ne sont plus sous le pied à l'ouverture.
      // v10.13 : cadre du kit PC (cartouche dedans), bande d'illustration + or, puis « Meilleur achat » et le haut, les 3 familles en colonnes.
      const col = (g) => { const body = g.keys.filter((k) => byKey[k]).map((k) => byKey[k]).join('') || '<p class="muted upg-all-max">Tout est au maximum ✓</p>'; return `<section class="upg-group g-${g.id}"><h4 class="upg-group-head" style="background-image:url(assets/ui/art106/${g.art}.png)"><span>${g.title}</span></h4><div class="upg-list">${body}</div>${g.id === 'earn' ? rebirthRow(state, false) : ''}</section>`; };
      return `<div class="m-frame d-upg">${mTitle('icon_upgrade', 'Améliorations', true)}<div class="upg-page107 d-up"><div class="d-topline"><span class="d-chip" title="Ton or">${coin()}<b class="num">${formatNumber(state.gold)}</b></span><img class="px d-topart" src="assets/ui/art101/banner_upgrades.png" alt="" aria-hidden="true"></div>
      <div class="upg-toprow">${bestCard}<div class="card upg-top">${top}${buyAll ? `<div class="upg-buyall-row">${buyAll}</div>` : ''}</div></div>
        <div class="upg-cols3">${GROUPS.map(col).join('')}</div>${weakFold}${done.length ? fold(ui, 'upg-done', `Terminées (${done.length})`, `<div class="upg-list">${done.join('')}</div>`) : ''}</div></div>`;
    }
    return `${heroCard}<div class="card upg-top">${top}${buyAll}</div>
      ${catTabs}
      ${beginner ? '' : fold(ui, 'upg-filters', 'Trier', filters)}
      ${bestCard}${grouped}${weakFold}
      ${done.length ? fold(ui, 'upg-done', `Terminées (${done.length})`, `<div class="upg-list">${done.join('')}</div>`) : ''}
      ${rebirthRow(state)}
      ${beginner ? '<div class="muted">D\'autres améliorations s\'ouvrent au fil des boss.</div>' : ''}
      ${nextUp ? `<div class="muted next-unlock">Prochaine ligne : ${escapeHtml(nextUp.label)}, dans 2 boss</div>` : ''}`;
  },
};
