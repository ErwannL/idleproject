// v10.13 (lot 6) : Équipe › Compagnons sur PC, « vrai jeu » (maquette m06). Même HTML de kit que le téléphone (mTitle, mBtnGold, mBtn,
// mChip, mCost, mTile), mises en page par src/ui/desk-companions.css (tout sous #app:not(.m-phone)).
//   Colonne de gauche : bandeau « Ton équipe » (monde actuel, unités en grand) · préréglages · filtres · grille 7 colonnes de cartes portrait.
//   Colonne de droite : la fiche du compagnon choisi, TOUJOURS visible (plus de fenêtre) : portrait, chiffres, 3 compétences illustrées,
//   puis « Mettre dans l'équipe », « Objets portés › » (ouvre Héros › Équipement) et « Histoire ».
// On n'équipe aucun objet ici : tout ce qui met un objet sur quelqu'un se fait dans Héros › Équipement.
// Un seul bouton doré visible : « Mettre dans l'équipe » si le compagnon choisi n'est pas dans l'équipe, sinon « Meilleure équipe (+N %) »
// quand le conseil existe, sinon « Invoquer… » (compagnon pas encore obtenu).
import { COMPANION_RULES } from '../../data/companions.js';
import { BALANCE } from '../../data/balance.js';
import { ZONES } from '../../data/zones.js';
import { BG } from '../../render/bg.js';
import { COMPANION_ROLES, ROLES } from '../../data/synergies.js';
import { ELEMENTS, unitElement } from '../../core/elements.js';
import { AWAKEN_LEVEL, awakenedSkill, equippedOfKind, isAwakened, teamKind, teamSlotsOf, unitLevel, allCompanionSkills, companionUpgradeCost } from '../../core/companions.js';
import { frontCompanion as frontOf } from '../../core/behaviors.js';
import { currentEncounter } from '../../core/combat.js';
import { computeHeroStats } from '../../core/stats.js';
import { leveledSkill, skillLevels } from '../../core/progression.js';
import { expeditionDone, expeditionType, isAway } from '../../core/expeditions.js';
import { escapeHtml, fold, formatNumber, hdArt, icon, img, rarityLabel } from '../common.js';
import { animCanvas } from '../animator.js';
import { showcaseSlot } from '../showcase.js';
import { companionPortrait, companionStill } from './expeditions.js';
import { historyTab, shortPassive, shortSkill, skillBubble, unitFacts } from './unit-popup.js';
import { mBtn, mBtnGold, mChip, mCost, mGrid, mTile, mTitle } from '../mobile-kit.js';
import { unitTodo } from './equip-sheet.js';
import { gearWaiting } from '../../core/companion-gear.js';

const e = escapeHtml;
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic', 'astral', 'ascendant'];
// Illustration de chaque type de compétence (les mêmes images que les compétences du héros).
const SKILL_ART = { hit: 'skill_assassin_1', burst: 'skill_pyromancer_whirl', heal: 'skill_paladin_holy', shield: 'skill_knight_1', rally: 'skill_berserker_cry', gold: 'coin' };
const skillArt = (sk) => (SKILL_ART[sk.type] === 'coin' ? img('coin') : `<img class="px" src="assets/ui/art104/${SKILL_ART[sk.type] ?? 'skill_knight_1'}.png" alt="">`);

// Décor du bandeau : le ciel et les calques peints du monde actuel (les mêmes fichiers que le combat).
function worldBackground(state) {
  let zone = ZONES[0];
  try { zone = ZONES[currentEncounter(state).zoneIndex] ?? ZONES[0]; } catch { /* repli : premier monde */ }
  const bg = BG[zone.id] ?? BG.cursed;
  const sky = (bg.sky ?? ['#2a3a78', '#16214a']).join(', ');
  const layers = (bg.layers ?? []).filter((l) => !l.front && l.factor >= 0.05 && !/clouds|sun|moon|ceiling/.test(l.file)).slice(0, 3);
  const urls = layers.map((l) => `url(assets/bg/${l.file})`).reverse(); // le plus proche d'abord
  const style = `background-image:${[...urls, `linear-gradient(180deg, ${sky})`].join(', ')};background-size:${[...urls.map(() => 'auto 62%'), '100% 100%'].join(', ')};background-position:${[...urls.map(() => 'left bottom'), '0 0'].join(', ')};background-repeat:${[...urls.map(() => 'repeat-x'), 'no-repeat'].join(', ')}`;
  return { style, name: zone.name };
}

function banner(ui, state, sel, best = '') {
  const front = frontOf(state);
  const unit = (c, role) => {
    const rank = role === 'ally' ? (front === c.id ? '<span class="dc-rank front">Avant</span>' : `<button type="button" class="dc-rank" data-action="set-front" data-value="${c.id}" title="Mettre au rang avant">Arrière</button>`) : '<span class="dc-rank pet">Familier</span>';
    return `<div class="dc-u${c.id === sel.id ? ' on' : ''}"><button type="button" class="dc-u-btn r-${c.rarity}" data-action="companion-sel" data-value="${c.id}" aria-label="${e(c.name)}" title="${e(c.name)}">${companionStill(c)}${gearWaiting(state, c.id) ? '<i class="dc-bang" aria-label="Un meilleur objet attend">!</i>' : ''}</button>${rank}</div>`;
  };
  const allies = equippedOfKind(state, 'ally');
  const ordered = [...allies.filter((c) => c.id === front), ...allies.filter((c) => c.id !== front)];
  const free = Math.max(0, teamSlotsOf(state).ally - ordered.length);
  const empty = (label) => `<div class="dc-u empty"><span class="dc-u-btn" aria-hidden="true">+</span><span class="dc-rank">${label}</span></div>`;
  const hero = `<div class="dc-u hero"><span class="dc-u-btn" title="Le héros (toujours présent)">${animCanvas('hero', 64, 58, 2)}</span><span class="dc-rank">Héros</span></div>`;
  const pets = equippedOfKind(state, 'pet');
  const petSlots = Array.from({ length: BALANCE.teamSlots.pet }, (_, i) => (pets[i] ? unit(pets[i], 'pet') : empty('Familier')));
  const bgd = worldBackground(state);
  const power = computeHeroStats(state).combatPower ?? 0;
  return `<section class="dc-team" style="${bgd.style}" aria-label="Ton équipe"><div class="dc-team-head"><span class="dc-team-lbl">Ton équipe</span>${best ? `<span class="dc-team-best" data-gold-top>${best}</span>` : ''}<span class="dc-team-pw" title="Puissance de combat du héros et de son équipe">⚔<span class="dc-pw-x"> Puissance d'équipe</span> <b>${e(formatNumber(power))}</b></span></div>
    <div class="dc-units">${hero}${ordered.map((c) => unit(c, 'ally')).join('')}${Array.from({ length: free }, () => empty('Libre')).join('')}${petSlots.join('')}</div></section>`;
}

function card(state, c, sel) {
  const ow = state.companions.owned[c.id];
  if (!ow) {
    return `<button type="button" class="dc-card locked r-${c.rarity}${c.id === sel.id ? ' sel' : ''}" data-action="companion-sel" data-value="${c.id}" aria-label="${e(c.name)} (pas encore obtenu)" aria-pressed="${c.id === sel.id}" title="${e(c.name)}">
      <span class="dc-pic">${img('icon_lock')}</span><b class="dc-name">???</b><span class="dc-stars none" aria-hidden="true">★★★★★</span></button>`;
  }
  const dupMax = COMPANION_RULES.maxCopies - 1;
  const copies = Math.min(COMPANION_RULES.maxCopies, ow.stars ?? 1);
  const inTeam = state.companions.equipped.includes(c.id);
  const todo = unitTodo(state, c) ? '<i class="dc-bang" title="Une amélioration est possible">!</i>' : '';
  return `<button type="button" class="dc-card r-${c.rarity}${c.id === sel.id ? ' sel' : ''}${inTeam ? ' in' : ''}" data-action="companion-sel" data-value="${c.id}" aria-label="${e(c.name)}" aria-pressed="${c.id === sel.id}">
    <span class="dc-lv">Niv. ${unitLevel(state, c.id)}</span>${inTeam ? '<span class="dc-in">Équipe</span>' : ''}${isAway(state, c.id) ? '<span class="dc-in away" title="En expédition">En route</span>' : ''}${todo}
    <span class="dc-pic">${companionStill(c)}</span><b class="dc-name${c.name.length > 11 ? ' long' : ''}">${e(c.name)}</b>
    <span class="dc-stars" aria-label="${copies - 1} étoile${copies - 1 > 1 ? 's' : ''} sur ${dupMax}">${'★'.repeat(copies - 1)}<i>${'★'.repeat(dupMax - (copies - 1))}</i></span></button>`;
}

const pill = (cls, html, style = '') => `<span class="dc-pill ${cls}"${style ? ` style="${style}"` : ''}>${html}</span>`;

// La fiche (colonne de droite).
function sheet(ui, state, sel, ctx) {
  const owned = state.companions.owned[sel.id];
  const own = owned ?? { stars: 1, level: 1 };
  const el = unitElement(sel.id);
  const role = COMPANION_ROLES[sel.id];
  const f = unitFacts(state, sel);
  const lvl = unitLevel(state, sel.id);
  const maxed = lvl >= COMPANION_RULES.maxLevel;
  const copies = f.copies;
  const dupMax = COMPANION_RULES.maxCopies - 1;
  const awake = owned && isAwakened(state, sel.id);
  const art = awake ? `<img class="dc-art-img px-hd awake-art" src="assets/hd/px/awake/ally_${sel.id}.webp" alt="">` : (hdArt(sel, 'dc-art-img') || companionPortrait(sel, true));
  const pic = ui.view.unitShow === sel.id ? showcaseSlot('unit', sel.id)
    : `<span class="dc-art-in${owned ? '' : ' silhouette'}">${art}</span><button type="button" class="dc-play" data-action="unit-show" data-value="${sel.id}" aria-label="Voir l'animation">▶ Voir en action</button>`;
  // 3 compétences illustrées : passif, active, ultime (toucher = la bulle en dessous : effet, niveau suivant, Améliorer).
  const lv = skillLevels(own);
  const list = allCompanionSkills(sel.id);
  const act = list.find((s) => !s.ultimate), ult = list.find((s) => s.ultimate);
  const sk = [
    ['passive', 'Passif', `<img class="px" src="${icon('icon_upgrade')}" alt="">`, shortPassive(sel), lv.passive],
    ...(act ? [['active', act.name, skillArt(act), shortSkill(leveledSkill(act, 'active', lv.active)), lv.active]] : []),
    ...(ult ? [['ultimate', ult.name, skillArt(ult), shortSkill(leveledSkill(ult, 'ultimate', lv.ultimate)), lv.ultimate]] : []),
  ];
  const skills = sk.map(([k, name, art2, desc, l]) => `<button type="button" class="dc-skill k-${k}${ui.view.skillPop === k ? ' on' : ''}" data-action="skill-pop" data-value="${k}" aria-expanded="${ui.view.skillPop === k}">
      <span class="dc-skill-ic">${art2}<i class="dc-skill-lv">Nv ${l}</i></span><b>${e(name)}</b><small>${e(desc)}</small></button>`).join('');
  // La bulle de la compétence touchée : son bouton « Améliorer » devient sombre (l'unique bouton doré est ailleurs).
  const bubble = skillBubble(ui, state, sel, own, Boolean(owned)).replace('class="btn btn-gold"', 'class="btn btn-primary"');
  const story = ui.view.unitTab === 'story';
  const aw = sel.kind === 'ally' ? `<div class="dc-awake${awake ? ' on' : ''}">${awake ? `✦ Éveillé · sort « ${e(awakenedSkill(sel.id).name)} »` : `Éveil au niveau ${AWAKEN_LEVEL} : sort « ${e(awakenedSkill(sel.id).name)} »`}</div>` : '';

  // Boutons du bas.
  const kind = teamKind(sel);
  const equipped = state.companions.equipped.includes(sel.id);
  const full = !equipped && kind === 'ally' && equippedOfKind(state, 'ally').length >= teamSlotsOf(state).ally;
  const swap = !equipped && kind === 'pet' && equippedOfKind(state, 'pet').length >= BALANCE.teamSlots.pet;
  const away = owned && isAway(state, sel.id);
  const run = away ? state.expeditions.slots.find((x) => x?.companionId === sel.id) : null;
  let main = '';
  if (!owned) {
    main = ui.tabVisible.summon !== false
      ? (ctx.gold === 'summon' ? mBtnGold('Invoquer…', { action: 'open-tab', value: 'summon', icon: 'icon_summon' }) : mBtn('Invoquer…', { action: 'open-tab', value: 'summon', icon: 'icon_summon' }))
      : '<p class="dc-note">Pas encore obtenu.</p>';
  } else if (away) {
    main = mBtn(`En expédition : ${expeditionType(run.type).label}${expeditionDone(run) ? ' (terminée)' : ''}`, { action: 'open-tab', value: 'expeditions' });
  } else if (equipped) {
    main = mBtn("Retirer de l'équipe", { action: 'toggle-companion', value: sel.id });
  } else {
    main = mBtnGold("Mettre dans l'équipe", full ? { action: 'ask-replace', value: sel.id } : { action: 'toggle-companion', value: sel.id });
  }
  // « Qui remplacer ? » : les compagnons de l'équipe, en portraits.
  const replace = owned && full && ui.view.replaceFor === sel.id
    ? `<div class="m-card dc-replace"><b>Qui remplacer ?</b>${mGrid(equippedOfKind(state, 'ally').map((c) => mTile({ name: c.name, rarity: c.rarity }, { size: 72, action: 'replace-companion', value: `${sel.id}|${c.id}`, src: icon(c.sprite, 1), pips: false, label: c.name })), 3)}${mBtn('Annuler', { action: 'ask-replace', value: '' })}</div>` : '';
  const cost = owned && !maxed ? companionUpgradeCost(state, sel.id) : 0;
  const up = !owned ? '' : maxed
    ? `<div class="dc-up max"><span class="dc-max">Niveau max</span></div>`
    : `<div class="dc-up">${mCost('coin', state.gold, cost, { fmt: formatNumber })}${mBtn('Améliorer', { action: 'upgrade-companion', value: sel.id, icon: 'icon_upgrade', disabled: state.gold < cost, attrs: `data-cost="${cost}" data-currency="gold"` })}</div>`;
  const second = `<div class="dc-pair">${owned && sel.kind === 'ally' ? mBtn('Objets portés ›', { action: 'gear-for', value: sel.id }) : ''}${mBtn(story ? 'Compétences' : 'Histoire', { action: 'unit-tab', value: story ? 'skills' : 'story' })}</div>`;
  const inner = story ? `<div class="dc-story">${historyTab(state, sel)}</div>` : `<div class="dc-sk">${skills}</div>${bubble}${aw}`;
  return `<aside class="dc-sheet r-${sel.rarity}" aria-label="${e(sel.name)}">
    <div class="dc-art r-${sel.rarity}" style="--ec:${ELEMENTS[el]?.color ?? '#5a6a90'}">${pic}</div>
    <div class="dc-id"><b class="dc-sname">${e(sel.name)}</b><span class="dc-slv">${owned ? `Niv. ${lvl} / ${COMPANION_RULES.maxLevel}` : 'Pas encore obtenu'}</span>
      <span class="dc-stars big" aria-label="${copies} copies sur ${COMPANION_RULES.maxCopies}">${'★'.repeat(owned ? copies - 1 : 0)}<i>${'★'.repeat(owned ? dupMax - (copies - 1) : dupMax)}</i></span></div>
    <div class="dc-tags">${pill(`r-${sel.rarity}`, rarityLabel(sel.rarity))}${pill('el', `${ELEMENTS[el]?.icon ?? ''} ${e(ELEMENTS[el]?.name ?? '')}`, `--ec:${ELEMENTS[el]?.color ?? '#5a6a90'}`)}${role ? pill('role', `${img(ROLES[role].icon)} ${e(ROLES[role].label)}`, `--rc:${ROLES[role].color}`) : ''}</div>
    <div class="dc-st3"><span><img class="px" src="${icon(f.main[0])}" alt=""><b>${e(f.main[2])}</b><small>${e(f.main[1])}</small></span><span><img class="px" src="${icon('icon_heart')}" alt=""><b>${e(f.life)}</b><small>Vie (Arène)</small></span><span><img class="px" src="${icon('icon_bolt')}" alt=""><b>${e(f.speed)}</b><small>Vitesse</small></span></div>
    ${inner}${replace}${up}${main}${second}</aside>`;
}

// ctx : { sel, tab ('ally'|'pet'), list, tips (fn → HTML des conseils), tipsExtra, adv (conseil d'équipe), selOwned }
const ICON_FILTER = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>';

export function deskCompanions(ui, state, ctx) {
  const { sel, tab, list, tips, tipsExtra, adv } = ctx;
  const owned = state.companions.owned[sel.id];
  const equipped = state.companions.equipped.includes(sel.id);
  const selWantsGold = Boolean(owned) && !equipped && !isAway(state, sel.id);
  const best = adv && !adv.same && adv.gain >= 0.03;
  const gold = selWantsGold ? 'sheet' : best ? 'best' : 'summon';
  const canUp = state.companions.equipped.some((id) => companionUpgradeCost(state, id) <= state.gold);
  const ls = (state.loadouts ?? []).slice(0, 3);
  const presets = ls.map((l, i) => (l.team ? mBtn(l.name, { action: 'apply-build', value: i, cls: 'dc-preset' }) : mBtn('+ Enregistrer', { action: 'save-loadout', value: i, cls: 'dc-preset' }))).join('');
  const bestBtn = adv ? (best ? (gold === 'best' ? mBtnGold : mBtn)(`Meilleure équipe (+${Math.round(adv.gain * 100)} %)`, { action: 'apply-team', icon: 'icon_upgrade', cls: 'dc-best' })
    : mBtn('Meilleure équipe en place', { disabled: true, cls: 'dc-best' })) : '';
  const upBtn = state.companions.equipped.length ? mBtn("Améliorer l'équipe", { action: 'upgrade-team', icon: 'icon_upgrade', disabled: !canUp, cls: 'dc-preset' }) : '';
  const nAllies = Object.keys(state.companions.owned).filter((id) => ctx.allies.some((c) => c.id === id)).length;
  const nPets = Object.keys(state.companions.owned).filter((id) => ctx.pets.some((c) => c.id === id)).length;
  const elChip = ([k, x]) => mChip(x.icon, { action: 'comp-filter', value: `el|${k}`, on: ui.view.compEl === k, attrs: `aria-label="${e(x.name)}" title="${e(x.name)}"` });
  // v10.17.1 (3) : les 2 rangées de filtres (Rareté, Élément) deviennent un bouton « Filtrer » qui ouvre un petit menu ; le filtre
  // actif est rappelé sur le bouton, la liste remonte d'autant.
  const actF = [ui.view.compRar ? rarityLabel(ui.view.compRar) : '', ui.view.compEl ? (ELEMENTS[ui.view.compEl]?.name ?? '') : ''].filter(Boolean);
  const fBtn = `<button type="button" class="m-btn dc-fbtn${ui.view.compFMenu ? ' open' : ''}" data-action="comp-fmenu" aria-expanded="${Boolean(ui.view.compFMenu)}">${ICON_FILTER} <span>Filtrer</span>${actF.length ? ` <b class="dc-fact">· ${actF.map((x) => `<span>${e(x)}</span>`).join(' · ')}</b>` : ''}</button>`;
  const fMenu = ui.view.compFMenu ? `<div class="dc-fmenu" role="group" aria-label="Filtrer">
    <div class="m-chips"><span class="dc-flbl">Rareté</span>${mChip('Toutes', { action: 'comp-filter', value: 'rar|all', on: !ui.view.compRar })}${['rare', 'epic', 'legendary'].map((r) => mChip(rarityLabel(r), { action: 'comp-filter', value: `rar|${r}`, on: ui.view.compRar === r })).join('')}</div>
    <div class="m-chips"><span class="dc-flbl">Élément</span>${mChip('Tous', { action: 'comp-filter', value: 'el|all', on: !ui.view.compEl })}${Object.entries(ELEMENTS).map(elChip).join('')}</div></div>` : '';
  const modes = `<div class="m-chips dc-filters">${mChip(`Compagnons ${nAllies}`, { action: 'comp-tab', value: 'ally', on: tab === 'ally' })}${mChip(`Familiers ${nPets}`, { action: 'comp-tab', value: 'pet', on: tab === 'pet' })}
    <span class="dc-sep"></span>${fBtn}</div>${fMenu}`;
  const shown = list.filter((c) => (!ui.view.compRar || c.rarity === ui.view.compRar) && (!ui.view.compEl || unitElement(c.id) === ui.view.compEl));
  const grid = shown.length ? `<div class="dc-grid">${shown.map((c) => card(state, c, sel)).join('')}</div>` : '<p class="dc-note">Aucun compagnon ne correspond à ces filtres.</p>';
  // v10.20 (partie 5) : « Meilleure équipe » dans l'en-tête de « Ton équipe » ; les équipes enregistrées et « Améliorer l'équipe »
  // en une ligne de petits boutons sous la grille (qui défile dans son cadre).
  const main = `${banner(ui, state, sel, bestBtn)}
    ${modes}${grid}
    <div class="dc-presets">${presets}${upBtn}</div>
    ${fold(ui, 'team-tips', 'Conseils : synergies et liens', tips, { extra: tipsExtra, cls: 'dc-tips' })}`;
  return `<div class="m-frame dc-frame">${mTitle('icon_paw', 'Compagnons', true)}<div class="d-cols2 dc-cols"><div class="dc-main">${main}</div>${sheet(ui, state, sel, { gold })}</div></div>`;
}
