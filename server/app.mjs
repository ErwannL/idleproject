// API de sauvegarde cloud, comptes, préinscription et administration ; service des pages statiques.
// Aucune dépendance : node:http, node:crypto, node:sqlite.
// Ne jamais journaliser de corps de requête, d'email, de mot de passe ni de jeton.
import { randomBytes, createHash, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

export const LIMITS = {
  jsonBody: 4 * 1024,
  saveBody: 2 * 1024 * 1024,
  sessionMs: 30 * 24 * 3600 * 1000,
  adminSessionMs: 12 * 3600 * 1000,
  authAttempts: { max: 10, windowMs: 15 * 60 * 1000 },
  preregAttempts: { max: 20, windowMs: 60 * 60 * 1000 },
};

export const CONSENT_VERSION = '2026-10-31';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

// Tris du classement : liste fermée, jamais de texte de requête dans le SQL.
const LEADERBOARD_SORTS = {
  stage: 's.max_stage DESC, s.level DESC, s.updated_at ASC',
  level: 's.level DESC, s.max_stage DESC, s.updated_at ASC',
  bosses: 's.bosses_defeated DESC, s.max_stage DESC, s.updated_at ASC',
};

const PSEUDO_RE = /^[A-Za-z0-9_-]{3,20}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

// Contrôles anti-triche côté serveur. Ils ne peuvent pas tout voir (le navigateur reste modifiable) :
// ils refusent ce qui est impossible dans la version publique, et ce qui régresse.
// Renvoie la raison du refus, ou null si la sauvegarde est acceptable.
export function checkSave(parsed, summary, current) {
  const cheats = parsed.cheats;
  if (cheats && typeof cheats === 'object') {
    const used = Object.values(cheats).some((v) => (Array.isArray(v) ? v.length > 0 : typeof v === 'object' && v !== null ? Object.keys(v).length > 0 : Boolean(v)));
    if (used) return 'Sauvegarde refusée : codes de triche détectés';
  }
  const inRange = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
  if (!inRange(summary.level, LIMITS_GAME.maxLevel) || summary.level < 1) return 'Sauvegarde refusée : niveau impossible';
  if (!inRange(summary.maxStage, LIMITS_GAME.maxStage) || summary.maxStage < 1) return 'Sauvegarde refusée : étape impossible';
  if (!Number.isFinite(summary.gold) || summary.gold < 0 || summary.gold > LIMITS_GAME.maxCurrency) return 'Sauvegarde refusée : or impossible';
  if (!Number.isFinite(summary.gems) || summary.gems < 0 || summary.gems > LIMITS_GAME.maxCurrency) return 'Sauvegarde refusée : gemmes impossibles';
  if (current && summary.level < current.level) return 'Sauvegarde refusée : niveau inférieur à celui du serveur';
  return null;
}

// Bornes du jeu (version publique). À garder alignées sur src/data/balance.js (level.maxLevel).
const LIMITS_GAME = { maxLevel: 1000, maxStage: 2000, maxCurrency: 1e15 };

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, , saltB64, keyB64] = (stored ?? '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, SCRYPT_PARAMS);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Limiteur simple en mémoire par clé (IP + route). Suffisant pour une seule instance.
export function createRateLimiter({ max, windowMs }, now = () => Date.now()) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const entry = hits.get(key);
    if (!entry || t - entry.start > windowMs) {
      hits.set(key, { start: t, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}

// Extrait les champs de suivi d'une partie (format du jeu) ; tout champ absent vaut 0.
export function summarizeSave(parsed) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    level: num(parsed.level),
    maxStage: num(parsed.maxStage),
    gold: num(parsed.gold),
    gems: num(parsed.gems),
    kills: num(parsed.kills),
    bossesDefeated: num(parsed.records?.bossesDefeated),
  };
}

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function sendText(res, status, text, type, headers = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
  res.end(text);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Requête trop volumineuse');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJson(req, limit = LIMITS.jsonBody) {
  const text = await readBody(req, limit);
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not object');
    return value;
  } catch {
    throw new HttpError(400, 'JSON invalide');
  }
}

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function bearer(req) {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

// Routes : { method, path: RegExp, handler(ctx) } ; ctx = { req, res, params, url }.
export function createApp({
  db,
  siteDir,
  webDir,
  adminPasswordHash = '',
  trustProxy = false,
  now = () => Date.now(),
  log = () => {},
}) {
  const authLimit = createRateLimiter(LIMITS.authAttempts, now);
  const preregLimit = createRateLimiter(LIMITS.preregAttempts, now);
  const adminTokens = new Map(); // hash du jeton admin -> expiration (en mémoire : perdu au redémarrage)

  const q = {
    insertSession: db.prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)'),
    findSession: db.prepare(
      'SELECT a.id AS id, a.pseudo AS pseudo FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?',
    ),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    findAccount: db.prepare('SELECT id, pseudo, password_hash FROM accounts WHERE pseudo = ?'),
    insertAccount: db.prepare('INSERT INTO accounts (pseudo, password_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?)'),
    touchAccount: db.prepare('UPDATE accounts SET last_seen_at = ? WHERE id = ?'),
    deleteAccount: db.prepare('DELETE FROM accounts WHERE id = ?'),
    findSave: db.prepare('SELECT data, version, updated_at, level FROM saves WHERE account_id = ?'),
    upsertSave: db.prepare(`INSERT INTO saves (account_id, data, version, updated_at, level, max_stage, gold, gems, kills, bosses_defeated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at,
        level = MAX(saves.level, excluded.level), max_stage = MAX(saves.max_stage, excluded.max_stage), gold = excluded.gold, gems = excluded.gems,
        kills = excluded.kills, bosses_defeated = excluded.bosses_defeated`),
    upsertPrereg: db.prepare('INSERT INTO preregistrations (email, consent_version, consent_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING'),
    deletePrereg: db.prepare('DELETE FROM preregistrations WHERE email = ?'),
    countPrereg: db.prepare('SELECT COUNT(*) AS n FROM preregistrations'),
  };

  function authenticate(req) {
    const token = bearer(req);
    if (!token) throw new HttpError(401, 'Connexion requise');
    const row = q.findSession.get(hashToken(token), now());
    if (!row) throw new HttpError(401, 'Session expirée');
    q.touchAccount.run(now(), row.id);
    return row;
  }

  function issueSession(accountId) {
    const token = randomBytes(32).toString('base64url');
    q.insertSession.run(hashToken(token), accountId, now() + LIMITS.sessionMs);
    return token;
  }

  function requireAdmin(req) {
    const token = bearer(req);
    const expires = token ? adminTokens.get(hashToken(token)) : undefined;
    if (!expires || expires < now()) throw new HttpError(401, 'Accès administrateur requis');
  }

  function rateLimit(limiter, key) {
    if (!limiter(key)) throw new HttpError(429, 'Trop de tentatives, réessayez plus tard');
  }

  // Liste de joueurs : tri et recherche, pour le panneau admin.
  const SORTS = {
    recent: 'COALESCE(a.last_seen_at, a.created_at) DESC',
    created: 'a.created_at DESC',
    level: 's.level DESC, s.max_stage DESC',
    stage: 's.max_stage DESC, s.level DESC',
    gold: 's.gold DESC',
  };

  const playerRow = (r) => ({
    id: r.id,
    pseudo: r.pseudo,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    hasSave: r.version !== null,
    saveUpdatedAt: r.updated_at ?? null,
    level: r.level ?? 0,
    maxStage: r.max_stage ?? 0,
    gold: r.gold ?? 0,
    gems: r.gems ?? 0,
    kills: r.kills ?? 0,
    bossesDefeated: r.bosses_defeated ?? 0,
  });

  const routes = [
    { method: 'POST', path: /^\/api\/register$/, handler: async ({ req }) => {
      rateLimit(authLimit, `register:${clientIp(req, trustProxy)}`);
      const { pseudo, password } = await readJson(req);
      if (typeof pseudo !== 'string' || !PSEUDO_RE.test(pseudo)) {
        throw new HttpError(400, 'Pseudo : 3 à 20 caractères (lettres, chiffres, _ ou -)');
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
        throw new HttpError(400, 'Mot de passe : 8 caractères minimum');
      }
      if (q.findAccount.get(pseudo)) throw new HttpError(409, 'Ce pseudo est déjà pris');
      const info = q.insertAccount.run(pseudo, await hashPassword(password), now(), now());
      return { status: 201, body: { token: issueSession(Number(info.lastInsertRowid)), pseudo } };
    } },

    { method: 'POST', path: /^\/api\/login$/, handler: async ({ req }) => {
      rateLimit(authLimit, `login:${clientIp(req, trustProxy)}`);
      const { pseudo, password } = await readJson(req);
      const account = typeof pseudo === 'string' ? q.findAccount.get(pseudo) : undefined;
      const ok = typeof password === 'string' && account ? await verifyPassword(password, account.password_hash) : false;
      if (!ok) throw new HttpError(401, 'Pseudo ou mot de passe incorrect');
      q.touchAccount.run(now(), account.id);
      return { body: { token: issueSession(account.id), pseudo: account.pseudo } };
    } },

    { method: 'POST', path: /^\/api\/logout$/, handler: ({ req }) => {
      const token = bearer(req);
      if (token) q.deleteSession.run(hashToken(token));
      return { status: 204 };
    } },

    { method: 'GET', path: /^\/api\/save$/, handler: ({ req }) => {
      const account = authenticate(req);
      const row = q.findSave.get(account.id);
      if (!row) return { body: { data: null, version: 0 } };
      return { body: { data: row.data, version: row.version, updatedAt: row.updated_at } };
    } },

    // Corps : { version, data } ; data = chaîne JSON de la partie. 409 si la version serveur a changé.
    { method: 'PUT', path: /^\/api\/save$/, handler: async ({ req }) => {
      const account = authenticate(req);
      const { version, data } = await readJson(req, LIMITS.saveBody);
      if (typeof data !== 'string' || data.length === 0) throw new HttpError(400, 'Sauvegarde manquante');
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        throw new HttpError(400, 'Sauvegarde invalide');
      }
      if (!parsed || typeof parsed !== 'object') throw new HttpError(400, 'Sauvegarde invalide');
      const current = q.findSave.get(account.id);
      const currentVersion = current?.version ?? 0;
      if (version !== currentVersion) {
        throw new HttpError(409, 'Sauvegarde plus récente sur le serveur', { version: currentVersion });
      }
      const next = currentVersion + 1;
      const s = summarizeSave(parsed);
      const reason = checkSave(parsed, s, current);
      if (reason) {
        log(`sauvegarde refusée pour le compte ${account.id} : ${reason}`);
        throw new HttpError(422, reason);
      }
      q.upsertSave.run(account.id, data, next, now(), s.level, s.maxStage, s.gold, s.gems, s.kills, s.bossesDefeated);
      return { body: { version: next } };
    } },

    // Suppression du compte et de toutes ses données (RGPD). Mot de passe requis.
    { method: 'DELETE', path: /^\/api\/account$/, handler: async ({ req }) => {
      const account = authenticate(req);
      const { password } = await readJson(req);
      const full = q.findAccount.get(account.pseudo);
      if (typeof password !== 'string' || !full || !(await verifyPassword(password, full.password_hash))) {
        throw new HttpError(401, 'Mot de passe incorrect');
      }
      q.deleteAccount.run(account.id);
      return { status: 204 };
    } },

    { method: 'POST', path: /^\/api\/preregister$/, handler: async ({ req }) => {
      rateLimit(preregLimit, `prereg:${clientIp(req, trustProxy)}`);
      const { email, consent } = await readJson(req);
      if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
        throw new HttpError(400, 'Adresse email invalide');
      }
      if (consent !== true) throw new HttpError(400, 'Le consentement est requis');
      q.upsertPrereg.run(email.trim().toLowerCase(), CONSENT_VERSION, now());
      return { status: 202, body: { ok: true } };
    } },

    { method: 'POST', path: /^\/api\/preregister\/remove$/, handler: async ({ req }) => {
      rateLimit(preregLimit, `prereg:${clientIp(req, trustProxy)}`);
      const { email } = await readJson(req);
      if (typeof email === 'string') q.deletePrereg.run(email.trim().toLowerCase());
      return { status: 202, body: { ok: true } };
    } },

    // Compteur public (agrégé) pour la barre de progression de la page d'accueil.
    { method: 'GET', path: /^\/api\/preregister\/count$/, handler: () => ({ body: { count: q.countPrereg.get().n } }) },

    // Classement public : joueurs ayant choisi d'apparaître (listed = 1) et ayant commencé à jouer.
    { method: 'GET', path: /^\/api\/leaderboard$/, handler: ({ url }) => {
      const sort = LEADERBOARD_SORTS[url.searchParams.get('sort')] ? url.searchParams.get('sort') : 'stage';
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 100);
      const rows = db.prepare(`SELECT a.pseudo, s.level, s.max_stage, s.bosses_defeated, s.updated_at
        FROM saves s JOIN accounts a ON a.id = s.account_id
        WHERE a.listed = 1 AND (s.level > 1 OR s.max_stage > 1 OR s.bosses_defeated > 0)
        ORDER BY ${LEADERBOARD_SORTS[sort]} LIMIT ?`).all(limit);
      return {
        body: {
          sort,
          players: rows.map((r, i) => ({
            rank: i + 1, pseudo: r.pseudo, level: r.level, maxStage: r.max_stage, bossesDefeated: r.bosses_defeated, updatedAt: r.updated_at,
          })),
        },
      };
    } },

    // Visibilité au classement (par défaut : oui). Authentifié.
    { method: 'PUT', path: /^\/api\/account\/listed$/, handler: async ({ req }) => {
      const account = authenticate(req);
      const { listed } = await readJson(req);
      if (typeof listed !== 'boolean') throw new HttpError(400, 'Valeur attendue : true ou false');
      db.prepare('UPDATE accounts SET listed = ? WHERE id = ?').run(listed ? 1 : 0, account.id);
      return { body: { listed } };
    } },

    { method: 'GET', path: /^\/api\/health$/, handler: () => ({ body: { ok: true } }) },

    // ---- Administration ----
    { method: 'POST', path: /^\/api\/admin\/login$/, handler: async ({ req }) => {
      if (!adminPasswordHash) throw new HttpError(404, 'Route inconnue');
      rateLimit(authLimit, `admin:${clientIp(req, trustProxy)}`);
      const { password } = await readJson(req);
      if (typeof password !== 'string' || !(await verifyPassword(password, adminPasswordHash))) {
        throw new HttpError(401, 'Mot de passe incorrect');
      }
      const token = randomBytes(32).toString('base64url');
      adminTokens.set(hashToken(token), now() + LIMITS.adminSessionMs);
      return { body: { token } };
    } },

    { method: 'GET', path: /^\/api\/admin\/stats$/, handler: ({ req }) => {
      requireAdmin(req);
      const t = now();
      const day = 24 * 3600 * 1000;
      const row = db.prepare(`SELECT
          (SELECT COUNT(*) FROM accounts) AS accounts,
          (SELECT COUNT(*) FROM accounts WHERE last_seen_at > ?) AS active24h,
          (SELECT COUNT(*) FROM accounts WHERE last_seen_at > ?) AS active7d,
          (SELECT COUNT(*) FROM accounts WHERE created_at > ?) AS new7d,
          (SELECT COUNT(*) FROM saves) AS withSave,
          (SELECT COUNT(*) FROM preregistrations) AS preregistrations,
          (SELECT COUNT(*) FROM preregistrations WHERE consent_at > ?) AS preregistrations7d,
          (SELECT COALESCE(MAX(level), 0) FROM saves) AS maxLevel,
          (SELECT COALESCE(MAX(max_stage), 0) FROM saves) AS maxStage,
          (SELECT COALESCE(AVG(level), 0) FROM saves) AS avgLevel,
          (SELECT COALESCE(AVG(max_stage), 0) FROM saves) AS avgStage`).get(t - day, t - 7 * day, t - 7 * day, t - 7 * day);
      const bySize = db.prepare(`SELECT
          SUM(CASE WHEN max_stage >= 10 THEN 1 ELSE 0 END) AS atStage10,
          SUM(CASE WHEN max_stage >= 25 THEN 1 ELSE 0 END) AS atStage25,
          SUM(CASE WHEN max_stage >= 50 THEN 1 ELSE 0 END) AS atStage50,
          SUM(CASE WHEN bosses_defeated >= 1 THEN 1 ELSE 0 END) AS withBoss
        FROM saves`).get();
      return { body: { ...row, ...bySize, now: t } };
    } },

    { method: 'GET', path: /^\/api\/admin\/players$/, handler: ({ req, url }) => {
      requireAdmin(req);
      const sort = SORTS[url.searchParams.get('sort')] ? url.searchParams.get('sort') : 'recent';
      const search = (url.searchParams.get('q') ?? '').slice(0, 20).replace(/[%_]/g, '');
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
      const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
      const where = search ? 'WHERE a.pseudo LIKE ?' : '';
      const args = search ? [`%${search}%`] : [];
      const rows = db.prepare(`SELECT a.id, a.pseudo, a.created_at, a.last_seen_at, s.version, s.updated_at,
          s.level, s.max_stage, s.gold, s.gems, s.kills, s.bosses_defeated
        FROM accounts a LEFT JOIN saves s ON s.account_id = a.id ${where}
        ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`).all(...args, limit, offset);
      const total = db.prepare(`SELECT COUNT(*) AS n FROM accounts a ${where}`).get(...args).n;
      return { body: { total, players: rows.map(playerRow) } };
    } },

    { method: 'GET', path: /^\/api\/admin\/players\/(\d+)$/, handler: ({ req, params }) => {
      requireAdmin(req);
      const r = db.prepare(`SELECT a.id, a.pseudo, a.created_at, a.last_seen_at, s.version, s.updated_at,
          s.level, s.max_stage, s.gold, s.gems, s.kills, s.bosses_defeated
        FROM accounts a LEFT JOIN saves s ON s.account_id = a.id WHERE a.id = ?`).get(Number(params[0]));
      if (!r) throw new HttpError(404, 'Joueur introuvable');
      const player = playerRow(r);
      const save = q.findSave.get(r.id);
      if (save) {
        const parsed = JSON.parse(save.data);
        player.progress = {
          stage: parsed.stage ?? null,
          heroes: Object.keys(parsed.heroes?.owned ?? {}).length,
          companions: Object.keys(parsed.companions?.owned ?? {}).length,
          rebirths: parsed.records?.rebirths ?? 0,
          summons: parsed.records?.summons ?? 0,
          createdAt: parsed.createdAt ?? null,
          lastSaved: parsed.lastSaved ?? null,
          gameVersion: parsed.version ?? null,
        };
      }
      return { body: player };
    } },

    { method: 'DELETE', path: /^\/api\/admin\/players\/(\d+)$/, handler: ({ req, params }) => {
      requireAdmin(req);
      const info = q.deleteAccount.run(Number(params[0]));
      if (!info.changes) throw new HttpError(404, 'Joueur introuvable');
      return { status: 204 };
    } },

    { method: 'GET', path: /^\/api\/admin\/preregistrations$/, handler: ({ req, url }) => {
      requireAdmin(req);
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 1000);
      const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
      const rows = db.prepare('SELECT email, consent_version, consent_at FROM preregistrations ORDER BY consent_at DESC LIMIT ? OFFSET ?')
        .all(limit, offset);
      return { body: { total: q.countPrereg.get().n, items: rows.map((r) => ({ email: r.email, consentVersion: r.consent_version, consentAt: r.consent_at })) } };
    } },

    { method: 'GET', path: /^\/api\/admin\/preregistrations\.csv$/, handler: ({ req }) => {
      requireAdmin(req);
      const rows = db.prepare('SELECT email, consent_version, consent_at FROM preregistrations ORDER BY consent_at').all();
      const lines = ['email,consent_version,consent_at_iso', ...rows.map((r) => `${r.email},${r.consent_version},${new Date(r.consent_at).toISOString()}`)];
      return { raw: lines.join('\n') + '\n', type: 'text/csv; charset=utf-8' };
    } },

    { method: 'DELETE', path: /^\/api\/admin\/preregistrations\/([^/]+)$/, handler: ({ req, params }) => {
      requireAdmin(req);
      q.deletePrereg.run(decodeURIComponent(params[0]).trim().toLowerCase());
      return { status: 204 };
    } },
  ];

  async function serveStatic(req, res, pathname) {
    // /play/... sert le jeu compilé (webDir), le reste sert le site (siteDir).
    const isGame = pathname === '/play' || pathname.startsWith('/play/');
    const dir = isGame ? webDir : siteDir;
    const rel = isGame ? pathname.slice('/play'.length) || '/' : pathname;
    if (!dir) return send(res, 404, { error: 'Introuvable' });
    const root = resolve(dir);
    let target = normalize(join(root, decodeURIComponent(rel)));
    if (target !== root && !target.startsWith(root + sep)) return send(res, 403, { error: 'Interdit' });
    let info = await stat(target).catch(() => null);
    if (info?.isDirectory()) {
      target = join(target, 'index.html');
      info = await stat(target).catch(() => null);
    }
    if (!info?.isFile()) return send(res, 404, { error: 'Introuvable' });
    const type = TYPES[extname(target)];
    if (!type) return send(res, 403, { error: 'Interdit' });
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=300' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(target).pipe(res);
    return undefined;
  }

  return async function handle(req, res) {
    const started = now();
    // Jetons en en-tête Authorization (pas de cookies) : CORS ouvert sans identifiants est sans risque.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    const url = new URL(req.url, 'http://localhost');
    // Journal : méthode, chemin (sans requête), code, durée. Jamais de corps ni d'email.
    const finish = (code) => {
      log(`${req.method} ${url.pathname} ${code} ${now() - started}ms`);
      return code;
    };
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return finish(204);
      }
      if (url.pathname.startsWith('/api/')) {
        for (const route of routes) {
          if (route.method !== req.method) continue;
          const match = route.path.exec(url.pathname);
          if (!match) continue;
          const result = await route.handler({ req, res, url, params: match.slice(1) });
          if (result?.raw !== undefined) {
            sendText(res, result.status ?? 200, result.raw, result.type);
            return finish(result.status ?? 200);
          }
          const code = result?.status ?? 200;
          send(res, code, result?.body);
          return finish(code);
        }
        send(res, 404, { error: 'Route inconnue' });
        return finish(404);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        send(res, 405, { error: 'Méthode non autorisée' });
        return finish(405);
      }
      await serveStatic(req, res, url.pathname);
      return finish(res.statusCode);
    } catch (error) {
      if (error instanceof HttpError) {
        send(res, error.status, { error: error.message, ...error.extra });
        return finish(error.status);
      }
      log(`${req.method} ${url.pathname} erreur interne`);
      send(res, 500, { error: 'Erreur interne' });
      return finish(500);
    }
  };
}
