// Ennemis mutés (v9.0.4) : de temps en temps, un monstre ordinaire apparaît muté — plus coriace, avec un pouvoir
// (se dédouble en mourant, se régénère, cuirasse, frénésie, vampirisme, géant) — mais il rapporte plus : or ×3 et
// un objet garanti. Jamais un boss, une élite ou un double ; à partir du monde 2.
export const MUTATIONS = [
  { id: 'split', name: 'Scissipare', text: 'se dédouble en mourant', color: '#7fe07a' },
  { id: 'regen', name: 'Régénérant', text: 'régénère 4 % de ses PV par seconde', color: '#5fe0c0' },
  { id: 'armored', name: 'Cuirassé', text: 'dégâts subis −50 % tant qu\'il a plus de la moitié de ses PV', color: '#b8c8e0' },
  { id: 'frenzied', name: 'Frénétique', text: 'attaque deux fois plus vite', color: '#ff7a3a' },
  { id: 'vampire', name: 'Vampirique', text: 'se soigne de trois fois les dégâts qu\'il inflige', color: '#ff4a6a' },
  { id: 'giant', name: 'Géant', text: 'PV ×3, mais plus lent', color: '#ffd35a' },
];

export const MUTATION_RULES = {
  unlockStage: 21, // monde 2
  chance: 0.04, // par ennemi ordinaire
  chancePerCycle: 0.01, // +1 point par difficulté (×2, ×3…)
  maxChance: 0.12,
  hpMultiplier: 1.6,
  goldMultiplier: 3,
};

export const mutationById = (id) => MUTATIONS.find((m) => m.id === id) ?? null;

export function mutationChance(state, cycle = 0) {
  if ((state.maxStage ?? 1) < MUTATION_RULES.unlockStage) return 0;
  return Math.min(MUTATION_RULES.maxChance, MUTATION_RULES.chance + MUTATION_RULES.chancePerCycle * cycle);
}

// Applique une mutation tirée au hasard à un ennemi tout juste créé ; renvoie la mutation (ou null).
export function maybeMutate(state, enemy, rng, cycle = 0) {
  if (enemy.boss || enemy.elite || enemy.splitChild) return null;
  if (rng.next() >= mutationChance(state, cycle)) return null;
  const m = MUTATIONS[Math.floor(rng.next() * MUTATIONS.length)];
  enemy.mutation = m.id;
  enemy.hp *= MUTATION_RULES.hpMultiplier;
  enemy.maxHp *= MUTATION_RULES.hpMultiplier;
  enemy.gold *= MUTATION_RULES.goldMultiplier;
  if (m.id === 'giant') {
    enemy.hp *= 3;
    enemy.maxHp *= 3;
    enemy.speed *= 0.7;
  }
  if (m.id === 'frenzied') {
    enemy.attackInterval /= 2;
    enemy.attackTimer /= 2;
  }
  return m;
}

// Dégâts reçus (cuirasse).
export function mutationDamageTaken(enemy, damage) {
  return enemy.mutation === 'armored' && enemy.hp > enemy.maxHp * 0.5 ? damage * 0.5 : damage;
}

// Régénération (appelée à chaque pas pour chaque ennemi).
export function mutationTick(enemy, dt) {
  if (enemy.mutation === 'regen' && enemy.hp > 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.04 * dt);
}

// Vampirisme (quand il frappe le héros).
export function mutationOnHit(enemy, damage) {
  if (enemy.mutation === 'vampire') enemy.hp = Math.min(enemy.maxHp, enemy.hp + damage * 3);
}

// Dédoublement : deux petits doubles (40 % des PV max, sans mutation) prennent sa place.
export function splitChildren(enemy, nextId) {
  if (enemy.mutation !== 'split') return [];
  return [6, 18].map((dx, i) => ({
    ...enemy,
    id: nextId + i,
    mutation: null,
    splitChild: true,
    hp: enemy.maxHp * 0.4,
    maxHp: enemy.maxHp * 0.4,
    gold: enemy.gold / 6,
    x: enemy.x + dx,
    prevX: enemy.x + dx,
    engaged: false,
    attackTimer: enemy.attackInterval,
  }));
}
