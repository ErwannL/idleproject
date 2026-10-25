// Missions (connexion, journalières, hebdomadaires, mensuelles) et contrats d'aventure.
import { contractLabel } from '../../core/contracts.js';
import { bonusReady, loginDay, loginReady, missionStatus, periodRemaining } from '../../core/missions.js';
import { rewardText } from '../../core/rewards.js';
import { LOGIN_CALENDAR, MISSION_PERIODS } from '../../data/missions.js';
import { escapeHtml, formatNumber, progressBar } from '../common.js';

function remainingText(ms) {
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `${Math.floor(h / 24)} j`;
  if (h >= 1) return `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
  return `${Math.max(1, Math.floor(ms / 60000))} min`;
}

function loginCard(state) {
  const day = loginDay(state);
  const ready = loginReady(state);
  const cells = LOGIN_CALENDAR.map((r, i) => {
    const st = i < day || (i === day && !ready) ? 'got' : i === day ? 'today' : '';
    return `<div class="login-day ${st}"><b>J${i + 1}</b><span>${rewardText(r, formatNumber).replaceAll(' · ', '<br>')}</span></div>`;
  }).join('');
  return `<div class="card mission-card">
    <div class="row-between"><b>Connexion quotidienne</b><span class="muted">Série : ${state.missions.login.streak} jour(s)</span></div>
    <div class="login-cal">${cells}</div>
    <button class="btn ${ready ? 'btn-gold' : ''} small" data-action="claim-login" ${ready ? '' : 'disabled'}>${ready ? 'Récupérer' : 'Revenez demain'}</button>
  </div>`;
}

function periodCard(state, period) {
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
  return `<div class="card mission-card">
    <div class="row-between"><b>Missions ${period.label.toLowerCase()}</b><span class="muted">${period.reset} · ${remainingText(periodRemaining(period.id))}</span></div>
    ${rows}${bonus}
  </div>`;
}

export default {
  id: 'contracts',
  title: 'Missions & contrats',
  icon: 'icon_trophy',
  extra: (ui, state) => `${state.records.contractsDone} contrats remplis`,
  render(ui, state) {
    const cards = state.contracts.map((c) => {
      const done = c.progress >= c.target;
      return `<div class="card contract${done ? ' done' : ''}">
        <div class="row-between"><b>${escapeHtml(contractLabel(c))}</b><span class="gold-text">${rewardText(c.reward, formatNumber)}</span></div>
        ${progressBar(c.progress / c.target, `${formatNumber(c.progress)} / ${formatNumber(c.target)}`)}
        <button class="btn ${done ? 'btn-gold' : ''} small" data-action="claim-contract" data-value="${c.id}" ${done ? '' : 'disabled'}>
          ${done ? 'Récupérer' : 'En cours…'}</button>
      </div>`;
    }).join('');
    return `${loginCard(state)}${MISSION_PERIODS.map((p) => periodCard(state, p)).join('')}
      <div class="section-title">Contrats d'aventure</div>
      <div class="muted">Les contrats progressent tout seuls pendant le farm, même hors ligne. Un nouveau contrat remplace chaque contrat rempli.</div>${cards}`;
  },
};
