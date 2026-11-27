// v10.12 (lot « équipement ») : Héros › Équipement et fiche « Détails de l'équipement » sur téléphone, bâtis avec le kit
// mobile (src/ui/mobile-kit.js, style dans src/ui/mobile-equip.css, tout sous `#app.m-phone`). Le PC garde son rendu
// (inventory.js / equip-sheet.js) : ce fichier n'est appelé que si `isPhoneView(ui)`.
// Les règles restent dans core/ ; ici on ne fait que montrer, avec les mêmes `data-action` qu'avant.
import { BALANCE } from '../../data/balance.js';
import { BASTION_UNLOCK_STAGE } from '../../data/bastion.js';
import { COMPANION_RULES } from '../../data/companions.js';
import { GEAR_CLASSES, STAT_NAMES, gearClassOf } from '../../data/companion-gear.js';
import { DUP_BONUS_PCT, ULT_UNLOCK_COPIES } from '../../data/progression.js';
import { HERO_SLOTS, RARITIES, STAT_LABELS, eqSlot, heroSlot } from '../../data/items.js';
import { ITEM_SETS, SET_PIECES, SET_SPECIALTY } from '../../data/sets.js';
import { ZONES } from '../../data/zones.js';
import { bastionOpen, forgeLevel } from '../../core/bastion.js';
import { companionProfile } from '../../core/arena.js';
import { activeClass, canEquip, weaponClass } from '../../core/classes.js';
import { STAR_TIERS, companionById, companionUpgradeCost, heroElement, isAwakened, skillKillGold, unitLevel } from '../../core/companions.js';
import { upgradeAllGearWhy, bestGearFor, canEquip as unitCanEquip, classLabel, gearScore, gearStats, gearStatsWith, gearUpgradePreview, slotName, statText, unitGear, unitGearStats, wearerOf } from '../../core/companion-gear.js';
import { elementBadge, unitElement } from '../../core/elements.js';
import { formatStat } from '../../core/format.js';
import { heroById } from '../../core/heroes.js';
import { WEAK_GAIN_PCT, upgradeAllHeroWhy, canReforge, canRetype, canTargetReroll, fusableRarities, reforgeCost, retypeCost, targetRerollChoices, targetRerollCost, upgradeGainPct, upgradePreview, upgradeRanking, weakLabel } from '../../core/forge.js';
import { GEAR_PROFILES, KEEP_AFFIX_LABELS, RECYCLE_MODES, bulkRecycleCandidates, recycleRules, teamUpgradeFor } from '../../core/inventory.js';
import { BIND_MODES } from '../../core/loadouts.js';
import { xpForLevel } from '../../core/level.js';
import { itemBase, recycleLevelOf, recycleMaterials, recycleValue } from '../../core/loot.js';
import { skillLevels } from '../../core/progression.js';
import { setById, setCounts } from '../../core/sets.js';
import { STASH_SIZE, stashSets } from '../../core/stash.js';
import { computeHeroStats } from '../../core/stats.js';
import { invFeatureOpen } from '../../core/unlocks.js';
import { animCanvas } from '../animator.js';
import { affixText, effectText, escapeHtml, formatDecimal, formatNumber, hdArt, img, rarityLabel } from '../common.js';
import { mBar, mBtn, mBtnGold, mChip, mCost, mEmpty, mGrid, mModes, mSheet, mStat, mTile, mTitle } from '../mobile-kit.js';
import { compareList, majorLine, pctText, unitTodo } from './equip-sheet.js';
import { companionPortrait, companionStill } from './expeditions.js';
import { uselessPreview } from './forge.js';
import { skillBubble, skillIcons } from './unit-popup.js';
import { bastionShortcuts, heroTodo, unitPower, visibleItems } from './inventory.js';

const e = escapeHtml;
const num = formatNumber;
export const STAT_ICONS = { damage: 'weapon_sword', attackSpeed: 'icon_bolt', maxHp: 'icon_heart', armor: 'icon_shield' };
const AFFIX_UNITS = { dropChance: ' pts', regenPct: ' % PV/s' };
export const SORT_LABELS = { gain: 'Meilleur gain', rarity: 'Rareté', level: 'Niveau', power: 'Puissance', recent: 'Récent' };
export const PROFILE_ICONS = { attack: 'icon_damage', survival: 'icon_defense', fortune: 'icon_gold' };
export const PLURAL = { weapon: 'Armes', helmet: 'Casques', armor: 'Armures', amulet: 'Colliers', ring: 'Anneaux', bracelet: 'Bracelets' };
export const SIL = (slot) => (slot === 'accessory' ? 'amulet' : slot); // silhouette d'une place vide

// Petits pictogrammes (SVG en ligne : le jeu n'a pas d'icône d'entonnoir, de tri ni d'échange).
const SVG = (d, extra = '') => `<svg class="em-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${extra}>${d}</svg>`;
export const ICON_FUNNEL = SVG('<path d="M3 4h18l-7 8.5V20l-4-2v-5.5z" fill="currentColor"/>');
export const ICON_SORT = SVG('<path d="M4 6h16M4 12h11M4 18h6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M18 14v7m0 0l-3-3m3 3l3-3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>');
export const ICON_SWAP = SVG('<path d="M5 8h13m0 0l-3.5-3.5M18 8l-3.5 3.5M19 16H6m0 0l3.5-3.5M6 16l3.5 3.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>');
export const ICON_MORE = SVG('<circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/>');

// Fenêtre de téléphone : classe m-phone posée par ui.js, ou largeur ≤ 600 px (comme les autres panneaux).
export const isPhoneView = (ui) => Boolean(ui?.root?.classList?.contains('m-phone')) || (ui?.root?.clientWidth ?? 9999) <= 600;

export const pill = (cls, text, extra = '') => `<span class="em-pill ${cls}"${extra}>${e(text)}</span>`;
const AFFIX_ICONS = { critChance: 'icon_crit', lifesteal: 'icon_lifesteal', thorns: 'icon_shield', goldPct: 'icon_gold', damageVsBossPct: 'icon_boss', damageVsNormalPct: 'icon_skull', regenPct: 'icon_regen', dropChance: 'icon_chest' };
export const affixIcon = (type) => img(AFFIX_ICONS[type] ?? 'icon_star'); // l'icône de l'effet spécial (fiche d'objet du téléphone)
export const rarPill = (rarity) => pill(`r-${rarity}`, rarityLabel(rarity));
export const ratio = (a, b) => (b > 0 ? Math.max(0, Math.min(1, a / b)) : 0);
// Coût sans « tu as » (la place manque dans une ligne) : vert si on peut payer, rouge sinon.
export const costOnly = (pic, need, ok) => `<span class="m-cost ${ok ? 'ok' : 'ko'}"><span class="m-cost-ico">${img(pic)}</span><span class="m-cost-n">${e(num(need))}</span></span>`;
export const rowLabel = (r) => (r.kind === 'stat' ? STAT_LABELS[r.stat] : KEEP_AFFIX_LABELS[r.type] ?? 'Effet spécial');
export const rowVal = (r, v) => (r.kind === 'stat' ? formatStat(r.stat, v, true) : `${formatDecimal(v, 1)}${AFFIX_UNITS[r.type] ?? ' %'}`);
export const ba = (label, a, b, good = true) => `<div class="em-ba"><span class="em-ba-k">${e(label)}</span><span class="em-ba-a">${e(a)}</span><i>»</i><b class="${good ? 'up' : 'down'}">${e(b)}</b></div>`;

// =====================================================================================================================
// Écran
// =====================================================================================================================
export function phoneView(ui, state, ctx) {
  const v = ui.view;
  const c = { ...ctx, open: v.sheetOpen === 'item', look: heroById(state.heroes?.active) };
  const modes = c.unit
    ? [['gear', 'Équipement', 'icon_gear'], ['up', 'Améliorer', 'icon_upgrade'], ['stars', 'Étoiles', 'icon_star'], ['skills', 'Compétences', 'skill_quick']]
    : [['gear', 'Équipement', 'icon_gear'], ['up', 'Améliorer', 'icon_upgrade'], ['reforge', 'Reforger', 'icon_anvil'], ['sets', 'Sets', 'icon_book']];
  const upDot = ctx.unit ? Object.values(unitGear(state, ctx.unit.id)).some((it) => it && gearUpgradePreview(state, it, skillKillGold(state)).canPay)
    : Object.values(state.equipment).some((it) => it && upgradePreview(state, it).canPay);
  const modeBar = mModes(modes.map(([id, label, ic]) => ({ id, label, icon: ic, action: 'eq-tab', value: id, badge: id === 'up' && upDot })), ctx.tab);
  let content;
  if (ctx.tab === 'up') content = upgradeList(ui, state, c);
  else if (ctx.tab === 'reforge') content = reforgeList(ui, state, c);
  else if (ctx.tab === 'sets') content = setsList(state);
  else if (ctx.tab === 'stars') content = starsPanel(state, c);
  else if (ctx.tab === 'skills') content = skillsPanel(ui, state, c);
  else content = bagCard(ui, state, c);
  let sheet = '';
  if (c.open) sheet = sheetFor(ui, state, c);
  if (v.bagMenu) sheet += filterSheet(ui, state, c);
  // v10.19 (3) : tout sur un écran : modes en haut, avatars de 44 px, une ligne pour le personnage, 6 places sur une rangée,
  // « Équiper le meilleur (N) », puis le Sac (ou le mode choisi) et les stats en 2 colonnes. Le haut du Sac se voit sans défiler.
  return `<div class="m-frame em em19">${mTitle('icon_gear', 'Équipement', true)}${modeBar}${resourceChips(state, c)}${whoRow(state, c)}${charLine(state, c)}${slotTiles(state, c)}${bestButton(state, c)}${content}${statsBlock(state, c)}</div>${sheet}`;
}

// Après le rendu : le personnage choisi se centre dans la rangée ; un glissé sur l'en-tête de la fiche passe à la place voisine.
export function phoneAfter(ui, body) {
  const row = body.querySelector('.em-whos-row');
  const on = row?.querySelector('.em-who.on');
  if (row && on) row.scrollLeft = Math.max(0, on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
  const eff = body.querySelector('.em-effects') ?? document.querySelector('#eq-sheet .em-effects'); // Reforger › « Choisir… » : la liste des effets s'ouvre dans le panneau, on la met en vue une seule fois
  const vw = ui.view ?? {};
  if (!eff) { vw.rfPickSeen = null; vw.rfSelSeen = null; }
  else {
    if (vw.rfPickSeen !== vw.rfPickOpen) { vw.rfPickSeen = vw.rfPickOpen; eff.scrollIntoView?.({ block: 'nearest' }); }
    const go = eff.nextElementSibling; // « Relancer : … » : une fois l'effet choisi, le bouton est mis en vue
    const key = `${vw.rerollType}|${vw.rerollArmed ?? ''}`;
    if (go?.classList.contains('m-btn') && vw.rfSelSeen !== key) { vw.rfSelSeen = key; go.scrollIntoView?.({ block: 'nearest' }); }
  }
  const panel = ui.$?.('panel') ?? document.getElementById('panel');
  if (!panel || panel.dataset.emSwipe) return;
  panel.dataset.emSwipe = '1';
  let x0 = null, y0 = 0;
  panel.addEventListener('touchstart', (ev) => { const t = ev.target.closest?.('.em-swipe'); if (!t) { x0 = null; return; } x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchend', (ev) => {
    if (x0 === null) return;
    const dx = ev.changedTouches[0].clientX - x0, dy = ev.changedTouches[0].clientY - y0;
    const sheet = ev.target.closest?.('.m-sheet');
    x0 = null;
    if (!sheet || Math.abs(dx) < 50 || Math.abs(dy) > 40) return;
    sheet.querySelector(dx < 0 ? '[data-nav="next"]' : '[data-nav="prev"]')?.click();
  }, { passive: true });
}

// ---------------------------------------------------------------------------------------------------------------------
// Haut de l'écran
// ---------------------------------------------------------------------------------------------------------------------
function resourceChips(state, ctx) {
  const chip = (key, pic, n, word) => mChip(num(n), { icon: pic, attrs: `data-gloss="${key}" title="${e(word)}" aria-label="${e(word)}"` });
  return `<div class="em-res" role="group" aria-label="Tes ressources">${chip('gold', 'coin', state.gold, 'Or : améliorer')}${chip('shards', 'icon_shard', state.materials.shards, 'Éclats : renforcer')}`
    + `${ctx.unit ? chip('grimoire', 'icon_grimoire', state.materials.grimoire ?? 0, 'Grimoires') + chip('ascension', 'icon_ascension', state.materials.ascension ?? 0, 'Pierres d\'éveil') : ''}</div>`;
}

// Rangée des personnages : portraits de 56 px, ‹ › (même action gear-who) ; « ! » si une amélioration attend.
function whoRow(state, ctx) {
  const ids = ctx.order;
  const i = ids.indexOf(ctx.who);
  const arrow = (dir) => (ids.length > 1
    ? `<button type="button" class="em-arrow ${dir < 0 ? 'prev' : 'next'}" data-action="gear-who" data-value="${ids[(i + dir + ids.length) % ids.length]}" aria-label="${dir < 0 ? 'Personnage précédent' : 'Personnage suivant'}">${dir < 0 ? '‹' : '›'}</button>` : '<span></span>');
  const one = (id, name, art, rarity, todo) => `<button type="button" class="em-who r-${rarity}${ctx.who === id ? ' on' : ''}" data-action="gear-who" data-value="${e(id)}" aria-pressed="${ctx.who === id}" aria-label="${e(name)}" title="${e(name)}">${art}${todo ? '<i class="m-bang" aria-label="Une amélioration est possible">!</i>' : ''}</button>`;
  const list = [one('hero', 'Héros', animCanvas('hero', 34, 34, 2), 'common', heroTodo(state, ctx.plan)), ...ctx.team.map((u) => one(u.id, u.name, companionStill(u), u.rarity, unitTodo(state, u)))];
  return `<div class="em-whos">${arrow(-1)}<div class="em-whos-row" role="group" aria-label="Personnage">${list.join('')}</div>${arrow(1)}</div>`;
}

// Le personnage en grand (mêmes illustrations qu'avant).
export function bigArt(state, ctx) {
  const { unit, sel } = ctx;
  if (unit) return isAwakened(state, unit.id) ? `<img class="hd-art eq-art px-hd" src="assets/hd/px/awake/ally_${unit.id}.webp" alt="" loading="lazy">` : hdArt(unit, 'eq-art') || companionPortrait(unit, true);
  const look = ctx.look;
  const prev = sel.item && canEquip(state, sel.item) && !wearerOf(state, sel.item.id) ? { ...state.equipment, [heroSlot(sel.item)]: sel.item } : state.equipment;
  return `${look ? hdArt(look, 'eq-art') : ''}<span class="eq-live">${animCanvas('hero', 64, 64, 3, `data-big="1" data-preview="${e(JSON.stringify(prev))}"`)}</span>`;
}

// Bloc personnage : hauteur fixe (176 px).
export function characterBlock(state, ctx) {
  const { unit, st } = ctx;
  const level = unit ? unitLevel(state, unit.id) : state.level;
  const pct = unit ? ratio(level, COMPANION_RULES.maxLevel) : ratio(state.xp, xpForLevel(state.level));
  const power = unit ? unitPower(state, unit) : st.combatPower;
  const n = unit ? bestGearFor(state, unit.id).length : ctx.plan.changes.length;
  const quick = n
    ? `<button type="button" class="em-quick" data-action="eq-quick" data-value="${ctx.who}" aria-label="Équipement rapide : ${n} objet${n > 1 ? 's' : ''} à équiper" title="Équipement rapide">${ICON_SWAP}<i class="m-bang">${n}</i></button>`
    : '<span class="em-quick done" title="Le meilleur est porté" aria-label="Le meilleur est porté">✓</span>';
  let name, pills;
  if (unit) {
    name = unit.name;
    pills = `${rarPill(unit.rarity)}${elementBadge(unitElement(unit.id))}${pill('role', GEAR_CLASSES[gearClassOf(unit)].label)}`;
  } else {
    const cls = activeClass(state);
    name = 'Héros';
    pills = pill('role', cls.name, ` style="--pc:${e(cls.color ?? '#9fb0d8')}"`);
  }
  return `<section class="em-char" aria-label="${e(name)}"><div class="em-art"><div class="em-art-in">${bigArt(state, ctx)}</div>${quick}</div>
    <div class="em-id"><b class="em-cname">${e(name)}</b><div class="em-pills">${pills}</div>
      <div class="em-lv"><span>Niv. ${level}</span>${mBar(pct)}</div>
      <div class="m-card em-pow">${img('icon_damage')}<span>Puissance</span><b class="m-power">${e(num(power))}</b></div></div></section>`;
}

// v10.19 (3.3) : le personnage en une ligne : mini-portrait de 56 px, « Héros Chevalier · Niv. 153 », « Puissance … »,
// et à droite « 4 objets meilleurs ▲ » en vert.
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const bestCount = (state, ctx) => (ctx.unit ? bestGearFor(state, ctx.unit.id).length : ctx.plan.changes.length);
function charLine(state, ctx) {
  const { unit, st } = ctx;
  const level = unit ? unitLevel(state, unit.id) : state.level;
  const power = unit ? unitPower(state, unit) : st.combatPower;
  const n = bestCount(state, ctx);
  const name = unit ? unit.name : 'Héros';
  const role = unit ? GEAR_CLASSES[gearClassOf(unit)].label : activeClass(state).name;
  const art = unit ? companionStill(unit) : animCanvas('hero', 34, 34, 2);
  const better = n ? `<span class="em-better" aria-label="${n} objet${n > 1 ? 's' : ''} meilleur${n > 1 ? 's' : ''}">${plural(n, 'objet meilleur', 'objets meilleurs')} ▲</span>`
    : '<span class="em-better done">Le meilleur est porté ✓</span>';
  return `<section class="em-line" aria-label="${e(name)}"><span class="em-mini r-${e(unit?.rarity ?? 'common')}">${art}</span>
    <span class="em-line-id"><b class="em-cname">${e(name)} <small>${e(role)} · Niv. ${level}</small></b>
      <span class="em-line-pow">${img('icon_damage')}Puissance <b class="m-power">${e(num(power))}</b></span></span>${better}</section>`;
}

// v10.19 (3.5) : gros bouton doré « ⬆ Équiper le meilleur (N) » (même action que l'équipement rapide).
function bestButton(state, ctx) {
  const n = bestCount(state, ctx);
  return n ? `<div class="em-best" data-nodock>${mBtnGold(`⬆ Équiper le meilleur (${n})`, { action: 'eq-quick', value: ctx.who, attrs: 'data-gold-top="1"' })}</div>` : '';
}

// Places portées : 80 px (héros 2 × 3, compagnon 1 × 3) ; v10.19 (3.4) : une seule rangée de 6 (56 px au plus, nom dessous en 11 px).
function slotTiles(state, ctx) {
  const { unit } = ctx;
  const worn = unit ? unitGear(state, unit.id) : state.equipment;
  const cells = Object.keys(unit ? worn : HERO_SLOTS).map((slot) => {
    const item = worn[slot] ?? null;
    const up = unit ? ctx.unitSlots.has(slot) : Boolean(ctx.best[slot]);
    const sel = ctx.open && (item ? ctx.item?.id === item.id : ctx.slot === slot && !ctx.item);
    return mTile(item, { size: 56, action: 'eq-slot', value: slot, id: item?.id, up, empty: !item, slot: SIL(slot), selected: sel, label: unit ? slotName(unit, slot) : HERO_SLOTS[slot] });
  });
  return `<div class="em-slots n${cells.length}">${mGrid(cells, cells.length)}</div>`;
}

// Statistiques en 2 × 2.
export function statsBlock(state, ctx) {
  const { unit, st } = ctx;
  if (!unit) {
    return `<div class="m-stats2">${mStat('weapon_sword', 'Dégâts/s', num(st.dps))}${mStat('icon_heart', 'Vie', num(st.maxHp))}${mStat('icon_bolt', 'Vitesse', `${formatDecimal(st.attacksPerSecond, 2)}/s`)}${mStat('icon_star', 'Critique', `${formatDecimal(st.critChance)} %`)}</div>`;
  }
  const p = companionProfile(state, unit.id);
  const g = unitGearStats(state, unit.id);
  return `<div class="m-stats2">${mStat('weapon_sword', 'Attaque', num(p.atk))}${mStat('icon_heart', 'PV', num(p.maxHp))}${mStat('icon_shield', 'Défense', num(p.def))}${mStat('icon_bolt', 'Recharge', g.cd ? `−${formatDecimal(g.cd)} %` : '0 %')}</div>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Mode Équipement : le sac
// ---------------------------------------------------------------------------------------------------------------------
function bagCard(ui, state, ctx) {
  const v = ui.view;
  const { unit } = ctx;
  const stashOn = invFeatureOpen(state, 'stash');
  const head = `<div class="em-bag-head">${stashOn
    ? `<div class="em-bag-tabs">${mChip(`Sac ${state.inventory.length}/${BALANCE.loot.inventorySize}`, { icon: 'icon_bag', action: 'inv-tab', value: 'bag', on: ctx.invTab === 'bag' })}${mChip(`Réserve ${state.stash.length}/${STASH_SIZE}`, { icon: 'icon_chest', action: 'inv-tab', value: 'stash', on: ctx.invTab === 'stash' })}</div>`
    : `<b class="em-bag-count">${img('icon_bag')} Sac ${state.inventory.length}/${BALANCE.loot.inventorySize}</b>`}
    <button type="button" class="m-btn em-ico-btn${v.bagMenu ? ' on' : ''}" data-action="bag-menu" aria-label="Filtres, builds et réglages du sac" title="Filtres">${ICON_FUNNEL}</button>
    <button type="button" class="m-btn em-ico-btn${v.sortMenu ? ' on' : ''}" data-action="sort-menu" aria-label="Trier" title="Trier">${ICON_SORT}</button></div>`;
  if (ctx.invTab === 'stash') return `<div class="m-card em-bag">${head}${stashView(ui, state)}</div>`;
  const slotF = state.ui.slotFilter ?? 'all', rarF = state.ui.rarityFilter ?? 'all', sortBy = state.ui.sortBy ?? 'gain';
  const items = visibleItems(state);
  const usableBy = (i) => (unit ? unitCanEquip(state, unit.id, i).ok : canEquip(state, i));
  const shown = v.bagAll ? items : items.filter(usableBy);
  const passes = (i) => (slotF === 'all' || i.slot === slotF || eqSlot(i) === slotF) && (rarF === 'all' || i.rarity === rarF);
  const gainOf = (i) => (unit ? null : ctx.gains.get(i.id)?.pct ?? null);
  const badge = (i) => { const g = gainOf(i); if (g == null || !Number.isFinite(g) || Math.abs(g) < 0.05) return ''; return `${g > 0 ? '+' : '−'}${formatDecimal(Math.abs(g), Math.abs(g) < 10 ? 1 : 0)} %`; };
  const sorted = sortBy === 'gain' && !unit ? [...shown].sort((a, b) => (gainOf(b) ?? -1e9) - (gainOf(a) ?? -1e9)) : shown;
  const list = sorted.filter(passes);
  const tiles = list.map((i) => mTile(i, { size: 64, action: 'select-item', id: i.id, up: unit ? ctx.unitIds.has(i.id) : Boolean(ctx.gains.get(i.id)?.up), badge: badge(i), selected: ctx.open && ctx.item?.id === i.id, attrs: usableBy(i) ? '' : 'data-dim="1"' }));
  const sortRow = v.sortMenu ? `<div class="m-chips" role="group" aria-label="Trier par">${Object.entries(SORT_LABELS).map(([k, l]) => mChip(l, { action: 'sort-set', value: k, on: sortBy === k })).join('')}</div>` : '';
  const active = [slotF !== 'all' ? mChip(`${PLURAL[slotF] ?? HERO_SLOTS[slotF] ?? slotF} ✕`, { action: 'filter', value: 'all', on: true }) : '',
    rarF !== 'all' ? mChip(`${RARITIES.find((r) => r.id === rarF)?.label ?? rarF} ✕`, { action: 'rarity-set', value: 'all', on: true }) : ''].filter(Boolean).join('');
  const full = state.inventory.length >= BALANCE.loot.inventorySize ? '<p class="em-full" role="alert">Sac plein : recycle ou range dans la Réserve.</p>' : '';
  // v10.17.1 (1) : sac vide : une petite ligne « Sac vide › Aller combattre » (ferme la fenêtre) au lieu du grand coffre
  const empty = list.length ? '' : slotF === 'all' && rarF === 'all'
    ? `<p class="eq-bag-empty"><span>Sac vide</span> <button type="button" class="btn-link eq-go-fight" data-action="close-panel">› Aller combattre</button></p>`
    : mEmpty('Aucun objet avec ce filtre.', { icon: 'icon_chest' });
  return `<div class="m-card em-bag">${head}${sortRow}${active ? `<div class="m-chips em-active" role="group" aria-label="Filtres actifs">${active}</div>` : ''}${list.length ? mGrid(tiles, 5) : empty}${full}</div>`;
}

// Réserve (coffre) : grille, filtre par ensemble en puces, « Reprendre au sac ».
export function stashView(ui, state) {
  const v = ui.view;
  const sets = stashSets(state);
  const setId = sets.some((x) => x.setId === v.stashSet) ? v.stashSet : null;
  const pool = setId ? state.stash.filter((i) => i.set === setId) : state.stash;
  const items = [...pool].sort((a, b) => ITEM_RANK(b) - ITEM_RANK(a) || b.level - a.level);
  const sel = items.find((i) => i.id === v.stashSel) ?? items[0];
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  const chips = sets.length ? `<div class="m-chips" role="group" aria-label="Ensemble">${mChip(`Tout (${state.stash.length})`, { action: 'stash-set-pick', value: '', on: !setId })}${sets.map((x) => mChip(`${setById(x.setId).name} ${x.slots}/6`, { action: 'stash-set-pick', value: x.setId, on: x.setId === setId })).join('')}</div>` : '';
  const auto = state.ui.autoMannequin !== false;
  const detail = sel ? `<div class="em-stash-sel">${mTile(sel, { size: 56, pips: false })}<div class="em-sel-id"><b>${e(sel.name)}</b><small>${rarityLabel(sel.rarity)} · niv. ${sel.level}</small></div>
      ${mBtn('Reprendre au sac', { action: 'from-stash', id: sel.id, disabled: full })}${setId ? mBtn('Porter la meilleure pièce', { action: 'wear-set', value: setId }) : ''}</div>` : '';
  return `${chips}${items.length ? mGrid(items.map((i) => mTile(i, { size: 64, action: 'stash-pick', id: i.id, selected: i.id === sel?.id })), 5) : mEmpty('La Réserve est vide.', { icon: 'icon_chest' })}${detail}
    <div class="m-chips">${mChip(auto ? 'Rangement auto : activé' : 'Rangement auto : désactivé', { action: 'auto-mannequin', on: auto })}</div>`;
}
const ITEM_RANK = (i) => RARITIES.findIndex((r) => r.id === i.rarity);

// ---------------------------------------------------------------------------------------------------------------------
// Mode Améliorer : une ligne par objet porté + « Tout améliorer »
// ---------------------------------------------------------------------------------------------------------------------
function upgradeList(ui, state, ctx) {
  const { unit } = ctx;
  const kg = skillKillGold(state);
  let rows, why;
  if (unit) {
    const worn = Object.entries(unitGear(state, unit.id));
    rows = worn.map(([slot, it]) => it && { it, slot, p: gearUpgradePreview(state, it, kg) }).filter(Boolean);
    why = upgradeAllGearWhy(state, unit.id, kg);
  } else {
    rows = upgradeRanking(state).map((r) => ({ it: r.item, slot: r.slot, p: r.preview }));
    why = upgradeAllHeroWhy(state);
  }
  const line = ({ it, slot, p }) => {
    const place = unit ? slotName(unit, slot) : HERO_SLOTS[slot];
    const mid = p.atMax
      ? `<span class="em-lvl-line">+${p.level} <small>maximum</small></span>`
      : `<span class="em-lvl-line">+${p.level} <i>»</i> <b class="up">+${p.level + 1}</b></span><div class="m-costs em-costs">${costOnly('icon_shard', p.cost.shards, !p.lack.shards)}${costOnly('coin', p.cost.gold, !p.lack.gold)}</div>`;
    const btn = p.atMax ? '' : unit
      ? mBtn('Améliorer', { action: 'gear-up', value: it.id, disabled: !p.canPay })
      : mBtn('Améliorer', { action: 'upgrade-item', id: it.id, disabled: !p.canPay, attrs: `data-cost="${p.cost.gold}" data-currency="gold"` });
    return `<div class="em-row">${mTile(it, { size: 56, action: 'eq-slot', value: slot, id: it.id, plus: '' })}<div class="em-row-mid"><b>${e(it.name)}</b><small>${e(place)}</small>${mid}</div>${btn}</div>`;
  };
  let levelUp = '';
  if (unit) {
    const lv = unitLevel(state, unit.id);
    const maxed = lv >= COMPANION_RULES.maxLevel;
    const cost = companionUpgradeCost(state, unit.id);
    levelUp = `<div class="em-row em-lvlrow"><span class="em-lvlico">${img('icon_xp')}</span><div class="em-row-mid"><b>Niveau ${lv} / ${COMPANION_RULES.maxLevel}</b>${maxed ? '<small>Niveau maximal</small>' : `<span class="em-lvl-line">${lv} <i>»</i> <b class="up">${lv + 1}</b></span><div class="m-costs em-costs">${costOnly('coin', cost, state.gold >= cost)}</div>`}</div>
      ${maxed ? '' : mBtn('Monter', { action: 'upgrade-companion', value: unit.id, disabled: state.gold < cost })}</div>`;
  }
  const allBtn = mBtnGold('Tout améliorer', { action: 'upgrade-all', value: ctx.who, disabled: Boolean(why) });
  const said = ui.view.upAllMsg?.who === (ctx.who || 'hero') ? `<p class="em-note em-done" role="status">${e(ui.view.upAllMsg.text)}</p>` : ''; // résultat du dernier « Tout améliorer »
  const whyLine = why && rows.length ? `<p class="em-note em-why" role="status">${e(why)}</p>` : ''; // jamais un bouton grisé sans explication
  return `<div class="m-card em-up">${allBtn}${said}${whyLine}${levelUp}${rows.length ? rows.map(line).join('') : mEmpty('Rien de porté : équipe un objet d\'abord.', { icon: 'icon_bag' })}</div>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Mode Reforger : les objets portés qui ont un effet spécial (héros)
// ---------------------------------------------------------------------------------------------------------------------
function reforgeRows(ui, state, item) {
  const v = ui.view;
  const shards = state.materials.shards;
  const cost = reforgeCost(state);
  const ok = canReforge(item);
  let target = '';
  if (canTargetReroll(item)) {
    const choices = targetRerollChoices(item);
    const sel = choices.includes(v.rerollType) ? v.rerollType : choices[0];
    const tc = targetRerollCost(item);
    const armed = v.rerollArmed === `${item.id}|${sel}`;
    target = `<div class="em-act"><span class="em-act-ico">${img('icon_crit')}</span><div class="em-act-mid"><b>Relance orientée</b>${costOnly('icon_shard', tc, shards >= tc)}</div>
      ${mBtn(armed ? 'Confirmer' : 'Relancer', { action: 'target-reroll', id: item.id, value: sel, disabled: shards < tc, cls: armed ? 'armed' : '' })}</div>
      <div class="m-chips em-pick" role="group" aria-label="Effet voulu">${choices.map((t) => mChip(KEEP_AFFIX_LABELS[t] ?? t, { action: 'reroll-pick', value: t, on: t === sel })).join('')}</div>`;
  }
  return `<div class="em-act"><span class="em-act-ico">${img('icon_star')}</span><div class="em-act-mid"><b>Changer l'effet</b>${costOnly('icon_shard', cost, shards >= cost)}</div>
      ${mBtn('Changer', { action: 'reforge', id: item.id, disabled: !(ok && shards >= cost) })}</div>
    ${ok ? '' : '<p class="em-note">Pas d\'effet spécial à changer.</p>'}${target}`;
}

// v10.13.1 (§ 1) : Reforger dans la fiche d'objet du téléphone : les trois choix sont visibles sans rien déplier, en cartes l'une sous l'autre
// (image à gauche, titre, une ligne, coût en éclats, bouton à droite). Mêmes actions que le PC : reforge, rf-pick (liste des effets), reroll-pick,
// target-reroll, retype-item ; après un changement d'effet : Avant » Après avec « Garder » (reforge-keep) ou « Revenir » (reforge-revert).
const RF_ART = { effect: 'fuse', target: 'upgrade', type: 'craft' }; // les mêmes illustrations que sur PC (assets/ui/art104/forge_step_*.png)
function reforgeCards(ui, state, item) {
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
  const card = (key, title, line, costHtml, btn, note = '', open = '') => `<div class="em-rcard${key === 'effect' && !prev && ok ? ' main' : ''}${note ? ' off' : ''}"><img class="px em-rart" src="assets/ui/art104/forge_step_${RF_ART[key]}.png" alt="">
      <div class="em-rmid"><b>${e(title)}</b><small>${e(note || line)}</small>${note ? '' : costHtml}</div>${btn}</div>${open}`;
  const effectBtn = ok && !prev ? mBtnGold('Changer', { action: 'reforge', id: item.id, disabled: shards < cost }) : mBtn('Changer', { action: 'reforge', id: item.id, disabled: !ok || shards < cost });
  const armed = v.rerollArmed === `${item.id}|${sel}`;
  // Liste des effets (avec leur icône) : s'ouvre par « Choisir… » ; un effet choisi, « Relancer » demande une confirmation.
  const list = !pickOpen ? '' : `<div class="em-effects" role="group" aria-label="Effet voulu">${choices.map((t) => `<button type="button" class="em-eff${t === sel ? ' on' : ''}" data-action="reroll-pick" data-value="${t}" aria-pressed="${t === sel}">${affixIcon(t)}<span>${e(KEEP_AFFIX_LABELS[t] ?? t)}</span></button>`).join('')}</div>
    ${sel ? mBtn(`${armed ? 'Confirmer' : 'Relancer'} : ${KEEP_AFFIX_LABELS[sel] ?? sel} (${num(tCost)} éclats)`, { action: 'target-reroll', id: item.id, value: sel, disabled: shards < tCost, cls: armed ? 'armed' : '' }) : '<p class="em-note">Choisis un effet.</p>'}`;
  const fx = (arr) => (arr ?? []).length ? arr.map((a) => `<div class="em-fx">${affixIcon(a.type)}<span>${e(affixText(a))}</span></div>`).join('') : '<div class="em-fx none"><span>Aucun effet</span></div>';
  const ab = !prev ? '' : `<div class="em-ab"><div class="em-ab-col"><h5>Avant</h5>${fx(prev.snap.affixes)}</div><i aria-hidden="true">»</i><div class="em-ab-col new"><h5>Après</h5>${fx(item.affixes)}</div></div>
    <div class="em-ab-btns">${mBtnGold('Garder', { action: 'reforge-keep' })}${mBtn('Revenir', { action: 'reforge-revert', id: item.id })}</div>`;
  const typeLine = `${itemBase(item.baseId).name} » autre arme`;
  // « Choisir… » ouvert : seule la carte « Relance orientée » reste, avec la liste des effets et la confirmation sous elle (rien à chercher en défilant).
  const effectCard = pickOpen ? '' : card('effect', 'Changer l\'effet', 'Nouvel effet au hasard', costOnly('icon_shard', cost, shards >= cost), effectBtn, ok ? '' : 'Pas d\'effet spécial à changer.');
  const typeCard = pickOpen ? '' : card('type', 'Changer le type', typeLine, costOnly('icon_shard', tyCost, shards >= tyCost), mBtn('Changer', { action: 'retype-item', id: item.id, disabled: !canType || shards < tyCost }), canType ? '' : item.slot === 'weapon' ? 'Aucun autre modèle pour cette arme.' : 'Pour les armes seulement.');
  return `${pickOpen ? '' : ab}<div class="em-rcards">${effectCard}
    ${card('target', 'Relance orientée', 'Tu choisis l\'effet voulu', costOnly('icon_shard', tCost, shards >= tCost), mBtn(pickOpen ? 'Fermer' : 'Choisir…', { action: 'rf-pick', value: item.id, disabled: !canT }), canT ? '' : 'Épique et Légendaire seulement.', list)}
    ${typeCard}</div>`;
}

function reforgeList(ui, state) {
  const worn = Object.entries(state.equipment).filter(([, it]) => it && canReforge(it));
  const blocks = worn.map(([slot, it]) => `<div class="em-rf"><div class="em-rf-head">${mTile(it, { size: 56, action: 'eq-slot', value: slot, id: it.id, plus: '' })}<div class="em-row-mid"><b>${e(it.name)}</b><small>${e(HERO_SLOTS[slot])}${(it.affixes ?? []).length ? ` · ${it.affixes.map((a) => e(affixText(a))).join(' · ')}` : ''}</small></div></div>${reforgeRows(ui, state, it)}</div>`).join('');
  return `<div class="m-card em-reforge">${blocks || mEmpty('Aucun objet porté à reforger.', { icon: 'icon_anvil' })}${mBtn('Forge : recycler et fusionner', { action: 'forge-go', value: 'recycle', icon: 'icon_anvil' })}</div>`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Mode Sets
// ---------------------------------------------------------------------------------------------------------------------
export function setsList(state) {
  const worn = setCounts(state.equipment);
  const owned = {};
  for (const i of [...state.inventory, ...(state.stash ?? []), ...Object.values(state.equipment).filter(Boolean)]) if (i?.set) owned[i.set] = (owned[i.set] ?? 0) + 1;
  const rows = ITEM_SETS.filter((st) => owned[st.id]).map((st) => {
    const w = worn[st.id] ?? 0;
    const next = SET_PIECES.find((n) => n > w);
    const tiers = SET_PIECES.map((n) => `<li class="${w >= n ? 'on' : ''}"><i>${w >= n ? '✓' : '○'}</i><span>${n} pièces : ${e(effectText(st.bonuses[n]))}</span></li>`).join('');
    return `<div class="m-card em-set" style="--sc:${e(st.color)}"><div class="em-set-head">${img(`set_${st.id}`)}<div><b>${e(st.name)} (${w}/${SET_PIECES.at(-1)})</b><small>${e(SET_SPECIALTY[st.id] ?? '')} · ${owned[st.id]} possédées</small></div></div><ul>${tiers}</ul>
      ${next ? `<small class="em-set-where">Pièces : ${e(ZONES[st.zone]?.name ?? '')}</small>` : ''}</div>`;
  }).join('');
  const hel = heroElement(state);
  const elLine = `<div class="em-el">Élément du héros : ${hel ? elementBadge(hel) : 'neutre'}</div>`;
  return rows ? `${elLine}${rows}` : mEmpty('Aucun ensemble entamé. Les pièces d\'ensemble tombent dans chaque monde.', { icon: 'icon_book' });
}

// ---------------------------------------------------------------------------------------------------------------------
// Compagnon : Étoiles et Compétences
// ---------------------------------------------------------------------------------------------------------------------
export function starsPanel(state, ctx) {
  const c = ctx.unit;
  const own = state.companions.owned[c.id] ?? { stars: 1, level: 1 };
  const max = COMPANION_RULES.maxCopies;
  const copies = Math.min(max, own.stars ?? 1);
  const dia = (n) => `<span class="eq-dia" aria-label="${n} étoile${n > 1 ? 's' : ''} sur ${max - 1}">${'◆'.repeat(n)}<i>${'◆'.repeat(max - 1 - n)}</i></span>`;
  if (copies >= max) return `<div class="m-card em-stars"><div class="em-dia">${dia(max - 1)}</div><p class="em-good">Toutes les étoiles : +${DUP_BONUS_PCT[max - 1]} % aux statistiques.</p></div>`;
  const st2 = { ...state, companions: { ...state.companions, owned: { ...state.companions.owned, [c.id]: { ...own, stars: copies + 1 } } } };
  const a = companionProfile(state, c.id), b = companionProfile(st2, c.id);
  const tier = [3, 5].map((n) => `<li class="${copies >= n ? 'on' : ''}"><i>${copies >= n ? '✓' : '○'}</i><span>${n} copies : ${e(STAR_TIERS[n].text)}</span></li>`).join('');
  return `<div class="m-card em-stars"><div class="em-dia">${dia(copies - 1)} <i>»</i> ${dia(copies)}</div>
    ${ba('Puissance', num(unitPower(state, c)), num(unitPower(st2, c)))}${ba('PV', num(a.maxHp), num(b.maxHp))}${ba('Attaque', num(a.atk), num(b.atk))}${ba('Défense', num(a.def), num(b.def))}
    ${ba('Bonus de copies', `+${DUP_BONUS_PCT[copies - 1]} %`, `+${DUP_BONUS_PCT[copies]} %`)}
    ${copies + 1 === ULT_UNLOCK_COPIES ? '<p class="em-good">Niveau max de l\'ultime : 5 » 10</p>' : ''}<ul class="em-tiers">${tier}</ul>
    <div class="em-copies"><span>Copies ${copies}/${max}</span>${mBar(copies / max)}</div>
    ${mBtnGold('Invoquer', { action: 'open-tab', value: 'summon', icon: 'icon_summon' })}</div>`;
}

export function skillsPanel(ui, state, ctx) {
  const c = ctx.unit;
  const own = state.companions.owned[c.id] ?? { stars: 1, level: 1 };
  ui.view.skillPop ??= 'active';
  const kind = ui.view.skillPop;
  const blocked = kind === 'ultimate' && (own.stars ?? 1) < ULT_UNLOCK_COPIES && skillLevels(own).ultimate >= 5
    ? mBtn(`Niveaux 6 à 10 : il faut la ${ULT_UNLOCK_COPIES}e copie`, { action: 'eq-tab', value: 'stars' }) : '';
  return `<div class="m-card em-skills">${skillIcons(ui, state, c, own)}${kind ? skillBubble(ui, state, c, own, Boolean(state.companions.owned[c.id])) : ''}${blocked}</div>`;
}

// =====================================================================================================================
// Fiches (.m-sheet plein écran) : Équipement rapide, Détails de l'équipement, place vide
// =====================================================================================================================
function sheetFor(ui, state, ctx) {
  const v = ui.view;
  const quickN = ctx.unit ? ctx.unitIds.size : ctx.plan.changes.length;
  if (v.eqQuick === ctx.who && quickN) return quickSheet(state, ctx);
  if (ctx.item) return itemSheet(ui, state, ctx);
  return emptySheet(ui, state, ctx);
}

const sheet = (title, body, extra = {}) => mSheet(title, body, { id: 'eq-sheet', close: 'close-sheet', back: 'close-sheet', ...extra });

// Confirmation de l'Équipement rapide : avant » après.
export function quickRows(state, ctx) { // lignes « avant » après » + total (téléphone : fiche ; PC : colonne de détail)
  const { unit } = ctx;
  let rows, total;
  if (unit) {
    const ids = bestGearFor(state, unit.id);
    const worn = unitGear(state, unit.id);
    const pool = [...state.inventory, ...(state.stash ?? [])];
    rows = ids.map((id) => pool.find((i) => i.id === id)).filter(Boolean).map((to) => {
      const from = worn[eqSlot(to)];
      return `<div class="em-q"><small>${e(slotName(unit, eqSlot(to)))}</small><span>${e(from ? from.name : 'place vide')} <i>»</i> <b class="r-${to.rarity} rarity-text">${e(to.name)}</b></span></div>`;
    }).join('');
    total = ba('Bonus', statText(unitGearStats(state, unit.id)) || 'aucun bonus', statText(gearStatsWith(state, unit.id, ids)) || 'aucun bonus');
  } else {
    const plan = ctx.plan;
    rows = plan.changes.map((c) => `<div class="em-q"><small>${e(HERO_SLOTS[c.slot])} <b class="up">${e(pctText(c.pct))}</b></small><span>${e(c.from ? c.from.name : 'place vide')} <i>»</i> <b class="r-${c.to.rarity} rarity-text">${e(c.to.name)}</b></span></div>`).join('');
    total = ba('Puissance', num(plan.before), num(plan.after));
  }
  return `<div class="m-card">${rows}${total}</div>`;
}
function quickSheet(state, ctx) {
  return sheet('Équipement rapide', `<div class="em-sheet-scroll">${quickRows(state, ctx)}</div>
    <div class="em-dock em-dock-q">${mBtnGold('Confirmer', { action: 'eq-quick-ok', value: ctx.who })}${mBtn('Annuler', { action: 'close-sheet' })}</div>`);
}

// Flèches ‹ › : la place voisine (même action eq-slot que les cases).
export function slotNav(state, who, cur) {
  const keys = who ? Object.keys(unitGear(state, who.id)) : Object.keys(HERO_SLOTS);
  const i = keys.indexOf(cur);
  if (i < 0 || keys.length < 2) return '';
  const worn = who ? unitGear(state, who.id) : state.equipment;
  const go = (dir) => { const k = keys[(i + dir + keys.length) % keys.length]; return `<button type="button" class="em-arrow" data-nav="${dir < 0 ? 'prev' : 'next'}" data-action="eq-slot" data-value="${k}"${worn[k] ? ` data-id="${worn[k].id}"` : ''} aria-label="${dir < 0 ? 'Place précédente' : 'Place suivante'}">${dir < 0 ? '‹' : '›'}</button>`; };
  const name = who ? slotName(who, cur) : HERO_SLOTS[cur];
  return `<div class="em-slotnav">${go(-1)}<span>${e(name)} · ${i + 1}/${keys.length}</span>${go(1)}</div>`;
}

// Ligne « ce que ça change » sous les statistiques.
export function verdict(state, ctx, item, f) {
  const { unit } = ctx;
  const hslot = heroSlot(item);
  if (f.heroWorn) {
    const cur = computeHeroStats(state).combatPower;
    const pct = cur > 0 ? (1 - computeHeroStats(state, BALANCE, { ...state.equipment, [hslot]: null }).combatPower / cur) * 100 : 0;
    return pct < 0.05 ? '<p class="em-verdict muted">Presque rien dans ta puissance totale</p>' : `<p class="em-verdict good"><b>+${formatDecimal(Math.max(0, pct), pct < 10 ? 1 : 0)} %</b> de ta puissance totale</p>`;
  }
  if (f.wearUnit) return `<p class="em-verdict">Porté par <b>${e(f.wearUnit.name)}</b> : <span class="good">${e(statText(gearStats(item, state)))}</span></p>`;
  if (unit && unitCanEquip(state, unit.id, item).ok) {
    const cur = unitGear(state, unit.id)[eqSlot(item)];
    const d = gearScore(state, item) - (cur ? gearScore(state, cur) : 0);
    return `<p class="em-verdict ${d > 0 ? 'good' : 'muted'}">Pour ${e(unit.name)} : ${e(statText(gearStats(item, state)))}</p>`;
  }
  if (f.forHero) {
    const pct = ctx.gains?.get(item.id)?.pct ?? 0;
    return pct < -5 ? `<p class="em-verdict bad">Bien moins bon que ton objet porté (${e(pctText(pct))})</p>`
      : `<p class="em-verdict ${pct > 0.05 ? 'good' : 'muted'}"><b>${e(pctText(pct))}</b> de puissance si tu l'équipes</p>`;
  }
  const better = teamUpgradeFor(state, item);
  return `<p class="em-verdict ${better ? 'good' : 'muted'}">${better ? `Meilleur pour ${e(companionById(better)?.name ?? '')}` : `Pour : ${e(item.cls ? classLabel(item.cls) : weaponClass(item.baseId)?.name ?? '')}`}</p>`;
}

function itemSheet(ui, state, ctx) {
  const v = ui.view;
  const { item, unit } = ctx;
  const base = itemBase(item.baseId);
  const hslot = heroSlot(item);
  const wearer = wearerOf(state, item.id);
  const heroWorn = state.equipment[hslot]?.id === item.id;
  const worn = heroWorn || Boolean(wearer);
  const wearUnit = wearer ? companionById(wearer) : null;
  const forHero = !wearer && canEquip(state, item);
  const flags = { heroWorn, wearUnit, forHero };
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
  const nav = heroWorn ? slotNav(state, null, hslot) : wearUnit ? slotNav(state, wearUnit, eqSlot(item)) : '';
  // v10.13.1 (§ 1) : grande case 84 px (cadre de rareté, « +3 » dessus), nom, pastilles rareté et place, « Renfort +3 / 13 », cadenas ;
  // l'étiquette « Objet dépassé » et « Trouver mieux » sous l'en-tête quand le renfort n'apporte presque rien (l'action `find-better` existe déjà).
  let weak = false;
  if (!wearer && !pv.atMax) { const g = upgradeGainPct(pv); weak = g !== null && g < WEAK_GAIN_PCT; }
  const oldTag = weak ? `<div class="em-old" role="note"><b>${e(weakLabel(state, item))}</b>${mBtn('Trouver mieux ›', { action: 'find-better', value: hslot, cls: 'auto' })}</div>` : '';
  const head = `<div class="em-top em-swipe">${nav}<div class="em-head">${mTile(item, { size: 96, plus: ups ? `+${ups}` : '' })}
      <div class="em-hid"><b class="em-name">${e(item.name)}</b><div class="em-pills">${rarPill(item.rarity)}${pill('slot', wearUnit ? slotName(wearUnit, eqSlot(item)) : HERO_SLOTS[hslot] ?? '')}${base.signature ? pill('role', 'Ancestral') : ''}</div>
        ${pv.max ? `<span class="em-lvl">Renfort +${pv.level} <small>/ ${pv.max}</small></span>` : ''}</div>
      <div class="em-hact">${lock}${more}</div></div>${menu}</div>${oldTag}`;
  // Statistiques : la principale en grand, puis les autres, les effets spéciaux et le grand effet.
  const entries = Object.entries(item.stats);
  const mainKey = item.stats.damage != null ? 'damage' : item.stats.maxHp != null ? 'maxHp' : entries[0]?.[0];
  const statRows = [...entries.filter(([k]) => k === mainKey), ...entries.filter(([k]) => k !== mainKey)]
    .map(([k, val]) => mStat(STAT_ICONS[k], STAT_LABELS[k], formatStat(k, val, true), k === mainKey)).join('');
  const affixes = (item.affixes ?? []).map((a) => `<div class="m-stat em-affix">${affixIcon(a.type)}<span class="m-k">${e(affixText(a))}</span>${worn ? '<b class="m-v em-on">actif</b>' : ''}</div>`).join('');
  const unitGives = wearUnit || (unit && !heroWorn) ? `<div class="m-stat em-affix"><i>✦</i><span class="m-k">Sur un compagnon : ${e(statText(gearStats(item, state))) || 'aucun bonus'}</span></div>` : '';
  const set = setById(item.set);
  const sw = set ? setCounts(state.equipment)[set.id] ?? 0 : 0;
  const setBlock = set ? `<div class="m-card em-set" style="--sc:${e(set.color)}"><div class="em-set-head">${img(`set_${set.id}`)}<div><b>Set ${e(set.name)} (${sw}/${SET_PIECES.at(-1)})</b></div></div>
      <ul>${SET_PIECES.map((n) => `<li class="${sw >= n ? 'on' : ''}"><i>${sw >= n ? '✓' : '○'}</i><span>${n} pièces : ${e(effectText(set.bonuses[n]))}</span></li>`).join('')}</ul></div>` : '';
  const scroll = `<div class="em-sheet-scroll"><div class="m-card em-stats">${statRows}${affixes}${unitGives}${majorLine(state, item)}${mStat('icon_upgrade', 'Niveau d\'objet', String(item.level))}</div>
      ${base.signature ? '<p class="em-note">Ancestral : exposé au Musée, il donne son bonus même sans être porté.</p>' : ''}${setBlock}${verdict(state, ctx, item, flags)}</div>`;
  const modes = mModes([{ id: 'up', label: 'Améliorer', icon: 'icon_upgrade', action: 'item-tab', value: 'up' }, { id: 'reforge', label: 'Reforger', icon: 'icon_anvil', action: 'item-tab', value: 'reforge' },
    { id: 'equip', label: worn ? 'Changer' : 'Équiper', icon: 'icon_hero', action: 'item-tab', value: 'equip' }], mode, { size: 64, arrow: true });
  let panel;
  if (mode === 'up') panel = upPanel(state, item, wearer, pv, { headTag: true });
  else if (mode === 'reforge') panel = wearer ? '<p class="em-note">Les pièces d\'un compagnon ne se reforgent pas.</p>' : reforgeCards(ui, state, item);
  else panel = equipPanel(ui, state, ctx, item, flags);
  return sheet('Détails de l\'équipement', `${head}${scroll}<div class="em-dock">${modes}<div class="em-panel em-panel-${mode}" role="tabpanel">${panel}</div></div>`);
}

// Panneau « Améliorer » : +N » +N+1, la ligne qui monte, les coûts, UN bouton doré.
export function upPanel(state, item, wearer, p, opts = {}) {
  if (wearer) {
    if (p.atMax) return `<p class="em-note">Renforcé au maximum (+${p.max}).</p>`;
    const rows = p.rows.filter((r) => r.before !== r.after).map((r) => ba(STAT_NAMES[r.key], `${r.key === 'cd' ? '−' : '+'}${formatDecimal(r.before)} %`, `${r.key === 'cd' ? '−' : '+'}${formatDecimal(r.after)} %`)).join('');
    return `<div class="em-lvlup"><b>+${p.level}</b><i>»</i><b class="up">+${p.level + 1}</b></div>${rows}
      <div class="m-costs">${mCost('icon_shard', state.materials.shards, p.cost.shards, { fmt: num })}${mCost('coin', state.gold, p.cost.gold, { fmt: num })}</div>
      ${mBtnGold('Améliorer', { action: 'gear-up', value: item.id, disabled: !p.canPay })}`;
  }
  if (p.atMax) {
    let why;
    if (p.max <= 0) why = '<p class="em-note">Cet objet ne se renforce pas.</p>';
    else if (!bastionOpen(state)) why = `<p class="em-note">Au-delà de +${p.max} : le Bastion ouvre à l'étape ${BASTION_UNLOCK_STAGE}.</p>`;
    else why = mBtn(`Forge du Bastion niveau ${forgeLevel(state) + 1} requise`, { action: 'bastion-open', value: 'forge' });
    return `<p class="em-note em-max">Renforcé au maximum (+${p.level})</p>${why}`;
  }
  const gain = upgradeGainPct(p);
  const weak = gain !== null && gain < WEAK_GAIN_PCT;
  const rows = p.rows.filter((r) => r.before !== r.after).slice(0, 1).map((r) => ba(rowLabel(r), rowVal(r, r.before), rowVal(r, r.after))).join('');
  const upBtn = { action: 'upgrade-item', id: item.id, disabled: Boolean(p.lack.shards || p.lack.gold), attrs: `data-cost="${p.cost.gold}" data-currency="gold"` };
  const costs = `<div class="m-costs">${mCost('icon_shard', state.materials.shards, p.cost.shards, { fmt: num })}${mCost('coin', state.gold, p.cost.gold, { fmt: num })}</div>`;
  if (weak && opts.headTag) { // PC : l'étiquette « Objet dépassé » et « Trouver mieux » sont dans l'en-tête de la fiche ; ici seulement les chiffres
    const worn = Object.values(state.equipment).some((i) => i?.id === item.id);
    const power = !p.power ? '' : ba('Puissance', num(p.power.before), 'presque pareille', false);
    return `<div class="em-lvlup"><b>+${p.level}</b><i>»</i><b class="up">+${p.level + 1}</b></div>${rows}${power}${costs}${worn ? mBtnGold('Améliorer', upBtn) : `${mBtn('Améliorer', upBtn)}${mBtnGold('Équiper', { action: 'equip', id: item.id })}`}`;
  }
  if (weak) { // v10.13 (§ 2) : étiquette « Objet dépassé » + « Trouver mieux », le bouton doré reste « Améliorer » (ou « Équiper » si l'objet n'est pas porté)
    const note = `<p class="em-note em-weak"><b>${e(weakLabel(state, item))}</b></p>`;
    const worn = Object.values(state.equipment).some((i) => i?.id === item.id);
    const gold = worn ? mBtnGold('Améliorer', upBtn) : mBtnGold('Équiper', { action: 'equip', id: item.id });
    return `${note}${rows}${costs}${mBtn('Trouver mieux ›', { action: 'find-better', value: heroSlot(item) })}${worn ? '' : mBtn('Améliorer', upBtn)}${gold}`;
  }
  const power = !p.power ? '' : ba(p.power.worn ? 'Puissance' : 'Puissance (équipé)', num(p.power.before), num(p.power.after));
  return `<div class="em-lvlup"><b>+${p.level}</b><i>»</i><b class="up">+${p.level + 1}</b></div>${rows}${power}${costs}${mBtnGold('Améliorer', upBtn)}`;
}

// Panneau « Équiper / Changer ».
export function equipPanel(ui, state, ctx, item, f) {
  const { unit } = ctx;
  const { heroWorn, wearUnit, forHero } = f;
  const hslot = heroSlot(item);
  if (!heroWorn && !wearUnit) { // objet du sac : ce qui change, puis Équiper
    const target = unit && unitCanEquip(state, unit.id, item).ok ? unit : !forHero ? companionById(teamUpgradeFor(state, item)) : null;
    const worse = forHero && !target && (ctx.gains?.get(item.id)?.pct ?? 0) < -5;
    const cmp = forHero && !target ? compareList(state, item) : [];
    const rows = cmp.map((r) => ba(r.label, r.a, r.b, r.up)).join('');
    const place = state.equipment[hslot] ? `<small class="em-note">à la place de ${e(state.equipment[hslot].name)}</small>` : '';
    const btn = target ? mBtnGold(`Équiper sur ${target.name}`, { action: 'gear-equip', value: `${target.id}|${item.id}` })
      : forHero ? (worse ? mBtn('Équiper', { action: 'equip', id: item.id }) : mBtnGold('Équiper', { action: 'equip', id: item.id }))
        : mBtn(`Pour : ${item.cls ? classLabel(item.cls) : weaponClass(item.baseId)?.name ?? ''}`, { disabled: true });
    return `${rows ? `${place}${rows}` : '<p class="em-note">Rien ne change pour ton héros.</p>'}${btn}`;
  }
  // objet porté : les objets du sac qui vont à cette place, du meilleur au moins bon ; Retirer
  const hs = heroWorn ? hslot : null;
  const cands = wearUnit
    ? state.inventory.filter((i) => eqSlot(i) === eqSlot(item) && unitCanEquip(state, wearUnit.id, i).ok).sort((a, b) => gearScore(state, b) - gearScore(state, a))
    : state.inventory.filter((i) => ctx.gains?.get(i.id)?.slot === hs).sort((a, b) => ctx.gains.get(b.id).pct - ctx.gains.get(a.id).pct);
  const sets = [...new Set(cands.map((i) => i.set).filter((s) => s && setById(s)))];
  const sf = sets.includes(ui.view.eqSetFilter) ? ui.view.eqSetFilter : null;
  const shown = (sf ? cands.filter((i) => i.set === sf) : cands).slice(0, 20);
  const gain = (i) => { if (wearUnit) return ''; const p = ctx.gains.get(i.id).pct; return `${p > 0 ? '+' : '−'}${formatDecimal(Math.abs(p), Math.abs(p) < 10 ? 1 : 0)} %`; };
  const tiles = shown.map((i) => mTile(i, { size: 56, action: 'select-item', id: i.id, up: !wearUnit && ctx.gains.get(i.id).up, badge: gain(i) }));
  const chips = sets.length ? `<div class="m-chips">${mChip('Tous', { action: 'eq-setf', value: '', on: !sf })}${sets.map((s) => mChip(setById(s).name, { action: 'eq-setf', value: s, on: sf === s })).join('')}</div>` : '';
  const best = shown[0] && (wearUnit ? gearScore(state, shown[0]) > gearScore(state, item) : ctx.gains.get(shown[0].id).pct > 0.05) ? shown[0] : null;
  const bestBtn = best ? mBtnGold('Équiper le meilleur', wearUnit ? { action: 'gear-equip', value: `${wearUnit.id}|${best.id}` } : { action: 'equip', id: best.id }) : '';
  const remove = heroWorn ? mBtn('Retirer', { action: 'eq-unequip', value: hslot }) : mBtn('Retirer', { action: 'gear-unequip', value: `${wearUnit.id}|${eqSlot(item)}` });
  return `${tiles.length ? mGrid(tiles, 5) : '<p class="em-note">Aucun autre objet pour cette place dans ton sac.</p>'}${chips}${bestBtn}${remove}${mBtn('Fabriquer à la Forge', { action: 'forge-go', value: 'craft' })}`;
}

// Place vide : les objets compatibles du sac, « Équiper le meilleur ».
export function emptySheet(ui, state, ctx) {
  const { unit, slot } = ctx;
  const name = unit ? slotName(unit, slot) : HERO_SLOTS[slot];
  const cands = unit
    ? state.inventory.filter((i) => eqSlot(i) === slot && unitCanEquip(state, unit.id, i).ok).sort((a, b) => gearScore(state, b) - gearScore(state, a)).slice(0, 12)
    : state.inventory.filter((i) => ctx.gains?.get(i.id)?.slot === slot).sort((a, b) => ctx.gains.get(b.id).pct - ctx.gains.get(a.id).pct).slice(0, 12);
  const equipAct = (i) => (unit ? { action: 'gear-equip', value: `${unit.id}|${i.id}` } : { action: 'equip', id: i.id });
  const list = cands.map((i) => `<div class="em-row">${mTile(i, { size: 56, action: 'select-item', id: i.id })}<div class="em-row-mid"><b>${e(i.name)}</b><small class="${unit ? '' : 'up'}">${unit ? e(statText(gearStats(i, state))) : e(pctText(ctx.gains.get(i.id).pct))}</small></div>${mBtn('Équiper', equipAct(i))}</div>`).join('');
  const keys = unit ? Object.keys(unitGear(state, unit.id)) : Object.keys(HERO_SLOTS);
  const worn = unit ? unitGear(state, unit.id) : state.equipment;
  const i0 = keys.indexOf(slot);
  const nav = i0 >= 0 && keys.length > 1 ? (() => {
    const go = (d) => { const k = keys[(i0 + d + keys.length) % keys.length]; return `<button type="button" class="em-arrow" data-nav="${d < 0 ? 'prev' : 'next'}" data-action="eq-slot" data-value="${k}"${worn[k] ? ` data-id="${worn[k].id}"` : ''} aria-label="${d < 0 ? 'Place précédente' : 'Place suivante'}">${d < 0 ? '‹' : '›'}</button>`; };
    return `<div class="em-slotnav">${go(-1)}<span>${e(name)} · ${i0 + 1}/${keys.length}</span>${go(1)}</div>`;
  })() : '';
  const main = cands[0] ? mBtnGold('Équiper le meilleur', equipAct(cands[0])) : mBtnGold('Fabriquer à la Forge', { action: 'forge-go', value: 'craft' });
  return sheet('Détails de l\'équipement', `<div class="em-top em-swipe">${nav}<div class="em-head">${mTile(null, { size: 96, slot: SIL(slot), empty: true })}<div class="em-hid"><b class="em-name">${e(name)}</b><div class="em-pills">${pill('role', 'Place vide')}</div></div></div></div>
    <div class="em-sheet-scroll"><div class="m-card">${list || '<p class="em-note">Aucun objet pour cette place dans ton sac. Les monstres en laissent tomber ; tu peux aussi en fabriquer un à la Forge.</p>'}</div></div>
    <div class="em-dock em-dock-q">${main}</div>`);
}

// =====================================================================================================================
// Menu de l'entonnoir : filtres de place et de rareté, objets des autres classes, Équiper pour, Builds, réglages du sac
// =====================================================================================================================
export function filterSheet(ui, state, ctx) {
  return mSheet('Filtres et sac', filterBody(ui, state, ctx), { id: 'eq-menu', icon: 'icon_bag', close: 'bag-menu', back: 'bag-menu' });
}
export function filterBody(ui, state, ctx) { // le contenu du menu (téléphone : fiche ; PC : à la place du sac)
  const v = ui.view;
  const slotF = state.ui.slotFilter ?? 'all', rarF = state.ui.rarityFilter ?? 'all';
  const sec = (title, body) => `<section class="em-sec"><h4>${e(title)}</h4>${body}</section>`;
  const place = `<div class="m-chips em-wrap" role="group" aria-label="Place">${mChip('Tout', { action: 'filter', value: 'all', on: slotF === 'all' })}${Object.entries(HERO_SLOTS).map(([k, l]) => mChip(l, { action: 'filter', value: k, on: slotF === k })).join('')}</div>`;
  const rar = `<div class="m-chips em-wrap" role="group" aria-label="Rareté">${mChip('Toutes', { action: 'rarity-set', value: 'all', on: rarF === 'all' })}${RARITIES.map((r) => mChip(r.label, { action: 'rarity-set', value: r.id, on: rarF === r.id })).join('')}</div>`;
  const hidden = visibleItems(state).filter((i) => !(ctx.unit ? unitCanEquip(state, ctx.unit.id, i).ok : canEquip(state, i))).length;
  const others = `<div class="m-chips">${mChip(v.bagAll ? 'Seulement les objets utilisables' : `Voir les objets des autres classes${hidden ? ` (${hidden})` : ''}`, { action: 'bag-all', value: v.bagAll ? '' : '1', on: Boolean(v.bagAll) })}</div>`;
  const PROFILE_TIPS = { attack: 'Les dégâts d\'abord', survival: 'La survie d\'abord', fortune: 'L\'or et le butin d\'abord' };
  const forChips = `<div class="m-chips" role="group" aria-label="Équiper pour">${['attack', 'survival', 'fortune'].map((p) => mChip(GEAR_PROFILES[p].label, { icon: PROFILE_ICONS[p], action: 'equip-for', value: p, on: state.ui.gearProfile === p, attrs: `title="${e(PROFILE_TIPS[p])}"` })).join('')}</div>`;
  const bind = (state0, cur) => [['', 'Aucun'], ...Object.entries(BIND_MODES), ...ZONES.map((z, i) => [`zone:${i}`, `Monde ${i + 1}`]).filter((x, i) => i * 20 < Math.max(state0.maxStage, state0.records?.bestStage ?? 1))].map(([val, label], idx) => ({ val, label, on: (cur ?? '') === val, idx }));
  const builds = state.loadouts.map((l, i) => {
    const team = (l.team ?? []).map((id) => companionById(id)).filter(Boolean);
    const items = Object.values(l.gear ?? {}).filter(Boolean).length;
    const summary = l.team ? [team.length ? team.map((c) => c.name).join(', ') : 'sans équipe', `${items} objets`].join(' · ') : 'Vide : équipe-toi puis « Enregistrer ».';
    const renaming = v.buildRename === i;
    return `<div class="m-card em-build"><b>${e(l.name)}</b><small>${e(summary)}</small>
      <div class="em-btns">${l.team ? mBtn('Équiper', { action: 'apply-build', value: i }) : ''}${mBtn('Enregistrer', { action: 'save-loadout', value: i })}${mBtn('Renommer', { action: 'rename-build', value: i })}</div>
      ${renaming ? `<div class="em-rename"><input id="build-name" type="text" maxlength="24" value="${e(l.name)}" aria-label="Nouveau nom">${mBtn('OK', { action: 'confirm-rename-build', value: i })}</div>` : ''}
      ${l.team ? `<div class="m-chips" role="group" aria-label="Attaché à">${bind(state, l.bind).map((o) => mChip(o.label, { action: 'bind-set', value: i, on: o.on, attrs: `data-bind="${e(o.val)}"` })).join('')}</div>` : ''}</div>`;
  }).join('');
  const sh = bastionShortcuts(state);
  return `<div class="em-sheet-scroll em-menu-body">${sec('Place', place)}${sec('Rareté', rar)}${others}${sec('Équiper pour', forChips)}${sec('Builds', builds)}${sec('Réglages du sac', bagSettings(ui, state))}
    ${sh ? sec('Bastion', sh) : ''}${mBtn('Éléments', { action: 'elements-help' })}</div>`;
}

// Réglages du sac : recyclage en lot, règle automatique, avancé (mêmes actions, puces à la place des listes).
export function bagSettings(ui, state) {
  const v = ui.view;
  const cands = bulkRecycleCandidates(state, v.bulkRarity);
  const gold = cands.reduce((s, i) => s + recycleValue(i, BALANCE, recycleLevelOf(state)), 0);
  const label = v.bulkArmed ? `Confirmer : ${cands.length} objet${cands.length > 1 ? 's' : ''} (+${num(gold)} or)` : `Recycler ${cands.length} objet${cands.length > 1 ? 's' : ''} (+${num(gold)} or)`;
  const rules = recycleRules(state);
  const tog = (group, value, text, on) => mChip(text, { action: 'recycle-toggle', value, on, attrs: `data-group="${group}"` });
  const fuse = state.ui.autoFuse ?? { on: false, rarities: ['common'] };
  const BR = [['common', 'Communs'], ['rare', '+ Rares'], ['epic', '+ Épiques'], ['legendary', '+ Légendaires']];
  const u = uselessPreview(state);
  return `<p class="em-note">Jamais recyclé ni fusionné tout seul : objet porté, verrouillé, ancestral ou meilleur que le porté.</p>
    <div class="m-chips em-wrap" role="group" aria-label="Rareté maximale à recycler">${BR.map(([k, l]) => mChip(l, { action: 'bulk-rarity-set', value: k, on: (v.bulkRarity ?? 'common') === k })).join('')}</div>
    ${mBtn(label, { action: 'bulk-recycle', disabled: !cands.length, cls: v.bulkArmed ? 'armed' : '' })}
    ${mBtn(`Recycler les objets inutiles (${u.list.length})`, { action: 'recycle-useless', disabled: !u.list.length })}
    <h5>Recyclage automatique</h5>
    ${rules.mode === 'off' ? mBtn('Activer au ramassage', { action: 'recycle-toggle', value: 'pickup', attrs: 'data-group="mode"' })
      : `<div class="m-chips em-wrap">${RARITIES.map((r) => tog('rarities', r.id, r.label, rules.rarities.includes(r.id))).join('')}</div>
      <div class="m-chips em-wrap" role="group" aria-label="Quand recycler">${Object.entries(RECYCLE_MODES).map(([k, l]) => mChip(l, { action: 'recycle-mode-set', value: k, on: k === rules.mode })).join('')}</div>
      <h5>Places recyclées</h5><div class="m-chips em-wrap">${Object.entries(HERO_SLOTS).map(([s, l]) => tog('slots', s, l, rules.slots.includes(s))).join('')}</div>
      <h5>Garder si l'objet a…</h5><div class="m-chips em-wrap">${Object.entries(KEEP_AFFIX_LABELS).map(([k, l]) => tog('keepAffixes', k, l, (rules.keepAffixes ?? []).includes(k))).join('')}</div>`}
    <div class="m-chips em-wrap">${mChip(state.ui.keepSets !== false ? 'Garder les pièces d\'ensemble utiles' : 'Recycler les ensembles', { action: 'keep-sets', on: state.ui.keepSets !== false })}${mChip(state.ui.autoUseless !== false ? 'Inutiles recyclés' : 'Inutiles gardés', { action: 'auto-useless', on: state.ui.autoUseless !== false })}</div>
    <h5>Fusion automatique</h5><div class="m-chips em-wrap">${mChip(fuse.on ? 'Activée' : 'Désactivée', { action: 'autofuse', on: fuse.on, attrs: 'data-group="on"' })}${fuse.on ? RARITIES.filter((r) => fusableRarities().includes(r.id)).map((r) => mChip(r.label, { action: 'autofuse', value: r.id, on: fuse.rarities.includes(r.id), attrs: 'data-group="rarities"' })).join('') : ''}</div>`;
}
