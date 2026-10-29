// Inventaire en 3 zones (équipement porté · fiche de l'objet · grille) et Forge.
import { canEquip, weaponClass } from '../../core/classes.js';
import { BALANCE } from '../../data/balance.js';
import { BOSSES } from '../../data/enemies.js';
import { ACCESSORY_SLOTS, GEAR_SLOTS, RARITIES, SLOTS, STAT_LABELS } from '../../data/items.js';
import { formatStat } from '../../core/format.js';
import { canReforge, craftCost, fusionGroups, maxUpgrades, sharpenCost, upgradeCost } from '../../core/forge.js';
import { bulkRecycleCandidates, isUpgrade, listInventory, RECYCLE_MODES, recycleRules } from '../../core/inventory.js';
import { itemBase, rarityById, recycleMaterials, recycleValue } from '../../core/loot.js';
import { computeHeroStats, statsWithItem } from '../../core/stats.js';
import { slotIconName } from '../../render/pixel.js';
import {
  affixText, coin, costButton, effectText, escapeHtml, essence, formatDecimal, formatNumber, img, itemFrame, rarityLabel, shard,
} from '../common.js';
import { setById, setCounts } from '../../core/sets.js';
import { ITEM_SETS, SET_PIECES } from '../../data/sets.js';
import { STASH_SIZE } from '../../core/stash.js';
import { MUSEUM, MUSEUM_PIECES, isMuseumDuplicate, museumCount, museumDuplicates, museumEffects } from '../../core/museum.js';
import { itemIconUrl } from '../../render/pixel.js';
import { animCanvas } from '../animator.js';

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
      const cls = Math.abs(diff) < 0.001 ? 'muted' : diff > 0 ? 'good' : 'bad';
      const arrow = Math.abs(diff) < 0.001 ? '•' : diff > 0 ? '▲' : '▼';
      return `<div class="compare-row"><span>${label}</span><span class="num muted">${fmt(a)}${unit} → ${fmt(b)}${unit}</span>
        <span class="num ${cls}">${diff > 0 ? '+' : ''}${fmt(diff)}${unit} ${arrow}</span></div>`;
    };
    const current = state.equipment[item.slot];
    const int = (v) => formatNumber(Math.round(v));
    compare = `<div class="compare"><div class="section-title">Si vous l'équipez${current ? ` (à la place de ${escapeHtml(current.name)})` : ' (emplacement vide)'}</div>
      <div class="muted compare-hint">Vos statistiques actuelles → avec cet objet, et le gain ou la perte.</div>
      ${row('DPS', cur.dps, next.dps, (v) => formatDecimal(v))}
      ${row('Dégâts', cur.damage, next.damage, int)}
      ${row('Attaques / s', cur.attacksPerSecond, next.attacksPerSecond, (v) => formatDecimal(v, 2))}
      ${row('PV max', cur.maxHp, next.maxHp, int)}
      ${row('Armure', cur.armor, next.armor, (v) => formatDecimal(v), ' %')}
      ${bonusRows(cur.bonus, next.bonus, row)}
    </div>`;
  }
  const mats = recycleMaterials(item);
  const lock = `<button class="btn small lock-btn${item.locked ? ' on' : ''}" data-action="lock" data-id="${item.id}"
    title="${item.locked ? 'Déverrouiller' : 'Verrouiller : protège du recyclage'}">${img('icon_lock')} ${item.locked ? 'Verrouillé' : 'Verrouiller'}</button>`;
  const sharpen = sharpenCost(state, item);
  // Amélioration : +12 % sur une statistique au hasard, 5 fois (Commun, Rare) ou 10 fois (Épique, Légendaire).
  const ups = item.upgrades ?? 0;
  const maxUp = maxUpgrades(item);
  const upCost = upgradeCost(item);
  // Boutons toujours aux mêmes places, quel que soit l'objet : ceux qui ne s'appliquent pas sont grisés.
  const upgradeBtn = ups >= maxUp
    ? `<button class="btn btn-gold" disabled>Amélioration maximale (+${maxUp})</button>`
    : `<button class="btn btn-gold num" data-action="upgrade-item" data-id="${item.id}" data-cost="${upCost.gold}" data-currency="gold"
        ${state.materials.shards < upCost.shards ? 'data-locked="1" disabled' : state.gold < upCost.gold ? 'disabled' : ''}
        title="Augmente une statistique de l'objet au hasard de ${BALANCE.forge.upgradeBoostPct} %">Améliorer +${ups + 1} ${coin()} ${formatNumber(upCost.gold)} ${shard()} ${upCost.shards}</button>`;
  const sharpenBtn = sharpen
    ? costButton({ action: 'sharpen', cost: sharpen, have: state.materials.shards, currency: 'shards', attrs: `data-id="${item.id}"`, cls: 'small', label: `Réaffûter niv. ${state.maxStage} ` })
    : '<button class="btn small" disabled title="Déjà au niveau de votre étape max">Réaffûter</button>';
  const reforgeBtn = `<button class="btn small" data-action="reforge" data-id="${item.id}"
      ${!canReforge(item) || state.materials.shards < BALANCE.forge.reforgeShards || state.materials.essence < BALANCE.forge.reforgeEssence ? 'disabled' : ''}
      title="${canReforge(item) ? 'Relancer les effets spéciaux' : 'Cet objet n\'a pas d\'effets à relancer'}">Relancer effets ${shard()}${BALANCE.forge.reforgeShards} ${essence()}${BALANCE.forge.reforgeEssence}</button>`;
  const actions = `<div class="action-grid">
      ${isEquipped ? '<button class="btn btn-primary" disabled>Équipé</button>' : canEquip(state, item)
        ? `<button class="btn btn-primary" data-action="equip" data-id="${item.id}">Équiper</button>`
        : `<button class="btn" disabled title="Changez de classe (Personnage → Héros → Classe) pour la porter">Arme de ${escapeHtml(weaponClass(item.baseId).name)}</button>`}
      <button class="btn btn-outline-gold" data-action="recycle" data-id="${item.id}" ${item.locked || isEquipped ? 'disabled' : ''}
        title="${isEquipped ? 'Un objet équipé ne peut pas être recyclé' : item.locked ? 'Objet verrouillé' : 'Recycler : or et matériaux'}">Recycler +${formatNumber(recycleValue(item))} ${coin()}${mats.shards ? ` +${mats.shards}${shard()}` : ''}${mats.essence ? ` +${mats.essence}${essence()}` : ''}</button>
      <div class="span2 upgrade-line">${upgradeBtn}<span class="muted num">${ups}/${maxUp}</span></div>
      <div class="span2 tool-line">${sharpenBtn}${reforgeBtn}${lock}</div>
      ${isEquipped ? '' : `<div class="span2 tool-line">
        <button class="btn small" data-action="to-stash" data-id="${item.id}" ${state.stash.length >= STASH_SIZE ? 'disabled' : ''} title="Le coffre n'est jamais recyclé ni fusionné">Ranger au coffre (${state.stash.length}/${STASH_SIZE})</button>
        ${item.set ? `<button class="btn small" data-action="to-mannequin" data-id="${item.id}" title="Poser sur le mannequin de son ensemble">Mettre sur le mannequin</button>` : ''}
        ${base.signature ? `<button class="btn small btn-gold" data-action="to-museum" data-id="${item.id}" title="Exposer dans sa vitrine du Musée (bonus permanent)">Exposer au Musée</button>` : ''}</div>`}
    </div>`;
  return `<div class="card item-detail r-${item.rarity}">
    <div class="detail-head">${itemFrame(item, { tag: 'div' })}
      <div><div class="item-name">${escapeHtml(item.name)}${ups ? ` <span class="plus-lv">+${ups}</span>` : ''}</div>
        <div class="item-sub">${SLOTS[item.slot]} · <span class="rarity-text">${rarity.label}</span> · niv. ${item.level}</div>
        <div class="tags">${isEquipped ? '<span class="equipped-tag">Équipé</span>' : ''}
        ${base.signature ? `<span class="signature-tag">Objet ancestral · butin de ${escapeHtml(BOSSES[base.signature].name)}</span>` : ''}
        ${isMuseumDuplicate(state, item) ? '<span class="tag-dupe" title="Le Musée expose déjà un exemplaire au moins aussi bon">Doublon du Musée</span>' : ''}</div></div></div>
    ${actions}
    <div class="section-title">Statistiques de l'objet</div>
    <ul class="stat-list">${stats}${affixes}</ul>
    ${setBlock(state, item)}
    ${compare}
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
  const items = [...state.stash].sort((a, b) => rarityById(b.rarity).statMultiplier - rarityById(a.rarity).statMultiplier || b.level - a.level);
  const sel = items.find((i) => i.id === ui.view.stashSel) ?? items[0];
  const grid = items.map((i) => itemFrame(i, { selected: i.id === sel?.id, action: 'stash-sel' })).join('');
  const detail = sel ? `<div class="card item-detail r-${sel.rarity}">
      <div class="detail-head">${itemFrame(sel, { tag: 'div' })}<div><div class="item-name">${escapeHtml(sel.name)}</div>
        <div class="item-sub">${SLOTS[sel.slot]} · <span class="rarity-text">${rarityById(sel.rarity).label}</span> · niv. ${sel.level}</div></div></div>
      <ul class="stat-list">${Object.entries(sel.stats).map(([k, v]) => `<li>${STAT_LABELS[k]} <b class="num">${formatStat(k, v, true)}</b></li>`).join('')}${(sel.affixes ?? []).map((a) => `<li class="affix">✦ ${affixText(a)}</li>`).join('')}</ul>
      ${setBlock(state, sel)}
      <div class="detail-actions"><button class="btn btn-primary" data-action="from-stash" data-id="${sel.id}" ${state.inventory.length >= BALANCE.loot.inventorySize ? 'disabled title="Sac plein"' : ''}>Reprendre dans le sac</button>
        ${sel.set ? `<button class="btn" data-action="to-mannequin" data-id="${sel.id}">Mettre sur le mannequin</button>` : ''}</div></div>` : '';
  return `<div class="card"><div class="muted">Le coffre garde ${STASH_SIZE} objets de plus que le sac. Ce qui y est rangé n'est <b>jamais recyclé ni fusionné</b>.
      Rangez-y un objet depuis sa fiche dans le Sac (« Ranger au coffre »).</div></div>
    ${items.length ? `<div class="stash-layout"><div class="inv-grid">${grid}</div>${detail}</div>` : '<div class="card muted">Le coffre est vide.</div>'}`;
}

// Mannequins (v8.9) : un par ensemble ; « Porter » équipe tout l'ensemble d'un coup.
// Musée (v9.0) : une vitrine par objet ancestral, bonus permanent par pièce exposée.
function museumView(ui, state) {
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
  return `<div class="card"><div class="row-between"><span class="muted">Le Musée expose vos objets ancestraux, un par vitrine. Chaque pièce exposée :
      dégâts, PV et or ${pct(per.damageMultPct)} (multiplicatif, ×2 si Légendaire). Collection complète : dégâts et PV +${MUSEUM.complete.damageMultPct} % de plus.
      Une pièce exposée n'est pas portée : reprenez-la (↩) pour l'équiper.</span>
      <button class="btn chip-btn small${auto ? ' active' : ''}" data-action="auto-museum" title="Les objets ancestraux ramassés vont dans leur vitrine si elle est vide ou s'ils sont meilleurs (l'ancien retourne au sac)">${auto ? 'Exposition auto : activée' : 'Exposition auto : désactivée'}</button></div>
      <div class="row-between museum-total"><span><b>${n}/${MUSEUM_PIECES.length}</b> pièces exposées${total ? ` · <span class="good">${total}</span>` : ''}</span>
        <span><button class="btn btn-gold small" data-action="expose-all" title="Expose les objets ancestraux du sac et du coffre (pas ceux que porte le héros)">Exposer tout (sac + coffre)</button>
        ${dupes ? `<button class="btn btn-danger small" data-action="recycle-museum-dupes" title="Objets ancestraux du sac moins bons que l'exemplaire exposé (les verrouillés sont gardés)">Recycler les doublons (${dupes})</button>` : ''}</span></div>
      ${dupes ? `<div class="muted">${dupes} objet${dupes > 1 ? 's' : ''} ancestra${dupes > 1 ? 'ux' : 'l'} du sac ${dupes > 1 ? 'sont des doublons' : 'est un doublon'} : la vitrine expose déjà un exemplaire au moins aussi bon. Les objets ancestraux ne sont jamais recyclés automatiquement.</div>` : ''}</div>
    <div class="museum">${cases}</div>`;
}

function mannequinsView(ui, state) {
  const auto = state.ui.autoMannequin !== false;
  const cards = ITEM_SETS.map((set) => {
    const m = state.mannequins[set.id] ?? {};
    const n = Object.values(m).filter(Boolean).length;
    const slots = Object.keys(SLOTS).map((slot) => (m[slot]
      ? `<div class="mq-slot" title="${escapeHtml(m[slot].name)}">${itemFrame(m[slot], { tag: 'div' })}<button class="btn tiny" data-action="from-mannequin" data-value="${set.id}|${slot}" title="Reprendre dans le sac">↩</button></div>`
      : `<div class="mq-slot empty" title="${SLOTS[slot]} : vide"><div class="item-frame empty">${img(slotIconName(slot))}</div></div>`)).join('');
    const tiers = SET_PIECES.map((p) => `<span class="${n >= p ? 'good' : 'muted'}">${p} : ${effectText(set.bonuses[p])}</span>`).join(' · ');
    return `<div class="card mannequin" style="--set:${set.color}">
      <div class="row-between"><b style="color:${set.color}">${img(`set_${set.id}`)} ${escapeHtml(set.name)}</b><span class="muted">${n}/${Object.keys(SLOTS).length} pièces</span></div>
      <div class="mq-slots">${slots}</div><div class="mq-tiers">${tiers}</div>
      <button class="btn btn-gold small" data-action="wear-mannequin" data-value="${set.id}" ${n ? '' : 'disabled'}>Porter cet ensemble</button></div>`;
  }).join('');
  return `<div class="card row-between"><span class="muted">Un mannequin par ensemble : il garde la meilleure pièce de chaque emplacement. « Porter » échange tout l'ensemble avec votre équipement.</span>
      <button class="btn chip-btn small${auto ? ' active' : ''}" data-action="auto-mannequin" title="Les pièces d'ensemble ramassées vont sur leur mannequin si elles sont meilleures (l'ancienne est recyclée)">${auto ? 'Rangement auto : activé' : 'Rangement auto : désactivé'}</button></div>
    <div class="mannequins">${cards}</div>`;
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
  // Équipement porté à gauche, accessoires à droite.
  const filters = [['all', null, 'Tous'], ['weapon', 'weapon_sword', 'Armes'], ['helmet', 'icon_hero', 'Casques'], ['armor', 'icon_shield', 'Armures'],
    ['accessory', 'ring_band', 'Accessoires']]
    .map(([value, iconName, label]) => `<button class="btn${state.ui.slotFilter === value ? ' active' : ''}"
      data-action="filter" data-value="${value}" title="${label}">${iconName ? img(iconName) : ''}<span>${label}</span></button>`).join('');
  const sortOptions = Object.entries(SORT_LABELS)
    .map(([v, l]) => `<option value="${v}" ${v === state.ui.sortBy ? 'selected' : ''}>Tri : ${l}</option>`).join('');
  const candidates = bulkRecycleCandidates(state, ui.view.bulkRarity);
  const bulkGold = candidates.reduce((s, i) => s + recycleValue(i), 0);
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  const bulkLabel = ui.view.bulkArmed
    ? `Confirmer : ${candidates.length} objet${candidates.length > 1 ? 's' : ''} (+${formatNumber(bulkGold)} or)`
    : `Recycler (${candidates.length}) +${formatNumber(bulkGold)}`;
  // Colonne équipement : le chevalier (aperçu avec l'objet sélectionné) entouré de ses emplacements.
  const previewEq = selected ? { ...state.equipment, [selected.slot]: selected } : state.equipment;
  const st = computeHeroStats(state);
  const anyUpgrade = state.inventory.some((i) => isUpgrade(state, i, undefined, st));
  const equipCol = `<div class="card inv-equip"><div class="section-title">Équipement</div>
      <div class="equip-doll"><div class="slot-col">${GEAR_SLOTS.map(slotFrame).join('')}</div>
        <div class="doll" title="Aperçu avec l'objet sélectionné">${animCanvas('hero', 64, 58, 2, `data-preview="${escapeHtml(JSON.stringify(previewEq))}"`)}</div>
        <div class="slot-col acc">${ACCESSORY_SLOTS.map(slotFrame).join('')}</div></div>
      <div class="mini-stats"><span>${img('weapon_sword')} ${formatNumber(st.damage)}</span><span>${img('icon_heart')} ${formatNumber(st.maxHp)}</span>
        <span>${img('icon_shield')} ${formatDecimal(st.armor)} %</span><span>${img('icon_bolt')} ${formatDecimal(st.attacksPerSecond, 2)}/s</span></div></div>`;
  return `<div class="inv inv3">
    ${equipCol}
    <div class="inv-detail">${selected ? detail(ui, state, selected) : '<div class="card muted">Aucun objet.</div>'}</div>
    <div class="card inv-list">
      <div class="row-between"><div class="section-title">Inventaire</div><span class="inv-count${full ? ' full' : ''}">${state.inventory.length}/${BALANCE.loot.inventorySize}</span></div>
      <div class="inv-filters">${filters}</div>
      <div class="inv-grid">${items.map((i) => itemFrame(i, { selected: i.id === ui.view.selectedItemId, showUp: true, state, current: st })).join('')
        || '<div class="inv-empty">Aucun objet ici. Les ennemis laissent parfois tomber de l\'équipement.</div>'}</div>
      <div class="inv-footer">
        <select data-action="sort" aria-label="Trier">${sortOptions}</select>
        <button class="btn btn-primary small${anyUpgrade ? ' pulse-gold' : ''}" data-action="equip-best" ${anyUpgrade ? '' : 'disabled'}
          title="Équipe les objets du sac meilleurs que ceux portés">⬆ Équiper le meilleur</button>
      </div>
      ${recycleRuleEditor(state)}
      <div class="inv-bulk" title="Ne recycle jamais un objet verrouillé, ancestral ou meilleur que l'équipement porté. Une confirmation est demandée.">
        <select data-action="bulk-rarity" aria-label="Rareté maximale à recycler">
          <option value="common" ${ui.view.bulkRarity === 'common' ? 'selected' : ''}>Communs</option>
          <option value="rare" ${ui.view.bulkRarity === 'rare' ? 'selected' : ''}>+ Rares</option>
          <option value="epic" ${ui.view.bulkRarity === 'epic' ? 'selected' : ''}>+ Épiques</option>
          <option value="legendary" ${ui.view.bulkRarity === 'legendary' ? 'selected' : ''}>+ Légendaires</option>
        </select>
        <button class="btn btn-outline-gold${ui.view.bulkArmed ? ' armed' : ''}" data-action="bulk-recycle" ${candidates.length ? '' : 'disabled'}>${bulkLabel}</button>
      </div>
    </div>
  </div>`;
}

function forge(ui, state) {
  const tier = ui.view.craftTier === 'epic' ? 'epic' : 'rare';
  const cost = craftCost(state, undefined, tier);
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  const short = state.gold < cost.gold || state.materials.shards < cost.shards || state.materials.essence < cost.essence;
  const slots = Object.entries(SLOTS).map(([slot, label]) => `<button class="btn forge-slot" data-action="craft" data-value="${slot}" data-tier="${tier}"
      ${short || full ? 'disabled' : ''}>
      ${img(slotIconName(slot))}<b>${label}</b><span class="muted">${tier === 'epic' ? 'Épique' : 'Rare'} ou mieux · niv. ${state.maxStage}</span></button>`).join('');
  const tiers = `<div class="sub-tabs">
      <button class="btn chip-btn${tier === 'rare' ? ' active' : ''}" data-action="craft-tier" data-value="rare">Rare+</button>
      <button class="btn chip-btn${tier === 'epic' ? ' active' : ''}" data-action="craft-tier" data-value="epic">${essence()} Épique+</button></div>`;
  const groups = fusionGroups(state);
  const fusion = groups.length
    ? groups.map((g) => `<div class="fusion-row">
        <span>${img(slotIconName(g.slot))} ${BALANCE.forge.fusionCount} × ${SLOTS[g.slot]}
          <b class="r-${g.rarity} rarity-text">${rarityLabel(g.rarity)}</b> → 1 <b class="r-${g.next} rarity-text">${rarityLabel(g.next)}</b>
          <span class="muted">(${g.count} dans le sac)</span></span>
        <button class="btn btn-gold small" data-action="fuse" data-value="${g.slot}|${g.rarity}">Fusionner</button></div>`).join('')
    : `<div class="muted">Aucune fusion possible : il faut ${BALANCE.forge.fusionCount} objets du même emplacement et de la même rareté
        (non verrouillés, hors objets signature).</div>`;
  return `<div class="card">
      <div class="section-title">Fusion</div>
      <div class="muted">${BALANCE.forge.fusionCount} objets de même emplacement et de même rareté → 1 objet de la rareté suivante,
        au niveau du meilleur. Les plus faibles sont utilisés en premier.</div>
      <div class="recycle-rules">${autoFuseEditor(state)}</div>
      ${fusion}
    </div>
    <div class="card">
      <div class="section-title">Fabrication ciblée</div>
      <div class="muted">Choisissez l'emplacement : l'objet est garanti ${tier === 'epic' ? 'Épique' : 'Rare'} ou mieux, au niveau de votre étape max,
        avec ses effets spéciaux. La version Épique demande des essences, butin des boss.</div>
      ${tiers}
      <div class="forge-grid">${slots}</div>
      <div class="muted">Coût : ${coin()} ${formatNumber(cost.gold)} · ${shard()} ${cost.shards} éclats${cost.essence ? ` · ${essence()} ${cost.essence} essences` : ''}${full ? ' · <span class="bad">sac plein</span>' : ''}</div>
    </div>
    <div class="card">
      <div class="section-title">Matériaux</div>
      <div>${shard()} <b>${formatNumber(state.materials.shards)}</b> éclats · ${essence()} <b>${formatNumber(state.materials.essence)}</b> essences</div>
      <div class="muted">Le recyclage rend des éclats (toutes raretés) et des essences (Épique et Légendaire).
        Dans la fiche d'un objet : <b>Réaffûter</b> (le remonter au niveau de votre étape max) et <b>Relancer effets</b>.</div>
    </div>`;
}

// Fusion automatique (v8.1) : 5 objets identiques (emplacement + rareté) → 1 objet de rareté supérieure.
function autoFuseEditor(state) {
  const f = state.ui.autoFuse ?? { on: false, rarities: ['common'] };
  const chips = RARITIES.slice(0, 3).map((r) => `<button class="btn chip-btn small${f.rarities.includes(r.id) ? ' active' : ''}" data-action="autofuse" data-group="rarities" data-value="${r.id}">${r.label}</button>`).join('');
  return `<label class="inv-rule" title="Jamais fusionné : objet verrouillé, ancestral, ou meilleur que l'objet porté."><span>Fusion auto :</span>
      <button class="btn chip-btn small${f.on ? ' active' : ''}" data-action="autofuse" data-group="on">${f.on ? 'Activée' : 'Désactivée'}</button></label>
    ${f.on ? `<div class="chip-row">${chips}</div>` : ''}`;
}

// Recyclage automatique : quand (ramassage / sac plein), quelles raretés, quels types d'objets.
function recycleRuleEditor(state) {
  const rules = recycleRules(state);
  const chip = (group, value, label, on) => `<button class="btn chip-btn small${on ? ' active' : ''}" data-action="recycle-toggle" data-group="${group}" data-value="${value}">${label}</button>`;
  const rarities = RARITIES.map((r) => chip('rarities', r.id, r.label, rules.rarities.includes(r.id))).join('');
  const slots = Object.entries(SLOTS).map(([s, l]) => chip('slots', s, l, rules.slots.includes(s))).join('');
  return `<div class="recycle-rules" title="Jamais recyclé : objet équipé, verrouillé, ancestral, ou meilleur que l'objet porté.">
    <label class="inv-rule"><span>Recyclage auto :</span>
      <select data-action="recycle-mode" aria-label="Recyclage automatique">${Object.entries(RECYCLE_MODES)
        .map(([v, l]) => `<option value="${v}" ${v === rules.mode ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${rules.mode === 'off' ? '' : `<div class="chip-row">${rarities}</div><div class="chip-row">${slots}</div>`}
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
    ${essence()}<span class="num">${formatNumber(state.materials.essence)}</span>
    <span class="num">· ${state.inventory.length}/${BALANCE.loot.inventorySize}</span>`,
  render(ui, state) {
    const tab = ui.view.invTab;
    const views = { forge, stash: stashView, mannequins: mannequinsView, museum: museumView };
    return `<div class="sub-tabs">
        <button class="btn chip-btn${tab === 'bag' ? ' active' : ''}" data-action="inv-tab" data-value="bag">${img('icon_bag')}<span>Sac</span></button>
        <button class="btn chip-btn${tab === 'stash' ? ' active' : ''}" data-action="inv-tab" data-value="stash">${img('icon_chest')}<span>Coffre ${state.stash.length}/${STASH_SIZE}</span></button>
        <button class="btn chip-btn${tab === 'mannequins' ? ' active' : ''}" data-action="inv-tab" data-value="mannequins">${img('icon_hero')}<span>Mannequins</span></button>
        <button class="btn chip-btn${tab === 'museum' ? ' active' : ''}" data-action="inv-tab" data-value="museum">${img('icon_trophy')}<span>Musée ${museumCount(state)}/${MUSEUM_PIECES.length}</span></button>
        <button class="btn chip-btn${tab === 'forge' ? ' active' : ''}" data-action="inv-tab" data-value="forge">${img('icon_anvil')}<span>Forge</span></button>
      </div>${(views[tab] ?? bag)(ui, state)}`;
  },
};
