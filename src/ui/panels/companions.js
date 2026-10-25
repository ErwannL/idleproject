// Équipe : le chevalier + 2 personnages (héros alliés) + 1 compagnon ; collection, niveaux, compétences.
import { BALANCE } from '../../data/balance.js';
import { ALLY_GRADE, COMPANION_RULES, COMPANIONS } from '../../data/companions.js';
import { companionById, companionMultiplier, companionUpgradeCost, equippedOfKind, teamKind } from '../../core/companions.js';
import { costButton, effectText, escapeHtml, icon, img, rarityLabel, stars } from '../common.js';
import { animCanvas } from '../animator.js';
import { DUNGEONS } from '../../data/dungeons.js';

// Donjon où ce héros SSR est adapté (il y écrase tout).
function dungeonFor(c) {
  const d = DUNGEONS.find((x) => x.ally === c.id);
  const a = BALANCE.dungeonAffinity;
  return d ? `<div class="dungeon-ally"><b class="gold-text">Adapté au donjon « ${d.name} »</b><div class="muted">Dans ce donjon : compétence ×${a.skillMultiplier}, passif ×${a.passiveMultiplier}, dégâts de l'équipe +${a.teamDamagePct} %, dégâts subis −${a.damageTakenPct} %.</div></div>` : '';
}

// Portrait animé : héros allié (taille humaine) ou petit compagnon.
function portrait(c, big = false) {
  if (c.kind === 'ally') return animCanvas(`foe:${c.sprite}`, 48, 48, big ? 2 : 1);
  return animCanvas(`pet:${c.sprite}`, big ? 26 : 24, big ? 26 : 24, 2);
}

export default {
  id: 'companions',
  title: 'Équipe',
  icon: 'icon_paw',
  extra: (ui, state) => `Équipe ${1 + state.companions.equipped.length}/${1 + BALANCE.teamSlots.ally + BALANCE.teamSlots.pet}`,
  render(ui, state) {
    const sel = companionById(ui.view.companionSel) ?? COMPANIONS.find((c) => state.companions.owned[c.id]) ?? COMPANIONS[0];
    // Barre d'équipe : le chevalier, 2 places de personnage, 1 place de compagnon.
    const slot = (kind, i) => {
      const c = equippedOfKind(state, kind)[i];
      return c ? `<button class="team-slot r-${c.rarity}" data-action="companion-sel" data-value="${c.id}" title="${escapeHtml(c.name)}">${portrait(c)}</button>`
        : `<div class="team-slot empty" title="${kind === 'ally' ? 'Place de personnage' : 'Place de compagnon'}">${kind === 'ally' ? 'Personnage' : 'Compagnon'}</div>`;
    };
    const team = `<div class="team-bar">
      <div class="team-slot hero" title="Le chevalier (toujours présent)">${animCanvas('hero', 64, 58, 1)}</div>
      ${Array.from({ length: BALANCE.teamSlots.ally }, (_, i) => slot('ally', i)).join('')}
      <span class="team-sep"></span>${Array.from({ length: BALANCE.teamSlots.pet }, (_, i) => slot('pet', i)).join('')}
    </div>`;
    const thumb = (c) => {
      const owned = state.companions.owned[c.id];
      const equipped = state.companions.equipped.includes(c.id);
      return `<button class="pet-thumb r-${c.rarity}${c.id === sel.id ? ' selected' : ''}${owned ? '' : ' unowned'}"
        data-action="companion-sel" data-value="${c.id}" title="${c.name}">
        ${owned ? portrait(c) : `<img class="px" src="${icon(c.sprite, c.kind === 'ally' ? 1 : 3, { tint: { color: '#3a4a66', alpha: 1 } })}" alt="">`}
        ${c.kind === 'ally' ? `<span class="grade g-${c.rarity}">${ALLY_GRADE[c.rarity]}</span>` : ''}
        ${equipped ? '<span class="eq">É</span>' : ''}</button>`;
    };
    const allies = COMPANIONS.filter((c) => teamKind(c) === 'ally');
    const pets = COMPANIONS.filter((c) => teamKind(c) === 'pet');
    const owned = state.companions.owned[sel.id];
    const equipped = state.companions.equipped.includes(sel.id);
    const m = owned ? companionMultiplier(state, sel.id) : 1;
    const passive = Object.fromEntries(Object.entries(sel.passive).map(([k, v]) => [k, v * m]));
    let actions;
    if (!owned) {
      actions = '<button class="btn btn-gold" data-action="open-tab" data-value="summon">Invoquer…</button>';
    } else {
      const maxed = owned.level >= COMPANION_RULES.maxLevel;
      const kind = teamKind(sel);
      const full = !equipped && kind === 'ally' && equippedOfKind(state, 'ally').length >= BALANCE.teamSlots.ally;
      const swap = !equipped && kind === 'pet' && equippedOfKind(state, 'pet').length >= BALANCE.teamSlots.pet;
      actions = `<button class="btn ${equipped ? '' : 'btn-primary'}" data-action="toggle-companion" data-value="${sel.id}" ${full ? 'disabled title="2 personnages au maximum : retirez-en un"' : ''}>
          ${equipped ? 'Retirer' : swap ? 'Remplacer le compagnon' : 'Équiper'}</button>
        ${costButton({ action: 'upgrade-companion', cost: companionUpgradeCost(state, sel.id), have: state.gold, attrs: `data-value="${sel.id}"`, label: 'Améliorer ', max: maxed })}`;
    }
    return `${team}
      <div class="section-title">Personnages <span class="muted">(héros alliés R · SR · SSR — 2 places)</span></div>
      <div class="pet-grid">${allies.map(thumb).join('')}</div>
      <div class="section-title">Compagnons <span class="muted">(familiers — 1 place)</span></div>
      <div class="pet-grid">${pets.map(thumb).join('')}</div>
      <div class="card pet-detail r-${sel.rarity}">
        <div class="detail-head">
          <div class="pet-portrait">${owned ? portrait(sel, true) : `<img class="px" src="${icon(sel.sprite, sel.kind === 'ally' ? 1 : 4, { tint: { color: '#3a4a66', alpha: 1 } })}" alt="">`}</div>
          <div><div class="item-name">${escapeHtml(sel.name)}</div>
            <div class="item-sub"><span class="rarity-text">${rarityLabel(sel.rarity)}</span>${owned ? ` · niv. ${owned.level}/${COMPANION_RULES.maxLevel} ${stars(owned.stars)}` : ' · non obtenu'}</div></div>
        </div>
        <div class="section-title">Bonus passif</div>
        <div class="good">${effectText(passive)}</div>
        ${dungeonFor(sel)}
        ${sel.skill ? `<div class="section-title">Compétence</div><div>${img('icon_star')} <b>${sel.skill.name}</b> <span class="muted">toutes les ${sel.skill.every} s</span><div class="muted">${sel.skill.text}</div></div>` : ''}
        <div class="detail-actions">${actions}</div>
      </div>`;
  },
};
