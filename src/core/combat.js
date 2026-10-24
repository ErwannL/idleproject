// Simulation du combat automatique, à pas fixe et sans dépendance au rendu.
// `state` = données sauvegardées ; `world` = état transitoire du combat (positions, PV, minuteries).
// La simulation émet des événements (world.events) que le rendu et l'interface consomment.
import { BALANCE } from '../data/balance.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { POWER_RULES } from '../data/powers.js';
import { ZONES } from '../data/zones.js';
import { equippedCompanions } from './companions.js';
import { trackContracts } from './contracts.js';
import { completeDungeon, dungeonById, dungeonKill, failDungeon } from './dungeon.js';
import { addGold } from './economy.js';
import { rollEvent } from './events.js';
import { addToInventory } from './inventory.js';
import { addXp, killXp } from './level.js';
import { generateItem, makeSignatureItem, rarityIndex } from './loot.js';
import { recordBossVictory } from './powers.js';
import { activeSkills, skillCooldown, skillValue } from './skills.js';
import { computeHeroStats } from './stats.js';

const MAX_EVENTS = 300;

export function isBossStage(stage, balance = BALANCE) {
  return stage % balance.stages.bossEvery === 0;
}

export function zoneIndexForStage(stage, balance = BALANCE) {
  return Math.min(ZONES.length - 1, Math.floor((stage - 1) / balance.stages.stagesPerZone));
}

export function zoneForStage(stage, balance = BALANCE) {
  return ZONES[zoneIndexForStage(stage, balance)];
}

// "2-4" = zone 2, étape 4 de la zone.
export function stageLabel(stage, balance = BALANCE) {
  const zone = zoneIndexForStage(stage, balance);
  return `${zone + 1}-${stage - zone * balance.stages.stagesPerZone}`;
}

export function enemyDefinition(type, boss) {
  return boss ? ENEMIES[BOSSES[type].base] : ENEMIES[type];
}

export function enemyStats(stage, type, boss, balance = BALANCE) {
  const def = enemyDefinition(type, boss);
  const growth = balance.enemyScaling;
  const st = balance.stages;
  const n = Math.max(0, stage - 1);
  return {
    hp: Math.round(def.hp * growth.hpGrowth ** n * (boss ? st.bossHpMultiplier : 1)),
    damage: def.damage * growth.damageGrowth ** n * (boss ? st.bossDamageMultiplier : 1),
    gold: Math.max(1, Math.round(def.gold * growth.goldGrowth ** n * (boss ? st.bossGoldMultiplier : 1))),
    speed: def.speed,
    attackInterval: def.attackInterval * (boss ? 1.2 : 1),
    range: def.range + (boss ? 8 : 0),
  };
}

// Or d'un ennemi ordinaire de référence à une étape (sert d'unité pour les coûts et récompenses).
export function referenceKillGold(stage, balance = BALANCE) {
  return enemyStats(Math.max(1, stage), 'slime', false, balance).gold;
}

// Rencontre en cours : campagne (étape) ou donjon (salle).
export function currentEncounter(state, balance = BALANCE) {
  if (state.dungeon) {
    const d = dungeonById(state.dungeon.id);
    return {
      level: state.dungeon.level, boss: state.dungeon.room >= d.rooms, enemies: d.enemies, bosses: [d.boss],
      killsNeeded: d.killsPerRoom, zoneIndex: d.zone, dungeon: d,
    };
  }
  const zone = zoneForStage(state.stage, balance);
  return {
    level: state.stage, boss: isBossStage(state.stage, balance), enemies: zone.enemies, bosses: zone.bosses,
    killsNeeded: balance.stages.killsPerStage, zoneIndex: zoneIndexForStage(state.stage, balance), dungeon: null,
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
    counters: { gold: 0, kills: 0, drops: 0, xp: 0 },
  };
}

function emit(world, type, data = {}) {
  if (!world.recordEvents) return;
  world.events.push({ type, time: world.time, ...data });
  if (world.events.length > MAX_EVENTS) world.events.splice(0, world.events.length - MAX_EVENTS);
}

function spawnEnemy(state, world, rng, balance, enc, elite = false) {
  const boss = enc.boss && !elite;
  const type = rng.pick(boss ? enc.bosses : enc.enemies);
  const s = enemyStats(enc.level, type, boss, balance);
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
  };
  world.enemies.push(enemy);
  emit(world, boss ? 'bossSpawn' : elite ? 'eliteSpawn' : 'spawn', { enemyId: enemy.id, kind: type });
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
  const next = state.stage + 1;
  if (next > state.maxStage) {
    state.maxStage = next;
    emit(world, 'unlock', { stage: next });
  }
  if (state.autoAdvance) changeStage(state, world, next, balance);
}

function gainGold(state, world, amount) {
  const gold = addGold(state, amount);
  world.counters.gold += gold;
  trackContracts(state, 'gold', gold);
  return gold;
}

function dropItem(state, world, item, x, balance) {
  world.counters.drops += 1;
  const result = addToInventory(state, item, balance);
  if (rarityIndex(item.rarity) >= 1) trackContracts(state, 'rareLoot', 1);
  emit(world, 'drop', { item, x, autoRecycled: !result.added, recycledGold: result.recycledGold });
}

function killEnemy(state, world, enemy, rng, balance, stats, enc) {
  const index = world.enemies.indexOf(enemy);
  if (index < 0) return;
  world.enemies.splice(index, 1);

  const wave = world.goldWave > 0 && !enemy.boss ? balance.events.waveGoldMultiplier : 1;
  if (world.goldWave > 0 && !enemy.boss) world.goldWave -= 1;
  const gold = gainGold(state, world, enemy.gold * (1 + stats.goldPct / 100) * wave);
  world.counters.kills += 1;
  state.records.kills += 1;
  trackContracts(state, 'kills', 1);

  const xp = killXp(enc.level, enemy.boss || enemy.elite, balance) * (1 + stats.xpPct / 100);
  world.counters.xp += xp;
  const levels = addXp(state, xp, balance);
  if (levels > 0) emit(world, 'levelUp', { level: state.level });
  emit(world, 'kill', { enemyId: enemy.id, kind: enemy.type, boss: enemy.boss, elite: enemy.elite, gold, x: enemy.x });

  // Butin : objet signature possible sur les boss (butin ciblé), objet Rare+ garanti sur les boss et élites.
  const dropChance = enemy.boss || enemy.elite ? 1 : balance.loot.dropChance + stats.bonus.dropChance / 100;
  if (rng.next() < dropChance) {
    const signature = enemy.boss && rng.next() < balance.loot.signatureChance
      ? makeSignatureItem(state, enemy.type, enc.level, rng, balance) : null;
    const minRarity = enemy.boss || enemy.elite ? balance.loot.bossMinRarity : 'common';
    dropItem(state, world, signature ?? generateItem(state, rng, { level: enc.level, minRarity }, balance), enemy.x, balance);
  }

  if (enemy.elite) {
    state.gems += balance.events.eliteGems;
    emit(world, 'eliteDefeated', { gems: balance.events.eliteGems });
  } else if (!enemy.boss && !enc.dungeon) {
    const event = rollEvent(state, world, rng, balance);
    if (event) emit(world, 'worldEvent', { eventType: event.type });
  }

  if (enemy.boss) {
    state.records.bossesDefeated += 1;
    trackContracts(state, 'bosses', 1);
    emit(world, 'bossDefeated', { kind: enemy.type, stage: enc.level });
    // Première victoire : pouvoir ancestral ; victoires suivantes : charge de relance.
    const power = recordBossVictory(state, enemy.type, rng, balance);
    if (power) emit(world, 'powerUnlocked', { bossId: enemy.type, powerId: power.id });
    else emit(world, 'rerollCharge', { bossId: enemy.type });
    if (enc.dungeon) {
      const result = completeDungeon(state, rng, balance);
      resetWave(world, balance);
      emit(world, 'dungeonComplete', result);
    } else {
      clearStage(state, world, balance);
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
function hitEnemy(state, world, enemy, damage, rng, balance, stats, enc, source) {
  if (!world.enemies.includes(enemy)) return;
  enemy.hp -= damage;
  if (stats.lifesteal > 0 && source !== 'thorns') {
    world.hero.hp = Math.min(stats.maxHp, world.hero.hp + (damage * stats.lifesteal) / 100);
  }
  emit(world, 'enemyHit', { enemyId: enemy.id, damage, x: enemy.x, boss: enemy.boss, source });
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
    world.buffs.cry = skill.duration;
    world.buffs.cryPct = value;
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

function castCompanion(state, world, companion, stats, rng, balance, enc, front) {
  const { skill } = companion;
  if (skill.type === 'gold') {
    gainGold(state, world, referenceKillGold(enc.level, balance) * skill.value * (1 + stats.goldPct / 100));
  } else if (skill.type === 'heal') {
    world.hero.hp = Math.min(stats.maxHp, world.hero.hp + (stats.maxHp * skill.value) / 100);
  } else if (skill.type === 'shield') {
    world.buffs.shield = skill.duration;
    world.buffs.shieldPct = skill.value;
  } else if (skill.type === 'hit' && front) {
    hitEnemy(state, world, front, stats.damage * skill.value, rng, balance, stats, enc, 'companion');
  } else if (skill.type === 'burst') {
    for (const enemy of [...world.enemies]) hitEnemy(state, world, enemy, stats.damage * skill.value, rng, balance, stats, enc, 'companion');
  }
  emit(world, 'companionSkill', { companionId: companion.id });
}

// Défaite : en campagne, le héros recule d'une étape et passe en mode farm ;
// en donjon, l'expédition s'arrête (les salles gagnées restent acquises).
function heroDies(state, world, balance) {
  const hero = world.hero;
  const from = state.stage;
  hero.dead = true;
  hero.hp = 0;
  hero.respawnTimer = balance.hero.respawnSeconds;
  resetWave(world, balance);
  if (state.dungeon) {
    const earned = failDungeon(state);
    emit(world, 'dungeonFailed', { earned });
    return;
  }
  state.autoAdvance = false;
  if (state.stage > 1) state.stage -= 1;
  state.kills = 0;
  emit(world, 'heroDeath', { from, to: state.stage });
}

export function step(state, world, dt, rng, balance = BALANCE) {
  world.time += dt;
  const hero = world.hero;
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
  hero.hp = Math.min(stats.maxHp, hero.hp + stats.regenPerSecond * dt);
  world.buffs.cry = Math.max(0, world.buffs.cry - dt);
  world.buffs.shield = Math.max(0, world.buffs.shield - dt);

  const enc = currentEncounter(state, balance);

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
      if (world.enemies.length < balance.spawn.maxAlive) {
        spawnEnemy(state, world, rng, balance, enc, world.pendingElite);
        world.pendingElite = false;
      }
      world.spawnTimer = balance.spawn.intervalSeconds;
    }
  }

  // Déplacement : les ennemis forment une file devant le héros.
  // Le héros « marche » (le décor défile) tant qu'aucun ennemi n'est à portée.
  const W = balance.world;
  const front = world.enemies[0];
  hero.walking = !front || front.x - W.heroX > W.heroRange;
  const scroll = hero.walking ? W.scrollSpeed : 0;
  world.scroll += scroll * dt;
  world.enemies.forEach((enemy, i) => {
    const prev = world.enemies[i - 1];
    const gap = W.enemyGap * (enemy.boss || prev?.boss ? 2 : 1);
    const stopX = prev ? prev.x + gap : W.heroX + W.meleeOffset + enemy.range;
    enemy.x = Math.max(stopX, enemy.x - (enemy.speed + scroll) * dt);
    enemy.engaged = !prev && enemy.x <= stopX + 0.01;
  });

  const inRange = front && front.x - W.heroX <= W.heroRange;

  // Attaque automatique du héros sur l'ennemi le plus proche.
  if (inRange) {
    hero.attackTimer -= dt;
    if (hero.attackTimer <= 0) {
      hero.attackTimer += stats.attackInterval;
      const { damage, crit } = heroDamage(stats, front, world, rng, balance);
      emit(world, 'heroAttack', { enemyId: front.id, damage, crit, x: front.x, boss: front.boss });
      hitEnemy(state, world, front, damage, rng, balance, stats, enc, 'attack');
    }
  } else {
    hero.attackTimer = Math.min(hero.attackTimer, 0.25);
  }

  // Compétences lancées automatiquement dès qu'un ennemi est à portée.
  if (state.skillAuto) {
    for (const skill of activeSkills(state)) {
      world.skillTimers[skill.id] = (world.skillTimers[skill.id] ?? 1) - dt;
      const target = world.enemies[0];
      if (world.skillTimers[skill.id] <= 0 && target && target.x - W.heroX <= W.heroRange) {
        castSkill(state, world, skill, stats, rng, balance, enc, target);
        world.skillTimers[skill.id] = skillCooldown(skill, stats.bonus);
      }
    }
  }

  // Compétences des compagnons.
  for (const companion of equippedCompanions(state)) {
    if (!companion.skill) continue;
    world.companionTimers[companion.id] = (world.companionTimers[companion.id] ?? companion.skill.every / 2) - dt;
    const target = world.enemies[0];
    const needsTarget = ['hit', 'burst'].includes(companion.skill.type);
    if (world.companionTimers[companion.id] <= 0 && (!needsTarget || (target && target.x - W.heroX <= W.heroRange + 20))) {
      castCompanion(state, world, companion, stats, rng, balance, enc, target);
      world.companionTimers[companion.id] = companion.skill.every;
    }
  }

  // Seul l'ennemi au contact frappe.
  const attacker = world.enemies[0];
  if (attacker?.engaged) {
    attacker.attackTimer -= dt;
    if (attacker.attackTimer <= 0) {
      attacker.attackTimer += attacker.attackInterval;
      const lowHp = hero.hp < stats.maxHp * POWER_RULES.lowHpThreshold ? stats.bonus.lowHpArmor : 0;
      const armor = Math.min(balance.hero.armorCapPct, stats.armor + lowHp);
      const shield = world.buffs.shield > 0 ? world.buffs.shieldPct : 0;
      const damage = attacker.damage * (1 - armor / 100) * (1 - shield / 100);
      hero.hp -= damage;
      emit(world, 'heroHit', { enemyId: attacker.id, damage, boss: attacker.boss });
      if (stats.thorns > 0) hitEnemy(state, world, attacker, (damage * stats.thorns) / 100, rng, balance, stats, enc, 'thorns');
      if (hero.hp <= 0) heroDies(state, world, balance);
    }
  }
}
