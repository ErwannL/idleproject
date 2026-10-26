// Inventaire en 3 zones (équipement porté · fiche de l'objet · grille) et Forge.
import { BALANCE } from '../../data/balance.js';
import { BOSSES } from '../../data/enemies.js';
import { ACCESSORY_SLOTS, GEAR_SLOTS, RARITIES, SLOTS, STAT_LABELS } from '../../data/items.js';
import { formatStat } from '../../core/format.js';
import { canReforge, craftCost, fusionGroups, maxUpgrades, sharpenCost, upgradeCost } from '../../core/forge.js';
import { bulkRecycleCandidates, listInventory, RECYCLE_MODES, recycleRules } from '../../core/inventory.js';
import { itemBase, rarityById, recycleMaterials, recycleValue } from '../../core/loot.js';
import { computeHeroStats, statsWithItem } from '../../core/stats.js';
import { slotIconName } from '../../render/pixel.js';
import {
  affixText, coin, costButton, escapeHtml, essence, formatDecimal, formatNumber, img, itemFrame, rarityLabel, shard,
} from '../common.js';
import { animCanvas } from '../animator.js';

const STAT_ICONS = { damage: 'weapon_sword', attackSpeed: 'icon_bolt', maxHp: 'icon_heart', armor: 'icon_shield' };
const SORT_LABELS = { rarity: 'Rareté', level: 'Niveau', power: 'Puissance', recent: 'Récent' };

export function visibleItems(state) {
  return listInventory(state, { slot: state.ui.slotFilter, sortBy: state.ui.sortBy });
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
      ${isEquipped ? '<button class="btn btn-primary" disabled>Équipé</button>' : `<button class="btn btn-primary" data-action="equip" data-id="${item.id}">Équiper</button>`}
      <button class="btn btn-outline-gold" data-action="recycle" data-id="${item.id}" ${item.locked || isEquipped ? 'disabled' : ''}
        title="${isEquipped ? 'Un objet équipé ne peut pas être recyclé' : item.locked ? 'Objet verrouillé' : 'Recycler : or et matériaux'}">Recycler +${formatNumber(recycleValue(item))} ${coin()}${mats.shards ? ` +${mats.shards}${shard()}` : ''}${mats.essence ? ` +${mats.essence}${essence()}` : ''}</button>
      <div class="span2 upgrade-line">${upgradeBtn}<span class="muted num">${ups}/${maxUp}</span></div>
      <div class="span2 tool-line">${sharpenBtn}${reforgeBtn}${lock}</div>
    </div>`;
  return `<div class="card item-detail r-${item.rarity}">
    <div class="detail-head">${itemFrame(item, { tag: 'div' })}
      <div><div class="item-name">${escapeHtml(item.name)}${ups ? ` <span class="plus-lv">+${ups}</span>` : ''}</div>
        <div class="item-sub">${SLOTS[item.slot]} · <span class="rarity-text">${rarity.label}</span> · niv. ${item.level}</div>
        <div class="tags">${isEquipped ? '<span class="equipped-tag">Équipé</span>' : ''}
        ${base.signature ? `<span class="signature-tag">Objet ancestral · butin de ${escapeHtml(BOSSES[base.signature].name)}</span>` : ''}</div></div></div>
    ${actions}
    <div class="section-title">Statistiques de l'objet</div>
    <ul class="stat-list">${stats}${affixes}</ul>
    ${compare}
  </div>`;
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
    ${autoFuseEditor(state)}
  </div>`;
}

export default {
  id: 'inventory',
  title: 'Inventaire',
  icon: 'icon_bag',
  extra: (ui, state) => `${shard()}<span class="num">${formatNumber(state.materials.shards)}</span>
    ${essence()}<span class="num">${formatNumber(state.materials.essence)}</span>
    <span class="num">· ${state.inventory.length}/${BALANCE.loot.inventorySize}</span>`,
  render(ui, state) {
    const tab = ui.view.invTab;
    return `<div class="sub-tabs">
        <button class="btn chip-btn${tab === 'bag' ? ' active' : ''}" data-action="inv-tab" data-value="bag">${img('icon_bag')}<span>Sac</span></button>
        <button class="btn chip-btn${tab === 'forge' ? ' active' : ''}" data-action="inv-tab" data-value="forge">${img('icon_anvil')}<span>Forge</span></button>
      </div>${tab === 'forge' ? forge(ui, state) : bag(ui, state)}`;
  },
};
