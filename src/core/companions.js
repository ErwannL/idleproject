// Compagnons : bonus passifs (selon niveau, étoiles et talents) et compétence automatique.
import { BALANCE } from '../data/balance.js';
import { COMPANION_RULES } from '../data/companions.js';
import { levelForStage, referenceKillGold } from './combat.js'; // v9.2.0 (monde marin) : niveau des étapes
import { talentEffects } from './rebirth.js';
import { DUNGEONS } from '../data/dungeons.js';
import { COMPANION_ROLES, SYNERGIES } from '../data/synergies.js';
import { SKILL_RULES, companionSkillList, skillScales } from '../data/companion-skills.js';
import { UNITS } from '../data/banners.js';
import { budget } from './banner.js';
import { unitElement, zoneElement } from './elements.js'; // v9.6.1
import { setCounts } from './sets.js'; // v9.6.1
import { ITEM_SETS } from '../data/sets.js'; // v9.6.1
import { combatSkills, dupMultiplier, goldPerKill, levelMult, skillLevels, upgradeSkill } from './progression.js'; // v9.3.3
import { GOLD_INDEX } from '../data/progression.js';
import { unitGearStats } from './companion-gear.js'; // v9.3.3
import { releaseWorker, researchEffects } from './bastion-base.js'; // v10.3 (10.3, 10.4)

export const MULTIPLICATIVE = { damagePct: 'damageMultPct', maxHpPct: 'maxHpMultPct', goldPct: 'goldMultPct' };

// v8.8 : puissance des compétences selon la rareté (un SSR frappe nettement plus fort qu'un R).
export const RARITY_SKILL = { common: 1, rare: 1, epic: 1.3, legendary: 1.8 };

// v9.1.3 (doc4 lot 1) : `owned.stars` reste le nombre d'exemplaires (1 à 6) ; les étoiles affichées comptent les
// doublons (0★ à l'obtention, 5★ au bout). Seul endroit où ce calcul est fait.
export function duplicates(owned) {
  return owned ? Math.max(0, Math.min(COMPANION_RULES.maxCopies - 1, (owned.stars ?? 1) - 1)) : 0;
}

// v8.9 : 4 compétences par compagnon (la 4e avec 3 doublons).
const SKILL_CACHE = new Map();
const FULL_CACHE = new Map();
function fullSkillList(id) { // kit complet d'origine (ultime compris), pour les rapports des familiers
  if (!FULL_CACHE.has(id)) FULL_CACHE.set(id, companionSkillList(companionById(id), COMPANION_ROLES[id] ?? 'pet'));
  return FULL_CACHE.get(id);
}
function skillList(id) {
  let list = SKILL_CACHE.get(id);
  if (!list) {
    list = companionSkillList(companionById(id), COMPANION_ROLES[id] ?? 'pet');
    // v9.3.8 (2.3) : un familier = un bonus passif + une seule compétence active (pas d'ultime).
    if (companionById(id)?.kind !== 'ally') list = list.filter((s) => !s.ultimate);
    SKILL_CACHE.set(id, list);
  }
  return list;
}

// v9.3.3 : l'ultime est disponible dès le 1er exemplaire (le 4e ouvre ses niveaux 6 à 10 : core/progression.js).
export function ultimateUnlocked() {
  return true;
}

// v9.3.3 : compétences en combat = active (+ évolutions des niveaux 5 et 8) + ultime, avec leurs niveaux.
export function companionSkills(state, id) {
  const cd = unitGearStats(state, id).cd + (researchEffects(state).companionCdPct ?? 0); // v9.3.3 : réduction de recharge de l'équipement (plafonnée) · v10.3 : recherche « Rappel rapide »
  let list = combatSkills(skillList(id), state.companions.owned[id]);
  // v9.3.8 : familier — les dégâts de l'ultime retiré passent dans l'active : même dégâts par seconde qu'avant, au
  // même niveau (rapport calculé avec l'ancien kit complet).
  if (companionById(id)?.kind !== 'ally') {
    const dps = (l) => l.filter((sk) => sk.type === 'hit' || sk.type === 'burst').reduce((a, sk) => a + (sk.value / sk.every) * (sk.type === 'burst' ? 3 : 1), 0); // vague de 3
    const full = dps(combatSkills(fullSkillList(id), state.companions.owned[id])), now = dps(list);
    const k = now > 0 && full > now ? (full / now) * 1.1 : 1; // marge : jamais plus faible qu'avant, même contre une vague
    if (k > 1) list = list.map((sk) => (sk.type === 'hit' || sk.type === 'burst' ? { ...sk, value: sk.value * k } : sk));
  }
  // v9.9 (K17) : Éveil — au niveau maximal, un compagnon gagne un sort de son élément (et change d'illustration).
  if (isAwakened(state, id)) list = [...list, awakenedSkill(id)];
  return cd ? list.map((s) => ({ ...s, every: s.every * (1 - cd / 100) })) : list;
}

export const AWAKEN_LEVEL = 20;
const AWAKEN_NAMES = { red: 'Brasier de l\'éveil', blue: 'Marée de l\'éveil', green: 'Sève de l\'éveil', light: 'Aube de l\'éveil', dark: 'Ombre de l\'éveil' };
export function isAwakened(state, id) {
  return companionById(id)?.kind === 'ally' && Boolean(state.companions?.owned?.[id]) && unitLevel(state, id) >= AWAKEN_LEVEL;
}
export function awakenedSkill(id) {
  const el = unitElement(id);
  return { name: AWAKEN_NAMES[el] ?? 'Éclat de l\'éveil', type: 'burst', every: 20, value: 0.6, awakened: true, index: 99, text: 'Frappe tous les ennemis (60 % des dégâts)' };
}

export function allCompanionSkills(id) {
  return skillList(id);
}

// kh et kb d'une unité (cache, calculés une fois depuis ses données).
const SCALE_CACHE = new Map();
export function companionScales(id) {
  let k = SCALE_CACHE.get(id);
  if (!k) {
    k = skillScales(skillList(id));
    SCALE_CACHE.set(id, k);
  }
  return k;
}

// Puissance par type (hors d et rareté) : hit/burst × kh/kb × (1 + 0,05 D) ; soin et rally × 4/3 × (1 + 0,05 D) ;
// bouclier et or : 1 (sans étoile). `owned` facultatif (aperçu d'une unité non possédée : 0 doublon).
export function skillPower(state, id, type = 'hit', owned = state.companions.owned[id]) {
  const step = dupMultiplier(owned); // v9.3.3 : bonus cumulé des doublons (0 à +24 %)
  if (type === 'hit' || type === 'burst') return companionScales(id)[type] * step;
  if (type === 'heal' || type === 'rally') return SKILL_RULES.supportFactor * step;
  return 1;
}

// Multiplicateur complet d'une compétence : d (donjon) × rareté × puissance ; soin et rally plafonnés à 3.
// v9.1.3 (doc4 lot 4) : budget B (core/banner.js) : × B/100, plafond soin et rally 3 × B/100 (B = 100 sans bannière) ;
// bouclier et or restent sans budget, comme sans étoile.
export function companionSkillMultiplier(state, companion, type, home = false, balance = BALANCE, owned = state.companions.owned[companion.id]) {
  if (type !== 'hit' && type !== 'burst' && type !== 'heal' && type !== 'rally') return (home ? balance.dungeonAffinity.skillMultiplier : 1) * (RARITY_SKILL[companion.rarity] ?? 1);
  const b = budget(companion) / 100;
  const gear = unitGearStats(state, companion.id); // v9.3.3 : équipement (attaque ou soins, réels)
  const g = 1 + (type === 'hit' || type === 'burst' ? gear.atk : gear.heal) / 100;
  const m = (home ? balance.dungeonAffinity.skillMultiplier : 1) * (RARITY_SKILL[companion.rarity] ?? 1) * skillPower(state, companion.id, type, owned) * b * g;
  return type === 'heal' || type === 'rally' ? Math.min(m, SKILL_RULES.supportCap * b) : m;
}

// v9.1.3 (partie B) : unités connues (permanentes + persos de bannière quand le drapeau est actif).
export function companionById(id) {
  return UNITS.find((c) => c.id === id);
}

// v9.5.0 (3.1) : niveau d'équipe partagé — un niveau commun à tous les compagnons, un autre à tous les familiers.
// Mettre un autre compagnon dans l'équipe lui donne le même niveau : changer d'équipe ne coûte plus rien.
// (Le niveau propre d'un compagnon, gardé pour les anciennes sauvegardes, ne compte que s'il est plus haut.)
export function unitLevel(state, id) {
  const owned = state.companions?.owned?.[id];
  const kind = teamKind(companionById(id));
  return Math.max(owned?.level ?? 1, state.companions?.teamLevel?.[kind] ?? 1);
}

// v9.1.3 (doc4 lot 1) : × (1,5 + 0,075 D). `owned` facultatif : aperçu d'une unité non possédée (niv. 1, 0 doublon).
export function companionMultiplier(state, id, owned = state.companions.owned[id]) {
  if (!owned) return 0;
  const bond = (talentEffects(state).companionPct ?? 0) / 100;
  const lvl = owned === state.companions.owned[id] ? unitLevel(state, id) : (owned.level ?? 1); // aperçu : niveau donné
  return (1 + COMPANION_RULES.levelBonusPct * (lvl - 1))
    * COMPANION_RULES.passiveBase * dupMultiplier(owned) * levelMult('passive', skillLevels(owned).passive) * (1 + bond) // v9.3.3
    * budget(companionById(id)) / 100; // v9.1.3 (doc4 lot 4) : budget B
}

export function equippedCompanions(state) {
  return state.companions.equipped.map(companionById).filter(Boolean);
}

// Héros adapté au donjon en cours (DUNGEONS[].ally) : il y écrase tout.
// v9.1.3 (doc4 lot 6) : affinité étendue au mode monde (le perso dans son monde : ×6, passif ×4, équipe +150 %).
export function dungeonAffinity(state, id) {
  if (state.worldRun) return state.worldRun.unit === id;
  if (!state.dungeon) return false;
  return DUNGEONS.find((d) => d.id === state.dungeon.id)?.ally === id;
}

// Multiplicateur des dégâts subis : réduits quand le héros adapté au donjon fait partie de l'équipe.
export function dungeonDamageTaken(state, balance = BALANCE) {
  const ally = state.worldRun ? state.worldRun.unit : state.dungeon && DUNGEONS.find((d) => d.id === state.dungeon.id)?.ally;
  return ally && state.companions.equipped.includes(ally) ? 1 - balance.dungeonAffinity.damageTakenPct / 100 : 1;
}

// Rôles présents dans l'équipe (le chevalier compte comme Gardien).
export function teamRoles(state) {
  return ['guardian', ...equippedCompanions(state).map((c) => COMPANION_ROLES[c.id]).filter(Boolean)];
}

// Synergies actives : chaque rôle requis doit être couvert (un membre ne compte qu'une fois).
export function activeSynergies(state) {
  const roles = teamRoles(state);
  return SYNERGIES.filter((syn) => {
    const pool = [...roles];
    return syn.roles.every((r) => {
      const i = pool.indexOf(r);
      if (i < 0) return false;
      pool.splice(i, 1);
      return true;
    });
  });
}

export function companionEffects(state, balance = BALANCE) {
  const out = {};
  for (const syn of activeSynergies(state)) {
    for (const [k, v] of Object.entries(syn.effects)) out[k] = (out[k] ?? 0) + v;
  }
  for (const c of equippedCompanions(state)) {
    const home = dungeonAffinity(state, c.id);
    const m = companionMultiplier(state, c.id) * (home ? balance.dungeonAffinity.passiveMultiplier : 1)
      * ((state.companions.owned[c.id]?.stars ?? 1) >= 3 ? 1 + STAR_TIERS[3].passivePct / 100 : 1); // v9.6.3 (3.7) : palier 3★
    // v8.8 : les % de dégâts, PV et or des compagnons sont MULTIPLICATIFS (avant : noyés dans les milliers de %
    // de l'arbre, si bien qu'un SR valait un SSR en fin de partie).
    for (const [k, v] of Object.entries(c.passive)) {
      const key = MULTIPLICATIVE[k] ?? k;
      out[key] = (out[key] ?? 0) + v * m;
    }
    // Dans son donjon, le SSR galvanise toute l'équipe.
    if (home) out.damagePct = (out.damagePct ?? 0) + balance.dungeonAffinity.teamDamagePct;
  }
  // v9.6.1 (4.5) : résonance d'élément — 2 membres du même élément (héros compris s'il porte un ensemble) : +10 % de
  // dégâts ; 3 ou plus : +25 %. Le joueur arbitre entre résonance, synergies de rôles et avantage sur le monde.
  // v9.6.3 (3.7) : palier 5★ — aura : +8 % de dégâts à toute l'équipe par compagnon 5★ placé.
  for (const c of equippedCompanions(state)) if ((state.companions.owned[c.id]?.stars ?? 1) >= 5) out.damageMultPct = (out.damageMultPct ?? 0) + STAR_TIERS[5].auraPct;
  const res = elementResonance(state);
  if (res) out.damageMultPct = (out.damageMultPct ?? 0) + res.pct;
  return out;
}

// v9.3.3 : or d'un ennemi pour les coûts de compétence : étape max, plafonné à ×40 l'or d'un ennemi de l'étape 50.
export function skillKillGold(state, balance = BALANCE) {
  return goldPerKill(state, referenceKillGold(levelForStage(state.maxStage, balance), balance), referenceKillGold(levelForStage(GOLD_INDEX.refStage, balance), balance));
}
export function upgradeCompanionSkill(state, id, kind, balance = BALANCE) {
  return upgradeSkill(state, id, kind, skillKillGold(state, balance));
}

export function companionUpgradeCost(state, id, balance = BALANCE) {
  const owned = state.companions.owned[id];
  if (!owned) return Infinity;
  return Math.floor(COMPANION_RULES.upgradeCostKills * referenceKillGold(levelForStage(state.maxStage, balance), balance)
    * COMPANION_RULES.upgradeCostGrowth ** (unitLevel(state, id) - 1) * (1 - (researchEffects(state).companionCostPct ?? 0) / 100)); // v10.3 : recherche « Entraînement commun »
}

export function upgradeCompanion(state, id, balance = BALANCE) {
  const owned = state.companions.owned[id];
  if (!owned || unitLevel(state, id) >= COMPANION_RULES.maxLevel) return false;
  const cost = companionUpgradeCost(state, id, balance);
  if (state.gold < cost) return false;
  state.gold -= cost;
  const next = unitLevel(state, id) + 1;
  const kind = teamKind(companionById(id));
  state.companions.teamLevel = { ally: 1, pet: 1, ...(state.companions.teamLevel ?? {}), [kind]: next }; // v9.5.0 : niveau d'équipe
  owned.level = next;
  return true;
}

export const RESONANCE = { 2: 10, 3: 25 };
// v9.6.3 (3.7) : paliers visibles des copies — 3★ : passif renforcé ; 5★ : aura d'équipe.
export const STAR_TIERS = { 3: { passivePct: 15, text: 'Passif renforcé de 15 %' }, 5: { auraPct: 8, text: 'Aura : +8 % de dégâts à toute l\'équipe' } };
// Élément le plus représenté dans l'équipe (compagnons, familier, et le héros s'il a un élément d'ensemble).
export function elementResonance(state) {
  const els = equippedCompanions(state).map((c) => unitElement(c.id)).filter(Boolean);
  const hero = heroElement(state);
  if (hero) els.push(hero);
  const count = {};
  for (const e of els) count[e] = (count[e] ?? 0) + 1;
  const [el, n] = Object.entries(count).sort((a, b) => b[1] - a[1])[0] ?? [];
  return n >= 2 ? { element: el, count: n, pct: RESONANCE[Math.min(3, n)] } : null;
}
// v9.6.1 (4.6) : élément du héros = celui de l'ensemble dont il porte au moins 2 pièces (l'ensemble du volcan est
// Feu, celui des marées Eau…) ; sinon neutre.
export function heroElement(state) {
  const counts = setCounts(state.equipment ?? {});
  let best = null;
  for (const [id, n] of Object.entries(counts)) {
    if (n < 2) continue;
    const set = ITEM_SETS.find((s) => s.id === id);
    if (set && (!best || n > best.n)) best = { el: zoneElement(set.zone), n };
  }
  return best?.el ?? null;
}

// Catégorie d'équipe : 'ally' (personnage) ou 'pet' (compagnon).
export function teamKind(c) {
  return c?.kind === 'ally' ? 'ally' : 'pet';
}

export function equippedOfKind(state, kind) {
  return equippedCompanions(state).filter((c) => teamKind(c) === kind);
}

// Garde au plus `teamSlots[kind]` membres de chaque catégorie (ordre conservé).
// v9.6.3 (3.4) : places de l'équipe — une 3e place de compagnon à partir du monde 5 (record d'étape).
export function teamSlotsOf(state, balance = BALANCE) {
  const best = Math.max(state?.maxStage ?? 1, state?.records?.bestStage ?? 1);
  return { ally: balance.teamSlots.ally + (best >= (balance.thirdAllyStage ?? Infinity) ? 1 : 0), pet: balance.teamSlots.pet + (state?.bastion?.research?.levels?.key_menagerie ? 1 : 0) }; // v10.8 : « Cœur de la Ménagerie »
}

export function clampTeam(equipped, balance = BALANCE, state = null) {
  const count = { ally: 0, pet: 0 };
  const slots = state ? teamSlotsOf(state, balance) : balance.teamSlots;
  return equipped.filter((id) => {
    const kind = teamKind(companionById(id));
    if (!companionById(id) || count[kind] >= slots[kind]) return false;
    count[kind] += 1;
    return true;
  });
}

// Remplace un membre de l'équipe par un autre de la même catégorie (équipe pleine).
export function replaceCompanion(state, newId, oldId) {
  const c = companionById(newId);
  const old = companionById(oldId);
  if (!c || !old || !state.companions.owned[newId] || teamKind(c) !== teamKind(old) || onExpedition(state, newId)) return false;
  const index = state.companions.equipped.indexOf(oldId);
  if (index < 0 || state.companions.equipped.includes(newId)) return false;
  state.companions.equipped[index] = newId;
  releaseWorker(state, newId, 'team'); // v10.3 (10.3) : un ouvrier qui rejoint l'équipe quitte son bâtiment
  return true;
}

// v8.5 : un compagnon parti en expédition ne peut pas rejoindre l'équipe.
export const onExpedition = (state, id) => (state.expeditions?.slots ?? []).some((s) => s?.companionId === id);

// Équiper / retirer. Le compagnon (1 place) remplace l'ancien ; les personnages sont limités à 2.
export function toggleCompanion(state, id, balance = BALANCE) {
  const c = companionById(id);
  if (!c || !state.companions.owned[id]) return false;
  if (onExpedition(state, id) && !state.companions.equipped.includes(id)) return false;
  const index = state.companions.equipped.indexOf(id);
  if (index >= 0) {
    state.companions.equipped.splice(index, 1);
    return true;
  }
  const kind = teamKind(c);
  const same = state.companions.equipped.filter((x) => teamKind(companionById(x)) === kind);
  if (same.length >= teamSlotsOf(state, balance)[kind]) {
    if (kind !== 'pet') return false;
    state.companions.equipped = state.companions.equipped.filter((x) => !same.includes(x));
  }
  state.companions.equipped.push(id);
  releaseWorker(state, id, 'team'); // v10.3 (10.3)
  return true;
}
