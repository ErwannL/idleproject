// v10.16 : « un vrai combat de boss ». Règles d'affichage pures (sans canvas), utilisées par scene.js et testées sous
// Node (tests/v1016-boss.test.js). Uniquement de l'affichage : le moteur et les dégâts ne changent pas.
//   A1 : contre un boss, le flash blanc complet est rare (critique, au plus toutes les 0,25 s, très court) ; les autres
//        coups donnent une teinte légère (≤ 35 %) de la couleur de l'élément et un petit tremblement.
//   A2 : impact propre à chaque compagnon (plus de croissant fx_slash).
//   A3 : combo du héros contre un boss, en cycle de 4 (taille haute, taille basse, estoc, coup final).
//   A4 : montée en tension quand le boss résiste (> 8 s) : compteur de combo, « Garde brisée ! » toutes les 10 s.
//   A5 : chiffres de dégâts en éventail, regroupés par source au-delà de 6 par seconde.

// --- A1 : flash et teinte ---
export const BOSS_FLASH_GAP = 0.25; // au plus un flash blanc complet toutes les 0,25 s
export const BOSS_FLASH_TIME = 0.035; // ≈ 2 images : un éclair, pas une silhouette
export const TINT_TIME = 0.1;
export const TINT_ALPHA = 0.3; // ≤ 0,35
export const JITTER_TIME = 0.08;
const WHITE = new Set(['#ffffff', '#fff', '#e8e0c8', '#f0e6d0']);
export const TINT_DEFAULT = '#ffd8b0'; // coup sans élément : teinte chaude légère

// Marque un coup sur l'ennemi : flash blanc (fx.hit) pour un ennemi ordinaire ; contre un boss, flash seulement sur
// un critique espacé, sinon teinte + tremblement. Renvoie 'flash' ou 'tint'.
export function markHit(fx, time, { boss = false, crit = false, color = null } = {}) {
  if (!boss) { fx.hit = crit ? 0.13 : 0.08; return 'flash'; }
  if (crit && time - (fx.flashAt ?? -9) >= BOSS_FLASH_GAP) {
    fx.hit = BOSS_FLASH_TIME; fx.flashAt = time; fx.jit = JITTER_TIME;
    return 'flash';
  }
  fx.tint = TINT_TIME;
  fx.tintColor = color && !WHITE.has(color.toLowerCase()) ? color : TINT_DEFAULT;
  fx.jit = JITTER_TIME;
  return 'tint';
}
// Décalage du tremblement (±1 px), alterné à chaque image.
export const jitterOf = (fx, frame) => (fx.jit > 0 ? (frame % 2 ? 1 : -1) : 0);
// Opacité de la teinte (0 à TINT_ALPHA), qui s'efface.
export const tintAlpha = (fx) => (fx.tint > 0 ? TINT_ALPHA * Math.min(1, fx.tint / TINT_TIME) : 0);

// --- A2 : impact propre à chaque compagnon ---
const SHIELD = new Set(['squire', 'lancer', 'azure_paladin', 'paladin', 'grombar', 'sylvan_guardian', 'jade_turtle', 'golem']);
export function impactOf(companion, kind, alt = false) {
  const id = companion?.id;
  if (companion?.kind && companion.kind !== 'ally') return { vfx: alt ? 'sk_bite' : 'sk_claw', size: 0.7, shards: '#ffe0c0', count: 4 };
  if (kind === 'archer') return { vfx: 'hit_arrow', size: 0.8, shards: '#e8e0c8', count: 3 };
  if (kind === 'cast') return { vfx: 'v_impact', size: 0.7, shards: companion?.fx ?? '#ffffff', count: 5 };
  if (SHIELD.has(id)) return { vfx: 'sk_shield_bash', size: 0.6, shards: '#7fb0ff', count: 6 };
  return { vfx: 'hit_blunt', size: 0.85, shards: '#ff5a4a', count: 6, dust: true };
}

// --- A3 : combo du héros ---
export const COMBO_STEPS = 4;
export const COMBO_RESET = 1.2; // au-delà de 1,2 s sans coup, le cycle repart du premier coup
export const COMBO_NAMES = { melee: ['high', 'low', 'thrust', 'finisher'], archer: ['arrow', 'arrow', 'double', 'charged'], cast: ['spell', 'spell', 'salvo', 'big'] };

// Avance du héros pendant le combo : 0, 3, 6 puis 9 px (entre 6 et 10 px au coup final) ; revient ensuite.
export const COMBO_ADVANCE = [0, 3, 6, 9];

// Pose de chaque coup (k = avancée du geste 0..1) : décalage horizontal, décalage vertical (négatif = saut), accroupi.
export function comboPose(step, k) {
  const arc = Math.sin(Math.min(1, Math.max(0, k)) * Math.PI);
  switch (step) {
    case 1: return { dx: 1, dy: Math.round(2 * arc), crouch: 2 }; // taille basse : le héros se baisse (2 px)
    case 2: return { dx: Math.round(4 * arc), dy: 0, crouch: 0 }; // estoc : petit pas en avant
    case 3: return { dx: Math.round(3 * arc), dy: -Math.round(12 * arc), crouch: 0 }; // coup final : saut, frappe descendante
    default: return { dx: 0, dy: 0, crouch: 0 }; // taille haute
  }
}

// --- A4 : tension ---
export const TENSION_AFTER = 8; // s sur le même boss
export const GUARD_EVERY = 10; // « Garde brisée ! » toutes les 10 s (10 s, 20 s, 30 s… : toujours après les 8 s de tension)
export const GUARD_TIME = 1; // le boss titube 1 s ; dégâts de cette seconde réunis en un seul chiffre
export const LOW_HP = 0.2;
export const KILL_SLOWMO = 0.4;

// État du combat de boss pour la scène (un objet par scène).
export class BossFeel {
  constructor() { this.reset(null, 0); }
  reset(bossId, time) {
    this.bossId = bossId; this.since = time; this.step = -1; this.lastStrike = -9; this.combo = 0;
    this.nextGuard = time + Math.max(GUARD_EVERY, TENSION_AFTER); this.guardUntil = -9; this.guardSum = 0; this.guardX = 0;
    this.strikes = [];
  }
  // À chaque image : boss courant (ou null). Renvoie les événements à afficher : 'guard' (début), 'guardEnd' (fin).
  update(time, boss) {
    const id = boss?.id ?? null;
    if (id !== this.bossId) this.reset(id, time);
    const out = [];
    if (id === null) return out;
    if (this.guardUntil > 0 && time >= this.guardUntil) { out.push({ type: 'guardEnd', sum: this.guardSum, x: this.guardX }); this.guardUntil = -9; this.guardSum = 0; }
    if (time >= this.nextGuard) { this.nextGuard += GUARD_EVERY; this.guardUntil = time + GUARD_TIME; this.guardSum = 0; out.push({ type: 'guard' }); }
    if (time - this.lastStrike > COMBO_RESET) this.combo = 0;
    return out;
  }
  tension(time) { return this.bossId !== null && time - this.since >= TENSION_AFTER; }
  guarding(time) { return time < this.guardUntil; }
  // Absorbe un chiffre pendant « Garde brisée » (renvoie vrai : ne pas l'afficher seul).
  absorb(time, damage, x) {
    if (!this.guarding(time) || !Number.isFinite(damage)) return false;
    this.guardSum += damage; this.guardX = x; return true;
  }
  // Coup du héros contre le boss : renvoie l'étape du combo (0..3).
  strike(time) {
    this.step = time - this.lastStrike > COMBO_RESET ? 0 : (this.step + 1) % COMBO_STEPS;
    this.combo = time - this.lastStrike > COMBO_RESET ? 1 : this.combo + 1;
    this.lastStrike = time;
    this.strikes.push(time); if (this.strikes.length > 60) this.strikes.shift();
    return this.step;
  }
  // Avance du héros (px) : suit le combo, revient en douceur après la dernière frappe.
  advance(time) {
    if (this.step < 0) return 0;
    const back = Math.max(0, 1 - (time - this.lastStrike) / 0.5);
    return Math.round(COMBO_ADVANCE[this.step] * back);
  }
}

// --- A5 : chiffres en éventail ---
export const GROUP_RATE = 6; // au-delà de 6 chiffres par seconde d'une même source, ils se regroupent
// n-ième chiffre récent : décalage horizontal alterné (gauche/droite, de plus en plus loin) et montée variable.
export function fanOf(n) {
  const side = n % 2 ? 1 : -1;
  const step = Math.ceil(n / 2);
  return { dx: side * Math.min(4, step) * 6, rise: 0.75 + ((n * 7) % 5) * 0.12, drift: side * (4 + (n % 3) * 3) };
}
// Faut-il regrouper ce chiffre avec le précédent de la même source ? (times : instants récents de cette source)
export function shouldGroup(times, now) {
  return times.filter((t) => now - t < 1).length >= GROUP_RATE;
}
