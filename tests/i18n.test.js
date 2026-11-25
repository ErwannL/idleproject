import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXACT, PATTERNS, translate } from '../src/i18n/en.js';
import { getLang, setLang, t } from '../src/i18n/i18n.js';
import { BALANCE } from '../src/data/balance.js';
import { ENCYCLOPEDIA_SECTIONS as COLLECTIONS } from '../src/core/encyclopedia.js';
import { COMPANIONS } from '../src/data/companions.js';
import { CONTRACT_TYPES } from '../src/data/contracts.js';
import { DUNGEON_DIFFICULTIES, DUNGEON_PATHS, DUNGEONS } from '../src/data/dungeons.js';
import { BOSSES, ENEMIES } from '../src/data/enemies.js';
import { HEROES } from '../src/data/heroes.js';
import { AFFIXES, ITEM_BASES, RARITIES, SIGNATURE_ITEMS, SLOTS, STAT_LABELS } from '../src/data/items.js';
import { BOSS_LORE } from '../src/data/lore.js';
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
import { ITEM_SETS } from '../src/data/sets.js';
import { CHALLENGE_MODIFIERS } from '../src/core/challenge.js';
import { EXPEDITION_TYPES } from '../src/core/expeditions.js';

// Faux localStorage (Node n'en a pas).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const FRENCH = /[éèàçùêâîôûœ«»]/i;

test('langue : français par défaut, mémorisée dans localStorage', () => {
  assert.equal(getLang(), 'fr');
  assert.equal(t('Inventaire'), 'Inventaire');
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(store.get('idle-rpg.lang'), 'en');
  setLang('xx');
  assert.equal(getLang(), 'fr');
  setLang('en');
});

test('t() traduit les chaînes clés en anglais', () => {
  setLang('en');
  const cases = {
    'Inventaire': 'Inventory',
    'Améliorer': 'Upgrade',
    'Paramètres': 'Settings',
    'Récupérer': 'Claim',
    'Roi Gluant': 'Slime King',
    'Collier de rubis': 'Ruby Necklace',
    '  Avancer ▶ ': '  Advance ▶ ',
    'Niv. 12': 'Lv. 12',
    'Étape 3-20 · Grottes de cristal': 'Stage 3-20 · Crystal Caves',
    'Monde 3 · 3-20': 'World 3 · 3-20',
    '+10 % PV max · +5,5 % or': '+10% max HP · +5.5% gold',
    '+12 % dégâts contre les boss': '+12% damage vs bosses',
    'Améliorer +3': 'Upgrade +3',
    '1 victoire': '1 victory',
    '3 victoires': '3 victories',
    '+25 gemmes · +1 clé(s)': '+25 gems · +1 key',
    'Partie sauvegardée': 'Game saved',
    'Recyclé : +1,2 K or': 'Recycled: +1.2 K gold',
    'Butin : Épée courte (Rare)': 'Loot: Short Sword (Rare)',
    'Roi Gluant invoque Golem de cristal !': 'Slime King summons Crystal Golem!',
    'Épée courte +2 · Épique · niv. 5': 'Short Sword +2 · Epic · lv. 5',
    '4 h 59': '4h 59m',
    '3 j': '3d',
    'Dernière sauvegarde : il y a 2 min 05 s': 'Last save: 2m 05s ago',
    'Configuration « Chasse aux boss » enregistrée': 'Loadout “Boss hunt” saved',
    'Vaincre 300 monstres': 'Defeat 300 monsters',
    'Texte inconnu du dictionnaire': 'Texte inconnu du dictionnaire',
  };
  for (const [fr, en] of Object.entries(cases)) assert.equal(t(fr), en, fr);
});

test('EXACT : chaque valeur est une chaîne non vide', () => {
  for (const [fr, en] of Object.entries(EXACT)) {
    assert.equal(typeof en, 'string', fr);
    assert.ok(en.trim().length > 0, fr);
    assert.equal(fr, fr.replace(/\s+/g, ' ').trim(), `clé non normalisée : « ${fr} »`);
  }
});

test('PATTERNS : un échantillon de motifs', () => {
  assert.ok(PATTERNS.every(([re, rep]) => re instanceof RegExp && ['string', 'function'].includes(typeof rep)));
  const samples = {
    'Niv. 7/25': 'Lv. 7/25',
    'Débloqué au niv. 8': 'Unlocked at lv. 8',
    '+30 gemmes': '+30 gems',
    'Élite vaincue : +12 gemmes': 'Elite defeated: +12 gems',
    'Salle 2/5 · 3/6': 'Room 2/5 · 3/6',
    'Ennemis vaincus 4/15': 'Enemies defeated 4/15',
    'Dégâts ×1,4 à tous les ennemis': 'Damage ×1.4 to all enemies',
    'Frappe à 90 % des dégâts du héros': "Strikes for 90% of the hero's damage",
    'Vol de vie : 4 % des dégâts': 'Lifesteal: 4% of damage',
    '+1 emplacement de pouvoir': '+1 power slot',
    'Pouvoirs actifs 2/3': 'Active powers 2/3',
    'Renaissance ! +5 fragments anciens': 'Rebirth! +5 ancient fragments',
    'Contrat rare · Prospecteur': 'Rare contract · Prospector',
    "Si tu l'équipes (à la place de Dague)": 'If you equip it (replacing Dagger)',
    'Mini-boss — Golem de cristal': 'Mini-boss — Crystal Golem',
    'Plaines verdoyantes 1-3': 'Green Plains 1-3',
    'Reine spectrale — 1,2 K / 3 K PV': 'Spectral Queen — 1.2 K / 3 K HP',
  };
  for (const [fr, en] of Object.entries(samples)) assert.equal(translate(fr), en, fr);
});

// Tous les textes fixes des données doivent avoir une traduction (sinon : compléter src/i18n/en.js).
test('données du jeu : tous les noms et libellés sont traduits', () => {
  const texts = [
    ...Object.values(ENEMIES).map((e) => e.name), ...Object.values(BOSSES).map((b) => b.name),
    ...COMPANIONS.flatMap((c) => [c.name, c.skill?.name, c.skill?.text]),
    ...SKILLS.map((s) => s.name), ...SKILLS.map((s) => s.text('1,5')),
    ...TALENTS.map((x) => x.name), ...TALENT_BRANCHES.map((b) => b.label),
    ...PRESTIGE_PERKS.map((p) => p.name), ...PRESTIGE_RESETS, ...PRESTIGE_KEEPS, ...REBIRTH_RESETS, ...REBIRTH_KEEPS,
    ...Object.values(BOSS_POWERS).flat().map((p) => p.name), ...Object.values(POWER_FAMILIES).map((f) => f.label),
    ...Object.values(EFFECT_LABELS).map((fn) => fn(12)), ...Object.values(AFFIXES).map((a) => a.label(3)),
    ...ITEM_BASES.map((i) => i.name), ...SIGNATURE_ITEMS.map((i) => i.name),
    ...Object.values(SLOTS), ...RARITIES.map((r) => r.label), ...Object.values(STAT_LABELS),
    ...ZONES.map((z) => z.name), ...DUNGEONS.flatMap((d) => [d.name, d.description]),
    ...Object.values(DUNGEON_PATHS).flatMap((p) => [p.label, p.text]), ...Object.values(DUNGEON_DIFFICULTIES).map((d) => d.label),
    ...HEROES.flatMap((h) => [h.name, h.role, h.description]),
    ...MISSION_PERIODS.flatMap((p) => [p.label, p.reset, ...p.missions.map((m) => m.label)]),
    ...Object.values(CONTRACT_TYPES).flatMap((c) => [c.title, c.label(12)]),
    ...RUSHES.flatMap((r) => [r.name, r.text]), ...Object.values(ROLES).map((r) => r.label),
    ...SYNERGIES.flatMap((s) => [s.name, s.text]), ...LOADOUT_NAMES, ...COLLECTIONS.map((c) => c.label),
    ...Object.values(BOSS_LORE),
    ...Object.values(BALANCE.upgrades).flatMap((u) => [u.label, u.description]),
    ...BALANCE.upgradeCategories.map((c) => c.label), ...Object.values(BALANCE.summon.pools).map((p) => p.label),
    ...['chest', 'merchant', 'elite', 'wave', 'gems', 'portal', 'wanderer'].map(eventLabel),
    ...Object.values(RECYCLE_MODES), ...Object.values(AUTO_RECYCLE_RULES),
    rewardText({ gold: 1200, gems: 5, tickets: 1, keys: 2, fragments: 3, shards: 4, essence: 1 }),
    // v8.5 : ensembles, défi de la semaine, expéditions.
    ...ITEM_SETS.map((x) => x.name), ...CHALLENGE_MODIFIERS.flatMap((m) => [m.name, m.text]), ...EXPEDITION_TYPES.flatMap((x) => [x.label, x.text]),
  ].filter(Boolean);
  const missing = texts.filter((s) => translate(s) === s && (FRENCH.test(s) || !/^[A-Z][a-z]+$/.test(s)));
  assert.deepEqual(missing.filter((s) => !['Ninja', 'Ogre', 'Scorpion', 'Paladin', 'Berserker', 'Archer', 'Mage', 'Assassin',
    'Boss', 'Combat', 'Fortune', 'Prestige', 'Bracelet', 'Rare', 'Normal', 'Forge', 'Talents', 'Boosts', 'Endurance', 'Technique',
    'Domination', 'Carnage', 'Lamentation', 'Rage', 'Exploration'].includes(s)), []);
  for (const s of texts) assert.ok(!FRENCH.test(translate(s)), `traduction encore française : ${s} → ${translate(s)}`);
});

// v9.1.4 : plusieurs langues (fr source, en, ko) ; v9.1.8 : le coréen est ouvert à tous.
test('langues : le coréen est proposé aux joueurs (v9.1.8)', async () => {
  const { LANGS, availableLangs, isLangAvailable } = await import('../src/i18n/i18n.js');
  assert.deepEqual(Object.keys(LANGS), ['fr', 'en', 'ko']);
  assert.equal(LANGS.ko.enabled, true);
  assert.equal(isLangAvailable('ko'), true); // version publique (BUILD.cheats faux), sans « ?lang=ko »
  assert.deepEqual(availableLangs().map((l) => l.code), ['fr', 'en', 'ko']);
  setLang('ko');
  assert.equal(getLang(), 'ko');
  assert.equal(t('Paramètres'), '설정');
  setLang('en');
  assert.equal(t('Inventaire'), 'Inventory');
});

test('coréen : dictionnaire, motifs et règles génériques', async () => {
  const { EXACT: KO, translate: ko } = await import('../src/i18n/ko.js');
  for (const [fr, v] of Object.entries(KO)) {
    assert.ok(typeof v === 'string' && v.trim(), fr);
    assert.equal(fr, fr.replace(/\s+/g, ' ').trim(), `clé non normalisée : « ${fr} »`);
  }
  const cases = {
    'Paramètres': '설정', 'Renaissance': '환생', 'Légendaire': '전설', 'Niv. 12': 'Lv.12',
    'Désert brûlant 4-14': '불타는 사막 4-14', '+10 % PV max · +5,5 % or': '최대 HP +10% · 골드 +5.5%',
    'Tout récupérer (3)': '모두 받기 (3)', 'Dernière sauvegarde : il y a 2 min 05 s': '마지막 저장: 2분 05초 전',
  };
  for (const [fr, v] of Object.entries(cases)) assert.equal(ko(fr), v, fr);
  // le menu principal et les monnaies sont entièrement traduits
  const { MENUS, SUB_LABELS } = await import('../src/ui/nav.js');
  const { CURRENCIES } = await import('../src/data/currencies.js');
  const { ZONES } = await import('../src/data/zones.js');
  const texts = [...MENUS.map((m) => m.label), ...Object.values(SUB_LABELS), ...Object.values(CURRENCIES).map((c) => c.name),
    ...RARITIES.map((r) => r.label), ...Object.values(STAT_LABELS), ...Object.values(SLOTS), ...ZONES.map((z) => z.name)];
  assert.deepEqual(texts.filter((s) => /[A-Za-zÀ-ÿ]{2}/.test(ko(s).replace(/\b(?:HP|Lv|XP)\b/g, ''))), []);
});

// v10.14.1 (lot 4) : Fêtes du mois en anglais (./src/i18n/en-1014.js).
test('anglais : Fêtes du mois — titres, monnaies, régions, écran, messages et notifications (v10.14.1)', async () => {
  const { festTexts } = await import('./helpers/fest-texts.js');
  const texts = festTexts();
  assert.ok(texts.length > 300);
  const SAME = new Set(['Shuriken', 'Missions', 'Participant']); // mêmes mots dans les deux langues
  for (const s of texts) {
    const out = translate(s);
    assert.ok(!FRENCH.test(out), `traduction encore française : ${s} → ${out}`);
    assert.ok(out !== s || SAME.has(s) || !/[a-zé]{4}/.test(s), `non traduit : ${s}`);
  }
  const cases = {
    'Fête des Cœurs ardents': 'Festival of Burning Hearts', 'Cœurs de braise': 'Ember Hearts', 'Trône des braises': 'Ember Throne',
    'Fête du héros : Archange': 'Hero Festival: Archangel', 'Foire : Lame rose': 'Fair: Rose Blade',
    'Vaincre 6 000 monstres': 'Defeat 6,000 monsters', 'Faire 40 invocations': 'Do 40 summons', 'Lame bénie': 'Blessed Blade',
    'Carte de Reine démone · 12/30': "Demon Queen's Map · 12/30", 'Gardien niv. 3-5 ×2': 'Guardian lvl 3-5 ×2',
    'Grande fête · jour 5/14': 'Grand festival · day 5/14', '🔁 Échange · 1 j 12 h': '🔁 Exchange · 1d 12h', "puis 2 jours d'échange": 'then 2 days of exchange',
    'Dépense tes Pétales : encore 1 j 12 h': 'Spend your Petals: 1d 12h left',
    'Missions du jour : elles changent à minuit · 4 h 12': 'Daily missions: they change at midnight · 4h 12m',
    'Tu gardes les 24 Cœurs de braise gagnés.': 'You keep the 24 Ember Hearts you earned.',
    'Palier 3 franchi : choisis une bénédiction': 'Floor 3 cleared: choose a blessing', 'Brèche quittée : 3 paliers, +24': 'Breach left: 3 floors, +24',
    'Étape 5 réussie : +14': 'Stage 5 cleared: +14', '3 étapes gagnées : +42': '3 stages won: +42',
    'World Boss : 1,5 M dégâts · +12 · record !': 'World Boss: 1.5 M damage · +12 · record!', 'Classement de la fête : Top 10 %': 'Festival ranking: Top 10%',
    'Reste 3/5': '3/5 left', 'Acheter pour 40 Pétales': 'Buy for 40 Petals', '1 faite ▸': '1 done ▸', 'Faite ✓': 'Done ✓',
    'Quitter​': 'Leave', "Jalons de la fête : 35 sur 50. Ouvrir l'Aventure de la fête": 'Festival milestones: 35 of 50. Open the festival Adventure',
    'La fête commence': 'The festival begins',
  };
  for (const [fr, en] of Object.entries(cases)) assert.equal(translate(fr), en, fr);
});

// v10.14.2 : nouveaux textes téléphone en anglais (./src/i18n/en-1014-2.js).
test('anglais : Carnet, Recycler, Marchands, Guilde, Invocation (10.14.2)', () => {
  const cases = {
    'Carnet 3/8': 'Log 3/8', 'Carnet 8/8 ✓': 'Log 8/8 ✓', 'Carnet 8/8 · ouvre le coffre du jour ›': 'Log 8/8 · open the daily chest ›',
    'Carnet 8/8 · coffre du jour ouvert ✓': 'Log 8/8 · daily chest opened ✓', 'Coffre à ouvrir': 'Chest to open',
    'Rien à recycler : tes objets sont protégés ou utiles.': 'Nothing to recycle: your items are protected or useful.',
    'Épique 4': 'Epic 4', 'Tout 12': 'All 12', 'Recycler (12)': 'Recycle (12)', '+5 autres': '+5 more',
    'Le chariot dort au loin': 'The cart sleeps far away', 'Taux': 'Rates', 'Ça dort': 'Sleeping',
    'Légendaire garanti dans 12 tirages': 'Legendary guaranteed in 12 pulls', 'Légendaire garanti dans 1 tirage': 'Legendary guaranteed in 1 pull',
    'Un boss, toute la guilde': 'One boss, the whole guild', 'Outils et réinitialisation': 'Tools and reset',
  };
  for (const [fr, en] of Object.entries(cases)) { assert.equal(translate(fr), en, fr); assert.ok(!FRENCH.test(translate(fr)), fr); }
});
