// v9.7.1 : sac de butin posé dans la scène. Les objets lâchés y volent et attendent un tri rapide : Garder, Ranger
// (Réserve) ou Recycler, sans quitter le combat. Volet ancré à droite sur PC, feuille du bas sur téléphone.
// v10.3.1 (plan 10.2, partie 7) : le coffre est dessiné dans la scène (render/loot-chest.js) ; ce bouton reste, invisible,
// posé exactement sur le coffre dessiné (clic, appui, clavier, lecteurs d'écran ; touche B dans shortcuts.js).
import { LOOT_BAG_MAX, compareWithEquipped, isUpgrade, lootBagKeepBestChoices, lootBagList, lootBagOn, lootBagSummary, suggestLootDest } from '../core/inventory.js';
import { itemFrame, escapeHtml } from './common.js';
import { formatNumber } from '../core/format.js';
import { LootChest, RANK, bubbleFor, chestShown } from '../render/loot-chest.js';

const DESTS = [['bag', '▲', 'Équiper / garder'], ['stash', '📦', 'Ranger (Réserve)'], ['recycle', '♻', 'Recycler']];

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
    this.btn.setAttribute('aria-expanded', 'false');
    // Rien de visible : pastille, flèche et bulle sont dessinées dans la scène ; ces textes servent aux lecteurs d'écran.
    this.btn.innerHTML = '<b class="lb-count"></b><i class="lb-up hidden">▲</i><span class="lb-bubble hidden"></span>';
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
    this.placeKey = '';
  }

  get state() { return this.ui.state; }
  // Coffre dessiné par la scène principale (elle seule : Arène, prologue et vitrines ont leur propre SceneRenderer).
  get chest() {
    const r = this.ui.renderer;
    if (!r) return null;
    const c = (r.lootChest ??= new LootChest());
    // v10.4 : la cloche d'un objet Légendaire (volume et sourdine = réglages du son du jeu).
    if (!c.onLegendary) c.onLegendary = () => this.ui.sound?.play?.('chestBell');
    return c;
  }
  available() { return Boolean(this.state && lootBagOn(this.state) && this.state.lootBag.length); }

  // Un objet arrive : il vole du monstre au coffre, le couvercle s'entrouvre et 3 pièces sautent (dans la scène) ;
  // bulle la première fois puis selon la rareté : Rare, Épique, Légendaire (2 s).
  bump(item = null, fromX = null) {
    try { this.chest?.bump(item, fromX); } catch { /* objet incomplet : pas de vol */ }
    const st = this.state;
    const first = Boolean(st?.ui && !(st.ui.hints ?? []).includes('loot-chest'));
    if (first) (st.ui.hints ??= []).push('loot-chest');
    const text = bubbleFor(item, first);
    if (text) this.say(text, 2000, item?.id);
  }
  // Bulle : lue tout de suite par les lecteurs d'écran ; dessinée dans la scène à l'arrivée de l'objet au coffre (v10.4).
  say(text, ms, itemId = null) {
    const b = this.btn.querySelector('.lb-bubble');
    b.textContent = text; b.classList.remove('hidden');
    if (itemId != null && this.chest?.flies.some((f) => f.id === itemId)) this.chest.bubbleOnArrival(itemId, text, ms);
    else this.chest?.say(text, ms);
    clearTimeout(this.sayT); this.sayT = setTimeout(() => b.classList.add('hidden'), ms);
  }

  toggle(force) {
    this.open = force ?? !this.open;
    if (this.open && !this.available()) this.open = false;
    if (!this.open) { this.choices = {}; this.compareId = null; }
    this.sheet.classList.toggle('hidden', !this.open);
    this.btn.classList.toggle('active', this.open);
    this.btn.setAttribute('aria-expanded', String(this.open));
    this.render();
  }

  // Appelée à chaque image : contenu du coffre (seulement s'il change), puis zone de toucher posée sur le coffre dessiné.
  update(state) {
    const sum = state && lootBagOn(state) ? lootBagSummary(state) : { count: 0 };
    const shown = chestShown(state, this.ui);
    const key = `${sum.count}|${sum.best}|${sum.upgrade}|${shown}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      const full = sum.count >= LOOT_BAG_MAX;
      this.chest?.set({ count: sum.count, best: sum.best, upgrade: sum.upgrade, full, shown });
      this.btn.querySelector('.lb-count').textContent = sum.count > 99 ? '99+' : String(sum.count);
      this.btn.querySelector('.lb-up').classList.toggle('hidden', !sum.upgrade);
      this.btn.setAttribute('aria-label', `Coffre de butin : ${sum.count} objet${sum.count > 1 ? 's' : ''}${sum.upgrade ? ' (amélioration)' : ''}`);
      this.btn.className = this.btn.className.replace(/\br-\w+/g, '').trim();
      if (sum.best) this.btn.classList.add(`r-${sum.best}`);
      this.btn.classList.toggle('lb-epic', RANK.indexOf(sum.best) >= RANK.indexOf('epic'));
      if (full && !this.btn.classList.contains('lb-full')) this.say('Coffre plein : trie-le', 3000);
      this.btn.classList.toggle('lb-full', full);
      if (!sum.count && this.open) this.toggle(false);
      else if (this.open) this.render();
    }
    this.place(shown);
  }

  // Zone de toucher (≥ 44 px) exactement sur le coffre dessiné ; cachée quand la scène ne le dessine pas.
  place(shown) {
    const c = this.chest, r = c?.rect;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (!shown || !r || now - c.drawnAt > 500) {
      if (this.placeKey !== 'off') { this.placeKey = 'off'; this.btn.classList.add('hidden'); }
      return;
    }
    if (!this.offset || now - this.offsetAt > 500) {
      const cv = this.ui.renderer?.canvas, area = this.btn.parentElement;
      const a = area?.getBoundingClientRect(), b = cv?.getBoundingClientRect();
      this.offset = a && b ? { x: b.left - a.left, y: b.top - a.top } : { x: 0, y: 0 };
      this.offsetAt = now;
    }
    const x = Math.round(this.offset.x + r.x), y = Math.round(this.offset.y + r.y);
    const key = `${x}|${y}|${r.w}|${r.h}`;
    if (key === this.placeKey) return;
    this.placeKey = key;
    const st = this.btn.style;
    st.left = `${x}px`; st.top = `${y}px`; st.width = `${r.w}px`; st.height = `${r.h}px`;
    this.btn.classList.remove('hidden');
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
