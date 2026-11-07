// v9.2.8 : Événement en cours (document du producteur, section 7). Grand événement « Expédition des Anciens » :
// carte de 5 régions × 10 étapes (combat automatique), World Boss dès l'étape 20, écus et boutique d'écus, fragment
// SSR universel à l'étape 30. Petit événement « Marché des lueurs » : objectifs et récompenses.
import { EVENTS } from '../../data/economy.js';
import { currentEvent, eventRecord, eventStageLevel, totalStages, worldBossStatus } from '../../core/ancients.js';
import { escapeHtml, formatNumber, img } from '../common.js';
import { walletIcon } from './shop.js';
import { stageLabel } from '../../core/combat.js';

const dateText = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const give = (g) => Object.entries(g).map(([k, v]) => `<span class="shop-give">${walletIcon(k)}<b class="num">${v}</b></span>`).join('');

function grand(ui, state, ev) {
  const G = EVENTS.grand;
  const rec = eventRecord(state);
  const wb = worldBossStatus(state);
  const next = rec.cleared + 1;
  const regions = G.regions.map((r, ri) => {
    const cells = Array.from({ length: G.stagesPerRegion }, (_, i) => {
      const n = ri * G.stagesPerRegion + i + 1;
      const cls = n <= rec.cleared ? 'done' : n === next ? 'next' : 'locked';
      return `<span class="ev-stage ${cls}${n === G.fragmentStage ? ' frag' : ''}${n === G.worldBoss.unlockStage ? ' boss' : ''}" title="${n}">${n}</span>`;
    }).join('');
    return `<div class="ev-region"><div class="ev-region-name">${escapeHtml(r.name)}</div><div class="ev-stages">${cells}</div></div>`;
  }).join('');
  const last = ui.view.eventLast;
  return `<div class="card ev-head"><div class="section-title">${img('icon_map')} <span>${escapeHtml(G.name)}</span></div>
      <div class="muted"><span>Jour</span> <b class="num">${ev.day}/14</b> · <span>Jusqu'au</span> ${dateText(ev.end - 86400000)}</div>
      <div class="ev-coins">${walletIcon('eventCoins')}<b class="num">${formatNumber(rec.coins)}</b> <span>écus</span> · <span>Étapes</span> <b class="num">${rec.cleared}/${totalStages()}</b></div></div>
    <div class="card"><div class="ev-map">${regions}</div>
      ${next <= totalStages() ? `<div class="ev-fight"><span>Étape</span> <b class="num">${next}</b> · <span>Gardien d'étape</span> <b class="num">${stageLabel(eventStageLevel(state, next))}</b>
        <button class="btn btn-primary small" data-action="event-fight" data-value="${next}">Combattre</button></div>` : '<div class="good">Carte terminée.</div>'}
      ${last ? `<div class="muted">${last}</div>` : ''}
      <div class="muted">Combat automatique : dégâts du héros pendant ${G.fightSeconds} s contre les PV du gardien. Étape ${G.fragmentStage} : fragment SSR universel.</div></div>
    <div class="card"><div class="section-title">${img('icon_boss')} <span>World Boss</span></div>
      ${wb.open ? `<div><span>Tentatives du jour</span> <b class="num">${wb.left}</b> · <span>Record</span> <b class="num">${formatNumber(wb.best)}</b></div>
        <button class="btn btn-gold small" data-action="event-boss" ${wb.left ? '' : 'disabled'}>Attaquer</button>` : `<div class="muted">Débloqué à l'étape ${G.worldBoss.unlockStage}.</div>`}</div>
    <div class="card"><div class="section-title">${walletIcon('eventCoins')} <span>Boutique des écus</span></div>
      <div class="ev-shop">${G.shop.map((i) => `<div class="ev-item">${give(i.give)}<span class="muted"><b class="num">${(rec.bought[i.id] ?? 0)}/${i.stock}</b></span>
        <button class="btn small" data-action="event-buy" data-value="${i.id}" ${rec.coins >= i.price && (rec.bought[i.id] ?? 0) < i.stock ? '' : 'disabled'}>${walletIcon('eventCoins')} ${i.price}</button></div>`).join('')}</div></div>
    <div class="muted">Failles dimensionnelles (2e semaine) et reliques d'événement : prochainement.</div>`;
}

function small(state, ev) {
  const rec = eventRecord(state);
  return `<div class="card"><div class="section-title">${img('icon_star')} <span>${escapeHtml(EVENTS.small.name)}</span></div>
    <div class="muted"><span>Jour</span> <b class="num">${ev.day}/14</b> · <span>Jusqu'au</span> ${dateText(ev.end - 86400000)}</div>
    ${EVENTS.small.goals.map((g) => {
      const p = rec.goals[g.id] ?? 0;
      const done = rec.claimed.includes(g.id);
      return `<div class="ev-goal"><span>${escapeHtml(g.label)}</span> <b class="num">${formatNumber(Math.min(p, g.target))}/${formatNumber(g.target)}</b> ${give(g.give)}
        ${done ? '<span class="good">✓</span>' : `<button class="btn small" data-action="event-goal" data-value="${g.id}" ${p >= g.target ? '' : 'disabled'}>Récupérer</button>`}</div>`;
    }).join('')}</div>`;
}

export default {
  id: 'event',
  title: 'Événement',
  icon: 'icon_map',
  render(ui, state) {
    const ev = currentEvent();
    if (!ev) return '<div class="muted">Aucun événement en cours.</div>';
    return ev.kind === 'grand' ? grand(ui, state, ev) : small(state, ev);
  },
};
