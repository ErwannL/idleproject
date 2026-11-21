// v10.4 (3) : l'effet de chaque compétence du héros, en UN seul endroit — la vignette de l'onglet Compétences et le
// combat (render/skill-fx.js) lisent cette table : l'effet joué dans la vignette est celui joué au combat.
// Un nom d'effet « x » désigne le sort `x` de render/skill-fx.js (FX) et son dessin PixelLab `sk_x` (art-vfx.js).
// Règles (vérifiées par tests/v1040-skills.test.js) : deux compétences d'une même classe n'ont jamais le même effet ;
// les 5 Boosts ont leurs effets à eux (aucune compétence de classe ne les emprunte) ; les deux compétences propres à
// chaque classe (`<classe>_1`, `<classe>_2`) ont chacune un effet différent de toutes celles des autres classes.
// Ordre : quick (coup), whirl (zone), cry (soutien), holy (frappe qui soigne), <classe>_1, <classe>_2.
const IDS = ['quick', 'whirl', 'cry', 'holy', '1', '2'];
const TABLE = {
  knight: ['ki_wave', 'whirlwind', 'war_cry', 'holy_smite', 'shield_bash', 'holy_shield'],
  archer: ['ranger_shot', 'thorn_waltz', 'instinct', 'divine_light', 'pierce_arrow', 'arrow_rain'],
  pyromancer: ['flame_spray', 'hellfire', 'dragon_blaze', 'phoenix_feather', 'fireball', 'meteor'],
  berserker: ['heavy_cut', 'axe_whirl', 'war_howl', 'bite', 'blood_whirl', 'carnage'],
  lancer: ['pierce', 'whirlwind', 'war_cry', 'judgement', 'flash_strike', 'frost_nova'],
  paladin: ['valiant_cut', 'judgement', 'blessing', 'holy_smite', 'sacred_ray', 'guardian_wings'],
  assassin: ['flash_strike', 'twin_blades', 'dive', 'valiant_cut', 'low_strike', 'void_blade'],
  crossbowman: ['ranger_shot', 'flame_spray', 'instinct', 'sacred_ray', 'claw', 'frost_storm'],
  stormcaller: ['foxfire', 'frost_nova', 'war_howl', 'judgement', 'crystal_spikes', 'eternal_winter'],
  necromancer: ['void_orb', 'ash_crown', 'war_howl', 'rebirth', 'sap_of_life', 'eclipse'],
};
// Boosts (payés en or) : un effet chacun.
export const RUSH_FX = { rage: 'fury', frenzy: 'frenzy', midas: 'gold_rain', hunter: 'falcon', phantom: 'blade_dance' };

// Effet de la compétence `skillId` du héros de classe `cls` (null si inconnue).
export function heroSkillFx(skillId, cls = 'knight') {
  const row = TABLE[cls] ?? TABLE.knight;
  const id = String(skillId);
  const i = IDS.indexOf(id.startsWith(`${cls}_`) ? id.slice(cls.length + 1) : id);
  return i >= 0 ? row[i] : null;
}
// Nom de l'effet dessiné (atlas) joué dans la vignette : compétence ('s') ou Boost ('r').
export function vignetteFx(kind, id, cls = 'knight') {
  const fx = kind === 'r' ? RUSH_FX[id] : heroSkillFx(id, cls);
  return fx ? `sk_${fx}` : 'combo_burst';
}
export const SKILL_FX_TABLE = TABLE;
