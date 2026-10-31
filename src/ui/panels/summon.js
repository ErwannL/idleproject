// Invocation : gemmes ou tickets gagnés en jouant, probabilités et garanties affichées.
import { navPath } from '../nav.js';
import { BALANCE } from '../../data/balance.js';
import { FEATURED_SHARE, featuredUnit, summonOdds } from '../../core/gacha.js';
import { heroById } from '../../core/heroes.js';
import { companionById } from '../../core/companions.js';
import { animCanvas } from '../animator.js';
import { effectText, escapeHtml, fold, hdArt, formatDecimal, formatNumber, gem, img, progressBar, rarityLabel, segment, stars } from '../common.js';

function unitPortrait(result) {
  if (result.kind === 'hero') return animCanvas(`hero:${result.id}`, 48, 52, 1);
  const c = companionById(result.id);
  return c.kind === 'ally' ? animCanvas(`foe:${c.sprite}`, 64, 56, 1) : animCanvas(`pet:${c.sprite}`, 24, 24, 2);
}

// v9.0.6 : bannière du héros en vedette (grand portrait animé, titre, rôles, bonus, citation), façon
// « Nouveau héros » des jeux gacha — les boutons d'invocation restent dessous, jamais recouverts.
const ICON_FOR = {
  damagePct: 'weapon_sword', critChance: 'skill_quick', attackSpeedPct: 'icon_bolt', maxHpPct: 'icon_heart', armor: 'icon_shield',
  regenPct: 'pet_fairy', lifesteal: 'icon_heart', damageVsBossPct: 'icon_boss', xpPct: 'icon_star', goldPct: 'coin', dropChance: 'icon_bag',
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
    const c = companionById(e.id) ?? heroById(e.id);
    return c ? `<span class="hist r-${e.rarity}" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>` : '';
  }).join('');
  const legend = h.filter((e) => e.rarity === 'legendary').length;
  return `<div class="card"><div class="section-title">Historique (${h.length} dernières) · ${legend} Légendaire${legend > 1 ? 's' : ''}</div>
    <div class="hist-row">${rows}</div></div>`;
}

export default {
  id: 'summon',
  title: 'Invocation',
  icon: 'icon_summon',
  extra: (ui, state) => `${gem()}<b class="num">${formatNumber(state.gems)}</b> ${img('icon_ticket')}<b class="num">${state.tickets}</b>`,
  // v9.1.0 : choix (Apparences, Compagnons, Familiers), ×1, ×10 et garanties visibles sans défiler ; bannière réduite
  // à une ligne de vedette ; probabilités, « À obtenir aussi » et historique repliés ; dernière invocation après un tirage.
  render(ui, state) {
    const s = BALANCE.summon;
    const pool = ['ally', 'pet'].includes(ui.view.summonPool) ? ui.view.summonPool : 'hero';
    const tabs = segment(Object.entries(s.pools).map(([id, p]) => [id, p.label, id === 'hero' ? 'icon_hero' : id === 'ally' ? 'icon_summon' : 'icon_paw']), 'summon-pool', pool);
    const ownedOf = (u) => (u.kind === 'hero' ? state.heroes.owned : state.companions.owned)[u.id];
    const odds = () => summonOdds(pool).filter((r) => r.units.length).reverse().map((r) => {
      const units = r.units.map((u) => {
        const owned = ownedOf(u);
        return `<div class="odds-unit${owned ? ' owned' : ''}${u.featured ? ' featured-unit' : ''}">
          ${unitPortrait(u)}<span class="rar-letter" aria-hidden="true">${rarityLabel(u.rarity).slice(0, 1)}</span>
          <span class="odds-name">${escapeHtml(u.name)}</span><span class="muted">${formatDecimal(u.chance * 100, 2)} %</span>
          ${owned ? stars(owned.stars) : ''}</div>`;
      }).join('');
      return `<div class="odds-group r-${r.rarity}"><div class="row-between"><b class="rarity-text">${rarityLabel(r.rarity)}</b>
        <b class="num">${formatDecimal(r.chance * 100)} %</b></div><div class="odds-units">${units}</div></div>`;
    }).join('');
    const results = (ui.view.lastSummon ?? []).map((r) => `<div class="summon-result r-${r.rarity}${r.isNew ? ' new' : ''}">
      ${unitPortrait(r)}<span>${escapeHtml(r.name)}</span>
      ${r.isNew ? '<b class="good">Nouveau !</b>' : r.refund ? `<span class="muted">+${r.refund} gemmes</span>` : stars(r.stars)}</div>`).join('');
    const btn = (count, currency, cost, label) => {
      const missing = cost - state[currency];
      return `<div class="cost-wrap"><button class="btn btn-gold primary-action" data-action="summon" data-value="${count}" data-currency="${currency}" data-pool="${pool}"
        ${missing > 0 ? 'disabled' : ''}>${label}</button>${missing > 0 ? `<span class="cost-missing">Il manque ${formatNumber(missing)} ${currency === 'gems' ? 'gemme' : 'ticket'}${missing > 1 ? 's' : ''}</span>` : ''}</div>`;
    };
    const f = featuredUnit(pool);
    const featured = f ? `<div class="featured-line">${unitPortrait(f)}<span><b class="gold-text">★ En vedette : ${escapeHtml(f.name)}</b>
      <span class="muted">— ${Math.round(FEATURED_SHARE * 100)} % des Légendaires obtenus · change chaque lundi</span></span></div>` : '';
    const what = pool === 'hero' ? `Apparences du héros : chacune change son allure et apporte un bonus (${navPath('hero', 'Apparence')}).`
      : pool === 'ally' ? 'Compagnons : ils combattent aux côtés du héros (2 places dans l\'équipe).'
        : 'Familiers : petits alliés aux bonus passifs (1 place dans l\'équipe).';
    return `${tabs}
      <div class="card summon-banner banner-${pool}">
        ${featured}
        <div class="summon-buttons">
          ${btn(1, 'tickets', 1, `×1 ${img('icon_ticket')} 1`)}
          ${btn(1, 'gems', s.gemCost, `×1 ${gem()} ${s.gemCost}`)}
          ${btn(10, 'gems', s.tenPullGemCost, `×10 ${gem()} ${s.tenPullGemCost}`)}
        </div>
        <div class="pity">
          <div><span>Épique garanti dans <b>${s.pity.epicAfter - state.summon.sinceEpic}</b></span>${progressBar(state.summon.sinceEpic / s.pity.epicAfter)}</div>
          <div><span>Légendaire garanti dans <b>${s.pity.legendaryAfter - state.summon.sinceLegendary}</b></span>${progressBar(state.summon.sinceLegendary / s.pity.legendaryAfter)}</div>
        </div>
        <div class="muted">Compteur commun aux trois invocations. ${what} Doublon : +1 étoile (max ${s.maxStars}), puis +${s.duplicateRefundGems} gemmes.</div>
      </div>
      ${results ? `<div class="card"><div class="section-title">Dernière invocation</div><div class="summon-results">${results}</div></div>` : ''}
      ${pool === 'hero' ? fold(ui, 'summon-banner', 'Apparence en vedette : détails', () => heroBanner(state)) : ''}
      ${fold(ui, `odds-${pool}`, `Probabilités et à obtenir aussi — ${s.pools[pool].label.toLowerCase()}`, odds)}
      ${(state.summon.history ?? []).length ? fold(ui, 'summon-history', 'Historique', () => historyBlock(state)) : ''}`;
  },
};
