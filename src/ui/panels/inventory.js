// Inventaire en 3 zones (équipement porté · fiche de l'objet · grille) et Forge.
import { elementBadge, elementWheel, zoneElement, wheelShown } from '../../core/elements.js'; // v9.5.1
import { heroElement } from '../../core/companions.js'; // v9.6.1
import { BIND_MODES } from '../../core/loadouts.js'; // v9.6.1
import { MAJOR_EFFECTS } from '../../data/major-effects.js'; // v9.6.1
import { activeMajor } from '../../core/inventory.js'; // v9.6.1
import { GEAR_PROFILES, profileGain } from '../../core/inventory.js'; // v9.5.2
const PROFILE_ICONS = { attack: 'icon_damage', survival: 'icon_defense', fortune: 'icon_gold' };
const PROFILE_TIPS = { attack: 'Pour passer un boss : les dégâts d\'abord', survival: 'Pour tenir dans un monde dur : la survie d\'abord', fortune: 'Pour farmer : l\'or et le butin d\'abord' };
import { currentEncounter as encNow, levelForStage } from '../../core/combat.js'; // v9.5.1
import { canEquip, classById, weaponClass } from '../../core/classes.js';
import { companionById, companionMultiplier, unitLevel } from '../../core/companions.js';
import { gearClassOf as gearClassOfUnit } from '../../data/companion-gear.js';
import { BALANCE } from '../../data/balance.js';
import { BOSSES } from '../../data/enemies.js';
import { EQUIP_SLOTS, HERO_SLOTS, RARITIES, SLOTS, STAT_LABELS, eqSlot, heroSlot } from '../../data/items.js';
import { bestGearFor, canEquip as unitCanEquip, classLabel, gearStats, slotName, statText, unitGear, wearerOf, wornItems } from '../../core/companion-gear.js'; // v9.3.4 (f)
import { heroGearClass, itemClass } from '../../core/classes.js';
import { teamUpgradeFor } from '../../core/inventory.js';
import { companionStill } from './expeditions.js';
import { formatStat } from '../../core/format.js';
import { canReforge, canTargetReroll, craftCost, fusionInheritOptions, fusionUsed, targetRerollChoices, targetRerollCost, fusableRarities, fusionChance, fusionGroups, fusionKeep, fusionPity, maxUpgrades, sharpenCost, upgradeCost } from '../../core/forge.js';
import { KEEP_AFFIX_LABELS, bulkRecycleCandidates, isUpgrade, listInventory, RECYCLE_MODES, recycleRules } from '../../core/inventory.js';
import { itemBase, rarityById, recycleLevelOf, recycleMaterials, recycleValue } from '../../core/loot.js';
import { computeHeroStats, statsWithItem } from '../../core/stats.js';
import { slotIconName } from '../../render/pixel.js';
import {
  affixText, coin, costButton, effectText, escapeHtml, fold, formatDecimal, formatNumber, img, itemFrame, rarityLabel, segment, shard,
} from '../common.js';
import { navPath } from '../nav.js';
import { setById, setCounts } from '../../core/sets.js';
import { ITEM_SETS, SET_PIECES, SET_SPECIALTY } from '../../data/sets.js';
import { ZONES } from '../../data/zones.js'; // v9.5.2
import { STASH_SIZE, stashSets } from '../../core/stash.js';
import { MUSEUM, MUSEUM_PIECES, isMuseumDuplicate, museumCount, museumDuplicates, museumEffects } from '../../core/museum.js';
import { itemIconUrl } from '../../render/pixel.js';
import { animCanvas } from '../animator.js';
import { invFeatureOpen, nextInvUnlock } from '../../core/unlocks.js';
import { recycleButton } from './forge.js'; // v9.3.4

const STAT_ICONS = { damage: 'weapon_sword', attackSpeed: 'icon_bolt', maxHp: 'icon_heart', armor: 'icon_shield' };
// v9.3.2 : aperçu des effets visuels de l'arme (purement visuels, sans statistique cachée).
const FX_TEXT = { common: 'aucun effet', rare: 'lueur bleue sur la lame, étincelles à l\'impact', epic: 'lame violette lumineuse, traînée large, onde à l\'impact',
  legendary: 'aura dorée, particules au repos, traînée éclatante, onde à l\'impact, éclat sur les compétences' };
function weaponFxLine(item) {
  if (item.slot !== 'weapon') return '';
  return `<div class="muted fx-line"><span class="rarity-dot r-${item.rarity}"></span> Effets visuels en combat : ${FX_TEXT[item.rarity] ?? FX_TEXT.common} <small>(visuels seulement)</small></div>`;
}
const SORT_LABELS = { rarity: 'Rareté', level: 'Niveau', power: 'Puissance', recent: 'Récent' };

export function visibleItems(state) {
  return listInventory(state, { slot: state.ui.slotFilter, sortBy: state.ui.sortBy, rarity: state.ui.rarityFilter ?? 'all' });
}

// v8.4 : les accessoires comptent aussi pour leurs effets (or, butin, critique, épines, dégâts contre les boss…).
const BONUS_ROWS = {
  goldPct: ['Or', ' %'], dropChance: ['Chance de butin', ' pts'], xpPct: ['XP', ' %'], critChance: ['Coup critique', ' %'],
  damageVsBossPct: ['Dégâts contre les boss', ' %'], damageVsNormalPct: ['Dégâts contre les ennemis', ' %'],
  lifesteal: ['Vol de vie', ' %'], thorns: ['Épines', ' %'], regenPct: ['Régénération', ' %/s'], attackSpeedPct: ['Vitesse d\'attaque', ' %'],
  skillCooldownPct: ['Recharge des compétences', ' %'], lowHpArmor: ['Armure sous 30 % PV', ' %'],
};
function bonusRows(a, b, row) {
  return Object.entries(BONUS_ROWS).filter(([k]) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) > 1e-6)
    .map(([k, [label, unit]]) => row(label, a[k] ?? 0, b[k] ?? 0, (v) => formatDecimal(v), unit)).join('');
}

function detail(ui, state, item, whoUnit = null) {
  const rarity = rarityById(item.rarity);
  const base = itemBase(item.baseId);
  const wearer = wearerOf(state, item.id); // v9.3.4 (f) : porté par un compagnon
  const isEquipped = state.equipment[heroSlot(item)]?.id === item.id || Boolean(wearer);
  const stats = Object.entries(item.stats).map(([k, v]) => `<li>${img(STAT_ICONS[k])}${STAT_LABELS[k]}
    <b class="num ${v < 0 ? 'bad' : 'good'}">${formatStat(k, v, true)}</b></li>`).join('');
  const affixes = (item.affixes ?? []).map((a) => `<li class="affix">✦ ${affixText(a)}</li>`).join('');

  let compare = '';
  if (!isEquipped) {
    const cur = computeHeroStats(state);
    const next = statsWithItem(state, item);
    // Héros actuel → héros avec cet objet (à la place de l'objet porté), et la différence.
    const row = (label, a, b, fmt, unit = '') => {
      const diff = b - a;
      if (Math.abs(diff) < 0.001) return ''; // v9.1.0 : seules les lignes qui changent
      const cls = Math.abs(diff) < 0.001 ? 'muted' : diff > 0 ? 'good' : 'bad';
      const arrow = Math.abs(diff) < 0.001 ? '•' : diff > 0 ? '▲' : '▼';
      return `<div class="compare-row"><span>${label}</span><span class="num muted">${fmt(a)}${unit} → ${fmt(b)}${unit}</span>
        <span class="num ${cls}">${diff > 0 ? '+' : ''}${fmt(diff)}${unit} ${arrow}</span></div>`;
    };
    const current = state.equipment[heroSlot(item)];
    const int = (v) => formatNumber(Math.round(v));
    const rows = [row('Dégâts/s', cur.dps, next.dps, (v) => formatDecimal(v)),
      row('Dégâts', cur.damage, next.damage, int),
      row('Attaques / s', cur.attacksPerSecond, next.attacksPerSecond, (v) => formatDecimal(v, 2)),
      row('PV max', cur.maxHp, next.maxHp, int),
      row('Armure', cur.armor, next.armor, (v) => formatDecimal(v), ' %'),
      bonusRows(cur.bonus, next.bonus, row)].join('');
    // v9.8 (A) : l'effet réel de l'objet en % de la puissance (dégâts/s × robustesse), à la place des seuls chiffres bruts
    // (« +6,3 M » à côté d'une attaque en Qa paraissait nul alors que l'objet entre dans tous les multiplicateurs).
    const pw = (x) => (x.combatPower ?? x.dps * x.maxHp);
    const gain = pw(cur) > 0 ? (pw(next) / pw(cur) - 1) * 100 : 0;
    const big = `<div class="compare-power ${gain > 0.05 ? 'good' : gain < -0.05 ? 'bad' : 'muted'}"><b>${gain > 0 ? '+' : ''}${formatDecimal(gain, Math.abs(gain) < 10 ? 1 : 0)} %</b> de puissance</div>`;
    compare = `<div class="compare"><div class="section-title">Si tu l'équipes${current ? ` (à la place de ${escapeHtml(current.name)})` : ' (emplacement vide)'}</div>
      ${big}${rows || '<div class="muted">Aucun changement.</div>'}
    </div>`;
  }
  const mats = recycleMaterials(item);
  // v9.1.3 : verrou en icône dans l'en-tête de la fiche (plus de grand bouton texte).
  const lock = `<button class="btn icon-btn lock-btn${item.locked ? ' on' : ''}" data-action="lock" data-id="${item.id}" aria-pressed="${item.locked}"
      aria-label="${item.locked ? 'Déverrouiller' : 'Verrouiller'}" title="${item.locked ? 'Verrouillé : jamais recyclé ni fusionné (appuyer pour déverrouiller)' : 'Verrouiller : jamais recyclé ni fusionné'}">${img('icon_lock')}<span class="icon-word" aria-hidden="true">Verrou</span></button>`;
  const sharpen = sharpenCost(state, item);
  // Amélioration : +12 % sur une statistique au hasard, 5 fois (Commun, Rare) ou 10 fois (Épique, Légendaire).
  const ups = item.upgrades ?? 0;
  const maxUp = maxUpgrades(item);
  const upCost = upgradeCost(item);
  // Boutons toujours aux mêmes places, quel que soit l'objet : ceux qui ne s'appliquent pas sont grisés.
  const upgradeBtn = ups >= maxUp
    ? `<button class="btn btn-gold" disabled>Renforcement maximal (+${maxUp})</button>`
    : `<button class="btn btn-gold num" data-action="upgrade-item" data-id="${item.id}" data-cost="${upCost.gold}" data-currency="gold"
        ${state.materials.shards < upCost.shards ? 'data-locked="1" disabled' : state.gold < upCost.gold ? 'disabled' : ''}
>Renforcer +${ups + 1} ${coin()} ${formatNumber(upCost.gold)} ${shard()} ${upCost.shards}</button>`;
  const sharpenBtn = sharpen
    ? costButton({ action: 'sharpen', cost: sharpen, have: state.materials.shards, currency: 'shards', attrs: `data-id="${item.id}"`, cls: 'small', label: `Réaffûter niv. ${state.maxStage} ` })
    : '<button class="btn small" disabled>Réaffûter (déjà au niveau)</button>';
  const reforgeBtn = `<button class="btn small" data-action="reforge" data-id="${item.id}"
      ${!canReforge(item) || state.materials.shards < BALANCE.forge.reforgeShards ? 'disabled' : ''}
>${canReforge(item) ? 'Relancer les effets' : 'Aucun effet à relancer'} ${shard()}${BALANCE.forge.reforgeShards}</button>`;
  // v9.1.3 (doc3 lot 3) : relance orientée — choix de l'effet dans une liste, puis un 2e appui confirme.
  let targetLine = '';
  if (canTargetReroll(item)) {
    const choices = targetRerollChoices(item);
    const sel = choices.includes(ui.view.rerollType) ? ui.view.rerollType : choices[0];
    const cost = targetRerollCost(item);
    const armed = ui.view.rerollArmed === `${item.id}|${sel}`;
    const what = item.rarity === 'legendary' ? 'Impose la 1re ligne d\'effet (les autres au hasard). Valeur ±20 %.' : 'Impose l\'effet spécial. Valeur ±20 %.';
    targetLine = `<div class="tool-line target-reroll"><select data-action="reroll-type" aria-label="Effet voulu">${choices.map((t) => `<option value="${t}"${t === sel ? ' selected' : ''}>${escapeHtml(KEEP_AFFIX_LABELS[t] ?? t)}</option>`).join('')}</select>
      <button class="btn small${armed ? ' btn-gold' : ''}" data-action="target-reroll" data-id="${item.id}" data-value="${sel}" ${state.materials.shards < cost ? 'disabled' : ''}>${armed ? 'Confirmer' : 'Relancer vers'} ${shard()}${cost}</button>
      <span class="muted">${what}</span></div>`;
  }
  // v9.1.0 : toujours visibles (même dans la fiche du téléphone) : Équiper et Recycler (le verrou est dans l'en-tête).
  const actions = `<div class="action-grid main-actions">
      ${isEquipped ? '<button class="btn btn-primary" disabled>Équipé</button>' : canEquip(state, item)
        ? `<button class="btn btn-primary primary-action" data-action="equip" data-id="${item.id}">Équiper</button>`
        : `<button class="btn" disabled>Pour : ${escapeHtml(weaponClass(item.baseId)?.name ?? classLabel(itemClass(state, item)))}</button>`}
      <button class="btn btn-outline-gold" data-action="recycle" data-id="${item.id}" ${item.locked || isEquipped ? 'disabled' : ''}>Recycler +${formatNumber(recycleValue(item, BALANCE, recycleLevelOf(state)))} ${coin()}${mats.shards ? ` +${mats.shards}${shard()}` : ''}</button>
    </div>
    ${!isEquipped && !canEquip(state, item) ? `<div class="muted">Change de classe pour la porter : ${navPath('hero', 'Classe')}.</div>` : ''}`;
  // v9.1.3 (doc1 « Équipement : Fiche ») : trois onglets au lieu d'un long repli « Détails ».
  const tab = ['compare', 'upgrade', 'store'].includes(ui.view.itemTab) ? ui.view.itemTab : 'compare';
  const tabs = `<div class="item-tabs" role="tablist">${[['compare', 'Comparer'], ['upgrade', 'Améliorer'], ['store', 'Ranger']].map(([k, l]) => `<button class="btn chip-btn small${k === tab ? ' active' : ''}"
      role="tab" aria-selected="${k === tab}" data-action="item-tab" data-value="${k}">${l}</button>`).join('')}</div>`;
  const stash = state.stash.length >= STASH_SIZE;
  let body;
  if (tab === 'upgrade') {
    body = `<div class="upgrade-line">${upgradeBtn}<span class="muted num">${ups}/${maxUp}</span></div>
      <div class="muted">Renforcer : une statistique au hasard +${BALANCE.forge.upgradeBoostPct} %.</div>
      <div class="tool-line">${sharpenBtn}<span class="muted">Remonte l'objet au niveau de ton étape max.</span></div>
      <div class="tool-line">${reforgeBtn}<span class="muted">Change les effets spéciaux au hasard.</span></div>
      ${targetLine}`;
  } else if (tab === 'store') {
    body = isEquipped ? '<div class="muted">Un objet porté ne se range pas : retire-le d\'abord en équipant un autre objet.</div>'
      : `<div class="tool-line"><button class="btn small" data-action="to-stash" data-id="${item.id}" ${stash ? 'disabled' : ''}>Ranger au coffre (${state.stash.length}/${STASH_SIZE})</button>
        <span class="muted">Jamais recyclé ni fusionné.</span></div>
      ${base.signature ? `<div class="tool-line"><button class="btn small btn-gold" data-action="to-museum" data-id="${item.id}">Exposer au Musée</button></div>` : ''}`;
  } else {
    body = `${compare}<ul class="stat-list">${stats}${affixes}</ul>${weaponFxLine(item)}${setBlock(state, item)}`;
  }
  // v9.3.4 : popup d'objet — grande icône, nom coloré, pastilles, « Puissance +X » en gros, 3 statistiques au plus
  // (chacune une fois), Équiper / Recycler ; le reste (Améliorer, Verrouiller, Ranger, effets, ensemble) derrière « ⋯ ».
  const curP = computeHeroStats(state).combatPower;
  const forHero = !whoUnit && !wearer && canEquip(state, item);
  const gain = isEquipped || !forHero ? null : Math.round(statsWithItem(state, item).combatPower - curP);
  const unitFor = wearer ? companionById(wearer) : whoUnit;
  const better = !forHero && !wearer ? teamUpgradeFor(state, item) : null;
  const power = wearer ? `<div class="ip-power on">Porté par ${escapeHtml(companionById(wearer)?.name ?? '')}</div>`
    : isEquipped ? '<div class="ip-power on">Porté</div>'
    : forHero ? `<div class="ip-power ${gain > 0 ? 'good' : gain < 0 ? 'bad' : 'muted'}">Puissance ${gain > 0 ? '+' : ''}${formatNumber(gain)}</div>`
    : `<div class="ip-power ${better ? 'good' : 'muted'}">${better ? `Meilleur pour ${escapeHtml(companionById(better)?.name ?? '')}` : `Pour : ${escapeHtml(classLabel(itemClass(state, item)))}`}</div>`;
  // v9.5.2 (2.2) : Puissance contextuelle — gain réel ici (monstres ordinaires) et contre le prochain boss, et gain par
  // profil (un objet moins « puissant » peut être meilleur dans la situation, et la fiche le dit).
  let ctxLine = '';
  if (forHero && !isEquipped) {
    const cur = computeHeroStats(state), nx = statsWithItem(state, item);
    const here = (st) => st.dps * (1 + (st.bonus?.damageVsNormalPct ?? 0) / 100);
    const boss = (st) => st.dps * (1 + ((st.bonus?.damageVsBossPct ?? 0) + (st.bossDamagePct ?? 0)) / 100);
    const pct = (a, b) => Math.round((b / a - 1) * 100);
    const h = pct(here(cur), here(nx)), b = pct(boss(cur), boss(nx));
    const sign = (v) => `<b class="${v > 0 ? 'good' : v < 0 ? 'bad' : 'muted'}">${v > 0 ? '+' : ''}${v} %</b>`;
    const prof = ['attack', 'survival', 'fortune'].filter((p) => profileGain(cur, nx, p) > 0.01).map((p) => GEAR_PROFILES[p].label);
    ctxLine = `<div class="ip-ctx">Dégâts ${sign(h)} ici · ${sign(b)} contre le prochain boss${prof.length ? ` · <span class="good">Meilleur pour : ${prof.join(', ')}</span>` : ''}</div>`;
  }
  const unitLine = unitFor || (!forHero && !wearer) ? `<div class="muted ip-unit">${escapeHtml(statText(gearStats(item, state)))}</div>` : '';
  const three = Object.entries(item.stats).slice(0, 3).map(([k, v]) => `<li>${img(STAT_ICONS[k])}${STAT_LABELS[k]} <b class="num">${formatStat(k, v, true)}</b></li>`).join('');
  const more = ui.view.itemMore === item.id;
  const unitTarget = whoUnit && unitCanEquip(state, whoUnit.id, item).ok ? whoUnit : better ? companionById(better) : null;
  const mainBtns = `${wearer ? `<button class="btn" data-action="gear-unequip" data-value="${wearer}|${eqSlot(item)}">Retirer</button>`
      : isEquipped ? '<button class="btn" disabled>Équipé</button>'
      : unitTarget ? `<button class="btn btn-gold" data-action="gear-equip" data-value="${unitTarget.id}|${item.id}">Équiper sur ${escapeHtml(unitTarget.name)}</button>`
      : forHero ? `<button class="btn btn-gold" data-action="equip" data-id="${item.id}">Équiper</button>`
      : `<button class="btn" disabled>Pour : ${escapeHtml(item.cls && item.cls !== heroGearClass(state) ? classLabel(item.cls) : weaponClass(item.baseId)?.name ?? '')}</button>`}
    <button class="btn" data-action="recycle" data-id="${item.id}" ${item.locked || isEquipped ? 'disabled' : ''}>Recycler +${formatNumber(recycleValue(item, BALANCE, recycleLevelOf(state)))} ${coin()}${mats.shards ? ` +${mats.shards}${shard()}` : ''}</button>
    <button class="btn ip-more${more ? ' active' : ''}" data-action="item-more" data-value="${more ? '' : item.id}" aria-expanded="${more}" aria-label="Plus d'actions">⋯</button>`;
  // v9.8 (I2) : trois gros boutons illustrés (Renforcer, Remettre au niveau, Changer l'effet), le coût avec le nom de la
  // monnaie, et « Protéger » au lieu d'un cadenas seul.
  const shardN = (n) => `${shard()} ${n} éclats`;
  const lvlNow = levelForStage(state.maxStage);
  const bigTool = (action, icon, title, sub, cost, ok, extra = '') => `<button class="ip-tool" data-action="${action}" data-id="${item.id}" ${extra} ${ok ? '' : 'disabled'}>
      ${img(icon)}<b>${title}</b><small>${sub}</small><span class="ip-cost">${cost}</span></button>`;
  const tools = `<div class="ip-tools">
      ${ups >= maxUp ? bigTool('upgrade-item', 'icon_anvil', 'Renforcer', `Au maximum (+${maxUp})`, '—', false)
        : bigTool('upgrade-item', 'icon_anvil', 'Renforcer', `+${ups} → +${ups + 1} · une stat +${BALANCE.forge.upgradeBoostPct} %`, `${coin()} ${formatNumber(upCost.gold)} · ${shardN(upCost.shards)}`,
          state.gold >= upCost.gold && state.materials.shards >= upCost.shards, `data-cost="${upCost.gold}" data-currency="gold"`)}
      ${bigTool('sharpen', 'icon_shard', 'Remettre au niveau', sharpen ? `L'objet passe au niveau ${lvlNow}` : 'Déjà au niveau de ton étape', sharpen ? shardN(sharpen) : '—', Boolean(sharpen) && state.materials.shards >= sharpen)}
      ${bigTool('reforge', 'icon_star', 'Changer l\'effet', canReforge(item) ? 'Nouveaux effets spéciaux au hasard' : 'Aucun effet spécial', shardN(BALANCE.forge.reforgeShards), canReforge(item) && state.materials.shards >= BALANCE.forge.reforgeShards)}
    </div>`;
  const protect = `<button class="btn${item.locked ? ' btn-gold' : ''}" data-action="lock" data-id="${item.id}" aria-pressed="${item.locked}">${img('icon_lock')} ${item.locked ? 'Protégé' : 'Protéger'}</button>`;
  const moreBody = more ? `<div class="ip-more-box">
      ${tools}${targetLine ? `<details class="ip-target"><summary>Choisir l'effet voulu</summary>${targetLine}</details>` : ''}
      <div class="tool-line">${protect} ${isEquipped ? '' : `<button class="btn small" data-action="to-stash" data-id="${item.id}" ${stash ? 'disabled' : ''}>Ranger au coffre</button>`}
        ${base.signature ? `<button class="btn small btn-gold" data-action="to-museum" data-id="${item.id}">Exposer au Musée</button>` : ''}</div>
      ${affixes ? `<div class="section-title">Effets spéciaux</div><ul class="stat-list">${affixes}</ul>` : ''}${setBlock(state, item)}</div>` : '';
  return `<div class="unit-pop-backdrop" data-action="close-sheet"></div>
  <div class="unit-pop item-pop r-${item.rarity}" role="dialog" aria-modal="true" aria-label="${escapeHtml(item.name)}">
    <button class="btn small up-close" data-action="close-sheet" aria-label="Fermer">✕</button>
    <div class="ip-head">${itemFrame(item, { tag: 'div' })}
      <div><div class="ip-name r-${item.rarity}">${escapeHtml(item.name)}${ups ? ` +${ups}` : ''}</div>
        <div class="ip-pills"><span class="rar-pill r-${item.rarity}">${rarity.label}</span><span class="role-pill">${HERO_SLOTS[heroSlot(item)]}</span><span class="role-pill cls-pill">${escapeHtml(classLabel(itemClass(state, item)))}</span>
        ${base.signature ? `<span class="role-pill">Butin de ${escapeHtml(BOSSES[base.signature].name)}</span>` : ''}</div></div></div>
    ${majorLine(state, item)}${power}${ctxLine}${unitLine}<ul class="stat-list ip-stats">${three}</ul>
    ${moreBody}
    <div class="up-actions">${mainBtns}</div>
  </div>`;
}

// v9.6.1 (2.4) : grand effet de l'objet, et s'il est actif (un seul à la fois).
function majorLine(state, item) {
  const m = MAJOR_EFFECTS[item.major];
  if (!m) return '';
  const act = activeMajor(state);
  const worn = Object.values(state.equipment).some((i) => i?.id === item.id);
  const st = worn ? (act?.id === item.major && state.equipment[act.slot]?.id === item.id ? '<span class="good">actif</span>' : '<span class="bad">inactif : un seul grand effet à la fois</span>')
    : act ? `<span class="muted">remplacerait « ${escapeHtml(MAJOR_EFFECTS[act.id].name)} »</span>` : '';
  return `<div class="ip-major" style="--mc:${m.color}"><b>${escapeHtml(m.name)}</b> — ${escapeHtml(m.text)} ${st}</div>`;
}

// v9.5.2 (2.3) : bandeau Ensembles — pour chaque ensemble entamé : pièces portées / possédées, prochain palier, spécialité
// et où trouver les pièces manquantes (le monde de l'ensemble).
// v9.8 (B2) : sous le sac, replié par défaut (le titre donne le nombre d'ensembles entamés).
function setsBanner(ui, state) {
  const worn = setCounts(state.equipment);
  const owned = {};
  for (const i of [...state.inventory, ...(state.stash ?? []), ...Object.values(state.equipment).filter(Boolean)]) if (i?.set) owned[i.set] = (owned[i.set] ?? 0) + 1;
  const rows = ITEM_SETS.filter((st) => owned[st.id]).map((st) => {
    const w = worn[st.id] ?? 0;
    const next = SET_PIECES.find((n) => n > w);
    const nb = next ? effectText(st.bonuses[next]) : '';
    return `<div class="set-row" style="--sc:${st.color}"><b>${escapeHtml(st.name)}</b> <span class="set-tag">${SET_SPECIALTY[st.id] ?? ''}</span>
      <span class="num">${w}/6 portées · ${owned[st.id]} possédées</span>${next ? ` · <span class="muted">à ${next} : ${nb} — pièces : ${escapeHtml(ZONES[st.zone]?.name ?? '')}</span>` : ' · <span class="good">complet</span>'}</div>`;
  }).join('');
  const hel = heroElement(state); // v9.6.1 (4.6) : 2 pièces d'un ensemble donnent son élément au héros
  const elLine = `<div class="muted">Élément du héros : ${hel ? elementBadge(hel) : 'neutre'} (2 pièces d'un ensemble lui donnent l'élément de son monde).</div>`;
  const n = Object.keys(owned).length;
  return rows ? `<div class="sets-banner">${fold(ui, 'inv-sets', 'Ensembles', () => elLine + rows, { extra: `${n} entamé${n > 1 ? 's' : ''}` })}</div>` : '';
}

// Ensemble d'équipement (v8.5) : pièces portées et paliers de bonus.
function setBlock(state, item) {
  const set = setById(item.set);
  if (!set) return '';
  const worn = setCounts(state.equipment)[set.id] ?? 0;
  const tiers = SET_PIECES.map((n) => `<li class="${worn >= n ? 'good' : 'muted'}">${n} pièces : ${effectText(set.bonuses[n])}</li>`).join('');
  return `<div class="set-block" style="--set:${set.color}"><div class="section-title">Ensemble : <b style="color:${set.color}">${img(`set_${set.id}`)} ${escapeHtml(set.name)}</b>
      <span class="muted">${worn}/${SET_PIECES.at(-1)} portées</span></div><ul class="set-tiers">${tiers}</ul></div>`;
}

// Coffre (v8.9) : 300 places, jamais recyclé ni fusionné automatiquement.
function stashView(ui, state) {
  // v9.1.3 (lot F) : mannequins fondus dans le coffre — filtre Ensemble et « Porter » (meilleure pièce par emplacement).
  const sets = stashSets(state);
  const setId = sets.some((x) => x.setId === ui.view.stashSet) ? ui.view.stashSet : null;
  const pool = setId ? state.stash.filter((i) => i.set === setId) : state.stash;
  const items = [...pool].sort((a, b) => rarityById(b.rarity).statMultiplier - rarityById(a.rarity).statMultiplier || b.level - a.level);
  const sel = items.find((i) => i.id === ui.view.stashSel) ?? items[0];
  const grid = items.map((i) => itemFrame(i, { selected: i.id === sel?.id, action: 'stash-sel' })).join('');
  const detail = sel ? `<div class="card item-detail r-${sel.rarity}">
      <div class="detail-head">${itemFrame(sel, { tag: 'div' })}<div><div class="item-name">${escapeHtml(sel.name)}</div>
        <div class="item-sub">${SLOTS[sel.slot]} · <span class="rarity-text">${rarityById(sel.rarity).label}</span> · niv. ${sel.level}</div></div></div>
      <div class="detail-actions main-actions"><button class="btn btn-primary primary-action" data-action="from-stash" data-id="${sel.id}" ${state.inventory.length >= BALANCE.loot.inventorySize ? 'disabled' : ''}>Reprendre au sac</button></div>
      ${state.inventory.length >= BALANCE.loot.inventorySize ? '<div class="bad">Sac plein.</div>' : ''}
      ${fold(ui, 'stash-details', 'Détails', () => `<ul class="stat-list">${Object.entries(sel.stats).map(([k, v]) => `<li>${STAT_LABELS[k]} <b class="num">${formatStat(k, v, true)}</b></li>`).join('')}${(sel.affixes ?? []).map((a) => `<li class="affix">✦ ${affixText(a)}</li>`).join('')}</ul>
        ${setBlock(state, sel)}`)}</div>` : '';
  const auto = state.ui.autoMannequin !== false;
  const filter = sets.length ? `<div class="row stash-sets"><select data-action="stash-set" aria-label="Ensemble">
      <option value="">Tous les objets (${state.stash.length})</option>
      ${sets.map((x) => `<option value="${x.setId}" ${x.setId === setId ? 'selected' : ''}>${escapeHtml(setById(x.setId).name)} (${x.slots}/${Object.keys(SLOTS).length})</option>`).join('')}</select>
      ${setId ? `<button class="btn btn-gold small" data-action="wear-set" data-value="${setId}" title="Équipe la meilleure pièce de chaque emplacement ; l'objet porté prend sa place au coffre">Porter</button>` : ''}</div>` : '';
  const set = setId ? setById(setId) : null;
  const tiers = set ? `<div class="mq-tiers muted">${SET_PIECES.map((p) => `<span>${p} : ${effectText(set.bonuses[p])}</span>`).join(' · ')}</div>` : '';
  const over = state.stash.length > STASH_SIZE ? `<div class="bad">Coffre au-delà de ${STASH_SIZE} (pièces des anciens mannequins) : rien n'est perdu, mais rien n'y entre tant qu'il n'est pas redescendu.</div>` : '';
  return `<div class="muted">Le coffre garde ${STASH_SIZE} objets de plus que le sac, <b>jamais recyclés ni fusionnés</b>. Les pièces d'ensemble meilleures y vont d'elles-mêmes.
      <button class="btn chip-btn small${auto ? ' active' : ''}" data-action="auto-mannequin" title="Une pièce d'ensemble ramassée, meilleure que la meilleure du coffre pour son emplacement, y va (l'ancienne est recyclée, sauf verrouillée)">${auto ? 'Rangement auto : activé' : 'Rangement auto : désactivé'}</button></div>
    ${over}${filter}${tiers}
    ${items.length ? `<div class="stash-layout"><div class="inv-grid">${grid}</div>${detail}</div>` : '<div class="card muted">Le coffre est vide.</div>'}`;
}

// Musée (v9.0) : une vitrine par objet ancestral, bonus permanent par pièce exposée.
export function museumView(ui, state) {
  const auto = state.ui.autoMuseum !== false;
  const pct = (v) => `+${v} %`;
  const per = MUSEUM.perPiece;
  const cases = MUSEUM_PIECES.map((baseId) => {
    const base = itemBase(baseId);
    const item = state.museum[baseId];
    const boss = BOSSES[base.signature];
    const frame = item
      ? `${itemFrame(item, { tag: 'div' })}<button class="btn tiny" data-action="from-museum" data-value="${baseId}" title="Reprendre dans le sac">↩</button>`
      : `<div class="item-frame empty museum-ghost"><img class="px" src="${itemIconUrl({ baseId, rarity: 'common', slot: base.slot })}" alt=""></div>`;
    return `<div class="card museum-case${item ? ` r-${item.rarity}` : ' empty'}">
      <div class="mq-slot">${frame}</div>
      <div class="grow"><b>${escapeHtml(base.name)}</b>
        <div class="muted">${item ? `${rarityById(item.rarity).label} · niv. ${item.level}${item.rarity === 'legendary' ? ' · bonus ×2' : ''}` : `Butin de ${escapeHtml(boss?.name ?? '?')}`}</div></div></div>`;
  }).join('');
  const n = museumCount(state);
  const dupes = museumDuplicates(state).length;
  const total = effectText(museumEffects(state));
  // v9.1.3 (lot F, « Musée en possession », option sans migration) : l'exposition auto reste activée par défaut et
  // fait le travail ; le réglage, « Exposer tout » et les doublons sont repliés dans « Outils du Musée ».
  // La version « modèle obtenu + meilleure rareté » n'est pas faite : voir docs/refontes-v913.md.
  const tools = fold(ui, 'museum-tools', 'Outils du Musée', () => `<div class="row-between">
      <button class="btn chip-btn small${auto ? ' active' : ''}" data-action="auto-museum" title="Les objets ancestraux ramassés vont dans leur vitrine si elle est vide ou s'ils sont meilleurs (l'ancien retourne au sac)">${auto ? 'Exposition auto : activée' : 'Exposition auto : désactivée'}</button>
      <button class="btn btn-gold small" data-action="expose-all" title="Expose les objets ancestraux du sac et du coffre (pas ceux que porte le héros)">Exposer tout (sac + coffre)</button>
      ${dupes ? `<button class="btn btn-danger small" data-action="recycle-museum-dupes" title="Objets ancestraux du sac moins bons que l'exemplaire exposé (les verrouillés sont gardés)">Recycler les doublons (${dupes})</button>` : ''}</div>
      ${dupes ? `<div class="muted">${dupes} objet${dupes > 1 ? 's' : ''} ancestra${dupes > 1 ? 'ux' : 'l'} du sac ${dupes > 1 ? 'sont des doublons' : 'est un doublon'} : la vitrine expose déjà un exemplaire au moins aussi bon. Les objets ancestraux ne sont jamais recyclés automatiquement.</div>` : ''}`,
  { extra: !auto ? '<span class="muted">auto désactivée</span>' : dupes ? `<span class="muted">${dupes} doublon${dupes > 1 ? 's' : ''}</span>` : '' });
  return `<div class="card"><span class="muted">Le Musée expose tes objets ancestraux, un par vitrine, dès qu'ils sont ramassés. Chaque pièce exposée :
      dégâts, PV et or ${pct(per.damageMultPct)} (multiplicatif, ×2 si Légendaire). Collection complète : dégâts et PV +${MUSEUM.complete.damageMultPct} % de plus.
      Une pièce exposée n'est pas portée : reprends-la (↩) pour l'équiper.</span>
      <div class="museum-total"><b>${n}/${MUSEUM_PIECES.length}</b> pièces exposées${n && total ? ` · <span class="good">${total}</span>` : ''}</div>
      ${tools}</div>
    <div class="museum">${cases}</div>`;
}

function bag(ui, state) {
  const items = visibleItems(state);
  const equippedItems = Object.values(state.equipment).filter(Boolean);
  const all = [...state.inventory, ...equippedItems, ...wornItems(state)];
  // v9.3.4 (f) : personnage choisi (héros ou compagnon de l'équipe) : ses 3 places, et le sac vu pour lui.
  const team = (state.companions?.equipped ?? []).map((id) => companionById(id)).filter((c) => c?.kind === 'ally'); // v9.3.8 : compagnons seulement (les familiers ne portent rien)
  const who = team.some((c) => c.id === ui.view.gearWho) ? ui.view.gearWho : 'hero';
  const whoUnit = who === 'hero' ? null : companionById(who);
  let selected = all.find((i) => i.id === ui.view.selectedItemId);
  if (!selected) {
    selected = items[0] ?? state.equipment.weapon ?? equippedItems[0] ?? null;
    ui.view.selectedItemId = selected?.id ?? null;
  }
  const slotFrame = (slot) => {
    const label = whoUnit ? slotName(whoUnit, slot) : HERO_SLOTS[slot];
    const item = whoUnit ? unitGear(state, who)[slot] : state.equipment[slot];
    const frame = item
      ? itemFrame(item, { selected: item.id === ui.view.selectedItemId, equipped: true })
      : `<div class="item-frame empty named" title="${label} : aucun">${img(slotIconName(slot))}<small>${label}</small></div>`;
    return `<div class="slot" title="${label}">${frame}</div>`;
  };
  // v9.1.3 (doc2 A13) : filtre d'emplacement en icônes sur la ligne du tri (il tient sans prendre de hauteur).
  // v9.1.3 (doc3 lot 4) : icône seule = aria-label ; en mode débutant, le mot court reste visible sous l'icône.
  const FILTERS = [['all', 'Tous les objets', null, 'Tous'], ['weapon', 'Armes', 'weapon', 'Armes'], ['armor', 'Armures', 'armor', 'Armures'], ['accessory', 'Accessoires', 'ring', 'Accessoires']];
  const filterChips = FILTERS.map(([v, l, slot, word]) => `<button class="btn chip-btn filter-chip${(state.ui.slotFilter ?? 'all') === v ? ' active' : ''}" data-action="filter" data-value="${v}"
      aria-label="${l}" title="${l}" aria-pressed="${(state.ui.slotFilter ?? 'all') === v}">${slot ? `${img(slotIconName(slot))}<span class="icon-word" aria-hidden="true">${word}</span>` : '<b>Tous</b>'}</button>`).join('');
  const sortOptions = Object.entries(SORT_LABELS)
    .map(([v, l]) => `<option value="${v}" ${v === state.ui.sortBy ? 'selected' : ''}>${l}</option>`).join('');
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  // v9.3.8 (2.4) : par défaut, le sac ne montre que les objets utilisables par le personnage choisi.
  const usableBy = (i) => (whoUnit ? unitCanEquip(state, who, i).ok : canEquip(state, i));
  const shown = ui.view.bagAll ? items : items.filter(usableBy);
  const hidden = items.length - shown.length;
  const previewEq = selected && !whoUnit && heroSlot(selected) in HERO_SLOTS && !wearerOf(state, selected.id) ? { ...state.equipment, [heroSlot(selected)]: selected } : state.equipment;
  const st = computeHeroStats(state);
  // v9.3.8 (2.4) : grands portraits (héros et compagnons de l'équipe) avec niveau et puissance ; le personnage choisi en
  // grand, dessiné comme en combat, ses places tout autour.
  const unitPower = (c) => Math.round(100 * companionMultiplier(state, c.id));
  const whoBtn = (id, label, art, sub) => `<button class="who-card${who === id ? ' active' : ''}" data-action="gear-who" data-value="${id}" aria-pressed="${who === id}" title="${escapeHtml(label)}">
      <span class="who-art">${art}</span><b>${escapeHtml(label)}</b><small>${sub}</small></button>`;
  const whoRow = `<div class="who-row" role="group" aria-label="Personnage">${whoBtn('hero', 'Héros', animCanvas('hero', 34, 34, 2), `Nv ${state.level} · ${formatNumber(st.combatPower)}`)}${team.map((c) => whoBtn(c.id, c.name, companionStill(c), `Nv ${unitLevel(state, c.id)} · ${formatNumber(unitPower(c))}`)).join('')}</div>`;
  const PL = whoUnit ? Object.keys(EQUIP_SLOTS) : Object.keys(HERO_SLOTS);
  const half = Math.ceil(PL.length / 2);
  const equipCol = `<div class="card inv-equip">${whoRow}${wheelShown(state) ? elementWheel(zoneElement(encNow(state).zoneIndex)) : ''}
      <div class="equip-doll big"><div class="slot-col">${PL.slice(0, half).map(slotFrame).join('')}</div>
        <div class="doll" title="Aperçu avec l'objet sélectionné">${whoUnit ? `<span class="doll-unit">${companionStill(whoUnit)}</span>` : animCanvas('hero', 64, 64, 3, `data-big="1" data-preview="${escapeHtml(JSON.stringify(previewEq))}"`)}</div>
        <div class="slot-col acc">${PL.slice(half).map(slotFrame).join('')}</div></div>
      ${whoUnit && bestGearFor(state, who).length ? `<button class="btn btn-gold primary-action" data-action="gear-best" data-value="${who}">⬆ Équiper le meilleur (${bestGearFor(state, who).length})</button>` : ''}
      ${whoUnit ? `<div class="inv-power"><small>${escapeHtml(classLabel(gearClassOfUnit(whoUnit)))}</small><b class="num">${escapeHtml(statText(Object.values(unitGear(state, who)).filter(Boolean).reduce((t, it) => { for (const [k, v] of Object.entries(gearStats(it, state))) t[k] = Math.round(((t[k] ?? 0) + v) * 10) / 10; return t; }, {}))) || '—'}</b></div>`
        : `<div class="inv-power"><small>Puissance</small><b class="num">${formatNumber(st.combatPower)}</b></div>`}</div>`;
  // v9.1.3 (doc1 « Équipement : Sac ») : sur téléphone, les 7 cases portées en une ligne compacte en haut du sac
  // (comme la ligne d'équipement de la Fiche du héros) au lieu du mannequin placé sous la grille.
  const gearRow = `<div class="inv-gear-row" aria-label="Équipement porté">${PL.map(slotFrame).join('')}</div>`;
  return `<div class="inv inv3">
    ${equipCol}
    ${selected && ui.view.sheetOpen === 'item' ? detail(ui, state, selected, whoUnit) : ''}
    <div class="card inv-list">
      ${gearRow}
      ${ui.view.bagMenu ? `<div class="inv-tools"><div class="filter-chips" role="group" aria-label="Emplacement">${filterChips}</div>
        <select data-action="sort" aria-label="Trier">${sortOptions}</select>
        <select data-action="rarity-filter" aria-label="Rareté">${[['all', 'Toutes'], ...RARITIES.map((r) => [r.id, r.label])].map(([v, l]) => `<option value="${v}" ${v === (state.ui.rarityFilter ?? 'all') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      ${ui.view.bagAll ? '<button class="btn small bag-for" data-action="bag-all" data-value="">Seulement les objets utilisables</button>' : `<button class="btn small bag-for" data-action="bag-all" data-value="1">Voir aussi les objets des autres classes${hidden ? ` (${hidden})` : ''}</button>`}` : ''}
      <div class="inv-grid">${shown.map((i) => {
        // v9.3.4 (f) : objet d'une autre classe que le personnage choisi : grisé, « Pour : … ».
        const usable = whoUnit ? unitCanEquip(state, who, i).ok : canEquip(state, i);
        const f = itemFrame(i, { selected: i.id === ui.view.selectedItemId, showUp: true, state, current: st });
        return usable ? f : f.replace('class="item-frame', 'class="item-frame dim').replace(/<\/button>$/, `<span class="for-cls">${escapeHtml(classLabel(itemClass(state, i)))}</span></button>`);
      }).join('')
        || '<div class="inv-empty"><img class="px empty-art" src="assets/ui/art98/empty_chest.png" alt="">Aucun objet ici. Les ennemis laissent parfois tomber de l\'équipement.</div>'}</div>
      ${recycleButton(state)}
      ${full ? '<div class="bad">Sac plein : recycle les objets inutiles ou range au coffre.</div>' : ''}
    </div>
  </div>`;
}

// Réglages du sac (v9.1.0) : un seul écran replié pour tous les automatismes et le recyclage en lot.
// v9.1.3 (doc1 « Équipement : autres », recyclage en 3 entrées) : une phrase et 3 replis. Recycler un objet seul
// se fait depuis sa fiche ; ici le lot, la règle automatique (raretés) et, en avancé, le mode et les filtres.
// Le rangement auto des pièces d'ensemble n'est plus répété ici : il est dans le Coffre (v9.1.3).
function bagSettings(ui, state) {
  const candidates = bulkRecycleCandidates(state, ui.view.bulkRarity);
  const bulkGold = candidates.reduce((s, i) => s + recycleValue(i, BALANCE, recycleLevelOf(state)), 0); // v9.1.3 : même plafond que le recyclage
  const bulkLabel = ui.view.bulkArmed
    ? `Confirmer : ${candidates.length} objet${candidates.length > 1 ? 's' : ''} (+${formatNumber(bulkGold)} or)`
    : `Recycler (${candidates.length}) +${formatNumber(bulkGold)}`;
  const rules = recycleRules(state);
  const lot = () => `<div class="inv-bulk">
      <select data-action="bulk-rarity" aria-label="Rareté maximale à recycler">
        <option value="common" ${ui.view.bulkRarity === 'common' ? 'selected' : ''}>Communs</option>
        <option value="rare" ${ui.view.bulkRarity === 'rare' ? 'selected' : ''}>+ Rares</option>
        <option value="epic" ${ui.view.bulkRarity === 'epic' ? 'selected' : ''}>+ Épiques</option>
        <option value="legendary" ${ui.view.bulkRarity === 'legendary' ? 'selected' : ''}>+ Légendaires</option>
      </select>
      <button class="btn btn-outline-gold${ui.view.bulkArmed ? ' armed' : ''}" data-action="bulk-recycle" ${candidates.length ? '' : 'disabled'}>${bulkLabel}</button>
    </div><div class="muted">Une confirmation est demandée (second appui).</div>`;
  const ruleSummary = rules.mode === 'off' ? 'Désactivé' : RARITIES.filter((r) => rules.rarities.includes(r.id)).map((r) => r.label).join(', ') || 'Aucune rareté';
  return `<div class="muted">Jamais recyclé ni fusionné automatiquement : objet porté, verrouillé, ancestral, ou meilleur que l'objet porté. Un objet seul se recycle depuis sa fiche.</div>
    ${fold(ui, 'bag-lot', 'Recycler en lot', lot)}
    ${fold(ui, 'bag-rule', 'Recyclage automatique', () => recycleRuleEditor(state), { extra: escapeHtml(ruleSummary) })}
    ${fold(ui, 'bag-advanced', 'Réglages avancés : mode, emplacements, effets, fusion auto', () => recycleAdvanced(state))}`;
}

// Builds (v9.1.0) : Enregistrer et Renommer. v9.1.3 (doc2 A11) : une carte par build, résumé d'un coup d'œil
// (classe, équipe, objets, pouvoirs) et « Équiper » sur la carte, au lieu d'une liste déroulante.
// v9.6.1 (2.7) : choix du monde ou du mode auquel un Build s'applique tout seul.
function bindOptions(state, cur) {
  const zones = ZONES.map((z, i) => [`zone:${i}`, `Monde ${i + 1} : ${z.name}`]).filter(([, ], i) => i * 20 < Math.max(state.maxStage, state.records?.bestStage ?? 1));
  return [['', '— aucun —'], ...Object.entries(BIND_MODES), ...zones].map(([v, t]) => `<option value="${v}"${(cur ?? '') === v ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('');
}

function buildsBar(ui, state) {
  const sel = Math.min(state.loadouts.length - 1, Math.max(0, ui.view.buildSel ?? 0));
  const card = (l, i) => {
    const renaming = ui.view.buildRename === i;
    const team = (l.team ?? []).map((id) => companionById(id)).filter(Boolean);
    const items = Object.values(l.gear ?? {}).filter(Boolean).length;
    const summary = l.team
      ? [l.heroClass && classById(l.heroClass) ? escapeHtml(classById(l.heroClass).name) : '',
        ...(team.length ? team.map((c) => escapeHtml(c.name)) : ['sans équipe']),
        `${items}/${Object.keys(SLOTS).length} objets`, (l.powers ?? []).length ? `${l.powers.length} pouvoir${l.powers.length > 1 ? 's' : ''}` : ''].filter(Boolean).map((x) => `<span>${x}</span>`).join(' · ')
      : 'Vide : équipe-toi puis « Enregistrer ».';
    return `<div class="card build-card${i === sel ? ' selected' : ''}">
      <div class="row-between"><b>${escapeHtml(l.name)}</b>
        <span class="build-btns">${l.team ? `<button class="btn small btn-primary" data-action="apply-build" data-value="${i}">Équiper</button>` : ''}
        <button class="btn small" data-action="save-loadout" data-value="${i}">Enregistrer</button>
        <button class="btn small" data-action="rename-build" data-value="${i}" aria-label="Renommer" title="Renommer">✎<span class="icon-word" aria-hidden="true"> Renommer</span></button></span></div>
      <div class="muted">${summary}</div>
      ${l.team ? `<label class="build-bind">Attaché à : <select data-action="bind-build" data-value="${i}">${bindOptions(state, l.bind)}</select></label>` : ''}
      ${renaming ? `<div class="row"><input id="build-name" type="text" maxlength="24" value="${escapeHtml(l.name)}" aria-label="Nouveau nom">
        <button class="btn small btn-primary" data-action="confirm-rename-build" data-value="${i}">OK</button></div>` : ''}
    </div>`;
  };
  return `<div class="build-cards">${state.loadouts.map(card).join('')}</div>`;
}

export function forge(ui, state, part = null) { // v9.3.4 : exportée (onglet Forge)
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  // v9.1.3 (doc3 lot 2) : écran de fusion à pourcentage. « Fusionner tout » (deux appuis) = mises de 5 à 100 %,
  // jamais un objet protégé. Commun/Rare : une ligne et « Fusionner ». Épique : ligne repliée, puis jauge, objets
  // protégés (raison, « Inclure » d'un appui), texte d'échec (absent à 100 %) et une mise par bouton : aucune mise
  // n'est présélectionnée.
  const keep = fusionKeep(state);
  const groups = fusionGroups(state, BALANCE, keep);
  const count = BALANCE.forge.fusionCount;
  const auto = groups.filter((g) => g.auto);
  const n = auto.reduce((t, g) => t + Math.floor(g.usable / count) * count, 0);
  const all = auto.length
    ? `<button class="btn btn-gold primary-action${ui.view.fuseArmed ? ' armed' : ''}" data-action="fuse-all">${ui.view.fuseArmed
      ? `Confirmer : fusionner ${n} objets ?` : `Fusionner tout · ${auto.length} groupe${auto.length > 1 ? 's' : ''}`}</button>` : '';
  const fusion = groups.length
    ? `${all}${ui.view.fuseMsg ? `<div class="bad" role="status">${escapeHtml(ui.view.fuseMsg)}</div>` : ''}<div class="fusion-list">${groups.map((g) => fusionRow(ui, state, g, keep)).join('')}</div>`
    : `<div class="fuse-empty">${Array.from({ length: count }, () => `<div class="item-frame empty">${img('icon_bag')}</div>`).join('<i>+</i>')}<i>→</i><div class="item-frame empty next">${img('icon_star')}</div></div>
        <div class="muted">Il faut ${count} objets identiques (place et rareté).</div>`;
  // Fabrication ciblée : l'emplacement en liste, puis deux boutons (Rare+ et Épique+).
  const slot = SLOTS[ui.view.craftSlot] ? ui.view.craftSlot : 'weapon';
  const craftBtn = (tier) => {
    const cost = craftCost(state, undefined, tier);
    const short = state.gold < cost.gold || state.materials.shards < cost.shards;
    return `<button class="btn ${tier === 'epic' ? 'btn-gold' : 'btn-primary'}" data-action="craft" data-value="${slot}" data-tier="${tier}" ${short || full ? 'disabled' : ''}>
      Fabriquer ${tier === 'epic' ? 'Épique+' : 'Rare+'} · ${coin()} ${formatNumber(cost.gold)} ${shard()} ${cost.shards}</button>`;
  };
  const craft = () => `<div class="muted">Rareté choisie ou mieux, au niveau de ton étape max (${state.maxStage}).</div>
      <div class="row"><select data-action="craft-slot" aria-label="Emplacement à fabriquer">${Object.entries(SLOTS).map(([k, l]) => `<option value="${k}" ${k === slot ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="options-row">${craftBtn('rare')}${craftBtn('epic')}</div>${full ? '<div class="bad">Sac plein.</div>' : ''}`;
  // v9.8 (C2) : une seule partie à la fois (Fusionner ou Fabriquer), les règles derrière « ? ».
  if (part === 'fuse') return `<div class="card">${fusion}
      <details class="forge-help"><summary>?</summary>${BALANCE.forge.fusionCount} objets de même emplacement et de même rareté → 1 objet de la rareté suivante, au niveau du meilleur. Épique : 5 objets = sûr, ou tenter avec moins.</details></div>`;
  if (part === 'craft') return `<div class="card">${craft()}</div>`;
  return `<div class="card">
      <div class="section-title">Fusion</div>
      <div class="muted">${BALANCE.forge.fusionCount} objets de même emplacement et de même rareté → 1 objet de la rareté suivante, au niveau du meilleur.
        <span>Épique : 5 objets = sûr, ou tenter avec moins.</span></div>
      ${fusion}
    </div>
    ${fold(ui, 'forge-craft', 'Fabrication ciblée', craft)}
    <div class="card"><div class="section-title">Matériaux</div>
      <div>${shard()} <b>${formatNumber(state.materials.shards)}</b> éclats</div>
      <div class="muted">Le recyclage et les boss rendent des éclats. Renforcer, Réaffûter et Relancer
        les effets se font depuis la fiche d'un objet (Détails).</div></div>`;
}

// v9.1.3 (doc3 lot 2) : raisons de protection affichées (fusionKeep(state).reason).
const PROTECT_LABELS = { upgraded: 'renforcé', better: "meilleur que l'équipé", set: 'utile à un ensemble', affix: 'effet gardé', build: 'dans un build' };

// Une ligne de fusion : titre (emplacement · rareté → suivante, objets du sac) ; Épique repliée.
function fusionRow(ui, state, g, keep) {
  const key = `${g.slot}|${g.rarity}`;
  const count = BALANCE.forge.fusionCount;
  const included = Boolean(ui.view.fusionInclude?.[key]);
  const avail = g.usable + (included ? g.protected : 0);
  const title = `<span>${img(slotIconName(g.slot))} ${SLOTS[g.slot]} · <b class="r-${g.rarity} rarity-text">${rarityLabel(g.rarity)}</b>
    → <b class="r-${g.next} rarity-text">${rarityLabel(g.next)}</b> <span class="muted">${g.bag} dans le sac</span></span>`;
  const reasons = () => [...new Set(state.inventory.filter((i) => i.slot === g.slot && i.rarity === g.rarity && keep(i))
    .map((i) => keep.reason(i)).filter((r) => PROTECT_LABELS[r]).map((r) => PROTECT_LABELS[r]))].join(', ');
  const protectedLine = g.protected
    ? `<span class="muted">${g.protected} objet${g.protected > 1 ? 's' : ''} protégé${g.protected > 1 ? 's' : ''} (${reasons()})</span>
      <button class="btn small${included ? ' active' : ''}" data-action="fuse-include" data-value="${key}" aria-pressed="${included}">${included ? 'Inclus' : 'Inclure'}</button>` : '';
  const stakeBtn = (stake) => {
    const chance = fusionChance(state, g.slot, g.rarity, stake);
    const label = chance >= 100 ? `Fusionner ${stake} · 100 %` : `Tenter à ${stake} · ${chance} %`;
    return `<button class="btn ${chance >= 100 ? 'btn-gold' : ''} small" data-action="fuse" data-value="${key}" data-stake="${stake}">${label}</button>`;
  };
  // v9.1.3 (doc3 lot 5) : héritage d'ensemble — un appui par ensemble présent, ou « Aucun » (chance de la plus haute mise possible).
  const top = Math.min(count, avail);
  const opts = top > 0 ? fusionInheritOptions(fusionUsed(state, g.slot, g.rarity, included ? fusionKeep(state, { include: [key] }) : keep, top)) : [];
  const chosen = ui.view.fuseSet?.[key] ?? opts[0]?.set;
  const inheritLine = opts.length ? `<div class="fusion-sub inherit-row"><span class="muted">Ensemble hérité :</span>${opts.map((o) => {
    const set = setById(o.set);
    return `<button class="btn chip-btn small${chosen === o.set ? ' active' : ''}" data-action="fuse-set" data-value="${key}" data-set="${o.set}" aria-pressed="${chosen === o.set}">${img(`set_${o.set}`)} ${escapeHtml(set?.name ?? o.set)} · ${o.chance} %</button>`;
  }).join('')}<button class="btn chip-btn small${chosen === 'none' ? ' active' : ''}" data-action="fuse-set" data-value="${key}" data-set="none" aria-pressed="${chosen === 'none'}">Aucun</button></div>` : '';
  if (g.stakes.length === 1) {
    const btn = avail >= count ? `<button class="btn btn-gold small" data-action="fuse" data-value="${key}">Fusionner</button>` : '';
    return `<div class="fusion-row">${title}${btn}</div>${avail < count || included ? `<div class="fusion-sub">${protectedLine}</div>` : ''}${avail >= count ? inheritLine : ''}`;
  }
  const open = ui.view.fuseOpen === key;
  const head = `<button class="fusion-row fusion-head" data-action="fuse-open" data-value="${key}" aria-expanded="${open}">${title}<span aria-hidden="true">${open ? '▾' : '▸'}</span></button>`;
  if (!open) return head;
  const stakes = g.stakes.filter((s) => s <= avail);
  const risky = stakes.some((s) => fusionChance(state, g.slot, g.rarity, s) < 100);
  const step = BALANCE.forge.fusion[g.rarity]?.pityStep ?? 0;
  return `${head}<div class="fusion-detail">
    <div class="fusion-sub"><span class="muted">Jauge +${fusionPity(state, g.slot, g.rarity)}</span>${protectedLine ? `<span class="muted" aria-hidden="true">·</span>${protectedLine}` : ''}</div>
    ${risky ? `<div class="muted">Si échec : 1 objet rendu, jauge +${step}</div>` : ''}${inheritLine}
    <div class="options-row">${stakes.map(stakeBtn).join('') || `<span class="muted">Il faut au moins ${g.stakes[0]} objets utilisables.</span>`}</div></div>`;
}

// Fusion automatique (v8.1) : 5 objets identiques (emplacement + rareté) → 1 objet de rareté supérieure.
function autoFuseEditor(state) {
  const f = state.ui.autoFuse ?? { on: false, rarities: ['common'] };
  const chips = RARITIES.filter((r) => fusableRarities().includes(r.id)).map( // v9.1.3 (doc3 lot 2) : raretés de BALANCE.forge.fusion
    (r) => `<button class="btn chip-btn small${f.rarities.includes(r.id) ? ' active' : ''}" data-action="autofuse" data-group="rarities" data-value="${r.id}">${r.label}</button>`).join('');
  return `<label class="inv-rule" title="Mise de 5 à 100 % seulement. Jamais fusionné : objet verrouillé, ancestral, renforcé, meilleur que l'objet porté, utile à un ensemble, effet gardé ou dans un build."><span>Fusion auto :</span>
      <button class="btn chip-btn small${f.on ? ' active' : ''}" data-action="autofuse" data-group="on">${f.on ? 'Activée' : 'Désactivée'}</button></label>
    ${f.on ? `<div class="chip-row">${chips}</div>` : ''}`;
}

// Recyclage automatique (règle unique) : les raretés recyclées. Le mode (au ramassage / sac plein) est en avancé.
function recycleRuleEditor(state) {
  const rules = recycleRules(state);
  const chip = (group, value, label, on) => `<button class="btn chip-btn small${on ? ' active' : ''}" data-action="recycle-toggle" data-group="${group}" data-value="${value}">${label}</button>`;
  if (rules.mode === 'off') {
    return `<div class="row"><span class="muted">Désactivé.</span><button class="btn small" data-action="recycle-toggle" data-group="mode" data-value="pickup">Activer au ramassage</button></div>`;
  }
  return `<div class="muted">Raretés recyclées · ${RECYCLE_MODES[rules.mode]}</div>
    <div class="chip-row">${RARITIES.map((r) => chip('rarities', r.id, r.label, rules.rarities.includes(r.id))).join('')}</div>`;
}

// Réglages avancés : mode, emplacements, effets à garder, ensembles, fusion automatique.
function recycleAdvanced(state) {
  const rules = recycleRules(state);
  const chip = (group, value, label, on) => `<button class="btn chip-btn small${on ? ' active' : ''}" data-action="recycle-toggle" data-group="${group}" data-value="${value}">${label}</button>`;
  const slots = Object.entries(SLOTS).map(([s, l]) => chip('slots', s, l, rules.slots.includes(s))).join('');
  return `<div class="recycle-rules">
    <label class="inv-rule"><span>Recyclage auto :</span>
      <select data-action="recycle-mode" aria-label="Recyclage automatique">${Object.entries(RECYCLE_MODES)
        .map(([v, l]) => `<option value="${v}" ${v === rules.mode ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${rules.mode === 'off' ? '' : `<div class="chip-row">${slots}</div>
      <div class="section-title">Garder si l'objet a…</div><div class="chip-row">${Object.entries(KEEP_AFFIX_LABELS).map(([k, l]) => chip('keepAffixes', k, l, (rules.keepAffixes ?? []).includes(k))).join('')}</div>`}
    <label class="inv-rule" title="Une pièce d'ensemble est gardée dès que tu en as 2 emplacements différents (la meilleure par emplacement).">
      <span>Ensembles :</span><button class="btn chip-btn small${state.ui.keepSets !== false ? ' active' : ''}" data-action="keep-sets">${state.ui.keepSets !== false ? 'Garder les pièces utiles' : 'Recycler comme le reste'}</button></label>
      <label class="row"><span>Objets inutiles :</span><button class="btn chip-btn small${state.ui.autoUseless !== false ? ' active' : ''}" data-action="auto-useless">${state.ui.autoUseless !== false ? 'Recyclés à la récupération' : 'Gardés dans le sac'}</button></label>
    ${autoFuseEditor(state)}
  </div>`;
}

export default {
  id: 'inventory',
  title: 'Équipement',
  icon: 'icon_bag',
  extra: () => '', // v9.3.4 : plus de « 200 · 40/100 » sans libellé (le sac est compté dans l'en-tête de l'écran)
  // v9.1.0 : un seul segment (Sac / Coffre) ; Mannequins et Forge s'ouvrent par un bouton (retour au sac en un clic) ;
  // le Musée est dans Objectifs › Collections ; les builds en liste déroulante.
  render(ui, state) {
    const extra = ui.view.invView;
    if (extra === 'forge' && invFeatureOpen(state, extra)) {
      const back = `<div class="row-between"><button class="btn small" data-action="inv-view" data-value="">← Retour au sac</button>
        <b>Forge</b></div>`;
      return back + forge(ui, state);
    }
    // v9.1.3 (lot F) : Coffre, Mannequins et Forge s'ouvrent à un seuil (core/unlocks.js), puis restent visibles.
    const open = (id) => invFeatureOpen(state, id);
    const tab = ui.view.invTab === 'stash' && open('stash') ? 'stash' : 'bag';
    const nextUnlock = nextInvUnlock(state);
    const st = computeHeroStats(state);
    const anyUpgrade = tab === 'bag' && state.inventory.some((i) => isUpgrade(state, i, undefined, st));
    // v9.1.3 : une seule ligne Sac/Coffre/Mannequins/Forge ; « Équiper le meilleur » seulement s'il sert.
    const head = `<div class="inv-head">
        ${open('stash') ? segment([['bag', `Sac ${state.inventory.length}/${BALANCE.loot.inventorySize}`, 'icon_bag'], ['stash', `Coffre ${state.stash.length}/${STASH_SIZE}`, 'icon_chest']], 'inv-tab', tab) : `<b class="inv-bag-count">${img('icon_bag')} Sac ${state.inventory.length}/${BALANCE.loot.inventorySize}</b>`}
        <button class="btn small bag-gear${ui.view.bagMenu ? ' active' : ''}" data-action="bag-menu" aria-expanded="${Boolean(ui.view.bagMenu)}" aria-label="Filtres, builds et réglages du sac" title="Filtres, builds et réglages du sac">⚙ Filtres</button>
        ${'' /* v9.8 (B6) : « Prochain déblocage » seulement sous la scène (plus en double, notation 1-10) */}
        ${anyUpgrade ? '<button class="btn btn-primary primary-action pulse-gold equip-best" data-action="equip-best">⬆ Équiper le meilleur</button>' : ''}
      </div>
      ${ui.view.bagMenu ? '' : '<!-- v9.7.1 : « Équiper pour », filtres et listes rangés derrière le bouton Filtres -->'}${!ui.view.bagMenu ? '' : `<div class="equip-for" role="group" aria-label="Équiper pour"><span>Équiper pour :</span>${['attack', 'survival', 'fortune'].map((p) => `<button class="btn small${state.ui.gearProfile === p ? ' active' : ''}" data-action="equip-for" data-value="${p}" title="${PROFILE_TIPS[p]}">${img(PROFILE_ICONS[p])} ${GEAR_PROFILES[p].label}</button>`).join('')}</div>`}${ui.view.bagMenu ? `<div class="card bag-menu">${fold(ui, 'inv-builds', 'Builds', () => buildsBar(ui, state), { extra: state.loadouts[Math.max(0, ui.view.buildSel ?? 0)]?.name ?? '' })}
        ${fold(ui, 'bag-settings', 'Réglages du sac', () => bagSettings(ui, state))}</div>` : ''}`;
    return head + (tab === 'stash' ? stashView(ui, state) : bag(ui, state)) + setsBanner(ui, state);
  },
};

// v9.8 (C2) : nombre de fusions possibles (compteur du bouton Fusionner).
export function fusionCount(state) {
  return fusionGroups(state, BALANCE, fusionKeep(state)).reduce((t, g) => t + Math.floor(g.usable / BALANCE.forge.fusionCount), 0);
}
