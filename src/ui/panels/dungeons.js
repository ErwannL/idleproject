// Donjons : expédition à salles, butin ciblé (emplacement choisi), chemin modifiable à tout moment.
import { BOSSES } from '../../data/enemies.js';
import { DUNGEON_PATHS, DUNGEON_REWARD, DUNGEONS } from '../../data/dungeons.js';
import { SLOTS } from '../../data/items.js';
import { stageLabel } from '../../core/combat.js';
import { canEnterDungeon, dungeonById } from '../../core/dungeon.js';
import { rewardText } from '../../core/rewards.js';
import { slotIconName } from '../../render/pixel.js';
import { escapeHtml, formatNumber, img, progressBar } from '../common.js';

function running(ui, state) {
  const run = state.dungeon;
  const d = dungeonById(run.id);
  const paths = Object.entries(DUNGEON_PATHS).map(([id, p]) => `<button class="btn chip-btn${run.path === id ? ' active' : ''}"
    data-action="dungeon-path" data-value="${id}" title="${p.text}">${p.label}</button>`).join('');
  const boss = run.room >= d.rooms;
  return `<div class="card dungeon-card running">
      <div class="row-between"><b>${img('icon_dungeon')} ${escapeHtml(d.name)}</b><span class="muted">niv. ${run.level}</span></div>
      ${progressBar((run.room - 1 + (boss ? 0 : run.kills / d.killsPerRoom)) / d.rooms, boss ? `Salle du boss — ${BOSSES[d.boss].name}` : `Salle ${run.room}/${d.rooms} · ${run.kills}/${d.killsPerRoom}`)}
      <div class="section-title">Chemin (modifiable à tout moment)</div>
      <div class="chip-row">${paths}</div>
      <div class="muted">Butin final : objet Épique ou mieux · ${run.slot === 'any' ? 'tout emplacement' : SLOTS[run.slot]}</div>
      <div>Gagné : <span class="gold-text">${rewardText(run.earned, formatNumber) || '—'}</span></div>
      <button class="btn btn-danger small" data-action="abandon-dungeon">Abandonner (retour à la campagne)</button>
    </div>`;
}

export default {
  id: 'dungeons',
  title: 'Donjons',
  icon: 'icon_dungeon',
  extra: (ui, state) => `${img('icon_key')}<b class="num">${state.keys}</b> clé${state.keys > 1 ? 's' : ''}`,
  render(ui, state) {
    if (state.dungeon) return running(ui, state);
    return DUNGEONS.map((d) => {
      const locked = state.maxStage < d.unlockStage;
      const slot = ui.view.dungeonSlot ?? 'any';
      const path = ui.view.dungeonPath ?? 'gold';
      const slots = [['any', null, 'Tous'], ...Object.entries(SLOTS).map(([s, l]) => [s, slotIconName(s), l])]
        .map(([v, ic, l]) => `<button class="btn chip-btn${slot === v ? ' active' : ''}" data-action="dungeon-slot" data-value="${v}" title="${l}">${ic ? img(ic) : ''}<span>${l}</span></button>`).join('');
      const paths = Object.entries(DUNGEON_PATHS).map(([id, p]) => `<button class="btn chip-btn${path === id ? ' active' : ''}"
        data-action="dungeon-path-pre" data-value="${id}" title="${p.text}">${p.label}</button>`).join('');
      const cleared = state.dungeonsCleared[d.id] ?? 0;
      return `<div class="card dungeon-card${locked ? ' locked' : ''}">
        <div class="row-between"><b>${img('icon_dungeon')} ${escapeHtml(d.name)}</b><span class="muted">${cleared ? `${cleared} victoire${cleared > 1 ? 's' : ''}` : 'Jamais terminé'}</span></div>
        <div class="muted">${escapeHtml(d.description)} Boss : <b>${BOSSES[d.boss].name}</b> (pouvoir ancestral).</div>
        ${locked ? `<div class="bad">Débloqué à l'étape ${stageLabel(d.unlockStage)}.</div>` : `
        <div class="section-title">Butin ciblé : emplacement de l'objet final</div><div class="chip-row">${slots}</div>
        <div class="section-title">Chemin</div><div class="chip-row">${paths}</div>
        <div class="muted">Récompense finale : objet Épique ou mieux · ${rewardText({ gems: DUNGEON_REWARD.gems, essence: DUNGEON_REWARD.essence }, formatNumber)}${cleared ? '' : ` · +${DUNGEON_REWARD.firstClearTickets} ticket (1re fois)`}.
          En cas de défaite, les récompenses des salles terminées sont conservées.</div>
        <button class="btn btn-gold" data-action="enter-dungeon" data-value="${d.id}" ${canEnterDungeon(state, d.id) ? '' : 'disabled'}>Entrer ${img('icon_key')} 1</button>
        ${state.keys < 1 ? '<div class="muted">Clés : contrats « Vaincre des boss » et événements.</div>' : ''}`}
      </div>`;
    }).join('');
  },
};
