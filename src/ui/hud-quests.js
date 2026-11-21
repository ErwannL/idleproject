// v10.6 (partie 2) : des quêtes et des événements toujours visibles sur l'écran de jeu (disposition inspirée des jeux du
// genre, dessins et textes d'Ascendrya) :
//   1. « Chemin du héros » en haut à gauche, sous la carte de zone : image du monde, « CH. n », l'étape en cours des
//      Chroniques (une ligne, jamais coupée), une barre, la récompense en icônes, « Y aller » ou « Récupérer ». Quête
//      finie : la carte s'illumine d'or, les icônes volent vers la barre du haut, la suivante glisse à sa place.
//   2. « Carnet du jour » en 3 lignes sous la carte (les tâches les plus proches de la fin ; une tâche finie passe en
//      vert avec ✓). Sur téléphone, une seule puce « Carnet 4/8 ».
//   3. Colonne d'événements à droite, sous les boosts : Marché des Lueurs, Faille du jour, Roue, Arène, Bastion, Coffre du
//      jour (et la Prime rangée). Minuteur et pastille ; la plus urgente pulse doucement. Téléphone : 4 icônes et « + ».
//   4. « Prime du Héraut » : affiche qui arrive en glissant en haut au centre (boss de donjon, 6 h, récompense,
//      « Combattre ») ; refusable ; rangée dans la colonne si on ne la touche pas.
// Ces éléments remplacent le bandeau de quête, la puce « Faille du jour » et la tour du Bastion posée sur la scène.
import { escapeHtml, img, rewardIcons } from './common.js';
import { chronicleNow, chroniclesState } from '../core/chronicles.js';
import { daybookComplete, daybookOf, daybookTasks } from '../core/daybook.js';
import { daybookOpen } from './panels/daybook.js';
import { lightsEvent, lightsReady, LIGHTS_EVENT } from '../core/lights.js';
import { currentEvent } from '../core/ancients.js';
import { wheelReady } from '../core/wheel.js';
import { titanTriesLeft, titanToday } from '../core/titan.js';
import { arenaUnlocked } from '../core/arena.js';
import { bastionOf } from '../core/bastion.js';
import { bastionBadge } from './panels/camp.js';
import { activeBounty, maybeStartBounty } from '../core/herald-bounty.js';
import { liveNow } from '../core/live.js';
import { stageLabel } from '../core/combat.js';
import { calm as calmFx } from './ui-vfx.js';

const ART = 'assets/ui/art106/';
export const BOSS_ART = { crypt: 'boss_spectral_queen', sanctuary: 'boss_rotting_dryad', furnace: 'boss_magma_colossus', glacier: 'boss_frost_wyrm', citadel: 'boss_obsidian_tyrant' };
const FOLD_AFTER = 12000; // l'affiche de prime se range si on ne la touche pas (ms)
const DAY = 86400000;

const pad = (n) => String(n).padStart(2, '0');
export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
export function shortTime(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  if (m >= 1440) return `${Math.ceil(m / 1440)} j`;
  return m >= 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)}` : `${m} min`;
}
const toMidnight = (now) => { const d = new Date(now); d.setHours(24, 0, 0, 0); return d - now; };

// Numéro du monde (chapitre) du record du joueur, de 1 à 12.
export function chapterOf(state) {
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  return Math.max(1, Math.min(12, Number(String(stageLabel(best)).split('-')[0]) || 1));
}

// Quête du « Chemin du héros » : l'étape en cours des Chroniques.
export function heroPathQuest(state) {
  const ch = chronicleNow(state);
  if (!ch) return null;
  const i = chroniclesState(state).claimed;
  return { title: ch.need, chapter: chapterOf(state), reward: ch.reward, ready: ch.ready, key: `${i}`, progress: ((i % 5) + (ch.ready ? 1 : 0)) / 5, step: (i % 5) + 1 };
}

// Les 3 tâches du Carnet à montrer : les moins loin de la fin d'abord, puis les finies.
export function carnetTop(state, open, now = Date.now()) {
  const tasks = daybookTasks(state, open, now);
  const todo = tasks.filter((t) => !t.done).sort((a, b) => b.n / b.target - a.n / a.target);
  const done = tasks.filter((t) => t.done);
  return { list: [...todo, ...done].slice(0, 3), done: done.length, total: tasks.length };
}

// Icônes de la colonne d'événements, dans l'ordre ; chacune : id, image, nom, minuteur, pastille, action, valeur, urgent.
export function eventColumn(ui, state, now = Date.now()) {
  const vis = (tab) => ui.tabVisible?.[tab] !== false;
  const out = [];
  const t = liveNow(now);
  const ev = currentEvent(t);
  if (ev && vis('event')) {
    const small = Boolean(lightsEvent(t));
    const ready = small ? lightsReady(state, t) : 0;
    out.push({ id: 'market', art: small ? LIGHTS_EVENT.art.hud : `${ART}hud_event_pass.png`, name: small ? LIGHTS_EVENT.title : 'Expédition', timer: shortTime(ev.end - t), badge: ready, action: 'open-tab', value: 'event', soon: ev.end - t < 3600000 });
  }
  if (vis('event')) {
    const tries = titanTriesLeft(state);
    out.push({ id: 'rift', art: `${ART}hud_event_rift.png`, name: 'Faille du jour', timer: shortTime(toMidnight(now)), badge: tries > 0 ? 1 : 0, action: 'rift-open', value: '', soon: tries > 0 && toMidnight(now) < 3600000, title: titanToday(now).name });
  }
  const wr = wheelReady(state, now);
  out.push({ id: 'wheel', art: `${ART}hud_event_wheel.png`, name: 'Roue', timer: wr ? 'gratuit' : shortTime(toMidnight(now)), badge: wr ? 1 : 0, action: 'wheel-open', value: '', ready: wr });
  if (vis('arena') && arenaUnlocked(state)) {
    const played = (daybookOf(state, now).counts.arena ?? 0) > 0;
    out.push({ id: 'arena', art: `${ART}hud_event_arena.png`, name: 'Arène', timer: state.arena?.floor ? `étage ${state.arena.floor}` : '', badge: played ? 0 : 1, action: 'open-tab', value: 'arena' });
  }
  if (bastionOf(state)) {
    const n = bastionBadge(state);
    out.push({ id: 'bastion', art: `${ART}hud_event_bastion.png`, name: 'Bastion', timer: '', badge: n, action: 'bastion-tower', value: '', ready: n > 0 });
  }
  const open = daybookOpen(ui);
  const book = daybookOf(state, now);
  const all = daybookComplete(state, open);
  out.push({ id: 'chest', art: `${ART}hud_event_daily_chest.png`, name: 'Coffre du jour', timer: book.chest ? 'demain' : '', badge: all && !book.chest ? 1 : 0, action: 'open-tab', value: 'daybook', ready: all && !book.chest });
  const b = activeBounty(state, now);
  if (b?.folded) out.splice(1, 0, { id: 'bounty', art: `${ART}hud_event_bounty.png`, name: 'Prime', timer: b.done ? 'prête' : shortTime(b.left), badge: b.done ? 1 : 0, action: 'bounty-open', value: '', ready: b.done, soon: b.left < 3600000 });
  // La plus urgente pulse : une récompense prête d'abord, sinon un minuteur sous 1 h.
  const hot = out.find((x) => x.ready || (x.badge && x.id === 'market')) ?? out.find((x) => x.soon);
  if (hot) hot.hot = true;
  return out;
}

function pathHtml(q) {
  if (!q) return '';
  const btn = q.ready ? '<span class="hq-btn gold">Récupérer</span>' : '<span class="hq-btn">Y aller</span>';
  return `<img class="px hq-world" src="${ART}hud_quest_chapter_${q.chapter}.png" alt="">
    <span class="hq-main"><small class="hq-kicker">Chemin du héros · Ch. ${q.chapter}</small><b class="hq-title">${escapeHtml(q.title)}</b>
    <span class="hq-bar"><i style="width:${Math.round(q.progress * 100)}%"></i></span>
    <span class="hq-foot"><span class="hq-reward">${rewardIcons(q.reward)}</span>${btn}</span></span>`;
}
function carnetHtml(c, phone) {
  if (phone) return `<button class="hq-carnet-chip" data-action="open-tab" data-value="daybook">${img('icon_trophy')}<b>Carnet ${c.done}/${c.total}</b></button>`;
  const rows = c.list.map((t) => {
    const act = t.done ? 'data-action="open-tab" data-value="daybook"' : t.action ? `data-action="${t.action}"` : `data-action="open-tab" data-value="${t.tab}"`;
    return `<button class="hq-task${t.done ? ' done' : ''}" ${act}>${img(t.icon)}<span>${escapeHtml(t.title)}</span><b class="num">${t.done ? '✓' : `${t.n}/${t.target}`}</b></button>`;
  }).join('');
  return `<button class="hq-carnet-title" data-action="open-tab" data-value="daybook">Carnet du jour ${c.done}/${c.total} ›</button>${rows}`;
}
// v10.7 (partie 2) : une rangée accrochée sous la bande du haut. max : nombre d'icônes qui tiennent dans la largeur
// libre (entre la carte de zone et les boosts) ; le reste passe dans « + », qui déplie une seconde rangée.
const SHORT = { market: 'Marché', rift: 'Faille', wheel: 'Roue', arena: 'Arène', bastion: 'Bastion', chest: 'Coffre', bounty: 'Prime' };
export const shortName = (x) => SHORT[x.id] ?? x.name;
function columnHtml(items, max, expanded) {
  const cut = items.length > max ? Math.max(1, max - 1) : items.length;
  const shown = expanded ? items : items.slice(0, cut);
  const more = items.length > cut ? `<button class="hq-ev hq-more" data-action="hq-more" aria-label="Plus d'événements" aria-expanded="${expanded}"><span class="hq-ev-art">${expanded ? '−' : '+'}</span><small>${expanded ? 'Moins' : `${items.length - cut} de plus`}</small></button>` : '';
  return shown.map((x) => `<button class="hq-ev${x.hot ? ' hot' : ''}" data-hq="${x.id}" data-action="${x.action}" ${x.value ? `data-value="${x.value}"` : ''} title="${escapeHtml(x.title ?? x.name)}">
      <span class="hq-ev-art"><img class="px" src="${x.art}" alt="">${x.timer ? `<i class="hq-ev-timer">${escapeHtml(x.timer)}</i>` : ''}</span>
      ${x.badge ? `<b class="hq-dot">${x.badge > 9 ? '9+' : x.badge}</b>` : ''}<small>${escapeHtml(shortName(x))}</small></button>`).join('') + more;
}
function bountyHtml(b) {
  return `<span class="hb-frame"></span><img class="px hb-boss" src="assets/ui/art102/${BOSS_ART[b.dungeon] ?? 'boss_frost_wyrm'}.png" alt="">
    <span class="hb-main"><small class="hb-kicker">Prime du Héraut</small><b class="hb-name">${escapeHtml(b.name)}</b>
    <b class="hb-clock num">${b.done ? 'Vaincu !' : clock(b.left)}</b><span class="hb-reward">${rewardIcons(b.reward)}</span></span>
    ${b.done ? '<img class="px hb-stamp" src="' + ART + 'hud_bounty_stamp.png" alt="">' : ''}
    <span class="hb-actions">${b.done ? '<button class="btn btn-gold hb-go" data-action="bounty-claim">Récupérer</button>'
      : `<button class="btn btn-gold hb-go" data-action="open-tab" data-value="dungeons" data-bounty="go">Combattre</button>`}
    <button class="hb-x" data-action="bounty-refuse" aria-label="Pas maintenant" title="Pas maintenant">×</button></span>`;
}

export class HudQuests {
  constructor(ui) {
    this.ui = ui;
    this.last = 0;
    this.sessionStart = typeof performance !== 'undefined' ? performance.now() : 0;
    const area = document.getElementById('stage-area');
    this.root = document.createElement('div');
    this.root.id = 'hud106';
    this.root.innerHTML = `<button id="hq-path" class="hidden" type="button" aria-label="Chemin du héros"></button>
      <div id="hq-carnet" class="hidden"></div><div id="hq-events" class="hidden"></div>
      <div id="hq-bounty" class="hidden" role="dialog" aria-label="Prime du Héraut"></div>`;
    area?.appendChild(this.root);
    this.path = this.root.querySelector('#hq-path');
    this.carnet = this.root.querySelector('#hq-carnet');
    this.events = this.root.querySelector('#hq-events');
    this.bounty = this.root.querySelector('#hq-bounty');
    this.expanded = false;
    this.path.addEventListener('click', () => this.onPath());
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      if (b.dataset.action === 'hq-more') { e.stopPropagation(); this.expanded = !this.expanded; this.events.dataset.h = ''; this.update(this.ui.state, true); }
      if (b.dataset.action === 'bounty-open') { e.stopPropagation(); this.unfold(); }
      if (b.dataset.bounty === 'go') this.touchedBounty = true;
    }, true);
  }

  get phone() { return Boolean(this.ui.phone) || (this.ui.root?.clientWidth ?? 1000) < 560; }
  // v10.6 (partie 7) : scène très large et basse (fenêtre large) : Carnet en puce, événements en rangée en haut à droite,
  // pour ne jamais recouvrir l'équipe ni le coffre.
  get wide() { const a = this.root.parentElement; return Boolean(a && a.clientWidth > 2 * a.clientHeight); }

  onPath() {
    const q = this.quest;
    if (!q) return;
    if (!q.ready) { this.ui.openTab?.('campaign'); return; }
    // Quête finie : éclat doré, icônes qui volent vers la barre du haut (claimFly via clickFx), la suivante glisse.
    this.path.classList.remove('hq-burst'); void this.path.offsetWidth; this.path.classList.add('hq-burst');
    const r = this.ui.actions.claimChronicle?.();
    if (r) { this.flyRewards(r.given); this.ui.toast?.(r.prize ? `${r.title} : ${r.prize}` : r.title); }
    this.slideNext = true;
    this.update(this.ui.state, true);
  }
  flyRewards(given) {
    if (!given || typeof document === 'undefined' || calmFx()) return;
    const from = this.path.querySelector('.hq-reward')?.getBoundingClientRect() ?? this.path.getBoundingClientRect();
    const targets = { gold: '[data-currency="gold"]', gems: '[data-currency="gems"]' };
    let k = 0;
    for (const [kind] of Object.entries(given)) {
      const t = document.querySelector(targets[kind] ?? '[data-currency="gems"]')?.getBoundingClientRect();
      if (!t) continue;
      const el = document.createElement('img');
      el.className = 'px hq-fly';
      el.src = `${ART}fx_reward_fly.png`;
      el.style.left = `${from.left + from.width / 2}px`; el.style.top = `${from.top + from.height / 2}px`;
      el.style.setProperty('--dx', `${t.left + t.width / 2 - from.left - from.width / 2}px`);
      el.style.setProperty('--dy', `${t.top + t.height / 2 - from.top - from.height / 2}px`);
      el.style.animationDelay = `${k++ * 120}ms`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    }
  }
  unfold() {
    const a = this.ui.state?.heraldBounty?.active;
    if (!a) return;
    if (a.done) { const g = this.ui.actions.bountyClaim?.(); if (g) this.ui.chestReveal?.(g, 'Prime du Héraut'); return; }
    a.folded = false; this.shownAt = performance.now(); this.touchedBounty = true;
    this.update(this.ui.state, true);
  }

  // v10.7 (partie 2) : la rangée se pose juste sous la bande du haut, de la carte de zone (à gauche) aux boosts (à
  // droite) ; sur téléphone, sur toute la largeur. Renvoie le nombre d'icônes (64 px + écart) qui tiennent.
  placeRow() {
    const area = this.root.parentElement;
    const A = area?.getBoundingClientRect();
    if (!A?.width) return 4;
    const vis = (id) => { const e = document.getElementById(id); if (!e || e.classList.contains('hidden') || e.offsetParent === null) return null; const r = e.getBoundingClientRect(); return r.width && r.top - A.top < 140 ? r : null; };
    let left = 6, right = A.width - 6;
    if (!this.phone) {
      const z = vis('zone-card'); if (z) left = z.right - A.left + 8;
      for (const id of ['boost-group', 'skill-bar', 'rush-bar', 'auto-toggle']) { const r = vis(id); if (r && r.left - A.left > left + 60) right = Math.min(right, r.left - A.left - 8); }
    }
    const w = Math.max(80, right - left);
    const st = this.events.style;
    const L = `${Math.round(left)}px`, W = `${Math.round(w)}px`;
    if (st.left !== L) st.left = L;
    if (st.maxWidth !== W) st.maxWidth = W;
    const cell = this.phone ? 58 : 70;
    return Math.max(2, Math.floor((w - 12) / cell));
  }

  // Appelée à chaque image ; le contenu ne change que deux fois par seconde (et seulement s'il change).
  update(state, force = false) {
    if (!state || typeof document === 'undefined') return;
    const now = performance.now();
    if (!force && now - this.last < 500) return;
    this.last = now;
    const ui = this.ui;
    const calm = ui.calmStart?.(state) ?? { early: false };
    const off = ui.layout === 'strip' || calm.early || ui.arenaOpen || Boolean(state.dungeon || state.tower || state.challenge);
    this.root.classList.toggle('hidden', off);
    this.root.classList.toggle('hq-phone', this.phone);
    this.root.classList.toggle('hq-wide', !this.phone && this.wide);
    if (off) return;
    const t = Date.now();
    // 1. Chemin du héros
    const q = (this.quest = heroPathQuest(state));
    const ph = pathHtml(q);
    if (this.path.dataset.h !== ph) {
      const was = this.path.dataset.key;
      this.path.dataset.h = ph; this.path.innerHTML = ph; this.path.dataset.key = q?.key ?? '';
      if (was && q && was !== q.key) { this.path.classList.remove('hq-enter'); void this.path.offsetWidth; this.path.classList.add('hq-enter'); }
      fitLine(this.path.querySelector('.hq-title'));
    }
    this.path.classList.toggle('hidden', !q);
    this.path.classList.toggle('ready', Boolean(q?.ready));
    // 2. Carnet du jour
    const c = carnetTop(state, daybookOpen(ui), t);
    const ch = c.total ? carnetHtml(c, this.phone || this.wide) : '';
    if (this.carnet.dataset.h !== ch) { this.carnet.dataset.h = ch; this.carnet.innerHTML = ch; }
    this.carnet.classList.toggle('hidden', !ch);
    // 4. Prime du Héraut (avant la colonne : une prime rangée y prend sa place)
    const started = maybeStartBounty(state, t, (now - this.sessionStart) / 1000);
    if (started) { this.shownAt = now; this.touchedBounty = false; }
    const b = activeBounty(state, t);
    if (b && !b.folded && !this.touchedBounty && this.shownAt && now - this.shownAt > FOLD_AFTER) { ui.actions.bountyFold?.(); this.shownAt = 0; }
    const showPoster = Boolean(b && !state.heraldBounty.active?.folded);
    if (showPoster && !this.shownAt) this.shownAt = now;
    const bh = showPoster ? bountyHtml(b) : '';
    if (this.bounty.dataset.h !== bh) {
      const fresh = !this.bounty.dataset.h && bh;
      this.bounty.dataset.h = bh; this.bounty.innerHTML = bh;
      if (fresh) { this.bounty.classList.remove('hb-arrive'); void this.bounty.offsetWidth; this.bounty.classList.add('hb-arrive'); }
    }
    this.bounty.classList.toggle('hidden', !showPoster);
    // 3. Colonne d'événements
    const room = this.placeRow();
    const eh = columnHtml(eventColumn(ui, state, t), room, this.expanded);
    if (this.events.dataset.h !== eh) { this.events.dataset.h = eh; this.events.innerHTML = eh; }
    this.events.classList.toggle('hidden', !eh);
    this.events.classList.toggle('expanded-col', this.expanded);
  }
}

// Le titre de l'étape tient sur une ligne, jamais coupé : la police descend jusqu'à 11 px s'il le faut.
function fitLine(el) {
  if (!el) return;
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize) || 15;
  for (let i = 0; i < 8 && el.scrollWidth > el.clientWidth + 1 && size > 11; i++) { size -= 1; el.style.fontSize = `${size}px`; }
}

export const DAY_MS = DAY;
