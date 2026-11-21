// v10.6 (partie 2.4) : « Prime du Héraut » — un événement court qui arrive en glissant en haut au centre de l'écran de
// jeu, comme une affiche de prime : un boss de donjon en portrait, 6 h pour le battre, une récompense en gemmes et
// « Combattre ». Une à deux fois par jour, refusable ; si on ne la touche pas, elle se range dans la colonne
// d'événements. C'est la vitrine des donjons et des boss.
// La prime est remplie dès qu'un donjon est gagné (ou balayé) pendant qu'elle court : on compare le compteur du Carnet
// (daybook.counts.dungeons) à sa valeur au moment où l'affiche est arrivée.
import { DUNGEONS } from '../data/dungeons.js';
import { BOSSES } from '../data/enemies.js';
import { dayKey } from './tower.js';
import { daybookOf } from './daybook.js';
import { grantReward } from './rewards.js';

export const BOUNTY = {
  perDay: 2, // une à deux affiches par jour
  hours: 6, // durée d'une prime
  firstAfter: 90, // secondes de jeu dans la session avant la première affiche du jour
  gapHours: 3, // au moins 3 h entre la fin d'une prime et l'affiche suivante
  reward: { gems: 2000 },
};
const H = 3600000;

export function bountyState(state) {
  state.heraldBounty ??= { day: '', count: 0, active: null, lastEnd: 0 };
  return state.heraldBounty;
}

// Donjons ouverts (record) : le boss de la prime est pris parmi eux, selon le jour et le numéro d'affiche.
function openDungeons(state) {
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  return DUNGEONS.filter((d) => best >= d.unlockStage);
}

// Prime en cours (ou null) : { dungeon, boss, name, until, reward, done, claimed, folded, base }.
export function activeBounty(state, now = Date.now()) {
  const b = bountyState(state);
  const a = b.active;
  if (!a) return null;
  if (now >= a.until && !(a.done && !a.claimed)) { b.lastEnd = a.until; b.active = null; return null; }
  const d = DUNGEONS.find((x) => x.id === a.dungeon);
  if (!d) { b.active = null; return null; }
  const count = daybookOf(state, now).counts?.dungeons ?? 0;
  if (!a.done && (count > a.base || (a.day !== dayKey(now) && count > 0))) a.done = true;
  return { ...a, boss: d.boss, name: BOSSES[d.boss]?.name ?? d.name, dungeonName: d.name, left: Math.max(0, a.until - now) };
}

// À appeler régulièrement (écran de jeu) : fait arriver une nouvelle affiche quand c'est le moment. Renvoie la prime
// qui vient d'arriver, sinon null. sessionSeconds : temps passé dans la session (pas d'affiche dès l'ouverture).
export function maybeStartBounty(state, now = Date.now(), sessionSeconds = 0) {
  const b = bountyState(state);
  if (activeBounty(state, now)) return null;
  const day = dayKey(now);
  if (b.day !== day) { b.day = day; b.count = 0; }
  if (b.count >= BOUNTY.perDay || sessionSeconds < BOUNTY.firstAfter) return null;
  if (b.lastEnd && now - b.lastEnd < BOUNTY.gapHours * H) return null;
  const list = openDungeons(state);
  if (!list.length) return null;
  const seed = [...day].reduce((s, c) => s + c.charCodeAt(0), 0) + b.count;
  const d = list[seed % list.length];
  b.count += 1;
  b.active = { dungeon: d.id, day, until: now + BOUNTY.hours * H, reward: { ...BOUNTY.reward }, base: daybookOf(state, now).counts?.dungeons ?? 0, done: false, claimed: false, folded: false, seen: false };
  return activeBounty(state, now);
}

// « Pas maintenant » : la prime est refusée (elle ne revient pas ; la suivante viendra plus tard dans la journée).
export function refuseBounty(state, now = Date.now()) {
  const b = bountyState(state);
  if (!b.active) return false;
  b.lastEnd = now;
  b.active = null;
  return true;
}
// Rangée dans la colonne d'événements (l'affiche n'a pas été touchée).
export function foldBounty(state) {
  const a = bountyState(state).active;
  if (a) { a.folded = true; a.seen = true; }
}
export function claimBounty106(state, now = Date.now()) {
  const a = activeBounty(state, now);
  if (!a?.done || a.claimed) return null;
  const b = bountyState(state);
  b.active = null;
  b.lastEnd = now;
  return grantReward(state, a.reward);
}
