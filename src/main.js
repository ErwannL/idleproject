// Point d'entrée : charge la partie, applique les gains hors ligne, puis fait tourner
// la simulation (minuterie, continue même fenêtre réduite) et le rendu (requestAnimationFrame,
// suspendu automatiquement quand la fenêtre est masquée).
import { BALANCE } from './data/balance.js';
import { BOSSES } from './data/enemies.js';
import { changeStage, createCombat, currentEncounter, cycleForStage, resetWave, resumeAdvance, stageLabel, step } from './core/combat.js';
import { ZONES } from './data/zones.js';
import { playCinematic, worldCinematic } from './ui/cinematic.js';
import { activeSynergies, replaceCompanion, toggleCompanion, upgradeCompanion } from './core/companions.js';
import { claimContract } from './core/contracts.js';
import { claimAllMissions, claimLogin, claimMission, claimMissionBonus, mergeReward, refreshMissions } from './core/missions.js';
import { abandonDungeon, setDungeonPath, startDungeon } from './core/dungeon.js';
import { buyUpgradeBulk } from './core/economy.js';
import { buyFromMerchant, claimEvent, dismissEvent } from './core/events.js';
import { autoFuse, craftItem, fuseItems, reforgeItem, sharpenItem, upgradeItem } from './core/forge.js';
import { summon } from './core/gacha.js';
import { setActiveHero } from './core/heroes.js';
import { addToInventory, bulkRecycleCandidates, equipItem, isUpgrade, recycleItem, recycleMatching, recycleRules, sweepInventory, toggleLock } from './core/inventory.js';
import {
  bossDungeon, bossFirstStage, claimMastery, powerById, powerSlots, rerollPower, resolveReroll, setPowerActive,
} from './core/powers.js';
import { buyTalent, performRebirth } from './core/rebirth.js';
import { buyPerk } from './core/prestige.js';
import { activateRush, rushById, upgradeRush } from './core/rushes.js';
import { rewardText } from './core/rewards.js';
import { learnSkill } from './core/skills.js';
import { generateItem, makeItem, rarityById } from './core/loot.js';
import { STAT_LABELS } from './data/items.js';
import { applyOfflineRewards, computeOfflineRewards } from './core/offline.js';
import { Rng } from './core/rng.js';
import { clearSave, loadGame, saveGame } from './core/save.js';
import { createNewState } from './core/state.js';
import { computeHeroStats } from './core/stats.js';
import { formatNumber } from './core/format.js';
import { SceneRenderer } from './render/scene.js';
import { UI } from './ui/ui.js';
import { animateMenus } from './ui/animator.js';
import { createGameAudio } from './audio/game-audio.js';
import { applyCheat } from './core/cheats.js';
import { applyLoadout, saveLoadout } from './core/loadouts.js';
import { claimCollection } from './core/codex.js';
import { setLang, startAutoTranslate, t } from './i18n/i18n.js';
import { GAME_VERSION } from './version.js';
import { RELEASES_API, RELEASES_PAGE, TAGS_FALLBACK_API, parseRelease, parseTagList, updateStatus } from './core/update.js';

const SIM_INTERVAL_MS = 100;

function storage() {
  try {
    return window.localStorage;
  } catch {
    // Stockage indisponible : la partie fonctionne mais n'est pas conservée.
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
function save() {
  saveGame(state, store, Date.now());
  lastSave = Date.now();
}

function runOffline(fromMs, nowMs) {
  const rewards = computeOfflineRewards(state, fromMs, nowMs, rng);
  const summary = applyOfflineRewards(state, rewards);
  if (rewards.clockSuspicious || rewards.elapsedSeconds >= BALANCE.offline.minSecondsForSummary) {
    ui.showOffline(summary);
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

const actions = {
  learnSkill(id) { done(learnSkill(state, id)); },
  setSkillAuto(value) { state.skillAuto = value; done(true); },
  setHero(id) { done(setActiveHero(state, id), 'Nouveau héros actif'); },
  toggleCompanion(id) {
    if (!toggleCompanion(state, id)) ui.toast(`Deux compagnons au maximum : retirez-en un d'abord.`);
    else done(true);
  },
  saveLoadout(i) { done(saveLoadout(state, i), `Configuration « ${state.loadouts[i].name} » enregistrée`); },
  applyLoadout(i) { done(applyLoadout(state, i), `Configuration « ${state.loadouts[i].name} » équipée`); },
  claimCollection(id) {
    const given = claimCollection(state, id);
    done(Boolean(given), given ? `Collection : ${rewardText(given)}` : null, '#f2d083');
  },
  replaceCompanion(newId, oldId) {
    ui.view.replaceFor = null;
    done(replaceCompanion(state, newId, oldId), 'Équipe modifiée');
  },
  upgradeCompanion(id) { done(upgradeCompanion(state, id)); },
  summon(count, currency, pool = 'ally') {
    const results = summon(state, rng, count, currency, BALANCE, pool === 'pet' ? 'pet' : 'ally');
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
    const label = stat === 'main' ? 'effet principal' : STAT_LABELS[stat];
    done(Boolean(stat), stat ? `Amélioration : ${label} +${BALANCE.forge.upgradeBoostPct} %` : null, '#7fe08f');
  },
  fuse(slot, rarity) {
    const item = fuseItems(state, slot, rarity, rng);
    if (item) sound.play('loot', { rarity: item.rarity });
    if (item) ui.view.selectedItemId = item.id;
    done(Boolean(item), item ? `Fusion : ${item.name} (${rarityById(item.rarity).label})` : null, rarityById(item?.rarity ?? 'common').color);
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
    if (state.dungeon) {
      ui.toast("Terminez ou abandonnez d'abord le donjon.");
      return;
    }
    state.autoAdvance = false;
    changeStage(state, world, bossFirstStage(bossId));
    done(true, `${BOSSES[bossId].name} : le chevalier l'affronte en boucle (mode farm)`);
  },
  enterDungeon(id, slot, path, difficulty) {
    if (!startDungeon(state, id, slot, path, difficulty)) return;
    resetWave(world);
    done(true, 'Expédition lancée');
  },
  abandonDungeon() {
    abandonDungeon(state);
    resetWave(world);
    done(true, 'Retour à la campagne');
  },
  setDungeonPath(path) { done(setDungeonPath(state, path)); },
  claimMission(period, id) {
    const given = claimMission(state, period, id);
    done(Boolean(given), given ? `Mission accomplie : ${rewardText(given)}` : null, '#7fd4ff');
  },
  claimMissionBonus(period) {
    const given = claimMissionBonus(state, period);
    done(Boolean(given), given ? `Coffre de missions : ${rewardText(given)}` : null, '#7fd4ff');
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
    if (!n) ui.toast('Rien à récupérer pour le moment.');
    else done(true, `Tout récupéré : ${rewardText(total)}`, '#7fd4ff');
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
    }
  },
  recycle(id) {
    const gold = recycleItem(state, id);
    if (gold > 0) {
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
  cheat(code) {
    const msg = applyCheat(state, code);
    if (msg) done(true, msg, '#ffe08a');
    else ui.toast('Code inconnu.', '#ff8a8a');
  },
  buyPerk(id) { done(buyPerk(state, id), 'Bonus éternel amélioré', '#ffe08a'); },
  selectStage(stage) {
    changeStage(state, world, stage);
    save();
    ui.invalidate();
  },
  advance() {
    resumeAdvance(state, world);
    save();
    ui.invalidate();
  },
  setAutoAdvance(value) {
    state.autoAdvance = value;
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
    const rules = { ...recycleRules(state) };
    if (group === 'mode') rules.mode = value;
    else rules[group] = rules[group].includes(value) ? rules[group].filter((v) => v !== value) : [...rules[group], value];
    state.ui.recycle = rules;
    // Les nouvelles règles s'appliquent tout de suite aux objets déjà dans le sac.
    const swept = sweepInventory(state);
    done(true, swept.count ? `${swept.count} objet${swept.count > 1 ? 's' : ''} recyclé${swept.count > 1 ? 's' : ''} (+${formatNumber(swept.gold)} or)` : null);
  },
  setLanguage(lang) { setLang(lang); ui.invalidate(); },
  cycleSpeed() {
    const speeds = BALANCE.simulation.speeds;
    state.ui.speed = speeds[(speeds.indexOf(state.ui.speed ?? 1) + 1) % speeds.length];
    done(true, `Vitesse des combats ×${state.ui.speed}`);
  },
  setNotify(key, on) { state.ui.notify = { ...state.ui.notify, [key]: on }; done(true); },
  setFocus(on) { state.ui.focus = on; done(true); },
  setCinematics(on) { state.ui.cinematics = on; done(true); },
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
      const json = window.desktop?.checkUpdate ? await window.desktop.checkUpdate()
        : await fetch(RELEASES_API).then((res) => (res.ok ? res.json() : { error: `GitHub ${res.status}` }));
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
    const result = await window.desktop.installUpdate();
    ui.updateInfo = { ...ui.updateInfo, installing: result.ok, error: result.ok ? null : result.error };
    if (result.ok) ui.toast(`Installation de la ${result.version}… le jeu va redémarrer.`, '#7fe0ff');
    else ui.toast(`Mise à jour impossible : ${result.error}`, '#ff8a8a');
    ui.invalidate();
  },
  openReleases() {
    if (window.desktop?.openReleases) window.desktop.openReleases();
    else window.open(ui.updateInfo?.release?.url ?? RELEASES_PAGE, '_blank', 'noopener');
  },
  setWindowSize(preset) {
    window.desktop?.setSizePreset(preset);
  },
  saveNow() {
    save();
    ui.toast('Partie sauvegardée');
    ui.invalidate();
  },
  simulateAbsence(seconds) {
    const now = Date.now();
    runOffline(now - seconds * 1000, now);
  },
  reset() {
    if (!window.confirm(t('Effacer définitivement la progression ?'))) return;
    clearSave(store);
    state = createNewState(Date.now());
    world = createCombat(state);
    save();
    ui.invalidate();
  },
};

const ui = new UI(document.getElementById('app'), actions);
// Langue (français / anglais) : la page entière est traduite à la volée.
startAutoTranslate(document.body);

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
    ui.invalidate();
  });
}
// Vérification discrète des mises à jour au lancement.
// (désactivée pendant les tests automatisés : pas d'appel réseau réel, voir tools/smoke.mjs).
setTimeout(() => { if (!navigator.webdriver && !ui.desktop?.smoke) actions.checkUpdate(true); }, 4000);

// Gains hors ligne depuis la dernière sauvegarde.
if (loaded.source !== 'new') runOffline(state.lastSaved, Date.now());
else save();

// Cinématiques (v8.1) : au lancement, puis à chaque arrivée dans un nouveau monde (en avançant).
const cinematicsOn = () => state.ui.cinematics !== false && !navigator.webdriver && !ui.desktop?.smoke;
setTimeout(() => {
  if (!cinematicsOn()) return;
  const zone = ZONES[currentEncounter(state).zoneIndex];
  if (loaded.source === 'new') playCinematic({ kicker: 'Une nouvelle légende', title: 'Idle RPG', line: 'Un chevalier, une épée, et onze mondes à libérer.' });
  else playCinematic({ kicker: 'Bon retour, chevalier', title: zone.name, line: `Étape ${stageLabel(state.stage)} — la bataille continue.`, zone: zone.id });
}, 600);
announceSynergies(); // mémorise les synergies du chargement (seules les nouvelles seront annoncées)
let lastZoneKey = null;
function watchWorldChange() {
  if (state.dungeon) return;
  const enc = currentEncounter(state);
  const key = `${cycleForStage(state.stage)}:${enc.zoneIndex}`;
  if (lastZoneKey !== null && key !== lastZoneKey && state.stage > (watchWorldChange.lastStage ?? 0) && cinematicsOn()) {
    const cycle = cycleForStage(state.stage);
    worldCinematic(ZONES[enc.zoneIndex], cycle ? ` · difficulté ×${cycle + 1}` : '');
  }
  lastZoneKey = key;
  watchWorldChange.lastStage = state.stage;
}

// Simulation à pas fixe, pilotée par l'horloge murale pour rattraper les retards
// (onglet en arrière-plan, minuterie ralentie). Une longue interruption (veille)
// est traitée comme une absence hors ligne.
let lastWall = Date.now();
let accumulator = 0;
let lastMissionCheck = 0;
let lastSweep = 0;
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
    runOffline(now - dt * 1000, now);
    return;
  }
  // Vitesse des combats choisie par le joueur (×1, ×2, ×5, ×10).
  accumulator += dt * (state.ui.speed ?? 1);
  const stepSeconds = BALANCE.simulation.tickSeconds;
  while (accumulator >= stepSeconds) {
    step(state, world, stepSeconds, rng);
    accumulator -= stepSeconds;
  }
  // Fraction du pas en cours : le rendu interpole les positions entre deux pas (mouvement fluide).
  world.alpha = accumulator / stepSeconds;
  world.heroStats = computeHeroStats(state);
  // Recyclage « au ramassage » : le sac est trié toutes les 3 s (objets devenus moins bons que l'équipement).
  if (now - lastSweep >= 3000) {
    lastSweep = now;
    // Fusion automatique d'abord (5 objets identiques → rareté supérieure), puis recyclage.
    const fused = autoFuse(state, rng, isUpgrade);
    if (fused.length) {
      const best = fused.at(-1);
      ui.toast(`Fusion auto : ${fused.length} objet${fused.length > 1 ? 's' : ''} créé${fused.length > 1 ? 's' : ''} (${best.name})`, rarityById(best.rarity).color);
      ui.invalidate();
    }
    if (sweepInventory(state).count) ui.invalidate();
  }
  if (now - lastSave >= BALANCE.autosaveSeconds * 1000) save();
}
setInterval(tick, SIM_INTERVAL_MS);

let lastFrame = performance.now();
function frame(ts) {
  const dt = Math.min(0.1, (ts - lastFrame) / 1000);
  lastFrame = ts;
  // Fenêtre visible : la simulation avance à chaque image (la minuterie reste le relais
  // quand la fenêtre est masquée et que requestAnimationFrame s'arrête).
  tick();
  for (const event of world.events) {
    renderer.handleEvent(event, world);
    ui.handleEvent(event, state);
    sound.handleEvent(event);
  }
  sound.update(state, world, currentEncounter(state).zoneIndex, dt);
  world.events.length = 0;
  watchWorldChange();
  renderer.render(state, world, dt);
  ui.update(state, world);
  animateMenus(document.body, state, ts);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    save();
    sound.suspend();
  } else {
    sound.resume();
  }
});
window.addEventListener('pagehide', save);

// Points d'accès pour les tests automatisés (tools/smoke.mjs, desktop/main.cjs --smoke).
// Utilisés aussi par la version bureau pour sauvegarder à la fermeture.
window.__idle = {
  get state() { return state; },
  get world() { return world; },
  ui,
  loadSource: loaded.source,
  save,
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
};
