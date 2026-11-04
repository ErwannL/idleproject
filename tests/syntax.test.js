// v9.1.3 : tous les fichiers du jeu sont analysés (y compris ceux de l'interface, que les autres tests n'importent
// pas) : une apostrophe non échappée dans un texte bloquait le démarrage sans faire échouer un seul test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') || p.endsWith('.mjs') ? [p] : [];
  });
}

test('syntaxe valide pour chaque fichier de src/, server/ et site/', () => {
  const bad = [];
  for (const f of ['src', 'server', 'site'].flatMap((d) => files(fileURLToPath(new URL(`../${d}`, import.meta.url))))) {
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push(`${f}: ${String(e.stderr).split('\n')[0]}`); }
  }
  assert.deepEqual(bad, []);
});
