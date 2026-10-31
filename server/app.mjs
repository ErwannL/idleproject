// API de sauvegarde cloud et de préinscription, plus service des pages statiques.
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

const PSEUDO_RE = /^[A-Za-z0-9_-]{3,20}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

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

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, , saltB64, keyB64] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Limiteur simple en mémoire par IP et par route (suffisant pour une seule instance).
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

export function createApp({ db, siteDir, webDir, trustProxy = false, now = () => Date.now(), log = () => {} }) {
  const authLimit = createRateLimiter(LIMITS.authAttempts, now);
  const preregLimit = createRateLimiter(LIMITS.preregAttempts, now);

  const insertSession = db.prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)');
  const findSession = db.prepare(
    'SELECT a.id AS id, a.pseudo AS pseudo, a.password_hash AS password_hash FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?',
  );
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const findAccount = db.prepare('SELECT id, pseudo, password_hash FROM accounts WHERE pseudo = ?');
  const insertAccount = db.prepare('INSERT INTO accounts (pseudo, password_hash, created_at) VALUES (?, ?, ?)');
  const deleteAccount = db.prepare('DELETE FROM accounts WHERE id = ?');
  const findSave = db.prepare('SELECT data, version, updated_at FROM saves WHERE account_id = ?');
  const upsertSave = db.prepare(
    'INSERT INTO saves (account_id, data, version, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at',
  );
  const upsertPrereg = db.prepare(
    'INSERT INTO preregistrations (email, consent_version, consent_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING',
  );
  const deletePrereg = db.prepare('DELETE FROM preregistrations WHERE email = ?');

  function authenticate(req) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HttpError(401, 'Connexion requise');
    const row = findSession.get(hashToken(token), now());
    if (!row) throw new HttpError(401, 'Session expirée');
    return row;
  }

  function issueSession(accountId) {
    const token = randomBytes(32).toString('base64url');
    insertSession.run(hashToken(token), accountId, now() + LIMITS.sessionMs);
    return token;
  }

  const routes = {
    'POST /api/register': async (req) => {
      const ip = clientIp(req, trustProxy);
      if (!authLimit(`register:${ip}`)) throw new HttpError(429, 'Trop de tentatives, réessayez plus tard');
      const { pseudo, password } = await readJson(req);
      if (typeof pseudo !== 'string' || !PSEUDO_RE.test(pseudo)) {
        throw new HttpError(400, 'Pseudo : 3 à 20 caractères (lettres, chiffres, _ ou -)');
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
        throw new HttpError(400, 'Mot de passe : 8 caractères minimum');
      }
      if (findAccount.get(pseudo)) throw new HttpError(409, 'Ce pseudo est déjà pris');
      const info = insertAccount.run(pseudo, await hashPassword(password), now());
      const token = issueSession(Number(info.lastInsertRowid));
      return { status: 201, body: { token, pseudo } };
    },

    'POST /api/login': async (req) => {
      const ip = clientIp(req, trustProxy);
      if (!authLimit(`login:${ip}`)) throw new HttpError(429, 'Trop de tentatives, réessayez plus tard');
      const { pseudo, password } = await readJson(req);
      const account = typeof pseudo === 'string' ? findAccount.get(pseudo) : undefined;
      const ok = typeof password === 'string' && account
        ? await verifyPassword(password, account.password_hash)
        : false;
      if (!ok) throw new HttpError(401, 'Pseudo ou mot de passe incorrect');
      return { body: { token: issueSession(account.id), pseudo: account.pseudo } };
    },

    'POST /api/logout': (req) => {
      const token = (req.headers.authorization ?? '').slice(7);
      if (token) deleteSession.run(hashToken(token));
      return { status: 204 };
    },

    'GET /api/save': (req) => {
      const account = authenticate(req);
      const row = findSave.get(account.id);
      if (!row) return { body: { data: null, version: 0 } };
      return { body: { data: row.data, version: row.version, updatedAt: row.updated_at } };
    },

    // Corps : { version, data } où data est la chaîne JSON de la partie.
    // version = version connue du client ; refus 409 si la sauvegarde a changé entre-temps.
    'PUT /api/save': async (req) => {
      const account = authenticate(req);
      const { version, data } = await readJson(req, LIMITS.saveBody);
      if (typeof data !== 'string' || data.length === 0) throw new HttpError(400, 'Sauvegarde manquante');
      const current = findSave.get(account.id);
      const currentVersion = current?.version ?? 0;
      if (version !== currentVersion) {
        throw new HttpError(409, 'Sauvegarde plus récente sur le serveur', { version: currentVersion });
      }
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        throw new HttpError(400, 'Sauvegarde invalide');
      }
      if (!parsed || typeof parsed !== 'object') throw new HttpError(400, 'Sauvegarde invalide');
      const next = currentVersion + 1;
      upsertSave.run(account.id, data, next, now());
      return { body: { version: next } };
    },

    // Suppression du compte et de toutes ses données (RGPD, droit à l'effacement).
    // Exige le mot de passe pour éviter une suppression par un tiers avec un jeton volé.
    'DELETE /api/account': async (req) => {
      const account = authenticate(req);
      const { password } = await readJson(req);
      const full = findAccount.get(account.pseudo);
      if (typeof password !== 'string' || !full || !(await verifyPassword(password, full.password_hash))) {
        throw new HttpError(401, 'Mot de passe incorrect');
      }
      deleteAccount.run(account.id);
      return { status: 204 };
    },

    // Préinscription : consentement explicite requis. Réponse identique, que l'email existe ou non.
    'POST /api/preregister': async (req) => {
      const ip = clientIp(req, trustProxy);
      if (!preregLimit(`prereg:${ip}`)) throw new HttpError(429, 'Trop de tentatives, réessayez plus tard');
      const { email, consent } = await readJson(req);
      if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
        throw new HttpError(400, 'Adresse email invalide');
      }
      if (consent !== true) throw new HttpError(400, 'Le consentement est requis');
      upsertPrereg.run(email.trim().toLowerCase(), CONSENT_VERSION, now());
      return { status: 202, body: { ok: true } };
    },

    // Retrait de la liste de préinscription. Réponse identique, que l'email existe ou non.
    'POST /api/preregister/remove': async (req) => {
      const ip = clientIp(req, trustProxy);
      if (!preregLimit(`prereg:${ip}`)) throw new HttpError(429, 'Trop de tentatives, réessayez plus tard');
      const { email } = await readJson(req);
      if (typeof email === 'string') deletePrereg.run(email.trim().toLowerCase());
      return { status: 202, body: { ok: true } };
    },

    'GET /api/health': () => ({ body: { ok: true } }),
  };

  async function serveStatic(req, res, pathname) {
    // /play/... sert le jeu compilé (webDir), tout le reste sert le site (siteDir).
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
    const url = new URL(req.url, 'http://localhost');
    const key = `${req.method} ${url.pathname}`;
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
      const route = routes[key];
      if (route) {
        const result = await route(req, res);
        const code = result?.status ?? 200;
        send(res, code, result?.body, result?.headers);
        return finish(code);
      }
      if (url.pathname.startsWith('/api/')) {
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
      log(`${key} erreur interne`);
      send(res, 500, { error: 'Erreur interne' });
      return finish(500);
    }
  };
}
