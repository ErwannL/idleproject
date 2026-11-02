// Aide au joueur (v8.4) : puissance, puissance conseillée pour le prochain boss, conseils « que faire ».
import { BALANCE } from '../data/balance.js';
import { bossesForStage, createCombat, heroPower, isBossStage, step } from './combat.js';
import { Rng } from './rng.js';
import { isUpgrade } from './inventory.js';
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

// v9.1.0 : « Prochaine action » — UN seul conseil, dans cet ordre : mode en cours ; à récupérer ; boss bloquant (si une
// amélioration de dégâts est abordable) ; objet meilleur ; points de compétence ; amélioration la plus rentable ;
// retenter le boss ; contenu optionnel ; sinon l'objectif simple du moment (prochain boss). Chaque conseil : { id, text, tab?, view?, action? }.
// `ctx` permet de partager des calculs déjà faits (claims, betterItem) avec les pastilles.
export function nextAction(state, ctx = {}, balance = BALANCE) {
  if (state.dungeon) return { id: 'mode-dungeon', text: 'Donjon en cours', tab: 'dungeons' };
  if (state.tower) return { id: 'mode-tower', text: 'Tour en cours', tab: 'tower' };
  if (state.challenge) return { id: 'mode-challenge', text: 'Défi en cours', tab: 'tower', view: { defiTab: 'challenge' } };
  const claims = (ctx.claims ?? claimables(state, Date.now(), balance)).filter((c) => !c.blocked);
  // v9.1.3 : « Prochaine action » ne recommande plus d'achat (ni amélioration, ni compétence, ni talent, ni mode de
  // jeu) : seulement ce qui est factuel — récupérer ce qui est prêt, équiper un objet meilleur que l'équipé, retenter
  // un boss qui bloque, sinon l'objectif.
  if (claims.length) return claimAction(claims);
  const better = ctx.betterItem !== undefined ? ctx.betterItem : betterItem(state, balance);
  if (better) return { id: 'equip', text: `Équipez : ${better.name}`, tab: 'inventory', view: { invTab: 'bag', invView: null, selectedItemId: better.id, sheetOpen: 'item' } };
  const blocking = state.bossRetry && state.stage === state.bossRetry.stage - 1 ? bossRetryPct(state, balance) : null;
  if (blocking !== null) return { id: 'retry', text: blocking >= 100 ? 'Retenter le boss (prêt)' : `Retenter le boss (${blocking} %)`, action: 'retry-boss' };
  if (!state.autoAdvance && !state.farmBoss) return { id: 'advance', text: 'Reprendre l\'avance', action: 'advance' };
  return goalAction(state, balance);
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

const formatMult = (x) => x.toFixed(2).replace(/0$/, '').replace('.', ',');

// Aide « ? » de chaque écran (v9.1.0) : 3 lignes au plus (`short`), le détail dans « En savoir plus » (`more`).
// Les textes suivent le lexique du jeu (Compétences, Boosts, Pouvoirs, Talents, Builds…).
export const PANEL_HELP = {
  upgrades: {
    short: 'L\'or achète des améliorations. Chaque ligne indique son gain en dégâts/s : à vous de choisir.',
    more: 'Dégâts et Points de vie gagnent ×1,35 / ×1,4 tous les 10 niveaux et ×1,75 tous les 25 niveaux : visez ces paliers. ×10, ×100 et Max achètent plusieurs niveaux d\'un coup.',
    touch: 'Gardez le doigt sur un bouton d\'achat : après l\'anneau, il achète en continu, de plus en plus vite.',
  },
  inventory: {
    short: 'La flèche verte marque un objet meilleur que celui porté. « Équiper le meilleur » équipe tout d\'un coup.',
    more: 'Les objets grandissent avec leur niveau : Réaffûter remonte un objet au niveau de votre étape max. Le Coffre garde des objets jamais recyclés ; les Mannequins rangent les pièces d\'un ensemble ; les Builds enregistrent équipe, équipement, classe, pouvoirs et compétences. Recyclage et fusion automatiques : Réglages du sac.',
  },
  hero: {
    short: 'Votre fiche : dégâts/s, niveau et équipement. Classe, Apparence et Records sont dans les segments du haut.',
    more: 'Les blocs repliés détaillent chaque source de bonus. Records garde l\'historique de la Tour, du défi et des donjons, et mesure votre rythme (or et XP par heure).',
  },
  summon: {
    short: 'Les gemmes s\'obtiennent en jouant. Garanties : Épique au plus tard toutes les 10 invocations, Légendaire toutes les 60.',
    more: 'Le compteur des garanties est commun aux trois invocations. La vedette de la semaine représente 50 % des Légendaires obtenus dans son invocation (elle n\'augmente pas la chance d\'un Légendaire). Doublon : +1 étoile, puis des gemmes.',
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
    short: 'Tout ce qui est prêt à être récupéré, au même endroit. Un seul bouton (ou la touche G).',
    more: 'Les trouvailles (coffres, gemmes, portails) arrivent pendant le combat. Sac plein : les récompenses avec un objet attendent ici. Les marchands proposent un achat, à votre choix.',
  },
  options: {
    short: 'Langue, sauvegarde (export et import), compte, mises à jour ; Interface, Son et Fenêtre dans les onglets.',
    more: 'C\'est quoi un idle ? Le jeu avance tout seul, même fermé : vous revenez de temps en temps pour améliorer votre héros. Lexique — Compétences : lancées seules ; Boosts : lancés d\'un appui ; Pouvoirs : bonus des boss ; Talents : arbre permanent ; Builds : équipement enregistré ; Mannequins : rangement par ensemble.',
  },
};
