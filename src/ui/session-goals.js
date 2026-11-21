// v9.6.5 (9.5) : carte « Objectifs de session » (3 objectifs, coffre quand les trois sont remplis).
import { SESSION_CHEST, goalProgress, sessionDone } from '../core/session-goals.js';
import { progressBar } from './common.js';

// v9.8 (C1) : pastille à 3 icônes au bord de la scène (objectifs de session), ouverte au toucher.
const GOAL_ICON = { stages: '🏰', kills: '🗡️', bossesDefeated: '👑', bosses: '👑', guards: '🛡️', manualCasts: '✨', recycled: '♻', equips: '🎽', summons: '🔮', tower: '🗼', dungeons: '🗝️' };
export function sessionGoalsPill(state) {
  const s = state?.sessionGoals;
  if (!s || s.claimed) return '';
  return s.goals.map((g) => { const p = goalProgress(state, g); return `<span class="${p >= g.target ? 'done' : ''}">${GOAL_ICON[g.key ?? g.id] ?? '★'} ${p}/${g.target}</span>`; }).join('');
}
// v10.4 (partie 7) : chaque objectif a son illustration (celles des missions, art101).
const GOAL_ART = { stages: 'stages', kills: 'kills', bossesDefeated: 'bosses', bosses: 'bosses', guards: 'upgrades', manualCasts: 'skills', recycled: 'recycle', equips: 'items', summons: 'summons', tower: 'tower', dungeons: 'dungeons' };
export function sessionGoalsHtml(state) {
  const s = state?.sessionGoals;
  if (!s) return '';
  const rows = s.goals.map((g) => {
    const p = goalProgress(state, g);
    return `<div class="m-row${p >= g.target ? ' ready' : ''}"><span class="m-icon sg-icon"><img class="px" src="assets/ui/art101/mis_${GOAL_ART[g.key ?? g.id] ?? 'kills'}.png" alt=""></span><span class="grow">${g.label}</span>${progressBar(p / g.target, `${p} / ${g.target}`, p >= g.target ? 'xp' : '')}</div>`;
  }).join('');
  const btn = s.claimed ? '<span class="good">Coffre ouvert ✓</span>'
    : `<button class="btn btn-gold small" data-action="claim-session-chest" ${sessionDone(state) ? '' : 'disabled'}>Coffre : +${SESSION_CHEST.gems} gemmes, +${SESSION_CHEST.shards} éclats</button>`;
  return `<div class="card m-body session-goals"><div class="section-title">Objectifs de session</div>${rows}<div class="options-row">${btn}</div></div>`;
}
