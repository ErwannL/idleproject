// Sauvegarde locale (localStorage dans le navigateur, ou tout objet compatible).
// Écriture sûre : copie temporaire vérifiée, puis sauvegarde principale ;
// la version précédente est conservée comme secours si la principale est illisible.
import { BALANCE } from '../data/balance.js';
import { SAVE_VERSION, createNewState, sanitizeState } from './state.js';

export const SAVE_KEY = 'idle-rpg.save';
export const BACKUP_KEY = 'idle-rpg.save.backup';
export const TMP_KEY = 'idle-rpg.save.tmp';
// v9.1.0 : copie de la partie remplacée par un import (une seule, la dernière).
export const BEFORE_IMPORT_KEY = 'idle-rpg.save.before-import';
// v9.1.0 : copie brute d'avant chaque migration de format (idle-rpg.save.pre-v6…), jamais écrasée.
export const preMigrationKey = (version) => `idle-rpg.save.pre-v${version}`;

// lastSaved fait partie de la sauvegarde et sert au calcul hors ligne : en cas d'échec, l'ancienne valeur est
// remise (sinon la partie croyait avoir été sauvegardée, et l'absence suivante était mal comptée).
export function saveGame(state, storage, now = Date.now()) {
  const before = state.lastSaved;
  try {
    state.lastSaved = now;
    const json = JSON.stringify(state);
    storage.setItem(TMP_KEY, json);
    if (storage.getItem(TMP_KEY) !== json) throw new Error('copie temporaire illisible');
    const previous = storage.getItem(SAVE_KEY);
    if (previous !== null) storage.setItem(BACKUP_KEY, previous);
    storage.setItem(SAVE_KEY, json);
    storage.removeItem(TMP_KEY);
    return true;
  } catch (error) {
    state.lastSaved = before;
    console.error('Sauvegarde impossible', error);
    return false;
  }
}

// Renvoie { state, source } avec source = 'main' | 'backup' | 'new' | 'newer'.
// 'newer' : la sauvegarde vient d'une version plus récente du jeu ; elle n'est pas chargée et ne doit pas être
// écrasée (le jeu bloque alors l'écriture et le dit), `newerVersion` donne son format.
export function loadGame(storage, balance = BALANCE, now = Date.now()) {
  for (const [key, source] of [[SAVE_KEY, 'main'], [BACKUP_KEY, 'backup']]) {
    let raw = null;
    try {
      raw = storage.getItem(key);
    } catch {
      raw = null;
    }
    if (!raw) continue;
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // sauvegarde corrompue : on essaie la suivante
    }
    if (!parsed || typeof parsed !== 'object') continue;
    const version = Number.isInteger(parsed.version) ? parsed.version : 1;
    if (version > SAVE_VERSION) return { state: createNewState(now), source: 'newer', newerVersion: version };
    if (version < SAVE_VERSION) keepPreMigrationCopy(storage, version, raw);
    return { state: sanitizeState(parsed, balance, now), source };
  }
  return { state: createNewState(now), source: 'new' };
}

function keepPreMigrationCopy(storage, version, raw) {
  try {
    if (storage.getItem(preMigrationKey(version)) === null) storage.setItem(preMigrationKey(version), raw);
  } catch {
    // Stockage plein : la migration se fait quand même.
  }
}

// Import (v9.1.0) : accepte le JSON d'une partie ou ce même JSON en base64 (« code de sauvegarde »).
// Renvoie { state } si la partie est valide, ou { error } avec la raison. lastSaved passe à maintenant :
// importer une vieille partie ne doit pas rapporter des heures de gains hors ligne.
export function parseImport(text, balance = BALANCE, now = Date.now()) {
  const src = String(text ?? '').trim();
  if (!src) return { error: 'Aucune sauvegarde à importer.' };
  let parsed = null;
  for (const candidate of [src, decodeBase64(src)]) {
    if (!candidate) continue;
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'Ce n\'est pas une sauvegarde valide.' };
  if (!Number.isFinite(parsed.maxStage) || !Number.isFinite(parsed.level) || !parsed.equipment) return { error: 'Ce n\'est pas une sauvegarde d\'Ascendrya.' };
  if (Number.isInteger(parsed.version) && parsed.version > SAVE_VERSION) return { error: 'Sauvegarde d\'une version plus récente du jeu : mets le jeu à jour d\'abord.' };
  const state = sanitizeState(parsed, balance, now);
  state.lastSaved = now;
  return { state };
}

function decodeBase64(text) {
  try {
    const bin = atob(text.replace(/\s+/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function encodeSaveCode(json) {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Remplace la partie par une partie importée : la partie actuelle est copiée à part, la principale et la
// copie de secours reçoivent la partie importée (sinon un échec de lecture ferait revenir l'ancienne).
export function writeImported(state, storage) {
  const current = storage.getItem(SAVE_KEY);
  if (current !== null) storage.setItem(BEFORE_IMPORT_KEY, current);
  const json = JSON.stringify(state);
  storage.setItem(SAVE_KEY, json);
  storage.setItem(BACKUP_KEY, json);
  return storage.getItem(SAVE_KEY) === json;
}

export function clearSave(storage) {
  for (const key of [SAVE_KEY, BACKUP_KEY, TMP_KEY]) storage.removeItem(key);
}
