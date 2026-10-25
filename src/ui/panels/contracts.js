// Missions (connexion, journalières, hebdomadaires, mensuelles) et contrats d'aventure.
import { contractLabel } from '../../core/contracts.js';
import { bonusReady, loginDay, loginReady, missionsClaimable, missionStatus, periodRemaining } from '../../core/missions.js';
import { rewardText } from '../../core/rewards.js';
import { LOGIN_CALENDAR, MISSION_PERIODS } from '../../data/missions.js';
import { escapeHtml, formatNumber, progressBar } from '../common.js';

// Section repliable : l'en-tête montre un résumé (missions prêtes) et déplie le contenu au clic.
function section(ui, id, title, summary, body, ready = 0) {
  const open = !ui.view.closed.has(id);
  return `<div class="card fold${open ? ' open' : ''}">
    <button class="fold-head" data-action="toggle-section" data-value="${id}">
      <span class="fold-arrow">${open ? '▾' : '▸'}</span><b>${title}</b>
      ${ready ? `<i class="fold-ready">${ready}</i>` : ''}<span class="muted fold-sum">${summary}</span></button>
    ${open ? `<div class="fold-body">${body}</div>` : ''}
  </div>`;
}

function remainingText(ms) {
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `${Math.floor(h / 24)} j`;
  if (h >= 1) return `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
  return `${Math.max(1, Math.floor(ms / 60000))} min`;
}

function loginCard(ui, state) {
  const day = loginDay(state);
  const ready = loginReady(state);
  const cells = LOGIN_CALENDAR.map((r, i) => {
    const st = i < day || (i === day && !ready) ? 'got' : i === day ? 'today' : '';
    return `<div class="login-day ${st}"><b>J${i + 1}</b><span>${rewardText(r, formatNumber).replaceAll(' · ', '<br>')}</span></div>`;
  }).join('');
  return section(ui, 'login', 'Connexion quotidienne', `Série : ${state.missions.login.streak} jour(s)`, `
    <div class="login-cal">${cells}</div>
    <button class="btn ${ready ? 'btn-gold' : ''} small" data-action="claim-login" ${ready ? '' : 'disabled'}>${ready ? 'Récupérer' : 'Revenez demain'}</button>`, ready ? 1 : 0);
}

function periodCard(ui, state, period) {
  const run = state.missions[period.id];
  const rows = period.missions.map((m) => {
    const st = missionStatus(state, period.id, m);
    const btn = st.claimed ? '<span class="good">✔</span>'
      : `<button class="btn ${st.done ? 'btn-gold' : ''} small" data-action="claim-mission" data-value="${period.id}|${m.id}" ${st.done ? '' : 'disabled'}>${st.done ? 'Récupérer' : '…'}</button>`;
    return `<div class="mission${st.claimed ? ' claimed' : ''}">
      <div class="row-between"><span>${escapeHtml(m.label)}</span><span class="gold-text">${rewardText(m.reward, formatNumber)}</span></div>
      <div class="mission-line">${progressBar(st.progress / m.target, `${formatNumber(st.progress)} / ${formatNumber(m.target)}`)}${btn}</div>
    </div>`;
  }).join('');
  const ready = bonusReady(state, period.id);
  const bonus = `<div class="mission-bonus row-between"><span>Coffre (toutes les missions) : <b class="gold-text">${rewardText(period.bonus, formatNumber)}</b></span>
    ${run.bonus ? '<span class="good">✔</span>' : `<button class="btn ${ready ? 'btn-gold' : ''} small" data-action="claim-mission-bonus" data-value="${period.id}" ${ready ? '' : 'disabled'}>Ouvrir</button>`}</div>`;
  const done = period.missions.filter((m) => missionStatus(state, period.id, m).claimed).length;
  const readyCount = period.missions.filter((m) => { const st = missionStatus(state, period.id, m); return st.done && !st.claimed; }).length + (ready ? 1 : 0);
  return section(ui, period.id, `Missions ${period.label.toLowerCase()}`,
    `${done}/${period.missions.length} · ${remainingText(periodRemaining(period.id))}`,
    `<div class="muted">${period.reset}</div>${rows}${bonus}`, readyCount);
}

export default {
  id: 'contracts',
  title: 'Missions & contrats',
  icon: 'icon_trophy',
  extra: (ui, state) => `${state.records.contractsDone} contrats remplis`,
  render(ui, state) {
    const cards = state.contracts.map((c) => {
      const done = c.progress >= c.target;
      return `<div class="contract${done ? ' done' : ''}">
        <div class="row-between"><b>${escapeHtml(contractLabel(c))}</b><span class="gold-text">${rewardText(c.reward, formatNumber)}</span></div>
        ${progressBar(c.progress / c.target, `${formatNumber(c.progress)} / ${formatNumber(c.target)}`)}
        <button class="btn ${done ? 'btn-gold' : ''} small" data-action="claim-contract" data-value="${c.id}" ${done ? '' : 'disabled'}>
          ${done ? 'Récupérer' : 'En cours…'}</button>
      </div>`;
    }).join('');
    const contractsReady = state.contracts.filter((c) => c.progress >= c.target).length;
    const any = missionsClaimable(state) || contractsReady > 0;
    return `<button class="btn ${any ? 'btn-gold' : ''} claim-all" data-action="claim-all" ${any ? '' : 'disabled'}>Tout récupérer</button>
      ${loginCard(ui, state)}${MISSION_PERIODS.map((p) => periodCard(ui, state, p)).join('')}
      ${section(ui, 'contracts', "Contrats d'aventure", `${state.contracts.length} actifs`,
        `<div class="muted">Les contrats progressent tout seuls pendant le farm, même hors ligne. Un nouveau contrat remplace chaque contrat rempli.</div>${cards}`, contractsReady)}`;
  },
};
