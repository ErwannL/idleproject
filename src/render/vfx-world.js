// v9.2.6 (deuxième vague) : VFX PixelLab des compétences, des mécaniques de boss, des malus d'environnement, des
// mutations, de l'ambiance de chaque monde et divers (combo, rage, bouclier, esquive, étourdissement, poison, vague,
// renforts). Lecteur commun : vfx.js. Les effets continus (auras, malus, ambiance) sont dessinés à chaque image depuis
// l'état du combat, sans entrer dans la liste d'effets ; les ponctuels passent par vfx().
// « Réduire les animations » : pas d'ambiance ; auras et malus figés sur leur première image, très pâles.
import { VFX, drawVfxFrame, projFrame, vfx, vfxReady } from './vfx.js';
import { currentEnvironment } from '../core/combat.js';
import { computeHeroStats } from '../core/stats.js';

// Effet de compétence (skill-fx.js) : où le jouer.
const SKILL_AT = {
  // Sur l'équipe (soutien)
  team: new Set(['prayer', 'dawn_prayer', 'blessing', 'divine_light', 'guardian_wings', 'rampart', 'holy_shield', 'war_howl', 'fury', 'frenzy',
    'instinct', 'fairy_heal', 'sap_of_life', 'harvest', 'war_cry', 'sacred_ray']),
  // Lancés devant le lanceur, vers la droite
  ahead: new Set(['flame_spray', 'ki_wave', 'pierce_arrow', 'ranger_shot', 'flash_strike', 'pierce']),
  // Au milieu de la file d'ennemis (zone)
  zone: new Set(['meteor', 'arrow_rain', 'eternal_winter', 'frost_storm', 'hellfire', 'eclipse', 'frost_nova', 'judgement', 'gold_rain', 'carnage', 'ash_crown']),
};
const STUNS = new Set(['shield_bash', 'taunt']);
const SHIELDS = new Set(['holy_shield', 'rampart', 'guardian_wings']);
// Effets qui couvrent le personnage : dessinés en transparence.
const SEE_THROUGH = { sk_holy_shield: 0.55, shield_absorb: 0.6, env_gloom: 0.6, env_thirst: 0.5, sk_guardian_wings: 0.75 };

// Point d'ancrage au sol (colonne, aura) ou au centre (impact) : selon la position de l'ancre dans l'image.
function placeY(name, G) {
  const e = VFX[name];
  return e && e.ay / e.h > 0.7 ? G + 1 : G - 16;
}

export function skillVfx(scene, name, c) {
  const key = `sk_${name}`;
  if (!VFX[key] || !vfxReady()) return; // sans atlas (tests sous Node) : rien
  const G = scene.groundY;
  const at = (fn) => scene.later(c.release ?? 0, fn);
  const opts = { alpha: SEE_THROUGH[key] ?? 1 };
  if (SKILL_AT.team.has(name)) {
    at(() => (name === 'guardian_wings' || name === 'rampart' ? [c.hero] : c.team.slice(0, 4)).forEach((x, i) => vfx(scene, key, x, placeY(key, G), { ...opts, delay: i * 0.05, size: i ? 0.8 : 1 })));
  } else if (SKILL_AT.ahead.has(name)) {
    at(() => vfx(scene, key, (c.src.x + c.front) / 2, G - 18, opts));
  } else if (SKILL_AT.zone.has(name)) {
    at(() => vfx(scene, key, c.mid, placeY(key, G), opts));
  } else {
    at(() => c.foes.slice(0, 3).forEach((f, i) => vfx(scene, key, f.x, placeY(key, G), { ...opts, delay: i * 0.06, size: i ? 0.8 : 1 })));
  }
  if (STUNS.has(name)) at(() => c.foes.slice(0, 3).forEach((f) => vfx(scene, 'stun_stars', f.x, G - 30, { life: 1.4, loop: true, follow: f.id, oy: -6, top: true })));
  if (SHIELDS.has(name)) scene.shieldUntil = scene.time + 4;
}

// Événements ponctuels (appelé par scene.handleEvent, x déjà à l'écran).
export function eventVfx(scene, event, world, heroX) {
  if (!vfxReady()) return;
  const G = scene.groundY;
  switch (event.type) {
    case 'heroMiss': // esquive : souffle d'un coup dans le vide
      vfx(scene, 'miss_whiff', event.x - 6, G - 18);
      break;
    case 'heroAttack':
      if (world.attackCount && world.attackCount % 10 === 0) vfx(scene, 'combo_burst', event.x - 4, G - 30, { delay: 0.1 }); // série de coups
      break;
    case 'heroHit':
      if (scene.shieldUntil > scene.time) vfx(scene, 'shield_absorb', heroX + 2, G - 16, { alpha: SEE_THROUGH.shield_absorb });
      break;
    case 'enemyHit': {
      const e = world.enemies.find((en) => en.id === event.enemyId);
      if (e?.boss && e.trait === 'armored') {
        const fx = scene.enemyFx.get(e.id);
        if (fx && (fx.chipAt ?? -9) < scene.time - 0.3) { fx.chipAt = scene.time; vfx(scene, 'boss_shell_chip', fx.edge ?? event.x, fx.sy + fx.sh * 0.5); }
      }
      break;
    }
    case 'bossSummon': { // serviteurs : portail, puis renfort qui se matérialise
      const x = Math.min(scene.width - 16, event.x);
      vfx(scene, 'boss_summon_portal', x, G - 20);
      vfx(scene, 'teleport', x, G + 1, { delay: 0.25 });
      break;
    }
    case 'challengeWave': case 'dungeonRoom': case 'towerFloor': case 'bossDefeated':
      vfx(scene, 'wave_clear', scene.width / 2, G - 50);
      break;
    case 'mutantSplit':
      vfx(scene, 'mut_split', event.x, G - 14);
      break;
    default:
      break;
  }
}

// Mutations : blocage et vol de vie (appelés par mutation-fx.js).
export function blockVfx(scene, x, y) { vfx(scene, 'mut_block', x, y); }
export function drainVfx(scene, x, y) { vfx(scene, 'mut_drain', x, y); }

// Ambiance : une ou deux particules par monde.
// v9.2.7 : seules les ambiances PixelLab lisibles restent (feuilles, lucioles, neige, bulles, éclair, étoile filante) ;
// sable, nuages, cristaux, spores, cendres, pollen et feux follets (traits ou pixels isolés illisibles) sont retirés :
// scene.drawAmbient dessine à la place des particules en forme (étincelles, traînées de sable, oiseaux en vol battu).
const AMBIENT = {
  forest: ['amb_leaves', 'amb_fireflies'], mountains: ['amb_snow'], cursed: ['amb_lightning'], swamp: ['amb_fireflies'],
  sky: ['amb_stars'], void: ['amb_stars'], ocean: ['amb_bubbles'], abyss: ['amb_bubbles'],
};
// Malus d'environnement visible sur le héros.
const ENV_FX = {
  forest: 'env_gloom', caves: 'env_crystal', desert: 'env_thirst', mountains: 'env_frost', cursed: 'env_curse', swamp: 'env_mud',
  sky: 'env_gust', volcano: 'env_lava', void: 'env_distort', ocean: 'env_pressure', abyss: 'env_corrupt',
};

function loopAt(scene, ctx, name, x, y, alpha = 1, size = 1, phase = 0) {
  const sober = scene.focus;
  drawVfxFrame(ctx, name, sober ? 0 : (projFrame(name, scene.time) + phase) % VFX[name].n, x, y, { alpha: alpha * (sober ? 0.35 : 1), size: size * (sober ? 0.8 : 1) });
}

// Dessin continu (chaque image), après les effets.
export function drawWorldVfx(scene, ctx, zone, world, heroX, state) {
  if (!vfxReady()) return;
  const G = scene.groundY;
  const id = zone?.id;
  // Ambiance : apparitions espacées, à des hauteurs de ciel au hasard.
  const amb = AMBIENT[id];
  if (amb && !scene.focus && scene.time > (scene.ambAt ?? 0)) {
    scene.ambAt = scene.time + 0.9 + Math.random() * 1.2;
    const name = amb[Math.floor(Math.random() * amb.length)];
    const rare = name === 'amb_lightning' || name === 'amb_stars';
    if (!rare || Math.random() < 0.3) vfx(scene, name, 20 + Math.random() * (scene.width - 40), 14 + Math.random() * (G - 80), // v9.2.7 : dans le ciel, jamais sur les personnages
       { loop: !rare, life: rare ? undefined : 2.4, alpha: 0.85 });
  }
  if (world.hero.dead) return;
  // Malus d'environnement sur le héros, seulement s'il agit encore (pas s'il est entièrement contré) ; plus il est
  // fort, plus l'effet est marqué. Relu deux fois par seconde.
  if (scene.time > (scene.envAt ?? 0)) {
    scene.envAt = scene.time + 0.5;
    const cur = state ? currentEnvironment(state) : null;
    scene.heroHpMax = state ? computeHeroStats(state).maxHp : 0; // PV max réels (rage sous 30 %)
    scene.envFx = cur && cur.pct > 0 ? { name: ENV_FX[id], k: 0.75 + 0.25 * Math.min(1, cur.pct / cur.full) } : null;
  }
  const env = scene.envFx?.name;
  if (env && VFX[env]) {
    const low = env === 'env_lava' || env === 'env_mud' || env === 'env_corrupt' || env === 'env_curse';
    loopAt(scene, ctx, env, heroX, low ? G + 1 : G - 18, (SEE_THROUGH[env] ?? 1) * scene.envFx.k, env === 'env_thirst' ? 0.7 : 1.25); // v9.2.6 : un peu plus lisible
    if (env === 'env_lava') loopAt(scene, ctx, 'poison_bubbles', heroX, G - 46, 0.9, 0.8); // la brûlure ronge les PV
  }
  // Rage du héros : sous 30 % de ses PV max.
  // v9.2.7 : seulement en vrai combat, PV connus et positifs : une scène sans PV (vitrine, aperçu, héros pas encore
  // initialisé : hp à 0 ou absent) gardait les flammes de rage allumées aux pieds du héros, même dans les Plaines.
  const hp = world.hero.hp;
  if (scene.heroHpMax > 0 && Number.isFinite(hp) && hp > 0 && hp < scene.heroHpMax * 0.3 && world.enemies.length > 0) loopAt(scene, ctx, 'hero_rage', heroX, G + 1, 0.8, 0.8);
  // Boss et mutants : auras propres à leur mécanique.
  for (const e of world.enemies) {
    const fx = scene.enemyFx.get(e.id);
    if (!fx || !(fx.seen > scene.time - 0.1)) continue;
    const cx = fx.sx + fx.sw / 2;
    const s = Math.max(0.8, Math.min(1.6, fx.sh / 40));
    if (e.boss && e.trait === 'escalate') loopAt(scene, ctx, 'boss_rage', cx, G + 1, Math.min(1, 0.3 + (e.age ?? 0) / 30), s);
    if (e.boss && e.trait === 'desperate' && e.hp < e.maxHp * 0.5) loopAt(scene, ctx, 'boss_despair', cx, G + 1, 0.85, s);
    if (e.boss && e.trait === 'tidal' && !(e.critAt > world.time - 3) && scene.time > (fx.tideAt ?? 0)) {
      fx.tideAt = scene.time + 2.2;
      vfx(scene, 'boss_tide', cx, G + 1, { size: s });
    }
    if (e.mutation === 'frenzied') loopAt(scene, ctx, 'mut_frenzy', cx, G + 1, 0.8, s, e.id);
    if (e.mutation === 'regen') loopAt(scene, ctx, 'mut_regen', cx, fx.sy + fx.sh * 0.5, 0.85, s, e.id);
    if (e.mutation === 'giant' && !e.engaged && !scene.focus && scene.time > (fx.stompAt ?? 0)) {
      fx.stompAt = scene.time + 0.7;
      vfx(scene, 'mut_stomp', cx, G - 2, { size: s, alpha: 0.9 });
    }
  }
}
