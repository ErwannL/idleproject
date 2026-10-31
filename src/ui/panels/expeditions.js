// Équipe > Expéditions (v9.1.0, sorti de Compagnons) : 3 places ; les compagnons hors de l'équipe partent 1 h, 4 h
// ou 12 h (elles avancent aussi jeu fermé). D'abord : places, temps restant, Tout récupérer, Repartir.
import { companionById } from '../../core/companions.js';
import {
  EXPEDITION_TYPES, availableForExpedition, expeditionDone, expeditionReward, expeditionType, readyExpeditions, relaunchable,
} from '../../core/expeditions.js';
import { rewardText } from '../../core/rewards.js';
import { formatDuration } from '../../core/format.js';
import { escapeHtml, formatNumber, progressBar, rarityLabel, stars } from '../common.js';
import { animCanvas } from '../animator.js';

export function companionPortrait(c, big = false) {
  if (c.kind === 'ally') return animCanvas(`foe:${c.sprite}`, 64, 56, big ? 2 : 1);
  return animCanvas(`pet:${c.sprite}`, big ? 26 : 24, big ? 26 : 24, 2);
}

function slotHtml(ui, state, run, i, now) {
  if (!run) {
    const free = availableForExpedition(state);
    if (!free.length) return `<div class="exp-slot empty"><span class="muted">Place ${i + 1} libre — aucun compagnon disponible (ceux de l'équipe ne partent pas).</span></div>`;
    const last = state.expeditions.last?.[i];
    const pick = free.some((c) => c.id === ui.view.expPick?.[i]) ? ui.view.expPick[i]
      : free.some((c) => c.id === last?.companionId) ? last.companionId : free[i % free.length].id;
    // La récompense prévue est écrite en clair (avant : seulement au survol).
    return `<div class="exp-slot empty"><div class="grow">
        <label class="muted">Place ${i + 1} : <select data-action="exp-pick" data-slot="${i}" aria-label="Compagnon à envoyer, place ${i + 1}">${free.map((c) => `<option value="${c.id}" ${c.id === pick ? 'selected' : ''}>${escapeHtml(c.name)} (${rarityLabel(c.rarity)} · ${stars(state.companions.owned[c.id].stars).replace(/<[^>]+>/g, '')})</option>`).join('')}</select></label>
        <div class="exp-types">${EXPEDITION_TYPES.map((t) => `<div class="exp-type"><button class="btn small" data-action="start-expedition" data-value="${pick}|${t.id}|${i}">${t.label} · ${t.hours} h</button>
          <span class="muted">${rewardText(expeditionReward(state, pick, t.id), formatNumber)}</span></div>`).join('')}</div></div></div>`;
  }
  const c = companionById(run.companionId);
  const type = expeditionType(run.type);
  const done = expeditionDone(run, now);
  const ratio = Math.min(1, (now - run.start) / (run.end - run.start));
  return `<div class="exp-slot${done ? ' done' : ''}">
      <div class="exp-who">${companionPortrait(c)}</div>
      <div class="grow"><b>${escapeHtml(c.name)}</b> <span class="muted">· ${type.label} (${type.hours} h)</span>
        ${progressBar(ratio, done ? 'Terminée !' : `encore ${formatDuration((run.end - now) / 1000)}`, done ? 'xp' : '')}
        <div class="exp-reward">${rewardText(run.reward, formatNumber)}</div></div>
      ${done ? `<button class="btn btn-gold small" data-action="claim-expedition" data-value="${i}">Récupérer</button>`
        : `<button class="btn small" data-action="recall-expedition" data-value="${i}">Rappeler</button>`}
    </div>`;
}

export default {
  id: 'expeditions',
  title: 'Expéditions',
  icon: 'icon_chest',
  extra: (ui, state) => `${state.expeditions.slots.filter(Boolean).length}/${state.expeditions.slots.length}`,
  render(ui, state) {
    const now = Date.now();
    const ready = readyExpeditions(state, now);
    const again = relaunchable(state);
    const actions = `<div class="options-row main-actions">
        <button class="btn btn-gold primary-action" data-action="claim-all-expeditions" ${ready ? '' : 'disabled'}>Tout récupérer${ready ? ` (${ready})` : ''}</button>
        <button class="btn" data-action="relaunch-expeditions" ${again ? '' : 'disabled'}>Repartir${again ? ` (${again})` : ''}</button></div>
      ${ready || again ? '' : '<div class="muted">Repartir relance la dernière expédition de chaque place libre (même compagnon, même durée).</div>'}`;
    const slots = state.expeditions.slots.map((run, i) => slotHtml(ui, state, run, i, now)).join('');
    return `<div class="card">${actions}</div><div class="card exp-list">${slots}</div>
      <div class="muted">${state.expeditions.done} expédition${state.expeditions.done > 1 ? 's' : ''} terminée${state.expeditions.done > 1 ? 's' : ''}. Rappeler une expédition l'abandonne, sans récompense.</div>`;
  },
};
