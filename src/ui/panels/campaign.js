// Carte du monde : zones reliées par un chemin, étapes de la zone choisie, avance automatique.
import { BALANCE } from '../../data/balance.js';
import { ZONES } from '../../data/zones.js';
import { bossesForStage, bossTierForStage, cycleForStage, stageLabel, stagesPerCycle, zoneIndexForStage, zoneLength, zoneStartStage } from '../../core/combat.js';
import { BOSSES } from '../../data/enemies.js';

const TIER_LABELS = { mini: 'Mini-boss', mid: 'Boss', hard: 'Boss redoutable', mega: 'MÉGA BOSS' };
import { escapeHtml, img } from '../common.js';

// Positions des zones sur la carte peinte (assets/ui/worldmap.png, générée par tools/art/worldmap.py).
// (tools/art/worldmap_nodes.json, positions relatives des 11 régions sur la carte peinte)
let mapCenteredAt = null;
// Largeur de la carte à 100 % (comme l'arbre de talents : taille fixe, zoom 50–250 %, fenêtre qui défile).
const MAP_PX = 720;
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
  title: 'Carte du monde',
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
    const cycles = maxCycle > 0 ? `<div class="chip-row cycle-row">${Array.from({ length: maxCycle + 1 }, (_, c) => `<button class="btn chip-btn${c === cycle ? ' active' : ''}"
      data-action="cycle-sel" data-value="${c}">Difficulté ×${c + 1}</button>`).join('')}</div>` : '';
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
    // Zoom (boutons, molette sur la carte) : la carte s'agrandit dans une fenêtre qu'on fait défiler.
    const zoom = ui.view.mapZoom ?? 1;
    const tools = `<div class="tree-tools map-tools"><button class="btn small" data-action="map-zoom" data-value="out" title="Dézoomer">−</button>
        <span class="muted" title="Ctrl + molette pour zoomer, glisser pour déplacer">${Math.round(zoom * 100)} %</span>
        <button class="btn small" data-action="map-zoom" data-value="in" title="Zoomer">+</button>
        <button class="btn small" data-action="map-zoom" data-value="reset" title="Taille normale">⟲</button></div>`;
    return `${cycles}${tools}<div class="map-viewport" data-sel="${sel}"><div class="world-map" style="width:${Math.round(MAP_PX * zoom)}px">
      <img class="px" src="assets/ui/worldmap.png" alt="Carte du monde">${markers}</div></div>
      <div class="card zone-card">
        <div class="row-between"><b>${sel + 1}. ${escapeHtml(ZONES[sel].name)}${cycle ? ` <span class="bad">×${cycle + 1}</span>` : ''}</b>
          <label class="toggle"><input type="checkbox" data-action="auto" ${state.autoAdvance ? 'checked' : ''}> Avancer automatiquement</label></div>
        <div class="stage-grid">${buttons.join('')}</div>
        ${state.autoAdvance ? '' : `<div class="row-between"><span class="muted">Mode farm : le chevalier reste sur l'étape actuelle.</span>
          <button class="btn btn-primary small" data-action="advance">Avancer ▶</button></div>`}
      </div>`;
  },
};
