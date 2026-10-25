// Arbre de talents permanents (fragments anciens) et Renaissance.
import { REBIRTH, REBIRTH_KEEPS, REBIRTH_RESETS, TALENT_BRANCHES, TALENTS } from '../../data/rebirth.js';
import { stageLabel } from '../../core/combat.js';
import { canRebirth, rebirthReward, talentById, talentCost, talentLevelEffects, talentUnlocked } from '../../core/rebirth.js';
import { costButton, effectText, escapeHtml, fragment, formatNumber, img } from '../common.js';

export function keepResetLists() {
  return `<div class="keep-reset">
    <div><div class="section-title">Réinitialisé</div><ul>${REBIRTH_RESETS.map((t) => `<li class="bad">${t}</li>`).join('')}</ul></div>
    <div><div class="section-title">Conservé</div><ul>${REBIRTH_KEEPS.map((t) => `<li class="good">${t}</li>`).join('')}</ul></div>
  </div>`;
}

// Géométrie de l'arbre : une case de grille = CELL unités du viewBox (cases x, y des talents).
const CELL = 100;
const MIN_X = Math.min(...TALENTS.map((t) => t.x));
const MIN_Y = Math.min(...TALENTS.map((t) => t.y));
const TREE_W = (Math.max(...TALENTS.map((t) => t.x)) - MIN_X + 1) * CELL;
const TREE_H = (Math.max(...TALENTS.map((t) => t.y)) - MIN_Y + 1) * CELL;

export default {
  id: 'tree',
  title: 'Arbre de talents',
  icon: 'icon_tree',
  extra: (ui, state) => `${fragment()}<b class="num">${formatNumber(state.fragments)}</b>`,
  render(ui, state) {
    const sel = talentById(ui.view.talentSel) ?? TALENTS[0];
    // Un seul arbre sur une grille : le Cœur du chevalier au centre, les branches partent dans les
    // 4 directions. Cases carrées reliées par des traits fins ; la bordure indique l'état du talent.
    const pos = (t) => ({ x: (t.x - MIN_X + 0.5) * CELL, y: (t.y - MIN_Y + 0.5) * CELL });
    const links = TALENTS.filter((t) => t.requires).map((t) => {
      const a = pos(talentById(t.requires.id));
      const b = pos(t);
      const on = (state.talents[t.requires.id] ?? 0) > 0;
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${on ? 'on' : ''}" />`;
    }).join('');
    const pct = (x, y) => `left:${(x / TREE_W) * 100}%;top:${(y / TREE_H) * 100}%`;
    const nodes = TALENTS.map((t) => {
      const level = state.talents[t.id] ?? 0;
      const unlocked = talentUnlocked(state, t);
      const { x, y } = pos(t);
      const branch = TALENT_BRANCHES.find((br) => br.id === t.branch);
      const st = level >= t.max ? 'maxed' : level > 0 ? 'owned' : unlocked ? 'open' : 'locked';
      return `<button class="tile ${st}${t.id === sel.id ? ' selected' : ''}${t.branch === 'core' ? ' core' : ''}"
        style="${pct(x, y)};--branch:${branch?.color ?? '#ffe08a'}" data-action="talent-sel" data-value="${t.id}"
        title="${escapeHtml(t.name)} · ${level}/${t.max}">${img(t.icon)}<span class="lv">${level}/${t.max}</span></button>`;
    }).join('');
    const legend = TALENT_BRANCHES.map((br) => `<span style="color:${br.color}">● ${br.label}</span>`).join('');
    const tree = `<div class="rune-tree" style="aspect-ratio:${TREE_W}/${TREE_H}">
      <svg viewBox="0 0 ${TREE_W} ${TREE_H}" preserveAspectRatio="none" aria-hidden="true">${links}</svg>${nodes}</div>
      <div class="tree-legend">${legend}</div>`;

    const level = state.talents[sel.id] ?? 0;
    const unlocked = talentUnlocked(state, sel);
    const maxed = level >= sel.max;
    const req = sel.requires ? talentById(sel.requires.id) : null;
    const reward = rebirthReward(state);
    const can = canRebirth(state);
    return `<div class="card tree-card rune-card">${tree}</div>
      <div class="card talent-detail">
        <div class="row-between"><b class="gold-text">${escapeHtml(sel.name)}</b><span class="muted">Niv. ${level}/${sel.max}</span></div>
        <div>${level ? effectText(talentLevelEffects(sel, level)) : '<span class="muted">Pas encore appris</span>'}</div>
        ${maxed ? '' : `<div class="muted">Prochain niveau : <span class="good">${effectText(talentLevelEffects(sel, level + 1))}</span></div>`}
        ${unlocked ? '' : `<div class="bad">Nécessite ${req.name} niveau ${sel.requires.level}.</div>`}
        <div class="detail-actions">${costButton({ action: 'buy-talent', cost: talentCost(sel, level), have: state.fragments, currency: 'fragments', attrs: `data-key="${sel.id}"`, label: 'Améliorer ', max: maxed, locked: !unlocked })}</div>
      </div>
      <div class="card rebirth-card">
        <div class="rebirth-head">${img('icon_rebirth')}<div>
          <div><b>Renaissance</b> · ${state.records.rebirths} effectuée${state.records.rebirths > 1 ? 's' : ''}</div>
          <div class="muted">${can
            ? `Étape max ${stageLabel(state.maxStage)} : renaître rapporte <b class="gold-text">+${reward} fragments</b>.`
            : `Atteignez l'étape ${stageLabel(REBIRTH.minStage)} pour renaître (actuelle ${stageLabel(state.maxStage)}).`}</div>
        </div></div>
        ${keepResetLists()}
        <button class="btn btn-gold" data-action="rebirth" ${can ? '' : 'disabled'}>Renaître (+${reward} ${fragment()})</button>
      </div>`;
  },
};
