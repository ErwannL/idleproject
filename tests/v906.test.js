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
  // Mage de feu sans bâton : l'arc est reforgé en bâton, mêmes niveau, rareté et statistiques.
  const before = { level: s.equipment.weapon.level, rarity: s.equipment.weapon.rarity, stats: { ...s.equipment.weapon.stats } };
  const r = setHeroClass(s, 'pyromancer', itemPower);
  assert.ok(r.reforged);
  assert.equal(weaponClass(s.equipment.weapon.baseId).id, 'pyromancer');
  assert.equal(s.equipment.weapon.level, before.level);
  assert.equal(s.equipment.weapon.rarity, before.rarity);
  assert.deepEqual(s.equipment.weapon.stats, before.stats);
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
  assert.ok(fire.hits.length >= 1 && fire.hits.every((h) => h.damage === 50));
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
});

test('v9.0.6 : invocation de héros — skins, vedette Roi Grombar, sauvegarde', () => {
  const pool = summonPool('hero');
  assert.ok(pool.some((u) => u.id === 'grombar') && !pool.some((u) => u.id === 'knight'));
  for (const r of summonOdds('hero')) assert.ok(r.units.length > 0, r.rarity);
  assert.equal(featuredUnit('hero', NOW).id, 'grombar');
  for (const h of HEROES.filter((x) => x.skin)) assert.deepEqual(h.palette, { skin: h.skin });
  const s = createNewState(NOW, 9);
  s.gems = 10000;
  const res = summon(s, new Rng(5), 10, 'gems', undefined, 'hero');
  assert.equal(res.length, 10);
  assert.ok(res.every((r) => r.kind === 'hero' && s.heroes.owned[r.id]));
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  for (const r of res) assert.ok(back.heroes.owned[r.id], r.id);
});
