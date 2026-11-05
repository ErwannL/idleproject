// v9.2.3 : animations dessinées image par image (PixelLab) des alliés — héros (chevalier et 8 apparences, une
// attaque par classe tenant l'arme de la classe), compagnons et familiers : marche, attaque, nage.
// Les images (src/render/art-anim-allies.js, tools/art/pixellab_allies.py) sont ajoutées aux SPRITES au chargement.
// Chaque animation porte son décalage (ox, oy) par rapport au sprite de jeu : pieds et cadre stables entre images.
import { ALLY_ANIM_ART, ALLY_ANIM_PALS, ALLY_ANIMS } from './art-anim-allies.js';
import { SPRITES, expandRow } from './sprites.js';

// Poids du bundle : une ligne vide ('') reprend la même ligne de l'image précédente de l'animation.
export function decodeAllyFrames(art = ALLY_ANIM_ART) {
  const out = {};
  for (const anims of Object.values(ALLY_ANIMS)) {
    for (const a of Object.values(anims)) {
      let prev = null;
      for (const f of a.frames) {
        const rows = art[f].rows.map((r, y) => (r === '' && prev ? prev[y] : expandRow(r)));
        out[f] = { ...art[f], rows, pal: ALLY_ANIM_PALS[art[f].pr] };
        prev = rows;
      }
    }
  }
  return out;
}
for (const [k, v] of Object.entries(decodeAllyFrames())) if (!SPRITES[k]) SPRITES[k] = v;

export { ALLY_ANIMS };

// Arme de génération de chaque classe (sprite de l'arme tenue dans les images d'attaque) : si le héros porte une
// autre arme de sa classe (espadon, arc long…), l'attaque reste celle d'origine (arme composée par le jeu).
export const HERO_ANIM_WEAPON = {
  knight: 'sword', archer: 'bow', pyromancer: 'staff', berserker: 'axe', lancer: 'spear', paladin: 'mace',
  assassin: 'dagger', crossbowman: 'crossbow', stormcaller: 'wand', necromancer: 'scythe',
};

// Moment de l'impact (fraction du geste) : corps à corps 0,09 s sur 0,3 s ; tirs et sorts partent au début du
// geste (le projectile est lancé à l'événement) ; gestes des compagnons : instants des effets de scene.allyGesture.
export const ALLY_HIT_K = { melee: 0.39, archer: 0.33, cast: 0.42, burst: 0.375, support: 0.35 };

// Image d'une animation à la phase k (0..1) : l'image du coup (hit) tombe exactement à la fraction hitK.
export function phaseFrame(anim, k, hitK = null) {
  const n = anim.frames.length;
  if (hitK === null || anim.hit === undefined) return Math.min(n - 1, Math.max(0, Math.floor(k * n)));
  const h = anim.hit;
  const i = k < hitK ? (k / hitK) * h : h + ((k - hitK) / (1 - hitK)) * (n - h);
  return Math.min(n - 1, Math.max(0, Math.floor(i)));
}

// Image d'une boucle (marche, nage) au temps t.
export function loopFrame(anim, t, rate = 1) {
  return anim.frames[Math.floor(t * anim.fps * rate) % anim.frames.length];
}

export const heroAnimKey = (palette) => `hero_${palette?.skin ?? 'knight'}`;

// Attaque du héros pour sa classe et son arme : null si l'arme portée n'est pas celle des images.
export function heroAttackAnim(palette, classId, weaponSprite) {
  if (weaponSprite && HERO_ANIM_WEAPON[classId] !== weaponSprite) return null;
  return ALLY_ANIMS[heroAnimKey(palette)]?.[`attack_${classId}`] ?? null;
}

// Image animée du héros pour l'instant présent, ou null (pose composée par le jeu : coup reçu, victoire, sort
// d'une classe d'armes, arme différente de celle des images…). `mem` garde l'instant du dernier tir (visée tenue).
// o : { palette, classId, style, weapon (sprite), walking, engaged, attack, shoot, aim, cast, hurt, victory,
//       time, attackTime, castTime }
export function pickHeroAnim(o, mem) {
  const set = ALLY_ANIMS[heroAnimKey(o.palette)];
  if (!set || o.hurt > 0 || o.victory > 0) return null;
  const pick = (anim, i, back = false) => ({ name: anim.frames[i], ox: anim.ox, oy: anim.oy, back });
  const atk = heroAttackAnim(o.palette, o.classId, o.weapon);
  const fire = o.shoot > 0 ? o.shoot / o.attackTime : o.aim > 0 ? o.aim / o.attackTime : o.cast > 0 && o.style === 'magic' ? o.cast / o.castTime : 0;
  if (atk && o.attack > 0 && o.style !== 'ranged' && o.style !== 'magic') {
    return pick(atk, phaseFrame(atk, 1 - o.attack / o.attackTime, 0.3));
  }
  if (atk && fire > 0) {
    mem.fired = o.time;
    const k = 1 - fire;
    return pick(atk, Math.min(atk.frames.length - 1, atk.hit + Math.floor(k * (atk.frames.length - atk.hit))));
  }
  if (o.cast > 0 || o.attack > 0) return null;
  if (atk && o.engaged && (o.style === 'ranged' || o.style === 'magic')) {
    // Entre deux tirs : l'arc se bande (images avant le lâcher), puis la visée est tenue.
    const since = o.time - (mem.fired ?? -9);
    return pick(atk, Math.max(0, Math.min(atk.hit - 1, Math.floor(since * atk.fps * 0.6))));
  }
  if (o.walking && set.walk) return pick(set.walk, Math.floor(o.time * set.walk.fps) % set.walk.frames.length, true);
  return null;
}

// Compagnon ou familier : image animée (marche, attaque pendant un geste, nage) ou null.
// o : { sprite, walking, swimming, gesture: {kind, k} | null, time, seed }
export function pickAllyAnim(o) {
  const set = ALLY_ANIMS[o.sprite];
  if (!set) return null;
  const pick = (anim, name, kind) => ({ name, ox: anim.ox, oy: anim.oy, kind, anim });
  if (o.gesture && set.attack) return pick(set.attack, set.attack.frames[phaseFrame(set.attack, o.gesture.k, ALLY_HIT_K[o.gesture.kind] ?? 0.35)], 'attack');
  if (o.swimming && set.swim) return pick(set.swim, loopFrame(set.swim, o.time + o.seed, o.walking ? 1 : 0.7), 'swim');
  if (o.swimming || o.gesture) return null;
  if (set.walk && (o.walking || o.always)) return pick(set.walk, loopFrame(set.walk, o.time + o.seed, o.walking ? 1 : 0.6), 'walk');
  return null;
}
