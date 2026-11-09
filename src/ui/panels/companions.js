// Équipe > Composition : le héros + 2 compagnons + 1 familier ; collection, niveaux, capacités.
// v9.1.0 : expéditions dans leur propre onglet, builds dans Équipement, synergies repliées (actives visibles).
import { BALANCE } from '../../data/balance.js';
import { COMPANION_RULES } from '../../data/companions.js';
import { UNITS as COMPANIONS } from '../../data/banners.js'; // v9.1.3 (partie B) : persos de bannière compris quand actifs
import { MULTIPLICATIVE, RARITY_SKILL, activeSynergies, allCompanionSkills, companionById, companionMultiplier, companionSkillMultiplier, companionSkills, companionUpgradeCost, skillKillGold, duplicates, equippedOfKind, teamKind, ultimateUnlocked } from '../../core/companions.js';
import { COMPANION_ROLES, ROLES, SYNERGIES } from '../../data/synergies.js';
import { elementBadge, unitElement } from '../../core/elements.js'; // v9.3.1 : types
import { costButton, effectText, escapeHtml, fold, hdArt, formatNumber, icon, img, rarityLabel, stars } from '../common.js';
import { animCanvas } from '../animator.js';
import { showcaseSlot } from '../showcase.js'; // v9.2.7 : vitrine animée
import { DUNGEONS } from '../../data/dungeons.js';
import { SKILL_RULES, skillTextAt } from '../../data/companion-skills.js';
import { computeHeroStats } from '../../core/stats.js';
import { expeditionDone, expeditionType, isAway } from '../../core/expeditions.js';
import { companionPortrait, companionStill } from './expeditions.js';
import { canAfford, dupBonusPct, leveledSkill, levelMult, RESOURCE_KEYS, skillCap, skillLevels, skillUpgradeCost } from '../../core/progression.js'; // v9.3.3
import { ACTIVE_EXTRA_AT, DUP_BONUS_PCT, SKILL_CAPS, SKILL_GROWTH, SKILL_RESOURCES, ULT_UNLOCK_COPIES } from '../../data/progression.js';
import { canEquip, gearBase, gearState, gearStats, gearUpgradeCost, statText, unitGear, unitGearStats, wearerOf } from '../../core/companion-gear.js'; // v9.3.3
import { GEAR_CLASSES, GEAR_SLOTS, SLOT_NAMES, STAT_NAMES, gearClassOf } from '../../data/companion-gear.js';

// Compétences (v8.9) : 4 par compagnon, la 4e à 3 doublons. v9.1.3 (doc4 lot 1) : chaque doublon +5 % (formule unique
// de core/companions.js : companionSkillMultiplier) ; aperçu d'une unité non possédée à 0 doublon.
// Attaque = dégâts par seconde de ses compétences offensives.
// v9.1.3 (doc1 « Compagnons ») : la ligne « Défense » répétait le bonus passif (retirée) ; la formule de puissance
// est derrière « ? » ; les 2 compétences de rôle sont repliées (compétence propre et ultime visibles).
// v9.3.3 : équipement du héros (allié) ou du familier : 3 emplacements nommés selon sa classe, total des bonus,
// sac filtré (emplacement, rareté, compatibles), comparaison avant/après, amélioration (éclats + or), recyclage.
const RAR_ORDER = ['legendary', 'epic', 'rare', 'common'];
function gearBlock(ui, state, c) {
  const cls = gearClassOf(c);
  const worn = unitGear(state, c.id);
  const total = unitGearStats(state, c.id);
  const killGold = skillKillGold(state);
  const f = ui.view.gearFilter ?? { slot: 'all', rarity: 'all', compat: true };
  const slots = GEAR_SLOTS.map((slot) => {
    const it = worn[slot];
    return `<div class="gear-slot${it ? ` r-${it.rarity}` : ' empty'}"><small>${escapeHtml(SLOT_NAMES[cls][slot])}</small>
      ${it ? `<b>${escapeHtml(gearBase(it).name)}${it.up ? ` +${it.up}` : ''}</b><span class="muted">${escapeHtml(statText(gearStats(it)))}</span>
        <button class="btn tiny" data-action="gear-unequip" data-value="${c.id}|${slot}">Retirer</button>` : '<span class="muted">Vide</span>'}</div>`;
  }).join('');
  const bag = gearState(state).bag
    .filter((i) => (f.slot === 'all' || gearBase(i).slot === f.slot) && (f.rarity === 'all' || i.rarity === f.rarity))
    .map((i) => ({ i, chk: canEquip(state, c.id, i) }))
    .filter(({ chk }) => !f.compat || chk.ok)
    .sort((a, b) => Number(b.chk.ok) - Number(a.chk.ok) || RAR_ORDER.indexOf(a.i.rarity) - RAR_ORDER.indexOf(b.i.rarity) || (b.i.up ?? 0) - (a.i.up ?? 0));
  const row = ({ i, chk }) => {
    const base = gearBase(i);
    const who = wearerOf(state, i.id);
    const cur = worn[base.slot];
    const diff = chk.ok ? Object.keys(STAT_NAMES).map((k) => [k, (gearStats(i)[k] ?? 0) - (cur && cur.id !== i.id ? gearStats(cur)[k] ?? 0 : 0)]).filter(([, d]) => d)
      .map(([k, d]) => `<span class="${d > 0 ? 'good' : 'bad'}">${(k === 'cd') === (d > 0) ? '−' : '+'}${Math.abs(Math.round(d * 10) / 10)} % ${STAT_NAMES[k]}</span>`).join(' ') : ''; // recharge : une hausse = recharge plus courte (−)
    const cost = gearUpgradeCost(i, killGold);
    return `<div class="gear-row r-${i.rarity}${chk.ok ? '' : ' incompatible'}"><div class="grow"><b class="rarity-text r-${i.rarity}">${escapeHtml(base.name)}${i.up ? ` +${i.up}` : ''}</b>
        <small class="muted">${rarityLabel(i.rarity)} · ${escapeHtml(statText(gearStats(i)))}${who ? ` · porté par ${escapeHtml(companionById(who)?.name ?? '')}` : ''}</small>
        ${chk.ok ? (diff && who !== c.id ? `<div class="gear-diff">Si équipé : ${diff}</div>` : '') : `<div class="bad gear-why">🔒 ${escapeHtml(chk.reason)}</div>`}</div>
      <div class="gear-btns">${chk.ok && who !== c.id ? `<button class="btn tiny btn-primary" data-action="gear-equip" data-value="${c.id}|${i.id}">Équiper</button>` : ''}
        ${cost ? `<button class="btn tiny" data-action="gear-up" data-value="${i.id}" ${state.gold >= cost.gold && state.materials.shards >= cost.shards ? '' : 'disabled'} title="Améliorer">+${(i.up ?? 0) + 1} · ${img('icon_shard')}${cost.shards} ${img('coin')}${formatNumber(cost.gold)}</button>` : ''}
        ${!who ? `<button class="btn tiny" data-action="gear-recycle" data-value="${i.id}" title="Recycler en éclats">♻</button>` : ''}</div></div>`;
  };
  const sel = (key, opts) => `<select data-action="gear-filter" data-key="${key}" aria-label="Filtre">${opts.map(([v, l]) => `<option value="${v}" ${String(f[key]) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<div class="section-title">Équipement <span class="muted">(${GEAR_CLASSES[cls].label})</span></div>
    <div class="gear-slots">${slots}</div>
    <div class="muted">Total : ${escapeHtml(statText(total)) || 'aucun bonus'}. Attaque, soins et recharge comptent partout ; PV et défense dans l'Arène.</div>
    <div class="gear-filters">${sel('slot', [['all', 'Tous emplacements'], ...GEAR_SLOTS.map((s) => [s, SLOT_NAMES[cls][s]])])}
      ${sel('rarity', [['all', 'Toutes raretés'], ['legendary', 'Légendaire'], ['epic', 'Épique'], ['rare', 'Rare'], ['common', 'Commun']])}
      ${sel('compat', [['true', 'Compatibles'], ['false', 'Toutes les pièces']])}</div>
    <div class="gear-list">${bag.map(row).join('') || '<div class="state-empty">Aucune pièce. Les Étages de l\'Arène et les donjons en donnent.</div>'}</div>`;
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
  const res = mine ? `<div class="skill-res">${RESOURCE_KEYS.map((k) => `<span title="${escapeHtml(SKILL_RESOURCES[k].use)}">${img(SKILL_RESOURCES[k].icon)} ${SKILL_RESOURCES[k].short} <b>${formatNumber(state.materials[k] ?? 0)}</b></span>`).join('')}</div>` : '';
  return `<div class="cstats"><span>⚔ Attaque <b>${formatNumber(dps)}</b>/s</span> <span>Doublons : <b>+${dupBonusPct(own)} %</b> aux stats</span></div>
    <div class="section-title">Compétences</div>${res}${passive}${active}${ultimate}
    <div class="muted dup-table">Doublons (bonus cumulés) : ${DUP_BONUS_PCT.map((p, i) => `<span class="${duplicates(own) + 1 > i ? 'good' : ''}">${i + 1} ex. ${p ? `+${p} %` : '—'}</span>`).join(' · ')} — le ${ULT_UNLOCK_COPIES}e ouvre l'ultime niv. 6 à 10.</div>`;
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
  extra: (ui, state) => `Équipe ${1 + state.companions.equipped.length}/${1 + BALANCE.teamSlots.ally + BALANCE.teamSlots.pet}`,
  render(ui, state) {
    const sel = companionById(ui.view.companionSel) ?? COMPANIONS.find((c) => state.companions.owned[c.id]) ?? COMPANIONS[0];
    // Barre d'équipe : le chevalier, 2 places de personnage, 1 place de compagnon.
    const slot = (kind, i) => {
      const c = equippedOfKind(state, kind)[i];
      return c ? `<button class="team-slot r-${c.rarity}" data-action="companion-sel" data-value="${c.id}" title="${escapeHtml(c.name)}">${c.id === sel.id ? portrait(c) : companionStill(c)}</button>`
        : `<div class="team-slot empty" title="${kind === 'ally' ? 'Place de compagnon' : 'Place de familier'}">${kind === 'ally' ? 'Compagnon' : 'Familier'}</div>`;
    };
    const team = `<div class="team-bar">
      <div class="team-slot hero" title="Le héros (toujours présent)">${animCanvas('hero', 64, 58, 1)}</div>
      ${Array.from({ length: BALANCE.teamSlots.ally }, (_, i) => slot('ally', i)).join('')}
      <span class="team-sep"></span>${Array.from({ length: BALANCE.teamSlots.pet }, (_, i) => slot('pet', i)).join('')}
    </div>`;
    const thumb = (c) => {
      const owned = state.companions.owned[c.id];
      const equipped = state.companions.equipped.includes(c.id);
      return `<button class="pet-thumb r-${c.rarity}${c.id === sel.id ? ' selected' : ''}${owned ? '' : ' unowned'}${duplicates(owned) >= COMPANION_RULES.maxCopies - 1 ? ' dup-max' : ''}"
        data-action="companion-sel" data-value="${c.id}" title="${c.name}">
        ${owned ? (c.id === sel.id ? portrait(c) : companionStill(c)) : `<img class="px" src="${icon(c.sprite, c.kind === 'ally' ? 1 : 3, { tint: { color: '#3a4a66', alpha: 1 } })}" alt="">`}
        <span class="rar-letter" aria-hidden="true">${rarityLabel(c.rarity).slice(0, 1)}</span>
        ${COMPANION_ROLES[c.id] ? `<span class="role-dot" style="background:${ROLES[COMPANION_ROLES[c.id]].color}" title="${ROLES[COMPANION_ROLES[c.id]].label}"></span>` : ''}
        <span class="pet-label"><b>${escapeHtml(c.name)} ${elementBadge(unitElement(c.id), false, true)}</b><small>${owned ? `niv. ${owned.level} · ${duplicates(owned)}★` : 'non obtenu'}</small></span>
        ${equipped ? '<span class="eq" title="Dans l\'équipe">✓</span>' : ''}${isAway(state, c.id) ? '<span class="away" title="En expédition">⚑</span>' : ''}</button>`;
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
      const maxed = owned.level >= COMPANION_RULES.maxLevel;
      const kind = teamKind(sel);
      const full = !equipped && kind === 'ally' && equippedOfKind(state, 'ally').length >= BALANCE.teamSlots.ally;
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
      actions += costButton({ action: 'upgrade-companion', cost: companionUpgradeCost(state, sel.id), have: state.gold, attrs: `data-value="${sel.id}"`, label: 'Améliorer ', max: maxed });
      // v9.1.3 : effet de l'amélioration écrit « avant ▶ après » (bonus passif au niveau suivant).
      if (!maxed) {
        const next = { ...state, companions: { ...state.companions, owned: { ...state.companions.owned, [sel.id]: { ...owned, level: owned.level + 1 } } } };
        const mNext = companionMultiplier(next, sel.id);
        // Valeurs à 3 chiffres : un niveau change peu le bonus, l'arrondi de effectText le cacherait.
        const val = (k, x) => (MULTIPLICATIVE[k] ? `×${(1 + x / 100).toFixed(3)}` : `+${(Math.round(x * 100) / 100)}`).replace('.', ',');
        upgradeLine = `<div class="muted upgrade-preview"><span>Niv. ${owned.level} ▶ ${owned.level + 1}</span> : ${Object.entries(sel.passive).map(([k, v]) => `${val(k, v * m)} ▶ <b class="good">${val(k, v * mNext)}</b>`).join(' · ')}</div>`;
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
    const synTitle = `Synergies${activeList.length ? ` : <span class="good">${activeList.map((x) => escapeHtml(x.name)).join(', ')}</span>` : ''}`;
    // v9.1.3 (doc2 A12) : l'illustration, à pleine opacité, remplace le portrait dans l'en-tête de la fiche ;
    // Équiper et Améliorer sont à côté, donc visibles sans défiler (fiche en feuille du bas sur téléphone).
    const art = hdArt(sel, owned ? 'pet-art' : 'pet-art locked');
    const dupMax = COMPANION_RULES.maxCopies - 1;
    const detail = `<div class="card pet-detail r-${sel.rarity}${duplicates(owned) >= dupMax ? ' dup-max' : ''} sheet${ui.view.sheetOpen === 'companion' ? ' sheet-open' : ''}">
        <button class="btn small sheet-close" data-action="close-sheet" aria-label="Fermer la fiche">✕</button>
        <div class="detail-head pet-head">
          ${art ? `<div class="pet-art-box">${art}</div>` : `<div class="pet-portrait">${owned ? portrait(sel, true) : `<img class="px" src="${icon(sel.sprite, sel.kind === 'ally' ? 1 : 4, { tint: { color: '#3a4a66', alpha: 1 } })}" alt="">`}</div>`}
          <div class="grow"><div class="item-name">${escapeHtml(sel.name)}</div>
            <div class="item-sub"><span class="rarity-text">${rarityLabel(sel.rarity)}</span> ${elementBadge(unitElement(sel.id), true)}${owned ? ` · niv. ${owned.level}/${COMPANION_RULES.maxLevel} ${stars(duplicates(owned))}` : ' · non obtenu'}</div>
            ${owned ? `<div class="dup-count">Doublons ${duplicates(owned)}/${dupMax}</div>` : ''}
            ${selRole ? `<div>Rôle : <b style="color:${ROLES[selRole].color}">${ROLES[selRole].label}</b></div>` : ''}
            <div class="detail-actions">${actions}</div>${upgradeLine}</div>
        </div>
        <div class="section-title">Vitrine</div>${showcaseSlot('unit', sel.id)}
        <div class="section-title">Bonus passif</div>
        <div class="good">${effectText(passive)}</div>
        ${dungeonFor(sel, state)}
        ${skillsBlock(ui, state, sel, owned)}
        ${owned ? gearBlock(ui, state, sel) : ''}
        ${roleSyn.length ? fold(ui, 'comp-role-syn', `Synergies du ${ROLES[selRole].label} (${roleSyn.length})`, () => `<div class="syn-list">${roleSyn.map((syn) => synergyRow(syn, active)).join('')}</div>`) : ''}
      </div>`;
    return `${team}
      ${fold(ui, 'synergies', synTitle, synergies)}
      <div class="comp-layout"><div class="comp-lists">
        <div class="section-title">Compagnons <span class="muted">(2 places)</span></div>
        <div class="pet-grid pet-cards">${allies.map(thumb).join('')}</div>
        <div class="section-title">Familiers <span class="muted">(1 place)</span></div>
        <div class="pet-grid pet-cards">${pets.map(thumb).join('')}</div>
        <div class="muted">Enregistrer une équipe avec son équipement : Héros › Équipement › Builds.</div>
      </div>${detail}</div>`;
  },
};
