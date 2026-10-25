// Interface DOM : barre du haut (monnaies, contrats, récompenses, paramètres), surimpressions légères
// de la scène, HUD, onglets débloqués progressivement et panneaux (un module par panneau dans ./panels).
// L'interface ne modifie jamais l'état directement : elle appelle les actions fournies par main.js.
import { BALANCE } from '../data/balance.js';
import { BOSSES } from '../data/enemies.js';
import { DUNGEONS } from '../data/dungeons.js';
import { currentEncounter, isBossStage, stageLabel, zoneForStage, zoneIndexForStage } from '../core/combat.js';
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
import { coin, effectText, icon, itemFrame } from './common.js';
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

const PANELS = Object.fromEntries([upgrades, inventory, hero, companions, skills, tree, campaign, dungeons, boss, summon, contracts, inbox, options]
  .map((p) => [p.id, p]));
const TAB_MIN_WIDTH = 60; // en dessous, seuls les icônes (et le libellé de l'onglet actif) sont affichés
const TALL_MIN_HEIGHT = 420;
const BULK_CONFIRM_MS = 4000;
// Panneaux dont le contenu évolue pendant le farm : réaffichés au plus une fois par seconde.
const LIVE_PANELS = new Set(['contracts', 'dungeons', 'skills', 'boss', 'hero']);

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
    this.view = {
      upgradeCat: 'combat', invTab: 'bag', selectedItemId: null, bulkRarity: 'common', bulkArmed: false,
      heroSel: null, companionSel: null, talentSel: null, zoneSel: null, dungeonSlot: 'any', dungeonPath: 'gold',
      oddsOpen: new Set(), lastSummon: null,
    };

    root.querySelectorAll('img[data-icon]').forEach((el) => { el.src = icon(el.dataset.icon); });
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
    const layout = h >= TALL_MIN_HEIGHT ? 'tall' : 'mini';
    if (layout !== this.layout) {
      this.root.classList.remove('layout-mini', 'layout-tall');
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
    if (this.tab === tab) this.closePanel();
    else this.openTab(tab);
  }

  openTab(tab) {
    if (!PANELS[tab]) return;
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
      case 'buy': a.buy(key); break;
      case 'upgrade-cat': local(() => { v.upgradeCat = value; }); break;
      case 'inv-tab': local(() => { v.invTab = value; }); break;
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
      case 'reforge': a.reforge(id); break;
      case 'craft': a.craft(value); break;
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
      case 'summon': v.lastSummon = a.summon(Number(value), currency) ?? v.lastSummon; this.invalidate(); break;
      case 'talent-sel': local(() => { v.talentSel = value; }); break;
      case 'buy-talent': a.buyTalent(key); break;
      case 'rebirth': this.showRebirthConfirm(this.state); break;
      case 'confirm-rebirth': this.closeModal(); a.rebirth(); break;
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
      case 'enter-dungeon': a.enterDungeon(value, v.dungeonSlot, v.dungeonPath); break;
      case 'abandon-dungeon': a.abandonDungeon(); break;
      case 'claim-contract': a.claimContract(Number(value)); break;
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
        this.news(event.autoRecycled
          ? `Sac plein : ${event.item.name} recyclé (+${formatNumber(event.recycledGold)} or)`
          : `Butin : ${event.item.name} (${rarity.label})`, rarity.color);
        if (this.tab === 'inventory' || this.tab === 'hero') this.invalidate();
        break;
      }
      case 'bossSpawn':
        this.banner(`Boss — ${BOSSES[event.kind].name}`, 'boss');
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
          wave: ['Vague spéciale : or ×2 pendant 15 ennemis', '#f2d083'],
          elite: ['Une élite errante approche !', '#ff9a3d'],
        };
        const [text, color] = texts[event.eventType] ?? [eventLabel(event.eventType), null];
        this.news(text, color);
        if (this.tab === 'inbox') this.invalidate();
        break;
      }
      case 'stage':
        if (event.zoneChanged) this.banner(`Zone ${zoneIndexForStage(event.stage) + 1} — ${zoneForStage(event.stage).name}`, 'zone');
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
    const stats = world.heroStats ?? computeHeroStats(state);
    this.setText('gold', formatNumber(state.gold));
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
      this.lastHud.xp = xpRatio;
    }
    this.setText('auto-toggle', state.autoAdvance ? '⏵ Avance auto' : '⏸ Farm');
    this.$('auto-toggle').classList.toggle('off', !state.autoAdvance);
    this.$('auto-toggle').classList.toggle('hidden', Boolean(state.dungeon));

    this.updateZoneCard(state);
    this.updateProgress(state, world);
    this.$('advance-btn').classList.toggle('hidden', state.autoAdvance || Boolean(state.dungeon));
    this.updateBadges(state);
    this.updateTabs(state);

    if (this.dirty && this.tab) {
      this.renderPanel(state);
      this.dirty = false;
    } else if (this.tab) {
      this.refreshCosts(state);
      const now = performance.now();
      if (LIVE_PANELS.has(this.tab) && now - this.lastLive > 1000) {
        this.lastLive = now;
        if (this.liveKey(state) !== this.lastHud.live) this.renderPanel(state);
      }
    }
  }

  // Empreinte du contenu d'un panneau « vivant » (évite de le redessiner pour rien).
  liveKey(state) {
    switch (this.tab) {
      case 'contracts': return state.contracts.map((c) => `${c.id}:${c.progress}`).join();
      case 'dungeons': return JSON.stringify(state.dungeon);
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

  updateBadges(state) {
    const now = performance.now();
    if (now - (this.lastHud.badgeTime ?? 0) < 500) return;
    this.lastHud.badgeTime = now;
    const upgrade = state.inventory.some((i) => isUpgrade(state, i));
    this.$('inv-badge').classList.toggle('hidden', !upgrade || this.tab === 'inventory');
    this.$('skills-badge').classList.toggle('hidden', skillPointsAvailable(state) < 1 || this.tab === 'skills');
    this.$('contracts-badge').classList.toggle('hidden', !state.contracts.some((c) => c.progress >= c.target));
    this.$('inbox-badge').classList.toggle('hidden', state.inbox.length === 0);
  }

  // Menus débloqués progressivement.
  updateTabs(state) {
    const visible = {
      companions: Object.keys(state.companions.owned).length > 0 || state.records.bossesDefeated > 0,
      tree: canRebirth(state) || state.fragments > 0 || state.records.rebirths > 0,
      dungeons: state.maxStage >= DUNGEONS[0].unlockStage - 2 || Object.keys(state.dungeonsCleared).length > 0,
      boss: Object.keys(state.powers).length > 0,
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
    const scroll = body.scrollTop;
    body.innerHTML = panel.render(this, state);
    body.scrollTop = scroll;
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
      <p class="muted">Aucun déblocage permanent n'est perdu.</p>
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
      const items = summary.items.map((i) => itemFrame(i, { tag: 'div' })).join('');
      const recycled = summary.excessDrops + summary.autoRecycledCount;
      card.innerHTML = `<h2>Bon retour, chevalier !</h2>
        <p>Absence : <b>${formatDuration(summary.elapsedSeconds)}</b>${summary.capped ? ` <span class="muted">(gains limités à ${BALANCE.offline.capHours} h)</span>` : ''}</p>
        <p>Or gagné : <b class="gold-text">+${formatNumber(summary.totalGold)}</b> ${coin()}</p>
        <p>Expérience : <b>+${formatNumber(summary.xp)}</b>${summary.levelsGained ? ` · <b class="good">+${summary.levelsGained} niveau${summary.levelsGained > 1 ? 'x' : ''}</b>` : ''}</p>
        <p>Ennemis vaincus : ~${formatNumber(summary.kills)} · Objets : ${summary.items.length - summary.autoRecycledCount}
          ${recycled ? `<span class="muted">(+${recycled} convertis en or)</span>` : ''}</p>
        ${items ? `<div class="loot-row">${items}</div>` : ''}
        <p class="muted">Hors ligne, le chevalier farme l'étape ${stageLabel(summary.stage)} à ${BALANCE.offline.farmMultiplier * 100} % de son rythme actif, sans avancer. Les contrats progressent aussi.</p>
        <button class="btn btn-primary" data-action="close-modal">Continuer</button>`;
    }
    this.$('modal').classList.remove('hidden');
  }

  closeModal() {
    this.$('modal').classList.add('hidden');
  }
}
