// v10.3 (partie 10) : le Camp devient le Bastion (même panneau `camp` : navigation et sauvegardes inchangées).
// Avant l'étape 40 : le Camp d'avant (l'équipe autour du feu, les trophées) et l'annonce « Le Bastion ouvre à l'étape 40 ».
// Ensuite : en-tête (ouvriers, or, éclats), carte du Bastion (une carte par bâtiment sur le décor des expéditions),
// panneau du bâtiment choisi (ouvrier et métier, « Améliorer » avant → après, coût « tu as … », durée, file de
// commandes de la Forge), bandeau des Recherches (3 colonnes). Téléphone : liste de bâtiments et feuille du bas.
// Les minuteurs avancent sans redessiner le panneau : `tick` met à jour les éléments [data-bt-end] une fois par seconde.
import { BALANCE } from '../../data/balance.js';
import { SLOTS } from '../../data/items.js';
import { BASTION_MAX_LEVEL, BASTION_UNLOCK_STAGE, FORGE_PERKS, LIBRARY, RESEARCH_UNLOCK_LEVEL, TRADE_POST, WORKER_RULES } from '../../data/bastion.js';
import {
  BUILDINGS, ORDER_TIERS, RESEARCH, RESEARCH_BRANCHES, TRADES, availableWorkers, bastionLevel, bastionOf, buildCost, buildRemaining, buildingAccess,
  buildingDef, buildingLevel, canBuild, canOrder, canResearch, forgePerks, orderChances, orderCost, orderLabel, orderRemaining, orderSlots, orderTierOpen,
  ordersReady, productionFactor, productionOf, researchCost, researchLevel, researchRemaining, researchSlots, researchStatus, stockOf, tradeLeft,
  tradeOf, tradeOffer, workerBonus, workerBuilding, workerOf, workerSlots, workersPlaced,
} from '../../core/bastion.js';
import { companionById } from '../../core/companions.js';
import { fusionChance } from '../../core/forge.js';
import { LOOT_BAG_MAX } from '../../core/inventory.js';
import { formatDuration } from '../../core/format.js';
import { rarityById } from '../../core/loot.js';
import { REVENGE_STEPS, revengeLevel } from '../../core/revenge.js';
import { totalStars } from '../../core/world-stars.js';
import { activeBonds } from '../../data/bonds.js';
import { slotIconName } from '../../render/pixel.js';
import { animCanvas } from '../animator.js';
import { coin, escapeHtml, formatNumber, img, shard } from '../common.js';
import expeditionsPanel, { companionStill } from './expeditions.js';

const ART = (name) => `assets/ui/art103/${name}.png`;
const RES_NAME = { shards: 'éclats', grimoire: 'grimoires', ascension: 'pierres', mastery: 'essences' };
const RES_ICON = { shards: 'icon_shard', grimoire: 'icon_grimoire', ascension: 'icon_ascension', mastery: 'icon_mastery' };
const resName = (key, n) => (n === 1 ? RES_NAME[key].slice(0, -1) : RES_NAME[key]);
const dec = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// ---------------------------------------------------------------- minuteurs (mis à jour sans redessin)

// Temps restant : « encore 1 h 20 min », « en pause » sans ouvrier. `ms` : temps réel restant.
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
    <span class="bs-time"><b class="num" ${live}>${Math.floor(stock)}</b> / ${prod.cap} ${RES_NAME[prod.resource]}</span>`;
}

function tick(ui) {
  const now = Date.now();
  for (const root of [ui.$('panel-body')]) {
    if (!root) continue;
    for (const el of root.querySelectorAll('[data-bt-end]')) {
      const left = Number(el.dataset.btEnd) - now;
      if (el.dataset.btSpan) el.style.width = `${(Math.max(0, Math.min(1, 1 - left / Number(el.dataset.btSpan))) * 100).toFixed(1)}%`;
      else { const text = left <= 0 ? 'terminé' : `encore ${formatDuration(left / 1000)}`; if (el.textContent !== text) el.textContent = text; }
    }
    for (const el of root.querySelectorAll('[data-bt-stock]')) {
      const cap = Number(el.dataset.btCap);
      const v = Math.min(cap, Number(el.dataset.btStock) + Number(el.dataset.btRate) * (now - Number(el.dataset.btAt)));
      if (el.tagName === 'I') el.style.width = `${Math.min(100, (v / cap) * 100).toFixed(1)}%`;
      else { const text = String(Math.floor(v)); if (el.textContent !== text) el.textContent = text; }
    }
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
    state.companions.equipped.join(), (state.lootBag?.length ?? 0) >= LOOT_BAG_MAX, Math.floor(Date.now() / 60000),
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

// L'effet d'un bâtiment en une ligne (carte du Bastion).
function effectLine(state, def) {
  const lv = buildingLevel(state, def.id);
  if (def.existing) { const s = state.expeditions?.slots ?? []; return `${s.filter(Boolean).length}/${s.length} compagnons en route`; }
  if (lv < 1) return 'À construire';
  if (def.id === 'forge') return `Renfort max +${(BALANCE.forge.maxUpgrades.epic ?? 10) + forgePerks(state).maxUpgradeBonus} · fusion à 4 : ${fusionChance(state, 'weapon', 'epic', 4, BALANCE, { base: true })} %`;
  if (def.id === 'library') return `${plural(researchSlots(state), 'recherche')} à la fois`;
  if (def.id === 'mine') return `+${dec(productionOf(state, 'mine').perHour * productionFactor(state, 'mine'))} éclats par heure`;
  if (def.id === 'training') return `+${dec(productionOf(state, 'training').perHour * productionFactor(state, 'training') * 24)} grimoires par jour`;
  if (def.id === 'trade') return `${plural(tradeLeft(state), 'échange')} aujourd'hui`;
  return '';
}

// Total d'une recherche à un niveau : « +6 % de dégâts » (le nombre de la phrase × le niveau).
function researchText(def, level) {
  return def.text.replace(/\d+(?:,\d+)?/, (m) => dec(parseFloat(m.replace(',', '.')) * Math.max(1, level)));
}

// ---------------------------------------------------------------- carte du Bastion

function medal(state, def, sel) {
  if (def.existing) return '';
  const w = workerOf(state, def.id);
  const c = w ? companionById(w) : null;
  if (c) return `<button class="bs-medal r-${c.rarity}" data-action="bastion-pick" data-value="${def.id}" title="${escapeHtml(c.name)} · ${TRADES[tradeOf(c.id)]?.label ?? ''}" aria-label="Ouvrier : ${escapeHtml(c.name)}">${companionStill(c)}</button>`;
  return `<button class="bs-medal empty${sel ? ' on' : ''}" data-action="bastion-pick" data-value="${def.id}" title="Poser un ouvrier" aria-label="Poser un ouvrier">+</button>`;
}

// Ce que fait le bâtiment en ce moment : barre de chantier ou de production, et le temps restant.
function activity(state, def, now) {
  const b = bastionOf(state);
  const slot = b.buildings[def.id];
  if (slot?.build) {
    const f = slot.worker ? productionFactor(state, def.id) : 0;
    return `${jobBar(slot.build, f, now, 'build')}<span class="bs-line">Chantier niv. ${slot.build.level ?? slot.level + 1} · ${timer(buildRemaining(state, def.id), now)}</span>`;
  }
  if (def.existing) { const n = (state.expeditions?.slots ?? []).filter((s) => s && now >= s.end).length; return n ? `<span class="bs-line good">${plural(n, 'expédition')} à récupérer</span>` : ''; }
  if (slot.level < 1) return '';
  if (def.id === 'forge') {
    const o = b.orders[0];
    if (!o) return '<span class="bs-line muted">Aucune commande en cours</span>';
    if (o.ready) return '<span class="bs-line good">Commande prête</span>';
    return `${jobBar(o, productionFactor(state, 'forge'), now, 'work')}<span class="bs-line">${escapeHtml(orderLabel(o))} · ${timer(orderRemaining(state, o), now)}</span>`;
  }
  if (def.id === 'library') {
    const a = b.research.active[0];
    if (!a) return '<span class="bs-line muted">Aucune recherche en cours</span>';
    return `${jobBar(a, productionFactor(state, 'library'), now, 'work')}<span class="bs-line">${escapeHtml(RESEARCH.find((r) => r.id === a.id).name)} · ${timer(researchRemaining(state, a.id), now)}</span>`;
  }
  if (def.id === 'mine' || def.id === 'training') return `<span class="bs-stock">${stockBar(state, def.id, now)}</span>`;
  return '';
}

function buildingCard(ui, state, def, now) {
  const access = buildingAccess(state, def.id);
  const sel = ui.view.bastionSel === def.id;
  const art = `<img class="px bs-art" src="${ART(`b_${def.art}`)}" alt="" loading="lazy">`;
  if (!access.available) {
    return `<div class="bs-card locked" aria-disabled="true"><div class="bs-pic">${art}</div>
      <div class="bs-info"><b class="bs-name">${escapeHtml(def.name)}</b><span class="bs-lock">${img('icon_lock')} ${escapeHtml(access.reason)}</span></div></div>`;
  }
  const lv = buildingLevel(state, def.id);
  const w = workerOf(state, def.id);
  const c = w ? companionById(w) : null;
  // Petit ouvrier animé devant son bâtiment, son outil à la main.
  const sprite = c ? `<span class="bs-worker">${animCanvas(`foe:${c.sprite}`, 64, 56, 1)}<img class="px bs-tool t-${def.tool}" src="${ART(`tool_${def.tool}`)}" alt=""></span>` : '';
  const idle = !def.existing && !w ? '<span class="bs-idle">Aucun ouvrier : à l\'arrêt</span>' : '';
  return `<div class="bs-card${sel ? ' sel' : ''}${idle ? ' idle' : ''}" role="button" tabindex="0" data-action="bastion-open" data-value="${def.id}" data-building="${def.id}">
      <div class="bs-pic">${art}${sprite}${def.existing ? '' : `<span class="bs-lv">${lv < 1 ? 'À construire' : `Niv. ${lv}`}</span>`}${medal(state, def, sel)}</div>
      <div class="bs-info"><b class="bs-name">${escapeHtml(def.name)}</b><span class="bs-fx">${escapeHtml(effectLine(state, def))}</span>${idle}${activity(state, def, now)}</div>
    </div>`;
}

// ---------------------------------------------------------------- panneau du bâtiment choisi

const have = (cost, state) => `<span class="bs-cost${state.gold >= cost.gold ? '' : ' miss'}">${coin()} <b class="num">${formatNumber(cost.gold)}</b> <small>tu as ${formatNumber(Math.floor(state.gold))}</small></span>
  <span class="bs-cost${state.materials.shards >= cost.shards ? '' : ' miss'}">${shard()} <b class="num">${formatNumber(cost.shards)}</b> <small>tu as ${formatNumber(state.materials.shards)}</small></span>`;

// Durée avec et sans le bonus de l'ouvrier.
function duration(ms, factor, name) {
  const base = formatDuration(ms / 1000);
  if (!(factor > 0)) return `<span class="bs-dur">Durée : <b>${base}</b> <small class="bad">(sans ouvrier : à l'arrêt)</small></span>`;
  if (Math.abs(factor - 1) < 0.001) return `<span class="bs-dur">Durée : <b>${base}</b></span>`;
  return `<span class="bs-dur">Durée : <b>${formatDuration(ms / factor / 1000)}</b> <small>${factor > 1 ? `avec ${escapeHtml(name ?? 'ton ouvrier')}` : 'sans ouvrier'} (${base} ${factor > 1 ? 'sans son bonus' : 'avec un ouvrier'})</small></span>`;
}

function workerRow(state, c, buildingId) {
  const bonus = workerBonus(state, c.id, buildingId);
  const trade = TRADES[tradeOf(c.id)];
  const at = workerBuilding(state, c.id);
  const here = at === buildingId;
  return `<div class="bs-wrow${here ? ' here' : ''}"><span class="bs-wpic r-${c.rarity}">${companionStill(c)}</span>
      <span class="grow"><b>${escapeHtml(c.name)}</b> <small class="r-${c.rarity} rarity-text">${rarityById(c.rarity).label}</small>
        <small class="bs-wtrade${bonus.match ? ' good' : ''}">${escapeHtml(trade?.label ?? 'Sans métier')}${bonus.match ? ' · son métier' : trade ? ` · ${escapeHtml(buildingDef(trade.building).name)}` : ''}${at && !here ? ` · poste actuel : ${escapeHtml(buildingDef(at).name)}` : ''}</small></span>
      <b class="bs-wbonus${bonus.match ? ' good' : ''}">+${bonus.totalPct} %</b>
      ${here ? `<button class="btn small" data-action="bastion-worker" data-value="${buildingId}|">Retirer</button>`
    : `<button class="btn btn-primary small" data-action="bastion-worker" data-value="${buildingId}|${c.id}">Poser</button>`}</div>`;
}

function workerBlock(ui, state, def) {
  const w = workerOf(state, def.id);
  const c = w ? companionById(w) : null;
  const picking = ui.view.bastionPick === def.id || !c;
  const list = availableWorkers(state).sort((x, y) => workerBonus(state, y.id, def.id).totalPct - workerBonus(state, x.id, def.id).totalPct);
  const full = !c && workersPlaced(state) >= workerSlots(state);
  const head = c
    ? (() => { const b = workerBonus(state, c.id, def.id); return `<div class="bs-wrow here"><span class="bs-wpic r-${c.rarity}">${companionStill(c)}</span>
        <span class="grow"><b>${escapeHtml(c.name)}</b> <small class="bs-wtrade${b.match ? ' good' : ''}">${escapeHtml(TRADES[tradeOf(c.id)]?.label ?? 'Sans métier')}${b.match ? ` · son métier : +${b.tradePct} %` : ''} · rareté : +${b.rarityPct} %${b.researchPct ? ` · recherche : +${b.researchPct} %` : ''}</small></span>
        <b class="bs-wbonus good">+${b.totalPct} %</b>
        <button class="btn small" data-action="bastion-pick" data-value="${def.id}">${ui.view.bastionPick === def.id ? 'Fermer' : 'Changer'}</button></div>`; })()
    : `<p class="bs-idle">Aucun ouvrier : à l'arrêt${buildingLevel(state, def.id) > 0 ? ' (production à 50 %, pas de chantier)' : ' (pas de chantier)'}.</p>`;
  const rows = !picking ? '' : full && !list.some((x) => workerBuilding(state, x.id))
    ? `<p class="muted">Toutes les places d'ouvrier sont prises (${workerSlots(state)}). Retire un ouvrier d'un autre bâtiment pour le poser ici.</p>`
    : list.length ? `<div class="bs-wlist">${list.map((x) => workerRow(state, x, def.id)).join('')}</div>`
      : '<p class="muted">Aucun compagnon libre. Un ouvrier est un compagnon qui n\'est ni dans l\'équipe, ni en expédition : invoques-en d\'autres, ou rappelle une expédition.</p>';
  const trade = Object.values(TRADES).find((t) => t.building === def.id);
  return `<div class="bs-block"><div class="bs-block-title">Ouvrier${trade ? ` <small>· métier conseillé : ${escapeHtml(trade.label)} (+${WORKER_RULES.tradeBonusPct} %)</small>` : ''}</div>${head}${rows}</div>`;
}

function upgradeBlock(state, def, now) {
  const slot = bastionOf(state).buildings[def.id];
  const lv = slot.level;
  const w = workerOf(state, def.id);
  const f = w ? productionFactor(state, def.id) : 0;
  if (slot.build) {
    return `<div class="bs-block"><div class="bs-block-title">Chantier en cours : niv. ${lv} → ${lv + 1}</div>
      ${jobBar(slot.build, f, now, 'build')}<span class="bs-line">${timer(buildRemaining(state, def.id), now)}${w ? '' : ' <span class="bad">· pose un ouvrier pour reprendre</span>'}</span></div>`;
  }
  const cost = buildCost(state, def.id);
  if (!cost) return `<div class="bs-block"><div class="bs-block-title">Niveau maximal (${BASTION_MAX_LEVEL})</div></div>`;
  const before = levelEffects(state, def.id, lv);
  const after = levelEffects(state, def.id, lv + 1);
  const rows = after.map(([label, v], i) => {
    const old = before[i]?.[1];
    return `<div class="bs-fxrow${old !== v ? ' up' : ''}"><span>${label}</span><span>${old !== v ? `${escapeHtml(old ?? '—')} → <b class="good">${escapeHtml(v)}</b>` : escapeHtml(v)}</span></div>`;
  }).join('');
  const can = canBuild(state, def.id);
  return `<div class="bs-block"><div class="bs-block-title">${lv < 1 ? 'Construire' : 'Améliorer'} : niv. ${lv} → ${lv + 1}</div>
      <div class="bs-fxlist">${rows}</div>
      <div class="bs-costs">${have(cost, state)}${duration(cost.ms, f, w ? companionById(w)?.name : null)}</div>
      <button class="btn btn-gold primary-action" data-action="bastion-build" data-value="${def.id}" ${can.ok ? '' : 'disabled'}>${lv < 1 ? 'Construire' : 'Lancer le chantier'}</button>
      ${can.ok ? '' : `<small class="bs-why">${escapeHtml(can.reason)}</small>`}</div>`;
}

function forgeBlock(ui, state, now) {
  const b = bastionOf(state);
  const slot = SLOTS[ui.view.bastionSlot] ? ui.view.bastionSlot : 'weapon';
  const tierId = ORDER_TIERS.some((t) => t.id === ui.view.bastionTier && orderTierOpen(state, t.id)) ? ui.view.bastionTier : 'rare';
  const cost = orderCost(state, tierId);
  const can = canOrder(state, slot, tierId);
  const f = productionFactor(state, 'forge');
  const w = workerOf(state, 'forge');
  const slots = Object.keys(SLOTS).map((k) => `<button class="bs-slot${k === slot ? ' on' : ''}" data-action="bastion-slot" data-value="${k}" aria-pressed="${k === slot}" title="${escapeHtml(SLOTS[k])}" aria-label="${escapeHtml(SLOTS[k])}">${img(slotIconName(k))}</button>`).join('');
  const tiers = ORDER_TIERS.map((t) => {
    const open = orderTierOpen(state, t.id);
    return `<button class="bs-tier${t.id === tierId ? ' on' : ''}" data-action="${open ? 'bastion-tier' : 'bastion-locked'}" data-value="${open ? t.id : `Forge du forgeron niveau ${t.forgeLevel} requise`}" aria-pressed="${t.id === tierId}">
      <b class="r-${t.minRarity} rarity-text">${t.label}</b><small>${open ? `${t.hours} h` : `🔒 niv. ${t.forgeLevel}`}</small></button>`;
  }).join('');
  const chances = orderChances(tierId).map((x) => `<span class="r-${x.rarity} rarity-text">${rarityById(x.rarity).label} ${x.pct} %</span>`).join(' · ');
  const queue = Array.from({ length: Math.max(orderSlots(state), b.orders.length) }, (_, i) => {
    const o = b.orders[i];
    if (!o) return '<div class="bs-order empty"><span class="muted">Place libre</span></div>';
    if (o.ready) {
      return `<div class="bs-order ready"><span class="grow"><b>${escapeHtml(orderLabel(o))}</b> <small>prête · le coffre de butin est plein</small></span>
        <button class="btn btn-gold small" data-action="bastion-collect-order" data-value="${o.id}">Récupérer</button></div>`;
    }
    return `<div class="bs-order"><span class="grow"><b>${escapeHtml(orderLabel(o))}</b>${jobBar(o, f, now, 'work')}</span>${timer(orderRemaining(state, o), now)}</div>`;
  }).join('');
  const next = FORGE_PERKS.orderSlotsAt.find((at) => at > buildingLevel(state, 'forge'));
  return `<div class="bs-block"><div class="bs-block-title">Commandes du forgeron <small>· ${b.orders.length}/${orderSlots(state)}${next ? ` · une place de plus au niveau ${next}` : ''}</small></div>
      <div class="bs-queue">${queue}</div>
      <div class="bs-slots" role="group" aria-label="Place de l'objet">${slots}</div>
      <div class="bs-tiers" role="group" aria-label="Rareté minimale">${tiers}</div>
      <p class="bs-get">Tu reçois : <b>${escapeHtml(SLOTS[slot])}</b> au niveau de ton étape max, livré dans le coffre de butin. Chances : ${chances}.</p>
      <div class="bs-costs">${have(cost, state)}${duration(cost.ms, f, w ? companionById(w)?.name : null)}</div>
      <button class="btn btn-gold" data-action="bastion-order" data-value="${slot}|${tierId}" ${can.ok ? '' : 'disabled'}>Commander (${escapeHtml(SLOTS[slot])} ${ORDER_TIERS.find((t) => t.id === tierId).label})</button>
      ${can.ok ? '' : `<small class="bs-why">${escapeHtml(can.reason)}</small>`}
      <p class="muted bs-note">« Fabriquer » reste dans la Forge pour qui ne veut pas attendre : la commande coûte ${forgePerks(state).orderCostPct} % de moins et peut donner mieux.
        <button class="btn small" data-action="open-tab" data-value="forge">Ouvrir la Forge ›</button></p></div>`;
}

function stockBlock(state, id, now) {
  const prod = productionOf(state, id);
  if (!prod) return '';
  const f = productionFactor(state, id);
  const n = Math.floor(stockOf(state, id));
  return `<div class="bs-block"><div class="bs-block-title">Production <small>· ${dec(prod.perHour * f * (id === 'mine' ? 1 : 24))} ${RES_NAME[prod.resource]} par ${id === 'mine' ? 'heure' : 'jour'}${f < 1 ? ' (à 50 % : aucun ouvrier)' : f > 1 ? ` (ouvrier : +${Math.round((f - 1) * 100)} %)` : ''}</small></div>
      <div class="bs-stock">${stockBar(state, id, now)}</div>
      <button class="btn btn-gold" data-action="bastion-collect" data-value="${id}" ${n >= 1 ? '' : 'disabled'}>Récupérer</button>
      <small class="muted">Le stock se remplit même jeu fermé, puis s'arrête quand il est plein (${dec(prod.capHours)} h).</small></div>`;
}

function tradeBlock(state) {
  const left = tradeLeft(state);
  const rows = TRADE_POST.offers.map((x) => {
    const o = tradeOffer(state, x.id);
    const can = left > 0 && (state.materials[o.give] ?? 0) >= o.giveAmount;
    return `<div class="bs-trade"><span>${img(RES_ICON[o.give])} <b class="num">${o.giveAmount}</b> ${resName(o.give, o.giveAmount)}</span><span class="bs-arrow">→</span>
      <span>${img(RES_ICON[o.get])} <b class="num good">${o.getAmount}</b> ${resName(o.get, o.getAmount)}</span>
      <button class="btn small ${can ? 'btn-gold' : ''}" data-action="bastion-trade" data-value="${o.id}" ${can ? '' : 'disabled'}>Échanger</button></div>`;
  }).join('');
  return `<div class="bs-block"><div class="bs-block-title">Échanges <small>· ${plural(left, 'échange')} aujourd'hui</small></div>${rows}
    <small class="muted">Tu as : ${Object.keys(RES_NAME).map((k) => `${img(RES_ICON[k])} ${formatNumber(state.materials[k] ?? 0)}`).join(' · ')}</small></div>`;
}

function workersPanel(state) {
  const slots = workerSlots(state);
  const next = WORKER_RULES.slotsAt.find((at) => at > bastionLevel(state));
  const posts = BUILDINGS.filter((d) => !d.existing && buildingAccess(state, d.id).available).map((d) => {
    const c = companionById(workerOf(state, d.id));
    return `<div class="bs-wrow"><span class="bs-wpic${c ? ` r-${c.rarity}` : ' none'}">${c ? companionStill(c) : '+'}</span>
      <span class="grow"><b>${escapeHtml(d.name)}</b><small class="bs-wtrade">${c ? `${escapeHtml(c.name)} · +${workerBonus(state, c.id, d.id).totalPct} %` : '<span class="bad">aucun ouvrier</span>'}</small></span>
      <button class="btn small" data-action="bastion-pick" data-value="${d.id}">${c ? 'Changer' : 'Poser'}</button></div>`;
  }).join('');
  const free = availableWorkers(state).filter((c) => !workerBuilding(state, c.id));
  return `<div class="bs-detail-head"><b>Ouvriers</b><span class="muted">${workersPlaced(state)}/${slots} places${next ? ` · une place de plus au Bastion niveau ${next}` : ''}</span>
      <button class="btn small bs-close" data-action="bastion-close" aria-label="Fermer">✕</button></div>
    <p class="muted">Un ouvrier est un compagnon qui n'est ni dans l'équipe, ni en expédition. Son métier donne +${WORKER_RULES.tradeBonusPct} % dans le bon bâtiment, sa rareté +5 à +20 %.</p>
    ${posts}
    <div class="bs-block"><div class="bs-block-title">Compagnons libres <small>· ${free.length}</small></div>
      ${free.length ? `<div class="bs-free">${free.map((c) => `<span class="bs-freec" title="${escapeHtml(c.name)}"><span class="bs-wpic r-${c.rarity}">${companionStill(c)}</span><small>${escapeHtml(TRADES[tradeOf(c.id)]?.label ?? '')}</small></span>`).join('')}</div>` : '<p class="muted">Tous tes compagnons sont dans l\'équipe, en expédition ou déjà au travail.</p>'}</div>`;
}

function detail(ui, state, now) {
  const sel = ui.view.bastionSel;
  if (sel === 'workers') return workersPanel(state);
  const def = buildingDef(sel);
  if (!def || !buildingAccess(state, def.id).available) return '';
  const head = `<div class="bs-detail-head"><img class="px" src="${ART(`b_${def.art}`)}" alt=""><span class="grow"><b>${escapeHtml(def.name)}</b>${def.existing ? '' : ` <span class="bs-lv">${buildingLevel(state, def.id) < 1 ? 'À construire' : `Niv. ${buildingLevel(state, def.id)}`}</span>`}
      <small>${escapeHtml(def.role)}</small></span><button class="btn small bs-close" data-action="bastion-close" aria-label="Fermer">✕</button></div>`;
  if (def.existing) return `${head}<div class="bs-embed">${expeditionsPanel.render(ui, state)}</div>`;
  const lv = buildingLevel(state, def.id);
  const own = lv < 1 ? '' : def.id === 'forge' ? forgeBlock(ui, state, now)
    : def.id === 'library' ? `<div class="bs-block"><div class="bs-block-title">Recherches <small>· ${bastionOf(state).research.active.length}/${researchSlots(state)} en cours</small></div>
        <button class="btn" data-action="bastion-open" data-value="research">Voir les recherches ↓</button></div>`
      : def.id === 'trade' ? tradeBlock(state) : stockBlock(state, def.id, now);
  return `${head}${workerBlock(ui, state, def)}${def.id === 'forge' ? own : ''}${upgradeBlock(state, def, now)}${def.id === 'forge' ? '' : own}`;
}

// ---------------------------------------------------------------- recherches

function researchTile(ui, state, def, now) {
  const st = researchStatus(state, def.id);
  const sel = ui.view.bastionRes === def.id;
  const cls = `${st.active ? ' active' : ''}${!st.unlocked ? ' locked' : ''}${st.maxed ? ' maxed' : ''}${sel ? ' sel' : ''}`;
  const body = !st.unlocked ? `<small class="bs-lock">🔒 ${escapeHtml(st.lockedBy.name)} niv. ${Math.min(RESEARCH_UNLOCK_LEVEL, st.lockedBy.max)}</small>`
    : st.active ? `${jobBar(st.active, productionFactor(state, 'library'), now, 'work')}<small>${timer(researchRemaining(state, def.id), now)}</small>`
      : `<small class="bs-res-fx">${st.level ? escapeHtml(researchText(def, st.level)) : escapeHtml(def.text)}</small>`;
  return `<button class="bs-res${cls}" data-action="bastion-res" data-value="${def.id}" aria-pressed="${sel}"><b>${escapeHtml(def.name)}</b><span class="bs-res-lv num">${st.level}/${def.max}</span>${body}</button>`;
}

function researchDetail(ui, state, now) {
  const def = RESEARCH.find((r) => r.id === ui.view.bastionRes);
  if (!def) return '';
  const st = researchStatus(state, def.id);
  const head = `<div class="bs-detail-head"><span class="grow"><b>${escapeHtml(def.name)}</b> <span class="bs-lv">Niv. ${st.level}/${def.max}</span><small>${escapeHtml(def.text)} par niveau</small></span></div>`;
  if (st.maxed) return `<div class="bs-res-detail">${head}<p class="good">Niveau maximal : ${escapeHtml(researchText(def, st.level))}.</p></div>`;
  if (!st.unlocked) return `<div class="bs-res-detail">${head}<p class="bs-lock">🔒 Demande ${escapeHtml(st.lockedBy.name)} niveau ${Math.min(RESEARCH_UNLOCK_LEVEL, st.lockedBy.max)}.</p></div>`;
  const f = productionFactor(state, 'library');
  const w = workerOf(state, 'library');
  if (st.active) return `<div class="bs-res-detail">${head}${jobBar(st.active, f, now, 'work')}<span class="bs-line">Niveau ${st.level + 1} en cours · ${timer(researchRemaining(state, def.id), now)}</span></div>`;
  const cost = researchCost(state, def.id);
  const can = canResearch(state, def.id);
  return `<div class="bs-res-detail">${head}
      <div class="bs-fxrow up"><span>Niveau ${st.level} → ${st.level + 1}</span><span>${st.level ? escapeHtml(researchText(def, st.level)) : '—'} → <b class="good">${escapeHtml(researchText(def, st.level + 1))}</b></span></div>
      <div class="bs-costs">${have(cost, state)}${duration(cost.ms, f, w ? companionById(w)?.name : null)}</div>
      <button class="btn btn-gold" data-action="bastion-research" data-value="${def.id}" ${can.ok ? '' : 'disabled'}>Lancer la recherche</button>
      ${can.ok ? '' : `<small class="bs-why">${escapeHtml(can.reason)}</small>`}</div>`;
}

function researchBand(ui, state, now) {
  const lib = buildingLevel(state, 'library');
  const access = buildingAccess(state, 'library');
  const cols = RESEARCH_BRANCHES.map((br) => `<div class="bs-col"><div class="bs-col-head">${img(br.icon)}<b>${br.name}</b></div>
      ${RESEARCH.filter((r) => r.branch === br.id).map((r) => researchTile(ui, state, r, now)).join('')}</div>`).join('');
  const lock = lib >= 1 ? '' : `<p class="bs-lock">${img('icon_lock')} ${access.available ? 'Construis la Bibliothèque pour lancer une recherche.' : `Bibliothèque : ${escapeHtml(access.reason.toLowerCase())}.`}</p>`;
  return `<div class="card bs-research${lib >= 1 ? '' : ' closed'}" id="bs-research"><div class="bs-research-head"><b>Recherches</b>
        <span class="muted">${lib >= 1 ? `${bastionOf(state).research.active.length}/${researchSlots(state)} en cours` : ''}</span></div>
      <p class="muted bs-versus">Les Talents viennent des fragments des Renaissances et sont permanents. Les Recherches avancent avec le temps et ne se perdent pas aux Renaissances.</p>
      ${lock}<div class="bs-cols">${cols}</div>${researchDetail(ui, state, now)}</div>`;
}

// ---------------------------------------------------------------- le Camp (feu, trophées) et l'écran

function campCards(state, open) {
  const team = (state.companions?.equipped ?? []).map(companionById).filter(Boolean);
  const bonds = activeBonds(state);
  const name = state.heroName ? escapeHtml(state.heroName) : 'Ton héros';
  // v9.10 (8) : grande illustration du feu de camp (celle de la Veillée), l'équipe assise autour, en grand.
  const seats = team.map((c, i) => `<span class="camp-unit s${i}" title="${escapeHtml(c.name)}">${img(c.sprite)}</span>`).join('');
  const fire = `<div class="card camp-fire camp-art${open ? ' bs-fire' : ''}"><div class="camp-scene2"><img class="px camp-bg" src="assets/ui/art98/camp_night.png" alt="">
        ${seats}<i class="vg-ember"></i><i class="vg-ember"></i><i class="vg-ember"></i></div>
        <p class="camp-cap">${name} se repose avec ${team.length ? escapeHtml(team.map((c) => c.name).join(', ')) : 'personne pour l\'instant'}.</p></div>`;
  const trophies = `<div class="card"><b>Trophées</b><div class="camp-trophies">
        <span>★ <b>${totalStars(state)}</b> / 36 étoiles</span><span>⚔ Revanche <b>${revengeLevel(state)}</b> / ${REVENGE_STEPS}</span>
        <span>🏆 Musée <b>${Object.keys(state.museum ?? {}).length}</b></span></div></div>`;
  const links = bonds.length ? `<div class="card"><b>Liens actifs</b> ${bonds.map((b) => `<span class="good">${escapeHtml(b.name)}</span>`).join(' · ')}</div>` : '';
  return { fire, trophies, links };
}

function renderCamp(state) {
  const out = (state.expeditions?.slots ?? []).filter(Boolean);
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  const c = campCards(state, false);
  return `<div class="card bs-soon"><img class="px" src="${ART('b_forge')}" alt=""><span><b>Le Bastion ouvre à l'étape ${BASTION_UNLOCK_STAGE}</b>
        <small>Tes compagnons libres y travailleront : une forge, des recherches, des chantiers qui avancent même jeu fermé.</small>
        <span class="bs-bar"><i style="width:${Math.min(100, (best / BASTION_UNLOCK_STAGE) * 100).toFixed(0)}%"></i></span><small class="muted">Étape ${Math.min(best, BASTION_UNLOCK_STAGE)} / ${BASTION_UNLOCK_STAGE}</small></span></div>
      ${c.fire}
      ${c.trophies}
      <div class="card"><b>Expéditions</b> ${out.length ? `<span class="muted">${out.length} en cours</span>` : '<span class="muted">aucune en cours</span>'}</div>
      ${c.links}`;
}

function renderBastion(ui, state) {
  const now = Date.now();
  const sel = ui.view.bastionSel;
  const body = detail(ui, state, now);
  const ready = ordersReady(state).length;
  const c = campCards(state, true);
  return `<div class="bastion${body ? ' has-detail' : ''}">
      <div class="bs-head">
        <button class="bs-chip${sel === 'workers' ? ' on' : ''}" data-action="bastion-open" data-value="workers">${img('tab_companions')}<span>Ouvriers <b class="num">${workersPlaced(state)}/${workerSlots(state)}</b></span></button>
        <span class="bs-chip" data-gloss="gold">${coin()}<b class="num">${formatNumber(Math.floor(state.gold))}</b></span>
        <span class="bs-chip" data-gloss="shards">${shard()}<b class="num">${formatNumber(state.materials.shards)}</b></span>
        <span class="bs-chip lvl">Bastion niv. <b class="num">${bastionLevel(state)}</b></span>
        <span class="bs-always">⏳ Tout avance, même jeu fermé${ready ? ` · <b class="good">${plural(ready, 'commande')} à récupérer</b>` : ''}</span>
      </div>
      <div class="bs-map" style="background-image:url(assets/ui/art98/expedition_map.png)"><div class="bs-grid">${BUILDINGS.map((d) => buildingCard(ui, state, d, now)).join('')}</div></div>
      ${body ? `<div class="card bs-detail" id="bs-detail" data-sel="${escapeHtml(sel)}">${body}</div>` : ''}
      ${researchBand(ui, state, now)}
      ${c.fire}${c.trophies}${c.links}
    </div>`;
}

// ---------------------------------------------------------------- actions

// Ouvre le Bastion sur un bâtiment, les recherches ou les ouvriers (Sceau, Carnet, Forge, Équipement).
export function openBastion(ui, value = null) {
  const b = bastionOf(ui.state);
  const v = ui.view;
  if (b) {
    v.bastionPick = null;
    if (value === 'research') { v.bastionSel = null; v.bastionScroll = 'bs-research'; }
    else if (value === 'workers' || buildingDef(value)) { v.bastionSel = value; v.bastionScroll = 'bs-detail'; }
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
    case 'bastion-open': openBastion(ui, value); break;
    case 'bastion-close': v.bastionSel = null; v.bastionPick = null; redraw(); break;
    case 'bastion-pick': v.bastionPick = v.bastionSel === value && v.bastionPick === value ? null : value; v.bastionSel = value; v.bastionScroll = 'bs-detail'; redraw(); break;
    case 'bastion-worker': { const [building, companion] = value.split('|'); a.bastion('worker', building, companion || null); v.bastionPick = null; break; }
    case 'bastion-build': a.bastion('build', value); break;
    case 'bastion-res': v.bastionRes = v.bastionRes === value ? null : value; redraw(); break;
    case 'bastion-research': a.bastion('research', value); break;
    case 'bastion-slot': v.bastionSlot = value; redraw(); break;
    case 'bastion-tier': v.bastionTier = value; redraw(); break;
    case 'bastion-locked': ui.toast(`🔒 ${value}`, '#ffcf6a'); break;
    case 'bastion-order': { const [slot, tier] = value.split('|'); a.bastion('order', slot, tier); break; }
    case 'bastion-collect': a.bastion('collect', value); break;
    case 'bastion-collect-order': a.bastion('collect-order', Number(value)); break;
    case 'bastion-trade': a.bastion('trade', value); break;
    default: return false;
  }
  return true;
}

// Pastille du menu : ce qui attend au Bastion (commande prête restée dans la file, stock plein).
export function bastionBadge(state) {
  if (!bastionOf(state)) return 0;
  return ordersReady(state).length + ['mine', 'training'].filter((id) => { const p = productionOf(state, id); return p && stockOf(state, id) >= p.cap; }).length;
}

export default {
  id: 'camp',
  title: 'Bastion',
  icon: 'tab_expeditions',
  render(ui, state) {
    return bastionOf(state) ? renderBastion(ui, state) : renderCamp(state);
  },
  afterRender(ui, body) {
    const id = ui.view.bastionScroll;
    if (!id) return;
    ui.view.bastionScroll = null;
    body.querySelector(`#${id}`)?.scrollIntoView({ block: 'nearest' });
  },
  tick,
};
