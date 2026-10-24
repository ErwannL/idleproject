// Compétences actives : un point par niveau de héros, lancement automatique.
import { SKILLS } from '../../data/skills.js';
import { skillCooldown, skillPointsAvailable, skillValue } from '../../core/skills.js';
import { computeHeroStats } from '../../core/stats.js';
import { formatDecimal, img, progressBar } from '../common.js';
import { xpForLevel } from '../../core/level.js';

export default {
  id: 'skills',
  title: 'Compétences du héros',
  icon: 'skill_quick',
  extra: (ui, state) => `Points : <b class="gold-text">${skillPointsAvailable(state)}</b>`,
  render(ui, state) {
    const points = skillPointsAvailable(state);
    const bonus = computeHeroStats(state).bonus;
    const cards = SKILLS.map((skill) => {
      const level = state.skills[skill.id] ?? 0;
      const locked = state.level < skill.unlockLevel;
      const value = skillValue(skill, Math.max(1, level));
      const next = skillValue(skill, level + 1);
      const maxed = level >= skill.maxLevel;
      return `<div class="card skill-card${locked ? ' locked' : ''}">
        <div class="upg-icon">${img(skill.icon)}</div>
        <div class="grow">
          <div class="upg-name">${skill.name} <span class="upg-level">${locked ? `Débloquée au niv. ${skill.unlockLevel}` : `Niv. ${level}/${skill.maxLevel}`}</span></div>
          <div class="skill-text">${skill.text(formatDecimal(value))}${level && !maxed ? ` <span class="muted">→ ${skill.text(formatDecimal(next))}</span>` : ''}</div>
          <div class="muted">Recharge : ${formatDecimal(skillCooldown(skill, bonus))} s</div>
        </div>
        <button class="btn btn-gold plus" data-action="learn-skill" data-key="${skill.id}" ${locked || maxed || points < 1 ? 'disabled' : ''}
          title="${locked ? 'Verrouillée' : maxed ? 'Niveau maximal' : 'Dépenser 1 point'}">${locked ? img('icon_lock') : maxed ? 'Max' : '+'}</button>
      </div>`;
    });
    const xpNeeded = xpForLevel(state.level);
    return `<div class="card row-between">
        <div><b>Niveau ${state.level}</b> <span class="muted">· 1 point de compétence par niveau</span>
          ${progressBar(state.xp / xpNeeded, `${Math.floor(state.xp)} / ${xpNeeded} XP`, 'xp')}</div>
        <label class="toggle"><input type="checkbox" data-action="skill-auto" ${state.skillAuto ? 'checked' : ''}> Lancement auto</label>
      </div>
      <div class="upg-list">${cards.join('')}</div>`;
  },
};
