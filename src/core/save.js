// Sauvegarde locale (localStorage dans le navigateur, ou tout objet compatible).
// Écriture sûre : copie temporaire vérifiée, puis sauvegarde principale ;
// la version précédente est conservée comme secours si la principale est illisible.
// Filet de sécurité (v9.1) : une sauvegarde d'une version plus récente n'est jamais écrasée,
// et l'état d'avant migration est copié dans une clé pre-vN, jamais réécrite.
import { BALANCE } from '../data/balance.js';
import { SAVE_VERSION, createNewState, sanitizeState } from './state.js';

export const SAVE_KEY = 'idle-rpg.save';
export const BACKUP_KEY = 'idle-rpg.save.backup';
export const TMP_KEY = 'idle-rpg.save.tmp';
export const PRE_MIGRATION_PREFIX = 'idle-rpg.save.pre-v';

function readVersion(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? Number(parsed.version) || 0 : null;
  } catch {
    return null;
  }
}

// Vrai si la sauvegarde principale vient d'une version plus récente que celle-ci : on ne l'écrase pas.
export function isNewerSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return Boolean(raw) && (readVersion(raw) ?? 0) > SAVE_VERSION;
  } catch {
    return false;
  }
}

export function saveGame(state, storage, now = Date.now()) {
  try {
    if (isNewerSave(storage)) {
      console.warn('Sauvegarde d\'une version plus récente : écriture refusée.');
      return false;
    }
    state.lastSaved = now;
    const json = JSON.stringify(state);
    storage.setItem(TMP_KEY, json);
    if (storage.getItem(TMP_KEY) !== json) return false;
    const previous = storage.getItem(SAVE_KEY);
    if (previous !== null) storage.setItem(BACKUP_KEY, previous);
    storage.setItem(SAVE_KEY, json);
    storage.removeItem(TMP_KEY);
    return true;
  } catch (error) {
    console.error('Sauvegarde impossible', error);
    return false;
  }
}

// Renvoie { state, source } avec source = 'main' | 'backup' | 'new' | 'newer'.
export function loadGame(storage, balance = BALANCE, now = Date.now()) {
  for (const [key, source] of [[SAVE_KEY, 'main'], [BACKUP_KEY, 'backup']]) {
    let raw = null;
    try {
      raw = storage.getItem(key);
    } catch {
      raw = null;
    }
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;
      const version = Number(parsed.version) || 0;
      if (version > SAVE_VERSION) return { state: createNewState(now), source: 'newer' };
      if (key === SAVE_KEY && version < SAVE_VERSION) {
        // Copie de l'état d'avant migration, une seule fois par version.
        const preKey = `${PRE_MIGRATION_PREFIX}${version}`;
        if (storage.getItem(preKey) === null) storage.setItem(preKey, raw);
      }
      return { state: sanitizeState(parsed, balance, now), source };
    } catch {
      // Sauvegarde corrompue : on essaie la suivante.
    }
  }
  return { state: createNewState(now), source: 'new' };
}

export function clearSave(storage) {
  for (const key of [SAVE_KEY, BACKUP_KEY, TMP_KEY]) storage.removeItem(key);
}
