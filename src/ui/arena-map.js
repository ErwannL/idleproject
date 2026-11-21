// v10.2 (P6) : écran de l'Arène sur la carte. Bandeau du haut (étage, règle illustrée, chronomètre, étoiles en
// cours), la scène du monde (render/arena-scene.js) et, en bas, la rangée de cartes de la formation (portrait, nom,
// « rôle · sort », PV, jauge d'ultime). Mode Manuel : quand l'ultime d'une carte arrive, le combat attend qu'on la
// touche (elle brille). ×2 et Passer. Fin : les étoiles tombent une à une, les récompenses, puis « Étage suivant ».
import { CARD_ARENA as A } from '../data/arena-floors.js';
import { ROLES } from '../data/synergies.js';
import { ArenaScene, ARENA_STEP } from '../render/arena-scene.js';
import { escapeHtml, hdArt, img, rewardIcons } from './common.js';
import { COMPANIONS } from '../data/companions.js';
import { bossOf, floorName, monsterOf } from '../core/arena-cards.js';
import { COMPANION_ROLES as ROLE_OF } from '../data/synergies.js';
import { reduceMotion } from './prefs.js';
import { TRAITS } from '../core/boss-traits.js';

const RULE_ART = { armored: 'rule_armored', swift: 'rule_swift', noheal: 'rule_noheal', frenzy: 'rule_frenzy', first: 'rule_first', backline: 'rule_backline' };
const RULE_NAME = { armored: 'Carapace', swift: 'Vif-argent', noheal: 'Plaie ouverte', frenzy: 'Frénésie', first: 'Embuscade', backline: 'Assaut arrière' };
export const ruleArt = (id) => (RULE_ART[id] ? `assets/ui/art102/${RULE_ART[id]}.png` : null);
export const ruleName = (id) => RULE_NAME[id] ?? '';
// v10.3 (audit) : plus de « Embuscade : Embuscade : … » quand le texte de la règle commence déjà par son nom.
export const ruleDup = (rule) => Boolean(rule && ruleName(rule.id) && rule.text.startsWith(`${ruleName(rule.id)} : `));

// v10.2 (P6) : la Survie (core/arena.js › fight) passe aussi par la carte : ses événements sont traduits dans la
// forme de fightBoard (cartes à des cases, vagues de vrais monstres du monde de leur élément).
export function survivalAsCards(r) {
  const team = r.team.map((p, i) => ({ ...p, pos: [1, 0, 2, 4, 3][i] ?? i, role: ROLE_OF[p.id] ?? 'pet', skills: [] }));
  const posOf = new Map(team.map((c) => [c.id, c.pos]));
  let w = 0, alive = [];
  const events = [];
  let first = null;
  for (const e of r.fight.events) {
    if (e.kind === 'wave') {
      w = e.i;
      // v10.3 (audit) : le nom vient de la même fiche que le sprite (un boss de vague portait le nom d'un monstre).
      const cards = e.foes.map((f, i) => { const mo = f.boss ? bossOf(f.element, e.n ?? w) : monsterOf(f.element, (e.n ?? w) + 1, i); return { name: mo.name, enemyId: mo.id, element: f.element, maxHp: f.maxHp, boss: f.boss, pos: w * 10 + i }; });
      alive = cards.map((c) => c.pos);
      if (!first) first = cards; else events.push({ t: e.t, kind: 'wave', n: e.n, cards });
    } else if (e.kind === 'hit' || e.kind === 'skill') events.push({ t: e.t, kind: e.kind, side: 'ally', from: posOf.get(e.who), to: w * 10 + e.foe, d: e.d, crit: e.crit, elem: e.elem });
    else if (e.kind === 'heal' || e.kind === 'shield' || e.kind === 'rally') events.push({ t: e.t, kind: e.kind === 'rally' ? 'shield' : e.kind, side: 'ally', from: posOf.get(e.who), to: posOf.get(e.who) });
    else if (e.kind === 'hurt') events.push({ t: e.t, kind: 'hit', side: 'foe', from: alive[0] ?? w * 10, to: posOf.get(e.who), d: e.d });
    else if (e.kind === 'kill') { const pos = w * 10 + e.foe; alive = alive.filter((x) => x !== pos); events.push({ t: e.t, kind: 'fall', side: 'foe', pos }); }
    else if (e.kind === 'fall') events.push({ t: e.t, kind: 'fall', side: 'ally', pos: posOf.get(e.who) });
  }
  return { survival: true, floor: 0, team, setup: { cards: first ?? [], rule: null }, events, seconds: r.fight.seconds, won: r.won, stars: 0, reward: null,
    wave: r.wave, kills: r.kills, rewards: r.rewards, record: r.record, end: null };
}

// v10.3.1 (6.2) : récompenses de fin de combat sur deux lignes, comme la fin de donjon : « Progression » (gemmes, or,
// clés, fragments) puis « Matériaux » (éclats, grimoires, pierres, essences).
const MATERIALS = new Set(['shards', 'grimoire', 'ascension', 'mastery']);
export function rewardRows(reward) {
  const pick = (mat) => Object.fromEntries(Object.entries(reward ?? {}).filter(([k, v]) => v > 0 && MATERIALS.has(k) === mat));
  const row = (label, part) => { const html = rewardIcons(part, 'named'); return html ? `<div class="am-rw-row"><small>${label}</small>${html}</div>` : ''; };
  const rows = row('Progression', pick(false)) + row('Matériaux', pick(true));
  return rows ? `<div class="am-end-rw am-end-rows">${rows}</div>` : '';
}

export function openArenaMap(ui, run, { onNext, onRetry } = {}) {
  document.querySelector('.arena-map')?.remove();
  const el = document.createElement('div');
  el.className = 'arena-map';
  const rule = run.setup.rule;
  const title = run.survival ? 'Épreuve · Survie' : `Arène · ${escapeHtml(floorName(run.floor))}`;
  el.innerHTML = `<div class="am-top"><b>${title}</b>
      ${rule ? `<span class="am-rule">${ruleArt(rule.id) ? `<img class="px" src="${ruleArt(rule.id)}" alt="">` : ''}${ruleDup(rule) ? `<b>${escapeHtml(rule.text)}</b>` : `<b>${escapeHtml(ruleName(rule.id))}</b> : ${escapeHtml(rule.text)}`}</span>` : ''}
      <span class="am-time"><i>⏱</i><b class="num">0 s</b>${run.survival ? '' : `<small>3 ★ en moins de ${A.star3} s</small>`}</span><span class="am-stars">★★★</span></div>
    <div class="am-stage"><canvas class="px am-canvas"></canvas><div class="am-flash" aria-hidden="true"></div><div class="am-names" aria-hidden="true"></div>
      <div class="am-boss hidden"><b></b><span class="am-boss-bar"><i></i></span><small class="num"></small><span class="am-mech hidden"><i>◆</i><b></b><span></span></span></div></div>
    <div class="am-bottom"><div class="am-cards"></div>
      <div class="am-ctrl"><button class="btn small am-speed" type="button">×1</button><button class="btn small am-mode" type="button">Auto</button><button class="btn small am-skip" type="button">Passer ⏭</button></div></div>
    <div class="am-end hidden"></div>`;
  document.body.appendChild(el);
  ui.arenaOpen = true;
  const canvas = el.querySelector('.am-canvas');
  // v10.3 (audit) : si la scène ne peut pas se construire, l'écran se referme au lieu de rester bloqué par-dessus le jeu.
  let scene;
  try { scene = new ArenaScene(canvas, run, ui.state); } catch (err) { ui.arenaOpen = false; el.remove(); ui.invalidate?.(); throw err; }
  el.scene = scene; // lu par tools/e2e-103-audit.mjs
  const fit = () => { const b = el.querySelector('.am-stage').getBoundingClientRect(); scene.resize(Math.max(200, b.width), Math.max(120, b.height)); };
  fit();
  const onResize = () => fit();
  addEventListener('resize', onResize);
  let speed = 1, manual = false, skip = reduceMotion(), last = performance.now(), raf = 0, ended = false, waitUlt = null;
  const cardsEl = el.querySelector('.am-cards');
  const cardHtml = (c) => {
    const unit = COMPANIONS.find((x) => x.id === c.id);
    const role = ROLES[c.role];
    const main = (c.skills ?? []).find((s) => !s.ultimate)?.name ?? '';
    // v10.3 (audit) : « rôle · sort » sans point orphelin quand la carte n'a pas de rôle (familiers).
    const sub = [role?.label, main].filter(Boolean).map(escapeHtml).join(' · ');
    return `<button class="am-card r-${c.rarity}" data-pos="${c.pos}" type="button" style="--i:${c.i ?? 0}"><div class="am-pic">${hdArt(unit, 'am-art') || img(unit?.sprite ?? 'icon_star')}</div>
      <b>${escapeHtml(c.name)}</b><small>${sub}</small>
      <span class="am-hp"><i></i></span><span class="am-ult"><i></i></span></button>`;
  };
  cardsEl.innerHTML = [...run.team].sort((a, b) => a.pos - b.pos).map((c, i) => cardHtml({ ...c, i })).join('');
  // Les cartes sont distribuées face cachée puis se retournent : on y voit le dos de carte (doré après le 1er gardien).
  cardsEl.classList.add('am-deal');
  cardsEl.classList.toggle('back-gold', Boolean(run.goldBack));
  // Nom de chaque monstre sous ses pieds ; boss ou gardien : nom et barre de vie en haut de la scène.
  const namesEl = el.querySelector('.am-names'), bossEl = el.querySelector('.am-boss');
  const tags = new Map();
  let rows = 0;
  const updateMarks = () => {
    const live = new Set();
    let boss = null;
    // v10.3.1 : noms sous le sol, l'avant d'abord ; chaque nom prend la première ligne où il ne touche aucun autre.
    const lines = [];
    for (const m of scene.marks().sort((a, b) => Number(a.back) - Number(b.back) || a.x - b.x)) {
      if (m.boss) boss = m;
      if (!m.name || !m.seen || m.boss) continue;
      live.add(m.pos);
      let t = tags.get(m.pos);
      if (!t) { t = document.createElement('span'); t.className = 'am-name'; t.textContent = m.name; namesEl.appendChild(t); tags.set(m.pos, t); rows++; }
      const w = (t.offsetWidth || m.name.length * 7) + 6;
      const a = m.x - w / 2, b = m.x + w / 2;
      let row = 0;
      while ((lines[row] ??= []).some(([l, r]) => a < r && b > l)) row++;
      lines[row].push([a, b]);
      t.dataset.row = String(row);
      t.style.left = `${Math.round(m.x)}px`; t.style.top = `${Math.round(m.foot + 5 + row * 15)}px`;
    }
    for (const [pos, t] of tags) if (!live.has(pos)) { t.remove(); tags.delete(pos); }
    bossEl.classList.toggle('hidden', !boss);
    if (boss) {
      if (bossEl.dataset.name !== boss.name) {
        bossEl.dataset.name = boss.name; bossEl.querySelector('b').textContent = boss.name;
        // v10.3.1 : la mécanique du boss ou du gardien, sous sa barre (nom et effet, à la couleur de la mécanique).
        const T = TRAITS[boss.mech], mech = bossEl.querySelector('.am-mech');
        mech.classList.toggle('hidden', !T);
        if (T) { mech.style.setProperty('--mech', T.color); mech.querySelector('b').textContent = T.name; mech.querySelector('span').textContent = T.short; }
      }
      bossEl.querySelector('i').style.width = `${boss.hp * 100}%`;
      const pct = `${Math.ceil(boss.hp * 100)} %`; const sm = bossEl.querySelector('small'); if (sm.textContent !== pct) sm.textContent = pct;
    }
  };
  cardsEl.addEventListener('click', (e) => { const b = e.target.closest('.am-card.ready'); if (b && waitUlt != null && Number(b.dataset.pos) === waitUlt) waitUlt = null; });
  el.querySelector('.am-speed').addEventListener('click', (e) => { speed = speed === 1 ? 2 : 1; e.target.textContent = `×${speed}`; });
  el.querySelector('.am-mode').addEventListener('click', (e) => { manual = !manual; e.target.textContent = manual ? 'Manuel' : 'Auto'; });
  el.querySelector('.am-skip').addEventListener('click', () => { skip = true; });
  const close = () => { ui.arenaOpen = false; cancelAnimationFrame(raf); removeEventListener('resize', onResize); el.remove(); ui.invalidate?.(); };
  const updateCards = () => {
    for (const b of cardsEl.querySelectorAll('.am-card')) {
      const pos = Number(b.dataset.pos);
      const c = run.team.find((x) => x.pos === pos);
      b.querySelector('.am-hp i').style.width = `${Math.max(0, (scene.hp.ally.get(pos) ?? 0) / c.maxHp) * 100}%`;
      b.querySelector('.am-ult i').style.width = `${scene.gauge.get(pos) ?? 0}%`;
      b.classList.toggle('down', scene.down.has(pos));
      b.classList.toggle('ready', waitUlt === pos || (scene.gauge.get(pos) ?? 0) >= 100);
      b.classList.toggle('acting', scene.ultAt?.pos === pos && scene.t - scene.ultAt.t < 0.6);
    }
    updateMarks();
    const t = Math.max(0, scene.t - 1);
    el.querySelector('.am-time b').textContent = `${Math.floor(t)} s`;
    if (run.survival) { el.querySelector('.am-stars').textContent = `Vague ${(scene.waveN ?? 0) + 1}`; return; }
    const live = scene.down.size ? (scene.down.size <= 1 ? 2 : 1) : t <= A.star3 ? 3 : 2;
    el.querySelector('.am-stars').textContent = '★'.repeat(live) + '☆'.repeat(3 - live);
  };
  const finish = () => {
    if (ended) return;
    ended = true;
    // Tout ce qui reste est joué d'un coup (scène à jour), puis l'écran de fin.
    scene.quiet = scene.fired < run.events.length; // v10.3.1 : Passer → fin sans avalanche d'effets
    while (scene.fired < run.events.length) scene.play(run.events[scene.fired++]);
    scene.quiet = false;
    canvas.style.transform = ''; el.querySelector('.am-flash').style.opacity = '0';
    scene.t = Math.max(scene.t, (run.seconds ?? 0) + 1);
    updateCards();
    el.querySelector('.am-ctrl').classList.add('hidden');
    const end = el.querySelector('.am-end');
    end.classList.remove('hidden');
    if (run.survival) {
      end.innerHTML = `<div class="am-end-card"><h2>${run.record ? 'Nouveau record !' : run.won ? 'Survie réussie !' : 'Survie terminée'}</h2>
        <p><b class="num">${run.wave}</b> vague${run.wave > 1 ? 's' : ''} tenue${run.wave > 1 ? 's' : ''} · ${run.kills} ennemis vaincus</p>
        <div class="am-end-rw">${(run.rewards ?? []).map((m) => `<div>Vague ${m.wave} : ${rewardIcons(m.reward, 'named')}</div>`).join('') || '<p class="muted">Aucun nouveau palier : vise la vague suivante.</p>'}</div>
        <div class="am-end-btns"><button class="btn btn-gold am-retry" type="button">Retenter</button><button class="btn am-close" type="button">Fermer</button></div></div>`;
      end.querySelector('.am-close')?.addEventListener('click', close);
      end.querySelector('.am-retry')?.addEventListener('click', () => { close(); onRetry?.(); });
      return;
    }
    end.innerHTML = `<div class="am-end-card"><h2>${run.won ? `${escapeHtml(floorName(run.floor))} franchi !` : `${escapeHtml(floorName(run.floor))} : pas encore…`}</h2>
      <div class="am-end-stars">${[0, 1, 2].map((i) => `<span class="${i < run.stars ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.35}s">★</span>`).join('')}</div>
      ${run.newBack ? '<div class="am-end-back"><img class="px" src="assets/ui/art101/card_back_gold.png" alt=""><span><b>Dos de carte doré gagné !</b> Ta formation le porte dès le prochain combat.</span></div>' : ''}
      <div class="am-end-after" style="--after:${0.25 + 3 * 0.35 + 0.15}s">
      ${run.reward ? rewardRows(run.reward) : run.won ? '<p class="muted">Étage déjà franchi : récompense déjà prise.</p>' : '<p class="muted">Change la formation (gardien devant, soigneur derrière) ou renforce tes compagnons : essais illimités.</p>'}
      <div class="am-end-btns">${run.won ? '<button class="btn btn-gold primary-action am-next" type="button">Étage suivant ›</button>' : '<button class="btn btn-gold primary-action am-retry" type="button">Retenter</button>'}<button class="btn am-close" type="button">Fermer</button></div></div></div>`;
    end.querySelector('.primary-action')?.focus({ preventScroll: true });
    end.querySelector('.am-close')?.addEventListener('click', close);
    end.querySelector('.am-next')?.addEventListener('click', () => { close(); onNext?.(); });
    end.querySelector('.am-retry')?.addEventListener('click', () => { close(); onRetry?.(); });
  };
  el.close = close;
  // v10.3.1 : ultime — zoom léger sur le compagnon (0,4 s) et flash à sa couleur avant l'effet ; sans zoom avec
  // « réduire les animations » (le flash reste, adouci).
  const flashEl = el.querySelector('.am-flash');
  let zoomed = false;
  const ultFx = () => {
    const u = ended ? null : scene.ultFocus();
    if (u && u.scale > 1.001 && !reduceMotion()) {
      canvas.style.transformOrigin = `${Math.round(u.x)}px ${Math.round(u.y)}px`;
      canvas.style.transform = `scale(${u.scale.toFixed(4)})`;
      zoomed = true;
    } else if (zoomed) { canvas.style.transform = ''; zoomed = false; }
    const a = u ? u.flash * (reduceMotion() ? 0.5 : 1) : 0;
    flashEl.style.opacity = a > 0.005 ? a.toFixed(3) : '0';
    if (u) { flashEl.style.setProperty('--flash', u.color); flashEl.style.setProperty('--fx', `${Math.round(u.x)}px`); flashEl.style.setProperty('--fy', `${Math.round(u.y)}px`); }
    el.dataset.ult = u && (u.scale > 1.001 || a > 0.005) ? String(u.pos) : '';
  };
  const frame = (now) => {
    if (!el.isConnected) return;
    if (skip && !ended) finish();
    let dt = Math.min(0.1, (now - last) / 1000) * speed;
    last = now;
    if (!ended) {
      // Mode Manuel : le combat attend le toucher de la carte dont l'ultime part.
      const nx = scene.nextEvent();
      if (manual && nx?.kind === 'ult' && nx.side === 'ally' && nx.t <= scene.t - 1 + dt && waitUlt === null && !scene.ultDone?.has(scene.fired)) { waitUlt = nx.from; (scene.ultDone ??= new Set()).add(scene.fired); }
      const hold = waitUlt != null;
      while (dt > 0) { const s = Math.min(dt, ARENA_STEP * 2); scene.step(s, { hold }); dt -= s; }
      ultFx();
      updateCards();
      if (scene.done) finish();
    } else scene.step(Math.min(0.05, dt));
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return el;
}
