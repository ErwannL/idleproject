// Mécaniques de boss (v9.0.6) : certains boss demandent une préparation différente, pour que chaque
// statistique ait son moment (le combat reste automatique ; on prépare équipement, classe et passifs avant).
//   Carapace   : encaisse beaucoup au début, chaque coup reçu l'use → vitesse d'attaque, coups multiples.
//   Invocatrice: appelle des serviteurs qui la protègent → dégâts de zone, perçants, en chaîne.
//   Fournaise  : ses dégâts montent tout au long du combat → PV, régénération, vol de vie.
//   Désespoir  : plus dangereux sous la moitié de ses PV → armure, PV.
export const TRAITS = {
  armored: {
    name: 'Carapace', color: '#b8c8e0', counter: 'Vitesse d\'attaque, coups multiples',
    text: 'encaisse −60 % des dégâts ; chaque coup reçu use sa carapace de 1,5 point',
    shell: 60, wear: 1.5, // étape 4 : 3 → 1,5 — il faut ~40 coups : la vitesse d'attaque fait vraiment la différence
  },
  summoner: {
    name: 'Invocatrice', color: '#9fe6ff', counter: 'Dégâts de zone, perçants ou en chaîne',
    text: 'fait surgir 2 serviteurs toutes les 12 s, qui se placent devant elle',
    every: 12, count: 2, maxAlive: 4, minionHpPct: 3, minion: 'wraith',
  },
  escalate: {
    name: 'Fournaise', color: '#ff7a3a', counter: 'PV, régénération, vol de vie',
    text: 'ses dégâts augmentent de 6 % toutes les 3 s de combat (jusqu\'à ×2,5)',
    stepSeconds: 3, stepPct: 6, maxDamage: 2.5, // étape 4 : plafonné (la rage s'en charge déjà)
  },
  desperate: {
    name: 'Désespoir', color: '#ff4a6a', counter: 'Armure, PV',
    text: 'sous 50 % de ses PV, frappe 60 % plus fort et 30 % plus vite — sauf contre une armure solide (40 % l\'annule)',
    below: 0.5, damage: 1.6, speed: 1.3, armorNullifies: 40, // étape 4 : l'armure devient le vrai contre
  },
  // v9.2.0 (monde marin) : Marée — le boss se régénère tant qu'aucun coup critique ne le touche.
  tidal: {
    name: 'Marée', color: '#4ad0ff', counter: 'Coups critiques',
    text: 'régénère 1 % de ses PV max par seconde ; un coup critique arrête la marée 3 s',
    regenPct: 1, critPause: 3,
  },
};

// v9.2.0 (monde marin) : serviteurs propres à un boss invocateur (sinon TRAITS.summoner.minion).
export const BOSS_MINIONS = { mid_kraken: 'sea_jelly' };

export const BOSS_TRAITS = {
  // Golems
  mini_crystal_golem: 'armored', mid_lava_golem: 'armored', magma_colossus: 'armored', boss_sky_titan: 'armored',
  // Invocateurs
  spectral_queen: 'summoner', hard_necromancer: 'summoner', crypt_archlich: 'summoner', boss_void_emperor: 'summoner',
  // Dragons et feu
  ash_dragon: 'escalate', boss_phoenix: 'escalate', hard_flame_djinn: 'escalate', frost_wyrm: 'escalate',
  // Démons
  demon_king: 'desperate', hard_demon_general: 'desperate', mid_hellhound: 'desperate', obsidian_tyrant: 'desperate',
  // v9.2.0 (monde marin) : Royaume englouti — une mécanique par boss, chacune avec son contre.
  mini_crab_king: 'armored', mid_kraken: 'summoner', hard_megalodon: 'desperate', boss_leviathan: 'tidal',
};

// v9.2.0 (monde marin) : Marée (régénération), appelée à chaque pas ; `critAt` = moment du dernier coup critique reçu.
export function tickTide(world, dt) {
  const t = TRAITS.tidal;
  for (const e of world.enemies) {
    if (e.trait !== 'tidal' || e.hp <= 0 || e.hp >= e.maxHp) continue;
    if (e.critAt !== undefined && world.time - e.critAt < t.critPause) continue;
    e.hp = Math.min(e.maxHp, e.hp + (e.maxHp * t.regenPct * dt) / 100);
  }
}

export const bossTrait = (type) => TRAITS[BOSS_TRAITS[type]] ?? null;

// Dégâts reçus par le boss (carapace qui s'use à chaque coup).
export function traitDamageTaken(enemy, damage) {
  if (enemy.trait !== 'armored') return damage;
  const shell = enemy.shell ?? TRAITS.armored.shell;
  enemy.shell = Math.max(0, shell - TRAITS.armored.wear);
  return damage * (1 - shell / 100);
}

// Multiplicateurs de l'attaque du boss : { damage, speed }. heroArmor : armure du héros en % (contre de Désespoir).
export function traitAttack(enemy, heroArmor = 0) {
  if (enemy.trait === 'escalate') {
    const t = TRAITS.escalate;
    return { damage: Math.min(t.maxDamage, 1 + (t.stepPct / 100) * Math.floor((enemy.age ?? 0) / t.stepSeconds)), speed: 1 };
  }
  if (enemy.trait === 'desperate' && enemy.hp < enemy.maxHp * TRAITS.desperate.below) {
    const t = TRAITS.desperate;
    const left = Math.max(0, 1 - heroArmor / t.armorNullifies); // part du bonus qui passe l'armure
    return { damage: 1 + (t.damage - 1) * left, speed: 1 + (t.speed - 1) * left };
  }
  return { damage: 1, speed: 1 };
}
