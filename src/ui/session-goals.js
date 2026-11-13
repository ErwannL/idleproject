// v9.6.5 (9.5) : carte « Objectifs de session » (3 objectifs, coffre quand les trois sont remplis).
import { SESSION_CHEST, goalProgress, sessionDone } from '../core/session-goals.js';
import { progressBar } from './common.js';

export function sessionGoalsHtml(state) {
  const s = state.sessionGoals;
  if (!s) return '';
  const rows = s.goals.map((g) => {
    const p = goalProgress(state, g);
    return `<div class="m-row${p >= g.target ? ' ready' : ''}"><span class="grow">${g.label}</span>${progressBar(p / g.target, `${p} / ${g.target}`, p >= g.target ? 'xp' : '')}</div>`;
  }).join('');
  const btn = s.claimed ? '<span class="good">Coffre ouvert ✓</span>'
    : `<button class="btn btn-gold small" data-action="claim-session-chest" ${sessionDone(state) ? '' : 'disabled'}>Coffre : +${SESSION_CHEST.gems} gemmes, +${SESSION_CHEST.shards} éclats</button>`;
  return `<div class="card m-body session-goals"><div class="section-title">Objectifs de session</div>${rows}<div class="options-row">${btn}</div></div>`;
}
