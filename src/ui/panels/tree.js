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
import { costButton, effectText, escapeHtml, fold, fragment, formatNumber, img, starsIcon } from '../common.js';
import { memoryShare } from '../../core/transcend.js';
import { mBar, mBtn, mBtnGold, mChip, mCost, mModes, mSheet, mStat, mTitle } from '../mobile-kit.js'; // v10.12 (lot 4) : vue téléphone

export function keepResetLists() {
  return `<div class="keep-reset">
    <div><div class="section-title">Réinitialisé</div><ul>${REBIRTH_RESETS.map((t) => `<li class="bad">${t}</li>`).join('')}</ul></div>
    <div><div class="section-title">Conservé</div><ul>${REBIRTH_KEEPS.map((t) => `<li class="good">${t}</li>`).join('')}</ul></div>
  </div>`;
}

// Arbre « mastodonte » (v8.5) : ~500 nœuds placés en cercle autour du Cœur (unités de src/data/talent-tree.js).
const EXTENT = TREE.rings + 1.2;
const SPAN = EXTENT * 2;
const pctX = (t) => ((t.x + EXTENT) / SPAN) * 100;
const pctY = (t) => ((t.y + EXTENT) / SPAN) * 100;
const REGION_COLOR = Object.fromEntries(TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => [b.id, b.color]));
const KIND_LABEL = { core: 'Cœur', small: 'Talent', notable: 'Notable', keystone: 'Clé de voûte' };
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

// v9.1.0 : le segment Renaissance existe dès que la Renaissance concerne le joueur (étape 30 atteinte une fois,
// ou déjà renée / transcendée) ; avant, l'onglet Talents ne montre que l'arbre.
export function rebirthSegmentOpen(state) {
  return Math.max(state.maxStage, state.records.bestStage ?? 1) >= REBIRTH.minStage || state.records.rebirths > 0 || (state.transcend?.count ?? 0) > 0;
}

// v10.12 (lot 4, § 5) : Talents sur téléphone. Cadre + cartouche (le paragraphe d'explication est derrière « ? »), modes
// Talents · Arbre avancé · Renaissance, tête (fragments en .m-cost + « Apprendre le meilleur » en doré), chaque branche
// en chemin de 5 nœuds ronds de 54 px (paliers 3, 6, 9, 12, 15) ; toucher un nœud ouvre la fiche de la branche.
const TREE_INTRO = 'La Renaissance te ramène au monde 1 contre des fragments. Les fragments achètent des talents qui restent pour toujours.';
const regionImg = (id) => `file:assets/ui/art106/talent_region_${id}.png`;
const nodeAttrs = (v) => `data-key="mTreeSheet" data-value="${v}"`;

// v10.13.1 (lot 3, maquette t04) : chaque branche est une carte large — illustration à gauche (78 px, fond de sa couleur, un appui ouvre
// la fiche de la branche), nom et palier, piste de 15 crans, prochain talent et son effet en vert, coût en fragments et « Apprendre »
// (doré seulement sur la branche conseillée, sombre sur les autres).
function phoneBranch(state, b, rec) {
  const meta = SIMPLE_BRANCHES[b.id];
  const { tier } = branchTier(state, b.id);
  const next = branchNext(state, b.id);
  const color = DESK_COLOR[b.id] ?? b.color;
  const big = next && (next.t.kind === 'notable' || next.t.kind === 'keystone');
  const steps = Array.from({ length: TIERS }, (_, i) => `<i class="${i < tier ? 'f' : ''}${(i + 1) % 5 === 0 ? ' big' : ''}"></i>`).join('');
  const afford = next && state.fragments >= next.cost;
  const nextBox = next
    ? `<p class="m-bnext">${big ? '<em>Gros palier</em> ' : ''}<b>${escapeHtml(next.t.name)}</b> <span class="good">${effectText(talentLevelEffects(next.t, next.lv + 1))}</span></p>`
    : '<p class="m-bnext done"><b class="good">Branche terminée ✓</b></p>';
  const attrs = next ? `data-cost="${next.cost}" data-currency="fragments"` : '';
  const foot = next
    ? `<div class="m-bfoot"><span class="m-bcost ${afford ? 'ok' : 'ko'}" title="${afford ? '' : escapeHtml(missing(next.cost - state.fragments))}">${fragment()}<b>${formatNumber(next.cost)}</b></span>${(rec ? mBtnGold : mBtn)('Apprendre', { action: 'talent-branch', value: b.id, attrs, disabled: !afford })}</div>`
    : '';
  return `<div class="m-bcard${rec ? ' rec' : ''}" style="--c:${color};--branch:${color}">
    <button type="button" class="m-bart" data-action="m-set" ${nodeAttrs(b.id)} aria-label="${escapeHtml(`${meta.name} : détails`)}"><img class="px" src="${regionImg(b.id).replace('file:', '')}" alt="" width="56" height="56"></button>
    <div class="m-bbody"><div class="m-bhead"><b>${escapeHtml(meta.name)}</b><span>Palier ${tier}/${TIERS}</span></div>
      <div class="m-btrack" role="img" aria-label="Palier ${tier} sur ${TIERS}">${steps}</div>${nextBox}${foot}</div></div>`;
}

function phoneBranchSheet(state, b) {
  const meta = SIMPLE_BRANCHES[b.id];
  const pts = TALENTS.filter((t) => t.region === b.id).reduce((n, t) => n + (state.talents[t.id] ?? 0), 0);
  const per = Math.max(1, Math.ceil(branchMax(b.id) / TIERS));
  const tier = Math.min(TIERS, Math.ceil(pts / per));
  const next = branchNext(state, b.id);
  const big = next && (next.t.kind === 'notable' || next.t.kind === 'keystone');
  const bonus = branchBonus(state, b.id);
  const body = `<div class="m-card m-brsheet" style="--branch:${b.color}"><div class="m-br-head"><img class="px" src="assets/ui/art106/talent_region_${b.id}.png" alt="" width="64" height="64"><div><b>${meta.name}</b><span>Palier ${tier}/${TIERS}</span></div></div>
      ${mBar(tier / TIERS)}
      <div class="m-sk-line"><small>Bonus actuel</small><b>${bonus ? `<span class="good">${bonus}</span>` : 'Aucun talent appris'}</b></div>
      ${next ? `<div class="m-sk-line"><small>${big ? 'Gros palier' : 'Prochain talent'}</small><b>${escapeHtml(next.t.name)}</b><b class="good">${effectText(talentLevelEffects(next.t, next.lv + 1))}</b></div>` : '<p class="m-note good">Branche terminée ✓</p>'}</div>
    ${next ? `<div class="m-costs">${mCost('icon_fragment', state.fragments, next.cost, { fmt: formatNumber })}</div>
      ${mBtnGold('Apprendre', { action: 'talent-branch', value: b.id, attrs: `data-cost="${next.cost}" data-currency="fragments"`, disabled: state.fragments < next.cost })}` : ''}`;
  return mSheet(meta.name, body, { id: 'mTreeSheet', icon: regionImg(b.id), close: 'm-sheet-x', back: 'm-sheet-x' });
}

// v10.12 (round 2) : Arbre avancé sur téléphone — plus de zoom ni de glisser : une région à la fois (puces), ses talents
// visibles rangés par anneau, de haut en bas, reliés par des traits ; chaque nœud est une pastille ronde de 54 px
// (icône, nom sur 2 lignes, rang n/max) ; toucher un nœud ouvre sa fiche (effet, coût, Apprendre).
const NODE_ROW = 4;
function phoneAdvanced(ui, state) {
  const shown = visibleTalents(state);
  const regions = TALENT_BRANCHES.filter((b) => TALENTS.some((t) => t.region === b.id && shown.has(t.id)));
  const reg = regions.find((b) => b.id === ui.view.mTreeRegion) ?? regions.find((b) => b.id === 'combat') ?? regions[0];
  const pts = (r) => regionPoints(state, r);
  const chips = `<div class="m-chips m-regchips" role="group" aria-label="Régions">${regions.map((b) => mChip(b.id === 'bridge' ? 'Ponts' : b.label, { action: 'm-set', on: b.id === reg.id, attrs: `data-key="mTreeRegion" data-value="${b.id}" style="--branch:${b.color}"` })).join('')}</div>`;
  const list = TALENTS.filter((t) => (t.region === reg.id || t.id === 'core') && shown.has(t.id));
  const rings = new Map();
  for (const t of list) { if (!rings.has(t.ring)) rings.set(t.ring, []); rings.get(t.ring).push(t); }
  const rows = [];
  for (const ring of [...rings.keys()].sort((a, b) => a - b)) {
    const ts = rings.get(ring).sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
    for (let i = 0; i < ts.length; i += NODE_ROW) rows.push(ts.slice(i, i + NODE_ROW));
  }
  const node = (t) => {
    const lv = state.talents[t.id] ?? 0;
    const st = nodeState(state, t);
    const afford = (st === 'open' || st === 'owned') && state.fragments >= talentCost(t, lv);
    const mark = st === 'maxed' ? '<i class="m-tn-b ok">✓</i>' : st === 'gated' || st === 'locked' ? `<i class="m-tn-b lock">${img('icon_lock')}</i>` : afford ? '<i class="m-tn-b up">▲</i>' : '';
    return `<button type="button" class="m-tnode ${st}${afford ? ' afford' : ''} k-${t.kind}" data-action="m-set" data-key="mTreeSheet" data-value="t:${t.id}" aria-label="${escapeHtml(`${t.name}, ${lv} sur ${t.max}, ${STATE_LABEL[st]}`)}">
      <span class="m-tn-disc">${img(nodeIcon(t))}${mark}</span><span class="m-tn-name">${escapeHtml(t.name)}</span><small class="m-tn-rk">${lv}/${t.max}</small></button>`;
  };
  const body = rows.map((r, i) => {
    const lit = r.some((t) => (state.talents[t.id] ?? 0) > 0);
    return `${i ? `<i class="m-lv-link${lit ? ' on' : ''}" aria-hidden="true"></i>` : ''}<div class="m-lv${r.length > 1 ? ' rail' : ''}${lit ? ' on' : ''}">${r.map(node).join('')}</div>`;
  }).join('');
  const head = `<div class="m-card m-advhead" style="--branch:${reg.color}"><b>${reg.id === 'bridge' ? 'Ponts' : reg.label}</b><span>${reg.id === 'bridge' ? `${list.length} talents visibles` : `${pts(reg.id)} pts · ${list.filter((t) => (state.talents[t.id] ?? 0) > 0).length}/${TALENTS.filter((t) => t.region === reg.id).length}`}</span></div>`;
  return `<div class="m-adv">${chips}${head}<div class="m-card m-lvs" style="--branch:${reg.color}">${body}</div>${mBtn('Outils et réinitialisation', { action: 'm-set', attrs: 'data-key="mTreeSheet" data-value="tools"' })}</div>`;
}

function phoneTalentSheet(state, t) {
  const lv = state.talents[t.id] ?? 0;
  const st = nodeState(state, t);
  const region = TALENT_BRANCHES.find((b) => b.id === t.region);
  const maxed = lv >= t.max;
  const unlocked = talentUnlocked(state, t);
  const cost = talentCost(t, lv);
  const pts = t.gate ? regionPoints(state, t.region) : 0;
  const why = maxed ? '' : unlocked ? '' : t.gate && talentConnected(state, t) && pts < t.gate ? `Il faut ${t.gate} points dans ${region?.label ?? ''} (actuellement ${pts}).` : 'Apprends d\'abord un talent relié.';
  const next = t.links.map((id) => talentById(id)).filter((n) => n && !(state.talents[n.id] ?? 0) && !talentConnected(state, n));
  const eff = `${lv ? `<div class="m-sk-line"><small>Actuel</small><b>${effectText(talentLevelEffects(t, lv))}</b></div>` : ''}
    ${maxed ? '<p class="m-note good">Niveau maximum ✓</p>' : `<div class="m-sk-line"><small>Au prochain niveau</small><b class="good">${effectText(talentLevelEffects(t, lv + 1))}</b></div>`}`;
  const body = `<div class="m-card m-tsheet" style="--branch:${region?.color ?? '#ffe08a'}"><div class="m-br-head"><span class="m-tn-disc big ${st}">${img(nodeIcon(t))}</span><div><b>${escapeHtml(t.name)}</b><span>${region && t.region !== 'bridge' ? `${region.label} · ` : ''}${KIND_LABEL[t.kind]} · ${STATE_LABEL[st]}</span></div></div>
      <div class="m-sk-line"><small>Niveau</small><b>${lv}/${t.max}</b></div>${mBar(lv / t.max)}${eff}
      ${why ? `<p class="m-note bad">${escapeHtml(why)}</p>` : ''}
      ${next.length ? `<div class="m-sk-line"><small>Débloque ensuite</small><b>${next.slice(0, 3).map((n) => escapeHtml(n.name)).join(', ')}${next.length > 3 ? ` +${next.length - 3}` : ''}</b></div>` : ''}</div>
    ${maxed ? '' : `<div class="m-costs">${mCost('icon_fragment', state.fragments, cost, { fmt: formatNumber })}</div>
      ${mBtnGold('Apprendre', { action: 'buy-talent', attrs: `data-key="${t.id}" data-cost="${cost}" data-currency="fragments"`, disabled: !unlocked || state.fragments < cost })}
      ${t.max > 1 && unlocked ? mBtn('Max', { action: 'buy-talent-max', attrs: `data-key="${t.id}"` }) : ''}`}`;
  return mSheet(t.name, body, { id: 'mTreeSheet', icon: nodeIcon(t), close: 'm-sheet-x', back: 'm-sheet-x' });
}

function phoneTreeTools(state) {
  const spent = fragmentsSpent(state);
  const respec = respecCost(state);
  const body = `<div class="m-card"><p class="m-note">Apprend le moins cher d'abord, tant que les fragments suffisent (une confirmation suit).</p>
      ${mBtn('Tout apprendre…', { action: 'ask-buy-talents', value: '' })}
      <div class="m-chips">${TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => mChip(b.label, { action: 'ask-buy-talents', attrs: `data-value="${b.id}" style="--branch:${b.color}"` })).join('')}</div></div>
    <div class="m-card"><p class="m-note">Rend les ${formatNumber(spent)} fragments investis.</p>
      ${mBtn(respec ? `Réinitialiser l'arbre · ${formatNumber(respec)} gemmes` : 'Réinitialiser l\'arbre · gratuit (1re fois)', { action: 'respec-talents', disabled: !(spent > 0 && state.gems >= respec) })}</div>`;
  return mSheet('Outils de l\'arbre', body, { id: 'mTreeSheet', icon: 'icon_tree', close: 'm-sheet-x', back: 'm-sheet-x' });
}

// v10.13.1 (lot 3, maquette m05 en une colonne) : le phénix en haut, Puissance avant » après en gros, 3 tuiles de gains, « Ce qui se
// passe » (gardé en vert, remis à zéro en rouge), la bande « Rentable maintenant » et le bouton doré Renaître.
function phoneRebirth(ui, state) {
  const reward = rebirthReward(state);
  const can = canRebirth(state);
  const blocked = rebirthBlocked(state);
  const gain = PRESTIGE.rebirthMultiplier ** rebirthGain(state);
  const keep = memoryShare(state);
  const f = prestigeFactors(state);
  const t = state.transcend;
  const showT = canTranscend(state) || t.count || t.stars;
  const n = state.records.rebirths;
  const tile = (cls, icon, value, label) => `<div class="m-rbtile"><span class="m-rbico ${cls}">${img(icon)}</span><b>${value}</b><span>${label}</span></div>`;
  const art = `<div class="m-rbart"><img class="px" src="assets/ui/art98/phoenix_rebirth.png" alt="" aria-hidden="true"><b>Renaissance</b>
    <span>${n} déjà faite${n > 1 ? 's' : ''}${f.total > 1 ? ` · prestige actuel <b class="good">×${mult(f.total)}</b>` : ''}</span></div>`;
  let body;
  if (can) {
    const now = computeHeroStats(state).combatPower, worth = rebirthWorth(state);
    const later = rebirthReward(state, state.maxStage + 10);
    body = `<div class="m-rbba"><div><small>Puissance avant</small><b>${formatNumber(now)}</b></div><i aria-hidden="true">»</i><div><small>Après</small><b class="good">${formatNumber(now * gain)}</b></div></div>
      <div class="m-tsec">Ce que tu gagnes</div>
      <div class="m-rbgets">${tile('ep', 'icon_fragment', `+${formatNumber(reward)}`, 'fragments')}${tile('lg', 'icon_damage', `×${gain.toFixed(2).replace('.', ',')}`, 'pour toujours')}${tile('ra', 'icon_bolt', '1', 'pouvoir gardé')}</div>
      <div class="m-tsec">Ce qui se passe</div>
      <div class="m-card m-rbwhat"><p><span aria-hidden="true">↺</span> Retour à l'étape 1${keep > 0 ? ` · ${Math.round(keep * 100)} % des améliorations gardés` : ''}</p><p><span aria-hidden="true">⏱</span> Retour à ${stageLabel(state.maxStage)} en ≈ ${formatDuration(rebirthCatchUp(state))}</p>
        <ul class="keep">${REBIRTH_KEEPS.map((x) => `<li>${x}</li>`).join('')}</ul><ul class="lose">${REBIRTH_RESETS.map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div class="m-rbworth${worth ? ' ok' : ''}">${worth ? '<span>✓ <b>Rentable maintenant</b> · tu bloques depuis 8 h et le gain dépasse ×1,25</span>' : '<span>Rentable quand elle donne au moins ×1,25 et que tu bloques depuis 8 h de jeu</span>'}<small>+10 étapes : +${formatNumber(later)}</small></div>
      ${blocked ? `<p class="m-note bad">${escapeHtml(blocked)}</p>` : ''}`;
  } else body = `<p class="m-note">Atteins l'étape ${stageLabel(REBIRTH.minStage)} pour renaître (max ${stageLabel(state.maxStage)}).</p>`;
  return `<div class="m-rb">${art}${body}
    <button type="button" class="m-btn-gold m-rbgo" data-action="rebirth" ${can && !blocked ? '' : 'disabled'}>${img('icon_rebirth')}<span>Renaître · +${formatNumber(reward)}</span>${fragment()}</button>
    <div class="m-rb-more">${mBtn('Bonus éternels', { action: 'm-set', attrs: nodeAttrs('bonus'), icon: 'icon_star' })}${showT ? mBtn('Transcendance', { action: 'm-set', attrs: nodeAttrs('transcend'), icon: 'icon_stars' }) : ''}</div></div>`;
}

function phoneTree(ui, state, seg, items) {
  const pill = `<div class="m-fragpill" title="${escapeHtml(TREE_INTRO)}">${fragment()}<b>${formatNumber(state.fragments)}</b></div>`;
  const modes = items.length > 1 ? mModes(items.map(([id, label, ic]) => ({ id, label, icon: ic, action: 'tree-seg', value: id })), seg, { size: 64 }) : '';
  const help = ui.view.helpOpen === 'tree' ? `<div class="m-card m-help-card">${TREE_INTRO}</div>` : '';
  let content;
  if (seg === 'rebirth') content = phoneRebirth(ui, state);
  else if (seg === 'tree') content = phoneAdvanced(ui, state);
  else if (seg === 'region') content = `<div class="m-treewrap">${regionView(state)}</div>`;
  else {
    const sg = suggestedTalent(state);
    const rec = recommendedBranch(state);
    const branches = TALENT_BRANCHES.filter((b) => SIMPLE_BRANCHES[b.id]);
    const main = DESK_MAIN.map((id) => branches.find((b) => b.id === id)).filter(Boolean);
    const others = branches.filter((b) => !DESK_MAIN.includes(b.id));
    const open = ui.view.open?.has('tree-others');
    const best = sg ? (rec ? mBtn : mBtnGold)('Apprendre le meilleur', { action: 'talent-best', icon: 'icon_star' }) : mBtn('Apprendre le meilleur', { icon: 'icon_star', disabled: true });
    content = `<div class="m-blist">${main.map((b) => phoneBranch(state, b, b.id === rec)).join('')}</div>
      <div class="m-tsec">Ce que tes talents donnent</div><div class="m-gaint">${talentGains(state, [0, 1, 3])}</div>
      ${others.length ? `${mBtn(`Autres branches (${others.length}) ${open ? '▴' : '▾'}`, { action: 'toggle-section', value: 'tree-others', attrs: `data-expanded="${Boolean(open)}" aria-expanded="${Boolean(open)}"` })}
        ${open ? `<div class="m-blist">${others.map((b) => phoneBranch(state, b, false)).join('')}</div>` : ''}` : ''}
      ${best}
      ${advancedOpen(state) ? '' : '<p class="m-note">Arbre avancé : après 3 Renaissances</p>'}`;
  }
  // Fiches : une branche, les bonus éternels, la Transcendance (état de vue : mTreeSheet).
  const sh = ui.view.mTreeSheet;
  let sheet = '';
  const b = TALENT_BRANCHES.find((x) => x.id === sh && SIMPLE_BRANCHES[x.id]);
  if (b) sheet = phoneBranchSheet(state, b);
  else if (/^t:/.test(sh ?? '') && talentById(sh.slice(2))) sheet = phoneTalentSheet(state, talentById(sh.slice(2)));
  else if (sh === 'tools' && seg === 'tree') sheet = phoneTreeTools(state);
  else if (sh === 'bonus') sheet = mSheet('Bonus éternels', `<div class="m-card m-perks">${bonusList(state)}</div>`, { id: 'mTreeSheet', icon: 'icon_star', close: 'm-sheet-x', back: 'm-sheet-x' });
  else if (sh === 'transcend' && (canTranscend(state) || state.transcend.count || state.transcend.stars)) {
    const reward = transcendReward(state);
    const t = state.transcend;
    sheet = mSheet('Transcendance', `<div class="m-card"><p class="m-note">Recommence tout (Renaissances comprises, ${Math.round(keptRebirthShare(state) * 100)} % gardées) contre des Étoiles ; chaque Transcendance multiplie aussi dégâts, PV et or ×${TRANSCEND.powerPerTranscend} pour toujours.</p>
        <div class="m-stats2">${mStat('icon_stars', 'Transcendances', String(t.count))}${mStat('icon_stars', 'Étoiles', formatNumber(t.stars))}</div>
        ${reward > 0 && rebirthBlocked(state) ? `<p class="m-note bad">${escapeHtml(rebirthBlocked(state))}</p>` : ''}</div>
      ${mBtnGold(`Transcender +${formatNumber(reward)}`, { action: 'transcend', icon: 'icon_stars', disabled: !(reward > 0 && !rebirthBlocked(state)) })}`, { id: 'mTreeSheet', icon: 'icon_stars', close: 'm-sheet-x', back: 'm-sheet-x' });
  }
  return `<div class="m-frame m-hero m-tr m-tr-${seg}">${mTitle('icon_tree', 'Talents', true)}${pill}${help}${modes}${content}${sheet}</div>`;
}

// ============================================================================================================================
// v10.13 (lot 5, § 5) : Héros › Talents et Renaissance sur PC. Même kit que le téléphone (mFrame/mTitle/mModes/mCost/mBtnGold…) à la
// taille PC (desk-kit.css) ; les règles propres à l'écran sont dans desk-talents.css (sous #app:not(.m-phone)).
//   Talents : pastille fragments, 3 modes, 3 branches en grandes cartes illustrées (piste de 15 crans, « Prochain talent », coût,
//   Apprendre doré seulement sur la branche conseillée), « Ce que tes talents te donnent déjà » en 6 tuiles, arbre complet, meilleur.
//   Arbre avancé : une région à la fois, nœuds en liste (nom lisible sous chaque nœud) + fiche du talent choisi à droite.
//   Renaissance : phénix, avant » après, 3 gains, ce qui se passe (gardé vert / remis à zéro rouge), « Rentable maintenant », Renaître.
// Un seul bouton doré visible par écran : l'action conseillée.
// ============================================================================================================================
const DESK_MAIN = ['combat', 'resources', 'survival']; // ordre de la maquette : Attaque, Or et butin, Survie
const DESK_COLOR = { combat: '#ff5a5a', resources: '#ffc040', survival: '#4ddc7a' };
const DESK_ICON = { simple: 'icon_star', tree: 'icon_tree', rebirth: 'icon_rebirth' };
const missing = (n) => `Il manque ${formatNumber(n)} fragment${n > 1 ? 's' : ''}`;
const pct1 = (v) => `+${(Math.round(v * 10) / 10).toString().replace('.', ',')} %`;

function branchTier(state, id) {
  const pts = TALENTS.filter((t) => t.region === id).reduce((n, t) => n + (state.talents[t.id] ?? 0), 0);
  return { pts, tier: Math.min(TIERS, Math.ceil(pts / Math.max(1, Math.ceil(branchMax(id) / TIERS)))) };
}

// Branche conseillée : parmi les 3 grandes, celle où l'on peut apprendre tout de suite, en continuant d'abord la plus avancée.
export function recommendedBranch(state) {
  let best = null;
  for (const id of DESK_MAIN) {
    const next = branchNext(state, id);
    if (!next || next.cost > state.fragments) continue;
    const { pts } = branchTier(state, id);
    if (!best || pts > best.pts) best = { id, pts };
  }
  return best?.id ?? null;
}

function deskBranch(state, b, rec) {
  const meta = SIMPLE_BRANCHES[b.id];
  const { tier } = branchTier(state, b.id);
  const next = branchNext(state, b.id);
  const color = DESK_COLOR[b.id] ?? b.color;
  const big = next && (next.t.kind === 'notable' || next.t.kind === 'keystone');
  const steps = Array.from({ length: TIERS }, (_, i) => `<i class="${i < tier ? 'f' : ''}${(i + 1) % 5 === 0 ? ' big' : ''}"></i>`).join('');
  const afford = next && state.fragments >= next.cost;
  const nextBox = next
    ? `<div class="d-next"><span class="d-next-ico">${img(nodeIcon(next.t))}</span><div class="d-next-t"><small>${big ? 'Gros palier' : 'Prochain talent'}</small><b>${escapeHtml(next.t.name)}</b><span class="good">${effectText(talentLevelEffects(next.t, next.lv + 1))}</span></div></div>`
    : '<div class="d-next done"><b class="good">Branche terminée ✓</b></div>';
  const attrs = next ? `data-cost="${next.cost}" data-currency="fragments"` : '';
  const foot = next
    ? `<div class="d-foot"><span class="d-fcost ${afford ? 'ok' : 'ko'}" title="Coût : ${formatNumber(next.cost)} fragment${next.cost > 1 ? 's' : ''}">${fragment()}<b>${formatNumber(next.cost)}</b></span>${(rec ? mBtnGold : mBtn)('Apprendre', { action: 'talent-branch', value: b.id, attrs, disabled: !afford, icon: `file:assets/ui/art106/talent_region_${b.id}.png` })}</div>
      <small class="cost-missing d-miss">${afford ? '' : missing(next.cost - state.fragments)}</small>`
    : '';
  return `<div class="tb-row d-bc${rec ? ' rec' : ''}${big ? ' tb-big' : ''}" style="--c:${color};--branch:${color}">
    <div class="d-art"><span class="d-art-t">${escapeHtml(meta.name)}</span><span class="d-art-p">Palier ${tier}/${TIERS}</span><img class="px" src="assets/ui/art106/talent_region_${b.id}.png" alt="${escapeHtml(meta.name)}"></div>
    <div class="d-bc-body"><div class="d-track" role="img" aria-label="Palier ${tier} sur ${TIERS}">${steps}</div>${nextBox}${foot}</div></div>`;
}

const GAIN_TILES = [['icon_damage', ['damagePct', 'damageMultPct'], 'dégâts'], ['icon_heart', ['maxHpPct', 'maxHpMultPct'], 'PV'], ['coin', ['goldPct', 'goldMultPct'], 'or'],
  ['icon_crit', ['critChance'], 'critique'], ['icon_shield', ['armor'], 'défense'], ['icon_xp', ['xpPct'], 'expérience']];
function talentGains(state, pick = null) {
  const sum = {};
  for (const t of TALENTS) {
    const lv = state.talents[t.id] ?? 0;
    if (lv > 0) for (const [k, v] of Object.entries(talentLevelEffects(t, lv))) sum[k] = (sum[k] ?? 0) + v;
  }
  return GAIN_TILES.filter((_, i) => !pick || pick.includes(i)).map(([ic, keys, label]) => `<div class="d-gain">${img(ic)}<b>${pct1(keys.reduce((n, k) => n + (sum[k] ?? 0), 0))}</b><span>${label}</span></div>`).join('');
}

function deskSimple(state) {
  const sg = suggestedTalent(state);
  const rec = recommendedBranch(state);
  const branches = TALENT_BRANCHES.filter((b) => SIMPLE_BRANCHES[b.id]);
  const main = DESK_MAIN.map((id) => branches.find((b) => b.id === id)).filter(Boolean);
  const others = branches.filter((b) => !DESK_MAIN.includes(b.id));
  const total = TALENTS.reduce((n, t) => n + (state.talents[t.id] ?? 0), 0);
  const TITLES = ['Apprenti', 'Adepte', 'Expert', 'Maître', 'Grand maître', 'Sage', 'Légende'];
  const rank = Math.min(TITLES.length - 1, Math.floor(total / 25));
  const into = rank >= TITLES.length - 1 ? 1 : (total % 25) / 25;
  const rankBar = `<div class="d-rank"><b>${TITLES[rank]}</b>${mBar(into)}<span>${rank >= TITLES.length - 1 ? 'Titre maximal' : `${25 - (total % 25)} talents pour : ${TITLES[rank + 1]}`}</span></div>`;
  const adv = advancedOpen(state)
    ? mBtn(`Voir l'arbre complet (${others.length} autres branches) ›`, { action: 'tree-seg', value: 'tree', icon: 'icon_tree' })
    : mBtn('Arbre complet · après 3 Renaissances', { icon: 'icon_tree', disabled: true });
  const costs = TALENTS.filter((t) => (state.talents[t.id] ?? 0) < t.max && talentUnlocked(state, t)).map((t) => talentCost(t, state.talents[t.id] ?? 0));
  const miss = sg || !costs.length ? 0 : Math.max(0, Math.min(...costs) - state.fragments);
  const bestLabel = sg ? `Apprendre le meilleur (${formatNumber(sg.cost)} fragment${sg.cost > 1 ? 's' : ''})` : 'Apprendre le meilleur';
  const best = sg ? (rec ? mBtn : mBtnGold)(bestLabel, { action: 'talent-best', icon: 'icon_star' }) : mBtn(bestLabel, { icon: 'icon_star', disabled: true });
  return `${rankBar}<div class="d-br">${main.map((b) => deskBranch(state, b, b.id === rec)).join('')}</div>
    <div class="d-gains m-card"><div class="d-sec">Ce que tes talents te donnent déjà</div><div class="d-gain-grid">${talentGains(state)}</div></div>
    <details class="tb-others d-others"><summary>Autres branches (${others.length})</summary><div class="d-br d-br-others">${others.map((b) => deskBranch(state, b, false)).join('')}</div></details>
    <div class="d-pair"><div>${adv}</div><div>${best}${miss ? `<small class="d-miss">${missing(miss)}</small>` : ''}</div></div>`;
}

// ---------- Arbre avancé ----------
function deskSel(state, sel) {
  const lv = state.talents[sel.id] ?? 0;
  const st = nodeState(state, sel);
  const unlocked = talentUnlocked(state, sel);
  const maxed = lv >= sel.max;
  const region = TALENT_BRANCHES.find((b) => b.id === sel.region);
  const color = region?.color ?? '#ffe08a';
  const cost = talentCost(sel, lv);
  const pts = sel.gate ? regionPoints(state, sel.region) : 0;
  const next = sel.links.map((id) => talentById(id)).filter((n) => n && !(state.talents[n.id] ?? 0) && !talentConnected(state, n));
  const why = maxed || unlocked ? '' : sel.gate && talentConnected(state, sel) && pts < sel.gate ? `Il faut ${sel.gate} points dans ${region?.label ?? ''} (actuellement ${pts}).` : 'Apprends d\'abord un talent relié.';
  return `<div class="m-card d-tsel" style="--branch:${color}">
      <div class="d-tsel-head"><span class="d-disc big ${st}">${img(nodeIcon(sel))}</span><div><b>${escapeHtml(sel.name)}</b>
        <span class="muted"><span style="color:${color}">${region ? `${region.label} · ` : ''}${KIND_LABEL[sel.kind]}</span> · <span class="ts-state s-${st}">${STATE_LABEL[st]}</span></span></div></div>
      <div class="d-tsel-lv"><span>Niveau</span><b>${lv}/${sel.max}</b></div>${mBar(lv / sel.max)}
      <div class="d-tsel-eff">${lv ? `<div><small>Actuel</small><b>${effectText(talentLevelEffects(sel, lv))}</b></div>` : ''}
        ${maxed ? '<div class="good">Niveau maximum ✓</div>' : `<div><small>Donne :</small><b class="good">${effectText(talentLevelEffects(sel, lv + 1))}</b></div>`}</div>
      ${next.length ? `<div class="d-tsel-next"><small>Débloque ensuite :</small><div class="d-chips">${next.slice(0, 4).map((n) => `<span class="ts-chip">${img(nodeIcon(n))}${escapeHtml(n.name)}</span>`).join('')}${next.length > 4 ? `<span class="ts-chip">+${next.length - 4}</span>` : ''}</div></div>` : ''}
      ${why ? `<p class="d-why bad">${escapeHtml(why)}</p>` : ''}
    </div>
    ${maxed ? '' : `<div class="m-costs">${mCost('icon_fragment', state.fragments, cost, { fmt: formatNumber })}</div>
      ${mBtnGold('Apprendre', { action: 'buy-talent', attrs: `data-key="${sel.id}" data-cost="${cost}" data-currency="fragments"`, disabled: !unlocked || state.fragments < cost })}
      ${sel.max > 1 && unlocked ? mBtn('Max', { action: 'buy-talent-max', attrs: `data-key="${sel.id}"` }) : ''}`}`;
}

function deskAdvanced(ui, state) {
  const sel = talentById(ui.view.talentSel) ?? talentById('core');
  const shown = visibleTalents(state);
  const hits = treeSearchHits(ui.view.treeSearch, shown);
  const regions = TALENT_BRANCHES.filter((b) => TALENTS.some((t) => t.region === b.id && shown.has(t.id)));
  const reg = regions.find((b) => b.id === ui.view.mTreeRegion) ?? regions.find((b) => b.id === sel.region) ?? regions.find((b) => b.id === 'combat') ?? regions[0];
  const chips = `<div class="m-chips d-regchips" role="group" aria-label="Régions">${regions.map((b) => mChip(b.id === 'bridge' ? 'Ponts' : b.label, { action: 'm-set', on: b.id === reg.id, attrs: `data-key="mTreeRegion" data-value="${b.id}" style="--branch:${b.color}"` })).join('')}</div>`;
  const list = TALENTS.filter((t) => (t.region === reg.id || t.id === 'core') && shown.has(t.id));
  const rings = new Map();
  for (const t of list) { if (!rings.has(t.ring)) rings.set(t.ring, []); rings.get(t.ring).push(t); }
  const rows = [...rings.keys()].sort((a, b) => a - b).map((ring, i) => {
    const ts = rings.get(ring).sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
    const lit = ts.some((t) => (state.talents[t.id] ?? 0) > 0);
    return `${i ? `<i class="d-link${lit ? ' on' : ''}" aria-hidden="true"></i>` : ''}<div class="d-ring${lit ? ' on' : ''}">${ts.map((t) => treeNode(state, t, sel, { hit: Boolean(hits?.has(t.id)), flow: true })).join('')}</div>`;
  }).join('');
  const learned = list.filter((t) => (state.talents[t.id] ?? 0) > 0).length;
  const head = `<div class="d-advhead" style="--branch:${reg.color}"><span class="region-label" style="color:${reg.color}">${reg.id === 'bridge' ? 'Ponts' : reg.label}</span>
    <span class="muted">${reg.id === 'bridge' ? `${list.length} talents visibles` : `${regionPoints(state, reg.id)} point${regionPoints(state, reg.id) > 1 ? 's' : ''} · ${learned}/${TALENTS.filter((t) => t.region === reg.id).length} appris`}</span></div>`;
  const sg = suggestedTalent(state);
  const tools = fold(ui, 'tree-tools', 'Outils', () => `<div class="tree-head">
      <input id="tree-search" type="search" placeholder="Chercher (or, critique, PV…)" value="${escapeHtml(ui.view.treeSearch ?? '')}" autocomplete="off" aria-label="Chercher un talent"><span class="tree-hits muted"></span></div>
    <div class="d-tools">${mBtn('Tout apprendre…', { action: 'ask-buy-talents', value: '' })}</div>
    <div class="d-regbuys">${TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => mBtn(`Région ${b.label}`, { action: 'ask-buy-talents', value: b.id, cls: 'auto', attrs: `style="color:${b.color}"` })).join('')}</div>
    <div class="muted">Apprend le moins cher d'abord, tant que les fragments suffisent (une confirmation suit).</div>`,
  { cls: 'tree-tools-fold', extra: ui.view.treeSearch ? 'filtre actif' : '' });
  const help = fold(ui, 'tree-help', 'Aide', () => `<ul class="tree-help">
      <li>Touche un talent pour voir ce qu'il donne, puis « Apprendre » à droite.</li>
      <li>Un talent s'achète dès qu'un talent relié est appris ; « Débloque ensuite » liste ce qui s'ouvre après lui.</li>
      <li>Chaque couleur est une région ; les clés de voûte demandent des points dans leur région.</li></ul>`);
  const spent = fragmentsSpent(state);
  const respec = respecCost(state);
  return `<div class="d-adv">
    <div class="d-advtop"><span class="d-advfrag">${fragment()} <b class="num">${formatNumber(state.fragments)}</b> fragments à dépenser</span>
      ${sg ? mBtn(`Conseillé : ${sg.talent.name}`, { action: 'talent-sel', value: sg.talent.id, icon: 'icon_star', cls: 'auto' }) : ''}</div>
    ${chips}
    <div class="d-cols2"><div class="m-card d-lvs" style="--branch:${reg.color}">${head}${rows}</div><div class="d-tsel-col">${deskSel(state, sel)}</div></div>
    ${treeLegend(state)}${help}${tools}
    ${fold(ui, 'tree-respec', 'Réinitialiser l\'arbre', () => `<div class="row-between"><span class="muted">Rend les ${formatNumber(spent)} fragments investis.</span>
        ${mBtn(respec ? `${formatNumber(respec)} gemmes` : 'Gratuit (1re fois)', { action: 'respec-talents', cls: 'auto', disabled: !(spent > 0 && state.gems >= respec) })}</div>`)}
  </div>`;
}

// ---------- Renaissance ----------
function deskRebirth(ui, state) {
  const reward = rebirthReward(state);
  const can = canRebirth(state);
  const blocked = rebirthBlocked(state);
  const gain = PRESTIGE.rebirthMultiplier ** rebirthGain(state);
  const keep = memoryShare(state);
  const f = prestigeFactors(state);
  const n = state.records.rebirths;
  const tile = (cls, icon, value, label) => `<div class="rb-tile"><span class="d-rb-ico ${cls}">${img(icon)}</span><div><b>${value}</b><span>${label}</span></div></div>`;
  const art = `<div class="d-phx"><img class="px" src="assets/ui/art98/phoenix_rebirth.png" alt="" aria-hidden="true"><b class="d-phx-n">Renaissance</b>
      <span class="d-phx-s">${n} effectuée${n > 1 ? 's' : ''}</span>
      ${f.total > 1 ? `<div class="rb-total"><span class="muted">Prestige actuel</span> <b class="good">×${mult(f.total)}</b> <span class="muted">dégâts, PV et or</span></div>` : ''}</div>`;
  let body;
  if (can) {
    const now = computeHeroStats(state).combatPower, worth = rebirthWorth(state);
    const later = rebirthReward(state, state.maxStage + 10);
    body = `<div class="d-ba"><div><small>Puissance avant</small><b class="num">${formatNumber(now)}</b></div><i aria-hidden="true">»</i><div><small>Après</small><b class="num good">${formatNumber(now * gain)}</b></div></div>
      <div class="d-sec">Ce que tu gagnes</div>
      <div class="d-gets">${tile('ep', 'icon_fragment', `+${formatNumber(reward)}`, 'fragments')}${tile('lg', 'icon_damage', `×${gain.toFixed(2).replace('.', ',')}`, 'pour toujours')}${tile('ra', 'icon_bolt', '1', 'pouvoir gardé')}</div>
      <div class="d-sec">Ce qui se passe</div>
      <div class="m-card d-what"><div class="d-what-top"><span>↺ Retour à l'étape 1${keep > 0 ? ` · ${Math.round(keep * 100)} % des améliorations gardés` : ''}</span><span>⏱ Retour à ${stageLabel(state.maxStage)} en ≈ ${formatDuration(rebirthCatchUp(state))}</span></div>
        <ul class="d-keep">${REBIRTH_KEEPS.map((x) => `<li>${x}</li>`).join('')}</ul><ul class="d-lose">${REBIRTH_RESETS.map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div class="d-worth${worth ? ' ok' : ''}">${worth ? '<span>✓ <b>Rentable maintenant</b> · tu bloques depuis 8 h et le gain dépasse ×1,25</span>' : '<span>Rentable quand elle donne au moins ×1,25 et que tu bloques depuis 8 h de jeu</span>'}<small>+10 étapes : +${formatNumber(later)}</small></div>
      ${blocked ? `<p class="d-why bad">${escapeHtml(blocked)}</p>` : ''}`;
  } else {
    body = `<div class="m-empty">${img('icon_rebirth')}<p>Atteins l'étape ${stageLabel(REBIRTH.minStage)} pour renaître (max ${stageLabel(state.maxStage)}).</p></div>`;
  }
  const open = ui.view.open?.has('rebirth-bonus');
  const bonus = open ? `<div class="m-card d-bonus">${bonusList(state, 'd-buy')}${deskTranscend(state)}</div>` : '';
  return `<div class="d-ph"><div class="d-ph-art">${art}</div><div class="d-ph-main">${body}
      <button type="button" class="m-btn-gold d-renaitre" data-action="rebirth" ${can && !blocked ? '' : 'disabled'}>${img('icon_rebirth')}<span>Renaître · +${formatNumber(reward)}</span>${fragment()}</button>
      <button type="button" class="m-btn" data-action="toggle-section" data-value="rebirth-bonus" aria-expanded="${Boolean(open)}"><span>Bonus éternels et stellaires ${open ? '‹' : '›'}</span></button></div></div>${bonus}`;
}

function deskTranscend(state) {
  const t = state.transcend;
  if (!canTranscend(state) && !t.count && !t.stars) return '';
  const reward = transcendReward(state);
  return `<div class="d-transcend"><div class="d-sec">Transcendance <span class="muted">${t.count} · ${formatNumber(t.stars)} ${starsIcon()}</span></div>
    <div class="muted">Recommence tout (Renaissances comprises, ${Math.round(keptRebirthShare(state) * 100)} % gardées) contre des <b>Étoiles</b> ; chaque Transcendance multiplie aussi dégâts, PV et or ×${TRANSCEND.powerPerTranscend} pour toujours.</div>
    ${reward > 0 && rebirthBlocked(state) ? `<div class="bad">${rebirthBlocked(state)}</div>` : ''}
    <button type="button" class="m-btn" data-action="transcend" ${reward > 0 && !rebirthBlocked(state) ? '' : 'disabled'}>${starsIcon()}<span>Transcender +${formatNumber(reward)}</span></button></div>`;
}

function deskTree(ui, state, seg, items) {
  const modes = items.length > 1 ? mModes(items.map(([id, label]) => ({ id, label, icon: DESK_ICON[id] ?? 'icon_star', action: 'tree-seg', value: id })), seg) : '';
  const help = ui.view.helpOpen === 'tree' ? `<div class="m-card m-help-card d-help">${TREE_INTRO}</div>` : '';
  const content = seg === 'rebirth' ? deskRebirth(ui, state) : seg === 'tree' ? deskAdvanced(ui, state) : seg === 'region' ? regionView(state) : deskSimple(state);
  // La phrase d'explication reste lisible en bulle sur la pastille (les paragraphes vont derrière le « ? »).
  return `<div class="m-frame m-hero m-tr d-tal d-tal-${seg}">${mTitle('icon_star', 'Talents', true)}
    <div class="d-frag" title="${escapeHtml(TREE_INTRO)}">${fragment()}<span>Fragments :</span> <b class="num">${formatNumber(state.fragments)}</b></div>${help}${modes}${content}</div>`;
}

export default {
  id: 'tree',
  title: 'Talents',
  icon: 'icon_tree',
  extra: (ui, state) => `${fragment()}<b class="num">${formatNumber(state.fragments)}</b>`,
  afterRender(ui, body) {
    // v10.13 : l'arbre avancé PC est une liste de nœuds (plus de fenêtre zoomable) ; il ne reste que la recherche.
    // Recherche : surligne les talents correspondants sans redessiner le panneau.
    const input = body.querySelector('#tree-search');
    const highlight = () => {
      const hits = treeSearchHits(input.value, visibleTalents(ui.state));
      ui.view.treeSearch = input.value;
      body.querySelectorAll('.d-adv .tnode').forEach((el) => el.classList.toggle('hit', Boolean(hits?.has(el.dataset.value))));
      body.querySelectorAll('.d-adv [data-key="mTreeRegion"]').forEach((chip) => { // nombre de résultats par région, sur sa puce
        const n = hits ? TALENTS.filter((t) => hits.has(t.id) && t.region === chip.dataset.value).length : 0;
        if (n) chip.dataset.hits = String(n); else delete chip.dataset.hits;
      });
      const out = body.querySelector('.tree-hits');
      if (out) out.textContent = hits ? `${hits.size} résultat${hits.size > 1 ? 's' : ''}` : '';
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
    if (ui.root?.classList.contains('m-phone')) return phoneTree(ui, state, seg, items); // v10.12 (lot 4)
    return deskTree(ui, state, seg, items); // v10.13 (lot 5) : PC en kit « vrai jeu » (cadre, cartouche, modes, grandes cartes illustrées)
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
const STATE_LABEL = { gated: 'Verrouillé', open: 'Achetable', owned: 'Appris', maxed: 'Maximum', locked: 'Verrouillé' };

// v10.13 : en liste (flow), le nœud est une pastille ronde de 64 px avec son nom lisible dessous (plus de position absolue).
function treeNode(state, t, sel, { ghost = false, hit = false, flow = false } = {}) {
  const level = state.talents[t.id] ?? 0;
  const st = nodeState(state, t);
  const color = REGION_COLOR[t.region] ?? (t.region === 'bridge' ? '#e8e2d0' : '#ffe08a');
  const cost = talentCost(t, level);
  const canBuy = (st === 'open' || st === 'owned') && talentUnlocked(state, t);
  const afford = canBuy && state.fragments >= cost;
  const val = shortValue(t, level);
  const badge = st === 'maxed' ? '<span class="tn-badge tn-max">✓</span>' : st === 'gated' || st === 'locked' ? `<span class="tn-badge tn-lock">${img('icon_lock')}</span>` : '';
  const cls = `tnode k-${t.kind} ${st}${afford ? ' afford' : ''}${ghost ? ' ghost' : ''}${t.id === sel.id ? ' selected' : ''}${hit ? ' hit' : ''}`;
  const pos = flow ? '' : `left:${pctX(t).toFixed(2)}%;top:${pctY(t).toFixed(2)}%;`;
  return `<button class="${cls}" style="${pos}--branch:${color}" data-action="talent-sel" data-value="${t.id}"
    title="${escapeHtml(t.name)} · ${level}/${t.max} — ${escapeHtml(effectText(talentLevelEffects(t, Math.max(1, level))))}">
    <span class="tn-disc">${img(nodeIcon(t))}</span>${badge}
    ${flow ? `<span class="tn-name">${escapeHtml(t.name)}</span>` : ''}
    ${t.max > 1 && level ? `<span class="tn-lv">${level}/${t.max}</span>` : ''}
    ${val ? `<span class="tn-val">${val}</span>` : ''}
    ${canBuy && !ghost ? `<span class="tn-cost${afford ? '' : ' poor'}">${fragment()}${formatNumber(cost)}</span>` : ''}</button>`;
}

function treeLegend(state) {
  const sample = (cls, label) => `<span class="tl-item"><i class="tl-dot ${cls}"></i>${label}</span>`;
  const branches = TALENT_BRANCHES.filter((b) => b.id !== 'bridge').map((b) => `<span class="tl-branch" style="--branch:${b.color}"><i></i>${b.label} <b>${regionPoints(state, b.id)}</b></span>`).join('');
  return `<div class="tree-legend2">
    <div class="tl-row">${sample('afford', 'Achetable')}${sample('open', 'Fragments insuffisants')}${sample('owned', 'Appris')}${sample('maxed', 'Maximum')}${sample('gated', 'Verrouillé')}</div>
    <div class="tl-row">${branches}</div></div>`;
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

// v9.1.3 (doc1 F, essai) : bonus éternels (fragments) et stellaires (Étoiles) en une seule liste ; chaque prix
// garde sa monnaie. Le détail des 3 multiplicateurs est en tête.
function bonusList(state, cls = 'btn-gold small') {
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
      ${costButton({ action: 'buy-perk', cost: perkCost(level), have: state.fragments, currency: 'fragments', attrs: `data-key="${perk.id}"`, cls, max: maxed })}</div>`;
  }).join('');
  const showStellar = t && (canTranscend(state) || t.count || t.stars);
  const stellar = !showStellar ? '' : TRANSCEND_PERKS.map((perk) => {
    const level = perkLevel(state, perk.id);
    const maxed = level >= perk.max;
    return `<div class="perk-row">${img(perk.icon)}<div class="grow"><b>${escapeHtml(perk.name)}</b> <span class="muted">${level}/${perk.max}</span> ${starsIcon()}
        <div class="${level ? 'good' : 'muted'}">${perk.text(Math.max(1, level))}${level ? '' : ' (au niveau 1)'}</div></div>
      ${costButton({ action: 'buy-tperk', cost: transcendPerkCost(perk, level), have: t.stars, currency: 'stars', attrs: `data-key="${perk.id}"`, cls, max: maxed })}
      ${maxed ? '' : `<button class="btn small" data-action="buy-tperk-max" data-key="${perk.id}">Max</button>`}</div>`;
  }).join('');
  return `${detail}${eternal}${stellar}`;
}

export function transcendKeepResetLists() {
  return `<div class="keep-reset">
      <div><div class="section-title">Réinitialisé</div><ul>${TRANSCEND_RESETS.map((x) => `<li class="bad">${x}</li>`).join('')}</ul></div>
      <div><div class="section-title">Conservé</div><ul>${TRANSCEND_KEEPS.map((x) => `<li class="good">${x}</li>`).join('')}</ul></div>
    </div>`;
}
