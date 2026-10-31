// Donjons (v7.7) : liste filtrable + fiche détaillée (difficulté, salles, récompenses, butin ciblé, chemin).
// Bien plus durs que la campagne ; ils rapportent les fragments anciens de l'arbre de talents.
import { BALANCE } from '../../data/balance.js';
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { COMPANIONS } from '../../data/companions.js';
import { DIFFICULTY_ORDER, DUNGEON_DIFFICULTIES, DUNGEON_PATHS, DUNGEON_REWARD, DUNGEONS } from '../../data/dungeons.js';
import { SLOTS } from '../../data/items.js';
import { ROLES } from '../../data/synergies.js';
import { stageLabel } from '../../core/combat.js';
import { canEnterDungeon, dungeonById, dungeonRunInfo, unlockedDifficulties } from '../../core/dungeon.js';
import { formatDuration } from '../../core/format.js';
import { itemIconUrl } from '../../render/pixel.js';
import { rewardText } from '../../core/rewards.js';
import { slotIconName } from '../../render/pixel.js';
import { animCanvas } from '../animator.js';
import { CHALLENGE, challengeTriesLeft, challengeUnlocked, challengeWeek, modifierById, weeklySetup } from '../../core/challenge.js';
import { ZONES } from '../../data/zones.js';
import { escapeHtml, formatNumber, img, progressBar } from '../common.js';

const FILTERS = { all: 'Tous', open: 'Disponibles', done: 'Terminés', locked: 'Verrouillés' };

function bossPortrait(d, scale = 1) {
  const boss = BOSSES[d.boss];
  return animCanvas(`foe:${boss.sprite ?? ENEMIES[boss.base].sprite}`, 124, 80, scale);
}

// Compagnon SSR adapté : caché par défaut (code ORACLE pour le révéler).
function affinityLine(state, d) {
  const ally = COMPANIONS.find((c) => c.id === d.ally);
  if (!ally) return '';
  if (!state.cheats?.reveal) {
    return `<div class="dungeon-ally"><b class="gold-text">Un compagnon SSR est adapté à ce donjon…</b>
      <div class="muted">Avec lui dans l'équipe, il écrase tout ici. À vous de découvrir lequel !</div></div>`;
  }
  const a = BALANCE.dungeonAffinity;
  const inTeam = state.companions.equipped.includes(ally.id);
  return `<div class="dungeon-ally"><b class="gold-text">Compagnon adapté : ${escapeHtml(ally.name)} (SSR)</b> · ${inTeam ? '<span class="good">dans l\'équipe ✔</span>' : '<span class="muted">absent</span>'}
    <div class="muted">Ici : compétence ×${a.skillMultiplier}, passif ×${a.passiveMultiplier}, dégâts de l'équipe +${a.teamDamagePct} %, dégâts subis −${a.damageTakenPct} %.</div></div>`;
}

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
  return `<div class="card-sub run-block"><div class="section-title">Vos expéditions · ${DUNGEON_DIFFICULTIES[diffId].label} <span class="muted">(${info.tries} essai${info.tries > 1 ? 's' : ''})</span></div>
    <div class="run-cols">${runCard(info.last, same ? 'Dernière et meilleure tentative' : 'Dernière tentative')}${same ? '' : runCard(info.best, 'Meilleure tentative')}</div></div>`;
}

function running(ui, state) {
  const run = state.dungeon;
  const d = dungeonById(run.id);
  const diff = DUNGEON_DIFFICULTIES[run.difficulty] ?? DUNGEON_DIFFICULTIES.easy;
  const paths = Object.entries(DUNGEON_PATHS).map(([id, p]) => `<button class="btn chip-btn${run.path === id ? ' active' : ''}"
    data-action="dungeon-path" data-value="${id}" title="${p.text}">${p.label}</button>`).join('');
  const boss = run.room >= d.rooms;
  return `<div class="card dungeon-card running">
      <div class="row-between"><b>${img('icon_dungeon')} ${escapeHtml(d.name)} · ${diff.label}</b><span class="muted">niv. ${run.level}</span></div>
      ${roomPath(d, run.room)}
      ${progressBar((run.room - 1 + (boss ? 0 : run.kills / d.killsPerRoom)) / d.rooms, boss ? `Salle du boss — ${BOSSES[d.boss].name}` : `Salle ${run.room}/${d.rooms} · ${run.kills}/${d.killsPerRoom}`)}
      <div class="section-title">Chemin (modifiable à tout moment)</div>
      <div class="chip-row">${paths}</div>
      <div class="muted">Butin final : objet Épique ou mieux · ${run.slot === 'any' ? 'tout emplacement' : SLOTS[run.slot]} · +${diff.fragments} fragments anciens</div>
      <div>Gagné : <span class="gold-text">${rewardText(run.earned, formatNumber) || '—'}</span></div>
      <button class="btn btn-danger small" data-action="abandon-dungeon">Abandonner (retour à la campagne)</button>
    </div>`;
}

function status(state, d) {
  if (state.maxStage < d.unlockStage) return 'locked';
  return state.dungeonsCleared[d.id] ? 'done' : 'open';
}

export default {
  id: 'dungeons',
  title: 'Donjons',
  icon: 'icon_dungeon',
  extra: (ui, state) => `${img('icon_key')}<b class="num">${state.keys}</b> clé${state.keys > 1 ? 's' : ''}`,
  render(ui, state) {
    if (state.dungeon) return running(ui, state);
    return challengeCard(state) + dungeonsList(ui, state);
  },
};

// Défi de la semaine (v8.5) : règles de la semaine, tentatives, records personnels et semaines passées.
function nextMonday() {
  const d = new Date();
  const days = ((8 - d.getDay()) % 7) || 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function challengeCard(state) {
  if (!challengeUnlocked(state)) {
    return `<div class="card muted challenge-card">⚔ Défi de la semaine : s'ouvre à l'étape ${stageLabel(CHALLENGE.unlockStage)}.</div>`;
  }
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
      ? `<button class="btn btn-gold enter-btn" data-action="enter-challenge" ${state.dungeon || state.tower ? 'disabled title="Terminez d\'abord le donjon ou la tour"' : ''}>Lancer le défi (${left} tentative${left > 1 ? 's' : ''} cette semaine)</button>`
      : `<button class="btn enter-btn" disabled>Tentatives épuisées — nouvelles règles le ${nextMonday().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</button>`;
  return `<div class="card challenge-card">
    <div class="row-between"><div class="boss-title">⚔ Défi de la semaine</div><span class="muted">${escapeHtml(ZONES[setup.zone].name)}</span></div>
    <div class="muted">Des vagues de ${CHALLENGE.killsPerWave} ennemis toujours plus forts (${CHALLENGE.waveSeconds} s par vague), un boss toutes les ${CHALLENGE.bossEvery} vagues (sauf règle contraire).
      Une défaite termine la tentative. Récompenses à chaque nouveau meilleur score de la semaine et à chaque record absolu.</div>
    <div class="mods">${mods}</div>
    <div class="tower-stats"><span>${img('icon_trophy')} Record absolu : <b>${state.challengeBest ?? 0}</b></span>
      <span>Cette semaine : <b>${week.best}</b></span>
      ${last ? `<span class="muted">Dernière tentative : ${last.waves} vague${last.waves > 1 ? 's' : ''} en ${formatDuration(last.seconds)}</span>` : ''}</div>
    ${history ? `<div class="muted challenge-history">Semaines passées : ${history}</div>` : ''}
    ${button}
  </div>`;
}

function dungeonsList(ui, state) {
  const filter = ui.view.dungeonFilter ?? 'all';
  const sel = dungeonById(ui.view.dungeonSel) ?? DUNGEONS.find((d) => status(state, d) !== 'locked') ?? DUNGEONS[0];
  const chips = Object.entries(FILTERS).map(([id, label]) => `<button class="btn chip-btn${id === filter ? ' active' : ''}" data-action="dungeon-filter" data-value="${id}">${label}</button>`).join('');
  const list = DUNGEONS.filter((d) => filter === 'all' || status(state, d) === filter).map((d) => {
    const st = status(state, d);
    const cleared = state.dungeonsCleared[d.id] ?? 0;
    return `<button class="dungeon-item${d.id === sel.id ? ' selected' : ''}${st === 'locked' ? ' locked' : ''}" data-action="dungeon-sel" data-value="${d.id}">
      <div class="boss-thumb">${bossPortrait(d)}</div>
      <div class="grow"><b>${escapeHtml(d.name)}</b><div class="muted">Boss : ${escapeHtml(BOSSES[d.boss].name)}</div>
        <div>${st === 'locked' ? `<span class="tag-locked">Verrouillé</span> <span class="muted">Étape ${stageLabel(d.unlockStage)} requise</span>`
          : `<span class="tag-open">Disponible</span> <span class="muted">${cleared ? `${cleared} victoire${cleared > 1 ? 's' : ''}` : 'Jamais terminé'}</span>`}</div></div>
    </button>`;
  }).join('') || '<div class="muted">Aucun donjon dans cette catégorie.</div>';

  const locked = state.maxStage < sel.unlockStage;
  const unlocked = unlockedDifficulties(state, sel.id);
  const diffId = unlocked.includes(ui.view.dungeonDiff) ? ui.view.dungeonDiff : unlocked[unlocked.length - 1];
  const diff = DUNGEON_DIFFICULTIES[diffId];
  const diffs = DIFFICULTY_ORDER.map((id) => {
    const dd = DUNGEON_DIFFICULTIES[id];
    const i = DIFFICULTY_ORDER.indexOf(id);
    const ok = unlocked.includes(id);
    const done = i <= (state.dungeonBest[sel.id] ?? -1);
    const prev = i > 0 ? DUNGEON_DIFFICULTIES[DIFFICULTY_ORDER[i - 1]].label : '';
    return `<button class="btn diff-btn${id === diffId ? ' active' : ''}${done ? ' done' : ''}" data-action="dungeon-diff" data-value="${id}"
      ${ok ? (done ? 'title="Déjà réussi"' : '') : `disabled title="Terminez ce donjon en ${escapeHtml(prev)} pour débloquer"`}>
      <span class="skulls">${'☠'.repeat(dd.skulls)}</span><span>${ok ? '' : '🔒 '}${dd.label}${done ? ' ✔' : ''}</span></button>`;
  }).join('');
  const nextLocked = DIFFICULTY_ORDER.find((id) => !unlocked.includes(id));
  const unlockHint = nextLocked
    ? `<div class="muted small-note">🔒 ${DUNGEON_DIFFICULTIES[nextLocked].label} : terminez ce donjon (boss final vaincu) en ${DUNGEON_DIFFICULTIES[DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(nextLocked) - 1]].label}. Chaque donjon se débloque séparément.</div>`
    : '';
  const roles = (sel.roles ?? []).map((r) => `<div class="role-chip" style="--role:${ROLES[r].color}">${img(ROLES[r].icon)}<span>${ROLES[r].label}</span></div>`).join('');
  const slot = ui.view.dungeonSlot ?? 'any';
  const path = ui.view.dungeonPath ?? 'gold';
  const slots = [['any', null, 'Tous'], ...Object.entries(SLOTS).map(([s, l]) => [s, slotIconName(s), l])]
    .map(([v, ic, l]) => `<button class="btn chip-btn${slot === v ? ' active' : ''}" data-action="dungeon-slot" data-value="${v}" title="${l}">${ic ? img(ic) : ''}<span>${l}</span></button>`).join('');
  const paths = Object.entries(DUNGEON_PATHS).map(([id, p]) => `<button class="path-card${path === id ? ' active' : ''}" data-action="dungeon-path-pre" data-value="${id}">
    <b>${p.label}</b><span class="muted">${p.text}</span></button>`).join('');
  const rewards = [
    ['icon_bag', 'Équipement Épique ou mieux', 'r-epic'], ['icon_fragment', `${diff.fragments} fragments anciens`, 'r-legendary'],
    ['icon_gem', `${Math.round(DUNGEON_REWARD.gems * diff.gems)} gemmes`, 'r-rare'], ['icon_essence', `${Math.round(DUNGEON_REWARD.essence * diff.essence)} essences`, 'r-epic'],
  ].map(([ic, t, r]) => `<div class="reward-icon ${r}" title="${t}">${img(ic)}</div><span class="reward-label">${t}</span>`).join('');
  const cleared = state.dungeonsCleared[sel.id] ?? 0;
  const detail = `<div class="card dungeon-detail">
      <div class="dungeon-head">${img('icon_dungeon')}<div class="grow"><div class="boss-title">${escapeHtml(sel.name)}</div>
        <div class="muted">${escapeHtml(sel.description)}</div></div>
        <div class="diff-box"><div class="section-title">Difficulté</div><div class="diff-row">${diffs}</div>${unlockHint}
          <div class="muted">♛ ${cleared} victoire${cleared > 1 ? 's' : ''} · ennemis niv. ${Math.max(1, state.maxStage + sel.levelOffset + diff.levelBonus)} · PV ×${diff.hp}</div></div>
      </div>
      ${roles ? `<div class="row"><span class="section-title">Compagnons conseillés</span>${roles}</div>` : ''}
      ${affinityLine(state, sel)}
      ${roomPath(sel)}
      ${runsBlock(state, sel, diffId)}
      <div class="dungeon-cols">
        <div class="card-sub"><div class="section-title">Récompenses possibles</div><div class="reward-grid">${rewards}</div></div>
        <div class="card-sub"><div class="section-title">Butin ciblé <span class="muted">(emplacement de l'objet final)</span></div><div class="chip-row">${slots}</div>
          <div class="path-row">${paths}</div></div>
      </div>
      ${locked ? `<div class="bad">Débloqué à l'étape ${stageLabel(sel.unlockStage)}.</div>`
        : `<button class="btn btn-gold enter-btn" data-action="enter-dungeon" data-value="${sel.id}" data-diff="${diffId}" ${canEnterDungeon(state, sel.id) ? '' : 'disabled'}>Entrer dans le donjon · ${diff.label} — 1 ${img('icon_key')}</button>
          ${state.tower ? '<div class="bad">Vous êtes dans la Tour de l\'Éternité : quittez-la d\'abord (onglet Tour ou bouton « Quitter » sur la scène).</div>' : ''}
          ${state.challenge ? '<div class="bad">Défi de la semaine en cours : terminez-le ou abandonnez-le d\'abord (en haut de cet onglet).</div>' : ''}
          ${state.keys < 1 ? '<div class="muted">Clés : contrats « Vaincre des boss », missions et événements.</div>' : ''}`}
    </div>`;
  return `<div class="dungeon-layout">
      <div class="dungeon-side"><div class="chip-row">${chips}</div><div class="dungeon-list">${list}</div></div>
      ${detail}
    </div>`;
}

