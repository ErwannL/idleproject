// Équipement (v10.3, partie 8) : une fenêtre qu'on comprend du premier coup. En haut « Tes ressources » ; à gauche le
// héros et les compagnons de l'équipe en portraits ; au centre le personnage en grand et ses places à toucher ; à droite
// la fiche de l'objet, toujours visible (feuille du bas sur téléphone) ; dessous, le sac en cartes carrées.
// Les règles restent dans core/ (inventory, forge, companion-gear) : ce fichier ne fait que montrer.
import { BALANCE } from '../../data/balance.js';
import { BOSSES } from '../../data/enemies.js';
import { COMPANION_RULES } from '../../data/companions.js';
import { HERO_SLOTS, RARITIES, SLOTS, STAT_LABELS, eqSlot, heroSlot } from '../../data/items.js';
import { ITEM_SETS, SET_PIECES, SET_SPECIALTY } from '../../data/sets.js';
import { ZONES } from '../../data/zones.js';
import { DUP_BONUS_PCT, ULT_UNLOCK_COPIES } from '../../data/progression.js';
import { GEAR_CLASSES, gearClassOf } from '../../data/companion-gear.js';
import { elementBadge, unitElement, wheelShown } from '../../core/elements.js';
import * as bastion from '../../core/bastion.js';
import { companionProfile } from '../../core/arena.js';
import { activeClass, canEquip, classById, itemClass } from '../../core/classes.js';
import { STAR_TIERS, companionById, companionMultiplier, companionUpgradeCost, heroElement, isAwakened, skillKillGold, unitLevel } from '../../core/companions.js';
import { bestGearFor, canEquip as unitCanEquip, classLabel, gearStatsWith, gearUpgradePreview, slotName, statText, unitGear, unitGearStats, wearerOf, wornItems } from '../../core/companion-gear.js';
import { formatStat } from '../../core/format.js';
import { fusableRarities, upgradePreview, upgradeRanking } from '../../core/forge.js';
import { heroById } from '../../core/heroes.js';
import { GEAR_PROFILES, KEEP_AFFIX_LABELS, RECYCLE_MODES, bestPerSlot, bulkRecycleCandidates, heroGains, listInventory, quickEquipPlan, recycleRules } from '../../core/inventory.js';
import { BIND_MODES } from '../../core/loadouts.js';
import { itemBase, rarityById, recycleLevelOf, recycleValue } from '../../core/loot.js';
import { MUSEUM, MUSEUM_PIECES, museumCount, museumDuplicates, museumEffects } from '../../core/museum.js';
import { canAfford, skillLevels, skillUpgradeCost } from '../../core/progression.js';
import { setById, setCounts } from '../../core/sets.js';
import { STASH_SIZE, stashSets } from '../../core/stash.js';
import { computeHeroStats } from '../../core/stats.js';
import { invFeatureOpen } from '../../core/unlocks.js';
import { itemIconUrl, slotIconName } from '../../render/pixel.js';
import { animCanvas } from '../animator.js';
import { affixText, costButton, distinctTo, effectText, escapeHtml, fold, formatDecimal, formatNumber, hdArt, icon, img, itemFrame, rarityLabel, segment } from '../common.js';
import { changeSheet, emptySlotSheet, femSlot, itemSheet, pctText } from './equip-sheet.js';
import { companionPortrait, companionStill } from './expeditions.js';
import { recycleButton } from './forge.js';
import { skillBubble, skillIcons } from './unit-popup.js';

const PROFILE_ICONS = { attack: 'icon_damage', survival: 'icon_defense', fortune: 'icon_gold' };
const PROFILE_TIPS = { attack: 'Pour passer un boss : les dégâts d\'abord', survival: 'Pour tenir dans un monde dur : la survie d\'abord', fortune: 'Pour farmer : l\'or et le butin d\'abord' };
const SORT_LABELS = { rarity: 'Rareté', level: 'Niveau', power: 'Puissance', recent: 'Récent' };

export function visibleItems(state) {
  return listInventory(state, { slot: state.ui.slotFilter, sortBy: state.ui.sortBy, rarity: state.ui.rarityFilter ?? 'all' });
}

// ---------------------------------------------------------------------------------------------------------------
// Personnages : le héros puis les compagnons de l'équipe (les familiers ne portent rien).
const teamOf = (state) => (state.companions?.equipped ?? []).map((id) => companionById(id)).filter((c) => c?.kind === 'ally');
const unitPower = (state, c) => Math.round(100 * companionMultiplier(state, c.id));
// Une amélioration est possible (pastille rouge « ! ») : meilleur objet, renforcement payable, compétence payable.
function heroTodo(state, plan) {
  return plan.changes.length > 0 || Object.values(state.equipment).some((it) => it && upgradePreview(state, it).canPay);
}
function unitTodo(state, c) {
  if (bestGearFor(state, c.id).length) return true;
  const kg = skillKillGold(state);
  if (Object.values(unitGear(state, c.id)).some((it) => it && gearUpgradePreview(state, it, kg).canPay)) return true;
  const own = state.companions.owned[c.id];
  return Boolean(own) && ['passive', 'active', 'ultimate'].some((k) => { const cost = skillUpgradeCost(own, k, kg); return cost && canAfford(state, cost); });
}

// Bandeau « Tes ressources » : ce qui sert ici (or, éclats), et en gris ce qui sert aux compagnons. Toucher une
// ressource ouvre sa carte de glossaire.
function resourceBand(state) {
  const chip = (key, pic, n, word, cls = '') => `<button class="eq-res-chip ${cls}" data-gloss="${key}" title="${escapeHtml(word)}">${img(pic)}<b class="num">${formatNumber(n)}</b><small>${word}</small></button>`;
  return `<div class="eq-res" role="group" aria-label="Tes ressources"><span class="eq-res-title">Tes ressources</span>
    ${chip('gold', 'coin', state.gold, 'Or · améliorer')}${chip('shards', 'icon_shard', state.materials.shards, 'Éclats · renforcer')}
    <span class="eq-res-other">${chip('grimoire', 'icon_grimoire', state.materials.grimoire ?? 0, 'Grimoires', 'dim')}${chip('ascension', 'icon_ascension', state.materials.ascension ?? 0, 'Pierres d\'éveil', 'dim')}<small class="eq-res-note">pour les compagnons</small></span></div>`;
}

// Raccourcis du Bastion (partie 10) : chantiers visibles et accessibles depuis l'équipement.
function bastionShortcuts(state) {
  if (!bastion.bastionOpen(state)) return '';
  const list = bastion.bastionShortcuts?.(state, Date.now()) ?? [];
  if (!list.length) return '';
  return `<div class="eq-shorts" role="group" aria-label="Bastion">${list.map((s) => `<button class="eq-short${s.ready ? ' ready' : ''}" data-action="bastion-open" data-value="${escapeHtml(s.id)}" title="${escapeHtml(s.label)}">
    <b>${escapeHtml(s.label)}</b><span class="num">${s.busy}/${s.total}</span></button>`).join('')}</div>`;
}

// Colonne des personnages : portrait, nombre de places, ▲ si un meilleur objet attend, « ! » si une amélioration est possible.
function whoColumn(ui, state, ctx) {
  const card = (id, name, art, slots, ups, todo) => `<button class="eq-who${ctx.who === id ? ' on' : ''}" data-action="gear-who" data-value="${id}" aria-pressed="${ctx.who === id}" title="${escapeHtml(name)}">
      <span class="eq-who-art">${art}</span><b>${escapeHtml(name)}</b><small>${slots} places</small>
      ${ups ? '<span class="eq-who-up" title="Un meilleur objet attend dans le sac">▲</span>' : ''}${todo ? '<span class="eq-who-todo" title="Une amélioration est possible">!</span>' : ''}</button>`;
  return `<div class="eq-whos" role="group" aria-label="Personnage">${card('hero', 'Héros', animCanvas('hero', 34, 34, 2), Object.keys(HERO_SLOTS).length, ctx.plan.changes.length, heroTodo(state, ctx.plan))}
    ${ctx.team.map((c) => card(c.id, c.name, companionStill(c), 3, bestGearFor(state, c.id).length, unitTodo(state, c))).join('')}</div>`;
}

const shortName = (item) => String(item.name).split(' ')[0];

// Une place : icône, cadre à la couleur de la rareté, pastille +N, ▲ si mieux dans le sac ; dessous le nom de la
// place puis « Nom · Rareté ». Le niveau de l'objet est dans la fiche (« Niveau d'objet »).
function slotBtn(ui, state, ctx, slot) {
  const { unit } = ctx;
  const label = unit ? slotName(unit, slot) : HERO_SLOTS[slot];
  const item = unit ? unitGear(state, unit.id)[slot] : state.equipment[slot];
  const on = item ? ctx.sel.item?.id === item.id : ctx.sel.slot === slot && !ctx.sel.item;
  const up = unit ? ctx.unitSlots.has(slot) : Boolean(ctx.best[slot]);
  if (!item) {
    return `<button class="eq-slot empty${on ? ' on' : ''}" data-action="eq-slot" data-value="${slot}" aria-pressed="${on}" title="${escapeHtml(label)} : place vide">
      <span class="eq-slot-box">${img(slotIconName(slot))}${up ? '<span class="eq-up" title="Un objet du sac va ici">▲</span>' : '<span class="eq-add">+</span>'}</span>
      <small class="eq-slot-place">${escapeHtml(label)}</small><small class="eq-slot-name muted">Vide</small></button>`;
  }
  return `<button class="eq-slot r-${item.rarity}${on ? ' on' : ''}" data-action="eq-slot" data-value="${slot}" data-id="${item.id}" aria-pressed="${on}" title="${escapeHtml(label)} : ${escapeHtml(item.name)}">
    <span class="eq-slot-box"><img class="px" src="${itemIconUrl(item)}" alt="">${item.upgrades ? `<span class="eq-plusn">+${item.upgrades}</span>` : ''}${up ? '<span class="eq-up" title="Mieux dans ton sac">▲</span>' : ''}</span>
    <small class="eq-slot-place">${escapeHtml(label)}</small><small class="eq-slot-name">${escapeHtml(shortName(item))} · ${rarityLabel(item.rarity)}</small></button>`;
}

// Les 4 tuiles de statistiques. Héros : Dégâts/s, Vie, Vitesse, Critique ; compagnon : Attaque, PV, Défense, Recharge.
// Quand une place est choisie, la tuile concernée montre le gain du prochain renforcement (« +0,1 si renforcée »).
function tiles(ui, state, ctx) {
  const { unit, st, sel } = ctx;
  const tile = (pic, label, value, sub = '', gain = '') => `<div class="eq-stat"><span class="eq-stat-top">${img(pic)}<small>${label}</small></span><b class="num">${value}</b>${sub ? `<small class="eq-stat-sub">${sub}</small>` : ''}${gain ? `<small class="eq-stat-gain good num">${gain}</small>` : ''}</div>`;
  const item = ctx.tab === 'gear' ? sel.item : null; // le gain du prochain renforcement ne s'affiche que dans l'onglet Équipement
  const done = item && femSlot(heroSlot(item)) ? 'si renforcée' : 'si renforcé';
  if (!unit) {
    let after = null;
    if (item && state.equipment[heroSlot(item)]?.id === item.id) {
      const p = upgradePreview(state, item);
      if (p.after) after = computeHeroStats(state, BALANCE, { ...state.equipment, [heroSlot(item)]: p.after });
    }
    const gain = (a, b, fmt) => (after && b - a > 1e-9 ? `+${fmt(b - a)} ${done}` : '');
    const small = (v) => (v >= 100 ? formatNumber(v) : formatDecimal(v, v < 1 ? 2 : 1));
    return `<div class="eq-stats-row">${tile('weapon_sword', 'Dégâts/s', formatNumber(st.dps), '', gain(st.dps, after?.dps, small))}
      ${tile('icon_heart', 'Vie', formatNumber(st.maxHp), '', gain(st.maxHp, after?.maxHp, small))}
      ${tile('icon_bolt', 'Vitesse', `${formatDecimal(st.attacksPerSecond, 2)}/s`, '', gain(st.attacksPerSecond, after?.attacksPerSecond, (v) => `${formatDecimal(v, 2)}/s`))}
      ${tile('icon_star', 'Critique', `${formatDecimal(st.critChance)} %`, '', gain(st.critChance, after?.critChance, (v) => `${formatDecimal(v, 2)} %`))}</div>`;
  }
  const p = companionProfile(state, unit.id);
  const bare = companionProfile({ ...state, companionGear: null }, unit.id);
  const g = unitGearStats(state, unit.id);
  let next = null, nextG = null;
  if (item && wearerOf(state, item.id) === unit.id && !gearUpgradePreview(state, item, skillKillGold(state)).atMax) {
    const slots = { ...state.companionGear.equipped[unit.id], [eqSlot(item)]: { ...item, upgrades: (item.upgrades ?? 0) + 1 } };
    const st2 = { ...state, companionGear: { ...state.companionGear, equipped: { ...state.companionGear.equipped, [unit.id]: slots } } };
    next = companionProfile(st2, unit.id); nextG = unitGearStats(st2, unit.id);
  }
  const withGear = (a, b) => (a !== b ? `${formatNumber(a)} → ${formatNumber(b)} avec l'équipement` : '');
  const gain = (a, b) => (next && b > a ? `+${formatNumber(b - a)} ${done}` : '');
  return `<div class="eq-stats-row">${tile('weapon_sword', 'Attaque', formatNumber(p.atk), withGear(bare.atk, p.atk), gain(p.atk, next?.atk))}
    ${tile('icon_heart', 'PV', formatNumber(p.maxHp), withGear(bare.maxHp, p.maxHp), gain(p.maxHp, next?.maxHp))}
    ${tile('icon_shield', 'Défense', formatNumber(p.def), withGear(bare.def, p.def), gain(p.def, next?.def))}
    ${tile('icon_bolt', 'Recharge', g.cd ? `−${formatDecimal(g.cd)} %` : '0 %', g.cd ? 'des compétences, avec l\'équipement' : 'des compétences', nextG && nextG.cd > g.cd ? `−${formatDecimal(nextG.cd - g.cd)} % ${done}` : '')}</div>`;
}

// Le personnage en grand : illustration, niveau dans un hexagone, puissance juste en dessous.
function figure(ui, state, ctx, faded = false) {
  const { unit, st, sel } = ctx;
  let art;
  if (unit) {
    art = isAwakened(state, unit.id) ? `<img class="hd-art eq-art px-hd" src="assets/hd/px/awake/ally_${unit.id}.webp" alt="" loading="lazy">` : hdArt(unit, 'eq-art') || companionPortrait(unit, true);
  } else {
    const look = heroById(state.heroes?.active);
    const prev = sel.item && canEquip(state, sel.item) && !wearerOf(state, sel.item.id) ? { ...state.equipment, [heroSlot(sel.item)]: sel.item } : state.equipment;
    art = `${look ? hdArt(look, 'eq-art') : ''}<span class="eq-live" title="Ton héros avec l'objet choisi">${animCanvas('hero', 64, 64, 3, `data-big="1" data-preview="${escapeHtml(JSON.stringify(prev))}"`)}</span>`;
  }
  const level = unit ? unitLevel(state, unit.id) : state.level;
  const power = unit ? unitPower(state, unit) : st.combatPower;
  const i = ctx.order.indexOf(ctx.who);
  const nav = (dir, sign) => (ctx.order.length > 1 ? `<button class="eq-nav ${dir}" data-action="gear-who" data-value="${ctx.order[(i + sign + ctx.order.length) % ctx.order.length]}" aria-label="${sign < 0 ? 'Personnage précédent' : 'Personnage suivant'}">${sign < 0 ? '‹' : '›'}</button>` : '');
  return `<div class="eq-figure${faded ? ' faded' : ''}">${nav('prev', -1)}<div class="eq-art-box">${art}</div>${nav('next', 1)}
    <div class="eq-id"><span class="eq-hex" title="Niveau"><small>Niv.</small><b class="num">${level}</b></span>
      <span class="eq-power"><small>Puissance</small><b class="num">${formatNumber(power)}</b></span></div></div>`;
}

// Centre de l'écran : places autour du personnage, bouton vert « Équipement rapide (N ▲) », tuiles.
function stage(ui, state, ctx) {
  const { unit } = ctx;
  const slots = unit ? Object.keys(unitGear(state, unit.id)) : Object.keys(HERO_SLOTS);
  const half = Math.ceil(slots.length / 2);
  const n = unit ? bestGearFor(state, unit.id).length : ctx.plan.changes.length;
  const quick = n ? `<button class="btn eq-quick" data-action="eq-quick" data-value="${ctx.who}">Équipement rapide (${n} ▲)</button>`
    : '<span class="eq-quick-none muted">Rien de mieux dans ton sac pour l\'instant.</span>';
  let middle;
  if (ctx.tab === 'skills' && unit) {
    const own = state.companions.owned[unit.id];
    middle = `<div class="eq-doll eq-skillring">${figure(ui, state, ctx, true)}${skillIcons(ui, state, unit, own)}</div>`;
  } else {
    middle = `<div class="eq-doll n${slots.length}"><div class="eq-slots left">${slots.slice(0, half).map((s) => slotBtn(ui, state, ctx, s)).join('')}</div>
      ${figure(ui, state, ctx)}<div class="eq-slots right">${slots.slice(half).map((s) => slotBtn(ui, state, ctx, s)).join('')}</div></div>
      <div class="eq-quick-row">${quick}</div>`;
  }
  return `<section class="eq-stage" style="background-image:linear-gradient(#0c1426d9,#0c1426f2),url('assets/ui/art98/guild_hall.png')" aria-label="${escapeHtml(unit ? unit.name : 'Héros')}">${middle}${tiles(ui, state, ctx)}</section>`;
}

const sheetShell = (ui, cls, label, body) => `<aside class="eq-sheet ${cls}" aria-label="${escapeHtml(label)}">${body}</aside>`;

// Confirmation de l'Équipement rapide : chaque place avant → après, puis la puissance avant → après.
function quickSheet(ui, state, ctx) {
  const { unit } = ctx;
  let rows, total;
  if (unit) {
    const ids = bestGearFor(state, unit.id);
    const worn = unitGear(state, unit.id);
    const pool = [...state.inventory, ...(state.stash ?? [])];
    rows = ids.map((id) => pool.find((i) => i.id === id)).filter(Boolean).map((to) => {
      const from = worn[eqSlot(to)];
      return `<div class="eq-qrow"><small>${escapeHtml(slotName(unit, eqSlot(to)))}</small><span><span class="muted">${from ? escapeHtml(from.name) : 'place vide'}</span> <i>→</i> <b class="r-${to.rarity} rarity-text">${escapeHtml(to.name)}</b></span></div>`;
    }).join('');
    const a = statText(unitGearStats(state, unit.id)) || 'aucun bonus', b = statText(gearStatsWith(state, unit.id, ids));
    total = `<div class="eq-ba"><span class="muted">${escapeHtml(a)}</span><i>→</i><b class="good">${escapeHtml(b)}</b></div>`;
  } else {
    const plan = ctx.plan;
    rows = plan.changes.map((c) => `<div class="eq-qrow"><small>${HERO_SLOTS[c.slot]} <span class="good num">${pctText(c.pct)}</span></small><span><span class="muted">${c.from ? escapeHtml(c.from.name) : 'place vide'}</span> <i>→</i> <b class="r-${c.to.rarity} rarity-text">${escapeHtml(c.to.name)}</b></span></div>`).join('');
    total = `<div class="eq-row chg pw"><span>${img('icon_crown')} Puissance</span><span class="num muted">${formatNumber(plan.before)}</span><i>→</i><b class="num good">${distinctTo(formatNumber(plan.before), formatNumber(plan.after), (plan.after / Math.max(1, plan.before) - 1) * 100)}</b></div>`;
  }
  return `<aside class="eq-sheet eq-quick-sheet${ui.view.sheetOpen === 'item' ? ' is-open' : ''}" aria-label="Équipement rapide"><div class="eq-sh-head"><div class="eq-sh-id"><b class="eq-name">Équipement rapide</b>
      <div class="muted">Le meilleur objet de ton sac pour chaque place. Les anciens objets retournent dans le sac.</div></div></div>
    <section class="eq-sec"><h4>Avant → après</h4><div class="eq-rows">${rows}${total}</div>
      <div class="eq-actions"><button class="btn eq-quick" data-action="eq-quick-ok" data-value="${ctx.who}">Confirmer</button><button class="btn" data-action="eq-quick" data-value="">Annuler</button></div></section></aside>`;
}

// Onglet « Vue d'ensemble » : ce qui peut s'améliorer sur ce personnage, et où aller.
function overviewSheet(ui, state, ctx) {
  const { unit } = ctx;
  const line = (pic, title, text, btn) => `<div class="eq-over-row">${img(pic)}<span><b>${title}</b><small>${text}</small></span>${btn}</div>`;
  const go = (tab, label = 'Voir') => `<button class="btn small" data-action="eq-tab" data-value="${tab}">${label} ›</button>`;
  if (!unit) {
    const worn = Object.values(state.equipment).filter(Boolean).length;
    const n = ctx.plan.changes.length;
    const top = upgradeRanking(state).find((r) => r.preview.canPay);
    const cls = activeClass(state);
    return sheetShell(ui, 'eq-over', 'Vue d\'ensemble', `<div class="eq-sh-head"><div class="eq-sh-id"><b class="eq-name">Ton héros</b>
        <div class="muted">Niveau ${state.level} · classe <b style="color:${cls.color}">${escapeHtml(cls.name)}</b></div></div></div>
      <section class="eq-sec"><h4>Ce qui peut s'améliorer</h4>
        ${line('icon_bag', `Équipement : ${worn}/${Object.keys(HERO_SLOTS).length} places`, n ? `<span class="good">${n} ▲ à équiper depuis ton sac</span>` : 'Rien de mieux dans ton sac.', go('gear'))}
        ${line('icon_anvil', 'Renforcement', top ? `<span class="good">${escapeHtml(top.item.name)} +${top.preview.level} → +${top.preview.level + 1} : ${pctText(top.gainPct)} de puissance</span>` : 'Aucun renforcement payable pour l\'instant.', top ? `<button class="btn small" data-action="eq-slot" data-value="${top.slot}" data-id="${top.item.id}">Voir ›</button>` : go('gear'))}
        ${line('icon_upgrade', 'Améliorations', 'Dépense ton or pour monter Dégâts, Vie et le reste.', '<button class="btn small" data-action="open-tab" data-value="upgrades">Y aller ›</button>')}
        ${line('skill_quick', 'Compétences', 'Les sorts que ton héros lance tout seul.', '<button class="btn small" data-action="open-tab" data-value="skills">Y aller ›</button>')}</section>`);
  }
  const own = state.companions.owned[unit.id];
  const lv = unitLevel(state, unit.id);
  const maxed = lv >= COMPANION_RULES.maxLevel;
  const copies = Math.min(COMPANION_RULES.maxCopies, own?.stars ?? 1);
  const sk = skillLevels(own);
  const kg = skillKillGold(state);
  const skillOk = ['passive', 'active', 'ultimate'].some((k) => { const cost = skillUpgradeCost(own, k, kg); return cost && canAfford(state, cost); });
  const worn = Object.values(unitGear(state, unit.id)).filter(Boolean).length;
  const ups = bestGearFor(state, unit.id).length;
  return sheetShell(ui, 'eq-over', 'Vue d\'ensemble', `<div class="eq-sh-head"><div class="eq-sh-id"><b class="eq-name r-${unit.rarity}">${escapeHtml(unit.name)}</b>
      <div class="eq-pills"><span class="rar-pill r-${unit.rarity}">${rarityLabel(unit.rarity)}</span>${elementBadge(unitElement(unit.id))}<span class="role-pill">${escapeHtml(GEAR_CLASSES[gearClassOf(unit)].label)}</span></div></div></div>
    <section class="eq-sec"><h4>Ce qui peut s'améliorer</h4>
      ${line('icon_upgrade', `Niveau ${lv} / ${COMPANION_RULES.maxLevel}`, maxed ? 'Niveau maximal.' : `Niv. ${lv} → ${lv + 1} avec de l'or.`, maxed ? '' : costButton({ action: 'upgrade-companion', cost: companionUpgradeCost(state, unit.id), have: state.gold, attrs: `data-value="${unit.id}"`, cls: 'btn-gold small', label: 'Monter ' }))}
      ${line('icon_star', `Étoile suivante : ${copies}/${COMPANION_RULES.maxCopies} copies`, copies < COMPANION_RULES.maxCopies ? `Prochaine copie : +${DUP_BONUS_PCT[copies]} % aux stats.` : 'Toutes les étoiles sont gagnées.', go('stars'))}
      ${line('skill_quick', 'Compétences', `Passif ${sk.passive} · Active ${sk.active} · Ultime ${sk.ultimate}${skillOk ? ' · <span class="good">une amélioration est payable</span>' : ''}`, go('skills'))}
      ${line('icon_bag', `Équipement : ${worn}/3 places`, ups ? `<span class="good">${ups} ▲ à équiper depuis ton sac</span>` : 'Rien de mieux dans ton sac.', go('gear'))}</section>`);
}

// Onglet « Étoiles » : étoiles actuelles → suivantes, tableau avant → après, copies possédées / requises.
// Les étoiles viennent des copies obtenues à l'Invocation (règle inchangée : core/progression.js).
function starsSheet(ui, state, ctx) {
  const c = ctx.unit;
  const own = state.companions.owned[c.id] ?? { stars: 1, level: 1 };
  const max = COMPANION_RULES.maxCopies;
  const copies = Math.min(max, own.stars ?? 1);
  const dia = (n) => `<span class="eq-dia" aria-label="${n} étoile${n > 1 ? 's' : ''} sur ${max - 1}">${'◆'.repeat(n)}<i>${'◆'.repeat(max - 1 - n)}</i></span>`;
  if (copies >= max) {
    return sheetShell(ui, 'eq-stars', 'Étoiles', `<div class="eq-sh-head"><div class="eq-sh-id"><b class="eq-name">Étoiles</b><div>${dia(max - 1)}</div></div></div>
      <section class="eq-sec"><p class="good">Toutes les étoiles sont gagnées : +${DUP_BONUS_PCT[max - 1]} % aux statistiques.</p></section>`);
  }
  const st2 = { ...state, companions: { ...state.companions, owned: { ...state.companions.owned, [c.id]: { ...own, stars: copies + 1 } } } };
  const a = companionProfile(state, c.id), b = companionProfile(st2, c.id);
  const row = (label, x, y) => `<div class="eq-row chg"><span>${label}</span><span class="num muted">${x}</span><i>→</i><b class="num good">${distinctTo(x, y, DUP_BONUS_PCT[copies] - DUP_BONUS_PCT[copies - 1])}</b></div>`;
  const ultHead = copies + 1 === ULT_UNLOCK_COPIES ? '<div class="eq-named">Niveau max de l\'ultime <b>5 → 10</b></div>' : '';
  const tier = [3, 5].map((n) => `<li class="${copies >= n ? 'good' : copies + 1 === n ? 'next' : 'muted'}">${n} copies : ${escapeHtml(STAR_TIERS[n].text)}${copies >= n ? ' ✓' : ''}</li>`).join('');
  return sheetShell(ui, 'eq-stars', 'Étoiles', `<div class="eq-sh-head"><div class="eq-sh-id"><b class="eq-name">Étoiles</b>
      <div class="eq-dia-line">${dia(copies - 1)}<i>→</i>${dia(copies)}</div></div></div>
    <section class="eq-sec">${ultHead}<h4>Avec une copie de plus</h4><div class="eq-rows">
      ${row('Puissance', formatNumber(unitPower(state, c)), formatNumber(unitPower(st2, c)))}${row('PV', formatNumber(a.maxHp), formatNumber(b.maxHp))}
      ${row('Attaque', formatNumber(a.atk), formatNumber(b.atk))}${row('Défense', formatNumber(a.def), formatNumber(b.def))}
      ${row('Bonus de copies', `+${DUP_BONUS_PCT[copies - 1]} %`, `+${DUP_BONUS_PCT[copies]} %`)}</div>
      <ul class="eq-tiers">${tier}</ul></section>
    <section class="eq-sec"><h4>Copies</h4>
      <div class="eq-frag"><div class="eq-frag-bar"><i style="width:${(copies / max) * 100}%"></i></div><b class="num">${copies}/${max}</b></div>
      <div class="eq-cost no">${img('icon_summon')}<span class="eq-need">Étoile suivante : 1 copie</span><span class="eq-have bad num">0/1</span><button class="eq-plusbtn" data-action="open-tab" data-value="summon" aria-label="Aller à l'Invocation">+</button></div>
      <p class="eq-rule muted">Chaque copie de ${escapeHtml(c.name)} obtenue à l'Invocation ajoute une étoile toute seule : rien à promouvoir à la main.</p>
      <button class="btn btn-gold eq-do" data-action="open-tab" data-value="summon">Invoquer ›</button></section>`);
}

// Onglet « Compétences » : la fiche de la compétence choisie (effet actuel, niveau suivant en orange, coût), et le
// bandeau rouge quand c'est le nombre de copies qui bloque.
function skillsSheet(ui, state, ctx) {
  const c = ctx.unit;
  const own = state.companions.owned[c.id] ?? { stars: 1, level: 1 };
  const kind = ui.view.skillPop;
  const copies = own.stars ?? 1;
  const blocked = kind === 'ultimate' && copies < ULT_UNLOCK_COPIES && skillLevels(own).ultimate >= 5
    ? `<button class="eq-block" data-action="eq-tab" data-value="stars">Niveaux 6 à 10 de l'ultime : il faut la ${ULT_UNLOCK_COPIES}e copie ›</button>` : '';
  return sheetShell(ui, 'eq-skills', 'Compétences', `<div class="eq-sh-head"><div class="eq-sh-id"><b class="eq-name">Compétences</b>
      <div class="muted">Touche une icône autour de ${escapeHtml(c.name)} pour voir son effet et son niveau suivant.</div></div></div>
    <section class="eq-sec">${kind ? skillBubble(ui, state, c, own, Boolean(state.companions.owned[c.id])) : '<p class="muted">Aucune compétence choisie.</p>'}${blocked}</section>`);
}

// ---------------------------------------------------------------------------------------------------------------
// Le sac : cartes carrées, fond à la couleur de la rareté, niveau en bas, porteur en haut à droite, cadenas.
function bagSection(ui, state, ctx) {
  const { unit } = ctx;
  const items = visibleItems(state);
  const usableBy = (i) => (unit ? unitCanEquip(state, unit.id, i).ok : canEquip(state, i));
  const shown = ui.view.bagAll ? items : items.filter(usableBy);
  const hidden = items.length - shown.length;
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  const slotF = state.ui.slotFilter ?? 'all', rarF = state.ui.rarityFilter ?? 'all';
  const passes = (i) => (slotF === 'all' || i.slot === slotF || eqSlot(i) === slotF) && (rarF === 'all' || i.rarity === rarF);
  const card = (i, { wearer = '', worn = false } = {}) => {
    const usable = worn || usableBy(i);
    const up = !worn && (unit ? ctx.unitIds.has(i.id) : ctx.gains.get(i.id)?.up);
    return `<button class="eq-card r-${i.rarity}${i.id === ctx.sel.item?.id ? ' selected' : ''}${usable ? '' : ' dim'}${worn ? ' worn' : ''}${itemBase(i.baseId).signature ? ' signature' : ''}" data-action="select-item" data-id="${i.id}"
      title="${escapeHtml(i.name)}${i.upgrades ? ` +${i.upgrades}` : ''} · ${rarityLabel(i.rarity)} · niveau d'objet ${i.level}">
      <img class="px" src="${itemIconUrl(i)}" alt="${escapeHtml(i.name)}">${i.upgrades ? `<span class="eq-plusn">+${i.upgrades}</span>` : ''}${wearer || (up ? '<span class="eq-up" title="Meilleur que l\'objet porté">▲</span>' : '')}
      ${i.locked ? `<img class="px lock" src="${icon('icon_lock', 1)}" alt="Verrouillé">` : ''}${i.set && setById(i.set) ? `<img class="px set-ico" src="${icon(`set_${i.set}`, 1)}" alt="" title="Ensemble : ${escapeHtml(setById(i.set).name)}">` : ''}
      <small class="eq-card-lvl">${usable ? `Niv. ${i.level}` : escapeHtml(classLabel(itemClass(state, i)))}</small></button>`;
  };
  // Objets portés (héros et équipe), en tête, avec le porteur en haut à droite.
  const wornCards = [
    ...Object.values(state.equipment).filter(Boolean).filter(passes).map((i) => card(i, { worn: true, wearer: `<span class="eq-wearer" title="Porté par ton héros">${img('menu_hero')}</span>` })),
    ...ctx.team.flatMap((c) => Object.values(unitGear(state, c.id)).filter(Boolean).filter(passes).map((i) => card(i, { worn: true, wearer: `<span class="eq-wearer" title="Porté par ${escapeHtml(c.name)}">${companionStill(c)}</span>` }))),
  ].join('');
  const FILTERS = [['all', 'Tous les objets', null, 'Tous'], ['weapon', 'Armes', 'weapon', 'Armes'], ['armor', 'Armures', 'armor', 'Armures'], ['accessory', 'Accessoires', 'ring', 'Accessoires']];
  const filterChips = FILTERS.map(([v, l, slot, word]) => `<button class="btn chip-btn filter-chip${slotF === v ? ' active' : ''}" data-action="filter" data-value="${v}"
      aria-label="${l}" title="${l}" aria-pressed="${slotF === v}">${slot ? `${img(slotIconName(slot))}<span class="icon-word" aria-hidden="true">${word}</span>` : '<b>Tous</b>'}</button>`).join('');
  const sortOptions = Object.entries(SORT_LABELS).map(([v, l]) => `<option value="${v}" ${v === state.ui.sortBy ? 'selected' : ''}>${l}</option>`).join('');
  const tools = ui.view.bagMenu ? `<div class="inv-tools"><div class="filter-chips" role="group" aria-label="Emplacement">${filterChips}</div>
      <select data-action="sort" aria-label="Trier">${sortOptions}</select>
      <select data-action="rarity-filter" aria-label="Rareté">${[['all', 'Toutes'], ...RARITIES.map((r) => [r.id, r.label])].map(([v, l]) => `<option value="${v}" ${v === rarF ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${ui.view.bagAll ? '<button class="btn small bag-for" data-action="bag-all" data-value="">Seulement les objets utilisables</button>' : `<button class="btn small bag-for" data-action="bag-all" data-value="1">Voir aussi les objets des autres classes${hidden ? ` (${hidden})` : ''}</button>`}` : '';
  const grid = shown.map((i) => card(i)).join('');
  return `${tools}<div class="eq-bag-grid">${wornCards}${grid}</div>
    ${grid ? '' : '<div class="eq-bag-empty"><img class="px empty-art" src="assets/ui/art98/empty_chest.png" alt="">Ton sac est vide. Les monstres laissent parfois tomber de l\'équipement.</div>'}
    ${recycleButton(state)}${full ? '<div class="bad">Sac plein : recycle les objets inutiles ou range-les dans la Réserve.</div>' : ''}`;
}

// v9.5.2 (2.3) : bandeau Ensembles — pour chaque ensemble entamé : pièces portées / possédées, prochain palier, spécialité
// et où trouver les pièces manquantes (le monde de l'ensemble).
// v9.8 (B2) : sous le sac, replié par défaut (le titre donne le nombre d'ensembles entamés).
function setsBanner(ui, state) {
  const worn = setCounts(state.equipment);
  const owned = {};
  for (const i of [...state.inventory, ...(state.stash ?? []), ...Object.values(state.equipment).filter(Boolean)]) if (i?.set) owned[i.set] = (owned[i.set] ?? 0) + 1;
  const rows = ITEM_SETS.filter((st) => owned[st.id]).map((st) => {
    const w = worn[st.id] ?? 0;
    const next = SET_PIECES.find((n) => n > w);
    const nb = next ? effectText(st.bonuses[next]) : '';
    return `<div class="set-row" style="--sc:${st.color}"><b>${escapeHtml(st.name)}</b> <span class="set-tag">${SET_SPECIALTY[st.id] ?? ''}</span>
      <span class="num">${w}/6 portées · ${owned[st.id]} possédées</span>${next ? ` · <span class="muted">à ${next} : ${nb} — pièces : ${escapeHtml(ZONES[st.zone]?.name ?? '')}</span>` : ' · <span class="good">complet</span>'}</div>`;
  }).join('');
  const hel = heroElement(state); // v9.6.1 (4.6) : 2 pièces d'un ensemble donnent son élément au héros
  const elLine = `<div class="muted">Élément du héros : ${hel ? elementBadge(hel) : 'neutre'} (2 pièces d'un ensemble lui donnent l'élément de son monde).</div>`;
  const n = Object.keys(owned).length;
  return rows ? `<div class="sets-banner">${fold(ui, 'inv-sets', 'Ensembles', () => elLine + rows, { extra: `${n} entamé${n > 1 ? 's' : ''}` })}</div>` : '';
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
  const over = state.stash.length > STASH_SIZE ? `<div class="bad">Réserve au-delà de ${STASH_SIZE} (pièces des anciens mannequins) : rien n'est perdu, mais rien n'y entre tant qu'il n'est pas redescendu.</div>` : '';
  return `<div class="muted">La Réserve garde ${STASH_SIZE} objets de plus que le sac, <b>jamais recyclés ni fusionnés</b>. Les pièces d'ensemble meilleures y vont d'elles-mêmes.
      <button class="btn chip-btn small${auto ? ' active' : ''}" data-action="auto-mannequin" title="Une pièce d'ensemble ramassée, meilleure que la meilleure du coffre pour son emplacement, y va (l'ancienne est recyclée, sauf verrouillée)">${auto ? 'Rangement auto : activé' : 'Rangement auto : désactivé'}</button></div>
    ${over}${filter}${tiers}
    ${items.length ? `<div class="stash-layout"><div class="inv-grid">${grid}</div>${detail}</div>` : '<div class="card muted">La Réserve est vide.</div>'}`;
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
  return `<div class="card"><span class="muted">Le Musée expose tes objets ancestraux, un par vitrine, dès qu'ils sont ramassés. Chaque pièce exposée :
      dégâts, PV et or ${pct(per.damageMultPct)} (multiplicatif, ×2 si Légendaire). Collection complète : dégâts et PV +${MUSEUM.complete.damageMultPct} % de plus.
      Une pièce exposée n'est pas portée : reprends-la (↩) pour l'équiper.</span>
      <div class="museum-total"><b>${n}/${MUSEUM_PIECES.length}</b> pièces exposées${n && total ? ` · <span class="good">${total}</span>` : ''}</div>
      ${tools}</div>
    <div class="museum">${cases}</div>`;
}

// Réglages du sac (v9.1.0) : un seul écran replié pour tous les automatismes et le recyclage en lot.
// v9.1.3 (doc1 « Équipement : autres », recyclage en 3 entrées) : une phrase et 3 replis. Recycler un objet seul
// se fait depuis sa fiche ; ici le lot, la règle automatique (raretés) et, en avancé, le mode et les filtres.
// Le rangement auto des pièces d'ensemble n'est plus répété ici : il est dans le Coffre (v9.1.3).
function bagSettings(ui, state) {
  const candidates = bulkRecycleCandidates(state, ui.view.bulkRarity);
  const bulkGold = candidates.reduce((s, i) => s + recycleValue(i, BALANCE, recycleLevelOf(state)), 0); // v9.1.3 : même plafond que le recyclage
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
// v9.6.1 (2.7) : choix du monde ou du mode auquel un Build s'applique tout seul.
function bindOptions(state, cur) {
  const zones = ZONES.map((z, i) => [`zone:${i}`, `Monde ${i + 1} : ${z.name}`]).filter(([, ], i) => i * 20 < Math.max(state.maxStage, state.records?.bestStage ?? 1));
  return [['', '— aucun —'], ...Object.entries(BIND_MODES), ...zones].map(([v, t]) => `<option value="${v}"${(cur ?? '') === v ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('');
}

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
      : 'Vide : équipe-toi puis « Enregistrer ».';
    return `<div class="card build-card${i === sel ? ' selected' : ''}">
      <div class="row-between"><b>${escapeHtml(l.name)}</b>
        <span class="build-btns">${l.team ? `<button class="btn small btn-primary" data-action="apply-build" data-value="${i}">Équiper</button>` : ''}
        <button class="btn small" data-action="save-loadout" data-value="${i}">Enregistrer</button>
        <button class="btn small" data-action="rename-build" data-value="${i}" aria-label="Renommer" title="Renommer">✎<span class="icon-word" aria-hidden="true"> Renommer</span></button></span></div>
      <div class="muted">${summary}</div>
      ${l.team ? `<label class="build-bind">Attaché à : <select data-action="bind-build" data-value="${i}">${bindOptions(state, l.bind)}</select></label>` : ''}
      ${renaming ? `<div class="row"><input id="build-name" type="text" maxlength="24" value="${escapeHtml(l.name)}" aria-label="Nouveau nom">
        <button class="btn small btn-primary" data-action="confirm-rename-build" data-value="${i}">OK</button></div>` : ''}
    </div>`;
  };
  return `<div class="build-cards">${state.loadouts.map(card).join('')}</div>`;
}

// Fusion automatique (v8.1) : 5 objets identiques (emplacement + rareté) → 1 objet de rareté supérieure.
function autoFuseEditor(state) {
  const f = state.ui.autoFuse ?? { on: false, rarities: ['common'] };
  const chips = RARITIES.filter((r) => fusableRarities().includes(r.id)).map( // v9.1.3 (doc3 lot 2) : raretés de BALANCE.forge.fusion
    (r) => `<button class="btn chip-btn small${f.rarities.includes(r.id) ? ' active' : ''}" data-action="autofuse" data-group="rarities" data-value="${r.id}">${r.label}</button>`).join('');
  return `<label class="inv-rule" title="Mise de 5 à 100 % seulement. Jamais fusionné : objet verrouillé, ancestral, renforcé, meilleur que l'objet porté, utile à un ensemble, effet gardé ou dans un build."><span>Fusion auto :</span>
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
    <label class="inv-rule" title="Une pièce d'ensemble est gardée dès que tu en as 2 emplacements différents (la meilleure par emplacement).">
      <span>Ensembles :</span><button class="btn chip-btn small${state.ui.keepSets !== false ? ' active' : ''}" data-action="keep-sets">${state.ui.keepSets !== false ? 'Garder les pièces utiles' : 'Recycler comme le reste'}</button></label>
      <label class="row"><span>Objets inutiles :</span><button class="btn chip-btn small${state.ui.autoUseless !== false ? ' active' : ''}" data-action="auto-useless">${state.ui.autoUseless !== false ? 'Recyclés à la récupération' : 'Gardés dans le sac'}</button></label>
    ${autoFuseEditor(state)}
  </div>`;
}

export default {
  id: 'inventory',
  title: 'Équipement',
  icon: 'icon_bag',
  extra: () => '',
  // Téléphone : à l'ouverture de la feuille du bas, les places remontent en haut du panneau et la feuille s'arrête
  // juste dessous : les places restent visibles au-dessus de la fiche (sauf fenêtre trop basse : la fiche d'abord).
  afterRender(ui, body) {
    const pop = body.querySelector('.eq-pop');
    if (!pop) { ui.view.eqPopKey = null; return; }
    const slots = [...body.querySelectorAll('.eq-doll .eq-slot')];
    if (!slots.length) return;
    const key = ui.view.gearWho ?? 'hero';
    if (ui.view.eqPopKey !== key) {
      body.scrollTop += Math.min(...slots.map((s) => s.getBoundingClientRect().top)) - body.getBoundingClientRect().top - 6;
      ui.view.eqPopKey = key;
    }
    const bottom = Math.max(...slots.map((s) => s.getBoundingClientRect().bottom));
    pop.style.setProperty('max-height', `${Math.round(Math.max(window.innerHeight * 0.5, window.innerHeight - bottom - 6))}px`, 'important');
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
    const TABS = unit ? [['overview', 'Vue d\'ensemble'], ['gear', 'Équipement'], ['stars', 'Étoiles'], ['skills', 'Compétences']] : [['overview', 'Vue d\'ensemble'], ['gear', 'Équipement']];
    const tab = TABS.some(([id]) => id === v.eqTab) ? v.eqTab : 'gear';
    const unitIds = new Set(unit ? bestGearFor(state, unit.id) : []);
    const unitSlots = new Set([...state.inventory, ...(state.stash ?? [])].filter((i) => unitIds.has(i.id)).map((i) => eqSlot(i)));
    const ctx = { who, unit, team, order: ['hero', ...team.map((c) => c.id)], st, gains, best, plan, sel: { item, slot }, tab, unitIds, unitSlots };
    const isWorn = item && (Object.values(state.equipment).some((i) => i?.id === item.id) || Boolean(wearerOf(state, item.id)));
    const quickN = unit ? unitIds.size : plan.changes.length;
    let sheet;
    if (tab === 'overview') sheet = overviewSheet(ui, state, ctx);
    else if (tab === 'stars') sheet = starsSheet(ui, state, ctx);
    else if (tab === 'skills') sheet = skillsSheet(ui, state, ctx);
    else if (v.eqQuick === who && quickN) sheet = quickSheet(ui, state, ctx);
    else if (item && v.eqChange && isWorn) sheet = changeSheet(ui, state, { unit, item, slot, gains, best });
    else if (item) sheet = itemSheet(ui, state, { unit, item, slot, gains, best });
    else sheet = emptySlotSheet(ui, state, { unit, slot, gains });
    // Téléphone : la fiche de l'objet est une feuille du bas (ouverte en touchant une place ou un objet).
    const narrow = (ui.root?.clientWidth ?? 9999) <= 600;
    const pop = narrow && tab === 'gear';
    const sheetHtml = !pop ? sheet : v.sheetOpen === 'item'
      ? `<div class="unit-pop-backdrop eq-backdrop" data-action="close-sheet"></div><div class="unit-pop eq-pop" role="dialog" aria-modal="true" aria-label="Fiche de l'objet">${sheet}</div>` : '';
    const tabs = `<div class="eq-tabs" role="tablist">${TABS.map(([id, label]) => `<button class="eq-tab${id === tab ? ' on' : ''}" role="tab" aria-selected="${id === tab}" data-action="eq-tab" data-value="${id}">${label}</button>`).join('')}
      ${wheelShown(state) ? '<button class="btn small eq-elem" data-action="elements-help" aria-label="Éléments" title="Éléments">?<span> Éléments</span></button>' : ''}</div>`;
    const bagHead = `<div class="inv-head eq-bag-head">
        ${open('stash') ? segment([['bag', `Sac ${state.inventory.length}/${BALANCE.loot.inventorySize}`, 'icon_bag'], ['stash', `Réserve ${state.stash.length}/${STASH_SIZE}`, 'icon_chest']], 'inv-tab', invTab) : `<b class="inv-bag-count">${img('icon_bag')} Sac ${state.inventory.length}/${BALANCE.loot.inventorySize}</b>`}
        <button class="btn small bag-gear${v.bagMenu ? ' active' : ''}" data-action="bag-menu" aria-expanded="${Boolean(v.bagMenu)}" aria-label="Filtres, builds et réglages du sac" title="Filtres, builds et réglages du sac">⚙ Filtres</button>
      </div>
      ${!v.bagMenu ? '' : `<div class="equip-for" role="group" aria-label="Équiper pour"><span>Équiper pour :</span>${['attack', 'survival', 'fortune'].map((p) => `<button class="btn small${state.ui.gearProfile === p ? ' active' : ''}" data-action="equip-for" data-value="${p}" title="${PROFILE_TIPS[p]}">${img(PROFILE_ICONS[p])} ${GEAR_PROFILES[p].label}</button>`).join('')}</div>
        <div class="card bag-menu">${fold(ui, 'inv-builds', 'Builds', () => buildsBar(ui, state), { extra: state.loadouts[Math.max(0, v.buildSel ?? 0)]?.name ?? '' })}
        ${fold(ui, 'bag-settings', 'Réglages du sac', () => bagSettings(ui, state))}</div>`}`;
    return `<div class="eq${narrow ? ' eq-phone' : ''} eq-on-${tab} eq-who-${unit ? 'unit' : 'hero'}">${resourceBand(state)}${tabs}
      <div class="eq-main"><div class="eq-side">${whoColumn(ui, state, ctx)}${bastionShortcuts(state)}</div>${stage(ui, state, ctx)}${sheetHtml}</div>
      <div class="card eq-bag">${bagHead}${invTab === 'stash' ? stashView(ui, state) : bagSection(ui, state, ctx)}</div>
      ${setsBanner(ui, state)}</div>`;
  },
};
