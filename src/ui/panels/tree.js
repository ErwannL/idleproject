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

export default {
  id: 'tree',
  title: 'Arbre de talents',
  icon: 'icon_tree',
  extra: (ui, state) => `${fragment()}<b class="num">${formatNumber(state.fragments)}</b>`,
  render(ui, state) {
    const sel = talentById(ui.view.talentSel) ?? TALENTS[0];
    const columns = TALENT_BRANCHES.map((branch) => {
      const nodes = TALENTS.filter((t) => t.branch === branch.id).sort((a, b) => a.row - b.row).map((t) => {
        const level = state.talents[t.id] ?? 0;
        const unlocked = talentUnlocked(state, t);
        const cls = [level ? 'owned' : '', unlocked ? '' : 'locked', t.id === sel.id ? 'selected' : '', level >= t.max ? 'maxed' : ''].join(' ');
        return `<button class="tree-node ${cls}" style="--branch:${branch.color}" data-action="talent-sel" data-value="${t.id}" title="${t.name}">
          ${unlocked ? img(t.icon) : img('icon_lock')}<span class="node-level">${level}/${t.max}</span></button>`;
      }).join('<i class="tree-link"></i>');
      return `<div class="tree-col"><div class="tree-branch" style="color:${branch.color}">${branch.label}</div>${nodes}</div>`;
    }).join('');

    const level = state.talents[sel.id] ?? 0;
    const unlocked = talentUnlocked(state, sel);
    const maxed = level >= sel.max;
    const req = sel.requires ? talentById(sel.requires.id) : null;
    const reward = rebirthReward(state);
    const can = canRebirth(state);
    return `<div class="card tree">${columns}</div>
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
