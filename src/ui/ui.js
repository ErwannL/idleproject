// Interface DOM : HUD compact, panneaux (améliorations, sac, héros, carte, options),
// bandeaux, notifications et fenêtre de retour hors ligne.
// L'interface ne modifie jamais l'état directement : elle appelle les actions fournies par main.js.
import { BALANCE } from '../data/balance.js';
import { BOSSES } from '../data/enemies.js';
import { SLOTS, STAT_LABELS } from '../data/items.js';
import { ZONES } from '../data/zones.js';
import { isBossStage, stageLabel, zoneForStage, zoneIndexForStage } from '../core/combat.js';
import { upgradeCost } from '../core/economy.js';
import { formatDecimal, formatDuration, formatNumber, formatStat } from '../core/format.js';
import { compareWithEquipped, listInventory } from '../core/inventory.js';
import { rarityById, recycleValue } from '../core/loot.js';
import { computeHeroStats } from '../core/stats.js';
import { heroPortraitUrl, itemIconUrl, spriteUrl } from '../render/pixel.js';

const TAB_TITLES = {
  upgrades: 'Améliorations',
  inventory: 'Inventaire',
  hero: 'Héros',
  campaign: 'Campagne',
  options: 'Options',
};
const WIDE_MIN_WIDTH = 680;
const RATE_WINDOW_SECONDS = 60;

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const rarityStyle = (id) => `--rarity:${rarityById(id).color}`;

export class UI {
  constructor(root, actions) {
    this.root = root;
    this.actions = actions;
    this.$ = (id) => root.querySelector(`#${id}`);
    this.tab = null;
    this.selectedItemId = null;
    this.dirty = true;
    this.state = null;
    this.goldLog = [];
    this.lastHud = {};

    this.$('gold-icon').src = spriteUrl('coin', 3);
    root.querySelectorAll('#tabs button').forEach((btn) => {
      btn.addEventListener('click', () => this.toggleTab(btn.dataset.tab));
    });
    this.$('panel-close').addEventListener('click', () => this.closePanel());
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('change', (e) => this.onChange(e));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.$('modal').classList.contains('hidden')) this.closeModal();
        else if (this.isCompact()) this.closePanel();
      }
    });
    new ResizeObserver(() => this.updateLayout()).observe(root);
    this.updateLayout();
  }

  isCompact() {
    return this.root.classList.contains('layout-compact');
  }

  updateLayout() {
    const wide = this.root.clientWidth >= WIDE_MIN_WIDTH;
    this.root.classList.toggle('layout-wide', wide);
    this.root.classList.toggle('layout-compact', !wide);
    // En mode compact, le panneau recouvre la scène mais laisse les onglets accessibles.
    const tabsTop = this.$('tabs').getBoundingClientRect().top - this.root.getBoundingClientRect().top;
    this.root.style.setProperty('--tabs-h', `${Math.max(0, this.root.clientHeight - tabsTop + 3)}px`);
    if (wide && !this.tab) this.openTab('upgrades');
  }

  toggleTab(tab) {
    if (this.tab === tab && this.isCompact()) this.closePanel();
    else this.openTab(tab);
  }

  openTab(tab) {
    this.tab = tab;
    this.$('panel').classList.remove('hidden');
    this.$('panel-title').textContent = TAB_TITLES[tab];
    this.root.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    this.invalidate();
  }

  closePanel() {
    if (!this.isCompact()) return;
    this.tab = null;
    this.$('panel').classList.add('hidden');
    this.root.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
  }

  invalidate() {
    this.dirty = true;
  }

  onClick(event) {
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const { action, key, id, stage, seconds } = el.dataset;
    switch (action) {
      case 'buy': this.actions.buy(key); break;
      case 'select-item': this.selectedItemId = id; this.invalidate(); break;
      case 'equip': this.actions.equip(id); break;
      case 'recycle':
        this.actions.recycle(id);
        if (this.selectedItemId === id) this.selectedItemId = null;
        break;
      case 'recycle-commons': this.actions.recycleCommons(); break;
      case 'stage': this.actions.selectStage(Number(stage)); break;
      case 'advance': this.actions.advance(); break;
      case 'save': this.actions.saveNow(); break;
      case 'simulate': this.actions.simulateAbsence(Number(seconds)); break;
      case 'reset': this.actions.reset(); break;
      case 'close-modal': this.closeModal(); break;
      default: break;
    }
  }

  onChange(event) {
    const el = event.target;
    if (el.dataset.action === 'filter') this.actions.setFilter(el.value);
    if (el.dataset.action === 'sort') this.actions.setSort(el.value);
    if (el.dataset.action === 'auto') this.actions.setAutoAdvance(el.checked);
  }

  // --- Événements de la simulation ---
  handleEvent(event, state) {
    switch (event.type) {
      case 'kill':
        this.goldLog.push({ t: performance.now() / 1000, gold: event.gold });
        break;
      case 'drop': {
        const rarity = rarityById(event.item.rarity);
        const text = event.autoRecycled
          ? `Sac plein : ${event.item.name} recyclé (+${formatNumber(event.recycledGold)} or)`
          : `Butin : ${event.item.name} (${rarity.label})`;
        this.setTicker(text);
        if (event.item.rarity !== 'common' || event.autoRecycled) this.toast(text, rarity.color);
        if (this.tab === 'inventory' || this.tab === 'hero') this.invalidate();
        break;
      }
      case 'bossSpawn':
        this.banner(`BOSS — ${BOSSES[event.kind].name}`, 'boss');
        break;
      case 'bossDefeated':
        this.banner('Boss vaincu !', 'win');
        break;
      case 'stage':
        if (event.zoneChanged) this.banner(`Zone ${zoneIndexForStage(event.stage) + 1} — ${zoneForStage(event.stage).name}`, 'zone');
        this.setTicker(`Étape ${stageLabel(event.stage)}`);
        if (this.tab === 'campaign') this.invalidate();
        break;
      case 'unlock':
        if (this.tab === 'campaign') this.invalidate();
        break;
      case 'heroDeath':
        this.banner(`Vaincu… retour à l'étape ${stageLabel(event.to)}`, 'lose');
        this.setTicker('Mode farm : améliorez le héros puis appuyez sur « Avancer ».');
        if (this.tab === 'campaign') this.invalidate();
        break;
      default:
        break;
    }
    this.state = state;
  }

  setTicker(text) {
    this.$('ticker').textContent = text;
  }

  banner(text, kind) {
    const el = this.$('banner');
    el.className = kind;
    el.textContent = text;
    // Relance l'animation CSS.
    void el.offsetWidth;
    el.classList.remove('hidden');
  }

  toast(text, color = null) {
    const stack = this.$('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    if (color) el.style.setProperty('--rarity', color);
    el.textContent = text;
    stack.appendChild(el);
    while (stack.children.length > 3) stack.firstChild.remove();
    setTimeout(() => el.remove(), 3500);
  }

  // --- Mise à jour à chaque image ---
  update(state, world) {
    this.state = state;
    this.setText('gold', formatNumber(state.gold));
    const zone = zoneForStage(state.stage);
    this.setText('stage-label', `${zone.name} · ${stageLabel(state.stage)}${state.autoAdvance ? '' : ' · farm'}`);
    this.setText('inv-count', `${state.inventory.length}/${BALANCE.loot.inventorySize}`);

    const progress = this.$('progress');
    let ratio;
    let text;
    if (isBossStage(state.stage)) {
      const boss = world.enemies.find((e) => e.boss);
      progress.classList.add('boss');
      ratio = boss ? boss.hp / boss.maxHp : 1;
      text = boss
        ? `${BOSSES[boss.type].name} — ${formatNumber(Math.max(0, boss.hp))} / ${formatNumber(boss.maxHp)} PV`
        : 'Le boss arrive…';
    } else {
      progress.classList.remove('boss');
      const needed = BALANCE.stages.killsPerStage;
      ratio = state.kills / needed;
      text = `Ennemis vaincus ${state.kills}/${needed}`;
    }
    if (ratio !== this.lastHud.ratio) {
      this.$('progress-fill').style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
      this.lastHud.ratio = ratio;
    }
    this.setText('progress-text', text);

    const now = performance.now() / 1000;
    this.goldLog = this.goldLog.filter((g) => now - g.t <= RATE_WINDOW_SECONDS);
    const span = Math.min(RATE_WINDOW_SECONDS, Math.max(10, now - (this.goldLog[0]?.t ?? now)));
    const perMinute = (this.goldLog.reduce((s, g) => s + g.gold, 0) / span) * 60;
    this.setText('rate', `≈ ${formatNumber(perMinute)} or/min`);

    this.$('advance-btn').classList.toggle('hidden', state.autoAdvance);

    if (this.dirty && this.tab) {
      this.renderPanel(state);
      this.dirty = false;
    } else if (this.tab === 'upgrades') {
      this.refreshUpgradeButtons(state);
    }
  }

  setText(id, text) {
    if (this.lastHud[id] === text) return;
    this.lastHud[id] = text;
    this.$(id).textContent = text;
  }

  renderPanel(state) {
    const body = this.$('panel-body');
    const scroll = body.scrollTop;
    const renderers = {
      upgrades: () => this.renderUpgrades(state),
      inventory: () => this.renderInventory(state),
      hero: () => this.renderHero(state),
      campaign: () => this.renderCampaign(state),
      options: () => this.renderOptions(state),
    };
    body.innerHTML = renderers[this.tab]();
    body.scrollTop = scroll;
  }

  renderUpgrades(state) {
    const stats = computeHeroStats(state);
    const rows = Object.entries(BALANCE.upgrades).map(([key, up]) => {
      const level = state.upgrades[key];
      const cost = upgradeCost(key, level);
      return `<div class="card upgrade">
        <div><b>${escapeHtml(up.label)}</b> <span class="lvl">niv. ${level}</span>
          <div class="desc">${escapeHtml(up.description)}</div></div>
        <button class="primary" data-action="buy" data-key="${key}" data-cost="${cost}" ${state.gold < cost ? 'disabled' : ''}>
          ${formatNumber(cost)} or</button>
      </div>`;
    });
    return `<div class="muted">Dégâts <b>${formatNumber(stats.damage)}</b> · ${formatDecimal(stats.attacksPerSecond, 2)} att./s ·
        DPS <b>${formatDecimal(stats.dps)}</b> · PV <b>${formatNumber(stats.maxHp)}</b></div>${rows.join('')}`;
  }

  refreshUpgradeButtons(state) {
    this.$('panel-body').querySelectorAll('[data-action="buy"]').forEach((btn) => {
      btn.disabled = state.gold < Number(btn.dataset.cost);
    });
  }

  itemCell(item, { selected = false, showUp = false, state = null } = {}) {
    const better = showUp && state && compareWithEquipped(state, item).dps > 0.001;
    return `<button class="item-cell${selected ? ' selected' : ''}" style="${rarityStyle(item.rarity)}"
      data-action="select-item" data-id="${item.id}" title="${escapeHtml(item.name)}">
      <img class="px" src="${itemIconUrl(item)}" alt="${escapeHtml(item.name)}">
      ${better ? '<span class="up">▲</span>' : ''}</button>`;
  }

  renderInventory(state) {
    const { slotFilter, sortBy } = state.ui;
    const items = listInventory(state, { slot: slotFilter, sortBy });
    const all = [...state.inventory, ...Object.values(state.equipment).filter(Boolean)];
    const selected = all.find((i) => i.id === this.selectedItemId) ?? null;
    if (!selected) this.selectedItemId = null;

    const slotOptions = [['all', 'Tous'], ...Object.entries(SLOTS)]
      .map(([v, l]) => `<option value="${v}" ${v === slotFilter ? 'selected' : ''}>${l}</option>`).join('');
    const sortOptions = [['rarity', 'Rareté'], ['power', 'Puissance'], ['recent', 'Récent']]
      .map(([v, l]) => `<option value="${v}" ${v === sortBy ? 'selected' : ''}>${l}</option>`).join('');

    const equipped = Object.entries(SLOTS).map(([slot, label]) => {
      const item = state.equipment[slot];
      return `<div class="slot">${item ? this.itemCell(item, { selected: item.id === this.selectedItemId }) : '<div class="item-cell"></div>'}${label}</div>`;
    }).join('');

    const commons = state.inventory.filter((i) => i.rarity === 'common');
    const commonGold = commons.reduce((s, i) => s + recycleValue(i), 0);

    return `
      <div class="equipped-row">${equipped}</div>
      ${selected ? this.renderItemDetail(state, selected) : '<div class="muted">Sélectionnez un objet pour le comparer. ▲ = meilleur DPS que l\'objet équipé.</div>'}
      <div class="inv-toolbar">
        <select data-action="filter" aria-label="Filtrer">${slotOptions}</select>
        <select data-action="sort" aria-label="Trier">${sortOptions}</select>
        <span class="muted">${state.inventory.length}/${BALANCE.loot.inventorySize}</span>
      </div>
      <div class="inv-grid">${items.map((i) => this.itemCell(i, { selected: i.id === this.selectedItemId, showUp: true, state })).join('')
        || '<span class="muted">Sac vide. Les ennemis laissent parfois tomber des objets.</span>'}</div>
      <button data-action="recycle-commons" ${commons.length ? '' : 'disabled'}>
        Recycler les ${commons.length} objets communs (+${formatNumber(commonGold)} or)</button>`;
  }

  renderItemDetail(state, item) {
    const rarity = rarityById(item.rarity);
    const isEquipped = state.equipment[item.slot]?.id === item.id;
    const stats = Object.entries(item.stats)
      .map(([k, v]) => `<li>${STAT_LABELS[k]} : <b class="${v < 0 ? 'bad' : ''}">${formatStat(k, v, true)}</b></li>`).join('');
    let compare = '';
    if (!isEquipped) {
      const diff = compareWithEquipped(state, item);
      const fmt = (key, value, label, digits) => {
        if (Math.abs(value) < 0.001) return `<span class="muted">${label} =</span>`;
        const text = digits ? formatDecimal(value, digits) : formatNumber(Math.round(value));
        return `<span class="${value > 0 ? 'good' : 'bad'}">${label} ${value > 0 ? '+' : ''}${text}${key === 'armor' ? ' %' : ''}</span>`;
      };
      const current = state.equipment[item.slot];
      compare = `<div class="compare">Contre ${current ? escapeHtml(current.name) : 'rien'} :
        ${fmt('dps', diff.dps, 'DPS', 1)} · ${fmt('maxHp', diff.maxHp, 'PV')} · ${fmt('armor', diff.armor, 'Armure', 1)}</div>`;
    }
    const buttons = isEquipped ? '<span class="muted">équipé</span>' : `<div class="row">
        <button class="primary small" data-action="equip" data-id="${item.id}">Équiper</button>
        <button class="small" data-action="recycle" data-id="${item.id}">Recycler +${formatNumber(recycleValue(item))}</button></div>`;
    return `<div class="card item-detail" style="${rarityStyle(item.rarity)}">
      <div class="row spread"><div class="row"><img class="px" src="${itemIconUrl(item)}" width="28" height="28" alt="">
        <div><div class="item-name">${escapeHtml(item.name)}</div>
        <div class="muted">${SLOTS[item.slot]} · ${rarity.label} · niv. ${item.level}</div></div></div>${buttons}</div>
      ${compare}<ul>${stats}</ul>
    </div>`;
  }

  renderHero(state) {
    const s = computeHeroStats(state);
    const r = state.records;
    const gear = Object.entries(SLOTS).map(([slot, label]) => {
      const item = state.equipment[slot];
      return `<div>${label} : ${item ? `<span class="item-name" style="${rarityStyle(item.rarity)}">${escapeHtml(item.name)}</span>` : '<span class="muted">aucun</span>'}</div>`;
    }).join('');
    return `<div class="portrait"><img class="px" src="${heroPortraitUrl(state.equipment)}" alt="Héros"><div>${gear}</div></div>
      <div class="card stats-grid">
        <span>Dégâts</span><span>${formatNumber(s.damage)}</span>
        <span>Attaques / s</span><span>${formatDecimal(s.attacksPerSecond, 2)}</span>
        <span>DPS</span><span>${formatDecimal(s.dps)}</span>
        <span>PV max</span><span>${formatNumber(s.maxHp)}</span>
        <span>Armure</span><span>${formatDecimal(s.armor)} %</span>
        <span>Régénération</span><span>${formatDecimal(s.regenPerSecond)} PV/s</span>
      </div>
      <div class="card stats-grid">
        <span>Ennemis vaincus</span><span>${formatNumber(r.kills)}</span>
        <span>Boss vaincus</span><span>${formatNumber(r.bossesDefeated)}</span>
        <span>Objets trouvés</span><span>${formatNumber(r.itemsFound)}</span>
        <span>Or gagné au total</span><span>${formatNumber(r.goldEarned)}</span>
        <span>Étape max</span><span>${stageLabel(state.maxStage)}</span>
      </div>`;
  }

  renderCampaign(state) {
    const per = BALANCE.stages.stagesPerZone;
    const lastZone = zoneIndexForStage(state.maxStage);
    const blocks = ZONES.slice(0, lastZone + 1).map((zone, zi) => {
      const first = zi * per + 1;
      const last = zi === ZONES.length - 1 ? Math.max(first + per - 1, state.maxStage + 1) : first + per - 1;
      const buttons = [];
      for (let stage = first; stage <= last; stage++) {
        const classes = [isBossStage(stage) ? 'boss' : '', stage === state.stage ? 'current' : ''].join(' ');
        buttons.push(`<button class="${classes}" data-action="stage" data-stage="${stage}" ${stage > state.maxStage ? 'disabled' : ''}
          title="${isBossStage(stage) ? 'Boss' : 'Étape'} ${stageLabel(stage)}">${stage - first + 1}${isBossStage(stage) ? '★' : ''}</button>`);
      }
      return `<div class="zone-block card"><h3>Zone ${zi + 1} — ${escapeHtml(zone.name)}</h3><div class="stage-grid">${buttons.join('')}</div></div>`;
    });
    return `<label class="toggle"><input type="checkbox" data-action="auto" ${state.autoAdvance ? 'checked' : ''}>
        Avancer automatiquement après chaque étape</label>
      ${state.autoAdvance ? '' : '<div class="card">Mode farm : le héros reste sur l\'étape actuelle. <button class="primary small" data-action="advance">Avancer ▶</button></div>'}
      ${blocks.join('')}
      <div class="muted">★ = boss. Battre un boss débloque l'étape suivante et donne un objet rare ou mieux.</div>`;
  }

  renderOptions(state) {
    const ago = Math.max(0, (Date.now() - state.lastSaved) / 1000);
    return `<div class="card">
        <div class="row spread"><span>Dernière sauvegarde : il y a ${formatDuration(ago)}</span>
        <button data-action="save">Sauvegarder</button></div>
        <div class="muted">Sauvegarde automatique toutes les ${BALANCE.autosaveSeconds} s et à chaque action.</div>
      </div>
      <div class="card">
        <b>Fenêtre au premier plan</b>
        <div class="muted">Non disponible dans la version navigateur : prévu avec l'empaquetage desktop (voir README).</div>
      </div>
      <div class="card">
        <b>Test des gains hors ligne</b>
        <div class="muted">Applique le vrai calcul hors ligne comme si le jeu avait été fermé.</div>
        <div class="row" style="margin-top:4px">
          <button data-action="simulate" data-seconds="3600">1 h</button>
          <button data-action="simulate" data-seconds="28800">8 h</button>
          <button data-action="simulate" data-seconds="86400">24 h</button>
        </div>
      </div>
      <div class="card">
        <button class="danger" data-action="reset">Réinitialiser la partie</button>
      </div>
      <div class="muted">Prototype ${escapeHtml(document.title)} · gains hors ligne : ${BALANCE.offline.farmMultiplier * 100} % du rythme actif, ${BALANCE.offline.capHours} h max.</div>`;
  }

  // --- Retour hors ligne ---
  showOffline(summary) {
    const card = this.$('modal-card');
    if (summary.clockSuspicious) {
      card.innerHTML = `<h2>Horloge incohérente</h2>
        <p>L'heure de l'ordinateur est antérieure à la dernière sauvegarde. Aucun gain hors ligne n'a été appliqué.</p>
        <button class="primary" data-action="close-modal">Continuer</button>`;
    } else {
      const items = summary.items.map((i) => this.itemCell(i)).join('');
      const recycled = summary.excessDrops + summary.autoRecycledCount;
      card.innerHTML = `<h2>Bon retour !</h2>
        <p>Absence : <b>${formatDuration(summary.elapsedSeconds)}</b>${summary.capped ? ` <span class="muted">(gains limités à ${BALANCE.offline.capHours} h)</span>` : ''}</p>
        <p>Or gagné : <b class="gold-text">+${formatNumber(summary.totalGold)}</b></p>
        <p>Ennemis vaincus : ~${formatNumber(summary.kills)} · Objets : ${summary.items.length - summary.autoRecycledCount}
          ${recycled ? `<span class="muted">(+${recycled} convertis en or)</span>` : ''}</p>
        ${items ? `<div class="loot-row">${items}</div>` : ''}
        <p class="muted">Hors ligne, le héros farme l'étape ${stageLabel(summary.stage)} à ${BALANCE.offline.farmMultiplier * 100} % de son rythme actif, sans avancer.</p>
        <button class="primary" data-action="close-modal">Continuer</button>`;
    }
    this.$('modal').classList.remove('hidden');
  }

  closeModal() {
    this.$('modal').classList.add('hidden');
  }
}

