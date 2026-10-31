// Compétences (v9.0.6, façon Tap Titans ; v9.1.0) : points restants et « Répartir mes points » d'abord, puis deux
// listes — Compétences (apprises avec les points, lancées automatiquement) et Boosts (améliorés avec l'or, lancés
// d'un clic ou de Q W E R T, ou en auto). La recharge et le détail de chaque ligne sont dans « Détails ».
import { SKILLS } from '../../data/skills.js';
import { RUSHES, RUSH_RULES } from '../../data/rushes.js';
import { skillCooldown, skillPointCost, skillPointsAvailable, skillValue } from '../../core/skills.js';
import { phantomHitPct, rushDuration, rushEffect, rushLevel, rushUnlocked, rushUpgradeCost } from '../../core/rushes.js';
import { computeHeroStats } from '../../core/stats.js';
import { coin, effectText, escapeHtml, formatDecimal, formatNumber, img } from '../common.js';

const time = (s) => (s >= 60 ? `${Math.ceil(s / 60)} min` : `${Math.ceil(s)} s`);

function skillRows(state, compact, details) {
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
        ${compact ? '' : `<div class="tt-effect">${effect}</div>`}${details ? `<div class="tt-sub">Recharge ${formatDecimal(skillCooldown(skill, bonus))} s · lancement automatique</div>` : ''}</div>
      ${button}</div>`;
  }).join('');
}

function rushRows(state, compact, details) {
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
        ${compact ? '' : `<div class="tt-effect">${eff} pendant ${rushDuration(state, rush)} s</div>`}${details ? `<div class="tt-sub">Recharge ${Math.round(rush.cooldown / 60)} min</div>` : ''}</div>
      ${up}${use}</div>`;
  }).join('');
}

export default {
  id: 'skills',
  title: 'Compétences',
  icon: 'skill_quick',
  extra: (ui, state) => `Points : <b class="gold-text">${skillPointsAvailable(state)}</b>`,
  render(ui, state) {
    const points = skillPointsAvailable(state);
    const compact = ui.compact;
    const details = !compact && (ui.view.open?.has('skill-details') ?? false);
    return `<div class="card skills-top"><div class="row-between"><span>Points de compétence : <b class="gold-text">${points}</b> <span class="muted">(1 par niveau du héros)</span></span>
        <button class="btn btn-gold primary-action" data-action="distribute-skills" ${points ? '' : 'disabled'}>Répartir mes points</button></div>
        <div class="muted">« Répartir » donne chaque point à la compétence apprise la moins haute (répartition équilibrée).</div>
        <label class="toggle"><input type="checkbox" data-action="skill-details" ${details ? 'checked' : ''}> Afficher la recharge et le détail</label></div>
      <div class="tt-head"><span class="tt-title">Compétences</span><span class="muted">lancées automatiquement</span>
        <label class="toggle"><input type="checkbox" data-action="skill-auto" ${state.skillAuto ? 'checked' : ''}> Auto</label></div>
      <div class="tt-list">${skillRows(state, compact, details)}</div>
      <div class="tt-head"><span class="tt-title">Boosts</span><span class="muted">un clic${ui.phone ? '' : ' (ou Q W E R T)'} · améliorés avec l'or</span>
        <label class="toggle"><input type="checkbox" data-action="rush-auto" ${state.rushes.auto ? 'checked' : ''}> Auto</label></div>
      <div class="tt-list">${rushRows(state, compact, details)}</div>`;
  },
};
