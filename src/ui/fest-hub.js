// v10.14 : ÉCRAN DE LA FÊTE — une interface à part, plein cadre et illustrée, pour les 14 jours de la grande fête (et la
// petite fête). Haut : titre, minuteur, monnaie, fermer. Milieu : l'onglet choisi. Bas : les onglets en grandes tuiles
// illustrées.
//   Grande fête : Aventure (Carte du héros sur les décors du monde, héros du mois), World Boss (le Titan animé dans son
//   décor), Brèche (le mode de la fête : paliers et bénédictions), Missions, Boutique.
//   Petite fête : Sentier (héros et familier gratuits), Missions, Boutique.
// L'écran vit dans #app (les clics passent par ui.onClick, les fenêtres de récompense s'ouvrent par-dessus) et se
// redessine quand l'interface est invalidée (ui.js → renderFestHub).
import { FEST_RULES, LIGHT_PATH, RIFT_BLESSINGS } from '../data/fest.js';
import { COMPANIONS } from '../data/companions.js';
import { ZONES } from '../data/zones.js';
import { grandBoss } from '../data/grand-bosses.js';
import {
  currentFest, featuredInTeam, festBossStatus, festMissions, festPath, festReady, festRecord, festShop, festStageLevel, festSummonSteps, festTotalStages,
  riftCoins, riftDamageMult, riftFloorLevel, riftSeconds, riftStatus,
} from '../core/fest.js';
import { liveNow } from '../core/live.js';
import { stageLabel } from '../core/combat.js';
import { WORLD_BOSS } from '../core/world-boss.js';
import { escapeHtml, formatNumber, img } from './common.js';
import { festCoin, festGive, festLeft, festSteps, unitArt, unitName } from './panels/event.js';
import { walletIcon } from './panels/shop.js';

const A106 = 'assets/ui/art106/';
const A98 = 'assets/ui/art98/';
const TABS = {
  grand: [
    { id: 'adventure', label: 'Aventure', art: `${A98}expedition_map.png` },
    { id: 'boss', label: 'World Boss', art: null },
    { id: 'rift', label: 'Brèche', art: `${A106}hud_event_rift.png` },
    { id: 'missions', label: 'Missions', art: `${A106}event_lights_mission_monsters.png` },
    { id: 'shop', label: 'Boutique', art: `${A106}event_lights_shop_chest.png` },
  ],
  light: [
    { id: 'path', label: 'Sentier', art: `${A106}event_lights_node_done.png` },
    { id: 'missions', label: 'Missions', art: `${A106}event_lights_mission_monsters.png` },
    { id: 'shop', label: 'Boutique', art: `${A106}event_lights_shop_chest.png` },
  ],
};
const bgOf = (zoneIndex) => `assets/bg/${ZONES[zoneIndex]?.id ?? 'plains'}_far.png`;
const sprite = (id) => { const c = COMPANIONS.find((x) => x.id === id); return c ? img(c.sprite, 'fh-sprite') : ''; };

// Le Titan / Colosse en grand, animé image par image (planche « idle » de sa fiche).
function bossArt(id, cls = '') {
  const gb = grandBoss(id);
  const a = gb.art ?? {};
  const url = `${a.dir}/${a.prefix ?? 'colossus_'}idle.png`;
  return `<span class="fh-boss-art ${cls}" style="background-image:url(${url});${a.filter && !a.dir.includes(id) ? `filter:${a.filter};` : ''}" role="img" aria-label="${escapeHtml(gb.name)}"></span>`;
}
const bossZone = (id) => grandBoss(id).zone ?? 'volcano';

export function openFestHub(ui, tab = null) {
  const f = currentFest();
  if (!f || typeof document === 'undefined') return false;
  ui.festHub = { tab: tab && TABS[f.kind].some((t) => t.id === tab) ? tab : TABS[f.kind][0].id, id: f.id };
  renderFestHub(ui);
  return true;
}
export function closeFestHub(ui) {
  ui.festHub = null;
  ui.root?.querySelector('.fest-hub')?.remove();
}
export function festHubTab(ui, tab) {
  if (!ui.festHub) return openFestHub(ui, tab);
  ui.festHub.tab = tab;
  renderFestHub(ui);
  ui.root?.querySelector('.fh-main')?.scrollTo?.(0, 0);
  return true;
}

export function renderFestHub(ui) {
  if (!ui.festHub || typeof document === 'undefined') return;
  const f = currentFest();
  const root = ui.root ?? document.getElementById('app');
  if (!f || !root) { closeFestHub(ui); return; }
  if (ui.festHub.id !== f.id) ui.festHub = { tab: TABS[f.kind][0].id, id: f.id };
  const state = ui.state;
  let el = root.querySelector('.fest-hub');
  const main = el?.querySelector('.fh-main');
  const scroll = main ? main.scrollTop : 0;
  if (!el) {
    el = document.createElement('div');
    el.className = 'fest-hub';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', f.title);
    root.appendChild(el);
  }
  el.className = `fest-hub fh-${f.kind} fh-tab-${ui.festHub.tab}`;
  el.style.setProperty('--fh-accent', /^#[0-9a-f]{6}$/i.test(f.accent ?? '') ? f.accent : '#c9a14a'); // v10.14.1 : couleur d'accent de la fête
  el.innerHTML = hubHtml(state, f, ui.festHub.tab);
  const m2 = el.querySelector('.fh-main');
  if (m2) m2.scrollTop = scroll;
}

function hubHtml(state, f, tab) {
  const now = liveNow();
  const rec = festRecord(state);
  const timer = f.phase === 'play' ? `⏳ ${festLeft(f.playEnd - now)}` : `🔁 Échange · ${festLeft(f.end - now)}`;
  const bg = f.art?.key ?? (f.kind === 'grand' ? bgOf(f.zone) : `${A106}event_lights_key.png`);
  const m = festMissions(state);
  const missionsReady = [...m.daily, ...m.event].filter((x) => x.ready).length;
  const rift = riftStatus(state);
  const steps = [...festSummonSteps(state), ...festPath(state)].filter((s) => s.reached && !s.claimed).length;
  const wb = festBossStatus(state);
  const badge = { missions: missionsReady, rift: rift?.open && rift.stock > 0 && !rift.run ? rift.stock : 0, adventure: steps, path: steps, boss: wb?.open ? wb.left : 0 };
  const nav = TABS[f.kind].map((t) => {
    const art = t.id === 'boss' ? bossArt(f.boss, 'mini') : `<img class="px" src="${t.art}" alt="">`;
    return `<button type="button" class="fh-tab${t.id === tab ? ' on' : ''}" data-action="fest-hub-tab" data-value="${t.id}" aria-pressed="${t.id === tab}">
      <span class="fh-tab-art">${art}</span><b>${t.label}</b>${badge[t.id] ? `<i class="fh-badge num">${badge[t.id]}</i>` : ''}</button>`;
  }).join('');
  const body = { adventure: adventure, boss: bossTab, rift: riftTab, missions: missionsTab, shop: shopTab, path: pathTab }[tab] ?? adventure;
  return `<div class="fh-bg" style="background-image:url(${bg})"></div>
    <header class="fh-top">
      <span class="fh-head"><small>${f.kind === 'grand' ? 'Grande fête' : 'Petite fête'} · jour ${Math.min(f.day, f.days)}/${f.days}</small><b>${escapeHtml(f.title)}</b></span>
      <span class="fh-timer">${timer}</span>
      <span class="fh-wallet">${festCoin(f)}<b class="num">${formatNumber(rec.coins)}</b><small>${escapeHtml(f.currency)}</small></span>
      <button type="button" class="fh-close" data-action="fest-hub-close" aria-label="Fermer">✕</button>
    </header>
    ${f.phase === 'pause' ? '<div class="fh-pause">Échange de fin de fête : combats fermés, la boutique reste ouverte. La monnaie restante deviendra des éclats.</div>' : ''}
    <main class="fh-main">${body(state, f)}</main>
    <nav class="fh-nav">${nav}</nav>`;
}

// ---- Aventure : Carte du héros ----------------------------------------------------------------------------------
function adventure(state, f) {
  const rec = festRecord(state);
  const per = FEST_RULES.map.stagesPerRegion;
  const next = rec.cleared + 1;
  const total = festTotalStages();
  const open = f.phase === 'play';
  const N = per;
  const xy = (i) => [6 + (i * 88) / (N - 1), 52 + Math.sin(i * 0.9 + 0.4) * 24];
  const road = Array.from({ length: N - 1 }, (_, i) => { const [x1, y1] = xy(i), [x2, y2] = xy(i + 1); return `M${x1} ${y1} L${x2} ${y2}`; }).join(' ');
  const tints = ['rgba(255,190,120,.10)', 'rgba(120,80,200,.22)', 'rgba(20,10,40,.45)'];
  const regions = (f.regions ?? []).slice(0, FEST_RULES.map.regions).map((name, ri) => {
    const doneR = rec.cleared >= (ri + 1) * per;
    const nodes = Array.from({ length: N }, (_, i) => {
      const n = ri * per + i + 1;
      const [x, y] = xy(i);
      const st = n <= rec.cleared ? 'done' : n === next ? 'next' : 'off';
      const mark = n === FEST_RULES.map.fragmentStage ? img('icon_crown') : n === FEST_RULES.map.bossUnlockStage ? img('icon_boss') : n % per === 0 ? img('icon_chest') : `<b class="num">${n}</b>`;
      return `<span class="fh-node ${st}" style="left:${x}%;top:${y}%">${mark}${n === next && open ? `<span class="fh-hero">${sprite(f.featured)}</span>` : ''}</span>`;
    }).join('');
    return `<div class="fh-region${doneR ? ' cleared' : ''}" style="background-image:linear-gradient(${tints[ri]},${tints[ri]}),url(${bgOf(f.zone)})">
      <span class="fh-region-name">${escapeHtml(name)}</span>${doneR ? '<span class="fh-region-done">✓ Région libérée</span>' : ''}
      <svg class="fh-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${road}"/></svg>${nodes}</div>`;
  }).join('');
  const bonus = featuredInTeam(state, f);
  const fight = next <= total
    ? `<div class="fh-card fh-fight"><span><b>Étape ${next}</b><small>Gardien niv. ${stageLabel(festStageLevel(state, next))} · combat de ${FEST_RULES.map.fightSeconds} s</small></span>
        <button type="button" class="m-btn" data-action="fest-fight" data-value="${next}" ${open ? '' : 'disabled'}>Combattre</button>
        <button type="button" class="m-btn-gold" data-action="fest-chain" data-value="${next}" ${open ? '' : 'disabled'}>${img('icon_map')}<span>Enchaîner</span></button></div>`
    : '<div class="fh-card good">Carte terminée : bravo !</div>';
  const summons = festSummonSteps(state);
  return `<div class="fh-adv">
    <section class="fh-herocol">
      <div class="fh-hero-card">${unitArt(f.featured, 'big')}<small>Héros du mois</small><b>${escapeHtml(unitName(f.featured))}</b>
        <span class="fh-bonus${bonus ? ' on' : ''}">${bonus ? '✓ Dans l\'équipe' : 'Dans l\'équipe'} : +${Math.round(FEST_RULES.map.featuredBonus * 100)} % de ${escapeHtml(f.currency)}</span>
        ${open ? `<button type="button" class="m-btn" data-action="open-tab" data-value="summon">${img('icon_summon')}<span>Invoquer</span></button>` : ''}</div>
      ${festSteps(f, summons, 's', `Jalons · ${festRecord(state).fest.summons} invocations`, 'invocations')}
    </section>
    <section class="fh-mapcol"><b class="fh-h">${img('icon_map')} Carte de ${escapeHtml(unitName(f.featured))} · ${rec.cleared}/${total}</b>
      <div class="fh-map">${regions}</div>${fight}
      <small class="fh-help">Étape ${FEST_RULES.map.bossUnlockStage} : World Boss · étape ${FEST_RULES.map.fragmentStage} : fragment Légendaire universel ${festGive({ ssrFragment: 1 })}</small></section>
  </div>`;
}

// ---- World Boss -------------------------------------------------------------------------------------------------
function bossTab(state, f) {
  const st = festBossStatus(state);
  const gb = grandBoss(f.boss);
  if (!st) return '<div class="fh-card">Le World Boss est fermé pour cette fête.</div>';
  const tiers = WORLD_BOSS.tiers.map((t, i) => `<span class="fh-tier${i < st.tiers ? ' on' : ''}"><b class="num">${Math.round(t * 100)} %</b><small>+${FEST_RULES.boss.coinsPerTier}</small></span>`).join('');
  const phases = (gb.fight?.phases ?? []).map((p) => `<span class="fh-phase"><b class="num">${Math.round(p.at * 100)} %</b> ${escapeHtml(p.name)}</span>`).join('');
  const lock = st.pause ? 'Fermé pendant l\'échange.' : `Libère l'étape ${st.unlockStage} de la Carte pour l'affronter.`;
  return `<div class="fh-boss" style="background-image:linear-gradient(180deg,rgba(5,7,13,.1),rgba(5,7,13,.85)),url(assets/bg/${bossZone(f.boss)}_far.png)">
    <div class="fh-boss-stage">${bossArt(f.boss, 'big')}</div>
    <div class="fh-boss-info"><small>World Boss de la fête</small><b class="fh-boss-name">${escapeHtml(gb.name)}</b>
      ${phases ? `<div class="fh-phases">${phases}</div>` : ''}
      ${st.open ? `<div class="fh-stats"><span>${img('icon_boss')}<small>Tentatives</small><b class="num">${st.left}/${st.perDay}</b></span>
        <span>${img('icon_trophy')}<small>Record</small><b class="num">${formatNumber(st.best)}</b></span>
        <span>${img('icon_damage')}<small>Aujourd'hui</small><b class="num">${formatNumber(st.today)}</b></span></div>
        <div class="fh-tiers">${tiers}</div>
        <button type="button" class="m-btn-gold fh-attack" data-action="fest-boss" ${st.left ? '' : 'disabled'}>${img('icon_boss')}<span>${st.left ? 'Attaquer' : 'Reviens demain'}</span></button>
        <small class="fh-help">Combat de ${WORLD_BOSS.seconds} s avec toute l'équipe · +${FEST_RULES.boss.coinsBase} ${escapeHtml(f.currency)} par tentative, +${FEST_RULES.boss.coinsPerTier} par palier.</small>`
    : `<div class="fh-card fh-lock">${img('icon_lock')} ${lock}</div>`}
    </div></div>`;
}

// ---- Brèche : le mode de la fête ---------------------------------------------------------------------------------
function riftTab(state, f) {
  const r = riftStatus(state);
  if (!r) return '';
  const run = r.run;
  const pips = Array.from({ length: r.maxStock }, (_, i) => `<i class="fh-pip${i < r.stock ? ' on' : ''}"></i>`).join('');
  const floorAt = run ? run.floor : 0;
  const track = Array.from({ length: r.floors }, (_, i) => {
    const n = i + 1;
    const first = FEST_RULES.rift.firstClear[n];
    const st = run ? (n < floorAt || (n === floorAt && run.offer) ? 'done' : n === floorAt ? 'next' : 'off') : n <= r.best ? 'best' : 'off';
    return `<span class="fh-floor ${st}"><b class="num">${n}</b>${first ? `<span class="fh-first${r.firsts.includes(n) ? ' got' : ''}">${festGive(first)}</span>` : ''}</span>`;
  }).join('');
  const head = `<div class="fh-rift-head"><img class="px fh-rift-art" src="${A106}hud_event_rift.png" alt="">
    <span><b class="fh-h">Brèche de la fête</b><small>${r.floors} paliers. Après chaque victoire, choisis 1 bénédiction parmi 3. Une défaite coûte un cœur ; la monnaie gagnée est gardée.</small></span>
    <span class="fh-stock"><small>Entrées</small><span class="fh-pips">${pips}</span><small>${r.perDay} par jour · record ${r.best}/${r.floors}</small></span></div>
    <div class="fh-floors">${track}</div>`;
  if (!r.open) return `${head}<div class="fh-card fh-lock">${img('icon_lock')} Fermée pendant l'échange.</div>`;
  if (!run) {
    return `${head}<div class="fh-card fh-rift-start"><span><b>Prêt à entrer ?</b><small>Gardien du palier 1 : niv. ${stageLabel(riftFloorLevel(state, 1))} · ${FEST_RULES.rift.hearts} cœurs</small></span>
      <button type="button" class="m-btn-gold" data-action="rift-start" ${r.stock > 0 ? '' : 'disabled'}>${img('icon_map')}<span>${r.stock > 0 ? 'Entrer (1 entrée)' : 'Plus d\'entrée aujourd\'hui'}</span></button></div>
      <div class="fh-bless-list">${Object.values(RIFT_BLESSINGS).map((b) => `<span class="fh-bless-mini">${img(b.icon)}<b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.text)}</small></span>`).join('')}</div>`;
  }
  const hearts = `<span class="fh-hearts" aria-label="${run.hearts} cœurs">${'♥'.repeat(Math.max(0, run.hearts))}</span>`;
  const owned = run.blessings.length ? `<div class="fh-owned">${run.blessings.map((id) => `<span class="fh-chip">${img(RIFT_BLESSINGS[id].icon)}${escapeHtml(RIFT_BLESSINGS[id].name)}</span>`).join('')}</div>` : '';
  if (run.offer) {
    const cards = run.offer.map((id) => { const b = RIFT_BLESSINGS[id]; return `<button type="button" class="fh-bless" data-action="rift-pick" data-value="${id}">${img(b.icon, 'fh-bless-ico')}<b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.text)}</small></button>`; }).join('');
    return `${head}<b class="fh-h">Palier ${run.floor} franchi ! Choisis une bénédiction ${hearts}</b><div class="fh-bless-row">${cards}</div>${owned}`;
  }
  return `${head}<div class="fh-card fh-rift-fight"><span><b>Palier ${run.floor}/${r.floors}</b><small>Gardien niv. ${stageLabel(riftFloorLevel(state, run.floor))} · ${riftSeconds(run)} s · dégâts ×${riftDamageMult(run).toFixed(2).replace('.', ',')}</small>
      <small>Victoire : +${riftCoins(f, run, run.floor)} ${escapeHtml(f.currency)} · gagné dans cette course : ${run.coins}</small></span>${hearts}
    <button type="button" class="m-btn" data-action="rift-quit">Quitter</button>
    <button type="button" class="m-btn-gold" data-action="rift-fight">${img('icon_damage')}<span>Combattre</span></button></div>${owned}`;
}

// ---- Missions, Boutique, Sentier ----------------------------------------------------------------------------------
const MISSION_ART = { kills: 'event_lights_mission_monsters', bosses: 'event_lights_mission_bosses', dungeons: 'event_lights_mission_dungeon', summons: 'event_lights_mission_summons' };
function missionCard(f, m) {
  const art = MISSION_ART[m.type] ? `<img class="px" src="${A106}${MISSION_ART[m.type]}.png" alt="">` : img(m.type === 'upgrades' ? 'icon_upgrade' : 'icon_star');
  const pct = Math.round(Math.min(1, m.p / m.n) * 100);
  const btn = m.done ? '<span class="fh-stamp">Faite ✓</span>'
    : m.ready ? `<button type="button" class="m-btn-gold" data-action="fest-mission" data-value="${m.id}">Récupérer</button>`
      : m.tab && f.phase === 'play' ? `<button type="button" class="m-btn" data-action="open-tab" data-value="${m.tab}">Y aller</button>` : '';
  return `<div class="fh-mission${m.done ? ' done' : ''}${m.ready ? ' ready' : ''}"><span class="fh-mission-art">${art}</span>
    <span class="fh-mission-body"><b>${escapeHtml(m.label)}</b><span class="fh-bar"><i style="width:${pct}%"></i><small class="num">${formatNumber(m.p)} / ${formatNumber(m.n)}</small></span>
      <span class="fh-mission-gift">${festCoin(f)}<b class="num">+${m.coins}</b>${m.give ? festGive(m.give) : ''}</span></span>${btn}</div>`;
}
function missionsTab(state, f) {
  const m = festMissions(state);
  const ready = [...m.daily, ...m.event].filter((x) => x.ready).length;
  return `<div class="fh-cols"><section><b class="fh-h">${img('icon_timer')} Missions du jour</b>${m.daily.map((x) => missionCard(f, x)).join('')}</section>
    <section><b class="fh-h">${img('icon_trophy')} Missions de la fête</b>${m.event.map((x) => missionCard(f, x)).join('')}</section></div>
    ${ready > 1 ? `<button type="button" class="m-btn-gold fh-wide" data-action="fest-missions-all">Tout récupérer (${ready})</button>` : ''}`;
}
// Boutique illustrée : grande image, nom, quantité, stock, prix.
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
function shopCard(f, i) {
  let art;
  let name;
  let qty = '';
  if (i.unit) { art = unitArt(i.unit, 'shop'); name = `Copie : ${escapeHtml(unitName(i.unit))}`; }
  else {
    const [k, v] = Object.entries(i.give)[0];
    const look = SHOP_LOOK[k] ?? { name: k, icon: 'icon_chest' };
    art = look.art ? `<img class="px" src="${look.art}" alt="">` : look.wallet ? walletIcon(k, false) : img(look.icon);
    name = escapeHtml(look.name);
    qty = `×${formatNumber(v)}`;
  }
  return `<div class="fh-item${i.can ? '' : ' off'}${i.left ? '' : ' sold'}"><span class="fh-item-art">${art}</span><b>${name}</b>${qty ? `<span class="fh-qty num">${qty}</span>` : ''}
    <small class="num">${i.left ? `Reste ${i.left}/${i.stock}` : 'Épuisé'}</small>
    <button type="button" class="m-btn" data-action="fest-buy" data-value="${i.id}" ${i.can ? '' : 'disabled'}>${festCoin(f)}<span class="num">${i.price}</span></button></div>`;
}
function shopTab(state, f) {
  return `<b class="fh-h">${festCoin(f)} Boutique · ${escapeHtml(f.currency)}</b><div class="fh-shop">${festShop(state).map((i) => shopCard(f, i)).join('')}</div><small class="fh-help">Ce qui reste à la fin de l'échange devient des éclats (${FEST_RULES.leftoverShards} par ${escapeHtml(f.currency)}).</small>`;
}
function pathTab(state, f) {
  const path = festPath(state);
  const earned = festRecord(state).fest.earned;
  const N = path.length;
  const xy = (i) => [4 + (i * 92) / (N - 1), 55 + Math.sin(i * 1.05 + 0.5) * 26];
  const road = path.slice(0, -1).map((s, i) => { const [x1, y1] = xy(i), [x2, y2] = xy(i + 1); return `M${x1} ${y1} L${x2} ${y2}`; }).join(' ');
  let here = -1;
  for (const s of path) if (s.reached) here = s.index;
  const nodes = path.map((s, i) => {
    const [x, y] = xy(i);
    const st = s.claimed ? 'claimed' : s.reached ? 'ready' : 'off';
    const gift = [s.give ? festGive(s.give) : '', s.hero ? unitArt(f.hero, 'mini') : '', s.pet ? unitArt(f.pet, 'mini pet') : ''].join('');
    return `<button type="button" class="fh-pnode ${st}${s.hero || s.pet ? ' prize' : ''}" style="left:${x}%;top:${y}%" ${s.reached && !s.claimed ? `data-action="fest-step" data-value="p${i}"` : 'disabled'}>
      <img class="px" src="${A106}${s.reached ? 'event_lights_node_done' : 'event_lights_node'}.png" alt=""><span class="fh-pgift">${gift}</span><small class="num">${s.at}</small>${i === here ? `<span class="fh-hero">${sprite(f.hero)}</span>` : ''}</button>`;
  }).join('');
  const ready = path.filter((s) => s.reached && !s.claimed).length;
  const hero = LIGHT_PATH.filter((s) => s.hero).length;
  const pet = LIGHT_PATH.filter((s) => s.pet).length;
  return `<div class="fh-gifts"><span class="fh-gift">${unitArt(f.hero, 'big')}<b>${escapeHtml(unitName(f.hero))}</b><small>Héros gratuit · ×${hero} sur le sentier</small></span>
      <span class="fh-gift">${unitArt(f.pet, 'big pet')}<b>${escapeHtml(unitName(f.pet))}</b><small>Familier gratuit · ×${pet} sur le sentier</small></span></div>
    <b class="fh-h">${img('icon_map')} Sentier · ${formatNumber(earned)} ${escapeHtml(f.currency)} gagnés</b>
    <div class="fh-path" style="background-image:url(${A106}event_lights_path.png)"><svg class="fh-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${road}"/></svg>${nodes}</div>
    ${ready > 1 ? `<button type="button" class="m-btn-gold fh-wide" data-action="fest-steps-all">Tout récupérer (${ready})</button>` : ''}
    <small class="fh-help">La monnaie tombe en jouant (monstres et boss, ${FEST_RULES.trickle.dailyCap} par jour au plus) et avec les missions. Dépenser ne fait pas reculer sur le sentier.</small>`;
}

export { festReady as festHubBadge };
