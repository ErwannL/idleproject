// Objectifs › Missions : connexion, journalières, piste du mois (v9.1.3), contrats, prime du jour, hauts faits.
import { sessionGoalsHtml } from '../session-goals.js'; // v9.6.5
import { BOUNTY, bountyProgress, bountyZones, dailyBounty } from '../../core/bounty.js';
import { ENEMIES } from '../../data/enemies.js';
import { ZONES } from '../../data/zones.js';
import { ITEM_SETS } from '../../data/sets.js';
import { animCanvas } from '../animator.js';
import { contractLabel, contractTitle } from '../../core/contracts.js';
import { bonusReady, loginPending, missionStatus, openMissions, periodRemaining, trackNext, trackPct } from '../../core/missions.js';
import { rewardText } from '../../core/rewards.js';
import { CHRONICLES, HERALD_TASKS, chronicleNow, heraldState, heraldTask } from '../../core/chronicles.js';
import { LOGIN_CALENDAR, MISSION_PERIODS, MISSION_TRACK } from '../../data/missions.js';
import { claimPeekList, merchantsHtml } from './inbox.js';
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
    return `<div class="ach${cls}"><span class="ach-icon">${g.ready || g.allDone ? img('icon_trophy', 'ico20', g.allDone ? 'Obtenu' : 'À réclamer') : img('icon_lock', 'ico-lock', 'Verrouillé')}</span>
      <div class="grow"><b>${escapeHtml(a.name)}</b> <span class="muted">${a.label} · palier ${g.allDone ? `${g.tiers.length}/${g.tiers.length}` : Math.min(g.claimedCount + 1, g.tiers.length)}</span>
        ${progressBar(p.ratio, `${formatNumber(Math.min(p.value, a.target))} / ${formatNumber(a.target)}`)}</div>
      ${g.allDone ? '<span class="good">Obtenu</span>'
        : `<button class="btn small${g.ready ? ' btn-gold' : ''}" data-action="claim-achievement" data-value="${a.id}" ${g.ready ? '' : 'disabled'}>${g.ready ? 'Récupérer ' : ''}+${a.gems} ${img('icon_gem', '', 'gemmes')}</button>`}</div>`;
  }).join('');
  // v9.8 (G5) : vitrine de trophées — silhouettes sombres qui deviennent dorées une fois débloquées, nom en dessous.
  const shelf = achievementGroups(state).map((g) => `<button class="trophy${g.allDone ? ' gold' : g.claimedCount ? ' bronze' : ''}${g.ready ? ' ready' : ''}" ${g.ready ? `data-action="claim-achievement" data-value="${g.tier.id}"` : 'tabindex="-1"'} title="${escapeHtml(g.tier.name)}">
      ${img('icon_trophy')}<small>${escapeHtml(g.tier.name)}</small></button>`).join('');
  return `<div class="trophy-shelf">${shelf}</div><div class="muted">${n} / ${ACHIEVEMENTS.length} paliers · bonus permanent +${n * ACHIEVEMENT_BONUS.damagePct} % dégâts et +${n * ACHIEVEMENT_BONUS.goldPct} % or (+1 % chacun par palier)</div>
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
  // v9.2.5 : ligne récupérable mise en évidence (liseré doré).
  return `<div class="m-row${claimed ? ' claimed' : done ? ' ready' : ''}">
    <div class="m-icon">${img(icon)}</div>
    <div class="m-main">${sub}<div class="m-label"><b>${escapeHtml(label)}</b>${rewardIcons(reward)}</div>${progressBar(progress / target, `${formatNumber(progress)} / ${formatNumber(target)}`)}</div>
    <div class="m-btn">${btn}</div>
  </div>`;
}

export function loginTab(state) { // v9.3.8 : aussi dans la fenêtre du jour (à l'ouverture)
  const login = state.missions.login;
  const pending = loginPending(state);
  const n = LOGIN_CALENDAR.length;
  // v9.1.3 : cases déjà récupérées dans le cycle en cours (le cycle complet reste affiché jusqu'au jour suivant).
  const got = pending ? login.claimed % n : login.claimed > 0 ? ((login.claimed - 1) % n) + 1 : 0;
  const cells = LOGIN_CALENDAR.map((r, i) => {
    const st = i < got ? 'got' : i < got + pending ? 'today' : '';
    return `<div class="login-day ${st}${i === n - 1 ? ' jackpot' : ''}"><b>J${i + 1}</b>${rewardIcons(r, 'rw-col')}</div>`;
  }).join('');
  return `<div class="muted">Jours de connexion : ${login.days}. Un jour manqué ne remet pas le calendrier à zéro.</div>
    <div class="login-cal">${cells}</div>
    <button class="btn ${pending ? 'btn-gold' : ''}" data-action="claim-login" ${pending ? '' : 'disabled'}>${pending > 1 ? `Récupérer ${pending} jours` : pending ? 'Récupérer' : 'Reviens demain'}</button>`;
}

function periodTab(state, period) {
  const run = state.missions[period.id];
  const shown = openMissions(state, period); // v9.3.5 : pas de mission pour une fonction verrouillée
  // v9.3.8 (2.6) : prêtes d'abord, puis en cours, les terminées en bas (grisées).
  const order = (m) => { const st = missionStatus(state, period.id, m); return st.claimed ? 2 : st.done ? 0 : 1; };
  const rows = [...shown].sort((a, b) => order(a) - order(b)).map((m) => {
    const st = missionStatus(state, period.id, m);
    return row({ icon: TYPE_ICONS[m.type] ?? 'icon_star', label: m.label, progress: st.progress, target: m.target, reward: m.reward,
      done: st.done, claimed: st.claimed, action: 'claim-mission', value: `${period.id}|${m.id}` });
  }).join('');
  const claimedCount = shown.filter((m) => missionStatus(state, period.id, m).claimed).length;
  const ready = bonusReady(state, period.id);
  const chest = `<div class="m-row m-chest${run.bonus ? ' claimed' : ''}">
    <div class="m-icon">${img('icon_chest')}</div>
    <div class="m-main"><div class="m-label"><b>Récompense complète</b>${rewardIcons(period.bonus)}</div>${progressBar(claimedCount / Math.max(1, shown.length), `${claimedCount} / ${shown.length}`)}</div>
    <div class="m-btn">${run.bonus ? '<span class="m-done">✔</span>' : `<button class="btn ${ready ? 'btn-gold' : ''} small" data-action="claim-mission-bonus" data-value="${period.id}" ${ready ? '' : 'disabled'}>Ouvrir</button>`}</div>
  </div>`;
  // Grande barre en haut, coffre au bout (il s'ouvre avec une animation quand il est prêt).
  const pct = Math.round((claimedCount / Math.max(1, shown.length)) * 100);
  const big = `<div class="q-big${ready ? ' ready' : ''}${run.bonus ? ' opened' : ''}"><div class="q-bar"><i style="width:${pct}%"></i><span>${claimedCount} / ${shown.length}</span></div>
    <button class="q-chest" data-action="claim-mission-bonus" data-value="${period.id}" ${ready ? '' : 'disabled'} aria-label="Ouvrir le grand coffre">${img('icon_chest')}</button></div>`;
  // v9.8 (G4) : la semaine en chemin pixel art — une borne par mission, le héros miniature avance d'une borne par palier.
  const path = period.id !== 'weekly' ? '' : `<div class="wk-path" aria-label="${claimedCount} sur ${shown.length}">
      ${shown.map((_, i) => `<span class="wk-stone${i < claimedCount ? ' on' : ''}" style="left:${((i + 1) / (shown.length + 1)) * 100}%"></span>`).join('')}
      <span class="wk-hero" style="left:${(claimedCount / (shown.length + 1)) * 100}%">${img('menu_hero')}</span>
      <span class="wk-end">${img('icon_chest')}</span></div>`;
  return `<div class="m-reset muted">${period.reset} · dans ${remainingText(periodRemaining(period.id))}</div>${path || big}${rows}${chest}`;
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

// v9.2.5 : trouvailles du combat (coffres, objets) : elles comptaient dans « Tout récupérer » sans être visibles ici.
function findsCard(ui) {
  const list = ui.claims.filter((c) => c.kind === 'event');
  if (!list.length) return '';
  return `<div class="card m-body"><div class="section-title">Trouvailles <span class="pill-n">${list.length}</span></div>${list.map((c) => `<div class="m-row${c.blocked ? '' : ' ready'}">
    <div class="m-icon">${img('icon_chest')}</div><div class="m-main"><div class="m-label"><b>${escapeHtml(c.label)}</b>${rewardIcons(c.reward)}${c.item ? ' <span class="muted">+ un objet</span>' : ''}</div>
    ${c.blocked ? `<span class="bad">${c.blocked}</span>` : ''}</div>
    <div class="m-btn"><button class="btn btn-gold small" data-action="claim-event" data-value="${c.id}" ${c.blocked ? 'disabled' : ''}>Récupérer</button></div></div>`).join('')}</div>`;
}

// Prime du jour (v8.9).
// v9.11 (7) : Chroniques d'Ascendrya — une carte illustrée par étape, récompense nommée tous les 5 paliers.
export function chronicleCard(state, compact = false) {
  const c = chronicleNow(state);
  if (!c) return '<div class="card chron-card done"><b>Chroniques d\'Ascendrya</b><p>Toutes les chroniques sont écrites. Ton nom est une légende.</p></div>';
  const nextPrize = CHRONICLES.slice(c.index).find((x) => x.prize);
  return `<div class="card chron-card${c.ready ? ' ready' : ''}${compact ? ' compact' : ''}">
    <div class="chron-art"><img class="px" src="assets/ui/art98/${c.art}.png" alt=""><span class="chron-n">Chapitre ${c.index + 1}/${CHRONICLES.length}</span></div>
    <div class="chron-body"><small class="muted">Chroniques d'Ascendrya</small><b class="chron-title">${escapeHtml(c.title)}</b>
      ${compact ? '' : `<p class="chron-text">${escapeHtml(c.text)}</p>`}
      <div class="chron-need">${c.ready ? '✔' : '○'} ${escapeHtml(c.need)}</div>
      <div class="chron-reward">${rewardIcons(c.reward, compact ? '' : 'named')}${c.prize ? `<span class="chron-prize">🎁 ${escapeHtml(c.prize.label)}</span>` : ''}</div>
      ${!c.prize && nextPrize && !compact ? `<small class="muted">Prochain grand prix (chapitre ${CHRONICLES.indexOf(nextPrize) + 1}) : ${escapeHtml(nextPrize.prize.label)}</small>` : ''}
      <button class="btn ${c.ready ? 'btn-gold' : ''}" data-action="chronicle-claim" ${c.ready ? '' : 'disabled'}>Récupérer</button></div></div>`;
}

// v9.11 (7) : Tâches du Héraut — elles se relancent dès qu'on les récupère.
function heraldTab(state) {
  const h = heraldState(state);
  const rows = HERALD_TASKS.map((t0) => {
    const t = heraldTask(state, t0);
    const p = Math.min(t.target, h.progress[t.id] ?? 0);
    return row({ icon: t.icon, label: t.text, progress: p, target: t.target, reward: t.reward, done: p >= t.target, claimed: false, action: 'herald-claim', value: t.id });
  }).join('');
  return `<div class="muted">Le Héraut d'Ascendrya affiche ses tâches chaque matin… et les renouvelle aussitôt faites. ${h.done ? `<b>${h.done}</b> accomplies.` : ''}</div>${rows}`;
}

export function bountyCard(state) { // v9.3.8 : affichée sur la Carte (ce n'est pas une quête)
  const b = dailyBounty(state);
  const enemy = ENEMIES[b.type];
  const done = bountyProgress(state);
  const set = ITEM_SETS.find((x) => x.id === ZONES[b.zone].id);
  // Étape du monde de la prime (premier passage) : on peut y aller si elle est atteinte.
  const stage = zoneStartStage(b.zone) + 1;
  const reachable = stage <= state.maxStage && !state.dungeon && !state.tower && !state.challenge;
  // v9.1.3 (doc3 lot 3) : monde choisi (mondes atteints selon le record), tant que la prime n'est pas récupérée.
  const zones = bountyZones(state);
  const zonePick = !b.claimed && zones.length > 1
    ? `<select data-action="bounty-zone" aria-label="Monde de la prime">${zones.map((z) => `<option value="${z}"${z === b.zone ? ' selected' : ''}>${escapeHtml(ZONES[z].name)}</option>`).join('')}</select>`
    : `<span class="muted">${escapeHtml(ZONES[b.zone].name)}</span>`;
  return `<div class="card bounty-card${!b.claimed && done >= b.target ? ' ready' : ''}">
    <div class="bounty-portrait">${animCanvas(`foe:${enemy.sprite}`, 48, 40, 1)}</div>
    <div class="grow"><div class="row-between"><b class="gold-text">Prime du jour : ${escapeHtml(enemy.name)}</b>${zonePick}</div>
      ${progressBar(done / b.target, `${done}/${b.target} vaincus`)}
      <div class="muted">Récompense : une pièce Épique ou mieux de l'ensemble <b style="color:${set?.color ?? '#fff'}">${escapeHtml(set?.name ?? '')}</b> et ${BOUNTY.gems} gemmes. Nouvelle prime chaque jour.</div></div>
    ${b.claimed ? '<button class="btn" disabled>Récupérée ✔</button>'
      : done >= b.target ? '<button class="btn btn-gold" data-action="claim-bounty">Récupérer</button>'
        : reachable ? `<button class="btn small" data-action="bounty-go" data-value="${stage}">Aller sur l'étape</button>`
          : `<button class="btn small" disabled>Aller sur l'étape</button><span class="muted">Atteins l'étape ${stageLabel(stage)}</span>`}
  </div>`;
}

// v9.1.0 : trois parties — Aujourd'hui (journalières, connexion, prime, contrats), Piste du mois (v9.1.3 : hebdomadaires et
// mensuelles fondues), Hauts faits. « Tout récupérer » est dans l'en-tête du panneau (toujours visible).
export default {
  id: 'contracts',
  title: 'Missions',
  icon: 'icon_trophy',
  extra: (ui) => {
    const list = ui.claims.filter((c) => c.tab === 'contracts');
    const n = list.filter((c) => !c.blocked).length;
    // v9.1.3 : « À récupérer » fondu dans Missions — la vue d'ensemble s'ouvre en fenêtre (touche N).
    // v9.2.5 : au survol (PC) la liste de ce qui sera récupéré, avec sa section ; ▾ l'ouvre dans le panneau (téléphone).
    // v9.2.5 : libellé complet partout ; icône + nombre seulement quand la place manque (fit.css).
    const open = Boolean(ui.view.claimPeek);
    return `${n ? `<span class="claim-peek"><button class="btn btn-gold small" data-action="claim-everything" aria-label="Tout récupérer (${n})"><span class="lbl-ico" aria-hidden="true">${img('icon_chest')}</span><span class="lbl-txt">Tout<span class="lbl-long"> récupérer</span></span> (${n})</button><button class="btn small peek-toggle${open ? ' active' : ''}" data-action="claim-peek" aria-expanded="${open}" aria-label="Voir ce qui sera récupéré">${open ? '▴' : '▾'}</button>
      <span class="peek-pop" role="tooltip"><b>Sera récupéré :</b>${claimPeekList(list)}</span></span>` : ''}<button class="btn small" data-action="open-claims" title="Tout ce qui est prêt, au même endroit (touche N)" aria-label="À récupérer">${img('icon_mail')}</button>`;
  },
  render(ui, state) {
    const count = (ids) => ui.claims.filter((c) => c.tab === 'contracts' && ids.includes(c.period ?? c.kind)).length;
    // v9.3.8 (2.6) : Jour · Semaine · Mois · Hauts faits, chacun avec sa pastille.
    const parts = [['today', 'Jour', 'icon_book'], ['chronicles', 'Chroniques', 'icon_scroll'], ['weekly', 'Semaine', 'icon_chest'], ['week', 'Mois', 'icon_map'], ['achievements', 'Hauts faits', 'icon_star']];
    const heraldN = HERALD_TASKS.filter((t) => (heraldState(state).progress[t.id] ?? 0) >= heraldTask(state, t).target).length + (chronicleNow(state)?.ready ? 1 : 0);
    const ready = { chronicles: heraldN, today: count(['daily', 'login', 'contract', 'event']), weekly: count(['weekly']), week: count(['track']), achievements: count(['achievement']) };
    const tab = parts.some(([id]) => id === ui.view.missionTab) ? ui.view.missionTab : 'today';
    const seg = segment(parts.map(([id, label, icon]) => [id, ready[id] ? `${label}<i class="pill-n" aria-label="${ready[id]} à récupérer">${ready[id]}</i>` : label, icon]), 'mission-tab', tab);
    const period = (id) => MISSION_PERIODS.find((p) => p.id === id);
    const merchants = merchantsHtml(state);
    // v9.2.5 : liste dépliée par ▾ (en haut du panneau, tient sur téléphone).
    const peekList = ui.claims.filter((c) => c.tab === 'contracts');
    const peek = ui.view.claimPeek && peekList.length ? `<div class="card peek-card"><div class="row-between"><b>Sera récupéré (${peekList.filter((c) => !c.blocked).length})</b>
      <button class="btn btn-gold small" data-action="claim-everything">Tout récupérer</button></div>${claimPeekList(peekList)}</div>` : '';
    const sec = (title, n) => `${title}${n ? ` <i class="pill-n">${n}</i>` : ''}`;
    const nOf = (k) => ui.claims.filter((c) => c.tab === 'contracts' && (c.period ?? c.kind) === k && !c.blocked).length;
    let body;
    if (tab === 'chronicles') body = `${chronicleCard(state)}<div class="card m-body"><div class="section-title">Tâches du Héraut</div>${heraldTab(state)}</div>`;
    else if (tab === 'achievements') body = `<div class="card m-body">${achievementsTab(state)}</div>`;
    else if (tab === 'weekly') body = `<div class="card m-body">${periodTab(state, period('weekly'))}</div>`;
    else if (tab === 'week') {
      body = `<div class="card m-body">${trackTab(state)}</div>`;
    } else {
      // v9.11 (7) : objectifs de session en haut des Missions (ils étaient cachés en bas du Carnet).
      body = `<div class="card m-body m-session">${sessionGoalsHtml(state)}</div><div class="card m-body"><div class="section-title">${sec(period('daily').label, nOf('daily'))}</div>${periodTab(state, period('daily'))}</div>
        <button class="btn btn-gold wheel-link" data-action="wheel-open">🎡 Roue du jour</button>
        ${findsCard(ui)}
        <div class="card m-body"><div class="section-title">${sec('Contrats', nOf('contract'))}</div>${contractsTab(state)}</div>`;
    }
    return seg + peek + body;
  },
};
