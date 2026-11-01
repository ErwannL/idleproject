// Interface DOM : barre du haut (monnaies, contrats, récompenses, paramètres), surimpressions légères
// de la scène, HUD, onglets débloqués progressivement et panneaux (un module par panneau dans ./panels).
// L'interface ne modifie jamais l'état directement : elle appelle les actions fournies par main.js.
import { BALANCE } from '../data/balance.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { bossTrait } from '../core/boss-traits.js';
import { DUNGEONS } from '../data/dungeons.js';
import { currentEncounter, difficultyForStage, isBossStage, stageLabel, zoneForStage, zoneIndexForStage } from '../core/combat.js';
import { eventLabel } from '../core/events.js';
import { formatDecimal, formatDuration, formatNumber } from '../core/format.js';
import { isUpgrade } from '../core/inventory.js';
import { upgradeCost } from '../core/economy.js';
import { xpForLevel } from '../core/level.js';
import { rarityById } from '../core/loot.js';
import { powerById } from '../core/powers.js';
import { buyTalentsCheapest, canRebirth, fragmentsSpent, rebirthBlocked, rebirthGain, rebirthReward, respecCost } from '../core/rebirth.js';
import { REBIRTH, TALENT_BRANCHES } from '../data/rebirth.js';
import { keptRebirthShare, transcendReward } from '../core/transcend.js';
import { TRANSCEND } from '../data/transcend.js';
import { rewardText } from '../core/rewards.js';
import { skillCooldown, skillPointsAvailable } from '../core/skills.js';
import { computeHeroStats } from '../core/stats.js';
import { KEY_LABELS, boostKeys, cycleSub, focusables, installShortcuts, keyConflict, keyLabel, setCustomKeys, setMenuCount, shortcutsHtml } from './shortcuts.js';
import { installHoldToRepeat, selectorFor } from './hold.js';
import { installTips } from './tip.js';
import { playSummonReveal } from './summon-fx.js';
import { coin, effectText, escapeHtml, fold, icon, img, itemFrame, missingText } from './common.js';
import { GAME_VERSION } from '../version.js';
import { mutationById } from '../core/mutations.js';
import boss from './panels/boss.js';
import encyclopedia from './panels/encyclopedia.js';
import { encyclopediaNext, encyclopediaProgress } from '../core/encyclopedia.js';
import { collectionsClaimable } from '../core/codex.js';
import campaign from './panels/campaign.js';
import companions from './panels/companions.js';
import expeditions from './panels/expeditions.js';
import contracts from './panels/contracts.js';
import dungeons from './panels/dungeons.js';
import tower from './panels/tower.js';
import { TOWER, towerTimeLeft } from '../core/tower.js';
import { claimableAchievements } from '../core/achievements.js';
import { cheatTimes, simSpeed, unlockedSpeeds } from '../core/cheats.js';
import { PRESTIGE } from '../data/prestige.js';
import { PANEL_HELP, betterItem, nextAction } from '../core/guide.js';
import { heroPower } from '../core/combat.js';
import hero from './panels/hero.js';
import inbox from './panels/inbox.js';
import ranking from './panels/ranking.js';
import inventory, { visibleItems } from './panels/inventory.js';
import options from './panels/options.js';
import skills from './panels/skills.js';
import summon from './panels/summon.js';
import tree, { DEFAULT_ZOOM as TREE_ZOOM, keepResetLists, recenterTree } from './panels/tree.js';
import upgrades from './panels/upgrades.js';
import { missionsClaimable } from '../core/missions.js';
import { earlyBoost } from '../core/boost.js';
import { RUSHES } from '../data/rushes.js';
import { SKILLS } from '../data/skills.js';
import { rushUnlocked } from '../core/rushes.js';
import { dungeonById } from '../core/dungeon.js';
import { newItemsInBag } from '../core/journal.js';
import { measureFarmRate } from '../core/offline.js';
import { claimables, claimablesByTab } from '../core/claimables.js';
import { isPhone, pref, reduceMotion, setPref } from './prefs.js';
import { openSearch } from './search.js';
import { setById } from '../core/sets.js';
import { availableForExpedition, readyExpeditions } from '../core/expeditions.js';
import { bountyReady } from '../core/bounty.js';
import { CHALLENGE, bossEvery } from '../core/challenge.js';
import { ZONES } from '../data/zones.js';
import { CURRENCIES, currencyAmount } from '../data/currencies.js';
import { MENUS, SUB_LABELS, navPath } from './nav.js';

export { MENUS };

const PANELS = Object.fromEntries([upgrades, inventory, hero, companions, expeditions, skills, tree, campaign, dungeons, tower, boss, encyclopedia, summon, contracts, inbox, ranking, options]
  .map((p) => [p.id, p]));
const SUB_ICONS = {
  upgrades: 'icon_upgrade', skills: 'skill_quick', tree: 'icon_tree', hero: 'icon_hero', inventory: 'icon_bag',
  companions: 'icon_paw', expeditions: 'icon_chest', summon: 'icon_summon', campaign: 'icon_map', dungeons: 'icon_dungeon', tower: 'icon_star',
  boss: 'icon_boss', encyclopedia: 'icon_book', contracts: 'icon_trophy', inbox: 'icon_mail', ranking: 'icon_trophy',
};
// v9.1.0 : présentation courte en haut de l'onglet, à sa première ouverture (plus de bulle « Nouveau »).
const UNLOCK_INFO = {
  companions: 'vos compagnons combattent à vos côtés : deux compagnons et un familier.',
  summon: 'gemmes et tickets invoquent des compagnons, des familiers et des apparences.',
  expeditions: 'les compagnons hors de l\'équipe partent en mission, même jeu fermé, et rapportent des ressources.',
  tree: 'les fragments anciens achètent des talents permanents. La Renaissance s\'ouvre plus tard dans ce même onglet.',
  dungeons: 'une clé par tentative : de vrais combats de boss qui donnent fragments et équipement.',
  boss: 'chaque boss vaincu laisse un pouvoir. Réaffrontez-les pour leur butin et leur maîtrise.',
  tower: 'une ascension par semaine : chaque nouvel étage record rapporte gemmes, fragments et tickets.',
  encyclopedia: 'tout ce que vous découvrez est répertorié ; chaque palier rapporte une récompense.',
  inbox: 'tout ce qui est prêt à être récupéré, au même endroit (touche G).',
};
const TOWER_UNLOCK = TOWER.unlockStage;
export const menuOf = (tab) => MENUS.find((m) => m.tabs.includes(tab)) ?? null;
const TALL_MIN_HEIGHT = 420;
const STRIP_MAX_HEIGHT = 190; // en dessous : mode barre (seulement la scène, comme une barre des tâches)
const BULK_CONFIRM_MS = 4000;
// Panneaux dont le contenu évolue pendant le farm : réaffichés au plus une fois par seconde.
const LIVE_PANELS = new Set(['contracts', 'dungeons', 'tower', 'skills', 'boss', 'hero', 'upgrades', 'companions', 'expeditions', 'encyclopedia', 'inbox', 'ranking']);

// Renaissance : choix du seul pouvoir ancestral conservé.
function powerChoice(state) {
  const ids = Object.keys(state.powers);
  if (ids.length <= 1) return '';
  const first = state.equippedPowers[0] ?? ids[0];
  return `<div class="keep-power"><div class="section-title">Pouvoir conservé (un seul)</div>${ids.map((id) => {
    const p = powerById(state.powers[id].current);
    return `<label class="toggle"><input type="radio" name="keep-power" value="${id}" ${id === first ? 'checked' : ''}>
      <b>${BOSSES[id].name}</b> : ${p ? `${p.name} (${effectText(p.effects)})` : '—'}</label>`;
  }).join('')}</div>`;
}

// Lignes du journal de session (seules les valeurs non nulles).
export function journalHtml(j) {
  const rows = [
    j.stages && ['icon_star', 'Étapes conquises', `+${formatNumber(j.stages)} (record ${stageLabel(j.maxStage)})`],
    j.levels && ['icon_upgrade', 'Niveaux du héros', `+${formatNumber(j.levels)}`],
    j.bosses && ['icon_skull', 'Boss vaincus', formatNumber(j.bosses)],
    j.kills && ['skill_quick', 'Ennemis vaincus', formatNumber(j.kills)],
    j.gold && ['coin', 'Or gagné', `+${formatNumber(j.gold)}`],
    j.items && ['icon_bag', 'Objets ramassés', `${formatNumber(j.items)} — ${formatNumber(j.inBag)} encore dans le sac`],
    j.recycled && ['icon_shard', 'Objets recyclés', `${formatNumber(j.recycled)} (+${formatNumber(j.recycledGold)} or)`],
    j.fused && ['icon_anvil', 'Fusions automatiques', formatNumber(j.fused)],
    j.tower && ['icon_star', 'Tour de l\'Éternité', `+${j.tower} étage${j.tower > 1 ? 's' : ''} de record`],
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
      closed: new Set(['weekly', 'monthly']), // sections repliées (missions…)
      open: new Set(), // v9.1.0 : blocs repliés par défaut que le joueur a ouverts
      upgradeCat: 'combat', invTab: 'bag', selectedItemId: null, bulkRarity: 'common', bulkArmed: false,
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
    this.$('panel-subtabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sub]');
      if (b) { this.userAt = performance.now(); this.openTab(b.dataset.sub); }
    });
    root.querySelectorAll('[data-open]').forEach((btn) => btn.addEventListener('click', () => this.toggleTab(btn.dataset.open)));
    this.$('panel-close').addEventListener('click', () => this.closePanel());
    this.$('next-action').addEventListener('click', () => this.runNextAction());
    root.querySelectorAll('[data-currency]').forEach((btn) => btn.addEventListener('click', () => this.showCurrency(btn.dataset.currency)));
    this.$('panel-help').addEventListener('click', () => {
      this.view.helpOpen = this.view.helpOpen === this.tab ? null : this.tab;
      this.userAt = performance.now();
      this.invalidate();
    });
    root.addEventListener('click', (e) => this.onClick(e));
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
      const form = { 'cloud-claim-': 'cloud-claim', 'cloud-rename-': 'cloud-rename', 'cloud-pseudo': null, 'cloud-password': null };
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
      if (Math.abs(dx) > 60 && Math.abs(dy) < 40) cycleSub(this, dx < 0 ? 1 : -1);
    }, { passive: true });
  }


  // v8.4 : annonce du nouvel équilibrage (or des améliorations remboursé).
  showRebalanceNotice(refund) {
    this.openModal(`<h2>⚖ Nouvel équilibrage (v8.4)</h2>
      <p>Le jeu ne bloque plus : les améliorations coûtent moins cher en fin de partie (paliers ×1,75 tous les 25 niveaux),
        les objets grandissent bien plus avec leur niveau, la Renaissance <b>multiplie</b> vos dégâts, PV et or, et le niveau
        maximum du héros passe à ${BALANCE.level.maxLevel}.</p>
      <p>Vos améliorations ont été remboursées : <b class="gold-text">+${formatNumber(refund)} or</b>. Rachetez-les au nouveau prix
        (bouton « Max » dans Améliorer) — vous irez bien plus loin qu'avant.</p>
      <div class="detail-actions"><button class="btn btn-gold" data-action="close-modal">C'est parti !</button></div>`);
  }

  // v8.5 : annonce du nouvel arbre (fragments de l'ancien rendus).
  showTreeNotice(refund) {
    this.openModal(`<h2>🌳 Un arbre mastodonte (v8.5)</h2>
      <p>L'arbre de talents passe de 25 à plus de 500 talents : 6 régions autour du Cœur, des branches
        qui se divisent et se rejoignent, des ponts entre régions, des notables et des clés de voûte.</p>
      <p>Vos anciens talents ont été remboursés : <b class="gold-text">+${formatNumber(refund)} fragments anciens</b>. Replantez-les où vous voulez !</p>
      <div class="detail-actions"><button class="btn btn-gold" data-action="open-tab" data-value="tree">Voir l'arbre</button></div>`);
  }

  showSpeedWarning() {
    this.openModal(`<h2>⚠ Vitesse ×100</h2>
      <p>À cette vitesse, les combats défilent extrêmement vite. Pour éviter les clignotements (personnes sensibles
        à l'épilepsie photosensible), <b>les effets visuels sont coupés</b> : plus de flashs, de chiffres de dégâts,
        de secousses ni de bannières.</p>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-danger" data-action="confirm-speed100">Activer ×100</button></div>`);
  }


  // v9.0.2 : mise à jour lancée mais version inchangée au redémarrage.
  showUpdateFailed(info) {
    this.openModal(`<h2>⚠ La mise à jour n'a pas pu s'installer</h2>
      <p>La version ${escapeHtml(info.version)} a été téléchargée, mais le jeu est toujours en version ${escapeHtml(GAME_VERSION)}.</p>
      <p class="muted">Causes possibles : place disque insuffisante, antivirus qui bloque l'installateur, ou fermeture
      de l'installateur. Relancez-le : cette fois sa fenêtre s'affiche et indique le problème éventuel. Votre partie est conservée.</p>
      <div class="detail-actions">${info.file ? '<button class="btn btn-gold" data-action="retry-installer">Relancer l\'installateur</button>' : ''}
        <button class="btn" data-action="open-releases">Page des versions</button>
        <button class="btn" data-action="close-modal">Plus tard</button></div>`);
  }
  showShortcuts() {
    this.openModal(`<h2>Raccourcis clavier</h2>${shortcutsHtml()}
      <p class="muted">Astuce : maintenez le clic sur un bouton (acheter, améliorer…) — quand l'anneau est plein, il est cliqué en continu jusqu'à ce que vous bougiez la souris.</p>
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
    else document.documentElement.style.zoom = zoom === 1 ? '' : String(zoom);
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
    pick('upgradeCat', (x) => ['combat', 'survival', 'resources', 'all'].includes(x));
    pick('upgradeSort', (x) => ['profit', 'cost'].includes(x));
    pick('buyAmount', (x) => ['1', '10', '100', 'max'].includes(x));
    pick('missionTab', (x) => ['today', 'week', 'achievements'].includes(x));
    pick('invTab', (x) => ['bag', 'stash'].includes(x));
    pick('encSec', (x) => ['monsters', 'bosses', 'mutations', 'items', 'companions', 'museum'].includes(x));
    pick('summonPool', (x) => ['hero', 'ally', 'pet'].includes(x));
    pick('treeSeg', (x) => ['tree', 'rebirth'].includes(x));
    pick('heroTab', (x) => ['hero', 'class', 'look', 'records'].includes(x));
    pick('optTab', (x) => ['general', 'interface', 'sound', 'window'].includes(x));
    pick('encSlot', (x) => typeof x === 'string' && x.length < 16);
    if (Array.isArray(nav.open)) this.view.open = new Set(nav.open.filter((x) => typeof x === 'string').slice(0, 64));
    if (Array.isArray(nav.closed)) this.view.closed = new Set(nav.closed.filter((x) => typeof x === 'string').slice(0, 64));
    for (const [tab, top] of Object.entries(nav.scroll ?? {})) if (okTab(tab) && Number.isFinite(top)) this.scrollMem[tab] = top;
  }

  saveNav() {
    if (this.tab) this.scrollMem[this.tab] = this.$('panel-body').scrollTop;
    const keys = ['upgradeCat', 'upgradeSort', 'buyAmount', 'missionTab', 'invTab', 'encSec', 'summonPool', 'treeSeg', 'heroTab', 'optTab', 'encSlot'];
    setPref('nav', {
      lastSub: this.lastSub,
      view: Object.fromEntries(keys.filter((k) => this.view[k] !== undefined && this.view[k] !== null).map((k) => [k, this.view[k]])),
      open: [...(this.view.open ?? [])], closed: [...this.view.closed],
      scroll: this.scrollMem,
    });
  }

  // Paramètres › Interface : réglages propres à cet appareil (mode compact, combat, animations, taille…).
  interfaceExtra() {
    const sel = (name, options) => `<select data-action="device-pref" data-key="${name}" aria-label="${escapeHtml(options.label)}">${options.items.map(([v, l]) => `<option value="${v}" ${String(pref(name)) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const check = (name, label) => `<label class="toggle"><input type="checkbox" data-action="device-pref" data-key="${name}" ${pref(name) === true ? 'checked' : ''}> ${label}</label>`;
    const keys = Object.keys(KEY_LABELS).map((action) => `<div class="key-row"><span>${KEY_LABELS[action]}</span>
      <button class="btn small key-btn${this.view.keyCapture === action ? ' armed' : ''}" data-action="capture-key" data-value="${action}">${this.view.keyCapture === action ? 'Appuyez sur une touche…' : `<kbd>${escapeHtml(keyLabel(action))}</kbd>`}</button></div>`).join('');
    return `<div class="card"><div class="section-title">Cet appareil</div>
        <div class="muted">Ces réglages restent sur cet appareil (PC ou téléphone), hors de la sauvegarde.</div>
        <div class="pref-grid">
          <span>Combat</span>${sel('combat', { label: 'Combat', items: [['simple', 'Simple (l\'essentiel)'], ['full', 'Complet (tout afficher)']] })}
          <span>Animations</span>${sel('motion', { label: 'Réduire les animations', items: [['auto', 'Auto (réglage du système)'], ['reduce', 'Réduites'], ['full', 'Complètes']] })}
          <span>Taille de l'interface</span>${sel('uiScale', { label: 'Taille de l\'interface', items: [['auto', 'Auto'], [100, '100 %'], [125, '125 %'], [150, '150 %'], [200, '200 %']] })}
        </div>
        ${check('compact', '<b>Mode compact</b> : listes serrées, sans descriptions (joueurs expérimentés)')}
        ${check('colorAid', '<b>Aide aux couleurs</b> : lettre de rareté sur les objets (C, R, É, L), pastilles en anneau')}
        ${check('contrast', '<b>Contraste élevé</b> : textes plus contrastés, sans décor animé')}
      </div>
      ${fold(this, 'keys', 'Raccourcis clavier : changer une touche', `<div class="muted">Cliquez une touche puis appuyez sur la nouvelle. Une touche déjà utilisée est refusée.</div>
        <div class="key-grid">${keys}</div><button class="btn small" data-action="reset-keys">Touches par défaut</button>`)}`;
  }

  openSearch() {
    openSearch(this);
  }

  // Touche G : tout ce qui est réclamable d'un coup.
  claimEverything() {
    this.actions.claimEverything?.();
  }

  // v9.1.0 : réinitialisation isolée — ce qui est perdu, export proposé, bouton actif après la saisie de EFFACER.
  showResetConfirm() {
    this.openModal(`<h2>⚠ Réinitialiser la partie</h2>
      <p>Tout est effacé sur cet appareil : niveau, or, gemmes, objets, compagnons, talents, Renaissances, records et la copie de
        secours. <b class="bad">C'est définitif.</b></p>
      <div class="options-row"><button class="btn small" data-action="export-save" data-value="file">Exporter ma partie d'abord</button></div>
      <p>Pour confirmer, tapez <b>EFFACER</b> :</p>
      <input id="reset-confirm" class="confirm-input" type="text" autocomplete="off" spellcheck="false" maxlength="12" aria-label="Tapez EFFACER pour confirmer">
      <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">Annuler</button>
        <button class="btn btn-danger" data-action="confirm-reset" id="confirm-reset" disabled>Tout effacer</button></div>`);
    setTimeout(() => this.$('reset-confirm')?.focus(), 30);
  }

  // v9.1.0 : sauvegarde écrite par une version plus récente : rien n'est chargé ni écrasé.
  showNewerSave(version) {
    this.openModal(`<h2>Sauvegarde d'une version plus récente</h2>
      <p>Votre partie a été enregistrée par une version plus récente du jeu (format ${escapeHtml(String(version))}). Cette version ne sait pas
        la lire. <b>Rien n'a été effacé</b> : mettez le jeu à jour pour la retrouver.</p>
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
    const layout = h >= TALL_MIN_HEIGHT ? 'tall' : h <= STRIP_MAX_HEIGHT ? 'strip' : 'mini';
    if (layout !== this.layout) {
      this.root.classList.remove('layout-mini', 'layout-tall', 'layout-strip');
      if (layout === 'strip') this.closePanel();
      this.root.classList.add(`layout-${layout}`);
      this.layout = layout;
      this.invalidate();
    }
    this.root.classList.toggle('wide', layout === 'tall' && w >= 1100 && h >= 600);
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
    const menu = MENUS.find((m) => m.id === id);
    if (!menu) return;
    if (this.tab && menu.tabs.includes(this.tab)) { this.closePanel(); return; }
    const visible = menu.tabs.filter((t) => this.tabVisible[t] !== false);
    this.openTab(visible.includes(this.lastSub[id]) ? this.lastSub[id] : visible[0] ?? menu.tabs[0]);
  }

  // Onglets du menu courant, en haut du panneau. Marques (v9.1.0, une seule règle) : pastille rouge = à récupérer ;
  // point or = l'action conseillée (une seule) ; « nouveau » = onglet qui vient de s'ouvrir.
  renderSubtabs() {
    const menu = menuOf(this.tab);
    const el = this.$('panel-subtabs');
    const tabs = menu ? menu.tabs.filter((t) => this.tabVisible[t] !== false) : [];
    const mark = (t) => (this.tabBadges[t] ? 'red' : this.adviceTab === t ? 'gold' : this.newTabs.has(t) ? 'new' : '');
    const key = `${this.tab}|${tabs.join()}|${tabs.map(mark).join()}`;
    if (this.lastHud.subtabs === key) return;
    this.lastHud.subtabs = key;
    el.classList.toggle('hidden', tabs.length < 2);
    el.setAttribute('role', 'tablist');
    el.innerHTML = tabs.map((t) => {
      const m = mark(t);
      const badge = m === 'red' ? '<i class="badge" aria-label="À récupérer"></i>' : m === 'gold' ? '<i class="badge hint" aria-label="Conseillé"></i>'
        : m === 'new' ? '<i class="badge badge-ring" aria-label="Nouveau"></i>' : '';
      return `<button class="subtab${t === this.tab ? ' active' : ''}" role="tab" aria-selected="${t === this.tab}" data-sub="${t}">
      <img class="px" src="${icon(SUB_ICONS[t])}" alt=""><span>${SUB_LABELS[t]}</span>${badge}</button>`;
    }).join('');
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
    if (!PANELS[tab] || this.tabVisible[tab] === false) return;
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
    this.lastHud.tabs = null;
    this.invalidate();
  }

  closePanel() {
    this.sidePanel(false);
    this.tab = null;
    this.$('panel').classList.add('hidden');
    this.root.classList.remove('panel-open');
    this.root.querySelectorAll('#tabs button, [data-open]').forEach((b) => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
    this.lastHud.tabs = null;
  }

  invalidate() {
    this.dirty = true;
  }

  // --- Actions de l'interface ---
  onClick(event) {
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const { action, key, id, stage, seconds, value, preset, boss: bossId, currency } = el.dataset;
    const v = this.view;
    const a = this.actions;
    const local = (fn) => { fn(); this.invalidate(); };
    switch (action) {
      case 'buy': a.buy(key, el.dataset.amount ?? '1'); break;
      case 'buy-best': a.buyBestUpgrades(); break;
      case 'buy-amount': local(() => { v.buyAmount = value; }); break;
      case 'upgrade-cat': local(() => { v.upgradeCat = value; }); break;
      case 'inv-tab': local(() => { v.invTab = value; }); break;
      case 'craft-tier': local(() => { v.craftTier = value; }); break;
      case 'select-item': local(() => { v.selectedItemId = id; v.sheetOpen = 'item'; }); break;
      case 'inv-view': local(() => { v.invView = value || null; }); break;
      case 'fuse-all': a.fuseAll(); break;
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
      case 'fuse': a.fuse(...value.split('|')); break;
      case 'reforge': a.reforge(id); break;
      case 'craft': a.craft(value, el.dataset.tier); break;
      case 'stage': a.selectStage(Number(stage)); break;
      case 'zone-sel': local(() => { v.zoneSel = Number(value); }); break;
      case 'retry-boss': a.retryBoss(); break;
      case 'advance': a.advance(); break;
      case 'toggle-auto': a.setAutoAdvance(!this.state.autoAdvance); break;
      case 'learn-skill': a.learnSkill(key); break;
      case 'distribute-skills': a.distributeSkills(); break;
      case 'hero-sel': local(() => { v.heroSel = value; }); break;
      case 'set-hero': a.setHero(value); break;
      case 'companion-sel': local(() => { v.companionSel = value; v.sheetOpen = 'companion'; }); break;
      case 'toggle-companion': a.toggleCompanion(value); break;
      case 'upgrade-companion': a.upgradeCompanion(value); break;
      case 'open-tab': if (el.closest('#modal')) this.closeModal(); this.openTab(value); break;
      case 'ranking-sort': this.actions.loadRanking(value); break;
      case 'summon': {
        const res = a.summon(Number(value), currency, el.dataset.pool);
        if (res) { v.lastSummon = res; playSummonReveal(res); }
        this.invalidate();
        break;
      }
      case 'summon-pool': local(() => { v.summonPool = value; v.lastSummon = null; }); break;
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
      case 'collection-missing': local(() => { v.collOpen = v.collOpen === value ? null : value; }); break;
      case 'boss-sel': local(() => { v.bossSel = value; }); break;
      case 'enc-sec': local(() => { v.encSec = value; }); break;
      case 'enc-sel': local(() => { v.encSel = value; }); break;
      case 'enc-slot': local(() => { v.encSlot = value; }); break;
      case 'enc-claim': a.claimEncyclopedia(); break;
      case 'recycle-toggle': a.setRecycleRule(el.dataset.group, value); break;
      case 'mission-tab': local(() => { v.missionTab = value; }); break;
      case 'lang': a.setLanguage(value); break;
      case 'theme': a.setTheme(value); break;
      case 'speed': a.cycleSpeed(); break;
      case 'autofuse': a.setAutoFuse(el.dataset.group, value); break;
      case 'check-update': a.checkUpdate(); break;
      case 'enter-tower': a.enterTower(); break;
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
      case 'enter-dungeon': a.enterDungeon(value, v.dungeonSlot ?? this.state.ui.dungeonSlot ?? 'any', v.dungeonPath ?? this.state.ui.dungeonPath ?? 'gold', el.dataset.diff ?? v.dungeonDiff ?? 'easy'); break;
      case 'dungeon-sel': local(() => { v.dungeonSel = value; v.dungeonDiff = null; }); break;
      case 'dungeon-diff': local(() => { v.dungeonDiff = value; }); break;
      case 'abandon-dungeon': a.abandonDungeon(); break;
      case 'claim-contract': a.claimContract(Number(value)); break;
      case 'claim-mission': { const [period, id] = value.split('|'); a.claimMission(period, id); break; }
      case 'claim-mission-bonus': a.claimMissionBonus(value); break;
      case 'claim-login': a.claimLogin(); break;
      case 'claim-all': a.claimAll(); break;
      case 'claim-everything': a.claimEverything(); break;
      case 'session-return': this.closeModal(); a.sessionReturn(); break;
      case 'currency': this.showCurrency(value); break;
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
      case 'buy-tperk': a.buyTranscendPerk(key); break;
      case 'buy-tperk-max': a.buyTranscendPerk(key, true); break;
      case 'transcend': this.showTranscendConfirm(this.state); break;
      case 'confirm-transcend': {
        const keep = this.$('modal-card').querySelector('input[name="keep-power"]:checked')?.value;
        this.closeModal();
        a.transcend(keep);
        break;
      }
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
      case 'tour-later': a.skipTour(); break;
      case 'open-summon-hero': local(() => { v.summonPool = 'hero'; }); this.openTab('summon'); break;
      case 'claim-bounty': a.claimBounty(); break;
      case 'bounty-go': a.goToStage(Number(value)); break;
      case 'toggle-tips': event.preventDefault(); local(() => { v.tipsOpen = v.tipsOpen === false; }); break;
      case 'to-mannequin': a.toMannequin(id); break;
      case 'from-mannequin': { const [setId, slot] = value.split('|'); a.fromMannequin(setId, slot); break; }
      case 'wear-mannequin': a.wearMannequin(value); break;
      case 'auto-mannequin': a.setAutoMannequin(this.state.ui.autoMannequin === false); break;
      case 'to-museum': a.toMuseum(id); break;
      case 'from-museum': a.fromMuseum(value); break;
      case 'auto-museum': a.setAutoMuseum(this.state.ui.autoMuseum === false); break;
      case 'expose-all': a.exposeAll(); break;
      case 'recycle-museum-dupes': a.recycleMuseumDuplicates(); break;
      case 'keep-sets': a.setKeepSets(this.state.ui.keepSets === false); break;
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
    if (action === 'enc-slot-select') { this.view.encSlot = el.value; this.invalidate(); }
    if (action === 'craft-slot') { this.view.craftSlot = el.value; this.invalidate(); }
    if (action === 'build-select') { this.view.buildSel = Number(el.value); this.actions.applyLoadout(Number(el.value)); }
    if (action === 'auto') this.actions.setAutoAdvance(el.checked);
    if (action === 'on-top') this.actions.setAlwaysOnTop(el.checked);
    if (action === 'skill-auto') this.actions.setSkillAuto(el.checked);
    if (action === 'rush-auto') this.actions.setRushAuto(el.checked);
    if (action === 'volume') this.sound?.setVolume(el.dataset.kind, Number(el.value) / 100);
    if (action === 'mute') this.sound?.setMuted(el.checked);
    if (action === 'notify') this.actions.setNotify(el.dataset.key, el.checked);
    if (action === 'cloud-listed') this.actions.cloudListed(el.checked);
    if (action === 'cinematics') this.actions.setCinematics(el.checked);
    if (action === 'auto-recycle') this.actions.setAutoRecycle(el.value);
    if (action === 'recycle-mode') this.actions.setRecycleRule('mode', el.value);
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
        if (added && event.item.rarity !== 'common') {
          this.news(event.museum ? `${event.item.name} exposé au Musée`
            : event.mannequin ? `${event.item.name} rangé sur le mannequin « ${setById(event.item.set)?.name ?? ''} »`
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
        this.news(`Butin du boss : +${event.essence} essences`, '#e27bff');
        break;
      case 'bossSpawn':
      {
        if (state.ui.notify?.boss === false) break;
        const tier = BOSSES[event.kind].tier ?? 'mega';
        const label = { mini: 'Mini-boss', mid: 'Boss', hard: 'Boss redoutable', mega: 'MÉGA BOSS' }[tier];
        // v9.0.6 : mécanique du boss annoncée (et ce qui la contre) dans les nouvelles.
        const trait = bossTrait(event.kind);
        this.banner(`${label} — ${BOSSES[event.kind].name}`, `boss tier-${tier}`);
        if (trait) this.news(`${BOSSES[event.kind].name} — ${trait.name} : ${trait.text}. Contre : ${trait.counter}.`, trait.color, 2);
        if (tier === 'mega' || tier === 'hard') this.announce(`${label} : ${BOSSES[event.kind].name}`);
        if ((tier === 'mega' || tier === 'hard') && !this.calm) {
          const flash = this.$('boss-flash');
          flash.className = `tier-${tier}`;
          void flash.offsetWidth;
          flash.classList.add('on');
        }
      }
        break;
      case 'eliteSpawn':
        this.news('Une élite errante approche !', '#ff9a3d');
        break;
      case 'mutantSpawn': {
        const m = mutationById(event.mutation);
        if (m && !state.ui.focus) this.news(`Ennemi muté — ${m.name} : ${m.text} (or ×3, objet garanti)`, m.color);
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
        this.news(`${BOSSES[event.bossId].name} réaffronté : charge de relance ${entry.charges}/3`, '#f2d083');
        if (this.tab === 'boss') this.invalidate();
        break;
      }
      case 'levelUp':
        this.banner(`Niveau ${event.level} !`, 'win');
        this.news(`Niveau ${event.level} : +1 point de compétence`, '#f2d083');
        break;
      case 'worldEvent': {
        const texts = {
          chest: ['Coffre découvert : il vous attend dans les récompenses', '#f2d083'],
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
      case 'stage':
        if (event.zoneChanged) {
          const d = difficultyForStage(event.stage);
          this.banner(`Monde ${zoneIndexForStage(event.stage) + 1} — ${zoneForStage(event.stage).name}${d > 1 ? ` · difficulté ×${d}` : ''}`, 'zone');
        }
        if (this.tab === 'campaign') this.invalidate();
        break;
      case 'unlock':
        if (this.tab === 'campaign') this.invalidate();
        break;
      case 'dungeonRoom':
        this.news(`Salle terminée : ${rewardText(event.reward, formatNumber)}`, '#9cf08a');
        break;
      case 'dungeonComplete':
        this.banner('Donjon terminé !', 'win');
        this.news(`Donjon terminé : ${event.item.name} (${rarityById(event.item.rarity).label})`, rarityById(event.item.rarity).color);
        this.invalidate();
        break;
      case 'towerFloor':
        this.banner(`Étage ${event.floor} franchi !`, 'win');
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
        this.news(`${event.timeout ? 'Temps écoulé ! ' : ''}Défi de la semaine : ${event.waves} vague${event.waves > 1 ? 's' : ''} franchie${event.waves > 1 ? 's' : ''}. Record de la semaine : ${state.challengeWeek?.best ?? 0} · absolu : ${state.challengeBest ?? 0}.`, '#ffb36b');
        this.invalidate();
        break;
      case 'towerCollapsed':
        this.banner('La tour s\'effondre !', 'lose');
        this.news(`Tour de l'Éternité : temps écoulé, la tour s'effondre à l'étage ${event.floors + 1}. Record : ${state.towerBest}.`, '#c9a6ff');
        this.invalidate();
        break;
      case 'towerFailed':
        this.banner('Ascension terminée', 'lose');
        this.news(`Tour de l'Éternité : vaincu à l'étage ${event.defeatedAt}${event.bossHpPct !== null && event.bossHpPct !== undefined ? ` (boss à ${formatNumber(event.bossHpPct)} % de PV)` : ''}. Record : ${state.towerBest}.`, '#c9a6ff');
        this.invalidate();
        break;
      case 'dungeonFailed':
        this.banner('Tentative échouée', 'lose');
        this.news(`Défaite ${event.bossHpPct !== null && event.bossHpPct !== undefined ? `face au boss final (encore ${formatNumber(event.bossHpPct)} % de PV)` : `en salle ${event.room}`}. Conservé : ${rewardText(event.earned, formatNumber) || 'rien'} — détails dans l'onglet Donjons.`);
        this.invalidate();
        break;
      case 'heroDeath':
        this.banner(`Vaincu… retour à l'étape ${stageLabel(event.to)}`, 'lose');
        this.news(state?.autoAdvance === false ? 'Le héros reste sur l\'étape : améliorez-le puis appuyez sur « Avancer ».'
          : event.boss ? 'Normal : le héros s\'entraîne à l\'étape d\'avant et retentera le boss quand il sera 15 % plus fort. Pour aller plus vite : améliorez vos dégâts.'
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
    const now = performance.now();
    if (now - (this.lastHud.newsFlash ?? 0) < 300) return;
    this.lastHud.newsFlash = now;
    el.parentElement.classList.remove('flash');
    void el.offsetWidth; // relance l'animation CSS
    el.parentElement.classList.add('flash');
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
    this.state = state;
    this.updateRushBar(state);
    this.updateSkillBar(state, world);
    const stats = world.heroStats ?? computeHeroStats(state);
    this.setText('gold', formatNumber(state.gold));
    this.setText('strip-gold', formatNumber(state.gold));
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
    // v9.1.0 : « Réduire les animations » (réglage de l'appareil, sinon préférence du système) coupe aussi les
    // animations de l'interface, le flash des boss et le décor des thèmes ; ×100 fait de même.
    this.calm = reduceMotion() || simSpeed(state) >= 100;
    document.documentElement.classList.toggle('fx-calm', this.calm || pref('contrast') === true);
    document.documentElement.classList.toggle('reduce-motion', this.calm);
    this.$('speed-toggle').classList.toggle('fast', simSpeed(state) > 1);
    this.$('auto-toggle').classList.toggle('off', !state.autoAdvance);
    this.$('auto-toggle').classList.toggle('hidden', Boolean(state.dungeon || state.tower || state.challenge));

    this.updateZoneCard(state);
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
      if (LIVE_PANELS.has(this.tab) && now - this.lastLive > 1000) {
        this.lastLive = now;
        if (!busy && this.liveKey(state) !== this.lastHud.live) this.renderPanel(state);
      }
    }
  }

  // Empreinte du contenu d'un panneau « vivant » (évite de le redessiner pour rien).
  liveKey(state) {
    switch (this.tab) {
      case 'contracts': return state.contracts.map((c) => `${c.id}:${c.progress}`).join() + JSON.stringify(state.missions);
      case 'dungeons': return `${JSON.stringify(state.dungeon)}|${JSON.stringify(state.challenge)}|${state.challengeWeek?.best}`;
      // Expéditions : la barre de progression avance (au plus une fois toutes les 30 s) et « Récupérer » apparaît.
      case 'expeditions': return `${Math.floor(Date.now() / 30000)}|${readyExpeditions(state)}|${state.expeditions.slots.map((x) => x?.companionId ?? '').join()}`;
      case 'companions': return `${state.companions.equipped.join()}|${Object.keys(state.companions.owned).length}`;
      case 'inbox': return this.claims.map((c) => c.key).join() + (state.inbox.length);
      case 'tower': return `${JSON.stringify(state.tower)}|${state.towerBest}`;
      // Achat « Max » : le nombre de niveaux abordables change avec l'or.
      case 'upgrades': return this.view.buyAmount === 'max' ? String(Math.floor(Math.log10(state.gold + 1) * 8)) : '';
      case 'skills': return `${state.level}|${Math.floor(state.xp)}|${Object.values(state.rushes.active).map(Math.ceil).join()}|${Object.values(state.rushes.cooldown).map((c) => Math.ceil(c / 10)).join()}`;
      case 'boss': return Object.values(state.powers).map((p) => `${p.victories}${p.charges}${p.pending}`).join();
      case 'hero': return `${state.level}|${Math.floor(state.xp / 5)}|${state.heroes.active}|${Object.keys(state.heroes.owned).length}`;
      case 'encyclopedia': return String(encyclopediaProgress(state).found);
      case 'ranking': return `${this.ranking?.sort}|${this.ranking?.players?.length ?? -1}|${this.ranking?.error ?? ''}|${this.ranking?.players?.[0]?.updatedAt ?? ''}`;
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
      this.$('stage-pips').innerHTML = this.pips(1, d.rooms, state.dungeon.room, state.dungeon.room - 1, (i) => i === d.rooms);
      return;
    }
    const zone = zoneForStage(state.stage);
    this.$('zone-name').textContent = `${zone.name} ${stageLabel(state.stage)}`;
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
    if (enc.boss) {
      const b = world.enemies.find((e) => e.boss);
      progress.classList.add('boss');
      ratio = b ? b.hp / b.maxHp : 1;
      text = b ? `${BOSSES[b.type].name} — ${formatNumber(Math.max(0, b.hp))} / ${formatNumber(b.maxHp)} PV` : 'Le boss arrive…';
    } else {
      progress.classList.remove('boss');
      const kills = state.challenge ? state.challenge.kills : state.dungeon ? state.dungeon.kills : state.kills;
      ratio = kills / enc.killsNeeded;
      text = state.challenge
        ? `Vague ${state.challenge.wave} · ${state.challenge.kills}/${enc.killsNeeded} · ${Math.max(0, Math.ceil(CHALLENGE.waveSeconds - (state.challenge.time ?? 0)))} s`
        : state.dungeon
        ? `Salle ${state.dungeon.room}/${enc.dungeon.rooms} · ${kills}/${enc.killsNeeded}`
        : `Ennemis vaincus ${kills}/${enc.killsNeeded}`;
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
  updateRushBar(state) {
    const now = performance.now();
    if (now - (this.lastHud.rushTime ?? 0) < 200) return;
    this.lastHud.rushTime = now;
    const bar = this.$('rush-bar');
    const full = pref('combat') === 'full';
    const boost = earlyBoost(state);
    const boostOn = boost.secondsLeft > 0 || boost.weekend || boost.cheat > 1;
    const open = RUSHES.map((r, i) => [r, i]).filter(([r]) => rushUnlocked(state, r) || full);
    const key = `${open.map(([r]) => (rushUnlocked(state, r) ? r.id : `-${r.id}`)).join()}|${boostOn}|${phoneLayout()}`;
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = open.map(([r, i]) => {
        const unlocked = rushUnlocked(state, r);
        return `<button class="rush-btn${unlocked ? '' : ' locked'}" data-action="rush" data-value="${r.id}" style="--rush:${r.color}"
          title="${r.name} — ${r.text}. ${unlocked ? `Touche ${boostKeys()[i]}.` : `Débloqué au niveau ${r.unlockLevel} du héros.`}" aria-label="${r.name}">${img(r.icon)}
          ${phoneLayout() ? '' : `<span class="rush-key">${boostKeys()[i]}</span>`}<span class="rush-time"></span></button>`;
      }).join('') + (boostOn ? '<button class="boost-chip" data-action="show-boost" id="boost-chip">⚡<span id="boost"></span></button>' : '');
      delete this.lastHud.boost;
    }
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
      btn.style.setProperty('--cd', active > 0 ? 0 : cd / rush.cooldown);
      btn.querySelector('.rush-time').textContent = active > 0 ? `${Math.ceil(active)}` : cd > 0 ? (cd >= 60 ? `${Math.ceil(cd / 60)}m` : `${Math.ceil(cd)}`) : '';
    }
    if (boostOn) this.setText('boost', boostText(boost));
  }

  // Compétences sur la scène : elles se lancent TOUTES SEULES ; le cadran montre leur recharge, un clic ouvre leur
  // écran. v9.1.0 : seulement celles apprises, et la barre n'apparaît qu'après le premier mini-boss.
  updateSkillBar(state, world) {
    const now = performance.now();
    if (now - (this.lastHud.skillTime ?? 0) < 200) return;
    this.lastHud.skillTime = now;
    const bar = this.$('skill-bar');
    if (!bar) return;
    const full = pref('combat') === 'full';
    const show = full || (state.records.bossesDefeated ?? 0) > 0;
    bar.classList.toggle('hidden', !show);
    if (!show) return;
    const list = SKILLS.filter((sk) => (state.skills[sk.id] ?? 0) > 0);
    const key = `${list.map((sk) => `${sk.id}${state.skills[sk.id]}`).join()}|${state.skillAuto}`;
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = list.map((sk) => `<button class="skill-btn" data-action="open-tab" data-value="skills" data-skill="${sk.id}"
          title="${sk.name} (niv. ${state.skills[sk.id]}) — se lance toute seule toutes les ${sk.cooldown} s environ" aria-label="${sk.name}">${img(sk.icon)}</button>`).join('')
        + (state.skillAuto ? '' : '<span class="skill-pause">pause</span>');
    }
    const bonus = (world.heroStats ?? computeHeroStats(state)).bonus;
    for (const btn of bar.querySelectorAll('.skill-btn')) {
      const sk = SKILLS.find((x) => x.id === btn.dataset.skill);
      const left = Math.max(0, world.skillTimers?.[sk.id] ?? 0);
      const total = skillCooldown(sk, bonus);
      btn.style.setProperty('--cd', Math.min(1, left / total));
      btn.classList.toggle('ready', left <= 0.05);
    }
  }

  // Marques (v9.1.0, une seule règle) : pastille rouge = à récupérer (core/claimables.js) ; point or = l'action
  // conseillée du moment (une seule) ; compteur +N sur Héros = objets neufs dans le sac ; « nouveau » = onglet ouvert.
  updateBadges(state) {
    const now = performance.now();
    if (now - (this.lastHud.badgeTime ?? 0) < 500) return;
    this.lastHud.badgeTime = now;
    this.claims = claimables(state);
    const byTab = claimablesByTab(this.claims);
    this.tabBadges = byTab;
    const current = computeHeroStats(state);
    this.next = nextAction(state, { claims: this.claims, betterItem: betterItem(state, BALANCE, current) });
    this.adviceTab = this.next.tab && !this.next.action ? this.next.tab : null;
    for (const menu of MENUS) {
      const red = menu.tabs.some((t) => byTab[t] && this.tabVisible[t] !== false);
      const gold = !red && this.adviceTab && menu.tabs.includes(this.adviceTab);
      const el = this.$(`badge-${menu.id}`);
      if (el) {
        el.classList.toggle('hidden', !red && !gold);
        el.classList.toggle('hint', Boolean(gold));
        el.setAttribute('aria-label', red ? 'À récupérer' : gold ? 'Conseillé' : '');
      }
    }
    // Objets neufs : trouvés depuis la dernière ouverture d'Équipement (et encore dans le sac).
    if (this.seenItemsUntil === null) this.seenItemsUntil = state.nextItemId;
    const fresh = newItemsInBag(state, this.seenItemsUntil);
    const count = this.$('count-hero');
    if (count) {
      count.classList.toggle('hidden', !fresh || this.tab === 'inventory');
      count.textContent = fresh > 99 ? '+99' : `+${fresh}`;
      count.setAttribute('aria-label', `${fresh} objet${fresh > 1 ? 's' : ''} neuf${fresh > 1 ? 's' : ''}`);
    }
    if (this.tab) this.renderSubtabs();
  }

  // Bouton « Prochaine action » sous le combat : un seul conseil, cliquable (bon onglet, bonne vue, ou action).
  updateNextAction() {
    const btn = this.$('next-action');
    if (!btn || !this.next) return;
    const n = this.next;
    const key = `${n.id}|${n.text}`;
    if (this.lastHud.next !== key) {
      this.lastHud.next = key;
      this.setText('next-action-text', n.text);
      btn.dataset.kind = n.id;
      btn.classList.toggle('na-gold', n.id === 'claim' || n.id === 'retry');
    }
    btn.classList.remove('hidden');
  }

  runNextAction() {
    const n = this.next;
    if (!n) return;
    this.userAt = performance.now();
    if (n.action === 'claim-everything') this.actions.claimEverything();
    else if (n.action === 'retry-boss') this.actions.retryBoss();
    else if (n.action === 'advance') this.actions.advance();
    else if (n.tab) {
      if (n.tab === this.tab && !n.view) this.closePanel();
      else this.openTab(n.tab, n.view ?? null);
    }
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

  // Récapitulatif du Retour de session.
  showSessionReturn(r) {
    const ratio = r.before > 0 ? r.after / r.before : 1;
    const rows = [
      r.claimed ? `<li>${r.claimed} récompense${r.claimed > 1 ? 's' : ''} récupérée${r.claimed > 1 ? 's' : ''}</li>` : '',
      r.claimsLeft ? `<li class="bad">${r.claimsLeft} récompense${r.claimsLeft > 1 ? 's' : ''} avec un objet en attente (sac plein) : Objectifs › À récupérer.</li>` : '',
      r.equipped ? `<li>${r.equipped} objet${r.equipped > 1 ? 's' : ''} équipé${r.equipped > 1 ? 's' : ''}</li>` : '',
      r.levels ? `<li>${r.levels} niveau${r.levels > 1 ? 'x' : ''} d'amélioration (${coin()} ${formatNumber(r.spent)})</li>` : '<li class="muted">Pas assez d\'or pour une amélioration de dégâts.</li>',
      r.points ? `<li>${r.points} niveau${r.points > 1 ? 'x' : ''} de compétence (répartis entre les compétences apprises)</li>` : '',
    ].join('');
    this.openModal(`<h2 id="modal-title">⚡ Retour de session</h2><ul class="session-list">${rows}</ul>
      <p>Dégâts/s : <b>${formatNumber(r.before)}</b> → <b class="good">${formatNumber(r.after)}</b>${ratio > 1.0001 ? ` (×${ratio >= 100 ? formatNumber(Math.round(ratio)) : ratio.toFixed(2).replace('.', ',')})` : ''}</p>
      <p class="muted">Aucune gemme n'est dépensée. Les améliorations de PV, d'armure, de régénération et d'or restent à votre choix.</p>
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
    this.openModal(`<h2 id="modal-title">⚡ Bonus du moment</h2>
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
    const visible = {
      tree: best >= 10 || state.fragments > 0 || state.records.rebirths > 0 || (state.prestige?.count ?? 0) > 0 || (state.transcend?.count ?? 0) > 0,
      dungeons: best >= DUNGEONS[0].unlockStage || Object.keys(state.dungeonsCleared).length > 0 || Boolean(state.dungeon),
      tower: best >= TOWER_UNLOCK || (state.towerBest ?? 0) > 0 || Boolean(state.tower),
      boss: boss || Object.keys(state.powers).length > 0,
      companions: boss || Object.keys(state.companions.owned).length > 0,
      summon: boss || Object.keys(state.companions.owned).length > 0,
      expeditions: availableForExpedition(state).length > 0 || state.expeditions.slots.some(Boolean) || state.expeditions.done > 0,
      inbox: Boolean(state.ui.goalsOpen),
      contracts: Boolean(state.ui.goalsOpen),
      encyclopedia: boss,
      ranking: Boolean(state.ui.goalsOpen) && Boolean(this.actions.loadRanking) && this.cloud?.enabled !== false,
    };
    const key = `${JSON.stringify(visible)}|${this.tab}|${[...this.newTabs].join()}`;
    if (this.lastHud.tabs === key) return;
    const firstPass = this.lastHud.tabsInit === undefined;
    this.lastHud.tabsInit = true;
    this.lastHud.tabs = key;
    for (const [tab, show] of Object.entries(visible)) {
      if (show && this.tabVisible[tab] === false && !firstPass && this.tab !== tab) {
        this.newTabs.add(tab);
        this.news(`Nouvel onglet : ${navPath(tab)}`, '#7fe0a0', 1);
      }
      this.tabVisible[tab] = show;
    }
    this.newTabs.delete(this.tab);
    this.root.querySelectorAll('#tabs button').forEach((b) => {
      const menu = MENUS.find((m) => m.id === b.dataset.menu);
      b.classList.toggle('hidden', !menu.tabs.some((t) => this.tabVisible[t] !== false));
      b.querySelector('.badge-new')?.classList.toggle('hidden', !menu.tabs.some((t) => this.newTabs.has(t)));
    });
    if (this.tab) this.renderSubtabs();
  }

  // Présentation courte en haut d'un onglet, à sa première ouverture (mémo « déjà vu » sauvegardé).
  introCard(tab, state) {
    const info = UNLOCK_INFO[tab];
    const seen = state.ui.seenTabs ?? [];
    if (!info || seen.includes(tab)) return '';
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
    const help = this.view.helpOpen === this.tab && h
      ? `<div class="card panel-help-card"><b>Comment ça marche ?</b> ${h.short}${device ? ` ${device}` : ''}
          ${h.more ? fold(this, `help-${this.tab}`, 'En savoir plus', `<div>${h.more}</div>`) : ''}</div>` : '';
    body.innerHTML = help + this.introCard(this.tab, state) + panel.render(this, state);
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
    const main = body.querySelector('.primary-action');
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
      gold: state.gold, gems: state.gems, tickets: state.tickets, fragments: state.fragments,
      shards: state.materials.shards, essence: state.materials.essence, stars: state.transcend?.stars ?? 0,
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
    this.openModal(`<h2>✧ Transcendance</h2>
      <p>Vous gagnerez <b class="gold-text">+${formatNumber(stars)} Étoiles</b> et dégâts, PV et or <b>×${TRANSCEND.powerPerTranscend}</b> pour toujours.</p>
      <p>Tout repart de l'étape 1 : Renaissances (${Math.round(keptRebirthShare(state) * 100)} % conservées), arbre de talents et fragments anciens
        sont remis à zéro. L'équipement, les compagnons, les gemmes et les bonus éternels sont conservés.</p>
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
        (il vous en restera ${formatNumber(clone.fragments)}).</p>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-gold" data-action="buy-talents-all" data-value="${region ?? ''}">Apprendre</button></div>`);
  }

  showRespecConfirm(state) {
    const cost = respecCost(state);
    this.openModal(`<h2>Réinitialiser l'arbre de talents</h2>
      <p>Tous les talents sont oubliés et les <b class="gold-text">${formatNumber(fragmentsSpent(state))} fragments</b> investis vous sont rendus.</p>
      <p class="muted">${cost ? `Coût : ${formatNumber(cost)} gemmes.` : 'La première réinitialisation est gratuite (les suivantes coûtent des gemmes).'}</p>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-danger" data-action="confirm-respec">Réinitialiser</button></div>`);
  }

  showRebirthConfirm(state) {
    if (!canRebirth(state) || rebirthBlocked(state)) return;
    this.openModal(`<h2>Renaissance</h2>
      <p>Vous gagnerez <b class="gold-text">+${rebirthReward(state)} fragments anciens</b> à investir dans l'arbre de talents.</p>
      ${keepResetLists()}
      ${powerChoice(state)}
      <p><b class="good">Après cette Renaissance : dégâts, PV et or ×${(PRESTIGE.rebirthMultiplier ** rebirthGain(state)).toFixed(2).replace('.', ',')} pour toujours</b> (cumulatif).</p>
      ${rebirthGain(state) < 1 ? `<p class="muted">Une Renaissance ne vaut pleinement ×${String(PRESTIGE.rebirthMultiplier).replace('.', ',')} qu'à partir de l'étape ${stageLabel(REBIRTH.fullPowerStage + 1)} ; plus tôt, au prorata de votre étape maximale.</p>` : ''}
      <p class="muted">Les boss ne se renforcent que de ${BALANCE.stages.rebirthBossPct} % par Renaissance, et leurs récompenses augmentent.</p>
      <div class="detail-actions">
        <button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-gold" data-action="confirm-rebirth">Confirmer la Renaissance</button>
      </div>`);
  }

  // Journal (v8.5) : session en cours (touche J, Paramètres) ou absence (retour après au moins 5 min).
  showJournal(summary, kind = 'session') {
    this.openModal(`<h2>📜 ${kind === 'away' ? 'Pendant votre absence' : 'Journal de la session'}</h2>
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
    this.openModal(`<h2>Bon retour !</h2>
        <p>Absence : <b>${formatDuration(summary.elapsedSeconds)}</b>${summary.capped ? ` <span class="muted">(gains limités à ${BALANCE.offline.capHours} h)</span>` : ''}</p>
        <p>Or gagné : <b class="gold-text">+${formatNumber(summary.totalGold)}</b> ${coin()}</p>
        ${summary.gems ? `<p>Gemmes : <b>+${formatNumber(summary.gems)}</b> ${img('icon_gem')}</p>` : ''}
        <p>Expérience : <b>+${formatNumber(summary.xp)}</b>${summary.levelsGained ? ` · <b class="good">+${summary.levelsGained} niveau${summary.levelsGained > 1 ? 'x' : ''}</b>` : ''}</p>
        <p>Ennemis vaincus : ~${formatNumber(summary.kills)} · Objets : ${summary.items.length - summary.autoRecycledCount}
          ${recycled ? `<span class="muted">(+${recycled} convertis en or)</span>` : ''}</p>
        ${rareItems ? `<div class="offline-rare"><b class="gold-text">★ Objets rares obtenus</b><div class="loot-row">${rareItems}</div></div>` : ''}
        ${items ? `<div class="loot-row">${items}</div>` : ''}
        ${mats.shards || mats.essence ? `<p>Matériaux : ${mats.shards ? `+${formatNumber(mats.shards)} éclats` : ''}${mats.shards && mats.essence ? ' · ' : ''}${mats.essence ? `+${formatNumber(mats.essence)} essences` : ''}</p>` : ''}
        ${paused ? `<p class="bad">Vous étiez dans ${paused} : il ne progresse pas hors ligne (il reprend à votre retour).</p>` : ''}
        ${journal ? `<div class="section-title">Avant de passer hors ligne</div>${journalHtml(journal)}` : ''}
        <p class="muted">Hors ligne, le héros reste sur l'étape ${stageLabel(summary.stage)} (la meilleure où il gagne vraiment) à
          ${BALANCE.offline.farmMultiplier * 100} % de son rythme, sans affronter de boss.</p>
        <div class="detail-actions"><button class="btn" data-action="close-modal">Continuer</button>
          <button class="btn btn-gold" data-action="session-return">⚡ Retour de session (S)</button></div>`);
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
    this.$('modal').classList.add('hidden');
    const back = this.modalReturn;
    this.modalReturn = null;
    if (back?.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
  }
}
