// v9.7.1 : sac de butin posé dans la scène. Les objets lâchés y volent et attendent un tri rapide : Garder, Ranger
// (Réserve) ou Recycler, sans quitter le combat. Volet ancré à droite sur PC, feuille du bas sur téléphone.
// v10.3.1 (plan 10.2, partie 7) : le coffre est dessiné dans la scène (render/loot-chest.js) ; ce bouton reste, invisible,
// posé exactement sur le coffre dessiné (clic, appui, clavier, lecteurs d'écran ; touche B dans shortcuts.js).
import { LOOT_BAG_MAX, compareWithEquipped, isUpgrade, lootBagKeepBestChoices, lootBagList, lootBagOn, lootBagSummary, suggestLootDest } from '../core/inventory.js';
import { escapeHtml, itemPic } from './common.js';
import { LootChest, RANK, bubbleFor, chestShown } from '../render/loot-chest.js';

const DESTS = [['bag', '▲', 'Équiper / garder'], ['stash', '📦', 'Ranger (Réserve)'], ['recycle', '♻', 'Recycler']];
const DEST_ART = { bag: 'sort_keep', stash: 'sort_store', recycle: 'sort_recycle' }; // v10.6 (5) : choix dessiné sur l'objet
const DEST_LABEL = { bag: 'Garder', stash: 'Ranger', recycle: 'Recycler' };

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
    // v10.9 (partie 4) : le coffre est un vrai bouton, toujours visible, à sa place fixe en bas à droite (grille du bas).
    this.btn.innerHTML = '<img class="px lb-art" src="assets/ui/art102/loot_chest.png" alt=""><b class="lb-count"></b><i class="lb-up hidden">▲</i><span class="lb-bubble hidden"></span><small class="lb-name">Butin</small>';
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
    if (!c.onLegendary) c.onLegendary = (item) => this.ui.sound?.play?.('chestBell', { rarity: item?.rarity });
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
    if (this.open && !this.available()) { this.open = false; if (force == null) this.ui.toast?.('Le coffre de butin est vide : les objets lâchés par les monstres y arrivent.'); }
    if (!this.open) { this.choices = {}; this.compareId = null; }
    this.sheet.classList.toggle('hidden', !this.open);
    this.btn.classList.toggle('active', this.open);
    this.btn.setAttribute('aria-expanded', String(this.open));
    this.render();
  }

  // Appelée à chaque image : contenu du coffre (seulement s'il change), puis zone de toucher posée sur le coffre dessiné.
  update(state) {
    const sum = state && lootBagOn(state) ? lootBagSummary(state) : { count: 0 };
    // v10.9 : plus de coffre dessiné dans la scène ; le bouton du bas est toujours là (sauf Arène, veille, coffre désactivé).
    const shown = Boolean(state && state.ui?.lootBag !== false && !this.ui.arenaOpen && !this.ui.sleeping);
    const key = `${sum.count}|${sum.best}|${sum.upgrade}|${shown}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      const full = sum.count >= LOOT_BAG_MAX;
      this.chest?.set({ count: sum.count, best: sum.best, upgrade: sum.upgrade, full, shown: false });
      this.btn.classList.toggle('lb-empty', !sum.count);
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
    const key = shown ? 'on' : 'off';
    if (key === this.placeKey) return;
    this.placeKey = key;
    this.btn.classList.toggle('hidden', !shown);
  }


  destOf(item) { return this.choices[item.id] ?? suggestLootDest(this.state, item); }

  onClick(e) {
    if (this.longPressed) { this.longPressed = false; return; }
    const t = e.target.closest('[data-lb]');
    if (!t) return;
    const act = t.dataset.lb;
    if (act === 'dest') { this.choices[t.dataset.id] = t.dataset.value; this.render(); }
    else if (act === 'open') { this.compareId = this.compareId === t.dataset.id ? null : t.dataset.id; this.render(); } // v10.6 (5) : fenêtre de l'objet
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

  // v10.6 (partie 5) : tri en grille d'icônes de 64 px — pastille de gain (±x %), choix proposé dessiné sur l'objet
  // (sac, Réserve, recyclage), toucher un objet ouvre sa fenêtre (icône en grand, verdict, choix), 2 gros boutons.
  render() {
    if (!this.open || !this.state) return;
    const state = this.state;
    const items = lootBagList(state);
    const pctOf = (item) => { const d = compareWithEquipped(state, item); return d.dpsBefore > 0 ? (d.dps / d.dpsBefore) * 100 : 0; };
    const fmtPct = (v) => `${v > 0 ? '+' : '−'}${String(Math.round(Math.abs(v) * 10) / 10).replace('.', ',')} %`;
    const cells = items.map((item) => {
      const dest = this.destOf(item);
      const pct = pctOf(item);
      const badge = Math.abs(pct) >= 0.05 ? `<span class="lb-gain ${pct > 0 ? 'good' : 'bad'}">${fmtPct(pct)}</span>` : '';
      return `<button class="lb-tile r-${item.rarity}${this.compareId === item.id ? ' sel' : ''}" data-lb="open" data-lb-id="${item.id}" data-id="${item.id}" title="${escapeHtml(item.name)}">
        <img class="px lb-ico" src="${itemPic(item, 64)}" alt="${escapeHtml(item.name)}">${badge}
        <img class="px lb-dest" src="assets/ui/art106/${DEST_ART[dest]}.png" alt="${DEST_LABEL[dest]}" title="${DEST_LABEL[dest]}"></button>`;
    }).join('');
    const sel = this.compareId && items.find((i) => i.id === this.compareId);
    let pop = '';
    if (sel) {
      const pct = pctOf(sel), up = isUpgrade(state, sel), dest = this.destOf(sel);
      pop = `<div class="lb-pop r-${sel.rarity}"><span class="lb-pop-art"><img class="px" src="${itemPic(sel, 104)}" alt=""></span>
        <div class="lb-pop-main"><b class="rarity-text r-${sel.rarity}">${escapeHtml(sel.name)}</b>
        <div class="lb-verdict ${up ? 'good' : 'bad'}">${up ? `▲ Meilleur${pct > 0.05 ? ` : ${fmtPct(pct)} de dégâts/s` : ''}` : 'Moins bon que l\'objet porté'}</div>
        <div class="lb-dests" role="group">${DESTS.map(([v]) => `<button class="lb-d${dest === v ? ' on' : ''}" data-lb="dest" data-id="${sel.id}" data-value="${v}"><img class="px" src="assets/ui/art106/${DEST_ART[v]}.png" alt="">${v === 'bag' ? (up ? 'Équiper' : 'Garder') : v === 'stash' ? 'Ranger' : 'Recycler'}</button>`).join('')}</div></div></div>`;
    }
    this.sheet.innerHTML = `<header class="lb-head" style="background-image:url(assets/ui/art106/banner_loot.png)"><b>Coffre de butin</b> <span>${items.length} objet${items.length > 1 ? 's' : ''}</span>
        <button class="lb-x" data-lb="close" aria-label="Fermer">✕</button></header>
      <div class="lb-grid lb-grid106">${cells}</div>
      ${pop}
      <label class="toggle lb-remember"><input type="checkbox" data-lb="remember" ${this.remember ? 'checked' : ''}> Retenir pour la prochaine fois</label>
      <div class="lb-actions lb-actions106"><button class="btn btn-gold lb-keep" data-lb="keep-best">Garder le meilleur, recycler le reste</button>
        <button class="btn lb-apply" data-lb="apply">Valider mes choix</button></div>`;
  }
}
