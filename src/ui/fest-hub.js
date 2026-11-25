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
import { pickArt, preloadFestArt } from './fest-art.js';
import { walletIcon } from './panels/shop.js';
import { reduceMotion } from './prefs.js';

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
  // v10.15 : planche d'un nouveau géant (autant d'images que `anims.idle.n`, sans image de réserve) : cadence à part.
  const n = a.exactSheets ? a.anims?.idle?.n : 0;
  const run = n > 1 ? `--fh-n:${n};background-size:${n * 100}% 100%;animation-name:fh-idle-n;animation-timing-function:steps(${n});` : '';
  return `<span class="fh-boss-art ${cls}" style="background-image:url(${url});${run}${a.filter && !a.dir.includes(id) ? `filter:${a.filter};` : ''}" role="img" aria-label="${escapeHtml(gb.name)}"></span>`;
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
  el.style.setProperty('--fh-accent', /^#[0-9a-f]{6}$/i.test(f.accent ?? '') ? f.accent : '#c9a14a'); // v10.14.1 : couleur d'accent de la fête
  const coins = festRecord(state).coins;
  if (typeof ui.festHub.coins === 'number' && coins > ui.festHub.coins) ui.festHub.bumpAt = Date.now();
  ui.festHub.coins = coins;
  el.innerHTML = hubHtml(state, f, ui.festHub.tab, ui.festHub);
  const m2 = el.querySelector('.fh-main');
  if (m2) m2.scrollTop = scroll;
}

function hubHtml(state, f, tab, hub = {}) {
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
  // La monnaie rebondit quand on gagne (animation décalée de ce qui s'est déjà écoulé : un redessin ne la relance pas).
  const since = Date.now() - (hub.bumpAt ?? 0);
  const bump = hub.bumpAt && since < 450 && !reduceMotion() ? ` bump" style="animation-delay:-${Math.round(since)}ms` : '';
  const pause = f.phase === 'pause'
    ? `<div class="fh-pause fh-swap"><img class="px fh-swap-art" src="assets/ui/art102/loot_chest_open.png" alt=""><span><b>Dépense tes ${escapeHtml(f.currency)} : encore ${festLeft(f.end - now).replace(/ /g, ' ')}</b><small>Combats fermés, boutique ouverte. Le reste devient des éclats.</small></span></div>`
    : '';
  return `<div class="fh-bg" style="background-image:url(${bg})"></div>
    <header class="fh-top">
      <span class="fh-head"><small>${f.kind === 'grand' ? 'Grande fête' : 'Petite fête'} · jour ${Math.min(f.day, f.days)}/${f.days}</small>
        <span class="fh-title"><b>${escapeHtml(f.title)}</b><button type="button" class="fh-help-btn" data-action="fest-hub-help" aria-label="Comment ça marche ?">?</button></span></span>
      <span class="fh-timer"><b>${timer}</b>${f.phase === 'play' ? `<small>puis ${FEST_RULES.pauseDays} jours d'échange</small>` : ''}</span>
      <span class="fh-wallet${bump}" title="${escapeHtml(f.currency)}">${festCoin(f)}<b class="num">${formatNumber(rec.coins)}</b><small>${escapeHtml(f.currency)}</small></span>
      <button type="button" class="fh-close" data-action="fest-hub-close" aria-label="Fermer">✕</button>
    </header>
    ${pause}
    <main class="fh-main">${body(state, f, hub)}</main>
    <nav class="fh-nav">${nav}</nav>`;
}

// Fiche « ? » : la fête en 4 lignes (rythme, monnaie, échange, conversion en éclats).
export function festHubHelp(ui) {
  const f = currentFest();
  if (!f) return;
  const c = f.currency;
  const P = FEST_RULES.pauseDays;
  const lines = f.kind === 'grand'
    ? [['Rythme', `la grande fête dure ${f.days} jours, puis ${P} jours d'échange, puis la petite fête du mois.`],
      ['Monnaie', `tes ${c} se gagnent sur la Carte, au World Boss, dans la Brèche et avec les missions.`],
      ['Échange', `les ${P} derniers jours, les combats sont fermés et la boutique reste ouverte.`],
      ['Éclats', `ce qui reste à la fin devient des éclats (${FEST_RULES.leftoverShards} par pièce). Tu ne perds rien.`]]
    : [['Rythme', `la petite fête dure jusqu'à l'échange des ${P} derniers jours du mois.`],
      ['Monnaie', `tes ${c} tombent en jouant (monstres, boss) et avec les missions : elles font avancer le sentier.`],
      ['Échange', `les ${P} derniers jours, il ne reste que la boutique.`],
      ['Éclats', `ce qui reste à la fin devient des éclats (${FEST_RULES.leftoverShards} par pièce). Tu ne perds rien.`]];
  ui.openModal(`<h2>${escapeHtml(f.title)}</h2><ul class="fh-help-list">${lines.map(([k, t]) => `<li><b>${k}</b> ${escapeHtml(t)}</li>`).join('')}</ul>
    <div class="detail-actions"><button class="btn btn-gold" data-action="close-modal">Compris</button></div>`);
}

// ---- Aventure : Carte du héros ----------------------------------------------------------------------------------
// Jalons d'invocation : une barre continue qui passe par les 5 récompenses (posées dessus), position actuelle marquée.
function summonTrack(state, f) {
  const steps = festSummonSteps(state);
  const have = festRecord(state).fest.summons;
  if (!steps.length) return '';
  const n = steps.length;
  const centre = (i) => ((i + 0.5) / n) * 100;
  let fill = 100;
  if (have < steps[n - 1].at) {
    let prevAt = 0;
    let prevPos = 0;
    for (let i = 0; i < n; i += 1) {
      if (have <= steps[i].at) { fill = prevPos + ((have - prevAt) / (steps[i].at - prevAt)) * (centre(i) - prevPos); break; }
      prevAt = steps[i].at;
      prevPos = centre(i);
    }
  }
  const next = steps.find((s) => s.at > have);
  const ready = steps.filter((s) => s.reached && !s.claimed).length;
  const tiles = steps.map((s) => {
    const cls = s.claimed ? 'claimed' : s.reached ? 'ready' : 'off';
    return `<button type="button" class="fh-ms ${cls}" ${s.reached && !s.claimed ? `data-action="fest-step" data-value="s${s.index}"` : 'disabled'} title="${s.at} invocations">
      <span class="fh-ms-gift">${festGive(s.give)}</span>${s.claimed ? '<i class="fh-ms-ok">✓</i>' : ''}<small class="num">${s.at}</small></button>`;
  }).join('');
  const dots = steps.map((s, i) => `<i class="fh-ms-dot${have >= s.at ? ' on' : ''}" style="left:${centre(i)}%"></i>`).join('');
  return `<div class="fh-summons"><b class="fh-h">${img('icon_summon')} Jalons d'invocation</b>
    <div class="fh-ms-row">${tiles}</div>
    <div class="fh-ms-bar" role="progressbar" aria-valuenow="${have}" aria-valuemin="0" aria-valuemax="${steps[n - 1].at}"><i class="fh-ms-fill" style="width:${fill.toFixed(1)}%"></i>${dots}
      <i class="fh-ms-pos" style="left:${fill.toFixed(1)}%"></i><b class="fh-ms-label num">${have}${next ? ` / ${next.at}` : ''}</b></div>
    ${ready > 1 ? `<button type="button" class="m-btn fh-wide" data-action="fest-steps-all">Tout récupérer (${ready})</button>` : ''}</div>`;
}

function adventure(state, f, hub = {}) {
  const rec = festRecord(state);
  const per = FEST_RULES.map.stagesPerRegion;
  const next = rec.cleared + 1;
  const total = festTotalStages();
  const open = f.phase === 'play';
  const N = per;
  const xy = (i) => [6 + (i * 88) / (N - 1), 66 + Math.sin(i * 0.9 + 0.4) * 14];
  const road = Array.from({ length: N - 1 }, (_, i) => { const [x1, y1] = xy(i), [x2, y2] = xy(i + 1); return `M${x1} ${y1} L${x2} ${y2}`; }).join(' ');
  const tints = f.art?.regions ? ['rgba(0,0,0,.06)', 'rgba(0,0,0,.06)', 'rgba(0,0,0,.06)'] : ['rgba(255,190,120,.10)', 'rgba(120,80,200,.22)', 'rgba(20,10,40,.45)'];
  const M = FEST_RULES.map;
  const regions = (f.regions ?? []).slice(0, M.regions).map((name, ri) => {
    const doneR = rec.cleared >= (ri + 1) * per;
    const nodes = Array.from({ length: N }, (_, i) => {
      const n = ri * per + i + 1;
      const [x, y] = xy(i);
      const st = n <= rec.cleared ? 'done' : n === next ? 'next' : 'off';
      const special = n === M.fragmentStage ? 'crown' : n === M.bossUnlockStage ? 'boss' : n % per === 0 ? 'chest' : '';
      const mark = special ? (() => { const u = pickArt(`${A1014}fest_node_${special}.png`, null); return u ? `<img class="px" src="${u}" alt="">` : img(`icon_${special}`); })() : `<b class="num">${n}</b>`;
      const tip = n === M.fragmentStage ? `Étape ${n} : fragment Légendaire universel`
        : n === M.bossUnlockStage ? `Étape ${n} : débloque le World Boss · +${M.stageCoins + M.regionCoins} ${f.currency}`
          : n % per === 0 ? `Étape ${n} : coffre de région · +${M.stageCoins + M.regionCoins} ${f.currency}` : `Étape ${n} : +${M.stageCoins} ${f.currency}`;
      return `<span class="fh-node ${st}${special ? ` sp-${special}` : ''}" style="left:${x}%;top:${y}%" title="${escapeHtml(tip)}">${mark}${n === next && open ? `<span class="fh-hero">${sprite(f.featured)}</span>` : ''}</span>`;
    }).join('');
    const art = f.art?.regions?.[ri];
    const bg = art ? `linear-gradient(180deg,rgba(11,17,36,0),rgba(11,17,36,.3)),url(${art})` : `linear-gradient(${tints[ri]},${tints[ri]}),url(${bgOf(f.zone)})`;
    return `<div class="fh-region${doneR ? ' cleared' : ''}"><div class="fh-region-head"><span class="fh-region-name">${escapeHtml(name)}</span>${doneR ? '<span class="fh-region-done">✓ Région libérée</span>' : ''}</div>
      <div class="fh-stage" style="background-image:${bg}"><svg class="fh-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${road}"/></svg>${nodes}</div></div>`;
  }).join('');
  // Combat : Combattre (sombre) et Enchaîner (doré) sur une ligne ; une défaite fait trembler la carte et propose d'améliorer.
  const since = Date.now() - (hub.lost?.at ?? 0);
  const lost = hub.lost?.n === next;
  const shake = lost && since < 450 && !reduceMotion() ? ` shake" style="animation-delay:-${Math.round(since)}ms` : '';
  const fight = next <= total
    ? `<div class="fh-card fh-fight${lost ? ' lost' : ''}${shake}"><span class="fh-fight-info"><b>Étape ${next}</b><span class="fh-power">Gardien niv. ${stageLabel(festStageLevel(state, next))}</span><small>combat de ${M.fightSeconds} s</small></span>
        ${lost ? '<button type="button" class="m-btn fh-upgrade" data-action="fest-hub-go" data-value="forge">Améliorer ›</button>' : ''}
        <button type="button" class="m-btn" data-action="fest-fight" data-value="${next}" ${open ? '' : 'disabled'}>Combattre</button>
        <button type="button" class="m-btn-gold" data-action="fest-chain" data-value="${next}" ${open ? '' : 'disabled'}>${img('icon_map')}<span>Enchaîner</span></button></div>`
    : '<div class="fh-card good">Carte terminée : bravo !</div>';
  // Bonus du héros du mois : badge vert dans l'équipe, sinon il propose de le mettre dans l'équipe ou de l'invoquer.
  const bonus = featuredInTeam(state, f);
  const pct = `+${Math.round(M.featuredBonus * 100)} % de ${escapeHtml(f.currency)}`;
  const owned = Boolean(state.companions?.owned?.[f.featured]);
  const badge = bonus ? `<span class="fh-bonus on"><b>✓ ${pct}</b><small>Dans l'équipe</small></span>`
    : open ? `<button type="button" class="fh-bonus act" data-action="fest-hub-go" data-value="${owned ? 'companions' : 'summon'}"><b>${pct}</b><small>${owned ? 'Mettre dans l\'équipe ›' : 'Invoquer ›'}</small></button>`
      : `<span class="fh-bonus"><b>${pct}</b><small>avec le héros dans l'équipe</small></span>`;
  return `<div class="fh-adv">
    <section class="fh-mapcol"><b class="fh-h">${img('icon_map')} Carte de ${escapeHtml(unitName(f.featured))} · ${rec.cleared}/${total}</b>
      <div class="fh-map">${regions}</div>${fight}
      <small class="fh-help">Étape ${M.bossUnlockStage} : World Boss · étape ${M.fragmentStage} : fragment Légendaire universel ${festGive({ ssrFragment: 1 })}</small></section>
    <section class="fh-herocol">
      <div class="fh-hero-card">${unitArt(f.featured, 'big')}<small>Héros du mois</small><b>${escapeHtml(unitName(f.featured))}</b>${badge}</div>
      ${summonTrack(state, f)}
    </section>
  </div>`;
}

// ---- World Boss -------------------------------------------------------------------------------------------------
// Barre de PV du boss dessinée : une marque par phase (seuil de PV restants), avec son nom dessous.
function bossHpBar(gb) {
  const ph = gb.fight?.phases ?? [];
  const marks = ph.map((p) => `<i class="fh-hp-mark" style="left:${Math.round(p.at * 100)}%"></i>`).join('');
  const names = ph.map((p) => `<span class="fh-hp-phase" style="left:${Math.round(p.at * 100)}%"><b class="num">${Math.round(p.at * 100)} %</b><small>${escapeHtml(p.name)}</small></span>`).join('');
  return `<div class="fh-hp"><div class="fh-hp-bar" role="img" aria-label="PV du boss"><i class="fh-hp-fill"></i>${marks}</div>${ph.length ? `<div class="fh-hp-names">${names}</div>` : ''}</div>`;
}

function bossTab(state, f, hub = {}) {
  const st = festBossStatus(state);
  const gb = grandBoss(f.boss);
  if (!st) return '<div class="fh-card">Le World Boss est fermé pour cette fête.</div>';
  const tiers = WORLD_BOSS.tiers.map((t, i) => `<span class="fh-tier${i < st.tiers ? ' on' : ''}"><b class="num">${Math.round(t * 100)} %</b><small>+${FEST_RULES.boss.coinsPerTier}</small></span>`).join('');
  // Tentatives : une épée par essai du jour, pleine ou vide.
  const swords = Array.from({ length: st.perDay }, (_, i) => `<i class="fh-sword${i < st.left ? ' on' : ''}">${img('icon_damage')}</i>`).join('');
  const arena = f.art?.arena;
  const bg = arena ? `url(${arena})` : `url(assets/bg/${bossZone(f.boss)}_far.png)`;
  const rep = hub.bossReport;
  const report = rep && st.open
    ? `<div class="fh-report" role="status"><b>Bilan de la tentative</b>
        <span class="fh-report-row"><span>${img('icon_damage')}<small>Dégâts</small><b class="num">${formatNumber(rep.damage)}</b></span>
          <span class="${rep.record ? 'new' : ''}">${img('icon_trophy')}<small>${rep.record ? 'Nouveau record' : 'Record'}</small><b class="num">${formatNumber(rep.best)}</b></span>
          <span>${img('icon_boss')}<small>Palier</small><b class="num">${rep.tiers}/${WORLD_BOSS.tiers.length}</b></span>
          <span>${festCoin(f)}<small>Gagné</small><b class="num">+${formatNumber(rep.coins)}</b></span></span></div>` : '';
  const open = st.open;
  const lock = st.pause
    ? `<div class="fh-card fh-lock">${img('icon_lock')} Fermé pendant l'échange.</div>`
    : `<div class="fh-card fh-lock">${img('icon_lock')}<span>Titan verrouillé</span>
        <button type="button" class="m-btn" data-action="fest-hub-tab" data-value="adventure">Libère l'étape ${st.unlockStage} ›</button></div>`;
  return `<div class="fh-boss${open ? '' : ' fh-locked'}" style="background-image:linear-gradient(180deg,rgba(5,7,13,.05),rgba(5,7,13,.7)),${bg}">
    <div class="fh-boss-stage"><span class="fh-boss-fig">${bossArt(f.boss, 'big')}</span>${open ? '' : `<span class="fh-boss-lock">${img('icon_lock')}</span>`}</div>
    <div class="fh-boss-info"><small>World Boss de la fête</small><b class="fh-boss-name">${escapeHtml(gb.name)}</b>
      ${bossHpBar(gb)}
      ${open ? `<div class="fh-stats"><span>${img('icon_boss')}<small>Tentatives</small><span class="fh-swords" aria-label="${st.left} sur ${st.perDay}">${swords}</span></span>
        <span>${img('icon_trophy')}<small>Record</small><b class="num">${formatNumber(st.best)}</b></span>
        <span>${img('icon_damage')}<small>Aujourd'hui</small><b class="num">${formatNumber(st.today)}</b></span></div>
        <div class="fh-tiers">${tiers}</div>
        <button type="button" class="m-btn-gold fh-attack" data-action="fest-boss" ${st.left ? '' : 'disabled'}>${img('icon_boss')}<span>${st.left ? 'Attaquer' : 'Reviens demain'}</span></button>
        ${report}
        <small class="fh-help">Combat de ${WORLD_BOSS.seconds} s · +${FEST_RULES.boss.coinsBase} ${escapeHtml(f.currency)} par tentative, +${FEST_RULES.boss.coinsPerTier} par palier.</small>`
    : lock}
    </div></div>`;
}

// Brèche, Missions, Boutique et Sentier : ui/fest-tabs.js (v10.14.1).

export { festReady as festHubBadge };
