// Arbre de talents permanents (fragments anciens) et Renaissance.
import { REBIRTH, REBIRTH_KEEPS, REBIRTH_RESETS, TALENT_BRANCHES, TALENTS } from '../../data/rebirth.js';
import { stageLabel } from '../../core/combat.js';
import { canRebirth, rebirthReward, talentById, talentCost, talentLevelEffects, talentUnlocked } from '../../core/rebirth.js';
import { canPrestige, perkCost, prestigeReward } from '../../core/prestige.js';
import { PRESTIGE, PRESTIGE_KEEPS, PRESTIGE_PERKS, PRESTIGE_RESETS } from '../../data/prestige.js';
import { costButton, effectText, escapeHtml, fragment, formatNumber, img } from '../common.js';

// Prestige : au-dessus de la Renaissance (fragments et talents remis à zéro contre des étoiles).
function prestigeCard(ui, state) {
  const p = state.prestige;
  const can = canPrestige(state);
  const stars = prestigeReward(state);
  const perks = PRESTIGE_PERKS.map((perk) => {
    const level = p.perks[perk.id] ?? 0;
    const maxed = level >= perk.max;
    const cost = perkCost(level);
    const eff = Object.fromEntries(Object.entries(perk.effect).map(([k, v]) => [k, v * Math.max(1, level)]));
    return `<div class="perk-row">${img(perk.icon)}<div class="grow"><b>${perk.name}</b> <span class="muted">${level}/${perk.max}</span>
        <div class="${level ? 'good' : 'muted'}">${effectText(eff)}${level ? '' : ' (au niveau 1)'}</div></div>
      <button class="btn btn-gold small" data-action="buy-perk" data-key="${perk.id}" ${maxed || p.stars < cost ? 'disabled' : ''}>${maxed ? 'Max' : `★ ${cost}`}</button></div>`;
  }).join('');
  const armed = ui.view.prestigeArmed && can;
  return `<div class="card prestige-card">
    <div class="row-between"><b class="prestige-title">✦ Prestige ${p.count ? p.count : ''}</b><span class="gold-text">★ ${p.stars} étoile${p.stars > 1 ? 's' : ''}</span></div>
    <div class="muted">${p.count ? `Bonus permanent : <span class="good">${effectText(Object.fromEntries(Object.entries(PRESTIGE.perPrestige).map(([k, v]) => [k, v * p.count])))}</span> · fragments +${PRESTIGE.fragmentBonusPct * p.count} %.<br>` : ''}
      ${can ? `Le Prestige rapporte <b class="gold-text">★ ${stars}</b> et un bonus permanent de plus.`
        : `Terminez le monde 6 (étape ${stageLabel(PRESTIGE.minStage - 1)}) pour débloquer le Prestige.`}</div>
    <div class="keep-reset">
      <div><div class="section-title">Réinitialisé</div><ul>${PRESTIGE_RESETS.map((t) => `<li class="bad">${t}</li>`).join('')}</ul></div>
      <div><div class="section-title">Conservé</div><ul>${PRESTIGE_KEEPS.map((t) => `<li class="good">${t}</li>`).join('')}</ul></div>
    </div>
    <button class="btn ${armed ? 'btn-danger' : 'btn-gold'}" data-action="prestige" ${can ? '' : 'disabled'}>${armed ? 'Confirmer le Prestige ?' : `Prestige (+★ ${stars})`}</button>
    <div class="section-title">Bonus éternels</div>${perks}
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
      ${prestigeCard(ui, state)}`;
  },
};
