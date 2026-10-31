// Tour de l'Éternité (v8.2) : défi sans fin, un boss par étage ; récompenses à chaque nouveau record.
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { formatDuration } from '../../core/format.js';
import { rewardText } from '../../core/rewards.js';
import { TOWER, climbsLeft, towerBoss, towerLevel, towerReward, towerTimeLeft, towerUnlocked, towerWeek, weeklyReward } from '../../core/tower.js';
import { stageLabel } from '../../core/combat.js';
import { animCanvas } from '../animator.js';
import { escapeHtml, fold, formatNumber, img } from '../common.js';
import { bossTrait } from '../../core/boss-traits.js';

const bossName = (floor) => BOSSES[towerBoss(floor)]?.name ?? '?';
const bossSprite = (floor) => { const b = BOSSES[towerBoss(floor)]; return b.sprite ?? ENEMIES[b.base].sprite; };

// Les prochains étages, du plus haut au plus bas (façon tour), avec leur récompense de record.
function floorsList(state, from) {
  const best = state.towerBest ?? 0;
  const weekBest = towerWeek(state).best;
  const rows = [];
  for (let f = from + 5; f >= Math.max(1, from - 1); f--) {
    const current = state.tower?.floor === f;
    const mega = f % TOWER.milestone === 0;
    // v8.4 : deux récompenses distinctes — record à vie (une seule fois) et meilleur étage de la semaine.
    const record = f <= best ? '<span class="muted">Record : récompense déjà récupérée</span>' : `<span>Record : ${rewardText(towerReward(f), formatNumber)}</span>`;
    const weekly = f <= weekBest ? '<span class="good">✔ Semaine : récupérée</span>' : `<span>Semaine : ${rewardText(weeklyReward(f), formatNumber)}</span>`;
    rows.push(`<div class="tower-floor${current ? ' current' : ''}${f <= weekBest ? ' done' : ''}${mega ? ' mega' : ''}">
      <span class="tf-num">${f}</span>
      <span class="tf-boss">${mega ? '👑 ' : ''}${escapeHtml(bossName(f))} <span class="muted">niv. ${formatNumber(towerLevel(state, f))}</span></span>
      <span class="tf-reward">${weekly}${record}</span></div>`);
  }
  return rows.join('');
}

// Prochain lundi 0 h (remise à zéro des ascensions).
function nextReset() {
  const d = new Date();
  const days = ((8 - d.getDay()) % 7) || 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export default {
  id: 'tower',
  title: 'Tour',
  icon: 'icon_star',
  extra: (ui, state) => `Record : <b class="num">${state.towerBest ?? 0}</b>`,
  render(ui, state) {
    if (!towerUnlocked(state)) {
      return `<div class="card muted">La Tour de l'Éternité s'ouvre à l'étape ${stageLabel(TOWER.unlockStage)}.</div>`;
    }
    const run = state.tower;
    const floor = run?.floor ?? (state.towerBest ?? 0) + 1;
    const last = state.towerLast;
    // v9.1.0 : d'abord record, essais et Monter (ou, en cours : étage, temps avant effondrement, Quitter) ; la mécanique
    // du boss de l'étage ; la liste des étages et l'explication sont repliées.
    const trait = bossTrait(towerBoss(floor));
    const action = run
      ? `<div class="row-between"><b class="gold-text">Étage ${run.floor} : ${escapeHtml(bossName(run.floor))}</b>
          <button class="btn btn-danger small" data-action="leave-tower">Quitter la tour</button></div>
        <div>⌛ Effondrement dans <b>${formatDuration(towerTimeLeft(state))}</b> de combat.</div>`
      : climbsLeft(state) > 0
        ? `<button class="btn btn-gold enter-btn primary-action" data-action="enter-tower" ${state.dungeon || state.challenge ? 'disabled' : ''}>Monter (${climbsLeft(state)} ascension${climbsLeft(state) > 1 ? 's' : ''} cette semaine)</button>
          ${state.dungeon || state.challenge ? '<div class="bad">Terminez d\'abord le donjon ou le défi.</div>' : ''}`
        : `<button class="btn enter-btn" disabled>Ascension de la semaine faite — prochaine le ${nextReset().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</button>`;
    const head = `<div class="card tower-head">
        <div class="tower-portrait">${animCanvas(`foe:${bossSprite(floor)}`, 124, 80, 1)}</div>
        <div class="grow">
          <div class="tower-stats"><span>${img('icon_trophy')} Record : <b>${state.towerBest ?? 0}</b></span>
            <span>Cette semaine : <b>${towerWeek(state).best}</b></span>
            ${last ? `<span class="muted">Dernière : ${last.floors} étage${last.floors > 1 ? 's' : ''} en ${formatDuration(last.seconds)}${last.collapsed ? ' (effondrée)' : ''}</span>` : ''}</div>
          ${action}
          ${trait ? `<div class="trait-box" style="--trait:${trait.color}"><b>Étage ${floor} — ${escapeHtml(bossName(floor))} · ${escapeHtml(trait.name)}</b> : ${escapeHtml(trait.text)}. <span class="muted">Contre : ${escapeHtml(trait.counter)}</span></div>` : ''}
        </div></div>`;
    const rules = `Un boss par étage, toujours plus fort (+${TOWER.floorLevel} niveaux par étage, et la pente s'accentue en montant), un méga boss tous les ${TOWER.milestone}.
      Une ascension par semaine (remise à zéro le lundi). Récompenses : chaque nouveau meilleur étage de la semaine, plus un bonus à chaque record absolu.
      Une défaite termine l'ascension ; la tour s'effondre au bout de ${TOWER.timeLimit / 3600} h de combat (+${TOWER.floorBonus / 60} min par nouvel étage, de moins en moins).`;
    return `${head}${fold(ui, 'tower-floors', 'Étages et récompenses', () => `<div class="tower-floors">${floorsList(state, floor)}</div>`)}
      ${fold(ui, 'tower-rules', 'Règles de la Tour', `<div class="muted">${rules}</div>`)}`;
  },
};
