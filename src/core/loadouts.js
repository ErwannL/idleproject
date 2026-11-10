// Builds (v7.7 « configurations ») : enregistrer puis rappeler l'équipe (compagnons + familier) et l'équipement
// porté, pour changer vite de farm (monstres, or, boss…).
// v9.1.0 : un build garde aussi la classe, les pouvoirs actifs et la répartition des compétences ; le rappel
// cherche les objets dans le sac et au coffre (v9.1.3 : mannequins fondus dans le coffre), et compte vraiment ceux
// qui manquent.
import { BALANCE } from '../data/balance.js';
import { EQUIP_SLOTS, HERO_SLOTS, SLOTS, eqSlot, heroSlot } from '../data/items.js';
import { LOADOUT_NAMES } from '../data/synergies.js';
import { SKILLS } from '../data/skills.js';
import { clampTeam, onExpedition } from './companions.js';
import { equipItem } from './inventory.js';
import { classById, classUnlocked, setHeroClass } from './classes.js';
import { powerSlots } from './powers.js';
import { skillPointsSpent } from './skills.js';

export function emptyLoadouts() {
  return LOADOUT_NAMES.map((name) => ({ name, team: null, gear: null }));
}

export function saveLoadout(state, index) {
  const slot = state.loadouts[index];
  if (!slot) return false;
  slot.team = [...state.companions.equipped];
  slot.gear = Object.fromEntries(Object.keys(HERO_SLOTS).map((s) => [s, state.equipment[s]?.id ?? null]));
  slot.heroClass = state.heroClass;
  slot.powers = [...state.equippedPowers];
  slot.skills = { ...state.skills };
  return true;
}

export function renameLoadout(state, index, name) {
  const slot = state.loadouts[index];
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!slot || !clean) return false;
  slot.name = clean;
  return true;
}

// Sort un objet du coffre vers le sac (s'il y a la place). Renvoie vrai s'il y est.
function fetchToBag(state, id, balance) {
  if (state.inventory.some((i) => i.id === id)) return true;
  if (state.inventory.length >= balance.loot.inventorySize) return false;
  const si = state.stash.findIndex((i) => i.id === id);
  if (si >= 0) { state.inventory.push(state.stash.splice(si, 1)[0]); return true; }
  return false;
}

// Rappelle un build. Renvoie null si le build est vide, sinon { missing, refused } : objets introuvables (recyclés
// depuis, ou sac plein pour les sortir du coffre) et objets refusés (arme d'une autre classe).
export function applyLoadout(state, index, balance = BALANCE, itemPower = () => 0) {
  const slot = state.loadouts[index];
  if (!slot?.team) return null;
  if (slot.heroClass && classById(slot.heroClass) && classUnlocked(state, slot.heroClass)) setHeroClass(state, slot.heroClass, itemPower);
  state.companions.equipped = clampTeam(slot.team.filter((id) => state.companions.owned[id] && !onExpedition(state, id)));
  let missing = 0;
  let refused = 0;
  for (const id of Object.values(slot.gear ?? {})) {
    if (!id) continue;
    if (Object.values(state.equipment).some((i) => i?.id === id)) continue; // déjà porté
    if (!fetchToBag(state, id, balance)) { missing += 1; continue; }
    if (!equipItem(state, id)) refused += 1;
  }
  if (Array.isArray(slot.powers)) {
    const wanted = slot.powers.filter((id) => state.powers[id]);
    if (wanted.length) state.equippedPowers = wanted.slice(0, powerSlots(state));
  }
  if (slot.skills) {
    const spent = Object.values(slot.skills).reduce((a, lv) => a + skillPointsSpent(lv), 0);
    if (spent <= state.level) state.skills = { ...slot.skills };
  }
  return { missing, refused };
}

export function sanitizeLoadouts(raw) {
  const out = emptyLoadouts();
  if (!Array.isArray(raw)) return out;
  raw.slice(0, out.length).forEach((l, i) => {
    if (!l || typeof l !== 'object') return;
    if (typeof l.name === 'string' && l.name.trim()) out[i].name = l.name.slice(0, 24);
    if (Array.isArray(l.team)) out[i].team = l.team.filter((id) => typeof id === 'string').slice(0, 6);
    if (l.gear && typeof l.gear === 'object') {
      out[i].gear = Object.fromEntries(Object.keys(HERO_SLOTS).map((s) => [s, typeof l.gear[s] === 'string' ? l.gear[s] : null]));
      // v9.3.8 : builds des 3 places (9.3.4) → l'accessoire va à la première place de bijou libre (équipé par son id).
      if (typeof l.gear.accessory === 'string') { const k = ['amulet', 'ring', 'bracelet'].find((x) => !out[i].gear[x]); if (k) out[i].gear[k] = l.gear.accessory; }
    }
    // v9.1.0 : champs ajoutés (absents des anciens builds : le rappel les ignore alors).
    if (typeof l.heroClass === 'string' && classById(l.heroClass)) out[i].heroClass = l.heroClass;
    if (Array.isArray(l.powers)) out[i].powers = l.powers.filter((id) => typeof id === 'string').slice(0, 8);
    if (l.skills && typeof l.skills === 'object') {
      const skills = {};
      for (const sk of SKILLS) {
        const v = l.skills[sk.id];
        if (Number.isInteger(v) && v > 0) skills[sk.id] = Math.min(v, sk.maxLevel);
      }
      out[i].skills = skills;
    }
  });
  return out;
}
