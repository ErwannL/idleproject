// Aide au joueur (v8.4) : puissance, puissance conseillée pour le prochain boss, conseils « que faire ».
import { BALANCE } from '../data/balance.js';
import { createCombat, heroPower, isBossStage, step } from './combat.js';
import { Rng } from './rng.js';
import { upgradeCost } from './economy.js';
import { isUpgrade } from './inventory.js';
import { skillPointsAvailable } from './skills.js';
import { missionsClaimable } from './missions.js';
import { claimableAchievements } from './achievements.js';
import { canRebirth } from './rebirth.js';
import { climbsLeft, towerUnlocked } from './tower.js';
import { readyExpeditions } from './expeditions.js';
import { challengeTriesLeft, challengeUnlocked } from './challenge.js';
import { DUNGEONS } from '../data/dungeons.js';
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
      if (e.type === 'bossDefeated') return { stage, win: true, bossHpPct: 0, seconds: Math.round(i * dt) };
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

// Conseils, du plus utile au moins utile (au plus 4).
export function advice(state, balance = BALANCE) {
  const out = [];
  const cheapest = Math.min(...['damage', 'vitality'].map((k) => upgradeCost(k, state.upgrades[k], balance)));
  if (state.gold >= cheapest * 10) out.push({ tab: 'upgrades', text: 'Acheter des améliorations (« Max »)' });
  const current = computeHeroStats(state, balance);
  if (state.inventory.some((i) => isUpgrade(state, i, balance, current))) out.push({ tab: 'inventory', text: 'Objet meilleur dans l\'inventaire' });
  if (skillPointsAvailable(state) > 0) out.push({ tab: 'skills', text: 'Points de compétence à dépenser' });
  if (missionsClaimable(state) || claimableAchievements(state).length || state.contracts.some((c) => c.progress >= c.target)) out.push({ tab: 'contracts', text: 'Récompenses prêtes (touche G)' });
  if (TALENTS.some((t) => (state.talents[t.id] ?? 0) < t.max && talentUnlocked(state, t) && state.fragments >= talentCost(t, state.talents[t.id] ?? 0))) out.push({ tab: 'tree', text: 'Talent achetable dans l\'arbre' });
  if (readyExpeditions(state)) out.push({ tab: 'companions', text: 'Expédition terminée : récompense à récupérer' });
  if (towerUnlocked(state) && climbsLeft(state) > 0 && !state.tower && !state.challenge) out.push({ tab: 'tower', text: 'Ascension de la Tour disponible' });
  if (challengeUnlocked(state) && challengeTriesLeft(state) > 0 && !state.challenge && !state.tower && !state.dungeon) out.push({ tab: 'dungeons', text: 'Défi de la semaine disponible' });
  if (state.keys > 0 && DUNGEONS.some((d) => state.maxStage >= d.unlockStage) && !state.dungeon) out.push({ tab: 'dungeons', text: `${state.keys} clé${state.keys > 1 ? 's' : ''} : faire un donjon` });
  if (state.bossRetry && canRebirth(state)) out.push({ tab: 'tree', text: 'Bloqué ? Renaissance = dégâts et or ×1,5' });
  return out.slice(0, 4);
}

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
