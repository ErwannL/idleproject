// Héros : collection de chevaliers (rôles distincts), niveau, statistiques et bonus par source.
import { SLOTS } from '../../data/items.js';
import { CLASSES } from '../../data/classes.js';
import { activeClass, classUnlocked, classWeaponBases } from '../../core/classes.js';
import { bonusSources } from '../../core/bonuses.js';
import { stageLabel } from '../../core/combat.js';
import { heroById, heroEffects } from '../../core/heroes.js';
import { xpForLevel } from '../../core/level.js';
import { computeHeroStats } from '../../core/stats.js';
import { itemIconUrl, slotIconName } from '../../render/pixel.js';
import { effectText, escapeHtml, formatDecimal, formatNumber, img, itemFrame, progressBar } from '../common.js';
import { animCanvas } from '../animator.js';
import { DUNGEONS } from '../../data/dungeons.js';
import { formatDuration } from '../../core/format.js';
import { modifierById } from '../../core/challenge.js';
import { setBonusFor, setById, setCounts } from '../../core/sets.js';
import { SET_PIECES } from '../../data/sets.js';

const SOURCE_LABELS = { hero: 'Héros', heroClass: 'Classe', powers: 'Pouvoirs de boss', talents: 'Talents', companions: 'Équipe', gear: 'Effets d’équipement', prestige: 'Prestige', rushes: 'Boosts actifs', achievements: 'Hauts faits', sets: 'Ensembles', museum: 'Musée' };

// Ensembles d'équipement portés (v8.5) : pièces et paliers atteints.
function setsCard(state) {
  const counts = setCounts(state.equipment);
  const rows = Object.entries(counts).map(([id, n]) => {
    const set = setById(id);
    const next = SET_PIECES.find((p) => p > n);
    return `<div class="set-row" style="--set:${set.color}"><b style="color:${set.color}">${img(`set_${set.id}`)} ${escapeHtml(set.name)}</b> <span class="muted">${n} pièce${n > 1 ? 's' : ''}</span>
      <span class="${n >= SET_PIECES[0] ? 'good' : 'muted'}">${n >= SET_PIECES[0] ? effectText(setBonusFor(set, n)) : 'aucun bonus'}</span>
      ${next ? `<span class="muted">· à ${next} : ${effectText(set.bonuses[next])}</span>` : ''}</div>`;
  }).join('');
  return `<div class="card"><div class="section-title">Ensembles d'équipement</div>${rows || '<div class="muted">Les objets Rares et mieux appartiennent parfois à l\'ensemble de leur monde (icône en bas à gauche). Portez 2, 4 puis 6 pièces d\'un même ensemble pour ses bonus.</div>'}</div>`;
}

export default {
  id: 'hero',
  title: 'Héros',
  icon: 'icon_hero',
  extra: (ui, state) => `Niv. <b class="gold-text">${state.level}</b>`,
  render(ui, state) {
    const tab = ['class', 'records'].includes(ui.view.heroTab) ? ui.view.heroTab : 'hero';
    const btn = (id, icon, label) => `<button class="btn chip-btn${tab === id ? ' active' : ''}" data-action="hero-tab" data-value="${id}">${img(icon)}<span>${label}</span></button>`;
    const tabs = `<div class="sub-tabs">${btn('hero', 'icon_hero', 'Héros')}${btn('class', 'weapon_sword', 'Classe')}${btn('records', 'icon_trophy', 'Records')}</div>`;
    if (tab === 'records') return tabs + recordsView(state);
    if (tab === 'class') return tabs + classView(state);
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
    const weapons = classWeaponBases(c.id).map((b) => b.name).join(', ');
    const icon = classWeaponBases(c.id)[0];
    const pic = icon ? `<img class="px" src="${itemIconUrl({ baseId: icon.id, rarity: 'legendary', slot: 'weapon' }, 40)}" alt="">` : '';
    return `<div class="class-card${active ? ' active' : ''}${open ? '' : ' locked'}" style="--cls:${c.color}">
      <div class="class-pic">${pic}</div>
      <div class="grow"><b class="class-name">${escapeHtml(c.name)}</b> <span class="class-style">${STYLE_LABEL[c.style]}</span>
        <div class="class-text">${escapeHtml(c.text)}</div>
        <div class="good class-fx">${effectText(c.effects)}</div>
        <div class="muted class-weapons">Armes : ${escapeHtml(weapons)}</div></div>
      ${active ? '<span class="class-on">Active ✓</span>' : open
        ? `<button class="btn btn-primary small" data-action="set-class" data-value="${c.id}">Choisir</button>`
        : `<span class="muted class-lock">${img('icon_lock')} étape ${stageLabel(c.unlockStage)}</span>`}</div>`;
  }).join('');
  return `<div class="card"><div class="row-between"><div class="section-title">Classe du héros</div><span class="muted">Changement gratuit et instantané</span></div>
      <div class="muted">Chaque classe a ses armes (les autres ne s'équipent pas), sa portée, sa façon de frapper et ses animations.
      En changeant de classe, l'arme portée est remplacée par la meilleure arme de la classe dans le sac, ou reforgée sans perte de puissance.</div>
      <div class="class-grid">${cards}</div></div>`;
}

// Records (v8.9) : tous les records et l'historique des runs (Tour, défi de la semaine, donjons) en un écran.
function recordsView(state) {
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
  return `<div class="card"><div class="section-title">Records</div><div class="stats-grid">
      ${line('icon_map', 'Étape max', stageLabel(state.maxStage))}
      ${line('icon_star', 'Tour de l\'Éternité', `étage ${state.towerBest ?? 0}`)}
      ${line('icon_trophy', 'Défi de la semaine', `${state.challengeBest ?? 0} vagues`)}
      ${line('icon_rebirth', 'Renaissances', formatNumber(state.records.rebirths))}
      ${line('icon_star', 'Transcendances', formatNumber(state.transcend?.count ?? 0))}
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
  return `<div class="card hero-main r-${hero.rarity}">
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
    <div class="card"><div class="section-title">Statistiques</div><div class="stats-grid">
      ${line('weapon_sword', 'Dégâts', formatNumber(s.damage))}
      ${line('icon_bolt', 'Attaques / s', formatDecimal(s.attacksPerSecond, 2))}
      ${line('skill_quick', 'Coup critique', `${formatDecimal(s.critChance)} %`)}
      ${line('weapon_sword', 'DPS', formatDecimal(s.dps))}
      ${line('icon_heart', 'PV max', formatNumber(s.maxHp))}
      ${line('icon_shield', 'Armure', `${formatDecimal(s.armor)} %`)}
      ${line('pet_fairy', 'Régénération', `${formatDecimal(s.regenPerSecond)} PV/s`)}
      ${line('coin', 'Or bonus', `+${formatDecimal(s.goldPct)} %`)}
    </div></div>
    ${setsCard(state)}
    ${sources ? `<div class="card"><div class="section-title">Bonus permanents</div><div class="bonus-sources">${sources}</div></div>` : ''}
    <div class="card"><div class="section-title">Exploits</div><div class="stats-grid">
      ${line('icon_skull', 'Ennemis vaincus', formatNumber(state.records.kills))}
      ${line('icon_boss', 'Boss vaincus', formatNumber(state.records.bossesDefeated))}
      ${line('icon_bag', 'Objets trouvés', formatNumber(state.records.itemsFound))}
      ${line('icon_trophy', 'Contrats remplis', formatNumber(state.records.contractsDone))}
      ${line('coin', 'Or gagné au total', formatNumber(state.records.goldEarned))}
      ${state.records.rebirths ? line('icon_rebirth', 'Renaissances', formatNumber(state.records.rebirths)) : ''}
    </div></div>`;
}

