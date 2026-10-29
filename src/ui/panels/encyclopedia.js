// Encyclopédie (v9.0.5) : bestiaire, boss, mutations, équipements (une entrée par rareté) et compagnons.
// Ce qui n'a pas encore été découvert apparaît en silhouette « ??? ». Chaque entrée a sa fiche détaillée.
import { BALANCE } from '../../data/balance.js';
import { ALLY_GRADE, COMPANIONS } from '../../data/companions.js';
import { DUNGEONS } from '../../data/dungeons.js';
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { RARITIES, SIGNATURE_ITEMS, SLOTS, STAT_LABELS, PERCENT_STATS, ITEM_BASES } from '../../data/items.js';
import { BOSS_LORE } from '../../data/lore.js';
import { bossTrait } from '../../core/boss-traits.js';
import { ZONES } from '../../data/zones.js';
import { MULTIPLICATIVE } from '../../core/companions.js';
import {
  ENCYCLOPEDIA_MILESTONES, ENCYCLOPEDIA_SECTIONS, MONSTER_VARIANTS, SIGNATURE_RARITIES, encyclopediaNext,
  encyclopediaProgress, variantFound,
} from '../../core/encyclopedia.js';
import { itemBase, itemStatValue, rarityById } from '../../core/loot.js';
import { MUTATIONS, MUTATION_RULES, mutationChance } from '../../core/mutations.js';
import { rewardText } from '../../core/rewards.js';
import { itemIconUrl } from '../../render/pixel.js';
import { animCanvas } from '../animator.js';
import { AFFIXES } from '../../data/items.js';
import { effectText, escapeHtml, formatNumber, icon, img, progressBar, rarityLabel, stars } from '../common.js';

const SHADOW = { tint: { color: '#2e3a52', alpha: 1 } };
const TIERS = { mini: 'Mini-boss', mid: 'Boss', hard: 'Boss redoutable', dungeon: 'Boss de donjon' };
const pct = (n) => `${(Math.floor(n * 10) / 10).toString().replace('.', ',')} %`;
const enemySprite = (id) => ENEMIES[id]?.sprite ?? BOSSES[id]?.sprite ?? ENEMIES[BOSSES[id]?.base]?.sprite;

function zonesOf(enemyId) {
  return ZONES.filter((z) => z.enemies?.includes(enemyId)).map((z) => z.name);
}

function bossWhere(id) {
  const zone = ZONES.find((z) => !z.gauntlet && (z.bosses.includes(id) || Object.values(z.tierBosses ?? {}).includes(id)));
  const dungeon = DUNGEONS.find((d) => d.boss === id);
  const out = [];
  if (zone) out.push(zone.name);
  if (dungeon) out.push(`Donjon « ${dungeon.name} »`);
  out.push('Tour de l\'Éternité');
  return out;
}

// --- Listes ---------------------------------------------------------------------------------------------
function cell(sel, key, known, pic, label, extra = '') {
  return `<button class="enc-cell${known ? '' : ' unknown'}${sel === key ? ' selected' : ''}${extra}" data-action="enc-sel" data-value="${key}"
    title="${known ? escapeHtml(label) : '???'}">${pic}<small>${known ? escapeHtml(label) : '???'}</small></button>`;
}

function spritePic(sprite, known, scale = 1) {
  return `<img class="px" src="${icon(sprite, scale, known ? {} : SHADOW)}" alt="">`;
}

function monsterList(state, sel) {
  return `<div class="enc-grid">${Object.entries(ENEMIES).map(([id, e]) => {
    const n = MONSTER_VARIANTS.filter((v) => variantFound(state, id, v.id)).length;
    const dots = MONSTER_VARIANTS.map((v) => `<i class="${variantFound(state, id, v.id) ? `on v-${v.id}` : ''}"></i>`).join('');
    return cell(sel, `m:${id}`, n > 0, `${spritePic(e.sprite, n > 0, 2)}<span class="enc-dots">${dots}</span>`, e.name);
  }).join('')}</div>`;
}

function bossList(state, sel) {
  const groups = [['mega', 'Méga boss'], ['mini', 'Mini-boss'], ['mid', 'Boss'], ['hard', 'Boss redoutables'], ['dungeon', 'Boss de donjon']];
  return groups.map(([tier, label]) => {
    const ids = Object.keys(BOSSES).filter((id) => (BOSSES[id].tier ?? 'mega') === tier);
    return `<div class="enc-group">${label}</div><div class="enc-grid big">${ids.map((id) => {
      const known = Boolean(state.codex.kills[id]);
      return cell(sel, `b:${id}`, known, spritePic(enemySprite(id), known), BOSSES[id].name);
    }).join('')}</div>`;
  }).join('');
}

// Un monstre représentatif de chaque mutation, cerné de la couleur de la mutation (comme en combat).
const MUTATION_LOOK = { split: 'slime', regen: 'mushroom_green', armored: 'skeleton_shield', frenzied: 'wolf', vampire: 'bat', giant: 'ogre' };
function mutantPic(m, known, scale = 2) {
  const sprite = ENEMIES[MUTATION_LOOK[m.id]]?.sprite ?? 'slime';
  return known ? `<img class="px enc-mutant" style="--mut:${m.color}" src="${icon(sprite, scale)}" alt="">` : spritePic(sprite, false, scale);
}

function mutationList(state, sel) {
  return `<div class="enc-grid big">${MUTATIONS.map((m) => {
    const known = Boolean(state.codex.mutants[m.id]);
    return cell(sel, `x:${m.id}`, known, mutantPic(m, known), m.name);
  }).join('')}</div>`;
}

// Équipements : une ligne par modèle, une case par rareté (chaque case est une entrée).
function itemList(state, sel, slot) {
  const bases = [...ITEM_BASES, ...SIGNATURE_ITEMS].filter((b) => slot === 'all' || b.slot === slot);
  const filters = ['all', ...Object.keys(SLOTS)].map((s) => `<button class="chip chip-btn${slot === s ? ' active' : ''}" data-action="enc-slot" data-value="${s}">${s === 'all' ? 'Tous' : SLOTS[s]}</button>`).join('');
  const rows = bases.map((b) => {
    const anyKnown = RARITIES.some((r) => state.codex.itemRar[`${b.id}:${r.id}`]);
    const cells = RARITIES.map((r) => {
      if (b.signature && !SIGNATURE_RARITIES.includes(r.id)) return '<span class="enc-item none"></span>';
      const key = `i:${b.id}:${r.id}`;
      const known = Boolean(state.codex.itemRar[`${b.id}:${r.id}`]);
      const pic = `<img class="px${known ? '' : ' enc-shadow'}" src="${itemIconUrl({ baseId: b.id, rarity: r.id, slot: b.slot })}" alt="">`;
      return `<button class="enc-item r-${r.id}${known ? '' : ' unknown'}${sel === key ? ' selected' : ''}" data-action="enc-sel" data-value="${key}"
        title="${known ? `${escapeHtml(b.name)} · ${r.label}` : `??? · ${r.label}`}">${pic}</button>`;
    }).join('');
    return `<div class="enc-item-row"><span class="enc-item-name${anyKnown ? '' : ' muted'}">${anyKnown ? escapeHtml(b.name) : '???'}${b.signature ? ' <span class="gold-text">✦</span>' : ''}</span>${cells}</div>`;
  }).join('');
  const head = `<div class="enc-legend muted">Une case par rareté : ${RARITIES.map((r) => `<b class="rarity-text r-${r.id}">${r.label}</b>`).join(' · ')} — <span class="gold-text">✦</span> objet ancestral (Épique ou Légendaire)</div>`;
  return `<div class="row wrap enc-filters">${filters}</div>${head}<div class="enc-items">${rows}</div>`;
}

function companionList(state, sel) {
  const groups = [['pet', 'Familiers'], ['ally', 'Compagnons']];
  return groups.map(([kind, label]) => `<div class="enc-group">${label}</div><div class="enc-grid big">${COMPANIONS.filter((c) => (c.kind === 'ally') === (kind === 'ally')).map((c) => {
    const known = Boolean(state.companions.owned[c.id]);
    return cell(sel, `c:${c.id}`, known, spritePic(c.sprite, known, c.kind === 'ally' ? 2 : 3), c.name, ` r-${c.rarity}`);
  }).join('')}</div>`).join('');
}

// --- Fiches ---------------------------------------------------------------------------------------------
function unknownCard(hint, pic = '') {
  return `<div class="enc-card unknown"><div class="enc-portrait">${pic}</div><div class="enc-title">???</div>
    <p class="muted">${hint}</p></div>`;
}

function statRow(label, value) {
  return `<div class="enc-stat"><span class="muted">${label}</span><b>${value}</b></div>`;
}

function monsterCard(state, id) {
  const e = ENEMIES[id];
  const known = MONSTER_VARIANTS.some((v) => variantFound(state, id, v.id));
  const where = zonesOf(id);
  if (!known) return unknownCard(`Se rencontre : ${where.join(', ') || 'quelque part'}. Vainquez-le pour le découvrir.`, spritePic(e.sprite, false, 3));
  const variants = MONSTER_VARIANTS.map((v) => {
    const got = variantFound(state, id, v.id);
    const how = { normal: 'le vaincre une fois', elite: 'vaincre sa version Élite (événement « Élite errante »)', mutant: 'vaincre une version mutée (à partir du monde 2)' }[v.id];
    return `<div class="enc-variant${got ? ' got' : ''}"><b class="v-${v.id}">${v.label}</b> ${got ? '<span class="good">✔ découvert</span>' : `<span class="muted">${how}</span>`}</div>`;
  }).join('');
  return `<div class="enc-card"><div class="enc-portrait">${animCanvas(`foe:${e.sprite}`, 96, 72, 2)}</div>
    <div class="enc-title">${escapeHtml(e.name)}</div><div class="muted">📍 ${escapeHtml(where.join(', '))}</div>
    <div class="enc-stats">${statRow('Vaincus', formatNumber(state.codex.kills[id] ?? 0))}${statRow('Élites vaincues', formatNumber(state.codex.elite[id] ?? 0))}
      ${statRow('PV de base', e.hp)}${statRow('Dégâts de base', e.damage)}${statRow('Vitesse', e.speed)}${statRow('Attaque toutes les', `${String(e.attackInterval).replace('.', ',')} s`)}
      ${e.flyHeight ? statRow('Type', 'Volant') : ''}</div>
    <div class="section-title">Variantes</div>${variants}</div>`;
}

function bossCard(state, id) {
  const b = BOSSES[id];
  const known = Boolean(state.codex.kills[id]);
  const tier = TIERS[b.tier] ?? 'Méga boss';
  const where = bossWhere(id);
  if (!known) return unknownCard(`${tier}. Se rencontre : ${where.join(', ')}.`, spritePic(enemySprite(id), false, 1));
  const sig = SIGNATURE_ITEMS.find((s) => s.signature === id);
  return `<div class="enc-card"><div class="enc-portrait">${animCanvas(`foe:${enemySprite(id)}`, 140, 96, 1)}</div>
    <div class="enc-title">${escapeHtml(b.name)}</div><div class="badge-ancestral">${tier}</div>
    <div class="muted">📍 ${escapeHtml(where.join(' · '))}</div>
    ${BOSS_LORE[id] ? `<p class="lore">${escapeHtml(BOSS_LORE[id])}</p>` : ''}
    ${bossTrait(id) ? `<div class="trait-box" style="--trait:${bossTrait(id).color}"><b>${escapeHtml(bossTrait(id).name)}</b> : ${escapeHtml(bossTrait(id).text)}.<div class="muted">Contre : ${escapeHtml(bossTrait(id).counter)}</div></div>` : ''}
    <div class="enc-stats">${statRow('Vaincu', `${formatNumber(state.codex.kills[id])} fois`)}${statRow('Inspiré du', escapeHtml(ENEMIES[b.base]?.name ?? '—'))}
      ${sig ? statRow('Objet ancestral', `<span class="rarity-text r-legendary">${escapeHtml(sig.name)}</span>`) : ''}</div></div>`;
}

function mutationCard(state, id) {
  const m = MUTATIONS.find((x) => x.id === id);
  const known = Boolean(state.codex.mutants[id]);
  const chance = mutationChance(state);
  const rule = `Chance qu'un monstre ordinaire soit muté : ${pct(chance * 100)} actuellement (${pct(MUTATION_RULES.chance * 100)} sans Transcendance, +${pct(MUTATION_RULES.chancePerTranscend * 100)} par Transcendance, ${pct(MUTATION_RULES.maxChance * 100)} au plus ; à partir du monde 2).`;
  if (!known) return unknownCard(`Vainquez un monstre porteur de cette mutation. ${rule}`, mutantPic(m, false, 4));
  return `<div class="enc-card"><div class="enc-portrait">${mutantPic(m, true, 4)}</div>
    <div class="enc-title" style="color:${m.color}">${escapeHtml(m.name)}</div>
    <p>Le monstre ${escapeHtml(m.text)}.</p>
    <div class="enc-stats">${statRow('Vaincus', formatNumber(state.codex.mutants[id]))}${statRow('PV', `×${String(MUTATION_RULES.hpMultiplier).replace('.', ',')}`)}
      ${statRow('Or', `×${MUTATION_RULES.goldMultiplier}`)}${statRow('Butin', 'objet garanti')}</div>
    <p class="muted">${rule}</p></div>`;
}

function itemCard(state, baseId, rarity) {
  const b = itemBase(baseId);
  const r = rarityById(rarity);
  const known = Boolean(state.codex.itemRar[`${baseId}:${rarity}`]);
  const how = b.signature ? `Objet ancestral de ${escapeHtml(BOSSES[b.signature]?.name ?? 'un boss')} (${Math.round(BALANCE.loot.signatureChance * 100)} % par victoire).`
    : rarity === 'legendary' ? 'Très rare : boss, coffres, donjons et Tour augmentent vos chances.' : 'Se ramasse sur les monstres, les boss et dans les coffres.';
  if (!known) {
    return unknownCard(`${SLOTS[b.slot]} · <span class="rarity-text r-${rarity}">${r.label}</span>. ${how}`,
      `<div class="item-frame r-${rarity} enc-big-frame"><img class="px enc-shadow" src="${itemIconUrl({ baseId, rarity, slot: b.slot }, 64)}" alt=""></div>`);
  }
  const stats = Object.entries(b.stats ?? {}).map(([k, v]) => statRow(STAT_LABELS[k], `${formatNumber(itemStatValue(k, v, r, 1))}${PERCENT_STATS.has(k) ? ' %' : ''}`)).join('');
  const main = b.mainAffix ? statRow('Effet principal', AFFIXES[b.mainAffix.type].label(Math.round(b.mainAffix.base * r.statMultiplier * 10) / 10)) : '';
  const fixed = (b.affixes ?? []).map((a) => `<div class="good">${AFFIXES[a.type].label(a.value)}</div>`).join('');
  const others = RARITIES.filter((x) => !b.signature || SIGNATURE_RARITIES.includes(x.id)).map((x) => {
    const got = state.codex.itemRar[`${baseId}:${x.id}`];
    return `<button class="enc-item r-${x.id}${got ? '' : ' unknown'}${x.id === rarity ? ' selected' : ''}" data-action="enc-sel" data-value="i:${baseId}:${x.id}" title="${x.label}">
      <img class="px${got ? '' : ' enc-shadow'}" src="${itemIconUrl({ baseId, rarity: x.id, slot: b.slot })}" alt=""></button>`;
  }).join('');
  return `<div class="enc-card"><div class="enc-portrait"><div class="item-frame r-${rarity} enc-big-frame"><img class="px" src="${itemIconUrl({ baseId, rarity, slot: b.slot }, 64)}" alt=""></div></div>
    <div class="enc-title rarity-text r-${rarity}">${escapeHtml(b.name)}</div>
    <div class="muted">${SLOTS[b.slot]} · <span class="rarity-text r-${rarity}">${r.label}</span>${b.signature ? ' · <span class="gold-text">objet ancestral</span>' : ''}</div>
    <div class="enc-stats">${stats}${main}${statRow('Puissance', `×${String(r.statMultiplier).replace('.', ',')}`)}</div>${fixed}
    <p class="muted">Valeurs au niveau 1 ; elles grandissent avec le niveau de l'objet. ${rarity !== 'common' && !b.signature ? 'Effets spéciaux tirés au hasard en plus.' : ''} ${how}</p>
    <div class="section-title">Raretés</div><div class="row">${others}</div></div>`;
}

function companionCard(state, id) {
  const c = COMPANIONS.find((x) => x.id === id);
  const owned = state.companions.owned[id];
  const grade = c.kind === 'ally' ? ALLY_GRADE[c.rarity] : rarityLabel(c.rarity);
  if (!owned) return unknownCard(`${c.kind === 'ally' ? 'Compagnon' : 'Familier'} ${grade}. S'obtient par l'Invocation.`, spritePic(c.sprite, false, c.kind === 'ally' ? 2 : 4));
  const passive = Object.fromEntries(Object.entries(c.passive).map(([k, v]) => [MULTIPLICATIVE[k] ?? k, v]));
  return `<div class="enc-card"><div class="enc-portrait">${c.kind === 'ally' ? animCanvas(`foe:${c.sprite}`, 96, 72, 2) : animCanvas(`pet:${c.sprite}`, 64, 56, 3)}</div>
    <div class="enc-title rarity-text r-${c.rarity}">${escapeHtml(c.name)}</div>
    <div class="muted">${c.kind === 'ally' ? 'Compagnon' : 'Familier'} · <b class="rarity-text r-${c.rarity}">${grade}</b> · ${stars(owned.stars ?? 0, BALANCE.summon.maxStars)}</div>
    <div class="enc-stats">${statRow('Niveau', owned.level ?? 1)}${statRow('Passif (niv. 1)', effectText(passive))}
      ${statRow('Compétence', escapeHtml(c.skill?.name ?? '—'))}</div>
    ${c.skill?.text ? `<p class="muted">${escapeHtml(c.skill.text)}.</p>` : ''}
    <p class="muted">À 5 étoiles, une aura de flammes à ses couleurs l'entoure en combat.</p></div>`;
}

function detail(state, key) {
  const [kind, a, b] = key.split(':');
  switch (kind) {
    case 'm': return ENEMIES[a] ? monsterCard(state, a) : '';
    case 'b': return BOSSES[a] ? bossCard(state, a) : '';
    case 'x': return mutationCard(state, a);
    case 'i': return itemBase(a) ? itemCard(state, a, b) : '';
    case 'c': return companionCard(state, a);
    default: return '';
  }
}

const FIRST = {
  monsters: () => `m:${Object.keys(ENEMIES)[0]}`,
  bosses: () => `b:${Object.keys(BOSSES).find((id) => !BOSSES[id].tier)}`,
  mutations: () => `x:${MUTATIONS[0].id}`,
  items: () => `i:${ITEM_BASES[0].id}:common`,
  companions: () => `c:${COMPANIONS[0].id}`,
};
const PREFIX = { monsters: 'm', bosses: 'b', mutations: 'x', items: 'i', companions: 'c' };

// Piste des paliers de complétion.
function milestones(state, progress) {
  const claimed = state.codex.encClaimed ?? 0;
  const next = encyclopediaNext(state);
  const steps = ENCYCLOPEDIA_MILESTONES.map((m, i) => {
    const got = i < claimed;
    const ready = !got && progress.pct >= m.pct;
    return `<div class="m-step${got ? ' got' : ready ? ' ready' : ''}" style="left:${m.pct}%" title="${m.pct} % : ${rewardText(m.reward, formatNumber)}">
      ${ready && next?.index === i ? '<button class="btn btn-gold small" data-action="enc-claim">!</button>' : `<span>${got ? '✔' : img('icon_chest')}</span>`}<small>${m.pct} %</small></div>`;
  }).join('');
  const label = next ? (next.ready
    ? `<button class="btn btn-gold small" data-action="enc-claim">Récupérer : ${rewardText(next.reward, formatNumber)}</button>`
    : `<span class="muted">Palier ${next.pct} % : ${rewardText(next.reward, formatNumber)}</span>`) : '<span class="good">Tous les paliers récupérés ✔</span>';
  return `<div class="row-between"><div class="section-title">Encyclopédie complétée à ${pct(progress.pct)}</div>${label}</div>
    <div class="m-track enc-track"><div class="m-fill" style="width:${Math.min(100, progress.pct)}%"></div>${steps}</div>`;
}

export default {
  id: 'encyclopedia',
  title: 'Collections',
  icon: 'icon_book',
  extra: (ui, state) => `${pct(encyclopediaProgress(state).pct)}`,
  render(ui, state) {
    const v = ui.view;
    const progress = encyclopediaProgress(state);
    const sec = ENCYCLOPEDIA_SECTIONS.some((s) => s.id === v.encSec) ? v.encSec : 'monsters';
    const sel = v.encSel?.startsWith(`${PREFIX[sec]}:`) ? v.encSel : FIRST[sec]();
    const tabs = progress.sections.map((s) => `<button class="enc-tab${s.id === sec ? ' active' : ''}" data-action="enc-sec" data-value="${s.id}">
      ${img(s.icon)}<span>${s.label}</span><small>${s.found}/${s.total}</small>${progressBar(s.found / s.total)}</button>`).join('');
    const list = { monsters: () => monsterList(state, sel), bosses: () => bossList(state, sel), mutations: () => mutationList(state, sel),
      items: () => itemList(state, sel, v.encSlot ?? 'all'), companions: () => companionList(state, sel) }[sec]();
    // Étape 5 : les trois collections (Encyclopédie, collections du Codex des boss, Musée) reliées entre elles.
    const links = `<div class="coll-links"><span class="muted">Autres collections :</span>
      <button class="btn small" data-action="goto" data-value="boss">${img('icon_boss')} Codex des boss</button>
      <button class="btn small" data-action="goto" data-value="museum">${img('icon_trophy')} Musée ancestral</button></div>`;
    return `<div class="card">${milestones(state, progress)}${links}</div>
      <div class="enc-tabs">${tabs}</div>
      <div class="codex enc-body"><div class="card enc-list">${list}</div><div class="card codex-detail">${detail(state, sel)}</div></div>`;
  },
};
