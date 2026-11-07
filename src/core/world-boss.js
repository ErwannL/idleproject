// v9.2.9 : World Boss de l'Expédition des Anciens — un vrai combat (60 s) avec le moteur de la campagne.
// Le combat tourne sur une COPIE de l'état du joueur (rien de ce qui s'y passe n'est gardé : ni or, ni objets, ni
// missions) avec le mode `worldBossRun` de core/combat.js : héros, compagnons et familier frappent avec leurs vraies
// statistiques et compétences ; le boss est immortel pour le moteur, et ce module tient sa barre de PV « virtuelle » :
//   - PV du boss du jour (fixés à la première tentative du jour, d'après la puissance mesurée de l'équipe) ;
//   - 3 phases par paliers de PV (75 / 50 / 25 %) : attaque spéciale, boss plus rapide et plus fort, changement visuel ;
//   - barre vidée : le boss se relève (« Éveil »), barre pleine, phases remises à zéro, il frappe plus fort ;
//   - paliers de récompense : 25 / 50 / 75 / 100 % de la barre pendant la tentative.
// Le hasard vient d'une graine (jour + numéro de tentative) : même équipe, même graine → même score. C'est ce qui
// permettra à un serveur de recalculer une tentative (voir « Coopératif » plus bas).
//
// Coopératif (pas encore fait, à brancher plus tard) :
//   1. serveur : PV du boss PARTAGÉS par tous les joueurs (somme des dégâts du jour de chacun), remis à zéro chaque jour ;
//      `bossHpForDay()` serait remplacé par la valeur du serveur, `progress()` lirait les dégâts cumulés de tous ;
//   2. envoi du score : `attemptReport()` donne { event, day, attempt, seed, damage, team, power } ; le serveur peut le
//      vérifier en rejouant la tentative (graine + instantané des stats) ou au moins le borner par la puissance ;
//   3. classement du jour et de l'événement (dégâts cumulés par joueur), récompenses de paliers COMMUNS (paliers de PV
//      du boss partagé atteints par la communauté) en plus des paliers personnels ;
//   4. interface : la carte World Boss affiche déjà « dégâts du jour » et « record » ; il restera la barre commune et
//      le classement (panneau Classement existant).
import { EVENTS } from '../data/economy.js';
import { BOSSES } from '../data/enemies.js';
import { ZONES } from '../data/zones.js';
import { Rng } from './rng.js';
import { createCombat, step } from './combat.js';
import { computeHeroStats } from './stats.js';
import { equippedCompanions } from './companions.js';

const DT = 1 / 60;

// Réglages du combat (le nombre de tentatives et les écus restent dans data/economy.js : EVENTS.grand.worldBoss).
export const WORLD_BOSS = {
  boss: 'demon_king',
  name: 'Roi démoniaque ancestral',
  seconds: 60,
  sizeMul: 2.3, // taille à l'écran (× la taille normale du boss) ; +0,15 par phase
  // Phases : seuil de PV restants, attaque spéciale (part des PV max du héros, jamais mortelle seule), accélération.
  phases: [
    { at: 0.75, id: 'quake', name: 'Séisme infernal', hit: 0.18, speed: 1.15, power: 1.15 },
    { at: 0.5, id: 'meteors', name: 'Pluie de braises', hit: 0.24, speed: 1.3, power: 1.3 },
    { at: 0.25, id: 'fury', name: 'Fureur ancestrale', hit: 0.3, speed: 1.5, power: 1.5 },
  ],
  tiers: [0.25, 0.5, 0.75, 1], // part de la barre vidée pendant la tentative
  hitPct: 0.07, // coup ordinaire du boss : part des PV max du héros (avant armure et Défense)
  attackInterval: 2.4,
  hpFactor: 1.25, // PV du boss du jour = dégâts mesurés en 60 s × hpFactor (une bonne tentative va jusqu'à ~80 %)
  awaken: 1.25, // force du boss à chaque Éveil (barre vidée)
};

// Écus d'une tentative : base + un bonus par palier atteint (au plus = l'ancien forfait, l'économie ne bouge pas).
export function attemptCoins(tiersReached) {
  const total = EVENTS.grand.worldBoss.coinsPerAttempt;
  const per = Math.floor(total / 2 / WORLD_BOSS.tiers.length);
  return total - per * WORLD_BOSS.tiers.length + per * tiersReached;
}

export function bossZone(type = WORLD_BOSS.boss) {
  const i = ZONES.findIndex((z) => !z.gauntlet && (z.bosses.includes(type) || Object.values(z.tierBosses ?? {}).includes(type)));
  return i >= 0 ? i : 0;
}

// Copie de travail de l'état (le combat la modifie : or, expérience, missions… tout est jeté à la fin).
function cloneState(state) {
  return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
}

// Graine d'une tentative (jour + numéro) : reproductible.
export function attemptSeed(dayKey, attempt) {
  let h = 2166136261;
  for (const ch of `${dayKey}#${attempt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Un combat. setup = { seed, maxHp (PV du boss du jour ; 0 = mesure), day, attempt }.
export class WorldBossFight {
  constructor(state, setup = {}) {
    this.setup = setup;
    this.state = cloneState(state);
    const s = this.state;
    // Mode du combat : rien d'autre en cours, compétences automatiques (le héros se bat avec tout ce qu'il a).
    Object.assign(s, { dungeon: null, tower: null, challenge: null, worldRun: null, skillAuto: true });
    s.ui = { ...(s.ui ?? {}), focus: false };
    const stats = computeHeroStats(s);
    const zone = bossZone();
    s.worldBossRun = {
      boss: WORLD_BOSS.boss, zone, level: Math.max(1, s.records?.bestStage ?? s.maxStage ?? s.stage ?? 1),
      bossDamage: stats.maxHp * WORLD_BOSS.hitPct, damage: 0, falls: 0,
    };
    this.run = s.worldBossRun;
    this.world = createCombat(s);
    this.world.bossDelay = 0.6;
    this.world.hero.walking = true;
    this.rng = new Rng(setup.seed ?? 1);
    this.time = 0;
    this.maxHp = setup.maxHp > 0 ? setup.maxHp : 0; // 0 : combat de mesure (aucune phase)
    this.phase = 0; // phases passées dans la barre en cours
    this.layer = 0; // Éveils (barres vidées)
    this.out = []; // événements propres au World Boss : { type: 'phase' | 'awaken', ... } (lus par la scène)
    this.team = equippedCompanions(s).map((c) => c.id);
  }

  get boss() { return this.world.enemies.find((e) => e.worldBoss) ?? null; }
  get damage() { return this.run.damage; }
  get done() { return this.time >= WORLD_BOSS.seconds; }
  get timeLeft() { return Math.max(0, WORLD_BOSS.seconds - this.time); }

  // Barre en cours : PV restants (0..1), Éveils, phases.
  progress() {
    if (!this.maxHp) return { frac: 1, layer: 0, phase: 0, cleared: 0 };
    const cleared = this.run.damage / this.maxHp;
    const layer = Math.floor(cleared);
    return { frac: 1 - (cleared - layer), layer, phase: this.phase, cleared };
  }

  // Un pas de 1/60 s : moteur de combat, puis règles du World Boss (phases, Éveil, coups du boss).
  tick() {
    if (this.done) return;
    this.time += DT;
    step(this.state, this.world, DT, this.rng);
    const boss = this.boss;
    if (!boss) return;
    if (!boss.wbInit) {
      boss.wbInit = true;
      boss.attackInterval = WORLD_BOSS.attackInterval;
      boss.attackTimer = Math.min(boss.attackTimer, WORLD_BOSS.attackInterval);
      boss.baseDamage = boss.damage;
      boss.sizeMul = WORLD_BOSS.sizeMul;
      boss.wbPhase = 0;
    }
    boss.age = 0; // pas de rage du moteur : les phases font monter la pression
    if (!this.maxHp) return;
    const p = this.progress();
    if (p.layer > this.layer) {
      this.layer = p.layer;
      this.phase = 0;
      this.applyPhase(boss);
      this.out.push({ type: 'awaken', layer: this.layer, time: this.time });
    }
    while (this.phase < WORLD_BOSS.phases.length && p.frac <= WORLD_BOSS.phases[this.phase].at) {
      const ph = WORLD_BOSS.phases[this.phase];
      this.phase += 1;
      this.applyPhase(boss);
      // Attaque spéciale : un grand coup sur le héros (jamais mortel seul : 1 PV au moins).
      const stats = this.world.heroStats;
      const hit = stats.maxHp * ph.hit * (WORLD_BOSS.awaken ** this.layer);
      const hero = this.world.hero;
      if (!hero.dead) hero.hp = Math.max(1, hero.hp - hit);
      this.out.push({ type: 'phase', phase: this.phase, id: ph.id, name: ph.name, damage: hit, time: this.time, enemyId: boss.id });
    }
  }

  applyPhase(boss) {
    const ph = WORLD_BOSS.phases[this.phase - 1];
    const awaken = WORLD_BOSS.awaken ** this.layer;
    boss.wbPhase = this.phase;
    boss.wbLayer = this.layer;
    boss.damage = boss.baseDamage * (ph?.power ?? 1) * awaken;
    boss.attackInterval = WORLD_BOSS.attackInterval / (ph?.speed ?? 1);
    boss.sizeMul = WORLD_BOSS.sizeMul + 0.15 * this.phase;
  }

  // Tout le combat d'un coup (« Passer », « Réduire les animations », mesure, tests).
  finish() {
    while (!this.done) this.tick();
    return this.result();
  }

  result() {
    const cleared = this.maxHp ? this.run.damage / this.maxHp : 0;
    const tiers = WORLD_BOSS.tiers.filter((t) => cleared >= t).length;
    return { damage: Math.floor(this.run.damage), cleared, tiers, layer: this.layer, phase: this.phase, falls: this.run.falls, team: this.team };
  }
}

// PV du boss du jour : 60 s de combat mesurées (graine fixe) × hpFactor. Joueur sans équipe : au moins 1.
export function bossHpForDay(state) {
  const probe = new WorldBossFight(state, { seed: 7, maxHp: 0 }).finish();
  return Math.max(1, Math.round(probe.damage * WORLD_BOSS.hpFactor));
}

// Rapport d'une tentative (pour un futur serveur coopératif : voir l'en-tête).
export function attemptReport(eventId, setup, result, state) {
  return {
    event: eventId, day: setup.day, attempt: setup.attempt, seed: setup.seed, damage: result.damage,
    team: result.team, power: Math.round(computeHeroStats(state).combatPower ?? 0),
  };
}

export const worldBossName = () => WORLD_BOSS.name;
export const worldBossDef = () => BOSSES[WORLD_BOSS.boss];
