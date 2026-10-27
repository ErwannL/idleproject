// Arbre de talents permanents (fragments anciens) et Renaissance.
import { BALANCE } from '../../data/balance.js';
import { REBIRTH, REBIRTH_KEEPS, REBIRTH_RESETS, TALENT_BRANCHES, TALENTS } from '../../data/rebirth.js';
import { TREE } from '../../data/talent-tree.js';
import { stageLabel } from '../../core/combat.js';
import {
  canRebirth, fragmentsSpent, pathCost, rebirthReward, regionPoints, respecCost, talentById, talentConnected, talentCost,
  talentLevelEffects, talentPath, talentsOwned, talentUnlocked,
} from '../../core/rebirth.js';
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

// Arbre « mastodonte » (v8.5) : ~500 nœuds placés en cercle autour du Cœur (unités de src/data/talent-tree.js).
// UNIT = pixels par unité à 100 % ; la taille des nœuds est en % de l'arbre (elle suit le zoom).
const UNIT = 64;
const EXTENT = TREE.rings + 1.2;
const SPAN = EXTENT * 2;
const TREE_PX = SPAN * UNIT;
const pctX = (t) => ((t.x + EXTENT) / SPAN) * 100;
const pctY = (t) => ((t.y + EXTENT) / SPAN) * 100;
const KIND_LABEL = { core: 'Cœur', small: 'Talent', notable: 'Notable', keystone: 'Clé de voûte' };
const LINKS = (() => {
  const out = [];
  for (const t of TALENTS) for (const id of t.links) if (t.id < id) out.push([t, talentById(id)]);
  return out;
})();
// Texte de recherche de chaque nœud : nom + effets (en minuscules, sans accents).
const fold = (str) => String(str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Chaque mot cherché doit commencer un mot du talent (« or » trouve l'or, pas « Force »).
const words = (str) => fold(str).split(/[^a-z0-9]+/).filter(Boolean);
const SEARCH_WORDS = new Map(TALENTS.map((t) => [t.id, words(`${t.name} ${effectText(talentLevelEffects(t, 1))} ${KIND_LABEL[t.kind]}`)]));
export function treeSearchHits(query) {
  const q = words(query ?? '');
  if (!q.length || q.join('').length < 2) return null;
  return new Set(TALENTS.filter((t) => q.every((w) => SEARCH_WORDS.get(t.id).some((x) => x.startsWith(w)))).map((t) => t.id));
}

// Fenêtre centrée sur le Cœur à l'ouverture et à chaque zoom ; Ctrl + molette pour zoomer ; glisser pour se déplacer.
let centeredAt = null;
export const DEFAULT_ZOOM = 0.7;
export function recenterTree() { centeredAt = null; }

function nodeState(state, t) {
  const level = state.talents[t.id] ?? 0;
  return level >= t.max ? 'maxed' : level > 0 ? 'owned' : talentUnlocked(state, t) ? 'open' : talentConnected(state, t) ? 'gated' : 'locked';
}

function minimap(state) {
  const dots = TALENTS.map((t) => {
    const st = nodeState(state, t);
    const color = st === 'maxed' || st === 'owned' ? (TALENT_BRANCHES.find((b) => b.id === t.region)?.color ?? '#ffe08a') : st === 'open' ? '#c98a35' : '#3a3d45';
    return `<circle cx="${(t.x + EXTENT).toFixed(2)}" cy="${(t.y + EXTENT).toFixed(2)}" r="${t.kind === 'small' ? 0.28 : 0.45}" fill="${color}"/>`;
  }).join('');
  return `<div class="tree-minimap" title="Mini-carte : cliquer pour s'y rendre"><svg viewBox="0 0 ${SPAN} ${SPAN}">${dots}<rect class="mm-view" x="0" y="0" width="0" height="0"/></svg></div>`;
}

function regionSummary(state) {
  return TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => `<span style="color:${b.color}">● ${b.label} <b>${regionPoints(state, b.id)}</b></span>`).join('');
}

function detailCard(state, sel) {
  const level = state.talents[sel.id] ?? 0;
  const unlocked = talentUnlocked(state, sel);
  const connected = talentConnected(state, sel);
  const maxed = level >= sel.max;
  const region = TALENT_BRANCHES.find((b) => b.id === sel.region);
  const path = !level && !connected ? talentPath(state, sel.id) : null;
  const gate = sel.gate && regionPoints(state, sel.region) < sel.gate
    ? `<div class="bad">Clé de voûte : dépensez ${sel.gate} points dans la région ${region?.label ?? ''} (actuellement ${regionPoints(state, sel.region)}).</div>` : '';
  return `<div class="card talent-detail">
      <div class="row-between"><b class="gold-text">${escapeHtml(sel.name)}</b><span class="muted">${KIND_LABEL[sel.kind]}${region ? ` · <span style="color:${region.color}">${region.label}</span>` : ''} · niv. ${level}/${sel.max}</span></div>
      <div>${level ? effectText(talentLevelEffects(sel, level)) : '<span class="muted">Pas encore appris</span>'}</div>
      ${maxed ? '' : `<div class="muted">${level ? 'Prochain niveau' : 'Au niveau 1'} : <span class="good">${effectText(talentLevelEffects(sel, level + 1))}</span></div>`}
      ${connected || level ? '' : '<div class="bad">Pas encore relié : apprenez d\'abord un talent voisin.</div>'}
      ${gate}
      <div class="detail-actions">
        ${costButton({ action: 'buy-talent', cost: talentCost(sel, level), have: state.fragments, currency: 'fragments', attrs: `data-key="${sel.id}"`, label: 'Apprendre ', max: maxed, locked: !unlocked })}
        ${sel.max > 1 && !maxed && unlocked ? `<button class="btn small" data-action="buy-talent-max" data-key="${sel.id}">Max</button>` : ''}
        ${path?.length ? `<button class="btn small btn-gold" data-action="buy-talent-path" data-key="${sel.id}" title="Apprend un niveau de chaque talent du chemin le moins cher, tant que les fragments suffisent">Chemin : ${path.length} talent${path.length > 1 ? 's' : ''} · ${formatNumber(pathCost(path))} ${fragment()}</button>` : ''}
      </div>
    </div>`;
}

export default {
  id: 'tree',
  title: 'Arbre de talents',
  icon: 'icon_tree',
  extra: (ui, state) => `${fragment()}<b class="num">${formatNumber(state.fragments)}</b>`,
  afterRender(ui, body) {
    const vp = body.querySelector('.tree-viewport');
    if (!vp) return;
    const zoom = ui.view.treeZoom ?? DEFAULT_ZOOM;
    const mmRect = body.querySelector('.mm-view');
    const syncMinimap = () => {
      if (!mmRect) return;
      const k = SPAN / vp.scrollWidth;
      mmRect.setAttribute('x', vp.scrollLeft * k);
      mmRect.setAttribute('y', vp.scrollTop * k);
      mmRect.setAttribute('width', vp.clientWidth * k);
      mmRect.setAttribute('height', vp.clientHeight * k);
    };
    // Centre sur la partie de l'arbre réellement visible (le panneau peut couper le bas de la fenêtre).
    const centerOn = (ux, uy) => {
      const visibleH = Math.max(60, Math.min(vp.clientHeight, body.getBoundingClientRect().bottom - vp.getBoundingClientRect().top));
      vp.scrollLeft = ((ux + EXTENT) / SPAN) * vp.scrollWidth - vp.clientWidth / 2;
      vp.scrollTop = ((uy + EXTENT) / SPAN) * vp.scrollHeight - visibleH / 2;
    };
    if (centeredAt !== zoom) {
      centeredAt = zoom;
      const sel = talentById(ui.view.talentSel) ?? talentById('core');
      centerOn(sel.x, sel.y);
    } else if (ui.view.treeScroll) {
      [vp.scrollLeft, vp.scrollTop] = ui.view.treeScroll;
    }
    syncMinimap();
    vp.addEventListener('scroll', () => { ui.view.treeScroll = [vp.scrollLeft, vp.scrollTop]; syncMinimap(); });
    vp.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      body.querySelector(`[data-action="tree-zoom"][data-value="${e.deltaY < 0 ? 'in' : 'out'}"]`)?.click();
    }, { passive: false });
    // Glisser le fond de l'arbre pour se déplacer (comme une carte).
    let drag = null;
    vp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      drag = { x: e.clientX, y: e.clientY, left: vp.scrollLeft, top: vp.scrollTop };
      vp.setPointerCapture(e.pointerId);
      vp.classList.add('dragging');
    });
    vp.addEventListener('pointermove', (e) => {
      if (!drag) return;
      vp.scrollLeft = drag.left - (e.clientX - drag.x);
      vp.scrollTop = drag.top - (e.clientY - drag.y);
    });
    const stop = () => { drag = null; vp.classList.remove('dragging'); };
    vp.addEventListener('pointerup', stop);
    vp.addEventListener('pointercancel', stop);
    // Mini-carte : un clic centre la vue à cet endroit.
    body.querySelector('.tree-minimap svg')?.addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      centerOn(((e.clientX - r.left) / r.width) * SPAN - EXTENT, ((e.clientY - r.top) / r.height) * SPAN - EXTENT);
    });
    // Recherche : surligne les talents correspondants sans redessiner le panneau.
    const input = body.querySelector('#tree-search');
    const highlight = () => {
      const hits = treeSearchHits(input.value);
      ui.view.treeSearch = input.value;
      body.querySelectorAll('.rune-tree .tnode').forEach((el) => el.classList.toggle('hit', Boolean(hits?.has(el.dataset.value))));
      body.querySelector('.tree-hits').textContent = hits ? `${hits.size} résultat${hits.size > 1 ? 's' : ''}` : '';
    };
    input?.addEventListener('input', highlight);
    if (input?.value) highlight();
  },
  render(ui, state) {
    const sel = talentById(ui.view.talentSel) ?? talentById('core');
    const zoom = ui.view.treeZoom ?? DEFAULT_ZOOM;
    const selPath = !(state.talents[sel.id] ?? 0) && !talentConnected(state, sel) ? new Set(talentPath(state, sel.id) ?? []) : new Set();
    const hits = treeSearchHits(ui.view.treeSearch);
    const owned = (id) => (state.talents[id] ?? 0) > 0;
    const links = LINKS.map(([a, b]) => {
      const cls = owned(a.id) && owned(b.id) ? 'on' : owned(a.id) || owned(b.id) ? 'half' : selPath.has(a.id) && (selPath.has(b.id) || owned(b.id)) ? 'path' : '';
      return `<line x1="${(a.x + EXTENT).toFixed(2)}" y1="${(a.y + EXTENT).toFixed(2)}" x2="${(b.x + EXTENT).toFixed(2)}" y2="${(b.y + EXTENT).toFixed(2)}"${cls ? ` class="${cls}"` : ''}/>`;
    }).join('');
    const nodes = TALENTS.map((t) => {
      const level = state.talents[t.id] ?? 0;
      const st = nodeState(state, t);
      const color = TALENT_BRANCHES.find((br) => br.id === t.region)?.color ?? '#ffe08a';
      const cls = `tnode k-${t.kind} ${st}${t.id === sel.id ? ' selected' : ''}${selPath.has(t.id) ? ' path' : ''}${hits?.has(t.id) ? ' hit' : ''}`;
      const inner = t.kind === 'small' ? (level ? `<span class="lv">${level}</span>` : '') : `${img(t.icon)}${t.max > 1 ? `<span class="lv">${level}/${t.max}</span>` : ''}`;
      return `<button class="${cls}" style="left:${pctX(t).toFixed(2)}%;top:${pctY(t).toFixed(2)}%;--branch:${color}" data-action="talent-sel" data-value="${t.id}"
        title="${escapeHtml(t.name)} · ${level}/${t.max} — ${escapeHtml(effectText(talentLevelEffects(t, Math.max(1, level))))}">${inner}</button>`;
    }).join('');
    const total = TALENTS.length;
    const tree = `<div class="tree-head">
        <span><b>${talentsOwned(state)}</b>/${total} talents · ${formatNumber(fragmentsSpent(state))} ${fragment()} investis</span>
        <span class="grow"></span>
        <input id="tree-search" type="search" placeholder="Chercher (or, critique, PV…)" value="${escapeHtml(ui.view.treeSearch ?? '')}" autocomplete="off"><span class="tree-hits muted"></span>
      </div>
      <div class="tree-tools"><button class="btn small" data-action="tree-zoom" data-value="out" title="Dézoomer">−</button>
        <span class="muted">${Math.round(zoom * 100)} %</span>
        <button class="btn small" data-action="tree-zoom" data-value="in" title="Zoomer">+</button>
        <button class="btn small" data-action="tree-zoom" data-value="reset" title="Taille normale, centrée sur le talent choisi">⟲</button></div>
      <div class="tree-wrap"><div class="tree-viewport"><div class="rune-tree" style="width:${Math.round(TREE_PX * zoom)}px;height:${Math.round(TREE_PX * zoom)}px">
      <svg viewBox="0 0 ${SPAN} ${SPAN}" preserveAspectRatio="none" aria-hidden="true">${links}</svg>${nodes}</div></div>${minimap(state)}</div>
      <div class="tree-legend">${regionSummary(state)}</div>
      <div class="muted tree-hint">Un talent s'apprend dès qu'un talent voisin est appris. Petits nœuds : 3 niveaux · ◆ notables · ⬢ clés de voûte (effets puissants, parfois avec un prix).
        Glissez pour vous déplacer, Ctrl + molette pour zoomer.</div>`;

    const reward = rebirthReward(state);
    const can = canRebirth(state);
    const spent = fragmentsSpent(state);
    const respec = respecCost(state);
    return `<div class="card tree-card rune-card">${tree}</div>
      ${detailCard(state, sel)}
      <div class="card">
        <div class="row-between"><span><b>Réinitialiser l'arbre</b> <span class="muted">— rend les ${formatNumber(spent)} fragments investis</span></span>
          <button class="btn small btn-danger" data-action="respec-talents" ${spent > 0 && state.gems >= respec ? '' : 'disabled'}>${respec ? `${formatNumber(respec)} gemmes` : 'Gratuit (1re fois)'}</button></div>
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
