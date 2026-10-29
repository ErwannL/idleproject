// Interface DOM : barre du haut (monnaies, contrats, récompenses, paramètres), surimpressions légères
// de la scène, HUD, onglets débloqués progressivement et panneaux (un module par panneau dans ./panels).
// L'interface ne modifie jamais l'état directement : elle appelle les actions fournies par main.js.
import { BALANCE } from '../data/balance.js';
import { BOSSES } from '../data/enemies.js';
import { DUNGEONS } from '../data/dungeons.js';
import { currentEncounter, difficultyForStage, isBossStage, stageLabel, zoneForStage, zoneIndexForStage } from '../core/combat.js';
import { eventLabel } from '../core/events.js';
import { formatDecimal, formatDuration, formatNumber } from '../core/format.js';
import { isUpgrade } from '../core/inventory.js';
import { xpForLevel } from '../core/level.js';
import { rarityById } from '../core/loot.js';
import { powerById } from '../core/powers.js';
import { canRebirth, fragmentsSpent, rebirthReward, respecCost } from '../core/rebirth.js';
import { keptRebirthShare, transcendReward } from '../core/transcend.js';
import { TRANSCEND } from '../data/transcend.js';
import { rewardText } from '../core/rewards.js';
import { skillCooldown, skillPointsAvailable } from '../core/skills.js';
import { computeHeroStats } from '../core/stats.js';
import { BOOST_KEYS, focusables, installShortcuts, shortcutsHtml } from './shortcuts.js';
import { installHoldToRepeat, selectorFor } from './hold.js';
import { playSummonReveal } from './summon-fx.js';
import { coin, effectText, escapeHtml, icon, img, itemFrame } from './common.js';
import { GAME_VERSION } from '../version.js';
import { mutationById } from '../core/mutations.js';
import boss from './panels/boss.js';
import encyclopedia from './panels/encyclopedia.js';
import { encyclopediaNext, encyclopediaProgress } from '../core/encyclopedia.js';
import { collectionsClaimable } from '../core/codex.js';
import campaign from './panels/campaign.js';
import companions from './panels/companions.js';
import contracts from './panels/contracts.js';
import dungeons from './panels/dungeons.js';
import tower from './panels/tower.js';
import { towerTimeLeft, towerUnlocked } from '../core/tower.js';
import { claimableAchievements } from '../core/achievements.js';
import { cheatTimes, simSpeed, unlockedSpeeds } from '../core/cheats.js';
import { PRESTIGE } from '../data/prestige.js';
import { PANEL_HELP } from '../core/guide.js';
import { heroPower } from '../core/combat.js';
import hero from './panels/hero.js';
import inbox from './panels/inbox.js';
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
import { setById } from '../core/sets.js';
import { readyExpeditions } from '../core/expeditions.js';
import { bountyReady } from '../core/bounty.js';
import { CHALLENGE, bossEvery } from '../core/challenge.js';
import { ZONES } from '../data/zones.js';

const PANELS = Object.fromEntries([upgrades, inventory, hero, companions, skills, tree, campaign, dungeons, tower, boss, encyclopedia, summon, contracts, inbox, options]
  .map((p) => [p.id, p]));
// v9.0.6 : 6 menus regroupant les panneaux (sous-onglets en haut du panneau).
export const MENUS = [
  { id: 'adventure', label: 'Aventure', tabs: ['campaign'] },
  { id: 'character', label: 'Personnage', tabs: ['inventory', 'hero', 'upgrades', 'skills', 'companions'] },
  { id: 'summon', label: 'Invocation', tabs: ['summon'] },
  { id: 'events', label: 'Événements', tabs: ['dungeons', 'tower', 'contracts'] },
  { id: 'progress', label: 'Progression', tabs: ['tree', 'boss', 'encyclopedia'] },
]
const SUB_LABELS = {
  upgrades: 'Améliorations', skills: 'Compétences', tree: 'Renaissance', hero: 'Héros', inventory: 'Équipement',
  companions: 'Compagnons', summon: 'Invocation', campaign: 'Carte', dungeons: 'Donjons', tower: 'Tour',
  boss: 'Boss ancestraux', encyclopedia: 'Collections', contracts: 'Missions', inbox: 'Récompenses',
};
const SUB_ICONS = {
  upgrades: 'icon_upgrade', skills: 'skill_quick', tree: 'icon_tree', hero: 'icon_hero', inventory: 'icon_bag',
  companions: 'icon_paw', summon: 'icon_summon', campaign: 'icon_map', dungeons: 'icon_dungeon', tower: 'icon_star',
  boss: 'icon_boss', encyclopedia: 'icon_book', contracts: 'icon_trophy', inbox: 'icon_mail',
};
export const menuOf = (tab) => MENUS.find((m) => m.tabs.includes(tab)) ?? null;
const TALL_MIN_HEIGHT = 420;
const STRIP_MAX_HEIGHT = 190; // en dessous : mode barre (seulement la scène, comme une barre des tâches)
const BULK_CONFIRM_MS = 4000;
// Panneaux dont le contenu évolue pendant le farm : réaffichés au plus une fois par seconde.
const LIVE_PANELS = new Set(['contracts', 'dungeons', 'tower', 'skills', 'boss', 'hero', 'upgrades', 'companions', 'encyclopedia']);

// Renaissance : choix du seul pouvoir ancestral conservé.
function powerChoice(state) {
  const ids = Object.keys(state.powers);
  if (ids.length <= 1) return '';
  const first = state.equippedPowers[0] ?? ids[0];
  return `<div class="keep-power"><div class="section-title">Pouvoir ancestral conservé (un seul)</div>${ids.map((id) => {
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
    j.recycled && ['icon_shard', 'Recyclés automatiquement', `${formatNumber(j.recycled)} (+${formatNumber(j.recycledGold)} or)`],
    j.fused && ['icon_anvil', 'Fusions automatiques', formatNumber(j.fused)],
    j.tower && ['icon_star', 'Tour de l\'Éternité', `+${j.tower} étage${j.tower > 1 ? 's' : ''} de record`],
  ].filter(Boolean);
  if (!rows.length) return '<p class="muted">Rien de notable pour l\'instant.</p>';
  return `<div class="journal">${rows.map(([ic, label, value]) => `<div class="journal-row">${img(ic)}<span>${label}</span><b>${value}</b></div>`).join('')}</div>`;
}

const RENDER_THROTTLE_MS = 1000;
const SIDE_PANEL_W = 440; // largeur du menu sur le côté (petite fenêtre)
const SIDE_MIN_WIDTH = 900; // navigateur : menu sur le côté seulement à partir de cette largeur
const RAIL_W = 70; // barre des menus verticale (petite fenêtre)
const STRIP_MENU_HEIGHT = 400; // mode barre : hauteur de la fenêtre quand le menu est ouvert
export class UI {
  constructor(root, actions) {
    this.root = root;
    this.actions = actions;
    this.$ = (id) => root.querySelector(`#${id}`);
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
      upgradeCat: 'combat', invTab: 'bag', selectedItemId: null, bulkRarity: 'common', bulkArmed: false,
      heroSel: null, companionSel: null, talentSel: null, zoneSel: null, dungeonSlot: 'any', dungeonPath: 'gold',
      oddsOpen: new Set(), lastSummon: null,
    };

    root.querySelectorAll('img[data-icon]').forEach((el) => { el.src = icon(el.dataset.icon); });
    if (!window.desktop) root.querySelector('.strip-btn')?.remove(); // agrandir la fenêtre : version bureau seulement
    this.lastSub = {}; // dernier sous-onglet ouvert de chaque menu
    this.tabVisible = {};
    this.tabBadges = {};
    root.querySelectorAll('#tabs button').forEach((btn) => btn.addEventListener('click', () => this.toggleMenu(btn.dataset.menu)));
    this.$('panel-subtabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sub]');
      if (b) { this.userAt = performance.now(); this.openTab(b.dataset.sub); }
    });
    root.querySelectorAll('[data-open]').forEach((btn) => btn.addEventListener('click', () => this.toggleTab(btn.dataset.open)));
    this.$('panel-close').addEventListener('click', () => this.closePanel());
    this.$('panel-help').addEventListener('click', () => {
      this.view.helpOpen = this.view.helpOpen === this.tab ? null : this.tab;
      this.userAt = performance.now();
      this.invalidate();
    });
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('change', (e) => this.onChange(e));
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!this.$('modal').classList.contains('hidden')) this.closeModal();
      else this.closePanel();
    });
    new ResizeObserver(() => this.updateLayout()).observe(root);
    this.updateLayout();
    installShortcuts(this);
    installHoldToRepeat(root);
  }

  // Après une défaite contre un boss : puissance actuelle / puissance visée, et bouton pour retenter.
  updateRetry(state) {
    const r = state.bossRetry;
    const show = Boolean(r) && !state.dungeon && !state.tower && !state.challenge && state.stage === r.stage - 1;
    const btn = this.$('retry-boss');
    btn.classList.toggle('hidden', !show);
    if (!show) return;
    const now = performance.now();
    if (now - (this.lastHud.retryAt ?? 0) < 1000) return;
    this.lastHud.retryAt = now;
    const pct = Math.min(999, Math.floor((heroPower(state) / (r.power * BALANCE.stages.bossRetryPower)) * 100));
    this.setText('retry-boss', `Retenter le boss ⚔ (${pct} % de la puissance visée)`);
  }

  // v8.4 : annonce du nouvel équilibrage (or des améliorations remboursé).
  showRebalanceNotice(refund) {
    this.$('modal-card').innerHTML = `<h2>⚖ Nouvel équilibrage (v8.4)</h2>
      <p>Le jeu ne bloque plus : les améliorations coûtent moins cher en fin de partie (paliers ×1,75 tous les 25 niveaux),
        les objets grandissent bien plus avec leur niveau, la Renaissance <b>multiplie</b> vos dégâts, PV et or, et le niveau
        maximum du héros passe à ${BALANCE.level.maxLevel}.</p>
      <p>Vos améliorations ont été remboursées : <b class="gold-text">+${formatNumber(refund)} or</b>. Rachetez-les au nouveau prix
        (bouton « Max » dans Améliorer) — vous irez bien plus loin qu'avant.</p>
      <div class="detail-actions"><button class="btn btn-gold" data-action="close-modal">C'est parti !</button></div>`;
    this.$('modal').classList.remove('hidden');
  }

  // v8.5 : annonce du nouvel arbre (fragments de l'ancien rendus).
  showTreeNotice(refund) {
    this.$('modal-card').innerHTML = `<h2>🌳 Un arbre mastodonte (v8.5)</h2>
      <p>L'arbre de talents passe de 25 à plus de 500 talents : 6 régions autour du Cœur du chevalier, des branches
        qui se divisent et se rejoignent, des ponts entre régions, des notables et des clés de voûte.</p>
      <p>Vos anciens talents ont été remboursés : <b class="gold-text">+${formatNumber(refund)} fragments anciens</b>. Replantez-les où vous voulez !</p>
      <div class="detail-actions"><button class="btn btn-gold" data-action="open-tab" data-value="tree">Voir l'arbre</button></div>`;
    this.$('modal').classList.remove('hidden');
  }

  showSpeedWarning() {
    this.$('modal-card').innerHTML = `<h2>⚠ Vitesse ×100</h2>
      <p>À cette vitesse, les combats défilent extrêmement vite. Pour éviter les clignotements (personnes sensibles
        à l'épilepsie photosensible), <b>les effets visuels sont coupés</b> : plus de flashs, de chiffres de dégâts,
        de secousses ni de bannières.</p>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-danger" data-action="confirm-speed100">Activer ×100</button></div>`;
    this.$('modal').classList.remove('hidden');
  }


  // v9.0.2 : mise à jour lancée mais version inchangée au redémarrage.
  showUpdateFailed(info) {
    this.$('modal-card').innerHTML = `<h2>⚠ La mise à jour n'a pas pu s'installer</h2>
      <p>La version ${escapeHtml(info.version)} a été téléchargée, mais le jeu est toujours en version ${escapeHtml(GAME_VERSION)}.</p>
      <p class="muted">Causes possibles : place disque insuffisante, antivirus qui bloque l'installateur, ou fermeture
      de l'installateur. Relancez-le : cette fois sa fenêtre s'affiche et indique le problème éventuel. Votre partie est conservée.</p>
      <div class="detail-actions">${info.file ? '<button class="btn btn-gold" data-action="retry-installer">Relancer l\'installateur</button>' : ''}
        <button class="btn" data-action="open-releases">Page des versions</button>
        <button class="btn" data-action="close-modal">Plus tard</button></div>`;
    this.$('modal').classList.remove('hidden');
  }
  showShortcuts() {
    this.$('modal-card').innerHTML = `<h2>Raccourcis clavier</h2>${shortcutsHtml()}
      <p class="muted">Astuce : maintenez le clic sur un bouton (acheter, améliorer…) — quand l'anneau est plein, il est cliqué en continu jusqu'à ce que vous bougiez la souris.</p>
      <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">OK</button></div>`;
    this.$('modal').classList.remove('hidden');
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

  // v9.0.6 : un menu ouvre son dernier sous-onglet (ou le premier disponible) ; un second clic le referme.
  toggleMenu(id) {
    this.userAt = performance.now();
    const menu = MENUS.find((m) => m.id === id);
    if (!menu) return;
    if (this.tab && menu.tabs.includes(this.tab)) { this.closePanel(); return; }
    const visible = menu.tabs.filter((t) => this.tabVisible[t] !== false);
    const tab = visible.includes(this.lastSub[id]) ? this.lastSub[id] : visible[0] ?? menu.tabs[0];
    this.openTab(tab);
  }

  // Sous-onglets du menu courant, en haut du panneau.
  renderSubtabs() {
    const menu = menuOf(this.tab);
    const el = this.$('panel-subtabs');
    const tabs = menu ? menu.tabs.filter((t) => this.tabVisible[t] !== false) : [];
    const key = `${this.tab}|${tabs.join()}|${tabs.map((t) => (this.tabBadges[t] ? 1 : 0) + (this.newTabs.has(t) || this.tabHints?.[t] ? 2 : 0)).join('')}`;
    if (this.lastHud.subtabs === key) return;
    this.lastHud.subtabs = key;
    el.classList.toggle('hidden', tabs.length < 2);
    el.innerHTML = tabs.map((t) => `<button class="subtab${t === this.tab ? ' active' : ''}" data-sub="${t}">
      <img class="px" src="${icon(SUB_ICONS[t])}" alt=""><span>${SUB_LABELS[t]}</span>
      ${this.tabBadges[t] ? '<i class="badge" title="Récompense à récupérer"></i>' : this.newTabs.has(t) || this.tabHints?.[t] ? '<i class="badge hint"></i>' : ''}</button>`).join('');
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

  openTab(tab) {
    if (!PANELS[tab]) return;
    this.sidePanel(true);
    if (tab === 'inventory') this.clearLootPopup();
    // Nouvel onglet : il s'ouvre en haut (avant, il gardait le défilement de l'onglet précédent).
    if (tab !== this.tab) this.$('panel-body').scrollTop = 0;
    this.tab = tab;
    this.view.bulkArmed = false;
    this.newTabs.delete(tab);
    this.$('panel').classList.remove('hidden');
    this.root.classList.add('panel-open');
    this.$('panel-title').textContent = PANELS[tab].title;
    this.$('panel-icon').src = icon(PANELS[tab].icon);
    const menu = menuOf(tab);
    if (menu) this.lastSub[menu.id] = tab;
    this.lastOpened = tab;
    this.root.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.menu === menu?.id));
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
    this.root.querySelectorAll('#tabs button, [data-open]').forEach((b) => b.classList.remove('active'));
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
      case 'buy-amount': local(() => { v.buyAmount = value; }); break;
      case 'upgrade-cat': local(() => { v.upgradeCat = value; }); break;
      case 'inv-tab': local(() => { v.invTab = value; }); break;
      case 'craft-tier': local(() => { v.craftTier = value; }); break;
      case 'select-item': local(() => { v.selectedItemId = id; }); break;
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
      case 'hero-sel': local(() => { v.heroSel = value; }); break;
      case 'set-hero': a.setHero(value); break;
      case 'companion-sel': local(() => { v.companionSel = value; }); break;
      case 'toggle-companion': a.toggleCompanion(value); break;
      case 'upgrade-companion': a.upgradeCompanion(value); break;
      case 'open-tab': if (el.closest('#modal')) this.closeModal(); this.openTab(value); break;
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
      case 'dungeon-path-pre': local(() => { v.dungeonPath = value; }); break;
      case 'dungeon-path': a.setDungeonPath(value); break;
      case 'enter-dungeon': a.enterDungeon(value, v.dungeonSlot, v.dungeonPath, v.dungeonDiff ?? 'easy'); break;
      case 'dungeon-sel': local(() => { v.dungeonSel = value; v.dungeonDiff = null; }); break;
      case 'dungeon-diff': local(() => { v.dungeonDiff = value; }); break;
      case 'dungeon-filter': local(() => { v.dungeonFilter = value; }); break;
      case 'abandon-dungeon': a.abandonDungeon(); break;
      case 'claim-contract': a.claimContract(Number(value)); break;
      case 'claim-mission': { const [period, id] = value.split('|'); a.claimMission(period, id); break; }
      case 'claim-mission-bonus': a.claimMissionBonus(value); break;
      case 'claim-login': a.claimLogin(); break;
      case 'claim-all': a.claimAll(); break;
      case 'claim-achievement': a.claimAchievement(value); break;
      case 'map-zoom': local(() => { v.mapZoom = value === 'reset' ? 1 : Math.min(2.5, Math.max(0.5, (v.mapZoom ?? 1) * (value === 'in' ? 1.25 : 0.8))); }); break;
      case 'tree-zoom': local(() => {
        if (value === 'reset') recenterTree();
        v.treeZoom = value === 'reset' ? TREE_ZOOM : Math.min(2, Math.max(0.3, (v.treeZoom ?? TREE_ZOOM) * (value === 'in' ? 1.25 : 0.8)));
      }); break;
      case 'buy-talent-max': a.buyTalentMax(key); break;
      case 'buy-talents-all': a.buyTalentsAll(value || null); break;
      case 'buy-tperk': a.buyTranscendPerk(key); break;
      case 'buy-tperk-max': a.buyTranscendPerk(key, true); break;
      case 'transcend': this.showTranscendConfirm(this.state); break;
      case 'confirm-transcend': this.closeModal(); a.transcend(); break;
      case 'start-expedition': { const [cid, type] = value.split('|'); a.startExpedition(cid, type); break; }
      case 'claim-expedition': a.claimExpedition(Number(value)); break;
      case 'recall-expedition': a.recallExpedition(Number(value)); break;
      case 'enter-challenge': a.enterChallenge(); break;
      case 'leave-challenge': a.leaveChallenge(); break;
      case 'to-stash': a.toStash(id); break;
      case 'from-stash': a.fromStash(id); break;
      case 'stash-sel': local(() => { v.stashSel = id; }); break;
      case 'hero-tab': local(() => { v.heroTab = value; }); break;
      case 'set-class': a.setHeroClass(value); break;
      case 'open-summon-hero': local(() => { v.summonPool = 'hero'; }); this.openTab('summon'); break;
      case 'claim-bounty': a.claimBounty(); break;
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
      case 'toggle-section': local(() => { if (v.closed.has(value)) v.closed.delete(value); else v.closed.add(value); }); break;
      case 'claim-event': a.claimEvent(Number(value)); break;
      case 'buy-merchant': a.buyMerchant(Number(value)); break;
      case 'dismiss-event': a.dismissEvent(Number(value)); break;
      case 'save': a.saveNow(); break;
      case 'simulate': a.simulateAbsence(Number(seconds)); break;
      case 'reset': a.reset(); break;
      case 'close-modal': this.closeModal(); break;
      case 'show-shortcuts': this.showShortcuts(); break;
      case 'show-journal': this.showJournal(this.sessionJournal?.() ?? {}); break;
      case 'confirm-speed100': this.closeModal(); a.setSpeed(100); break;
      case 'window-size': a.setWindowSize(preset); break;
      case 'strip-menu': this.toggleMenu(MENUS.find((m) => m.tabs.includes(this.lastOpened))?.id ?? 'hero'); break;
      default: break;
    }
  }

  onChange(event) {
    const el = event.target;
    const action = el.dataset.action;
    if (action === 'sort') this.actions.setSort(el.value);
    if (action === 'auto') this.actions.setAutoAdvance(el.checked);
    if (action === 'on-top') this.actions.setAlwaysOnTop(el.checked);
    if (action === 'skill-auto') this.actions.setSkillAuto(el.checked);
    if (action === 'rush-auto') this.actions.setRushAuto(el.checked);
    if (action === 'volume') this.sound?.setVolume(el.dataset.kind, Number(el.value) / 100);
    if (action === 'mute') this.sound?.setMuted(el.checked);
    if (action === 'notify') this.actions.setNotify(el.dataset.key, el.checked);
    if (action === 'focus') this.actions.setFocus(el.checked);
    if (action === 'cinematics') this.actions.setCinematics(el.checked);
    if (action === 'theme-fx') this.actions.setThemeFx(el.checked);
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
        const rarity = rarityById(event.item.rarity);
        this.news(event.museum
          ? `${event.item.name} exposé au Musée`
          : event.mannequin
          ? `${event.item.name} rangé sur le mannequin « ${setById(event.item.set)?.name ?? ''} »`
          : event.byRule
          ? `Recyclé au ramassage : ${event.item.name} (+${formatNumber(event.recycledGold)} or)`
          : event.autoRecycled
            ? `Sac plein : ${event.item.name} recyclé (+${formatNumber(event.recycledGold)} or)`
            : `Butin : ${event.item.name} (${rarity.label})`, event.byRule ? '#8e9db8' : rarity.color);
        if (this.tab === 'inventory' || this.tab === 'hero') this.invalidate();
        if (event.mannequin || event.museum) break;
        if (!event.byRule && !event.autoRecycled) this.addLootPopup(event.item);
        else this.noteRecycled(1, event.recycledGold ?? 0);
        break;
      }
      case 'bossSummon':
        this.banner(`${BOSSES[event.master].name} invoque ${BOSSES[event.kind].name} !`, 'boss tier-hard');
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
        this.banner(`${label} — ${BOSSES[event.kind].name}`, `boss tier-${tier}`);
        if (tier === 'mega' || tier === 'hard') {
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
        this.banner(`Pouvoir ancestral : ${power.name}`, 'win');
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
        this.banner('Expédition échouée', 'lose');
        this.news(`Défaite ${event.bossHpPct !== null && event.bossHpPct !== undefined ? `face au boss final (encore ${formatNumber(event.bossHpPct)} % de PV)` : `en salle ${event.room}`}. Conservé : ${rewardText(event.earned, formatNumber) || 'rien'} — détails dans l'onglet Donjons.`);
        this.invalidate();
        break;
      case 'heroDeath':
        this.banner(`Vaincu… retour à l'étape ${stageLabel(event.to)}`, 'lose');
        this.news(state?.autoAdvance === false ? 'Mode farm : améliorez le chevalier puis appuyez sur « Avancer ».'
          : event.boss ? 'Le chevalier refarme l\'étape précédente et retentera le boss quand il sera 15 % plus fort (ou « Retenter le boss »).'
            : 'Le chevalier refait l\'étape précédente puis retente automatiquement.');
        if (this.tab === 'campaign') this.invalidate();
        break;
      default:
        break;
    }
  }

  // Pop-up des nouveaux objets (v8.5) : compte les objets ENCORE dans le sac (avant : chaque ramassage,
  // même recyclé ou fusionné ensuite → « +397 » avec un sac de 100). Le recyclage et la fusion
  // automatiques sont résumés à côté. Elle reste affichée jusqu'à l'ouverture de l'inventaire.
  addLootPopup(item) {
    if (this.tab === 'inventory' || this.state?.ui?.notify?.loot === false) return;
    const id = Number.parseInt(item.id.slice(2), 10) || 0;
    this.loot = this.loot ?? { sinceId: id, best: 'common', recycled: 0, recycledGold: 0, fused: 0, shown: -1 };
    if (rarityById(item.rarity).weight < rarityById(this.loot.best).weight) this.loot.best = item.rarity;
    this.loot.dirty = true;
  }

  noteRecycled(count, gold) {
    if (!this.loot || !count) return;
    this.loot.recycled += count;
    this.loot.recycledGold += gold;
    this.loot.dirty = true;
  }

  noteFused(count) {
    if (!this.loot || !count) return;
    this.loot.fused += count;
    this.loot.dirty = true;
  }

  // Au plus 4 fois par seconde (vitesse ×100 : des dizaines de butins par image).
  updateLootPopup(state) {
    const loot = this.loot;
    if (!loot?.dirty) return;
    const now = performance.now();
    if (now - (this.lastHud.lootAt ?? 0) < 250) return;
    this.lastHud.lootAt = now;
    loot.dirty = false;
    const count = newItemsInBag(state, loot.sinceId);
    const el = this.$('loot-pop');
    const extra = [loot.recycled ? `${formatNumber(loot.recycled)} recyclé${loot.recycled > 1 ? 's' : ''}` : '', loot.fused ? `${loot.fused} fusion${loot.fused > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
    if (!count && !extra) { el.className = 'hidden'; return; }
    el.className = `r-${loot.best}`;
    el.innerHTML = count
      ? `${img('icon_bag')}<span><b>+${count}</b> nouvel${count > 1 ? 's objets' : ' objet'} dans le sac${extra ? ` <small>· ${extra}</small>` : ''}</span>`
      : `${img('icon_bag')}<span>${extra} <small>(+${formatNumber(loot.recycledGold)} or)</small></span>`;
    el.title = `Sac : ${state.inventory.length}/${BALANCE.loot.inventorySize}. Cliquer pour ouvrir l'inventaire.`;
    if (count > loot.shown && now - (this.lastHud.lootBump ?? 0) > 1000) {
      this.lastHud.lootBump = now;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
    loot.shown = count;
  }

  clearLootPopup() {
    this.loot = null;
    this.$('loot-pop').className = 'hidden';
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
    this.setText('tickets', formatNumber(state.tickets));
    this.$('fragments-chip').classList.toggle('hidden', state.fragments <= 0 && state.records.rebirths === 0);
    this.setText('fragments', formatNumber(state.fragments));
    this.setText('dps', `${formatDecimal(stats.dps)}`);
    this.setText('hp', `${formatNumber(Math.max(0, world.hero.hp))}/${formatNumber(stats.maxHp)}`);
    this.setText('level-badge', `Niv. ${state.level}`);
    const xpRatio = state.xp / xpForLevel(state.level);
    if (Math.abs(xpRatio - (this.lastHud.xp ?? -1)) > 0.002) {
      this.$('xp-fill').style.width = `${Math.min(100, xpRatio * 100)}%`;
      this.$('top-xp').style.width = `${Math.min(100, xpRatio * 100)}%`;
      this.lastHud.xp = xpRatio;
    }
    this.setText('top-level', `Niv. ${state.level}`);
    this.setText('top-stage', state.challenge ? `Défi de la semaine · vague ${state.challenge.wave}` : state.tower ? `Tour de l'Éternité · étage ${state.tower.floor} · ⌛ ${formatDuration(towerTimeLeft(state))}` : state.dungeon ? `Donjon · ${dungeonById(state.dungeon.id)?.name ?? ''}` : `Étape ${stageLabel(state.stage)} · ${zoneForStage(state.stage).name}`);
    this.setText('auto-toggle', state.autoAdvance ? '⏵ Avance auto' : '⏸ Farm');
    this.speed = simSpeed(state);
    this.$('speed-toggle').classList.toggle('hidden', unlockedSpeeds(state).length < 2 && !state.cheats.skipBattle);
    this.root.classList.toggle('speed-max', simSpeed(state) >= 100);
    // v9.0.4 : particules et lueurs animées des thèmes coupées à ×100 ou par l'option « Effets animés »
    // (le mode concentration ne les coupait sans le dire).
    document.documentElement.classList.toggle('fx-calm', state.ui.themeFx === false || simSpeed(state) >= 100);
    this.$('speed-toggle').classList.toggle('fast', simSpeed(state) > 1);
    this.$('auto-toggle').classList.toggle('off', !state.autoAdvance);
    this.$('auto-toggle').classList.toggle('hidden', Boolean(state.dungeon || state.tower || state.challenge));

    this.updateZoneCard(state);
    this.updateProgress(state, world);
    this.$('advance-btn').classList.toggle('hidden', state.autoAdvance || Boolean(state.dungeon || state.tower || state.challenge));
    this.updateRetry(state);
    // v8.7 : sortie toujours visible quand on est dans la Tour, le défi ou un donjon.
    // v9.0.4 : boss réaffronté en boucle depuis le Codex → bouton pour reprendre la progression.
    const farm = !state.tower && !state.challenge && !state.dungeon && !state.autoAdvance && state.farmBoss && BOSSES[state.farmBoss];
    const mode = state.tower ? 'Quitter la Tour' : state.challenge ? 'Abandonner le défi' : state.dungeon ? 'Abandonner le donjon'
      : farm ? `Arrêter : ${BOSSES[state.farmBoss].name} en boucle` : '';
    this.$('leave-mode').classList.toggle('hidden', !mode);
    if (mode) this.setText('leave-mode', `⟲ ${mode}`);
    this.updateBadges(state);
    this.updateTabs(state);
    this.updateLootPopup(state);
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
      case 'companions': return `${Math.floor(Date.now() / 30000)}|${readyExpeditions(state)}`;
      case 'tower': return `${JSON.stringify(state.tower)}|${state.towerBest}`;
      // Achat « Max » : le nombre de niveaux abordables change avec l'or.
      case 'upgrades': return this.view.buyAmount === 'max' ? String(Math.floor(Math.log10(state.gold + 1) * 8)) : '';
      case 'skills': return `${state.level}|${Math.floor(state.xp)}|${Object.values(state.rushes.active).map(Math.ceil).join()}|${Object.values(state.rushes.cooldown).map((c) => Math.ceil(c / 10)).join()}`;
      case 'boss': return Object.values(state.powers).map((p) => `${p.victories}${p.charges}${p.pending}`).join();
      case 'hero': return `${state.level}|${Math.floor(state.xp / 5)}|${state.heroes.active}|${Object.keys(state.heroes.owned).length}`;
      case 'encyclopedia': return String(encyclopediaProgress(state).found);
      default: return '';
    }
  }

  setText(id, text) {
    if (this.lastHud[id] === text) return;
    this.lastHud[id] = text;
    this.$(id).textContent = text;
  }

  updateZoneCard(state) {
    const key = `${state.stage}|${state.maxStage}|${JSON.stringify(state.dungeon)}|${state.tower?.floor}|${state.challenge?.wave}`;
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
      this.$('zone-name').textContent = `Tour de l'Éternité · étage ${f}`;
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

  // Barre des boosts sur la scène (en haut à droite) : TOUS les boosts, avec leur touche (Q W E R T) ;
  // ceux pas encore débloqués sont grisés avec un cadenas. On les lance d'un clic (ou en mode Auto).
  updateRushBar(state) {
    const now = performance.now();
    if (now - (this.lastHud.rushTime ?? 0) < 200) return;
    this.lastHud.rushTime = now;
    const bar = this.$('rush-bar');
    const key = RUSHES.map((r) => (rushUnlocked(state, r) ? r.id : `-${r.id}`)).join();
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = `<span class="bar-label">Boosts</span>${RUSHES.map((r, i) => {
        const open = rushUnlocked(state, r);
        return `<button class="rush-btn${open ? '' : ' locked'}" data-action="rush" data-value="${r.id}" style="--rush:${r.color}"
          title="${r.name} — ${r.text}. ${open ? `Cliquer (ou touche ${BOOST_KEYS[i]}) pour l'activer.` : `Débloqué au niveau ${r.unlockLevel} du héros.`}">${img(r.icon)}
          <span class="rush-key">${BOOST_KEYS[i]}</span><span class="rush-time"></span>${open ? '' : `<img class="px rush-lock" src="${icon('icon_lock', 1)}" alt="">`}</button>`;
      }).join('')}`;
    }
    for (const btn of bar.querySelectorAll('.rush-btn')) {
      const rush = RUSHES.find((r) => r.id === btn.dataset.value);
      if (!rushUnlocked(state, rush)) continue;
      const active = state.rushes.active[rush.id] ?? 0;
      const cd = state.rushes.cooldown[rush.id] ?? 0;
      btn.classList.toggle('active', active > 0);
      btn.classList.toggle('ready', !active && !cd);
      btn.style.setProperty('--cd', active > 0 ? 0 : cd / rush.cooldown);
      btn.querySelector('.rush-time').textContent = active > 0 ? `${Math.ceil(active)}` : cd > 0 ? (cd >= 60 ? `${Math.ceil(cd / 60)}m` : `${Math.ceil(cd)}`) : '';
    }
  }

  // Barre des compétences sur la scène (en haut à gauche, sous le monde) : elles se lancent TOUTES SEULES
  // dès qu'un ennemi est à portée ; le cadran montre leur recharge. Un clic ouvre l'onglet Compétences.
  updateSkillBar(state, world) {
    const now = performance.now();
    if (now - (this.lastHud.skillTime ?? 0) < 200) return;
    this.lastHud.skillTime = now;
    const bar = this.$('skill-bar');
    if (!bar) return;
    const key = `${SKILLS.map((sk) => state.skills[sk.id] ?? 0).join()}|${state.skillAuto}`;
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = `<span class="bar-label">Compétences${state.skillAuto ? '' : ' (pause)'}</span>${SKILLS.map((sk) => {
        const lv = state.skills[sk.id] ?? 0;
        return `<button class="skill-btn${lv ? '' : ' locked'}" data-action="open-tab" data-value="skills" data-skill="${sk.id}"
          title="${sk.name}${lv ? ` (niv. ${lv}) — se lance toute seule toutes les ${sk.cooldown} s environ` : ' — pas encore apprise (onglet Compétences)'}">${img(sk.icon)}
          ${lv ? '' : `<img class="px rush-lock" src="${icon('icon_lock', 1)}" alt="">`}</button>`;
      }).join('')}`;
    }
    const bonus = (world.heroStats ?? computeHeroStats(state)).bonus;
    for (const btn of bar.querySelectorAll('.skill-btn:not(.locked)')) {
      const sk = SKILLS.find((x) => x.id === btn.dataset.skill);
      const left = Math.max(0, world.skillTimers?.[sk.id] ?? 0);
      const total = skillCooldown(sk, bonus);
      btn.style.setProperty('--cd', Math.min(1, left / total));
      btn.classList.toggle('ready', left <= 0.05);
    }
  }

  updateBadges(state) {
    const now = performance.now();
    if (now - (this.lastHud.badgeTime ?? 0) < 500) return;
    this.lastHud.badgeTime = now;
    const current = computeHeroStats(state);
    const upgrade = state.inventory.some((i) => isUpgrade(state, i, undefined, current));
    // v9.0.6 : pastilles par sous-onglet, regroupées sur le bouton de leur menu.
    const contractsReady = state.contracts.some((c) => c.progress >= c.target) || missionsClaimable(state) || claimableAchievements(state).length > 0 || bountyReady(state);
    // Rouge (sur le menu) : seulement une récompense à récupérer. Or (sur le sous-onglet seulement) : une
    // suggestion utile — objet meilleur, points de compétence.
    this.tabBadges = {
      companions: readyExpeditions(state) > 0, encyclopedia: Boolean(encyclopediaNext(state)?.ready),
      boss: collectionsClaimable(state), contracts: contractsReady, inbox: state.inbox.some((e) => !e.seen),
    };
    this.tabHints = { inventory: upgrade, skills: skillPointsAvailable(state) >= 1 };
    for (const menu of MENUS) {
      const on = menu.tabs.some((t) => this.tabBadges[t] && this.tabVisible[t] !== false && t !== this.tab);
      this.$(`badge-${menu.id}`)?.classList.toggle('hidden', !on);
    }
    this.$('contracts-badge').classList.toggle('hidden', !contractsReady);
    this.$('inbox-badge').classList.toggle('hidden', !this.tabBadges.inbox || this.tab === 'inbox');
    if (this.tab) this.renderSubtabs();
    const boost = earlyBoost(state);
    const active = boost.secondsLeft > 0 || boost.weekend || boost.cheat > 1;
    this.$('boost-chip').classList.toggle('hidden', !active);
    if (active) {
      const dur = (sec) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
      };
      // v8.8 : très grands multiplicateurs en notation 1e60 (« ×1 ap » était illisible) ; ×1e60 = plafond des codes.
      const mult = (n) => (n >= 1e15 ? `${n.toExponential(1).replace('e+', 'e').replace('.', ',')}${boost.cheat >= 1e60 ? ' (max)' : ''}` : n >= 1000 ? formatNumber(n) : n.toFixed(1).replace('.', ','));
      const parts = [`×${mult(boost.gold)}`];
      if (boost.secondsLeft > 0) parts.push(dur(boost.secondsLeft));
      if (boost.weekend) parts.push('Week-end');
      if (boost.cheat > 1) parts.push('Code');
      this.$('boost').textContent = parts.join(' · ');
      const early = boost.gold / (boost.weekend ? 2 : 1) / (boost.cheat ?? 1);
      this.$('boost-chip').title = [
        `Bonus total ×${mult(boost.gold)} sur l'or et l'XP =`,
        boost.secondsLeft > 0 ? `démarrage rapide ×${early.toFixed(1).replace('.', ',')} (×3 au début, diminue jusqu'à ×1 au bout de 5 h de jeu ; encore ${dur(boost.secondsLeft)})` : '',
        boost.weekend ? `× week-end ×2 (samedi et dimanche ; encore ${dur(boost.weekendSecondsLeft)})` : '',
        boost.cheat > 1 ? `× code ×${mult(boost.cheat)} (jusqu'à ce que vous le retiriez, Paramètres)` : '',
      ].filter(Boolean).join(' ');
    }
  }

  // Menus débloqués progressivement.
  updateTabs(state) {
    const visible = {
      companions: Object.keys(state.companions.owned).length > 0 || state.records.bossesDefeated > 0,
      // v7.7 : déblocages plus tôt et plus prévisibles (identiques d'une partie à l'autre).
      tree: state.maxStage >= 10 || state.fragments > 0 || state.records.rebirths > 0 || (state.prestige?.count ?? 0) > 0,
      dungeons: state.maxStage >= DUNGEONS[0].unlockStage - 10 || Object.keys(state.dungeonsCleared).length > 0,
      boss: state.records.bossesDefeated > 0 || Object.keys(state.powers).length > 0,
      tower: towerUnlocked(state) || (state.towerBest ?? 0) > 0,
      encyclopedia: state.records.kills > 0 || Object.keys(state.codex.kills).length > 0,
    };
    const key = `${JSON.stringify(visible)}|${this.tab}|${[...this.newTabs].join()}`;
    if (this.lastHud.tabs === key) return;
    const firstPass = this.lastHud.tabsInit === undefined;
    this.lastHud.tabsInit = true;
    this.lastHud.tabs = key;
    // v9.0.6 : un sous-onglet qui se débloque marque son menu « nouveau » ; un menu sans aucun sous-onglet
    // disponible est caché.
    for (const [tab, show] of Object.entries(visible)) {
      if (show && this.tabVisible[tab] === false && !firstPass && this.tab !== tab) this.newTabs.add(tab);
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
    const help = this.view.helpOpen === this.tab && PANEL_HELP[this.tab]
      ? `<div class="card panel-help-card"><b>Comment ça marche ?</b> ${PANEL_HELP[this.tab]}</div>` : '';
    body.innerHTML = help + panel.render(this, state);
    body.scrollTop = scroll;
    if (focused) {
      const again = (focusSel && body.querySelector(focusSel)) || focusables(this)[focusIndex];
      again?.focus({ preventScroll: true });
    }
    for (const [cls, i, top] of inner) {
      const el = body.getElementsByClassName(cls.split(' ')[0])[i];
      if (el) el.scrollTop = top;
    }
    panel.afterRender?.(this, body);
    this.lastHud.extra = panel.extra ? panel.extra(this, state) : '';
    this.$('panel-extra').innerHTML = this.lastHud.extra;
    this.lastHud.live = this.liveKey(state);
    this.dirty = false;
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
      btn.disabled = !chargesOk || have[btn.dataset.currency ?? 'gold'] < Number(btn.dataset.cost);
    });
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
    if (!stars) return;
    this.$('modal-card').innerHTML = `<h2>✧ Transcendance</h2>
      <p>Vous gagnerez <b class="gold-text">+${formatNumber(stars)} Étoiles</b> et dégâts, PV et or <b>×${TRANSCEND.powerPerTranscend}</b> pour toujours.</p>
      <p>Tout repart de l'étape 1 : Renaissances (${Math.round(keptRebirthShare(state) * 100)} % conservées), arbre de talents et fragments anciens
        sont remis à zéro. L'équipement, les compagnons, les gemmes et les bonus éternels sont conservés.</p>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-gold" data-action="confirm-transcend">Transcender</button></div>`;
    this.$('modal').classList.remove('hidden');
  }

  showRespecConfirm(state) {
    const cost = respecCost(state);
    this.$('modal-card').innerHTML = `<h2>Réinitialiser l'arbre de talents</h2>
      <p>Tous les talents sont oubliés et les <b class="gold-text">${formatNumber(fragmentsSpent(state))} fragments</b> investis vous sont rendus.</p>
      <p class="muted">${cost ? `Coût : ${formatNumber(cost)} gemmes.` : 'La première réinitialisation est gratuite (les suivantes coûtent des gemmes).'}</p>
      <div class="detail-actions"><button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-danger" data-action="confirm-respec">Réinitialiser</button></div>`;
    this.$('modal').classList.remove('hidden');
  }

  showRebirthConfirm(state) {
    if (!canRebirth(state)) return;
    this.$('modal-card').innerHTML = `<h2>Renaissance</h2>
      <p>Vous gagnerez <b class="gold-text">+${rebirthReward(state)} fragments anciens</b> à investir dans l'arbre de talents.</p>
      ${keepResetLists()}
      ${powerChoice(state)}
      <p><b class="good">Après cette Renaissance : dégâts, PV et or ×${String(PRESTIGE.rebirthMultiplier).replace('.', ',')} pour toujours</b> (cumulatif).</p>
      <p class="muted">Les boss ne se renforcent que de ${BALANCE.stages.rebirthBossPct} % par Renaissance, et leurs récompenses augmentent.</p>
      <div class="detail-actions">
        <button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-gold" data-action="confirm-rebirth">Confirmer la Renaissance</button>
      </div>`;
    this.$('modal').classList.remove('hidden');
  }

  // Journal (v8.5) : session en cours (touche J, Paramètres) ou absence (retour après au moins 5 min).
  showJournal(summary, kind = 'session') {
    this.$('modal-card').innerHTML = `<h2>📜 ${kind === 'away' ? 'Pendant votre absence' : 'Journal de la session'}</h2>
      <p class="muted">${kind === 'away' ? 'Fenêtre réduite pendant' : 'Jeu lancé depuis'} ${formatDuration(summary.seconds)}.</p>
      ${journalHtml(summary)}
      <div class="detail-actions"><button class="btn btn-primary" data-action="close-modal">Continuer</button></div>`;
    this.$('modal').classList.remove('hidden');
  }

  // --- Retour hors ligne ---
  showOffline(summary, journal = null) {
    const card = this.$('modal-card');
    if (summary.clockSuspicious) {
      card.innerHTML = `<h2>Horloge incohérente</h2>
        <p>L'heure de l'ordinateur est antérieure à la dernière sauvegarde. Aucun gain hors ligne n'a été appliqué.</p>
        <button class="btn btn-primary" data-action="close-modal">Continuer</button>`;
    } else {
      // Rapport de retour : les objets Épiques et Légendaires sont mis en avant.
      const rare = summary.items.filter((i) => i.rarity === 'epic' || i.rarity === 'legendary');
      const items = summary.items.filter((i) => !rare.includes(i)).map((i) => itemFrame(i, { tag: 'div' })).join('');
      const rareItems = rare.map((i) => itemFrame(i, { tag: 'div' })).join('');
      const mats = summary.materials ?? {};
      const recycled = summary.excessDrops + summary.autoRecycledCount;
      card.innerHTML = `<h2>Bon retour, chevalier !</h2>
        <p>Absence : <b>${formatDuration(summary.elapsedSeconds)}</b>${summary.capped ? ` <span class="muted">(gains limités à ${BALANCE.offline.capHours} h)</span>` : ''}</p>
        <p>Or gagné : <b class="gold-text">+${formatNumber(summary.totalGold)}</b> ${coin()}</p>
        <p>Expérience : <b>+${formatNumber(summary.xp)}</b>${summary.levelsGained ? ` · <b class="good">+${summary.levelsGained} niveau${summary.levelsGained > 1 ? 'x' : ''}</b>` : ''}</p>
        <p>Ennemis vaincus : ~${formatNumber(summary.kills)} · Objets : ${summary.items.length - summary.autoRecycledCount}
          ${recycled ? `<span class="muted">(+${recycled} convertis en or)</span>` : ''}</p>
        ${rareItems ? `<div class="offline-rare"><b class="gold-text">★ Objets rares obtenus</b><div class="loot-row">${rareItems}</div></div>` : ''}
        ${items ? `<div class="loot-row">${items}</div>` : ''}
        ${mats.shards || mats.essence ? `<p>Matériaux : ${mats.shards ? `+${formatNumber(mats.shards)} éclats` : ''}${mats.shards && mats.essence ? ' · ' : ''}${mats.essence ? `+${formatNumber(mats.essence)} essences` : ''}</p>` : ''}
        <p>Contrats et missions : <b>+${formatNumber(summary.kills)}</b> monstres comptés.</p>
        ${summary.paused === 'tower' ? '<p class="bad">Vous étiez dans la Tour de l\'Éternité : elle ne progresse pas hors ligne (l\'ascension reprend à votre retour).</p>' : ''}
        ${summary.paused === 'challenge' ? '<p class="bad">Vous étiez dans le défi de la semaine : il ne progresse pas hors ligne (la tentative reprend à votre retour).</p>' : ''}
        ${summary.paused === 'dungeon' ? '<p class="bad">Vous étiez dans un donjon : il ne progresse pas hors ligne (l\'expédition reprend à votre retour).</p>' : ''}
        ${journal ? `<div class="section-title">Avant de passer hors ligne</div>${journalHtml(journal)}` : ''}
        <p class="muted">Hors ligne, le chevalier farme l'étape ${stageLabel(summary.stage)} (la meilleure qu'il peut vraiment farmer) à ${BALANCE.offline.farmMultiplier * 100} % de son rythme actif, sans avancer
          et sans affronter de boss (ils se battent en jeu).</p>
        <button class="btn btn-primary" data-action="close-modal">Continuer</button>`;
    }
    this.$('modal').classList.remove('hidden');
  }

  closeModal() {
    this.$('modal').classList.add('hidden');
  }
}
