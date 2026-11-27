// v10.13 (lot 3, § 3) : Héros › Équipement et fiche « Détails de l'équipement » sur PC, dans le style de la Forge, bâtis avec le kit
// (src/ui/mobile-kit.js, style : desk-kit.css + desk-equip.css, tout sous `#app:not(.m-phone)`). Trois colonnes dans un grand cadre :
//   1. personnage (rangée « qui » : héros + compagnons, portrait, Puissance, places, statistiques, Équipement rapide) ;
//   2. sac (filtres en boutons à icône, tri, grille de cases 64 px) ;
//   3. détails de l'objet (grande case 110 px, statistiques, rangée de modes Améliorer · Reforger · Équiper, panneau du mode).
// Reforger montre ses trois actions en cartes illustrées, toujours visibles. Les objets des compagnons s'équipent ICI (rangée « qui »).
// Les règles restent dans core/ ; on ne fait que montrer, avec les mêmes `data-action` qu'avant. Le téléphone garde equip-phone.js.
import { BALANCE } from '../../data/balance.js';
import { COMPANION_RULES } from '../../data/companions.js';
import { GEAR_CLASSES, gearClassOf } from '../../data/companion-gear.js';
import { HERO_SLOTS, RARITIES, STAT_LABELS, eqSlot, heroSlot } from '../../data/items.js';
import { SET_PIECES } from '../../data/sets.js';
import { activeClass, canEquip } from '../../core/classes.js';
import { companionById, skillKillGold, unitLevel } from '../../core/companions.js';
import { bestGearFor, canEquip as unitCanEquip, gearScore, gearStats, gearUpgradePreview, gearWaiting, slotName, statText, unitGear, wearerOf } from '../../core/companion-gear.js';
import { elementBadge, unitElement } from '../../core/elements.js';
import { formatStat } from '../../core/format.js';
import { WEAK_GAIN_PCT, canReforge, canRetype, canTargetReroll, reforgeCost, retypeCost, targetRerollChoices, targetRerollCost, upgradeGainPct, upgradePreview, weakLabel } from '../../core/forge.js';
import { heroById } from '../../core/heroes.js';
import { KEEP_AFFIX_LABELS, isUpgrade } from '../../core/inventory.js';
import { xpForLevel } from '../../core/level.js';
import { itemBase, recycleLevelOf, recycleMaterials, recycleValue } from '../../core/loot.js';
import { setById, setCounts } from '../../core/sets.js';
import { STASH_SIZE } from '../../core/stash.js';
import { invFeatureOpen } from '../../core/unlocks.js';
import { animCanvas } from '../animator.js';
import { affixText, effectText, escapeHtml, formatDecimal, formatNumber, img, rarityLabel } from '../common.js';
import { mBar, mBtn, mBtnGold, mChip, mEmpty, mGrid, mModes, mStat, mTile, mTitle } from '../mobile-kit.js';
import { majorLine, unitTodo } from './equip-sheet.js';
import { companionStill } from './expeditions.js';
import { uselessPreview } from './forge.js';
import { ICON_FUNNEL, ICON_MORE, ICON_SORT, PLURAL, SIL, SORT_LABELS, STAT_ICONS, bigArt, betterEquipBtn, costOnly, equipPanel, filterBody, pill, quickRows, rarPill, ratio, setsList, skillsPanel, starsPanel, statsBlock, stashView, upPanel, verdict as verdictLine } from './equip-phone.js';
import { heroTodo, unitPower, visibleItems } from './inventory.js';

const e = escapeHtml;
const num = formatNumber;
const AFFIX_ICONS = { critChance: 'icon_crit', lifesteal: 'icon_lifesteal', thorns: 'icon_shield', goldPct: 'icon_gold', damageVsBossPct: 'icon_boss', damageVsNormalPct: 'icon_skull', regenPct: 'icon_regen', dropChance: 'icon_chest' };
const affixIcon = (type) => img(AFFIX_ICONS[type] ?? 'icon_star');
const FILTER_SLOTS = Object.keys(HERO_SLOTS);
const FILTER_ICON = { weapon: 'weapon_sword', helmet: 'helmet_helm', armor: 'armor_plate', amulet: 'amulet_ruby', ring: 'ring_signet', bracelet: 'bracelet_cuff' }; // vraies icônes d'objets, en couleur
const filterArt = (slot) => `<img class="px" src="assets/ui/art106/item_${FILTER_ICON[slot] ?? 'weapon_sword'}.png" alt="">`;
const slotArt = (slot, cls = '') => `<img class="px ${cls}" src="assets/ui/art106/slot_empty_${e(SIL(slot))}.png" alt="">`;
const withLvl = (html, level) => html.replace(/<\/(button|span)>$/, `<span class="de-lv">Niv. ${e(level)}</span></$1>`); // « Niv. 310 » en bas de la case, comme la maquette
const RF_ART = { effect: 'fuse', target: 'upgrade', type: 'craft' }; // illustrations existantes (assets/ui/art104/forge_step_*.png), voir LISTE-PIXELLAB.md

// =====================================================================================================================
// Écran
// =====================================================================================================================
export function deskView(ui, state, ctx) {
  const v = ui.view;
  const c = { ...ctx, look: heroById(state.heroes?.active) };
  return `<div class="m-frame de">${mTitle('icon_bag', 'Équipement', true)}<div class="d-cols3a de-cols">${whoColumn(state, c)}${bagColumn(ui, state, c)}${detailColumn(ui, state, c)}</div></div>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Colonne 1 : le personnage
// ---------------------------------------------------------------------------------------------------------------------
function whoRow(state, ctx) {
  const one = (id, name, art, rarity, todo) => `<button type="button" class="em-who r-${rarity}${ctx.who === id ? ' on' : ''}" data-action="gear-who" data-value="${e(id)}" aria-pressed="${ctx.who === id}" aria-label="${e(name)}" title="${e(name)}">${art}${todo ? '<i class="m-bang" aria-label="Une amélioration est possible">!</i>' : ''}</button>`;
  const list = [one('hero', 'Héros', animCanvas('hero', 34, 34, 2), 'common', heroTodo(state, ctx.plan)), ...ctx.team.map((u) => one(u.id, u.name, companionStill(u), u.rarity, unitTodo(state, u)))];
  return `<div class="de-whos" role="group" aria-label="Personnage">${list.join('')}</div>`;
}

function character(state, ctx) {
  const { unit, st } = ctx;
  const level = unit ? unitLevel(state, unit.id) : state.level;
  const maxLv = unit ? COMPANION_RULES.maxLevel : null;
  const pct = unit ? ratio(level, COMPANION_RULES.maxLevel) : ratio(state.xp, xpForLevel(state.level));
  const power = unit ? unitPower(state, unit) : st.combatPower;
  let name, pills;
  if (unit) {
    name = unit.name;
    pills = `${rarPill(unit.rarity)}${elementBadge(unitElement(unit.id))}${pill('role', GEAR_CLASSES[gearClassOf(unit)].label)}`;
  } else {
    const cls = activeClass(state);
    name = 'Héros';
    pills = pill('role', cls.name, ` style="--pc:${e(cls.color ?? '#9fb0d8')}"`);
  }
  return `<section class="em-char de-char" aria-label="${e(name)}"><div class="em-art"><div class="em-art-in">${bigArt(state, ctx)}</div></div>
    <div class="em-id"><b class="em-cname">${e(name)}</b><div class="em-pills">${pills}</div>
      <div class="em-lv"><span>Niv. ${level}${maxLv ? ` <small>/ ${maxLv}</small>` : ''}</span>${mBar(pct)}</div>
      <div class="m-card em-pow">${img('icon_crown')}<span>Puissance</span><b class="m-power">${e(num(power))}</b></div></div></section>`;
}

function placeTiles(state, ctx) {
  const { unit } = ctx;
  const worn = unit ? unitGear(state, unit.id) : state.equipment;
  const cells = Object.keys(unit ? worn : HERO_SLOTS).map((slot) => {
    const item = worn[slot] ?? null;
    const up = unit ? ctx.unitSlots.has(slot) : Boolean(ctx.best[slot]);
    const sel = item ? ctx.item?.id === item.id : ctx.slot === slot && !ctx.item;
    return mTile(item, { size: 96, action: 'eq-slot', value: slot, id: item?.id, up, empty: !item, slot: SIL(slot), selected: sel, label: unit ? slotName(unit, slot) : HERO_SLOTS[slot] });
  });
  return `<div class="em-slots de-slots n${cells.length}">${mGrid(cells, 3)}</div>`;
}

function whoColumn(state, ctx) {
  const { unit, tab } = ctx;
  const n = unit ? bestGearFor(state, unit.id).length : ctx.plan.changes.length;
  const teamGear = state.companions.equipped.some((id) => gearWaiting(state, id));
  const quick = mBtn(`Équipement rapide${n ? ` (${n})` : ''}`, { action: 'eq-quick', value: ctx.who, disabled: !n, icon: 'icon_upgrade', cls: ctx.tab === 'gear' && n ? 'de-quick' : '' });
  const second = unit ? mBtn('Étoiles', { action: 'eq-tab', value: 'stars', icon: 'icon_star', cls: tab === 'stars' ? 'on' : '' }) : mBtn('Ensembles', { action: 'eq-tab', value: 'sets', icon: 'icon_book', cls: tab === 'sets' ? 'on' : '' });
  const third = unit ? mBtn('Compétences', { action: 'eq-tab', value: 'skills', icon: 'skill_quick', cls: tab === 'skills' ? 'on' : '' }) : '';
  return `<section class="de-col de-who" aria-label="Personnage">${whoRow(state, ctx)}${character(state, ctx)}${placeTiles(state, ctx)}${statsBlock(state, ctx)}
    <div class="de-btns2">${quick}${second}</div>${third}
    ${mBtn('Équipement rapide · toute l\'équipe', { action: 'gear-team', disabled: !teamGear, icon: 'icon_summon', cls: 'de-team' })}</section>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Colonne 2 : le sac
// ---------------------------------------------------------------------------------------------------------------------
function bagColumn(ui, state, ctx) {
  const v = ui.view;
  const { unit } = ctx;
  const size = BALANCE.loot.inventorySize;
  const stashOn = invFeatureOpen(state, 'stash');
  const head = `<div class="em-bag-head">${stashOn
    ? `<div class="em-bag-tabs">${mChip(`Sac ${state.inventory.length} / ${size}`, { icon: 'icon_bag', action: 'inv-tab', value: 'bag', on: ctx.invTab === 'bag' })}${mChip(`Réserve ${state.stash.length} / ${STASH_SIZE}`, { icon: 'icon_chest', action: 'inv-tab', value: 'stash', on: ctx.invTab === 'stash' })}</div>`
    : `<b class="em-bag-count">${img('icon_bag')} Sac ${state.inventory.length} / ${size}</b>`}
    <button type="button" class="m-btn em-ico-btn${v.sortMenu ? ' on' : ''}" data-action="sort-menu" aria-label="Trier" title="Trier">${ICON_SORT}</button>
    <button type="button" class="m-btn em-ico-btn${v.bagMenu ? ' on' : ''}" data-action="bag-menu" aria-label="Réglages, builds et filtres avancés du sac" title="Réglages du sac">${ICON_FUNNEL}</button></div>`;
  if (v.bagMenu) { // réglages, builds et filtres avancés : à la place du sac (pas de panneau qui recouvre l'écran)
    return `<section class="m-card de-col de-bag de-bagmenu" aria-label="Réglages du sac"><div class="em-bag-head">${mBtn('‹ Sac', { action: 'bag-menu', cls: 'auto' })}<b class="em-bag-count">Réglages du sac</b></div>${filterBody(ui, state, ctx)}</section>`;
  }
  if (ctx.invTab === 'stash') return `<section class="m-card de-col de-bag" aria-label="Réserve">${head}${stashView(ui, state)}</section>`;
  const slotF = state.ui.slotFilter ?? 'all', rarF = state.ui.rarityFilter ?? 'all', sortBy = state.ui.sortBy ?? 'gain';
  const items = visibleItems(state);
  const usableBy = (i) => (unit ? unitCanEquip(state, unit.id, i).ok : canEquip(state, i));
  const shown = v.bagAll ? items : items.filter(usableBy);
  const passes = (i) => (slotF === 'all' || i.slot === slotF || eqSlot(i) === slotF) && (rarF === 'all' || i.rarity === rarF);
  const gainOf = (i) => (unit ? null : ctx.gains.get(i.id)?.pct ?? null);
  const badge = (i) => { const g = gainOf(i); if (g == null || !Number.isFinite(g) || Math.abs(g) < 0.05) return ''; return `${g > 0 ? '+' : '−'}${formatDecimal(Math.abs(g), Math.abs(g) < 10 ? 1 : 0)} %`; };
  const sorted = sortBy === 'gain' && !unit ? [...shown].sort((a, b) => (gainOf(b) ?? -1e9) - (gainOf(a) ?? -1e9)) : shown;
  const list = sorted.filter(passes);
  const tiles = list.map((i) => withLvl(mTile(i, { size: 64, pips: false, action: 'select-item', id: i.id, up: unit ? ctx.unitIds.has(i.id) : Boolean(ctx.gains.get(i.id)?.up), badge: badge(i), selected: ctx.item?.id === i.id, attrs: usableBy(i) ? '' : 'data-dim="1"' }), i.level));
  // Filtres : un bouton à icône par place (plus de liste déroulante), puis la rareté en gemmes de couleur.
  const fb = (value, label, art, on) => `<button type="button" class="de-fbtn${on ? ' on' : ''}" data-action="filter" data-value="${value}" aria-pressed="${on}" aria-label="${e(label)}" title="${e(label)}">${art}</button>`;
  const slotRow = `<div class="de-filters" role="group" aria-label="Filtrer par place">${fb('all', 'Tout', img('icon_bag'), slotF === 'all')}${FILTER_SLOTS.map((s) => fb(s, PLURAL[s] ?? HERO_SLOTS[s], filterArt(s), slotF === s)).join('')}</div>`;
  const rb = (value, label, on, cls) => `<button type="button" class="de-rbtn ${cls}${on ? ' on' : ''}" data-action="rarity-set" data-value="${value}" aria-pressed="${on}" aria-label="${e(label)}" title="${e(label)}"><i></i></button>`;
  const rarRow = `<div class="de-rars" role="group" aria-label="Filtrer par rareté"><span class="de-rars-k">Rareté</span>${rb('all', 'Toutes les raretés', rarF === 'all', 'all')}${RARITIES.map((r) => rb(r.id, r.label, rarF === r.id, `r-${r.id}`)).join('')}</div>`;
  const sortRow = v.sortMenu ? `<div class="m-chips" role="group" aria-label="Trier par">${Object.entries(SORT_LABELS).map(([k, l]) => mChip(l, { action: 'sort-set', value: k, on: sortBy === k })).join('')}</div>` : '';
  const full = state.inventory.length >= size ? '<p class="em-full" role="alert">Sac plein : recycle ou range dans la Réserve.</p>' : '';
  // v10.17.1 (1) : sac vide : une petite ligne « Sac vide › Aller combattre » (ferme la fenêtre) au lieu du grand coffre
  const empty = list.length ? '' : slotF === 'all' && rarF === 'all'
    ? `<p class="eq-bag-empty"><span>Sac vide</span> <button type="button" class="btn-link eq-go-fight" data-action="close-panel">› Aller combattre</button></p>`
    : mEmpty('Aucun objet avec ce filtre.', { icon: 'icon_chest' });
  const u = uselessPreview(state);
  return `<section class="m-card de-col de-bag" aria-label="Sac">${head}${slotRow}${rarRow}${sortRow}${list.length ? mGrid(tiles, 5) : empty}${full}
    ${mBtn(`Recycler les objets inutiles (${u.list.length})`, { action: 'recycle-useless', disabled: !u.list.length, icon: 'icon_shard', cls: 'de-recycle' })}</section>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Colonne 3 : détails
// ---------------------------------------------------------------------------------------------------------------------
const detTitle = (text, actions = '', menu = '') => `<div class="de-det-top"><span class="de-det-title">${e(text)}</span>${actions ? `<span class="de-top-act">${actions}</span>` : ''}${menu}</div>`;
const back = (label = 'Équipement') => `<div class="de-back">${mBtn(`‹ ${label}`, { action: 'eq-tab', value: 'gear', cls: 'auto' })}</div>`;

function detailColumn(ui, state, ctx) {
  const v = ui.view;
  const { unit, item, tab } = ctx;
  let body;
  const quickN = unit ? ctx.unitIds.size : ctx.plan.changes.length;
  if (tab === 'sets') body = `${detTitle('Ensembles')}${back()}${setsList(state)}`;
  else if (tab === 'stars' && unit) body = `${detTitle(`Étoiles · ${unit.name}`)}${back()}${starsPanel(state, ctx)}`;
  else if (tab === 'skills' && unit) body = `${detTitle(`Compétences · ${unit.name}`)}${back()}${skillsPanel(ui, state, ctx)}`;
  else if (v.eqQuick === ctx.who && quickN) {
    body = `${detTitle('Équipement rapide')}${quickRows(state, ctx)}<div class="de-actions">${mBtnGold('Confirmer', { action: 'eq-quick-ok', value: ctx.who })}${mBtn('Annuler', { action: 'eq-quick', value: '' })}</div>`;
  } else if (item) body = itemDetail(ui, state, ctx);
  else body = emptyDetail(state, ctx);
  if (!body.includes('class="de-dock"')) body = `<div class="de-scroll">${body}</div>`;
  return `<section class="m-card de-col de-det" aria-label="Détails de l'équipement">${body}</section>`;
}

// Place vide : les objets compatibles du sac, « Équiper le meilleur ».
function emptyDetail(state, ctx) {
  const { unit, slot } = ctx;
  const name = unit ? slotName(unit, slot) : HERO_SLOTS[slot];
  const cands = unit
    ? state.inventory.filter((i) => eqSlot(i) === slot && unitCanEquip(state, unit.id, i).ok).sort((a, b) => gearScore(state, b) - gearScore(state, a)).slice(0, 8)
    : state.inventory.filter((i) => ctx.gains?.get(i.id)?.slot === slot).sort((a, b) => ctx.gains.get(b.id).pct - ctx.gains.get(a.id).pct).slice(0, 8);
  const equipAct = (i) => (unit ? { action: 'gear-equip', value: `${unit.id}|${i.id}` } : { action: 'equip', id: i.id });
  const pctOf = (i) => { const p = ctx.gains.get(i.id).pct; return `${p > 0 ? '+' : '−'}${formatDecimal(Math.abs(p), Math.abs(p) < 10 ? 1 : 0)} %`; };
  const list = cands.map((i) => `<div class="em-row">${mTile(i, { size: 56, action: 'select-item', id: i.id })}<div class="em-row-mid"><b>${e(i.name)}</b><small class="${unit ? '' : 'up'}">${unit ? e(statText(gearStats(i, state))) : e(pctOf(i))}</small></div>${mBtn('Équiper', equipAct(i))}</div>`).join('');
  const main = cands[0] ? mBtnGold('Équiper le meilleur', equipAct(cands[0])) : mBtnGold('Fabriquer à la Forge', { action: 'forge-go', value: 'craft' });
  return `${detTitle('Détails de l\'équipement')}<div class="de-head de-head-empty">${mTile(null, { size: 110, slot: SIL(slot), empty: true })}<div class="de-hid"><b class="de-name">${e(name)}</b><div class="em-pills">${pill('role', 'Place vide')}</div></div></div>
    <div class="m-card de-cands">${list || '<p class="em-note">Aucun objet pour cette place dans ton sac. Les monstres en laissent tomber ; tu peux aussi en fabriquer un à la Forge.</p>'}</div>${main}`;
}

function itemDetail(ui, state, ctx) {
  const v = ui.view;
  const { item, unit } = ctx;
  const base = itemBase(item.baseId);
  const hslot = heroSlot(item);
  const wearer = wearerOf(state, item.id);
  const heroWorn = state.equipment[hslot]?.id === item.id;
  const worn = heroWorn || Boolean(wearer);
  const wearUnit = wearer ? companionById(wearer) : null;
  const forHero = !wearer && canEquip(state, item);
  const flags = { heroWorn, wearUnit, forHero, better: !worn && forHero && isUpgrade(state, item) }; // v10.19 (6.1)
  const mode = ['up', 'reforge', 'equip'].includes(v.itemTab) ? v.itemTab : worn ? 'up' : 'equip';
  const pv = wearer ? gearUpgradePreview(state, item, skillKillGold(state)) : upgradePreview(state, item);
  const ups = item.upgrades ?? 0;
  const menuOpen = !worn && v.itemMore === item.id;
  const stashFull = state.stash.length >= STASH_SIZE;
  const mats = recycleMaterials(item);
  const lock = wearer ? '' : `<button type="button" class="m-btn em-ico-btn${item.locked ? ' on' : ''}" data-action="lock" data-id="${item.id}" aria-pressed="${Boolean(item.locked)}" aria-label="${item.locked ? 'Déverrouiller' : 'Verrouiller'}" title="${item.locked ? 'Protégé : jamais recyclé ni fusionné' : 'Protéger : jamais recyclé ni fusionné'}">${img('icon_lock')}</button>`;
  const more = worn ? '' : `<button type="button" class="m-btn em-ico-btn${menuOpen ? ' on' : ''}" data-action="item-more" data-value="${menuOpen ? '' : item.id}" aria-expanded="${menuOpen}" aria-label="Plus d'actions" title="Plus">${ICON_MORE}</button>`;
  const menu = menuOpen ? `<div class="em-menu" role="menu">${mBtn('Ranger dans la Réserve', { action: 'to-stash', id: item.id, disabled: stashFull })}${base.signature ? mBtn('Exposer au Musée', { action: 'to-museum', id: item.id }) : ''}
      ${mBtn(`Recycler +${num(recycleValue(item, BALANCE, recycleLevelOf(state)))}${mats.shards ? ` +${mats.shards} éclats` : ''}`, { action: 'recycle', id: item.id, disabled: item.locked })}</div>` : '';
  // « Objet dépassé · Niv. 310, ton étape : 325 » + « Trouver mieux » (lot 2) : seulement quand le renfort n'apporte presque rien.
  let weak = false;
  if (!wearer && !pv.atMax) { const g = upgradeGainPct(pv); weak = g !== null && g < WEAK_GAIN_PCT; }
  const oldTag = weak ? `<div class="de-old" role="note"><b>${e(weakLabel(state, item))}</b>${mBtn('Trouver mieux ›', { action: 'find-better', value: hslot, cls: 'auto' })}</div>` : '';
  const head = `<div class="de-head">${mTile(item, { size: 110, plus: ups ? `+${ups}` : '' })}
      <div class="de-hid"><b class="de-name r-${item.rarity}">${e(item.name)}</b><div class="em-pills">${rarPill(item.rarity)}${pill('slot', unit && wearUnit ? slotName(wearUnit, eqSlot(item)) : HERO_SLOTS[hslot] ?? '')}${base.signature ? pill('anc', 'Ancestral') : ''}</div>
        ${pv.max ? `<div class="em-lvl"><span>Renfort +${pv.level} <small>/ ${pv.max}</small></span>${mBar(ratio(pv.level, pv.max))}</div>` : ''}</div></div>${oldTag}${betterEquipBtn(item, flags, mode)}`;
  // Statistiques : la principale en grand, puis les autres, les effets spéciaux (avec leur icône) et le grand effet.
  const entries = Object.entries(item.stats);
  const mainKey = item.stats.damage != null ? 'damage' : item.stats.maxHp != null ? 'maxHp' : entries[0]?.[0];
  const statRows = [...entries.filter(([k]) => k === mainKey), ...entries.filter(([k]) => k !== mainKey)]
    .map(([k, val]) => mStat(STAT_ICONS[k], STAT_LABELS[k], formatStat(k, val, true), k === mainKey)).join('');
  const affixes = (item.affixes ?? []).map((a) => `<div class="de-fx">${affixIcon(a.type)}<span>${affixText(a)}</span></div>`).join('');
  const unitGives = wearUnit || (unit && !heroWorn) ? `<div class="de-fx">${img('icon_star')}<span>Sur un compagnon : ${e(statText(gearStats(item, state))) || 'aucun bonus'}</span></div>` : '';
  const set = setById(item.set);
  const sw = set ? setCounts(state.equipment)[set.id] ?? 0 : 0;
  const setBlock = set ? `<div class="m-card em-set" style="--sc:${e(set.color)}"><div class="em-set-head">${img(`set_${set.id}`)}<div><b>Set ${e(set.name)} (${sw}/${SET_PIECES.at(-1)})</b></div></div>
      <ul>${SET_PIECES.map((n) => `<li class="${sw >= n ? 'on' : ''}"><i>${sw >= n ? '✓' : '○'}</i><span>${n} pièces : ${e(effectText(set.bonuses[n]))}</span></li>`).join('')}</ul></div>` : '';
  const museum = base.signature ? '<p class="de-museum">Exposé au Musée : bonus gardé même sans être porté</p>' : '';
  const stats = `<div class="de-stats">${statRows}${affixes}${unitGives}${majorLine(state, item)}${mStat('icon_upgrade', 'Niveau d\'objet', String(item.level))}${museum}</div>${setBlock}${verdictLine(state, ctx, item, flags)}`;
  const modes = mModes([{ id: 'up', label: 'Améliorer', icon: 'icon_upgrade', action: 'item-tab', value: 'up' }, { id: 'reforge', label: 'Reforger', icon: 'icon_anvil', action: 'item-tab', value: 'reforge' },
    { id: 'equip', label: 'Équiper', icon: 'icon_bag', action: 'item-tab', value: 'equip' }], mode, { arrow: true });
  let panel;
  if (mode === 'up') panel = upPanel(state, item, wearer, pv, { headTag: true });
  else if (mode === 'reforge') panel = wearer ? '<p class="em-note">Les pièces d\'un compagnon ne se reforgent pas.</p>' : reforgePanel(ui, state, item);
  else panel = equipPanel(ui, state, ctx, item, flags);
  // La tête reste en haut, les statistiques défilent seules si la fenêtre est basse ; les modes et le panneau (Améliorer, Reforger, Équiper) restent en bas, visibles.
  return `<div class="de-fixtop">${detTitle('Détails de l\'équipement', `${lock}${more}`, menu)}${head}</div><div class="de-scroll">${stats}</div><div class="de-dock">${modes}<div class="de-panel de-panel-${mode}" role="tabpanel">${panel}</div></div>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Reforger : trois cartes illustrées, toujours visibles
// ---------------------------------------------------------------------------------------------------------------------
function reforgePanel(ui, state, item) {
  const v = ui.view;
  const shards = state.materials.shards;
  const ok = canReforge(item);
  const cost = reforgeCost(state);
  const canT = canTargetReroll(item);
  const tCost = canT ? targetRerollCost(item) : 0;
  const canType = canRetype(item);
  const tyCost = retypeCost();
  const prevRaw = v.rfPrev?.id === item.id ? v.rfPrev : null;
  const prev = prevRaw && prevRaw.snap && prevRaw.snap.upgrades === (item.upgrades ?? 0) && prevRaw.snap.level === item.level ? prevRaw : null;
  const choices = canT ? targetRerollChoices(item) : [];
  const sel = choices.includes(v.rerollType) ? v.rerollType : null;
  const pickOpen = canT && v.rfPickOpen === item.id;
  const card = (key, title, line, costHtml, btn, disabledNote = '') => `<div class="de-rcard${key === 'effect' && !prev && ok ? ' main' : ''}${disabledNote ? ' off' : ''}"><img class="px de-rart" src="assets/ui/art104/forge_step_${RF_ART[key]}.png" alt="">
      <b>${e(title)}</b><small>${e(disabledNote || line)}</small>${disabledNote ? '' : `<div class="de-rcost">${costHtml}</div>`}${btn}</div>`;
  const effectBtn = ok && !prev ? mBtnGold('Changer', { action: 'reforge', id: item.id, disabled: shards < cost }) : mBtn('Changer', { action: 'reforge', id: item.id, disabled: !ok || shards < cost });
  const armed = v.rerollArmed === `${item.id}|${sel}`;
  const cards = `<div class="de-rcards">
    ${card('effect', 'Changer l\'effet', 'Tire au hasard un nouvel effet ✦', costOnly('icon_shard', cost, shards >= cost), effectBtn, ok ? '' : 'Pas d\'effet spécial à changer.')}
    ${card('target', 'Relance orientée', 'Tu choisis l\'effet voulu', costOnly('icon_shard', tCost, shards >= tCost), mBtn(pickOpen ? 'Fermer' : 'Choisir…', { action: 'rf-pick', value: item.id, disabled: !canT }), canT ? '' : 'Épique et Légendaire seulement.')}
    ${card('type', 'Changer le type', 'Garde le niveau, change le modèle de l\'arme', costOnly('icon_shard', tyCost, shards >= tyCost), mBtn('Changer', { action: 'retype-item', id: item.id, disabled: !canType || shards < tyCost }), canType ? '' : item.slot === 'weapon' ? 'Aucun autre modèle pour cette arme.' : 'Pour les armes seulement.')}</div>`;
  // Liste des effets (avec leur icône) : s'ouvre par « Choisir… » ; un effet choisi, « Relancer » demande une confirmation.
  const list = !pickOpen ? '' : `<div class="de-effects" role="group" aria-label="Effet voulu">${choices.map((t) => `<button type="button" class="de-eff${t === sel ? ' on' : ''}" data-action="reroll-pick" data-value="${t}" aria-pressed="${t === sel}">${affixIcon(t)}<span>${e(KEEP_AFFIX_LABELS[t] ?? t)}</span></button>`).join('')}</div>
    ${sel ? mBtn(`${armed ? 'Confirmer' : 'Relancer'} : ${KEEP_AFFIX_LABELS[sel] ?? sel} (${num(tCost)} éclats)`, { action: 'target-reroll', id: item.id, value: sel, disabled: shards < tCost, cls: armed ? 'armed' : '' }) : '<p class="em-note">Choisis un effet.</p>'}`;
  // Avant / Après un changement d'effet : « Garder » ou « Revenir ».
  const fxList = (arr) => (arr ?? []).length ? arr.map((a) => `<div class="de-fx">${affixIcon(a.type)}<span>${affixText(a)}</span></div>`).join('') : '<div class="de-fx none"><span>Aucun effet</span></div>';
  const ab = !prev ? '' : `<div class="de-ab"><div class="de-ab-col"><h5>Avant</h5>${fxList(prev.snap.affixes)}</div><i class="de-ab-arrow" aria-hidden="true">»</i><div class="de-ab-col new"><h5>Après</h5>${fxList(item.affixes)}</div></div>
    <div class="de-actions">${mBtnGold('Garder', { action: 'reforge-keep' })}${mBtn('Revenir', { action: 'reforge-revert', id: item.id })}</div>`;
  const current = !prev && (item.affixes ?? []).length ? `<p class="em-note de-current">Effet actuel : ✦ ${(item.affixes ?? []).map((a) => e(affixText(a))).join(' · ')}. Le nouveau s'affiche avant de le garder.</p>` : '';
  return `<div class="de-rhead"><b>Reforger</b><span>tu as ${img('icon_shard')} ${e(num(shards))} éclats</span></div>${ab}${cards}${list}${current}`;
}

// Après le rendu : dans la fiche, les lignes de statistiques qui ne tiennent pas dans leur zone sont masquées (visibility), jamais coupées en deux
// ni dessinées sous les modes. Appelé par inventory.js (afterRender).
export function fitDeskStats(body) {
  for (const box of body.querySelectorAll('.de-det .de-scroll')) {
    const rows = [...box.children, ...box.querySelectorAll('.de-stats > *')];
    for (const r of rows) r.style.visibility = '';
    const lim = box.getBoundingClientRect().bottom + 0.5;
    for (const r of rows) if (r.getBoundingClientRect().bottom > lim && !r.classList.contains('de-stats')) r.style.visibility = 'hidden';
    const st = box.querySelector('.de-stats');
    if (st && st.getBoundingClientRect().top >= lim) st.style.visibility = 'hidden';
  }
}
