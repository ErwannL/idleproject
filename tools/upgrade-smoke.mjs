// Vérifie la mise à jour d'une installation existante (Windows) :
//   1. installe l'ancienne version (setup.exe /S) et la lance (partie + sauvegarde) ;
//   2. installe la nouvelle version par-dessus ;
//   3. vérifie qu'une seule installation existe, à la nouvelle version,
//      et que la nouvelle version reprend la sauvegarde de l'ancienne ;
//   4. désinstalle tout à la fin (les scénarios peuvent s'enchaîner).
// Avec --all-users, l'ancienne version est installée « pour tous les utilisateurs » (/allusers) :
// la nouvelle (toujours pour l'utilisateur courant) doit la remplacer, sans doublon.
// Avec --live (v8.9.1), la mise à jour se fait comme depuis le jeu : la nouvelle version est installée
// (/S --updated --force-run) pendant que l'ancienne tourne ; ensuite le jeu doit se relancer normalement.
// Usage : node tools/upgrade-smoke.mjs <ancien-setup.exe> <nouveau-setup.exe> <nouvelle-version> [--all-users]
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [oldSetup, newSetup, newVersion, mode] = process.argv.slice(2);
const allUsers = mode === '--all-users';
const live = mode === '--live';
if (!oldSetup || !newSetup || !newVersion) {
  console.error('Usage : node tools/upgrade-smoke.mjs <ancien-setup.exe> <nouveau-setup.exe> <version>');
  process.exit(2);
}

const powershell = (script) => execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8' });

function installations() {
  // Utilisateur courant et « tous les utilisateurs » (vues 64 et 32 bits).
  const keys = ['HKCU:', 'HKLM:', 'HKLM:\\Software\\WOW6432Node']
    .map((root) => (root.endsWith(':') ? `${root}\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*` : `${root}\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*`))
    .map((k) => `'${k}'`).join(',');
  const out = powershell(`Get-ItemProperty ${keys} -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like 'Idle RPG*' } |
    Select-Object DisplayName, DisplayVersion, InstallLocation, UninstallString | ConvertTo-Json -Compress`).trim();
  if (!out) return [];
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function installedExe(entry) {
  const dir = entry.InstallLocation || entry.UninstallString.replace(/^"|"$/g, '').replace(/\\[^\\]+?\.exe.*$/i, '');
  return join(dir, 'Idle RPG.exe');
}

function fileVersion(path) {
  return powershell(`(Get-Item '${path.replace(/'/g, "''")}').VersionInfo.ProductVersion`).trim();
}

function runSetup(setup, args = ['/S']) {
  return new Promise((resolve, reject) => {
    const child = spawn(setup, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${setup} a quitté avec le code ${code}`))));
  });
}

async function runGame(exe, label, fresh) {
  const report = join(tmpdir(), `idle-rpg-upgrade-${label}.json`);
  rmSync(report, { force: true });
  const child = spawn(exe, [`--smoke=${report}`, ...(fresh ? ['--smoke-fresh'] : [])], { stdio: 'ignore' });
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (existsSync(report)) {
      try {
        return JSON.parse(readFileSync(report, 'utf8'));
      } catch {
        // Écriture en cours.
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  return { ok: false, reason: 'aucun rapport après 120 s' };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`  ${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Installation de la version précédente${allUsers ? ' pour tous les utilisateurs' : ''}…`);
await runSetup(oldSetup, allUsers ? ['/S', '/allusers'] : ['/S']);
let entries = installations();
check('ancienne version installée', entries.length === 1, JSON.stringify(entries.map((e) => e.DisplayVersion)));
const oldExe = installedExe(entries[0]);
const oldRun = await runGame(oldExe, 'old', true);
check('ancienne version : partie lancée et sauvegardée', oldRun.ok && oldRun.saved, JSON.stringify(oldRun));
await pause(3000);

const exeName = 'Idle RPG.exe';
const running = () => powershell(`@(Get-Process -Name 'Idle RPG' -ErrorAction SilentlyContinue).Count`).trim() !== '0';
function stopGame() {
  try { execFileSync('taskkill', ['/IM', exeName], { stdio: 'ignore' }); } catch { /* déjà fermé */ }
}
function killGame() {
  try { execFileSync('taskkill', ['/F', '/IM', exeName], { stdio: 'ignore' }); } catch { /* déjà fermé */ }
}
async function waitStopped(ms) {
  const end = Date.now() + ms;
  while (running() && Date.now() < end) await pause(500);
  return !running();
}

if (live) {
  console.log('Lancement normal de l\'ancienne version (comme un joueur)…');
  spawn(oldExe, [], { detached: true, stdio: 'ignore' }).unref();
  await pause(15000);
  check('ancienne version en cours d\'exécution', running());
  console.log(`Mise à jour vers ${newVersion} pendant que le jeu tourne (/S --updated --force-run)…`);
  await runSetup(newSetup, ['/S', '--updated', '--force-run']);
  await pause(8000);
} else {
  console.log(`Installation de la version ${newVersion} par-dessus…`);
  await runSetup(newSetup);
  await pause(2000);
}
entries = installations();
check('une seule installation après la mise à jour', entries.length === 1, `${entries.length} entrée(s)`);
check(`installation à la version ${newVersion}`, entries[0]?.DisplayVersion === newVersion, entries[0]?.DisplayVersion);
const newExe = installedExe(entries[0]);
const version = fileVersion(newExe);
check('exécutable installé à jour', version.startsWith(newVersion), `${newExe} : ${version}`);

if (live) {
  console.log(`  · relance par l'installateur : ${running() ? 'oui' : 'non'}`);
  stopGame();
  if (!(await waitStopped(15000))) killGame();
  check('le jeu se ferme entièrement (aucun processus fantôme)', await waitStopped(10000));
  console.log('Relance normale de la nouvelle version…');
  spawn(newExe, [], { detached: true, stdio: 'ignore' }).unref();
  await pause(15000);
  check('nouvelle version : se relance normalement et reste ouverte', running());
  // Deuxième lancement pendant que le jeu tourne : il ne doit ni ouvrir une 2e instance, ni fermer la 1re.
  spawn(newExe, [], { detached: true, stdio: 'ignore' }).unref();
  await pause(9000);
  const count = Number(powershell(`@(Get-Process -Name 'Idle RPG' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }).Count`).trim());
  console.log(`  · fenêtres ouvertes après un 2e lancement : ${count}`);
  check('2e lancement : le jeu reste ouvert', running());
  stopGame();
  if (!(await waitStopped(15000))) killGame();
  await waitStopped(10000);
}

const newRun = await runGame(newExe, 'new', false);
check('nouvelle version : démarre sans erreur', newRun.ok, JSON.stringify(newRun));
check('sauvegarde de l\'ancienne version reprise', newRun.source === 'main' && newRun.kills >= oldRun.kills,
  `source ${newRun.source}, ennemis ${oldRun.kills} -> ${newRun.kills}`);
check('version affichée par le jeu', newRun.desktop?.version === newVersion, newRun.desktop?.version);

// Nettoyage : désinstallation silencieuse de ce qui reste.
for (const entry of installations()) {
  const uninstaller = entry.UninstallString.match(/^"([^"]+)"/)?.[1] ?? entry.UninstallString.split(' /')[0];
  await runSetup(uninstaller, ['/S', ...(/allusers/i.test(entry.UninstallString) ? ['/allusers'] : [])]).catch(() => {});
}
let left = installations().length;
for (let i = 0; i < 20 && left > 0; i++) {
  await pause(1000);
  left = installations().length;
}
check('désinstallation propre', left === 0, `${left} entrée(s) restante(s)`);

process.exit(results.every(Boolean) ? 0 : 1);
