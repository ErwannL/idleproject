// v9.6.0 (6) : effets des comportements de monstres en combat. Une parade présente dans l'équipe (rôle d'un compagnon
// placé, ou classe du héros) annule le malus. Calculé une fois par pas (world.parries).
import { BEHAVIORS } from '../data/behaviors.js';
import { COMPANION_ROLES } from '../data/synergies.js';
import { activeClass } from './classes.js';

const CLASS_ROLE = { archer: 'archer', crossbowman: 'archer', pyromancer: 'mage', stormcaller: 'mage', necromancer: 'mage', assassin: 'assassin', berserker: 'berserker' };

// Parades présentes : { shooter: true, … }.
export function teamCounters(state) {
  const roles = new Set((state.companions?.equipped ?? []).map((id) => COMPANION_ROLES[id]).filter(Boolean));
  return countersFor(roles, activeClass(state));
}

export function countersFor(roles, cls) {
  const heroRole = cls ? CLASS_ROLE[cls.id] : null;
  const ranged = cls && (cls.style === 'ranged' || cls.style === 'magic');
  const out = {};
  for (const [id, b] of Object.entries(BEHAVIORS)) {
    out[id] = b.roles.some((r) => roles.has(r) || (r !== 'guardian' && heroRole === r)) || Boolean(b.ranged && ranged) || Boolean(cls && b.classes?.includes(cls.id));
  }
  return out;
}

// Dégâts reçus par un monstre (héros et compagnons) selon son comportement.
export function behaviorTakenMult(enemy, parries, source) {
  const b = enemy.behavior;
  if (!b || parries?.[b]) return 1;
  if (b === 'shield') return 0.5;
  if (b === 'swarm') return 0.7;
  if (b === 'flyer') return source === 'attack' || source === 'hero' ? 0.5 : 1; // coups au contact du héros
  return 1;
}

// Dégâts infligés au héros par un monstre selon son comportement (le premier coup d'une charge).
export function behaviorHitMult(enemy, parries) {
  const b = enemy.behavior;
  if (!b || parries?.[b]) return 1;
  if (b === 'shooter') return 1.6;
  if (b === 'charger' && !enemy.charged) { enemy.charged = true; return 2.5; }
  return 1;
}
