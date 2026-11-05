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
  guestAttempts: { max: 30, windowMs: 60 * 60 * 1000 },
};

export const CONSENT_VERSION = '2026-10-31';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
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
  kills: 's.kills DESC, s.max_stage DESC, s.updated_at ASC',
  gold: 's.gold_earned DESC, s.max_stage DESC, s.updated_at ASC',
  rebirths: 's.rebirths DESC, s.max_stage DESC, s.updated_at ASC',
  tower: 's.tower_best DESC, s.max_stage DESC, s.updated_at ASC',
  playtime: 's.play_seconds DESC, s.max_stage DESC, s.updated_at ASC',
  // v9.1.7 : temps, le plus court gagne (0 = jamais fait, exclu).
  rebirthFast: 's.best_rebirth ASC, s.updated_at ASC',
  transcendFast: 's.best_transcend ASC, s.updated_at ASC',
  reach: 'reach ASC, s.updated_at ASC',
};
// Filtre propre à chaque tri de temps (les joueurs sans valeur n'y figurent pas).
const LEADERBOARD_FILTER = { rebirthFast: 's.best_rebirth > 0', transcendFast: 's.best_transcend > 0', reach: 'reach IS NOT NULL AND reach >= 0' };
// Valeur affichée pour chaque tri (colonne de la table saves).
const LEADERBOARD_VALUE = {
  stage: 'max_stage', level: 'level', bosses: 'bosses_defeated', kills: 'kills', gold: 'gold_earned', rebirths: 'rebirths', tower: 'tower_best', playtime: 'play_seconds', rebirthFast: 'best_rebirth', transcendFast: 'best_transcend', reach: 'reach',
};
const MAX_FRIENDS = 100;

const PSEUDO_RE = /^[A-Za-z0-9_-]{3,20}$/;
// Noms automatiques des comptes invités (v9.1.1) : réservés, un joueur ne peut pas les choisir.
const GUEST_RE = /^joueur\d{6}$/i;
const PLATFORMS = new Set(['windows', 'android', 'web', 'mac', 'linux']);
const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

// Valide un pseudo choisi par le joueur ; renvoie le message d'erreur ou null.
function pseudoError(pseudo) {
  if (typeof pseudo !== 'string' || !PSEUDO_RE.test(pseudo)) return "Nom d'utilisateur : 3 à 20 caractères (lettres, chiffres, _ ou -)";
  if (GUEST_RE.test(pseudo)) return 'Ce nom est réservé aux comptes automatiques : choisissez-en un autre';
  return null;
}

function passwordError(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) return 'Mot de passe : 8 caractères minimum';
  return null;
}

// Jour civil UTC (AAAA-MM-JJ) pour l'activité quotidienne.
export function dayOf(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
const ADMIN_NAME_RE = /^[A-Za-z]{2,20}$/;

// Mot de passe temporaire : 12 caractères, communiqué une seule fois. Doit être changé au premier login.
function temporaryPassword() {
  return randomBytes(9).toString('base64url');
}
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
  // Partie plus ancienne que celle du serveur : le temps de jeu cumulé ne recule jamais (il survit aux renaissances et
  // transcendances, contrairement au niveau, remis à 1 : en 9.1.2 toute sauvegarde après une renaissance était refusée).
  // Une minute de marge (arrondis, sauvegarde envoyée pendant un pas de jeu).
  if (current && (current.play_seconds ?? 0) > 0 && summary.playSeconds + 60 < current.play_seconds) {
    return 'Sauvegarde refusée : partie plus ancienne que celle du serveur';
  }
  // v9.1.3 : format de sauvegarde (SAVE_VERSION) plus ancien que celui du serveur : un jeu non mis à jour (9.1.2,
  // format 7) écraserait une partie déjà migrée (format 8). Refusé ; ce jeu garde sa copie locale.
  if (current && saveFormat(parsed) < saveFormat(current.data)) return 'Sauvegarde refusée : version du jeu trop ancienne, mettez le jeu à jour';
  return null;
}

// Bornes du jeu (version publique). À garder alignées sur src/data/balance.js (level.maxLevel).
// Étape, or et gemmes n'ont pas de plafond dans le jeu (cycles de difficulté ×2, ×3… sans fin ; croissance
// exponentielle d'un idle) : seulement entiers / finis et positifs. En 9.1.2, l'étape 2001 (6-11 ×10) était refusée.
const LIMITS_GAME = { maxLevel: 1000, maxStage: Number.MAX_SAFE_INTEGER, maxCurrency: Number.MAX_VALUE };

// v9.1.3 (doc4 lot 7) : scores du mode monde (un par perso). Le serveur ne rejoue pas le combat : il refuse ce qui est
// impossible ou incohérent avec la sauvegarde envoyée. Un score refusé n'empêche jamais la sauvegarde (il est ignoré).
// À garder alignées sur le jeu : 6 exemplaires au plus (0★ à 5★), niveau 20 (data/companions.js), croissance des PV
// des ennemis 1,075 par étape (data/balance.js enemyScaling.hpGrowth). Plafond des dégâts : 1e10 × 1,075^étape record,
// soit environ 3e6 fois les PV du boss de cette étape, 5 000 à 200 000 fois les scores mesurés (comptes de référence de tests/helpers, mode monde) (marge large : Renaissances, Transcendance).
export const SCORE_RULES = { maxUnits: 50, maxStars: 5, maxLevel: 20, unitRe: /^[a-z0-9_]{2,32}$/, damageBase: 1e10, hpGrowth: 1.075, futureMs: 24 * 3600 * 1000 };
export function scoreCap(bestStage) {
  return SCORE_RULES.damageBase * SCORE_RULES.hpGrowth ** Math.max(1, Math.min(LIMITS_GAME.maxStage, bestStage));
}

// Extrait les scores valides d'une sauvegarde (objet de jeu). Renvoie [{ unit, damage, stars, level, at }].
export function extractScores(parsed, now = Date.now()) {
  const worlds = parsed?.worlds;
  if (!worlds || typeof worlds !== 'object' || Array.isArray(worlds)) return [];
  const owned = parsed.companions?.owned && typeof parsed.companions.owned === 'object' ? parsed.companions.owned : {};
  const best = Math.max(Number(parsed.records?.bestStage) || 0, Number(parsed.maxStage) || 0, 1);
  const out = [];
  for (const [unit, rec] of Object.entries(worlds).slice(0, SCORE_RULES.maxUnits)) {
    const s = rec?.score;
    if (!SCORE_RULES.unitRe.test(unit) || !s || typeof s !== 'object') continue;
    const o = owned[unit];
    if (!o || typeof o !== 'object' || o.trial === true) continue; // perso possédé (l'essai gratuit ne compte pas)
    const copies = Number(o.stars);
    const { damage, stars, level, at } = s;
    if (!Number.isFinite(damage) || damage <= 0 || damage > scoreCap(best)) continue;
    if (!Number.isInteger(stars) || stars < 0 || stars > SCORE_RULES.maxStars || stars > copies - 1) continue; // étoiles ≤ doublons possédés
    if (!Number.isInteger(level) || level < 1 || level > SCORE_RULES.maxLevel || level > Number(o.level)) continue;
    if (!Number.isFinite(at) || at <= 0 || at > now + SCORE_RULES.futureMs) continue;
    if (Array.isArray(s.team) && !s.team.includes(unit)) continue; // le perso était dans l'équipe
    out.push({ unit, damage: Math.floor(damage), stars, level, at: Math.floor(at) });
  }
  return out;
}

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

// Compte uniquement les ÉCHECS : une connexion réussie ne consomme pas de tentative.
export function createFailureLimiter({ max, windowMs }, now = () => Date.now()) {
  const fails = new Map();
  const current = (key) => {
    const entry = fails.get(key);
    if (!entry || now() - entry.start > windowMs) return null;
    return entry;
  };
  return {
    blocked: (key) => (current(key)?.count ?? 0) >= max,
    fail: (key) => {
      const entry = current(key);
      if (entry) entry.count += 1;
      else fails.set(key, { start: now(), count: 1 });
    },
    clear: (key) => fails.delete(key),
  };
}

// Libellé d'étape du jeu (« 7-6 ×8 » = monde 7, étape 6, difficulté ×8), comme src/core/combat.js stageLabel.
// Étapes par monde de src/data/zones.js (tests/server.test.js vérifie l'égalité avec le jeu).
// v9.2.0 (monde marin) : Royaume englouti inséré en monde 11 (20 étapes), l'Abysse devient le monde 12.
export const ZONE_STAGES = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 10];
export function stageLabel(stage) {
  const cycle = ZONE_STAGES.reduce((a, b) => a + b, 0);
  if (!Number.isInteger(stage) || stage < 1) return '—';
  let s = (stage - 1) % cycle;
  let zone = 0;
  while (s >= ZONE_STAGES[zone]) { s -= ZONE_STAGES[zone]; zone += 1; }
  const d = Math.floor((stage - 1) / cycle) + 1;
  return `${zone + 1}-${s + 1}${d > 1 ? ` ×${d}` : ''}`;
}

// Extrait les champs de suivi d'une partie (format du jeu) ; tout champ absent vaut 0.
// v9.1.3 : format (SAVE_VERSION) d'une partie, objet ou chaîne JSON ; 0 si illisible.
export function saveFormat(data) {
  try {
    const v = Number((typeof data === 'string' ? JSON.parse(data) : data)?.version);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function summarizeSave(parsed) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    level: num(parsed.level),
    maxStage: num(parsed.maxStage),
    gold: num(parsed.gold),
    gems: num(parsed.gems),
    kills: Math.max(num(parsed.kills), num(parsed.records?.kills)), // total cumulé (survit aux renaissances)
    bossesDefeated: num(parsed.records?.bossesDefeated),
    playSeconds: num(parsed.playSeconds),
    rebirths: num(parsed.records?.rebirths),
    towerBest: num(parsed.towerBest),
    goldEarned: num(parsed.records?.goldEarned),
    bestRebirth: num(parsed.times?.bestRebirth),
    bestTranscend: num(parsed.times?.bestTranscend),
    firstZone: JSON.stringify(Object.fromEntries(Object.entries(parsed.times?.firstZone ?? {})
      .filter(([k, v]) => /^\d{1,2}$/.test(k) && Number.isFinite(v) && v >= 0).slice(0, 20))),
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
  gameWeb = false,
  trustProxy = false,
  now = () => Date.now(),
  log = () => {},
}) {
  const authLimit = createRateLimiter(LIMITS.authAttempts, now);
  const failures = createFailureLimiter(LIMITS.authAttempts, now);
  const preregLimit = createRateLimiter(LIMITS.preregAttempts, now);
  const guestLimit = createRateLimiter(LIMITS.guestAttempts, now);
  // Sessions admin (en mémoire : perdues au redémarrage) : hash du jeton -> { username, mustChange, expires }.
  const adminSessions = new Map();

  // Premier démarrage : le mot de passe admin historique devient le compte « erwann ».
  if (adminPasswordHash && db.prepare('SELECT COUNT(*) AS n FROM admin_users').get().n === 0) {
    db.prepare('INSERT INTO admin_users (username, password_hash, must_change, created_at) VALUES (?, ?, 0, ?)')
      .run('erwann', adminPasswordHash, now());
  }

  const q = {
    findAdmin: db.prepare('SELECT id, username, password_hash, must_change FROM admin_users WHERE username = ?'),
    touchAdmin: db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?'),
    insertAdmin: db.prepare('INSERT INTO admin_users (username, password_hash, must_change, created_at) VALUES (?, ?, ?, ?)'),
    setAdminPassword: db.prepare('UPDATE admin_users SET password_hash = ?, must_change = ? WHERE id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)'),
    findSession: db.prepare(
      'SELECT a.id AS id, a.pseudo AS pseudo, a.guest AS guest, a.listed AS listed FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?',
    ),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    extendSession: db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?'),
    findAccount: db.prepare('SELECT id, pseudo, password_hash, guest FROM accounts WHERE pseudo = ?'),
    findAccountById: db.prepare('SELECT id, pseudo, password_hash, guest FROM accounts WHERE id = ?'),
    insertGuest: db.prepare("INSERT INTO accounts (pseudo, password_hash, created_at, last_seen_at, guest, platform, game_version) VALUES (?, '', ?, ?, 1, ?, ?)"),
    claimAccount: db.prepare('UPDATE accounts SET pseudo = ?, password_hash = ?, guest = 0, claimed_at = ? WHERE id = ? AND guest = 1'),
    renameAccount: db.prepare('UPDATE accounts SET pseudo = ? WHERE id = ?'),
    setClient: db.prepare('UPDATE accounts SET platform = COALESCE(?, platform), game_version = COALESCE(?, game_version) WHERE id = ?'),
    ping: db.prepare(`INSERT INTO activity (account_id, day, pings) VALUES (?, ?, 1)
      ON CONFLICT(account_id, day) DO UPDATE SET pings = activity.pings + 1`),
    insertAccount: db.prepare('INSERT INTO accounts (pseudo, password_hash, created_at, last_seen_at, claimed_at) VALUES (?, ?, ?, ?, ?)'),
    touchAccount: db.prepare('UPDATE accounts SET last_seen_at = ? WHERE id = ?'),
    deleteAccount: db.prepare('DELETE FROM accounts WHERE id = ?'),
    findSave: db.prepare('SELECT data, version, updated_at, level, play_seconds FROM saves WHERE account_id = ?'),
    upsertSave: db.prepare(`INSERT INTO saves (account_id, data, version, updated_at, level, max_stage, gold, gems, kills, bosses_defeated, play_seconds, rebirths, tower_best, gold_earned, best_rebirth, best_transcend, first_zone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at,
        level = MAX(saves.level, excluded.level), max_stage = MAX(saves.max_stage, excluded.max_stage), gold = excluded.gold, gems = excluded.gems,
        kills = excluded.kills, bosses_defeated = excluded.bosses_defeated, play_seconds = excluded.play_seconds,
        rebirths = excluded.rebirths, tower_best = MAX(saves.tower_best, excluded.tower_best), gold_earned = excluded.gold_earned,
        best_rebirth = excluded.best_rebirth, best_transcend = excluded.best_transcend, first_zone = excluded.first_zone`),
    upsertPrereg: db.prepare('INSERT INTO preregistrations (email, consent_version, consent_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING'),
    deletePrereg: db.prepare('DELETE FROM preregistrations WHERE email = ?'),
    countPrereg: db.prepare('SELECT COUNT(*) AS n FROM preregistrations'),
    // v9.1.3 (doc4 lot 7) : meilleur score par perso (on ne garde que le plus haut).
    upsertScore: db.prepare(`INSERT INTO world_scores (account_id, unit, damage, stars, level, at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, unit) DO UPDATE SET damage = excluded.damage, stars = excluded.stars, level = excluded.level, at = excluded.at
      WHERE excluded.damage > world_scores.damage`),
  };

  // Plateforme et version annoncées par le jeu (en-têtes), filtrées : jamais de texte libre en base.
  function clientInfo(req, body = {}) {
    const platform = String(req.headers['x-platform'] ?? body.platform ?? '').toLowerCase();
    const version = String(req.headers['x-game-version'] ?? body.gameVersion ?? '');
    return { platform: PLATFORMS.has(platform) ? platform : null, version: VERSION_RE.test(version) ? version : null };
  }

  function authenticate(req) {
    const token = bearer(req);
    if (!token) throw new HttpError(401, 'Connexion requise');
    const row = q.findSession.get(hashToken(token), now());
    if (!row) throw new HttpError(401, 'Session expirée');
    q.touchAccount.run(now(), row.id);
    // Session glissante (v9.1.1) : un compte invité n'a pas de mot de passe, sa session ne doit pas expirer
    // tant que le joueur revient au moins une fois tous les 30 jours.
    q.extendSession.run(now() + LIMITS.sessionMs, hashToken(token));
    const info = clientInfo(req);
    if (info.platform || info.version) q.setClient.run(info.platform, info.version, row.id);
    return row;
  }

  // Nom libre « joueur » + 6 chiffres (quelques essais en cas de collision).
  function freeGuestName() {
    for (let i = 0; i < 20; i += 1) {
      const name = `joueur${String(randomBytes(4).readUInt32BE(0) % 1e6).padStart(6, '0')}`;
      if (!q.findAccount.get(name)) return name;
    }
    throw new HttpError(503, 'Réessayez dans un instant');
  }

  const accountBody = (a) => ({ pseudo: a.pseudo, guest: a.guest === 1, listed: a.listed !== 0 });

  function issueSession(accountId) {
    const token = randomBytes(32).toString('base64url');
    q.insertSession.run(hashToken(token), accountId, now() + LIMITS.sessionMs);
    return token;
  }

  function issueAdminToken(admin) {
    const token = randomBytes(32).toString('base64url');
    adminSessions.set(hashToken(token), { username: admin.username, mustChange: admin.must_change === 1, expires: now() + LIMITS.adminSessionMs });
    return token;
  }

  // Tant que le mot de passe est temporaire, seule la route de changement de mot de passe répond.
  function requireAdmin(req, { allowChange = false } = {}) {
    const token = bearer(req);
    const session = token ? adminSessions.get(hashToken(token)) : undefined;
    if (!session || session.expires < now()) throw new HttpError(401, 'Accès administrateur requis');
    if (session.mustChange && !allowChange) throw new HttpError(403, 'Changez votre mot de passe temporaire avant de continuer');
    return session;
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
    guest: r.guest === 1,
    platform: r.platform ?? null,
    gameVersion: r.game_version ?? null,
    claimedAt: r.claimed_at ?? null,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    hasSave: r.version !== null,
    saveUpdatedAt: r.updated_at ?? null,
    level: r.level ?? 0,
    maxStage: r.max_stage ?? 0,
    stageLabel: stageLabel(r.max_stage ?? 0),
    gold: r.gold ?? 0,
    gems: r.gems ?? 0,
    kills: r.kills ?? 0,
    bossesDefeated: r.bosses_defeated ?? 0,
  });

  const routes = [
    { method: 'POST', path: /^\/api\/register$/, handler: async ({ req }) => {
      rateLimit(authLimit, `register:${clientIp(req, trustProxy)}`);
      const { pseudo, password } = await readJson(req);
      const bad = pseudoError(pseudo) ?? passwordError(password);
      if (bad) throw new HttpError(400, bad);
      if (q.findAccount.get(pseudo)) throw new HttpError(409, 'Ce nom est déjà pris');
      const info = q.insertAccount.run(pseudo, await hashPassword(password), now(), now(), now());
      return { status: 201, body: { token: issueSession(Number(info.lastInsertRowid)), pseudo, guest: false } };
    } },

    // Compte invité automatique (v9.1.1) : créé au premier lancement, sans mot de passe (connexion impossible
    // ailleurs). La progression est sauvegardée sur le serveur dès le début ; le joueur le transforme ensuite
    // en compte joueur (nom + mot de passe) pour la retrouver sur un autre appareil ou changer de nom.
    { method: 'POST', path: /^\/api\/guest$/, handler: async ({ req }) => {
      rateLimit(guestLimit, `guest:${clientIp(req, trustProxy)}`);
      const body = await readJson(req);
      const info = clientInfo(req, body);
      const pseudo = freeGuestName();
      const row = q.insertGuest.run(pseudo, now(), now(), info.platform, info.version);
      const id = Number(row.lastInsertRowid);
      q.ping.run(id, dayOf(now()));
      return { status: 201, body: { token: issueSession(id), pseudo, guest: true } };
    } },

    { method: 'GET', path: /^\/api\/account$/, handler: ({ req }) => ({ body: accountBody(authenticate(req)) }) },

    // Compte invité -> compte joueur : choisit son nom d'utilisateur et un mot de passe. La progression suit.
    { method: 'POST', path: /^\/api\/account\/claim$/, handler: async ({ req }) => {
      rateLimit(authLimit, `claim:${clientIp(req, trustProxy)}`);
      const account = authenticate(req);
      if (account.guest !== 1) throw new HttpError(409, 'Ce compte a déjà un nom et un mot de passe');
      const { pseudo, password } = await readJson(req);
      const bad = pseudoError(pseudo) ?? passwordError(password);
      if (bad) throw new HttpError(400, bad);
      const taken = q.findAccount.get(pseudo);
      if (taken && taken.id !== account.id) throw new HttpError(409, 'Ce nom est déjà pris');
      q.claimAccount.run(pseudo, await hashPassword(password), now(), account.id);
      return { body: { pseudo, guest: false } };
    } },

    // Changer de nom (compte joueur seulement) : mot de passe demandé.
    { method: 'PUT', path: /^\/api\/account\/pseudo$/, handler: async ({ req }) => {
      rateLimit(authLimit, `rename:${clientIp(req, trustProxy)}`);
      const account = authenticate(req);
      if (account.guest === 1) throw new HttpError(403, "Créez d'abord votre compte joueur (nom d'utilisateur et mot de passe)");
      const { pseudo, password } = await readJson(req);
      const bad = pseudoError(pseudo);
      if (bad) throw new HttpError(400, bad);
      const full = q.findAccountById.get(account.id);
      if (typeof password !== 'string' || !(await verifyPassword(password, full.password_hash))) {
        throw new HttpError(401, 'Mot de passe incorrect');
      }
      const taken = q.findAccount.get(pseudo);
      if (taken && taken.id !== account.id) throw new HttpError(409, 'Ce nom est déjà pris');
      q.renameAccount.run(pseudo, account.id);
      return { body: { pseudo, guest: false } };
    } },

    { method: 'POST', path: /^\/api\/login$/, handler: async ({ req }) => {
      const key = `login:${clientIp(req, trustProxy)}`;
      if (failures.blocked(key)) throw new HttpError(429, 'Trop de tentatives, réessayez plus tard');
      const { pseudo, password } = await readJson(req);
      const account = typeof pseudo === 'string' ? q.findAccount.get(pseudo) : undefined;
      const ok = typeof password === 'string' && account ? await verifyPassword(password, account.password_hash) : false;
      if (!ok) {
        failures.fail(key);
        throw new HttpError(401, "Nom d'utilisateur ou mot de passe incorrect");
      }
      failures.clear(key);
      q.touchAccount.run(now(), account.id);
      return { body: { token: issueSession(account.id), pseudo: account.pseudo, guest: false } };
    } },

    { method: 'POST', path: /^\/api\/logout$/, handler: ({ req }) => {
      const token = bearer(req);
      if (token) q.deleteSession.run(hashToken(token));
      return { status: 204 };
    } },

    { method: 'GET', path: /^\/api\/save$/, handler: ({ req }) => {
      const account = authenticate(req);
      q.ping.run(account.id, dayOf(now()));
      const row = q.findSave.get(account.id);
      if (!row) return { body: { data: null, version: 0 } };
      return { body: { data: row.data, version: row.version, updatedAt: row.updated_at } };
    } },

    // Corps : { version, data } ; data = chaîne JSON de la partie. 409 si la version serveur a changé.
    { method: 'PUT', path: /^\/api\/save$/, handler: async ({ req }) => {
      const account = authenticate(req);
      const body = await readJson(req, LIMITS.saveBody);
      const info = clientInfo(req, body);
      if (info.platform || info.version) q.setClient.run(info.platform, info.version, account.id);
      const { version, data } = body;
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
      q.upsertSave.run(account.id, data, next, now(), s.level, s.maxStage, s.gold, s.gems, s.kills, s.bossesDefeated, s.playSeconds, s.rebirths, s.towerBest, s.goldEarned, s.bestRebirth, s.bestTranscend, s.firstZone);
      for (const sc of extractScores(parsed, now())) q.upsertScore.run(account.id, sc.unit, sc.damage, sc.stars, sc.level, sc.at);
      return { body: { version: next } };
    } },

    // Suppression du compte et de toutes ses données (RGPD). Mot de passe requis.
    { method: 'DELETE', path: /^\/api\/account$/, handler: async ({ req }) => {
      const account = authenticate(req);
      const { password } = await readJson(req);
      const full = q.findAccountById.get(account.id);
      if (full?.guest !== 1 && (typeof password !== 'string' || !full || !(await verifyPassword(password, full.password_hash)))) {
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

    // v9.1.3 (doc4 lot 7) : score en ligne d'un perso (mode monde, 60 s) : dégâts, étoiles, niveau ; joueurs listés.
    { method: 'GET', path: /^\/api\/scores$/, handler: ({ url }) => {
      const unit = url.searchParams.get('unit') ?? '';
      if (!SCORE_RULES.unitRe.test(unit)) throw new HttpError(400, 'Perso inconnu');
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
      const rows = db.prepare(`SELECT a.pseudo, w.damage, w.stars, w.level, w.at FROM world_scores w JOIN accounts a ON a.id = w.account_id
        WHERE a.listed = 1 AND w.unit = ? ORDER BY w.damage DESC, w.at ASC LIMIT ?`).all(unit, limit);
      return { body: { unit, players: rows.map((r, i) => ({ rank: i + 1, pseudo: r.pseudo, damage: r.damage, stars: r.stars, level: r.level, at: r.at })) } };
    } },

    // Classement (v9.1.6) : tous les joueurs (comptes créés, listed = 1) ou soi et ses amis (scope=friends, connecté).
    // Connecté : `me` donne aussi votre propre rang, même hors des 100 premiers.
    { method: 'GET', path: /^\/api\/leaderboard$/, handler: ({ req, url }) => {
      const sort = LEADERBOARD_SORTS[url.searchParams.get('sort')] ? url.searchParams.get('sort') : 'stage';
      const scope = url.searchParams.get('scope') === 'friends' ? 'friends' : 'all';
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 100);
      let viewer = null;
      try {
        if (req.headers.authorization || scope === 'friends') viewer = authenticate(req);
      } catch (err) {
        if (scope === 'friends') throw err; // classement public : une session expirée n'empêche pas de le voir
      }
      const where = scope === 'friends'
        ? `(a.id = :me OR a.id IN (SELECT addressee_id FROM friendships WHERE requester_id = :me AND status = 'accepted'
            UNION SELECT requester_id FROM friendships WHERE addressee_id = :me AND status = 'accepted'))`
        : 'a.listed = 1 AND a.guest = 0 AND (s.level > 1 OR s.max_stage > 1 OR s.bosses_defeated > 0)';
      // Temps pour atteindre le monde n (2..12, v9.2.0 : monde marin) : index n - 1 dans first_zone. Nombre validé, jamais de texte libre.
      const world = Math.min(12, Math.max(2, Math.floor(Number(url.searchParams.get('world')) || 2)));
      const reachSql = `json_extract(s.first_zone, '$."${world - 1}"')`;
      const filter = LEADERBOARD_FILTER[sort] ? ` AND ${LEADERBOARD_FILTER[sort].replaceAll('reach', reachSql)}` : '';
      const base = `FROM saves s JOIN accounts a ON a.id = s.account_id WHERE (${where})${filter} ORDER BY ${LEADERBOARD_SORTS[sort].replace('reach', reachSql)}`;
      const params = scope === 'friends' ? { me: viewer.id } : {};
      const rows = db.prepare(`SELECT a.id AS aid, a.pseudo, s.*, ${reachSql} AS reach ${base} LIMIT :limit`).all({ ...params, limit });
      const row = (r, rank) => ({
        rank, pseudo: r.pseudo, level: r.level, maxStage: r.max_stage, stageLabel: stageLabel(r.max_stage), bossesDefeated: r.bosses_defeated,
        value: r[LEADERBOARD_VALUE[sort]], me: viewer ? r.aid === viewer.id : false, updatedAt: r.updated_at,
      });
      let me = null;
      if (viewer && scope === 'all' && !viewer.guest && !rows.some((r) => r.aid === viewer.id)) {
        const ids = db.prepare(`SELECT a.id AS aid ${base}`).all();
        const i = ids.findIndex((r) => r.aid === viewer.id);
        if (i >= 0) me = row(db.prepare(`SELECT a.id AS aid, a.pseudo, s.*, ${reachSql} AS reach FROM saves s JOIN accounts a ON a.id = s.account_id WHERE a.id = ?`).get(viewer.id), i + 1);
      }
      return { body: { sort, scope, world: sort === 'reach' ? world : undefined, players: rows.map((r, i) => row(r, i + 1)), me } };
    } },

    // ---- Amis (v9.1.6) ---- Réservé aux comptes créés (pas aux invités joueurXXXXXX).
    { method: 'GET', path: /^\/api\/friends$/, handler: ({ req }) => {
      const me = authenticate(req);
      const friends = db.prepare(`SELECT a.pseudo, s.level, s.max_stage FROM friendships f
        JOIN accounts a ON a.id = CASE WHEN f.requester_id = :me THEN f.addressee_id ELSE f.requester_id END
        LEFT JOIN saves s ON s.account_id = a.id
        WHERE f.status = 'accepted' AND (f.requester_id = :me OR f.addressee_id = :me) ORDER BY a.pseudo`).all({ me: me.id });
      const incoming = db.prepare("SELECT a.pseudo FROM friendships f JOIN accounts a ON a.id = f.requester_id WHERE f.addressee_id = ? AND f.status = 'pending' ORDER BY f.created_at").all(me.id);
      const outgoing = db.prepare("SELECT a.pseudo FROM friendships f JOIN accounts a ON a.id = f.addressee_id WHERE f.requester_id = ? AND f.status = 'pending' ORDER BY f.created_at").all(me.id);
      return { body: {
        friends: friends.map((f) => ({ pseudo: f.pseudo, level: f.level ?? 0, stageLabel: stageLabel(f.max_stage || 1) })),
        incoming: incoming.map((r) => r.pseudo), outgoing: outgoing.map((r) => r.pseudo),
      } };
    } },
    // Demande d'ami par nom ; si l'autre vous avait déjà demandé, vous devenez amis directement.
    { method: 'POST', path: /^\/api\/friends$/, handler: async ({ req }) => {
      const me = authenticate(req);
      if (me.guest) throw new HttpError(403, 'Créez votre compte pour ajouter des amis');
      const { pseudo } = await readJson(req);
      const other = typeof pseudo === 'string' ? q.findAccount.get(pseudo.trim()) : null;
      if (!other || other.guest) throw new HttpError(404, 'Joueur introuvable');
      if (other.id === me.id) throw new HttpError(400, 'Vous ne pouvez pas vous ajouter vous-même');
      const link = db.prepare('SELECT requester_id, status FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)')
        .get(me.id, other.id, other.id, me.id);
      if (link?.status === 'accepted') return { body: { status: 'friends', pseudo: other.pseudo } };
      if (link && link.requester_id === me.id) return { body: { status: 'sent', pseudo: other.pseudo } };
      if (link) {
        db.prepare("UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ?").run(other.id, me.id);
        return { body: { status: 'friends', pseudo: other.pseudo } };
      }
      const count = db.prepare('SELECT COUNT(*) AS n FROM friendships WHERE requester_id = ? OR addressee_id = ?').get(me.id, me.id).n;
      if (count >= MAX_FRIENDS) throw new HttpError(409, `Limite de ${MAX_FRIENDS} amis et demandes atteinte`);
      db.prepare("INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (?, ?, 'pending', ?)").run(me.id, other.id, now());
      return { status: 201, body: { status: 'sent', pseudo: other.pseudo } };
    } },
    { method: 'POST', path: /^\/api\/friends\/accept$/, handler: async ({ req }) => {
      const me = authenticate(req);
      const { pseudo } = await readJson(req);
      const other = typeof pseudo === 'string' ? q.findAccount.get(pseudo.trim()) : null;
      const info = other
        ? db.prepare("UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'").run(other.id, me.id)
        : { changes: 0 };
      if (!info.changes) throw new HttpError(404, 'Demande introuvable');
      return { body: { status: 'friends', pseudo: other.pseudo } };
    } },
    // Retirer un ami, refuser une demande reçue ou annuler une demande envoyée.
    { method: 'DELETE', path: /^\/api\/friends\/([^/]+)$/, handler: ({ req, params }) => {
      const me = authenticate(req);
      const other = q.findAccount.get(decodeURIComponent(params[0]));
      if (other) {
        db.prepare('DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)')
          .run(me.id, other.id, other.id, me.id);
      }
      return { status: 204 };
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
    // Connexion d'un membre de l'équipe : pseudo + mot de passe. mustChange = mot de passe temporaire.
    { method: 'POST', path: /^\/api\/admin\/login$/, handler: async ({ req }) => {
      const key = `admin:${clientIp(req, trustProxy)}`;
      if (failures.blocked(key)) throw new HttpError(429, 'Trop de tentatives, réessayez plus tard');
      const { username, password } = await readJson(req);
      const admin = typeof username === 'string' ? q.findAdmin.get(username) : undefined;
      if (typeof password !== 'string' || !admin || !(await verifyPassword(password, admin.password_hash))) {
        failures.fail(key);
        throw new HttpError(401, 'Identifiant ou mot de passe incorrect');
      }
      failures.clear(key);
      q.touchAdmin.run(now(), admin.id);
      const token = issueAdminToken(admin);
      return { body: { token, username: admin.username, mustChange: admin.must_change === 1 } };
    } },

    // Changement du mot de passe (obligatoire au premier login). Autorisé même si mustChange.
    { method: 'POST', path: /^\/api\/admin\/password$/, handler: async ({ req }) => {
      const session = requireAdmin(req, { allowChange: true });
      const { password, newPassword } = await readJson(req);
      const admin = q.findAdmin.get(session.username);
      // 403 et non 401 : le 401 signifie « session expirée » pour l'interface.
      if (typeof password !== 'string' || !admin || !(await verifyPassword(password, admin.password_hash))) {
        throw new HttpError(403, 'Mot de passe actuel incorrect');
      }
      if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 200) {
        throw new HttpError(400, 'Nouveau mot de passe : 12 caractères minimum');
      }
      if (newPassword === password) throw new HttpError(400, 'Le nouveau mot de passe doit être différent');
      q.setAdminPassword.run(await hashPassword(newPassword), 0, admin.id);
      session.mustChange = false;
      return { status: 204 };
    } },

    // Équipe : liste, création et réinitialisation avec mot de passe temporaire (affiché une seule fois).
    { method: 'GET', path: /^\/api\/admin\/users$/, handler: ({ req }) => {
      requireAdmin(req);
      const rows = db.prepare('SELECT id, username, must_change, created_at, last_login_at FROM admin_users ORDER BY username').all();
      return { body: { users: rows.map((r) => ({ id: r.id, username: r.username, mustChange: r.must_change === 1, createdAt: r.created_at, lastLoginAt: r.last_login_at })) } };
    } },

    { method: 'POST', path: /^\/api\/admin\/users$/, handler: async ({ req }) => {
      requireAdmin(req);
      const { username } = await readJson(req);
      if (typeof username !== 'string' || !ADMIN_NAME_RE.test(username)) throw new HttpError(400, 'Nom : 2 à 20 lettres ou chiffres');
      if (q.findAdmin.get(username)) throw new HttpError(409, 'Ce nom existe déjà');
      const temp = temporaryPassword();
      q.insertAdmin.run(username, await hashPassword(temp), 1, now());
      return { status: 201, body: { username, temporaryPassword: temp } };
    } },

    { method: 'POST', path: /^\/api\/admin\/users\/(\d+)\/reset$/, handler: async ({ req, params }) => {
      requireAdmin(req);
      const admin = db.prepare('SELECT id, username FROM admin_users WHERE id = ?').get(Number(params[0]));
      if (!admin) throw new HttpError(404, 'Membre introuvable');
      const temp = temporaryPassword();
      q.setAdminPassword.run(await hashPassword(temp), 1, admin.id);
      for (const [hash, s] of adminSessions) if (s.username === admin.username) adminSessions.delete(hash);
      return { body: { username: admin.username, temporaryPassword: temp } };
    } },

    { method: 'DELETE', path: /^\/api\/admin\/users\/(\d+)$/, handler: ({ req, params }) => {
      const session = requireAdmin(req);
      const admin = db.prepare('SELECT id, username FROM admin_users WHERE id = ?').get(Number(params[0]));
      if (!admin) throw new HttpError(404, 'Membre introuvable');
      if (admin.username === session.username) throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte');
      db.prepare('DELETE FROM admin_users WHERE id = ?').run(admin.id);
      for (const [hash, s] of adminSessions) if (s.username === admin.username) adminSessions.delete(hash);
      return { status: 204 };
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

    // Analytique (v9.1.1) : activité par jour, rétention, plateformes, versions, répartition de la progression.
    { method: 'GET', path: /^\/api\/admin\/analytics$/, handler: ({ req, url }) => {
      requireAdmin(req);
      const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 7), 90);
      const DAY = 24 * 3600 * 1000;
      const t = now();
      const from = dayOf(t - (days - 1) * DAY);
      const fromMs = Date.parse(`${from}T00:00:00Z`);
      const series = [];
      for (let i = 0; i < days; i += 1) series.push({ day: dayOf(fromMs + i * DAY), active: 0, minutes: 0, newAccounts: 0, newPlayers: 0 });
      const byDay = new Map(series.map((d) => [d.day, d]));
      for (const r of db.prepare('SELECT day, COUNT(*) AS n, SUM(pings) AS m FROM activity WHERE day >= ? GROUP BY day').all(from)) {
        const d = byDay.get(r.day);
        if (d) { d.active = r.n; d.minutes = r.m; }
      }
      for (const r of db.prepare('SELECT created_at FROM accounts WHERE created_at >= ?').all(fromMs)) {
        const d = byDay.get(dayOf(r.created_at));
        if (d) d.newAccounts += 1;
      }
      for (const r of db.prepare('SELECT claimed_at FROM accounts WHERE claimed_at >= ?').all(fromMs)) {
        const d = byDay.get(dayOf(r.claimed_at));
        if (d) d.newPlayers += 1;
      }
      // Rétention J1 / J7 / J30 : part des comptes revenus ce jour-là, parmi ceux assez anciens.
      const retention = {};
      for (const n of [1, 7, 30]) {
        const row = db.prepare(`SELECT COUNT(*) AS cohort, SUM(CASE WHEN EXISTS (
            SELECT 1 FROM activity v WHERE v.account_id = a.id AND v.day = strftime('%Y-%m-%d', a.created_at / 1000 + ?, 'unixepoch')
          ) THEN 1 ELSE 0 END) AS back FROM accounts a WHERE a.created_at <= ?`).get(n * 86400, t - n * DAY);
        retention[`d${n}`] = { cohort: row.cohort, back: row.back ?? 0, rate: row.cohort ? (row.back ?? 0) / row.cohort : 0 };
      }
      const group = (sql) => db.prepare(sql).all().map((r) => ({ key: r.k ?? 'inconnu', count: r.n }));
      const platforms = group('SELECT platform AS k, COUNT(*) AS n FROM accounts GROUP BY platform ORDER BY n DESC');
      const versions = group('SELECT game_version AS k, COUNT(*) AS n FROM accounts GROUP BY game_version ORDER BY n DESC LIMIT 12');
      const accountsKind = db.prepare('SELECT SUM(guest) AS guests, COUNT(*) - SUM(guest) AS registered FROM accounts').get();
      const STAGE_BUCKETS = [[1, 9], [10, 24], [25, 49], [50, 99], [100, 199], [200, 499], [500, 1e9]];
      const stageDist = STAGE_BUCKETS.map(([a, b]) => ({
        key: b >= 1e9 ? `${a}+` : `${a}–${b}`,
        count: db.prepare('SELECT COUNT(*) AS n FROM saves WHERE max_stage BETWEEN ? AND ?').get(a, b).n,
      }));
      const LEVEL_BUCKETS = [[1, 9], [10, 49], [50, 99], [100, 249], [250, 499], [500, 1000]];
      const levelDist = LEVEL_BUCKETS.map(([a, b]) => ({
        key: `${a}–${b}`, count: db.prepare('SELECT COUNT(*) AS n FROM saves WHERE level BETWEEN ? AND ?').get(a, b).n,
      }));
      const play = db.prepare(`SELECT COUNT(*) AS players, COALESCE(AVG(m), 0) AS avgMinutes, COALESCE(AVG(d), 0) AS avgDays FROM
        (SELECT account_id, SUM(pings) AS m, COUNT(*) AS d FROM activity GROUP BY account_id)`).get();
      const today = byDay.get(dayOf(t));
      return {
        body: {
          now: t, days, series, retention, platforms, versions, stageDist, levelDist,
          guests: accountsKind.guests ?? 0, registered: accountsKind.registered ?? 0,
          dau: today?.active ?? 0,
          wau: db.prepare('SELECT COUNT(DISTINCT account_id) AS n FROM activity WHERE day >= ?').get(dayOf(t - 6 * DAY)).n,
          mau: db.prepare('SELECT COUNT(DISTINCT account_id) AS n FROM activity WHERE day >= ?').get(dayOf(t - 29 * DAY)).n,
          avgMinutesPerPlayer: play.avgMinutes, avgDaysPerPlayer: play.avgDays,
        },
      };
    } },

    { method: 'GET', path: /^\/api\/admin\/players$/, handler: ({ req, url }) => {
      requireAdmin(req);
      const sort = SORTS[url.searchParams.get('sort')] ? url.searchParams.get('sort') : 'recent';
      const search = (url.searchParams.get('q') ?? '').slice(0, 20).replace(/[%_]/g, '');
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
      const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
      const kind = url.searchParams.get('kind');
      const conds = [];
      const args = [];
      if (search) { conds.push('a.pseudo LIKE ?'); args.push(`%${search}%`); }
      if (kind === 'guest') conds.push('a.guest = 1');
      if (kind === 'registered') conds.push('a.guest = 0');
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = db.prepare(`SELECT a.id, a.pseudo, a.guest, a.platform, a.game_version, a.claimed_at, a.created_at, a.last_seen_at, s.version, s.updated_at,
          s.level, s.max_stage, s.gold, s.gems, s.kills, s.bosses_defeated
        FROM accounts a LEFT JOIN saves s ON s.account_id = a.id ${where}
        ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`).all(...args, limit, offset);
      const total = db.prepare(`SELECT COUNT(*) AS n FROM accounts a ${where}`).get(...args).n;
      return { body: { total, players: rows.map(playerRow) } };
    } },

    { method: 'GET', path: /^\/api\/admin\/players\/(\d+)$/, handler: ({ req, params }) => {
      requireAdmin(req);
      const r = db.prepare(`SELECT a.id, a.pseudo, a.guest, a.platform, a.game_version, a.claimed_at, a.created_at, a.last_seen_at, s.version, s.updated_at,
          s.level, s.max_stage, s.gold, s.gems, s.kills, s.bosses_defeated
        FROM accounts a LEFT JOIN saves s ON s.account_id = a.id WHERE a.id = ?`).get(Number(params[0]));
      if (!r) throw new HttpError(404, 'Joueur introuvable');
      const player = playerRow(r);
      // Activité des 30 derniers jours (jours joués, minutes ≈ pings) et au total.
      const since = dayOf(now() - 29 * 24 * 3600 * 1000);
      const act = db.prepare('SELECT day, pings FROM activity WHERE account_id = ? AND day >= ? ORDER BY day').all(r.id, since);
      const total = db.prepare('SELECT COUNT(*) AS days, COALESCE(SUM(pings), 0) AS pings FROM activity WHERE account_id = ?').get(r.id);
      player.activity = { days30: act.map((a) => ({ day: a.day, minutes: a.pings })), daysPlayed: total.days, minutesPlayed: total.pings };
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
    // Le jeu se joue sur PC (exe) et téléphone (APK) uniquement : /play/ n'est servi qu'en local (GAME_WEB=1, tests).
    if (isGame && !gameWeb) return send(res, 404, { error: 'Introuvable' });
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
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Game-Version, X-Platform');
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
