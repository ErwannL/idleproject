// v9.8 (H1) : Carnet du jour — un seul écran pour la routine (≈ 15 minutes en 2 ou 3 passages). Il regroupe la Chasse
// rapide, la Roue, un donjon (ou balayage), les expéditions, la Tour et les missions du jour. Chaque tâche finie reçoit un
// tampon « Accompli » ; toutes finies : tampon « Journée accomplie » et coffre de fin de journée.
import { dayKey } from './tower.js';
import { grantReward } from './rewards.js';
import { quickHuntReady } from './quick-hunt.js';
import { wheelReady } from './wheel.js';
import { titanToday } from './titan.js';
import { MISSION_PERIODS } from '../data/missions.js';
import { missionStatus, missionOpen } from './missions.js';

export const DAYBOOK_CHEST = { gems: 60, keys: 1, shards: 30 };

export function daybookOf(state, now = Date.now()) {
  const day = dayKey(now);
  if (state.daybook?.day !== day) state.daybook = { day, counts: {}, chest: false };
  state.daybook.counts ??= {};
  return state.daybook;
}
export function daybookTrack(state, key, amount = 1, now = Date.now()) {
  const d = daybookOf(state, now);
  d.counts[key] = (d.counts[key] ?? 0) + amount;
}

// Tâches du jour. open(id) : système ouvert (même règle que les onglets). Chaque tâche : id, icône, titre court,
// avancée, cible, onglet ou action.
export function daybookTasks(state, open = () => true, now = Date.now()) {
  const d = daybookOf(state, now);
  const c = d.counts;
  const daily = MISSION_PERIODS.find((p) => p.id === 'daily');
  const missions = (daily?.missions ?? []).filter((m) => missionOpen(state, m));
  const mDone = missions.filter((m) => missionStatus(state, 'daily', m).claimed).length;
  const tasks = [
    { id: 'hunt', icon: 'icon_bolt', title: 'Chasse rapide', text: '2 h de gains d\'un coup', done: !quickHuntReady(state, now), n: quickHuntReady(state, now) ? 0 : 1, target: 1, action: 'quick-hunt' },
    { id: 'wheel', icon: 'icon_star', title: 'Roue du jour', text: 'Un tour gratuit', done: !wheelReady(state, now), n: wheelReady(state, now) ? 0 : 1, target: 1, action: 'wheel-open' },
  ];
  if (open('dungeons')) tasks.push({ id: 'dungeon', icon: 'icon_key', title: 'Donjon', text: 'Gagne ou balaie 1 donjon', n: c.dungeons ?? 0, target: 1, tab: 'dungeons' });
  if (open('expeditions')) tasks.push({ id: 'expedition', icon: 'icon_expedition', title: 'Expéditions', text: 'Envoie 2 compagnons', n: c.expeditions ?? 0, target: 2, tab: 'expeditions' });
  // v9.8 (H7) : Titan du jour (après le monde 2, comme les événements).
  if (open('event')) tasks.push({ id: 'titan', icon: 'icon_boss', title: titanToday(now).name, text: 'Frappe le Titan du jour', n: c.titan ?? 0, target: 1, action: 'titan-start' });
  if (open('tower')) tasks.push({ id: 'tower', icon: 'icon_tower', title: 'Tour', text: 'Monte la Tour 1 fois', n: c.tower ?? 0, target: 1, tab: 'tower' });
  if (missions.length) tasks.push({ id: 'missions', icon: 'icon_trophy', title: 'Missions du jour', text: 'Récupère tes missions', n: mDone, target: missions.length, tab: 'contracts' });
  for (const t of tasks) { t.n = Math.min(t.n, t.target); t.done ??= t.n >= t.target; }
  return tasks;
}

export function daybookComplete(state, open, now = Date.now()) {
  return daybookTasks(state, open, now).every((t) => t.done);
}
export function claimDaybookChest(state, open, now = Date.now()) {
  const d = daybookOf(state, now);
  if (d.chest || !daybookComplete(state, open, now)) return null;
  d.chest = true;
  return grantReward(state, DAYBOOK_CHEST);
}
