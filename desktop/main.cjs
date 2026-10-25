// Processus principal de la version bureau (Electron).
// Ouvre le jeu dans une petite fenêtre, mémorise sa position/taille et l'option
// « toujours au premier plan », et garantit la sauvegarde à la fermeture.
//
// Mode test : `Idle RPG.exe --smoke=<fichier.json> [--smoke-fresh]` lance le jeu,
// le laisse tourner quelques secondes, écrit un rapport JSON puis quitte.
const { app, BrowserWindow, Menu, ipcMain, net, protocol, screen, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCHEME = 'app';
const ORIGIN = `${SCHEME}://game`;
const RELEASES_API = 'https://api.github.com/repos/ErwannL/idleproject/releases/latest';
const RELEASES_PAGE = 'https://github.com/ErwannL/idleproject/releases/latest';
const SIZE_PRESETS = { strip: [520, 150], mini: [420, 300], standard: [460, 640], wide: [960, 720] };
// v2 : nouvelle interface pensée pour la fenêtre « standard » ; on l'applique une fois aux installations v1.
const LAYOUT_VERSION = 2;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

const smokeArg = process.argv.find((a) => a.startsWith('--smoke='));
const smokeFile = smokeArg ? smokeArg.slice('--smoke='.length) : null;

// Origine stable et sécurisée : le localStorage (la sauvegarde) y est conservé.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (smokeFile) {
  const dir = path.join(app.getPath('temp'), 'idle-rpg-smoke');
  if (process.argv.includes('--smoke-fresh')) fs.rmSync(dir, { recursive: true, force: true });
  app.setPath('userData', dir);
} else if (!app.requestSingleInstanceLock()) {
  // Une seule instance : deux fenêtres écraseraient mutuellement la sauvegarde.
  app.quit();
}

const settingsFile = () => path.join(app.getPath('userData'), 'window.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  try {
    const tmp = `${settingsFile()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(settings));
    fs.renameSync(tmp, settingsFile());
  } catch (error) {
    console.error('Réglages de fenêtre non sauvegardés', error);
  }
}

// Ignore une position enregistrée hors des écrans actuels (écran débranché…).
function visibleBounds(bounds) {
  if (!bounds) return {};
  const area = screen.getDisplayMatching(bounds).workArea;
  const inside = bounds.x < area.x + area.width - 40 && bounds.x + bounds.width > area.x + 40
    && bounds.y >= area.y - 10 && bounds.y < area.y + area.height - 40;
  return inside ? bounds : { width: bounds.width, height: bounds.height };
}

function serveGameFiles() {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.normalize(path.join(ROOT, relative));
    if (!file.startsWith(ROOT + path.sep)) return new Response('Interdit', { status: 403 });
    try {
      const body = await fs.promises.readFile(file);
      return new Response(body, {
        headers: { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' },
      });
    } catch {
      return new Response('Introuvable', { status: 404 });
    }
  });
}

function createWindow() {
  const settings = loadSettings();
  if ((settings.layoutVersion ?? 1) < LAYOUT_VERSION) {
    if (settings.bounds) Object.assign(settings.bounds, { width: SIZE_PRESETS.standard[0], height: SIZE_PRESETS.standard[1] });
    settings.layoutVersion = LAYOUT_VERSION;
    saveSettings(settings);
  }
  const bounds = visibleBounds(settings.bounds);
  const area = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.min(bounds.width ?? SIZE_PRESETS.standard[0], area.width),
    height: Math.min(bounds.height ?? SIZE_PRESETS.standard[1], area.height),
    x: bounds.x,
    y: bounds.y,
    minWidth: 260,
    minHeight: 110,
    title: 'Idle RPG',
    icon: path.join(ROOT, 'assets', 'icon.png'),
    backgroundColor: '#15111d',
    alwaysOnTop: Boolean(settings.alwaysOnTop),
    show: !smokeFile || !process.argv.includes('--smoke-hidden'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) event.preventDefault();
  });

  ipcMain.handle('desktop:getInfo', () => ({ alwaysOnTop: win.isAlwaysOnTop(), version: app.getVersion() }));
  ipcMain.handle('desktop:setAlwaysOnTop', (_event, value) => {
    win.setAlwaysOnTop(Boolean(value));
    settings.alwaysOnTop = win.isAlwaysOnTop();
    saveSettings(settings);
    return settings.alwaysOnTop;
  });
  // Mise à jour (v7.8) : le processus principal relit lui-même la dernière release GitHub,
  // télécharge l'installateur officiel puis le lance en silencieux et ferme le jeu (sauvegarde comprise).
  ipcMain.handle('desktop:openReleases', () => shell.openExternal(RELEASES_PAGE));
  ipcMain.handle('desktop:installUpdate', async () => {
    try {
      const res = await net.fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'IdleRPG' } });
      if (!res.ok) return { ok: false, error: `GitHub ${res.status}` };
      const release = await res.json();
      const version = String(release.tag_name ?? '').replace(/^v/i, '');
      if (!newerThan(version, app.getVersion())) return { ok: false, error: 'Déjà à jour.' };
      const asset = (release.assets ?? []).find((a) => /^IdleRPG-[\d.]+-setup\.exe$/.test(a.name ?? ''));
      const url = asset && new URL(asset.browser_download_url);
      if (!url || url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.startsWith('/ErwannL/idleproject/releases/download/')) {
        return { ok: false, error: 'Installateur introuvable dans la release.' };
      }
      const file = path.join(app.getPath('temp'), asset.name);
      const download = await net.fetch(url.href);
      if (!download.ok) return { ok: false, error: `Téléchargement ${download.status}` };
      const data = Buffer.from(await download.arrayBuffer());
      if (asset.size && data.length !== asset.size) return { ok: false, error: 'Téléchargement incomplet.' };
      fs.writeFileSync(file, data);
      if (process.platform !== 'win32') return { ok: false, error: 'Installation automatique : Windows seulement.' };
      // /S : installation silencieuse ; --force-run : l'installateur relance le jeu à la fin.
      spawn(file, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => win.close(), 300);
      return { ok: true, version };
    } catch (error) {
      return { ok: false, error: String(error?.message ?? error) };
    }
  });
  ipcMain.handle('desktop:setSizePreset', (_event, preset) => {
    const size = SIZE_PRESETS[preset];
    if (!size) return false;
    if (win.isMaximized()) win.unmaximize();
    win.setSize(size[0], size[1]);
    return true;
  });

  // Fermeture : on force une dernière sauvegarde et l'écriture sur disque avant de quitter.
  let closing = false;
  win.on('close', (event) => {
    if (closing) return;
    event.preventDefault();
    closing = true;
    settings.bounds = win.getNormalBounds();
    saveSettings(settings);
    const finalSave = win.webContents.executeJavaScript('window.__idle && window.__idle.save()').catch(() => {});
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    Promise.race([finalSave, timeout]).finally(() => {
      win.webContents.session.flushStorageData();
      win.destroy();
    });
  });

  win.loadURL(`${ORIGIN}/index.html`);
  return win;
}

function newerThan(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

function runSmokeTest(win) {
  const errors = [];
  const report = (result) => {
    fs.writeFileSync(smokeFile, JSON.stringify({ ...result, errors }, null, 2));
    win.webContents.session.flushStorageData();
    app.exit(result.ok ? 0 : 1);
  };
  win.webContents.on('console-message', (event, legacyLevel, legacyMessage) => {
    const level = event.level ?? legacyLevel;
    if (level === 'error' || level === 3) errors.push(event.message ?? legacyMessage);
  });
  win.webContents.on('render-process-gone', (_e, details) => errors.push(`renderer: ${details.reason}`));
  win.webContents.on('did-fail-load', (_e, code, description) => errors.push(`chargement: ${code} ${description}`));
  setTimeout(() => report({ ok: false, reason: 'délai dépassé' }), 45000);
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const info = await win.webContents.executeJavaScript(`(async () => {
          window.__idle.save();
          const desktop = await window.desktop.getInfo();
          return {
            source: window.__idle.loadSource,
            kills: window.__idle.state.records.kills,
            goldEarned: window.__idle.state.records.goldEarned,
            saved: localStorage.getItem('idle-rpg.save') !== null,
            canvasWidth: document.querySelector('#scene').width,
            desktop,
          };
        })()`);
        report({ ok: errors.length === 0 && info.kills > 0 && info.saved, ...info });
      } catch (error) {
        report({ ok: false, reason: String(error) });
      }
    }, 10000);
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  serveGameFiles();
  const win = createWindow();
  if (smokeFile) runSmokeTest(win);
  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
});

app.on('window-all-closed', () => app.quit());
