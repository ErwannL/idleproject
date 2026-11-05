// Invocation : gemmes gagnées en jouant (v9.1.3 : tickets fondus dans les gemmes), probabilités et garanties affichées.
import { navPath } from '../nav.js';
import { BALANCE } from '../../data/balance.js';
import { FEATURED_SHARE, featuredUnit, normalizePool, summonOdds } from '../../core/gacha.js';
import { heroById } from '../../core/heroes.js';
import { MULTIPLICATIVE, activeSynergies, companionById, companionMultiplier, duplicates, equippedOfKind } from '../../core/companions.js';
import { BANNER_RULES, UNITS } from '../../data/banners.js';
import { archiveTargets, currentBanner, lastBanner, nextBanner, worldStatus } from '../../core/banner.js';
import { COMPANION_ROLES, ROLES, SYNERGIES } from '../../data/synergies.js';
import { SKILL_RULES } from '../../data/companion-skills.js';
import { BOSSES } from '../../data/enemies.js';
import { skillsBlock } from './companions.js';
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

// v9.1.3 (doc4 lot 5) : écran avant de tirer. En façade, 5 éléments seulement : visage, monde, signature (« Ultime à
// 3 doublons »), filet « 37/50 », stock de tirages. Le reste derrière « Détails » (faits seulement : aucun badge, tri,
// verdict ni comparaison). Hors de la fiche : aperçu du suivant à J-7 et message de fin de bannière.
const dateText = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const DAY = 86400000;
function bannerFace(c) {
  return `<span class="bn-face">${animCanvas(`foe:${c.sprite}`, 64, 56, 1)}</span>`;
}
function passiveAt(state, c, copies) {
  const m = companionMultiplier(state, c.id, { stars: copies, level: 1 });
  return effectText(Object.fromEntries(Object.entries(c.passive).map(([k, v]) => [MULTIPLICATIVE[k] ?? k, v * m])));
}
function bannerDetails(ui, state, b) {
  const c = companionById(b.unit.id);
  const owned = state.companions.owned[c.id];
  const own = owned && !owned.trial ? owned : null;
  const role = COMPANION_ROLES[c.id];
  const sameRole = UNITS.filter((u) => u.id !== c.id && COMPANION_ROLES[u.id] === role && state.companions.owned[u.id] && !state.companions.owned[u.id].trial);
  // Synergies qui seraient actives avec l'équipe actuelle et ce perso (faits, sans conseil).
  const team = ['guardian', ...equippedOfKind(state, 'ally').map((x) => COMPANION_ROLES[x.id]).filter(Boolean), role];
  const now = new Set(activeSynergies(state).map((s) => s.id));
  const would = SYNERGIES.filter((syn) => { const pool = [...team]; return syn.roles.every((r) => { const i = pool.indexOf(r); if (i < 0) return false; pool.splice(i, 1); return true; }); });
  const st = worldStatus(state, c.id);
  const boss = st ? BOSSES[st.boss] : null;
  const ult = SKILL_RULES.ultimateCopies - 1;
  return `<div class="bn-details">
    <div><b>${escapeHtml(ROLES[role]?.label ?? '')}</b></div>
    ${[[0, 1], [ult, ult + 1], [5, 6]].map(([d, copies]) => `<div><span>Passif à ${d}★ :</span> <span class="good">${passiveAt(state, c, copies)}</span></div>`).join('')}
    ${skillsBlock(ui, state, c, own ?? { stars: 1, level: 1 })}
    ${boss ? `<div><span>Boss du monde :</span> <b>${escapeHtml(boss.name)}</b></div>
      <div>${st.trial ? 'Essai gratuit pendant la bannière : 0★, niveau 1, dans son monde (niveaux et paliers 1 à 4).' : 'Essai gratuit : perso déjà possédé.'}</div>` : ''}
    <div>${`Coût moyen sur la bannière : ${formatDecimal(BANNER_RULES.cost.first)} tirages pour l'obtenir (${BANNER_RULES.netPulls} au plus avec le filet), ${formatNumber(BANNER_RULES.cost.third)} pour ${ult}★.`}</div>
    <div><span>${`Déjà possédés dans ce rôle : ${sameRole.length}`}</span>${sameRole.length ? ` <span>${sameRole.map((u) => `<b>${escapeHtml(u.name)}</b>`).join(' ')}</span>` : ''}</div>
    <div><span>Synergies avec l'équipe actuelle :</span> ${would.length ? would.map((s) => `<b>${escapeHtml(s.name)}</b>${now.has(s.id) ? ' <span class="muted">(déjà active)</span>' : ''}`).join(' ') : '<span>aucune</span>'}</div>
    <div class="muted">Le filet garantit le perso, pas sa montée.</div>
  </div>`;
}
function bannerBlock(ui, state, btn) {
  if (!BANNER_RULES.enabled) return '';
  const b = currentBanner();
  const next = nextBanner();
  const last = lastBanner();
  const s = BALANCE.summon;
  const pulls = Math.floor(state.gems / s.gemCost);
  const preview = next ? `<div class="card bn-next">${bannerFace(next.unit)}<span>Le ${dateText(next.start)} : <b>${escapeHtml(next.unit.name)}</b></span></div>` : '';
  let main = '';
  if (b) {
    const c = b.unit;
    const owned = state.companions.owned[c.id];
    const has = owned && !owned.trial;
    const ultOpen = has && owned.stars >= SKILL_RULES.ultimateCopies;
    const zone = worldStatus(state, c.id)?.zone;
    const sig = c.ultimate;
    const ending = b.day >= BANNER_RULES.periodDays - 2;
    main = `<div class="card summon-row banner-banner">
      <div class="summon-row-head">${img('icon_summon')}<b>Bannière</b><span class="grow"></span><span class="muted">${`Jusqu'au ${dateText(b.end - DAY)}`}</span></div>
      <div class="bn-face-row">${bannerFace(c)}<div><div class="bn-name">${escapeHtml(c.name)}${has ? ` ${stars(duplicates(owned))}` : ''}</div>
        <button class="btn small" data-action="open-world" data-value="${c.id}">Monde : ${escapeHtml(zone?.name ?? '')} ›</button></div></div>
      <div class="bn-sig">${img('icon_star')} <b>${escapeHtml(sig.name)}</b> <span class="tag-ult">${ultOpen ? 'Ultime' : `Ultime à ${SKILL_RULES.ultimateCopies - 1} doublons`}</span></div>
      <div class="bn-facts"><span class="bn-net">Filet <b class="num">${has ? '—' : `${state.summon.net ?? 0}/${BANNER_RULES.netPulls}`}</b> <span class="muted">Le filet garantit le perso, pas sa montée.</span></span>
        <span>${gem()} <b class="num">${formatNumber(pulls)}</b> <span>${pulls > 1 ? 'tirages' : 'tirage'}</span></span></div>
      <div class="summon-buttons">
        ${btn('banner', 1, 'gems', s.gemCost, `×1 ${gem()} ${s.gemCost}`, `Bannière ×1 : ${s.gemCost} gemmes`)}
        ${btn('banner', 10, 'gems', s.tenPullGemCost, `×10 ${gem()} ${s.tenPullGemCost}`, `Bannière ×10 : ${s.tenPullGemCost} gemmes`)}
      </div>
      ${fold(ui, 'banner-details', 'Détails', () => bannerDetails(ui, state, b))}
      ${ui.view.lastSummon && normalizePool(ui.view.summonPool) === 'banner' ? `<div class="summon-results">${ui.view.bannerResults ?? ''}</div>` : ''}
    </div>
    ${ending ? `<div class="muted bn-end">Tes gemmes et ton filet restent. Monde ouvert. Archives dès le ${dateText(b.end)}.</div>` : ''}`;
  } else if (last && Date.now() - last.end < BANNER_RULES.periodDays * DAY) {
    main = `<div class="muted bn-end">Bannière de ${escapeHtml(last.unit.name)} terminée. Tes gemmes et ton filet restent. Monde ouvert. Archives dès le ${dateText(last.end)}.</div>`;
  }
  // Archives : cible au choix (5 SSR permanents et persos des bannières finies), mêmes taux, sans filet.
  const targets = archiveTargets();
  const sel = state.summon.archiveTarget;
  const archives = targets.length ? `<div class="card summon-row banner-archive">
      <div class="summon-row-head">${img('icon_book')}<b>Archives</b><span class="grow"></span><span class="muted">mêmes taux, sans filet</span></div>
      <div class="bn-targets">${targets.map((u) => `<button class="btn small${u.id === sel ? ' active' : ''}" data-action="archive-target" data-value="${u.id}" aria-pressed="${u.id === sel}">${escapeHtml(u.name)}</button>`).join('')}</div>
      <div class="summon-buttons">
        ${btn('archive', 1, 'gems', s.gemCost, `×1 ${gem()} ${s.gemCost}`, `Archives ×1 : ${s.gemCost} gemmes`, !targets.some((u) => u.id === sel))}
        ${btn('archive', 10, 'gems', s.tenPullGemCost, `×10 ${gem()} ${s.tenPullGemCost}`, `Archives ×10 : ${s.tenPullGemCost} gemmes`, !targets.some((u) => u.id === sel))}
      </div>
      ${ui.view.lastSummon && normalizePool(ui.view.summonPool) === 'archive' ? `<div class="summon-results">${ui.view.bannerResults ?? ''}</div>` : ''}
    </div>` : '';
  return `${main}${preview}${BANNER_RULES.enabled && (b || last) ? archives : ''}`;
}

// v9.2.5 (I) : vitrine — le compagnon en vedette en grand (illustration HD), nom, étoiles de rareté, rôle, compétence,
// taux augmenté, compteur de pitié et ×1 / ×10 mis en avant. Même tirage que la ligne Compagnons (bassin 'ally').
const RARITY_STARS = { common: 2, rare: 3, epic: 4, legendary: 5 };
function showcase(ui, state, f, pool, p, btn, results, oddsHtml) {
  const c = companionById(f.id) ?? f;
  const s = BALANCE.summon;
  const role = ROLES[COMPANION_ROLES[c.id]];
  const legend = summonOdds(pool).find((r) => r.rarity === 'legendary');
  const mine = legend?.units.find((u) => u.id === c.id);
  const base = legend && legend.units.length ? legend.chance / legend.units.length : 0;
  const owned = state.companions.owned[c.id];
  const leftL = s.pity.legendaryAfter - state.summon.sinceLegendary;
  const leftE = s.pity.epicAfter - state.summon.sinceEpic;
  const open = ui.view.summonOdds === pool;
  const parts = Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
  return `<div class="card summon-row vt banner-${pool}" style="--vt:${c.color ?? c.fx ?? '#f2c060'}">
    <div class="vt-bg" aria-hidden="true"><span class="vt-rays"></span><span class="vt-glow"></span><span class="vt-parts">${parts}</span></div>
    <div class="vt-stage">${hdArt(c, 'vt-art') || unitPortrait(f)}</div>
    <div class="vt-info">
      <div class="vt-ribbon">✦ En vedette · taux augmenté ✦</div>
      <div class="vt-name">${escapeHtml(c.name)}</div>
      <div class="vt-stars" aria-label="${rarityLabel(c.rarity)}">${'★'.repeat(RARITY_STARS[c.rarity] ?? 3)} <span class="vt-rar r-${c.rarity} rarity-text">${rarityLabel(c.rarity)}</span>${owned && !owned.trial ? ` <span class="vt-owned">obtenu ${stars(duplicates(owned))}</span>` : ''}</div>
      ${role ? `<div class="vt-role">${img(role.icon)}<span>${escapeHtml(role.label)}</span></div>` : ''}
      ${c.skill ? `<div class="vt-skill"><b>${escapeHtml(c.skill.name)}</b><span>${escapeHtml(c.skill.text ?? '')}</span></div>` : ''}
      <div class="vt-rate"><b class="num">${formatDecimal((mine?.chance ?? 0) * 100, 2)} %</b><span>${`par tirage (×${formatDecimal(base ? (mine?.chance ?? 0) / base : 1, 1)}) · ${Math.round(FEATURED_SHARE * 100)} % des Légendaires`}</span></div>
      <div class="vt-pity"><span>${`Légendaire garanti dans ${leftL}`}</span><small>${`Épique dans ${leftE}`}</small><span class="vt-bar"><i style="width:${Math.round(100 * (1 - leftL / s.pity.legendaryAfter))}%"></i></span></div>
    </div>
    <div class="vt-actions">
      <div class="summon-buttons vt-buttons">
        ${btn(pool, 1, 'gems', s.gemCost, `<span class="vt-x">×1</span> ${gem()} ${s.gemCost}`, `${p.label} ×1 : ${s.gemCost} gemmes`)}
        ${btn(pool, 10, 'gems', s.tenPullGemCost, `<span class="vt-x">×10</span> ${gem()} ${s.tenPullGemCost}`, `${p.label} ×10 : ${s.tenPullGemCost} gemmes`)}
      </div>
      <button class="btn small help-q${open ? ' active' : ''}" data-action="summon-odds" data-value="${pool}" aria-expanded="${open}" aria-label="Règles et probabilités : ${escapeHtml(p.label)}">?</button>
    </div>
    ${open ? `<div class="summon-odds vt-odds">${oddsHtml}</div>` : ''}
    ${results && normalizePool(ui.view.summonPool) === pool ? `<div class="summon-results vt-results">${results}</div>` : ''}
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
    const btn = (pool, count, currency, cost, label, aria, off = false) => {
      const missing = cost - state[currency];
      return `<button class="btn btn-gold" data-action="summon" data-value="${count}" data-currency="${currency}" data-pool="${pool}"
        aria-label="${escapeHtml(aria)}" title="${escapeHtml(missing > 0 ? `Il manque ${formatNumber(missing)} gemme${missing > 1 ? 's' : ''}` : aria)}" ${missing > 0 || off ? 'disabled' : ''}>${label}</button>`;
    };
    ui.view.bannerResults = results; // v9.1.3 (doc4 lot 5) : résultats sous la bannière ou les Archives
    // v9.2.5 (I) : la vitrine (Compagnons) passe en tête.
    const pools = Object.entries(s.pools).filter(([pool]) => pool !== 'banner' && pool !== 'archive');
    const rows = [...pools.filter(([k]) => k === 'ally'), ...pools.filter(([k]) => k !== 'ally')].map(([pool, p]) => {
      const legends = summonOdds(pool).find((r) => r.rarity === 'legendary')?.units.length ?? 0;
      const f = legends > 1 ? featuredUnit(pool) : null;
      if (pool === 'ally' && f) {
        return showcase(ui, state, f, pool, p, btn, results, `<p class="muted">Compagnons : ils combattent aux côtés du héros (2 places dans l'équipe). Compteur des garanties commun à toutes les invocations. Doublon : +1 étoile (max 5), puis +${s.duplicateRefundGems} gemmes.</p>${odds(pool)}`);
      }
      const what = pool === 'hero' ? `Apparences du héros : chacune change son allure et apporte un bonus (${navPath('looks')}).`
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
        ${pool === 'hero' ? `<button class="btn small look-link" data-action="open-looks">${img('icon_hero')} Mes apparences (${Object.keys(state.heroes.owned).length}) ›</button>` : ''}
        ${open ? `<div class="summon-odds"><p class="muted">${what} Compteur des garanties commun à toutes les invocations. Doublon : +1 étoile (max 5), puis +${s.duplicateRefundGems} gemmes.</p>
          ${odds(pool)}</div>` : ''}
        ${pool === 'hero' && f ? fold(ui, 'summon-banner', 'Apparence en vedette : détails', () => heroBanner(state)) : ''}
        ${results && normalizePool(ui.view.summonPool) === pool ? `<div class="summon-results">${results}</div>` : ''}
      </div>`;
    }).join('');
    const pity = `<div class="summon-pity" role="status">Épique dans <b>${s.pity.epicAfter - state.summon.sinceEpic}</b> · Légendaire dans <b>${s.pity.legendaryAfter - state.summon.sinceLegendary}</b></div>`;
    // v9.2.5 (I) : la vitrine porte déjà le compteur de pitié.
    return `${rows.includes('summon-row vt') ? '' : pity}${bannerBlock(ui, state, btn)}${rows}
      ${(state.summon.history ?? []).length ? fold(ui, 'summon-history', 'Historique', () => historyBlock(state)) : ''}`;
  },
};
