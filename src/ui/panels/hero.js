// Héros : collection de chevaliers (rôles distincts), niveau, statistiques et bonus par source.
import { SLOTS } from '../../data/items.js';
import { CLASSES } from '../../data/classes.js';
import { activeClass, classUnlocked, classWeaponBases } from '../../core/classes.js';
import { bonusSources } from '../../core/bonuses.js';
import { hitsToFall, stageLabel } from '../../core/combat.js';
import { heroById, heroEffects } from '../../core/heroes.js';
import { companionById } from '../../core/companions.js';
import { xpForLevel } from '../../core/level.js';
import { computeHeroStats } from '../../core/stats.js';
import { heroPortraitUrl, itemIconUrl, slotIconName } from '../../render/pixel.js';
import { HEROES } from '../../data/heroes.js';
import { SKIN_TIERS, skinTier } from '../../data/economy.js'; // v9.2.8
import { BALANCE } from '../../data/balance.js';
import { effectText, escapeHtml, fold, hdArt, formatDecimal, formatNumber, img, itemFrame, progressBar, rarityLabel, segment, stars } from '../common.js';
import { animCanvas } from '../animator.js';
import { showcaseSlot } from '../showcase.js'; // v9.2.7 : vitrine animée
import { DUNGEONS } from '../../data/dungeons.js';
import { formatDuration } from '../../core/format.js';
import { modifierById } from '../../core/challenge.js';
import { setBonusFor, setById, setCounts } from '../../core/sets.js';
import { SET_PIECES } from '../../data/sets.js';

import { countersFor } from '../../core/behaviors.js'; // v9.6.1 (2.5)
import { BEHAVIORS } from '../../data/behaviors.js'; // v9.6.1
const SOURCE_LABELS = { hero: 'Héros', heroClass: 'Classe', powers: 'Pouvoirs de boss', talents: 'Talents', companions: 'Équipe', gear: 'Effets d’équipement', prestige: 'Bonus éternels', rushes: 'Boosts actifs', achievements: 'Hauts faits', sets: 'Ensembles', museum: 'Musée' };

// Ensembles d'équipement portés (v8.5) : pièces et paliers atteints.
function setsCard(state) {
  // v9.1.0 : contenu d'un bloc repliable (le titre est celui du bloc).
  const counts = setCounts(state.equipment);
  const rows = Object.entries(counts).map(([id, n]) => {
    const set = setById(id);
    const next = SET_PIECES.find((p) => p > n);
    return `<div class="set-row" style="--set:${set.color}"><b style="color:${set.color}">${img(`set_${set.id}`)} ${escapeHtml(set.name)}</b> <span class="muted">${n} pièce${n > 1 ? 's' : ''}</span>
      <span class="${n >= SET_PIECES[0] ? 'good' : 'muted'}">${n >= SET_PIECES[0] ? effectText(setBonusFor(set, n)) : 'aucun bonus'}</span>
      ${next ? `<span class="muted">· à ${next} : ${effectText(set.bonuses[next])}</span>` : ''}</div>`;
  }).join('');
  return rows || '<div class="muted">Les objets Rares et mieux appartiennent parfois à l\'ensemble de leur monde (icône en bas à gauche). Portez 2, 4 puis 6 pièces d\'un même ensemble pour ses bonus.</div>';
}

// Fiche du héros (v9.1.0 : ouverte par le portrait, hors menu) — segment Fiche, Classe, Apparence, Records.
export default {
  id: 'hero',
  title: 'Fiche',
  icon: 'icon_hero',
  extra: (ui, state) => `Niv. <b class="gold-text">${state.level}</b>`,
  render(ui, state) {
    const tab = ['class', 'look', 'records'].includes(ui.view.heroTab) ? ui.view.heroTab : 'hero';
    // v9.2.2 : plus de segment « Apparence » ici : les apparences ont leur sous-onglet visible Héros › Apparences
    // (panels/looks.js). Une ancienne navigation mémorisée sur 'look' l'affiche encore, sans perte.
    const tabs = segment([['hero', 'Fiche', 'icon_hero'], ['class', 'Classe', 'weapon_sword'], ['records', 'Records', 'icon_trophy']], 'hero-tab', tab);
    if (tab === 'records') return tabs + recordsView(ui, state);
    if (tab === 'class') return tabs + classView(state);
    if (tab === 'look') return tabs + lookView(ui, state);
    return tabs + heroView(ui, state);
  },
};

// v9.0.6 : classes — un clic change le style de combat, les armes portables et les animations.
const STYLE_LABEL = { melee: 'Corps à corps', reach: 'Allonge', ranged: 'Distance', magic: 'Magie' };
function classView(state) {
  const current = activeClass(state);
  const cards = CLASSES.map((c) => {
    const open = classUnlocked(state, c.id);
    const active = c.id === current.id;
    // v9.1.3 (doc2 plan pixel) : armes de la classe en icônes (nom en title / aria-label) au lieu de la liste de noms.
    const bases = classWeaponBases(c.id);
    const weapons = bases.map((b) => `<img class="px class-weapon" src="${itemIconUrl({ baseId: b.id, rarity: 'common', slot: 'weapon' }, 22)}" alt="${escapeHtml(b.name)}" title="${escapeHtml(b.name)}">`).join('');
    const icon = bases[0];
    const pic = icon ? `<img class="px" src="${itemIconUrl({ baseId: icon.id, rarity: 'legendary', slot: 'weapon' }, 40)}" alt="">` : '';
    return `<div class="class-card${active ? ' active' : ''}${open ? '' : ' locked'}" style="--cls:${c.color}">
      <div class="class-pic">${pic}</div>
      <div class="grow"><b class="class-name">${escapeHtml(c.name)}</b> <span class="class-style">${STYLE_LABEL[c.style]}</span>
        <div class="class-text">${escapeHtml(c.text)}</div>
        <div class="good class-fx">${effectText(c.effects)}</div>
        ${(() => { const par = Object.entries(countersFor(new Set(), c)).filter(([, v]) => v).map(([id]) => BEHAVIORS[id].name); return par.length ? `<div class="class-vs">Fort contre : ${par.map(escapeHtml).join(', ')}</div>` : ''; })()}
        <div class="class-weapons" role="img" aria-label="Armes : ${escapeHtml(bases.map((b) => b.name).join(', '))}">${weapons}</div></div>
      ${active ? '<span class="class-on">Active ✓</span>' : open
        ? `<button class="btn btn-primary small" data-action="set-class" data-value="${c.id}">Choisir</button>`
        : `<span class="muted class-lock">${img('icon_lock')} étape ${stageLabel(c.unlockStage)}</span>`}</div>`;
  }).join('');
  // v9.1.3 : texte d'en-tête en une phrase (l'écran Classe faisait 383 mots) ; la phrase de chaque classe dit son style (A19).
  return `<div class="card"><div class="section-title">Classe du héros</div>
      <div class="muted">Changement gratuit : l'arme portée devient la meilleure de la classe, ou est reforgée sans perte.</div>
      <div class="class-grid">${cards}</div></div>`;
}

// v9.0.6 : apparences (skins de héros) — invoquées dans Invocation → Apparences ; chacune apporte son bonus.
// v9.1.9 : vrai écran « Apparences » — aperçu de l'apparence portée en tête, grille de cartes encadrées (rareté,
// portrait animé, nom, bonus, étoiles et doublons) ; une carte possédée se porte en un appui ; verrouillée = silhouette
// et « Obtenu par invocation ».
// v9.2.2 : exportée pour le sous-onglet Héros › Apparences ; état écrit sur chaque carte et bouton « Équiper ».
export function lookView(ui, state) {
  const worn = heroById(state.heroes.active) ?? HEROES[0];
  const ownedCount = HEROES.filter((h) => state.heroes.owned[h.id]).length;
  const canShop = ui.tabVisible.shop !== false;
  // v9.2.7 : vitrine animée d'une apparence (celle portée par défaut, ou celle choisie par « Vitrine » sur sa carte).
  const shown = heroById(ui.view.lookShow) ?? worn;
  const cards = HEROES.map((h) => {
    const owned = state.heroes.owned[h.id];
    const active = state.heroes.active === h.id;
    const attrs = owned && !active ? ` data-action="set-hero" data-value="${h.id}" role="button" tabindex="0" aria-label="Équiper ${escapeHtml(h.name)}"` : '';
    const status = active ? '<span class="look-status on">Équipée</span>' : owned ? '<span class="look-status owned">Possédée</span>' : `<span class="look-status locked">${img('icon_lock')} Verrouillée</span>`;
    // v9.2.8 : cosmétique pur (aucun bonus, plus d'étoiles) ; s'obtient en boutique ou en événement.
    return `<div class="look-card r-${h.rarity}${active ? ' active' : ''}${owned ? ' owned' : ' locked'}"${attrs}>
      <span class="look-badge">${h.id === 'knight' ? 'Base' : SKIN_TIERS[skinTier(h)].name}</span>${status}
      <div class="look-pic">${hdArt(h, owned ? 'look-hd' : 'look-hd locked')}${owned ? animCanvas(`hero:${h.id}`, 64, 58, 2) : `<img class="px look-shadow" src="${heroPortraitUrl({}, 2, h.palette, '#2e3a52')}" alt="">`}</div>
      <div class="look-name">${escapeHtml(h.name)}</div>
      <button class="btn tiny look-show${shown.id === h.id ? ' active' : ''}" data-action="look-show" data-value="${h.id}" aria-pressed="${shown.id === h.id}">▶ Vitrine</button>
      <div class="muted look-role">${escapeHtml(h.title ?? h.role)}</div>
      ${owned ? (active ? (h.id === 'knight' ? '<span class="look-on">Équipée ✓</span>' : '<button class="btn small look-wear" data-action="unequip-look">Retirer</button>') : `<button class="btn btn-primary small look-wear" data-action="set-hero" data-value="${h.id}">Équiper</button>`)
        : `<div class="muted look-lock">${img('icon_lock')} Boutique › Skins</div>
        ${canShop ? '<button class="btn small" data-action="open-shop-skins">Voir en boutique</button>' : ''}`}</div>`;
  }).join('');
  const preview = `<div class="card look-preview r-${worn.rarity}">
      <div class="look-preview-pic">${hdArt(worn, 'look-hd')}${animCanvas('hero', 64, 58, 3)}</div>
      <div class="grow"><div class="muted">Apparence équipée</div>
        <div class="look-preview-name">${escapeHtml(worn.name)}</div>
        <div class="muted look-help">Cosmétique : aucun effet sur les statistiques. Équiper et retirer librement.</div>
        <div class="good"><span>Bonus du héros (compte) :</span> ${effectText(heroEffects(state))}</div></div>
    </div>
    <div class="card look-showcase"><div class="section-title"><span>Vitrine</span> — <span>${escapeHtml(shown.name)}</span></div>${showcaseSlot('hero', shown.id)}</div>`;
  return `${preview}<div class="card"><div class="row-between"><div class="section-title">Apparences</div><span class="muted">${ownedCount}/${HEROES.length} obtenues</span></div>
    <div class="look-grid">${cards}</div></div>`;
}

// Records (v8.9) : tous les records et l'historique des runs (Tour, défi de la semaine, donjons) en un écran.
// Statistiques de farm (v9.1.0) : or et XP par heure à l'étape actuelle, mesurés sur demande (combat simulé).
function farmStats(ui, state) {
  const f = ui.view.farmRate;
  const btn = '<button class="btn small" data-action="measure-farm">Mesurer (quelques secondes de combat simulé)</button>';
  if (!f) return `<div class="card"><div class="section-title">Rythme de jeu</div><div class="row-between"><span class="muted">Or et expérience par heure à l'étape où reste le héros.</span>${btn}</div></div>`;
  const line = (iconName, label, value) => `${img(iconName)}<span>${label}</span><span class="v">${value}</span>`;
  return `<div class="card"><div class="section-title">Rythme de jeu <span class="muted">(étape ${stageLabel(f.stage)})</span></div><div class="stats-grid">
      ${line('coin', 'Or par heure', formatNumber(f.goldPerSecond * 3600))}
      ${line('icon_upgrade', 'XP par heure', formatNumber(f.xpPerSecond * 3600))}
      ${line('icon_skull', 'Ennemis par minute', formatDecimal(f.killsPerSecond * 60))}
      ${line('icon_damage', 'Dégâts/s (calculés)', formatDecimal(computeHeroStats(state).dps))}
    </div>${damageShareHtml(f)}<div class="options-row">${btn}</div></div>`;
}

// v9.1.3 (S3) : part des dégâts directs par unité, mesurée pendant le même combat simulé. Seulement ici, loin de tout
// bouton d'achat ; un soutien (soin, bouclier, or) ne frappe pas et n'y figure donc presque pas.
function damageShareHtml(f) {
  const parts = f.damageShare ?? [];
  if (!parts.length) return '';
  const name = (id) => (id === 'hero' ? 'Héros' : companionById(id)?.name ?? id);
  const rows = parts.map((x) => `<span>${escapeHtml(name(x.id))}</span><span class="v">${formatDecimal(x.share * 100)} %</span>`).join('');
  return `<div class="section-title">Dégâts directs <span class="muted">(part de chacun, soutiens non comptés)</span></div><div class="stats-grid share-grid">${rows}</div>`;
}

function recordsView(ui, state) {
  const date = (at) => (at ? new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—');
  const tower = (state.towerHistory ?? []).map((h) => `<tr><td>${date(h.at)}</td><td><b>${h.floors}</b> étage${h.floors > 1 ? 's' : ''}</td>
      <td>${formatDuration(h.seconds)}</td><td class="muted">${h.collapsed ? 'effondrée' : h.defeatedAt ? `vaincu à l'étage ${h.defeatedAt}` : 'quittée'}</td></tr>`).join('');
  const weeks = (state.challengeHistory ?? []).map((h) => `<tr><td>Semaine du ${h.week.slice(8)}/${h.week.slice(5, 7)}</td><td><b>${h.best}</b> vague${h.best > 1 ? 's' : ''}</td>
      <td class="muted">${h.mods.map((id) => escapeHtml(modifierById(id)?.name ?? id)).join(' · ')}</td></tr>`).join('');
  const dungeons = DUNGEONS.map((d) => {
    const cells = ['easy', 'normal', 'hard'].map((diff) => {
      const r = state.dungeonRuns?.[`${d.id}:${diff}`];
      if (!r?.best) return '<td class="muted">—</td>';
      const b = r.best;
      return `<td>${b.won ? `<b class="good">✔ ${formatDuration(b.seconds)}</b>` : `salle ${b.room}/${b.rooms}${b.bossHpPct !== null ? ` · boss ${formatNumber(b.bossHpPct)} %` : ''}`}
        <span class="muted">(${r.tries} essai${r.tries > 1 ? 's' : ''})</span></td>`;
    }).join('');
    return `<tr><td><b>${escapeHtml(d.name)}</b></td>${cells}</tr>`;
  }).join('');
  const line = (iconName, label, value) => `${img(iconName)}<span>${label}</span><span class="v">${value}</span>`;
  return `${farmStats(ui, state)}<div class="card"><div class="section-title">Records</div><div class="stats-grid">
      ${line('icon_map', 'Étape max', stageLabel(state.maxStage))}
      ${line('icon_tower', 'Tour de l\'Éternité', `étage ${state.towerBest ?? 0}`)}
      ${line('icon_trophy', 'Défi de la semaine', `${state.challengeBest ?? 0} vagues`)}
      ${line('icon_rebirth', 'Renaissances', formatNumber(state.records.rebirths))}
      ${line('icon_stars', 'Transcendances', formatNumber(state.transcend?.count ?? 0))}
      ${line('icon_dungeon', 'Donjons terminés', formatNumber(Object.values(state.dungeonsCleared).reduce((a, b) => a + b, 0)))}
    </div></div>
    <div class="card"><div class="section-title">Tour de l'Éternité — dernières ascensions</div>
      ${tower ? `<table class="records">${tower}</table>` : '<div class="muted">Aucune ascension terminée pour l\'instant.</div>'}</div>
    <div class="card"><div class="section-title">Défi de la semaine — semaines passées</div>
      ${state.challengeWeek?.best ? `<div>Cette semaine : <b>${state.challengeWeek.best}</b> vagues</div>` : ''}
      ${weeks ? `<table class="records">${weeks}</table>` : '<div class="muted">Pas encore d\'historique (il se remplit chaque lundi).</div>'}</div>
    <div class="card"><div class="section-title">Donjons — meilleure tentative</div>
      <table class="records"><tr class="muted"><td></td><td>Facile</td><td>Normal</td><td>Difficile</td></tr>${dungeons}</table></div>`;
}

function heroView(ui, state) {
  // Le chevalier est le seul héros (inchangeable) : plus de collection de variantes.
  const hero = heroById(state.heroes.active);
  const s = computeHeroStats(state);
  const xpNeeded = xpForLevel(state.level);
  const gear = ['weapon', 'armor', 'accessory'].map((slot) => { // v9.3.4 (f) : 3 places
    const item = state.equipment[slot];
    return item ? itemFrame(item, { tag: 'div' }) : `<div class="item-frame empty">${img(slotIconName(slot))}</div>`;
  }).join('');
  const line = (iconName, label, value) => `${img(iconName)}<span>${label}</span><span class="v">${value}</span>`;
  const sources = Object.entries(bonusSources(state))
    .filter(([, eff]) => Object.values(eff).some((v) => v))
    .map(([k, eff]) => `<div><span class="muted">${SOURCE_LABELS[k]} :</span> ${effectText(eff)}</div>`).join('');
  const heroBonus = effectText(heroEffects(state));
  // v9.2.8 : fiche de stats (modèle des RPG mobiles) : Puissance de combat en grand, puis l'attaque et la défense,
  // une ligne par statistique avec son icône. Remplace le seul « Dégâts/s » et le bloc replié « Statistiques ».
  const hits = hitsToFall(state);
  const fmtHits = (h) => (h >= 100 ? '99+' : h < 1 ? '< 1' : formatDecimal(Math.floor(h * 10) / 10));
  const row = (iconName, label, value, cls = '') => `<div class="ss-row${cls}">${img(iconName)}<span class="ss-label">${label}</span><b class="ss-v num">${value}</b></div>`;
  const sheet = `<div class="card stat-sheet">
      <div class="ss-pc">${img('icon_crown')}<span class="ss-pc-label">Puissance</span><b class="ss-pc-v num" title="Puissance de combat : moyenne des dégâts/s et des PV effectifs">${formatNumber(s.combatPower)}</b></div>
      <div class="ss-cols">
        <div class="ss-col">
          ${row('icon_damage', 'Attaque', formatNumber(s.damage))}
          ${row('icon_bolt', 'Vitesse', `${formatDecimal(s.attacksPerSecond, 2)} att./s`)}
          ${row('icon_crit', 'Chance de critique', `${formatDecimal(s.critChance)} %`)}
          ${row('icon_skull', 'Dégâts critiques', `${formatDecimal(s.critMultiplier * 100)} %`)}
          ${row('skill_whirl', 'Double attaque', `${formatDecimal(s.doubleAttackPct)} %`)}
          ${row('icon_boss', 'Tueur de boss', `+${formatDecimal(s.bossDamagePct)} %`)}
          ${row('icon_upgrade', 'Dégâts/s', formatDecimal(s.dps))}
        </div>
        <div class="ss-col">
          ${row('icon_heart', 'Santé', formatNumber(s.maxHp))}
          ${row('shield', 'Défense', `${formatNumber(s.defense)} <small class="muted">(−${formatDecimal(s.defenseReductionPct)} %)</small>`)}
          ${row('icon_shield', 'Armure', `${formatDecimal(s.armor)} %`)}
          ${row('skill_quick', 'Esquive', `${formatDecimal(s.dodgePct)} %`)}
          ${row('icon_regen', 'Régénération', `${formatDecimal(s.regenPerSecond)} PV/s`)}
          ${row('icon_essence', 'Vol de vie', `${formatDecimal(s.lifesteal)} %`)}
          ${row('icon_alert', 'Coups encaissés (ennemi · boss)', `${fmtHits(hits.normal)} · ${fmtHits(hits.boss)}`, hits.normal < 3 ? ' bad' : '')}
        </div>
      </div>
      <div class="ss-foot muted">${img('coin')} <span>Or bonus</span> <b>+${formatDecimal(s.goldPct)} %</b></div>
    </div>`;
  return `${sheet}<div class="card hero-main r-${hero.rarity}">
        <div class="pedestal">${animCanvas('hero', 64, 58, 3)}</div>
        <div class="grow">
          <div class="hero-title">${escapeHtml(hero.name)}</div>
          <div class="hero-look">Apparence : <b class="rarity-text r-${hero.rarity}">${escapeHtml(hero.name)}</b>
            <button class="btn small" data-action="open-looks">Changer ›</button></div>
          <div class="muted">Classe : <b style="color:${activeClass(state).color}">${escapeHtml(activeClass(state).name)}</b> · ${hero.role}</div>
          <div class="hero-desc">${escapeHtml(hero.description)}</div>
          ${heroBonus ? `<div class="hero-bonus">${heroBonus}</div>` : ''}
        </div>
    </div>
    <div class="card">
      <div class="row-between"><b>Niveau ${state.level}</b><span class="muted">Étape max ${stageLabel(state.maxStage)}</span></div>
      ${progressBar(state.xp / xpNeeded, `${formatNumber(Math.floor(state.xp))} / ${formatNumber(xpNeeded)} XP`, 'xp')}
      <div class="gear-row" style="margin-top:5px">${gear}</div>
    </div>
    ${fold(ui, 'hero-sets', 'Ensembles d\'équipement', () => setsCard(state))}
    ${sources ? fold(ui, 'hero-bonus', 'Sources de bonus (boosts actifs compris)', `<div class="bonus-sources">${sources}</div>`) : ''}
    ${fold(ui, 'hero-feats', 'Exploits', () => `<div class="stats-grid">
      ${line('icon_skull', 'Ennemis vaincus', formatNumber(state.records.kills))}
      ${line('icon_boss', 'Boss vaincus', formatNumber(state.records.bossesDefeated))}
      ${line('icon_bag', 'Objets trouvés', formatNumber(state.records.itemsFound))}
      ${line('icon_trophy', 'Contrats remplis', formatNumber(state.records.contractsDone))}
      ${line('coin', 'Or gagné au total', formatNumber(state.records.goldEarned))}
      ${state.records.rebirths ? line('icon_rebirth', 'Renaissances', formatNumber(state.records.rebirths)) : ''}
    </div>`)}`;
}
