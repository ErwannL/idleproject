// Objectifs › Missions : connexion, journalières, piste du mois (v9.1.3), contrats, prime du jour, hauts faits.
import { BOUNTY, bountyProgress, dailyBounty } from '../../core/bounty.js';
import { ENEMIES } from '../../data/enemies.js';
import { ZONES } from '../../data/zones.js';
import { ITEM_SETS } from '../../data/sets.js';
import { animCanvas } from '../animator.js';
import { contractLabel, contractTitle } from '../../core/contracts.js';
import { bonusReady, loginPending, missionStatus, periodRemaining, trackNext, trackPct } from '../../core/missions.js';
import { rewardText } from '../../core/rewards.js';
import { LOGIN_CALENDAR, MISSION_PERIODS, MISSION_TRACK } from '../../data/missions.js';
import { escapeHtml, fold, formatNumber, img, progressBar, rewardIcons, segment } from '../common.js';
import { stageLabel, zoneStartStage } from '../../core/combat.js';
import { ACHIEVEMENT_BONUS, ACHIEVEMENTS, achievementCount, achievementGroups } from '../../core/achievements.js';

// Hauts faits (v8.3) : défis permanents, gemmes à réclamer et bonus permanent par haut fait obtenu.
function achievementsTab(state) {
  const n = achievementCount(state);
  // v9.1.3 (A8) : une ligne par métrique, nom du palier courant, le bouton récupère le palier prêt le plus bas.
  const rows = achievementGroups(state).map((g) => {
    const a = g.tier;
    const p = g.progress;
    const cls = g.allDone ? ' done' : g.ready ? ' ready' : '';
    const step = `${Math.min(g.claimedCount + 1, g.tiers.length)}/${g.tiers.length}`;
    return `<div class="ach${cls}"><span class="ach-icon">${g.ready || g.allDone ? img('icon_trophy', 'ico20', g.allDone ? 'Obtenu' : 'À réclamer') : img('icon_lock', 'ico-lock', 'Verrouillé')}</span>
      <div class="grow"><b>${escapeHtml(a.name)}</b> <span class="muted">${a.label} · palier ${g.allDone ? `${g.tiers.length}/${g.tiers.length}` : step}</span>
        ${progressBar(p.ratio, `${formatNumber(Math.min(p.value, a.target))} / ${formatNumber(a.target)}`)}</div>
      ${g.allDone ? '<span class="good">Obtenu</span>'
        : `<button class="btn small${g.ready ? ' btn-gold' : ''}" data-action="claim-achievement" data-value="${a.id}" ${g.ready ? '' : 'disabled'}>+${a.gems} ${img('icon_gem', '', 'gemmes')}</button>`}</div>`;
  }).join('');
  return `<div class="muted">${n} / ${ACHIEVEMENTS.length} paliers · bonus permanent +${n * ACHIEVEMENT_BONUS.damagePct} % dégâts et +${n * ACHIEVEMENT_BONUS.goldPct} % or (+1 % chacun par palier)</div>
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
  // v9.1.3 (A7) : un seul emplacement pour la récompense, en icônes sur la ligne du libellé ; bouton court.
  const btn = claimed ? '<span class="m-done">✔</span>'
    : `<button class="btn ${done ? 'btn-gold' : ''} small" data-action="${action}" data-value="${value}" ${done ? '' : 'disabled'} aria-label="Récupérer : ${rewardText(reward, formatNumber)}">Récupérer</button>`;
  return `<div class="m-row${claimed ? ' claimed' : ''}">
    <div class="m-icon">${img(icon)}</div>
    <div class="m-main">${sub}<div class="m-label"><b>${escapeHtml(label)}</b>${rewardIcons(reward)}</div>${progressBar(progress / target, `${formatNumber(progress)} / ${formatNumber(target)}`)}</div>
    <div class="m-btn">${btn}</div>
  </div>`;
}

function loginTab(state) {
  const login = state.missions.login;
  const pending = loginPending(state);
  const n = LOGIN_CALENDAR.length;
  // v9.1.3 : cases déjà récupérées dans le cycle en cours (le cycle complet reste affiché jusqu'au jour suivant).
  const got = pending ? login.claimed % n : login.claimed > 0 ? ((login.claimed - 1) % n) + 1 : 0;
  const cells = LOGIN_CALENDAR.map((r, i) => {
    const st = i < got ? 'got' : i < got + pending ? 'today' : '';
    return `<div class="login-day ${st}"><b>J${i + 1}</b>${rewardIcons(r, 'rw-col')}</div>`;
  }).join('');
  return `<div class="muted">Jours de connexion : ${login.days}. Un jour manqué ne remet pas le calendrier à zéro.</div>
    <div class="login-cal">${cells}</div>
    <button class="btn ${pending ? 'btn-gold' : ''}" data-action="claim-login" ${pending ? '' : 'disabled'}>${pending > 1 ? `Récupérer ${pending} jours` : pending ? 'Récupérer' : 'Revenez demain'}</button>`;
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
    <div class="m-main"><div class="m-label"><b>Récompense complète</b>${rewardIcons(period.bonus)}</div>${progressBar(claimedCount / period.missions.length, `${claimedCount} / ${period.missions.length}`)}</div>
    <div class="m-btn">${run.bonus ? '<span class="m-done">✔</span>' : `<button class="btn ${ready ? 'btn-gold' : ''} small" data-action="claim-mission-bonus" data-value="${period.id}" ${ready ? '' : 'disabled'}>Ouvrir</button>`}</div>
  </div>`;
  return `<div class="m-reset muted">${period.reset} · dans ${remainingText(periodRemaining(period.id))}</div>${rows}${chest}`;
}

// v9.1.3 (lot F) : piste du mois — hebdomadaires et mensuelles fondues. Une barre à 10 paliers, puis les objectifs.
function trackTab(state) {
  const pct = trackPct(state);
  const next = trackNext(state);
  const claimed = state.missions.track.claimed;
  const steps = MISSION_TRACK.tiers.map((t, i) => {
    const got = i < claimed;
    const ready = !got && pct >= t.pct - 1e-9;
    return `<div class="m-step${got ? ' got' : ready ? ' ready' : ''}" style="left:${t.pct}%" title="${t.pct} % : ${escapeHtml(rewardText(t.reward, formatNumber))}">
      <span>${got ? '✔' : img('icon_chest')}</span><small>${t.pct}</small></div>`;
  }).join('');
  const head = next ? (next.ready
    ? `<button class="btn btn-gold small" data-action="claim-track" aria-label="Récupérer : ${escapeHtml(rewardText(next.reward, formatNumber))}">Récupérer ${rewardIcons(next.reward)}</button>`
    : `<span class="muted">Palier ${next.pct} % : ${rewardIcons(next.reward)}</span>`) : '<span class="good">Piste terminée ✔</span>';
  const p = state.missions.track.progress;
  const rows = MISSION_TRACK.goals.map((g) => `<div class="m-row${(p[g.id] ?? 0) >= g.target ? ' claimed' : ''}"><div class="m-icon">${img(TYPE_ICONS[g.type] ?? 'icon_star')}</div>
    <div class="m-main"><div class="m-label"><b>${escapeHtml(g.label)}</b></div>${progressBar(Math.min(1, (p[g.id] ?? 0) / g.target), `${formatNumber(p[g.id] ?? 0)} / ${formatNumber(g.target)}`)}</div></div>`).join('');
  return `<div class="row-between"><b>${MISSION_TRACK.label} : ${Math.floor(pct)} %</b>${head}</div>
    <div class="m-track enc-track"><div class="m-fill" style="width:${Math.min(100, pct)}%"></div>${steps}</div>
    <div class="m-reset muted">${MISSION_TRACK.reset} · dans ${remainingText(periodRemaining('monthly'))} · chaque objectif compte pour 1/${MISSION_TRACK.goals.length}</div>${rows}`;
}

function contractsTab(state) {
  const rows = state.contracts.map((c) => row({
    icon: TYPE_ICONS[c.type] ?? 'icon_trophy', label: contractLabel(c), progress: c.progress, target: c.target, reward: c.reward,
    done: c.progress >= c.target, claimed: false, action: 'claim-contract', value: c.id,
    sub: `<span class="contract-title${c.rare ? ' rare' : ''}">${escapeHtml(contractTitle(c))}</span>`,
  })).join('');
  // v9.1.3 : l'explication (déjà dans l'aide « ? ») n'est plus répétée ici.
  return rows;
}

// Prime du jour (v8.9).
function bountyCard(state) {
  const b = dailyBounty(state);
  const enemy = ENEMIES[b.type];
  const done = bountyProgress(state);
  const set = ITEM_SETS.find((x) => x.id === ZONES[b.zone].id);
  // Étape du monde de la prime (premier passage) : on peut y aller si elle est atteinte.
  const stage = zoneStartStage(b.zone) + 1;
  const reachable = stage <= state.maxStage && !state.dungeon && !state.tower && !state.challenge;
  return `<div class="card bounty-card">
    <div class="bounty-portrait">${animCanvas(`foe:${enemy.sprite}`, 48, 40, 1)}</div>
    <div class="grow"><div class="row-between"><b class="gold-text">🎯 Prime du jour : ${escapeHtml(enemy.name)}</b><span class="muted">${escapeHtml(ZONES[b.zone].name)}</span></div>
      ${progressBar(done / b.target, `${done}/${b.target} vaincus`)}
      <div class="muted">Récompense : une pièce Épique ou mieux de l'ensemble <b style="color:${set?.color ?? '#fff'}">${escapeHtml(set?.name ?? '')}</b> et ${BOUNTY.gems} gemmes. Nouvelle prime chaque jour.</div></div>
    ${b.claimed ? '<button class="btn" disabled>Récupérée ✔</button>'
      : done >= b.target ? '<button class="btn btn-gold" data-action="claim-bounty">Récupérer</button>'
        : reachable ? `<button class="btn small" data-action="bounty-go" data-value="${stage}">Aller sur l'étape</button>`
          : `<button class="btn small" disabled>Aller sur l'étape</button><span class="muted">Atteignez l'étape ${stageLabel(stage)}</span>`}
  </div>`;
}

// v9.1.0 : trois parties — Aujourd'hui (journalières, connexion, prime, contrats), Piste du mois (v9.1.3 : hebdomadaires et
// mensuelles fondues), Hauts faits. « Tout récupérer » est dans l'en-tête du panneau (toujours visible).
export default {
  id: 'contracts',
  title: 'Missions',
  icon: 'icon_trophy',
  extra: (ui) => {
    const n = ui.claims.filter((c) => !c.blocked && c.tab === 'contracts').length;
    return n ? `<button class="btn btn-gold small" data-action="claim-everything">Tout récupérer (${n})</button>` : '';
  },
  render(ui, state) {
    const count = (ids) => ui.claims.filter((c) => c.tab === 'contracts' && ids.includes(c.period ?? c.kind)).length;
    const parts = [['today', 'Aujourd\'hui', 'icon_book'], ['week', 'Piste du mois', 'icon_map'], ['achievements', 'Hauts faits', 'icon_star']];
    const ready = { today: count(['daily', 'login', 'contract', 'bounty']), week: count(['track']), achievements: count(['achievement']) };
    const tab = parts.some(([id]) => id === ui.view.missionTab) ? ui.view.missionTab : 'today';
    const seg = segment(parts.map(([id, label, icon]) => [id, ready[id] ? `${label} (${ready[id]})` : label, icon]), 'mission-tab', tab);
    const period = (id) => MISSION_PERIODS.find((p) => p.id === id);
    let body;
    if (tab === 'achievements') body = `<div class="card m-body">${achievementsTab(state)}</div>`;
    else if (tab === 'week') {
      body = `<div class="card m-body">${trackTab(state)}</div>`;
    } else {
      body = `<div class="card m-body"><div class="section-title">${period('daily').label}</div>${periodTab(state, period('daily'))}</div>
        ${fold(ui, 'login', 'Connexion', () => loginTab(state), { open: (loginPending(state) > 0), extra: (loginPending(state) > 0) ? '<span class="good">à récupérer</span>' : '' })}
        ${bountyCard(state)}
        <div class="card m-body"><div class="section-title">Contrats</div>${contractsTab(state)}</div>`;
    }
    return seg + body;
  },
};
