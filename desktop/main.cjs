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
const TAGS_FALLBACK_API = 'https://data.jsdelivr.com/v1/packages/gh/ErwannL/idleproject';

// Dernière release : API GitHub, sinon (bloquée, limite de requêtes…) liste des tags via jsDelivr.
// Dépôt privé (v8.2) : un jeton GitHub (lecture seule) saisi par le joueur est nécessaire ; il n'est jamais
// enregistré par le jeu ailleurs que sur ce PC et n'est envoyé qu'à api.github.com.
const validToken = (t) => typeof t === 'string' && /^[A-Za-z0-9_]{20,255}$/.test(t);
const ghHeaders = (token, accept = 'application/vnd.github+json') => ({
  Accept: accept, 'User-Agent': 'IdleRPG', ...(validToken(token) ? { Authorization: `Bearer ${token}` } : {}),
});

async function latestRelease(token) {
  const errors = [];
  try {
    const res = await net.fetch(RELEASES_API, { headers: ghHeaders(token) });
    if (res.ok) {
      const r = await res.json();
      return {
        tag_name: r.tag_name, html_url: r.html_url, body: r.body,
        assets: (r.assets ?? []).map((a) => ({ id: a.id, url: a.url, name: a.name, browser_download_url: a.browser_download_url, size: a.size })),
      };
    }
    errors.push(`GitHub ${res.status}${res.status === 404 && !validToken(token) ? ' (dépôt privé ?)' : ''}`);
  } catch (error) {
    errors.push(`GitHub : ${error?.message ?? error}`);
  }
  try {
    const res = await net.fetch(TAGS_FALLBACK_API, { headers: { 'User-Agent': 'IdleRPG' } });
    if (res.ok) {
      const versions = ((await res.json()).versions ?? []).map((v) => String(v.version ?? v).replace(/^v/i, ''))
        .filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort((a, b) => (newerThan(a, b) ? 1 : newerThan(b, a) ? -1 : 0));
      const version = versions.at(-1);
      if (version) {
        const name = `IdleRPG-${version}-setup.exe`;
        return {
          tag_name: `v${version}`, html_url: `https://github.com/ErwannL/idleproject/releases/tag/v${version}`, body: '',
          assets: [{ name, browser_download_url: `https://github.com/ErwannL/idleproject/releases/download/v${version}/${name}`, size: 0 }],
        };
      }
    }
    errors.push(`jsDelivr ${res.status}`);
  } catch (error) {
    errors.push(`jsDelivr : ${error?.message ?? error}`);
  }
  return { error: errors.join(' · ') };
}
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

let duplicate = false; // une autre instance tourne déjà : aucune fenêtre ici
if (smokeFile) {
  const dir = path.join(app.getPath('temp'), 'idle-rpg-smoke');
  if (process.argv.includes('--smoke-fresh')) fs.rmSync(dir, { recursive: true, force: true });
  app.setPath('userData', dir);
} else if (!app.requestSingleInstanceLock()) {
  // Une seule instance : deux fenêtres écraseraient mutuellement la sauvegarde.
  duplicate = true;
  // v8.9.1 : si l'autre instance était un processus fantôme (fenêtre fermée), elle vient de se terminer en
  // recevant notre signal : on se relance une fois, après un court délai, au lieu de ne rien ouvrir.
  if (!process.argv.includes('--lock-retry')) {
    setTimeout(() => {
      app.relaunch({ args: [...process.argv.slice(1), '--lock-retry'] });
      app.exit(0);
    }, 2500);
  } else {
    app.quit();
  }
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
  // v9.0.2 : mise à jour lancée la dernière fois mais version inchangée → elle a échoué ; on le signale.
  let updateFailed = null;
  const pending = settings.pendingUpdate;
  if (pending && !smokeFile) {
    if (newerThan(String(pending.version), app.getVersion())) {
      updateFailed = { version: String(pending.version), file: fs.existsSync(String(pending.file)) ? String(pending.file) : null };
    }
    delete settings.pendingUpdate;
    saveSettings(settings);
  }
  if (!smokeFile) cleanOldInstallers(updateFailed?.file);
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
  // v8.5 : écran noir (processus de la page tombé, ou bloqué trop longtemps) → la page est rechargée ;
  // la partie repart de la dernière sauvegarde automatique (10 s au plus).
  if (!smokeFile) {
    win.webContents.on('render-process-gone', (_e, details) => {
      if (details.reason !== 'clean-exit' && !win.isDestroyed()) setTimeout(() => !win.isDestroyed() && win.webContents.reload(), 800);
    });
    let hungSince = 0;
    win.on('unresponsive', () => {
      hungSince = Date.now();
      setTimeout(() => { if (hungSince && !win.isDestroyed()) win.webContents.forcefullyCrashRenderer(); }, 20000);
    });
    win.on('responsive', () => { hungSince = 0; });
  }
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) event.preventDefault();
  });

  ipcMain.handle('desktop:getInfo', () => ({ alwaysOnTop: win.isAlwaysOnTop(), version: app.getVersion(), smoke: Boolean(smokeFile), updateFailed }));
  // Relance l'installateur déjà téléchargé (après un échec signalé), visible.
  ipcMain.handle('desktop:retryInstaller', () => {
    const file = updateFailed?.file;
    if (!file || !fs.existsSync(file)) return { ok: false, error: 'Installateur introuvable : téléchargez-le à nouveau.' };
    settings.pendingUpdate = { version: updateFailed.version, file, at: Date.now() };
    saveSettings(settings);
    runInstaller(file);
    setTimeout(() => win.close(), 300);
    return { ok: true };
  });
  ipcMain.handle('desktop:setAlwaysOnTop', (_event, value) => {
    win.setAlwaysOnTop(Boolean(value));
    settings.alwaysOnTop = win.isAlwaysOnTop();
    saveSettings(settings);
    return settings.alwaysOnTop;
  });
  // Mise à jour (v7.8) : le processus principal relit lui-même la dernière release GitHub,
  // télécharge l'installateur officiel puis le lance en silencieux et ferme le jeu (sauvegarde comprise).
  ipcMain.handle('desktop:checkUpdate', (_event, token) => latestRelease(token));
  ipcMain.handle('desktop:openReleases', () => shell.openExternal(RELEASES_PAGE));
  ipcMain.handle('desktop:installUpdate', async (_event, token) => {
    try {
      const release = await latestRelease(token);
      if (release.error) return { ok: false, error: release.error };
      const version = String(release.tag_name ?? '').replace(/^v/i, '');
      if (!newerThan(version, app.getVersion())) return { ok: false, error: 'Déjà à jour.' };
      const asset = (release.assets ?? []).find((a) => /^IdleRPG-[\d.]+-setup\.exe$/.test(a.name ?? ''));
      // Dépôt privé : téléchargement par l'API (avec le jeton) ; public : lien de téléchargement direct.
      const privateDl = validToken(token) && asset?.url;
      const url = asset && new URL(privateDl ? asset.url : asset.browser_download_url);
      const okUrl = url && url.protocol === 'https:' && (privateDl
        ? url.hostname === 'api.github.com' && url.pathname.startsWith('/repos/ErwannL/idleproject/releases/assets/')
        : url.hostname === 'github.com' && url.pathname.startsWith('/ErwannL/idleproject/releases/download/'));
      if (!okUrl) return { ok: false, error: 'Installateur introuvable dans la release.' };
      const file = path.join(app.getPath('temp'), asset.name);
      // v8.9.2 : l'installateur a besoin d'environ 700 Mo (téléchargement + décompression + installation).
      const freeMb = freeSpaceMb(app.getPath('temp'));
      if (freeMb !== null && freeMb < 800) {
        return { ok: false, error: `Espace disque insuffisant : ${freeMb} Mo libres, il en faut environ 800 Mo. Videz la Corbeille ou supprimez des fichiers, puis réessayez.` };
      }
      const download = await net.fetch(url.href, privateDl ? { headers: ghHeaders(token, 'application/octet-stream') } : {});
      if (!download.ok) return { ok: false, error: `Téléchargement ${download.status}` };
      const data = Buffer.from(await download.arrayBuffer());
      if (asset.size && data.length !== asset.size) return { ok: false, error: 'Téléchargement incomplet.' };
      fs.writeFileSync(file, data);
      if (process.platform !== 'win32') return { ok: false, error: 'Installation automatique : Windows seulement.' };
      // v9.0.2 : installateur lancé directement et VISIBLE (fenêtre de progression, erreurs affichées) ; il ferme
      // lui-même le jeu (après sa sauvegarde) et le relance à la fin. Avant : script PowerShell intermédiaire puis
      // installation silencieuse — un échec de l'un ou l'autre laissait l'ancienne version sans aucun message.
      // La mise à jour en cours est notée : au prochain lancement, une version inchangée = échec signalé.
      settings.pendingUpdate = { version, file, at: Date.now() };
      saveSettings(settings);
      runInstaller(file);
      setTimeout(() => win.close(), 300);
      return { ok: true, version };
    } catch (error) {
      return { ok: false, error: String(error?.message ?? error) };
    }
  });
  let sideExtra = 0; // largeur ajoutée pour le menu sur le côté (retirée des dimensions mémorisées)
  let sideExtraH = 0; // hauteur ajoutée (menu ouvert depuis le mode barre)
  // v8.9 : élargir / rétrécir la fenêtre (menu ouvert sur le côté en petite fenêtre), sans sortir de l'écran.
  ipcMain.handle('desktop:resizeBy', (_event, dw, dh) => {
    if (win.isMaximized() || win.isFullScreen()) return false;
    const b = win.getBounds();
    const area = screen.getDisplayMatching(b).workArea;
    const width = Math.max(260, Math.min(area.width, b.width + (Number(dw) || 0)));
    const height = Math.max(110, Math.min(area.height, b.height + (Number(dh) || 0)));
    const x = Math.max(area.x, Math.min(b.x, area.x + area.width - width));
    win.setBounds({ x, y: b.y, width, height });
    sideExtra += width - b.width;
    return true;
  });
  // v9.0.6 : le menu s'ouvre à GAUCHE de la scène — la fenêtre s'agrandit vers la gauche (et vers le haut en
  // mode barre), la scène reste à sa place à l'écran ; restoreGrow annule exactement l'agrandissement.
  let grown = null; // { dw, dh } réellement ajoutés
  ipcMain.handle('desktop:growLeft', (_event, dw, dh) => {
    if (grown || win.isMaximized() || win.isFullScreen()) return false;
    const b = win.getBounds();
    const area = screen.getDisplayMatching(b).workArea;
    const width = Math.min(area.width, b.width + Math.max(0, Number(dw) || 0));
    const height = Math.min(area.height, b.height + Math.max(0, Number(dh) || 0));
    const x = Math.max(area.x, b.x - (width - b.width));
    const y = Math.max(area.y, b.y - (height - b.height));
    win.setBounds({ x, y, width, height });
    grown = { dw: width - b.width, dh: height - b.height, dx: b.x - x, dy: b.y - y };
    sideExtra += grown.dw;
    sideExtraH += grown.dh;
    return true;
  });
  ipcMain.handle('desktop:restoreGrow', () => {
    if (!grown) return false;
    const b = win.getBounds();
    if (!win.isMaximized() && !win.isFullScreen()) {
      win.setBounds({ x: b.x + grown.dx, y: b.y + grown.dy, width: Math.max(260, b.width - grown.dw), height: Math.max(110, b.height - grown.dh) });
    }
    sideExtra -= grown.dw;
    sideExtraH -= grown.dh;
    grown = null;
    return true;
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
    if (sideExtra > 0) settings.bounds.width = Math.max(260, settings.bounds.width - sideExtra);
    if (sideExtraH > 0) settings.bounds.height = Math.max(110, settings.bounds.height - sideExtraH);
    if (grown) { settings.bounds.x += grown.dx; settings.bounds.y += grown.dy; }
    saveSettings(settings);
    const finalSave = win.webContents.executeJavaScript('window.__idle && window.__idle.save()').catch(() => {});
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    Promise.race([finalSave, timeout]).finally(() => {
      win.webContents.session.flushStorageData();
      win.destroy();
      // Filet de sécurité (v8.9.1) : jamais de processus fantôme sans fenêtre, qui bloquerait les relances.
      setTimeout(() => app.exit(0), 3000).unref?.();
    });
  });

  // Test (CI, v9.0.2) : `--test-update=<setup.exe>` refait le chemin du bouton « Mettre à jour » sans le
  // téléchargement : mise à jour notée, installateur lancé, jeu fermé.
  const testUpdate = process.argv.find((a) => a.startsWith('--test-update='));
  if (testUpdate && !smokeFile) {
    win.webContents.once('did-finish-load', () => setTimeout(() => {
      settings.pendingUpdate = { version: app.getVersion(), file: testUpdate.slice('--test-update='.length), at: Date.now() };
      saveSettings(settings);
      runInstaller(settings.pendingUpdate.file);
      setTimeout(() => win.close(), 300);
    }, 6000));
  }

  win.loadURL(`${ORIGIN}/index.html`);
  return win;
}

// Place libre (Mo) sur le disque d'un dossier ; null si inconnue.
function freeSpaceMb(dir) {
  try {
    const st = fs.statfsSync(dir);
    return Math.floor((st.bavail * st.bsize) / 1048576);
  } catch {
    return null;
  }
}

// v8.9.2 : les installateurs téléchargés par les mises à jour précédentes restaient dans le dossier Temp
// (≈ 120 Mo chacun) et finissaient par remplir le disque ; on les supprime au lancement.
function cleanOldInstallers(keep = null) {
  try {
    const dir = app.getPath('temp');
    for (const name of fs.readdirSync(dir)) {
      if (/^IdleRPG-[\d.]+-setup\.exe$/.test(name) && path.join(dir, name) !== keep) fs.rm(path.join(dir, name), { force: true }, () => {});
    }
  } catch {
    // Dossier Temp illisible : sans importance.
  }
}

// Lance l'installateur (visible) détaché du jeu : il attend lui-même la fermeture du jeu (v8.9.1+).
function runInstaller(file) {
  spawn(file, ['--updated'], { detached: true, stdio: 'ignore' }).unref();
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
  if (duplicate) return;
  Menu.setApplicationMenu(null);
  serveGameFiles();
  const win = createWindow();
  if (smokeFile) runSmokeTest(win);
  app.on('second-instance', () => {
    // Fenêtre déjà fermée (processus en train de quitter ou bloqué) : on libère la place à la nouvelle instance.
    if (win.isDestroyed()) { app.exit(0); return; }
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
});

app.on('window-all-closed', () => app.quit());
