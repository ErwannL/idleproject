import { GEAR_CLASSES, gearClassOf } from '../../data/companion-gear.js'; // v9.3.5 : un seul nom de rôle (classe)
// v9.3.4 : popup de détail d'un compagnon ou d'un familier (Équipe › Composition).
// En haut l'illustration en grand sur la couleur de son élément (toucher = vitrine animée), nom, niveau, 3 chiffres,
// puis 3 onglets : Compétences (3 icônes ; toucher une icône ouvre une bulle), Équipement, Histoire. Deux boutons en
// bas. Fenêtre centrée sur PC, feuille plein écran sur téléphone. Aucune valeur d'équilibrage n'est changée ici.
import { COMPANION_RULES } from '../../data/companions.js';
import { COMPANION_ROLES, ROLES, SYNERGIES } from '../../data/synergies.js';
import { ACTIVE_EXTRA_AT, DUP_BONUS_PCT, SKILL_CAPS, SKILL_RESOURCES, ULT_UNLOCK_COPIES } from '../../data/progression.js';
import { ELEMENTS, elementBadge, unitElement } from '../../core/elements.js';
import { allCompanionSkills, companionSkillMultiplier, companionSkills, skillKillGold } from '../../core/companions.js';
import { canAfford, leveledSkill, levelMult, skillCap, skillLevels, skillUpgradeCost } from '../../core/progression.js';
import { companionProfile } from '../../core/arena.js';
import { computeHeroStats } from '../../core/stats.js';
import { skillTextAt } from '../../data/companion-skills.js';
import { effectText, escapeHtml, formatNumber, hdArt, icon, img, rarityLabel } from '../common.js';
import { showcaseSlot } from '../showcase.js';
import { companionPortrait } from './expeditions.js';

const T = (s) => Math.round(s * 10) / 10;
// Description courte (6 mots au plus) d'une compétence, d'après son type et sa recharge.
const SHORT = { hit: 'Frappe un ennemi', burst: 'Frappe tous les ennemis', heal: "Soigne l'équipe", shield: "Protège l'équipe", rally: "Renforce l'équipe", gold: "Fait tomber de l'or" };
export const shortSkill = (sk) => `${SHORT[sk.type] ?? 'Effet spécial'}, toutes les ${T(sk.every)} s`;
const PASSIVE_SHORT = { damagePct: 'Plus de dégâts', maxHpPct: 'Plus de vie', goldPct: "Plus d'or", critChance: 'Plus de critiques', attackSpeedPct: "Plus de vitesse", armor: 'Plus d\'armure', regenPct: 'Régénère la vie', xpPct: "Plus d'expérience", lifesteal: 'Vol de vie', dropChance: 'Plus de butin', damageVsBossPct: 'Plus fort contre les boss' };
export const shortPassive = (c) => PASSIVE_SHORT[Object.keys(c.passive)[0]] ?? 'Bonus permanent';

// Profil d'un compagnon même non obtenu (aperçu au niveau 1, 1 copie).
function profile(state, c) {
  const owned = state.companions.owned[c.id];
  if (owned) return companionProfile(state, c.id);
  return companionProfile({ ...state, companions: { ...state.companions, owned: { [c.id]: { stars: 1, level: 1 } } }, companionGear: null }, c.id);
}

function skillIcons(ui, state, c, own) {
  const lv = skillLevels(own);
  const list = allCompanionSkills(c.id);
  const act = list.find((s) => !s.ultimate), ult = list.find((s) => s.ultimate);
  const cards = [
    ['passive', 'Passif', 'icon_upgrade', shortPassive(c), lv.passive],
    ['active', act.name, 'skill_quick', shortSkill(leveledSkill(act, 'active', lv.active)), lv.active],
    ...(ult ? [['ultimate', ult.name, 'icon_star', shortSkill(leveledSkill(ult, 'ultimate', lv.ultimate)), lv.ultimate]] : []),
  ];
  return `<div class="up-skills">${cards.map(([k, name, ic, desc, l]) => `<button class="up-skill${ui.view.skillPop === k ? ' active' : ''} k-${k}" data-action="skill-pop" data-value="${k}" aria-expanded="${ui.view.skillPop === k}">
      <span class="up-skill-ic">${img(ic)}<i class="up-lv">Nv ${l}</i></span><b>${escapeHtml(name)}</b><small>${escapeHtml(desc)}</small></button>`).join('')}</div>`;
}

// Bulle d'une compétence : effet, différence au niveau suivant, déblocages à venir, bouton Améliorer.
function skillBubble(ui, state, c, own, mine) {
  const kind = ui.view.skillPop;
  if (!kind) return '';
  const lv = skillLevels(own)[kind];
  const cap = skillCap(own, kind);
  const list = allCompanionSkills(c.id);
  const mult = (sk) => companionSkillMultiplier(state, c, sk.type, false, undefined, own);
  let now, next = '', locks = [];
  if (kind === 'passive') {
    const pct = (l) => Math.round((levelMult('passive', l) - 1) * 100);
    now = `${effectText(c.passive)}, renforcé de +${pct(lv)} %.`;
    if (lv < cap) next = `Renfort +${pct(lv)} % → <b class="good">+${pct(lv + 1)} %</b>`;
  } else {
    const sk = kind === 'active' ? list.find((s) => !s.ultimate) : list.find((s) => s.ultimate);
    const a = leveledSkill(sk, kind, lv), b = lv < cap ? leveledSkill(sk, kind, lv + 1) : null;
    now = `${escapeHtml(skillTextAt(a, mult(a)))}, toutes les ${T(a.every)} s.`;
    if (b) {
      const diff = [];
      const va = skillTextAt(a, mult(a)).match(/\d+/)?.[0], vb = skillTextAt(b, mult(b)).match(/\d+/)?.[0];
      if (va !== vb) diff.push(`${va} → <b class="good">${vb}</b>`);
      if (T(a.every) !== T(b.every)) diff.push(`recharge ${T(a.every)} s → <b class="good">${T(b.every)} s</b>`);
      if ((a.duration ?? 0) !== (b.duration ?? 0)) diff.push(`durée ${a.duration} s → <b class="good">${b.duration} s</b>`);
      next = diff.join(' · ');
    }
    if (kind === 'active') list.filter((s) => !s.ultimate).slice(1).forEach((s, i) => { if (lv < ACTIVE_EXTRA_AT[i]) locks.push(`Nv ${ACTIVE_EXTRA_AT[i]} : ajoute ${escapeHtml(s.name)}`); });
    if (kind === 'ultimate' && cap < SKILL_CAPS.ultimate) locks.push(`Nv 6 à 10 : ${ULT_UNLOCK_COPIES}e copie`);
  }
  const lackText = (st, cost) => {
    const k = Object.keys(SKILL_RESOURCES).find((r) => (st.materials[r] ?? 0) < (cost[r] ?? 0));
    if (k) { const n = cost[k] - (st.materials[k] ?? 0); return `Il manque ${n} ${n > 1 ? SKILL_RESOURCES[k].short : SKILL_RESOURCES[k].name}`; }
    return st.gold < cost.gold ? `Il manque ${formatNumber(Math.ceil(cost.gold - st.gold))} or` : '';
  };
  const cost = mine ? skillUpgradeCost(own, kind, skillKillGold(state)) : null;
  const res = cost && Object.entries(SKILL_RESOURCES).find(([k]) => cost[k] > 0);
  const btn = !mine ? '' : cost
    ? `<button class="btn btn-gold" data-action="skill-up" data-value="${c.id}|${kind}" ${canAfford(state, cost) ? '' : `disabled data-why="${escapeHtml(lackText(state, cost))}"`}>Améliorer ${res ? `${img(res[1].icon)} ${cost[res[0]]}` : ''} ${img('coin')} ${formatNumber(cost.gold)}</button>
       ${Object.keys(SKILL_RESOURCES).filter((k) => cost[k] > 0).map((k) => `<button class="btn tiny res-chip${(state.materials[k] ?? 0) < cost[k] ? ' bad' : ''}" data-action="res-info" data-value="${k}" title="Où en trouver ?">${img(SKILL_RESOURCES[k].icon)} ${formatNumber(state.materials[k] ?? 0)}/${cost[k]} ?</button>`).join('')}`
    : `<span class="good">${lv >= SKILL_CAPS[kind] ? 'Niveau maximal' : 'Plafond atteint'}</span>`;
  return `<div class="up-bubble" role="dialog" aria-label="Détail de la compétence">
      <div class="row-between"><b>Nv ${lv} / ${cap}</b><button class="btn tiny" data-action="skill-pop" data-value="" aria-label="Fermer">✕</button></div>
      <p>${now}</p>${next ? `<p class="up-next">Niveau suivant : ${next}</p>` : ''}
      ${locks.map((l) => `<p class="up-lock">🔒 ${l}</p>`).join('')}${btn}</div>`;
}

function historyTab(state, c) {
  const role = COMPANION_ROLES[c.id];
  const el = ELEMENTS[unitElement(c.id)];
  const syn = role ? SYNERGIES.filter((s) => s.roles.includes(role)) : [];
  return `<div class="up-history">
    ${role ? `<p><b>${GEAR_CLASSES[gearClassOf(c)].label}</b> — ${escapeHtml(c.kind === 'ally' ? 'compagnon' : 'familier')} de l'élément ${escapeHtml(el?.name ?? '')}. Synergies : <b style="color:${ROLES[role].color}">${ROLES[role].label}</b>.</p>` : `<p>Familier de l'élément ${escapeHtml(el?.name ?? '')}.</p>`}
    ${syn.length ? `<div class="section-title">Synergies</div>${syn.map((s) => `<p><b>${escapeHtml(s.name)}</b> : ${escapeHtml(s.text)}</p>`).join('')}` : ''}</div>`;
}

// ctx : { actions (HTML des 2 boutons), gear (fonction → HTML de l'onglet Équipement) }.
export function unitPopup(ui, state, c, { actions, gear }) {
  const owned = state.companions.owned[c.id];
  const own = owned ?? { stars: 1, level: 1 };
  const el = unitElement(c.id);
  const role = COMPANION_ROLES[c.id];
  const p = profile(state, c);
  const hero = computeHeroStats(state);
  const dps = companionSkills({ ...state, companions: { ...state.companions, owned: { ...state.companions.owned, [c.id]: own } } }, c.id)
    .filter((sk) => sk.type === 'hit' || sk.type === 'burst').reduce((s, sk) => s + (hero.damage * sk.value * companionSkillMultiplier(state, c, sk.type, false, undefined, own)) / sk.every, 0);
  const copies = Math.min(COMPANION_RULES.maxCopies, own.stars ?? 1);
  const nextStep = copies < COMPANION_RULES.maxCopies ? `Prochaine copie : +${DUP_BONUS_PCT[copies]} % aux stats${copies + 1 === ULT_UNLOCK_COPIES ? ', ultime Nv 6 à 10' : ''}` : 'Copies au maximum';
  const tab = ['skills', 'gear', 'story'].includes(ui.view.unitTab) && !(ui.view.unitTab === 'gear' && c.kind !== 'ally') ? ui.view.unitTab : 'skills';
  const tabs = [['skills', 'Compétences'], ...(owned && c.kind === 'ally' ? [['gear', 'Équipement']] : []) /* v9.3.8 : familier sans équipement */, ['story', 'Histoire']]
    .map(([k, l]) => `<button class="btn chip-btn${k === tab ? ' active' : ''}" data-action="unit-tab" data-value="${k}" role="tab" aria-selected="${k === tab}">${l}</button>`).join('');
  const art = hdArt(c, 'up-art') || companionPortrait(c, true);
  const body = tab === 'gear' && owned ? gear() : tab === 'story' ? historyTab(state, c)
    : `${skillIcons(ui, state, c, own)}${skillBubble(ui, state, c, own, Boolean(owned))}`;
  return `<div class="unit-pop-backdrop" data-action="close-sheet"></div>
  <div class="unit-pop r-${c.rarity}" role="dialog" aria-modal="true" aria-label="${escapeHtml(c.name)}">
    <button class="btn small up-close" data-action="close-sheet" aria-label="Fermer">✕</button>
    <div class="up-hero el-${el}" style="--ec:${ELEMENTS[el]?.color ?? '#5a6a90'}">
      ${ui.view.unitShow === c.id ? showcaseSlot('unit', c.id) : `<button class="up-art-btn" data-action="unit-show" data-value="${c.id}" aria-label="Voir l'animation">${owned ? art : `<span class="up-silhouette">${art}</span>`}</button>`}
      <div class="up-pills"><span class="rar-pill r-${c.rarity}">${rarityLabel(c.rarity)}</span>${elementBadge(el)}<span class="role-pill"${role ? ` style="--rc:${ROLES[role].color}"` : ''}>${GEAR_CLASSES[gearClassOf(c)].label}</span></div>
      <div class="up-stars" aria-label="${copies} copies sur ${COMPANION_RULES.maxCopies}">${'★'.repeat(copies - 1)}<span>${'★'.repeat(COMPANION_RULES.maxCopies - copies)}</span></div>
    </div>
    <div class="up-title"><b>${escapeHtml(c.name)}</b><span>${owned ? `Nv ${owned.level} / ${COMPANION_RULES.maxLevel}` : 'Pas encore obtenu'}</span></div>
    ${owned ? '' : '<div class="up-where">Où l\'obtenir : Équipe › Invocation</div>'}
    <div class="up-stats"><span title="Dégâts par seconde de ses compétences">⚔ <b>${formatNumber(dps)}</b><small>Dégâts</small></span>
      <span>❤ <b>${formatNumber(p?.maxHp ?? 0)}</b><small>Vie</small></span>
      <span>⚡ <b>${T(1 / (p?.interval ?? 1))}/s</b><small>Vitesse</small></span></div>
    ${owned ? `<div class="up-copies"><span>Copies</span><div class="arena-bar"><i style="width:${(copies / COMPANION_RULES.maxCopies) * 100}%;background:var(--gold)"></i></div><b>${copies} / ${COMPANION_RULES.maxCopies}</b><small class="muted">${nextStep}</small></div>` : ''}
    <div class="up-tabs" role="tablist">${tabs}</div>
    <div class="up-body">${body}</div>
    <div class="up-actions">${actions}</div>
  </div>`;
}
