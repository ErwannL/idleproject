// v10.3.1 (6.2) : le Boss commun se joue dans l'écran de l'Arène (même cadre que ui/arena-map.js) : bandeau du haut
// (nom, chrono, dégâts infligés), la scène (render/arena-scene.js › ArenaBossScene : l'équipe de campagne sur deux
// rangs, mêmes gestes et effets de sorts, le Colosse en grand), sa barre de vie en haut avec les paliers des phases,
// la rangée des cartes de l'équipe en bas (dégâts de chacun) ; ×2 et Passer. Les règles, le score et le bilan sont
// ceux du World Boss (core/world-boss.js, ui/world-boss.js › endHtml). Hors ligne : « Serveur injoignable ».
// « Réduire les animations » : la tentative est jouée d'un coup, image fixe et bilan.
import { WorldBossFight } from '../core/world-boss.js';
import { PHASE_COLORS } from '../render/world-boss-scene.js';
import { ArenaBossScene } from '../render/arena-scene.js';
import { endHtml } from './world-boss.js';
import { formatNumber } from '../core/format.js';
import { companionById } from '../core/companions.js';
import { COMPANION_ROLES, ROLES } from '../data/synergies.js';
import { escapeHtml, hdArt, img } from './common.js';
import { reduceMotion } from './prefs.js';

const STEP = 1 / 60;
const pct = (x) => `${Math.max(0, Math.min(100, Math.round(x * 100)))} %`;
let open = null;

// actions = { start() → setup | null, finish(setup, result) → bilan, left() → tentatives restantes, closed(), offline() }.
export function openBossArena(ui, actions) {
  if (open || typeof document === 'undefined') return false;
  const setup = actions.start();
  if (!setup) return false;
  document.querySelector('.arena-map')?.remove();
  const calm = reduceMotion();
  const fight = new WorldBossFight(ui.state, setup);
  const cfg = fight.cfg;
  const el = document.createElement('div');
  el.className = 'arena-map am-wb';
  const notches = cfg.phases.map((p) => `<i class="am-notch" style="left:${p.at * 100}%"></i>`).join('');
  el.innerHTML = `<div class="am-top"><b>Boss commun · ${escapeHtml(cfg.name)}</b>
      <span class="am-time"><i>⏱</i><b class="num">${Math.ceil(fight.timeLeft)} s</b></span><span class="am-wb-dmg"><span>Dégâts infligés</span> <b class="num">0</b></span></div>
    <div class="am-stage"><canvas class="px am-canvas"></canvas>
      <div class="am-boss"><b>${escapeHtml(cfg.name)}</b><span class="am-boss-bar"><i></i>${notches}</span><small class="num">100 %</small>
        <span class="am-mech"><i>◆</i><b>Phase</b><span class="num am-wb-phase">0/${cfg.phases.length}</span></span></div>
      <div class="am-banner hidden" aria-live="polite"></div></div>
    <div class="am-bottom"><div class="am-cards"></div>
      <div class="am-ctrl"><button class="btn small am-speed" type="button">×1</button><button class="btn small am-skip" type="button">Passer ⏭</button></div></div>
    <div class="am-end hidden"></div>`;
  document.body.appendChild(el);
  ui.arenaOpen = true;
  const q = (s) => el.querySelector(s);
  const canvas = q('.am-canvas');
  const scene = new ArenaBossScene(canvas, fight, { calm });
  el.scene = scene; // lu par tools/e2e-1031-arena.mjs
  const ctx = { raf: 0, acc: 0, last: 0, ended: false, shownPhase: 0, shownLayer: 0, abSeen: 0, bannerT: 0, speed: 1 };
  open = ctx;
  const fit = () => { const b = q('.am-stage').getBoundingClientRect(); scene.resize(Math.max(200, b.width), Math.max(120, b.height)); if (ctx.ended || calm) scene.frame(0); };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(q('.am-stage'));
  fit();

  // Cartes de l'équipe (héros, compagnons, familier) : part des dégâts de chacun.
  const ids = ['hero', ...fight.team];
  q('.am-cards').innerHTML = ids.map((id, i) => {
    const c = id === 'hero' ? null : companionById(id);
    const role = c ? ROLES[COMPANION_ROLES[id]]?.label ?? '' : 'Héros';
    const pic = c ? hdArt(c, 'am-art') || img(c.sprite) : '<img class="px" src="assets/sprites/icon_hero.png" alt="">';
    const back = c && scene.backIds.has(id) ? 'Derrière' : 'Devant';
    return `<div class="am-card" data-id="${escapeHtml(id)}" style="--i:${i}"><div class="am-pic">${pic}</div><b>${escapeHtml(c?.name ?? 'Héros')}</b>
      <small>${[role, back].filter(Boolean).map(escapeHtml).join(' · ')}</small><span class="am-hp am-share"><i></i></span><b class="num am-card-dmg">0</b></div>`;
  }).join('');

  const banner = (html, color) => {
    if (calm) return;
    const b = q('.am-banner');
    b.innerHTML = html; b.style.setProperty('--wb-color', color);
    b.classList.remove('hidden'); ctx.bannerT = 2;
  };
  const hud = (dt) => {
    const p = fight.progress();
    q('.am-boss-bar > i').style.width = `${p.frac * 100}%`;
    q('.am-boss-bar').style.setProperty('--wb-color', PHASE_COLORS[fight.phase]);
    q('.am-boss small').textContent = pct(p.frac);
    q('.am-time b').textContent = `${Math.ceil(fight.timeLeft)} s`;
    q('.am-time').classList.toggle('low', fight.timeLeft <= 10);
    q('.am-wb-dmg b').textContent = formatNumber(fight.damage);
    q('.am-wb-phase').textContent = `${fight.phase}/${cfg.phases.length}${p.layer > 0 ? ` · Éveil ×${p.layer + 1}` : ''}`;
    if (fight.phase > ctx.shownPhase && fight.phase > 0) banner(`<small><span>Phase</span> <b class="num">${fight.phase}</b></small><b>${escapeHtml(cfg.phases[fight.phase - 1].name)}</b>`, PHASE_COLORS[fight.phase]);
    ctx.shownPhase = fight.phase;
    if (p.layer > ctx.shownLayer) { banner('<small>Éveil</small><b>Le boss se relève !</b>', '#ffd23f'); ctx.shownLayer = p.layer; ctx.shownPhase = fight.phase; }
    for (; ctx.abSeen < fight.out.length; ctx.abSeen++) {
      const ev = fight.out[ctx.abSeen];
      if (ev.type === 'ability' && ctx.bannerT <= 1) banner(`<small>Attaque du Colosse</small><b>${escapeHtml(ev.name)}</b>`, ev.id === 'eyebeam' ? '#5ff6ff' : '#c9b89a');
    }
    if (ctx.bannerT > 0) { ctx.bannerT -= dt; if (ctx.bannerT <= 0) q('.am-banner').classList.add('hidden'); }
    const dmg = fight.world.counters?.damage ?? {};
    const total = Math.max(1, ids.reduce((t, id) => t + (dmg[id] ?? 0), 0));
    for (const card of el.querySelectorAll('.am-card')) {
      const v = dmg[card.dataset.id] ?? 0;
      card.querySelector('.am-share i').style.width = `${(v / total) * 100}%`;
      const t = formatNumber(v); const b = card.querySelector('.am-card-dmg'); if (b.textContent !== t) b.textContent = t;
    }
  };

  const close = () => {
    if (!ctx.ended) { fight.finish(); end(); return; } // fermer en plein combat : la tentative s'arrête là, et se compte
    ro?.disconnect();
    cancelAnimationFrame(ctx.raf);
    document.removeEventListener('keydown', onKey);
    el.remove();
    ui.arenaOpen = false;
    if (open === ctx) open = null;
    actions.closed?.();
  };
  const end = () => {
    if (ctx.ended) return;
    ctx.ended = true;
    cancelAnimationFrame(ctx.raf);
    const sum = actions.finish(setup, fight.result());
    scene.settle(calm ? 0 : 30);
    hud(0);
    q('.am-banner').classList.add('hidden'); // bilan : plus d'annonce de phase par-dessus
    q('.am-ctrl').classList.add('hidden');
    if (!sum) { close(); return; }
    const box = q('.am-end');
    // Hors ligne, la barre commune n'est pas jointe : la tentative compte pour le record, pas pour la barre.
    const off = actions.offline?.() ? '<p class="am-offline">Serveur injoignable : ta tentative compte pour ton record, la barre commune sera à jour au retour du réseau.</p>' : '';
    box.innerHTML = endHtml(sum, actions.left(), cfg).replace('<div class="wb-end-btns">', `${off}<div class="wb-end-btns">`);
    box.classList.remove('hidden');
    box.querySelector('.wb-close').addEventListener('click', close);
    box.querySelector('.wb-again')?.addEventListener('click', () => { close(); openBossArena(ui, actions); });
    box.querySelector('.wb-close').focus({ preventScroll: true });
  };
  const skip = () => {
    // Passer : la fin du combat est calculée d'un coup (même résultat), on montre la dernière image.
    fight.finish();
    fight.world.events.length = 0;
    scene.wb.seen = fight.out.length;
    ctx.abSeen = fight.out.length;
    end();
  };
  const onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey);
  q('.am-skip').addEventListener('click', skip);
  q('.am-speed').addEventListener('click', (e) => { ctx.speed = ctx.speed === 1 ? 2 : 1; e.target.textContent = `×${ctx.speed}`; });
  el.close = close;
  if (calm) {
    fight.finish();
    fight.world.events.length = 0;
    scene.wb.seen = fight.out.length;
    scene.settle(120);
    end();
    return true;
  }
  const tick = (ms) => {
    ctx.raf = 0;
    if (!el.isConnected || ctx.ended) return;
    const dt = Math.min(0.1, Math.max(0, (ms - (ctx.last || ms)) / 1000));
    ctx.last = ms;
    if (!document.hidden) {
      ctx.acc += dt * ctx.speed;
      let n = 0;
      while (ctx.acc >= STEP && n < 6 * ctx.speed) { fight.tick(); ctx.acc -= STEP; n += 1; }
      if (n >= 6 * ctx.speed) ctx.acc = 0;
      scene.frame(dt * ctx.speed);
      hud(dt);
    }
    if (fight.done) { end(); return; }
    ctx.raf = requestAnimationFrame(tick);
  };
  ctx.raf = requestAnimationFrame(tick);
  return true;
}
