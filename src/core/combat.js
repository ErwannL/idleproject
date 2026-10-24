// Simulation du combat automatique, à pas fixe et sans dépendance au rendu.
// `state` = données sauvegardées ; `world` = état transitoire du combat (positions, PV, minuteries).
// La simulation émet des événements (world.events) que le rendu et l'interface consomment.
import { BALANCE } from '../data/balance.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { ZONES } from '../data/zones.js';
import { addGold } from './economy.js';
import { addToInventory } from './inventory.js';
import { generateItem } from './loot.js';
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
  const n = stage - 1;
  return {
    hp: Math.round(def.hp * growth.hpGrowth ** n * (boss ? st.bossHpMultiplier : 1)),
    damage: def.damage * growth.damageGrowth ** n * (boss ? st.bossDamageMultiplier : 1),
    gold: Math.max(1, Math.round(def.gold * growth.goldGrowth ** n * (boss ? st.bossGoldMultiplier : 1))),
    speed: def.speed,
    attackInterval: def.attackInterval * (boss ? 1.2 : 1),
    range: def.range + (boss ? 8 : 0),
  };
}

export function createCombat(state, balance = BALANCE) {
  return {
    time: 0,
    nextEnemyId: 1,
    enemies: [],
    hero: {
      hp: computeHeroStats(state, balance).maxHp,
      attackTimer: 0.3,
      dead: false,
      respawnTimer: 0,
      walking: true,
    },
    spawnTimer: 0.5,
    bossDelay: balance.stages.bossSpawnDelaySeconds,
    scroll: 0,
    events: [],
    recordEvents: true,
    counters: { gold: 0, kills: 0, drops: 0 },
  };
}

function emit(world, type, data = {}) {
  if (!world.recordEvents) return;
  world.events.push({ type, time: world.time, ...data });
  if (world.events.length > MAX_EVENTS) world.events.splice(0, world.events.length - MAX_EVENTS);
}

function spawnEnemy(state, world, rng, balance) {
  const boss = isBossStage(state.stage, balance);
  const zone = zoneForStage(state.stage, balance);
  const type = rng.pick(boss ? zone.bosses : zone.enemies);
  const s = enemyStats(state.stage, type, boss, balance);
  const enemy = {
    id: world.nextEnemyId++,
    type,
    boss,
    x: balance.world.spawnX + (boss ? 10 : 0),
    hp: s.hp,
    maxHp: s.hp,
    damage: s.damage,
    gold: s.gold,
    speed: s.speed,
    attackInterval: s.attackInterval,
    attackTimer: s.attackInterval * 0.6,
    range: s.range,
    engaged: false,
  };
  world.enemies.push(enemy);
  emit(world, boss ? 'bossSpawn' : 'spawn', { enemyId: enemy.id, kind: type });
}

export function changeStage(state, world, stage, balance = BALANCE) {
  const target = Math.max(1, Math.min(stage, state.maxStage));
  const zoneChanged = zoneIndexForStage(target, balance) !== zoneIndexForStage(state.stage, balance);
  state.stage = target;
  state.kills = 0;
  // Nouvelle vague : les ennemis restants quittent la scène.
  world.enemies = [];
  world.spawnTimer = 0.8;
  world.bossDelay = balance.stages.bossSpawnDelaySeconds;
  emit(world, 'stage', { stage: target, zoneChanged, boss: isBossStage(target, balance) });
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

function killEnemy(state, world, enemy, rng, balance) {
  world.enemies.splice(world.enemies.indexOf(enemy), 1);
  const gold = addGold(state, enemy.gold);
  world.counters.gold += gold;
  world.counters.kills += 1;
  state.records.kills += 1;
  emit(world, 'kill', { enemyId: enemy.id, kind: enemy.type, boss: enemy.boss, gold, x: enemy.x });

  const dropChance = enemy.boss ? 1 : balance.loot.dropChance;
  if (rng.next() < dropChance) {
    const minRarity = enemy.boss ? balance.loot.bossMinRarity : 'common';
    const item = generateItem(state, rng, { level: state.stage, minRarity }, balance);
    world.counters.drops += 1;
    const result = addToInventory(state, item, balance);
    emit(world, 'drop', { item, x: enemy.x, autoRecycled: !result.added, recycledGold: result.recycledGold });
  }

  if (enemy.boss) {
    state.records.bossesDefeated += 1;
    emit(world, 'bossDefeated', { kind: enemy.type, stage: state.stage });
    clearStage(state, world, balance);
  } else {
    const needed = balance.stages.killsPerStage;
    if (state.kills < needed) state.kills += 1;
    if (state.kills >= needed) clearStage(state, world, balance);
  }
}

// Défaite : le héros recule d'une étape et passe en mode farm (pas d'avancée automatique).
function heroDies(state, world, balance) {
  const hero = world.hero;
  const from = state.stage;
  hero.dead = true;
  hero.hp = 0;
  hero.respawnTimer = balance.hero.respawnSeconds;
  state.autoAdvance = false;
  world.enemies = [];
  if (state.stage > 1) state.stage -= 1;
  state.kills = 0;
  world.spawnTimer = 0.8;
  world.bossDelay = balance.stages.bossSpawnDelaySeconds;
  emit(world, 'heroDeath', { from, to: state.stage });
}

export function step(state, world, dt, rng, balance = BALANCE) {
  world.time += dt;
  const hero = world.hero;
  const stats = computeHeroStats(state, balance);

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

  // Apparition des ennemis.
  if (isBossStage(state.stage, balance)) {
    if (world.enemies.length === 0) {
      world.bossDelay -= dt;
      if (world.bossDelay <= 0) {
        spawnEnemy(state, world, rng, balance);
        world.bossDelay = balance.stages.bossSpawnDelaySeconds;
      }
    }
  } else {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      if (world.enemies.length < balance.spawn.maxAlive) spawnEnemy(state, world, rng, balance);
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
    const stopX = prev ? prev.x + gap : W.heroX + enemy.range;
    enemy.x = Math.max(stopX, enemy.x - (enemy.speed + scroll) * dt);
    enemy.engaged = !prev && enemy.x <= stopX + 0.01;
  });

  // Attaque du héros sur l'ennemi le plus proche.
  if (front && front.x - W.heroX <= W.heroRange) {
    hero.attackTimer -= dt;
    if (hero.attackTimer <= 0) {
      hero.attackTimer += stats.attackInterval;
      front.hp -= stats.damage;
      emit(world, 'heroAttack', { enemyId: front.id, damage: stats.damage, x: front.x, boss: front.boss });
      if (front.hp <= 0) killEnemy(state, world, front, rng, balance);
    }
  } else {
    hero.attackTimer = Math.min(hero.attackTimer, 0.25);
  }

  // Seul l'ennemi au contact frappe.
  const attacker = world.enemies[0];
  if (attacker?.engaged) {
    attacker.attackTimer -= dt;
    if (attacker.attackTimer <= 0) {
      attacker.attackTimer += attacker.attackInterval;
      const damage = attacker.damage * (1 - stats.armor / 100);
      hero.hp -= damage;
      emit(world, 'heroHit', { enemyId: attacker.id, damage, boss: attacker.boss });
      if (hero.hp <= 0) heroDies(state, world, balance);
    }
  }
}
