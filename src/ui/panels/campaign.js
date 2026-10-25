// Carte du monde : zones reliées par un chemin, étapes de la zone choisie, avance automatique.
import { BALANCE } from '../../data/balance.js';
import { ZONES } from '../../data/zones.js';
import { bossesForStage, bossTierForStage, cycleForStage, stageLabel, stagesPerCycle, zoneIndexForStage } from '../../core/combat.js';
import { BOSSES } from '../../data/enemies.js';

const TIER_LABELS = { mini: 'Mini-boss', mid: 'Boss', hard: 'Boss redoutable', mega: 'MÉGA BOSS' };
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
    const cyc = stagesPerCycle();
    // Difficulté affichée : celle choisie (×1, ×2…) parmi celles atteintes, par défaut celle de l'étape actuelle.
    const maxCycle = cycleForStage(state.maxStage);
    const cycle = Number.isInteger(ui.view.cycleSel) && ui.view.cycleSel <= maxCycle ? ui.view.cycleSel : cycleForStage(state.stage);
    const offset = cycle * cyc;
    const currentZone = cycleForStage(state.stage) === cycle ? zoneIndexForStage(state.stage) : -1;
    const lastZone = cycle < maxCycle ? ZONES.length - 1 : zoneIndexForStage(state.maxStage);
    const sel = Number.isInteger(ui.view.zoneSel) && ui.view.zoneSel <= lastZone ? ui.view.zoneSel : Math.max(0, currentZone);
    const cycles = maxCycle > 0 ? `<div class="chip-row cycle-row">${Array.from({ length: maxCycle + 1 }, (_, c) => `<button class="btn chip-btn${c === cycle ? ' active' : ''}"
      data-action="cycle-sel" data-value="${c}">Difficulté ×${c + 1}</button>`).join('')}</div>` : '';
    const markers = ZONES.map((zone, i) => {
      const locked = i > lastZone;
      const cleared = state.maxStage > offset + (i + 1) * per;
      const n = MAP_NODES[i];
      return `<button class="map-node${locked ? ' locked' : ''}${i === sel ? ' selected' : ''}${i === currentZone ? ' current' : ''}"
        style="left:${n.x * 100}%;top:${n.y * 100}%" data-action="zone-sel" data-value="${i}" ${locked ? 'disabled' : ''}>
        <span class="map-label">${escapeHtml(zone.name)}<small>${locked ? 'Bloqué' : cleared ? 'Terminé' : `1–${per}`}</small></span>
      </button>`;
    }).join('');
    const first = offset + sel * per + 1;
    const buttons = [];
    for (let stage = first; stage < first + per; stage++) {
      const tier = bossTierForStage(stage);
      const classes = ['btn', tier ? `boss tier-${tier}` : '', stage === state.stage && !state.dungeon ? 'current' : '', stage < state.maxStage ? 'cleared' : ''].join(' ');
      const title = tier ? `${TIER_LABELS[tier]} : ${BOSSES[bossesForStage(stage)[0]].name}` : 'Étape';
      buttons.push(`<button class="${classes}" data-action="stage" data-stage="${stage}" ${stage > state.maxStage ? 'disabled' : ''}
        title="${escapeHtml(title)} · ${stageLabel(stage)}">${stage - first + 1}${tier ? img('icon_skull') : ''}</button>`);
    }
    return `${cycles}<div class="world-map"><img class="px" src="assets/ui/worldmap.png" alt="Carte du monde">${markers}</div>
      <div class="card zone-card">
        <div class="row-between"><b>${sel + 1}. ${escapeHtml(ZONES[sel].name)}${cycle ? ` <span class="bad">×${cycle + 1}</span>` : ''}</b>
          <label class="toggle"><input type="checkbox" data-action="auto" ${state.autoAdvance ? 'checked' : ''}> Avancer automatiquement</label></div>
        <div class="stage-grid">${buttons.join('')}</div>
        ${state.autoAdvance ? '' : `<div class="row-between"><span class="muted">Mode farm : le chevalier reste sur l'étape actuelle.</span>
          <button class="btn btn-primary small" data-action="advance">Avancer ▶</button></div>`}
      </div>`;
  },
};
