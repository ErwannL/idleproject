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

// Géométrie de l'arbre (unités du viewBox). Centre, directions des branches, distance de chaque rangée
// au centre (horizontale ou verticale) et écart entre les deux sous-branches.
const TREE_W = 1000;
const TREE_H = 900;
const CX = 500;
const CY = 450;
const BRANCH_DIRS = { combat: { x: -1, y: 0 }, resources: { x: 1, y: 0 }, special: { x: 0, y: -1 }, survival: { x: 0, y: 1 } };
const DIST_X = [150, 285, 415];
const DIST_Y = [135, 250, 360];
const SPREAD = [0, 90, 125];
const NODE_R = 34; // demi-taille d'un nœud (6,8 % de la largeur)
const OFF_COLOR = '#6a80b0';

export default {
  id: 'tree',
  title: 'Arbre de talents',
  icon: 'icon_tree',
  extra: (ui, state) => `${fragment()}<b class="num">${formatNumber(state.fragments)}</b>`,
  render(ui, state) {
    const sel = talentById(ui.view.talentSel) ?? TALENTS[0];
    // Un seul arbre : le Cœur du chevalier au centre, une branche par direction, chaque branche se divise
    // en deux. Coordonnées en unités du viewBox (TREE_W × TREE_H) ; le conteneur garde ce rapport.
    const pos = (t) => {
      if (t.branch === 'core') return { x: CX, y: CY };
      const dir = BRANCH_DIRS[t.branch];
      const axis = dir.x ? DIST_X : DIST_Y;
      const along = axis[t.row];
      const side = (t.col - 1) * SPREAD[t.row];
      return { x: CX + dir.x * along + (dir.x ? 0 : side), y: CY + dir.y * along + (dir.y ? 0 : side) };
    };
    const colorOf = (t) => (t.branch === 'core' ? '#ffe08a' : TALENT_BRANCHES.find((br) => br.id === t.branch).color);
    const arrows = TALENTS.filter((t) => t.requires).map((t) => {
      const from = pos(talentById(t.requires.id));
      const to = pos(t);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      const [ux, uy] = [dx / len, dy / len];
      const on = talentUnlocked(state, t);
      return `<line x1="${from.x + ux * NODE_R}" y1="${from.y + uy * NODE_R}" x2="${to.x - ux * (NODE_R + 16)}" y2="${to.y - uy * (NODE_R + 16)}"
        stroke="${on ? colorOf(t) : OFF_COLOR}" stroke-width="7" stroke-linecap="round" marker-end="url(#arrow-${on ? t.branch : 'off'})" />`;
    }).join('');
    const markers = [...TALENT_BRANCHES.map((br) => [br.id, br.color]), ['off', OFF_COLOR]].map(([id, color]) =>
      `<marker id="arrow-${id}" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${color}" /></marker>`).join('');
    const pct = (x, y) => `left:${(x / TREE_W) * 100}%;top:${(y / TREE_H) * 100}%`;
    // Nom de chaque branche à côté de sa première case.
    const labels = TALENT_BRANCHES.map((br) => {
      const root = TALENTS.find((t) => t.branch === br.id && t.row === 0);
      const p = pos(root);
      const d = BRANCH_DIRS[br.id];
      const lx = p.x + (d.x ? 0 : 125);
      const ly = p.y + (d.x ? -78 : 0);
      return `<span class="tree-branch" style="${pct(lx, ly)};color:${br.color}">${br.label}</span>`;
    }).join('');
    const nodes = TALENTS.map((t) => {
      const level = state.talents[t.id] ?? 0;
      const unlocked = talentUnlocked(state, t);
      const { x, y } = pos(t);
      const cls = [t.branch === 'core' ? 'core' : '', level ? 'owned' : '', unlocked ? '' : 'locked', t.id === sel.id ? 'selected' : '', level >= t.max ? 'maxed' : ''].join(' ');
      return `<button class="tree-node ${cls}" style="--branch:${colorOf(t)};${pct(x, y)}"
        data-action="talent-sel" data-value="${t.id}" title="${escapeHtml(t.name)}">${unlocked ? img(t.icon) : img('icon_lock')}</button>
        <span class="node-lv${level >= t.max ? ' max' : ''}" style="${pct(x, y + NODE_R + 30)}">${level}/${t.max}</span>`;
    }).join('');
    const tree = `<div class="talent-tree" style="aspect-ratio:${TREE_W}/${TREE_H}">
      <svg viewBox="0 0 ${TREE_W} ${TREE_H}" preserveAspectRatio="none" aria-hidden="true"><defs>${markers}</defs>${arrows}</svg>
      ${labels}${nodes}</div>`;

    const level = state.talents[sel.id] ?? 0;
    const unlocked = talentUnlocked(state, sel);
    const maxed = level >= sel.max;
    const req = sel.requires ? talentById(sel.requires.id) : null;
    const reward = rebirthReward(state);
    const can = canRebirth(state);
    return `<div class="card tree-card">${tree}</div>
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
