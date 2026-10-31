// Base SQLite (node:sqlite, intégré à Node 22 : aucune dépendance native).
// Tables : comptes, sessions, sauvegardes de parties, préinscriptions.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS saves (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  max_stage INTEGER NOT NULL DEFAULT 0,
  gold REAL NOT NULL DEFAULT 0,
  gems INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  bosses_defeated INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS preregistrations (
  email TEXT PRIMARY KEY,
  consent_version TEXT NOT NULL,
  consent_at INTEGER NOT NULL
);
`;

// Ajoute une colonne absente (migration légère d'une base déjà en place).
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function openDatabase(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  addColumnIfMissing(db, 'accounts', 'last_seen_at', 'INTEGER');
  for (const col of ['level', 'max_stage', 'kills', 'bosses_defeated']) addColumnIfMissing(db, 'saves', col, 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'saves', 'gold', 'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'saves', 'gems', 'INTEGER NOT NULL DEFAULT 0');
  return db;
}
