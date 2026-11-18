// Équipe > Composition : le héros + 2 compagnons + 1 familier ; collection, niveaux, capacités.
// v9.1.0 : expéditions dans leur propre onglet, builds dans Équipement, synergies repliées (actives visibles).
import { teamChips } from '../team-chips.js'; // v9.9 (K16)
import { BONDS } from '../../data/bonds.js'; // v9.7.1 (lot 6)
import { BALANCE } from '../../data/balance.js';
import { COMPANION_RULES } from '../../data/companions.js';
import { UNITS as COMPANIONS } from '../../data/banners.js'; // v9.1.3 (partie B) : persos de bannière compris quand actifs
import { teamAdvice } from '../../core/team-advisor.js'; // v9.5.0
import { frontCompanion } from '../../core/behaviors.js'; // v9.6.3
import { RESONANCE, elementResonance, teamSlotsOf } from '../../core/companions.js'; // v9.6.1
import { MULTIPLICATIVE, RARITY_SKILL, activeSynergies, allCompanionSkills, companionById, companionMultiplier, companionSkillMultiplier, companionSkills, companionUpgradeCost, skillKillGold, duplicates, equippedOfKind, teamKind, ultimateUnlocked, unitLevel } from '../../core/companions.js';
import { COMPANION_ROLES, ROLES, SYNERGIES } from '../../data/synergies.js';
import { elementBadge, elementWheel, unitElement, zoneElement, wheelShown } from '../../core/elements.js'; // v9.3.1 : types · v9.5.1 : roue
import { currentEncounter } from '../../core/combat.js'; // v9.5.1
import { costButton, effectText, escapeHtml, fold, hdArt, formatNumber, icon, img, rarityLabel, stars } from '../common.js';
import { animCanvas } from '../animator.js';
import { showcaseSlot } from '../showcase.js'; // v9.2.7 : vitrine animée
import { DUNGEONS } from '../../data/dungeons.js';
import { SKILL_RULES, skillTextAt } from '../../data/companion-skills.js';
import { computeHeroStats } from '../../core/stats.js';
import { expeditionDone, expeditionType, isAway } from '../../core/expeditions.js';
import { companionPortrait, companionStill } from './expeditions.js';
import { unitPopup } from './unit-popup.js'; // v9.3.4
import { canAfford, dupBonusPct, leveledSkill, levelMult, RESOURCE_KEYS, skillCap, skillLevels, skillUpgradeCost } from '../../core/progression.js'; // v9.3.3
import { ACTIVE_EXTRA_AT, DUP_BONUS_PCT, SKILL_CAPS, SKILL_GROWTH, SKILL_RESOURCES, ULT_UNLOCK_COPIES } from '../../data/progression.js';
import { bestGearFor, canEquip, classLabel, gearWaiting, gearStats, gearUpgradeCost, slotName, statText, unitGear, unitGearStats } from '../../core/companion-gear.js'; // v9.3.4 (f)
import { itemClass } from '../../core/classes.js';
import { eqSlot } from '../../data/items.js';
import { GEAR_CLASSES, STAT_NAMES, gearClassOf } from '../../data/companion-gear.js';

// Compétences (v8.9) : 4 par compagnon, la 4e à 3 doublons. v9.1.3 (doc4 lot 1) : chaque doublon +5 % (formule unique
// de core/companions.js : companionSkillMultiplier) ; aperçu d'une unité non possédée à 0 doublon.
// Attaque = dégâts par seconde de ses compétences offensives.
// v9.1.3 (doc1 « Compagnons ») : la ligne « Défense » répétait le bonus passif (retirée) ; la formule de puissance
// est derrière « ? » ; les 2 compétences de rôle sont repliées (compétence propre et ultime visibles).
// v9.3.4 (f) : équipement unique. Le compagnon porte les objets du sac commun (butin des monstres) de SA classe :
// 3 places nommées selon sa classe, total des bonus, objets compatibles du sac avec comparaison, amélioration, recyclage.
const RAR_ORDER = ['legendary', 'epic', 'rare', 'common'];
function gearBlock(ui, state, c) {
  const cls = gearClassOf(c);
  const worn = unitGear(state, c.id);
  const total = unitGearStats(state, c.id);
  const killGold = skillKillGold(state);
  const f = ui.view.gearFilter ?? { slot: 'all', rarity: 'all', compat: true };
  const PLACES = ['weapon', 'armor', 'accessory'];
  const slots = PLACES.map((slot) => {
    const it = worn[slot];
    return `<div class="gear-slot${it ? ` r-${it.rarity}` : ' empty'}"><small>${escapeHtml(slotName(c, slot))}</small>
      ${it ? `<b>${escapeHtml(it.name)}${it.upgrades ? ` +${it.upgrades}` : ''}</b><span class="muted">${escapeHtml(statText(gearStats(it, state)))}</span>
        <button class="btn tiny" data-action="gear-unequip" data-value="${c.id}|${slot}">Retirer</button>` : '<span class="muted">Vide</span>'}</div>`;
  }).join('');
  const bag = state.inventory
    .filter((i) => (f.slot === 'all' || eqSlot(i) === f.slot) && (f.rarity === 'all' || i.rarity === f.rarity))
    .map((i) => ({ i, chk: canEquip(state, c.id, i) }))
    .filter(({ chk }) => !f.compat || chk.ok)
    .sort((a, b) => Number(b.chk.ok) - Number(a.chk.ok) || RAR_ORDER.indexOf(a.i.rarity) - RAR_ORDER.indexOf(b.i.rarity) || (b.i.upgrades ?? 0) - (a.i.upgrades ?? 0))
    .slice(0, 40);
  const row = ({ i, chk }) => {
    const cur = worn[eqSlot(i)];
    const diff = chk.ok ? Object.keys(STAT_NAMES).map((k) => [k, (gearStats(i, state)[k] ?? 0) - (cur ? gearStats(cur, state)[k] ?? 0 : 0)]).filter(([, d]) => d)
      .map(([k, d]) => `<span class="${d > 0 ? 'good' : 'bad'}">${(k === 'cd') === (d > 0) ? '−' : '+'}${Math.abs(Math.round(d * 10) / 10)} % ${STAT_NAMES[k]}</span>`).join(' ') : ''; // recharge : une hausse = recharge plus courte (−)
    const cost = gearUpgradeCost(i, killGold);
    return `<div class="gear-row r-${i.rarity}${chk.ok ? '' : ' incompatible'}"><div class="grow"><b class="rarity-text r-${i.rarity}">${escapeHtml(i.name)}${i.upgrades ? ` +${i.upgrades}` : ''}</b>
        <small class="muted">${rarityLabel(i.rarity)} · ${escapeHtml(classLabel(itemClass(state, i)))} · ${escapeHtml(statText(gearStats(i, state)))}</small>
        ${chk.ok ? (diff ? `<div class="gear-diff">Si équipé : ${diff}</div>` : '') : `<div class="bad gear-why">🔒 ${escapeHtml(chk.reason)}</div>`}</div>
      <div class="gear-btns">${chk.ok ? `<button class="btn tiny btn-primary" data-action="gear-equip" data-value="${c.id}|${i.id}">Équiper</button>` : ''}
        ${cost ? `<button class="btn tiny" data-action="gear-up" data-value="${i.id}" ${state.gold >= cost.gold && state.materials.shards >= cost.shards ? '' : 'disabled'} title="Améliorer">+${(i.upgrades ?? 0) + 1} · ${img('icon_shard')}${cost.shards} ${img('coin')}${formatNumber(cost.gold)}</button>` : ''}
        ${i.locked ? '' : `<button class="btn tiny" data-action="gear-recycle" data-value="${i.id}" title="Recycler en éclats">♻</button>`}</div></div>`;
  };
  const sel = (key, opts) => `<select data-action="gear-filter" data-key="${key}" aria-label="Filtre">${opts.map(([v, l]) => `<option value="${v}" ${String(f[key]) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const best = bestGearFor(state, c.id).length;
  return `<div class="section-title">Équipement <span class="muted">(${GEAR_CLASSES[cls].label})</span></div>
    ${best ? `<button class="btn btn-gold primary-action gear-best-btn" data-action="gear-best" data-value="${c.id}">⬆ Équiper le meilleur (${best})</button>` : ''}
    <div class="gear-slots">${slots}</div>
    <div class="muted">Total : ${escapeHtml(statText(total)) || 'aucun bonus'}. Attaque, soins et recharge comptent partout ; PV et défense dans l'Arène.</div>
    <div class="gear-filters">${sel('slot', [['all', 'Toutes les places'], ...PLACES.map((s) => [s, slotName(c, s)])])}
      ${sel('rarity', [['all', 'Toutes raretés'], ['legendary', 'Légendaire'], ['epic', 'Épique'], ['rare', 'Rare'], ['common', 'Commun']])}
      ${sel('compat', [['true', 'Compatibles'], ['false', 'Tous les objets']])}</div>
    <div class="gear-list">${bag.map(row).join('') || `<div class="state-empty">Aucun objet ${escapeHtml(classLabel(cls))} dans le sac : les monstres en lâchent pour ton équipe.</div>`}</div>`;
}

export function skillsBlock(ui, state, c, owned) { // v9.1.3 (doc4 lot 5) : réutilisée par « Détails » de la bannière
  // v9.3.3 : trois compétences (passive, active, ultime), toutes disponibles dès le 1er exemplaire ; niveaux 1 à 10
  // (ultime 5 avant le 4e exemplaire) ; effet actuel → suivant, coût en ressources universelles et en or.
  const own = owned ?? { stars: 1, level: 1 };
  const mine = Boolean(owned);
  const hero = computeHeroStats(state);
  const lv = skillLevels(own);
  const list = allCompanionSkills(c.id);
  const actives = list.filter((sk) => !sk.ultimate);
  const ult = list.find((sk) => sk.ultimate);
  const mult = (sk) => companionSkillMultiplier(state, c, sk.type, false, BALANCE, own);
  const used = companionSkills({ ...state, companions: { ...state.companions, owned: { ...state.companions.owned, [c.id]: own } } }, c.id);
  const dps = used.filter((sk) => sk.type === 'hit' || sk.type === 'burst').reduce((sum, sk) => sum + (hero.damage * sk.value * mult(sk)) / sk.every, 0);
  const killGold = skillKillGold(state);
  const costHtml = (cost) => [['grimoire', cost.grimoire], ['ascension', cost.ascension], ['mastery', cost.mastery]].filter(([, v]) => v > 0)
    .map(([k, v]) => `<span class="${(state.materials[k] ?? 0) >= v ? '' : 'bad'}">${img(SKILL_RESOURCES[k].icon)} ${v}</span>`).join(' ')
    + ` <span class="${state.gold >= cost.gold ? '' : 'bad'}">${img('coin')} ${formatNumber(cost.gold)}</span>`;
  const card = (kind, title, body) => {
    const level = lv[kind];
    const cap = skillCap(own, kind);
    const cost = mine ? skillUpgradeCost(own, kind, killGold) : null;
    const lock = kind === 'ultimate' && cap < SKILL_CAPS.ultimate ? `<div class="muted">Niveaux 6 à 10 : avec le ${ULT_UNLOCK_COPIES}e exemplaire.</div>` : '';
    const btn = !mine ? '' : cost
      ? `<button class="btn small ${canAfford(state, cost) ? 'btn-primary' : ''}" data-action="skill-up" data-value="${c.id}|${kind}" ${canAfford(state, cost) ? '' : 'disabled'}>Niv. ${level + 1} · ${costHtml(cost)}</button>`
      : `<span class="good">${level >= SKILL_CAPS[kind] ? 'Niveau maximal' : 'Plafond atteint'}</span>`;
    return `<div class="cskill skill3 ${kind}"><div class="row-between"><b>${title}</b><span class="skill-lv">Niv. <b>${level}</b>/${cap}</span></div>${body}${lock}<div class="skill-up-row">${btn}</div></div>`;
  };
  const effect = (sk, kind, level) => { const x = leveledSkill(sk, kind, level); return `${escapeHtml(skillTextAt(x, mult(x)))} · toutes les ${Math.round(x.every * 10) / 10} s${x.duration ? ` · ${x.duration} s` : ''}`; };
  const nextLine = (sk, kind) => (lv[kind] < skillCap(own, kind) ? `<div class="skill-next">Niv. ${lv[kind] + 1} : ${effect(sk, kind, lv[kind] + 1)}</div>` : '');
  const passiveNow = Math.round((levelMult('passive', lv.passive) - 1) * 100);
  const passive = card('passive', `${img('icon_upgrade')} Passive`, `<div class="muted">${escapeHtml(effectText(c.passive))} de base, renforcé de <b>+${passiveNow} %</b> (+${Math.round(SKILL_GROWTH.passive.perLevel * 100)} % par niveau).</div>`);
  const extras = actives.slice(1).map((sk, i) => `<div class="${lv.active >= ACTIVE_EXTRA_AT[i] ? '' : 'muted locked'}">${lv.active >= ACTIVE_EXTRA_AT[i] ? '✔' : '🔒'} Niv. ${ACTIVE_EXTRA_AT[i]} : ajoute <b>${escapeHtml(sk.name)}</b> (${escapeHtml(effect(sk, 'active', lv.active))})</div>`).join('');
  const active = card('active', `${img('skill_quick')} Active : ${escapeHtml(actives[0].name)}`, `<div class="muted">${effect(actives[0], 'active', lv.active)}</div>${nextLine(actives[0], 'active')}${extras}`);
  const ultimate = ult ? card('ultimate', `${img('icon_star')} Ultime : ${escapeHtml(ult.name)}`, `<div class="muted">${effect(ult, 'ultimate', lv.ultimate)}</div>${nextLine(ult, 'ultimate')}`) : '';
  const res = mine ? `<div class="skill-res">${RESOURCE_KEYS.map((k) => `<button class="btn tiny res-chip" data-action="res-info" data-value="${k}" title="${escapeHtml(SKILL_RESOURCES[k].use)}">${img(SKILL_RESOURCES[k].icon)} ${SKILL_RESOURCES[k].short} <b>${formatNumber(state.materials[k] ?? 0)}</b></button>`).join('')}</div>` : '';
  return `<div class="cstats"><span>⚔ Attaque <b>${formatNumber(dps)}</b>/s</span> <span>Copies : <b>+${dupBonusPct(own)} %</b> aux stats</span></div>
    <div class="section-title">Compétences</div>${res}${passive}${active}${ultimate}
    <div class="muted dup-table">Copies (bonus cumulés) : ${DUP_BONUS_PCT.map((p, i) => `<span class="${duplicates(own) + 1 > i ? 'good' : ''}">${i + 1} ex. ${p ? `+${p} %` : '—'}</span>`).join(' · ')} — le ${ULT_UNLOCK_COPIES}e ouvre l'ultime niv. 6 à 10.</div>`;
}

// v9.1.3 : synergies sans phrase d'ambiance (gardée en infobulle), actives en or.
function synergyRow(syn, active) {
  return `<div class="syn${active.has(syn.id) ? ' on' : ''}" title="${escapeHtml(syn.text)}">
      <b>${escapeHtml(syn.name)}</b> <span class="syn-roles">${syn.roles.map((r) => `<i style="color:${ROLES[r].color}">${ROLES[r].label}</i>`).join(' + ')}</span>
      <span class="${active.has(syn.id) ? 'good' : 'muted'}">${effectText(syn.effects)}</span></div>`;
}

// Donjon où ce héros SSR est adapté (il y écrase tout).
function dungeonFor(c, state) {
  if (!state.cheats?.reveal) return '';
  const d = DUNGEONS.find((x) => x.ally === c.id);
  const a = BALANCE.dungeonAffinity;
  return d ? `<div class="dungeon-ally"><b class="gold-text">Adapté au donjon « ${d.name} »</b><div class="muted">Dans ce donjon : compétence ×${a.skillMultiplier}, passif ×${a.passiveMultiplier}, dégâts de l'équipe +${a.teamDamagePct} %, dégâts subis −${a.damageTakenPct} %.</div></div>` : '';
}

const portrait = companionPortrait;

export default {
  id: 'companions',
  title: 'Composition',
  icon: 'icon_paw',
  extra: (ui, state) => `Équipe ${1 + state.companions.equipped.length}/${1 + teamSlotsOf(state).ally + teamSlotsOf(state).pet}`,
  render(ui, state) {
    const sel = companionById(ui.view.companionSel) ?? COMPANIONS.find((c) => state.companions.owned[c.id]) ?? COMPANIONS[0];
    // Barre d'équipe : le chevalier, 2 places de personnage, 1 place de compagnon.
    const slot = (kind, i) => {
      const c = equippedOfKind(state, kind)[i];
      // v9.6.3 (3.5) : rang avant (encaisse, un Gardien y pare Charge et Kamikaze) ou arrière (protégé) ; un toucher change.
      const rank = kind === 'ally' && c ? (frontCompanion(state) === c.id ? '<span class="rank-pill front">Avant</span>' : `<span class="rank-pill" data-action="set-front" data-value="${c.id}" title="Mettre au rang avant">Arrière</span>`) : '';
      return c ? `<div class="team-slot-wrap"><button class="team-slot r-${c.rarity}" data-action="companion-sel" data-value="${c.id}" title="${escapeHtml(c.name)}">${c.id === sel.id ? portrait(c) : companionStill(c)}${gearWaiting(state, c.id) ? '<span class="gear-wait" title="Un meilleur objet attend">⬆</span>' : ''}</button>${rank}</div>`
        : `<div class="team-slot empty" title="${kind === 'ally' ? 'Place de compagnon' : 'Place de familier'}">${kind === 'ally' ? 'Compagnon' : 'Familier'}</div>`;
    };
    const teamGear = state.companions.equipped.some((id) => gearWaiting(state, id));
    const team = `${teamGear ? '<button class="btn btn-gold primary-action gear-team-btn" data-action="gear-team">⬆ Équiper toute l\'équipe</button>' : ''}<div class="team-bar">
      <div class="team-slot hero" title="Le héros (toujours présent)">${animCanvas('hero', 64, 58, 1)}</div>
      ${Array.from({ length: teamSlotsOf(state).ally }, (_, i) => slot('ally', i)).join('')}
      <span class="team-sep"></span>${Array.from({ length: BALANCE.teamSlots.pet }, (_, i) => slot('pet', i)).join('')}
    </div>`;
    // v9.3.4 : cartes hautes : portrait en grand, nom sur deux lignes, cadre et pastille de rareté, élément et rôle.
    const thumb = (c) => {
      const owned = state.companions.owned[c.id];
      const equipped = state.companions.equipped.includes(c.id);
      const role = COMPANION_ROLES[c.id];
      return `<button class="unit-card r-${c.rarity}${owned ? '' : ' unowned'}" data-action="companion-sel" data-value="${c.id}" aria-label="${escapeHtml(c.name)}">
        <span class="uc-art">${owned ? companionStill(c) : `<img class="px" src="${icon(c.sprite, c.kind === 'ally' ? 1 : 3, { tint: { color: '#3a4a66', alpha: 1 } })}" alt=""><b class="uc-q">?</b>`}</span>
        <span class="uc-name">${escapeHtml(c.name)}</span>
        <span class="uc-meta"><span class="rar-pill r-${c.rarity}">${rarityLabel(c.rarity)}</span>${elementBadge(unitElement(c.id), false, true)}${role ? `<span class="role-dot" style="background:${ROLES[role].color}" title="${ROLES[role].label}"></span>` : ''}</span>
        ${owned && gearWaiting(state, c.id) ? '<span class="gear-wait" title="Un meilleur objet attend">⬆</span>' : ''}${equipped ? '<span class="eq" title="Dans l\'équipe">✓</span>' : ''}${isAway(state, c.id) ? '<span class="away" title="En expédition">⚑</span>' : ''}</button>`;
    };
    const allies = COMPANIONS.filter((c) => teamKind(c) === 'ally');
    const pets = COMPANIONS.filter((c) => teamKind(c) === 'pet');
    const owned = state.companions.owned[sel.id];
    const equipped = state.companions.equipped.includes(sel.id);
    const m = companionMultiplier(state, sel.id, owned ?? { stars: 1, level: 1 }); // v9.1.3 : aperçu non possédé ×1,5
    const passive = Object.fromEntries(Object.entries(sel.passive).map(([k, v]) => [MULTIPLICATIVE[k] ?? k, v * m]));
    let actions;
    let upgradeLine = '';
    if (!owned) {
      actions = ui.tabVisible.summon !== false ? '<button class="btn btn-gold" data-action="open-tab" data-value="summon">Invoquer…</button>' : '<span class="muted">Pas encore obtenu.</span>';
    } else {
      const maxed = unitLevel(state, sel.id) >= COMPANION_RULES.maxLevel;
      const kind = teamKind(sel);
      const full = !equipped && kind === 'ally' && equippedOfKind(state, 'ally').length >= teamSlotsOf(state).ally;
      const swap = !equipped && kind === 'pet' && equippedOfKind(state, 'pet').length >= BALANCE.teamSlots.pet;
      // Équipe pleine : « Équiper » propose de choisir le compagnon à remplacer.
      const replacing = full && ui.view.replaceFor === sel.id;
      const away = isAway(state, sel.id);
      const run = away ? state.expeditions.slots.find((x) => x?.companionId === sel.id) : null;
      actions = away ? `<button class="btn" data-action="open-tab" data-value="expeditions">En expédition : ${expeditionType(run.type).label}${expeditionDone(run) ? ' (terminée)' : ''}</button>` : full
        ? `<button class="btn btn-primary" data-action="ask-replace" data-value="${sel.id}">Équiper…</button>`
        : `<button class="btn ${equipped ? '' : 'btn-primary'}" data-action="toggle-companion" data-value="${sel.id}">
          ${equipped ? 'Retirer' : swap ? 'Remplacer le familier' : 'Équiper'}</button>`;
      if (replacing) {
        actions += `<div class="replace-box"><b>Qui remplacer ?</b>${equippedOfKind(state, 'ally').map((c) => `<button class="btn small"
          data-action="replace-companion" data-value="${sel.id}|${c.id}">${portrait(c)}<span>${escapeHtml(c.name)}</span></button>`).join('')}
          <button class="btn small" data-action="ask-replace" data-value="">Annuler</button></div>`;
      }
      // v9.8 (I6) : au niveau max, plus de « Max » gris : l'étape suivante (compétences de la fiche).
      actions += maxed ? `<button class="btn btn-primary" data-action="${ui.view.sheetOpen === 'companion' ? 'skill-pop' : 'companion-sel'}" data-value="${ui.view.sheetOpen === 'companion' ? 'active' : sel.id}">Niveau max · Améliorer ses compétences</button>`
        : costButton({ action: 'upgrade-companion', cost: companionUpgradeCost(state, sel.id), have: state.gold, attrs: `data-value="${sel.id}"`, label: 'Améliorer ', max: maxed });
      // v9.1.3 : effet de l'amélioration écrit « avant ▶ après » (bonus passif au niveau suivant).
      if (!maxed) {
        const lv = unitLevel(state, sel.id); // v9.5.0 : niveau d'équipe
        const kind = teamKind(sel);
        const next = { ...state, companions: { ...state.companions, teamLevel: { ...(state.companions.teamLevel ?? {}), [kind]: lv + 1 }, owned: { ...state.companions.owned, [sel.id]: { ...owned, level: lv + 1 } } } };
        const mNext = companionMultiplier(next, sel.id);
        // Valeurs à 3 chiffres : un niveau change peu le bonus, l'arrondi de effectText le cacherait.
        const val = (k, x) => (MULTIPLICATIVE[k] ? `×${(1 + x / 100).toFixed(3)}` : `+${(Math.round(x * 100) / 100)}`).replace('.', ',');
        upgradeLine = `<div class="muted upgrade-preview"><span>Niv. ${lv} ▶ ${lv + 1}</span> : ${Object.entries(sel.passive).map(([k, v]) => `${val(k, v * m)} ▶ <b class="good">${val(k, v * mNext)}</b>`).join(' · ')}</div>`;
      }
    }
    // Synergies : actives (or) et possibles (grisées) selon les rôles de l'équipe. v9.1.0 : repliées, actives visibles.
    const activeList = activeSynergies(state);
    const active = new Set(activeList.map((s) => s.id));
    // v9.1.3 : repli raccourci, rangé par rôle (premier rôle requis), sans phrase d'ambiance.
    const synergies = () => `<div class="muted">Le héros compte comme Gardien.</div>${Object.entries(ROLES).map(([rid, r]) => {
      const list = SYNERGIES.filter((syn) => syn.roles[0] === rid);
      return list.length ? `<div class="syn-group"><div class="section-title" style="color:${r.color}">${r.label}</div><div class="syn-list">${list.map((syn) => synergyRow(syn, active)).join('')}</div></div>` : '';
    }).join('')}`;
    // Synergies où entre le rôle du compagnon affiché (dans sa fiche).
    const selRole = COMPANION_ROLES[sel.id];
    const roleSyn = selRole ? SYNERGIES.filter((syn) => syn.roles.includes(selRole)) : [];
    // v9.5.0 (3.3) : synergies qu'un seul remplacement activerait (compagnon possédé du banc à la place d'un placé).
    const near = [];
    const allyIds = state.companions.equipped.filter((id) => teamKind(companionById(id)) === 'ally');
    const bench = Object.keys(state.companions.owned).filter((id) => !state.companions.equipped.includes(id) && teamKind(companionById(id)) === 'ally');
    for (const syn of SYNERGIES.filter((x) => !active.has(x.id))) {
      let found = null;
      for (const out of [...allyIds, null]) {
        for (const inn of bench) {
          const team = [...allyIds.filter((id) => id !== out), inn];
          if (team.length > teamSlotsOf(state).ally) continue;
          const roles = ['guardian', ...team.map((id) => COMPANION_ROLES[id]).filter(Boolean)];
          const pool = [...roles];
          if (syn.roles.every((r) => { const i = pool.indexOf(r); if (i < 0) return false; pool.splice(i, 1); return true; })) { found = { out, inn }; break; }
        }
        if (found) break;
      }
      if (found) near.push({ syn, ...found });
    }
    const nearHtml = near.slice(0, 3).map(({ syn, out, inn }) => `<div class="syn-near">${out ? `Remplace <b>${escapeHtml(companionById(out)?.name ?? out)}</b> par` : 'Ajoute'} <b>${escapeHtml(companionById(inn)?.name ?? inn)}</b> : <span class="good">${escapeHtml(syn.name)}</span> (${effectText(syn.effects)})</div>`).join('');
    const synTitle = `Synergies${activeList.length ? ` : <span class="good">${activeList.map((x) => escapeHtml(x.name)).join(', ')}</span>` : ''}`;
    // v9.1.3 (doc2 A12) : l'illustration, à pleine opacité, remplace le portrait dans l'en-tête de la fiche ;
    // Équiper et Améliorer sont à côté, donc visibles sans défiler (fiche en feuille du bas sur téléphone).
    const art = hdArt(sel, owned ? 'pet-art' : 'pet-art locked');
    const dupMax = COMPANION_RULES.maxCopies - 1;
    // v9.3.4 : la fiche n'est plus dépliée sous la grille : popup (fenêtre centrée sur PC, plein écran sur téléphone).
    const twoButtons = actions; // Équiper / Retirer + Améliorer (niveau) ; l'aperçu « avant ▶ après » est dans la popup
    const detail = ui.view.sheetOpen === 'companion'
      ? unitPopup(ui, state, sel, { actions: twoButtons, gear: () => (owned ? gearBlock(ui, state, sel) : '') }) : '';
    const tab = ui.view.compTab === 'pet' ? 'pet' : 'ally';
    const list = tab === 'pet' ? pets : allies;
    // v9.3.5 (7d) : monter d'un coup les compagnons placés avec l'or disponible.
    const teamUp = state.companions.equipped.some((id) => companionUpgradeCost(state, id) <= state.gold)
      ? '<button class="btn btn-gold team-up" data-action="upgrade-team">Améliorer l\'équipe</button>' : '';
    // v9.5.0 (3.6) : « Équipe conseillée » — essayée avec le vrai combat, gain affiché.
    const adv = teamAdvice(state);
    const advise = adv && !adv.same && adv.gain >= 0.03
      ? `<div class="card team-advice"><b>Équipe conseillée</b> : ${adv.team.map((id) => escapeHtml(companionById(id)?.name ?? id)).join(', ')}
          <span class="good">+${Math.round(adv.gain * 100)} % de dégâts</span> <button class="btn btn-primary small" data-action="apply-team">Placer cette équipe</button></div>`
      : adv ? '<div class="muted team-advice">Ton équipe est la meilleure disponible ici.</div>' : '';
    const res = elementResonance(state); // v9.6.1 (4.5)
    const resLine = res ? `<div class="good">Résonance : ${res.count} × ${elementBadge(res.element)} → +${res.pct} % de dégâts</div>` : `<div class="muted">Résonance : 2 membres du même élément → +${RESONANCE[2]} % de dégâts, 3 → +${RESONANCE[3]} %.</div>`;
    const wheel = !wheelShown(state) ? '' : `<div class="team-wheel">Monde : ${elementBadge(zoneElement(currentEncounter(state).zoneIndex))} ${elementWheel(zoneElement(currentEncounter(state).zoneIndex))}${resLine}</div>`; // v9.5.1
    // v9.7.1 : résonance, équipe conseillée et synergies dans un volet replié « Conseils » ; restent en vue les places
    // d'équipe et la grille. Le bouton « Placer cette équipe » garde un rappel discret sur le titre.
    // v9.7.1 (lot 6) : liens entre compagnons (actifs et à découvrir).
    const bondsHtml = BONDS.map((b) => { const on = b.pair.every((id) => state.companions.equipped.includes(id)); const names = b.pair.map((id) => companionById(id)?.name ?? id).join(' + ');
      const bonus = Object.entries(b.bonus).map(([k, v]) => `+${v} % ${{ companionPowerPct: 'puissance des compagnons', damagePct: 'dégâts', maxHpPct: 'PV', critChance: 'critique' }[k] ?? k}`).join(', ');
      return `<div class="${on ? 'good' : 'muted'}">${on ? '✓' : '·'} <b>${escapeHtml(b.name)}</b> : ${escapeHtml(names)} — ${bonus}</div>`; }).join('');
    const tips = () => `${wheel}${advise}<div class="card"><b>Liens</b>${bondsHtml}</div>
      ${nearHtml ? `<div class="card syn-near-card"><b>Synergies à portée</b>${nearHtml}</div>` : ''}
      ${fold(ui, 'synergies', synTitle, synergies)}`;
    const tipsExtra = adv && !adv.same && adv.gain >= 0.03 ? `<span class="good">+${Math.round(adv.gain * 100)} % possible</span>` : '';
    return `${team}${teamChips(state)}${teamUp}
      ${fold(ui, 'team-tips', 'Conseils', tips, { extra: tipsExtra })}
      <div class="item-tabs comp-tabs" role="tablist">
        <button class="btn chip-btn${tab === 'ally' ? ' active' : ''}" data-action="comp-tab" data-value="ally" role="tab" aria-selected="${tab === 'ally'}">Compagnons <small>(${teamSlotsOf(state).ally} places)</small></button>
        <button class="btn chip-btn${tab === 'pet' ? ' active' : ''}" data-action="comp-tab" data-value="pet" role="tab" aria-selected="${tab === 'pet'}">Familiers <small>(1 place)</small></button></div>
      <div class="unit-grid">${list.map(thumb).join('')}</div>
      ${detail}`;
  },
};
