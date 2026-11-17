import { BG } from '../../render/bg.js';
import { ZONES } from '../../data/zones.js';
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { ZONE_ELEMENT } from '../../core/elements.js';
// v9.3.2 : Arène des compagnons — Aventure › Arène. Deux modes SANS HÉROS :
//   Survie : un compagnon seul contre 30 vagues ; Étages : 3 compagnons/familiers contre des étages et des boss.
// Le combat est calculé d'un coup (core/arena.js) puis rejoué ici (événements horodatés), en accéléré.
import { ARENA } from '../../data/arena.js';
import { COMPANIONS } from '../../data/companions.js';
import { unitLevel } from '../../core/companions.js'; // v9.8 (I6) : même niveau que l'Équipe
import { GLOBAL_BOSS, globalBossLeft, globalBossState, arenaState, arenaUnlocked, companionProfile, floorReward, floorSetup, survivalTriesLeft, survivalWave } from '../../core/arena.js';
import { ELEMENTS, elementBadge } from '../../core/elements.js';
import { escapeHtml, formatNumber, icon, img, rarityLabel, rewardIcons } from '../common.js';
import { companionPortrait, companionStill } from './expeditions.js';

const REPLAY_SECONDS = 12; // durée maximale de la relecture
const MODE_LABEL = { survival: 'Survie', floors: 'Étages', global: 'Boss commun' };
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

// Relecture : état du combat à l'instant t (PV des alliés et des ennemis, derniers coups).
function replayAt(run, t) {
  const hp = Object.fromEntries(run.team.map((p) => [p.id, p.maxHp]));
  let wave = null, foes = [], last = [];
  for (const e of run.fight.events) {
    if (e.t > t) break;
    if (e.kind === 'wave') { wave = e; foes = e.foes.map((f) => ({ ...f, hp: f.maxHp })); }
    else if ((e.kind === 'hit' || e.kind === 'skill') && foes[e.foe]) foes[e.foe].hp = Math.max(0, foes[e.foe].hp - e.d);
    else if (e.kind === 'hurt') hp[e.who] = Math.max(0, hp[e.who] - e.d);
    else if (e.kind === 'heal') for (const id of Object.keys(hp)) { const p = run.team.find((x) => x.id === id); if (hp[id] > 0) hp[id] = Math.min(p.maxHp, hp[id] + p.maxHp * 0.25); }
    if (['hit', 'skill', 'heal', 'shield', 'rally', 'kill', 'fall'].includes(e.kind) && e.t > t - 0.6) last.push(e);
  }
  return { hp, wave, foes, last: last.slice(-4) };
}
const bar = (r, color) => `<span class="arena-bar"><i style="width:${Math.max(0, Math.min(100, r * 100))}%;background:${color}"></i></span>`;
// v9.3.5 : monde dont l'élément est celui des ennemis (choisi par le numéro d'étage / de vague) et son monstre.
function foeZone(element, seed) {
  const zs = ZONE_ELEMENT.map((e, i) => [e, i]).filter(([e]) => e === element).map(([, i]) => i);
  return zs.length ? zs[seed % zs.length] : 0;
}
function foeSprite(f, i, seed) {
  const z = ZONES[foeZone(f.element, seed)] ?? ZONES[0];
  if (f.boss) { const b = BOSSES[z.bosses?.[0]]; return b?.sprite ?? 'icon_boss'; }
  const id = z.enemies[(i + seed) % z.enemies.length];
  return ENEMIES[id]?.sprite ?? 'icon_skull';
}

function replayHtml(ui, state) {
  const run = ui.view.arenaRun;
  const span = Math.max(0.1, run.fight.seconds);
  const speed = Math.max(1, span / REPLAY_SECONDS);
  const t = Math.min(span, ((performance.now() - run.start) / 1000) * speed);
  const done = t >= span;
  const s = replayAt(run, t);
  const name = (id) => COMPANIONS.find((c) => c.id === id)?.name ?? id;
  const allies = run.team.map((p) => {
    const c = COMPANIONS.find((x) => x.id === p.id);
    const hurt = s.last.some((e) => e.kind === 'hurt' && e.who === p.id);
    const acts = s.last.some((e) => (e.kind === 'hit' || e.kind === 'skill') && e.who === p.id);
    return `<div class="arena-ally${s.hp[p.id] <= 0 ? ' down' : ''}${hurt ? ' hurt' : ''}${acts ? ' acts' : ''}">${companionPortrait(c, true)}<b>${escapeHtml(p.name)}</b>${bar(s.hp[p.id] / p.maxHp, '#5ad07a')}</div>`;
  }).join('');
  // v9.3.5 : vrais monstres de la campagne (monde de l'élément des ennemis) au lieu de têtes de mort.
  const seed = run.floor ?? s.wave?.n ?? 1;
  const zi = foeZone(s.foes[0]?.element, seed);
  const foes = s.foes.map((f, i) => `<div class="arena-foe${f.hp <= 0 ? ' down' : ''}${f.boss ? ' boss' : ''}${s.last.some((e) => (e.kind === 'hit' || e.kind === 'skill') && e.foe === i) ? ' hit' : ''}"><img class="px foe-art" src="${icon(foeSprite(f, i, seed), f.boss ? 3 : 2)}" alt=""> ${elementBadge(f.element, false, true)}${bar(f.hp / f.maxHp, '#e84a5f')}</div>`).join('');
  const log = s.last.map((e) => {
    const el = e.elem > 1 ? ' <b class="adv">Efficace !</b>' : e.elem < 1 ? ' <b class="disadv">Résiste</b>' : '';
    if (e.kind === 'hit' || e.kind === 'skill') return `<li>${escapeHtml(name(e.who))} : ${e.kind === 'skill' ? `<b>${SKILL_TXT[e.type]}</b> ` : ''}${formatNumber(Math.round(e.d))}${e.crit ? ' (critique)' : ''}${el}</li>`;
    if (e.kind === 'heal' || e.kind === 'shield' || e.kind === 'rally') return `<li>${escapeHtml(name(e.who))} : <b>${SKILL_TXT[e.kind]}</b></li>`;
    if (e.kind === 'fall') return `<li class="bad">${escapeHtml(name(e.who))} est à terre</li>`;
    return '<li>Ennemi vaincu</li>';
  }).join('');
  const head = run.mode === 'survival' ? `Vague <b>${s.wave ? s.wave.n : 1}</b> / ${ARENA.survival.waves}${done && !run.won ? ' <span class="bad">(perdue)</span>' : ''}` : `Étage <b>${run.floor}</b>`;
  const result = !done ? '' : run.mode === 'survival'
    ? `<div class="card arena-result"><b class="gold-text">${run.wave} vague${run.wave > 1 ? 's' : ''} terminée${run.wave > 1 ? 's' : ''}</b> en ${Math.round(run.seconds)} s · ${run.kills} ennemis vaincus${run.won ? ' — <b class="good">30 vagues terminées !</b>' : ''}
        ${run.rewards.length ? `<div>Paliers atteints : ${run.rewards.map((m) => `vague ${m.wave} ${rewardIcons(m.reward)}`).join(' · ')}</div>` : ''}</div>`
    : `<div class="card arena-result">${run.won ? `<b class="good">Étage ${run.floor} franchi !</b> ${rewardIcons(run.reward)}` : `<b class="bad">Étage ${run.floor} non franchi.</b> Renforce ou change l'équipe (types, soins, boucliers).`}</div>`;
  return `<div class="card arena-replay"><div class="row-between"><span>${head}</span>
      <button class="btn small" data-action="arena-close">${done ? 'Fermer' : 'Passer ⏭'}</button></div>
    <div class="arena-field arena-stage" style="--sky:${(BG[ZONES[zi]?.id] ?? BG.plains).sky.join(',')};background-image:url('assets/bg/${(BG[ZONES[zi]?.id] ?? BG.plains).layers.find((l) => l.anchor === 'ground')?.file ?? ''}'), linear-gradient(${(BG[ZONES[zi]?.id] ?? BG.plains).sky.join(',')});--ground:${(BG[ZONES[zi]?.id] ?? BG.plains).ground}"><div class="arena-side">${allies}</div><div class="arena-vs">VS</div><div class="arena-side foes">${foes}</div></div>
    <ul class="arena-log">${log}</ul></div>${result}`;
}

function survivalHtml(ui, state) {
  const a = arenaState(state);
  const list = owned(state);
  // v9.3.5 : par défaut, le premier compagnon de l'équipe de campagne.
  // v9.8 (I8) : par défaut un compagnon (pas le familier), le plus fort de l'équipe.
  const sel = list.find((c) => c.id === ui.view.arenaPick) ?? list.find((c) => c.kind === 'ally' && state.companions.equipped.includes(c.id)) ?? list.find((c) => c.kind === 'ally') ?? list[0];
  const p = sel && companionProfile(state, sel.id);
  const left = survivalTriesLeft(state);
  const best = a.survival.best;
  const next = [1, 10, 20, 30].map((n) => `<li>Vague ${n} : ${foesPreview(survivalWave(n, 1))}</li>`).join('');
  return `<div class="card"><div class="row-between"><b>Choisis un compagnon : seul contre ${ARENA.survival.waves} vagues</b><span>Essais : <b>${left}</b> / ${ARENA.survival.triesPerDay} aujourd'hui</span></div>
      <div class="muted">Aucun héros : le compagnon combat seul, avec ses PV, son attaque et sa compétence. Le type compte dans les deux sens.</div>
      ${best ? `<div>${img('icon_trophy')} Meilleur résultat : <b>vague ${best.wave}</b> en ${Math.round(best.seconds)} s (${escapeHtml(COMPANIONS.find((c) => c.id === best.companion)?.name ?? '')})</div>` : ''}</div>
    <div class="card"><div class="section-title">Choisir le compagnon</div><div class="arena-grid">${list.map((c) => unitCard(state, c, { selected: c.id === sel?.id, action: 'arena-pick' })).join('')}</div>
      ${p ? `<div class="arena-pick-info">${elementBadge(p.element, true)}<br>${statLine(p)}</div>` : ''}
      <button class="btn btn-gold primary-action" data-action="arena-survival" data-value="${sel?.id ?? ''}" ${left > 0 && sel ? '' : 'disabled'}>Lancer la survie</button></div>
    <div class="card"><div class="section-title">Paliers (une fois chacun)</div><ul class="arena-miles">${ARENA.survival.milestones.map((m) => `<li class="${a.survival.claimed.includes(m.wave) ? 'done' : ''}">Vague ${m.wave} ${rewardIcons(m.reward)} ${a.survival.claimed.includes(m.wave) ? '✔' : ''}</li>`).join('')}</ul>
      <div class="section-title">Aperçu des vagues</div><ul class="arena-preview">${next}</ul></div>`;
}

function floorsHtml(ui, state) {
  const a = arenaState(state);
  const list = owned(state);
  // v9.3.5 : une seule équipe par défaut — celle de la campagne ; « Modifier » pour les joueurs avancés.
  const base = a.floors.team.length ? a.floors.team : state.companions.equipped;
  const team = (ui.view.arenaTeam ?? base).filter((id) => state.companions.owned[id]).slice(0, ARENA.floors.teamSize);
  ui.view.arenaTeam = team;
  const f = a.floors.best + 1;
  const setup = floorSetup(f);
  const slots = Array.from({ length: ARENA.floors.teamSize }, (_, i) => {
    const c = COMPANIONS.find((x) => x.id === team[i]);
    return c ? `<button class="arena-slot r-${c.rarity}" data-action="arena-team" data-value="${c.id}" title="Retirer">${companionStill(c)}<small>${escapeHtml(c.name)}</small></button>` : '<div class="arena-slot empty">+</div>';
  }).join('');
  const profiles = team.map((id) => companionProfile(state, id)).filter(Boolean);
  return `<div class="card"><div class="row-between"><b>Une équipe de ${ARENA.floors.teamSize} compagnons ou familiers</b><span>${img('icon_trophy')} Record : <b>étage ${a.floors.best}</b></span></div>
      <div class="muted">Aucun héros. Étages permanents ; un boss tous les 10 étages, une contrainte tous les 5. Chaque étage rapporte sa récompense une seule fois.</div></div>
    <div class="card"><div class="section-title">Étage ${f} ${rewardIcons(floorReward(f))}</div><div>${foesPreview(setup)}</div>
      <div class="arena-team">${slots}</div>
      ${profiles.map((p) => `<div class="arena-pick-info">${escapeHtml(p.name)} ${elementBadge(p.element, false, true)} — ${statLine(p)}</div>`).join('')}
      <button class="btn btn-gold primary-action" data-action="arena-floor" ${profiles.length ? '' : 'disabled'}>Combattre l'étage ${f}</button></div>
    ${ui.view.arenaEdit ? `<div class="card"><div class="section-title">Ajouter à l'équipe</div><div class="arena-grid">${list.map((c) => unitCard(state, c, { selected: team.includes(c.id), action: 'arena-team', disabled: !team.includes(c.id) && team.length >= ARENA.floors.teamSize })).join('')}</div></div>`
      : '<button class="btn small" data-action="arena-edit">Modifier l\'équipe</button>'}`;
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
      <div class="muted">Tous les joueurs frappent le même boss : tes dégâts s'ajoutent à ceux de la communauté. Ton équipe habituelle (héros, compagnons, familier) combat 60 s.
      Différent du World Boss des grands événements (Aventure › Événement).</div>${bar}
      ${me.best ? `<div>${img('icon_trophy')} Ton record : <b>${formatNumber(me.best)}</b> dégâts</div>` : ''}
      <button class="btn btn-gold primary-action" data-action="global-boss" ${left > 0 ? '' : 'disabled'}>⚔ Attaquer ${rewardIcons(GLOBAL_BOSS.reward)}</button>
      ${left > 0 ? '' : '<div class="muted">Plus d\'essai aujourd\'hui : reviens demain.</div>'}
      <div class="muted">Classement des joueurs et des guildes : Objectifs › Guilde.</div></div>`;
}

export default {
  id: 'arena',
  title: 'Arène',
  icon: 'icon_paw',
  extra: (ui, state) => (arenaUnlocked(state) ? `Étage <b class="num">${arenaState(state).floors.best}</b>` : ''),
  render(ui, state) {
    if (!arenaUnlocked(state)) return `<div class="state-empty">L'Arène des compagnons s'ouvre à l'étape ${ARENA.unlockStage}, avec au moins un compagnon.</div>`;
    const mode = ['floors', 'global'].includes(ui.view.arenaMode) ? ui.view.arenaMode : 'survival';
    const tabs = `<div class="item-tabs" role="tablist">${Object.entries(MODE_LABEL).map(([k, l]) => `<button class="btn chip-btn small${k === mode ? ' active' : ''}" data-action="arena-mode" data-value="${k}" role="tab" aria-selected="${k === mode}">${l}</button>`).join('')}</div>`;
    if (ui.view.arenaRun) return tabs + replayHtml(ui, state);
    return tabs + (mode === 'floors' ? floorsHtml(ui, state) : mode === 'global' ? globalHtml(ui, state) : survivalHtml(ui, state));
  },
};
export const ELEMENT_NAMES = Object.fromEntries(Object.entries(ELEMENTS).map(([k, v]) => [k, v.name]));
