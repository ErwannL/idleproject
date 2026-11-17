// v9.8 (H1, G1-G3) : Carnet du jour — grandes cartes illustrées (grosse icône, chiffre, barre épaisse), tampon doré
// « Accompli » sur chaque carte finie, grand tampon « Journée accomplie » et coffre de fin de journée qui tremble quand
// il est prêt. Il regroupe Missions du jour et objectifs de session (plus d'écran en plus). Rien ne bouge avec
// « Réduire les animations » (on garde l'image finale).
import { DAYBOOK_CHEST, daybookComplete, daybookOf, daybookTasks } from '../../core/daybook.js';
import { sessionGoalsHtml } from '../session-goals.js';
import { escapeHtml, img, rewardIcons } from '../common.js';

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
    return `<div class="db-head"><div class="db-title"><b>Carnet du jour</b><span class="num">${doneN}/${tasks.length}</span></div>
        <div class="db-path">${tasks.map((t) => `<i class="${t.done ? 'on' : ''}"></i>`).join('')}</div></div>
      <div class="db-cards">${tasks.map((t) => card(t, t.done && fresh(t.id))).join('')}</div>
      ${all ? `<div class="db-big-stamp${fresh('all') ? ' fresh' : ''}">Journée accomplie</div>` : ''}
      ${chest}
      <div class="db-session">${sessionGoalsHtml(state)}</div>`;
  },
};
