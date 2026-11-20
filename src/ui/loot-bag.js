// v9.7.1 : sac de butin posé dans la scène (bas droite). Les objets lâchés y volent et attendent un tri rapide :
// Sac (garder), Coffre (ranger) ou Recycler, sans quitter le combat. Pastille = nombre d'objets, liseré = meilleure
// rareté, flèche verte = au moins une amélioration. Volet ancré à droite sur PC, feuille du bas sur téléphone.
import { LOOT_BAG_MAX, compareWithEquipped, isUpgrade, lootBagKeepBestChoices, lootBagList, lootBagOn, lootBagSummary, suggestLootDest } from '../core/inventory.js';
import { itemFrame, escapeHtml } from './common.js';
import { formatNumber } from '../core/format.js';

const DESTS = [['bag', '▲', 'Équiper / garder'], ['stash', '📦', 'Ranger (Réserve)'], ['recycle', '♻', 'Recycler']];
// v10.2 (P7) : le sac devient un coffre de butin dessiné, posé sur le sol de la scène derrière les ennemis.
const CHEST = 'assets/ui/art102/loot_chest.png', CHEST_OPEN = 'assets/ui/art102/loot_chest_open.png';
const GLOW = { rare: '#4a9dff', epic: '#b05aff', legendary: '#ffb020', mythic: '#ff4d6d', ancestral: '#ff4d6d' };
const RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'ancestral'];

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
    this.btn.title = 'Coffre de butin (B) : touche pour trier';
    this.btn.setAttribute('aria-label', 'Coffre de butin');
    this.btn.innerHTML = `<i class="lb-ray"></i><img class="px lb-chest" src="${CHEST}" alt=""><img class="px lb-chest-open" src="${CHEST_OPEN}" alt=""><b class="lb-count"></b><i class="lb-up hidden">▲</i><span class="lb-bubble hidden"></span><span class="lb-spill"></span>`;
    this.btn.addEventListener('click', () => this.toggle());
    area?.appendChild(this.btn);
    this.sheet = document.createElement('div');
    this.sheet.id = 'loot-sheet';
    this.sheet.className = 'hidden';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-label', 'Coffre de butin');
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

  // Un objet arrive : il vole du monstre au coffre, le couvercle s'entrouvre et 3 pièces sautent ; bulle « Butin ! » la
  // première fois puis à chaque Épique ou mieux (2 s).
  bump(item = null, fromX = null) {
    this.btn.classList.remove('lb-bump', 'lb-open');
    void this.btn.offsetWidth; // relance l'animation
    this.btn.classList.add('lb-bump', 'lb-open');
    clearTimeout(this.openT); this.openT = setTimeout(() => this.btn.classList.remove('lb-open'), 600);
    for (let i = 0; i < 3; i++) { const c = document.createElement('i'); c.className = 'lb-coin'; c.style.setProperty('--dx', `${(i - 1) * 14}px`); c.style.animationDelay = `${i * 60}ms`; this.btn.appendChild(c); setTimeout(() => c.remove(), 900); }
    if (item && typeof document !== 'undefined') this.flyIn(item, fromX);
    const st = this.state;
    const first = st?.ui && !(st.ui.hints ?? []).includes('loot-chest');
    if (first) (st.ui.hints ??= []).push('loot-chest');
    if (first || RANK.indexOf(item?.rarity) >= RANK.indexOf('epic')) this.say(first ? 'Butin ! Touche le coffre pour trier' : 'Butin !', 2000);
  }
  say(text, ms) {
    const b = this.btn.querySelector('.lb-bubble');
    b.textContent = text; b.classList.remove('hidden');
    clearTimeout(this.sayT); this.sayT = setTimeout(() => b.classList.add('hidden'), ms);
  }
  flyIn(item, fromX) {
    const area = document.getElementById('stage-area');
    const r = this.btn.getBoundingClientRect(), a = area?.getBoundingClientRect();
    if (!a || !r.width) return;
    const f = document.createElement('div');
    f.className = `lb-fly r-${item.rarity}`;
    f.innerHTML = itemFrame(item, { tag: 'div' });
    const x0 = (fromX ?? (r.left - a.left - 60)), y0 = r.top - a.top - 40;
    f.style.left = `${x0}px`; f.style.top = `${y0}px`;
    area.appendChild(f);
    requestAnimationFrame(() => { f.style.transform = `translate(${r.left - a.left + r.width / 2 - x0 - 16}px, ${r.top - a.top + r.height / 2 - y0 - 16}px) scale(.4)`; f.style.opacity = '0.2'; });
    setTimeout(() => f.remove(), 650);
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
    this.btn.style.setProperty('--glow', GLOW[sum.best] ?? 'transparent');
    this.btn.classList.toggle('lb-epic', RANK.indexOf(sum.best) >= RANK.indexOf('epic'));
    const full = sum.count >= LOOT_BAG_MAX;
    if (full && !this.btn.classList.contains('lb-full')) this.say('Coffre plein : trie-le', 3000);
    this.btn.classList.toggle('lb-full', full);
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
      // v10.2 (P7) : icône, nom en couleur de rareté, ce que l'objet apporte par rapport à l'objet porté, action proposée.
      const d = compareWithEquipped(state, item);
      const pct = d.dpsBefore > 0 ? Math.round((d.dps / d.dpsBefore) * 1000) / 10 : null;
      const gain = isUpgrade(state, item) ? `<span class="good">▲ ${pct != null && pct > 0 ? `+${String(pct).replace('.', ',')} % de dégâts/s` : 'meilleur que l\'objet porté'}</span>` : '<span class="muted">moins bon que l\'objet porté</span>';
      return `<div class="lb-cell d-${dest}" data-lb-id="${item.id}">
        <button class="lb-frame" data-lb="cycle" data-id="${item.id}" title="${escapeHtml(item.name)} — clic droit / appui long : comparer">${frame}</button>
        <div class="lb-info"><b class="rarity-text r-${item.rarity}">${escapeHtml(item.name)}</b><small>${gain}</small></div>
        <div class="lb-dests" role="group">${DESTS.map(([v, ic, l]) => `<button class="lb-d${dest === v ? ' on' : ''}" data-lb="dest" data-id="${item.id}" data-value="${v}" title="${l}">${ic} ${v === 'bag' ? (isUpgrade(state, item) ? 'Équiper' : 'Garder') : v === 'stash' ? 'Ranger' : 'Recycler'}</button>`).join('')}</div>
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
    this.sheet.innerHTML = `<header class="lb-head"><b>Coffre de butin</b> <span class="muted">${items.length} objet${items.length > 1 ? 's' : ''}</span>
        <button class="lb-x" data-lb="close" aria-label="Fermer">✕</button></header>
      <div class="lb-grid">${cells}</div>
      ${cmp}
      <label class="toggle lb-remember"><input type="checkbox" data-lb="remember" ${this.remember ? 'checked' : ''}> Retenir pour la prochaine fois</label>
      <div class="lb-actions"><button class="btn btn-gold lb-keep" data-lb="keep-best">Garder le meilleur, recycler le reste</button>
        <button class="btn" data-lb="apply">Trier à la main (valider mes choix)</button></div>`;
  }
}
