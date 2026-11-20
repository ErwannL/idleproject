// Donjons (v7.7, v9.1.0) : donjons ouverts (verrouillés repliés) + fiche (difficulté, mécanique, butin ciblé, chemin, Entrer).
// Bien plus durs que la campagne ; ils rapportent les fragments anciens de l'arbre de talents.
import { teamChips } from '../team-chips.js'; // v9.9 (K16)
import { BALANCE } from '../../data/balance.js';
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { UNITS as COMPANIONS } from '../../data/banners.js'; // v9.1.3 (partie B)
import { DIFFICULTY_ORDER, DUNGEON_DIFFICULTIES, DUNGEON_PATHS, DUNGEON_REWARD, DUNGEONS } from '../../data/dungeons.js';
import { SLOTS } from '../../data/items.js';
import { stageLabel } from '../../core/combat.js';
import { DUNGEON_ROUTES, canEnterDungeon, canSweepDungeon, dungeonById, dungeonRooms, dungeonRunInfo, unlockedDifficulties } from '../../core/dungeon.js';
import { elementBadge, zoneElement } from '../../core/elements.js'; // v9.6.2
import { BEHAVIORS, enemyBehavior } from '../../data/behaviors.js'; // v9.6.2
import { formatDuration } from '../../core/format.js';
import { itemIconUrl } from '../../render/pixel.js';
import { rewardText } from '../../core/rewards.js';
import { animCanvas } from '../animator.js';
import { CHALLENGE, challengeTriesLeft, challengeWeek, modifierById, weeklySetup } from '../../core/challenge.js';
import { ZONES } from '../../data/zones.js';
import { escapeHtml, fold, formatNumber, img, progressBar, art98 } from '../common.js';
import { bossTrait } from '../../core/boss-traits.js';
import { ROLES } from '../../data/synergies.js';
import { DUNGEON_GAIN, bestSweepTarget, dungeonSet, dungeonStars, nightmareBest, nightmareOpen, roman } from '../../core/dungeon-plus.js'; // v10.1 (P3)


function bossPortrait(d, scale = 1) {
  const boss = BOSSES[d.boss];
  return animCanvas(`foe:${boss.sprite ?? ENEMIES[boss.base].sprite}`, 124, 80, scale);
}

// Compagnon Légendaire adapté : révélé après une victoire dans ce donjon (ou par le code ORACLE, version dev).
function affinityLine(state, d) {
  const ally = COMPANIONS.find((c) => c.id === d.ally);
  if (!ally) return '';
  // v10.1 (P3) : le compagnon adapté est montré tout de suite (plus de secret).
  const a = BALANCE.dungeonAffinity;
  const inTeam = state.companions.equipped.includes(ally.id);
  // v10.1 (P3) : affinité lisible (×3 au moins) et « Le prendre » d'un appui quand on le possède.
  const own = state.companions.owned[ally.id];
  if (true) return `<div class="dungeon-ally"><div class="da-row"><span class="da-mult">×${a.skillMultiplier}</span><div><b class="gold-text">${escapeHtml(ally.name)}</b> est chez lui ici : sorts ×${a.skillMultiplier}, équipe +${a.teamDamagePct} % de dégâts, −${a.damageTakenPct} % de dégâts subis.</div>
    ${inTeam ? '<span class="good">Dans l\'équipe ✔</span>' : own ? `<button class="btn btn-gold small" data-action="toggle-companion" data-value="${ally.id}">Le prendre</button>` : '<span class="muted">Pas encore obtenu</span>'}</div></div>`;
  return `<div class="dungeon-ally"><b class="gold-text">Compagnon adapté : ${escapeHtml(ally.name)} (Légendaire)</b> · ${inTeam ? '<span class="good">dans l\'équipe ✔</span>' : '<span class="muted">absent</span>'}
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
    if (state.dungeon) { ui.view.dungeonSheet = false; ui.dgSheet?.(''); return running(ui, state); }
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

// v10.1 (P3) : 5 grandes cartes illustrées (2 colonnes sur PC, 1 sur téléphone) ; un appui ouvre la feuille.
function bigCard(state, d) {
  const locked = state.maxStage < d.unlockStage;
  const stars = dungeonStars(state, d.id);
  const g = DUNGEON_GAIN[d.id];
  const diff = DIFFICULTY_ORDER[Math.max(0, stars - 1)];
  const n = Math.min(state.keys ?? 0, 10);
  const nm = nightmareBest(state, d.id);
  return `<div class="dg-card${locked ? ' locked' : ''}" style="background-image:url(assets/ui/art101/dungeon_${d.id}.png)">
    <button class="dg-open" data-action="dungeon-sel" data-value="${d.id}" aria-label="${escapeHtml(d.name)}"></button>
    <div class="dg-top"><b>${escapeHtml(d.name)}</b><span class="dg-stars" aria-label="${stars} étoiles sur 3">${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i>${nm ? ` <small>Cauchemar ${roman(nm)}</small>` : ''}</span></div>
    <div class="dg-gain">${g ? `${img(({ grimoire: 'icon_grimoire', ascension: 'icon_ascension', shards: 'icon_shard', mastery: 'icon_mastery', fragments: 'icon_fragment' })[g.key])}<span>${escapeHtml(g.label)}</span>` : ''}</div>
    <div class="dg-actions">${locked ? `<span class="tag-locked">${img('icon_lock', 'ico-lock')} Étape ${stageLabel(d.unlockStage)}</span>`
      : `<button class="btn btn-gold small" data-action="dungeon-sel" data-value="${d.id}">Entrer</button>${stars && n > 0 ? `<button class="btn small" data-action="sweep-n" data-value="${d.id}|${diff}|${n}">⚡ Balayer ×${n}</button>` : ''}`}</div></div>`;
}

function dungeonsList(ui, state) {
  const target = bestSweepTarget(state);
  const head = `<div class="dg-head"><span class="dg-keys">${img('icon_key')} <b class="num">${state.keys}</b> clé${state.keys > 1 ? 's' : ''}</span>
    ${target && state.keys > 0 ? `<button class="btn btn-gold small" data-action="sweep-all-ask">⚡ Balayer tout (${state.keys})</button>` : ''}</div>`;
  const grid = `<div class="dg-grid">${DUNGEONS.map((d) => bigCard(state, d)).join('')}</div>`;
  // La feuille vit au-dessus de tout (hors du panneau) : voile plein écran, « Entrer » fixé en bas.
  ui.dgSheet?.(ui.view.dungeonSheet ? `<div class="dg-sheet-back" data-action="dungeon-close"></div><div class="dg-sheet" role="dialog" aria-label="Donjon"><button class="btn small dg-close" data-action="dungeon-close" aria-label="Fermer">✕</button>${dungeonDetail(ui, state)}</div>` : '');
  return head + grid;
}

function dungeonDetail(ui, state) {
  const open = DUNGEONS.filter((d) => status(state, d) !== 'locked');
  const lockedList = DUNGEONS.filter((d) => status(state, d) === 'locked');
  const sel = dungeonById(ui.view.dungeonSel) ?? open[0] ?? DUNGEONS[0];
  const item = (d) => {
    const st = status(state, d);
    const cleared = state.dungeonsCleared[d.id] ?? 0;
    return `<button class="dungeon-item${d.id === sel.id ? ' selected' : ''}${st === 'locked' ? ' locked' : ''}" data-action="dungeon-sel" data-value="${d.id}">
      <div class="boss-thumb">${bossPortrait(d)}</div>
      <div class="grow"><b>${escapeHtml(d.name)}</b><div class="muted">Boss : ${escapeHtml(BOSSES[d.boss].name)}</div>
        <div>${st === 'locked' ? `<span class="tag-locked">Verrouillé</span> <span class="muted">Étape ${stageLabel(d.unlockStage)} requise</span>`
          : `<span class="tag-open">Disponible</span> <span class="muted">${cleared ? `${cleared} victoire${cleared > 1 ? 's' : ''}` : 'Jamais terminé'}</span>`}</div></div>
    </button>`;
  };
  const list = (open.map(item).join('') || '<div class="muted">Aucun donjon ouvert pour l\'instant.</div>')
    + (lockedList.length ? fold(ui, 'dungeons-locked', `Verrouillés (${lockedList.length})`, () => lockedList.map(item).join('')) : '');

  const locked = state.maxStage < sel.unlockStage;
  const unlocked = unlockedDifficulties(state, sel.id);
  const diffId = unlocked.includes(ui.view.dungeonDiff) ? ui.view.dungeonDiff : unlocked[unlocked.length - 1];
  const diff = DUNGEON_DIFFICULTIES[diffId];
  const diffs = DIFFICULTY_ORDER.map((id) => {
    const dd = DUNGEON_DIFFICULTIES[id];
    const i = DIFFICULTY_ORDER.indexOf(id);
    const ok = unlocked.includes(id);
    const done = i <= (state.dungeonBest[sel.id] ?? -1);
    return `<button class="btn diff-btn${id === diffId ? ' active' : ''}${done ? ' done' : ''}" data-action="dungeon-diff" data-value="${id}" ${ok ? '' : 'disabled'}>
      <span class="skulls">${img('icon_skull', 'ico20')}×${dd.skulls}</span><span>${ok ? '' : `${img('icon_lock', 'ico-lock', 'Verrouillé')} `}${dd.label}${done ? ' ✔' : ''}</span></button>`;
  }).join('');
  const nextLocked = DIFFICULTY_ORDER.find((id) => !unlocked.includes(id));
  const unlockHint = nextLocked
    ? `<div class="muted small-note">${img('icon_lock', 'ico-lock', 'Verrouillé')} ${DUNGEON_DIFFICULTIES[nextLocked].label} : termine ce donjon en ${DUNGEON_DIFFICULTIES[DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(nextLocked) - 1]].label}.</div>`
    : '';
  // v9.1.3 (décision) : plus de « Compagnons conseillés » (aucune recommandation).
  const slot = ui.view.dungeonSlot ?? state.ui.dungeonSlot ?? 'any';
  const path = ui.view.dungeonPath ?? state.ui.dungeonPath ?? 'gold';
  const slotSelect = `<select data-action="dungeon-slot-select" aria-label="Butin ciblé">${[['any', 'Tout emplacement'], ...Object.entries(SLOTS)].map(([v, l]) => `<option value="${v}" ${slot === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const paths = Object.entries(DUNGEON_PATHS).map(([id, p]) => `<button class="path-card${path === id ? ' active' : ''}" data-action="dungeon-path-pre" data-value="${id}" aria-pressed="${path === id}">
    <b>${p.label}</b><span class="muted">${p.text}</span></button>`).join('');
  // v9.6.2 (7.1, 7.2) : itinéraire, élément et comportements du donjon.
  const route = ui.view.dungeonRoute ?? 'normal';
  const routes = Object.entries(DUNGEON_ROUTES).map(([id, r]) => `<button class="path-card${route === id ? ' active' : ''}" data-action="dungeon-route" data-value="${id}" aria-pressed="${route === id}"><b>${r.label}</b><span class="muted">${r.text}</span></button>`).join('');
  const dEl = zoneElement(sel.zone);
  const dBeh = [...new Set(sel.enemies.map(enemyBehavior).filter(Boolean))];
  const dInfo = `<div class="dungeon-info">Élément : ${elementBadge(dEl)}${dBeh.length ? ` · Monstres : ${dBeh.map((b) => `${img(BEHAVIORS[b].icon)} ${BEHAVIORS[b].name}`).join(', ')}` : ''}</div>`;
  const rewards = [
    ['icon_bag', 'Équipement Épique ou mieux', 'r-epic'], ['icon_fragment', `${diff.fragments} fragments anciens`, 'r-legendary'],
    ['icon_gem', `${Math.round(DUNGEON_REWARD.gems * diff.gems)} gemmes`, 'r-rare'], ['icon_shard', `${Math.round(DUNGEON_REWARD.shards * diff.shards)} éclats`, 'r-epic'],
  ].map(([ic, t, r]) => `<div class="reward-icon ${r}">${img(ic)}</div><span class="reward-label">${t}</span>`).join('');
  const cleared = state.dungeonsCleared[sel.id] ?? 0;
  const enter = locked ? `<div class="bad">Débloqué à l'étape ${stageLabel(sel.unlockStage)}.</div>`
    : `<button class="btn btn-gold enter-btn primary-action" data-action="enter-dungeon" data-value="${sel.id}" data-diff="${diffId}" data-nm="${diffId === 'hard' ? nmSel : 0}" ${canEnterDungeon(state, sel.id) ? '' : 'disabled'}>Entrer · ${diff.label} — 1 ${img('icon_key')} <span class="key-stock">(${state.keys} en stock)</span></button>
      ${canSweepDungeon(state, sel.id, diffId) ? `<button class="btn btn-gold primary-action" data-action="sweep-dungeon" data-value="${sel.id}" data-diff="${diffId}">⚡ Balayer · ${diff.label} — 1 ${img('icon_key')}<small class="muted"> même butin, sans combat</small></button>` : ''}
      ${state.tower ? '<div class="bad">Tu es dans la Tour : quitte-la d\'abord.</div>' : ''}
      ${state.challenge ? '<div class="bad">Défi de la semaine en cours (Aventure › Défis) : termine-le d\'abord.</div>' : ''}
      ${state.keys < 1 ? '<div class="bad">Aucune clé. Clés : missions, contrats, expéditions, Défis.</div>' : ''}`;
  // v10.1 (P3) : équipe conseillée (rôles), ensemble du donjon, Cauchemar.
  const set = dungeonSet(sel);
  // v10.2 (1.6) : les équipes enregistrées passent sous « Équipe pour ce donjon », avec une phrase.
  const advice = `<div class="dg-advice-wrap"><div class="section-title">Équipe pour ce donjon</div><p class="muted small">Change d'équipe d'un appui : tes équipes enregistrées (chasse, or, boss) sont ci-dessous.</p>${teamChips(state)}<div class="dg-advice"><b>Équipe conseillée :</b> ${(sel.roles ?? []).map((r) => ROLES[r] ? `<span class="role-pill" style="--rc:${ROLES[r].color}">${img(ROLES[r].icon)} ${ROLES[r].label}</span>` : '').join(' ')}
    ${set ? `<div class="muted">Ensemble de ce donjon : <b style="color:${set.color}">${escapeHtml(set.name)}</b></div>` : ''}</div></div>`;
  const nmMax = nightmareOpen(state, sel.id);
  const nmSel = Math.min(Number(ui.view.dungeonNm) || 0, nmMax);
  const nmRow = nmMax ? `<div class="dg-nm"><b>Cauchemar</b> ${Array.from({ length: nmMax + 1 }, (_, i) => `<button class="btn chip-btn small${i === nmSel ? ' active' : ''}" data-action="dungeon-nm" data-value="${i}">${i ? roman(i) : 'Non'}</button>`).join('')}<span class="muted">+60 % de PV et de butin par palier</span></div>` : '';
  const detail = `<div class="card dungeon-detail">
      <div class="dungeon-head">${art98(`door_${sel.id}`, 'dungeon-door')}<div class="grow"><div class="boss-title">${escapeHtml(sel.name)}</div>
        <div class="muted">${escapeHtml(sel.description)}</div></div></div>
      ${advice}${nmRow}
      <div class="diff-box"><div class="section-title">Difficulté</div><div class="diff-row">${diffs}</div>${unlockHint}
        <div class="muted">♛ ${cleared} victoire${cleared > 1 ? 's' : ''} · ennemis niv. ${Math.max(1, state.maxStage + sel.levelOffset + diff.levelBonus)} · PV ×${diff.hp}</div></div>
      ${mechanicLine(sel)}
      ${dInfo}
      <div class="section-title">Itinéraire</div><div class="path-row">${routes}</div>
      ${fold(ui, 'dungeon-choice', `Butin : ${slot === 'any' ? 'tout' : escapeHtml(SLOTS[slot] ?? slot).toLowerCase()} · Chemin : ${({ gold: 'or', relics: 'reliques' })[path] ?? escapeHtml(path)}`, () => `<div class="row dungeon-target"><span class="section-title">Butin ciblé</span>${slotSelect}</div>
      <div class="section-title">Chemin</div><div class="path-row">${paths}</div>`)}
      ${affinityLine(state, sel)}
      ${fold(ui, 'dungeon-more', 'Récompenses, salles, tentatives', () => `<div class="reward-grid">${rewards}</div>
        ${roomPath(sel)}
        ${runsBlock(state, sel, diffId)}`)}
      <div class="dg-enter">${enter}</div>
    </div>`;
  void list;
  return detail;
}
