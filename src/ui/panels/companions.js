// Équipe > Composition : le héros + 2 compagnons + 1 familier ; collection, niveaux, capacités.
// v9.1.0 : expéditions dans leur propre onglet, builds dans Équipement, synergies repliées (actives visibles).
import { BALANCE } from '../../data/balance.js';
import { COMPANION_RULES, COMPANIONS } from '../../data/companions.js';
import { MULTIPLICATIVE, RARITY_SKILL, activeSynergies, allCompanionSkills, companionById, companionMultiplier, companionSkillMultiplier, companionUpgradeCost, duplicates, equippedOfKind, teamKind, ultimateUnlocked } from '../../core/companions.js';
import { COMPANION_ROLES, ROLES, SYNERGIES } from '../../data/synergies.js';
import { costButton, effectText, escapeHtml, fold, hdArt, formatNumber, icon, img, rarityLabel, stars } from '../common.js';
import { animCanvas } from '../animator.js';
import { DUNGEONS } from '../../data/dungeons.js';
import { SKILL_RULES, skillTextAt } from '../../data/companion-skills.js';
import { computeHeroStats } from '../../core/stats.js';
import { expeditionDone, expeditionType, isAway } from '../../core/expeditions.js';
import { companionPortrait, companionStill } from './expeditions.js';

// Compétences (v8.9) : 4 par compagnon, la 4e à 3 doublons. v9.1.3 (doc4 lot 1) : chaque doublon +5 % (formule unique
// de core/companions.js : companionSkillMultiplier) ; aperçu d'une unité non possédée à 0 doublon.
// Attaque = dégâts par seconde de ses compétences offensives.
// v9.1.3 (doc1 « Compagnons ») : la ligne « Défense » répétait le bonus passif (retirée) ; la formule de puissance
// est derrière « ? » ; les 2 compétences de rôle sont repliées (compétence propre et ultime visibles).
function skillsBlock(ui, state, c, owned) {
  const own = owned ?? { stars: 1, level: 1 };
  const dup = duplicates(own);
  const maxDup = COMPANION_RULES.maxCopies - 1;
  const hero = computeHeroStats(state);
  const list = allCompanionSkills(c.id);
  const unlocked = (sk) => !sk.ultimate || ultimateUnlocked(own);
  const mult = (sk) => companionSkillMultiplier(state, c, sk.type, false, BALANCE, own);
  const dps = list.filter((sk) => unlocked(sk) && (sk.type === 'hit' || sk.type === 'burst')).reduce((sum, sk) => sum + (hero.damage * sk.value * mult(sk)) / sk.every, 0);
  const ultDup = SKILL_RULES.ultimateCopies - 1;
  const row = (sk) => `<div class="cskill${unlocked(sk) ? '' : ' locked'}${sk.ultimate ? ' ult' : ''}">
      ${img(sk.ultimate ? 'icon_star' : 'skill_quick')} <b>${escapeHtml(sk.name)}</b> <span class="muted">toutes les ${sk.every} s</span>
      ${sk.ultimate ? `<span class="tag-ult">${unlocked(sk) ? 'Ultime' : `Ultime à ${ultDup} doublons`}</span>` : ''}
      <div class="muted">${escapeHtml(skillTextAt(sk, mult(sk)))}</div></div>`; // v9.1.3 : valeur réelle, arrondie
  const roleSkills = list.filter((sk) => !sk.own && !sk.ultimate && sk.index > 0);
  const main = list.filter((sk) => !roleSkills.includes(sk));
  const formulaOpen = ui.view.open?.has('comp-formula');
  const role = COMPANION_ROLES[c.id] ? ROLES[COMPANION_ROLES[c.id]].label : 'familier';
  const fmt = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
  return `<div class="cstats"><span>⚔ Attaque <b>${formatNumber(dps)}</b>/s</span></div>
    <div class="section-title">Compétences <button class="btn tiny help-q" data-action="toggle-section" data-value="comp-formula" data-expanded="${Boolean(formulaOpen)}"
      aria-expanded="${Boolean(formulaOpen)}" aria-label="Formule de puissance" title="Formule de puissance">?</button></div>
    ${formulaOpen ? `<div class="muted">Rareté ×${fmt(RARITY_SKILL[c.rarity] ?? 1)} · ${dup} doublon${dup > 1 ? 's' : ''} sur ${maxDup} — chaque doublon +${Math.round(SKILL_RULES.powerPerDuplicate * 100)} % aux compétences.</div>` : ''}
    ${main.filter((sk) => !sk.ultimate).map(row).join('')}
    ${roleSkills.length ? fold(ui, 'comp-role-skills', `Compétences de ${escapeHtml(role)} (${roleSkills.length})`, () => roleSkills.map(row).join('')) : ''}
    ${main.filter((sk) => sk.ultimate).map(row).join('')}
    ${dup >= maxDup ? '<div class="good">✦ Étoiles au maximum : ce compagnon brille d\'une aura sur la scène.</div>' : ''}`;
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
        <span class="pet-label"><b>${escapeHtml(c.name)}</b><small>${owned ? `niv. ${owned.level} · ${duplicates(owned)}★` : 'non obtenu'}</small></span>
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
            <div class="item-sub"><span class="rarity-text">${rarityLabel(sel.rarity)}</span>${owned ? ` · niv. ${owned.level}/${COMPANION_RULES.maxLevel} ${stars(duplicates(owned))}` : ' · non obtenu'}</div>
            ${owned ? `<div class="dup-count">Doublons ${duplicates(owned)}/${dupMax}</div>` : ''}
            ${selRole ? `<div>Rôle : <b style="color:${ROLES[selRole].color}">${ROLES[selRole].label}</b></div>` : ''}
            <div class="detail-actions">${actions}</div>${upgradeLine}</div>
        </div>
        <div class="section-title">Bonus passif</div>
        <div class="good">${effectText(passive)}</div>
        ${dungeonFor(sel, state)}
        ${skillsBlock(ui, state, sel, owned)}
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
