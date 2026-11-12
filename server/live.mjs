// v9.3.0 : LIVE-OPS piloté par le serveur. Configuration éditée depuis l'admin, lue par le jeu (GET /api/live) et
// par le site (goals des préinscriptions). Le contenu (code, textes, assets) est livré À L'AVANCE par les mises à
// jour ; la config ne fait qu'activer, dater et régler ce que le code connaît (src/data/live-catalog.js).
// Documentation : docs/live-ops.md.
import { createHash } from 'node:crypto';
import {
  LIVE_EVENT_TYPES, LIVE_FEATURED_UNITS, LIVE_FLAGS, LIVE_MIN_CLIENT, LIVE_OFFER_IDS, compareVersions, eventParams, isVersion,
} from '../src/data/live-catalog.js';
import { BANNERS, EVENTS } from '../src/data/economy.js'; // v9.3.0 : reprise du calendrier automatique de la 9.2.9

export const LIVE_SCHEMA = 1;
const DAY = 86400000;
// Durée pendant laquelle le jeu hors ligne peut encore démarrer un élément programmé (au-delà : seulement ce qui avait
// déjà commencé, jusqu'à sa date de fin connue).
export const LIVE_VALID_MS = 6 * 3600 * 1000;
export const LIVE_MAX_AGE_S = 30; // cache HTTP court
export const KINDS = ['event', 'banner', 'offer', 'announcement', 'flag'];
export const STATUSES = ['draft', 'scheduled', 'active', 'ended', 'disabled'];
const MAX_SPAN_MS = 90 * DAY;

export class LiveError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new LiveError(400, msg);

// Paliers revus (novembre 2026) : Les récompenses jusqu'à 50 000 sont les mêmes qu'en 9.3.1 (5 500 gemmes, 1,75 M or, 10 tickets,
// 1 ticket SSR, Slime doré, Lame rose, apparences Lilith et Grombar ; les apparences sont nommées comme telles, pas comme des héros) réparties sur 8 paliers, avec deux premiers paliers proches
// (1 000 et 2 500) pour lancer la dynamique. Deux paliers bonus après l'objectif (75 000, 100 000).
export const DEFAULT_GOALS = {
  target: 50000,
  display: { mode: 'real', value: 0 },
  texts: {
    headline: 'Objectif : 50 000 aventuriers pour débloquer toutes les récompenses',
    reached: 'Objectif atteint, merci à tous ! Place aux paliers bonus.',
  },
  tiers: [
    { at: 1000, label: '1K', name: '250 gemmes + 100 K or', detail: 'Le coup d\'envoi : monnaie premium et pièces d\'or', img: 'assets/icon_gem.png' },
    { at: 2500, label: '2,5K', name: '1 familier exclusif', detail: 'Slime doré', tag: 'Exclusif', excl: true, img: 'assets/hd_pet_golden_slime.webp' },
    { at: 5000, label: '5K', name: '250 gemmes + 5 tickets', detail: 'Tickets d\'invocation de héros', img: 'assets/shop/hero_ticket_permanent.webp' },
    { at: 10000, label: '10K', name: '1 compagnon exclusif', detail: 'Lame rose', tag: 'SR · Exclusif', excl: true, img: 'assets/hd_ally_rose_blade.webp' },
    { at: 15000, label: '15K', name: '1 000 gemmes + 150 K or', detail: 'Monnaie premium et pièces d\'or', img: 'assets/shop/crystal_medium.webp' },
    { at: 20000, label: '20K', name: '1 apparence légendaire', detail: 'Lilith la Diablesse · Reine des braises', tag: 'Légendaire · Exclusif', excl: true, img: 'assets/hd_demoness.png' },
    { at: 35000, label: '35K', name: '1 500 gemmes + 5 tickets', detail: '+ 500 K or · tickets d\'invocation', img: 'assets/shop/crystal_large.webp' },
    { at: 50000, label: '50K', name: '1 apparence légendaire + méga pack', detail: 'Roi Grombar · 2 500 gemmes, 1 M or, 1 ticket SSR garanti', tag: 'Légendaire · Exclusif', excl: true, img: 'assets/hd_grombar.png' },
    // Paliers bonus (au-delà de l'objectif) : cachés sur le site tant que l'objectif n'est pas atteint, puis la barre vise le suivant.
    { at: 75000, label: '75K', name: '1 familier légendaire + 2 000 gemmes', detail: 'Petit phénix', tag: 'Bonus', excl: true, img: 'assets/px/pet_phoenix.webp' },
    { at: 100000, label: '100K', name: '1 apparence légendaire au choix + 3 000 gemmes', detail: 'Parmi les apparences légendaires · + 2 M or', tag: 'Bonus · Méga pack', excl: true, img: 'assets/shop/hero_ticket_limited.webp' },
  ],
};

// Goals par défaut de la 9.3.1 (5 paliers jusqu'à 50 000) : remplacés par les paliers revus tant que l'admin ne les a pas modifiés.
export const GOALS_931 = {
  target: 50000,
  display: { mode: 'real', value: 0 },
  texts: {
    headline: 'Objectif : 50 000 aventuriers pour débloquer toutes les récompenses',
    reached: 'Objectif atteint, merci à tous !',
  },
  tiers: [
    { at: 5000, label: '5K', name: '500 gemmes + 250 K or', detail: 'Monnaie premium et pièces d\'or', img: 'assets/icon_gem.png' },
    { at: 10000, label: '10K', name: '1 familier + 1 000 gemmes', detail: 'Slime doré', tag: 'Exclusif', excl: true, img: 'assets/hd_pet_golden_slime.webp' },
    { at: 20000, label: '20K', name: '1 compagnon + 1 500 gemmes', detail: 'Lame rose · + 500 K or', tag: 'SR · Exclusif', excl: true, img: 'assets/hd_ally_rose_blade.webp' },
    { at: 35000, label: '35K', name: '1 héros SSR + 10 tickets', detail: 'Lilith la Diablesse · tickets d\'invocation', tag: 'SSR · Exclusif', excl: true, img: 'assets/hd_demoness.png' },
    { at: 50000, label: '50K', name: '1 héros SSR + méga pack', detail: 'Roi Grombar · 2 500 gemmes, 1 M or, 1 ticket SSR garanti', tag: 'SSR · Exclusif', excl: true, img: 'assets/hd_grombar.png' },
  ],
};

// Goals par défaut de la 9.3.0 (objectif 100 000) : remplacés par ceux de la 9.3.1 tant que l'admin ne les a pas modifiés.
export const GOALS_930 = {
  target: 100000,
  display: { mode: 'real', value: 0 },
  texts: {
    headline: 'Objectif : 100 000 aventuriers pour débloquer toutes les récompenses',
    reached: 'Objectif atteint, merci à tous !',
  },
  tiers: [
    { at: 10000, label: '10K', name: '500 gemmes', detail: 'Monnaie premium', img: 'assets/icon_gem.png' },
    { at: 20000, label: '20K', name: '250 K or', detail: "Pièces d'or", img: 'assets/icon_chest.png' },
    { at: 30000, label: '30K', name: '1 familier', detail: 'Slime doré', tag: 'Exclusif', excl: true, img: 'assets/hd_pet_golden_slime.webp' },
    { at: 40000, label: '40K', name: '1 000 gemmes', detail: 'Monnaie premium', img: 'assets/icon_gem.png' },
    { at: 50000, label: '50K', name: '1 compagnon', detail: 'Lame rose', tag: 'SR · Exclusif', excl: true, img: 'assets/hd_ally_rose_blade.webp' },
    { at: 60000, label: '60K', name: '1 500 gemmes', detail: '+ 500 K or', img: 'assets/icon_gem.png' },
    { at: 70000, label: '70K', name: '1 héros SSR', detail: 'Lilith la Diablesse', tag: 'SSR · Exclusif', excl: true, img: 'assets/hd_demoness.png' },
    { at: 80000, label: '80K', name: '10 tickets', detail: "d'invocation", img: 'assets/icon_chest.png' },
    { at: 90000, label: '90K', name: '1 héros SSR', detail: 'Roi Grombar', tag: 'SSR · Exclusif', excl: true, img: 'assets/hd_grombar.png' },
    { at: 100000, label: '100K', name: '2 500 gemmes', detail: '+ 1 M or + 1 ticket SSR garanti', tag: 'Méga pack', excl: true, img: 'assets/icon_chest.png' },
  ],
};

export const LIVE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS live_items (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at INTEGER,
  ends_at INTEGER,
  min_client TEXT NOT NULL DEFAULT '0.0.0',
  data TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS live_goals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS live_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS live_history (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  admin TEXT NOT NULL,
  action TEXT NOT NULL,
  item_id INTEGER,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  before TEXT,
  after TEXT
);
`;

// ---- Validation ---------------------------------------------------------------------------------------------------
const str = (v, max, name, { required = false } = {}) => {
  if (v === undefined || v === null) {
    if (required) throw bad(`${name} : champ obligatoire`);
    return '';
  }
  if (typeof v !== 'string') throw bad(`${name} : texte attendu`);
  const t = v.trim();
  if (t.length > max) throw bad(`${name} : ${max} caractères au plus`);
  if (required && !t) throw bad(`${name} : champ obligatoire`);
  return t;
};
const intIn = (v, min, max, name) => {
  if (!Number.isInteger(v) || v < min || v > max) throw bad(`${name} : entier entre ${min} et ${max} attendu`);
  return v;
};
const time = (v, name) => {
  if (v === undefined || v === null || v === '') return null;
  if (!Number.isInteger(v) || v < Date.UTC(2020, 0) || v > Date.UTC(2100, 0)) throw bad(`${name} : date invalide`);
  return v;
};

export function validateParams(type, params) {
  const spec = LIVE_EVENT_TYPES[type].params;
  if (params === undefined) return eventParams(type, {});
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw bad('Paramètres : objet attendu');
  for (const [k, v] of Object.entries(params)) {
    const p = spec[k];
    if (!p) throw bad(`Paramètre inconnu pour ce type : ${k}`);
    if (p.type === 'bool' && typeof v !== 'boolean') throw bad(`${p.label} : oui ou non attendu`);
    if (p.type === 'int' && (!Number.isInteger(v) || v < p.min || v > p.max)) throw bad(`${p.label} : entier entre ${p.min} et ${p.max}`);
    if (p.type === 'number' && (typeof v !== 'number' || !Number.isFinite(v) || v < p.min || v > p.max)) throw bad(`${p.label} : nombre entre ${p.min} et ${p.max}`);
    if (p.type === 'enum' && !p.values.includes(v)) throw bad(`${p.label} : valeur inconnue du jeu`);
  }
  return eventParams(type, params);
}

// Élément du catalogue référencé et version minimale du client qui le connaît.
function catalogEntry(kind, ref) {
  if (kind === 'event') return LIVE_EVENT_TYPES[ref];
  if (kind === 'banner') return LIVE_FEATURED_UNITS[ref];
  if (kind === 'offer') return LIVE_OFFER_IDS[ref];
  if (kind === 'flag') return LIVE_FLAGS[ref] ? { since: LIVE_MIN_CLIENT } : undefined;
  if (kind === 'announcement') return { since: LIVE_MIN_CLIENT };
  return undefined;
}
const maxVersion = (a, b) => (compareVersions(a, b) >= 0 ? a : b);
export const defaultMinClient = (kind, ref) => maxVersion(catalogEntry(kind, ref)?.since ?? LIVE_MIN_CLIENT, LIVE_MIN_CLIENT);

// Champs d'un élément (création ou modification) → valeurs prêtes pour la base. `prev` = élément existant.
export function validateItem(body, prev = null) {
  const kind = prev ? prev.kind : body.kind;
  if (!KINDS.includes(kind)) throw bad('Type d\'élément inconnu');
  const ref = prev ? (body.ref ?? prev.ref) : body.ref ?? (kind === 'announcement' ? 'message' : undefined);
  if (typeof ref !== 'string') throw bad('Référence obligatoire');
  const entry = kind === 'announcement' ? { since: LIVE_MIN_CLIENT } : catalogEntry(kind, ref);
  if (!entry) throw bad(`« ${ref} » n'existe pas dans le code du jeu : livrez-le d'abord par une mise à jour`);
  const minClient = body.minClient ?? prev?.min_client ?? defaultMinClient(kind, ref);
  if (!isVersion(minClient)) throw bad('Version minimale du client : format 9.3.0 attendu');
  if (compareVersions(minClient, entry.since) < 0) {
    throw bad(`Version minimale trop basse : « ${ref} » n'est connu du jeu qu'à partir de la ${entry.since}`);
  }
  const title = str(body.title ?? prev?.title ?? '', 80, 'Titre');
  const startsAt = 'startsAt' in body ? time(body.startsAt, 'Début') : prev?.starts_at ?? null;
  const endsAt = 'endsAt' in body ? time(body.endsAt, 'Fin') : prev?.ends_at ?? null;
  if (startsAt != null && endsAt != null) {
    if (endsAt <= startsAt) throw bad('La fin doit être après le début');
    if (endsAt - startsAt > MAX_SPAN_MS) throw bad('Durée maximale : 90 jours');
  }
  const prevData = prev ? JSON.parse(prev.data) : {};
  const raw = 'data' in body ? body.data ?? {} : prevData;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('Données : objet attendu');
  let data;
  if (kind === 'event') {
    data = { params: validateParams(ref, raw.params) };
    // Numéro de cycle de la 9.2.9 (éléments repris au déploiement) : garde la progression des joueurs sur l'événement.
    if (raw.cycle !== undefined) data.cycle = intIn(raw.cycle, 1, 100000, 'Cycle');
  }
  else if (kind === 'announcement') data = { text: str(raw.text, 500, 'Texte de l\'annonce', { required: true }) };
  else if (kind === 'flag') {
    if (typeof raw.value !== 'boolean') throw bad('Interrupteur : valeur oui ou non attendue');
    data = { value: raw.value };
  } else data = {};
  return { kind, ref, title, startsAt, endsAt, minClient, data };
}

// Montant saisi librement : 40260, « 40 260 », « 40.26k », « 40,26k », « 1,5M ». Renvoie un entier ou NaN.
export function parseAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : NaN;
  if (typeof v !== 'string') return NaN;
  const m = /^([0-9]+(?:[.,][0-9]+)?)\s*([kKmM]?)$/.exec(v.replace(/[\s\u00a0\u202f]/g, ''));
  if (!m) return NaN;
  const n = Number(m[1].replace(',', '.')) * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] ?? 1);
  return Math.round(n);
}

export function validateGoals(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('Goals : objet attendu');
  const target = intIn(parseAmount(raw.target), 1, 100000000, 'Objectif');
  const mode = raw.display?.mode ?? 'real';
  if (!['real', 'offset', 'manual'].includes(mode)) throw bad('Compteur affiché : mode inconnu');
  const value = mode === 'real' ? 0 : intIn(raw.display?.value ?? 0, mode === 'offset' ? -100000000 : 0, 100000000, 'Valeur du compteur');
  if (!Array.isArray(raw.tiers) || raw.tiers.length > 20) throw bad('Paliers : liste de 20 au plus');
  let last = 0;
  const tiers = raw.tiers.map((t, i) => {
    if (!t || typeof t !== 'object') throw bad(`Palier ${i + 1} : objet attendu`);
    const at = intIn(parseAmount(t.at), 1, 100000000, `Palier ${i + 1}, seuil`);
    if (at <= last) throw bad('Les seuils des paliers doivent être croissants');
    last = at;
    const img = str(t.img ?? '', 120, `Palier ${i + 1}, image`);
    if (img && (!/^assets\/(?:[\w-]+\/)*[\w.-]+\.(png|webp|jpe?g|gif)$/.test(img) || img.includes('..'))) throw bad(`Palier ${i + 1}, image : chemin assets/… du site attendu`);
    const tier = {
      at, label: str(t.label, 12, `Palier ${i + 1}, libellé`, { required: true }), name: str(t.name, 60, `Palier ${i + 1}, récompense`, { required: true }),
      detail: str(t.detail ?? '', 120, `Palier ${i + 1}, détail`), img,
    };
    const tag = str(t.tag ?? '', 30, `Palier ${i + 1}, étiquette`);
    if (tag) tier.tag = tag;
    if (t.excl === true) tier.excl = true;
    return tier;
  });
  return {
    target, display: { mode, value }, tiers,
    texts: { headline: str(raw.texts?.headline ?? '', 160, 'Phrase d\'objectif'), reached: str(raw.texts?.reached ?? '', 160, 'Texte une fois atteint') },
  };
}

// État effectif d'un élément à l'instant t (le statut enregistré + les dates).
export function effectiveStatus(item, t) {
  if (item.status === 'draft' || item.status === 'disabled' || item.status === 'ended') return item.status;
  if (item.ends_at != null && item.ends_at <= t) return 'ended';
  if (item.status === 'active') return 'active';
  return item.starts_at != null && item.starts_at <= t ? 'active' : 'scheduled';
}

// ---- Reprise du calendrier de la 9.2.9 (migration idempotente) ------------------------------------------------------
// Au premier démarrage en 9.3.0, le calendrier live est rempli avec ce que la 9.2.9 calculait toute seule : cycle de
// 28 jours (Expédition 14 j puis Marché 14 j) depuis EVENTS.anchor, et vedette tournant tous les 14 jours parmi les
// SSR permanents, sur LEGACY_CYCLES cycles à partir du cycle en cours. Mêmes dates (minuit, heure locale du serveur)
// et même numéro de cycle que la 9.2.9 : la progression des joueurs sur l'événement en cours est conservée.
// Ne tourne qu'une fois (live_meta « legacy_seed ») ; l'admin peut ensuite tout modifier ou supprimer.
export const LEGACY_CYCLES = 3;
export function legacyCalendar(t) {
  const anchor = new Date(`${EVENTS.anchor}T00:00:00`).getTime();
  const cycleMs = EVENTS.cycleDays * DAY;
  const grandMs = EVENTS.grandDays * DAY;
  const first = Math.max(0, Math.floor((t - anchor) / cycleMs));
  const events = [];
  for (let c = first; c < first + LEGACY_CYCLES; c += 1) {
    const s = anchor + c * cycleMs;
    events.push({ ref: EVENTS.grand.id, cycle: c + 1, start: s, end: s + grandMs });
    events.push({ ref: EVENTS.small.id, cycle: c + 1, start: s + grandMs, end: s + cycleMs });
  }
  const units = Object.keys(LIVE_FEATURED_UNITS); // même ordre que permanentSsr() (vérifié par les tests)
  const period = BANNERS.limited.rotationDays * DAY;
  const k0 = Math.floor((t - anchor) / period);
  const banners = [];
  const until = anchor + (first + LEGACY_CYCLES) * cycleMs;
  for (let k = k0; anchor + k * period < until; k += 1) {
    banners.push({ ref: units[((k % units.length) + units.length) % units.length], start: anchor + k * period, end: anchor + (k + 1) * period });
  }
  return { events: events.filter((e) => e.end > t), banners: banners.filter((b) => b.end > t) };
}

function seedLegacyCalendar(db, meta, t) {
  if (meta.get('legacy_seed')) return;
  const { events, banners } = legacyCalendar(t);
  const ins = db.prepare(`INSERT INTO live_items (kind, ref, title, status, starts_at, ends_at, min_client, data, version, created_at, updated_at, updated_by)
    VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?, 1, ?, ?, 'système')`);
  db.exec('BEGIN');
  try {
    for (const e of events) {
      const label = `${LIVE_EVENT_TYPES[e.ref].label} n° ${e.cycle}`;
      ins.run('event', e.ref, label, e.start, e.end, defaultMinClient('event', e.ref), JSON.stringify({ params: eventParams(e.ref, {}), cycle: e.cycle }), t, t);
    }
    for (const b of banners) ins.run('banner', b.ref, `Vedette : ${LIVE_FEATURED_UNITS[b.ref].label}`, b.start, b.end, defaultMinClient('banner', b.ref), '{}', t, t);
    db.prepare('INSERT INTO live_history (at, admin, action, item_id, kind, summary) VALUES (?, ?, ?, NULL, ?, ?)')
      .run(t, 'système', 'reprise du calendrier 9.2.9', 'event', `reprise du calendrier 9.2.9 : ${events.length} événement(s), ${banners.length} vedette(s) programmés`);
    meta.set('legacy_seed', String(t));
    meta.set('programmed', '1');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---- Service -----------------------------------------------------------------------------------------------------
export function createLive({ db, now = () => Date.now() }) {
  db.exec(LIVE_SCHEMA_SQL);
  if (!db.prepare('SELECT id FROM live_goals WHERE id = 1').get()) {
    db.prepare('INSERT INTO live_goals (id, data, version, updated_at, updated_by) VALUES (1, ?, 1, ?, ?)').run(JSON.stringify(DEFAULT_GOALS), now(), 'système');
  }
  // Goals jamais modifiés (ceux de la 9.3.0 ou de la 9.3.1) → paliers revus. Des goals réglés dans l'admin sont gardés.
  const g0 = db.prepare('SELECT data, version FROM live_goals WHERE id = 1').get();
  if (g0 && (g0.data === JSON.stringify(GOALS_930) || g0.data === JSON.stringify(GOALS_931))) {
    db.prepare('UPDATE live_goals SET data = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = 1').run(JSON.stringify(DEFAULT_GOALS), now(), 'système (paliers revus)');
  }
  const meta = {
    get: (k) => db.prepare('SELECT value FROM live_meta WHERE key = ?').get(k)?.value,
    set: (k, v) => db.prepare('INSERT INTO live_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v),
  };
  seedLegacyCalendar(db, meta, now());
  const q = {
    all: db.prepare('SELECT * FROM live_items ORDER BY COALESCE(starts_at, created_at) DESC, id DESC'),
    get: db.prepare('SELECT * FROM live_items WHERE id = ?'),
    goals: db.prepare('SELECT * FROM live_goals WHERE id = 1'),
    prereg: db.prepare('SELECT COUNT(*) AS n FROM preregistrations'),
    history: db.prepare('SELECT * FROM live_history ORDER BY id DESC LIMIT ?'),
    log: db.prepare('INSERT INTO live_history (at, admin, action, item_id, kind, summary, before, after) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  };

  const view = (row, t = now()) => ({
    id: row.id, kind: row.kind, ref: row.ref, title: row.title, status: row.status, effective: effectiveStatus(row, t),
    startsAt: row.starts_at, endsAt: row.ends_at, minClient: row.min_client, data: JSON.parse(row.data), version: row.version,
    createdAt: row.created_at, updatedAt: row.updated_at, updatedBy: row.updated_by,
  });
  const label = (row) => `${row.kind} « ${row.title || row.ref} »`;

  function log(admin, action, row, before, after) {
    q.log.run(now(), admin, action, row?.id ?? null, row?.kind ?? 'goals', `${action} : ${row ? label(row) : 'goals du site'}`,
      before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null);
  }

  function find(id) {
    const row = q.get.get(id);
    if (!row) throw new LiveError(404, 'Élément introuvable');
    return row;
  }
  function checkVersion(row, version) {
    if (version !== undefined && version !== row.version) {
      throw new LiveError(409, 'Cet élément a été modifié entre-temps par quelqu\'un d\'autre : rechargez la page');
    }
  }

  // Un seul événement à la fois dans le jeu, une seule vedette à la fois, un seul interrupteur par nom.
  function checkConflicts(cand, selfId) {
    const t = now();
    const live = (r) => r.id !== selfId && r.kind === cand.kind && ['scheduled', 'active'].includes(effectiveStatus(r, t));
    const rows = q.all.all().filter(live);
    if (cand.kind === 'flag') {
      if (rows.some((r) => r.ref === cand.ref)) throw new LiveError(409, `L'interrupteur « ${cand.ref} » est déjà réglé par un autre élément`);
      return;
    }
    if (cand.kind !== 'event' && cand.kind !== 'banner') return;
    const s = cand.starts_at ?? t;
    const e = cand.ends_at ?? Infinity;
    const clash = rows.find((r) => (r.starts_at ?? 0) < e && s < (r.ends_at ?? Infinity));
    if (clash) throw new LiveError(409, `Chevauche ${label(clash)} (${clash.kind === 'event' ? 'un seul événement' : 'une seule vedette'} à la fois)`);
  }

  function create(admin, body) {
    const v = validateItem(body);
    const status = body.status ?? 'draft';
    if (!['draft', 'scheduled'].includes(status)) throw bad('Création : brouillon ou programmé seulement (activez ensuite)');
    if (status === 'scheduled') requireDates(v, true);
    const t = now();
    const row = { kind: v.kind, ref: v.ref, starts_at: v.startsAt, ends_at: v.endsAt, status, id: 0 };
    if (status === 'scheduled') { checkConflicts(row, 0); meta.set('programmed', '1'); }
    const res = db.prepare(`INSERT INTO live_items (kind, ref, title, status, starts_at, ends_at, min_client, data, version, created_at, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).run(v.kind, v.ref, v.title, status, v.startsAt, v.endsAt, v.minClient, JSON.stringify(v.data), t, t, admin);
    const created = find(Number(res.lastInsertRowid));
    log(admin, 'création', created, null, view(created));
    return view(created);
  }

  function requireDates(v, future) {
    const s = v.startsAt ?? v.starts_at;
    const e = v.endsAt ?? v.ends_at;
    if (s == null || ((v.kind === 'event' || v.kind === 'banner') && e == null)) throw bad('Programmation : dates de début et de fin obligatoires');
    if (future && s <= now()) throw bad('Programmation : le début doit être dans le futur (sinon « Activer maintenant »)');
  }

  function write(admin, action, row, fields) {
    const before = view(row);
    const next = { ...row, ...fields };
    db.prepare(`UPDATE live_items SET ref = ?, title = ?, status = ?, starts_at = ?, ends_at = ?, min_client = ?, data = ?,
      version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?`)
      .run(next.ref, next.title, next.status, next.starts_at, next.ends_at, next.min_client, next.data, now(), admin, row.id);
    const after = find(row.id);
    log(admin, action, after, before, view(after));
    return view(after);
  }

  function update(admin, id, body) {
    const row = find(id);
    checkVersion(row, body.version);
    const v = validateItem(body, row);
    const fields = { ref: v.ref, title: v.title, starts_at: v.startsAt, ends_at: v.endsAt, min_client: v.minClient, data: JSON.stringify(v.data) };
    const eff = effectiveStatus(row, now());
    if (eff === 'scheduled' || eff === 'active') {
      checkConflicts({ ...row, ...fields }, row.id);
      if (fields.ends_at != null && fields.ends_at <= now()) throw bad('La fin doit être dans le futur pour un élément en cours ou programmé');
    }
    return write(admin, 'modification', row, fields);
  }

  // « Le bouton » : activer maintenant, arrêter, programmer, repasser en brouillon.
  function act(admin, id, action, body = {}) {
    const row = find(id);
    checkVersion(row, body.version);
    const t = now();
    const eff = effectiveStatus(row, t);
    if (action === 'activate') {
      if (eff === 'active') throw new LiveError(409, 'Déjà actif');
      let ends = row.ends_at;
      if (ends == null && row.kind === 'event') ends = t + LIVE_EVENT_TYPES[row.ref].days * DAY;
      if (ends == null && row.kind === 'banner') ends = t + 14 * DAY;
      if (ends != null && ends <= t) throw bad('La date de fin est passée : modifiez-la avant d\'activer');
      const fields = { status: 'active', starts_at: t, ends_at: ends };
      checkConflicts({ ...row, ...fields }, row.id);
      meta.set('programmed', '1');
      return write(admin, 'activation immédiate', row, fields);
    }
    if (action === 'stop') {
      if (eff !== 'active' && eff !== 'scheduled') throw new LiveError(409, 'Rien à arrêter : l\'élément n\'est ni actif ni programmé');
      return write(admin, eff === 'active' ? 'arrêt immédiat' : 'déprogrammation', row,
        eff === 'active' ? { status: 'ended', ends_at: t } : { status: 'disabled' });
    }
    if (action === 'schedule') {
      requireDates(row, true);
      checkConflicts({ ...row, status: 'scheduled' }, row.id);
      meta.set('programmed', '1');
      return write(admin, 'programmation', row, { status: 'scheduled' });
    }
    if (action === 'draft') {
      if (eff === 'active') throw new LiveError(409, 'Arrêtez d\'abord l\'élément actif');
      return write(admin, 'retour en brouillon', row, { status: 'draft' });
    }
    throw new LiveError(404, 'Action inconnue');
  }

  function remove(admin, id) {
    const row = find(id);
    if (effectiveStatus(row, now()) === 'active') throw new LiveError(409, 'Arrêtez d\'abord l\'élément actif');
    db.prepare('DELETE FROM live_items WHERE id = ?').run(id);
    log(admin, 'suppression', row, view(row), null);
  }

  function goalsRow() {
    const row = q.goals.get();
    return { data: JSON.parse(row.data), version: row.version, updatedAt: row.updated_at, updatedBy: row.updated_by };
  }
  function displayedCount(goals, real) {
    if (goals.display.mode === 'manual') return goals.display.value;
    if (goals.display.mode === 'offset') return Math.max(0, real + goals.display.value);
    return real;
  }
  function setGoals(admin, body) {
    const cur = goalsRow();
    if (body.version !== undefined && body.version !== cur.version) throw new LiveError(409, 'Les goals ont été modifiés entre-temps : rechargez la page');
    const data = validateGoals(body.data);
    db.prepare('UPDATE live_goals SET data = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = 1').run(JSON.stringify(data), now(), admin);
    log(admin, 'modification', null, cur.data, data);
    return adminGoals();
  }
  function adminGoals() {
    const g = goalsRow();
    const real = q.prereg.get().n;
    return { ...g, realCount: real, displayedCount: displayedCount(g.data, real) };
  }
  function publicGoals() {
    const g = goalsRow().data;
    return { target: g.target, count: displayedCount(g, q.prereg.get().n), tiers: g.tiers, texts: g.texts };
  }

  // Charge publique (sans serverTime, pour l'ETag) : seulement ce qui est programmé ou actif. Les dates sont en heure
  // du serveur (ms UTC) ; le jeu décide avec l'heure du serveur, jamais avec son horloge locale.
  function publicContent(t = now()) {
    const rows = q.all.all().filter((r) => ['scheduled', 'active'].includes(effectiveStatus(r, t)))
      .sort((a, b) => (a.starts_at ?? 0) - (b.starts_at ?? 0) || a.id - b.id);
    const base = (r) => ({ id: r.id, state: effectiveStatus(r, t), start: r.starts_at ?? r.updated_at, end: r.ends_at, minClient: r.min_client });
    const flags = {};
    for (const r of rows.filter((x) => x.kind === 'flag' && effectiveStatus(x, t) === 'active')) flags[r.ref] = JSON.parse(r.data).value;
    return {
      schema: LIVE_SCHEMA,
      validFor: LIVE_VALID_MS,
      goals: publicGoals(),
      events: rows.filter((r) => r.kind === 'event').map((r) => {
        const d = JSON.parse(r.data);
        return { ...base(r), type: r.ref, title: r.title, params: d.params, ...(d.cycle ? { cycle: d.cycle } : {}) };
      }),
      banners: rows.filter((r) => r.kind === 'banner').map((r) => ({ ...base(r), unit: r.ref })),
      offers: rows.filter((r) => r.kind === 'offer').map((r) => ({ ...base(r), offer: r.ref })),
      announcements: rows.filter((r) => r.kind === 'announcement').map((r) => ({ ...base(r), title: r.title, text: JSON.parse(r.data).text })),
      flags,
      // Faux tant que rien n'a jamais été programmé ni activé : le jeu garde alors son calendrier automatique.
      programmed: meta.get('programmed') === '1',
    };
  }
  function publicPayload(t = now()) {
    const content = publicContent(t);
    const etag = `"live-${createHash('sha256').update(JSON.stringify(content)).digest('base64url').slice(0, 22)}"`;
    return { content, etag };
  }

  function adminState() {
    const t = now();
    return {
      serverTime: t,
      items: q.all.all().map((r) => view(r, t)),
      goals: adminGoals(),
      history: q.history.all(80).map((h) => ({ id: h.id, at: h.at, admin: h.admin, action: h.action, itemId: h.item_id, kind: h.kind, summary: h.summary })),
      catalog: { minClient: LIVE_MIN_CLIENT, events: LIVE_EVENT_TYPES, units: LIVE_FEATURED_UNITS, offers: LIVE_OFFER_IDS, flags: LIVE_FLAGS },
    };
  }
  function historyEntry(id) {
    const h = db.prepare('SELECT * FROM live_history WHERE id = ?').get(id);
    if (!h) throw new LiveError(404, 'Entrée introuvable');
    return { ...h, before: h.before ? JSON.parse(h.before) : null, after: h.after ? JSON.parse(h.after) : null };
  }

  return { create, update, act, remove, setGoals, adminGoals, publicGoals, publicPayload, adminState, historyEntry };
}
