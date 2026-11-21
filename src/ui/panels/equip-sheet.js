// v10.3 (parties 8 et 9) : la fiche d'objet, toujours visible à côté du personnage (feuille du bas sur téléphone), et
// la section « Renforcer » partagée avec l'atelier 2 de la Forge. Tout est écrit « avant → après », stat nommée, avec
// le coût pièce par pièce (« tu as … » en vert, « il manque … » en rouge et où en gagner).
import { BALANCE } from '../../data/balance.js';
import { BOSSES } from '../../data/enemies.js';
import { BASTION_UNLOCK_STAGE } from '../../data/bastion.js';
import { GEAR_UP_PCT, STAT_NAMES } from '../../data/companion-gear.js';
import { HERO_SLOTS, STAT_LABELS, eqSlot, heroSlot } from '../../data/items.js';
import { MAJOR_EFFECTS } from '../../data/major-effects.js';
import { SET_PIECES } from '../../data/sets.js';
import { bastionOpen, forgeLevel, forgePerks } from '../../core/bastion.js';
import { canEquip, itemClass, weaponClass } from '../../core/classes.js';
import { companionById, skillKillGold } from '../../core/companions.js';
import { bestGearFor, canEquip as unitCanEquip, classLabel, gearScore, gearStats, gearUpgradePreview, slotName, statText, unitGear, wearerOf } from '../../core/companion-gear.js';
import { canAfford, skillUpgradeCost } from '../../core/progression.js';
import { levelForStage } from '../../core/combat.js';
import { formatStat } from '../../core/format.js';
import { WEAK_GAIN_PCT, canReforge, canTargetReroll, sharpenCost, targetRerollChoices, targetRerollCost, upgradeGainPct, upgradePreview } from '../../core/forge.js';
import { KEEP_AFFIX_LABELS, activeMajor, teamUpgradeFor } from '../../core/inventory.js';
import { itemBase, rarityById, recycleLevelOf, recycleMaterials, recycleValue } from '../../core/loot.js';
import { setById, setCounts } from '../../core/sets.js';
import { computeHeroStats, statsWithItem } from '../../core/stats.js';
import { STASH_SIZE } from '../../core/stash.js';
import { itemIconUrl, slotIconName } from '../../render/pixel.js';
import { affixText, coin, distinctTo, effectText, escapeHtml, fold, formatDecimal, formatNumber, icon, img, rarityLabel, shard } from '../common.js';

const STAT_ICONS = { damage: 'weapon_sword', attackSpeed: 'icon_bolt', maxHp: 'icon_heart', armor: 'icon_shield' };
// Une ligne d'aide par place : à quoi sert l'objet qu'on y met.
export const SLOT_TIPS = {
  weapon: 'L\'arme fait tes dégâts et fixe ta vitesse d\'attaque.',
  helmet: 'Le casque ajoute de la vie, parfois de l\'armure.',
  armor: 'L\'armure te fait tenir : beaucoup de vie, et de l\'armure.',
  amulet: 'Le collier donne un effet spécial : critique, régénération, butin ou vol de vie.',
  ring: 'L\'anneau rapporte de l\'or ou frappe plus fort les boss.',
  bracelet: 'Le bracelet renvoie des coups ou frappe plus fort les ennemis ordinaires.',
};
export const UNIT_SLOT_TIPS = {
  weapon: 'L\'arme d\'un compagnon monte son attaque (ou ses soins).',
  armor: 'L\'armure d\'un compagnon monte ses PV et sa défense.',
  accessory: 'L\'accessoire d\'un compagnon mêle attaque, soutien et recharge plus courte.',
};
// Unité écrite après la valeur d'un effet spécial (« 2,4 % », « 3 pts »).
const AFFIX_UNITS = { dropChance: ' pts', regenPct: ' % PV/s' };
const affixName = (type) => KEEP_AFFIX_LABELS[type] ?? 'Effet spécial';
const affixVal = (type, v) => `${formatDecimal(v, 1)}${AFFIX_UNITS[type] ?? ' %'}`;
// Places féminines (« Ce qu'elle donne », « si renforcée »).
const FEM_SLOTS = new Set(['weapon', 'armor']);
export const femSlot = (slot) => FEM_SLOTS.has(slot);
const pctText = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatDecimal(Math.abs(v), Math.abs(v) < 10 ? 1 : 0)} %`;
export { pctText };

// Une amélioration est possible sur ce compagnon (pastille rouge « ! ») : meilleur objet dans le sac, renforcement
// payable d'une pièce portée, ou compétence payable.
export function unitTodo(state, c) {
  const own = state.companions?.owned?.[c.id];
  if (!own) return false;
  if (c.kind === 'ally' && bestGearFor(state, c.id).length) return true;
  const kg = skillKillGold(state);
  if (Object.values(unitGear(state, c.id)).some((it) => it && gearUpgradePreview(state, it, kg).canPay)) return true;
  return ['passive', 'active', 'ultimate'].some((k) => { const cost = skillUpgradeCost(own, k, kg); return cost && canAfford(state, cost); });
}

// Vignette d'objet (cadre à la couleur de la rareté, pastille +N, flèche ▲, cadenas). `tag` : 'div' ou 'button'.
export function itemTile(item, { cls = '', attrs = '', up = false, tag = 'div', note = '' } = {}) {
  return `<${tag} class="eq-tile r-${item.rarity} ${cls}" ${attrs} title="${escapeHtml(item.name)}${item.upgrades ? ` +${item.upgrades}` : ''} · ${rarityLabel(item.rarity)}">
    <img class="px eq-ico" src="${itemIconUrl(item, 48)}" alt="${escapeHtml(item.name)}">${item.upgrades ? `<span class="eq-plusn">+${item.upgrades}</span>` : ''}${up ? '<span class="eq-up" title="Meilleur que l\'objet porté">▲</span>' : ''}${item.locked ? `<img class="px lock" src="${icon('icon_lock', 1)}" alt="Verrouillé">` : ''}${note}</${tag}>`;
}

// Coût pièce par pièce : « tu as … » en vert, ou « il manque … » en rouge avec « Où en gagner » et un bouton « + »
// (carte de glossaire de la ressource : à quoi elle sert, où en gagner, « Y aller »).
export function costLines(state, cost) {
  const line = (key, pic, need, have, word) => {
    const ok = have >= need;
    const lack = Math.ceil(need - have);
    return `<div class="eq-cost ${ok ? 'ok' : 'no'}">${pic}<span class="eq-need num">${formatNumber(need)} ${word(need)}</span>
      ${ok ? `<span class="eq-have good num">tu as ${formatNumber(have)}</span>`
        : `<span class="eq-have bad num">il manque ${formatNumber(lack)}</span><button class="eq-where" data-gloss="${key}">Où en gagner</button><button class="eq-plusbtn" data-gloss="${key}" aria-label="Où en gagner">+</button>`}</div>`;
  };
  return `<div class="eq-costs">${line('gold', coin(), cost.gold, state.gold, () => 'or')}${line('shards', shard(), cost.shards, state.materials.shards, (n) => (n > 1 ? 'éclats' : 'éclat'))}</div>`;
}

// Bandeau rouge « ce qui bloque » : au-delà du renforcement maximal, c'est la Forge du Bastion qui décide.
export function blockBanner(state, max) {
  if (!bastionOpen(state)) return `<div class="eq-block" role="note">Au-delà de +${max} : le Bastion ouvre à l'étape ${BASTION_UNLOCK_STAGE}</div>`;
  return `<button class="eq-block" data-action="bastion-open" data-value="forge">Au-delà de +${max} : Forge du Bastion niveau ${forgeLevel(state) + 1} requise ›</button>`;
}

// Nom et valeur d'une ligne de renfort (statistique ou effet spécial) : « Coup critique », « 12,4 % ».
const rowLabel = (r) => (r.kind === 'stat' ? STAT_LABELS[r.stat] : affixName(r.type));
const rowVal = (r, v) => (r.kind === 'stat' ? formatStat(r.stat, v, true) : affixVal(r.type, v));
// v10.3.1 : ce que gagne la statistique renforcée, en clair : « Coup critique 12,4 % → 13,6 % » (Forge : ligne
// « maintenant » et liste de l'atelier, quand le renfort n'augmente pas la Puissance).
export function statGainText(preview) {
  const named = preview?.rows?.find((r) => r.key === preview.stat);
  return named ? `${rowLabel(named)} ${rowVal(named, named.before)} → ${rowVal(named, named.after)}` : '';
}

// v10.4 : l'aide secondaire se replie derrière un « ? » (ouvert au toucher, sans bouton de plus dans la fiche).
export const helpQ = (text) => `<details class="eq-q"><summary aria-label="Comment ça marche ?">?</summary><p class="eq-rule muted">${text}</p></details>`;

// Section « Renforcer : +N → +N+1 » d'un objet. Même rendu dans la fiche d'objet (Équipement) et dans l'atelier 2 de la
// Forge. Objet du héros : règle de la Forge (core/forge.js upgradePreview, l'aperçu est le résultat exact) ; pièce
// portée par un compagnon : règle des compagnons (core/companion-gear.js gearUpgradePreview).
export function reinforceSection(ui, state, item, { wearer = wearerOf(state, item.id) } = {}) {
  const fem = femSlot(heroSlot(item));
  if (wearer) {
    const p = gearUpgradePreview(state, item, skillKillGold(state));
    if (p.atMax) return `<section class="eq-sec eq-reinf"><h4>Renforcer : <b>+${p.level}</b> <span class="muted">(maximum)</span></h4>
      <p class="muted">Cette pièce est renforcée au maximum pour un compagnon (+${p.max}).</p></section>`;
    const rows = p.rows.map((r) => `<div class="eq-row chg"><span>${STAT_NAMES[r.key]}</span><span class="num muted">${r.key === 'cd' ? '−' : '+'}${formatDecimal(r.before)} %</span><i>→</i><b class="num good">${r.key === 'cd' ? '−' : '+'}${distinctTo(formatDecimal(r.before), formatDecimal(r.after), GEAR_UP_PCT)} %</b></div>`).join('');
    return `<section class="eq-sec eq-reinf"><h4>Renforcer : <b>+${p.level} → +${p.level + 1}</b> <span class="muted">max +${p.max}</span></h4>
      <div class="eq-rows">${rows}</div>${costLines(state, p.cost)}
      <button class="btn btn-gold eq-do" data-action="gear-up" data-value="${item.id}" ${p.canPay ? '' : 'disabled'}>Renforcer +${p.level + 1}</button>
      ${helpQ(`Règle des compagnons : chaque niveau ajoute ${GEAR_UP_PCT} % aux bonus de la pièce.`)}</section>`;
  }
  const p = upgradePreview(state, item);
  if (p.atMax) {
    return `<section class="eq-sec eq-reinf"><h4>Renforcer : <b>+${p.level}</b> <span class="muted">(maximum)</span></h4>
      ${p.max > 0 ? blockBanner(state, p.max) : '<p class="muted">Cet objet ne se renforce pas.</p>'}</section>`;
  }
  const B = BALANCE.forge;
  const named = p.rows.find((r) => r.key === p.stat);
  const label = rowLabel, val = rowVal;
  // v10.4 (partie 2) : seulement les statistiques qui changent (plus de « Coup critique 7 % → 7 % »).
  const rows = p.rows.filter((r) => r.before !== r.after).map((r) => `<div class="eq-row chg"><span>${label(r)}</span><span class="num muted">${val(r, r.before)}</span><i>→</i><b class="num good">${distinctTo(val(r, r.before), val(r, r.after), B.upgradeBoostPct)}</b></div>`).join('');
  // Gain réel : sous 0,5 % de Puissance, on le dit franchement et on propose mieux (jamais « +0,01 % »).
  const gain = upgradeGainPct(p);
  const weak = gain !== null && gain < WEAK_GAIN_PCT;
  const sharpen = weak && !wearer ? sharpenCost(state, item) : 0;
  const pw = !p.power ? '' : weak
    ? `<div class="eq-row pw weak"><span>${img('icon_crown')} Puissance</span><span class="num muted">${formatNumber(p.power.before)}</span><i>→</i><span class="muted">presque pareille</span></div>`
    : `<div class="eq-row chg pw"><span>${img('icon_crown')} Puissance${p.power.worn ? '' : ' (si équipé)'}</span><span class="num muted">${formatNumber(p.power.before)}</span><i>→</i><b class="num good">${distinctTo(formatNumber(p.power.before), formatNumber(p.power.after), (p.power.after / Math.max(1, p.power.before) - 1) * 100)}</b></div>`;
  const better = !weak ? '' : sharpen
    ? `<div class="eq-weak" role="note"><b>Presque sans effet</b> : cet objet est d'un niveau trop bas (${item.level} → ${levelForStage(state.maxStage)}).</div>
      <button class="btn btn-gold eq-do eq-sharpen" data-action="sharpen" data-id="${item.id}" ${state.materials.shards >= sharpen ? '' : 'disabled'}>Remettre au niveau de ton étape (${formatNumber(sharpen)} éclats)</button>`
    : `<div class="eq-weak" role="note"><b>Presque sans effet</b> sur ta puissance : un autre objet ira mieux ici.</div>
      <button class="btn btn-gold eq-do" data-action="forge-go" data-value="craft">Fabriquer un meilleur objet ›</button>`;
  const cut = forgePerks(state).upgradeCostPct;
  const rule = `Règle : chaque niveau ajoute ${B.upgradeBoostPct} % à une statistique (la moins renforcée d'abord). Coût : de l'or, et ${B.upgradeShards} × (niveau + 1) éclats${cut ? ` (−${cut} % grâce à la Forge du Bastion)` : ''}. ${fem ? 'Renforcée' : 'Renforcé'} jusqu'à +${p.max}.`;
  return `<section class="eq-sec eq-reinf${weak ? ' is-weak' : ''}"><h4>Renforcer : <b>+${p.level} → +${p.level + 1}</b> <span class="muted">max +${p.max}</span></h4>${helpQ(rule)}
    ${named ? `<div class="eq-named">Stat renforcée : <b>${label(named)}</b> <span class="good">+${B.upgradeBoostPct} %</span></div>` : ''}
    <div class="eq-rows">${rows}${pw}</div>${better}${costLines(state, p.cost)}
    <button class="btn ${weak ? '' : 'btn-gold '}eq-do" data-action="upgrade-item" data-id="${item.id}" data-cost="${p.cost.gold}" data-currency="gold" ${p.lack.shards ? 'data-locked="1" disabled' : p.lack.gold ? 'disabled' : ''}>Renforcer +${p.level + 1}</button></section>`;
}

// Grand effet de l'objet, et s'il est actif (un seul à la fois).
function majorLine(state, item) {
  const m = MAJOR_EFFECTS[item.major];
  if (!m) return '';
  const act = activeMajor(state);
  const worn = Object.values(state.equipment).some((i) => i?.id === item.id);
  const st = worn ? (act?.id === item.major && state.equipment[act.slot]?.id === item.id ? '<span class="good">actif</span>' : '<span class="bad">inactif : un seul grand effet à la fois</span>')
    : act ? `<span class="muted">remplacerait « ${escapeHtml(MAJOR_EFFECTS[act.id].name)} »</span>` : '';
  return `<div class="eq-major" style="--mc:${m.color}"><b>${escapeHtml(m.name)}</b> — ${escapeHtml(m.text)} ${st}</div>`;
}

// Bonus d'ensemble en clair : « Ensemble Parure du Chasseur 1/6 : à 2 pièces, +40 % dégâts… ».
export function setLine(state, item) {
  const set = setById(item.set);
  if (!set) return '';
  const worn = setCounts(state.equipment)[set.id] ?? 0;
  const max = SET_PIECES.at(-1);
  const next = SET_PIECES.find((n) => n > worn);
  const active = SET_PIECES.filter((n) => n <= worn).map((n) => effectText(set.bonuses[n])).join(' · ');
  return `<div class="eq-set" style="--sc:${set.color}">${img(`set_${set.id}`)}<span><b>Ensemble ${escapeHtml(set.name)} ${worn}/${max}</b> : ${next ? `à ${next} pièces, ${effectText(set.bonuses[next])}` : 'complet'}${active ? `<br><span class="good">Actif : ${active}</span>` : ''}</span></div>`;
}

// Rangée des places en bas de la fiche : passer d'un objet porté à l'autre sans fermer.
function slotStrip(ui, state, ctx) {
  const slots = ctx.unit ? Object.keys(unitGear(state, ctx.unit.id)) : Object.keys(HERO_SLOTS);
  const worn = ctx.unit ? unitGear(state, ctx.unit.id) : state.equipment;
  return `<nav class="eq-strip" aria-label="Places">${slots.map((s) => {
    const it = worn[s];
    const on = it ? it.id === ctx.item?.id : ctx.slot === s && !ctx.item;
    const name = ctx.unit ? slotName(ctx.unit, s) : HERO_SLOTS[s];
    return `<button class="eq-strip-slot${it ? ` r-${it.rarity}` : ' empty'}${on ? ' on' : ''}" data-action="eq-slot" data-value="${s}" aria-pressed="${on}" aria-label="${escapeHtml(name)}" title="${escapeHtml(name)}">
      ${it ? `<img class="px" src="${itemIconUrl(it)}" alt="">${it.upgrades ? `<i>+${it.upgrades}</i>` : ''}` : img(slotIconName(s))}</button>`;
  }).join('')}</nav>`;
}

const closeBtn = '<button class="btn small eq-close" data-action="close-sheet" aria-label="Fermer">✕</button>';
const tipLine = (ctx, slot) => `<p class="eq-tip">${img('icon_book')}<span>${ctx.unit ? UNIT_SLOT_TIPS[slot] : SLOT_TIPS[slot]}</span></p>`;
const shell = (ui, cls, label, body) => `<aside class="eq-sheet ${cls}${ui.view.sheetOpen === 'item' ? ' is-open' : ''}" aria-label="${escapeHtml(label)}">${closeBtn}${body}</aside>`;

// Lignes « Si tu l'équipes » : seulement ce qui change sur le héros.
function compareRows(state, item) {
  const cur = computeHeroStats(state);
  const next = statsWithItem(state, item);
  const row = (label, a, b, fmt, unit = '') => {
    const diff = b - a;
    if (Math.abs(diff) < 0.001) return '';
    return `<div class="eq-row chg"><span>${label}</span><span class="num muted">${fmt(a)}${unit}</span><i>→</i><b class="num ${diff > 0 ? 'good' : 'bad'}">${fmt(b)}${unit}</b></div>`;
  };
  const int = (v) => formatNumber(Math.round(v));
  return [row('Dégâts/s', cur.dps, next.dps, int), row('Vie', cur.maxHp, next.maxHp, int),
    row('Vitesse', cur.attacksPerSecond, next.attacksPerSecond, (v) => formatDecimal(v, 2), '/s'),
    row('Armure', cur.armor, next.armor, (v) => formatDecimal(v), ' %'),
    row('Critique', cur.critChance, next.critChance, (v) => formatDecimal(v), ' %'),
    row('Or', cur.goldPct, next.goldPct, (v) => formatDecimal(v), ' %')].join('');
}

// Fiche d'un objet (porté par le héros, porté par un compagnon, ou dans le sac).
// ctx : { unit (compagnon affiché ou null), item, gains (heroGains), best (bestPerSlot) }.
export function itemSheet(ui, state, ctx) {
  const { item, unit } = ctx;
  const base = itemBase(item.baseId);
  const hslot = heroSlot(item);
  const wearer = wearerOf(state, item.id);
  const heroWorn = state.equipment[hslot]?.id === item.id;
  const worn = heroWorn || Boolean(wearer);
  const wearUnit = wearer ? companionById(wearer) : null;
  const forHero = !wearer && canEquip(state, item);
  const slot = wearUnit || (unit && !heroWorn) ? eqSlot(item) : hslot;
  const place = wearUnit ? slotName(wearUnit, eqSlot(item)) : unit && !heroWorn ? slotName(unit, eqSlot(item)) : HERO_SLOTS[hslot];
  const fem = femSlot(hslot);
  const ups = item.upgrades ?? 0;
  // En-tête : part de la puissance (objet porté), gain si équipé (sac), ou porteur.
  let share = '';
  if (heroWorn) {
    const cur = computeHeroStats(state).combatPower;
    const pct = cur > 0 ? (1 - computeHeroStats(state, BALANCE, { ...state.equipment, [hslot]: null }).combatPower / cur) * 100 : 0;
    share = pct < 0.05 ? '<div class="eq-share muted">Presque rien dans ta puissance totale</div>'
      : `<div class="eq-share good"><b class="num">+${formatDecimal(Math.max(0, pct), pct < 10 ? 1 : 0)} %</b> de ta puissance totale</div>`;
  } else if (wearUnit) {
    share = `<div class="eq-share">Porté par <b>${escapeHtml(wearUnit.name)}</b> : <span class="good">${escapeHtml(statText(gearStats(item, state)))}</span></div>`;
  } else if (unit && unitCanEquip(state, unit.id, item).ok) {
    const cur = unitGear(state, unit.id)[eqSlot(item)];
    const d = gearScore(state, item) - (cur ? gearScore(state, cur) : 0);
    share = `<div class="eq-share ${d > 0 ? 'good' : 'muted'}">Pour ${escapeHtml(unit.name)} : ${escapeHtml(statText(gearStats(item, state)))}</div>`;
  } else if (forHero) {
    const g = ctx.gains?.get(item.id);
    const pct = g?.pct ?? 0;
    share = pct < -5 ? `<div class="eq-share bad">Bien moins ${fem ? 'bonne' : 'bon'} que ${fem ? 'celle' : 'celui'} que tu portes (${pctText(pct)})</div>`
      : `<div class="eq-share ${pct > 0.05 ? 'good' : 'muted'}"><b class="num">${pctText(pct)}</b> de puissance si tu l'équipes</div>`;
  } else {
    const better = teamUpgradeFor(state, item);
    share = `<div class="eq-share ${better ? 'good' : 'muted'}">${better ? `Meilleur pour ${escapeHtml(companionById(better)?.name ?? '')}` : `Pour : ${escapeHtml(item.cls ? classLabel(item.cls) : weaponClass(item.baseId)?.name ?? classLabel(itemClass(state, item)))}`}</div>`;
  }
  const lock = wearer ? '' : `<button class="btn icon-btn eq-lock${item.locked ? ' on' : ''}" data-action="lock" data-id="${item.id}" aria-pressed="${Boolean(item.locked)}" aria-label="${item.locked ? 'Déverrouiller' : 'Verrouiller'}"
      title="${item.locked ? 'Protégé : jamais recyclé ni fusionné (toucher pour retirer la protection)' : 'Protéger : jamais recyclé ni fusionné'}">${img('icon_lock')}</button>`;
  // v10.4 : en-tête court — grande icône, nom sur une ligne, rareté et place (l'aide de la place est au survol).
  const tip = (wearUnit || (unit && !heroWorn) ? UNIT_SLOT_TIPS : SLOT_TIPS)[slot] ?? '';
  const swap = heroWorn ? `<button class="btn small" data-action="eq-change" data-value="1">Changer</button><button class="btn small" data-action="eq-unequip" data-value="${hslot}">Retirer</button>`
    : wearer ? `<button class="btn small" data-action="eq-change" data-value="1">Changer</button><button class="btn small" data-action="gear-unequip" data-value="${wearer}|${eqSlot(item)}">Retirer</button>` : '';
  const head = `<div class="eq-sh-head">${itemTile(item)}
      <div class="eq-sh-id"><b class="eq-name r-${item.rarity}" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}${ups ? ` +${ups}` : ''}</b>
        <div class="eq-pills"><span class="rar-pill r-${item.rarity}">${rarityById(item.rarity).label}</span><span class="role-pill" title="${escapeHtml(tip)}">${escapeHtml(place)}</span>${base.signature ? `<span class="role-pill" title="Butin de ${escapeHtml(BOSSES[base.signature].name)}">Ancestral</span>` : ''}</div>
        ${share}</div><div class="eq-head-acts">${lock}${swap}</div></div>`;
  // « Ce qu'elle donne » : chaque statistique et chaque effet spécial, en clair.
  const stats = Object.entries(item.stats).map(([k, v]) => `<li>${img(STAT_ICONS[k])}<span>${STAT_LABELS[k]}</span><b class="num ${v < 0 ? 'bad' : ''}">${formatStat(k, v, true)}</b></li>`).join('');
  const affixes = (item.affixes ?? []).map((a) => `<li class="affix"><i>✦</i><span>${affixText(a)}</span></li>`).join('');
  const unitGives = wearUnit || (unit && !heroWorn) ? `<li class="affix"><i>✦</i><span>Sur un compagnon : ${escapeHtml(statText(gearStats(item, state))) || 'aucun bonus'}</span></li>` : '';
  const lvlNow = levelForStage(state.maxStage);
  const gives = `<section class="eq-sec"><h4>${fem ? 'Ce qu\'elle donne' : 'Ce qu\'il donne'}</h4>
      <ul class="eq-stats">${stats}${affixes}${unitGives}<li class="eq-ilvl">${img('icon_upgrade')}<span>Niveau d'objet</span><b class="num">${item.level}</b></li></ul>
      ${majorLine(state, item)}${setLine(state, item)}
      ${base.signature ? '<p class="muted">Objet ancestral : exposé au Musée, il donne son bonus même sans être porté.</p>' : ''}</section>`;
  // Objet du sac : ce qui change si on l'équipe, puis Équiper / Recycler.
  let bagBlock = '';
  if (!worn) {
    const mats = recycleMaterials(item);
    const target = unit && unitCanEquip(state, unit.id, item).ok ? unit : !forHero ? companionById(teamUpgradeFor(state, item)) : null;
    const worse = forHero && !target && (ctx.gains?.get(item.id)?.pct ?? 0) < -5;
    const equipBtn = target ? `<button class="btn btn-gold" data-action="gear-equip" data-value="${target.id}|${item.id}">Équiper sur ${escapeHtml(target.name)}</button>`
      : forHero ? `<button class="btn${worse ? '' : ' btn-gold'}" data-action="equip" data-id="${item.id}">Équiper</button>`
      : `<button class="btn" disabled>Pour : ${escapeHtml(item.cls ? classLabel(item.cls) : weaponClass(item.baseId)?.name ?? '')}</button>`;
    const cmp = forHero && !target ? compareRows(state, item) : '';
    const stashFull = state.stash.length >= STASH_SIZE;
    bagBlock = `<section class="eq-sec">${cmp ? `<h4>Si tu l'équipes${state.equipment[hslot] ? ` à la place de ${escapeHtml(state.equipment[hslot].name)}` : ''}</h4><div class="eq-rows">${cmp}</div>` : ''}
      <div class="eq-actions col">${equipBtn}<button class="btn${worse ? ' btn-gold' : ''}" data-action="recycle" data-id="${item.id}" ${item.locked ? 'disabled' : ''}>Recycler +${formatNumber(recycleValue(item, BALANCE, recycleLevelOf(state)))} ${coin()}${mats.shards ? ` +${mats.shards} ${shard()}` : ''}</button></div>
      <div class="eq-actions minor"><button class="btn small" data-action="to-stash" data-id="${item.id}" ${stashFull ? 'disabled' : ''}>Ranger dans la Réserve</button>${base.signature ? `<button class="btn small btn-gold" data-action="to-museum" data-id="${item.id}">Exposer au Musée</button>` : ''}</div></section>`;
  }
  // « Mieux dans ton sac » : le meilleur objet de la même place, son gain, et Équiper.
  let better = '';
  if (heroWorn && ctx.best?.[hslot]) {
    const b = ctx.best[hslot];
    better = `<section class="eq-sec eq-better"><h4>Mieux dans ton sac</h4><div class="eq-pick">${itemTile(b.item, { tag: 'button', attrs: `data-action="select-item" data-id="${b.item.id}"`, up: true })}
      <span class="eq-pick-id"><b class="r-${b.item.rarity} rarity-text">${escapeHtml(b.item.name)}</b><small class="good num">${pctText(b.pct)} de puissance</small></span>
      <button class="btn btn-gold" data-action="equip" data-id="${b.item.id}">Équiper</button></div></section>`;
  } else if (wearUnit) {
    const cands = state.inventory.filter((i) => eqSlot(i) === eqSlot(item) && unitCanEquip(state, wearUnit.id, i).ok).sort((a, b) => gearScore(state, b) - gearScore(state, a));
    if (cands[0] && gearScore(state, cands[0]) > gearScore(state, item)) {
      better = `<section class="eq-sec eq-better"><h4>Mieux dans ton sac</h4><div class="eq-pick">${itemTile(cands[0], { tag: 'button', attrs: `data-action="select-item" data-id="${cands[0].id}"`, up: true })}
        <span class="eq-pick-id"><b class="r-${cands[0].rarity} rarity-text">${escapeHtml(cands[0].name)}</b><small class="good">${escapeHtml(statText(gearStats(cands[0], state)))}</small></span>
        <button class="btn btn-gold" data-action="gear-equip" data-value="${wearUnit.id}|${cands[0].id}">Équiper</button></div></section>`;
    }
  }
  // Outils : Changer l'effet, Remettre au niveau (avec sa phrase d'aide), Changer, Retirer.
  let tools = '';
  if (!wearer) {
    const sharpen = sharpenCost(state, item);
    const shards = state.materials.shards;
    const reforgeOk = canReforge(item);
    let target = '';
    if (canTargetReroll(item)) {
      const choices = targetRerollChoices(item);
      const sel = choices.includes(ui.view.rerollType) ? ui.view.rerollType : choices[0];
      const cost = targetRerollCost(item);
      const armed = ui.view.rerollArmed === `${item.id}|${sel}`;
      target = `<details class="eq-target"><summary>Choisir l'effet voulu (${cost} éclats)</summary><div class="eq-target-row"><select data-action="reroll-type" aria-label="Effet voulu">${choices.map((t) => `<option value="${t}"${t === sel ? ' selected' : ''}>${escapeHtml(KEEP_AFFIX_LABELS[t] ?? t)}</option>`).join('')}</select>
        <button class="btn small${armed ? ' btn-gold' : ''}" data-action="target-reroll" data-id="${item.id}" data-value="${sel}" ${shards < cost ? 'disabled' : ''}>${armed ? 'Confirmer' : 'Relancer vers cet effet'}</button></div>
        <p class="muted">${item.rarity === 'legendary' ? 'Impose la 1re ligne d\'effet (les autres au hasard).' : 'Impose l\'effet spécial.'} Valeur à ±20 %.</p></details>`;
    }
    tools = `<section class="eq-sec eq-tools">${fold(ui, 'eq-more', 'Plus : changer l\'effet, remettre au niveau', () => `
      <button class="eq-tool" data-action="reforge" data-id="${item.id}" ${reforgeOk && shards >= BALANCE.forge.reforgeShards ? '' : 'disabled'}>${img('icon_star')}<span><b>Changer l'effet (${BALANCE.forge.reforgeShards} éclats)</b><small>${reforgeOk ? 'Retire de nouveaux effets spéciaux au hasard. Les statistiques ne changent pas.' : 'Cet objet n\'a pas d\'effet spécial à changer.'}</small></span></button>
      ${target}
      <button class="eq-tool" data-action="sharpen" data-id="${item.id}" ${sharpen && shards >= sharpen ? '' : 'disabled'}>${img('icon_shard')}<span><b>${sharpen ? `Remettre au niveau de ton étape (${formatNumber(sharpen)} éclats)` : 'Remettre au niveau de ton étape'}</b>
        <small>${sharpen ? `Niveau d'objet ${item.level} → ${lvlNow} : ses statistiques rattrapent ton étape ${state.maxStage}, les renforts sont gardés.` : `Déjà au niveau de ton étape (${lvlNow}). Quand tu avances, un vieil objet peut rattraper son retard ici.`}</small></span></button>
`)}</section>`;
  }
  // v10.4 (partie 1) : ce qui sert d'abord, sans défiler — objet porté : mieux dans le sac, Renforcer ; objet du sac :
  // Équiper / Recycler. Ensuite ce que l'objet donne, puis « Plus » (replié).
  const reinf = reinforceSection(ui, state, item, { wearer });
  const body = worn ? `${head}${better}${reinf}${gives}` : `${head}${bagBlock}${gives}${reinf}`;
  return shell(ui, `r-${item.rarity}`, item.name, `${body}${tools}${slotStrip(ui, state, ctx)}`);
}

// Place vide : les objets compatibles du sac, triés par gain, « Équiper le meilleur » en tête.
export function emptySlotSheet(ui, state, ctx) {
  const { unit, slot } = ctx;
  const name = unit ? slotName(unit, slot) : HERO_SLOTS[slot];
  let rows, bestBtn = '';
  if (unit) {
    const cands = state.inventory.filter((i) => eqSlot(i) === slot && unitCanEquip(state, unit.id, i).ok).sort((a, b) => gearScore(state, b) - gearScore(state, a)).slice(0, 12);
    if (cands[0]) bestBtn = `<button class="btn btn-gold eq-do" data-action="gear-equip" data-value="${unit.id}|${cands[0].id}">Équiper le meilleur</button>`;
    rows = cands.map((i) => `<div class="eq-pick">${itemTile(i, { tag: 'button', attrs: `data-action="select-item" data-id="${i.id}"` })}
      <span class="eq-pick-id"><b class="r-${i.rarity} rarity-text">${escapeHtml(i.name)}</b><small class="good">${escapeHtml(statText(gearStats(i, state)))}</small></span>
      <button class="btn small" data-action="gear-equip" data-value="${unit.id}|${i.id}">Équiper</button></div>`).join('');
  } else {
    const cands = state.inventory.filter((i) => ctx.gains?.get(i.id)?.slot === slot).sort((a, b) => ctx.gains.get(b.id).pct - ctx.gains.get(a.id).pct).slice(0, 12);
    if (cands[0]) bestBtn = `<button class="btn btn-gold eq-do" data-action="equip" data-id="${cands[0].id}">Équiper le meilleur</button>`;
    rows = cands.map((i) => `<div class="eq-pick">${itemTile(i, { tag: 'button', attrs: `data-action="select-item" data-id="${i.id}"` })}
      <span class="eq-pick-id"><b class="r-${i.rarity} rarity-text">${escapeHtml(i.name)}</b><small class="good num">${pctText(ctx.gains.get(i.id).pct)} de puissance</small></span>
      <button class="btn small" data-action="equip" data-id="${i.id}">Équiper</button></div>`).join('');
  }
  const none = `<p class="muted">Aucun objet pour cette place dans ton sac. Les monstres en laissent tomber ; tu peux aussi en fabriquer un à la Forge.</p>
    <button class="btn" data-action="forge-go" data-value="craft">Fabriquer à la Forge ›</button>`;
  return shell(ui, 'empty', name, `${tipLine(ctx, slot)}<div class="eq-sh-head"><div class="eq-tile empty">${img(slotIconName(slot))}</div>
      <div class="eq-sh-id"><b class="eq-name">${escapeHtml(name)} : place vide</b><div class="muted">Les objets compatibles de ton sac, le plus fort en premier.</div></div></div>
    <section class="eq-sec">${bestBtn}${rows || none}</section>${slotStrip(ui, state, ctx)}`);
}

// « Changer » : l'objet porté en haut, puis les objets du sac de la même place (le porté marqué « Équipé »),
// des filtres par ensemble, et une case « + » qui mène à la Forge (Fabriquer).
export function changeSheet(ui, state, ctx) {
  const { item, unit } = ctx;
  const wearer = wearerOf(state, item.id);
  const wearUnit = wearer ? companionById(wearer) : null;
  const hslot = heroSlot(item);
  const cands = wearUnit
    ? state.inventory.filter((i) => eqSlot(i) === eqSlot(item) && unitCanEquip(state, wearUnit.id, i).ok).sort((a, b) => gearScore(state, b) - gearScore(state, a))
    : state.inventory.filter((i) => ctx.gains?.get(i.id)?.slot === hslot).sort((a, b) => ctx.gains.get(b.id).pct - ctx.gains.get(a.id).pct);
  const sets = [...new Set(cands.map((i) => i.set).filter((s) => s && setById(s)))];
  const f = sets.includes(ui.view.eqSetFilter) ? ui.view.eqSetFilter : null;
  const shown = (f ? cands.filter((i) => i.set === f) : cands).slice(0, 23);
  const gainNote = (i) => (wearUnit ? '' : `<small class="eq-gain ${ctx.gains.get(i.id).pct > 0 ? 'good' : 'bad'}">${pctText(ctx.gains.get(i.id).pct)}</small>`);
  const place = wearUnit ? slotName(wearUnit, eqSlot(item)) : HERO_SLOTS[hslot];
  const filters = sets.length ? `<div class="eq-setf" role="group" aria-label="Ensemble"><button class="btn chip-btn small${f ? '' : ' active'}" data-action="eq-setf" data-value="">Tous</button>${sets.map((s) => `<button class="btn chip-btn small${f === s ? ' active' : ''}" data-action="eq-setf" data-value="${s}">${img(`set_${s}`)} ${escapeHtml(setById(s).name)}</button>`).join('')}</div>` : '';
  return shell(ui, `r-${item.rarity}`, `Changer : ${place}`, `<div class="eq-sh-head">${itemTile(item, { note: '<span class="eq-worn">Équipé</span>' })}
      <div class="eq-sh-id"><b class="eq-name r-${item.rarity}">${escapeHtml(item.name)}${item.upgrades ? ` +${item.upgrades}` : ''}</b><div class="muted">Changer : ${escapeHtml(place)}. Touche un objet pour voir ce qu'il apporte.</div></div>
      <button class="btn small" data-action="eq-change" data-value="">← Retour</button></div>
    <section class="eq-sec"><div class="eq-change-grid">${shown.map((i) => itemTile(i, { tag: 'button', attrs: `data-action="select-item" data-id="${i.id}"`, up: !wearUnit && ctx.gains.get(i.id).up, note: gainNote(i) })).join('')}
      <button class="eq-tile eq-more" data-action="forge-go" data-value="craft" aria-label="Fabriquer un objet à la Forge" title="Fabriquer un objet à la Forge">+</button></div>
      ${shown.length ? '' : '<p class="muted">Aucun autre objet pour cette place dans ton sac. La case « + » mène à la Forge.</p>'}${filters}</section>${slotStrip(ui, state, ctx)}`);
}
