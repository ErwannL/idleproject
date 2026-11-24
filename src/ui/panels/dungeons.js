// Donjons (v7.7, v9.1.0) : donjons ouverts (verrouillés repliés) + fiche (difficulté, mécanique, butin ciblé, chemin, Entrer).
// Bien plus durs que la campagne ; ils rapportent les fragments anciens de l'arbre de talents.
import { BALANCE } from '../../data/balance.js';
import { BOSSES } from '../../data/enemies.js';
import { UNITS as COMPANIONS } from '../../data/banners.js'; // v9.1.3 (partie B)
import { DIFFICULTY_ORDER, DUNGEON_DIFFICULTIES, DUNGEON_PATHS, DUNGEON_REWARD, DUNGEONS } from '../../data/dungeons.js';
import { SLOTS } from '../../data/items.js';
import { levelForStage, referenceKillGold, stageLabel } from '../../core/combat.js';
import { canEnterDungeon, canSweepDungeon, dungeonById, dungeonRooms, dungeonRunInfo, unlockedDifficulties } from '../../core/dungeon.js';
import { ELEMENTS, zoneElement } from '../../core/elements.js'; // v9.6.2
import { BEHAVIORS, enemyBehavior } from '../../data/behaviors.js'; // v9.6.2
import { formatDuration } from '../../core/format.js';
import { itemIconUrl } from '../../render/pixel.js';
import { rewardText } from '../../core/rewards.js';
import { CHALLENGE, challengeTriesLeft, challengeWeek, modifierById, weeklySetup } from '../../core/challenge.js';
import { ZONES } from '../../data/zones.js';
import { escapeHtml, formatNumber, icon, img, progressBar } from '../common.js';
import { companionById } from '../../core/companions.js';
import { companionStill } from './expeditions.js';
import { pageActive } from '../page.js'; // v10.4 : page plein écran
import { TRAITS, bossTrait } from '../../core/boss-traits.js';
import { ROLES } from '../../data/synergies.js';
import { mBtn, mChip, mCost, mTitle } from '../mobile-kit.js'; // v10.12
const isPhoneUi = () => true; // v10.13 : le PC emploie le même kit (cadre, cartouche, tuiles) que le téléphone ; desk-activities.css lui donne ses tailles
import { DOORS, DUNGEON_GAIN, bestSweepTarget, dungeonSet, dungeonStars, mainGain, nightmareBest, nightmareOpen, nightmareMult, roman } from '../../core/dungeon-plus.js'; // v10.1 (P3)


// Chemin des salles : coches pour les salles franchies, boss final au bout.
function roomPath(d, room = 0) {
  const steps = [];
  for (let i = 1; i < d.rooms; i++) {
    steps.push(`<div class="room${room > i ? ' done' : room === i ? ' current' : ''}"><span>${room > i ? '✔' : i}</span><small>Salle ${i}</small></div>`);
  }
  steps.push(`<div class="room boss${room >= d.rooms ? ' current' : ''}"><span>${img('icon_skull')}</span><small>Boss final<br>${escapeHtml(BOSSES[d.boss].name)}</small></div>`);
  return `<div class="room-path">${steps.join('<i class="room-link"></i>')}</div>`;
}

// v8.1 : où en était-on ? Dernière tentative et meilleure tentative (salle, PV du boss, équipe, équipement).
function runCard(r, title) {
  if (!r) return '';
  const where = r.won ? '<span class="good">Donjon terminé ✔</span>'
    : r.bossHpPct !== null ? `Boss final : <b>${formatNumber(r.bossHpPct)} %</b> de PV restants`
      : `Salle <b>${r.room}/${r.rooms - 1}</b>`;
  const bar = r.bossHpPct !== null && !r.won ? `<div class="run-boss-bar"><i style="width:${Math.min(100, r.bossHpPct)}%"></i></div>` : '';
  const gear = r.gear.map((g) => `<img class="px r-${g.rarity}" src="${itemIconUrl(g)}" title="${escapeHtml(g.name)}${g.upgrades ? ` +${g.upgrades}` : ''} · niv. ${g.level}" alt="">`).join('');
  const team = r.team.map((id) => COMPANIONS.find((c) => c.id === id)).filter(Boolean)
    .map((c) => `<span class="run-mate r-${c.rarity}" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>`).join('');
  return `<div class="run-card"><div class="row-between"><b>${title}</b><span class="muted">${formatDuration(r.seconds)} · héros niv. ${r.level}</span></div>
    <div>${where}</div>${bar}
    <div class="run-gear">${gear}</div>${team ? `<div class="run-team">${team}</div>` : ''}</div>`;
}

function runsBlock(state, d, diffId) {
  const info = dungeonRunInfo(state, d.id, diffId);
  if (!info || (!info.last && !info.best)) return '';
  const same = info.best && info.last && info.best.at === info.last.at;
  return `<div class="card-sub run-block"><div class="section-title">Vos tentatives · ${DUNGEON_DIFFICULTIES[diffId].label} <span class="muted">(${info.tries} essai${info.tries > 1 ? 's' : ''})</span></div>
    <div class="run-cols">${runCard(info.last, same ? 'Dernière et meilleure tentative' : 'Dernière tentative')}${same ? '' : runCard(info.best, 'Meilleure tentative')}</div></div>`;
}

function running(ui, state) {
  const run = state.dungeon;
  const d = dungeonById(run.id);
  const diff = DUNGEON_DIFFICULTIES[run.difficulty] ?? DUNGEON_DIFFICULTIES.easy;
  const paths = Object.entries(DUNGEON_PATHS).map(([id, p]) => `<button class="btn chip-btn${run.path === id ? ' active' : ''}"
    data-action="dungeon-path" data-value="${id}" title="${p.text}">${p.label}</button>`).join('');
  const boss = run.room >= dungeonRooms(state, d);
  return `<div class="card dungeon-card running">
      <div class="row-between"><b>${img('icon_dungeon')} ${escapeHtml(d.name)} · ${diff.label}</b><span class="muted">niv. ${run.level}</span></div>
      ${roomPath(d, run.room)}
      ${progressBar((run.room - 1 + (boss ? 0 : run.kills / d.killsPerRoom)) / dungeonRooms(state, d), boss ? `Salle du boss — ${BOSSES[d.boss].name}` : `Salle ${run.room}/${dungeonRooms(state, d)} · ${run.kills}/${d.killsPerRoom}`)}
      <div class="section-title">Chemin (modifiable à tout moment)</div>
      <div class="chip-row">${paths}</div>
      <div class="muted">Butin final : objet Épique ou mieux · ${run.slot === 'any' ? 'tout emplacement' : SLOTS[run.slot]} · +${diff.fragments} fragments anciens</div>
      <div>Gagné : <span class="gold-text">${rewardText(run.earned, formatNumber) || '—'}</span></div>
      ${mechanicLine(d)}
      <button class="btn btn-danger small" data-action="abandon-dungeon">Abandonner (retour à la campagne)</button>
    </div>`;
}

// v9.1.0 : mécanique du boss final et son contre, sur la fiche du donjon.
function mechanicLine(d) {
  const t = bossTrait(d.boss);
  return t ? `<div class="trait-box" style="--trait:${t.color}"><b>${escapeHtml(BOSSES[d.boss].name)} — ${escapeHtml(t.name)}</b> : ${escapeHtml(t.text)}. <span class="muted">Parade : ${escapeHtml(t.counter)}</span></div>` : '';
}

// v10.3.1 : la mécanique du boss « en image » (PixelLab : assets/ui/art104/dungeon_mech_*.png, tools/art/pl104_dungeons.py) et sa légende d'une phrase.
// Pas de mécanique (Dryade pourrissante) : image « combat franc ».
export const MECH_LEGEND = {
  summoner: 'Elle invoque des spectres : tue-les d\'abord.',
  armored: 'Sa carapace encaisse presque tout, mais elle s\'use à chaque coup : frappe vite.',
  escalate: 'Ses coups montent en puissance : finis-le vite, ou tiens bon.',
  desperate: 'Sous la moitié de ses PV, il enrage : prépare une bonne armure.',
  plain: 'Pas de mécanique spéciale : un combat franc.',
};
export function mechKey(d) {
  const t = bossTrait(d.boss);
  return Object.keys(TRAITS).find((k) => TRAITS[k] === t) ?? 'plain';
}
export default {
  id: 'dungeons',
  title: 'Donjons',
  icon: 'icon_dungeon',
  extra: (ui, state) => `${img('icon_key')}<b class="num">${state.keys}</b> clé${state.keys > 1 ? 's' : ''}`,
  render(ui, state) {
    if (state.dungeon) {
      ui.view.dungeonSheet = false; ui.dgSheet?.('');
      return isPhoneUi(ui) ? `<div class="m-frame cb-frame">${mTitle('icon_dungeon', 'Donjons', true)}${running(ui, state)}</div>` : running(ui, state);
    }
    // v9.1.3 : le Défi de la semaine est passé dans Aventure › Défis (avec la Tour).
    return dungeonsList(ui, state);
  },
};

// Défi de la semaine (v8.5) : règles de la semaine, tentatives, records personnels et semaines passées.
function nextMonday() {
  const d = new Date();
  const days = ((8 - d.getDay()) % 7) || 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function challengeCard(state) {
  const week = challengeWeek(state);
  const setup = weeklySetup(week.week);
  const run = state.challenge;
  const mods = setup.mods.map((id) => modifierById(id)).map((m) => `<span class="mod${m.good ? ' good' : ''}" title="${escapeHtml(m.text)}"><b>${escapeHtml(m.name)}</b> · ${escapeHtml(m.text)}</span>`).join('');
  const left = challengeTriesLeft(state);
  const history = (state.challengeHistory ?? []).slice(0, 5).map((h) => `<span>${h.week.slice(5).replace('-', '/')} : <b>${h.best}</b></span>`).join('');
  const last = state.challengeLast;
  const button = run
    ? `<div class="row-between"><b class="gold-text">Vague ${run.wave} en cours</b><button class="btn btn-danger small" data-action="leave-challenge">Abandonner</button></div>`
    : left > 0
      ? `<button class="btn btn-gold enter-btn" data-action="enter-challenge" ${state.dungeon || state.tower ? 'disabled title="Termine d\'abord le donjon ou la tour"' : ''}>Lancer le défi (${left} tentative${left > 1 ? 's' : ''} cette semaine)</button>`
      : `<button class="btn enter-btn" disabled>Tentatives épuisées — nouvelles règles le ${nextMonday().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</button>`;
  return `<div class="challenge-card">
    ${button}
    <div class="row-between"><b>Règles de la semaine</b><span class="muted">${escapeHtml(ZONES[setup.zone].name)}</span></div>
    <div class="mods">${mods}</div>
    <div class="muted">Des vagues de ${CHALLENGE.killsPerWave} ennemis toujours plus forts (${CHALLENGE.waveSeconds} s par vague), un boss toutes les ${CHALLENGE.bossEvery} vagues (sauf règle contraire).
      Une défaite termine la tentative. Récompenses à chaque nouveau meilleur score de la semaine et à chaque record absolu.</div>
    <div class="tower-stats"><span>${img('icon_trophy')} Record absolu : <b>${state.challengeBest ?? 0}</b></span>
      <span>Cette semaine : <b>${week.best}</b></span>
      ${last ? `<span class="muted">Dernière tentative : ${last.waves} vague${last.waves > 1 ? 's' : ''} en ${formatDuration(last.seconds)}</span>` : ''}</div>
    ${history ? `<div class="muted challenge-history">Semaines passées : ${history}</div>` : ''}
  </div>`;
}

// v10.4 (partie 4) : liste en bannières (une par ligne, décor en fond, boss en grand à droite) ; un appui ouvre la page du donjon.
const BOSS_ART = { crypt: 'boss_spectral_queen', sanctuary: 'boss_rotting_dryad', furnace: 'boss_magma_colossus', glacier: 'boss_frost_wyrm', citadel: 'boss_obsidian_tyrant' };
const GAIN_ICON = { grimoire: 'icon_grimoire', ascension: 'icon_ascension', shards: 'icon_shard', mastery: 'icon_mastery', fragments: 'icon_fragment' };
const star = (on) => `<img class="px dg-star${on ? '' : ' off'}" src="${icon('icon_star')}" alt="">`;
const stars3 = (n) => [0, 1, 2].map((i) => star(i < n)).join('');
// L'élément, en mot coloré (pas d'emoji : les badges d'élément en contiennent).
function elemTag(el) {
  const e = ELEMENTS[el];
  return e ? `<span class="dg-elem" style="--ec:${e.color}">${e.name}</span>` : '';
}

function banner(state, d) {
  const locked = state.maxStage < d.unlockStage;
  const stars = dungeonStars(state, d.id);
  const g = DUNGEON_GAIN[d.id];
  const diff = DIFFICULTY_ORDER[Math.max(0, stars - 1)];
  const n = Math.min(state.keys ?? 0, 10);
  const nm = nightmareBest(state, d.id);
  return `<div class="dg-card dg-banner${locked ? ' locked' : ''}" ><i class="dg-decor" style="background-image:url(assets/ui/art101/dungeon_${d.id}.png)"></i><img class="px dg-boss" src="assets/ui/art102/${BOSS_ART[d.id]}.png" alt="">
    <button class="dg-open" data-action="dungeon-sel" data-value="${d.id}" aria-label="${escapeHtml(d.name)}"></button>
    <div class="dg-info">
      <b class="dg-name">${escapeHtml(d.name)}</b>
      <span class="dg-sub">${escapeHtml(BOSSES[d.boss].name)} ${elemTag(zoneElement(d.zone))}</span>
      <span class="dg-stars" role="img" aria-label="${stars} étoiles sur 3">${stars3(stars)}${nm ? `<small>Cauchemar ${roman(nm)}</small>` : ''}</span>
      <span class="dg-gain">${g ? `${img(GAIN_ICON[g.key])}<span>${escapeHtml(g.label)}</span>` : ''}</span>
      <div class="dg-actions">${locked ? `<span class="tag-locked">${img('icon_lock', 'ico-lock')} Étape ${stageLabel(d.unlockStage)}</span>`
        : `<button class="btn btn-gold small" data-action="dungeon-sel" data-value="${d.id}">Entrer</button>${stars && n > 0 ? `<button class="btn small" data-action="sweep-n" data-value="${d.id}|${diff}|${n}">Balayer ×${n}</button>` : ''}`}</div>
    </div></div>`;
}

function dungeonsList(ui, state) {
  const target = bestSweepTarget(state);
  const head = `<div class="dg-head"><span class="dg-keys">${img('icon_key')} <b class="num">${state.keys}</b> clé${state.keys > 1 ? 's' : ''}</span>
    ${target && state.keys > 0 ? `<button class="btn btn-gold small" data-action="sweep-all-ask">Balayer tout (${state.keys})</button>` : ''}</div>`;
  const grid = `<div class="dg-grid">${DUNGEONS.map((d) => banner(state, d)).join('')}</div>`;
  // PC : la page du donjon EST le contenu du panneau en plein écran (socle des pages). Téléphone : feuille du bas (calque #dg-host).
  if (ui.view.dungeonSheet && pageActive(ui)) { ui.dgSheet?.(''); return `<div class="pg dgp-page dgp-root" role="dialog" aria-label="Donjon">${dungeonPage(ui, state)}</div>`; }
  ui.dgSheet?.(ui.view.dungeonSheet ? `<div class="dg-sheet-back" data-action="dungeon-close"></div><div class="dg-sheet dgp-root" role="dialog" aria-label="Donjon">${dungeonPage(ui, state)}</div>` : '');
  return isPhoneUi(ui) ? phoneList(state, target) : head + grid;
}

// v10.12 : Donjons sur téléphone — clés en .m-cost dans l'en-tête ; chaque donjon : bannière de 120 px, « Entrer » (44 px) à droite.
function phoneBanner(state, d) {
  const locked = state.maxStage < d.unlockStage;
  const stars = dungeonStars(state, d.id);
  const g = DUNGEON_GAIN[d.id];
  const diff = DIFFICULTY_ORDER[Math.max(0, stars - 1)];
  const n = Math.min(state.keys ?? 0, 10);
  const nm = nightmareBest(state, d.id);
  const act = locked ? `<span class="dgm-lock">${img('icon_lock', 'ico-lock')} Étape ${stageLabel(d.unlockStage)}</span>` : mBtn('Entrer', { action: 'dungeon-sel', value: d.id, cls: 'dgm-enter' });
  const sweep = !locked && stars && n > 0 ? mChip(`Balayer ×${n}`, { action: 'sweep-n', value: `${d.id}|${diff}|${n}` }) : '';
  return `<div class="m-card dgm${locked ? ' locked' : ''}" data-d="${d.id}" style="--dgm-bg:url(assets/ui/art101/dungeon_${d.id}.png)">
    <div class="dgm-info"><b class="dgm-name">${escapeHtml(d.name)}</b><span class="dgm-sub">${escapeHtml(BOSSES[d.boss].name)} ${elemTag(zoneElement(d.zone))}</span>
      <span class="dgm-row"><span class="dg-stars" role="img" aria-label="${stars} étoiles sur 3">${stars3(stars)}</span>${nm ? `<small>Cauchemar ${roman(nm)}</small>` : ''}${g ? `<span class="dgm-gain" title="${escapeHtml(g.label)}">${img(GAIN_ICON[g.key])}<span>${escapeHtml(g.label)}</span></span>` : ''}</span>${sweep}</div>
    <div class="dgm-side"><img class="px dgm-boss" src="assets/ui/art102/${BOSS_ART[d.id]}.png" alt="">${act}</div></div>`;
}
function phoneList(state, target) {
  const all = target && state.keys > 0 ? mBtn(`Balayer tout (${state.keys})`, { action: 'sweep-all-ask' }) : '';
  return `<div class="m-frame cb-frame">${mTitle('icon_dungeon', 'Donjons', true)}
    <div class="m-card dgm-head"><span class="m-costs">${mCost('icon_key', state.keys, 1)}</span><b class="dgm-keys">Clés</b>${all}</div>
    ${DUNGEONS.map((d) => phoneBanner(state, d)).join('')}</div>`;
}

// Textes courts de la pastille de mécanique (nombres tirés des données de TRAITS).
export function mechPill(d) {
  const k = mechKey(d);
  const t = TRAITS[k];
  switch (k) {
    case 'summoner': return `${t.name} : ${t.count} serviteurs toutes les ${t.every} s · ton arme : dégâts de zone`;
    case 'armored': return `${t.name} : −${t.shell} % de dégâts reçus · ton arme : vitesse d'attaque`;
    case 'escalate': return `${t.name} : dégâts +${t.stepPct} % toutes les ${t.stepSeconds} s · ton atout : PV et vol de vie`;
    case 'desperate': return `${t.name} : enragé sous ${Math.round(t.below * 100)} % de PV · ton atout : armure`;
    default: return 'Combat franc : aucune mécanique spéciale';
  }
}
function mechPillHtml(d) {
  return `<div class="dg-mech"><img class="px dg-mech-img" src="assets/ui/art104/dungeon_mech_${mechKey(d)}.png" alt=""><span class="dg-mech-text">${escapeHtml(mechPill(d))}</span></div>`;
}

// Les 5 portes de salles (dessinées) : l'ordre est celui de DOORS.
const DOOR_ORDER = ['combat', 'elite', 'treasure', 'altar', 'rest'];
function doorsRow() {
  return `<div class="dgp-doors">${DOOR_ORDER.map((id) => `<figure class="dgp-door" title="${escapeHtml(DOORS[id].label)} : ${escapeHtml(DOORS[id].text)}"><img class="px" src="assets/ui/art102/door_${id}.png" alt="${escapeHtml(DOORS[id].label)}"></figure>`).join('')}</div>`;
}

// « Ton équipe » : portraits, compagnon d'affinité entouré, équipes enregistrées en menu déroulant.
function teamBlock(ui, state, d) {
  const equipped = state.companions.equipped.map((id) => companionById(id)).filter(Boolean);
  const ally = companionById(d.ally);
  const inTeam = ally && state.companions.equipped.includes(ally.id);
  const own = ally && state.companions.owned[ally.id];
  const a = BALANCE.dungeonAffinity;
  const others = equipped.filter((c) => c.id !== d.ally);
  const faces = [...others.map((c) => `<span class="dgp-face" title="${escapeHtml(c.name)}">${companionStill(c)}</span>`),
    ally ? (inTeam ? `<span class="dgp-face ally" title="${escapeHtml(ally.name)}">${companionStill(ally)}</span>`
      : own ? `<button class="dgp-face ally off" data-action="toggle-companion" data-value="${ally.id}" title="${escapeHtml(ally.name)}">${companionStill(ally)}</button>`
        : `<span class="dgp-face ally off" title="${escapeHtml(ally.name)}">${companionStill(ally)}</span>`) : ''].join('');
  const saved = (state.loadouts ?? []).map((l, i) => [l, i]).filter(([l]) => l.team);
  const ids = [...state.companions.equipped].sort().join('|');
  const current = saved.find(([l]) => [...l.team].sort().join('|') === ids)?.[1]; // l'équipe enregistrée qui correspond à l'équipe actuelle
  const select = saved.length
    ? `<select class="dgp-team-select" data-action="dungeon-team-select" aria-label="Équipes enregistrées"><option value="" ${current === undefined ? 'selected' : ''}>Équipe : actuelle</option>${saved.map(([l, i]) => `<option value="${i}" ${current === i ? 'selected' : ''}>Équipe : ${escapeHtml(l.name)}</option>`).join('')}</select>` : '';
  return `${select}<div class="dgp-faces">${faces}</div>${ally ? `<div class="dgp-ally${inTeam ? '' : ' off'}">×${a.skillMultiplier} ${escapeHtml(ally.name)} ici</div>` : ''}`;
}
function status(state, d) {
  if (state.maxStage < d.unlockStage) return 'locked';
  return state.dungeonsCleared[d.id] ? 'done' : 'open';
}

// Page du donjon : en-tête (décor, boss, mécanique), Difficulté, Tu gagnes, Ton équipe, Les salles, « Entrer » fixe.
function dungeonPage(ui, state) {
  const open = DUNGEONS.filter((d) => status(state, d) !== 'locked');
  const sel = dungeonById(ui.view.dungeonSel) ?? open[0] ?? DUNGEONS[0];
  const locked = state.maxStage < sel.unlockStage;
  const unlocked = unlockedDifficulties(state, sel.id);
  const diffId = unlocked.includes(ui.view.dungeonDiff) ? ui.view.dungeonDiff : unlocked[unlocked.length - 1];
  const diff = DUNGEON_DIFFICULTIES[diffId];
  const stars = dungeonStars(state, sel.id);
  const cleared = state.dungeonsCleared[sel.id] ?? 0;
  // Cauchemar (lu avant les récompenses : elles en dépendent).
  const nmMax = nightmareOpen(state, sel.id);
  const nmSel = diffId === 'hard' ? Math.min(Number(ui.view.dungeonNm) || 0, nmMax) : 0;
  const nmRow = nmMax ? `<span class="dgp-nm" role="group" aria-label="Cauchemar">${img('icon_skull', 'ico20', 'Cauchemar')}${Array.from({ length: nmMax + 1 }, (_, i) => `<button class="btn chip-btn small${i === nmSel ? ' active' : ''}" data-action="dungeon-nm" data-value="${i}" ${diffId === 'hard' ? '' : 'disabled'}>${i ? roman(i) : '—'}</button>`).join('')}</span>` : '';
  const tiles = DIFFICULTY_ORDER.map((id, i) => {
    const dd = DUNGEON_DIFFICULTIES[id];
    const ok = unlocked.includes(id);
    const done = i <= (state.dungeonBest[sel.id] ?? -1);
    return `<button class="dgp-tile${id === diffId ? ' active' : ''}${done ? ' done' : ''}${ok ? '' : ' locked'}" data-action="dungeon-diff" data-value="${id}" ${ok ? '' : 'disabled'} aria-pressed="${id === diffId}">
      <img class="px dgp-tile-art" src="assets/ui/art104/dungeon_diff_${id}.png" alt="">${ok ? '' : '<img class="px dgp-lock" src="assets/ui/art104/dungeon_diff_lock.png" alt="">'}
      <b>${dd.label}</b><span class="dgp-x" title="Danger ×${dd.skulls}">×${dd.skulls}</span>${ok ? '' : `<small>Après ${DUNGEON_DIFFICULTIES[DIFFICULTY_ORDER[i - 1]].label}</small>`}</button>`;
  }).join('');
  // Tu gagnes : une rangée d'icônes avec les quantités.
  const nmK = nightmareMult(nmSel);
  const g = DUNGEON_GAIN[sel.id];
  const path = ui.view.dungeonPath ?? state.ui.dungeonPath ?? 'gold';
  const level = Math.max(1, levelForStage(state.maxStage) + sel.levelOffset + diff.levelBonus);
  const roomPay = path === 'gold' ? ['coin', DUNGEON_PATHS.gold.goldKills * referenceKillGold(level) * (sel.rooms - 1) * nmK, 'Or'] : ['icon_shard', DUNGEON_PATHS.relics.shards * (sel.rooms - 1) * nmK, 'Éclats'];
  const set = dungeonSet(sel);
  const gain = (ic, qty, title, cls = '', file = false) => `<div class="dgp-gain ${cls}" title="${escapeHtml(title)}">${file ? `<img class="px" src="assets/ui/art104/${ic}.png" alt="">` : `<img class="px" src="${icon(ic, 3)}" alt="">`}<b>${qty}</b></div>`;
  const gains = [
    g ? gain(GAIN_ICON[g.key], `×${formatNumber(Math.round((mainGain(sel, diffId, nmSel)[g.key] ?? 0) * nmK))}`, g.label) : '',
    gain(roomPay[0], formatNumber(Math.round(roomPay[1])), roomPay[2]),
    gain('icon_gem', formatNumber(Math.round(DUNGEON_REWARD.gems * diff.gems * nmK)), 'Gemmes'),
    gain('icon_fragment', formatNumber(Math.round(diff.fragments * nmK)), 'Fragments anciens'),
    gain('dungeon_rw_set', '×1', `Équipement Épique ou mieux${set ? ` — ensemble ${set.name}` : ''}`, 'r-epic', true),
    gain('dungeon_rw_firstclear', cleared ? '—' : '×1', cleared ? 'Gros coffre du premier passage : déjà reçu' : 'Gros coffre du premier passage', cleared ? 'got' : 'r-legendary', true),
  ].join('');
  const slot = ui.view.dungeonSlot ?? state.ui.dungeonSlot ?? 'any';
  const canEnter = canEnterDungeon(state, sel.id);
  const enter = locked ? `<div class="bad">Débloqué à l'étape ${stageLabel(sel.unlockStage)}.</div>`
    : `<button class="btn btn-gold enter-btn primary-action" data-action="enter-dungeon" data-value="${sel.id}" data-diff="${diffId}" data-nm="${nmSel}" ${canEnter ? '' : 'disabled'}>Entrer · ${diff.label} · ${img('icon_key')} 1 clé</button>
      ${canSweepDungeon(state, sel.id, diffId) ? `<button class="btn primary-action dg-sweep" data-action="sweep-dungeon" data-value="${sel.id}" data-diff="${diffId}">Balayer</button>` : ''}
      ${state.tower ? '<div class="bad">Quitte la Tour d\'abord.</div>' : ''}${state.challenge ? '<div class="bad">Termine le Défi d\'abord.</div>' : ''}${state.keys < 1 ? '<div class="bad">Aucune clé.</div>' : ''}`;
  const dEl = zoneElement(sel.zone);
  const dBeh = [...new Set(sel.enemies.map(enemyBehavior).filter(Boolean))];
  const helpOn = Boolean(ui.view.dungeonHelp);
  const slotSelect = `<select data-action="dungeon-slot-select" aria-label="Butin ciblé">${[['any', 'Tout emplacement'], ...Object.entries(SLOTS)].map(([v, l]) => `<option value="${v}" ${slot === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const paths = Object.entries(DUNGEON_PATHS).map(([id, p]) => `<button class="path-card${path === id ? ' active' : ''}" data-action="dungeon-path-pre" data-value="${id}" aria-pressed="${path === id}"><b>${p.label}</b><span class="muted">${p.text}</span></button>`).join('');
  // « ? » : toutes les phrases d'aide, les réglages de butin et les tentatives (hors de la page tant qu'on ne le demande pas).
  const help = helpOn ? `<div class="dgp-help card" role="region" aria-label="Aide du donjon">
      <p>${escapeHtml(sel.description)}</p>
      <p>${escapeHtml(MECH_LEGEND[mechKey(sel)] ?? MECH_LEGEND.plain)}</p>
      <p class="muted">Élément : ${escapeHtml(ELEMENTS[dEl]?.name ?? '—')}${dBeh.length ? ` · Monstres : ${dBeh.map((b) => BEHAVIORS[b].name).join(', ')}` : ''} · ennemis niv. ${Math.max(1, state.maxStage + sel.levelOffset + diff.levelBonus)} · PV ×${diff.hp} · ${cleared} victoire${cleared > 1 ? 's' : ''}</p>
      <p class="muted">Équipe conseillée : ${(sel.roles ?? []).map((r) => ROLES[r]?.label).filter(Boolean).join(', ')}${set ? ` · Ensemble : ${escapeHtml(set.name)}` : ''}</p>
      <p class="muted">Un chemin par défaut « Normal » est choisi pour toi. Une porte s'ouvre entre deux salles : combat, élite, trésor, autel ou repos.</p>
      <div class="row dungeon-target"><span class="section-title">Butin ciblé</span>${slotSelect}</div>
      <div class="section-title">Chemin</div><div class="path-row">${paths}</div>
      ${runsBlock(state, sel, diffId)}
    </div>` : '';
  const boss = BOSSES[sel.boss];
  return `<header class="pg-top dgp-hero"><i class="dg-decor" style="background-image:url(assets/ui/art101/dungeon_${sel.id}.png)"></i>
      <img class="px dg-boss-portrait" src="assets/ui/art102/${BOSS_ART[sel.id]}.png" alt="${escapeHtml(boss.name)}">
      <div class="dgp-title"><b class="dgp-name">${escapeHtml(sel.name)}</b><span class="dgp-boss">${escapeHtml(boss.name)} ${elemTag(dEl)}</span><span class="dg-stars">${stars3(stars)}</span></div>
      ${mechPillHtml(sel)}
      <div class="dgp-tools"><button class="btn small dg-help${helpOn ? ' active' : ''}" data-action="dungeon-help" aria-label="Aide" aria-pressed="${helpOn}">?</button><button class="btn small dg-close" data-action="dungeon-close" aria-label="Fermer">×</button></div>
    </header>
    ${help}
    <div class="dgp-body">
      <div class="pg-main">
        <section class="dgp-sec dgp-diff"><div class="dgp-h"><h3>Difficulté</h3>${nmRow}</div><div class="dgp-tiles">${tiles}</div></section>
        <section class="dgp-sec"><div class="dgp-h"><h3>Tu gagnes</h3></div><div class="dgp-gains">${gains}</div></section>
      </div>
      <div class="pg-side">
        <section class="dgp-sec dgp-team"><div class="dgp-h"><h3>Ton équipe</h3></div>${teamBlock(ui, state, sel)}</section>
        <section class="dgp-sec"><div class="dgp-h"><h3>Les salles</h3></div>${doorsRow()}</section>
      </div>
    </div>
    <div class="dg-enter">${enter}</div>`;
}
