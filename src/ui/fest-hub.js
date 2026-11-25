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
import { reduceMotion } from './prefs.js';

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
      <span class="fh-wallet${bump}">${festCoin(f)}<b class="num">${formatNumber(rec.coins)}</b><small>${escapeHtml(f.currency)}</small></span>
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
  const tints = ['rgba(255,190,120,.10)', 'rgba(120,80,200,.22)', 'rgba(20,10,40,.45)'];
  const M = FEST_RULES.map;
  const regions = (f.regions ?? []).slice(0, M.regions).map((name, ri) => {
    const doneR = rec.cleared >= (ri + 1) * per;
    const nodes = Array.from({ length: N }, (_, i) => {
      const n = ri * per + i + 1;
      const [x, y] = xy(i);
      const st = n <= rec.cleared ? 'done' : n === next ? 'next' : 'off';
      const special = n === M.fragmentStage ? 'crown' : n === M.bossUnlockStage ? 'boss' : n % per === 0 ? 'chest' : '';
      const mark = special ? img(`icon_${special}`) : `<b class="num">${n}</b>`;
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
