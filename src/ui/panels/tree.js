// Arbre de talents permanents (fragments anciens) et Renaissance.
import { BALANCE } from '../../data/balance.js';
import { REBIRTH, REBIRTH_KEEPS, REBIRTH_RESETS, TALENT_BRANCHES, TALENTS } from '../../data/rebirth.js';
import { TREE } from '../../data/talent-tree.js';
import { rebirthMultiplier } from '../../core/stats.js';
import { TRANSCEND, TRANSCEND_KEEPS, TRANSCEND_PERKS, TRANSCEND_RESETS } from '../../data/transcend.js';
import { canTranscend, keptRebirthShare, perkLevel, stellarMultiplier, transcendPerkCost, transcendReward } from '../../core/transcend.js';
import { stageLabel } from '../../core/combat.js';
import {
  canRebirth, fragmentsSpent, rebirthBlocked, rebirthGain, rebirthReward, regionPoints, respecCost, talentById, talentConnected, talentCost,
  talentLevelEffects, talentPath, talentsOwned, talentUnlocked,
} from '../../core/rebirth.js';
import { perkCost } from '../../core/prestige.js';
import { PRESTIGE, PRESTIGE_PERKS } from '../../data/prestige.js';
import { costButton, effectText, escapeHtml, fold, fragment, formatNumber, img, segment, starsIcon } from '../common.js';
import { memoryShare } from '../../core/transcend.js';

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
const REGION_COLOR = Object.fromEntries(TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => [b.id, b.color]));
const KIND_LABEL = { core: 'Cœur', small: 'Talent', notable: 'Notable', keystone: 'Clé de voûte' };
const LINKS = (() => {
  const out = [];
  for (const t of TALENTS) for (const id of t.links) if (t.id < id) out.push([t, talentById(id)]);
  return out;
})();
// Texte de recherche de chaque nœud : nom + effets (en minuscules, sans accents).
const fold2 = (str) => String(str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Chaque mot cherché doit commencer un mot du talent (« or » trouve l'or, pas « Force »).
const words = (str) => fold2(str).split(/[^a-z0-9]+/).filter(Boolean);
const SEARCH_WORDS = new Map(TALENTS.map((t) => [t.id, words(`${t.name} ${effectText(talentLevelEffects(t, 1))} ${KIND_LABEL[t.kind]}`)]));
export function treeSearchHits(query, shown = null) {
  const q = words(query ?? '');
  if (!q.length || q.join('').length < 2) return null;
  return new Set(TALENTS.filter((t) => (!shown || shown.has(t.id)) && q.every((w) => SEARCH_WORDS.get(t.id).some((x) => x.startsWith(w)))).map((t) => t.id));
}

// Talents visibles : le Cœur, les talents appris et tous leurs voisins.
export function visibleTalents(state) {
  const shown = new Set(['core']);
  for (const t of TALENTS) {
    if (!(state.talents[t.id] ?? 0)) continue;
    shown.add(t.id);
    for (const id of t.links) shown.add(id);
  }
  for (const id of talentById('core').links) shown.add(id);
  return shown;
}

// Fenêtre centrée sur le Cœur à l'ouverture et à chaque zoom ; Ctrl + molette pour zoomer ; glisser pour se déplacer.
let centeredAt = null;
export const DEFAULT_ZOOM = 0.7;
export function recenterTree() { centeredAt = null; }

function nodeState(state, t) {
  const level = state.talents[t.id] ?? 0;
  return level >= t.max ? 'maxed' : level > 0 ? 'owned' : talentUnlocked(state, t) ? 'open' : talentConnected(state, t) ? 'gated' : 'locked';
}

// Légende (v9.1.0) : points de chaque région et son objectif (prochaine clé de voûte et points requis). Elle
// n'achète plus rien : l'achat par région est à part, avec confirmation (niveaux et fragments).
function regionSummary(state) {
  return TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => {
    const pts = regionPoints(state, b.id);
    const goal = TALENTS.filter((t) => t.region === b.id && t.gate && !(state.talents[t.id] ?? 0)).sort((x, y) => x.gate - y.gate)[0];
    return `<span class="region-goal" style="--branch:${b.color}"><b style="color:${b.color}">${b.label} ${pts}</b>
      ${goal ? `<span class="muted">→ ${escapeHtml(goal.name)} : ${pts >= goal.gate ? '<span class="good">prête</span>' : `${goal.gate - pts} point${goal.gate - pts > 1 ? 's' : ''}`}</span>` : ''}</span>`;
  }).join('');
}

// v9.1.3 (A18, essai) : vue Région — par région, ses points et ses clés de voûte en grandes icônes, avec l'état en
// un mot (apprise, prête, points manquants). Lecture seule, aucune donnée nouvelle ; un appui ouvre l'arbre dessus.
// Critère écrit avant l'essai : sur 375×812, les 6 régions et leurs 12 clés de voûte tiennent sans défiler dans le
// panneau, en moins de 80 mots, sans aucun bouton d'achat.
export function regionRows(state) {
  return TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => {
    const pts = regionPoints(state, b.id);
    const keys = TALENTS.filter((t) => t.region === b.id && t.kind === 'keystone').sort((x, y) => x.gate - y.gate).map((t) => {
      const owned = (state.talents[t.id] ?? 0) > 0;
      return { t, status: owned ? 'owned' : pts >= t.gate ? 'ready' : 'far', missing: Math.max(0, t.gate - pts) };
    });
    return { branch: b, pts, keys };
  });
}

function regionView(state) {
  const rows = regionRows(state).map(({ branch: b, pts, keys }) => `<div class="region-row" style="--branch:${b.color}">
      <div class="region-name"><b style="color:${b.color}">${b.label}</b><span class="muted">${pts} pts</span></div>
      ${keys.map(({ t, status, missing }) => `<button class="region-key ${status}" data-action="region-key" data-value="${t.id}" title="${escapeHtml(t.name)}" aria-label="${escapeHtml(t.name)}">
        ${img(t.icon)}<span>${status === 'owned' ? '✔' : status === 'ready' ? 'prête' : `${missing} pts`}</span></button>`).join('')}</div>`).join('');
  return `<div class="card region-view"><div class="muted">Touchez une clé de voûte pour la voir dans l'arbre.</div>${rows}</div>`;
}

function regionBuy(state) {
  return `<div class="chip-row">${TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => `<button class="btn small" data-action="ask-buy-talents" data-value="${b.id}"
    style="color:${b.color}">Région ${b.label}</button>`).join('')}</div><div class="muted">Apprend le moins cher d'abord, tant que les fragments suffisent (une confirmation suit).</div>`;
}

function detailCard(state, sel) {
  const level = state.talents[sel.id] ?? 0;
  const unlocked = talentUnlocked(state, sel);
  const connected = talentConnected(state, sel);
  const maxed = level >= sel.max;
  const region = TALENT_BRANCHES.find((b) => b.id === sel.region);
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
      </div>
    </div>`;
}

// v9.1.0 : le segment Renaissance existe dès que la Renaissance concerne le joueur (étape 30 atteinte une fois,
// ou déjà renée / transcendée) ; avant, l'onglet Talents ne montre que l'arbre.
export function rebirthSegmentOpen(state) {
  return Math.max(state.maxStage, state.records.bestStage ?? 1) >= REBIRTH.minStage || state.records.rebirths > 0 || (state.transcend?.count ?? 0) > 0;
}

export default {
  id: 'tree',
  title: 'Talents',
  icon: 'icon_tree',
  extra: (ui, state) => `${fragment()}<b class="num">${formatNumber(state.fragments)}</b>`,
  afterRender(ui, body) {
    const vp = body.querySelector('.tree-viewport');
    if (!vp) return;
    const zoom = ui.view.treeZoom ?? DEFAULT_ZOOM;
    // v8.6 : la fenêtre de l'arbre remplit exactement la hauteur du panneau (avant, le panneau défilait
    // aussi et cachait le haut ou le bas de l'arbre sous la barre de titre).
    const top = vp.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    const below = (body.querySelector('.tree-legend')?.offsetHeight ?? 0) + (body.querySelector('.tree-hint')?.offsetHeight ?? 0) + 28;
    vp.style.height = `${Math.round(Math.max(200, Math.min(1200, body.clientHeight - top - below)))}px`;
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
    vp.addEventListener('scroll', () => { ui.view.treeScroll = [vp.scrollLeft, vp.scrollTop]; });
    // Molette : déplace l'arbre (Maj = horizontalement), Ctrl + molette : zoom. Le panneau ne défile pas.
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const z = body.querySelector(`[data-action="tree-zoom"][data-value="${e.deltaY < 0 ? 'in' : 'out'}"]`);
        if (z) z.click();
        else { ui.view.treeZoom = Math.min(2, Math.max(0.3, (ui.view.treeZoom ?? DEFAULT_ZOOM) * (e.deltaY < 0 ? 1.25 : 0.8))); ui.invalidate(); } // v9.1.3 : outils repliés
        return;
      }
      vp.scrollLeft += e.shiftKey ? e.deltaY : e.deltaX;
      vp.scrollTop += e.shiftKey ? 0 : e.deltaY;
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
    // Recherche : surligne les talents correspondants sans redessiner le panneau.
    const input = body.querySelector('#tree-search');
    const highlight = () => {
      const hits = treeSearchHits(input.value, visibleTalents(ui.state));
      ui.view.treeSearch = input.value;
      body.querySelectorAll('.rune-tree .tnode').forEach((el) => el.classList.toggle('hit', Boolean(hits?.has(el.dataset.value))));
      body.querySelector('.tree-hits').textContent = hits ? `${hits.size} résultat${hits.size > 1 ? 's' : ''}` : '';
    };
    input?.addEventListener('input', highlight);
    if (input?.value) highlight();
  },
  render(ui, state) {
    const segOpen = rebirthSegmentOpen(state);
    // v9.1.3 (A18, essai) : vue « Région » (lecture seule) dès qu'un talent est appris.
    const regionOpen = talentsOwned(state) > 0;
    const seg = segOpen && ui.view.treeSeg === 'rebirth' ? 'rebirth' : regionOpen && ui.view.treeSeg === 'region' ? 'region' : 'tree';
    const items = [['tree', 'Arbre', 'icon_tree'], ...(regionOpen ? [['region', 'Région', 'icon_map']] : []), ...(segOpen ? [['rebirth', 'Renaissance', 'icon_rebirth']] : [])];
    const head = items.length > 1 ? segment(items, 'tree-seg', seg) : '';
    if (seg === 'rebirth') return head + rebirthView(ui, state);
    if (seg === 'region') return head + regionView(state);
    return head + treeView(ui, state);
  },
};

function treeView(ui, state) {
    const sel = talentById(ui.view.talentSel) ?? talentById('core');
    const zoom = ui.view.treeZoom ?? DEFAULT_ZOOM;
    const selPath = !(state.talents[sel.id] ?? 0) && !talentConnected(state, sel) ? new Set(talentPath(state, sel.id) ?? []) : new Set();
    // v8.9 : l'arbre se dévoile au fur et à mesure — seuls les talents appris et leurs voisins sont visibles.
    const shown = visibleTalents(state);
    const hits = treeSearchHits(ui.view.treeSearch, shown);
    const owned = (id) => (state.talents[id] ?? 0) > 0;
    // v8.7 : liens appris à la couleur de leur région (plus de mini-carte : l'arbre lui-même est coloré).
    const links = LINKS.filter(([a, b]) => shown.has(a.id) && shown.has(b.id)).map(([a, b]) => {
      const cls = owned(a.id) && owned(b.id) ? 'on' : owned(a.id) || owned(b.id) ? 'half' : selPath.has(a.id) && (selPath.has(b.id) || owned(b.id)) ? 'path' : '';
      const color = cls === 'on' ? REGION_COLOR[a.region] ?? REGION_COLOR[b.region] : null;
      return `<line x1="${(a.x + EXTENT).toFixed(2)}" y1="${(a.y + EXTENT).toFixed(2)}" x2="${(b.x + EXTENT).toFixed(2)}" y2="${(b.y + EXTENT).toFixed(2)}"${cls ? ` class="${cls}"` : ''}${color ? ` style="stroke:${color}"` : ''}/>`;
    }).join('');
    const nodes = TALENTS.filter((t) => shown.has(t.id)).map((t) => {
      const level = state.talents[t.id] ?? 0;
      const st = nodeState(state, t);
      const color = TALENT_BRANCHES.find((br) => br.id === t.region)?.color ?? '#ffe08a';
      const buyable = ui.view.treeBuyable && st === 'open' && state.fragments >= talentCost(t, level);
      const cls = `tnode k-${t.kind} ${st}${t.id === sel.id ? ' selected' : ''}${selPath.has(t.id) ? ' path' : ''}${hits?.has(t.id) || buyable ? ' hit' : ''}`;
      const inner = t.kind === 'small' ? (level ? `<span class="lv">${level}</span>` : '') : `${img(t.icon)}${t.max > 1 ? `<span class="lv">${level}/${t.max}</span>` : ''}`;
      return `<button class="${cls}" style="left:${pctX(t).toFixed(2)}%;top:${pctY(t).toFixed(2)}%;--branch:${color}" data-action="talent-sel" data-value="${t.id}"
        title="${escapeHtml(t.name)} · ${level}/${t.max} — ${escapeHtml(effectText(talentLevelEffects(t, Math.max(1, level))))}">${inner}</button>`;
    }).join('');
    const total = TALENTS.length;
    // v9.1.3 (doc1 « Talents ») : Recherche, Achetables, zoom et Tout apprendre sont repliés dans « Outils » ;
    // l'arbre, le compteur et les fragments restent seuls à l'ouverture.
    const tools = fold(ui, 'tree-tools', 'Outils', () => `<div class="tree-head">
        <input id="tree-search" type="search" placeholder="Chercher (or, critique, PV…)" value="${escapeHtml(ui.view.treeSearch ?? '')}" autocomplete="off" aria-label="Chercher un talent"><span class="tree-hits muted"></span>
        <label class="toggle"><input type="checkbox" data-action="tree-buyable" ${ui.view.treeBuyable ? 'checked' : ''}> Achetables</label>
      </div>
      <div class="tree-tools"><button class="btn btn-gold small" data-action="ask-buy-talents" data-value="">Tout apprendre…</button><span class="grow"></span>
        <button class="btn small" data-action="tree-zoom" data-value="out" title="Dézoomer">−</button>
        <span class="muted">${Math.round(zoom * 100)} %</span>
        <button class="btn small" data-action="tree-zoom" data-value="in" title="Zoomer">+</button>
        <button class="btn small" data-action="tree-zoom" data-value="reset" title="Taille normale, centrée sur le talent choisi">⟲</button></div>`,
    { cls: 'tree-tools-fold', extra: ui.view.treeSearch || ui.view.treeBuyable ? 'filtre actif' : '' });
    const tree = `<div class="tree-head">
        <span><b>${talentsOwned(state)}</b>/${total} talents · ${formatNumber(fragmentsSpent(state))} ${fragment()} investis
          ${total - shown.size > 0 ? `<span class="muted">· ${total - shown.size} encore cachés</span>` : ''}</span>
      </div>
      ${tools}
      <div class="tree-wrap"><div class="tree-viewport"><div class="rune-tree" style="width:${Math.round(TREE_PX * zoom)}px;height:${Math.round(TREE_PX * zoom)}px">
      <svg viewBox="0 0 ${SPAN} ${SPAN}" preserveAspectRatio="none" aria-hidden="true">${links}</svg>${nodes}</div></div></div>
      <div class="tree-legend">${regionSummary(state)}</div>`;

    const spent = fragmentsSpent(state);
    const respec = respecCost(state);
    return `<div class="card tree-card rune-card">${tree}</div>
      ${detailCard(state, sel)}
      ${fold(ui, 'tree-region-buy', 'Achat par région', () => regionBuy(state))}
      ${fold(ui, 'tree-respec', 'Réinitialiser l\'arbre', () => `<div class="row-between"><span class="muted">Rend les ${formatNumber(spent)} fragments investis.</span>
          <button class="btn small btn-danger" data-action="respec-talents" ${spent > 0 && state.gems >= respec ? '' : 'disabled'}>${respec ? `${formatNumber(respec)} gemmes` : 'Gratuit (1re fois)'}</button></div>`)}`;
}

// v9.1.3 (doc1 E) : les 3 multiplicateurs de prestige regroupés à l'affichage — Renaissances (et conservées),
// Transcendances, Puissance stellaire. Leur produit est rebirthMultiplier (core/stats.js).
export function prestigeFactors(state) {
  const total = rebirthMultiplier(state);
  const transcend = TRANSCEND.powerPerTranscend ** (state.transcend?.count ?? 0);
  const stellar = stellarMultiplier(state) / transcend;
  return { total, rebirth: total / (transcend * stellar), transcend, stellar };
}
const mult = (x) => (x < 1000 ? x.toFixed(2).replace('.', ',') : formatNumber(x));

// Segment Renaissance (v9.1.3, doc1 « Renaissance en 3 blocs » + doc2 A9) : 3 cartes (fragments, multiplicateur,
// pouvoir conservé), le retour à l'étape 1 en une ligne, le bouton ; total de prestige en une ligne ; Bonus
// (éternels + stellaires en une liste) et Transcendance repliés. Gardé / perdu : seulement dans la confirmation.
function rebirthView(ui, state) {
  const reward = rebirthReward(state);
  const can = canRebirth(state);
  const blocked = rebirthBlocked(state);
  const gain = PRESTIGE.rebirthMultiplier ** rebirthGain(state);
  const keep = memoryShare(state);
  const tile = (icon, value, label) => `<div class="rb-tile">${img(icon)}<b>${value}</b><span class="muted">${label}</span></div>`;
  const f = prestigeFactors(state);
  const total = f.total > 1 ? `<div class="rb-total"><span class="muted">Prestige actuel</span> <b class="good">×${mult(f.total)}</b> <span class="muted">dégâts, PV et or</span></div>` : '';
  return `<div class="card rebirth-card">
      <div class="row-between"><b>${img('icon_rebirth')} Renaissance</b><span class="muted">${state.records.rebirths} effectuée${state.records.rebirths > 1 ? 's' : ''}</span></div>
      ${can ? `<div class="rb-tiles">${tile('icon_fragment', `+${formatNumber(reward)}`, 'fragments')}${tile('icon_damage', `×${gain.toFixed(2).replace('.', ',')}`, 'pour toujours')}${tile('icon_boss', '1', 'pouvoir conservé')}</div>`
        : `<div>Atteignez l'étape ${stageLabel(REBIRTH.minStage)} pour renaître (max ${stageLabel(state.maxStage)}).</div>`}
      <div class="muted">Retour à l'étape 1${keep > 0 ? ` (${Math.round(keep * 100)} % des améliorations gardés)` : ''} ; le détail est dans la confirmation.</div>
      ${blocked && can ? `<div class="bad">${blocked}</div>` : ''}
      <button class="btn btn-gold primary-action" data-action="rebirth" ${can && !blocked ? '' : 'disabled'}>Renaître (+${formatNumber(reward)} ${fragment()})</button>
      ${total}
    </div>
    ${fold(ui, 'rebirth-bonus', 'Bonus éternels et stellaires', () => bonusList(state))}
    ${transcendFold(ui, state)}`;
}

// v9.1.3 (doc1 F, essai) : bonus éternels (fragments) et stellaires (Étoiles) en une seule liste ; chaque prix
// garde sa monnaie. Le détail des 3 multiplicateurs est en tête.
function bonusList(state) {
  const p = state.prestige;
  const t = state.transcend;
  const f = prestigeFactors(state);
  const detail = `<div class="muted rb-detail">Renaissance ×${mult(f.rebirth)} × Transcendance ×${mult(f.transcend)} × Puissance stellaire ×${mult(f.stellar)}
    = <b class="good">×${mult(f.total)}</b>. Chaque Renaissance vaut ×${String(PRESTIGE.rebirthMultiplier).replace('.', ',')} ; les boss ne se renforcent que de ${BALANCE.stages.rebirthBossPct} %.</div>`;
  const eternal = PRESTIGE_PERKS.map((perk) => {
    const level = p.perks[perk.id] ?? 0;
    const maxed = level >= perk.max;
    const eff = Object.fromEntries(Object.entries(perk.effect).map(([k, v]) => [k, v * Math.max(1, level)]));
    return `<div class="perk-row">${img(perk.icon)}<div class="grow"><b>${perk.name}</b> <span class="muted">${level}/${perk.max}</span>
        <div class="${level ? 'good' : 'muted'}">${effectText(eff)}${level ? '' : ' (au niveau 1)'}</div></div>
      ${costButton({ action: 'buy-perk', cost: perkCost(level), have: state.fragments, currency: 'fragments', attrs: `data-key="${perk.id}"`, cls: 'btn-gold small', max: maxed })}</div>`;
  }).join('');
  const showStellar = t && (canTranscend(state) || t.count || t.stars);
  const stellar = !showStellar ? '' : TRANSCEND_PERKS.map((perk) => {
    const level = perkLevel(state, perk.id);
    const maxed = level >= perk.max;
    return `<div class="perk-row">${img(perk.icon)}<div class="grow"><b>${escapeHtml(perk.name)}</b> <span class="muted">${level}/${perk.max}</span> ${starsIcon()}
        <div class="${level ? 'good' : 'muted'}">${perk.text(Math.max(1, level))}${level ? '' : ' (au niveau 1)'}</div></div>
      ${costButton({ action: 'buy-tperk', cost: transcendPerkCost(perk, level), have: t.stars, currency: 'stars', attrs: `data-key="${perk.id}"`, cls: 'btn-gold small', max: maxed })}
      ${maxed ? '' : `<button class="btn small" data-action="buy-tperk-max" data-key="${perk.id}">Max</button>`}</div>`;
  }).join('');
  return `${detail}${eternal}${stellar}`;
}

// Transcendance (v8.8) : Étoiles. v9.1.3 : repliée ; ses bonus stellaires sont dans la liste des bonus, gardé / perdu
// dans sa confirmation.
function transcendFold(ui, state) {
  const t = state.transcend;
  // v9.1.0 : la Transcendance n'apparaît que lorsqu'elle concerne le joueur.
  if (!canTranscend(state) && !t.count && !t.stars) return '';
  const reward = transcendReward(state);
  return fold(ui, 'rebirth-transcend', 'Transcendance', () => `
    <div class="muted">Recommencez tout (Renaissances comprises, ${Math.round(keptRebirthShare(state) * 100)} % gardées) contre des <b>Étoiles</b> ;
      chaque Transcendance multiplie aussi dégâts, PV et or ×${TRANSCEND.powerPerTranscend} pour toujours.</div>
    ${reward > 0 && rebirthBlocked(state) ? `<div class="bad">${rebirthBlocked(state)}</div>` : ''}
    <button class="btn btn-gold" data-action="transcend" ${reward > 0 && !rebirthBlocked(state) ? '' : 'disabled'}>Transcender <b class="num">+${formatNumber(reward)}</b> ${starsIcon()}</button>`,
  { extra: `${t.count} · ${formatNumber(t.stars)} ${starsIcon()}` });
}

export function transcendKeepResetLists() {
  return `<div class="keep-reset">
      <div><div class="section-title">Réinitialisé</div><ul>${TRANSCEND_RESETS.map((x) => `<li class="bad">${x}</li>`).join('')}</ul></div>
      <div><div class="section-title">Conservé</div><ul>${TRANSCEND_KEEPS.map((x) => `<li class="good">${x}</li>`).join('')}</ul></div>
    </div>`;
}
