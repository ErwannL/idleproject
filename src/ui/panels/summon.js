// Invocation (v9.2.8 : document du producteur). Trois bannières séparées sur un écran, chacune avec ses taux, sa pity,
// sa garantie et sa monnaie : limitée (50/50 sur la vedette), permanente (wishlist de 5), familiers (tickets familiers
// seulement). Taux de base, taux moyen pity comprise, compteur, garantie et wishlist toujours visibles ; détails des
// unités derrière « ? ». Les apparences ne s'invoquent plus (Boutique › Skins).
import { BALANCE } from '../../data/balance.js';
import { BANNERS, COPIES, WALLET } from '../../data/economy.js';
import { bannerStats, canPay, featuredEnds, featuredUnit, normalizePool, permanentSsr, poolContext, summonCost, summonOdds } from '../../core/gacha.js';
import { companionById, duplicates } from '../../core/companions.js';
import { walletAmount } from '../../core/wallet.js';
import { COMPANION_ROLES, ROLES } from '../../data/synergies.js';
import { animCanvas } from '../animator.js';
import { escapeHtml, fold, formatDecimal, formatNumber, gem, hdArt, icon, img, stars } from '../common.js';
import { walletIcon } from './shop.js';

function unitPortrait(u) {
  const c = companionById(u.id);
  if (!c) return '';
  return c.kind === 'ally' ? animCanvas(`foe:${c.sprite}`, 64, 56, 1) : animCanvas(`pet:${c.sprite}`, 24, 24, 2);
}
const pct = (x, d = 1) => `${formatDecimal(x * 100, d)} %`;
const dateText = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const TICKET = { limited: 'ticketLimited', permanent: 'ticketPermanent', pet: 'ticketPet' };

// Boutons ×1 / ×10 pour une monnaie.
function payButtons(state, pool, currency) {
  const cost = (n) => summonCost(n, currency, BALANCE);
  const ico = currency === 'gems' ? gem() : walletIcon(currency);
  const b = (n) => {
    const ok = canPay(state, pool, n, currency);
    // v9.2.9 : singulier pour un coût de 1 (« 1 ticket limité », pas « 1 tickets limités »), traduit (en-929-stab.js).
    const many = currency === 'gems' ? 'gemmes' : WALLET[currency].short.toLowerCase();
    const name = cost(n) > 1 ? many : many.replace(/s\b/g, '');
    return `<button class="btn btn-gold" data-action="summon" data-value="${n}" data-currency="${currency}" data-pool="${pool}" ${ok ? '' : 'disabled'}
      aria-label="${escapeHtml(`×${n} : ${cost(n)} ${name}`)}"><span class="vt-x">×${n}</span> ${ico} ${formatNumber(cost(n))}</button>`;
  };
  return `<div class="summon-buttons">${b(1)}${b(10)}</div>`;
}

// Compteur et règles en une ligne (toujours visibles).
function pityLine(state, pool) {
  const banner = BANNERS[pool];
  const p = state.summon.pity[banner.pity];
  const left = banner.hard - p.ssr;
  const soft = p.ssr + 1 >= banner.softStart;
  const g = pool === 'limited'
    ? (p.guaranteed ? '<b class="good">Prochain Légendaire : la vedette (garantie)</b>' : '<span>Prochain Légendaire : une chance sur deux d\'être la vedette</span>')
    : '';
  return `<div class="eco-pity">
    <div class="eco-pity-row"><span>Légendaire garanti dans</span> <b class="num">${left}</b> <span>invocations</span>${soft ? ' <b class="eco-soft">Chances en hausse</b>' : ''}</div>
    <span class="vt-bar"><i style="width:${Math.round((100 * p.ssr) / banner.hard)}%"></i></span>
    <div class="eco-pity-row">${g ? `${g} · ` : ''}<span>Épique ou mieux dans</span> <b class="num">${banner.srEvery - p.sr}</b></div></div>`;
}

// v9.8 (C2) : la garantie en jauge avec un coffre ; taux et détails de la garantie derrière « ? ».
function pityGauge(state, pool) {
  const banner = BANNERS[pool];
  const p = state.summon.pity[banner.pity];
  const left = banner.hard - p.ssr;
  return `<div class="eco-gauge" title="Légendaire garanti dans ${left} invocations">
    <span class="vt-bar"><i style="width:${Math.round((100 * p.ssr) / banner.hard)}%"></i></span>${img('icon_chest')}<b class="num">${left}</b></div>`;
}

function ratesLine(pool) {
  const b = BANNERS[pool];
  const d = bannerStats(pool);
  return `<div class="eco-rates"><span class="r-legendary rarity-text">Légendaire : ${pct(b.rates.SSR, 1)}</span> · <span class="r-epic rarity-text">Épique : ${pct(b.rates.SR, 0)}</span> · <span>Rare : ${pct(1 - b.rates.SSR - b.rates.SR, 1)}</span>
    · <span>En moyenne, garantie comprise</span> <b class="num">${pct(d.consolidated, 2)}</b></div>`;
}

function rulesText(pool) {
  const b = BANNERS[pool];
  const curve = `Chances en hausse : à partir de la ${b.softStart}e invocation sans Légendaire, la chance monte jusqu'à 100 % à la ${b.hard}e (garanti). En moyenne : un Légendaire toutes les ${formatDecimal(bannerStats(pool).mean, 1)} invocations.`;
  const copies = `Copies : ${COPIES.max} au plus (${COPIES[pool === 'pet' ? 'petSteps' : 'steps'].map((s, i) => `${i + 1} : ${s}`).join(' · ')}). Au-delà : converti, jamais perdu.`;
  if (pool === 'limited') return [curve, 'Un Légendaire sur deux est la vedette. Si ce n\'est pas elle, le Légendaire suivant l\'est, garanti. Compteur et garantie gardés d\'une bannière limitée à la suivante.', 'Payable en tickets limités ou en gemmes.', copies];
  if (pool === 'permanent') return [curve, 'Favoris : chaque Légendaire en favori reçoit 20 % des Légendaires obtenus ; 5 favoris = toujours un de vos favoris. Les Légendaires limités n\'y entrent pas.', 'Payable en tickets permanents ou en gemmes.', copies];
  return [curve, 'Un Légendaire est toujours un familier Légendaire de la sélection.', 'Tickets de familier seulement (jamais de gemmes). Tickets sans expiration.', copies];
}

function oddsBlock(state, pool) {
  return `<div class="summon-odds">${rulesText(pool).map((t) => `<p class="muted">${escapeHtml(t)}</p>`).join('')}
    ${summonOdds(pool, BALANCE, Date.now(), state).map((r) => `<div class="odds-group r-${r.rarity}"><div class="row-between"><b class="rarity-text">${r.tier}</b><b class="num">${pct(r.chance, 2)}</b></div>
      <div class="odds-units">${r.units.map((u) => {
        const own = state.companions.owned[u.id];
        return `<div class="odds-unit${own ? ' owned' : ''}${u.featured ? ' featured-unit' : ''}">${unitPortrait(u)}<span class="odds-name">${escapeHtml(u.name)}</span>
          <span class="muted">${pct(u.chance, 3)}</span>${u.featured ? '<b class="gold-text">★</b>' : ''}${u.wished ? '<b class="good">♥</b>' : ''}${own && !own.trial ? stars(duplicates(own)) : ''}</div>`;
      }).join('')}</div></div>`).join('')}</div>`;
}

function resultsBlock(ui, pool) {
  if (!ui.view.lastSummon || normalizePool(ui.view.summonPool) !== pool) return '';
  return `<div class="summon-results">${ui.view.lastSummon.map((r) => `<div class="summon-result r-${r.rarity}${r.isNew ? ' new' : ''}">
    ${unitPortrait(r)}<span>${escapeHtml(r.name)}</span>
    ${r.isNew ? '<b class="good">NOUVEAU</b>' : r.overflow ? '<span class="muted">Converti</span>' : `<b class="gold-text">+1 copie</b> <small class="muted">Copies : ${duplicates({ stars: r.stars }) + 1} / 6</small>`}
    ${r.featured ? '<b class="gold-text">Vedette</b>' : r.lost ? '<span class="muted">Pas la vedette</span>' : ''}
    ${r.ultimateUnlocked ? '<b class="ult-new">Ultime débloquée</b>' : ''}</div>`).join('')}</div>`;
}

function walletChip(state, key) {
  return `<span class="eco-chip">${walletIcon(key)}<b class="num">${formatNumber(walletAmount(state, key))}</b></span>`;
}

function card(ui, state, pool, head, body) {
  const open = ui.view.summonOdds === pool;
  return `<div class="card summon-row eco-banner banner-${pool}">
    <div class="summon-row-head" style="background-image:linear-gradient(90deg,rgba(8,10,24,.78),rgba(8,10,24,.25)),url(assets/ui/art104/summon_head_${pool}.png)">${head}<span class="grow"></span>
      <button class="btn small help-q${open ? ' active' : ''}" data-action="summon-odds" data-value="${pool}" aria-expanded="${open}" aria-label="Règles et probabilités">?</button></div>
    ${body}
    ${pityGauge(state, pool)}
    ${pool === 'pet' ? '' : payButtons(state, pool, TICKET[pool])}
    ${pool === 'pet' ? payButtons(state, pool, 'ticketPet') : payButtons(state, pool, 'gems')}
    ${open ? `${ratesLine(pool)}${pityLine(state, pool)}${oddsBlock(state, pool)}` : ''}
    ${resultsBlock(ui, pool)}
  </div>`;
}

function limitedCard(ui, state) {
  const f = featuredUnit('limited');
  // v9.3.0 : sans bannière vedette active dans la config live, la bannière limitée reste ouverte sans vedette.
  if (!f) return card(ui, state, 'limited', `${img('icon_summon')}<b>Bannière limitée</b>${walletChip(state, 'ticketLimited')}`,
    '<div class="muted">Aucune vedette en ce moment. La prochaine sera annoncée ici.</div>');
  const c = companionById(f.id) ?? f;
  const role = ROLES[COMPANION_ROLES[c.id]];
  const owned = state.companions.owned[c.id];
  const body = `<div class="eco-feature" style="--vt:${c.fx ?? '#f2c060'}">
      <div class="eco-feature-art">${hdArt(c, 'vt-art') || unitPortrait(f)}</div>
      <div class="eco-feature-info"><div class="vt-ribbon">✦ Vedette ✦</div><div class="vt-name">${escapeHtml(c.name)}</div>
        <div><span class="r-legendary rarity-text">Légendaire</span> ${role ? `· ${escapeHtml(role.label)}` : ''}${owned && !owned.trial ? ` · ${stars(duplicates(owned))}` : ''}</div>
        <div class="muted"><span>Jusqu'au</span> ${dateText(featuredEnds() - 86400000)}</div></div></div>`;
  return card(ui, state, 'limited', `${img('icon_summon')}<b>Bannière limitée</b>${walletChip(state, 'ticketLimited')}`, body);
}

function permanentCard(ui, state) {
  const wish = state.summon.wishlist ?? [];
  const list = permanentSsr();
  const body = `<div class="eco-wish"><div class="muted"><span>Favoris</span> <b class="num">${wish.length}/${BANNERS.permanent.wishlistSize}</b> — <span>touche un Légendaire pour l'ajouter ou le retirer</span></div>
    <div class="eco-wish-row">${list.map((u) => `<button class="btn small eco-wish-btn${wish.includes(u.id) ? ' active' : ''}" data-action="wish-toggle" data-value="${u.id}" aria-pressed="${wish.includes(u.id)}">${unitPortrait(u)}<span>${escapeHtml(u.name)}</span></button>`).join('')}</div></div>`;
  return card(ui, state, 'permanent', `${img('icon_book')}<b>Bannière permanente</b>${walletChip(state, 'ticketPermanent')}`, body);
}

// v9.2.9 : bannière des familiers — les SSR du bassin (5 depuis la 9.2.9) en tête, avec l'illustration du premier
// SSR non possédé (sinon du premier) ; les étoiles des SSR possédés.
function petCard(ui, state) {
  const ssr = poolContext('pet', state).SSR.map((u) => companionById(u.id) ?? u);
  const lead = ssr.find((c) => !state.companions.owned[c.id] || state.companions.owned[c.id].trial) ?? ssr[0];
  const row = ssr.map((c) => {
    const own = state.companions.owned[c.id];
    return `<div class="eco-pet-ssr${own && !own.trial ? ' owned' : ''}">${unitPortrait(c)}<span>${escapeHtml(c.name)}</span></div>`;
  }).join('');
  const body = `${lead ? `<div class="eco-feature eco-pet-feature" style="--vt:#ffb03a">
      <div class="eco-feature-art">${hdArt(lead, 'vt-art') || unitPortrait(lead)}</div>
      <div class="eco-feature-info"><div class="vt-ribbon">✦ Légendaire ✦</div><div class="vt-name">${escapeHtml(lead.name)}</div>
        <div class="muted">${ssr.length} <span>familiers Légendaires dans la sélection</span></div></div></div>` : ''}
    <div class="eco-wish-row eco-pet-row">${row}</div>
    <div class="muted">Économie séparée : tickets familiers seulement, compteur à part.</div>`;
  return card(ui, state, 'pet', `${img('icon_paw')}<b>Familiers</b>${walletChip(state, 'ticketPet')}`, body);
}

// Fragments SSR universels : +1 exemplaire à un SSR possédé (jamais un déblocage, jamais au-delà de 6).
function fragmentBlock(state) {
  const n = walletAmount(state, 'ssrFragment');
  if (!n) return '';
  const owned = Object.entries(state.companions.owned).map(([id, o]) => ({ c: companionById(id), o })).filter(({ c, o }) => c?.kind === 'ally' && c.rarity === 'legendary' && !o.trial);
  return `<div class="card"><div class="section-title">${walletIcon('ssrFragment')} <span>Fragments Légendaires universels</span> <b class="num">${n}</b></div>
    <div class="muted">Une copie de plus pour un Légendaire déjà possédé (6 au plus).</div>
    <div class="eco-wish-row">${owned.length ? owned.map(({ c, o }) => `<button class="btn small" data-action="use-fragment" data-value="${c.id}" ${o.stars >= COPIES.max ? 'disabled' : ''}>${escapeHtml(c.name)} ${stars(duplicates(o))}</button>`).join('') : '<span class="muted">Aucun Légendaire possédé.</span>'}</div></div>`;
}

function historyBlock(state) {
  const h = state.summon.history ?? [];
  const rows = h.slice(0, 30).map((e) => {
    const c = companionById(e.id);
    if (!c) return '';
    const face = c.sprite ? `<img class="px" src="${icon(c.sprite, c.kind === 'ally' ? 1 : 2)}" alt="">` : '';
    return `<span class="hist r-${e.rarity}" title="${escapeHtml(c.name)}">${face}${escapeHtml(c.name)}</span>`;
  }).join('');
  return `<div class="hist-row">${rows}</div>`;
}

export default {
  id: 'summon',
  title: 'Invocation',
  icon: 'icon_summon',
  extra: (ui, state) => `${gem()}<b class="num">${formatNumber(state.gems)}</b>`,
  render(ui, state) {
    return `${limitedCard(ui, state)}${permanentCard(ui, state)}${petCard(ui, state)}${fragmentBlock(state)}
      ${(state.summon.history ?? []).length ? fold(ui, 'summon-history', 'Historique', () => historyBlock(state)) : ''}`;
  },
};

