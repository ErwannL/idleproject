// Invocation : gemmes gagnées en jouant (v9.1.3 : tickets fondus dans les gemmes), probabilités et garanties affichées.
import { navPath } from '../nav.js';
import { BALANCE } from '../../data/balance.js';
import { FEATURED_SHARE, featuredUnit, normalizePool, summonOdds } from '../../core/gacha.js';
import { heroById } from '../../core/heroes.js';
import { companionById, duplicates } from '../../core/companions.js';
import { animCanvas } from '../animator.js';
import { effectText, escapeHtml, fold, hdArt, formatDecimal, formatNumber, gem, icon, img, rarityLabel, stars } from '../common.js';

function unitPortrait(result) {
  if (result.kind === 'hero') return animCanvas(`hero:${result.id}`, 48, 52, 1);
  const c = companionById(result.id);
  return c.kind === 'ally' ? animCanvas(`foe:${c.sprite}`, 64, 56, 1) : animCanvas(`pet:${c.sprite}`, 24, 24, 2);
}

// v9.0.6 : bannière du héros en vedette (grand portrait animé, titre, rôles, bonus, citation), façon
// « Nouveau héros » des jeux gacha — les boutons d'invocation restent dessous, jamais recouverts.
const ICON_FOR = {
  damagePct: 'icon_damage', critChance: 'icon_crit', attackSpeedPct: 'icon_bolt', maxHpPct: 'icon_heart', armor: 'icon_shield',
  regenPct: 'icon_regen', lifesteal: 'icon_heart', damageVsBossPct: 'icon_boss', xpPct: 'icon_xp', goldPct: 'icon_gold', dropChance: 'icon_bag',
};
function heroBanner(state) {
  const f = featuredUnit('hero');
  if (!f) return '';
  const h = heroById(f.id);
  const owned = state.heroes.owned[h.id];
  const perks = Object.entries(h.bonus).map(([k, v]) => `<div class="hb-perk">${img(ICON_FOR[k] ?? 'icon_star')}<span>${effectText({ [k]: v })}</span></div>`).join('');
  return `<div class="hero-banner">
      <div class="hb-left">
        <div class="hb-ribbon">✦ Apparence en vedette ✦</div>
        <div class="hb-titlerow"><span class="hb-ssr">Légendaire</span><div><div class="hb-name">${escapeHtml(h.name)}</div><div class="hb-sub">${escapeHtml(h.title ?? h.role)}</div></div></div>
        <div class="hb-tags">${(h.tags ?? [h.role]).map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>
        <div class="hb-perks">${perks}</div>
        ${h.quote ? `<div class="hb-quote">« ${escapeHtml(h.quote)} »</div>` : ''}
        <div class="muted hb-note">${Math.round(FEATURED_SHARE * 100)} % des Légendaires obtenus · change chaque lundi${owned ? ` · obtenu ${stars(owned.stars)}` : ''}</div>
      </div>
      <div class="hb-stage">${hdArt(h, 'hb-hd')}${animCanvas(`hero:${h.id}`, 96, 74, 4)}</div>
      
    </div>`;
}

// Historique des invocations (v8.4).
function historyBlock(state) {
  const h = state.summon.history ?? [];
  if (!h.length) return '';
  const rows = h.slice(0, 30).map((e) => {
    // v9.1.3 : `kind` (absent des anciennes entrées : compagnon d'abord, comme avant).
    const c = e.kind === 'hero' ? heroById(e.id) : companionById(e.id) ?? heroById(e.id);
    // v9.1.3 (A21) : petit portrait fixe dans la puce (compagnons et familiers ; les apparences n'ont pas d'icône).
    const face = c?.sprite && c.kind ? `<img class="px" src="${icon(c.sprite, c.kind === 'ally' ? 1 : 2)}" alt="">` : '';
    return c ? `<span class="hist r-${e.rarity}" title="${escapeHtml(c.name)}">${face}${escapeHtml(c.name)}</span>` : '';
  }).join('');
  const legend = h.filter((e) => e.rarity === 'legendary').length;
  return `<div class="card"><div class="section-title">Historique (${h.length} dernières) · ${legend} Légendaire${legend > 1 ? 's' : ''}</div>
    <div class="hist-row">${rows}</div></div>`;
}

export default {
  id: 'summon',
  title: 'Invocation',
  icon: 'icon_summon',
  extra: (ui, state) => `${gem()}<b class="num">${formatNumber(state.gems)}</b>`,
  // v9.1.0 : choix (Apparences, Compagnons, Familiers), ×1, ×10 et garanties visibles sans défiler ; bannière réduite
  // à une ligne de vedette ; probabilités, « À obtenir aussi » et historique repliés ; dernière invocation après un tirage.
  // v9.1.3 (doc1 « Invocation ») : les 3 bassins sur un écran, une ligne chacun (plus d'onglets) ; garanties en une
  // ligne collée en haut ; règles et probabilités derrière le « ? » de chaque bassin.
  render(ui, state) {
    const s = BALANCE.summon;
    const ownedOf = (u) => (u.kind === 'hero' ? state.heroes.owned : state.companions.owned)[u.id];
    const odds = (pool) => summonOdds(pool).filter((r) => r.units.length).reverse().map((r) => {
      const units = r.units.map((u) => {
        const owned = ownedOf(u);
        return `<div class="odds-unit${owned ? ' owned' : ''}${u.featured ? ' featured-unit' : ''}">
          ${unitPortrait(u)}<span class="rar-letter" aria-hidden="true">${rarityLabel(u.rarity).slice(0, 1)}</span>
          <span class="odds-name">${escapeHtml(u.name)}</span><span class="muted">${formatDecimal(u.chance * 100, 2)} %</span>
          ${owned ? stars(u.kind === 'hero' ? owned.stars : duplicates(owned)) : ''}</div>`;
      }).join('');
      return `<div class="odds-group r-${r.rarity}"><div class="row-between"><b class="rarity-text">${rarityLabel(r.rarity)}</b>
        <b class="num">${formatDecimal(r.chance * 100)} %</b></div><div class="odds-units">${units}</div></div>`;
    }).join('');
    const results = (ui.view.lastSummon ?? []).map((r) => `<div class="summon-result r-${r.rarity}${r.isNew ? ' new' : ''}">
      ${unitPortrait(r)}<span>${escapeHtml(r.name)}</span>
      ${r.isNew ? '<b class="good">Nouveau !</b>' : r.refund ? `<span class="muted">+${r.refund} gemmes</span>` : stars(r.kind === 'hero' ? r.stars : duplicates({ stars: r.stars }))}
      ${r.ultimateUnlocked ? '<b class="ult-new">Ultime débloquée</b>' : ''}</div>`).join(''); // v9.1.3 : aussi en clic maintenu (pas d'animation)
    const btn = (pool, count, currency, cost, label, aria) => {
      const missing = cost - state[currency];
      return `<button class="btn btn-gold" data-action="summon" data-value="${count}" data-currency="${currency}" data-pool="${pool}"
        aria-label="${escapeHtml(aria)}" title="${escapeHtml(missing > 0 ? `Il manque ${formatNumber(missing)} gemme${missing > 1 ? 's' : ''}` : aria)}" ${missing > 0 ? 'disabled' : ''}>${label}</button>`;
    };
    const rows = Object.entries(s.pools).map(([pool, p]) => {
      const legends = summonOdds(pool).find((r) => r.rarity === 'legendary')?.units.length ?? 0;
      const f = legends > 1 ? featuredUnit(pool) : null;
      const what = pool === 'hero' ? `Apparences du héros : chacune change son allure et apporte un bonus (${navPath('hero', 'Apparence')}).`
        : pool === 'ally' ? 'Compagnons : ils combattent aux côtés du héros (2 places dans l\'équipe).'
          : 'Familiers : petits alliés aux bonus passifs (1 place dans l\'équipe).';
      const open = ui.view.summonOdds === pool;
      return `<div class="card summon-row banner-${pool}">
        <div class="summon-row-head">${img(pool === 'hero' ? 'icon_hero' : pool === 'ally' ? 'icon_summon' : 'icon_paw')}<b>${p.label}</b>
          <span class="grow"></span>
          <button class="btn small help-q${open ? ' active' : ''}" data-action="summon-odds" data-value="${pool}" aria-expanded="${open}" aria-label="Règles et probabilités : ${escapeHtml(p.label)}">?</button></div>
        ${f ? `<div class="featured-line">${unitPortrait(f)}<span><b class="gold-text">★ En vedette : ${escapeHtml(f.name)}</b>
          <span class="muted">— ${Math.round(FEATURED_SHARE * 100)} % des Légendaires obtenus · change chaque lundi</span></span></div>` : ''}
        <div class="summon-buttons">
          ${btn(pool, 1, 'gems', s.gemCost, `×1 ${gem()} ${s.gemCost}`, `${p.label} ×1 : ${s.gemCost} gemmes`)}
          ${btn(pool, 10, 'gems', s.tenPullGemCost, `×10 ${gem()} ${s.tenPullGemCost}`, `${p.label} ×10 : ${s.tenPullGemCost} gemmes`)}
        </div>
        ${open ? `<div class="summon-odds"><p class="muted">${what} Compteur des garanties commun aux trois invocations. Doublon : +1 étoile (max 5), puis +${s.duplicateRefundGems} gemmes.</p>
          ${odds(pool)}</div>` : ''}
        ${pool === 'hero' && f ? fold(ui, 'summon-banner', 'Apparence en vedette : détails', () => heroBanner(state)) : ''}
        ${results && normalizePool(ui.view.summonPool) === pool ? `<div class="summon-results">${results}</div>` : ''}
      </div>`;
    }).join('');
    const pity = `<div class="summon-pity" role="status">Épique dans <b>${s.pity.epicAfter - state.summon.sinceEpic}</b> · Légendaire dans <b>${s.pity.legendaryAfter - state.summon.sinceLegendary}</b></div>`;
    return `${pity}${rows}
      ${(state.summon.history ?? []).length ? fold(ui, 'summon-history', 'Historique', () => historyBlock(state)) : ''}`;
  },
};
