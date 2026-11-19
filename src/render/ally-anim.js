import { FROZEN_ATTACK } from '../data/ally-style.js';
// v9.2.3 : animations dessinées image par image (PixelLab) des alliés — héros (chevalier et 8 apparences, une
// attaque par classe tenant l'arme de la classe), compagnons et familiers : marche, attaque, nage.
// Les images (src/render/art-anim-allies.js, tools/art/pixellab_allies.py) sont ajoutées aux SPRITES au chargement.
// Chaque animation porte son décalage (ox, oy) par rapport au sprite de jeu : pieds et cadre stables entre images.
import { ALLY_ANIM_ART, ALLY_ANIM_PALS, ALLY_ANIMS } from './art-anim-allies.js';
import { SPRITES, expandRow } from './sprites.js';
import { KNIGHT_HEAD } from './knight-gear.js'; // v9.2.4 : tête suivie (casque porté)

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
// v9.2.5 : tête du chevalier réparée : l'effacement de l'arme de génération (tools/art/weapon_anchor.py) mordait
// parfois sur le visage (attaque du chevalier, images 1 et 2 : 35 % de la tête manquante). Les trous de la tête
// suivie (masque de la vue de repos, tourné) sont rebouchés avec les pixels de la vue de repos.
export function repairKnightHeads(frames) {
  const set = ALLY_ANIMS.hero_knight;
  const ref = set?.attack_knight, f0 = ref && frames[ref.frames[0]];
  if (!f0 || !KNIGHT_HEAD.mask) return 0;
  const [px, py] = KNIGHT_HEAD.pivot;
  let fixed = 0;
  for (const [k, a] of Object.entries(set)) {
    if (k === 'swim') continue;
    a.frames.forEach((name, i) => {
      const h = KNIGHT_HEAD.heads[k]?.[i], f = frames[name];
      if (!h || !f || f.pal !== f0.pal) return;
      const rad = (h[2] * Math.PI) / 180, c = Math.cos(rad), sn = Math.sin(rad);
      const rows = f.rows.map((r) => [...r]);
      let n = 0;
      for (const [u, v] of KNIGHT_HEAD.mask) {
        const x = Math.round(h[0] + u * c - v * sn) - a.ox, y = Math.round(h[1] + u * sn + v * c) - a.oy;
        if (!rows[y] || rows[y][x] !== '.') continue;
        const ch = f0.rows[py + v - ref.oy]?.[px + u - ref.ox];
        if (ch && ch !== '.') { rows[y][x] = ch; n++; }
      }
      if (n) { f.rows = rows.map((r) => r.join('')); fixed++; }
    });
  }
  return fixed;
}
const DECODED = decodeAllyFrames();
repairKnightHeads(DECODED);
for (const [k, v] of Object.entries(DECODED)) if (!SPRITES[k]) SPRITES[k] = v;

// v9.7.1 (lot B) : animations supplémentaires (repos, compétence, ultime, coup reçu, victoire) chargées à la demande,
// après le démarrage : ajoutées à ALLY_ANIMS et aux SPRITES dès qu'elles arrivent (sinon : gestes d'avant).
export const allyExtraReady = (typeof window === 'undefined' ? Promise.resolve(null) : import('./art-anim-allies-extra.js'))
  .then((m) => {
    if (!m) return false;
    const frames = {};
    for (const anims of Object.values(m.ALLY_ANIMS)) for (const a of Object.values(anims)) {
      let prev = null;
      for (const f of a.frames) {
        const rows = m.ALLY_ANIM_ART[f].rows.map((r, y) => (r === '' && prev ? prev[y] : expandRow(r)));
        frames[f] = { ...m.ALLY_ANIM_ART[f], rows, pal: m.ALLY_ANIM_PALS[m.ALLY_ANIM_ART[f].pr] };
        prev = rows;
      }
    }
    for (const [k, v] of Object.entries(frames)) if (!SPRITES[k]) SPRITES[k] = v;
    for (const [key, anims] of Object.entries(m.ALLY_ANIMS)) Object.assign((ALLY_ANIMS[key] ??= {}), anims);
    return true;
  })
  .catch(() => false);

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

// v9.2.4 : chevalier (sans apparence) dont l'équipement visible (casque, armure) diffère du chevalier PixelLab : le
// jeu pose cet équipement sur les images (pixel.js knightGearCanvas) au lieu de montrer le plumet et l'acier de base.
export const heroWearsGear = (palette, equipment) => !palette?.skin && Boolean(equipment?.helmet || equipment?.armor);

// v9.2.4 : tête du chevalier à l'image i d'une de ses animations : [x, y, angle] (coin du sprite de jeu), ou null.
const KNIGHT_KEYS = new Map(Object.entries(ALLY_ANIMS.hero_knight ?? {}).map(([k, a]) => [a, k]));
export const KNIGHT_PIVOT = KNIGHT_HEAD.pivot, KNIGHT_NECK = KNIGHT_HEAD.neck;
export function knightHead(anim, i) {
  const k = KNIGHT_KEYS.get(anim);
  return k ? KNIGHT_HEAD.heads[k]?.[i] ?? null : null;
}

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
  // v9.2.4 : head = tête suivie (chevalier seulement) pour y poser le casque porté (pixel.js knightGearCanvas).
  const pick = (anim, i) => ({ name: anim.frames[i], ox: anim.ox, oy: anim.oy, weapon: weaponPose(anim, i), anim, head: knightHead(anim, i) });
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
  // v9.7.1 (lot B) : animations dédiées quand elles existent — ultime (ultimate), soutien et zone (cast), coup reçu
  // (hurt), victoire (victory) ; sinon l'attaque (attack) comme avant.
  if (o.gesture) {
    const g = o.gesture.kind;
    // v10.0 (9.1) : un mage lance ses sorts avec l'animation de sort (13 images), jamais l'attaque ; v10.0 (9.2) : une
    // attaque dessinée figée est remplacée par le sort (FROZEN_ATTACK).
    const frozen = FROZEN_ATTACK.has(o.sprite);
    const anim = (g === 'ultimate' && (set.ultimate ?? set.cast)) || ((g === 'support' || g === 'burst' || g === 'ultimate' || g === 'cast' || frozen) && set.cast) || set.attack;
    if (anim) return pick(anim, anim.frames[phaseFrame(anim, o.gesture.k, ALLY_HIT_K[g] ?? 0.35)], anim === set.attack ? 'attack' : 'cast');
  }
  if (o.hurt > 0 && set.hurt) return pick(set.hurt, set.hurt.frames[Math.min(set.hurt.frames.length - 1, Math.floor((1 - o.hurt) * set.hurt.frames.length))], 'hurt');
  if (o.victory && set.victory) return pick(set.victory, loopFrame(set.victory, o.time + o.seed, 1), 'victory');
  if (o.swimming && set.swim) return pick(set.swim, loopFrame(set.swim, o.time + o.seed, o.walking ? 1 : 0.7), 'swim');
  if (o.swimming || o.gesture) return null;
  // v9.2.7 : un volant ne joue jamais de cycle de pas : son vol stationnaire (ailes) s'il existe, sinon ses images d'ailes.
  if (set.hover) return pick(set.hover, loopFrame(set.hover, o.time + o.seed, o.walking ? 1.2 : 1), 'hover');
  if (SPRITES[o.sprite]?.gait === 'fly') return null;
  if (set.walk && (o.walking || o.always)) return pick(set.walk, loopFrame(set.walk, o.time + o.seed, o.walking ? 1 : 0.6), 'walk');
  // v9.7.1 (lot A/B) : équipe arrêtée devant l'ennemi → pose de repos animée (respiration, cape) si elle existe.
  if (set.idle) return pick(set.idle, loopFrame(set.idle, o.time + o.seed, 1), 'idle');
  return null;
}
