// Héros : collection de chevaliers (rôles distincts), niveau, statistiques et bonus par source.
import { SLOTS } from '../../data/items.js';
import { bonusSources } from '../../core/bonuses.js';
import { stageLabel } from '../../core/combat.js';
import { heroById, heroEffects } from '../../core/heroes.js';
import { xpForLevel } from '../../core/level.js';
import { computeHeroStats } from '../../core/stats.js';
import { slotIconName } from '../../render/pixel.js';
import { effectText, escapeHtml, formatDecimal, formatNumber, img, itemFrame, progressBar } from '../common.js';
import { animCanvas } from '../animator.js';
import { setBonusFor, setById, setCounts } from '../../core/sets.js';
import { SET_PIECES } from '../../data/sets.js';

const SOURCE_LABELS = { hero: 'Héros', powers: 'Pouvoirs de boss', talents: 'Talents', companions: 'Équipe', gear: 'Effets d’équipement', prestige: 'Prestige', rushes: 'Boosts actifs', achievements: 'Hauts faits', sets: 'Ensembles' };

// Ensembles d'équipement portés (v8.5) : pièces et paliers atteints.
function setsCard(state) {
  const counts = setCounts(state.equipment);
  const rows = Object.entries(counts).map(([id, n]) => {
    const set = setById(id);
    const next = SET_PIECES.find((p) => p > n);
    return `<div class="set-row" style="--set:${set.color}"><b style="color:${set.color}">${escapeHtml(set.name)}</b> <span class="muted">${n} pièce${n > 1 ? 's' : ''}</span>
      <span class="${n >= SET_PIECES[0] ? 'good' : 'muted'}">${n >= SET_PIECES[0] ? effectText(setBonusFor(set, n)) : 'aucun bonus'}</span>
      ${next ? `<span class="muted">· à ${next} : ${effectText(set.bonuses[next])}</span>` : ''}</div>`;
  }).join('');
  return `<div class="card"><div class="section-title">Ensembles d'équipement</div>${rows || '<div class="muted">Les objets Rares et mieux appartiennent parfois à l\'ensemble de leur monde (point coloré). Portez 2, 4 puis 6 pièces d\'un même ensemble pour ses bonus.</div>'}</div>`;
}

export default {
  id: 'hero',
  title: 'Héros',
  icon: 'icon_hero',
  extra: (ui, state) => `Niv. <b class="gold-text">${state.level}</b>`,
  render(ui, state) {
    // Le chevalier est le seul héros (inchangeable) : plus de collection de variantes.
    const hero = heroById(state.heroes.active);
    const s = computeHeroStats(state);
    const xpNeeded = xpForLevel(state.level);
    const gear = Object.keys(SLOTS).map((slot) => {
      const item = state.equipment[slot];
      return item ? itemFrame(item, { tag: 'div' }) : `<div class="item-frame empty">${img(slotIconName(slot))}</div>`;
    }).join('');
    const line = (iconName, label, value) => `${img(iconName)}<span>${label}</span><span class="v">${value}</span>`;
    const sources = Object.entries(bonusSources(state))
      .filter(([, eff]) => Object.values(eff).some((v) => v))
      .map(([k, eff]) => `<div><span class="muted">${SOURCE_LABELS[k]} :</span> ${effectText(eff)}</div>`).join('');
    const heroBonus = effectText(heroEffects(state));
    return `<div class="card hero-main r-${hero.rarity}">
          <div class="pedestal">${animCanvas('hero', 64, 58, 3)}</div>
          <div class="grow">
            <div class="hero-title">${escapeHtml(hero.name)}</div>
            <div class="muted">${hero.role} · le héros de l'aventure</div>
            <div class="hero-desc">${escapeHtml(hero.description)}</div>
            ${heroBonus ? `<div class="hero-bonus">${heroBonus}</div>` : ''}
          </div>
      </div>
      <div class="card">
        <div class="row-between"><b>Niveau ${state.level}</b><span class="muted">Étape max ${stageLabel(state.maxStage)}</span></div>
        ${progressBar(state.xp / xpNeeded, `${formatNumber(Math.floor(state.xp))} / ${formatNumber(xpNeeded)} XP`, 'xp')}
        <div class="gear-row" style="margin-top:5px">${gear}</div>
      </div>
      <div class="card"><div class="section-title">Statistiques</div><div class="stats-grid">
        ${line('weapon_sword', 'Dégâts', formatNumber(s.damage))}
        ${line('icon_bolt', 'Attaques / s', formatDecimal(s.attacksPerSecond, 2))}
        ${line('skill_quick', 'Coup critique', `${formatDecimal(s.critChance)} %`)}
        ${line('weapon_sword', 'DPS', formatDecimal(s.dps))}
        ${line('icon_heart', 'PV max', formatNumber(s.maxHp))}
        ${line('icon_shield', 'Armure', `${formatDecimal(s.armor)} %`)}
        ${line('pet_fairy', 'Régénération', `${formatDecimal(s.regenPerSecond)} PV/s`)}
        ${line('coin', 'Or bonus', `+${formatDecimal(s.goldPct)} %`)}
      </div></div>
      ${setsCard(state)}
      ${sources ? `<div class="card"><div class="section-title">Bonus permanents</div><div class="bonus-sources">${sources}</div></div>` : ''}
      <div class="card"><div class="section-title">Exploits</div><div class="stats-grid">
        ${line('icon_skull', 'Ennemis vaincus', formatNumber(state.records.kills))}
        ${line('icon_boss', 'Boss vaincus', formatNumber(state.records.bossesDefeated))}
        ${line('icon_bag', 'Objets trouvés', formatNumber(state.records.itemsFound))}
        ${line('icon_trophy', 'Contrats remplis', formatNumber(state.records.contractsDone))}
        ${line('coin', 'Or gagné au total', formatNumber(state.records.goldEarned))}
        ${state.records.rebirths ? line('icon_rebirth', 'Renaissances', formatNumber(state.records.rebirths)) : ''}
      </div></div>`;
  },
};
