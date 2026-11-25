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
import { missionsTab, pathTab, riftTab, shopTab } from './fest-tabs.js'; // v10.14.1
import { preloadFestArt } from './fest-art.js';

const A106 = 'assets/ui/art106/';
const A98 = 'assets/ui/art98/';
const A1014 = 'assets/ui/art1014/'; // v10.14.1 : décors et icônes des fêtes
const TABS = {
  grand: [
    { id: 'adventure', label: 'Aventure', art: `${A1014}fest_tab_adventure.png` },
    { id: 'boss', label: 'World Boss', art: null },
    { id: 'rift', label: 'Brèche', art: `${A1014}fest_tab_rift.png` },
    { id: 'missions', label: 'Missions', art: `${A1014}fest_tab_missions.png` },
    { id: 'shop', label: 'Boutique', art: `${A1014}fest_tab_shop.png` },
  ],
  light: [
    { id: 'path', label: 'Sentier', art: `${A1014}fest_tab_path.png` },
    { id: 'missions', label: 'Missions', art: `${A1014}fest_tab_missions.png` },
    { id: 'shop', label: 'Boutique', art: `${A1014}fest_tab_shop.png` },
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
  preloadFestArt(f);
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
  el.innerHTML = hubHtml(state, f, ui.festHub.tab);
  const m2 = el.querySelector('.fh-main');
  if (m2) m2.scrollTop = scroll;
}

function hubHtml(state, f, tab) {
  const now = liveNow();
  const rec = festRecord(state);
  const timer = f.phase === 'play' ? `⏳ ${festLeft(f.playEnd - now)}` : `🔁 Échange · ${festLeft(f.end - now)}`;
  const bg = tab === 'rift' ? `${A1014}fest_rift_bg.png` : f.art?.key ?? (f.kind === 'grand' ? bgOf(f.zone) : `${A106}event_lights_key.png`);
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
  const tints = f.art?.regions ? ['rgba(0,0,0,.06)', 'rgba(0,0,0,.06)', 'rgba(0,0,0,.06)'] : ['rgba(255,190,120,.10)', 'rgba(120,80,200,.22)', 'rgba(20,10,40,.45)'];
  const regions = (f.regions ?? []).slice(0, FEST_RULES.map.regions).map((name, ri) => {
    const doneR = rec.cleared >= (ri + 1) * per;
    const nodes = Array.from({ length: N }, (_, i) => {
      const n = ri * per + i + 1;
      const [x, y] = xy(i);
      const st = n <= rec.cleared ? 'done' : n === next ? 'next' : 'off';
      const mark = n === FEST_RULES.map.fragmentStage ? img('icon_crown') : n === FEST_RULES.map.bossUnlockStage ? img('icon_boss') : n % per === 0 ? img('icon_chest') : `<b class="num">${n}</b>`;
      return `<span class="fh-node ${st}" style="left:${x}%;top:${y}%">${mark}${n === next && open ? `<span class="fh-hero">${sprite(f.featured)}</span>` : ''}</span>`;
    }).join('');
    return `<div class="fh-region${doneR ? ' cleared' : ''}" style="background-image:linear-gradient(${tints[ri]},${tints[ri]}),url(${f.art?.regions?.[ri] ?? bgOf(f.zone)})">
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
  return `<div class="fh-boss" style="background-image:linear-gradient(180deg,rgba(5,7,13,.1),rgba(5,7,13,.85)),url(${f.art?.arena ?? `assets/bg/${bossZone(f.boss)}_far.png`})">
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

// Brèche, Missions, Boutique et Sentier : ui/fest-tabs.js (v10.14.1).

export { festReady as festHubBadge };
