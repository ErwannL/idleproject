// Compétences (v9.0.6, façon Tap Titans ; v9.1.0) : points restants et « Répartir mes points » d'abord, puis deux
// listes — Compétences (apprises avec les points, lancées automatiquement) et Boosts (améliorés avec l'or, lancés
// d'un clic ou de Q W E R T, ou en auto). La recharge et le détail de chaque ligne sont dans « Détails ».
import { SKILLS } from '../../data/skills.js';
import { RUSHES, RUSH_RULES } from '../../data/rushes.js';
import { skillCooldown, skillPointCost, skillPointsAvailable, skillValue } from '../../core/skills.js';
import { phantomHitPct, rushDuration, rushEffect, rushLevel, rushUnlocked, rushUpgradeCost } from '../../core/rushes.js';
import { computeHeroStats } from '../../core/stats.js';
import { coin, effectText, escapeHtml, formatDecimal, formatNumber, img } from '../common.js';
import { pref } from '../prefs.js';

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


// v9.1.3 (essai, Paramètres › Interface « Compétences en grille ») : 9 cases (4 compétences, 5 boosts) avec icône,
// niveau et « + » ; une fenêtre d'une phrase pour la case choisie (effet, recharge, Utiliser) ; un seul Auto.
export function skillGridCells(state) {
  const points = skillPointsAvailable(state);
  const skills = SKILLS.map((skill) => {
    const level = state.skills[skill.id] ?? 0;
    const locked = state.level < skill.unlockLevel;
    const maxed = level >= skill.maxLevel;
    const cost = skillPointCost(level);
    return { kind: 's', id: skill.id, icon: skill.icon, name: skill.name, level, locked, unlock: skill.unlockLevel, maxed,
      plus: locked || maxed ? null : { action: 'learn-skill', can: points >= cost, price: `${cost} pt` } };
  });
  const rushes = RUSHES.map((rush) => {
    const open = rushUnlocked(state, rush);
    const level = rushLevel(state, rush.id);
    const maxed = level >= RUSH_RULES.maxLevel;
    const cost = rushUpgradeCost(state, rush.id);
    const active = state.rushes.active[rush.id] ?? 0;
    const cd = state.rushes.cooldown[rush.id] ?? 0;
    return { kind: 'r', id: rush.id, icon: rush.icon, name: rush.name, level, locked: !open, unlock: rush.unlockLevel, maxed, active, cd,
      plus: !open || maxed ? null : { action: 'upgrade-rush', can: state.gold >= cost, price: formatNumber(cost), cost } };
  });
  return [...skills, ...rushes];
}

function gridCell(c, sel) {
  const state = c.active > 0 ? `<span class="sk-state on">${time(c.active)}</span>` : c.cd > 0 ? `<span class="sk-state">${time(c.cd)}</span>` : '';
  const plus = c.plus ? `<button class="sk-plus" data-action="${c.plus.action}" data-key="${c.id}"${c.kind === 'r' ? ` data-cost="${c.plus.cost}" data-currency="gold"` : ''} ${c.plus.can ? '' : 'disabled'}
      aria-label="Améliorer ${escapeHtml(c.name)} (${c.plus.price})">+<small>${c.kind === 'r' ? coin() : ''}${c.plus.price}</small></button>`
    : c.locked ? `<span class="sk-lock">${img('icon_lock')}niv. ${c.unlock}</span>` : c.maxed ? '<span class="sk-lock">Max</span>' : '';
  return `<div class="sk-cell${c.locked ? ' locked' : ''}${sel ? ' sel' : ''}${c.kind === 'r' ? ' rush' : ''}">
    <button class="sk-pick" data-action="skill-sel" data-value="${c.kind}:${c.id}" aria-pressed="${sel}" aria-label="${escapeHtml(c.name)}, niveau ${c.level}">${img(c.icon)}<span class="sk-lv">${c.level}</span>${state}</button>${plus}</div>`;
}

function gridWindow(state, c) {
  if (!c) return '<div class="card sk-window muted">Touchez une case pour lire son effet.</div>';
  if (c.kind === 's') {
    const skill = SKILLS.find((x) => x.id === c.id);
    const bonus = computeHeroStats(state).bonus;
    const v = skillValue(skill, Math.max(1, c.level));
    return `<div class="card sk-window"><b>${escapeHtml(skill.name)}</b> <span class="muted">niv. ${c.level}</span> · ${skill.text(formatDecimal(v))}<span class="muted">, toutes les ${formatDecimal(skillCooldown(skill, bonus))} s.</span></div>`;
  }
  const rush = RUSHES.find((x) => x.id === c.id);
  const eff = rush.id === 'phantom' ? `${phantomHitPct(state, rush)} % des dégâts × ${rush.hitsPerSecond}/s` : effectText(rushEffect(state, rush));
  const use = c.locked ? '' : c.active > 0 ? `<span class="good">Actif ${time(c.active)}</span>` : c.cd > 0 ? `<span class="muted">Recharge ${time(c.cd)}</span>`
    : `<button class="btn btn-primary small" data-action="rush" data-value="${rush.id}">Utiliser</button>`;
  return `<div class="card sk-window row-between"><span><b>${escapeHtml(rush.name)}</b> <span class="muted">niv. ${c.level}</span> · ${eff} pendant ${rushDuration(state, rush)} s<span class="muted">, recharge ${Math.round(rush.cooldown / 60)} min.</span></span>${use}</div>`;
}

function gridView(ui, state) {
  const cells = skillGridCells(state);
  const [k, id] = String(ui.view.skillSel ?? '').split(':');
  const sel = cells.find((c) => c.kind === k && c.id === id) ?? null;
  const auto = state.skillAuto && state.rushes.auto;
  return `<div class="card skills-top row-between"><span>Points : <b class="gold-text">${skillPointsAvailable(state)}</b></span>
      <label class="toggle"><input type="checkbox" data-action="skills-auto-all" ${auto ? 'checked' : ''}> Auto</label></div>
    <div class="sk-grid">${cells.map((c) => gridCell(c, c === sel)).join('')}</div>
    ${gridWindow(state, sel)}`;
}

export default {
  id: 'skills',
  title: 'Compétences',
  icon: 'skill_quick',
  extra: (ui, state) => `Points : <b class="gold-text">${skillPointsAvailable(state)}</b>`,
  render(ui, state) {
    if (pref('skillGrid') === true) return gridView(ui, state);
    const points = skillPointsAvailable(state);
    const compact = ui.compact;
    const details = !compact && (ui.view.open?.has('skill-details') ?? false);
    return `<div class="card skills-top"><div class="row-between"><span>Points de compétence : <b class="gold-text">${points}</b> <span class="muted">(1 par niveau du héros)</span></span></div>
        <label class="toggle"><input type="checkbox" data-action="skill-details" ${details ? 'checked' : ''}> Afficher la recharge et le détail</label></div>
      <div class="tt-head"><span class="tt-title">Compétences</span><span class="muted">lancées automatiquement</span>
        <label class="toggle"><input type="checkbox" data-action="skill-auto" ${state.skillAuto ? 'checked' : ''}> Auto</label></div>
      <div class="tt-list">${skillRows(state, compact, details)}</div>
      <div class="tt-head"><span class="tt-title">Boosts</span><span class="muted">un clic${ui.phone ? '' : ' (ou Q W E R T)'} · améliorés avec l'or</span>
        <label class="toggle"><input type="checkbox" data-action="rush-auto" ${state.rushes.auto ? 'checked' : ''}> Auto</label></div>
      <div class="tt-list">${rushRows(state, compact, details)}</div>`;
  },
};
