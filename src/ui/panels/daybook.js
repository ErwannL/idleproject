// v9.8 (H1, G1-G3) : Carnet du jour — grandes cartes illustrées (grosse icône, chiffre, barre épaisse), tampon doré
// « Accompli » sur chaque carte finie, grand tampon « Journée accomplie » et coffre de fin de journée qui tremble quand
// il est prêt. Il regroupe Missions du jour et objectifs de session (plus d'écran en plus). Rien ne bouge avec
// « Réduire les animations » (on garde l'image finale).
import { DAYBOOK_CHEST, daybookComplete, daybookOf, daybookTasks } from '../../core/daybook.js';
import { sessionGoalsHtml } from '../session-goals.js';
import { escapeHtml, img, rewardIcons } from '../common.js';
import { FIRST_WEEK_PRIZE, firstWeekActive, firstWeekDay, firstWeekDaysOpen, prizeReady } from '../../core/first-week.js';
import { companionById } from '../../core/companions.js';
import { companionStill } from './expeditions.js';

// v9.8 (H5) : carnet des 7 premiers jours, en tête du Carnet du jour ; le gros lot (Épique au choix) visible dès le jour 1.
function firstWeekHtml(ui, state) {
  if (!firstWeekActive(state)) return '';
  const open = firstWeekDaysOpen(state);
  const sel = Math.min(open, Math.max(1, Number(ui.view.fwDay) || open));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = i + 1, info = firstWeekDay(state, d), ready = d <= open && !info.claimed && info.steps.every((x) => x.done);
    return `<button class="fw-day${d === sel ? ' on' : ''}${info.claimed ? ' done' : ''}${ready ? ' ready' : ''}" data-action="fw-day" data-value="${d}" ${d > open ? 'disabled' : ''}>J${d}${d > open ? ' 🔒' : info.claimed ? ' ✓' : ''}</button>`;
  }).join('');
  const day = firstWeekDay(state, sel);
  const all = day.steps.every((x) => x.done);
  const steps = day.steps.map((x) => `<li class="${x.done ? 'good' : ''}">${x.done ? '✓' : '○'} ${escapeHtml(x.text)}</li>`).join('');
  const prize = FIRST_WEEK_PRIZE.map((id) => { const c = companionById(id); return `<button class="fw-prize-c" ${prizeReady(state) ? `data-action="fw-prize" data-value="${id}"` : 'disabled'} title="${escapeHtml(c?.name ?? id)}">${c ? companionStill(c) : ''}<small>${escapeHtml(c?.name ?? id)}</small></button>`; }).join('');
  return `<div class="card fw-card"><div class="fw-head"><b>Les 7 premiers jours</b><span class="muted">Gros lot : un compagnon Épique au choix</span></div>
    <div class="fw-days">${days}</div>
    <ul class="fw-steps">${steps}</ul>
    <div class="fw-claim">${rewardIcons(day.reward, 'named')} ${day.claimed ? '<span class="good">Récupéré ✓</span>' : `<button class="btn ${all ? 'btn-gold' : ''}" data-action="fw-claim" data-value="${sel}" ${all ? '' : 'disabled'}>Récupérer</button>`}</div>
    <div class="fw-prize">${prize}</div>${prizeReady(state) ? '<p class="gold-text">Les 7 jours sont finis : choisis ton compagnon !</p>' : ''}</div>`;
}

export function daybookOpen(ui) {
  return (id) => ui.tabVisible?.[id] !== false;
}

function card(t, fresh) {
  const pct = Math.round((t.n / Math.max(1, t.target)) * 100);
  const go = t.done ? '' : t.action
    ? `<button class="btn btn-gold db-go" data-action="${t.action}">${{ 'quick-hunt': 'Chasser', 'wheel-open': 'Tourner', 'titan-start': 'Combattre' }[t.action] ?? 'Y aller'}</button>`
    : `<button class="btn btn-primary db-go" data-action="open-tab" data-value="${t.tab}">Y aller</button>`;
  return `<div class="db-card${t.done ? ' done' : ''}" data-db="${t.id}">
    <div class="db-art">${img(t.icon)}</div>
    <div class="db-body"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.text)}</small>
      <div class="db-bar"><i style="width:${pct}%"></i><span class="num">${t.n}/${t.target}</span></div></div>
    ${go}${t.done ? `<span class="db-stamp${fresh ? ' fresh' : ''}" aria-label="Accompli">Accompli</span>` : ''}</div>`;
}

export default {
  id: 'daybook',
  title: 'Carnet du jour',
  icon: 'icon_trophy',
  render(ui, state) {
    const open = daybookOpen(ui);
    // Le tampon ne s'abat qu'une fois (le panneau est redessiné chaque seconde).
    const seen = (ui.view.dbSeen ??= {});
    const fresh = (id) => { const f = !seen[id]; seen[id] = true; return f; };
    const tasks = daybookTasks(state, open);
    const doneN = tasks.filter((t) => t.done).length;
    const all = daybookComplete(state, open);
    const book = daybookOf(state);
    const chest = book.chest ? '<div class="db-chest opened">' + img('icon_chest') + '<small>Coffre ouvert · à demain !</small></div>'
      : `<button class="db-chest${all ? ' ready' : ''}" data-action="daybook-chest" ${all ? '' : 'disabled'}>${img('icon_chest')}
          <small>${all ? 'Ouvre le coffre !' : `Coffre du jour : ${doneN}/${tasks.length}`}</small>${rewardIcons(DAYBOOK_CHEST, 'named')}</button>`;
    return `${firstWeekHtml(ui, state)}<div class="db-head"><div class="db-title"><b>Carnet du jour</b><span class="num">${doneN}/${tasks.length}</span></div>
        <div class="db-path">${tasks.map((t) => `<i class="${t.done ? 'on' : ''}"></i>`).join('')}</div></div>
      <div class="db-cards">${tasks.map((t) => card(t, t.done && fresh(t.id))).join('')}</div>
      ${all ? `<div class="db-big-stamp${fresh('all') ? ' fresh' : ''}">Journée accomplie</div>` : ''}
      ${chest}
      <div class="db-session">${sessionGoalsHtml(state)}</div>`;
  },
};
