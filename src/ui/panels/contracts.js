// Contrats d'aventure : 3 objectifs actifs, sans compte à rebours.
import { contractLabel } from '../../core/contracts.js';
import { rewardText } from '../../core/rewards.js';
import { escapeHtml, formatNumber, progressBar } from '../common.js';

export default {
  id: 'contracts',
  title: "Contrats d'aventure",
  icon: 'icon_trophy',
  extra: (ui, state) => `${state.records.contractsDone} remplis`,
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
    return `<div class="muted">Les contrats progressent tout seuls pendant le farm, même hors ligne. Un nouveau contrat remplace chaque contrat rempli.</div>${cards}`;
  },
};
