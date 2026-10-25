// Inventaire en 3 zones (équipement porté · fiche de l'objet · grille) et Forge.
import { BALANCE } from '../../data/balance.js';
import { BOSSES } from '../../data/enemies.js';
import { SLOTS, STAT_LABELS } from '../../data/items.js';
import { formatStat } from '../../core/format.js';
import { canReforge, craftCost, sharpenCost } from '../../core/forge.js';
import { bulkRecycleCandidates, listInventory } from '../../core/inventory.js';
import { itemBase, rarityById, recycleMaterials, recycleValue } from '../../core/loot.js';
import { computeHeroStats, statsWithItem } from '../../core/stats.js';
import { slotIconName } from '../../render/pixel.js';
import {
  affixText, coin, costButton, escapeHtml, essence, formatDecimal, formatNumber, img, itemFrame, shard,
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
    const row = (label, diff, text, unit = '') => {
      const cls = Math.abs(diff) < 0.001 ? 'muted' : diff > 0 ? 'good' : 'bad';
      const arrow = Math.abs(diff) < 0.001 ? '•' : diff > 0 ? '▲' : '▼';
      return `<div class="compare-row"><span>${label}</span><span class="num ${cls}">${diff > 0 ? '+' : ''}${text}${unit} ${arrow}</span></div>`;
    };
    const current = state.equipment[item.slot];
    compare = `<div class="compare"><div class="section-title">Comparaison${current ? ` · ${escapeHtml(current.name)}` : ' · emplacement vide'}</div>
      ${row('DPS', next.dps - cur.dps, formatDecimal(next.dps - cur.dps))}
      ${row('Dégâts', next.damage - cur.damage, formatNumber(Math.round(next.damage - cur.damage)))}
      ${row('Attaques / s', next.attacksPerSecond - cur.attacksPerSecond, formatDecimal(next.attacksPerSecond - cur.attacksPerSecond, 2))}
      ${row('PV max', next.maxHp - cur.maxHp, formatNumber(Math.round(next.maxHp - cur.maxHp)))}
      ${row('Armure', next.armor - cur.armor, formatDecimal(next.armor - cur.armor), ' %')}
    </div>`;
  }
  const mats = recycleMaterials(item);
  const lock = `<button class="btn small lock-btn${item.locked ? ' on' : ''}" data-action="lock" data-id="${item.id}"
    title="${item.locked ? 'Déverrouiller' : 'Verrouiller : protège du recyclage'}">${img('icon_lock')} ${item.locked ? 'Verrouillé' : 'Verrouiller'}</button>`;
  const sharpen = sharpenCost(state, item);
  const forgeRow = `<div class="detail-actions">
      ${sharpen ? costButton({ action: 'sharpen', cost: sharpen, have: state.materials.shards, currency: 'shards', attrs: `data-id="${item.id}"`, cls: 'small', label: `Réaffûter niv. ${state.maxStage} ` }) : ''}
      ${canReforge(item) ? `<button class="btn small" data-action="reforge" data-id="${item.id}"
        ${state.materials.shards < BALANCE.forge.reforgeShards || state.materials.essence < BALANCE.forge.reforgeEssence ? 'disabled' : ''}
        title="Relancer les effets spéciaux">Relancer effets ${shard()}${BALANCE.forge.reforgeShards} ${essence()}${BALANCE.forge.reforgeEssence}</button>` : ''}
      ${lock}</div>`;
  const actions = isEquipped ? '' : `<div class="detail-actions">
      <button class="btn btn-primary" data-action="equip" data-id="${item.id}">Équiper</button>
      <button class="btn btn-outline-gold" data-action="recycle" data-id="${item.id}" ${item.locked ? 'disabled title="Objet verrouillé"' : ''}
        title="Recycler : or et matériaux">Recycler +${formatNumber(recycleValue(item))} ${coin()}${mats.shards ? ` +${mats.shards}${shard()}` : ''}${mats.essence ? ` +${mats.essence}${essence()}` : ''}</button>
    </div>`;
  const preview = animCanvas('hero', 64, 58, 2, `data-preview="${escapeHtml(JSON.stringify({ ...state.equipment, [item.slot]: item }))}"`);
  return `<div class="card item-detail r-${item.rarity}">
    <div class="detail-head">${itemFrame(item, { tag: 'div' })}
      <div><div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-sub">${SLOTS[item.slot]} · <span class="rarity-text">${rarity.label}</span> · niv. ${item.level}</div>
        ${isEquipped ? '<span class="equipped-tag">Équipé</span>' : ''}
        ${base.signature ? `<span class="signature-tag">Butin de ${escapeHtml(BOSSES[base.signature].name)}</span>` : ''}</div></div>
    <ul class="stat-list">${stats}${affixes}</ul>
    ${compare}${actions}${forgeRow}
    <div class="preview" title="Aperçu du chevalier avec cet objet">${preview}</div>
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
  const slots = Object.entries(SLOTS).map(([slot, label]) => {
    const item = state.equipment[slot];
    const frame = item
      ? itemFrame(item, { selected: item.id === ui.view.selectedItemId, equipped: true })
      : `<div class="item-frame empty" title="${label} : aucun">${img(slotIconName(slot))}</div>`;
    return `<div>${frame}<div class="slot-label">${label}</div></div>`;
  }).join('');
  const filters = [['all', null, 'Tous'], ...Object.entries(SLOTS).map(([slot, label]) => [slot, slotIconName(slot), label])]
    .map(([value, iconName, label]) => `<button class="btn${state.ui.slotFilter === value ? ' active' : ''}"
      data-action="filter" data-value="${value}" title="${label}">${iconName ? img(iconName) : 'Tous'}</button>`).join('');
  const sortOptions = Object.entries(SORT_LABELS)
    .map(([v, l]) => `<option value="${v}" ${v === state.ui.sortBy ? 'selected' : ''}>Tri : ${l}</option>`).join('');
  const candidates = bulkRecycleCandidates(state, ui.view.bulkRarity);
  const bulkGold = candidates.reduce((s, i) => s + recycleValue(i), 0);
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  const bulkLabel = ui.view.bulkArmed
    ? `Confirmer : ${candidates.length} objet${candidates.length > 1 ? 's' : ''} (+${formatNumber(bulkGold)} or)`
    : `Recycler (${candidates.length}) +${formatNumber(bulkGold)}`;
  return `<div class="inv">
    <div class="inv-slots">${slots}</div>
    <div class="inv-detail">${selected ? detail(ui, state, selected) : '<div class="card muted">Aucun objet.</div>'}</div>
    <div class="inv-list">
      <div class="inv-filters">${filters}</div>
      <div class="inv-grid">${items.map((i) => itemFrame(i, { selected: i.id === ui.view.selectedItemId, showUp: true, state })).join('')
        || '<div class="inv-empty">Aucun objet ici. Les ennemis laissent parfois tomber de l\'équipement.</div>'}</div>
      <div class="inv-footer">
        <select data-action="sort" aria-label="Trier">${sortOptions}</select>
        <span class="inv-count${full ? ' full' : ''}">${state.inventory.length}/${BALANCE.loot.inventorySize}</span>
      </div>
      <div class="inv-bulk" title="Ne recycle jamais un objet verrouillé, meilleur que l'équipement porté, Épique ou Légendaire.">
        <select data-action="bulk-rarity" aria-label="Rareté maximale à recycler">
          <option value="common" ${ui.view.bulkRarity === 'common' ? 'selected' : ''}>Communs</option>
          <option value="rare" ${ui.view.bulkRarity === 'rare' ? 'selected' : ''}>+ Rares</option>
        </select>
        <button class="btn btn-outline-gold${ui.view.bulkArmed ? ' armed' : ''}" data-action="bulk-recycle" ${candidates.length ? '' : 'disabled'}>${bulkLabel}</button>
      </div>
    </div>
  </div>`;
}

function forge(ui, state) {
  const cost = craftCost(state);
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  const slots = Object.entries(SLOTS).map(([slot, label]) => `<button class="btn forge-slot" data-action="craft" data-value="${slot}"
      ${state.gold < cost.gold || state.materials.shards < cost.shards || full ? 'disabled' : ''}>
      ${img(slotIconName(slot))}<b>${label}</b><span class="muted">Rare ou mieux · niv. ${state.maxStage}</span></button>`).join('');
  return `<div class="card">
      <div class="section-title">Fabrication ciblée</div>
      <div class="muted">Choisissez l'emplacement : l'objet est garanti Rare ou mieux, au niveau de votre étape max, avec ses effets spéciaux.</div>
      <div class="forge-grid">${slots}</div>
      <div class="muted">Coût : ${coin()} ${formatNumber(cost.gold)} · ${shard()} ${cost.shards} éclats${full ? ' · <span class="bad">sac plein</span>' : ''}</div>
    </div>
    <div class="card">
      <div class="section-title">Matériaux</div>
      <div>${shard()} <b>${formatNumber(state.materials.shards)}</b> éclats · ${essence()} <b>${formatNumber(state.materials.essence)}</b> essences</div>
      <div class="muted">Le recyclage rend des éclats (toutes raretés) et des essences (Épique et Légendaire).
        Dans la fiche d'un objet : <b>Réaffûter</b> (le remonter au niveau de votre étape max) et <b>Relancer effets</b>.</div>
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
