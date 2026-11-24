// Équipement (v10.3, partie 8) : une fenêtre qu'on comprend du premier coup. En haut « Tes ressources » ; à gauche le
// héros et les compagnons de l'équipe en portraits ; au centre le personnage en grand et ses places à toucher ; à droite
// la fiche de l'objet, toujours visible (feuille du bas sur téléphone) ; dessous, le sac en cartes carrées.
// Les règles restent dans core/ (inventory, forge, companion-gear) : ce fichier ne fait que montrer.
import { BALANCE } from '../../data/balance.js';
import { BOSSES } from '../../data/enemies.js';
import { HERO_SLOTS, eqSlot } from '../../data/items.js';
import * as bastion from '../../core/bastion.js';
import { companionById, companionMultiplier } from '../../core/companions.js';
import { bestGearFor, unitGear, wearerOf, wornItems } from '../../core/companion-gear.js';
import { upgradePreview } from '../../core/forge.js';
import { bestPerSlot, heroGains, listInventory, quickEquipPlan } from '../../core/inventory.js';
import { itemBase, rarityById } from '../../core/loot.js';
import { MUSEUM, MUSEUM_PIECES, museumCount, museumDuplicates, museumEffects } from '../../core/museum.js';
import { computeHeroStats } from '../../core/stats.js';
import { invFeatureOpen } from '../../core/unlocks.js';
import { itemIconUrl } from '../../render/pixel.js';
import { effectText, escapeHtml, fold, icon, img, itemFrame } from '../common.js';
import { isPhoneView, phoneAfter, phoneView } from './equip-phone.js'; // v10.12 : version téléphone (kit mobile)
import { deskView } from './equip-desk.js'; // v10.13 : version PC (trois colonnes, style de la Forge)

export function visibleItems(state) {
  return listInventory(state, { slot: state.ui.slotFilter, sortBy: state.ui.sortBy, rarity: state.ui.rarityFilter ?? 'all' });
}

// ---------------------------------------------------------------------------------------------------------------
// Personnages : le héros puis les compagnons de l'équipe (les familiers ne portent rien).
const teamOf = (state) => (state.companions?.equipped ?? []).map((id) => companionById(id)).filter((c) => c?.kind === 'ally');
export const unitPower = (state, c) => Math.round(100 * companionMultiplier(state, c.id));
// Une amélioration est possible (pastille rouge « ! ») : meilleur objet, renforcement payable, compétence payable.
export function heroTodo(state, plan) {
  return plan.changes.length > 0 || Object.values(state.equipment).some((it) => it && upgradePreview(state, it).canPay);
}

// Raccourcis du Bastion (partie 10) : chantiers visibles et accessibles depuis l'équipement.
export function bastionShortcuts(state) {
  if (!bastion.bastionOpen(state)) return '';
  const list = bastion.bastionShortcuts?.(state, Date.now()) ?? [];
  if (!list.length) return '';
  return `<div class="eq-shorts" role="group" aria-label="Bastion">${list.map((s) => `<button class="eq-short${s.ready ? ' ready' : ''}" data-action="bastion-open" data-value="${escapeHtml(s.id)}" title="${escapeHtml(s.label)}">
    <b>${escapeHtml(s.label)}</b><span class="num">${s.busy}/${s.total}</span></button>`).join('')}</div>`;
}

// Musée (v9.0) : une vitrine par objet ancestral, bonus permanent par pièce exposée.
export function museumView(ui, state) {
  const auto = state.ui.autoMuseum !== false;
  const pct = (v) => `+${v} %`;
  const per = MUSEUM.perPiece;
  const cases = MUSEUM_PIECES.map((baseId) => {
    const base = itemBase(baseId);
    const item = state.museum[baseId];
    const boss = BOSSES[base.signature];
    const frame = item
      ? `${itemFrame(item, { tag: 'div' })}<button class="btn tiny" data-action="from-museum" data-value="${baseId}" title="Reprendre dans le sac">↩</button>`
      : `<div class="item-frame empty museum-ghost"><img class="px" src="${itemIconUrl({ baseId, rarity: 'common', slot: base.slot })}" alt=""></div>`;
    return `<div class="card museum-case${item ? ` r-${item.rarity}` : ' empty'}">
      <div class="mq-slot">${frame}</div>
      <div class="grow"><b>${escapeHtml(base.name)}</b>
        <div class="muted">${item ? `${rarityById(item.rarity).label} · niv. ${item.level}${item.rarity === 'legendary' ? ' · bonus ×2' : ''}` : `Butin de ${escapeHtml(boss?.name ?? '?')}`}</div></div></div>`;
  }).join('');
  const n = museumCount(state);
  const dupes = museumDuplicates(state).length;
  const total = effectText(museumEffects(state));
  // v9.1.3 (lot F, « Musée en possession », option sans migration) : l'exposition auto reste activée par défaut et
  // fait le travail ; le réglage, « Exposer tout » et les doublons sont repliés dans « Outils du Musée ».
  // La version « modèle obtenu + meilleure rareté » n'est pas faite : voir docs/refontes-v913.md.
  const tools = fold(ui, 'museum-tools', 'Outils du Musée', () => `<div class="row-between">
      <button class="btn chip-btn small${auto ? ' active' : ''}" data-action="auto-museum" title="Les objets ancestraux ramassés vont dans leur vitrine si elle est vide ou s'ils sont meilleurs (l'ancien retourne au sac)">${auto ? 'Exposition auto : activée' : 'Exposition auto : désactivée'}</button>
      <button class="btn btn-gold small" data-action="expose-all" title="Expose les objets ancestraux du sac et de la Réserve (pas ceux que porte le héros)">Exposer tout (sac + Réserve)</button>
      ${dupes ? `<button class="btn btn-danger small" data-action="recycle-museum-dupes" title="Objets ancestraux du sac moins bons que l'exemplaire exposé (les verrouillés sont gardés)">Recycler les doublons (${dupes})</button>` : ''}</div>
      ${dupes ? `<div class="muted">${dupes} objet${dupes > 1 ? 's' : ''} ancestra${dupes > 1 ? 'ux' : 'l'} du sac ${dupes > 1 ? 'sont des doublons' : 'est un doublon'} : la vitrine expose déjà un exemplaire au moins aussi bon. Les objets ancestraux ne sont jamais recyclés automatiquement.</div>` : ''}`,
  { extra: !auto ? '<span class="muted">auto désactivée</span>' : dupes ? `<span class="muted">${dupes} doublon${dupes > 1 ? 's' : ''}</span>` : '' });
  return `<div class="card"><span class="muted">Le Musée expose tes objets ancestraux, un par vitrine, dès qu'ils sont ramassés. Chaque pièce exposée :
      dégâts, PV et or ${pct(per.damageMultPct)} (multiplicatif, ×2 si Légendaire). Collection complète : dégâts et PV +${MUSEUM.complete.damageMultPct} % de plus.
      Une pièce exposée n'est pas portée : reprends-la (↩) pour l'équiper.</span>
      <div class="museum-total"><b>${n}/${MUSEUM_PIECES.length}</b> pièces exposées${n && total ? ` · <span class="good">${total}</span>` : ''}</div>
      ${tools}</div>
    <div class="museum">${cases}</div>`;
}

export default {
  id: 'inventory',
  title: 'Équipement',
  icon: 'icon_bag',
  extra: () => '',
  // Téléphone : la rangée des personnages se centre et le glissé change de place. PC (equip-desk.js) : rien à repositionner.
  afterRender(ui, body) {
    if (isPhoneView(ui)) { phoneAfter(ui, body); return; } // v10.12 : téléphone (kit mobile)
  },
  render(ui, state) {
    const v = ui.view;
    const open = (id) => invFeatureOpen(state, id);
    const invTab = v.invTab === 'stash' && open('stash') ? 'stash' : 'bag';
    const team = teamOf(state);
    const st = computeHeroStats(state);
    const gains = heroGains(state, BALANCE, st);
    const best = bestPerSlot(state, BALANCE, gains);
    const plan = quickEquipPlan(state, BALANCE, gains);
    // Objet choisi : celui qu'on a touché (sac ou place) ; à défaut le premier objet porté, sinon la première place.
    const all = [...state.inventory, ...Object.values(state.equipment).filter(Boolean), ...wornItems(state)];
    let item = all.find((i) => i.id === v.selectedItemId) ?? null;
    let who = team.some((c) => c.id === v.gearWho) ? v.gearWho : 'hero';
    if (item) { // un objet porté montre son porteur
      const w = wearerOf(state, item.id);
      if (w && team.some((c) => c.id === w)) who = w;
      else if (Object.values(state.equipment).some((i) => i?.id === item.id)) who = 'hero';
    }
    const unit = who === 'hero' ? null : companionById(who);
    const worn = unit ? unitGear(state, unit.id) : state.equipment;
    const slotKeys = unit ? Object.keys(worn) : Object.keys(HERO_SLOTS);
    let slot = null;
    if (!item) {
      if (slotKeys.includes(v.eqSlot)) { item = worn[v.eqSlot] ?? null; if (!item) slot = v.eqSlot; }
      else { const first = slotKeys.find((s) => worn[s]); if (first) item = worn[first]; else slot = slotKeys[0]; }
    }
    const phone = isPhoneView(ui);
    const TABS = phone ? (unit ? [['gear', 'Équipement'], ['up', 'Améliorer'], ['stars', 'Étoiles'], ['skills', 'Compétences']] : [['gear', 'Équipement'], ['up', 'Améliorer'], ['reforge', 'Reforger'], ['sets', 'Sets']])
      : unit ? [['gear', 'Équipement'], ['stars', 'Étoiles'], ['skills', 'Compétences']] : [['gear', 'Équipement'], ['sets', 'Sets']]; // v10.13 : PC = trois colonnes (equip-desk.js) ; la vue d'ensemble est dans la colonne du personnage
    const tab = TABS.some(([id]) => id === v.eqTab) ? v.eqTab : 'gear';
    const unitIds = new Set(unit ? bestGearFor(state, unit.id) : []);
    const unitSlots = new Set([...state.inventory, ...(state.stash ?? [])].filter((i) => unitIds.has(i.id)).map((i) => eqSlot(i)));
    const ctx = { who, unit, team, order: ['hero', ...team.map((c) => c.id)], st, gains, best, plan, sel: { item, slot }, tab, unitIds, unitSlots };
    if (phone) return phoneView(ui, state, { ...ctx, item, slot, invTab }); // v10.12 : téléphone = kit mobile (equip-phone.js)
    return deskView(ui, state, { ...ctx, item, slot, invTab }); // v10.13 : PC = trois colonnes dans un cadre (equip-desk.js)
  },
};
