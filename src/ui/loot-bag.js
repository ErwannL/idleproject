// v9.7.1 : sac de butin posé dans la scène (bas droite). Les objets lâchés y volent et attendent un tri rapide :
// Sac (garder), Coffre (ranger) ou Recycler, sans quitter le combat. Pastille = nombre d'objets, liseré = meilleure
// rareté, flèche verte = au moins une amélioration. Volet ancré à droite sur PC, feuille du bas sur téléphone.
import { compareWithEquipped, isUpgrade, lootBagKeepBestChoices, lootBagList, lootBagOn, lootBagSummary, suggestLootDest } from '../core/inventory.js';
import { itemFrame, escapeHtml } from './common.js';
import { formatNumber } from '../core/format.js';

const DESTS = [['bag', '🎒', 'Sac'], ['stash', '📦', 'Coffre'], ['recycle', '♻', 'Recycler']];

export class LootBag {
  constructor(ui) {
    this.ui = ui;
    this.choices = {};
    this.remember = false;
    this.open = false;
    this.compareId = null;
    const area = document.getElementById('stage-area');
    this.btn = document.createElement('button');
    this.btn.id = 'loot-bag';
    this.btn.className = 'hidden';
    this.btn.title = 'Sac de butin (B)';
    this.btn.innerHTML = '<span class="lb-ico">🎒</span><b class="lb-count"></b><i class="lb-up hidden">▲</i>';
    this.btn.addEventListener('click', () => this.toggle());
    area?.appendChild(this.btn);
    this.sheet = document.createElement('div');
    this.sheet.id = 'loot-sheet';
    this.sheet.className = 'hidden';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-label', 'Sac de butin');
    (area ?? document.body).appendChild(this.sheet);
    this.sheet.addEventListener('click', (e) => this.onClick(e));
    this.sheet.addEventListener('contextmenu', (e) => {
      const cell = e.target.closest('[data-lb-id]');
      if (!cell) return;
      e.preventDefault();
      this.compareId = this.compareId === cell.dataset.lbId ? null : cell.dataset.lbId;
      this.render();
    });
    // Appui long (téléphone) : comparaison avec l'objet porté.
    let timer = 0;
    this.sheet.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('[data-lb-id]');
      if (!cell) return;
      timer = setTimeout(() => { this.longPressed = true; this.compareId = cell.dataset.lbId; this.render(); }, 450);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) this.sheet.addEventListener(ev, () => clearTimeout(timer));
    this.lastKey = '';
  }

  get state() { return this.ui.state; }
  available() { return Boolean(this.state && lootBagOn(this.state) && this.state.lootBag.length); }

  bump() {
    this.btn.classList.remove('lb-bump');
    void this.btn.offsetWidth; // relance l'animation de saut
    this.btn.classList.add('lb-bump');
  }

  toggle(force) {
    this.open = force ?? !this.open;
    if (this.open && !this.available()) this.open = false;
    if (!this.open) { this.choices = {}; this.compareId = null; }
    this.sheet.classList.toggle('hidden', !this.open);
    this.btn.classList.toggle('active', this.open);
    this.render();
  }

  // Appelée à chaque image : met à jour la pastille (léger : seulement si le contenu change).
  update(state) {
    const sum = state && lootBagOn(state) ? lootBagSummary(state) : { count: 0 };
    const key = `${sum.count}|${sum.best}|${sum.upgrade}|${document.getElementById('app')?.classList.contains('layout-strip')}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const strip = document.getElementById('app')?.classList.contains('layout-strip');
    this.btn.classList.toggle('hidden', !sum.count || strip);
    this.btn.querySelector('.lb-count').textContent = sum.count > 99 ? '99+' : String(sum.count);
    this.btn.querySelector('.lb-up').classList.toggle('hidden', !sum.upgrade);
    this.btn.className = this.btn.className.replace(/\br-\w+/g, '').trim();
    if (sum.best) this.btn.classList.add(`r-${sum.best}`);
    if (!sum.count && this.open) this.toggle(false);
    else if (this.open) this.render();
  }

  destOf(item) { return this.choices[item.id] ?? suggestLootDest(this.state, item); }

  onClick(e) {
    if (this.longPressed) { this.longPressed = false; return; }
    const t = e.target.closest('[data-lb]');
    if (!t) return;
    const act = t.dataset.lb;
    if (act === 'dest') { this.choices[t.dataset.id] = t.dataset.value; this.render(); }
    else if (act === 'cycle') {
      const item = this.state.lootBag.find((i) => i.id === t.dataset.id);
      if (!item) return;
      const order = DESTS.map((d) => d[0]);
      this.choices[item.id] = order[(order.indexOf(this.destOf(item)) + 1) % order.length];
      this.render();
    } else if (act === 'remember') { this.remember = t.checked; }
    else if (act === 'close') this.toggle(false);
    else if (act === 'apply') this.apply(this.choices);
    else if (act === 'keep-best') this.apply(lootBagKeepBestChoices(this.state));
  }

  apply(choices) {
    this.ui.actions.sortLootBag?.(choices, this.remember);
    this.choices = {};
    this.compareId = null;
    this.lastKey = '';
    this.update(this.state);
    if (!this.available()) this.toggle(false);
  }

  render() {
    if (!this.open || !this.state) return;
    const state = this.state;
    const items = lootBagList(state);
    const counts = { bag: 0, stash: 0, recycle: 0 };
    const cells = items.map((item) => {
      const dest = this.destOf(item);
      counts[dest] += 1;
      const frame = itemFrame(item, { tag: 'span', showUp: true, state });
      return `<div class="lb-cell d-${dest}" data-lb-id="${item.id}">
        <button class="lb-frame" data-lb="cycle" data-id="${item.id}" title="${escapeHtml(item.name)} — clic droit / appui long : comparer">${frame}</button>
        <div class="lb-dests" role="group">${[['bag', 'Garder'], ['recycle', 'Recycler']].map(([v, l]) => `<button class="lb-d lb-word${dest === v || (v === 'bag' && dest === 'stash') ? ' on' : ''}" data-lb="dest" data-id="${item.id}" data-value="${v}" aria-pressed="${dest === v}">${l}</button>`).join('')}</div>
      </div>`;
    }).join('');
    const cmpItem = this.compareId && items.find((i) => i.id === this.compareId);
    let cmp = '';
    if (cmpItem) {
      const d = compareWithEquipped(state, cmpItem);
      const fmt = (v) => `<b class="${v > 0 ? 'good' : v < 0 ? 'bad' : 'muted'}">${v > 0 ? '+' : ''}${formatNumber(Math.round(v))}</b>`;
      cmp = `<div class="lb-cmp"><b>${escapeHtml(cmpItem.name)}</b>${isUpgrade(state, cmpItem) ? ' <span class="good">▲ meilleur</span>' : ''}<br>
        Dégâts ${fmt(d.damage)} · DPS ${fmt(d.dps)} · PV ${fmt(d.maxHp)} · Armure ${fmt(d.armor)}</div>`;
    }
    this.sheet.innerHTML = `<header class="lb-head"><b>Sac de butin</b> <span class="muted">${items.length} objet${items.length > 1 ? 's' : ''}</span>
        <button class="lb-x" data-lb="close" aria-label="Fermer">✕</button></header>
      <div class="lb-grid">${cells}</div>
      ${cmp}
      <label class="toggle lb-remember"><input type="checkbox" data-lb="remember" ${this.remember ? 'checked' : ''}> Retenir pour la prochaine fois</label>
      <div class="lb-actions"><button class="btn primary" data-lb="apply">Valider</button>
        <button class="btn" data-lb="keep-best">Tout recycler sauf les meilleurs</button></div>`;
  }
}
