// v9.2.5 (K) : « Tout récupérer » dit où — origine de chaque récompense, traduite en anglais et en coréen.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

test('chaque récompense des Missions a une origine (onglet › section), traduite en anglais et en coréen', async () => {
  const { claimOrigin } = await import('../src/ui/panels/inbox.js');
  const en = (await import('../src/i18n/en.js')).translate;
  const ko = (await import('../src/i18n/ko.js')).translate;
  const kinds = ['login', 'mission', 'missionBonus', 'contract', 'bounty', 'event', 'track', 'achievement'];
  const origins = kinds.map((kind) => claimOrigin({ kind, tab: 'contracts' }));
  assert.ok(origins.every((o) => o.startsWith('Missions › ')));
  assert.equal(new Set(origins).size, 7); // mission et coffre bonus : même section (Journalières)
  const FR = /[éèàçùêâîôûœ«»']/i;
  for (const o of origins) {
    assert.ok(!FR.test(en(o)), `anglais : ${o}`);
    assert.ok(!FR.test(ko(o)) && ko(o) !== o, `coréen : ${o}`);
  }
  for (const t of ['Sera récupéré (8)', 'Légendaire garanti dans 60', 'Épique dans 10', 'par tirage (×2,5) · 50 % des Légendaires', '✦ En vedette · taux augmenté ✦']) {
    assert.ok(!FR.test(en(t)), `anglais : ${t}`);
    assert.notEqual(ko(t), t, `coréen : ${t}`);
  }
});
