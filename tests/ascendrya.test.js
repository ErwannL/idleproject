// v9.1.3 : renommage en Ascendrya sans casser sauvegardes, installation ni mise à jour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const main = readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');

test('Android : identifiant com.ascendrya.app partout, Electron Windows inchangé', () => {
  const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert.equal(JSON.parse(read('capacitor.config.json')).appId, 'com.ascendrya.app');
  assert.match(read('android/app/build.gradle'), /namespace "com\.ascendrya\.app"[\s\S]*applicationId "com\.ascendrya\.app"/);
  assert.match(read('android/app/src/main/java/com/ascendrya/app/MainActivity.java'), /^package com\.ascendrya\.app;/);
  assert.equal(pkg.build.appId, 'com.erwannl.idlerpg');
});

test('nom affiché Ascendrya, identifiants inchangés', () => {
  assert.equal(pkg.productName, 'Ascendrya');
  assert.equal(pkg.build.productName, 'Ascendrya');
  assert.equal(pkg.name, 'idle-rpg'); // dossier d'installation NSIS par utilisateur (sanitizedName)
  assert.equal(pkg.build.appId, 'com.erwannl.idlerpg');
  assert.equal(pkg.build.executableName, 'Idle RPG');
  assert.equal(pkg.build.nsis.artifactName, 'IdleRPG-${version}-setup.exe');
});

test('dossier de données Electron gardé à « Idle RPG », avant le verrou d\'instance', () => {
  const pin = main.indexOf("app.setPath('userData', path.join(app.getPath('appData'), 'Idle RPG'))");
  assert.ok(pin > 0);
  assert.ok(pin < main.indexOf('requestSingleInstanceLock'));
});
