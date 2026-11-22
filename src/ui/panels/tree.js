// Arbre de talents permanents (fragments anciens) et Renaissance.
import { BALANCE } from '../../data/balance.js';
import { REBIRTH, REBIRTH_KEEPS, REBIRTH_RESETS, TALENT_BRANCHES, TALENTS } from '../../data/rebirth.js';
import { TREE } from '../../data/talent-tree.js';
import { computeHeroStats, rebirthMultiplier } from '../../core/stats.js';
import { rebirthCatchUp, rebirthWorth } from '../../core/rebirth.js'; // v10.8 (6)
import { formatDuration } from '../../core/format.js';
import { TRANSCEND, TRANSCEND_KEEPS, TRANSCEND_PERKS, TRANSCEND_RESETS } from '../../data/transcend.js';
import { canTranscend, keptRebirthShare, perkLevel, stellarMultiplier, transcendPerkCost, transcendReward } from '../../core/transcend.js';
import { stageLabel } from '../../core/combat.js';
import {
  canRebirth, fragmentsSpent, rebirthBlocked, rebirthGain, rebirthReward, regionPoints, respecCost, talentById, talentConnected, talentCost,
  talentLevelEffects, talentsOwned, talentUnlocked,
  suggestedTalent,
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
export const DEFAULT_ZOOM = 1; // v9.2.7 : 1 (avant 0,7) pour lire icônes, valeurs et coûts
export function recenterTree() { centeredAt = null; }

function nodeState(state, t) {
  const level = state.talents[t.id] ?? 0;
  return level >= t.max ? 'maxed' : level > 0 ? 'owned' : talentUnlocked(state, t) ? 'open' : talentConnected(state, t) ? 'gated' : 'locked';
}

// v9.1.3 (A18, essai) : vue Région — par région, ses points et ses clés de voûte en grandes icônes, avec l'état en
// un mot (apprise, prête, points manquants). Lecture seule, aucune donnée nouvelle ; un appui ouvre l'arbre dessus.
// Critère écrit avant l'essai : sur 375×812, les 6 régions et leurs 12 clés de voûte tiennent sans défiler dans le
// panneau, en moins de 80 mots, sans aucun bouton d'achat.
// ---- v9.3.9 (3.9) : vue simple des Talents ----
// Même arbre, mêmes fragments (rien à rembourser) : chaque région devient une branche en ligne droite, nommée par ce
// qu'elle fait, avec 15 paliers ; « Apprendre » prend le talent le moins cher de la branche ; un gros palier tous les 5.
export const SIMPLE_BRANCHES = {
  combat: { name: 'Attaque', icon: 'icon_damage' },
  hunt: { name: 'Chasse aux monstres', icon: 'icon_boss' },
  resources: { name: 'Or et butin', icon: 'coin' },
  special: { name: 'Compagnons', icon: 'icon_paw' },
  arcane: { name: 'Compétences', icon: 'icon_book' },
  survival: { name: 'Survie', icon: 'icon_heart' },
};
const TIERS = 15;
export const advancedOpen = (state) => (state.records?.rebirths ?? 0) >= 3 || (state.transcend?.count ?? 0) > 0 || talentsOwned(state) > 40;
const regionTotal = new Map();
function branchMax(region) {
  if (!regionTotal.has(region)) regionTotal.set(region, TALENTS.filter((t) => t.region === region).reduce((n, t) => n + t.max, 0));
  return regionTotal.get(region);
}
// Prochain talent de la branche : le moins cher apprenable (le Cœur d'abord s'il n'est pas appris).
export function branchNext(state, region) {
  let best = null;
  for (const t of TALENTS) {
    if (t.region !== region && t.id !== 'core') continue;
    const lv = state.talents[t.id] ?? 0;
    if (lv >= t.max || !talentUnlocked(state, t)) continue;
    const cost = talentCost(t, lv);
    if (!best || cost < best.cost) best = { t, cost, lv };
  }
  return best;
}
function branchBonus(state, region) {
  const sum = {};
  for (const t of TALENTS) {
    if (t.region !== region) continue;
    const lv = state.talents[t.id] ?? 0;
    if (lv > 0) for (const [k, v] of Object.entries(talentLevelEffects(t, lv))) sum[k] = (sum[k] ?? 0) + v;
  }
  return effectText(sum);
}
function simpleView(state) {
  const pts = (r) => TALENTS.filter((t) => t.region === r).reduce((n, t) => n + (state.talents[t.id] ?? 0), 0);
  // v9.9 (K3) : 3 grandes cartes (Attaque, Survie, Or et butin), les autres branches repliées ; barre de rang vers le
  // titre suivant ; l'arbre détaillé derrière « Voir l'arbre ».
  const MAIN = ['combat', 'survival', 'resources'];
  const card = (b) => {
    const meta = SIMPLE_BRANCHES[b.id];
    const per = Math.max(1, Math.ceil(branchMax(b.id) / TIERS));
    const tier = Math.min(TIERS, Math.ceil(pts(b.id) / per)); // v9.8 (C2) : dès le premier talent (avant « Palier 0 » avec un bonus déjà là)
    const next = branchNext(state, b.id);
    const big = next && (next.t.kind === 'notable' || next.t.kind === 'keystone');
    const steps = Array.from({ length: TIERS }, (_, i) => `<i class="${i < tier ? 'on' : ''}${(i + 1) % 5 === 0 ? ' big' : ''}"></i>`).join('');
    const bonus = branchBonus(state, b.id);
    const what = next ? `${big ? '<b class="gold-text">Gros palier : </b>' : ''}${escapeHtml(next.t.name)} — ${effectText(talentLevelEffects(next.t, next.lv + 1))}` : '<span class="good">Branche terminée</span>';
    const btn = next ? costButton({ action: 'talent-branch', cost: next.cost, have: state.fragments, currency: 'fragments', label: 'Apprendre ', attrs: `data-value="${b.id}"`, cls: big ? 'btn-gold' : 'btn-primary' }) : '';
    return `<div class="tb-row${big ? ' tb-big' : ''}" style="--branch:${b.color}">
      <div class="tb-head"><img class="px tb-medal" src="assets/ui/art106/talent_region_${b.id}.png" alt=""><b>${meta.name}</b><span class="muted">Palier ${tier}/${TIERS}</span></div>
      <div class="tb-steps" aria-hidden="true">${steps}</div>
      <div class="tb-bonus">${bonus ? `Bonus : <b class="good">${bonus}</b>` : '<span class="muted">Aucun talent appris</span>'}</div>
      <div class="tb-next"><span>Prochain : ${what}</span>${btn}</div></div>`;
  };
  const branches = TALENT_BRANCHES.filter((b) => SIMPLE_BRANCHES[b.id]);
  const rows = `<div class="tb-main">${branches.filter((b) => MAIN.includes(b.id)).map(card).join('')}</div>
    <details class="tb-others"><summary>Autres branches (${branches.length - MAIN.length})</summary><div class="tb-list">${branches.filter((b) => !MAIN.includes(b.id)).map(card).join('')}</div></details>`;
  const total = TALENTS.reduce((n, t) => n + (state.talents[t.id] ?? 0), 0);
  const TITLES = ['Apprenti', 'Adepte', 'Expert', 'Maître', 'Grand maître', 'Sage', 'Légende'];
  const rank = Math.min(TITLES.length - 1, Math.floor(total / 25));
  const into = rank >= TITLES.length - 1 ? 1 : (total % 25) / 25;
  const rankBar = `<div class="tb-rank"><b>${TITLES[rank]}</b><div class="tb-rank-bar"><i style="width:${Math.round(into * 100)}%"></i></div><span class="muted">${rank >= TITLES.length - 1 ? 'Titre maximal' : `${25 - (total % 25)} talents pour : ${TITLES[rank + 1]}`}</span></div>`;
  const sg = suggestedTalent(state);
  return `<div class="card tb-intro"><p>La Renaissance te ramène au monde 1 contre des fragments. Les fragments achètent des talents qui restent pour toujours.</p>
      <div class="row-between"><span>${fragment()} <b>${formatNumber(state.fragments)}</b> fragments</span>
      ${sg ? '<button class="btn btn-gold" data-action="talent-best">Apprendre le meilleur</button>' : `<span class="cost-wrap"><button class="btn" disabled>Apprendre le meilleur</button>${(() => {
        // v10.0 (7) : rien d'achetable → bouton gris et ce qui manque.
        const costs = TALENTS.filter((t) => (state.talents[t.id] ?? 0) < t.max && talentUnlocked(state, t)).map((t) => talentCost(t, state.talents[t.id] ?? 0));
        const miss = costs.length ? Math.max(0, Math.min(...costs) - state.fragments) : 0;
        return miss ? `<small class="cost-missing">Il manque ${formatNumber(miss)} fragment${miss > 1 ? 's' : ''}</small>` : '';
      })()}</span>`}</div></div>
    ${rankBar}${rows}
    ${advancedOpen(state) ? '<button class="btn" data-action="tree-seg" data-value="tree">Voir l\'arbre</button>' : '<button class="btn" disabled>Voir l\'arbre · après 3 Renaissances</button>'}`;
}

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
  return `<div class="card region-view"><div class="muted">Touche une clé de voûte pour la voir dans l'arbre.</div>${rows}</div>`;
}

function regionBuy(state) {
  return `<div class="chip-row">${TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => `<button class="btn small" data-action="ask-buy-talents" data-value="${b.id}"
    style="color:${b.color}">Région ${b.label}</button>`).join('')}</div><div class="muted">Apprend le moins cher d'abord, tant que les fragments suffisent (une confirmation suit).</div>`;
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
    const tree = vp.querySelector('.rune-tree');
    let zoom = ui.view.treeZoom ?? DEFAULT_ZOOM;
    // v9.2.7 : la fenêtre de l'arbre laisse voir la barre de sélection (bouton d'achat) sous elle.
    const below = (body.querySelector('.tree-sel')?.offsetHeight ?? 0) + 22;
    const k = body.getBoundingClientRect().height / (body.offsetHeight || 1) || 1; // l'interface peut être agrandie (transform)
    const vis = (body.getBoundingClientRect().bottom - vp.getBoundingClientRect().top) / k - below;
    const inCard = (vp.getBoundingClientRect().top - (body.querySelector('.tree-card')?.getBoundingClientRect().top ?? 0)) / k + 4;
    vp.style.height = `${Math.round(Math.max(220, Math.min(1200, vis >= 300 ? vis : body.clientHeight - inCard - below)))}px`;
    const centerOn = (ux, uy, smooth = false) => {
      const left = ((ux + EXTENT) / SPAN) * tree.offsetWidth - vp.clientWidth / 2;
      const topPx = ((uy + EXTENT) / SPAN) * tree.offsetHeight - vp.clientHeight / 2;
      vp.scrollTo({ left, top: topPx, behavior: smooth ? 'smooth' : 'auto' });
    };
    if (centeredAt !== zoom) {
      centeredAt = zoom;
      // v9.2.7 : à l'ouverture, si l'arbre et sa barre d'achat ne tiennent pas, le panneau défile jusqu'à l'arbre.
      const card = body.querySelector('.tree-card');
      const bar = body.querySelector('.tree-sel');
      if (card && bar && bar.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom) body.scrollTop += (card.getBoundingClientRect().top - body.getBoundingClientRect().top) / k - 4;
      const sel = talentById(ui.view.talentSel) ?? talentById('core');
      centerOn(sel.x, sel.y);
    } else if (ui.view.treeScroll) {
      [vp.scrollLeft, vp.scrollTop] = ui.view.treeScroll;
    }
    vp.addEventListener('scroll', () => { ui.view.treeScroll = [vp.scrollLeft, vp.scrollTop]; }, { passive: true });
    // v9.2.7 : zoom fluide sans redessiner le panneau, autour du point visé (curseur, pincement ou centre).
    let anim = 0;
    const applyZoom = (z, fx, fy) => {
      const w = tree.offsetWidth;
      const ux = (vp.scrollLeft + fx) / w;
      const uy = (vp.scrollTop + fy) / w;
      const px = Math.round(TREE_PX * z);
      tree.style.width = tree.style.height = `${px}px`;
      tree.style.setProperty('--tz', z);
      vp.scrollLeft = ux * px - fx;
      vp.scrollTop = uy * px - fy;
      zoom = z;
      ui.view.treeZoom = z;
      centeredAt = z;
      tree.classList.toggle('far', z < 0.5);
    };
    const zoomTo = (target, fx = vp.clientWidth / 2, fy = vp.clientHeight / 2, instant = false) => {
      target = Math.min(2, Math.max(0.3, target));
      cancelAnimationFrame(anim);
      if (instant || document.documentElement.classList.contains('reduce-motion')) { applyZoom(target, fx, fy); return; }
      const from = zoom;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 180);
        applyZoom(from + (target - from) * (1 - (1 - k) ** 3), fx, fy);
        if (k < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    };
    tree.classList.toggle('far', zoom < 0.5);
    body.querySelector('.tree-zoom')?.addEventListener('click', (e) => {
      const b = e.target.closest('.tz-btn');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.z === 'center') {
        const sel = talentById(ui.view.talentSel) ?? talentById('core');
        centerOn(sel.x, sel.y, true);
      } else zoomTo(zoom * (b.dataset.z === 'in' ? 1.3 : 1 / 1.3));
    });
    // Molette : défile ; Ctrl + molette (ou pincement du pavé) : zoom autour du curseur.
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      if (e.ctrlKey) { zoomTo(zoom * Math.exp(-e.deltaY * 0.004), e.clientX - r.left, e.clientY - r.top, true); return; }
      vp.scrollLeft += e.shiftKey ? e.deltaY : e.deltaX;
      vp.scrollTop += e.shiftKey ? 0 : e.deltaY;
    }, { passive: false });
    // Glisser pour se déplacer ; deux doigts pour zoomer.
    const pts = new Map();
    let drag = null;
    let pinch = null;
    vp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const r = vp.getBoundingClientRect();
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom, fx: (a[0] + b[0]) / 2 - r.left, fy: (a[1] + b[1]) / 2 - r.top };
        drag = null;
        return;
      }
      if (e.target.closest('button')) return;
      drag = { x: e.clientX, y: e.clientY, left: vp.scrollLeft, top: vp.scrollTop };
      vp.setPointerCapture(e.pointerId);
      vp.classList.add('dragging');
    });
    vp.addEventListener('pointermove', (e) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        applyZoom(Math.min(2, Math.max(0.3, pinch.z * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d))), pinch.fx, pinch.fy);
        return;
      }
      if (!drag) return;
      vp.scrollLeft = drag.left - (e.clientX - drag.x);
      vp.scrollTop = drag.top - (e.clientY - drag.y);
    });
    const stop = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; drag = null; vp.classList.remove('dragging'); };
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
    // v9.3.9 (3.9) : vue simple par défaut (6 branches en ligne droite) ; l'arbre complet devient « Arbre avancé »,
    // ouvert après 3 Renaissances (ou si le joueur s'en servait déjà).
    const advanced = advancedOpen(state);
    const regionOpen = advanced && talentsOwned(state) > 0;
    const want = ui.view.treeSeg;
    const seg = segOpen && want === 'rebirth' ? 'rebirth' : advanced && want === 'tree' ? 'tree' : regionOpen && want === 'region' ? 'region' : 'simple';
    const items = [['simple', 'Talents', 'icon_tree'], ...(advanced ? [['tree', 'Arbre avancé', 'icon_map']] : []), ...(segOpen ? [['rebirth', 'Renaissance', 'icon_rebirth']] : [])];
    if (seg === 'simple') return (items.length > 1 ? segment(items, 'tree-seg', seg) : '') + simpleView(state);
    const head = items.length > 1 ? segment(items, 'tree-seg', seg) : '';
    if (seg === 'rebirth') return head + rebirthView(ui, state);
    if (seg === 'region') return head + regionView(state);
    return head + treeView(ui, state);
  },
};

// v9.2.7 : arbre refait pour la lisibilité — chaque nœud montre son icône, sa valeur, son état et son coût ; les
// régions ont un nom et une couleur dans l'arbre ; le talent choisi montre ce qu'il débloque (nœuds fantômes) ;
// barre de sélection avec le bouton d'achat juste sous l'arbre ; légende, aide, zoom et défilement fluides.
const STAT_ICON = {
  damagePct: 'icon_damage', critChance: 'icon_crit', attackSpeedPct: 'icon_bolt', maxHpPct: 'icon_heart', armor: 'icon_shield',
  regenPct: 'icon_regen', lifesteal: 'icon_heart', damageVsBossPct: 'icon_boss', xpPct: 'icon_xp', goldPct: 'coin', dropChance: 'icon_bag',
  damageVsNormalPct: 'icon_damage', companionPct: 'icon_paw', skillCooldownPct: 'icon_book', thorns: 'icon_shield', lowHpArmor: 'icon_shield',
};
const nodeIcon = (t) => (t.kind === 'small' ? STAT_ICON[Object.keys(t.perLevel ?? {})[0]] ?? t.icon : t.icon);
// Valeur courte d'un nœud (« +3 % ») : le total appris, sinon ce que donne le niveau 1.
function shortValue(t, level) {
  const m = effectText(talentLevelEffects(t, Math.max(1, level))).match(/[+−-]\s?\d[\d\s.,]*\s?%?/);
  return m ? m[0].replace(/\s+/g, ' ').trim().replace(/ %$/, '%') : '';
}
// Angle moyen de chaque région (pour écrire son nom dans l'arbre).
const REGION_ANGLE = Object.fromEntries(TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => {
  const ns = TALENTS.filter((t) => t.region === b.id);
  return [b.id, Math.atan2(ns.reduce((s, t) => s + t.y, 0), ns.reduce((s, t) => s + t.x, 0))];
}));
const STATE_LABEL = { gated: 'Verrouillé', open: 'Achetable', owned: 'Appris', maxed: 'Maximum', locked: 'Verrouillé' };

function treeNode(state, t, sel, { ghost = false, hit = false } = {}) {
  const level = state.talents[t.id] ?? 0;
  const st = nodeState(state, t);
  const color = REGION_COLOR[t.region] ?? (t.region === 'bridge' ? '#e8e2d0' : '#ffe08a');
  const cost = talentCost(t, level);
  const canBuy = (st === 'open' || st === 'owned') && talentUnlocked(state, t);
  const afford = canBuy && state.fragments >= cost;
  const val = shortValue(t, level);
  const badge = st === 'maxed' ? '<span class="tn-badge tn-max">✓</span>' : st === 'gated' || st === 'locked' ? `<span class="tn-badge tn-lock">${img('icon_lock')}</span>` : '';
  const cls = `tnode k-${t.kind} ${st}${afford ? ' afford' : ''}${ghost ? ' ghost' : ''}${t.id === sel.id ? ' selected' : ''}${hit ? ' hit' : ''}`;
  return `<button class="${cls}" style="left:${pctX(t).toFixed(2)}%;top:${pctY(t).toFixed(2)}%;--branch:${color}" data-action="talent-sel" data-value="${t.id}"
    title="${escapeHtml(t.name)} · ${level}/${t.max} — ${escapeHtml(effectText(talentLevelEffects(t, Math.max(1, level))))}">
    <span class="tn-disc">${img(nodeIcon(t))}</span>${badge}
    ${t.max > 1 && level ? `<span class="tn-lv">${level}/${t.max}</span>` : ''}
    ${val ? `<span class="tn-val">${val}</span>` : ''}
    ${canBuy && !ghost ? `<span class="tn-cost${afford ? '' : ' poor'}">${fragment()}${formatNumber(cost)}</span>` : ''}</button>`;
}

function selectionBar(state, sel) {
  const level = state.talents[sel.id] ?? 0;
  const st = nodeState(state, sel);
  const unlocked = talentUnlocked(state, sel);
  const maxed = level >= sel.max;
  const region = TALENT_BRANCHES.find((b) => b.id === sel.region);
  const color = region?.color ?? '#ffe08a';
  const next = sel.links.map((id) => talentById(id)).filter((n) => n && !(state.talents[n.id] ?? 0) && !talentConnected(state, n));
  const pts = sel.gate ? regionPoints(state, sel.region) : 0;
  const why = st === 'gated' && sel.gate && pts < sel.gate
    ? `<div class="bad">Il faut ${sel.gate} points dans ${region?.label ?? ''} (actuellement ${pts}).</div>`
    : !talentConnected(state, sel) && !level ? '<div class="bad">Apprends d\'abord un talent relié.</div>' : '';
  return `<div class="card tree-sel" style="--branch:${color}">
    <div class="ts-head"><span class="ts-icon">${img(nodeIcon(sel))}</span>
      <div class="grow"><b>${escapeHtml(sel.name)}</b>
        <div class="muted ts-sub"><span style="color:${color}">${region?.label ?? KIND_LABEL[sel.kind]}</span> · ${KIND_LABEL[sel.kind]} · <span class="ts-state s-${st}">${STATE_LABEL[st]}</span>${sel.max > 1 ? ` · niv. ${level}/${sel.max}` : ''}</div></div></div>
    <div class="ts-eff">${level ? `<span>${effectText(talentLevelEffects(sel, level))}</span>` : ''}${maxed ? '' : `${level ? ' <span class="muted">→</span> ' : '<span class="muted">Donne : </span>'}<b class="good">${effectText(talentLevelEffects(sel, level + 1))}</b>`}</div>
    ${next.length ? `<div class="ts-next muted">Débloque ensuite : ${next.slice(0, 4).map((n) => `<span class="ts-chip">${img(nodeIcon(n))}${escapeHtml(n.name)}</span>`).join('')}${next.length > 4 ? ` +${next.length - 4}` : ''}</div>` : ''}
    ${why}
    <div class="detail-actions">
      ${costButton({ action: 'buy-talent', cost: talentCost(sel, level), have: state.fragments, currency: 'fragments', attrs: `data-key="${sel.id}"`, label: 'Apprendre ', max: maxed, locked: !unlocked })}
      ${sel.max > 1 && !maxed && unlocked ? `<button class="btn small" data-action="buy-talent-max" data-key="${sel.id}">Max</button>` : ''}
    </div></div>`;
}

function treeLegend(state) {
  const sample = (cls, label) => `<span class="tl-item"><i class="tl-dot ${cls}"></i>${label}</span>`;
  const branches = TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => `<span class="tl-branch" style="--branch:${b.color}"><i></i>${b.label} <b>${regionPoints(state, b.id)}</b></span>`).join('');
  return `<div class="tree-legend2">
    <div class="tl-row">${sample('afford', 'Achetable')}${sample('open', 'Fragments insuffisants')}${sample('owned', 'Appris')}${sample('maxed', 'Maximum')}${sample('gated', 'Verrouillé')}</div>
    <div class="tl-row">${branches}</div></div>`;
}

function treeView(ui, state) {
    const sel = talentById(ui.view.talentSel) ?? talentById('core');
    const zoom = ui.view.treeZoom ?? DEFAULT_ZOOM;
    // v8.9 : l'arbre se dévoile au fur et à mesure — seuls les talents appris et leurs voisins sont visibles.
    const shown = visibleTalents(state);
    // v9.2.7 : ce que le talent choisi débloque ensuite apparaît en fantôme.
    const ghosts = new Set(sel.links.filter((id) => !shown.has(id)));
    const hits = treeSearchHits(ui.view.treeSearch, shown);
    const owned = (id) => (state.talents[id] ?? 0) > 0;
    const links = LINKS.filter(([a, b]) => (shown.has(a.id) || ghosts.has(a.id)) && (shown.has(b.id) || ghosts.has(b.id))).map(([a, b]) => {
      const ghost = ghosts.has(a.id) || ghosts.has(b.id);
      const cls = ghost ? 'next' : owned(a.id) && owned(b.id) ? 'on' : owned(a.id) || owned(b.id) ? 'half' : '';
      const color = cls === 'on' || cls === 'half' ? REGION_COLOR[a.region] ?? REGION_COLOR[b.region] ?? '#e8e2d0' : null;
      return `<line data-a="${a.id}" data-b="${b.id}" x1="${(a.x + EXTENT).toFixed(2)}" y1="${(a.y + EXTENT).toFixed(2)}" x2="${(b.x + EXTENT).toFixed(2)}" y2="${(b.y + EXTENT).toFixed(2)}"${cls ? ` class="${cls}"` : ''}${color ? ` style="stroke:${color}"` : ''}/>`;
    }).join('');
    // Secteurs colorés et noms des régions, derrière les nœuds.
    const R = EXTENT - 0.3;
    const sectors = TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => {
      const a = REGION_ANGLE[b.id];
      const h = (TREE.sector / 2) * (Math.PI / 180);
      const p = (ang) => `${(EXTENT + R * Math.cos(ang)).toFixed(2)} ${(EXTENT + R * Math.sin(ang)).toFixed(2)}`;
      return `<path d="M${EXTENT} ${EXTENT} L${p(a - h)} A${R} ${R} 0 0 1 ${p(a + h)} Z" fill="${b.color}" class="sector"/>`;
    }).join('');
    const labels = TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => {
      const a = REGION_ANGLE[b.id];
      // v9.2.7 : le nom de la région se place juste au-delà de ses talents visibles (jamais sur un nœud).
      const far = Math.max(1, ...TALENTS.filter((t) => t.region === b.id && (shown.has(t.id) || ghosts.has(t.id))).map((t) => Math.hypot(t.x, t.y)));
      const pos = (r) => `left:${(((EXTENT + r * Math.cos(a)) / SPAN) * 100).toFixed(2)}%;top:${(((EXTENT + r * Math.sin(a)) / SPAN) * 100).toFixed(2)}%`;
      return `<span class="region-label" style="${pos(Math.min(EXTENT - 0.6, far + 1.05))};--branch:${b.color}">${b.label}</span>`;
    }).join('');
    const nodes = TALENTS.filter((t) => shown.has(t.id) || ghosts.has(t.id)).map((t) => treeNode(state, t, sel, { ghost: ghosts.has(t.id), hit: Boolean(hits?.has(t.id)) })).join('');
    const total = TALENTS.length;
    const tools = fold(ui, 'tree-tools', 'Outils', () => `<div class="tree-head">
        <input id="tree-search" type="search" placeholder="Chercher (or, critique, PV…)" value="${escapeHtml(ui.view.treeSearch ?? '')}" autocomplete="off" aria-label="Chercher un talent"><span class="tree-hits muted"></span>
      </div>
      <div class="tree-tools"><button class="btn btn-gold small" data-action="ask-buy-talents" data-value="">Tout apprendre…</button></div>
      ${regionBuy(state)}`,
    { cls: 'tree-tools-fold', extra: ui.view.treeSearch ? 'filtre actif' : '' });
    const help = fold(ui, 'tree-help', 'Aide', () => `<ul class="tree-help">
        <li>Touche un talent pour voir ce qu'il donne, puis « Apprendre » juste sous l'arbre.</li>
        <li>Un talent s'achète dès qu'un talent relié est appris ; les nœuds en pointillés sont ceux qu'il débloque ensuite.</li>
        <li>Chaque couleur est une région ; les clés de voûte (hexagones) demandent des points dans leur région.</li>
        <li>Glisse pour te déplacer, molette ou pincement pour zoomer, ◎ pour recentrer.</li></ul>`);
    const tree = `<div class="tree-head">
        <span>${fragment()} <b class="num">${formatNumber(state.fragments)}</b> fragments à dépenser</span>
        ${(() => { const sg = suggestedTalent(state); return sg ? `<button class="btn small btn-gold" data-action="talent-sel" data-value="${sg.talent.id}">Conseillé : ${escapeHtml(sg.talent.name)}</button>` : ''; })()}
      </div>
      <div class="tree-wrap"><div class="tree-viewport"><div class="rune-tree" style="width:${Math.round(TREE_PX * zoom)}px;height:${Math.round(TREE_PX * zoom)}px;--tz:${zoom}">
      <svg viewBox="0 0 ${SPAN} ${SPAN}" preserveAspectRatio="none" aria-hidden="true">${sectors}${links}</svg>${labels}${nodes}</div></div>
      <div class="tree-zoom"><button class="tz-btn" data-z="in" title="Zoomer" aria-label="Zoomer">+</button><button class="tz-btn" data-z="out" title="Dézoomer" aria-label="Dézoomer">−</button><button class="tz-btn" data-z="center" title="Recentrer sur le talent choisi" aria-label="Recentrer sur le talent choisi">◎</button></div></div>
      ${selectionBar(state, sel)}
      ${treeLegend(state)}`;

    const spent = fragmentsSpent(state);
    const respec = respecCost(state);
    return `<div class="card tree-card rune-card">${tree}</div>
      ${help}
      ${tools}
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
  return `<div class="card rebirth-card"><img class="px art-banner rebirth-art" src="assets/ui/art98/phoenix_rebirth.png" loading="lazy" alt="" aria-hidden="true">
      <div class="row-between"><b>${img('icon_rebirth')} Renaissance</b><span class="muted">${state.records.rebirths} effectuée${state.records.rebirths > 1 ? 's' : ''}</span></div>
      ${can ? `<div class="rb-tiles">${tile('icon_fragment', `+${formatNumber(reward)}`, 'fragments')}${tile('icon_damage', `×${gain.toFixed(2).replace('.', ',')}`, 'pour toujours')}${tile('icon_boss', '1', 'pouvoir conservé')}</div>`
        : `<div>Atteins l'étape ${stageLabel(REBIRTH.minStage)} pour renaître (max ${stageLabel(state.maxStage)}).</div>`}
      ${can ? (() => { // v10.8 (6) : la règle en image — avant / après, temps pour revenir, rentable ou pas encore
        const now = computeHeroStats(state).combatPower, worth = rebirthWorth(state);
        return `<div class="rb-ba"><div><small>Avant</small><b class="num">${formatNumber(now)}</b></div><i>→</i><div><small>Après</small><b class="num good">${formatNumber(now * gain)}</b></div>
          <div><small>Retour à ${stageLabel(state.maxStage)}</small><b class="num">≈ ${formatDuration(rebirthCatchUp(state))}</b></div></div>
          <p class="rb-rule ${worth ? 'good' : 'muted'}">${worth ? '✔ Rentable maintenant' : 'Rentable quand elle donne au moins ×1,25 et que tu bloques depuis 3 h de jeu'}</p>`;
      })() : ''}
      ${can ? `<div class="rb-later">Si tu pousses encore 10 étapes : <b>+${formatNumber(rebirthReward(state, state.maxStage + 10))}</b> ${fragment()} (au lieu de +${formatNumber(reward)}).</div>` : ''}
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
    <div class="muted">Recommence tout (Renaissances comprises, ${Math.round(keptRebirthShare(state) * 100)} % gardées) contre des <b>Étoiles</b> ;
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
