// Carte du monde : zones reliées par un chemin, étapes de la zone choisie, avance automatique.
import { BALANCE } from '../../data/balance.js';
import { ZONES } from '../../data/zones.js';
import { isBossStage, stageLabel, zoneIndexForStage } from '../../core/combat.js';
import { escapeHtml, img } from '../common.js';

// Positions des zones sur la carte peinte (assets/ui/worldmap.png, générée par tools/art/worldmap.py).
const MAP_NODES = [
  { x: 0.13, y: 0.72 },
  { x: 0.3, y: 0.38 },
  { x: 0.47, y: 0.74 },
  { x: 0.62, y: 0.38 },
  { x: 0.78, y: 0.7 },
  { x: 0.9, y: 0.32 },
];

export default {
  id: 'campaign',
  title: 'Carte du monde',
  icon: 'icon_map',
  extra: (ui, state) => `Étape max ${stageLabel(state.maxStage)}`,
  render(ui, state) {
    const per = BALANCE.stages.stagesPerZone;
    const currentZone = zoneIndexForStage(state.stage);
    const lastZone = zoneIndexForStage(state.maxStage);
    const sel = Number.isInteger(ui.view.zoneSel) && ui.view.zoneSel <= lastZone ? ui.view.zoneSel : currentZone;
    const markers = ZONES.map((zone, i) => {
      const locked = i > lastZone;
      const cleared = state.maxStage > (i + 1) * per;
      const n = MAP_NODES[i];
      return `<button class="map-node${locked ? ' locked' : ''}${i === sel ? ' selected' : ''}${i === currentZone ? ' current' : ''}"
        style="left:${n.x * 100}%;top:${n.y * 100}%" data-action="zone-sel" data-value="${i}" ${locked ? 'disabled' : ''}>
        <span class="map-label">${escapeHtml(zone.name)}<small>${locked ? 'Bloqué' : cleared ? 'Terminé' : `${i * per + 1}–${(i + 1) * per}`}</small></span>
      </button>`;
    }).join('');
    const first = sel * per + 1;
    const last = sel === ZONES.length - 1 ? Math.max(first + per - 1, state.maxStage + 1) : first + per - 1;
    const buttons = [];
    for (let stage = first; stage <= last; stage++) {
      const classes = ['btn', isBossStage(stage) ? 'boss' : '', stage === state.stage && !state.dungeon ? 'current' : '', stage < state.maxStage ? 'cleared' : ''].join(' ');
      buttons.push(`<button class="${classes}" data-action="stage" data-stage="${stage}" ${stage > state.maxStage ? 'disabled' : ''}
        title="${isBossStage(stage) ? 'Boss' : 'Étape'} ${stageLabel(stage)}">${stage - first + 1}${isBossStage(stage) ? img('icon_skull') : ''}</button>`);
    }
    return `<div class="world-map"><img class="px" src="assets/ui/worldmap.png" alt="Carte du monde">${markers}</div>
      <div class="card zone-card">
        <div class="row-between"><b>${sel + 1}. ${escapeHtml(ZONES[sel].name)}</b>
          <label class="toggle"><input type="checkbox" data-action="auto" ${state.autoAdvance ? 'checked' : ''}> Avancer automatiquement</label></div>
        <div class="stage-grid">${buttons.join('')}</div>
        ${state.autoAdvance ? '' : `<div class="row-between"><span class="muted">Mode farm : le chevalier reste sur l'étape actuelle.</span>
          <button class="btn btn-primary small" data-action="advance">Avancer ▶</button></div>`}
      </div>`;
  },
};
