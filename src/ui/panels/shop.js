import { merchantsHtml } from './inbox.js'; // v9.3.8
// v9.2.8 : Boutique (document du producteur, sections 11 à 17). Catégories, prix, contenu exact, limites, bonus de
// première acquisition, aperçu des cosmétiques. AUCUN paiement réel : chaque bouton d'achat dit « Bientôt disponible »
// tant qu'aucun fournisseur n'est branché (core/store.js) ; rien n'est donné sans reçu vérifié.
// Aussi : revenus du mois (tickets) et paliers de dépenses cumulées (cosmétiques seulement).
import { MONTHLY_TARGETS, SHOP_CATEGORIES, SKIN_TIERS, THEME_TIERS, WALLET } from '../../data/economy.js';
import { allOffers, offerContent, offerState, paymentReady, spendTiers } from '../../core/store.js';
import { incomeReport } from '../../core/income.js';
import { heroById } from '../../core/heroes.js';
import { themeById, themeSwatches } from '../themes.js';
import { escapeHtml, formatNumber, gem, img } from '../common.js';
import { walletAmount } from '../../core/wallet.js';

const shopUrl = (name, small) => `assets/ui/shop/${name}${small ? '_s' : ''}.png`;
export const shopIcon = (name, small = true, cls = '') => `<img class="shop-ico${small ? ' s' : ''}${cls ? ` ${cls}` : ''}" src="${shopUrl(name, small)}" alt="" draggable="false">`;
// Icône d'une monnaie de l'économie (planche du joueur, ou icône pixel du jeu).
export function walletIcon(key, small = true) {
  const w = WALLET[key];
  if (!w) return '';
  return w.icon ? shopIcon(w.icon, small, 'wallet-ico') : img(w.sprite, 'wallet-ico');
}

const euros = (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
const NAMES = { gems: 'gemmes', shards: 'éclats', keys: 'clés', fragments: 'fragments anciens' };
function contentLine(give) {
  return Object.entries(give).map(([k, v]) => {
    const ico = k === 'gems' ? gem() : WALLET[k] ? walletIcon(k) : img(k === 'shards' ? 'icon_shard' : k === 'keys' ? 'icon_key' : 'icon_fragment');
    return `<span class="shop-give">${ico}<b class="num">${formatNumber(v)}</b> <span>${escapeHtml(WALLET[k]?.short.toLowerCase() ?? NAMES[k] ?? k)}</span></span>`;
  }).join('');
}

function buyButton(offer, st) {
  if (st.reason === 'owned') return '<span class="shop-owned">Possédé ✓</span>';
  if (st.reason === 'limit') return '<button class="btn small" disabled>Limite du mois atteinte</button>';
  if (st.reason === 'active') return '<button class="btn small" disabled>Déjà actif</button>';
  // Pas de fournisseur : bouton désactivé « Bientôt disponible » (aucune transaction simulée).
  return paymentReady()
    ? `<button class="btn btn-gold small" data-action="buy-offer" data-value="${offer.id}">${euros(offer.price)}</button>`
    : `<button class="btn small shop-soon" disabled aria-label="${escapeHtml(`${euros(offer.price)} — Bientôt disponible`)}"><span class="num">${euros(offer.price)}</span> · <span>Bientôt disponible</span></button>`;
}

function offerCard(ui, state, offer) {
  const st = offerState(state, offer);
  const give = offerContent(state, offer);
  const tierName = offer.cat === 'skins' ? SKIN_TIERS[offer.tier]?.name : offer.cat === 'themes' ? THEME_TIERS[offer.tier]?.name : null;
  const cosmetics = [...(offer.skins ?? []).map((id) => heroById(id)?.name), ...(offer.themes ?? []).map((id) => `Thème ${themeById(id).name}`)].filter(Boolean);
  const preview = offer.cat === 'themes' || offer.cat === 'packs' && offer.themes?.length
    ? `<button class="btn tiny" data-action="theme-preview" data-value="${offer.themes[0]}">Aperçu du thème</button>` : '';
  const skinPrev = (offer.skins ?? []).length ? `<button class="btn tiny" data-action="look-preview" data-value="${offer.skins[0]}">Aperçu</button>` : '';
  const swatch = offer.cat === 'themes' ? `<span class="theme-swatches">${themeSwatches(offer.themes[0]).map((c) => `<i style="background:${c}"></i>`).join('')}</span>` : '';
  return `<div class="shop-card${st.owned ? ' owned' : ''}">
    ${shopIcon(offer.icon, false, 'shop-big')}
    <div class="shop-name">${escapeHtml(offer.name)}</div>
    ${tierName ? `<div class="muted shop-tier">${escapeHtml(tierName)}</div>` : ''}
    ${Object.keys(give).length ? `<div class="shop-content">${contentLine(give)}</div>` : ''}
    ${offer.daily ? `<div class="shop-content muted"><span>Puis chaque jour :</span> ${contentLine(offer.daily)}</div>` : ''}
    ${offer.days ? `<div class="muted"><span>Durée :</span> <b class="num">${offer.days}</b> <span>jours</span></div>` : ''}
    ${cosmetics.length && offer.cat === 'packs' ? `<div class="shop-content">${cosmetics.map((n) => `<span class="shop-give">${escapeHtml(n)}</span>`).join('')}</div>` : ''}
    ${swatch}
    ${st.first ? '<div class="shop-first">Bonus de première acquisition +100 % (une fois)</div>' : ''}
    ${st.limitLeft != null && !offer.days ? `<div class="muted"><span>Limite du mois :</span> <b class="num">${st.limitLeft}/${offer.limit}</b></div>` : ''}
    ${st.ownedSkins.length + st.ownedThemes.length && offer.cat === 'packs' ? '<div class="muted">Contient un cosmétique déjà possédé : non achetable.</div>' : ''}
    <div class="shop-actions">${skinPrev}${preview}${buyButton(offer, st)}</div>
  </div>`;
}

const GROUP_LABEL = { login: 'Connexion', missions: 'Missions', advanced: 'Boss et donjons', other: 'Piste du mois' };
function incomeBlock(state) {
  const rep = incomeReport(state);
  const keys = ['ticketLimited', 'ticketPermanent', 'ticketPet'];
  const rows = Object.entries(rep).map(([g, r]) => `<tr><th>${escapeHtml(GROUP_LABEL[g] ?? g)}</th>${keys.map((k) => `<td class="num">${r.cap[k] ? `${r.got[k] ?? 0}/${r.cap[k]}` : '—'}</td>`).join('')}</tr>`).join('');
  return `<div class="muted">Tickets gagnés ce mois-ci, par source, et plafond de chaque source. Les événements donnent le reste (objectif mensuel : ${MONTHLY_TARGETS.ticketLimited} limités, ${MONTHLY_TARGETS.ticketPermanent} permanents, ${MONTHLY_TARGETS.ticketPet} familiers).</div>
    <table class="eco-table"><tr><th></th>${keys.map((k) => `<th>${walletIcon(k)}</th>`).join('')}</tr>${rows}</table>
    <div class="muted">Les gemmes gardent leurs sources habituelles (combat, missions, piste du mois, connexion).</div>`;
}

function spendBlock(state) {
  return `<div class="muted">Récompenses de dépenses cumulées : cosmétiques seulement.</div>
    <div class="eco-tiers">${spendTiers(state).map((t) => `<span class="eco-tier${t.reached ? ' on' : ''}"><b class="num">${euros(t.cents)}</b> <span>${escapeHtml(t.reward)}</span></span>`).join('')}</div>`;
}

export default {
  id: 'shop',
  title: 'Boutique',
  icon: 'icon_gem',
  extra: (ui, state) => `${gem()}<b class="num">${formatNumber(state.gems)}</b> ${walletIcon('ticketLimited')}<b class="num">${walletAmount(state, 'ticketLimited')}</b> ${walletIcon('ticketPet')}<b class="num">${walletAmount(state, 'ticketPet')}</b>`,
  render(ui, state) {
    const cat = SHOP_CATEGORIES.some((c) => c.id === ui.view.shopCat) ? ui.view.shopCat : 'crystals';
    const tabs = `<div class="shop-cats" role="tablist">${SHOP_CATEGORIES.map((c) => `<button class="btn small${c.id === cat ? ' active' : ''}" role="tab" aria-selected="${c.id === cat}" data-action="shop-cat" data-value="${c.id}">${escapeHtml(c.name)}</button>`).join('')}</div>`;
    const offers = allOffers().filter((o) => o.cat === cat);
    const preview = ui.view.themePreview ? `<div class="card shop-preview"><span>Aperçu du thème</span> <b>${escapeHtml(themeById(ui.view.themePreview).name)}</b>
      <button class="btn small" data-action="theme-preview" data-value="">Revenir à mon thème</button></div>` : '';
    const note = paymentReady() ? '' : '<div class="shop-note">Achats bientôt disponibles : aucun paiement n\'est encore possible dans le jeu. Prix et contenus affichés à titre d\'information.</div>';
    const merchants = merchantsHtml(state); // v9.3.8 : les Marchands sont dans la Boutique
    return `${note}${preview}${merchants ? `<div class="card"><div class="section-title">Marchands</div>${merchants}</div>` : ''}${tabs}<div class="shop-grid">${offers.map((o) => offerCard(ui, state, o)).join('')}</div>
      <div class="card">${incomeBlock(state)}</div>
      ${(state.economy?.store?.spentCents ?? 0) > 0 ? `<div class="card">${spendBlock(state)}</div>` : ''}
      <div class="muted shop-foot">Cosmétiques : aucun bonus de puissance, achetés une fois pour toutes, équipables et retirables dans Profil › Apparences et Paramètres › Thème.</div>`;
  },
};
