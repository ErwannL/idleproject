// Simulation du combat automatique, à pas fixe et sans dépendance au rendu.
// `state` = données sauvegardées ; `world` = état transitoire du combat (positions, PV, minuteries).
// La simulation émet des événements (world.events) que le rendu et l'interface consomment.
import { BALANCE } from '../data/balance.js';
import { maybeMutate, mutationDamageTaken, mutationOnHit, mutationTick, splitChildren } from './mutations.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { POWER_RULES } from '../data/powers.js';
import { ZONES } from '../data/zones.js';
import { RARITY_SKILL, companionSkills, dungeonAffinity, dungeonDamageTaken, equippedCompanions, skillPower } from './companions.js';
import { trackContracts } from './contracts.js';
import { completeDungeon, dungeonById, dungeonKill, failDungeon } from './dungeon.js';
import { addGold } from './economy.js';
import { rollEvent } from './events.js';
import { collectItem } from './inventory.js';
import { addXp, killXp } from './level.js';
import { generateItem, makeSignatureItem, rarityIndex } from './loot.js';
import { cheatLoot } from './cheats.js';
import { recordBossVictory } from './powers.js';
import { activeSkills, skillCooldown, skillValue } from './skills.js';
import { computeHeroStats } from './stats.js';
import { earlyBoost } from './boost.js';
import { phantomHitPct, rushById, tickRushes } from './rushes.js';
import { recordKill } from './codex.js';
import { activeClass, classRange } from './classes.js';
import { BOSS_TRAITS, TRAITS, traitAttack, traitDamageTaken } from './boss-traits.js';
import { DUNGEON_DIFFICULTIES } from '../data/dungeons.js';
import { enemyScaleFactor } from './transcend.js';
import { clearTowerFloor, endTower, towerBoss, towerLevel, towerTimeLeft } from './tower.js';
import { CHALLENGE, challengeBosses, challengeKill, challengeLevel, challengeRule, challengeTimeUp, clearChallengeWave, endChallenge, isBossWave } from './challenge.js';

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


// Étape 4 : ×hpBase atteint progressivement (première minute vive, puis début disputé).
const hpBaseFactor = (n, g) => 1 + ((g.hpBase ?? 1) - 1) * Math.min(1, n / (g.hpBaseRamp ?? 1));

export function enemyStats(stage, type, boss, balance = BALANCE) {
  const def = enemyDefinition(type, boss);
  const tier = boss ? balance.stages.tiers[bossTier(type)] : null;
  const growth = balance.enemyScaling;
  const st = balance.stages;
  const n = Math.max(0, stage - 1);
  return {
    hp: Math.round(def.hp * hpBaseFactor(n, growth) * growth.hpGrowth ** n * (boss ? st.bossHpMultiplier * tier.hp : 1)),
    damage: def.damage * growth.damageGrowth ** n * (boss ? st.bossDamageMultiplier * tier.damage : 1),
    gold: Math.max(1, Math.round(def.gold * growth.goldGrowth ** n * (boss ? st.bossGoldMultiplier * tier.gold : 1))),
    speed: def.speed,
    attackInterval: def.attackInterval * (boss ? 1.2 : 1),
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
      level: state.dungeon.level, boss: state.dungeon.room >= d.rooms, enemies: d.enemies, bosses: [d.boss],
      killsNeeded: d.killsPerRoom, zoneIndex: d.zone, dungeon: d,
    };
  }
  const zone = zoneForStage(state.stage, balance);
  return {
    level: state.stage, boss: isBossStage(state.stage, balance), enemies: zone.enemies,
    bosses: bossesForStage(state.stage, balance),
    killsNeeded: balance.stages.killsPerStage, zoneIndex: zoneIndexForStage(state.stage, balance), dungeon: null,
    // Monde 11 : le méga boss (berserk) invoque les boss 5/10/15 de son monde quand ses PV baissent.
    gauntlet: Boolean(zone.gauntlet),
    summons: zone.gauntlet ? Object.values(ZONES[stageInZone(state.stage, balance) - 1].tierBosses ?? {}) : [],
  };
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
  s.damage *= entropy.damage;
  if (enc.challenge) {
    s.hp *= challengeRule(state, 'enemyHp') ?? 1;
    s.damage *= challengeRule(state, 'enemyDamage') ?? 1;
    s.attackInterval /= challengeRule(state, 'enemyAttackSpeed') ?? 1;
  }
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
    x: balance.world.spawnX + (boss ? 10 : 0),
    hp: s.hp * (elite ? e.eliteHpMultiplier : 1),
    maxHp: s.hp * (elite ? e.eliteHpMultiplier : 1),
    damage: s.damage * (elite ? 1.5 : 1),
    gold: s.gold * (elite ? e.eliteGoldMultiplier : 1),
    speed: s.speed,
    attackInterval: s.attackInterval,
    attackTimer: s.attackInterval * 0.6,
    range: s.range + (elite ? 4 : 0),
    engaged: false,
    age: 0, // secondes au contact (rage des boss)
    berserk: Boolean(boss && enc.gauntlet),
    summons: boss && enc.gauntlet ? [...enc.summons] : [],
    trait: boss ? BOSS_TRAITS[type] ?? null : null, // v9.0.6 : mécanique du boss (core/boss-traits.js)
  };
  if (enemy.trait === 'summoner') enemy.summonTimer = TRAITS.summoner.every / 2;
  // v9.0.4 : ennemis mutés (campagne, donjons, défi ; jamais dans la Tour).
  const mutation = !boss && !elite && !enc.tower ? maybeMutate(state, enemy, rng) : null;
  world.enemies.push(enemy);
  emit(world, boss ? 'bossSpawn' : elite ? 'eliteSpawn' : 'spawn', { enemyId: enemy.id, kind: type });
  if (mutation) emit(world, 'mutantSpawn', { enemyId: enemy.id, kind: type, mutation: mutation.id });
}

export function changeStage(state, world, stage, balance = BALANCE) {
  const target = Math.max(1, Math.min(stage, state.maxStage));
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
  changeStage(state, world, next, balance);
}

// Puissance globale (dégâts × robustesse) : sert à décider quand retenter un boss.
export function heroPower(state, balance = BALANCE) {
  const s = computeHeroStats(state, balance);
  return s.dps * (s.maxHp / Math.max(0.05, 1 - s.armor / 100));
}

function gainGold(state, world, amount) {
  const gold = addGold(state, amount);
  world.counters.gold += gold;
  trackContracts(state, 'gold', gold);
  return gold;
}

function dropItem(state, world, item, x, balance) {
  world.counters.drops += 1;
  const result = collectItem(state, item, balance);
  if (rarityIndex(item.rarity) >= 1) trackContracts(state, 'rareLoot', 1);
  emit(world, 'drop', { item, x, autoRecycled: !result.added && !result.mannequin && !result.museum, byRule: Boolean(result.auto), mannequin: Boolean(result.mannequin), museum: Boolean(result.museum), recycledGold: result.recycledGold, freed: result.freed?.count ? result.freed : null });
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
    emit(world, 'mutantSplit', { enemyId: enemy.id, kind: enemy.type, x: enemy.x });
  }

  const wave = world.goldWave > 0 && !enemy.boss ? balance.events.waveGoldMultiplier : 1;
  if (world.goldWave > 0 && !enemy.boss) world.goldWave -= 1;
  const boost = earlyBoost(state, balance);
  const challengeGold = enc.challenge ? challengeRule(state, 'gold') ?? 1 : 1;
  const gold = gainGold(state, world, enemy.gold * (1 + stats.goldPct / 100) * (stats.goldMult ?? 1) * wave * boost.gold * challengeGold);
  world.counters.kills += 1;
  state.records.kills += 1;
  if (state.codex) recordKill(state, enemy.type, enemy);
  trackContracts(state, 'kills', 1);

  const xp = killXp(enc.level, enemy.boss || enemy.elite, balance) * (1 + stats.xpPct / 100) * boost.xp;
  world.counters.xp += xp;
  const levels = addXp(state, xp, balance);
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
  const dropChance = enemy.boss || enemy.elite || enemy.mutation ? 1 : balance.loot.dropChance + stats.bonus.dropChance / 100 + boost.dropChance;
  if (rng.next() < dropChance) {
    // v9.0.6 : boss réaffronté (boucle, étape déjà franchie) → objet ancestral 5 fois plus rare.
    const farmed = enemy.boss && (Boolean(state.farmBoss) || (!enc.dungeon && !enc.tower && !enc.challenge && state.stage < state.maxStage));
    const signature = enemy.boss && rng.next() < balance.loot.signatureChance * (farmed ? 0.2 : 1)
      ? makeSignatureItem(state, enemy.type, enc.level, rng, balance) : null;
    const base = enemy.boss || enemy.elite ? balance.loot.bossMinRarity : 'common';
    const luck = cheatLoot(state).minRarity;
    const minRarity = luck && rarityIndex(luck) > rarityIndex(base) ? luck : base;
    const item = signature ?? generateItem(state, rng, { level: enc.level, minRarity, setZone: enc.tower ? null : enc.zoneIndex }, balance);
    dropItem(state, world, item, enemy.x, balance);
  }

  if (enemy.elite) {
    state.gems += balance.events.eliteGems;
    emit(world, 'eliteDefeated', { gems: balance.events.eliteGems });
  } else if (!enemy.boss && !enc.dungeon && !enc.tower && !enc.challenge) {
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
    // Table de butin des boss : matériau rare (essences) en plus de l'objet Rare+ garanti.
    const essence = Math.round(bossEssence(enc.level, balance) * rebirthHeat(state, balance).reward);
    state.materials.essence += essence;
    // v9.0.6 : un boss déjà battu, réaffronté (boucle depuis le Codex ou étape inférieure au record), ne donne
    // plus ni gemmes ni tickets — seulement son butin, ses essences et sa maîtrise (avant : 33 600 gemmes/h).
    const replay = Boolean(state.farmBoss) || (!enc.dungeon && !enc.tower && !enc.challenge && state.stage < state.maxStage);
    const tickets = replay ? 0 : boost.bossTickets;
    state.tickets += tickets; // bonus de démarrage : un ticket d'invocation par boss
    emit(world, 'bossLoot', { essence, tickets });
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
    if (tier === 'mega' && !enc.tower && !enc.challenge) {
      const power = recordBossVictory(state, enemy.type, rng, balance);
      if (power) emit(world, 'powerUnlocked', { bossId: enemy.type, powerId: power.id });
      else emit(world, 'rerollCharge', { bossId: enemy.type });
    }
    if (enc.challenge) {
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
function hitEnemy(state, world, enemy, damage, rng, balance, stats, enc, source, unitId = 'hero') {
  if (!world.enemies.includes(enemy)) return;
  damage = mutationDamageTaken(enemy, damage);
  damage = traitDamageTaken(enemy, damage);
  const dealt = world.counters?.damage ? Math.max(0, Math.min(damage, enemy.hp)) : 0;
  if (dealt > 0) world.counters.damage[unitId] = (world.counters.damage[unitId] ?? 0) + dealt;
  enemy.hp -= damage;
  if (stats.lifesteal > 0 && source !== 'thorns' && !(enc?.challenge && challengeRule(state, 'noHeal'))) {
    world.hero.hp = Math.min(stats.maxHp, world.hero.hp + (damage * stats.lifesteal) / 100);
  }
  emit(world, 'enemyHit', { enemyId: enemy.id, damage, x: enemy.x, boss: enemy.boss, source });
  // Invocations berserk : à 75 %, 50 % et 25 % des PV.
  if (enemy.summons?.length && enemy.hp > 0) {
    const thresholds = [0.75, 0.5, 0.25];
    const done = 3 - enemy.summons.length;
    if (enemy.hp / enemy.maxHp <= thresholds[done]) summonMinion(state, world, enemy, balance, enc);
  }
  if (enemy.hp <= 0) killEnemy(state, world, enemy, rng, balance, stats, enc);
}

function heroDamage(stats, enemy, world, rng, balance) {
  const versus = enemy.boss ? stats.bonus.damageVsBossPct : stats.bonus.damageVsNormalPct;
  const cry = world.buffs.cry > 0 ? world.buffs.cryPct : 0;
  const crit = rng.next() < stats.critChance / 100;
  const damage = stats.damage * (1 + versus / 100) * (1 + cry / 100) * (crit ? balance.hero.critMultiplier : 1);
  return { damage, crit };
}

function castSkill(state, world, skill, stats, rng, balance, enc, front) {
  const value = skillValue(skill, state.skills[skill.id]);
  if (skill.type === 'buff') {
    world.buffs.cryPct = Math.max(world.buffs.cry > 0 ? world.buffs.cryPct : 0, value);
    world.buffs.cry = Math.max(world.buffs.cry, skill.duration);
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
  emit(world, 'skill', { skillId: skill.id, x: front?.x ?? balance.world.heroX + 20 });
}

function castCompanion(state, world, companion, skill, stats, rng, balance, enc, front) {
  // v8.9 : × rareté × étoiles (chaque doublon renforce les compétences).
  const aff = (dungeonAffinity(state, companion.id, balance) ? balance.dungeonAffinity.skillMultiplier : 1)
    * (RARITY_SKILL[companion.rarity] ?? 1) * skillPower(state, companion.id);
  if (skill.type === 'gold') {
    gainGold(state, world, referenceKillGold(enc.level, balance) * skill.value * (1 + stats.goldPct / 100) * (stats.goldMult ?? 1) * earlyBoost(state, balance).gold);
  } else if (skill.type === 'heal') {
    world.hero.hp = Math.min(stats.maxHp, world.hero.hp + (stats.maxHp * skill.value * Math.min(aff, 3)) / 100);
  } else if (skill.type === 'shield') {
    world.buffs.shield = skill.duration ?? 6;
    world.buffs.shieldPct = Math.max(world.buffs.shield > 0 ? world.buffs.shieldPct : 0, Math.min(90, skill.value));
  } else if (skill.type === 'rally') {
    world.buffs.cry = Math.max(world.buffs.cry, skill.duration ?? 6);
    world.buffs.cryPct = Math.max(world.buffs.cryPct, skill.value * Math.min(aff, 3));
  } else if (skill.type === 'hit' && front) {
    hitEnemy(state, world, front, stats.damage * skill.value * aff, rng, balance, stats, enc, 'companion', companion.id);
  } else if (skill.type === 'burst') {
    for (const enemy of [...world.enemies]) hitEnemy(state, world, enemy, stats.damage * skill.value * aff, rng, balance, stats, enc, 'companion', companion.id);
  }
  emit(world, 'companionSkill', { companionId: companion.id, skill: skill.index, skillType: skill.type, ultimate: Boolean(skill.ultimate) });
}

// Défaite : en campagne, le héros recule d'une étape (v8.0 : l'avance automatique reste active,
// il refait l'étape précédente puis retente — elle ne se décoche plus toute seule) ;
// en donjon, l'expédition s'arrête (les salles gagnées restent acquises).
function heroDies(state, world, balance) {
  const hero = world.hero;
  const from = state.stage;
  hero.dead = true;
  hero.hp = 0;
  hero.respawnTimer = balance.hero.respawnSeconds;
  // Donjon : on note où l'on en était (salle, PV restants du boss) avant de vider la vague.
  const boss = state.dungeon || state.tower || state.challenge ? world.enemies.find((e) => e.boss && !e.summoned) : null;
  const bossHpPct = boss ? Math.max(0, Math.round((boss.hp / boss.maxHp) * 1000) / 10) : null;
  resetWave(world, balance);
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
  if (isBossStage(from, balance)) state.bossRetry = { stage: from, power: heroPower(state, balance) };
  if (state.stage > 1) state.stage -= 1;
  state.kills = 0;
  emit(world, 'heroDeath', { from, to: state.stage, boss: isBossStage(from, balance) });
}

export function step(state, world, dt, rng, balance = BALANCE) {
  world.time += dt;
  state.playSeconds = (state.playSeconds ?? 0) + dt;
  // Positions du pas précédent : le rendu interpole entre les deux (sans effet sur la partie).
  world.prevScroll = world.scroll;
  for (const enemy of world.enemies) {
    enemy.prevX = enemy.x;
    if (enemy.mutation) mutationTick(enemy, dt);
  }
  const hero = world.hero;
  // Boosts à durée limitée : minuteries (et relance automatique si activée).
  if (state.rushes) {
    const { ended, started } = tickRushes(state, dt);
    for (const id of started) emit(world, 'rushStart', { id });
    for (const id of ended) emit(world, 'rushEnd', { id });
  }
  const stats = computeHeroStats(state, balance);
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
  if (!state.challenge || !challengeRule(state, 'noHeal')) hero.hp = Math.min(stats.maxHp, hero.hp + stats.regenPerSecond * dt);
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
  hero.walking = !front || front.x - W.heroX > range;
  const scroll = hero.walking ? W.scrollSpeed : 0;
  world.scroll += scroll * dt;
  world.enemies.forEach((enemy, i) => {
    const prev = world.enemies[i - 1];
    const gap = W.enemyGap * (enemy.boss || prev?.boss ? 2 : 1);
    const stopX = prev ? prev.x + gap : W.heroX + W.meleeOffset + enemy.range;
    enemy.x = Math.max(stopX, enemy.x - (enemy.speed + scroll) * dt);
    enemy.engaged = !prev && enemy.x <= stopX + 0.01;
  });

  const inRange = front && front.x - W.heroX <= range;

  // Attaque automatique du héros sur l'ennemi le plus proche.
  if (inRange) {
    hero.attackTimer -= dt;
    if (hero.attackTimer <= 0) {
      hero.attackTimer += stats.attackInterval;
      const { damage, crit } = heroDamage(stats, front, world, rng, balance);
      world.attackCount = (world.attackCount ?? 0) + 1;
      const extra = classAttackTargets(heroClass, world, front, damage, world.attackCount);
      emit(world, 'heroAttack', {
        enemyId: front.id, damage, crit, x: front.x, boss: front.boss, kind: heroClass.attack.kind,
        special: extra.special, targets: extra.hits.map((h) => ({ id: h.enemy.id, x: h.enemy.x })),
      });
      hitEnemy(state, world, front, damage, rng, balance, stats, enc, 'attack');
      for (const h of extra.hits) hitEnemy(state, world, h.enemy, h.damage, rng, balance, stats, enc, 'attack');
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
  if (state.skillAuto) {
    for (const skill of activeSkills(state)) {
      world.skillTimers[skill.id] = (world.skillTimers[skill.id] ?? 1) - dt;
      const target = world.enemies[0];
      if (world.skillTimers[skill.id] <= 0 && target && target.x - W.heroX <= range) {
        castSkill(state, world, skill, stats, rng, balance, enc, target);
        world.skillTimers[skill.id] = skillCooldown(skill, stats.bonus);
      }
    }
  }

  // Compétences des compagnons (v8.9 : jusqu'à 4 chacun, chacune avec sa recharge).
  for (const companion of equippedCompanions(state)) {
    for (const skill of companionSkills(state, companion.id)) {
      const key = `${companion.id}#${skill.index}`;
      world.companionTimers[key] = (world.companionTimers[key] ?? skill.every / 2 + skill.index) - dt;
      const target = world.enemies[0];
      const needsTarget = ['hit', 'burst'].includes(skill.type);
      if (world.companionTimers[key] <= 0 && (!needsTarget || (target && target.x - W.heroX <= range + 20))) {
        castCompanion(state, world, companion, skill, stats, rng, balance, enc, target);
        world.companionTimers[key] = skill.every;
      }
    }
  }

  // Seul l'ennemi au contact frappe.
  const attacker = world.enemies[0];
  if (attacker?.engaged) attacker.age = (attacker.age ?? 0) + dt;
  // v9.0.6 : boss invocateur — des serviteurs surgissent devant lui à intervalles réguliers.
  for (const boss of [...world.enemies]) {
    if (boss.trait !== 'summoner' || boss.hp <= 0) continue;
    boss.summonTimer -= dt;
    if (boss.summonTimer > 0) continue;
    const t = TRAITS.summoner;
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
    attacker.attackTimer -= dt * traitAtk.speed;
    if (attacker.attackTimer <= 0) {
      attacker.attackTimer += attacker.attackInterval;
      const lowHp = hero.hp < stats.maxHp * POWER_RULES.lowHpThreshold ? stats.bonus.lowHpArmor : 0;
      const st = balance.stages;
      const armor = Math.min(balance.hero.armorCapPct, stats.armor + lowHp) * (attacker.boss ? 1 - st.bossArmorPierce : 1);
      const shield = world.buffs.shield > 0 ? world.buffs.shieldPct : 0;
      // Rage : un boss qui dure trop longtemps frappe de plus en plus fort.
      const instant = state.challenge && challengeRule(state, 'instantRage');
      // Étape 4 : rage multiplicative (×1,3 toutes les 10 s) — un combat de boss se joue en 60–90 s au plus,
      // au lieu de 7 à 10 minutes d'usure quand le héros est juste assez fort pour survivre.
      const rage = attacker.boss && (attacker.age > st.enrageSeconds || instant)
        ? (1 + st.enragePct / 100) ** (1 + Math.floor(Math.max(0, attacker.age - st.enrageSeconds) / st.enrageStepSeconds)) : 1;
      if (rage > 1 && !attacker.enraged) {
        attacker.enraged = true;
        emit(world, 'bossEnrage', { enemyId: attacker.id, kind: attacker.type });
      }
      const damage = attacker.damage * rage * traitAtk.damage * (1 - armor / 100) * (1 - shield / 100) * dungeonDamageTaken(state, balance);
      hero.hp -= damage;
      mutationOnHit(attacker, damage);
      emit(world, 'heroHit', { enemyId: attacker.id, damage, boss: attacker.boss });
      if (stats.thorns > 0) hitEnemy(state, world, attacker, (damage * stats.thorns) / 100, rng, balance, stats, enc, 'thorns');
      if (hero.hp <= 0) heroDies(state, world, balance);
    }
  }
}
