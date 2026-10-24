// Sauvegarde locale (localStorage dans le navigateur, ou tout objet compatible).
// Écriture sûre : copie temporaire vérifiée, puis sauvegarde principale ;
// la version précédente est conservée comme secours si la principale est illisible.
import { BALANCE } from '../data/balance.js';
import { createNewState, sanitizeState } from './state.js';

export const SAVE_KEY = 'idle-rpg.save';
export const BACKUP_KEY = 'idle-rpg.save.backup';
export const TMP_KEY = 'idle-rpg.save.tmp';

export function saveGame(state, storage, now = Date.now()) {
  try {
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

// Renvoie { state, source } avec source = 'main' | 'backup' | 'new'.
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
      if (parsed && typeof parsed === 'object') return { state: sanitizeState(parsed, balance, now), source };
    } catch {
      // Sauvegarde corrompue : on essaie la suivante.
    }
  }
  return { state: createNewState(now), source: 'new' };
}

export function clearSave(storage) {
  for (const key of [SAVE_KEY, BACKUP_KEY, TMP_KEY]) storage.removeItem(key);
}
