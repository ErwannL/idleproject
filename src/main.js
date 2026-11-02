// Point d'entrée : charge la partie, applique les gains hors ligne, puis fait tourner
// la simulation (minuterie, continue même fenêtre réduite) et le rendu (requestAnimationFrame,
// suspendu automatiquement quand la fenêtre est masquée).
import { BALANCE } from './data/balance.js';
import { BOSSES } from './data/enemies.js';
import { changeStage, createCombat, currentEncounter, cycleForStage, resetWave, resumeAdvance, stageLabel, step } from './core/combat.js';
import { ZONES } from './data/zones.js';
import { playCinematic, playTransition, worldCinematic } from './ui/cinematic.js';
import { TOUR_VERSION, maybeStartTour, startTour } from './ui/onboarding.js';
import { activeSynergies, companionById, onExpedition, replaceCompanion, toggleCompanion, upgradeCompanion } from './core/companions.js';
import { claimContract } from './core/contracts.js';
import { claimAchievement, claimableAchievements } from './core/achievements.js';
import { claimAllMissions, claimLogin, claimMission, claimMissionBonus, claimTrackTier, mergeReward, refreshMissions } from './core/missions.js';
import { abandonDungeon, dungeonById, setDungeonPath, startDungeon } from './core/dungeon.js';
import { DUNGEON_DIFFICULTIES } from './data/dungeons.js';
import { buyUpgradeBulk } from './core/economy.js';
import { buyFromMerchant, claimEvent, dismissEvent } from './core/events.js';
import { endTower, startTower } from './core/tower.js';
import { claimExpedition, expeditionType, relaunchExpeditions, startExpedition } from './core/expeditions.js';
import { endChallenge, startChallenge } from './core/challenge.js';
import { autoFuse, craftItem, fuseItems, fusionGroups, fusionKeep, reforgeItem, sharpenItem, upgradeItem } from './core/forge.js';
import { summon } from './core/gacha.js';
import { setActiveHero } from './core/heroes.js';
import { addToInventory, bulkRecycleCandidates, equipBest, equipItem, isUpgrade, recycleItem, recycleMatching, recycleRules, sweepInventory, toggleLock } from './core/inventory.js';
import { bossDungeon, bossFirstStage, claimMastery, powerById, powerSlots, rerollPower, resolveReroll, setPowerActive } from './core/powers.js';
import { buyTalent, buyTalentMax, buyTalentPath, buyTalentsCheapest, performRebirth, respecTalents } from './core/rebirth.js';
import { buyTranscendPerk, buyTranscendPerkMax, performTranscend, stellarMultiplier } from './core/transcend.js';
import { buyPerk } from './core/prestige.js';
import { activateRush, rushById, upgradeRush } from './core/rushes.js';
import { grantReward, rewardText } from './core/rewards.js';
import { learnSkill } from './core/skills.js';
import { generateItem, itemPower, makeItem, rarityById } from './core/loot.js';
import { STAT_LABELS } from './data/items.js';
import { applyOfflineRewards, computeOfflineRewards } from './core/offline.js';
import { Rng } from './core/rng.js';
import { SAVE_KEY, clearSave, encodeSaveCode, loadGame, parseImport, saveGame, writeImported } from './core/save.js';
import { SAVE_VERSION, createNewState } from './core/state.js';
import { computeHeroStats } from './core/stats.js';
import { formatNumber } from './core/format.js';
import { claimBounty } from './core/bounty.js';
import { claimables } from './core/claimables.js';
import { moveToStash, takeFromStash, wearSet } from './core/stash.js';
import { exposeAll, museumDuplicates, putInMuseum, takeFromMuseum } from './core/museum.js';
import { createJournal, journalSummary, noteDrop, noteFused, noteRecycled } from './core/journal.js';
import { SceneRenderer } from './render/scene.js';
import { UI } from './ui/ui.js';
import { hasPref, setPref } from './ui/prefs.js';
import { animateMenus } from './ui/animator.js';
import { createGameAudio } from './audio/game-audio.js';
import { simSpeed, unlockedSpeeds } from './core/cheats.js';
import { applyLoadout, renameLoadout, saveLoadout } from './core/loadouts.js';
import { claimEncyclopedia, claimSection } from './core/encyclopedia.js';
import { activeClass, canEquip, setHeroClass, weaponClass } from './core/classes.js';
import { setLang, startAutoTranslate } from './i18n/i18n.js';
import { CloudError, createCloudClient, syncOnce } from './core/cloud-save.js';
import { CLOUD_BASE } from './core/cloud-config.js';
import { BUILD } from './core/build-info.js';
import { GAME_VERSION } from './version.js';
import { applyTheme, themeById } from './ui/themes.js';
import { BUILT_IN_TOKEN } from './core/update-token.js';
import { RELEASES_API, RELEASES_PAGE, TAGS_FALLBACK_API, parseRelease, parseTagList, updateStatus } from './core/update.js';

const SIM_INTERVAL_MS = 100;
// v9.1.0 : codes de triche chargés seulement dans la version dev (fichier absent de la version publique).
let cheatCodes = null;

let storageMissing = false;
function storage() {
  try {
    const s = window.localStorage;
    s.setItem('idle-rpg.probe', '1');
    s.removeItem('idle-rpg.probe');
    return s;
  } catch {
    // Stockage indisponible : la partie fonctionne mais n'est pas conservée (v9.1.0 : le joueur est prévenu).
    storageMissing = true;
    const map = new Map();
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
  }
}

const store = storage();
const loaded = loadGame(store, BALANCE, Date.now());
let state = loaded.state;
let world = createCombat(state);
const rng = new Rng((state.rngSeed ^ Date.now()) >>> 0);

const canvas = document.getElementById('scene');
const renderer = new SceneRenderer(canvas);
const stageArea = document.getElementById('stage-area');
new ResizeObserver(() => renderer.resize(stageArea.clientWidth, stageArea.clientHeight)).observe(stageArea);
renderer.resize(stageArea.clientWidth, stageArea.clientHeight);

let lastSave = Date.now();
// v9.1.0 : écriture bloquée quand la sauvegarde vient d'une version plus récente (rien n'est écrasé) ou pendant
// un rechargement (réinitialisation, import : la partie en mémoire ne doit plus être écrite).
let saveBlocked = loaded.source === 'newer';
let saveFailedAt = 0;
function save() {
  lastSave = Date.now();
  if (saveBlocked) return false;
  const ok = saveGame(state, store, Date.now());
  if (!ok && Date.now() - saveFailedAt > 60000) {
    saveFailedAt = Date.now();
    setTimeout(() => ui.toast('⚠ Sauvegarde impossible (stockage plein ou bloqué) : exportez votre partie (Paramètres → Général).', '#ff8a8a'), 0);
  }
  return ok;
}
function reloadPage() {
  saveBlocked = true;
  location.reload();
}

function runOffline(fromMs, nowMs, journal = null) {
  const rewards = computeOfflineRewards(state, fromMs, nowMs, rng);
  const summary = applyOfflineRewards(state, rewards);
  if (rewards.clockSuspicious || rewards.elapsedSeconds >= BALANCE.offline.minSecondsForSummary) {
    ui.showOffline(summary, journal ? journalSummary(journal, state, nowMs) : null);
  } else if (journal) {
    ui.showJournal(journalSummary(journal, state, nowMs), 'away');
  }
  world = createCombat(state);
  save();
  ui.invalidate();
}

// Synergies (v8.1) : une synergie qui s'active est annoncée (bannière + message à sa couleur de rôle).
let knownSynergies = null;
function announceSynergies() {
  const ids = activeSynergies(state).map((s) => s.id);
  if (knownSynergies) {
    for (const syn of activeSynergies(state).filter((s) => !knownSynergies.includes(s.id))) {
      ui.banner(`Synergie : ${syn.name} !`, 'win');
      ui.toast(`${syn.name} — ${syn.text}`, '#ffe680');
      sound.play('claim', { volume: 0.8 });
    }
  }
  knownSynergies = ids;
}

// Toute action réussie est sauvegardée immédiatement et rafraîchit le panneau.
function done(ok, message = null, color = null) {
  if (!ok) return false;
  announceSynergies();
  if (message) {
    ui.toast(message, color);
    sound.play('claim', { volume: 0.7 });
  }
  save();
  ui.invalidate();
  return true;
}

let speed100Confirmed = false;
const TOKEN_KEY = 'idle-rpg.github-token';
// Jeton du joueur (Paramètres) en priorité, sinon celui intégré à l'installateur (secret de compilation).
function githubToken() {
  const ok = (t) => /^[A-Za-z0-9_]{20,255}$/.test(t ?? '');
  let own = '';
  try { own = localStorage.getItem(TOKEN_KEY) ?? ''; } catch { /* stockage indisponible */ }
  return ok(own) ? own : ok(BUILT_IN_TOKEN) ? BUILT_IN_TOKEN : '';
}

const actions = {
  learnSkill(id) { done(learnSkill(state, id)); },
  setSkillAuto(value) { state.skillAuto = value; done(true); },
  setHero(id) { done(setActiveHero(state, id), 'Nouveau héros actif'); },
  setHeroClass(id) {
    const r = setHeroClass(state, id, itemPower);
    if (!r) return;
    const c = activeClass(state);
    done(true, r.reforged ? `${c.name} : arme reforgée en ${r.reforged.name}` : r.swapped ? `${c.name} : ${r.swapped.name} équipée` : `Classe : ${c.name}`, c.color);
  },
  toggleCompanion(id) {
    if (!toggleCompanion(state, id)) ui.toast(onExpedition(state, id) ? 'Ce compagnon est en expédition.' : `Deux compagnons au maximum : retirez-en un d'abord.`);
    else done(true);
  },
  saveLoadout(i) { done(saveLoadout(state, i), `Build « ${state.loadouts[i].name} » enregistré`); },
  applyLoadout(i) {
    const r = applyLoadout(state, i, BALANCE, itemPower);
    if (!r) { ui.toast('Ce build est vide : équipez-vous puis « Enregistrer ».'); return; }
    const notes = [r.missing ? `${r.missing} objet${r.missing > 1 ? 's' : ''} introuvable${r.missing > 1 ? 's' : ''}` : '',
      r.refused ? `${r.refused} arme${r.refused > 1 ? 's' : ''} d'une autre classe` : ''].filter(Boolean).join(', ');
    done(true, `Build « ${state.loadouts[i].name} » équipé${notes ? ` (${notes})` : ''}`, notes ? '#ffb36b' : null);
  },
  renameLoadout(i, name) {
    if (!renameLoadout(state, i, name)) { ui.toast('Nom vide.'); return; }
    done(true, `Build renommé : ${state.loadouts[i].name}`);
  },
  claimEncyclopedia() {
    const given = claimEncyclopedia(state);
    done(Boolean(given), given ? `Encyclopédie : ${rewardText(given)}` : null, '#f2d083');
  },
  claimCollection(id) {
    const given = claimSection(state, id); // v9.1.3 : palier de section de l'encyclopédie (ancien Codex)
    done(Boolean(given), given ? `Collection : ${rewardText(given)}` : null, '#f2d083');
  },
  replaceCompanion(newId, oldId) {
    ui.view.replaceFor = null;
    done(replaceCompanion(state, newId, oldId), 'Équipe modifiée');
  },
  upgradeCompanion(id) { done(upgradeCompanion(state, id)); },
  summon(count, currency, pool = 'ally') {
    // v9.1.3 : l'onglet Apparences passait 'hero' et recevait des compagnons (seuls 'pet' et 'ally' étaient reconnus).
    const results = summon(state, rng, count, currency, BALANCE, ['hero', 'pet'].includes(pool) ? pool : 'ally');
    if (!results) return null;
    state.records.summons += results.length;
    const best = ['legendary', 'epic', 'rare', 'common'].find((r) => results.some((u) => u.rarity === r));
    sound.play('summon', { rarity: best });
    done(true);
    return results;
  },
  craft(slot, tier = 'rare') {
    const item = craftItem(state, slot, rng, BALANCE, tier);
    if (item) ui.view.selectedItemId = item.id;
    done(Boolean(item), item ? `Forgé : ${item.name}` : null);
  },
  reforge(id) { done(reforgeItem(state, id, rng), 'Effets spéciaux relancés'); },
  sharpen(id) { done(sharpenItem(state, id), 'Objet réaffûté'); },
  upgradeItem(id) {
    const stat = upgradeItem(state, id, rng);
    if (stat) sound.play('upgrade');
    const label = stat === 'main' || stat?.startsWith('affix:') ? 'effet spécial' : STAT_LABELS[stat];
    if (!stat) ui.toast('Renforcement impossible (or ou éclats insuffisants, ou maximum atteint).', '#ff8a8a');
    done(Boolean(stat), stat ? `Renforcé : ${label} +${BALANCE.forge.upgradeBoostPct} %` : null, '#7fe08f');
  },
  fuse(slot, rarity) {
    const item = fuseItems(state, slot, rarity, rng, BALANCE, fusionKeep(state));
    if (item) sound.play('loot', { rarity: item.rarity });
    if (item) ui.view.selectedItemId = item.id;
    done(Boolean(item), item ? `Fusion : ${item.name} (${rarityById(item.rarity).label})` : null, rarityById(item?.rarity ?? 'common').color);
  },
  fuseAll() {
    let n = 0;
    for (let guard = 0; guard < 500; guard++) {
      const keep = fusionKeep(state);
      const g = fusionGroups(state, BALANCE, keep)[0];
      if (!g || !fuseItems(state, g.slot, g.rarity, rng, BALANCE, keep)) break;
      n += 1;
    }
    if (n) sound.play('loot', { rarity: 'epic' });
    done(n > 0, n ? `${n} fusion${n > 1 ? 's' : ''} faite${n > 1 ? 's' : ''}` : null, '#c9a6ff');
  },
  claimMastery(bossId) {
    const given = claimMastery(state, bossId);
    done(Boolean(given), given ? `Maîtrise : ${rewardText(given)}` : null, '#f2d083');
  },
  // Réaffronter un boss : le chevalier va à son étape et y reste (mode farm) pour gagner des charges.
  rechallenge(bossId) {
    if (bossDungeon(bossId)) {
      ui.openTab('dungeons');
      return;
    }
    if (state.dungeon || state.tower || state.challenge) {
      ui.toast("Terminez d'abord le donjon, la tour ou le défi.");
      return;
    }
    const stage = bossFirstStage(bossId);
    if (stage === null || stage > state.maxStage) {
      ui.toast(`Atteignez d'abord l'étape ${stageLabel(stage ?? state.maxStage)}.`);
      return;
    }
    state.autoAdvance = false;
    state.farmBoss = bossId;
    changeStage(state, world, stage);
    done(true, `${BOSSES[bossId].name} : le héros l'affronte en boucle — bouton « Arrêter » sur la scène pour reprendre`);
  },
  // v9.0.4 : fin du combat en boucle lancé depuis le Codex : retour à l'étape max, avance auto.
  stopFarmBoss() {
    state.farmBoss = null;
    state.autoAdvance = true;
    changeStage(state, world, state.maxStage);
    done(true, 'Progression reprise');
  },
  enterDungeon(id, slot, path, difficulty) {
    if (!startDungeon(state, id, slot, path, difficulty)) return;
    resetWave(world);
    const d = dungeonById(id);
    placeTransition(`Donjon · ${DUNGEON_DIFFICULTIES[difficulty]?.label ?? ''}`, d.name, d.description, ZONES[d.zone]?.id);
    done(true, 'Tentative lancée');
  },
  abandonDungeon() {
    abandonDungeon(state);
    resetWave(world);
    backToCampaign();
    done(true, 'Retour à la campagne');
  },
  setDungeonPath(path) { done(setDungeonPath(state, path)); },
  // v9.1.0 : butin ciblé et chemin des donjons mémorisés dans la sauvegarde.
  rememberDungeonChoice(kind, value) {
    if (kind === 'slot') state.ui.dungeonSlot = value; else state.ui.dungeonPath = value;
    save();
  },
  claimMission(period, id) {
    const given = claimMission(state, period, id);
    done(Boolean(given), given ? `Mission accomplie : ${rewardText(given)}` : null, '#7fd4ff');
  },
  claimMissionBonus(period) {
    const given = claimMissionBonus(state, period);
    done(Boolean(given), given ? `Coffre de missions : ${rewardText(given)}` : null, '#7fd4ff');
  },
  claimTrack() { // v9.1.3 : palier de la piste du mois
    const given = claimTrackTier(state);
    done(Boolean(given), given ? `Piste du mois : ${rewardText(given)}` : null, '#7fd4ff');
  },
  claimLogin() {
    const given = claimLogin(state);
    done(Boolean(given), given ? `Connexion : ${rewardText(given)}` : null, '#7fd4ff');
  },
  claimAll() {
    const total = claimAllMissions(state) ?? {};
    let n = Object.keys(total).length;
    for (const c of [...state.contracts]) {
      const given = c.progress >= c.target ? claimContract(state, c.id, rng) : null;
      if (given) { mergeReward(total, given); n += 1; }
    }
    for (const a of claimableAchievements(state)) {
      if (claimAchievement(state, a.id)) { mergeReward(total, { gems: a.gems }); n += 1; }
    }
    if (!n) ui.toast('Rien à récupérer pour le moment.');
    else done(true, `Tout récupéré : ${rewardText(total)}`, '#7fd4ff');
  },
  // Tout récupérer (v9.1.0, bouton « À récupérer », Prochaine action et touche G) : toutes les récompenses de
  // core/claimables.js ; d'abord celles sans objet, puis les objets tant que le sac a de la place.
  claimEverything() {
    const total = {};
    let n = 0;
    let items = 0;
    const add = (given) => { if (given) { const { item, ...rest } = given; mergeReward(total, rest); n += 1; } };
    const list = claimables(state);
    const order = [...list.filter((c) => !c.item), ...list.filter((c) => c.item)];
    for (const c of order) {
      if (c.item && state.inventory.length >= BALANCE.loot.inventorySize) continue;
      switch (c.kind) {
        case 'login': add(claimLogin(state)); break;
        case 'mission': add(claimMission(state, c.period, c.id)); break;
        case 'missionBonus': add(claimMissionBonus(state, c.period)); break;
        case 'track': add(claimTrackTier(state)); break;
        case 'contract': add(claimContract(state, c.id, rng)); break;
        case 'achievement': { const a = claimAchievement(state, c.id); if (a) add({ gems: a.gems }); break; }
        case 'event': { const g = claimEvent(state, c.id); if (g) { add(g); if (g.item) items += 1; } break; }
        case 'expedition': add(claimExpedition(state, c.slot, Date.now(), grantReward)); break;
        case 'encyclopedia': add(claimEncyclopedia(state)); break;
        case 'collection': add(claimSection(state, c.id)); break;
        case 'mastery': add(claimMastery(state, c.bossId)); break;
        case 'bounty': { const r = claimBounty(state, rng); if (r) { add({ gems: r.gems }); items += 1; } break; }
        default: break;
      }
    }
    const left = claimables(state).length;
    if (!n) { ui.toast(left ? 'Sac plein : libérez de la place pour récupérer les objets.' : 'Rien à récupérer pour le moment.'); return; }
    const text = [rewardText(total, formatNumber), items ? `${items} objet${items > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
    done(true, `Tout récupéré : ${text}${left ? ` (${left} en attente : sac plein)` : ''}`, '#7fd4ff');
  },
  // Retour de session (v9.1.0, touche S) : récupérer tout et équiper le meilleur, puis un récapitulatif.
  // v9.1.3 : plus d'achat automatique d'améliorations ni de répartition des points : l'or et les points restent
  // au choix du joueur.
  sessionReturn() {
    const before = computeHeroStats(state).dps;
    const claimsBefore = claimables(state).length;
    this.claimEverything();
    const claimsLeft = claimables(state).length;
    const equipped = equipBest(state);
    const after = computeHeroStats(state).dps;
    save();
    ui.invalidate();
    ui.showSessionReturn({ claimed: claimsBefore - claimsLeft, claimsLeft, equipped, before, after });
  },
  claimAchievement(id) {
    const a = claimAchievement(state, id);
    done(Boolean(a), a ? `Haut fait « ${a.name} » : +${a.gems} gemmes, +1 % dégâts et or pour toujours` : null, '#ffe08a');
  },
  claimContract(id) {
    const given = claimContract(state, id, rng);
    done(Boolean(given), given ? `Contrat rempli : ${rewardText(given)}` : null, '#f2d083');
  },
  claimAllEvents() {
    const total = {};
    let items = 0;
    for (const e of [...state.inbox]) {
      const given = e.type === 'merchant' ? null : claimEvent(state, e.id);
      if (!given) continue;
      if (given.item) items += 1;
      const { item, ...rest } = given;
      mergeReward(total, rest);
    }
    const text = [rewardText(total), items ? `${items} objet(s)` : ''].filter(Boolean).join(' · ');
    done(Boolean(text), `Récupéré : ${text}`);
  },
  claimEvent(id) {
    const given = claimEvent(state, id);
    done(Boolean(given), given ? `Récupéré : ${rewardText(given) || given.item?.name}` : 'Sac plein');
  },
  buyMerchant(id) { done(buyFromMerchant(state, id), 'Objet acheté'); },
  dismissEvent(id) { done(dismissEvent(state, id)); },
  buy(key, amount = '1') {
    if (buyUpgradeBulk(state, key, amount) > 0) {
      sound.play('upgrade', { volume: 0.6 });
      save();
      ui.invalidate();
    }
  },
  equip(id) {
    if (equipItem(state, id)) {
      save();
      ui.invalidate();
      return;
    }
    // v9.0.6 : arme d'une autre classe.
    const item = state.inventory.find((i) => i.id === id);
    const c = item && weaponClass(item.baseId);
    if (c && !canEquip(state, item)) ui.toast(`Arme de ${c.name} : changez de classe (Héros → Classe) pour la porter.`, c.color);
  },
  equipBest() {
    const n = equipBest(state);
    if (n) { save(); ui.invalidate(); ui.toast(`${n} objet${n > 1 ? 's' : ''} équipé${n > 1 ? 's' : ''}`, '#7fe0a0'); }
  },
  recycle(id) {
    const gold = recycleItem(state, id);
    if (gold > 0) {
      for (const j of journals()) noteRecycled(j, 1, gold);
      ui.toast(`Recyclé : +${formatNumber(gold)} or`);
      save();
      ui.invalidate();
    }
  },
  // Recyclage groupé protégé : jamais d'améliorations, jamais d'Épique ou de Légendaire.
  recycleBulk(maxRarity) {
    const ids = new Set(bulkRecycleCandidates(state, maxRarity).map((i) => i.id));
    const { gold, count } = recycleMatching(state, (i) => ids.has(i.id));
    if (count > 0) {
      for (const j of journals()) noteRecycled(j, count, gold);
      ui.toast(`${count} objets recyclés : +${formatNumber(gold)} or`);
      save();
      ui.invalidate();
    }
  },
  rerollPower(bossId) {
    if (rerollPower(state, bossId, rng)) {
      save();
      ui.invalidate();
    }
  },
  // Le pouvoir actuel n'est remplacé que si le joueur choisit le nouveau.
  resolvePower(bossId, accept) {
    const pending = state.powers[bossId]?.pending;
    if (!resolveReroll(state, bossId, accept)) return;
    ui.toast(accept ? `Nouveau pouvoir : ${powerById(pending).name}` : 'Pouvoir actuel conservé');
    save();
    ui.invalidate();
  },
  togglePower(bossId) {
    const active = state.equippedPowers.includes(bossId);
    if (!setPowerActive(state, bossId, !active)) {
      ui.toast(`Emplacements pleins (${powerSlots(state)}) : retirez d'abord un pouvoir actif.`);
      return;
    }
    save();
    ui.invalidate();
  },
  toggleLock(id) {
    if (toggleLock(state, id) !== null) {
      save();
      ui.invalidate();
    }
  },
  buyTalent(id) {
    if (buyTalent(state, id)) {
      save();
      ui.invalidate();
    }
  },
  buyTalentMax(id) { done(buyTalentMax(state, id) > 0); },
  // Transcendance (v8.8).
  transcend(keepPower) {
    const stars = performTranscend(state, performRebirth, keepPower);
    if (!stars) return;
    world = createCombat(state);
    resetWave(world);
    save();
    ui.banner(`Transcendance ! +${formatNumber(stars)} Étoiles`, 'win');
    if (cinematicsOn()) playTransition({ kicker: `Transcendance ${state.transcend.count}`, title: 'Un nouveau cycle', line: `+${formatNumber(stars)} Étoiles · dégâts, PV et or ×${formatNumber(stellarMultiplier(state))}` });
    ui.invalidate();
  },
  buyTranscendPerk(id, max = false) {
    const n = max ? buyTranscendPerkMax(state, id) : (buyTranscendPerk(state, id) ? 1 : 0);
    done(n > 0, n ? 'Bonus stellaire amélioré' : null, '#c9a6ff');
  },
  buyTalentsAll(region) {
    const n = buyTalentsCheapest(state, region);
    if (!n) ui.toast('Pas assez de fragments pour le prochain talent.', '#ff8a8a');
    done(n > 0, n ? `${n} niveau${n > 1 ? 'x' : ''} de talent appris` : null, '#c9a6ff');
  },
  buyTalentPath(id) {
    const n = buyTalentPath(state, id);
    if (!n) ui.toast('Pas assez de fragments pour le premier talent du chemin.', '#ff8a8a');
    done(n > 0, n ? `${n} talent${n > 1 ? 's' : ''} appris le long du chemin` : null, '#c9a6ff');
  },
  respecTalents() {
    const n = respecTalents(state);
    done(n > 0, n ? `Arbre réinitialisé : +${formatNumber(n)} fragments rendus` : null, '#c9a6ff');
  },
  rebirth(keepPower) {
    const gained = performRebirth(state, keepPower);
    if (gained <= 0) return;
    world = createCombat(state);
    save();
    ui.banner(`Renaissance ! +${gained} fragments anciens`, 'win');
    ui.invalidate();
  },
  activateRush(id) {
    const rush = rushById(id);
    if (activateRush(state, id)) done(true, `${rush.name} !`, rush.color);
  },
  upgradeRush(id) { done(upgradeRush(state, id)); },
  setRushAuto(on) { state.rushes.auto = on; done(true); },
  cheat(code, times = 1) {
    const msg = cheatCodes?.applyCheat(state, code, times);
    if (msg) done(true, msg, '#ffe08a');
    else ui.toast('Code inconnu.', '#ff8a8a');
  },
  removeCheat(code, times) {
    done(Boolean(cheatCodes?.removeCheat(state, code, times)), `Code ${code} retiré${Number.isFinite(times) ? ` (×${formatNumber(times)})` : ''}.`);
  },
  buyPerk(id) { done(buyPerk(state, id), 'Bonus éternel amélioré', '#ffe08a'); },
  // Tour de l'Éternité (v8.2).
  enterTower() {
    if (state.dungeon || state.challenge) { ui.toast("Terminez d'abord le donjon ou le défi."); return; }
    if (!startTower(state)) { ui.toast('Ascension de la semaine déjà faite (remise à zéro le lundi).', '#ff8a8a'); return; }
    resetWave(world);
    placeTransition('Ascension de la semaine', 'Tour de l\'Éternité', 'Un boss par étage. La tour s\'effondre au bout de 10 h de combat.');
    done(true, 'Ascension de la Tour de l\'Éternité : étage 1 !', '#c9a6ff');
  },
  leaveTower() {
    const r = endTower(state, { defeated: false });
    resetWave(world);
    if (r) backToCampaign();
    done(Boolean(r), r ? `Ascension terminée à l'étage ${r.floors}.` : null);
  },
  selectStage(stage) {
    if (state.tower || state.challenge) { ui.toast(state.tower ? 'Quittez d\'abord la Tour de l\'Éternité.' : 'Quittez d\'abord le défi de la semaine.'); return; }
    changeStage(state, world, stage);
    save();
    ui.invalidate();
  },
  // Prime du jour : aller sur l'étape du monde visé ; l'avance automatique s'arrête (« Avancer ▶ » pour reprendre).
  goToStage(stage) {
    if (state.tower || state.challenge || state.dungeon || stage > state.maxStage) return;
    state.autoAdvance = false;
    state.farmBoss = null;
    changeStage(state, world, stage);
    done(true, `Étape ${stageLabel(stage)} : le héros y reste. « Avancer ▶ » pour reprendre la progression.`);
  },
  retryBoss() {
    const r = state.bossRetry;
    if (!r) return;
    state.bossRetry = null;
    changeStage(state, world, r.stage);
    done(true, 'Le héros retente le boss !', '#ffd35a');
  },
  advance() {
    state.farmBoss = null;
    resumeAdvance(state, world);
    save();
    ui.invalidate();
  },
  setAutoAdvance(value) {
    state.autoAdvance = value;
    if (value) state.farmBoss = null;
    save();
    ui.invalidate();
  },
  // Fusion automatique : activer, ou basculer une rareté fusionnée.
  setAutoFuse(group, value) {
    const rules = { on: false, rarities: ['common'], ...(state.ui.autoFuse ?? {}) };
    if (group === 'on') rules.on = !rules.on;
    else rules.rarities = rules.rarities.includes(value) ? rules.rarities.filter((r) => r !== value) : [...rules.rarities, value];
    state.ui.autoFuse = rules;
    lastSweep = 0; // appliquée tout de suite
    done(true);
  },
  // Règles de recyclage automatique : mode, ou bascule d'une rareté / d'un type d'objet.
  setRecycleRule(group, value) {
    const rules = { keepAffixes: [], ...recycleRules(state) };
    if (group === 'mode') rules.mode = value;
    else rules[group] = rules[group].includes(value) ? rules[group].filter((v) => v !== value) : [...rules[group], value];
    state.ui.recycle = rules;
    // Les nouvelles règles s'appliquent tout de suite aux objets déjà dans le sac.
    const swept = sweepInventory(state);
    done(true, swept.count ? `${swept.count} objet${swept.count > 1 ? 's' : ''} recyclé${swept.count > 1 ? 's' : ''} (+${formatNumber(swept.gold)} or)` : null);
  },
  setLanguage(lang) { setLang(lang); ui.invalidate(); },
  setTheme(id) { state.ui.theme = themeById(id).id; applyTheme(state.ui.theme).then(() => ui.invalidate()); done(true); },
  // Vitesses débloquées par code (v8.4) ; ×100 demande une confirmation (effets visuels coupés).
  cycleSpeed() {
    if (state.cheats.skipBattle) {
      state.cheats.skipBattle = false;
      done(true, 'Combats passés désactivés.');
      return;
    }
    const speeds = unlockedSpeeds(state);
    if (speeds.length < 2) return; // secret : rien n'indique que le jeu peut être accéléré
    const next = speeds[(speeds.indexOf(state.ui.speed ?? 1) + 1) % speeds.length];
    if (next >= 100 && !speed100Confirmed) { ui.showSpeedWarning(); return; }
    this.setSpeed(next);
  },
  setSpeed(speed) {
    if (speed >= 100) speed100Confirmed = true;
    state.ui.speed = speed;
    done(true, `Vitesse des combats ×${speed}`);
  },
  // Expéditions (v8.5).
  startExpedition(companionId, type, chosen = null) {
    // v9.1.0 : la place choisie dans la liste est respectée (avant : toujours la première libre).
    const slot = Number.isInteger(chosen) && !state.expeditions.slots[chosen] ? chosen : state.expeditions.slots.findIndex((x) => !x);
    const c = companionById(companionId);
    done(startExpedition(state, slot, companionId, type), c ? `${c.name} part en expédition (${expeditionType(type)?.label})` : null, '#9fe6ff');
  },
  claimExpedition(slot) {
    const given = claimExpedition(state, slot, Date.now(), grantReward);
    done(Boolean(given), given ? `Expédition terminée : ${rewardText(given, formatNumber)}` : null, '#9fe6ff');
  },
  claimAllExpeditions() {
    const total = {};
    let n = 0;
    state.expeditions.slots.forEach((run, slot) => {
      if (!run || Date.now() < run.end) return;
      const given = claimExpedition(state, slot, Date.now(), grantReward);
      if (given) { mergeReward(total, given); n += 1; }
    });
    done(n > 0, n ? `${n} expédition${n > 1 ? 's' : ''} récupérée${n > 1 ? 's' : ''} : ${rewardText(total, formatNumber)}` : null, '#9fe6ff');
    return n;
  },
  relaunchExpeditions() {
    const n = relaunchExpeditions(state);
    if (!n) ui.toast('Aucune expédition à relancer (place occupée ou compagnon dans l\'équipe).');
    done(n > 0, n ? `${n} expédition${n > 1 ? 's' : ''} relancée${n > 1 ? 's' : ''}` : null, '#9fe6ff');
  },
  recallExpedition(slot) {
    done(claimExpedition(state, slot, Date.now(), grantReward) !== null, 'Compagnon rappelé (expédition abandonnée)');
  },
  // Défi de la semaine (v8.5).
  enterChallenge() {
    if (state.dungeon || state.tower) { ui.toast("Terminez d'abord le donjon ou la tour."); return; }
    if (!startChallenge(state)) { ui.toast('Plus de tentative cette semaine (remise à zéro le lundi).', '#ff8a8a'); return; }
    resetWave(world);
    placeTransition('Défi de la semaine', ZONES[state.challenge.zone].name, 'Des vagues toujours plus fortes : tenez le plus longtemps possible.', ZONES[state.challenge.zone].id);
    done(true, 'Défi de la semaine : vague 1 !', '#ffb36b');
  },
  leaveChallenge() {
    const r = endChallenge(state);
    resetWave(world);
    if (r) backToCampaign();
    done(Boolean(r), r ? `Défi terminé : ${r.waves} vague${r.waves > 1 ? 's' : ''} franchie${r.waves > 1 ? 's' : ''}.` : null);
  },
  // Prime du jour (v8.9).
  claimBounty() {
    const r = claimBounty(state, rng);
    done(Boolean(r), r ? `Prime du jour : ${r.item.name} (${rarityById(r.item.rarity).label}) et +${r.gems} gemmes` : null, '#ffe08a');
  },
  // Coffre (v8.9).
  toStash(id) { done(moveToStash(state, id), 'Rangé au coffre'); },
  fromStash(id) {
    if (!takeFromStash(state, id)) ui.toast('Sac plein.', '#ff8a8a');
    else done(true, 'Repris dans le sac');
  },
  // v9.1.3 : mannequins fondus dans le coffre — « Porter » un ensemble depuis le coffre.
  wearSet(setId) {
    const n = wearSet(state, setId);
    done(n > 0, n ? `${n} pièce${n > 1 ? 's' : ''} d'ensemble équipée${n > 1 ? 's' : ''}` : null, '#ffe08a');
  },
  setAutoMannequin(on) { state.ui.autoMannequin = on; done(true); },
  // Musée (v9.0).
  toMuseum(id) {
    if (!putInMuseum(state, id)) ui.toast('Impossible : pas un objet ancestral, ou sac et coffre pleins.', '#ff8a8a');
    else done(true, 'Exposé au Musée', '#ffe08a');
  },
  fromMuseum(baseId) {
    if (!takeFromMuseum(state, baseId)) ui.toast('Sac et coffre pleins.', '#ff8a8a');
    else done(true, 'Repris dans le sac');
  },
  setAutoMuseum(on) {
    state.ui.autoMuseum = on;
    const n = on ? exposeAll(state) : 0;
    done(true, n ? `${n} objet${n > 1 ? 's' : ''} ancestra${n > 1 ? 'ux' : 'l'} exposé${n > 1 ? 's' : ''} au Musée` : null, '#ffe08a');
  },
  recycleMuseumDuplicates() {
    let gold = 0;
    let n = 0;
    for (const item of museumDuplicates(state)) { gold += recycleItem(state, item.id); n += 1; }
    for (const j of journals()) noteRecycled(j, n, gold);
    done(n > 0, n ? `${n} doublon${n > 1 ? 's' : ''} du Musée recyclé${n > 1 ? 's' : ''} : +${formatNumber(gold)} or` : null, '#ffe08a');
  },
  exposeAll() {
    const n = exposeAll(state);
    done(true, n ? `${n} objet${n > 1 ? 's' : ''} ancestra${n > 1 ? 'ux' : 'l'} exposé${n > 1 ? 's' : ''} au Musée` : 'Rien de mieux à exposer (les objets portés restent sur le héros).', '#ffe08a');
  },
  setKeepSets(on) {
    state.ui.keepSets = on;
    lastSweep = 0;
    done(true, on ? 'Pièces d\'ensemble utiles gardées' : 'Pièces d\'ensemble recyclées comme les autres objets');
  },
  markSeen(tab) {
    state.ui.seenTabs = [...new Set([...(state.ui.seenTabs ?? []), tab])];
    done(true);
  },
  setNotify(key, on) { state.ui.notify = { ...state.ui.notify, [key]: on }; done(true); },
  setCinematics(on) { state.ui.cinematics = on; done(true); },
  startTour() { ui.closeModal(); startTour(ui, state); },
  skipTour() { state.ui.tour = 'done'; state.ui.tourV = TOUR_VERSION; ui.closeModal(); save(); },
  setAutoRecycle(value) {
    state.ui.autoRecycle = value;
    ui.invalidate();
  },
  setFilter(value) {
    state.ui.slotFilter = value;
    ui.invalidate();
  },
  setSort(value) {
    state.ui.sortBy = value;
    ui.invalidate();
  },
  async setAlwaysOnTop(value) {
    if (!window.desktop) return;
    ui.desktop.alwaysOnTop = await window.desktop.setAlwaysOnTop(value);
    ui.invalidate();
  },
  // Mises à jour : la dernière release GitHub est comparée à la version lancée.
  async checkUpdate(quiet = false) {
    ui.updateInfo = { ...ui.updateInfo, busy: true };
    ui.invalidate();
    let release = null;
    let error = null;
    try {
      // Version bureau : requête faite par le processus principal (pas de restriction réseau de la page).
      const token = githubToken();
      const json = window.desktop?.checkUpdate ? await window.desktop.checkUpdate(token)
        : await fetch(RELEASES_API, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
          .then((res) => (res.ok ? res.json() : { error: `GitHub ${res.status}${res.status === 404 && !token ? ' (dépôt privé ?)' : ''}` }));
      if (json?.error) error = json.error;
      else release = parseRelease(json);
    } catch (e) { error = String(e?.message ?? e); }
    if (!release && !window.desktop?.checkUpdate) {
      // Secours : liste des versions publiées via jsDelivr (si l'API GitHub est bloquée ou limitée).
      try {
        const res = await fetch(TAGS_FALLBACK_API);
        if (res.ok) release = parseTagList(await res.json());
      } catch (e) { error = `${error ?? ''} · secours : ${e?.message ?? e}`; }
    }
    const current = ui.desktop?.version ?? GAME_VERSION;
    ui.updateInfo = { busy: false, release, status: updateStatus(current, release), checkedAt: Date.now(), error: release ? null : error };
    if (ui.updateInfo.status === 'available') ui.toast(`Mise à jour ${release.version} disponible (Paramètres)`, '#7fe0ff');
    else if (!quiet) ui.toast(ui.updateInfo.status === 'uptodate' ? 'Le jeu est à jour.' : 'Impossible de joindre GitHub.', ui.updateInfo.status === 'uptodate' ? '#8ef0a0' : '#ff8a8a');
    ui.invalidate();
  },
  async installUpdate() {
    if (!window.desktop?.installUpdate) {
      window.open(ui.updateInfo?.release?.url ?? RELEASES_PAGE, '_blank', 'noopener');
      return;
    }
    save();
    ui.updateInfo = { ...ui.updateInfo, installing: true, error: null };
    ui.invalidate();
    const result = await window.desktop.installUpdate(githubToken());
    ui.updateInfo = { ...ui.updateInfo, installing: result.ok, error: result.ok ? null : result.error };
    if (result.ok) ui.toast(`Installation de la ${result.version}… le jeu va redémarrer.`, '#7fe0ff');
    else ui.toast(`Mise à jour impossible : ${result.error}`, '#ff8a8a');
    ui.invalidate();
  },
  async retryInstaller() {
    save();
    const r = await window.desktop?.retryInstaller?.();
    if (!r?.ok) { ui.toast(r?.error ?? 'Installateur introuvable.', '#ff8a8a'); this.openReleases(); }
  },
  // Jeton GitHub (dépôt privé) : gardé uniquement dans ce navigateur / ce PC, jamais dans la sauvegarde.
  cloudRegister(pseudo, password) { cloudAuth(() => cloud.register(pseudo, password), 'Compte créé, progression envoyée'); },
  // Connexion à un compte existant : la progression du compte remplace celle de l'appareil (copie gardée).
  cloudLogin(pseudo, password) { cloudAuth(() => cloud.login(pseudo, password), 'Connecté : progression du compte chargée', true); },
  // v9.1.1 : invité -> compte joueur (nom + mot de passe), puis changement de nom.
  cloudClaim(pseudo, password, confirm) {
    if (password !== confirm) { setCloudMessage('Les deux mots de passe ne correspondent pas.', true); return; }
    cloudAuth(() => cloud.claim(pseudo, password), `Compte joueur créé : vous êtes maintenant ${pseudo}`);
  },
  cloudRename(pseudo, password) { cloudAuth(() => cloud.rename(pseudo, password), `Nom changé : vous êtes maintenant ${pseudo}`); },
  cloudLogout() {
    if (cloud.isGuest()) { setCloudMessage("Créez d'abord votre compte joueur : sans lui, cette progression ne pourrait plus être retrouvée.", true); return; }
    cloud.logout().then(() => setCloudMessage('Déconnecté. La partie reste sur cet appareil.'));
  },
  cloudResume() { cloudAuth(() => cloud.guest(), 'Sauvegarde en ligne réactivée'); },
  cloudSync() { cloudSync(true); },
  cloudListed(listed) {
    cloud.setListed(listed)
      .then(() => {
        try { localStorage.setItem('idle-rpg.cloud-listed', listed ? '1' : '0'); } catch { /* indisponible */ }
        setCloudMessage(listed ? 'Vous apparaissez dans le classement.' : 'Vous êtes masqué du classement.');
      })
      .catch((err) => setCloudMessage(err.message || 'Mise à jour impossible', true));
  },
  cloudDelete(password) {
    cloud.deleteAccount(password)
      .then(() => setCloudMessage('Compte et sauvegarde cloud supprimés. La partie reste sur cet appareil.'))
      .catch((err) => setCloudMessage(err.message || 'Suppression impossible', true));
  },
  setGithubToken(value) {
    const token = String(value ?? '').trim();
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
    } catch { /* stockage indisponible */ }
    ui.toast(token ? 'Jeton GitHub enregistré sur ce PC.' : 'Jeton GitHub supprimé.', '#8ef0a0');
    this.checkUpdate();
  },
  openReleases() {
    if (window.desktop?.openReleases) window.desktop.openReleases();
    else window.open(ui.updateInfo?.release?.url ?? RELEASES_PAGE, '_blank', 'noopener');
  },
  setWindowSize(preset) {
    if (!window.desktop) return;
    ui.forgetSideGrow();
    window.desktop.setSizePreset(preset);
  },
  saveNow() {
    save();
    ui.toast('Partie sauvegardée');
    ui.invalidate();
  },
  // Test des gains hors ligne : version dev seulement (il applique les vrais gains, sans limite).
  simulateAbsence(seconds) {
    if (!BUILD.cheats) return;
    const now = Date.now();
    runOffline(now - seconds * 1000, now);
  },
  // v9.1.0 : réinitialisation confirmée par la saisie de EFFACER (fenêtre du jeu), puis rechargement : journal,
  // état de l'interface, prévision et tutoriel repartent de zéro.
  reset() {
    clearSave(store);
    state = createNewState(Date.now());
    saveGame(state, store, Date.now());
    reloadPage();
  },
  // Export : fichier .json (téléchargé) ou code à copier.
  exportSave(kind = 'file') {
    save();
    const json = store.getItem(SAVE_KEY) ?? JSON.stringify(state);
    if (kind === 'code') {
      const code = encodeSaveCode(json);
      ui.view.exportCode = code;
      navigator.clipboard?.writeText(code).then(() => ui.toast('Code de sauvegarde copié.', '#8ef0a0'), () => ui.toast('Code affiché ci-dessous : copiez-le.'));
      ui.invalidate();
      return;
    }
    const d = new Date();
    const name = `idle-rpg-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-niv${state.level}.json`;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    ui.toast(`Partie exportée : ${name}`, '#8ef0a0');
  },
  // Import : la partie est validée, l'actuelle est copiée à part, puis le jeu redémarre sur la partie importée.
  importSave(text) {
    const r = parseImport(text, BALANCE, Date.now());
    if (r.error) { ui.toast(r.error, '#ff8a8a'); return false; }
    try {
      if (!writeImported(r.state, store)) throw new Error('écriture');
    } catch {
      ui.toast('Import impossible : stockage plein ou bloqué.', '#ff8a8a');
      return false;
    }
    reloadPage();
    return true;
  },
};

const ui = new UI(document.getElementById('app'), actions);
if (BUILD.cheats) import('./core/cheat-codes.js').then((m) => { cheatCodes = m; ui.cheatCodes = m; ui.invalidate(); });

// Compte et sauvegarde cloud (optionnels) : le jeu fonctionne sans, via localStorage.
const platform = window.desktop ? 'windows' : window.Capacitor?.isNativePlatform?.() ? 'android' : 'web';
const cloud = createCloudClient({ baseUrl: CLOUD_BASE, storage: store, client: { platform, version: GAME_VERSION } });
const cloudView = { busy: false, message: '', error: false };
ui.cloud = cloudView;
function setCloudMessage(text, error = false) {
  cloudView.busy = false;
  cloudView.loggedIn = cloud.isLoggedIn();
  cloudView.pseudo = cloud.pseudo() ?? '';
  cloudView.guest = cloud.isGuest();
  cloudView.optedOut = cloud.optedOut();
  try { cloudView.listed = localStorage.getItem('idle-rpg.cloud-listed') !== '0'; } catch { cloudView.listed = true; }
  cloudView.message = text;
  cloudView.error = error;
  ui.invalidate();
}
// Recharge la partie depuis le localStorage (après une synchronisation qui a ramené une partie plus récente).
function reloadFromStore() {
  const next = loadGame(store, BALANCE, Date.now());
  if (next.source === 'newer') return;
  state = next.state;
  world = createCombat(state);
  ui.invalidate();
}
// v9.1.1 : au premier lancement, un compte invité « joueurXXXXXX » est créé tout seul et la progression est
// sauvegardée sur le serveur. Pas si le joueur s'est déconnecté exprès (il se reconnecte quand il veut).
// Jamais pendant les tests automatisés (CI, smoke) : ils ne doivent pas créer de comptes sur le vrai serveur.
function canCreateGuest() {
  return !cloud.optedOut() && !navigator.webdriver && !window.desktop?.automated;
}
async function ensureGuest() {
  if (cloud.isLoggedIn() || !canCreateGuest()) return;
  await cloud.guest();
}
async function cloudSync(manual = false, preferRemote = false) {
  if (!BUILD.cloud || cloudView.busy) return;
  if (!cloud.isLoggedIn() && !canCreateGuest()) return;
  cloudView.busy = true;
  try {
    await ensureGuest();
    if (!cloud.isLoggedIn()) { cloudView.busy = false; return; }
    // Sauvegarde locale juste avant l'envoi (jamais avant le calcul hors ligne du lancement : sans compte et
    // sans invité possible, on est sorti plus haut).
    // v9.1.3 : jamais d'envoi quand l'écriture est bloquée (partie d'une version plus récente) : la partie en
    // mémoire est périmée et écraserait la migration faite ailleurs.
    if (saveBlocked) { cloudView.busy = false; return; }
    save();
    const { action, newerVersion } = await syncOnce({ client: cloud, storage: store, preferRemote, maxSaveVersion: SAVE_VERSION });
    if (action === 'newer') {
      saveBlocked = true;
      cloudView.busy = false;
      setCloudMessage('Votre partie en ligne vient d\'une version plus récente du jeu : mettez le jeu à jour. Rien n\'est écrasé.', true);
      ui.showNewerSave(newerVersion);
      return;
    }
    if (action === 'pull') reloadFromStore();
    cloudView.busy = false;
    const when = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setCloudMessage(manual || action !== 'none' ? `Synchronisé à ${when}` : cloudView.message);
  } catch (err) {
    if (err instanceof CloudError && err.status === 401) {
      // Invité expiré : un nouvel invité reprendra la partie de l'appareil au prochain essai.
      if (cloud.isGuest()) { cloud.forget(); setCloudMessage(''); return; }
      cloud.logout();
      setCloudMessage('Session expirée : reconnectez-vous.', true);
    } else {
      // 404 sur /api/guest : serveur pas encore en 9.1.1 (pas de compte automatique) ; il reste la création de compte.
      setCloudMessage(err instanceof CloudError && err.status === 404
        ? 'Compte automatique indisponible sur ce serveur : créez un compte joueur ci-dessous. La partie est sauvegardée sur cet appareil.'
        : 'Serveur injoignable : la partie est sauvegardée sur cet appareil.', true);
    }
  }
}
async function cloudAuth(call, okText, preferRemote = false) {
  cloudView.message = '';
  cloudView.error = false;
  if (cloudView.busy) return;
  cloudView.busy = true;
  ui.invalidate();
  try {
    await call();
  } catch (err) {
    setCloudMessage(err instanceof CloudError && err.status !== 0 ? err.message : 'Serveur injoignable.', true);
    return;
  }
  cloudView.busy = false;
  await cloudSync(false, preferRemote);
  if (!cloudView.error) setCloudMessage(okText);
}
// Synchronisation périodique et au retour sur l'onglet ; une fois au lancement si déjà connecté.
setInterval(() => cloudSync(), 60 * 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cloudSync(); });
// Nom et type de compte à jour (renommé depuis un autre appareil), puis première synchronisation.
// Ne pas effacer un message d'erreur posé par la synchronisation (serveur injoignable, pas à jour…).
const refreshCloudView = () => { if (!cloudView.error) setCloudMessage(''); };
if (BUILD.cloud && cloud.isLoggedIn()) cloud.refresh().catch(() => {}).finally(() => { refreshCloudView(); cloudSync(); });
else cloudSync().then(refreshCloudView);
// Journal de session (v8.5) : depuis le lancement, et pendant la dernière absence.
const sessionJournal = createJournal(state);
let awayJournal = null;
const journals = () => (awayJournal ? [sessionJournal, awayJournal] : [sessionJournal]);
ui.sessionJournal = () => journalSummary(sessionJournal, state);
// Langue (français / anglais) : la page entière est traduite à la volée.
startAutoTranslate(document.body);
// v9.1.0 : « Mode concentration » et « Effets animés » deviennent « Réduire les animations » (réglage de l'appareil).
if ((state.ui.focus || state.ui.themeFx === false) && !hasPref('motion')) setPref('motion', 'reduce');
state.ui.focus = false;
delete state.ui.themeFx;
// Thème d'interface (v9.0).
if (state.ui.theme && state.ui.theme !== 'knight') applyTheme(state.ui.theme);

// Musique et sons (moteur procédural) : démarrés au premier geste du joueur (règle des navigateurs).
const sound = createGameAudio();
ui.sound = sound;
const unlockAudio = () => sound.unlock();
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
document.addEventListener('click', (e) => { if (e.target.closest('button')) sound.play('click', { volume: 0.5 }); }, { capture: true });

// Version bureau (Electron) : options de fenêtre exposées par desktop/preload.cjs.
if (window.desktop) {
  window.desktop.getInfo().then((info) => {
    ui.desktop = info;
    // v9.0.2 : la dernière mise à jour n'a pas pu s'installer → on le dit et on propose de réessayer.
    if (info.updateFailed) ui.showUpdateFailed(info.updateFailed);
    ui.invalidate();
  });
}
// Vérification discrète des mises à jour au lancement.
// (désactivée pendant les tests automatisés : pas d'appel réseau réel, voir tools/smoke.mjs).
setTimeout(() => { if (!navigator.webdriver && !ui.desktop?.smoke) actions.checkUpdate(true); }, 4000);

// Gains hors ligne depuis la dernière sauvegarde.
// v9.0.3 : exposition auto des objets ancestraux déjà dans le sac ou le coffre.
if (state.ui.autoMuseum !== false) exposeAll(state);
if (loaded.source === 'main' || loaded.source === 'backup') runOffline(state.lastSaved, Date.now());
else save();
// v9.1.0 : le joueur est prévenu quand sa partie n'est pas lue normalement.
if (loaded.source === 'newer') setTimeout(() => ui.showNewerSave(loaded.newerVersion), 300);
else if (loaded.source === 'backup') setTimeout(() => ui.toast('Sauvegarde principale illisible : la partie a repris sur la copie de secours.', '#ffb36b'), 2500);
if (storageMissing) setTimeout(() => ui.toast('⚠ Stockage indisponible : la partie ne sera pas conservée à la fermeture.', '#ff8a8a'), 3000);

// Cinématiques (v8.1) : au lancement, puis à chaque arrivée dans un nouveau monde (en avançant).
const cinematicsOn = () => state.ui.cinematics !== false && !navigator.webdriver && !ui.desktop?.smoke;
setTimeout(() => {
  if (!cinematicsOn()) return;
  const zone = ZONES[currentEncounter(state).zoneIndex];
  if (loaded.source === 'new') playCinematic({ kicker: 'Une nouvelle légende', title: 'Ascendrya', line: 'Un héros, une épée, et onze mondes à libérer.' });
  else playCinematic({ kicker: 'Bon retour', title: zone.name, line: `Étape ${stageLabel(state.stage)} — la bataille continue.`, zone: zone.id });
}, 600);
// v8.4 : sauvegarde d'avant le nouvel équilibrage → or des améliorations remboursé, on l'annonce.
// v8.5 : nouvel arbre de talents → fragments de l'ancien rendus, on l'annonce.
if (state.migrationTalentRefund) {
  const refund = state.migrationTalentRefund;
  delete state.migrationTalentRefund;
  save();
  setTimeout(() => ui.showTreeNotice(refund), 1700);
}
if (state.migrationRefund) {
  const refund = state.migrationRefund;
  delete state.migrationRefund;
  save();
  setTimeout(() => ui.showRebalanceNotice(refund), 1500);
}
// v9.0.6 : découverte guidée — après la cinématique et une fois les fenêtres d'accueil (absence, annonces) fermées.
// Jamais pendant les tests automatisés (sauf ?tour dans l'adresse).
if ((state.ui.tour !== 'done' || (state.ui.tourV ?? 1) < TOUR_VERSION) && (!navigator.webdriver || location.search.includes('tour'))) {
  let waited = 0;
  const tryTour = () => {
    waited += 1;
    const busy = !document.getElementById('modal').classList.contains('hidden') || document.querySelector('.cinematic, .summon-fx');
    if (busy && waited < 120) { setTimeout(tryTour, 1000); return; }
    maybeStartTour(ui, state);
  };
  setTimeout(tryTour, navigator.webdriver ? 300 : 4200);
}
announceSynergies(); // mémorise les synergies du chargement (seules les nouvelles seront annoncées)
let lastZoneKey = null;
let lastCinematicAt = -Infinity;
// v8.9 : transition en nuages à chaque changement de lieu (campagne ↔ donjon, tour, défi), au plus une toutes les 8 s.
function placeTransition(kicker, title, line = '', zone = null) {
  const now = performance.now();
  if (!cinematicsOn() || now - lastCinematicAt < 8000) return;
  lastCinematicAt = now;
  playTransition({ kicker, title, line, zone, duration: 3000 });
}
function backToCampaign() {
  const zone = ZONES[currentEncounter(state).zoneIndex];
  placeTransition('Retour à la campagne', zone.name, `Étape ${stageLabel(state.stage)}`, zone.id);
}
const RETURN_EVENTS = new Set(['dungeonComplete', 'dungeonFailed', 'towerFailed', 'towerCollapsed', 'challengeFailed']);
// Animation de changement de monde : en campagne (nouveau monde en avançant) et, v8.7, dans la Tour de
// l'Éternité (nouveau décor tous les 10 étages). Au plus une toutes les 15 s (combats passés, ×100…).
function watchWorldChange() {
  if (state.dungeon) return;
  const enc = currentEncounter(state);
  const key = state.tower ? `tower:${enc.zoneIndex}` : state.challenge ? `challenge:${enc.zoneIndex}` : `${cycleForStage(state.stage)}:${enc.zoneIndex}`;
  const forward = state.tower ? true : state.stage > (watchWorldChange.lastStage ?? 0);
  const now = performance.now();
  if (lastZoneKey !== null && key !== lastZoneKey && forward && !state.challenge && cinematicsOn() && now - lastCinematicAt > 15000) {
    lastCinematicAt = now;
    if (state.tower) {
      playTransition({ kicker: `Tour de l'Éternité · étage ${state.tower.floor}`, title: ZONES[enc.zoneIndex].name, line: 'Les murs de la tour changent : un nouveau monde s\'élève.', zone: ZONES[enc.zoneIndex].id, duration: 3200 });
    } else {
      const cycle = cycleForStage(state.stage);
      worldCinematic(ZONES[enc.zoneIndex], cycle ? ` · difficulté ×${cycle + 1}` : '');
    }
  }
  lastZoneKey = key;
  watchWorldChange.lastStage = state.stage;
}

// Simulation à pas fixe, pilotée par l'horloge murale pour rattraper les retards
// (onglet en arrière-plan, minuterie ralentie). Une longue interruption (veille)
// est traitée comme une absence hors ligne.
// v8.5 (anti-gel) : chaque appel ne calcule qu'au plus TICK_BUDGET_MS de simulation ; le retard qui
// dépasse MAX_BACKLOG_SECONDS (temps réel) est abandonné au lieu d'être rattrapé d'un bloc. Avant, une
// fenêtre ralentie par Windows pouvait demander des centaines de milliers de pas d'un coup → écran noir.
const TICK_BUDGET_MS = 25;
const MAX_BACKLOG_SECONDS = 1;
let lastWall = Date.now();
let accumulator = 0;
let lastMissionCheck = 0;
let lastSweep = 0;
let awaySeconds = 0; // fenêtre masquée et minuterie très ralentie : crédité en gains hors ligne au retour
const perf = { simulated: 0, real: 0, effective: 1, worstTickMs: 0, stalls: 0, lastStall: null, steps: 0, fps: 0 };
ui.perf = perf;
function tick() {
  const now = Date.now();
  // Réinitialisations journalières / hebdomadaires / mensuelles et connexion du jour.
  if (now - lastMissionCheck >= 1000) {
    lastMissionCheck = now;
    refreshMissions(state, now);
  }
  let dt = (now - lastWall) / 1000;
  lastWall = now;
  if (dt < 0) dt = 0; // horloge reculée : on ignore
  if (dt > BALANCE.simulation.maxCatchUpSeconds) {
    accumulator = 0;
    // Fenêtre masquée : on garde ce temps pour le rapport de retour (un seul, au lieu d'un par minute).
    if (document.visibilityState === 'hidden') awaySeconds += dt;
    else runOffline(now - dt * 1000, now);
    return;
  }
  // Vitesse des combats choisie par le joueur (×1 ; ×2, ×5, ×10, ×100 par code).
  const speed = simSpeed(state);
  // Combats passés (code SKIPBATTLE) : moitié moins de temps de calcul par appel, pour garder l'affichage fluide.
  const budget = state.cheats.skipBattle ? TICK_BUDGET_MS / 2 : TICK_BUDGET_MS;
  accumulator += dt * speed;
  const stepSeconds = BALANCE.simulation.tickSeconds;
  const t0 = performance.now();
  let steps = 0;
  while (accumulator >= stepSeconds) {
    step(state, world, stepSeconds, rng);
    accumulator -= stepSeconds;
    steps += 1;
    if ((steps & 7) === 0 && performance.now() - t0 > budget) break;
  }
  // Le PC ne suit pas : le retard au-delà de ce plafond est abandonné (la vitesse réelle baisse, sans gel).
  accumulator = state.cheats.skipBattle ? 0 : Math.min(accumulator, Math.max(BALANCE.simulation.maxCatchUpSeconds, MAX_BACKLOG_SECONDS * speed));
  const spent = performance.now() - t0;
  perf.steps = steps;
  perf.simulated += steps * stepSeconds;
  perf.real += dt;
  perf.worstTickMs = Math.max(perf.worstTickMs * 0.995, spent);
  if (perf.real >= 2) {
    perf.effective = perf.simulated / perf.real;
    perf.simulated = 0;
    perf.real = 0;
  }
  world.heroStats = computeHeroStats(state);
  // Recyclage « au ramassage » : le sac est trié toutes les 3 s (objets devenus moins bons que l'équipement).
  if (now - lastSweep >= 3000) {
    lastSweep = now;
    // Fusion automatique d'abord (5 objets identiques → rareté supérieure), puis recyclage.
    const fused = autoFuse(state, rng, isUpgrade);
    if (fused.length) {
      for (const j of journals()) noteFused(j, fused.length);
      ui.invalidate();
    }
    const swept = sweepInventory(state);
    if (swept.count) {
      for (const j of journals()) noteRecycled(j, swept.count, swept.gold);
      ui.invalidate();
    }
  }
  if (now - lastSave >= BALANCE.autosaveSeconds * 1000) save();
}
setInterval(tick, SIM_INTERVAL_MS);

let lastFrame = performance.now();
function frame(ts) {
  const gap = ts - lastFrame;
  const dt = Math.min(0.1, gap / 1000);
  lastFrame = ts;
  // Témoin de performances : images par seconde et « gels » (image affichée plus de 0,5 s après la précédente).
  perf.fps = perf.fps ? perf.fps * 0.95 + (1000 / Math.max(1, gap)) * 0.05 : 60;
  if (gap > 500 && document.visibilityState === 'visible' && ts > 5000) {
    perf.stalls += 1;
    perf.lastStall = { at: Date.now(), ms: gap };
  }
  perf.enemies = world.enemies.length;
  // Fenêtre visible : la simulation avance à chaque image (la minuterie reste le relais
  // quand la fenêtre est masquée et que requestAnimationFrame s'arrête).
  tick();
  for (const event of world.events) {
    // Vitesse ×100 : plus d'effets visuels (flashs, chiffres, secousses) ni de bannières.
    if (simSpeed(state) < 100) renderer.handleEvent(event, world);
    ui.handleEvent(event, state);
    if (event.type === 'drop') for (const j of journals()) noteDrop(j, event);
    if (RETURN_EVENTS.has(event.type)) backToCampaign();
    sound.handleEvent(event);
  }
  sound.update(state, world, currentEncounter(state).zoneIndex, dt);
  world.events.length = 0;
  watchWorldChange();
  renderer.calm = ui.calm;
  renderer.render(state, world, dt);
  ui.update(state, world);
  animateMenus(document.body, state, ts);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Retour après une absence (fenêtre réduite ou masquée) : le temps non simulé est crédité en gains
// hors ligne, et le journal de l'absence est affiché si elle a duré au moins 5 minutes (v8.5).
const AWAY_JOURNAL_SECONDS = 300;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    save();
    sound.suspend();
    awayJournal = createJournal(state);
  } else {
    sound.resume();
    const journal = awayJournal;
    awayJournal = null;
    const now = Date.now();
    lastWall = now;
    const away = awaySeconds;
    awaySeconds = 0;
    const long = journal && (now - journal.start.at) / 1000 >= AWAY_JOURNAL_SECONDS;
    if (away > 0) runOffline(now - away * 1000, now, long ? journal : null);
    else if (long) ui.showJournal(journalSummary(journal, state, now), 'away');
  }
});
window.addEventListener('pagehide', save);

// Points d'accès pour les tests automatisés (tools/smoke.mjs, desktop/main.cjs --smoke).
// v9.1.0 : la version publique n'expose que la sauvegarde (appelée par la version bureau à la fermeture),
// l'origine de la partie et une copie des compteurs (test de l'exe) ; l'état et les actions restent réservés
// à la version dev et aux tests automatisés (navigateur piloté).
const DEV_ACCESS = BUILD.cheats || navigator.webdriver === true;
window.__idle = {
  loadSource: loaded.source,
  save,
  get records() { return { ...state.records }; },
};
if (DEV_ACCESS) {
  Object.defineProperties(window.__idle, {
    state: { get: () => state },
    world: { get: () => world },
  });
  Object.assign(window.__idle, {
    ui,
    renderer, // v9.0.6 : rendu de la scène (tests, captures)
    actions,
    addItem(baseId, rarity = 'common', level = 1) {
      const item = makeItem(state, baseId, rarity, level);
      addToInventory(state, item);
      ui.invalidate();
      return item;
    },
    addRandomItem(minRarity = 'common') {
      const item = generateItem(state, rng, { level: state.stage, minRarity });
      addToInventory(state, item);
      ui.invalidate();
      return item;
    },
  });
}
