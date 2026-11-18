// v9.10 (7) : l'Arène se joue en grand, par-dessus la scène (comme la Revanche) : décor du monde de l'élément des
// ennemis, compagnons à gauche, monstres à droite, chiffres de dégâts ; puis un écran de fin (vagues tenues, record,
// récompenses nommées, Retenter). Le combat est calculé d'un coup (core/arena.js) puis rejoué en accéléré.
import { BG } from '../render/bg.js';
import { ZONES } from '../data/zones.js';
import { ARENA } from '../data/arena.js';
import { COMPANIONS } from '../data/companions.js';
import { elementBadge } from '../core/elements.js';
import { escapeHtml, formatNumber, icon, rewardIcons } from './common.js';
import { companionPortrait } from './panels/expeditions.js';
import { foeSprite, foeZone, replayAt } from './panels/arena.js';
import { reduceMotion } from './prefs.js';

const REPLAY_SECONDS = 14;
const bar = (r, color) => `<span class="arena-bar"><i style="width:${Math.max(0, Math.min(100, r * 100))}%;background:${color}"></i></span>`;

export function openArenaStage(ui, run, { retry, triesLeft }) {
  document.querySelector('.arena-overlay')?.remove();
  const el = document.createElement('div');
  el.className = 'arena-overlay wb-overlay';
  document.body.appendChild(el);
  const span = Math.max(0.1, run.fight.seconds);
  const speed = Math.max(1, span / REPLAY_SECONDS);
  const start = performance.now();
  let skip = reduceMotion(), raf = 0, ended = false;
  const close = () => { cancelAnimationFrame(raf); el.remove(); document.removeEventListener('keydown', onKey); ui.invalidate?.(); };
  const onKey = (e) => { if (e.key === 'Escape') { if (ended) close(); else skip = true; } };
  document.addEventListener('keydown', onKey);

  const frame = () => {
    const t = skip ? span : Math.min(span, ((performance.now() - start) / 1000) * speed);
    const s = replayAt(run, t);
    const seed = run.floor ?? s.wave?.n ?? 1;
    const zi = foeZone(s.foes[0]?.element, seed);
    const bg = BG[ZONES[zi]?.id] ?? BG.plains;
    const ground = bg.layers.find((l) => l.anchor === 'ground')?.file ?? '';
    const allies = run.team.map((p) => {
      const c = COMPANIONS.find((x) => x.id === p.id);
      const hurt = s.last.some((e) => e.kind === 'hurt' && e.who === p.id);
      const acts = s.last.some((e) => (e.kind === 'hit' || e.kind === 'skill') && e.who === p.id);
      return `<div class="as-unit${s.hp[p.id] <= 0 ? ' down' : ''}${hurt ? ' hurt' : ''}${acts ? ' acts' : ''}">${companionPortrait(c, true)}<b>${escapeHtml(p.name)}</b>${bar(s.hp[p.id] / p.maxHp, '#5ad07a')}</div>`;
    }).join('');
    const foes = s.foes.map((f, i) => {
      const hit = s.last.find((e) => (e.kind === 'hit' || e.kind === 'skill') && e.foe === i);
      return `<div class="as-foe${f.hp <= 0 ? ' down' : ''}${f.boss ? ' boss' : ''}${hit ? ' hit' : ''}">${hit ? `<span class="as-dmg${hit.crit ? ' crit' : ''}">${formatNumber(Math.round(hit.d))}</span>` : ''}<img class="px" src="${icon(foeSprite(f, i, seed), f.boss ? 3 : 2)}" alt="">${elementBadge(f.element, false, true)}${bar(f.hp / f.maxHp, '#e84a5f')}</div>`;
    }).join('');
    const head = run.mode === 'survival' ? `Survie · vague <b class="num">${s.wave ? s.wave.n : 1}</b> / ${ARENA.survival.waves}` : `Arène · étage <b class="num">${run.floor}</b>`;
    el.innerHTML = `<div class="as-field" style="background-image:url('assets/bg/${ground}'), linear-gradient(${bg.sky.join(',')});--ground:${bg.ground}">
        <div class="as-head">${head}</div>
        <div class="as-side">${allies}</div><div class="as-side foes">${foes}</div></div>
      <div class="wb-actions"><button class="btn small as-skip" type="button">Passer ⏭</button></div>
      ${t >= span ? endHtml(run, triesLeft) : ''}`;
    el.querySelector('.as-skip')?.addEventListener('click', () => { skip = true; });
    if (t >= span) {
      ended = true;
      el.querySelector('.wb-actions')?.remove();
      el.querySelector('.as-close')?.addEventListener('click', close);
      el.querySelector('.as-again')?.addEventListener('click', () => { close(); retry?.(); });
      el.querySelectorAll('[data-action="mentor-tip"]').forEach((b) => b.addEventListener('click', close));
      return;
    }
    raf = requestAnimationFrame(() => setTimeout(frame, 90));
  };
  frame();
}

function endHtml(run, triesLeft) {
  if (run.mode === 'survival') {
    const named = run.rewards.length ? run.rewards.map((m) => `<div>Vague ${m.wave} : ${rewardIcons(m.reward, 'named')}</div>`).join('') : '<p class="muted">Aucun nouveau palier : vise la vague suivante.</p>';
    return `<div class="wb-end"><div class="wb-end-card">
      <div class="wb-end-title">${run.record ? '<span class="wb-record">Nouveau record !</span>' : `<span>${run.won ? 'Survie réussie !' : 'Survie terminée'}</span>`}</div>
      <div class="wb-end-dmg"><span>Vagues tenues</span><b class="num">${run.wave} / ${ARENA.survival.waves}</b></div>
      <div class="muted">${run.kills} ennemis vaincus en ${Math.round(run.seconds)} s</div>
      <div class="as-rewards">${named}</div>
      <div class="wb-end-btns">${triesLeft() > 0 ? `<button class="btn btn-gold as-again" type="button">Retenter (${triesLeft()})</button>` : '<span class="muted">Plus d\'essai aujourd\'hui.</span>'}
        <button class="btn btn-primary as-close" type="button">Fermer</button></div></div></div>`;
  }
  return `<div class="wb-end"><div class="wb-end-card">
    <div class="wb-end-title"><span class="${run.won ? 'wb-record' : ''}">${run.won ? `Étage ${run.floor} franchi !` : `Étage ${run.floor} : pas encore…`}</span></div>
    ${run.won ? `<div class="as-rewards">${rewardIcons(run.reward, 'named')}${run.reward?.gear ? `<div>+ ${escapeHtml(run.reward.gear.name ?? 'équipement')}</div>` : ''}</div>` : '<p class="muted">Change l\'équipe ou améliore tes compagnons, puis retente : rien n\'est perdu.</p>'}
    <div class="wb-end-btns"><button class="btn btn-gold as-again" type="button">${run.won ? `Étage ${run.floor + 1}` : 'Retenter'}</button>
      <button class="btn btn-primary as-close" type="button">Fermer</button></div></div></div>`;
}
