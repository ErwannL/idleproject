import { merchantsHtml } from './inbox.js'; // v9.3.8
// v9.2.8 : Boutique (document du producteur, sections 11 à 17). Catégories, prix, contenu exact, limites, bonus de
// première acquisition, aperçu des cosmétiques. AUCUN paiement réel : chaque bouton d'achat dit « Bientôt disponible »
// tant qu'aucun fournisseur n'est branché (core/store.js) ; rien n'est donné sans reçu vérifié.
// Aussi : revenus du mois (tickets) et paliers de dépenses cumulées (cosmétiques seulement).
import { SHOP_CATEGORIES, SKIN_TIERS, THEME_TIERS, WALLET } from '../../data/economy.js';
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

// v10.6 (P2) : une image de 128 px par offre (PixelLab), à la place des icônes de 32 px.
const OFFER_ART = new Set(['sub_blessing', 'sub_pass', 'sub_premium', 'pack_discovery', 'pack_heroic', 'pack_legendary', 'pack_collection']);

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
    ${OFFER_ART.has(offer.id) ? `<img class="px shop-art106" src="assets/ui/art106/shop_${offer.id}.png" alt="">` : offer.cat === 'gems' ? '<img class="px shop-art106" src="assets/ui/art106/shop_gems.png" alt="">' : shopIcon(offer.icon, false, 'shop-big')}
    <div class="shop-name">${escapeHtml(offer.name)}</div>
    ${tierName ? `<div class="muted shop-tier">${escapeHtml(tierName)}</div>` : ''}
    ${Object.keys(give).length ? `<div class="shop-content">${contentLine(give)}</div>` : ''}
    ${(give.ticketLimited ?? give.ticketPet ?? 0) > 0 && (offer.cat === 'heroTickets' || offer.cat === 'petTickets') ? `<small class="muted shop-summons">= ${give.ticketLimited ?? give.ticketPet} invocations</small>` : ''}
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
// v10.0 (7) : tickets gagnés ce mois-ci — une ligne par source, avec sa progression (au lieu de 3 petites icônes).
function incomeBlock(state) {
  const rep = incomeReport(state);
  const keys = ['ticketLimited', 'ticketPermanent', 'ticketPet'];
  const rows = [];
  for (const [g, r] of Object.entries(rep)) for (const k of keys) {
    if (!r.cap[k]) continue;
    const got = r.got[k] ?? 0, cap = r.cap[k];
    rows.push(`<div class="inc-row">${walletIcon(k)}<span class="inc-name">${escapeHtml(GROUP_LABEL[g] ?? g)} · ${escapeHtml(WALLET[k]?.short ?? k)}</span>
      <span class="inc-bar"><i style="width:${Math.min(100, (got / cap) * 100)}%"></i></span><b class="num">${got}/${cap}</b></div>`);
  }
  if (!rows.length) return '';
  return `<div class="section-title">Tickets gagnés ce mois-ci</div>${rows.join('')}
    <div class="muted small-note">Les événements donnent le reste. Les gemmes gardent leurs sources habituelles.</div>`;
}

function spendBlock(state) {
  return `<div class="muted">Récompenses de dépenses cumulées : cosmétiques seulement.</div>
    <div class="eco-tiers">${spendTiers(state).map((t) => `<span class="eco-tier${t.reached ? ' on' : ''}"><b class="num">${euros(t.cents)}</b> <span>${escapeHtml(t.reward)}</span></span>`).join('')}</div>`;
}

export default {
  id: 'shop',
  title: 'Boutique',
  icon: 'icon_gem',
  // v10.4 (partie 7) : l'illustration de tête change avec la catégorie ouverte (assets/ui/art104/shop_cat_*.png).
  banner: (ui) => `assets/ui/art104/shop_cat_${[...SHOP_CATEGORIES.map((c) => c.id), 'merchants'].includes(ui.view.shopCat) ? ui.view.shopCat : 'crystals'}.png`,
  extra: (ui, state) => `${gem()}<b class="num">${formatNumber(state.gems)}</b> ${walletIcon('ticketLimited')}<b class="num">${walletAmount(state, 'ticketLimited')}</b> ${walletIcon('ticketPet')}<b class="num">${walletAmount(state, 'ticketPet')}</b>`,
  render(ui, state) {
    // v9.11 (9) : Marchands dans leur propre onglet (plus répétés sous chaque liste).
    const CATS = [...SHOP_CATEGORIES, { id: 'merchants', name: 'Marchands' }];
    const cat = CATS.some((c) => c.id === ui.view.shopCat) ? ui.view.shopCat : 'crystals';
    const tabs = `<div class="shop-cats" role="tablist">${CATS.map((c) => `<button class="btn small${c.id === cat ? ' active' : ''}" role="tab" aria-selected="${c.id === cat}" data-action="shop-cat" data-value="${c.id}">${escapeHtml(c.name)}</button>`).join('')}</div>`;
    const offers = allOffers().filter((o) => o.cat === cat);
    const preview = ui.view.themePreview ? `<div class="card shop-preview"><span>Aperçu du thème</span> <b>${escapeHtml(themeById(ui.view.themePreview).name)}</b>
      <button class="btn small" data-action="theme-preview" data-value="">Revenir à mon thème</button></div>` : '';
    const note = paymentReady() ? '' : '<div class="shop-note">Achats bientôt disponibles : aucun paiement n\'est encore possible dans le jeu. Prix et contenus affichés à titre d\'information.</div>';
    const merchants = merchantsHtml(state); // v9.3.8 : les Marchands sont dans la Boutique
    // v9.10 (8) : les offres illustrées d'abord ; Marchands ensuite ; le texte d'information en petit, en bas.
    if (cat === 'merchants') return `${preview}${tabs}<div class="card">${merchants || '<div class="state-empty">Aucun marchand de passage pour le moment : ils apparaissent pendant tes combats.</div>'}</div>`;
    return `${preview}${tabs}<div class="shop-grid">${offers.map((o) => offerCard(ui, state, o)).join('')}</div>
      ${incomeBlock(state) ? `<div class="card">${incomeBlock(state)}</div>` : ''}
      ${(state.economy?.store?.spentCents ?? 0) > 0 ? `<div class="card">${spendBlock(state)}</div>` : ''}
      ${note ? note.replace('class="shop-note"', 'class="shop-note small-note"') : ''}
      <div class="muted shop-foot">Cosmétiques : aucun bonus de puissance, achetés une fois pour toutes, équipables et retirables dans Profil › Apparences et Paramètres › Thème.</div>`;
  },
};
