// Carte du monde : zones reliées par un chemin, étapes de la zone choisie, avance automatique.
import { BALANCE } from '../../data/balance.js';
import { ZONES } from '../../data/zones.js';
import { bossesForStage, bossTierForStage, cycleForStage, stageLabel, stagesPerCycle, zoneIndexForStage, zoneLength, zoneStartStage } from '../../core/combat.js';
import { BOSSES } from '../../data/enemies.js';

const TIER_LABELS = { mini: 'Mini-boss', mid: 'Boss', hard: 'Boss redoutable', mega: 'MÉGA BOSS' };
import { bossForecast, escapeHtml, fold, forecastHtml, img, progressBar } from '../common.js';
import { bossRetryPct } from '../../core/guide.js';

// v9.0.6 : écran Aventure — « où j'en suis » en un coup d'œil : monde et étape, prochain boss, prévision,
// avance automatique et la prochaine chose utile à faire (un clic ouvre le bon écran).
function summary(ui, state) {
  if (state.dungeon || state.tower || state.challenge) {
    return `<div class="card adv-summary"><b>${state.dungeon ? 'Donjon en cours' : state.tower ? 'Tour de l\'Éternité en cours' : 'Défi de la semaine en cours'}</b>
      <span class="muted">— la campagne reprend à la fin (bouton rouge sous la scène pour revenir).</span></div>`;
  }
  const zi = zoneIndexForStage(state.stage);
  const zone = ZONES[zi];
  const first = Math.floor((state.stage - 1) / stagesPerCycle()) * stagesPerCycle() + zoneStartStage(zi);
  const pos = state.stage - first + 1;
  const len = zoneLength(zone);
  let next = state.stage;
  while (!bossTierForStage(next) && next < first + len) next++;
  const tier = bossTierForStage(next);
  const boss = tier ? BOSSES[bossesForStage(next)[0]] : null;
  return `<div class="card adv-summary">
      <div class="row-between"><div><div class="adv-zone">${zi + 1}. ${escapeHtml(zone.name)}</div>
        <div class="muted">Étape ${pos} / ${len}${boss ? ` · ${next === state.stage ? 'boss en cours' : `prochain boss dans ${next - state.stage} étape${next - state.stage > 1 ? 's' : ''}`} : <b>${escapeHtml(boss.name)}</b> (${TIER_LABELS[tier]})` : ''}</div></div>
        <div class="adv-auto">${state.autoAdvance ? '<span class="good">▶ Avance automatique</span>' : '<button class="btn btn-primary small" data-action="advance">Avancer ▶</button>'}</div></div>
      ${progressBar(pos / len, `${pos} / ${len}`)}
      ${forecastHtml(bossForecast(state, () => ui.invalidate()))}
      ${retryBox(state)}
    </div>`;
}

// Boss trop fort (v9.1.0) : c'est normal, et on le dit ; le bouton pour le retenter reste ici aussi.
function retryBox(state) {
  const r = state.bossRetry;
  if (!r || state.stage !== r.stage - 1) return '';
  const pct = bossRetryPct(state);
  return `<div class="retry-box"><div><b>Boss trop fort pour l'instant.</b> Normal : le héros s'entraîne à l'étape d'avant et retentera seul.
      Pour aller plus vite : améliorez vos dégâts.</div>
    <button class="btn btn-gold small" data-action="retry-boss">Retenter le boss (${pct >= 100 ? 'prêt' : `${pct} %`})</button></div>`;
}

// Positions des zones sur la carte peinte (assets/ui/worldmap.png, générée par tools/art/worldmap.py).
// (tools/art/worldmap_nodes.json, positions relatives des 11 régions sur la carte peinte)
let mapCenteredAt = null;
const MAP_NODES = [
  { x: 0.09, y: 0.8 },
  { x: 0.18, y: 0.56 },
  { x: 0.29, y: 0.82 },
  { x: 0.41, y: 0.6 },
  { x: 0.53, y: 0.84 },
  { x: 0.65, y: 0.62 },
  { x: 0.78, y: 0.84 },
  { x: 0.91, y: 0.58 },
  { x: 0.81, y: 0.3 },
  { x: 0.61, y: 0.28 },
  { x: 0.38, y: 0.3 },
];

export default {
  id: 'campaign',
  title: 'Carte',
  icon: 'icon_map',
  extra: (ui, state) => `Étape max ${stageLabel(state.maxStage)}`,
  afterRender(ui, body) {
    const vp = body.querySelector('.map-viewport');
    if (!vp) return;
    const zoom = ui.view.mapZoom ?? 1;
    const restore = () => {
      if (mapCenteredAt !== zoom) {
        // Nouveau zoom : on centre la vue sur la zone sélectionnée.
        mapCenteredAt = zoom;
        const n = MAP_NODES[Number(vp.dataset.sel)] ?? { x: 0.5, y: 0.5 };
        vp.scrollLeft = n.x * vp.scrollWidth - vp.clientWidth / 2;
        vp.scrollTop = n.y * vp.scrollHeight - vp.clientHeight / 2;
      } else if (ui.view.mapScroll) {
        [vp.scrollLeft, vp.scrollTop] = ui.view.mapScroll;
      }
    };
    const pic = vp.querySelector('img');
    if (!pic) return;
    if (pic.complete) restore(); else pic.addEventListener('load', restore, { once: true });
    vp.addEventListener('scroll', () => { ui.view.mapScroll = [vp.scrollLeft, vp.scrollTop]; });
    vp.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      body.querySelector(`[data-action="map-zoom"][data-value="${e.deltaY < 0 ? 'in' : 'out'}"]`)?.click();
    }, { passive: false });
    // Glisser la carte pour la déplacer quand elle est zoomée.
    let drag = null;
    vp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.map-node')) return;
      drag = { x: e.clientX, y: e.clientY, l: vp.scrollLeft, t: vp.scrollTop };
      vp.setPointerCapture(e.pointerId);
      vp.classList.add('dragging');
    });
    vp.addEventListener('pointermove', (e) => {
      if (!drag) return;
      vp.scrollLeft = drag.l - (e.clientX - drag.x);
      vp.scrollTop = drag.t - (e.clientY - drag.y);
    });
    const stop = () => { drag = null; vp.classList.remove('dragging'); };
    vp.addEventListener('pointerup', stop);
    vp.addEventListener('pointercancel', stop);
  },
  render(ui, state) {
    const cyc = stagesPerCycle();
    // Difficulté affichée : celle choisie (×1, ×2…) parmi celles atteintes, par défaut celle de l'étape actuelle.
    const maxCycle = cycleForStage(state.maxStage);
    const cycle = Number.isInteger(ui.view.cycleSel) && ui.view.cycleSel <= maxCycle ? ui.view.cycleSel : cycleForStage(state.stage);
    const offset = cycle * cyc;
    const currentZone = cycleForStage(state.stage) === cycle ? zoneIndexForStage(state.stage) : -1;
    const lastZone = cycle < maxCycle ? ZONES.length - 1 : zoneIndexForStage(state.maxStage);
    const sel = Number.isInteger(ui.view.zoneSel) && ui.view.zoneSel <= lastZone ? ui.view.zoneSel : Math.max(0, currentZone);
    const markers = ZONES.map((zone, i) => {
      const locked = i > lastZone;
      const cleared = state.maxStage >= offset + zoneStartStage(i) + zoneLength(zone);
      const n = MAP_NODES[i];
      return `<button class="map-node${locked ? ' locked' : ''}${i === sel ? ' selected' : ''}${i === currentZone ? ' current' : ''}"
        style="left:${n.x * 100}%;top:${n.y * 100}%" data-action="zone-sel" data-value="${i}" ${locked ? 'disabled' : ''}>
        <span class="map-label">${escapeHtml(zone.name)}<small>${locked ? 'Bloqué' : cleared ? 'Terminé' : `1–${zoneLength(zone)}`}</small></span>
      </button>`;
    }).join('');
    const first = offset + zoneStartStage(sel);
    const buttons = [];
    for (let stage = first; stage < first + zoneLength(ZONES[sel]); stage++) {
      const tier = bossTierForStage(stage);
      const classes = ['btn', tier ? `boss tier-${tier}` : '', stage === state.stage && !state.dungeon ? 'current' : '', stage < state.maxStage ? 'cleared' : ''].join(' ');
      const title = tier ? `${TIER_LABELS[tier]} : ${BOSSES[bossesForStage(stage)[0]].name}` : 'Étape';
      buttons.push(`<button class="${classes}" data-action="stage" data-stage="${stage}" ${stage > state.maxStage ? 'disabled' : ''}
        title="${escapeHtml(title)} · ${stageLabel(stage)}">${stage - first + 1}${tier ? img('icon_skull') : ''}</button>`);
    }
    // v9.1.0 : d'abord le résumé, le choix du monde et de la difficulté, la liste d'étapes ; la grande carte est
    // repliée derrière un bouton (sa largeur suit le panneau, zoom 50–250 %).
    const zoom = ui.view.mapZoom ?? 1;
    const worldPicker = `<div class="world-picker">
        <button class="btn small" data-action="zone-sel" data-value="${sel - 1}" ${sel > 0 ? '' : 'disabled'} aria-label="Monde précédent">◀</button>
        <select data-action="zone-select" aria-label="Monde">${ZONES.map((z, i) => `<option value="${i}" ${i === sel ? 'selected' : ''} ${i > lastZone ? 'disabled' : ''}>${i + 1}. ${escapeHtml(z.name)}${i > lastZone ? ' (bloqué)' : ''}</option>`).join('')}</select>
        <button class="btn small" data-action="zone-sel" data-value="${sel + 1}" ${sel < lastZone ? '' : 'disabled'} aria-label="Monde suivant">▶</button>
        ${maxCycle > 0 ? `<select data-action="cycle-select" aria-label="Cycle">${Array.from({ length: maxCycle + 1 }, (_, c) => `<option value="${c}" ${c === cycle ? 'selected' : ''}>Cycle ×${c + 1}</option>`).join('')}</select>` : ''}
      </div>`;
    const tools = `<div class="tree-tools map-tools"><button class="btn small" data-action="map-zoom" data-value="out" aria-label="Dézoomer">−</button>
        <span class="muted">${Math.round(zoom * 100)} %</span>
        <button class="btn small" data-action="map-zoom" data-value="in" aria-label="Zoomer">+</button>
        <button class="btn small" data-action="map-zoom" data-value="reset" aria-label="Taille normale">⟲</button></div>`;
    const map = () => `${tools}<div class="map-viewport" data-sel="${sel}"><div class="world-map" style="width:${Math.round(zoom * 100)}%">
      <img class="px" src="assets/ui/worldmap.png" alt="Carte du monde">${markers}</div></div>`;
    return `${summary(ui, state)}
      <div class="card zone-card">
        ${worldPicker}
        <div class="row-between"><span>${cycle ? `<b class="bad">Cycle ×${cycle + 1}</b>` : ''}</span>
          <label class="toggle"><input type="checkbox" data-action="auto" ${state.autoAdvance ? 'checked' : ''}> Avancer automatiquement</label></div>
        <div class="stage-grid">${buttons.join('')}</div>
      </div>
      ${fold(ui, 'world-map', 'Grande carte du monde', map)}`;
  },
};
