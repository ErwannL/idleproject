// v9.3.0 : données du site public (site/data.js) tirées des données du jeu, en français et en anglais
// (traduction du jeu, src/i18n/en.js). À relancer quand les héros, compagnons, familiers ou mondes changent :
//   node tools/site-data.mjs
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZONES } from '../src/data/zones.js';
import { COMPANIONS } from '../src/data/companions.js';
import { HEROES } from '../src/data/heroes.js';
import { BOSSES } from '../src/data/enemies.js';
import { ZONE_INTRO, BOSS_LORE } from '../src/data/lore.js';
import { HD_PX } from '../src/data/hd-px.js';
import { HD_REAL } from '../src/data/hd-real.js';
import { translate } from '../src/i18n/en.js';
import { WORLD_BOSS } from '../src/core/world-boss.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const tr = (s) => (s ? translate(s) : '');
const both = (s) => (s ? [s, tr(s)] : null);
const NEW_PETS = new Set(['crystal_hedgehog', 'dragonling', 'jade_turtle', 'kitsune', 'phoenix']); // v9.2.9
const has = (rel) => existsSync(`${ROOT}site/assets/${rel}`);

const worlds = ZONES.map((z, i) => {
  const boss = BOSSES[z.bosses[0]] ?? {};
  const bossId = String(z.bosses[0]).replace(/^boss_/, '');
  return { id: z.id, name: both(z.name), intro: both(ZONE_INTRO[z.id]), boss: both(boss.name), bossId,
    lore: both(BOSS_LORE[bossId] ?? BOSS_LORE[z.bosses[0]]), bossImg: has(`boss/${bossId}.webp`) ? `assets/boss/${bossId}.webp` : null,
    first: i * 20 + 1, last: i * 20 + (z.stages ?? 20) };
});
const heroes = HEROES.map((h) => {
  const px = HD_PX.has(`hero_${h.id}`) ? `hero_${h.id}` : HD_PX.has(h.id) ? h.id : null;
  return { id: h.id, kind: 'hero', name: both(h.name), rarity: h.rarity, title: both(h.title), desc: both(h.description), role: both(h.role),
    px: px ? `assets/px/${px}.webp` : null, real: HD_REAL.has(h.id) ? `assets/real/${h.id}.webp` : null };
});
const allies = COMPANIONS.filter((c) => c.kind === 'ally').map((c) => ({ id: c.id, kind: 'ally', name: both(c.name), rarity: c.rarity,
  skill: both(c.skill?.name), desc: both(c.skill?.text), px: HD_PX.has(`ally_${c.id}`) ? `assets/px/ally_${c.id}.webp` : null }));
const pets = COMPANIONS.filter((c) => c.kind !== 'ally').map((c) => ({ id: c.id, kind: 'pet', name: both(c.name), rarity: c.rarity,
  skill: both(c.skill?.name), desc: both(c.skill?.text), isNew: NEW_PETS.has(c.id), px: HD_PX.has(`pet_${c.id}`) ? `assets/px/pet_${c.id}.webp` : null }));
const worldBoss = { name: both(WORLD_BOSS.name), phases: WORLD_BOSS.phases.map((p) => ({ at: p.at, name: both(p.name) })) };

const out = `// Généré par tools/site-data.mjs (v9.3.0) depuis les données du jeu : ne pas modifier à la main.
// Textes : [français, anglais].
export const WORLDS = ${JSON.stringify(worlds)};
export const HEROES = ${JSON.stringify(heroes)};
export const ALLIES = ${JSON.stringify(allies)};
export const PETS = ${JSON.stringify(pets)};
export const WORLD_BOSS = ${JSON.stringify(worldBoss)};
`;
writeFileSync(`${ROOT}site/data.js`, out);
console.log(`site/data.js : ${worlds.length} mondes, ${heroes.length} héros, ${allies.length} compagnons, ${pets.length} familiers`);
