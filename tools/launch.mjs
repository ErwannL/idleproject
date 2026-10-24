// Lance le jeu dans une petite fenêtre d'application (Chrome / Edge / Chromium en mode --app),
// sans barre d'adresse, pour jouer en arrière-plan sur le bureau.
// Utilise un profil dédié (~/.idle-rpg-profile) : la sauvegarde y est conservée.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { startServer } from './serve.mjs';

const WINDOW = { width: 420, height: 300 };

function candidates() {
  const env = process.env;
  switch (platform()) {
    case 'win32':
      return [
        join(env['PROGRAMFILES(X86)'] ?? '', 'Microsoft/Edge/Application/msedge.exe'),
        join(env.PROGRAMFILES ?? '', 'Microsoft/Edge/Application/msedge.exe'),
        join(env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'),
        join(env['PROGRAMFILES(X86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
        join(env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
      ];
    case 'darwin':
      return [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ];
    default:
      return ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  }
}

const browser = process.env.IDLE_BROWSER ?? candidates().find((p) => p && existsSync(p));
const server = await startServer(Number(process.env.PORT) || 5173);
const url = `http://localhost:${server.address().port}`;

if (!browser) {
  console.log(`Aucun Chrome/Edge trouvé. Ouvrez ${url} dans votre navigateur.`);
  console.log('Astuce : définissez IDLE_BROWSER=/chemin/vers/le/navigateur.');
} else {
  const child = spawn(browser, [
    `--app=${url}`,
    `--window-size=${WINDOW.width},${WINDOW.height}`,
    `--user-data-dir=${join(homedir(), '.idle-rpg-profile')}`,
    '--no-first-run',
    '--no-default-browser-check',
  ], { stdio: 'ignore' });
  console.log(`Idle RPG lancé (${url}). Fermez la fenêtre du jeu pour quitter.`);
  child.on('exit', () => {
    server.close();
    process.exit(0);
  });
}
