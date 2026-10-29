// Invocation : gemmes ou tickets gagnés en jouant, probabilités et garanties affichées.
import { BALANCE } from '../../data/balance.js';
import { FEATURED_SHARE, featuredUnit, summonOdds, summonPool } from '../../core/gacha.js';
import { heroById } from '../../core/heroes.js';
import { companionById } from '../../core/companions.js';
import { ALLY_GRADE } from '../../data/companions.js';
import { animCanvas } from '../animator.js';
import { effectText, escapeHtml, hdArt, formatDecimal, formatNumber, gem, img, progressBar, rarityLabel, stars } from '../common.js';

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
  const others = summonPool('hero').filter((u) => u.rarity !== 'rare').sort((a, b) => (a.rarity === 'legendary' ? -1 : 1) - (b.rarity === 'legendary' ? -1 : 1))
    .slice(0, 6).map((u) => `<div class="hb-thumb r-${u.rarity}${u.id === h.id ? ' on' : ''}" title="${escapeHtml(u.name)}">${unitPortrait(u)}<span class="grade g-${u.rarity}">${ALLY_GRADE[u.rarity]}</span></div>`).join('');
  return `<div class="hero-banner">
      <div class="hb-left">
        <div class="hb-ribbon">✦ Héros en vedette ✦</div>
        <div class="hb-titlerow"><span class="hb-ssr">SSR</span><div><div class="hb-name">${escapeHtml(h.name)}</div><div class="hb-sub">${escapeHtml(h.title ?? h.role)}</div></div></div>
        <div class="hb-tags">${(h.tags ?? [h.role]).map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>
        <div class="hb-perks">${perks}</div>
        ${h.quote ? `<div class="hb-quote">« ${escapeHtml(h.quote)} »</div>` : ''}
        <div class="muted hb-note">${Math.round(FEATURED_SHARE * 100)} % des SSR obtenus · change chaque lundi${owned ? ` · obtenu ${stars(owned.stars)}` : ''}</div>
      </div>
      <div class="hb-stage">${hdArt(h, 'hb-hd')}${animCanvas(`hero:${h.id}`, 96, 74, 4)}</div>
      <div class="hb-side"><div class="hb-side-title">Héros vedettes</div>${others}</div>
    </div>`;
}

// v8.4 : bannière de la semaine (Légendaire mis en avant) et historique des invocations.
function featuredBlock(state, pool) {
  const f = featuredUnit(pool);
  if (!f) return '';
  const owned = (pool === 'hero' ? state.heroes.owned : state.companions.owned)[f.id];
  return `<div class="featured r-legendary">${unitPortrait(f)}<div class="grow">
      <b class="gold-text">★ Mis en avant cette semaine : ${escapeHtml(f.name)}</b>
      <div class="muted">Quand une invocation donne un ${pool === 'ally' ? 'SSR' : 'Légendaire'}, ${Math.round(FEATURED_SHARE * 100)} % de chances que ce soit lui.
        Change chaque lundi.${owned ? ` Déjà obtenu ${stars(owned.stars)}` : ''}</div></div></div>`;
}

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
  render(ui, state) {
    const s = BALANCE.summon;
    const pool = ['ally', 'pet'].includes(ui.view.summonPool) ? ui.view.summonPool : 'hero';
    const tabs = Object.entries(s.pools).map(([id, p]) => `<button class="btn chip-btn${id === pool ? ' active' : ''}"
      data-action="summon-pool" data-value="${id}">${img(id === 'hero' ? 'icon_hero' : id === 'ally' ? 'icon_summon' : 'icon_paw')}<span>${p.label}</span></button>`).join('');
    const ownedOf = (u) => (u.kind === 'hero' ? state.heroes.owned : state.companions.owned)[u.id];
    // Probabilités avec la tête de chaque compagnon / familier (on repère tout de suite sa rareté).
    const odds = summonOdds(pool).filter((r) => r.units.length).reverse().map((r) => {
      const units = r.units.map((u) => {
        const owned = ownedOf(u);
        return `<div class="odds-unit${owned ? ' owned' : ''}${u.featured ? ' featured-unit' : ''}" title="${escapeHtml(u.name)} · ${formatDecimal(u.chance * 100, 2)} %">
          ${unitPortrait(u)}${u.ally ? `<span class="grade g-${u.rarity}">${ALLY_GRADE[u.rarity]}</span>` : ''}
          <span class="odds-name">${escapeHtml(u.name)}</span><span class="muted">${formatDecimal(u.chance * 100, 2)} %</span>
          ${owned ? stars(owned.stars) : ''}</div>`;
      }).join('');
      return `<div class="odds-group r-${r.rarity}"><div class="row-between"><b class="rarity-text">${pool !== 'pet' ? ALLY_GRADE[r.rarity] : rarityLabel(r.rarity)}</b>
        <b class="num">${formatDecimal(r.chance * 100)} %</b></div><div class="odds-units">${units}</div></div>`;
    }).join('');
    const results = (ui.view.lastSummon ?? []).map((r) => `<div class="summon-result r-${r.rarity}${r.isNew ? ' new' : ''}" title="${escapeHtml(r.name)}">
      ${unitPortrait(r)}<span>${escapeHtml(r.name)}</span>
      ${r.isNew ? '<b class="good">Nouveau !</b>' : r.refund ? `<span class="muted">+${r.refund} gemmes</span>` : stars(r.stars)}</div>`).join('');
    const btn = (count, currency, cost, label) => `<button class="btn btn-gold" data-action="summon" data-value="${count}" data-currency="${currency}" data-pool="${pool}"
      ${state[currency] < cost ? 'disabled' : ''}>${label}</button>`;
    return `<div class="chip-row summon-tabs">${tabs}</div>
      ${pool === 'hero' ? heroBanner(state) : ''}
      <div class="card summon-banner banner-${pool}">
        <div class="summon-title">${img(pool === 'pet' ? 'icon_paw' : 'icon_summon')} ${pool === 'hero' ? 'Invocation de héros' : pool === 'ally' ? 'Appel des compagnons' : 'Appel des familiers'}</div>
        <div class="muted">${pool === 'hero'
          ? 'Apparences du héros R, SR et SSR : chacune change son allure et apporte un bonus (Personnage → Héros → Apparence).'
          : pool === 'ally'
            ? 'Compagnons humains R, SR et SSR : ils combattent aux côtés du chevalier (2 places dans l\'équipe).'
            : 'Familiers (animaux) : petits alliés aux bonus passifs (1 place dans l\'équipe).'}
          Gemmes et tickets se gagnent en jouant. Aucun achat réel.</div>
        <div class="summon-buttons">
          ${btn(1, 'tickets', 1, `×1 ${img('icon_ticket')} 1`)}
          ${btn(1, 'gems', s.gemCost, `×1 ${gem()} ${s.gemCost}`)}
          ${btn(10, 'gems', s.tenPullGemCost, `×10 ${gem()} ${s.tenPullGemCost}`)}
        </div>
        ${pool === 'hero' ? '' : featuredBlock(state, pool)}
        <div class="pity">
          <div><span>Épique garanti dans <b>${s.pity.epicAfter - state.summon.sinceEpic}</b></span>${progressBar(state.summon.sinceEpic / s.pity.epicAfter)}</div>
          <div><span>Légendaire garanti dans <b>${s.pity.legendaryAfter - state.summon.sinceLegendary}</b></span>${progressBar(state.summon.sinceLegendary / s.pity.legendaryAfter)}</div>
        </div>
        <div class="muted">Doublon : +1 étoile (max ${s.maxStars}), puis +${s.duplicateRefundGems} gemmes.</div>
      </div>
      ${historyBlock(state)}
      ${results ? `<div class="card"><div class="section-title">Dernière invocation</div><div class="summon-results">${results}</div></div>` : ''}
      <div class="card odds"><div class="section-title">Probabilités — ${s.pools[pool].label.toLowerCase()}</div>${odds}</div>`;
  },
};
