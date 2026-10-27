// Tour de l'Éternité (v8.2) : défi sans fin, un boss par étage ; récompenses à chaque nouveau record.
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { formatDuration } from '../../core/format.js';
import { rewardText } from '../../core/rewards.js';
import { TOWER, climbsLeft, towerBoss, towerLevel, towerReward, towerUnlocked, towerWeek, weeklyReward } from '../../core/tower.js';
import { stageLabel } from '../../core/combat.js';
import { animCanvas } from '../animator.js';
import { escapeHtml, formatNumber, img } from '../common.js';

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
  title: 'Tour de l\'Éternité',
  icon: 'icon_star',
  extra: (ui, state) => `Record : <b class="num">${state.towerBest ?? 0}</b>`,
  render(ui, state) {
    if (!towerUnlocked(state)) {
      return `<div class="card muted">La Tour de l'Éternité s'ouvre à l'étape ${stageLabel(TOWER.unlockStage)}.</div>`;
    }
    const run = state.tower;
    const floor = run?.floor ?? (state.towerBest ?? 0) + 1;
    const last = state.towerLast;
    const head = `<div class="card tower-head">
        <div class="tower-portrait">${animCanvas(`foe:${bossSprite(run?.floor ?? 1)}`, 124, 80, 1)}</div>
        <div class="grow">
          <div class="boss-title">Tour de l'Éternité</div>
          <div class="muted">Un boss par étage, toujours plus fort (+${TOWER.floorLevel} niveaux par étage, un méga boss tous les ${TOWER.milestone}).
            <b>Une ascension par semaine</b> (remise à zéro le lundi) : montez aussi haut que possible.
            Récompenses : chaque nouveau <b>meilleur étage de la semaine</b>, plus un bonus à chaque <b>record absolu</b>.
            Une défaite termine l'ascension.</div>
          <div class="tower-stats"><span>${img('icon_trophy')} Record : <b>${state.towerBest ?? 0}</b></span>
            <span>Cette semaine : <b>${towerWeek(state).best}</b></span>
            ${last ? `<span class="muted">Dernière ascension : ${last.floors} étage${last.floors > 1 ? 's' : ''} en ${formatDuration(last.seconds)}</span>` : ''}</div>
          ${run
            ? `<div class="row-between"><b class="gold-text">Étage ${run.floor} : ${escapeHtml(bossName(run.floor))}</b>
                <button class="btn btn-danger small" data-action="leave-tower">Quitter la tour</button></div>`
            : climbsLeft(state) > 0
              ? `<button class="btn btn-gold enter-btn" data-action="enter-tower" ${state.dungeon ? 'disabled title="Terminez d\'abord le donjon"' : ''}>Commencer l'ascension de la semaine (${climbsLeft(state)} restante${climbsLeft(state) > 1 ? 's' : ''})</button>`
              : `<button class="btn enter-btn" disabled>Ascension de la semaine terminée — prochaine le ${nextReset().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</button>`}
        </div></div>`;
    return `${head}<div class="card"><div class="section-title">Étages</div><div class="tower-floors">${floorsList(state, floor)}</div></div>`;
  },
};
