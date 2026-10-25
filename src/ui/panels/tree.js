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

const TREE_TOP = 110; // centre de la première rangée (sous les noms des branches)
const TREE_ROW = 150; // écart vertical entre deux rangées
const TREE_H = TREE_TOP + 2 * TREE_ROW + 70;
const NODE_R = 46; // demi-taille d'un nœud dans les unités du viewBox (≈ 7,6 % de la largeur)

export default {
  id: 'tree',
  title: 'Arbre de talents',
  icon: 'icon_tree',
  extra: (ui, state) => `${fragment()}<b class="num">${formatNumber(state.fragments)}</b>`,
  render(ui, state) {
    const sel = talentById(ui.view.talentSel) ?? TALENTS[0];
    // Arbre dessiné : 4 branches de 3 colonnes ; les flèches relient chaque talent à ceux qu'il débloque.
    // Coordonnées en unités du viewBox (1200 × TREE_H) ; le conteneur garde le même rapport largeur/hauteur.
    const pos = (t) => {
      const b = TALENT_BRANCHES.findIndex((br) => br.id === t.branch);
      return { x: (b * 3 + t.col + 0.5) * 100, y: TREE_TOP + t.row * TREE_ROW };
    };
    const arrows = TALENTS.filter((t) => t.requires).map((t) => {
      const from = pos(talentById(t.requires.id));
      const to = pos(t);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      const [ux, uy] = [dx / len, dy / len];
      const on = talentUnlocked(state, t);
      const color = on ? TALENT_BRANCHES.find((br) => br.id === t.branch).color : '#3d4f7c';
      return `<line x1="${from.x + ux * NODE_R}" y1="${from.y + uy * NODE_R}" x2="${to.x - ux * (NODE_R + 14)}" y2="${to.y - uy * (NODE_R + 14)}"
        stroke="${color}" stroke-width="7" stroke-linecap="round" marker-end="url(#arrow-${on ? t.branch : 'off'})" />`;
    }).join('');
    const markers = [...TALENT_BRANCHES.map((br) => [br.id, br.color]), ['off', '#3d4f7c']].map(([id, color]) =>
      `<marker id="arrow-${id}" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${color}" /></marker>`).join('');
    const labels = TALENT_BRANCHES.map((br, i) => `<span class="tree-branch" style="left:${((i * 3 + 1.5) / 12) * 100}%;color:${br.color}">${br.label}</span>`).join('');
    const nodes = TALENTS.map((t) => {
      const branch = TALENT_BRANCHES.find((br) => br.id === t.branch);
      const level = state.talents[t.id] ?? 0;
      const unlocked = talentUnlocked(state, t);
      const { x, y } = pos(t);
      const cls = [level ? 'owned' : '', unlocked ? '' : 'locked', t.id === sel.id ? 'selected' : '', level >= t.max ? 'maxed' : ''].join(' ');
      return `<button class="tree-node ${cls}" style="--branch:${branch.color};left:${x / 12}%;top:${(y / TREE_H) * 100}%"
        data-action="talent-sel" data-value="${t.id}" title="${escapeHtml(t.name)}">
        ${unlocked ? img(t.icon) : img('icon_lock')}<span class="node-level">${level}/${t.max}</span></button>`;
    }).join('');
    const tree = `<div class="talent-tree" style="aspect-ratio:1200/${TREE_H}">
      <svg viewBox="0 0 1200 ${TREE_H}" preserveAspectRatio="none" aria-hidden="true"><defs>${markers}</defs>${arrows}</svg>
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
