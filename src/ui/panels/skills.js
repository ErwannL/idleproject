// Compétences (v9.0.6, façon Tap Titans) : deux listes simples, une ligne par pouvoir — icône, nom et niveau,
// effet en une ligne, et un gros bouton d'action à droite (coût ou condition de déblocage écrits dessus).
//   Sorts  : appris avec les points de compétence, lancés automatiquement (barre « Compétences » de la scène).
//   Boosts : améliorés avec l'or, lancés d'un clic (barre « Boosts » de la scène, touches Q W E R T) ou en auto.
import { SKILLS } from '../../data/skills.js';
import { RUSHES, RUSH_RULES } from '../../data/rushes.js';
import { skillCooldown, skillPointCost, skillPointsAvailable, skillValue } from '../../core/skills.js';
import { phantomHitPct, rushDuration, rushEffect, rushLevel, rushUnlocked, rushUpgradeCost } from '../../core/rushes.js';
import { computeHeroStats } from '../../core/stats.js';
import { coin, effectText, escapeHtml, formatDecimal, formatNumber, img } from '../common.js';

const time = (s) => (s >= 60 ? `${Math.ceil(s / 60)} min` : `${Math.ceil(s)} s`);

function skillRows(state) {
  const points = skillPointsAvailable(state);
  const bonus = computeHeroStats(state).bonus;
  return SKILLS.map((skill) => {
    const level = state.skills[skill.id] ?? 0;
    const locked = state.level < skill.unlockLevel;
    const maxed = level >= skill.maxLevel;
    const cost = skillPointCost(level);
    const now = skillValue(skill, Math.max(1, level));
    const next = skillValue(skill, level + 1);
    const effect = level === 0 ? skill.text(formatDecimal(next)) : maxed ? skill.text(formatDecimal(now))
      : `${skill.text(formatDecimal(now))} <span class="tt-next">→ ${formatDecimal(next)}</span>`;
    const button = locked
      ? `<button class="tt-btn tt-locked" disabled>${img('icon_lock')}<span>Débloquer au<br>niv. ${skill.unlockLevel}</span></button>`
      : maxed ? '<button class="tt-btn tt-max" disabled>Max</button>'
        : `<button class="tt-btn tt-up" data-action="learn-skill" data-key="${skill.id}" ${points < cost ? 'disabled' : ''}>
            <span>${level === 0 ? 'Apprendre' : 'Améliorer'}</span><small>${cost} point${cost > 1 ? 's' : ''}</small></button>`;
    return `<div class="tt-row${locked ? ' locked' : ''}">
      <div class="tt-icon">${img(skill.icon)}</div>
      <div class="tt-main"><div class="tt-name">${escapeHtml(skill.name)} <span class="tt-lv">Niv. ${level}</span></div>
        <div class="tt-effect">${effect}</div><div class="tt-sub">Recharge ${formatDecimal(skillCooldown(skill, bonus))} s · lancement automatique</div></div>
      ${button}</div>`;
  }).join('');
}

function rushRows(state) {
  return RUSHES.map((rush) => {
    const open = rushUnlocked(state, rush);
    const level = rushLevel(state, rush.id);
    const max = level >= RUSH_RULES.maxLevel;
    const active = state.rushes.active[rush.id] ?? 0;
    const cd = state.rushes.cooldown[rush.id] ?? 0;
    const eff = rush.id === 'phantom' ? `${phantomHitPct(state, rush)} % des dégâts × ${rush.hitsPerSecond}/s` : effectText(rushEffect(state, rush));
    const cost = rushUpgradeCost(state, rush.id);
    const use = !open ? `<button class="tt-btn tt-locked" disabled>${img('icon_lock')}<span>Débloquer au<br>niv. ${rush.unlockLevel}</span></button>`
      : active > 0 ? `<button class="tt-btn tt-active" disabled><span>Actif</span><small>${time(active)}</small></button>`
        : cd > 0 ? `<button class="tt-btn tt-wait" disabled><span>Recharge</span><small>${time(cd)}</small></button>`
          : `<button class="tt-btn tt-use" data-action="rush" data-value="${rush.id}"><span>Utiliser</span><small>${rushDuration(state, rush)} s</small></button>`;
    const up = open && !max ? `<button class="tt-btn tt-up tt-small num" data-action="upgrade-rush" data-key="${rush.id}" data-cost="${cost}" data-currency="gold" ${state.gold < cost ? 'disabled' : ''}>
        <span>Niv. ${level + 1}</span><small>${coin()} ${formatNumber(cost)}</small></button>` : '';
    return `<div class="tt-row${open ? '' : ' locked'}">
      <div class="tt-icon" style="--rush:${rush.color}">${img(rush.icon)}</div>
      <div class="tt-main"><div class="tt-name">${escapeHtml(rush.name)} <span class="tt-lv">Niv. ${level}/${RUSH_RULES.maxLevel}</span></div>
        <div class="tt-effect">${eff} pendant ${rushDuration(state, rush)} s</div><div class="tt-sub">Recharge ${Math.round(rush.cooldown / 60)} min</div></div>
      ${up}${use}</div>`;
  }).join('');
}

export default {
  id: 'skills',
  title: 'Compétences',
  icon: 'skill_quick',
  extra: (ui, state) => `Points : <b class="gold-text">${skillPointsAvailable(state)}</b>`,
  render(ui, state) {
    return `<div class="tt-head"><span class="tt-title">Sorts</span><span class="muted">1 point par niveau du héros · lancés automatiquement</span>
        <label class="toggle"><input type="checkbox" data-action="skill-auto" ${state.skillAuto ? 'checked' : ''}> Auto</label></div>
      <div class="tt-list">${skillRows(state)}</div>
      <div class="tt-head"><span class="tt-title">Boosts</span><span class="muted">un clic (ou Q W E R T) · améliorés avec l'or</span>
        <label class="toggle"><input type="checkbox" data-action="rush-auto" ${state.rushes.auto ? 'checked' : ''}> Auto</label></div>
      <div class="tt-list">${rushRows(state)}</div>`;
  },
};
