// À récupérer (v9.1.0) : une seule liste de tout ce qui est réclamable maintenant. Elle sert au bouton « Prochaine
// action », aux pastilles rouges, à l'écran Objectifs > À récupérer et à la touche G — rien n'apparaît deux fois.
// Seulement des récompenses : ni messages non lus, ni marchands (un achat reste une décision).
import { missionOpen } from './missions.js';
import { BALANCE } from '../data/balance.js';
import { MISSION_PERIODS } from '../data/missions.js';
import { BOSSES } from '../data/enemies.js';
import { bonusReady, loginDay, loginPending, loginPendingReward, loginReady, missionStatus, trackNext } from './missions.js';
import { claimableAchievements } from './achievements.js';
import { BOUNTY, bountyReady } from './bounty.js';
import { expeditionDone } from './expeditions.js';
import { SECTIONS_WITH_MILESTONES, encyclopediaNext, sectionStatus } from './encyclopedia.js';
import { nextMasteryTier } from './powers.js';
import { companionById } from './companions.js';
import { eventLabel, hasRoom } from './events.js';
import { currentEvent, eventGoals, eventRecord } from './ancients.js';

// Chaque entrée : { key, kind, label, reward, tab, item } ; item = la récompense contient un objet (sac plein → bloquée).
export function claimables(state, now = Date.now(), balance = BALANCE) {
  const out = [];
  const full = !hasRoom(state, balance); // v9.1.3 (doc3 lot 1) : sac plein → coffre ; bloqué si les deux sont pleins
  const push = (entry) => out.push({ item: false, reward: {}, ...entry, blocked: entry.item && full ? 'Sac et coffre pleins' : null });
  if (state.missions) {
    if (loginReady(state)) push({ key: 'login', kind: 'login', label: loginPending(state) > 1 ? `Connexion : ${loginPending(state)} jours` : `Connexion : jour ${loginDay(state) + 1}`, reward: loginPendingReward(state), tab: 'contracts' });
    const tn = trackNext(state); // v9.1.3 : piste du mois
    if (tn?.ready) push({ key: 'track', kind: 'track', period: 'track', label: `Piste du mois : palier ${tn.pct} %`, reward: tn.reward, tab: 'contracts' });
    for (const p of MISSION_PERIODS) {
      for (const m of p.missions.filter((x) => missionOpen(state, x))) { // v9.3.5
        const st = missionStatus(state, p.id, m);
        if (st.done && !st.claimed) push({ key: `mission:${p.id}:${m.id}`, kind: 'mission', period: p.id, id: m.id, label: `${p.label} : ${m.label}`, reward: m.reward, tab: 'contracts' });
      }
      if (bonusReady(state, p.id)) push({ key: `bonus:${p.id}`, kind: 'missionBonus', period: p.id, label: `${p.label} : coffre bonus`, reward: p.bonus, tab: 'contracts' });
    }
  }
  for (const c of state.contracts ?? []) {
    if (c.progress >= c.target) push({ key: `contract:${c.id}`, kind: 'contract', id: c.id, label: 'Contrat rempli', reward: c.reward, tab: 'contracts' });
  }
  for (const a of claimableAchievements(state)) push({ key: `achievement:${a.id}`, kind: 'achievement', id: a.id, label: `Haut fait : ${a.name}`, reward: { gems: a.gems }, tab: 'contracts' });
  if (bountyReady(state, now)) push({ key: 'bounty', kind: 'bounty', label: 'Prime du jour', reward: { gems: BOUNTY.gems }, item: true, tab: 'campaign' }); // v9.3.8 : la Prime est sur la Carte
  for (const e of state.inbox ?? []) {
    if (e.type === 'merchant') continue;
    push({ key: `event:${e.id}`, kind: 'event', id: e.id, label: `Trouvaille : ${eventLabel(e.type)}`, reward: e.reward ?? {}, item: Boolean(e.item), itemRef: e.item ?? null, tab: 'contracts' }); // v9.1.3 : plus d'onglet À récupérer
  }
  (state.expeditions?.slots ?? []).forEach((run, slot) => {
    if (expeditionDone(run, now)) push({ key: `expedition:${slot}`, kind: 'expedition', slot, label: `Expédition terminée : ${companionById(run.companionId)?.name ?? ''}`, reward: run.reward ?? {}, tab: 'expeditions' });
  });
  const enc = state.codex ? encyclopediaNext(state) : null;
  if (enc?.ready) push({ key: 'encyclopedia', kind: 'encyclopedia', label: `Collections : palier ${Math.round(enc.pct)} %`, reward: enc.reward, tab: 'encyclopedia' });
  if (state.codex) {
    for (const c of SECTIONS_WITH_MILESTONES) { // v9.1.3 : paliers de section (ancien Codex)
      const st = sectionStatus(state, c.id);
      if (st.ready) push({ key: `collection:${c.id}`, kind: 'collection', id: c.id, label: `Collections : ${c.label} (${st.next})`, reward: st.reward, tab: 'encyclopedia' });
    }
  }
  for (const [bossId, entry] of Object.entries(state.powers ?? {})) {
    const tier = nextMasteryTier(state, bossId, balance);
    if (tier && entry.victories >= tier.victories) {
      const { victories, ...reward } = tier;
      push({ key: `mastery:${bossId}`, kind: 'mastery', bossId, label: `Maîtrise : ${BOSSES[bossId]?.name ?? bossId}`, reward, tab: 'boss' });
    }
  }
  // v9.8 (C2) : objectif d'événement rempli → pastille sur Aventure › Événement, et dans « Tout récupérer ».
  try {
    const ev = currentEvent();
    if (ev?.kind === 'small') {
      const rec = eventRecord(state);
      for (const g of eventGoals(ev)) if (!rec.claimed.includes(g.id) && (rec.goals[g.id] ?? 0) >= g.target) push({ key: `eventGoal:${g.id}`, kind: 'eventGoal', id: g.id, label: `Événement : ${g.label}`, reward: g.give ?? {}, tab: 'event' });
    }
  } catch { /* pas d'événement */ }
  return out;
}

// Nombre d'entrées réclamables par onglet (pastilles rouges).
export function claimablesByTab(list) {
  const out = {};
  for (const c of list) if (!c.blocked) out[c.tab] = (out[c.tab] ?? 0) + 1;
  return out;
}
