// Aide au joueur (v8.4) : puissance, puissance conseillée pour le prochain boss, conseils « que faire ».
import { BALANCE } from '../data/balance.js';
import { bossesForStage, createCombat, heroPower, isBossStage, step } from './combat.js';
import { Rng } from './rng.js';
import { isUpgrade } from './inventory.js';
import { skillPointsAvailable } from './skills.js';
import { canRebirth, rebirthBlocked, rebirthGain } from './rebirth.js';
import { climbsLeft, towerUnlocked } from './tower.js';
import { challengeTriesLeft, challengeUnlocked } from './challenge.js';
import { DUNGEONS } from '../data/dungeons.js';
import { BOSSES } from '../data/enemies.js';
import { PRESTIGE } from '../data/prestige.js';
import { claimables } from './claimables.js';
import { bestUpgrade } from './profit.js';
import { canEnterDungeon } from './dungeon.js';
import { availableForExpedition } from './expeditions.js';
import { computeHeroStats } from './stats.js';
import { TALENTS } from '../data/rebirth.js';
import { talentCost, talentUnlocked } from './rebirth.js';

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

// v9.1.0 : « Prochaine action » — UN seul conseil, dans cet ordre : mode en cours ; à récupérer ; objet meilleur ;
// points de compétence ; amélioration la plus rentable ; boss bloquant ; contenu optionnel ; sinon l'objectif
// simple du moment (prochain boss). Chaque conseil : { id, text, tab?, view?, action? }.
// `ctx` permet de partager des calculs déjà faits (claims, betterItem) avec les pastilles.
export function nextAction(state, ctx = {}, balance = BALANCE) {
  if (state.dungeon) return { id: 'mode-dungeon', text: 'Donjon en cours', tab: 'dungeons' };
  if (state.tower) return { id: 'mode-tower', text: 'Tour en cours', tab: 'tower' };
  if (state.challenge) return { id: 'mode-challenge', text: 'Défi en cours', tab: 'dungeons' };
  const claims = (ctx.claims ?? claimables(state, Date.now(), balance)).filter((c) => !c.blocked);
  if (claims.length) return { id: 'claim', text: claims.length > 1 ? `Tout récupérer (${claims.length})` : `Récupérer : ${claims[0].label}`, action: 'claim-everything', tab: claims[0].tab };
  const better = ctx.betterItem !== undefined ? ctx.betterItem : betterItem(state, balance);
  if (better) return { id: 'equip', text: `Équipez : ${better.name}`, tab: 'inventory', view: { invTab: 'bag', selectedItemId: better.id } };
  const points = skillPointsAvailable(state);
  if (points >= 1) return { id: 'skills', text: `${points} point${points > 1 ? 's' : ''} de compétence à dépenser`, tab: 'skills' };
  const best = bestUpgrade(state, balance);
  const blocking = state.bossRetry && state.stage === state.bossRetry.stage - 1 ? bossRetryPct(state, balance) : null;
  // Boss trop fort : on propose d'abord ce qui le fait tomber (amélioration abordable), puis de le retenter.
  if (best && state.gold >= best.cost) return { id: 'upgrade', text: blocking !== null ? 'Améliorer les dégâts' : `Améliorer : ${balance.upgrades[best.key].label}`, tab: 'upgrades' };
  if (blocking !== null) {
    if (blocking < 70 && canRebirth(state) && !rebirthBlocked(state) && rebirthGain(state) >= 0.5) {
      return { id: 'rebirth', text: `Renaissance : ×${formatMult(PRESTIGE.rebirthMultiplier ** rebirthGain(state))} pour toujours`, tab: 'tree', view: { treeSeg: 'rebirth' } };
    }
    return { id: 'retry', text: blocking >= 100 ? 'Retenter le boss (prêt)' : `Retenter le boss (${blocking} %)`, action: 'retry-boss' };
  }
  if (TALENTS.some((t) => (state.talents[t.id] ?? 0) < t.max && talentUnlocked(state, t) && state.fragments >= talentCost(t, state.talents[t.id] ?? 0))) {
    return { id: 'talent', text: 'Talent à apprendre', tab: 'tree', view: { treeSeg: 'tree' } };
  }
  if (towerUnlocked(state) && climbsLeft(state) > 0) return { id: 'tower', text: 'Ascension de la Tour disponible', tab: 'tower' };
  if (challengeUnlocked(state) && challengeTriesLeft(state) > 0) return { id: 'challenge', text: 'Défi de la semaine disponible', tab: 'dungeons' };
  if (state.keys > 0 && DUNGEONS.some((d) => canEnterDungeon(state, d.id))) return { id: 'dungeon', text: `${state.keys} clé${state.keys > 1 ? 's' : ''} : faire un donjon`, tab: 'dungeons' };
  if (availableForExpedition(state).length && state.expeditions.slots.some((x) => !x)) return { id: 'expedition', text: 'Envoyer un compagnon en expédition', tab: 'expeditions' };
  if (state.tickets > 0 && (state.records.bossesDefeated ?? 0) > 0) return { id: 'summon', text: `Invoquer (${state.tickets} ticket${state.tickets > 1 ? 's' : ''})`, tab: 'summon' };
  if (!state.autoAdvance && !state.farmBoss) return { id: 'advance', text: 'Reprendre l\'avance', action: 'advance' };
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

// Aide « ? » de chaque panneau : les règles en quelques lignes.
export const PANEL_HELP = {
  upgrades: 'L\'or achète des améliorations. Dégâts et Points de vie gagnent ×1,35/×1,4 tous les 10 niveaux et ×1,75 tous les 25 niveaux : visez ces paliers. « Max » achète tout ce que vous pouvez.',
  inventory: 'La flèche verte marque un objet meilleur que celui porté. Les objets grandissent avec leur niveau : réaffûtez-les (Forge) pour les remettre au niveau de votre étape. Recyclage et fusion automatiques se règlent ici.',
  hero: 'La fiche du héros détaille chaque source de bonus. La Puissance résume dégâts × robustesse ; la prévision du prochain boss simule le vrai combat.',
  summon: 'Gemmes et tickets s\'obtiennent en jouant. La bannière de la semaine augmente les chances d\'un SSR. Garanties : Épique au plus tard toutes les 10 invocations, Légendaire toutes les 60.',
  skills: 'Un point par niveau du héros. Les compétences se lancent toutes seules (barre « Compétences » en haut à gauche de la scène). À ne pas confondre avec les boosts (Améliorer → Boosts), qui se lancent d\'un clic en haut à droite de la scène ou avec Q W E R T.',
  tree: 'Plus de 500 talents permanents, achetés avec les fragments anciens (Renaissance, donjons, Tour, défi, expéditions). Un talent s\'apprend dès qu\'un voisin est appris ; cliquez un talent lointain puis « Chemin » pour apprendre la route la moins chère. Les clés de voûte demandent des points dans leur région. La Renaissance remet l\'étape à 1 mais multiplie dégâts, PV et or ×1,5 pour toujours.',
  campaign: 'Chaque monde a 20 étapes et 4 boss. Si un boss vous bat, le chevalier refarme l\'étape d\'avant et le retente quand il est 15 % plus fort (ou bouton « Retenter le boss »).',
  dungeons: 'Une clé par expédition. Facile = sous votre étape max ; réussir une difficulté débloque la suivante, donjon par donjon. En haut : le défi de la semaine (3 tentatives, règles qui changent chaque lundi, sans clé).',
  companions: 'Deux compagnons et un familier. Leurs rôles forment des synergies (bonus + effets visuels). Améliorez-les avec l\'or. Ceux qui restent sur le banc partent en expédition (1 h, 4 h, 12 h, même jeu fermé) et rapportent or, matériaux, gemmes, clés et fragments.',
  tower: 'Une ascension par semaine (lundi). Un boss par étage ; récompenses au meilleur étage de la semaine et à chaque record absolu. La tour s\'effondre après 10 h de combat (chaque nouvel étage rajoute un peu de temps).',
  boss: 'Chaque méga boss vaincu donne un pouvoir ancestral ; les collections rapportent des récompenses.',
  encyclopedia: 'Tout ce que vous rencontrez ou obtenez s\'y inscrit : monstres (et leurs variantes Élite et Mutée), boss, mutations, chaque équipement dans chaque rareté, compagnons et familiers. Cliquez une case pour sa fiche ; les « ??? » restent à découvrir. Le pourcentage de complétion débloque des paliers de récompenses.',
  contracts: 'Missions quotidiennes, hebdomadaires et mensuelles, contrats et hauts faits (bonus permanents). « Tout récupérer » ou la touche G.',
  inbox: 'Coffres, marchands et gemmes trouvés pendant le farm attendent ici.',
  options: 'Sauvegarde, langue, son, mises à jour et codes secrets.',
};
