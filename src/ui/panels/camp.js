// v10.3 (partie 10) : le Camp devient le Bastion (même panneau `camp` : navigation et sauvegardes inchangées).
// v10.4 (partie 6) : une vraie partie gestion, en page plein écran (ui/page.js) :
//  - .pg-top : ouvriers, or, éclats, niveau du Bastion, et la bascule Carte / Recherches ;
//  - .pg-main : la carte du village (décor PixelLab), les bâtiments dessinés dessus à leur palier (niveau 1, 4, 8 ;
//    chantier ; silhouette quand ils sont verrouillés, avec leur condition), vivants (fumée, étincelles, pages,
//    cristaux), chaque ouvrier devant son bâtiment avec son outil, la barre de chantier et le temps restant ;
//    ou l'arbre des Recherches (un nœud illustré par recherche, liens allumés, celle en cours entourée) ;
//  - .pg-side : la fiche du bâtiment (ouvrier en portrait et métier en icône, ouvriers possibles en grille avec leur
//    bonus : un toucher les pose, « Améliorer » avant → après, commandes du forgeron, production, échanges).
// Téléphone : la carte défile en largeur, la fiche est une feuille du bas. Avant l'étape 40 : le Camp d'avant.
// Les minuteurs avancent sans redessiner : `tick` met à jour les éléments [data-bt-end] une fois par seconde.
import { BALANCE } from '../../data/balance.js';
import { SLOTS } from '../../data/items.js';
import { BASTION_MAX_LEVEL, BASTION_UNLOCK_STAGE, FORGE_PERKS, LIBRARY, RESEARCH_UNLOCK_LEVEL, TRADE_POST, WORKER_RULES } from '../../data/bastion.js';
import {
  BUILDINGS, ORDER_TIERS, RESEARCH, RESEARCH_BRANCHES, TRADES, availableWorkers, bastionLevel, bastionOf, buildCost, buildRemaining, buildingAccess,
  buildingDef, buildingLevel, canBuild, researchDef, canOrder, canResearch, forgePerks, orderChances, orderCost, orderLabel, orderRemaining, orderSlots, orderTierOpen,
  ordersReady, productionFactor, productionOf, researchCost, researchRemaining, researchSlots, researchStatus, stockOf, tradeLeft,
  tradeOf, tradeOffer, workerBonus, workerBuilding, workerOf, workerSlots, workersPlaced,
} from '../../core/bastion.js';
import { placedLine, tipSeen } from '../../core/bastion-start.js';
import { companionById } from '../../core/companions.js';
import { LOOT_BAG_MAX } from '../../core/inventory.js';
import { formatDuration } from '../../core/format.js';
import { rarityById } from '../../core/loot.js';
import { REVENGE_STEPS, revengeLevel } from '../../core/revenge.js';
import { totalStars } from '../../core/world-stars.js';
import { activeBonds } from '../../data/bonds.js';
import { slotIconName } from '../../render/pixel.js';
import { animCanvas } from '../animator.js';
import { BASTION_FX } from '../bastion-art.js';
import { coin, escapeHtml, formatNumber, img, shard } from '../common.js';
import { pageActive } from '../page.js';
import { AGES, KEYSTONES } from '../../data/bastion.js'; // v10.8 : Âges du Bastion
import { ageDef, bastionAge, bastionMult, nextAge } from '../../core/bastion-base.js';
import { BLACK_MARKET_SHARDS, ENGRAVE_SHARDS, ascensionCost, ascensionPool, blackMarketOpen, canAscend, canEngrave } from '../../core/bastion-ages.js';
import { rarityIndex } from '../../core/loot.js';
import expeditionsPanel, { companionStill, isPhoneUi } from './expeditions.js';
import { mBar, mBtn, mBtnGold, mChip, mCost, mGrid, mModes, mSheet, mStat, mTile, mTitle } from '../mobile-kit.js'; // v10.12 : kit mobile (téléphone)

let DESK = false; // v10.13 : vrai pendant le rendu de la carte PC (noms courts sous les bâtiments)
let PHONE = false; // v10.12 : vrai pendant le rendu téléphone (le PC garde son HTML d'origine)

const ART = (name) => `assets/ui/art104/${name}.png`;
const RES_NAME = { shards: 'éclats', grimoire: 'grimoires', ascension: 'pierres', mastery: 'essences' };
const RES_ICON = { shards: 'icon_shard', grimoire: 'icon_grimoire', ascension: 'icon_ascension', mastery: 'icon_mastery' };
const resName = (key, n) => (n === 1 ? RES_NAME[key].slice(0, -1) : RES_NAME[key]);
const dec = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Nœud illustré de chaque recherche (assets/ui/art104/research_node_<motif>.png).
export const RESEARCH_ART = {
  sharp: 'sword', steel: 'steelheart', fatal: 'skull', guard: 'shield', breath: 'breath', war: 'banner',
  spirit: 'hands', recall: 'hourglass', bond: 'rings', drill: 'dummy', scouts: 'spyglass', crew: 'gear',
  purse: 'purse', vigil: 'moon', hunter: 'eye', roads: 'cart', vein: 'crystal', lessons: 'book',
};
export const researchArt = (id) => { const r = RESEARCH.find((x) => x.id === id); return r?.tier ? `assets/ui/art108/${r.art}.png` : ART(`research_node_${RESEARCH_ART[id] ?? 'book'}`); }; // v10.8 : paliers II à V (art108)
export const tradeArt = (trade) => ART(`trade_${trade ?? 'smith'}`);
// Palier dessiné d'un bâtiment : niveau 1, 4 et 8 ; chantier (niveau 0) ; silhouette quand il est verrouillé.
export function buildingArt(state, def, level = buildingLevel(state, def.id)) {
  const open = bastionOf(state) && buildingAccess(state, def.id).available;
  if (def.existing) return ART(open ? 'bastion_expeditions' : 'bastion_expeditions_locked');
  // v10.8 : bâtiments des Âges (art108, 3 paliers dans l'âge) ; verrouillé : le premier palier, grisé (classe .locked).
  if (def.age) { const a0 = (def.age - 1) * 10; return `assets/ui/art108/bastion_${def.id}_lv${!open || level < a0 + 4 ? 1 : level < a0 + 8 ? 2 : 3}.png`; }
  if (!open) return ART(`bastion_${def.id}_locked`);
  if (level < 1) return ART('bastion_site');
  return ART(`bastion_${def.id}_lv${level >= 8 ? 8 : level >= 4 ? 4 : 1}`);
}
// Place de chaque bâtiment sur la carte (en % du décor 384 × 216) : centre et bas du bâtiment, largeur.
const PLOTS = {
  forge: { x: 17, y: 56, w: 21 }, library: { x: 84, y: 56, w: 21 }, mine: { x: 15, y: 98, w: 21 },
  training: { x: 66, y: 100, w: 21 }, trade: { x: 41, y: 78, w: 18 }, expeditions: { x: 51, y: 38, w: 17 },
  // v10.8 : bâtiments des Âges, sur le pourtour de la carte agrandie
  enchant: { x: 33, y: 46, w: 15 }, menagerie: { x: 88, y: 92, w: 16 }, observatory: { x: 68, y: 40, w: 14 },
  runes: { x: 7, y: 78, w: 14 }, ascension: { x: 52, y: 100, w: 16 }, wonder: { x: 93, y: 34, w: 14 },
};
// v10.9 (partie 2) : une carte par âge (assets/ui/art109, tools/art/pl109_maps.py), avec ses propres emplacements relevés
// sur l'image : chaque bâtiment se pose sur une dalle dessinée au sol, jamais sur un mur. cols = centres (%), rows = bas
// des dalles (%), w = largeur du bâtiment (%). Les bâtiments prennent les dalles dans l'ordre de ORDER109.
const ORDER109 = ['forge', 'library', 'mine', 'training', 'trade', 'expeditions', 'enchant', 'menagerie', 'observatory', 'runes', 'ascension', 'wonder'];
const GRID109 = {
  1: { cols: [20, 40, 60, 80], rows: [44, 68, 92], w: 15 },
  2: { cols: [11, 26.5, 42, 57.5, 73, 88.5], rows: [46, 71], w: 13 }, // v10.11 : deux premières rangées (la dernière sortait du cadre)
  3: { cols: [19.5, 40, 60, 80], rows: [43, 67, 91], w: 15 },
  4: { cols: [20, 40, 60, 80], rows: [43, 67, 91], w: 14 },
  5: { cols: [23, 41, 59, 77], rows: [40, 63, 87], w: 12 },
};
export const PLOTS_BY_AGE = Object.fromEntries(Object.entries(GRID109).map(([age, g]) => {
  const spots = g.rows.flatMap((y) => g.cols.map((x) => ({ x, y, w: g.w })));
  const gap = Math.min(...g.cols.slice(1).map((c, i) => c - g.cols[i]));
  return [age, Object.fromEntries(ORDER109.map((id, i) => [id, { ...spots[i], tag: gap - 1.5 }]))];
}));
// Animations des bâtiments (planches PixelLab) : où les poser sur l'image du bâtiment (en % de sa boîte).
const LIFE = {
  forge: [['fx_forge_smoke', 25, -8, 2], ['fx_forge_sparks', 30, 42, 2]],
  library: [['fx_library_pages', 62, 52, 2]],
  mine: [['fx_mine_crystals', 18, 50, 2], ['fx_mine_crystals', 70, 58, 1]],
};
// Condition courte d'un bâtiment verrouillé (la phrase entière est dans le titre).
function shortReason(reason) {
  return reason.replace(/^Arrive à l'étape (\d+)$/, 'Étape $1').replace(/^Construis d'abord : (.+)$/, 'Après : $1')
    .replace(/^Bastion niveau (\d+) requis$/, 'Bastion niv. $1').replace(/^S'ouvre avec 5 compagnons$/, '5 compagnons');
}

// v10.12 (carte du Bastion, téléphone) : noms courts sous les bâtiments (le nom entier reste dans le titre et la fiche),
// durées sans espaces (« 1 h 20 min » → « 1h20 », « 11 min 57 s » → « 11m57 »).
const SHORT_NAME = { forge: 'Forge', library: 'Biblio.', mine: 'Mine', training: 'Camp', trade: 'Marché', expeditions: 'Expéd.',
  enchant: 'Enchant.', menagerie: 'Ménag.', observatory: 'Observ.', runes: 'Runes', ascension: 'Ascens.', wonder: 'Merveille' };
const shortName = (def) => SHORT_NAME[def.id] ?? def.name;
function shortTime(txt) {
  return String(txt).replace(/(\d+) h (\d+)( min)?/, '$1h$2').replace(/(\d+) min (\d+)( s)?/, '$1m$2').replace(/(\d+) min\b/, '$1m').replace(/(\d+) j (\d+) h/, '$1j$2h').replace(/(\d+) s\b/, '$1s');
}
function phoneReason(reason) {
  const r = shortReason(reason).replace(/^Âge (\S+) : .*$/, 'Âge $1').replace(/^Bastion niv\. (\d+)$/, 'Niv. $1').replace(/^5 compagnons$/, '5 compag.');
  const m = r.match(/^Après : (.+)$/);
  const dep = m ? BUILDINGS.find((d) => d.name === m[1]) : null;
  return dep ? `Après ${shortName(dep)}` : r;
}

// ---------------------------------------------------------------- minuteurs (mis à jour sans redessin)

// Temps restant : « 1 h 20 min », « en pause » sans ouvrier. `ms` : temps réel restant.
function timer(ms, now) {
  if (!Number.isFinite(ms)) return '<span class="bs-time bad">en pause</span>';
  return `<span class="bs-time" data-bt-end="${Math.round(now + ms)}">encore ${formatDuration(ms / 1000)}</span>`;
}
// Barre d'un travail : `job` { left, total }, `factor` vitesse actuelle.
function jobBar(job, factor, now, cls = '') {
  const ratio = 1 - job.left / job.total;
  const live = factor > 0 ? ` data-bt-end="${Math.round(now + job.left / factor)}" data-bt-span="${Math.round(job.total / factor)}"` : '';
  return `<div class="bs-bar ${cls}"><i style="width:${(Math.max(0, Math.min(1, ratio)) * 100).toFixed(1)}%"${live}></i></div>`;
}
// Stock d'un bâtiment de production : la barre et le nombre montent seuls.
function stockBar(state, id, now) {
  const prod = productionOf(state, id);
  const stock = stockOf(state, id);
  const rate = (prod.perHour * productionFactor(state, id)) / 3_600_000;
  const live = `data-bt-stock="${stock}" data-bt-rate="${rate}" data-bt-cap="${prod.cap}" data-bt-at="${now}"`;
  return `<div class="bs-bar stock${stock >= prod.cap ? ' full' : ''}"><i style="width:${Math.min(100, (stock / prod.cap) * 100).toFixed(1)}%" ${live}></i></div>
    <span class="bs-time">${img(RES_ICON[prod.resource])} <b class="num" ${live}>${Math.floor(stock)}</b> / ${prod.cap}</span>`;
}

function tick(ui) {
  const now = Date.now();
  const root = ui.$('panel-body');
  if (!root) return;
  for (const el of root.querySelectorAll('[data-bt-end]')) {
    const left = Number(el.dataset.btEnd) - now;
    if (el.dataset.btSpan) el.style.width = `${(Math.max(0, Math.min(1, 1 - left / Number(el.dataset.btSpan))) * 100).toFixed(1)}%`;
    else { const text = left <= 0 ? ((PHONE || el.dataset.btTiny) && el.dataset.btShort ? 'fini' : 'terminé') : `${el.dataset.btShort ? '' : 'encore '}${(PHONE || el.dataset.btTiny) && el.dataset.btShort ? shortTime(formatDuration(left / 1000)) : formatDuration(left / 1000)}`; if (el.textContent !== text) el.textContent = text; }
  }
  for (const el of root.querySelectorAll('[data-bt-stock]')) {
    const cap = Number(el.dataset.btCap);
    const v = Math.min(cap, Number(el.dataset.btStock) + Number(el.dataset.btRate) * (now - Number(el.dataset.btAt)));
    if (el.tagName === 'I') el.style.width = `${Math.min(100, (v / cap) * 100).toFixed(1)}%`;
    else { const text = String(Math.floor(v)); if (el.textContent !== text) el.textContent = text; }
  }
}

// Empreinte de ce qui change la mise en page (le reste — temps, stocks — est mis à jour par `tick`).
export function bastionLiveKey(ui, state) {
  const b = bastionOf(state);
  if (!b) return `camp|${Math.max(state.maxStage, state.records?.bestStage ?? 1) >= BASTION_UNLOCK_STAGE}`;
  const afford = [Math.floor(Math.log10((state.gold ?? 0) + 1) * 6), Math.floor((state.materials?.shards ?? 0) / 10)];
  return [
    Object.entries(b.buildings).map(([id, s]) => `${id}${s.level}${s.worker ?? ''}${s.build ? 'b' : ''}`).join(),
    JSON.stringify(b.research.levels), b.research.active.map((a) => a.id).join(), b.orders.map((o) => `${o.id}${o.ready ? 'r' : ''}`).join(),
    Object.keys(b.stock).map((id) => Math.floor(stockOf(state, id)) >= 1).join(), b.trade?.used ?? 0, afford.join(),
    BUILDINGS.map((d) => buildingAccess(state, d.id).available).join(), (state.expeditions?.slots ?? []).map((s) => s?.companionId ?? '').join(),
    state.companions.equipped.join(), (state.lootBag?.length ?? 0) >= LOOT_BAG_MAX, Math.floor(Date.now() / 60000), (b.tips ?? []).length,
  ].join('|');
}

// ---------------------------------------------------------------- textes par bâtiment

// Ce que donne un bâtiment à un niveau : [[libellé, valeur]] (comparé avant → après dans « Améliorer »).
function levelEffects(state, id, level) {
  if (id === 'forge') {
    const p = forgePerks(state, level);
    const rule = BALANCE.forge.fusion.epic ?? { stakes: {} };
    const chance = (base) => (base === undefined ? null : `${Math.min(Math.max(base, p.fusionCap), base + p.fusionPoints)} %`);
    return [
      ['Fusion à 3 objets', chance(rule.stakes?.[3])], ['Fusion à 4 objets', chance(rule.stakes?.[4])],
      ['Renforcement maximal', `+${(BALANCE.forge.maxUpgrades.epic ?? 10) + p.maxUpgradeBonus}`],
      ['Coût des renforcements', p.upgradeCostPct ? `−${p.upgradeCostPct} %` : '—'],
      ['Commandes en même temps', String(p.orderSlots)], ['Coût des commandes', `−${p.orderCostPct} %`],
      ['Commande Légendaire+', p.legendaryOrders ? 'oui' : `niveau ${FORGE_PERKS.legendaryOrderLevel}`],
    ].filter(([, v]) => v !== null);
  }
  if (id === 'library') {
    return [['Recherches en même temps', level < 1 ? '0' : level >= LIBRARY.secondSlotLevel ? '2' : '1'],
      ['Durée des recherches', level > 1 ? `−${Math.min(60, LIBRARY.durationPctPerLevel * (level - 1))} %` : '—']];
  }
  if (id === 'mine' || id === 'training') {
    const prod = productionOf(state, id, Math.max(1, level));
    if (level < 1) return [[id === 'mine' ? 'Éclats par heure' : 'Grimoires par jour', '0'], ['Stock', '—']];
    return [[id === 'mine' ? 'Éclats par heure' : 'Grimoires par jour', id === 'mine' ? dec(prod.perHour) : dec(prod.perHour * 24)],
      ['Stock', `${prod.cap} (${dec(prod.capHours)} h)`]];
  }
  if (id === 'trade') {
    return [['Échanges par jour', level < 1 ? '0' : String(TRADE_POST.perDay.base + TRADE_POST.perDay.perLevel * level)],
      ['Taux d\'échange', level > 1 ? `+${TRADE_POST.ratePctPerLevel * (level - 1)} %` : '—']];
  }
  return [];
}

// Total d'une recherche à un niveau : « +6 % de dégâts » (le nombre de la phrase × le niveau).
function researchText(def, level) {
  return def.text.replace(/\d+(?:,\d+)?/, (m) => dec(parseFloat(m.replace(',', '.')) * Math.max(1, level)));
}

// ---------------------------------------------------------------- la carte du village

// Planche animée posée sur un bâtiment (CSS : une image par pas, arrêtée avec « réduire les animations »).
function life(id) {
  return (LIFE[id] ?? []).map(([fx, x, y, k]) => {
    const m = BASTION_FX[fx];
    if (!m) return '';
    return `<i class="bs-life" aria-hidden="true" style="left:${x}%;top:${y}%;width:${m.w * k}px;height:${m.h * k}px;background-image:url(${ART(fx)});background-size:${m.w * m.n * k}px ${m.h * k}px;--n:${m.n};--sheet:-${m.w * m.n * k}px;animation-duration:${(m.n / m.fps).toFixed(2)}s"></i>`;
  }).join('');
}

// Petit ouvrier animé devant son bâtiment, l'outil de son métier à la main.
function workerSprite(c, def) {
  return `<span class="bs-worker" title="${escapeHtml(c.name)}">${animCanvas(`foe:${c.sprite}`, 64, 56, 1)}<img class="px bs-tool t-${def.tool}" src="${tradeArt(def.trade)}" alt=""></span>`;
}

function plot(ui, state, def, now) {
  const p = PLOTS_BY_AGE[Math.min(5, Math.max(1, bastionAge(state)))]?.[def.id] ?? PLOTS[def.id];
  const access = buildingAccess(state, def.id);
  const sel = ui.view.bastionSel === def.id;
  const style = `left:${p.x}%;top:${p.y}%;width:${p.w}%${p.tag ? `;--tagw:${(p.tag / p.w) * 100}%` : ''}`;
  const art = `<img class="px bs-bimg" src="${buildingArt(state, def)}" alt="" draggable="false">`;
  if (!access.available) {
    return `<div class="bs-plot locked" style="${style}" data-building="${def.id}" title="${escapeHtml(`${def.name} : ${access.reason}`)}" aria-label="${escapeHtml(`${def.name} : ${access.reason}`)}">${art}
      ${PHONE ? `<i class="bs-lockic" aria-hidden="true">${img('icon_lock')}</i><span class="bs-tag lock"><span class="bs-nm">${escapeHtml(shortName(def))}</span><small class="bs-why2">${escapeHtml(phoneReason(access.reason))}</small></span>` : `<span class="bs-tag lock">${img('icon_lock')}${escapeHtml(shortReason(access.reason))}</span>`}</div>`;
  }
  const b = bastionOf(state);
  const slot = b.buildings[def.id];
  const lv = buildingLevel(state, def.id);
  const w = workerOf(state, def.id);
  const c = w ? companionById(w) : null;
  let job = '';
  if (slot?.build) {
    const f = slot.worker ? productionFactor(state, def.id) : 0;
    const r = buildRemaining(state, def.id);
    job = `<span class="bs-job">${jobBar(slot.build, f, now, 'build')}${Number.isFinite(r) ? `<span class="bs-time" data-bt-short="1" data-bt-end="${Math.round(now + r)}">${PHONE ? shortTime(formatDuration(r / 1000)) : formatDuration(r / 1000)}</span>` : `<span class="bs-time bad">${PHONE ? 'pause' : 'en pause'}</span>`}</span>`;
  } else if (def.id === 'forge' && b.orders.some((o) => !o.ready)) {
    const o = b.orders.find((x) => !x.ready);
    job = `<span class="bs-job work">${jobBar(o, productionFactor(state, 'forge'), now, 'work')}</span>`;
  } else if (def.id === 'library' && b.research.active[0]) {
    job = `<span class="bs-job work">${jobBar(b.research.active[0], productionFactor(state, 'library'), now, 'work')}</span>`;
  }
  const ready = (def.id === 'forge' && ordersReady(state).length) || (productionOf(state, def.id) && stockOf(state, def.id) >= productionOf(state, def.id).cap);
  const missing = !def.existing && !w;
  const lvTag = def.existing ? '' : missing ? '<b class="bs-lvl need">+ Ouvrier</b>' : `<b class="bs-lvl">${lv < 1 ? '0' : lv}</b>`;
  return `<button class="bs-plot${sel ? ' sel' : ''}${missing ? ' idle' : ''}" style="${style}" data-action="bastion-open" data-value="${def.id}" data-building="${def.id}" aria-label="${escapeHtml(def.name)}">
      ${art}${lv >= 1 && !slot?.build ? life(def.id) : ''}${c ? workerSprite(c, def) : ''}
      ${missing ? '<span class="bs-need" title="Il manque un ouvrier : touche pour en poser un"><i aria-hidden="true">⛏</i><b>+</b></span>' : ''}${ready ? '<i class="bs-dot" aria-hidden="true"></i>' : ''}
      ${PHONE ? `${missing ? '<b class="bs-lvl need bs-pill">+ Ouvrier</b>' : def.existing ? '' : `<b class="bs-lvl bs-chip-lv">${lv < 1 ? '0' : lv}</b>`}<span class="bs-tag"><span class="bs-nm">${escapeHtml(shortName(def))}</span></span>` : `<span class="bs-tag">${lvTag}${escapeHtml(DESK ? shortName(def) : def.name)}</span>`}${job}</button>`;
}

function kickRibbon(ui) {
  const k = ui.view.bastionKick;
  if (!k) return '';
  const lines = k.placed.map((p) => `<span>${img(`file:${tradeArt(tradeOf(p.companionId))}`)}${escapeHtml(placedLine(p))}</span>`).join('');
  const gift = k.build ? `<span class="gift">${img(`file:${ART('bastion_site')}`)}Chantier offert : ${escapeHtml(buildingDef(k.build.building).name)}, ${formatDuration(k.build.ms / 1000)}</span>` : '';
  return `<div class="bs-kick" role="status"><b>Ton Bastion se met au travail</b>${lines}${gift}<button class="btn small" data-action="bastion-kick-ok">OK</button></div>`;
}

// v10.8 (partie 4) : la carte grandit à chaque âge ; un bandeau dit l'âge, ce que le Bastion apporte et le suivant ;
// au passage d'un âge, un fondu et la bannière « La Citadelle » (une fois).
function ageRibbon(ui, state) {
  const age = bastionAge(state), a = ageDef(age), nx = nextAge(state);
  const mult = bastionMult(state, 'damage');
  const seen = (state.ui.ageSeen ??= 1);
  const fresh = age > seen;
  if (fresh) state.ui.ageSeen = age;
  if (PHONE && fresh) ui.view.bastionAgeNew = age;
  return `<div class="bs-age" style="--age:${a.color}"><b>Âge ${a.roman} · ${escapeHtml(a.name)}</b><span>niveaux jusqu'à ${a.maxLevel}${mult > 1.001 ? ` · ×${dec(mult)} dégâts et vie` : ''}</span>
      ${nx ? `<small>Âge ${nx.roman} · ${escapeHtml(nx.name)} : étape ${nx.stage}${nx.bastionLevel ? `, Bastion niveau ${nx.bastionLevel}` : ''}</small>` : '<small>Âge maximal</small>'}</div>
    ${fresh && !PHONE ? `<div class="bs-age-new" role="status" style="--age:${a.color}"><small>Nouvel âge</small><b>${escapeHtml(a.name)}</b></div>` : ''}`;
}
function villageMap(ui, state, now, kick = true) {
  const age = bastionAge(state);
  const ground = `assets/ui/art109/bastion_map_age${Math.min(5, Math.max(1, age))}.png`; // v10.9 : une cour à 12 dalles par âge
  return `${ageRibbon(ui, state)}<div class="bs-village age-${age}"><div class="bs-world"><img class="px bs-ground" src="${ground}" alt="" draggable="false">
      ${BUILDINGS.filter((d) => !d.age || d.age <= age + 1).map((d) => plot(ui, state, d, now)).join('')}${PHONE || !kick ? '' : kickRibbon(ui)}</div>
      <div class="bs-zoom"><button type="button" data-zoom="in" aria-label="Zoomer">+</button><button type="button" data-zoom="out" aria-label="Dézoomer">−</button></div></div>`;
}

// ---------------------------------------------------------------- arbre des Recherches

function researchNode(ui, state, def, now) {
  const st = researchStatus(state, def.id);
  const sel = ui.view.bastionRes === def.id;
  // v10.6 (partie 6) : un médaillon qui vient de s'ouvrir (recherche précédente terminée) se retourne une fois.
  const seen = (ui.view.resSeen ??= {});
  const fresh = st.unlocked && seen[def.id] === false;
  seen[def.id] = Boolean(st.unlocked);
  const cls = `${st.active ? ' active' : ''}${!st.unlocked ? ' locked' : ''}${st.maxed ? ' maxed' : ''}${st.level ? ' got' : ''}${sel ? ' sel' : ''}${fresh ? ' fresh' : ''}`;
  const short = shortResearchName(def.name); // v10.9 (3) : nom court (2 lignes au plus) ; le nom complet est dans la fiche
  const time = st.active ? (() => { const r = researchRemaining(state, def.id); return Number.isFinite(r) ? `<span class="bs-time" data-bt-short="1" data-bt-end="${Math.round(now + r)}">${formatDuration(r / 1000)}</span>` : '<span class="bs-time bad">en pause</span>'; })() : '';
  return `<button class="bs-node${cls}${def.keystone ? ' keystone' : ''}" data-action="bastion-res" data-value="${def.id}" aria-pressed="${sel}" title="${escapeHtml(`${def.name} : ${def.text}`)}" aria-label="${escapeHtml(def.name)}">
      <img class="px" src="${researchArt(def.id)}" alt="" draggable="false"><span class="bs-nlv num">${st.level}/${def.max}</span>${time}${!st.unlocked ? `<span class="bs-nlock">${img('icon_lock')}</span>` : ''}<small class="bs-nname">${escapeHtml(short)}</small></button>`;
}

// v10.9 (partie 3) : nom court d'une recherche — entier s'il tient (14 lettres), sinon son premier mot (« Œil du chasseur » → « Œil »).
export function shortResearchName(name) {
  if (name.length <= 14) return name;
  return name.split(/\s+/)[0];
}

function researchTree(ui, state, now, below = false) {
  if (PHONE) return researchTreePhone(ui, state, now);
  const lib = buildingLevel(state, 'library');
  // v10.8 (partie 5) : une page par palier (I à V) ; on tourne les pages, celle en cours garde un ruban. Les nœuds clés
  // (palier III) s'allument en or.
  const age = bastionAge(state);
  const page = Math.min(5, Math.max(1, Number(ui.view.resPage) || 1));
  const pages = below ? '' : `<div class="bs-pages" role="tablist">${[1, 2, 3, 4, 5].map((t) => `<button class="bs-page${t === page ? ' on' : ''}${t > Math.max(1, age) ? ' off' : ''}" data-action="bastion-page" data-value="${t}" aria-selected="${t === page}">${t === page ? '<i class="bs-ribbon"></i>' : ''}Palier ${AGES[t - 1].roman}${t > Math.max(1, age) ? ` ${img('icon_lock')}` : ''}</button>`).join('')}</div>`;
  const tier = below ? 1 : page;
  const keys = tier === 3 ? `<div class="bs-keys">${KEYSTONES.map((k) => researchNode(ui, state, RESEARCH.find((r) => r.id === k.id), now)).join('')}</div>` : '';
  // v10.9 (partie 3) : une branche à la fois (onglets en haut) ; 3 médaillons sur la page de gauche, 3 sur celle de
  // droite, loin du bord et de la reliure. Téléphone : une seule page, on la tourne avec une flèche.
  const branch = RESEARCH_BRANCHES.find((b) => b.id === ui.view.resBranch) ?? RESEARCH_BRANCHES[0];
  const tabs = `<div class="bs-btabs" role="tablist">${RESEARCH_BRANCHES.map((br) => `<button class="bs-btab${br.id === branch.id ? ' on' : ''}" role="tab" aria-selected="${br.id === branch.id}" data-action="bastion-branch" data-value="${br.id}"><img class="px" src="${ART(`research_branch_${br.id}`)}" alt="">${escapeHtml(br.name)}</button>`).join('')}</div>`;
  const list = RESEARCH.filter((r) => r.branch === branch.id && (r.tier ?? 1) === tier && !r.keystone);
  const leafHtml = (part, from) => part.map((r, i) => {
    const k = from + i;
    const lit = k > 0 && researchStatus(state, r.id).unlocked;
    const fresh = lit && ui.view.resSeen?.[r.id] === false;
    return `${i ? `<i class="bs-link${lit ? ' lit' : ''}${fresh ? ' fresh' : ''}" aria-hidden="true"></i>` : ''}${researchNode(ui, state, r, now)}`;
  }).join('');
  const leaf = Math.min(1, Math.max(0, Number(ui.view.resLeaf) || 0));
  const turn = list.length > 3 ? `<button class="bs-turn prev" data-action="bastion-leaf" data-value="0" aria-label="Page précédente"${leaf ? '' : ' disabled'}>‹</button><button class="bs-turn next" data-action="bastion-leaf" data-value="1" aria-label="Page suivante"${leaf ? ' disabled' : ''}>›</button>` : '';
  const cols = `<div class="bs-spread leaf-${leaf}"><div class="bs-leaf left">${leafHtml(list.slice(0, 3), 0)}</div><div class="bs-leaf right">${leafHtml(list.slice(3, 6), 3)}</div>${turn}</div>`;
  const lock = lib >= 1 ? '' : `<p class="bs-lock">${img('icon_lock')} Construis la Bibliothèque</p>`;
  if (below) return `<div class="bs-tree below${lib >= 1 ? '' : ' closed'}" style="background-image:url(${ART('research_tree_bg')})">${tabs}<div class="bs-branches">${cols}</div></div>`;
  const ageLock = tier > Math.max(1, age) ? `<p class="bs-lock">${img('icon_lock')} S'ouvre à l'Âge ${AGES[tier - 1].roman} : ${escapeHtml(AGES[tier - 1].name)}</p>` : '';
  return `${pages}${tabs}<div class="bs-tree tier-${tier}${lib >= 1 ? '' : ' closed'}" id="bs-research" style="background-image:url(${ART('research_tree_bg')})">${lock}${ageLock}${keys}<div class="bs-branches">${cols}</div></div>`;
}

function researchSheet(ui, state, now) {
  if (PHONE) return researchSheetPhone(ui, state, now);
  const def = RESEARCH.find((r) => r.id === ui.view.bastionRes) ?? RESEARCH.find((r) => researchStatus(state, r.id).active) ?? RESEARCH[0];
  const st = researchStatus(state, def.id);
  const head = `<div class="bs-hero res" style="background-image:url(${ART('research_tree_bg')})"><img class="px bs-hero-b node" src="${researchArt(def.id)}" alt="">
      <span class="bs-shead"><b>${escapeHtml(def.name)}</b> <span class="bs-lv">${st.level}/${def.max}</span><small>${escapeHtml(def.text)}</small></span>${closeBtn()}</div>`;
  const versus = `<p class="muted bs-versus">Gardées après les Renaissances.</p>${libraryScene(state)}`;
  if (st.maxed) return `${head}<p class="good">${escapeHtml(researchText(def, st.level))}</p>`;
  if (!st.unlocked) return `${head}<p class="bs-lock">${img('icon_lock')} ${st.ageLock ? `Âge ${st.ageLock.roman} : ${escapeHtml(st.ageLock.name)}` : `${escapeHtml(st.lockedBy.name)} niv. ${Math.min(RESEARCH_UNLOCK_LEVEL, st.lockedBy.max)}`}</p>`;
  const f = productionFactor(state, 'library');
  if (st.active) return `${head}<div class="bs-block">${jobBar(st.active, f, now, 'work')}<span class="bs-line">Niv. ${st.level + 1} · ${timer(researchRemaining(state, def.id), now)}</span></div>${versus}`;
  const cost = researchCost(state, def.id);
  const can = canResearch(state, def.id);
  return `${head}<div class="bs-block"><div class="bs-fxrow up"><span>Niv. ${st.level} → ${st.level + 1}</span><span>${st.level ? escapeHtml(researchText(def, st.level)) : '—'} → <b class="good">${escapeHtml(researchText(def, st.level + 1))}</b></span></div>
      <div class="bs-costs">${have(cost, state)}${duration(cost.ms, f)}</div>
      ${PHONE ? mBtnGold('Lancer', { action: 'bastion-research', value: def.id, disabled: !can.ok }) : `<button class="btn btn-gold" data-action="bastion-research" data-value="${def.id}" ${can.ok ? '' : 'disabled'}>Lancer</button>`}
      ${can.ok ? '' : `<small class="bs-why">${escapeHtml(can.reason)}</small>`}</div>${versus}${words()}`;
}

// ---------------------------------------------------------------- v10.12 (finition) : Recherches sur téléphone, en kit
// Emplacements (recherches en cours) → paliers I à V (.m-modes) → branches (.m-modes) → un chemin vertical de médaillons
// ronds ; un toucher ouvre la fiche .m-sheet, produite depuis ui.view.bastionRes (actions inchangées).
const mrTime = (state, id, now) => {
  const r = researchRemaining(state, id);
  return Number.isFinite(r) ? `<span class="mr-time" data-bt-short="1" data-bt-end="${Math.round(now + r)}">${formatDuration(r / 1000)}</span>` : '<span class="mr-time bad">en pause</span>';
};
const mrMedal = (def, st, big = false) => `<span class="mr-medal${big ? ' big' : ''}${def.keystone ? ' key' : ''}${st.active ? ' active' : ''}${!st.unlocked ? ' locked' : ''}${st.maxed ? ' maxed' : ''}${st.level ? ' got' : ''}"><img class="px" src="${researchArt(def.id)}" alt="" draggable="false">${!st.unlocked ? `<i class="mr-badge">${img('icon_lock')}</i>` : st.maxed ? '<i class="mr-badge ok">✓</i>' : ''}</span>`;
function mrLockText(st) {
  if (st.ageLock) return `Âge ${st.ageLock.roman} requis`;
  if (st.lockedBy) return `Après ${st.lockedBy.name} niv. ${Math.min(RESEARCH_UNLOCK_LEVEL, st.lockedBy.max)}`;
  return '';
}

function mrNode(ui, state, def, now, last) {
  const st = researchStatus(state, def.id);
  const seen = (ui.view.resSeen ??= {});
  const fresh = st.unlocked && seen[def.id] === false;
  seen[def.id] = Boolean(st.unlocked);
  const meta = st.active ? `<span class="mr-lv">Niv. ${st.level} → ${st.level + 1}</span>${mrTime(state, def.id, now)}`
    : !st.unlocked ? `<span class="mr-lockline">${img('icon_lock')} ${escapeHtml(mrLockText(st))}</span>`
      : st.maxed ? `<span class="mr-lv ok">Niv. ${st.level}/${def.max} · max</span>` : `<span class="mr-lv">Niv. ${st.level}/${def.max}</span>`;
  const cls = `${st.active ? ' active' : ''}${!st.unlocked ? ' locked' : ''}${st.maxed ? ' maxed' : ''}${def.keystone ? ' key' : ''}${fresh ? ' fresh' : ''}${ui.view.bastionRes === def.id ? ' sel' : ''}${last ? ' last' : ''}`;
  return `<button type="button" class="mr-node${cls}" data-action="bastion-res" data-value="${def.id}" aria-label="${escapeHtml(`${def.name}, niveau ${st.level} sur ${def.max}`)}">
      ${mrMedal(def, st)}<span class="mr-txt"><b class="mr-name">${escapeHtml(def.name)}</b><span class="mr-meta">${meta}</span></span><span class="mr-go" aria-hidden="true">›</span></button>`;
}

function researchTreePhone(ui, state, now) {
  const lib = buildingLevel(state, 'library');
  const age = Math.max(1, bastionAge(state));
  const page = Math.min(5, Math.max(1, Number(ui.view.resPage) || 1));
  const branch = RESEARCH_BRANCHES.find((b) => b.id === ui.view.resBranch) ?? RESEARCH_BRANCHES[0];
  const b = bastionOf(state);
  const slots = researchSlots(state);
  const cells = [];
  for (let i = 0; i < Math.max(1, slots); i++) {
    const job = b.research.active[i];
    const d = job ? researchDef(job.id) : null;
    if (d) {
      cells.push(`<button type="button" class="mr-slot busy" data-action="bastion-res" data-value="${job.id}" aria-label="${escapeHtml(d.name)}">${mrMedal(d, researchStatus(state, job.id))}<b class="mr-sname">${escapeHtml(d.name)}</b>${mrTime(state, job.id, now)}</button>`);
    } else {
      cells.push(`<span class="mr-slot free${lib < 1 ? ' off' : ''}"><span class="mr-medal empty">${lib < 1 ? img('icon_lock') : '+'}</span><b class="mr-sname">${lib < 1 ? 'Fermée' : 'Libre'}</b></span>`);
    }
  }
  const head = `<div class="m-card mr-slots"><div class="mr-slots-top"><b>Recherches en cours</b><span class="mr-count num">${b.research.active.length}/${slots}</span></div><div class="mr-slotrow">${cells.join('')}</div></div>`;
  const tiers = mModes([1, 2, 3, 4, 5].map((t) => {
    const open = t <= age;
    return { id: String(t), label: open ? `Pal. ${AGES[t - 1].roman}` : `Âge ${AGES[t - 1].roman}`, icon: open ? undefined : 'icon_lock', action: 'bastion-page', value: String(t) };
  }), String(page), { size: 64 });
  const branches = mModes(RESEARCH_BRANCHES.map((br) => ({ id: br.id, label: br.name, icon: `file:${ART(`research_branch_${br.id}`)}`, action: 'bastion-branch', value: br.id })), branch.id, { size: 64 });
  const regular = RESEARCH.filter((r) => r.branch === branch.id && (r.tier ?? 1) === page && !r.keystone);
  const keys = page === 3 ? RESEARCH.filter((r) => r.branch === branch.id && r.keystone) : [];
  const all = [...regular, ...keys];
  const lockMsg = lib < 1 ? `${img('icon_lock')} Construis la Bibliothèque` : page > age ? `${img('icon_lock')} Âge ${AGES[page - 1].roman} : ${escapeHtml(AGES[page - 1].name)}` : '';
  const path = all.map((r, i) => `${keys.length && r === keys[0] ? '<div class="mr-keyhead"><i></i><span>Nœuds clés</span><i></i></div>' : ''}${mrNode(ui, state, r, now, i === all.length - 1)}`).join('');
  const gate = libGate(state); // v10.13 (§ 7) : bandeau « Bibliothèque à construire »
  const gateHtml = gate ? `<div class="m-card mr-gate"><img class="px" src="${researchArt('lessons')}" alt=""><span class="mr-gate-t"><b>${gate.title}</b><small>${escapeHtml(gate.sub)}</small></span>${mBtn(gate.label, { action: gate.action, value: 'library', cls: 'auto' })}</div>` : '';
  return `<div class="mr-view">${gateHtml}${head}<div class="mr-tiers">${tiers}</div>${branches}
    <div class="mr-pathhead tier-${page}"><b>Palier ${AGES[page - 1].roman}</b><span>${escapeHtml(AGES[page - 1].name)}</span></div>
    ${lockMsg ? `<p class="mr-lock">${lockMsg}</p>` : ''}<div class="m-card mr-path${lockMsg ? ' closed' : ''}">${path}</div></div>`;
}

function researchSheetPhone(ui, state, now) {
  const def = RESEARCH.find((r) => r.id === ui.view.bastionRes) ?? RESEARCH.find((r) => researchStatus(state, r.id).active) ?? RESEARCH[0];
  const st = researchStatus(state, def.id);
  const f = productionFactor(state, 'library');
  const top = `<div class="m-card mr-hero${def.keystone ? ' key' : ''}">${mrMedal(def, st, true)}<span class="mr-htxt"><b>${escapeHtml(def.name)}</b><span class="mr-lv">Niv. ${st.level}/${def.max}${def.keystone ? ' · nœud clé' : ''}</span><small>${escapeHtml(def.text)}</small></span></div>`;
  const num = (n) => formatNumber(Math.floor(n));
  let mid = '';
  let btn = '';
  if (st.maxed) {
    mid = `<div class="m-card mr-fx"><span class="mr-fx-l">Effet total</span><b class="good">${escapeHtml(researchText(def, st.level))}</b></div>`;
  } else if (!st.unlocked) {
    mid = `<div class="m-card mr-fx"><span class="mr-fx-l">Effet</span><b>${escapeHtml(researchText(def, 1))}</b></div><p class="mr-lock">${img('icon_lock')} ${escapeHtml(mrLockText(st))}</p>`;
    btn = mBtnGold('Verrouillée', { disabled: true });
  } else {
    const cost = researchCost(state, def.id);
    const can = canResearch(state, def.id);
    const split = (t) => t.match(/^([+−\-×]?\d+(?:,\d+)?(?: ?%| h)?)\s*(.*)$/) ?? [t, t, ''];
    const [, nowV] = split(researchText(def, st.level || 1));
    const [, nextV, what] = split(researchText(def, st.level + 1));
    const fx = `<div class="m-card mr-fx up"><span class="mr-fx-l">Niv. ${st.level} → ${st.level + 1}</span><b><span class="was">${st.level ? escapeHtml(nowV) : '—'}</span> <i>»</i> <span class="good">${escapeHtml(nextV)}</span></b>${what ? `<small>${escapeHtml(what)}</small>` : ''}</div>`;
    if (st.active) {
      mid = `${fx}<div class="m-card mr-run"><span class="mr-run-l">En cours</span>${jobBar(st.active, f, now, 'work')}${mrTime(state, def.id, now)}</div>`;
      btn = mBtnGold('En cours', { disabled: true });
    } else {
      const dur = f > 0 ? formatDuration(cost.ms / f / 1000) : `${formatDuration(cost.ms / 1000)} · à l'arrêt`;
      mid = `${fx}<div class="m-costs">${mCost('coin', state.gold, cost.gold, { fmt: num })}${mCost('icon_shard', state.materials.shards, cost.shards, { fmt: num })}</div>${mStat('icon_timer', 'Durée', dur)}`;
      const gate = libGate(state); // v10.13 (§ 7) : la raison claire, et le bouton qui y mène
      btn = gate ? `<p class="mr-why big">${img('icon_lock')} Il faut d'abord la Bibliothèque</p>${mBtnGold(gate.big, { action: gate.action, value: 'library' })}`
        : mBtnGold(st.level ? 'Améliorer' : 'Lancer', { action: 'bastion-research', value: def.id, disabled: !can.ok }) + (can.ok ? '' : `<small class="mr-why">${escapeHtml(can.reason)}</small>`);
    }
  }
  return `<div class="mr-body">${top}${mid}${btn}<p class="mr-note">Gardées après les Renaissances.</p></div>`;
}

// ---------------------------------------------------------------- v10.13 (§ 7) : Recherches sur PC, en kit
// « ‹ Carte du Bastion » + ressources → 3 branches en grandes tuiles → paliers I à V → le livre (page claire, nœuds de 112 px, nom en
// dessous, liens en pointillés entre les cercles) ; à droite le détail (image, avant » après, coûts en cases, raison, bouton doré,
// ouvriers). Mêmes actions qu'avant (bastion-view / -branch / -page / -res / -research). Le téléphone garde researchTreePhone.
const BRANCH_SUB = { combat: 'Dégâts, vie, critique', team: 'Équipe et familiers', economy: 'Or, butin, temps' };
const pageList = (branchId, tier) => [...RESEARCH.filter((r) => r.branch === branchId && (r.tier ?? 1) === tier && !r.keystone),
  ...(tier === 3 ? RESEARCH.filter((r) => r.branch === branchId && r.keystone) : [])];
const rsCount = (state, list) => `${list.reduce((n, r) => n + researchStatus(state, r.id).level, 0)}/${list.reduce((n, r) => n + r.max, 0)}`;

// Bibliothèque pas construite : null si elle l'est, sinon ce qu'on dit au joueur et l'action du bouton « Construire › ».
function libGate(state) {
  if (buildingLevel(state, 'library') >= 1) return null;
  const slot = bastionOf(state)?.buildings?.library;
  const acc = buildingAccess(state, 'library');
  if (slot?.build) {
    const left = buildRemaining(state, 'library');
    return { title: 'La Bibliothèque est en chantier.', sub: Number.isFinite(left) ? `Encore ${formatDuration(left / 1000)} avant de lancer des recherches.` : 'Pose un ouvrier pour finir le chantier.', action: 'bastion-open', label: 'Voir ›', big: 'Voir le chantier ›' };
  }
  const cost = buildCost(state, 'library');
  const time = cost ? formatDuration(cost.ms / 1000) : '';
  const sub = acc.available ? `Construis-la au Bastion (1 ouvrier, ${time}) pour lancer tes recherches.` : `${acc.reason || 'Pas encore ouverte'} : elle mène toutes les recherches.`;
  const direct = acc.available && canBuild(state, 'library').ok;
  return { title: 'La Bibliothèque n\'est pas construite.', sub, action: direct ? 'bastion-build' : 'bastion-open', label: 'Construire ›', big: 'Construire la Bibliothèque ›' };
}
const rsLockText = (st) => (st.ageLock ? `Âge ${st.ageLock.roman} requis` : st.lockedBy ? `${st.lockedBy.name} ${Math.min(RESEARCH_UNLOCK_LEVEL, st.lockedBy.max)}` : '');
const rsRemain = (state, id, now) => {
  const r = researchRemaining(state, id);
  return Number.isFinite(r) ? `<span class="rs-time" data-bt-short="1" data-bt-end="${Math.round(now + r)}">${formatDuration(r / 1000)}</span>` : '<span class="rs-time bad">en pause</span>';
};

function rsNode(ui, state, def, now, curId) {
  const st = researchStatus(state, def.id);
  const seen = (ui.view.resSeen ??= {});
  const fresh = st.unlocked && seen[def.id] === false;
  seen[def.id] = Boolean(st.unlocked);
  const sub = st.active ? `En cours · ${rsRemain(state, def.id, now)}` : !st.unlocked ? `${img('icon_lock')} ${escapeHtml(rsLockText(st))}` : st.maxed ? 'Niveau maximal' : escapeHtml(def.text);
  const cls = `${st.active ? ' active' : ''}${!st.unlocked ? ' locked' : ''}${st.maxed ? ' maxed' : ''}${st.level ? ' got' : ''}${def.keystone ? ' key' : ''}${fresh ? ' fresh' : ''}${curId === def.id ? ' sel' : ''}`;
  return `<button type="button" class="rs-node${cls}" data-action="bastion-res" data-value="${def.id}" aria-pressed="${curId === def.id}" aria-label="${escapeHtml(`${def.name}, niveau ${st.level} sur ${def.max}`)}">
      <span class="rs-c"><img class="px" src="${researchArt(def.id)}" alt="" draggable="false"><i class="rs-lv num">${st.level} / ${def.max}</i>${!st.unlocked ? `<i class="rs-lk">${img('icon_lock')}</i>` : st.maxed ? '<i class="rs-lk ok">✓</i>' : ''}</span>
      <b class="rs-name">${escapeHtml(def.name)}</b><span class="rs-sub">${sub}</span></button>`;
}

function rsBook(ui, state, now, list, tier, age, curId) {
  const gate = libGate(state);
  let banner = '';
  if (gate) banner = `<div class="rs-gate"><img class="px" src="${researchArt('lessons')}" alt=""><span class="rs-gate-t"><b>${gate.title}</b><small>${escapeHtml(gate.sub)}</small></span>${mBtn(gate.label, { action: gate.action, value: 'library', cls: 'auto rs-gate-btn' })}</div>`;
  else if (tier > age) banner = `<div class="rs-gate shut">${img('icon_lock')}<span class="rs-gate-t"><b>Palier ${AGES[tier - 1].roman} fermé</b><small>S'ouvre à l'Âge ${AGES[tier - 1].roman} : ${escapeHtml(AGES[tier - 1].name)}</small></span></div>`;
  // liens en pointillés : de la gauche vers la droite sur une rangée de 3, et un trait vertical sous la première de chaque rangée
  const lit = (r) => (researchStatus(state, r.id).unlocked ? ' lit' : '');
  const cells = list.map((r, i) => {
    const col = i % 3;
    const left = col > 0 ? `<i class="rs-link l${lit(r)}" aria-hidden="true"></i>` : '';
    const right = col < 2 && list[i + 1] ? `<i class="rs-link r${lit(list[i + 1])}" aria-hidden="true"></i>` : '';
    const up = i >= 3 && col === 0 ? `<i class="rs-link v${lit(r)}" aria-hidden="true"></i>` : '';
    return `<div class="rs-cell">${rsNode(ui, state, r, now, curId)}${left}${right}${up}</div>`;
  });
  return `<div class="rs-book${gate || tier > age ? ' closed' : ''}">${banner}<div class="rs-grid">${cells.join('')}</div></div>`;
}

// Les ouvriers du Bastion (places) : posé (compagnon + bâtiment + temps restant du chantier ou de la recherche) ou libre.
function rsWorkers(state, now) {
  const placed = BUILDINGS.filter((d) => !d.existing && workerOf(state, d.id));
  const total = Math.max(workerSlots(state), placed.length, 1);
  const cells = [];
  for (const d of placed) {
    const c = companionById(workerOf(state, d.id));
    const src = c ? companionStill(c).match(/src="([^"]+)"/)?.[1] : null;
    const job = d.id === 'library' ? bastionOf(state).research.active[0] : null;
    const left = job ? researchRemaining(state, job.id) : buildRemaining(state, d.id);
    const time = Number.isFinite(left) && left > 0 ? `<span class="rs-wt" data-bt-short="1" data-bt-tiny="1" data-bt-end="${Math.round(now + left)}">${shortTime(formatDuration(left / 1000))}</span>` : '<span class="rs-wt">en poste</span>';
    cells.push(`<span class="rs-w busy" title="${escapeHtml(`${c?.name ?? 'Ouvrier'} : ${d.name}`)}">${src ? `<img class="px" src="${escapeHtml(src)}" alt="">` : img('icon_upgrade')}<b>${escapeHtml(shortName(d))}</b>${time}</span>`);
  }
  while (cells.length < total) cells.push(`<span class="rs-w free">${img('icon_upgrade')}<b>Libre</b></span>`);
  return `<div class="rs-wh">Ouvriers · ${placed.length} / ${total} au travail</div><div class="rs-ws">${cells.join('')}</div>`;
}

function rsDetail(state, now, def) {
  const st = researchStatus(state, def.id);
  const f = productionFactor(state, 'library');
  const lib = buildingLevel(state, 'library');
  const gate = libGate(state);
  const branch = RESEARCH_BRANCHES.find((b) => b.id === def.branch);
  const tier = def.tier ?? 1;
  const num = (n) => formatNumber(Math.floor(n));
  const art = `<div class="rs-art" style="background-image:url(${ART('research_tree_bg')})"><img class="px" src="${researchArt(def.id)}" alt="" draggable="false"><span class="rs-badge">${escapeHtml(branch?.name ?? '')} · ${def.keystone ? 'Nœud clé' : `Palier ${AGES[tier - 1].roman}`}</span></div>`;
  const head = `<div class="rs-h"><b>${escapeHtml(def.name)}</b><span class="num">Niv. ${st.level} / ${def.max}</span></div><p class="rs-line">${escapeHtml(def.text)} à chaque niveau.</p>`;
  const bIcon = `file:${ART(`research_branch_${def.branch}`)}`;
  const split = (t) => t.match(/^([+−\-×]?\d+(?:,\d+)?(?: ?%| h)?)\s*(.*)$/) ?? [t, t, ''];
  const label = (w) => { const x = w.replace(/^(?:de |d'|du |des |à )/, ''); return x.charAt(0).toUpperCase() + x.slice(1); }; // « de dégâts » → « Dégâts »
  let body = '';
  let reason = '';
  let btn = '';
  if (st.maxed) {
    const [, tot, what] = split(researchText(def, st.level));
    body = `<div class="m-stat big">${img(bIcon)}<span class="m-k">${escapeHtml(label(what) || 'Effet total')}</span><b class="m-v up">${escapeHtml(tot)}</b></div>`;
    reason = '✓ Niveau maximal atteint';
  } else {
    const [, nextV, what] = split(researchText(def, st.level + 1));
    const curV = st.level ? split(researchText(def, st.level))[1] : /^[+−-]/.test(nextV) ? nextV.replace(/\d+(?:,\d+)?/, '0') : '—';
    const fx = `<div class="m-stat big">${img(bIcon)}<span class="m-k">${escapeHtml(label(what) || 'Effet')}</span><b class="m-v">${escapeHtml(curV)} <i class="rs-arrow">»</i> <span class="up">${escapeHtml(nextV)}</span></b></div>`;
    const cost = researchCost(state, def.id);
    const can = canResearch(state, def.id);
    const dur = formatDuration((f > 0 ? cost.ms / f : cost.ms) / 1000);
    const costs = `<div class="m-costs">${mCost('coin', state.gold, cost.gold, { fmt: num })}${mCost('icon_shard', state.materials.shards, cost.shards, { fmt: num })}<span class="m-cost ok"><span class="m-cost-ico">${img('icon_timer')}</span><span class="m-cost-n">${escapeHtml(dur)}</span></span></div>`;
    if (st.active) {
      const pct = (Math.max(0, Math.min(1, 1 - st.active.left / st.active.total)) * 100).toFixed(1);
      body = `${fx}<div class="rs-run"><div class="rs-bar"><i style="width:${pct}%"${f > 0 ? ` data-bt-end="${Math.round(now + st.active.left / f)}" data-bt-span="${Math.round(st.active.total / f)}"` : ''}></i></div><span class="rs-runl">En cours · ${rsRemain(state, def.id, now)}</span></div>`;
      btn = mBtnGold('En cours', { disabled: true });
    } else {
      body = `${fx}${costs}`;
      if (lib < 1) { reason = `${img('icon_lock')} Il faut d'abord la Bibliothèque`; btn = mBtnGold(gate?.big ?? 'Construire la Bibliothèque ›', { action: gate?.action ?? 'bastion-open', value: 'library' }); }
      else if (!st.unlocked) { reason = `${img('icon_lock')} ${escapeHtml(can.reason)}`; btn = mBtnGold('Verrouillée', { disabled: true }); }
      else {
        if (!can.ok) reason = escapeHtml(can.reason);
        else if (!(f > 0)) reason = 'Pose un ouvrier à la Bibliothèque : sans lui, le temps ne passe pas.';
        btn = mBtnGold('Lancer', { action: 'bastion-research', value: def.id, disabled: !can.ok });
      }
    }
  }
  return `<aside class="m-card rs-detail" aria-label="Détail de la recherche">${art}${head}${body}${reason ? `<p class="rs-why${st.maxed ? ' ok' : ''}">${reason}</p>` : ''}${btn}
      <p class="rs-keep">✓ Gardées après chaque Renaissance</p>${rsWorkers(state, now)}</aside>`;
}

function researchDesk(ui, state, now) {
  const v = ui.view;
  const age = Math.max(1, bastionAge(state));
  const page = Math.min(5, Math.max(1, Number(v.resPage) || 1));
  const branch = RESEARCH_BRANCHES.find((b) => b.id === v.resBranch) ?? RESEARCH_BRANCHES[0];
  const list = pageList(branch.id, page);
  // le détail : la recherche touchée ; sinon celle en cours sur cette page ; sinon la première de la page
  const def = RESEARCH.find((r) => r.id === v.bastionRes) ?? list.find((r) => researchStatus(state, r.id).active) ?? list[0] ?? RESEARCH[0];
  const branches = RESEARCH_BRANCHES.map((br) => {
    const on = br.id === branch.id;
    return `<button type="button" class="rs-branch${on ? ' on' : ''}" role="tab" aria-selected="${on}" data-action="bastion-branch" data-value="${br.id}"><img class="px" src="${ART(`research_branch_${br.id}`)}" alt=""><span class="rs-bt"><b>${escapeHtml(br.name)}</b><small>${BRANCH_SUB[br.id] ?? ''} · ${rsCount(state, pageList(br.id, page))}</small></span></button>`;
  }).join('');
  const tiers = [1, 2, 3, 4, 5].map((t) => {
    const open = t <= age;
    const on = t === page;
    return `<button type="button" class="rs-tier${on ? ' on' : ''}${open ? '' : ' off'}" role="tab" aria-selected="${on}" data-action="bastion-page" data-value="${t}"${open ? '' : ` title="S'ouvre à l'Âge ${AGES[t - 1].roman} : ${escapeHtml(AGES[t - 1].name)}"`}>${open ? '' : img('icon_lock')}<span>Palier ${AGES[t - 1].roman}</span>${on && open ? `<small class="num">${rsCount(state, list)}</small>` : ''}</button>`;
  }).join('');
  const res = `<span class="rs-res"><span class="rs-pill" data-gloss="gold">${coin()}<b class="num">${formatNumber(Math.floor(state.gold))}</b></span><span class="rs-pill" data-gloss="shards">${shard()}<b class="num">${formatNumber(state.materials.shards)}</b></span></span>`;
  return `<div class="m-frame m-hero rs-frame">${mTitle(`file:${ART('research_node_book')}`, 'Recherches', true)}
    <div class="rs-top">${mBtn('‹ Carte du Bastion', { action: 'bastion-view', value: 'map', cls: 'auto' })}${res}</div>
    <div class="d-cols2 rs-cols"><div class="rs-main"><div class="rs-branches" role="tablist">${branches}</div><div class="rs-tiers" role="tablist">${tiers}</div>${rsBook(ui, state, now, list, page, age, def.id)}</div>${rsDetail(state, now, def)}</div></div>`;
}

// ---------------------------------------------------------------- la fiche du bâtiment

const closeBtn = () => '<button class="btn small pg-side-close bs-close" data-action="bastion-close" aria-label="Fermer">✕</button>';

// Coût : icône, montant (rouge s'il manque), « tu as … » au survol.
const have = (cost, state) => `<span class="bs-cost${state.gold >= cost.gold ? '' : ' miss'}" title="tu as ${formatNumber(Math.floor(state.gold))}">${coin()} <b class="num">${formatNumber(cost.gold)}</b></span>
  <span class="bs-cost${state.materials.shards >= cost.shards ? '' : ' miss'}" title="tu as ${formatNumber(state.materials.shards)}">${shard()} <b class="num">${formatNumber(cost.shards)}</b></span>`;

// Durée à la vitesse de l'ouvrier en place (« à l'arrêt » sans ouvrier).
function duration(ms, factor) {
  if (!(factor > 0)) return `<span class="bs-dur bad">${formatDuration(ms / 1000)} · à l'arrêt</span>`;
  return `<span class="bs-dur" title="${formatDuration(ms / 1000)} sans bonus">${img('icon_timer')} ${formatDuration(ms / factor / 1000)}</span>`;
}

// Portrait d'un ouvrier possible : un toucher le pose (ou le retire s'il est déjà là).
function workerCard(state, c, buildingId, best = false) {
  const bonus = workerBonus(state, c.id, buildingId);
  const at = workerBuilding(state, c.id);
  const here = at === buildingId;
  const trade = tradeOf(c.id);
  const title = `${c.name} · ${TRADES[trade]?.label ?? ''} · +${bonus.totalPct} %${at && !here ? ` (${buildingDef(at).name})` : ''}`;
  return `<button class="bs-wcard r-${c.rarity}${here ? ' here' : ''}${bonus.match ? ' match' : ''}${at && !here ? ' busy' : ''}" data-action="bastion-worker" data-value="${buildingId}|${here ? '' : c.id}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
      <span class="bs-wpic">${companionStill(c)}</span><img class="px bs-wtrade" src="${tradeArt(trade)}" alt="">${best ? '<i class="bs-wbest" title="Meilleur choix">★</i>' : ''}<small class="bs-wname">${escapeHtml(c.name.split(/\s+/)[0])}</small><b class="bs-wbonus">+${bonus.totalPct} %</b></button>`;
}

function workerBlock(ui, state, def) {
  if (!workerOf(state, def.id)) { (state.ui.hints ??= []); if (!state.ui.hints.includes('bastion-worker')) setTimeout(() => state.ui.hints.push('bastion-worker'), 0); } // bulle une seule fois
  const w = workerOf(state, def.id);
  const c = w ? companionById(w) : null;
  const list = availableWorkers(state).sort((x, y) => workerBonus(state, y.id, def.id).totalPct - workerBonus(state, x.id, def.id).totalPct);
  const bestId = !workerOf(state, def.id) ? list.find((x) => !workerBuilding(state, x.id))?.id : null;
  const full = !c && workersPlaced(state) >= workerSlots(state);
  const more = ui.view.bastionMore === def.id;
  const room = typeof innerHeight === 'number' && innerHeight < 820 ? 4 : 9; // fenêtre basse : une rangée de portraits
  const shown = more ? list : list.slice(0, list.length > room + 1 ? room : room + 1);
  const trade = Object.entries(TRADES).find(([, t]) => t.building === def.id)?.[0];
  const head = c
    ? (() => { const b = workerBonus(state, c.id, def.id); return `<div class="bs-worker-now r-${c.rarity}"><span class="bs-wpic big">${companionStill(c)}</span>
        <span class="grow"><b>${escapeHtml(c.name)}</b><span class="bs-wline"><img class="px bs-tradeico" src="${tradeArt(tradeOf(c.id))}" alt="">${escapeHtml(TRADES[tradeOf(c.id)]?.label ?? '')}</span></span>
        <b class="bs-wbonus good">+${b.totalPct} %</b></div>`; })()
    : `<div class="bs-idle-box" role="status"><b>Ce bâtiment est à l'arrêt : choisis un ouvrier</b><span>Touche un portrait ci-dessous pour le poser ici ↓</span>${(state.ui.hints ?? []).includes('bastion-worker') ? '' : '<small class="bs-idle-tip">Pose un compagnon : sans ouvrier, rien n\'avance.</small>'}</div>`;
  const grid = full && !list.some((x) => workerBuilding(state, x.id))
    ? `<p class="muted">Places prises (${workerSlots(state)})</p>`
    : list.length ? `<div class="bs-wgrid">${shown.map((x) => workerCard(state, x, def.id, x.id === bestId)).join('')}${list.length > shown.length ? `<button class="bs-wmore" data-action="bastion-more" data-value="${def.id}">+${list.length - shown.length}</button>` : ''}</div>`
      : '<p class="muted">Aucun compagnon libre</p>';
  return `<div class="bs-block bs-wblock"><div class="bs-block-title">Ouvrier${trade ? ` <img class="px bs-tradeico" src="${tradeArt(trade)}" alt="" title="Métier conseillé : ${escapeHtml(TRADES[trade].label)} (+${WORKER_RULES.tradeBonusPct} %)">` : ''}</div>${head}${grid}</div>`;
}

function upgradeBlock(state, def, now) {
  const slot = bastionOf(state).buildings[def.id];
  const lv = slot.level;
  const w = workerOf(state, def.id);
  const f = w ? productionFactor(state, def.id) : 0;
  if (slot.build) {
    return `<div class="bs-block bs-up"><div class="bs-block-title">Chantier : niv. ${lv} → ${lv + 1}</div>
      <div class="bs-ba big"><img class="px" src="${buildingArt(state, def, lv)}" alt=""><span class="bs-arrow">→</span><img class="px" src="${buildingArt(state, def, lv + 1)}" alt=""></div>
      ${jobBar(slot.build, f, now, 'build')}<span class="bs-line">${timer(buildRemaining(state, def.id), now)}</span></div>`;
  }
  const cost = buildCost(state, def.id);
  if (!cost) return `<div class="bs-block"><div class="bs-block-title">Niveau maximal (${BASTION_MAX_LEVEL})</div></div>`;
  const before = levelEffects(state, def.id, lv);
  const after = levelEffects(state, def.id, lv + 1);
  const rows = after.map(([label, v], i) => {
    const old = before[i]?.[1];
    return old !== v ? `<div class="bs-fxrow up"><span>${label}</span><span>${escapeHtml(old ?? '—')} → <b class="good">${escapeHtml(v)}</b></span></div>` : '';
  }).join('');
  const can = canBuild(state, def.id);
  const pics = `<div class="bs-ba"><img class="px" src="${buildingArt(state, def, lv)}" alt=""><span class="bs-arrow">→</span><img class="px" src="${buildingArt(state, def, lv + 1)}" alt=""></div>`;
  return `<div class="bs-block bs-up"><div class="bs-block-title">${lv < 1 ? 'Construire' : 'Améliorer'} : niv. ${lv} → ${lv + 1}${buildingArt(state, def, lv) !== buildingArt(state, def, lv + 1) ? pics : ''}</div>
      <div class="bs-fxlist">${rows}</div>
      <div class="bs-go"><div class="bs-costs">${have(cost, state)}${duration(cost.ms, f)}</div>
      ${!workerOf(state, def.id) ? '<button class="btn primary-action bs-need-btn" data-action="bastion-goto-workers">Pose un ouvrier d\'abord ↑</button>' : (PHONE ? mBtnGold(lv < 1 ? 'Construire' : 'Améliorer', { action: 'bastion-build', value: def.id, disabled: !can.ok }) : `<button class="btn btn-gold primary-action" data-action="bastion-build" data-value="${def.id}" ${can.ok ? '' : 'disabled'}>${lv < 1 ? 'Construire' : 'Améliorer'}</button>`)}
      ${can.ok ? '' : `<small class="bs-why">${escapeHtml(can.reason)}</small>`}</div></div>`;
}

function forgeBlock(ui, state, now) {
  const b = bastionOf(state);
  const slot = SLOTS[ui.view.bastionSlot] ? ui.view.bastionSlot : 'weapon';
  const tierId = ORDER_TIERS.some((t) => t.id === ui.view.bastionTier && orderTierOpen(state, t.id)) ? ui.view.bastionTier : 'rare';
  const cost = orderCost(state, tierId);
  const can = canOrder(state, slot, tierId);
  const f = productionFactor(state, 'forge');
  const slots = Object.keys(SLOTS).map((k) => `<button class="bs-slot${k === slot ? ' on' : ''}" data-action="bastion-slot" data-value="${k}" aria-pressed="${k === slot}" title="${escapeHtml(SLOTS[k])}" aria-label="${escapeHtml(SLOTS[k])}">${img(slotIconName(k))}</button>`).join('');
  const chances = (id) => orderChances(id).map((x) => `${rarityById(x.rarity).label} ${x.pct} %`).join(' · ');
  const tiers = ORDER_TIERS.map((t) => {
    const open = orderTierOpen(state, t.id);
    return `<button class="bs-tier${t.id === tierId ? ' on' : ''}" data-action="${open ? 'bastion-tier' : 'bastion-locked'}" data-value="${open ? t.id : `Forge du forgeron niveau ${t.forgeLevel} requise`}" aria-pressed="${t.id === tierId}" title="${escapeHtml(chances(t.id))}">
      <b class="r-${t.minRarity} rarity-text">${t.label}</b><small>${open ? `${t.hours} h` : `${img('icon_lock')} niv. ${t.forgeLevel}`}</small></button>`;
  }).join('');
  const queue = Array.from({ length: Math.max(orderSlots(state), b.orders.length) }, (_, i) => {
    const o = b.orders[i];
    if (!o) return '<div class="bs-order empty"></div>';
    const ico = img(slotIconName(o.slot));
    if (o.ready) {
      return `<div class="bs-order ready">${ico}<span class="grow"><b>${escapeHtml(orderLabel(o))}</b> <small>prête · le coffre de butin est plein</small></span>
        <button class="btn btn-gold small" data-action="bastion-collect-order" data-value="${o.id}">Récupérer</button></div>`;
    }
    return `<div class="bs-order">${ico}<span class="grow">${jobBar(o, f, now, 'work')}</span>${timer(orderRemaining(state, o), now)}</div>`;
  }).join('');
  return `<div class="bs-block"><div class="bs-block-title">Commandes <small>${b.orders.length}/${orderSlots(state)}</small></div>
      <div class="bs-queue">${queue}</div>
      <div class="bs-slots" role="group" aria-label="Place de l'objet">${slots}</div>
      <div class="bs-tiers" role="group" aria-label="Rareté minimale">${tiers}</div>
      <div class="bs-costs">${have(cost, state)}${duration(cost.ms, f)}</div>
      <button class="btn btn-gold" data-action="bastion-order" data-value="${slot}|${tierId}" ${can.ok ? '' : 'disabled'} title="Livré dans le coffre de butin">Commander</button>
      ${can.ok ? '' : `<small class="bs-why">${escapeHtml(can.reason)}</small>`}</div>`;
}

function stockBlock(state, id, now) {
  const prod = productionOf(state, id);
  if (!prod) return '';
  const f = productionFactor(state, id);
  const n = Math.floor(stockOf(state, id));
  return `<div class="bs-block"><div class="bs-block-title">Production <small>${dec(prod.perHour * f * (id === 'mine' ? 1 : 24))} ${RES_NAME[prod.resource]} par ${id === 'mine' ? 'heure' : 'jour'}</small></div>
      <div class="bs-stock">${stockBar(state, id, now)}</div>
      <button class="btn btn-gold" data-action="bastion-collect" data-value="${id}" ${n >= 1 ? '' : 'disabled'}>Récupérer</button></div>`;
}

// v10.8 : Atelier d'enchantement — graver un effet de plus sur un objet Mythique ou au-delà.
function enchantBlock(state) {
  const items = [...Object.values(state.equipment).filter(Boolean), ...state.inventory].filter((i) => rarityIndex(i.rarity) >= rarityIndex('mythic')).slice(0, 8);
  const rows = items.map((i) => { const c = canEngrave(state, i.id); return `<button class="bs-trade${c.ok ? '' : ' off'}" data-action="bastion-engrave" data-value="${i.id}" ${c.ok ? '' : 'disabled'} title="${escapeHtml(c.reason || `${ENGRAVE_SHARDS} éclats`)}"><span class="r-${i.rarity} rarity-text">${escapeHtml(i.name)}</span>${i.engraved ? '<b class="good">gravé</b>' : `${shard()}<b class="num">${ENGRAVE_SHARDS}</b>`}</button>`; }).join('');
  return `<div class="bs-block"><div class="bs-block-title">Graver un effet <small>Mythique et au-delà, une fois par objet</small></div>${rows || '<p class="muted">Aucun objet Mythique pour l\'instant.</p>'}</div>`;
}
// v10.8 : Atelier d'Ascension — 3 Astraux de même place + 1 Larme → 1 Ascendant.
function ascensionBlock(ui, state) {
  const c = ascensionCost(state);
  const rows = Object.keys(SLOTS).map((slot) => { const n = ascensionPool(state, slot).length; const ok = canAscend(state, slot).ok; return `<button class="bs-trade${ok ? '' : ' off'}" data-action="bastion-ascend" data-value="${slot}" ${ok ? '' : 'disabled'}>${img(slotIconName(slot))}<b class="num">${n}/${c.astral}</b> Astraux</button>`; }).join('');
  return `<div class="bs-block"><div class="bs-block-title">Forger un Ascendant <small>${c.astral} Astraux + ${c.tears} Larme + ${coin()}${formatNumber(c.gold)}</small></div>
      <p class="bs-line"><img class="px" src="assets/ui/art108/tear_ascendrya.png" alt="" width="24" height="24"> Larmes d'Ascendrya : <b class="num">${state.materials.tears ?? 0}</b> <small class="muted">(une à la première Renaissance de chaque saison)</small></p><div class="bs-trades">${rows}</div></div>`;
}
// v10.8 : nœud clé « Marché noir » — un objet Mythique par semaine.
function blackMarketBlock(state) {
  if (!state.bastion?.research?.levels?.key_market) return '';
  const open = blackMarketOpen(state);
  const rows = Object.keys(SLOTS).map((slot) => `<button class="bs-trade${open ? '' : ' off'}" data-action="bastion-black" data-value="${slot}" ${open ? '' : 'disabled'}>${img(slotIconName(slot))}${shard()}<b class="num">${BLACK_MARKET_SHARDS}</b></button>`).join('');
  return `<div class="bs-block"><div class="bs-block-title">Marché noir <small>${open ? 'un objet Mythique cette semaine' : 'revient la semaine prochaine'}</small></div><div class="bs-trades">${rows}</div></div>`;
}
function tradeBlock(state) {
  const left = tradeLeft(state);
  const rows = TRADE_POST.offers.map((x) => {
    const o = tradeOffer(state, x.id);
    const can = left > 0 && (state.materials[o.give] ?? 0) >= o.giveAmount;
    return `<button class="bs-trade${can ? '' : ' off'}" data-action="bastion-trade" data-value="${o.id}" ${can ? '' : 'disabled'} title="${o.giveAmount} ${resName(o.give, o.giveAmount)} → ${o.getAmount} ${resName(o.get, o.getAmount)} (tu as ${formatNumber(state.materials[o.give] ?? 0)})">
      ${img(RES_ICON[o.give])}<b class="num">${o.giveAmount}</b><span class="bs-arrow">→</span>${img(RES_ICON[o.get])}<b class="num good">${o.getAmount}</b></button>`;
  }).join('');
  return `<div class="bs-block"><div class="bs-block-title">Échanges <small>${plural(left, 'échange')} aujourd'hui</small></div><div class="bs-trades">${rows}</div></div>`;
}

// En-tête illustré de la fiche : le bâtiment en grand sur son coin de carte, son ouvrier devant lui, la bulle (une fois).
function buildingHero(state, def, lv) {
  const p = PLOTS[def.id];
  const c = def.existing ? null : companionById(workerOf(state, def.id));
  return `<div class="bs-hero" style="background-image:url(${ART('bastion_map')});background-position:${p.x}% ${Math.min(100, p.y - 10)}%">
      <img class="px bs-hero-b" src="${buildingArt(state, def)}" alt="">${c ? `<span class="bs-hero-w" title="${escapeHtml(c.name)}">${animCanvas(`foe:${c.sprite}`, 64, 56, 1)}</span>` : ''}
      <span class="bs-shead"><b>${escapeHtml(def.name)}</b>${def.existing ? '' : ` <span class="bs-lv">Niv. ${lv}</span>`}</span>${closeBtn()}${tipBubble(state, def)}</div>`;
}
// Sous une recherche : la Bibliothèque et son savant (la vitesse des recherches dépend de lui).
function libraryScene(state) {
  const def = buildingDef('library');
  const c = companionById(workerOf(state, 'library'));
  const f = productionFactor(state, 'library');
  return `<div class="bs-hero lib" style="background-image:url(${ART('bastion_map')});background-position:${PLOTS.library.x}% ${PLOTS.library.y - 10}%">
      <img class="px bs-hero-b" src="${buildingArt(state, def)}" alt="">${c ? `<span class="bs-hero-w" title="${escapeHtml(c.name)}">${animCanvas(`foe:${c.sprite}`, 64, 56, 1)}</span>` : ''}
      <span class="bs-shead"><b>${escapeHtml(def.name)}</b> <span class="bs-lv">Niv. ${buildingLevel(state, 'library')}</span>${c ? ` <b class="good">+${Math.round((f - 1) * 100)} %</b>` : ''}</span></div>`;
}

function tipBubble(state, def) {
  if (tipSeen(state, def.id)) return '';
  return `<div class="bs-tip" data-tip="${def.id}" role="note"><span>${escapeHtml(def.role)}</span><button class="btn small" data-action="bastion-tip" data-value="${def.id}">Compris</button></div>`;
}

function buildingSheet(ui, state, now) {
  const def = buildingDef(ui.view.bastionSel);
  if (!def || !buildingAccess(state, def.id).available) return '';
  const lv = buildingLevel(state, def.id);
  const head = buildingHero(state, def, lv);
  if (def.existing && PHONE) return `${head}<div class="bs-block">${mBtn('Ouvrir les Expéditions', { action: 'open-tab', value: 'expeditions', icon: 'icon_chest' })}</div>`;
  if (def.existing) return `${head}<div class="bs-embed">${expeditionsPanel.render(ui, state)}</div>`;
  const own = lv < 1 ? '' : def.id === 'forge' ? forgeBlock(ui, state, now)
    : def.id === 'library' ? `<div class="bs-block"><button class="btn bs-to-tree" data-action="bastion-view" data-value="research"><img class="px" src="${researchArt('lessons')}" alt="">Recherches ${bastionOf(state).research.active.length}/${researchSlots(state)}</button></div>`
      : def.id === 'trade' ? tradeBlock(state) + blackMarketBlock(state) : def.id === 'enchant' ? enchantBlock(state) : def.id === 'ascension' ? ascensionBlock(ui, state)
      : def.id === 'observatory' ? '<div class="bs-block"><p>Une Prime du Héraut de plus chaque jour.</p></div>' : def.id === 'runes' ? `<div class="bs-block"><p class="good">+${3 * lv} % de puissance des compagnons</p></div>`
      : def.id === 'wonder' ? `<div class="bs-block"><p class="good">+${5 * lv} % d'or et d'expérience</p></div>` : stockBlock(state, def.id, now);
  return `${head}${workerBlock(ui, state, def)}${upgradeBlock(state, def, now)}${own}${words()}`;
}
// v10.3.1 : lexique du Bastion (Bastion, Ouvrier, Chantier, Recherche) : un toucher ouvre sa carte d'explication.
const words = () => `<p class="bs-words">${['Bastion', 'Ouvrier', 'Chantier', 'Recherche'].map((w) => `<button class="lex bs-word" data-lex="${w}">${w}</button>`).join('')}</p>`;

// ---------------------------------------------------------------- le Camp d'avant (étape < 40)

function campCards(state) {
  const team = (state.companions?.equipped ?? []).map(companionById).filter(Boolean);
  const bonds = activeBonds(state);
  const name = state.heroName ? escapeHtml(state.heroName) : 'Ton héros';
  const seats = team.map((c, i) => `<span class="camp-unit s${i}" title="${escapeHtml(c.name)}">${img(c.sprite)}</span>`).join('');
  const fire = `<div class="card camp-fire camp-art"><div class="camp-scene2"><img class="px camp-bg" src="assets/ui/art98/camp_night.png" alt="">
        ${seats}<i class="vg-ember"></i><i class="vg-ember"></i><i class="vg-ember"></i></div>
        <p class="camp-cap">${name} se repose avec ${team.length ? escapeHtml(team.map((c) => c.name).join(', ')) : 'personne pour l\'instant'}.</p></div>`;
  const trophies = `<div class="card"><b>Trophées</b><div class="camp-trophies">
        <span>★ <b>${totalStars(state)}</b> / 36 étoiles</span><span>⚔ Revanche <b>${revengeLevel(state)}</b> / ${REVENGE_STEPS}</span>
        <span>🏆 Musée <b>${Object.keys(state.museum ?? {}).length}</b></span></div></div>`;
  const links = bonds.length ? `<div class="card"><b>Liens actifs</b> ${bonds.map((b) => `<span class="good">${escapeHtml(b.name)}</span>`).join(' · ')}</div>` : '';
  return { fire, trophies, links };
}

function renderCamp(state) {
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  const c = campCards(state);
  if (PHONE) {
    return `<div class="m-frame mt-frame mt-camp">${mTitle('tab_expeditions', 'Bastion', true)}
      <div class="m-card bs-soon"><img class="px" src="${ART('bastion_forge_lv1')}" alt=""><span><b>Le Bastion ouvre à l'étape ${BASTION_UNLOCK_STAGE}</b>
        ${mBar(Math.min(1, best / BASTION_UNLOCK_STAGE))}<small class="muted">Étape ${Math.min(best, BASTION_UNLOCK_STAGE)} / ${BASTION_UNLOCK_STAGE}</small></span></div>
      ${c.fire}${c.trophies}${c.links}</div>`;
  }
  // v10.13 : PC dans le cadre du kit (cartouche dedans) : le feu de camp en grand, l'annonce du Bastion et les trophées à côté.
  const pct = Math.min(1, best / BASTION_UNLOCK_STAGE);
  return `<div class="m-frame d-bs d-bs-camp">${mTitle('tab_expeditions', 'Bastion', true)}<div class="d-cols2 d-bs-cols">
      <div class="d-stack">${c.fire}</div>
      <div class="d-stack"><div class="m-card bs-soon"><img class="px" src="${ART('bastion_forge_lv1')}" alt=""><span><b>Le Bastion ouvre à l'étape ${BASTION_UNLOCK_STAGE}</b>
        <small>Tes compagnons libres y travailleront : une forge, des recherches, des chantiers qui avancent même jeu fermé.</small>
        ${mBar(pct)}<small class="muted">Étape ${Math.min(best, BASTION_UNLOCK_STAGE)} / ${BASTION_UNLOCK_STAGE}</small></span></div>
        ${c.trophies}${c.links}</div></div></div>`;
}

// ---------------------------------------------------------------- l'écran

// ---------------------------------------------------------------- v10.12 : Bastion sur téléphone (kit mobile)
// Une seule fenêtre à la fois : annonce de départ, puis annonce d'âge, puis la fiche d'un bâtiment / d'une recherche.
function kickSheet(ui) {
  const k = ui.view.bastionKick;
  const lines = k.placed.map((p) => `<div class="mt-kline">${img(`file:${tradeArt(tradeOf(p.companionId))}`)}<span>${escapeHtml(placedLine(p))}</span></div>`).join('');
  const gift = k.build ? `<div class="mt-kline gift">${img(`file:${ART('bastion_site')}`)}<span>Chantier offert : ${escapeHtml(buildingDef(k.build.building).name)}, ${formatDuration(k.build.ms / 1000)}</span></div>` : '';
  return mSheet('Au travail', `<div class="m-card mt-announce"><b class="mt-ann-title">Ton Bastion se met au travail</b>${lines}${gift}</div>${mBtnGold('Continuer', { action: 'bastion-kick-ok' })}`,
    { id: 'bs-announce', icon: 'tab_expeditions', back: 'bastion-kick-ok', close: 'bastion-kick-ok' });
}
function ageSheet(ui, state) {
  const age = Math.min(ui.view.bastionAgeNew, bastionAge(state));
  const a = ageDef(age), nx = nextAge(state);
  const mult = bastionMult(state, 'damage');
  return mSheet('Nouvel âge', `<div class="m-card mt-announce" style="--age:${a.color}"><small class="mt-ann-kicker">Âge ${a.roman}</small><b class="mt-ann-age">${escapeHtml(a.name)}</b>
      <span>Niveaux jusqu'à ${a.maxLevel}${mult > 1.001 ? ` · ×${dec(mult)} dégâts et vie` : ''}</span>
      <small>${nx ? `Âge ${nx.roman} · ${escapeHtml(nx.name)} : étape ${nx.stage}${nx.bastionLevel ? `, Bastion niveau ${nx.bastionLevel}` : ''}` : 'Âge maximal'}</small></div>${mBtnGold('Continuer', { action: 'bastion-age-ok' })}`,
    { id: 'bs-announce', icon: 'tab_expeditions', back: 'bastion-age-ok', close: 'bastion-age-ok' });
}

// Onglet « Ouvriers » : les bâtiments avec leur ouvrier, puis les compagnons libres et « Poser au mieux ».
function workersView(state) {
  const rows = BUILDINGS.filter((d) => !d.existing && buildingAccess(state, d.id).available).map((d) => {
    const w = workerOf(state, d.id);
    const c = w ? companionById(w) : null;
    const lv = buildingLevel(state, d.id);
    const who = c ? `<span class="mt-bw">${mTile({ name: c.name, rarity: c.rarity }, { size: 48, pips: false, src: companionStill(c).match(/src="([^"]+)"/)?.[1] })}<span class="mt-bwt"><b>${escapeHtml(c.name.split(/\s+/)[0])}</b><small class="good">+${workerBonus(state, c.id, d.id).totalPct} %</small></span></span>`
      : '<span class="mt-bw need"><i aria-hidden="true">⛏</i><b>+ Ouvrier</b></span>';
    return `<button type="button" class="m-card mt-brow${c ? '' : ' idle'}" data-action="bastion-wopen" data-value="${d.id}" aria-label="${escapeHtml(d.name)}">
        <img class="px mt-bimg" src="${buildingArt(state, d, lv)}" alt=""><span class="mt-btxt"><b>${escapeHtml(d.name)}</b><small>Niv. ${lv < 1 ? 0 : lv}</small></span>${who}</button>`;
  }).join('');
  const free = availableWorkers(state).filter((c) => !workerBuilding(state, c.id));
  const need = BUILDINGS.find((d) => !d.existing && buildingAccess(state, d.id).available && !workerOf(state, d.id));
  const slotsLeft = need && workersPlaced(state) < workerSlots(state);
  const tiles = free.map((c) => mTile({ name: c.name, rarity: c.rarity }, { size: 56, pips: false, src: companionStill(c).match(/src="([^"]+)"/)?.[1], label: c.name.split(/\s+/)[0] }));
  const idle = `<div class="m-card mt-free"><div class="mt-sub">Compagnons libres (${free.length})</div>${tiles.length ? mGrid(tiles, 5) : '<small class="muted">Aucun compagnon libre</small>'}</div>`;
  return `${slotsLeft && free.length ? mBtnGold('Poser au mieux', { action: 'bastion-autoplace', icon: 'icon_upgrade' }) : ''}${idle}${rows}`;
}

function renderBastionPhone(ui, state, now) {
  const v = ui.view;
  const view = v.bastionView === 'research' || v.bastionView === 'workers' ? v.bastionView : 'map';
  const ready = ordersReady(state).length;
  const firstIdle = BUILDINGS.find((d) => !d.existing && buildingAccess(state, d.id).available && !workerOf(state, d.id));
  const canFill = firstIdle && workersPlaced(state) < workerSlots(state) && availableWorkers(state).some((c) => !workerBuilding(state, c.id));
  const chips = `<div class="m-chips mt-res">
      <span class="m-chip" data-gloss="gold">${coin()}<b class="num">${formatNumber(Math.floor(state.gold))}</b></span>
      <span class="m-chip" data-gloss="shards">${shard()}<b class="num">${formatNumber(state.materials.shards)}</b></span>
      <span class="m-chip" title="Niveau du Bastion : somme des niveaux">${img(`file:${ART('scene_tower')}`)}<b class="num">${bastionLevel(state)}</b></span>
      <span class="m-chip bs-workers${canFill ? ' warn' : ''}" title="Ouvriers posés / places">👷 <b class="num">${workersPlaced(state)}/${workerSlots(state)}</b></span>
      ${ready ? `<span class="m-chip good">${img(slotIconName('weapon'))}<b class="num">${ready}</b></span>` : ''}</div>`;
  const modes = mModes([
    { id: 'map', label: 'Carte', icon: `file:${ART('scene_tower')}`, action: 'bastion-view', value: 'map' },
    { id: 'research', label: 'Recherches', icon: `file:${ART('research_node_book')}`, action: 'bastion-view', value: 'research' },
    { id: 'workers', label: 'Ouvriers', icon: `file:${tradeArt('smith')}`, action: 'bastion-view', value: 'workers', badge: Boolean(canFill) },
  ], view);
  const content = view === 'research' ? researchTree(ui, state, now) : view === 'workers' ? workersView(state) : villageMap(ui, state, now);
  // une seule fenêtre à la fois
  let sheet = '';
  if (v.bastionKick) sheet = kickSheet(ui);
  else if (v.bastionAgeNew) sheet = ageSheet(ui, state);
  else if (view === 'research' ? v.bastionRes : v.bastionSel) {
    const body = view === 'research' ? researchSheet(ui, state, now) : buildingSheet(ui, state, now);
    const name = view === 'research' ? 'Recherche' : buildingDef(v.bastionSel)?.name; // v10.12 : le nom complet est dans la fiche (cartouche trop étroit)
    if (body) sheet = mSheet(name ?? 'Bastion', body, { id: 'bs-sheet', icon: 'tab_expeditions', back: 'bastion-close', close: 'bastion-close' });
  }
  return `<div class="m-frame mt-frame mt-bastion">${mTitle('tab_expeditions', 'Bastion', true)}${chips}${modes}
      <div class="bs-pg mt-bs" data-view="${view}"><div class="bs-main">${content}</div></div></div>${sheet}`;
}

// ---------------------------------------------------------------- v10.13 : Bastion sur PC (Carte, Ouvriers) dans le cadre du kit
// Cadre + cartouche, modes Carte · Recherches · Ouvriers, ressources, puis 2 colonnes : la carte (ou la liste des ouvriers) et la fiche du
// bâtiment choisi (toujours là). Le mode Recherches garde son propre écran (desk-research.css).
function deskResources(state, canFill) {
  const ready = ordersReady(state).length;
  return `<div class="m-chips d-bs-res" role="group" aria-label="Tes ressources">
      <span class="m-chip" data-gloss="gold">${coin()}<b class="num">${formatNumber(Math.floor(state.gold))}</b></span>
      <span class="m-chip" data-gloss="shards">${shard()}<b class="num">${formatNumber(state.materials.shards)}</b></span>
      <span class="m-chip" title="Niveau du Bastion : somme des niveaux">${img(`file:${ART('scene_tower')}`)}<b class="num">${bastionLevel(state)}</b></span>
      <button type="button" class="m-chip bs-workers${canFill ? ' warn' : ''}" data-action="bastion-view" data-value="workers" title="Ouvriers posés / places${canFill ? ' : il en manque un' : ''}">👷 Ouvriers <b class="num">${workersPlaced(state)}/${workerSlots(state)}</b></button>
      ${ready ? `<span class="m-chip good">${img(slotIconName('weapon'))}<b class="num">${ready}</b></span>` : ''}</div>`;
}

// Compagnons libres (ni dans l'équipe, ni en expédition, ni au travail) : leurs portraits, et « Poser au mieux » (doré seulement quand c'est l'action du mode).
function deskFree(state, gold) {
  const free = availableWorkers(state).filter((c) => !workerBuilding(state, c.id));
  const need = BUILDINGS.find((d) => !d.existing && buildingAccess(state, d.id).available && !workerOf(state, d.id));
  const slotsLeft = need && workersPlaced(state) < workerSlots(state);
  const tiles = free.map((c) => mTile({ name: c.name, rarity: c.rarity }, { size: 56, pips: false, src: companionStill(c).match(/src="([^"]+)"/)?.[1], label: c.name.split(/\s+/)[0] }));
  const auto = slotsLeft && free.length ? (gold ? mBtnGold('Poser au mieux', { action: 'bastion-autoplace', icon: 'icon_upgrade' }) : mBtn('Poser au mieux', { action: 'bastion-autoplace', icon: 'icon_upgrade' })) : '';
  return `<div class="m-card d-bs-free"><div class="d-bs-sub">Compagnons libres (${free.length})${slotsLeft && free.length ? ' : pose-les dans tes bâtiments' : ''}</div>${tiles.length ? mGrid(tiles, 7) : '<small class="muted">Aucun compagnon libre</small>'}${auto}</div>`;
}

// Onglet Ouvriers : un bâtiment par ligne (image, niveau, son ouvrier et son bonus, ou « + Ouvrier » s'il en manque un).
function deskWorkerRows(ui, state) {
  return BUILDINGS.filter((d) => !d.existing && buildingAccess(state, d.id).available).map((d) => {
    const w = workerOf(state, d.id);
    const c = w ? companionById(w) : null;
    const lv = buildingLevel(state, d.id);
    const who = c ? `<span class="d-bw">${mTile({ name: c.name, rarity: c.rarity }, { size: 48, pips: false, src: companionStill(c).match(/src="([^"]+)"/)?.[1] })}<span class="d-bwt"><b>${escapeHtml(c.name.split(/\s+/)[0])}</b><small class="good">+${workerBonus(state, c.id, d.id).totalPct} %</small></span></span>`
      : '<span class="d-bw need"><i aria-hidden="true">⛏</i><b>+ Ouvrier</b></span>';
    return `<button type="button" class="m-card d-brow${c ? '' : ' idle'}${ui.view.bastionSel === d.id ? ' sel' : ''}" data-action="bastion-wopen" data-value="${d.id}" aria-label="${escapeHtml(d.name)}" aria-pressed="${ui.view.bastionSel === d.id}">
        <img class="px d-bimg" src="${buildingArt(state, d, lv)}" alt=""><span class="d-btxt"><b>${escapeHtml(d.name)}</b><small>Niv. ${lv < 1 ? 0 : lv}</small></span>${who}</button>`;
  }).join('');
}

function renderBastionDesk(ui, state, now, view) {
  const v = ui.view;
  DESK = true;
  const firstIdle = BUILDINGS.find((d) => !d.existing && buildingAccess(state, d.id).available && !workerOf(state, d.id));
  const canFill = Boolean(firstIdle && workersPlaced(state) < workerSlots(state) && availableWorkers(state).some((c) => !workerBuilding(state, c.id)));
  if (!v.bastionSel || !buildingDef(v.bastionSel) || !buildingAccess(state, v.bastionSel).available) {
    v.bastionSel = view === 'workers' && firstIdle ? firstIdle.id : BUILDINGS.find((d) => bastionOf(state).buildings[d.id]?.build)?.id ?? 'forge'; // la fiche est toujours là
  }
  const modes = mModes([
    { id: 'map', label: 'Carte', icon: `file:${ART('scene_tower')}`, action: 'bastion-view', value: 'map' },
    { id: 'research', label: 'Recherches', icon: `file:${ART('research_node_book')}`, action: 'bastion-view', value: 'research' },
    { id: 'workers', label: 'Ouvriers', icon: `file:${tradeArt('smith')}`, action: 'bastion-view', value: 'workers', badge: canFill },
  ], view, { size: 64 });
  const side = buildingSheet(ui, state, now);
  const left = view === 'workers'
    ? `${deskFree(state, false)}<div class="d-bs-rows">${deskWorkerRows(ui, state)}</div>`
    : `${villageMap(ui, state, now, false)}${deskFree(state, false)}`;
  return `<div class="m-frame d-bs d-bs-${view}" data-view="${view}">${mTitle('tab_expeditions', 'Bastion', true)}${modes}${deskResources(state, canFill)}${kickRibbon(ui)}
      <div class="d-cols2 d-bs-cols"><div class="d-stack d-bs-left">${left}</div><aside class="bs-side is-open d-bs-side" id="bs-detail" data-sel="${escapeHtml(v.bastionSel ?? '')}">${side}</aside></div></div>`;
}

function renderBastion(ui, state) {
  if (PHONE) return renderBastionPhone(ui, state, Date.now());
  const now = Date.now();
  const v = ui.view;
  const view = v.bastionView === 'research' ? 'research' : 'map';
  const page = pageActive(ui);
  const narrow = ui.root?.classList.contains('page-narrow') || !page;
  // Sur grand écran la fiche est toujours là : le bâtiment en cours (sinon la Forge) est choisi d'office.
  if (view === 'map' && !v.bastionSel && !narrow) v.bastionSel = BUILDINGS.find((d) => bastionOf(state).buildings[d.id]?.build)?.id ?? 'forge';
  if (view === 'research') return researchDesk(ui, state, now); // v10.13 (§ 7) : cadre du kit PC
  if ((ui.root?.clientWidth ?? 9999) > 600 && view !== 'research') return renderBastionDesk(ui, state, now, v.bastionView === 'workers' ? 'workers' : 'map'); // v10.13 : Carte et Ouvriers dans le cadre du kit PC
  const side = view === 'research' ? researchSheet(ui, state, now) : buildingSheet(ui, state, now);
  const open = Boolean(side) && (view === 'research' ? Boolean(v.bastionRes) || !narrow : Boolean(v.bastionSel));
  const ready = ordersReady(state).length;
  const tab = (id, art, label) => `<button class="bs-view${view === id ? ' on' : ''}" data-action="bastion-view" data-value="${id}" aria-pressed="${view === id}"><img class="px" src="${art}" alt="">${label}</button>`;
  return `<div class="pg bastion bs-pg" data-view="${view}">
      <div class="pg-top bs-top">
        ${tab('map', ART('scene_tower'), 'Carte')}${tab('research', ART('research_node_book'), 'Recherches')}
        ${(() => { const firstIdle = BUILDINGS.find((d) => !d.existing && buildingAccess(state, d.id).available && !workerOf(state, d.id));
          const canFill = firstIdle && workersPlaced(state) < workerSlots(state) && availableWorkers(state).some((c) => !workerBuilding(state, c.id));
          return `<button class="bs-chip bs-workers${canFill ? ' warn' : ''}" ${canFill ? `data-action="bastion-open" data-value="${firstIdle.id}"` : ''} title="Ouvriers posés / places${canFill ? ' : touche pour poser un ouvrier' : ''}">👷 <span>Ouvriers</span> <b class="num">${workersPlaced(state)}/${workerSlots(state)}</b></button>`; })()}
        <span class="bs-chip" data-gloss="gold">${coin()}<b class="num">${formatNumber(Math.floor(state.gold))}</b></span>
        <span class="bs-chip" data-gloss="shards">${shard()}<b class="num">${formatNumber(state.materials.shards)}</b></span>
        <span class="bs-chip lvl" title="Niveau du Bastion : somme des niveaux">${img(`file:${ART('scene_tower')}`)}<b class="num">${bastionLevel(state)}</b></span>
        ${ready ? `<span class="bs-chip good">${img(slotIconName('weapon'))}<b class="num">${ready}</b></span>` : ''}
      </div>
      <div class="pg-main bs-main">${view === 'research' ? researchTree(ui, state, now) : `${villageMap(ui, state, now)}${researchTree(ui, state, now, true)}${idlers(state)}`}</div>
      <div class="pg-side bs-side${open ? ' is-open' : ''}" id="bs-detail" data-sel="${escapeHtml(view === 'research' ? v.bastionRes ?? '' : v.bastionSel ?? '')}">${side}</div>
    </div>`;
}

// ---------------------------------------------------------------- actions

// Ouvre le Bastion sur un bâtiment, les recherches ou les ouvriers (Sceau, Carnet, Forge, Équipement, tour de la scène).
export function openBastion(ui, value = null) {
  const b = bastionOf(ui.state);
  const v = ui.view;
  if (b) {
    if (value === 'research') { v.bastionView = 'research'; v.bastionRes = null; }
    else if (value === 'workers') { v.bastionView = 'map'; v.bastionSel = 'forge'; }
    else if (buildingDef(value)) { v.bastionView = 'map'; v.bastionSel = value; }
  }
  ui.actions.bastion?.('seen');
  if (ui.tab !== 'camp') ui.openTab('camp'); else ui.invalidate();
}

// Tous les boutons du Bastion (data-action="bastion-…"). Renvoie vrai si l'action est traitée.
export function bastionAction(ui, action, value) {
  const v = ui.view;
  const a = ui.actions;
  const redraw = () => ui.invalidate();
  switch (action) {
    case 'bastion-open': v.bastionView = 'map'; v.bastionSel = value === 'workers' ? 'forge' : value; v.bastionMore = null; redraw(); break;
    case 'bastion-close': if (v.bastionView === 'research') v.bastionRes = null; else v.bastionSel = null; redraw(); break;
    case 'bastion-view': v.bastionView = value; if (value === 'research') v.bastionRes = null; redraw(); break;
    case 'bastion-pick': v.bastionSel = value; redraw(); break;
    case 'bastion-more': v.bastionMore = value; redraw(); break;
    case 'bastion-tip': a.bastion('tip', value); break;
    case 'bastion-kick-ok': v.bastionKick = null; redraw(); break;
    case 'bastion-age-ok': v.bastionAgeNew = null; redraw(); break; // v10.12 : « Continuer » de la fiche « Nouvel âge »
    case 'bastion-wopen': v.bastionSel = value; v.bastionMore = null; redraw(); break; // v10.12 : un bâtiment depuis l'onglet Ouvriers (on y reste)
    case 'bastion-autoplace': a.bastion('autoplace'); break; // v10.11 (3)
    case 'bastion-goto-workers': document.querySelector('.bs-wblock')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); break;
    case 'bastion-worker': { const [building, companion] = value.split('|'); a.bastion('worker', building, companion || null); break; }
    case 'bastion-build': a.bastion('build', value); break;
    case 'bastion-res': v.bastionView = 'research'; v.bastionRes = value; redraw(); break;
    case 'bastion-research': a.bastion('research', value); break;
    case 'bastion-slot': v.bastionSlot = value; redraw(); break;
    case 'bastion-tier': v.bastionTier = value; redraw(); break;
    case 'bastion-locked': ui.toast(value, '#ffcf6a'); break;
    case 'bastion-order': { const [slot, tier] = value.split('|'); a.bastion('order', slot, tier); break; }
    case 'bastion-collect': a.bastion('collect', value); break;
    case 'bastion-collect-order': a.bastion('collect-order', Number(value)); break;
    case 'bastion-trade': a.bastion('trade', value); break;
    case 'bastion-away-claim': a.bastion('away-claim'); break;
    case 'bastion-tower': openBastion(ui); break; // v10.4 (6) : la tour de la scène
    case 'bastion-branch': v.resBranch = value; v.resLeaf = 0; v.bastionRes = null; redraw(); break; // v10.9 (3)
    case 'bastion-leaf': v.resLeaf = Number(value); redraw(); break; // v10.9 (3) : téléphone, page suivante
    case 'bastion-page': v.resPage = Number(value); v.bastionRes = null; redraw(); break; // v10.8 : pages du livre
    case 'bastion-engrave': a.bastion('engrave', value); break;
    case 'bastion-ascend': a.bastion('ascend', value); break;
    case 'bastion-black': a.bastion('black-market', value); break;
    default: return false;
  }
  return true;
}

// Pastille du menu et de la tour : ce qui attend au Bastion (commande prête, stock plein, chantier fini pendant
// l'absence, ouvrier qui manque sur un bâtiment ouvert alors qu'il reste une place et un compagnon libre).
export function bastionBadge(state) {
  const b = bastionOf(state);
  if (!b) return 0;
  const full = ['mine', 'training'].filter((id) => { const p = productionOf(state, id); return p && stockOf(state, id) >= p.cap; }).length;
  const done = (b.news ?? []).filter((n) => n.kind === 'build' && !n.book).length ? 1 : 0;
  const free = availableWorkers(state).some((c) => !workerBuilding(state, c.id));
  const missing = free && workersPlaced(state) < workerSlots(state)
    && BUILDINGS.some((d) => !d.existing && buildingAccess(state, d.id).available && !workerOf(state, d.id)) ? 1 : 0;
  return ordersReady(state).length + full + done + missing;
}

// Hauteur disponible de la carte : le décor garde ses proportions (384 × 216) et tient dans la page sans défiler.
// v10.9 (partie 2) : zoom de la carte (molette, deux doigts ou boutons + / −) et glissement quand elle est zoomée.
function bindZoom(body) {
  const v = body.querySelector('.bs-village');
  if (!v || v.dataset.zoomBound) return;
  v.dataset.zoomBound = '1';
  let z = 1, px = 0, py = 0, drag = null, pinch = null;
  const apply = () => { v.style.setProperty('--zoom', z); v.style.setProperty('--px', `${px}px`); v.style.setProperty('--py', `${py}px`); v.classList.toggle('zoomed', z > 1.01); };
  const clamp = () => { const r = v.getBoundingClientRect(); const mx = (r.width * (z - 1)) / (2 * z), my = (r.height * (z - 1)) / (2 * z); px = Math.max(-mx, Math.min(mx, px)); py = Math.max(-my, Math.min(my, py)); };
  const set = (nz) => { z = Math.max(1, Math.min(2.5, nz)); if (z <= 1.01) { px = 0; py = 0; } clamp(); apply(); };
  v.addEventListener('wheel', (e) => { e.preventDefault(); set(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  v.querySelector('.bs-zoom')?.addEventListener('click', (e) => { const b = e.target.closest('[data-zoom]'); if (b) { e.stopPropagation(); set(z * (b.dataset.zoom === 'in' ? 1.4 : 1 / 1.4)); } });
  v.addEventListener('pointerdown', (e) => { if (z > 1.01 && !e.target.closest('.bs-zoom')) drag = { x: e.clientX, y: e.clientY, px, py, moved: false }; });
  v.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; px = drag.px + dx / z; py = drag.py + dy / z; clamp(); apply(); });
  v.addEventListener('pointerup', () => { if (drag?.moved) v.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true }); drag = null; });
  v.addEventListener('touchmove', (e) => { if (e.touches.length !== 2) return; const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) set(z * (d / pinch)); pinch = d; e.preventDefault(); }, { passive: false });
  v.addEventListener('touchend', () => { pinch = null; });
}

// v10.11 (3.7) : première visite — une main montre un bâtiment sans ouvrier, puis un portrait, avec la bulle
// « Pose un compagnon : sans ouvrier, rien n'avance. » (une seule fois, après le bandeau d'âge et le bandeau de travail).
function workerHand(body) {
  const st = body.closest('#app')?.__ui?.state;
  if (!st?.ui || (st.ui.hints ?? []).includes('bastion-hand')) return;
  if (body.querySelector('.bs-kick, .bs-age-new') || document.querySelector('.bs-hand, #panel > .m-sheet')) return;
  const target = body.querySelector('.bs-wcard:not(.here):not(.busy)') && body.querySelector('.bs-idle-box') ? body.querySelector('.bs-wcard:not(.here):not(.busy)') : body.querySelector('.bs-plot .bs-need');
  if (!target) return;
  const r = target.getBoundingClientRect();
  if (!r.width) return;
  const hand = document.createElement('div');
  hand.className = 'bs-hand';
  hand.innerHTML = '<span class="bs-hand-finger" aria-hidden="true">👆</span><span class="bs-hand-bubble">Pose un compagnon : sans ouvrier, rien n\'avance.</span>';
  hand.style.left = `${Math.round(r.left + r.width / 2)}px`; hand.style.top = `${Math.round(r.bottom)}px`;
  document.body.appendChild(hand);
  const done = () => { hand.remove(); if (!(st.ui.hints ?? []).includes('bastion-hand') && target.matches('.bs-wcard')) (st.ui.hints ??= []).push('bastion-hand'); };
  hand.addEventListener('click', () => { hand.remove(); (st.ui.hints ??= []).push('bastion-hand'); });
  target.addEventListener('click', done, { once: true });
  setTimeout(() => hand.remove(), 9000);
}

function fitMap(body) {
  bindZoom(body);
  setTimeout(() => workerHand(body), 400);
  const main = body.querySelector('.bs-pg .bs-main');
  const world = main?.querySelector('.bs-world');
  if (!world) return;
  // v10.9 : la place sous le bandeau d'âge (la carte entière tient dans son cadre, rien n'est coupé).
  const village = world.parentElement;
  const h = main.clientHeight - Math.max(0, village.getBoundingClientRect().top - main.getBoundingClientRect().top) / Math.max(0.01, main.getBoundingClientRect().height / Math.max(1, main.clientHeight));
  if (h > 40 && !body.closest('.page-narrow')) world.style.setProperty('--map-h', `${h - 4}px`);
  // Sous la carte, l'arbre des Recherches quand la place le permet (sinon il est derrière « Recherches »).
  const tree = main.querySelector('.bs-tree.below');
  const idle = main.querySelector('.bs-idlers');
  const narrow = Boolean(body.closest('.page-narrow'));
  const spare = main.clientHeight - world.offsetHeight;
  if (tree) tree.classList.toggle('hidden', !narrow && spare < tree.offsetHeight + 12);
  // Sinon, s'il reste une bande : les compagnons libres, qui attendent un poste.
  if (idle) idle.classList.toggle('hidden', narrow || !tree?.classList.contains('hidden') || spare < 96);
}

// Bande des compagnons libres (ni dans l'équipe, ni en expédition, ni au travail), debout sur l'herbe du village.
function idlers(state) {
  const free = availableWorkers(state).filter((c) => !workerBuilding(state, c.id));
  if (!free.length) return '';
  const need = BUILDINGS.find((d) => !d.existing && buildingAccess(state, d.id).available && !workerOf(state, d.id));
  const slotsLeft = need && workersPlaced(state) < workerSlots(state);
  return `<div class="bs-idlers-wrap"><div class="bs-idlers-head"><b>Compagnons libres (${free.length})${slotsLeft ? ' : pose-les dans tes bâtiments' : ''}</b>${slotsLeft ? '<button class="btn btn-gold small" data-action="bastion-autoplace">Poser au mieux</button>' : ''}</div>
    <div class="bs-idlers hidden" style="background-image:url(${ART('bastion_map')})">
      ${free.slice(0, 14).map((c) => `<span class="bs-idler" title="${escapeHtml(`${c.name} · ${TRADES[tradeOf(c.id)]?.label ?? ''}`)}">${companionStill(c)}<img class="px" src="${tradeArt(tradeOf(c.id))}" alt=""></span>`).join('')}</div></div>`;
}

export default {
  id: 'camp',
  title: 'Bastion',
  icon: 'tab_expeditions',
  render(ui, state) {
    PHONE = isPhoneUi(ui);
    DESK = false;
    return bastionOf(state) ? renderBastion(ui, state) : renderCamp(state);
  },
  afterRender(ui, body) {
    fitMap(body);
    if (!body.__bsFit) { body.__bsFit = true; window.addEventListener('resize', () => { if (ui.tab === 'camp') fitMap(body); }); }
    if (ui.view.bastionView === 'research') body.querySelector('.bs-node.active, .bs-node.sel')?.scrollIntoView({ block: 'nearest' });
  },
  tick,
};
