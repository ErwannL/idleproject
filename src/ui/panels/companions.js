// Compagnons : collection, équipement (3 places), niveaux et compétence automatique.
import { BALANCE } from '../../data/balance.js';
import { COMPANION_RULES, COMPANIONS } from '../../data/companions.js';
import { companionById, companionMultiplier, companionUpgradeCost } from '../../core/companions.js';
import { costButton, effectText, escapeHtml, icon, img, rarityLabel, stars } from '../common.js';
import { animCanvas } from '../animator.js';

export default {
  id: 'companions',
  title: 'Compagnons',
  icon: 'icon_paw',
  extra: (ui, state) => `Équipe ${1 + state.companions.equipped.length}/${1 + BALANCE.companionSlots} (chevalier + ${BALANCE.companionSlots} compagnons)`,
  render(ui, state) {
    const sel = companionById(ui.view.companionSel) ?? COMPANIONS.find((c) => state.companions.owned[c.id]) ?? COMPANIONS[0];
    const grid = COMPANIONS.map((c) => {
      const owned = state.companions.owned[c.id];
      const equipped = state.companions.equipped.includes(c.id);
      return `<button class="pet-thumb r-${c.rarity}${c.id === sel.id ? ' selected' : ''}${owned ? '' : ' unowned'}"
        data-action="companion-sel" data-value="${c.id}" title="${c.name}">
        ${owned ? animCanvas(`pet:${c.sprite}`, 24, 24, 2) : `<img class="px" src="${icon(c.sprite, 3, { tint: { color: '#3a4a66', alpha: 1 } })}" alt="">`}
        ${equipped ? '<span class="eq">É</span>' : ''}</button>`;
    }).join('');
    const owned = state.companions.owned[sel.id];
    const equipped = state.companions.equipped.includes(sel.id);
    const m = owned ? companionMultiplier(state, sel.id) : 1;
    const passive = Object.fromEntries(Object.entries(sel.passive).map(([k, v]) => [k, v * m]));
    let actions;
    if (!owned) {
      actions = '<button class="btn btn-gold" data-action="open-tab" data-value="summon">Invoquer…</button>';
    } else {
      const maxed = owned.level >= COMPANION_RULES.maxLevel;
      const full = !equipped && state.companions.equipped.length >= BALANCE.companionSlots;
      actions = `<button class="btn ${equipped ? '' : 'btn-primary'}" data-action="toggle-companion" data-value="${sel.id}" ${full ? 'disabled title="Équipe complète : 2 compagnons au maximum"' : ''}>
          ${equipped ? 'Retirer' : 'Équiper'}</button>
        ${costButton({ action: 'upgrade-companion', cost: companionUpgradeCost(state, sel.id), have: state.gold, attrs: `data-value="${sel.id}"`, label: 'Améliorer ', max: maxed })}`;
    }
    return `<div class="pet-grid">${grid}</div>
      <div class="card pet-detail r-${sel.rarity}">
        <div class="detail-head">
          <div class="pet-portrait">${owned ? animCanvas(`pet:${sel.sprite}`, 26, 26, 2) : `<img class="px" src="${icon(sel.sprite, 4, { tint: { color: '#3a4a66', alpha: 1 } })}" alt="">`}</div>
          <div><div class="item-name">${escapeHtml(sel.name)}</div>
            <div class="item-sub"><span class="rarity-text">${rarityLabel(sel.rarity)}</span>${owned ? ` · niv. ${owned.level}/${COMPANION_RULES.maxLevel} ${stars(owned.stars)}` : ' · non obtenu'}</div></div>
        </div>
        <div class="section-title">Bonus passif</div>
        <div class="good">${effectText(passive)}</div>
        ${sel.skill ? `<div class="section-title">Compétence</div><div>${img('icon_star')} <b>${sel.skill.name}</b> <span class="muted">toutes les ${sel.skill.every} s</span><div class="muted">${sel.skill.text}</div></div>` : ''}
        <div class="detail-actions">${actions}</div>
      </div>`;
  },
};
