// v9.3.2 : Arène des compagnons — Aventure › Arène. Deux modes SANS HÉROS :
//   Survie : un compagnon seul contre 30 vagues ; Étages : 3 compagnons/familiers contre des étages et des boss.
// v10.3.1 : les combats se jouent sur la carte (ui/arena-map.js) ; l'ancien écran à portraits est retiré.
import { ARENA } from '../../data/arena.js';
import { COMPANIONS } from '../../data/companions.js';
import { unitLevel } from '../../core/companions.js'; // v9.8 (I6) : même niveau que l'Équipe
import { GLOBAL_BOSS, globalBossLeft, globalBossState, arenaState, arenaUnlocked, companionProfile, survivalTriesLeft, survivalWave } from '../../core/arena.js';
import { ELEMENTS, elementBadge } from '../../core/elements.js';
import { escapeHtml, formatNumber, icon, img, rarityLabel, rewardIcons } from '../common.js';
import { companionStill } from './expeditions.js';
import { cardTowerHtml } from './arena-cards-view.js';
import { cardArena } from '../../core/arena-cards.js';

const MODE_LABEL = { cards: 'Tour à cartes', survival: 'Épreuve : Survie', global: 'Épreuve : Boss commun' }; // v10.1 (P4)
const SKILL_TXT = { hit: 'frappe', burst: 'zone', heal: 'soin', shield: 'bouclier', rally: 'cri', gold: 'fortune' };
const MOD_TXT = { swift: 'rapides', armored: 'blindés', frenzy: 'enragés', regen: 'régénération' };

const owned = (state) => COMPANIONS.filter((c) => state.companions.owned[c.id]);
function statLine(p) {
  return `<span class="arena-stats">❤ ${formatNumber(p.maxHp)} · ⚔ ${formatNumber(p.atk)} · 🛡 ${formatNumber(p.def)}${p.skill ? ` · ${escapeHtml(p.skill.name ?? SKILL_TXT[p.skill.type])} (${SKILL_TXT[p.skill.type]}, ${Math.round(p.skill.every)} s)` : ''}</span>`;
}
function unitCard(state, c, { selected, action, value, disabled } = {}) {
  const p = companionProfile(state, c.id);
  return `<button class="arena-unit r-${c.rarity}${selected ? ' active' : ''}" data-action="${action}" data-value="${value ?? c.id}" ${disabled ? 'disabled' : ''} title="${escapeHtml(c.name)}">
    ${companionStill(c)}<span class="arena-unit-name">${escapeHtml(c.name)} ${elementBadge(p.element, false, true)}</span>
    <small>${rarityLabel(c.rarity)} · niv. ${unitLevel(state, c.id)}</small></button>`;
}
function foesPreview(group) {
  const els = [...new Set(group.foes.map((f) => f.element))];
  return `<span>${group.boss ? '<b class="bad">BOSS</b>' : `${group.foes.length} ennemi${group.foes.length > 1 ? 's' : ''}`} · ${els.map((e) => elementBadge(e, false, true)).join('')}
    ${group.mods?.length ? ` · ${group.mods.map((m) => MOD_TXT[m]).join(', ')}` : ''}${group.cond ? ` · <b>${escapeHtml(group.cond.text)}</b>` : ''}</span>`;
}

// v9.10 (7) : choix de l'équipe (3 places) avant chaque mode d'Arène — la même pour Survie et Étages.
export function arenaTeamOf(ui, state) {
  const a = arenaState(state);
  const base = a.floors.team.length ? a.floors.team : state.companions.equipped;
  const team = (ui.view.arenaTeam ?? base).filter((id) => state.companions.owned[id]).slice(0, ARENA.floors.teamSize);
  ui.view.arenaTeam = team;
  return team;
}
function teamPicker(ui, state, team) {
  const list = owned(state);
  const slots = Array.from({ length: ARENA.floors.teamSize }, (_, i) => {
    const c = COMPANIONS.find((x) => x.id === team[i]);
    return c ? `<button class="arena-slot r-${c.rarity}" data-action="arena-team" data-value="${c.id}" title="Retirer">${companionStill(c)}<small>${escapeHtml(c.name)}</small></button>` : '<button class="arena-slot empty" data-action="arena-edit" title="Ajouter">+</button>';
  }).join('');
  const profiles = team.map((id) => companionProfile(state, id)).filter(Boolean);
  return `<div class="card arena-team-card"><div class="section-title">Ton équipe (${team.length}/${ARENA.floors.teamSize})</div>
      <div class="arena-team">${slots}</div>
      ${profiles.map((p) => `<div class="arena-pick-info">${escapeHtml(p.name)} ${elementBadge(p.element, false, true)} — ${statLine(p)}</div>`).join('')}
      ${ui.view.arenaEdit ? `<div class="arena-grid">${list.map((c) => unitCard(state, c, { selected: team.includes(c.id), action: 'arena-team', disabled: !team.includes(c.id) && team.length >= ARENA.floors.teamSize })).join('')}</div>`
        : '<button class="btn small" data-action="arena-edit">Changer l\'équipe</button>'}</div>`;
}

function survivalHtml(ui, state) {
  const a = arenaState(state);
  const team = arenaTeamOf(ui, state);
  const left = survivalTriesLeft(state);
  const best = a.survival.best;
  const next = [1, 10, 20, 30].map((n) => `<li>Vague ${n} : ${foesPreview(survivalWave(n, 1))}</li>`).join('');
  return `<div class="card"><div class="row-between"><b>Ton équipe contre ${ARENA.survival.waves} vagues</b><span>Essais : <b>${left}</b> / ${ARENA.survival.triesPerDay} aujourd'hui</span></div>
      <div class="muted">Aucun héros : 1 à 3 compagnons. Plus l'équipe est grande, plus les ennemis sont forts.</div>
      ${best ? `<div>${img('icon_trophy')} Record : <b>vague ${best.wave}</b> en ${Math.round(best.seconds)} s</div>` : ''}</div>
    ${teamPicker(ui, state, team)}
    <button class="btn btn-gold primary-action" data-action="arena-survival" ${left > 0 && team.length ? '' : 'disabled'}>⚔ Lancer la survie</button>
    <div class="card"><div class="section-title">Paliers (une fois chacun)</div><ul class="arena-miles">${ARENA.survival.milestones.map((m) => `<li class="${a.survival.claimed.includes(m.wave) ? 'done' : ''}">Vague ${m.wave} ${rewardIcons(m.reward)} ${a.survival.claimed.includes(m.wave) ? '✔' : ''}</li>`).join('')}</ul>
      <div class="section-title">Aperçu des vagues</div><ul class="arena-preview">${next}</ul></div>`;
}

// v9.3.2 : World Boss MONDIAL : une barre de PV commune à tous les joueurs (serveur). Distinct du World Boss des
// grands événements (Aventure › Événement) : pas d'écus, pas de phases d'événement comptées en points.
function globalHtml(ui, state) {
  const g = ui.globalBoss;
  const me = globalBossState(state);
  const left = globalBossLeft(state);
  const bar = g && !g.offline ? `<div class="arena-bar guild-bar"><i style="width:${Math.max(0, (g.left / g.hp) * 100)}%;background:#e84a5f"></i></div>
      <div>${formatNumber(g.left)} / ${formatNumber(g.hp)} PV restants · cycle <b>${g.cycle}</b> (chaque fois que la barre tombe, le Colosse revient)</div>`
    : `<div class="state-empty">${g?.offline ? 'Barre commune indisponible hors ligne : ta tentative compte quand même pour ton record.' : 'Chargement de la barre commune…'}</div>`;
  return `<div class="card"><div class="row-between"><b>${img('icon_boss')} ${escapeHtml(g?.name ?? 'Colosse des Anciens (mondial)')}</b><span>Tentative : <b>${left}</b> / ${GLOBAL_BOSS.attemptsPerDay} aujourd'hui</span></div>
      <div class="arena-why"><b>À quoi ça sert ?</b> Tous les joueurs frappent le même boss pendant 60 s. Chaque attaque rapporte ${rewardIcons(GLOBAL_BOSS.reward, 'named')} et compte pour ton record et le classement de ta guilde.</div>
      <div class="muted">Ton équipe de campagne combat (héros, compagnons, familier) : change-la dans Équipe.</div>
      <div class="arena-team">${[...state.companions.equipped].slice(0, 3).map((id) => { const c = COMPANIONS.find((x) => x.id === id); return c ? `<div class="arena-slot r-${c.rarity}">${companionStill(c)}<small>${escapeHtml(c.name)}</small></div>` : ''; }).join('')}</div>${bar}
      ${me.best ? `<div>${img('icon_trophy')} Ton record : <b>${formatNumber(me.best)}</b> dégâts</div>` : ''}
      <button class="btn btn-gold primary-action" data-action="global-boss" ${left > 0 ? '' : 'disabled'}>⚔ Attaquer le Colosse (60 s)</button>
      ${left > 0 ? '' : '<div class="muted">Plus d\'essai aujourd\'hui : reviens demain.</div>'}
      <div class="muted">Classement des joueurs et des guildes : Objectifs › Guilde.</div></div>`;
}

export default {
  id: 'arena',
  title: 'Arène',
  icon: 'icon_paw',
  extra: (ui, state) => (arenaUnlocked(state) ? `Étage <b class="num">${cardArena(state).best}</b>` : ''),
  render(ui, state) {
    if (!arenaUnlocked(state)) return `<div class="state-empty">L'Arène des compagnons s'ouvre à l'étape ${ARENA.unlockStage}, avec au moins un compagnon.</div>`;
    const mode = ['survival', 'global'].includes(ui.view.arenaMode) ? ui.view.arenaMode : 'cards';
    const tabs = `<div class="item-tabs" role="tablist">${Object.entries(MODE_LABEL).map(([k, l]) => `<button class="btn chip-btn small${k === mode ? ' active' : ''}" data-action="arena-mode" data-value="${k}" role="tab" aria-selected="${k === mode}">${l}</button>`).join('')}</div>`;
    return tabs + (mode === 'cards' ? cardTowerHtml(ui, state) : mode === 'global' ? globalHtml(ui, state) : survivalHtml(ui, state));
  },
};
export const ELEMENT_NAMES = Object.fromEntries(Object.entries(ELEMENTS).map(([k, v]) => [k, v.name]));
