// Aide au joueur (v8.4) : puissance, puissance conseillée pour le prochain boss, conseils « que faire ».
import { currentQuest, isUnlocked, questSteps } from './unlock-quests.js'; // v9.7.1 (lot 3)
// v9.7.1 (lot 3) : onglet utile pour chaque geste des mini-quêtes (null : en combat).
const QUEST_TAB = { equipment: [null, null, 'inventory'], upgrades: [null, 'upgrades', null], skills: [null, 'skills', null], forge: ['inventory', 'forge', null] };
import { BALANCE } from '../data/balance.js';
import { PRESTIGE } from '../data/prestige.js';
import { formatNumber } from './format.js';
import { bossesForStage, createCombat, heroPower, isBossStage, step } from './combat.js';
import { Rng } from './rng.js';
import { endWorldRun } from './banner.js';
import { isUpgrade, teamUpgradeFor, uselessItems } from './inventory.js';
import { canEquip } from './classes.js';
import { companionById, companionUpgradeCost, onExpedition, teamKind, teamSlotsOf, unitLevel } from './companions.js';
import { teamAdvice } from './team-advisor.js'; // v9.5.0
import { upgradeProfits } from './profit.js';
import { upgradeOpen } from './unlocks.js';
import { bulkPlan, upgradeCost } from './economy.js';
import { skillPointCost, skillPointsAvailable } from './skills.js';
import { SKILLS } from '../data/skills.js';
import { canRebirth, rebirthAdviceOpen, rebirthBlocked, rebirthGain, rebirthReward, rebirthWorth } from './rebirth.js';
import { COMPANION_RULES } from '../data/companions.js';
import { DUNGEONS } from '../data/dungeons.js';
import { TOWER, climbsLeft, dayKey } from './tower.js'; // v9.6.2 (dayKey : même jour que le Carnet)
import { CHALLENGE } from './challenge.js'; // v9.6.2
import { arenaUnlocked } from './arena.js'; // v9.6.2
import { SEALS, needsSeal, worldGate } from './seals.js'; // v9.6.2
import { BANNERS } from '../data/economy.js';
import { BOSSES } from '../data/enemies.js';
import { claimables } from './claimables.js';
import { computeHeroStats, statsWithItem } from './stats.js';
import { bastionSeal } from './bastion-base.js'; // v10.3 (10.6)

// Prochain boss : la première étape de boss à partir de l'étape actuelle.
export function nextBossStage(state, balance = BALANCE) {
  let s = Math.max(state.stage, 1);
  while (!isBossStage(s, balance)) s += 1;
  return s;
}

// Prévision du prochain boss (v8.4) : le vrai combat est simulé sur une copie de la partie (sans rendu).
// Plus fiable qu'une « puissance conseillée » : rage, armure ignorée, compagnons et compétences comptent.
// v8.5 : générateur découpé en tranches (l'interface le fait avancer par petits morceaux, sans à-coup)
// et combat de 60 s au plus (au-delà, la rage des boss décide de toute façon).
export const FORECAST_SECONDS = 60;
export function* forecastSteps(state, balance = BALANCE, chunk = 200) {
  const stage = nextBossStage(state, balance);
  const t = structuredClone(state);
  t.stage = stage; t.autoAdvance = false; t.dungeon = null; t.tower = null; t.challenge = null; t.inventory = [];
  endWorldRun(t, 'left'); // v9.1.3 (doc4 lot 6) : mode monde neutralisé (équipe d'avant l'essai, sans essai gratuit)
  const w = createCombat(t, balance);
  const rng = new Rng(stage * 7919);
  const dt = balance.simulation.tickSeconds;
  let bossHpPct = 100;
  const total = Math.round(FORECAST_SECONDS / dt);
  for (let i = 0; i < total; i++) {
    step(t, w, dt, rng, balance);
    const b = w.enemies.find((e) => e.boss && !e.summoned);
    if (b) bossHpPct = Math.max(0, (b.hp / b.maxHp) * 100);
    for (const e of w.events) {
      if (e.type === 'bossDefeated' && !e.summoned) return { stage, win: true, bossHpPct: 0, seconds: Math.round(i * dt) };
      if (e.type === 'heroDeath') return { stage, win: false, bossHpPct: Math.round(bossHpPct), seconds: Math.round(i * dt) };
    }
    w.events.length = 0;
    if (i % chunk === chunk - 1) yield i / total;
  }
  return { stage, win: false, bossHpPct: Math.round(bossHpPct), seconds: FORECAST_SECONDS, timeout: true };
}

export function forecastBoss(state, balance = BALANCE) {
  const gen = forecastSteps(state, balance);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

// v9.3.5 : « Prochaine action » = le guide de tout le jeu. UN conseil, et un clic fait l'action quand c'est possible.
// Ordre : mode en cours ; récompense prête ; objets meilleurs (héros et équipe, tous d'un coup) ; compagnon à placer ;
// points de compétence ; première invocation ; amélioration rentable abordable ; montée d'un compagnon de l'équipe ;
// sac plein à plus de 80 % ; fusion prête ; clés de donjon ; Renaissance quand un boss bloque ; boss qui bloque ; objectif.
// `ctx.visible` : onglets ouverts (ui.tabVisible) — rien n'est proposé pour une fonction encore cachée.
// Chaque conseil : { id, text, tab?, view?, action?, value? }.
// v10.1 (P1 §2.2) : consigne du Sceau = premier candidat qui n'est pas mis de côté (consigne revenue 3 fois sans
// être faite : 10 min de côté, la suivante est proposée), avec sa ligne « pourquoi ».
// v10.3 (audit) : les consignes du jour (Arène, Tour, Défi) attendent elles aussi la carte de leur notion.
export const NOTION_OF = { skills: 'skills', summon: 'summon', lootbag: 'lootbag', recycle: 'forge', fusion: 'forge', keys: 'dungeons', place: 'summon', 'c-arena': 'tower', 'c-tower': 'defis', 'c-challenge': 'defis' };
export function nextAction(state, ctx = {}, balance = BALANCE) {
  const aside = ctx.aside ?? null;
  for (const n of actionCandidates(state, ctx, balance)) {
    if (!n || aside?.has?.(n.id)) continue;
    // v10.2 (4.1) : une consigne qui ouvre une notion attend que sa carte de déblocage ait été vue (la carte passe devant).
    const notion = NOTION_OF[n.id];
    if (notion && ctx.learned && !ctx.learned.includes(notion)) { ctx.wantLearn ??= notion; continue; }
    // v10.1 (P1) : une consigne qui ne ferait qu'ouvrir l'écran déjà ouvert laisse la place à la suivante.
    if (ctx.tab && n.tab === ctx.tab && !n.action && !n.view) { ctx.here ??= n; continue; } // v10.13 (9) : ctx.here = le conseil « déjà fait » (le doigt s'y règle aussi)
    return { ...n, why: n.why ?? whyOf(n, state, balance) };
  }
  return null;
}

// v10.13 (9) : une seule source de vérité pour « où mène la prochaine action conseillée » — le Sceau, le doigt du tutoriel
// et les tests de parcours (tools/e2e-beginner.mjs) lisent tous cet écran. null : aucun écran précis (une action sur place).
const ACTION_SCREEN = { 'equip-best': 'inventory', 'equip-unit': 'inventory', buy: 'upgrades', 'distribute-skills': 'skills', 'cast-first': 'skills', 'place-companion': 'companions',
  'apply-team': 'companions', 'upgrade-companion': 'companions', 'recycle-useless': 'inventory' };
const ID_SCREEN = { upgrade: 'upgrades', skills: 'skills', equip: 'inventory', place: 'companions', team: 'companions', level: 'companions', rebirth: 'tree', fusion: 'forge', recycle: 'inventory' };
export function adviceScreen(n) {
  if (!n) return null;
  return n.tab ?? ACTION_SCREEN[n.action] ?? ID_SCREEN[n.id] ?? null;
}

function whyOf(n, state, balance) {
  try {
    switch (n.id) {
      case 'equip': {
        if (n.action === 'equip-unit') return 'Ton compagnon devient plus fort';
        const cur = computeHeroStats(state, balance).combatPower;
        const one = state.inventory.find((i) => isUpgrade(state, i, balance));
        const g = one ? (statsWithItem(state, one, balance).combatPower / cur - 1) * 100 : 0;
        return g > 0.05 ? `+${formatPct(g)} % de puissance` : 'Un objet meilleur que celui porté';
      }
      case 'upgrade': { const p = upgradeProfits(state, balance)[n.value]?.pct ?? 0; return p > 0.05 ? `+${formatPct(p)} % de puissance : les monstres tombent plus vite` : 'Ton héros devient plus fort'; }
      case 'lootbag': return 'Garde le meilleur, le reste devient des éclats';
      case 'place': return 'Un allié de plus qui frappe à tes côtés';
      case 'team': return 'Une équipe plus forte, d\'un seul appui';
      case 'skills': return 'Plus de dégâts, et un sort de plus';
      case 'summon': return 'Un compagnon rejoint ton équipe (gemmes)';
      case 'seal': return 'Sans lui, ce boss ne peut pas être battu';
      case 'level': return 'Ton compagnon frappe plus fort';
      case 'quest': return 'Termine-la : une nouvelle fonction s\'ouvre';
      case 'recycle': return 'De la place dans le sac, des éclats pour la Forge';
      case 'fusion': return 'Un objet de rareté supérieure';
      case 'keys': return `${state.keys} donjon${state.keys > 1 ? 's' : ''} gratuit${state.keys > 1 ? 's' : ''} : objets et grimoires`;
      case 'rebirth': return 'Recommencer plus fort, pour toujours';
      case 'retry': return 'Ce boss bloque la suite';
      case 'claim': return n.reward ?? 'Des récompenses t\'attendent';
      case 'goal': return 'Bats-le pour débloquer la suite';
      case 'advance': return 'Ton héros reprend sa route';
      default: return n.content ? 'Récompenses du jour' : '';
    }
  } catch { return ''; }
}
const formatPct = (v) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1).replace('.', ','));

const GATED_TABS = { forge: 'forge', summon: 'summon', dungeons: 'dungeons', skills: 'skills' };

function* actionCandidates(state, ctx = {}, balance = BALANCE) {
  if (state.dungeon) yield { id: 'mode-dungeon', text: 'Donjon en cours', tab: 'dungeons' };
  if (state.tower) yield { id: 'mode-tower', text: 'Tour en cours', tab: 'tower' };
  if (state.worldRun) yield { id: 'mode-world', text: 'Monde en cours', tab: 'world' }; // v9.1.3 (doc4 lot 6)
  if (state.challenge) yield { id: 'mode-challenge', text: 'Défi en cours', tab: 'tower', view: { defiTab: 'challenge' } };
  // v10.6 (partie 8) : un onglet absent de ctx.visible n'est plus « ouvert » d'office — ceux qui ont une mini-quête de
  // déblocage attendent qu'elle soit faite (le Sceau proposait « Fusion prête à la Forge » à l'étape 1-7).
  const open = (tab) => (ctx.visible ?? {})[tab] !== false && (!GATED_TABS[tab] || isUnlocked(state, GATED_TABS[tab]))
    && (tab !== 'forge' || !state.unlocks || state.unlocks.legacy || Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1) >= 10); // « Prochain : Forge à l'étape 1-10 »
  // v10.1 : une récompense avec un objet attend tant que le sac est plein (« Tout récupérer » ne la prendrait pas).
  const bagFull = (state.inventory?.length ?? 0) >= (balance.loot?.inventorySize ?? Infinity);
  const claims = (ctx.claims ?? claimables(state, Date.now(), balance)).filter((c) => !c.blocked && !(c.item && bagFull));
  if (claims.length) yield claimAction(claims);
  // v10.3 (10.6) : au retour, le Bastion annonce ce qu'il a fini — une seule fois (« Commande prête : Arme Épique »).
  if (open('camp')) { const news = bastionSeal(state, ctx.now ?? Date.now()); if (news) yield news; }
  const current = computeHeroStats(state, balance);
  // v9.7.1 : sac de butin de la scène — une amélioration y attend, ou il se remplit.
  const bag = state.lootBag ?? [];
  if (bag.length >= 12 || bag.some((i) => isUpgrade(state, i, balance, current))) yield { id: 'lootbag', text: `Trier le coffre de butin (${bag.length})`, action: 'lootbag' };
  // v9.8 (E8) : « Équiper » suit isUpgrade (bilan dégâts/s × robustesse) ; le conseil semblait inutile à cause de
  // l'affichage des objets en valeurs brutes (« +6,3 M » à côté de « 2,4 Qa »), corrigé en A (gain en % de puissance).
  const betterAll = state.inventory.filter((i) => isUpgrade(state, i, balance, current));
  // v10.13 (9) : un objet meilleur seulement pour un compagnon : le conseil le dit et mène à lui (Équipement, ce compagnon choisi).
  const better = betterAll.filter((i) => canEquip(state, i)).length;
  if (!better && betterAll.length) {
    const it = betterAll[0], uid = teamUpgradeFor(state, it);
    if (uid) yield { id: 'equip', text: `Équiper ${companionById(uid)?.name ?? 'ton compagnon'} : ${it.name}`, action: 'equip-unit', value: uid, itemId: it.id };
  }
  if (better) { const one = state.inventory.find((i) => isUpgrade(state, i, balance, current)); yield { id: 'equip', text: better > 1 ? `Équiper ${better} objets meilleurs` : `Équiper ${one.name}`, action: 'equip-best' }; } // v9.9 (K2) : le nom de l'objet
  const place = companionToPlace(state, balance);
  if (place) yield { id: 'place', text: `Placer ${place.name} dans l'équipe`, action: 'place-companion', value: place.id };
  // v9.5.0 (3.6) : un compagnon du banc ferait mieux → « Meilleure équipe disponible », avec le gain (calculé à part).
  const adv = teamAdvice(state);
  if (adv && !adv.same && adv.gain >= 0.1) {
    const names = adv.team.filter((id) => !state.companions.equipped.includes(id)).map((id) => companionById(id)?.name ?? id);
    yield { id: 'team', text: `Meilleure équipe : ${names.join(' et ')} (+${Math.round(adv.gain * 100)} %)`, action: 'apply-team' };
  }
  const points = skillPointsAvailable(state);
  if (points > 0 && open('skills') && SKILLS.some((k) => (state.skills[k.id] ?? 0) < (k.maxLevel ?? Infinity) && skillPointCost(state.skills[k.id] ?? 0) <= points && (k.unlockLevel ?? 1) <= state.level)) {
    // v9.3.8 (3a) : un clic dépense les points (Attaques seulement) ; plus jamais bloqué sur un Boost payé en or.
    yield { id: 'skills', text: points > 1 ? `${points} points de compétence à dépenser` : '1 point de compétence à dépenser', action: 'distribute-skills' };
  }
  if (open('summon') && (state.records?.bossesDefeated ?? 0) >= 1 && !Object.keys(state.companions.owned).length && state.gems >= balance.summon.gemCost) { // après le premier mini-boss
    yield { id: 'summon', text: 'Première invocation : un compagnon', tab: 'summon' };
  }
  // v9.3.5 : gemmes en réserve et place libre dans l'équipe → invoquer (aussi après la première fois).
  const freeOf = (k) => state.companions.equipped.filter((id) => teamKind(companionById(id)) === k).length < teamSlotsOf(state, balance)[k];
  if (open('summon') && Object.keys(state.companions.owned).length && (freeOf('ally') || freeOf('pet')) && state.gems >= balance.summon.gemCost + 150) { // v9.7.1 : réserve de 150 gemmes
    yield { id: 'summon', text: freeOf('ally') ? 'Invoquer un compagnon (place libre)' : 'Invoquer un familier (place libre)', tab: 'summon' };
  }
  // v10.8 (1, 6) : Sceau de monde — la Renaissance guidée (ou le Bastion).
  { const gate = worldGate(state, state.stage + 1, balance); if (gate && state.stage + 1 > state.maxStage - 0) yield { id: 'gate', text: gate.text, tab: 'tree', view: { treeSeg: 'rebirth' }, why: 'Renaître te rend plus fort pour toujours' }; }
  // v9.6.2 (7.6) : boss de fin de monde scellé — dire comment gagner le sceau (et qu'il viendra quand même).
  if (needsSeal(state, state.stage + 1, balance) && state.stage + 1 <= state.maxStage) {
    const left = Math.max(0, Math.ceil((SEALS.waitSeconds - ((state.playSeconds ?? 0) - (state.sealSince ?? state.playSeconds ?? 0))) / 60));
    const where = open('dungeons') && (state.keys ?? 0) > 0 ? { tab: 'dungeons', how: 'un donjon' } : open('tower') ? { tab: 'tower', how: '5 étages de Tour ou le Défi' } : null;
    yield { id: 'seal', text: `Sceau requis pour le boss : ${where ? `gagne-le avec ${where.how}` : 'continue de combattre'} (sinon accordé dans ${left} min)`, tab: where?.tab };
  }
  // v9.6.2 (7.9) : les contenus tournent — chacun est proposé au moins une fois par jour ; après 2 « Plus tard » il
  // laisse sa place jusqu'au lendemain. Marqué « vu » dès que le joueur suit le conseil.
  // v10.3 (audit 2.4) : tous les contenus du jour encore à proposer, dans l'ordre — un contenu mis de côté ou qui attend
  // sa carte de déblocage ne cache plus les suivants (la ligne « Arène » passait après la Tour et le Défi, ou jamais).
  yield* contentRound(state, open);
  const up = bestOpenUpgrade(state, balance);
  const lv = companionToLevel(state, balance);
  // Montée d'un compagnon d'abord quand elle coûte moins que l'amélioration proposée (sinon l'or part toujours ailleurs).
  if (lv && (!up || up.cost > state.gold || lv.cost <= up.cost)) yield { id: 'level', text: `Monter ${lv.name} au niveau ${lv.level + 1}`, action: 'upgrade-companion', value: lv.id };
  // v10.2 (4.3) : un appui achète tous les niveaux abordables (plus de « Améliorer Dégâts » 15 fois de suite).
  if (up && up.cost <= state.gold && open('upgrades')) {
    const plan = bulkPlan(state, up.key, 'max', balance);
    yield { id: 'upgrade', text: plan.count > 1 ? `Améliorer ${UPGRADE_NAMES[up.key] ?? up.key} ×${plan.count} (${formatNumber(plan.cost)} or)` : `Améliorer ${UPGRADE_NAMES[up.key] ?? up.key} (${formatNumber(up.cost)} or)`, action: 'buy', value: up.key, amount: 'max' };
  }
  // v9.7.1 (lot 3) : la mini-quête de déblocage en cours, une consigne à la fois, quand rien de plus pressé n'attend.
  const quest = currentQuest(state);
  if (quest && (quest.id !== 'forge' || open('forge'))) { // v10.6 (8) : la quête de la Forge attend l'étape 1-10
    const steps = questSteps(state, quest);
    const i = steps.findIndex((x) => !x.done);
    if (i >= 0) yield { id: 'quest', text: `${quest.label} (${i + 1}/3) : ${steps[i].text}`, tab: QUEST_TAB[quest.id]?.[i] ?? null };
  }
  if (state.inventory.length >= balance.loot.inventorySize * 0.8) {
    const n = uselessItems(state, balance).length;
    if (n) yield { id: 'recycle', text: `Recycler ${n} objets inutiles`, action: 'recycle-useless' };
  }
  if (open('forge') && ctx.fusionReady) yield { id: 'fusion', text: 'Fusion prête à la Forge', tab: 'forge' };
  if (open('dungeons') && (state.records?.bestStage ?? state.maxStage) >= DUNGEONS[0].unlockStage && (state.keys ?? 0) >= 1) yield { id: 'keys', text: state.keys > 1 ? `${state.keys} clés de donjon à utiliser` : '1 clé de donjon à utiliser', tab: 'dungeons' };
  const blocking = Number.isFinite(state.bossRetry?.hpPct) ? state.bossRetry.hpPct : null;
  const blocked = Boolean(state.bossRetry && state.stage === state.bossRetry.stage - 1);
  // v9.3.8 : Renaissance aussi quand la progression ralentit (plus de 10 min de jeu sans nouveau record).
  const slowing = (state.playSeconds ?? 0) - (state.recordAt ?? state.playSeconds ?? 0) > 600
    || (state.playSeconds ?? 0) - (state.ui?.wallAt ?? -1e9) < 1800; // v9.8 (I5) : mur détecté (retour automatique)
  if ((blocked || slowing || rebirthWorth(state)) && open('tree') && canRebirth(state) && rebirthAdviceOpen(state) && !rebirthBlocked(state) && rebirthReward(state) > 0) { // v10.20 (7.3)
    yield { id: 'rebirth', text: `Renaître (+${Math.round((PRESTIGE.rebirthMultiplier ** rebirthGain(state) - 1) * 100)} % de dégâts)`, tab: 'tree', view: { treeSeg: 'rebirth' } };
  }
  if (blocked) {
    const pct = bossRetryPct(state, balance);
    yield { id: 'retry', text: blocking !== null ? `Boss : ${blocking} % de vie restante` : pct >= 100 ? 'Retenter le boss (prêt)' : `Boss trop fort : améliore-toi (${pct} %)`, action: 'retry-boss' };
  }
  if (!state.autoAdvance && !state.farmBoss) yield { id: 'advance', text: 'Reprendre l\'avance', action: 'advance' };
  yield goalAction(state, balance);
}

// Amélioration la plus rentable parmi les lignes ouvertes (dégâts/s par or ; PV quand aucune ligne de dégâts n'est abordable).
export function bestOpenUpgrade(state, balance = BALANCE) {
  const profits = upgradeProfits(state, balance);
  let best = null;
  for (const [k, p] of Object.entries(profits)) if (upgradeOpen(state, k, balance) && p.gain > 0 && (!best || p.score > best.score)) best = { key: k, ...p };
  if (best && best.cost <= state.gold) return best;
  const v = balance.upgrades.vitality;
  if (v && upgradeOpen(state, 'vitality', balance)) { const cost = upgradeCost('vitality', state.upgrades.vitality ?? 0, balance, state); if (cost <= state.gold && (state.upgrades.vitality ?? 0) < (state.upgrades.damage ?? 0)) return { key: 'vitality', cost }; }
  return best;
}

// v10.6 (partie 5) : gain de puissance d'un niveau de plus (en %). Sous 0,5 %, l'achat est « presque sans effet » :
// grisé dans la liste et sorti de « Tout acheter » (sauf Or et Expérience, qui ne comptent pas dans la puissance).
export const WEAK_UPGRADE_PCT = 0.5;
export const POWERLESS_UPGRADES = new Set(['goldFind', 'xpGain']);
export function upgradePowerPct(state, key, levels = 1, balance = BALANCE) {
  const cur = computeHeroStats(state, balance).combatPower;
  if (!(cur > 0)) return Infinity;
  return (computeHeroStats({ ...state, upgrades: { ...state.upgrades, [key]: (state.upgrades[key] ?? 0) + levels } }, balance).combatPower / cur - 1) * 100;
}
// v10.7 (4) : jugé sur tout ce que l'or permet d'acheter (mode « Max »), pas sur un seul niveau : 50 niveaux de Dégâts à
// +0,01 % chacun peuvent faire +0,5 % ensemble.
export const weakUpgrade = (state, key, balance = BALANCE) => !POWERLESS_UPGRADES.has(key)
  && upgradePowerPct(state, key, Math.max(1, bulkPlan(state, key, 'max', balance).count), balance) < WEAK_UPGRADE_PCT;

export const UPGRADE_NAMES = { damage: 'Dégâts', attackSpeed: 'Vitesse d\'attaque', vitality: 'PV', crit: 'Critique', armor: 'Armure', defense: 'Défense',
  regen: 'Régénération', goldFind: 'Or', critDamage: 'Dégâts critiques', doubleAttack: 'Double attaque', lifesteal: 'Vol de vie',
  companionPower: 'Compagnons', dodge: 'Esquive', bossDamage: 'Dégâts aux boss', xpGain: 'Expérience' };

// Compagnon possédé à placer dans une place libre de l'équipe (le plus rare d'abord), ou null.
export function companionToPlace(state, balance = BALANCE) {
  const order = ['legendary', 'epic', 'rare', 'common'];
  const free = (kind) => state.companions.equipped.filter((id) => teamKind(companionById(id)) === kind).length < teamSlotsOf(state, balance)[kind];
  return Object.keys(state.companions.owned).map(companionById)
    .filter((c) => c && !state.companions.equipped.includes(c.id) && !onExpedition(state, c.id) && free(teamKind(c)))
    .sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))[0] ?? null;
}
// Membre de l'équipe dont la montée de niveau est abordable (la moins chère), ou null.
export function companionToLevel(state, balance = BALANCE) {
  let best = null;
  for (const id of state.companions.equipped) {
    const owned = state.companions.owned[id];
    const cost = companionUpgradeCost(state, id, balance);
    if (!owned || unitLevel(state, id) >= COMPANION_RULES.maxLevel || cost > state.gold) continue;
    if (!best || cost < best.cost) best = { id, name: companionById(id)?.name ?? id, level: unitLevel(state, id), cost };
  }
  return best;
}

export const CONTENT_ROUND = [
  { id: 'c-tower', tab: 'tower', text: 'Défi du jour : monte dans la Tour', ok: (s) => (s.records?.bestStage ?? s.maxStage) >= TOWER.unlockStage && climbsLeft(s) > 0 },
  { id: 'c-challenge', tab: 'tower', view: { defiTab: 'challenge' }, text: 'Tente le Défi de la semaine', ok: (s) => (s.records?.bestStage ?? s.maxStage) >= CHALLENGE.unlockStage },
  // v10.3 (audit 2.4) : ligne « Arène » du Sceau, une fois par jour, tant qu'aucun combat d'Arène n'a été gagné ce jour-là.
  // Elle mène à l'onglet Arène (plus à Défis) et annonce ce que l'Arène donne vraiment (pas de copies de compagnons).
  { id: 'c-arena', tab: 'arena', text: 'Arène : un étage à franchir (gemmes et étoiles)', ok: (s) => arenaUnlocked(s) && !((s.daybook?.day === dayKey() ? s.daybook.counts?.arena ?? 0 : 0) > 0) },
  { id: 'c-expeditions', tab: 'expeditions', text: 'Envoie tes compagnons libres en expédition', ok: (s) => (s.expeditions?.slots ?? []).some((r) => !r) && Object.keys(s.companions?.owned ?? {}).length > s.companions.equipped.length },
  { id: 'c-event', tab: 'event', text: 'Événement : enchaîne les étapes de la carte', ok: (s) => Boolean(s.event) },
];
export function guideDay(state, now = Date.now()) {
  const d = new Date(now); const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  if (state.ui.guideDay?.day !== key) state.ui.guideDay = { day: key, done: [], skips: {} };
  return state.ui.guideDay;
}
function* contentRound(state, open) {
  if (!state.ui) return;
  const g = guideDay(state);
  for (const c of CONTENT_ROUND) {
    if (g.done.includes(c.id) || (g.skips[c.id] ?? 0) >= 2 || !open(c.tab)) continue;
    let ok = false;
    try { ok = c.ok(state); } catch { ok = false; }
    if (ok) yield { id: c.id, text: c.text, tab: c.tab, view: c.view, content: true };
  }
}

function claimAction(claims) {
  // v10.1 : « pourquoi » = ce qu'on récupère (gemmes en tête).
  const gems = claims.reduce((t, c) => t + (c.reward?.gems ?? c.gems ?? 0), 0);
  const reward = gems > 0 ? `${formatNumber(gems)} gemmes${claims.length > 1 ? ` et ${claims.length - 1} autre${claims.length > 2 ? 's' : ''} récompense${claims.length > 2 ? 's' : ''}` : ''}` : `${claims.length} récompense${claims.length > 1 ? 's' : ''} prête${claims.length > 1 ? 's' : ''}`;
  return { id: 'claim', text: claims.length > 1 ? `Tout récupérer (${claims.length})` : `${claims[0].label}${gems > 0 ? ` : ${formatNumber(gems)} gemmes` : ''}`, action: 'claim-everything', tab: claims[0].tab, reward };
}

function goalAction(state, balance) {
  const boss = nextBossName(state, balance);
  return { id: 'goal', text: boss ? `Affronter ${boss}` : 'Avancer', tab: 'campaign' }; // v9.9 (K2)
}

// Objet du sac qui améliore le plus le héros (le premier trouvé), ou null.
export function betterItem(state, balance = BALANCE, current = computeHeroStats(state, balance)) {
  return state.inventory.find((i) => isUpgrade(state, i, balance, current)) ?? null;
}

// Puissance du héros face au boss qui l'a battu, en % de ce qu'il faut pour le retenter (100 = prêt).
export function bossRetryPct(state, balance = BALANCE) {
  const r = state.bossRetry;
  if (!r) return null;
  return Math.min(999, Math.floor((heroPower(state, balance) / (r.power * balance.stages.bossRetryPower)) * 100));
}

function nextBossName(state, balance) {
  const stage = nextBossStage(state, balance);
  const id = bossesForStage(stage)?.[0];
  return id ? BOSSES[id]?.name ?? null : null;
}


// Aide « ? » de chaque écran (v9.1.0) : 3 lignes au plus (`short`), le détail dans « En savoir plus » (`more`).
// Les textes suivent le lexique du jeu (Compétences, Boosts, Pouvoirs, Talents, Builds…).
export const PANEL_HELP = {
  // v10.3 (partie 10) : le Bastion.
  camp: { short: 'Tes compagnons hors de l\'équipe travaillent au Bastion : chantiers, recherches et commandes avancent même jeu fermé.',
    more: 'Pose un ouvrier sur un bâtiment d\'un toucher : son métier donne +20 % dans le bon bâtiment. Sans ouvrier, un bâtiment produit à 50 % et ne lance pas de chantier. Les Recherches ne se perdent pas aux Renaissances.' },
  // v9.8 (J1) : Forge et Carnet du jour.
  forge: { short: 'Recycle les objets inutiles en éclats, puis forge mieux.',
    more: 'Recycler, Fusionner ou Fabriquer : un gros bouton chacun. Les éclats renforcent tes objets et en fabriquent de nouveaux.' },
  daybook: { short: 'Ta routine du jour sur un seul écran.',
    more: 'Chaque carte se fait en un ou deux appuis : Chasse rapide, Roue, donjon, Titan, expéditions, missions. Tout fini : tampon « Journée accomplie » et coffre de fin de journée.' },
  upgrades: {
    short: 'L\'or achète des améliorations. Chaque ligne indique son gain en dégâts/s : à toi de choisir.',
    more: 'Dégâts et Points de vie gagnent ×1,35 / ×1,4 tous les 10 niveaux et ×1,75 tous les 25 niveaux : vise ces paliers. ×10, ×100 et Max achètent plusieurs niveaux d\'un coup.',
    // v9.2.1
    env: 'Dans les mondes 2 à 12, l\'environnement gêne le héros : la mention « contre … » marque l\'amélioration qui réduit ce malus (annulé à son niveau complet).',
    touch: 'Garde le doigt sur un bouton d\'achat : après l\'anneau, il achète en continu, de plus en plus vite.',
  },
  inventory: {
    short: 'La flèche verte marque un objet meilleur que celui porté. « Équiper le meilleur » équipe tout d\'un coup.',
    more: 'Les objets grandissent avec leur niveau : « Trouver mieux » cherche un meilleur objet dans le sac, sinon à la Forge. La Forge s\'ouvre à l\'étape 10 et la Réserve à l\'étape 20 : elle garde des objets jamais recyclés et les meilleures pièces d\'ensemble (filtre Ensemble, « Porter ») ; les Builds enregistrent équipe, équipement, classe, pouvoirs et compétences. Recyclage et fusion automatiques : Réglages du sac.',
  },
  hero: {
    short: 'Votre fiche : dégâts/s, niveau et équipement. Classe, Apparence et Records sont dans les segments du haut.',
    more: 'Les blocs repliés détaillent chaque source de bonus. Records garde l\'historique de la Tour, du défi et des donjons, et mesure ton rythme (or et XP par heure).',
  },
  summon: {
    short: `Les gemmes s'obtiennent en jouant. Garanties : Épique au plus tard toutes les ${BANNERS.permanent.epicEvery ?? 10} invocations, Légendaire au plus tard à la ${BANNERS.permanent.hard}e (compagnons) ou à la ${BANNERS.pet.hard}e (familiers).`, // v9.3.8 (3c) : lu dans les données
    more: `Chaque invocation (limitée, permanente, familiers) a son propre compteur : compagnon Légendaire garanti au plus tard à la ${BANNERS.permanent.hard}e invocation, familier Légendaire au plus tard à la ${BANNERS.pet.hard}e invocation de familiers. La vedette représente 50 % des Légendaires obtenus dans son invocation (elle n\'augmente pas la chance d\'un Légendaire). Doublon : +1 étoile, puis des gemmes.`,
  },
  skills: {
    short: 'Un point par niveau du héros, à placer où tu veux. Les compétences se lancent toutes seules.',
    more: 'Les Boosts (en bas de cet écran, ou les 5 dernières cases de la grille) sont différents : améliorés avec l\'or, lancés d\'un appui sur le combat (ou au clavier), ou en Auto.',
  },
  tree: {
    short: 'Les fragments anciens achètent des talents permanents. Un talent s\'apprend dès qu\'un voisin est appris.',
    more: 'L\'arbre se dévoile au fur et à mesure (la recherche ne porte que sur ce qui est visible). Les clés de voûte demandent des points dans leur région : la légende donne l\'objectif de chaque région. Petits nœuds : 3 niveaux · ◆ notables · ⬢ clés de voûte. La Renaissance (segment Renaissance) remet l\'étape à 1 contre des fragments et un bonus permanent de dégâts, PV et or.',
    mouse: 'Glisse ou utilise la molette pour te déplacer, Ctrl + molette pour zoomer.',
    touch: 'Glisse du doigt pour te déplacer ; les boutons − et + (dans Outils) zooment.',
  },
  campaign: {
    short: 'Votre monde, le prochain boss et la prévision du combat. L\'avance automatique passe d\'une étape à l\'autre.',
    more: 'La plupart des mondes ont 20 étapes et 4 boss (le monde 11 en a 10). Si un boss te bat, le héros s\'entraîne à l\'étape d\'avant et le retente seul quand il est 15 % plus fort (ou « Retenter le boss »).',
    // v9.2.1
    env: 'Dès le monde 2, chaque monde a un malus d\'environnement (Pénombre, Lave…), un peu plus fort à chaque cycle. Une amélioration à l\'or le réduit selon son niveau : la fiche du monde et la pastille en bas à gauche du combat disent laquelle et la part contrée.',
  },
  dungeons: {
    short: 'Une clé par tentative. Réussir une difficulté débloque la suivante, donjon par donjon.',
    more: 'Chaque fiche dit la mécanique du boss final et ce qui la contre. Le butin ciblé et le chemin sont mémorisés.',
  },
  companions: {
    short: 'Deux compagnons et un familier combattent avec toi. Leurs rôles forment des synergies.',
    more: 'Améliore-les avec l\'or ; les doublons d\'invocation ajoutent des étoiles. Ceux qui restent hors de l\'équipe peuvent partir en expédition (onglet Expéditions).',
  },
  expeditions: {
    short: 'Les compagnons hors de l\'équipe partent 1 h, 4 h ou 12 h, même jeu fermé, et rapportent des ressources.',
    more: 'La récompense prévue est écrite sous chaque durée. « Repartir » relance la dernière expédition de chaque place (même compagnon, même durée). Rappeler abandonne sans récompense.',
  },
  tower: {
    short: 'Tour : une ascension par semaine, un boss par étage, toujours plus fort. Défi de la semaine : des vagues sous des règles qui changent chaque lundi, sans clé, 3 tentatives.',
    more: 'La tour s\'effondre après 10 h de combat (chaque nouvel étage rajoute un peu de temps) et un méga boss garde chaque 10e étage. Chaque nouveau meilleur score de la semaine et chaque record rapportent des récompenses (liste des étages).',
  },
  boss: {
    short: 'Chaque boss vaincu donne un pouvoir. Réaffronte-le pour sa maîtrise et des charges de changement de pouvoir.',
    more: 'Deux pouvoirs de la même famille donnent un bonus de famille (effets +25 %).',
  },
  encyclopedia: {
    short: 'Tout ce que tu découvres s\'inscrit ici ; le pourcentage débloque des paliers de récompenses.',
    more: 'Deux systèmes : l\'encyclopédie (pourcentage global et paliers de chaque section) et le Musée (un objet ancestral par vitrine, bonus permanent, sans effet sur le pourcentage).',
  },
  contracts: {
    short: 'Missions du jour, piste du mois, contrats, prime du jour et hauts faits (bonus permanents). Tout récupérer : touche G.',
    more: 'Les contrats progressent seuls, même jeu fermé ; un contrat rempli est remplacé. La prime du jour donne une pièce d\'ensemble Épique ou mieux.',
  },
  inbox: {
    short: 'Vue d\'ensemble de tout ce qui est prêt à être récupéré (touche N, ou depuis Missions). Tout récupérer : touche G.',
    more: 'Les trouvailles (coffres, gemmes, portails) arrivent pendant le combat. Sac plein : les objets vont à la Réserve ; sac et Réserve pleins : les récompenses avec un objet attendent ici. Les marchands sont dans Missions › Aujourd\'hui.',
  },
  options: {
    short: 'Langue, sauvegarde (export et import), compte, mises à jour ; Interface (dont les essais d\'affichage), Son et Fenêtre dans les onglets.',
    more: 'C\'est quoi un idle ? Le jeu avance tout seul, même fermé : tu reviens de temps en temps pour améliorer ton héros. Lexique — Compétences : lancées seules ; Boosts : lancés d\'un appui ; Pouvoirs : bonus des boss ; Talents : arbre permanent ; Builds : équipement enregistré ; Coffre : rangement, ensembles compris.',
  },
};
