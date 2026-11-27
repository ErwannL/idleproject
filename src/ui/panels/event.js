// v9.2.8 : Événement en cours (document du producteur, section 7). Grand événement « Expédition des Anciens » :
// carte de 5 régions × 10 étapes (combat automatique), World Boss dès l'étape 20, écus et boutique d'écus, fragment
// SSR universel à l'étape 30. Petit événement « Marché des lueurs » : objectifs et récompenses.
import { EVENTS } from '../../data/economy.js';
import { currentEvent, eventGoals, eventRecord, eventShop, eventStageLevel, totalStages, worldBossDay, worldBossStatus } from '../../core/ancients.js';
import { liveAnnouncements, liveNextEvent, liveNow } from '../../core/live.js'; // v9.3.0 : live-ops
import { LIVE_EVENT_TYPES } from '../../data/live-catalog.js';
import { WORLD_BOSS } from '../../core/world-boss.js'; // v9.2.9
import { escapeHtml, formatNumber, hdArt, img, rewardIcons } from '../common.js';
import { LIGHTS_EVENT, lightsMissions, lightsPath, lightsPosition, lightsShop, lightsWallet } from '../../core/lights.js'; // v10.6
const heroPortrait = () => img('icon_hero');
import { walletIcon } from './shop.js';
import { stageLabel } from '../../core/combat.js';
import { A1014, festBadges, pickArt, preloadFestArt } from '../fest-art.js'; // v10.14.1
import { mBar, mBtn, mBtnGold, mEmpty, mStat, mTitle } from '../mobile-kit.js'; // v10.12
import { currentFest, festMissions, festRecord, festShop, festTotalStages } from '../../core/fest.js'; // v10.14
import { FEST_RULES } from '../../data/fest.js';
import { WALLET } from '../../data/economy.js';
import { COMPANIONS } from '../../data/companions.js';
import { ZONES } from '../../data/zones.js';
import { grandBoss } from '../../data/grand-bosses.js';
import { pageNarrow } from '../page.js'; // v10.20 (6.3)
const isPhoneUi = () => true; // v10.13 : le PC emploie le même kit (cadre, cartouche, tuiles) que le téléphone ; desk-activities.css lui donne ses tailles

const dateText = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const give = (g) => Object.entries(g).map(([k, v]) => `<span class="shop-give">${walletIcon(k)}<b class="num">${v}</b></span>`).join('');

// v9.2.9 : World Boss en vrai combat animé (ui/world-boss.js) : tentatives, record, dégâts du jour, paliers.
function bossCard(state, wb) {
  const G = EVENTS.grand;
  const day = worldBossDay(state);
  const tiers = WORLD_BOSS.tiers.map((t, i) => `<span class="wb-tier${i < day.tiers ? ' on' : ''}"><b class="num">${Math.round(t * 100)} %</b></span>`).join('');
  const body = wb.open
    ? `<div class="wb-card-stats"><span><span>Tentatives du jour</span> <b class="num">${wb.left}/${wb.perDay ?? G.worldBoss.attemptsPerDay}</b></span>
        <span><span>Record</span> <b class="num">${formatNumber(wb.best)}</b></span>
        <span><span>Dégâts du jour</span> <b class="num">${formatNumber(day.today)}</b></span></div>
      <div class="wb-card-tiers"><span class="muted">Paliers de récompense</span> ${tiers}</div>
      <button class="btn btn-gold wb-attack" data-action="event-boss" ${wb.left ? '' : 'disabled'}>⚔ <span>Attaquer</span></button>
      <div class="muted">Combat de ${WORLD_BOSS.seconds} s avec toute l'équipe. Phases à 75, 50 et 25 % des PV.</div>
`
    : `<div class="muted">Débloqué à l'étape ${G.worldBoss.unlockStage}.</div>`;
  return `<div class="card wb-card"><div class="section-title">${img('icon_boss')} <span>World Boss</span></div>
      <div class="wb-card-name"><b>${escapeHtml(WORLD_BOSS.name)}</b></div>${body}</div>`;
}

function grand(ui, state, ev) {
  const G = EVENTS.grand;
  const rec = eventRecord(state);
  const wb = worldBossStatus(state);
  const shop = eventShop(ev); // v9.3.0 : stocks réglés par la config live
  const next = rec.cleared + 1;
  const regions = G.regions.map((r, ri) => {
    const cells = Array.from({ length: G.stagesPerRegion }, (_, i) => {
      const n = ri * G.stagesPerRegion + i + 1;
      const cls = n <= rec.cleared ? 'done' : n === next ? 'next' : 'locked';
      return `<span class="ev-stage ${cls}${n === G.fragmentStage ? ' frag' : ''}${n === G.worldBoss.unlockStage ? ' boss' : ''}" title="${n}">${n}</span>`;
    }).join('');
    return `<div class="ev-region"><div class="ev-region-name">${escapeHtml(r.name)}</div><div class="ev-stages">${cells}</div></div>`;
  }).join('');
  const last = ui.view.eventLast;
  return `<div class="card ev-head"><div class="section-title">${img('icon_map')} <span>${escapeHtml(G.name)}</span></div>
      <div class="muted"><span>Jour</span> <b class="num">${ev.day}/${ev.days ?? 14}</b> · <span>Jusqu'au</span> ${dateText(ev.end - 86400000)}</div>
      <div class="ev-coins">${walletIcon('eventCoins')}<b class="num">${formatNumber(rec.coins)}</b> <span>écus</span> · <span>Étapes</span> <b class="num">${rec.cleared}/${totalStages()}</b></div></div>
    <div class="card"><div class="ev-map">${regions}</div>
      ${next <= totalStages() ? `<div class="ev-fight"><span>Étape</span> <b class="num">${next}</b> · <span>Gardien d'étape</span> <b class="num">${stageLabel(eventStageLevel(state, next))}</b>
        <button class="btn btn-primary small" data-action="event-fight" data-value="${next}">Combattre</button>
        <button class="btn btn-gold small" data-action="event-chain" data-value="${next}" title="Combat les étapes suivantes tant qu'elles sont gagnées">Enchaîner</button></div>` : '<div class="good">Carte terminée.</div>'}
      ${last ? `<div class="muted">${last}</div>` : ''}
      <div class="muted">Combat automatique : dégâts du héros pendant ${G.fightSeconds} s contre les PV du gardien. Étape ${G.fragmentStage} : fragment Légendaire universel.</div></div>
    ${wb ? bossCard(state, wb) : ''}
    <div class="card"><div class="section-title">${walletIcon('eventCoins')} <span>Boutique des écus</span></div>
      <div class="ev-shop">${shop.map((i) => `<div class="ev-item">${give(i.give)}<span class="muted"><b class="num">${(rec.bought[i.id] ?? 0)}/${i.stock}</b></span>
        <button class="btn small" data-action="event-buy" data-value="${i.id}" ${rec.coins >= i.price && (rec.bought[i.id] ?? 0) < i.stock ? '' : 'disabled'}>${walletIcon('eventCoins')} ${i.price}</button></div>`).join('')}</div></div>
`; // v9.3.5 : rien d'annoncé tant que ce n'est pas jouable
}

// v10.6 (partie 3) : le Marché des Lueurs en page illustrée — affiche (nom, phrase, minuteur, Lueurs, grand prix dessiné
// en grand), carte de 10 lanternes avec le portrait du héros, missions en tuiles Carnet, échoppe illustrée.
// Modèle réutilisable : tout vient de LIGHTS_EVENT (core/lights.js).
function small(ui, state, ev) {
  const E = LIGHTS_EVENT;
  const left = Math.max(1, Math.ceil((ev.end - liveNow()) / 86400000));
  const wallet = lightsWallet(state);
  const path = lightsPath(state);
  const pos = lightsPosition(state);
  const cur = `<img class="px lt-cur" src="${E.art.currency}" alt="">`;
  // Carte : 10 étapes sur un chemin en vague (positions en % de la carte).
  const N = path.length;
  const xy = (i) => [4 + (i * 92) / (N - 1), i === N - 1 ? 42 : 50 + Math.sin(i * 1.1 + 0.6) * 26];
  const dots = path.slice(0, -1).map((s, i) => { const [x1, y1] = xy(i), [x2, y2] = xy(i + 1); return `M${x1} ${y1} L${x2} ${y2}`; }).join(' ');
  const nodes = path.map((s, i) => {
    const [x, y] = xy(i);
    const state0 = s.claimed ? 'claimed' : s.reached ? 'ready' : 'off';
    const giveIcon = s.prize ? `<img class="px lt-prize-mini" src="${E.art.prize}" alt="">` : rewardIcons(s.give);
    return `<button class="lt-node ${state0}${s.prize ? ' prize' : ''}${i === pos ? ' here' : ''}" style="left:${x}%;top:${y}%" ${s.reached && !s.claimed ? `data-action="lights-step" data-value="${i}"` : 'disabled'} title="${escapeHtml(s.label)} · ${s.at} Lueurs">
      <img class="px lt-lantern" src="${s.reached ? E.art.nodeDone : E.art.node}" alt=""><span class="lt-give">${giveIcon}</span><small>${escapeHtml(s.label)}</small>
      ${i === pos ? `<span class="lt-hero">${heroPortrait(state)}</span>` : ''}</button>`;
  }).join('');
  const ready = path.filter((s) => s.reached && !s.claimed).length;
  const tiles = lightsMissions(state).map((m) => {
    const pct = Math.round((m.p / m.target) * 100);
    const btn = m.lit ? '<span class="lt-stamp">Allumée</span>'
      : m.ready ? `<button class="btn btn-gold small" data-action="event-goal" data-value="${m.id}">Allumer</button>`
      : m.tab ? `<button class="btn small lt-go" data-action="open-tab" data-value="${m.tab}">Y aller</button>` : '';
    return `<div class="lt-tile${m.lit ? ' lit' : ''}${m.ready ? ' ready' : ''}"><img class="px lt-tile-art" src="${m.art}" alt="">
      <div class="lt-tile-body"><b>${escapeHtml(m.title)}</b><div class="lt-bar"><i style="width:${pct}%"></i></div>
      <span class="lt-give">${cur}<b class="num">+${m.lueurs}</b></span></div>${btn}</div>`;
  }).join('');
  const shop = lightsShop(state).map((i) => `<button class="lt-shop-item${i.can ? '' : ' off'}" data-action="lights-buy" data-value="${i.id}" ${i.can ? '' : 'disabled'} title="${i.left} en stock">
      <img class="px" src="${i.art}" alt=""><b>${escapeHtml(i.title)}</b><span class="lt-price">${cur}<b class="num">${i.price}</b></span></button>`).join('');
  return `<div class="lt-page">
    <div class="lt-key" style="background-image:url(${E.art.key})">
      <div class="lt-key-text"><h3>${escapeHtml(E.title)}</h3><p>${escapeHtml(E.tagline)}</p></div>
      <span class="lt-timer">⏳ encore ${left} j</span>
      <img class="px lt-key-prize" src="${E.art.prize}" alt="${escapeHtml(E.prize.label)}"><span class="lt-key-prize-name">Grand prix · ${escapeHtml(E.prize.label)}</span>
      <span class="lt-wallet">${cur}<b class="num">${wallet.have}</b> ${E.currency}</span>
    </div>
    <div class="lt-map" style="background-image:url(${E.art.path})"><svg class="lt-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${dots}"/></svg>${nodes}
      ${ready > 1 ? `<button class="btn btn-gold small lt-all" data-action="lights-all">Tout récupérer (${ready})</button>` : ''}</div>
    <div class="lt-cols"><section><h4>Allume des lanternes</h4><div class="lt-tiles">${tiles}</div></section>
      <section><h4>Échoppe des Lueurs</h4><div class="lt-shop">${shop}</div></section></div>
  </div>`;
}

// v9.3.0 : annonces (messages du jour) de la config live.
function announcements() {
  return liveAnnouncements().map((a) => `<div class="card live-news">${a.title ? `<div class="section-title"><span>${escapeHtml(a.title)}</span></div>` : ''}<div>${escapeHtml(a.text)}</div></div>`).join('');
}

let laneX = null; // v10.12 : défilement du chemin des lanternes (téléphone)
export default {
  id: 'event',
  // v10.12 : téléphone — le chemin des lanternes défile de côté ; on amène la lanterne du héros au centre.
  afterRender(ui, body) {
    const box = body.querySelector('.ev-lanterns');
    if (!box) return;
    const here = box.querySelector('.lt-node.here');
    if (laneX === null && here) laneX = Math.max(0, here.offsetLeft - box.clientWidth / 2);
    box.scrollLeft = laneX ?? 0; // la position reste d'un rendu à l'autre
    box.addEventListener('scroll', () => { laneX = box.scrollLeft; }, { passive: true });
  },
  title: 'Événement',
  icon: 'icon_map',
  // v10.6 (partie 3) : le Marché des Lueurs a sa propre affiche ; pas de seconde bannière au-dessus.
  banner() { return currentFest() || currentEvent()?.kind === 'small' ? '' : null; },
  render(ui, state) {
    const news = announcements();
    const fest = currentFest(); // v10.14 : Fêtes du mois
    if (fest) return festPage(ui, state, fest, news);
    const ev = currentEvent();
    const phone = isPhoneUi(ui);
    if (phone && !ev) {
      const nx = liveNextEvent();
      return `<div class="m-frame cb-frame">${mTitle('icon_map', 'Événement', true)}${news}${mEmpty(nx ? `Prochain événement : ${LIVE_EVENT_TYPES[nx.type].label} · ${dateText(nx.start)}` : 'Aucun événement en cours.', { icon: 'icon_map' })}</div>`;
    }
    if (phone) return phoneEvent(ui, state, ev, news);
    if (!ev) {
      const nx = liveNextEvent();
      return `${news}<div class="muted">Aucun événement en cours.</div>${nx ? `<div class="muted"><span>Prochain événement</span> : ${escapeHtml(LIVE_EVENT_TYPES[nx.type].label)} · ${dateText(nx.start)}</div>` : ''}`;
    }
    return news + (ev.kind === 'grand' ? grand(ui, state, ev) : small(ui, state, ev));
  },
};

// v10.12 : Événement sur téléphone — même kit que les autres écrans : cadre, cartouche, affiche de 160 px, cartes sombres,
// barre dorée, boutons du kit (un seul doré : Enchaîner / Tout récupérer).
const poster = (cls, style, inner) => `<div class="m-card ev-poster ${cls}" style="${style}">${inner}</div>`;

function phoneBoss(state, wb) {
  const G = EVENTS.grand;
  const day = worldBossDay(state);
  const tiers = WORLD_BOSS.tiers.map((t, i) => `<span class="wb-tier${i < day.tiers ? ' on' : ''}"><b class="num">${Math.round(t * 100)} %</b></span>`).join('');
  const body = wb.open
    ? `${mStat('icon_boss', 'Tentatives du jour', `${wb.left}/${wb.perDay ?? G.worldBoss.attemptsPerDay}`)}${mStat('icon_trophy', 'Record', formatNumber(wb.best))}${mStat('icon_damage', 'Dégâts du jour', formatNumber(day.today))}
      <div class="wb-card-tiers">${tiers}</div>${mBtn('Attaquer', { action: 'event-boss', disabled: !wb.left, icon: 'icon_boss' })}`
    : `<div class="cb-sub">Débloqué à l'étape ${G.worldBoss.unlockStage}.</div>`;
  return `<div class="m-card ev-boss"><b class="ev-h">${img('icon_boss')} World Boss · ${escapeHtml(WORLD_BOSS.name)}</b>${body}</div>`;
}

function phoneGrand(ui, state, ev) {
  const G = EVENTS.grand;
  const rec = eventRecord(state);
  const wb = worldBossStatus(state);
  const shop = eventShop(ev);
  const next = rec.cleared + 1;
  const regions = G.regions.map((r, ri) => {
    const cells = Array.from({ length: G.stagesPerRegion }, (_, i) => {
      const n = ri * G.stagesPerRegion + i + 1;
      const cls = n <= rec.cleared ? 'done' : n === next ? 'next' : 'locked';
      return `<span class="ev-stage ${cls}${n === G.fragmentStage ? ' frag' : ''}${n === G.worldBoss.unlockStage ? ' boss' : ''}" title="${n}">${n}</span>`;
    }).join('');
    return `<div class="ev-region"><div class="ev-region-name">${escapeHtml(r.name)}</div><div class="ev-stages">${cells}</div></div>`;
  }).join('');
  const last = ui.view.eventLast;
  const head = poster('ev-grand', 'background-image:linear-gradient(90deg,rgba(11,17,36,.92),rgba(11,17,36,.45)),url(assets/ui/art98/expedition_map.png)',
    `<b class="ev-t">${escapeHtml(G.name)}</b><span class="ev-sub">Jour ${ev.day}/${ev.days ?? 14} · jusqu'au ${dateText(ev.end - 86400000)}</span>
     <span class="ev-wallet">${walletIcon('eventCoins')}<b class="num">${formatNumber(rec.coins)}</b> écus</span>${mBar(rec.cleared / totalStages())}<span class="ev-sub">Étapes ${rec.cleared}/${totalStages()}</span>`);
  const fight = next <= totalStages()
    ? `<div class="m-card ev-fight"><span class="ev-fight-t"><b>Étape ${next}</b><span class="cb-sub">Gardien niv. ${stageLabel(eventStageLevel(state, next))}</span></span>
        ${mBtn('Combattre', { action: 'event-fight', value: next })}</div>${mBtnGold('Enchaîner', { action: 'event-chain', value: next, icon: 'icon_map' })}`
    : '<div class="m-card good">Carte terminée.</div>';
  const items = shop.map((i) => `<div class="m-card ev-item"><span class="ev-give">${give(i.give)}</span><span class="cb-sub num">${(rec.bought[i.id] ?? 0)}/${i.stock}</span>
      <button type="button" class="m-btn" data-action="event-buy" data-value="${i.id}" ${rec.coins >= i.price && (rec.bought[i.id] ?? 0) < i.stock ? '' : 'disabled'}>${walletIcon('eventCoins')}<span>${i.price}</span></button></div>`).join('');
  return `${head}${SPLIT}<div class="m-card ev-mapcard"><div class="ev-map">${regions}</div></div>${fight}
    ${last ? `<div class="cb-sub">${last}</div>` : ''}<div class="cb-sub cb-help">Combat automatique : ${G.fightSeconds} s de dégâts du héros contre les PV du gardien. Étape ${G.fragmentStage} : fragment Légendaire universel.</div>
    ${wb ? phoneBoss(state, wb) : ''}<b class="ev-h">${walletIcon('eventCoins')} Boutique des écus</b><div class="ev-shop-grid">${items}</div>`;
}

function phoneSmall(state, ev) {
  const E = LIGHTS_EVENT;
  const left = Math.max(1, Math.ceil((ev.end - liveNow()) / 86400000));
  const wallet = lightsWallet(state);
  const path = lightsPath(state);
  const pos = lightsPosition(state);
  const cur = `<img class="px lt-cur" src="${E.art.currency}" alt="">`;
  const N = path.length;
  const xy = (i) => [4 + (i * 92) / (N - 1), i === N - 1 ? 42 : 50 + Math.sin(i * 1.1 + 0.6) * 26];
  const dots = path.slice(0, -1).map((s, i) => { const [x1, y1] = xy(i), [x2, y2] = xy(i + 1); return `M${x1} ${y1} L${x2} ${y2}`; }).join(' ');
  const nodes = path.map((s, i) => {
    const [x, y] = xy(i);
    const state0 = s.claimed ? 'claimed' : s.reached ? 'ready' : 'off';
    const giveIcon = s.prize ? `<img class="px lt-prize-mini" src="${E.art.prize}" alt="">` : rewardIcons(s.give);
    return `<button class="lt-node ${state0}${s.prize ? ' prize' : ''}${i === pos ? ' here' : ''}" style="left:${x}%;top:${y}%" ${s.reached && !s.claimed ? `data-action="lights-step" data-value="${i}"` : 'disabled'} title="${escapeHtml(s.label)} · ${s.at} Lueurs">
      <img class="px lt-lantern" src="${s.reached ? E.art.nodeDone : E.art.node}" alt=""><span class="lt-give">${giveIcon}</span><small>${escapeHtml(s.label)}</small>
      ${i === pos ? `<span class="lt-hero">${heroPortrait(state)}</span>` : ''}</button>`;
  }).join('');
  const ready = path.filter((s) => s.reached && !s.claimed).length;
  const tiles = lightsMissions(state).map((m) => {
    const btn = m.lit ? '<span class="lt-stamp">Allumée</span>'
      : m.ready ? mBtn('Allumer', { action: 'event-goal', value: m.id })
        : m.tab ? mBtn('Y aller', { action: 'open-tab', value: m.tab }) : '';
    return `<div class="m-card ev-mission${m.lit ? ' lit' : ''}"><img class="px lt-tile-art" src="${m.art}" alt="">
      <div class="ev-mission-body"><b>${escapeHtml(m.title)}</b>${mBar(m.p / m.target)}<span class="lt-give">${cur}<b class="num">+${m.lueurs}</b></span></div>${btn}</div>`;
  }).join('');
  const shop = lightsShop(state).map((i) => `<button type="button" class="m-card ev-item lt-shop-item${i.can ? '' : ' off'}" data-action="lights-buy" data-value="${i.id}" ${i.can ? '' : 'disabled'} title="${i.left} en stock">
      <img class="px" src="${i.art}" alt=""><b>${escapeHtml(i.title)}</b><span class="lt-price">${cur}<b class="num">${i.price}</b></span></button>`).join('');
  const head = poster('ev-small', `background-image:url(${E.art.key})`,
    `<span class="ev-poster-l"><b class="ev-t">${escapeHtml(E.title)}</b><span class="ev-sub" title="${escapeHtml(E.tagline)}">encore ${left} j</span><span class="ev-wallet">${cur}<b class="num">${wallet.have}</b> ${E.currency}</span></span>
     <span class="ev-poster-r"><img class="px" src="${E.art.prize}" alt="${escapeHtml(E.prize.label)}"><small>Grand prix · ${escapeHtml(E.prize.label)}</small></span>`);
  return `${head}${SPLIT}<div class="lt-map ev-lanterns"><div class="ev-lanes" style="background-image:url(${E.art.path})"><svg class="lt-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${dots}"/></svg>${nodes}</div></div>
    ${ready > 1 ? mBtnGold(`Tout récupérer (${ready})`, { action: 'lights-all' }) : ''}
    <b class="ev-h">Allume des lanternes</b>${tiles}<b class="ev-h">Échoppe des Lueurs</b><div class="ev-shop-grid">${shop}</div>`;
}

// v10.20 (6.3) : sur téléphone, tout ce qui suit l'affiche défile dans le cadre (.ev-scroll) ; titre et affiche restent fixes.
// Ailleurs (PC), la marque de coupure est simplement retirée : rendu inchangé.
const SPLIT = '<!--ev-split-->';
function phoneEvent(ui, state, ev, news) {
  const html = ev.kind === 'grand' ? phoneGrand(ui, state, ev) : phoneSmall(state, ev);
  const i = html.indexOf(SPLIT);
  const inner = i < 0 ? html : pageNarrow(ui) ? `${html.slice(0, i)}<div class="ev-scroll">${html.slice(i + SPLIT.length)}</div>` : html.replace(SPLIT, '');
  return `<div class="m-frame cb-frame">${mTitle('icon_map', 'Événement', true)}${news}${inner}</div>`;
}

// ---------------------------------------------------------------------------------------------------------------
// v10.14 : FÊTES DU MOIS (core/fest.js, data/fest.js). Une page par fête, même kit que le reste (PC et téléphone) :
// affiche (titre, minuteur, monnaie, héros / familier à gagner), puis selon la fête :
//   grande : Carte du héros (30 étapes), World Boss du thème, jalons d'invocation ;
//   petite : sentier de 12 étapes (héros et familier gratuits) ;
// et pour les deux : missions du jour, missions de la fête, boutique. Pendant l'échange : bandeau, combats fermés.
const FEST_ART = { grandNode: 'assets/ui/art106/event_lights_node.png', node: 'assets/ui/art106/event_lights_node.png', nodeDone: 'assets/ui/art106/event_lights_node_done.png',
  lightKey: 'assets/ui/art106/event_lights_key.png', path: 'assets/ui/art106/event_lights_path.png', coin: 'assets/ui/art106/event_lights_currency.png' };
// Récompense en icônes : monnaies du portefeuille (tickets, fragments) avec leur icône de boutique, le reste comme partout.
export const festGive = (g = {}) => Object.entries(g).map(([k, v]) => (WALLET[k] ? `<span class="shop-give">${walletIcon(k)}<b class="num">${v}</b></span>` : rewardIcons({ [k]: v }))).join('');
export const festCoin = (f) => `<img class="px lt-cur" src="${pickArt(f.art?.currency, FEST_ART.coin)}" alt="" title="${escapeHtml(f.currency)}">`;
export const unitArt = (id, cls = '') => { const c = COMPANIONS.find((x) => x.id === id); return c ? (hdArt(c, `fest-unit-art ${cls}`) || img(c.sprite, `fest-unit-art ${cls}`)) : ''; };
export const unitName = (id) => COMPANIONS.find((x) => x.id === id)?.name ?? id;
export const festLeft = (ms) => { const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000); return d >= 1 ? `${d} j ${h} h` : `${Math.max(1, h)} h`; };

export function festPoster(state, f) {
  const now = liveNow();
  const rec = festRecord(state);
  const zone = ZONES[f.zone ?? 0];
  const bg = f.kind === 'grand'
    ? `background-image:linear-gradient(90deg,rgba(11,17,36,.94),rgba(11,17,36,.35)),url(${pickArt(f.art?.key, `assets/bg/${zone?.id ?? 'plains'}_far.png`)})`
    : `background-image:linear-gradient(90deg,rgba(11,17,36,.9),rgba(11,17,36,.2)),url(${pickArt(f.art?.key, FEST_ART.lightKey)})`;
  const timer = f.phase === 'play' ? `⏳ encore ${festLeft(f.playEnd - now)}` : `🔁 Échange : ${festLeft(f.end - now)}`;
  const prize = f.kind === 'grand'
    ? `<span class="fest-prize">${unitArt(f.featured)}<small>Héros du mois · ${escapeHtml(unitName(f.featured))}</small></span>`
    : `<span class="fest-prize two">${unitArt(f.hero)}${unitArt(f.pet, 'pet')}<small>Gratuits · ${escapeHtml(unitName(f.hero))} et ${escapeHtml(unitName(f.pet))}</small></span>`;
  return `<div class="m-card ev-poster ev-small fest-poster fest-${f.kind}" style="${bg}">
    <span class="ev-poster-l"><small class="fest-kicker">${f.kind === 'grand' ? 'Grande fête' : 'Petite fête'} · jour ${Math.min(f.day, f.days)}/${f.days}</small>
      <b class="ev-t">${escapeHtml(f.title)}</b><span class="ev-sub">${escapeHtml(f.tagline ?? '')}</span>
      <span class="ev-sub fest-timer">${timer}</span>
      <span class="ev-wallet">${festCoin(f)}<b class="num">${formatNumber(rec.coins)}</b> ${escapeHtml(f.currency)}</span></span>
    <span class="ev-poster-r">${prize}</span></div>
    ${f.phase === 'pause' ? `<div class="m-card fest-pause"><b>Échange de fin de fête</b><span class="cb-sub">Combats, boss et missions sont fermés. Dépense ta monnaie : ce qui reste à la fin sera converti en éclats (${FEST_RULES.leftoverShards} par pièce).</span></div>` : ''}`;
}

export function festSteps(f, list, key, label, unitLabel) {
  if (!list.length) return '';
  const ready = list.filter((s) => s.reached && !s.claimed).length;
  const items = list.map((s) => {
    const cls = s.claimed ? 'claimed' : s.reached ? 'ready' : 'off';
    const gift = [s.give ? festGive(s.give) : '', s.hero ? unitArt(f.hero, 'mini') : '', s.pet ? unitArt(f.pet, 'mini pet') : ''].join('');
    return `<button type="button" class="fest-step ${cls}" ${s.reached && !s.claimed ? `data-action="fest-step" data-value="${key}${s.index}"` : 'disabled'} title="${s.at} ${escapeHtml(unitLabel)}">
      <span class="fest-step-gift">${gift}</span><small class="num">${s.at}</small>${s.claimed ? '<i class="fest-ok">✓</i>' : ''}</button>`;
  }).join('');
  return `<b class="ev-h">${label}</b><div class="m-card fest-steps">${items}</div>${ready > 1 ? mBtnGold(`Tout récupérer (${ready})`, { action: 'fest-steps-all' }) : ''}`;
}

export function festMissionTiles(f, list, title) {
  const tiles = list.map((m) => {
    const btn = m.done ? '<span class="lt-stamp">Faite</span>' : m.ready ? mBtn('Récupérer', { action: 'fest-mission', value: m.id }) : m.tab && f.phase === 'play' ? mBtn('Y aller', { action: 'open-tab', value: m.tab }) : '';
    return `<div class="m-card ev-mission${m.done ? ' lit' : ''}"><div class="ev-mission-body"><b>${escapeHtml(m.label)}</b>${mBar(m.p / m.n)}
      <span class="lt-give">${festCoin(f)}<b class="num">+${m.coins}</b>${m.give ? festGive(m.give) : ''}<span class="cb-sub num">${formatNumber(m.p)}/${formatNumber(m.n)}</span></span></div>${btn}</div>`;
  }).join('');
  return `<b class="ev-h">${title}</b>${tiles}`;
}

export function festShopHtml(state, f) {
  const items = festShop(state).map((i) => {
    const what = i.unit ? `${unitArt(i.unit, 'mini')}<b>${escapeHtml(unitName(i.unit))}</b>` : `<span class="ev-give">${festGive(i.give)}</span>`;
    return `<div class="m-card ev-item fest-item">${what}<span class="cb-sub num">${i.bought}/${i.stock}</span>
      <button type="button" class="m-btn" data-action="fest-buy" data-value="${i.id}" ${i.can ? '' : 'disabled'}>${festCoin(f)}<span>${i.price}</span></button></div>`;
  }).join('');
  return `<b class="ev-h">${festCoin(f)} Boutique · ${escapeHtml(f.currency)}</b><div class="ev-shop-grid">${items}</div>`;
}

// v10.14 : l'onglet Événement est la porte d'entrée de l'écran de la fête (ui/fest-hub.js) : affiche, gros bouton
// « Entrer dans la fête » et une tuile illustrée par partie (chacune ouvre l'écran sur sa partie).
function festPage(ui, state, f, news) {
  preloadFestArt(f);
  const m0 = festMissions(state);
  const ready = [...m0.daily, ...m0.event].filter((x) => x.ready).length;
  const bd = festBadges(state, f);
  const tab = (id, old) => `<img class="px" src="${pickArt(`${A1014}fest_tab_${id}.png`, old)}" alt="">`;
  const tiles = (f.kind === 'grand'
    ? [['adventure', 'Aventure', tab('adventure', 'assets/ui/art98/expedition_map.png'), `${festRecord(state).cleared}/${festTotalStages()} étapes`],
      ['boss', 'World Boss', tab('boss', 'assets/ui/art106/hud_event_rift.png').replace('alt=""', 'alt="" style="filter:hue-rotate(140deg)"'), escapeHtml(grandBoss(f.boss).name)],
      ['rift', 'Brèche', tab('rift', 'assets/ui/art106/hud_event_rift.png'), 'Mode de la fête'],
      ['missions', 'Missions', tab('missions', 'assets/ui/art106/event_lights_mission_monsters.png'), ready ? `${ready} à récupérer` : 'Du jour et de la fête'],
      ['shop', 'Boutique', tab('shop', 'assets/ui/art106/event_lights_shop_chest.png'), escapeHtml(f.currency)]]
    : [['path', 'Sentier', tab('path', 'assets/ui/art106/event_lights_node_done.png'), 'Héros et familier gratuits'],
      ['missions', 'Missions', tab('missions', 'assets/ui/art106/event_lights_mission_monsters.png'), ready ? `${ready} à récupérer` : 'Du jour et de la fête'],
      ['shop', 'Boutique', tab('shop', 'assets/ui/art106/event_lights_shop_chest.png'), escapeHtml(f.currency)]])
    .map(([id, label, art, sub]) => `<button type="button" class="m-card fest-door" data-action="fest-hub-open" data-value="${id}">${art}<b>${label}</b><small>${sub}</small>${bd[id] ? `<i class="fest-pill num" aria-label="${bd[id]} à faire">${bd[id]}</i>` : ''}</button>`).join('');
  return `<div class="m-frame cb-frame fest-page">${mTitle('icon_map', 'Événement', true)}${news}${festPoster(state, f)}
    ${mBtnGold('Entrer dans la fête', { action: 'fest-hub-open', value: '', icon: 'icon_map' })}
    <div class="fest-doors">${tiles}</div></div>`;
}
