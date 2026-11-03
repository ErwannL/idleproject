// v9.1.9 : coréen — toutes les données du jeu et les textes construits doivent être traduits (aucun mot français
// ni lettre latine hors sigles gardés : HP, XP, Lv., noms de touches).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lookup, translate } from '../src/i18n/ko.js';
import { BALANCE } from '../src/data/balance.js';
import { ENCYCLOPEDIA_SECTIONS as COLLECTIONS } from '../src/core/encyclopedia.js';
import { COMPANIONS } from '../src/data/companions.js';
import { CONTRACT_TYPES } from '../src/data/contracts.js';
import { DUNGEON_DIFFICULTIES, DUNGEON_PATHS, DUNGEONS } from '../src/data/dungeons.js';
import { BOSSES, ENEMIES } from '../src/data/enemies.js';
import { HEROES } from '../src/data/heroes.js';
import { AFFIXES, ITEM_BASES, RARITIES, SIGNATURE_ITEMS, SLOTS, STAT_LABELS } from '../src/data/items.js';
import * as LORE from '../src/data/lore.js';
import { MISSION_PERIODS } from '../src/data/missions.js';
import { BOSS_POWERS, EFFECT_LABELS, POWER_FAMILIES } from '../src/data/powers.js';
import { PRESTIGE_KEEPS, PRESTIGE_PERKS, PRESTIGE_RESETS } from '../src/data/prestige.js';
import { REBIRTH_KEEPS, REBIRTH_RESETS, TALENT_BRANCHES, TALENTS } from '../src/data/rebirth.js';
import { RUSHES } from '../src/data/rushes.js';
import { SKILLS } from '../src/data/skills.js';
import { LOADOUT_NAMES, ROLES, SYNERGIES } from '../src/data/synergies.js';
import { ZONES } from '../src/data/zones.js';
import { eventLabel } from '../src/core/events.js';
import { AUTO_RECYCLE_RULES, RECYCLE_MODES } from '../src/core/inventory.js';
import { rewardText } from '../src/core/rewards.js';
import { ITEM_SETS, SET_PIECES } from '../src/data/sets.js';
import { CHALLENGE_MODIFIERS } from '../src/core/challenge.js';
import { EXPEDITION_TYPES } from '../src/core/expeditions.js';
import { buildTree, TALENT_REGIONS } from '../src/data/talent-tree.js';
import { TRANSCEND_KEEPS, TRANSCEND_PERKS, TRANSCEND_RESETS } from '../src/data/transcend.js';
import { TRAITS } from '../src/core/boss-traits.js';
import { MUTATIONS } from '../src/core/mutations.js';
import { CLASSES } from '../src/data/classes.js';
import { CURRENCIES } from '../src/data/currencies.js';
import { ACHIEVEMENTS } from '../src/core/achievements.js';
import { allCompanionSkills } from '../src/core/companions.js';
import { skillText } from '../src/data/companion-skills.js';

// Lettres latines tolérées en coréen : sigles et unités du jeu (HP, XP, Lv., K/M/B/T, aa…zz), touches.
const KEEP = /\b(?:HP|XP|Lv|FPS|NEW|PC|ms|K|M|B|T|Qa|Qi|SR|SSR|UR|Esc|Shift|Tab|Enter|Space|Ctrl|Alt|GitHub|Ascendrya|Language|EFFACER|DPS|I{1,3}|C|R|É|L|S|G|N|Q|W|E)\b|(\d) ?[a-z]{2}\b/g;
const latin = (s) => /[A-Za-zÀ-ÿ]{2}|[éèàçùêâîôûœ]/i.test(String(s).replace(KEEP, '$1'));

// Effets affichés comme dans le jeu (ui/common.js effectText).
const effectText = (effects) => Object.entries(effects).map(([k, v]) => EFFECT_LABELS[k]?.(v)).filter(Boolean).join(' · ');

function gameTexts() {
  const tree = buildTree();
  const nodes = Array.isArray(tree) ? tree : tree.nodes;
  return [
    ...Object.values(ENEMIES).map((e) => e.name), ...Object.values(BOSSES).map((b) => b.name),
    ...COMPANIONS.flatMap((c) => [c.name, c.skill?.name, c.skill?.text, c.title, c.quote]),
    ...COMPANIONS.flatMap((c) => allCompanionSkills(c.id).flatMap((sk) => [sk.name, sk.text ?? skillText(sk)])),
    ...SKILLS.map((s) => s.name), ...SKILLS.map((s) => s.text('1,5')),
    ...TALENTS.map((x) => x.name), ...TALENT_BRANCHES.map((b) => b.label), ...TALENT_REGIONS.map((r) => r.label),
    ...nodes.flatMap((n) => [n.name, n.text, n.effects ? effectText(n.effects) : null]),
    ...PRESTIGE_PERKS.map((p) => p.name), ...PRESTIGE_RESETS, ...PRESTIGE_KEEPS, ...REBIRTH_RESETS, ...REBIRTH_KEEPS,
    ...Object.values(BOSS_POWERS).flat().flatMap((p) => [p.name, effectText(p.effects)]), ...Object.values(POWER_FAMILIES).map((f) => f.label),
    ...Object.values(EFFECT_LABELS).map((fn) => fn(12)), ...Object.values(EFFECT_LABELS).map((fn) => fn(1.5)), ...Object.values(AFFIXES).map((a) => a.label(3)),
    ...ITEM_BASES.map((i) => i.name), ...SIGNATURE_ITEMS.map((i) => i.name),
    ...Object.values(SLOTS), ...RARITIES.map((r) => r.label), ...Object.values(STAT_LABELS),
    ...ZONES.map((z) => z.name), ...DUNGEONS.flatMap((d) => [d.name, d.description]),
    ...Object.values(DUNGEON_PATHS).flatMap((p) => [p.label, p.text]), ...Object.values(DUNGEON_DIFFICULTIES).map((d) => d.label),
    ...HEROES.flatMap((h) => [h.name, h.role, h.description, h.title, h.quote, h.element]),
    ...MISSION_PERIODS.flatMap((p) => [p.label, p.reset, ...p.missions.map((m) => m.label)]),
    ...Object.values(CONTRACT_TYPES).flatMap((c) => [c.title, c.label(12)]),
    ...RUSHES.flatMap((r) => [r.name, r.text]), ...Object.values(ROLES).map((r) => r.label),
    ...SYNERGIES.flatMap((s) => [s.name, s.text]), ...LOADOUT_NAMES, ...COLLECTIONS.map((c) => c.label),
    ...Object.values(LORE).flatMap((v) => (typeof v === 'object' ? Object.values(v) : [])),
    ...Object.values(BALANCE.upgrades).flatMap((u) => [u.label, u.description]),
    ...BALANCE.upgradeCategories.map((c) => c.label), ...Object.values(BALANCE.summon.pools).map((p) => p.label),
    ...['chest', 'merchant', 'elite', 'wave', 'gems', 'portal', 'wanderer'].map(eventLabel),
    ...Object.values(RECYCLE_MODES), ...Object.values(AUTO_RECYCLE_RULES),
    rewardText({ gold: 1200, gems: 5, tickets: 1, keys: 2, fragments: 3, shards: 4, essence: 1 }),
    ...ITEM_SETS.flatMap((x) => [x.name, ...SET_PIECES.map((n) => `${n} pièces : ${effectText(x.bonuses[n])}`)]),
    ...CHALLENGE_MODIFIERS.flatMap((m) => [m.name, m.text]), ...EXPEDITION_TYPES.flatMap((x) => [x.label, x.text]),
    ...TRANSCEND_PERKS.flatMap((p) => [p.name, p.text(3)]), ...TRANSCEND_RESETS, ...TRANSCEND_KEEPS,
    ...Object.values(TRAITS).flatMap((t) => [t.name, t.text, t.counter]), ...MUTATIONS.flatMap((m) => [m.name, m.text]),
    ...CLASSES.flatMap((c) => [c.name, c.text, c.description, c.range]), ...Object.values(CURRENCIES).flatMap((c) => [c.label, c.name, c.use, c.from, c.source]),
    ...ACHIEVEMENTS.flatMap((a) => [a.name, a.label]),
  ].filter((s) => typeof s === 'string' && s.trim());
}

test('coréen : toutes les données du jeu sont traduites, sans lettre latine', () => {
  const bad = [...new Set(gameTexts())].filter((s) => lookup(s.replace(/\s+/g, ' ').trim()) === null || latin(translate(s)));
  assert.deepEqual(bad, []);
});

test('coréen : écrans signalés (Paramètres › Interface, fiche d\'objet, donjons)', () => {
  const cases = {
    'Thème': '테마', 'CET APPAREIL': '이 기기', 'Taille de l\'interface': '인터페이스 크기', 'Tout voir (K)': '모두 보기 (K)',
    'Auto (réglage du système)': '자동 (시스템 설정)', "Simple (l'essentiel)": '간단 (핵심만)',
    '2 pièces : +1 % PV/s': '2세트: 초당 HP 회복 +1%', '4 pièces : épines 40 %': '4세트: 가시 40%', '6 pièces : PV max ×1,55': '6세트: 최대 HP ×1.55',
    '0/6 portées': '0/6 착용', 'Colosse de magma — Carapace': '마그마 거신 — 갑각',
    'encaisse −60 % des dégâts ; chaque coup reçu use sa carapace de 1,5 point.': '받는 피해 −60%. 맞을 때마다 갑각이 1.5 닳아요.',
    "Vitesse d'attaque, coups multiples": '공격 속도, 다단 히트', 'Aller à Héros › Équipement': '영웅 › 장비(으)로 이동',
    '+109,8 T or · +981 éclats · +1 clé(s)': '골드 +109.8 T · 조각 +981 · 열쇠 +1', 'Étape max 7-10 ×2': '최고 스테이지 7-10 ×2',
    'Tentatives épuisées — nouvelles règles le lundi 9 novembre': '도전 횟수 소진 — 11월 9일 월요일에 새 규칙',
  };
  for (const [fr, ko] of Object.entries(cases)) assert.equal(translate(fr), ko, fr);
});

test('coréen : motifs dans l\'ordre des mots coréen', () => {
  assert.equal(translate('Score : 1,2 K dégâts en 30 s'), '점수: 30초 동안 피해 1.2 K');
  assert.equal(translate('Prochain : Coffre à l\'étape 2-5'), '다음: 스테이지 2-5에서 창고');
  assert.equal(translate('Haut fait « Vétéran » : +50 gemmes, +1 % dégâts et or pour toujours'), '업적 「베테랑」: 보석 +50, 공격력·골드 영구 +1%');
});
