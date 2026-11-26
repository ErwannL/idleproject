// Compétences (v9.0.6, façon Tap Titans ; v9.1.0) : points restants et « Répartir mes points » d'abord, puis deux
// listes — Compétences (apprises avec les points, lancées automatiquement) et Boosts (améliorés avec l'or, lancés
// d'un clic ou de Q W E R T, ou en auto). La recharge et le détail de chaque ligne sont dans « Détails ».
import { activeSkills, classSkills, loadoutSize } from '../../core/skills.js'; // v9.7.1 (lot 6)
import { SKILLS } from '../../data/skills.js';
import { RUSHES, RUSH_RULES } from '../../data/rushes.js';
import { skillCooldown, skillPointCost, skillPointsAvailable, skillValue } from '../../core/skills.js';
import { phantomHitPct, rushDuration, rushEffect, rushLevel, rushSlots, rushUnlocked, rushUpgradeCost } from '../../core/rushes.js';
import { computeHeroStats } from '../../core/stats.js';
import { coin, effectText, escapeHtml, formatDecimal, formatNumber, img } from '../common.js';
import { pref } from '../prefs.js';
import { vignetteHtml } from '../vignettes.js';
import { vignetteFx } from '../../data/skill-vfx.js';
import { mBtn, mBtnGold, mChip, mCost, mGrid, mModes, mSheet, mTile, mTitle } from '../mobile-kit.js'; // v10.12 (lot 4) : vue téléphone
import { icon } from '../common.js';
import { BG } from '../../render/bg.js';
import { zoneForStage } from '../../core/combat.js';
import { ENEMIES } from '../../data/enemies.js';

const time = (s) => (s >= 60 ? `${Math.ceil(s / 60)} min` : `${Math.ceil(s)} s`);

function skillRows(state, compact, details) {
  const points = skillPointsAvailable(state);
  const bonus = computeHeroStats(state).bonus;
  return classSkills(state).map((skill) => { // v9.7.1 (lot 6) : compétences de la classe
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
        ${compact ? '' : `<div class="tt-effect">${eff} pendant ${rushDuration(state, rush)} s</div>`}${details ? `<div class="tt-sub">Recharge ${rush.cooldown} s</div>` : ''}
        ${open ? `<div class="tt-slots">Emplacement : ${[0, 1, 2].map((i) => `<button class="btn tiny${rushSlots(state)[i] === rush.id ? ' active' : ''}" data-action="rush-slot" data-value="${i}|${rush.id}">${i + 1}</button>`).join('')}</div>` : ''}</div>
      ${up}${use}</div>`;
  }).join('');
}


// v9.1.3 (essai, Paramètres › Interface « Compétences en grille ») : 9 cases (4 compétences, 5 boosts) avec icône,
// niveau et « + » ; une fenêtre d'une phrase pour la case choisie (effet, recharge, Utiliser) ; un seul Auto.
export function skillGridCells(state) {
  const points = skillPointsAvailable(state);
  const skills = classSkills(state).map((skill) => { // v9.7.1 (lot 6)
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
    // v9.8.1 (I3) : durée et recharge écrites sous l'icône du Boost.
    const sub = `${rushDuration(state, rush)} s · ${Math.round(rush.cooldown / 60)} min`;
    return { kind: 'r', id: rush.id, icon: rush.icon, name: rush.name, sub, level, locked: !open, unlock: rush.unlockLevel, maxed, active, cd,
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
  if (!c) return '<div class="card sk-window muted">Touche une case pour lire son effet.</div>';
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

// v9.3.4 : deux sections nommées — Attaques (payées en points, lancées seules) et Boosts (payés en or, à utiliser) ;
// nom sous chaque icône, badge « Nv X », cadenas si bloqué, bulle courte au toucher, un seul gros bouton.
const SKILL_SHORT = { /* v9.7.1 : compétences de classe : leur nom suffit */ quick: 'Coup rapide sur un ennemi', whirl: 'Frappe tous les ennemis', cry: "Plus de dégâts un moment", holy: 'Gros coup qui soigne' };
// v10.4 (3) : effet joué par la vignette d'une case (compétence ou Boost) — le même qu'au combat (data/skill-vfx.js).
export const skillFxName = (state, c) => vignetteFx(c.kind, c.id, state.heroClass ?? 'knight');
const TYPE_LABEL = { hit: 'Coup unique', aoe: 'Zone', buff: 'Soutien', holy: 'Soin' };
// Vignette animée d'une case, à la taille voulue (160 px en tête de la fiche, 48 px au survol d'une case).
// Réutilisable ailleurs (page Personnage) : skillVignetteHtml(state, cell, 160).
export const skillVignetteHtml = (state, c, size = 160) => vignetteHtml(skillFxName(state, c), size);
// v10.13 (lot 4, § 4) : Compétences sur PC, façon « vrai jeu » (maquette m03). Trois colonnes (grille .d-cols3b) dans le cadre du kit :
//   gauche  « Ta barre de combat » : le héros sur le décor du monde, ses places rondes (touches 1 2 3 ; un clic arme la place, puis on clique
//           une carte ; ou on glisse la carte sur la place), les Boosts Q W E R T, « Répartir les points » (bouton sombre) ;
//   centre  deux modes Attaques / Boosts (chacun son interrupteur Auto) et les cartes 3 x 2 (icône 80 px, nom, étiquette, effet, jauge, Nv) ;
//   droite  le détail : aperçu en combat (héros + effet animé + 2 monstres), Avant » Après, coût en case, un seul bouton doré, un sombre.
const TYPE_DESC = { hit: 'Un coup puissant sur un ennemi.', aoe: 'Frappe tous les ennemis à la fois.', buff: 'Plus de dégâts pendant un moment.', holy: 'Un coup de lumière qui soigne le héros.' };
const TYPE_COLOR = { hit: '#ff5a5a', aoe: '#ffa040', buff: '#ffd040', holy: '#40b0ff', boost: '#c070ff' };
const RUSH_KEYS = ['Q', 'W', 'E', 'R', 'T'];
const dec = (n) => formatDecimal(n);
const maxOf = (c) => (c.kind === 'r' ? RUSH_RULES.maxLevel : SKILLS.find((x) => x.id === c.id)?.maxLevel ?? 50);

// Décor du monde actuel (ciel + calque lointain), le même que la scène.
function worldStyle(state) {
  const z = zoneForStage(state.stage ?? 1);
  const bg = BG[z?.id] ?? BG.cursed;
  const far = bg.layers.find((l) => /_far\.png$/.test(l.file))?.file ?? bg.layers[0]?.file;
  const sky = `linear-gradient(180deg, ${bg.sky.join(', ')})`;
  return { zone: z, style: `background: ${far ? `url(assets/bg/${far}) center bottom / cover no-repeat, ` : ''}${sky}, ${bg.ground};` };
}

// Jauge de niveau : 5 segments (10 niveaux chacun pour une compétence).
function pipsHtml(level, max) {
  const per = max / 5;
  return `<span class="dsk-pips" role="img" aria-label="Niveau ${level} sur ${max}">${[0, 1, 2, 3, 4].map((i) => `<i style="--f:${Math.max(0, Math.min(1, (level - per * i) / per))}"></i>`).join('')}</span>`;
}

// Faits d'une compétence ou d'un Boost, pour la carte et le détail.
function skillFacts(state, c) {
  const bonus = computeHeroStats(state).bonus;
  if (c.kind === 's') {
    const skill = SKILLS.find((x) => x.id === c.id);
    const cd = formatDecimal(skillCooldown(skill, bonus));
    const v = (lv) => skillValue(skill, Math.max(1, lv));
    const val = (lv) => (skill.type === 'buff' ? `+${dec(v(lv))} %` : `×${dec(v(lv))}`);
    const label = skill.type === 'aoe' ? 'Dégâts à tous' : skill.type === 'buff' ? 'Bonus de dégâts' : 'Dégâts';
    return { type: skill.type, desc: TYPE_DESC[skill.type] ?? '', line: `${val(c.level)} · ${skill.type === 'buff' ? `${skill.duration ?? 10} s` : `toutes les ${cd} s`}`,
      rows: [{ icon: 'icon_damage', label, now: c.level > 0 ? val(c.level) : '—', next: c.maxed ? '' : val(c.level + 1) },
        ...(skill.type === 'holy' ? [{ icon: 'icon_heart', label: 'Soin', now: `${skill.heal ?? 15} % des PV`, next: '' }] : []),
        { icon: 'icon_timer', label: 'Recharge', now: `${cd} s`, next: '' }] };
  }
  const rush = RUSHES.find((x) => x.id === c.id);
  const lv = rushLevel(state, rush.id);
  const at = (l) => ({ ...state, rushes: { ...state.rushes, levels: { ...state.rushes.levels, [rush.id]: l }, autoOn: {} } });
  const eff = (l) => (rush.id === 'phantom' ? `${dec(phantomHitPct(at(l), rush))} % × ${rush.hitsPerSecond}/s` : effectText(rushEffect(at(l), rush)));
  const dur = (l) => `${rushDuration(at(l), rush)} s`;
  return { type: 'boost', desc: `${rush.id === 'phantom' ? 'Des coups fantômes en plus.' : `${rush.text}.`} Recharge ${Math.round((rush.cooldown / 60) * 10) / 10} min.`, line: `${eff(lv)} · ${dur(lv)}`,
    rows: [{ icon: 'icon_damage', label: 'Effet', now: eff(lv), next: c.maxed ? '' : eff(lv + 1) },
      { icon: 'icon_timer', label: 'Durée', now: dur(lv), next: c.maxed ? '' : dur(lv + 1) }] };
}

function deskCard(state, c, sel, activeIds) {
  const f = skillFacts(state, c);
  const slot = c.kind === 's' ? activeIds.indexOf(c.id) : -1;
  const drag = c.kind === 's' && !c.locked && c.level > 0 ? ` draggable="true" data-skill-drag="${escapeHtml(c.id)}"` : '';
  const line = c.locked ? `${img('icon_lock')} Niv. ${c.unlock} du héros` : f.line;
  return `<button type="button" class="dsk-card t-${f.type}${sel ? ' sel' : ''}${c.locked ? ' locked' : ''}" style="--c:${TYPE_COLOR[f.type]}" data-action="skill-sel" data-value="${c.kind}:${c.id}" aria-pressed="${sel}"${drag}>
    <span class="dsk-top">${slot >= 0 ? `<em class="dsk-on">Active ${slot + 1}</em>` : c.kind === 'r' && c.active > 0 ? '<em class="dsk-on">Actif</em>' : '<span></span>'}<i class="dsk-lv">Nv ${c.level}</i></span>
    <span class="dsk-ic">${img(c.icon)}</span><span class="dsk-name">${escapeHtml(c.name)}</span>
    <span class="sk2-type t-${f.type}">${c.kind === 'r' ? 'Boost' : TYPE_LABEL[f.type] ?? ''}</span><small class="dsk-line">${line}</small>${pipsHtml(c.level, maxOf(c))}</button>`;
}

const deskSwitch = (action, on) => `<label class="m-switch"><input type="checkbox" data-action="${action}" ${on ? 'checked' : ''}><span class="m-sw" aria-hidden="true"></span><span class="m-sw-t">Auto</span></label>`;

function deskLeft(ui, state, cells, activeIds, armed) {
  const world = worldStyle(state);
  const size = loadoutSize(state);
  const heroImg = `assets/ui/art98/class_${state.heroClass ?? 'knight'}.png`;
  const byId = (id) => cells.find((c) => c.kind === 's' && c.id === id);
  const slots = Array.from({ length: size }, (_, i) => {
    const c = byId(activeIds[i]);
    const drag = c ? ` draggable="true" data-skill-drag="${escapeHtml(c.id)}"` : '';
    return `<button type="button" class="dsk-slot${c ? '' : ' empty'}${armed === i ? ' armed' : ''}" data-action="skill-slot-pick" data-value="${i}" data-slot-drop="${i}" aria-pressed="${armed === i}"${drag}
      aria-label="${c ? `Place ${i + 1} : ${escapeHtml(c.name)}` : `Place ${i + 1} vide`}">${c ? img(c.icon) : '<b>+</b>'}<kbd>${i + 1}</kbd></button>`;
  }).join('');
  const plural = activeIds.length > 1 ? 's' : '';
  const hint = armed != null ? `<b class="dsk-arm">Choisis une compétence pour la place ${armed + 1}</b>`
    : activeIds.length ? `${activeIds.length} attaque${plural} active${plural} sur ${size} · elles partent seules` : 'Apprends une attaque pour la mettre ici';
  const boosts = cells.filter((c) => c.kind === 'r').map((c, i) => {
    const rush = RUSHES.find((x) => x.id === c.id);
    return mTile({ name: c.name, rarity: 'epic', locked: c.locked }, { size: 56, src: icon(c.icon), action: 'skill-sel', value: `r:${c.id}`, label: `${RUSH_KEYS[i] ?? ''} · ${rushDuration(state, rush)} s`,
      pips: false, plus: '', selected: String(ui.view.skillSel) === `r:${c.id}`, badge: c.active > 0 ? time(c.active) : '' });
  });
  return `<div class="m-card dsk-left">
    <div class="dsk-hero" style="${world.style}"><span class="dsk-lbl">Ta barre de combat</span><img class="px dsk-hero-img" src="${heroImg}" alt="Ton héros"></div>
    <div class="dsk-slots${size > 3 ? ' n4' : ''}">${slots}</div><p class="dsk-cap">${hint}</p>
    <h3 class="dsk-sec">Boosts actifs</h3>${mGrid(boosts, 5)}
    ${mBtn('↺ Répartir les points', { action: 'distribute-skills', disabled: skillPointsAvailable(state) <= 0, cls: 'dsk-spread' })}</div>`;
}

function deskCenter(ui, state, cells, activeIds, sel, mode) {
  const mk = (id, label, ic, autoAction, on) => `<div class="dsk-mode${mode === id ? ' on' : ''}">${mModes([{ id, label, icon: ic, action: 'm-set', value: id, attrs: 'data-key="mDSkMode"' }], mode)}${deskSwitch(autoAction, on)}</div>`;
  const list = cells.filter((c) => c.kind === mode);
  return `<div class="dsk-center"><div class="dsk-modes">${mk('s', 'Attaques', 'skill_quick', 'skill-auto', state.skillAuto)}${mk('r', 'Boosts', 'icon_bolt', 'rush-auto', state.rushes.auto)}</div>
    <div class="dsk-grid">${list.map((c) => deskCard(state, c, c === sel, activeIds)).join('')}</div></div>`;
}

function deskDetail(ui, state, c, activeIds, armed) {
  if (!c) return '<div class="m-card dsk-detail"><div class="m-empty"><p>Choisis une compétence pour la voir.</p></div></div>';
  const f = skillFacts(state, c);
  const world = worldStyle(state);
  const heroImg = `assets/ui/art98/class_${state.heroClass ?? 'knight'}.png`;
  const mobs = (world.zone?.enemies ?? []).slice(0, 2).map((id, i) => `<img class="px dsk-mob m${i}" src="${icon(ENEMIES[id]?.sprite ?? id)}" alt="">`).join('');
  const prev = `<div class="dsk-prev sk2-sheet" style="${world.style}"><span class="dsk-play">▶ Aperçu en combat</span><img class="px dsk-ph" src="${heroImg}" alt="">${skillVignetteHtml(state, c, 160)}${mobs}</div>`;
  const tname = c.kind === 'r' ? 'Boost' : TYPE_LABEL[f.type] ?? '';
  const head = `<div class="dsk-dhead"><b>${escapeHtml(c.name)}</b><span class="sk2-type t-${f.type}">${tname}</span></div><p class="dsk-desc">${escapeHtml(f.desc)}</p>`;
  const lvl = c.maxed ? `<div class="dsk-lvl"><span>Nv ${c.level}</span><em class="good">niveau maximal</em></div>`
    : `<div class="dsk-lvl"><span>Nv ${c.level}</span><i>»</i><span class="good">Nv ${c.level + 1}</span></div>`;
  const rows = f.rows.map((r) => `<div class="dsk-cmp">${img(r.icon)}<span class="m-k">${escapeHtml(r.label)}</span><b class="m-v">${r.next ? `${escapeHtml(r.now)} <i>»</i> <span class="good">${escapeHtml(r.next)}</span>` : escapeHtml(r.now)}</b></div>`).join('');
  let cost = '', main = '', second = '', note = '';
  const pts = skillPointsAvailable(state);
  if (c.locked) note = `<p class="dsk-note">${img('icon_lock')} Débloquée au niveau ${c.unlock} du héros.</p>`;
  else if (c.maxed) note = '<p class="dsk-note good">Niveau maximal atteint.</p>';
  else if (c.kind === 's') {
    const price = skillPointCost(c.level);
    const ok = pts >= price;
    const tile = mCost(null, pts, `${price} pt`, { ok }).replace('<span class="m-cost-ico"></span>', '<span class="m-cost-ico"><b class="dsk-spark">✦</b></span>');
    cost = `<div class="dsk-costrow">${tile}<p>${ok ? `Il te reste ${pts} point${pts > 1 ? 's' : ''}.` : `Il manque ${price - pts} point${price - pts > 1 ? 's' : ''}.<br>Le prochain arrive au <b>niveau ${state.level + 1}</b> du héros.`}</p></div>`;
    main = mBtnGold(`${c.level === 0 ? 'Apprendre' : 'Améliorer'} · ${price} pt`, { action: 'learn-skill', attrs: `data-key="${escapeHtml(c.id)}"`, disabled: !ok });
  } else {
    const price = c.plus?.cost ?? 0;
    cost = `<div class="dsk-costrow">${mCost('coin', state.gold, price, { fmt: formatNumber })}<p>${state.gold >= price ? 'Payé avec ton or.' : 'Il te manque de l\'or.'}</p></div>`;
    main = mBtnGold('Améliorer', { icon: 'coin', action: 'upgrade-rush', attrs: `data-key="${escapeHtml(c.id)}" data-cost="${price}" data-currency="gold"`, disabled: state.gold < price });
  }
  if (c.kind === 's' && c.level > 0 && !c.locked) {
    const at = activeIds.indexOf(c.id);
    const size = loadoutSize(state);
    if (at >= 0) second = mBtn(`Retirer de la barre (place ${at + 1})`, { action: 'skill-loadout', attrs: `data-key="${escapeHtml(c.id)}"`, disabled: activeIds.length <= 1 });
    else {
      const slot = armed ?? (activeIds.length < size ? activeIds.length : size - 1);
      second = mBtn(activeIds.length >= size && armed == null ? `Mettre dans la barre (place ${slot + 1})` : 'Mettre dans la barre', { action: 'skill-slot-set', value: `${c.id}|${slot}` });
    }
  } else if (c.kind === 'r' && !c.locked) {
    second = c.active > 0 ? `<p class="m-sk-state good">Actif ${time(c.active)}</p>` : c.cd > 0 ? `<p class="m-sk-state">Prêt dans ${time(c.cd)}</p>`
      : mBtn(`Utiliser (touche ${RUSH_KEYS[RUSHES.findIndex((x) => x.id === c.id)] ?? ''})`, { action: 'rush', value: c.id });
  }
  return `<div class="m-card dsk-detail">${prev}${head}${lvl}<div class="dsk-cmps">${rows}</div>${note}${cost}<div class="dsk-btns">${main}${second}</div></div>`;
}

function deskView(ui, state) {
  const cells = skillGridCells(state);
  const pts = skillPointsAvailable(state);
  const [k, id] = String(ui.view.skillSel ?? '').split(':');
  const chosen = cells.find((c) => c.kind === k && c.id === id) ?? null;
  const mode = ui.view.mDSkMode === 'r' || ui.view.mDSkMode === 's' ? ui.view.mDSkMode : chosen?.kind ?? 's';
  // La carte choisie par défaut : une Attaque abordable s'il y a des points (v9.3.8 3a), sinon la première ouverte du mode.
  const inMode = cells.filter((c) => c.kind === mode);
  const sel = chosen?.kind === mode ? chosen : (mode === 's' && pts > 0 ? inMode.find((c) => !c.locked && c.plus?.can) : null) ?? inMode.find((c) => !c.locked) ?? inMode[0] ?? null;
  const activeIds = activeSkills(state).map((s) => s.id);
  const armed = Number.isInteger(ui.view.skillSlot) && ui.view.skillSlot < loadoutSize(state) ? ui.view.skillSlot : null;
  return `<div class="m-frame m-hero m-dsk">${mTitle('icon_bolt', 'Compétences', true)}
    ${ptsBanner(pts, 'dsk-pts')}
    <div class="d-cols3b">${deskLeft(ui, state, cells, activeIds, armed)}${deskCenter(ui, state, cells, activeIds, sel, mode)}${deskDetail(ui, state, sel, activeIds, armed)}</div></div>`;
}

// v10.13.1 (§ 2, maquette t03) : Compétences sur téléphone, façon « vrai jeu ». Pastille de points à gauche du cartouche ; « Ta barre de combat »
// (fond du monde, places rondes de 62 px numérotées : un toucher arme la place, un toucher sur une carte l'y met : mêmes actions que sur PC,
// skill-slot-pick / skill-sel / skill-slot-set) ; modes Attaques / Boosts (chacun son Auto) ; cartes 3 x 2 (icône 42 px, nom, Nv, pastille de place) ;
// dessous, le détail de la carte choisie (Avant » Après, raison s'il manque un point, un seul bouton doré). L'aperçu animé reste une fiche (▶).
const phoneType = (c) => (c.kind === 'r' ? 'boost' : SKILLS.find((x) => x.id === c.id)?.type ?? 'hit');
const autoSwitch = (action, on) => `<label class="m-switch m-sk-auto"><input type="checkbox" data-action="${action}" ${on ? 'checked' : ''}><span class="m-sw" aria-hidden="true"></span><span class="m-sw-t">Auto</span></label>`;

function phoneBar(state, cells, activeIds, armed, mode) {
  const world = worldStyle(state);
  const size = loadoutSize(state);
  const byId = (id) => cells.find((c) => c.kind === 's' && c.id === id);
  const slots = Array.from({ length: size }, (_, i) => {
    const c = byId(activeIds[i]);
    return `<button type="button" class="m-skslot${c ? '' : ' empty'}${armed === i ? ' armed' : ''}" data-action="skill-slot-pick" data-value="${i}" aria-pressed="${armed === i}"
      aria-label="${c ? `Place ${i + 1} : ${escapeHtml(c.name)}` : `Place ${i + 1} vide`}">${c ? img(c.icon) : '<b>+</b>'}<kbd>${i + 1}</kbd></button>`;
  }).join('');
  const cap = armed != null ? `<p class="m-skcap arm">${mode === 's' ? `Choisis une compétence pour la place ${armed + 1}` : 'Passe sur Attaques pour choisir la compétence'}</p>`
    : activeIds.length ? '' : '<p class="m-skcap">Apprends une attaque pour la mettre dans ta barre</p>';
  return `<div class="m-skbar" style="${world.style}"><span class="m-sklbl">Ta barre de combat</span><div class="m-skslots n${size}">${slots}</div></div>${cap}`;
}

function phoneCard(c, sel, activeIds) {
  const t = phoneType(c);
  const slot = c.kind === 's' ? activeIds.indexOf(c.id) : -1;
  const badge = slot >= 0 ? `<em class="m-skon" aria-label="Place ${slot + 1} de la barre">${slot + 1}</em>` : c.kind === 'r' && c.active > 0 ? `<em class="m-skon t">${time(c.active)}</em>` : '';
  const sub = c.locked ? `${img('icon_lock')} Niv. ${c.unlock}` : `Nv ${c.level}`;
  return `<button type="button" class="m-skc${sel ? ' sel' : ''}${c.locked ? ' locked' : ''}" style="--c:${TYPE_COLOR[t]}" data-action="skill-sel" data-value="${c.kind}:${c.id}" aria-pressed="${sel}">
    ${badge}<span class="m-skic">${img(c.icon)}</span><b>${escapeHtml(c.name)}</b><small>${sub}</small></button>`;
}

function phoneDetail(state, c, activeIds, armed) {
  if (!c) return '';
  const f = skillFacts(state, c);
  const t = phoneType(c);
  const head = `<div class="m-skdh"><span class="m-skic s" style="--c:${TYPE_COLOR[t]}">${img(c.icon)}</span>
    <div class="m-skdn"><b>${escapeHtml(c.name)}</b><span class="m-sktype">${c.kind === 'r' ? 'Boost' : TYPE_LABEL[f.type] ?? ''}</span></div>
    <span class="m-skdl">${c.maxed ? `Nv ${c.level} · max` : `Nv ${c.level} <i>»</i> <b class="good">${c.level + 1}</b>`}</span>
    <button type="button" class="m-skplay" data-action="m-set" data-key="mSkillSheet" data-value="${c.kind}:${c.id}" aria-label="Aperçu en combat">▶</button></div>`;
  const rows = f.rows.slice(0, 1).map((r) => `<div class="m-skcmp">${img(r.icon)}<span>${escapeHtml(r.label)}</span><b>${r.next ? `${escapeHtml(r.now)} <i>»</i> <span class="good">${escapeHtml(r.next)}</span>` : escapeHtml(r.now)}</b></div>`).join('');
  const pts = skillPointsAvailable(state);
  let why = '', main = '';
  if (c.locked) why = `<p class="m-skwhy">${img('icon_lock')} Débloquée au niveau ${c.unlock} du héros.</p>`;
  else if (c.maxed) why = '<p class="m-skwhy good">Niveau maximal atteint.</p>';
  else if (c.kind === 's') {
    const price = skillPointCost(c.level);
    const ok = pts >= price;
    if (!ok) why = `<p class="m-skwhy">Il manque ${price - pts} point${price - pts > 1 ? 's' : ''} · prochain au niveau ${state.level + 1}</p>`;
    main = mBtnGold(`${c.level === 0 ? 'Apprendre' : 'Améliorer'} · ${price} pt`, { action: 'learn-skill', attrs: `data-key="${escapeHtml(c.id)}"`, disabled: !ok });
  } else {
    const price = c.plus?.cost ?? 0;
    const ok = state.gold >= price;
    why = ok ? '' : '<p class="m-skwhy">Il te manque de l\'or.</p>';
    main = mBtnGold(`Améliorer · ${formatNumber(price)}`, { icon: 'coin', action: 'upgrade-rush', attrs: `data-key="${escapeHtml(c.id)}" data-cost="${price}" data-currency="gold"`, disabled: !ok });
  }
  // Seconde rangée : la barre de combat (compétence apprise) ou l'usage du Boost, et « Répartir » quand il reste des points.
  const size = loadoutSize(state);
  let bar = '';
  if (c.kind === 's' && c.level > 0 && !c.locked) {
    const at = activeIds.indexOf(c.id);
    if (at >= 0) bar = mBtn(`Retirer (place ${at + 1})`, { action: 'skill-loadout', attrs: `data-key="${escapeHtml(c.id)}"`, disabled: activeIds.length <= 1 });
    else { const slot = armed ?? (activeIds.length < size ? activeIds.length : size - 1); bar = mBtn(`Mettre en place ${slot + 1}`, { action: 'skill-slot-set', value: `${c.id}|${slot}` }); }
  } else if (c.kind === 'r' && !c.locked) {
    bar = c.active > 0 ? `<p class="m-sk-state good">Actif ${time(c.active)}</p>` : c.cd > 0 ? `<p class="m-sk-state">Prêt dans ${time(c.cd)}</p>` : mBtn('Utiliser', { action: 'rush', value: c.id });
  }
  const spread = pts > 0 ? mBtn('↺ Répartir', { action: 'distribute-skills' }) : '';
  const row2 = bar || spread ? `<div class="m-sk-row2${bar && spread ? ' two' : ''}">${bar}${spread}</div>` : '';
  return `<div class="m-card m-skdetail">${head}${rows}${why}${main}${row2}</div>`;
}

function phoneView(ui, state) {
  const cells = skillGridCells(state);
  const pts = skillPointsAvailable(state);
  const mode = ui.view.mSkillMode === 'r' ? 'r' : 's';
  const [sk, sid] = String(ui.view.mSkillSheet ?? '').split(':');
  const sheet = cells.find((c) => c.kind === sk && c.id === sid) ?? null;
  const [k, id] = String(ui.view.skillSel ?? '').split(':');
  const chosen = cells.find((c) => c.kind === k && c.id === id) ?? null;
  const inMode = cells.filter((c) => c.kind === mode);
  const sel = chosen?.kind === mode ? chosen : (mode === 's' && pts > 0 ? inMode.find((c) => !c.locked && c.plus?.can) : null) ?? inMode.find((c) => !c.locked) ?? inMode[0] ?? null;
  const activeIds = activeSkills(state).map((s) => s.id);
  const armed = Number.isInteger(ui.view.skillSlot) && ui.view.skillSlot < loadoutSize(state) ? ui.view.skillSlot : null;
  const box = (id2, label, ic, action, on) => `<div class="m-skmode${mode === id2 ? ' on' : ''}">${mModes([{ id: id2, label, icon: ic, action: 'm-set', value: id2, attrs: 'data-key="mSkillMode"' }], mode)}${autoSwitch(action, on)}</div>`;
  const modes = `<div class="m-skmodes">${box('s', 'Attaques', 'skill_quick', 'skill-auto', state.skillAuto)}${box('r', 'Boosts', 'icon_bolt', 'rush-auto', state.rushes.auto)}</div>`;
  return `<div class="m-frame m-hero m-sk">${mTitle('skill_quick', 'Compétences', true)}${ptsBanner(pts, 'm-skpts')}
    ${phoneBar(state, cells, activeIds, armed, mode)}${modes}<div class="m-skgrid">${inMode.map((c) => phoneCard(c, c === sel, activeIds)).join('')}</div>
    ${phoneDetail(state, sel, activeIds, armed)}${sheet ? phoneSheet(state, sheet) : ''}</div>`;
}

function phoneSheet(state, c) {
  const tk = c.kind === 'r' ? 'boost' : SKILLS.find((x) => x.id === c.id)?.type ?? '';
  const type = c.kind === 'r' ? 'Boost' : TYPE_LABEL[tk] ?? '';
  let short = '', now = '', next = '', main = '', use = '';
  if (c.kind === 's') {
    const skill = SKILLS.find((x) => x.id === c.id);
    const bonus = computeHeroStats(state).bonus;
    short = SKILL_SHORT[skill.id] ?? skill.name;
    now = c.level > 0 ? `${skill.text(formatDecimal(skillValue(skill, c.level)))}, toutes les ${formatDecimal(skillCooldown(skill, bonus))} s.` : '';
    next = c.maxed ? '' : skill.text(formatDecimal(skillValue(skill, c.level + 1)));
    if (c.plus) main = mBtn(`${c.level === 0 ? 'Apprendre' : 'Améliorer'} · ${c.plus.price}`, { action: 'learn-skill', attrs: `data-key="${escapeHtml(c.id)}"`, disabled: !c.plus.can });
    if (c.level > 0) { const on = activeSkills(state).some((x) => x.id === c.id); use = mBtn(on ? '✓ Active (3 au plus)' : 'Rendre active (3 au plus)', { action: 'skill-loadout', attrs: `data-key="${escapeHtml(c.id)}" aria-pressed="${on}"` }); }
  } else {
    const rush = RUSHES.find((x) => x.id === c.id);
    short = rush.id === 'phantom' ? 'Coups fantômes en plus' : effectText(rushEffect(state, rush));
    now = `Pendant ${rushDuration(state, rush)} s, recharge ${Math.round(rush.cooldown / 60)} min.`;
    if (c.plus) main = mBtn(`Améliorer · ${c.plus.price}`, { icon: 'coin', action: 'upgrade-rush', attrs: `data-key="${escapeHtml(c.id)}" data-cost="${c.plus.cost}" data-currency="gold"`, disabled: !c.plus.can });
    use = c.locked ? '' : c.active > 0 ? `<p class="m-sk-state good">Actif ${time(c.active)}</p>` : c.cd > 0 ? `<p class="m-sk-state">Prêt dans ${time(c.cd)}</p>` : mBtn('Utiliser', { action: 'rush', value: rush.id });
  }
  const why = c.plus && !c.plus.can && !c.locked && !c.maxed ? (c.kind === 's' ? 'Il te faut 1 point (1 par niveau du héros)' : "Il te manque de l'or") : '';
  const lock = c.locked ? `Débloquée au niveau ${c.unlock} du héros.` : c.maxed ? 'Niveau maximal.' : '';
  const body = `<div class="m-card m-sk-prev">${skillVignetteHtml(state, c, 160)}</div>
    <div class="m-card m-sk-info"><div class="m-sk-name"><b>${escapeHtml(c.name)}</b><span>Nv ${c.level}</span>${type ? `<em class="sk2-type t-${tk}">${type}</em>` : ''}</div>
      <p class="m-sk-short">${escapeHtml(short)}</p>
      ${now ? `<div class="m-sk-line"><small>Effet</small><b>${now}</b></div>` : ''}${next ? `<div class="m-sk-line"><small>Niveau suivant</small><b class="good">${next}</b></div>` : ''}
      ${lock ? `<p class="m-sk-lock">${img('icon_lock')} ${escapeHtml(lock)}</p>` : ''}${why ? `<p class="m-sk-why">${escapeHtml(why)}</p>` : ''}</div>
    <div class="m-sk-actions">${main}${use}</div>`;
  return mSheet(c.name, body, { id: 'mSkillSheet', icon: c.icon, close: 'm-sheet-x', back: 'm-sheet-x' });
}

// v10.17 (E) : les points à dépenser en grand (un bandeau doré tant qu'il en reste), sinon la petite mention habituelle.
function ptsBanner(pts, cls) {
  if (pts <= 0) return `<span class="${cls}" aria-label="0 point de compétence">✦ Points : <b class="num">0</b></span>`;
  return `<span class="${cls} sk-pts-big" role="status">✦ <b class="num">${pts}</b> ${pts > 1 ? 'points à dépenser' : 'point à dépenser'} <small>(+1 par niveau du héros)</small></span>`;
}

export default {
  id: 'skills',
  title: 'Compétences',
  icon: 'skill_quick',
  extra: (ui, state) => `Points : <b class="gold-text">${skillPointsAvailable(state)}</b>`,
  render(ui, state) {
    if (ui.root?.classList.contains('m-phone')) return phoneView(ui, state); // v10.12 (lot 4)
    if (pref('skillList') !== true) return deskView(ui, state); // v9.3.4 : nouvelle vue par défaut (l'ancienne liste reste en option)
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
