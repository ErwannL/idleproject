// Mécaniques de boss (v9.0.6) : certains boss demandent une préparation différente, pour que chaque
// statistique ait son moment (le combat reste automatique ; on prépare équipement, classe et passifs avant).
//   Carapace   : encaisse beaucoup au début, chaque coup reçu l'use → vitesse d'attaque, coups multiples.
//   Invocatrice: appelle des serviteurs qui la protègent → dégâts de zone, perçants, en chaîne.
//   Fournaise  : ses dégâts montent tout au long du combat → PV, régénération, vol de vie.
//   Désespoir  : plus dangereux sous la moitié de ses PV → armure, PV.
export const TRAITS = {
  armored: {
    name: 'Carapace', color: '#b8c8e0', counter: 'Vitesse d\'attaque, coups multiples',
    text: 'encaisse −60 % des dégâts ; chaque coup reçu use sa carapace de 3 points',
    shell: 60, wear: 3,
  },
  summoner: {
    name: 'Invocatrice', color: '#9fe6ff', counter: 'Dégâts de zone, perçants ou en chaîne',
    text: 'fait surgir 2 serviteurs toutes les 12 s, qui se placent devant elle',
    every: 12, count: 2, minionHpPct: 3, minion: 'wraith',
  },
  escalate: {
    name: 'Fournaise', color: '#ff7a3a', counter: 'PV, régénération, vol de vie',
    text: 'ses dégâts augmentent de 6 % toutes les 3 s de combat',
    stepSeconds: 3, stepPct: 6,
  },
  desperate: {
    name: 'Désespoir', color: '#ff4a6a', counter: 'Armure, PV',
    text: 'sous 50 % de ses PV, frappe 60 % plus fort et 30 % plus vite',
    below: 0.5, damage: 1.6, speed: 1.3,
  },
};

export const BOSS_TRAITS = {
  // Golems
  mini_crystal_golem: 'armored', mid_lava_golem: 'armored', magma_colossus: 'armored', boss_sky_titan: 'armored',
  // Invocateurs
  spectral_queen: 'summoner', hard_necromancer: 'summoner', crypt_archlich: 'summoner', boss_void_emperor: 'summoner',
  // Dragons et feu
  ash_dragon: 'escalate', boss_phoenix: 'escalate', hard_flame_djinn: 'escalate', frost_wyrm: 'escalate',
  // Démons
  demon_king: 'desperate', hard_demon_general: 'desperate', mid_hellhound: 'desperate', obsidian_tyrant: 'desperate',
};

export const bossTrait = (type) => TRAITS[BOSS_TRAITS[type]] ?? null;

// Dégâts reçus par le boss (carapace qui s'use à chaque coup).
export function traitDamageTaken(enemy, damage) {
  if (enemy.trait !== 'armored') return damage;
  const shell = enemy.shell ?? TRAITS.armored.shell;
  enemy.shell = Math.max(0, shell - TRAITS.armored.wear);
  return damage * (1 - shell / 100);
}

// Multiplicateurs de l'attaque du boss : { damage, speed }.
export function traitAttack(enemy) {
  if (enemy.trait === 'escalate') {
    const t = TRAITS.escalate;
    return { damage: 1 + (t.stepPct / 100) * Math.floor((enemy.age ?? 0) / t.stepSeconds), speed: 1 };
  }
  if (enemy.trait === 'desperate' && enemy.hp < enemy.maxHp * TRAITS.desperate.below) {
    return { damage: TRAITS.desperate.damage, speed: TRAITS.desperate.speed };
  }
  return { damage: 1, speed: 1 };
}
