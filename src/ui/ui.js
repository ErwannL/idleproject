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
import { canRebirth, rebirthReward } from '../core/rebirth.js';
import { rewardText } from '../core/rewards.js';
import { skillPointsAvailable } from '../core/skills.js';
import { computeHeroStats } from '../core/stats.js';
import { coin, effectText, icon, img, itemFrame } from './common.js';
import boss from './panels/boss.js';
import campaign from './panels/campaign.js';
import companions from './panels/companions.js';
import contracts from './panels/contracts.js';
import dungeons from './panels/dungeons.js';
import hero from './panels/hero.js';
import inbox from './panels/inbox.js';
import inventory, { visibleItems } from './panels/inventory.js';
import options from './panels/options.js';
import skills from './panels/skills.js';
import summon from './panels/summon.js';
import tree, { keepResetLists } from './panels/tree.js';
import upgrades from './panels/upgrades.js';
import { missionsClaimable } from '../core/missions.js';
import { earlyBoost } from '../core/boost.js';
import { RUSHES } from '../data/rushes.js';
import { rushUnlocked } from '../core/rushes.js';
import { dungeonById } from '../core/dungeon.js';

const PANELS = Object.fromEntries([upgrades, inventory, hero, companions, skills, tree, campaign, dungeons, boss, summon, contracts, inbox, options]
  .map((p) => [p.id, p]));
const TAB_MIN_WIDTH = 60; // en dessous, seuls les icônes (et le libellé de l'onglet actif) sont affichés
const TALL_MIN_HEIGHT = 420;
const STRIP_MAX_HEIGHT = 190; // en dessous : mode barre (seulement la scène, comme une barre des tâches)
const BULK_CONFIRM_MS = 4000;
// Panneaux dont le contenu évolue pendant le farm : réaffichés au plus une fois par seconde.
const LIVE_PANELS = new Set(['contracts', 'dungeons', 'skills', 'boss', 'hero', 'upgrades']);

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

const RENDER_THROTTLE_MS = 1000;
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
    this.view = {
      closed: new Set(['weekly', 'monthly']), // sections repliées (missions…)
      upgradeCat: 'combat', invTab: 'bag', selectedItemId: null, bulkRarity: 'common', bulkArmed: false,
      heroSel: null, companionSel: null, talentSel: null, zoneSel: null, dungeonSlot: 'any', dungeonPath: 'gold',
      oddsOpen: new Set(), lastSummon: null,
    };

    root.querySelectorAll('img[data-icon]').forEach((el) => { el.src = icon(el.dataset.icon); });
    if (!window.desktop) root.querySelector('.strip-btn')?.remove(); // agrandir la fenêtre : version bureau seulement
    root.querySelectorAll('#tabs button').forEach((btn) => btn.addEventListener('click', () => this.toggleTab(btn.dataset.tab)));
    root.querySelectorAll('[data-open]').forEach((btn) => btn.addEventListener('click', () => this.toggleTab(btn.dataset.open)));
    this.$('panel-close').addEventListener('click', () => this.closePanel());
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('change', (e) => this.onChange(e));
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!this.$('modal').classList.contains('hidden')) this.closeModal();
      else this.closePanel();
    });
    new ResizeObserver(() => this.updateLayout()).observe(root);
    this.updateLayout();
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
      const tabsTop = this.$('tabs').getBoundingClientRect().top - rootTop;
      this.root.style.setProperty('--panel-top', `${Math.round(top)}px`);
      this.root.style.setProperty('--panel-bottom', `${Math.round(h - tabsTop)}px`);
    }
    this.lastHud.tabs = null;
  }

  // Aucun onglet ouvert par défaut : un clic ouvre l'onglet, un second clic le referme.
  toggleTab(tab) {
    this.userAt = performance.now();
    if (this.tab === tab) this.closePanel();
    else this.openTab(tab);
  }

  openTab(tab) {
    if (!PANELS[tab]) return;
    if (tab === 'inventory') this.clearLootPopup();
    this.tab = tab;
    this.view.bulkArmed = false;
    this.newTabs.delete(tab);
    this.$('panel').classList.remove('hidden');
    this.root.classList.add('panel-open');
    this.$('panel-title').textContent = PANELS[tab].title;
    this.$('panel-icon').src = icon(PANELS[tab].icon);
    this.root.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    this.root.querySelectorAll('[data-open]').forEach((b) => b.classList.toggle('active', b.dataset.open === tab));
    this.lastHud.tabs = null;
    this.invalidate();
  }

  closePanel() {
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
      case 'advance': a.advance(); break;
      case 'toggle-auto': a.setAutoAdvance(!this.state.autoAdvance); break;
      case 'learn-skill': a.learnSkill(key); break;
      case 'hero-sel': local(() => { v.heroSel = value; }); break;
      case 'set-hero': a.setHero(value); break;
      case 'companion-sel': local(() => { v.companionSel = value; }); break;
      case 'toggle-companion': a.toggleCompanion(value); break;
      case 'upgrade-companion': a.upgradeCompanion(value); break;
      case 'open-tab': this.openTab(value); break;
      case 'summon': v.lastSummon = a.summon(Number(value), currency, el.dataset.pool) ?? v.lastSummon; this.invalidate(); break;
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
      case 'boss-sel': local(() => { v.bossSel = value; }); break;
      case 'recycle-toggle': a.setRecycleRule(el.dataset.group, value); break;
      case 'mission-tab': local(() => { v.missionTab = value; }); break;
      case 'lang': a.setLanguage(value); break;
      case 'speed': a.cycleSpeed(); break;
      case 'check-update': a.checkUpdate(); break;
      case 'install-update': a.installUpdate(); break;
      case 'open-releases': a.openReleases(); break;
      case 'cheat': a.cheat(this.$('cheat-code')?.value); break;
      case 'rush': a.activateRush(value); break;
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
      case 'map-zoom': local(() => { v.mapZoom = value === 'reset' ? 1 : Math.min(2.5, Math.max(0.5, (v.mapZoom ?? 1) * (value === 'in' ? 1.25 : 0.8))); }); break;
      case 'tree-zoom': local(() => { v.treeZoom = value === 'reset' ? 1 : Math.min(2.5, Math.max(0.5, (v.treeZoom ?? 1) * (value === 'in' ? 1.25 : 0.8))); }); break;
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
      case 'window-size': a.setWindowSize(preset); break;
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
    if (action === 'auto-recycle') this.actions.setAutoRecycle(el.value);
    if (action === 'recycle-mode') this.actions.setRecycleRule('mode', el.value);
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
        this.news(event.byRule
          ? `Recyclé au ramassage : ${event.item.name} (+${formatNumber(event.recycledGold)} or)`
          : event.autoRecycled
            ? `Sac plein : ${event.item.name} recyclé (+${formatNumber(event.recycledGold)} or)`
            : `Butin : ${event.item.name} (${rarity.label})`, event.byRule ? '#8e9db8' : rarity.color);
        if (this.tab === 'inventory' || this.tab === 'hero') this.invalidate();
        if (!event.byRule && !event.autoRecycled) this.addLootPopup(event.item);
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
      case 'dungeonFailed':
        this.banner('Expédition échouée', 'lose');
        this.news(`Défaite dans le donjon. Conservé : ${rewardText(event.earned, formatNumber) || 'rien'}`);
        this.invalidate();
        break;
      case 'heroDeath':
        this.banner(`Vaincu… retour à l'étape ${stageLabel(event.to)}`, 'lose');
        this.news('Mode farm : améliorez le chevalier puis appuyez sur « Avancer ».');
        if (this.tab === 'campaign') this.invalidate();
        break;
      default:
        break;
    }
  }

  // Pop-up « N nouveaux objets » : reste affichée jusqu'à l'ouverture de l'inventaire (clic dessus).
  addLootPopup(item) {
    if (this.tab === 'inventory' || this.state?.ui?.notify?.loot === false) return;
    this.loot = this.loot ?? { count: 0, best: 'common' };
    this.loot.count += 1;
    if (rarityById(item.rarity).weight < rarityById(this.loot.best).weight) this.loot.best = item.rarity;
    const el = this.$('loot-pop');
    el.className = `r-${this.loot.best}`;
    el.innerHTML = `${img('icon_bag')}<span><b>+${this.loot.count}</b> nouvel${this.loot.count > 1 ? 's objets' : ' objet'} dans l'inventaire</span>`;
    void el.offsetWidth;
    el.classList.add('bump');
  }

  clearLootPopup() {
    this.loot = null;
    this.$('loot-pop').className = 'hidden';
  }

  news(text, color = null) {
    const el = this.$('news-text');
    el.textContent = text;
    el.style.color = color ?? '';
    el.parentElement.classList.remove('flash');
    void el.offsetWidth; // relance l'animation CSS
    el.parentElement.classList.add('flash');
  }

  // Les actions de main.js signalent leurs résultats par un message court dans le fil.
  toast(text, color = null) {
    this.news(text, color);
  }

  banner(text, kind) {
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
    this.setText('top-stage', state.dungeon ? `Donjon · ${dungeonById(state.dungeon.id)?.name ?? ''}` : `Étape ${stageLabel(state.stage)} · ${zoneForStage(state.stage).name}`);
    this.setText('auto-toggle', state.autoAdvance ? '⏵ Avance auto' : '⏸ Farm');
    this.setText('speed-toggle', `⏩ ×${state.ui.speed ?? 1}`);
    this.$('speed-toggle').classList.toggle('fast', (state.ui.speed ?? 1) > 1);
    this.$('auto-toggle').classList.toggle('off', !state.autoAdvance);
    this.$('auto-toggle').classList.toggle('hidden', Boolean(state.dungeon));

    this.updateZoneCard(state);
    this.updateProgress(state, world);
    this.$('advance-btn').classList.toggle('hidden', state.autoAdvance || Boolean(state.dungeon));
    this.updateBadges(state);
    this.updateTabs(state);

    const now0 = performance.now();
    const userRecent = now0 - this.userAt < 400;
    const focus = document.activeElement;
    const busy = this.pointerDown || (focus && focus.tagName === 'SELECT' && this.$('panel-body').contains(focus));
    if (this.dirty && this.tab && !this.pointerDown && (userRecent || (!busy && now0 - this.lastRender >= RENDER_THROTTLE_MS))) {
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
      case 'dungeons': return JSON.stringify(state.dungeon);
      // Achat « Max » : le nombre de niveaux abordables change avec l'or.
      case 'upgrades': return this.view.buyAmount === 'max' ? String(Math.floor(Math.log10(state.gold + 1) * 8)) : '';
      case 'skills': return `${state.level}|${Math.floor(state.xp)}`;
      case 'boss': return Object.values(state.powers).map((p) => `${p.victories}${p.charges}${p.pending}`).join();
      case 'hero': return `${state.level}|${Math.floor(state.xp / 5)}`;
      default: return '';
    }
  }

  setText(id, text) {
    if (this.lastHud[id] === text) return;
    this.lastHud[id] = text;
    this.$(id).textContent = text;
  }

  updateZoneCard(state) {
    const key = `${state.stage}|${state.maxStage}|${JSON.stringify(state.dungeon)}`;
    if (this.lastHud.zone === key) return;
    this.lastHud.zone = key;
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
      const kills = state.dungeon ? state.dungeon.kills : state.kills;
      ratio = kills / enc.killsNeeded;
      text = state.dungeon
        ? `Salle ${state.dungeon.room}/${enc.dungeon.rooms} · ${kills}/${enc.killsNeeded}`
        : `Ennemis vaincus ${kills}/${enc.killsNeeded}`;
    }
    if (ratio !== this.lastHud.ratio) {
      this.$('progress-fill').style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
      this.lastHud.ratio = ratio;
    }
    this.setText('progress-text', text);
  }

  // Barre des boosts sur la scène : icône, recharge (cadran) et temps restant quand actif.
  updateRushBar(state) {
    const now = performance.now();
    if (now - (this.lastHud.rushTime ?? 0) < 200) return;
    this.lastHud.rushTime = now;
    const bar = this.$('rush-bar');
    const unlocked = RUSHES.filter((r) => rushUnlocked(state, r));
    const key = unlocked.map((r) => r.id).join();
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = unlocked.map((r) => `<button class="rush-btn" data-action="rush" data-value="${r.id}" style="--rush:${r.color}"
        title="${r.name} — ${r.text}. Cliquer pour activer.">${img(r.icon)}<span class="rush-time"></span></button>`).join('');
    }
    for (const btn of bar.children) {
      const rush = RUSHES.find((r) => r.id === btn.dataset.value);
      const active = state.rushes.active[rush.id] ?? 0;
      const cd = state.rushes.cooldown[rush.id] ?? 0;
      btn.classList.toggle('active', active > 0);
      btn.classList.toggle('ready', !active && !cd);
      btn.style.setProperty('--cd', active > 0 ? 0 : cd / rush.cooldown);
      btn.querySelector('.rush-time').textContent = active > 0 ? `${Math.ceil(active)}` : cd > 0 ? (cd >= 60 ? `${Math.ceil(cd / 60)}m` : `${Math.ceil(cd)}`) : '';
    }
  }

  updateBadges(state) {
    const now = performance.now();
    if (now - (this.lastHud.badgeTime ?? 0) < 500) return;
    this.lastHud.badgeTime = now;
    const current = computeHeroStats(state);
    const upgrade = state.inventory.some((i) => isUpgrade(state, i, undefined, current));
    this.$('inv-badge').classList.toggle('hidden', !upgrade || this.tab === 'inventory');
    this.$('skills-badge').classList.toggle('hidden', skillPointsAvailable(state) < 1 || this.tab === 'skills');
    this.$('contracts-badge').classList.toggle('hidden', !state.contracts.some((c) => c.progress >= c.target) && !missionsClaimable(state));
    this.$('inbox-badge').classList.toggle('hidden', !state.inbox.some((e) => !e.seen) || this.tab === 'inbox');
    const boost = earlyBoost(state);
    const active = boost.secondsLeft > 0 || boost.weekend || boost.cheat > 1;
    this.$('boost-chip').classList.toggle('hidden', !active);
    if (active) {
      const dur = (sec) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
      };
      const parts = [`×${boost.gold.toFixed(1).replace('.', ',')}`];
      if (boost.secondsLeft > 0) parts.push(dur(boost.secondsLeft));
      if (boost.weekend) parts.push('Week-end');
      if (boost.cheat > 1) parts.push(`Code ${dur(boost.cheatSecondsLeft)}`);
      this.$('boost').textContent = parts.join(' · ');
      const early = boost.gold / (boost.weekend ? 2 : 1) / (boost.cheat ?? 1);
      this.$('boost-chip').title = [
        `Bonus total ×${boost.gold.toFixed(1).replace('.', ',')} sur l'or et l'XP =`,
        boost.secondsLeft > 0 ? `démarrage rapide ×${early.toFixed(1).replace('.', ',')} (×3 au début, diminue jusqu'à ×1 au bout de 5 h de jeu ; encore ${dur(boost.secondsLeft)})` : '',
        boost.weekend ? `× week-end ×2 (samedi et dimanche ; encore ${dur(boost.weekendSecondsLeft)})` : '',
        boost.cheat > 1 ? `× code ×${boost.cheat} (encore ${dur(boost.cheatSecondsLeft)})` : '',
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
    };
    const key = `${JSON.stringify(visible)}|${this.root.clientWidth}|${this.tab}|${[...this.newTabs].join()}`;
    if (this.lastHud.tabs === key) return;
    const firstPass = this.lastHud.tabsInit === undefined;
    this.lastHud.tabsInit = true;
    this.lastHud.tabs = key;
    for (const [tab, show] of Object.entries(visible)) {
      const btn = this.root.querySelector(`#tabs button[data-tab="${tab}"]`);
      if (show && btn.classList.contains('hidden') && !firstPass && this.tab !== tab) this.newTabs.add(tab);
      btn.classList.toggle('hidden', !show);
    }
    this.newTabs.delete(this.tab);
    this.root.querySelectorAll('#tabs button').forEach((b) => {
      b.querySelector('.badge-new')?.classList.toggle('hidden', !this.newTabs.has(b.dataset.tab));
    });
    const count = this.root.querySelectorAll('#tabs button:not(.hidden)').length;
    this.$('tabs').classList.toggle('tabs-compact', count * TAB_MIN_WIDTH > this.$('tabs').clientWidth);
  }

  renderPanel(state) {
    const panel = PANELS[this.tab];
    const body = this.$('panel-body');
    this.lastRender = performance.now();
    const scroll = body.scrollTop;
    // Les zones défilantes internes (liste d'inventaire, fiche…) gardent aussi leur position.
    const inner = [...body.querySelectorAll('[class]')].filter((el) => el.scrollTop > 0)
      .map((el) => [el.className, [...body.getElementsByClassName(el.classList[0])].indexOf(el), el.scrollTop]);
    body.innerHTML = panel.render(this, state);
    body.scrollTop = scroll;
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
      shards: state.materials.shards, essence: state.materials.essence,
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

  showRebirthConfirm(state) {
    if (!canRebirth(state)) return;
    this.$('modal-card').innerHTML = `<h2>Renaissance</h2>
      <p>Vous gagnerez <b class="gold-text">+${rebirthReward(state)} fragments anciens</b> à investir dans l'arbre de talents.</p>
      ${keepResetLists()}
      ${powerChoice(state)}
      <p class="muted">Les boss s'adapteront : plus durs, mais leurs récompenses augmentent à chaque Renaissance.</p>
      <div class="detail-actions">
        <button class="btn" data-action="close-modal">Annuler</button>
        <button class="btn btn-gold" data-action="confirm-rebirth">Confirmer la Renaissance</button>
      </div>`;
    this.$('modal').classList.remove('hidden');
  }

  // --- Retour hors ligne ---
  showOffline(summary) {
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
        <p class="muted">Hors ligne, le chevalier farme l'étape ${stageLabel(summary.stage)} à ${BALANCE.offline.farmMultiplier * 100} % de son rythme actif, sans avancer
          et sans affronter de boss (ils se battent en jeu).</p>
        <button class="btn btn-primary" data-action="close-modal">Continuer</button>`;
    }
    this.$('modal').classList.remove('hidden');
  }

  closeModal() {
    this.$('modal').classList.add('hidden');
  }
}
