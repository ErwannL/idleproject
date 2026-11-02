// v9.1.3 (doc4 lots 6 et 7) : mode monde d'un perso de bannière — niveaux, paliers du boss, essai gratuit, Titre, score.
// Panneau hors menu (ouvert depuis la bannière : « Monde : … ›»). Faits seulement : aucun conseil, aucun tri.
import { BANNER_RULES } from '../../data/banners.js';
import { BOSSES } from '../../data/enemies.js';
import { releasedUnits, tierCondition, worldLevel, worldReward, worldStatus, worldTimeLeft } from '../../core/banner.js';
import { companionById, duplicates } from '../../core/companions.js';
import { animCanvas } from '../animator.js';
import { escapeHtml, formatDecimal, formatNumber, rewardIcons, stars } from '../common.js';
import { scoreBoard } from '../score-board.js';

const dateText = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };

function runCard(state) {
  const run = state.worldRun;
  const unit = companionById(run.unit);
  const what = run.kind === 'score' ? 'Score' : run.kind === 'tier' ? `Palier ${run.n}` : `Niveau ${run.n}`;
  const left = Math.max(0, Math.ceil(worldTimeLeft(state)));
  return `<div class="card world-run"><div class="row-between"><b>${escapeHtml(unit?.name ?? '')} · ${what}</b><span class="num">${left} s</span></div>
    ${run.kind === 'score' ? `<div>Dégâts : <b class="num">${formatNumber(Math.floor(run.damage))}</b></div>` : ''}
    ${run.kind === 'level' ? `<div>Ennemis : <b class="num">${Math.min(run.kills, BANNER_RULES.levelKills)}/${BANNER_RULES.levelKills}</b>, puis le boss</div>` : ''}
    ${run.trial ? '<div class="muted">Essai gratuit (0★, niveau 1)</div>' : ''}
    <button class="btn" data-action="leave-world">Quitter le monde</button></div>`;
}

export default {
  id: 'world',
  title: 'Monde',
  icon: 'icon_map',
  render(ui, state) {
    const units = releasedUnits();
    if (!units.length) return '<div class="card muted">Aucun monde ouvert.</div>';
    const id = state.worldRun?.unit ?? (units.some((u) => u.id === ui.view.worldSel) ? ui.view.worldSel : units[units.length - 1].id);
    const st = worldStatus(state, id);
    const c = st.unit;
    const owned = state.companions.owned[c.id];
    const busy = Boolean(state.worldRun || state.dungeon || state.tower || state.challenge);
    const trial = st.trial && ui.view.worldTrial !== false;
    const boss = BOSSES[st.boss];
    const enter = (kind, n, label, locked) => `<button class="btn small btn-gold" data-action="enter-world" data-unit="${c.id}" data-kind="${kind}" data-n="${n}"
      data-trial="${trial && kind !== 'score' ? 1 : 0}" ${busy || locked ? 'disabled' : ''}>${label}</button>`;
    const levels = Array.from({ length: BANNER_RULES.worldLevels }, (_, i) => i + 1).map((n) => {
      const done = n <= st.rec.levels;
      const locked = n > st.levelsOpen || n > st.rec.levels + 1;
      const when = n > st.levelsOpen ? ` · J${BANNER_RULES.lastLevelDay}` : '';
      return `<div class="world-row${done ? ' done' : ''}"><span><span>${`Niveau ${n}`}</span> <span class="muted">${`niv. ${formatNumber(worldLevel(state, 'level', n))}${when}`}</span></span>
        <span>${done ? '✓' : rewardIcons(worldReward('level', n))}</span>${enter('level', n, done ? 'Rejouer' : 'Entrer', locked)}</div>`;
    }).join('');
    const tiers = BANNER_RULES.tierTargets.map((mult, i) => {
      const n = i + 1;
      const done = n <= st.rec.tiers;
      const open = n <= st.tiersOpen;
      const cond = tierCondition(state, c, n, { trial });
      const reward = n <= 3 ? rewardIcons(worldReward('tier', n)) : n === 4 ? '<span>Décor</span>' : `<span>Titre :</span> <b>${escapeHtml(c.title)}</b>`;
      return `<div class="world-row${done ? ' done' : ''}"><span><span>${`Palier ${n}`}</span> <span class="muted">${`PV ×${formatDecimal(mult)}${open ? '' : ` · J${BANNER_RULES.tiersFrom[i]}`}`}</span></span>
        <span>${done ? '✓' : reward}</span>${enter('tier', n, done ? 'Rejouer' : 'Entrer', !open || n > st.rec.tiers + 1 || Boolean(cond))}
        ${cond && n >= 4 ? `<div class="muted world-cond">${escapeHtml(cond)}</div>` : ''}</div>`;
    }).join('');
    const sc = st.rec.score;
    const canScore = st.owned && state.companions.equipped.includes(c.id);
    const calendar = st.live
      ? [`Jour ${st.day} de la bannière`, `Paliers 1 à 3 dès le jour ${BANNER_RULES.tiersFrom[0]}`, `Paliers 4 et 5 dès le jour ${BANNER_RULES.tiersFrom[3]}`,
        `Dernier niveau dès le jour ${BANNER_RULES.lastLevelDay}`, `Archives au jour ${BANNER_RULES.periodDays + 1}`].map((t) => `<span>${t}</span>`).join(' · ')
      : 'Bannière terminée : tout reste ouvert (le perso s\'obtient aux Archives).';
    return `${state.worldRun ? runCard(state) : ''}
      <div class="card world-head"><div class="bn-face-row"><span class="bn-face">${animCanvas(`foe:${c.sprite}`, 64, 56, 1)}</span>
        <div><div class="bn-name">${escapeHtml(c.name)}${st.owned ? ` ${stars(duplicates(owned))}` : ''}</div><div class="muted">${escapeHtml(st.zone.name)} · boss : ${escapeHtml(boss?.name ?? '')}</div></div></div>
        <div class="muted">${calendar}</div>
        ${st.rec.title ? `<div class="good"><span>Titre :</span> <b>${escapeHtml(c.title)}</b></div>` : ''}${st.rec.decor ? '<div class="good">Décor obtenu</div>' : ''}
        ${st.trial ? `<button class="btn small${trial ? ' active' : ''}" data-action="toggle-view" data-value="worldTrial" aria-pressed="${trial}">Essai gratuit : ${trial ? 'oui' : 'non'}</button>
          <span class="muted">0★, niveau 1, à la place du 2e compagnon (ne compte ni pour le palier 5 ni pour le score).</span>` : ''}</div>
      <div class="card"><div class="section-title">Niveaux</div>${levels}</div>
      <div class="card"><div class="section-title">Paliers du boss</div><div class="muted">${`PV calés sur l'étape record (${formatNumber(Math.max(state.records.bestStage ?? 1, state.maxStage))}).`}</div>${tiers}</div>
      <div class="card"><div class="section-title">Score</div>
        <div class="muted">${`Dégâts infligés au boss du monde en ${BANNER_RULES.scoreSeconds} s, le perso possédé et dans l'équipe. Les étoiles s'affichent ; aucune autre puissance.`}</div>
        ${sc ? `<div><span>Record personnel :</span> <b class="num">${formatNumber(sc.damage)}</b> ${stars(sc.stars)} <span>${`niv. ${sc.level}`}</span> <span class="muted">${dateText(sc.at)}</span></div>` : '<div class="muted">Pas encore de score.</div>'}
        ${enter('score', 1, 'Lancer le score', !canScore)}
        ${scoreBoard(ui, c.id)}</div>`;
  },
};
