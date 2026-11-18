// Interface DOM : barre du haut (monnaies, contrats, récompenses, paramètres), surimpressions légères
// de la scène, HUD, onglets débloqués progressivement et panneaux (un module par panneau dans ./panels).
// L'interface ne modifie jamais l'état directement : elle appelle les actions fournies par main.js.
import campPanel from './panels/camp.js'; // v9.7.1 (lot 6)
import { GLOSSARY, GLOSSARY_TERMS } from '../data/glossary.js'; // v9.7.1 (lot 5)
import { rageFree } from '../core/combat.js'; // v9.7.1 (lot 3)
import { isUnlocked } from '../core/unlock-quests.js'; // v9.7.1 (lot 3)
import { COMBO_STEP_PCT, interactiveCooldown } from '../core/combat.js'; // v9.7.1 (lot 2)
import { activeSkills } from '../core/skills.js'; // v9.7.1 (lot 2)
import { LootBag } from './loot-bag.js'; // v9.7.1
import { worldOpensAt } from '../core/seals.js'; // v9.6.5
import { sessionGoalsHtml, sessionGoalsPill } from './session-goals.js';
import { sessionDone } from '../core/session-goals.js'; // v9.8 // v9.6.5
import { teamAdvice as teamAdviceV965 } from '../core/team-advisor.js';
import { BALANCE } from '../data/balance.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { bossTrait } from '../core/boss-traits.js';
import { DUNGEONS } from '../data/dungeons.js';
import { envLine, envChipText } from '../core/environment.js'; // v9.2.1
import { bossTierForStage, currentEncounter, currentEnvironment, difficultyForStage, isBossStage, stageLabel, zoneForStage, zoneIndexForStage } from '../core/combat.js';
import { eventLabel } from '../core/events.js';
import { SUMMON_POOLS, normalizePool } from '../core/gacha.js';
import { formatDecimal, formatDuration, formatNumber } from '../core/format.js';
import { xpForLevel } from '../core/level.js';
import { rarityById } from '../core/loot.js';
import { maxCharges, powerById } from '../core/powers.js';
import { markInvUsed, openUpgrades } from '../core/unlocks.js';
import { buyTalentsCheapest, canRebirth, fragmentsSpent, rebirthBlocked, rebirthGain, rebirthReward, respecCost } from '../core/rebirth.js';
import { REBIRTH, TALENT_BRANCHES } from '../data/rebirth.js';
import { keptRebirthShare, transcendReward } from '../core/transcend.js';
import { TRANSCEND } from '../data/transcend.js';
import { rewardText } from '../core/rewards.js';
import { skillCooldown } from '../core/skills.js';
import { computeHeroStats } from '../core/stats.js';
import { KEY_LABELS, boostKeys, cycleSub, focusables, installShortcuts, keyConflict, keyLabel, setCustomKeys, setMenuCount, shortcutsHtml } from './shortcuts.js';
import { installHoldToRepeat, selectorFor, holdFiredRecently } from './hold.js';
import { installTips } from './tip.js';
import { playSummonReveal } from './summon-fx.js';
import { bossWarningPlan, showBossWarning } from './boss-warning.js'; // v9.1.9
import { queueSkinReveals } from './skin-reveal.js'; // v9.1.9
import { waveCount, waveIndex, waveMode } from '../core/combat.js'; // v9.3.8
import { nextMilestone } from '../core/unlocks.js';
import { UNLOCK_QUESTS, currentQuest, questSteps } from '../core/unlock-quests.js';
// v9.8 (G6) : onglet ouvert par chaque mini-quête (icône du parchemin, icône qui vole vers le menu).
const QUEST_SYS = { equipment: 'inventory', upgrades: 'upgrades', skills: 'skills', companion: 'companions', forge: 'forge', summon: 'summon', dungeons: 'dungeons', talents: 'tree', challenges: 'tower', rebirth: 'tree' };
const QUEST_TAB_UI = { equipment: [null, null, 'inventory'], upgrades: [null, 'upgrades', null], skills: [null, 'skills', null], forge: ['inventory', 'forge', null] };
import { loginTab } from './panels/contracts.js';
import { loginPending } from '../core/missions.js';
import { morph } from './morph.js'; // v9.3.9
import { suggestedTalent } from '../core/rebirth.js'; // v9.3.9
import { ADV, elementBadge, elementWheel, strongAgainst } from '../core/elements.js'; // v9.5.1
import { companionById } from '../core/companions.js'; // v9.5.1
import { BOSS_TRAITS, TRAITS } from '../core/boss-traits.js'; // v9.5.1
import { BEHAVIORS, zoneBehaviors } from '../data/behaviors.js'; // v9.6.0
import { climbsLeft } from '../core/tower.js'; // v9.6.2
import { guideDay } from '../core/guide.js'; // v9.6.2
import { rushSlots } from '../core/rushes.js'; // v9.6.3
import { dungeonRooms } from '../core/dungeon.js'; // v9.6.2
import { RESOURCE_WHERE, SKILL_RESOURCES } from '../data/progression.js'; // v9.3.9 (2.6)
import { coin, effectText, escapeHtml, fold, glyph, icon, img, itemFrame, missingText, rewardIcons } from './common.js';
import { GAME_VERSION } from '../version.js';
import { mutationById } from '../core/mutations.js';
import boss from './panels/boss.js';
import encyclopedia from './panels/encyclopedia.js';
import { encyclopediaProgress } from '../core/encyclopedia.js';
import campaign from './panels/campaign.js';
import companions from './panels/companions.js';
import expeditions from './panels/expeditions.js';
import contracts from './panels/contracts.js';
import daybook from './panels/daybook.js'; // v9.8 (H1)
import { WHEEL_SLICES, wheelReady } from '../core/wheel.js'; // v9.8 (H4)
import { quickHuntReady } from '../core/quick-hunt.js'; // v9.8 (H3)
import { duelOutcome } from '../core/ranks.js'; // v9.8 (H6)
import { isUpgrade, teamUpgradeFor } from '../core/inventory.js';
import { canEquip as canEquipHero } from '../core/classes.js';
import { mentorTips } from '../core/mentor.js'; // v9.9 (K4)
import { teamChips } from './team-chips.js'; // v9.9 (K16)
import { boonById, rarityOf } from '../core/boons.js'; // v9.9 (K7)
import { TITAN_TIERS, titanToday, titanTriesLeft } from '../core/titan.js'; // v9.8 (H7)
import { MISSION_PERIODS } from '../data/missions.js';
import { missionOpen, missionStatus } from '../core/missions.js';
import dungeons from './panels/dungeons.js';
import tower from './panels/tower.js';
import arena from './panels/arena.js'; // v9.3.2 : modes compagnons
import guild from './panels/guild.js'; // v9.3.2 : guildes
import forgePanel, { canForgeSomething } from './panels/forge.js'; // v9.3.4
import { updateTutorial } from './tutorial.js'; // v9.3.4 (h)
import { recycleRules } from '../core/inventory.js';
import { invFeatureOpen as forgeOpen } from '../core/unlocks.js';
import { arenaUnlocked } from '../core/arena.js';
import worldPanel from './panels/world.js';
import { BANNER_RULES } from '../data/banners.js';
import { TOWER, towerTimeLeft } from '../core/tower.js';
import { cheatTimes, simSpeed, unlockedSpeeds } from '../core/cheats.js';
import { PRESTIGE } from '../data/prestige.js';
import { PANEL_HELP, betterItem, nextAction } from '../core/guide.js';
import hero from './panels/hero.js';
import looks from './panels/looks.js'; // v9.2.2
import inbox from './panels/inbox.js';
import ranking from './panels/ranking.js';
import stats from './panels/stats.js';
import inventory, { visibleItems } from './panels/inventory.js';
import options from './panels/options.js';
import skills from './panels/skills.js';
import summon from './panels/summon.js';
import shop from './panels/shop.js'; // v9.2.8
import { shopFreeAvailable } from '../core/store.js'; // v9.2.9 : pastille du bouton Boutique
import { openWorldBoss } from './world-boss.js'; // v9.2.9 : World Boss
import eventPanel from './panels/event.js'; // v9.2.8
import tree, { DEFAULT_ZOOM as TREE_ZOOM, keepResetLists, recenterTree, transcendKeepResetLists } from './panels/tree.js';
import upgrades from './panels/upgrades.js';
import { earlyBoost } from '../core/boost.js';
import { RUSHES } from '../data/rushes.js';
import { SKILLS } from '../data/skills.js';
import { rushUnlocked } from '../core/rushes.js';
import { newItemsInBag } from '../core/journal.js';
import { measureFarmRate } from '../core/offline.js';
import { claimables, claimablesByTab } from '../core/claimables.js';
import { isPhone, pref, reduceMotion, setPref } from './prefs.js';
import { mountShowcase } from './showcase.js'; // v9.2.7 : vitrine animée des fiches
import * as uiFx from './ui-vfx.js'; // v9.2.6 : effets visuels de l'interface
import { openSearch } from './search.js';
import { setById } from '../core/sets.js';
import { availableForExpedition, readyExpeditions } from '../core/expeditions.js';
import { CHALLENGE, bossEvery, challengeUnlocked } from '../core/challenge.js';
import { ZONES } from '../data/zones.js';
import { CURRENCIES, currencyAmount } from '../data/currencies.js';
import { MENUS, SUB_LABELS, SUB_SHORT, navPath } from './nav.js';
import { ELEMENTS, zoneElement } from '../core/elements.js'; // v9.3.1 : types

export { MENUS };

const PANELS = Object.fromEntries([campPanel, upgrades, inventory, forgePanel, hero, looks, companions, expeditions, skills, tree, campaign, dungeons, tower, arena, boss, encyclopedia, summon, shop, eventPanel, contracts, daybook, inbox, ranking, guild, stats, options, worldPanel]
  .map((p) => [p.id, p]));
const SUB_ICONS = { // v9.4.0 : une icône par onglet (PixelLab), plus aucune partagée
  upgrades: 'tab_upgrades', skills: 'tab_skills', tree: 'tab_talents', hero: 'icon_hero', inventory: 'tab_equipment', looks: 'tab_looks',
  companions: 'tab_companions', expeditions: 'tab_expeditions', summon: 'tab_summon', shop: 'top_shop', event: 'tab_event', campaign: 'tab_map', dungeons: 'tab_dungeons', tower: 'tab_challenges', arena: 'tab_arena', forge: 'tab_forge',
  camp: 'tab_expeditions', boss: 'tab_boss', encyclopedia: 'tab_collections', contracts: 'tab_missions', daybook: 'icon_trophy', inbox: 'icon_mail', ranking: 'tab_ranking', guild: 'tab_guild', stats: 'tab_stats',
};
// v9.1.0 : présentation courte en haut de l'onglet, à sa première ouverture (plus de bulle « Nouveau »).
const UNLOCK_INFO = { // v9.3.4 (h) : une ligne courte par onglet
  companions: 'ils combattent à tes côtés.',
  summon: 'tickets et gemmes invoquent des compagnons.',
  shop: 'les offres ; achats pas encore ouverts.',
  event: 'objectifs et récompenses pendant deux semaines.', // v9.8 (C2) : vrai pour les deux sortes d'événements
  expeditions: 'tes compagnons libres partent en mission.',
  tree: 'les fragments achètent des talents permanents.',
  dungeons: 'une clé par combat de boss.',
  boss: 'chaque boss vaincu laisse un pouvoir.',
  tower: 'un défi par semaine, des records récompensés.',
  forge: 'recycle en éclats, puis forge mieux.',
  arena: 'tes compagnons combattent sans le héros.',
  encyclopedia: 'chaque découverte rapporte une récompense.',
  inbox: 'tout ce qui est prêt, au même endroit.',
};
const TOWER_UNLOCK = TOWER.unlockStage;
export const menuOf = (tab) => MENUS.find((m) => m.tabs.includes(tab)) ?? null;
const TALL_MIN_HEIGHT = 420;
const STRIP_MAX_HEIGHT = 190; // en dessous : mode barre (seulement la scène, comme une barre des tâches)
const WIDGET_MAX = { h: 259, w: 360 }; // v9.7.1 : widget (320×180) — sous 260 px de haut dans une fenêtre étroite // en dessous : mode barre (seulement la scène, comme une barre des tâches)
const BULK_CONFIRM_MS = 4000;
// Panneaux dont le contenu évolue pendant le farm : réaffichés au plus une fois par seconde.
// v9.3.5 : nom court sous l'icône des boosts ; touches affichées seulement avec souris et clavier.
const RUSH_SHORT = { rage: 'Rage', frenzy: 'Frénésie', midas: 'Midas', hunter: 'Chasseur', phantom: 'Fantôme' };
const hasKeyboard = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
const LIVE_PANELS = new Set(['daybook', 'arena', 'world', 'contracts', 'dungeons', 'tower', 'skills', 'boss', 'hero', 'looks', 'upgrades', 'companions', 'expeditions', 'encyclopedia', 'inbox', 'ranking', 'stats']);

// Renaissance : choix du seul pouvoir ancestral conservé.
function powerChoice(state) {
  const ids = Object.keys(state.powers);
  if (ids.length <= 1) return '';
  // v9.3.5 : pouvoir conseillé = celui qui donne le plus de dégâts (sinon le premier actif) ; coché par défaut.
  const dmg = (id) => Object.entries(powerById(state.powers[id].current)?.effects ?? {}).filter(([k]) => /damage|Dmg|dps/i.test(k)).reduce((a, [, v]) => a + (Number(v) || 0), 0);
  const advised = [...ids].sort((a, b) => dmg(b) - dmg(a))[0];
  const first = dmg(advised) > 0 ? advised : state.equippedPowers[0] ?? ids[0];
  return `<div class="keep-power"><div class="section-title">Pouvoir conservé (un seul)</div>${ids.map((id) => {
    const p = powerById(state.powers[id].current);
    return `<label class="toggle"><input type="radio" name="keep-power" value="${id}" ${id === first ? 'checked' : ''}>
      <b>${BOSSES[id].name}</b> : ${p ? `${p.name} (${effectText(p.effects)})` : '—'}${id === first ? ' <span class="good">Conseillé</span>' : ''}</label>`;
  }).join('')}</div>`;
}

// Lignes du journal de session (seules les valeurs non nulles).
export function journalHtml(j) {
  const rows = [
    j.stages && ['icon_map', 'Étapes conquises', `+${formatNumber(j.stages)} (record ${stageLabel(j.maxStage)})`],
    j.levels && ['icon_upgrade', 'Niveaux du héros', `+${formatNumber(j.levels)}`],
    j.bosses && ['icon_skull', 'Boss vaincus', formatNumber(j.bosses)],
    j.kills && ['icon_damage', 'Ennemis vaincus', formatNumber(j.kills)],
    j.gold && ['icon_gold', 'Or gagné', `+${formatNumber(j.gold)}`],
    j.items && ['icon_bag', 'Objets ramassés', `${formatNumber(j.items)} — ${formatNumber(j.inBag)} encore dans le sac`],
    j.recycled && ['icon_shard', 'Objets recyclés', `${formatNumber(j.recycled)} (+${formatNumber(j.recycledGold)} or)`],
    j.fused && ['icon_anvil', 'Fusions automatiques', formatNumber(j.fused)],
    j.tower && ['icon_tower', 'Tour de l\'Éternité', `+${j.tower} étage${j.tower > 1 ? 's' : ''} de record`],
  ].filter(Boolean);
  if (!rows.length) return '<p class="muted">Rien de notable pour l\'instant.</p>';
  return `<div class="journal">${rows.map(([ic, label, value]) => `<div class="journal-row">${img(ic)}<span>${label}</span><b>${value}</b></div>`).join('')}</div>`;
}

// Disposition téléphone : écran tactile étroit (boosts regroupés, fiche en bas, action collée en bas).
function phoneLayout() {
  return isPhone();
}

function boostDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

// Très grands multiplicateurs en notation 1e60 (codes de la version dev).
function formatMult(n) {
  return n >= 1e15 ? n.toExponential(1).replace('e+', 'e').replace('.', ',') : n >= 1000 ? formatNumber(n) : n.toFixed(1).replace('.', ',');
}

function boostText(b) {
  const parts = [`×${formatMult(b.gold)}`];
  if (b.secondsLeft > 0) parts.push(boostDuration(b.secondsLeft));
  else if (b.weekend) parts.push('Week-end');
  return parts.join(' · ');
}

const RENDER_THROTTLE_MS = 1000;
const SIDE_PANEL_W = 440; // largeur du menu sur le côté (petite fenêtre)
const SIDE_MIN_WIDTH = 760; // navigateur : menu sur le côté à partir de cette largeur (étape 3 : 900 → 760, la scène reste visible en 820×380)
const RAIL_W = 80; // barre des menus verticale (petite fenêtre)
const STRIP_MENU_HEIGHT = 400; // mode barre : hauteur de la fenêtre quand le menu est ouvert
export class UI {
  constructor(root, actions) {
    this.root = root;
    this.actions = actions;
    this.$ = (id) => root.querySelector(`#${id}`);
    // v9.1.1 : nom tapé dans un formulaire de compte, conservé au redessin du panneau.
    this.cloudDraft = (id) => {
      if (!this.cloud) return;
      this.cloud.draft = { ...(this.cloud.draft ?? {}), [id]: this.$(id)?.value ?? '' };
    };
    this.tab = null;
    this.layout = null;
    this.dirty = true;
    this.state = null;
    this.desktop = null; // renseigné par main.js dans la version bureau
    this.lastHud = {};
    this.newTabs = new Set();
    this.lastLive = 0;
    // v8.0 : le panneau n'est pas redessiné pendant un clic, ni quand une liste déroulante est ouverte,
    // et au plus une fois par seconde quand le jeu (et non le joueur) le demande (vitesse ×10 : butin incessant).
    this.lastRender = 0;
    this.userAt = 0;
    this.pointerDown = false;
    root.addEventListener('pointerdown', () => { this.pointerDown = true; this.userAt = performance.now(); }, { capture: true });
    window.addEventListener('pointerup', () => { this.pointerDown = false; this.userAt = performance.now(); }, { capture: true });
    window.addEventListener('pointercancel', () => { this.pointerDown = false; });
    root.addEventListener('keydown', () => { this.userAt = performance.now(); }, { capture: true });
    // v9.0 : liste déroulante ouverte = aucun redessin du panneau (avant, un monstre tué juste après le clic
    // d'ouverture redessinait le panneau et refermait la liste). Elle est « fermée » au choix ou en la quittant.
    this.selectOpenAt = 0;
    const isSelect = (e) => e.target instanceof HTMLSelectElement;
    root.addEventListener('pointerdown', (e) => { this.selectOpenAt = isSelect(e) ? performance.now() : 0; }, { capture: true });
    root.addEventListener('keydown', (e) => {
      if (!isSelect(e)) return;
      if ([' ', 'F4'].includes(e.key) || (e.altKey && e.key.startsWith('Arrow'))) this.selectOpenAt = performance.now();
      else if (['Escape', 'Enter', 'Tab'].includes(e.key)) this.selectOpenAt = 0;
    }, { capture: true });
    for (const type of ['change', 'blur', 'focusout']) {
      root.addEventListener(type, (e) => {
        if (!isSelect(e)) return;
        this.selectOpenAt = 0;
        // Le choix dans la liste native ne produit pas toujours de « pointerup » dans la page.
        if (type === 'change') { this.pointerDown = false; this.userAt = performance.now(); }
      }, { capture: true });
    }
    this.view = {
      closed: new Set(), // sections repliées (missions…)
      open: new Set(), // v9.1.0 : blocs repliés par défaut que le joueur a ouverts
      upgradeCat: 'all', invTab: 'bag', selectedItemId: null, bulkRarity: 'common', bulkArmed: false,
      heroSel: null, companionSel: null, talentSel: null, zoneSel: null,
      oddsOpen: new Set(), lastSummon: null,
    };

    root.querySelectorAll('img[data-icon]').forEach((el) => { el.src = icon(el.dataset.icon); });
    // Mode barre : ☰ et ⤢ agrandissent la fenêtre bureau ; en navigateur, ils n'ont pas de sens (v9.1.0 : les deux retirés).
    if (!window.desktop) root.querySelectorAll('.strip-btn').forEach((b) => b.remove());
    this.lastSub = {}; // dernier sous-onglet ouvert de chaque menu
    this.scrollMem = {}; // position de défilement de chaque onglet
    this.claims = []; // v9.1.0 : à récupérer (core/claimables.js), recalculé avec les pastilles
    this.seenItemsUntil = null; // objets « neufs » : ceux trouvés depuis la dernière visite d'Équipement
    this.tabVisible = {};
    this.tabBadges = {};
    root.querySelectorAll('#tabs button').forEach((btn) => btn.addEventListener('click', () => this.toggleMenu(btn.dataset.menu)));
    root.querySelectorAll('[data-menu-open]').forEach((btn) => btn.addEventListener('click', () => this.toggleMenu(btn.dataset.menuOpen))); // v9.3.5 : Profil
    this.$('panel-subtabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sub]');
      if (b) { this.userAt = performance.now(); this.openTab(b.dataset.sub); }
    });
    root.querySelectorAll('[data-open]').forEach((btn) => btn.addEventListener('click', () => this.toggleTab(btn.dataset.open)));
    this.$('panel-close').addEventListener('click', () => this.closePanel());
    this.$('next-action').addEventListener('click', () => this.runNextAction());
    root.querySelectorAll('[data-currency]').forEach((btn) => btn.addEventListener('click', () => this.showCurrency(btn.dataset.currency)));
    this.$('panel-fold')?.addEventListener('click', () => this.togglePanelLow());
    this.$('panel-help').addEventListener('click', () => {
      this.view.helpOpen = this.view.helpOpen === this.tab ? null : this.tab;
      this.userAt = performance.now();
      this.invalidate();
    });
    root.addEventListener('click', (e) => uiFx.clickFx(this, e, () => this.onClick(e)));
    root.addEventListener('pointerdown', (e) => uiFx.deniedFx(e.target)); // v9.3.9 : bouton grisé = il tremble et dit pourquoi // v9.2.6 : effet selon le résultat
    uiFx.initIcons(root); // v9.2.6 : icônes animées des menus au survol
    root.addEventListener('change', (e) => this.onChange(e));
    // Saisie d'une nouvelle touche (Paramètres › Interface) : capturée avant les raccourcis.
    window.addEventListener('keydown', (e) => {
      const action = this.view.keyCapture;
      if (!action) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { this.view.keyCapture = null; this.invalidate(); return; }
      if (e.key.length !== 1) return;
      const key = e.key.toLowerCase();
      const conflict = keyConflict(action, key);
      if (conflict) { this.toast(`${conflict}.`, '#ff8a8a'); return; }
      setPref('keys', { ...(pref('keys') ?? {}), [action]: key });
      setCustomKeys(pref('keys'));
      this.view.keyCapture = null;
      delete this.lastHud.rushTime;
      this.invalidate();
    }, { capture: true });
    // v9.1.3 : texte tapé dans un champ du panneau (nom, mot de passe, recherche…), remis en place après chaque
    // redessin. Sans cela, le redessin périodique vidait les champs dès qu'ils perdaient le focus : on cliquait
    // « Créer mon compte joueur » avec des champs vides.
    this.typed = {};
    root.addEventListener('input', (e) => {
      const f = e.target;
      if (f.id && (f.tagName === 'TEXTAREA' || (f.tagName === 'INPUT' && /^(text|password|search|email|number)$/.test(f.type))) && this.$('panel-body')?.contains(f)) {
        this.typed[f.id] = f.value;
      }
      if (e.target.id === 'reset-confirm') this.$('confirm-reset').disabled = !/^(EFFACER|ERASE)$/i.test(e.target.value.trim());
    });
    // Entrée dans un formulaire de compte = clic sur son bouton (jamais pour la suppression du compte).
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
      const form = { 'friend-pseudo': 'friend-add', 'cloud-claim-': 'cloud-claim', 'cloud-rename-': 'cloud-rename', 'cloud-pseudo': null, 'cloud-password': null };
      const prefix = Object.keys(form).find((p) => e.target.id.startsWith(p));
      if (!prefix) return;
      const action = form[prefix] ?? (e.target.closest('.row')?.parentElement?.querySelector('[data-action="cloud-login"], [data-action="cloud-register"]')?.dataset.action);
      const button = action && this.$('panel-body')?.querySelector(`[data-action="${action}"]`);
      if (!button || button.disabled) return;
      e.preventDefault();
      button.click();
    });
    new ResizeObserver(() => this.updateLayout()).observe(root);
    this.updateLayout();
    setMenuCount(MENUS.length);
    setCustomKeys(pref('keys'));
    this.restoreNav();
    this.applyPrefs();
    window.addEventListener('pagehide', () => this.saveNav());
    window.addEventListener('resize', () => { if (pref('uiScale') === 'auto') this.applyZoom(); });
    root.querySelectorAll('#tabs button').forEach((b) => { b.dataset.key = String(MENUS.findIndex((m) => m.id === b.dataset.menu) + 1); });
    installShortcuts(this);
    this.lootBag = new LootBag(this); // v9.7.1 : sac de butin dans la scène
    installHoldToRepeat(root);
    installTips(root);
    // Balayage horizontal entre onglets (tactile seulement), hors carte, arbre et barre d'onglets.
    let swipe = null;
    this.$('panel-body').addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      swipe = e.touches.length === 1 && !e.target.closest('.map-viewport, .tree-viewport, #panel-subtabs, input, select, textarea') ? { x: t.clientX, y: t.clientY } : null;
    }, { passive: true });
    this.$('panel-body').addEventListener('touchend', (e) => {
      if (!swipe) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - swipe.x;
      const dy = t.clientY - swipe.y;
      swipe = null;
      if (holdFiredRecently()) return; // v9.1.3 : la fin d'un appui maintenu ne change pas d'onglet
      if (Math.abs(dx) > 60 && Math.abs(dy) < 40) cycleSub(this, dx < 0 ? 1 : -1);
    }, { passive: true });
  }


  // v8.4 : annonce du nouvel équilibrage (or des améliorations remboursé).
  showRebalanceNotice(refund) {
    this.openModal(`<h2>⚖ Nouvel équilibrage (v8.4)</h2>
      <p>Le jeu ne bloque plus : les améliorations coûtent moins cher en fin de partie (paliers ×1,75 tous les 25 niveaux),
        les objets grandissent bien plus avec leur niveau, la Renaissance <b>multiplie</b> tes dégâts, PV et or, et le niveau
        maximum du héros passe à ${BALANCE.level.maxLevel}.</p>
      <p>Vos améliorations ont été remboursées : <b class="gold-text">+${formatNumber(refund)} or</b>. Rachète-les au nouveau prix
        (bouton « Max » dans Améliorer) — tu iras bien plus loin qu'avant.</p>
      <div class="detail-actions"><button class="btn btn-gold" data-action="close-modal">C'est parti !</button></div>`);
  }

  // v8.5 : annonce du nouvel arbre (fragments de l'ancien rendus).
  showTreeNotice(refund) {
    this.openModal(`<h2>🌳 Un arbre mastodonte (v8.5)</h2>
      <p>L'arbre de talents passe de 25 à plus de 500 talents : 6 régions autour du Cœur, des branches
        qui se divisent et se rejoignent, des ponts entre régions, des notables et des clés de voûte.</p>
      <p>Tes anciens talents ont été remboursés : <b class="gold-text">+${formatNumber(refund)} fragments anciens</b>. Replante-les où tu veux !</p>
      <div class="detail-actions"><button class="btn btn-gold" data-action="open-tab" data-value="tree">Voir l'arbre</button></div>`);
  }

  showSpeedWarning() {
    this.openModal(`<h2>${glyph('icon_alert')} Vitesse ×100</h2>
      <p>À cette vitesse, les combats défilent extrêmement vite. Pour éviter les clignotements (personnes sensibles
        à l'épilepsie photosensible), <b>les effets visuels sont coupés</b> : plus de flashs, de chiffres de dégâts,
        de secousses ni de bannières.</p>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-danger" data-action="confirm-speed100">Activer ×100</button></div>`);
  }


  // v9.0.2 : mise à jour lancée mais version inchangée au redémarrage.
  showUpdateFailed(info) {
    this.openModal(`<h2>${glyph('icon_alert')} La mise à jour n'a pas pu s'installer</h2>
      <p>La version ${escapeHtml(info.version)} a été téléchargée, mais le jeu est toujours en version ${escapeHtml(GAME_VERSION)}.</p>
      <p class="muted">Causes possibles : place disque insuffisante, antivirus qui bloque l'installateur, ou fermeture
      de l'installateur. Relance-le : cette fois sa fenêtre s'affiche et indique le problème éventuel. Votre partie est conservée.</p>
      <div class="detail-actions">${info.file ? '<button class="btn btn-gold" data-action="retry-installer">Relancer l\'installateur</button>' : ''}
        <button class="btn" data-action="open-releases">Page des versions</button>
        <button class="btn" data-action="close-modal">Plus tard</button></div>`);
  }
  showShortcuts() {
    this.openModal(`<h2>Raccourcis clavier</h2>${shortcutsHtml()}
      <p class="muted">Astuce : maintiens le clic sur un bouton (acheter, améliorer…) — quand l'anneau est plein, il est cliqué en continu jusqu'à ce que vous bouges la souris.</p>
      <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">OK</button></div>`);
  }

  // --- Réglages de l'appareil (v9.1.0) -------------------------------------------------------------------
  applyPrefs() {
    const root = document.documentElement;
    this.compact = pref('compact') === true;
    this.phone = isPhone();
    this.root.classList.toggle('compact', this.compact);
    this.root.classList.toggle('color-aid', pref('colorAid') === true);
    root.classList.toggle('contrast-high', pref('contrast') === true);
    root.classList.toggle('combat-full', pref('combat') === 'full');
    if (pref('bossFocus') === false) delete this.root.dataset.bossFocus;
    this.updatePanelLow?.();
    this.applyZoom();
    delete this.lastHud.rushTime;
    delete this.lastHud.skillTime;
    this.invalidate();
  }

  // Taille de l'interface : Auto (plus grand sur très grand écran), 100 à 200 %. Bureau : facteur de zoom de la
  // fenêtre ; navigateur : zoom CSS de la page.
  applyZoom() {
    const v = pref('uiScale');
    const auto = window.screen?.width >= 2400 && window.innerWidth >= 2000 ? 1.5 : window.innerWidth >= 1800 && window.innerHeight >= 1000 ? 1.25 : 1;
    const zoom = v === 'auto' || !Number(v) ? auto : Number(v) / 100;
    if (zoom === this.uiZoom) return;
    this.uiZoom = zoom;
    if (window.desktop?.setZoom) window.desktop.setZoom(zoom);
    else {
      document.documentElement.style.zoom = zoom === 1 ? '' : String(zoom);
      // v9.2.5 : sous zoom CSS, 100vw / 100vh sont multipliés par le zoom (scène 2291 px pour 1920) : #app s'y divise.
      document.documentElement.style.setProperty('--ui-zoom', String(zoom));
    }
  }

  setDevicePref(name, value) {
    setPref(name, value);
    this.applyPrefs();
  }

  // Mémoire de navigation (v9.1.0, clé locale) : dernier onglet de chaque menu, filtres, tris, quantités, blocs
  // ouverts et position de défilement. Une valeur inconnue revient au défaut.
  restoreNav() {
    const nav = pref('nav') ?? {};
    const okTab = (t) => typeof t === 'string' && PANELS[t];
    for (const [menu, tab] of Object.entries(nav.lastSub ?? {})) if (MENUS.some((m) => m.id === menu && m.tabs.includes(tab))) this.lastSub[menu] = tab;
    const v = nav.view ?? {};
    const pick = (key, allowed) => { if (allowed(v[key])) this.view[key] = v[key]; };
    // v9.2.8 : « Combat » était le filtre par défaut (et mémorisé comme tel) : les PV, l'armure et la régénération
    // restaient cachés. Le filtre mémorisé avant la 9.2.8 est oublié une fois (retour à « Toutes »).
    if (v.upgCatV === 928) pick('upgradeCat', (x) => ['combat', 'survival', 'resources', 'all'].includes(x));
    pick('upgradeSort', (x) => ['profit', 'cost'].includes(x));
    pick('buyAmount', (x) => ['1', '10', '100', 'max'].includes(x));
    pick('missionTab', (x) => ['today', 'weekly', 'week', 'achievements'].includes(x));
    pick('invTab', (x) => ['bag', 'stash'].includes(x));
    pick('encSec', (x) => ['monsters', 'bosses', 'mutations', 'items', 'companions', 'museum'].includes(x));
    pick('summonPool', (x) => SUMMON_POOLS.includes(x));
    pick('treeSeg', (x) => ['tree', 'region', 'rebirth'].includes(x));
    pick('heroTab', (x) => ['hero', 'class', 'look', 'records'].includes(x));
    pick('optTab', (x) => ['general', 'interface', 'sound', 'window'].includes(x));
    pick('encSlot', (x) => typeof x === 'string' && x.length < 16);
    pick('compTab', (x) => ['ally', 'pet'].includes(x)); // v9.7.1 : onglet interne de l'écran Équipe
    if (Array.isArray(nav.open)) this.view.open = new Set(nav.open.filter((x) => typeof x === 'string').slice(0, 64));
    if (Array.isArray(nav.closed)) this.view.closed = new Set(nav.closed.filter((x) => typeof x === 'string').slice(0, 64));
    for (const [tab, top] of Object.entries(nav.scroll ?? {})) if (okTab(tab) && Number.isFinite(top)) this.scrollMem[tab] = top;
  }

  saveNav() {
    if (this.tab) this.scrollMem[this.tab] = this.$('panel-body').scrollTop;
    const keys = ['upgradeCat', 'upgradeSort', 'buyAmount', 'missionTab', 'invTab', 'encSec', 'summonPool', 'treeSeg', 'heroTab', 'optTab', 'encSlot', 'compTab'];
    setPref('nav', {
      lastSub: this.lastSub,
      view: { ...Object.fromEntries(keys.filter((k) => this.view[k] !== undefined && this.view[k] !== null).map((k) => [k, this.view[k]])), upgCatV: 928 },
      open: [...(this.view.open ?? [])], closed: [...this.view.closed],
      scroll: this.scrollMem,
    });
  }

  // Paramètres › Interface : réglages propres à cet appareil (mode compact, combat, animations, taille…).
  interfaceExtra() {
    const sel = (name, options) => `<select data-action="device-pref" data-key="${name}" aria-label="${escapeHtml(options.label)}">${options.items.map(([v, l]) => `<option value="${v}" ${String(pref(name)) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const check = (name, label) => `<label class="toggle"><input type="checkbox" data-action="device-pref" data-key="${name}" ${pref(name) === true ? 'checked' : ''}> ${label}</label>`;
    const keys = Object.keys(KEY_LABELS).map((action) => `<div class="key-row"><span>${KEY_LABELS[action]}</span>
      <button class="btn small key-btn${this.view.keyCapture === action ? ' armed' : ''}" data-action="capture-key" data-value="${action}">${this.view.keyCapture === action ? 'Appuie sur une touche…' : `<kbd>${escapeHtml(keyLabel(action))}</kbd>`}</button></div>`).join('');
    return `<div class="card"><div class="section-title">Cet appareil</div>
        <div class="muted">Ces réglages restent sur cet appareil (PC ou téléphone), hors de la sauvegarde.</div>
        <div class="pref-grid">
          <span>Combat</span>${sel('combat', { label: 'Combat', items: [['simple', 'Simple (l\'essentiel)'], ['full', 'Complet (tout afficher)']] })}
          <span>Animations</span>${sel('motion', { label: 'Réduire les animations', items: [['auto', 'Auto (réglage du système)'], ['reduce', 'Réduites'], ['full', 'Complètes']] })}
          <span>Taille de l'interface</span>${sel('uiScale', { label: 'Taille de l\'interface', items: [['auto', 'Auto'], [100, '100 %'], [125, '125 %'], [150, '150 %'], [200, '200 %']] })}
        </div>
        ${check('compact', '<b>Mode compact</b> : listes serrées, sans descriptions (joueurs expérimentés)')}
        ${check('qtyMenu', '<b>Quantité en un bouton</b> (essai) : Max, ×100, ×10, ×1 se déplient d\'un bouton dans Améliorations')}
        ${check('skillGrid', '<b>Compétences en grille</b> (essai) : 9 icônes avec niveau et +, le texte au toucher')}
        ${check('bossFocus', '<b>Mode boss réduit</b> (essai) : pendant un boss, les boutons autour de la scène s\'estompent (complet au méga boss)')}
        ${check('panelFold', '<b>Panneau à deux hauteurs</b> (essai) : ▼ rétracte le panneau pour agrandir la scène, choix mémorisé par écran')}
        ${check('colorAid', '<b>Aide aux couleurs</b> : lettre de rareté sur les objets (C, R, É, L), pastilles en anneau')}
        ${check('contrast', '<b>Contraste élevé</b> : textes plus contrastés, sans décor animé')}
      </div>
      ${isPhone() ? '' : fold(this, 'keys', 'Raccourcis clavier : changer une touche', `<div class="muted">Clique une touche puis appuie sur la nouvelle. Une touche déjà utilisée est refusée.</div>
        <div class="key-grid">${keys}</div><button class="btn small" data-action="reset-keys">Touches par défaut</button>`)}`;
  }

  openSearch() {
    openSearch(this);
  }

  // Touche G : tout ce qui est réclamable d'un coup.
  claimEverything() {
    this.actions.claimEverything?.();
  }

  // v9.1.3 (lot F, « À récupérer fondu dans Missions ») : la vue d'ensemble de tout ce qui est prêt reste, en fenêtre.
  openClaims(state = this.state) {
    if (!state) return;
    this.openModal(`<h2>À récupérer</h2><div class="claims-window">${inbox.render(this, state)}</div>
      <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">Fermer</button></div>`);
    this.claimsOpen = true;
  }

  // v9.1.0 : réinitialisation isolée — ce qui est perdu, export proposé, bouton actif après la saisie de EFFACER.
  showResetConfirm() {
    this.openModal(`<h2>${glyph('icon_alert')} Réinitialiser la partie</h2>
      <p>Tout est effacé sur cet appareil : niveau, or, gemmes, objets, compagnons, talents, Renaissances, records et la copie de
        secours. <b class="bad">C'est définitif.</b></p>
      <div class="options-row"><button class="btn small" data-action="export-save" data-value="file">Exporter ma partie d'abord</button></div>
      <p>Pour confirmer, tape <b>EFFACER</b> :</p>
      <input id="reset-confirm" class="confirm-input" type="text" autocomplete="off" spellcheck="false" maxlength="12" aria-label="Tape EFFACER pour confirmer">
      <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">Annuler</button>
        <button class="btn btn-danger" data-action="confirm-reset" id="confirm-reset" disabled>Tout effacer</button></div>`);
    setTimeout(() => this.$('reset-confirm')?.focus(), 30);
  }

  // v9.1.0 : sauvegarde écrite par une version plus récente : rien n'est chargé ni écrasé.
  showNewerSave(version) {
    this.openModal(`<h2>Sauvegarde d'une version plus récente</h2>
      <p>Votre partie a été enregistrée par une version plus récente du jeu (format ${escapeHtml(String(version))}). Cette version ne sait pas
        la lire. <b>Rien n'a été effacé</b> : mets le jeu à jour pour la retrouver.</p>
      <p class="muted">En attendant, la partie affichée n'est pas sauvegardée.</p>
      <div class="detail-actions"><button class="btn btn-gold" data-action="check-update">Chercher la mise à jour</button>
        <button class="btn" data-action="close-modal">Fermer</button></div>`);
  }

  // Import depuis l'onglet Général : fichier choisi, sinon le texte collé.
  importFromPanel() {
    const file = this.$('import-file')?.files?.[0];
    if (file) {
      if (file.size > 20e6) { this.toast('Fichier trop gros pour une sauvegarde.', '#ff8a8a'); return; }
      file.text().then((text) => this.actions.importSave(text));
      return;
    }
    this.actions.importSave(this.$('import-text')?.value ?? '');
  }

  // --- Disposition selon la taille de la fenêtre ---
  updateLayout() {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    // Jeu en bandeau en haut, onglets dessous, interface en dessous ; panneau superposé si la fenêtre est basse.
    const layout = h >= TALL_MIN_HEIGHT ? 'tall' : h <= STRIP_MAX_HEIGHT || (h <= WIDGET_MAX.h && w <= WIDGET_MAX.w) ? 'strip' : 'mini';
    if (layout !== this.layout) {
      this.root.classList.remove('layout-mini', 'layout-tall', 'layout-strip');
      if (layout === 'strip') this.closePanel();
      this.root.classList.add(`layout-${layout}`);
      this.layout = layout;
      this.invalidate();
    }
    // v9.9 (K1) : plus de panneau latéral — en disposition haute (PC comme téléphone), les menus s'ouvrent dans un
    // panneau en bas ; le combat reste visible au-dessus.
    this.root.classList.toggle('wide', false);
    this.root.classList.toggle('bottom-ui', layout === 'tall');
    this.root.classList.toggle('panel-tall', pref('panelTall') === true);
    const phone = isPhone();
    if (phone !== this.phone) { this.phone = phone; this.invalidate(); delete this.lastHud.rushTime; }
    if (layout === 'mini') {
      // Le panneau recouvre la scène mais laisse la barre du haut et les onglets visibles.
      const rootTop = this.root.getBoundingClientRect().top;
      const top = this.$('topbar').getBoundingClientRect().bottom - rootTop;
      const tabsTop = h; // v9.0.6 : la barre des menus est sur le côté ; le panneau descend jusqu'en bas
      this.root.style.setProperty('--panel-top', `${Math.round(top)}px`);
      this.root.style.setProperty('--panel-bottom', `${Math.round(h - tabsTop)}px`);
    }
    this.lastHud.tabs = null;
  }

  // Un menu ouvre son dernier onglet (ou le premier disponible) ; un second clic le referme.
  // v9.1.0 : plus de saut vers l'onglet qui a une récompense (la pastille suffit).
  toggleMenu(id) {
    this.userAt = performance.now();
    if (id === 'fight') { if (this.tab) this.closePanel(); return; } // v9.3.5 : bouton Combat
    const menu = MENUS.find((m) => m.id === id);
    if (!menu) return;
    if (this.tab && menu.tabs.includes(this.tab)) { this.closePanel(); return; }
    const visible = menu.tabs.filter((t) => this.tabVisible[t] !== false);
    // v9.9 (K6) : menu encore fermé — il reste visible avec un cadenas et dit ce qui l'ouvre.
    if (!visible.length) { this.toast(`🔒 ${this.lockReason(menu.tabs[0])}`, '#ffcf6a'); return; }
    this.openTab(visible.includes(this.lastSub[id]) ? this.lastSub[id] : visible[0] ?? menu.tabs[0]);
  }

  // v9.9 (K6) : condition d'ouverture d'un onglet, en une ligne.
  lockReason(tab) {
    const st = this.state;
    const qid = Object.entries(QUEST_SYS).find(([, t]) => t === tab)?.[0];
    const q = qid && UNLOCK_QUESTS.find((x) => x.id === qid);
    if (q && st?.unlocks && !st.unlocks.legacy && !st.unlocks.done.includes(q.id)) return `Termine la mini-quête « ${q.label} »`;
    const R = {
      tree: `S'ouvre à l'étape ${stageLabel(10)}`, daybook: `S'ouvre à l'étape ${stageLabel(10)}`,
      dungeons: `S'ouvre à l'étape ${stageLabel(DUNGEONS[0].unlockStage)}`, tower: `S'ouvre à l'étape ${stageLabel(Math.min(TOWER_UNLOCK, CHALLENGE.unlockStage))}`,
      event: 'S\'ouvre en finissant le monde 2', expeditions: 'S\'ouvre avec 5 compagnons',
      summon: 'S\'ouvre après le boss du monde 1', shop: 'S\'ouvre après le boss du monde 1', companions: 'S\'ouvre après le boss du monde 1',
      encyclopedia: 'S\'ouvre après ton premier boss', boss: 'S\'ouvre après ton premier boss', contracts: 'S\'ouvre à ta première récompense',
      stats: `S'ouvre à l'étape ${stageLabel(40)}`, ranking: `S'ouvre à l'étape ${stageLabel(40)}`, guild: `S'ouvre à l'étape ${stageLabel(40)}`,
      forge: 'Termine la mini-quête « Forge »',
    };
    return R[tab] ?? 'Bientôt';
  }

  // v9.9 (K6) : tiroir ☰ — tout ce qui n'est pas dans les 5 onglets du bas.
  openDrawer() {
    const E = [['daybook', 'icon_trophy', 'Carnet du jour'], ['contracts', 'tab_missions', 'Missions et hauts faits'], ['encyclopedia', 'tab_collections', 'Collections'],
      ['forge', 'tab_forge', 'Forge'], ['boss', 'tab_boss', 'Pouvoirs des boss'], ['camp', 'tab_expeditions', 'Camp'], ['looks', 'top_profile', 'Apparences'],
      ['ranking', 'tab_ranking', 'Classement'], ['guild', 'tab_guild', 'Guilde'], ['stats', 'tab_stats', 'Statistiques']];
    const row = ([tab, ic, label]) => {
      const open = this.tabVisible[tab] !== false;
      const n = this.tabBadges?.[tab] ?? 0;
      return `<button class="drawer-row${open ? '' : ' locked'}" data-action="${open ? 'open-tab' : 'locked-tab'}" data-value="${tab}">${img(ic)}<b>${label}</b>${open ? (n ? `<i class="drawer-badge">${n}</i>` : '') : `<small>🔒 ${escapeHtml(this.lockReason(tab))}</small>`}</button>`;
    };
    this.openModal(`<div class="drawer"><h2 id="modal-title">Menu</h2>
      <div class="drawer-list">${E.map(row).join('')}
        <button class="drawer-row" data-action="open-claims">${img('icon_mail')}<b>Courrier et récompenses</b></button>
        <button class="drawer-row" data-action="open-tab" data-value="hero">${img('icon_hero')}<b>Fiche du héros</b></button>
        <button class="drawer-row" data-action="sleep-mode">${img('icon_star')}<b>Veillée au Camp</b></button>
        <button class="drawer-row" data-action="open-tab" data-value="options">${img('icon_gear')}<b>Réglages</b></button>
        <button class="drawer-row" data-action="show-shortcuts">${img('icon_book')}<b>Aide</b></button></div></div>`);
  }

  // Onglets du menu courant, en haut du panneau. Marques (v9.1.0, une seule règle) : pastille rouge = à récupérer ;
  // point or = l'action conseillée (une seule) ; « nouveau » = onglet qui vient de s'ouvrir.
  renderSubtabs() {
    const menu = menuOf(this.tab);
    const el = this.$('panel-subtabs');
    const tabs = menu ? menu.tabs.filter((t) => this.tabVisible[t] !== false) : [];
    const locked = menu ? menu.tabs.filter((t) => this.tabVisible[t] === false) : []; // v9.9 (K6) : visibles avec un cadenas
    // v9.1.3 : plus de point or « conseillé » (aucune recommandation) : rouge = à récupérer, anneau = nouveau.
    const mark = (t) => (this.tabBadges[t] ? 'red' : this.newTabs.has(t) ? 'new' : '');
    // v9.1.3 (S5, décision 7) : le prochain onglet de ce menu qui s'ouvre à une étape est annoncé, en texte neutre.
    const STAGE_UNLOCKS = { tree: 10, dungeons: DUNGEONS[0].unlockStage, tower: CHALLENGE.unlockStage };
    const nextTab = menu?.tabs.find((t) => this.tabVisible[t] === false && STAGE_UNLOCKS[t]);
    const next = ''; // v9.8 (B6) : le prochain déblocage n'est plus annoncé ici (barre sous la scène seulement)
    const key = `${this.tab}|${tabs.join()}|${tabs.map(mark).join()}|${nextTab}|${locked.join()}`;
    if (this.lastHud.subtabs === key) return;
    this.lastHud.subtabs = key;
    el.classList.toggle('hidden', tabs.length + locked.length < 2 && !next);
    el.setAttribute('role', 'tablist');
    el.innerHTML = tabs.map((t) => {
      const m = mark(t);
      const badge = m === 'red' ? '<i class="badge" aria-label="À récupérer"></i>'
        : m === 'new' ? '<i class="badge badge-ring" aria-label="Nouveau"></i>' : '';
      return `<button class="subtab${t === this.tab ? ' active' : ''}" role="tab" aria-selected="${t === this.tab}" data-sub="${t}">
      <img class="px" src="${icon(SUB_ICONS[t])}" data-icon="${SUB_ICONS[t]}" alt=""><span class="sub-long">${SUB_LABELS[t]}</span><span class="sub-short">${SUB_SHORT[t] ?? SUB_LABELS[t]}</span>${badge}</button>`;
    }).join('') + locked.map((t) => `<button class="subtab locked" data-action="locked-tab" data-value="${t}" title="${escapeHtml(this.lockReason(t))}">
      <img class="px" src="${icon(SUB_ICONS[t])}" data-icon="${SUB_ICONS[t]}" alt=""><span class="sub-long">🔒 ${SUB_LABELS[t]}</span><span class="sub-short">🔒 ${SUB_SHORT[t] ?? SUB_LABELS[t]}</span></button>`).join('') + next;
    uiFx.syncIcons(this.root); // v9.2.6
  }

  // Aucun onglet ouvert par défaut : un clic ouvre l'onglet, un second clic le referme.
  toggleTab(tab) {
    this.userAt = performance.now();
    if (this.tab === tab) this.closePanel();
    else this.openTab(tab);
  }

  // v8.9 : petite fenêtre → le menu s'ouvre sur le côté (la fenêtre bureau s'élargit d'autant) au lieu de
  // recouvrir la scène ; en navigateur, seulement si la fenêtre est assez large.
  sidePanel(open) {
    // v9.0.6 : le menu s'ouvre à gauche de la scène ; la fenêtre bureau s'agrandit vers la GAUCHE (la scène ne
    // bouge pas à l'écran). Depuis le mode barre, elle grandit aussi vers le haut pour que le menu soit lisible.
    const fromStrip = open && this.layout === 'strip' && Boolean(window.desktop?.growLeft);
    const want = open && (this.layout === 'mini' || fromStrip) && (Boolean(window.desktop?.growLeft) || this.root.clientWidth >= SIDE_MIN_WIDTH);
    if (want === this.root.classList.contains('side-open') && !fromStrip) return;
    this.root.classList.toggle('side-open', want);
    if (window.desktop?.growLeft) {
      if (want && !this.sideGrown) {
        this.sideGrown = true;
        const dh = fromStrip ? Math.max(0, STRIP_MENU_HEIGHT - this.root.clientHeight) : 0;
        window.desktop.growLeft(SIDE_PANEL_W + RAIL_W * (fromStrip ? 1 : 0), dh);
      } else if (!want && this.sideGrown) { this.sideGrown = false; window.desktop.restoreGrow(); }
    }
  }

  // Préréglage de fenêtre choisi : l'agrandissement du menu est oublié (la fenêtre a sa nouvelle taille).
  forgetSideGrow() {
    this.sideGrown = false;
    this.root.classList.remove('side-open');
  }

  // `view` (v9.1.0) : vue à montrer (segment, objet choisi…) — un conseil arrive ainsi au bon endroit.
  openTab(tab, view = null) {
    // v9.1.3 (lot F) : « À récupérer » n'est plus un onglet, c'est une fenêtre (touche N, bouton de Missions).
    if (tab === 'inbox') { this.openClaims(); return; }
    if (tab === 'arena') { tab = 'tower'; view = { ...(view ?? {}), defiTab: 'arena' }; } // v9.3.5 : Arène dans Défis
    if (!PANELS[tab] || this.tabVisible[tab] === false) return;
    if (this.view.themePreview && tab !== 'shop') this.actions.previewTheme(null); // v9.2.8 : fin de l'aperçu du thème
    this.sidePanel(true);
    if (tab === 'inventory') this.seenItemsUntil = this.state?.nextItemId ?? this.seenItemsUntil;
    if (view) Object.assign(this.view, view);
    // Chaque onglet retrouve sa position de défilement (v9.1.0, mémoire de navigation).
    if (tab !== this.tab) {
      this.typed = {};
      if (this.tab) this.scrollMem[this.tab] = this.$('panel-body').scrollTop;
      this.pendingScroll = view ? 0 : this.scrollMem[tab] ?? 0;
    }
    if (tab === 'ranking') this.actions.loadRanking?.();
    if (tab === 'guild') this.actions.loadGuild?.(); // v9.3.2
    if (tab === 'tower' && this.view.defiTab === 'arena') this.actions.loadGlobalBoss?.(); // v9.3.5
    // v9.2.6 : ouverture du panneau (ou changement d'onglet) animée, liste en cascade au prochain rendu.
    if (tab !== this.tab) { uiFx.panelOpenFx(this.$('panel'), !this.tab); this.vfxCascade = true; }
    this.tab = tab;
    this.view.bulkArmed = false;
    this.newTabs.delete(tab);
    this.$('panel').classList.remove('hidden');
    this.root.classList.add('panel-open');
    this.$('panel-title').textContent = SUB_LABELS[tab] ?? PANELS[tab].title;
    this.$('panel-icon').src = icon(PANELS[tab].icon);
    const menu = menuOf(tab);
    if (menu) this.lastSub[menu.id] = tab;
    this.lastOpened = tab;
    this.root.querySelectorAll('#tabs button').forEach((b) => {
      b.classList.toggle('active', b.dataset.menu === menu?.id);
      if (b.dataset.menu === menu?.id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    this.renderSubtabs();
    this.root.querySelectorAll('[data-open]').forEach((b) => b.classList.toggle('active', b.dataset.open === tab));
    uiFx.syncIcons(this.root); // v9.2.6 : l'icône du menu choisi s'anime
    this.lastHud.tabs = null;
    this.updatePanelLow();
    this.invalidate();
  }

  // v9.1.3 (essai, doc1 4a) : panneau à deux hauteurs. ▼ rétracte le panneau (scène agrandie), choix mémorisé par
  // écran ; sans le réglage, la bande actuelle reste la seule hauteur.
  updatePanelLow() {
    // v9.9 (K1) : panneau du bas à deux hauteurs (45 % / 70 %), ⤢ bascule, choix gardé (préférence locale).
    if (this.root.classList.contains('bottom-ui')) {
      const tall = pref('panelTall') === true;
      this.root.classList.toggle('panel-tall', tall);
      const b = this.$('panel-fold');
      if (b) { b.classList.remove('hidden'); b.textContent = tall ? '⤡' : '⤢'; b.setAttribute('aria-label', tall ? 'Réduire le panneau' : 'Déplier le panneau'); b.setAttribute('aria-pressed', String(tall)); }
      return;
    }
    const on = pref('panelFold') === true;
    const low = on && Boolean(this.tab) && pref('panelLow')?.[this.tab] === true;
    this.root.classList.toggle('panel-low', low);
    const b = this.$('panel-fold');
    if (b) {
      b.classList.toggle('hidden', !on);
      b.textContent = low ? '▲' : '▼';
      b.setAttribute('aria-label', low ? 'Agrandir le panneau' : 'Rétracter le panneau (agrandir la scène)');
      b.setAttribute('aria-pressed', String(low));
    }
  }

  togglePanelLow() {
    if (!this.tab) return;
    if (this.root.classList.contains('bottom-ui')) { setPref('panelTall', !(pref('panelTall') === true)); this.updatePanelLow(); this.layoutChanged?.(); return; }
    const map = { ...(pref('panelLow') ?? {}) };
    if (map[this.tab]) delete map[this.tab]; else map[this.tab] = true;
    setPref('panelLow', map);
    this.updatePanelLow();
    this.layoutChanged?.();
  }

  closePanel() {
    uiFx.panelCloseFx(this.$('panel')); // v9.2.6 : le panneau s'efface (copie figée, les clics passent)
    this.sidePanel(false);
    this.tab = null;
    this.$('panel').classList.add('hidden');
    this.root.classList.remove('panel-open');
    this.updatePanelLow();
    this.root.querySelectorAll('#tabs button, [data-open]').forEach((b) => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
    uiFx.syncIcons(this.root); // v9.2.6
    this.lastHud.tabs = null;
  }

  invalidate() {
    this.dirty = true;
  }

  // --- Actions de l'interface ---
  onClick(event) {
    // v9.7.1 (lot 5) : lexique — un terme touché affiche sa phrase d'explication.
    const lex = event.target.closest('.lex');
    if (lex && GLOSSARY[lex.dataset.lex]) { event.stopPropagation(); this.toast(`${lex.dataset.lex} : ${GLOSSARY[lex.dataset.lex]}`, '#cfe0ff'); return; }
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const { action, key, id, stage, seconds, value, preset, boss: bossId, currency } = el.dataset;
    const v = this.view;
    const a = this.actions;
    const local = (fn) => { fn(); this.invalidate(); };
    switch (action) {
      case 'buy': { // v9.9 (K3) : un petit « +N » monte du bouton à chaque achat
        const lv = this.state.upgrades[key] ?? 0;
        a.buy(key, el.dataset.amount ?? '1');
        const d = (this.state.upgrades[key] ?? 0) - lv;
        if (d > 0 && !this.calm && typeof document !== 'undefined') { const r = el.getBoundingClientRect(); const f = document.createElement('span'); f.className = 'buy-float'; f.textContent = `+${d}`; f.style.left = `${Math.round(r.left + r.width / 2 - 8)}px`; f.style.top = `${Math.round(r.top - 6)}px`; document.body.appendChild(f); setTimeout(() => f.remove(), 750); }
        break;
      }
      case 'buy-amount': local(() => { v.buyAmount = value; v.qtyOpen = false; }); break;
      case 'skill-sel': local(() => { v.skillSel = v.skillSel === value ? null : value; }); break; // v9.1.3 : case de la grille
      case 'qty-toggle': local(() => { v.qtyOpen = !v.qtyOpen; }); break; // v9.1.3 (A22)
      case 'upgrade-cat': local(() => { v.upgradeCat = value; }); break;
      case 'inv-tab': if (value === 'stash') markInvUsed(this.state, 'stash'); local(() => { v.invTab = value; }); break;
      case 'craft-tier': local(() => { v.craftTier = value; }); break;
      case 'select-item': local(() => { v.selectedItemId = id; v.sheetOpen = 'item'; }); break;
      case 'auto-recycle-yes': this.closeModal(); a.setRecycleRule('mode', 'pickup'); break; // v9.3.4 : proposé au 1er sac plein
      case 'recycle-useless': a.recycleUseless(); local(() => { v.forgeFx = 'recycle'; }); setTimeout(() => { v.forgeFx = null; this.invalidate(); }, 700); break; // v9.3.4
      case 'item-more': local(() => { v.itemMore = value || null; }); break; // v9.3.4
      case 'bag-menu': local(() => { v.bagMenu = !v.bagMenu; }); break;
      case 'inv-view': if (value) markInvUsed(this.state, value); local(() => { v.invView = value || null; }); break;
      case 'apply-build': v.buildSel = Number(value); a.applyLoadout(Number(value)); break; // v9.1.3 : cartes de builds
      case 'item-tab': local(() => { v.itemTab = value; }); break; // v9.1.3 : onglets de la fiche d'objet
      case 'fuse-all':
        if (!v.fuseArmed) { local(() => { v.fuseArmed = true; }); clearTimeout(this.fuseTimer); this.fuseTimer = setTimeout(() => { v.fuseArmed = false; this.invalidate(); }, BULK_CONFIRM_MS); break; }
        clearTimeout(this.fuseTimer); v.fuseArmed = false; a.fuseAll(); break;
      case 'rename-build': local(() => { v.buildRename = v.buildRename === Number(value) ? null : Number(value); }); break;
      case 'confirm-rename-build': a.renameLoadout(Number(value), this.$('build-name')?.value); v.buildRename = null; break;
      case 'equip': a.equip(id); break;
      case 'recycle': {
        const list = visibleItems(this.state);
        const index = list.findIndex((i) => i.id === id);
        a.recycle(id);
        v.selectedItemId = list[index + 1]?.id ?? list[index - 1]?.id ?? null;
        break;
      }
      case 'filter': a.setFilter(value); break;
      case 'bulk-recycle': this.onBulkRecycle(); break;
      case 'equip-best': a.equipBest(); break;
      case 'goto':
        if (el.dataset.value === 'museum') this.openTab('encyclopedia', { encSec: 'museum' }); else this.openTab(el.dataset.value);
        break;
      case 'lock': a.toggleLock(id); break;
      case 'sharpen': a.sharpen(id); break;
      case 'upgrade-item': a.upgradeItem(id); break;
      case 'fuse': { // v9.1.3 (doc3 lot 2) : mise choisie (data-stake), 5 par défaut ; l'inclusion retombe après
        const [slot, rarity] = value.split('|');
        const inh = v.fuseSet?.[value]; // v9.1.3 (doc3 lot 5) : ensemble hérité choisi ('none' = Aucun)
        a.fuse(slot, rarity, Number(el.dataset.stake) || undefined, Boolean(v.fusionInclude?.[value]), inh === 'none' ? null : inh ?? 'auto');
        if (v.fusionInclude) delete v.fusionInclude[value];
        break;
      }
      case 'fuse-open': local(() => { v.fuseOpen = v.fuseOpen === value ? null : value; }); break; // v9.1.3 (doc3 lot 2)
      case 'fuse-set': local(() => { v.fuseSet = { ...(v.fuseSet ?? {}), [value]: el.dataset.set }; }); break; // v9.1.3 (doc3 lot 5)
      case 'fuse-include': local(() => { v.fusionInclude = { ...(v.fusionInclude ?? {}), [value]: !v.fusionInclude?.[value] }; }); break;
      case 'reforge': a.reforge(id); break;
      case 'target-reroll': { // v9.1.3 (doc3 lot 3) : relance orientée, 1er appui arme, 2e confirme
        const k = `${id}|${value}`;
        if (v.rerollArmed !== k) { local(() => { v.rerollArmed = k; }); clearTimeout(this.rerollTimer); this.rerollTimer = setTimeout(() => { v.rerollArmed = null; this.invalidate(); }, BULK_CONFIRM_MS); break; }
        clearTimeout(this.rerollTimer); v.rerollArmed = null; a.targetReroll(id, value); break;
      }
      case 'craft': a.craft(value, el.dataset.tier); break;
      case 'stage': a.selectStage(Number(stage)); break;
      case 'zone-sel': local(() => { v.zoneSel = Number(value); }); break;
      case 'retry-boss': a.retryBoss(); break;
      case 'advance': a.advance(); break;
      case 'toggle-auto': a.setAutoAdvance(!this.state.autoAdvance); break;
      case 'learn-skill': a.learnSkill(key); break;
      case 'skill-loadout': a.toggleLoadout?.(key); break; // v9.7.1 (lot 6)
      case 'hero-sel': local(() => { v.heroSel = value; }); break;
      case 'set-hero': a.setHero(value); break;
      case 'companion-sel': local(() => { v.companionSel = value; v.sheetOpen = 'companion'; v.skillPop = null; v.unitTab = 'skills'; v.unitShow = null; }); break;
      // v9.3.4 : popup de détail d'un compagnon.
      case 'comp-tab': local(() => { v.compTab = value; }); break;
      case 'skill-pop': local(() => { v.skillPop = value || null; }); break;
      case 'unit-tab': local(() => { v.unitTab = value; v.skillPop = null; }); break;
      case 'unit-show': local(() => { v.unitShow = value; }); break;
      case 'look-show': local(() => { v.lookShow = value; }); break; // v9.2.7 : vitrine d'une apparence
      case 'toggle-companion': a.toggleCompanion(value); break;
      case 'upgrade-companion': a.upgradeCompanion(value); break;
      case 'upgrade-team': a.upgradeTeam(); break; // v9.3.5
      case 'buy-best': if (this.view.buyAllArmed) { this.state.ui.buyAllOk = true; this.view.buyAllArmed = false; } a.buyBest(); break; // v9.3.5
      case 'buy-all-arm': local(() => { v.buyAllArmed = true; }); break; // v9.9 (K15)
      case 'distribute-skills': a.distributeSkills(); break; // v9.3.8 (3a)
      case 'offline-double': if (this.lastOffline && this.canDoubleOffline(this.lastOffline)) { a.doubleOffline(this.lastOffline); this.lastOffline = null; this.closeModal(); } break; // v9.3.8 (4)
      case 'arena-edit': local(() => { v.arenaEdit = true; }); break; // v9.3.5
      case 'open-tab': if (el.closest('#modal')) this.closeModal(); this.openTab(value); break;
      case 'session-goals': this.openModal(`${sessionGoalsHtml(this.state)}<div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">OK</button></div>`); break; // v9.8 (C1)
      case 'cast-skill': a.castSkillNow?.(el.dataset.skill); break; // v9.7.1 (lot 2)
      case 'cast-ult': a.castUltNow?.(value); break;
      case 'guard': a.guardNow?.(); break;
      case 'weak-spot': a.weakSpotNow?.(); break;
      case 'ranking-sort': this.actions.loadRanking(value); break;
      // v9.3.2 : guilde.
      case 'guild-rank': this.actions.loadGuild({ mode: value }); break;
      case 'guild-emblem': this.view.guildEmblem = value; this.invalidate(); break;
      case 'guild-search': this.view.guildQ = this.root.querySelector('[data-guild="q"]')?.value ?? ''; this.actions.loadGuild({ q: this.view.guildQ }); break;
      case 'guild-create': this.actions.guildDo('create', { name: this.root.querySelector('[data-guild="name"]')?.value, description: this.root.querySelector('[data-guild="desc"]')?.value,
        emblem: this.view.guildEmblem ?? 'weapon_sword', open: this.root.querySelector('[data-guild="open"]')?.checked !== false }); break;
      case 'guild-join': this.actions.guildDo('join', { name: value }); break;
      case 'guild-accept': this.actions.guildDo('accept', { pseudo: value }); break;
      case 'guild-kick': if (confirm(`Exclure ${value} de la guilde ?`)) this.actions.guildDo('kick', { pseudo: value }); break;
      case 'guild-role': { const [pseudo, role] = value.split('|'); this.actions.guildDo('role', { pseudo, role }); break; }
      case 'guild-leave': if (confirm('Quitter la guilde ? Vos contributions de la semaine restent à la guilde.')) this.actions.guildDo('leave'); break;
      case 'open-account': {
        this.openTab('options', { optTab: 'general' });
        // Après le dessin du panneau : jusqu'au formulaire de compte.
        setTimeout(() => {
          const field = this.$('cloud-claim-pseudo') ?? this.$('cloud-pseudo');
          field?.scrollIntoView({ block: 'center' });
          field?.focus({ preventScroll: true });
        }, 250);
        break;
      }
      case 'stats-zone': this.view.statsZone = value; this.pendingScroll = 0; this.invalidate(); break;
      case 'ranking-scope': this.actions.loadRanking(undefined, value); break;
      case 'friend-add': this.actions.friendAction('add', this.$('friend-pseudo')?.value); break;
      case 'friend-accept': this.actions.friendAction('accept', value); break;
      case 'friend-remove': this.actions.friendAction('remove', value); break;
      case 'summon': {
        const res = a.summon(Number(value), currency, el.dataset.pool);
        if (res) {
          v.lastSummon = res; v.summonPool = normalizePool(el.dataset.pool); playSummonReveal(res);
          queueSkinReveals(res, () => this.state, (id) => { a.setHero(id); this.invalidate(); }); // v9.1.9
        }
        this.invalidate();
        break;
      }
      case 'summon-pool': local(() => { v.summonPool = value; v.lastSummon = null; }); break;
      // v9.2.8 : économie (wishlist, fragments SSR, boutique sans paiement réel, aperçus, événement).
      case 'wish-toggle': a.wishToggle(value); break;
      case 'use-fragment': a.useSsrFragment(value); break;
      case 'shop-cat': local(() => { v.shopCat = value; }); break;
      case 'buy-offer': a.buyOffer(value); break;
      case 'theme-preview': a.previewTheme(value || null); break;
      case 'look-preview': v.lookShow = value; this.openTab('looks'); break;
      case 'unequip-look': a.unequipLook(); break;
      case 'open-shop-skins': v.shopCat = 'skins'; this.openTab('shop'); break;
      case 'event-chain': { // v9.6.2 (7.4)
        const r = a.eventChain(Number(value));
        v.eventLast = r.won ? `${r.won} étape${r.won > 1 ? 's' : ''} gagnée${r.won > 1 ? 's' : ''} : +${formatNumber(r.coins)} écus${r.stopped ? ` · arrêt à l'étape ${r.stopped}` : ''}` : 'Défaite : renforce le héros puis réessaie.';
        this.invalidate();
        break;
      }
      case 'event-fight': {
        const r = a.eventFight(Number(value));
        if (r && !r.error) v.eventLast = r.won ? `Victoire : +${r.reward.eventCoins} écus${r.reward.ssrFragment ? ' · fragment Légendaire universel' : ''}` : 'Défaite : renforce le héros puis réessaie.';
        this.invalidate();
        break;
      }
      case 'global-boss': // v9.3.2 : Boss commun (même écran, barre commune côté serveur)
        openWorldBoss(this.state, { start: () => a.globalBossStart(), finish: (setup, r) => a.globalBossFinish(setup, r), left: () => a.globalBossLeft(), closed: () => this.invalidate() });
        break;
      case 'event-boss': // v9.2.9 : vrai combat animé (ui/world-boss.js)
        openWorldBoss(this.state, { start: () => a.eventBossStart(), finish: (setup, r) => a.eventBossFinish(setup, r), left: () => a.eventBossLeft(), closed: () => this.invalidate() });
        break;
      case 'revenge': // v9.7.1 (lot 4) : face-à-face de fin de monde avec le Colosse (moteur des grands boss)
        if (el.closest('#modal')) this.closeModal();
        { let sum = null; openWorldBoss(this.state, { start: () => a.revengeStart(), finish: (setup, r) => (sum = a.revengeFinish(setup, r)), left: () => 0, closed: () => { this.invalidate(); if (sum && !sum.success) setTimeout(() => this.mentorScreen('Pas encore…', sum.text), 300); } }); } // v9.9 (K4)
        break;
      case 'event-buy': a.eventBuy(value); break;
      case 'event-goal': a.eventGoal(value); break;
      case 'summon-odds': local(() => { v.summonOdds = v.summonOdds === value ? null : value; }); break; // v9.1.3 : « ? » d'un bassin
      case 'power-pity': local(() => { v.powerPity = v.powerPity === value ? null : value; }); break; // v9.1.3 : garantie derrière « ? »
      case 'talent-sel': local(() => { v.talentSel = value; }); break;
      case 'buy-talent': a.buyTalent(key); break;
      case 'rebirth': this.showRebirthConfirm(this.state); break;
      case 'confirm-rebirth': {
        const keep = this.$('modal-card').querySelector('input[name="keep-power"]:checked')?.value;
        this.closeModal();
        a.rebirth(keep);
        break;
      }
      case 'buy-perk': a.buyPerk(key); break;
      case 'ask-replace': local(() => { v.replaceFor = value || null; }); break;
      case 'replace-companion': { const [n, o] = value.split('|'); a.replaceCompanion(n, o); break; }
      case 'save-loadout': a.saveLoadout(Number(value)); break;
      case 'apply-loadout': a.applyLoadout(Number(value)); break;
      case 'claim-collection': a.claimCollection(value); break;
      case 'boss-sel': local(() => { v.bossSel = value; v.sheetOpen = 'boss'; }); break; // v9.1.3 : fiche en feuille du bas
      case 'enc-sec': local(() => { v.encSec = value; }); break;
      case 'enc-sel': local(() => { v.encSel = value; }); break;
      case 'enc-slot': local(() => { v.encSlot = value; }); break;
      case 'enc-claim': a.claimEncyclopedia(); break;
      case 'recycle-toggle': a.setRecycleRule(el.dataset.group, value); break;
      case 'mission-tab': local(() => { v.missionTab = value; }); break;
      case 'claim-peek': local(() => { v.claimPeek = !v.claimPeek; }); break; // v9.2.5 : liste de « Tout récupérer »
      case 'exp-dur': local(() => { v.expDur = value; }); break; // v9.1.3 : durée commune des expéditions
      case 'exp-per-slot': local(() => { v.expPerSlot = !v.expPerSlot; }); break;
      case 'defi-tab': local(() => { v.defiTab = value; }); if (value === 'arena') a.loadGlobalBoss?.(); break; // v9.1.3 : Défis › Tour / Défi de la semaine
      case 'lang': a.setLanguage(value); break;
      case 'theme': a.setTheme(value); break;
      case 'speed': a.cycleSpeed(); break;
      case 'autofuse': a.setAutoFuse(el.dataset.group, value); break;
      case 'check-update': a.checkUpdate(); break;
      case 'enter-tower': a.enterTower(); break;
      case 'skill-up': { const [id, kind] = value.split('|'); a.skillUp(id, kind); break; } // v9.3.3
      case 'gear-who': local(() => { v.gearWho = value; v.sheetOpen = null; }); break; // v9.3.4 (f)
      case 'bag-all': local(() => { v.bagAll = Boolean(value); }); break; // v9.3.8 (2.4)
      case 'gear-equip': { const [id, item] = value.split('|'); a.gearDo('equip', id, item); break; }
      case 'gear-unequip': { const [id, slot] = value.split('|'); a.gearDo('unequip', id, slot); break; }
      case 'gear-up': a.gearDo('up', null, value); break;
      case 'gear-recycle': a.gearDo('recycle', null, value); break;
      // v9.3.2 : Arène des compagnons.
      case 'arena-mode': this.view.arenaMode = value; this.view.arenaRun = null; this.invalidate(); break;
      case 'arena-pick': this.view.arenaPick = value; this.invalidate(); break;
      case 'arena-team': {
        const t = [...(this.view.arenaTeam ?? [])];
        this.view.arenaTeam = t.includes(value) ? t.filter((x) => x !== value) : [...t, value].slice(0, 3);
        this.invalidate(); break;
      }
      case 'arena-survival': { const r = a.arenaSurvival(value); if (r) { this.view.arenaRun = { ...r, mode: 'survival', start: performance.now() }; } this.invalidate(); break; }
      case 'arena-floor': { const r = a.arenaFloor(this.view.arenaTeam ?? []); if (r) { this.view.arenaRun = { ...r, mode: 'floors', start: performance.now() }; } this.invalidate(); break; }
      case 'arena-close': {
        const run = this.view.arenaRun;
        const span = run?.fight.seconds ?? 0, speed = Math.max(1, span / 12), now = performance.now();
        if (run && ((now - run.start) / 1000) * speed < span) run.start = now - (span / speed) * 1000 - 1; // « Passer » : fin de la relecture
        else this.view.arenaRun = null;
        this.invalidate(); break;
      }
      // v9.1.3 (doc4 lots 4 à 6) : Archives, mode monde, essai gratuit, score.
      case 'archive-target': a.setArchiveTarget(value); break;
      case 'open-world': this.openTab('world', { worldSel: value }); break;
      case 'enter-world': a.enterWorld(el.dataset.unit, el.dataset.kind, el.dataset.n, el.dataset.trial === '1'); break;
      case 'leave-world': a.leaveWorld(); break;
      case 'leave-tower': a.leaveTower(); break;
      case 'leave-mode':
        if (this.state.tower) a.leaveTower();
        else if (this.state.challenge) a.leaveChallenge();
        else if (this.state.dungeon) a.abandonDungeon();
        else if (this.state.farmBoss) a.stopFarmBoss();
        break;
      case 'github-token': a.setGithubToken(this.$('github-token')?.value); break;
      case 'cloud-register': this.cloudDraft('cloud-pseudo'); a.cloudRegister(this.$('cloud-pseudo')?.value, this.$('cloud-password')?.value); break;
      // Garde le nom tapé si le panneau est redessiné (message d'erreur) ; jamais les mots de passe.
      case 'cloud-login': this.cloudDraft('cloud-pseudo'); a.cloudLogin(this.$('cloud-pseudo')?.value, this.$('cloud-password')?.value); break;
      case 'cloud-claim': this.cloudDraft('cloud-claim-pseudo'); a.cloudClaim(this.$('cloud-claim-pseudo')?.value?.trim(), this.$('cloud-claim-password')?.value, this.$('cloud-claim-confirm')?.value); break;
      case 'cloud-rename': this.cloudDraft('cloud-rename-pseudo'); a.cloudRename(this.$('cloud-rename-pseudo')?.value?.trim(), this.$('cloud-rename-password')?.value); break;
      case 'cloud-resume': a.cloudResume(); break;
      case 'cloud-logout': a.cloudLogout(); break;
      case 'cloud-sync': a.cloudSync(); break;
      case 'cloud-delete': a.cloudDelete(this.$('cloud-delete-password')?.value); break;
      case 'install-update': a.installUpdate(); break;
      case 'retry-installer': this.closeModal(); a.retryInstaller(); break;
      case 'open-releases': a.openReleases(); break;
      case 'cheat':
        v.cheatCode = this.$('cheat-code')?.value ?? '';
        v.cheatTimes = this.$('cheat-times')?.value ?? '1';
        a.cheat(v.cheatCode, v.cheatTimes);
        break;
      case 'cheat-remove': a.removeCheat(value, el.dataset.times === 'all' ? Infinity : cheatTimes(this.$('cheat-times')?.value)); break;
      case 'cheat-reset': a.cheat('RESETCODES'); break;
      case 'rush': {
        const rush = RUSHES.find((r) => r.id === value);
        if (rush && !rushUnlocked(this.state, rush)) this.toast(`${rush.name} : débloqué au niveau ${rush.unlockLevel} du héros.`);
        else a.activateRush(value);
        break;
      }
      case 'upgrade-rush': a.upgradeRush(key); break;
      case 'reroll': a.rerollPower(bossId); break;
      case 'keep-power': a.resolvePower(bossId, false); break;
      case 'take-power': a.resolvePower(bossId, true); break;
      case 'toggle-power': a.togglePower(bossId); break;
      case 'rechallenge': a.rechallenge(bossId); break;
      case 'claim-mastery': a.claimMastery(bossId); break;
      case 'show-odds': local(() => { if (v.oddsOpen.has(bossId)) v.oddsOpen.delete(bossId); else v.oddsOpen.add(bossId); }); break;
      case 'dungeon-slot': local(() => { v.dungeonSlot = value; }); break;
      case 'dungeon-path-pre': local(() => { v.dungeonPath = value; a.rememberDungeonChoice('path', value); }); break;
      case 'dungeon-path': a.setDungeonPath(value); break;
      case 'sweep-dungeon': this.closeModal(); a.sweepDungeon(value, v.dungeonSlot ?? this.state.ui.dungeonSlot ?? 'any', v.dungeonPath ?? this.state.ui.dungeonPath ?? 'gold', el.dataset.diff ?? v.dungeonDiff ?? 'easy'); break; // v9.8 (H2)
      case 'enter-dungeon': this.closeModal(); a.enterDungeon(value, v.dungeonSlot ?? this.state.ui.dungeonSlot ?? 'any', v.dungeonPath ?? this.state.ui.dungeonPath ?? 'gold', el.dataset.diff ?? v.dungeonDiff ?? 'easy', v.dungeonRoute ?? 'normal'); break;
      case 'dungeon-route': local(() => { v.dungeonRoute = value; }); break; // v9.6.2
      case 'dungeon-sel': local(() => { v.dungeonSel = value; v.dungeonDiff = null; }); break;
      case 'dungeon-diff': local(() => { v.dungeonDiff = value; }); break;
      case 'abandon-dungeon': a.abandonDungeon(); break;
      case 'claim-contract': a.claimContract(Number(value)); break;
      case 'claim-mission': { const [period, id] = value.split('|'); a.claimMission(period, id); break; }
      case 'claim-mission-bonus': a.claimMissionBonus(value); break;
      case 'claim-track': a.claimTrack(); break;
      case 'claim-login': a.claimLogin(); if (el.closest('#modal')) this.closeModal(); break;
      case 'claim-all': a.claimAll(); break;
      case 'claim-everything': a.claimEverything(); break;
      case 'session-return': this.closeModal(); a.sessionReturn(); break;
      case 'currency': this.showCurrency(value); break;
      case 'res-info': this.showResource(value); break; // v9.3.9 (2.6)
      case 'res-go': this.closeModal(); this.view.sheetOpen = null; this.openTab(value); break;
      case 'currency-go': { const c = CURRENCIES[value]; this.closeModal(); if (c) this.openTab(c.tab, c.view ?? null); break; }
      case 'claim-achievement': a.claimAchievement(value); break;
      case 'map-zoom': local(() => { v.mapZoom = value === 'reset' ? 1 : Math.min(2.5, Math.max(0.5, (v.mapZoom ?? 1) * (value === 'in' ? 1.25 : 0.8))); }); break;
      case 'tree-zoom': local(() => {
        if (value === 'reset') recenterTree();
        v.treeZoom = value === 'reset' ? TREE_ZOOM : Math.min(2, Math.max(0.3, (v.treeZoom ?? TREE_ZOOM) * (value === 'in' ? 1.25 : 0.8)));
      }); break;
      case 'buy-talent-max': a.buyTalentMax(key); break;
      case 'buy-talents-all': this.closeModal(); a.buyTalentsAll(value || null); break;
      case 'ask-buy-talents': this.showBuyTalents(value || null); break;
      case 'tree-seg': local(() => { v.treeSeg = value; }); break;
      case 'quick-hunt': a.quickHunt(); break; // v9.8 (H3)
      case 'gear-best': a.gearBest(value); break; // v9.8 (I6)
      case 'rank-duel': this.rankDuel(); break; // v9.8 (H6)
      case 'drawer': this.openDrawer(); break; // v9.9 (K6)
      case 'rush-lock': { const m = (this.state.rushes.manual ??= {}); if (m[value]) delete m[value]; else m[value] = true; this.invalidate(); break; } // v9.9 (K16)
      case 'road-choice': clearTimeout(this.roadTimer); el.closest('.road-bubble')?.remove(); a.roadChoice(Number(value)); break; // v9.9 (K8)
      case 'pick-boon': clearInterval(this.boonTimer); a.pickBoon(Number(value)); this.closeModal(); break; // v9.9 (K7)
      case 'mentor-tip': this.followTip(this.mentorTipsShown?.[Number(value)]); break; // v9.9 (K4)
      case 'locked-tab': this.toast(`🔒 ${this.lockReason(value)}`, '#ffcf6a'); break;
      case 'open-claims': this.closeModal(); this.openClaims(); break;
      case 'sleep-mode': this.closeModal(); this.closePanel?.(); this.sleepMode(true); break; // v9.8 (H9)
      case 'fw-day': local(() => { v.fwDay = value; }); break; // v9.8 (H5)
      case 'fw-claim': a.firstWeekClaim(Number(value)); break;
      case 'fw-all': a.firstWeekAll(); break; // v9.9 (K9)
      case 'fw-prize': a.firstWeekPrize(value); break;
      case 'rift-open': this.showRift(false); break;
      case 'titan-start-modal': this.closeModal(); // v9.9 (K10) : depuis la carte de la Faille
      // falls through
      case 'titan-start': // v9.8 (H7)
        { let sum = null; openWorldBoss(this.state, { start: () => a.titanStart(), finish: (setup, r) => (sum = a.titanFinish(setup, r)), left: () => titanTriesLeft(this.state), closed: () => { this.invalidate(); if (sum && sum.tier !== 'Top 10 %') setTimeout(() => this.mentorScreen(sum.tier, `Barre vidée : ${Math.round(sum.ratio * 100)} %`, { element: titanToday().element ?? null }), 300); } }); } // v9.9 (K4)
        break;
      case 'wheel-open': this.showWheel(); break; // v9.8 (H4)
      case 'wheel-spin': this.spinWheel(); break;
      case 'daybook-chest': a.daybookChest(); break; // v9.8 (H1)
      case 'offline-claim': this.closeModal(); this.adviceArrow(); break; // v9.8 (C1) : le conseil devient une flèche dorée
      case 'forge-seg': local(() => { v.forgeSeg = value; }); break; // v9.8 (C2)
      case 'talent-branch': a.buyTalentStep(value); break; // v9.3.9 : vue simple des Talents
      case 'talent-best': a.buyTalentsAll(null); break;
      case 'apply-team': a.applyTeam(); break; // v9.5.0
      case 'claim-session-chest': a.claimSessionChest(); break; // v9.6.5
      case 'set-front': a.setFront(value); break; // v9.6.3 (3.5)
      case 'ult-order': { const [id, o] = value.split('|'); a.setOrder(id, o); break; } // v9.6.3
      case 'rush-slot': { const [i, id] = value.split('|'); a.setRushSlot(Number(i), id); break; } // v9.6.3
      case 'equip-for': a.equipFor(value); break; // v9.5.2
      case 'prep-apply': this.closeModal(); a.applyTeam(); break; // v9.5.1
      // v9.1.3 (A18) : une clé de voûte de la vue Région ouvre l'arbre centré sur elle.
      case 'region-key': local(() => { v.talentSel = value; v.treeSeg = 'tree'; recenterTree(); }); break;
      case 'buy-tperk': a.buyTranscendPerk(key); break;
      case 'buy-tperk-max': a.buyTranscendPerk(key, true); break;
      case 'transcend': this.showTranscendConfirm(this.state); break;
      case 'confirm-transcend': {
        const keep = this.$('modal-card').querySelector('input[name="keep-power"]:checked')?.value;
        this.closeModal();
        a.transcend(keep);
        break;
      }
      case 'send-all-expeditions': a.sendAllExpeditions(value || 'explore'); break; // v9.6.2
      case 'start-expedition': { const [cid, type, slot] = value.split('|'); a.startExpedition(cid, type, slot === undefined ? null : Number(slot)); break; }
      case 'claim-all-expeditions': a.claimAllExpeditions(); break;
      case 'relaunch-expeditions': a.relaunchExpeditions(); break;
      case 'claim-expedition': a.claimExpedition(Number(value)); break;
      case 'recall-expedition': a.recallExpedition(Number(value)); break;
      case 'enter-challenge': a.enterChallenge(); break;
      case 'leave-challenge': a.leaveChallenge(); break;
      case 'to-stash': a.toStash(id); break;
      case 'from-stash': a.fromStash(id); break;
      case 'stash-sel': local(() => { v.stashSel = id; v.sheetOpen = 'item'; }); break;
      case 'hero-tab': local(() => { v.heroTab = value; }); break;
      case 'measure-farm': local(() => { v.farmRate = measureFarmRate(this.state, BALANCE, 120); }); break;
      case 'set-class': a.setHeroClass(value); break;
      case 'tour-full': a.startTour(); break;
      case 'replay-prologue': a.replayPrologue(); break; // v9.7.1 (lot 1)
      case 'tour-later': a.skipTour(); break;
      case 'open-summon-hero': local(() => { v.summonPool = 'hero'; }); this.openTab('summon'); break;
      case 'open-looks': if (el.closest('#modal')) this.closeModal(); this.openTab('looks'); break; // v9.2.2 : sous-onglet Héros › Apparences
      case 'claim-bounty': a.claimBounty(); break;
      case 'bounty-go': a.goToStage(Number(value)); break;
      case 'toggle-tips': event.preventDefault(); local(() => { v.tipsOpen = v.tipsOpen === false; }); break;
      case 'wear-set': a.wearSet(value); break; // v9.1.3 : mannequins fondus dans le coffre
      case 'auto-mannequin': a.setAutoMannequin(this.state.ui.autoMannequin === false); break;
      case 'to-museum': a.toMuseum(id); break;
      case 'from-museum': a.fromMuseum(value); break;
      case 'auto-museum': a.setAutoMuseum(this.state.ui.autoMuseum === false); break;
      case 'expose-all': a.exposeAll(); break;
      case 'recycle-museum-dupes': a.recycleMuseumDuplicates(); break;
      case 'keep-sets': a.setKeepSets(this.state.ui.keepSets === false); break;
      case 'auto-useless': a.setAutoUseless(this.state.ui.autoUseless === false); break; // v9.3.8 (3d)
      case 'buy-talent-path': a.buyTalentPath(key); break;
      case 'respec-talents': this.showRespecConfirm(this.state); break;
      case 'confirm-respec': this.closeModal(); a.respecTalents(); break;
      case 'cycle-sel': local(() => { v.cycleSel = Number(value); v.zoneSel = null; }); break;
      case 'claim-all-events': a.claimAllEvents(); break;
      case 'toggle-section': local(() => {
        v.open ??= new Set();
        const expanded = el.dataset.expanded === undefined ? !v.closed.has(value) : el.dataset.expanded === 'true';
        if (expanded) { v.closed.add(value); v.open.delete(value); } else { v.closed.delete(value); v.open.add(value); }
      }); break;
      case 'claim-event': a.claimEvent(Number(value)); break;
      case 'buy-merchant': a.buyMerchant(Number(value)); break;
      case 'dismiss-event': a.dismissEvent(Number(value)); break;
      case 'save': a.saveNow(); break;
      case 'simulate': a.simulateAbsence(Number(seconds)); break;
      case 'reset': this.showResetConfirm(); break;
      case 'confirm-reset':
        if (/^(EFFACER|ERASE)$/i.test(this.$('reset-confirm')?.value.trim() ?? '')) { this.closeModal(); a.reset(); }
        break;
      case 'opt-tab': local(() => { v.optTab = value; v.importOpen = false; v.exportCode = null; }); break;
      case 'capture-key': local(() => { v.keyCapture = v.keyCapture === value ? null : value; }); break;
      case 'reset-keys': setPref('keys', {}); setCustomKeys({}); this.invalidate(); break;
      case 'export-save': a.exportSave(value); break;
      case 'import-open': local(() => { v.importOpen = !v.importOpen; }); break;
      case 'import-save': this.importFromPanel(); break;
      case 'close-modal': this.closeModal(); break;
      case 'rebirth-talent': this.closeModal(); this.openTab('tree'); break; // v9.3.5
      case 'open-claims': this.openClaims(); break;
      case 'show-boost': this.showBoost(this.state); break;
      case 'toggle-boosts': this.boostsOpen = !this.boostsOpen; delete this.lastHud.rushTime; break;
      case 'close-sheet': local(() => { v.sheetOpen = null; }); break;
      case 'intro-seen': a.markSeen(value); break;
      case 'show-shortcuts': this.showShortcuts(); break;
      case 'show-journal': this.showJournal(this.sessionJournal?.() ?? {}); break;
      case 'confirm-speed100': this.closeModal(); a.setSpeed(100); break;
      case 'window-size': a.setWindowSize(preset); break;
      case 'strip-menu': this.toggleMenu(menuOf(this.lastOpened)?.id ?? MENUS[0].id); break;
      default: break;
    }
  }

  onChange(event) {
    const el = event.target;
    const action = el.dataset.action;
    if (action === 'sort') this.actions.setSort(el.value);
    if (action === 'gear-filter') { const f = { slot: 'all', rarity: 'all', compat: true, ...this.view.gearFilter }; f[el.dataset.key] = el.dataset.key === 'compat' ? el.value === 'true' : el.value; this.view.gearFilter = f; this.invalidate(); } // v9.3.3
    if (action === 'rarity-filter') { this.state.ui.rarityFilter = el.value; this.invalidate(); } // v9.3.2
    if (action === 'filter-select') this.actions.setFilter(el.value);
    if (action === 'upgrade-cat-select') { this.view.upgradeCat = el.value; this.invalidate(); }
    if (action === 'upgrade-sort') { this.view.upgradeSort = el.value || null; this.invalidate(); }
    if (action === 'zone-select') { this.view.zoneSel = Number(el.value); this.invalidate(); }
    if (action === 'cycle-select') { this.view.cycleSel = Number(el.value); this.view.zoneSel = null; this.invalidate(); }
    if (action === 'dungeon-slot-select') { this.view.dungeonSlot = el.value; this.actions.rememberDungeonChoice('slot', el.value); this.invalidate(); }
    if (action === 'skill-details') { this.view.open ??= new Set(); if (el.checked) this.view.open.add('skill-details'); else this.view.open.delete('skill-details'); this.invalidate(); }
    if (action === 'device-pref') {
      const name = el.dataset.key;
      this.setDevicePref(name, el.type === 'checkbox' ? el.checked : el.value);
    }
    if (action === 'tree-buyable') { this.view.treeBuyable = el.checked; this.invalidate(); }
    if (action === 'ranking-world') this.actions.loadRanking(undefined, undefined, Number(el.value));
    if (action === 'stats-zone-select') { this.view.statsZone = el.value; this.invalidate(); }
    if (action === 'enc-slot-select') { this.view.encSlot = el.value; this.invalidate(); }
    if (action === 'reroll-type') { this.view.rerollType = el.value; this.view.rerollArmed = null; this.invalidate(); } // v9.1.3 (doc3 lot 3)
    if (action === 'bounty-zone') this.actions.setBountyZone(Number(el.value)); // v9.1.3 (doc3 lot 3)
    if (action === 'craft-slot') { this.view.craftSlot = el.value; this.invalidate(); }
    if (action === 'stash-set') { this.view.stashSet = el.value || null; this.view.stashSel = null; this.invalidate(); } // v9.1.3
    if (action === 'build-select') { this.view.buildSel = Number(el.value); this.actions.applyLoadout(Number(el.value)); }
    if (action === 'auto') this.actions.setAutoAdvance(el.checked);
    if (action === 'on-top') this.actions.setAlwaysOnTop(el.checked);
    if (action === 'skill-auto') this.actions.setSkillAuto(el.checked);
    if (action === 'rush-auto') this.actions.setRushAuto(el.checked);
    if (action === 'skills-auto-all') { this.actions.setSkillAuto(el.checked); this.actions.setRushAuto(el.checked); } // v9.1.3 : un seul Auto (grille)
    if (action === 'volume') this.sound?.setVolume(el.dataset.kind, Number(el.value) / 100);
    if (action === 'mute') this.sound?.setMuted(el.checked);
    if (action === 'notify') this.actions.setNotify(el.dataset.key, el.checked);
    if (action === 'cloud-listed') this.actions.cloudListed(el.checked);
    if (action === 'cinematics') this.actions.setCinematics(el.checked);
    if (action === 'screen-shake') this.actions.setShake(el.checked); // v9.3.9
    if (action === 'simple-mode') this.actions.setSimple(el.checked); // v9.7.1 (lot 5)
    if (action === 'combat-assist') this.actions.setCombatAssist(el.value); // v9.7.1 (lot 2)
    if (action === 'skill-names') this.actions.setSkillNames(el.checked); // v9.7.1 (lot A)
    if (action === 'vigil-auto') { if (el.checked) delete this.state.ui.vigil; else this.state.ui.vigil = false; } // v9.9 (K12)
    if (action === 'gain-feed') { if (el.checked) delete this.state.ui.feed; else this.state.ui.feed = false; } // v9.9 (K11)
    if (action === 'char-size') this.actions.setCharSize(el.value); // v9.7.1
    if (action === 'big-auras') this.actions.setBigAuras(el.checked); // v9.5.3
    if (action === 'metrics-opt-in') this.actions.setMetricsOptIn(el.checked); // v9.6.5
    if (action === 'bind-build') this.actions.bindBuild(Number(el.dataset.value), el.value); // v9.6.1
    if (action === 'auto-recycle') this.actions.setAutoRecycle(el.value);
    if (action === 'recycle-mode') this.actions.setRecycleRule('mode', el.value);
    if (action === 'exp-dur-slot') { this.view.expDurSlot = { ...(this.view.expDurSlot ?? {}), [el.dataset.slot]: el.value }; this.invalidate(); }
    if (action === 'exp-pick') {
      this.view.expPick = { ...(this.view.expPick ?? {}), [el.dataset.slot]: el.value };
      this.invalidate();
    }
    if (action === 'bulk-rarity') {
      this.view.bulkRarity = el.value;
      this.view.bulkArmed = false;
      this.invalidate();
    }
  }

  // Recyclage groupé en deux temps : un premier clic arme le bouton, le second confirme.
  onBulkRecycle() {
    if (!this.view.bulkArmed) {
      this.view.bulkArmed = true;
      this.invalidate();
      clearTimeout(this.bulkTimer);
      this.bulkTimer = setTimeout(() => {
        this.view.bulkArmed = false;
        this.invalidate();
      }, BULK_CONFIRM_MS);
      return;
    }
    clearTimeout(this.bulkTimer);
    this.view.bulkArmed = false;
    this.actions.recycleBulk(this.view.bulkRarity);
  }

  // --- Événements de la simulation : bandeaux courts, fil d'actualité, pastilles ---
  handleEvent(event, state) {
    this.state = state;
    switch (event.type) {
      case 'drop': {
        // v9.1.0 : le fil ne montre plus que les objets Rare ou mieux ; les objets neufs sont comptés sur le menu
        // Héros (+N), recyclage et fusions vont au journal de session.
        const rarity = rarityById(event.item.rarity);
        const added = !event.autoRecycled || event.mannequin || event.museum;
        // v9.7.1 : objet dans le sac de butin de la scène → plus de ligne « Butin : … » (le sac la remplace).
        if (event.bagged) { this.lootBag?.bump(); if (event.item.rarity === 'legendary') this.announce(`Objet légendaire : ${event.item.name}`); break; }
        // v9.8.1 (0) : premiers objets — bulle « Nouvel objet ! » sur la scène avec un bouton « Équiper » direct.
        // v9.9 (K5) : carte « Meilleur objet » sur la scène (héros, ou compagnon de la bonne classe), dès le premier objet.
        if (added && state.inventory.some((i) => i.id === event.item.id)) {
          const forHero = isUpgrade(state, event.item) || ((state.records?.equips ?? 0) < 1 && canEquipHero(state, event.item));
          const unit = forHero ? null : teamUpgradeFor(state, event.item);
          if (forHero || unit) this.bestItemCard(event.item, unit);
        }
        if (added && event.item.rarity !== 'common') {
          this.news(event.museum ? `${event.item.name} exposé au Musée`
            : event.mannequin ? `${event.item.name} rangé au coffre (ensemble « ${setById(event.item.set)?.name ?? ''} »)`
              : `Butin : ${event.item.name} (${rarity.label})`, rarity.color);
          if (event.item.rarity === 'legendary') this.announce(`Objet légendaire : ${event.item.name}`);
        }
        if (this.tab === 'inventory' || this.tab === 'hero') this.invalidate();
        break;
      }
      case 'bossSummon':
        this.banner(`${BOSSES[event.master]?.name ?? ''} invoque ${(BOSSES[event.kind] ?? ENEMIES[event.kind])?.name ?? 'des serviteurs'} !`, 'boss tier-hard');
        break;
      case 'bossEnrage':
        this.banner(`${BOSSES[event.kind].name} enrage !`, 'boss tier-mega');
        break;
      case 'bossLoot':
        this.news(`Butin du boss : +${event.shards} éclats`, '#e27bff');
        break;
      case 'bossSpawn':
      {
        if (state.ui.notify?.boss === false) break;
        const tier = BOSSES[event.kind].tier ?? 'mega';
        const label = { mini: 'Mini-boss', mid: 'Boss', hard: 'Boss redoutable', mega: 'MÉGA BOSS' }[tier];
        // v9.0.6 : mécanique du boss annoncée (et ce qui la contre) dans les nouvelles.
        const trait = bossTrait(event.kind);
        // v9.1.9 : alerte « ⚠ BOSS / DANGER » sur la scène (une par arrivée, courte en boucle, sobre si animations réduites).
        this.bossMemory ??= {};
        const plan = bossWarningPlan(this.bossMemory, { tier, kind: event.kind, enemyId: event.enemyId, name: BOSSES[event.kind].name,
          mode: state.dungeon ? 'dungeon' : state.tower ? 'tower' : 'stage', now: Date.now(), calm: reduceMotion(), fast: (this.speed ?? 1) >= 100 });
        if (plan) showBossWarning(plan);
        if (trait) this.news(`${BOSSES[event.kind].name} — ${trait.name} : ${trait.short}`, trait.color, 2);
        if (tier === 'mega' || tier === 'hard') this.announce(`${label} : ${BOSSES[event.kind].name}`);
        if ((tier === 'mega' || tier === 'hard') && !this.calm) {
          const flash = this.$('boss-flash');
          flash.className = `tier-${tier}`;
          void flash.offsetWidth;
          flash.classList.add('on');
        }
      }
        break;
      case 'worldClosed': { // v9.6.5 (10.3)
        const t = worldOpensAt(zoneIndexForStage(event.stage));
        if (t) this.news(`Prochain monde ouvert dans ${formatDuration((t - Date.now()) / 1000)}`, '#ffd54a');
        break;
      }
      case 'eliteSpawn':
        this.news('Une élite errante approche !', '#ff9a3d');
        this.banner('Élite !', 'boss'); // v9.6.4 (6.5) : annoncée sur la scène
        break;
      case 'mutantSpawn': {
        const m = mutationById(event.mutation);
        if (m && !state.ui.focus) { this.news(`Ennemi muté — ${m.name} : ${m.text} (or ×3, objet garanti)`, m.color); this.banner('Vague mutante !', 'boss'); }
        break;
      }
      case 'mutantSplit':
        if (!state.ui.focus) this.news('Le mutant se dédouble !', '#7fe07a');
        break;
      case 'eliteDefeated':
        this.news(`Élite vaincue : +${event.gems} gemmes`, '#6fd6ff');
        break;
      case 'bossDefeated':
        this.banner('Boss vaincu !', 'win');
        break;
      case 'powerUnlocked': {
        const power = powerById(event.powerId);
        this.banner(`Pouvoir : ${power.name}`, 'win');
        this.news(`${BOSSES[event.bossId].name} : ${power.name} (${effectText(power.effects)}) · +${BALANCE.summon.firstBossGems} gemmes`, '#e8b64a');
        this.newTabs.add('boss');
        if (this.tab === 'boss') this.invalidate();
        break;
      }
      case 'rerollCharge': {
        const entry = state.powers[event.bossId];
        this.news(`${BOSSES[event.bossId].name} réaffronté : charge de relance ${entry.charges}/${maxCharges(state)}`, '#f2d083');
        if (this.tab === 'boss') this.invalidate();
        break;
      }
      case 'levelUp':
        this.banner(`Niveau ${event.level} !`, 'win');
        uiFx.levelUpFx(); // v9.2.6
        this.news(`Niveau ${event.level} : +1 point de compétence`, '#f2d083');
        if (event.level % 10 === 0) this.news(`Palier de puissance ${Math.floor(event.level / 10)} : +3 % de dégâts`, '#ffd54a'); // v9.6.5 (9.7)
        break;
      case 'worldEvent': {
        const texts = {
          chest: ['Coffre découvert : il t\'attend dans les récompenses', '#f2d083'],
          merchant: ['Un marchand ambulant propose un objet (récompenses)', '#f2d083'],
          gems: ['Gemmes trouvées (récompenses)', '#6fd6ff'],
          portal: ['Un portail vers une salle au trésor ! (récompenses)', '#c9a6ff'],
          wanderer: ['Un boss errant a été vaincu ! (récompenses)', '#ff6b7d'],
          wave: ['Vague spéciale : or ×2 pendant 15 ennemis', '#f2d083'],
          elite: ['Une élite errante approche !', '#ff9a3d'],
        };
        const [text, color] = texts[event.eventType] ?? [eventLabel(event.eventType), null];
        if (state.ui.notify?.events !== false && !state.ui.focus) this.news(text, color);
        if (this.tab === 'inbox') this.invalidate();
        break;
      }
      case 'stage': {
        // v9.2.0 : annonce « Nouvelle amélioration » quand une ligne s'ouvre (étape record ou premier boss).
        const openUp = openUpgrades(state, BALANCE);
        if (this.knownUpgrades) {
          for (const k of openUp.filter((x) => !this.knownUpgrades.includes(x))) this.news(`Nouvelle amélioration : ${BALANCE.upgrades[k].label}`, '#f2d083');
          if (openUp.length !== this.knownUpgrades.length && this.tab === 'upgrades') this.invalidate();
        }
        this.knownUpgrades = openUp;
        // v9.3.8 (4) : coffre de fin d'étape (après une étape ordinaire gagnée) — un toucher l'ouvre, sinon il s'ouvre seul.
        if (!event.boss && state.stage === state.maxStage) this.dropChest(event.stage);
        // v9.3.8 : nouveau monde atteint (une seule fois par monde).
        if (event.zoneChanged && state.stage === state.maxStage) { const z = zoneForStage(state.stage); this.celebrate(`world-${zoneIndexForStage(state.stage)}`, 'Nouveau monde !', z.name); }
      }
        if (event.zoneChanged) {
          const d = difficultyForStage(event.stage);
          uiFx.worldTransitionFx(); // v9.2.6
          this.banner(`Monde ${zoneIndexForStage(event.stage) + 1} — ${zoneForStage(event.stage).name}${d > 1 ? ` · Faille ${d - 1} (échos : +${(d - 1) * 10} % d'or)` : ''}`, 'zone'); // v9.6.5 (10.4)
          // v9.2.1 : malus d'environnement du monde, dans le fil (priorité des messages d'action).
          const env = currentEnvironment(state);
          if (env) this.news(envChipText(env), '#f0a860', 1);
        }
        if (this.tab === 'campaign') this.invalidate();
        break;
      case 'unlock':
        if (this.tab === 'campaign') this.invalidate();
        break;
      case 'dungeonRoom':
        this.news(`Salle terminée : ${rewardText(event.reward, formatNumber)}`, '#9cf08a');
        this.showBoons(); // v9.9 (K7)
        break;
      case 'dungeonComplete': {
        this.banner(event.sweep ? 'Donjon balayé !' : 'Donjon terminé !', 'win');
        this.news(`Donjon terminé : ${event.item.name} (${rarityById(event.item.rarity).label})`, rarityById(event.item.rarity).color);
        if (event.first) this.celebrate('first-dungeon', 'Premier donjon gagné !', '');
        // v9.3.5 : écran de victoire — butin, couronnes de la difficulté, Rejouer.
        const crowns = '👑'.repeat((event.rank ?? 0) + 1);
        const keys = this.state.keys ?? 0;
        this.openModal(`<div class="victory-screen"><h2 id="modal-title">Victoire !</h2><div class="victory-crowns" aria-label="Difficulté">${crowns}</div>
          <div class="victory-loot">${itemFrame(event.item, { tag: 'div' })}<b class="r-${event.item.rarity} rarity-text">${escapeHtml(event.item.name)}</b></div>
          ${event.earned ? `<div class="victory-rewards">${rewardIcons(event.earned, 'rw-big')}</div>` : ''}
          <div class="detail-actions"><button class="btn" data-action="close-modal">Fermer</button>
            ${keys > 0 ? `<button class="btn" data-action="enter-dungeon" data-value="${event.id}" data-diff="${event.difficulty}">Rejouer (${keys} clé${keys > 1 ? 's' : ''})</button>
              <button class="btn btn-gold" data-action="sweep-dungeon" data-value="${event.id}" data-diff="${event.difficulty}">⚡ Balayer · 1 ${img('icon_key')}</button>` : ''}</div></div>`);
        this.invalidate();
        break;
      }
      case 'towerFloor':
        this.banner(`Étage ${event.floor} franchi !`, 'win');
        uiFx.stageFx('floor_up'); // v9.2.6
        this.news(event.record || event.weekly
          ? `${event.record ? 'Nouveau record' : 'Meilleur étage de la semaine'} dans la tour : étage ${event.floor} · ${rewardText(event.reward, formatNumber)}`
          : `Tour : étage ${event.floor} franchi.`, '#c9a6ff');
        this.invalidate();
        break;
      case 'challengeWave':
        this.banner(`Vague ${event.wave} franchie !`, 'win');
        this.news(event.record || event.weekly
          ? `${event.record ? 'Nouveau record absolu' : 'Meilleur score de la semaine'} au défi : vague ${event.wave} · ${rewardText(event.reward, formatNumber)}`
          : `Défi : vague ${event.wave} franchie.`, '#ffb36b');
        if (this.tab === 'dungeons') this.invalidate();
        break;
      case 'challengeFailed':
        this.banner('Défi terminé', 'lose');
        setTimeout(() => this.mentorScreen('Défi terminé', `${event.waves} vague${event.waves > 1 ? 's' : ''} · record ${state.challengeBest ?? 0}`), 1500); // v9.9 (K4)
        this.news(`${event.timeout ? 'Temps écoulé ! ' : ''}Défi de la semaine : ${event.waves} vague${event.waves > 1 ? 's' : ''} franchie${event.waves > 1 ? 's' : ''}. Record de la semaine : ${state.challengeWeek?.best ?? 0} · absolu : ${state.challengeBest ?? 0}.`, '#ffb36b');
        this.invalidate();
        break;
      case 'worldEnded': { // v9.1.3 (doc4 lot 6)
        if (!event.unit) break;
        const what = event.kind === 'score' ? 'Score' : event.kind === 'tier' ? `Palier ${event.n}` : `Niveau ${event.n}`;
        this.banner(event.won ? `${what} réussi !` : `${what} terminé`, event.won || event.kind === 'score' ? 'win' : 'lose');
        if (event.score) this.news(`Score : ${formatNumber(event.score.damage)} dégâts en ${BANNER_RULES.scoreSeconds} s${event.record ? ' · nouveau record personnel' : ''}`, '#9fd8ff');
        else if (event.reward && Object.keys(event.reward).length) this.news(`${what} : ${rewardText(event.reward, formatNumber)}`, '#9fd8ff');
        this.invalidate();
        break;
      }
      case 'sealEarned': this.toast(`Sceau du monde ${event.zone + 1} accordé : son boss de fin est ouvert`, '#ffd24a'); break; // v9.6.2
      case 'towerCollapsed':
        this.banner('La tour s\'effondre !', 'lose');
        setTimeout(() => this.showTowerEnd(state), 1200); // v9.6.2 (7.3)
        this.news(`Tour de l'Éternité : temps écoulé, la tour s'effondre à l'étage ${event.floors + 1}. Record : ${state.towerBest}.`, '#c9a6ff');
        this.invalidate();
        break;
      case 'towerFailed':
        this.banner('Ascension terminée', 'lose');
        setTimeout(() => this.showTowerEnd(state), 1200); // v9.6.2 (7.3)
        this.news(`Tour de l'Éternité : vaincu à l'étage ${event.defeatedAt}${event.bossHpPct !== null && event.bossHpPct !== undefined ? ` (boss à ${formatNumber(event.bossHpPct)} % de PV)` : ''}. Record : ${state.towerBest}.`, '#c9a6ff');
        this.invalidate();
        break;
      case 'dungeonFailed':
        this.banner('Tentative échouée', 'lose');
        setTimeout(() => this.mentorScreen('Défaite', event.bossHpPct != null ? `Boss final à ${formatNumber(event.bossHpPct)} % de PV` : `Salle ${event.room} atteinte`), 1200); // v9.9 (K4)
        this.news(`Défaite ${event.bossHpPct !== null && event.bossHpPct !== undefined ? `face au boss final (encore ${formatNumber(event.bossHpPct)} % de PV)` : `en salle ${event.room}`}. Conservé : ${rewardText(event.earned, formatNumber) || 'rien'} — détails dans l'onglet Donjons.`);
        this.invalidate();
        break;
      case 'heroDeath':
        this.banner(`Vaincu… retour à l'étape ${stageLabel(event.to)}`, 'lose');
        // v9.9 (K4) : défaite contre un boss d'étape → Conseil du mentor (au plus une fois toutes les 3 minutes).
        if (event.boss && performance.now() - (this.mentorAt ?? -1e9) > 180000) { this.mentorAt = performance.now(); setTimeout(() => this.mentorScreen('Défaite', `Record : étape ${stageLabel(state.maxStage)}`), 1500); }
        this.news(state?.autoAdvance === false ? 'Le héros reste sur l\'étape : améliore-le puis appuie sur « Avancer ».'
          : event.boss ? 'Normal : le héros s\'entraîne à l\'étape d\'avant et retentera le boss quand il sera 15 % plus fort. Pour aller plus vite : améliore tes dégâts.'
            : 'Le héros refait l\'étape précédente puis retente automatiquement.', null, 2);
        if (this.tab === 'campaign') this.invalidate();
        break;
      default:
        break;
    }
  }

  // Fil d'actualité : un seul message affiché par image (le dernier) — avant, chaque butin forçait un
  // recalcul de mise en page (des centaines par seconde à grande vitesse).
  // Un message d'action (toast) n'est pas écrasé par le butin de la même image.
  news(text, color = null, priority = 0) {
    if (this.pendingNews && this.pendingNews[2] > priority) return;
    this.pendingNews = [text, color, priority];
  }

  flushNews() {
    if (!this.pendingNews) return;
    const [text, color] = this.pendingNews;
    this.pendingNews = null;
    const el = this.$('news-text');
    el.textContent = text;
    el.style.color = color ?? '';
    el.parentElement.classList.remove('empty'); // v9.8 (E4)
    const now = performance.now();
    if (now - (this.lastHud.newsFlash ?? 0) < 300) return;
    this.lastHud.newsFlash = now;
    el.parentElement.classList.remove('flash');
    void el.offsetWidth; // relance l'animation CSS
    el.parentElement.classList.add('flash');
    uiFx.newsFx(el.parentElement); // v9.2.6
  }

  // Les actions de main.js signalent leurs résultats par un message court dans le fil.
  toast(text, color = null) {
    this.news(text, color, 1);
  }

  // Témoin de performances (v8.5, touche F9) : images par seconde, coût de la simulation, vitesse réelle.
  togglePerf() {
    this.perfOn = !this.perfOn;
    let el = this.$('perf-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'perf-overlay';
      this.$('stage-area').appendChild(el);
    }
    el.classList.toggle('hidden', !this.perfOn);
    this.lastHud.perfAt = 0;
  }

  updatePerf() {
    const p = this.perf ?? { effective: this.state?.ui?.speed ?? 1, steps: 0, worstTickMs: 0, stalls: 0, fps: 0 };
    const now = performance.now();
    // Vitesse réelle : affichée sur le bouton quand le PC ne suit pas la vitesse choisie.
    const speed = this.state?.ui?.speed ?? 1;
    const lag = speed > 1 && p.effective < speed * 0.8;
    const real = p.effective >= 10 ? formatNumber(Math.round(p.effective)) : p.effective.toFixed(1).replace('.', ',');
    this.setText('speed-toggle', this.state?.cheats?.skipBattle ? `⏭ Combats passés (×${real})`
      : `⏩ ×${speed}${lag ? ` (réel ×${real})` : ''}`);
    if (!this.perfOn || now - (this.lastHud.perfAt ?? 0) < 500) return;
    this.lastHud.perfAt = now;
    this.$('perf-overlay').textContent = [
      `${Math.round(p.fps)} img/s · pas/tick ${p.steps}`,
      `vitesse ×${speed} → réelle ×${p.effective.toFixed(1)}`,
      `pire tick ${p.worstTickMs.toFixed(1)} ms · gels ${p.stalls}${p.lastStall ? ` (dernier ${Math.round(p.lastStall.ms)} ms)` : ''}`,
      `sac ${this.state?.inventory.length ?? 0} · ennemis ${p.enemies ?? 0}`,
    ].join('\n');
  }

  banner(text, kind) {
    if ((this.speed ?? 1) >= 100) return; // ×100 : pas de bannières clignotantes
    const el = this.$('banner');
    el.className = kind;
    el.textContent = text;
    void el.offsetWidth;
    el.classList.remove('hidden');
  }

  // --- Mise à jour à chaque image ---
  update(state, world) {
    this.knownUpgrades ??= openUpgrades(state, BALANCE); // v9.2.0 : base de l'annonce « Nouvelle amélioration »
    this.state = state;
    this.updateRushBar(state, world);
    this.updateSkillBar(state, world);
    this.lootBag?.update(state);
    // v9.8 (C1) : objectifs de session en pastille au bord de la scène.
    const pill = this.$('goals-pill');
    if (pill) { const h = sessionGoalsPill(state); if (pill.dataset.h !== h) { pill.dataset.h = h; pill.innerHTML = h; pill.classList.toggle('hidden', !h); pill.classList.toggle('ready', sessionDone(state)); } }
    this.updateQuestBanner(state); // v9.8 (J2)
    this.$('rift-chip')?.classList.toggle('hidden', this.tabVisible.event === false || titanTriesLeft(state) <= 0); // v9.9 (K10)
    const stats = world.heroStats ?? computeHeroStats(state);
    this.setText('gold', formatNumber(state.gold));
    this.setText('strip-gold', formatNumber(state.gold));
    if (this.layout === 'strip') this.setText('strip-info', `Niv. ${state.level} · Étape ${state.stage}`); // v9.7.1 : ligne compacte
    this.setText('gems', formatNumber(state.gems));
    this.setText('hp', `${formatNumber(Math.max(0, world.hero.hp))}/${formatNumber(stats.maxHp)}`);
    this.setText('level-badge', `Niv. ${state.level}`);
    const xpRatio = state.xp / xpForLevel(state.level);
    if (Math.abs(xpRatio - (this.lastHud.xp ?? -1)) > 0.002) {
      this.$('xp-fill').style.width = `${Math.min(100, xpRatio * 100)}%`;
      this.$('top-xp').style.width = `${Math.min(100, xpRatio * 100)}%`;
      this.lastHud.xp = xpRatio;
    }
    this.setText('top-level', `Niv. ${state.level}`);
    this.setText('auto-toggle', state.autoAdvance ? '⏵ Avance auto' : '⏸ Reste sur l\'étape');
    this.speed = simSpeed(state);
    this.$('speed-toggle').classList.toggle('hidden', unlockedSpeeds(state).length < 2 && !state.cheats.skipBattle);
    this.root.classList.toggle('speed-max', simSpeed(state) >= 100);
    // v9.1.3 (doc3 lot 4) : mode débutant (aucun boss vaincu, comme Améliorations) : le mot reste visible à côté des icônes seules.
    this.root.classList.toggle('beginner', (state.records?.bossesDefeated ?? 0) === 0);
    // v9.1.0 : « Réduire les animations » (réglage de l'appareil, sinon préférence du système) coupe aussi les
    // animations de l'interface, le flash des boss et le décor des thèmes ; ×100 fait de même.
    this.calm = reduceMotion() || simSpeed(state) >= 100;
    document.documentElement.classList.toggle('fx-calm', this.calm || pref('contrast') === true);
    document.documentElement.classList.toggle('reduce-motion', this.calm);
    if (!this.booted) { this.booted = true; uiFx.bootDone(); uiFx.startAmbient(); } // v9.2.6 : écran de chargement
    uiFx.resourcesFx(state); // v9.2.6 : l'or brille quand il augmente
    uiFx.speedFx(this.$('speed-toggle')); // v9.2.7 : flamme retirée
    this.$('speed-toggle').classList.toggle('fast', simSpeed(state) > 1);
    this.$('auto-toggle').classList.toggle('off', !state.autoAdvance);
    this.$('auto-toggle').classList.toggle('hidden', Boolean(state.dungeon || state.tower || state.challenge));

    this.updateZoneCard(state);
    this.updateEnvChip(state); // v9.2.1
    this.updateProgress(state, world);
    this.$('advance-btn').classList.toggle('hidden', state.autoAdvance || Boolean(state.dungeon || state.tower || state.challenge));
    // v8.7 : sortie toujours visible quand on est dans la Tour, le défi ou un donjon.
    // v9.0.4 : boss réaffronté en boucle depuis le Codex → bouton pour reprendre la progression.
    const farm = !state.tower && !state.challenge && !state.dungeon && !state.autoAdvance && state.farmBoss && BOSSES[state.farmBoss];
    const mode = state.tower ? 'Quitter la Tour' : state.challenge ? 'Abandonner le défi' : state.dungeon ? 'Abandonner le donjon'
      : farm ? `Arrêter : ${BOSSES[state.farmBoss].name} en boucle` : '';
    this.$('leave-mode').classList.toggle('hidden', !mode);
    if (mode) this.setText('leave-mode', `⟲ ${mode}`);
    this.updateBadges(state);
    this.updateTabs(state);
    this.updateNextAction(state);
    this.flushNews();
    this.updatePerf();

    const now0 = performance.now();
    const userRecent = now0 - this.userAt < 400;
    const holding = document.body.classList.contains('hold-repeating');
    const pointer = this.pointerDown && !holding;
    // Liste ouverte (au plus 60 s, au cas où sa fermeture n'aurait pas été vue).
    const selectOpen = this.selectOpenAt > 0 && now0 - this.selectOpenAt < 60000;
    const busy = pointer || selectOpen;
    if (this.dirty && this.tab && !pointer && !selectOpen && (holding || userRecent || now0 - this.lastRender >= RENDER_THROTTLE_MS)) {
      this.renderPanel(state);
      this.dirty = false;
    } else if (this.tab && !this.dirty) {
      this.refreshCosts(state);
      const now = performance.now();
      // v9.3.2 : relecture d'un combat de l'Arène : rafraîchie toutes les 120 ms (barres de PV, coups).
      const every = this.tab === 'tower' && this.view.defiTab === 'arena' && this.view.arenaRun ? 120 : 1000;
      if (LIVE_PANELS.has(this.tab) && now - this.lastLive > every) {
        this.lastLive = now;
        if (!busy && this.liveKey(state) !== this.lastHud.live) this.renderPanel(state);
      }
    }
  }

  // Empreinte du contenu d'un panneau « vivant » (évite de le redessiner pour rien).
  liveKey(state) {
    switch (this.tab) {
      case 'contracts': return state.contracts.map((c) => `${c.id}:${c.progress}`).join() + JSON.stringify(state.missions);
      // v9.1.3 (doc4 lot 6) : temps restant et ennemis vaincus pendant un essai dans un monde.
      case 'world': return `${state.worldRun ? `${state.worldRun.kills}|${Math.ceil(state.worldRun.deadline - (state.playSeconds ?? 0))}` : ''}|${JSON.stringify(state.worlds)}|${state.companions.equipped.join()}`;
      case 'dungeons': return `${JSON.stringify(state.dungeon)}|${JSON.stringify(state.challenge)}|${state.challengeWeek?.best}`;
      // Expéditions : la barre de progression avance (au plus une fois toutes les 30 s) et « Récupérer » apparaît.
      case 'expeditions': return `${Math.floor(Date.now() / 30000)}|${readyExpeditions(state)}|${state.expeditions.slots.map((x) => x?.companionId ?? '').join()}`;
      case 'companions': return `${state.companions.equipped.join()}|${Object.keys(state.companions.owned).length}`;
      case 'inbox': return this.claims.map((c) => c.key).join() + (state.inbox.length);
      case 'arena': return this.view.arenaRun ? String(Math.floor(performance.now() / 120)) : JSON.stringify(state.arena) + Object.keys(state.companions.owned).length;
      case 'tower': return this.view.defiTab === 'arena' ? (this.view.arenaRun ? String(Math.floor(performance.now() / 120)) : JSON.stringify(state.arena) + Object.keys(state.companions.owned).length) // v9.3.5 : Arène dans Défis
        : `${JSON.stringify(state.tower)}|${state.towerBest}|${JSON.stringify(state.challenge)}|${state.challengeWeek?.best}`;
      // Achat « Max » : le nombre de niveaux abordables change avec l'or.
      case 'upgrades': return this.view.buyAmount === 'max' ? String(Math.floor(Math.log10(state.gold + 1) * 8)) : '';
      case 'skills': return `${state.level}|${Math.floor(state.xp)}|${Object.values(state.rushes.active).map(Math.ceil).join()}|${Object.values(state.rushes.cooldown).map((c) => Math.ceil(c / 10)).join()}`;
      case 'boss': return Object.values(state.powers).map((p) => `${p.victories}${p.charges}${p.pending}`).join();
      case 'looks': return `${state.heroes.active}|${Object.entries(state.heroes.owned).map(([k, o]) => `${k}${o.stars}`).join()}`; // v9.2.2
      case 'hero': return `${state.level}|${Math.floor(state.xp / 5)}|${state.heroes.active}|${Object.keys(state.heroes.owned).length}`;
      case 'encyclopedia': return String(encyclopediaProgress(state).found);
      case 'stats': return String(Math.floor(Date.now() / 5000));
      case 'ranking': return `${JSON.stringify(this.friends ?? null)}|${this.cloud?.guest}|${this.cloud?.loggedIn}|${this.ranking?.scope}|${this.ranking?.sort}|${this.ranking?.world}|${this.ranking?.players?.length ?? -1}|${this.ranking?.error ?? ''}|${this.ranking?.players?.[0]?.updatedAt ?? ''}`;
      default: return '';
    }
  }

  // v9.1.0 : protégé — un élément retiré de la page n'est plus une erreur à chaque image.
  setText(id, text) {
    if (this.lastHud[id] === text) return;
    this.lastHud[id] = text;
    const el = this.$(id);
    if (el) el.textContent = text;
  }

  // Annonce polie pour les lecteurs d'écran : seulement les événements importants (boss, objet légendaire).
  announce(text) {
    const el = this.$('live');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = text; }, 30);
  }

  // v9.2.1 : icône du malus d'environnement sur la scène (en bas à gauche, au-dessus des PV) : part contrée, infobulle complète,
  // appui = Carte (fiche du monde). Rien dans le monde 1, la Tour et le mode monde.
  updateEnvChip(state) {
    const now = performance.now();
    if (now - (this.lastHud.envAt ?? 0) < 400) return;
    this.lastHud.envAt = now;
    const env = currentEnvironment(state);
    let el = this.$('env-chip');
    if (!el) {
      el = document.createElement('button');
      el.id = 'env-chip';
      el.dataset.open = 'campaign';
      el.addEventListener('click', () => this.toggleTab('campaign'));
      this.$('stage-area').appendChild(el);
    }
    const key = env ? `${env.zone}|${Math.round(env.countered)}|${Math.round(env.pct * 10)}` : '';
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.classList.toggle('hidden', !env);
    if (!env) return;
    const done = env.countered >= 100;
    el.classList.toggle('countered', done);
    el.title = envLine(env);
    el.setAttribute('aria-label', envLine(env));
    el.innerHTML = `${img(env.icon, 'ico16')}<span>${envChipText(env)}</span>`;
  }

  updateZoneCard(state) {
    const key = `${state.stage}|${state.maxStage}|${JSON.stringify(state.dungeon)}|${state.tower?.floor}|${state.tower ? Math.ceil(towerTimeLeft(state) / 60) : ''}|${state.challenge?.wave}`;
    if (this.lastHud.zone === key) return;
    this.lastHud.zone = key;
    if (state.challenge) {
      const w = state.challenge.wave;
      const every = bossEvery(state);
      const first = Math.floor((w - 1) / every) * every + 1;
      this.$('zone-name').textContent = `Défi · ${ZONES[state.challenge.zone]?.name ?? ''} · vague ${w}`;
      this.$('stage-pips').innerHTML = this.pips(first, first + every - 1, w, w - 1, (i) => i % every === 0);
      return;
    }
    if (state.tower) {
      const f = state.tower.floor;
      const first = Math.floor((f - 1) / 10) * 10 + 1;
      this.$('zone-name').textContent = `Tour · étage ${f} · ⌛ ${formatDuration(towerTimeLeft(state))}`;
      this.$('stage-pips').innerHTML = this.pips(first, first + 9, f, f - 1, (i) => i % 10 === 0);
      return;
    }
    if (state.dungeon) {
      const d = DUNGEONS.find((x) => x.id === state.dungeon.id);
      this.$('zone-name').textContent = d.name;
      this.$('stage-pips').innerHTML = this.pips(1, dungeonRooms(state, d), state.dungeon.room, state.dungeon.room - 1, (i) => i === dungeonRooms(state, d));
      return;
    }
    const zone = zoneForStage(state.stage);
    this.$('zone-name').textContent = `${zone.name} ${stageLabel(state.stage)}`;
    // v9.3.1 : type des ennemis du monde (icône), pour composer l'équipe.
    const ze = ELEMENTS[zoneElement(ZONES.indexOf(zone))];
    if (ze) this.$('zone-name').textContent += ` ${ze.icon}`;
    this.$('zone-name').title = ze ? `Ennemis de type ${ze.name}` : '';
    const every = BALANCE.stages.bossEvery;
    const first = Math.floor((state.stage - 1) / every) * every + 1;
    this.$('stage-pips').innerHTML = this.pips(first, first + every - 1, state.stage, state.maxStage - 1, (s) => isBossStage(s));
  }

  pips(from, to, current, doneUpTo, isBoss) {
    const parts = [];
    for (let s = from; s <= to; s++) {
      const status = s === current ? 'current' : s <= doneUpTo ? 'done' : '';
      if (s > from) parts.push(`<i class="pip-link ${s <= doneUpTo + 1 ? 'done' : ''}"></i>`);
      parts.push(isBoss(s)
        ? `<img class="px pip-boss ${status}" src="${icon('icon_skull', 2)}" alt="Boss">`
        : `<i class="pip ${status}"></i>`);
    }
    return parts.join('');
  }

  updateProgress(state, world) {
    const enc = currentEncounter(state);
    const progress = this.$('progress');
    let ratio;
    let text;
    // v9.1.3 (doc1 « Combat », essai) : mode boss réduit — pendant un boss, les boutons autour de la scène s'estompent
    // (opacité seulement : aucun saut de mise en page) ; effet complet au méga boss. Auto, vitesse, Boosts et sortie restent.
    const focusBoss = enc.boss && pref('bossFocus') !== false ? world.enemies.find((e) => e.boss) : null;
    const focus = !enc.boss || pref('bossFocus') === false ? ''
      : (BOSSES[focusBoss?.type]?.tier === 'mega' || (!state.tower && !state.dungeon && !state.challenge && bossTierForStage(state.stage) === 'mega')) ? 'mega' : 'boss';
    if (this.root.dataset.bossFocus !== focus) { if (focus) this.root.dataset.bossFocus = focus; else delete this.root.dataset.bossFocus; }
    if (enc.boss) {
      const b = world.enemies.find((e) => e.boss);
      progress.classList.add('boss');
      ratio = b ? b.hp / b.maxHp : 1;
      text = b ? `${BOSSES[b.type].name} — ${formatNumber(Math.max(0, b.hp))} / ${formatNumber(b.maxHp)} PV` : 'Le boss arrive…';
      // v9.3.8 (4) : compte à rebours rouge jusqu'à la rage du boss (même seuil que le moteur : aucun changement d'équilibrage).
      const left = b && !b.worldBoss && !rageFree(state) ? Math.max(0, BALANCE.stages.enrageSeconds - (b.age ?? 0)) : null; // v9.7.1 : pas de rage aux mondes 1-2
      const timer = this.$('boss-timer');
      if (timer) {
        timer.classList.toggle('hidden', left === null);
        if (left !== null) { timer.style.width = `${(left / BALANCE.stages.enrageSeconds) * 100}%`; timer.classList.toggle('enraged', left <= 0); }
      }
      if (left !== null) text += left > 0 ? ` · rage dans ${Math.ceil(left)} s` : ' · EN RAGE';
    } else {
      progress.classList.remove('boss');
      this.$('boss-timer')?.classList.add('hidden');
      const kills = state.challenge ? state.challenge.kills : state.dungeon ? state.dungeon.kills : state.kills;
      ratio = kills / enc.killsNeeded;
      text = state.challenge
        ? `Vague ${state.challenge.wave} · ${state.challenge.kills}/${enc.killsNeeded} · ${Math.max(0, Math.ceil(CHALLENGE.waveSeconds - (state.challenge.time ?? 0)))} s`
        : state.dungeon
        ? `Salle ${state.dungeon.room}/${dungeonRooms(state, enc.dungeon)} · ${kills}/${enc.killsNeeded}`
        : waveMode(enc) ? `Vague ${waveIndex(state)}/${waveCount()}` // v9.3.8 : vagues groupées
        : `Ennemis vaincus ${kills}/${enc.killsNeeded}`;
    }
    // v9.9 (K11) : frise de l'étape — la vague en cours (entourée), les 2 suivantes et le boss, en petites icônes.
    const fr = this.$('wave-frieze');
    if (fr) {
      const camp = !state.challenge && !state.dungeon && !state.tower && waveMode(enc);
      const cur = camp ? waveIndex(state) : 0, tot = camp ? waveCount() : 0;
      const fkey = `${camp}|${cur}|${tot}|${state.stage}`;
      if (this.lastHud.frieze !== fkey) {
        this.lastHud.frieze = fkey;
        const zone = zoneForStage(state.stage);
        const sp = (i) => ENEMIES[zone.enemies[(state.stage + i) % zone.enemies.length]]?.sprite ?? 'icon_skull';
        const items = camp ? Array.from({ length: Math.min(3, tot - cur + 1) }, (_, i) => `<img class="px wf-wave${i === 0 ? ' cur' : ''}" src="${icon(sp(cur + i), 1)}" alt="">`) : [];
        if (camp && isBossStage(state.stage)) items.push(`<img class="px wf-boss" src="${icon('icon_skull', 1)}" alt="">`);
        fr.innerHTML = items.join('<i class="wf-link"></i>');
      }
    }
    if (ratio !== this.lastHud.ratio) {
      this.$('progress-fill').style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
      this.lastHud.ratio = ratio;
    }
    this.setText('progress-text', text);
  }

  // Boosts regroupés sur la scène (v9.1.0) : seulement ceux débloqués (un boost apparaît à son déblocage), avec leur
  // touche d'origine (Q W E R T), et le bonus du moment (démarrage, week-end) avec sa durée. Rien = groupe masqué.
  // Téléphone : regroupés derrière un bouton « Boosts ».
  updateRushBar(state, world = null) {
    this.bossWeak = Boolean(world?.enemies?.some((e) => e.boss && e.weakUntil > world.time)); // v9.6.3
    const now = performance.now();
    if (now - (this.lastHud.rushTime ?? 0) < 200) return;
    this.lastHud.rushTime = now;
    const bar = this.$('rush-bar');
    const full = pref('combat') === 'full';
    const boost = earlyBoost(state);
    const boostOn = boost.secondsLeft > 0 || boost.weekend || boost.cheat > 1;
    // v9.6.3 (5.2) : seulement les 3 compétences manuelles choisies (emplacements), en gros boutons.
    const slotIds = rushSlots(state);
    const open = slotIds.map((id, i) => [RUSHES.find((r) => r.id === id), i]).filter(([r]) => r);
    const key = `${open.map(([r]) => (rushUnlocked(state, r) ? r.id : `-${r.id}`)).join()}|${boostOn}|${phoneLayout()}|${JSON.stringify(state.rushes.manual ?? {})}|${state.rushes.auto}`;
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = open.map(([r, i]) => {
        const unlocked = rushUnlocked(state, r);
        return `<button class="rush-btn${unlocked ? '' : ' locked'}" data-action="rush" data-value="${r.id}" style="--rush:${r.color}"
          title="${r.name} — ${r.text}. ${unlocked ? `Touche ${boostKeys()[i]}.` : `Débloqué au niveau ${r.unlockLevel} du héros.`}" aria-label="${r.name}">${img(r.icon)}
          ${phoneLayout() || !hasKeyboard() ? '' : `<span class="rush-key">${boostKeys()[i]}</span>`}<span class="rush-time"></span><span class="rush-name">${RUSH_SHORT[r.id] ?? ''}</span></button>${unlocked && state.rushes.auto ? `<button class="rush-lock${state.rushes.manual?.[r.id] ? ' open' : ''}" data-action="rush-lock" data-value="${r.id}" title="${state.rushes.manual?.[r.id] ? 'À la main (touche pour qu\'il parte tout seul)' : 'Part tout seul (touche pour le lancer à la main)'}" aria-label="Auto">${state.rushes.manual?.[r.id] ? '🔓' : '🔒'}</button>` : ''}`; // v9.9 (K16) : cadenas doré
      }).join('') + (boostOn ? `<button class="boost-chip" data-action="show-boost" id="boost-chip">${img('icon_bolt', 'ico20')}<span id="boost"></span></button>` : '');
      delete this.lastHud.boost;
    }
    uiFx.speedFx(this.$('boost-chip')); // v9.2.7 : flamme retirée
    const group = this.$('boost-group');
    const any = open.length > 0 || boostOn;
    group.classList.toggle('hidden', !any);
    const phone = phoneLayout();
    this.$('boost-toggle').classList.toggle('hidden', !phone || !any);
    group.classList.toggle('collapsed', phone && !this.boostsOpen);
    this.$('boost-toggle').setAttribute('aria-expanded', String(phone && Boolean(this.boostsOpen)));
    for (const btn of bar.querySelectorAll('.rush-btn:not(.locked)')) {
      const rush = RUSHES.find((r) => r.id === btn.dataset.value);
      const active = state.rushes.active[rush.id] ?? 0;
      const cd = state.rushes.cooldown[rush.id] ?? 0;
      btn.classList.toggle('active', active > 0);
      btn.classList.toggle('ready', !active && !cd);
      btn.classList.toggle('weak-window', !active && !cd && this.bossWeak); // v9.6.3 : boss affaibli → bon moment
      btn.style.setProperty('--cd', active > 0 ? 0 : cd / rush.cooldown);
      btn.querySelector('.rush-time').textContent = active > 0 ? `${Math.ceil(active)}` : cd > 0 ? (cd >= 60 ? `${Math.ceil(cd / 60)}m` : `${Math.ceil(cd)}`) : '';
    }
    if (boostOn) this.setText('boost', boostText(boost));
  }

  // Compétences sur la scène : elles se lancent TOUTES SEULES ; le cadran montre leur recharge, un clic ouvre leur
  // écran. v9.1.0 : seulement celles apprises, et la barre n'apparaît qu'après le premier mini-boss.
  updateSkillBar(state, world) {
    const now = performance.now();
    if (now - (this.lastHud.skillTime ?? 0) < 100) return;
    this.lastHud.skillTime = now;
    const bar = this.$('skill-bar');
    if (!bar) return;
    // v9.7.1 (lot 2) : trois gros boutons sous la scène (touches 1, 2, 3), Parer (D) pendant l'annonce d'un coup lourd,
    // ultimes prêts des compagnons sur leur portrait, compteur d'enchaînement. Rien n'est obligatoire.
    const list = activeSkills(state).slice(0, 3);
    const team = (state.companions?.equipped ?? []).map(companionById).filter(Boolean);
    const ready = new Set(Object.keys(world.ultReady ?? {}).map((k) => k.split('#')[0]));
    const show = list.length > 0 || ready.size > 0;
    bar.classList.toggle('hidden', !show);
    if (!show) return;
    const key = `${list.map((sk) => sk.id).join()}|${[...ready].join()}|${world.guard ? 1 : 0}`;
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = list.map((sk, i) => `<button class="skill-btn big" data-action="cast-skill" data-skill="${sk.id}" title="${escapeHtml(sk.name)} (${i + 1})" aria-label="${escapeHtml(sk.name)}">${img(sk.icon)}<i class="cd"></i>${this.phone ? '' : `<kbd>${i + 1}</kbd>`}</button>`).join('')
        // v9.8 (E5) : un seul bouton Ultime (portraits empilés, compteur) ; un appui lance la première prête.
        + (() => { const r = team.filter((c) => ready.has(c.id)); if (!r.length) return '';
          return `<button class="ult-btn" data-action="cast-ult" data-value="${r[0].id}" title="Ultime : ${escapeHtml(r.map((c) => c.name).join(', '))}" aria-label="Ultime de ${escapeHtml(r[0].name)}"><span class="ult-stack">${r.slice(0, 3).map((c) => img(c.sprite)).join('')}</span><b>Ultime${r.length > 1 ? ` ×${r.length}` : ''}</b></button>`; })()
        + (world.guard ? `<button class="guard-btn" data-action="guard" aria-label="Parer">🛡 Parer${this.phone ? '' : ' <kbd>D</kbd>'}</button>` : '');
    }
    const bonus = (world.heroStats ?? computeHeroStats(state)).bonus;
    for (const btn of bar.querySelectorAll('.skill-btn')) {
      const sk = SKILLS.find((x) => x.id === btn.dataset.skill);
      const left = Math.max(0, world.skillTimers?.[sk.id] ?? 0);
      btn.style.setProperty('--cd', Math.min(1, left / interactiveCooldown(sk, bonus)));
      btn.classList.toggle('ready', left <= 0.05);
    }
    const combo = world.combo?.n ?? 0;
    const chip = this.$('combo-chip');
    if (chip) { chip.classList.toggle('hidden', combo < 2); if (combo >= 2) chip.textContent = `Combo ×${combo} · +${combo * COMBO_STEP_PCT} %`; }
  }

  // v9.3.4 : au premier sac plein, proposer le recyclage automatique des Communs moins bons (une seule fois).
  offerAutoRecycle(state) {
    if (state.inventory.length < BALANCE.loot.inventorySize || (state.ui.hints ?? []).includes('auto-recycle')) return;
    if (recycleRules(state).mode !== 'off' || !this.$('modal').classList.contains('hidden')) return;
    state.ui.hints = [...(state.ui.hints ?? []), 'auto-recycle'];
    this.openModal(`<h2>${img('icon_bag')} Sac plein</h2><p>Recycler automatiquement les objets Communs moins bons que les vôtres ?</p>
      <div class="options-row"><button class="btn btn-gold" data-action="auto-recycle-yes">Oui</button><button class="btn" data-action="close-modal">Plus tard</button></div>`);
  }

  // Marques (v9.1.0, une seule règle) : pastille rouge = à récupérer (core/claimables.js) ; point or = l'action
  // conseillée du moment (une seule) ; compteur +N sur Héros = objets neufs dans le sac ; « nouveau » = onglet ouvert.
  // v9.3.8 (4) : bandeau « Prochain déblocage » sous la scène, avec une barre qui se remplit.
  updateNextUnlock(state) {
    const el = this.$('next-unlock');
    if (!el) return;
    // v9.8 (0.4) : suit la mini-quête en cours (consigne courte + barre), sinon le prochain palier d'étape.
    const q = currentQuest(state);
    let m = null;
    if (q) {
      const st = questSteps(state, q);
      const i = st.findIndex((x) => !x.done);
      m = { quest: q.id, text: `${q.label} (${Math.max(0, i) + 1}/3) : ${st[Math.max(0, i)].text}`, ratio: st.filter((x) => x.done).length / st.length, tab: QUEST_TAB_UI[q.id]?.[i] ?? null };
    } else {
      const n = nextMilestone(state);
      if (n) m = { text: `Prochain : ${n.label} à l'étape ${stageLabel(n.stage)}`, ratio: n.ratio };
    }
    el.classList.toggle('hidden', !m);
    if (!m) return;
    // v9.8 (G6) : mini-quête en parchemin, avec l'icône du système qu'elle ouvre.
    el.classList.toggle('parchment', Boolean(m.quest));
    const ico = m.quest ? icon(SUB_ICONS[QUEST_SYS[m.quest]] ?? 'icon_star') : '';
    if (el.dataset.ico !== ico) { el.dataset.ico = ico; el.style.setProperty('--qico', ico ? `url("${ico}")` : 'none'); }
    if (m.tab) { el.dataset.action = 'open-tab'; el.dataset.value = m.tab; el.style.cursor = 'pointer'; } else { delete el.dataset.action; el.style.cursor = ''; }
    const txt = m.text;
    if (this.lastHud.nextUnlock !== txt) { this.lastHud.nextUnlock = txt; this.$('next-unlock-text').textContent = txt; }
    this.$('next-unlock-fill').style.width = `${Math.round(m.ratio * 100)}%`;
  }

  dropChest(stage) {
    const host = this.$('stage-area');
    if (!host || typeof document === 'undefined') return;
    this.actions.stageChest?.(stage);
    host.querySelector('.stage-chest')?.remove();
    const el = document.createElement('button');
    el.className = 'stage-chest';
    el.type = 'button';
    el.setAttribute('aria-label', 'Ouvrir le coffre');
    el.innerHTML = img('icon_chest');
    const open = () => { if (el.dataset.open) return; el.dataset.open = '1'; el.classList.add('open'); this.actions.openStageChest?.(); setTimeout(() => el.remove(), 500); };
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); open(); });
    host.appendChild(el);
    setTimeout(open, 3000); // mode idle : ouverture automatique
  }

  // v9.3.8 (4) : grand moment fêté en plein écran, 2 s, une seule fois (mémorisé dans state.ui.hints).
  celebrate(id, title, sub = '') {
    const st = this.state;
    if (!st?.ui || (st.ui.hints ?? []).includes(`cele-${id}`) || typeof document === 'undefined') return;
    st.ui.hints = [...(st.ui.hints ?? []), `cele-${id}`].slice(-150);
    if (navigator.webdriver) return; // vérifications automatiques : pas de rideau par-dessus le jeu
    const el = document.createElement('div');
    el.className = 'celebrate';
    el.innerHTML = `<div class="cele-box"><b>${escapeHtml(title)}</b>${sub ? `<span>${escapeHtml(sub)}</span>` : ''}</div>`;
    el.addEventListener('click', () => el.remove());
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 1700);
    setTimeout(() => el.remove(), 2100);
  }

  updateBadges(state) {
    const now = performance.now();
    if (now - (this.lastHud.badgeTime ?? 0) < 500) return;
    this.lastHud.badgeTime = now;
    this.claims = claimables(state);
    this.updateNextUnlock(state); // v9.3.8
    // v9.3.9 (3.7) : le tutoriel ne commence qu'à la fin du prologue (et du titre qui le suit).
    const cutscene = document.getElementById('prologue') || document.querySelector('#stage-area .cinematic');
    if (cutscene) document.getElementById('tuto-layer')?.remove();
    else try { updateTutorial(state, this.root, state.inventory.length >= BALANCE.loot.inventorySize, Boolean(this.tab)); } catch { /* le tutoriel ne bloque jamais le jeu */ }
    // v9.1.3 : fenêtre « À récupérer » ouverte → mise à jour quand la liste change.
    const claimsKey = this.claims.map((c) => c.key).join() + state.inbox.length;
    if (this.claimsOpen && claimsKey !== this.claimsKey && !this.$('modal').classList.contains('hidden')) this.openClaims(state);
    this.claimsKey = claimsKey;
    const byTab = claimablesByTab(this.claims);
    this.tabBadges = byTab;
    this.offerAutoRecycle(state); // v9.3.4
    if (this.tabVisible.forge !== false && canForgeSomething(state)) this.tabBadges = { ...byTab, forge: 1 }; // v9.3.4 : de quoi forger
    if (this.tabVisible.tree !== false && suggestedTalent(state)) this.tabBadges = { ...this.tabBadges, tree: 1 }; // v9.3.9 : un talent à apprendre
    // v9.8 (E7) : des clés de donjon en réserve → pastille sur Aventure (le joueur ne savait pas qu'il pouvait y aller).
    if (this.tabVisible.dungeons !== false && (state.keys ?? 0) > 0 && !state.dungeon) { this.tabBadges = { ...this.tabBadges, dungeons: 1 }; byTab.dungeons = byTab.dungeons ?? 1; }
    // v9.8 (H1/J1) : Carnet du jour — Roue ou Chasse rapide prêtes.
    { const n = (wheelReady(state) ? 1 : 0) + (quickHuntReady(state) ? 1 : 0); if (n && this.tabVisible.daybook !== false) { byTab.daybook = n; this.tabBadges = { ...this.tabBadges, daybook: n }; } }
    const current = computeHeroStats(state);
    this.next = nextAction(state, { claims: this.claims, visible: this.tabVisible, fusionReady: this.tabBadges.forge === 1 }); // v9.3.5
    for (const menu of MENUS) {
      const red = menu.tabs.some((t) => byTab[t] && this.tabVisible[t] !== false);
      const el = this.$(menu.id === 'shop' ? 'badge-shop-tab' : `badge-${menu.id}`);
      if (el) {
        // v9.8 (J1/J2) : le chiffre dit combien de choses attendent (plus un simple point).
        const n = menu.tabs.reduce((t, x) => t + (this.tabVisible[x] !== false ? byTab[x] ?? 0 : 0), 0);
        // v9.9 (K6) : une seule pastille rouge (là où mène le Sceau d'action) ; ailleurs, une petite étoile dorée.
        const sealTab = this.sealAction?.tab ?? (this.sealAction?.id === 'claim' ? null : undefined);
        const main = sealTab ? menu.tabs.includes(sealTab) : this.sealAction?.id === 'claim' && menu.id === 'goals';
        el.classList.toggle('hidden', !red);
        el.classList.toggle('count', n > 0 && main);
        el.classList.toggle('star', red && !main);
        el.textContent = n > 0 && main ? String(Math.min(n, 99)) : '';
        el.setAttribute('aria-label', red ? `${n} à récupérer` : '');
      }
    }
    // v9.2.9 : bouton Boutique de la barre du haut : pastille si une offre gratuite ou quotidienne attend.
    this.$('badge-shop')?.classList.toggle('hidden', !shopFreeAvailable(state));
    // Objets neufs : trouvés depuis la dernière ouverture d'Équipement (et encore dans le sac).
    if (this.seenItemsUntil === null) this.seenItemsUntil = state.nextItemId;
    const fresh = newItemsInBag(state, this.seenItemsUntil);
    const count = this.$('count-hero');
    if (count) {
      count.classList.toggle('hidden', !fresh || this.tab === 'inventory');
      count.textContent = `${fresh > 99 ? '99+' : fresh} ${fresh > 1 ? 'objets' : 'objet'}`; // v9.3.5 : chiffre avec sa légende
      count.title = `${fresh} objet${fresh > 1 ? 's' : ''} neuf${fresh > 1 ? 's' : ''} dans le sac`;
      count.setAttribute('aria-label', `${fresh} objet${fresh > 1 ? 's' : ''} neuf${fresh > 1 ? 's' : ''}`);
    }
    if (this.tab) this.renderSubtabs();
  }

  // Bouton « Prochaine action » sous le combat : un seul conseil, cliquable (bon onglet, bonne vue, ou action).
  // v9.9 (K2) : Sceau d'action — un seul gros bouton au bas de la scène, même liste de priorités que la carte
  // « Prochaine étape » : mini-quête, récompense, objet meilleur, amélioration, contenu du jour, mur (Renaître).
  // Couleur selon l'action ; disparaît quand rien d'utile n'est à faire ; doigt animé les 30 premières minutes.
  updateNextAction() {
    const btn = this.$('next-action');
    if (!btn) return;
    const st = this.state;
    let n = this.next;
    const q = st && currentQuest(st);
    if (q && n?.id !== 'claim') {
      const steps = questSteps(st, q);
      const i = steps.findIndex((x) => !x.done);
      // Une étape sans écran à ouvrir (« Bats 10 monstres ») laisse la place à l'action suivante : la carte la montre déjà.
      if (i >= 0 && QUEST_TAB_UI[q.id]?.[i]) n = { id: 'quest', text: steps[i].text, tab: QUEST_TAB_UI[q.id][i] };
    }
    // v9.9 (K2/K4) : plus de progrès depuis 10 minutes → la première carte du Conseil du mentor.
    const stalled = st && ((st.playSeconds ?? 0) - (st.recordAt ?? st.playSeconds ?? 0) > 600 || (st.playSeconds ?? 0) - (st.ui?.wallAt ?? -1e9) < 1800);
    if (stalled && n && ['goal', 'advance', 'claim', 'rebirth'].includes(n.id)) {
      const t = mentorTips(st, { wall: true })[0];
      if (t) n = { id: 'mentor', text: t.text, tab: t.tab, view: t.view, point: t.point };
    }
    this.sealAction = n;
    const useless = !n || ['advance', 'mode-dungeon', 'mode-tower', 'mode-world', 'mode-challenge'].includes(n.id) || (n.id === 'quest' && n.action === 'none');
    btn.classList.toggle('hidden', useless);
    if (useless) return;
    const key = `${n.id}|${n.text}`;
    if (this.lastHud.next !== key) {
      this.lastHud.next = key;
      this.setText('next-action-text', n.text);
      btn.dataset.kind = n.id;
      const tone = n.id === 'claim' || n.id === 'quest' ? 'gold' : ['upgrade', 'equip', 'skills', 'place', 'team', 'level', 'lootbag'].includes(n.id) ? 'green'
        : ['goal', 'retry', 'seal'].includes(n.id) ? 'red' : ['rebirth', 'mentor'].includes(n.id) ? 'violet' : 'blue';
      btn.className = btn.className.replace(/\bna-(gold|green|red|violet|blue)\b/g, '').trim();
      btn.classList.add(`na-${tone}`);
      // v9.6.2 (7.9) : « Plus tard » sur un contenu proposé (2 refus : il passe jusqu'au lendemain).
      let later = this.$('next-later');
      if (!later) { later = document.createElement('button'); later.id = 'next-later'; later.className = 'btn small next-later'; later.type = 'button'; later.textContent = 'Plus tard'; btn.after(later);
        later.addEventListener('click', () => { const g = guideDay(this.state); const id = this.next?.id; if (id) g.skips[id] = (g.skips[id] ?? 0) + 1; delete this.lastHud.badgeTime; this.invalidate(); }); }
      later.classList.toggle('hidden', !n.content);
      // Doigt : 30 premières minutes de jeu, puis seulement sur une action jamais proposée.
      const seen = (st.ui.sealSeen ??= []);
      const fresh = !seen.includes(n.id);
      if (fresh) seen.push(n.id);
      btn.querySelector('.na-finger')?.classList.toggle('hidden', !((st.playSeconds ?? 0) < 1800 || fresh) || this.calm);
    }
  }

  runNextAction() {
    const n = this.sealAction ?? this.next;
    if (!n) return;
    if (n.id === 'quest') { if (n.tab) this.openTab(n.tab); return; } // v9.9 (K2) : ouvre le bon écran
    if (n.id === 'mentor') { this.followTip(n); return; }
    if (n.content) { const g = guideDay(this.state); if (!g.done.includes(n.id)) g.done.push(n.id); } // v9.6.2 : conseil suivi
    this.userAt = performance.now();
    if (n.action === 'claim-everything') {
      // v9.2.7 : les monnaies récupérées volent du bouton vers leurs compteurs.
      const before = uiFx.snap(this.state);
      this.actions.claimEverything();
      uiFx.claimFly(before.cur, uiFx.snap(this.state).cur, this.$('next-action'), true);
    }
    else if (n.action === 'retry-boss') this.actions.retryBoss();
    else if (n.action === 'advance') this.actions.advance();
    // v9.3.5 : un clic fait l'action (équiper tout, placer, améliorer, monter, recycler).
    else if (n.action === 'equip-best') this.actions.equipBest();
    else if (n.action === 'lootbag') this.lootBag?.toggle(true); // v9.7.1
    else if (n.action === 'place-companion') this.actions.toggleCompanion(n.value);
    else if (n.action === 'buy') this.actions.buy(n.value, '1');
    else if (n.action === 'upgrade-companion') this.actions.upgradeCompanion(n.value);
    else if (n.action === 'apply-team') this.actions.applyTeam(); // v9.5.0 (3.6)
    else if (n.action === 'recycle-useless') this.actions.recycleUseless();
    else if (n.action === 'distribute-skills') this.actions.distributeSkills(); // v9.3.8
    else if (n.tab && n.tab !== this.tab) this.openTab(n.tab, n.view ?? null); // jamais ouvrir puis refermer
    delete this.lastHud.badgeTime; // conseil recalculé tout de suite
  }

  // Fiche d'une monnaie (v9.1.0) : à quoi elle sert, où en gagner, et un bouton vers l'écran où on la dépense
  // (seulement si cet écran est déjà ouvert pour le joueur).
  showCurrency(id) {
    const c = CURRENCIES[id];
    if (!c || !this.state) return;
    const reachable = this.tabVisible[c.tab] !== false;
    this.openModal(`<h2 id="modal-title">${img(c.icon)} ${c.name} : ${formatNumber(currencyAmount(this.state, id))}</h2>
      <p><b>Sert à :</b> ${c.use}</p><p><b>S'obtient :</b> ${c.gain}</p>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Fermer</button>
        ${reachable ? `<button class="btn btn-primary" data-action="currency-go" data-value="${id}">Aller à ${escapeHtml(navPath(c.tab))}</button>` : ''}</div>`);
  }

  // v9.6.2 (7.3) : écran de fin d'ascension — étage atteint, record, récompenses, ascensions restantes aujourd'hui.
  showTowerEnd(state) {
    const t = state.towerLast;
    if (!t || !this.$('modal').classList.contains('hidden')) return;
    const left = climbsLeft(state);
    this.openModal(`<div class="victory-screen"><h2 id="modal-title">Tour de l'Éternité</h2>
      <p class="victory-big">Étage <b class="gold-text">${t.floors}</b>${t.record ? ' · <span class="good">nouveau record !</span>' : ` · record ${state.towerBest ?? 0}`}</p>
      ${Object.keys(t.earned ?? {}).length ? `<div class="victory-rewards">${rewardIcons(t.earned, 'rw-big')}</div>` : '<p class="muted">Pas de nouvelle récompense : dépasse ton record pour en gagner.</p>'}
      <p>${left ? `Encore ${left} ascension${left > 1 ? 's' : ''} aujourd'hui.` : 'Plus d\'ascension aujourd\'hui : reviens demain.'}</p>
      ${t.record ? '' : this.mentorCardsHtml()}
      <div class="detail-actions"><button class="btn" data-action="close-modal">Fermer</button>${left ? '<button class="btn btn-gold" data-action="close-modal" data-open="tower">Retenter</button>' : ''}</div></div>`);
  }

  // v9.6.0 (6.3) : première rencontre d'un comportement — carte courte posée sur la scène (ne bloque rien, 7 s).
  showBehaviorCard(id, parried = false) {
    const b = BEHAVIORS[id];
    const host = this.$('stage-area');
    if (!b || !host) return;
    host.querySelector('.beh-card')?.remove();
    const el = document.createElement('div');
    el.className = 'beh-card';
    el.style.setProperty('--bc', b.color);
    el.innerHTML = `${img(b.icon)}<div><b>Nouveau : ${escapeHtml(b.name)}</b><div>${escapeHtml(b.what)}</div>
      <div class="${parried ? 'good' : 'muted'}">${parried ? '✓ Ton équipe a la parade.' : `Parade : ${escapeHtml(b.counter)}.`}</div></div>`;
    el.addEventListener('click', () => el.remove());
    host.appendChild(el);
    setTimeout(() => el.remove(), 7000);
  }

  // v9.5.1 (4.4) : écran Préparation — à l'arrivée dans un monde et avant son boss de fin. Il ne bloque rien : le
  // combat continue derrière avec l'équipe en place. Élément du monde, mécanique du boss, équipe conseillée chiffrée.
  showPreparation({ zoneIndex, boss = null, advice = null, kind = 'world' }) {
    if (!this.$('modal').classList.contains('hidden')) return;
    const zone = ZONES[zoneIndex];
    const el = zoneElement(zoneIndex);
    const strong = strongAgainst(el);
    const bossDef = boss ? BOSSES[boss] : null;
    const trait = boss && BOSS_TRAITS[boss] ? TRAITS[BOSS_TRAITS[boss]] : null;
    const team = advice && !advice.same && advice.gain >= 0.03
      ? `<p><b>Équipe conseillée</b> : ${advice.team.map((id) => escapeHtml(companionById(id)?.name ?? id)).join(', ')} <span class="good">+${Math.round(advice.gain * 100)} % de dégâts</span></p>` : '<p class="muted">Ton équipe actuelle est la meilleure disponible ici.</p>';
    this.openModal(`<div class="prep-screen"><h2 id="modal-title">${kind === 'boss' ? 'Avant le boss' : 'Préparation'} : ${escapeHtml(zone?.name ?? '')}</h2>
      <p>Élément du monde : ${elementBadge(el)}. Tes alliés ${strong.map((x) => elementBadge(x)).join(' ')} y font <b class="good">+${Math.round((ADV - 1) * 100)} %</b> de dégâts.</p>
      ${elementWheel(el)}
      ${zoneBehaviors(zone).length ? `<p><b>Monstres du monde</b> :</p><ul class="prep-beh">${zoneBehaviors(zone).map((id) => `<li>${img(BEHAVIORS[id].icon)} <b>${escapeHtml(BEHAVIORS[id].name)}</b> — ${escapeHtml(BEHAVIORS[id].what)} <span class="muted">Parade : ${escapeHtml(BEHAVIORS[id].counter)}.</span></li>`).join('')}</ul>` : ''}
      ${bossDef ? `<p>Boss : <b>${escapeHtml(bossDef.name)}</b>${trait ? ` — ${escapeHtml(trait.name)} (${escapeHtml(trait.short)}). <span class="muted">Parade : ${escapeHtml(trait.counter)}.</span>` : ''}</p>` : ''}
      ${team}
      <div class="detail-actions"><button class="btn" data-action="close-modal">Continuer</button>
        ${advice && !advice.same && advice.gain >= 0.03 ? '<button class="btn btn-primary" data-action="prep-apply">Placer l\'équipe conseillée</button>' : ''}</div></div>`);
  }

  // v9.3.9 (2.6) : fiche d'une ressource de compétence — ce que c'est, combien on en a, à quoi elle sert, et où en
  // trouver (boutons vers les écrans déjà ouverts au joueur).
  showResource(key) {
    const r = SKILL_RESOURCES[key];
    if (!r || !this.state) return;
    const where = (RESOURCE_WHERE[key] ?? []).map((w) => {
      const open = this.tabVisible[w.tab] !== false;
      return `<li>${escapeHtml(w.text)} ${open ? `<button class="btn small btn-primary" data-action="res-go" data-value="${w.tab}">Y aller</button>` : `<small class="muted">(pas encore ouvert)</small>`}</li>`;
    }).join('');
    this.openModal(`<h2 id="modal-title">${img(r.icon, 'ico20')} ${escapeHtml(r.name)} : ${formatNumber(this.state.materials?.[key] ?? 0)}</h2>
      <p><b>Sert à :</b> ${escapeHtml(r.use)}</p><p><b>Où en trouver :</b></p><ul class="res-where">${where}</ul>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Fermer</button></div>`);
  }

  // v9.3.5 : après une Renaissance — « Tu es plus fort : ×N pour toujours », puis le talent conseillé.
  showRebirthDone(ratio, gained, talent) {
    const mult = `×${formatMult(Math.max(1, ratio))}`;
    this.openModal(`<div class="victory-screen"><h2 id="modal-title">Tu es plus fort !</h2>
      <p class="victory-big"><b class="gold-text">${mult}</b> pour toujours</p>
      <p>+${formatNumber(gained)} fragments anciens.</p>
      ${talent ? `<p>Talent conseillé : <b>${escapeHtml(talent.talent.name ?? talent.talent.id)}</b> (${formatNumber(talent.cost)} fragments).</p>` : ''}
      <div class="detail-actions"><button class="btn" data-action="close-modal">Continuer</button>
        ${talent ? '<button class="btn btn-gold" data-action="rebirth-talent">Voir les talents</button>' : ''}</div></div>`);
  }

  // v9.3.9 : après « Tout récupérer », tout ce qui a été gagné, en icônes (fermé d'un toucher ou tout seul).
  showClaimRecap(total, { count = 0, items = 0, left = 0 } = {}) {
    if (!this.$('modal').classList.contains('hidden')) return;
    const icons = rewardIcons(total, 'rw-big');
    if (!icons && !items) return;
    this.openModal(`<div class="claim-recap"><h2 id="modal-title">${img('icon_chest', 'ico20')} ${count} récompense${count > 1 ? 's' : ''} récupérée${count > 1 ? 's' : ''}</h2>
      ${icons}${items ? `<p>+${items} objet${items > 1 ? 's' : ''} dans le sac</p>` : ''}
      ${left ? `<p class="bad">${left} en attente : sac et coffre pleins</p>` : ''}
      <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">Super !</button></div></div>`);
  }

  // Récapitulatif du Retour de session.
  showSessionReturn(r) {
    const ratio = r.before > 0 ? r.after / r.before : 1;
    const rows = [
      r.claimed ? `<li>${r.claimed} récompense${r.claimed > 1 ? 's' : ''} récupérée${r.claimed > 1 ? 's' : ''}</li>` : '',
      r.claimsLeft ? `<li class="bad">${r.claimsLeft} récompense${r.claimsLeft > 1 ? 's' : ''} avec un objet en attente (sac et coffre pleins) : Objectifs › À récupérer.</li>` : '',
      r.equipped ? `<li>${r.equipped} objet${r.equipped > 1 ? 's' : ''} équipé${r.equipped > 1 ? 's' : ''}</li>` : '',
    ].join('') || '<li class="muted">Rien à récupérer ni à équiper.</li>';
    this.openModal(`<h2 id="modal-title">${img('icon_bolt', 'ico20')} Retour de session</h2><ul class="session-list">${rows}</ul>
      <p>Dégâts/s : <b>${formatNumber(r.before)}</b> → <b class="good">${formatNumber(r.after)}</b>${ratio > 1.0001 ? ` (×${ratio >= 100 ? formatNumber(Math.round(ratio)) : ratio.toFixed(2).replace('.', ',')})` : ''}</p>
      <p class="muted">Rien n'est acheté : ton or, tes gemmes et tes points de compétence restent à ton choix.</p>
      <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">Continuer</button></div>`);
  }

  // Explication du bonus du moment (vrais multiplicateurs, lus dans le calcul du jeu).
  showBoost(state) {
    const b = earlyBoost(state);
    const m = (x) => `×${formatMult(x)}`;
    const parts = [
      b.secondsLeft > 0 ? `<li>Démarrage rapide : il diminue avec le temps de jeu et s'arrête dans ${boostDuration(b.secondsLeft)}.</li>` : '',
      b.weekend ? `<li>Week-end : ×${BALANCE.weekendBoost.multiplier} en plus, encore ${boostDuration(b.weekendSecondsLeft)}.</li>` : '',
      b.cheat > 1 ? `<li>Code (version dev) : ${m(b.cheat)}.</li>` : '',
    ].join('');
    this.openModal(`<h2 id="modal-title">${img('icon_bolt', 'ico20')} Bonus du moment</h2>
      <p>Or <b class="gold-text">${m(b.gold)}</b> · Expérience <b>${m(b.xp)}</b> · Événements <b>${m(b.events)}</b></p>
      <ul>${parts}</ul>
      <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">OK</button></div>`);
  }

  // Ouverture progressive (v9.1.0) : Héros et Aventure au début ; chaque onglet s'ouvre à son vrai seuil, d'après la
  // meilleure étape jamais atteinte (records.bestStage) : rien ne disparaît après une Renaissance. Un onglet qui
  // s'ouvre reçoit la marque « nouveau » et une ligne dans le fil (plus de bulle par-dessus le combat).
  updateTabs(state) {
    const best = Math.max(state.maxStage, state.records.bestStage ?? 1);
    const boss = (state.records.bossesDefeated ?? 0) > 0;
    if (!state.ui.goalsOpen && this.claims.length) state.ui.goalsOpen = true; // posé à la première récompense, jamais retiré
    const later = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1) >= 40; // v9.3.4
    const q = (id) => isUnlocked(state, id); // v9.7.1 (lot 3) : mini-quêtes (ancienne partie : toujours vrai)
    const visible = {
      upgrades: q('upgrades'), skills: q('skills'),
      tree: q('talents') && best >= 10 || state.fragments > 0 || state.records.rebirths > 0 || (state.prestige?.count ?? 0) > 0 || (state.transcend?.count ?? 0) > 0,
      dungeons: q('dungeons') && best >= DUNGEONS[0].unlockStage || Object.keys(state.dungeonsCleared).length > 0 || Boolean(state.dungeon),
      // v9.1.3 : l'onglet Défis s'ouvre avec la Tour ou avec le Défi de la semaine (étape plus basse).
      tower: q('challenges') && best >= TOWER_UNLOCK || (state.towerBest ?? 0) > 0 || Boolean(state.tower) || challengeUnlocked(state) || Boolean(state.challenge) || arenaUnlocked(state), // v9.3.5 : Arène comprise
      boss: boss || Object.keys(state.powers).length > 0,
      companions: Object.keys(state.companions.owned).length > 0 || (q('summon') && boss),
      summon: q('summon') && (boss || Object.keys(state.companions.owned).length > 0), // v9.7.1 : aucun tirage avant la fin du monde 1
      shop: boss || Object.keys(state.companions.owned).length > 0, // v9.2.8 : avec l'invocation
      event: best > 40, // v9.3.5 : après le monde 2
      expeditions: Object.keys(state.companions.owned).length >= 5 || state.expeditions.slots.some(Boolean) || state.expeditions.done > 0, // v9.3.5 : stable (5 compagnons)
      contracts: Boolean(state.ui.goalsOpen),
      daybook: Boolean(state.ui.goalsOpen) || best >= 10, // v9.8 (H1)
      encyclopedia: boss,
      arena: arenaUnlocked(state), // v9.3.2
      forge: forgeOpen(state, 'forge'), // v9.3.4
      // v9.3.4 : Statistiques, Classement et Guilde n'apparaissent qu'à l'étape 40 (rarement utiles au début).
      stats: Boolean(state.ui.goalsOpen) && later,
      ranking: Boolean(state.ui.goalsOpen) && later && Boolean(this.actions.loadRanking) && this.cloud?.enabled !== false,
      guild: Boolean(state.ui.goalsOpen) && later && Boolean(this.actions.loadGuild) && this.cloud?.enabled !== false, // v9.3.2
    };
    this.$('top-shop')?.classList.add('hidden'); // v9.9 (K6) : la Boutique est un des 5 onglets du bas
    this.$('top-profile')?.classList.add('hidden'); // v9.9 (K6) : Profil dans le tiroir ☰
    const key = `${JSON.stringify(visible)}|${this.tab}|${[...this.newTabs].join()}`;
    if (this.lastHud.tabs === key) return;
    const firstPass = this.lastHud.tabsInit === undefined;
    this.lastHud.tabsInit = true;
    this.lastHud.tabs = key;
    for (const [tab, show] of Object.entries(visible)) {
      if (show && this.tabVisible[tab] === false && !firstPass && this.tab !== tab) {
        this.newTabs.add(tab);
        const menuBtn = this.root.querySelector(`#tabs button[data-menu="${MENUS.find((m) => m.tabs.includes(tab))?.id}"]`);
        setTimeout(() => uiFx.unlockFx(menuBtn), 0); // v9.2.6 : après l'affichage du bouton
        this.news(`Nouvel onglet : ${navPath(tab)}`, '#7fe0a0', 1);
        this.celebrate(`menu-${tab}`, 'Nouveau !', navPath(tab)); // v9.3.8
      }
      this.tabVisible[tab] = show;
    }
    this.newTabs.delete(this.tab);
    this.root.querySelectorAll('#tabs button').forEach((b) => {
      const menu = MENUS.find((m) => m.id === b.dataset.menu);
      if (!menu) return; // v9.3.5 : bouton Combat (toujours visible)
      b.classList.remove('hidden');
      b.classList.toggle('locked', !menu.tabs.some((t) => this.tabVisible[t] !== false)); // v9.9 (K6) : cadenas, plus de menu caché
      b.querySelector('.badge-new')?.classList.toggle('hidden', !menu.tabs.some((t) => this.newTabs.has(t)));
    });
    if (this.tab) this.renderSubtabs();
  }

  // Présentation courte en haut d'un onglet, à sa première ouverture (mémo « déjà vu » sauvegardé).
  introCard(tab, state) {
    const info = UNLOCK_INFO[tab];
    const seen = state.ui.seenTabs ?? [];
    if (!info || seen.includes(tab)) return '';
    // v9.8 (C) : montrée une seule fois — lue d'office après 10 s d'affichage (elle ne revient jamais).
    this.introAt ??= {};
    this.introAt[tab] ??= performance.now();
    if (performance.now() - this.introAt[tab] > 10000) { state.ui.seenTabs = [...seen, tab]; return ''; }
    return `<div class="card intro-card"><div class="row-between"><span><b>${escapeHtml(SUB_LABELS[tab])}</b> — ${info}</span>
      <button class="btn small" data-action="intro-seen" data-value="${tab}">Compris</button></div></div>`;
  }

  renderPanel(state) {
    const panel = PANELS[this.tab];
    const body = this.$('panel-body');
    this.lastRender = performance.now();
    const scroll = body.scrollTop;
    // Les zones défilantes internes (liste d'inventaire, fiche…) gardent aussi leur position.
    const inner = [...body.querySelectorAll('[class]')].filter((el) => el.scrollTop > 0)
      .map((el) => [el.className, [...body.getElementsByClassName(el.classList[0])].indexOf(el), el.scrollTop]);
    // Navigation au clavier (v8.2) : l'élément sélectionné est retrouvé après le redessin.
    const focused = document.activeElement && body.contains(document.activeElement) ? document.activeElement : null;
    const focusSel = focused ? selectorFor(focused) : null;
    const focusIndex = focused ? focusables(this).indexOf(focused) : -1;
    const h = PANEL_HELP[this.tab];
    const device = h && (this.phone ? h.touch : h.mouse);
    // v9.8 (J1) : « ? » ouvre une page illustrée de 3 cases (ce que c'est, comment ça marche, ce que ça rapporte) ; le
    // texte complet reste derrière « En savoir plus ».
    const HELP_ART = { tower: 'tower', expeditions: 'expedition_map', summon: 'summon_circle', event: 'event_market', tree: 'talent_tree', guild: 'guild_hall', forge: 'forge_hall', dungeons: 'door_crypt', arena: 'arena', camp: 'camp_night' };
    const sentences = (h?.more ?? '').split(/(?<=[.!])\s+/).filter(Boolean);
    const step = (pic, title, text) => text ? `<div class="hp-step">${pic}<b>${title}</b><span>${text}</span></div>` : '';
    const help = this.view.helpOpen === this.tab && h
      ? `<div class="card panel-help-card"><div class="hp-steps">
          ${step(HELP_ART[this.tab] ? `<img class="px" src="assets/ui/art98/${HELP_ART[this.tab]}.png" alt="">` : img(SUB_ICONS[this.tab] ?? 'icon_star'), 'C\'est quoi ?', h.short)}
          ${step(img('icon_bolt'), 'Comment ?', device || sentences[0] || '')}
          ${step(img('icon_chest'), 'Ça rapporte', sentences[device ? 0 : 1] || '')}</div>
          ${h.more ? fold(this, `help-${this.tab}`, 'En savoir plus', `<div>${h.more}</div>${h.env ? `<div>${h.env}</div>` : ''}`) : ''}</div>` : ''; // v9.2.1 : env
    // v9.3.9 (2.5) : même écran → mise à jour sur place (la fiche ouverte ne se referme plus, rien ne saute).
    // v9.8 (J3) : bannière illustrée en tête des écrans de lieu (chargée à la demande).
    const BANNER = { tower: 'tower', expeditions: 'expedition_map', summon: 'summon_circle', event: 'event_market', tree: 'talent_tree', guild: 'guild_hall' };
    const banner = BANNER[this.tab] && !(this.tab === 'tower' && this.view.defiTab === 'arena') ? `<img class="px art-banner" src="assets/ui/art98/${BANNER[this.tab]}.png" loading="lazy" alt="" aria-hidden="true">`
      : this.tab === 'tower' && this.view.defiTab === 'arena' ? '<img class="px art-banner" src="assets/ui/art98/arena.png" loading="lazy" alt="" aria-hidden="true">' : '';
    const html = lexify(help + banner + this.introCard(this.tab, state) + panel.render(this, state)); // v9.7.1 (lot 5) : lexique
    if (this.morphTab === this.tab && body.firstChild) morph(body, html);
    else body.innerHTML = html;
    this.morphTab = this.tab;
    for (const [id, value] of Object.entries(this.typed)) {
      const field = body.querySelector(`#${CSS.escape(id)}`);
      if (field && field.value !== value) field.value = value;
    }
    body.scrollTop = this.pendingScroll ?? scroll;
    this.pendingScroll = null;
    if (focused) {
      const again = (focusSel && body.querySelector(focusSel)) || focusables(this)[focusIndex];
      again?.focus({ preventScroll: true });
    }
    for (const [cls, i, top] of inner) {
      const el = body.getElementsByClassName(cls.split(' ')[0])[i];
      if (el) el.scrollTop = top;
    }
    panel.afterRender?.(this, body);
    mountShowcase(body, state); // v9.2.7 : une seule vitrine animée, accrochée à la fiche affichée
    if (this.vfxCascade) { this.vfxCascade = false; uiFx.cascadeFx(body); } // v9.2.6
    uiFx.decorate(body, this.tab); // v9.2.6 : auras, cadres et reflets des fiches, fond de la Tour
    this.phoneAction(body);
    this.lastHud.extra = panel.extra ? panel.extra(this, state) : '';
    this.$('panel-extra').innerHTML = this.lastHud.extra;
    this.lastHud.live = this.liveKey(state);
    this.dirty = false;
  }

  // Téléphone (v9.1.0) : l'action principale de l'écran (première .primary-action) est reprise dans une barre collée
  // en bas du panneau, toujours à portée de pouce. Le bouton d'origine reste en place (même action, même état).
  phoneAction(body) {
    body.querySelector('.phone-action')?.remove();
    if (!this.phone) return;
    // v9.1.3 : seulement une action affichée (pas celle d'une fiche fermée, masquée sur téléphone).
    const main = [...body.querySelectorAll('.primary-action')].find((b) => b.offsetParent !== null);
    if (!main) return;
    const bar = document.createElement('div');
    bar.className = 'phone-action';
    const proxy = document.createElement('button');
    proxy.className = main.className.replace('primary-action', '').trim();
    proxy.innerHTML = main.innerHTML;
    proxy.disabled = main.disabled;
    proxy.addEventListener('click', () => main.click());
    bar.appendChild(proxy);
    body.appendChild(bar);
    this.phoneMain = [main, proxy];
    // Inutile quand le vrai bouton est déjà à l'écran : la barre n'apparaît que s'il est hors de vue.
    this.phoneObserver?.disconnect();
    this.phoneObserver = new IntersectionObserver(([entry]) => bar.classList.toggle('hidden', entry.isIntersecting), { root: body, threshold: 0.6 });
    this.phoneObserver.observe(main);
  }

  // Active ou désactive les boutons d'achat selon les monnaies, sans redessiner le panneau.
  refreshCosts(state) {
    const have = {
      gold: state.gold, gems: state.gems, fragments: state.fragments,
      shards: state.materials.shards, stars: state.transcend?.stars ?? 0,
    };
    this.$('panel-body').querySelectorAll('[data-cost]').forEach((btn) => {
      if (btn.dataset.locked) return;
      const chargesOk = btn.dataset.needsCharge === undefined || Number(btn.dataset.needsCharge) > 0;
      const currency = btn.dataset.currency ?? 'gold';
      const disabled = !chargesOk || have[currency] < Number(btn.dataset.cost);
      if (btn.disabled !== disabled) btn.disabled = disabled;
      const note = btn.nextElementSibling;
      if (note?.classList.contains('cost-missing')) {
        const text = chargesOk ? missingText(Number(btn.dataset.cost), have[currency], currency) : '';
        if (note.textContent !== text) note.textContent = text;
      }
    });
    if (this.phoneMain) {
      const [main, proxy] = this.phoneMain;
      if (main.isConnected && proxy.disabled !== main.disabled) proxy.disabled = main.disabled;
    }
    const extra = PANELS[this.tab].extra;
    if (extra) {
      const html = extra(this, state);
      if (html !== this.lastHud.extra) {
        this.lastHud.extra = html;
        this.$('panel-extra').innerHTML = html;
      }
    }
  }

  showTranscendConfirm(state) {
    const stars = transcendReward(state);
    if (!stars || rebirthBlocked(state)) return;
    this.openModal(`<h2>${glyph('icon_stars')} Transcendance</h2>
      <p>Vous gagneras <b class="gold-text">+${formatNumber(stars)} Étoiles</b> et dégâts, PV et or <b>×${TRANSCEND.powerPerTranscend}</b> pour toujours.</p>
      <p>Tout repart de l'étape 1 : Renaissances (${Math.round(keptRebirthShare(state) * 100)} % conservées), arbre de talents et fragments anciens
        sont remis à zéro. L'équipement, les compagnons, les gemmes et les bonus éternels sont conservés.</p>
      ${transcendKeepResetLists()}
      ${powerChoice(state)}
      <div class="detail-actions"><button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-gold" data-action="confirm-transcend">Transcender</button></div>`);
  }

  // v9.1.0 : « Tout apprendre » et l'achat par région disent d'abord combien de niveaux et de fragments.
  showBuyTalents(region) {
    const clone = structuredClone(this.state);
    const n = buyTalentsCheapest(clone, region);
    const spent = this.state.fragments - clone.fragments;
    const where = region ? `dans la région ${TALENT_BRANCHES.find((b) => b.id === region)?.label ?? ''}` : 'dans tout l\'arbre';
    if (!n) { this.toast('Pas assez de fragments pour le prochain talent.', '#ff8a8a'); return; }
    this.openModal(`<h2 id="modal-title">Apprendre des talents</h2>
      <p><b>${n}</b> niveau${n > 1 ? 'x' : ''} de talent ${where}, le moins cher d'abord, pour <b class="gold-text">${formatNumber(spent)} fragments</b>
        (il t'en restera ${formatNumber(clone.fragments)}).</p>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-gold" data-action="buy-talents-all" data-value="${region ?? ''}">Apprendre</button></div>`);
  }

  showRespecConfirm(state) {
    const cost = respecCost(state);
    this.openModal(`<h2>Réinitialiser l'arbre de talents</h2>
      <p>Tous les talents sont oubliés et les <b class="gold-text">${formatNumber(fragmentsSpent(state))} fragments</b> investis te sont rendus.</p>
      <p class="muted">${cost ? `Coût : ${formatNumber(cost)} gemmes.` : 'La première réinitialisation est gratuite (les suivantes coûtent des gemmes).'}</p>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-danger" data-action="confirm-respec">Réinitialiser</button></div>`);
  }

  showRebirthConfirm(state) {
    if (!canRebirth(state) || rebirthBlocked(state)) return;
    // v9.9 (K14) : confirmation en une carte — ce qu'on garde, ce qu'on perd, ce qu'on gagne (3 icônes).
    const gainPct = Math.round((PRESTIGE.rebirthMultiplier ** rebirthGain(state) - 1) * 100);
    this.openModal(`<h2>Renaissance</h2>
      <div class="rb-trio"><div class="rb-col keep">${img('icon_chest')}<b>Tu gardes</b><span>Équipement, compagnons, gemmes, talents</span></div>
        <div class="rb-col lose">${img('icon_skull')}<b>Tu perds</b><span>Étape, niveau, améliorations, pouvoirs (sauf un)</span></div>
        <div class="rb-col gain">${img('icon_star')}<b>Tu gagnes</b><span>+${gainPct} % de dégâts, PV et or pour toujours · +${rebirthReward(state)} fragments</span></div></div>
      <details class="rb-more"><summary>Détails</summary>${keepResetLists()}</details>
      ${powerChoice(state)}
      <p><b class="good">Après cette Renaissance : dégâts, PV et or ×${(PRESTIGE.rebirthMultiplier ** rebirthGain(state)).toFixed(2).replace('.', ',')} pour toujours</b> (cumulatif).</p>
      ${rebirthGain(state) < 1 ? `<p class="muted">Une Renaissance ne vaut pleinement ×${String(PRESTIGE.rebirthMultiplier).replace('.', ',')} qu'à partir de l'étape ${stageLabel(REBIRTH.fullPowerStage + 1)} ; plus tôt, au prorata de ton étape maximale.</p>` : ''}
      <p class="muted">Les boss ne se renforcent que de ${BALANCE.stages.rebirthBossPct} % par Renaissance, et leurs récompenses augmentent.</p>
      <div class="detail-actions">
        <button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-gold" data-action="confirm-rebirth">Confirmer la Renaissance</button>
      </div>`);
  }

  // Journal (v8.5) : session en cours (touche J, Paramètres) ou absence (retour après au moins 5 min).
  showJournal(summary, kind = 'session') {
    this.openModal(`<h2>📜 ${kind === 'away' ? 'Pendant ton absence' : 'Journal de la session'}</h2>
      <p class="muted">${kind === 'away' ? 'Fenêtre réduite pendant' : 'Jeu lancé depuis'} ${formatDuration(summary.seconds)}.</p>
      ${journalHtml(summary)}
      <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">Continuer</button></div>`);
  }

  // --- Retour hors ligne ---
  showOffline(summary, journal = null) {
    if (summary.clockSuspicious) {
      this.openModal(`<h2>Horloge incohérente</h2>
        <p>L'heure de l'ordinateur est antérieure à la dernière sauvegarde. Aucun gain hors ligne n'a été appliqué.</p>
        <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">Continuer</button></div>`);
      return;
    }
    // Rapport de retour : les objets Épiques et Légendaires sont mis en avant.
    const rare = summary.items.filter((i) => i.rarity === 'epic' || i.rarity === 'legendary');
    const items = summary.items.filter((i) => !rare.includes(i)).map((i) => itemFrame(i, { tag: 'div' })).join('');
    const rareItems = rare.map((i) => itemFrame(i, { tag: 'div' })).join('');
    const mats = summary.materials ?? {};
    const recycled = summary.excessDrops + summary.autoRecycledCount;
    const paused = { tower: 'la Tour de l\'Éternité', challenge: 'le défi de la semaine', dungeon: 'un donjon' }[summary.paused];
    // v9.1.3 (doc1 4a) : fenêtre réduite à l'essentiel — temps, or et XP, objets rares ; le reste dans « Détails ».
    const matIcons = rewardIcons({ shards: mats.shards, gems: summary.gems });
    // v9.8 (C1) : écran de récompense façon jeu mobile — bandeau illustré (le camp), durée en gros, 2 à 4 tuiles
    // (grosse icône, chiffre), UN seul gros bouton « Récupérer » (×2 à côté, plus petit). Objectifs de session : pastille
    // au bord de la scène ; détails et Retour de session derrière « i ».
    const st = this.state ?? this.bootState;
    const team = (st?.companions?.equipped ?? []).map(companionById).filter(Boolean).slice(0, 4);
    const tile = (ico, n, label) => `<div class="rw-tile">${ico}<b class="num">${n}</b><small>${label}</small></div>`;
    const tiles = [tile(coin(), `+${formatNumber(summary.totalGold)}`, 'Or'),
      tile(img('icon_star'), `+${formatNumber(summary.xp)}`, summary.levelsGained ? `XP · +${summary.levelsGained} niv.` : 'XP'),
      summary.gems ? tile(img('icon_gem'), `+${formatNumber(summary.gems)}`, 'Gemmes') : '',
      mats.shards ? tile(img('icon_shard'), `+${formatNumber(mats.shards)}`, 'Éclats') : '',
      rare.length ? `<div class="rw-tile rw-items">${rare.slice(0, 2).map((i) => itemFrame(i, { tag: 'div' })).join('')}<small>Objets rares</small></div>` : '',
      summary.baggedCount ? tile('🎒', summary.baggedCount, 'À trier') : ''].filter(Boolean).slice(0, 4).join('');
    const free = st && (st.expeditions?.slots ?? []).filter(Boolean).length === 0 && Object.keys(st.companions?.owned ?? {}).length >= 5;
    this.openModal(`<div class="rw-banner"><div class="rw-camp">${team.map((c) => img(c.sprite)).join('')}<span class="camp-flame">🔥</span><span class="rw-zz">z z</span></div>
        <div class="rw-title"><small>${summary.hours ? 'Chasse rapide' : 'Récit du Camp'}</small><b>${summary.hours ? `${summary.hours} h` : formatDuration(summary.elapsedSeconds)}</b></div>
        ${team[0] && !summary.hours ? `<p class="rw-story">${escapeHtml(team[0].name)} : « Pendant ton absence, on a tenu l'étape ${stageLabel(summary.stage)}. »</p>` : ''}
        <details class="rw-info"><summary aria-label="Détails">i</summary>
          <p>Ennemis vaincus : ~${formatNumber(summary.kills)} · Objets : ${summary.items.length - summary.autoRecycledCount}${recycled ? ` (+${recycled} convertis en or)` : ''}</p>
          ${items ? `<div class="loot-row">${items}</div>` : ''}
          ${summary.capped ? `<p class="muted">Gains limités à ${BALANCE.offline.capHours} h.</p>` : ''}
          ${journal ? `<div class="section-title">Avant de passer hors ligne</div>${journalHtml(journal)}` : ''}
          <p class="muted">Hors ligne : étape ${stageLabel(summary.stage)}, ${BALANCE.offline.farmMultiplier * 100} % du rythme, sans boss.</p>
          <button class="btn small" data-action="session-return">${img('icon_bolt', 'ico20')} Retour de session${this.phone ? '' : ' (S)'}</button>
        </details></div>
        <div class="rw-lines"><div><span>Étape</span><b>${stageLabel(summary.stage)}</b></div>
          <div><span>Or</span><b>+${formatNumber(summary.totalGold)}</b>${this.canDoubleOffline(summary) ? `<i>→</i><b class="good">+${formatNumber(summary.totalGold * 2)}</b>` : ''}</div></div>
        <div class="rw-tiles">${tiles}</div>
        ${paused ? `<p class="bad rw-note">${escapeHtml(paused)} reprend à ton retour.</p>` : ''}
        ${free ? '<button class="btn small rw-exp" data-action="open-tab" data-value="expeditions">⛺ Envoyer tes compagnons en expédition</button>' : ''}
        <div class="rw-actions"><button class="btn btn-gold rw-claim" data-action="offline-claim">Récupérer</button>
          ${this.canDoubleOffline(summary) ? `<button class="btn rw-x2" data-action="offline-double">×2 <small>gratuit 1×/jour</small></button>` : ''}</div>`);
    this.lastOffline = summary;
    uiFx.offlineFx(this.$('modal-card'), { gold: 0, gems: 0, shards: 0 }, { gold: summary.totalGold, gems: summary.gems ?? 0, shards: mats.shards ?? 0 }); // v9.2.7 : seulement les monnaies qui volent vers leurs compteurs
  }

  // v9.8 (J2) : bandeau de quête sur la scène — la mission du jour la plus avancée et sa récompense en grosse icône ;
  // un appui la récupère quand elle est finie (sinon il ouvre les Missions).
  updateQuestBanner(state) {
    const el = this.$('quest-banner');
    if (!el || !state.missions || this.tabVisible.contracts === false) return;
    const daily = MISSION_PERIODS.find((p) => p.id === 'daily');
    const list = (daily?.missions ?? []).filter((m) => missionOpen(state, m)).map((m) => ({ m, st: missionStatus(state, 'daily', m) })).filter((x) => !x.st.claimed);
    list.sort((a, b) => (b.st.done - a.st.done) || (b.st.progress / b.m.target - a.st.progress / a.m.target));
    const top = list[0];
    const h = top ? `${rewardIcons(top.m.reward)}<span class="qb-text">${escapeHtml(top.m.label)} <b class="num">${formatNumber(Math.min(top.st.progress, top.m.target))}/${formatNumber(top.m.target)}</b></span>` : '';
    if (el.dataset.h === h) return;
    el.dataset.h = h;
    el.innerHTML = h;
    el.classList.toggle('hidden', !h);
    // v9.8.1 (J2) : le bouton Quêtes montre la récompense la plus proche (icône + chiffre) et brille quand elle est prête.
    const qb = this.root.querySelector('#tabs button[data-menu="goals"]');
    if (qb) {
      let tag = qb.querySelector('.menu-reward');
      if (!tag) { tag = document.createElement('small'); tag.className = 'menu-reward'; qb.appendChild(tag); }
      tag.innerHTML = top ? rewardIcons({ gems: top.m.reward.gems ?? 0 }) || rewardIcons(top.m.reward) : '';
      qb.classList.toggle('menu-ready', Boolean(top?.st.done));
    }
    el.classList.toggle('ready', Boolean(top?.st.done));
    el.dataset.action = top?.st.done ? 'claim-mission' : 'open-tab';
    el.dataset.value = top?.st.done ? `daily|${top.m.id}` : 'contracts';
  }

  // v9.8 (H4) : Roue du jour — 8 parts, un tour gratuit, la roue tourne puis s'arrête sur la part gagnée.
  showWheel() {
    const st = this.state;
    if (!st) return;
    const n = WHEEL_SLICES.length;
    const colors = ['#3b6fd1', '#d4a72c', '#4caf6a', '#8a5cd6', '#d45a3c', '#2fa8a8', '#c9446f', '#ffd23f'];
    const grad = WHEEL_SLICES.map((_, i) => `${colors[i % colors.length]} ${(i * 360) / n}deg ${((i + 1) * 360) / n}deg`).join(', ');
    const labels = WHEEL_SLICES.map((sl, i) => `<span class="wh-label" style="--a:${(i + 0.5) * (360 / n)}deg">${sl.jackpot ? '★ ' : ''}${escapeHtml(sl.label)}</span>`).join('');
    const ready = wheelReady(st);
    this.openModal(`<div class="wheel-screen"><h2 id="modal-title">Roue du jour</h2>
      <div class="wh-wrap"><div class="wh-pointer">▼</div><div class="wh-disc" style="background:conic-gradient(${grad})">${labels}</div></div>
      <p class="wh-result muted">${ready ? 'Un tour gratuit par jour. Toujours gagnant !' : 'Déjà tournée aujourd\'hui : reviens demain.'}</p>
      <div class="detail-actions">${ready ? '<button class="btn btn-gold primary-action" data-action="wheel-spin">Tourner</button>' : ''}<button class="btn" data-action="close-modal">Fermer</button></div></div>`);
  }

  spinWheel() {
    const r = this.actions.spinWheel?.();
    const disc = this.$('modal-card')?.querySelector('.wh-disc');
    if (!r || !disc) return;
    this.$('modal-card').querySelector('[data-action="wheel-spin"]')?.remove();
    const n = WHEEL_SLICES.length;
    const target = 360 * 5 + (360 - (r.index + 0.5) * (360 / n));
    const calm = this.calm;
    disc.style.transition = calm ? 'none' : 'transform 2.6s cubic-bezier(.17,.67,.2,1)';
    disc.style.transform = `rotate(${target}deg)`;
    setTimeout(() => {
      const out = this.$('modal-card')?.querySelector('.wh-result');
      if (out) out.innerHTML = `<b class="${r.slice.jackpot ? 'gold-text' : 'good'}">${r.slice.jackpot ? 'GROS LOT ! ' : ''}${escapeHtml(r.slice.label)}</b> ${rewardIcons(r.given, 'named')}`;
      uiFx.claimFly?.(uiFx.snap(this.state).cur, uiFx.snap(this.state).cur, disc, true);
    }, calm ? 50 : 2700);
  }

  bestItemCard(item, unitId = null) {
    if (typeof document === 'undefined') return;
    const host = this.$('stage-area');
    if (!host) return;
    let box = host.querySelector('.best-cards');
    if (!box) { box = document.createElement('div'); box.className = 'best-cards'; host.appendChild(box); }
    const cards = [...box.children];
    if (cards.length >= 2) cards[0].remove(); // 2 cartes au plus sur la scène
    const unit = unitId ? companionById(unitId) : null;
    const el = document.createElement('div');
    el.className = `best-card r-${item.rarity}`;
    el.innerHTML = `${itemFrame(item, { tag: 'span' })}<span class="bc-txt"><small>Meilleur objet</small><b class="r-${item.rarity} rarity-text">${escapeHtml(item.name)}</b></span>
      <button class="btn btn-gold small" data-action="${unit ? 'gear-equip' : 'equip'}" ${unit ? `data-value="${unit.id}|${item.id}"` : `data-id="${item.id}"`}>${unit ? `Équiper ${escapeHtml(unit.name)}` : 'Équiper'}</button>`;
    box.appendChild(el);
    el.querySelector('button').addEventListener('click', () => setTimeout(() => el.remove(), 0));
    setTimeout(() => el.remove(), 20000);
  }


  // v9.9 (K10) : Faille du jour — grande carte : le Titan illustré, son élément, le sablier jusqu'au prochain, la
  // récompense en gros, un bouton. Elle s'ouvre seule une fois par jour (jamais par-dessus « Bon retour »).
  showRift(auto = false) {
    const st = this.state;
    if (!st || typeof document === 'undefined') return;
    if (auto) {
      const day = new Date().toDateString();
      if (st.ui.riftDay === day || this.tabVisible.event === false || titanTriesLeft(st) <= 0) return;
      if (!this.$('modal').classList.contains('hidden') || document.querySelector('.cinematic, #prologue, .wb-overlay')) { setTimeout(() => this.showRift(true), 4000); return; }
      st.ui.riftDay = day;
    }
    const t = titanToday();
    const el = ELEMENTS[t.element];
    const end = new Date(); end.setHours(24, 0, 0, 0);
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    const top = TITAN_TIERS[0].reward;
    this.openModal(`<div class="rift-card"><div class="rift-sky"><div class="rift-boss" style="background-image:url('assets/world-boss/colossus_idle.png');filter:${t.art.filter ?? 'none'}"></div></div>
      <h2 id="modal-title">Faille du jour</h2><b class="rift-name">${escapeHtml(t.name)}</b>
      <div class="rift-meta">${el ? `<span>${el.icon} ${escapeHtml(el.name)}</span>` : ''}<span>⏳ ${formatDuration(left)}</span><span>${titanTriesLeft(st)} essai${titanTriesLeft(st) > 1 ? 's' : ''}</span></div>
      <div class="rift-reward">${rewardIcons(top, 'named')}</div>${teamChips(st, { save: false })}
      <div class="detail-actions"><button class="btn" data-action="close-modal">Plus tard</button><button class="btn btn-gold primary-action" data-action="titan-start-modal">⚔ Combattre</button></div></div>`);
  }

  // v9.9 (K8) : bulle de rencontre au bord de la scène — 2 lignes, 2 boutons (gain et coût écrits dessus), 30 s.
  showEncounter(e) {
    if (!e || typeof document === 'undefined') return;
    const host = this.$('stage-area');
    if (!host || host.querySelector('.road-bubble')) return;
    const el = document.createElement('div');
    el.className = 'road-bubble';
    el.innerHTML = `<div class="rb-head">${img(e.icon)}<div><b>${escapeHtml(e.title)}</b><span>${escapeHtml(e.text)}</span></div></div>
      <div class="rb-btns">${e.options.map((o, i) => `<button class="btn ${o.safe ? '' : 'btn-gold'}" data-action="road-choice" data-value="${i}"><b>${escapeHtml(o.label)}</b><small>${escapeHtml(o.gain)}${o.cost ? ` · ${escapeHtml(o.cost)}` : ''}</small></button>`).join('')}</div>
      <i class="rb-time" style="animation-duration:30s"></i>`;
    host.appendChild(el);
    clearTimeout(this.roadTimer);
    this.roadTimer = setTimeout(() => { if (el.isConnected) { el.remove(); this.actions.roadChoice(null); } }, 30000);
  }

  // v9.9 (K7) : « Choisis une bénédiction » — 3 cartes (rareté en bandeau, flèches ↑ pour l'ampleur), choix automatique
  // de la plus rare au bout de 20 s ; le combat continue. Le petit livre liste celles déjà prises.
  showBoons() {
    if (typeof document === 'undefined' || !this.state?.dungeon) return;
    if (!this.$('modal').classList.contains('hidden')) { this.boonLater = true; return; }
    const offer = this.actions.offerBoons?.();
    if (!offer?.length) return;
    const card = (o, i) => { const b = boonById(o.id); const r = rarityOf(o.rarity);
      return `<button class="boon-card r-${o.rarity}" data-action="pick-boon" data-value="${i}"><span class="boon-band">${r.label}</span>${img(b.icon)}<b>${escapeHtml(b.name)}</b>
        <span>${escapeHtml(b.text)}</span><span class="boon-arrows">${'↑'.repeat(r.arrows)}</span></button>`; };
    const book = (this.state.dungeon.boons ?? []).map((x) => `<span title="${escapeHtml(boonById(x.id)?.name ?? '')}">${img(boonById(x.id)?.icon ?? 'icon_star')}</span>`).join('');
    this.openModal(`<div class="boon-screen"><h2 id="modal-title">Choisis une bénédiction</h2>
      <div class="boon-cards">${offer.map(card).join('')}</div>
      <div class="boon-foot"><span class="muted boon-timer">Choix automatique dans 20 s</span>${book ? `<span class="boon-book" title="Bénédictions prises">📖 ${book}</span>` : ''}</div></div>`);
    clearInterval(this.boonTimer);
    let left = 20;
    this.boonTimer = setInterval(() => {
      left -= 1;
      const t = this.$('modal-card')?.querySelector('.boon-timer');
      if (t) t.textContent = `Choix automatique dans ${left} s`;
      if (left <= 0 || !t) { clearInterval(this.boonTimer); if (t) { this.actions.pickBoon(null); this.closeModal(); } }
    }, 1000);
  }

  // v9.9 (K4) : Conseil du mentor — écran de défaite : meilleur résultat et 3 cartes pour devenir plus fort.
  mentorScreen(title, best, opts = {}) {
    const st = this.state;
    if (!st || typeof document === 'undefined') return;
    if (!this.$('modal').classList.contains('hidden') || document.querySelector('.wb-overlay')) return;
    const tips = mentorTips(st, opts);
    this.mentorTipsShown = tips;
    this.openModal(`<div class="mentor-screen"><h2 id="modal-title">${escapeHtml(title)}</h2>
      ${best ? `<p class="mentor-best">${escapeHtml(best)}</p>` : ''}
      <div class="mentor-head">${img('icon_hero')}<b>Conseil du mentor</b></div>
      <div class="mentor-cards">${tips.map((t, i) => `<button class="mentor-card" data-action="mentor-tip" data-value="${i}">${img(t.icon)}<b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.text)}</span></button>`).join('')}</div>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Continuer</button></div></div>`);
  }

  // Cartes du mentor seules (écrans de fin existants : Tour, Arène).
  mentorCardsHtml(opts = {}) {
    const tips = this.state ? mentorTips(this.state, opts) : [];
    this.mentorTipsShown = tips;
    return `<div class="mentor-head">${img('icon_hero')}<b>Conseil du mentor</b></div><div class="mentor-cards">${tips.map((t, i) => `<button class="mentor-card" data-action="mentor-tip" data-value="${i}">${img(t.icon)}<b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.text)}</span></button>`).join('')}</div>`;
  }

  // Ouvre l'écran d'une carte et pointe la bonne ligne (doigt + halo) une fois le panneau dessiné.
  followTip(t) {
    if (!t) return;
    this.closeModal();
    if (t.tab) this.openTab(t.tab, t.view ?? null);
    if (t.point) this.pointAt(t.point);
  }
  pointAt(sel, tries = 0) {
    if (typeof document === 'undefined') return;
    const el = this.root.querySelector(sel);
    if (!el) { if (tries < 10) setTimeout(() => this.pointAt(sel, tries + 1), 250); return; }
    el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    el.classList.add('mentor-point');
    setTimeout(() => el.classList.remove('mentor-point'), 6000);
  }

  // v9.8 (H9) : mode veille — écran presque noir (économie de batterie sur téléphone), or et étape seulement ; le jeu
  // continue ; un appui n'importe où le quitte.
  // v9.9 (K12) : Veillée au Camp — écran très sombre, le héros endormi près du feu (braises animées à bas régime), le
  // nom de l'étape et l'or qui monte ; rendu du combat coupé ; un appui n'importe où réveille, avec un petit récap.
  sleepMode(on) {
    if (typeof document === 'undefined') return;
    document.getElementById('sleep-layer')?.remove();
    clearInterval(this.sleepTimer);
    const st = this.state;
    if (!on) {
      if (this.sleeping && st && this.vigilStart) {
        const g = st.gold - this.vigilStart.gold, n = Math.max(0, (st.maxStage ?? 1) - this.vigilStart.stage);
        if (g > 0 || n > 0) this.toast(`Pendant la veillée : +${formatNumber(Math.max(0, g))} or${n ? `, ${n} étape${n > 1 ? 's' : ''}` : ''}`, '#ffe27a');
      }
      this.sleeping = false;
      this.userAt = performance.now();
      return;
    }
    this.closeModal?.();
    this.sleeping = true;
    this.vigilStart = { gold: st?.gold ?? 0, stage: st?.maxStage ?? 1 };
    const el = document.createElement('div');
    el.id = 'sleep-layer';
    el.innerHTML = `<div class="vg-scene"><img class="px" src="assets/ui/art98/camp_night.png" alt=""><i class="vg-ember"></i><i class="vg-ember"></i><i class="vg-ember"></i></div>
      <div class="sl-box"><span class="sl-stage"></span><b class="sl-gold num"></b><small>Touche pour réveiller l'équipe</small></div>`;
    const wake = () => this.sleepMode(false);
    el.addEventListener('pointerdown', wake);
    el.addEventListener('click', wake);
    document.addEventListener('keydown', wake, { once: true });
    document.body.appendChild(el);
    this.updateVigil(true);
    this.sleepTimer = setInterval(() => this.updateVigil(true), 2000);
  }
  updateVigil(force = false) {
    if (!force || !this.sleeping) return;
    const st = this.state, el = document.getElementById('sleep-layer');
    if (!st || !el) return;
    el.querySelector('.sl-gold').textContent = `${formatNumber(st.gold)} or`;
    el.querySelector('.sl-stage').textContent = `${zoneForStage(st.stage).name} ${stageLabel(st.stage)}`;
  }


  // v9.8 (H6) : duel de rang — 30 s comptées en 3 s à l'écran : la barre du gardien descend, puis victoire ou défaite.
  rankDuel() {
    const st = this.state;
    const out = st && duelOutcome(st, computeHeroStats(st).dps);
    if (!out) return;
    const art = img(BOSSES[out.guardian.type]?.sprite ?? 'icon_boss', 'rank-foe');
    this.openModal(`<div class="victory-screen rank-duel"><h2 id="modal-title">Duel : ${escapeHtml(out.rank.name)}</h2>
      <div class="rd-field"><span class="rd-hero">${img('menu_hero')}</span><b>VS</b><span class="rd-foe">${art}</span></div>
      <div class="rd-bar"><i style="width:100%"></i></div><p class="rd-time num">30 s</p><div class="rd-out"></div></div>`);
    const card = this.$('modal-card');
    const bar = card.querySelector('.rd-bar i'), time = card.querySelector('.rd-time');
    const T = this.calm ? 1 : 3000, t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / T);
      bar.style.width = `${Math.max(0, 100 - out.pct * 100 * Math.min(1, k / Math.max(out.pct, 0.001)))}%`;
      time.textContent = `${Math.ceil(30 * (1 - k))} s`;
      if (k < 1) { requestAnimationFrame(tick); return; }
      if (out.won) { const r = this.actions.winRank(); card.querySelector('.rd-out').innerHTML = `<b class="gold-text">Victoire ! Rang ${escapeHtml(r?.name ?? '')}</b><p>+3 % de dégâts pour toujours, nouveau titre.</p><button class="btn btn-gold" data-action="close-modal">Super !</button>`; }
      else card.querySelector('.rd-out').innerHTML = `<b class="bad">Gardien à ${Math.round((1 - out.pct) * 100)} %</b><p>Renforce-toi (équipement, améliorations), puis réessaie.</p><button class="btn" data-action="close-modal">Fermer</button>`;
    };
    requestAnimationFrame(tick);
  }

  // v9.8 (G6) : au déblocage, l'icône du système vole du parchemin jusqu'à son bouton de menu.
  unlockFly(questId) {
    if (typeof document === 'undefined' || this.calm) return;
    const tab = QUEST_SYS[questId];
    const from = this.$('next-unlock')?.getBoundingClientRect();
    const menu = MENUS.find((m) => m.tabs.includes(tab));
    const to = menu && this.root.querySelector(`#tabs button[data-menu="${menu.id}"]`)?.getBoundingClientRect();
    if (!from || !to || !tab) return;
    const el = document.createElement('img');
    el.className = 'px unlock-fly';
    el.src = icon(SUB_ICONS[tab] ?? 'icon_star');
    el.style.left = `${from.left + 8}px`; el.style.top = `${from.top - 10}px`;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = `translate(${to.left + to.width / 2 - from.left - 24}px, ${to.top + to.height / 2 - from.top - 6}px) scale(.6)`; el.style.opacity = '.2'; });
    setTimeout(() => el.remove(), 1100);
  }

  // v9.8 (I5/J1) : écran de résultat générique — titre, gains de bonus en grosses lignes, un gros bouton.
  bonusResult(title, before = {}, after = {}) {
    const LABEL = { damagePct: 'dégâts', damageMultPct: 'dégâts (×)', attackSpeedPct: 'vitesse', maxHpPct: 'PV', maxHpMultPct: 'PV (×)', goldPct: 'or', goldMultPct: 'or (×)',
      xpPct: 'XP', critChance: 'critique', damageVsBossPct: 'dégâts aux boss', damageVsNormalPct: 'dégâts aux monstres', regenPct: 'régénération', skillCooldownPct: 'recharge', dropChance: 'butin' };
    const rows = Object.keys(LABEL).map((k) => [k, (after[k] ?? 0) - (before[k] ?? 0)]).filter(([, d]) => Math.abs(d) >= 0.05)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5)
      .map(([k, d]) => `<li><b class="good num">${d > 0 ? '+' : ''}${formatDecimal(d)} %</b> ${LABEL[k]}</li>`).join('');
    this.openModal(`<div class="victory-screen"><h2 id="modal-title">${escapeHtml(title)}</h2>
      ${rows ? `<ul class="result-list">${rows}</ul>` : ''}<div class="detail-actions"><button class="btn btn-gold" data-action="close-modal">Super !</button></div></div>`);
  }

  // v9.8 (G3) : coffre qui s'ouvre en gros plan, les récompenses en sortent.
  chestReveal(given) {
    this.openModal(`<div class="chest-reveal"><div class="cr-chest">${img('icon_chest')}</div><h2 id="modal-title">Journée accomplie !</h2>
      <div class="cr-loot">${rewardIcons(given, 'named')}</div><div class="detail-actions"><button class="btn btn-gold" data-action="close-modal">Super !</button></div></div>`);
  }

  // v9.8 (C1) : après « Récupérer », une flèche dorée pointe le bouton utile (équipe conseillée, sinon Équipement).
  adviceArrow() {
    const st = this.state ?? this.bootState;
    if (!st || typeof document === 'undefined') return;
    const adv = teamAdviceV965(st);
    const menu = adv && !adv.same && adv.gain >= 0.03 ? 'team' : 'hero';
    const btn = this.root.querySelector(`#tabs button[data-menu="${menu}"]`);
    if (!btn) return;
    document.querySelector('.gold-arrow')?.remove();
    const r = btn.getBoundingClientRect();
    const arrow = document.createElement('div');
    arrow.className = 'gold-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '◀';
    arrow.style.left = `${Math.round(r.right + 4)}px`;
    arrow.style.top = `${Math.round(r.top + r.height / 2 - 14)}px`;
    document.body.appendChild(arrow);
    const done = () => arrow.remove();
    btn.addEventListener('click', done, { once: true });
    setTimeout(done, 8000);
  }

  // v9.6.5 (9.6) : le retour propose un ajustement concret (équipe conseillée, sinon équipement).
  returnAdvice() {
    const st = this.state ?? this.bootState;
    if (!st) return '';
    const adv = teamAdviceV965(st);
    if (adv && !adv.same && adv.gain >= 0.03) {
      return `<p class="return-advice">Conseil : une autre équipe ferait <b class="good">+${Math.round(adv.gain * 100)} %</b> de dégâts. <button class="btn btn-primary small" data-action="apply-team">Placer cette équipe</button></p>`;
    }
    return `<p class="return-advice muted">Conseil : vérifie ton équipement (Sac › Équiper le meilleur) avant de repartir.</p>`;
  }

  // v9.3.8 (4) : série de connexion — fenêtre du jour à l'ouverture (calendrier de 7 jours, gros lot au jour 7).
  showLoginPopup(tries = 0) {
    // v9.8 (H4) : la Roue du jour remplace le calendrier à l'ouverture (la connexion se récupère avec « Tout récupérer »).
    if (!this.state || !wheelReady(this.state)) return;
    // v9.7.1 : fenêtres en file — attend la fin d'une autre fenêtre, d'une cinématique ou du tutoriel au lieu de s'empiler.
    if (!this.$('modal').classList.contains('hidden') || document.querySelector('.cinematic, .tour, #prologue, .summon-fx, .levelup, .level-up')) {
      if (tries < 60) setTimeout(() => this.showLoginPopup(tries + 1), 2000);
      return;
    }
    this.showWheel();
  }

  // v9.3.8 (4) : « Tout récupérer ×2 » au retour, une fois par jour (une raison de revenir).
  canDoubleOffline(summary) {
    const today = new Date().toDateString();
    return summary.totalGold > 0 && summary.elapsedSeconds >= 600 && this.state?.ui?.doubleDay !== today;
  }

  // v9.1.0 : une seule façon d'ouvrir une fenêtre — rôle dialog, focus sur le premier bouton, Tab qui boucle
  // dans la fenêtre (shortcuts.js), focus rendu à l'élément d'avant à la fermeture.
  openModal(html) {
    const modal = this.$('modal');
    if (modal.classList.contains('hidden')) this.modalReturn = document.activeElement;
    const card = this.$('modal-card');
    card.innerHTML = html;
    const title = card.querySelector('h2');
    if (title && !title.id) title.id = 'modal-title';
    modal.classList.remove('hidden');
    setTimeout(() => {
      if (modal.classList.contains('hidden') || card.contains(document.activeElement)) return;
      (card.querySelector('input:not([type=hidden]), .btn-primary, .btn-gold, button') ?? card).focus({ preventScroll: true });
    }, 20);
  }

  closeModal() {
    this.claimsOpen = false;
    this.$('modal').classList.add('hidden');
    const back = this.modalReturn;
    this.modalReturn = null;
    if (back?.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
  }
}

// v9.7.1 (lot 5) : lexique d'un appui — la première occurrence de chaque terme (texte hors balises et hors boutons) devient
// touchable ; un appui affiche sa phrase d'explication.
function lexify(html) {
  const seen = new Set();
  let inButton = 0;
  return html.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) => {
    if (tag) {
      if (/^<(button|select|option|textarea|label)\b/i.test(tag)) inButton += 1;
      else if (/^<\/(button|select|option|textarea|label)>/i.test(tag)) inButton = Math.max(0, inButton - 1);
      return tag;
    }
    if (inButton) return text;
    let out = text;
    for (const term of GLOSSARY_TERMS) {
      if (seen.has(term)) continue;
      const re = new RegExp(`(^|[^\\p{L}])(${term})(?![\\p{L}])`, 'u');
      if (re.test(out)) { seen.add(term); out = out.replace(re, `$1<span class="lex" role="button" tabindex="0" data-lex="${term}">$2</span>`); }
    }
    return out;
  });
}
