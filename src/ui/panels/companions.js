// Équipe > Composition : le héros + 2 compagnons + 1 familier ; collection, niveaux, capacités.
// v9.1.0 : expéditions dans leur propre onglet, builds dans Équipement, synergies repliées (actives visibles).
import { BALANCE } from '../../data/balance.js';
import { COMPANION_RULES, COMPANIONS } from '../../data/companions.js';
import { MULTIPLICATIVE, RARITY_SKILL, activeSynergies, allCompanionSkills, companionById, companionMultiplier, companionUpgradeCost, equippedOfKind, teamKind } from '../../core/companions.js';
import { COMPANION_ROLES, ROLES, SYNERGIES } from '../../data/synergies.js';
import { costButton, effectText, escapeHtml, fold, hdArt, formatNumber, icon, img, rarityLabel, stars } from '../common.js';
import { animCanvas } from '../animator.js';
import { DUNGEONS } from '../../data/dungeons.js';
import { SKILL_RULES } from '../../data/companion-skills.js';
import { computeHeroStats } from '../../core/stats.js';
import { expeditionDone, expeditionType, isAway } from '../../core/expeditions.js';
import { companionPortrait } from './expeditions.js';

// Compétences (v8.9) : 4 par compagnon, la 4e avec 3 doublons ; chaque étoile les renforce de +15 %.
// Attaque = dégâts par seconde de ses compétences offensives ; Défense = armure, PV et boucliers qu'il apporte.
function skillsBlock(state, c, owned) {
  const stars = owned?.stars ?? 1;
  const power = (RARITY_SKILL[c.rarity] ?? 1) * (1 + SKILL_RULES.powerPerStar * (stars - 1));
  const hero = computeHeroStats(state);
  const list = allCompanionSkills(c.id);
  const unlocked = (sk) => !sk.ultimate || stars >= SKILL_RULES.ultimateStars;
  const dps = list.filter((sk) => unlocked(sk) && (sk.type === 'hit' || sk.type === 'burst')).reduce((sum, sk) => sum + (hero.damage * sk.value * power) / sk.every, 0);
  const m = owned ? companionMultiplier(state, c.id) : 1;
  const def = ['armor', 'maxHpPct', 'regenPct', 'lifesteal'].filter((k) => c.passive[k]).map((k) => effectText({ [MULTIPLICATIVE[k] ?? k]: c.passive[k] * m })).join(' · ');
  const shields = list.filter((sk) => unlocked(sk) && sk.type === 'shield').map((sk) => `bouclier −${sk.value} %`).join(' · ');
  const rows = list.map((sk) => `<div class="cskill${unlocked(sk) ? '' : ' locked'}${sk.ultimate ? ' ult' : ''}">
      ${img(sk.ultimate ? 'icon_star' : 'skill_quick')} <b>${escapeHtml(sk.name)}</b> <span class="muted">toutes les ${sk.every} s</span>
      ${sk.ultimate ? `<span class="tag-ult">${unlocked(sk) ? 'Ultime' : `Ultime · ${SKILL_RULES.ultimateStars} étoiles (3 doublons)`}</span>` : ''}
      <div class="muted">${escapeHtml(sk.text)}</div></div>`).join('');
  return `<div class="cstats"><span>⚔ Attaque <b>${formatNumber(dps)}</b>/s</span><span>${img('icon_shield', 'ico20')} Défense <b>${def || shields ? [def, shields].filter(Boolean).join(' · ') : '—'}</b></span></div>
    <div class="section-title">Compétences <span class="muted">(puissance ×${String(Math.round(power * 100) / 100).replace('.', ',')} : rareté × ${stars} étoile${stars > 1 ? 's' : ''} — chaque doublon +${Math.round(SKILL_RULES.powerPerStar * 100)} %)</span></div>
    ${rows}
    ${stars >= BALANCE.summon.maxStars ? '<div class="good">✦ Étoiles au maximum : ce compagnon brille d\'une aura sur la scène.</div>' : ''}`;
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
      return c ? `<button class="team-slot r-${c.rarity}" data-action="companion-sel" data-value="${c.id}" title="${escapeHtml(c.name)}">${portrait(c)}</button>`
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
      return `<button class="pet-thumb r-${c.rarity}${c.id === sel.id ? ' selected' : ''}${owned ? '' : ' unowned'}"
        data-action="companion-sel" data-value="${c.id}" title="${c.name}">
        ${owned ? portrait(c) : `<img class="px" src="${icon(c.sprite, c.kind === 'ally' ? 1 : 3, { tint: { color: '#3a4a66', alpha: 1 } })}" alt="">`}
        <span class="rar-letter" aria-hidden="true">${rarityLabel(c.rarity).slice(0, 1)}</span>
        ${COMPANION_ROLES[c.id] ? `<span class="role-dot" style="background:${ROLES[COMPANION_ROLES[c.id]].color}" title="${ROLES[COMPANION_ROLES[c.id]].label}"></span>` : ''}
        ${equipped ? '<span class="eq" title="Dans l\'équipe">✓</span>' : ''}${isAway(state, c.id) ? '<span class="away" title="En expédition">⚑</span>' : ''}</button>`;
    };
    const allies = COMPANIONS.filter((c) => teamKind(c) === 'ally');
    const pets = COMPANIONS.filter((c) => teamKind(c) === 'pet');
    const owned = state.companions.owned[sel.id];
    const equipped = state.companions.equipped.includes(sel.id);
    const m = owned ? companionMultiplier(state, sel.id) : 1;
    const passive = Object.fromEntries(Object.entries(sel.passive).map(([k, v]) => [MULTIPLICATIVE[k] ?? k, v * m]));
    let actions;
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
    }
    // Synergies : actives (or) et possibles (grisées) selon les rôles de l'équipe. v9.1.0 : repliées, actives visibles.
    const activeList = activeSynergies(state);
    const active = new Set(activeList.map((s) => s.id));
    const synergies = () => `<div class="muted">Le héros compte comme Gardien.</div><div class="syn-list">${SYNERGIES.map((syn) => `<div class="syn${active.has(syn.id) ? ' on' : ''}">
      <b>${escapeHtml(syn.name)}</b> <span class="syn-roles">${syn.roles.map((r) => `<i style="color:${ROLES[r].color}">${ROLES[r].label}</i>`).join(' + ')}</span>
      <span class="${active.has(syn.id) ? 'good' : 'muted'}">${effectText(syn.effects)}</span> <span class="muted">${escapeHtml(syn.text)}</span></div>`).join('')}</div>`;
    const synTitle = `Synergies${activeList.length ? ` : <span class="good">${activeList.map((x) => escapeHtml(x.name)).join(', ')}</span>` : ''}`;
    const detail = `<div class="card pet-detail r-${sel.rarity} sheet${ui.view.sheetOpen === 'companion' ? ' sheet-open' : ''}">
        <button class="btn small sheet-close" data-action="close-sheet" aria-label="Fermer la fiche">✕</button>
        ${hdArt(sel, owned ? 'pet-hd' : 'pet-hd locked')}
        <div class="detail-head">
          <div class="pet-portrait">${owned ? portrait(sel, true) : `<img class="px" src="${icon(sel.sprite, sel.kind === 'ally' ? 1 : 4, { tint: { color: '#3a4a66', alpha: 1 } })}" alt="">`}</div>
          <div><div class="item-name">${escapeHtml(sel.name)}</div>
            <div class="item-sub"><span class="rarity-text">${rarityLabel(sel.rarity)}</span>${owned ? ` · niv. ${owned.level}/${COMPANION_RULES.maxLevel} ${stars(owned.stars)}` : ' · non obtenu'}</div></div>
        </div>
        <div class="detail-actions">${actions}</div>
        ${COMPANION_ROLES[sel.id] ? `<div>Rôle : <b style="color:${ROLES[COMPANION_ROLES[sel.id]].color}">${ROLES[COMPANION_ROLES[sel.id]].label}</b></div>` : ''}
        <div class="section-title">Bonus passif</div>
        <div class="good">${effectText(passive)}</div>
        ${dungeonFor(sel, state)}
        ${skillsBlock(state, sel, owned)}
      </div>`;
    return `${team}
      ${fold(ui, 'synergies', synTitle, synergies)}
      <div class="comp-layout"><div class="comp-lists">
        <div class="section-title">Compagnons <span class="muted">(2 places)</span></div>
        <div class="pet-grid">${allies.map(thumb).join('')}</div>
        <div class="section-title">Familiers <span class="muted">(1 place)</span></div>
        <div class="pet-grid">${pets.map(thumb).join('')}</div>
        <div class="muted">Enregistrer une équipe avec son équipement : Héros › Équipement › Builds.</div>
      </div>${detail}</div>`;
  },
};
