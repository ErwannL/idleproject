// Teste les exécutables Windows produits par `npm run dist:win` :
// lancement réel, combat, sauvegarde, puis relance pour vérifier la restauration.
// Usage : node tools/desktop-smoke.mjs <chemin/vers/l'exe> [...autres exe]
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exes = process.argv.slice(2);
if (exes.length === 0) {
  console.error('Usage : node tools/desktop-smoke.mjs <exe> [...]');
  process.exit(2);
}

// Attend le rapport JSON plutôt que la fin du processus : l'exe portable
// lance l'application dans un sous-processus.
async function run(exe, label, fresh) {
  const report = join(tmpdir(), `idle-rpg-smoke-${label}.json`);
  rmSync(report, { force: true });
  const args = [`--smoke=${report}`];
  if (fresh) args.push('--smoke-fresh');
  const child = spawn(exe, args, { stdio: 'ignore', detached: false });
  child.on('error', (error) => console.error(`Lancement impossible : ${error.message}`));
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (existsSync(report)) {
      try {
        return JSON.parse(readFileSync(report, 'utf8'));
      } catch {
        // Fichier en cours d'écriture.
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  return { ok: false, reason: 'aucun rapport après 120 s' };
}

let failed = false;
for (const exe of exes) {
  console.log(`\n${exe}`);
  const first = await run(exe, 'first', true);
  console.log('  1er lancement :', JSON.stringify(first));
  await new Promise((r) => setTimeout(r, 3000));
  const second = await run(exe, 'second', false);
  console.log('  2e lancement  :', JSON.stringify(second));
  const checks = [
    ['démarre, combat et sauvegarde', first.ok],
    ['nouvelle partie au premier lancement', first.source === 'new'],
    ['options de fenêtre bureau disponibles', typeof first.desktop?.alwaysOnTop === 'boolean'],
    ['sauvegarde restaurée à la relance', second.ok && second.source === 'main'],
    ['progression conservée', second.kills >= first.kills],
    ['aucune erreur', (first.errors?.length ?? 1) === 0 && (second.errors?.length ?? 1) === 0],
  ];
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✔' : '✘'} ${name}`);
    if (!ok) failed = true;
  }
  // Laisse le temps aux processus de se fermer avant le test suivant.
  await new Promise((r) => setTimeout(r, 3000));
}
process.exit(failed ? 1 : 0);
