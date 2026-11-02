// Héros : collection de chevaliers (rôles distincts), niveau, statistiques et bonus par source.
import { SLOTS } from '../../data/items.js';
import { CLASSES } from '../../data/classes.js';
import { activeClass, classUnlocked, classWeaponBases } from '../../core/classes.js';
import { bonusSources } from '../../core/bonuses.js';
import { stageLabel } from '../../core/combat.js';
import { heroById, heroEffects } from '../../core/heroes.js';
import { companionById } from '../../core/companions.js';
import { xpForLevel } from '../../core/level.js';
import { computeHeroStats } from '../../core/stats.js';
import { heroPortraitUrl, itemIconUrl, slotIconName } from '../../render/pixel.js';
import { HEROES } from '../../data/heroes.js';
import { effectText, escapeHtml, fold, hdArt, formatDecimal, formatNumber, img, itemFrame, progressBar, rarityLabel, segment, stars } from '../common.js';
import { animCanvas } from '../animator.js';
import { DUNGEONS } from '../../data/dungeons.js';
import { formatDuration } from '../../core/format.js';
import { modifierById } from '../../core/challenge.js';
import { setBonusFor, setById, setCounts } from '../../core/sets.js';
import { SET_PIECES } from '../../data/sets.js';

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
    const tabs = segment([['hero', 'Fiche', 'icon_hero'], ['class', 'Classe', 'weapon_sword'], ['look', 'Apparence', 'icon_summon'], ['records', 'Records', 'icon_trophy']], 'hero-tab', tab);
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

// v9.0.6 : apparences (skins de héros) — invoquées dans Invocation → Héros ; chacune apporte son bonus.
function lookView(ui, state) {
  const cards = HEROES.map((h) => {
    const owned = state.heroes.owned[h.id];
    const active = state.heroes.active === h.id;
    return `<div class="look-card r-${h.rarity}${active ? ' active' : ''}${owned ? '' : ' locked'}">
      <div class="look-pic">${hdArt(h, owned ? 'look-hd' : 'look-hd locked')}${owned ? animCanvas(`hero:${h.id}`, 64, 58, 2) : `<img class="px look-shadow" src="${heroPortraitUrl({}, 2, h.palette, '#2e3a52')}" alt="">`}</div>
      <div class="look-name">${escapeHtml(h.name)} <span class="rarity-text">${rarityLabel(h.rarity)}</span></div>
      <div class="muted look-role">${escapeHtml(h.title ?? h.role)}</div>
      <div class="good look-fx">${effectText(h.bonus)}</div>
      ${owned ? `${stars(owned.stars ?? 1)}${active ? '<span class="class-on">Portée ✓</span>' : `<button class="btn btn-primary small" data-action="set-hero" data-value="${h.id}">Porter</button>`}`
        : ui.tabVisible.summon !== false ? `<button class="btn small" data-action="open-summon-hero">${img('icon_summon')} Invoquer</button>` : '<span class="muted">À invoquer</span>'}</div>`;
  }).join('');
  return `<div class="card"><div class="row-between"><div class="section-title">Apparence du héros</div><span class="muted">Le bonus de l'apparence portée s'applique (+20 % par étoile)</span></div>
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
  const gear = Object.keys(SLOTS).map((slot) => {
    const item = state.equipment[slot];
    return item ? itemFrame(item, { tag: 'div' }) : `<div class="item-frame empty">${img(slotIconName(slot))}</div>`;
  }).join('');
  const line = (iconName, label, value) => `${img(iconName)}<span>${label}</span><span class="v">${value}</span>`;
  const sources = Object.entries(bonusSources(state))
    .filter(([, eff]) => Object.values(eff).some((v) => v))
    .map(([k, eff]) => `<div><span class="muted">${SOURCE_LABELS[k]} :</span> ${effectText(eff)}</div>`).join('');
  const heroBonus = effectText(heroEffects(state));
  // v9.1.3 : un seul Dégâts/s ; le détail (dégâts, attaques/s, critique, PV) n'est plus répété : il est dans Statistiques.
  const dps = `<div class="card hero-dps"><span class="muted">Dégâts/s</span> <b class="big-num">${formatDecimal(s.dps)}</b></div>`;
  return `${dps}<div class="card hero-main r-${hero.rarity}">
        <div class="pedestal">${animCanvas('hero', 64, 58, 3)}</div>
        <div class="grow">
          <div class="hero-title">${escapeHtml(hero.name)}</div>
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
    ${fold(ui, 'hero-stats', 'Statistiques', () => `<div class="stats-grid">
      ${line('icon_damage', 'Dégâts', formatNumber(s.damage))}
      ${line('icon_bolt', 'Attaques / s', formatDecimal(s.attacksPerSecond, 2))}
      ${line('icon_crit', 'Coup critique', `${formatDecimal(s.critChance)} %`)}
      ${line('icon_heart', 'PV max', formatNumber(s.maxHp))}
      ${line('icon_shield', 'Armure', `${formatDecimal(s.armor)} %`)}
      ${line('icon_regen', 'Régénération', `${formatDecimal(s.regenPerSecond)} PV/s`)}
      ${line('coin', 'Or bonus', `+${formatDecimal(s.goldPct)} %`)}
    </div>`)}
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
