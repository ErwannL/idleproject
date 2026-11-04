// Filet de sécurité : chaque fichier du jeu doit au moins être syntaxiquement valide.
// (main.js n'est pas importé par les tests : une erreur de syntaxe y passerait inaperçue.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : name.endsWith('.js') || name.endsWith('.mjs') ? [p] : [];
  });
}

test('tous les fichiers JavaScript du jeu et du serveur sont valides', () => {
  for (const file of [...files(join(ROOT, 'src')), ...files(join(ROOT, 'server')), ...files(join(ROOT, 'site'))]) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
  assert.ok(true);
});
