// v10.6 (partie 3) : événement illustré, sur un modèle réutilisable. Chaque événement fournit son affiche, sa lanterne
// (ou l'équivalent), son grand prix, ses missions et son échoppe ; le moteur (ancients.js : objectifs comptés pendant
// la fenêtre de l'événement) ne change pas.
//   Missions (« lanternes ») : les 4 objectifs du Marché ; une mission finie s'allume et donne sa récompense d'avant,
//   plus des Lueurs.
//   Lueurs : la monnaie de l'événement. Gagnées en allumant les lanternes, et peu à peu en avançant les missions.
//   Carte : 10 étapes (lanternes) sur un chemin ; on avance au total de Lueurs gagnées (dépenser à l'échoppe ne fait
//   pas reculer). Chaque étape a sa récompense ; le grand prix est au bout.
//   Échoppe : 6 objets illustrés, prix en Lueurs, stock limité.
import { currentEvent, eventGoals, eventRecord } from './ancients.js';
import { grantReward } from './rewards.js';
import { liveNow } from './live.js';

export const LIGHTS_EVENT = {
  id: 'lights',
  title: 'Marché des Lueurs',
  tagline: 'Allume les lanternes, gagne la Fée des lueurs.',
  currency: 'Lueurs',
  art: {
    key: 'assets/ui/art106/event_lights_key.png',
    path: 'assets/ui/art106/event_lights_path.png',
    node: 'assets/ui/art106/event_lights_node.png',
    nodeDone: 'assets/ui/art106/event_lights_node_done.png',
    currency: 'assets/ui/art106/event_lights_currency.png',
    prize: 'assets/ui/art106/event_lights_prize.png',
    hud: 'assets/ui/art106/hud_event_market.png',
  },
  // Grand prix : la Fée des bois (familier). Déjà possédée : un fragment Légendaire universel à la place.
  prize: { label: 'Fée des lueurs', companion: 'fairy', fallback: { ssrFragment: 1 } },
  // Lueurs données en allumant chaque lanterne (mission finie).
  lantern: { kills: 5, bosses: 5, dungeons: 8, summons: 8 },
  // Lueurs gagnées en avançant : une par tranche (plafonnées par la cible de la mission).
  trickle: { kills: 250, bosses: 1, dungeons: 0.5, summons: 2 },
  missions: {
    kills: { title: '5 000 monstres', art: 'event_lights_mission_monsters', tab: null },
    bosses: { title: '30 boss', art: 'event_lights_mission_bosses', tab: 'boss' },
    dungeons: { title: 'Donjons', art: 'event_lights_mission_dungeon', tab: 'dungeons' },
    summons: { title: 'Invocations', art: 'event_lights_mission_summons', tab: 'summon' },
  },
  // 10 étapes : Lueurs gagnées au total pour l'atteindre, récompense (le grand prix au bout).
  path: [
    { at: 4, give: { gems: 50 }, label: 'Gemmes' },
    { at: 8, give: { gems: 100 }, label: 'Gemmes' },
    { at: 14, give: { ticketLimited: 1 }, label: 'Ticket' },
    { at: 20, give: { keys: 3 }, label: '×3 clés' },
    { at: 28, give: { ticketPermanent: 2 }, label: 'Tickets' },
    { at: 36, give: { shards: 500 }, label: 'Éclats' },
    { at: 46, give: { ticketPet: 2 }, label: 'Familiers' },
    { at: 58, give: { ticketLimited: 5 }, label: 'Tickets' },
    { at: 72, give: { gems: 300 }, label: 'Gemmes' },
    { at: 90, prize: true, label: 'Fée' },
  ],
  shop: [
    { id: 'tickets', title: 'Ticket ×3', art: 'event_lights_shop_tickets', price: 20, stock: 3, give: { ticketLimited: 3 } },
    { id: 'chest', title: 'Coffre épique', art: 'event_lights_shop_chest', price: 35, stock: 2, give: { ticketPermanent: 3, gems: 200 } },
    { id: 'essence', title: 'Essence', art: 'event_lights_shop_essence', price: 12, stock: 5, give: { shards: 300 } },
    { id: 'keys', title: 'Clés ×3', art: 'event_lights_shop_keys', price: 15, stock: 3, give: { keys: 3 } },
    { id: 'shards', title: 'Sac d\'éclats', art: 'event_lights_shop_shards', price: 8, stock: 5, give: { shards: 150 } },
    { id: 'skin', title: 'Jeton de la Fée', art: 'event_lights_shop_skin', price: 60, stock: 1, give: { ssrFragment: 1 } },
  ],
};

const art = (name) => `assets/ui/art106/${name}.png`;
export const lightsArt = art;

// Événement Lueurs en cours (petit événement du calendrier), sinon null.
export function lightsEvent(now = liveNow()) {
  const ev = currentEvent(now);
  return ev && ev.kind === 'small' ? ev : null;
}
function rec(state, now) {
  const r = eventRecord(state, now);
  if (!r) return null;
  r.lights ??= { steps: [], spent: 0, bought: {} };
  return r;
}

// Missions de l'événement, prêtes à afficher.
export function lightsMissions(state, now = liveNow()) {
  const ev = lightsEvent(now);
  const r = ev && rec(state, now);
  if (!r) return [];
  return eventGoals(ev).map((g) => {
    const m = LIGHTS_EVENT.missions[g.type] ?? { title: g.label, art: 'event_lights_mission_monsters', tab: null };
    const p = Math.min(g.target, r.goals[g.id] ?? 0);
    return { id: g.id, type: g.type, title: g.type === 'dungeons' || g.type === 'summons' ? `${g.target} ${m.title.toLowerCase()}` : m.title,
      art: art(m.art), tab: m.tab, p, target: g.target, lit: r.claimed.includes(g.id), ready: p >= g.target && !r.claimed.includes(g.id),
      lueurs: LIGHTS_EVENT.lantern[g.type] ?? 5 };
  });
}

// Lueurs gagnées au total (lanternes allumées + avancée des missions), dépensées, et en poche.
export function lightsWallet(state, now = liveNow()) {
  const ev = lightsEvent(now);
  const r = ev && rec(state, now);
  if (!r) return { earned: 0, spent: 0, have: 0 };
  let earned = 0;
  for (const g of eventGoals(ev)) {
    const p = Math.min(g.target, r.goals[g.id] ?? 0);
    const per = LIGHTS_EVENT.trickle[g.type];
    if (per) earned += Math.floor(p / per);
    if (r.claimed.includes(g.id)) earned += LIGHTS_EVENT.lantern[g.type] ?? 5;
  }
  const spent = r.lights.spent ?? 0;
  return { earned, spent, have: Math.max(0, earned - spent) };
}

// Étapes de la carte : atteinte, récupérée.
export function lightsPath(state, now = liveNow()) {
  const r = lightsEvent(now) && rec(state, now);
  const { earned } = lightsWallet(state, now);
  return LIGHTS_EVENT.path.map((s, i) => ({ ...s, index: i, reached: earned >= s.at, claimed: Boolean(r?.lights.steps.includes(i)) }));
}
// Étape où se tient le portrait du héros (dernière atteinte), -1 avant la première.
export function lightsPosition(state, now = liveNow()) {
  const p = lightsPath(state, now);
  let i = -1;
  for (const s of p) if (s.reached) i = s.index;
  return i;
}

// Récompenses de la carte prêtes (pastille de la colonne d'événements, Tout récupérer).
export function lightsReady(state, now = liveNow()) {
  return lightsPath(state, now).filter((s) => s.reached && !s.claimed).length + lightsMissions(state, now).filter((m) => m.ready).length;
}

// Récupère une étape atteinte (index) : sa récompense, ou le grand prix.
export function claimLightsStep(state, index, now = liveNow()) {
  const r = lightsEvent(now) && rec(state, now);
  const s = lightsPath(state, now)[index];
  if (!r || !s || !s.reached || s.claimed) return null;
  r.lights.steps.push(index);
  if (!s.prize) return { given: grantReward(state, s.give), label: s.label };
  const id = LIGHTS_EVENT.prize.companion;
  const owned = state.companions?.owned;
  if (owned && !owned[id]) { owned[id] = { stars: 1, level: 1 }; return { given: {}, label: LIGHTS_EVENT.prize.label, companion: id }; }
  return { given: grantReward(state, LIGHTS_EVENT.prize.fallback), label: LIGHTS_EVENT.prize.label };
}
// Récupère toutes les étapes atteintes.
export function claimLightsAll(state, now = liveNow()) {
  const out = [];
  for (const s of lightsPath(state, now)) if (s.reached && !s.claimed) out.push(claimLightsStep(state, s.index, now));
  return out.filter(Boolean);
}

export function lightsShop(state, now = liveNow()) {
  const r = lightsEvent(now) && rec(state, now);
  const { have } = lightsWallet(state, now);
  return LIGHTS_EVENT.shop.map((i) => { const bought = r?.lights.bought[i.id] ?? 0; return { ...i, art: art(i.art), bought, left: i.stock - bought, can: Boolean(r) && have >= i.price && bought < i.stock }; });
}
export function buyLights(state, id, now = liveNow()) {
  const r = lightsEvent(now) && rec(state, now);
  const item = lightsShop(state, now).find((i) => i.id === id);
  if (!r || !item?.can) return null;
  r.lights.spent = (r.lights.spent ?? 0) + item.price;
  r.lights.bought[id] = (r.lights.bought[id] ?? 0) + 1;
  return grantReward(state, item.give);
}
