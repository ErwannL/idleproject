// v10.14.1 : onglets Brèche, Missions, Boutique et Sentier de l'écran de la fête (ui/fest-hub.js les appelle).
// Même consigne partout : une seule action dorée par onglet, la récompense se voit avant l'effort, textes de 12 px au
// moins, aucun paragraphe. Les images PixelLab (assets/ui/art1014/) ont un repli (ui/fest-art.js) : jamais d'image cassée.
import { FEST_RULES, LIGHT_PATH, RIFT_BLESSINGS } from '../data/fest.js';
import { currentFest, festMissions, festPath, festRecord, festShop, riftCoins, riftDamageMult, riftFloorLevel, riftSeconds, riftStatus } from '../core/fest.js';
import { COMPANIONS } from '../data/companions.js';
import { liveNow } from '../core/live.js';
import { stageLabel } from '../core/combat.js';
import { escapeHtml, formatNumber, img, rewardIcons } from './common.js';
import { festCoin, festGive, unitArt, unitName } from './panels/event.js';
import { walletIcon } from './panels/shop.js';
import { reduceMotion } from './prefs.js';
import { A1014, pickArt } from './fest-art.js';

const A106 = 'assets/ui/art106/';
const pad2 = (n) => String(n).padStart(2, '0');
const comma = (x, d = 2) => x.toFixed(d).replace('.', ',');
// Animation d'entrée qui survit aux redessins de l'écran (il est redessiné chaque seconde) : on garde l'heure de début et on
// décale l'animation d'autant. Renvoie le temps écoulé en ms, ou null quand l'entrée est finie (ou réduite).
const starts = new Map();
function entering(key, span = 1100) {
  if (reduceMotion()) return null;
  const now = Date.now();
  if (!starts.has(key)) { if (starts.size > 24) starts.delete(starts.keys().next().value); starts.set(key, now); }
  const el = now - starts.get(key);
  return el < span ? el : null;
}
const phase = (i, period = 3600) => `-${(Date.now() + i * 377) % period}ms`; // flottement continu d'un redessin à l'autre

// ---- Brèche : le mode de la fête ---------------------------------------------------------------------------------
const hearts = (n, max) => {
  const out = [];
  for (let i = 0; i < Math.max(n, max); i += 1) out.push(img('icon_heart', `fh-heart${i < n ? '' : ' off'}`));
  return `<span class="fh-hearts" role="img" aria-label="${n} ${n > 1 ? 'cœurs' : 'cœur'}">${out.join('')}</span>`;
};
const blessArt = (id, cls = '') => {
  const p = pickArt(`${A1014}rift_bless_${id === 'force' ? 'strength' : id}.png`, null);
  return p ? `<img class="px ${cls}" src="${p}" alt="">` : img(RIFT_BLESSINGS[id].icon, cls);
};
const stoneList = (r, run, f) => {
  const floorAt = run ? run.floor : 0;
  return Array.from({ length: r.floors }, (_, i) => {
    const n = i + 1;
    const first = FEST_RULES.rift.firstClear[n];
    const got = r.firsts.includes(n);
    const st = run ? (n < floorAt || (n === floorAt && run.offer) ? 'done' : n === floorAt ? 'next' : 'off') : n <= r.best ? 'best' : n === r.best + 1 ? 'next' : 'off';
    const chest = first ? `<span class="fh-stone-first${got ? ' got' : ''}" title="Première fois">${(() => { const c = pickArt(`${A1014}fest_node_chest.png`, null); return c ? `<img class="px fh-stone-chest" src="${c}" alt="">` : img('icon_chest', 'fh-stone-chest'); })()}<span class="fh-stone-gift">${festGive(first)}</span>${got ? '<i>✓</i>' : ''}</span>` : '';
    return `<li class="fh-stone ${st}" style="animation-delay:${phase(n)}"><span class="fh-stone-rock"><b class="num">${n}</b></span>${chest}</li>`;
  }).join('');
};

export function riftTab(state, f) {
  const r = riftStatus(state);
  if (!r) return '';
  const run = r.run;
  const bg = pickArt(`${A1014}fest_rift_bg.png`, null);
  const crystals = Array.from({ length: r.maxStock }, (_, i) => `<i class="fh-crystal${i < r.stock ? ' on' : ''}"></i>`).join('');
  const owned = run?.blessings.length ? `<div class="fh-owned" aria-label="Bénédictions prises">${run.blessings.map((id) => `<span class="fh-chip">${blessArt(id)}${escapeHtml(RIFT_BLESSINGS[id].name)}</span>`).join('')}</div>` : '';
  const side = `<aside class="fh-rcol"><ol class="fh-stones" aria-label="Les ${r.floors} paliers">${stoneList(r, run, f)}</ol>${owned}</aside>`;
  const head = `<div class="fh-rift-head"><b class="fh-h">Brèche de la fête</b><small>${r.floors} paliers · 1 bénédiction par victoire</small>
    <span class="fh-stock" aria-label="${r.stock} entrées sur ${r.maxStock}"><span class="fh-crystals">${crystals}</span><small>${r.perDay} par jour · record ${r.best}/${r.floors}</small></span></div>`;
  let main;
  if (!r.open) main = `${head}<div class="fh-card fh-lock">${img('icon_lock')} Fermée pendant l'échange.</div>`;
  else if (!run) {
    main = `${head}<div class="fh-card fh-rift-start">${img('icon_map', 'fh-rift-door')}<span><b>Prêt à entrer ?</b><small>Gardien du palier 1 : niv. ${stageLabel(riftFloorLevel(state, 1))}</small>${hearts(FEST_RULES.rift.hearts, FEST_RULES.rift.hearts)}</span>
      <button type="button" class="m-btn-gold" data-action="rift-start" ${r.stock > 0 ? '' : 'disabled'}>${img('icon_damage')}<span>${r.stock > 0 ? 'Entrer (1 entrée)' : 'Plus d\'entrée aujourd\'hui'}</span></button></div>
      <div class="fh-bless-list">${Object.entries(RIFT_BLESSINGS).map(([id, b]) => `<span class="fh-bless-mini">${blessArt(id)}<b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.text)}</small></span>`).join('')}</div>`;
  } else if (run.offer) {
    const el = entering(`rift:${run.seed}:${run.floor}`);
    const cards = run.offer.map((id, i) => {
      const b = RIFT_BLESSINGS[id];
      return `<button type="button" class="fh-bless${el !== null ? ' fh-flip' : ''}" ${el !== null ? `style="animation-delay:${i * 200 - el}ms"` : ''} data-action="rift-pick" data-value="${id}">${blessArt(id, 'fh-bless-ico')}<span><b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.text)}</small></span></button>`;
    }).join('');
    main = `${head}<div class="fh-offer-h"><b class="fh-h">Palier ${run.floor} franchi : choisis une bénédiction</b>${hearts(run.hearts, FEST_RULES.rift.hearts)}</div><div class="fh-bless-row">${cards}</div>`;
  } else {
    const dmg = riftDamageMult(run);
    main = `${head}<div class="fh-card fh-rift-fight"><span class="fh-rf-info"><b>Palier ${run.floor}/${r.floors}</b><small>Gardien niv. ${stageLabel(riftFloorLevel(state, run.floor))}</small>
        <span class="fh-bigchips"><span class="fh-bigchip">${img('icon_damage')}<b class="num">dégâts ×${comma(dmg)}</b></span><span class="fh-bigchip">${img('icon_timer')}<b class="num">${riftSeconds(run)} s</b></span></span>
        <small>Victoire : ${festCoin(f)} +${riftCoins(f, run, run.floor)} · gagné dans cette course : ${run.coins}</small></span>${hearts(run.hearts, FEST_RULES.rift.hearts)}
      <button type="button" class="m-btn" data-action="rift-quit-ask">Quitter</button>
      <button type="button" class="m-btn-gold" data-action="rift-fight">${img('icon_damage')}<span>Combattre</span></button></div>`;
  }
  return `<div class="fh-rift${bg ? ' has-bg' : ''}"${bg ? ` style="background-image:url(${bg})"` : ''}>${side}<section class="fh-rmain">${main}</section></div>`;
}

// Quitter : confirmation (on garde la monnaie gagnée), puis la fenêtre de fin de course.
export function riftQuitAsk(ui) {
  const run = riftStatus(ui.state)?.run;
  const f = currentFest();
  ui.openModal(`<div class="fh-ask"><h2 id="modal-title">Quitter la Brèche ?</h2>
    <p>${run ? `Tu gardes les ${formatNumber(run.coins)} ${escapeHtml(f?.currency ?? 'pièces')} gagnés.` : 'La course est finie.'}</p>
    <div class="detail-actions"><button class="btn" data-action="close-modal">Continuer</button><button class="btn btn-danger" data-action="rift-quit">Quitter</button></div></div>`);
}
export function riftEnd(ui, end, given = null) {
  const r = riftStatus(ui.state);
  const f = currentFest();
  const loot = given && Object.keys(given).length ? `<div class="cr-loot">${rewardIcons(given, 'named')}</div><small>Première fois au palier ${end.cleared}</small>` : '';
  ui.openModal(`<div class="fh-end"><h2 id="modal-title">Brèche terminée</h2>
    <div class="fh-end-floor"><small>Palier atteint</small><b class="num">${end.cleared} / ${r?.floors ?? FEST_RULES.rift.floors}</b><small>Record : <b class="num">${r?.best ?? end.cleared}</b></small></div>
    <div class="fh-end-coins">${f ? festCoin(f) : ''}<b class="num">+${formatNumber(end.coins)}</b><small>gagnés pendant la course</small></div>${loot}
    <div class="detail-actions">${r?.open && r.stock > 0 ? '<button class="btn btn-gold" data-action="rift-start">Encore une fois (1 entrée)</button>' : ''}<button class="btn" data-action="close-modal">Fermer</button></div></div>`);
}

// ---- Missions ----------------------------------------------------------------------------------------------------
const MISSION_ART = { kills: 'event_lights_mission_monsters', bosses: 'event_lights_mission_bosses', dungeons: 'event_lights_mission_dungeon', summons: 'event_lights_mission_summons' };
const fold = { daily: false, event: false };
export function foldMissions(key) { if (key in fold) fold[key] = !fold[key]; }
const toMidnight = (now) => { const d = new Date(now); d.setHours(24, 0, 0, 0); return d.getTime() - now; };
const hm = (ms) => { const m = Math.max(1, Math.ceil(ms / 60000)); return `${Math.floor(m / 60)} h ${pad2(m % 60)}`; };

function missionCard(f, m, solo) {
  const art = MISSION_ART[m.type] ? `<img class="px" src="${A106}${MISSION_ART[m.type]}.png" alt="">` : img(m.type === 'upgrades' ? 'icon_upgrade' : 'icon_star');
  const pct = Math.round(Math.min(1, m.p / m.n) * 100);
  const btn = m.done ? '<span class="fh-stamp">Faite ✓</span>'
    : m.ready ? `<button type="button" class="${solo ? 'm-btn-gold' : 'm-btn fh-claim'}" data-action="fest-mission" data-value="${m.id}">Récupérer</button>`
      : m.tab && f.phase === 'play' ? `<button type="button" class="m-btn" data-action="fest-go" data-value="${m.tab}">Y aller</button>` : '';
  return `<div class="fh-mission${m.done ? ' done' : ''}${m.ready ? ' ready' : ''}"><span class="fh-mission-art">${art}</span>
    <span class="fh-mission-body"><b>${escapeHtml(m.label)}</b><span class="fh-bar"><i style="width:${pct}%"></i><small class="num">${formatNumber(m.p)} / ${formatNumber(m.n)}</small></span>
      <span class="fh-mission-gift">${festCoin(f)}<b class="num">+${m.coins}</b>${m.give ? festGive(m.give) : ''}</span></span>${btn}</div>`;
}
function missionList(f, list, key, solo) {
  const todo = list.filter((x) => !x.done).sort((a, b) => (Number(b.ready) - Number(a.ready)) || (b.p / b.n - a.p / a.n));
  const done = list.filter((x) => x.done);
  const foot = done.length ? `<button type="button" class="fh-fold" data-action="fest-fold" data-value="${key}" aria-expanded="${fold[key]}">${done.length} ${done.length > 1 ? 'faites' : 'faite'} ${fold[key] ? '▾' : '▸'}</button>${fold[key] ? done.map((x) => missionCard(f, x, false)).join('') : ''}` : '';
  return `${todo.map((x) => missionCard(f, x, solo === x.id)).join('')}${foot}`;
}
export function missionsTab(state, f) {
  const m = festMissions(state);
  const all = [...m.daily, ...m.event];
  const ready = all.filter((x) => x.ready);
  const solo = ready.length === 1 ? ready[0].id : null;
  const left = f.phase === 'play' ? `Missions du jour : elles changent à minuit · ${hm(toMidnight(liveNow()))}` : 'Les missions sont fermées pendant l\'échange.';
  return `<div class="fh-banner">${img('icon_timer')}<span>${left}</span>${ready.length > 1 ? `<button type="button" class="m-btn-gold" data-action="fest-missions-all">Tout récupérer (${ready.length})</button>` : ''}</div>
    <div class="fh-cols"><section><b class="fh-h">${img('icon_timer')} Missions du jour</b>${missionList(f, m.daily, 'daily', solo)}</section>
    <section><b class="fh-h">${img('icon_trophy')} Missions de la fête</b>${missionList(f, m.event, 'event', solo)}</section></div>`;
}

// ---- Boutique ----------------------------------------------------------------------------------------------------
const SHOP_LOOK = {
  ticketLimited: { name: 'Ticket de compagnon', art: `${A106}event_lights_shop_tickets.png` },
  ticketPermanent: { name: 'Ticket permanent', wallet: true },
  ticketPet: { name: 'Ticket de familier', wallet: true },
  ssrFragment: { name: 'Fragment Légendaire', icon: 'icon_crown' },
  grimoire: { name: 'Grimoires', icon: 'icon_grimoire' },
  ascension: { name: 'Pierres d\'ascension', art: `${A106}event_lights_shop_essence.png` },
  mastery: { name: 'Essences de maîtrise', icon: 'icon_mastery' },
  keys: { name: 'Clés', art: `${A106}event_lights_shop_keys.png` },
  shards: { name: 'Éclats', art: `${A106}event_lights_shop_shards.png` },
  gems: { name: 'Gemmes', icon: 'icon_gem' },
};
const isFeatured = (i) => Boolean(i.unit || i.give?.ssrFragment);
function shopCard(state, f, i, big = false) {
  let art; let name; let qty = ''; let sub = '';
  if (i.unit) { art = unitArt(i.unit, big ? 'big' : 'shop'); name = `Copie : ${escapeHtml(unitName(i.unit))}`; sub = i.copy === 'pet' ? 'Familier gratuit de la fête' : 'Héros gratuit de la fête'; }
  else {
    const [k, v] = Object.entries(i.give)[0];
    const look = SHOP_LOOK[k] ?? { name: k, icon: 'icon_chest' };
    art = look.art ? `<img class="px" src="${look.art}" alt="">` : look.wallet ? walletIcon(k, false) : img(look.icon);
    name = escapeHtml(look.name);
    qty = `×${formatNumber(v)}`;
    if (k === 'ssrFragment') sub = 'Universel : n\'importe quel héros Légendaire';
  }
  const coins = festRecord(state).coins;
  const miss = i.price - coins;
  const sold = !i.left;
  const short = !sold && !i.can;
  return `<div class="fh-item${big ? ' feat' : ''}${i.can ? '' : ' off'}${sold ? ' sold' : ''}" data-item="${i.id}"><span class="fh-item-art">${art}</span>
    <span class="fh-item-txt"><b>${name}</b>${qty ? `<span class="fh-qty num">${qty}</span>` : ''}${sub ? `<small>${sub}</small>` : ''}<small class="num">${sold ? 'Épuisé' : `Reste ${i.left}/${i.stock}`}</small></span>
    <button type="button" class="${big ? 'm-btn-gold' : 'm-btn'}${short ? ' fh-short' : ''}" data-action="fest-buy" data-value="${i.id}" ${i.can ? '' : 'disabled'} aria-label="Acheter pour ${i.price} ${escapeHtml(f.currency)}">${festCoin(f)}<span class="num">${i.price}</span></button>
    ${short ? `<small class="fh-miss num">il manque ${formatNumber(miss)}</small>` : ''}${sold ? '<span class="fh-sold">Épuisé</span>' : ''}</div>`;
}
export function shopTab(state, f) {
  const items = festShop(state);
  const feat = items.filter(isFeatured);
  const rest = items.filter((i) => !isFeatured(i));
  const last = f.phase === 'pause' ? `<div class="fh-banner last">${img('icon_timer')}<span><b>Dernière chance</b> · ce qui reste à la fin devient des éclats (${FEST_RULES.leftoverShards} par ${escapeHtml(f.currency)}).</span></div>` : '';
  return `${last}<b class="fh-h">${festCoin(f)} Boutique · ${escapeHtml(f.currency)}</b>
    ${feat.length ? `<div class="fh-feat n${feat.length}">${feat.map((i) => shopCard(state, f, i, true)).join('')}</div>` : ''}
    <div class="fh-shop">${rest.map((i) => shopCard(state, f, i)).join('')}</div>
    ${f.phase === 'pause' ? '' : `<small class="fh-help">Ce qui reste à la fin de l'échange devient des éclats (${FEST_RULES.leftoverShards} par ${escapeHtml(f.currency)}).</small>`}`;
}

// ---- Sentier (petite fête) ---------------------------------------------------------------------------------------
export function pathTab(state, f) {
  const path = festPath(state);
  const earned = festRecord(state).fest.earned;
  const N = path.length;
  // Deux dessins du chemin : une ligne qui serpente (PC), deux rangées en serpentin (téléphone, 6 étapes par rangée).
  const xy = (i) => [5 + (i * 90) / (N - 1), 46 + Math.sin(i * 1.05 + 0.5) * 22];
  const half = Math.ceil(N / 2);
  const xyP = (i) => { const r = i < half ? 0 : 1; const c = r ? N - 1 - i : i; return [9 + (c * 82) / (half - 1), r ? 76 : 26]; };
  const line = (pos) => path.slice(0, -1).map((s, i) => { const [x1, y1] = pos(i), [x2, y2] = pos(i + 1); return `M${x1} ${y1} L${x2} ${y2}`; }).join(' ');
  const bg = pickArt(f.art?.path, `${A106}event_lights_path.png`);
  const nodeOff = pickArt(f.art?.node, `${A106}event_lights_node.png`);
  const nodeOn = pickArt(f.art?.nodeDone, `${A106}event_lights_node_done.png`);
  let here = -1;
  for (const s of path) if (s.reached) here = s.index;
  const nodes = path.map((s, i) => {
    const [x, y] = xy(i);
    const [px, py] = xyP(i);
    const st = s.claimed ? 'claimed' : s.reached ? 'ready' : 'off';
    const prize = s.hero || s.pet;
    const gift = [s.give ? festGive(s.give) : '', s.hero ? unitArt(f.hero, 'mini') : '', s.pet ? unitArt(f.pet, 'mini pet') : ''].join('');
    const hero = i === here ? `<span class="fh-hero">${spriteOf(f.hero)}</span>` : '';
    return `<button type="button" class="fh-pnode ${st}${prize ? ' prize' : ''}" style="--x:${x}%;--y:${y}%;--px:${px}%;--py:${py}%" ${s.reached && !s.claimed ? `data-action="fest-step" data-value="p${i}"` : 'disabled'} aria-label="${s.at} ${escapeHtml(f.currency)}">
      <img class="px" src="${s.reached ? nodeOn : nodeOff}" alt=""><span class="fh-pgift">${gift}</span><small class="num">${s.at}</small>${hero}</button>`;
  }).join('');
  const ready = path.filter((s) => s.reached && !s.claimed).length;
  const got = (k) => path.filter((s) => s[k] && s.claimed).length;
  const tot = (k) => LIGHT_PATH.filter((s) => s[k]).length;
  const card = (id, cls, k, label) => `<span class="fh-gift">${unitArt(id, cls)}<b>${escapeHtml(unitName(id))}</b><small>${label}</small><span class="fh-count num${got(k) >= tot(k) ? ' full' : ''}">${got(k)} / ${tot(k)} obtenus</span></span>`;
  return `<div class="fh-gifts">${card(f.hero, 'big', 'hero', 'Héros gratuit')}${card(f.pet, 'big pet', 'pet', 'Familier gratuit')}</div>
    <b class="fh-h">${img('icon_map')} Sentier · ${festCoin(f)} ${formatNumber(earned)} ${escapeHtml(f.currency)} gagnés</b>
    <div class="fh-path" style="background-image:url(${bg})"><svg class="fh-road d" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${line(xy)}"/></svg><svg class="fh-road p" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${line(xyP)}"/></svg>${nodes}</div>
    ${ready > 1 ? `<button type="button" class="m-btn-gold fh-wide" data-action="fest-steps-all">Tout récupérer (${ready})</button>` : ''}
    <small class="fh-help">La monnaie tombe en jouant (monstres et boss, ${FEST_RULES.trickle.dailyCap} par jour au plus) et avec les missions. Dépenser ne fait pas reculer sur le sentier.</small>`;
}
function spriteOf(id) { const c = COMPANIONS.find((x) => x.id === id); return c ? img(c.sprite, 'fh-sprite') : ''; }

// ---- Gain : l'icône vole vers la monnaie du haut, l'article saute (coupé par « Réduire les animations ») -----------
function fly(src) {
  const to = document.querySelector('.fest-hub .fh-wallet');
  const app = document.getElementById('app');
  if (!src || !to || !app) return;
  const k = app.getBoundingClientRect().width / (app.offsetWidth || 1) || 1;
  const A = app.getBoundingClientRect();
  const a = src.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const c = src.cloneNode();
  c.className = 'fh-flyer';
  Object.assign(c.style, { position: 'absolute', left: `${(a.left - A.left) / k}px`, top: `${(a.top - A.top) / k}px`, width: `${a.width / k}px`, height: `${a.height / k}px`, zIndex: 30, pointerEvents: 'none', objectFit: 'contain' });
  app.appendChild(c);
  const dx = (b.left + b.width / 2 - a.left - a.width / 2) / k;
  const dy = (b.top + b.height / 2 - a.top - a.height / 2) / k;
  const an = c.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 40}px) scale(1.3)`, opacity: 1, offset: 0.4 }, { transform: `translate(${dx}px,${dy}px) scale(.4)`, opacity: 0.2 }], { duration: 650, easing: 'ease-in' });
  an.onfinish = () => c.remove();
  an.oncancel = () => c.remove();
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('.fest-hub [data-action^="fest-"]') : null;
    if (!b || b.disabled || reduceMotion()) return;
    const act = b.dataset.action;
    if (!['fest-buy', 'fest-mission', 'fest-missions-all', 'fest-step', 'fest-steps-all'].includes(act)) return;
    const card = b.closest('.fh-item, .fh-mission, .fh-pnode');
    const icon = card?.querySelector('.fh-item-art img, .fh-mission-art img, .fh-pnode > img') ?? document.querySelector('.fest-hub .fh-mission.ready .fh-mission-art img');
    if (act === 'fest-buy') card?.animate?.([{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }, { transform: 'translateY(0)' }], { duration: 320, easing: 'ease-out' });
    fly(icon);
  }, true);
}
