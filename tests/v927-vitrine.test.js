// v9.2.7 : vitrine animée des fiches — séquences de chaque type de fiche et traductions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { showcaseClips } from '../src/render/showcase-scene.js';
import { COMPANIONS } from '../src/data/companions.js';
import { CLASSES } from '../src/data/classes.js';
import { SKILLS } from '../src/data/skills.js';
import { BOSSES, ENEMIES } from '../src/data/enemies.js';
import { BOSS_TRAITS } from '../src/core/boss-traits.js';
import { MUTATIONS } from '../src/core/mutations.js';
import { allCompanionSkills } from '../src/core/companions.js';

test('compagnons et familiers (v9.10) : compétence signature, attaque de base, autres compétences, ultime', () => {
  for (const c of COMPANIONS) {
    const clips = showcaseClips({ kind: 'unit', id: c.id });
    const names = allCompanionSkills(c.id).map((s) => s.name);
    assert.deepEqual(clips.slice(0, 2).map((x) => x.id), ['sk0', 'basic']);
    assert.deepEqual([clips[0].label, ...clips.slice(2).map((x) => x.label)], names, c.id);
    if (c.kind === 'ally') assert.ok(clips.at(-1).ult); // v9.3.8 : familier sans ultime
  }
});

test('apparences : marche, une attaque par classe, les sorts du héros', () => {
  const clips = showcaseClips({ kind: 'hero', id: 'knight' });
  assert.equal(clips.length, 1 + CLASSES.length + SKILLS.length);
});

test('monstres, boss (mécanique) et mutations', () => {
  for (const id of Object.keys(ENEMIES)) assert.deepEqual(showcaseClips({ kind: 'monster', id }).map((c) => c.id), ['arrive', 'walk', 'attack', 'hurt', 'death']);
  for (const id of Object.keys(BOSSES)) assert.equal(showcaseClips({ kind: 'boss', id }).some((c) => c.id === 'trait'), Boolean(BOSS_TRAITS[id]), id);
  for (const m of MUTATIONS) assert.ok(showcaseClips({ kind: 'mutation', id: m.id }).some((c) => c.id === 'mutation' && c.label === m.name));
});

test('textes de la vitrine traduits en anglais et en coréen', async () => {
  const en = (await import('../src/i18n/en.js')).translate;
  const ko = (await import('../src/i18n/ko.js')).translate;
  const texts = new Set(['Tout', 'Lire', 'Vitrine', '▶ Vitrine', 'Ultime']);
  for (const c of showcaseClips({ kind: 'boss', id: 'ash_dragon' }).concat(showcaseClips({ kind: 'monster', id: 'mandrake' }), showcaseClips({ kind: 'monster', id: 'imp' }))) { texts.add(c.label); texts.add(c.desc); }
  for (const t of texts) {
    assert.notEqual(en(t), t, `anglais : ${t}`);
    assert.notEqual(ko(t), t, `coréen : ${t}`);
  }
});
