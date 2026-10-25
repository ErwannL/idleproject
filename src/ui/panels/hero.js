// Héros : collection de chevaliers (rôles distincts), niveau, statistiques et bonus par source.
import { HEROES } from '../../data/heroes.js';
import { SLOTS } from '../../data/items.js';
import { bonusSources } from '../../core/bonuses.js';
import { stageLabel } from '../../core/combat.js';
import { heroById, heroEffects } from '../../core/heroes.js';
import { xpForLevel } from '../../core/level.js';
import { computeHeroStats } from '../../core/stats.js';
import { heroPortraitUrl, slotIconName } from '../../render/pixel.js';
import { effectText, escapeHtml, formatDecimal, formatNumber, img, itemFrame, progressBar, rarityLabel, stars } from '../common.js';
import { animCanvas } from '../animator.js';

const SOURCE_LABELS = { hero: 'Héros', powers: 'Pouvoirs de boss', talents: 'Talents', companions: 'Compagnons', gear: 'Effets d’équipement' };

export default {
  id: 'hero',
  title: 'Héros',
  icon: 'icon_hero',
  extra: (ui, state) => `Niv. <b class="gold-text">${state.level}</b>`,
  render(ui, state) {
    const selectedId = heroById(ui.view.heroSel) ? ui.view.heroSel : state.heroes.active;
    const hero = heroById(selectedId);
    const owned = state.heroes.owned[hero.id];
    const roster = HEROES.map((h) => {
      const has = state.heroes.owned[h.id];
      const portrait = has ? animCanvas(`hero:${h.id}`, 48, 52, 1)
        : `<img class="px" src="${heroPortraitUrl({ weapon: state.equipment.weapon }, 1, h.palette, '#2a3550')}" alt="">`;
      return `<button class="hero-thumb r-${h.rarity}${h.id === selectedId ? ' selected' : ''}${has ? '' : ' unowned'}${h.id === state.heroes.active ? ' active-hero' : ''}"
        data-action="hero-sel" data-value="${h.id}" title="${h.name}${has ? '' : ' (à invoquer)'}">${portrait}</button>`;
    }).join('');
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
    const bonusOfSelected = owned ? effectText(selectedId === state.heroes.active ? heroEffects(state) : hero.bonus) : effectText(hero.bonus);
    return `<div class="hero-layout">
        <div class="hero-roster">${roster}</div>
        <div class="card hero-main r-${hero.rarity}">
          <div class="pedestal">${hero.id === state.heroes.active ? animCanvas('hero', 64, 58, 3) : animCanvas(`hero:${hero.id}`, 64, 58, 3)}</div>
          <div class="grow">
            <div class="hero-title">${escapeHtml(hero.name)}</div>
            <div class="muted"><span class="rarity-text">${rarityLabel(hero.rarity)}</span> · ${hero.role} ${owned ? stars(owned.stars) : ''}</div>
            <div class="hero-desc">${escapeHtml(hero.description)}</div>
            <div class="hero-bonus">${bonusOfSelected}</div>
            ${owned
              ? (selectedId === state.heroes.active ? '<span class="equipped-tag">Héros actif</span>'
                : `<button class="btn btn-primary small" data-action="set-hero" data-value="${hero.id}">Choisir ce héros</button>`)
              : '<button class="btn btn-gold small" data-action="open-tab" data-value="summon">Invoquer…</button>'}
          </div>
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
