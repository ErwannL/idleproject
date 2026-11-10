// v9.3.3 : compétences, doublons, ressources universelles et équipement des héros (alliés) et familiers ; le chevalier
// n'est pas touché.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState, SAVE_VERSION } from '../src/core/state.js';
import { companionSkills, companionMultiplier, companionSkillMultiplier, skillKillGold, upgradeCompanionSkill } from '../src/core/companions.js';
import { dupBonusPct, dupMultiplier, skillCap, skillUpgradeCost, MIGRATED_SKILLS } from '../src/core/progression.js';
import { canEquip, equipGear, gearStats, recycleGear, rollGear, unitGearStats, upgradeGear } from '../src/core/companion-gear.js';
import { GEAR_BASES, gearClassOf } from '../src/data/companion-gear.js';
import { COMPANIONS } from '../src/data/companions.js';
import { DUP_BONUS_PCT, SKILL_COSTS } from '../src/data/progression.js';
import { BALANCE } from '../src/data/balance.js';
import { buyUpgrade, upgradeCost } from '../src/core/economy.js';
import { computeHeroStats } from '../src/core/stats.js';
import { grantReward } from '../src/core/rewards.js';
import { Rng } from '../src/core/rng.js';
import { makeItem } from '../src/core/loot.js';

const NOW = Date.UTC(2026, 10, 10, 12);
const fresh = () => { const s = createNewState(NOW, 1); s.maxStage = 60; return s; };
const rich = (s) => { s.gold = 1e15; Object.assign(s.materials, { grimoire: 1e4, ascension: 1e4, mastery: 1e4, shards: 1e6 }); return s; };

test('compétences : passive, active et ultime dès le 1er exemplaire ; ultime niv. 5 puis 10 au 4e exemplaire', () => {
  const s = rich(fresh());
  s.companions.owned.archangel = { stars: 1, level: 1 };
  const list = companionSkills(s, 'archangel');
  assert.ok(list.some((k) => k.kind === 'active') && list.some((k) => k.ultimate), 'active + ultime au 1er exemplaire');
  for (let i = 0; i < 20; i++) upgradeCompanionSkill(s, 'archangel', 'ultimate');
  assert.equal(s.companions.owned.archangel.skills.ultimate, 5, 'ultime plafonnée à 5');
  s.companions.owned.archangel.stars = 4;
  assert.equal(skillCap(s.companions.owned.archangel, 'ultimate'), 10);
  for (let i = 0; i < 20; i++) upgradeCompanionSkill(s, 'archangel', 'ultimate');
  assert.equal(s.companions.owned.archangel.skills.ultimate, 10, 'le 4e exemplaire ouvre 6 à 10 (pas gratuit)');
  for (const k of ['passive', 'active']) { for (let i = 0; i < 20; i++) upgradeCompanionSkill(s, 'archangel', k); assert.equal(s.companions.owned.archangel.skills[k], 10); }
});

test('ressources universelles : coûts consommés, mêmes matériaux pour tout perso, or indexé et plafonné', () => {
  const s = fresh();
  s.companions.owned.cat = { stars: 1, level: 1 };       // familier commun
  s.companions.owned.demon_queen = { stars: 1, level: 1 }; // héros SSR ténèbres
  grantReward(s, { grimoire: 2, gold: 0 });
  s.gold = 1e9;
  assert.equal(upgradeCompanionSkill(s, 'cat', 'active'), 2, 'familier : grimoires');
  assert.equal(s.materials.grimoire, 0);
  assert.equal(upgradeCompanionSkill(s, 'demon_queen', 'active'), null, 'plus de grimoires');
  grantReward(s, { grimoire: 2 });
  assert.equal(upgradeCompanionSkill(s, 'demon_queen', 'active'), 2, 'mêmes grimoires pour un SSR d\'un autre élément');
  const c5 = skillUpgradeCost({ stars: 1, skills: { passive: 5, active: 1, ultimate: 1 } }, 'passive', 100);
  assert.deepEqual([c5.grimoire, c5.mastery], [SKILL_COSTS.passive[4].grimoire, 1], 'niveau 5 → 6 : essence de maîtrise');
  const early = skillKillGold(s); s.maxStage = 5000; const late = skillKillGold(s);
  assert.ok(late > early && Number.isFinite(late), 'or indexé sur l\'étape');
  s.maxStage = 100000; const capped = skillKillGold(s); s.maxStage = 200000;
  assert.equal(skillKillGold(s), capped, 'plafond : l\'or ne monte plus au-delà');
});

test('doublons : 0/4/8/12/16/24 % cumulés, appliqués une seule fois', () => {
  const s = fresh();
  for (let n = 1; n <= 6; n++) {
    const o = { stars: n, level: 1 };
    assert.equal(dupBonusPct(o), DUP_BONUS_PCT[n - 1]);
    assert.ok(Math.abs(dupMultiplier(o) - (1 + DUP_BONUS_PCT[n - 1] / 100)) < 1e-12);
    s.companions.owned.shadow_lord = o;
    assert.ok(Math.abs(companionMultiplier(s, 'shadow_lord') - 1.5 * dupMultiplier(o)) < 1e-12, 'passif : une seule fois');
  }
  assert.equal(dupBonusPct({ stars: 6 }), 24);
});

test('équipement : compatibilité par classe (données), refus motivé, avant/après, amélioration, recyclage, sauvegarde', () => {
  const s = rich(fresh());
  s.companions.owned.phoenix = { stars: 1, level: 1 };   // familier
  s.companions.owned.squire = { stars: 1, level: 1 };    // gardien → défenseur
  assert.equal(gearClassOf(COMPANIONS.find((c) => c.id === 'phoenix')), 'beast');
  assert.equal(gearClassOf(COMPANIONS.find((c) => c.id === 'squire')), 'defender');
  // v9.3.4 (f) : les compagnons portent les objets communs du sac, selon la classe de l'objet.
  // v9.3.8 (2.3) : les familiers ne portent rien ; les compagnons portent les objets du sac de leur classe.
  const plate = makeItem(s, 'chainmail', 'epic', 10); plate.cls = 'defender';
  const sword = makeItem(s, 'dagger', 'rare', 10); sword.cls = 'support';
  s.inventory.push(plate, sword);
  assert.equal(canEquip(s, 'phoenix', plate).ok, false);
  assert.match(canEquip(s, 'phoenix', plate).reason, /familiers ne portent pas/);
  assert.equal(equipGear(s, 'phoenix', plate.id), false, 'familier : refusé');
  assert.match(canEquip(s, 'squire', sword).reason, /Pour : Soutien/);
  assert.equal(equipGear(s, 'squire', sword.id), false, 'pièce incompatible refusée');
  assert.ok(equipGear(s, 'squire', plate.id));
  assert.ok(!s.inventory.includes(plate), 'objet porté sorti du sac');
  const before = companionSkillMultiplier(s, COMPANIONS.find((c) => c.id === 'squire'), 'hit');
  assert.deepEqual(unitGearStats(s, 'squire'), { atk: gearStats(plate, s).atk ?? 0, hp: gearStats(plate, s).hp ?? 0, def: gearStats(plate, s).def ?? 0, heal: 0, cd: 0 });
  assert.equal(upgradeGear(s, plate.id, 10), 1);
  assert.equal(recycleGear(s, plate.id), 0, 'une pièce portée ne se recycle pas');
  assert.ok(companionSkillMultiplier(s, COMPANIONS.find((c) => c.id === 'squire'), 'hit') >= before);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, NOW);
  assert.deepEqual(back.companionGear.equipped, s.companionGear.equipped);
  assert.equal(back.companionGear.equipped.squire.armor.upgrades, 1);
  // Ancienne sauvegarde : un objet de familier porté par le phénix revient au sac, en objet de la classe du héros.
  const raw = JSON.parse(JSON.stringify(s));
  const old = JSON.parse(JSON.stringify(sword)); old.cls = 'beast'; old.id = 'it9999';
  raw.companionGear.equipped.phoenix = { weapon: old };
  const bad = sanitizeState(raw, BALANCE, NOW);
  assert.equal(bad.companionGear.equipped.phoenix, undefined, 'familier déséquipé au chargement');
  const moved = bad.inventory.find((i) => i.id === old.id);
  assert.ok(moved && moved.cls === undefined, '… objet rendu au sac, classe du héros');
  for (const b of GEAR_BASES) assert.ok(b.classes.length >= 1);
  assert.ok(rollGear(s, new Rng(3)));
});

test('sauvegarde : niveaux de compétence et ressources relus ; persos d\'avant la 9.3.3 migrés (rien de perdu)', () => {
  const s = rich(fresh());
  s.companions.owned.archangel = { stars: 2, level: 3, skills: { passive: 3, active: 6, ultimate: 4 } };
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, NOW);
  assert.deepEqual(back.companions.owned.archangel.skills, { passive: 3, active: 6, ultimate: 4 });
  assert.equal(back.materials.mastery, 1e4);
  const old = sanitizeState({ ...JSON.parse(JSON.stringify(s)), version: 10, companions: { owned: { archangel: { stars: 2, level: 3 } }, equipped: [] } }, BALANCE, NOW);
  assert.deepEqual(old.companions.owned.archangel.skills, MIGRATED_SKILLS);
  assert.equal(SAVE_VERSION, 12); // v9.3.4 : 11 → 12 (équipement unique)
});

test('chevalier préservé : améliorations permanentes, coûts et stats inchangés par les nouveaux systèmes', () => {
  const s = fresh(); s.gold = 1e12;
  const costs = Object.keys(BALANCE.upgrades).map((k) => upgradeCost(k, 7));
  for (const k of ['damage', 'attackSpeed', 'crit', 'critDamage', 'doubleAttack', 'bossDamage', 'companionPower']) buyUpgrade(s, k);
  const before = computeHeroStats(s);
  rich(s);
  s.companions.owned.archangel = { stars: 6, level: 20, skills: { passive: 10, active: 10, ultimate: 10 } };
  s.companionGear = { bag: [{ id: 1, baseId: 'focus', rarity: 'legendary', up: 10 }], nextId: 2, equipped: { archangel: { offense: 1 } } };
  const after = computeHeroStats(s);
  assert.equal(after.damage, before.damage, 'dégâts du chevalier : seuls ses améliorations et son équipement comptent');
  assert.equal(after.attackSpeed, before.attackSpeed);
  assert.deepEqual(Object.keys(BALANCE.upgrades).map((k) => upgradeCost(k, 7)), costs, 'coûts du chevalier identiques');
  assert.equal(Object.keys(BALANCE.upgrades).length, 15, '15 améliorations du chevalier conservées');
});
