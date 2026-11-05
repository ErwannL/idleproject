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

// Moment de l'impact (fraction du geste) : corps à corps 0,09 s sur 0,3 s ; tirs et sorts partent au début du
// geste (le projectile est lancé à l'événement) ; gestes des compagnons : instants des effets de scene.allyGesture.
export const ALLY_HIT_K = { melee: 0.39, archer: 0.33, cast: 0.42, burst: 0.375, support: 0.35 };

// Image d'une animation à la phase k (0..1) : l'image du coup (hit) tombe exactement à la fraction hitK.
export function phaseFrame(anim, k, hitK = null) {
  const n = anim.frames.length;
  if (hitK === null || anim.hit === undefined) return Math.min(n - 1, Math.max(0, Math.floor(k * n)));
  const h = anim.hit;
  // v9.2.4 : cadence constante. L'ancien calage (avant le coup : h images en hitK, après : le reste) faisait
  // alterner 1 et 3 images d'écran à 60 i/s (élan en accéléré, suite au ralenti). Ici les images défilent au même
  // rythme (n par geste) et l'image du coup tombe toujours à hitK : le début (repos) est tenu un instant, ou au
  // plus 1 image d'élan est sautée ; la fin tient la dernière image (retour au repos).
  const i0 = Math.min(1, h - hitK * n);
  const i = k < hitK ? i0 + ((h - i0) * k) / hitK : h + (k - hitK) * n;
  return Math.min(n - 1, Math.max(0, Math.floor(i)));
}

// Image d'une boucle (marche, nage) au temps t.
export function loopFrame(anim, t, rate = 1) {
  return anim.frames[Math.floor(t * anim.fps * rate) % anim.frames.length];
}

// v9.2.4 : chevalier (sans apparence) dont l'équipement visible diffère du chevalier des animations PixelLab.
export const heroWearsGear = (palette, equipment) => !palette?.skin && Boolean(equipment?.helmet || equipment?.armor);

export const heroAnimKey = (palette) => `hero_${palette?.skin ?? 'knight'}`;

// v9.2.3 : attaque du héros pour sa classe. L'arme a été retirée des images (tools/art/weapon_anchor.py) : le jeu
// pose l'arme vraiment équipée sur la prise de chaque image (entrée w), donc toute arme suit l'animation.
export function heroAttackAnim(palette, classId) {
  return ALLY_ANIMS[heroAnimKey(palette)]?.[`attack_${classId}`] ?? null;
}

// v9.2.3 : prise de l'arme pour l'image i d'une animation : { x, y, deg, back } par rapport au coin du sprite de jeu
// (cadre de heroComposite). Marche : main suivie, arme droite comme au repos (pas de saut à l'arrêt).
export function weaponPose(anim, i) {
  const w = anim?.w?.[i];
  if (!w) return null;
  return { x: w[0], y: w[1], deg: w[2] ?? 0, back: !!w[3] };
}

// Image animée du héros pour l'instant présent, ou null (pose composée par le jeu : coup reçu, victoire, sort
// d'une classe d'armes…). `mem` garde l'instant du dernier tir (visée tenue). Résultat : { name, ox, oy, weapon }
// (weapon : prise de l'arme à dessiner, voir weaponPose).
// o : { palette, equipment, classId, style, weapon (sprite), walking, engaged, attack, shoot, aim, cast, hurt, victory,
//       time, attackTime, strikeTime (v9.2.4 : durée du geste en cours), castTime }  (weapon n'est plus utilisé : v9.2.3, arme séparée du corps)
export function pickHeroAnim(o, mem) {
  const set = ALLY_ANIMS[heroAnimKey(o.palette)];
  if (!set || o.hurt > 0 || o.victory > 0) return null;
  // v9.2.4 : le chevalier PixelLab porte le casque à plumet et l'armure de base. Avec un casque ou une armure
  // équipés (casque à cornes, auréole…), il remplaçait l'allure du joueur pendant la marche et la frappe : le
  // corps composé (équipement visible) est gardé dans toutes les poses, comme au repos.
  if (heroWearsGear(o.palette, o.equipment)) return null;
  const pick = (anim, i) => ({ name: anim.frames[i], ox: anim.ox, oy: anim.oy, weapon: weaponPose(anim, i) });
  const atk = heroAttackAnim(o.palette, o.classId);
  const fire = o.shoot > 0 ? o.shoot / o.attackTime : o.aim > 0 ? o.aim / o.attackTime : o.cast > 0 && o.style === 'magic' ? o.cast / o.castTime : 0;
  if (atk && o.attack > 0 && o.style !== 'ranged' && o.style !== 'magic') {
    return pick(atk, phaseFrame(atk, 1 - o.attack / (o.strikeTime ?? o.attackTime), 0.3)); // v9.2.4 : durée réelle du geste
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
  // v9.2.4 : glissade et sauts gardent les poses composées (sinon la marche dessinée et le repos alternaient
  // plusieurs fois par seconde) ; la marche suit la cadence du monde.
  if (o.walking && set.walk && (o.gait ?? 'walk') === 'walk') return pick(set.walk, Math.floor(o.time * set.walk.fps * (o.walkRate ?? 1)) % set.walk.frames.length);
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
