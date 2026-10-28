// Missions (connexion, journalières, hebdomadaires, mensuelles) et contrats d'aventure, en onglets.
import { BOUNTY, bountyProgress, dailyBounty } from '../../core/bounty.js';
import { ENEMIES } from '../../data/enemies.js';
import { ZONES } from '../../data/zones.js';
import { ITEM_SETS } from '../../data/sets.js';
import { animCanvas } from '../animator.js';
import { contractLabel, contractTitle } from '../../core/contracts.js';
import { bonusReady, loginDay, loginReady, missionsClaimable, missionStatus, periodRemaining } from '../../core/missions.js';
import { rewardText } from '../../core/rewards.js';
import { LOGIN_CALENDAR, MISSION_PERIODS } from '../../data/missions.js';
import { escapeHtml, formatNumber, img, progressBar } from '../common.js';
import { ACHIEVEMENT_BONUS, ACHIEVEMENTS, achievementCount, achievementProgress, claimableAchievements } from '../../core/achievements.js';

// Hauts faits (v8.3) : défis permanents, gemmes à réclamer et bonus permanent par haut fait obtenu.
function achievementsTab(state) {
  const n = achievementCount(state);
  const rows = ACHIEVEMENTS.map((a) => {
    const p = achievementProgress(state, a);
    const cls = p.claimed ? ' done' : p.done ? ' ready' : '';
    return `<div class="ach${cls}"><span class="ach-icon">${p.claimed ? '🏆' : p.done ? '✨' : '🔒'}</span>
      <div class="grow"><b>${escapeHtml(a.name)}</b> <span class="muted">${a.label} : ${formatNumber(Math.min(p.value, a.target))} / ${formatNumber(a.target)}</span>
        ${progressBar(p.ratio)}</div>
      ${p.claimed ? '<span class="good">Obtenu</span>'
        : `<button class="btn small${p.done ? ' btn-gold' : ''}" data-action="claim-achievement" data-value="${a.id}" ${p.done ? '' : 'disabled'}>+${a.gems} ${img('icon_gem')}</button>`}</div>`;
  }).join('');
  return `<div class="row-between"><b>${n} / ${ACHIEVEMENTS.length} hauts faits</b>
      <span class="muted">Bonus permanent : +${n * ACHIEVEMENT_BONUS.damagePct} % dégâts · +${n * ACHIEVEMENT_BONUS.goldPct} % or (+1 % chacun par haut fait)</span></div>
    <div class="ach-list">${rows}</div>`;
}

const TYPE_ICONS = {
  login: 'icon_book', kills: 'weapon_sword', bosses: 'icon_boss', recycle: 'icon_anvil', summons: 'icon_summon',
  dungeons: 'icon_dungeon', rareLoot: 'icon_bag', upgrades: 'icon_upgrade', gold: 'coin', stages: 'icon_map', items: 'icon_chest',
};

function remainingText(ms) {
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `${Math.floor(h / 24)} j`;
  if (h >= 1) return `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
  return `${Math.max(1, Math.floor(ms / 60000))} min`;
}

// Ligne de mission : icône, intitulé + barre, récompense, bouton.
function row({ icon, label, progress, target, reward, done, claimed, action, value, sub = '' }) {
  const btn = claimed ? '<span class="m-done">✔</span>'
    : `<button class="btn ${done ? 'btn-gold' : ''} small" data-action="${action}" data-value="${value}" ${done ? '' : 'disabled'}>${done ? 'Récupérer' : 'En cours'}</button>`;
  return `<div class="m-row${claimed ? ' claimed' : ''}">
    <div class="m-icon">${img(icon)}</div>
    <div class="m-main">${sub}<b>${escapeHtml(label)}</b>${progressBar(progress / target, `${formatNumber(progress)} / ${formatNumber(target)}`)}</div>
    <div class="m-reward">${rewardText(reward, formatNumber).replaceAll(' · ', '<br>')}</div>
    <div class="m-btn">${btn}</div>
  </div>`;
}

function loginTab(state) {
  const day = loginDay(state);
  const ready = loginReady(state);
  const cells = LOGIN_CALENDAR.map((r, i) => {
    const st = i < day || (i === day && !ready) ? 'got' : i === day ? 'today' : '';
    return `<div class="login-day ${st}"><b>J${i + 1}</b><span>${rewardText(r, formatNumber).replaceAll(' · ', '<br>')}</span></div>`;
  }).join('');
  return `<div class="muted">Série : ${state.missions.login.streak} jour(s) consécutif(s). Manquer un jour ramène au jour 1.</div>
    <div class="login-cal">${cells}</div>
    <button class="btn ${ready ? 'btn-gold' : ''}" data-action="claim-login" ${ready ? '' : 'disabled'}>${ready ? 'Récupérer' : 'Revenez demain'}</button>`;
}

function periodTab(state, period) {
  const run = state.missions[period.id];
  const rows = period.missions.map((m) => {
    const st = missionStatus(state, period.id, m);
    return row({ icon: TYPE_ICONS[m.type] ?? 'icon_star', label: m.label, progress: st.progress, target: m.target, reward: m.reward,
      done: st.done, claimed: st.claimed, action: 'claim-mission', value: `${period.id}|${m.id}` });
  }).join('');
  const claimedCount = period.missions.filter((m) => missionStatus(state, period.id, m).claimed).length;
  const ready = bonusReady(state, period.id);
  const chest = `<div class="m-row m-chest${run.bonus ? ' claimed' : ''}">
    <div class="m-icon">${img('icon_chest')}</div>
    <div class="m-main"><b>Récompense complète (${claimedCount}/${period.missions.length})</b>${progressBar(claimedCount / period.missions.length, `${claimedCount} / ${period.missions.length}`)}</div>
    <div class="m-reward">${rewardText(period.bonus, formatNumber).replaceAll(' · ', '<br>')}</div>
    <div class="m-btn">${run.bonus ? '<span class="m-done">✔</span>' : `<button class="btn ${ready ? 'btn-gold' : ''} small" data-action="claim-mission-bonus" data-value="${period.id}" ${ready ? '' : 'disabled'}>Ouvrir</button>`}</div>
  </div>`;
  return `<div class="m-reset muted">${period.reset} · dans ${remainingText(periodRemaining(period.id))}</div>${rows}${chest}`;
}

function contractsTab(state) {
  const rows = state.contracts.map((c) => row({
    icon: TYPE_ICONS[c.type] ?? 'icon_trophy', label: contractLabel(c), progress: c.progress, target: c.target, reward: c.reward,
    done: c.progress >= c.target, claimed: false, action: 'claim-contract', value: c.id,
    sub: `<span class="contract-title${c.rare ? ' rare' : ''}">${escapeHtml(contractTitle(c))}</span>`,
  })).join('');
  return `<div class="muted">Les contrats progressent tout seuls pendant le farm, même hors ligne. Un nouveau contrat remplace chaque contrat rempli ;
    parfois un <b class="rare-text">contrat rare</b> apparaît (objectif doublé, récompenses triplées).</div>${rows}`;
}

// Prime du jour (v8.9).
function bountyCard(state) {
  const b = dailyBounty(state);
  const enemy = ENEMIES[b.type];
  const done = bountyProgress(state);
  const set = ITEM_SETS.find((x) => x.id === ZONES[b.zone].id);
  return `<div class="card bounty-card">
    <div class="bounty-portrait">${animCanvas(`foe:${enemy.sprite}`, 48, 40, 1)}</div>
    <div class="grow"><div class="row-between"><b class="gold-text">🎯 Prime du jour : ${escapeHtml(enemy.name)}</b><span class="muted">${escapeHtml(ZONES[b.zone].name)}</span></div>
      ${progressBar(done / b.target, `${done}/${b.target} vaincus`)}
      <div class="muted">Récompense : une pièce Épique ou mieux de l'ensemble <b style="color:${set?.color ?? '#fff'}">${escapeHtml(set?.name ?? '')}</b> et ${BOUNTY.gems} gemmes. Nouvelle prime chaque jour.</div></div>
    ${b.claimed ? '<button class="btn" disabled>Récupérée ✔</button>'
      : `<button class="btn ${done >= b.target ? 'btn-gold' : ''}" data-action="claim-bounty" ${done >= b.target ? '' : 'disabled'}>Récupérer</button>`}
  </div>`;
}

export default {
  id: 'contracts',
  title: 'Missions & contrats',
  icon: 'icon_trophy',
  extra: (ui, state) => `${state.records.contractsDone} contrats remplis`,
  render(ui, state) {
    // Nombre de récompenses prêtes par onglet (pastilles).
    const ready = {
      login: loginReady(state) ? 1 : 0,
      contracts: state.contracts.filter((c) => c.progress >= c.target).length,
      achievements: claimableAchievements(state).length,
    };
    for (const p of MISSION_PERIODS) {
      ready[p.id] = p.missions.filter((m) => { const st = missionStatus(state, p.id, m); return st.done && !st.claimed; }).length + (bonusReady(state, p.id) ? 1 : 0);
    }
    const tabs = [['daily', 'Journalières', 'icon_book'], ['weekly', 'Hebdomadaires', 'icon_map'], ['monthly', 'Mensuelles', 'icon_trophy'],
      ['login', 'Connexion', 'icon_gem'], ['contracts', 'Contrats', 'icon_chest'], ['achievements', 'Hauts faits', 'icon_star']];
    const tab = tabs.some(([id]) => id === ui.view.missionTab) ? ui.view.missionTab : 'daily';
    const head = tabs.map(([id, label, icon]) => `<button class="btn m-tab${id === tab ? ' active' : ''}" data-action="mission-tab" data-value="${id}">
      ${img(icon)}<span>${label}</span>${ready[id] ? `<i class="fold-ready">${ready[id]}</i>` : ''}</button>`).join('');
    const period = MISSION_PERIODS.find((p) => p.id === tab);
    const body = tab === 'login' ? loginTab(state) : tab === 'contracts' ? contractsTab(state)
      : tab === 'achievements' ? achievementsTab(state) : periodTab(state, period);
    const any = missionsClaimable(state) || ready.contracts > 0 || ready.achievements > 0;
    return `${bountyCard(state)}<div class="m-tabs">${head}<button class="btn ${any ? 'btn-gold' : ''} claim-all" data-action="claim-all" ${any ? '' : 'disabled'}>Tout récupérer</button></div>
      <div class="card m-body">${body}</div>`;
  },
};
