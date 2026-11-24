import { arenaUnlocked } from '../../core/arena.js';
import { cardArena, totalStars } from '../../core/arena-cards.js';
import { bountyCard } from './contracts.js'; // v9.3.8 : Prime du jour sur la Carte
// Carte du monde : zones reliées par un chemin, étapes de la zone choisie, avance automatique.
import { REVENGE_STEPS, revengeLevel, revengePending } from '../../core/revenge.js'; // v9.7.1 (lot 4)
import { worldStarsHtml } from '../stars.js'; // v9.7.1 (lot 4)
import { ZONES } from '../../data/zones.js';
import { bossesForStage, bossTierForStage, cycleForStage, stageLabel, stagesPerCycle, zoneIndexForStage, zoneLength, zoneStartStage } from '../../core/combat.js';
import { BOSSES } from '../../data/enemies.js';

const TIER_LABELS = { mini: 'Mini-boss', mid: 'Boss', hard: 'Boss redoutable', mega: 'MÉGA BOSS' };
import { bossForecast, escapeHtml, forecastHtml, progressBar } from '../common.js';
import { bossRetryPct } from '../../core/guide.js';
import { envLine, environmentFor } from '../../core/environment.js'; // v9.2.1
import { elementBadge, elementWheel, zoneElement, wheelShown } from '../../core/elements.js'; // v9.5.1
import { attachMap, pulse } from '../ui-vfx.js'; // v9.2.6
import { mBar, mBtn, mBtnGold, mChip, mTitle } from '../mobile-kit.js'; // v10.12
import { isPhoneUi } from './combat-phone.js';

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

// v9.2.1 : malus d'environnement du monde choisi (au cycle choisi) et amélioration qui le contre.
function envHtml(state, zi, cycle) {
  const env = environmentFor(state, zi, cycle + 1);
  // v9.5.1 (4.1, 4.3) : élément du monde et roue des éléments, sur la Carte.
  const el = zoneElement(zi);
  const elem = el && wheelShown(state) ? `<div class="env-line">Élément du monde : ${elementBadge(el, true)}</div>${elementWheel(el)}` : '';
  if (!env) return `${elem}<div class="muted env-line">Environnement : aucun malus dans ce monde.</div>`;
  return `${elem}<div class="env-line${env.countered >= 100 ? ' countered' : ''}">${escapeHtml(envLine(env))}</div>`;
}

// Boss trop fort (v9.1.0) : c'est normal, et on le dit ; le bouton pour le retenter reste ici aussi.
function retryBox(state) {
  const r = state.bossRetry;
  if (!r || state.stage !== r.stage - 1) return '';
  const pct = bossRetryPct(state);
  return `<div class="retry-box"><div><b>Boss trop fort pour l'instant.</b> Normal : le héros s'entraîne à l'étape d'avant et retentera seul.
      Pour aller plus vite : améliore tes dégâts.</div>
    <button class="btn btn-gold small" data-action="retry-boss">Retenter le boss (${pct >= 100 ? 'prêt' : `${pct} %`})</button></div>`;
}

// Positions des zones sur la carte peinte (assets/ui/worldmap.png, générée par tools/art/worldmap.py).
// (tools/art/worldmap_nodes.json, positions relatives des 12 régions sur la carte peinte ; v9.2.0 (monde marin) : 11e = Royaume englouti)
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
  { x: 0.5, y: 0.13 },
  { x: 0.38, y: 0.3 },
];

let mapView = null;
let prevSel = null;
let mapX = null; // v10.12 : défilement de la carte (téléphone)

export default {
  id: 'campaign',
  // v9.2.6 : calque animé de la carte (nuages, eau, lave, étoiles, marqueur, chemin) et transition de monde choisi.
  afterRender(ui, body) {
    if (!mapView) return;
    // v10.12 : téléphone — la carte (large de 440 px, pour des pastilles de 44 px) défile de côté ; elle se recentre sur le monde choisi.
    const box = body.querySelector('.cb-mapbox');
    if (box) {
      const dot = box.querySelector('.map-dot.selected');
      if ((mapX === null || prevSel !== mapView.sel) && dot) mapX = Math.max(0, dot.offsetLeft - box.clientWidth / 2);
      box.scrollLeft = mapX ?? 0;
      box.addEventListener('scroll', () => { mapX = box.scrollLeft; }, { passive: true });
    }
    attachMap(body.querySelector('.mini-map'), MAP_NODES, mapView);
    if (prevSel !== null && prevSel !== mapView.sel) {
      pulse(body.querySelector('.world-name'), 'vfx-slide', 320);
      pulse(body.querySelector('.stage-grid'), 'vfx-tab', 320);
    }
    prevSel = mapView.sel;
  },
  title: 'Carte',
  icon: 'icon_map',
  extra: (ui, state) => `Étape max ${stageLabel(state.maxStage)}`,
  render(ui, state) {
    const cyc = stagesPerCycle();
    // Difficulté affichée : celle choisie (×1, ×2…) parmi celles atteintes, par défaut celle de l'étape actuelle.
    const maxCycle = cycleForStage(state.maxStage);
    const cycle = Number.isInteger(ui.view.cycleSel) && ui.view.cycleSel <= maxCycle ? ui.view.cycleSel : cycleForStage(state.stage);
    const offset = cycle * cyc;
    const currentZone = cycleForStage(state.stage) === cycle ? zoneIndexForStage(state.stage) : -1;
    const lastZone = cycle < maxCycle ? ZONES.length - 1 : zoneIndexForStage(state.maxStage);
    const sel = Number.isInteger(ui.view.zoneSel) && ui.view.zoneSel <= lastZone ? ui.view.zoneSel : Math.max(0, currentZone);
    // v9.1.3 (doc1 « Carte » + A20) : la carte peinte est mise en avant, cliquable par monde (pastilles numérotées),
    // à la place du <select> ; le nom du monde choisi est écrit dessous, entre ◀ et ▶.
    const markers = ZONES.map((zone, i) => {
      const locked = i > lastZone;
      const cleared = state.maxStage >= offset + zoneStartStage(i) + zoneLength(zone);
      const n = MAP_NODES[i];
      const tip = `${i + 1}. ${zone.name}${locked ? ' (bloqué)' : cleared ? ' (terminé)' : ''}`;
      return `<button class="map-dot${locked ? ' locked' : ''}${i === sel ? ' selected' : ''}${i === currentZone ? ' current' : ''}${cleared ? ' cleared' : ''}"
        style="left:${n.x * 100}%;top:${n.y * 100}%" data-action="zone-sel" data-value="${i}" ${locked ? 'disabled' : ''}
        title="${escapeHtml(tip)}" aria-label="${escapeHtml(tip)}" aria-pressed="${i === sel}">${i + 1}</button>`;
    }).join('');
    const first = offset + zoneStartStage(sel);
    const buttons = [];
    // v9.2.2 : pas de voyage pendant un donjon, la Tour ou le défi — on le dit au lieu de boutons qui ne répondent pas.
    const busy = state.dungeon ? 'dungeon' : state.tower ? 'tower' : state.challenge ? 'challenge' : '';
    const busyNote = busy ? `<div class="notice warn">${busy === 'dungeon' ? 'Voyage impossible pendant un donjon : termine-le ou quitte-le (bouton rouge sous la scène).' : busy === 'tower' ? 'Voyage impossible pendant la Tour de l\'Éternité : termine ou quitte la montée (bouton rouge sous la scène).' : 'Voyage impossible pendant le défi de la semaine : termine-le ou quitte-le (bouton rouge sous la scène).'}</div>` : '';
    for (let stage = first; stage < first + zoneLength(ZONES[sel]); stage++) {
      const tier = bossTierForStage(stage);
      const classes = ['btn', tier ? `boss tier-${tier}` : '', stage === state.stage && !state.dungeon ? 'current' : '', stage < state.maxStage ? 'cleared' : ''].join(' ');
      const title = tier ? `${TIER_LABELS[tier]} : ${BOSSES[bossesForStage(stage)[0]].name}` : 'Étape';
      buttons.push(`<button class="${classes}" data-action="stage" data-stage="${stage}" ${stage > state.maxStage || busy ? 'disabled' : ''}
        title="${escapeHtml(title)} · ${stageLabel(stage)}" aria-label="${escapeHtml(tier ? `${stage - first + 1} · ${TIER_LABELS[tier]}` : String(stage - first + 1))}">${stage - first + 1}</button>`);
      // v9.1.3 (A4) : plus de crâne de 9×8 px ; les étapes de boss se lisent à la forme (bordure épaisse, numéro en gras).
    }
    // v9.1.0 : d'abord le résumé, le choix du monde et de la difficulté, la liste d'étapes ; la grande carte est
    // repliée derrière un bouton (sa largeur suit le panneau, zoom 50–250 %).
    mapView = { cur: currentZone, last: lastZone, sel }; // v9.2.6 : pour le calque animé (afterRender)
    if (isPhoneUi(ui)) return phoneView(ui, state, { sel, cycle, maxCycle, lastZone, markers, buttons, busyNote });
    const worldPicker = `<div class="mini-map"><img class="px" src="assets/ui/worldmap.png" alt="">${markers}</div>
      <div class="world-picker">
        <button class="btn small" data-action="zone-sel" data-value="${sel - 1}" ${sel > 0 ? '' : 'disabled'} aria-label="Monde précédent">◀</button>
        <b class="world-name">${sel + 1}. ${escapeHtml(ZONES[sel].name)}</b>
        <button class="btn small" data-action="zone-sel" data-value="${sel + 1}" ${sel < lastZone ? '' : 'disabled'} aria-label="Monde suivant">▶</button>
        ${maxCycle > 0 ? `<select data-action="cycle-select" aria-label="Cycle">${Array.from({ length: maxCycle + 1 }, (_, c) => `<option value="${c}" ${c === cycle ? 'selected' : ''}>Cycle ×${c + 1}</option>`).join('')}</select>` : ''}
      </div>`;
    // v9.7.1 (lot 4) : jauge « Revanche » (face-à-face de fin de monde avec le Colosse) et étoiles du monde choisi.
    const rv = revengePending(state);
    const dots = Array.from({ length: REVENGE_STEPS }, (_, i) => `<i class="rv-dot${i < revengeLevel(state) ? ' on' : ''}"></i>`).join('');
    const revenge = `<div class="card rv-card"><div class="rv-gauge"><b>Revanche</b><span class="rv-dots" title="${revengeLevel(state)} / ${REVENGE_STEPS}">${dots}</span></div>
      ${rv ? `<div class="row-between"><span>Monde ${rv.world} : ${escapeHtml(rv.text)}</span><button class="btn btn-gold" data-action="revenge">⚔ Face-à-face</button></div>` : '<div class="muted">Le prochain face-à-face avec le Colosse t\'attend à la fin de ce monde.</div>'}
      <div class="rv-stars">${worldStarsHtml(state, sel)}</div></div>`;
    // v10.2 (2.1) : tuile illustrée de l'Arène à cartes sur la Carte.
    const arenaTile = arenaUnlocked(state) ? `<button class="arena-tile" data-action="open-tab" data-value="arena" style="background-image:url(assets/ui/art101/arena_tile.png)"><b>Arène à cartes</b><span>Étage ${cardArena(state).best + 1} · ${totalStars(state)} ★</span></button>` : '';
    return `${revenge}${arenaTile}${summary(ui, state)}
      <div class="card zone-card">
        ${worldPicker}
        <div class="row-between"><span>${cycle ? `<b class="bad">Cycle ×${cycle + 1}</b>` : ''}</span>
          <label class="toggle"><input type="checkbox" data-action="auto" ${state.autoAdvance ? 'checked' : ''}> Avancer automatiquement</label></div>
        ${envHtml(state, sel, cycle)}
        ${busyNote}
        <div class="stage-grid">${buttons.join('')}</div>
      </div>`;
  },
};

// v10.12 : Carte sur téléphone — cadre, cartouche, en-tête fixe (monde, étape, barre, prochain boss), grande carte,
// choix du monde et de la difficulté en puces, étapes, puis Revanche et Arène en deux cartes de 64 px.
function phoneView(ui, state, c) {
  const { sel, cycle, maxCycle, lastZone, markers, buttons, busyNote } = c;
  const busy = state.dungeon || state.tower || state.challenge;
  let head;
  if (busy) {
    head = `<div class="m-card cb-head"><b class="cb-zone">${state.dungeon ? 'Donjon en cours' : state.tower ? 'Tour en cours' : 'Défi en cours'}</b><span class="cb-sub">La campagne reprend à la fin.</span></div>`;
  } else {
    const zi = zoneIndexForStage(state.stage);
    const zone = ZONES[zi];
    const first = Math.floor((state.stage - 1) / stagesPerCycle()) * stagesPerCycle() + zoneStartStage(zi);
    const pos = state.stage - first + 1;
    const len = zoneLength(zone);
    let next = state.stage;
    while (!bossTierForStage(next) && next < first + len) next++;
    const tier = bossTierForStage(next);
    const boss = tier ? BOSSES[bossesForStage(next)[0]] : null;
    const gap = next - state.stage;
    head = `<div class="m-card cb-head"><div class="cb-top"><b class="cb-zone">${zi + 1}. ${escapeHtml(zone.name)}</b>${mChip('Auto', { action: 'toggle-auto', on: Boolean(state.autoAdvance) })}</div>
      <span class="cb-sub">Étape ${pos}/${len}${boss ? ` · ${gap === 0 ? 'boss en cours' : `boss dans ${gap}`} : ${escapeHtml(boss.name)}` : ''}</span>${mBar(pos / len)}</div>`;
  }
  const r = state.bossRetry;
  const retry = r && state.stage === r.stage - 1 ? bossRetryPct(state) : null;
  const main = retry !== null ? mBtnGold(`Retenter le boss (${retry >= 100 ? 'prêt' : `${retry} %`})`, { action: 'retry-boss' })
    : !state.autoAdvance && !busy ? mBtnGold('Avancer', { action: 'advance' }) : '';
  const rv = revengePending(state);
  const dots = Array.from({ length: REVENGE_STEPS }, (_, i) => `<i class="rv-dot${i < revengeLevel(state) ? ' on' : ''}"></i>`).join('');
  const revenge = `<div class="m-card cb-mini cb-rv"><span class="cb-mini-t"><b>Revanche</b><span class="rv-dots" title="${revengeLevel(state)} / ${REVENGE_STEPS}">${dots}</span></span>
    ${rv ? mBtn('Face-à-face', { action: 'revenge' }) : '<span class="cb-mini-r" title="Le face-à-face avec le Colosse a lieu à la fin du monde.">fin du monde</span>'}</div>`;
  const arena = arenaUnlocked(state) ? `<button type="button" class="m-card cb-mini cb-arena" data-action="open-tab" data-value="arena"><span class="cb-mini-t"><b>Arène à cartes</b><span class="cb-mini-s">Étage ${cardArena(state).best + 1} · ${totalStars(state)} ★</span></span><span class="cb-mini-r">›</span></button>` : '';
  const cycles = maxCycle > 0 ? `<div class="m-chips">${Array.from({ length: maxCycle + 1 }, (_, i) => mChip(`×${i + 1}`, { action: 'cycle-pick', value: i, on: i === cycle })).join('')}</div>` : '';
  return `<div class="m-frame cb-frame">${mTitle('icon_map', 'Carte', true)}${head}${retry === null ? forecastHtml(bossForecast(state, () => ui.invalidate())) : ''}${main}
    <div class="cb-mapbox"><div class="mini-map"><img class="px" src="assets/ui/worldmap.png" alt="">${markers}</div></div>
    <div class="world-picker cb-picker"><button type="button" class="m-btn" data-action="zone-sel" data-value="${sel - 1}" ${sel > 0 ? '' : 'disabled'} aria-label="Monde précédent"><span>◀</span></button>
      <b class="world-name">${sel + 1}. ${escapeHtml(ZONES[sel].name)}</b>
      <button type="button" class="m-btn" data-action="zone-sel" data-value="${sel + 1}" ${sel < lastZone ? '' : 'disabled'} aria-label="Monde suivant"><span>▶</span></button></div>
    ${cycles}<div class="cb-stars">${worldStarsHtml(state, sel)}</div>${busyNote}
    <div class="m-card cb-stages"><div class="stage-grid">${buttons.join('')}</div></div>
    ${revenge}${arena}</div>`;
}
