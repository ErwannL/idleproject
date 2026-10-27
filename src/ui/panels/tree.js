// Arbre de talents permanents (fragments anciens) et Renaissance.
import { BALANCE } from '../../data/balance.js';
import { REBIRTH, REBIRTH_KEEPS, REBIRTH_RESETS, TALENT_BRANCHES, TALENTS } from '../../data/rebirth.js';
import { stageLabel } from '../../core/combat.js';
import { canRebirth, rebirthReward, talentById, talentCost, talentLevelEffects, talentUnlocked } from '../../core/rebirth.js';
import { perkCost } from '../../core/prestige.js';
import { PRESTIGE, PRESTIGE_PERKS } from '../../data/prestige.js';
import { costButton, effectText, escapeHtml, fragment, formatNumber, img } from '../common.js';

// Bonus éternels (achetés avec les fragments) et bonus permanent gagné à chaque Renaissance.
function eternalCard(state) {
  const p = state.prestige;
  const n = state.records.rebirths + p.count;
  const perks = PRESTIGE_PERKS.map((perk) => {
    const level = p.perks[perk.id] ?? 0;
    const maxed = level >= perk.max;
    const eff = Object.fromEntries(Object.entries(perk.effect).map(([k, v]) => [k, v * Math.max(1, level)]));
    return `<div class="perk-row">${img(perk.icon)}<div class="grow"><b>${perk.name}</b> <span class="muted">${level}/${perk.max}</span>
        <div class="${level ? 'good' : 'muted'}">${effectText(eff)}${level ? '' : ' (au niveau 1)'}</div></div>
      ${costButton({ action: 'buy-perk', cost: perkCost(level), have: state.fragments, currency: 'fragments', attrs: `data-key="${perk.id}"`, cls: 'btn-gold small', max: maxed })}</div>`;
  }).join('');
  const mult = PRESTIGE.rebirthMultiplier ** n;
  return `<div class="card prestige-card">
    <div class="row-between"><b class="prestige-title">✦ Bonus éternels</b>${n ? `<span class="good">Renaissances : dégâts, PV et or ×${mult < 1000 ? mult.toFixed(2).replace('.', ',') : formatNumber(mult)}</span>` : ''}</div>
    <div class="muted">Chaque Renaissance <b>multiplie</b> dégâts, PV et or par ${String(PRESTIGE.rebirthMultiplier).replace('.', ',')} pour toujours (cumulatif : ×1,5 · ×2,25 · ×3,4…),
      et les boss ne se renforcent que de ${BALANCE.stages.rebirthBossPct} % par Renaissance. Les bonus éternels s'achètent avec les fragments anciens.</div>
    ${perks}
  </div>`;
}

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
// Taille d'affichage à 100 % : pixels par unité du viewBox (cases bien espacées).
const TREE_PX = 0.82;
// Fenêtre centrée sur le Cœur à l'ouverture et à chaque zoom ; Ctrl + molette pour zoomer.
let centeredAt = null;

export default {
  id: 'tree',
  title: 'Arbre de talents',
  icon: 'icon_tree',
  extra: (ui, state) => `${fragment()}<b class="num">${formatNumber(state.fragments)}</b>`,
  afterRender(ui, body) {
    const vp = body.querySelector('.tree-viewport');
    if (!vp) return;
    const zoom = ui.view.treeZoom ?? 1;
    if (centeredAt !== zoom) {
      centeredAt = zoom;
      const core = TALENTS.find((t) => t.branch === 'core') ?? TALENTS[0];
      const cx = ((core.x - MIN_X + 0.5) / (TREE_W / CELL)) * vp.scrollWidth;
      const cy = ((core.y - MIN_Y + 0.5) / (TREE_H / CELL)) * vp.scrollHeight;
      vp.scrollLeft = cx - vp.clientWidth / 2;
      vp.scrollTop = cy - vp.clientHeight / 2;
    } else if (ui.view.treeScroll) {
      [vp.scrollLeft, vp.scrollTop] = ui.view.treeScroll;
    }
    vp.addEventListener('scroll', () => { ui.view.treeScroll = [vp.scrollLeft, vp.scrollTop]; });
    vp.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      vp.closest('#panel-body')?.querySelector(`[data-action="tree-zoom"][data-value="${e.deltaY < 0 ? 'in' : 'out'}"]`)?.click();
    }, { passive: false });
  },
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
    // Zoom (boutons ou Ctrl + molette) dans une fenêtre qu'on fait défiler.
    const zoom = ui.view.treeZoom ?? 1;
    const tree = `<div class="tree-tools"><button class="btn small" data-action="tree-zoom" data-value="out" title="Dézoomer">−</button>
        <span class="muted">${Math.round(zoom * 100)} %</span>
        <button class="btn small" data-action="tree-zoom" data-value="in" title="Zoomer">+</button>
        <button class="btn small" data-action="tree-zoom" data-value="reset" title="Taille normale">⟲</button></div>
      <div class="tree-viewport" data-zoom="${zoom}"><div class="rune-tree" style="width:${Math.round(TREE_W * TREE_PX * zoom)}px;aspect-ratio:${TREE_W}/${TREE_H}">
      <svg viewBox="0 0 ${TREE_W} ${TREE_H}" preserveAspectRatio="none" aria-hidden="true">${links}</svg>${nodes}</div></div>
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
      </div>
      ${eternalCard(state)}`;
  },
};
