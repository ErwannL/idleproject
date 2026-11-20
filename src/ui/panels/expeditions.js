// Équipe > Expéditions (v9.1.0, sorti de Compagnons) : 3 places ; les compagnons hors de l'équipe partent 1 h, 4 h
// ou 12 h (elles avancent aussi jeu fermé). D'abord : places, temps restant, Tout récupérer, Repartir.
import { ROLES } from '../../data/synergies.js'; // v9.6.2
import { companionById, duplicates } from '../../core/companions.js';
import {
  EXPEDITION_TYPES, availableForExpedition, expeditionDone, expeditionReward, expeditionType, readyExpeditions, relaunchable,
} from '../../core/expeditions.js';
import { formatDuration } from '../../core/format.js';
import { escapeHtml, icon, progressBar, rewardIcons, segment } from '../common.js';
import { animCanvas } from '../animator.js';

export function companionPortrait(c, big = false) {
  if (c.kind === 'ally') return animCanvas(`foe:${c.sprite}`, 64, 56, big ? 2 : 1);
  return animCanvas(`pet:${c.sprite}`, big ? 26 : 24, big ? 26 : 24, 2);
}

// v9.1.3 (décision portraits) : image fixe dans les grilles et listes ; seule l'unité sélectionnée est animée.
export function companionStill(c) {
  return `<img class="px still" src="${icon(c.sprite, c.kind === 'ally' ? 1 : 3)}" alt="">`;
}

// v9.1.3 (doc1 « Expéditions ») : une ligne par place. La durée est commune (choisie en haut) ; « Durée par place »
// ajoute un petit choix sur chaque ligne. Plus de formulaire répété à 3 boutons par place.
// v9.3.5 (bug 2) : un compagnon n'est proposé que dans UNE place libre (choix des places précédentes retirés).
function defaultPicks(ui, state) {
  const out = [];
  const taken = new Set();
  state.expeditions.slots.forEach((run, i) => {
    if (run) return;
    const free = availableForExpedition(state).filter((c) => !taken.has(c.id));
    const last = state.expeditions.last?.[i];
    const pick = free.some((c) => c.id === ui.view.expPick?.[i]) ? ui.view.expPick[i]
      : free.some((c) => c.id === last?.companionId) ? last.companionId : free[0]?.id ?? null;
    if (pick) taken.add(pick);
    out[i] = { pick, free: availableForExpedition(state).filter((c) => c.id === pick || !taken.has(c.id)) };
  });
  return out;
}
function slotHtml(ui, state, run, i, now, dur) {
  if (!run) {
    const dp = defaultPicks(ui, state)[i] ?? { pick: null, free: [] };
    const free = dp.free;
    if (!free.length || !dp.pick) return `<div class="exp-slot empty"><span class="muted">Place ${i + 1} libre : aucun compagnon disponible (ceux de l'équipe ne partent pas).</span></div>`;
    const pick = dp.pick;
    const type = ui.view.expPerSlot && EXPEDITION_TYPES.some((t) => t.id === ui.view.expDurSlot?.[i]) ? ui.view.expDurSlot[i] : dur;
    const durSel = ui.view.expPerSlot ? `<select class="exp-dur-sel" data-action="exp-dur-slot" data-slot="${i}" aria-label="Durée, place ${i + 1}">${EXPEDITION_TYPES.map((t) => `<option value="${t.id}" ${t.id === type ? 'selected' : ''}>${t.hours} h</option>`).join('')}</select>` : '';
    return `<div class="exp-slot empty">
        <div class="exp-who">${companionStill(companionById(pick))}</div>
        <div class="grow exp-form"><select data-action="exp-pick" data-slot="${i}" aria-label="Compagnon à envoyer, place ${i + 1}">${free.map((c) => `<option value="${c.id}" ${c.id === pick ? 'selected' : ''}>${escapeHtml(c.name)} ${duplicates(state.companions.owned[c.id])}★</option>`).join('')}</select>${durSel}
          <div class="exp-gain"><small>Gains attendus</small> ${rewardIcons(expeditionReward(state, pick, type), 'named')}</div></div>
        <button class="btn btn-primary small" data-action="start-expedition" data-value="${pick}|${type}|${i}">Envoyer</button>
      </div>`;
  }
  const c = companionById(run.companionId);
  const type = expeditionType(run.type);
  const done = expeditionDone(run, now);
  const ratio = Math.min(1, (now - run.start) / (run.end - run.start));
  return `<div class="exp-slot${done ? ' done' : ''}">
      <div class="exp-who">${companionStill(c)}</div>
      <div class="grow"><b>${escapeHtml(c.name)}</b> <span class="muted">· ${type.hours} h</span>
        ${progressBar(ratio, done ? 'Terminée !' : `encore ${formatDuration((run.end - now) / 1000)}`, done ? 'xp' : '')}
        <div class="exp-gain"><small>${done ? 'À récupérer' : 'Gains attendus'}</small> ${rewardIcons(run.reward, 'named')}</div></div>
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
    const dur = EXPEDITION_TYPES.some((t) => t.id === ui.view.expDur) ? ui.view.expDur
      : state.expeditions.last?.find((l) => l?.type)?.type ?? EXPEDITION_TYPES[0].id;
    const free = state.expeditions.slots.some((r) => !r) && availableForExpedition(state).length;
    const durRow = free ? `<div class="exp-dur">${segment(EXPEDITION_TYPES.map((t) => [t.id, `${t.hours} h`]), 'exp-dur', dur, 'aria-label="Durée"')}
        <button class="btn small${ui.view.expPerSlot ? ' active' : ''}" data-action="exp-per-slot" aria-pressed="${Boolean(ui.view.expPerSlot)}">Durée par place</button></div>` : '';
    const actions = `<div class="options-row main-actions">
        <button class="btn btn-gold primary-action" data-action="claim-all-expeditions" ${ready ? '' : 'disabled'}>Tout récupérer${ready ? ` (${ready})` : ''}</button>
        <button class="btn btn-gold" data-action="send-all-expeditions" data-value="${dur}" title="Chaque place libre reçoit le compagnon libre le mieux adapté">Tout envoyer</button>
        <button class="btn" data-action="relaunch-expeditions" ${again ? '' : 'disabled'} title="Relance la dernière expédition de chaque place libre (même compagnon, même durée)">Repartir${again ? ` (${again})` : ''}</button></div>`;
    const slots = state.expeditions.slots.map((run, i) => slotHtml(ui, state, run, i, now, dur)).join('');
    const prefer = `<div class="muted exp-prefer">Mission préférée : ${expeditionType(dur).roles.map((r) => ROLES[r].label).join(' et ')} (+30 % de butin) ; élément du monde actuel : +20 %.</div>`; // v9.6.2
    // v10.2 (P3) : carte du monde — chaque compagnon parti marche sur la carte (avancée = temps écoulé).
    const walkers = state.expeditions.slots.map((run, i) => {
      if (!run) return '';
      const c = companionById(run.companionId);
      if (!c) return '';
      const span = Math.max(1, (run.end ?? now) - (run.start ?? (run.end ?? now) - 3600000));
      const p = Math.max(0, Math.min(1, 1 - ((run.end ?? now) - now) / span));
      return `<span class="exp-walker${p >= 1 ? ' back' : ''}" style="left:${8 + p * 78}%;top:${28 + (i % 3) * 22}%">${companionStill(c)}</span>`;
    }).join('');
    const map = `<div class="exp-map" style="background-image:url(assets/ui/art98/expedition_map.png)">${walkers || '<span class="exp-map-empty">Aucun compagnon en route : envoie-en un !</span>'}</div>`;
    return `<div class="card">${map}${actions}${durRow}${prefer}<div class="exp-list">${slots}</div></div>`;
  },
};
