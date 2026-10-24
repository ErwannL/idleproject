// Point d'entrée : charge la partie, applique les gains hors ligne, puis fait tourner
// la simulation (minuterie, continue même fenêtre réduite) et le rendu (requestAnimationFrame,
// suspendu automatiquement quand la fenêtre est masquée).
import { BALANCE } from './data/balance.js';
import { changeStage, createCombat, resumeAdvance, step } from './core/combat.js';
import { buyUpgrade } from './core/economy.js';
import { addToInventory, bulkRecycleCandidates, equipItem, recycleItem, recycleMatching, toggleLock } from './core/inventory.js';
import { powerById, rerollPower, resolveReroll, setPowerActive, powerSlots } from './core/powers.js';
import { buyTalent, performRebirth } from './core/rebirth.js';
import { generateItem, makeItem } from './core/loot.js';
import { applyOfflineRewards, computeOfflineRewards } from './core/offline.js';
import { Rng } from './core/rng.js';
import { clearSave, loadGame, saveGame } from './core/save.js';
import { createNewState } from './core/state.js';
import { computeHeroStats } from './core/stats.js';
import { formatNumber } from './core/format.js';
import { SceneRenderer } from './render/scene.js';
import { UI } from './ui/ui.js';

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

const actions = {
  buy(key) {
    if (buyUpgrade(state, key)) {
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
  rebirth() {
    const gained = performRebirth(state);
    if (gained <= 0) return;
    world = createCombat(state);
    save();
    ui.banner(`Renaissance ! +${gained} fragments anciens`, 'win');
    ui.invalidate();
  },
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
    if (!window.confirm('Effacer définitivement la progression ?')) return;
    clearSave(store);
    state = createNewState(Date.now());
    world = createCombat(state);
    save();
    ui.invalidate();
  },
};

const ui = new UI(document.getElementById('app'), actions);

// Version bureau (Electron) : options de fenêtre exposées par desktop/preload.cjs.
if (window.desktop) {
  window.desktop.getInfo().then((info) => {
    ui.desktop = info;
    ui.invalidate();
  });
}

// Gains hors ligne depuis la dernière sauvegarde.
if (loaded.source !== 'new') runOffline(state.lastSaved, Date.now());
else save();

// Simulation à pas fixe, pilotée par l'horloge murale pour rattraper les retards
// (onglet en arrière-plan, minuterie ralentie). Une longue interruption (veille)
// est traitée comme une absence hors ligne.
let lastWall = Date.now();
let accumulator = 0;
function tick() {
  const now = Date.now();
  let dt = (now - lastWall) / 1000;
  lastWall = now;
  if (dt < 0) dt = 0; // horloge reculée : on ignore
  if (dt > BALANCE.simulation.maxCatchUpSeconds) {
    accumulator = 0;
    runOffline(now - dt * 1000, now);
    return;
  }
  accumulator += dt;
  const stepSeconds = BALANCE.simulation.tickSeconds;
  while (accumulator >= stepSeconds) {
    step(state, world, stepSeconds, rng);
    accumulator -= stepSeconds;
  }
  world.heroStats = computeHeroStats(state);
  if (now - lastSave >= BALANCE.autosaveSeconds * 1000) save();
}
setInterval(tick, SIM_INTERVAL_MS);

let lastFrame = performance.now();
function frame(ts) {
  const dt = Math.min(0.1, (ts - lastFrame) / 1000);
  lastFrame = ts;
  for (const event of world.events) {
    renderer.handleEvent(event, world);
    ui.handleEvent(event, state);
  }
  world.events.length = 0;
  renderer.render(state, world, dt);
  ui.update(state, world);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
});
window.addEventListener('pagehide', save);

// Points d'accès pour les tests automatisés (tools/smoke.mjs, desktop/main.cjs --smoke).
// Utilisés aussi par la version bureau pour sauvegarder à la fermeture.
window.__idle = {
  get state() { return state; },
  get world() { return world; },
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
