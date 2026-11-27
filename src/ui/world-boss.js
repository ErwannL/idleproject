// v9.2.9 : écran du World Boss (Expédition des Anciens). Plein écran au-dessus du jeu : la scène du combat
// (render/world-boss-scene.js, vrai rendu + vrai moteur), une barre de PV énorme avec les paliers des phases
// (75 / 50 / 25 %), le chrono, les dégâts, l'annonce de chaque phase, puis le bilan : dégâts de la tentative, record,
// dégâts du jour, paliers de récompense atteints, écus.
// « Réduire les animations » : la tentative est jouée d'un coup, une image fixe de la scène et le bilan s'affichent.
// Fermer en cours de combat termine la tentative avec les dégâts déjà infligés (la tentative est comptée au départ).
import { WORLD_BOSS, WorldBossFight } from '../core/world-boss.js';
import { WorldBossScene, PHASE_COLORS } from '../render/world-boss-scene.js';
import { formatNumber } from '../core/format.js';
import { walletIcon } from './panels/shop.js';
import { reduceMotion } from './prefs.js';
import { escapeHtml, icon } from './common.js';
import { companionById } from '../core/companions.js';

const STEP = 1 / 60;
let open = null; // tentative affichée (une seule à la fois)

const pct = (x) => `${Math.max(0, Math.min(100, Math.round(x * 100)))} %`;

function hudHtml(WORLD_BOSS) { // v9.7.1 (lot 7) : fiche du grand boss affronté
  const notches = WORLD_BOSS.phases.map((p) => `<i class="wb-notch" style="left:${p.at * 100}%"></i>`).join('');
  return `<div class="wb-hud">
      <div class="wb-head"><b class="wb-name">${escapeHtml(WORLD_BOSS.name)}</b><span class="wb-layer hidden"><span>Éveil</span> <b class="num"></b></span>
        <span class="wb-time">⏱ <b class="num">60</b></span></div>
      <div class="wb-bar" role="progressbar" aria-label="PV du boss" aria-valuemin="0" aria-valuemax="100"><i class="wb-lag"></i><i class="wb-fill"></i>${notches}<span class="wb-pct num">100 %</span></div>
      <div class="wb-sub"><span class="wb-phase"><span>Phase</span> <b class="num">0/${WORLD_BOSS.phases.length}</b></span>
        <span class="wb-dmg"><span>Dégâts infligés</span> <b class="num">0</b></span></div>
    </div>
    <div class="wb-banner hidden" aria-live="assertive"></div>
    <div class="wb-actions"><button class="btn small wb-skip" type="button">Passer ⏭</button>
      <button class="btn small wb-quit" type="button" aria-label="Fermer">✕</button></div>
    <div class="wb-live hidden" aria-live="off"><div class="wb-live-title"><span>Dégâts par membre</span><div class="wb-live-best"></div></div><div class="wb-live-rows"></div>
      <div class="wb-live-title"><span>Paliers de récompense</span></div><div class="wb-live-tiers"></div></div>
    <div class="wb-end hidden" role="dialog" aria-modal="true"></div>`;
}

export function endHtml(sum, left, WORLD_BOSS) { // v10.3.1 : repris par le Boss commun (ui/arena-boss.js)
  // v9.7.1 (lot 4) : face-à-face de l'histoire (revanche) — un objectif, réussi ou non, la jauge Revanche.
  if (sum.story) {
    const dots = Array.from({ length: sum.steps }, (_, i) => `<i class="rv-dot${i < sum.level ? ' on' : ''}"></i>`).join('');
    return `<div class="wb-end-card">
      <div class="wb-end-title"><span>${sum.success ? 'Objectif atteint !' : 'Pas encore…'}</span></div>
      <p>${escapeHtml(sum.text)}</p>
      ${sum.gems ? `<div class="wb-end-coins">💎 <b class="num">+${sum.gems}</b> <span>gemmes</span></div>` : '<p class="muted">Améliore ton équipe et retente : rien n\'est perdu.</p>'}
      <div class="rv-gauge"><span>Revanche</span><span class="rv-dots">${dots}</span></div>
      <div class="wb-end-btns"><button class="btn btn-primary wb-close" type="button">Fermer</button></div></div>`;
  }
  // v9.8 (H7) : Titan du jour — tranche atteinte, récompense, essais restants.
  if (sum.titan) {
    return `<div class="wb-end-card">
      <div class="wb-end-title"><span class="wb-record">${escapeHtml(sum.tier)}</span></div>
      <div class="wb-end-dmg"><span>Dégâts de la tentative</span><b class="num">${formatNumber(sum.damage)}</b></div>
      <p class="muted">Barre vidée : <b class="num">${Math.round(sum.ratio * 100)} %</b></p>
      ${sum.given ? `<div class="wb-end-coins">${Object.entries(sum.given).map(([k, v]) => `<span>+${formatNumber(v)} ${escapeHtml({ gems: 'gemmes', shards: 'éclats', keys: 'clé' }[k] ?? k)}</span>`).join(' ')}</div>` : '<p class="muted">Tranche déjà récompensée aujourd\'hui.</p>'}
      <div class="wb-end-btns">${left > 0 ? `<button class="btn btn-gold wb-again" type="button"><span>Réessayer</span> (<b class="num">${left}</b>)</button>` : '<span class="muted">Plus de tentative aujourd\'hui.</span>'}
        <button class="btn btn-primary wb-close" type="button">Fermer</button></div></div>`;
  }
  const tiers = WORLD_BOSS.tiers.map((t, i) => `<span class="wb-tier${i < sum.tiers ? ' on' : ''}"><b class="num">${pct(t)}</b>${i < sum.tiers ? ' ✓' : ''}</span>`).join('');
  return `<div class="wb-end-card">
      <div class="wb-end-title">${sum.record ? '<span class="wb-record">Nouveau record !</span>' : '<span>Tentative terminée</span>'}</div>
      <div class="wb-end-dmg"><span>Dégâts de la tentative</span><b class="num">${formatNumber(sum.damage)}</b></div>
      <div class="wb-end-grid">
        <div><span>Meilleur score</span><b class="num">${formatNumber(sum.best)}</b></div>
        <div><span>Dégâts du jour</span><b class="num">${formatNumber(sum.today)}</b></div>
      </div>
      <div class="wb-end-tiers"><span>Paliers de récompense</span><div>${tiers}</div></div>
      <div class="wb-end-coins">${walletIcon('eventCoins')}<b class="num">+${sum.coins}</b> <span>écus</span></div>
      <div class="wb-end-btns">${left > 0 ? `<button class="btn btn-gold wb-again" type="button"><span>Réessayer</span> (<b class="num">${left}</b>)</button>` : '<span class="muted">Plus de tentative aujourd\'hui.</span>'}
        <button class="btn btn-primary wb-close" type="button">Fermer</button></div>
    </div>`;
}

// Ouvre une tentative. actions = { start() → setup | null, finish(setup, result) → bilan, left() → tentatives restantes }.
export function openWorldBoss(state, actions) {
  if (open) return false;
  const setup = actions.start();
  if (!setup) return false;
  const calm = reduceMotion();
  // v9.3.0 : outil de capture vidéo seulement (window.__wbManual) : barre raccourcie pour filmer la chute du Colosse.
  const short = typeof window !== 'undefined' && window.__wbManual && window.__wbHpMul > 0;
  const fight = new WorldBossFight(state, short ? { ...setup, maxHp: setup.maxHp * window.__wbHpMul } : setup);
  const el = document.createElement('div');
  el.className = `wb-overlay${calm ? ' wb-calm' : ''}`;
  el.innerHTML = `<canvas class="px wb-canvas" aria-label="World Boss"></canvas>${hudHtml(fight.cfg)}`;
  document.body.appendChild(el);
  const canvas = el.querySelector('canvas');
  const scene = new WorldBossScene(canvas, fight, { calm });
  if (typeof window !== 'undefined' && window.__idle?.ui) window.__idle.wbScene = scene; // v9.11 : tests (effets du combat)
  const q = (s) => el.querySelector(s);
  const ctx = { el, fight, scene, setup, raf: 0, acc: 0, last: 0, ended: false, shownPhase: 0, shownLayer: 0, lag: 1, bannerT: 0 };
  open = ctx;
  if (typeof navigator !== 'undefined' && navigator.webdriver) window.__wbScene = scene; // v9.7.1 : captures de contrôle (tests)

  // Paysage : la scène remplit l'écran. Portrait (téléphone) : la scène du téléphone ne montrerait que 160 à 215 px
  // logiques de large (le boss géant hors champ) ; elle est donc rendue comme sur PC (410 px logiques, zoom ×3) puis
  // réduite à la largeur de l'écran, centrée sous la barre du boss.
  const fit = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    scene.phone = w < h; // v10.15.1 : cadrage propre au téléphone (WorldBossScene : dxPhone)
    if (w < h) {
      // v10.15.1 : 410 px logiques (au lieu de 300) : le Colosse, les Titans et les géants (phase 3 : × 1,33) tiennent entiers
      // à côté de l'équipe, sans sortir à droite (la scène est réduite d'autant : 412 px d'écran pour 1230 px de scène).
      const vw = 1230;
      // v10.16 (A7) : la scène prend au moins 45 % de la hauteur de l'écran (60 % visés), sans bandes vides.
      const vh = Math.min(1500, Math.round((h * 0.6 * vw) / w));
      scene.resize(vw, vh);
      const k = w / vw;
      canvas.classList.add('wb-portrait');
      canvas.style.transform = `scale(${k})`;
      const top = Math.max(96, Math.round(Math.min((h - vh * k) / 2, h * 0.12)));
      canvas.style.top = `${top}px`;
      // Téléphone : sous la scène, le bilan en direct (dégâts par membre de l'équipe, paliers).
      const live = q('.wb-live');
      live.style.top = `${Math.round(top + vh * k + 10)}px`;
      live.classList.toggle('hidden', h - (top + vh * k) < 140);
    } else {
      scene.resize(w, h);
      canvas.classList.remove('wb-portrait');
      canvas.style.transform = '';
      canvas.style.top = '';
      // v9.11 (2) : en paysage, le bilan en direct (dégâts par membre, paliers) occupe la bande du bas.
      const live = q('.wb-live');
      live.style.top = ''; live.classList.toggle('wb-live-bottom', h > 600); live.classList.toggle('hidden', h <= 600);
    }
    if (ctx.ended || calm) scene.frame(0); // un canvas redimensionné est vidé : image fixe redessinée
  };
  const ro = new ResizeObserver(fit);
  ro.observe(el);
  fit();

  const banner = (html, color) => {
    const b = q('.wb-banner');
    b.innerHTML = html;
    b.style.setProperty('--wb-color', color);
    b.classList.remove('hidden', 'show');
    void b.offsetWidth;
    b.classList.add('show');
    ctx.bannerT = 2.2;
  };

  // Bilan en direct (téléphone) : dégâts réellement infligés par le héros et chaque membre, paliers atteints.
  const unitName = (id) => (id === 'hero' ? 'Héros' : companionById(id)?.name ?? id);
  const live = () => {
    const box = q('.wb-live');
    if (box.classList.contains('hidden')) return;
    const dmg = fight.world.counters?.damage ?? {};
    const ids = ['hero', ...fight.team];
    const total = Math.max(1, ids.reduce((t, id) => t + (dmg[id] ?? 0), 0));
    q('.wb-live-rows').innerHTML = ids.map((id) => {
      const v = dmg[id] ?? 0;
      // v10.0 (4) : portrait de chaque membre ; les compagnons frappent ×3 contre un grand boss.
      const c = id === 'hero' ? null : companionById(id);
      const face = c ? `<img class="px wb-live-face" src="${icon(c.sprite, c.kind === 'ally' ? 1 : 3)}" alt="">` : '<img class="px wb-live-face" src="assets/sprites/icon_hero.png" alt="">';
      return `<div class="wb-live-row">${face}<span class="wb-live-name">${escapeHtml(unitName(id))}${c ? ' <small class="wb-x3">×3</small>' : ''}</span><i class="wb-live-bar"><i style="width:${(v / total) * 100}%"></i></i><b class="num">${formatNumber(v)}</b></div>`;
    }).join('');
    const best = fight.world.counters?.best;
    const bestEl = q('.wb-live-best');
    if (bestEl) bestEl.innerHTML = best ? `Meilleur coup : <b>${escapeHtml(unitName(best.id))}</b> <b class="num gold-text">${formatNumber(best.v)}</b><br><small>Compagnons ×3 contre les grands boss</small>` : '<small>Compagnons ×3 contre les grands boss</small>';
    const cleared = fight.progress().cleared;
    q('.wb-live-tiers').innerHTML = fight.cfg.tiers.map((t) => `<span class="wb-tier${cleared >= t ? ' on' : ''}"><b class="num">${pct(t)}</b>${cleared >= t ? ' ✓' : ''}</span>`).join('');
  };

  const hud = (dt) => {
    const p = fight.progress();
    const frac = p.frac;
    ctx.lag = Math.max(frac, ctx.lag - dt * 0.35);
    if (frac > ctx.lag + 0.001 || p.layer !== ctx.shownLayer) ctx.lag = frac;
    q('.wb-fill').style.width = `${frac * 100}%`;
    q('.wb-lag').style.width = `${ctx.lag * 100}%`;
    q('.wb-bar').style.setProperty('--wb-color', PHASE_COLORS[fight.phase]);
    q('.wb-bar').setAttribute('aria-valuenow', String(Math.round(frac * 100)));
    q('.wb-pct').textContent = pct(frac);
    q('.wb-time b').textContent = String(Math.ceil(fight.timeLeft));
    q('.wb-time').classList.toggle('low', fight.timeLeft <= 10);
    q('.wb-dmg b').textContent = formatNumber(fight.damage);
    q('.wb-phase b').textContent = `${fight.phase}/${fight.cfg.phases.length}`;
    el.dataset.phase = String(fight.phase);
    if (p.layer > 0) { q('.wb-layer').classList.remove('hidden'); q('.wb-layer b').textContent = `×${p.layer + 1}`; }
    if (fight.phase > ctx.shownPhase && fight.phase > 0) {
      const ph = fight.cfg.phases[fight.phase - 1];
      // v10.19 (5.5) : Titan du jour : les attaques de phase (4 et 5) ont aussi le bandeau « ATTAQUE + nom ».
      const titanPhase = String(fight.bossId ?? '').startsWith('titan_');
      if (!calm) banner(titanPhase ? `<small><span>Attaque</span> · <span>Phase</span> <b class="num">${fight.phase}</b></small><b>${escapeHtml(ph.name)}</b>`
        : `<small><span>Phase</span> <b class="num">${fight.phase}</b></small><b>${escapeHtml(ph.name)}</b>`, PHASE_COLORS[fight.phase]);
    }
    ctx.shownPhase = fight.phase;
    if (p.layer > ctx.shownLayer) {
      if (!calm) banner(`<small><span>Éveil</span> <b class="num">×${p.layer + 1}</b></small><b>Le boss se relève !</b>`, '#ffd23f');
      ctx.shownLayer = p.layer;
      ctx.shownPhase = fight.phase;
    }
    // v9.3.0 : annonce des attaques propres du Colosse (jet de pierre, rayon des yeux), sans couper une annonce de phase.
    for (ctx.abSeen ??= 0; ctx.abSeen < fight.out.length; ctx.abSeen++) {
      const ev = fight.out[ctx.abSeen];
      if (ev.type !== 'ability' || calm || ctx.bannerT > 1) continue;
      banner(`<small><span>${fight.bossId === 'colossus' ? 'Attaque du Colosse' : 'Attaque'}</span></small><b>${escapeHtml(ev.name)}</b>`, ev.id === 'eyebeam' ? (fight.phase >= 3 ? '#ff7a2a' : '#5ff6ff') : '#c9b89a');
      ctx.bannerT = 1.6;
    }
    ctx.liveT = (ctx.liveT ?? 0) - dt;
    if (ctx.liveT <= 0 || dt === 0) { ctx.liveT = 0.25; live(); }
    if (ctx.bannerT > 0) { ctx.bannerT -= dt; if (ctx.bannerT <= 0) q('.wb-banner').classList.add('hidden'); }
  };

  const end = () => {
    if (ctx.ended) return;
    ctx.ended = true;
    cancelAnimationFrame(ctx.raf);
    ctx.raf = 0;
    const sum = actions.finish(setup, fight.result());
    scene.settle(calm ? 0 : 30);
    q('.wb-skip').classList.add('hidden');
    hud(0);
    if (!sum) { close(); return; }
    const box = q('.wb-end');
    box.innerHTML = endHtml(sum, actions.left(), fight.cfg);
    box.classList.remove('hidden');
    box.querySelector('.wb-close').addEventListener('click', close);
    box.querySelector('.wb-again')?.addEventListener('click', () => { close(); openWorldBoss(state, actions); });
    box.querySelector('.wb-close').focus();
  };

  const close = () => {
    if (!ctx.ended) { fight.finish(); end(); return; } // fermer en plein combat : la tentative s'arrête là, et se compte
    ro.disconnect();
    cancelAnimationFrame(ctx.raf);
    el.remove();
    document.removeEventListener('keydown', onKey);
    if (open === ctx) open = null;
    actions.closed?.();
  };
  const onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey);
  q('.wb-skip').addEventListener('click', () => {
    // Passer : la fin du combat est calculée d'un coup (même résultat), on montre la dernière image.
    fight.finish();
    fight.world.events.length = 0; // effets déjà passés : pas rejoués d'un coup
    scene.seen = fight.out.length;
    ctx.abSeen = fight.out.length; // v9.3.0 : pas d'annonce d'attaque déjà passée
    end();
  });
  q('.wb-quit').addEventListener('click', close);

  if (calm) {
    // Animations réduites : la tentative entière, puis une image fixe (2 s de scène pour que tout soit en place).
    fight.finish();
    fight.world.events.length = 0;
    scene.seen = fight.out.length;
    scene.settle(120);
    end();
    return true;
  }

  // Outil de capture vidéo (tools) : images pas à pas, 1/60 s chacune, sans requestAnimationFrame.
  if (typeof window !== 'undefined' && window.__wbManual) {
    window.__wbCtx = ctx;
    window.__wbFrame = () => {
      if (ctx.ended) return true;
      fight.tick();
      scene.frame(STEP);
      hud(STEP);
      if (fight.done) end();
      return ctx.ended;
    };
    return true;
  }

  const tick = (ms) => {
    ctx.raf = 0;
    if (!el.isConnected || ctx.ended) return;
    const dt = Math.min(0.1, Math.max(0, (ms - (ctx.last || ms)) / 1000));
    ctx.last = ms;
    if (!document.hidden) {
      ctx.acc += dt;
      let n = 0;
      while (ctx.acc >= STEP && n < 6) { fight.tick(); ctx.acc -= STEP; n += 1; }
      if (n === 6) ctx.acc = 0;
      scene.frame(dt);
      hud(dt);
    }
    if (fight.done) { end(); return; }
    ctx.raf = requestAnimationFrame(tick);
  };
  ctx.raf = requestAnimationFrame(tick);
  return true;
}

// Captures et tests : état de la tentative en cours.
export const worldBossInfo = () => (open ? { time: open.fight.time, damage: open.fight.damage, phase: open.fight.phase, layer: open.fight.layer, ended: open.ended } : null);
if (typeof window !== 'undefined') window.__worldBoss = worldBossInfo;
