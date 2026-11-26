// v9.1.8 : fusion des branches 9.1.3 (format 8) et 9.1.4–9.1.7 (format 7, statistiques de temps).
// tests/helpers/v917-save.json : partie créée par le createNewState de la 9.1.7 (format 7), avec temps de jeu,
// statistiques de temps (state.times) et records remplis. Elle doit se charger en format 8 sans rien perdre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAVE_VERSION, sanitizeState } from '../src/core/state.js';
import { checkSave, summarizeSave } from '../server/app.mjs';
import { MENUS, SUB_LABELS } from '../src/ui/nav.js';

const raw = JSON.parse(readFileSync(new URL('./helpers/v917-save.json', import.meta.url), 'utf8'));

test('9.1.7 → 9.1.8 : sauvegarde au format 7 migrée en format 8, statistiques de temps et records gardés', () => {
  assert.equal(raw.version, 7);
  const s = sanitizeState(structuredClone(raw));
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(SAVE_VERSION, 13); // v9.3.8 : 12 → 13 (6 places, pièces séparées) // v9.3.4 : 11 → 12 (équipement unique) // v9.3.3 : 10 → 11 (niveaux de compétence) // v9.2.0 (monde marin) : 8 → 9 (Royaume englouti, étapes converties) · v9.2.8 : 9 → 10 (économie)
  for (const k of ['level', 'maxStage', 'gold', 'playSeconds']) assert.equal(s[k], raw[k], k);
  assert.ok(s.gems >= raw.gems, 'gemmes (les tickets du format 7 sont convertis)');
  for (const k of Object.keys(raw.records)) assert.ok(s.records[k] >= raw.records[k], `records.${k}`);
  assert.deepEqual(s.times, { ...raw.times, session: 0 });
});

test('9.1.8 : le serveur accepte la partie migrée par-dessus la sauvegarde 9.1.7, refuse le retour au format 7', () => {
  const migrated = sanitizeState(structuredClone(raw));
  const current = { data: JSON.stringify(raw), level: raw.level, play_seconds: raw.playSeconds };
  assert.equal(checkSave(migrated, summarizeSave(migrated), current), null);
  const current8 = { data: JSON.stringify(migrated), level: migrated.level, play_seconds: migrated.playSeconds };
  assert.match(checkSave(raw, summarizeSave(raw), current8), /trop ancienne/);
  // Renaissance (niveau remis à 1) au même format : acceptée (correctif 9.1.4 conservé).
  const reborn = { ...migrated, level: 1, playSeconds: migrated.playSeconds + 100 };
  assert.equal(checkSave(reborn, summarizeSave(reborn), current8), null);
});

test('9.3.5 : Quêtes (Missions, Collections) ; Classement, Guilde et Statistiques dans le Profil', () => {
  const goals = MENUS.find((m) => m.id === 'goals');
  // v10.16 (B1, B2) : 6e onglet « Plus » — Objectifs (Carnet + Missions), Collections, puis l'ancien Profil.
  assert.deepEqual(goals.tabs, ['daybook', 'encyclopedia', 'boss', 'looks', 'ranking', 'guild', 'stats']);
  assert.equal(MENUS.some((m) => m.id === 'profile'), false);
  assert.equal(SUB_LABELS.ranking, 'Classement');
});
