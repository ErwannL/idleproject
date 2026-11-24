// Encyclopédie (v9.0.5) : bestiaire, boss, mutations, équipements (une entrée par rareté) et compagnons.
// Ce qui n'a pas encore été découvert apparaît en silhouette « ??? ». Chaque entrée a sa fiche détaillée.
import { GRAND_BOSSES } from '../../data/grand-bosses.js'; // v9.7.1 (lot 7)
import { REVENGE_STEPS, revengeLevel } from '../../core/revenge.js';
import { museumView } from './inventory.js';
import { MUSEUM_PIECES, museumCount } from '../../core/museum.js';
import { BALANCE } from '../../data/balance.js';
import { COMPANIONS, COMPANION_RULES } from '../../data/companions.js';
import { DUNGEONS } from '../../data/dungeons.js';
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { RARITIES, SIGNATURE_ITEMS, SLOTS, STAT_LABELS, PERCENT_STATS, ITEM_BASES } from '../../data/items.js';
import { BOSS_LORE } from '../../data/lore.js';
import { bossTrait } from '../../core/boss-traits.js';
import { ZONES } from '../../data/zones.js';
import { MULTIPLICATIVE, allCompanionSkills, companionSkillMultiplier, duplicates, ultimateUnlocked, unitLevel } from '../../core/companions.js';
import { SKILL_RULES, skillTextAt } from '../../data/companion-skills.js';
import {
  ENCYCLOPEDIA_MILESTONES, ENCYCLOPEDIA_SECTIONS, MONSTER_VARIANTS, SIGNATURE_RARITIES, encyclopediaNext,
  encyclopediaProgress, sectionStatus, variantFound,
} from '../../core/encyclopedia.js';
import { itemBase, itemStatValue, rarityById } from '../../core/loot.js';
import { MUTATIONS, MUTATION_RULES, mutationChance } from '../../core/mutations.js';
import { rewardText } from '../../core/rewards.js';
import { itemIconUrl, spriteCanvas } from '../../render/pixel.js';
import { SPRITES } from '../../render/sprites.js';
import { sizeFactor } from '../../data/enemy-sizes.js';
import { mutantPortraitUrl } from '../../render/mutation-look.js'; // v9.2.3
import { animCanvas } from '../animator.js';
import { showcaseSlot } from '../showcase.js'; // v9.2.7 : vitrine animée
import { AFFIXES } from '../../data/items.js';
import { ENVIRONMENTS } from '../../data/environment.js'; // v9.2.1
import { envEffectText } from '../../core/environment.js';
import { mBar, mBtn, mBtnGold, mGrid, mModes, mSheet, mTile } from '../mobile-kit.js'; // v10.12
import { MUSEUM, museumDuplicates, museumEffects } from '../../core/museum.js';
import { esc, isMPhone, mpBtns, mpChips, mpFold, mpFrame, mpRow, mpSwitch } from './profile-m.js';
import { effectText, escapeHtml, fold, formatNumber, icon, img, progressBar, rarityLabel, rewardIcons, stars } from '../common.js';

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
// v9.2.3 : avec l'apparence réelle de la mutation (render/mutation-look.js : taille, couleurs, cape, yeux…).
const MUTATION_LOOK = { split: 'slime', regen: 'mushroom_green', armored: 'skeleton_shield', frenzied: 'wolf', vampire: 'bat', giant: 'ogre' };
function mutantPic(m, known, scale = 2) {
  const type = MUTATION_LOOK[m.id];
  const sprite = ENEMIES[type]?.sprite ?? 'slime';
  if (!known) return spritePic(sprite, false, scale);
  const url = mutantPortraitUrl({ spriteCanvas, sizeFactor, SPRITES }, type, sprite, m, { scale: scale >= 4 ? 2 : 1, ghost: scale >= 4 });
  return `<img class="px enc-mutant-real" src="${url}" alt="">`;
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
  const filters = `<select data-action="enc-slot-select" aria-label="Emplacement">${['all', ...Object.keys(SLOTS)].map((s) => `<option value="${s}" ${slot === s ? 'selected' : ''}>${s === 'all' ? 'Tous les emplacements' : SLOTS[s]}</option>`).join('')}</select>`;
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
  if (!known) return unknownCard(`Se rencontre : ${where.join(', ') || 'quelque part'}. Vaincs-le pour le découvrir.`, spritePic(e.sprite, false, 3));
  const variants = MONSTER_VARIANTS.map((v) => {
    const got = variantFound(state, id, v.id);
    const how = { normal: 'le vaincre une fois', elite: 'vaincre sa version Élite (événement « Élite errante »)', mutant: 'vaincre une version mutée (à partir du monde 2)' }[v.id];
    return `<div class="enc-variant${got ? ' got' : ''}"><b class="v-${v.id}">${v.label}</b> ${got ? '<span class="good">✔ découvert</span>' : `<span class="muted">${how}</span>`}</div>`;
  }).join('');
  return `<div class="enc-card"><div class="enc-portrait enc-big">${animCanvas(`foe:${e.sprite}`, 96, 72, 3)}</div>
    <div class="enc-title">${escapeHtml(e.name)}</div><div class="muted">📍 ${escapeHtml(where.join(', '))}</div>
    <div class="enc-stats">${statRow('Vaincus', formatNumber(state.codex.kills[id] ?? 0))}${statRow('Élites vaincues', formatNumber(state.codex.elite[id] ?? 0))}
      ${statRow('PV de base', e.hp)}${statRow('Dégâts de base', e.damage)}${statRow('Vitesse', e.speed)}${statRow('Attaque toutes les', `${String(e.attackInterval).replace('.', ',')} s`)}
      ${e.flyHeight ? statRow('Type', 'Volant') : ''}</div>
    <div class="section-title">Vitrine</div>${showcaseSlot('monster', id)}
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
    ${bossTrait(id) ? `<div class="trait-box" style="--trait:${bossTrait(id).color}"><b>${escapeHtml(bossTrait(id).name)}</b> : ${escapeHtml(bossTrait(id).text)}.<div class="muted">Parade : ${escapeHtml(bossTrait(id).counter)}</div></div>` : ''}
    <div class="enc-stats">${statRow('Vaincu', `${formatNumber(state.codex.kills[id])} fois`)}${statRow('Inspiré du', escapeHtml(ENEMIES[b.base]?.name ?? '—'))}
      ${sig ? statRow('Objet ancestral', `<span class="rarity-text r-legendary">${escapeHtml(sig.name)}</span>`) : ''}</div>
    <div class="section-title">Vitrine</div>${showcaseSlot('boss', id)}</div>`;
}

// v9.2.3 : comment reconnaître chaque mutation en combat (retour joueur : la division passait pour un bug).
const MUTATION_CUES = {
  split: 'Plus petit, vert et translucide, sa membrane ondule. À sa mort, il se fend en deux petits doubles (40 % de ses PV chacun) et « Se divise ! » s\'affiche : ce n\'est pas un bug.',
  regen: 'Une lueur verte pulse autour de lui et des feuilles tombent. Des chiffres verts montrent les PV qu\'il regagne.',
  armored: 'Couvert de plaques d\'acier qui brillent. « Bloqué » s\'affiche quand sa cuirasse absorbe un coup (tant qu\'il a plus de la moitié de ses PV).',
  frenzied: 'Teinté de rouge, les yeux brillants, il fume et bouge plus vite ; son aura pulse et des braises jaillissent de lui.',
  vampire: 'Pâle et violet, drapé d\'une cape d\'ombre. Un filet rouge relie le chevalier au monstre quand il vole de la vie.',
  giant: 'Une fois et demie plus grand que ses semblables, contour doré ; le sol tremble à chacun de ses pas lourds.',
};
function mutationCue(m) {
  return `<div class="trait-box" style="--trait:${m.color}"><b>En combat :</b> <span>étiquette de sa couleur au-dessus de sa barre de vie, contour de la même couleur.</span> <span>${escapeHtml(MUTATION_CUES[m.id] ?? '')}</span></div>`;
}

function mutationCard(state, id) {
  const m = MUTATIONS.find((x) => x.id === id);
  const known = Boolean(state.codex.mutants[id]);
  const chance = mutationChance(state);
  const rule = `Chance qu'un monstre ordinaire soit muté : ${pct(chance * 100)} actuellement (${pct(MUTATION_RULES.chance * 100)} sans Transcendance, +${pct(MUTATION_RULES.chancePerTranscend * 100)} par Transcendance, ${pct(MUTATION_RULES.maxChance * 100)} au plus ; à partir du monde 2).`;
  if (!known) return unknownCard(`Vaincs un monstre porteur de cette mutation. ${rule}`, mutantPic(m, false, 4)).replace(/<\/div>$/, `${mutationCue(m)}</div>`);
  return `<div class="enc-card"><div class="enc-portrait">${mutantPic(m, true, 4)}</div>
    <div class="enc-title" style="color:${m.color}">${escapeHtml(m.name)}</div>
    <p>Le monstre ${escapeHtml(m.text)}.</p>${mutationCue(m)}
    <div class="section-title">Vitrine</div>${showcaseSlot('mutation', id)}
    <div class="enc-stats">${statRow('Vaincus', formatNumber(state.codex.mutants[id]))}${statRow('PV', `×${String(MUTATION_RULES.hpMultiplier).replace('.', ',')}`)}
      ${statRow('Or', `×${MUTATION_RULES.goldMultiplier}`)}${statRow('Butin', 'objet garanti')}</div>
    <p class="muted">${rule}</p></div>`;
}

function itemCard(state, baseId, rarity) {
  const b = itemBase(baseId);
  const r = rarityById(rarity);
  const known = Boolean(state.codex.itemRar[`${baseId}:${rarity}`]);
  const how = b.signature ? `Objet ancestral de ${escapeHtml(BOSSES[b.signature]?.name ?? 'un boss')} (${Math.round(BALANCE.loot.signatureChance * 100)} % par victoire).`
    : rarity === 'legendary' ? 'Très rare : boss, coffres, donjons et Tour augmentent tes chances.' : 'Se ramasse sur les monstres, les boss et dans les coffres.';
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
  const grade = rarityLabel(c.rarity);
  if (!owned) return unknownCard(`${c.kind === 'ally' ? 'Compagnon' : 'Familier'} ${grade}. S'obtient par l'Invocation.`, spritePic(c.sprite, false, c.kind === 'ally' ? 2 : 4));
  const passive = Object.fromEntries(Object.entries(c.passive).map(([k, v]) => [MULTIPLICATIVE[k] ?? k, v * COMPANION_RULES.passiveBase]));
  return `<div class="enc-card"><div class="enc-portrait">${c.kind === 'ally' ? animCanvas(`foe:${c.sprite}`, 96, 72, 2) : animCanvas(`pet:${c.sprite}`, 64, 56, 3)}</div>
    <div class="enc-title rarity-text r-${c.rarity}">${escapeHtml(c.name)}</div>
    <div class="muted">${c.kind === 'ally' ? 'Compagnon' : 'Familier'} · <b class="rarity-text r-${c.rarity}">${grade}</b> · ${stars(duplicates(owned))}</div>
    <div class="enc-stats">${statRow('Niveau', unitLevel(state, c.id))}${statRow('Passif (niv. 1)', effectText(passive))}
      ${statRow('Copies', `${duplicates(owned) + 1}/${COMPANION_RULES.maxCopies}`)}</div>
    <div class="section-title">Vitrine</div>${showcaseSlot('unit', c.id)}
    <div class="section-title">Compétences</div>
    ${allCompanionSkills(c.id).map((sk) => {
      // v9.1.3 (doc4 lot 2) : les 4 compétences, valeurs réelles arrondies ; l'ultime verrouillée l'indique.
      const open = !sk.ultimate || ultimateUnlocked(owned);
      const v = skillTextAt(sk, companionSkillMultiplier(state, c, sk.type, false, BALANCE, owned));
      return `<div class="enc-skill${open ? '' : ' muted'}"><b>${escapeHtml(sk.name)}</b>${sk.ultimate ? ` <span class="tag-ult">${open ? 'Ultime' : `Ultime à ${SKILL_RULES.ultimateCopies - 1} doublons`}</span>` : ''}
        <div class="muted">${escapeHtml(v)} · toutes les ${sk.every} s</div></div>`;
    }).join('')}
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
    ? `<button class="btn btn-gold small" data-action="enc-claim" aria-label="Récupérer : ${rewardText(next.reward, formatNumber)}">Récupérer ${rewardIcons(next.reward)}</button>`
    : `<span class="muted">Palier ${next.pct} % : ${rewardIcons(next.reward)}</span>`) : '<span class="good">Tous les paliers récupérés ✔</span>';
  return `<div class="row-between"><div class="section-title">Encyclopédie complétée à ${pct(progress.pct)}</div>${label}</div>
    <div class="m-track enc-track"><div class="m-fill" style="width:${Math.min(100, progress.pct)}%"></div>${steps}</div>`;
}

// v9.1.3 (lot E) : palier de la section ouverte (ancien Codex), compté sur le même nombre que l'onglet.
function sectionMilestone(state, id) {
  const sec = ENCYCLOPEDIA_SECTIONS.find((s) => s.id === id);
  if (!sec?.milestones) return '';
  const st = sectionStatus(state, id);
  const goal = st.next ?? st.total;
  const right = st.next === null ? '<span class="good">Paliers ✔</span>' : st.ready
    ? `<button class="btn small btn-gold" data-action="claim-collection" data-value="${id}" aria-label="Récupérer : ${escapeHtml(rewardText(st.reward, formatNumber))}">Récupérer ${rewardIcons(st.reward)}</button>`
    : `<span class="muted">à ${goal} : ${rewardIcons(st.reward)}</span>`;
  return `<div class="card enc-sec-ms row-between"><span>Palier ${Math.min(st.claimed + 1, sec.milestones.length)}/${sec.milestones.length}</span>
    <span class="grow">${progressBar(Math.min(1, st.found / Math.max(1, goal)), `${st.found} / ${goal}`)}</span>${right}</div>`;
}

// v9.2.1 : malus d'environnement des mondes 2 à 12 (valeur au cycle 1) et amélioration qui le contre ; les mondes
// pas encore atteints restent « ? ».
function envTable(state) {
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  const rows = ENVIRONMENTS.map((e) => {
    const zi = ZONES.findIndex((z) => z.id === e.zone);
    const seen = best > zi * 20; // étape record au-delà du monde précédent (mondes de 20 étapes avant l'Abysse)
    if (!seen) return `<div class="env-row muted">${zi + 1}. ?</div>`;
    return `<div class="env-row">${img(e.icon, 'ico16')} <b>${zi + 1}. ${escapeHtml(e.name)}</b> — ${escapeHtml(envEffectText(e, e.base))} · contré par ${escapeHtml(BALANCE.upgrades[e.counter].label)} (complet au niveau ${e.fullAt})</div>`;
  }).join('');
  return `<div class="muted">Le malus grandit de 25 % par cycle (×2 au plus) et baisse selon le niveau de l'amélioration qui le contre.</div>${rows}`;
}


// ---------- v10.12 : Encyclopédie sur téléphone (kit mobile) ----------
// Grille de 3 cartes (nom sur 2 lignes sans coupure de mot), paliers en une seule barre, fiche d'une entrée dans une .m-sheet.
const mcell = (key, known, pic, label, extra = '') => `<button type="button" class="m-card mp-cell${known ? '' : ' unknown'}${extra}" data-action="mp-open" data-value="enc:${esc(key)}" title="${known ? esc(label) : '???'}"><span class="mp-cell-pic">${pic}</span><span class="mp-cell-name">${known ? esc(label) : '???'}</span></button>`;
const mcells = (html) => `<div class="mp-cells">${html}</div>`;
const mGroup = (label) => `<div class="mp-sub">${esc(label)}</div>`;
const mShut = { close: 'mp-shut', back: 'mp-shut', id: 'enc-sheet' };

function mMonsters(state) {
  return mcells(Object.entries(ENEMIES).map(([id, e]) => {
    const n = MONSTER_VARIANTS.filter((v) => variantFound(state, id, v.id)).length;
    const dots = MONSTER_VARIANTS.map((v) => `<i class="${variantFound(state, id, v.id) ? `on v-${v.id}` : ''}"></i>`).join('');
    return mcell(`m:${id}`, n > 0, `${spritePic(e.sprite, n > 0, 2)}<span class="enc-dots">${dots}</span>`, e.name);
  }).join(''));
}
function mBosses(state) {
  const groups = [['mega', 'Méga boss'], ['mini', 'Mini-boss'], ['mid', 'Boss'], ['hard', 'Boss redoutables'], ['dungeon', 'Boss de donjon']];
  return groups.map(([tier, label]) => {
    const ids = Object.keys(BOSSES).filter((id) => (BOSSES[id].tier ?? 'mega') === tier);
    return `${mGroup(label)}${mcells(ids.map((id) => { const known = Boolean(state.codex.kills[id]); return mcell(`b:${id}`, known, spritePic(enemySprite(id), known), BOSSES[id].name); }).join(''))}`;
  }).join('');
}
function mMutations(state) {
  return mcells(MUTATIONS.map((m) => { const known = Boolean(state.codex.mutants[m.id]); return mcell(`x:${m.id}`, known, mutantPic(m, known), m.name); }).join(''));
}
function mItems(state, slot) {
  const bases = [...ITEM_BASES, ...SIGNATURE_ITEMS].filter((b) => slot === 'all' || b.slot === slot);
  const chips = mpChips('enc-slot-select', ['all', ...Object.keys(SLOTS)].map((k) => [k, k === 'all' ? 'Tous' : SLOTS[k]]), slot);
  const cells = bases.map((b) => {
    const known = RARITIES.filter((r) => state.codex.itemRar[`${b.id}:${r.id}`] && (!b.signature || SIGNATURE_RARITIES.includes(r.id)));
    const best = known.at(-1)?.id ?? (b.signature ? SIGNATURE_RARITIES[0] : 'common');
    const pic = `<img class="px${known.length ? '' : ' enc-shadow'}" src="${itemIconUrl({ baseId: b.id, rarity: best, slot: b.slot })}" alt="">`;
    return `<button type="button" class="m-card mp-cell r-${best}${known.length ? '' : ' unknown'}" data-action="mp-open" data-value="enc:i:${esc(b.id)}:${best}" title="${known.length ? esc(b.name) : '???'}"><span class="mp-cell-pic">${pic}</span><span class="mp-cell-name">${known.length ? esc(b.name) : '???'}${b.signature && known.length ? ' ✦' : ''}</span></button>`;
  }).join('');
  return `${chips}${mcells(cells)}`;
}
function mCompanions(state) {
  return [['pet', 'Familiers'], ['ally', 'Compagnons']].map(([kind, label]) => `${mGroup(label)}${mcells(COMPANIONS.filter((c) => (c.kind === 'ally') === (kind === 'ally')).map((c) => {
    const known = Boolean(state.companions.owned[c.id]);
    return mcell(`c:${c.id}`, known, spritePic(c.sprite, known, c.kind === 'ally' ? 2 : 3), c.name, ` r-${c.rarity}`);
  }).join(''))}`).join('');
}
function mMuseum(state) {
  const n = museumCount(state);
  const total = effectText(museumEffects(state));
  const head = `<div class="m-card mp-head"><span class="mp-ico big">${img('icon_trophy')}</span><div class="mp-main"><div class="mp-head-line"><b class="num">${n}/${MUSEUM_PIECES.length}</b><small>pièces exposées</small></div>${mBar(n / MUSEUM_PIECES.length)}<small class="good">${total || ' '}</small></div>${mBtn('Outils', { action: 'mp-open', value: 'enc:mtools', cls: 'auto' })}</div>`;
  const tiles = MUSEUM_PIECES.map((baseId) => {
    const base = itemBase(baseId);
    const item = state.museum[baseId];
    // la case est un <span> (non cliquable) dans un bouton : un seul élément interactif par pièce
    const tile = item ? mTile({ ...item, name: base.name }, { size: 80, plus: item.level ? `niv. ${item.level}` : '', src: itemIconUrl({ baseId, rarity: item.rarity, slot: base.slot }) })
      : mTile(null, { size: 80, slot: base.slot });
    return `<button type="button" class="mp-tilebtn" data-action="mp-open" data-value="enc:mus:${esc(baseId)}" aria-label="${esc(base.name)}">${tile}<small>${esc(base.name)}</small></button>`;
  });
  return `${head}${mGrid(tiles, 3)}`;
}
const FUTURE_P = ['Titan des Abysses', 'Dieu de l\'Orage', 'Mère des Dragons'];
function mPantheon() {
  const met = Object.values(GRAND_BOSSES).filter((b) => !b.test);
  const cards = met.map((b) => `<button type="button" class="m-card mp-cell" data-action="mp-open" data-value="enc:p:${esc(b.id)}"><span class="mp-cell-pic"><span class="mp-art" style="background-image:url('${b.art.dir}/${b.art.prefix}idle.png')"></span></span><span class="mp-cell-name">${esc(b.name)}</span></button>`).join('');
  const ghosts = FUTURE_P.map(() => '<div class="m-card mp-cell unknown"><span class="mp-cell-pic"><span class="mp-art silhouette"></span></span><span class="mp-cell-name">???</span></div>').join('');
  return mcells(cards + ghosts);
}
function mPantheonSheet(ui, state, id) {
  const b = Object.values(GRAND_BOSSES).find((x) => x.id === id);
  if (!b) return '';
  const best = id === 'colossus' ? Math.max(state.worldBoss?.best ?? 0, state.records?.worldBossBest ?? 0) : state.grand?.[id]?.best ?? 0;
  const names = { gems: ['icon_gem', 'Gemmes'], shards: ['icon_shard', 'Éclats'] };
  const gives = Object.entries(b.rewards ?? {}).map(([k, n]) => pRow(names[k]?.[0] ?? '', names[k]?.[1] ?? esc(k), nl(n)));
  return mSheet(b.name, `${pHero(`<span class="mp-art big" style="background-image:url('${b.art.dir}/${b.art.prefix}idle.png')"></span>`, esc(b.name), b.title ? pChip(esc(b.title), true) : '')}
    ${pStats([pRow('icon_trophy', 'Meilleur score', nl(best)), id === 'colossus' ? pRow('icon_skull', 'Revanche', `${revengeLevel(state)}/${REVENGE_STEPS}`) : ''])}
    ${gives.length ? `<div class="m-card mp-srows"><div class="mp-sub0">Il donne</div>${gives.join('')}</div>` : ''}
    ${b.lore ? pFoldN(ui, 'enc-plore', 'Histoire', esc(b.lore)) : ''}`, mShut);
}
// ---------- v10.12 (rattrapage) : fiches d'entrée sur téléphone, en kit (tête avec portrait + puces, lignes .m-stat, replis « ? ») ----------
const nl = (n) => formatNumber(n);
const pHero = (pic, name, chips = '', sub = '', nameStyle = '') => `<div class="m-card mp-bhero"><div class="mp-bpic">${pic}</div><div class="mp-bmeta"><b class="mp-bname"${nameStyle ? ` style="${nameStyle}"` : ''}>${name}</b>${chips ? `<span class="mp-chiprow">${chips}</span>` : ''}${sub ? `<small>${sub}</small>` : ''}</div></div>`;
const pChip = (label, on = false, style = '') => `<span class="m-chip mp-static${on ? ' on' : ''}"${style ? ` style="${style}"` : ''}>${label}</span>`;
const pStats = (rows) => `<div class="m-card mp-srows">${rows.filter(Boolean).join('')}</div>`;
const pRow = (ic, label, value) => `<div class="m-stat">${ic ? img(ic) : ''}<span class="m-k">${label}</span><b class="m-v">${value}</b></div>`;
const pNote = (t) => `<div class="m-card"><div class="mp-note">${t}</div></div>`;
const pShow = (kind, id) => `<div class="m-card mp-showcase"><div class="mp-sub0">Vitrine</div>${showcaseSlot(kind, id)}</div>`;
const pFoldN = (ui, id, title, html) => mpFold(ui, id, title, `<div class="m-card"><div class="mp-note">${html}</div></div>`);
const pUnknown = (pic, hint) => `${pHero(pic, '???')}${pNote(hint)}`;
const pTrait = (id) => { const t = bossTrait(id); return t ? `<div class="m-card mp-trait" style="--trait:${t.color}"><b>${escapeHtml(t.name)}</b><small>${escapeHtml(t.text)}</small><small class="mp-counter">Parade : ${escapeHtml(t.counter)}</small></div>` : ''; };

function pMonster(ui, state, id) {
  const e = ENEMIES[id];
  const known = MONSTER_VARIANTS.some((v) => variantFound(state, id, v.id));
  const where = zonesOf(id);
  if (!known) return pUnknown(spritePic(e.sprite, false, 3), `Se rencontre : ${escapeHtml(where.join(', ') || 'quelque part')}. Vaincs-le pour le découvrir.`);
  const how = { normal: 'Le vaincre une fois.', elite: 'Vaincre sa version Élite (événement « Élite errante »).', mutant: 'Vaincre une version mutée (à partir du monde 2).' };
  const variants = MONSTER_VARIANTS.map((v) => pRow('', `<span class="v-${v.id}">${v.label}</span>`, variantFound(state, id, v.id) ? '<span class="good">✔</span>' : '<span class="muted">à trouver</span>')).join('');
  return `${pHero(animCanvas(`foe:${e.sprite}`, 36, 36, 3), escapeHtml(e.name), e.flyHeight ? pChip('Volant') : '', escapeHtml(where.join(', ')))}
    ${pStats([pRow('icon_skull', 'Vaincus', nl(state.codex.kills[id] ?? 0)), pRow('icon_crown', 'Élites vaincues', nl(state.codex.elite[id] ?? 0)), pRow('icon_heart', 'PV de base', e.hp), pRow('icon_damage', 'Dégâts de base', e.damage),
      pRow('icon_bolt', 'Vitesse', e.speed), pRow('icon_timer', 'Attaque toutes les', `${String(e.attackInterval).replace('.', ',')} s`)])}
    ${pShow('monster', id)}
    <div class="m-card mp-srows"><div class="mp-sub0">Variantes</div>${variants}</div>
    ${pFoldN(ui, 'enc-variants', 'Comment les trouver ?', MONSTER_VARIANTS.map((v) => `<b>${v.label}</b> : ${how[v.id]}`).join('<br>'))}`;
}

function pBoss(ui, state, id) {
  const b = BOSSES[id];
  const known = Boolean(state.codex.kills[id]);
  const tier = TIERS[b.tier] ?? 'Méga boss';
  const where = bossWhere(id);
  if (!known) return pUnknown(spritePic(enemySprite(id), false, 1), `${tier}. Se rencontre : ${escapeHtml(where.join(', '))}.`);
  const sig = SIGNATURE_ITEMS.find((s) => s.signature === id);
  return `${pHero(animCanvas(`foe:${enemySprite(id)}`, 104, 104, 1), escapeHtml(b.name), pChip(tier, true), escapeHtml(where.join(' · ')))}
    ${pTrait(id)}
    ${pStats([pRow('icon_skull', 'Vaincu', `${nl(state.codex.kills[id])} fois`), pRow('icon_paw', 'Inspiré du', escapeHtml(ENEMIES[b.base]?.name ?? '—')), sig ? pRow('icon_star', 'Objet ancestral', `<span class="rarity-text r-legendary">${escapeHtml(sig.name)}</span>`) : ''])}
    ${BOSS_LORE[id] ? pFoldN(ui, 'enc-lore', 'Histoire', escapeHtml(BOSS_LORE[id])) : ''}
    ${pShow('boss', id)}`;
}

function pMutation(ui, state, id) {
  const m = MUTATIONS.find((x) => x.id === id);
  const known = Boolean(state.codex.mutants[id]);
  const rule = `Chance qu'un monstre ordinaire soit muté : ${pct(mutationChance(state) * 100)} actuellement (${pct(MUTATION_RULES.chance * 100)} sans Transcendance, +${pct(MUTATION_RULES.chancePerTranscend * 100)} par Transcendance, ${pct(MUTATION_RULES.maxChance * 100)} au plus ; à partir du monde 2).`;
  const folds = `${pFoldN(ui, 'enc-cue', 'En combat', `Étiquette et contour de sa couleur. ${escapeHtml(MUTATION_CUES[m.id] ?? '')}`)}${pFoldN(ui, 'enc-rule', 'Chance de mutation', rule)}`;
  if (!known) return `${pUnknown(mutantPic(m, false, 3), 'Vaincs un monstre porteur de cette mutation.')}${folds}`;
  return `${pHero(mutantPic(m, true, 2), escapeHtml(m.name), '', `Le monstre ${escapeHtml(m.text)}.`, `color:${m.color}`)}
    ${pStats([pRow('icon_skull', 'Vaincus', nl(state.codex.mutants[id])), pRow('icon_heart', 'PV', `×${String(MUTATION_RULES.hpMultiplier).replace('.', ',')}`), pRow('coin', 'Or', `×${MUTATION_RULES.goldMultiplier}`), pRow('icon_bag', 'Butin', 'objet garanti')])}
    ${pShow('mutation', id)}${folds}`;
}

function pItem(ui, state, baseId, rarity) {
  const b = itemBase(baseId);
  const r = rarityById(rarity);
  const known = Boolean(state.codex.itemRar[`${baseId}:${rarity}`]);
  const how = b.signature ? `Objet ancestral de ${escapeHtml(BOSSES[b.signature]?.name ?? 'un boss')} (${Math.round(BALANCE.loot.signatureChance * 100)} % par victoire).`
    : rarity === 'legendary' ? 'Très rare : boss, coffres, donjons et Tour augmentent tes chances.' : 'Se ramasse sur les monstres, les boss et dans les coffres.';
  const rars = RARITIES.filter((x) => !b.signature || SIGNATURE_RARITIES.includes(x.id)).map((x) => {
    const got = state.codex.itemRar[`${baseId}:${x.id}`];
    return `<button type="button" class="mp-rbtn r-${x.id}${got ? '' : ' unknown'}${x.id === rarity ? ' selected' : ''}" data-action="mp-open" data-value="enc:i:${esc(baseId)}:${x.id}" title="${esc(x.label)}" aria-label="${esc(x.label)}">
      <img class="px${got ? '' : ' enc-shadow'}" src="${itemIconUrl({ baseId, rarity: x.id, slot: b.slot })}" alt=""></button>`;
  }).join('');
  const raritiesCard = `<div class="m-card"><div class="mp-sub0">Raretés</div><div class="mp-rars">${rars}</div></div>`;
  const pic = `<span class="mp-rpic r-${rarity}"><img class="px${known ? '' : ' enc-shadow'}" src="${itemIconUrl({ baseId, rarity, slot: b.slot }, 64)}" alt=""></span>`;
  const chips = `${pChip(SLOTS[b.slot])}${pChip(r.label, true)}${b.signature ? pChip('Ancestral') : ''}`;
  if (!known) return `${pHero(pic, '???', chips)}${pNote(how)}${raritiesCard}`;
  const stats = Object.entries(b.stats ?? {}).map(([k, v]) => pRow('', STAT_LABELS[k], `${nl(itemStatValue(k, v, r, 1))}${PERCENT_STATS.has(k) ? ' %' : ''}`));
  const main = b.mainAffix ? pRow('', 'Effet principal', AFFIXES[b.mainAffix.type].label(Math.round(b.mainAffix.base * r.statMultiplier * 10) / 10)) : '';
  const fixed = (b.affixes ?? []).map((a) => pRow('', 'Effet', AFFIXES[a.type].label(a.value)));
  return `${pHero(pic, escapeHtml(b.name), chips)}
    ${pStats([...stats, main, ...fixed, pRow('icon_star', 'Puissance', `×${String(r.statMultiplier).replace('.', ',')}`)])}
    ${raritiesCard}
    ${pFoldN(ui, 'enc-itemhow', 'À savoir', `Valeurs au niveau 1 ; elles grandissent avec le niveau de l'objet. ${rarity !== 'common' && !b.signature ? 'Effets spéciaux tirés au hasard en plus. ' : ''}${how}`)}`;
}

function pCompanion(ui, state, id) {
  const c = COMPANIONS.find((x) => x.id === id);
  const owned = state.companions.owned[id];
  const grade = rarityLabel(c.rarity);
  const kind = c.kind === 'ally' ? 'Compagnon' : 'Familier';
  if (!owned) return pUnknown(spritePic(c.sprite, false, c.kind === 'ally' ? 2 : 4), `${kind} ${grade}. S'obtient par l'Invocation.`);
  const passive = Object.fromEntries(Object.entries(c.passive).map(([k, v]) => [MULTIPLICATIVE[k] ?? k, v * COMPANION_RULES.passiveBase]));
  const skills = allCompanionSkills(c.id).map((sk) => {
    const open = !sk.ultimate || ultimateUnlocked(owned);
    const v = skillTextAt(sk, companionSkillMultiplier(state, c, sk.type, false, BALANCE, owned));
    return `<div class="mp-skill${open ? '' : ' locked'}"><b>${escapeHtml(sk.name)}</b>${sk.ultimate ? ` <span class="m-chip mp-static${open ? ' on' : ''}">${open ? 'Ultime' : `Ultime à ${SKILL_RULES.ultimateCopies - 1} doublons`}</span>` : ''}<small>${escapeHtml(v)} · toutes les ${sk.every} s</small></div>`;
  }).join('');
  return `${pHero(c.kind === 'ally' ? animCanvas(`foe:${c.sprite}`, 48, 48, 2) : animCanvas(`pet:${c.sprite}`, 32, 32, 3), `<span class="rarity-text r-${c.rarity}">${escapeHtml(c.name)}</span>`, `${pChip(kind)}${pChip(grade, true)}`, stars(duplicates(owned)))}
    ${pStats([pRow('icon_xp', 'Niveau', unitLevel(state, c.id)), pRow('icon_star', 'Passif (niv. 1)', effectText(passive)), pRow('icon_summon', 'Copies', `${duplicates(owned) + 1}/${COMPANION_RULES.maxCopies}`)])}
    ${pShow('unit', c.id)}
    <div class="m-card mp-skills"><div class="mp-sub0">Compétences</div>${skills}</div>
    ${pFoldN(ui, 'enc-aura', 'À 5 étoiles', 'Une aura de flammes à ses couleurs l\'entoure en combat.')}`;
}

function pEnv(ui, state) {
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  const rows = ENVIRONMENTS.map((e) => {
    const zi = ZONES.findIndex((z) => z.id === e.zone);
    if (!(best > zi * 20)) return `<div class="m-card mp-env unseen"><b>${zi + 1}. ?</b></div>`;
    return `<div class="m-card mp-env"><b>${img(e.icon, 'ico16')} ${zi + 1}. ${escapeHtml(e.name)}</b><small>${escapeHtml(envEffectText(e, e.base))}</small><small class="mp-counter">Contré par ${escapeHtml(BALANCE.upgrades[e.counter].label)} (complet niv. ${e.fullAt})</small></div>`;
  }).join('');
  return `${pFoldN(ui, 'enc-envinfo', 'Comment ça marche ?', 'Le malus grandit de 25 % par cycle (×2 au plus) et baisse selon le niveau de l\'amélioration qui le contre.')}${rows}`;
}

function mEncTitle(state, key) {
  const [kind, a, b] = key.split(':');
  const f = { m: () => (MONSTER_VARIANTS.some((v) => variantFound(state, a, v.id)) ? ENEMIES[a]?.name : null), b: () => (state.codex.kills[a] ? BOSSES[a]?.name : null), x: () => (state.codex.mutants[a] ? MUTATIONS.find((x) => x.id === a)?.name : null),
    i: () => (state.codex.itemRar[`${a}:${b}`] ? itemBase(a)?.name : null), c: () => (state.companions.owned[a] ? COMPANIONS.find((c) => c.id === a)?.name : null) }[kind];
  return f?.() ?? '???';
}
function mEncSheet(ui, state, key) {
  if (key === 'mtools') {
    const auto = state.ui.autoMuseum !== false;
    const dupes = museumDuplicates(state).length;
    return mSheet('Outils du Musée', `${mpSwitch('Exposition auto', 'auto-museum', auto, { sub: auto ? 'Activée' : 'Désactivée' })}
      ${mBtnGold('Exposer tout (sac + Réserve)', { action: 'expose-all' })}${dupes ? `<div class="mp-gap"></div>${mBtn(`Recycler les doublons (${dupes})`, { action: 'recycle-museum-dupes' })}` : ''}<div class="mp-gap"></div>
      ${pFoldN(ui, 'enc-museumhow', 'Comment ça marche ?', `Chaque pièce exposée : dégâts, PV et or +${MUSEUM.perPiece.damageMultPct} % (×2 si Légendaire). Collection complète : +${MUSEUM.complete.damageMultPct} % de plus. Une pièce exposée n'est pas portée : reprends-la pour l'équiper.`)}`, mShut);
  }
  if (key === 'env') return mSheet('Environnements', pEnv(ui, state), mShut);
  if (key.startsWith('p:')) return mPantheonSheet(ui, state, key.slice(2));
  if (key.startsWith('mus:')) {
    const baseId = key.slice(4);
    const base = itemBase(baseId);
    const item = state.museum[baseId];
    if (!base) return '';
    const pic = `<span class="mp-rpic r-${item ? item.rarity : 'common'}"><img class="px${item ? '' : ' enc-shadow'}" src="${itemIconUrl({ baseId, rarity: item?.rarity ?? 'common', slot: base.slot }, 64)}" alt=""></span>`;
    const body = item ? `${pHero(pic, `<span class="rarity-text r-${item.rarity}">${esc(base.name)}</span>`, `${pChip(SLOTS[base.slot])}${pChip(rarityById(item.rarity).label, true)}`)}
        ${pStats([pRow('icon_xp', 'Niveau', item.level), item.rarity === 'legendary' ? pRow('icon_star', 'Bonus', '×2') : ''])}<div class="mp-gap"></div>${mBtnGold('Reprendre dans le sac', { action: 'from-museum', value: baseId })}`
      : `${pHero(pic, '???', pChip(SLOTS[base.slot]))}${pNote(`Butin de ${esc(BOSSES[base.signature]?.name ?? '?')}.`)}`;
    return mSheet(item ? base.name : '???', body, mShut);
  }
  const [kind, x, y] = key.split(':');
  const html = { m: () => (ENEMIES[x] ? pMonster(ui, state, x) : ''), b: () => (BOSSES[x] ? pBoss(ui, state, x) : ''), x: () => pMutation(ui, state, x),
    i: () => (itemBase(x) ? pItem(ui, state, x, y) : ''), c: () => pCompanion(ui, state, x) }[kind]?.() ?? '';
  if (!html) return '';
  return mSheet(mEncTitle(state, key), html, mShut);
}
function encPhone(ui, state, phone = true) {
  const v = ui.view;
  const progress = encyclopediaProgress(state);
  const sec = v.encSec === 'museum' || v.encSec === 'pantheon' || ENCYCLOPEDIA_SECTIONS.some((s) => s.id === v.encSec) ? v.encSec : 'monsters';
  const modes = mModes([...progress.sections.map((s) => ({ id: s.id, label: s.label, icon: s.icon, action: 'enc-sec', value: s.id, badge: Boolean(s.milestones && sectionStatus(state, s.id).ready) })),
    { id: 'museum', label: 'Musée', icon: 'icon_trophy', action: 'enc-sec', value: 'museum' }, { id: 'pantheon', label: 'Panthéon', icon: 'icon_boss', action: 'enc-sec', value: 'pantheon' }], sec);
  // Paliers : une seule barre, un repère par palier ; « Récupérer » doré quand le prochain est prêt.
  const claimed = state.codex.encClaimed ?? 0;
  const next = encyclopediaNext(state);
  const ticks = ENCYCLOPEDIA_MILESTONES.map((m, i) => `<span class="${i < claimed ? 'got' : progress.pct >= m.pct ? 'ready' : ''}" style="left:${m.pct}%" title="${m.pct} % : ${esc(rewardText(m.reward, formatNumber))}"></span>`).join('');
  const label = next ? (next.ready ? 'Palier prêt !' : `À ${next.pct} % : ${rewardIcons(next.reward)}`) : 'Tous les paliers ✔';
  const head = `<div class="m-card mp-head"><div class="mp-main"><div class="mp-head-line"><b class="num">${pct(progress.pct)}</b><small>${label}</small></div>
      <div class="mp-track"><i style="--pct:${Math.min(100, progress.pct)}%"></i>${ticks}</div><small>Encyclopédie complétée</small></div>
      ${next?.ready ? mBtnGold('Récupérer', { action: 'enc-claim', cls: 'auto', attrs: `aria-label="Récupérer : ${esc(rewardText(next.reward, formatNumber))}"` }) : ''}</div>`;
  let ms = '';
  const def = ENCYCLOPEDIA_SECTIONS.find((x) => x.id === sec);
  if (def?.milestones) {
    const st = sectionStatus(state, sec);
    const goal = st.next ?? st.total;
    const right = st.next === null ? '<span class="mp-ok" role="img" aria-label="Paliers obtenus">✔</span>' : mBtn('Récupérer', { action: 'claim-collection', value: sec, disabled: !st.ready, cls: `auto${st.ready ? ' ready' : ''}`, attrs: `aria-label="Récupérer : ${esc(rewardText(st.reward, formatNumber))}"` });
    ms = mpRow({ icon: img(def.icon), title: `Récompense ${Math.min(st.claimed + 1, def.milestones.length)}/${def.milestones.length}`, sub: st.next === null ? '' : `<div class="mp-rw">${rewardIcons(st.reward)}</div>`, bar: Math.min(1, st.found / Math.max(1, goal)), n: `${st.found}/${goal}`, right, cls: st.ready ? 'ready' : '' });
  }
  const found = progress.sections.find((x) => x.id === sec);
  const count = found ? `<div class="mp-reset">${esc(found.label)} : ${found.found}/${found.total} découverts</div>` : '';
  let body;
  if (sec === 'museum') body = mMuseum(state);
  else if (sec === 'pantheon') body = mPantheon();
  else body = { monsters: () => mMonsters(state), bosses: () => mBosses(state), mutations: () => mMutations(state), items: () => mItems(state, v.encSlot ?? 'all'), companions: () => mCompanions(state) }[sec]();
  const env = mBtn('Environnements des mondes', { action: 'mp-open', value: 'enc:env', icon: 'icon_map' });
  const sheetKey = typeof v.mSheet === 'string' && v.mSheet.startsWith('enc:') ? v.mSheet.slice(4) : '';
  return `${mpFrame('icon_book', 'Encyclopédie', `${head}${modes}${ms}${count}${body}<div class="mp-gap"></div>${env}`, true, Boolean(sheetKey))}${sheetKey ? mEncSheet(ui, state, sheetKey) : ''}`;
}

// v9.1.0 : deux systèmes sur un écran, dans cet ordre — en-tête (pourcentage et paliers de l'encyclopédie, pour ses
// 5 sections seulement), sections avec leur palier (v9.1.3 : ancien Codex), puis le Musée (compteur propre, sans effet
// sur le pourcentage). Le Musée n'est pas une section de l'encyclopédie (core/encyclopedia.js ne le compte pas).
export default {
  id: 'encyclopedia',
  title: 'Collections',
  icon: 'icon_book',
  extra: (ui, state) => `${pct(encyclopediaProgress(state).pct)}`,
  render(ui, state) {
    // v10.13 : le PC aussi en kit (cadre, cartouche, puces, fiche latérale) ; isMPhone ne sert plus qu'à la mise en page.
    return encPhone(ui, state, isMPhone(ui));
    const v = ui.view;
    const progress = encyclopediaProgress(state);
    const sec = v.encSec === 'museum' || v.encSec === 'pantheon' || ENCYCLOPEDIA_SECTIONS.some((s) => s.id === v.encSec) ? v.encSec : 'monsters';
    const tabs = progress.sections.map((s) => `<button class="enc-tab${s.id === sec ? ' active' : ''}" data-action="enc-sec" data-value="${s.id}">
      ${img(s.icon)}<span>${s.label}</span><small>${s.found}/${s.total}</small>${s.milestones && sectionStatus(state, s.id).ready ? '<i class="badge enc-ready-dot" aria-label="À récupérer"></i>' : ''}${progressBar(s.found / s.total)}</button>`).join('')
      + `<button class="enc-tab museum-tab${sec === 'museum' ? ' active' : ''}" data-action="enc-sec" data-value="museum">
      ${img('icon_trophy')}<span>Musée</span><small>${museumCount(state)}/${MUSEUM_PIECES.length}</small>${progressBar(museumCount(state) / MUSEUM_PIECES.length)}</button>`
      + `<button class="enc-tab${sec === 'pantheon' ? ' active' : ''}" data-action="enc-sec" data-value="pantheon">${img('icon_trophy')}<span>Panthéon</span><small>${pantheonCount()}</small></button>`; // v9.7.1 (lot 7)
    let body;
    if (sec === 'museum') body = museumView(ui, state);
    else if (sec === 'pantheon') body = pantheonView(state); // v9.7.1 (lot 7)
    else {
      const sel = v.encSel?.startsWith(`${PREFIX[sec]}:`) ? v.encSel : FIRST[sec]();
      const list = { monsters: () => monsterList(state, sel), bosses: () => bossList(state, sel), mutations: () => mutationList(state, sel),
        items: () => itemList(state, sel, v.encSlot ?? 'all'), companions: () => companionList(state, sel) }[sec]();
      body = `<div class="codex enc-body"><div class="card enc-list">${list}</div><div class="card codex-detail">${detail(state, sel)}</div></div>`;
    }
    return `<div class="card">${milestones(state, progress)}</div><div class="enc-tabs">${tabs}</div>${sec === 'museum' || sec === 'pantheon' ? '' : sectionMilestone(state, sec)}${body}
      ${fold(ui, 'enc-env', 'Environnements des mondes', envTable(state))}`;
  },
};

// v9.7.1 (lot 7) : Panthéon — la galerie des grands boss rencontrés (fiches data/grand-bosses.js) : histoire, meilleur
// score, ce qu'ils donnent ; les emplacements futurs (Titans, dieux) sont visibles en silhouette, pour donner envie.
const FUTURE = ['Titan des Abysses', 'Dieu de l\'Orage', 'Mère des Dragons'];
function pantheonCount() { return `${Object.values(GRAND_BOSSES).filter((b) => !b.test).length}/${Object.values(GRAND_BOSSES).filter((b) => !b.test).length + FUTURE.length}`; }
function pantheonView(state) {
  const met = Object.values(GRAND_BOSSES).filter((b) => !b.test);
  const best = (id) => (id === 'colossus' ? Math.max(state.worldBoss?.best ?? 0, state.records?.worldBossBest ?? 0) : state.grand?.[id]?.best ?? 0);
  const cards = met.map((b) => `<div class="card pantheon-card"><div class="pantheon-art" style="background-image:url('${b.art.dir}/${b.art.prefix}idle.png')"></div>
      <div><b>${escapeHtml(b.name)}</b> <span class="muted">· ${escapeHtml(b.title ?? '')}</span><p>${escapeHtml(b.lore ?? '')}</p>
      <div>Meilleur score : <b class="num">${formatNumber(best(b.id))}</b>${b.id === 'colossus' ? ` · Revanche <b>${revengeLevel(state)}/${REVENGE_STEPS}</b>` : ''}</div>
      <div class="muted">Donne : ${Object.entries(b.rewards ?? {}).map(([k, n]) => `${n} ${{ gems: 'gemmes', shards: 'éclats' }[k] ?? k}`).join(', ')}</div></div></div>`).join('');
  const ghosts = FUTURE.map((n) => `<div class="card pantheon-card ghost"><div class="pantheon-art silhouette"></div><div><b>???</b><p class="muted">${escapeHtml(n)} — bientôt.</p></div></div>`).join('');
  return `<div class="pantheon">${cards}${ghosts}</div>`;
}
