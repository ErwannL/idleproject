// v9.8 (F) : chaque sort colle à l'élément du personnage ; pas de nom en double chez un même personnage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANIONS } from '../src/data/companions.js';
import { companionSkillList } from '../src/data/companion-skills.js';
import { COMPANION_ROLES } from '../src/data/synergies.js';
import { UNIT_ELEMENT } from '../src/core/elements.js';

const WORDS = { red: /flamme|feu|braise|brasier|météore|ardent/i, blue: /givre|glace|blizzard|hiver/i };
const FOREIGN = { red: WORDS.blue, blue: WORDS.red, dark: /givre|glace|boule de feu|météore/i, green: /givre|boule de feu/i, light: /givre|boule de feu/i };

test('sorts accordés à l\'élément', () => {
  for (const c of COMPANIONS) {
    const el = UNIT_ELEMENT[c.id];
    const names = companionSkillList(c, COMPANION_ROLES[c.id] ?? 'pet').map((s) => s.name);
    assert.equal(new Set(names).size, names.length, `${c.id} : nom en double ${names}`);
    if (c.kind === 'ally' && COMPANION_ROLES[c.id] === 'mage') for (const n of names.slice(1)) assert.ok(!FOREIGN[el]?.test(n), `${c.id} (${el}) : ${n}`);
  }
});

test('familiers : seuls chat, renard et dragonnet mordent ou griffent', () => {
  for (const c of COMPANIONS.filter((x) => x.kind !== 'ally')) {
    const names = companionSkillList(c, 'pet').map((s) => s.name).join(',');
    if (!['cat', 'kitsune', 'dragonling'].includes(c.id)) assert.ok(!/Morsure|griffe/.test(names), `${c.id} : ${names}`);
  }
});

import { SKILLS, CLASS_COMMON_NAMES } from '../src/data/skills.js';
import { RUSHES } from '../src/data/rushes.js';
test('noms de compétence uniques dans tout le jeu (héros, compagnons, Boosts)', () => {
  const heroNames = [...Object.values(CLASS_COMMON_NAMES).flat(), ...SKILLS.filter((s) => s.cls).map((s) => s.name)];
  assert.equal(new Set(heroNames).size, heroNames.length, 'doublon chez le héros');
  const comp = new Set(COMPANIONS.flatMap((c) => companionSkillList(c, COMPANION_ROLES[c.id] ?? 'pet').map((s) => s.name)));
  const clash = heroNames.filter((n) => comp.has(n));
  assert.deepEqual(clash.filter((n) => !['Frappe rapide', 'Tourbillon', 'Cri de guerre', 'Frappe sacrée'].includes(n)), []);
  for (const r of RUSHES) assert.ok(!heroNames.includes(r.name) && !comp.has(r.name), r.name);
});
