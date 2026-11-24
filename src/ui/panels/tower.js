import { arenaUnlocked } from '../../core/arena.js';
import { cardArena, totalStars } from '../../core/arena-cards.js';
// Tour de l'Éternité (v8.2) : défi sans fin, un boss par étage ; récompenses à chaque nouveau record.
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { formatDuration } from '../../core/format.js';
import { TOWER, climbsLeft, towerRule, towerBoss, towerLevel, towerReward, towerTimeLeft, towerUnlocked, towerWeek, weeklyReward } from '../../core/tower.js';
import { stageLabel } from '../../core/combat.js';
import { animCanvas } from '../animator.js';
import { escapeHtml, fold, formatNumber, glyph, img, rewardIcons, segment } from '../common.js';
import { challengeTriesLeft, challengeUnlocked } from '../../core/challenge.js';
import { challengeCard } from './dungeons.js';
import { bossTrait, TRAITS } from '../../core/boss-traits.js';
import { CHALLENGE, challengeWeek, modifierById, weeklySetup } from '../../core/challenge.js';
import { mBtn, mBtnGold, mEmpty, mModes, mSheet, mStat, mTitle } from '../mobile-kit.js'; // v10.12
import { isPhoneUi as isRealPhone } from './combat-phone.js';
const isPhoneUi = () => true; // v10.13 : le PC emploie le même kit (cadre, cartouche, tuiles) que le téléphone ; desk-activities.css lui donne ses tailles
import { ZONES } from '../../data/zones.js';

const bossName = (floor) => BOSSES[towerBoss(floor)]?.name ?? '?';
const bossSprite = (floor) => { const b = BOSSES[towerBoss(floor)]; return b.sprite ?? ENEMIES[b.base].sprite; };

// Les prochains étages, du plus haut au plus bas (façon tour), avec leur récompense de record.
function floorsList(state, from) {
  const best = state.towerBest ?? 0;
  const weekBest = towerWeek(state).best;
  const rows = [];
  for (let f = from + 5; f >= Math.max(1, from - 1); f--) {
    const current = state.tower?.floor === f;
    const mega = f % TOWER.milestone === 0;
    // v8.4 : deux récompenses distinctes — record à vie (une seule fois) et meilleur étage de la semaine.
    const record = f <= best ? '<span class="muted">Record ✔</span>' : `<span>Record ${rewardIcons(towerReward(f))}</span>`;
    const weekly = f <= weekBest ? '<span class="good">Semaine ✔</span>' : `<span>Semaine ${rewardIcons(weeklyReward(f))}</span>`;
    rows.push(`<div class="tower-floor${current ? ' current' : ''}${f <= weekBest ? ' done' : ''}${mega ? ' mega' : ''}">
      <span class="tf-num">${f}</span>
      <span class="tf-boss">${mega ? `${glyph('icon_crown')} ` : ''}${escapeHtml(bossName(f))} <span class="muted">niv. ${formatNumber(towerLevel(state, f))}</span></span>
      <span class="tf-reward">${weekly}${record}</span></div>`);
  }
  return rows.join('');
}

// Prochain lundi 0 h (remise à zéro des ascensions).
function nextReset() {
  const d = new Date();
  const days = ((8 - d.getDay()) % 7) || 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

// v9.1.3 : onglet « Défis » = Tour de l'Éternité + Défi de la semaine (venu de Donjons). Visible dès que l'un des
// deux est ouvert ; le verrou de la Tour ne bloque plus le Défi.
export default {
  id: 'tower',
  title: 'Défis',
  icon: 'icon_tower',
  extra: (ui, state) => (towerUnlocked(state) ? `Record : <b class="num">${state.towerBest ?? 0}</b>` : ''),
  render(ui, state) {
    const chOpen = challengeUnlocked(state) || Boolean(state.challenge);
    // v10.3 (audit 2.1) : l'Arène a son propre onglet dans Combat ; Défis garde la Tour et le Défi de la semaine, et
    // une tuile illustrée qui mène à l'Arène.
    const parts = [['tower', 'Tour', 'icon_tower'], ...(chOpen ? [['challenge', 'Défi de la semaine', 'icon_skull']] : [])];
    // v9.8 (I8) : un défi ou une ascension en cours ne bloque plus les autres onglets (on y revient d'un appui).
    const forced = ui.view.defiTab ? null : state.challenge ? 'challenge' : state.tower ? 'tower' : null;
    const tab = forced ?? (parts.some(([id]) => id === ui.view.defiTab) ? ui.view.defiTab : (towerUnlocked(state) ? 'tower' : chOpen ? 'challenge' : 'tower'));
    const seg = parts.length > 1 ? segment(parts.map(([id, l, ic]) => [id, id === 'challenge' && !state.challenge ? `${l} (${challengeTriesLeft(state)})` : l, ic]), 'defi-tab', tab) : '';
    const tile = arenaUnlocked(state) ? `<button class="arena-tile" data-action="open-tab" data-value="arena" style="background-image:url(assets/ui/art101/arena_tile.png)"><b>Arène à cartes</b><span>Étage ${cardArena(state).best + 1} · ${totalStars(state)} ★</span></button>` : '';
    if (isPhoneUi(ui)) return phoneView(ui, state, parts, tab, isRealPhone(ui) ? '' : tile); // PC : la tuile illustrée qui mène à l'Arène (le téléphone la trouve dans la Carte)
    if (tab === 'challenge') return `${seg}${tile}<div class="card">${challengeCard(state)}</div>`;
    return seg + tile + towerBody(ui, state);
  },
};

function towerBody(ui, state) {
    if (!towerUnlocked(state)) {
      return `<div class="card muted">La Tour de l'Éternité s'ouvre à l'étape ${stageLabel(TOWER.unlockStage)}.</div>`;
    }
    const run = state.tower;
    const floor = run?.floor ?? (state.towerBest ?? 0) + 1;
    const last = state.towerLast;
    // v9.1.0 : d'abord record, essais et Monter (ou, en cours : étage, temps avant effondrement, Quitter) ; la mécanique
    // du boss de l'étage ; la liste des étages et l'explication sont repliées.
    const trait = bossTrait(towerBoss(floor));
    const action = run
      ? `<div class="row-between"><b class="gold-text">Étage ${run.floor} : ${escapeHtml(bossName(run.floor))}</b>
          <button class="btn btn-danger small" data-action="leave-tower">Quitter la tour</button></div>
        <div>${glyph('icon_timer')} Effondrement dans <b>${formatDuration(towerTimeLeft(state))}</b> de combat.</div>
        ${towerRule(state) ? `<div class="tower-rule">Règle : <b>${escapeHtml(towerRule(state).name)}</b> — ${escapeHtml(towerRule(state).text)}</div>` : '<div class="muted">Une règle change tous les 10 étages.</div>'}`
      : climbsLeft(state) > 0
        ? `<button class="btn btn-gold enter-btn primary-action" data-action="enter-tower" ${state.dungeon || state.challenge ? 'disabled' : ''}>Monter (${climbsLeft(state)} ascension${climbsLeft(state) > 1 ? 's' : ''} aujourd'hui)</button>
          ${state.dungeon || state.challenge ? '<div class="bad">Termine d\'abord le donjon ou le défi.</div>' : ''}`
        : '<button class="btn enter-btn" disabled>Ascensions du jour faites — reviens demain</button>';
    const head = `<div class="card tower-head">
        <div class="tower-portrait">${animCanvas(`foe:${bossSprite(floor)}`, 124, 80, 1)}</div>
        <div class="grow">
          <div class="tower-stats"><span>${img('icon_trophy')} Record : <b>${state.towerBest ?? 0}</b></span>
            <span>Cette semaine : <b>${towerWeek(state).best}</b></span>
            ${last ? `<span class="muted">Dernière : ${last.floors} étage${last.floors > 1 ? 's' : ''} en ${formatDuration(last.seconds)}${last.collapsed ? ' (effondrée)' : ''}</span>` : ''}</div>
          ${action}
          ${trait ? `<div class="trait-box" style="--trait:${trait.color}"><b>Étage ${floor} — ${escapeHtml(bossName(floor))} · ${escapeHtml(trait.name)}</b> : ${escapeHtml(trait.text)}. <span class="muted">Parade : ${escapeHtml(trait.counter)}</span></div>` : ''}
        </div></div>`;
    // v9.1.3 : les règles ne sont plus répétées ici (doublon de l'aide « ? »).
    return `${head}${fold(ui, 'tower-floors', 'Étages et récompenses', () => `<div class="tower-floors">${floorsList(state, floor)}</div>`)}`;
}

// v10.12 : Défis sur téléphone — modes Tour · Défi de la semaine, étage en grande case, nom, 2 icônes de règles (le détail est
// dans la fiche « ? »), un seul bouton doré (Monter / Lancer le défi).
const TRAIT_ICON = { armored: 'icon_shield', summoner: 'icon_summon', escalate: 'icon_damage', desperate: 'icon_alert' };
const MOD_ICON = { tough: 'icon_heart', fierce: 'icon_damage', swift: 'icon_bolt', swarm: 'icon_skull', noheal: 'icon_regen', glass: 'icon_crit', giants: 'icon_boss', enraged: 'icon_alert' };
const traitIcon = (trait) => TRAIT_ICON[Object.keys(TRAITS).find((k) => TRAITS[k] === trait)] ?? 'icon_boss';
const rule = (ic, label) => `<button type="button" class="cb-rule" data-action="tower-info" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${img(ic)}</button>`;

function phoneView(ui, state, parts, tab, tile = '') {
  const modes = parts.map(([id, l, ic]) => ({ id, label: id === 'challenge' ? 'Défi de la semaine' : l, icon: ic, action: 'defi-tab', value: id }));
  const body = tab === 'challenge' ? phoneChallenge(state) : phoneTower(ui, state);
  const sheet = ui.view.towerInfo ? phoneSheet(state, tab) : '';
  return `<div class="m-frame cb-frame">${mTitle('icon_tower', 'Défis', true)}${modes.length > 1 ? mModes(modes, tab, { size: 64 }) : ''}${tile}${body}${sheet}</div>`;
}

function phoneTower(ui, state) {
  if (!towerUnlocked(state)) return mEmpty(`La Tour de l'Éternité s'ouvre à l'étape ${stageLabel(TOWER.unlockStage)}.`, { icon: 'icon_tower' });
  const run = state.tower;
  const floor = run?.floor ?? (state.towerBest ?? 0) + 1;
  const trait = bossTrait(towerBoss(floor));
  const tr = run ? towerRule(state) : null;
  const rules = [trait ? rule(traitIcon(trait), `${trait.name} : ${trait.short}`) : '', tr ? rule('icon_tower', tr.name) : rule('icon_star', 'Une règle change tous les 10 étages')].join('');
  const head = `<div class="m-card cb-tower"><div class="cb-floor" aria-label="Étage ${floor}">${animCanvas(`foe:${bossSprite(floor)}`, 84, 56, 1)}<b class="cb-floor-n">${floor}</b></div>
      <div class="cb-tower-in"><span class="cb-tower-k">${run ? 'Étage en cours' : 'Prochain étage'}</span><b class="cb-tower-name">${escapeHtml(bossName(floor))}</b>
        <span class="cb-tower-lv">niv. ${formatNumber(towerLevel(state, floor))}</span><span class="cb-rules">${rules}</span></div></div>
    <div class="m-stats2">${mStat('icon_trophy', 'Record', state.towerBest ?? 0)}${mStat('icon_star', 'Semaine', towerWeek(state).best)}</div>`;
  const busy = state.dungeon || state.challenge;
  const action = run
    ? `<div class="m-card cb-run">${mStat('icon_timer', 'Effondrement', formatDuration(towerTimeLeft(state)))}${mBtn('Quitter la tour', { action: 'leave-tower', cls: 'cb-danger' })}</div>`
    : climbsLeft(state) > 0
      ? `${mBtnGold(`Monter (${climbsLeft(state)})`, { action: 'enter-tower', disabled: Boolean(busy), icon: 'icon_tower' })}${busy ? '<div class="cb-warn">Termine d\'abord le donjon ou le défi.</div>' : ''}`
      : mBtn('Ascensions faites : reviens demain', { disabled: true });
  return head + action + mBtn('Étages et récompenses', { action: 'tower-info' });
}

function phoneChallenge(state) {
  const week = challengeWeek(state);
  const setup = weeklySetup(week.week);
  const run = state.challenge;
  const left = challengeTriesLeft(state);
  const mods = setup.mods.map((id) => modifierById(id)).filter(Boolean);
  const head = `<div class="m-card cb-tower"><div class="cb-floor" aria-label="Défi de la semaine"><b class="cb-floor-n">${run ? run.wave : week.best}</b><small>${run ? 'vague' : 'record'}</small></div>
      <div class="cb-tower-in"><span class="cb-tower-k">Règles de la semaine</span><b class="cb-tower-name">${escapeHtml(ZONES[setup.zone].name)}</b>
        <span class="cb-rules">${mods.slice(0, 2).map((m) => rule(MOD_ICON[m.id] ?? 'icon_skull', `${m.name} : ${m.text}`)).join('')}${mods.length > 2 ? `<b class="cb-more">+${mods.length - 2}</b>` : ''}</span></div></div>
    <div class="m-stats2">${mStat('icon_trophy', 'Record', state.challengeBest ?? 0)}${mStat('icon_star', 'Semaine', week.best)}</div>`;
  const action = run
    ? `<div class="m-card cb-run">${mStat('icon_skull', 'Vague en cours', run.wave)}${mBtn('Abandonner', { action: 'leave-challenge', cls: 'cb-danger' })}</div>`
    : left > 0
      ? mBtnGold(`Lancer le défi (${left})`, { action: 'enter-challenge', disabled: Boolean(state.dungeon || state.tower), icon: 'icon_skull' })
      : mBtn('Tentatives épuisées : nouvelles règles lundi', { disabled: true });
  return head + action + mBtn('Règles et historique', { action: 'tower-info' });
}

function phoneSheet(state, tab) {
  const close = { close: 'tower-info', back: 'tower-info' };
  if (tab === 'challenge') {
    const week = challengeWeek(state);
    const mods = weeklySetup(week.week).mods.map((id) => modifierById(id)).filter(Boolean);
    const history = (state.challengeHistory ?? []).slice(0, 5).map((h) => mStat('icon_trophy', h.week.slice(5).replace('-', '/'), h.best)).join('');
    return mSheet('Règles du défi', `<div class="m-card">${mods.map((m) => `<div class="cb-rule-row">${img(MOD_ICON[m.id] ?? 'icon_skull')}<span><b>${escapeHtml(m.name)}</b> ${escapeHtml(m.text)}</span></div>`).join('')}</div>
      <div class="m-card cb-help">Des vagues de ${CHALLENGE.killsPerWave} ennemis toujours plus forts (${CHALLENGE.waveSeconds} s par vague), un boss toutes les ${CHALLENGE.bossEvery} vagues. Une défaite termine la tentative. Récompenses à chaque nouveau meilleur score.</div>
      ${history ? `<div class="m-card">${history}</div>` : ''}`, { id: 'tower-sheet', icon: 'icon_skull', ...close });
  }
  const run = state.tower;
  const floor = run?.floor ?? (state.towerBest ?? 0) + 1;
  const trait = bossTrait(towerBoss(floor));
  const tr = run ? towerRule(state) : null;
  const last = state.towerLast;
  return mSheet('La Tour', `${trait ? `<div class="m-card"><div class="cb-rule-row">${img(traitIcon(trait))}<span><b>${escapeHtml(trait.name)}</b> ${escapeHtml(trait.text)}. Parade : ${escapeHtml(trait.counter)}</span></div></div>` : ''}
    <div class="m-card cb-rule-row">${img('icon_star')}<span>${tr ? `<b>${escapeHtml(tr.name)}</b> ${escapeHtml(tr.text)}` : 'Une règle change tous les 10 étages.'}</span></div>
    ${last ? `<div class="m-card">${mStat('icon_timer', 'Dernière montée', `${last.floors} étage${last.floors > 1 ? 's' : ''} · ${formatDuration(last.seconds)}`)}</div>` : ''}
    <div class="m-card cb-floors"><div class="tower-floors">${floorsList(state, floor)}</div></div>`, { id: 'tower-sheet', icon: 'icon_tower', ...close });
}
