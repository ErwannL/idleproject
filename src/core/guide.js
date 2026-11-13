// Aide au joueur (v8.4) : puissance, puissance conseillée pour le prochain boss, conseils « que faire ».
import { BALANCE } from '../data/balance.js';
import { bossesForStage, createCombat, heroPower, isBossStage, step } from './combat.js';
import { Rng } from './rng.js';
import { endWorldRun } from './banner.js';
import { isUpgrade, uselessItems } from './inventory.js';
import { companionById, companionUpgradeCost, onExpedition, teamKind, unitLevel } from './companions.js';
import { teamAdvice } from './team-advisor.js'; // v9.5.0
import { upgradeProfits } from './profit.js';
import { upgradeOpen } from './unlocks.js';
import { upgradeCost } from './economy.js';
import { skillPointCost, skillPointsAvailable } from './skills.js';
import { SKILLS } from '../data/skills.js';
import { canRebirth, rebirthBlocked, rebirthReward, rebirthWorth } from './rebirth.js';
import { COMPANION_RULES } from '../data/companions.js';
import { DUNGEONS } from '../data/dungeons.js';
import { TOWER, climbsLeft } from './tower.js'; // v9.6.2
import { CHALLENGE } from './challenge.js'; // v9.6.2
import { arenaUnlocked } from './arena.js'; // v9.6.2
import { BANNERS } from '../data/economy.js';
import { BOSSES } from '../data/enemies.js';
import { claimables } from './claimables.js';
import { computeHeroStats } from './stats.js';

// Prochain boss : la première étape de boss à partir de l'étape actuelle.
export function nextBossStage(state, balance = BALANCE) {
  let s = Math.max(state.stage, 1);
  while (!isBossStage(s, balance)) s += 1;
  return s;
}

// Prévision du prochain boss (v8.4) : le vrai combat est simulé sur une copie de la partie (sans rendu).
// Plus fiable qu'une « puissance conseillée » : rage, armure ignorée, compagnons et compétences comptent.
// v8.5 : générateur découpé en tranches (l'interface le fait avancer par petits morceaux, sans à-coup)
// et combat de 60 s au plus (au-delà, la rage des boss décide de toute façon).
export const FORECAST_SECONDS = 60;
export function* forecastSteps(state, balance = BALANCE, chunk = 200) {
  const stage = nextBossStage(state, balance);
  const t = structuredClone(state);
  t.stage = stage; t.autoAdvance = false; t.dungeon = null; t.tower = null; t.challenge = null; t.inventory = [];
  endWorldRun(t, 'left'); // v9.1.3 (doc4 lot 6) : mode monde neutralisé (équipe d'avant l'essai, sans essai gratuit)
  const w = createCombat(t, balance);
  const rng = new Rng(stage * 7919);
  const dt = balance.simulation.tickSeconds;
  let bossHpPct = 100;
  const total = Math.round(FORECAST_SECONDS / dt);
  for (let i = 0; i < total; i++) {
    step(t, w, dt, rng, balance);
    const b = w.enemies.find((e) => e.boss && !e.summoned);
    if (b) bossHpPct = Math.max(0, (b.hp / b.maxHp) * 100);
    for (const e of w.events) {
      if (e.type === 'bossDefeated' && !e.summoned) return { stage, win: true, bossHpPct: 0, seconds: Math.round(i * dt) };
      if (e.type === 'heroDeath') return { stage, win: false, bossHpPct: Math.round(bossHpPct), seconds: Math.round(i * dt) };
    }
    w.events.length = 0;
    if (i % chunk === chunk - 1) yield i / total;
  }
  return { stage, win: false, bossHpPct: Math.round(bossHpPct), seconds: FORECAST_SECONDS, timeout: true };
}

export function forecastBoss(state, balance = BALANCE) {
  const gen = forecastSteps(state, balance);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

// v9.3.5 : « Prochaine action » = le guide de tout le jeu. UN conseil, et un clic fait l'action quand c'est possible.
// Ordre : mode en cours ; récompense prête ; objets meilleurs (héros et équipe, tous d'un coup) ; compagnon à placer ;
// points de compétence ; première invocation ; amélioration rentable abordable ; montée d'un compagnon de l'équipe ;
// sac plein à plus de 80 % ; fusion prête ; clés de donjon ; Renaissance quand un boss bloque ; boss qui bloque ; objectif.
// `ctx.visible` : onglets ouverts (ui.tabVisible) — rien n'est proposé pour une fonction encore cachée.
// Chaque conseil : { id, text, tab?, view?, action?, value? }.
export function nextAction(state, ctx = {}, balance = BALANCE) {
  if (state.dungeon) return { id: 'mode-dungeon', text: 'Donjon en cours', tab: 'dungeons' };
  if (state.tower) return { id: 'mode-tower', text: 'Tour en cours', tab: 'tower' };
  if (state.worldRun) return { id: 'mode-world', text: 'Monde en cours', tab: 'world' }; // v9.1.3 (doc4 lot 6)
  if (state.challenge) return { id: 'mode-challenge', text: 'Défi en cours', tab: 'tower', view: { defiTab: 'challenge' } };
  const open = (tab) => (ctx.visible ?? {})[tab] !== false;
  const claims = (ctx.claims ?? claimables(state, Date.now(), balance)).filter((c) => !c.blocked);
  if (claims.length) return claimAction(claims);
  const current = computeHeroStats(state, balance);
  const better = state.inventory.filter((i) => isUpgrade(state, i, balance, current)).length;
  if (better) return { id: 'equip', text: better > 1 ? `Équiper ${better} objets meilleurs` : 'Équiper 1 objet meilleur', action: 'equip-best' };
  const place = companionToPlace(state, balance);
  if (place) return { id: 'place', text: `Placer ${place.name} dans l'équipe`, action: 'place-companion', value: place.id };
  // v9.5.0 (3.6) : un compagnon du banc ferait mieux → « Meilleure équipe disponible », avec le gain (calculé à part).
  const adv = teamAdvice(state);
  if (adv && !adv.same && adv.gain >= 0.1) {
    const names = adv.team.filter((id) => !state.companions.equipped.includes(id)).map((id) => companionById(id)?.name ?? id);
    return { id: 'team', text: `Meilleure équipe : ${names.join(' et ')} (+${Math.round(adv.gain * 100)} %)`, action: 'apply-team' };
  }
  const points = skillPointsAvailable(state);
  if (points > 0 && open('skills') && SKILLS.some((k) => (state.skills[k.id] ?? 0) < (k.maxLevel ?? Infinity) && skillPointCost(state.skills[k.id] ?? 0) <= points && (k.unlockLevel ?? 1) <= state.level)) {
    // v9.3.8 (3a) : un clic dépense les points (Attaques seulement) ; plus jamais bloqué sur un Boost payé en or.
    return { id: 'skills', text: points > 1 ? `${points} points de compétence à dépenser` : '1 point de compétence à dépenser', action: 'distribute-skills' };
  }
  if (open('summon') && (state.records?.bossesDefeated ?? 0) >= 1 && !Object.keys(state.companions.owned).length && state.gems >= balance.summon.gemCost) { // après le premier mini-boss
    return { id: 'summon', text: 'Première invocation : un compagnon', tab: 'summon' };
  }
  // v9.3.5 : gemmes en réserve et place libre dans l'équipe → invoquer (aussi après la première fois).
  const freeOf = (k) => state.companions.equipped.filter((id) => teamKind(companionById(id)) === k).length < balance.teamSlots[k];
  if (open('summon') && Object.keys(state.companions.owned).length && (freeOf('ally') || freeOf('pet')) && state.gems >= balance.summon.gemCost) {
    return { id: 'summon', text: freeOf('ally') ? 'Invoquer un compagnon (place libre)' : 'Invoquer un familier (place libre)', tab: 'summon' };
  }
  // v9.6.2 (7.9) : les contenus tournent — chacun est proposé au moins une fois par jour ; après 2 « Plus tard » il
  // laisse sa place jusqu'au lendemain. Marqué « vu » dès que le joueur suit le conseil.
  const round = contentRound(state, open);
  if (round) return round;
  const up = bestOpenUpgrade(state, balance);
  const lv = companionToLevel(state, balance);
  // Montée d'un compagnon d'abord quand elle coûte moins que l'amélioration proposée (sinon l'or part toujours ailleurs).
  if (lv && (!up || up.cost > state.gold || lv.cost <= up.cost)) return { id: 'level', text: `Monter ${lv.name} au niveau ${lv.level + 1}`, action: 'upgrade-companion', value: lv.id };
  if (up && up.cost <= state.gold && open('upgrades')) return { id: 'upgrade', text: `Améliorer : ${UPGRADE_NAMES[up.key] ?? up.key}`, action: 'buy', value: up.key };
  if (state.inventory.length >= balance.loot.inventorySize * 0.8) {
    const n = uselessItems(state, balance).length;
    if (n) return { id: 'recycle', text: `Recycler ${n} objets inutiles`, action: 'recycle-useless' };
  }
  if (open('forge') && ctx.fusionReady) return { id: 'fusion', text: 'Fusion prête à la Forge', tab: 'forge' };
  if (open('dungeons') && (state.records?.bestStage ?? state.maxStage) >= DUNGEONS[0].unlockStage && (state.keys ?? 0) >= 1) return { id: 'keys', text: state.keys > 1 ? `${state.keys} clés de donjon à utiliser` : '1 clé de donjon à utiliser', tab: 'dungeons' };
  const blocking = Number.isFinite(state.bossRetry?.hpPct) ? state.bossRetry.hpPct : null;
  const blocked = Boolean(state.bossRetry && state.stage === state.bossRetry.stage - 1);
  // v9.3.8 : Renaissance aussi quand la progression ralentit (plus de 10 min de jeu sans nouveau record).
  const slowing = (state.playSeconds ?? 0) - (state.recordAt ?? state.playSeconds ?? 0) > 600;
  if ((blocked || slowing || rebirthWorth(state)) && open('tree') && canRebirth(state) && !rebirthBlocked(state) && rebirthReward(state) > 0) {
    return { id: 'rebirth', text: `Renaissance : +${rebirthReward(state)} fragments`, tab: 'tree', view: { treeSeg: 'rebirth' } };
  }
  if (blocked) {
    const pct = bossRetryPct(state, balance);
    return { id: 'retry', text: blocking !== null ? `Boss : ${blocking} % de vie restante` : pct >= 100 ? 'Retenter le boss (prêt)' : `Boss trop fort : améliore-toi (${pct} %)`, action: 'retry-boss' };
  }
  if (!state.autoAdvance && !state.farmBoss) return { id: 'advance', text: 'Reprendre l\'avance', action: 'advance' };
  return goalAction(state, balance);
}

// Amélioration la plus rentable parmi les lignes ouvertes (dégâts/s par or ; PV quand aucune ligne de dégâts n'est abordable).
export function bestOpenUpgrade(state, balance = BALANCE) {
  const profits = upgradeProfits(state, balance);
  let best = null;
  for (const [k, p] of Object.entries(profits)) if (upgradeOpen(state, k, balance) && p.gain > 0 && (!best || p.score > best.score)) best = { key: k, ...p };
  if (best && best.cost <= state.gold) return best;
  const v = balance.upgrades.vitality;
  if (v && upgradeOpen(state, 'vitality', balance)) { const cost = upgradeCost('vitality', state.upgrades.vitality ?? 0, balance); if (cost <= state.gold && (state.upgrades.vitality ?? 0) < (state.upgrades.damage ?? 0)) return { key: 'vitality', cost }; }
  return best;
}

const UPGRADE_NAMES = { damage: 'Dégâts', attackSpeed: 'Vitesse d\'attaque', vitality: 'PV', crit: 'Critique', armor: 'Armure', defense: 'Défense',
  regen: 'Régénération', goldFind: 'Or', critDamage: 'Dégâts critiques', doubleAttack: 'Double attaque', lifesteal: 'Vol de vie',
  companionPower: 'Compagnons', dodge: 'Esquive', bossDamage: 'Dégâts aux boss', xpGain: 'Expérience' };

// Compagnon possédé à placer dans une place libre de l'équipe (le plus rare d'abord), ou null.
export function companionToPlace(state, balance = BALANCE) {
  const order = ['legendary', 'epic', 'rare', 'common'];
  const free = (kind) => state.companions.equipped.filter((id) => teamKind(companionById(id)) === kind).length < balance.teamSlots[kind];
  return Object.keys(state.companions.owned).map(companionById)
    .filter((c) => c && !state.companions.equipped.includes(c.id) && !onExpedition(state, c.id) && free(teamKind(c)))
    .sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))[0] ?? null;
}
// Membre de l'équipe dont la montée de niveau est abordable (la moins chère), ou null.
export function companionToLevel(state, balance = BALANCE) {
  let best = null;
  for (const id of state.companions.equipped) {
    const owned = state.companions.owned[id];
    const cost = companionUpgradeCost(state, id, balance);
    if (!owned || unitLevel(state, id) >= COMPANION_RULES.maxLevel || cost > state.gold) continue;
    if (!best || cost < best.cost) best = { id, name: companionById(id)?.name ?? id, level: unitLevel(state, id), cost };
  }
  return best;
}

export const CONTENT_ROUND = [
  { id: 'c-tower', tab: 'tower', text: 'Défi du jour : monte dans la Tour', ok: (s) => (s.records?.bestStage ?? s.maxStage) >= TOWER.unlockStage && climbsLeft(s) > 0 },
  { id: 'c-challenge', tab: 'tower', view: { defiTab: 'challenge' }, text: 'Tente le Défi de la semaine', ok: (s) => (s.records?.bestStage ?? s.maxStage) >= CHALLENGE.unlockStage },
  { id: 'c-arena', tab: 'tower', view: { defiTab: 'arena' }, text: 'Un combat d\'Arène (étoiles et copies de compagnons)', ok: (s) => arenaUnlocked(s) },
  { id: 'c-expeditions', tab: 'expeditions', text: 'Envoie tes compagnons libres en expédition', ok: (s) => (s.expeditions?.slots ?? []).some((r) => !r) && Object.keys(s.companions?.owned ?? {}).length > s.companions.equipped.length },
  { id: 'c-event', tab: 'event', text: 'Événement : enchaîne les étapes de la carte', ok: (s) => Boolean(s.event) },
];
export function guideDay(state, now = Date.now()) {
  const d = new Date(now); const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  if (state.ui.guideDay?.day !== key) state.ui.guideDay = { day: key, done: [], skips: {} };
  return state.ui.guideDay;
}
function contentRound(state, open) {
  if (!state.ui) return null;
  const g = guideDay(state);
  for (const c of CONTENT_ROUND) {
    if (g.done.includes(c.id) || (g.skips[c.id] ?? 0) >= 2 || !open(c.tab)) continue;
    let ok = false;
    try { ok = c.ok(state); } catch { ok = false; }
    if (ok) return { id: c.id, text: c.text, tab: c.tab, view: c.view, content: true };
  }
  return null;
}

function claimAction(claims) {
  return { id: 'claim', text: claims.length > 1 ? `Tout récupérer (${claims.length})` : `Récupérer : ${claims[0].label}`, action: 'claim-everything', tab: claims[0].tab };
}

function goalAction(state, balance) {
  const boss = nextBossName(state, balance);
  return { id: 'goal', text: boss ? `Objectif : battre ${boss}` : 'Objectif : avancer', tab: 'campaign' };
}

// Objet du sac qui améliore le plus le héros (le premier trouvé), ou null.
export function betterItem(state, balance = BALANCE, current = computeHeroStats(state, balance)) {
  return state.inventory.find((i) => isUpgrade(state, i, balance, current)) ?? null;
}

// Puissance du héros face au boss qui l'a battu, en % de ce qu'il faut pour le retenter (100 = prêt).
export function bossRetryPct(state, balance = BALANCE) {
  const r = state.bossRetry;
  if (!r) return null;
  return Math.min(999, Math.floor((heroPower(state, balance) / (r.power * balance.stages.bossRetryPower)) * 100));
}

function nextBossName(state, balance) {
  const stage = nextBossStage(state, balance);
  const id = bossesForStage(stage)?.[0];
  return id ? BOSSES[id]?.name ?? null : null;
}


// Aide « ? » de chaque écran (v9.1.0) : 3 lignes au plus (`short`), le détail dans « En savoir plus » (`more`).
// Les textes suivent le lexique du jeu (Compétences, Boosts, Pouvoirs, Talents, Builds…).
export const PANEL_HELP = {
  upgrades: {
    short: 'L\'or achète des améliorations. Chaque ligne indique son gain en dégâts/s : à vous de choisir.',
    more: 'Dégâts et Points de vie gagnent ×1,35 / ×1,4 tous les 10 niveaux et ×1,75 tous les 25 niveaux : visez ces paliers. ×10, ×100 et Max achètent plusieurs niveaux d\'un coup.',
    // v9.2.1
    env: 'Dans les mondes 2 à 12, l\'environnement gêne le héros : la mention « contre … » marque l\'amélioration qui réduit ce malus (annulé à son niveau complet).',
    touch: 'Gardez le doigt sur un bouton d\'achat : après l\'anneau, il achète en continu, de plus en plus vite.',
  },
  inventory: {
    short: 'La flèche verte marque un objet meilleur que celui porté. « Équiper le meilleur » équipe tout d\'un coup.',
    more: 'Les objets grandissent avec leur niveau : Réaffûter remonte un objet au niveau de votre étape max. La Forge s\'ouvre à l\'étape 10 et le Coffre à l\'étape 20 : il garde des objets jamais recyclés et les meilleures pièces d\'ensemble (filtre Ensemble, « Porter ») ; les Builds enregistrent équipe, équipement, classe, pouvoirs et compétences. Recyclage et fusion automatiques : Réglages du sac.',
  },
  hero: {
    short: 'Votre fiche : dégâts/s, niveau et équipement. Classe, Apparence et Records sont dans les segments du haut.',
    more: 'Les blocs repliés détaillent chaque source de bonus. Records garde l\'historique de la Tour, du défi et des donjons, et mesure votre rythme (or et XP par heure).',
  },
  summon: {
    short: `Les gemmes s'obtiennent en jouant. Garanties : Épique au plus tard toutes les ${BANNERS.permanent.epicEvery ?? 10} invocations, Légendaire au plus tard à la ${BANNERS.permanent.hard}e (compagnons) ou à la ${BANNERS.pet.hard}e (familiers).`, // v9.3.8 (3c) : lu dans les données
    more: `Chaque invocation (limitée, permanente, familiers) a son propre compteur : compagnon Légendaire garanti au plus tard à la ${BANNERS.permanent.hard}e invocation, familier Légendaire au plus tard à la ${BANNERS.pet.hard}e invocation de familiers. La vedette représente 50 % des Légendaires obtenus dans son invocation (elle n\'augmente pas la chance d\'un Légendaire). Doublon : +1 étoile, puis des gemmes.`,
  },
  skills: {
    short: 'Un point par niveau du héros, à placer où vous voulez. Les compétences se lancent toutes seules.',
    more: 'Les Boosts (en bas de cet écran, ou les 5 dernières cases de la grille) sont différents : améliorés avec l\'or, lancés d\'un appui sur le combat (ou au clavier), ou en Auto.',
  },
  tree: {
    short: 'Les fragments anciens achètent des talents permanents. Un talent s\'apprend dès qu\'un voisin est appris.',
    more: 'L\'arbre se dévoile au fur et à mesure (la recherche ne porte que sur ce qui est visible). Les clés de voûte demandent des points dans leur région : la légende donne l\'objectif de chaque région. Petits nœuds : 3 niveaux · ◆ notables · ⬢ clés de voûte. La Renaissance (segment Renaissance) remet l\'étape à 1 contre des fragments et un bonus permanent de dégâts, PV et or.',
    mouse: 'Glissez ou utilisez la molette pour vous déplacer, Ctrl + molette pour zoomer.',
    touch: 'Glissez du doigt pour vous déplacer ; les boutons − et + (dans Outils) zooment.',
  },
  campaign: {
    short: 'Votre monde, le prochain boss et la prévision du combat. L\'avance automatique passe d\'une étape à l\'autre.',
    more: 'La plupart des mondes ont 20 étapes et 4 boss (le monde 11 en a 10). Si un boss vous bat, le héros s\'entraîne à l\'étape d\'avant et le retente seul quand il est 15 % plus fort (ou « Retenter le boss »).',
    // v9.2.1
    env: 'Dès le monde 2, chaque monde a un malus d\'environnement (Pénombre, Lave…), un peu plus fort à chaque cycle. Une amélioration à l\'or le réduit selon son niveau : la fiche du monde et la pastille en bas à gauche du combat disent laquelle et la part contrée.',
  },
  dungeons: {
    short: 'Une clé par tentative. Réussir une difficulté débloque la suivante, donjon par donjon.',
    more: 'Chaque fiche dit la mécanique du boss final et ce qui la contre. Le butin ciblé et le chemin sont mémorisés.',
  },
  companions: {
    short: 'Deux compagnons et un familier combattent avec vous. Leurs rôles forment des synergies.',
    more: 'Améliorez-les avec l\'or ; les doublons d\'invocation ajoutent des étoiles. Ceux qui restent hors de l\'équipe peuvent partir en expédition (onglet Expéditions).',
  },
  expeditions: {
    short: 'Les compagnons hors de l\'équipe partent 1 h, 4 h ou 12 h, même jeu fermé, et rapportent des ressources.',
    more: 'La récompense prévue est écrite sous chaque durée. « Repartir » relance la dernière expédition de chaque place (même compagnon, même durée). Rappeler abandonne sans récompense.',
  },
  tower: {
    short: 'Tour : une ascension par semaine, un boss par étage, toujours plus fort. Défi de la semaine : des vagues sous des règles qui changent chaque lundi, sans clé, 3 tentatives.',
    more: 'La tour s\'effondre après 10 h de combat (chaque nouvel étage rajoute un peu de temps) et un méga boss garde chaque 10e étage. Chaque nouveau meilleur score de la semaine et chaque record rapportent des récompenses (liste des étages).',
  },
  boss: {
    short: 'Chaque boss vaincu donne un pouvoir. Réaffrontez-le pour sa maîtrise et des charges de changement de pouvoir.',
    more: 'Deux pouvoirs de la même famille donnent un bonus de famille (effets +25 %).',
  },
  encyclopedia: {
    short: 'Tout ce que vous découvrez s\'inscrit ici ; le pourcentage débloque des paliers de récompenses.',
    more: 'Deux systèmes : l\'encyclopédie (pourcentage global et paliers de chaque section) et le Musée (un objet ancestral par vitrine, bonus permanent, sans effet sur le pourcentage).',
  },
  contracts: {
    short: 'Missions du jour, piste du mois, contrats, prime du jour et hauts faits (bonus permanents). Tout récupérer : touche G.',
    more: 'Les contrats progressent seuls, même jeu fermé ; un contrat rempli est remplacé. La prime du jour donne une pièce d\'ensemble Épique ou mieux.',
  },
  inbox: {
    short: 'Vue d\'ensemble de tout ce qui est prêt à être récupéré (touche N, ou depuis Missions). Tout récupérer : touche G.',
    more: 'Les trouvailles (coffres, gemmes, portails) arrivent pendant le combat. Sac plein : les objets vont au coffre ; sac et coffre pleins : les récompenses avec un objet attendent ici. Les marchands sont dans Missions › Aujourd\'hui.',
  },
  options: {
    short: 'Langue, sauvegarde (export et import), compte, mises à jour ; Interface (dont les essais d\'affichage), Son et Fenêtre dans les onglets.',
    more: 'C\'est quoi un idle ? Le jeu avance tout seul, même fermé : vous revenez de temps en temps pour améliorer votre héros. Lexique — Compétences : lancées seules ; Boosts : lancés d\'un appui ; Pouvoirs : bonus des boss ; Talents : arbre permanent ; Builds : équipement enregistré ; Coffre : rangement, ensembles compris.',
  },
};
