// Simulation du combat automatique, à pas fixe et sans dépendance au rendu.
// `state` = données sauvegardées ; `world` = état transitoire du combat (positions, PV, minuteries).
// La simulation émet des événements (world.events) que le rendu et l'interface consomment.
import { noteDeath } from './world-stars.js'; // v9.7.1 (lot 4)
import { BASIC_INTERVAL, BASIC_SHARE, basicKind } from '../data/ally-style.js'; // v9.7.1 (lot A)
import { BALANCE, ESSENCE_SHARDS } from '../data/balance.js';
import { maybeMutate, mutationDamageTaken, mutationOnHit, mutationTick, splitChildren } from './mutations.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { POWER_RULES } from '../data/powers.js';
import { ZONES } from '../data/zones.js';
import { companionSkillMultiplier, companionSkills, dungeonAffinity, dungeonDamageTaken, equippedCompanions } from './companions.js';
import { trackContracts } from './contracts.js';
import { completeDungeon, dungeonById, dungeonKill, failDungeon , dungeonRooms, routeHp } from './dungeon.js';
import { addGold } from './economy.js';
import { rollEvent } from './events.js';
import { collectItem } from './inventory.js';
import { addXp, killXp } from './level.js';
import { generateItem, makeSignatureItem, rarityIndex } from './loot.js';
import { cheatLoot } from './cheats.js';
import { recordBossVictory } from './powers.js';
import { activeSkills, skillCooldown, skillValue } from './skills.js';
import { computeHeroStats, rebirthMultiplier } from './stats.js';
import { applyEnvironment, environmentFor } from './environment.js'; // v9.2.1
import { earlyBoost } from './boost.js';
import { phantomHitPct, rushById, tickRushes } from './rushes.js';
import { recordKill } from './codex.js';
import { activeClass, classRange } from './classes.js';
import { BOSS_MINIONS, BOSS_TRAITS, TRAITS, tickTide, traitAttack, traitDamageTaken } from './boss-traits.js'; // v9.2.0 (monde marin) : Marée
import { DUNGEON_DIFFICULTIES } from '../data/dungeons.js';
import { enemyScaleFactor } from './transcend.js';
import { clearTowerFloor, endTower, towerBoss, towerLevel, towerTimeLeft , towerRule } from './tower.js';
import { endWorldRun, worldEncounter, worldKill, worldTimeLeft } from './banner.js';
import { tickTimes } from './times.js';
import { CHALLENGE, challengeBosses, challengeKill, challengeLevel, challengeRule, challengeTimeUp, clearChallengeWave, endChallenge, isBossWave } from './challenge.js';
import { elementMultiplier, unitElement, zoneElement } from './elements.js'; // v9.3.1 : types
import { RESOURCE_SOURCES } from '../data/progression.js'; // v9.3.3
import { enemyBehavior } from '../data/behaviors.js'; // v9.6.0
import { behaviorHitMult, behaviorTakenMult, teamCounters } from './behaviors.js'; // v9.6.0
import { heroElement } from './companions.js'; // v9.6.1
import { activeMajor } from './inventory.js'; // v9.6.1
import { SEALS, grantSeal, needsSeal, worldClosed } from './seals.js'; // v9.6.2
const ENEMY_WINDUP = 0.25; // v9.1.9 : avance de l'événement « enemyWindup » sur le coup ennemi (s)

const MAX_EVENTS = 300;

// Nombre d'étapes d'un monde (20 par défaut ; le monde 11 en a 10).
export function zoneLength(zone, balance = BALANCE) {
  return zone.stages ?? balance.stages.stagesPerZone;
}

// Position d'une étape : index du monde et étape dans le monde (1..n), quel que soit le cycle.
export function locateStage(stage, balance = BALANCE) {
  let s = (stage - 1) % stagesPerCycle(balance);
  for (let i = 0; i < ZONES.length; i++) {
    const len = zoneLength(ZONES[i], balance);
    if (s < len) return { zone: i, inZone: s + 1 };
    s -= len;
  }
  return { zone: ZONES.length - 1, inZone: 1 };
}

// Première étape (cycle 0) d'un monde.
export function zoneStartStage(zoneIndex, balance = BALANCE) {
  let start = 1;
  for (let i = 0; i < zoneIndex; i++) start += zoneLength(ZONES[i], balance);
  return start;
}

export function isBossStage(stage, balance = BALANCE) {
  const { zone, inZone } = locateStage(stage, balance);
  return Boolean(ZONES[zone].gauntlet) || inZone % balance.stages.bossEvery === 0;
}

// Monde 11 : chaque étape est un méga boss berserk.
export function isGauntletStage(stage, balance = BALANCE) {
  return Boolean(ZONES[locateStage(stage, balance).zone].gauntlet);
}

// Un « cycle » = les 6 mondes. Après le dernier monde, on repart du monde 1 en difficulté ×2, ×3…
export function stagesPerCycle(balance = BALANCE) {
  return ZONES.reduce((sum, z) => sum + (z.stages ?? balance.stages.stagesPerZone), 0);
}

// 0 pour le premier passage, 1 pour la difficulté ×2, etc.
export function cycleForStage(stage, balance = BALANCE) {
  return Math.floor((stage - 1) / stagesPerCycle(balance));
}

export function difficultyForStage(stage, balance = BALANCE) {
  return cycleForStage(stage, balance) + 1;
}

export function zoneIndexForStage(stage, balance = BALANCE) {
  return locateStage(stage, balance).zone;
}

// Étape dans le monde (1..20, ou 1..10 pour le monde 11).
export function stageInZone(stage, balance = BALANCE) {
  return locateStage(stage, balance).inZone;
}

// Rang du boss de l'étape : 'mini' (5), 'mid' (10), 'hard' (15), 'mega' (20), ou null.
export function bossTierForStage(stage, balance = BALANCE) {
  if (!isBossStage(stage, balance)) return null;
  if (isGauntletStage(stage, balance)) return 'mega';
  const s = stageInZone(stage, balance);
  return Object.entries(balance.stages.tiers).find(([, t]) => t.stage === s)?.[0] ?? 'mega';
}

// Adaptation aux Renaissances : multiplicateurs des boss (PV/dégâts) et de leurs récompenses.
export function rebirthHeat(state, balance = BALANCE) {
  const n = state.records?.rebirths ?? 0;
  return { boss: 1 + (balance.stages.rebirthBossPct / 100) * n, reward: 1 + (balance.stages.rebirthRewardPct / 100) * n };
}

// Rang d'un boss d'après sa définition (méga boss par défaut).
export function bossTier(bossId) {
  return BOSSES[bossId]?.tier ?? 'mega';
}

export function zoneForStage(stage, balance = BALANCE) {
  return ZONES[zoneIndexForStage(stage, balance)];
}

// "2-4" = monde 2, étape 4 du monde ; "2-4 ×3" en difficulté ×3.
export function stageLabel(stage, balance = BALANCE) {
  const d = difficultyForStage(stage, balance);
  return `${zoneIndexForStage(stage, balance) + 1}-${stageInZone(stage, balance)}${d > 1 ? ` ×${d}` : ''}`;
}

// v9.6.5 (10.4/7.7) : fin de jeu. Les passages après le dernier monde sont des « Failles » (Faille 1 = ancien ×2),
// chacune avec un bonus d'échos : +10 % d'or et d'éclats par Faille atteinte (record), conservé par les Renaissances.
export function riftOf(stage, balance = BALANCE) { return Math.max(0, difficultyForStage(stage, balance) - 1); }
export function riftName(stage, balance = BALANCE) { const r = riftOf(stage, balance); return r > 0 ? `Faille ${r}` : ''; }
export function riftEchoMult(state, balance = BALANCE) {
  return 1 + 0.1 * riftOf(Math.max(1, state.records?.bestStage ?? state.maxStage ?? 1), balance);
}

// Boss de l'étape : le boss du rang correspondant du monde (méga boss à l'étape 20).
export function bossesForStage(stage, balance = BALANCE) {
  const zone = zoneForStage(stage, balance);
  // Monde 11 : étape n = méga boss du monde n.
  if (zone.gauntlet) return ZONES[stageInZone(stage, balance) - 1].bosses;
  const tier = bossTierForStage(stage, balance);
  return tier && tier !== 'mega' && zone.tierBosses?.[tier] ? [zone.tierBosses[tier]] : zone.bosses;
}

export function enemyDefinition(type, boss) {
  return boss ? ENEMIES[BOSSES[type].base] : ENEMIES[type];
}


// v9.2.0 (monde marin) : niveau de puissance d'une étape (ennemis, butin, or, XP). Un monde peut couvrir moins de
// niveaux que d'étapes (`levels`) et ne pas faire avancer le compteur (`advance: 0`) : le Royaume englouti (20 étapes)
// parcourt les niveaux 201 à 210, comme le Trône de l'Abysse qui le suit. Ainsi, une étape d'avant la 9.2.0 garde
// exactement sa puissance après la migration (même monde, même étape dans le monde).
const zoneLevels = (z, balance) => z.levels ?? zoneLength(z, balance);
export function levelsPerCycle(balance = BALANCE) {
  return ZONES.reduce((sum, z) => sum + (z.advance ?? zoneLevels(z, balance)), 0);
}
export function levelForStage(stage, balance = BALANCE) {
  const n = Math.max(1, Math.floor(Number(stage) || 1));
  const { zone, inZone } = locateStage(n, balance);
  let start = 0;
  for (let i = 0; i < zone; i++) start += ZONES[i].advance ?? zoneLevels(ZONES[i], balance);
  const z = ZONES[zone];
  return cycleForStage(n, balance) * levelsPerCycle(balance) + start + Math.ceil((inZone * zoneLevels(z, balance)) / zoneLength(z, balance));
}

// Étape 4 : ×hpBase atteint progressivement (première minute vive, puis début disputé).
const hpBaseFactor = (n, g) => 1 + ((g.hpBase ?? 1) - 1) * Math.min(1, n / (g.hpBaseRamp ?? 1));

// v9.2.8 : courbe de dégâts en plus de la croissance par étape (balance.enemyScaling.damageCurve) : les PV du héros
// (paliers ×1,4 et ×1,75 des Points de vie) grandissaient bien plus vite que les coups ennemis (18 000 coups
// encaissés à l'étape 443 pour un héros qui achète ses PV, un seul pour celui qui ne les achète pas). Mesures :
// tools/measure-defense-v928.mjs.
export function damageCurve(n, growth = BALANCE.enemyScaling) {
  const c = growth.damageCurve;
  if (!c) return 1;
  const late = c.knee && n > c.knee ? c.lateGrowth ** (n - c.knee) : 1; // au-delà du premier cycle (Renaissances)
  const ramp = c.ramp ? Math.min(1, (n + 1) / c.ramp) : 1; // début de partie épargné (premiers mondes)
  const cycle = c.cycleStep ? (Math.floor(n / levelsPerCycle()) >= 2 ? c.cycleStep : 1) : 1; // marche unique au 3e cycle (difficulté ×3)
  return Math.max(1, c.coef * (n + 1) ** c.exp * late * ramp * cycle);
}

// v9.2.8 : les coups ennemis suivent une part (rebirthPow) du multiplicateur de Renaissance du héros : les PV qu'elle
// donne ne rendent plus le héros intouchable (ses dégâts, eux, en profitent entièrement).
export function rebirthDamage(state, balance = BALANCE) {
  const p = balance.enemyScaling.damageCurve?.rebirthPow ?? 0;
  return p ? rebirthMultiplier(state) ** p : 1;
}

// v9.7.0 (10.1, rythme 4–6 semaines) : après le monde 3, les PV montent un peu plus vite par étape (les trois premiers
// mondes, joués en première session, ne changent pas).
// v9.7.1 (lot 3) : surcroît de PV de la campagne (courbe enemyScaling.campaign rapportée à la courbe commune).
export function campaignHp(n, balance = BALANCE) {
  const g = balance.enemyScaling, c = g.campaign;
  if (!c) return 1;
  const cg = { ...g, ...c };
  return (hpBaseFactor(n, cg) * c.hpGrowth ** n * lateHp(n, cg)) / (hpBaseFactor(n, g) * g.hpGrowth ** n * lateHp(n, g));
}

export function lateHp(n, growth) {
  const l = growth.hpLate;
  return l ? Math.min(l.cap ?? Infinity, l.rate ** Math.max(0, n - l.from)) : 1;
}

export function enemyStats(stage, type, boss, balance = BALANCE) {
  const def = enemyDefinition(type, boss);
  const tier = boss ? balance.stages.tiers[bossTier(type)] : null;
  const growth = balance.enemyScaling;
  const st = balance.stages;
  const n = Math.max(0, stage - 1);
  return {
    hp: Math.round(def.hp * hpBaseFactor(n, growth) * growth.hpGrowth ** n * (boss ? st.bossHpMultiplier * tier.hp : 1)),
    // v9.2.8 : les boss suivent la courbe à une puissance moindre (bossPow) : le mur reste leurs PV et leur rage.
    damage: def.damage * growth.damageGrowth ** n * damageCurve(n, growth) ** (boss ? growth.damageCurve?.bossPow ?? 1 : 1) * (boss ? st.bossDamageMultiplier * tier.damage : 1),
    gold: Math.max(1, Math.round(def.gold * growth.goldGrowth ** n * (boss ? st.bossGoldMultiplier * tier.gold : 1))),
    speed: def.speed,
    attackInterval: def.attackInterval * (boss ? st.bossAttackInterval ?? 1.2 : 1), // v9.2.8 : coups de boss lents et lourds
    range: def.range + (boss ? 8 : 0),
  };
}

// Or d'un ennemi ordinaire de référence à une étape (sert d'unité pour les coûts et récompenses).
// Essences (matériau rare) lâchées par un boss : 2, +1 par zone.
export function bossEssence(stage, balance = BALANCE) {
  return balance.loot.bossEssence + zoneIndexForStage(stage, balance) + ZONES.length * cycleForStage(stage, balance);
}

export function referenceKillGold(stage, balance = BALANCE) {
  return enemyStats(Math.max(1, stage), 'slime', false, balance).gold;
}

// Rencontre en cours : campagne (étape) ou donjon (salle).
export function currentEncounter(state, balance = BALANCE) {
  // v9.1.3 (doc4 lot 6) : mode monde (un mode à part : ZONES ne bouge pas, la campagne ne se décale pas).
  if (state.worldRun) return worldEncounter(state);
  // v9.2.9 : World Boss de l'Expédition des Anciens (core/world-boss.js) : un seul boss géant, immortel pour le moteur
  // (les PV affichés et les phases sont tenus par world-boss.js à partir des dégâts comptés ici).
  if (state.worldBossRun) {
    const run = state.worldBossRun;
    return { level: run.level, boss: true, enemies: [], bosses: [run.boss], killsNeeded: 1, zoneIndex: run.zone, dungeon: null, worldBoss: true };
  }
  if (state.tower) {
    // Tour de l'Éternité : un boss par étage, décor qui change tous les 10 étages.
    const floor = state.tower.floor;
    return {
      level: towerLevel(state, floor), boss: true, enemies: [], bosses: [towerBoss(floor)],
      killsNeeded: 1, zoneIndex: Math.floor((floor - 1) / 10) % (ZONES.length - 1), dungeon: null, tower: true,
    };
  }
  if (state.challenge) {
    // Défi de la semaine (v8.5) : vagues dans le monde de la semaine, un boss toutes les 5 vagues.
    const run = state.challenge;
    const zone = ZONES[run.zone];
    const boss = isBossWave(state);
    return {
      level: challengeLevel(state, run.wave), boss, enemies: zone.enemies, bosses: boss ? challengeBosses(state) : zone.bosses,
      killsNeeded: boss ? 1 : CHALLENGE.killsPerWave, zoneIndex: run.zone, dungeon: null, challenge: true,
    };
  }
  if (state.dungeon) {
    const d = dungeonById(state.dungeon.id);
    return {
      level: state.dungeon.level, boss: state.dungeon.room >= dungeonRooms(state, d), enemies: d.enemies, bosses: [d.boss],
      killsNeeded: d.killsPerRoom, zoneIndex: d.zone, dungeon: d,
    };
  }
  const zone = zoneForStage(state.stage, balance);
  return {
    // v9.2.0 (monde marin) : niveau de puissance de l'étape (identique à l'étape hors du Royaume englouti, cycle 1).
    level: levelForStage(state.stage, balance), boss: isBossStage(state.stage, balance), enemies: zone.enemies,
    bosses: bossesForStage(state.stage, balance),
    killsNeeded: balance.stages.killsPerStage, zoneIndex: zoneIndexForStage(state.stage, balance), dungeon: null,
    // Monde 11 : le méga boss (berserk) invoque les boss 5/10/15 de son monde quand ses PV baissent.
    gauntlet: Boolean(zone.gauntlet),
    summons: zone.gauntlet ? Object.values(ZONES[stageInZone(state.stage, balance) - 1].tierBosses ?? {}) : [],
  };
}

// v9.2.1 : malus d'environnement de la rencontre en cours (campagne, donjons et défi de leur monde ; ni la Tour ni le
// mode monde, qui ont leurs propres règles). Le cycle de difficulté ne compte qu'en campagne.
export function currentEnvironment(state, balance = BALANCE) {
  if (state.tower || state.worldRun || state.worldBossRun) return null; // v9.2.9 : ni le World Boss
  const enc = currentEncounter(state, balance);
  const campaign = !enc.dungeon && !enc.challenge;
  return environmentFor(state, enc.zoneIndex, campaign ? difficultyForStage(state.stage, balance) : 1);
}

export function createCombat(state, balance = BALANCE) {
  const stats = computeHeroStats(state, balance);
  return {
    time: 0,
    nextEnemyId: 1,
    enemies: [],
    hero: { hp: stats.maxHp, attackTimer: 0.3, dead: false, respawnTimer: 0, walking: true },
    heroStats: stats,
    spawnTimer: 0.5,
    bossDelay: balance.stages.bossSpawnDelaySeconds,
    scroll: 0,
    skillTimers: {}, // compétences : temps restant avant le prochain lancement
    companionTimers: {},
    buffs: { cry: 0, cryPct: 0, shield: 0, shieldPct: 0 },
    pendingElite: false,
    goldWave: 0, // ennemis restants de la vague spéciale (or doublé)
    events: [],
    recordEvents: true,
    counters: { gold: 0, kills: 0, drops: 0, xp: 0, damage: {} },
  };
}

function emit(world, type, data = {}) {
  if (!world.recordEvents) return;
  world.events.push({ type, time: world.time, ...data });
  if (world.events.length > MAX_EVENTS) world.events.splice(0, world.events.length - MAX_EVENTS);
}

// Mode berserk (monde 11) : PV, dégâts et vitesse d'attaque augmentés.
function applyBerserk(s, balance) {
  const b = balance.stages.berserk;
  s.hp *= b.hp;
  s.damage *= b.damage;
  s.attackInterval /= b.speed;
  s.gold *= b.gold;
}

// Un méga boss berserk appelle un de ses boss (mini, moyen, dur) à chaque palier de PV perdus.
function summonMinion(state, world, master, balance, enc) {
  const type = master.summons.shift();
  if (!type) return;
  const s = enemyStats(enc.level, type, true, balance);
  applyBerserk(s, balance);
  const entropy = enemyScaleFactor(state, enc.level, balance);
  s.hp *= entropy.hp;
  s.damage *= entropy.damage;
  const heat = rebirthHeat(state, balance);
  const minion = {
    id: world.nextEnemyId++, type, boss: true, summoned: true, elite: false, berserk: true,
    x: master.x - 4, hp: s.hp * heat.boss, maxHp: s.hp * heat.boss, damage: s.damage * heat.boss, gold: s.gold * heat.reward,
    speed: s.speed, attackInterval: s.attackInterval, attackTimer: s.attackInterval * 0.6, range: s.range, engaged: false, age: 0, summons: [],
  };
  // Il se place devant son maître pour le protéger.
  world.enemies.unshift(minion);
  emit(world, 'bossSummon', { enemyId: minion.id, kind: type, master: master.type });
}

function spawnEnemy(state, world, rng, balance, enc, elite = false) {
  const boss = enc.boss && !elite;
  const type = rng.pick(boss ? enc.bosses : enc.enemies);
  const s = enemyStats(enc.level, type, boss, balance);
  if (!enc.world && !enc.worldBoss) s.hp = Math.round(s.hp * lateHp(Math.max(0, enc.level - 1), balance.enemyScaling)); // v9.7.0 (10.1)
  if (!enc.world && !enc.worldBoss && !enc.dungeon && !state.tower && !state.challenge) s.hp = Math.round(s.hp * campaignHp(Math.max(0, enc.level - 1), balance)); // v9.7.1 (lot 3)
  if (boss && enc.gauntlet) applyBerserk(s, balance);
  if (enc.dungeon) {
    // Donjons : bien plus durs que la campagne, selon la difficulté choisie.
    const diff = DUNGEON_DIFFICULTIES[state.dungeon?.difficulty] ?? DUNGEON_DIFFICULTIES.easy;
    s.hp *= diff.hp;
    s.damage *= diff.damage;
  }
  // Transcendance « Entropie » : ennemis qui grandissent moins vite.
  const entropy = enemyScaleFactor(state, enc.level, balance);
  s.hp *= entropy.hp;
  s.damage *= entropy.damage * rebirthDamage(state, balance); // v9.2.8
  if (enc.challenge) {
    s.hp *= challengeRule(state, 'enemyHp') ?? 1;
    s.damage *= challengeRule(state, 'enemyDamage') ?? 1;
    s.attackInterval /= challengeRule(state, 'enemyAttackSpeed') ?? 1;
  }
  // v9.1.3 (doc4 lot 6) : paliers du boss du monde (×0,6 à ×1,3 des PV du boss de l'étape record).
  if (enc.world) s.hp *= enc.hpMult ?? 1;
  if (boss) {
    // Les boss s'adaptent aux Renaissances : plus durs, mais plus généreux.
    const heat = rebirthHeat(state, balance);
    s.hp *= heat.boss;
    s.damage *= heat.boss;
    s.gold *= heat.reward;
  }
  const e = balance.events;
  const enemy = {
    id: world.nextEnemyId++,
    type,
    boss,
    elite,
    // v9.3.9 : à l'écran, l'ennemi naît juste derrière le bord droit (world.viewEdgeX, donné par le rendu) et marche
    // à vitesse constante ; jamais plus loin qu'avant. Sans rendu (hors ligne, tests) : point d'apparition d'origine.
    x: Math.min(balance.world.spawnX, world.viewEdgeX ?? Infinity) + (boss ? 10 : 0),
    hp: s.hp * (elite ? e.eliteHpMultiplier : 1),
    maxHp: s.hp * (elite ? e.eliteHpMultiplier : 1),
    damage: s.damage * (elite ? 1.5 : 1),
    gold: s.gold * (elite ? e.eliteGoldMultiplier : 1),
    speed: s.speed,
    attackInterval: s.attackInterval,
    attackTimer: s.attackInterval * 0.6,
    behavior: boss ? null : enemyBehavior(type), // v9.6.0 (6) : comportement (parade à préparer)
    range: s.range + (elite ? 4 : 0),
    engaged: false,
    age: 0, // secondes au contact (rage des boss)
    berserk: Boolean(boss && enc.gauntlet),
    summons: boss && enc.gauntlet ? [...enc.summons] : [],
    element: zoneElement(enc.zoneIndex), // v9.3.1 : type de l'ennemi (celui de son monde)
    trait: boss ? BOSS_TRAITS[type] ?? null : null, // v9.0.6 : mécanique du boss (core/boss-traits.js)
  };
  // v9.1.3 (doc4 lot 6) : score — boss qui ne meurt pas (60 s, score = dégâts infligés), sans mécanique d'invocation.
  if (boss && enc.score) Object.assign(enemy, { hp: 1e300, maxHp: 1e300, trait: null, scoreTarget: true });
  // v9.2.9 : World Boss : immortel pour le moteur, coups réglés par world-boss.js (phases), sans mécanique de trait.
  if (boss && enc.worldBoss) Object.assign(enemy, { hp: 1e300, maxHp: 1e300, trait: null, worldBoss: true, damage: state.worldBossRun.bossDamage, x: balance.world.heroX + balance.world.meleeOffset + enemy.range }); // surgit sur place (render/world-boss-scene.js)
  if (enemy.trait === 'summoner' || enemy.trait === 'swarm') enemy.summonTimer = TRAITS[enemy.trait].every / 2;
  // v9.0.4 : ennemis mutés (campagne, donjons, défi ; jamais dans la Tour).
  const mutation = !boss && !elite && !enc.tower ? maybeMutate(state, enemy, rng) : null;
  // v9.6.2 (7.1) : règle de la Tour en cours (PV, dégâts).
  const tr = state.tower ? towerRule(state) : null;
  if (tr?.hp) { enemy.hp *= tr.hp; enemy.maxHp *= tr.hp; }
  if (tr?.damage) enemy.damage *= tr.damage;
  if (state.dungeon && !boss) { const k = routeHp(state); enemy.hp *= k; enemy.maxHp *= k; } // v9.6.2 : itinéraire de donjon
  world.enemies.push(enemy);
  emit(world, boss ? 'bossSpawn' : elite ? 'eliteSpawn' : 'spawn', { enemyId: enemy.id, kind: type });
  if (mutation) emit(world, 'mutantSpawn', { enemyId: enemy.id, kind: type, mutation: mutation.id });
}

export function changeStage(state, world, stage, balance = BALANCE) {
  let target = Math.max(1, Math.min(stage, state.maxStage));
  if (needsSeal(state, target, balance)) target = Math.max(1, target - 1); // v9.6.2 : porte scellée
  const zoneChanged = zoneIndexForStage(target, balance) !== zoneIndexForStage(state.stage, balance);
  state.stage = target;
  state.kills = 0;
  resetWave(world, balance);
  emit(world, 'stage', { stage: target, zoneChanged, boss: isBossStage(target, balance) });
}

// Les ennemis restants quittent la scène (nouvelle étape, entrée ou sortie de donjon).
export function resetWave(world, balance = BALANCE) {
  world.enemies = [];
  world.spawnTimer = 0.8;
  world.bossDelay = balance.stages.bossSpawnDelaySeconds;
}

// Relance la progression après un échec (ou une pause du joueur).
export function resumeAdvance(state, world, balance = BALANCE) {
  state.autoAdvance = true;
  if (state.stage < state.maxStage) changeStage(state, world, state.stage + 1, balance);
}

function clearStage(state, world, balance) {
  trackContracts(state, 'stages', 1);
  const next = state.stage + 1;
  if (next > state.maxStage) {
    state.maxStage = next;
    state.recordAt = state.playSeconds ?? 0; // v9.3.8 : temps de jeu du dernier record (le guide repère un ralentissement)
    if (next > (state.records.bestStage ?? 0)) state.records.bestStage = next; // v9.1.0 : jamais remis à zéro
    // Nouvelle étape (et nouveau monde) : quelques gemmes.
    const newWorld = stageInZone(next, balance) === 1;
    const gems = balance.gems.newStage + (newWorld ? balance.gems.newWorld : 0);
    state.gems += gems;
    emit(world, 'unlock', { stage: next, gems });
  }
  if (!state.autoAdvance) return;
  // v8.4 : après une défaite contre ce boss, on ne le retente tout seul que nettement plus fort
  // (+15 % de puissance) — sinon on refarme l'étape précédente (bouton « Retenter le boss » à tout moment).
  const retry = state.bossRetry;
  if (retry && next === retry.stage && heroPower(state, balance) < retry.power * balance.stages.bossRetryPower) {
    state.kills = 0;
    return;
  }
  if (retry && next === retry.stage) state.bossRetry = null;
  if (worldClosed(next)) { state.kills = 0; if (!world.closedNotified) { world.closedNotified = true; emit(world, 'worldClosed', { stage: next }); } return; } // v9.6.5 (10.3)
  // v9.6.2 (7.6) : boss de fin de monde scellé — on refarme l'étape d'avant ; après 15 min, le sceau est accordé.
  if (needsSeal(state, next, balance)) {
    state.sealWait = (state.sealWait ?? 0) + 1;
    state.sealSince ??= state.playSeconds ?? 0;
    if ((state.playSeconds ?? 0) - state.sealSince < SEALS.waitSeconds) { state.kills = 0; return; }
    const z = grantSeal(state, balance);
    if (z !== null) emit(world, 'sealEarned', { zone: z, by: 'wait' });
  }
  state.sealSince = undefined;
  changeStage(state, world, next, balance);
}

// Puissance globale (dégâts × robustesse) : sert à décider quand retenter un boss.
// v9.2.8 : part des dégâts d'un coup ennemi qui passe : armure en % (percée de 40 % par les boss), puis Défense
// (réduction à rendement décroissant, voir stats.js defenseReduction ; percée de la même façon par les boss).
export function damageTakenFactor(stats, boss, balance = BALANCE, extraArmor = 0) {
  const pierce = boss ? 1 - balance.stages.bossArmorPierce : 1;
  const armor = Math.min(balance.hero.armorCapPct, (stats.armor ?? 0) + extraArmor) * pierce;
  return (1 - armor / 100) * (1 - ((stats.defenseReductionPct ?? 0) * pierce) / 100);
}

// v9.2.8 : coups encaissés à PV pleins (sans régénération ni esquive) contre un ennemi ordinaire moyen de l'étape et
// contre le boss de la prochaine étape de boss (rang compris, Renaissances comprises), malus du monde compris.
// Sert à la fiche du héros, à la ligne « Points de vie » et à tools/measure-defense-v928.mjs.
export function hitsToFall(state, stage = state.stage, balance = BALANCE) {
  const s0 = { ...state, stage, dungeon: null, tower: null, challenge: null, worldRun: null };
  const stats = applyEnvironment(computeHeroStats(s0, balance), currentEnvironment(s0, balance));
  const zone = zoneForStage(stage, balance);
  const level = levelForStage(stage, balance);
  const ent = enemyScaleFactor(state, level, balance);
  const hurt = dungeonDamageTaken(s0, balance) * (stats.hurtMult ?? 1) * rebirthDamage(state, balance);
  const normalDmg = zone.enemies.reduce((a, t) => a + enemyStats(level, t, false, balance).damage, 0) / zone.enemies.length;
  let bs = stage; while (!isBossStage(bs, balance)) bs += 1;
  const bLevel = levelForStage(bs, balance);
  const heat = rebirthHeat(state, balance).boss;
  const bosses = bossesForStage(bs, balance);
  const berserk = zoneForStage(bs, balance).gauntlet ? balance.stages.berserk.damage : 1;
  const bossDmg = Math.max(...bosses.map((b) => enemyStats(bLevel, b, true, balance).damage)) * heat * berserk * enemyScaleFactor(state, bLevel, balance).damage;
  const normalHit = normalDmg * ent.damage * damageTakenFactor(stats, false, balance) * hurt;
  const bossHit = bossDmg * damageTakenFactor(stats, true, balance) * hurt;
  return { normal: stats.maxHp / normalHit, boss: stats.maxHp / bossHit, normalHit, bossHit, bossStage: bs, maxHp: stats.maxHp };
}

export function heroPower(state, balance = BALANCE) {
  const s = computeHeroStats(state, balance);
  return s.dps * Math.min(s.effectiveHp, s.maxHp / 0.05); // v9.2.8 : PV effectifs (armure et Défense)
}

function gainGold(state, world, amount) {
  const gold = addGold(state, amount * comboBonus(world)); // v9.7.1 (lot 2) : enchaînement
  world.counters.gold += gold;
  trackContracts(state, 'gold', gold);
  return gold;
}

function dropItem(state, world, item, x, balance, enemyId = null) {
  world.counters.drops += 1;
  const result = collectItem(state, item, balance);
  if (rarityIndex(item.rarity) >= 1) trackContracts(state, 'rareLoot', 1);
  emit(world, 'drop', { item, x, enemyId, bagged: Boolean(result.bagged), autoRecycled: Boolean(result.recycled) && !result.mannequin, stored: Boolean(result.stored || result.held), byRule: Boolean(result.auto), mannequin: Boolean(result.mannequin), museum: Boolean(result.museum), recycledGold: result.recycledGold, freed: result.freed?.count ? result.freed : null });
}

// v9.6.0 (6) : Soigneur (soigne sa vague 3 % des PV max par seconde) et Kamikaze (explose 1,5 s après son arrivée :
// 12 % des PV du héros, moitié avec un compagnon Gardien ; il disparaît comme un monstre vaincu, or compris).
function behaviorTick(state, world, dt, rng, balance) {
  // v9.6.3 (5.3) : boss en phases — toutes les 8 s il annonce une attaque lourde (son prochain coup ×2,5), puis reste
  // affaibli 3 s (+50 % de dégâts reçus) : le bon moment pour une compétence manuelle (le bouton brille).
  for (const e of world.enemies) {
    if (!e.boss || !(e.engaged || e.arrived)) continue;
    e.phaseT = (e.phaseT ?? 0) + dt;
    if (e.phaseT >= 8) { e.phaseT = 0; e.heavy = true; world.guard = { enemyId: e.id, until: world.time + GUARD_WINDOW }; emit(world, 'bossHeavy', { enemyId: e.id, x: e.x }); }
  }
  for (const e of world.enemies) {
    if (e.arrived && e.arrivedAt === undefined) e.arrivedAt = world.time;
    if (e.behavior === 'healer' && !world.parries?.healer && e.hp > 0) {
      for (const o of world.enemies) if (o !== e && !o.boss && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.03 * dt);
    }
  }
  const boom = world.enemies.filter((e) => e.behavior === 'kamikaze' && (e.engaged || e.arrived) && !e.exploded && (e.arrivedAt ?? world.time) <= world.time - 1.5);
  if (!boom.length || world.hero.dead) return;
  const stats = world.heroStats ?? computeHeroStats(state, balance);
  for (const e of boom) {
    e.exploded = true;
    const hit = stats.maxHp * 0.12 * (world.parries?.kamikaze ? 0.5 : 1);
    world.hero.hp -= hit;
    emit(world, 'heroHit', { damage: hit, enemyId: e.id, x: e.x, boss: false, explode: true });
    emit(world, 'kamikaze', { enemyId: e.id, x: e.x });
    killEnemy(state, world, e, rng, balance, stats, currentEncounter(state, balance));
  }
  if (world.hero.hp <= 0) heroDies(state, world, balance);
}

function killEnemy(state, world, enemy, rng, balance, stats, enc) {
  const index = world.enemies.indexOf(enemy);
  if (index < 0) return;
  world.enemies.splice(index, 1);
  // v9.0.4 : un ennemi muté « scissipare » laisse deux doubles à sa place.
  const children = splitChildren(enemy, world.nextEnemyId);
  if (children.length) {
    world.nextEnemyId += children.length;
    world.enemies.splice(index, 0, ...children);
    emit(world, 'mutantSplit', { enemyId: enemy.id, kind: enemy.type, x: enemy.x, children: children.map((c) => c.id) }); // v9.2.5 : doubles cachés jusqu'à l'atterrissage
  }

  const wave = world.goldWave > 0 && !enemy.boss ? balance.events.waveGoldMultiplier : 1;
  if (world.goldWave > 0 && !enemy.boss) world.goldWave -= 1;
  const boost = earlyBoost(state, balance);
  const challengeGold = enc.challenge ? challengeRule(state, 'gold') ?? 1 : 1;
  // v9.6.0 : Voleur vaincu dans les 7 s après son arrivée : or ×3.
  const thief = enemy.behavior === 'thief' && (enemy.arrivedAt === undefined || world.time - enemy.arrivedAt <= 7) ? 3 : 1;
  const gold = gainGold(state, world, enemy.gold * (1 + stats.goldPct / 100) * (stats.goldMult ?? 1) * wave * boost.gold * challengeGold * thief);
  world.counters.kills += 1;
  if (world.major === 'killHeal' && !world.hero.dead) world.hero.hp = Math.min(stats.maxHp, world.hero.hp + stats.maxHp * 0.03); // v9.6.1 : Festin
  state.records.kills += 1;
  if (state.codex) recordKill(state, enemy.type, enemy);
  trackContracts(state, 'kills', 1);

  const xp = killXp(enc.level, enemy.boss || enemy.elite, balance) * (1 + stats.xpPct / 100) * boost.xp;
  world.counters.xp += xp;
  const levels = addXp(state, xp * comboBonus(world), balance); // v9.7.1 (lot 2) : enchaînement
  if (levels > 0) {
    state.gems += levels * balance.gems.levelUp;
    emit(world, 'levelUp', { level: state.level, gems: levels * balance.gems.levelUp });
  }
  if (!enemy.boss && rng.next() < balance.gems.killChance) {
    const [lo, hi] = balance.gems.killAmount;
    const gems = lo + Math.floor(rng.next() * (hi - lo + 1));
    state.gems += gems;
    emit(world, 'gems', { gems, x: enemy.x });
  }
  emit(world, 'kill', { enemyId: enemy.id, kind: enemy.type, boss: enemy.boss, elite: enemy.elite, gold, x: enemy.x });

  // Butin : objet signature possible sur les boss (butin ciblé), objet Rare+ garanti sur les boss et élites.
  // v9.1.9 : butin courant (monstre ordinaire) × dropScale, tiré avec dropRarityWeights (moins d'objets, mieux rangés).
  const common = !(enemy.boss || enemy.elite || enemy.mutation);
  const dropChance = !common ? 1 : (balance.loot.dropChance + stats.bonus.dropChance / 100 + boost.dropChance) * (balance.loot.dropScale ?? 1);
  // v9.1.9 : éclat de compensation (moins d'objets courants à recycler).
  if (common && balance.loot.killShardChance && rng.next() < balance.loot.killShardChance) state.materials.shards += 1;
  if (rng.next() < dropChance) {
    // v9.0.6 : boss réaffronté (boucle, étape déjà franchie) → objet ancestral 5 fois plus rare.
    const farmed = enemy.boss && (Boolean(state.farmBoss) || enc.world || (!enc.dungeon && !enc.tower && !enc.challenge && state.stage < state.maxStage));
    const signature = enemy.boss && rng.next() < balance.loot.signatureChance * (farmed ? 0.2 : 1)
      ? makeSignatureItem(state, enemy.type, enc.level, rng, balance) : null;
    const base = enemy.boss || enemy.elite ? balance.loot.bossMinRarity : 'common';
    const luck = cheatLoot(state).minRarity;
    const minRarity = luck && rarityIndex(luck) > rarityIndex(base) ? luck : base;
    const item = signature ?? generateItem(state, rng, { level: enc.level, minRarity, setZone: enc.tower ? null : enc.zoneIndex, weights: common ? balance.loot.dropRarityWeights : null }, balance);
    dropItem(state, world, item, enemy.x, balance, enemy.id); // v9.2.2 : le rendu part de la position réelle à la mort
  }

  if (enemy.elite) {
    state.gems += balance.events.eliteGems;
    emit(world, 'eliteDefeated', { gems: balance.events.eliteGems });
  } else if (!enemy.boss && !enc.dungeon && !enc.tower && !enc.challenge && !enc.world) {
    const event = rollEvent(state, world, rng, balance, boost.events);
    if (event) emit(world, 'worldEvent', { eventType: event.type });
  }

  if (enemy.summoned) {
    // Boss invoqué (monde 11) : gemmes, sans terminer l'étape.
    const gems = Math.round(balance.stages.tiers[bossTier(enemy.type)].gems * rebirthHeat(state, balance).reward);
    state.gems += gems;
    emit(world, 'gems', { gems, x: enemy.x });
    emit(world, 'bossDefeated', { kind: enemy.type, stage: enc.level, summoned: true });
    return;
  }
  if (enemy.boss) {
    // Méga boss berserk vaincu : ses invocations s'effondrent avec lui.
    if (enemy.berserk) world.enemies = world.enemies.filter((e) => !e.summoned);
    // v9.0.6 : les serviteurs d'un boss invocateur disparaissent avec lui.
    world.enemies = world.enemies.filter((e) => e.minionOf !== enemy.id);
    // v9.3.3 : essence de maîtrise (15 % par boss de campagne).
    if (!enc.worldBoss && !enc.score && rng.next() < RESOURCE_SOURCES.bossKill.chance) { state.materials.mastery = (state.materials.mastery ?? 0) + RESOURCE_SOURCES.bossKill.mastery; emit(world, 'resource', { mastery: 1 }); }
    // Table de butin des boss : éclats en plus de l'objet Rare+ garanti (v9.1.3 : ex-essences × ESSENCE_SHARDS).
    const shards = Math.round(bossEssence(enc.level, balance) * rebirthHeat(state, balance).reward) * ESSENCE_SHARDS;
    state.materials.shards += shards;
    // v9.0.6 : un boss déjà battu, réaffronté (boucle depuis le Codex ou étape inférieure au record), ne donne
    // plus de gemmes — seulement son butin, ses éclats et sa maîtrise (avant : 33 600 gemmes/h).
    const replay = Boolean(state.farmBoss) || enc.world || (!enc.dungeon && !enc.tower && !enc.challenge && state.stage < state.maxStage);
    const bonusGems = replay ? 0 : boost.bossGems; // v9.1.3 : bonus de démarrage en gemmes (ancien ticket)
    state.gems += bonusGems;
    emit(world, 'bossLoot', { shards, gems: bonusGems });
    state.records.bossesDefeated += 1;
    trackContracts(state, 'bosses', 1);
    emit(world, 'bossDefeated', { kind: enemy.type, stage: enc.level });
    // Gemmes (cristaux) à chaque boss : de quoi invoquer souvent.
    const tier = bossTier(enemy.type);
    // Tour : pas de gemmes par boss (seulement les récompenses de record), pas de pouvoir ancestral.
    const gems = enc.tower || enc.challenge || replay ? 0 : Math.round(balance.stages.tiers[tier].gems * rebirthHeat(state, balance).reward);
    state.gems += gems;
    if (gems) emit(world, 'gems', { gems, x: enemy.x });
    // Méga boss (et boss de donjon) — première victoire : pouvoir ancestral ; ensuite : charge de relance.
    if (tier === 'mega' && !enc.tower && !enc.challenge && !enc.world) {
      const power = recordBossVictory(state, enemy.type, rng, balance);
      if (power) emit(world, 'powerUnlocked', { bossId: enemy.type, powerId: power.id });
      else emit(world, 'rerollCharge', { bossId: enemy.type });
    }
    if (enc.world) {
      // v9.1.3 (doc4 lot 6) : boss du monde vaincu (niveau ou palier) : récompense de la première fois.
      const result = endWorldRun(state, 'won');
      resetWave(world, balance);
      emit(world, 'worldEnded', result);
    } else if (enc.challenge) {
      const result = clearChallengeWave(state);
      resetWave(world, balance);
      emit(world, 'challengeWave', result);
    } else if (enc.tower) {
      const result = clearTowerFloor(state);
      resetWave(world, balance);
      emit(world, 'towerFloor', result);
    } else if (enc.dungeon) {
      const result = completeDungeon(state, rng, balance);
      resetWave(world, balance);
      emit(world, 'dungeonComplete', result);
    } else {
      clearStage(state, world, balance);
    }
  } else if (enc.world) {
    worldKill(state);
    if (state.worldRun?.kills === enc.killsNeeded) world.enemies = world.enemies.filter((e) => e.boss);
  } else if (enc.challenge && !enemy.elite) {
    const result = challengeKill(state);
    if (result) {
      world.enemies = [];
      emit(world, 'challengeWave', result);
    }
  } else if (enc.dungeon && !enemy.elite) {
    const { roomCleared, reward } = dungeonKill(state, balance);
    if (roomCleared) {
      world.enemies = [];
      emit(world, 'dungeonRoom', { room: state.dungeon.room, reward });
    }
  } else if (!enemy.elite) {
    const needed = balance.stages.killsPerStage;
    if (state.kills < needed) state.kills += 1;
    if (state.kills >= needed) clearStage(state, world, balance);
  }
}

// Inflige des dégâts à un ennemi (coup normal, compétence, compagnon, épines).
// v9.0.6 : coups supplémentaires de l'attaque de classe (zone, perçant, chaîne, volée, météore).
// Renvoie { hits: [{ enemy, damage }], special } — `special` : 'volley' ou 'meteor' quand l'attaque spéciale part.
export function classAttackTargets(heroClass, world, front, damage, count) {
  const a = heroClass.attack;
  const others = world.enemies.filter((e) => e !== front);
  const hits = [];
  if (a.splash) for (const e of others) if (Math.abs(e.x - front.x) <= (a.splashRadius ?? 30)) hits.push({ enemy: e, damage: damage * a.splash });
  if (a.pierce) for (const e of others.slice(0, a.pierce)) hits.push({ enemy: e, damage: damage * a.pierceFactor });
  if (a.chain) for (const e of others.slice(0, a.chain)) hits.push({ enemy: e, damage: damage * a.chainFactor });
  let special = null;
  if (a.volleyEvery && count % a.volleyEvery === 0) {
    special = 'volley';
    for (const e of world.enemies.slice(0, a.volley)) hits.push({ enemy: e, damage: damage * a.volleyFactor });
  }
  if (a.meteorEvery && count % a.meteorEvery === 0) {
    special = 'meteor';
    for (const e of world.enemies) hits.push({ enemy: e, damage: damage * a.meteorFactor });
  }
  return { hits, special };
}

// v9.1.3 (S3) : unitId = compagnon qui frappe (sinon le héros) ; les dégâts réellement retirés sont comptés par
// unité (« dégâts directs »), lus seulement par la mesure « Mesurer » (core/offline.js).
// v9.2.2 : ruée des ennemis ordinaires quand l'équipe les tue d'un coup (voir BALANCE.rush).
export function isRushing(heroDamage, enemy, balance = BALANCE) {
  const r = balance.rush;
  return Boolean(r && !enemy.boss && !enemy.summoned && heroDamage >= r.oneShot * enemy.maxHp);
}

// Un ennemi qui se rue n'est touchable qu'arrivé près du contact (sinon il mourrait hors champ, sans animation).
// v9.3.8 : vagues seulement dans la campagne ordinaire (donjons, Tour, défi, monde, World Boss gardent leur rythme).
export function waveMode(enc) { return !enc.boss && !enc.dungeon && !enc.tower && !enc.challenge && !enc.world && !enc.worldBoss; }
export const waveCount = (balance = BALANCE) => Math.max(1, Math.ceil(balance.stages.killsPerStage / balance.waves.size));
export const waveIndex = (state, balance = BALANCE) => Math.min(waveCount(balance), Math.floor((state.kills ?? 0) / balance.waves.size) + 1);

export function canHit(enemy, balance = BALANCE) {
  // v9.3.8 (vagues) : personne ne touche un monstre avant qu'il ait atteint la ligne de combat (héros, compagnons,
  // compétences de zone, toucher) — plus de monstres tués au loin pendant que le héros marche.
  if (enemy.arrived === false) return false;
  if (!enemy.rush) return true;
  const W = balance.world;
  return enemy.x <= W.heroX + W.meleeOffset + enemy.range + (balance.rush?.reach ?? 0);
}

function hitEnemy(state, world, enemy, damage, rng, balance, stats, enc, source, unitId = 'hero') {
  if (!world.enemies.includes(enemy)) return;
  if (!canHit(enemy, balance)) return; // v9.2.2 : pas encore arrivé (ruée)
  // v9.3.1 : types : avantage (×1,3) ou faiblesse (×0,8) selon l'élément du compagnon et celui de l'ennemi.
  // Le héros reste neutre : ses apparences sont purement cosmétiques (v9.2.8).
  // v9.6.1 (4.6) : le héros frappe avec l'élément de son ensemble (2 pièces ou plus), sinon en neutre.
  const elem = elementMultiplier(unitId === 'hero' ? world.heroElement ?? null : unitElement(unitId), enemy.element);
  damage *= elem;
  if (unitId === 'hero' && world.major === 'elemEdge' && elem > 1) damage *= 1.4; // v9.6.1 : Lame élémentaire
  damage *= behaviorTakenMult(enemy, world.parries, source); // v9.6.0 : Bouclier, Essaim, Volant sans leur parade
  if (enemy.weakUntil > world.time) damage *= 1.5; // v9.6.3 : boss affaibli après son attaque lourde
  damage = mutationDamageTaken(enemy, damage);
  damage = traitDamageTaken(enemy, damage, elem);
  if (enemy.trait === 'mirror' && unitId === 'hero' && source !== 'thorns' && world.hero?.hp > 0) { // v9.6.5 : Miroir
    world.hero.hp = Math.max(1, world.hero.hp - Math.min(damage * TRAITS.mirror.reflectPct / 100, stats.maxHp * 0.02)); // plafond : 2 % des PV par coup
  }
  if (enemy.scoreTarget && state.worldRun?.kind === 'score') state.worldRun.damage += damage; // v9.1.3 (doc4 lot 6)
  if (enemy.worldBoss && state.worldBossRun) state.worldBossRun.damage += damage; // v9.2.9 : World Boss
  const dealt = world.counters?.damage ? Math.max(0, Math.min(damage, enemy.hp)) : 0;
  if (dealt > 0) world.counters.damage[unitId] = (world.counters.damage[unitId] ?? 0) + dealt;
  enemy.hp -= damage;
  if (stats.lifesteal > 0 && source !== 'thorns' && !(enc?.challenge && challengeRule(state, 'noHeal'))) {
    world.hero.hp = Math.min(stats.maxHp, world.hero.hp + (damage * stats.lifesteal) / 100);
  }
  emit(world, 'enemyHit', { enemyId: enemy.id, damage, x: enemy.x, boss: enemy.boss, source, elem });
  // Invocations berserk : à 75 %, 50 % et 25 % des PV.
  if (enemy.summons?.length && enemy.hp > 0) {
    const thresholds = [0.75, 0.5, 0.25];
    const done = 3 - enemy.summons.length;
    if (enemy.hp / enemy.maxHp <= thresholds[done]) summonMinion(state, world, enemy, balance, enc);
  }
  if (enemy.hp <= 0) killEnemy(state, world, enemy, rng, balance, stats, enc);
}

// v9.3.5 : toucher l'écran de combat — petit coup du joueur (10 % d'un coup du héros) sur l'ennemi le plus proche.
export const TAP_SHARE = 0.1;
export function tapHit(state, world, rng, balance = BALANCE) {
  const stats = world.heroStats ?? computeHeroStats(state, balance);
  const enemy = world.enemies.filter((e) => e.hp > 0 && canHit(e, balance)).sort((a, b) => a.x - b.x)[0];
  if (!enemy) return null;
  const damage = stats.damage * TAP_SHARE;
  hitEnemy(state, world, enemy, damage, rng, balance, stats, currentEncounter(state, balance), 'tap');
  return { damage, x: enemy.x };
}

function heroDamage(stats, enemy, world, rng, balance) {
  const versus = enemy.boss ? stats.bonus.damageVsBossPct : stats.bonus.damageVsNormalPct;
  const cry = world.buffs.cry > 0 ? world.buffs.cryPct : 0;
  const crit = world.forceCrit ? (world.forceCrit = false, true) : rng.next() < stats.critChance / 100; // v9.7.1 : point faible
  // v9.2.0 : multiplicateur critique de l'amélioration « Dégâts critiques », facteur « Tueur de boss » à part.
  const slayer = enemy.boss ? (1 + (stats.bossDamagePct ?? 0) / 100) * (stats.bossMult ?? 1) : 1; // v9.2.1 : Distorsion
  const damage = stats.damage * (1 + versus / 100) * slayer * (1 + cry / 100) * (crit ? stats.critMultiplier ?? balance.hero.critMultiplier : 1);
  return { damage, crit };
}

function castSkill(state, world, skill, stats, rng, balance, enc, front) {
  // v9.7.1 (lot 2) : recharge allongée (20 à 45 s) compensée par la puissance ; × 0,6 en automatique.
  const value = skillValue(skill, state.skills[skill.id]) * (skill.type === 'buff' ? 1 : cooldownRatio(skill)) * (world.skillPower ?? 1);
  if (skill.type === 'buff') {
    world.buffs.cryPct = Math.max(world.buffs.cry > 0 ? world.buffs.cryPct : 0, value);
    world.buffs.cry = Math.max(world.buffs.cry, skill.duration * Math.min(2, cooldownRatio(skill)) * (world.skillPower ?? 1)); // v9.7.1
  } else if (skill.type === 'aoe') {
    for (const enemy of [...world.enemies]) {
      const { damage } = heroDamage(stats, enemy, world, rng, balance);
      hitEnemy(state, world, enemy, damage * value, rng, balance, stats, enc, 'skill');
    }
  } else {
    const { damage } = heroDamage(stats, front, world, rng, balance);
    hitEnemy(state, world, front, damage * value, rng, balance, stats, enc, 'skill');
    if (skill.type === 'holy') world.hero.hp = Math.min(stats.maxHp, world.hero.hp + (stats.maxHp * skill.heal) / 100);
  }
  emit(world, 'skill', { skillId: skill.id, x: front?.x ?? balance.world.heroX + 20, aoe: skill.type === 'aoe' });
}

// v9.7.1 (lot A) : attaque de base d'un compagnon — dégâts par seconde = BASIC_SHARE × ceux de ses compétences « coup ».
function companionBasic(state, world, companion, skills, stats, rng, balance, enc, front, kind) {
  const aff = companionSkillMultiplier(state, companion, 'hit', dungeonAffinity(state, companion.id, balance), balance)
    * (1 + (stats.companionPowerPct ?? 0) / 100) * (stats.companionMult ?? 1);
  const perSec = skills.filter((s) => s.type === 'hit').reduce((a, s) => a + s.value / s.every, 0);
  const dmg = stats.damage * perSec * BASIC_SHARE * BASIC_INTERVAL[kind] * aff;
  if (dmg > 0) hitEnemy(state, world, front, dmg, rng, balance, stats, enc, 'companion', companion.id);
  emit(world, 'companionBasic', { companionId: companion.id, kind, enemyId: front.id });
}

function castCompanion(state, world, companion, skill, stats, rng, balance, enc, front) {
  // v9.1.3 (doc4 lot 1) : d × rareté × puissance du type (kh/kb pour hit/burst, 4/3 pour soin et rally, plafond 3) ;
  // bouclier et or sans étoile.
  // v9.2.0 : « Lien des compagnons » renforce coups, soins et cris (pas le bouclier ni l'or).
  const aff = companionSkillMultiplier(state, companion, skill.type, dungeonAffinity(state, companion.id, balance), balance)
    * (1 + (stats.companionPowerPct ?? 0) / 100) * (stats.companionMult ?? 1); // v9.2.1 : Corruption
  if (skill.type === 'gold') {
    gainGold(state, world, referenceKillGold(enc.level, balance) * skill.value * (1 + stats.goldPct / 100) * (stats.goldMult ?? 1) * earlyBoost(state, balance).gold);
  } else if (skill.type === 'heal') {
    world.hero.hp = Math.min(stats.maxHp, world.hero.hp + (stats.maxHp * skill.value * aff) / 100);
  } else if (skill.type === 'shield') {
    world.buffs.shield = Math.max(world.buffs.shield, skill.duration ?? 6); // v9.1.3 : un bouclier court n'écourte plus un long
    world.buffs.shieldPct = Math.max(world.buffs.shield > 0 ? world.buffs.shieldPct : 0, Math.min(90, skill.value));
  } else if (skill.type === 'rally') {
    world.buffs.cry = Math.max(world.buffs.cry, skill.duration ?? 6);
    world.buffs.cryPct = Math.max(world.buffs.cryPct, skill.value * aff);
  } else if (skill.type === 'hit' && front) {
    hitEnemy(state, world, front, stats.damage * skill.value * aff * (1 - BASIC_SHARE), rng, balance, stats, enc, 'companion', companion.id);
  } else if (skill.type === 'burst') {
    for (const enemy of [...world.enemies]) hitEnemy(state, world, enemy, stats.damage * skill.value * aff, rng, balance, stats, enc, 'companion', companion.id);
  }
  // v9.1.3 (doc4 lot 3) : effet `also` des signatures SSR (heal, shield ou gold ; valeur fixe, sans étoile).
  const also = skill.also;
  if (also?.type === 'heal') world.hero.hp = Math.min(stats.maxHp, world.hero.hp + (stats.maxHp * also.value) / 100);
  else if (also?.type === 'shield') {
    world.buffs.shield = Math.max(world.buffs.shield, also.duration ?? 5);
    world.buffs.shieldPct = Math.max(world.buffs.shieldPct, Math.min(90, also.value));
  } else if (also?.type === 'gold') {
    gainGold(state, world, referenceKillGold(enc.level, balance) * also.value * (1 + stats.goldPct / 100) * (stats.goldMult ?? 1) * earlyBoost(state, balance).gold);
  }
  emit(world, 'companionSkill', { companionId: companion.id, skill: skill.index, skillType: skill.type, ultimate: Boolean(skill.ultimate) });
}

// Défaite : en campagne, le héros recule d'une étape (v8.0 : l'avance automatique reste active,
// il refait l'étape précédente puis retente — elle ne se décoche plus toute seule) ;
// en donjon, l'expédition s'arrête (les salles gagnées restent acquises).
function heroDies(state, world, balance) {
  const hero = world.hero;
  if (!state.dungeon && !state.tower && !state.challenge && !state.worldRun && !state.worldBossRun) noteDeath(state, zoneIndexForStage(state.stage, balance)); // v9.7.1 (lot 4) : étoile « sans mourir »
  const from = state.stage;
  hero.dead = true;
  hero.hp = 0;
  hero.respawnTimer = balance.hero.respawnSeconds;
  // v9.2.9 : World Boss : le héros tombe, se relève après le délai habituel (temps perdu) ; le boss reste en place.
  if (state.worldBossRun) {
    state.worldBossRun.falls = (state.worldBossRun.falls ?? 0) + 1;
    emit(world, 'heroDeath', { worldBoss: true });
    return;
  }
  // Donjon : on note où l'on en était (salle, PV restants du boss) avant de vider la vague.
  const boss = state.dungeon || state.tower || state.challenge ? world.enemies.find((e) => e.boss && !e.summoned) : null;
  const bossHpPct = boss ? Math.max(0, Math.round((boss.hp / boss.maxHp) * 1000) / 10) : null;
  resetWave(world, balance);
  if (state.worldRun) {
    // v9.1.3 (doc4 lot 6) : défaite dans le monde (un score s'arrête et compte les dégâts déjà infligés).
    emit(world, 'worldEnded', endWorldRun(state, 'lost'));
    return;
  }
  if (state.challenge) {
    const result = endChallenge(state);
    emit(world, 'challengeFailed', { ...result, bossHpPct });
    return;
  }
  if (state.tower) {
    const result = endTower(state);
    emit(world, 'towerFailed', { ...result, bossHpPct });
    return;
  }
  if (state.dungeon) {
    const run = state.dungeon;
    const earned = failDungeon(state, { bossHpPct });
    emit(world, 'dungeonFailed', { earned, id: run.id, difficulty: run.difficulty, room: run.room, bossHpPct });
    return;
  }
  if (isBossStage(from, balance)) state.bossRetry = { stage: from, power: heroPower(state, balance), ...(Number.isFinite(bossHpPct) ? { hpPct: Math.round(bossHpPct) } : {}) }; // v9.3.5 : vie restante du boss
  if (state.stage > 1) state.stage -= 1;
  state.kills = 0;
  emit(world, 'heroDeath', { from, to: state.stage, boss: isBossStage(from, balance) });
}

export function step(state, world, dt, rng, balance = BALANCE) {
  // v9.1.3 (doc4 lot 6) : le score tire son hasard d'une graine fixe (posée à l'entrée) : même entrée, même score.
  if (state.worldRun?.kind === 'score' && world.scoreRng) rng = world.scoreRng;
  world.time += dt;
  state.playSeconds = (state.playSeconds ?? 0) + dt;
  tickTimes(state, dt, balance);
  // Positions du pas précédent : le rendu interpole entre les deux (sans effet sur la partie).
  world.prevScroll = world.scroll;
  for (const enemy of world.enemies) {
    enemy.prevX = enemy.x;
    if (enemy.mutation) mutationTick(enemy, dt);
  }
  const hero = world.hero;
  // v9.6.0 (6) : parades présentes dans l'équipe (une fois par pas) ; Soigneur et Kamikaze.
  world.parries = teamCounters(state);
  world.heroElement = heroElement(state); // v9.6.1
  world.major = activeMajor(state)?.id ?? null; // v9.6.1 (2.4) : grand effet actif
  behaviorTick(state, world, dt, rng, balance);
  // Boosts à durée limitée : minuteries (et relance automatique si activée).
  if (state.rushes) {
    const { ended, started } = tickRushes(state, dt);
    for (const id of started) emit(world, 'rushStart', { id });
    for (const id of ended) emit(world, 'rushEnd', { id });
  }
  const stats = applyEnvironment(computeHeroStats(state, balance), currentEnvironment(state, balance)); // v9.2.1
  world.heroStats = stats;

  if (hero.dead) {
    hero.respawnTimer -= dt;
    if (hero.respawnTimer <= 0) {
      hero.dead = false;
      hero.hp = stats.maxHp;
      hero.attackTimer = 0.3;
      emit(world, 'heroRespawn');
    }
    return;
  }
  if ((!state.challenge || !challengeRule(state, 'noHeal')) && !(state.tower && towerRule(state)?.noRegen)) hero.hp = Math.min(stats.maxHp, hero.hp + stats.regenPerSecond * dt); // v9.6.2 : Sans repos
  // v9.2.1 : brûlure (Lave) — jamais mortelle seule, elle s'arrête à 1 PV.
  if (stats.burnPerSecond > 0) hero.hp = Math.max(Math.min(hero.hp, 1), hero.hp - stats.burnPerSecond * dt);
  world.buffs.cry = Math.max(0, world.buffs.cry - dt);
  world.buffs.shield = Math.max(0, world.buffs.shield - dt);
  if (world.buffs.cry <= 0) world.buffs.cryPct = 0;
  if (world.buffs.shield <= 0) world.buffs.shieldPct = 0;

  const enc = currentEncounter(state, balance);
  // Tour de l'Éternité : elle s'effondre quand le chrono est écoulé (v8.8).
  if (enc.tower && towerTimeLeft(state) <= 0) {
    resetWave(world, balance);
    const result = endTower(state, { defeated: false, collapsed: true });
    emit(world, 'towerCollapsed', result);
    return;
  }
  // v9.1.3 (doc4 lot 6) : temps du monde écoulé (score : fin normale ; niveau ou palier : échec).
  if (enc.world && worldTimeLeft(state) <= 0) {
    resetWave(world, balance);
    emit(world, 'worldEnded', endWorldRun(state, state.worldRun.kind === 'score' ? 'time' : 'lost'));
    return;
  }
  // Défi de la semaine : temps limité par vague.
  if (enc.challenge && challengeTimeUp(state, dt)) {
    const boss = world.enemies.find((e) => e.boss && !e.summoned);
    resetWave(world, balance);
    const result = endChallenge(state);
    emit(world, 'challengeFailed', { ...result, timeout: true, bossHpPct: boss ? Math.round((boss.hp / boss.maxHp) * 1000) / 10 : null });
    return;
  }

  // Apparition des ennemis (boss seul, ou vague ordinaire avec éventuellement une élite).
  if (enc.boss) {
    if (world.enemies.length === 0) {
      world.bossDelay -= dt;
      if (world.bossDelay <= 0) {
        spawnEnemy(state, world, rng, balance, enc);
        world.bossDelay = balance.stages.bossSpawnDelaySeconds;
      }
    }
  } else if (waveMode(enc)) {
    // v9.3.8 : vagues groupées — quand la vague est vaincue, courte marche, puis la suivante arrive d'un bloc.
    world.waveAge = (world.waveAge ?? 99) + dt;
    // Vague terminée : ajuste le plancher (plus court que visé → monstres un peu plus solides, et inversement).
    if (world.enemies.length === 0 && world.waveStartT !== undefined) {
      const V = balance.waves;
      const took = Math.max(0.2, (world.time ?? 0) - world.waveStartT);
      const k = world.waveK ?? V.startK;
      world.waveK = Math.max(0, Math.min(V.maxK, k * Math.max(0.6, Math.min(1.5, V.targetSeconds / took))));
      if (!world.waveFloored && took > V.targetSeconds) world.waveK = Math.min(world.waveK, k); // plancher sans effet : ne pas l'emballer
      world.waveFloored = false;
      world.waveStartT = undefined;
    }
    if (world.enemies.length === 0) {
      world.waveTimer = (world.waveTimer ?? 0.6) - dt;
      // Jamais plus vite que l'ancien rythme d'apparition (même or et même XP par minute au plus).
      if (world.waveTimer <= 0 && world.waveAge >= balance.waves.minCycleSeconds) {
        world.waveAge = 0;
        const V = balance.waves;
        for (let i = 0; i < V.size; i++) {
          spawnEnemy(state, world, rng, balance, enc, i === 0 && world.pendingElite);
          const e = world.enemies[world.enemies.length - 1];
          e.x = Math.max(V.spawnX, Math.min(world.viewEdgeX ?? 0, V.spawnX + 60)) + i * balance.world.enemyGap; // v9.3.9 : entre par le bord droit ; v9.7.1 : au plus 60 plus loin (grande scène : plus de longue marche)
          e.arrived = false;
          // Plancher de PV : au moins `floorSeconds` de dégâts du héros. Un héros fort combat au lieu d'attendre la
          // vague suivante ; rien ne change pour un héros plus faible, ni l'or (le rythme reste plafonné par minCycle).
          // Réglé tout seul (world.waveK) pour qu'une vague dure environ `targetSeconds`, équipe comprise.
          if (!e.boss) { const floor = (world.heroStats?.dps ?? 0) * (world.waveK ?? V.startK); if (floor > e.maxHp) { e.damage *= e.maxHp / floor; e.hp = floor; e.maxHp = floor; world.waveFloored = true; } } // même danger total : dégâts réduits d'autant
        }
        world.pendingElite = false;
        world.waveTimer = V.delaySeconds;
        world.waveStartT = world.time ?? 0;
        emit(world, 'waveStart', { wave: waveIndex(state, balance), waves: waveCount(balance) });
      }
    }
  } else {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      const rate = enc.challenge ? challengeRule(state, 'spawnRate') ?? 1 : 1;
      if (world.enemies.length < balance.spawn.maxAlive + (rate > 1 ? 2 : 0)) {
        spawnEnemy(state, world, rng, balance, enc, world.pendingElite);
        world.pendingElite = false;
      }
      world.spawnTimer = balance.spawn.intervalSeconds / rate;
    }
  }

  // Déplacement : les ennemis forment une file devant le héros.
  // Le héros « marche » (le décor défile) tant qu'aucun ennemi n'est à portée.
  const W = balance.world;
  const front = world.enemies[0];
  // v9.0.6 : portée selon la classe (l'archer s'arrête et tire de loin, le lancier frappe avec allonge).
  const range = classRange(state, balance);
  const heroClass = activeClass(state);
  // v9.2.2 : ruée — décidée une fois par ennemi, d'après le coup moyen du héros.
  for (const enemy of world.enemies) if (enemy.rush === undefined) enemy.rush = isRushing(stats.damage, enemy, balance);
  // v9.3.8 : une vague apparue charge jusqu'à la ligne pendant que le héros, arrêté, se met en garde (il ne marche
  // qu'entre deux vagues) ; elle avance à la même vitesse qu'avant (décor compris).
  const charging = Boolean(front) && front.arrived === false && waveMode(currentEncounter(state, balance));
  hero.walking = !front || (!charging && (front.x - W.heroX > range || !canHit(front, balance)));
  const scroll = hero.walking ? W.scrollSpeed : 0;
  world.scroll += scroll * dt;
  world.enemies.forEach((enemy, i) => {
    const prev = world.enemies[i - 1];
    const gap = W.enemyGap * (enemy.boss || prev?.boss ? 2 : 1);
    const stopX = prev ? prev.x + gap : W.heroX + W.meleeOffset + enemy.range;
    const speed = (enemy.rush ? enemy.speed * (balance.rush?.speedMult ?? 1) : enemy.speed) + (charging && enemy.arrived === false ? W.scrollSpeed : 0);
    enemy.x = Math.max(stopX, enemy.x - (speed + scroll) * dt);
    // v9.3.9 : un monstre de derrière n'est « arrivé » que si celui de devant l'est aussi (sinon, en rattrapant le groupe
    // loin de la ligne, il se disait arrivé et le héros se remettait à marcher au lieu d'attendre la vague en garde).
    if (enemy.arrived === false && enemy.x <= stopX + 0.01 && (!prev || prev.arrived !== false)) enemy.arrived = true; // v9.3.8 : sur la ligne
    enemy.engaged = !prev && enemy.x <= stopX + 0.01;
    // v9.2.5 : bloqué dans la file derrière un ennemi lui-même arrêté (au contact ou bloqué) : attend sans marcher.
    enemy.queued = Boolean(prev) && enemy.x <= stopX + 0.01 && Boolean(prev.engaged || prev.queued);
  });

  const inRange = front && front.x - W.heroX <= range && canHit(front, balance);

  // Attaque automatique du héros sur l'ennemi le plus proche.
  if (inRange) {
    hero.attackTimer -= dt;
    if (hero.attackTimer <= 0) {
      hero.attackTimer += stats.attackInterval * (world.enemies.some((e) => e.trait === 'frost' && e.hp > 0) ? TRAITS.frost.slow : 1); // v9.7.0 : Gel
      // v9.2.1 : Pénombre — une part des coups manque (tirage seulement sous ce malus).
      if (stats.missPct > 0 && rng.next() < stats.missPct / 100) {
        emit(world, 'heroMiss', { enemyId: front.id, x: front.x });
      } else {
        const { damage, crit } = heroDamage(stats, front, world, rng, balance);
        world.attackCount = (world.attackCount ?? 0) + 1;
        if (crit) front.critAt = world.time; // v9.2.0 (monde marin) : un critique arrête la Marée
        const extra = classAttackTargets(heroClass, world, front, damage, world.attackCount);
        emit(world, 'heroAttack', {
          enemyId: front.id, damage, crit, x: front.x, boss: front.boss, kind: heroClass.attack.kind,
          special: extra.special, targets: extra.hits.map((h) => ({ id: h.enemy.id, x: h.enemy.x })),
        });
        hitEnemy(state, world, front, damage, rng, balance, stats, enc, 'attack');
        // v9.6.1 (2.4) : Éclats critiques — un critique éclabousse les autres ennemis (40 %).
        if (crit && world.major === 'critSplash') for (const o of world.enemies.filter((x) => x !== front && x.arrived !== false)) hitEnemy(state, world, o, damage * 0.4, rng, balance, stats, enc, 'skill');
        for (const h of extra.hits) hitEnemy(state, world, h.enemy, h.damage, rng, balance, stats, enc, 'attack');
        // v9.2.8 : Double attaque — un second coup aussitôt (critique tiré à nouveau) sur l'ennemi de tête encore debout.
        if (stats.doubleAttackPct > 0 && rng.next() < stats.doubleAttackPct / 100) {
          const target = world.enemies.find((e) => e.hp > 0 && canHit(e, balance) && e.x - W.heroX <= range);
          if (target) {
            const second = heroDamage(stats, target, world, rng, balance);
            if (second.crit) target.critAt = world.time;
            emit(world, 'heroAttack', { enemyId: target.id, damage: second.damage, crit: second.crit, x: target.x, boss: target.boss, kind: heroClass.attack.kind, double: true, targets: [] });
            hitEnemy(state, world, target, second.damage, rng, balance, stats, enc, 'attack');
          }
        }
      }
    }
  } else {
    hero.attackTimer = Math.min(hero.attackTimer, 0.25);
  }

  // Lame fantôme : un double spectral frappe plusieurs fois par seconde tant que le boost dure.
  const phantom = rushById('phantom');
  if (state.rushes?.active.phantom > 0 && inRange) {
    world.phantomTimer = (world.phantomTimer ?? 0) - dt;
    if (world.phantomTimer <= 0) {
      world.phantomTimer += 1 / phantom.hitsPerSecond;
      const { damage } = heroDamage(stats, front, world, rng, balance);
      const hit = (damage * phantomHitPct(state, phantom)) / 100;
      emit(world, 'phantomHit', { enemyId: front.id, damage: hit, x: front.x });
      hitEnemy(state, world, front, hit, rng, balance, stats, enc, 'phantom');
    }
  }

  // Compétences lancées automatiquement dès qu'un ennemi est à portée.
  // v9.7.1 (lot 2) : compétences à l'appui. Prête, une compétence attend le joueur (Mixte : 4 s de grâce) ; lancée à la
  // main elle fait 100 % de son effet, en automatique 60 %. Mode « Manuel » : jamais seule ; « Complet » : tout de suite.
  const assist = combatAssist(state);
  for (const skill of activeSkills(state)) {
    world.skillTimers[skill.id] = (world.skillTimers[skill.id] ?? 1) - dt;
    if (world.skillTimers[skill.id] > 0) continue;
    const target = world.enemies[0];
    const inRange = target && target.x - W.heroX <= range && canHit(target, balance);
    if (!inRange) continue;
    world.skillReadyAt ??= {};
    world.skillReadyAt[skill.id] ??= world.time;
    const manual = world.manualSkills?.has(skill.id);
    const grace = assist === 'full' ? 0 : ASSIST_GRACE;
    const auto = state.skillAuto && assist !== 'manual' && world.time - world.skillReadyAt[skill.id] >= grace;
    if (manual || auto) {
      world.skillPower = manual ? 1 : AUTO_POWER;
      castSkill(state, world, skill, stats, rng, balance, enc, target);
      world.skillPower = 1;
      world.skillTimers[skill.id] = interactiveCooldown(skill, stats.bonus);
      delete world.skillReadyAt[skill.id];
      world.manualSkills?.delete(skill.id);
      if (manual) { addCombo(world); state.records.manualCasts = (state.records.manualCasts ?? 0) + 1; }
    }
  }
  world.manualSkills?.clear();
  tickInteraction(state, world, dt);

  // Compétences des compagnons (v8.9 : jusqu'à 4 chacun, chacune avec sa recharge).
  for (const companion of equippedCompanions(state)) {
    const skills = companionSkills(state, companion.id);
    // v9.7.1 (lot A) : attaque de base entre deux compétences (corps à corps, tir ou sort), une action toutes les 1,2 à
    // 1,8 s ; ses dégâts sont pris sur les compétences « coup » (BASIC_SHARE) : même total qu'avant.
    {
      const kind = basicKind(companion.id);
      const bkey = `${companion.id}#basic`;
      const front = world.enemies[0];
      world.companionTimers[bkey] = (world.companionTimers[bkey] ?? BASIC_INTERVAL[kind] * (0.4 + (companion.id.length % 5) * 0.1)) - dt * (world.major === 'teamHaste' ? 1.25 : 1);
      // Tout ennemi visible qui approche (le corps à corps lance son onde tranchante, comme ses compétences).
      const reach = Math.max(range + 40, (world.viewEdgeX ?? W.spawnX) - W.heroX);
      if (world.companionTimers[bkey] <= 0 && front && front.x - W.heroX <= reach && canHit(front, balance)) {
        world.companionTimers[bkey] = BASIC_INTERVAL[kind];
        companionBasic(state, world, companion, skills, stats, rng, balance, enc, front, kind);
      }
    }
    for (const skill of skills) {
      const key = `${companion.id}#${skill.index}`;
      world.companionTimers[key] = (world.companionTimers[key] ?? skill.every / 2 + skill.index) - dt * (world.major === 'teamHaste' ? 1.25 : 1); // v9.6.1 : Cadence d'équipe
      const target = world.enemies[0];
      const needsTarget = ['hit', 'burst'].includes(skill.type);
      // v9.6.3 (5.3 bis) : consigne de l'ultime — dès que prêt, gardé pour le boss, ou quand les PV passent sous 50 %.
      const order = skill.ultimate ? state.companions.orders?.[companion.id] ?? 'ready' : 'ready';
      const held = (order === 'boss' && !world.enemies.some((e) => e.boss)) || (order === 'lowhp' && hero.hp > stats.maxHp * 0.5);
      if (!held && world.companionTimers[key] <= 0 && (!needsTarget || (target && target.x - W.heroX <= range + 20 && canHit(target, balance)))) {
        // v9.7.1 (lot 2) : ultime prêt → jauge pleine sur le portrait ; le joueur le déclenche quand il veut, sinon il
        // part seul après 5 s (Mixte). Complet : tout de suite ; Manuel : seulement à l'appui.
        if (skill.ultimate && assist !== 'full') {
          world.ultReady ??= {};
          if (world.ultReady[key] === undefined) { world.ultReady[key] = world.time; emit(world, 'ultReady', { companionId: companion.id }); }
          const now = world.ultNow?.has(key) || (assist === 'mixed' && world.time - world.ultReady[key] >= ULT_AUTO_DELAY);
          if (!now) continue;
          delete world.ultReady[key];
          world.ultNow?.delete(key);
        }
        castCompanion(state, world, companion, skill, stats, rng, balance, enc, target);
        world.companionTimers[key] = skill.every;
      }
    }
  }

  // Seul l'ennemi au contact frappe.
  const attacker = world.enemies[0];
  if (attacker?.engaged) attacker.age = (attacker.age ?? 0) + dt;
  tickTide(world, dt); // v9.2.0 (monde marin) : boss à la Marée (régénération)
  // v9.0.6 : boss invocateur — des serviteurs surgissent devant lui à intervalles réguliers.
  for (const boss of [...world.enemies]) {
    if ((boss.trait !== 'summoner' && boss.trait !== 'swarm') || boss.hp <= 0) continue; // v9.7.0 : Nuée
    boss.summonTimer -= dt;
    if (boss.summonTimer > 0) continue;
    const t = { ...TRAITS[boss.trait], minion: BOSS_MINIONS[boss.type] ?? TRAITS[boss.trait].minion }; // v9.2.0 (monde marin)
    boss.summonTimer = t.every;
    // Serviteurs : ennemis ordinaires (pas de gemmes de boss), placés juste devant leur maître (la file ne recule
    // pas), et jamais plus de `maxAlive` à la fois — sinon la file pouvait s'allonger sans fin et bloquer le jeu.
    const alive = world.enemies.filter((e) => e.minionOf === boss.id).length;
    const count = Math.min(t.count, t.maxAlive - alive);
    for (let i = 0; i < count; i++) {
      const hp = (boss.maxHp * t.minionHpPct) / 100;
      world.enemies.splice(world.enemies.indexOf(boss), 0, {
        id: world.nextEnemyId++, type: t.minion, boss: false, elite: false, minionOf: boss.id, x: boss.x - 4,
        hp, maxHp: hp, damage: boss.damage * 0.25, gold: boss.gold * 0.02, speed: 30, attackInterval: 1.2, attackTimer: 1,
        range: ENEMIES[t.minion].range, engaged: false, age: 0, summons: [], trait: null,
      });
    }
    if (count > 0) emit(world, 'bossSummon', { enemyId: boss.id, kind: t.minion, master: boss.type });
  }
  const traitAtk = attacker?.trait ? traitAttack(attacker, stats.armor) : { damage: 1, speed: 1 };
  if (attacker?.engaged) {
    const before = attacker.attackTimer;
    attacker.attackTimer -= dt * traitAtk.speed * (state.tower ? towerRule(state)?.speed ?? 1 : 1); // v9.6.2 : Frénésie
    // v9.1.9 : préparation visible ~0,25 s avant le coup (affichage seul : ni dégâts ni rythme changés).
    if (before > ENEMY_WINDUP && attacker.attackTimer <= ENEMY_WINDUP && attacker.attackTimer > 0) emit(world, 'enemyWindup', { enemyId: attacker.id, boss: attacker.boss });
    if (attacker.attackTimer <= 0) {
      attacker.attackTimer += attacker.attackInterval;
      // v9.2.0 : Esquive (moitié contre les boss) ; tirage seulement si l'amélioration est achetée.
      const dodge = (stats.dodgePct ?? 0) * (attacker.boss ? 0.5 : 1);
      if (dodge > 0 && rng.next() < dodge / 100) {
        emit(world, 'heroDodge', { enemyId: attacker.id, boss: attacker.boss });
        return;
      }
      const lowHp = hero.hp < stats.maxHp * POWER_RULES.lowHpThreshold ? stats.bonus.lowHpArmor : 0;
      const st = balance.stages;
      const shield = world.buffs.shield > 0 ? world.buffs.shieldPct : 0;
      // Rage : un boss qui dure trop longtemps frappe de plus en plus fort.
      const instant = state.challenge && challengeRule(state, 'instantRage');
      // Étape 4 : rage multiplicative (×1,3 toutes les 10 s) — un combat de boss se joue en 60–90 s au plus,
      // au lieu de 7 à 10 minutes d'usure quand le héros est juste assez fort pour survivre.
      // v9.7.1 (lot 3) : pas de rage aux mondes 1 et 2 (campagne) : la mécanique est présentée au monde 3.
      const rage = attacker.boss && !rageFree(state, balance) && (attacker.age > st.enrageSeconds || instant)
        ? (1 + st.enragePct / 100) ** (1 + Math.floor(Math.max(0, attacker.age - st.enrageSeconds) / st.enrageStepSeconds)) : 1;
      if (rage > 1 && !attacker.enraged) {
        attacker.enraged = true;
        emit(world, 'bossEnrage', { enemyId: attacker.id, kind: attacker.type });
      }
      // v9.2.8 : armure et Défense dans damageTakenFactor (même calcul pour la fiche et la simulation).
      const damage = attacker.damage * rage * traitAtk.damage * damageTakenFactor(stats, attacker.boss, balance, lowHp) * (1 - shield / 100)
        * dungeonDamageTaken(state, balance) * (stats.hurtMult ?? 1) // v9.2.1 : Éclats de cristal
        * behaviorHitMult(attacker, world.parries) // v9.6.0 : Tireur, Charge sans leur parade
        * (attacker.heavy ? (attacker.parried ? 1.25 : 2.5) : 1); // v9.6.3 : attaque lourde annoncée ; v9.7.1 : parée = moitié
      // v9.7.1 (lot 2) : seule une parade réussie affaiblit le boss (4 s) ; ignorée ou ratée : coup normal, rien de plus.
      if (attacker.heavy) {
        attacker.heavy = false;
        if (attacker.parried) { attacker.parried = false; attacker.weakUntil = world.time + 4; emit(world, 'bossWeak', { enemyId: attacker.id, x: attacker.x, parried: true }); }
      }
      hero.hp -= damage;
      mutationOnHit(attacker, damage);
      emit(world, 'heroHit', { enemyId: attacker.id, damage, boss: attacker.boss });
      if (stats.thorns > 0) hitEnemy(state, world, attacker, (damage * stats.thorns) / 100, rng, balance, stats, enc, 'thorns');
      if (hero.hp <= 0) heroDies(state, world, balance);
    }
  }
}

// --- v9.7.1 (lot 2) : un minimum d'interaction en combat (jamais punitif : l'absent avance toujours) ---
export const ASSIST_GRACE = 4; // s : une compétence prête attend le joueur avant de partir seule (Mixte)
export const AUTO_POWER = 0.6; // effet d'une compétence lancée seule
export const GUARD_WINDOW = 1.5; // s : fenêtre de parade d'un coup lourd annoncé
export const COMBO_MAX = 10, COMBO_STEP_PCT = 2, COMBO_DECAY = 6; // +2 % d'or et d'XP par cran, -1 cran toutes les 6 s
export const ULT_AUTO_DELAY = 5; // s : un ultime prêt part seul après 5 s (Mixte)
export const ASSIST_MODES = { full: 'Complet', mixed: 'Mixte', manual: 'Manuel' };
export const combatAssist = (state) => (ASSIST_MODES[state.ui?.combatAssist] ? state.ui.combatAssist : 'mixed');
export function interactiveCooldown(skill, bonus) { return skillCooldown(skill, bonus) * cooldownRatio(skill); }
export function cooldownRatio(skill) { return Math.min(45, Math.max(20, skill.cooldown * 3)) / skill.cooldown; }

function addCombo(world) {
  world.combo = { n: Math.min(COMBO_MAX, (world.combo?.n ?? 0) + 1), t: 0 };
  emit(world, 'combo', { n: world.combo.n });
}
export const comboBonus = (world) => 1 + ((world?.combo?.n ?? 0) * COMBO_STEP_PCT) / 100;

function tickInteraction(state, world, dt) {
  if (world.combo?.n) { world.combo.t += dt; if (world.combo.t >= COMBO_DECAY) { world.combo.n -= 1; world.combo.t = 0; } }
  if (world.guard && world.guard.until < world.time) world.guard = null;
  // Point faible : sur un boss engagé, une cible lumineuse de 3 s toutes les 12 à 18 s.
  const boss = world.enemies.find((e) => e.boss && (e.engaged || e.arrived) && e.hp > 0);
  if (!boss) { world.weakSpot = null; return; }
  world.weakSpotT = (world.weakSpotT ?? 6) - dt;
  if (world.weakSpot && world.weakSpot.until < world.time) world.weakSpot = null;
  if (world.weakSpotT <= 0 && !world.weakSpot) {
    world.weakSpotT = 12 + ((boss.id * 7) % 7);
    world.weakSpot = { enemyId: boss.id, until: world.time + 3, u: 0.3 + ((boss.id * 13) % 5) / 10, v: 0.25 + ((boss.id * 5) % 4) / 10 };
    emit(world, 'weakSpot', { enemyId: boss.id });
  }
}

// Actions du joueur (UI) : renvoient true si l'action a compté.
export function playerCast(world, skillId) {
  if ((world.skillTimers?.[skillId] ?? 1) > 0) return false;
  (world.manualSkills ??= new Set()).add(skillId);
  return true;
}
export function playerGuard(world) {
  const g = world.guard;
  const boss = g && world.enemies.find((e) => e.id === g.enemyId);
  if (!boss || !boss.heavy || boss.parried) return false;
  boss.parried = true;
  world.guard = null;
  addCombo(world);
  emit(world, 'guard', { enemyId: boss.id, x: boss.x });
  return true;
}
export function playerWeakSpot(world) {
  if (!world.weakSpot) return false;
  world.weakSpot = null;
  world.forceCrit = true;
  if (world.hero) world.hero.attackTimer = 0; // le coup part tout de suite
  addCombo(world);
  emit(world, 'weakHit', {});
  return true;
}
export function playerUltimate(world, companionId) {
  const key = Object.keys(world.ultReady ?? {}).find((k) => k.startsWith(`${companionId}#`));
  if (!key) return false;
  (world.ultNow ??= new Set()).add(key);
  addCombo(world);
  return true;
}

// v9.7.1 (lot 3) : boss des mondes 1 et 2 de la campagne sans chronomètre de rage.
export function rageFree(state, balance = BALANCE) {
  return !state.dungeon && !state.tower && !state.challenge && !state.worldRun && !state.worldBossRun && zoneIndexForStage(state.stage, balance) < 2;
}
