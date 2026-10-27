// Configurations d'équipe (v7.7) : enregistrer puis rappeler l'équipe (compagnons + familier)
// et l'équipement porté, pour changer vite de farm (monstres, or, boss…).
import { SLOTS } from '../data/items.js';
import { LOADOUT_NAMES } from '../data/synergies.js';
import { clampTeam, onExpedition } from './companions.js';
import { equipItem } from './inventory.js';

export function emptyLoadouts() {
  return LOADOUT_NAMES.map((name) => ({ name, team: null, gear: null }));
}

export function saveLoadout(state, index) {
  const slot = state.loadouts[index];
  if (!slot) return false;
  slot.team = [...state.companions.equipped];
  slot.gear = Object.fromEntries(Object.keys(SLOTS).map((s) => [s, state.equipment[s]?.id ?? null]));
  return true;
}

// Rappelle une configuration : les objets recyclés depuis sont simplement ignorés.
export function applyLoadout(state, index) {
  const slot = state.loadouts[index];
  if (!slot?.team) return false;
  state.companions.equipped = clampTeam(slot.team.filter((id) => state.companions.owned[id] && !onExpedition(state, id)));
  for (const id of Object.values(slot.gear ?? {})) if (id) equipItem(state, id);
  return true;
}

export function sanitizeLoadouts(raw) {
  const out = emptyLoadouts();
  if (!Array.isArray(raw)) return out;
  raw.slice(0, out.length).forEach((l, i) => {
    if (!l || typeof l !== 'object') return;
    if (typeof l.name === 'string' && l.name.trim()) out[i].name = l.name.slice(0, 24);
    if (Array.isArray(l.team)) out[i].team = l.team.filter((id) => typeof id === 'string').slice(0, 6);
    if (l.gear && typeof l.gear === 'object') {
      out[i].gear = Object.fromEntries(Object.keys(SLOTS).map((s) => [s, typeof l.gear[s] === 'string' ? l.gear[s] : null]));
    }
  });
  return out;
}
