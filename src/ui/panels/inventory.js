// Inventaire en 3 zones (équipement porté · fiche de l'objet · grille) et Forge.
import { canEquip, classById, weaponClass } from '../../core/classes.js';
import { companionById } from '../../core/companions.js';
import { BALANCE } from '../../data/balance.js';
import { BOSSES } from '../../data/enemies.js';
import { ACCESSORY_SLOTS, GEAR_SLOTS, RARITIES, SLOTS, STAT_LABELS } from '../../data/items.js';
import { formatStat } from '../../core/format.js';
import { canReforge, craftCost, fusionGroups, fusionKeep, maxUpgrades, sharpenCost, upgradeCost } from '../../core/forge.js';
import { KEEP_AFFIX_LABELS, bulkRecycleCandidates, isUpgrade, listInventory, RECYCLE_MODES, recycleRules } from '../../core/inventory.js';
import { itemBase, rarityById, recycleMaterials, recycleValue } from '../../core/loot.js';
import { computeHeroStats, statsWithItem } from '../../core/stats.js';
import { slotIconName } from '../../render/pixel.js';
import {
  affixText, coin, costButton, effectText, escapeHtml, fold, formatDecimal, formatNumber, img, itemFrame, rarityLabel, segment, shard,
} from '../common.js';
import { navPath } from '../nav.js';
import { setById, setCounts } from '../../core/sets.js';
import { ITEM_SETS, SET_PIECES } from '../../data/sets.js';
import { STASH_SIZE, stashSets } from '../../core/stash.js';
import { MUSEUM, MUSEUM_PIECES, isMuseumDuplicate, museumCount, museumDuplicates, museumEffects } from '../../core/museum.js';
import { itemIconUrl } from '../../render/pixel.js';
import { animCanvas } from '../animator.js';
import { invFeatureOpen, nextInvUnlock } from '../../core/unlocks.js';

const STAT_ICONS = { damage: 'weapon_sword', attackSpeed: 'icon_bolt', maxHp: 'icon_heart', armor: 'icon_shield' };
const SORT_LABELS = { rarity: 'Rareté', level: 'Niveau', power: 'Puissance', recent: 'Récent' };

export function visibleItems(state) {
  return listInventory(state, { slot: state.ui.slotFilter, sortBy: state.ui.sortBy });
}

// v8.4 : les accessoires comptent aussi pour leurs effets (or, butin, critique, épines, dégâts contre les boss…).
const BONUS_ROWS = {
  goldPct: ['Or', ' %'], dropChance: ['Chance de butin', ' pts'], xpPct: ['XP', ' %'], critChance: ['Coup critique', ' %'],
  damageVsBossPct: ['Dégâts contre les boss', ' %'], damageVsNormalPct: ['Dégâts contre les ennemis', ' %'],
  lifesteal: ['Vol de vie', ' %'], thorns: ['Épines', ' %'], regenPct: ['Régénération', ' %/s'], attackSpeedPct: ['Vitesse d\'attaque', ' %'],
  skillCooldownPct: ['Recharge des compétences', ' %'], lowHpArmor: ['Armure sous 30 % PV', ' %'],
};
function bonusRows(a, b, row) {
  return Object.entries(BONUS_ROWS).filter(([k]) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) > 1e-6)
    .map(([k, [label, unit]]) => row(label, a[k] ?? 0, b[k] ?? 0, (v) => formatDecimal(v), unit)).join('');
}

function detail(ui, state, item) {
  const rarity = rarityById(item.rarity);
  const base = itemBase(item.baseId);
  const isEquipped = state.equipment[item.slot]?.id === item.id;
  const stats = Object.entries(item.stats).map(([k, v]) => `<li>${img(STAT_ICONS[k])}${STAT_LABELS[k]}
    <b class="num ${v < 0 ? 'bad' : 'good'}">${formatStat(k, v, true)}</b></li>`).join('');
  const affixes = (item.affixes ?? []).map((a) => `<li class="affix">✦ ${affixText(a)}</li>`).join('');

  let compare = '';
  if (!isEquipped) {
    const cur = computeHeroStats(state);
    const next = statsWithItem(state, item);
    // Héros actuel → héros avec cet objet (à la place de l'objet porté), et la différence.
    const row = (label, a, b, fmt, unit = '') => {
      const diff = b - a;
      if (Math.abs(diff) < 0.001) return ''; // v9.1.0 : seules les lignes qui changent
      const cls = Math.abs(diff) < 0.001 ? 'muted' : diff > 0 ? 'good' : 'bad';
      const arrow = Math.abs(diff) < 0.001 ? '•' : diff > 0 ? '▲' : '▼';
      return `<div class="compare-row"><span>${label}</span><span class="num muted">${fmt(a)}${unit} → ${fmt(b)}${unit}</span>
        <span class="num ${cls}">${diff > 0 ? '+' : ''}${fmt(diff)}${unit} ${arrow}</span></div>`;
    };
    const current = state.equipment[item.slot];
    const int = (v) => formatNumber(Math.round(v));
    const rows = [row('Dégâts/s', cur.dps, next.dps, (v) => formatDecimal(v)),
      row('Dégâts', cur.damage, next.damage, int),
      row('Attaques / s', cur.attacksPerSecond, next.attacksPerSecond, (v) => formatDecimal(v, 2)),
      row('PV max', cur.maxHp, next.maxHp, int),
      row('Armure', cur.armor, next.armor, (v) => formatDecimal(v), ' %'),
      bonusRows(cur.bonus, next.bonus, row)].join('');
    compare = `<div class="compare"><div class="section-title">Si vous l'équipez${current ? ` (à la place de ${escapeHtml(current.name)})` : ' (emplacement vide)'}</div>
      ${rows || '<div class="muted">Aucun changement.</div>'}
    </div>`;
  }
  const mats = recycleMaterials(item);
  // v9.1.3 : verrou en icône dans l'en-tête de la fiche (plus de grand bouton texte).
  const lock = `<button class="btn icon-btn lock-btn${item.locked ? ' on' : ''}" data-action="lock" data-id="${item.id}" aria-pressed="${item.locked}"
      aria-label="${item.locked ? 'Déverrouiller' : 'Verrouiller'}" title="${item.locked ? 'Verrouillé : jamais recyclé ni fusionné (appuyer pour déverrouiller)' : 'Verrouiller : jamais recyclé ni fusionné'}">${img('icon_lock')}</button>`;
  const sharpen = sharpenCost(state, item);
  // Amélioration : +12 % sur une statistique au hasard, 5 fois (Commun, Rare) ou 10 fois (Épique, Légendaire).
  const ups = item.upgrades ?? 0;
  const maxUp = maxUpgrades(item);
  const upCost = upgradeCost(item);
  // Boutons toujours aux mêmes places, quel que soit l'objet : ceux qui ne s'appliquent pas sont grisés.
  const upgradeBtn = ups >= maxUp
    ? `<button class="btn btn-gold" disabled>Renforcement maximal (+${maxUp})</button>`
    : `<button class="btn btn-gold num" data-action="upgrade-item" data-id="${item.id}" data-cost="${upCost.gold}" data-currency="gold"
        ${state.materials.shards < upCost.shards ? 'data-locked="1" disabled' : state.gold < upCost.gold ? 'disabled' : ''}
>Renforcer +${ups + 1} ${coin()} ${formatNumber(upCost.gold)} ${shard()} ${upCost.shards}</button>`;
  const sharpenBtn = sharpen
    ? costButton({ action: 'sharpen', cost: sharpen, have: state.materials.shards, currency: 'shards', attrs: `data-id="${item.id}"`, cls: 'small', label: `Réaffûter niv. ${state.maxStage} ` })
    : '<button class="btn small" disabled>Réaffûter (déjà au niveau)</button>';
  const reforgeBtn = `<button class="btn small" data-action="reforge" data-id="${item.id}"
      ${!canReforge(item) || state.materials.shards < BALANCE.forge.reforgeShards ? 'disabled' : ''}
>${canReforge(item) ? 'Relancer les effets' : 'Aucun effet à relancer'} ${shard()}${BALANCE.forge.reforgeShards}</button>`;
  // v9.1.0 : toujours visibles (même dans la fiche du téléphone) : Équiper et Recycler (le verrou est dans l'en-tête).
  const actions = `<div class="action-grid main-actions">
      ${isEquipped ? '<button class="btn btn-primary" disabled>Équipé</button>' : canEquip(state, item)
        ? `<button class="btn btn-primary primary-action" data-action="equip" data-id="${item.id}">Équiper</button>`
        : `<button class="btn" disabled>Arme de ${escapeHtml(weaponClass(item.baseId).name)}</button>`}
      <button class="btn btn-outline-gold" data-action="recycle" data-id="${item.id}" ${item.locked || isEquipped ? 'disabled' : ''}>Recycler +${formatNumber(recycleValue(item))} ${coin()}${mats.shards ? ` +${mats.shards}${shard()}` : ''}</button>
    </div>
    ${!isEquipped && !canEquip(state, item) ? `<div class="muted">Changez de classe pour la porter : ${navPath('hero', 'Classe')}.</div>` : ''}`;
  // v9.1.3 (doc1 « Équipement : Fiche ») : trois onglets au lieu d'un long repli « Détails ».
  const tab = ['compare', 'upgrade', 'store'].includes(ui.view.itemTab) ? ui.view.itemTab : 'compare';
  const tabs = `<div class="item-tabs" role="tablist">${[['compare', 'Comparer'], ['upgrade', 'Améliorer'], ['store', 'Ranger']].map(([k, l]) => `<button class="btn chip-btn small${k === tab ? ' active' : ''}"
      role="tab" aria-selected="${k === tab}" data-action="item-tab" data-value="${k}">${l}</button>`).join('')}</div>`;
  const stash = state.stash.length >= STASH_SIZE;
  let body;
  if (tab === 'upgrade') {
    body = `<div class="upgrade-line">${upgradeBtn}<span class="muted num">${ups}/${maxUp}</span></div>
      <div class="muted">Renforcer : une statistique au hasard +${BALANCE.forge.upgradeBoostPct} %.</div>
      <div class="tool-line">${sharpenBtn}<span class="muted">Remonte l'objet au niveau de votre étape max.</span></div>
      <div class="tool-line">${reforgeBtn}<span class="muted">Change les effets spéciaux au hasard.</span></div>`;
  } else if (tab === 'store') {
    body = isEquipped ? '<div class="muted">Un objet porté ne se range pas : retirez-le d\'abord en équipant un autre objet.</div>'
      : `<div class="tool-line"><button class="btn small" data-action="to-stash" data-id="${item.id}" ${stash ? 'disabled' : ''}>Ranger au coffre (${state.stash.length}/${STASH_SIZE})</button>
        <span class="muted">Jamais recyclé ni fusionné.</span></div>
      ${base.signature ? `<div class="tool-line"><button class="btn small btn-gold" data-action="to-museum" data-id="${item.id}">Exposer au Musée</button></div>` : ''}`;
  } else {
    body = `${compare}<ul class="stat-list">${stats}${affixes}</ul>${setBlock(state, item)}`;
  }
  return `<div class="card item-detail r-${item.rarity} sheet${ui.view.sheetOpen === 'item' ? ' sheet-open' : ''}">
    <button class="btn small sheet-close" data-action="close-sheet" aria-label="Fermer la fiche">✕</button>
    <div class="detail-head">${itemFrame(item, { tag: 'div' })}
      <div class="grow"><div class="item-name">${escapeHtml(item.name)}${ups ? ` <span class="plus-lv">+${ups}</span>` : ''}</div>
        <div class="item-sub">${SLOTS[item.slot]} · <span class="rarity-text">${rarity.label}</span> · niv. ${item.level}</div>
        <div class="tags">${isEquipped ? '<span class="equipped-tag">Équipé</span>' : ''}
        ${base.signature ? `<span class="signature-tag">Objet ancestral · butin de ${escapeHtml(BOSSES[base.signature].name)}</span>` : ''}
        ${isMuseumDuplicate(state, item) ? '<span class="tag-dupe">Doublon du Musée</span>' : ''}</div></div>${lock}</div>
    ${actions}
    ${tabs}
    <div class="item-tab-body">${body}</div>
  </div>`;
}

// Ensemble d'équipement (v8.5) : pièces portées et paliers de bonus.
function setBlock(state, item) {
  const set = setById(item.set);
  if (!set) return '';
  const worn = setCounts(state.equipment)[set.id] ?? 0;
  const tiers = SET_PIECES.map((n) => `<li class="${worn >= n ? 'good' : 'muted'}">${n} pièces : ${effectText(set.bonuses[n])}</li>`).join('');
  return `<div class="set-block" style="--set:${set.color}"><div class="section-title">Ensemble : <b style="color:${set.color}">${img(`set_${set.id}`)} ${escapeHtml(set.name)}</b>
      <span class="muted">${worn}/${SET_PIECES.at(-1)} portées</span></div><ul class="set-tiers">${tiers}</ul></div>`;
}

// Coffre (v8.9) : 300 places, jamais recyclé ni fusionné automatiquement.
function stashView(ui, state) {
  // v9.1.3 (lot F) : mannequins fondus dans le coffre — filtre Ensemble et « Porter » (meilleure pièce par emplacement).
  const sets = stashSets(state);
  const setId = sets.some((x) => x.setId === ui.view.stashSet) ? ui.view.stashSet : null;
  const pool = setId ? state.stash.filter((i) => i.set === setId) : state.stash;
  const items = [...pool].sort((a, b) => rarityById(b.rarity).statMultiplier - rarityById(a.rarity).statMultiplier || b.level - a.level);
  const sel = items.find((i) => i.id === ui.view.stashSel) ?? items[0];
  const grid = items.map((i) => itemFrame(i, { selected: i.id === sel?.id, action: 'stash-sel' })).join('');
  const detail = sel ? `<div class="card item-detail r-${sel.rarity}">
      <div class="detail-head">${itemFrame(sel, { tag: 'div' })}<div><div class="item-name">${escapeHtml(sel.name)}</div>
        <div class="item-sub">${SLOTS[sel.slot]} · <span class="rarity-text">${rarityById(sel.rarity).label}</span> · niv. ${sel.level}</div></div></div>
      <div class="detail-actions main-actions"><button class="btn btn-primary primary-action" data-action="from-stash" data-id="${sel.id}" ${state.inventory.length >= BALANCE.loot.inventorySize ? 'disabled' : ''}>Reprendre au sac</button></div>
      ${state.inventory.length >= BALANCE.loot.inventorySize ? '<div class="bad">Sac plein.</div>' : ''}
      ${fold(ui, 'stash-details', 'Détails', () => `<ul class="stat-list">${Object.entries(sel.stats).map(([k, v]) => `<li>${STAT_LABELS[k]} <b class="num">${formatStat(k, v, true)}</b></li>`).join('')}${(sel.affixes ?? []).map((a) => `<li class="affix">✦ ${affixText(a)}</li>`).join('')}</ul>
        ${setBlock(state, sel)}`)}</div>` : '';
  const auto = state.ui.autoMannequin !== false;
  const filter = sets.length ? `<div class="row stash-sets"><select data-action="stash-set" aria-label="Ensemble">
      <option value="">Tous les objets (${state.stash.length})</option>
      ${sets.map((x) => `<option value="${x.setId}" ${x.setId === setId ? 'selected' : ''}>${escapeHtml(setById(x.setId).name)} (${x.slots}/${Object.keys(SLOTS).length})</option>`).join('')}</select>
      ${setId ? `<button class="btn btn-gold small" data-action="wear-set" data-value="${setId}" title="Équipe la meilleure pièce de chaque emplacement ; l'objet porté prend sa place au coffre">Porter</button>` : ''}</div>` : '';
  const set = setId ? setById(setId) : null;
  const tiers = set ? `<div class="mq-tiers muted">${SET_PIECES.map((p) => `<span>${p} : ${effectText(set.bonuses[p])}</span>`).join(' · ')}</div>` : '';
  const over = state.stash.length > STASH_SIZE ? `<div class="bad">Coffre au-delà de ${STASH_SIZE} (pièces des anciens mannequins) : rien n'est perdu, mais rien n'y entre tant qu'il n'est pas redescendu.</div>` : '';
  return `<div class="muted">Le coffre garde ${STASH_SIZE} objets de plus que le sac, <b>jamais recyclés ni fusionnés</b>. Les pièces d'ensemble meilleures y vont d'elles-mêmes.
      <button class="btn chip-btn small${auto ? ' active' : ''}" data-action="auto-mannequin" title="Une pièce d'ensemble ramassée, meilleure que la meilleure du coffre pour son emplacement, y va (l'ancienne est recyclée, sauf verrouillée)">${auto ? 'Rangement auto : activé' : 'Rangement auto : désactivé'}</button></div>
    ${over}${filter}${tiers}
    ${items.length ? `<div class="stash-layout"><div class="inv-grid">${grid}</div>${detail}</div>` : '<div class="card muted">Le coffre est vide.</div>'}`;
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
      <button class="btn btn-gold small" data-action="expose-all" title="Expose les objets ancestraux du sac et du coffre (pas ceux que porte le héros)">Exposer tout (sac + coffre)</button>
      ${dupes ? `<button class="btn btn-danger small" data-action="recycle-museum-dupes" title="Objets ancestraux du sac moins bons que l'exemplaire exposé (les verrouillés sont gardés)">Recycler les doublons (${dupes})</button>` : ''}</div>
      ${dupes ? `<div class="muted">${dupes} objet${dupes > 1 ? 's' : ''} ancestra${dupes > 1 ? 'ux' : 'l'} du sac ${dupes > 1 ? 'sont des doublons' : 'est un doublon'} : la vitrine expose déjà un exemplaire au moins aussi bon. Les objets ancestraux ne sont jamais recyclés automatiquement.</div>` : ''}`,
  { extra: !auto ? '<span class="muted">auto désactivée</span>' : dupes ? `<span class="muted">${dupes} doublon${dupes > 1 ? 's' : ''}</span>` : '' });
  return `<div class="card"><span class="muted">Le Musée expose vos objets ancestraux, un par vitrine, dès qu'ils sont ramassés. Chaque pièce exposée :
      dégâts, PV et or ${pct(per.damageMultPct)} (multiplicatif, ×2 si Légendaire). Collection complète : dégâts et PV +${MUSEUM.complete.damageMultPct} % de plus.
      Une pièce exposée n'est pas portée : reprenez-la (↩) pour l'équiper.</span>
      <div class="museum-total"><b>${n}/${MUSEUM_PIECES.length}</b> pièces exposées${n && total ? ` · <span class="good">${total}</span>` : ''}</div>
      ${tools}</div>
    <div class="museum">${cases}</div>`;
}

function bag(ui, state) {
  const items = visibleItems(state);
  const equippedItems = Object.values(state.equipment).filter(Boolean);
  const all = [...state.inventory, ...equippedItems];
  let selected = all.find((i) => i.id === ui.view.selectedItemId);
  if (!selected) {
    selected = items[0] ?? state.equipment.weapon ?? equippedItems[0] ?? null;
    ui.view.selectedItemId = selected?.id ?? null;
  }
  const slotFrame = (slot) => {
    const label = SLOTS[slot];
    const item = state.equipment[slot];
    const frame = item
      ? itemFrame(item, { selected: item.id === ui.view.selectedItemId, equipped: true })
      : `<div class="item-frame empty" title="${label} : aucun">${img(slotIconName(slot))}</div>`;
    return `<div class="slot" title="${label}">${frame}</div>`;
  };
  // v9.1.3 (doc2 A13) : filtre d'emplacement en icônes sur la ligne du tri (il tient sans prendre de hauteur).
  const FILTERS = [['all', 'Tous les objets', null], ['weapon', 'Armes', 'weapon'], ['helmet', 'Casques', 'helmet'], ['armor', 'Armures', 'armor'], ['accessory', 'Accessoires', 'ring']];
  const filterChips = FILTERS.map(([v, l, slot]) => `<button class="btn chip-btn filter-chip${(state.ui.slotFilter ?? 'all') === v ? ' active' : ''}" data-action="filter" data-value="${v}"
      aria-label="${l}" title="${l}" aria-pressed="${(state.ui.slotFilter ?? 'all') === v}">${slot ? img(slotIconName(slot)) : '<b>Tous</b>'}</button>`).join('');
  const sortOptions = Object.entries(SORT_LABELS)
    .map(([v, l]) => `<option value="${v}" ${v === state.ui.sortBy ? 'selected' : ''}>${l}</option>`).join('');
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  const previewEq = selected ? { ...state.equipment, [selected.slot]: selected } : state.equipment;
  const st = computeHeroStats(state);
  const equipCol = `<div class="card inv-equip"><div class="section-title">Équipement porté</div>
      <div class="equip-doll"><div class="slot-col">${GEAR_SLOTS.map(slotFrame).join('')}</div>
        <div class="doll" title="Aperçu avec l'objet sélectionné">${animCanvas('hero', 64, 58, 2, `data-preview="${escapeHtml(JSON.stringify(previewEq))}"`)}</div>
        <div class="slot-col acc">${ACCESSORY_SLOTS.map(slotFrame).join('')}</div></div>
      <div class="mini-stats"><span>${img('weapon_sword')} ${formatDecimal(st.dps)} dégâts/s</span><span>${img('icon_heart')} ${formatNumber(st.maxHp)}</span></div></div>`;
  // v9.1.3 (doc1 « Équipement : Sac ») : sur téléphone, les 7 cases portées en une ligne compacte en haut du sac
  // (comme la ligne d'équipement de la Fiche du héros) au lieu du mannequin placé sous la grille.
  const gearRow = `<div class="inv-gear-row" aria-label="Équipement porté">${Object.keys(SLOTS).map(slotFrame).join('')}</div>`;
  return `<div class="inv inv3">
    ${equipCol}
    <div class="inv-detail">${selected ? detail(ui, state, selected) : '<div class="card muted">Aucun objet.</div>'}</div>
    <div class="card inv-list">
      ${gearRow}
      <div class="inv-tools"><div class="filter-chips" role="group" aria-label="Emplacement">${filterChips}</div>
        <select data-action="sort" aria-label="Trier">${sortOptions}</select></div>
      <div class="inv-grid">${items.map((i) => itemFrame(i, { selected: i.id === ui.view.selectedItemId, showUp: true, state, current: st })).join('')
        || '<div class="inv-empty">Aucun objet ici. Les ennemis laissent parfois tomber de l\'équipement.</div>'}</div>
      ${full ? '<div class="bad">Sac plein : recyclez, rangez au coffre ou réglez le recyclage automatique (Réglages du sac).</div>' : ''}
    </div>
  </div>
  ${fold(ui, 'bag-settings', 'Réglages du sac', () => bagSettings(ui, state))}`;
}

// Réglages du sac (v9.1.0) : un seul écran replié pour tous les automatismes et le recyclage en lot.
// v9.1.3 (doc1 « Équipement : autres », recyclage en 3 entrées) : une phrase et 3 replis. Recycler un objet seul
// se fait depuis sa fiche ; ici le lot, la règle automatique (raretés) et, en avancé, le mode et les filtres.
// Le rangement auto des pièces d'ensemble n'est plus répété ici : il est dans le Coffre (v9.1.3).
function bagSettings(ui, state) {
  const candidates = bulkRecycleCandidates(state, ui.view.bulkRarity);
  const bulkGold = candidates.reduce((s, i) => s + recycleValue(i), 0);
  const bulkLabel = ui.view.bulkArmed
    ? `Confirmer : ${candidates.length} objet${candidates.length > 1 ? 's' : ''} (+${formatNumber(bulkGold)} or)`
    : `Recycler (${candidates.length}) +${formatNumber(bulkGold)}`;
  const rules = recycleRules(state);
  const lot = () => `<div class="inv-bulk">
      <select data-action="bulk-rarity" aria-label="Rareté maximale à recycler">
        <option value="common" ${ui.view.bulkRarity === 'common' ? 'selected' : ''}>Communs</option>
        <option value="rare" ${ui.view.bulkRarity === 'rare' ? 'selected' : ''}>+ Rares</option>
        <option value="epic" ${ui.view.bulkRarity === 'epic' ? 'selected' : ''}>+ Épiques</option>
        <option value="legendary" ${ui.view.bulkRarity === 'legendary' ? 'selected' : ''}>+ Légendaires</option>
      </select>
      <button class="btn btn-outline-gold${ui.view.bulkArmed ? ' armed' : ''}" data-action="bulk-recycle" ${candidates.length ? '' : 'disabled'}>${bulkLabel}</button>
    </div><div class="muted">Une confirmation est demandée (second appui).</div>`;
  const ruleSummary = rules.mode === 'off' ? 'Désactivé' : RARITIES.filter((r) => rules.rarities.includes(r.id)).map((r) => r.label).join(', ') || 'Aucune rareté';
  return `<div class="muted">Jamais recyclé ni fusionné automatiquement : objet porté, verrouillé, ancestral, ou meilleur que l'objet porté. Un objet seul se recycle depuis sa fiche.</div>
    ${fold(ui, 'bag-lot', 'Recycler en lot', lot)}
    ${fold(ui, 'bag-rule', 'Recyclage automatique', () => recycleRuleEditor(state), { extra: escapeHtml(ruleSummary) })}
    ${fold(ui, 'bag-advanced', 'Réglages avancés : mode, emplacements, effets, fusion auto', () => recycleAdvanced(state))}`;
}

// Builds (v9.1.0) : Enregistrer et Renommer. v9.1.3 (doc2 A11) : une carte par build, résumé d'un coup d'œil
// (classe, équipe, objets, pouvoirs) et « Équiper » sur la carte, au lieu d'une liste déroulante.
function buildsBar(ui, state) {
  const sel = Math.min(state.loadouts.length - 1, Math.max(0, ui.view.buildSel ?? 0));
  const card = (l, i) => {
    const renaming = ui.view.buildRename === i;
    const team = (l.team ?? []).map((id) => companionById(id)).filter(Boolean);
    const items = Object.values(l.gear ?? {}).filter(Boolean).length;
    const summary = l.team
      ? [l.heroClass && classById(l.heroClass) ? escapeHtml(classById(l.heroClass).name) : '',
        ...(team.length ? team.map((c) => escapeHtml(c.name)) : ['sans équipe']),
        `${items}/${Object.keys(SLOTS).length} objets`, (l.powers ?? []).length ? `${l.powers.length} pouvoir${l.powers.length > 1 ? 's' : ''}` : ''].filter(Boolean).map((x) => `<span>${x}</span>`).join(' · ')
      : 'Vide : équipez-vous puis « Enregistrer ».';
    return `<div class="card build-card${i === sel ? ' selected' : ''}">
      <div class="row-between"><b>${escapeHtml(l.name)}</b>
        <span class="build-btns">${l.team ? `<button class="btn small btn-primary" data-action="apply-build" data-value="${i}">Équiper</button>` : ''}
        <button class="btn small" data-action="save-loadout" data-value="${i}">Enregistrer</button>
        <button class="btn small" data-action="rename-build" data-value="${i}" aria-label="Renommer" title="Renommer">✎</button></span></div>
      <div class="muted">${summary}</div>
      ${renaming ? `<div class="row"><input id="build-name" type="text" maxlength="24" value="${escapeHtml(l.name)}" aria-label="Nouveau nom">
        <button class="btn small btn-primary" data-action="confirm-rename-build" data-value="${i}">OK</button></div>` : ''}
    </div>`;
  };
  return `<div class="build-cards">${state.loadouts.map(card).join('')}</div>`;
}

function forge(ui, state) {
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  const groups = fusionGroups(state, BALANCE, fusionKeep(state));
  // v9.1.3 : « Fusionner tout » se confirme en deux appuis ; objets renforcés, meilleurs que l'équipé ou utiles à
  // un ensemble jamais fusionnés (comme la fusion automatique).
  const n = groups.reduce((t, g) => t + Math.floor(g.count / BALANCE.forge.fusionCount) * BALANCE.forge.fusionCount, 0);
  const fusion = groups.length
    ? `<button class="btn btn-gold primary-action${ui.view.fuseArmed ? ' armed' : ''}" data-action="fuse-all">${ui.view.fuseArmed
      ? `Confirmer : fusionner ${n} objets ?` : `Fusionner tout (${groups.length} groupe${groups.length > 1 ? 's' : ''})`}</button>
      <div class="muted">Protégés : objets verrouillés, renforcés, meilleurs que l'équipé, utiles à un ensemble, ancestraux.</div>`
      // v9.1.3 : les groupes un par un sont repliés sous « Fusionner tout ».
      + fold(ui, 'fusion-groups', `Fusionner un seul groupe (${groups.length})`, () => groups.map((g) => `<div class="fusion-row">
        <span>${img(slotIconName(g.slot))} ${BALANCE.forge.fusionCount} × ${SLOTS[g.slot]}
          <b class="r-${g.rarity} rarity-text">${rarityLabel(g.rarity)}</b> → 1 <b class="r-${g.next} rarity-text">${rarityLabel(g.next)}</b>
          <span class="muted">(${g.count} dans le sac)</span></span>
        <button class="btn btn-gold small" data-action="fuse" data-value="${g.slot}|${g.rarity}">Fusionner</button></div>`).join(''))
    : `<div class="muted">Aucune fusion possible : il faut ${BALANCE.forge.fusionCount} objets du même emplacement et de la même rareté
        (non verrouillés, hors objets ancestraux).</div>`;
  // Fabrication ciblée : l'emplacement en liste, puis deux boutons (Rare+ et Épique+).
  const slot = SLOTS[ui.view.craftSlot] ? ui.view.craftSlot : 'weapon';
  const craftBtn = (tier) => {
    const cost = craftCost(state, undefined, tier);
    const short = state.gold < cost.gold || state.materials.shards < cost.shards;
    return `<button class="btn ${tier === 'epic' ? 'btn-gold' : 'btn-primary'}" data-action="craft" data-value="${slot}" data-tier="${tier}" ${short || full ? 'disabled' : ''}>
      Fabriquer ${tier === 'epic' ? 'Épique+' : 'Rare+'} · ${coin()} ${formatNumber(cost.gold)} ${shard()} ${cost.shards}</button>`;
  };
  const craft = () => `<div class="muted">L'objet est garanti de la rareté choisie ou mieux, au niveau de votre étape max (${state.maxStage}), avec ses effets.</div>
      <div class="row"><select data-action="craft-slot" aria-label="Emplacement à fabriquer">${Object.entries(SLOTS).map(([k, l]) => `<option value="${k}" ${k === slot ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="options-row">${craftBtn('rare')}${craftBtn('epic')}</div>${full ? '<div class="bad">Sac plein.</div>' : ''}`;
  return `<div class="card">
      <div class="section-title">Fusion</div>
      <div class="muted">${BALANCE.forge.fusionCount} objets de même emplacement et de même rareté → 1 objet de la rareté suivante, au niveau du meilleur.</div>
      ${fusion}
    </div>
    ${fold(ui, 'forge-craft', 'Fabrication ciblée', craft)}
    <div class="card"><div class="section-title">Matériaux</div>
      <div>${shard()} <b>${formatNumber(state.materials.shards)}</b> éclats</div>
      <div class="muted">Le recyclage et les boss rendent des éclats. Renforcer, Réaffûter et Relancer
        les effets se font depuis la fiche d'un objet (Détails).</div></div>`;
}

// Fusion automatique (v8.1) : 5 objets identiques (emplacement + rareté) → 1 objet de rareté supérieure.
function autoFuseEditor(state) {
  const f = state.ui.autoFuse ?? { on: false, rarities: ['common'] };
  const chips = RARITIES.slice(0, 3).map((r) => `<button class="btn chip-btn small${f.rarities.includes(r.id) ? ' active' : ''}" data-action="autofuse" data-group="rarities" data-value="${r.id}">${r.label}</button>`).join('');
  return `<label class="inv-rule" title="Jamais fusionné : objet verrouillé, ancestral, ou meilleur que l'objet porté."><span>Fusion auto :</span>
      <button class="btn chip-btn small${f.on ? ' active' : ''}" data-action="autofuse" data-group="on">${f.on ? 'Activée' : 'Désactivée'}</button></label>
    ${f.on ? `<div class="chip-row">${chips}</div>` : ''}`;
}

// Recyclage automatique (règle unique) : les raretés recyclées. Le mode (au ramassage / sac plein) est en avancé.
function recycleRuleEditor(state) {
  const rules = recycleRules(state);
  const chip = (group, value, label, on) => `<button class="btn chip-btn small${on ? ' active' : ''}" data-action="recycle-toggle" data-group="${group}" data-value="${value}">${label}</button>`;
  if (rules.mode === 'off') {
    return `<div class="row"><span class="muted">Désactivé.</span><button class="btn small" data-action="recycle-toggle" data-group="mode" data-value="pickup">Activer au ramassage</button></div>`;
  }
  return `<div class="muted">Raretés recyclées · ${RECYCLE_MODES[rules.mode]}</div>
    <div class="chip-row">${RARITIES.map((r) => chip('rarities', r.id, r.label, rules.rarities.includes(r.id))).join('')}</div>`;
}

// Réglages avancés : mode, emplacements, effets à garder, ensembles, fusion automatique.
function recycleAdvanced(state) {
  const rules = recycleRules(state);
  const chip = (group, value, label, on) => `<button class="btn chip-btn small${on ? ' active' : ''}" data-action="recycle-toggle" data-group="${group}" data-value="${value}">${label}</button>`;
  const slots = Object.entries(SLOTS).map(([s, l]) => chip('slots', s, l, rules.slots.includes(s))).join('');
  return `<div class="recycle-rules">
    <label class="inv-rule"><span>Recyclage auto :</span>
      <select data-action="recycle-mode" aria-label="Recyclage automatique">${Object.entries(RECYCLE_MODES)
        .map(([v, l]) => `<option value="${v}" ${v === rules.mode ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${rules.mode === 'off' ? '' : `<div class="chip-row">${slots}</div>
      <div class="section-title">Garder si l'objet a…</div><div class="chip-row">${Object.entries(KEEP_AFFIX_LABELS).map(([k, l]) => chip('keepAffixes', k, l, (rules.keepAffixes ?? []).includes(k))).join('')}</div>`}
    <label class="inv-rule" title="Une pièce d'ensemble est gardée dès que vous en avez 2 emplacements différents (la meilleure par emplacement).">
      <span>Ensembles :</span><button class="btn chip-btn small${state.ui.keepSets !== false ? ' active' : ''}" data-action="keep-sets">${state.ui.keepSets !== false ? 'Garder les pièces utiles' : 'Recycler comme le reste'}</button></label>
    ${autoFuseEditor(state)}
  </div>`;
}

export default {
  id: 'inventory',
  title: 'Équipement',
  icon: 'icon_bag',
  extra: (ui, state) => `${shard()}<span class="num">${formatNumber(state.materials.shards)}</span>
    <span class="num">· ${state.inventory.length}/${BALANCE.loot.inventorySize}</span>`,
  // v9.1.0 : un seul segment (Sac / Coffre) ; Mannequins et Forge s'ouvrent par un bouton (retour au sac en un clic) ;
  // le Musée est dans Objectifs › Collections ; les builds en liste déroulante.
  render(ui, state) {
    const extra = ui.view.invView;
    if (extra === 'forge' && invFeatureOpen(state, extra)) {
      const back = `<div class="row-between"><button class="btn small" data-action="inv-view" data-value="">← Retour au sac</button>
        <b>Forge</b></div>`;
      return back + forge(ui, state);
    }
    // v9.1.3 (lot F) : Coffre, Mannequins et Forge s'ouvrent à un seuil (core/unlocks.js), puis restent visibles.
    const open = (id) => invFeatureOpen(state, id);
    const tab = ui.view.invTab === 'stash' && open('stash') ? 'stash' : 'bag';
    const nextUnlock = nextInvUnlock(state);
    const st = computeHeroStats(state);
    const anyUpgrade = tab === 'bag' && state.inventory.some((i) => isUpgrade(state, i, undefined, st));
    // v9.1.3 : une seule ligne Sac/Coffre/Mannequins/Forge ; « Équiper le meilleur » seulement s'il sert.
    const head = `<div class="inv-head">
        ${open('stash') ? segment([['bag', `Sac ${state.inventory.length}/${BALANCE.loot.inventorySize}`, 'icon_bag'], ['stash', `Coffre ${state.stash.length}/${STASH_SIZE}`, 'icon_chest']], 'inv-tab', tab) : `<b class="inv-bag-count">${img('icon_bag')} Sac ${state.inventory.length}/${BALANCE.loot.inventorySize}</b>`}
        ${open('forge') ? `<button class="btn small" data-action="inv-view" data-value="forge" aria-label="Forge" title="Forge">${img('icon_anvil')}<span class="wide-label"> Forge</span></button>` : ''}
        ${nextUnlock ? `<span class="next-unlock muted">Prochain : ${nextUnlock.label} à l'étape ${nextUnlock.stage}</span>` : ''}
        ${anyUpgrade ? '<button class="btn btn-primary primary-action pulse-gold equip-best" data-action="equip-best">⬆ Équiper le meilleur</button>' : ''}
      </div>${fold(ui, 'inv-builds', 'Builds', () => buildsBar(ui, state), { extra: state.loadouts[Math.max(0, ui.view.buildSel ?? 0)]?.name ?? '' })}`;
    return head + (tab === 'stash' ? stashView(ui, state) : bag(ui, state));
  },
};
