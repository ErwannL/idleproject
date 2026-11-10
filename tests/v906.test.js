import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { makeItem, itemPower } from '../src/core/loot.js';
import { equipItem } from '../src/core/inventory.js';
import { CLASSES } from '../src/data/classes.js';
import { activeClass, canEquip, classUnlocked, classWeaponBases, setHeroClass, weaponClass } from '../src/core/classes.js';
import { classAttackTargets } from '../src/core/combat.js';
import { BOSS_TRAITS, TRAITS, traitAttack, traitDamageTaken } from '../src/core/boss-traits.js';
import { BOSSES } from '../src/data/enemies.js';
import { featuredUnit, summon, summonOdds, summonPool } from '../src/core/gacha.js';
import { HEROES } from '../src/data/heroes.js';
import { Rng } from '../src/core/rng.js';

const NOW = Date.UTC(2026, 9, 29, 12);

test('v9.0.6 : 10 classes, chacune avec au moins une arme réservée', () => {
  assert.equal(CLASSES.length, 10);
  for (const c of CLASSES) assert.ok(classWeaponBases(c.id).length >= 1, c.id);
  // Chaque famille d'arme n'appartient qu'à une seule classe.
  const families = CLASSES.flatMap((c) => c.weapons);
  assert.equal(new Set(families).size, families.length);
});

test('v9.0.6 : armes réservées à la classe ; changer de classe reforge l\'arme sans perte', () => {
  const s = createNewState(NOW, 3);
  assert.equal(activeClass(s).id, 'knight');
  const bow = makeItem(s, 'short_bow', 'rare', 5);
  s.inventory.push(bow);
  assert.equal(weaponClass('short_bow').id, 'archer');
  assert.equal(canEquip(s, bow), false);
  assert.equal(equipItem(s, bow.id), false);
  // Classe verrouillée tant que l'étape n'est pas atteinte.
  assert.equal(classUnlocked(s, 'necromancer'), false);
  assert.equal(setHeroClass(s, 'necromancer'), null);
  // Archer : l'arc du sac est équipé, l'épée retourne au sac.
  const sword = s.equipment.weapon;
  assert.ok(setHeroClass(s, 'archer', itemPower).swapped);
  assert.equal(s.equipment.weapon.id, bow.id);
  assert.ok(s.inventory.some((i) => i.id === sword.id));
  // Mage de feu sans bâton : l'arc est reforgé en bâton, mêmes niveau, rareté, effets et renforcements ;
  // v9.1.3 (doc3 lot 1) : statistiques de la nouvelle base (avant : celles de l'arc gardées).
  const w0 = s.equipment.weapon;
  const before = { id: w0.id, level: w0.level, rarity: w0.rarity, affixes: JSON.stringify(w0.affixes), upgrades: w0.upgrades };
  const r = setHeroClass(s, 'pyromancer', itemPower);
  assert.ok(r.reforged);
  assert.equal(weaponClass(s.equipment.weapon.baseId).id, 'pyromancer');
  assert.equal(s.equipment.weapon.id, before.id);
  assert.equal(s.equipment.weapon.level, before.level);
  assert.equal(s.equipment.weapon.rarity, before.rarity);
  assert.equal(JSON.stringify(s.equipment.weapon.affixes), before.affixes);
  assert.equal(s.equipment.weapon.upgrades, before.upgrades);
  const fresh = makeItem(s, s.equipment.weapon.baseId, before.rarity, before.level);
  assert.deepEqual(s.equipment.weapon.stats, fresh.stats);
  // Sauvegarde : la classe est conservée.
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.heroClass, 'pyromancer');
  assert.equal(sanitizeState({ ...JSON.parse(JSON.stringify(s)), heroClass: 'nope' }).heroClass, 'knight');
});

test('v9.0.6 : attaques de classe — zone, perçant, chaîne, volée, météore', () => {
  const enemies = [0, 1, 2, 3].map((i) => ({ id: i, x: 100 + i * 15 }));
  const world = { enemies };
  const byId = (id) => CLASSES.find((c) => c.id === id);
  const fire = classAttackTargets(byId('pyromancer'), world, enemies[0], 100, 1);
  assert.ok(fire.hits.length >= 1 && fire.hits.every((h) => h.damage === 60));
  assert.equal(classAttackTargets(byId('pyromancer'), world, enemies[0], 100, 6).special, 'meteor');
  assert.equal(classAttackTargets(byId('stormcaller'), world, enemies[0], 100, 1).hits.length, 3);
  assert.equal(classAttackTargets(byId('crossbowman'), world, enemies[0], 100, 1).hits.length, 3);
  assert.equal(classAttackTargets(byId('archer'), world, enemies[0], 100, 4).special, 'volley');
  assert.equal(classAttackTargets(byId('knight'), world, enemies[0], 100, 1).hits.length, 0);
});

test('v9.0.6 : mécaniques de boss (carapace, fournaise, désespoir)', () => {
  for (const id of Object.keys(BOSS_TRAITS)) assert.ok(BOSSES[id], id);
  const golem = { trait: 'armored' };
  const first = traitDamageTaken(golem, 100);
  const second = traitDamageTaken(golem, 100);
  assert.equal(first, 100 * (1 - TRAITS.armored.shell / 100));
  assert.ok(second > first); // la carapace s'use
  assert.ok(traitAttack({ trait: 'escalate', age: 30 }).damage > 1.5);
  assert.equal(traitAttack({ trait: 'desperate', hp: 90, maxHp: 100 }).damage, 1);
  assert.equal(traitAttack({ trait: 'desperate', hp: 40, maxHp: 100 }).damage, TRAITS.desperate.damage);
  assert.equal(traitAttack({ trait: 'desperate', hp: 40, maxHp: 100 }, 40).damage, 1); // armure solide : bonus annulé
  assert.equal(traitAttack({ trait: 'escalate', age: 9999 }).damage, TRAITS.escalate.maxDamage);
});

test('v9.0.6 : invocation de héros — skins, vedette Roi Grombar, sauvegarde', () => {
  // v9.2.8 : les apparences ne s'invoquent plus (cosmétiques de boutique) ; l'ancien bassin 'hero' devient la limitée.
  assert.ok(summonPool('hero').every((u) => u.kind === 'companion'));
  void summonOdds; void featuredUnit;
  for (const h of HEROES.filter((x) => x.skin)) assert.deepEqual(h.palette, { skin: h.skin });
  const s = createNewState(NOW, 9);
  s.heroes.owned.grombar = { stars: 1 };
  s.gems = 10000;
  const res = summon(s, new Rng(5), 10, 'gems', undefined, 'hero');
  assert.ok(res.every((r) => r.kind === 'companion'));
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.ok(back.heroes.owned.grombar);
});

test('v9.0.6 : serviteurs de l\'Invocatrice — au plus 4, jamais de gemmes de boss, la file ne s\'emballe pas', async () => {
  const { createCombat, step } = await import('../src/core/combat.js');
  const s = createNewState(NOW, 11);
  Object.assign(s, { maxStage: 20, stage: 20, level: 1, autoAdvance: false });
  const world = createCombat(s);
  const rng = new Rng(3);
  let boss = null;
  for (let i = 0; i < 4000 && !boss; i++) {
    step(s, world, 0.05, rng);
    boss = world.enemies.find((e) => e.boss);
  }
  assert.ok(boss, 'boss apparu');
  boss.trait = 'summoner';
  boss.summonTimer = 0;
  boss.hp = boss.maxHp = 1e12; // boss increvable : on laisse tourner 10 minutes
  let maxMinions = 0;
  for (let i = 0; i < 12000; i++) {
    step(s, world, 0.05, rng);
    for (const e of world.enemies) if (e.minionOf) { e.hp = e.maxHp; assert.ok(!e.summoned && !e.boss); }
    maxMinions = Math.max(maxMinions, world.enemies.filter((e) => e.minionOf === boss.id).length);
    if (!world.enemies.includes(boss)) break;
  }
  assert.ok(maxMinions <= TRAITS.summoner.maxAlive, `serviteurs : ${maxMinions}`);
  assert.ok(world.enemies.length <= TRAITS.summoner.maxAlive + 6, `file : ${world.enemies.length}`);
  assert.ok(Math.max(...world.enemies.map((e) => e.x)) < 2000, 'la file ne recule pas sans fin');
});

test('étape 2–3 : Renaissance au prorata de l\'étape, « Équiper le meilleur »', async () => {
  const { rebirthGain, rebirthPower } = await import('../src/core/rebirth.js');
  const { equipBest } = await import('../src/core/inventory.js');
  const s = createNewState(NOW, 12);
  s.maxStage = 31;
  assert.ok(Math.abs(rebirthGain(s) - 0.15) < 1e-9); // étape 30 sur 200 → 15 % d'une Renaissance pleine
  s.maxStage = 900;
  assert.equal(rebirthGain(s), 1);
  assert.equal(rebirthPower({ records: { rebirths: 3 } }), 3); // ancienne sauvegarde
  // Équiper le meilleur : l'arme forte et le casque (emplacement vide) sont équipés, l'arme faible reste au sac.
  const weak = makeItem(s, 'short_sword', 'common', 1);
  const strong = makeItem(s, 'greatsword', 'legendary', 20);
  const helm = makeItem(s, 'iron_helm', 'rare', 5);
  s.equipment.helmet = null; // v9.3.8 : le casque a de nouveau sa place
  s.inventory.push(weak, strong, helm);
  assert.equal(equipBest(s), 2);
  assert.equal(s.equipment.weapon.id, strong.id);
  assert.equal(s.equipment.helmet.id, helm.id);
  assert.equal(equipBest(s), 0);
});
