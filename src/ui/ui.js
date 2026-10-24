// Interface DOM : barre du haut, carte de zone, HUD, onglets et panneaux
// (améliorations, sac, héros, carte, options), bandeaux, notifications et retour hors ligne.
// L'interface ne modifie jamais l'état directement : elle appelle les actions fournies par main.js.
import { BALANCE } from '../data/balance.js';
import { BOSSES } from '../data/enemies.js';
import { SLOTS, STAT_LABELS } from '../data/items.js';
import { ZONES } from '../data/zones.js';
import { isBossStage, stageLabel, zoneForStage, zoneIndexForStage } from '../core/combat.js';
import { upgradeCost } from '../core/economy.js';
import { formatDecimal, formatDuration, formatNumber, formatStat } from '../core/format.js';
import { bulkRecycleCandidates, isUpgrade, listInventory } from '../core/inventory.js';
import { rarityById, recycleValue } from '../core/loot.js';
import { computeHeroStats, statsWithItem } from '../core/stats.js';
import { heroPortraitUrl, itemIconUrl, slotIconName, spriteUrl } from '../render/pixel.js';

const TABS = {
  upgrades: { title: 'Améliorations', icon: 'icon_upgrade' },
  inventory: { title: 'Inventaire', icon: 'icon_bag' },
  hero: { title: 'Héros', icon: 'icon_hero' },
  campaign: { title: 'Carte du monde', icon: 'icon_map' },
  options: { title: 'Options', icon: 'icon_gear' },
};
const UPGRADE_ICONS = { damage: 'weapon_sword', attackSpeed: 'icon_bolt', vitality: 'icon_heart' };
const STAT_ICONS = { damage: 'weapon_sword', attackSpeed: 'icon_bolt', maxHp: 'icon_heart', armor: 'icon_shield' };
const SORT_LABELS = { rarity: 'Rareté', level: 'Niveau', power: 'Puissance', recent: 'Récent' };
const WIDE_MIN_WIDTH = 720;
const TALL_MIN_HEIGHT = 420;
const RATE_WINDOW_SECONDS = 60;
const BULK_CONFIRM_MS = 4000;

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const icon = (name, scale = 2) => spriteUrl(name, scale);
const img = (name, cls = '', alt = '') => `<img class="px ${cls}" src="${icon(name)}" alt="${alt}">`;
const coin = () => img('coin');

export class UI {
  constructor(root, actions) {
    this.root = root;
    this.actions = actions;
    this.$ = (id) => root.querySelector(`#${id}`);
    this.tab = null;
    this.layout = null;
    this.selectedItemId = null;
    this.bulkRarity = 'common';
    this.bulkArmed = false;
    this.dirty = true;
    this.state = null;
    this.desktop = null; // renseigné par main.js dans la version bureau
    this.goldLog = [];
    this.lastHud = {};

    this.$('gold-icon').src = icon('coin', 3);
    this.$('dps-icon').src = icon('weapon_sword', 2);
    this.$('hp-icon').src = icon('icon_heart', 2);
    this.$('brand-icon').src = icon('icon_hero', 2);
    root.querySelectorAll('#tabs img[data-icon]').forEach((el) => { el.src = icon(el.dataset.icon); });
    root.querySelectorAll('#tabs button').forEach((btn) => {
      btn.addEventListener('click', () => this.toggleTab(btn.dataset.tab));
    });
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
    const layout = w >= WIDE_MIN_WIDTH ? 'wide' : h >= TALL_MIN_HEIGHT ? 'tall' : 'mini';
    if (layout !== this.layout) {
      this.root.classList.remove('layout-mini', 'layout-tall', 'layout-wide');
      this.root.classList.add(`layout-${layout}`);
      this.layout = layout;
      if (layout !== 'mini' && !this.tab) this.openTab('upgrades');
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
  }

  isMini() {
    return this.layout === 'mini';
  }

  toggleTab(tab) {
    if (this.tab === tab && this.isMini()) this.closePanel();
    else this.openTab(tab);
  }

  openTab(tab) {
    this.tab = tab;
    this.bulkArmed = false;
    this.$('panel').classList.remove('hidden');
    this.$('panel-title').textContent = TABS[tab].title;
    this.$('panel-icon').src = icon(TABS[tab].icon);
    this.root.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    this.invalidate();
  }

  closePanel() {
    if (!this.isMini()) return;
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
    const { action, key, id, stage, seconds, value, preset } = el.dataset;
    switch (action) {
      case 'buy': this.actions.buy(key); break;
      case 'select-item': this.selectedItemId = id; this.invalidate(); break;
      case 'equip': this.actions.equip(id); break;
      case 'recycle': {
        // L'objet suivant de la liste devient la sélection.
        const list = this.visibleItems();
        const index = list.findIndex((i) => i.id === id);
        this.actions.recycle(id);
        this.selectedItemId = list[index + 1]?.id ?? list[index - 1]?.id ?? null;
        break;
      }
      case 'filter': this.actions.setFilter(value); break;
      case 'bulk-recycle': this.onBulkRecycle(); break;
      case 'stage': this.actions.selectStage(Number(stage)); break;
      case 'advance': this.actions.advance(); break;
      case 'save': this.actions.saveNow(); break;
      case 'simulate': this.actions.simulateAbsence(Number(seconds)); break;
      case 'reset': this.actions.reset(); break;
      case 'close-modal': this.closeModal(); break;
      case 'window-size': this.actions.setWindowSize(preset); break;
      default: break;
    }
  }

  onChange(event) {
    const el = event.target;
    const action = el.dataset.action;
    if (action === 'sort') this.actions.setSort(el.value);
    if (action === 'auto') this.actions.setAutoAdvance(el.checked);
    if (action === 'on-top') this.actions.setAlwaysOnTop(el.checked);
    if (action === 'bulk-rarity') {
      this.bulkRarity = el.value;
      this.bulkArmed = false;
      this.invalidate();
    }
  }

  // Recyclage groupé en deux temps : un premier clic arme le bouton, le second confirme.
  onBulkRecycle() {
    if (!this.bulkArmed) {
      this.bulkArmed = true;
      this.invalidate();
      clearTimeout(this.bulkTimer);
      this.bulkTimer = setTimeout(() => {
        this.bulkArmed = false;
        this.invalidate();
      }, BULK_CONFIRM_MS);
      return;
    }
    clearTimeout(this.bulkTimer);
    this.bulkArmed = false;
    this.actions.recycleBulk(this.bulkRarity);
  }

  // --- Événements de la simulation ---
  handleEvent(event, state) {
    this.state = state;
    switch (event.type) {
      case 'kill':
        this.goldLog.push({ t: performance.now() / 1000, gold: event.gold });
        break;
      case 'drop': {
        const rarity = rarityById(event.item.rarity);
        this.setLastLoot(event.item);
        if (event.autoRecycled) {
          this.toast(`Sac plein : ${event.item.name} recyclé (+${formatNumber(event.recycledGold)} or)`, rarity.color);
        } else if (event.item.rarity !== 'common') {
          this.toast(`Butin ${rarity.label.toLowerCase()} : ${event.item.name}`, rarity.color);
        }
        if (this.tab === 'inventory' || this.tab === 'hero') this.invalidate();
        break;
      }
      case 'bossSpawn':
        this.banner(`Boss — ${BOSSES[event.kind].name}`, 'boss');
        break;
      case 'bossDefeated':
        this.banner('Boss vaincu !', 'win');
        break;
      case 'stage':
        if (event.zoneChanged) this.banner(`Zone ${zoneIndexForStage(event.stage) + 1} — ${zoneForStage(event.stage).name}`, 'zone');
        if (this.tab === 'campaign') this.invalidate();
        break;
      case 'unlock':
        if (this.tab === 'campaign') this.invalidate();
        break;
      case 'heroDeath':
        this.banner(`Vaincu… retour à l'étape ${stageLabel(event.to)}`, 'lose');
        this.toast('Mode farm : améliorez le héros puis appuyez sur « Avancer ».');
        if (this.tab === 'campaign') this.invalidate();
        break;
      default:
        break;
    }
  }

  setLastLoot(item) {
    const el = this.$('last-loot');
    el.textContent = `${item.name} (${rarityById(item.rarity).label})`;
    el.style.setProperty('--rarity', rarityById(item.rarity).color);
  }

  banner(text, kind) {
    const el = this.$('banner');
    el.className = kind;
    el.textContent = text;
    void el.offsetWidth; // relance l'animation CSS
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
    const stats = computeHeroStats(state);
    this.setText('gold', formatNumber(state.gold));
    this.setText('dps', `${formatDecimal(stats.dps)} DPS`);
    this.setText('hp', `${formatNumber(stats.maxHp)} PV`);

    const now = performance.now() / 1000;
    this.goldLog = this.goldLog.filter((g) => now - g.t <= RATE_WINDOW_SECONDS);
    const span = Math.min(RATE_WINDOW_SECONDS, Math.max(10, now - (this.goldLog[0]?.t ?? now)));
    const perMinute = (this.goldLog.reduce((s, g) => s + g.gold, 0) / span) * 60;
    this.setText('rate', `≈ ${formatNumber(perMinute)} or/min`);

    this.updateZoneCard(state);
    this.updateProgress(state, world);
    this.$('advance-btn').classList.toggle('hidden', state.autoAdvance);

    const upgrades = state.inventory.some((i) => isUpgradeCached(this, state, i));
    this.$('inv-badge').classList.toggle('hidden', !upgrades || this.tab === 'inventory');

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

  updateZoneCard(state) {
    const key = `${state.stage}|${state.maxStage}|${state.autoAdvance}`;
    if (this.lastHud.zone === key) return;
    this.lastHud.zone = key;
    const zone = zoneForStage(state.stage);
    this.$('zone-name').textContent = `${zone.name} ${stageLabel(state.stage)}${state.autoAdvance ? '' : ' · farm'}`;
    // Pastilles du cycle de 5 étapes en cours, le boss en dernier.
    const every = BALANCE.stages.bossEvery;
    const first = Math.floor((state.stage - 1) / every) * every + 1;
    const parts = [];
    for (let s = first; s < first + every; s++) {
      const status = s === state.stage ? 'current' : s < state.maxStage ? 'done' : '';
      if (s > first) parts.push(`<i class="pip-link ${s <= state.maxStage ? 'done' : ''}"></i>`);
      parts.push(isBossStage(s)
        ? `<img class="px pip-boss ${status}" src="${icon('icon_skull', 2)}" alt="Boss">`
        : `<i class="pip ${status}"></i>`);
    }
    this.$('stage-pips').innerHTML = parts.join('');
  }

  updateProgress(state, world) {
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
    const extra = {
      upgrades: () => `${coin()}<b class="gold-text num">${formatNumber(state.gold)}</b>`,
      inventory: () => `<span class="num">${state.inventory.length}/${BALANCE.loot.inventorySize}</span>`,
      campaign: () => `Étape max ${stageLabel(state.maxStage)}`,
    }[this.tab];
    this.$('panel-extra').innerHTML = extra ? extra() : '';
  }

  // --- Améliorations ---
  renderUpgrades(state) {
    const current = computeHeroStats(state);
    const cards = Object.entries(BALANCE.upgrades).map(([key, up]) => {
      const level = state.upgrades[key];
      const cost = upgradeCost(key, level);
      const next = computeHeroStats({ ...state, upgrades: { ...state.upgrades, [key]: level + 1 } });
      const effect = {
        damage: [formatNumber(current.damage), formatNumber(next.damage), 'dégâts'],
        attackSpeed: [formatDecimal(current.attacksPerSecond, 2), formatDecimal(next.attacksPerSecond, 2), 'att./s'],
        vitality: [formatNumber(current.maxHp), formatNumber(next.maxHp), 'PV'],
      }[key];
      const milestone = key === 'damage' && (level + 1) % up.milestoneEvery === 0
        ? `<span class="tag">×${formatDecimal(up.milestoneMultiplier)}</span>` : '';
      return `<div class="card upg-card" title="${escapeHtml(up.description)}">
        <div class="upg-icon">${img(UPGRADE_ICONS[key])}</div>
        <div><div class="upg-name">${escapeHtml(up.label)}</div><div class="upg-level">Niv. ${level}</div></div>
        <div class="upg-effect num"><span class="from">${effect[0]}</span> → <span class="to">${effect[1]}</span> ${effect[2]}${milestone}</div>
        <button class="btn btn-gold num" data-action="buy" data-key="${key}" data-cost="${cost}" ${state.gold < cost ? 'disabled' : ''}
          title="Acheter le niveau ${level + 1}">${coin()} ${formatNumber(cost)}</button>
      </div>`;
    });
    return `<div class="upg-list">${cards.join('')}</div>`;
  }

  refreshUpgradeButtons(state) {
    this.$('panel-body').querySelectorAll('[data-action="buy"]').forEach((btn) => {
      btn.disabled = state.gold < Number(btn.dataset.cost);
    });
    const extra = this.$('panel-extra').querySelector('b');
    if (extra) extra.textContent = formatNumber(state.gold);
  }

  // --- Inventaire ---
  visibleItems() {
    const state = this.state;
    return listInventory(state, { slot: state.ui.slotFilter, sortBy: state.ui.sortBy });
  }

  itemFrame(item, { selected = false, showUp = false, equipped = false, state = null, tag = 'button' } = {}) {
    const up = showUp && state && isUpgrade(state, item);
    const attrs = tag === 'button' ? `data-action="select-item" data-id="${item.id}"` : '';
    return `<${tag} class="item-frame r-${item.rarity}${selected ? ' selected' : ''}" ${attrs}
      title="${escapeHtml(item.name)} · ${rarityById(item.rarity).label} · niv. ${item.level}">
      <img class="px" src="${itemIconUrl(item)}" alt="${escapeHtml(item.name)}">
      ${up ? '<span class="up" title="Meilleur que l\'équipement porté">▲</span>' : ''}
      ${equipped ? '<span class="eq">É</span>' : ''}</${tag}>`;
  }

  renderInventory(state) {
    const items = this.visibleItems();
    const equippedItems = Object.values(state.equipment).filter(Boolean);
    const all = [...state.inventory, ...equippedItems];
    let selected = all.find((i) => i.id === this.selectedItemId);
    if (!selected) {
      selected = items[0] ?? state.equipment.weapon ?? equippedItems[0] ?? null;
      this.selectedItemId = selected?.id ?? null;
    }

    const slots = Object.entries(SLOTS).map(([slot, label]) => {
      const item = state.equipment[slot];
      const frame = item
        ? this.itemFrame(item, { selected: item.id === this.selectedItemId, equipped: true })
        : `<div class="item-frame empty" title="${label} : aucun">${img(slotIconName(slot))}</div>`;
      return `<div>${frame}<div class="slot-label">${label}</div></div>`;
    }).join('');

    const filters = [['all', null, 'Tous'], ...Object.entries(SLOTS).map(([slot, label]) => [slot, slotIconName(slot), label])]
      .map(([value, iconName, label]) => `<button class="btn${state.ui.slotFilter === value ? ' active' : ''}"
        data-action="filter" data-value="${value}" title="${label}">${iconName ? img(iconName) : 'Tous'}</button>`).join('');
    const sortOptions = Object.entries(SORT_LABELS)
      .map(([v, l]) => `<option value="${v}" ${v === state.ui.sortBy ? 'selected' : ''}>Tri : ${l}</option>`).join('');

    const candidates = bulkRecycleCandidates(state, this.bulkRarity);
    const bulkGold = candidates.reduce((s, i) => s + recycleValue(i), 0);
    const full = state.inventory.length >= BALANCE.loot.inventorySize;
    const bulkLabel = this.bulkArmed
      ? `Confirmer : ${candidates.length} objet${candidates.length > 1 ? 's' : ''} (+${formatNumber(bulkGold)} or)`
      : `Recycler (${candidates.length}) +${formatNumber(bulkGold)}`;

    return `<div class="inv">
      <div class="inv-slots">${slots}</div>
      <div class="inv-detail">${selected ? this.renderItemDetail(state, selected) : '<div class="card muted">Aucun objet.</div>'}</div>
      <div class="inv-list">
        <div class="inv-filters">${filters}</div>
        <div class="inv-grid">${items.map((i) => this.itemFrame(i, { selected: i.id === this.selectedItemId, showUp: true, state })).join('')
          || '<div class="inv-empty">Aucun objet ici. Les ennemis laissent parfois tomber de l\'équipement.</div>'}</div>
        <div class="inv-footer">
          <select data-action="sort" aria-label="Trier">${sortOptions}</select>
          <span class="inv-count${full ? ' full' : ''}" title="${full ? 'Sac plein : le butin est recyclé automatiquement' : 'Places utilisées'}">${state.inventory.length}/${BALANCE.loot.inventorySize}</span>
        </div>
        <div class="inv-bulk" title="Ne recycle jamais un objet meilleur que l'équipement porté, ni un objet Épique ou Légendaire.">
          <select data-action="bulk-rarity" aria-label="Rareté maximale à recycler">
            <option value="common" ${this.bulkRarity === 'common' ? 'selected' : ''}>Communs</option>
            <option value="rare" ${this.bulkRarity === 'rare' ? 'selected' : ''}>+ Rares</option>
          </select>
          <button class="btn btn-outline-gold${this.bulkArmed ? ' armed' : ''}" data-action="bulk-recycle" ${candidates.length ? '' : 'disabled'}>${bulkLabel}</button>
        </div>
      </div>
    </div>`;
  }

  renderItemDetail(state, item) {
    const rarity = rarityById(item.rarity);
    const isEquipped = state.equipment[item.slot]?.id === item.id;
    const stats = Object.entries(item.stats).map(([k, v]) => `<li>${img(STAT_ICONS[k])}${STAT_LABELS[k]}
      <b class="num ${v < 0 ? 'bad' : 'good'}">${formatStat(k, v, true)}</b></li>`).join('');

    let compare = '';
    if (!isEquipped) {
      const cur = computeHeroStats(state);
      const next = statsWithItem(state, item);
      const row = (label, diff, text, unit = '') => {
        const cls = Math.abs(diff) < 0.001 ? 'muted' : diff > 0 ? 'good' : 'bad';
        const arrow = Math.abs(diff) < 0.001 ? '•' : diff > 0 ? '▲' : '▼';
        return `<div class="compare-row"><span>${label}</span><span class="num ${cls}">${diff > 0 ? '+' : ''}${text}${unit} ${arrow}</span></div>`;
      };
      const current = state.equipment[item.slot];
      compare = `<div class="compare"><div class="section-title">Comparaison${current ? ` · ${escapeHtml(current.name)}` : ' · emplacement vide'}</div>
        ${row('DPS', next.dps - cur.dps, formatDecimal(next.dps - cur.dps))}
        ${row('Dégâts', next.damage - cur.damage, formatNumber(Math.round(next.damage - cur.damage)))}
        ${row('Attaques / s', next.attacksPerSecond - cur.attacksPerSecond, formatDecimal(next.attacksPerSecond - cur.attacksPerSecond, 2))}
        ${row('PV max', next.maxHp - cur.maxHp, formatNumber(Math.round(next.maxHp - cur.maxHp)))}
        ${row('Armure', next.armor - cur.armor, formatDecimal(next.armor - cur.armor), ' %')}
      </div>`;
    }
    const actions = isEquipped
      ? '<div class="muted">Objet porté. Équipez un autre objet pour le remplacer.</div>'
      : `<div class="detail-actions">
          <button class="btn btn-primary" data-action="equip" data-id="${item.id}">Équiper</button>
          <button class="btn btn-outline-gold" data-action="recycle" data-id="${item.id}" title="Recycler contre de l'or">Recycler +${formatNumber(recycleValue(item))} ${coin()}</button>
        </div>`;
    const preview = heroPortraitUrl({ ...state.equipment, [item.slot]: item }, 3);

    return `<div class="card item-detail r-${item.rarity}" style="display:flex;flex-direction:column;gap:5px">
      <div class="detail-head">${this.itemFrame(item, { tag: 'div' })}
        <div><div class="item-name">${escapeHtml(item.name)}</div>
          <div class="item-sub">${SLOTS[item.slot]} · <span class="rarity-text">${rarity.label}</span> · niv. ${item.level}</div>
          ${isEquipped ? '<span class="equipped-tag">Équipé</span>' : ''}</div></div>
      <ul class="stat-list">${stats}</ul>
      ${compare}${actions}
      <div class="preview" title="Aperçu du héros avec cet objet"><img class="px" src="${preview}" alt=""></div>
    </div>`;
  }

  // --- Héros ---
  renderHero(state) {
    const s = computeHeroStats(state);
    const r = state.records;
    const gear = Object.entries(SLOTS).map(([slot, label]) => {
      const item = state.equipment[slot];
      return item ? this.itemFrame(item, { tag: 'div' }) : `<div class="item-frame empty" title="${label} : aucun">${img(slotIconName(slot))}</div>`;
    }).join('');
    const line = (iconName, label, value) => `${img(iconName)}<span>${label}</span><span class="v">${value}</span>`;
    return `<div class="card hero-sheet">
        <div class="pedestal"><img class="px" src="${heroPortraitUrl(state.equipment, 3)}" alt="Héros"></div>
        <div>
          <div class="hero-title">Chevalier</div>
          <div class="muted">Étape max ${stageLabel(state.maxStage)} · ${formatNumber(r.bossesDefeated)} boss vaincus</div>
          <div class="gear-row" style="margin-top:5px">${gear}</div>
        </div>
      </div>
      <div class="card"><div class="section-title">Statistiques</div><div class="stats-grid">
        ${line('weapon_sword', 'Dégâts', formatNumber(s.damage))}
        ${line('icon_bolt', 'Attaques / s', formatDecimal(s.attacksPerSecond, 2))}
        ${line('weapon_sword', 'DPS', formatDecimal(s.dps))}
        ${line('icon_heart', 'PV max', formatNumber(s.maxHp))}
        ${line('icon_shield', 'Armure', `${formatDecimal(s.armor)} %`)}
        ${line('icon_heart', 'Régénération', `${formatDecimal(s.regenPerSecond)} PV/s`)}
      </div></div>
      <div class="card"><div class="section-title">Exploits</div><div class="stats-grid">
        ${line('icon_skull', 'Ennemis vaincus', formatNumber(r.kills))}
        ${line('icon_skull', 'Boss vaincus', formatNumber(r.bossesDefeated))}
        ${line('icon_bag', 'Objets trouvés', formatNumber(r.itemsFound))}
        ${line('coin', 'Or gagné au total', formatNumber(r.goldEarned))}
      </div></div>`;
  }

  // --- Carte ---
  renderCampaign(state) {
    const per = BALANCE.stages.stagesPerZone;
    const currentZone = zoneIndexForStage(state.stage);
    const lastZone = zoneIndexForStage(state.maxStage);
    const blocks = ZONES.map((zone, zi) => {
      const first = zi * per + 1;
      const last = zi === ZONES.length - 1 ? Math.max(first + per - 1, state.maxStage + 1) : first + per - 1;
      const locked = zi > lastZone;
      const cleared = state.maxStage > last;
      const p = zone.palette;
      const banner = `background: linear-gradient(90deg, ${p.sky[0]}, ${p.far} 60%, ${p.groundTop})`;
      const stateLabel = locked ? 'Bloqué' : zi === currentZone ? 'En cours' : cleared ? 'Terminé' : 'Ouvert';
      let grid = '';
      if (!locked) {
        const buttons = [];
        for (let stage = first; stage <= last; stage++) {
          const classes = ['btn', isBossStage(stage) ? 'boss' : '', stage === state.stage ? 'current' : '', stage < state.maxStage ? 'cleared' : ''].join(' ');
          buttons.push(`<button class="${classes}" data-action="stage" data-stage="${stage}" ${stage > state.maxStage ? 'disabled' : ''}
            title="${isBossStage(stage) ? 'Boss' : 'Étape'} ${stageLabel(stage)}">${stage - first + 1}${isBossStage(stage) ? img('icon_skull') : ''}</button>`);
        }
        grid = `<div class="stage-grid">${buttons.join('')}</div>`;
      }
      return `<div class="card zone-card${locked ? ' locked' : ''}">
        <div class="zone-banner" style="${banner}"><span>${zi + 1}. ${escapeHtml(zone.name)}</span><span class="state">${stateLabel}</span></div>
        ${grid}</div>`;
    });
    return `<div class="card">
        <label class="toggle"><input type="checkbox" data-action="auto" ${state.autoAdvance ? 'checked' : ''}>
          Avancer automatiquement après chaque étape</label>
        ${state.autoAdvance ? '' : `<div class="row" style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <span class="muted">Mode farm : le héros reste sur l'étape actuelle.</span>
          <button class="btn btn-primary small" data-action="advance">Avancer ▶</button></div>`}
      </div>
      ${blocks.join('')}
      <div class="muted">Les étapes ${img('icon_skull')} sont des boss : les vaincre débloque la suite et donne un objet Rare ou mieux.</div>`;
  }

  // --- Options ---
  renderOptions(state) {
    const ago = Math.max(0, (Date.now() - state.lastSaved) / 1000);
    return `<div class="card">
        <div class="section-title">Sauvegarde</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <span>Dernière sauvegarde : il y a ${formatDuration(ago)}</span>
          <button class="btn small" data-action="save">Sauvegarder</button></div>
        <div class="muted">Automatique toutes les ${BALANCE.autosaveSeconds} s, à chaque action et à la fermeture.</div>
      </div>
      ${this.renderWindowOptions()}
      <div class="card">
        <div class="section-title">Test des gains hors ligne</div>
        <div class="muted">Applique le vrai calcul hors ligne comme si le jeu avait été fermé.</div>
        <div class="options-row">
          <button class="btn small" data-action="simulate" data-seconds="3600">1 h</button>
          <button class="btn small" data-action="simulate" data-seconds="28800">8 h</button>
          <button class="btn small" data-action="simulate" data-seconds="86400">24 h</button>
        </div>
      </div>
      <div class="card">
        <div class="section-title">Partie</div>
        <button class="btn btn-danger small" data-action="reset">Réinitialiser la partie</button>
      </div>
      <div class="muted">Gains hors ligne : ${BALANCE.offline.farmMultiplier * 100} % du rythme actif, ${BALANCE.offline.capHours} h max.</div>`;
  }

  renderWindowOptions() {
    if (!this.desktop) {
      return `<div class="card"><div class="section-title">Fenêtre</div>
        <div class="muted">« Toujours au premier plan » est disponible dans la version bureau (Idle RPG.exe).</div></div>`;
    }
    return `<div class="card">
        <div class="section-title">Fenêtre</div>
        <label class="toggle"><input type="checkbox" data-action="on-top" ${this.desktop.alwaysOnTop ? 'checked' : ''}>
          Garder la fenêtre au premier plan</label>
        <div class="options-row">
          <button class="btn small" data-action="window-size" data-preset="mini">Mini</button>
          <button class="btn small" data-action="window-size" data-preset="standard">Standard</button>
          <button class="btn small" data-action="window-size" data-preset="wide">Large</button>
        </div>
        <div class="muted">Version ${escapeHtml(this.desktop.version)} · position et taille mémorisées.</div>
      </div>`;
  }

  // --- Retour hors ligne ---
  showOffline(summary) {
    const card = this.$('modal-card');
    if (summary.clockSuspicious) {
      card.innerHTML = `<h2>Horloge incohérente</h2>
        <p>L'heure de l'ordinateur est antérieure à la dernière sauvegarde. Aucun gain hors ligne n'a été appliqué.</p>
        <button class="btn btn-primary" data-action="close-modal">Continuer</button>`;
    } else {
      const items = summary.items.map((i) => this.itemFrame(i, { tag: 'div' })).join('');
      const recycled = summary.excessDrops + summary.autoRecycledCount;
      card.innerHTML = `<h2>Bon retour, chevalier !</h2>
        <p>Absence : <b>${formatDuration(summary.elapsedSeconds)}</b>${summary.capped ? ` <span class="muted">(gains limités à ${BALANCE.offline.capHours} h)</span>` : ''}</p>
        <p>Or gagné : <b class="gold-text">+${formatNumber(summary.totalGold)}</b> ${coin()}</p>
        <p>Ennemis vaincus : ~${formatNumber(summary.kills)} · Objets : ${summary.items.length - summary.autoRecycledCount}
          ${recycled ? `<span class="muted">(+${recycled} convertis en or)</span>` : ''}</p>
        ${items ? `<div class="loot-row">${items}</div>` : ''}
        <p class="muted">Hors ligne, le héros farme l'étape ${stageLabel(summary.stage)} à ${BALANCE.offline.farmMultiplier * 100} % de son rythme actif, sans avancer.</p>
        <button class="btn btn-primary" data-action="close-modal">Continuer</button>`;
    }
    this.$('modal').classList.remove('hidden');
  }

  closeModal() {
    this.$('modal').classList.add('hidden');
  }
}

// Le badge « amélioration disponible » est recalculé au plus deux fois par seconde.
function isUpgradeCached(ui, state, item) {
  const now = performance.now();
  const key = `${item.id}|${Object.values(state.equipment).map((i) => i?.id).join(',')}|${state.upgrades.damage}|${state.upgrades.attackSpeed}`;
  ui.upgradeCache ??= new Map();
  const hit = ui.upgradeCache.get(key);
  if (hit && now - hit.t < 500) return hit.v;
  const v = isUpgrade(state, item);
  ui.upgradeCache.set(key, { t: now, v });
  if (ui.upgradeCache.size > 500) ui.upgradeCache.clear();
  return v;
}
