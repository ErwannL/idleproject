// v9.3.2 : guildes et World Boss côté serveur.
// Deux World Boss DISTINCTS (jamais fusionnés) :
//   - 'event'  : World Boss des grands événements (3 phases, Éveil, paliers ; combat local rejouable par graine).
//                Classement de l'événement = dégâts (meilleure tentative du jour, cumulée sur l'événement) + points
//                de conditions (paliers de barre atteints : 25/50/75/100 %).
//   - 'global' : World Boss global partagé : une barre de PV commune à tous les joueurs ; chaque tentative ajoute ses
//                dégâts ; la barre se remplit à nouveau (nouveau cycle) quand elle tombe à zéro.
// Guildes : création (nom, emblème, description, accès libre ou sur demande), rôles chef/officier/membre, limite de
// membres, journal, objectif hebdomadaire commun, classement World Boss des guildes = MOYENNE des N meilleurs membres
// (équité entre petites et grandes guildes). Anti-abus : verrou de 24 h après un changement de guilde pendant lequel
// les contributions ne comptent pas pour la nouvelle guilde ; un score par joueur et par jour (le meilleur) ; score
// borné par la puissance déclarée et par un plafond absolu ; récompenses de guilde réservées aux contributeurs.
import { createHash } from 'node:crypto';

export const GUILD_RULES = {
  maxMembers: 30,
  topN: 10,                 // moyenne des 10 meilleurs membres
  switchLockMs: 24 * 3600 * 1000,
  nameRe: /^[\p{L}\p{N} '_-]{3,24}$/u,
  emblems: ['weapon_sword', 'icon_shield', 'icon_crown', 'icon_star', 'icon_skull', 'icon_heart', 'icon_paw', 'icon_tower', 'icon_gem', 'icon_boss'],
  weeklyGoal: 200,          // contributions de la semaine (1 tentative de World Boss = 1, plafonnée à 3/jour/joueur)
  perDayCap: 3,
  global: { hp: 5e12, name: 'Colosse des Anciens (mondial)' },
  maxDamagePerPower: 5000,  // dégâts max d'une tentative = puissance × 5000 (60 s de combat)
  absoluteMax: 1e15,
};

export const GUILD_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS guilds (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  emblem TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  open INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS guild_members (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS guild_members_guild ON guild_members (guild_id);
CREATE TABLE IF NOT EXISTS guild_requests (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, guild_id)
);
CREATE TABLE IF NOT EXISTS guild_log (
  id INTEGER PRIMARY KEY,
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  at INTEGER NOT NULL,
  text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wb_scores (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,           -- 'event' | 'global'
  period TEXT NOT NULL,         -- événement (id) ou semaine ISO
  day TEXT NOT NULL,
  damage REAL NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 1,
  guild_id INTEGER,             -- guilde créditée (null pendant le verrou de changement)
  at INTEGER NOT NULL,
  PRIMARY KEY (account_id, mode, period, day)
);
CREATE TABLE IF NOT EXISTS wb_global (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cycle INTEGER NOT NULL,
  damage REAL NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS guild_switches (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  at INTEGER NOT NULL
);
`;

export const weekKey = (t) => {
  const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return `${d.getUTCFullYear()}-W${String(1 + Math.round(((d - y) / 864e5 - 3 + ((y.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
};
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

export class GuildError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = (m) => new GuildError(400, m);

// Vérifie et borne un rapport de tentative (core/world-boss.js attemptReport + paliers atteints).
export function checkReport(r) {
  if (!r || typeof r !== 'object') throw bad('Rapport invalide');
  const mode = r.mode === 'global' ? 'global' : r.mode === 'event' ? 'event' : null;
  if (!mode) throw bad('Mode inconnu');
  const damage = Number(r.damage), power = Number(r.power);
  if (!Number.isFinite(damage) || damage < 0 || !Number.isFinite(power) || power <= 0) throw bad('Dégâts ou puissance invalides');
  if (damage > Math.min(GUILD_RULES.absoluteMax, power * GUILD_RULES.maxDamagePerPower)) throw new GuildError(422, 'Score incohérent avec la puissance de l\'équipe');
  const tiers = Number.isInteger(r.tiers) ? Math.max(0, Math.min(4, r.tiers)) : 0;
  const period = mode === 'event' ? String(r.event ?? '').slice(0, 40) : null;
  if (mode === 'event' && !/^[\w.-]{1,40}$/.test(period)) throw bad('Événement invalide');
  return { mode, damage: Math.floor(damage), points: tiers * 25, period };
}

export function createGuilds({ db, now = () => Date.now() }) {
  db.exec(GUILD_SCHEMA_SQL);
  if (!db.prepare('SELECT id FROM wb_global WHERE id = 1').get()) db.prepare('INSERT INTO wb_global (id, cycle, damage, updated_at) VALUES (1, 1, 0, ?)').run(now());
  const memberOf = (id) => db.prepare('SELECT m.guild_id, m.role, m.joined_at, g.name FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.account_id = ?').get(id);
  const log = (gid, text) => db.prepare('INSERT INTO guild_log (guild_id, at, text) VALUES (?, ?, ?)').run(gid, now(), text.slice(0, 200));
  const count = (gid) => db.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?').get(gid).n;
  const locked = (accountId) => { const s = db.prepare('SELECT at FROM guild_switches WHERE account_id = ?').get(accountId); return s && now() - s.at < GUILD_RULES.switchLockMs; };
  const join = (me, gid, role = 'member') => {
    if (count(gid) >= GUILD_RULES.maxMembers) throw new GuildError(409, `Guilde complète (${GUILD_RULES.maxMembers} membres)`);
    db.prepare('INSERT INTO guild_members (account_id, guild_id, role, joined_at) VALUES (?, ?, ?, ?)').run(me.id, gid, role, now());
    // Verrou de 24 h seulement pour un joueur qui a déjà eu des scores de World Boss (changement de guilde) :
    // un nouveau joueur ou un fondateur sans historique contribue tout de suite.
    const hasHistory = db.prepare('SELECT 1 FROM wb_scores WHERE account_id = ? LIMIT 1').get(me.id);
    if (hasHistory) db.prepare('INSERT INTO guild_switches (account_id, at) VALUES (?, ?) ON CONFLICT(account_id) DO UPDATE SET at = excluded.at').run(me.id, now());
    db.prepare('DELETE FROM guild_requests WHERE account_id = ?').run(me.id);
    log(gid, `${me.pseudo} rejoint la guilde`);
  };
  const requireRole = (me, roles) => {
    const m = memberOf(me.id);
    if (!m) throw new GuildError(404, 'Vous n\'êtes dans aucune guilde');
    if (!roles.includes(m.role)) throw new GuildError(403, 'Action réservée au chef ou aux officiers');
    return m;
  };
  const byPseudo = (pseudo) => db.prepare('SELECT id, pseudo FROM accounts WHERE pseudo = ? COLLATE NOCASE').get(String(pseudo ?? ''));

  function guildScore(gid, mode, period) {
    // Moyenne des N meilleurs membres (par total de la période) : une petite guilde active reste compétitive.
    const rows = db.prepare(`SELECT account_id, SUM(damage) AS d, SUM(points) AS p FROM wb_scores WHERE guild_id = ? AND mode = ? AND period = ?
      GROUP BY account_id ORDER BY d DESC LIMIT ?`).all(gid, mode, period, GUILD_RULES.topN);
    if (!rows.length) return { score: 0, contributors: 0 };
    const total = rows.reduce((a, r) => a + r.d + r.p * 1e6, 0);
    return { score: Math.floor(total / GUILD_RULES.topN), contributors: rows.length };
  }

  return {
    // ---- Rapport de tentative de World Boss ----
    report(me, raw) {
      const r = checkReport(raw);
      const t = now(), day = dayKey(t);
      const period = r.mode === 'event' ? r.period : weekKey(t);
      const m = memberOf(me.id);
      const gid = m && !locked(me.id) ? m.guild_id : null;
      const prev = db.prepare('SELECT damage, attempts FROM wb_scores WHERE account_id = ? AND mode = ? AND period = ? AND day = ?').get(me.id, r.mode, period, day);
      // Un score par joueur et par jour : le meilleur. Les tentatives sont comptées (objectif de guilde, plafonné).
      if (prev) {
        db.prepare(`UPDATE wb_scores SET damage = MAX(damage, ?), points = MAX(points, ?), attempts = attempts + 1, guild_id = COALESCE(guild_id, ?), at = ?
          WHERE account_id = ? AND mode = ? AND period = ? AND day = ?`).run(r.damage, r.points, gid, t, me.id, r.mode, period, day);
      } else {
        db.prepare('INSERT INTO wb_scores (account_id, mode, period, day, damage, points, attempts, guild_id, at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)')
          .run(me.id, r.mode, period, day, r.damage, r.points, gid, t);
      }
      let global = null;
      if (r.mode === 'global') {
        // Barre commune : chaque tentative ajoute ses dégâts (bornés) ; à zéro, un nouveau cycle commence.
        const g = db.prepare('SELECT cycle, damage FROM wb_global WHERE id = 1').get();
        let dmg = g.damage + r.damage, cycle = g.cycle;
        while (dmg >= GUILD_RULES.global.hp) { dmg -= GUILD_RULES.global.hp; cycle++; }
        db.prepare('UPDATE wb_global SET cycle = ?, damage = ?, updated_at = ? WHERE id = 1').run(cycle, dmg, t);
        global = { cycle, hp: GUILD_RULES.global.hp, left: GUILD_RULES.global.hp - dmg, defeated: cycle > g.cycle };
      }
      if (gid && m) log(gid, `${me.pseudo} : ${r.mode === 'global' ? 'World Boss mondial' : 'World Boss d\'événement'}, ${r.damage.toLocaleString('fr-FR')} dégâts`);
      return { counted: Boolean(gid), lockedUntil: m && !gid ? (db.prepare('SELECT at FROM guild_switches WHERE account_id = ?').get(me.id).at + GUILD_RULES.switchLockMs) : null, global };
    },
    globalBoss() {
      const g = db.prepare('SELECT cycle, damage FROM wb_global WHERE id = 1').get();
      return { name: GUILD_RULES.global.name, cycle: g.cycle, hp: GUILD_RULES.global.hp, left: GUILD_RULES.global.hp - g.damage };
    },
    // ---- Classements ----
    ranking(mode, period0, me) {
      const period = mode === 'global' ? (period0 || weekKey(now())) : String(period0 ?? '');
      const players = db.prepare(`SELECT a.pseudo, SUM(w.damage) AS damage, SUM(w.points) AS points FROM wb_scores w JOIN accounts a ON a.id = w.account_id
        WHERE w.mode = ? AND w.period = ? GROUP BY w.account_id ORDER BY (SUM(w.damage) + SUM(w.points) * 1e6) DESC LIMIT 50`).all(mode, period);
      const guilds = db.prepare('SELECT id, name, emblem FROM guilds').all()
        .map((g) => ({ name: g.name, emblem: g.emblem, members: count(g.id), ...guildScore(g.id, mode, period) }))
        .filter((g) => g.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);
      return { mode, period, rule: `moyenne des ${GUILD_RULES.topN} meilleurs membres`, players, guilds, me: me ? memberOf(me.id)?.name ?? null : null };
    },
    // ---- Guilde ----
    mine(me) {
      const m = memberOf(me.id);
      if (!m) return { guild: null, requests: [] };
      const g = db.prepare('SELECT * FROM guilds WHERE id = ?').get(m.guild_id);
      const week = weekKey(now());
      const members = db.prepare(`SELECT a.pseudo, m.role, m.joined_at, a.last_seen_at,
          (SELECT COALESCE(SUM(MIN(attempts, ${GUILD_RULES.perDayCap})), 0) FROM wb_scores w WHERE w.account_id = m.account_id AND w.guild_id = m.guild_id AND w.period = ? ) AS contrib,
          (SELECT COALESCE(SUM(damage), 0) FROM wb_scores w WHERE w.account_id = m.account_id AND w.guild_id = m.guild_id AND w.mode = 'global' AND w.period = ?) AS damage
        FROM guild_members m JOIN accounts a ON a.id = m.account_id WHERE m.guild_id = ? ORDER BY damage DESC`).all(week, week, m.guild_id);
      const progress = members.reduce((a, x) => a + x.contrib, 0);
      const requests = ['leader', 'officer'].includes(m.role)
        ? db.prepare('SELECT a.pseudo FROM guild_requests r JOIN accounts a ON a.id = r.account_id WHERE r.guild_id = ?').all(m.guild_id).map((x) => x.pseudo) : [];
      return {
        guild: { name: g.name, emblem: g.emblem, description: g.description, open: Boolean(g.open), maxMembers: GUILD_RULES.maxMembers },
        role: m.role, members: members.map((x) => ({ pseudo: x.pseudo, role: x.role, contrib: x.contrib, damage: x.damage, lastSeen: x.last_seen_at })),
        weekly: { goal: GUILD_RULES.weeklyGoal, progress, week, reached: progress >= GUILD_RULES.weeklyGoal },
        log: db.prepare('SELECT at, text FROM guild_log WHERE guild_id = ? ORDER BY id DESC LIMIT 20').all(m.guild_id),
        requests, lockedUntil: locked(me.id) ? db.prepare('SELECT at FROM guild_switches WHERE account_id = ?').get(me.id).at + GUILD_RULES.switchLockMs : null,
      };
    },
    search(text) {
      const like = `%${String(text ?? '').slice(0, 24).replace(/[%_]/g, '')}%`;
      return db.prepare('SELECT id, name, emblem, description, open FROM guilds WHERE name LIKE ? ORDER BY name LIMIT 30').all(like)
        .map((g) => ({ name: g.name, emblem: g.emblem, description: g.description, open: Boolean(g.open), members: count(g.id), maxMembers: GUILD_RULES.maxMembers }));
    },
    create(me, { name, emblem, description, open }) {
      if (me.guest) throw new GuildError(403, 'Créez votre compte pour fonder une guilde');
      if (memberOf(me.id)) throw new GuildError(409, 'Quittez d\'abord votre guilde');
      const n = String(name ?? '').trim();
      if (!GUILD_RULES.nameRe.test(n)) throw bad('Nom : 3 à 24 lettres, chiffres, espaces');
      if (!GUILD_RULES.emblems.includes(emblem)) throw bad('Emblème inconnu');
      if (db.prepare('SELECT id FROM guilds WHERE name = ? COLLATE NOCASE').get(n)) throw new GuildError(409, 'Ce nom est déjà pris');
      const id = db.prepare('INSERT INTO guilds (name, emblem, description, open, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(n, emblem, String(description ?? '').slice(0, 200), open === false ? 0 : 1, now()).lastInsertRowid;
      join(me, Number(id), 'leader');
      return this.mine(me);
    },
    apply(me, name) {
      if (me.guest) throw new GuildError(403, 'Créez votre compte pour rejoindre une guilde');
      if (memberOf(me.id)) throw new GuildError(409, 'Quittez d\'abord votre guilde');
      const g = db.prepare('SELECT * FROM guilds WHERE name = ? COLLATE NOCASE').get(String(name ?? ''));
      if (!g) throw new GuildError(404, 'Guilde introuvable');
      if (g.open) { join(me, g.id); return { status: 'joined', mine: this.mine(me) }; }
      db.prepare('INSERT OR IGNORE INTO guild_requests (account_id, guild_id, created_at) VALUES (?, ?, ?)').run(me.id, g.id, now());
      return { status: 'requested' };
    },
    accept(me, pseudo) {
      const m = requireRole(me, ['leader', 'officer']);
      const other = byPseudo(pseudo);
      if (!other || !db.prepare('SELECT 1 FROM guild_requests WHERE account_id = ? AND guild_id = ?').get(other.id, m.guild_id)) throw new GuildError(404, 'Demande introuvable');
      if (memberOf(other.id)) { db.prepare('DELETE FROM guild_requests WHERE account_id = ?').run(other.id); throw new GuildError(409, 'Ce joueur a déjà une guilde'); }
      join(other, m.guild_id);
      return this.mine(me);
    },
    leave(me) {
      const m = memberOf(me.id);
      if (!m) throw new GuildError(404, 'Vous n\'êtes dans aucune guilde');
      const others = db.prepare('SELECT account_id, role FROM guild_members WHERE guild_id = ? AND account_id != ? ORDER BY CASE role WHEN \'officer\' THEN 0 ELSE 1 END, joined_at').all(m.guild_id, me.id);
      db.prepare('DELETE FROM guild_members WHERE account_id = ?').run(me.id);
      db.prepare('INSERT INTO guild_switches (account_id, at) VALUES (?, ?) ON CONFLICT(account_id) DO UPDATE SET at = excluded.at').run(me.id, now());
      if (!others.length) { db.prepare('DELETE FROM guilds WHERE id = ?').run(m.guild_id); return { guild: null }; }
      if (m.role === 'leader') db.prepare('UPDATE guild_members SET role = \'leader\' WHERE account_id = ?').run(others[0].account_id); // la chefferie passe
      log(m.guild_id, `${me.pseudo} quitte la guilde`);
      return { guild: null };
    },
    kick(me, pseudo) {
      const m = requireRole(me, ['leader', 'officer']);
      const other = byPseudo(pseudo);
      const om = other && memberOf(other.id);
      if (!om || om.guild_id !== m.guild_id || other.id === me.id) throw new GuildError(404, 'Membre introuvable');
      if (om.role === 'leader' || (om.role === 'officer' && m.role !== 'leader')) throw new GuildError(403, 'Rôle insuffisant');
      db.prepare('DELETE FROM guild_members WHERE account_id = ?').run(other.id);
      log(m.guild_id, `${other.pseudo} est exclu par ${me.pseudo}`);
      return this.mine(me);
    },
    setRole(me, pseudo, role) {
      const m = requireRole(me, ['leader']);
      if (!['officer', 'member', 'leader'].includes(role)) throw bad('Rôle inconnu');
      const other = byPseudo(pseudo);
      const om = other && memberOf(other.id);
      if (!om || om.guild_id !== m.guild_id || other.id === me.id) throw new GuildError(404, 'Membre introuvable');
      db.prepare('UPDATE guild_members SET role = ? WHERE account_id = ?').run(role, other.id);
      if (role === 'leader') db.prepare('UPDATE guild_members SET role = \'officer\' WHERE account_id = ?').run(me.id); // passation
      log(m.guild_id, `${other.pseudo} devient ${{ leader: 'chef', officer: 'officier', member: 'membre' }[role]}`);
      return this.mine(me);
    },
    settings(me, { description, open, emblem }) {
      const m = requireRole(me, ['leader', 'officer']);
      if (emblem !== undefined && !GUILD_RULES.emblems.includes(emblem)) throw bad('Emblème inconnu');
      db.prepare('UPDATE guilds SET description = COALESCE(?, description), open = COALESCE(?, open), emblem = COALESCE(?, emblem) WHERE id = ?')
        .run(description === undefined ? null : String(description).slice(0, 200), open === undefined ? null : (open ? 1 : 0), emblem ?? null, m.guild_id);
      return this.mine(me);
    },
  };
}
export const hashName = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8);
