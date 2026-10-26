// Tour de l'Éternité (v8.2) : défi sans fin, un boss par étage ; récompenses à chaque nouveau record.
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { formatDuration } from '../../core/format.js';
import { rewardText } from '../../core/rewards.js';
import { TOWER, towerBoss, towerLevel, towerReward, towerUnlocked } from '../../core/tower.js';
import { stageLabel } from '../../core/combat.js';
import { animCanvas } from '../animator.js';
import { escapeHtml, formatNumber, img } from '../common.js';

const bossName = (floor) => BOSSES[towerBoss(floor)]?.name ?? '?';
const bossSprite = (floor) => { const b = BOSSES[towerBoss(floor)]; return b.sprite ?? ENEMIES[b.base].sprite; };

// Les prochains étages, du plus haut au plus bas (façon tour), avec leur récompense de record.
function floorsList(state, from) {
  const best = state.towerBest ?? 0;
  const rows = [];
  for (let f = from + 5; f >= Math.max(1, from - 1); f--) {
    const current = state.tower?.floor === f;
    const done = f <= best;
    const mega = f % TOWER.milestone === 0;
    rows.push(`<div class="tower-floor${current ? ' current' : ''}${done ? ' done' : ''}${mega ? ' mega' : ''}">
      <span class="tf-num">${f}</span>
      <span class="tf-boss">${mega ? '👑 ' : ''}${escapeHtml(bossName(f))} <span class="muted">niv. ${formatNumber(towerLevel(state, f))}</span></span>
      <span class="tf-reward">${done ? '<span class="good">✔ record battu</span>' : rewardText(towerReward(f), formatNumber)}</span></div>`);
  }
  return rows.join('');
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
            Pas de clé : montez aussi haut que possible. Les récompenses tombent à chaque <b>nouveau record</b> ;
            une défaite termine l'ascension.</div>
          <div class="tower-stats"><span>${img('icon_trophy')} Record : <b>${state.towerBest ?? 0}</b></span>
            ${last ? `<span class="muted">Dernière ascension : ${last.floors} étage${last.floors > 1 ? 's' : ''} en ${formatDuration(last.seconds)}</span>` : ''}</div>
          ${run
            ? `<div class="row-between"><b class="gold-text">Étage ${run.floor} : ${escapeHtml(bossName(run.floor))}</b>
                <button class="btn btn-danger small" data-action="leave-tower">Quitter la tour</button></div>`
            : `<button class="btn btn-gold enter-btn" data-action="enter-tower" ${state.dungeon ? 'disabled title="Terminez d\'abord le donjon"' : ''}>Entrer dans la tour — gratuit</button>`}
        </div></div>`;
    return `${head}<div class="card"><div class="section-title">Étages</div><div class="tower-floors">${floorsList(state, floor)}</div></div>`;
  },
};
